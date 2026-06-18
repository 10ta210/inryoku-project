// logo-speech.js
// inryokü P3 central speech controller.
// Coordinates: canon resolution, priority queue, audio play, scene mode,
// body class, cosmos-bus events, logo phase color advance, reduced-motion path.
//
// ESM, no build. Browser only.
//
// API:
//   const speech = createLogoSpeech({ bus, audio, effects, scene, getSphere, reducedMotion });
//   speech.speak('observation', 'hover');
//   speech.enqueue('echo', 'whisper');
//   speech.interrupt();
//   speech.getCurrent(); speech.getQueue();
//   speech.onSpeak((evt) => ...);
//   speech.getPhase();
//   speech.dispose();

import { getGlyph, PHASE_ORDER, COLOR_HEX, CANON_KINDS, glyphCoversAllColors } from './logo-glyph.js';

const REGISTER_PRIORITY = {
  whisper: 1,
  hover: 2,
  click: 3,
  summon: 4,
  revelation: 5
};

const REGISTER_PROFILE = {
  whisper:    { amplitude: 0.30, decay: 1200, propagation: 1.2, audioGain: 0.45, stackRadius: 1.0 },
  hover:      { amplitude: 0.55, decay: 1600, propagation: 1.6, audioGain: 0.70, stackRadius: 1.2 },
  click:      { amplitude: 0.80, decay: 2200, propagation: 2.4, audioGain: 1.00, stackRadius: 1.4 },
  summon:     { amplitude: 1.00, decay: 2800, propagation: 3.6, audioGain: 1.15, stackRadius: 1.8 },
  revelation: { amplitude: 1.00, decay: 3600, propagation: 6.0, audioGain: 1.30, stackRadius: 2.2 }
};

const REDUCED_DECAY_FLOOR = 220;        // ms — minimal hold so screen-reader text is announced
const SECRET_WINDOW_MS = 8000;          // summon→revelation combo timeout
const PULSE_HZ = 12;                    // propagation pulse rate during sustain

function now() { return performance.now ? performance.now() : Date.now(); }

function priorityOf(register) {
  return REGISTER_PRIORITY[register] || 1;
}

function profileOf(register) {
  return REGISTER_PROFILE[register] || REGISTER_PROFILE.whisper;
}

