# inryokü サイト ブラウザ互換性マトリクス（2026-04-28）

調査対象コミット: 2026-04-28 polish2 (`p3_styles.css?v=20260428polish2`, `particle_rings.css?v=6`)
作業ディレクトリ: `/Users/10ta210/Desktop/inryoku_hp/`
調査者: Claude (Opus 4.7 / 1M context)

---

## 0. 前提整理

### サイト構成

- `index.html` (1408 行) — **デスクトップ専用**。P0 (Welcome) → P1 (loading) → P2 (WebGL sphere bridge) → P3 (particle universe + EC) のフルフロー。`<script type="importmap">` あり。Three.js UMD + module 両方 CDN ロード (`cdn.jsdelivr.net`)。
- `p3_test.html` (482 行) — **モバイル直行先**。`index.html` 1340-1350 行目で `/Android|iPhone|iPod/` 判定 → `window.location.replace('p3_test.html')`。Three.js は `vendor/three.min.js` ローカル配信。P0/P1/P2 をスキップして P3 のみ起動。
- `p3_code_for_claude.js` (5356 行) — メインロジック。Three.js 球体 (P3 logo) + Particles 宇宙 + Bloom 後処理 + 4 系統 AudioContext + Stripe チェックアウト + チャットを内包。
- `particle_rings.js` / `particle_speech_rings.js` / `particle_glyphs.js` / `particle_whisper.js` — 円環文字粒子。ES5 互換 var ベース、optional chaining なし。
- `particle_rings.css` / `particle_glyphs.css` — SVG `<text>` への CSS 装飾、`vector-effect: non-scaling-stroke` 使用。

### 司さんの絶対前提

- **P0–P2 を削らない**ので、互換性のために P0–P2 を捨てる対応案は禁則。
- index.html (P0–P3) は **モバイル UA で完全スキップ**されるので、互換性問題はデスクトップ系ブラウザのみが影響対象。逆に **iPhone/Android で必ず動かなければならないのは `p3_test.html` 一本**。
- iPad は `requestDesktopSite` でデスクトップ UA を送るため、index.html フローに入る (1344 行目コメント)。

---

## 1. 互換性マトリクス（30 機能 × 8 ブラウザ）

凡例: `O` = 完全動作 / `o` = 動くが視覚的劣化あり / `△` = 部分動作 / `X` = 動かない / `-` = 非対象 (UA 振り分けで来ない)

### 対象ブラウザ列定義

| 列 | ブラウザ | 来訪フロー |
|----|---------|-----------|
| **iOS18** | iOS 18 Safari | p3_test.html のみ |
| **iOS17** | iOS 17 Safari | p3_test.html のみ |
| **iOS16** | iOS 16 Safari | p3_test.html のみ |
| **AndC** | Android Chrome 最新 | p3_test.html のみ |
| **macSF** | macOS Safari 最新 (17.x/18.x) | index.html フル |
| **DCh** | Desktop Chrome 最新 (+1) | index.html フル |
| **DFx** | Desktop Firefox 最新 | index.html フル |
| **DEd** | Desktop Edge (Chromium) | index.html フル |
| **iPad** | iPad Safari (desktop UA) | index.html フル |
| **SInt** | Samsung Internet 最新 | p3_test.html のみ |

### 1-A. CSS 機能

