# inryokü UX Copy Style Guide

**Status**: canonical (2026-05-12)
**Scope**: every user-visible string in inryoku_hp — UI labels, HUDs,
overlays, announcements, error states, button text, help dialogs.
**Source of truth**: Japanese. English is faithful translation.

---

## 1. Voice in one sentence

> 観測者がぽつりと呟いた言葉のように。

Sparse. Observational. Philosophical undertone — even on a mute button.
Never promotional, never decorative, never apologetic.

If a string sounds like it could be on any SaaS dashboard, it is wrong.

---

## 2. Five voice principles

1. **少ない方が深い** — One word beats three. "観測" beats "観測を開始する".
2. **観測の言葉、命令の言葉ではない** — Describe state, do not bark
   instructions. "静寂" (a state) instead of "MUTE" (a command).
3. **白黒禁則 in copy too** — Avoid binary ON / OFF framings. Both poles
   should sit within grey, both should sound observed, not toggled.
4. **JP が原典、EN は翻訳** — Write JP first. Translate down to EN —
   never add information EN that JP does not carry. EN is never the
   inventive draft.
5. **数は正確に、形容は控えめに** — "観測 73%" not "high". Numbers carry
   weight; adjectives leak it.

---

## 3. Vocabulary

### Preferred (use these)

| 日本語 | English | Why |
|---|---|---|
| 観測 | observation | core verb of the site |
| 静寂 | silence | mute-state without imperative |
| 始める | begin | softer than "start" / "launch" |
| 触れる | touch | discovery, hover, near |
| 灯す / 灯る | kindle / kindled | bring attention to something subtle |
| 揺れる | sway | for ambient / drifting state |
| 場面 | scene | for behavior states |
| 振る舞い | behavior | for particle behavior id |
| 共鳴 | resonance | canon term |
| 啓示 | revelation | canon term |
| グレーの中に虹 | the rainbow within grey | brand tagline |
| 見えないものの可視化 | making the invisible visible | mission |
| 円環 | ring | speech ring, language |
| 粒子 | particle | always 粒子, never "ドット" "点" |
| 50→101 | 50→101 | always with arrow, never "fifty to a hundred and one" |
| 哲学を纏う | philosophy worn | brand line |

### Avoided (do not use)

| Don't write | Reason | Write instead |
|---|---|---|
| ACTIVATE / START NOW / GO | shouting / SaaS | 始める / 観測する |
| Click here / タップしてください | infantilising | 触れる / 観測へ |
| Submit / 送信 (where avoidable) | transactional | 届ける / 渡す |
| OK / Cancel (EN UI) | generic | 閉じる / 戻る / やめる |
| Awesome / amazing / nice | marketing flavor | (delete) |
| Are you sure? | nag | (rephrase as observation) |
| Loading… | generic | 観測の準備 / 灯火準備中 |
| Error / Oops / Sorry | apologetic | 観測できませんでした |
| FREE / NEW / 限定 | retail bark | (delete) |
| 100% (as hit state) | violates 50→101 canon | 99% then wraps to 50% |
| emoji of any kind | tone clash | (delete) |
| ! at end of UI string | tone clash | (use period or none) |

### Numbers and percentages

- `観測 NN%` — always two-digit padded except for `101%` and `1%`.
- `100%` **must never appear**; `99%` wraps to `50%`.
- `101%` is the only above-100 state — appears on revelation only,
  with the special label `101% は無い、しかし観測された`.
- `+1%` is allowed in event logs.

---

## 4. Tone examples (do / don't)

### Mute button
- Do: `静寂` (state). Or `観測 → 静寂` on press.
- Don't: `MUTE`, `音を消す`, `OFF`.

### Microphone
- Do: `マイクで吹く` / `マイク停止`
- Don't: `Start microphone`, `🎙 ON`.

### Audio gesture overlay
- Do (JP): `触れて、観測を始める`
- Do (EN): `Touch to begin observing`
- Don't: `TAP TO START`, `Click here to enable audio`.

### Help dialog
- Do title: `操作 / Controls` (JP first, slash, EN, parallel).
- Do entry: `M — 静寂と観測の切替`
- Don't: `Press M to mute audio`.

### Error
- Do: `WebGL が見つかりません。観測の窓が開きません。`
- Don't: `Error: WebGL not supported. Please update your browser.`

### Reduce-motion notice
- Do: `動きを抑えて観測しています。`
- Don't: `Reduced motion is on.`

---

## 5. JP / EN parallel patterns

| Pattern | JP | EN |
|---|---|---|
| State label | 観測中 | observing |
| Action verb (gentle) | 始める / 触れる | begin / touch |
| Toggle-off state | 静寂 | silence |
| Toggle-on state | 観測 | observing |
| Announcement | 場面が discovery に変わりました | scene changed to discovery |
| Numeric | 観測 73% | observation 73% |
| Canon kanji first occur | 観測 (kansoku) | observation |
| Canon kanji thereafter | 観測 | observation |

EN never adds adjectives. If JP is one word, EN is one word.

---

