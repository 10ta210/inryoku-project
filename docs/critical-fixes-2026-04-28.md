# inryokü P3 — Critical 級指摘の CSS 統合修正

**実施日:** 2026-04-28
**対象ファイル:** `p3_styles.css` のみ
**根拠ドキュメント:**
- `docs/accessibility-audit-2026-04-28.md` — Critical 8 件 (C-1〜C-8) のうち CSS で対応可能なもの
- `docs/mobile-ux-flow-2026-04-28.md` — 改善提案 1〜5

**触っていないファイル:** `index.html`, `p3_test.html`, `p3_code_for_claude.js`, `particle_rings.css`, `particle_rings.js`, `particle_speech_rings.js` — HTML 構造変更 (button 化 / landmark 追加 / aria-live) は別エージェント担当。本対応は CSS でできる範囲の最大値。

---

## 1. 変更箇所一覧 (CSS)

各箇所の CSS には `/* a11y-2026-04-28 v1: ... */` または `/* mobile-ux-2026-04-28 v1: ... */` のコメントで根拠を明記済み。

### A. コントラスト底上げ (C-6 / Major M-2)

| セレクタ | 行 (修正後概数) | 旧 | 新 | 効果 |
|---|---|---|---|---|
| `.product-specs` color | 1187 | `#666` (3.5:1) | `#b0b0b0` (~7.4:1) | 通常文字 AA 通過 |
| `.size-btn` border (base) | 1218 | `0.15` (1.6:1) | `0.4` (~3.4:1) | UI 要素 1.4.11 通過 |
| `.site-footer--mini .footer-toggle` color | 1773 | `0.15` (1.4:1) | `0.55` (~4.7:1) | ⓘ ボタン視認性 |
| `.site-footer--open .footer-toggle` color | 1786 | `0.4` | `0.7` | 同上 |
| `.footer-brand` font-size+color | 1788 | 8px / 0.2 | 11px / 0.65 | 装飾フォント実用化 |
| `.footer-link` font-size+color+underline | 1794 | 9px / 0.25 | 12px / 0.7 + underline | リンク識別 + AA |
| `.footer-stripe` font-size+color | 1800 | 8px / 0.15 | 10px / 0.55 | 法的注記の可読性 |
| `.cart-empty` color | 1854 | `0.3` (2.5:1) | `0.7` (~6.6:1) | 空カートメッセージ読める |
| `.cart-item-meta` color | 1884 | `0.35` | `0.6` | サイズ表示 |
| `.cart-item-remove` color | 1901 | `0.25` | `0.6` | 削除ボタン視認 |
| `.cart-stripe-note` color | 1941 | `0.25` (2.0:1) | `0.6` (~5.0:1) | 決済注記 |
| `.email-signup-label` size+color | 2257 | 9px / 0.4 | 11px / 0.75 | Press Start 2P 装飾 |
| `@keyframes labelPulse` 範囲 | 2265 | 0.35〜0.55 | 0.7〜0.9 | パルス中も常時 AA |
| `.email-signup-sub` color | 2271 | `0.25` | `0.6` | サブテキスト |
| `.email-signup-input` border | 2283 | `0.15` | `0.4` | UI 要素 1.4.11 |
| `.email-signup-input::placeholder` | 2296 | `0.2` | `0.55` | フォーム手がかり |
| `.email-signup-btn` border+text | 2300 | 0.15 / 0.5 | 0.4 / 0.75 | 送信ボタン視認 |
| `.email-signup-status` color | 2315 | `0.4` | `0.75` | 送信中・成功通知 |
| `.contact-toggle` size+color+tap target | 2330 | 9px / 0.3 / no-pad | 11px / 0.7 / min-height 44 | C-6 + tap target |
| `.contact-input/.contact-textarea` border | 2348 | `0.12` | `0.4` | UI 要素 1.4.11 |
| `.contact-input/textarea ::placeholder` | 2362 | `0.2` | `0.55` | フォーム手がかり |
| `.contact-submit-btn` border+text+font-size | 2371 | 0.15 / 0.5 / 9px | 0.4 / 0.75 / 11px | 送信ボタン |
| `.contact-status` color | 2437 | `0.4` | `0.75` | 送信ステータス |
| `#chat-tp-input` border-bottom | 1740 | `0.3` | `0.55` | テレパシーバー視認 |

