# P3 Wave 1 — Senior Code Review
**date:** 2026-05-15
**reviewer:** code-reviewer agent
**scope:** baseline `86d11cc` → `HEAD` (13 commits)
**files reviewed:** behaviors/*.js (7), tests/behaviors/loader.test.mjs, cosmos-layer.js diff,
cosmos-effects.js, cosmos-postfx.js, cosmos-effects.css, cosmos-audio.js,
cosmos-observation.js, cosmos-interaction.js, cosmos-percentage-hud.js,
p3_effects_test.html, p3_audio_test.html, specs/2026-05-12-*.md

---

## Executive summary
- **The behavior engine + loader is the strongest piece.** GC-zero contract honored across all 6 step modules, tests pass (13/13), reduce-motion routing is correct, fallback `safeStep` is sound. Ship-quality.
- **`cosmos-effects.js` ships several hard 白黒禁則 violations** (`color: 0xffffff`, `0xfafafe`, `fireBurst('#ffffff')`) plus a `setHSL(_, _, 0.55)` lightness deviation that's *not* covered by the loader's lint because it lives outside `behaviors/`. The rule is project-wide, not behaviors-only.
- **`cosmos-layer.js` bridge uses a script-injected ESM polled by setTimeout.** Race-prone (40 × 50 ms = 2 s window), leaks a closure-captured `pollT` that is never cleared, and silently no-ops if the loader takes longer. Use the static `<script type="module">` route in HTML, or `import()` inside the IIFE.

---

## Blockers (must-fix before merge)

### B1. 白黒禁則 violations in `cosmos-effects.js`
The rule is global, not local to `behaviors/`. The loader test (`loader.test.mjs:106-123`) only scans `behaviors/`, so these slipped past.
- `cosmos-effects.js:190` — constellation lines `color: 0xffffff`. Pure white.
- `cosmos-effects.js:197` — constellation dots `color: 0xfafafe`. Effectively white (250/250/254).
- `cosmos-effects.js:413` — burst ring `color: 0xffffff`. Default before `fireBurst()` overrides — but the geometry is added to scene at boot with that color.
- `cosmos-effects.js:142` — `c.setHSL(Math.random(), 0.85, 0.55)` for star accents. Lightness 0.55 ≠ 0.5. Spec §6 says `setHSL` lightness **must** be 0.5.
- `cosmos-effects.js:162` `c.setHSL(..., 0.55)` (twinkle accent) same issue.
- `cosmos-effects.js:390` `c.setHSL(..., 0.55)` (ring marker) same issue.
- `p3_effects_test.html:165-168` — palette literally uses `#ffffff` for glyph and as fallback in `fireBurst(palette[name] || '#ffffff')`.

Comment at `cosmos-effects.js:29` even claims "rainbow accent (HSL l=0.55)" — the spec disagrees with itself. Decide which is canon (the engine spec) and fix the rest.

### B2. `nebulaMat` allocates per-frame Vector2 read
`cosmos-effects.js:113` — fragment shader does `+ u_mouse * 0.6` where `u_mouse` is a `vec2`. Fine.
`cosmos-effects.js:436` — `nebulaMat.uniforms.u_mouse.value.copy(ctx.mouseNDC)`. Copy ok.
But `p3_effects_test.html:179-185` — `mousemove` handler is unthrottled and reassigns the mouse NDC every event. Not strictly a GC leak (set() reuses), but every move drives a uniform update that defeats batching. **Throttle to rAF** (write to a shared `mousePending` and copy in tick).

### B3. cosmos-layer.js ESM loader race
`cosmos-layer.js` diff lines (working tree, +52 onwards):
```js
var pollT = 0;
var pollCount = 0;
function pollAPI() {
  pollT = 0;
  pollCount++;
  if (window.__inryokuBehaviorAPI) { behaviorAPI = window.__inryokuBehaviorAPI; return; }
  if (pollCount < 40) pollT = setTimeout(pollAPI, 50);
}
pollT = setTimeout(pollAPI, 50);
```
- The injected `<script type="module">` is fetched/parsed async. On slow links it can take >2 s — `pollAPI` gives up silently. No telemetry, no retry.
- `pollT` and `pollCount` are top-level IIFE vars that hold the timer indefinitely if the IIFE is GC'd in some odd path; minor but ugly.
- Better: drop the polling. Use `import('./behaviors/index.js').then(api => { behaviorAPI = api; ... })` directly. ESM dynamic import is supported by all browsers in the support matrix (this page already runs `var qs = new URLSearchParams` without a transpile).
- Or have `behaviors/index.js` dispatch a `CustomEvent('inryoku-behaviors-ready')` on `window` and listen for it.

### B4. `convergence_glyph.js:21` uses `setRGB(0.5, 0.5, 0.5)` — that's allowed by the test (mean = 0.5, not pure), but the regex lint at `loader.test.mjs:50` only catches `(1,1,1)` and `(0,0,0)`. A future contributor writing `setRGB(0.5, 0.5, 0.5)` is fine. **But** the `setHSL` lint at `loader.test.mjs:113` is buggy:
```js
const hslLit = /setHSL\s*\([^,]+,[^,]+,\s*([0-9.]+)\s*\)/g;
```
This only matches when the third arg is a **numeric literal**. Every behavior in this PR passes `0.5` literally so it passes, but the lint would happily accept `setHSL(h, s, l)` where `l` is a variable carrying `0.42`. The lint is performative, not enforcing. Acceptable for wave 1 but file a follow-up: enforce with an AST walk or a runtime mock (you already have `ScratchColor.setHSL` rejecting `l != 0.5` at `loader.test.mjs:40-42` — that path is the real enforcement, and it works).

### B5. `cosmos-audio.js` leaks `visibilitychange` listener
`cosmos-audio.js:468` adds `document.addEventListener('visibilitychange', ...)` with **no removal in `dispose()`**. Each `createAudio()` call leaks one listener for the page lifetime. `dispose()` at `cosmos-audio.js:456-464` closes ctx but the closure-captured handler keeps `ctx` reachable. Memory + late `ctx.resume()` on a disposed instance throws.

Fix: hoist the handler to a named const, push to a `cleanups[]`, remove in `dispose()`.

### B6. iOS audio unlock not handled
`cosmos-audio.js:343-350` — `start()` calls `ctx.resume()` if suspended, returning a Promise. On iOS Safari, `AudioContext` must be **created** inside a user-gesture, not just resumed. `ensureCtx()` (line 60) is called by `start()` which *is* gesture-gated in `p3_audio_test.html:186`, so this path works **for that test page**. But the spec at `2026-05-12-audio-interaction-design.md` implies auto-bootstrap is acceptable. Document explicitly that **`createAudio()` must not be called before the first gesture** OR move ctx creation into `start()` only (already true — but `prefersReducedMotion()` runs at module top, fine). Add a comment at line 31 making this contract obvious.

### B7. `cosmos-percentage-hud.js` aria-live floods on every pulse
`cosmos-percentage-hud.js:20` — `aria-live="polite"` on the root. Each pulse rewrites `numEl.textContent` in `tween()` (line 116) **every animation frame for 420 ms**. Screen readers will get spammed (`51` → `51` → `52` → ...) or fire dozens of events per second. Either:
- Only announce the final integer (post-tween), or
- Use `aria-live="off"` and a separate hidden `[aria-live="polite"]` updated once per pulse with the final value.

This is a real accessibility regression vs. the existing site's quieter HUDs.

### B8. `cosmos-interaction.js:99-100` muted state race
```js
if (cfg.audio?.setMuted) cfg.audio.setMuted(!cfg.audio._muted);
cfg.audio._muted = !cfg.audio._muted;
```
This reads `_muted`, calls `setMuted(!_muted)`, then sets `_muted = !_muted` based on **a second read of the same field**. Both reads happen, but between them `setMuted` ran. Currently `setMuted` doesn't touch `_muted` so it accidentally works, but a future `setMuted` that sets `_muted` would invert the state. Track muted in a local `let muted = false` instead, or expose `audio.isMuted()`.

### B9. `cosmos-effects.js` `dispose()` does not remove burst, doesn't unset uniforms holding textures
`cosmos-effects.js:491-497` — disposes meshes but `nebulaMat.uniforms.u_mouse` is a Vector2 (fine), and `pointTexture` is in `disposables` (good). But `bridges[].g` geometry is created with `setFromPoints` in `fireBridge()`? No — bridges are pre-allocated. OK. **However**: `disposeObject` traverses children; `shooters[].line` and `bridges[].line` are direct scene children, removed in the second loop. Fine.

Real issue: there is **no `removeEventListener('resize', ...)` story** because the resize listener lives in `p3_effects_test.html:193`, not the module. When this gets moved into production `cosmos-layer.js` integration, ensure the host owns + cleans up resize. File follow-up.

---

## Important issues (should-fix this PR)

### I1. `breathing_sphere.js:25` saturation can go negative
```js
const sat = 0.30 + 0.18 * Math.sin(time + u * 14);
color.setHSL(hue, sat < 0 ? 0 : sat, 0.5);
```
`0.30 - 0.18 = 0.12`, so `sat` never goes negative. The guard is dead code — but it suggests the author was unsure. Either remove the guard with a comment, or write `Math.max(0, sat)` for clarity. (Nit-tier, included because it indicates a missed mental check.)

### I2. `ring_resonance.js:14` ang grows linearly without modulo
```js
const ang = u * Math.PI * 48 + time * 0.5;
```
`u * Math.PI * 48` — fine, bounded. `time * 0.5` unbounded but `Math.cos/sin` accept large floats; precision degrades after ~2^23 seconds (~97 days continuous uptime). Acceptable. Not a bug.

### I3. `attractor_hover.js:28` fall divisor uses fixed 0.018
The "radius" of attention is hardcoded. If P3 scene scale changes (camera FOV, sphere radius from `r = 16`), the radius scales independently. Tie to a `ctx.scale` or document the magic number at the file header.

### I4. `light_bridge_accent.js:35` hashing via `i * 0.6180339887 % 1`
Float multiplication of `i * 0.618...` past `i ≈ 2^26` collapses to integers (mantissa exhausted). For `count = 5000` this is fine. Document the index range assumption.

### I5. `cosmos-effects.js` SHOOT_POOL = 3 (auto), but `fireShooter` chooses `Math.random()` start positions every call → if all 3 fire simultaneously near the camera, GPU overdraw spike. Not catastrophic; consider staggering ignition by minimum interval (already 3-8 s between fires, ok).

### I6. `cosmos-effects.js:443` `twinkle.material.size` mutated every frame
PointsMaterial `size` is a uniform — setting it works but triggers a material re-upload? Actually `size` is read into shader uniform per draw, so this is cheap. **However** `material.size` setter has no cost beyond assignment, so OK. Confirm by checking three.js source if pursuing absolute perf.

### I7. `cosmos-postfx.js:46-49` dispose order
```js
function dispose() {
  composer.passes.forEach((p) => p.dispose?.());
  composer.dispose?.();
}
```
`composer.dispose()` in three r160 doesn't exist as a public API; passes do. The `?.()` will silently skip. Fine for now, but renderTarget held by composer is leaked. Use `composer.renderTarget1.dispose(); composer.renderTarget2.dispose();` or upgrade when three exposes it.

### I8. `cosmos-effects.js:131` `makeStars` random seeding non-deterministic
Star positions and colors use `Math.random()`. Visual regression test PNGs (mentioned in behavior-engine spec §6) will be flaky against this layer. Either seed `Math.random` via a deterministic PRNG, or accept that this layer is excluded from visual diff. Document.

### I9. `cosmos-observation.js:42` debounce only checks history[0]
```js
if (state.lastAt && now - state.lastAt < 80 && state.history[0]?.source === source)
```
If two sources alternate every 40 ms (e.g. mousemove + scroll), neither triggers the debounce. Bug: meant as a per-source rate-limit but acts as a same-as-last-only debounce. Probably OK semantically (you do want both events to count). File: rename `pulse` debounce comment to clarify intent.

### I10. `cosmos-interaction.js:71` `onScroll._fired` stamps a one-shot via property on the function
```js
if (bottom && !onScroll._fired) {
  onScroll._fired = true;
  ...
  setTimeout(() => { onScroll._fired = false; }, 4000);
}
```
Works but ties state to the function identity. If `dispose` runs between `setTimeout` firing and re-firing onScroll, no leak, but the setTimeout is uncancelled. Track in `cleanups` or use a local `let lastBottomFire = 0`.

### I11. `cosmos-percentage-hud.js:122` parses `numEl.textContent` to seed animFrom
```js
animFrom = parseInt(numEl.textContent, 10);
```
On first render `textContent === '--'` → `NaN`, falls through to `pct` (line 123). OK. But after wrap, the value briefly shows `99` then jumps to `50` — `parseInt('99') === 99`, then `animTo = 50`, animation counts down from 99 to 50. Visible "rollback" instead of a wrap. Either skip animation on `wrapped` or animate via modular addition.

### I12. `cosmos-effects.js:331` initial bridge fires `fireBridge(b, -i * 1.5)` — second arg is unused
```js
function fireBridge(b, now) {
  b.from = ...; b.to = ...;
  b.t0 = now;     // now used here
  b.hue = ...;
}
```
Actually it *is* used at `b.t0 = now`. So the negative seeds stagger initial appearance. OK. Confusing param name though — call it `t0` not `now`.

### I13. `cosmos-effects.js:306-310` reads `constData[b.from].pts[0]` only
Bridges always travel between the *first* node of each constellation — wastes the per-constellation `pts` distribution. Likely intentional (anchor points) but worth a comment: "intentional: bridges connect anchor (pts[0]) of each constellation".

---

## Nits (optional)

- **N1.** `behaviors/_api.md:57` says "No `new`, no `[]`, no `{}`" but the GC test (`loader.test.mjs:126`) doesn't actually allocation-track — it only checks `target.sets >= 10000`. Real GC verification requires either a V8 heap snapshot diff or running under `--expose-gc` and asserting heap deltas. The current test is a *behavioral smoke test*, not a GC assertion. Either rename the test ("`step() writes scratch on every call`") or strengthen with `--expose-gc`.

- **N2.** `behaviors/index.js:97-104` window globals only when `window` exists. ESM tests run in Node, no window. Good. But `__inryokuBehaviorAPI` is set from **both** `behaviors/index.js` (line 99) and the script injected in `cosmos-layer.js` diff (the inlined script also writes it). The second overwrites the first identically — confusing but harmless.

- **N3.** Specs in `docs/superpowers/specs/2026-05-12-*.md` are dated 5/12, today is 5/15. Acceptable, but the behavior-engine spec §6 says "視覚回帰：各 behavior 1 フレーム決定論レンダ" — *no such test landed*. Either drop from spec or file as wave-3 task.

- **N4.** `cosmos-effects.js:74-77` reads `prefers-reduced-motion` again locally even though `opts.reduceMotion` is plumbed; that's the right pattern (defensive). Just note it duplicates the matchMedia call across modules — extract a single helper?

- **N5.** `cosmos-effects.js:431` JSDoc says "update order: nebula → stars → constellations → bridges → particles → logo → rings → composer" but code runs nebula, stars, constellations, bridges, **shooters** (not in doc), logo, rings, burst. Doc drift.

- **N6.** `cosmos-interaction.js:4` `KONAMI` array — keys are case-sensitive; on Japanese IME mode, `b` and `a` may be intercepted. Real users will hit this. Add `e.key.toLowerCase()` comparison or document.

- **N7.** `cosmos-percentage-hud.js:30-35` bar colors use `hsl(0,80%,50%)` etc. Light = 50% — compliant. Good.

- **N8.** `p3_audio_test.html:9` `min-height: 100vh` — should be `100dvh` for iOS Safari address-bar handling. Same for `p3_effects_test.html` (uses `height: 100%`).

- **N9.** `cosmos-interaction.js:5-10` `FULL_CANON_SEQUENCE` order differs from `CANON_LIST` in `cosmos-audio.js:11-16`. Intentional? If so, comment. If not, align.

---

## Per-file findings

### behaviors/*.js
**Verdict: STRONG.** All 6 modules + index + tests honor the GC-zero contract. Hue values guarded for negatives (`if (hue < 0) hue += 1`). Math.acos arg is `2*u - 1` which is in `[-1, 1]` since `u ∈ [0, 1)` — safe. `count` guarded by `Math.max(1, count)` everywhere. Tests run clean: 13/13 pass.

- `breathing_sphere.js:13-27`: clean, slow drift, GC-zero. **OK**.
- `attractor_hover.js:14-33`: clean; `(ctx && typeof ctx.mx === 'number')` guard defends well. **OK**.
- `ring_resonance.js:11-24`: clean. **OK**.
- `convergence_glyph.js:13-35`: clean. Fallback at lines 14-22 uses `setRGB(0.5,0.5,0.5)` (mid-grey, allowed). **OK**.
- `light_bridge_accent.js:15-53`: clean. The bridge=null path inlines an idle copy — DRY violation but justified for GC-zero (cannot delegate to `breathing_sphere.step` because that would double the function call cost on the hot path). **OK** with comment.
- `idle_static.js:13-27`: completely time-independent for position. Honors reduce-motion contract. **EXCELLENT**.

### tests/behaviors/loader.test.mjs
**Verdict: GOOD but partial.** 13 tests, all pass. ScratchColor (lines 34-55) enforces `l == 0.5` at runtime — this is the **real** lint, and it's solid. Source-regex lint at lines 107-123 is weaker (numeric-literal only). Coverage gaps:
- No test for `safeStep` returning the **caller's id** on success.
- No test for `urlBehavior` with malformed input (e.g. `'../../etc/passwd'` — the regex `/^[a-z0-9_]+$/i` in cosmos-layer guards it but the loader itself trusts `BEHAVIORS.has(s.urlBehavior)`).
- No test ensures `count = 0` doesn't crash any behavior (`u = 0/max(1,0) = 0`, OK in spot checks, but worth one explicit case).

### cosmos-layer.js (diff only)
**Verdict: ACCEPTABLE WITH BLOCKER B3.** Pure additive — does not touch existing P3 code. The window-globals shim is reasonable for a non-build vanilla project. Polling loader is the wart.

### cosmos-effects.js
**Verdict: NEEDS FIXES.** Visually rich, structurally sound (pre-allocated buffers, scratch `tmpColor` + `_v`). But ships **白黒禁則 violations** (B1) and is the largest single file in wave 1; needs another pass for the rule.

### cosmos-postfx.js
**Verdict: ACCEPTABLE.** Small, focused. Minor leak on composer renderTargets (I7).

### cosmos-effects.css
**Verdict: GOOD.** Reduce-motion path present (line 57). Scoped `cfx-*` prefix. CSS variable `--cfx-ink: #f0f0f6` is not pure white, compliant.

### cosmos-audio.js
**Verdict: STRONG but B5+B6.** Web Audio architecture is correct (compressor as limiter, pre-allocated typed arrays, no per-tick allocations in `getLevel`/`getSpectrum`). Mic path correctly avoids destination feedback (line 393-394 comment). Two real issues: listener leak (B5) and iOS contract clarity (B6).

### cosmos-interaction.js
**Verdict: GOOD.** Clean cleanups[] pattern. Konami code, idle timer, mic-blow detection. B8 race on mute, I10 dangling setTimeout. No reduce-motion check on mousemove pulses — for a HUD pulse this is OK (audio.pulse is gentle), but consider gating `cfg.audio.pulse(0.3)` at `cosmos-interaction.js:56` when reduce-motion (not the audio play — the *pulse-as-tick* feedback may still be wanted; designer call).

### cosmos-observation.js
**Verdict: GOOD.** Persistence wrapped in try/catch (localStorage can throw in private mode). Bounded history (32). I9 debounce semantic comment needed.

### cosmos-percentage-hud.js
**Verdict: NEEDS FIXES.** Self-contained, scoped styles, reduce-motion CSS branch (line 85). But B7 aria-live flood + I11 wrap visual jump.

### p3_effects_test.html
**Verdict: ACCEPTABLE for a test harness.** `cursor: none` (line 16) hides cursor globally — accessibility regression for non-pointer devices. Acceptable for a test page. Production integration must restore native cursor or provide one with `outline` focus styles. Buttons in `#scene` have no `aria-label` and `cursor: none` removes affordance.

### p3_audio_test.html
**Verdict: ACCEPTABLE for a test harness.** Pre-gesture overlay (line 96) handles iOS unlock. `aria-pressed` on toggles (line 103-105). Good.

---

## What's GOOD (preserve in wave 2)

1. **`safeStep` fallback** (`behaviors/index.js:82-95`). Catches behavior throws, falls back to `idle_static`. The canvas can never go blank from a buggy contribution. Preserve.

2. **ScratchColor rejects `l != 0.5` in tests** (`loader.test.mjs:40-42`). The runtime check is the **actual** enforcement of the 白黒禁則 — far stronger than the source regex. Mirror this pattern for `cosmos-effects.js` (add a runtime wrapper or extend the test to scan `cosmos-effects.js` source too).

3. **Reduce-motion plumbed at every layer.** `cosmos-postfx.js:31-35` disables AfterimagePass. `cosmos-audio.js:35` sets `forceSilent`. `cosmos-effects.js:243` short-circuits shooters. `behaviors/index.js:71` routes to `idle_static`. CSS has the `@media` block. **Excellent discipline.**

4. **GC-zero verified by repeated step calls** — 5000 × 2 × 6 = 60k calls per test run with `target.sets/color.sets` counts. Strong harness.

5. **`cosmos-observation.js` saturation at 99 ("100% は無い")** — perfectly implements the philosophical constraint from `project_inryoku_vision.md`. Wraps to 50 not 0 (`FLOOR = 50`) — meaningful design choice.

6. **`cosmos-interaction.js` mute-on-`m`-key + Konami easter egg + scroll-to-bottom 'revelation'** — these are the kind of joy details that age well. Preserve.

7. **`fireBurst` in cosmos-effects** ties behavior changes to a visible shockwave — bridges the behavior engine and the visual layer without coupling them at the module level. Nice seam.

8. **`behaviors/_api.md` as a prompt template** — files like this are exactly how to keep AI-generated contributions in-spec. Excellent docs hygiene.

---

## Follow-up tasks for wave 3 (in addition to fix-checklist)

- **W3-FU1.** Add a project-wide 白黒 lint script (`scripts/lint-no-white-black.mjs`) that scans `cosmos-*.js` + `behaviors/*.js` + CSS for forbidden literals. Wire to `npm test`.
- **W3-FU2.** Strengthen the GC-zero test with `--expose-gc` and `process.memoryUsage().heapUsed` delta after 60k calls < 32 KB.
- **W3-FU3.** Visual regression PNGs for each behavior at `time=0` (spec §6 promised, not delivered).
- **W3-FU4.** Drop the cosmos-layer.js polling loader; use dynamic `import()` and resolve a single promise.
- **W3-FU5.** Extract a shared `prefersReducedMotion()` + `reduceMotionMatchMedia()` helper instead of duplicating across 4 modules.
- **W3-FU6.** Add unit test for `cosmos-observation.js` wrap behavior and persistence round-trip.
- **W3-FU7.** Add an `aria-live` integration test (axe-core scan on `p3_audio_test.html`).
- **W3-FU8.** Document `createAudio()` lifecycle contract: must not call `start()` before first gesture on iOS (B6).
- **W3-FU9.** Mobile audit on iPhone 12+: confirm `tier = 'low'` heuristic at `p3_effects_test.html:147` produces 60 fps; verify postfx + bloom on mobile GPU; capture network panel for 3000-star buffer upload time.
- **W3-FU10.** Confirm no fullname leakage in new HTML files (`grep -rn` ran clean during this review but worth adding to CI).

---

## Overall verdict

**FIX-FIRST.** Wave 1 is ~80% solid — the behavior engine is mergeable as-is, and the audio/observation/HUD stack is well-architected. The blockers are concentrated in `cosmos-effects.js` (white/black violations) and `cosmos-layer.js` (loader race). Both are surgical fixes, not redesigns. Estimated wave-3 fix time: 1-2 hours focused.

Do **not** merge `cosmos-effects.js` until B1 is resolved — the rule is project-wide and shipping `0xffffff` constellation lines would set a precedent that erodes the 白黒禁則 over time.
