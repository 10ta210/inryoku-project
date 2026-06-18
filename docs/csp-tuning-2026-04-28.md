# inryokü CSP / Security Headers 厳格化監査 — 2026-04-28

対象: `server.js` (L93–L116 の `SECURITY_HEADERS` / `CSP_HTML`)、全 HTML ファイル、クライアント JS のリソース要求。

参照:
- `server.js`（最新ヘッダ実装）
- `docs/security-fixes-2026-04-28.md` F9
- `docs/security-review-2026-04-28.md`

成果物の位置づけ: ドキュメント onlyの監査。server.js には触らない。差分は提案。

---

## 0. エグゼクティブサマリ

現状の CSP は「最低ライン」を満たしているが、**XSS の主要入口である `'unsafe-inline'`（script-src/style-src 両方）が残存**しており、CSP 本来の防御力の 7 割が失われた状態。

最重要発見:
1. **`script-src 'unsafe-inline'`** が許可されている — `index.html` / `success.html` / `offline.html` のインライン `<script>` を動かすため。これを外すには nonce / hash 戦略が必須。
2. **`style-src 'unsafe-inline'`** も許可 — 全 HTML が `<style>...</style>` を持ち、inline `style="..."` 属性も少数残っている。
3. **`script-src` に `https://www.googletagmanager.com`** が常時許可されているが、**現状 GTM は p3_test.html でコメントアウト中**（未使用）。許可面が不必要に広い。
4. **`upgrade-insecure-requests` / `block-all-mixed-content` / `frame-src` / `worker-src` / `manifest-src` / `media-src` / `object-src 'none'`** が未指定。
5. **`report-uri` / `report-to` 未設定** — 違反が起きても観測手段ゼロ。
6. **Permissions-Policy** が camera/mic/geolocation だけで、`payment` `usb` `interest-cohort` `accelerometer` 等の高リスク機能が未明示拒否。
7. **HSTS に `preload` ディレクティブ未指定**（max-age=63072000 / includeSubDomains はあり）。
8. **COEP / COOP / CORP** 未設定。
9. **inline event handler は production HTML には皆無**（強み）。`onclick=` 等の grep 結果ゼロ。
10. **`javascript:` URL が `offline.html` の retry リンクで使用** — `script-src` から `'unsafe-inline'` を外すと壊れる。

総合判定: **Phase 1（即適用、互換維持）で 5 項目改善 → Phase 2（nonce 導入）で `'unsafe-inline'` 撤廃 → Phase 3（Trusted Types）で innerHTML 起因 XSS の構造的封じ込め** の 3 段階移行を推奨。

---

## 1. 現状 CSP 完全ダンプ + 評価

### 1.1 `server.js` L102–L109 の正規化ダンプ

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self' 'unsafe-inline' https://www.googletagmanager.com;
  style-src   'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src    'self' https://fonts.gstatic.com;
  img-src     'self' data: https://api.qrserver.com https://cdn.shopify.com;
  connect-src 'self' https://*.myshopify.com https://api.groq.com;
  frame-ancestors 'none';
  base-uri    'self';
  form-action 'self';
```

そして `SECURITY_HEADERS` (L95–L101):

```
X-Content-Type-Options:    nosniff
X-Frame-Options:           DENY
Referrer-Policy:           strict-origin-when-cross-origin
Permissions-Policy:        camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

### 1.2 ディレクティブ別の妥当性評価

| ディレクティブ          | 値                                                      | 評価   | コメント |
|--------------------------|----------------------------------------------------------|--------|----------|
| `default-src`            | `'self'`                                                 | ◎      | 妥当。すべての未指定ディレクティブのフォールバック。 |
| `script-src`             | `'self' 'unsafe-inline' https://www.googletagmanager.com`| △      | `'unsafe-inline'` が最大の弱点。GTM ホストは現状未使用（p3_test.html でコメントアウト）。 |
| `style-src`              | `'self' 'unsafe-inline' https://fonts.googleapis.com`    | △      | Google Fonts CSS は `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` で必要。`'unsafe-inline'` は inline `<style>` と `style="..."` 属性のため。 |
| `font-src`               | `'self' https://fonts.gstatic.com`                       | ○      | `vendor/fonts/press-start-2p.woff2` が self、GFonts が gstatic。妥当。 |
| `img-src`                | `'self' data: https://api.qrserver.com https://cdn.shopify.com` | ○      | `data:` は SVG/QR 等の inline 画像で必要。Shopify CDN は商品画像。`https://api.qrserver.com` は QR PNG。 |
| `connect-src`            | `'self' https://*.myshopify.com https://api.groq.com`    | △      | `https://api.groq.com` はクライアントから直接叩かない（サーバ→サーバ）。**過剰許可**。 |
| `frame-ancestors`        | `'none'`                                                 | ◎      | clickjacking 完全封鎖。X-Frame-Options DENY と二重防御。 |
| `base-uri`               | `'self'`                                                 | ◎      | `<base href="">` 注入による相対 URL hijack 防止。 |
| `form-action`            | `'self'`                                                 | ○      | しかし Shopify checkout への `<form action>` は使っていない（`window.location` 遷移）ので問題なし。Gelato への form 投げもない。 |
| `frame-src`              | （未指定 → default-src='self' へ fallback）              | ✗      | 明示すべき。`iframe` を全く使わないなら `'none'`。 |
| `worker-src`             | （未指定 → default-src）                                 | ✗      | Service Worker (`/sw.js`) と Web Worker（perf-observer 内）のため `'self'` 明示推奨。 |
| `manifest-src`           | （未指定 → default-src）                                 | △      | `manifest.json` 配信のため `'self'` 明示推奨。 |
| `media-src`              | （未指定 → default-src）                                 | △      | `.ogg` / `.mp3` / `.mov` 配信のため明示。 |
| `object-src`             | （未指定 → default-src）                                 | ✗      | **`'none'` を明示するのが標準**。`<object>` `<embed>` `<applet>` の遮断。 |
| `child-src`              | （未指定）                                               | △      | worker-src + frame-src の上位互換。明示しなくてもよい。 |
| `prefetch-src`           | （未指定）                                               | △      | 仕様削除中。`default-src` 経由でカバー。 |
| `upgrade-insecure-requests` | （未指定）                                            | ✗      | 必須。HTTP リソースを HTTPS に自動昇格。 |
| `block-all-mixed-content`| （未指定）                                               | △      | 上記と機能重複だが、互換のため両方付ける現代的慣習。 |
| `require-trusted-types-for` | （未指定）                                            | ─      | Phase 3 候補。Chromium 系のみ対応。 |
| `trusted-types`          | （未指定）                                               | ─      | 同上。 |
| `report-uri` / `report-to` | （未指定）                                             | ✗      | 違反観測ゼロ。即追加すべき（report-only モードで段階移行）。 |