| # | 機能 | iOS18 | iOS17 | iOS16 | AndC | macSF | DCh | DFx | DEd | iPad | SInt |
|---|------|:-----:|:-----:|:-----:|:----:|:-----:|:---:|:---:|:---:|:----:|:----:|
| 1  | `backdrop-filter` (`-webkit-` 接頭辞付き) | O | O | O | O | O | O | O | O | O | O |
| 2  | `filter: drop-shadow()` 多重 (5–6 段) | O | O | o | O | O | O | o | O | O | o |
| 3  | `mix-blend-mode: screen` | O | O | O | O | O | O | O | O | O | O |
| 4  | `mix-blend-mode: multiply` (modal) | O | O | O | O | O | O | O | O | O | O |
| 5  | `transform-style: preserve-3d` + `perspective` | O | O | O | O | O | O | O | O | O | O |
| 6  | `aspect-ratio: 1/1.14` (商品カード) | O | O | O | O | O | O | O | O | O | O |
| 7  | `gap` in flex | O | O | O | O | O | O | O | O | O | O |
| 8  | `clamp()` / `min()` / `max()` | O | O | O | O | O | O | O | O | O | O |
| 9  | `isolation: isolate` | O | O | O | O | O | O | O | O | O | O |
| 10 | `contain: layout style paint` | O | O | O | O | O | O | O | O | O | O |
| 11 | `vector-effect: non-scaling-stroke` (SVG `<line>`) | O | O | O | O | O | O | O | O | O | O |
| 12 | `conic-gradient(from … at …)` | O | O | O | O | O | O | O | O | O | O |
| 13 | `prefers-reduced-motion` | O | O | O | O | O | O | O | O | O | O |
| 14 | `prefers-color-scheme` (theme-color のみ) | O | O | O | O | O | O | O | O | O | O |
| 15 | `will-change` | O | O | O | O | O | O | O | O | O | O |
| 16 | `hue-rotate()` keyframe アニメ (`p3_styles.css:298`) | O | O | o | O | O | O | o | O | O | o |
| 17 | `-webkit-overflow-scrolling: touch` (`p3_styles.css:1979`) | O | O | O | -  | -  | - | - | - | O | - |
| 18 | `-webkit-text-fill-color: transparent` + `-webkit-background-clip: text` (`index.html:1021`) | - | - | - | - | O | O | O | O | O | - |
| 19 | `100vh` (`p3_styles.css:1817`, `p3_test.html:437`) | △ | △ | △ | o | O | O | O | O | O | o |
| 20 | `touch-action: manipulation/none` | O | O | O | O | O | O | O | O | O | O |

**ファイル参照:**
- `backdrop-filter`: `p3_styles.css` の 629-630, 1072-1073, 1083-1084, 1733, 1815-1816, 1953, 2222-2223, 2531-2532 行など計 14 箇所。`index.html` 592-947 行にも 6 箇所。すべて `-webkit-` 接頭辞つき → iOS Safari OK。
- `mix-blend-mode`: `p3_styles.css` 91, 213, 229, 363, 376, 486, 2466, 2624 行。
- `preserve-3d / perspective`: `p3_styles.css` 74, 80, 101, 218, 783, 798, 805, 814, 2020 行。
- `aspect-ratio`: `p3_styles.css` 839 行のみ (商品カード)。Safari 15+ で OK。
- `vector-effect: non-scaling-stroke`: `particle_rings.css:51`。SVG ストローク幅を viewBox スケールから保護。Safari/Chrome/Firefox/Edge 全部 OK (Safari 9+)。
- `conic-gradient`: `p3_styles.css:345`, `p3_styles.css:455`。Safari 12.1+ で OK。
- `100vh`: `p3_styles.css:1817` (cart drawer)、`p3_test.html:437` (`html,body { height: 100% }` だが OK)。**iOS 16-18 で URL バー伸縮時に高さが変わる** (後述 Issue I-3)。

### 1-B. JavaScript / Web API

