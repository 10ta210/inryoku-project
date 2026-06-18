# ai-chat-client-shield — クライアント側 fallback handler — 2026-04-28

`/api/chat` の信頼性強化（`docs/ai-chat-reliability-2026-04-28.md`）の **クライアント側
受け** を、`p3_code_for_claude.js`（hot file = 直接編集禁止）に触らずに後付けする
レイヤ。

参照:
- `docs/ai-chat-reliability-2026-04-28.md` — サーバ契約 (`role: "system"` + `fallback: true`)
- `docs/error-shield-2026-04-28.md` — 既存 `window.inryokuShield.toast` API
- `ai-chat-client-shield.js` — 本実装
- `tests/ai-chat-client-shield.test.mjs` — 23 テスト

## 1. 何を解決するか

`error-handling-audit-2026-04-28.md` Issue #2:
> サーバが返す fallback 文言が assistant role として履歴に永続保存され、
> 「AI が答えた」とユーザに誤認させる。

サーバ側は 2026-04-28 で `role: "system"` + `fallback: true` で正直に返すように
なった。本当はクライアント (`p3_code_for_claude.js`) がこれを見て履歴 push を
スキップするべきだが、当該ファイルは hot file 制約で本フェーズでは触れない。

そこで、`window.fetch` を **プロキシして**:

1. `/api/chat` への POST レスポンスを clone して JSON を覗く。
2. `fallback: true` を検知したら
   - `error-shield.js` の `window.inryokuShield.toast()` で控えめな aria-live toast を表示
   - `localStorage` (`inryoku.chat.shield.stats`) に kind 別カウンタを永続化
   - `onFallback(cb)` リスナに通知
3. レスポンス本体 (Promise) はそのまま返すので、既存の p3 ロジックは破壊しない。

履歴への append 抑止は p3 側の修正が前提だが、本 shield が **判定 API**
(`window.inryokuChatShield.shouldAppendToHistory(payload)`) を提供しておくので、
将来 1 行差し込めば済む形にしてある（後述「§4 将来 diff 提案」）。

## 2. 設計判断

### なぜ fetch プロキシか
- p3 側の sendMessage / appendMessage を上書きするのは内部 API への依存が強い。
- fetch wrap は web 標準依存で、p3 のリファクタに追従しなくて済む。
- 副作用のみ。Promise も Response も透過するので、既存コードからは「何も起きていない」ように見える。

### なぜ Response.clone() か
- 元の `res.json()` は **1 回しか呼べない**。p3 が後で読むので、shield は clone を読む。
- content-type が JSON でない場合は早期 return（HTML エラーページの誤検知を避ける）。

### toast の控えめさ
- `role: 'status'`（assertive ではなく polite）。スクリーンリーダーが割り込まない。
- 文言は kind 別 6 種 + unknown（`TOAST_BY_KIND`）。サーバの fallback 文言と詩的に
  揃えてある。
- 連続 fallback (`consecutive >= 3`) で sub 文言だけ強める（過度に煽らない）。

### localStorage を使う理由
- 障害発生率を運用側で見たいが、サーバ集計だけだと「ユーザに何が見えたか」は
  分からない（クライアントが想定外の状態に入っている可能性がある）。
- `inryokuChatShield.stats()` を DevTools で叩けば即確認できる。
- セッション越境では `consecutive` のみリセット（連続性は同セッション限定の意味）。

### 重複起動防止
- `window.__inryokuChatShield` フラグ。HMR / 開発中の重複 script タグや
  Service Worker 経由の再ロードで `fetch` が二重に wrap されないように。

## 3. 公開 API

```js
window.inryokuChatShield = {
  onFallback(cb)             // (info) => void; unsubscribe 関数を返す
  stats()                    // { totalRequests, fallbackCount, byKind, lastKind, consecutive, ... }
  reset()                    // counters + localStorage クリア
  shouldAppendToHistory(p)   // boolean: 履歴に push してよいか
  detectFallback(p)          // info | null
  _internal: { processResponse, isChatRequest, wrappedFetch }
};
```

DevTools 利用例:
```js
inryokuChatShield.stats()
// { totalRequests: 14, fallbackCount: 2, successCount: 12,
//   byKind: { server_5xx: 1, timeout: 1 }, lastKind: 'timeout', consecutive: 0 }

inryokuChatShield.onFallback((info) => {
  console.warn('chat fallback', info.kind, info.meta);
});
```

## 4. 将来 diff 提案 — `p3_code_for_claude.js`

p3 側で chat 応答を履歴に push する箇所（疑似コード）:
```js
// 現状（推定）
const data = await res.json();
this.history.push({ role: 'assistant', content: data.response });
this.renderMessage(data.response);
```

shield が gating API を露出済みなので、p3 を触れるフェーズで以下に置換すれば
fallback 時の履歴汚染が完全に止まる:

```js
const data = await res.json();
const shield = window.inryokuChatShield;
if (shield && !shield.shouldAppendToHistory(data)) {
  // fallback: 表示はする（toast は shield 側で出る）が history には積まない
  this.renderTransient(data.response);   // または既存 renderMessage を「履歴に積まない」フラグ付きで
  return;
}
this.history.push({ role: 'assistant', content: data.response });
this.renderMessage(data.response);
```

最小差分（保険版・shield 不在でも壊れない）:
```js
const isFallback = data && data.fallback === true && data.role === 'system';
if (isFallback) {
  this.renderMessage(data.response);  // 表示のみ
  return;                              // history には push しない
}
this.history.push({ role: 'assistant', content: data.response });
this.renderMessage(data.response);
```

どちらに倒すかは p3 リファクタ (`docs/p3-refactor-proposal-2026-04-28.md`) と合わせて判断。

## 5. テスト

`tests/ai-chat-client-shield.test.mjs` に 23 テスト:

- 純粋関数: `detectFallback`, `shouldAppendToHistory`, `makeStats`/`recordSuccess`/`recordFallback`
- JSDOM 統合:
  - `/api/chat` 以外 / GET は計測しない
  - 通常応答で successCount++
  - fallback 応答で fallbackCount/byKind/lastKind 記録 + onFallback 発火
  - fallback → 成功 で consecutive リセット
  - localStorage 永続化
  - reset() で全クリア
  - `inryokuShield.toast` があれば呼ばれる
  - content-type 非 JSON は無視
  - 二重 install 防止

`npm test` で全 318 件パス（既存 295 + 新規 23）。

## 6. HTML 統合

`error-shield.js` の **直後** にロード（toast 機構が先に立ち上がっている必要がある）:

```html
<script src="error-shield.js?v=20260428" defer></script>
<script src="ai-chat-client-shield.js?v=20260428" defer></script>
```

統合済み:
- `index.html`
- `p3_test.html`

## 7. 触っていないもの

- `server.js`
- `p3_code_for_claude.js`
- `particle_*.{js,css}`
- `error-shield.js`
- 既存テストファイル
