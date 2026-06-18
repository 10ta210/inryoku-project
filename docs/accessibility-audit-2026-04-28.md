# inryokü P3 — WCAG 2.1 AA アクセシビリティ監査

**監査日:** 2026-04-28
**対象:** `p3_test.html` / `index.html`（P3 フェーズ — パーティクルユニバース + EC ショップ）
**関連ファイル:** `p3_styles.css`, `p3_code_for_claude.js`, `particle_rings.css`, `particle_glyphs.css`
**監査者:** Claude (Opus 4.7)
**準拠目標:** WCAG 2.1 Level AA

---

## 1. サマリ

| 重大度 | 件数 | 説明 |
|---|---|---|
| **Critical** | 8 件 | 即修正推奨。法令/購買の阻害、キーボード/SR ユーザー完全排除レベル |
| **Major** | 14 件 | 次スプリント。AA 不達成、UX 大幅低下 |
| **Minor** | 11 件 | 任意。AAA / ベストプラクティス改善 |
| **Pass / 合格項目** | 7 件 | 既に対応済み |

**結論:** 現状は **WCAG 2.1 AA 不適合**。主要因は (a) ページ全体の semantic landmark 欠如、(b) 装飾色（grey/CMY/RGB）と暗背景のコントラスト不足、(c) フォーカスインジケーター抑止 (`outline: none`) の多用、(d) モーダル/ドロワーのフォーカストラップ未実装、(e) 動的更新の `aria-live` 不在。

「inryokü 美学」を保ったままアクセシブルにする前提でも、最低 Critical 8 件は対応必須。

---

## 2. Critical 問題（即修正推奨）

### C-1. ページ全体に landmark / 見出し階層が無い
- **箇所:** `index.html:1207-1226`, `p3_test.html:113-114` — `<body>` 直下が `<div id="root">` のみ。
- **生成 DOM:** `p3_code_for_claude.js:1297-1317` の `root.innerHTML` には `<main>` `<header>` `<nav>` `<section>` 一切なし。フッターのみ `:1736` で `<footer>` 生成。
- **影響:** スクリーンリーダーで「メインコンテンツへスキップ」「見出しジャンプ」が一切効かない。`<h1>` も存在しない（`brand-name` は `<div>`）。
- **WCAG:** 1.3.1 Info & Relationships (A), 2.4.1 Bypass Blocks (A), 2.4.6 Headings & Labels (AA)

### C-2. ロゴ画像の alt 空、`<h1>` 不在 — ページタイトル情報が SR に届かない
- **箇所:** `p3_code_for_claude.js:1305-1306`
  ```html
  <img src="logo_shell.png" alt="" class="logo-shell">
  <img src="logo_sphere.png" alt="" class="logo-sphere">
  ```
- ロゴ周辺の `<div class="brand-name">` は `<span class="brand-char">` の集合（i, n, r, y, o, k, ü が個別 span）。SR は「i n r y o k ü」と一字ずつ読む。
- **影響:** ブランド名が音声合成で意味不明な文字列として読み上げられる。
- **WCAG:** 1.1.1 Non-text Content (A), 2.4.6 (AA)

### C-3. 商品カード（カルーセル）が button/link でない
- **箇所:** `p3_code_for_claude.js:1276` — `<div class="carousel-item" data-idx="...">` のみで、`role`, `tabindex`, `aria-label` 全部なし。クリックハンドラは `initStoreGrid` 内で登録（マウスのみ）。
- **影響:** Tab で商品にフォーカス到達不可、Enter/Space で開けない、SR で「クリック可能」とアナウンスされない。
- **WCAG:** 2.1.1 Keyboard (A), 4.1.2 Name/Role/Value (A)

### C-4. カートアイコン・ミュートボタン・BGM ボタン・コンタクトトグル・サイズガイドトグル・フッタートグルが全て `<div>`
- **箇所:**
  - `p3_code_for_claude.js:1345` cartIcon = `createElement('div')`
  - `:1362` muteBtn = `createElement('div')`
  - `:1634` `<div class="contact-toggle" id="contact-toggle">CONTACT</div>`
  - `:5259` `<div class="size-guide-toggle" id="sg-toggle">SIZE GUIDE</div>`
  - `:1740` `<div class="footer-toggle">ⓘ</div>`
- **影響:** Tab で到達不可、Enter/Space 不可、`role` も無し。EC の購買動線（カート）が完全にキーボード排除。
- **WCAG:** 2.1.1 (A), 4.1.2 (A)