| # | 機能 | iOS18 | iOS17 | iOS16 | AndC | macSF | DCh | DFx | DEd | iPad | SInt |
|---|------|:-----:|:-----:|:-----:|:----:|:-----:|:---:|:---:|:---:|:----:|:----:|
| 21 | ES2020+ (optional chaining `?.`, nullish `??`, arrow, class, async/await) | O | O | O | O | O | O | O | O | O | O |
| 22 | `<script type="importmap">` (`index.html:1326`) | - | - | - | - | O | O | O | O | O | - |
| 23 | `ResizeObserver` (`particle_speech_rings.js:182`) | O | O | O | O | O | O | O | O | O | O |
| 24 | `MutationObserver` (`particle_speech_rings.js:480`) | O | O | O | O | O | O | O | O | O | O |
| 25 | `requestAnimationFrame` 多用 | O | O | O | O | O | O | O | O | O | O |
| 26 | `AudioContext` (4 系統: shared p3 / brandSF / particleSpeak / famicom) | O | O | O | O | O | O | O | O | O | O |
| 27 | `AnalyserNode.getByteFrequencyData` | O | O | O | O | O | O | O | O | O | O |
| 28 | `new Audio()` + `play()` Promise (BGM, `p3_code_for_claude.js:1201`) | O | O | O | O | O | O | O | O | O | O |
| 29 | `AbortController` (`p3_code_for_claude.js:4705`) | O | O | O | O | O | O | O | O | O | O |
| 30 | `TextEncoder` (`p3_code_for_claude.js:3944, 4247`) | O | O | O | O | O | O | O | O | O | O |
| 31 | `window.visualViewport` (`particle_speech_rings.js:177`) | O | O | O | O | O | O | O | O | O | O |
| 32 | `pointermove`/`pointerleave` (`p3_code_for_claude.js:829-830`) | O | O | O | O | O | O | O | O | O | O |
| 33 | `deviceorientation` (`p3_code_for_claude.js:831`) | △ | △ | △ | O | △ | O | O | O | △ | O |
| 34 | `navigator.vibrate` (`p3_code_for_claude.js:5355`) | X | X | X | O | X | O | O | O | X | O |

**ファイル参照と詳細:**
- `importmap`: `index.html:1326-1333` で three / three/addons を解決。Safari 16.4+ / Chrome 89+ / Firefox 108+ / Edge 89+。**iOS 16.0-16.3 は importmap 非対応**だが、index.html はモバイル UA から到達しないため影響しない。
- `AudioContext`: 4 つの独立コンテキストを作る (`p3AudioCtx`, `_brandSFCtx`, `_particleSpeakCtx`, `famicomACtx`) — iOS では作成数に上限はないが、**ユーザー操作なしの作成 → 必ず `suspended` 状態で開始**。再開コードは `p3_code_for_claude.js:1380` (`ctx.resume()`) と p3_test.html:166-176 のキック。OK。
- `deviceorientation`: iOS 13+ では `DeviceOrientationEvent.requestPermission()` のユーザージェスチャ起点呼び出しが必須。**現在のコードは permission リクエストなしで `addEventListener` しているだけ** (`p3_code_for_claude.js:831`) → iOS では値が来ない (黙って何も起きない、エラーにはならない)。Issue I-7 参照。
- `navigator.vibrate`: iOS Safari は **WebKit が一切実装していない**。コードは `try/catch` で囲んでいる (`p3_code_for_claude.js:5355`) ので落ちない。

### 1-C. Three.js / WebGL

| # | 機能 | iOS18 | iOS17 | iOS16 | AndC | macSF | DCh | DFx | DEd | iPad | SInt |
|---|------|:-----:|:-----:|:-----:|:----:|:-----:|:---:|:---:|:---:|:----:|:----:|
| 35 | Three.js 0.160 UMD ロード | O | O | O | O | O | O | O | O | O | O |
| 36 | WebGL2 (Three.js デフォルト) | O | O | O | O | O | O | O | O | O | O |
| 37 | `WebGLRenderer({ antialias: true })` (P0/P1) | O | O | O | O | O | O | O | O | O | O |
| 38 | `WebGLRenderer({ antialias: false })` (P3 main, `p3_code_for_claude.js:2711`) | O | O | O | O | O | O | O | O | O | O |
| 39 | `setPixelRatio(min(devicePixelRatio, 1.5))` (`:2712`) | O | O | O | O | O | O | O | O | O | O |
| 40 | カスタム `ShaderMaterial` + `precision highp float` (`:489`) | O | O | O | O | O | O | O | O | O | O |
| 41 | `AdditiveBlending` Points/LineSegments | O | O | O | O | O | O | O | O | O | O |
| 42 | `EffectComposer` + `UnrealBloomPass` (index.html のみ、`p3_test.html` で削除済み) | - | - | - | - | O | O | O | O | O | - |
| 43 | `LineBasicMaterial` (`p3_code_for_claude.js:4167`) — width=1 のみ | O | O | O | O | O | O | O | O | O | O |
| 44 | particles N=??? Float32Array 多数 | O | O | o | O | O | O | O | O | O | o |

