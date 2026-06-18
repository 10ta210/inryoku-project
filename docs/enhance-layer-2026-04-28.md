# inryokü Enhancement Layer — a11y + browser compat 後付け実装

**実装日:** 2026-04-28
**対象:** `p3_test.html` / `index.html`
**新規ファイル:**
- `/Users/10ta210/Desktop/inryoku_hp/enhance.js`
- `/Users/10ta210/Desktop/inryoku_hp/enhance.css`

**設計原則:**
- 既存 DOM / スクリプトを破壊しない（後付けで属性・要素・CSS を補完）
- vanilla JS / CSS のみ、ライブラリ追加禁止
- Codex 編集中ファイル（`particle_*.* / p3_code_for_claude.js / p3_styles.css / server.js`）一切触らない
- すべての処理を `try/catch` で隔離、1 機能の例外で他機能を巻き込まない
- 動的 DOM (`renderPhase3` が `#root.innerHTML` を後から書き換える) に対応するため `MutationObserver` で再適用

**参照ドキュメント:**
- `docs/accessibility-audit-2026-04-28.md` (Critical 8 / Major 14)
- `docs/browser-compatibility-matrix-2026-04-28.md` (Issue I-1〜I-20)
- `docs/critical-fixes-2026-04-28.md` (`p3_styles.css` 側で実装済みのもの)

---

## 1. ロード方法

`<body>` の最後尾、既存のすべての `<script>` の **後** に追加（`<head>` には触れない）。

```html
<!-- enhance-layer-2026-04-28: a11y + browser compat 後付けレイヤ -->
<link rel="stylesheet" href="enhance.css?v=20260428">
<script src="enhance.js?v=20260428" defer></script>
</body>
```

`p3_test.html:480` / `index.html:1406` 直前に追加済み。

---

## 2. 実装機能マッピング

### A11y

| # | 機能 | 実装箇所 (enhance.js) | WCAG | 監査項目 |
|---|---|---|---|---|
| A1 | skip link 注入（focus 時のみ可視） | `injectLandmarks()` 218-227 行目 | 2.4.1 | C-1 |
| A2 | `#root` を `role="main"` 化 + `#enh-main` アンカー | `injectLandmarks()` 230-248 行目 | 1.3.1, 2.4.1 | C-1 |
| A3 | sr-only `<h1>inryokü</h1>` をロゴ近傍に注入 | `injectLandmarks()` 250-257 行目 | 2.4.6, 1.3.1 | C-1, C-2 |
| A4 | div clickable に `role="button" / tabindex=0` + Enter/Space | `enhanceClickable()` 319-360 行目 / `enhanceAllClickables()` 362-398 行目 | 2.1.1, 4.1.2 | C-3, C-4 |
| A5 | SVG アイコンに `role="img"` / `aria-hidden` / `focusable=false` | `enhanceSVGs()` 404-432 行目 | 1.1.1, 4.1.2 | M-8 |
| A6 | モーダル開閉のフォーカストラップ（`trapFocus` / `releaseFocus`） | 450-599 行目 + `MutationObserver` | 2.4.3 | C-5 |
| A7 | グローバル `aria-live` 領域注入（polite / assertive） + `cart-badge` 監視 | `injectLiveRegions()` 269-298 行目 / `enhanceLiveTargets()` 605-645 行目 | 4.1.3 | C-8 |
| A8 | `:focus-visible` で全 interactive 要素に `#00ffff` アウトライン | enhance.css 62-91 行目 | 2.4.7, 1.4.11 | C-7 |
| A9 | `prefers-reduced-motion` JS 検知 → `<html class="enh-reduce-motion">` | 82-100 行目 + enhance.css 98-111 行目 | 2.3.3, 2.2.2 | M-11, M-12 |
| A10 | フォーム input に `aria-label` 補完（placeholder / id から推定）+ `autocomplete` ヒント | `enhanceForms()` 651-682 行目 | 3.3.2, 4.1.2, 1.3.5 | M-5, m-1 |
| A11 | `.brand-name` に `aria-label="inryokü"` + 子 `.brand-char` を `aria-hidden` 化 | `enhanceLogos()` 688-715 行目 | 2.4.6 | C-2 |
| A12 | `<html lang>` 未設定なら `ja` を付与 | `injectLandmarks()` 260-262 行目 | 3.1.1 | — |

