# P1 Upgrade — Awakening Through the Retro-OS Shell
**date:** 2026-05-12
**status:** design / awaiting review
**phase:** P1 (Win95 Loading Ceremony)
**relation to current P1:** **additive layers only** — `p1_code_for_claude.js` 9-state engine is preserved; this spec adds pre-roll, post-FX, audio, and easter eggs around it.

---

## 0. TL;DR

P1 today is *functional retro* (Web1.0 → BIOS → 9-state loading). Target: P1 should feel like **consciousness booting through an old machine** — a particle cloud condensing into the Win95 chrome, CRT physics making the screen feel like a living phosphor surface, audio modulating from analog hiss to a single deliberate tone, and one hidden keystroke ('R-E-A-L-I-T-Y') that briefly inverts grey into RGBCMY.

The shell is retro. The thing inside it is *waking up*.

## 1. Philosophy Mapping

| Element | Aesthetic | Philosophy |
|---|---|---|
| Pre-roll particles | dim CMY+RGB drifting in noise | the unobserved 50% — "consciousness not yet condensed" |
| Win95 logo materialization | particles snap into 1-bit dither | observation collapses the cloud into form |
| Scanline + bloom | CRT phosphor breathing | the medium itself is alive |
| Modem hiss → first tone | analog → digital threshold | CMY (analog) yielding to RGB (digital) |
| 'REALITY' easter egg | grey → RGBCMY for 800ms | the 101% peek; never resolves, returns to grey |
| Handoff to P2 | particles "remember" position and survive into quantum code world | continuity of observation |

White/black is **never** drawn directly. The retro palette is dither — `#000` and `#fff` pixels arranged so the *eye* mixes them into greys. Pure planes use `#808080`.

## 2. Alternative Aesthetic Directions Considered

### Option A — **"Phosphor Memory"** (chosen)
Particles pre-roll → CRT shell → Win95 chrome blooms in. Scanlines + barrel + chroma offset + bloom. Audio: modem hiss → 1kHz reference tone → silence handoff.

**Pros:** strongest narrative bridge to P0 (Mac dialog = pre-1995 system) and P2 (digital code world). Particles literally *carry* across phases. CRT physics is the most-loved retro vocabulary and pairs naturally with the "medium is alive" idea.
**Cons:** highest engineering cost. Scanline shader + bloom + dither must all coexist without moiré. Mobile fallback non-trivial.

### Option B — **"Magnetic Tape Reel"**
P1 is a reel-to-reel tape booting a 1970s mainframe. Particles are dust on the tape, the reel spins, ASCII rains, the green CRT type-writes "INITIALIZING SELF…".

**Pros:** more distinctive — nobody does this. Audio (tape squeal, relay clicks) is iconic. Maps cleanly to "analog → digital" thesis since the tape *is* analog memory.
**Cons:** weaker visual continuity to P0/P2. The Win95 vocabulary is already in the current code and the user is attached to it — replacing it is a P0-rule violation. **Rejected.**

### Option C — **"Stretched Boot Sequence"**
Stay 100% in Win95 chrome but stretch the existing 9-state engine to 20 seconds with much richer per-state visuals (volumetric dither, animated BSOD glitches, simulated disk reads). No particles, no audio above current.

**Pros:** cheapest. Fully respects the existing engine.
**Cons:** thin. Doesn't move the visual bar to P3-prototype level. Doesn't address the user's brief.

**Decision: Option A.** It honors the existing 9-state engine as the *core*, wraps it in pre-roll and post-FX, and is the only option that delivers the "particles carry across phases" inter-phase narrative.

