# P2 Upgrade — The Yin-Yang Manifold & The 101% Revelation
**date:** 2026-05-12
**status:** design / awaiting review
**phase:** P2 (Quantum Code World · Yin-Yang 50% · RGBCMY Sphere 101%)
**relation to current P2:** **additive layers only** — `p2_code_for_claude.js` (4000-particle code world + two orbiting spheres) is preserved; this spec adds a particle yin-yang manifold and an observation-triggered 101% reveal layered on top.

---

## 0. TL;DR

Today's P2 reads as **two static spheres adrift in a green code rain**. Beautiful, but the spheres don't *do* anything when looked at. Target: the yin-yang becomes a **particle manifold** — 50% grey is the *field*, and CMYR-G-B pulses travel the dividing S-curve like blood through a vein. The 101% sphere becomes invisible until *observed* (mouse proximity), at which point it manifests as a momentary particle revelation, then dissolves back to potential. **Observation is the verb, not the noun.**

The philosophy: grey is not the absence of colour; grey is colour *not yet collapsed*. The observer collapses it.

## 1. Philosophy Mapping

| Element | Current | Upgraded | Philosophy |
|---|---|---|---|
| Yin-yang sphere (50%) | static UV sphere with B/W texture | particle manifold, grey field, RGBCMY pulses on the dividing curve | the dividing line is where the two coexist; the rest is shared field |
| 101% sphere | static RGBCMY sphere always visible | invisible field; reveals only on observation | 101% is not a state, it's an event |
| Code rain | 4000 particles of 0/1 | unchanged | the substrate of reality is still digital |
| Mouse hover | nothing | +1% pulse to nearest manifold sector; reveals 101% if held | observation = the measurement that collapses wavefunction |
| Audio | none currently | low binaural bed + per-pulse chimes synced to RGBCMY frequencies | each colour has a sound; observation has a sound |

## 2. Alternative Approaches Considered

### Option A — **"Particle Manifold + Observation Reveal"** (chosen)
The yin-yang is rebuilt as a 12000-particle density field where probability is shaped by a parametric S-curve. The 101% sphere is rendered only when the mouse-projected ray is within 1.2 world-units of its centre, and fades in/out over 600ms.

**Pros:** strongest mapping to philosophy (observation collapses potential). Particles unify P2 visually with P3 (which is particle-driven). Mouse interaction has meaning, not decoration.
**Cons:** heaviest. Two new particle systems + ray-projection logic. ~30% more GPU than current.

### Option B — **"Shader Sphere Upgrade"**
Keep both spheres as meshes; just upgrade their shaders. Yin-yang gets animated dividing curve with RGBCMY edge glow; 101% gets fresnel reveal on hover.

**Pros:** cheapest. Single-file shader change. Mesh count unchanged.
**Cons:** misses the philosophy beat — "particles can dissolve and reform" is the whole point. Doesn't visually bridge to P3.

### Option C — **"Procedural Geometry Morph"**
Yin-yang sphere physically deforms into the 101% sphere on hover (vertex shader morphing two pre-computed geometries).

**Pros:** dramatic. Single mesh switching identity is symbolically rich.
**Cons:** "the two are the same thing in different states" is *wrong* for this philosophy. The 50% and 101% are not phases of one object; they're field and event. Conceptually wrong. **Rejected.**

**Decision: Option A.** Highest cost is justified by the philosophy fit and the P3 visual continuity.

## 3. Architecture (Additive Layers Only)

```
┌────────────────────────────────────────────────────────────────────┐
│ Layer 4  Audio: 50% drone + RGBCMY chime per pulse                 │  NEW
├────────────────────────────────────────────────────────────────────┤
│ Layer 3  101% Revelation: invisible field, particles on observe    │  NEW
├────────────────────────────────────────────────────────────────────┤
│ Layer 2  Yin-Yang Manifold: particle density field + pulses        │  NEW
├────────────────────────────────────────────────────────────────────┤
│ Layer 1  Existing P2: code rain + orbits (UNCHANGED, dimmed +30%)  │  KEEP
└────────────────────────────────────────────────────────────────────┘
```

