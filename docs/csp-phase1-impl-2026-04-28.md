# inryokü CSP / Security Headers — Phase 1 実装記録 — 2026-04-28

対象: `server.js`（CSP / セキュリティヘッダ / `/api/csp-report`）、`offline.html`（`javascript:` URL 撤去）

参照:
- `docs/csp-tuning-2026-04-28.md`（Phase 1〜3 の段階移行設計、本実装はその Phase 1 を適用）
- `docs/security-fixes-2026-04-28.md` F9
- `docs/security-review-2026-04-28.md`

ステータス: **Phase 1 実装完了**。`'unsafe-inline'` は維持（Phase 2 で nonce 化）。Trusted Types は Phase 3 で導入予定。

---

## 0. 実装サマリ

| 項目                                | Before                                                               | After (Phase 1)                                                                                |
|-------------------------------------|----------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| `script-src`                        | `'self' 'unsafe-inline' https://www.googletagmanager.com`             | `+ https://cdn.jsdelivr.net`（Three.js CDN — Critical 修正）                                    |
| `script-src-attr`                   | （未指定）                                                           | `'none'`（inline event handler 完全禁止）                                                       |
| `style-src-attr`                    | （未指定）                                                           | `'unsafe-inline'`（数件の `style="..."` 属性のため明示。Phase 2 で削除）                         |
| `connect-src`                       | `'self' https://*.myshopify.com https://api.groq.com`                | `'self' https://*.myshopify.com`（Groq はサーバ→サーバのみ）                                    |
| `frame-src`                         | （未指定 → `default-src='self'` フォールバック）                     | `'self' https://*.shopify.com https://*.myshopify.com`                                          |
| `object-src`                        | （未指定）                                                           | `'none'`                                                                                        |
| `worker-src`                        | （未指定）                                                           | `'self'`（Service Worker、将来の Web Worker 用）                                                |
| `manifest-src`                      | （未指定）                                                           | `'self'`                                                                                        |
| `media-src`                         | （未指定）                                                           | `'self'`                                                                                        |
| `img-src` の `blob:`                | なし                                                                 | 追加（PWA 内 Blob URL のため）                                                                   |
| `upgrade-insecure-requests`         | なし                                                                 | 有効                                                                                            |
| `block-all-mixed-content`           | なし                                                                 | 有効                                                                                            |
| `report-uri` / `report-to`          | なし                                                                 | 両方 `/api/csp-report` を指す（Safari/FF と Chrome/Edge 両対応）                                |
| `Permissions-Policy`                | camera / mic / geolocation のみ                                      | 14 機能を明示 deny / 一部 self（後述）                                                           |
| `Cross-Origin-Opener-Policy`        | なし                                                                 | `same-origin`（全レスポンス）                                                                    |
| `Cross-Origin-Embedder-Policy`      | なし                                                                 | `credentialless`（HTML / 静的アセットのみ。`/api/*` には付与しない）                            |
| `Cross-Origin-Resource-Policy`      | なし                                                                 | `same-site`（HTML / 静的アセットのみ）                                                           |
| `Origin-Agent-Cluster`              | なし                                                                 | `?1`                                                                                            |
| `X-Permitted-Cross-Domain-Policies` | なし                                                                 | `none`                                                                                          |
| `Reporting-Endpoints`               | なし                                                                 | `csp-endpoint="/api/csp-report"`                                                                |
| `Report-To` (legacy)                | なし                                                                 | `{"group":"csp-endpoint", ...}`（古い Chrome 互換）                                              |
| `/api/csp-report` エンドポイント    | なし                                                                 | 実装。30/min/IP レート制限。`application/csp-report` と `application/reports+json` 両受信。      |
| `offline.html` の retry リンク      | `<a href="javascript:location.reload()">`                            | `<button id="retry-btn">` + `addEventListener('click', ...)`                                    |
| HSTS                                | `max-age=63072000; includeSubDomains`                                | 同左（`preload` は別タスク M7 に委ねる — DNS / MX / 全サブドメイン HTTPS 確認後）                |

---

## 1. server.js 変更点（diff サマリ）