### 1.3 SECURITY_HEADERS 評価

| ヘッダ                     | 現状                                                  | 評価 | 改善案 |
|----------------------------|--------------------------------------------------------|------|--------|
| `X-Content-Type-Options`   | `nosniff`                                              | ◎    | OK |
| `X-Frame-Options`          | `DENY`                                                 | ◎    | OK（CSP `frame-ancestors 'none'` と二重防御） |
| `Referrer-Policy`          | `strict-origin-when-cross-origin`                      | ◎    | 妥当。`no-referrer` まで絞ると Shopify 遷移時の analytics に影響しうるので strict-origin-when-cross-origin が現実解。 |
| `Permissions-Policy`       | `camera=(), microphone=(), geolocation=()`             | △    | **payment, usb, accelerometer, gyroscope, magnetometer, midi, interest-cohort, browsing-topics, fullscreen 等を追加すべき**。 |
| `Strict-Transport-Security`| `max-age=63072000; includeSubDomains`                  | ○    | `preload` 追加 + https://hstspreload.org/ への登録を推奨。preload するなら apex も含めて全サブドメインが HTTPS-only である必要あり。 |
| `Cross-Origin-Opener-Policy` | （未設定）                                          | ✗    | `same-origin` 推奨（Spectre 系緩和、window.opener 遮断）。 |
| `Cross-Origin-Embedder-Policy` | （未設定）                                        | △    | `require-corp` は既存リソースが壊れやすい。`credentialless` から始めるのが穏当。SharedArrayBuffer 不要なら強制不要。 |
| `Cross-Origin-Resource-Policy` | （未設定）                                        | ✗    | `same-origin` を全レスポンスに付ければ他オリジンからの読み込み防止。 |
| `Origin-Agent-Cluster`     | （未設定）                                             | △    | `?1` で同オリジン分離（実害なし、推奨）。 |
| `X-Permitted-Cross-Domain-Policies` | （未設定）                                    | △    | `none` で Flash 等（既に死語）の policy ファイル無視を明示。レガシー保険。 |
| `X-XSS-Protection`         | （未設定）                                             | ─    | **付けない**のが現代の正解（Chrome は廃止、Edge も廃止予定）。CSP で代替済み。 |
| `Server` ヘッダ            | Node デフォルト                                        | △    | Node の http モジュールはデフォルトで `Server` ヘッダを送らないため OK。フィンガープリント漏れなし。 |

---

## 2. インラインスクリプト / スタイル / event handler 全リスト

### 2.1 inline `<script>` （CSP 厳格化に直接影響）

| ファイル                    | 行             | 内容                                            | 戦略 |
|------------------------------|-----------------|--------------------------------------------------|------|
| `index.html`                 | 91–             | `<script type="application/ld+json">` (JSON-LD)  | **CSP 影響なし** — `application/ld+json` は実行されない data block。CSP 対象外。 |
| `index.html`                 | 1333–1340       | `<script type="importmap">`                      | **CSP 影響なし** — importmap も非実行。ただし Chrome の strict CSP は importmap を許可するため問題なし。 |
| `index.html`                 | 1344–1358       | モバイル UA 判定 → P3 リダイレクト              | **要 nonce 化** または外部ファイル化（`mobile-redirect.js`）。 |
| `index.html`                 | 1373–1412       | `renderPhase1()` 起動 + イベントリスナで P2/P3 動的読み込み | **要 nonce 化** または外部ファイル化（`flow-orchestrator.js`）。 |
| `success.html`               | 146–            | パーティクル装飾 + フェードインシーケンス      | **要 nonce 化** または `success-decor.js` に切り出し。 |
| `offline.html`               | 42–48           | `online` イベントでリロードラベル更新            | **要 nonce 化** または外部ファイル化。 |
| `p3_test.html`               | 60–65           | GTM ブートストラップ（**現状コメントアウト**）   | 復活させるなら GTM Custom HTML を nonce 化（GTM の `data-nonce-aware` 設定）。 |
| `card_concepts_preview.html` | （ダンプ未実施）| dev preview。public 配信されない                | 影響外。 |
| `p3_showcase_samples.html`   | （ダンプ未実施）| dev preview。                                   | 影響外。 |
| `particle_glyphs_demo.html`  | （ダンプ未実施）| dev preview。                                   | 影響外。 |
| `particle_rings_demo.html`   | （ダンプ未実施）| dev preview。                                   | 影響外。 |
| `p1_index_for_claude.html`   | —               | server deny list で 403                          | 影響外。 |

### 2.2 inline `<style>` ブロック（style-src に影響）

| ファイル              | 影響範囲                                       | 戦略 |
|------------------------|------------------------------------------------|------|
| `index.html`          | `<head>` 内に巨大な inline style              | nonce 付与 or 外部 css 化。すでに `p3_styles.css` 等に切り出し済みだが index.html L〜1331 付近に inline 残存（L1331 の `</style>` 確認）。 |
| `legal.html`          | inline `<style>`                               | nonce or 外部化。 |
| `privacy.html`        | inline `<style>`                               | nonce or 外部化。 |
| `returns.html`        | inline `<style>`                               | nonce or 外部化。 |
| `size-guide.html`     | inline `<style>`                               | nonce or 外部化。 |
| `success.html`        | inline `<style>`                               | nonce or 外部化。 |
| `offline.html`        | inline `<style>`                               | nonce or 外部化。 |

### 2.3 inline `style="..."` 属性（**`'unsafe-inline'` 必須要因のひとつ**）