File split:

```
inryoku_hp/
  p2_code_for_claude.js              # UNTOUCHED
  p2_layers/                         # NEW
    yinyang_manifold.js              # 12000-particle density field + pulses
    revelation_101.js                # observation-gated reveal
    p2_audio.js                      # drone + chimes
    p2_handoff.js                    # consume __inryokuHandoff from P1
    index.js                         # opt-in entry
```

Bootstrap:
```js
// p2_layers/index.js
const _origP2 = window.renderPhase2;
window.renderPhase2 = function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return _origP2();
  _origP2();                      // existing renderer + scene mounted
  Handoff.consume();              // read 64 particles from P1
  YinYang.attach(scene, camera);  // add to existing scene
  Reveal.attach(scene, camera);
  P2Audio.init();
  /* dim existing spheres by 30% to give the manifold visual room */
  dimLegacy(0.7);
};
```

## 4. Yin-Yang Manifold Math

### 4.1 Density Distribution

The yin-yang is a 2D figure embedded in 3D. We parameterise on a sphere of radius `R = 1.8` and define the *dividing curve* in (θ, φ) spherical coords:

```
divider(θ) = φ_eq + A * sin(θ) * cos(θ/2)         where φ_eq = π/2 (equator)
                                                          A = π/6 amplitude
```

This produces the classic S-curve when wrapped around the sphere — one lobe pushes north, the other south.

Particle density `ρ(θ, φ)`:
```
d = φ - divider(θ)                              // signed distance from curve
hemi = sign(d)                                  // -1 = "yin", +1 = "yang"
ρ_field = 1.0                                   // base uniform density
ρ_curve = exp(-|d|² * 12.0) * 3.5               // strong gaussian on the curve
ρ_dot   = exp(-|p - dot_yin|² * 8.0 + exp(-|p - dot_yang|² * 8.0)) * 2.0
ρ(θ,φ) = ρ_field + ρ_curve + ρ_dot
```

Particle count: `N = 12000`. Sample positions by inverse-CDF on `ρ` (precomputed once at init, ~30ms one-shot).

### 4.2 Colour Field

```
field colour:  grey (0.5, 0.5, 0.5) with ±0.04 hash noise per particle
curve colour:  RGBCMY hue cycling along arclength θ
dot colour:    yin-dot is RGB-tinted (light in shadow); yang-dot is CMY-tinted (shadow in light)
```

Critical: **no pure black, no pure white**. Field particles vary `0.46 ≤ luminance ≤ 0.56`. The yin and yang lobes differ *only* in hue tint (slight cool vs warm), not in luminance. This is the "white-black forbidden" rule.

### 4.3 Pulses Along the Curve

A pulse is an arc segment of arclength 0.35 that travels along `divider(θ)` at angular velocity `ω = 0.6 rad/s`. There are 6 pulses, one per RGBCMY colour, phased at `(k/6) * 2π` so they're evenly distributed around the sphere.

Each pulse temporarily boosts:
- `ρ_curve` × 2.5 within its arc
- particle hue toward the pulse colour with weight `pulseWeight(θ_particle, θ_pulse) = exp(-d² * 80)`
- particle size × (1 + 0.4 * pulseWeight)

A pulse passing a particle takes ~0.6s. Observation adds new pulses (§5).

### 4.4 Sphere Rotation

The manifold rotates slowly around the *world* y-axis at 0.05 rad/s. The dividing curve thus appears to *flow* even though particles are statically attached to the sphere — the rotation makes the curve traverse the visible hemisphere.

## 5. Observation Interaction (+1% Pulse)

### 5.1 Mouse → World Ray

