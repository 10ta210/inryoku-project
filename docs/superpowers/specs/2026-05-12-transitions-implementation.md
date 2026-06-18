# Inter-Phase Transitions — Implementation Notes
**date:** 2026-05-12
**status:** implemented (wave 2)
**parent:** `2026-05-12-inter-phase-transitions.md`

This document records *how* the transition system was built, the choices that
shaped it, and the hooks each phase's main code needs to expose so wave 3 can
patch them.

## 1. Files Delivered

| file | role |
|---|---|
| `phase-bus.js` | singleton state-machine + event bus, mounted on `window.__inryokuPhase`. Also exports shared easing/lerp/raf helpers. |
| `phase-transitions/p0-to-p1.js` | Mac dialog → Win95 boot. 256 grey carrier particles. |
| `phase-transitions/p1-to-p2.js` | Win95 boot → quantum code + yin-yang. 64 scatter-then-converge particles. |
| `phase-transitions/p2-to-p3.js` | Yin-yang + 101% sphere → universe + 8 constellations. 128 (64 code + 64 manifold) outflow particles, light bridge between 2 stars. |
| `phase-transitions/p3-to-inryoku.js` | Universe → inRYOKU 裏ルート. Gated on 6-colour RGBCMY merge. Spiral fold + portal. |
| `transitions_test.html` | standalone preview cycling all 4 transitions with stand-in phase visuals. |
| `docs/superpowers/specs/2026-05-12-transitions-implementation.md` | this file. |

All vanilla ESM. No build step. No external runtime dependencies.

## 2. State Captured Per Phase

Each `createTransition(opts).run(fromState, toState)` accepts a `fromState`
shape specific to the outgoing phase. These shapes are the contract wave 3 must
fulfil when wiring the live P0–P3 systems to the bus.

| phase | fromState fields | meaning |
|---|---|---|
| P0 | `centerX, centerY, dialogRect, canvas?` | focal point for the radial burst |
| P1 | `particles: [{x,y,hue}], canvas?` | sampled pre-roll cloud at EVENT_COLLAPSE |
| P2 | `codeParticles, manifoldParticles, spherePoints, dividingCurve, canvas?` | live samples from cosmos-effects code-rain + cosmos-layer manifold |
| P3 | `universeParticles, sixColorState:{r,g,b,c,m,y}, portalCenter, canvas?` | sampled universe + revelation-canon colour-accumulator state |

`toState` is the *next* phase's hints — particle counts, navigation hook, etc.
All transitions tolerate missing `fromState` by synthesising plausible
particles (graceful degradation per spec §13).

## 3. Particle Pool Reuse Strategy

We do NOT create or destroy main-phase particle buffers across transitions.
Each transition module:

1. **Reads** a flat snapshot (`[{x, y, hue}, ...]`) from the outgoing phase.
2. **Allocates** its own short-lived overlay canvas + particle records (≤ 256
   entries) that live only for the transition's duration.
3. **Writes** the handoff snapshot to `window.__inryokuHandoff` for the
   incoming phase to consume.

The incoming phase's existing buffer (P1's pre-roll cloud, P2's 4000 code
rain, P3's 38000 universe) is *seeded* from the snapshot — a subset of its
existing particles has their initial position/hue overridden. No allocation
happens at the boundary. The carrier set is flagged for ~800–1500ms of
modified behaviour (higher alpha, custom drift) before rejoining the native
behaviour system.

This keeps the most demanding moment (the boundary itself) GPU-bound only by
the *smaller* of the two phases' particle counts plus our ≤256 overlay
particles. At 60fps target, the overlay's worst case is the P2→P3 transition
with 128 overlay + ambient code-rain canvas still alive ≈ 4128 fills/frame.
Well within budget.

## 4. Timing Budget

| transition | total | overlay frames @60fps | hold tail |
|---|---|---|---|
| P0 → P1 | 600ms | 36 | 120ms canvas fade-out |
| P1 → P2 | 900ms | 54 | 100ms canvas fade-out |
| P2 → P3 | 1200ms | 72 | 120ms canvas fade-out |
| P3 → inRYOKU | 1800ms | 108 | 80ms then navigate |

All transitions target the 1.5–2.5s perceptual budget (the spec's principle
that a transition should feel like a breath, not a beat).

Reduce-motion: each transition collapses to a 200ms alpha cut and still
publishes the handoff bus (so subscribers/analytics fire).

## 5. Audio Crossfade

The bus carries `audioState` per spec §6:

| boundary | audioState payload | technique |
|---|---|---|
| P0 → P1 | `{ lastTone: null }` | P1 modem hiss starts on transition |
| P1 → P2 | `{ lastTone: 1000 }` | P1 1kHz handshake bleeds into P2 drone fade-in, 200ms overlap |
| P2 → P3 | `{ fadeOut: ['drone'] }` | drone exponential fade-out overlaps P3 ambient bed fade-in, 400ms |
| P3 → inRYOKU | `{ fadeOut: ['ambient','drone'] }` | full ambient bed drops, brief silence before inRYOKU bed |