| ファイル              | 行     | 用途                                                     | CSP 上の扱い |
|------------------------|--------|-----------------------------------------------------------|--------------|
| `index.html`           | 1360   | `<canvas id="three-canvas" style="position:fixed;...">` | 必須（動的 z-index 演出の足場、削除可だが既存 CSS への移植要）。 |
| `index.html`           | 1361   | `<div id="root" style="position:relative;z-index:1;">`  | 同上。 |
| `privacy.html`         | 42     | `<p style="margin-top:32px;...">`                        | 削除して class 化容易。 |
| `returns.html`         | 48     | 同上                                                       | 同上。 |
| `particle_glyphs_demo.html` | 83/88/91 | dev preview 用                                       | 影響外（public 配信なし）。 |
| `p3_showcase_samples.html`  | 246/247 | dev preview 用                                       | 影響外。 |
| `success.html`         | 162–169 | **JS 内で `dot.style.cssText = '...'`**                  | ⚠️ **属性 style ではなく `style.cssText` 代入** = CSSOM API。これは **CSP `style-src` の `'unsafe-inline'` の対象外**（CSSOM 経由は `style-src-attr` の文脈外）。`require-trusted-types-for 'script'` を厳格化しても影響なし。Phase 2 で `'unsafe-inline'` を外しても**動く**。 |
| `p3_code_for_claude.js` | 多数  | `el.style.color = '...'` 等                              | 同様に CSSOM。CSP 影響なし。 |

**重要な区別**:
- HTML attribute `style="..."` → `style-src-attr` の `'unsafe-inline'` または `'unsafe-hashes'` が必要。
- DOM API `el.style.foo = ...` / `el.style.cssText = ...` → CSP 制約**外**。
- `<style>` block → `style-src-elem` の `'unsafe-inline'` または nonce が必要。

これにより、**Phase 2 で `'unsafe-inline'` を外したい場合、`<style>` ブロックは nonce、`style="..."` 属性は数件だけなので CSS class に置き換える**という戦略が成立する。

### 2.4 inline event handler (`onclick=` 等)

```
$ grep -nE 'on(click|load|error|change|submit|input|focus|blur|mouseover|mouseout|keyup|keydown)=' index.html legal.html offline.html privacy.html returns.html size-guide.html success.html
(出力なし)
```

**production HTML 0 件**。これは大きな強み — `script-src-attr 'none'` を Phase 1 から付与可能。

ただし `offline.html` L38 に:
```html
<a href="javascript:location.reload()" class="retry">retry</a>
```
これは `javascript:` URL で、CSP 上は `script-src` の `'unsafe-inline'` 相当。Phase 2 で `'unsafe-inline'` を外すと**この `retry` リンクが壊れる**。修正案: `<button id="retry-btn">retry</button>` に変更し、外部 JS の click ハンドラで `location.reload()`。

### 2.5 `innerHTML` 利用箇所（Trusted Types 影響）

| ファイル                  | 件数 | リスク | コメント |
|----------------------------|------|--------|----------|
| `p3_code_for_claude.js`   | 15   | 中     | チャット応答 / 商品 SVG 等。**Groq 応答を innerHTML に流す箇所があれば XSS 直結**。要レビュー。 |
| `p1_code_for_claude.js`   | 4    | 低     | 静的テンプレートのみと推定。要確認。 |
| `register.js`             | 3    | 低     | PWA インストール促進 UI。 |
| `particle_glyphs.js`      | 1    | 低     | 装飾レンダ。 |
| `particle_whisper.js`     | 1    | 低     | 装飾レンダ。 |

Phase 3 (Trusted Types) で `require-trusted-types-for 'script'` を入れると、これらの `innerHTML` 代入はすべて TrustedHTML 経由でないと拒否される → policy `inryoku-policy` を作って escapeHTML を通すか、`textContent` への置換が必要。

---

## 3. 推奨 CSP（3 段階）

### Phase 1: 即適用（互換維持・nonce 導入なし）

目的: 既存機能を一切壊さずに、簡単に締められる箇所を全部締める。

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
  script-src-attr 'none';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  style-src-attr 'unsafe-inline';
  img-src 'self' data: blob: https://api.qrserver.com https://cdn.shopify.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.myshopify.com;
  media-src 'self';
  worker-src 'self';
  manifest-src 'self';
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
  block-all-mixed-content;
  report-uri /api/csp-report;
  report-to csp-endpoint;
```

変更点と根拠:
1. **`script-src-attr 'none'`** 追加 — production HTML に inline event handler ゼロなので即適用可。万一 XSS で `onclick=` を注入されても発火しない。
2. **`connect-src` から `https://api.groq.com` を削除** — クライアントから Groq に直叩きしない（server.js が proxy）。攻撃者がチャット文脈で外部 fetch を試みる経路を封じる。
3. **`https://www.googletagmanager.com` は残す** — 将来 GTM 復活時の互換のため。実害なし（GTM が読み込まれない限り fetch されない）。GTM 不要なら**削除**してさらに引き締まる。
4. **`frame-src 'none'` / `object-src 'none'`** — iframe / Flash / `<object>` 全廃。
5. **`worker-src 'self'`** — Service Worker (`/sw.js`) の発火許可。
6. **`manifest-src 'self'`** — `manifest.json` 取得許可。
7. **`media-src 'self'`** — `.ogg/.mp3/.mov` 配信許可。
8. **`img-src` に `blob:`** — Service Worker 内で Blob 化した画像を表示する将来余地（現状未使用だが PWA で頻出）。
9. **`upgrade-insecure-requests` + `block-all-mixed-content`** — HTTP 漏れ強制昇格。
10. **`report-uri` + `report-to`** — `/api/csp-report` に違反通知（§6 で実装案）。
11. **`style-src-attr 'unsafe-inline'`** を明示 — `style="..."` 属性の数件をまだ落としていないため。Phase 2 で削除予定。
12. **`script-src` の `'unsafe-inline'` は残す** — inline `<script>` を nonce 化していないため、Phase 1 では維持必須。

#### Phase 1 SECURITY_HEADERS 強化案

```
X-Content-Type-Options:    nosniff
X-Frame-Options:           DENY
Referrer-Policy:           strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Permissions-Policy:        camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), interest-cohort=(), browsing-topics=(), fullscreen=(self), autoplay=(self), picture-in-picture=()
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster:         ?1
X-Permitted-Cross-Domain-Policies: none
Reporting-Endpoints:       csp-endpoint="/api/csp-report"
```

注意:
- `fullscreen=(self)` — モバイル P3 で全画面パーティクル演出を入れる将来余地。不要なら `()`。
- `autoplay=(self)` — 音声/動画は self 許可（QR 起動 SE 等）。
- `Cross-Origin-Embedder-Policy` は意図的に省略 — `require-corp` は Three.js CDN を全て CORP=cross-origin にする必要があり破壊的。`credentialless` でも CDN 側の対応次第。Phase 2 以降で検討。
- `HSTS preload` 追加 — 但し、apex ドメインも含めて全サブドメインが完全 HTTPS 運用前提。inryoku.com の DNS / Shopify 連携 / メール用 MX を再点検してから登録するのが安全。

