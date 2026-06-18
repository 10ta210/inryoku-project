# Canon IDE + Extension Framework — Design

Date: 2026-05-12
Author: 司 / Claude
Status: P3 tooling (debug-only — not shipped in production index.html)

## 1. Why

inryokü's 円環粒子言語 (17 canon, 12 ticks, RGBCMY) is now stable enough that
new canons and behaviors should be authorable by humans — not just hard-coded
in `logo-glyph.js`. To turn the site into a platform we need two things:

1. **An IDE** to design canons visually (drag points on a clock face) and
   export them as drop-in JS modules.
2. **An extension framework** so a canon, a behavior, a scene, or a command
   can be added in a sandboxed plugin folder without touching core files.

The IDE is a tool (`tools/canon-ide/`). The extension framework is a runtime
(`extensions/`). They share the canon shape and the validation rules.

## 2. IDE UX flow

```
 ┌──────────── canon-ide ─────────────────────────────────┐
 │                                                        │
 │   [12-tick clock SVG]      [Metadata]                  │
 │      ◯                       canon id   ┌──────────┐  │
 │   ◯     ◯                    intent    ┌──────────┐  │
 │  ◯  ⬤   ◯                    tone      ┌──────────┐  │
 │   ◯     ◯                    direction  cw / ccw     │
 │      ◯                       doubleRing □            │
 │                              phaseAdvance ▲ 0 ▼      │
 │                                                        │
 │  [Tools] add tick · add string · clear · undo          │
 │  [Color] R G B C M Y none                              │
 │                                                        │
 │                            [Audio preview]              │
 │                            [▶ play] [register ▼]       │
 │                                                        │
 │                            [Export]                    │
 │                            ┌──── pre code ────┐        │
 │                            │ export const ... │        │
 │                            └──────────────────┘        │
 │                            [copy] [download .js]       │
 └────────────────────────────────────────────────────────┘
```

- **Add tick**: click an empty tick slot on the clock. The currently-selected
  color is applied (or `null` if "none" is selected).
- **Add string**: click tick A, then tick B. A chord is drawn with the
  currently-selected color.
- **Edit element**: shift-click a tick or string to re-color it from the
  current swatch. Alt-click deletes.
- **Keyboard editing** (no drag required): `[0..9 a b]` toggles a tick at
  that index; arrow keys move the focus around the clock; Enter starts a
  string from the focused tick. This is the a11y story — the IDE is
  keyboard-complete.

## 3. Validation rules (shared with extensions)

A canon glyph is valid iff:

1. `canon` is `[a-z][a-z0-9_]*`, length 1..40.
2. `direction` ∈ {cw, ccw}.
3. `doubleRing` is boolean.
4. `ticks` is an array of length 0..12; each `{tick: 0..11, color: RGBCMY|null}`.
5. Tick indices are unique (no two ticks at the same slot).
6. `strings` is an array of `{from, to, arc, color}` with from≠to, both 0..11,
   `color` ∈ RGBCMY|null.
7. `phaseAdvance` is an integer in [-6, 6].
8. At least one tick OR one string (silence is the sole exception and must
   declare itself by canon id `silence`).

## 4. Export format

The IDE generates an ES module of the form:

```js
// extensions/<id>/index.js   OR   pasteable into logo-glyph.js GLYPHS
export const glyph = {
  canon: 'aurora_breath',
  direction: 'cw',
  doubleRing: false,
  ticks:   [{tick: 0, color: 'C'}, {tick: 6, color: 'M'}],
  strings: [{from: 0, to: 6, arc: true, color: 'C'}],
  phaseAdvance: 1
};
export default glyph;
```

Drop-in compatible with `logo-glyph.js`'s `GLYPHS[canon]` shape.

## 5. Extension architecture

```
extensions/
  _loader.js          ← loadExtensions({ root, fetch?, importer? }) → Promise<Ext[]>
  manifest.schema.json
  registry.json       ← opt-in list. Empty by default.
  README.md
  _examples/
    inryoku-aurora/
      manifest.json
      index.js
    inryoku-haiku/
      manifest.json
      index.js
```