### 1.1 `SECURITY_HEADERS` / `CSP_HTML`（L93 周辺）

`SECURITY_HEADERS` を以下の構造に再構成（オブジェクト配列 join + 追加項目）:

```js
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'accelerometer=()',
        'gyroscope=()',
        'magnetometer=()',
        'midi=()',
        'interest-cohort=()',
        'browsing-topics=()',
        'fullscreen=(self)',
        'autoplay=(self)',
        'picture-in-picture=()'
    ].join(', '),
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Reporting-Endpoints': 'csp-endpoint="/api/csp-report"',
    'Report-To': '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"/api/csp-report"}]}'
};
```

`CSP_HTML` を配列 + `join('; ')` 形式に変更:

```js
const CSP_HTML = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.jsdelivr.net",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://api.qrserver.com https://cdn.shopify.com",
    "connect-src 'self' https://*.myshopify.com",
    "media-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'self' https://*.shopify.com https://*.myshopify.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
    "report-uri /api/csp-report",
    "report-to csp-endpoint"
].join('; ');
```

### 1.2 `writeHead` ラッパで COEP/CORP を非 API レスポンスに付与

`/api/*` レスポンスに `Cross-Origin-Embedder-Policy: credentialless` を載せると外部からの fetch（クライアント側 mashup や実装ミス）に影響しうるため、HTML / 静的アセット限定:

```js
const isAPIResp = req.url && req.url.startsWith('/api/');
if (!isAPIResp) {
    if (!merged['Cross-Origin-Embedder-Policy']) merged['Cross-Origin-Embedder-Policy'] = 'credentialless';
    if (!merged['Cross-Origin-Resource-Policy']) merged['Cross-Origin-Resource-Policy'] = 'same-site';
}
```

`Cross-Origin-Opener-Policy: same-origin` は `SECURITY_HEADERS` 直下なので全レスポンスに付与（API でも害なし）。

### 1.3 `/api/csp-report` エンドポイント

- メソッド: POST のみ。
- レート制限: `csp_report` バケットで **30/min/IP**。汎用 `/api/` の 60/min より厳しめ（攻撃者が CSP report を flooding してログ DoS する経路を封じる）。
- Content-Type: `application/csp-report`（report-uri）と `application/reports+json`（report-to / Reporting API）の **両方を受信**。
  - report-uri → `{ "csp-report": { ... } }` 単発オブジェクト。
  - report-to → `[ { "type": "csp-violation", "body": { ... } } ]` 配列。
- 正規化: フィールド名のキャメル/ケバブ両対応で `blockedURI` / `violatedDirective` / `documentURI` / `sourceFile` / `lineNumber` / `disposition` を抽出。
- 出力: `console.warn('[CSP-REPORT]', JSON.stringify({...}).slice(0, 1000))` で 1 行 JSON ログ。永続化は Phase 1.5 以降で `data/csp-violations.json` にローテートする予定（§5.2）。
- 応答: 常に **204 No Content**。攻撃者に内部状態を返さない。
- 解析失敗時も 204（silent drop）。

---

## 2. offline.html 変更点

CSP の `script-src` から `'unsafe-inline'` を将来撤廃するためには `javascript:` URL を排除する必要がある（厳密にいえば `script-src-attr 'none'` を Phase 1 で入れた段階でも、`javascript:` URL は `script-src` の `'unsafe-inline'` で通る — Phase 2 への布石）。

変更:

- `<a href="javascript:location.reload()" class="retry">retry</a>` → `<button type="button" id="retry-btn" class="retry">retry</button>`
- CSS セレクタ `a.retry` → `.retry` に汎用化（button / a 両対応）。`background:transparent` / `font-family:inherit` / `cursor:pointer` を追加して a と見分けがつかないように。
- `<script>` 内に IIFE で `addEventListener('click', () => location.reload())` を追加。`window.online` ハンドラも button DOM を参照するように書き換え。
- 視覚・グレー美学・タイポグラフィは完全維持。

---

## 3. Permissions-Policy 設計の根拠

