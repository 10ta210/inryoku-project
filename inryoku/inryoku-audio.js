// inryoku-audio.js
// Drone synthesizer for inRYOKU. Two detuned saws around A1, sub-octave, slow
// LFO low-pass. User gesture required to start (Web Audio policy).

export function createInryokuAudio(opts = {}) {
  const initialMuted = !!opts.mutedAtStart;
  let ctx = null;
  let master = null;
  let nodes = null;
  let started = false;
  let muted = initialMuted;

  // A1 = 55 Hz. Detune ±5 cents on two saws. Sub at A0 = 27.5 Hz.
  const F0 = 55;
  const DETUNE_CENTS = 5;

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function buildGraph() {
    const sawA = ctx.createOscillator();
    const sawB = ctx.createOscillator();
    const sub  = ctx.createOscillator();
    sawA.type = 'sawtooth';
    sawB.type = 'sawtooth';
    sub.type  = 'sine';
    sawA.frequency.value = F0;
    sawB.frequency.value = F0;
    sawA.detune.value = -DETUNE_CENTS;
    sawB.detune.value =  DETUNE_CENTS;
    sub.frequency.value = F0 / 2;

    const mix = ctx.createGain();
    mix.gain.value = 0.32;
    sawA.connect(mix);
    sawB.connect(mix);

    const subGain = ctx.createGain();
    subGain.gain.value = 0.55;
    sub.connect(subGain);

    // Slow LFO modulating low-pass cutoff
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.value = 320;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06; // very slow
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;   // cutoff sweep amplitude
    lfo.connect(lfoGain).connect(filter.frequency);

    mix.connect(filter);

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0;  // fade-in scheduled below
    filter.connect(master);
    subGain.connect(master);
    master.connect(ctx.destination);

    const now = ctx.currentTime;
    sawA.start(now); sawB.start(now); sub.start(now); lfo.start(now);

    if (!muted) {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(0.14, now + 4.0); // gentle 4s fade-in
    }
    return { sawA, sawB, sub, lfo, filter, master };
  }

  /** Must be called from a user gesture. */
  async function start() {
    if (started) return;
    if (!ensureContext()) return;
    try { if (ctx.state === 'suspended') await ctx.resume(); } catch (_) {}
    nodes = buildGraph();
    started = true;
  }

  function setMuted(m) {
    muted = !!m;
    if (!started || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    const target = muted ? 0 : 0.14;
    master.gain.linearRampToValueAtTime(target, now + 0.6);
  }

  function toggleMute() { setMuted(!muted); return muted; }
  function isMuted() { return muted; }
  function isStarted() { return started; }

  function dispose() {
    if (!ctx) return;
    try {
      if (nodes) {
        nodes.sawA.stop(); nodes.sawB.stop(); nodes.sub.stop(); nodes.lfo.stop();
      }
    } catch (_) {}
    try { ctx.close(); } catch (_) {}
    ctx = null; nodes = null; started = false;
  }

  // Pause when page is hidden — be a kind drone.
  document.addEventListener('visibilitychange', () => {
    if (!started || !ctx) return;
    if (document.hidden) {
      try { ctx.suspend(); } catch (_) {}
    } else if (!muted) {
      try { ctx.resume(); } catch (_) {}
    }
  });

  return { start, setMuted, toggleMute, isMuted, isStarted, dispose };
}

export default createInryokuAudio;
