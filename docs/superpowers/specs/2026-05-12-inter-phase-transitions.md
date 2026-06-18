# Inter-Phase Transitions — Particle Metamorphosis Across P0 → P1 → P2 → P3
**date:** 2026-05-12
**status:** design / awaiting review
**scope:** the *seams* between phases — what happens in the 1.2–2.0 seconds where one phase ends and the next begins

---

## 0. The Principle

**No hard cuts.** Every phase boundary is a particle-level metamorphosis. The same atoms (literally: an array of `{x, y, hue}` tuples) survive across each boundary, re-skinning themselves into the next phase's vocabulary.

If P0 is a Mac dialog, P1 is a Win95 boot, P2 is a quantum code world, and P3 is the universe — then the user's eye should never see a "loading…" gap. They should see *the same particles* transform their meaning.

## 1. Why This Matters

The user's brief: "each transition should be a particle-level metamorphosis, not a hard cut." This is not just aesthetics. It's the philosophy made temporal:

- **P0** = the dialog (a question)
- **P1** = booting consciousness (the question is loading the questioner)
- **P2** = the substrate of code (the questioner sees the world is made of bits)
- **P3** = the universe (the bits become galaxies)

Each boundary is the *same observer realising the next layer*. If we hard-cut, we destroy the realisation. If we metamorphose, we *enact* it.

## 2. Approaches Considered

### Option A — **Shared `__inryokuHandoff` bus** (chosen)
A single `window.__inryokuHandoff` object carries a particle snapshot + timing data across each boundary. Each phase reads it, seeds 64–128 anchor particles at the snapshot positions, fades them from incoming colour to native, then deletes the snapshot.

**Pros:** simple, observable, debuggable. Each phase is self-contained; the boundary logic is symmetric (write at end, read at start).
**Cons:** only one direction (no rewind). Snapshots are coarse — does not preserve velocity, just position+colour.

### Option B — **DOM/Canvas overlap (cross-dissolve)**
Both phases render simultaneously for 400ms with alpha cross-fade. No shared state.

**Pros:** dead simple.
**Cons:** doubles GPU during transition. Particles don't *transform*; they fade. Misses the brief.

### Option C — **Single global particle pool across all phases**
One canonical particle system runs from P0 to P3; each phase configures it.

**Pros:** maximally elegant.
**Cons:** requires rewriting P0/P1/P2 internals. Violates the "additive only" rule. Massive risk.

**Decision: Option A.** Shared bus is minimal change, fully additive, gives the visual effect we want.

## 3. The State Machine

```
        ┌──────────────────────────────────────────────────────────┐
        │                  __inryokuHandoff bus                    │
        │  {fromPhase, toPhase, particles[], timing, audioState}   │
        └──────────────────────────────────────────────────────────┘
                              ▲           ▲           ▲
                              │ write     │ write     │ write
              ┌───────┐  P0→1 │  ┌───────┐│ P1→2 ┌───────┐│ P2→3 ┌───────┐
              │  P0   ├──────►│  │  P1   ├──────►│  P2   ├──────►│  P3   │
              └───────┘   600ms  └───────┘  900ms └───────┘  1200ms └───────┘
                              │           │           │
                              ▼ read      ▼ read      ▼ read
```

Each phase is in one of three modes:
- `entering` — first 0.8–1.5s, reads handoff bus, seeds anchor particles
- `native` — phase's normal behaviour
- `exiting` — last 0.3–0.8s, snapshots particles, writes bus, dispatches complete event

## 4. Per-Boundary Specifications

### 4.1 P0 → P1 (Mac dialog → Win95 boot)

**Duration**: 600ms (compressed because P0 has no particle system).

**P0 exit**:
- The dialog window scales down to a single bright `#fff` pixel at the centre of the screen over 300ms.
- The pixel emits a radial burst of 256 grey particles in random directions at low velocity over 200ms.
- Write to bus:
  ```js
  window.__inryokuHandoff = {
    fromPhase: 'P0',
    toPhase: 'P1',
    particles: [256 particles { x, y, hue: 'grey' }],
    bornAt: performance.now(),
    audioState: { lastTone: null },
  };
  ```
- Dispatch `inryoku:p0complete` (existing event).

**P1 entry** (during pre-roll, see `2026-05-12-p1-upgrade-design.md` §8):
- Read `__inryokuHandoff`. The 256 particles seed the pre-roll cloud's centre cluster.
- These 256 are flagged as "carriers" — they get slightly higher alpha (0.9 vs default 0.7) and slightly larger size for the first 800ms, so the eye locks onto them.
- After 800ms they become indistinguishable from the rest of the pre-roll cloud.
- `delete window.__inryokuHandoff` once consumed.