### Manifest

```json
{
  "id": "inryoku-aurora",
  "name": "Aurora",
  "version": "0.1.0",
  "type": "bundle",      // or behavior | canon | scene | command
  "entry": "index.js",
  "contributes": {
    "behaviors": ["aurora"],
    "canons":    ["aurora_breath"],
    "scenes":    [{ "state": "inspired", "behavior": "aurora" }],
    "commands":  []
  }
}
```

### Entry contract

The entry module exports an object:

```js
export default {
  behaviors: [ /* { meta, step } modules */ ],
  canons:    [ /* { glyph, audio? } */ ],
  scenes:    [ /* { state, behavior } */ ],
  commands:  [ /* { id, label, run(ctx) } */ ]
};
```

All four arrays are optional. The loader registers contributions into the
host registries, then returns the extension descriptor. **One bad extension
never breaks another** — each entry is loaded in its own try/catch.

### Registry pattern

The loader keeps three Maps keyed by id (`behaviors`, `canons`, `scenes`)
plus a flat command list. Duplicate ids fail-soft: the second one is
rejected with a console warning, the first wins, no exception thrown.

### Sandbox / security model

- **No `eval`**. The loader's source contains no `eval` / `Function`. Each
  entry module is loaded by ESM `import()` — bytecode comes from the file,
  never from a string.
- **Whitelisted paths**. The loader only imports from paths matching
  `extensions/*/index.js` relative to its root. Anything else throws.
- **No network**. Extensions are static files. The loader uses no `fetch`.
- **No DOM by default**. Extensions are headless; if they need DOM (rare),
  they receive an isolated root element from the host. We do not give them
  `document`.
- **No cross-extension state**. Each entry runs in its own module scope.
  Sharing happens only through the contributions they declare.
- **registry.json is the auth boundary**. The user opts in by editing it;
  nothing loads automatically.

### Hook surface (today)

| Hook       | When                                       | Argument         |
|------------|--------------------------------------------|------------------|
| behaviors  | `setBehavior(id)` lookup                   | id              |
| canons     | `getGlyph(canon)` lookup                   | canon           |
| scenes     | `resolveBehavior({ state })` mapping        | state           |
| commands   | debug palette `runCommand(id)`              | (ctx) ⇒ Promise |

## 6. Accessibility

The IDE must work without a mouse:

- All clock ticks are reachable via Tab; arrow keys cycle.
- Element delete is `Backspace`/`Delete`.
- All swatches are buttons with `aria-pressed`.
- Live region announces "tick 3 added, color C" etc.
- The exported preview uses `<pre>` with `aria-label="exported module"`.
- High contrast: swatches against grey, plus a textual color code label.

## 7. SaaS-ification path

If 司 wants to monetize:

1. Host the IDE at `ide.inryoku.space`. Free tier = same file export.
2. Add a "Save to my library" button that POSTs the glyph JSON to a small
   Worker + KV. Users pay for the library (private), not the editor.
3. Extension marketplace: same registry pattern, but `registry.json` is
   fetched from the user's account. Each extension is a signed zip.
4. Selling-canons-as-an-asset: pro users get private canons + a render
   that bakes their glyph into a video for social.

The shape we've shipped today already supports steps 1–3 with no breaking
change: the export format and the manifest are the only contracts that
matter.

## 8. What this intentionally does not include (YAGNI)

- **No multi-user collab**. Single-tab editing only. Saves are local.
- **No version history**. The output is a JS file — git is the history.
- **No live registry hot-reload**. Edit `registry.json`, reload the page.
- **No audio editor**. Audio presets are picked from the cosmos-audio
  registers; the IDE does not synthesize new sounds.
- **No theming**. Dark mode only.

## 9. Test surface

`tests/extensions/loader.test.mjs` covers:

1. Manifest schema validation (id, type, entry, contributes).
2. Broken extension isolation (one throws; the other still registers).
3. Contribution registration into behavior / canon / scene maps.
4. Duplicate id detection (second loses, first wins, warning emitted).
5. Path whitelist enforcement (extensions outside `extensions/*` rejected).
