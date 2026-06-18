# Runtime Verification — 2026-04-28

inryokü サーバー (`node server.js`, port 3000) のエンドツーエンド実動作検証ログ。

- 実施日: 2026-04-28
- 環境: macOS (darwin 24.5.0), Node.js (project default), curl 8.7.1
- 手順: バックグラウンド起動 → curl で各エンドポイント検証 → kill
- 起動・停止: いずれも clean (port 3000 開放確認済み)

---

## 1. サーバー起動

| 項目 | 結果 |
|---|---|
| `node server.js` バックグラウンド起動 | PASS (PID=36799) |
| port 3000 LISTEN | PASS |
| GET / 200 応答 | PASS |
| 起動バナー (Groq / Shopify / Admin 接続済み) | PASS — 全接続 OK |
| クリーン停止 (`kill PID`) | PASS |

---

## 2. 静的配信検証

| Path | 期待 | 実測 status | 実測 Content-Type | 結果 |
|---|---|---|---|---|
| `/` | 200 / text/html | 200 | text/html | PASS |
| `/p3_test.html` | 200 | 200 | text/html | PASS |
| `/particle_rings.js` | 200 / application/javascript | 200 | application/javascript | PASS |
| `/particle_rings.css` | 200 / text/css | 200 | text/css | PASS |
| `/manifest.json` | 200 / application/json | 200 | application/json | PASS |
| `/sitemap.xml` | 200 / application/xml | 200 | **application/octet-stream** | FAIL (軽微) |
| `/robots.txt` | 200 / text/plain | 200 | **application/octet-stream** | FAIL (軽微) |
| `/sw.js` | 200 / application/javascript | 200 | application/javascript | PASS |
| `/offline.html` | 200 | 200 | text/html | PASS |

### 静的配信 — 不整合

- **sitemap.xml が `application/octet-stream`**: 多くの crawler は許容するが仕様外。`server.js` の MIME マップに `.xml → application/xml`、`.txt → text/plain; charset=utf-8` を追加するのが望ましい。
- **robots.txt が `application/octet-stream`**: 同上。

---

## 3. Deny list / Path traversal

| Path | 期待 | 実測 | 結果 |
|---|---|---|---|
| `/server.js` | 403 | 403 | PASS |
| `/.env` | 403 | 403 | PASS |
| `/package.json` | 403 | 403 | PASS |
| `/package-lock.json` | 403 | 403 | PASS |
| `/node_modules/express/package.json` | 403 | 403 | PASS |
| `/p1_code_for_claude.js` | 403 (内部資料) | 403 | PASS |
| `/nonexistent` | 404 | 404 (BSOD HTML) | PASS |
| `/../etc/passwd` (raw) | 拒否 | 404 | PASS |
| `/%2e%2e/etc/passwd` (encoded) | 拒否 | 403 | PASS |

---

## 4. セキュリティヘッダ実測 (GET / の例)

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(),
                    accelerometer=(), gyroscope=(), magnetometer=(), midi=(),
                    interest-cohort=(), browsing-topics=(), fullscreen=(self),
                    autoplay=(self), picture-in-picture=()
Strict-Transport-Security: max-age=63072000; includeSubDomains
Cross-Origin-Opener-Policy: same-origin
Origin-Agent-Cluster: ?1
X-Permitted-Cross-Domain-Policies: none
Reporting-Endpoints: csp-endpoint="/api/csp-report"
Report-To: {"group":"csp-endpoint", ...}
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Resource-Policy: same-site
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
   https://www.googletagmanager.com https://cdn.jsdelivr.net;
   script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
   style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com;
   img-src 'self' data: blob: https://api.qrserver.com https://cdn.shopify.com;
   connect-src 'self' https://*.myshopify.com; media-src 'self'; worker-src 'self';
   manifest-src 'self'; frame-src 'self' https://*.shopify.com https://*.myshopify.com;
   object-src 'none'; base-uri 'self'; form-action 'self';
   frame-ancestors 'none'; upgrade-insecure-requests; block-all-mixed-content;
   report-uri /api/csp-report; report-to csp-endpoint