## 6. The 17 canon — kanji + romaji + 1-line

First mention per page: `観測 (kansoku)`. Thereafter: `観測`.

| canon id | 日本語 | romaji | one-line |
|---|---|---|---|
| silence | 沈黙 | chinmoku | 鳴らないことで鳴る音 |
| core | 中心 | chūshin | 引力の起点 |
| ma | 間 | ma | 音と音の間にある重力 |
| shadow | 影 | kage | 光が落とした残像 |
| emit | 放出 | hōshutsu | 内側から外へ抜ける粒子 |
| observation | 観測 | kansoku | +1% の引き金 |
| self_question | 自問 | jimon | 答える前にひらく問い |
| declaration | 宣言 | sengen | 一度だけ強く立てる言葉 |
| leap | 跳躍 | chōyaku | 段を踏まずに次へ行く |
| resonance | 共鳴 | kyōmei | 三つの音が同じ場所を指す |
| consensus | 合意 | gōi | 違う色が同じ円に並ぶ |
| past_speculation | 過去推測 | kakosuisoku | 過ぎたものを逆から鳴らす |
| future_command | 未来命令 | miraimei | まだ来ない時間への指示 |
| echo | 反響 | hankyō | 戻ってきた自分の声 |
| quotation | 引用 | in'yō | 他者の声を借りて立つ |
| summon | 召喚 | shōkan | 見えないものを呼ぶ |
| revelation | 啓示 | keiji | 50% を 101% に裏返す瞬間 |

---

## 7. Scene labels (behavior pill)

| id | JP | EN |
|---|---|---|
| idle_static / breathing | 静止 | idle |
| breathing_sphere | 呼吸 | breathing |
| attractor_hover | 発見 | discovery |
| ring_resonance | 発話 | speaking |
| convergence_glyph | 文字 | glyph |
| light_bridge_accent | 跳躍 | leap |
| torus / rainbow | 虹環 | rainbow |
| yinyang | 陰陽 | yin-yang |
| storm | 嵐 | storm |

Pills are short. Aria-labels expand: `aria-label="場面：発話 / scene: speaking"`.

---

## 8. HUD labels

| Field | JP | EN |
|---|---|---|
| scene | 場面 | scene |
| behavior | 振る舞い | behavior |
| particles | 粒子 | particles |
| fps | fps | fps |
| canon | 円環 | canon |
| reduce | 静音 | reduce |
| tier | 階 | tier |
| phase | 相 | phase |
| state | 状態 | state |
| audio | 音 | audio |
| field | 場 | field |
| pulses | 鼓動 | pulses |

`fps` stays lowercase Latin in both JP and EN — it is the universal
shorthand and lengthening it loses information.

---

## 9. Skip link, errors, help

### Skip link
- JP: `本文へ移動`
- EN: `Skip to content`

### WebGL unsupported
- JP: `WebGL が見つかりません。観測の窓が開きません。`
- EN: `WebGL is not available. The observation window will not open.`

### AudioContext blocked
- JP: `音はまだ始まっていません。一度触れてください。`
- EN: `Audio has not begun. Touch the screen once.`

### Mic denied
- JP: `マイクの許可が下りませんでした。声以外でも観測できます。`
- EN: `The microphone was not permitted. You can observe without your voice.`

### Reduce-motion notice
- JP: `動きを抑えて観測しています。`
- EN: `Observing with reduced motion.`

### Help dialog title
- JP: `操作`
- EN: `Controls`

---

## 10. Do / don't snippets

```
DON'T: "Click here to start the experience!"
DO:    JP: 触れて、観測を始める
       EN: Touch to begin observing

DON'T: "Audio: ON / OFF"
DO:    JP: 観測 / 静寂
       EN: observing / silence

DON'T: "Error: failed to load."
DO:    JP: 観測できませんでした。
       EN: Observation did not begin.

DON'T: "100%! You did it!"
DO:    JP: 99% — もう一度観測すると 50% から始まる。
       EN: 99% — once more, and it begins again from 50%.

DON'T: "Welcome to inryokü!"
DO:    JP: グレーの中に虹がある。
       EN: The rainbow lives within grey.
```

---

## 11. Where this guide is enforced

- `tests/copy/voice.test.mjs` — programmatic checks
  (banned tokens, required tokens, JP-only-canon).
- `i18n.json` — new keys must follow this guide.
- Code review: any inline string in `*.html` / `cosmos-*.js` must
  reference an i18n key or be flagged.

Files this guide governs:
- `p3_unified_test.html`, `p3_effects_test.html`, `p3_audio_test.html`
- `p1_upgrade_preview.html`, `p2_upgrade_preview.html`
- `p3_logo_speech_test.html`, `transitions_test.html`
- `cosmos-percentage-hud.js`, `cosmos-integration.js`,
  `cosmos-audio.js`, `cosmos-a11y.js`

Out of scope for this wave (flag for wave 4):
- `behaviors/*` — internal labels surface via meta.label;
  not edited here.
- `cosmos-effects.js`, `cosmos-layer.js` — visual logic, no copy here.