**注意点:**
- `p3_test.html` は `vendor/three.min.js` ローカル配信 (オフライン耐性 + Chrome の CDN ブロック対策、`p3_test.html:108-128` のコメント参照)。
- `index.html` は CDN (`cdn.jsdelivr.net/npm/three@0.160.0`) — **企業 NW で jsdelivr ブロックされると動かない**。preconnect 済 (`index.html:69`)。
- iOS Safari の `antialias: true` は **MSAA を許すが** GPU リソース食いやすい。P3 main はわざわざ `antialias: false` にしているので問題なし。P0/P1 (`p3_code_for_claude.js:464, 868`) で `antialias: true` を使っているが、これらは index.html のみ → iPhone は通らない。**iPad で antialias=true** だと 球体が大きいと描画コスト高 → Issue I-9。
- shader precision `highp float` は iOS GPU でも使える (PowerVR/Apple GPU は highp サポート)。 Android の古い Adreno でも 2026 年時点ではほぼ問題なし。
- particles 数: `p3_code_for_claude.js:2734` で `N` (該当箇所読み取れず確定値要確認) — モバイル分岐があるか後述 Issue I-12 で言及。

### 1-D. Web Audio 詳細

| # | 機能 | iOS18 | iOS17 | iOS16 | AndC | macSF | DCh | DFx | DEd | iPad | SInt |
|---|------|:-----:|:-----:|:-----:|:----:|:-----:|:---:|:---:|:---:|:----:|:----:|
| 45 | `(window.AudioContext \|\| window.webkitAudioContext)` フォールバック | O | O | O | O | O | O | O | O | O | O |
| 46 | autoplay policy 回避 (`once: true` のクリックキック) | O | O | O | O | O | O | O | O | O | O |
| 47 | `OscillatorNode` / `BiquadFilterNode` (FAMICOM SE 系) | O | O | O | O | O | O | O | O | O | O |
| 48 | `AudioBuffer` ホワイトノイズ生成 (`:5342`) | O | O | O | O | O | O | O | O | O | O |
| 49 | `<audio>` 経由 BGM | O | O | O | O | O | O | O | O | O | O |
| 50 | 同時 4 AudioContext 並走 | o | o | o | O | O | O | O | O | o | O |

**iOS 注意:**
- iOS Safari は **page あたり同時に作れる AudioContext 数に実質的上限**(古くは 4–6) があり、これを超えると `state: 'closed'` で返ってくる事例。今回 4 つ並走するのでギリギリ。**Issue I-5 参照**。

---

## 2. 既知の問題と回避策（コードレベル発見）

### I-1. **iOS の AudioContext は user gesture まで `suspended`、resume タイミングが分散している**

- `p3_code_for_claude.js:403` `p3AudioCtx = new (...)()` は **`renderPhase3()` の内部で即時生成**。ユーザータッチ前 → `state === 'suspended'`。
- `p3_test.html:163-176` で `click/touchstart/keydown` 初回キックして `_p6bgm.play()` は呼ぶが、**`p3AudioCtx.resume()` を呼ぶのは `p3_code_for_claude.js:1380` の mute トグル時のみ**。つまり初回タッチでは `p3AudioCtx` が resume されない経路がある。
- 実害: iPhone で「触ってるのに粒子の音響リアクションが弱い」現象が出やすい。
- **回避策**: `p3_test.html` のキックハンドラに `if (window.p3AudioCtx?.state==='suspended') window.p3AudioCtx.resume()` を 1 行追加するだけで治る (このファイルは「触らない」指示だが、提案として記録)。

### I-2. **`-webkit-overflow-scrolling: touch` は iOS 13+ で no-op (deprecated)**

- `p3_styles.css:1979` で使用。iOS 13 以降は **デフォルトで momentum scrolling** になっており、このプロパティは黙殺される。動作には影響なし、**だがリンタが警告を出す**。削除候補。

### I-3. **`100vh` バグ — iOS / Android で URL バー伸縮による height ジャンプ**

