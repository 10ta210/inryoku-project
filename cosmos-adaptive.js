/* ============================================================
   cosmos-adaptive.js — quality auto-ratchet (ESM, vanilla)
   作成: 2026-05-15

   Watches a profiler tier signal and DOWN-shifts visual quality.
   Never up-shifts (prevents oscillation). Hysteresis: must stay in
   the new tier for HYSTERESIS_MS before the ratchet fires.

   Public API:
     createAdaptive(effects, postfx, behaviorOpts, profiler, opts?) → {
       start(),
       stop(),
       getCurrent(),       // 'high' | 'medium' | 'low'
       force(tier),        // manual override (test / debug / reduce-motion)
       onChange(cb)        // (tier, prev) => void
     }

   Composition contract:
     - effects:        return value of createEffectsLayer (cosmos-effects.js)
     - postfx:         return value of createPostFX (cosmos-postfx.js)
     - behaviorOpts:   shared object the behavior runner reads each frame
                       (must have a writable `count` field; we mutate it)
     - profiler:       createProfiler() instance

   Ratchet plan (down-only):
     high   → particles 38k, bloom on (0.8), afterimage 0.78, postfx full,
              shooters 3, bridges 5, star layers 3, ring rotation on
     medium → particles 22k, bloom 0.5, afterimage off, postfx render-only,
              shooters 2, bridges 3, twinkle off
     low    → particles 10k, bypass postfx, no shooters, 1 bridge,
              no rings rotation, fog density up

   prefers-reduced-motion ALWAYS wins → forced 'low' regardless of profiler.
   ============================================================ */

const TIER_ORDER = { high: 3, medium: 2, low: 1 };

export const TIER_PRESETS = {
  high: {
    particleCount: 38000,
    bloomStrength: 0.8,
    afterimageDamp: 0.78,
    afterimageEnabled: true,
    postfxEnabled: true,
    shooters: 3,
    bridges: 5,
    starLayers: 3,
    twinkle: true,
    ringRotation: true,
    nebulaIntensity: 1.0
  },
  medium: {
    particleCount: 22000,
    bloomStrength: 0.5,
    afterimageDamp: 0.0,
    afterimageEnabled: false,
    postfxEnabled: true,
    shooters: 2,
    bridges: 3,
    starLayers: 3,
    twinkle: false,
    ringRotation: true,
    nebulaIntensity: 0.7
  },
  low: {
    particleCount: 10000,
    bloomStrength: 0.0,
    afterimageDamp: 0.0,
    afterimageEnabled: false,
    postfxEnabled: false,
    shooters: 0,
    bridges: 1,
    starLayers: 2,
    twinkle: false,
    ringRotation: false,
    nebulaIntensity: 0.4
  }
};

export function createAdaptive(effects, postfx, behaviorOpts, profiler, opts = {}) {
  const HYSTERESIS_MS = opts.hysteresisMs || 3000;
  const POLL_MS = opts.pollMs || 500;

  const reduce =
    opts.reduceMotion ??
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  // Initial tier: profiler's heuristic OR an explicit opts override.
  let current = opts.initialTier || (profiler && profiler.tier()) || 'high';
  if (reduce) current = 'low';
  let candidate = current;
  let candidateSince = 0;
  let pollTimer = 0;
  let onChangeCb = null;

  applyTier(current);

  function applyTier(tier) {
    const preset = TIER_PRESETS[tier] || TIER_PRESETS.high;

    // 1) Particle count — behaviorOpts.count is the runner-side knob.
    if (behaviorOpts && typeof behaviorOpts === 'object') {
      behaviorOpts.count = preset.particleCount;
      behaviorOpts.tier = tier;
    }

    // 2) PostFX — toggle composer.enabled if exposed, else damp bloom.
    if (postfx) {
      if (postfx.composer) {
        postfx.composer.enabled = preset.postfxEnabled;
      }
      if (postfx.bloom) {
        postfx.bloom.enabled = preset.bloomStrength > 0;
        postfx.bloom.strength = preset.bloomStrength;
      }
      if (postfx.afterimage) {
        postfx.afterimage.enabled = preset.afterimageEnabled;
        if (postfx.afterimage.uniforms && postfx.afterimage.uniforms.damp) {
          postfx.afterimage.uniforms.damp.value = preset.afterimageDamp;
        }
      }
    }

    // 3) Effects — soft handles via exposed nodes from createEffectsLayer.
    if (effects) {
      // ring rotation: zero out incremental rotation by toggling a flag
      // that cosmos-effects can honor (see hooks doc). Until then, scale
      // the rings group children rotation incrementally to zero by
      // marking the group userData.
      if (effects.rings) {
        effects.rings.userData.rotateRate = preset.ringRotation ? 1 : 0;
        effects.rings.visible = true;
      }
      if (effects.layers) {
        if (effects.layers.twinkle) effects.layers.twinkle.visible = preset.twinkle;
        if (effects.layers.far) effects.layers.far.visible = preset.starLayers >= 3;
        if (effects.layers.mid) effects.layers.mid.visible = preset.starLayers >= 2;
      }
      if (effects.nebula && effects.nebula.material) {
        // nebula intensity rides as a userData uniform if shader supports it,
        // else we simply dim opacity via material.opacity.
        effects.nebula.material.transparent = true;
        effects.nebula.material.opacity = preset.nebulaIntensity;
      }
      // shooters & bridges pool size is fixed at construction; the
      // adaptive layer can only ASK effects to honor an active-cap. We
      // publish that through effects.userData for cosmos-effects to read.
      if (typeof effects === 'object') {
        effects.runtimeCaps = {
          shooters: preset.shooters,
          bridges: preset.bridges
        };
      }
    }

    // 4) Public side-channel: dispatch event so HUD / overlay can react.
    try {
      window.dispatchEvent(new CustomEvent('cosmos:tier-change', {
        detail: { tier, preset }
      }));
    } catch (_) {}
  }

  function evaluate() {
    if (reduce) return; // locked
    const reported = profiler ? profiler.tier() : 'high';

    // Down-only: ignore tiers >= current.
    if (TIER_ORDER[reported] >= TIER_ORDER[current]) {
      candidate = current;
      candidateSince = 0;
      return;
    }
    // New candidate (lower) — start / reset hysteresis timer.
    const now = performance.now();
    if (reported !== candidate) {
      candidate = reported;
      candidateSince = now;
      return;
    }
    if (now - candidateSince >= HYSTERESIS_MS) {
      const prev = current;
      current = candidate;
      candidateSince = 0;
      applyTier(current);
      try { onChangeCb && onChangeCb(current, prev); } catch (_) {}
    }
  }

  function start() {
    if (pollTimer) return;
    pollTimer = setInterval(evaluate, POLL_MS);
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = 0;
  }

  function force(tier) {
    if (!TIER_PRESETS[tier]) return current;
    const prev = current;
    current = tier;
    candidate = tier;
    candidateSince = 0;
    applyTier(current);
    try { onChangeCb && onChangeCb(current, prev); } catch (_) {}
    return current;
  }

  function getCurrent() { return current; }
  function onChange(cb) { onChangeCb = typeof cb === 'function' ? cb : null; }

  return { start, stop, getCurrent, force, onChange };
}
