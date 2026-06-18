# P3 Integration Spec — `cosmos-integration` + `cosmos-bus`

Date: 2026-05-12
Owner: inryokü P3 integration
Entry: `cosmos-integration.js` → `bootInryokuP3({ root })`
Smoke test: `tests/integration/unified-boot.test.mjs`

This is the wiring layer that fuses the five P3 modules (effects, postfx,
audio, observation, interaction, HUD) plus the behavior engine into one
demo: `p3_unified_test.html`.

---

## 1. Boot order

```
bootInryokuP3({ root })
        │
        │  parse url + reduce-motion + tier
        ▼
    createBus  ───────────────────────────────┐
        │                                     │
        ▼                                     │
   createObservation                          │
        │                                     │
        ▼                                     │
   renderer / scene / camera (Three.js)       │
        │                                     │
        ▼                                     │
   createEffectsLayer ──── adds: nebula,      │
        │                  stars (4 layers),  │   bus connects all
        │                  8 constellations,  │   downstream modules
        │                  light bridges,     │
        │                  shooting stars,    │
        │                  logo holo sphere,  │
        │                  circulation rings, │
        │                  burst ring         │
        ▼                                     │
   createBehaviorParticles (38k Points,       │
        │  additive, SAME scene as effects)   │
        ▼                                     │
   createPostFX (Composer + Bloom + Afterimg) │
        │                                     │
        ▼                                     │
   createAudio   (silent until gesture) ──────┤
        │                                     │
        ▼                                     │
   createPercentageHud (DOM, bottom-right) ───┤
        │                                     │
        ▼                                     │
   SceneSwitcherPill (DOM, bottom-center)─────┤
   CanonDisplay      (DOM, top-left)──────────┤
        │                                     │
        ▼                                     │
   wireInteractions  (mouse/scroll/keys) ─────┤
        │                                     │
        ▼                                     │
   AudioGate overlay (click → audio.start) ──┘
        │
        ▼
   RAF tick() loop running
```

## 2. Per-frame update order

```
tick(t)
  │
  ├─ effects.update(t, ctx)
  │     • nebula.uniforms.u_time / u_mouse
  │     • star layer rotations
  │     • constellation drift
  │     • bridges.updateBridges(t)
  │     • shooters.updateShooters(t)
  │     • logoSphere uniforms.u_time / u_phase / u_pulse
  │     • rings rotation
  │     • burst (decay)
  │
  ├─ particles.update(t, ctx)
  │     for i in 0..38000:
  │       safeStep(currentId, i, count, scratchPos, scratchCol, t, ctx)
  │       (if blendT < 1, sample lastId too, mix)
  │     geo.attributes.position.needsUpdate = true
  │     geo.attributes.color.needsUpdate = true
  │
  ├─ camera orbit (sin / cos of t)
  │
  └─ post.render()
        RenderPass → UnrealBloomPass → AfterimagePass (skipped if reduce)
```

The single shared `ctx` object — `{ mouseNDC, mx, my, textPts, bridge }` —
is read by both `effects.update` (nebula u_mouse) and every behavior
`step()`. It is mutated only by the mousemove handler.

## 3. Event flow (cosmos-bus vocabulary)

```
USER click pill button
  └→ bus.emit('ui:request-behavior', { id, source:'pill' })
       └→ integration: setBehavior(id)
            └→ particles.setBehavior(id)       // start blend
            └→ bus.emit('behavior:change', { id, prev, meta, source })
                 ├→ pill.setActive(id)
                 ├→ effects.setActiveScene(meta.scene)
                 ├→ effects.fireBurst(meta.burst)
                 ├→ bus.emit('effects:burst', { color: meta.burst })
                 ├→ audio.play(meta.canon)
                 ├→ bus.emit('audio:canon', { canon, source:'behavior' })
                 │    └→ CanonDisplay flashes label
                 ├→ observation.pulse('behavior:'+id)
                 │    └→ observation.onPulse fires
                 │       └→ bus.emit('observation:pulse', { pct, source,… })
                 │          ├→ HUD tweens number + bar
                 │          ├→ audio.pulse(0.4)
                 │          └→ every 8th total → effects.fireBurst
                 └→ body.classList toggles cfx-scene-* (CSS hooks)

CONTACT CTA click
  └→ setBehavior('convergence_glyph', 'contact')
       (same flow → canon='declaration', scene='glyph')

mousemove (throttled 1Hz)
  └→ observation.pulse('hover')

window resize
  └→ renderer.setSize + camera + post.setSize + nebula aspect
  └→ bus.emit('scene:resize', { w, h })

reduce-motion path  (?reduce=1 or media query)
  └→ bus.emit('scene:reduce-motion', { reduce:true })
     • audio.forceSilent = true (silent stub)
     • effects shooters skipped, burst flash-only (no expand)
     • post afterimage pass omitted
     • 12s auto-cycle disabled
     • behavior engine resolves to 'idle_static'
```