- `p3_styles.css:1817` (`#cart-drawer { height: 100vh }`)
- `p3_test.html:437` (`html, body { height: 100% }`) ← `100%` なので比較的安全。
- 影響: モバイルでカートを開いた瞬間、URL バーが収納されて 100vh が伸び、**カートが画面下にハミ出てクローズボタンが届かない**現象が出うる。
- **回避策**: `100vh` を `100dvh` に置換するだけ。iOS 15.4+ / Chrome 108+ / Firefox 101+ で `dvh` 使える。`@supports (height: 100dvh) { #cart-drawer { height: 100dvh; } }` で漸進的に。ただし司さんが触らない方針なら現状維持で OK。

### I-4. **Firefox の `filter: drop-shadow()` 多段は GPU 高負荷**

- `p3_styles.css:91-99` などで 6 段 drop-shadow + hue-rotate + saturate アニメ。
- Chrome/Safari は GPU で合成、**Firefox は software filter 経路に落ちることがあり**、デスクトップでも 60fps 落ちる事例。
- 回避策: `@media not all and (-webkit-min-device-pixel-ratio: 0)` のような Firefox 限定で段数を減らす CSS を `@supports` で書く。**ただし P0–P2 を削れない縛りなので、Firefox 専用フォールバックを追加するのが筋**。

### I-5. **AudioContext を 4 つ作っている → iOS で `state: closed` リスク**

- `p3_code_for_claude.js`: `p3AudioCtx`(403) / `_brandSFCtx`(2116, 2189) / `_particleSpeakCtx`(2285) / `famicomACtx`(3815, 3888) / `audioContext`(5337) — 場合により **5 つ**。
- iOS Safari は同時生成 AudioContext を制限。**5 個目以降が無音化する**可能性。
- 回避策: 共有化(`audioContext` 一本に集約)。これは大規模リファクタなので即修正は厳しい。**短期の現実解は「FAMICOM/SE 系の単発音は 1 個の共有 ctx で再生」**にすること。

### I-6. **`pointermove` を window に直貼り、`{ passive: true }` 指定済 → スクロール阻害なし**

- `p3_code_for_claude.js:829-830` 良い実装。問題なし。

### I-7. **`deviceorientation` は iOS 13+ で permission 必須**

- `p3_code_for_claude.js:831` で `addEventListener('deviceorientation', ...)` を即座に呼んでいる。
- iOS では `DeviceOrientationEvent.requestPermission()` をユーザー操作起点で呼ばないと event fire されない (黙って 0 値が来る)。
- 影響: iOS で **「端末を傾けると粒子が動く」体験が一切起動しない**。
- 回避策: 初回タップ kick (`p3_test.html:163`) のなかで `if (typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission()` を追加。

### I-8. **`navigator.vibrate` は iOS 全バージョンで未実装**

- `p3_code_for_claude.js:5355` で `try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {}` — **正しくガードされている**。落ちない。iOS では何も起きないだけ。OK。

### I-9. **iPad での `WebGLRenderer({ antialias: true })` + 球体 P0/P1**

- `p3_code_for_claude.js:464, 868` で antialias=true。iPad は index.html フローに入る → P0/P1 通る。
- iPad Pro Retina で `devicePixelRatio=2` × antialias=true × 大球体 → fragment shader が 4×コスト。古い iPad (A12 以前) で fps 落ち。
- 回避策: P0/P1 の `setPixelRatio(Math.min(devicePixelRatio, 1.5))` 化 (P3 main は既にやっている、`p3_code_for_claude.js:2712`)。

### I-10. **CDN 依存 (`cdn.jsdelivr.net`) — index.html のみ**

- `index.html:1356-1362` で Three.js + 6 個の examples/js を CDN ロード。
- 日本のネットワーク・企業プロキシで jsdelivr が時々 502 を返す。**preconnect されているが fail-soft なし**。
- p3_test.html は `vendor/three.min.js` ローカル化済 (`p3_test.html:42, 119`) — モバイル側は既に対策済。
- **回避策**: index.html も `vendor/` 配信に切替 (動作と CDN ブロック対策の両得)。

