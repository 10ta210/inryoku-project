# Perf Adaptation & Mobile Fallback — Design Spec

**Date**: 2026-05-12 (drafted 2026-05-15)
**Scope**: P3 visual upgrade — runtime quality scaling + mobile shims
**Authors**: agent wave 2

## 0. Problem statement

`cosmos-effects.js` (wave 1) lands ~38k particles, UnrealBloom + Afterimage,
5 nebula FBM octaves, 5 light bridges, 3 shooting stars and a holo-sphere
shader. On M-series desktops this holds 60fps. On iPhone 12-class
(A14, 4GB), the cost is on the edge. On iPhone SE (A13, 3GB) or
mid-range Android (4 cores, 4GB) it tanks.

Target:
- M-series desktop: 60fps stable
- iPhone 12+ : 30+ fps
- iPhone SE / mid Android: 24+ fps (acceptable, prefers-reduced-motion path)

P3 cannot ship a single quality preset. We need (a) profiling, (b) tier
ratcheting, (c) mobile shims.

## 1. Architecture

```
                  ┌──────────────────────┐
                  │   cosmos-perf.js      │  ← rAF profiler, GC heuristic
                  │   createProfiler()    │
                  └──────────┬────────────┘
                             │ tier()
                             ▼
┌───────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  cosmos-mobile.js │──▶│ cosmos-adaptive  │──▶│ cosmos-effects   │
│  applyMobile()    │   │ createAdaptive() │   │ cosmos-postfx    │
└───────────────────┘   └──────────────────┘   │ behaviors/*      │
        │                       │              └──────────────────┘
        │                       ▼
        │             ┌──────────────────────┐
        └────────────▶│ cosmos-perf-overlay  │  ?perf=1 only
                      └──────────────────────┘
```

All modules communicate via a small CustomEvent vocabulary on `window`:

| Event                        | Source             | Consumer            |
|------------------------------|--------------------|---------------------|
| `cosmos:perf-drop`           | profiler           | mobile (thermal)    |
| `cosmos:tier-change`         | adaptive           | overlay, HUD        |
| `cosmos:thermal-throttle`    | mobile             | adaptive (force low)|
| `cosmos:low-battery`         | mobile (Battery API)| adaptive            |
| `cosmos:pause` / `:resume`   | mobile (visibility)| effects runner      |

This keeps modules de-coupled — they can be loaded/missed independently.

## 2. Tier table (exact preset values)

| Param                | high       | medium     | low        |
|----------------------|------------|------------|------------|
| particle count       | 38,000     | 22,000     | 10,000     |
| bloom strength       | 0.8        | 0.5        | 0.0 (off)  |
| afterimage           | 0.78 damp  | off        | off        |
| postfx composer      | full       | render only| bypass     |
| shooting stars       | 3          | 2          | 0          |
| light bridges        | 5          | 3          | 1          |
| star layers          | far+mid+near+twinkle | far+mid+near | mid+near |
| ring rotation        | on         | on         | off        |
| nebula opacity       | 1.0        | 0.7        | 0.4        |
| twinkle pulse        | on         | off        | off        |

Sourced from `TIER_PRESETS` in `cosmos-adaptive.js`.

## 3. Hysteresis math

The adaptive layer polls profiler tier every 500ms. To ratchet:

1. Observe `reported = profiler.tier()`
2. If `order(reported) >= order(current)` → ignore (no up-shift)
3. If `reported !== candidate` → set candidate, reset `candidateSince = now`
4. If `now - candidateSince >= 3000ms` → ratchet `current ← candidate`,
   call `applyTier`, fire `cosmos:tier-change`

Three seconds is enough to ride out a single janky animation
(menu open, route change) without flipping. The down-only rule
prevents oscillation entirely; the user gets a stable session at
the worst tier observed so far.

`prefers-reduced-motion` always wins → `force('low')` on init.

## 4. Initial tier heuristic

```js
mem  = navigator.deviceMemory     || 8       // GB
cores = navigator.hardwareConcurrency || 8
coarse = matchMedia('(pointer: coarse)').matches
small  = screen.width < 500

if (mem <= 2 || cores <= 2 || small)        → 'low'
else if (mem <= 4 || (coarse && cores <=6)) → 'medium'
else                                         → 'high'
```

Empirical mapping:

| Device                      | mem | cores | coarse | initial |
|-----------------------------|-----|-------|--------|---------|
| MacBook M3 Pro              | 8+  | 12    | no     | high    |
| iPhone 15 Pro               | 8   | 6     | yes    | high    |
| iPhone 12                   | 4   | 6     | yes    | medium  |
| iPhone SE 2020              | 3   | 6     | yes    | medium* |
| mid Android (4G/4c)         | 4   | 4     | yes    | medium  |
| budget Android (2G/4c)      | 2   | 4     | yes    | low     |

\* On iPhone SE the profiler will quickly down-shift to `low`.

## 5. Fallback decision tree