### C-5. モーダル/ドロワーにフォーカストラップ無し・元要素への返却無し
- **箇所:** `p3_code_for_claude.js:5217-5331` (Product modal), `:5086-5215` (Cart drawer)
- ESC キー閉鎖 (`:5213, :5327`) と `aria-modal="true"` (`:5226`) は実装済み。しかし:
  - フォーカスがモーダル外にも Tab で抜ける（背後の商品カードへ移動可能）
  - 閉じた後、開く前にフォーカスを当てていた要素にフォーカスが戻らない
  - cart drawer は `role="dialog"` も `aria-modal` も無い
- **影響:** SR/キーボードユーザーが現在地を見失う、背後の隠れた要素を操作できてしまう。
- **WCAG:** 2.4.3 Focus Order (A), 2.1.2 No Keyboard Trap 逆方向（trap が "無い" のが問題）

### C-6. グレー文字が黒背景でコントラスト不足
- **箇所例:**
  - `p3_styles.css:1383` `.cart-stripe-note { color: rgba(255,255,255,0.25); ... }` ← #404040 相当 vs #0a0a0a → 約 **2.0:1** ❌
  - `:1854` `.cart-empty { color: rgba(255,255,255,0.3); font-size:13px; }` → 約 **2.5:1** ❌
  - `:1187` `.product-specs { color: #666; font-size:12px; }` → #666 vs `rgba(18,18,22,0.95)` → 約 **3.5:1** ❌（通常文字は 4.5:1 必要）
  - `:1051` `.product-specs` 同上
  - `:1773` `.footer-toggle { color: rgba(255,255,255,0.15); }` → 約 **1.4:1** ❌
  - `:1789, :1795, :1800` フッター内テキスト全般 0.15〜0.25 透明 → ほぼ不可視
  - `index.html:1112` `.web2-subtitle { color:#666; }` (薄背景上だが小文字)
- **WCAG:** 1.4.3 Contrast (Minimum) (AA) — 通常文字 4.5:1, 18pt or 14pt bold 大文字 3:1
- **修正方針:** 透明度 0.6 以上 / 純色なら #B0B0B0 以上を最低ライン化。Press Start 2P のような装飾フォントは小サイズだと特にコントラストが効かない。

### C-7. `outline: none` の多用 + `:focus-visible` 代替なし
- **箇所:**
  - `p3_styles.css:1419` chat input
  - `:1744` chat-tp-input
  - `:2289` `.email-signup-input { outline:none; }` — `:focus` で border-color を 0.15→0.4 のみ（コントラスト不足、見落とす）
  - `:2353` `.contact-input/textarea` 同上
- **影響:** キーボードユーザーが現在のフォーカス位置を視認できない。
- **WCAG:** 2.4.7 Focus Visible (AA), 1.4.11 Non-text Contrast (AA, 3:1)

### C-8. AI チャット応答・トースト・カート更新が `aria-live` 領域でない
- **箇所:**
  - `p3_code_for_claude.js:5295` `.cart-toast` (カート追加通知)
  - `:1675-1682` contact-status / `:1581-1623` email-status（送信中/成功/失敗）
  - `:4360-4407` チャット buildChatHTML — `#chat-messages` に `aria-live` 無し
  - `:2079, :2096` ブロックトースト
- **影響:** SR ユーザーが「カート追加」「送信完了」「AI 応答」を一切認識できない。EC 動線では致命的。
- **WCAG:** 4.1.3 Status Messages (AA)

---

## 3. Major 問題（次スプリント）

### M-1. `<html lang="ja">` は OK だが英語混在に lang 切替なし
日本語ページに「CHECKOUT」「ADD TO CART」「DELIVERY · 7–14 BUSINESS DAYS」など多数の英語文字列。SR が日本語音声で読むと不自然。WCAG 3.1.2 (AA)。`<span lang="en">` でラップ推奨。

### M-2. グレー枠線・ボタンボーダーのコントラスト不足
`p3_styles.css:1081` `.size-btn { border: 1px solid rgba(255,255,255,0.15); }` → ボタン UI 要素の 3:1 不達成（1.6:1 程度）。`:1927, :2300, :2348, :631`(.glass-card) も同様。**WCAG 1.4.11 Non-text Contrast (AA)**。

### M-3. RGBCMY 純色（#FF0000, #00FF00, #0044FF, #00FFFF, #FF00FF, #FFFF00）の組み合わせ問題
- ブランド文字 `:1302` で純色使用 — `#0044FF` (青) vs `#0a0a0a` 黒 ≈ **2.6:1** ❌、`#FF0000` ≈ 5.3:1 OK、`#00FF00` ≈ 15.3:1 OK、`#FF00FF` ≈ 6.7:1 OK。**青 (`#0044FF`) と「i」`#808080` (約 3.9:1) が AA 通常文字 4.5:1 不達成**。Press Start 2P bitmap フォントは厳密に「大文字」適用ができない。

