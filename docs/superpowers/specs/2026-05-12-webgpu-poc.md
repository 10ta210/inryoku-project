# WebGPU Compute Particle PoC — P3 acceleration

> Status: **PoC complete, not landed.** Behind `?webgpu=1` ergonomics not yet
> wired into the main shell. Standalone page is `p3_webgpu_poc.html`. This doc
> records architecture, porting plan, fallback strategy, and the conditions
> under which we'd promote the PoC to default.

---

## 1. Architecture comparison

### Current CPU path (P3 production, `cosmos-layer.js`)

```
RAF tick:
  for i in 0..38000:
    behavior.step(i, count, target, color, time, ctx)
    positions[i*3..] = target.{x,y,z}
    colors[i*3..]    = color.{r,g,b}
  geometry.attributes.position.needsUpdate = true
  geometry.attributes.color.needsUpdate    = true
  renderer.render(scene, camera)
```

Per frame at 38k particles:
- **~38,000 JS function calls** (one `step()` per particle)
- **~228,000 typed-array writes** (3 floats × pos + 3 × col)
- **2 GPU buffer uploads** (`bufferSubData` on the position + color VBOs)
- 1 draw call for `THREE.Points`

Mobile profiling (iPhone 12 mini, baseline): ~16–18ms per frame, of which
~9ms is the behavior loop and ~3ms is the upload. Older Android Chromebooks
fall to ~26ms = 38fps.

### New WebGPU compute path (this PoC)

```
RAF tick:
  queue.writeBuffer(uniforms, {time, count, behaviorId, mouseX, mouseY})
  computePass.setBindGroup(0, useAB ? AB : BA)
  computePass.dispatchWorkgroups(ceil(count / 64))
  renderPass.setBindGroup(0, viewBG)
  renderPass.draw(count)         // point-list, vertex shader reads pos/col storage
  flip useAB
```

Per frame at 500k particles:
- **1 JS uniform write** (8 floats)
- **0 JS-side per-particle work**
- 1 dispatch (≈7,813 workgroups × 64 threads)
- 1 draw call

Each behavior is **stateless and deterministic** in `(i, count, time)`. No
position read-back from GPU to JS. Double-buffer is reserved for the next step
(velocity-integrating behaviors); the three behaviors ported here don't use
the read buffer, but the layout is in place so adding stateful behaviors is
non-breaking.

## 2. Bottleneck analysis (why 38k hurts)

| Source | Per-frame cost at 38k | Per-frame cost at 500k WebGPU |
|---|---|---|
| `step()` JS calls | ~5–9 ms | 0 |
| TypedArray writes | ~1–2 ms | 0 |
| GPU buffer upload | ~2–3 ms (228kB up) | ~32 B (uniforms) |
| Draw | ~1 ms | ~0.5–1 ms |
| **Total per frame** | **~9–15 ms** | **~1–2 ms (compute) + ~0.5–1 ms (raster)** |

The JS hot loop is the dominant cost on mobile, not raster. WebGPU compute
eliminates it entirely. Raster cost grows linearly with particle count, so
500k vs 38k is a ~13× increase in raster but stays under M1's headroom (one
draw of a point list with simple FS is fillrate-bound, not draw-bound).

## 3. WGSL behavior porting plan

| Behavior | Status | Notes |
|---|---|---|
| `breathing_sphere` | ✅ ported (`step_breathing`) | Pure math. Golden-angle sphere + radial breath. 1:1 with CPU step. |
| `ring_resonance` | ✅ ported (`step_ring`) | Pure math, `i%12` bucket. WGSL `i32` modulo is fine. |
| `torus_knot` | ✅ written from scratch | New behavior. (p,q)=(2,3) knot with golden-spread thickness jitter. Not in CPU set yet — would need a CPU twin for parity if we promote. |
| `attractor_hover` | 🟡 straightforward | Pure math + mouse uniforms (already wired). |
| `light_bridge_accent` | 🟡 straightforward | Pure math; two-point spline. |
| `convergence_glyph` | 🔴 **tricky** | Reads `ctx.glyphTexture` to sample target positions. Needs a `texture_2d<f32>` binding + `textureLoad`. Flag for follow-up — port once we standardise the glyph texture format. |
| `idle_static` | ✅ trivial | Zero-motion fallback. |

Trickiness rule: anything that pulls from `ctx.*` (glyph atlas, audio buffer,
canon meta tables) needs an explicit GPU resource. The current `step(i, count,
target, color, time, ctx)` signature is JS-flexible; WGSL forces us to declare
every input. This is a **feature** for clarity but adds work per behavior.

## 4. Browser compatibility (as of 2026-05)

| Browser | Desktop | Mobile |
|---|---|---|
| Chrome 113+ | ✅ stable | ✅ Android 121+ stable |
| Edge 113+ | ✅ stable | ✅ |
| Safari 26 / macOS 15+ | ✅ stable | 🟡 iOS 17.4 partial, iOS 18+ stable |
| Firefox | 🟡 Nightly only (flag) | ❌ |
| Older WebView | ❌ | ❌ |

Estimated global support today: ~78% (caniuse). The tipping point we're
waiting for is Firefox stable + iOS 18 majority, projected late 2026.

