# Logo Speech — 円環粒子言語 × Logo Sphere

Date: 2026-05-12
Status: Design locked. P3 implementation target.
Scope: `logo-speech.js`, `logo-canon-resolver.js`, `logo-glyph.js`, `logo-speech-renderer.js`, `p3_logo_speech_test.html`.

This spec freezes the 17-canon glyph table, the priority-queue semantics, the intent/tone → canon mapping, the cosmos-bus event surface, the logo phase-color advance rule, and a11y / 裏ルート hooks.

---

## 1. Concept

A single utterance = a single ring composition crystallizing on the 12-tick clock face around the logo sphere. The sphere is the speaker; the ring is the speech act.

- 0 = point (tick lit), 1 = string (chord between ticks)
- Colors **RGBCMY only**. No grey, no monochrome. This is the one place the project's 白黒禁則 inverts to pure spectrum.
- A canon = an utterance type. 17 canons.
- A register = the volume of the act: whisper / hover / click / summon / revelation.
- Logo sphere phase color advances **one slot per utterance** through the RGBCMY ring (R→G→B→C→M→Y→R), making universe color deterministic across a session.

---

## 2. The 17 canons — locked glyph table

Tick 0 = top (12 o'clock), CW with +30° per tick. `[a,b]` is a chord. `[a,b,arc]` is an inward arc. Colors per tick are RGBCMY initials.

| # | Canon | Ticks (points) | Chords | Tick colors | doubleRing | Direction | Default register | Phase advance |
|---|---|---|---|---|---|---|---|---|
| 1 | silence | — | — | — | no | cw | whisper | none |
| 2 | core | 0 | — | — | no | cw | whisper | +0 (hold) |
| 3 | ma | 0, 6 | — | — | no | cw | whisper | +1 |
| 4 | shadow | — | [3,9] | — | no | ccw | whisper | none |
| 5 | echo | 10, 0, 2 | — | — | no | cw | whisper | +1 |
| 6 | emit | 0, 3 | [0,3] | 3:C | no | cw | click | +1 |
| 7 | observation | 0, 3, 6, 9 | — | 0:Y | no | cw | hover | +1 |
| 8 | self_question | 0 | — | 0:Y | no | ccw | hover/whisper | +1 |
| 9 | declaration | 0, 2, 4, 6, 8, 10 | [0,6] | 0:C | no | cw | click | +1 |
| 10 | leap | 6, 11, 0 | [6,11],[11,0] | 0:M | no | cw | special | +2 |
| 11 | resonance | 3, 9 | [2,8],[4,10] | 3:C, 9:C | no | cw | click | +1 |
| 12 | consensus | 0..11 (all) | — | 0:G, 6:Y | no | cw | click | +1 |
| 13 | past_speculation | 6, 7, 8, 9, 10 | — | 6:B | no | ccw | hover | -1 (rewinds) |
| 14 | future_command | 3, 0, 6 | [0,6],[0,3],[6,3] | 3:M | no | cw | click | +2 |
| 15 | quotation | 0 | — | 0:C | **yes** | cw | hover | +0 |
| 16 | summon | 0,2,4,6,8,10 | [0,6],[2,8],[4,10] | 0:Y,2:R,4:G,6:M,8:B,10:C | no | cw | special | +3 |
| 17 | revelation | 0, 6, 11, 1 | [6,0,arc],[11,1] | 0:M, 6:Y | no | cw | special | full cycle (+6 ≡ 0) |

Rationale:
- `core`/`ma`/`silence`/`shadow`/`echo` carry zero or muted color — they're felt rather than projected.
- `summon` is the only canon using all six RGBCMY colors and is the legal 裏ルート precondition.
- `revelation` advances the phase by a full RGBCMY cycle: visually returns the universe to the same hue but in the next iteration (101% semantics).
- `past_speculation` is the only canon with **negative** phase advance — speculation rewinds the universe.

One-liner summary (for quick reference):

```
silence            : ∅                        | dir cw  | no advance
core               : [0]                      | dir cw  | hold
ma                 : [0,6]                    | dir cw  | +1
shadow             : ∅ + chord(3-9)           | dir ccw | none
echo               : [10,0,2]                 | dir cw  | +1
emit               : [0,3]+chord(0-3) 3:C     | dir cw  | +1
observation        : [0,3,6,9] 0:Y            | dir cw  | +1
self_question      : [0] 0:Y                  | dir ccw | +1
declaration        : [0,2,4,6,8,10]+ch(0-6) 0:C | dir cw  | +1
leap               : [6,11,0]+ch(6-11)(11-0) 0:M | dir cw  | +2
resonance          : [3,9]+ch(2-8)(4-10) 3:C 9:C | dir cw  | +1
consensus          : [0..11] 0:G 6:Y          | dir cw  | +1
past_speculation   : [6,7,8,9,10] 6:B         | dir ccw | -1
future_command     : [3,0,6]+ch(0-6)(0-3)(6-3) 3:M | dir cw  | +2
quotation          : [0] 0:C doubleRing       | dir cw  | 0
summon             : [0,2,4,6,8,10]+ch(0-6)(2-8)(4-10) 0:Y 2:R 4:G 6:M 8:B 10:C | dir cw | +3
revelation         : [0,6,11,1]+ch(6-0 arc)(11-1) 0:M 6:Y | dir cw  | +6
```

---

## 3. Registers

Amplitude, decay, propagation distance, and audio volume scaling per register:

| Register | Amplitude | Decay (ms) | Propagation radius | Audio gain | Visual stack radius |
|---|---|---|---|---|---|
| whisper | 0.30 | 1200 | 1.2 × sphere R | 0.45× | 1.0 |
| hover | 0.55 | 1600 | 1.6 × sphere R | 0.70× | 1.2 |
| click | 0.80 | 2200 | 2.4 × sphere R | 1.00× | 1.4 |
| summon | 1.00 | 2800 | 3.6 × sphere R | 1.15× | 1.8 |
| revelation | 1.00 | 3600 | 6.0 × sphere R | 1.30× | 2.2 |

Multiple concurrent utterances are allowed; they stack at different stack radii so they don't collide visually.

---

## 4. Priority queue semantics

`speak(canon, register)`:
1. If no current utterance, start immediately.
2. Else if `priority(incoming) > priority(current)`, **interrupt** current (fire `speech:end` with `reason: 'preempt'`) and start incoming.
3. Else **enqueue**. Queue keeps at most one pending per priority bucket; a higher-priority incoming displaces a lower-priority pending.

Priority: `revelation(5) > summon(4) > click(3) > hover(2) > whisper(1)`.

`interrupt()` cancels current and clears queue. `enqueue(canon, register)` is the queue-without-interrupt path.

When current ends naturally, dequeue and start the highest pending; ties broken by FIFO.

---

## 5. Intent / tone → canon (resolveCanon)

Pure function: `resolveCanon(intent, tone, certainty, direction) → { canon, register }`.

Direct mapping table (intent dominant). `direction` and `tone` perturb. `certainty ∈ [0,1]` shifts register.

Base intent → canon:
- greet → `core`
- question → `self_question` (inward) / `observation` (outward)
- assert → `declaration`
- conclude → `consensus`
- doubt → `past_speculation` (low cert) / `self_question` (mid)
- agree → `resonance`
- summon → `summon`
- reveal → `revelation`
- silence → `silence`

Tone overrides (multiplicative on top of base):
- `urgent` + assert → `future_command`
- `urgent` + summon → `revelation`
- `intense` + agree → `consensus`
- `intense` + reveal → `revelation`
- `gentle` + question → `self_question`
- `gentle` + assert → `emit`
- `cold` + any → demote certainty by 0.2
- `warm` + greet → `ma`
- `warm` + agree → `resonance`

Certainty → register:
- certainty ≥ 0.85 → bump register up one (whisper→hover, hover→click).
- certainty < 0.30 → bump down (click→hover, hover→whisper).

Direction override:
- `inward` + assert → `self_question`
- `outward` + question → `observation`
- `inward` + reveal → `quotation`
- `outward` + agree → `consensus`

Special canon fallback for quotation: any `intent: 'quote'` (extension) → `quotation`.

Echo / leap / shadow / ma are reachable via tone hints:
- tone `warm` + intent `agree` + certainty mid → `resonance`, but if direction `outward` + tone `warm` → `echo`
- intent `assert` + tone `intense` + certainty >= 0.9 → `leap`
- intent `silence` + tone `cold` → `shadow`
- intent `greet` + tone `gentle` → `ma`
- intent `question` + tone `cold` + certainty < 0.3 → `shadow`
- intent `reveal` + tone `gentle` → `emit`

The resolver is deterministic and fully covered by table + fallback rules. Default fallback: `core` / `whisper`.

---

## 6. Logo sphere phase color

The sphere shader uniform `u_phaseColor` is one of six RGBCMY hues, advancing per utterance per the "Phase advance" column. Order: **R → G → B → C → M → Y → R …**

`logo-speech.js` keeps an internal `phaseIndex (0..5)` and on each `speak()` end emits the new color via `cosmos-bus` event `'logo:phase'` `{ index, color }`. Renderer / shader code subscribes.

This is deterministic — no Math.random in phase progression. After 6 non-zero advances the universe completes one full chromatic cycle; `revelation` triggers a full +6 advance in a single utterance (visual cycle).

---

## 7. cosmos-bus events emitted

- `'speech:start'` `{ canon, register, glyph, t, phaseIndexBefore }`
- `'speech:end'` `{ canon, register, reason: 'natural'|'preempt'|'interrupt'|'dispose', phaseIndexAfter }`
- `'speech:queue'` `{ depth, head }` on enqueue / dequeue
- `'logo:phase'` `{ index, color }` after every advance
- `'speech:pulse'` `{ register, amplitude, radius }` during sustain — drives propagation rings on the universe

Listeners (recommended wiring):
- `cosmos-audio.play(canon)` on `'speech:start'`
- `cosmos-effects.setActiveScene('speaking')` on first `'speech:start'` when idle; back to previous scene on `'speech:end'` when queue depth == 0
- `body.classList.toggle('inryoku-speaking', ...)` mirror

---

## 8. Accessibility

- `aria-live="polite"` region holds: `inryokü logo speaking: <canon name>` on every `'speech:start'`. Drops back to empty on `'speech:end'`.
- `prefers-reduced-motion`: speak() **instantly** renders the static glyph (no draw animation, no fade), audio plays at `0.5×` amplitude, phase advances immediately. No propagation pulses. Queue still works.
- Color contrast: ring strokes have a 1px translucent black halo so RGBCMY points remain ≥3:1 against any background hue.
- Visual-only speech labeled via the aria-live region and a hidden description list mapping canon → short Japanese gloss.

---

## 9. 裏ルート (inRYOKU hidden state)

Trigger: `summon` followed by `revelation` within 8 s, with logo phase at index 0 (R) at the time of `revelation`'s start, **and** all 6 colors of the `summon` glyph have been visually visible (renderer reports `glyph:complete` for summon).

When matched, `cosmos-bus` emits `'inryoku:reveal'` `{ source: 'logo-speech', combo: ['summon', 'revelation'] }`. Downstream code handles unlock.

The composition is intentionally hard to land by accident: deterministic phase + timing window + visual completion gate.

---

## 10. Module surface (re-stated)

### `logo-speech.js`
```js
export function createLogoSpeech({ bus, audio, effects, getSphere, reducedMotion, scene }): {
  speak(canon, register?, opts?),
  enqueue(canon, register?, opts?),
  interrupt(),
  getCurrent(),
  getQueue(),
  onSpeak(cb),         // sugar over bus.on('speech:start')
  getPhase(),          // { index, color }
  dispose()
}
```

### `logo-canon-resolver.js`
```js
export function resolveCanon(intent, tone, certainty, direction): { canon, register }
```
Pure, no I/O. Throws nothing — invalid args resolve to `{ canon: 'core', register: 'whisper' }`.

### `logo-glyph.js`
```js
export function getGlyph(canon): Glyph
// Glyph = {
//   canon, direction: 'cw'|'ccw', doubleRing: boolean,
//   ticks:  Array<{ tick: 0..11, color: 'R'|'G'|'B'|'C'|'M'|'Y'|null }>,
//   strings: Array<{ from: 0..11, to: 0..11, arc: boolean, color: 'R'|'G'|'B'|'C'|'M'|'Y'|null }>,
//   phaseAdvance: number  // signed integer
// }
export const GLYPHS: Record<string, Glyph>
```

### `logo-speech-renderer.js`
```js
export function createSpeechRenderer({ scene, getSpherePosition, getSphereRadius, reducedMotion }): {
  play(glyph, register, { onComplete }): handle,
  update(dt),
  dispose()
}
```
Renders ring formation on the clock face around the sphere in 3D. Points fade in (per-tick stagger), strings tween from `from` to `to`, hold for register-specific decay, fade out. Multiple concurrent — stack at distinct radii by register.

### `p3_logo_speech_test.html`
Self-contained ESM demo: spawns a logo sphere (re-uses inryoku 3D logo if present, else a procedural sphere), shows 17 canon buttons, register selector, AI form (intent/tone/certainty/direction → resolveCanon → speak). Live queue display. Reduce-motion toggle.

---

## 11. Flow trace — "I doubt this gently"

1. UI form: `intent='doubt'`, `tone='gentle'`, `certainty=0.45`, `direction='inward'`.
2. `resolveCanon` →
   - base for `doubt` w/ cert 0.45 (mid) → `self_question`.
   - tone `gentle` + question-family → keeps `self_question`.
   - direction `inward` is consistent (`self_question` is inward by definition).
   - cert 0.45 in mid band → register stays at default for canon: `hover` is canon default, but tone `gentle` demotes one band → `whisper`.
   - returns `{ canon: 'self_question', register: 'whisper' }`.
3. `logoSpeech.speak('self_question', 'whisper')`:
   - no current → start.
   - getGlyph('self_question') → `{ ticks: [{0,'Y'}], strings: [], doubleRing: false, direction: 'ccw', phaseAdvance: 1 }`.
   - bus.emit('speech:start').
   - audio.play('self_question') → rising minor third.
   - effects.setActiveScene('speaking').
   - body class toggled.
   - renderer.play(glyph, 'whisper'): single Y point at tick 0 fades in around sphere, holds 1600 ms, fades out.
   - on natural end: phaseIndex += 1; bus.emit('logo:phase'); bus.emit('speech:end').
   - effects.setActiveScene(prev) since queue empty.

This is the canonical "soft inward doubt" utterance.