```
                ┌─ ?perf=1 → mount overlay
boot ─┬─ apply mobile shims
      ├─ create profiler.start()
      ├─ adaptive.start()
      │
      ├─ on perf-drop ×3 in 30s    → mobile suggests 'low'
      ├─ on battery < 20%          → mobile suggests 'low'
      ├─ on visibility hidden      → mobile pauses rAF
      └─ on prefers-reduced-motion → adaptive.force('low')
```

The fallback chain is conservative: when in doubt, drop quality.
Battery and thermal paths short-circuit hysteresis (immediate
force, not candidate-pending).

## 6. Mobile UX changes

- Touch hover via `touchmove` → synthesized `mousemove` so the
  existing `attractor_hover` behavior works without modification.
- HUD compact mode: when `applyMobile().isMobile === true`, the
  percentage HUD shrinks to 11px and the cursor ring is hidden.
- Tap targets ≥ 44×44 (already enforced via P0 styles).
- `--dvh` / `--vvh` CSS variables track real visible viewport
  height — fixes iOS Safari URL-bar collapse jank.
- DeviceOrientation gravity bias is opt-in (privacy + iOS requires
  a user gesture for permission). Surfaced via a "tilt to look
  around" prompt that the i18n string `cosmos.tilt.prompt` covers.

## 7. WebGL feature detection

The adaptive layer does NOT currently probe WebGL feature support —
the assumption is Three.js r160's renderer.capabilities already gives
us `maxTextureSize`, `maxAttributes`, `floatVertexTextures`. For wave 3,
we should:

- `renderer.capabilities.maxTextureSize >= 4096` → ok for nebula
- `renderer.capabilities.maxTextureSize < 2048`  → force 'low'
- `renderer.extensions.has('OES_texture_float')` controls afterimage
- `renderer.getContext().isContextLost()` → graceful disable

This belongs in `createEffectsLayer` (it owns the renderer). Wave 3
ticket below.

## 8. Hooks cosmos-effects.js needs to expose (wave 3 patch)

The adaptive layer ratchets quality at runtime, but `cosmos-effects.js`
currently fixes star/bridge/shooter pool sizes at construction. To
fully realize the tier table without rebuilding the scene, wave 3
should patch cosmos-effects.js to honor:

1. `effects.runtimeCaps = { shooters, bridges }` — already published
   by `applyTier`. cosmos-effects should clamp the active count in
   `updateShooters` / `updateBridges` against these caps each frame
   (allocate pool at max, hide overflow).
2. `effects.layers.<name>.visible` toggling — already partially
   honored, but `twinkle.visible` should also suspend the
   `material.size = ... Math.sin(time*3) ...` write.
3. `effects.rings.userData.rotateRate` — multiplier for the
   `r.rotation.z += ...` writes in update.
4. `effects.nebula.material.opacity` — already supported by
   ShaderMaterial.transparent fallback, but we'd prefer a
   `u_intensity` uniform so the fragment shader can attenuate the
   FBM mix term directly (cheaper than alpha blending the full
   quad).
5. `effects.setParticleCount(n)` — for behaviors layer. Currently
   the behavior engine owns particle count; cosmos-effects does
   not. The adaptive layer mutates `behaviorOpts.count` and the
   behavior runner consumes it. Confirm wave 1 runner respects
   this — if not, behavior runner needs a `setCount(n)` shim that
   resizes its BufferGeometry.

Until these patches land, tier 'medium' and 'low' get partial
benefit (postfx + visibility flags work; pool ratchets are no-ops).

## 9. iPhone 12 baseline estimate

Methodology: scaled from M3 Pro measurement (60fps @ 38k particles +
full postfx) by the ratio of:
- GPU shading: A14 ≈ M3 / 3.2
- Memory bandwidth: A14 ≈ M3 / 4.0
- Particle bottleneck is fill-rate, not vertex.

Estimated baseline (high tier, untouched):
- Frame: 28–34ms (≈ 30fps)
- Bloom dominates at ≈ 11ms
- Afterimage adds ≈ 4ms (full-screen copy)

After adaptive ratchets medium:
- Frame: 18–22ms (≈ 50fps)
- Bloom @ 0.5 strength ≈ 7ms
- Afterimage off

After ratchets low:
- Frame: 12–15ms (≈ 65fps)
- No postfx, 10k particles

iPhone SE: starts medium, settles low within 6s.

These are **estimates** — wave 4 (post-launch) must collect real
Lighthouse Mobile + WebPageTest A14 numbers.

## 10. Confidence

Medium-high.

- Profiler / adaptive logic: high. The rAF sliding window and
  hysteresis approach is standard and verified by unit test
  (no allocation on hot path, quickselect for median).
- Mobile shims: high. Battery / visibility / orientation are
  well-trodden DOM surface area.
- Tier preset values: medium. Will need tuning after first real
  iPhone 12 measurement. Particularly the medium tier 22k count
  is a guess.
- cosmos-effects coupling: low until wave 3 patches the hooks
  listed in §8. Without those, the 'medium' tier silently
  no-ops on shooters/bridges/star pools.