| 機能                  | 値          | 根拠 |
|-----------------------|-------------|------|
| `camera`              | `()`        | 使わない。 |
| `microphone`          | `()`        | 使わない。 |
| `geolocation`         | `()`        | 使わない。 |
| `payment`             | `()`        | Payment Request API は未使用。Shopify は外部遷移なので不要。 |
| `usb`                 | `()`        | WebUSB は使わない。 |
| `accelerometer`       | `()`        | DeviceMotion 系は P3 演出で使っていない（gyroscope 経由で姿勢取得もしていない）。 |
| `gyroscope`           | `()`        | 同上。 |
| `magnetometer`        | `()`        | 使わない。 |
| `midi`                | `()`        | 使わない。 |
| `interest-cohort`     | `()`        | FLoC opt-out（Google の旧トラッキング機構）。 |
| `browsing-topics`     | `()`        | Topics API opt-out（FLoC の後継）。 |
| `fullscreen`          | `(self)`    | 将来 P3 没入演出のため self だけ許可。クロスオリジンには出さない。 |
| `autoplay`            | `(self)`    | 起動 SE / 装飾音声のため self のみ許可。 |
| `picture-in-picture`  | `()`        | 動画 PiP は不要。 |

---

## 4. 既存機能の動作確認（Phase 1 CSP 違反しないことを文書化）

| 機能                                   | 関連ディレクティブ                                                    | 動作 |
|----------------------------------------|-----------------------------------------------------------------------|------|
| Particle Universe (P0/P1/P2/P3)        | `script-src ... https://cdn.jsdelivr.net`（Three.js CDN）             | ✅ Phase 1 で **明示追加** — これにより以前壊れていた可能性のあるデスクトップ Three.js が正常動作。 |
| AI Chat（`/api/chat` 経由）            | `connect-src 'self'`                                                  | ✅ クライアントは `fetch('/api/chat', ...)` のみ。Groq への直叩きは server.js が proxy。 |
| Shopify Checkout 遷移                  | `window.location.href = checkoutUrl`（CSP 制約外）                    | ✅ ナビゲーション。`form-action 'self'` には抵触しない。 |
| Shopify 埋め込み（将来）               | `frame-src 'self' https://*.shopify.com https://*.myshopify.com`      | ✅ 将来 Shopify Buy Button SDK / 埋め込みウィジェットを入れる場合に備え許可。 |
| QR コード画像                          | `img-src ... https://api.qrserver.com`                                | ✅ |
| Shopify 商品画像                       | `img-src ... https://cdn.shopify.com`                                 | ✅ |
| inline SVG / data URI 画像             | `img-src ... data: blob:`                                             | ✅ |
| Service Worker (`/sw.js`)              | `worker-src 'self'`                                                   | ✅ 明示追加。 |
| Web Manifest (`/manifest.json`)        | `manifest-src 'self'`                                                 | ✅ 明示追加。 |
| 音声 / 動画（`.ogg/.mp3/.mov`）        | `media-src 'self'`                                                    | ✅ 明示追加。 |
| Google Fonts CSS                       | `style-src ... https://fonts.googleapis.com`                          | ✅ |
| Google Fonts ttf/woff                  | `font-src 'self' https://fonts.gstatic.com`                           | ✅ |
| inline `<script>` (`index.html` 等 4 箇所) | `script-src ... 'unsafe-inline'`                                  | ✅ Phase 1 では維持（Phase 2 で nonce 化）。 |
| inline `<style>` ブロック              | `style-src ... 'unsafe-inline'`                                       | ✅ 同上。 |
| `style="..."` 属性（数件）              | `style-src-attr 'unsafe-inline'`                                      | ✅ 明示。Phase 2 で class 化予定。 |
| inline event handler (`onclick=` 等)   | `script-src-attr 'none'`                                              | ✅ production HTML に **0 件**（grep 確認済）。新規追加を CSP がブロックする保険。 |
| `offline.html` retry                   | button + `addEventListener`                                            | ✅ `javascript:` URL を撤去。 |

### 4.1 視覚効果（CSP 影響なし — 改めて明文化）

