/**
 * phase-bus.js — global event bus + state machine for inryokü inter-phase transitions.
 *
 * Vanilla ESM. No build. Singleton on window.__inryokuPhase.
 *
 * Phase order: P0 (mac dialog) → P1 (win95 boot) → P2 (quantum code + yin-yang)
 *   → P3 (universe + 8 constellations) → inRYOKU (sub-route, unlocked by 6-colour merge).
 *
 * Why a singleton: existing P0/P1/P2/P3 main code is closed-over and unmodifiable here.
 * The bus is the integration point — phases subscribe voluntarily via window.__inryokuPhase.
 *
 * Events emitted:
 *   'phase:enter'              { phase }              — phase has fully taken over
 *   'phase:leave'              { phase }              — phase has fully released
 *   'phase:transition:start'   { from, to, opts }     — metamorphosis begins
 *   'phase:transition:end'     { from, to }           — metamorphosis ends; bus consumed
 *   'phase:handoff'            { fromPhase, toPhase, particles[], ... }  — bus written
 *
 * The same bus also writes the legacy `window.__inryokuHandoff` snapshot object,
 * so existing un-bus-aware code (per the spec §5) can still read it.
 */

const PHASE_ORDER = ['P0', 'P1', 'P2', 'P3', 'inRYOKU'];

const VALID_EVENTS = new Set([
  'phase:enter',
  'phase:leave',
  'phase:transition:start',
  'phase:transition:end',
  'phase:handoff',
]);

/**
 * createPhaseBus({ initialPhase, reduceMotion }) → bus instance.
 * @param {object} [opts]
 * @param {'P0'|'P1'|'P2'|'P3'|'inRYOKU'} [opts.initialPhase='P0']
 * @param {boolean} [opts.reduceMotion=auto]   override reduce-motion detection
 * @param {boolean} [opts.debug=false]
 */
