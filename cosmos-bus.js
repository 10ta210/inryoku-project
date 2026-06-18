// cosmos-bus.js — inryokü P3 tiny event bus.
// ESM. No deps. Synchronous. Listeners that throw are isolated.
//
// Standard events (vocabulary):
//   'behavior:change'      { id, prev, meta }
//   'observation:pulse'    { pct, source, total, wrapped, t }
//   'audio:canon'          { canon, source? }
//   'effects:burst'        { color }
//   'scene:reduce-motion'  { reduce: boolean }
//   'scene:resize'         { w, h }
//   'audio:ready'          { started: boolean }
//
// Usage:
//   import { createBus } from './cosmos-bus.js';
//   const bus = createBus();
//   const off = bus.on('behavior:change', (p) => console.log(p));
//   bus.emit('behavior:change', { id: 'ring_resonance', prev: 'idle_static' });
//   off();

export function createBus() {
  const map = new Map(); // event → Set<fn>

  function on(event, fn) {
    if (typeof fn !== 'function') return () => {};
    let set = map.get(event);
    if (!set) { set = new Set(); map.set(event, set); }
    set.add(fn);
    return () => off(event, fn);
  }

  function off(event, fn) {
    const set = map.get(event);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) map.delete(event);
  }

  function emit(event, payload) {
    const set = map.get(event);
    if (!set || set.size === 0) return;
    // Snapshot to avoid mutation during dispatch.
    const fns = Array.from(set);
    for (const fn of fns) {
      try { fn(payload); }
      catch (e) { try { console.warn('[cosmos-bus] listener for', event, 'threw:', e); } catch (_) {} }
    }
  }

  function clear() { map.clear(); }

  return { on, off, emit, clear };
}

export default createBus;
