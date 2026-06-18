# Runtime Fixes — 2026-04-28

`docs/runtime-verification-2026-04-28.md` で検出された 5 件の軽微な不整合を修正したサマリ。

- 実施日: 2026-04-28
- 影響範囲: `server.js`（5 修正）/ `tests/runtime-verification.test.mjs`（5 アサーション追加）/ docs（admin endpoint 表記修正）
- 既存テスト: 533 → 552 全パス（新規 19 件追加 — 既存 14 + 新規 5）
- セキュリティ姿勢: いずれも fail-closed を維持。緩和なし。

---

## 1. `readBody` の 413 が客に届かない（中）

### 症状
`server.js:724-740` で `req.destroy()` を `res.writeHead(413)` の **前**に呼んでいたため、socket reset によりクライアントは `HTTP 000 (Empty reply from server)` を受け取り、413 ステータスが届かなかった。

### 修正
`server.js:723-753`:
- 順序を `writeHead(413)` → `res.end(...)` → `setTimeout(50ms) → req.destroy()` に変更
- `exceeded` フラグで多重応答を防止
- `Connection: close` ヘッダで socket 再利用を抑止
- `req.on('error')` を swallow（fail-closed）

### 動作
60KB body 投入時、curl は `HTTP/1.1 413 Payload too large` + JSON `{"error":"Payload too large"}` を受け取る。

---

## 2. `/api/checkout` が 200 で error 返却（中）

### 症状
`server.js:1222` 付近で variant 未マップ / Shopify 未設定の両ケースで `200 OK` + `{"error": "..."}` を返していた。クライアントの `response.ok` 分岐が誤動作する。

### 修正
- Shopify env 未設定: **503 Service Unavailable** + `{ ok: false, error: "Shopify not configured (env missing)" }`
- variant 未マップ: **422 Unprocessable Entity** + `{ ok: false, error: "No Shopify variants mapped" }`
- invalid JSON: 400 維持 + `ok: false` 追加

クライアント側 (`shopify-proxy-client.js` / `p3_code_for_claude.js`) は触らないが、いずれも `response.ok` ベースの分岐が正しく動くようになる。既存の error メッセージ文字列は維持しているため、文字列マッチに依存している箇所も破壊しない。

---

## 3. `/api/shopify/graphql` 上流 401 → 403 にリマップ（中）

### 症状
allowlist 外 / token 不整合で Shopify upstream が 401 を返したとき、それをそのままクライアントに転送していた。プロキシ越しの 401 は「クライアントの認証問題」ではなく「サーバ側で許可されていない operation / token 構成不整合」を意味するため、403 が semantic 上正しい。

### 修正
`server.js:1208-1221` の upstream callback で `status === 401` のときのみ 403 にリマップ。それ以外の status はそのまま転送（502 等は既存のままハンドル）。
allowlist の事前ローカル拒否（`validateShopifyOperation` 経由）は元から 403 で応答しており変更なし。

---

## 4. MIME type 修正（軽微）

### 症状
- `/sitemap.xml` → `application/octet-stream`
- `/robots.txt` → `application/octet-stream`

### 修正
`server.js:305-322` の MIME map に追加:
```js
'.xml':  'application/xml; charset=utf-8',
'.txt':  'text/plain; charset=utf-8',
```

クローラ互換性は元から問題なかったが、仕様準拠。

---

## 5. `/sw.js` Cache-Control 短縮（軽微）

### 症状
`Cache-Control: public, max-age=86400, stale-while-revalidate=604800` で、Service Worker 更新が最大 24h 反映されない可能性。古い SW のスタックは PWA 更新失敗の温床。

### 修正
静的配信ヘッダ生成箇所（`server.js:1918` 付近）に sw.js の専用分岐を追加:
```js
const isServiceWorker = req.url === '/sw.js' || req.url.startsWith('/sw.js?');
if (isServiceWorker) {
    headers['Cache-Control'] = 'no-cache, max-age=0, must-revalidate';
}
```

毎回 304 確認になるためバンド幅増加は最小（数百 bytes）、SW 更新は即時反映。

---

## 6. docs: admin endpoint 表記修正

実体は `/api/subscribers` のみ。`/api/admin/*` 名前空間は実装されていない。以下を修正：

| File | 修正内容 |
|---|---|
| `docs/architecture-2026-04-28.md` | 認証マトリクス / env 表から `/api/admin/*` 削除、`/api/subscribers` のみに |
| `docs/PRODUCTION-LAUNCH-MASTER-2026-04-28.md` | P0-ADM-02 の curl コマンド例を `/api/subscribers` に / env 表脚注修正 |
| `docs/sitemap-monitoring-2026-04-28.md` | `/api/admin/rate-limit` を「未実装」と注記 |
| `docs/pwa-sw-2026-04-28.md` | SW キャッシュ除外リストから `/api/admin/*` 削除 |
| `docs/ai-chat-reliability-2026-04-28.md` | `/api/admin/chat-stats` を「未実装 / 将来案」に格下げ |

---

## 7. テスト追加

`tests/runtime-verification.test.mjs` に 5 アサーション追加:

1. `readBody`: writeHead(413) が req.destroy() より前にあること（コメント除去後の文字列インデックス比較）
2. `/api/checkout`: variant 未マップが 422、env 未設定が 503
3. `/api/shopify/graphql`: 401 → 403 リマップ記述の存在
4. MIME map に `.xml` / `.txt` が含まれること
5. `/sw.js` が短 TTL（no-cache / max-age 0..300）で配信されること

既存 14 アサーションは破壊せず、文末コメントの「将来 fix する候補」記述を更新。

---

## 完了条件チェック

- [x] `node -c server.js` 通る
- [x] `npm test` 全パス（552 件 / 552 件、新規 19）
- [x] 5 修正項目すべて実装 or docs 反映
- [x] クライアント側 production code (particle_*.* / p3_code_for_claude.js / 等) は無変更
- [x] fail-closed 維持

---

## 影響リスク評価

| 修正 | 互換性リスク | 緩和 |
|---|---|---|
| 1. readBody | なし（成功パスは無変更、413 が初めて届くようになるだけ） | 50ms 遅延 destroy で fail-closed 維持 |
| 2. checkout | 200→422/503 に変わるためクライアントが status code 判定していると挙動変化。但し error メッセージ文字列・JSON 形は維持 | shopify-proxy-client / p3 は確認のみで変更不要（response.ok で正しく分岐するようになる） |
| 3. shopify proxy 401→403 | 既存 401 を期待していたクライアントは無し（runtime-verification で初めて観測された) | upstream 502 等は転送維持 |
| 4. MIME | crawler 互換維持（多くは sniff） | charset=utf-8 付与 |
| 5. sw.js cache | 帯域微増（HEAD/304 が増える） | 既存 SW 更新の信頼性向上 |

---

参照: [`runtime-verification-2026-04-28.md`](runtime-verification-2026-04-28.md)
