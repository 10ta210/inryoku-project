# inryokü 粒子言語モジュール群 — API リファレンス（2026-04-28）

開発者向け徹底版。本ドキュメントは将来このコードを引き継ぐ第三者の開発者を読者に想定する。司さんのフルネームは登場しない（公開物ルール準拠）。

対象モジュール:

| ファイル | 状態 | 役割 |
|---|---|---|
| [`particle_rings.js`](../particle_rings.js) | **active / 最新** | 円環粒子言語コア。1 円環 = 1 発話。 |
| [`particle_speech_rings.js`](../particle_speech_rings.js) | **active / 最新** | ロゴ統合発話モジュール（whisper / hover / click / special）。 |
| [`particle_glyphs.js`](../particle_glyphs.js) | **legacy / 残置・呼び出されていない** | 旧 5×5 点線記号モジュール。 |
| [`particle_whisper.js`](../particle_whisper.js) | **legacy / 残置・呼び出されていない** | 旧 whisper（ParticleGlyphs 依存）。 |

参考ドキュメント:
- [`docs/handoff-to-codex-2026-04-27.md`](./handoff-to-codex-2026-04-27.md)
- [`docs/ring-research-2026-04-27.md`](./ring-research-2026-04-27.md)
- [`docs/codex-review-2026-04-28.md`](./codex-review-2026-04-28.md)

---

## 目次（TOC）