CSP は CSS の **読み込み元** を縛るだけで、CSS の **表現力** を縛らない。inryokü grey 美学を構成する以下は完全に温存:

- `linear-gradient(145deg, rgba(...))`
- `backdrop-filter: blur(8px)`
- `mix-blend-mode: difference`
- `filter: hue-rotate(...)` / `drop-shadow(...)` / `blur(...)`
- `transform: scale/rotate/translate3d`
- `clip-path: polygon(...)`
- `mask-image: url(data:...)`

`success.html` のドット装飾（`el.style.cssText = '...'`）は CSSOM API 経由のため `style-src-attr` の制約外。Phase 2 で `style-src-attr 'none'` にしても**動く**。

---

## 5. 動作確認手順

### 5.1 ローカル smoke test（実施済）

```bash
# サーバ起動
PORT=3457 node server.js &

# ヘッダ確認
curl -sS -D - -o /dev/null http://localhost:3457/offline.html

# CSP report エンドポイント受信確認
curl -sS -X POST -H "Content-Type: application/csp-report" \
  --data '{"csp-report":{"blocked-uri":"https://evil.example/x.js","violated-directive":"script-src"}}' \
  http://localhost:3457/api/csp-report
# → HTTP/1.1 204、サーバログに `[CSP-REPORT] {"ts":...}` が 1 行出る

# Reporting API (report-to) 形式確認
curl -sS -X POST -H "Content-Type: application/reports+json" \
  --data '[{"type":"csp-violation","body":{"blockedURL":"https://evil.example/x.js","effectiveDirective":"script-src"}}]' \
  http://localhost:3457/api/csp-report
# → 同様に 204 + ログ

# レート制限確認 (30/min)
for i in $(seq 1 35); do
  curl -sS -o /dev/null -w "%{http_code} " -X POST \
    -H "Content-Type: application/csp-report" --data '{"csp-report":{"blocked-uri":"x"}}' \
    http://localhost:3457/api/csp-report
done
# → 30 回 204、その後 429
```

確認結果（実施 2026-04-28）:
- 30 回 204、31 回目以降 429。
- ヘッダ全項目（CSP / Permissions-Policy / COOP / COEP / CORP / OAC / X-Permitted / Reporting-Endpoints / Report-To）が正しく返る。

### 5.2 ブラウザ動作確認（手動）

- [ ] Chrome DevTools → Network → `/` の Response Headers に CSP / Permissions-Policy が表示される。
- [ ] Chrome DevTools → Application → Service Workers で `/sw.js` が active（`worker-src 'self'` で動く）。
- [ ] Chrome DevTools → Application → Manifest が読み込まれる（`manifest-src 'self'`）。
- [ ] デスクトップ Three.js Particle Universe が動く（`https://cdn.jsdelivr.net` 許可確認 — **以前壊れていた可能性大の Critical 修正点**）。
- [ ] モバイル（iPhone Safari リモートデバッグ）で UA 判定 → P3 リダイレクトが動く。
- [ ] AI Chat が応答する（`/api/chat` `connect-src 'self'`）。
- [ ] 商品カードクリック → Shopify checkout 遷移（外部ナビゲーション、CSP 影響なし）。
- [ ] QR PNG が表示される（`api.qrserver.com`）。
- [ ] `/offline.html` を直接開いて retry ボタンをクリックすると reload する（button + addEventListener）。
- [ ] `/offline.html` の online イベント時に button のラベルが `reconnect` に変わる。
- [ ] DevTools Console に **CSP 違反エラーが出ない**（出たら見落とし — `/api/csp-report` の console.warn ログにも残るため `tail -f` で観測）。

### 5.3 外部スコアリング

- [ ] https://securityheaders.com/?q=inryoku.com で **A 以上** を獲得（Phase 1 で A 想定。A+ には HSTS preload 必要）。
- [ ] https://observatory.mozilla.org/ で **A 以上**。
- [ ] https://csp-evaluator.withgoogle.com/ で `'unsafe-inline'`（既知）以外の警告ゼロ。

---

## 6. 補足: API エンドポイント側に COEP/CORP を載せない理由