### Phase 2: nonce 導入後（`'unsafe-inline'` 撤廃）

前提作業:
- `server.js` で各レスポンス毎に nonce 生成（`crypto.randomBytes(16).toString('base64')`）。
- HTML テンプレートエンジン化、または HTML をストリーム読み込みして `__NONCE__` プレースホルダを置換。
- 全 inline `<script>` / `<style>` に `nonce="{{NONCE}}"` を付与。
- `style="..."` 属性は CSS class に置換（数件のみ）。
- `offline.html` の `javascript:location.reload()` を `<button>` + 外部ハンドラに変更。

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{NONCE}' 'strict-dynamic';
  script-src-attr 'none';
  style-src 'self' 'nonce-{NONCE}' https://fonts.googleapis.com;
  style-src-attr 'none';
  img-src 'self' data: blob: https://api.qrserver.com https://cdn.shopify.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.myshopify.com;
  media-src 'self';
  worker-src 'self';
  manifest-src 'self';
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
  block-all-mixed-content;
  report-uri /api/csp-report;
  report-to csp-endpoint;
```

Phase 2 の核心:
1. **`'unsafe-inline'` 完全撤廃** — XSS で注入された `<script>foo</script>` は nonce が一致しないので発火しない。
2. **`'strict-dynamic'`** — nonce 付き script から `document.createElement('script')` で動的 import される子スクリプト（index.html L1381 の `s = document.createElement('script'); s.src='p2_code_for_claude.js'`）は、ホストリスト不要で実行可能。これが Three.js CDN を許可リストから外せる理由。
3. **`'strict-dynamic'` 副作用**: `'self'` と `https://...` のホスト許可は CSP3 互換ブラウザ（Chrome/Edge/Firefox）では**無視される**。Safari は CSP3 strict-dynamic 対応（Safari 15.4+）。古いブラウザは `'self'` + ホストリストで動く（CSP は forward-compatible）。
4. **`script-src-attr 'none'`** + **`style-src-attr 'none'`** — `onclick=` `style=` を完全禁止。

### Phase 3: Trusted Types（先進）

前提:
- `innerHTML` 利用箇所をすべて確認 → policy `inryoku-policy` を作って通すか、`textContent` 化。
- DOMPurify を vendor フォルダに追加（self-hosted）し、必須箇所で sanitize。

```
Content-Security-Policy:
  ...
  require-trusted-types-for 'script';
  trusted-types inryoku-policy 'allow-duplicates';
  ...
```

クライアント側の policy 例:

```js
// /vendor/trusted-types-policy.js（最初にロード）
if (window.trustedTypes && trustedTypes.createPolicy) {
  window.inryokuTT = trustedTypes.createPolicy('inryoku-policy', {
    createHTML: (s) => DOMPurify.sanitize(s, { RETURN_TRUSTED_TYPE: false }),
    createScriptURL: (s) => {
      // self / *.myshopify.com / cdn.jsdelivr.net 以外は throw
      const u = new URL(s, location.origin);
      const okHosts = new Set([location.host, 'cdn.jsdelivr.net']);
      if (!okHosts.has(u.host)) throw new Error('blocked: ' + u.host);
      return s;
    },
    createScript: (s) => s
  });
}
```

ブラウザ対応: Chrome/Edge 83+、Firefox 未対応（実装中）、Safari 未対応。Firefox/Safari では `require-trusted-types-for` は無視されるので**害なし**（progressive enhancement）。

---

## 4. 推奨ヘッダフルセット（diff 形式・server.js 適用方法）

### 4.1 Phase 1 patch（`server.js` L93–L116）

```diff
@@ server.js L93
-/* security-2026-04-28: 共通セキュリティヘッダ
-   全レスポンスに付与する。CSP は HTML レスポンスにのみ別途追加。 */
-const SECURITY_HEADERS = {
-    'X-Content-Type-Options': 'nosniff',
-    'X-Frame-Options': 'DENY',
-    'Referrer-Policy': 'strict-origin-when-cross-origin',
-    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
-    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains'
-};
-const CSP_HTML =
-    "default-src 'self'; " +
-    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; " +
-    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
-    "font-src 'self' https://fonts.gstatic.com; " +
-    "img-src 'self' data: https://api.qrserver.com https://cdn.shopify.com; " +
-    "connect-src 'self' https://*.myshopify.com https://api.groq.com; " +
-    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
+/* security-2026-04-28-phase1: 共通セキュリティヘッダ強化
+   - Permissions-Policy 拡張（payment/usb/sensors/topics 等を deny）
+   - HSTS に preload 追加（事前に hstspreload.org 登録要）
+   - COOP / CORP / Origin-Agent-Cluster / X-Permitted-Cross-Domain-Policies 追加
+   - Reporting-Endpoints で /api/csp-report 受信先を宣言
+   CSP は HTML レスポンスにのみ別途追加。 */
+const SECURITY_HEADERS = {
+    'X-Content-Type-Options': 'nosniff',
+    'X-Frame-Options': 'DENY',
+    'Referrer-Policy': 'strict-origin-when-cross-origin',
+    'Permissions-Policy': [
+        'camera=()',
+        'microphone=()',
+        'geolocation=()',
+        'payment=()',
+        'usb=()',
+        'accelerometer=()',
+        'gyroscope=()',
+        'magnetometer=()',
+        'midi=()',
+        'interest-cohort=()',
+        'browsing-topics=()',
+        'fullscreen=(self)',
+        'autoplay=(self)',
+        'picture-in-picture=()'
+    ].join(', '),
+    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
+    'Cross-Origin-Opener-Policy': 'same-origin',
+    'Cross-Origin-Resource-Policy': 'same-origin',
+    'Origin-Agent-Cluster': '?1',
+    'X-Permitted-Cross-Domain-Policies': 'none',
+    'Reporting-Endpoints': 'csp-endpoint="/api/csp-report"'
+};
+const CSP_HTML = [
+    "default-src 'self'",
+    // Phase 1: 'unsafe-inline' は維持（Phase 2 で nonce に置換）
+    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.jsdelivr.net",
+    "script-src-attr 'none'",
+    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
+    "style-src-attr 'unsafe-inline'",
+    "font-src 'self' https://fonts.gstatic.com",
+    "img-src 'self' data: blob: https://api.qrserver.com https://cdn.shopify.com",
+    // Groq はサーバ→サーバなのでクライアントの connect-src からは外す
+    "connect-src 'self' https://*.myshopify.com",
+    "media-src 'self'",
+    "worker-src 'self'",
+    "manifest-src 'self'",
+    "frame-src 'none'",
+    "object-src 'none'",
+    "base-uri 'self'",
+    "form-action 'self'",
+    "frame-ancestors 'none'",
+    "upgrade-insecure-requests",
+    "block-all-mixed-content",
+    "report-uri /api/csp-report",
+    "report-to csp-endpoint"
+].join('; ');
```