### M-4. Press Start 2P 8〜9px の使用が WCAG 上、本文として通用しない
複数箇所 (`:2257, :2330, :2374, :2403, :1788`) で 8〜9px。ピクセルフォントだが、SR には通常文字として認識される。コントラスト要件 4.5:1 + 視認可能サイズが必要。

### M-5. Email/CONTACT フォーム — `<label>` 不在、placeholder のみ
- `p3_code_for_claude.js:1557` `<input type="email" id="email-input" placeholder="your@email.com">` ← `<label>` も `aria-label` も無し
- `:1636-1638` Name / Email / Message も同様
- `:1502` `<textarea id="grey-bio">` — `<label>` 無し
- placeholder は label 代替不可（フォーカス時に消える、低コントラスト rgba(255,255,255,0.2) は 1.7:1）
- **WCAG 3.3.2 Labels or Instructions (A), 4.1.2 (A)**

### M-6. フォーム送信エラー/成功の関連付け
`#email-status` `#contact-status` `#grey-save-status` を input と関連付けする `aria-describedby` が無い。送信中の "送信中…" もスクリーンリーダー通知されない（Critical C-8 と重複）。**3.3.1 Error Identification (A), 3.3.3 Error Suggestion (AA)**。

### M-7. ✕ クローズボタンが `aria-label` 無し
`p3_code_for_claude.js:5101, 5113, 5125, 5230, 3929, 5039` — テキスト `✕` `×` のみ。SR は「バツ」「乗算記号」などと読む可能性。`aria-label="閉じる"` 必須。

### M-8. SVG アイコン（カート/ミュート）に `aria-label` 無し、装飾化もしていない
`:1349-1353` SVG は `<title>` も `role="img"` も `aria-label` も持たず、親 `<div>` も無記述。SR では空ボタンとして無視される。

### M-9. タッチターゲット 44×44 未満
- `.cart-item-remove` (`:1898-1904`): padding 2px 4px、font-size 12px → 約 16×20px ❌
- `.footer-toggle` (`:1772-1774`): padding 12px 20px → ⓘ アイコン全体は OK だが実クリック領域は font-size 14px の文字のみ
- `.contact-toggle` (`:2329-2334`): font 9px のテキストのみ、パディング無 → タップ困難
- `.cart-drawer-close`, `.product-close-btn`: 36×36 (`:971`) ← 44 未満
- `.size-btn` モバイル時 40×40 (`:2104-2108`)
- `.theme-btn` 40×40 (`:2417-2419`)
- **WCAG 2.5.5 Target Size (AAA)** だが実用上 Major。AA でも 2.5.8 Target Size (Minimum) 24×24 は必須 — 一部 OK。

### M-10. グリッチモード — 1秒以下の閃光・色反転
`:4396 startGlitch()` および `chat-glitch-mode`。3 回/秒以上の点滅が起きる場合 **WCAG 2.3.1 Three Flashes (A)** 違反の可能性。要動作確認。

### M-11. RGBCMY カーソルトレイル — `prefers-reduced-motion` 無視
`:1394-1432` mousemove で常時パーティクル生成。`reduced-motion` 設定中もスポーン続行。

### M-12. ビッグバン粒子・ブランドリビール等の motion
`:1761-1783 spawnBigBang`, `:1334 initBrandParticleReveal`, `index.html:545-573 logoGlow / iconGlow / charPulse`, `p3_styles.css:540-547 brandPulse / haloBreathe` 等。`p3_styles.css:550-593` で `prefers-reduced-motion` を一部対応しているが、`brand-char` の `charFloat`/`charGlow` (`:654`)、`bangExplode` (`:2248`)、`labelPulse` (`:2262`)、cursor trail、bigBang はスキップ無し。**WCAG 2.3.3 Animation from Interactions (AAA), 2.2.2 Pause Stop Hide (A)** — 5 秒以上自動再生する動きに停止手段必須。`logoGlow` `iconGlow` `charPulse` などが該当。

### M-13. iOS ズーム抑止 — `maximum-scale=1.0, user-scalable=no`
`p3_test.html:5`, `index.html:6` 両方。**WCAG 1.4.4 Resize Text (AA)** に反する。視覚障害者がピンチズームできない。司さんの没入演出意図は理解するが、AA 適合上は禁則。