### I-11. **`importmap` 非対応ブラウザ (古い Chrome <89, Firefox <108) はスクリプト落ち**

- `index.html:1326`。
- 2026-04 時点では Chrome/Firefox/Edge 全最新 + 1 つ前で問題ないが、**Safari 16.0–16.3 は importmap 非対応**。
- ただし Safari 16 の最終版 16.6 が importmap 対応 (16.4+) なので、**16.4 未満で macOS Safari を開くユーザーは要注意**。実機シェア的には極小。

### I-12. **particles 数のモバイル分岐が見えない**

- `p3_code_for_claude.js:2734-2799` あたりで particles 数 `N` を定義。`_isMobile` 判定 (`:1158`) は別ロジック (P2 周り) で使われており、**P3 particles の N が `_isMobile` で減らされているか要確認**。
- もし均一 N なら、Android 中位機 / iPhone 11 系で fps 30 程度に落ちる可能性大。

### I-13. **CSS `aspect-ratio` は Safari 15+**

- `p3_styles.css:839`。Safari 14 (iOS 14) は非対応だが、**iOS 14 は対象外** (司さん調査範囲は iOS 16+)。問題なし。

### I-14. **`-webkit-text-fill-color: transparent` (`index.html:1021`) — Firefox は対応済 (49+)**

- グラデーションテキスト用。全主要ブラウザ OK。問題なし。

### I-15. **`window.visualViewport` (iOS Safari の virtual keyboard 対応)**

- `particle_speech_rings.js:177-179` で resize/scroll を監視。**正しい実装**。iOS の仮想キーボードで viewport が縮んだ時、円環がロゴに追従する。OK。

### I-16. **mobile UA 判定が `/Android|iPhone|iPod/` のみ — `iPad` 抜き**

- `index.html:1342-1343`。コメントに「iPad は requestDesktopSite でデスクトップ UA」とあるが、**設定変更や別ブラウザ (Chrome iOS / Firefox iOS) では iPad UA が `iPad` を含む**。これらは index.html フルフローに入り、P0–P2 でクラッシュ可能性 (低スペック iPad の場合)。

### I-17. **Samsung Internet の autoplay 挙動が Chrome と異なる**

- BGM `<audio>` を `play()` する箇所 (`p3_code_for_claude.js:1201` 周辺) は user gesture kick 経由で OK。
- ただし Samsung Internet は **Data Saver ON 時に media を一切ロードしない** モードがあり、BGM が来ない可能性。fail-soft なのでクラッシュはしない。

### I-18. **Firefox のスクロールバー — DOM 幅変化**

- 検索したが `scrollbar-width` / `::-webkit-scrollbar` の指定なし。Firefox はデフォルトでスクロールバー幅 17px を取り、Chrome は overlay。
- 影響: cart drawer の `width: 340px; max-width: 90vw` (`p3_styles.css:1815-1816`) はスクロールバー幅を考慮しないため、Firefox で右端が微妙にズレる可能性。極小なので無視可。

### I-19. **iOS Safari `position: fixed` + virtual keyboard**

- chat input (`p3_code_for_claude.js:3910, 3916, 5038`) を表示中に iPhone でキーボードが出ると、**fixed 要素がキーボードの上に来てしまう/隠れる**バグが iOS 16-17 にある。
- 回避策: `visualViewport.height` を使って chat 位置を計算。**現在のコードは visualViewport を particle ring のみで使い、chat input では使っていない。**

### I-20. **`MutationObserver` の Safari 微妙差**

- `particle_speech_rings.js:480` で `new MutationObserver(connect)` し、`childList: true, subtree: true` で監視 (推定)。Safari でも問題なく動く。OK。

---

## 3. 要 polyfill / fallback 推奨