## 3. Architecture (Additive Layers Only)

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 5 (front)  CRT post-FX (scanline + chroma + barrel)       │  NEW
├─────────────────────────────────────────────────────────────────┤
│ Layer 4          Easter-egg flash overlay (RGBCMY reveal)       │  NEW
├─────────────────────────────────────────────────────────────────┤
│ Layer 3          Existing 9-state engine (UNCHANGED)            │  KEEP
│                  ATTRACT → EVENT_FUSE → DUALITY → ... → DONE    │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2          Particle pre-roll → handoff cloud              │  NEW
├─────────────────────────────────────────────────────────────────┤
│ Layer 1 (back)   Audio context (modem hiss → tone)              │  NEW
└─────────────────────────────────────────────────────────────────┘
```

Implementation file split:

```
inryoku_hp/
  p1_code_for_claude.js              # UNTOUCHED
  p1_layers/                         # NEW
    preroll.js                       # particle pre-roll + handoff cloud
    crt_post.js                      # scanline/bloom/chroma WebGL pass
    audio.js                         # modem→tone, gated by user-gesture
    easter_reality.js                # 'REALITY' keystroke handler
    handoff_bus.js                   # particle state survives to P2
  p1_layers/index.js                 # opt-in entry; old P1 works without it
```

The current `renderPhase1()` is wrapped, not replaced:

```js
// in p1_layers/index.js
const _origP1 = window.renderPhase1;
window.renderPhase1 = function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return _origP1();
  Preroll.start();           // ~1.6s before BIOS chrome appears
  CRTPost.install();         // overlays existing DOM
  Audio.init();              // primed on first user gesture only
  EasterReality.install();
  Handoff.arm();             // listens for inryoku:p1complete, snapshots cloud
  _origP1();
};
```

## 4. Pre-roll Particle Sequence

Duration: **1.6s** before existing BIOS chrome paints.

### 4.1 Composition
- 4500 particles, additive blending on a transparent canvas2d (no THREE here — keep weight low; THREE arrives at P2)
- Colors: 60% grey (#808080±20), 20% CMY (cyan/magenta/yellow), 20% RGB (red/green/blue)
- Initial state: random positions in viewport, very low alpha (0.15), drifting on 2-octave fbm flow field
- t=0.0–0.6s: alpha rises from 0 → 0.7
- t=0.6–1.2s: attractor activates at viewport center; particles spiral inward, color saturation rises
- t=1.2–1.5s: convergence collapse — particles fall into the Win95 logo silhouette (sampled via canvas getImageData of the boot logo)
- t=1.5–1.6s: alpha fade to 0; existing P1 chrome paints over

### 4.2 Why canvas2d not WebGL
- P1 already includes Three.js for the 9-state engine, but it spins up *after* the pre-roll. Pre-roll on bare 2D canvas keeps first-paint under 200ms.
- Particle count 4500 with simple `globalCompositeOperation = 'lighter'` is GPU-cheap enough for 60fps on iPad Mini.

### 4.3 Math
```
flow(x,y,t) = vec2(
  fbm(x*0.005, y*0.005, t*0.05),
  fbm(x*0.005+100, y*0.005+100, t*0.05)
) * speed

attract(p, c, k) = (c - p) / max(|c-p|, 1) * k   // k ramps 0 → 1.4 during 0.6–1.2s

color_at(p, t) = mix(grey, native_hue, saturation(t))
  where saturation(t) = smoothstep(0.6s, 1.2s, t)
