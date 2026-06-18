# Wave 1 → Wave 3 Fix Checklist
**date:** 2026-05-15
**source:** `2026-05-12-wave1-review.md`

Priority order. Each item: file:line · current · expected · why.

## BLOCKERS

### [B1.a] cosmos-effects.js:190 — pure white constellation lines
- **current:** `color: 0xffffff, transparent: true, opacity: op, blending: THREE.AdditiveBlending`
- **expected:** `color: 0xb8b8c0` (grey, ~0.72), OR set per-line via `m.color.setHSL(constHue, 0.5, 0.5)` keyed by constellation index `k`.
- **why:** 白黒禁則 is project-wide. `0xffffff` is a literal banned value.

### [B1.b] cosmos-effects.js:197 — near-white constellation dots
- **current:** `color: 0xfafafe`
- **expected:** `color: 0xc8c8d0` or HSL `(0, 0, 0.5)` neutral grey.
- **why:** 250/250/254 is functionally white. Banned.

### [B1.c] cosmos-effects.js:413 — burst ring default white
- **current:** `color: 0xffffff` (before fireBurst overrides)
- **expected:** initial grey `color: 0x808088`; let `fireBurst` set the canon color.
- **why:** Default state visible before first burst.

### [B1.d] cosmos-effects.js:142 — star accent HSL lightness 0.55
- **current:** `c.setHSL(Math.random(), 0.85, 0.55)`
- **expected:** `c.setHSL(Math.random(), 0.85, 0.5)`
- **why:** Spec rule: lightness MUST be 0.5. Comment at line 29 also wrong — fix.

### [B1.e] cosmos-effects.js:162 — twinkle accent lightness 0.55
- **current:** call to `makeStars(COUNT_TWINKLE, 80, 0.9, 1.0, 0.4)` triggers same path
- **expected:** parameter `accent` path at line 141-142 uses 0.5
- **why:** Same as B1.d (single fix at line 142 covers both).

### [B1.f] cosmos-effects.js:390 — ring marker lightness 0.55
- **current:** `c.setHSL((i / segs + r * 0.16) % 1, 0.9, 0.55)`
- **expected:** `c.setHSL((i / segs + r * 0.16) % 1, 0.9, 0.5)`
- **why:** Same rule.

### [B1.g] p3_effects_test.html:165-169 — palette literal whites
- **current:** `glyph: '#ffffff'` and `effects.fireBurst(palette[name] || '#ffffff')`
- **expected:** `glyph: '#c8c8d0'` and fallback `'#a78bfa'` or scene-appropriate.
- **why:** Test harness still surfaces banned values.

### [B3] cosmos-layer.js (working-tree diff, ~+90) — polling ESM loader race
- **current:** `<script type="module">` injected via `s.textContent`, then `setTimeout(pollAPI, 50)` up to 40 times.
- **expected:** Replace with dynamic import:
```js
import('./behaviors/index.js').then((api) => {
  behaviorAPI = {
    list: () => Array.from(api.BEHAVIORS.keys()),
    get:  api.getBehavior,
    resolve: api.resolveBehavior,
    step: api.safeStep,
  };
  window.__inryokuBehaviorAPI = behaviorAPI;
  window.cosmosLayer.behaviorsReady = true;
  const url = new URLSearchParams(location.search).get('behavior');
  if (url && api.BEHAVIORS.has(url)) window.cosmosLayer.setBehavior(url);
}).catch((e) => { try { console.warn('[cosmos-layer] behavior loader failed:', e); } catch (_) {} });
```
- **why:** Polling is fragile on slow connections, leaks no-op timers, and the indirection via injected `<script type=module>` adds nothing dynamic `import()` can't do.

### [B5] cosmos-audio.js:467-473 — visibilitychange listener leaks
- **current:** anonymous handler attached at module-instance creation, never removed.
- **expected:**
```js
const onVisibility = () => { if (!ctx) return; ... };
document.addEventListener('visibilitychange', onVisibility);
// in dispose():
document.removeEventListener('visibilitychange', onVisibility);
```
- **why:** Each `createAudio()` leaks one listener + retained ctx via closure for page lifetime.

### [B6] cosmos-audio.js:31 — iOS gesture contract
- **current:** comment block lists rules but doesn't state ctx creation rule.
- **expected:** add to file header:
```
// iOS contract: createAudio() may be called at any time, but start()
// MUST be invoked from a user-gesture handler. ensureCtx() is deferred
// until start() so AudioContext is born inside the gesture.
```
Also add `if (!ctx) console.warn('[cosmos-audio] start() called outside gesture context')` guard.
- **why:** iOS Safari rejects late-resumed contexts when not born in gesture.

### [B7] cosmos-percentage-hud.js:20 — aria-live flood
- **current:** `root.setAttribute('aria-live', 'polite')` on root that holds tween-updated number.
- **expected:**
  1. Set `aria-live="off"` on root.
  2. Add hidden announcer: `<span class="sr-only" aria-live="polite" aria-atomic="true" id="cosmos-pct-sr"></span>`
  3. After tween settles (in `tween()` when `p >= 1`), set `srEl.textContent = label + ' ' + v + ' percent'`.
  4. CSS: `.sr-only { position:absolute; width:1px; height:1px; clip:rect(0 0 0 0); overflow:hidden; }`