Standard NDC → camera ray. Find nearest point on the sphere surface to the ray:
```
t = clamp(dot(sphere_center - ray.origin, ray.dir), 0, ∞)
nearest = ray.origin + ray.dir * t
sphere_surface = normalize(nearest - sphere_center) * R + sphere_center
```

### 5.2 Pulse Injection

When `|nearest - sphere_surface| < 0.4` (mouse "over" sphere) AND distance to dividing curve `< 0.3`:
- spawn a new pulse at that θ, hue = sampled from current arclength position
- pulse decays normally over 0.8s
- limit: max 12 pulses in flight (queue oldest out)
- Counter: every 100 pulses, a system event "+1% acknowledged" fires (HUD readout)

### 5.3 Why "+1%" not "100%"

100% is the dogma "I have observed completely". 101% is "observation that exceeds the original whole because the observer is added". Each user-generated pulse is one increment of *adding the observer to the system*. The display literally counts: "50%", then "51%", ..., never reaching "100%" — it skips from 99% straight to "101%" once 50 pulses are reached.

## 6. The 101% Revelation

### 6.1 Default State: Invisible

The 101% sphere is **not rendered** during default scene. Its position is fixed (offset `+4.0` on x from yin-yang, matching current `p2_code_for_claude.js` layout). Code-rain particles continue to flow past it.

### 6.2 Observation Trigger

When the user keeps mouse pointer within world-ray distance `1.2` of the 101% sphere centre for **continuous 600ms**, the revelation begins:

1. **t=0 → 200ms** — 3000 grey particles materialise at the sphere surface (radial emission from centre, decelerating). Audio: low rumble fade-in.
2. **t=200 → 600ms** — particles split by hue into 6 RGBCMY shells, each rotating on a different axis. The sphere's "skin" is revealed as 6 nested rotating colour caps that *interfere* to produce, at any given pixel, a brief flash of one of the 6 hues.
3. **t=600 → 1200ms** — particles slow, gravity pulls them toward the sphere centre, density doubles, RGBCMY rings become visible.
4. **t=1200 → ?** — held state. Audio: 6-tone chord (RGBCMY harmonic stack). Counter on HUD reaches "101%".
5. **On mouse leave** — particles disperse outward over 800ms, fading to invisibility. Sphere returns to potential.

### 6.3 The "50→101 skip"

The HUD counter behaviour:
```
default:     50%
on observe:  50% → 51% → 52% → ... → 99% → 101%
                                          ^ skip
on release:  101% → 50% (instant)
```

There is no 100%. This is the *whole point*.

## 7. Audio Sync

### 7.1 Drone Bed
Continuous from P2 start. Two slowly-detuned sine waves (A2 = 110Hz, A2 + 4Hz = 114Hz) creating a 4Hz binaural beat. Gain 0.04.

### 7.2 Pulse Chimes
Each RGBCMY pulse triggers a chime on its lobe's dot:
| colour | freq (Hz) | mapping |
|---|---|---|
| R | 528 | "love" |
| G | 432 | "earth" |
| B | 396 | "release" |
| C | 741 | "express" |
| M | 852 | "intuition" |
| Y | 639 | "connect" |

(Solfeggio frequencies; same kit referenced in the inRYOKU spiritual sub-track.)

Envelope: 4ms attack, 200ms exponential decay, gain 0.05.

### 7.3 Revelation Chord
When the 101% reveal completes, the 6 frequencies sound together. Sustained 4 seconds, then fades.

### 7.4 Audio Gating
- Muted by default (`window._inryokuMuted`)
- Initiated on user gesture only
- Reduce-motion: drone yes, pulses no, chord no

## 8. Integration with Existing Quantum Code World

The existing `p2_code_for_claude.js` runs **unchanged**. We add:

- 30% opacity dim to its `mat.uniforms.opacity` (single line monkey-patch reading the existing uniform)
- The existing two spheres (yin-yang mesh + RGBCMY mesh) — the yin-yang mesh is set to opacity 0.0 (hidden behind the manifold), and the RGBCMY mesh is set to opacity 0.0 (invisible until reveal). Both meshes stay in the scene to preserve any other code that references them.
- The 4000 code particles are repositioned by the manifold's gravity field when within 2.0 world-units of the sphere — they appear to *flow around* the manifold. Implemented as a per-frame override on their `position` attribute, restoring original on reset.

## 9. Mobile Fallback

P2 is skipped on mobile (UA check in `p1_index_for_claude.html`). For iPad-class (≥768 + touch):

- Manifold: 6000 particles instead of 12000
- Revelation: 1500 particles, 6-shell collapsed to 3-shell (RGB only; CMY hidden)
- Observation interaction: tap-and-hold instead of hover (600ms hold same threshold)
- Audio: muted unless explicit toggle
- Counter: same 50→101 behaviour

## 10. Reduce-Motion Behaviour

- Manifold renders as static particles, no rotation, no pulses
- 101% reveal: triggered by clicking (not hovering), instant materialisation (no animation), holds until click again
- Audio: drone only, no chimes/chord

## 11. Accessibility

- Aria-live announcement when counter reaches 101%: "observation acknowledged"
- Keyboard alternative: pressing `O` for 600ms triggers the reveal (key-repeat as proxy for "hold")
- Documented in `/legal.html` accessibility statement
- All visual content has audio equivalents (drone = "yin-yang present", chord = "101% reached")

## 12. Performance Budget

| metric | target | mechanism |
|---|---|---|
| Manifold particle update | <4ms | precomputed positions, only colour/size updated per frame |
| Revelation render | <2ms | 3000 particles, simple additive billboards |
| Ray-sphere closest-point | <0.05ms | per-mouse-move, not per-frame |
| Memory delta vs current | <12MB | 2 PointGeometries + 1 audio context |
| 60fps held with existing P2 + manifold + reveal | yes on M1 | measured target |

## 13. Test Plan

```
tests/p2-upgrade/
  manifold-density.spec.js   # inverse-CDF sample reproduces target density
  divider-curve.spec.js      # curve passes through known control points
  pulse-travel.spec.js       # pulse arc-position correct at t=N
  reveal-gate.spec.js        # 600ms hold threshold, mouse-leave dispersal
  counter.spec.js            # 50→99→101 skip path
  handoff.spec.js            # P1 64-particle seed read and consumed
  reduce-motion.spec.js      # static manifold, click-triggered reveal
```

Visual regression: 6 deterministic frames + 1 reveal frame.

## 14. Acceptance Criteria

- [ ] Yin-yang manifold renders 12000 particles; dividing curve visible and animated by 6 RGBCMY pulses
- [ ] No pure black or pure white particles (luminance ∈ [0.46, 0.56] for field; pulse colours fully saturated but never white)
- [ ] 101% sphere invisible by default
- [ ] 600ms hover triggers reveal; mouse-leave disperses; no state persists
- [ ] Counter shows 50%→101% skip (never 100%)
- [ ] Audio silent by default, gated by user gesture, drone + chimes + chord work
- [ ] Existing `p2_code_for_claude.js` untouched (git diff confirms)
- [ ] Code rain particles flow around manifold within 2.0 units
- [ ] P1 handoff: 64-particle seed appears at P2 start, fades from P1 colour to P2 green over 1.2s
- [ ] `inryoku:p2complete` still fires identically to current

## 15. Rollback

Delete `p2_layers/` and remove its `<script>` from `index.html`. Original P2 continues to run.

## 16. Open Questions

1. Should pulses respond to audio input (mic) for performance-art mode? (Out of scope; would map to existing audio-reactive system in P3.)
2. The 101% reveal — should it be a one-time-per-session "you have seen it" gate, or repeatable? (Current: repeatable. Each observation re-collapses the wavefunction.)
3. Mobile reveal interaction — long-press might compete with browser context menu. May need `touch-action: none` on the canvas.
