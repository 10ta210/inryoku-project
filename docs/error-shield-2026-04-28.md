# error-shield.js — 実装解説

> **Date**: 2026-04-28
> **Scope**: グローバルエラーハンドラ + 観測者調 toast UI + サーバ側 `/api/error` 受信
> **Origin doc**: `docs/error-handling-audit-2026-04-28.md` Section 6
> **Brand voice**: `docs/copy-audit-2026-04-28.md`
> **Non-destructive principle**: enhance.js / copy-fix-runtime.js と同じ後付けレイヤとして追加。既存スクリプトの内部状態を一切読み書きしない。

---

## 1. 何のために作ったか

audit Section 6.1 の通り、inryokü には今までグローバルな `window.onerror` / `unhandledrejection` リスナが存在しなかった。
- 各処理は局所 try/catch のみ
- WebGL コンテキストロスは無視 → 黒画面のまま
- localStorage 拒否（プライベートモード）の通知なし
- 致命エラーが console に消えるだけで、本番で何が壊れているのか分からない

`error-shield.js` はこの空白を埋める。**既存コードを 1 行も変更せず、ロードするだけで動く**。

---

## 2. ロード位置と順序

`p3_test.html` / `index.html` の `<body>` 末尾に追加（defer ロード）。

```html
<!-- error-shield-2026-04-28 -->
<script src="error-shield.js?v=20260428" defer></script>
<script src="copy-fix-runtime.js?v=20260428" defer></script>
<script src="enhance.js?v=20260428" defer></script>
<script src="register.js?v=20260428" defer></script>
```

**copy-fix-runtime.js より前**にロードする理由:
- copy-fix-runtime は `window.alert` を上書きする
- error-shield は alert を触らない
- copy-fix-runtime のロード中に出るエラーも error-shield で拾えるよう、shield を先に評価

ただし両方とも `defer` なので評価順は宣言順（HTML の出現順）に従う。

---

## 3. 主要機能

### 3.1 グローバルキャッチ
- `window.addEventListener('error', ..., true)` (capture phase) — 通常エラー + リソース読み込み失敗 (`<img onerror>` 等) も拾う
- `window.addEventListener('unhandledrejection', ...)` — Promise rejection 補足

### 3.2 dedup + キューイング
- 最大 50 件メモリ保持（`MAX_QUEUE`）
- 同一エラー（type + msg + src:line）は 1 エントリにまとめ `count++`
- dedup マップは 200 件で reset（メモリリーク防止）

### 3.3 バッチ送信
- **5 秒間隔** または **10 件溜まったら即送信**
- `navigator.sendBeacon('/api/error', ...)` 優先（unload-safe）
- 失敗時は `fetch` keepalive にフォールバック
- ページ離脱 (`pagehide` / `visibilitychange`) で確実 flush

### 3.4 オフライン耐性
- `navigator.onLine === false` のとき → `localStorage['inryoku.errq']` にバックアップ（最大 50 件）
- localStorage 容量超過 → メモリオンリー（送信は次の online で）
- `online` イベントで永続キューを `sendBeacon` で flush

### 3.5 dev / prod 切り分け
- **localhost / 127.0.0.1 / *.local / file://** → dev mode: `console.warn` のみで送信しない
- それ以外 → prod: 通常送信

### 3.6 ブランド文言変換
`brandify(rawMsg)` でエラー種別をパターンマッチ:
- network / fetch failed → `the connection is grey.`
- quota / storage → `your memory has no room.`
- webgl / context lost → `the apparatus paused. observe again.`
- timeout → `signal in transit. give it a breath.`
- default → `the wave shifted. observe again.`

公開 API `window.inryokuShield.brandify(msg)` で他コードからも使える。

### 3.7 toast UI
- `aria-live="polite"` 既定（`role="alert"` 指定時は assertive）
- `aria-atomic="true"` で全文読み上げ
- 画面下中央 / モバイル (≤520px) は左右 16px 余白で下端
- 自動消滅 4 秒（リトライボタン付きの場合は ttl=0）
- dismiss ボタン (`×`) で閉じる
- inryokü 美学: grey ベース、blur backdrop、opacity トランジション
- `prefers-reduced-motion: reduce` 尊重

### 3.8 specific handlers

| 種類 | 動作 |
|------|------|
| WebGL `webglcontextlost` | `preventDefault()` で黒画面回避 + リトライボタン付き toast (リロード提案) |
| WebGL `webglcontextrestored` | 復帰ログ |
| localStorage 不可 | 起動時 1 回だけ「private observation. 番号は記録されません。」toast |
| Service Worker error | 静かに log のみ（register.js の挙動と整合） |
| `offline` event | `the connection is grey.` toast |
| `online` event | `the signal returned.` toast + 永続キュー flush |

### 3.9 リトライ機構
toast に `retry` callback を渡すと「retry」ボタンが出る。WebGL contextlost の場合は `location.reload` を提案。

---

## 4. サーバ側 `/api/error`

`server.js` に追加（contact endpoint の直前）:

- **rate limit**: 10/min/IP (専用バケット `error`)。さらに上位の `generic 60/min` も二重で効く。
- **payload 上限**: 16KB（`readBody(req, res, 16 * 1024, ...)`）。一般 API の 50KB より絞る。
- **入力検証**: 各フィールド whitelist + truncate (msg ≤ 500, stack ≤ 1500, ua ≤ 200, ...)
- **PII**: クライアント IP は `sha256(ip + IP_SALT)` の先頭 12 文字のみログに残す
- **永続化**: しない。`console.warn('[error-shield]', ipHash, JSON)` のみ
- **レスポンス**: `{ received: N }` (200)

