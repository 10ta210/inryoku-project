# states UX layer — 設計と置換提案

2026-04-28 / inryokü
file: `/states.js` + `/states.css` (新規) / `/tests/states.test.mjs`

## 1. 目的

サイト全体で散在していた「空」「読み込み中」「エラー」の表示を、
`window.inryokuStates` の 4 関数で**統一**する。

- grey ベース / 静謐 / 余白 / 装飾過多回避 (inryokü 美学)
- aria-live で SR にも届ける
- 既存 production code (`p3_code_for_claude.js` / `particle_*` / `error-shield.js` / `enhance.js`) には触らない後付けレイヤ

## 2. API

```js
window.inryokuStates.showLoading(target, opts);
window.inryokuStates.showEmpty(target, opts);
window.inryokuStates.showError(target, opts);
window.inryokuStates.hide(target);
window.inryokuStates.MESSAGES; // 文言辞書
```

- `target`: `Element` または CSS セレクタ文字列
- `opts`:
  - `message?: string` — 主文。省略時は kind ごとの既定文言
  - `sub?: string` — 補足
  - `role?: 'status'|'alert'` — 既定: error は alert / それ以外は status
  - `kind?: string` — `data-kind` 属性に転写 (CSS フック用)

### a11y

| kind | role | aria-live | aria-busy (target) |
|------|------|-----------|--------------------|
| loading | status | polite | true |
| empty | status | polite | (なし) |
| error | alert | assertive | (なし) |

表示中は target の既存子要素に `aria-hidden="true"` を一時付与。`hide()` で復元。

### 多重表示制御

同一 target に対して `show*` を続けて呼ぶと、前の state を `hide()` してから新規表示。
state ノードは常に 1 つ。

## 3. 文言パターン一覧

| ID            | 用途           | 文言 |
|---------------|----------------|------|
| cartEmpty     | カート空       | `the cart is empty. observation begins here.` |
| productLoading| 商品ロード中   | `the wave forms...` |
| aiThinking    | AI 待ち        | `the observer thinks...` |
| searchEmpty   | 検索結果なし   | `no signal in this direction.` |
| networkError  | ネットワーク失敗 | `the connection is grey.` |
| completed     | 完了           | `the wave reached you.` |
| validation    | 入力不備       | `this needs more shape.` |
| (loading)     | 既定 loading   | `the wave forms...` |
| (empty)       | 既定 empty     | `silence is also a color.` |
| (error)       | 既定 error     | `the connection is grey.` |

## 4. 既存箇所の置換提案 (実装は申送り)

> 以下は **提案 diff**。production code (`p3_code_for_claude.js` 等) は今フェーズでは触らない。
> 後続タスクで shield 層 (`copy-fix-runtime.js` 系) 経由 or 専用 wrapper で適用する。

### 4.1 cart 空表示

現状 (推定):
```js
if (cart.items.length === 0) {
  cartEl.innerHTML = '<p>カートは空です</p>';
}
```

提案:
```diff
- cartEl.innerHTML = '<p>カートは空です</p>';
+ window.inryokuStates.showEmpty(cartEl, {
+   message: window.inryokuStates.MESSAGES.cartEmpty
+ });
```
解除側:
```diff
+ window.inryokuStates.hide(cartEl);
  renderCart(cart.items);
```

### 4.2 商品リスト読み込み中

```diff
- listEl.textContent = 'loading...';
+ window.inryokuStates.showLoading(listEl, {
+   message: window.inryokuStates.MESSAGES.productLoading
+ });
  fetch('/api/products').then(r => r.json()).then(items => {
+   window.inryokuStates.hide(listEl);
    renderList(items);
  }).catch(() => {
+   window.inryokuStates.showError(listEl, {
+     message: window.inryokuStates.MESSAGES.networkError,
+     sub: 'retry possible.'
+   });
  });
```

### 4.3 AI チャット待機中

```diff
- chatEl.appendChild(makeMsg('thinking...'));
+ window.inryokuStates.showLoading(chatPendingEl, {
+   message: window.inryokuStates.MESSAGES.aiThinking
+ });
```
返答到着時に `hide(chatPendingEl)`。

### 4.4 検索結果なし

```diff
- if (results.length === 0) resultEl.textContent = 'no results';
+ if (results.length === 0) {
+   window.inryokuStates.showEmpty(resultEl, {
+     message: window.inryokuStates.MESSAGES.searchEmpty
+   });
+ } else {
+   window.inryokuStates.hide(resultEl);
+   renderResults(results);
+ }
```

### 4.5 フォーム validation

`copy-fix-runtime.js` が alert 文言を上書きしている既存路線と並走する形で、
inline エラー表示には `showError(formFieldEl, { message: MESSAGES.validation, kind: 'validation' })`
を提案。完了通知は `MESSAGES.completed`。

## 5. 非干渉チェック

- `window.__inryokuStates` 専用フラグ（既存の `__inryokuErrorShield` とは別名）
- 二重ロード安全 (テスト済)
- `error-shield.js` の toast / `ai-chat-client-shield.js` の fallback 通知とは
  別レイヤ (inline state 表示) なので役割衝突なし
- `i18n.js` 連携は今フェーズ未対応 (英文固定)。後続で `data-i18n` 化 or 文言キー差し替え

## 6. 既知の制約 / 申送り

- `flex` レイアウトで center 配置するため、target が `display: contents` 等の場合は
  追加 wrapper を用意する必要あり
- アニメーションは `prefers-reduced-motion: reduce` で停止（CSS で対応済）
- ダーク配色は `prefers-color-scheme: dark` 自動対応 (grey の中間値で破綻回避)
- production への適用 PR は別タスク化推奨

## 7. テスト

- `/tests/states.test.mjs` — 17 テスト
- API 公開 / 各 kind の DOM・aria 属性 / hide / 多重表示 / target 解決 / 非干渉
- 既存 318 テストと併せて 335 全パス確認済 (`npm test`)
