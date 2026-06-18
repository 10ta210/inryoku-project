# P3 Visual Effects Layer — Design Spec

**Date**: 2026-05-12
**Owner**: visual-effects agent (parallel to behavior-engine agent)
**Status**: ported from `/tmp/inryoku-p3-preview/index.html` v3 prototype

## 1. Goal

Port the prototype's "visual upgrade" tier — nebula, layered stars, shooting
stars, constellation network, light bridges, holographic logo sphere,
circulation rings, behavior-switch burst — into a reusable ESM module that
plugs into the production P3 stack without disturbing `cosmos-layer.js`
(the P0–P2 DOM overlay) or the particle-behavior engine.

## 2. Module Boundary

| File                         | Owns                                        |
|------------------------------|---------------------------------------------|
| `cosmos-layer.js`            | DOM overlay (parallax SVG, mouse trail). Untouched. |
| `cosmos-effects.js`          | All Three.js *ambient* visuals (this spec). |
| `cosmos-postfx.js`           | EffectComposer (bloom + afterimage).        |
| (behavior engine, other agent) | 38k-particle field, behavior funcs, blend. |

The two agents communicate through `scene.userData` and the explicit
`effects.setActiveScene(name)` / `effects.fireBurst(color)` calls.
`effects.constData` exposes the 8 constellation centers if the behavior
engine wants to target them (e.g. light-bridge-driven emission).

## 3. Effect Inventory

| Effect             | Geometry / Material        | Count    | Cost (est) |
|--------------------|----------------------------|----------|------------|
| Nebula             | full-screen ShaderMaterial | 1 quad   | ~0.3 ms fbm5 |
| Star far/mid/near  | Points + soft-glow texture | 5100 pts | additive, no update |
| Twinkle stars      | Points, animated size      | 120      | trivial    |
| Constellations     | 8 groups of Lines + Points | ~80 lines | static     |
| Shooting stars     | Line(22), pooled           | 3 active | per-segment update on fire |
| Light bridges      | Line(60), pooled           | 5 active | quadratic bezier + head-fade per frame |
| Logo holo sphere   | Icosahedron(5) + custom shader | 1 mesh, ~1.2k tris | shader-only |
| Circulation rings  | 4 Points rings, 144 segs   | 576 pts  | rotation only |
| Burst ring         | RingGeometry(96)           | 1        | scale anim |

Total points: ~5800 + 38000 (behavior) = ~44k. Well under desktop budget.

## 4. White / Black 禁則 (compliance)

- **logo_sphere**: `gray = vec3(0.5)` base, RGBCMY mixed via fresnel and
  displacement. The light=0.5 floor prevents pure white spec.
- **shooter colors**: `setHSL(hue, 0.9, 0.5)`. l=0.5 fixed.
- **bridge colors**: `setHSL(hue, 0.95, 0.5)`. (Tweaked down from prototype's
  `0.55 + head*0.2` which could exceed 0.6 — kept floor at 0.5 by removing
  the head-boost multiplier; intensity comes from the per-segment multiplier
  instead.)
- **stars**: 4–15% accent at l=0.55, rest grayscale at gv ∈ [0.4, 0.75] — no
  pure white pixel; bloom does the perceived brightness lifting.

## 5. Perf Budget

| Platform       | Target | Notes                              |
|----------------|--------|------------------------------------|
| M-series Mac   | 60 fps | bloom+afterimage on, full counts   |
| iPhone 12+     | 60 fps | `tier: 'low'` → 1/3 stars, 2 shooters, 3 bridges, ring segs 96 |
| Low-end Android | 30 fps | same `tier: 'low'`; consider disabling bloom via opts |
| reduce-motion  | 60 fps | bloom only; afterimage + shooters off; burst instant |

Per-frame allocations: zero `new` inside `update()` for the hot path
(`tmpColor`, `_v` reused). `THREE.Color` ctor inside `updateBridges` and
`updateShooters` was hoisted to module-scope `tmpColor`.

## 6. Mobile Fallback

`createEffectsLayer(renderer, scene, camera, { tier: 'low' })` toggles:
- star counts: 3000/1500/600/120 → 1000/500/200/60
- shooters: 3 → 2
- bridges: 5 → 3
- ring segments: 144 → 96

Test page derives tier from UA + width heuristic. Production should call
the same heuristic from the runtime gate in `p3_test.html` / `index.html`.

## 7. Update Order (1 frame)

```
effects.update(t, ctx)
  ├─ nebula uniforms (time, mouse, aspect)
  ├─ stars rotation (far / mid / near / twinkle)
  ├─ constellations rotation
  ├─ updateBridges(t)        // quadratic bezier
  ├─ updateShooters(t)       // pooled fire/decay
  ├─ logo uniforms + transform
  ├─ rings rotation
  └─ burst ring scale/opacity
[behavior engine particle update happens here, owned by other module]
camera orbit
post.render()                 // composer: render → bloom → afterimage
```

## 8. Integration with `cosmos-layer.js`'s behavior engine

The behavior agent owns the 38k Points cloud and the `behaviors[]` map
(breathing / hover / ring / glyph / torus / yinyang / storm). Hooks they
will use from this module:

- `effects.setActiveScene(name)` — sync logo pulse intensity.
- `effects.fireBurst(color)` — call on behavior change.
- `effects.constData` — read-only array of 8 `{ pts[], center, phase }`
  if the behavior engine wants to seed glyph positions at constellation
  centers.

The behavior agent should:
1. Construct its own `THREE.Points` cloud with its own shader.
2. Add it to `scene` after `createEffectsLayer` so it draws on top of
   nebula but blends additively with stars / bridges.
3. Call `effects.update(t, ctx)` and `effects.setActiveScene(name)` at
   the appropriate points in its loop. Or call them from the page-level
   orchestrator.

## 9. Reduce-motion Contract

- `prefers-reduced-motion: reduce` is detected on init.
- `cosmos-postfx.js` skips the `AfterimagePass` entirely.
- `cosmos-effects.js`:
  - Shooting stars never fire (`updateShooters` early-returns).
  - Burst ring "fires" but instant-completes (scale=60, opacity=0).
  - Nebula / stars / bridges / logo / rings still animate (they're
    ambient drift, not "motion" in the WCAG sense).
- Logo pulse continues but at the gentle 0.05·sin(t·1.3) baseline.

## 10. Disposal

`effects.dispose()` walks every owned object, disposes geometry +
material + map. Safe to call when the page tears down (SPA navigation).
The shared `pointTexture` is also disposed.

## 11. Future hooks (out of scope)

- Per-constellation glyph mapping (canon 17 → 8 stars).
- WebGPU port of the nebula shader.
- Worker-threaded particle update (behavior agent's domain).
