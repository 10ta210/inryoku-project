// cosmos-observation.js — inryokü +1% observation counter
// ESM. Stores in localStorage with timestamp. Caps at 99, wraps to 50.
// "100% は無い" — saturates at 99, never showing 100.

const STORAGE_KEY = 'inryoku.observation.v1';
const FLOOR = 50;
const CEIL = 99; // never 100

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (typeof obj.pct !== 'number') return null;
    return obj;
  } catch (_) { return null; }
}

function writeStore(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

export function createObservation(opts = {}) {
  const cfg = { startPct: FLOOR, persist: true, ...opts };

  let state = (cfg.persist && readStore()) || {
    pct: cfg.startPct,
    total: 0,
    lastAt: 0,
    history: [] // recent {t, source, pct}
  };

  const listeners = new Set();

  function emit(payload) {
    listeners.forEach(cb => { try { cb(payload); } catch (_) {} });
  }

  function pulse(source = 'unknown') {
    const now = Date.now();
    // Debounce: same-source AND within 80ms collapses to one. Only the most
    // recent history entry is checked (history[0]) — this is intentional and
    // cheap; cross-source pulses are never debounced against each other.
    if (state.lastAt && now - state.lastAt < 80 && state.history[0]?.source === source) {
      return state.pct;
    }
    let next = state.pct + 1;
    let wrapped = false;
    if (next > CEIL) {
      next = FLOOR; // wrap — 100% は無い
      wrapped = true;
    }
    state.pct = next;
    state.total += 1;
    state.lastAt = now;
    state.history.unshift({ t: now, source, pct: next });
    if (state.history.length > 32) state.history.length = 32;
    if (cfg.persist) writeStore(state);
    emit({ pct: next, source, total: state.total, wrapped, t: now });
    return next;
  }

  function getPct() { return state.pct; }
  function getTotal() { return state.total; }
  function getHistory() { return state.history.slice(); }

  function onPulse(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function reset() {
    state = { pct: cfg.startPct, total: 0, lastAt: 0, history: [] };
    if (cfg.persist) writeStore(state);
    emit({ pct: state.pct, source: 'reset', total: 0, wrapped: false, t: Date.now() });
  }

  // RGB/CMY decomposition — by source rotation
  // Sources cycle through 6 colors so the HUD bar feels organic.
  const COLOR_ROTATION = ['R', 'G', 'B', 'C', 'M', 'Y'];
  function decomposition() {
    const counts = { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 };
    state.history.forEach((h, i) => {
      const c = COLOR_ROTATION[i % 6];
      counts[c] += 1;
    });
    return counts;
  }

  return {
    pulse, getPct, getTotal, getHistory, decomposition,
    onPulse, reset,
    FLOOR, CEIL
  };
}
