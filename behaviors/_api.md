# inryokü P3 Behavior API — AI Prompt Template

A behavior is a single ES module that drives one P3 particle's position and
color every frame. Behaviors are pure functions: no state, no allocations,
write-only into the scratch `target` (Vector3-like) and `color` (Color-like)
provided by the host.

This document is the canonical prompt template. Pass it to Claude (or any
generator) along with a one-line goal — e.g. "make particles spiral into a
helix, hue cycles with time" — and it should emit a single file that matches
the contract below.

---

## 1. File layout (copy verbatim)

```js
// behaviors/<id>.js
// One paragraph describing the intent: what the viewer should perceive,
// which scene state this belongs to, and any quirks.

export const meta = {
  id:    '<id>',                          // unique snake_case
  label: 'Human readable label',          // short, used in debug UI
  tags:  ['idle' | 'discovery' | 'speaking' | 'contact' | 'rainbow' | 'yinyang' | 'storm'],
};

export function step(i, count, target, color, time, ctx) {
  // target.set(x, y, z)
  // color.setHSL(h, s, l)
}
```

## 2. Arguments

| arg     | type     | notes                                                     |
|---------|----------|-----------------------------------------------------------|
| `i`     | int      | particle index, `0 <= i < count`                          |
| `count` | int      | total particle count this frame                           |
| `target`| scratch  | call `target.set(x, y, z)` — do not store reference       |
| `color` | scratch  | call `color.setHSL(h, s, l)` or `color.setRGB(r, g, b)`   |
| `time`  | float    | seconds since boot                                        |
| `ctx`   | object   | scene state. May contain:                                 |
|         |          | `mx, my` — mouse in P3 world space                        |
|         |          | `textPts` — sampled INRYOKU canvas glyph points           |
|         |          | `bridge` — `{ from:{x,y,z}, to:{x,y,z}, t:0..1 }`         |

`ctx` keys are optional. Guard with `if (ctx && ctx.bridge) { ... }`.

## 3. Hard constraints

These are enforced by lint and unit tests. A violation breaks the build.

1. **No allocations inside `step()`**. No `new`, no `[]`, no `{}`, no
   `.map/.filter/.slice`. Use only the scratch objects.
2. **No `new THREE.Vector3()` / `new THREE.Color()` anywhere in the module.**
   The host owns scratch.
3. **No dynamic import, no `eval`, no `fetch`, no `Function(...)`**. Behaviors
   ship as static source.
4. **White/black 禁則 — lightness must be 0.5.** Never call `color.set('#fff')`,
   `'#000'`, `'white'`, `'black'`. When using `setHSL`, the third arg must be
   `0.5`. When using `setRGB`, all three channels must be > 0 and < 1 with
   their mean ≈ 0.5 (greys allowed; pure white/black forbidden).
5. **Numerically safe.** No `NaN`, no `Infinity`. Guard divisions with
   `Math.max(eps, denom)`. Use `Math.sin / cos / abs / min / max` over
   branches when possible.
6. **No mutation of `ctx`.** Read only.

## 4. Color palette guidance

inryokü's palette is grey-anchored RGBCMY. Pure white and pure black are
banned because they collapse the "fog of breath" metaphor. Practically:

- `color.setHSL(hue, sat, 0.5)` is the canonical call.
- Saturation may modulate from 0 (grey) up to ~0.95.
- Hue is a free axis. Common patterns:
  - `(time * 0.02 + u * 0.1) % 1` — very slow drift, idle
  - `(tick / 12 + time * 0.08) % 1` — discrete ring hue
  - `(u + time * 0.07) % 1` — per-particle phase
- For greys without violating the rule, use `setRGB(g, g, g)` with
  `g ∈ [0.2, 0.8]`.

## 5. Position guidance

The P3 world is roughly a sphere of radius ~16 centered at origin. Stay within
±25 on each axis to avoid clipping the camera frustum. Common scaffolds:

- **Golden-angle sphere** (uniform distribution):
  ```js
  const u = i / count;
  const phi = Math.acos(2*u - 1);
  const theta = u * count * 2.39996;     // golden angle
  const sp = Math.sin(phi);
  // x = r * sp * cos(theta), y = r * cos(phi), z = r * sp * sin(theta)
  ```
- **Concentric rings**: bucket by `i % N`.
- **Glyph sampling**: read `ctx.textPts[i % ctx.textPts.length]`.

## 6. Runtime semantics

- `step()` is called once per particle per frame. For `count = 5000`, that is
  300 000 calls per second at 60fps. Keep it cheap.
- The host blends one frame on swap to avoid pops. Behaviors do not see this.
- Behaviors must be **deterministic given `(i, count, time, ctx)`**. No
  `Math.random()` inside `step()` — sample randomness from `i` if you need
  variety.
- `prefers-reduced-motion` short-circuits to `idle_static`. Do not try to
  detect this yourself.

## 7. Registration

A behavior file is picked up automatically by `behaviors/index.js` via static
import. To add one:

1. Drop the file in `behaviors/<id>.js`.
2. Add the import + map entry in `behaviors/index.js`.
3. Run `npm test -- --test-name-pattern=behaviors`.

No other wiring is required. The host's `setBehavior(id)` will find it; the
`?behavior=<id>` URL override will route to it.

## 8. Minimal example

```js
// behaviors/helix.js
export const meta = { id: 'helix', label: 'Helix', tags: ['idle'] };

export function step(i, count, target, color, time) {
  const u = i / count;
  const ang = u * Math.PI * 12 + time * 0.4;
  const r = 10 + 4 * Math.sin(time * 0.5 + u * 6);
  target.set(Math.cos(ang) * r, (u - 0.5) * 30, Math.sin(ang) * r);
  color.setHSL((u + time * 0.05) % 1, 0.7, 0.5);
}
```

That is the entire contract.