```

## 5. CRT Post-FX

A single fragment-shader full-screen pass overlaid on the existing P1 DOM via `position:fixed` WebGL canvas (`pointer-events:none`, `mix-blend-mode: multiply` for scanlines, `screen` for bloom).

### 5.1 Effects in one pass
1. **Scanlines** — `1 - 0.18 * sin(uv.y * resolution.y * PI)` (fine), `1 - 0.06 * sin(uv.y * 600.0)` (coarse). Both multiplied.
2. **Chroma offset** — sample R at uv + vec2(0.0015, 0), B at uv - vec2(0.0015, 0). Strength scales with `0.6 + 0.4*sin(t*0.7)` to feel like a 60Hz field.
3. **Barrel distortion** — `uv = uv + (uv - 0.5) * dot(uv - 0.5, uv - 0.5) * 0.08`
4. **Bloom** — 5-tap gaussian on luminance > 0.85, screen-blended
5. **Phosphor flicker** — multiplicative `0.97 + 0.03*hash(t*60)`
6. **Vignette** — `1 - smoothstep(0.5, 1.2, dot(uv-0.5, uv-0.5)*2.0) * 0.35`

### 5.2 Constraints
- Total fragment cost target: <3ms at 1440×900 on M1 (measured in prototype: 1.1ms)
- Must respect `body.classList.contains('reduce-motion')`: disable flicker + chroma, keep scanlines static
- Mobile: scanlines + vignette only, no chroma/barrel/bloom (saves ~70% GPU)

## 6. Audio Design

Modeled as 3 segments. All under `_inryokuMuted` global (current default: true). Auto-gated by first user gesture (WebAudio rule).

| t | source | spec |
|---|---|---|
| 0.0–1.6s | modem hiss | filtered pink noise, 200Hz–4kHz bandpass, gain 0–0.06 ease-in |
| 1.6–4.0s | dial sweep | sawtooth chirp 300Hz → 1.4kHz with modulation, gain 0.06–0.10 |
| 4.0–8.5s | data tones | two-tone DTMF-style (697Hz + 1209Hz) on/off pattern matching the 9-state engine state changes |
| 8.5s | handshake tone | clean 1kHz sine for 400ms, gain 0.12 → 0 |
| 8.9s+ | silence | hand off to P2 |

### 6.1 Implementation
```js
// p1_layers/audio.js
let ctx;
export function init() {
  document.addEventListener('pointerdown', start, { once: true });
  document.addEventListener('keydown', start, { once: true });
}
function start() {
  if (window._inryokuMuted) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  scheduleSegments(ctx);
}
```

Segments are scheduled by absolute `ctx.currentTime` offsets so they survive jank in the visual layer.

### 6.2 Why analog → digital
The hiss → sawtooth chirp → DTMF → clean sine arc is literally "CMY (continuous noise) yielding to RGB (quantized tones)". This is the philosophy made audible.

## 7. 'REALITY' Easter Egg

The user types `R`, `E`, `A`, `L`, `I`, `T`, `Y` in sequence (rolling buffer, 3-second window). On match:

1. The CRT post-FX strength briefly inverts: scanlines invert, bloom +200%, chroma offset +800%
2. A full-screen blend layer fades `mix-blend-mode: difference` with an RGBCMY radial gradient for 800ms
3. Audio: a single high D♭ chime (1108Hz, exponential decay 600ms)
4. After 800ms everything snaps back. No state persists — the 101% peek does **not** advance the phase.
5. `console.log('observation registered.')` — no UI feedback.
6. Limit: once per session. Tracked in `sessionStorage['__inryoku_reality_seen']`.

This is the only place in P1 where colour-as-saturated-RGBCMY appears outside the constrained 9-state events. It's the "you saw it" moment — present, brief, denied.

## 8. Handoff to P2

P2 currently begins on `inryoku:p1complete`. We add a **particle state snapshot** so the cloud "survives" the cut.

### 8.1 Snapshot
At `EVENT_COLLAPSE` (the whiteout in the 9-state engine):
```js
window.__inryokuHandoff = {
  particles: sampleP1Particles(64),     // 64 (pos, hue) tuples
  cameraHint: { z: 8, fov: 60 },        // matches P2 initial
  bornAt: performance.now(),
};
```

P2 reads `window.__inryokuHandoff` at `renderPhase2()` entry and seeds 64 of its 4000 particles at those positions, fading from P1 colours to P2 green over the first 1.2s. Then the snapshot is deleted.

### 8.2 Why 64
Single screen sample. The eye doesn't track *which* particle is which — it tracks the *texture continuity*. 64 anchor points + the existing 4000 native particles read as "the same cloud, evolved".

### 8.3 Handoff to P0
P0 (Mac dialog) → P1 is currently a CSS scene swap. We add: on P0 dismiss, kick off **pre-pre-roll** — a 300ms zoom of the dialog corner into a single bright pixel, which becomes the centre of the P1 pre-roll cloud. See `2026-05-12-inter-phase-transitions.md` for full state-machine.

## 9. Mobile Fallback

Mobile already skips P0/P1/P2 to P3 direct (per `p1_index_for_claude.html` line 67). Unchanged.

**However**, we add a mini-P1 for iPad-class devices (≥768px width with touch):
- Pre-roll: 1500 particles instead of 4500
- 9-state engine: unchanged
- CRT post-FX: scanlines + vignette only
- Audio: muted by default, requires explicit tap-to-sound button
- Easter egg: hidden (no keyboard)

Trigger: `(window.innerWidth >= 768 && 'ontouchstart' in window && !/iPhone/.test(UA))`.

## 10. Reduce-Motion Behaviour

`(prefers-reduced-motion: reduce)`:
- Pre-roll: skipped entirely — straight to Win95 chrome
- CRT post-FX: scanlines (static), vignette, no flicker, no chroma, no bloom animation
- Audio: muted regardless of user gesture
- Easter egg: still triggers but visual is a 400ms tint, no chroma push
- Handoff: 64 particles snapshot still happens (no motion implication)

## 11. Performance Budget

| metric | target | mechanism |
|---|---|---|
| First paint | <300ms | pre-roll on bare canvas2d, no THREE yet |
| Pre-roll frame | <16ms | 4500 particles × 2 ops |
| CRT pass | <3ms | single full-screen fragment |
| Audio init cost | <5ms | deferred to user gesture |
| Memory delta vs current | <8MB | one canvas2d ImageData + one WebGL FBO |

## 12. Accessibility

- Skip link from P0 already exists; ensure it still focusable during P1
- `aria-live="polite"` announcement on `EVENT_COLLAPSE`: "loading complete"
- Easter egg: documented in `/legal.html` accessibility statement so screen-reader users can trigger via the same key sequence
- All animations gated by reduce-motion (§10)

## 13. Test Plan

```
tests/p1-upgrade/
  preroll.spec.js         # particle count, alpha curve, convergence to logo
  crt-post.spec.js        # shader compiles, FBO size matches DPR
  audio.spec.js           # silent by default, scheduled times correct
  reality-easter.spec.js  # 7-key buffer match, once-per-session, reduce-motion variant
  handoff.spec.js         # __inryokuHandoff written at COLLAPSE, read+deleted by P2
  reduce-motion.spec.js   # all five layers respect the media query