### M-14. キーボードのみで商品購入が完了不能
- カルーセル回転：`:1808-` mouse drag のみ（キーボード無し）
- 商品カードクリック：`<div>` (C-3 の通り)
- モーダル内のサイズボタンは `<button>` なので OK、ADD TO CART も OK
- カートアイコンも `<div>`（C-4）
- フッターの「特定商取引法/プライバシー/返品」リンクは `<a>` で到達可、ただしフッタートグル `<div>` を開かないと表示されない（`:1779` max-height: 0; overflow: hidden`）→ Tab で隠れたリンクにフォーカス到達可能性は不明。要検証。
- **WCAG 2.1.1 (A), 2.4.3 Focus Order (A)**

---

## 4. Minor 問題

### m-1. `<input>` の `autocomplete` ヒント不在
email/name/message に `autocomplete="email"` `name` 等を付けると UX 改善。WCAG 1.3.5 (AA)。

### m-2. メールバリデーション正規表現がブラウザ標準より緩い
`p3_code_for_claude.js:1575` `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`。`type="email"` ＋ `:invalid` で十分。エラー時の `aria-invalid` も追加推奨。

### m-3. `alert()` の使用（`:5170, :5198, :5204`）
ブラウザ alert は SR で読まれるが、フォーカス管理が雑。専用ダイアログ推奨。

### m-4. `<table>` 内のサイズガイド (`:5261-5269`) — `<th scope>` 無し
`<thead><tr><th></th><th>S</th>...` の最初の `<th>` は空セル。`scope="col"` / `scope="row"` 追加推奨。

### m-5. リンクの新規タブ警告
`:1744-1748` `target="_blank" rel="noopener"` は OK。ただしリンクテキスト「X」「Instagram」だけで「外部に開く」ことが視覚的に伝わらない。`aria-label="X (新しいウィンドウで開く)"` 推奨。

### m-6. フッター最小化トグル ⓘ — テキストでなく装飾のみ
`title="info"` は属性として弱い。`aria-label` 化推奨。

### m-7. KONAMI Code easter egg 解放トースト (`:1693-1699`) — `aria-live` 不在
ゲーム性の演出だが、装飾なら `aria-hidden`、機能なら `aria-live` 必要。

### m-8. logo `<img alt="">` の隣で span による文字置換
`p3_code_for_claude.js:1283` `onerror` でフォールバック表示するが、表示時の `alt` 情報が消える。

### m-9. SVG パス — 装飾 SVG に `aria-hidden="true"` 推奨
`.pring__path-dot`, `.pring__chord` 等の SVG (particle_rings.css 全般) は装飾。`<svg>` 親に `aria-hidden="true"` `role="presentation"` を付与すると SR が無視。

### m-10. cursor: pointer のみのクリック手がかり
カルーセル `.carousel-item` がクリック可と分かる視覚手がかりが薄い（hover 時のみ）。`role="button"` + フォーカスリングで補完。

### m-11. `data-3d-slot` `data-glb` 等の data 属性に頼った状態管理
SR 対応とは別軸だが、`aria-pressed` `aria-current` 等の正規属性で状態を表現していない（例：選択中サイズは class `selected` のみ。`aria-pressed="true"` を使うと SR が選択状態を読み上げる）。

---

## 5. WCAG 2.1 適合チェックリスト（A / AA）

### Principle 1 — Perceivable

| SC | レベル | 状態 | 備考 |
|---|---|---|---|
| 1.1.1 Non-text Content | A | ❌ | C-2, M-7, M-8: alt 空、SVG ボタン無 label |
| 1.2.x Time-based Media | A/AA | N/A | 動画・音声主要コンテンツ無し（BGM はあるが代替コンテンツ提供) |
| 1.3.1 Info & Relationships | A | ❌ | C-1, M-5: landmark/heading/label 不在 |
| 1.3.2 Meaningful Sequence | A | ⚠ | DOM 順は概ね OK だが modal が body 末尾追加 |
| 1.3.3 Sensory Characteristics | A | ✅ | 「赤いボタンを押す」等の指示なし |
| 1.3.4 Orientation | AA | ✅ | 縦横どちらも動作 |
| 1.3.5 Identify Input Purpose | AA | ⚠ | m-1: autocomplete 不足 |
| 1.4.1 Use of Color | A | ✅ | 色のみで意味伝達はしていない |
| 1.4.2 Audio Control | A | ⚠ | BGM は自動再生でなく user gesture 後 (`p3_test.html:142`)。✅ ただしミュートボタンに role/label 無し |
| 1.4.3 Contrast (Minimum) | AA | ❌ | C-6, M-3, M-4 |
| 1.4.4 Resize Text | AA | ❌ | M-13: `user-scalable=no` |
| 1.4.5 Images of Text | AA | ✅ | テキストはテキスト |
| 1.4.10 Reflow | AA | ⚠ | mobile @media は対応、ただし overflow:hidden が body にあり (p3_test.html:109) — 320px reflow 要検証 |
| 1.4.11 Non-text Contrast | AA | ❌ | M-2: ボタンボーダー 0.15 |
| 1.4.12 Text Spacing | AA | ⚠ | letter-spacing 固定多数。要検証 |
| 1.4.13 Content on Hover/Focus | AA | ⚠ | hover で表示される情報の dismiss/persist 未確認 |

### Principle 2 — Operable

| SC | レベル | 状態 | 備考 |
|---|---|---|---|
| 2.1.1 Keyboard | A | ❌ | C-3, C-4, M-14: 主要操作キーボード排除 |
| 2.1.2 No Keyboard Trap | A | ⚠ | trap は無いが、modal で逆に escape が無い箇所が無いか要検証。ESC 実装あり ✅ |
| 2.1.4 Character Key Shortcuts | A | ✅ | 該当無し（KONAMI は装飾） |
| 2.2.1 Timing Adjustable | A | ✅ | 時間制限なし |
| 2.2.2 Pause Stop Hide | A | ❌ | M-12: 5 秒以上の自動アニメ多数、停止 UI 無し |
| 2.3.1 Three Flashes | A | ⚠ | M-10: グリッチモード要検証 |
| 2.4.1 Bypass Blocks | A | ❌ | C-1: skip link 無し |
| 2.4.2 Page Titled | A | ✅ | `<title>` あり |
| 2.4.3 Focus Order | A | ❌ | C-5, M-14 |
| 2.4.4 Link Purpose | A | ⚠ | m-5: 「X」「Instagram」だけ |
| 2.4.5 Multiple Ways | AA | ✅ | SPA 単一ページなので適用外 |
| 2.4.6 Headings & Labels | AA | ❌ | C-1, C-2, M-5 |
| 2.4.7 Focus Visible | AA | ❌ | C-7 |
| 2.5.1 Pointer Gestures | A | ⚠ | カルーセル drag は alternative 必要 |
| 2.5.2 Pointer Cancellation | A | ✅ | click 系は up イベント基準 |
| 2.5.3 Label in Name | A | ❌ | M-5: 視覚 label 無し |
| 2.5.4 Motion Actuation | A | ✅ | 該当無し |

### Principle 3 — Understandable

| SC | レベル | 状態 | 備考 |
|---|---|---|---|
| 3.1.1 Language of Page | A | ✅ | `<html lang="ja">` |
| 3.1.2 Language of Parts | AA | ❌ | M-1 |
| 3.2.1 On Focus | A | ✅ | 焦点で文脈変化なし |
| 3.2.2 On Input | A | ✅ | input 変更で文脈変化なし |
| 3.2.3 Consistent Navigation | AA | N/A | 単一ページ |
| 3.2.4 Consistent Identification | AA | ⚠ | ✕ ボタンが半角/全角混在 |
| 3.3.1 Error Identification | A | ⚠ | M-6: aria 関連付け無し、視覚的にはあり |
| 3.3.2 Labels or Instructions | A | ❌ | M-5 |
| 3.3.3 Error Suggestion | AA | ⚠ | 「メールアドレスを正しく入力してください」のみ。具体性弱い |
| 3.3.4 Error Prevention (Legal/Financial) | AA | ⚠ | チェックアウトは Shopify に委譲 — 確認画面の有無要確認 |

### Principle 4 — Robust

| SC | レベル | 状態 | 備考 |
|---|---|---|---|
| 4.1.1 Parsing | A | ✅ | (WCAG 2.2 で削除済み) |
| 4.1.2 Name, Role, Value | A | ❌ | C-3, C-4, M-7, M-8 |
| 4.1.3 Status Messages | AA | ❌ | C-8 |

---

## 6. 修正案 diff（最重要 5 件）

### Fix 1 — C-1 / C-2: landmark + skip link + ロゴの aria-label

```diff
--- a/p3_code_for_claude.js
+++ b/p3_code_for_claude.js
@@ -1297,18 +1297,22 @@
     root.innerHTML = `
         <canvas id="pu-cv" style="display:none;"></canvas>
-    <div class="singularity-content" style="position:relative;z-index:5;pointer-events:auto;">
-        <div class="hologram-logo" style="opacity:0;" id="holo-logo-wrap">
-            <div class="brand-name p6-logo-text">
+    <a href="#main-shop" class="skip-link">メインコンテンツへスキップ</a>
+    <main id="main-shop" class="singularity-content" style="position:relative;z-index:5;pointer-events:auto;">
+        <header class="hologram-logo" style="opacity:0;" id="holo-logo-wrap">
+            <h1 class="brand-name p6-logo-text" aria-label="inryokü">
                 <span class="brand-char" style="color:#808080;opacity:0;" aria-hidden="true">i</span><span class="brand-char" style="color:#FF0000;opacity:0;" aria-hidden="true">n</span><span class="brand-char" style="color:#00FF00;opacity:0;" aria-hidden="true">r</span><span class="brand-char" style="color:#0044FF;opacity:0;" aria-hidden="true">y</span><span class="brand-char" style="color:#00FFFF;opacity:0;" aria-hidden="true">o</span><span class="brand-char" style="color:#FF00FF;opacity:0;" aria-hidden="true">k</span><span class="brand-char" style="color:#FFFF00;opacity:0;" aria-hidden="true">ü</span>
-            </div>
+            </h1>
             <div class="logo-holo-wrap" id="bb-logo" style="cursor:pointer;opacity:0;" role="img" aria-label="inryokü ロゴ — クリックで対話">
                 <img src="logo_shell.png" alt="" aria-hidden="true" class="logo-shell" style="opacity:0;">
                 <img src="logo_sphere.png" alt="" aria-hidden="true" class="logo-sphere" style="opacity:0;animation:none;">
                 <div class="holo-scanlines" aria-hidden="true"></div>
                 <div class="holo-overlay" aria-hidden="true"></div>
                 <div class="holo-scanline" aria-hidden="true"></div>
             </div>
-        </div>
+        </header>
-        <div class="item-grid" style="opacity:0;transition:opacity 1.2s ease;">
+        <section class="item-grid" aria-label="商品一覧" style="opacity:0;transition:opacity 1.2s ease;">
             ${productCardsHTML}
-        </div>
-    </div>`;
+        </section>
+    </main>`;
```