export function createPhaseBus(opts = {}) {
  const debug = !!opts.debug;
  const reduceMotionAuto =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduceMotion = opts.reduceMotion != null ? !!opts.reduceMotion : reduceMotionAuto;

  let current = opts.initialPhase || 'P0';
  let transitioning = null;     // { from, to, controller } when in flight
  const listeners = new Map();  // event → Set<fn>

  function log(...args) { if (debug) console.log('[phase-bus]', ...args); }

  function on(event, fn) {
    if (!VALID_EVENTS.has(event)) throw new Error('phase-bus: unknown event ' + event);
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  }

  function emit(event, payload) {
    if (!VALID_EVENTS.has(event)) throw new Error('phase-bus: unknown event ' + event);
    log('emit', event, payload);
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); }
      catch (e) { console.error('[phase-bus] listener error in ' + event, e); }
    }
  }

  function getCurrent() { return current; }

  function isInFlight() { return !!transitioning; }

  /**
   * Write the legacy __inryokuHandoff snapshot (per spec §5).
   * Allows un-bus-aware phase code to still pick up particle handoff.
   */
  function writeHandoff(handoff) {
    if (typeof window === 'undefined') return;
    window.__inryokuHandoff = handoff;
    emit('phase:handoff', handoff);
  }

  function consumeHandoff() {
    if (typeof window === 'undefined') return null;
    const h = window.__inryokuHandoff;
    if (!h) return null;
    // stale rejection — spec §5: older than 3s, ignore
    if (typeof h.bornAt === 'number' && performance.now() - h.bornAt > 3000) {
      delete window.__inryokuHandoff;
      return null;
    }
    delete window.__inryokuHandoff;
    return h;
  }

  /**
   * transition(toPhase, opts) → Promise<void>.
   *
   * opts:
   *   transitionModule — { run(fromState, toState) → Promise, cancel() } from
   *                      phase-transitions/*. If absent, performs an instant cut.
   *   fromState, toState — passed verbatim to transitionModule.run.
   *   force            — allow re-transitioning while one is in flight (cancels).
   */
  function transition(toPhase, opts = {}) {
    if (!PHASE_ORDER.includes(toPhase)) {
      return Promise.reject(new Error('phase-bus: invalid target ' + toPhase));
    }
    if (toPhase === current && !opts.force) {
      return Promise.resolve();
    }
    if (transitioning) {
      if (!opts.force) {
        return Promise.reject(new Error('phase-bus: transition in flight to ' + transitioning.to));
      }
      try { transitioning.controller?.cancel?.(); } catch (_) {}
      transitioning = null;
    }

    const from = current;
    const to = toPhase;
    const mod = opts.transitionModule || null;
    const controller = mod ? mod : null;

    transitioning = { from, to, controller };
    emit('phase:transition:start', { from, to, opts });
    emit('phase:leave', { phase: from });

    const reducedAlpha = reduceMotion && !opts.transitionModule;
    const animPromise = reduceMotion
      ? instantCutFade(200)
      : mod
        ? Promise.resolve(mod.run(opts.fromState || null, opts.toState || null))
        : instantCutFade(0);

    return animPromise.then(
      () => {
        current = to;
        transitioning = null;
        emit('phase:enter', { phase: to });
        emit('phase:transition:end', { from, to });
      },
      (err) => {
        transitioning = null;
        // graceful degradation per spec §13 — adopt target anyway
        current = to;
        emit('phase:enter', { phase: to });
        emit('phase:transition:end', { from, to, error: err });
        throw err;
      }
    );
  }

  function dispose() {
    listeners.clear();
    if (typeof window !== 'undefined' && window.__inryokuPhase === api) {
      delete window.__inryokuPhase;
    }
  }

  const api = {
    getCurrent,
    isInFlight,
    transition,
    on,
    emit,
    writeHandoff,
    consumeHandoff,
    dispose,
    get reduceMotion() { return reduceMotion; },
    get phases() { return PHASE_ORDER.slice(); },
  };

  if (typeof window !== 'undefined') {
    if (window.__inryokuPhase && !opts.force) {
      log('reusing existing __inryokuPhase');
      return window.__inryokuPhase;
    }
    window.__inryokuPhase = api;
  }

  return api;
}

/** Brief alpha fade (used for reduce-motion and fallback). */
function instantCutFade(ms) {
  return new Promise((resolve) => {
    if (!ms || typeof document === 'undefined') return resolve();
    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;background:#000;opacity:0;' +
      'pointer-events:none;z-index:99998;transition:opacity ' + ms + 'ms linear';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); resolve(); }, ms);
      }, ms);
    });
  });
}

/* ---------- shared particle-handoff helpers (used by phase-transitions/*) ---------- */

/**
 * cubic ease-in-out, matches the spec's cubicBezier(0.2, 0.7, 0.2, 1) feel.
 * Used for position lerp on all 4 transitions.
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Linear interp on a [0..1] RGB triple. */
export function lerpRGB(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** RGB [0..1] → CSS rgba. */
export function rgbaCSS(rgb, alpha) {
  return 'rgba(' +
    Math.round(rgb[0] * 255) + ',' +
    Math.round(rgb[1] * 255) + ',' +
    Math.round(rgb[2] * 255) + ',' + (alpha == null ? 1 : alpha) + ')';
}

/**
 * Run an rAF loop for `duration` ms, calling `step(t, elapsed)` each frame
 * with t in [0..1]. Resolves with elapsed when done. Supports cancel().
 */
export function rafAnim(duration, step) {
  let raf = 0;
  let cancelled = false;
  const start = performance.now();
  const promise = new Promise((resolve) => {
    function tick(now) {
      if (cancelled) return resolve(now - start);
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      try { step(t, elapsed); } catch (e) { console.error('[rafAnim]', e); }
      if (t >= 1) return resolve(elapsed);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  });
  return {
    promise,
    cancel() { cancelled = true; cancelAnimationFrame(raf); },
  };
}

export default createPhaseBus;