### B. focus-visible 復活 (C-7) + div ベース UI のフォーカス対応 (C-4 補完)

`outline:none` を維持しつつ `:focus-visible` でシアン (#00ffff, CMY) アウトラインを復活。マウスクリック時には出ないので「inryokü 美学」維持。

- `.email-signup-input:focus-visible` — `outline: 2px solid #00ffff; outline-offset: 2px;`
- `.contact-input:focus-visible, .contact-textarea:focus-visible` — 同上
- `#chat-input:focus-visible` — outline-offset:1px (タイトな枠)
- `#chat-tp-input:focus-visible` — outline-offset:4px (フルスクリーンバー)
- グローバルルール (末尾): `button, a, [role="button"], [tabindex], #cart-icon, #mute-btn, .footer-toggle, .size-guide-toggle, .carousel-item, .contact-toggle:focus-visible` に統一スタイル
  ```css
  outline: 2px solid #00ffff;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(0,255,255,0.25);
  ```
- `.skip-link` 用 CSS を先行で用意 (HTML 側 `<a class="skip-link">` 追加待ち; 該当要素なければ no-op)

### C. div ベース UI への cursor:pointer (C-4 CSS 側補完)

`#cart-icon, #mute-btn, .contact-toggle, .size-guide-toggle, .footer-toggle, .carousel-item` に `cursor: pointer` を一括付与。HTML 側を `<button>` 化するのは別エージェント担当だが、CSS で「クリック可能感」だけは出す。

### D. モバイル UX 提案 1〜5 (mobile-ux-flow から)

#### 提案 1: safe-area-inset 注入 (iPhone X+ ホームバー対応)

- `.singularity-content` (mobile) padding に `env(safe-area-inset-top/bottom)` 加算
- `#inryoku-chat` (mobile) `bottom: env(safe-area-inset-bottom, 0px)` (旧: `bottom: 0`)
- `#cart-drawer` (base) `top: env(safe-area-inset-top, 0px)` + `height: calc(100vh - top - bottom)`

> **司さんへ補足:** `viewport-fit=cover` を `<meta viewport>` に追加するのは HTML 側の作業 (別エージェント)。CSS だけで `env()` を入れても、cover でないと iOS は safe-area 値を 0 として返す。**HTML 側 viewport meta に `viewport-fit=cover` 追加** を別エージェントへ依頼必須。

#### 提案 2: `.size-btn` モバイル 40 → 44

```css
@media (max-width: 768px) { .size-btn { width:44; height:44; min-width:44; min-height:44; } }
```

base (`.size-btn`) は既に 44×44 だったので、mobile override の 40 を引き上げ。`min-*` を冗長に付与 (font 効果や子要素で縮まないよう保険)。

#### 提案 3: フォーム input ベース 16px (iPad 横でも auto-zoom 防止)

- `.email-signup-input` base font-size: 13 → **16**
- `.contact-input, .contact-textarea` base font-size: 13 → **16**

`@media (max-width:768px)` の 16px 上書きはそのまま残置 (重複だが副作用なし)。これにより iPad 横向き (1024px) でも 16px が維持され、フォーカス時の auto-zoom が抑止される。

#### 提案 4: カルーセルの touch-action

```css
@media (max-width: 768px) {
  .carousel-wrap { touch-action: pan-y; }
  .item-grid    { touch-action: pan-y; }
}
```

横方向は OS のスクロール対象から外し、JS の touchmove (`{passive:true}`) と縦スクロールの競合を解消。CSS だけで効く。

#### 提案 5: 商品カード文字 9 → 11px

```css
@media (max-width: 768px) {
  .product-card-name  { font-size: 11px; }
  .product-card-price { font-size: 11px; }
}
```

「OBSERVATION TEE」程度の長さは 118px 幅に 11px で 1〜2 行で収まる計算。

---

## 2. 触らなかった項目 (理由)

| 項目 | 理由 |
|---|---|
| C-1 landmark / skip-link 実装 | `<main>`/`<header>`/`<section>` 化は HTML 側作業。skip-link 用 CSS だけ先行配置済み (HTML 側追加待ち) |
| C-2 ロゴ alt / `<h1>` 化 | HTML 側 |
| C-3 商品カード button 化 | HTML 側。CSS 側は `cursor:pointer` + `:focus-visible` で補完済み |
| C-4 div→button 化 | HTML 側。CSS 側は `cursor:pointer` + `:focus-visible` で補完済み |
| C-5 フォーカストラップ | JS 側 (`p3_code_for_claude.js`) |
| C-8 aria-live | HTML/JS 側 |
| viewport-fit=cover | HTML 側 (`p3_test.html`, `index.html` の `<meta viewport>`) |
| `.product-specs` などの !important 9px | 既存 `!important` ブロック (l.2862-2869) との衝突回避のため、サイズは触らず色のみ底上げ。サイズ底上げが必要なら別タスクで !important ブロック整理 |

---

## 3. 司さんが実機で確認すべき変更点リスト

### A11y (キーボード / SR)

- [ ] **A-1** Tab キーでメール入力欄にフォーカス → シアン枠が出るか (Mac Safari / Chrome)
- [ ] **A-2** Tab で CONTACT 送信ボタンにフォーカス → シアン枠 + box-shadow 確認
- [ ] **A-3** マウスでメール欄をクリック → シアン枠が**出ない**こと (`:focus-visible` 動作)
- [ ] **A-4** カルーセルのカードに Tab で到達するか (HTML 側 button 化前は `[tabindex]` 必要、未対応なら次フェーズ)
- [ ] **A-5** フッター ⓘ が黒背景でちゃんと見えるか (旧 0.15 透過からの改善体感)
- [ ] **A-6** カート空状態の "Cart is empty" メッセージが読めるか
- [ ] **A-7** 商品モーダル下の `.product-specs` (素材表記) が読めるか

### モバイル

- [ ] **M-1** iPhone X+ で `#inryoku-chat` がホームインジケーター (34px) と被らないか
- [ ] **M-2** iPhone X+ でカートドロワーが notch・ホームバーと被らないか
- [ ] **M-3** iPhone でページ最下部までスクロール可能か (CONTACT が見切れない)
- [ ] **M-4** iPad 横向き (1024px) でメール欄タップ → auto-zoom **しない** こと (旧: 13px ズーム発動 / 新: 16px 維持)
- [ ] **M-5** iPad 横で CONTACT textarea も同様に auto-zoom しないこと
- [ ] **M-6** 商品モーダルでサイズボタンが指で確実にタップできるか (40→44)
- [ ] **M-7** カルーセルを斜めスワイプ → 縦スクロールが乱れず、横は意図通り回るか (touch-action: pan-y)
- [ ] **M-8** 商品カード名・価格が 11px で 1〜2 行収まっているか / 折り返し崩れがないか

### 既知の前提

- `viewport-fit=cover` が HTML 側に**まだ入っていない** 状態で `env(safe-area-inset-*)` は 0 を返す → 上記 M-1, M-2 は HTML 側修正後に再確認
- `.product-specs` などサイズが 9px !important で固定の箇所はサイズ未変更 (色のみ底上げ)。サイズ底上げが必要なら !important ブロック整理を別タスク化
- グローバル `:focus-visible` ルールは `box-shadow` も付くので、近接要素と重なる場合は調整余地あり (実機で違和感があれば `box-shadow` だけ削る)

---

## 4. 副作用チェック (壊していないこと)

- `.brand-name` — 触らず (色は brand-char で個別指定、コントラスト議論は M-3 別マター)
- `.singularity-content` — モバイル padding に `env()` 加算のみ。デスクトップは無変更
- `.product-card-img` — 無変更
- `.size-btn` 既存 base (44px) — 無変更; mobile override の 40 → 44 のみ
- 既存 `!important` ブロック (l.2862-2879) との衝突なし (色とサイズの方向性が一致)
- `outline:none` を全て削除しているわけではなく、`:focus-visible` で**復活**させているので、マウス操作時の見た目は変わらない

## 5. CSS 整合性

- 中括弧バランス: open 499 / close 499 ✅
- ネスト深度: 最終 0 ✅ (`@media` ブロック含めて整合)
- 既存セレクタ重複なし、追加分はすべて末尾または既存ルールへの差分

---

*完了。実機確認は M-1〜M-2, M-4 が最優先 (購入ファネル直結)。*