```diff
--- a/p3_styles.css
+++ b/p3_styles.css
@@ -1,3 +1,16 @@
+.skip-link {
+    position: absolute;
+    top: -40px; left: 0;
+    background: #fff; color: #000;
+    padding: 8px 16px;
+    z-index: 10001;
+    text-decoration: none;
+    font-size: 14px;
+}
+.skip-link:focus {
+    top: 0;
+    outline: 3px solid #00ffff;
+}
```

---

### Fix 2 — C-3 / C-4: 商品カード/カートアイコン/トグル類を `<button>` 化

```diff
--- a/p3_code_for_claude.js
+++ b/p3_code_for_claude.js
@@ -1276,7 +1276,8 @@
             ${PRODUCTS.map((p, i) => {
               var angle = (360 / PRODUCTS.length) * i;
-              return `<div class="carousel-item${isProductPurchasable(p) ? '' : ' product-card-disabled'}" data-idx="${i}" id="product-${p.id}" style="transform: rotateY(${angle}deg) translateZ(115px);">
+              return `<button type="button" class="carousel-item${isProductPurchasable(p) ? '' : ' product-card-disabled'}" data-idx="${i}" id="product-${p.id}" aria-label="${p.name} ${p.price} の詳細を開く" style="transform: rotateY(${angle}deg) translateZ(115px);">
                 <div class="product-showcase">
                   ...
-              </div>`;
+              </button>`;
             }).join('')}
@@ -1345,11 +1346,12 @@
-    const cartIcon = document.createElement('div');
+    const cartIcon = document.createElement('button');
+    cartIcon.type = 'button';
     cartIcon.id = 'cart-icon';
+    cartIcon.setAttribute('aria-label', 'カートを開く');
+    cartIcon.setAttribute('aria-expanded', 'false');
     cartIcon.innerHTML = `