注: Three.js CDN (`cdn.jsdelivr.net`) は **index.html で `<script src="https://cdn.jsdelivr.net/...">` を直接ロードしている**ため、`script-src` のホストリストに**追加が必要**。現状 CSP に書かれていない（!）= **既に CSP 違反している可能性あり** だが、`'unsafe-inline'` ではなく**ホスト許可不足**で読み込めないはず。

→ **要検証**: 現状 CSP のまま `index.html` のデスクトップ Three.js が**実際に動いているか**。動いているなら CSP が緩い別経路（？）か、検証されていない。動いていないなら影響大。

`docs/security-fixes-2026-04-28.md` F9 では「CSP は HTML レスポンスにのみ別途追加」とあり、現実的には**現状 CSP ではデスクトップ P5 (Three.js) が破綻している可能性が極めて高い**。これは Phase 1 patch で `https://cdn.jsdelivr.net` を `script-src` に追加することで解決される。

### 4.2 Phase 2 patch（nonce 導入）

```diff
@@ server.js L452 server.createServer((req, res) => {
+    // Phase 2: per-response nonce
+    const nonce = crypto.randomBytes(16).toString('base64');
+    res.locals = res.locals || {};
+    res.locals.nonce = nonce;
+
     /* security-2026-04-28: 全レスポンスにセキュリティヘッダを付与 ... */
     const _origWriteHead = res.writeHead.bind(res);
     res.writeHead = function(status, statusOrHeaders, maybeHeaders) {
         ...
-        const merged = Object.assign({}, SECURITY_HEADERS, headers);
+        const cspWithNonce = buildCSP(nonce);
+        const merged = Object.assign({}, SECURITY_HEADERS, headers);
         const ct = (headers['Content-Type'] || headers['content-type'] || '');
         if (typeof ct === 'string' && ct.toLowerCase().includes('text/html') && !merged['Content-Security-Policy']) {
-            merged['Content-Security-Policy'] = CSP_HTML;
+            merged['Content-Security-Policy'] = cspWithNonce;
         }
         ...
     };
```

そして HTML 配信箇所（L1109 以降の `fs.createReadStream(filePath).pipe(res)`）を、HTML の場合に限り**インメモリでバッファして `__CSP_NONCE__` プレースホルダを `nonce` に全置換**する変更が必要:

```diff
@@ server.js L1175
-        if (canGzip) {
-            headers['Content-Encoding'] = 'gzip';
-            res.writeHead(200, headers);
-            fs.createReadStream(filePath).pipe(zlib.createGzip({ level: 6 })).pipe(res);
-        } else {
-            res.writeHead(200, headers);
-            fs.createReadStream(filePath).pipe(res);
-        }
+        // Phase 2: HTML だけ nonce プレースホルダを置換してから配信
+        if (isHTML) {
+            fs.readFile(filePath, 'utf8', (err, html) => {
+                if (err) { res.writeHead(500); return res.end('read error'); }
+                const replaced = html.replace(/__CSP_NONCE__/g, nonce);
+                const buf = Buffer.from(replaced, 'utf8');
+                if (canGzip) {
+                    headers['Content-Encoding'] = 'gzip';
+                    headers['Content-Length'] = undefined;
+                    res.writeHead(200, headers);
+                    zlib.gzip(buf, (err2, gzBuf) => {
+                        if (err2) return res.end(buf);
+                        res.end(gzBuf);
+                    });
+                } else {
+                    headers['Content-Length'] = buf.length;
+                    res.writeHead(200, headers);
+                    res.end(buf);
+                }
+            });
+        } else if (canGzip) {
+            headers['Content-Encoding'] = 'gzip';
+            res.writeHead(200, headers);
+            fs.createReadStream(filePath).pipe(zlib.createGzip({ level: 6 })).pipe(res);
+        } else {
+            res.writeHead(200, headers);
+            fs.createReadStream(filePath).pipe(res);
+        }
```

そして `buildCSP(nonce)` ヘルパ:

```js
function buildCSP(nonce) {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "script-src-attr 'none'",
        `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
        "style-src-attr 'none'",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://api.qrserver.com https://cdn.shopify.com",
        "connect-src 'self' https://*.myshopify.com",
        "media-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
        "block-all-mixed-content",
        "report-uri /api/csp-report",
        "report-to csp-endpoint"
    ].join('; ');
}
```

HTML 側の例:

```html
<script nonce="__CSP_NONCE__">
  // モバイル UA 判定 ...
</script>
```

### 4.3 Phase 3 patch（Trusted Types 追加）

```diff
@@ buildCSP(nonce)
         "report-uri /api/csp-report",
-        "report-to csp-endpoint"
+        "report-to csp-endpoint",
+        "require-trusted-types-for 'script'",
+        "trusted-types inryoku-policy"
     ].join('; ');