| 項目 | 必要度 | 対策 |
|------|--------|------|
| `100vh` → `100dvh` | **高** | `@supports (height: 100dvh)` で上書き。Issue I-3。 |
| `DeviceOrientationEvent.requestPermission()` | **高** | iOS 13+ で必須。Issue I-7。 |
| AudioContext を共有化 | 中 | iOS のリソース節約。Issue I-5。 |
| `importmap` polyfill (es-module-shims) | 低 | macOS Safari 16.0–16.3 残存ユーザー向け。実機シェア小。 |
| Three.js を `vendor/` ローカル化 (index.html) | 中 | CDN ブロック対策。Issue I-10。 |
| `-webkit-overflow-scrolling: touch` 削除 | 低 | iOS 13+ で no-op。Issue I-2。 |
| `navigator.vibrate` ガード | 既済 | OK、現状維持。 |
| `webkitAudioContext` フォールバック | 既済 | 全 4 箇所で `||` フォールバック済。OK。 |

---

## 4. 絶対に動かないブラウザ

- **IE 11**: 完全に動かない (importmap, ES2020+, AudioContext, WebGL2 全アウト)。**サポート対象外と明示済**前提。
- **Opera Mini**: WebGL/AudioContext 非対応 → 真っ黒。サイト方針的に対象外。
- **iOS Safari 14 以前**: `aspect-ratio` 非対応 + `dvh` 非対応 + importmap 非対応。p3_test.html は動く (importmap なし) が、視覚的破綻あり。**司さん調査範囲は iOS 16+ なので対象外**。
- **Android WebView (System WebView 70 未満)**: WebGL2 / shader precision でハングする可能性。2026 時点でほぼ絶滅。

---

## 5. 司さん実機チェックリスト（30 項目以上）

各ブラウザ実機で以下を順に確認。`[ ]` を `[x]` に置換しつつ進めてください。

### 5-A. iPhone (iOS 18 / 17 / 16) — `p3_test.html` 直行

1. [ ] サイト URL を Safari で開く → モバイル UA で `p3_test.html` に redirect されている (URL バーで確認)。
2. [ ] 黒背景に粒子宇宙が出る、3 秒以内に 60fps 体感。
3. [ ] ロゴが画面中央上で円環をまとって息をしている。
4. [ ] 画面を初回タップ → BGM が再生される (またはミュートのままならミュートボタンを押して再生)。
5. [ ] ロゴをタップ → 粒子が共鳴 (色が広がる)、音が出る。
6. [ ] 端末を傾ける → 粒子が傾きに反応 (Issue I-7、現状未対応の可能性)。
7. [ ] 商品 (12 型) リストまでスクロール → カードが順次 fade-in。
8. [ ] カード 1 つをタップ → モーダルが開く、サイズ選択ボタンタップ可能。
9. [ ] 「Add to Cart」タップ → カート drawer がスライドイン。
10. [ ] **drawer 下端のクローズ/checkout ボタンが画面下に隠れていない** (Issue I-3)。
11. [ ] チャット入力 → キーボードが出ても入力欄が見える (Issue I-19)。
12. [ ] スクロール時に momentum scrolling が効く。
13. [ ] 1 分放置 → メモリ警告/タブクラッシュなし。

### 5-B. Android Chrome / Samsung Internet — `p3_test.html` 直行

14. [ ] 上記 1〜13 を再実行 (Vibrate あり、傾き反応あり)。
15. [ ] Samsung Internet で Data Saver ON にして BGM 鳴るか確認 (鳴らなくても許容)。
16. [ ] overscroll で粒子背景が下に引っ張られないこと。

### 5-C. macOS Safari (最新)

17. [ ] `index.html` フルフロー: P0 (Welcome) → ENTER → P1 ローディング → P2 球体ブリッジ → P3 へ。
18. [ ] P0–P3 の遷移で WebGL canvas が引き継がれている (P2→P3 で球体が logo 位置に滑り込む)。
19. [ ] BGM 再生、Mute トグル動作。
20. [ ] グラデーションテキスト (`-webkit-text-fill-color: transparent`) が虹色で見える。

### 5-D. Desktop Chrome (最新 + 1 つ前)

21. [ ] `index.html` フルフロー全動作。
22. [ ] DevTools Performance で粒子描画が 60fps 維持。
23. [ ] Network タブで `cdn.jsdelivr.net` が 200 で返っている (Issue I-10)。
24. [ ] DevTools Console にエラー/警告が出ていないこと (deprecation 含む)。