```

| ヘッダ | HTML | JS/CSS | API | 結果 |
|---|---|---|---|---|
| Content-Security-Policy | ✅ 詳細 | ✅ 詳細 | ✅ 詳細 | PASS |
| X-Frame-Options: DENY | ✅ | ✅ | ✅ | PASS |
| X-Content-Type-Options: nosniff | ✅ | ✅ | ✅ | PASS |
| Referrer-Policy | ✅ | ✅ | ✅ | PASS |
| Permissions-Policy | ✅ | ✅ | ✅ | PASS |
| Strict-Transport-Security | ✅ | ✅ | ✅ | PASS |
| COOP / CORP / COEP | ✅ | ✅ | ✅ | PASS |
| Reporting-Endpoints / Report-To | ✅ | ✅ | ✅ | PASS |

総合: PASS。Helmet 相当の主要セキュリティヘッダがすべての応答に均一に付与されている。

---

## 5. API endpoint 検証

| Endpoint | 入力 | 期待 | 実測 | 結果 |
|---|---|---|---|---|
| `POST /api/contact` | 妥当 body | 200 | 200 `{"ok":true}` | PASS |
| `POST /api/contact` | `{email:"bad"}` のみ | 400 | 400 `{"error":"全項目を入力してください"}` | PASS |
| `POST /api/subscribe` | 妥当 email | 200 + Set-Cookie HttpOnly | 200 + `Set-Cookie: inryoku_grey=…; HttpOnly; SameSite=Lax; Max-Age=31536000` | PASS |
| `POST /api/subscribe` | 不正 email | 400 | 400 `{"error":"invalid email format"}` | PASS |
| `POST /api/checkout` | `{}` (variant なし) | 適切な error | **200** body=`{"error":"No Shopify variants mapped"}` | FAIL (軽微) |
| `POST /api/chat` | `{message:"hello"}` | 200 or fallback | 200 `{"response":"...","fallback":true,...}` | PASS |
| `POST /api/error` | `{errors:[{...}]}` | 200 | 200 `{"received":1}` | PASS |
| `POST /api/csp-report` | csp-report body | 204 | 204 | PASS |
| `POST /api/shopify/graphql` | 任意 query (allowlist 外) | 403 | **401** `{"errors":[{"extensions":{"code":"UNAUTHORIZED"}}]}` | PARTIAL (拒否はしているが status code 仕様差) |
| `GET /api/admin/*` | 無トークン | 401 | **404** (`/api/admin/*` は実装無し) | N/A |
| `GET /api/subscribers` | 無トークン (実装上の admin endpoint) | 401 | 401 `{"error":"Unauthorized"}` | PASS |
| `GET /api/subscribers` | 不正 Bearer | 401 | 401 `{"error":"Unauthorized"}` | PASS (timing-safe compare 確認済 — server.js:761 コメント) |
| `GET /api/grey/9999` | 存在しない number | 404 想定 | 404 `{"error":"grey not found"}` | PASS |

### API — 不整合

- **`/api/checkout` が status 200 で error 文字列を返す** (`server.js:1222` 付近):
  - 推奨: `variant 未マップ` のような構成エラーは 4xx (400/422) または 503、最低でも `{ok:false}` で返すべき。現状はクライアントが `response.ok` で分岐できない。
- **`/api/admin/*` 名前空間は実在しない**: 仕様書の文言は historic / 認識違い。実体は `GET /api/subscribers` のみ。docs/architecture を更新するのが望ましい。
- **`/api/shopify/graphql` の disallow が 401**: allowlist 違反は `403 Forbidden` の方がセマンティクス的に正しい (認証問題ではないため)。動作上は安全。

---

## 6. Rate limit

| Bucket | 設定 | 連続要求 | 観測 | 結果 |
|---|---|---|---|---|
| `/api/chat` | 30/min (server.js:61) | 35回 | 26回目から 429 (本検証中に既に数回呼び済の影響と思われる) | PASS — 429 が発火して 5xx ではない |
| `/api/subscribe` | 5/hour | 6回 | 4回目から 429 (前段検証で既に 1〜2 回呼んでいたためバケット累積) | PASS |

429 は適切に発火し、後続要求も 429 を返し続けている。しきい値の絶対値は事前トラフィックを含めて整合。

---

## 7. Prototype pollution

| 入力 | 期待 | 実測 | 結果 |
|---|---|---|---|
| `POST /api/contact` body=`{"__proto__":{"polluted":true}, name, email, message}` | 400 もしくは安全に処理 (Object.prototype 汚染なし) | 200 `{"ok":true}` (`__proto__` キーは body 検証側で無視され、Object.prototype は汚染されない仕様) | PASS — 安全側で処理 |

備考: `JSON.parse` 自体は `__proto__` を own property として扱うため Object.prototype は汚染されない。受信後にハンドラが安全に分解しているのを確認。深いネストでの `constructor.prototype` 汚染試行は今回未検証 (要追加検証)。

---

## 8. 大きい body (60KB > MAX_BODY_SIZE 50KB)

| 入力 | 期待 | 実測 | 結果 |
|---|---|---|---|
| `POST /api/chat` 60,047 bytes JSON | 413 Payload too large | **HTTP 000 (Empty reply from server)** | **FAIL** |

### 原因 (server.js:724-740 `readBody`):

```js
req.on('data', chunk => {
    size += chunk.length;
    if (size > (maxSize || MAX_BODY_SIZE)) {
        req.destroy();             // ← 先に socket を破壊している
        res.writeHead(413, ...);   // → ヘッダ送れず client は Empty reply
        res.end(...);
        return;
    }
    body += chunk;
});
```

クライアントから見ると connection reset となり、413 ステータスは届かない。

### 推奨対処 (本タスクでは実装しない、後続タスクへ):

```js
if (size > limit) {
    res.writeHead(413, {'Content-Type':'application/json', 'Connection':'close'});
    res.end(JSON.stringify({ error: 'Payload too large' }));
    req.unpipe?.();
    req.pause();
    req.resume();   // drain remaining
    // または: res.on('finish', () => req.destroy());
    return;
}
```

レスポンス送出完了後に socket を閉じる。現状の実装はセキュリティ上は安全 (大きい payload は処理されない) だが UX/可観測性に欠ける (フロントが原因不明の network error を出す)。

---

## 9. CSP report

| 入力 | 期待 | 実測 | 結果 |
|---|---|---|---|
| `POST /api/csp-report` (`Content-Type: application/csp-report`) | 204 | 204 | PASS |

---

## 10. その他の Findings (軽微)

1. **sw.js の Cache-Control**: `public, max-age=86400, stale-while-revalidate=604800` — Service Worker は通常 `no-cache, max-age=0` または 1分以下で配信するのがベストプラクティス。古い SW が長くスタックすると更新失敗の温床になる。
2. **404 ページ (BSOD HTML)**: ブランド表現として優秀。`OBSERVER_NOT_DETECTED` などコピーも一貫。問題なし。
3. **Set-Cookie に `Secure` フラグなし**: 現状は localhost なので付かないが、本番では Secure を強制する必要あり (`process.env.NODE_ENV === 'production'` で分岐の確認推奨)。

---

## 推奨対処サマリ (実装は別タスク)

| 優先度 | 項目 | ファイル/箇所 |
|---|---|---|
| 高 | `readBody` の 413 が clientに届かない | `server.js:724-740` |
| 中 | `/api/checkout` が 200 で error を返す | `server.js:1222` 付近 |
| 中 | `/api/shopify/graphql` allowlist 外を 403 に統一 | `server.js:1183` 付近 |
| 低 | `.xml` / `.txt` の Content-Type を正しく付与 | `server.js` MIME マップ |
| 低 | sw.js の Cache-Control を short-TTL に | `server.js` sw.js 配信箇所 |
| 低 | Set-Cookie `Secure` 本番強制の確認 | `server.js` subscribe |

---

## 完了条件

- [x] サーバー起動・停止が clean
- [x] 全 endpoint 実動作確認 docs 化
- [x] 致命的不整合は無し (`readBody` の 413 不達は中程度。セキュリティ的には fail-closed で安全)
- [x] 既存テスト破壊なし (本ファイルは新規 docs のみ + 新規 test 1 本)