- **why:** Polite live regions on tween-updated text flood screen readers — 25-60 updates per pulse.

### [B8] cosmos-interaction.js:99-100 — mute state race
- **current:**
```js
if (cfg.audio?.setMuted) cfg.audio.setMuted(!cfg.audio._muted);
cfg.audio._muted = !cfg.audio._muted;
```
- **expected:**
```js
} else if (e.key === 'm' || e.key === 'M') {
  if (cfg.audio?.setMuted) {
    muted = !muted;
    cfg.audio.setMuted(muted);
  }
```
where `let muted = false;` is in module-instance scope.
- **why:** Currently happens to work, but couples to `audio._muted` private field. Brittle.

### [B9] cosmos-audio.js dispose() does not clear `started`/`disposed` cleanly when called twice
- **current:** Calling `dispose()` twice tries `ctx.close()` again with `ctx = null`. The optional chaining + try/catch makes it safe, but no idempotency comment.
- **expected:** Early return: `if (disposed) return;` at top of dispose().
- **why:** Defensive.

## IMPORTANT (should-fix this PR)

### [I1] behaviors/breathing_sphere.js:25-26 — dead guard
- **current:** `const sat = 0.30 + 0.18 * Math.sin(...); color.setHSL(hue, sat < 0 ? 0 : sat, 0.5);`
- **expected:** Either remove guard (sat ∈ [0.12, 0.48]) or comment why kept.
- **why:** Dead code is a smell.

### [I3] behaviors/attractor_hover.js:28 — magic 0.018 falloff
- **current:** `const fall = 1 / (1 + d2 * 0.018);`
- **expected:** Hoist `const FALLOFF = 0.018;` at module top with comment "tuned to r=16 sphere; halflife ~7.4 units".
- **why:** Maintainability when scene scale changes.

### [I7] cosmos-postfx.js:46-49 — composer renderTarget leak
- **current:** `composer.dispose?.()` (does not exist in r160).
- **expected:**
```js
function dispose() {
  composer.passes.forEach((p) => p.dispose?.());
  try { composer.renderTarget1?.dispose(); } catch(_) {}
  try { composer.renderTarget2?.dispose(); } catch(_) {}
}
```
- **why:** WebGL render targets are real GPU memory.

### [I8] cosmos-effects.js:131 — non-deterministic stars
- **current:** `Math.random()` everywhere in star/constellation init.
- **expected:** Accept a seed in opts and use a simple mulberry32 PRNG. Default seed: 1.
- **why:** Visual regression PNGs will be flaky.

### [I9] cosmos-observation.js:42 — debounce comment mismatch
- **current:** comment says "same-source repeats within 80ms collapse"; code checks history[0]?.source.
- **expected:** Either rename to `if (now - state.lastAt < 80 && state.history[0]?.source === source)` and add comment "same-source AND within 80ms"; OR make it a true per-source map.
- **why:** Comment-code drift.

### [I10] cosmos-interaction.js:74 — dangling setTimeout in onScroll
- **current:** `setTimeout(() => { onScroll._fired = false; }, 4000);` not tracked.
- **expected:** `const tid = setTimeout(...); cleanups.push(() => clearTimeout(tid));`
- **why:** Dispose during 4 s window leaves timer fired post-dispose.

### [I11] cosmos-percentage-hud.js:121-126 — wrap visual rollback
- **current:** On wrap from 99→50, animation tweens 99→50 (counts down 49).
- **expected:** When `wrapped`, skip tween: `numEl.textContent = String(pct).padStart(2,'0')` immediately, then trigger pulse class.
- **why:** Visual rollback contradicts the "+1" semantic.

## NITS

### [N5] cosmos-effects.js:23 — doc order missing shooters
- **current:** comment lists "nebula → stars → constellations → bridges → particles → logo → rings → composer"
- **expected:** add "→ shooters" between bridges and particles.
- **why:** Doc accuracy.

### [N6] cosmos-interaction.js:78 — Konami case sensitivity
- **current:** `if (e.key === KONAMI[konamiIdx])`
- **expected:** Compare `e.key.length === 1 ? e.key.toLowerCase() : e.key` against lowercased table.
- **why:** Shift+B breaks Konami.

### [N8] p3_audio_test.html:9 + p3_effects_test.html — use dvh
- **current:** `min-height: 100vh` / `height: 100%`
- **expected:** `min-height: 100dvh` with `100vh` fallback.
- **why:** iOS address-bar covers bottom 80 px on `vh`.

### [N9] cosmos-interaction.js:5-10 — sequence differs from CANON_LIST
- **current:** `FULL_CANON_SEQUENCE` reorders for Konami narrative
- **expected:** add comment: "intentional narrative order: silence → emergence → ... → revelation. Differs from CANON_LIST order in cosmos-audio.js."
- **why:** Avoid accidental "alignment" PR.