### ブラウザ互換性

| # | 機能 | 実装箇所 | Issue |
|---|---|---|---|
| B1 | iOS `DeviceOrientationEvent.requestPermission()` を click/touch 時に発火 | `requestDeviceOrientation()` 187-207 行目 / 174 行目で `kick()` から呼出し | I-7 |
| B2 | `--enh-vh` CSS 変数フォールバック（`window.innerHeight * 0.01`） | 107-120 行目 + enhance.css `.enh-full-height` 118-122 行目 | I-3 |
| B3 | `visualViewport` API でキーボード高さを `--enh-kb-bottom` として供給 / `.enh-vv-tracked` クラス | 127-138 行目 + `enhanceChatInput()` 721-735 行目 + enhance.css 129-132 行目 | I-19 |
| B4 | AudioContext 一括 resume ヘルパ `window.__enhResumeAudio` (`p3AudioCtx, _brandSFCtx, _particleSpeakCtx, famicomACtx, audioContext, _inryokuAudioCtx` を一括) | 145-181 行目 | I-1, I-5 |
| B5 | `structuredClone` polyfill（iOS 15.3 以下） | 42-48 行目 | — |
| B6 | `ResizeObserver` no-op shim | 52-76 行目 | — |

---

## 3. 公開 API

`enhance.js` ロード後、以下が `window` から利用可能（既存コードからも安全に呼べる）：

```js
// アナウンス（chat 応答 / カート更新 / トースト）
window.__enhAnnounce('カートに追加しました', { assertive: false });

// AudioContext 一括 resume（ユーザージェスチャ後の任意タイミングで）
window.__enhResumeAudio();

// 名前空間
window.__inryokuEnhance.runAll();          // 全機能の再適用
window.__inryokuEnhance.trapFocus(el);     // 任意要素にフォーカストラップ
window.__inryokuEnhance.releaseFocus(el);  // 解除
window.__inryokuEnhance.announce(text);    // = __enhAnnounce
window.__inryokuEnhance.requestDeviceOrientation();
```

---

## 4. 動的 DOM への追従

`renderPhase3()` は `#root.innerHTML` を遅延的に書き換える（P2 → P3 の連鎖、約 3〜6 秒後）。
`enhance.js` は以下 4 段構えで再適用する（787 行目付近の `init()` 末尾）：

1. `DOMContentLoaded` で初回実行
2. `MutationObserver`（debounce 250ms）で `#body` 配下の変更を検知し再実行
3. `inryoku:p3complete` イベント便乗
4. 念押しの `setTimeout` 1s / 3s / 6s

モーダル開閉も `MutationObserver` (`watchModals()` 546-599 行目) で `class` / `style` 属性変化を捕捉して trap/release。

---

## 5. 司さん実機検証チェックリスト

### macOS Safari + VoiceOver
- [ ] ページロード直後に Tab 1 回 → 「メインコンテンツへスキップ」リンクが画面左上に見える
- [ ] そのまま Enter → ページ本体（`#enh-main`）にフォーカス移動
- [ ] VO+→ で見出しジャンプ → 「inryokü」(h1) が読まれる
- [ ] Tab で カート / ミュート / 商品カード / CONTACT / SIZE GUIDE / フッター ⓘ 全てに到達できる
- [ ] 商品カードで Enter → 商品詳細モーダル開、Tab しても背後のカードに抜けない
- [ ] モーダルを ESC で閉じると、開く前にフォーカスしていたカードに戻る
- [ ] カート追加すると VO が「カート内の商品: 1 点」と読み上げる
- [ ] CONTACT 送信時に「送信中…」「送信しました」が読み上げられる

### iOS Safari (実機)
- [ ] ENTER ボタン (もしくは何かタップ) で BGM が鳴る、かつ DeviceOrientation 許可ダイアログが出る
- [ ] 横回転すると視差が動く
- [ ] チャット入力にフォーカス → キーボード出現、入力欄がキーボード上に追従して隠れない（`.enh-vv-tracked` の効果）
- [ ] URL バー伸縮しても layout が崩れない（`--enh-vh` の効果は `.enh-full-height` を付けた場合のみ — 既存 100vh は影響なし）
- [ ] ピンチズーム — 既存の `user-scalable=no` のままなのでズーム不可（M-13 は別途 Codex 側修正）