-        <svg width="20" height="20" viewBox="0 0 24 24" ... >...</svg>
-        <span id="cart-badge" ...>0</span>`;
+        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ...>...</svg>
+        <span id="cart-badge" aria-label="カート内の商品数" ...>0</span>`;

@@ -1362,8 +1364,10 @@
-    const muteBtn = document.createElement('div');
+    const muteBtn = document.createElement('button');
+    muteBtn.type = 'button';
     muteBtn.id = 'mute-btn';
+    muteBtn.setAttribute('aria-label', 'BGM ' + (window._inryokuMuted ? 'ミュート解除' : 'ミュート'));
+    muteBtn.setAttribute('aria-pressed', String(!!window._inryokuMuted));

@@ -1633,7 +1637,7 @@
     contactForm.innerHTML = `
-        <div class="contact-toggle" id="contact-toggle">CONTACT</div>
+        <button type="button" class="contact-toggle" id="contact-toggle" aria-expanded="false" aria-controls="contact-body">CONTACT</button>
-        <div class="contact-body" id="contact-body" style="display:none;">
+        <div class="contact-body" id="contact-body" hidden>
             ...

@@ -1740,7 +1744,7 @@
     footer.innerHTML = `
-        <div class="footer-toggle" title="info">ⓘ</div>
+        <button type="button" class="footer-toggle" aria-label="サイト情報を表示" aria-expanded="false" aria-controls="footer-expanded-region">ⓘ</button>
-        <div class="footer-expanded">
+        <div class="footer-expanded" id="footer-expanded-region">
```

`button` の default style リセットが必要（`p3_styles.css` 側で `.carousel-item, .footer-toggle, #cart-icon, #mute-btn { background: inherit; border: 0; padding: 0; ... }` 既存スタイル維持）。

