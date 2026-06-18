// cosmos-interaction.js — DOM events → observation pulses + audio canons
// ESM. Configurable scope. No external deps.

// Konami codes are stored lowercased; key comparisons normalize before lookup
// so Shift+B / capslock don't break the sequence (N6).
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
// FULL_CANON_SEQUENCE is intentionally re-ordered for the Konami narrative
// arc (silence → emergence → questioning → declaration → revelation) and
// differs from CANON_LIST order in cosmos-audio.js. Do NOT "align".
const FULL_CANON_SEQUENCE = [
  'silence', 'core', 'ma', 'shadow', 'echo',
  'observation', 'self_question', 'past_speculation', 'quotation',
  'emit', 'declaration', 'resonance', 'consensus',
  'future_command', 'leap', 'summon', 'revelation'
];

export function wireInteractions(opts = {}) {
  const cfg = {
    scope: opts.scope || (typeof document !== 'undefined' ? document.documentElement : null),
    audio: opts.audio || null,
    observation: opts.observation || null,
    idleMs: 30000,
    mousemoveThrottleMs: 900, // sparse pulses
    scrollBottomEpsilon: 4,
    enabled: true,
    ...opts
  };

  if (!cfg.scope) return { dispose: () => {} };

  const scope = cfg.scope;
  let lastMove = 0;
  let lastKey = 0;
  let idleTimer = null;
  let wokenOnce = false;
  let konamiIdx = 0;
  let muted = false; // module-instance owned (B8) — no longer reads audio._muted
  const cleanups = [];

  function fire(source, canon) {
    if (cfg.observation) cfg.observation.pulse(source);
    if (canon && cfg.audio) cfg.audio.play(canon);
  }

  function resetIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // 30s silence → silence canon (gentle, no pulse)
      if (cfg.audio) cfg.audio.play('silence');
    }, cfg.idleMs);
    if (!wokenOnce) {
      wokenOnce = true;
      fire('wakeup', 'core');
    }
  }

  function onMousemove(e) {
    const now = performance.now();
    if (now - lastMove < cfg.mousemoveThrottleMs) return;
    lastMove = now;
    fire('mousemove', null); // pulse only, no canon — too noisy
    if (cfg.audio) cfg.audio.pulse(0.3);
    resetIdle();
  }

  function onClick(e) {
    // Don't fire when clicking the mute/start chrome controls
    if (e.target?.closest?.('[data-cosmos-chrome]')) return;
    fire('click', 'declaration');
    resetIdle();
  }

  function onScroll() {
    resetIdle();
    const doc = document.documentElement;
    const bottom = (window.innerHeight + window.scrollY) >= (doc.scrollHeight - cfg.scrollBottomEpsilon);
    if (bottom && !onScroll._fired) {
      onScroll._fired = true;
      fire('scroll-bottom', 'revelation');
      // I10 — track the timeout so dispose() inside the 4s window cancels it.
      const tid = setTimeout(() => { onScroll._fired = false; }, 4000);
      cleanups.push(() => clearTimeout(tid));
    }
  }

  function onKeydown(e) {
    const now = performance.now();
    if (now - lastKey < 40) return;
    lastKey = now;
    resetIdle();

    // Konami code — lowercase single chars so Shift+B / capslock still match.
    const normalized = (typeof e.key === 'string' && e.key.length === 1)
      ? e.key.toLowerCase()
      : e.key;
    if (normalized === KONAMI[konamiIdx]) {
      konamiIdx += 1;
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0;
        playSequence();
        return;
      }
    } else {
      konamiIdx = normalized === KONAMI[0] ? 1 : 0;
    }

    if (e.key === 'r' || e.key === 'R') fire('key-r', 'resonance');
    else if (e.key === 'i' || e.key === 'I') fire('key-i', 'revelation');
    else if (e.key === 'm' || e.key === 'M') {
      // B8 — module-instance owned `muted` flag, no longer pokes audio._muted.
      if (cfg.audio?.setMuted) {
        muted = !muted;
        cfg.audio.setMuted(muted);
      }
    } else {
      fire('keypress', null);
    }
  }

  function playSequence() {
    if (!cfg.audio) return;
    FULL_CANON_SEQUENCE.forEach((canon, i) => {
      setTimeout(() => {
        cfg.audio.play(canon);
        if (cfg.observation) cfg.observation.pulse('konami:' + canon);
      }, i * 380);
    });
  }

  // Optional: blow detection — caller can opt in via opts.enableMicBlow
  let micRAF = null;
  function startMicBlowDetection() {
    if (!cfg.audio?.connectMic) return Promise.resolve(false);
    return cfg.audio.connectMic().then((ok) => {
      if (!ok) return false;
      let recent = 0;
      const tick = () => {
        if (!cfg.enabled) return;
        const lvl = cfg.audio.getLevel();
        // Blow threshold: sustained high level for ~120ms
        if (lvl > 0.32) recent += 16;
        else recent = Math.max(0, recent - 32);
        if (recent > 120) {
          recent = 0;
          fire('mic-blow', 'emit');
        }
        micRAF = requestAnimationFrame(tick);
      };
      micRAF = requestAnimationFrame(tick);
      return true;
    });
  }
  function stopMicBlowDetection() {
    if (micRAF) cancelAnimationFrame(micRAF);
    micRAF = null;
    if (cfg.audio?.disconnectMic) cfg.audio.disconnectMic();
  }

  // Attach
  scope.addEventListener('mousemove', onMousemove, { passive: true });
  scope.addEventListener('click', onClick);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('keydown', onKeydown);

  cleanups.push(
    () => scope.removeEventListener('mousemove', onMousemove),
    () => scope.removeEventListener('click', onClick),
    () => window.removeEventListener('scroll', onScroll),
    () => window.removeEventListener('keydown', onKeydown)
  );

  resetIdle();

  return {
    fire,
    playSequence,
    startMicBlowDetection,
    stopMicBlowDetection,
    setEnabled(b) { cfg.enabled = !!b; },
    dispose() {
      cfg.enabled = false;
      if (idleTimer) clearTimeout(idleTimer);
      stopMicBlowDetection();
      cleanups.forEach(fn => { try { fn(); } catch (_) {} });
    }
  };
}

export { FULL_CANON_SEQUENCE };