### キーボードのみ
- [ ] Tab で 商品カードまで到達 → Enter で開
- [ ] サイズ選択（既存 `<button>`）→ ADD TO CART → Enter
- [ ] カートアイコン Tab → Enter で drawer 開
- [ ] CHECKOUT ボタンに Tab で到達

### prefers-reduced-motion
- [ ] macOS システム環境設定 → アクセシビリティ → 視差効果を減らす ON
- [ ] リロード → `<html class="enh-reduce-motion">` が付く
- [ ] アニメーションが大幅減（cursor trail / brand pulse / halo breathe 等が静止 or 高速完了）
- [ ] ただし fade-in (opacity transition) は残る（演出の核は維持）

### ブラウザ DevTools
- [ ] Console に `[enhance]` の警告が出ていないこと
- [ ] axe-core / Lighthouse Accessibility スコア 改善（目安: 60 → 85+）

---

## 6. 既存機能への非破壊性

意図的に避けた事項：
- `outline: none` を打ち消すため `:focus-visible` 系 CSS は `!important` を付けつつ、対象を限定セレクタに絞った（ページ全要素には及ばない）
- AudioContext resume は **既存 once ハンドラと衝突しないよう capture フェーズで非破壊リスナを追加**。`{ once: true }` 既存ハンドラはそのまま動く
- ESC 補助ハンドラは「監視のみ」で `preventDefault` 等を行わない → 既存 ESC ハンドラ（`p3_code_for_claude.js:5213, 5327`）を阻害しない
- `<main>` 化は `#root` を書き換えず `role="main"` 属性のみ追加（`<div>` のまま）
- フォーカストラップは MutationObserver でモーダルが「開いた」タイミングのみ起動、閉じた瞬間に解除

カバー率（Critical 8 件のうち）：
- C-1 landmark / skip link → ✅ A1, A2, A3, A12
- C-2 ロゴ alt / h1 → ✅ A3, A11
- C-3 商品カード → ✅ A4
- C-4 div ベース clickable → ✅ A4
- C-5 モーダルフォーカストラップ → ✅ A6
- C-6 コントラスト → ❌ enhance.css 範囲外（`p3_styles.css` 側で対応済 / 監査の Fix 3）
- C-7 focus-visible → ✅ A8
- C-8 aria-live → ✅ A7

**Critical カバー率: 7/8 = 87.5%**（C-6 は CSS の色変更が必須で後付けでは破壊的なため除外、`p3_styles.css` 側で別途対応済み）

ブラウザ互換性 P0 項目：
- I-1, I-5 AudioContext → ✅ B4
- I-3 100vh → ✅ B2（補助クラスで利用）
- I-7 DeviceOrientation → ✅ B1
- I-19 visualViewport → ✅ B3

---

## 7. 既知の制約 / 今後の課題

- `100vh` の置換は **既存 CSS が触れないため自動適用ではない**。必要箇所に `.enh-full-height` クラスを付ける必要があり、Codex 側で `p3_styles.css` の `100vh` を `100dvh` 化する PR で対応するのが最終解
- M-13 `user-scalable=no` の撤廃は `<head>` を触れないため未対応 → Codex に依頼
- M-2 ボタン枠コントラスト (1.6:1) は `p3_styles.css` 修正必須 → Codex 担当
- グリッチモード閃光 (M-10) は周波数測定が必要、本レイヤでは未対応
- カルーセル drag のキーボード alternative は未実装（M-14） — 矢印キー対応は次フェーズ

---

## 8. 検証コマンド

```bash
# 構文チェック
node --check /Users/10ta210/Desktop/inryoku_hp/enhance.js

# ローカルプレビュー
cd /Users/10ta210/Desktop/inryoku_hp && node server.js
# → http://localhost:8080/p3_test.html
```

DevTools Console で：
```js
__inryokuEnhance.version       // "2026-04-28"
__inryokuEnhance.announce('テスト');  // VO で読まれることを確認
```

---

*End of enhance-layer doc. 司さん実機検証コメント待ち。*