```

---

## 5. 影響評価（既存機能）

| 機能                              | Phase 1 影響 | Phase 2 影響 | Phase 3 影響 | 備考 |
|------------------------------------|--------------|--------------|--------------|------|
| Particle Universe (P0–P3)          | 中（cdn.jsdelivr.net 許可で復活）| 影響なし | 影響なし | Phase 1 で **CDN ホスト追加が必須**（既に壊れてる可能性高）。 |
| AI Chat                            | 影響なし     | 影響なし     | innerHTML で AI 応答を流していたら破綻 | 要 p3_code_for_claude.js L4706 周辺確認。`textContent` で表示されているなら無問題。 |
| Shopify Checkout                   | 影響なし     | 影響なし     | 影響なし     | `window.location.href = checkoutUrl` で外部遷移 — CSP の form-action / navigate-to は同オリジンに縛るが、**`window.location` 代入は CSP 制約外**。フォーム POST でないので問題なし。 |
| QR コード（api.qrserver.com）      | 影響なし     | 影響なし     | 影響なし     | img-src で許可継続。 |
| Service Worker                     | 影響なし     | 影響なし     | 影響なし     | worker-src 'self' 明示で安定。 |
| Google Fonts                       | 影響なし     | 影響なし     | 影響なし     | style-src/font-src 維持。 |
| GTM（将来）                        | 影響なし     | nonce 化必須 | TT-aware GTM 設定が必要 | GTM は nonce 伝播対応あり (gtm.js の data-nonce-aware)。 |
| 視覚効果（hue-rotate / drop-shadow / mix-blend-mode） | **影響なし** | 影響なし | 影響なし | これらは CSS プロパティ。CSP は CSS の **読み込み元** を制限するだけで、CSS の**表現力**は制限しない。inryokü の grey 美学は完全に温存される。 |
| `success.html` の dot animation    | 影響なし（CSSOM API） | 影響なし | 影響なし | `style.cssText` 代入は CSP 制約外。 |
| `offline.html` の retry リンク    | 影響なし     | **破綻**     | 同左         | `javascript:` URL が 'unsafe-inline' 撤廃で発火しない → button 化必須。 |
| `index.html` の inline `<script>` 4 ブロック | 影響なし | nonce 付与必須 | 同左 | Phase 2 移行コア作業。 |
| `success.html` の inline `<script>` | 影響なし   | nonce 付与必須 | 同左 | 同上。 |
| `offline.html` の inline `<script>` | 影響なし   | nonce 付与必須 | 同左 | 同上。 |
| `<style>` block 全 7 ファイル      | 影響なし     | nonce 付与または外部化 | 同左 | 同上。 |
| `style="..."` 属性（数件）        | 影響なし     | class 化必須 | 同左 | privacy.html L42 / returns.html L48 / index.html L1360-1361。 |

### 5.1 視覚効果と CSP の関係（明示）

CSP で制限されるのは:
- リソースの**読み込み元**（`*-src`）
- inline コードの**実行可否**（`'unsafe-inline'` / nonce / hash）
- フォーム送信先（`form-action`）
- iframe 埋め込み先（`frame-ancestors` / `frame-src`）

CSP で制限されない:
- `filter: hue-rotate(...)` `drop-shadow(...)` `blur(...)` 等の CSS フィルタ
- `mix-blend-mode: difference` `color-burn` 等のブレンドモード
- `transform: scale/rotate/translate3d`
- `backdrop-filter: blur(8px)`
- `clip-path: polygon(...)`
- `mask-image: url(data:...)` — ただし `mask-image: url(https://外部)` は `style-src` ではなく `img-src` の対象（仕様議論あり、ブラウザ実装差異）。

**結論**: inryokü の grey 美学（`linear-gradient(145deg, rgba(...))`、`backdrop-filter: blur(8px)`、`mix-blend-mode`、`hue-rotate` 等）は **CSP どの段階でも完全に維持される**。

---

## 6. CSP report 受信エンドポイント設計

### 6.1 `/api/csp-report` 仕様

CSP report には 2 系統:
1. **`report-uri` 経由** (古い、Firefox/Safari): MIME `application/csp-report` で `{ "csp-report": {...} }` JSON。
2. **`report-to` 経由** (新しい、Chrome/Edge): MIME `application/reports+json` で `[ { "type": "csp-violation", "body": {...} } ]` 配列。

両方を受け付けるハンドラ案:

```js
// ── POST /api/csp-report — CSP 違反受信 ──
if (req.method === 'POST' && req.url === '/api/csp-report') {
    /* レポート flooding 対策: IP × url で 100/min */
    if (!checkRate(req, res, 'csp_report', 100, 60_000)) return;
    readBody(req, res, MAX_BODY_SIZE, (body) => {
        let parsed;
        try { parsed = JSON.parse(body); } catch(e) {
            res.writeHead(204); return res.end();  // sile に
        }
        // 正規化: 配列でも単発でも同じ形にする
        const reports = Array.isArray(parsed)
            ? parsed.map(r => r.body || r)
            : [parsed['csp-report'] || parsed];
        const ip = rateLimitClientIP(req);
        const ua = String(req.headers['user-agent'] || '').slice(0, 200);
        ensureDataDir();
        const dbPath = path.join(__dirname, 'data', 'csp-violations.json');
        let db;
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch(e) { db = { violations: [] }; }
        for (const r of reports) {
            if (!r) continue;
            // フィールド名は report-uri と report-to で異なるので両対応
            db.violations.push({
                ts: new Date().toISOString(),
                ip, ua,
                blockedURI:        r['blocked-uri']        || r.blockedURL    || null,
                violatedDirective: r['violated-directive'] || r.effectiveDirective || null,
                documentURI:       r['document-uri']       || r.documentURL   || null,
                sourceFile:        r['source-file']        || r.sourceFile    || null,
                lineNumber:        r['line-number']        || r.lineNumber    || null,
                originalPolicy:    r['original-policy']    || r.originalPolicy|| null,
                disposition:       r.disposition || null
            });
        }
        // ローテーション: 5000 件超えたら古い 1000 件を捨てる
        if (db.violations.length > 5000) db.violations = db.violations.slice(-4000);
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        res.writeHead(204); res.end();
    });
    return;
}
```

セキュリティ留意:
- **ボディサイズ上限**を厳しく（既存 50KB で十分）。
- **IP × URL でレート制限**（攻撃者が大量 violation を送りつけて `csp-violations.json` を肥大化させる DoS）。
- **`document-uri` `source-file` は無検証で保存しない** — 表示時には escapeHTML 必須（admin UI を作るなら）。
- **CORS 不要** — ブラウザ自身が同オリジン POST するので。

### 6.2 Report-Only モードでの段階的厳格化

新しい CSP を本適用する前に **観測のみ** 走らせる:

```
Content-Security-Policy-Report-Only: <new strict policy>
Content-Security-Policy:             <current loose policy>
```

両方を同時送信できる。Report-Only の違反だけが `/api/csp-report` に届くので、**実害なしに新ポリシーで何が壊れるかを 1〜2 週間観測**してから本適用。

server.js では `withSecHeaders` を拡張して両方を吐く版を作る:

```js
// Phase 1.5 — 段階移行モード
'Content-Security-Policy':          CSP_PHASE_1,
'Content-Security-Policy-Report-Only': CSP_PHASE_2_DRAFT,
```

### 6.3 admin 用違反ダッシュボード（任意）

`GET /api/csp-violations` を admin auth 付きで提供:

```js
if (req.method === 'GET' && req.url === '/api/csp-violations') {
    if (!checkRate(req, res, 'admin', 20, 60_000)) return;
    if (!checkAdminAuth(req, res)) return;
    const dbPath = path.join(__dirname, 'data', 'csp-violations.json');
    let db;
    try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch(e) { db = { violations: [] }; }
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ count: db.violations.length, violations: db.violations.slice(-200) }));
    return;
}
```

最近の 200 件のみ返却。トップ N の `violatedDirective` を集計するロジックを足してもよい。

---

## 7. モバイル考慮事項

### 7.1 iOS Safari の CSP 解釈差

| 項目                          | iOS Safari の挙動                                          |
|-------------------------------|--------------------------------------------------------------|
| `'strict-dynamic'`            | **Safari 15.4+ で対応**。それ以前は無視され、ホストリスト + nonce で動く（CSP forward-compatible）。inryokü は既に SF-Mono / iOS 14+ 想定なら問題なし。 |
| `report-to`                   | **未対応**（2026 時点でも実装中）。`report-uri` は対応。両方並列で吐けば iOS にも届く。 |
| `Reporting-Endpoints` ヘッダ  | 同上、未対応。 |
| `require-trusted-types-for`   | **未対応**。Phase 3 を入れても iOS では noop（progressive enhancement）。 |
| `block-all-mixed-content`     | 対応。 |
| `upgrade-insecure-requests`   | 対応（古くから）。 |
| `frame-ancestors`             | 対応。X-Frame-Options との二重防御は Safari でも有効。 |
| `Permissions-Policy`          | **iOS 16.4+ で部分対応**。古い iOS は無視。`Feature-Policy`（旧名）は完全廃止なので付ける必要なし。 |
| `COOP: same-origin`           | iOS 15.4+ 対応。 |
| `COEP: require-corp`          | iOS 15.4+ 対応だが Three.js CDN 等が壊れる。 |
| `CORP`                        | iOS 14+ 対応。 |
| `data:` URI in img-src        | 対応。`success.html` の SVG inline 画像は問題なし。 |

iOS 固有の落とし穴:
- **iOS Safari は CSP 違反時にコンソールエラーが見えない場合がある** — リモートデバッグ（macOS Safari の Develop メニュー）必須。
- **`<meta http-equiv="Content-Security-Policy">`** は iOS でも対応するが、`frame-ancestors` `report-uri` `sandbox` は meta では効かない仕様。**HTTP ヘッダで配信する現状の実装が正解**。

### 7.2 Android Chrome の Trusted Types 対応

- Android Chrome（80%+ シェア）は **Trusted Types 完全対応** (Chrome 83+)。
- Samsung Internet も Chromium ベースなので追従。
- Phase 3 を入れた場合、Android Chrome では innerHTML 注入が即ブロック → Phase 3 の主受益者。

### 7.3 モバイル特有の機能と CSP

| 機能                              | 関連ディレクティブ | コメント |
|------------------------------------|---------------------|----------|
| Add to Home Screen (PWA)          | `manifest-src`      | `manifest.json` 配信。Phase 1 で `'self'` 明示済み。 |
| Service Worker (offline.html)     | `worker-src`        | `'self'` で OK。 |
| iOS の "Smart App Banner"         | meta tag のみ       | CSP 影響なし。 |
| iOS の autoplay 制限              | `Permissions-Policy: autoplay=(self)` | inryokü の起動 SE があるなら必要。 |
| Android のフルスクリーン演出      | `Permissions-Policy: fullscreen=(self)` | 将来の P3 没入演出のため self 許可。 |
| Web Share API                     | CSP 影響なし        | — |

### 7.4 モバイル UA 判定の inline script（index.html L1344）

このスクリプトは:
1. 最初に動かないと desktop で重い Three.js が読まれてしまう。
2. **DOMContentLoaded を待てない**（`<body>` 直後に同期実行が必要）。
3. 外部 JS 化すると同期ロード分の遅延がモバイル復帰の体験を損なう。

→ **Phase 2 移行時、最優先で nonce 化する候補**。外部ファイル化は推奨しない。

---

## 8. 移行ロードマップ

### マイルストン M1: Phase 1 即適用（推定 1 日）

1. `server.js` の `SECURITY_HEADERS` / `CSP_HTML` を §4.1 の diff に置換。
2. **重要**: `script-src` に `https://cdn.jsdelivr.net` を追加（既に index.html で使っているため、現状 CSP では破綻している可能性大 — 要検証）。
3. `connect-src` から `https://api.groq.com` を削除（クライアントから直叩きしない）。
4. `Permissions-Policy` を 14 機能に拡張。
5. `COOP` `CORP` `Origin-Agent-Cluster` `X-Permitted-Cross-Domain-Policies` 追加。
6. `Reporting-Endpoints` ヘッダ追加。
7. `script-src-attr 'none'` 追加（production HTML に inline handler 0 件のため安全）。
8. `frame-src 'none'` `object-src 'none'` `worker-src 'self'` `manifest-src 'self'` `media-src 'self'` 追加。
9. `upgrade-insecure-requests` `block-all-mixed-content` 追加。
10. **HSTS preload は要検証** — `inryoku.com` の DNS / メール用 MX / 全サブドメインの HTTPS 状態を確認後に追加。

### マイルストン M2: CSP report 受信実装（推定 半日）

1. `/api/csp-report` ハンドラ追加（§6.1）。
2. レート制限 `csp_report: 100/min`。
3. `data/csp-violations.json` のローテーション（5000 件上限）。
4. admin 用 `GET /api/csp-violations` 追加（任意）。

### マイルストン M3: Report-Only による Phase 2 観測（推定 1〜2 週間）

1. `Content-Security-Policy-Report-Only` ヘッダで Phase 2 ポリシー（nonce ありだが nonce 未注入の状態）を吐く。
2. 全ページで何件違反が出るか観測。
3. 主な違反元を整理 → nonce 化計画の refinement。

### マイルストン M4: nonce / 外部 JS 化作業（推定 2〜3 日）

1. `server.js` で per-response nonce 生成（§4.2 patch）。
2. 全 inline `<script>` / `<style>` に `nonce="__CSP_NONCE__"` を付与。
   - `index.html` L91, L1333, L1344, L1373
   - `success.html` L146
   - `offline.html` L42
   - 全 7 HTML の `<style>` ブロック
3. **HTML 配信時の nonce 置換**（§4.2 patch）。
4. `style="..."` 属性数件を class 化:
   - `privacy.html` L42 → `<p class="legal-updated">`
   - `returns.html` L48 → 同上
   - `index.html` L1360-1361 → `<canvas class="three-canvas-fixed">` + 既存 CSS に移動
5. `offline.html` の `javascript:location.reload()` を `<button id="retry-btn">` + 外部 JS に変更。
6. **`success.html` の inline `<script>` を `success-decor.js` に切り出し**（nonce より外部化のほうが楽）。

### マイルストン M5: Phase 2 本適用（推定 半日）

1. Report-Only を本ヘッダに昇格。
2. `'unsafe-inline'` を `script-src` / `style-src` から完全削除。
3. `script-src` の `https://cdn.jsdelivr.net` を削除（`'strict-dynamic'` で nonce 経由ロードに依存）。
4. CSP 違反が `/api/csp-report` に何件来るか 1 日観測。
5. 0 件で安定したら完了。

### マイルストン M6: Phase 3 (Trusted Types) 検討（推定 3〜5 日）

1. `innerHTML` 利用箇所の全件監査（特に `p3_code_for_claude.js` 15 件）。
2. DOMPurify を `vendor/` に追加 (self-host)。
3. `vendor/trusted-types-policy.js` を最初にロード。
4. 全 `innerHTML` 代入を `inryokuTT.createHTML(...)` 経由に変更、または `textContent` 化。
5. `Content-Security-Policy-Report-Only` で `require-trusted-types-for 'script'; trusted-types inryoku-policy` を 1 週間観測。
6. 違反 0 を確認後、本ヘッダへ昇格。

### マイルストン M7: HSTS Preload 登録（任意・別タスク）

1. `inryoku.com` の DNS / メール / サブドメインの HTTPS 状態確認。
2. `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` を本番で 1 週間以上稼働。
3. https://hstspreload.org/ で submit。
4. 登録後は **HSTS の解除が極めて困難** — `includeSubDomains` の影響範囲を事前に確認。

---

## 付録 A: 攻撃シナリオ × 防御マッピング

| 攻撃                                          | 現状 CSP | Phase 1 | Phase 2 | Phase 3 |
|------------------------------------------------|----------|---------|---------|---------|
| 反射 XSS（`?q=<script>...`）でインライン script 実行 | ✗ 防げない（`'unsafe-inline'`） | ✗ | ◎ | ◎ |
| ストアード XSS（DB 経由で `<img src=x onerror=...>`） | ✗ | ◎（`script-src-attr 'none'`） | ◎ | ◎ |
| innerHTML 経由 XSS                             | ✗ | ✗（CSP は innerHTML を防げない） | ✗ | ◎（Trusted Types） |
| clickjacking                                   | ◎ | ◎ | ◎ | ◎ |
| iframe 注入で UI 偽装                          | ◎（frame-ancestors='none'） | ◎ | ◎ | ◎ |
| 外部 CDN への data exfiltration                | △（connect-src 'self' + myshopify + groq） | ◎（groq 削除） | ◎ | ◎ |
| Mixed content（HTTP 画像で MITM）              | ✗ | ◎ | ◎ | ◎ |
| `<base href=evil>` で全相対 URL hijack         | ◎（base-uri='self'） | ◎ | ◎ | ◎ |
| Service Worker 注入                           | ✗（worker-src 未指定） | ◎ | ◎ | ◎ |
| Flash/Java applet 経由 XSS                     | ✗（object-src 未指定） | ◎ | ◎ | ◎ |
| Web Worker 経由でクロス origin fetch           | ✗ | ◎ | ◎ | ◎ |
| FLoC / Topics トラッキング                     | ✗ | ◎（Permissions-Policy） | ◎ | ◎ |
| Spectre 系（COOP 未設定で window.opener 経由） | ✗ | ◎（COOP=same-origin） | ◎ | ◎ |

---

## 付録 B: 検証チェックリスト

Phase 1 適用後:

- [ ] `curl -I https://inryoku.com/` でヘッダ確認
- [ ] Chrome DevTools → Security タブで CSP 表示確認
- [ ] https://securityheaders.com/?q=inryoku.com で A 以上を獲得
- [ ] https://observatory.mozilla.org/ で A 以上
- [ ] https://csp-evaluator.withgoogle.com/ で `'unsafe-inline'` 以外の警告ゼロ
- [ ] desktop で Three.js Particle Universe が動く（CDN 許可確認）
- [ ] mobile で UA 判定 → P3 リダイレクトが動く
- [ ] AI Chat が動く（`/api/chat` が `connect-src 'self'` で通る）
- [ ] Shopify checkout 遷移が動く（`window.location` で外部遷移、CSP 影響なし）
- [ ] QR PNG が表示される (`api.qrserver.com`)
- [ ] Service Worker が登録される (`worker-src 'self'`)
- [ ] PWA インストール促進が動く (`manifest.json` が `manifest-src 'self'` で通る)
- [ ] `/api/csp-report` に違反が来るかログ確認

Phase 2 適用後:

- [ ] 全 inline `<script>` に nonce が注入されている（DevTools で attribute 確認）
- [ ] 全 `<style>` block に nonce
- [ ] CSP report に `'unsafe-inline'` 由来の違反が出ない（出たら見落とし）
- [ ] `offline.html` の retry が動く（button 化済み）
- [ ] `success.html` のパーティクル装飾が動く
- [ ] iOS Safari 14 以下でも nonce + ホストリストで動く（forward-compat 確認）

Phase 3 適用後:

- [ ] Chrome で `inryokuTT.createHTML(...)` 経由でない innerHTML が全部ブロック
- [ ] Firefox / Safari では何も変わらない（Trusted Types 未対応で noop）
- [ ] CSP report に Trusted Types 違反が来るかログ確認

---

## 付録 C: 参考リソース

- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- Google CSP Evaluator: https://csp-evaluator.withgoogle.com/
- W3C Trusted Types: https://w3c.github.io/trusted-types/
- HSTS Preload: https://hstspreload.org/
- Mozilla Observatory: https://observatory.mozilla.org/
- Reporting API: https://www.w3.org/TR/reporting-1/
- Permissions-Policy explainer: https://github.com/w3c/webappsec-permissions-policy

---

**END OF AUDIT — 2026-04-28**