The phase-bus itself does not own an audio node graph — it only relays the
state. cosmos-audio (or wave-3 audio plumbing) reads the snapshot and applies
gain ramps. This keeps the bus dependency-free.

## 6. Reduce-Motion Fallback

`prefers-reduced-motion: reduce` triggers the same handoff payload but skips
the rAF animation, dispatches a 200ms `instantCutFade` overlay, and resolves
the run promise. The 6-colour unlock check in `p3-to-inryoku` still runs (it
is a logical gate, not a motion concern).

## 7. Hooks Required From P0/P1/P2/P3 Main Code (for wave 3)

The phase-bus is the integration point. Existing phase code is unmodified
in this wave. Wave 3 must patch the following minimal hooks into each phase's
main loop so it can supply live state and react to the bus:

### cosmos-effects.js (code-rain in P2)
Needs to expose:
```js
window.__inryokuP2 = window.__inryokuP2 || {};
window.__inryokuP2.sampleCodeParticles = (n) => [{x, y, z, hue}, ...];
// return n randomly-chosen current code-rain particles, screen-space positions
```

### cosmos-layer.js (yin-yang manifold + 101% sphere in P2)
Needs to expose:
```js
window.__inryokuP2.sampleManifold     = (n) => [{x, y, z, hue}, ...];
window.__inryokuP2.sampleSpherePoints = (n) => [{x, y, z}, ...];
window.__inryokuP2.dividingCurve      = () => [{x, y, z}, ...];
// dividingCurve is the yin-yang boundary line, ~64 points along it.
// After P2 exit, the curve becomes the light bridge between 2 constellations.
```

### p3 main loop (`p3_code_for_claude.js`)
Needs to expose:
```js
window.__inryokuP3 = window.__inryokuP3 || {};
window.__inryokuP3.sampleUniverse   = (n) => [{x, y, z, hue}, ...];
window.__inryokuP3.sixColorState    = () => ({r, g, b, c, m, y});  // each 0..1
window.__inryokuP3.seedFromHandoff  = (handoff) => void;
// seedFromHandoff: when P3 boots, read window.__inryokuHandoff and override
// `handoff.particles.length` of the 38000 universe particles with the snapshot
// positions + hues. Flag them as "incoming" for 1.5s of custom drift.
```

### P1 boot (`p1_code_for_claude.js`)
Needs to expose:
```js
window.__inryokuP1 = window.__inryokuP1 || {};
window.__inryokuP1.seedPreRoll      = (handoff) => void;  // 256 carriers
window.__inryokuP1.samplePreRoll    = (n) => [{x, y, hue}, ...];
```

### Audio (cosmos-audio.js)
Needs to expose:
```js
window.__inryokuAudio = {
  rampGain: (sourceId, targetDb, ms) => void,
  startSource: (sourceId, opts) => void,
};
// transition modules read window.__inryokuHandoff.audioState and call
// rampGain/startSource accordingly. cosmos-audio subscribes via
// bus.on('phase:transition:start', ...) and reads the bus.
```

None of these hooks alter existing behaviour — they only expose read/write
accessors. Wave 3 can land them incrementally; until a hook is present the
transition module synthesises plausible particles and proceeds anyway.

## 8. Reversibility

`bus.transition(toPhase, opts)` accepts any target. Back-navigation simply
calls `bus.transition(previousPhase)`, with an optional reverse transition
module if one exists. The bus does not enforce a forward-only graph.

The transition modules themselves are NOT internally reversible — they each
encode a specific morph direction. Reverse transitions (P3→P2, P2→P1, P1→P0)
should be authored as their own files when needed. For now, back-navigation
uses an instant 200ms cross-fade fallback (the bus's built-in default when
no `transitionModule` is supplied).

## 9. 60fps Verification

The critical moment is the boundary itself: outgoing phase still rendering,
incoming phase booting, plus our overlay canvas. Strategies:

- Overlay canvas is the *only* allocation per transition (no per-frame
  garbage). Particle records are pre-built before the rAF loop starts.
- We use `globalCompositeOperation = 'lighter'` only on the P2→P3 light bridge
  (single quadratic curve + 2 anchor stars), not on the bulk particle fills.
- All `ctx.fillStyle` strings are rebuilt per particle but the underlying
  rgba interp arrays are reused via `lerpRGB` returning fresh arrays —
  acceptable churn at N≤256.
- No filter/shadowBlur on hot paths.

## 10. Open Questions / Wave 3 Follow-ups

1. Should P2's `dividingCurve` be sampled live (animated) or frozen at exit
   time? Currently the spec says "becomes the light bridge" — I freeze at
   exit. Confirm with motion review.
2. The inRYOKU route — currently calls `location.assign('/inryoku')`. Should
   it be an SPA navigation event instead? Wave 3 can override via `toState.navigate`.
3. Tablet thresholds: spec §9 says ≥768 + touch. I detect via
   `innerWidth < 1024 && 'ontouchstart' in window` — adjust if needed.