---

### Fix 3 — C-6: コントラスト最低ライン引き上げ

```diff
--- a/p3_styles.css
+++ b/p3_styles.css
@@ -1383,7 +1383,7 @@
 .cart-stripe-note {
     font-size: 10px;
-    color: rgba(255, 255, 255, 0.25);
+    color: rgba(255, 255, 255, 0.6);
     ...

@@ -1854,7 +1854,7 @@
 .cart-empty {
     ...
-    color: rgba(255, 255, 255, 0.3);
+    color: rgba(255, 255, 255, 0.7);
     font-size: 13px;

@@ -1186,7 +1186,7 @@
 .product-specs {
     ...
     font-size: 12px;
-    color: #666;
+    color: #b0b0b0;     /* #b0b0b0 vs rgba(18,18,22,0.95) ≈ 7.4:1 */

@@ -1773,7 +1773,7 @@
 .site-footer--mini .footer-toggle {
     display: inline-block; cursor: pointer;
-    font-size: 14px; color: rgba(255,255,255,0.15);
+    font-size: 14px; color: rgba(255,255,255,0.55);
     padding: 12px 20px; transition: color 0.3s;

@@ -1788,7 +1788,7 @@
 .footer-brand {
     font-family: 'Press Start 2P', monospace; font-size: 8px;
-    color: rgba(255,255,255,0.2); margin-bottom: 8px;
+    color: rgba(255,255,255,0.65); font-size: 11px; margin-bottom: 8px;
 }

@@ -1794,7 +1794,7 @@
 .footer-link {
-    font-size: 9px; color: rgba(255,255,255,0.25); text-decoration: none;
+    font-size: 12px; color: rgba(255,255,255,0.7); text-decoration: underline;
     transition: color 0.3s;
 }

@@ -2257,7 +2257,7 @@
 .email-signup-label {
     font-family: 'Press Start 2P', monospace;
     font-size: 9px;
-    color: rgba(255,255,255,0.4);
+    color: rgba(255,255,255,0.75);  /* + label として読まれる位置 */
     letter-spacing: 0.2em;
```

「inryokü 美学」を維持しつつ、AA 必須の透過率は **0.55 以上**を最低ライン化。Press Start 2P のような小文字装飾フォントは 11px 以上に底上げ推奨。

---

### Fix 4 — C-7: フォーカスリング復活

```diff
--- a/p3_styles.css
+++ b/p3_styles.css
@@ -2289,9 +2289,12 @@
 .email-signup-input {
     ...
-    outline: none;
     transition: border-color 0.3s;
 }
-.email-signup-input:focus {
-    border-color: rgba(255,255,255,0.4);
+.email-signup-input:focus-visible {
+    outline: 2px solid #00ffff;
+    outline-offset: 2px;
+    border-color: rgba(255,255,255,0.7);
 }
@@ -2353,8 +2356,10 @@
 .contact-input, .contact-textarea {
     ...
-    outline: none;
     transition: border-color 0.3s;
 }
-.contact-input:focus, .contact-textarea:focus {
-    border-color: rgba(255,255,255,0.35);
+.contact-input:focus-visible, .contact-textarea:focus-visible {
+    outline: 2px solid #00ffff;
+    outline-offset: 2px;
+    border-color: rgba(255,255,255,0.7);
 }
+
+/* ── グローバル: キーボード操作時の可視リング ── */
+button:focus-visible, a:focus-visible, [role="button"]:focus-visible {
+    outline: 2px solid #00ffff;
+    outline-offset: 2px;
+    box-shadow: 0 0 0 4px rgba(0,255,255,0.25);
+}
```

「inryokü 美学」と整合する `#00ffff`（CMY シアン）採用。`:focus-visible` でマウスクリック時には出さない。

---

### Fix 5 — C-8: ステータスメッセージの aria-live + Fix 5b: モーダルフォーカストラップ

```diff
--- a/p3_code_for_claude.js
+++ b/p3_code_for_claude.js
@@ -1559,7 +1559,7 @@
             <div class="email-signup-row">
                 <input type="email" id="email-input" placeholder="your@email.com" class="email-signup-input">
                 <button id="email-submit" class="email-signup-btn">→</button>
             </div>
-            <div class="email-signup-status" id="email-status"></div>
+            <div class="email-signup-status" id="email-status" role="status" aria-live="polite" aria-atomic="true"></div>
         `;

@@ -1639,7 +1639,7 @@
             <button id="contact-submit" class="contact-submit-btn">SEND</button>