### 4.2 P1 → P2 (Win95 boot → quantum code world)

**Duration**: 900ms.

**P1 exit** (at `EVENT_COLLAPSE` in the 9-state engine):
- Whiteout flash (existing behaviour, untouched).
- *During* the whiteout: sample 64 particles from P1's pre-roll cloud at their final post-collapse positions. Snapshot their hue.
- Write to bus:
  ```js
  window.__inryokuHandoff = {
    fromPhase: 'P1',
    toPhase: 'P2',
    particles: [64 particles { x, y, z: 0, hue: rgb }],
    bornAt: performance.now(),
    cameraHint: { z: 8, fov: 60 },     // matches P2 initial
    audioState: { lastTone: 1000 },    // hand off the 1kHz handshake
  };
  ```
- Dispatch `inryoku:p1complete` (existing event).

**P2 entry**:
- P2 starts its 4000 code-rain particles as usual.
- Read `__inryokuHandoff`. For 64 of those particles (chosen at random), override their initial position with the snapshot positions (scaled to P2's world coordinates: P1 was screen-space, P2 is world-space, so we map `(screen.x - W/2) * 0.02` → world units).
- These 64 particles' colour eases from P1 hue → P2 native green over 1.2s using a colour-channel linear interpolation.
- The audio handshake tone (1kHz from P1) bleeds 200ms into P2's drone (180Hz fade-in starts at -200ms relative to P2 start, creating overlap).
- `delete window.__inryokuHandoff` once consumed.

### 4.3 P2 → P3 (quantum code world → universe)

**Duration**: 1200ms (the biggest jump, deserves the biggest transition).

**P2 exit**:
- The 4000 code particles begin a *radial outflow* — each particle accelerates away from the camera origin over 600ms. This visually feels like "falling into the universe through the code".
- The 12000 yin-yang manifold particles disperse: each one launches off the sphere along its base normal × 4.0 units over 600ms, alpha fading to 0.
- Sample 128 particles (mixed: 64 code, 64 manifold) at their mid-flight positions. Snapshot.
- Write to bus:
  ```js
  window.__inryokuHandoff = {
    fromPhase: 'P2',
    toPhase: 'P3',
    particles: [128 particles { x, y, z, hue }],
    bornAt: performance.now(),
    cameraHint: { z: 72, fov: 50 },    // matches P3 initial
    audioState: { fadeOut: ['drone'] },
  };
  ```
- Dispatch `inryoku:p2complete` (existing event).

**P3 entry**:
- P3's 38000-particle universe initialises as usual.
- Read `__inryokuHandoff`. 128 of P3's particles are seeded at the snapshot positions (already in world-space from P2).
- These 128 are temporarily flagged "incoming" — they bypass the normal behaviour function for the first 1.5s, instead drifting on a custom path from snapshot position → their behavior-assigned position, easing over 1.5s with `cubicBezier(0.2, 0.7, 0.2, 1)`.
- Their colour eases from P2 hue → P3 hue over 1.5s.
- After 1.5s they rejoin the normal behavior system.
- The yin-yang and 101% spheres of P2 do NOT carry over — only particles do. P3 has its own constellations.
- `delete window.__inryokuHandoff` once consumed.

### 4.4 P3 → ? (the last boundary)

Reserved for future. Currently P3 is terminal. If/when an inRYOKU sub-route opens (per `project_inryoku.md`), the boundary would be a *6-colour-merge* event — the 6 RGBCMY pulses of P3 converge at the centre of the universe, collapse into a single point of "white" (which is actually a perceptual illusion since pure white is forbidden), and that point becomes the inRYOKU entry. Out of scope for this spec.

## 5. The Bus Schema

```typescript
interface InryokuHandoff {
  fromPhase: 'P0' | 'P1' | 'P2' | 'P3';
  toPhase:   'P1' | 'P2' | 'P3' | 'inRYOKU';
  particles: Array<{
    x: number;          // world or screen units (phase-dependent)
    y: number;
    z?: number;         // optional; P0/P1 are 2D
    hue: [number, number, number];  // 0..1 RGB
    size?: number;      // optional
  }>;
  bornAt: number;       // performance.now() when written
  cameraHint?: { z: number, fov: number };
  audioState?: {
    lastTone?: number;        // Hz
    fadeOut?: string[];       // sources to fade out
    fadeIn?: string[];
  };
}
```

The bus lives at `window.__inryokuHandoff`. There can only be one at a time. Write timestamps are validated: if a phase reads a bus that is older than 3 seconds, it ignores it (assumes stale).

## 6. Audio Across Transitions

Each transition has an audio overlap region:

| boundary | overlap | technique |
|---|---|---|
| P0→P1 | none (P0 is silent) | P1 modem hiss begins on transition |
| P1→P2 | 200ms | P1 1kHz handshake bleeds into P2 drone fade-in |
| P2→P3 | 400ms | P2 drone exponential fade-out overlaps P3 ambient bed fade-in |

Audio is never abruptly cut. The `audioState` in the bus lets the next phase know what to fade out smoothly.

## 7. Timing

```
total user-perceived time from P0 close to P3 native:
  P0 exit:     600ms
  P1 entering: 1500ms (pre-roll + first state)
  P1 native:   ~7000ms (the 9-state engine, user-paced via ENTER on Win95 shell)
  P1 exit:     400ms (whiteout)
  P2 entering: 1200ms
  P2 native:   user-paced (could be infinite if observing 101%)
  P2 exit:     600ms
  P3 entering: 1500ms
  P3 native:   forever
```

Each "entering" duration is the time before the phase fully owns the screen. After that, the phase is responsible for its own pacing.

## 8. Reduce-Motion Behaviour

- All particle metamorphoses are skipped.
- Transitions become 200ms alpha cross-fades.
- The bus is still written/read (for analytics/debug) but `particles` is empty.
- Audio overlaps still happen (they're not motion).

## 9. Mobile Behaviour

Mobile skips P0/P1/P2 entirely (per `p1_index_for_claude.html` line 67). The bus is never written. P3 starts cold.

For tablet/iPad-class (≥768 + touch), the full sequence runs with reduced particle counts:
- P0→P1: 128 carrier particles instead of 256
- P1→P2: 32 instead of 64
- P2→P3: 64 instead of 128

## 10. Accessibility

- Each `inryoku:Pncomplete` event is paired with an `aria-live="polite"` announcement: "phase transition complete".
- Screen-reader users get the same temporal pacing (the transitions don't accelerate for them).
- Keyboard alternative: any phase can be force-completed by pressing `Esc`+`>`, useful for testing.

## 11. Test Plan

```
tests/transitions/
  bus-schema.spec.js          # write/read invariants, stale rejection
  p0-p1.spec.js               # 256 particles delivered, consumed
  p1-p2.spec.js               # 64 particles, audio handshake overlap
  p2-p3.spec.js               # 128 particles, both code+manifold sources
  reduce-motion.spec.js       # bus empty in reduce-motion
  timing.spec.js              # overlap durations within ±50ms tolerance
```

Visual: 3 GIF/video captures, one per boundary, each 2 seconds, confirming the particle continuity by eye.

## 12. Acceptance Criteria

- [ ] Bus schema validated at runtime (lint warns on missing required keys)
- [ ] P0→P1: 256 carrier particles visible for first 800ms of P1 pre-roll
- [ ] P1→P2: 64 anchor particles visible for first 1.2s of P2, colour-easing from P1 to P2 hue
- [ ] P2→P3: 128 anchor particles visible for first 1.5s of P3, drifting from snapshot to behavior position
- [ ] No hard cuts visible — verified by side-by-side video review
- [ ] Audio overlaps within ±50ms of spec
- [ ] Bus always consumed (no leak: `__inryokuHandoff === undefined` after each read)
- [ ] Existing `inryoku:pNcomplete` events still fire identically

## 13. Rollback

Each phase's "entering" code checks `if (!window.__inryokuHandoff || handoff.particles.length === 0)` and falls back to its native start behaviour. So if any one boundary fails, the next phase still works — just with a hard cut. Graceful degradation by design.

## 14. Open Questions

1. The `audioState.lastTone` mechanism — does P2's drone need to harmonically lock to the P1 handshake frequency (1kHz)? Currently spec says no (P2 drone is 110Hz A2), so the overlap is just two sources playing. Could be richer.
2. Should the inRYOKU sub-route boundary be specced here, or wait until inRYOKU itself is designed? (Current: wait.)
3. Bus persistence across page reloads — currently no. Could `sessionStorage` the most recent bus for debugging? Low value, skipping.