export function createLogoSpeech(opts = {}) {
  const bus = opts.bus || null;
  const audio = opts.audio || null;
  const effects = opts.effects || null;     // expects { setActiveScene(name), getActiveScene?() }
  const getSphere = opts.getSphere || (() => null);
  const reducedMotionFn = typeof opts.reducedMotion === 'function'
    ? opts.reducedMotion
    : () => !!(typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ariaLive = opts.ariaLive || null;   // optional aria-live element
  const sceneRenderer = opts.renderer || null; // optional logo-speech-renderer instance

  // Phase index = 0..5, color = PHASE_ORDER[phaseIndex].
  let phaseIndex = typeof opts.initialPhaseIndex === 'number'
    ? ((opts.initialPhaseIndex % 6) + 6) % 6
    : 0;

  let current = null;        // { canon, register, startedAt, glyph, holdTimer, pulseTimer, profile }
  const pending = [];        // priority queue (manual)
  let prevScene = null;
  let speakingSceneActive = false;
  let disposed = false;
  let lastSummonAt = 0;
  let lastSummonGlyphComplete = false;
  let speakCounter = 0;
  const subscribers = new Set();

  function reduced() { return reducedMotionFn(); }

  function emit(event, payload) {
    if (bus && typeof bus.emit === 'function') bus.emit(event, payload);
  }

  function updateAria(canon, speaking) {
    if (!ariaLive) return;
    try {
      if (speaking) {
        ariaLive.textContent = `inryokü logo speaking: ${canon}`;
      } else {
        ariaLive.textContent = '';
      }
    } catch (_) {}
  }

  function setBodyClass(on) {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    body.classList.toggle('inryoku-speaking', !!on);
  }

  function activateScene() {
    if (speakingSceneActive || !effects) return;
    speakingSceneActive = true;
    try {
      prevScene = typeof effects.getActiveScene === 'function'
        ? effects.getActiveScene()
        : null;
      if (typeof effects.setActiveScene === 'function') {
        effects.setActiveScene('speaking');
      }
    } catch (_) {}
  }

  function deactivateScene() {
    if (!speakingSceneActive || !effects) return;
    speakingSceneActive = false;
    try {
      if (typeof effects.setActiveScene === 'function') {
        effects.setActiveScene(prevScene || 'idle');
      }
    } catch (_) {}
    prevScene = null;
  }

  function advancePhase(delta) {
    if (!delta) return;
    phaseIndex = (((phaseIndex + delta) % 6) + 6) % 6;
    const color = PHASE_ORDER[phaseIndex];
    emit('logo:phase', { index: phaseIndex, color, hex: COLOR_HEX[color] });
  }

  function detectSecret(canon, glyph) {
    if (canon === 'summon') {
      lastSummonAt = now();
      lastSummonGlyphComplete = glyphCoversAllColors(glyph);
      return;
    }
    if (canon === 'revelation') {
      const within = now() - lastSummonAt <= SECRET_WINDOW_MS;
      const phaseAtR = phaseIndex === 0;
      if (within && lastSummonGlyphComplete && phaseAtR) {
        emit('inryoku:reveal', {
          source: 'logo-speech',
          combo: ['summon', 'revelation'],
          at: now()
        });
      }
      lastSummonAt = 0;
      lastSummonGlyphComplete = false;
    }
  }

  function startUtterance(canon, register, options) {
    const safeCanon = CANON_KINDS.includes(canon) ? canon : 'core';
    const safeReg = REGISTER_PRIORITY[register] ? register : 'whisper';
    const glyph = getGlyph(safeCanon);
    const profile = profileOf(safeReg);
    const phaseIndexBefore = phaseIndex;
    speakCounter += 1;
    const utteranceId = speakCounter;

    const startedAt = now();
    current = {
      id: utteranceId,
      canon: safeCanon,
      register: safeReg,
      glyph,
      profile,
      startedAt,
      holdTimer: null,
      pulseTimer: null,
      _renderHandle: null,
      _completed: false,
      _reason: null
    };

    activateScene();
    setBodyClass(true);
    updateAria(safeCanon, true);

    // Audio
    if (audio && typeof audio.play === 'function') {
      try { audio.play(safeCanon); } catch (_) {}
    }
    emit('audio:canon', { canon: safeCanon, source: 'logo-speech' });

    // 3D renderer (if injected)
    const sphere = getSphere();
    if (sceneRenderer && typeof sceneRenderer.play === 'function') {
      try {
        current._renderHandle = sceneRenderer.play(glyph, safeReg, {
          spherePosition: sphere && sphere.position,
          sphereRadius: sphere && sphere.radius,
          reducedMotion: reduced(),
          decay: reduced() ? Math.max(REDUCED_DECAY_FLOOR, profile.decay * 0.25) : profile.decay,
          onComplete: () => {
            if (current && current.id === utteranceId) finishUtterance('natural');
          }
        });
      } catch (e) { /* renderer is non-critical */ }
    }

    // Hold timer + propagation pulses (skip pulses on reduced-motion)
    const decay = reduced()
      ? Math.max(REDUCED_DECAY_FLOOR, profile.decay * 0.25)
      : profile.decay;

    current.holdTimer = setTimeout(() => {
      if (current && current.id === utteranceId && !current._completed) {
        finishUtterance('natural');
      }
    }, decay);

    if (!reduced()) {
      const pulseInterval = 1000 / PULSE_HZ;
      current.pulseTimer = setInterval(() => {
        if (!current || current.id !== utteranceId) return;
        emit('speech:pulse', {
          register: safeReg,
          amplitude: profile.amplitude,
          radius: profile.propagation,
          t: now() - startedAt
        });
      }, pulseInterval);
    }

    emit('speech:start', {
      id: utteranceId,
      canon: safeCanon,
      register: safeReg,
      glyph,
      t: startedAt,
      phaseIndexBefore,
      reducedMotion: reduced(),
      profile
    });

    detectSecret(safeCanon, glyph);
  }

  function finishUtterance(reason) {
    if (!current) return;
    if (current._completed) return;
    current._completed = true;
    current._reason = reason;

    if (current.holdTimer) { clearTimeout(current.holdTimer); current.holdTimer = null; }
    if (current.pulseTimer) { clearInterval(current.pulseTimer); current.pulseTimer = null; }

    // Stop renderer if it didn't end naturally.
    if (current._renderHandle && typeof current._renderHandle.stop === 'function' && reason !== 'natural') {
      try { current._renderHandle.stop(reason); } catch (_) {}
    }

    const phaseDelta = current.glyph.phaseAdvance || 0;
    advancePhase(phaseDelta);

    const endPayload = {
      id: current.id,
      canon: current.canon,
      register: current.register,
      reason: reason || 'natural',
      phaseIndexAfter: phaseIndex,
      duration: now() - current.startedAt
    };

    current = null;
    setBodyClass(false);
    updateAria(endPayload.canon, false);

    emit('speech:end', endPayload);

    // Notify subscribers (sugar)
    for (const fn of subscribers) {
      try { fn(endPayload); } catch (_) {}
    }

    if (pending.length === 0) {
      deactivateScene();
      return;
    }
    // Dequeue highest priority, FIFO ties.
    pending.sort((a, b) => {
      const pd = priorityOf(b.register) - priorityOf(a.register);
      return pd !== 0 ? pd : a._seq - b._seq;
    });
    const next = pending.shift();
    emit('speech:queue', { depth: pending.length, head: peekHead() });
    startUtterance(next.canon, next.register, next.options);
  }

  function peekHead() {
    if (pending.length === 0) return null;
    const sorted = pending.slice().sort((a, b) => {
      const pd = priorityOf(b.register) - priorityOf(a.register);
      return pd !== 0 ? pd : a._seq - b._seq;
    });
    return { canon: sorted[0].canon, register: sorted[0].register };
  }

  let seq = 0;
  function pushPending(canon, register, options) {
    pending.push({ canon, register, options: options || {}, _seq: ++seq });
    emit('speech:queue', { depth: pending.length, head: peekHead() });
  }

  // Drop pending entries with priority < ref, keeping highest matches.
  function pruneLowerPriority(refReg) {
    const ref = priorityOf(refReg);
    for (let i = pending.length - 1; i >= 0; i--) {
      if (priorityOf(pending[i].register) < ref) pending.splice(i, 1);
    }
  }

  function speak(canon, register, options) {
    if (disposed) return false;
    const reg = REGISTER_PRIORITY[register] ? register : 'whisper';
    if (!CANON_KINDS.includes(canon)) return false;
    if (!current) {
      startUtterance(canon, reg, options);
      return true;
    }
    if (priorityOf(reg) > priorityOf(current.register)) {
      // Preempt.
      finishUtterance('preempt');
      // After finish, queue may have started something; if so, push incoming as pending head.
      if (current) {
        // current was replaced by queue head — push incoming back into queue.
        pushPending(canon, reg, options);
      } else {
        startUtterance(canon, reg, options);
      }
      return true;
    }
    pushPending(canon, reg, options);
    return false;
  }

  function enqueue(canon, register, options) {
    if (disposed) return false;
    if (!CANON_KINDS.includes(canon)) return false;
    const reg = REGISTER_PRIORITY[register] ? register : 'whisper';
    if (!current) {
      startUtterance(canon, reg, options);
      return true;
    }
    pushPending(canon, reg, options);
    return true;
  }

  function interrupt() {
    if (disposed) return;
    pending.length = 0;
    emit('speech:queue', { depth: 0, head: null });
    if (current) finishUtterance('interrupt');
    deactivateScene();
  }

  function getCurrent() {
    if (!current) return null;
    return {
      canon: current.canon,
      register: current.register,
      startedAt: current.startedAt,
      glyph: current.glyph
    };
  }

  function getQueue() {
    return pending.slice().map((p) => ({ canon: p.canon, register: p.register }));
  }

  function getPhase() {
    return { index: phaseIndex, color: PHASE_ORDER[phaseIndex], hex: COLOR_HEX[PHASE_ORDER[phaseIndex]] };
  }

  function onSpeak(cb) {
    if (typeof cb !== 'function') return () => {};
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    pending.length = 0;
    if (current) finishUtterance('dispose');
    deactivateScene();
    subscribers.clear();
    if (sceneRenderer && typeof sceneRenderer.dispose === 'function') {
      try { sceneRenderer.dispose(); } catch (_) {}
    }
  }

  return {
    speak,
    enqueue,
    interrupt,
    getCurrent,
    getQueue,
    onSpeak,
    getPhase,
    dispose,
    // Introspection useful for tests.
    _profileFor: profileOf,
    _priorityFor: priorityOf
  };
}

export { REGISTER_PRIORITY, REGISTER_PROFILE };
export default createLogoSpeech;