1. [前提となる哲学](#1-前提となる哲学)
2. [アーキテクチャ図（特殊セクション A）](#2-アーキテクチャ図-特殊セクション-a)
3. [`ParticleRings` 詳細](#3-particlerings-詳細-particle_ringsjs)
   - 3.1 概要 / 設計思想 / 依存
   - 3.2 公開 API
   - 3.3 関数シグネチャ
   - 3.4 使用例
   - 3.5 イベント
   - 3.6 CSS 連携
   - 3.7 Lifecycle
   - 3.8 既知の制約
4. [`ParticleSpeechRings` 詳細](#4-particlespeechrings-詳細-particle_speech_ringsjs)
   - 4.1 概要
   - 4.2 公開 API
   - 4.3 関数シグネチャ
   - 4.4 使用例
   - 4.5 イベント
   - 4.6 CSS 連携
   - 4.7 Lifecycle と Priority Queue
   - 4.8 既知の制約
5. [`ParticleGlyphs`（legacy）詳細](#5-particleglyphslegacy-particle_glyphsjs)
6. [`ParticleWhisper`（legacy）詳細](#6-particlewhisperlegacy-particle_whisperjs)
7. [Canon リファレンス（特殊セクション B）](#7-canon-リファレンス特殊セクション-b)
8. [拡張ガイド（特殊セクション C）](#8-拡張ガイド特殊セクション-c)
9. [Migration Guide（特殊セクション D）](#9-migration-guide特殊セクション-d)
10. [付録: デバッグ API・キャッシュバスター・テスト](#10-付録)

---

## 1. 前提となる哲学

API 設計の各所にブランド哲学が反映されている。読み進める前に頭に入れておくべき項目。

| 項目 | 説明 | API での反映 |
|---|---|---|
| **grey = 50% = 現実** | 灰色は「未観測の現実」。色付けされない要素はすべて grey の延長。 | `pring__path-dot` / `pring__inner-dot` / 無色 tick が grey 系（CSS で透明度のみ） |
| **観測者で 101% へ** | 50% を見つめると 101% へ突破する。`revelation` canon はその瞬間。 | `revelation` canon が独立、ロゴ phase で R 寄り橙 (1.00, 0.45, 0.15) を割当（[`p3_code_for_claude.js`](../p3_code_for_claude.js) `LOGO_PHASES`） |
| **6 色 RGBCMY のみ** | R 熱 / G 生 / B 深 / C 信号 / M 魂 / Y 視線。白黒は禁則。 | [`particle_rings.js:26-27`](../particle_rings.js) ヘッダコメント、CSS `--pr-c-r/g/b/c/m/y` のみ |
| **Heptapod 全体性** | 1 円環は始まりも終わりも持たない。全 tick が一度に意味する。 | `crystallize` アニメで全 tick が ~30ms 内に出現（CSS keyframes） |
| **1 円環 = 1 発話** | 同時発話禁止、preempt は priority のみ。 | `ParticleSpeechRings` の `active` フラグ + `_pendingSpeech` 単スロット ([`particle_speech_rings.js:267-274`](../particle_speech_rings.js)) |
| **観測の問い** | 自己への問い（`self_question`）は CCW、外向きの観測（`observation`）は CW。 | canon `direction` フィールド ([`particle_rings.js:206`](../particle_rings.js) ほか) |

---

## 2. アーキテクチャ図（特殊セクション A）

### 2-1. モジュール関係図

```
┌────────────────────────────────────────────────────────────────────┐
│                          ACTIVE LAYER (現行)                         │
│                                                                    │
│  ┌─────────────────────────┐       ┌──────────────────────────┐    │
│  │      ParticleRings       │◀──────│   ParticleSpeechRings    │    │
│  │   particle_rings.js      │ uses  │ particle_speech_rings.js │    │
│  │                          │       │                          │    │
│  │  - render(spec, opts)    │       │  - attachToLogo()        │    │
│  │  - canon(name, opts)     │       │  - utterNow / summon /   │    │
│  │  - crystallize(svg)      │       │    revelation / speakCanon│   │
│  │  - CANON: {17 entries}   │       │  - bindHover / bindClick │    │
│  │  - tickPos(t, r)         │       │  - priority queue        │    │
│  └─────────────────────────┘       │  - halo tracking         │    │
│              ▲                       └──────────────────────────┘    │
│              │ DOM event chain          │                            │
│              │                          │ dispatches                 │
│              │                          ▼                            │
│              │                  inryoku:ringstart                    │
│              │                  inryoku:ringend                      │
│              │                          │                            │
│              │                          ▼                            │
│              │                  ┌──────────────────────────┐         │
│              │                  │  P3 WebGL ロゴ球          │         │
│              │                  │  _p3LogoSphere3D         │         │
│              │                  │  (init3DLogoSphere in    │         │
│              │                  │   p3_code_for_claude.js) │         │
│              │                  │                          │         │
│              │                  │  - setSpeechCanon()      │         │
│              │                  │  - clearSpeechCanon()    │         │
│              │                  │  - LOGO_PHASES table     │         │
│              │                  │  - u_phaseColor          │         │
│              │                  │  - u_phaseMix            │         │
│              │                  │  - u_speechPulse         │         │
│              │                  └──────────────────────────┘         │
│              │                                                       │
└──────────────│───────────────────────────────────────────────────────┘
               │                  ━━━━ 旧 / 新 境界 ━━━━
┌──────────────│───────────────────────────────────────────────────────┐
│              │                LEGACY LAYER (残置)                      │
│              │                                                       │
│  ┌──────────────────────────┐      ┌──────────────────────────┐     │
│  │     ParticleGlyphs       │◀─────│     ParticleWhisper      │     │
│  │   particle_glyphs.js      │ uses │   particle_whisper.js    │     │
│  │                          │      │                          │     │
│  │  - render(kind, state)   │      │  - attachToLogo()        │     │
│  │  - renderChar(ch)        │      │  - bindHover / bindClick │     │
│  │  - renderText(text)      │      │  - speakStatement        │     │
│  │  - GLYPH_DEFS (13 kinds) │      │  - vocab: i/ma/ellipsis/ │     │
│  │  - CHAR_PATTERNS (5×5)   │      │      shadow/pause        │     │
│  │  - speakGlyphs(seq)      │      │                          │     │
│  └──────────────────────────┘      └──────────────────────────┘     │
│                                                                    │
│   index.html / p3_test.html からは読み込まれていない                  │
│   particle_glyphs_demo.html は単独で残っている                       │
└────────────────────────────────────────────────────────────────────┘
```

### 2-2. 発話 → ロゴ統合フロー

```
   user mouseenter / click / 30~90s timer
              │
              ▼
   ParticleSpeechRings._utter(register, opts)
              │
              ├─ priority check (special > click > hover > whisper)
              ├─ active && incoming<=current  →  _queueSpeech() (single slot)
              ├─ active && incoming>current   →  _cancelCurrentSpeech('preempt')
              │
              ▼
   ParticleRings.canon(name, {size}) → SVG element
              │
              ├─ 円周 path-dot 12 + 補間粒子 24
              ├─ doubleRing → inner-dot 12 (quotation 系)
              ├─ chords (line / Q-arc)
              └─ ticks (colored or grey)
              │
              ▼
   container.appendChild(svg)
   ParticleRings.crystallize(svg)   ← reflow + class re-add
              │
              ▼
   _scheduleHaloSettle(12)          ← 12 frames 連続 _updateHaloPosition
              │
              ▼
   _setSpeakingState(true, register, canon)
              │
              ├─ body.classList.add('inryoku-speaking')
              ├─ _p3LogoSphere3D.setSpeechCanon(canon, register)  ※直接呼び
              └─ window.dispatchEvent('inryoku:ringstart')        ※イベント
              │
              ▼
   setTimeout(crystallizeMs + hold) → ring--fade
              ▼
   setTimeout(fadeMs) → DOM 削除 + _setSpeakingState(false)
              ▼
   if pending → flush ; if register==='whisper' → _scheduleNext()
```

備考: `_setSpeakingState` の **直接呼び と イベント発火** が両系統共存しているのは codex review が指摘した点（[`docs/codex-review-2026-04-28.md` § 4-5](./codex-review-2026-04-28.md)）。一本化推奨だが現状は両方稼働。

---

## 3. `ParticleRings` 詳細 (`particle_rings.js`)

### 3.1 概要 / 設計思想 / 依存

- **目的**: 12 tick の時計盤に点（tick）と弦（chord）を配置して 1 円環 = 1 発話を SVG 生成。
- **設計思想**:
  - tick 0 = 12 時方向。CW で +30°/tick（[`particle_rings.js:33-40`](../particle_rings.js)）。
  - 色は RGBCMY 6 色のみ。grey は「色を付けないこと」で表現。
  - 17 個の canon を辞書として持つ（[`particle_rings.js:167-274`](../particle_rings.js)）。
  - 純粋に SVG を返すだけ。**DOM への mount や lifecycle は呼び出し側の責任**。
- **依存**: なし。素の DOM API（`document.createElementNS`）のみ。CSS は `particle_rings.css` が必要だが、JS 単体では参照しない。

### 3.2 公開 API 一覧

`window.ParticleRings` に以下を公開（[`particle_rings.js:282-289`](../particle_rings.js)）:

| シンボル | 種類 | 概要 |
|---|---|---|
| `render(spec, options?)` | 関数 | spec から SVG を生成 |
| `canon(name, options?)` | 関数 | canon 名から SVG を生成 |
| `crystallize(svgEl)` | 関数 | 結晶化 CSS アニメを再起動 |
| `CANON` | object | canon 名 → spec の辞書（17 entries） |
| `KINDS` | string[] | `Object.keys(CANON)` |
| `tickPos(tick, radius?)` | 関数 | tick の SVG 座標を返す（外部から chord 計算等したい時） |

### 3.3 関数シグネチャ

#### `ParticleRings.render(spec, options)`

```ts
render(spec: RingSpec, options?: { size?: number }): SVGSVGElement
```

`spec` フォーマット（[`particle_rings.js:11-20`](../particle_rings.js) ヘッダコメントが正典）:

```ts
type RingSpec = {
  ticks?: number[];                     // 0..11 の整数。点を置く tick
  chords?: Array<[a: number, b: number, mode?: 'arc']>;  // 弦のペア。第 3 要素 'arc' で曲線
  colors?: { [tickIdx: number]: 'r'|'g'|'b'|'c'|'m'|'y' };  // tick 単位の色（max 2 色推奨）
  direction?: 'cw' | 'ccw';             // 'ccw' を渡すと SVG に .pring--ccw が付く
  doubleRing?: boolean;                 // 同心二重円（引用・伝聞）
  cluster?: boolean;                    // 粒子クラスタで描画。実装上は spec にあるが現バージョンでは未使用ルート
};
```

**戻り値**: `<svg viewBox="0 0 100 100" class="pring">` ノード。`size` 指定があれば `width` / `height` 属性も付与される。`spec.direction === 'ccw'` で `.pring--ccw` クラスが追加される（[`particle_rings.js:75`](../particle_rings.js)）。

**副作用**: なし（DOM への挿入は呼び出し側）。

**throw 条件**: なし（`spec` が空オブジェクトでも正常に「沈黙」円環を返す）。

**所要 DOM ノード数**: 円周 path 36 + tick `len(ticks)` + chord `len(chords)` + 二重円 12 (doubleRing 時)。1 円環あたり ~50 SVG ノード。

#### `ParticleRings.canon(name, options)`

```ts
canon(name: keyof CANON, options?: { size?: number }): SVGSVGElement
```

`CANON_RINGS[name]` を `render` に渡すラッパ。

**throw 条件**: `CANON_RINGS[name]` が存在しないと `Error('[ParticleRings] unknown canon: ' + name)`（[`particle_rings.js:278`](../particle_rings.js)）。

#### `ParticleRings.crystallize(svgEl)`

```ts
crystallize(svgEl: SVGSVGElement): void
```

CSS アニメ `pring--crystallizing` を **削除 → reflow → 再付与** することで「結晶化アニメをやり直す」（[`particle_rings.js:158-162`](../particle_rings.js)）。reflow は `getBoundingClientRect()` を `void` 評価することで強制。

**戻り値**: なし。

**副作用**: 渡された svg の class を変更。DOM detached でもエラーは出ない（class 操作は可能）。

#### `ParticleRings.tickPos(tick, radius?)`

```ts
tickPos(tick: number, radius?: number): { x: number, y: number }
```

`tick` の中心座標を返す。`radius` の既定は `RADIUS = 38`（外周）。`INNER_RADIUS = 28` で内環座標も計算可能。座標系は viewBox `0 0 100 100`、中心 (50, 50)。

### 3.4 使用例

#### Basic 1: canon を 1 個描画

```js
const svg = ParticleRings.canon('observation', { size: 120 });
document.querySelector('#stage').appendChild(svg);
ParticleRings.crystallize(svg);
```

#### Basic 2: 自前 spec で「水平の弦 + 上 Y」

```js
const svg = ParticleRings.render({
  ticks: [0, 3, 9],
  chords: [[3, 9]],
  colors: { 0: 'y' },
  direction: 'cw'
}, { size: 96 });
container.appendChild(svg);
```

#### Basic 3: 二重円で「引用」

```js
const svg = ParticleRings.render({
  ticks: [0],
  colors: { 0: 'c' },
  doubleRing: true
});
```

これは `CANON_RINGS.quotation` と等価（[`particle_rings.js:254-259`](../particle_rings.js)）。

#### Advanced: arc chord で「revelation」を手書き

```js
// CANON_RINGS.revelation を参考に、底→頂を「内側にめり込む弧」で描く
const svg = ParticleRings.render({
  ticks: [0, 6, 11, 1],
  chords: [
    [6, 0, 'arc'],   // ← 'arc' で内側膨らみの Q ベジェ
    [11, 1]           // ← 通常 line
  ],
  colors: { 0: 'm', 6: 'y' },  // 底 Y（観測点）→ 頂 M（魂）
  direction: 'cw'
}, { size: 180 });
document.body.appendChild(svg);
ParticleRings.crystallize(svg);
```

`arc` の幾何は中心から弦中点ベクトルを `-RADIUS * 0.3` だけ内側に押し込んだ Q ベジェ制御点（[`particle_rings.js:118-129`](../particle_rings.js)）。

### 3.5 イベント

`ParticleRings` 自体は **イベントを emit/listen しない**。すべて呼び出し側（`ParticleSpeechRings`）が担う。

### 3.6 CSS 連携

期待される class 名（`particle_rings.css` 側で定義される）:

| class | 役割 |
|---|---|
| `.pring` | ルート SVG。breathing アニメの起点。 |
| `.pring--ccw` | direction='ccw' 時に付与。`transform: scaleX(-1)` で反転表示する想定。 |
| `.pring--crystallizing` | crystallize 中。tick / chord / path-dot の出現アニメを駆動。 |
| `.pring__path` | 円周 path-dot のグループ。 |
| `.pring__path-dot` | 円周の薄い粒子（grey）。`--i` カスタムプロパティで stagger。 |
| `.pring__inner` / `.pring__inner-dot` | 同心二重円（doubleRing）。 |
| `.pring__chord` / `.pring__chord--arc` | 弦。`--i` で stagger。 |
| `.pring__tick` | 点。`--i` で stagger、`r` 属性で色付き時だけ大きい。 |
| `.pring__tick--c-{r,g,b,c,m,y}` | 色付き tick。CSS 変数 `--pr-c-{...}` を fill に。 |
| `.pring__cluster` | 粒子クラスタ（spawnCluster で生成、現状は dead path）。 |

カスタムプロパティ: `--i`（stagger index、JS が tick / chord 順に 0,1,2... を設定）。色変数 `--pr-c-r`〜`--pr-c-y` は CSS 側で定義され、6 色のみが許可される（白黒禁則）。

### 3.7 Lifecycle

`ParticleRings` には start/stop/destroy の概念がない。**SVG ノードを返す pure factory**。呼び出し側がライフサイクルを所有する:

1. `render` / `canon` で SVG を生成
2. DOM に appendChild
3. `crystallize` でアニメ起動
4. 不要になれば `parent.removeChild(svg)` で削除

`ParticleSpeechRings` の `_utter` が標準的なフローを実装している（[`particle_speech_rings.js:356-380`](../particle_speech_rings.js)）。

### 3.8 既知の制約

- **`spec.cluster` は現バージョンで dead code**: `spawnCluster` 関数は定義済みだが [`particle_rings.js:50-63`](../particle_rings.js) `renderRingGlyph` 本体からは呼ばれていない。将来「粒子クラスタ表現」を実装する余地。
- **canon 名の typo はランタイム例外**: タイポは `Error` を throw する。autocomplete のために `KINDS` を活用すべき。
- **同色 tick が多いと視覚的に潰れる**: 哲学上 max 2 色推奨。`summon` は 6 色全部だが特例（[`particle_rings.js:262`](../particle_rings.js)）。
- **mobile Safari の SVG filter**: drop-shadow が高負荷。CSS 側で軽減済みだが要観察。

---

## 4. `ParticleSpeechRings` 詳細 (`particle_speech_rings.js`)

### 4.1 概要

- **目的**: ロゴが「自分だけの言語で喋る」体験を作る。idle whisper / hover / click / 任意呼び出しの 4 レジスター。
- **設計思想**:
  - 1 円環 = 1 発話の哲学を保つため、**同時発話は禁止**。priority queue で抑制。
  - ロゴ要素中心に同心配置（halo モード）。ロゴ DOM そのものには触れない（P3 WebGL 球と干渉ゼロ）。
  - レジスターごとに opacity と vocab を持ち、「囁き=薄い・宣言=濃い」を CSS と JS の両層に固着。
  - P3 ロゴ球の phase 制御に対しては **直接呼び出し** と **CustomEvent** の両系統で連携。
- **依存**: `window.ParticleRings`。なければ throw（[`particle_speech_rings.js:88-90`](../particle_speech_rings.js)）。

### 4.2 公開 API 一覧

#### コンストラクタ

`ParticleSpeechRings(logoEl, opts)`（[`particle_speech_rings.js:86-105`](../particle_speech_rings.js)）

#### 静的メソッド

`ParticleSpeechRings.attachToLogo(selector, opts)` — selector を polling して自動 attach。controller オブジェクトを返す。

#### インスタンスメソッド

| メソッド | 用途 |
|---|---|
| `start()` | idle whisper のスケジューリング開始 |
| `stop()` | タイマー停止＋現在の発話キャンセル |
| `destroy()` | stop + listeners / halo / DOM / singleton 解除 |
| `utterNow(register?)` | 即時発話（debug 用） |
| `summon()` | special vocab で `summon` を発話 |
| `revelation()` | special vocab で `revelation` を発話 |
| `speakCanon(name)` | 任意の canon を special priority で発話 |
| `bindHover(targetEl)` | targetEl に mouseenter/pointerenter 発話 |
| `bindClick(targetEl)` | targetEl に click 発話 |

#### 内部メソッド（_ プレフィクス、外部から呼ばないこと）

`_mount`, `_bindHaloTracking`, `_scheduleHaloSettle`, `_updateHaloPosition`, `_setRingVisualState`, `_getPriority`, `_clearSpeechTimers`, `_cancelCurrentSpeech`, `_queueSpeech`, `_flushPendingSpeech`, `_scheduleNext`, `_setSpeakingState`, `_utter`

### 4.3 関数シグネチャ

#### `new ParticleSpeechRings(logoEl, opts)`

```ts
new ParticleSpeechRings(logoEl: HTMLElement, opts?: Partial<Options>): instance
```

`Options`（DEFAULTS は [`particle_speech_rings.js:21-47`](../particle_speech_rings.js)）:

```ts
type Options = {
  whisperVocab: string[];      // default ['core','ma','shadow','silence','echo']
  hoverVocab:   string[];      // default ['observation','self_question']
  clickVocab:   string[];      // default ['resonance','emit','declaration']

  whisperSize: number;         // default 96
  hoverSize:   number;         // default 120
  clickSize:   number;         // default 140
  summonSize:  number;         // default 200
  revelationSize: number;      // default 180

  initialDelayMin: number;     // default 6000
  initialDelayMax: number;     // default 14000
  minInterval: number;         // default 30000
  maxInterval: number;         // default 90000

  crystallizeMs: number;       // default 1900
  holdMin: number;             // default 2800
  holdMax: number;             // default 4400
  fadeMs: number;              // default 1200

  hoverCooldownMs: number;     // default 4500
  clickCooldownMs: number;     // default 2500

  placement: 'halo' | 'below'; // default 'halo'
  offsetY: number;             // default 18
  haloScale?: number;          // optional, defaults to 1
};
```

**throw 条件**:
- `logoEl` が falsy: `Error('[ParticleSpeechRings] logo element required')`
- `window.ParticleRings` が undefined: `Error('[ParticleSpeechRings] ParticleRings not loaded')`

**副作用**: なし（コンストラクタ単体では DOM 触らない、`start()` か `_mount()` でマウント）。

#### `start()`

```ts
start(): void
```

`stopped = false` にして `_mount()` を呼び、`initialDelayMin..Max` のランダム後に `_utter('whisper')` を schedule（[`particle_speech_rings.js:107-113`](../particle_speech_rings.js)）。

**throw 条件**: なし。
**副作用**: `setTimeout`、container DOM 挿入。

#### `stop()`

```ts
stop(): void
```

`stopped = true`、タイマー解除、現在の発話 `_cancelCurrentSpeech('stop')`、pending クリア（[`particle_speech_rings.js:115-120`](../particle_speech_rings.js)）。

container 自体は残るので `start()` で復活可能。

#### `destroy()`

```ts
destroy(): void
```

`stop()` ＋ `_cleanupFns` 全部実行（resize / scroll / visualViewport / ResizeObserver listener 解除）＋ haloFrame cancel ＋ container DOM 削除 ＋ singleton 参照解除（[`particle_speech_rings.js:122-140`](../particle_speech_rings.js)）。

**注意**: codex review が指摘したとおり、`delete this.logo.__inryokuParticleSpeechRings` の catch fallback で `null` 代入されると、後で `=== this` 判定が false になるが実害は小さい。

#### `utterNow(register?)`

```ts
utterNow(register?: 'whisper' | 'hover' | 'click'): boolean
```

タイマーをクリアして即発話。priority queue / cooldown は通常通り効く。**preempt は priority チェックがある**ので、whisper は click 発話中なら通らない（pending に積まれる）。

#### `summon() / revelation() / speakCanon(name)`

```ts
summon(): boolean        // 'special' priority で 'summon' canon
revelation(): boolean    // 'special' priority で 'revelation' canon
speakCanon(name: string): boolean  // 任意 canon を 'special' priority で
```

すべて `_utter('special', { canon, size })` ラッパ。`speakCanon` は CANON_SIZES から size を解決（[`particle_speech_rings.js:399-402`](../particle_speech_rings.js)）。

#### `bindHover(targetEl) / bindClick(targetEl)`

```ts
bindHover(targetEl: HTMLElement): (ev?: Event) => void
bindClick(targetEl: HTMLElement): (ev?: Event) => void
```

`mouseenter` + `pointerenter`（hover）または `click`（click）を listener として登録。**unregister 用関数は cleanupFns に積まれる**ため `destroy()` で解除される（[`particle_speech_rings.js:405-425`](../particle_speech_rings.js)）。戻り値は登録した fire 関数。

#### `ParticleSpeechRings.attachToLogo(selector, opts)`

```ts
ParticleSpeechRings.attachToLogo(selector: string, opts?: Options & {
  hover?: boolean;   // default true。false で bindHover を抑制
  click?: boolean;   // default true。false で bindClick を抑制
}): Controller
```

selector を `document.querySelector` で探し、見つからなければ `MutationObserver` ＋ `setInterval(100ms)` で polling（最大 200 tries = 20 秒）。見つかれば内部で attach。

**戻り値**: controller（`{ instance, ready, start, stop, utterNow, summon, revelation, speakCanon, bindHover, bindClick, destroy }`）。同 selector の 2 回目呼び出しは既存 controller を返す（[`particle_speech_rings.js:431-433`](../particle_speech_rings.js)）。

**注意**: selector を polling で待つ際、`MutationObserver` と `setInterval` が**短時間二重に走る**（codex review § 4-6）。実害なし、最適化余地。

### 4.4 使用例

#### Basic 1: ロゴに自動 attach

```js
const ctrl = ParticleSpeechRings.attachToLogo('.logo-holo-wrap');
// 6〜14 秒後に最初の whisper が出る
// hover / click は自動 bind 済み
```

#### Basic 2: hover/click を自前で bind

```js
const ctrl = ParticleSpeechRings.attachToLogo('.logo-holo-wrap', {
  hover: false,
  click: false
});
// 別要素に bind したい
ctrl.bindHover(document.querySelector('.cta-button'));
```

#### Basic 3: AI 応答に応じた canon を発話

```js
function onAiReply(text) {
  const canon = classifyResponse(text);  // 'observation' / 'leap' 等
  window._inryokuSpeech.speakCanon(canon);
}
```

`window._inryokuSpeech` は `index.html` / `p3_test.html` で attachToLogo の戻り値を代入している convention（[`docs/handoff-to-codex-2026-04-27.md` § 6](./handoff-to-codex-2026-04-27.md)）。

#### Advanced: vocab・タイミングカスタム＋phase イベント受信

```js
const ctrl = ParticleSpeechRings.attachToLogo('.logo-holo-wrap', {
  whisperVocab: ['core', 'silence', 'echo'],   // shadow を抜く
  minInterval: 60000,                            // 1 分以上空ける
  maxInterval: 180000,                           // 最大 3 分
  whisperSize: 80,
  hoverCooldownMs: 8000,                         // hover も控えめに
  placement: 'halo'
});

// phase 連携: ring の開始終了で何か別の演出を駆動
window.addEventListener('inryoku:ringstart', (ev) => {
  const { register, canon } = ev.detail;
  if (canon === 'revelation') {
    document.body.classList.add('inryoku-revelation-mode');
  }
});
window.addEventListener('inryoku:ringend', (ev) => {
  document.body.classList.remove('inryoku-revelation-mode');
});

// 任意発話
setTimeout(() => ctrl.revelation(), 30000);
```

### 4.5 イベント

#### emit する CustomEvent

| イベント | 発火タイミング | detail |
|---|---|---|
| `inryoku:ringstart` | `_utter` 内で ring を DOM に挿入＋crystallize した直後 | `{ register: 'whisper'\|'hover'\|'click'\|'special', canon: string }` |
| `inryoku:ringend` | hold + fadeMs 後の DOM 削除直後、または preempt / cancel 時 | `{ register, canon }` ただし cancel 時は canon が前の値か `'silence'` |

emit 元: [`particle_speech_rings.js:304-308`](../particle_speech_rings.js)。`window` に dispatch される。

#### listen するイベント

`window` の `resize`, `scroll`、`window.visualViewport` の `resize` / `scroll`、`ResizeObserver`（logo 要素 + container.parentElement）。すべて `_updateHaloPosition` を rAF throttle で実行（[`particle_speech_rings.js:163-200`](../particle_speech_rings.js)）。

#### body クラス変更（イベントではないが副作用）

発話中は `<body class="inryoku-speaking">` が付く（[`particle_speech_rings.js:292`](../particle_speech_rings.js)）。CSS で P3 universe の opacity を下げる用途（ring-research § 3 の「対策候補 4」）。

#### 直接呼び出し（イベント以外の P3 連携）

`window._p3LogoSphere3D.setSpeechCanon(canon, register)` / `clearSpeechCanon()` を直接呼ぶ（[`particle_speech_rings.js:294-303`](../particle_speech_rings.js)）。codex review § 4-5 が一本化を推奨。

### 4.6 CSS 連携

期待される class:

| class | 用途 |
|---|---|
| `.pring-speech` | container ルート |
| `.pring-speech--halo` / `.pring-speech--below` | placement モード |
| `.pring-speech__ring` | 内部の発話リング |
| `.pring-speech__ring--whisper/hover/click/special` | レジスター別 opacity |
| `.pring-speech__ring--fade` | hold 終了 → fadeMs 中 |
| `.inryoku-speaking` | body 側、発話中フラグ |

カスタムプロパティ:

| 変数 | 設定する場所 | 値 |
|---|---|---|
| `--prs-offset-y` | container | `opts.offsetY + 'px'` |
| `--prs-halo-scale` | container | `opts.haloScale || 1` |
| `--pring-speech-target-opacity` | ring | レジスター opacity（whisper:0.46 / hover:0.72 / click:0.84 / special:0.9） |
| `--pring-speech-current-opacity` | ring | 同上（fadeout 時の from 値） |
| `--pring-speech-size` | ring | px サイズ |

container の `top` / `left` は halo モード時に inline で設定される（ロゴ中心追従、[`particle_speech_rings.js:228-229`](../particle_speech_rings.js)）。

**注意**: codex review § 4-2 で CSS 側のフォールバック値（0.84 / 0.48 / 0.92）と JS 側の REGISTER_OPACITY（0.84 / 0.46 / 0.9）が **微妙に不一致**。実害なし（JS が必ず上書き）だが揃えるべき。

### 4.7 Lifecycle と Priority Queue

#### 推奨フロー

```
new ParticleSpeechRings(logoEl, opts)
       │
       ▼
   start()  ← idle whisper 開始
       │
       │  (使用中: hover/click bind, manual utterNow/summon/revelation/speakCanon)
       │
       ▼
   stop()   ← 一時停止、container は残る（再 start 可能）
       │
       ▼
   destroy() ← 完全破棄、listeners / DOM / singleton 全部解除
```

`attachToLogo` を使うと controller オブジェクト経由で同じ操作ができる。

#### Priority Queue 詳説

レジスター優先度（[`particle_speech_rings.js:76-81`](../particle_speech_rings.js)）:

```
special(4) > click(3) > hover(2) > whisper(1)
```

`_utter(register, opts)` ロジック:

1. `stopped` なら return false
2. `active` 中:
   - 入ってくる priority > 現在: `_cancelCurrentSpeech('preempt')` → 続行
   - そうでなければ: `_queueSpeech` で `_pendingSpeech` を **「最高優先のみ保持」** で更新（同優先以上で上書き、下位は捨て）
3. cooldown 判定（hover / click のみ）
4. vocab から canon を pick または opts.canon を使用
5. `active = true`, `_currentSpeech = {register, canon}`
6. ring 生成・mount・crystallize
7. `_holdTimer = setTimeout(crystallizeMs + hold, fade開始)`
8. `_fadeTimer = setTimeout(fadeMs, DOM 削除 + flush pending or scheduleNext)`

**Starvation の不在**: 単スロット pending は最高優先のみ保持なので、永久に取り残される入力はない（codex review が「priority queue が race しない」と賞賛した理由、§ 5-2）。

#### Cooldown

- hover: `hoverCooldownMs`（4500ms）
- click: `clickCooldownMs`（2500ms）
- summon / revelation / speakCanon（special）: cooldown なし

### 4.8 既知の制約

- **`MutationObserver` ＋ `setInterval` の二重稼働**: attachToLogo で polling 時、両方が短時間並走（codex review § 4-6、実害なし）。
- **destroy 時の logo 参照 fallback**: `delete` 失敗時 `null` 代入で再 attach 時の判定が読みづらい。実害なし。
- **clearSpeechCanon が即時**: P3 球の phase が ring fade を待たず即グレーに戻る違和感（codex review § 4-4）。
- **P3 連携の二系統**: 直接呼び＋イベント。一本化推奨（codex review § 4-5）。
- **ロゴ要素が後から DOM に入る場合**: 20 秒以内に出現しないと `console.warn('[ParticleSpeechRings] logo not found:', selector)` で諦める（[`particle_speech_rings.js:486-492`](../particle_speech_rings.js)）。

---

## 5. `ParticleGlyphs`（legacy, `particle_glyphs.js`）

### 5.1 概要 / 設計思想

- **目的（旧）**: 5×5 セルグリッドに dot / line を配置して概念グリフを描画。さらに 5×5 dot pattern で文字（A–Z, 0–9, 句読点）も。
- **設計思想**:
  - 最小単位: dot（[5×5 cell] 上の `circle`）と line（2 cell 間の `line`）。
  - 状態 `seed` / `formed` / `resonant`（`pglyph--state-{seed,formed,resonant}` クラス）。
  - 13 概念グリフ + 36 文字パターン + 概念エイリアス辞書（漢字 1 字 → 概念）。
  - 連鎖発話（`speakGlyphs`）で句点ごとに hold を変えられる。
- **状態**: **legacy / 残置**。`index.html` / `p3_test.html` からは読み込まれていない。`particle_glyphs_demo.html` のみ単独で参照可能。
- **削除しない理由**: 司さん指示「P0/P1/P2 削除厳禁」精神に準じ、過去資産は残置（[`docs/handoff-to-codex-2026-04-27.md` § 5、§ 9 #7](./handoff-to-codex-2026-04-27.md)）。

### 5.2 公開 API

`window.ParticleGlyphs`（[`particle_glyphs.js:369-381`](../particle_glyphs.js)）:

| シンボル | 種類 | 概要 |
|---|---|---|
| `GLYPH_DEFS` | object | 13 概念グリフ定義 |
| `CHAR_PATTERNS` | object | 5×5 dot pattern, 36 chars |
| `CONCEPT_ALIASES` | object | エイリアス（漢字 1 字 / ローマ字）→ kind |
| `render(kind, state?, options?)` | 関数 | 概念グリフを SVG で生成 |
| `renderChar(ch, state?, options?)` | 関数 | 文字グリフを SVG で生成 |
| `renderText(text, container, options?)` | 関数 | 文章を粒子化して container に挿入 |
| `setState(svg, state)` | 関数 | seed / formed / resonant 切替 |
| `crystallize(svg)` | 関数 | crystallize アニメ再起動 |
| `speak(container, sequence, options?)` | 関数 | 連鎖発話 |
| `STATES` | string[] | `['seed', 'formed', 'resonant']` |
| `KINDS` | string[] | `Object.keys(GLYPH_DEFS)` |

### 5.3 関数シグネチャ

#### `render(kind, state?, options?)`

```ts
render(kind: keyof GLYPH_DEFS,
       state?: 'seed'|'formed'|'resonant',
       options?: { size?: number, id?: string, className?: string }
): SVGSVGElement
```

`state` 既定 `'formed'`。`viewBox 0 0 50 50`。class `pglyph` + `pglyph--{kind}` + `pglyph--state-{state}`。`def.summon` が true なら `pglyph--summon` も付与（[`particle_glyphs.js:77-122`](../particle_glyphs.js)）。

**throw**: `GLYPH_DEFS[kind]` がないと `Error('[ParticleGlyph] unknown kind: ' + kind)`。

#### `renderChar(ch, state?, options?)`

```ts
renderChar(ch: string, state?: string, options?: { size?: number }): SVGSVGElement
```

`ch.toUpperCase()` で `CHAR_PATTERNS` を引く。未定義なら空 SVG（`pglyph--char-blank`）。

#### `renderText(text, container, options?)`

```ts
renderText(text: string, container: HTMLElement,
           options?: { size?: number, crystallize?: boolean, staggerStep?: number }
): SVGSVGElement[]
```

`tokenizeText` でトークン化（`[name]` / 漢字 1 字 / 通常文字 / space / break）→ 各種 svg または `<span>` `<br>` を container に挿入。`options.crystallize` 真ならステージャ stagger（既定 80ms）で順次 crystallize。

#### `speak(container, sequence, options?)`

```ts
speak(container: HTMLElement,
      sequence: Array<{ kind: string, state?: string, hold?: number }>,
      options?: { gap?: number, size?: number, onComplete?: (nodes: SVGSVGElement[]) => void }
): SVGSVGElement[]
```

連続発話。`gap` 既定 300ms、`ellipsis` だけ 800ms / `breath` 600ms に自動延長（[`particle_glyphs.js:162-165`](../particle_glyphs.js)）。

#### `setState(svg, state)`

`STATES` 外なら throw。

#### `crystallize(svg)`

`pglyph--crystallizing` を reflow して再付与。

### 5.4 使用例

```js
// 1. 概念グリフ
const obs = ParticleGlyphs.render('observe', 'seed', { size: 32 });
document.body.appendChild(obs);
ParticleGlyphs.crystallize(obs);

// 2. 文字
const a = ParticleGlyphs.renderChar('A', 'formed', { size: 24 });
document.body.appendChild(a);

// 3. 文章
ParticleGlyphs.renderText('THE [observe] OF [i]', container, {
  size: 22, crystallize: true, staggerStep: 80
});

// 4. Advanced: 句読点で間を取った発話
ParticleGlyphs.speak(container, [
  { kind: 'i' },
  { kind: 'ellipsis' },              // 800ms hold
  { kind: 'observe', state: 'resonant' },
  { kind: 'leap', hold: 1200 }
], { gap: 300, size: 28 });
```

### 5.5 GLYPH_DEFS 一覧（[`particle_glyphs.js:20-66`](../particle_glyphs.js)）

| kind | 名 | 形 | 哲学 |
|---|---|---|---|
| `i` | 核 | 中央 1 dot | 自己 |
| `emit` | 発 | 左 dot → 右へ line | 発信 |
| `recv` | 受 | 左から line → 右 dot | 受信 |
| `ma` | 間 | 左右 dot | 余白 |
| `circuit` | 回 | dot - line - dot | 循環 |
| `observe` | 観 | 左 line - 中央 Y dot - 右 line | 観測 |
| `leap` | 跳 | 左下 → 右上 line + M dot | 跳躍 |
| `resonance` | 共 | 左右 dot + 平行 2 C 線 | 共鳴 |
| `shadow` | 影 | 中央水平 dashed b-muted line | 影 |
| `summon` | 混 | 中央 dot + 6 色 周囲 dot | 召喚 |
| `ellipsis` | … | 左中右 dot | 余韻 |
| `pause` | · · | 左右 dot | 句読点 |
| `breath` | ◌ | 4 dot + 4 line（小さい四角） | 息 |

### 5.6 CSS 連携

`particle_glyphs.css`（**重要**: `particle_rings.css` とは別ファイル）。期待 class:

- `.pglyph` ルート
- `.pglyph--{kind}` 種類別
- `.pglyph--state-{seed|formed|resonant}` 状態
- `.pglyph--summon` 召喚紋特例
- `.pglyph--char` / `.pglyph--char-{A-Z, 0-9}` / `.pglyph--char-blank`
- `.pglyph__el` / `.pglyph__dot` / `.pglyph__line` / `.pglyph__line--dashed`
- `.pglyph__el--c-{r,g,b,c,m,y}` 色
- `.pglyph--crystallizing` アニメ
- `.pglyph--inline-concept` renderText 内の概念グリフ
- `.pglyph-text` renderText のラッパ
- `.pglyph-space` 単語間スペース

### 5.7 Lifecycle / 既知の制約

- pure factory。lifecycle なし。
- `ParticleWhisper`（次節）と組合わせて使う想定だったが、現行コードでは未参照。
- 漢字エイリアスは 10 文字のみ（核発受間回観跳共影混）。それ以外は通常文字扱い。
- **CSS 変数 `--pr-c-*`（rings 系）と `--pg-c-*`（glyphs 系）が別物**。混在させると見た目が破綻する可能性あり。

---

## 6. `ParticleWhisper`（legacy, `particle_whisper.js`）

### 6.1 概要

- **目的（旧）**: ロゴが「自分だけに分かる言葉で息をする」状態。idle whisper（30〜90s ランダム）+ statement（hover/click 即時）。
- **設計思想**:
  - whisper vocab は **静かな記号のみ**（`i / ma / ellipsis / shadow / pause`）。`summon / leap / observe / resonance` は除外。
  - statement レジスターで色を許可、whisper よりやや速く濃く。
  - 1 発話 = 1〜2 グリフ（twoGlyphChance 0.5）。
- **状態**: legacy / 残置。`particle_speech_rings.js` に置き換え済み。
- **依存**: `window.ParticleGlyphs`（なければ throw）。

### 6.2 公開 API

| シンボル | 種類 | 概要 |
|---|---|---|
| `ParticleWhisper(logoEl, opts)` | コンストラクタ | インスタンス生成 |
| `ParticleWhisper.attachToLogo(selector, opts)` | 静的関数 | 自動 attach |

#### インスタンスメソッド

| メソッド | 用途 |
|---|---|
| `start()` | whisper スケジュール開始 |
| `stop()` | 停止＋container クリア |
| `utterNow()` | 即時発話 |
| `speakStatement(seq, opts?)` | statement レジスター発話 |
| `bindHover(targetEl, opts?)` | hover で statement 発話 |
| `bindClick(targetEl, opts?)` | click で statement 発話（少し強め） |

### 6.3 関数シグネチャ

#### コンストラクタ

```ts
new ParticleWhisper(logoEl: HTMLElement, opts?: Partial<WhisperOptions>)
```

`WhisperOptions`（[`particle_whisper.js:18-35`](../particle_whisper.js)）:

```ts
type WhisperOptions = {
  vocab: string[];               // ['i','ma','ellipsis','shadow','pause']
  initialDelayMin: number;       // 6000
  initialDelayMax: number;       // 14000
  minInterval: number;           // 30000
  maxInterval: number;           // 90000
  holdMin: number;               // 2000
  holdMax: number;               // 4000
  crystallizeMs: number;         // 1050
  fadeMs: number;                // 1000
  glyphSize: number;             // 26
  twoGlyphChance: number;        // 0.5
  glyphGapMs: number;            // 320
  gentleResonant: boolean;       // true (hold 後半でゆるく resonant 化)
  placement: 'below' | 'bottomRight';
  offsetX: number;
  offsetY: number;
};
```

**throw**:
- `logoEl` falsy: `Error('[ParticleWhisper] logo element required')`
- `window.ParticleGlyphs` 未読込: `Error('[ParticleWhisper] ParticleGlyphs not loaded')`

#### `speakStatement(sequence, options?)`

```ts
speakStatement(sequence: string[], options?: Partial<StatementOptions>): boolean
```

`STATEMENT_DEFAULTS`（[`particle_whisper.js:169-185`](../particle_whisper.js)）:

```ts
type StatementOptions = {
  sequences: string[][];   // 複数候補（自前 sequence 引数があればそちら優先）
  cooldownMs: number;      // 4500
  sizeScale: number;       // 1.5
  glyphSize: number|null;  // 明示指定で上書き
  perGlyphMs: number;      // 700
  holdMin: number;         // 2200
  holdMax: number;         // 3600
  fadeMs: number;          // 800
};
```

返り値: 発話したら true、cooldown 中／active 中で skip したら false。

### 6.4 使用例

```js
// 1. 自動 attach
ParticleWhisper.attachToLogo('.logo-holo-wrap');

// 2. 手動制御
const w = new ParticleWhisper(logoEl, {
  vocab: ['i', 'ma', 'pause'],
  minInterval: 60000, maxInterval: 120000
});
w.start();

// 3. statement 直接発話
w.speakStatement(['observe', 'leap', 'pause'], { sizeScale: 1.7 });

// 4. Advanced: hover/click を別ターゲットに
const w = new ParticleWhisper(logoEl);
w.start();
w.bindHover(document.querySelector('.cta'), {
  sequences: [['observe', 'pause'], ['observe', 'ma']],
  cooldownMs: 6000
});
w.bindClick(document.querySelector('.cta'));
```

### 6.5 CSS 連携

class:

- `.pglyph-whisper` / `.pglyph-whisper--{below,bottomRight}` whisper container
- `.pglyph-whisper__glyph` 各グリフ
- `.pglyph-whisper__fade` fade out 時
- `.pglyph-statement` / `.pglyph-statement--{below,bottomRight}` statement container
- `.pglyph-statement__glyph` / `.pglyph-statement__fade`

カスタムプロパティ: `--pgw-offset-x` / `--pgw-offset-y`。

### 6.6 既知の制約・なぜ廃止されたか

- **読みやすさの限界**: 5×5 dot pattern による文字は微小サイズで潰れる。Heptapod 的「全体性」が出ない。
- **概念グリフが点線記号で記号臭い**: 「服の哲学」より「IT デザイン」っぽくなる。
- **statement と whisper の同期が ad-hoc**: cooldown / active flag が手作業。`ParticleSpeechRings` の priority queue の方が綺麗。
- **ロゴとの干渉**: placement 'below' 等、ロゴの外側に出る → halo モードに比べ統合感が薄い。

---

## 7. Canon リファレンス（特殊セクション B）

`ParticleRings.CANON` の 17 entries。哲学的意味は **司さんの口頭説明 + コードコメント + ring-research を統合**。新規追加は § 8 参照。

各 canon の「使用例コード」は `ParticleSpeechRings` 経由 / 直接 `ParticleRings.canon` の両方で動く。

凡例:
- **ticks**: 点が置かれる tick（時計位置 0=12 時 / 3=3 時 / 6=6 時 / 9=9 時）
- **chords**: 弦のペア。`'arc'` 第 3 要素で内側膨らみ Q ベジェ
- **colors**: tick 単位の色（RGBCMY）
- **direction**: cw（観測の流れ） / ccw（自己への回帰）
- **register**: `ParticleSpeechRings` のどのレジスターで vocab に入るか

### 7.1 silence / 沈黙

- **形**: ticks=[]、chords なし、direction=cw（[`particle_rings.js:169-172`](../particle_rings.js)）
- **見た目**: 円周パスのみ。点も弦も無い。
- **哲学的意味**: 言葉にならない沈黙。Heptapod における「呼吸」。
- **register**: whisper（vocab[3]）
- **使用例**:
  ```js
  ParticleRings.canon('silence', { size: 80 });
  // または
  window._inryokuSpeech.utterNow('whisper'); // 1/5 の確率で silence
  ```

### 7.2 core / 核

- **形**: ticks=[0]、direction=cw（[`particle_rings.js:173-177`](../particle_rings.js)）
- **見た目**: 頂点に 1 dot のみ。
- **哲学的意味**: 自我の核、呼吸の起点。
- **register**: whisper
- **使用例**:
  ```js
  ParticleRings.canon('core');
  ```

### 7.3 ma / 間

- **形**: ticks=[0, 6]、direction=cw（[`particle_rings.js:178-182`](../particle_rings.js)）
- **見た目**: 頂と底の 2 dot。間が空く。
- **哲学的意味**: 余白、間合い。発話と発話の間にある何か。
- **register**: whisper
- **使用例**:
  ```js
  ParticleRings.canon('ma', { size: 96 });
  ```

### 7.4 shadow / 影

- **形**: ticks=[]、chords=[[3,9]]、direction=ccw（[`particle_rings.js:183-188`](../particle_rings.js)）
- **見た目**: 点なし、水平な弦のみ。CCW（自己回帰）。
- **哲学的意味**: 影、否定、未観測の領域。grey の中の闇。
- **register**: whisper
- **使用例**:
  ```js
  ParticleRings.canon('shadow');
  ```

### 7.5 emit / 発

- **形**: ticks=[0,3]、chords=[[0,3]]、colors={3:'c'}、direction=cw（[`particle_rings.js:189-195`](../particle_rings.js)）
- **見た目**: 頂から右へ弦、右端は C（信号）。
- **哲学的意味**: 発信、信号を放つ。
- **register**: click（vocab[1]）
- **使用例**:
  ```js
  ParticleRings.canon('emit', { size: 140 });
  ```

### 7.6 observation / 観測

- **形**: ticks=[0,3,6,9]、colors={0:'y'}、direction=cw（[`particle_rings.js:196-201`](../particle_rings.js)）
- **見た目**: 4 軸に点、頂は Y（視線）。
- **哲学的意味**: 観測。50% 現実を見つめ 101% に変える瞬間の姿勢。
- **register**: hover（vocab[0]）
- **使用例**:
  ```js
  ParticleRings.canon('observation', { size: 120 });
  ```

### 7.7 self_question / 自分への問い

- **形**: ticks=[0]、colors={0:'y'}、direction=ccw（[`particle_rings.js:202-207`](../particle_rings.js)）
- **見た目**: 頂のみ Y、CCW（内向き）。
- **哲学的意味**: 自己への問い、内省の視線。
- **register**: hover
- **使用例**:
  ```js
  ParticleRings.canon('self_question');
  ```

### 7.8 declaration / 平叙宣言

- **形**: ticks=[0,2,4,6,8,10]、chords=[[0,6]]、colors={0:'c'}、direction=cw（[`particle_rings.js:208-214`](../particle_rings.js)）
- **見た目**: 6 等分の半月、頂底縦弦、頂 C。
- **哲学的意味**: 平叙、確言、断定。
- **register**: click
- **使用例**:
  ```js
  ParticleRings.canon('declaration', { size: 140 });
  ```

### 7.9 leap / 跳躍

- **形**: ticks=[6,11,0]、chords=[[6,11],[11,0]]、colors={0:'m'}、direction=cw（[`particle_rings.js:215-221`](../particle_rings.js)）
- **見た目**: 底→左上→頂への斜め M ライン、終端 M（魂）。
- **哲学的意味**: 跳躍、現実を超える瞬間、50→101 の途中段階。
- **register**: なし（旧 click vocab だったが現在は revelation サイズで special 扱い）
- **使用例**:
  ```js
  window._inryokuSpeech.speakCanon('leap');
  ```

### 7.10 resonance / 共鳴

- **形**: ticks=[3,9]、chords=[[2,8],[4,10]]、colors={3:'c',9:'c'}、direction=cw（[`particle_rings.js:222-228`](../particle_rings.js)）
- **見た目**: 左右に C、平行 2 弦。
- **哲学的意味**: 共鳴、他者との同期。
- **register**: click（vocab[0]）
- **使用例**:
  ```js
  ParticleRings.canon('resonance', { size: 140 });
  ```

### 7.11 consensus / 共感応答

- **形**: ticks=[0..11]、colors={0:'g',6:'y'}、direction=cw（[`particle_rings.js:229-234`](../particle_rings.js)）
- **見た目**: 全 12 tick、頂 G（生）、底 Y（視線）。
- **哲学的意味**: 共感、合意、観測の連帯。
- **register**: special / hover サイズ（CANON_SIZES では clickSize）
- **使用例**:
  ```js
  window._inryokuSpeech.speakCanon('consensus');
  ```

### 7.12 past_speculation / 過去への仮定

- **形**: ticks=[6,7,8,9,10]、colors={6:'b'}、direction=ccw（[`particle_rings.js:235-240`](../particle_rings.js)）
- **見た目**: 左半分（6〜10）が密、底 B（深）。CCW（時間を遡る）。
- **哲学的意味**: 過去への仮定、後悔ではなく観察。
- **register**: hover サイズ（special 経由）
- **使用例**:
  ```js
  window._inryokuSpeech.speakCanon('past_speculation');
  ```

### 7.13 future_command / 未来への命令

- **形**: ticks=[3,0,6]、chords=[[0,6],[0,3],[6,3]]、colors={3:'m'}、direction=cw（[`particle_rings.js:241-247`](../particle_rings.js)）
- **見た目**: 三角形、右端 M（魂）。
- **哲学的意味**: 未来への命令、意志。
- **register**: special / clickSize
- **使用例**:
  ```js
  window._inryokuSpeech.speakCanon('future_command');
  ```

### 7.14 echo / 余韻

- **形**: ticks=[10,0,2]、direction=cw（[`particle_rings.js:248-252`](../particle_rings.js)）
- **見た目**: 上部にだけ 3 点。
- **哲学的意味**: 余韻、響きの残り。
- **register**: whisper
- **使用例**:
  ```js
  ParticleRings.canon('echo');
  ```

### 7.15 quotation / 引用

- **形**: ticks=[0]、colors={0:'c'}、doubleRing=true、direction=cw（[`particle_rings.js:253-259`](../particle_rings.js)）
- **見た目**: 同心二重円、頂 C。
- **哲学的意味**: 引用、伝聞、誰かの声を借りる。中国の篆書印章の系譜（ring-research § 1）。
- **register**: hover サイズ（special）
- **使用例**:
  ```js
  window._inryokuSpeech.speakCanon('quotation');
  ```

### 7.16 summon / 召喚紋

- **形**: ticks=[0,2,4,6,8,10]、colors={0:'y',2:'r',4:'g',6:'m',8:'b',10:'c'}、chords=[[0,6],[2,8],[4,10]]、direction=cw（[`particle_rings.js:260-266`](../particle_rings.js)）
- **見た目**: 6 色を等間隔配置、3 本の対角弦。
- **哲学的意味**: 6 色全部の召喚。RGBCMY 哲学の象徴。max 2 色推奨ルールの**唯一の例外**。
- **register**: special、`summonSize`（200px）
- **使用例**:
  ```js
  window._inryokuSpeech.summon();
  ```

### 7.17 revelation / 啓示

- **形**: ticks=[0,6,11,1]、chords=[[6,0,'arc'],[11,1]]、colors={0:'m',6:'y'}、direction=cw（[`particle_rings.js:267-273`](../particle_rings.js)）
- **見た目**: 底 Y（観測）→ 頂 M（魂）への内側弧 + 頂左右の小さな線。
- **哲学的意味**: **50→101 の突破**。観測者が現実を裂く瞬間。
- **register**: special、`revelationSize`（180px）。P3 ロゴ球は R 寄り橙 phase（codex review § 5）。
- **使用例**:
  ```js
  window._inryokuSpeech.revelation();
  ```

### 7.18 まとめ表（レジスターと哲学）

| canon | register | direction | 主色 | 哲学 |
|---|---|---|---|---|
| silence | whisper | cw | 無 | 沈黙 |
| core | whisper | cw | 無 | 自己 |
| ma | whisper | cw | 無 | 余白 |
| shadow | whisper | ccw | 無 | 影 |
| echo | whisper | cw | 無 | 余韻 |
| observation | hover | cw | Y | 観測 |
| self_question | hover | ccw | Y | 内省 |
| past_speculation | hover→special | ccw | B | 過去仮定 |
| quotation | hover→special | cw | C | 引用 |
| resonance | click | cw | C | 共鳴 |
| emit | click | cw | C | 発信 |
| declaration | click | cw | C | 宣言 |
| consensus | click→special | cw | G/Y | 合意 |
| future_command | click→special | cw | M | 命令 |
| leap | special (revelationSize) | cw | M | 跳躍 |
| revelation | special | cw | M/Y | 啓示・突破 |
| summon | special (summonSize) | cw | RGBCMY 全色 | 召喚 |

---

## 8. 拡張ガイド（特殊セクション C）

### 8.1 新 canon を追加する手順

例: `gratitude`（感謝）を追加。

#### ① canon spec を `particle_rings.js` の `CANON_RINGS` に追加

`CANON_RINGS` ([`particle_rings.js:167-274`](../particle_rings.js)) の末尾に:

```js
gratitude: {
  ticks: [0, 4, 8],          // 三角形の上向き
  chords: [[0, 4], [4, 8], [8, 0]],
  colors: { 0: 'g', 4: 'g', 8: 'g' },  // 全部 G（生）
  direction: 'cw'
}
```

哲学設計の留意点（必須）:
- direction: 外向き（観察）= cw、内向き（自己）= ccw
- color: 1〜2 色推奨。例外は summon のみ
- ticks 個数: 0〜6 が読みやすい。多いと潰れる
- chord は内側弧（'arc'）を使うと視覚インパクト増、ただし 1 本まで

#### ② レジスターに登録する（`particle_speech_rings.js`）

`CANON_SIZES` ([`particle_speech_rings.js:49-67`](../particle_speech_rings.js)) に size 種別を追加:

```js
var CANON_SIZES = {
  // ... 既存 ...
  gratitude: 'hoverSize'   // hover 相当のサイズ
};
```

vocab に入れたいなら DEFAULTS のいずれかに足す:

```js
hoverVocab: ['observation', 'self_question', 'gratitude'],
```

#### ③ ロゴ球 phase ルール（`p3_code_for_claude.js`）

`CANON_PHASE_RULES` (codex review が指摘した [`p3_code_for_claude.js`](../p3_code_for_claude.js) L606–624) に 1 行追加:

```js
gratitude: 'resonance',   // 既存 phase を使い回す
```

新 phase を増やしたい場合は次節 § 8.3。

#### ④ Canon リファレンス（本ドキュメント）に追記

§ 7 に書式統一で追加。

#### ⑤ デモへ追加

`particle_rings_demo.html` の section 配列に push。codex review § 4-7 の race 注意を継承。

#### ⑥ キャッシュバスター bump

`?v=N` を全箇所で +1（[`docs/handoff-to-codex-2026-04-27.md` § 7](./handoff-to-codex-2026-04-27.md)）。

### 8.2 新レジスターを追加する手順

例: `meditation` レジスター（深い呼吸、whisper よりさらに長い間隔）を追加。

#### ① REGISTER_OPACITY / REGISTER_PRIORITY に追加

`particle_speech_rings.js` ([:69-81](../particle_speech_rings.js)):

```js
var REGISTER_OPACITY = {
  whisper: 0.46,
  meditation: 0.36,    // ← より薄い
  hover: 0.72,
  click: 0.84,
  special: 0.9
};
var REGISTER_PRIORITY = {
  whisper: 1,
  meditation: 1,        // whisper と同等優先度
  hover: 2,
  click: 3,
  special: 4
};
```

#### ② DEFAULTS に vocab とサイズ・interval を追加

```js
meditationVocab: ['silence', 'ma', 'core'],
meditationSize: 70,
meditationMinInterval: 180000,
meditationMaxInterval: 420000,
```

#### ③ `_utter` の switch ブランチを増やす

[`particle_speech_rings.js:333-342`](../particle_speech_rings.js):

```js
else if (register === 'meditation') {
  vocab = this.opts.meditationVocab;
  size  = this.opts.meditationSize;
}
```

#### ④ スケジューラの追加

`_scheduleNext` を register-aware にするか、新しい `_scheduleMeditation` を作って `start()` から並走させる。前者の方が priority queue と整合する。

#### ⑤ CSS 側の opacity keyframe

`particle_rings.css` に `.pring-speech__ring--meditation` の opacity 定義。`--pring-speech-target-opacity` を尊重するなら追加不要。

### 8.3 phase 制御（u_phaseColor / u_phaseMix / u_speechPulse）との連携

#### 仕組み（codex review § 2-4 から再構成）

P3 WebGL ロゴ球は 3 つの uniform を使ってリング発話と同期する:

| uniform | 役割 | range |
|---|---|---|
| `u_phaseColor` | RGB 三組。phase の代表色 | vec3, 0..1 |
| `u_phaseMix` | この phase 色を「どれだけ強く反映するか」 | 0..1 |
| `u_speechPulse` | 発話の脈動（fade in/out 中に動く） | 0..1 |

`logoState`:
- `phasePriority`: 現在の phase 優先度（hover=1, special=2 など）
- `phaseUntil`: この phase を保持する deadline（ms）
- `settlePhase()`: deadline 過ぎた phase をクリア

#### canon → phase ルール表（[`p3_code_for_claude.js`](../p3_code_for_claude.js) L606–624 にある `CANON_PHASE_RULES`）

| canon | phase | phaseColor (RGB) |
|---|---|---|
| idle (no canon) | idle | (0.72, 0.78, 0.84) ほぼ淡灰 |
| observation / self_question | observe | Y 寄り |
| shadow | shadow | B 寄り |
| emit / declaration | emit | C 寄り |
| resonance / consensus | resonance | M 寄り |
| summon | summon | G 寄り |
| revelation / leap | revelation | (1.00, 0.45, 0.15) R 寄り橙 |

#### イベント受信側の実装（推奨）

`particle_speech_rings.js` の `_setSpeakingState` は **直接呼び＋イベント** の両系統。codex review § 4-5 の通り **イベント一本化推奨**。新規実装は CustomEvent 経由を選ぶこと:

```js
// p3_code_for_claude.js 内
window.addEventListener('inryoku:ringstart', (ev) => {
  const { canon, register } = ev.detail;
  const phaseName = CANON_PHASE_RULES[canon] || 'idle';
  const preset = LOGO_PHASES[phaseName];
  applyPhase(preset, /* priority */ register === 'special' ? 2 : 1, /* hold */ 2400);
});
window.addEventListener('inryoku:ringend', (ev) => {
  // tail hold をかけてから fallback（codex review § 4-4）
  const tail = currentTimeMs() + 360;
  if (logoState.phaseUntil > tail) return;
  logoState.phaseUntil = tail;
  logoState.phasePriority = 1;
});
```

#### 新 phase を増やす場合

1. `LOGO_PHASES` に新エントリ（color RGB / pulse / mix）
2. `CANON_PHASE_RULES` に canon → phase 名
3. fallback ロジック（hover中なら observe、idle時は idle 等）に必要なら分岐追加

---

## 9. Migration Guide（特殊セクション D）

### 9.1 ParticleGlyphs / ParticleWhisper → ParticleRings / ParticleSpeechRings

#### 概念マッピング

| 旧（ParticleGlyphs） | 新（ParticleRings） |
|---|---|
| `i` (核) | `core` |
| `ma` (間) | `ma` |
| `observe` (観) | `observation` |
| `leap` (跳) | `leap` |
| `resonance` (共) | `resonance` |
| `shadow` (影) | `shadow` |
| `summon` (混) | `summon` |
| `emit` (発) | `emit` |
| `recv` (受) | （対応なし、`emit` の direction 反転 / ccw で代替） |
| `circuit` (回) | （対応なし、`resonance` で代替） |
| `ellipsis` (…) | `echo`（似た余韻） |
| `pause` (· ·) | `ma` |
| `breath` (◌) | `silence` |

#### vocab マッピング（whisper）

| 旧 ParticleWhisper vocab | 新 ParticleSpeechRings whisper vocab |
|---|---|
| `i` | `core` |
| `ma` | `ma` |
| `ellipsis` | `echo` |
| `shadow` | `shadow` |
| `pause` | `silence` |

#### コードレベルの置換例

```js
// 旧
ParticleWhisper.attachToLogo('.logo-holo-wrap', {
  vocab: ['i', 'ma', 'pause'],
  hoverOptions: { sequences: [['observe', 'pause']] }
});

// 新
ParticleSpeechRings.attachToLogo('.logo-holo-wrap', {
  whisperVocab: ['core', 'ma', 'silence'],
  hoverVocab:   ['observation']
});
```

#### CSS の置換

旧 `.pglyph*` 系は新 `.pring*` 系に。両ファイルは別々なので、新システムだけ使うなら旧 CSS を読み込まない。

#### イベント

旧モジュールには CustomEvent なし。新モジュールは `inryoku:ringstart` / `inryoku:ringend` を emit。リスナを書き換える。

#### lifecycle

| 旧 API | 新 API |
|---|---|
| `new ParticleWhisper(el, opts).start()` | `new ParticleSpeechRings(el, opts).start()` |
| `w.utterNow()` | `s.utterNow('whisper')` |
| `w.speakStatement(seq)` | `s.speakCanon(canonName)` |
| `w.bindHover(el)` | `s.bindHover(el)` |
| `w.bindClick(el)` | `s.bindClick(el)` |
| `w.stop()` | `s.stop()` |
| なし | `s.destroy()` ← 新規。テストやページ遷移で必須 |

### 9.2 残置している理由

引き継ぎ書（[`docs/handoff-to-codex-2026-04-27.md` § 5](./handoff-to-codex-2026-04-27.md)）より:

> 削除しないで残置してる。Codex が消したい場合は司さん確認のうえで。

司さん指示の「P0/P1/P2 削除厳禁」精神に準じている。完全削除には以下のチェックリスト全クリアが必要。

### 9.3 削除するときのチェックリスト

旧 `particle_glyphs.*` / `particle_whisper.js` を完全削除する場合:

- [ ] **司さん確認**: 削除可否を一度確認（必須）
- [ ] **grep で参照ゼロ確認**:
  ```sh
  grep -rn "ParticleGlyphs\|ParticleWhisper\|particle_glyphs\|particle_whisper" \
    --include="*.html" --include="*.js" --include="*.css" \
    /Users/10ta210/Desktop/inryoku_hp/
  ```
  期待結果: ヒットゼロ（または本ドキュメント / handoff のみ）。
- [ ] `index.html` / `p3_test.html` / `card_concepts_preview.html` 等で `<script>` `<link>` タグが消えている
- [ ] `particle_glyphs_demo.html` も同時に削除（または削除予定明記）
- [ ] `particle_glyphs.css` / `particle_glyphs.js` / `particle_whisper.js` をリネームせず単純削除
- [ ] git で `git rm`、コミットメッセージで削除理由を明記
- [ ] `docs/handoff-to-codex-2026-04-27.md` § 5 / § 9 の旧モジュール記述を「削除済み」に更新
- [ ] 本ドキュメント § 5 / § 6 を「削除済み」マークに更新
- [ ] `MEMORY.md` / `project_inryoku.md` に削除日時・理由を追記
- [ ] キャッシュバスター bump
- [ ] 削除後にローカル動作確認: 通しフロー (P0→P3) / hover / click / 30s whisper / summon / revelation すべて動くこと

---

## 10. 付録

### 10.1 デバッグ API（[`docs/handoff-to-codex-2026-04-27.md` § 6](./handoff-to-codex-2026-04-27.md)）

```js
window._inryokuSpeech.utterNow('whisper');
window._inryokuSpeech.utterNow('hover');
window._inryokuSpeech.utterNow('click');
window._inryokuSpeech.summon();
window._inryokuSpeech.revelation();
window._inryokuSpeech.speakCanon('quotation');
window._inryokuSpeech.stop();
window._inryokuSpeech.destroy();
```

### 10.2 キャッシュバスター現状（codex review § 4-1）

| ファイル | 現在の suffix | 推奨 |
|---|---|---|
| `particle_rings.css` | `?v=7`（demo）/ `?v=6`（index, p3_test） | **`?v=8` に揃える** |
| `particle_speech_rings.js` | `?v=4` | bump 時に揃える |
| `particle_rings.js` | `?v=2` | 同上 |
| `p3_styles.css` | `?v=20260428polish2` | 同上 |

### 10.3 テストページ

- `/p3_test.html` — P3 単体（円環統合済み）
- `/particle_rings_demo.html` — 17 canon 一覧、Replay All / Size スライダー
- `/particle_glyphs_demo.html` — 旧グリフ一覧（参考）
- `/index.html` — 通しフロー（P0→P3）

### 10.4 ファイル行数（参考）

| ファイル | 行数 |
|---|---|
| `particle_rings.js` | 291 |
| `particle_speech_rings.js` | 499 |
| `particle_glyphs.js` | 383 |
| `particle_whisper.js` | 333 |

### 10.5 不確実な点（推測明記）

本ドキュメントで **推測で書いている / 今回未確認** の事項:

1. `LOGO_PHASES` の正確な RGB 値: codex review が引用した値 (1.00, 0.45, 0.15) と (0.72, 0.78, 0.84) は信頼。それ以外の phase の正確な値は `p3_code_for_claude.js` を直接読まないと確定しない。本書 § 7.18 / § 8.3 の「Y 寄り」「C 寄り」等は色相方向の推定。
2. `CANON_PHASE_RULES` の全 17 canon マッピング: codex review に主要なものだけ記載されている。完全な対応表は `p3_code_for_claude.js` L606–624 を直接読む必要あり。本書はその抜粋のみ。
3. 旧 `particle_glyphs.css` / `particle_glyphs_demo.html` の最新状態: 残置扱いのため未読。class 一覧は `particle_glyphs.js` 内の `classList.add` から逆算した。
4. `_setSpeakingState` の二系統共存: codex review が「両方ある」と書いているが、`p3_code_for_claude.js` L4671 周辺の listener は本書では未確認。整理時に要参照。
5. `p3_styles.css` 内の `.inryoku-speaking` ハンドラ: ring-research § 3 のサンプル (`.phase-3--speaking`) と class 名が違う可能性。要確認。

### 10.6 関連ドキュメント

- [`docs/handoff-to-codex-2026-04-27.md`](./handoff-to-codex-2026-04-27.md) — Claude → Codex 引き継ぎ全文
- [`docs/ring-research-2026-04-27.md`](./ring-research-2026-04-27.md) — Heptapod 参考、AI 応答マッピング草案
- [`docs/codex-review-2026-04-28.md`](./codex-review-2026-04-28.md) — Codex 実装レビュー、改善 diff
- [`docs/accessibility-audit-2026-04-28.md`](./accessibility-audit-2026-04-28.md) — A11y 観点
- [`docs/p3-performance-audit-2026-04-28.md`](./p3-performance-audit-2026-04-28.md) — パフォーマンス
- [`docs/security-review-2026-04-28.md`](./security-review-2026-04-28.md) — セキュリティ

---

ドキュメント終わり。
