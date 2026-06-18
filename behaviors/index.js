// behaviors/index.js
// Static-import collector for all P3 particle behaviors. Exposes:
//   - BEHAVIORS:    Map<id, { meta, step }>
//   - getBehavior:  id => entry | undefined
//   - resolveBehavior(state, opts): id     (state + reduce-motion + url override)
//   - safeStep:     try/catch wrapper that falls back to idle_static
//
// Static import is mandatory: no fetch / eval / dynamic import. Behaviors are
// shipped in source and reviewed via PR.

import * as breathingSphere from './breathing_sphere.js';
import * as attractorHover from './attractor_hover.js';
import * as ringResonance from './ring_resonance.js';
import * as convergenceGlyph from './convergence_glyph.js';
import * as lightBridgeAccent from './light_bridge_accent.js';
import * as idleStatic from './idle_static.js';

const MODULES = [
  breathingSphere,
  attractorHover,
  ringResonance,
  convergenceGlyph,
  lightBridgeAccent,
  idleStatic,
];

function buildMap(mods) {
  const map = new Map();
  for (const m of mods) {
    if (!m || !m.meta || typeof m.meta.id !== 'string') {
      throw new Error('[behaviors] module missing meta.id');
    }
    if (typeof m.step !== 'function') {
      throw new Error('[behaviors] module ' + m.meta.id + ' missing step()');
    }
    if (map.has(m.meta.id)) {
      throw new Error('[behaviors] duplicate id: ' + m.meta.id);
    }
    map.set(m.meta.id, { meta: m.meta, step: m.step });
  }
  return map;
}

export const BEHAVIORS = buildMap(MODULES);

export function getBehavior(id) {
  return BEHAVIORS.get(id);
}

// state → id mapping. Matches the design spec table.
const STATE_TO_ID = {
  idle: 'breathing_sphere',
  discovery: 'attractor_hover',
  speaking: 'ring_resonance',
  contact: 'convergence_glyph',
  bridge: 'light_bridge_accent',
};

/**
 * Resolve the active behavior id from a scene state object.
 * Precedence: URL override > reduce-motion > state map > idle default.
 *
 * @param {object} state
 *   { state, reduceMotion, urlBehavior } — all optional.
 */
export function resolveBehavior(state) {
  const s = state || {};
  if (typeof s.urlBehavior === 'string' && BEHAVIORS.has(s.urlBehavior)) {
    return s.urlBehavior;
  }
  if (s.reduceMotion) return 'idle_static';
  const id = STATE_TO_ID[s.state];
  if (id && BEHAVIORS.has(id)) return id;
  return 'breathing_sphere';
}

/**
 * GC-zero step wrapper with try/catch fallback. If the active behavior throws
 * (or is missing) we silently fall back to idle_static so the canvas never
 * goes black.
 */
export function safeStep(id, i, count, target, color, time, ctx) {
  const entry = BEHAVIORS.get(id);
  if (entry) {
    try {
      entry.step(i, count, target, color, time, ctx);
      return id;
    } catch (_e) {
      // fall through
    }
  }
  // Fallback. idle_static is guaranteed to exist (would have thrown at boot).
  BEHAVIORS.get('idle_static').step(i, count, target, color, time, ctx);
  return 'idle_static';
}

// Convenience: expose to window for debug parity with cosmos-layer.
if (typeof window !== 'undefined') {
  window.__inryokuBehaviorAPI = {
    list: () => Array.from(BEHAVIORS.keys()),
    get: getBehavior,
    resolve: resolveBehavior,
  };
}