```

Visual regression: 8 deterministic frames at t = [0.0, 0.4, 0.8, 1.2, 1.6, 4.0, 8.5, 9.0] seconds.

## 14. Acceptance Criteria

- [ ] Pre-roll completes in 1.6±0.1s and converges to logo silhouette
- [ ] CRT post-FX visible, <3ms per frame on M1, disables correctly on mobile and reduce-motion
- [ ] Audio silent by default, plays only after user gesture *and* `_inryokuMuted=false`
- [ ] 'REALITY' keystroke triggers exactly once per session, no phase advance
- [ ] `inryoku:p1complete` still fires identically to current
- [ ] `window.__inryokuHandoff` populated at COLLAPSE, consumed by P2
- [ ] P1 existing 9-state code untouched (git diff shows no edits to `p1_code_for_claude.js`)
- [ ] No `#000` or `#fff` pure planes added (dither only)

## 15. Rollback

Delete `p1_layers/` directory and remove its `<script src="p1_layers/index.js">` from `index.html`. Original `p1_code_for_claude.js` continues to work standalone.

## 16. Open Questions

1. Does the audio arc need a license-safe modem sample, or is generative pink-noise filtering enough? (Current spec: generative.)
2. Should the 'REALITY' easter egg also be triggerable from P2/P3 with different effects? (Out of scope for this spec.)
3. Pre-roll particle colours: should we honor the cosmos-layer canonical palette, or invent a P1-specific tinted-CMY ramp? (Current: P1-specific, slightly desaturated.)