`/api/*` レスポンスは外部から `fetch` されないが、内部での fetch（同オリジン）には CORP の影響なし。一方で:
1. 将来 `assets.inryoku.com` 等のサブドメイン分離をしたとき、`same-site` なら通るので `same-origin` より柔軟。
2. `credentialless` を API JSON に載せるとブラウザによって挙動差異がある。
3. API エンドポイントに COEP は意味的に不要（embedded リソースを返さない）。

→ 結果として `/api/*` には **COOP のみ**を載せ、HTML/静的アセットには **COOP + COEP(credentialless) + CORP(same-site)** を載せる構成にした。

---

## 7. Phase 2 への予定（次フェーズで実施するもの）

参照: `docs/csp-tuning-2026-04-28.md` §3 Phase 2、§4.2 patch、§7 移行ロードマップ M3〜M5。

予定作業:
1. **per-response nonce 生成**: `crypto.randomBytes(16).toString('base64')` を `http.createServer` のハンドラ先頭で発行。
2. **HTML 配信を stream → buffer に変更**し、`__CSP_NONCE__` プレースホルダを置換してから返す（または gzip）。
3. **全 inline `<script>` / `<style>` に `nonce="__CSP_NONCE__"` を付与**:
   - `index.html` L1344, L1373（モバイル UA 判定 / renderPhase1 起動）
   - `success.html` L146（パーティクル装飾）
   - `offline.html` L42（online ハンドラ）
   - 全 7 HTML の `<style>` ブロック
4. **`style="..."` 属性を CSS class に置換**:
   - `privacy.html` L42, `returns.html` L48, `index.html` L1360-1361
5. **Phase 2 適用前に Report-Only モードで 1〜2 週間観測**:
   - `Content-Security-Policy-Report-Only` で nonce 版ポリシーを並列送信し、`/api/csp-report` の出力を観察 → 漏れがあれば nonce 化追加。
6. **Phase 2 本適用**: `script-src` / `style-src` から `'unsafe-inline'` を削除。`'strict-dynamic'` を導入。`https://cdn.jsdelivr.net` は `'strict-dynamic'` 経由で nonce 付き script から動的ロードに切り替えるため、ホストリストから削除可能。
7. **CSP report 永続化**: `data/csp-violations.json` にローテーション保存（5000 件上限 → 古い順に 1000 件捨て）。admin 認証付き `GET /api/csp-violations` を実装（任意）。

Phase 3 (Trusted Types) は `p3_code_for_claude.js` の `innerHTML` 利用箇所（15 件）の監査が前提。`require-trusted-types-for 'script'; trusted-types inryoku-policy` は Chrome/Edge のみ効果。Firefox/Safari では noop（progressive enhancement）。

---

## 8. 触らなかったファイル（明示）

ユーザ指示により以下は変更しない:
- `p3_code_for_claude.js`
- `particle_*.*`
- `p3_styles.css`
- `enhance.js`
- `sw.js`
- `register.js`
- `i18n.js`
- `error-shield.js`
- `copy-fix-runtime.js`

これらは Phase 1 では CSP 違反を起こさない（読み込み元はすべて `'self'`、innerHTML 経由 XSS は Phase 3 で扱う）。

---

## 9. ロールバック手順

万一 Phase 1 適用後に何かが壊れた場合:
1. `server.js` の `SECURITY_HEADERS` / `CSP_HTML` を `git diff HEAD~1 server.js` で確認 → revert。
2. または一時しのぎとして `CSP_HTML` の **特定ディレクティブだけ緩める**:
   - 何か CDN が読めない: `script-src` に該当ホストを追加。
   - iframe 系の埋め込みが壊れた: `frame-src` を緩める。
   - PWA が壊れた: `worker-src 'self' blob:` に拡張。
3. `offline.html` の button 化は副作用ゼロのはずだが、UI バグがあれば `<a href="/">retry</a>` に置き換えれば一時しのぎ可能（ページ全体リロードではなく home 遷移になるが、PWA SW がキャッシュからオフライン復帰するためほぼ等価）。

---

**END — Phase 1 implementation 2026-04-28**
