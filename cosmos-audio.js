// cosmos-audio.js — inryokü P3 audio synthesis layer
// ESM, no build, no external libs. Raw Web Audio API.
// Maps 17 canon → procedural synth presets.
//
// Hard rules:
//  - never start AudioContext without explicit user gesture
//  - prefers-reduced-motion or muted → silent stub
//  - mic is opt-in via connectMic()
//  - 60 fps friendly: analyzer fftSize 1024, no per-frame allocations
//
// iOS contract: createAudio() may be called at any time, but start()
// MUST be invoked from a user-gesture handler. ensureCtx() is deferred
// until start() so AudioContext is born inside the gesture. Late-resumed
// contexts not born in a gesture are silently rejected by iOS Safari.

const CANON_LIST = [
  'silence', 'core', 'ma', 'shadow', 'emit', 'observation',
  'self_question', 'declaration', 'leap', 'resonance', 'consensus',
  'past_speculation', 'future_command', 'echo', 'quotation',
  'summon', 'revelation'
];

// Frequency table (Hz) — RGBCMY 6色 + extension tones
const F = {
  C2: 65.41, C3: 130.81, G3: 196.00, A3: 220.00,
  C4: 261.63, E4: 329.63, G4: 392.00, A4: 440.00,
  B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
  G5: 783.99, A5: 880.00, C6: 1046.5, E6: 1318.5, G6: 1568.0
};

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createAudio(opts = {}) {
  const cfg = {
    masterVolume: 0.35,
    silent: false,
    forceSilent: prefersReducedMotion(),
    fftSize: 1024,
    // Optional: announce(msg, priority) plug — wired by integration to
    // cosmos-a11y so AT users hear mic permission prompts, mute toggles, etc.
    announce: typeof opts.announce === 'function' ? opts.announce : null,
    ...opts
  };
  if (typeof cfg.announce !== 'function') cfg.announce = null;

  let ctx = null;
  let masterGain = null;
  let analyzer = null;
  let limiter = null;
  let micStream = null;
  let micSource = null;
  let micAnalyzer = null;
  let micGain = null;
  let started = false;
  let disposed = false;

  // Pre-allocated typed arrays for analyzer reads (no GC)
  let spectrumBuf = null;
  let waveformBuf = null;
  let micSpectrumBuf = null;

  function silentMode() {
    return cfg.forceSilent || cfg.silent || disposed;
  }

  function ensureCtx() {
    if (ctx || silentMode()) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { cfg.forceSilent = true; return null; }
    ctx = new AC({ latencyHint: 'interactive' });
    masterGain = ctx.createGain();
    masterGain.gain.value = cfg.masterVolume;
    analyzer = ctx.createAnalyser();
    analyzer.fftSize = cfg.fftSize;
    analyzer.smoothingTimeConstant = 0.82;
    // Soft limiter via WaveShaper to prevent clipping on stacked canons
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    masterGain.connect(limiter);
    limiter.connect(analyzer);
    analyzer.connect(ctx.destination);
    spectrumBuf = new Uint8Array(analyzer.frequencyBinCount);
    waveformBuf = new Uint8Array(analyzer.fftSize);
    return ctx;
  }

  // ---------- Synth primitives ----------

  function env(node, t0, attack, hold, release, peak = 1) {
    const g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0, t0);
    g.linearRampToValueAtTime(peak, t0 + attack);
    g.setValueAtTime(peak, t0 + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  }

  function osc(type, freq, t0, attack, hold, release, peak, detune = 0) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (detune) o.detune.setValueAtTime(detune, t0);
    o.connect(g); g.connect(masterGain);
    env(g, t0, attack, hold, release, peak);
    o.start(t0);
    o.stop(t0 + attack + hold + release + 0.05);
    return { o, g };
  }

  function noise(t0, duration, peak, filterType = 'highpass', cutoff = 2000) {
    const samples = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = cutoff;
    filt.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = peak;
    src.connect(filt); filt.connect(g); g.connect(masterGain);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
    return { src, g };
  }

  function chord(freqs, t0, attack, hold, release, peak, type = 'sine') {
    const per = peak / Math.max(1, freqs.length);
    freqs.forEach((f, i) => osc(type, f, t0, attack + i * 0.012, hold, release, per));
  }

  function sweep(fromHz, toHz, t0, dur, peak, type = 'triangle') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(fromHz, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), t0 + dur);
    o.connect(g); g.connect(masterGain);
    env(g, t0, 0.02, dur * 0.6, dur * 0.4, peak);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  }

  function delayFeedback(t0, taps, baseFreq) {
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.18;
    const fb = ctx.createGain();
    fb.gain.value = 0.55;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(masterGain);
    for (let i = 0; i < taps; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = baseFreq * Math.pow(2, -i * 0.5);
      o.connect(g); g.connect(delay);
      env(g, t0 + i * 0.08, 0.005, 0.04, 0.12, 0.3);
      o.start(t0 + i * 0.08);
      o.stop(t0 + i * 0.08 + 0.25);
    }
    // auto-cleanup
    setTimeout(() => { try { wet.disconnect(); delay.disconnect(); fb.disconnect(); } catch (_) {} }, 4000);
  }

  function reversedBell(t0) {
    // Reversed bell = swell in, sharp cut
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o2.type = 'sine';
    o.frequency.value = F.E5; o2.frequency.value = F.G5 * 2.01;
    o.connect(g); o2.connect(g); g.connect(masterGain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.96);
    o.start(t0); o2.start(t0);
    o.stop(t0 + 1.0); o2.stop(t0 + 1.0);
  }

  function stutter(t0, baseFreq, count, interval) {
    for (let i = 0; i < count; i++) {
      osc('square', baseFreq * (1 + (i % 2) * 0.02), t0 + i * interval, 0.002, 0.02, 0.04, 0.18);
    }
  }

  function formantVoice(t0, base) {
    // Pitched-down voice formant approx — three band-passed saws
    const formants = [700, 1220, 2600]; // /a/ vowel-ish
    formants.forEach((fc, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = base;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fc;
      bp.Q.value = 8;
      const g = ctx.createGain();
      o.connect(bp); bp.connect(g); g.connect(masterGain);
      env(g, t0, 0.04, 0.5, 0.4, 0.12 / (i + 1));
      o.start(t0);
      o.stop(t0 + 1.1);
    });
  }

  function rumbleCrescendo(t0) {
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sine';
    o.frequency.setValueAtTime(F.C2 * 0.5, t0);
    o.frequency.linearRampToValueAtTime(F.C2, t0 + 1.6);
    o2.frequency.setValueAtTime(F.C2, t0);
    o2.frequency.linearRampToValueAtTime(F.C3, t0 + 1.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(120, t0);
    lp.frequency.linearRampToValueAtTime(900, t0 + 1.6);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(masterGain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.45, t0 + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
    o.start(t0); o2.start(t0);
    o.stop(t0 + 1.85); o2.stop(t0 + 1.85);
  }

  function shimmerPing(t0) {
    // Bright bell-like, additive
    const partials = [1, 2.01, 3.02, 4.7, 5.43];
    const amps    = [0.35, 0.22, 0.15, 0.09, 0.05];
    partials.forEach((p, i) => osc('sine', F.E5 * p, t0, 0.002, 0.06, 0.9, amps[i]));
  }

  // ---------- Canon → preset dispatch ----------

  const PRESETS = {
    silence: () => { /* noop — silence is canon */ },

    core: (t0) => {
      // Low sine 60Hz drone, ~520ms hold
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o2.type = 'sine';
      o.frequency.value = 60;
      o2.frequency.value = 60.4; // beat
      o.connect(g); o2.connect(g); g.connect(masterGain);
      env(g, t0, 0.08, 0.38, 0.18, 0.5);
      o.start(t0); o2.start(t0);
      o.stop(t0 + 0.8); o2.stop(t0 + 0.8);
    },

    ma: (t0) => {
      // sub-bass pulse, breath of 間
      osc('sine', 45, t0, 0.18, 0.18, 0.32, 0.55);
      osc('sine', 90, t0 + 0.02, 0.18, 0.18, 0.30, 0.18);
    },

    shadow: (t0) => {
      // high-pass noise, dark whisper
      noise(t0, 0.95, 0.18, 'highpass', 3200);
      osc('sine', 110, t0, 0.04, 0.6, 0.32, 0.12);
    },

    emit: (t0) => {
      // rising sweep — particle release
      sweep(F.A3, F.E6, t0, 0.9, 0.32, 'triangle');
    },

    observation: (t0) => {
      // shimmer ping — bright bell
      shimmerPing(t0);
    },

    self_question: (t0) => {
      // rising minor third C5 → Eb5
      osc('triangle', F.C5, t0, 0.02, 0.18, 0.18, 0.28);
      osc('triangle', F.C5 * Math.pow(2, 3 / 12), t0 + 0.22, 0.02, 0.22, 0.34, 0.28);
    },

    declaration: (t0) => {
      // punchy attack at 440 — assertion
      osc('square', F.A4, t0, 0.002, 0.1, 0.2, 0.32);
      osc('triangle', F.A4 * 2, t0, 0.002, 0.08, 0.16, 0.16);
      noise(t0, 0.06, 0.18, 'highpass', 4000);
    },

    leap: (t0) => {
      // octave jump A3 → A5
      osc('triangle', F.A3, t0, 0.01, 0.12, 0.12, 0.28);
      osc('triangle', F.A5, t0 + 0.14, 0.005, 0.2, 0.55, 0.30);
    },

    resonance: (t0) => {
      // sustained ring 3-note chord (C–E–G), ~1.4s
      chord([F.C4, F.E4, F.G4], t0, 0.06, 0.9, 0.5, 0.32, 'sine');
    },

    consensus: (t0) => {
      // warm major chord (C–E–G–C) sine + triangle blend
      chord([F.C4, F.E4, F.G4, F.C5], t0, 0.05, 0.7, 0.6, 0.28, 'sine');
      chord([F.C4, F.E4, F.G4],         t0 + 0.02, 0.06, 0.7, 0.6, 0.10, 'triangle');
    },

    past_speculation: (t0) => {
      // reversed bell — past welling forward
      reversedBell(t0);
    },

    future_command: (t0) => {
      // 16th-note stutter, declarative bursts
      stutter(t0, F.E5, 8, 0.07);
    },

    echo: (t0) => {
      // feedback delay
      delayFeedback(t0, 3, F.G4);
    },

    quotation: (t0) => {
      // pitched-down voice formant
      formantVoice(t0, F.G3);
    },

    summon: (t0) => {
      // low rumble crescendo
      rumbleCrescendo(t0);
    },

    revelation: (t0) => {
      // full RGBCMY 6-tone chord — R=C4 G=E4 B=G4 C=A4 M=B4 Y=D5
      const rgbcmy = [F.C4, F.E4, F.G4, F.A4, F.B4, F.D5];
      chord(rgbcmy, t0, 0.04, 0.6, 1.0, 0.46, 'sine');
      shimmerPing(t0 + 0.05);
      sweep(F.C3, F.E6, t0, 0.6, 0.12, 'triangle');
    }
  };

  // ---------- Public API ----------

  function start() {
    if (silentMode()) return Promise.resolve(false);
    ensureCtx();
    if (!ctx) {
      // ensureCtx returned null — either no AudioContext API or silent mode.
      // On iOS this can also mean start() was called outside a user gesture.
      try { console.warn('[cosmos-audio] start() failed: no AudioContext (called outside gesture?)'); } catch (_) {}
      return Promise.resolve(false);
    }
    started = true;
    if (ctx.state === 'suspended') return ctx.resume().then(() => true);
    return Promise.resolve(true);
  }

  function stop() {
    if (!ctx) return Promise.resolve();
    started = false;
    if (ctx.state === 'running') return ctx.suspend();
    return Promise.resolve();
  }

  function play(canon, when = 0) {
    if (silentMode() || !started) return;
    if (!ctx) return;
    if (!PRESETS[canon]) return;
    const t0 = ctx.currentTime + Math.max(0, when);
    try { PRESETS[canon](t0); } catch (e) { /* swallow — never throw into UI loop */ }
  }

  function pulse(intensity = 1) {
    if (silentMode() || !started) return;
    if (!ctx) return;
    // soft observation tick — gentle shimmer scaled by intensity
    const t0 = ctx.currentTime;
    const i = Math.max(0.05, Math.min(1, intensity));
    osc('sine', F.E6, t0, 0.005, 0.04, 0.18, 0.08 * i);
    osc('sine', F.G6, t0 + 0.01, 0.005, 0.03, 0.16, 0.06 * i);
  }

  async function connectMic() {
    if (silentMode()) return false;
    if (!ctx) await start();
    if (!ctx || !navigator.mediaDevices?.getUserMedia) return false;
    if (micStream) return true;
    // a11y: announce before the browser prompt appears so screen-reader users
    // are not surprised by the permission dialog.
    if (cfg.announce) {
      try {
        cfg.announce(
          'Microphone permission requested. This is optional and used only for sound responsive effects.',
          'polite'
        );
      } catch (_) {}
    }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      micSource = ctx.createMediaStreamSource(micStream);
      micGain = ctx.createGain();
      micGain.gain.value = 1;
      micAnalyzer = ctx.createAnalyser();
      micAnalyzer.fftSize = cfg.fftSize;
      micAnalyzer.smoothingTimeConstant = 0.6;
      micSource.connect(micGain);
      micGain.connect(micAnalyzer);
      // never route mic → destination (feedback)
      micSpectrumBuf = new Uint8Array(micAnalyzer.frequencyBinCount);
      return true;
    } catch (e) {
      micStream = null;
      return false;
    }
  }

  function disconnectMic() {
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
    }
    try { micSource?.disconnect(); } catch (_) {}
    try { micGain?.disconnect(); } catch (_) {}
    try { micAnalyzer?.disconnect(); } catch (_) {}
    micStream = null; micSource = null; micGain = null; micAnalyzer = null;
  }

  function getLevel() {
    // RMS-ish level 0..1 from mic if present, else master
    const a = micAnalyzer || analyzer;
    if (!a) return 0;
    const buf = micAnalyzer ? micSpectrumBuf : waveformBuf;
    if (micAnalyzer) a.getByteFrequencyData(buf);
    else a.getByteTimeDomainData(buf);
    let sum = 0;
    if (micAnalyzer) {
      for (let i = 0; i < buf.length; i++) sum += buf[i];
      return (sum / buf.length) / 255;
    }
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  function getSpectrum() {
    if (!analyzer) return null;
    analyzer.getByteFrequencyData(spectrumBuf);
    return spectrumBuf;
  }

  function getMicSpectrum() {
    if (!micAnalyzer) return null;
    micAnalyzer.getByteFrequencyData(micSpectrumBuf);
    return micSpectrumBuf;
  }

  function setVolume(v) {
    cfg.masterVolume = Math.max(0, Math.min(1, v));
    if (masterGain && ctx) masterGain.gain.setTargetAtTime(cfg.masterVolume, ctx.currentTime, 0.05);
  }

  function setMuted(m) {
    cfg.silent = !!m;
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(m ? 0 : cfg.masterVolume, ctx.currentTime, 0.03);
    }
  }

  // Page-visibility auto-pause — handler ref retained for clean dispose.
  const onVisibility = () => {
    if (!ctx) return;
    if (document.hidden && ctx.state === 'running') ctx.suspend();
    else if (!document.hidden && started && ctx.state === 'suspended') ctx.resume();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  function dispose() {
    // Idempotent: second call is a no-op (defensive, avoids double ctx.close).
    if (disposed) return;
    disposed = true;
    disconnectMic();
    if (typeof document !== 'undefined') {
      try { document.removeEventListener('visibilitychange', onVisibility); } catch (_) {}
    }
    try { masterGain?.disconnect(); } catch (_) {}
    try { analyzer?.disconnect(); } catch (_) {}
    try { limiter?.disconnect(); } catch (_) {}
    if (ctx) { try { ctx.close(); } catch (_) {} }
    ctx = null; masterGain = null; analyzer = null; limiter = null;
  }

  return {
    start, stop, play, pulse,
    connectMic, disconnectMic,
    getLevel, getSpectrum, getMicSpectrum,
    setVolume, setMuted, dispose,
    canonList: () => CANON_LIST.slice(),
    isSilent: () => silentMode(),
    isStarted: () => started
  };
}

export { CANON_LIST };