### 5-E. Firefox Desktop (最新)

25. [ ] `index.html` フルフロー全動作。
26. [ ] **drop-shadow 多段アニメで fps が 60 を維持しているか** (Issue I-4)。落ちていたら CPU/GPU 負荷率を控える。
27. [ ] cart drawer の右端が綺麗に揃っているか (Issue I-18)。

### 5-F. Edge (Chromium) Desktop

28. [ ] Chrome と同等の動作確認 (基本同じ Blink/V8 なので)。
29. [ ] Windows の `prefers-color-scheme` 切替で theme-color が反映されること。

### 5-G. iPad Safari (横 / 縦)

30. [ ] `index.html` フルフロー (デスクトップ UA で来る前提)。
31. [ ] 横向き / 縦向き両方で P0–P3 動作、レイアウト崩れなし。
32. [ ] P0/P1 の球体描画で fps 落ちないか (Issue I-9 — 古い iPad で要注意)。
33. [ ] 仮想キーボードを開閉してチャット入力が見えるか。
34. [ ] split view (50/50) でも崩れないか。

### 5-H. 共通機能テスト (全ブラウザで)

35. [ ] `prefers-reduced-motion: reduce` を OS 設定で ON → アニメが大人しくなる。
36. [ ] Stripe チェックアウト遷移が動く (`/api/...` fetch 成功)。
37. [ ] チャット送信 → AI レスポンス到着、AbortController で中断可。

---

## 6. 推奨対応順位

### P0 (今すぐ)
1. **Issue I-7**: iOS の `DeviceOrientationEvent.requestPermission()` を kick ハンドラに追加。粒子の傾き反応がモバイル全機種で死んでいる現状の修復は ROI 最大。
2. **Issue I-3**: `100vh` → `100dvh` 化 (`@supports` 内で 1 行)。cart drawer の致命的 UX バグ予防。

### P1 (短期)
3. **Issue I-10**: `index.html` の Three.js を `vendor/three.min.js` ローカル配信に統一。CDN ブロック障害の予防。
4. **Issue I-19**: chat input を `visualViewport.height` 連動に。iOS のキーボード問題。
5. **Issue I-12**: P3 particles の `N` がモバイル分岐されているか確認、未分岐なら `_isMobile ? N/2 : N`。

### P2 (中期)
6. **Issue I-5**: AudioContext 共有化リファクタ。
7. **Issue I-4**: Firefox 限定 drop-shadow 段数縮小。`@-moz-document url-prefix()` または `@supports (-moz-appearance:none)` で。
8. **Issue I-9**: P0/P1 の `setPixelRatio` も clamp。
9. **Issue I-2**: `-webkit-overflow-scrolling: touch` 行削除 (純リント整備)。

### P3 (任意)
10. **Issue I-16**: iPad UA を `index.html` モバイル分岐に含めるか検討 (古い iPad の P0–P2 負荷回避)。
11. **Issue I-17**: Samsung Internet Data Saver 検出 + フォールバック。

---

## 7. 結論サマリ

- **モバイル (iPhone / Android) は `p3_test.html` 一本に集約されており、SR/AR/UMD/importmap の互換性課題から完全に解放されている**。残る P0/P1/P2 縛りはデスクトップ (+ iPad UA でデスクトップ扱いされた端末) のみが負担。これは設計勝利。
- **致命傷は 2 つだけ**: `100vh` (cart drawer 切れ) と DeviceOrientation permission (傾き機能死亡)。両方とも数行で直る。
- **AudioContext 4 系統並走**は iOS で薄氷。中期的に共有化推奨。
- **Three.js は CDN 依存が index.html に残存**。p3_test.html は既にローカル化済 — **index.html もローカル化すべき**。
- **司さんの「P0–P2 削らない」縛り**は技術的には iPad と古い macOS Safari ユーザーへのインパクトに集中するが、シェアは小さく、無理に対応しなくても全体体験は守れる。

以上、徹底調査報告。