### セキュリティ整合
- 既存の `withSecHeaders` ラッパで自動的にセキュリティヘッダ付与
- 既存の `checkRate` API を流用 → CSP / Permissions-Policy 等は変更なし
- バッチ最大 50 件で打ち切り（DoS 防止）

---

## 5. copy-fix-runtime.js との非干渉

copy-fix-runtime.js は `window.alert` を一段ラップして開発者向け文言を顧客向けに書き換える。

error-shield.js は:
- `window.alert` に **一切触らない**
- `window.onerror` (= `addEventListener('error')`) と `unhandledrejection` だけを扱う
- `window.confirm` / `prompt` も触らない

→ 両者は独立して動作する。alert 経由のエラーメッセージは copy-fix-runtime が、コード内 throw / 非同期エラーは error-shield が担当する分業。

---

## 6. 触らないファイル

audit のルールに従い、以下は一切変更していない:
- `p3_code_for_claude.js` / `particle_*.{js,css}` / `p3_styles.css` / `particle_rings.css`
- `enhance.js` / `sw.js` / `register.js` / `i18n.js` / `copy-fix-runtime.js`

変更したのは:
- 新規: `error-shield.js`
- 新規: `docs/error-shield-2026-04-28.md` (本ドキュメント)
- `server.js`: `/api/error` ハンドラ追加 (contact の直前)
- `p3_test.html`: `<body>` 末尾に script 追加
- `index.html`: `<body>` 末尾に script 追加

---

## 7. 動作確認手順

### 7.1 syntax
```sh
node --check error-shield.js   # OK
node --check server.js         # OK
```

### 7.2 dev mode
1. `node server.js`
2. `http://localhost:3000/p3_test.html` を開く
3. DevTools console で:
   ```js
   inryokuShield.report('test message');
   throw new Error('hello shield');  // ← shield が捕捉
   Promise.reject('async fail');     // ← shield が捕捉
   ```
4. console に `[error-shield] dev queue flush [...]` が出る（**送信されない**）

### 7.3 prod mode（本番ドメインで確認）
1. error が発生した時、`POST /api/error` が DevTools Network に出る
2. server log に `[error-shield] <ipHash> {...}` が出る
3. DevTools → Network → Offline → 何かエラー発生 → online 復帰 → 送信される

### 7.4 toast UI
```js
// 任意の文言で toast を出す
inryokuShield.toast({ text: 'the wave broke', subtext: '波が砕けた', role: 'status' });
inryokuShield.toast({
  text: 'connection failed',
  retry: () => console.log('retried'),
  ttl: 0
});
```

### 7.5 specific handler 検証
- **WebGL contextlost**: DevTools console で
  ```js
  document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context').loseContext();
  ```
  → 「the apparatus paused.」 toast + retry ボタン
- **offline**: DevTools → Network → Offline トグル → 「the connection is grey.」
- **localStorage**: Safari Private Browsing → ページ訪問 → 「private observation.」が一度だけ表示

### 7.6 既存機能非破壊
- カート追加・削除
- subscribe メール登録
- contact 送信
- AI チャット
- 言語切替（i18n）
- BGM mute
- ロゴ球体・粒子宇宙のレンダリング
全て触れていないので、変更後も動作するはず。

---

## 8. 将来の拡張ポイント

- **サンプリング**: `SAMPLING = 1.0` を 0.1 に下げて 10% のみ送信（本番でログ量制御）
- **session id**: 同一セッションのエラーを束ねるなら `sessionStorage` に UUID を持たせて `session_id` フィールドを追加
- **永続ファイル化**: `console.warn` を `data/errors.log` への append に変更（`fs.appendFile`）。日次ローテ前提。
- **i18n**: toast 文言を `i18n.json` に登録し、`?lang=en` 切替に追従

---

## 9. 設計判断の記録

### なぜ alert を触らないか
copy-fix-runtime が既に alert を上書き済み。**1 つの仕組みは 1 箇所で完結する**を守るため、shield は別レイヤ（runtime error）に専念。

### なぜ DB に保存しないか
audit が「DB 不要」と明示。エラーログは server stdout に流して fluent-bit / Loki / Sentry のいずれかに後付けで吸わせる前提。
ファイル append にすると disk full / lock 競合の追加リスクが増える。

### なぜ rate limit が 10/min と厳しめか
- 1 ユーザが 1 分に 10 回もエラー送信を必要とすることは稀（バースト 10 件は 1 リクエストに束ねられるため）
- 攻撃者が `/api/error` で disk / log を膨張させる DoS を抑止
- generic 60/min の枠と二重で守る

### なぜ console.warn のみか
prod の冗長ログを避けつつ、本番運用時に重要シグナルとして拾える `warn` レベルを選択。 `error` は既存コード内の本物のエラーで予約済み。

### なぜ MutationObserver で canvas を監視するか
particle_universe / logo sphere は遅延ロードで canvas を後から追加する。DOMContentLoaded 時点では存在しない可能性があるため、追加された時点で `webglcontextlost` リスナを attach する。

---

**文末**: observed errors are 50%. unobserved errors are still grey.
— inryokü error-shield, 2026-04-28