-            <div class="contact-status" id="contact-status"></div>
+            <div class="contact-status" id="contact-status" role="status" aria-live="polite" aria-atomic="true"></div>

@@ -5295,9 +5295,11 @@
         const toast = document.createElement('div');
         toast.className = 'cart-toast';
+        toast.setAttribute('role', 'status');
+        toast.setAttribute('aria-live', 'polite');
         toast.textContent = `${p.name} (${selectedSize}) をカートに追加しました`;
         document.body.appendChild(toast);

@@ -4366,7 +4368,11 @@
         chat.innerHTML = buildChatHTML(cssMode);
+        // チャット応答領域をライブリージョン化
+        const chatMsgs = chat.querySelector('#chat-messages');
+        if (chatMsgs) {
+            chatMsgs.setAttribute('role', 'log');
+            chatMsgs.setAttribute('aria-live', 'polite');
+            chatMsgs.setAttribute('aria-atomic', 'false');
+            chatMsgs.setAttribute('aria-label', 'AI チャット応答');
+        }
         document.body.appendChild(chat);

@@ -5217,6 +5223,7 @@
 function showProductModal(idx) {
     ...
     const m = document.createElement('div');
+    const _previouslyFocused = document.activeElement;
     m.className = 'product-modal';
     m.setAttribute('role', 'dialog');
     m.setAttribute('aria-modal', 'true');
+    m.setAttribute('aria-labelledby', 'pm-title-' + p.id);
     m.innerHTML = `
     <div class="modal-overlay" id="pm-overlay"></div>
         <div class="product-detail glass-card">
-            <button class="product-close-btn" id="pm-close">✕</button>
+            <button class="product-close-btn" id="pm-close" aria-label="閉じる">✕</button>
             <div class="product-detail-inner">
                 <div class="product-image-wrap">
                     <img src="${p.image}" alt="${p.name}" class="product-detail-img">
                 </div>
                 <div class="product-info-wrap">
-                    <h2 class="product-title">${p.name}</h2>
+                    <h2 class="product-title" id="pm-title-${p.id}">${p.name}</h2>

@@ -5316,6 +5323,30 @@
     // 閉じる
     const closeModal = () => {
         m.classList.remove('modal-visible');
         m.classList.add('modal-closing');
-        setTimeout(() => m.remove(), 300);
+        setTimeout(() => {
+            m.remove();
+            // フォーカスを開く前の要素に戻す
+            if (_previouslyFocused && typeof _previouslyFocused.focus === 'function') {
+                _previouslyFocused.focus();
+            }
+        }, 300);
     };
     ...
+    // フォーカストラップ
+    function trapFocus(e) {
+        if (e.key !== 'Tab') return;
+        const focusables = m.querySelectorAll(
+            'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
+        );
+        if (focusables.length === 0) return;
+        const first = focusables[0];
+        const last = focusables[focusables.length - 1];
+        if (e.shiftKey && document.activeElement === first) {
+            e.preventDefault(); last.focus();
+        } else if (!e.shiftKey && document.activeElement === last) {
+            e.preventDefault(); first.focus();
+        }
+    }
+    m.addEventListener('keydown', trapFocus);
```

同パターンを `showCartDrawer` (`:5086-5215`) にも適用：`role="dialog"` `aria-modal="true"` `aria-label="カート"` を `drawer` に追加、`closeDrawer` でフォーカス返却。

---

## 補遺：触れていないファイル（Codex 編集中）への注意

`particle_speech_rings.js` / `particle_rings.js` / `particle_rings.css` / `p3_code_for_claude.js` は本監査では「読み取りのみ」。実装変更は Codex と調整。
ただし本ドキュメント Fix 1〜5 の `p3_code_for_claude.js` 編集は不可避のため、Codex 側の編集ブランチとマージする際に reconcile が必要。
`particle_rings.css:205-214` には既に `prefers-reduced-motion` が実装されており Pass。

## 推奨対応順序

1. **Critical 8 件 全て**（特に C-3, C-4, C-7, C-8 はキーボード/SR ユーザーの EC 完了に直結）
2. M-13 `user-scalable=no` の撤廃（1 行修正、巨大インパクト）
3. M-5 フォームラベル
4. M-2 ボタン枠コントラスト
5. M-12 アニメーション停止 UI（モーション過敏ユーザー向け一時停止ボタン）
6. その他

## 自動テスト推奨

- axe-core ／ Lighthouse Accessibility (mobile + desktop)
- VoiceOver (macOS / iOS) で カート追加 → チェックアウト到達まで通し操作
- TalkBack (Android) で同上
- キーボードのみで「商品閲覧 → 詳細 → サイズ選択 → カート → CHECKOUT」の通し操作

---

*End of audit. 司さんのコメント待ち。*