## 5. Fallback strategy

Three layers, in order:

1. **Feature detect** — `initWebGPU()` returns `{supported:false, reason}`. If
   false → render CPU `p3_unified_test.html` instead. No crash, clear message.
2. **Tier gate** — even if WebGPU is reported, if `cosmos-perf.js` tier is
   `low` (small battery, throttled, low-end GPU), force CPU. WebGPU on a weak
   integrated GPU can be **slower** than tuned WebGL2.
3. **Lost device** — `device.lost` resolves → swap to CPU and show a soft
   notice. Treated as a runtime fallback, not a fatal error.

Selection precedence:

```
?webgpu=0       → force CPU (opt-out)
?webgpu=1       → force WebGPU (developer / preview)
tier === 'low'  → force CPU regardless
navigator.gpu absent → CPU
default         → CPU (phase 1) → WebGPU when capable (phase 2)
```

## 6. Migration plan

- **Phase 1 (now):** PoC lives at `p3_webgpu_poc.html`. Opt-in only. No
  integration with cosmos-layer / canon bus. Internal demo.
- **Phase 2 (Q3 2026):** wire `?webgpu=1` into `index.html` shell. Behavior
  parity for the 5 active behaviors. Glyph behavior still CPU (hybrid mode —
  see §8). Auto-enable for known-good UA (Chrome desktop ≥120, Safari ≥26 on
  M-series).
- **Phase 3 (Q1 2027, contingent on Firefox stable + iOS share):** flip the
  default. Keep `?webgpu=0` as a permanent opt-out.

## 7. Performance estimates

| Target | Particles | Frame time est. | Notes |
|---|---|---|---|
| M1 / M2 MBP | 500k | ~3–5 ms | comfortable 60fps, headroom for more |
| M3 / M4 MBP | 1M+ | ~3–4 ms | likely raster-bound first |
| iPhone 15 Pro | 200k | ~10–12 ms | A17, conservative target |
| iPhone 13 | 80k | ~12–14 ms | borderline; consider CPU |
| Pixel 8 | 120k | ~12 ms | needs measurement |
| Older laptop iGPU | 50–80k | varies | tier='low' → force CPU |
| Anything else | n/a | n/a | CPU fallback @ 22k–38k |

(Estimates only — measured numbers go here when we run the PoC on each
device. M1 number is the only one with PoC-level confidence today.)

## 8. Open questions

- **Hybrid mode** — can the glyph (texture-sampling) behavior run on CPU
  while math behaviors run on GPU, *in the same scene*? Architecturally yes —
  two `THREE.Points` objects with separate buffers — but the canon-bus state
  transitions assume a single particle system. Either generalise or accept
  the friction.
- **State sharing** — speech/audio drive the CPU side via `ctx`. We'd need
  uniform-buffer mirrors of those signals for WGSL. Cheap (low byte count)
  but more wiring.
- **Determinism** — CPU `Math.sin`/`Math.cos` and WGSL `sin`/`cos` differ in
  the last bit. Visible? Probably not. Test if we ever try to A/B compare.
- **Three.js WebGPURenderer** — r160 marks it experimental. This PoC skips
  it and uses raw WebGPU to avoid hitching to a moving target. Revisit when
  r170+ ships a stable API.
- **AR / WebXR** — Three.js owns XR session integration. If we ever want
  inryokü P3 in WebXR, raw-WebGPU complicates things. Decision deferred.

## 9. 禁則 / aesthetic enforcement

inryokü's "no pure white, no pure black" rule is enforced in two places:

1. **Compute shader** — `hslToRgb` forces `l = 0.5`; output is then clamped
   to `[0.15, 0.92]` per channel before write to `colOut`.
2. **Fragment shader** — defense in depth: re-applies the same clamp on the
   interpolated color before output.

If we ever want a hotter colour pulse (light bridge moment), we lift the
upper clamp to 0.98 temporarily via uniform — never higher.

## 10. Files in this PoC

- `p3_webgpu_poc.html` — standalone runner, 500k particles, 3 behaviors, UI
- `webgpu/behaviors.wgsl` — compute shader (HSL→RGB + 3 step functions)
- `webgpu/init.js` — `initWebGPU()` feature detect
- `webgpu/pipeline.js` — compute + render pipeline factories
- `tests/webgpu/feature-detect.test.mjs` — node test for the detect path

## 11. How to test

- **CPU/node:** `node --test tests/webgpu/feature-detect.test.mjs` (6 cases,
  all pass — exercises the no-WebGPU code path).
- **Browser, no WebGPU:** open `p3_webgpu_poc.html` in Firefox → expect the
  fallback box with the link to `p3_unified_test.html`. No JS errors in console.
- **Browser, WebGPU:** open in Chrome 121+ or Safari 26+ → expect 500k
  particles, HUD reporting fps in upper right, 3 behavior buttons in upper
  left. Click each, verify visual transition. Move mouse → expect subtle drift.
- **Performance:** open DevTools → Performance, capture 5s, look at frame
  rate. M-series target ≥60fps. Anything lower → file an issue with the
  particle count where it degrades.