### Standard event vocabulary

| Event                  | Payload                                     | Emitted by             |
|------------------------|---------------------------------------------|------------------------|
| `behavior:change`      | `{ id, prev, meta, source }`                | `setBehavior()`        |
| `observation:pulse`    | `{ pct, source, total, wrapped, t }`        | `observation.onPulse`  |
| `audio:canon`          | `{ canon, source }`                         | bus glue after `audio.play` |
| `effects:burst`        | `{ color }`                                 | bus glue after `effects.fireBurst` |
| `scene:reduce-motion`  | `{ reduce }`                                | boot-time              |
| `scene:resize`         | `{ w, h }`                                  | window resize          |
| `audio:ready`          | `{ started }`                               | AudioGate.start()      |
| `ui:request-behavior`  | `{ id, source }`                            | scene pill click       |

## 4. Dispose order

```
dispose()
  ├─ disposed = true (loop guard)
  ├─ cancelAnimationFrame(rafId)
  ├─ clearInterval(cycleTimer)
  ├─ remove window listeners (mousemove, resize, interact tracker)
  ├─ interactions.dispose()  → removes mouse/scroll/key listeners
  ├─ gate.dispose()          → removes overlay
  ├─ hud.dispose()           → unsub observation, remove DOM
  ├─ pill.dispose()
  ├─ canonDisplay.dispose()
  ├─ particles.dispose()     → remove Points, dispose geom/mat
  ├─ effects.dispose()       → traverse + dispose every layer
  ├─ post.dispose()          → composer + passes
  ├─ audio.dispose()         → ctx.close() + disconnect graph
  ├─ renderer.dispose()
  ├─ canvas.remove()
  └─ bus.clear()
```

## 5. API mismatches reconciled (kept modules untouched)

| Mismatch                                                                                | Fix (in integration / bus)                                                                                                            |
|-----------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| Effects scene names are short strings (`'breathing'`, `'hover'`, …), behavior ids are full snake_case (`'breathing_sphere'`). | `BEHAVIOR_META` map in cosmos-integration translates behavior id → `{ scene, burst, canon }`. Single source of truth.                |
| `observation.onPulse` fires for every pulse incl. mousemove → too many canon plays.    | Glue listens to `onPulse` and only fires `audio.pulse(0.4)` (soft) + every-8th burst. Heavy canons fire only on `behavior:change`. |
| `cosmos-interaction` calls `audio.play('declaration')` on click — would override behavior canon. | Acceptable: layered. Behavior canon is the loud event; click adds a declarative pulse. Both go through bus only if `audio.isStarted()`. |
| Audio requires user gesture; modules don't agree on who starts it.                      | `AudioGate` overlay owns first gesture, calls `audio.start()`, then emits `audio:ready`.                                              |
| `effects.update` reads `ctx.mouseNDC`; behaviors read `ctx.mx/my`. Different scales.    | Both populated by the single mousemove handler in integration.                                                                        |
| `cosmos-layer.js` has its own `setBehavior` polling loader. Could race with bus.        | Integration owns truth via `particles.getBehavior()`; cosmos-layer's `window.__inryokuBehavior` global is read-only side-effect.       |
| Reduce-motion lives in three places (effects, postfx, audio, behaviors).               | Single `reduceMotion` boolean derived in integration, threaded to all `create*` calls + `?reduce=1` URL override.                    |

## 6. Smoke verification

```bash
npm test -- --test-name-pattern=integration
# or just the integration file:
node --test tests/integration/unified-boot.test.mjs
```

Open the page locally:

```bash
node server.js
# then visit http://localhost:3000/p3_unified_test.html
# overrides:
#   ?behavior=ring_resonance
#   ?reduce=1
```
