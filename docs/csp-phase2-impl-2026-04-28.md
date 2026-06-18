# CSP Phase 2 実装記録 — nonce 注入 + 'unsafe-inline' 撤廃

**Date:** 2026-04-28
**Status:** 実装完了 / デフォルト OFF（CSP_STRICT=1 で有効化）
**Phase 1 doc:** [csp-phase1-impl-2026-04-28.md](./csp-phase1-impl-2026-04-28.md)
**設計:** [csp-tuning-2026-04-28.md](./csp-tuning-2026-04-28.md) Phase 2 セクション

---

## 1. 実装内容

### 1.1 Phase 1 → Phase 2 の差分

| 項目 | Phase 1 | Phase 2 |
|---|---|---|
| `script-src` | `'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.jsdelivr.net` | `'self' 'nonce-XYZ' 'strict-dynamic' https://www.googletagmanager.com https://cdn.jsdelivr.net` |
| `style-src`  | `'self' 'unsafe-inline' https://fonts.googleapis.com` | `'self' 'nonce-XYZ' https://fonts.googleapis.com` |
| `style-src-attr` | `'unsafe-inline'`（属性 style 維持） | `'unsafe-inline'`（属性 style 維持・変更なし） |
| inline `<script>` | nonce なしで動く | **CSP_STRICT=1 時、サーバが自動で `nonce="..."` 注入** |
| inline `<style>`  | nonce なしで動く | **CSP_STRICT=1 時、サーバが自動で `nonce="..."` 注入** |
| 切替 ENV | n/a | `CSP_STRICT=1` |

`'strict-dynamic'`：nonce 付き script から `document.createElement('script'); s.src = '...'` で動的に読み込まれる子スクリプトはホスト許可リストなしで実行可（index.html L1381 の P2/P3 動的 import を温存）。

### 1.2 server.js の変更点（CSP 関連のみ）

すべて `security-2026-04-28-phase2:` コメント付きで識別可能。

1. **`CSP_STRICT` フラグ**（const）
   `process.env.CSP_STRICT === '1'` の真偽値。

2. **`generateNonce()`**
   `crypto.randomBytes(16).toString('base64')` で 24 文字 nonce。

3. **`buildStrictCSP(nonce)`**
   nonce 入りの strict CSP 文字列を返す（Phase 1 の `CSP_HTML` と同 directive 群を base に、script-src/style-src のみ nonce + strict-dynamic に置換）。

4. **`injectNonceIntoHTML(html, nonce)`**
   - `<script>` 開始タグ：`src=` を持たず `nonce=` を持たないものに `nonce="..."` 注入
   - `<style>` 開始タグ：`nonce=` を持たないものに `nonce="..."` 注入
   - **idempotent**：二度適用しても結果不変
   - 大文字混在・属性順序混在に対応

5. **`withSecHeaders(extra, isHTML, nonce)`**
   既存シグネチャに `nonce` 追加。`CSP_STRICT && nonce` のときだけ strict CSP を返す。

6. **request scope の nonce**
   `res._cspNonce = generateNonce()` をリクエスト開始時に毎回生成。

7. **`writeHead` ラッパ**
   - HTML レスポンスを検出すると、`CSP_STRICT` のとき `buildStrictCSP(res._cspNonce)` をセット
   - 同時に `res.end` / `res.write` をラップして body をバッファし、送出直前に `injectNonceIntoHTML` を適用
   - ただし `Content-Encoding` が既に立っている場合（gzip 済み）は、バイナリ破壊回避のためスキップ

8. **静的 HTML 配信**
   `CSP_STRICT` 時は `fs.createReadStream` の代わりに `fs.readFile` でバッファ → 注入 → 必要なら gzip → 送出。
   静的 JS / CSS / 画像 / フォント等はストリームのまま（変更なし）。

9. **404 ページ（インライン HTML）**
   `<style>` を `<style nonce="...">` に書き換え。

10. **`/grey/:number` の動的 HTML**
    `writeHead` ラッパの end フック経由で nonce が注入される（個別修正不要）。

### 1.3 触らなかったもの

- HTML / クライアント JS / その他 production code（厳守）
- `/api/csp-report` / Reporting-Endpoints / Report-To（Phase 1 のまま維持）
- Phase 1 の `CSP_HTML` 文字列（CSP_STRICT 未設定時のフォールバック）

---

## 2. 動作確認手順

### 2.1 Phase 1 互換（デフォルト）

```bash
PORT=3399 node server.js
curl -s -D - http://localhost:3399/index.html -o /dev/null | grep -i content-security-policy
# →  ... 'unsafe-inline' ... が含まれる（Phase 1 と同一）
```

### 2.2 Phase 2 有効化

```bash
PORT=3399 CSP_STRICT=1 node server.js
curl -s -D - http://localhost:3399/index.html -o /tmp/idx.html | grep -i content-security-policy
# →  ... 'nonce-XYZ' 'strict-dynamic' ... を含み、script-src / style-src 両方から 'unsafe-inline' が消える
grep -oE '<script nonce="[^"]+"' /tmp/idx.html | head -3
grep -oE '<style nonce="[^"]+"'  /tmp/idx.html | head -3
# →  body 中の inline tag に nonce 属性が付与されている
```

### 2.3 nonce のリクエストごとユニーク性

```bash
for i in 1 2 3; do
  curl -s -D - http://localhost:3399/index.html -o /dev/null \
    | grep -oE "'nonce-[^']+'" | head -1
done
# →  3 つすべて異なる base64 値
```

### 2.4 既存機能の手動確認チェックリスト

CSP_STRICT=1 でブラウザ実機（Chrome / Safari）：

- [ ] particle universe（Three.js CDN）が描画される
- [ ] AI chat（/api/chat）が動く
- [ ] checkout（Shopify proxy）が動く
- [ ] Service Worker（sw.js）が登録される
- [ ] Phase 2 / Phase 3 の動的 script 読み込みが動く（strict-dynamic）
- [ ] Google Fonts（fonts.googleapis.com）が読める
- [ ] DevTools Console に CSP violation 出ていない
- [ ] `/api/csp-report` に違反 POST が来ていない（サーバログで確認）

### 2.5 自動テスト

```bash
npm test
# tests 506 / pass 506（既存 477 + Phase 2 新規 29）
```

---

## 3. 移行ロードマップ

| 段階 | アクション | 判定 |
|---|---|---|
| **0. 準備（完了）** | Phase 2 実装・テスト・doc | 本コミット |
| **1. dev 検証** | ローカルで `CSP_STRICT=1` 起動、全機能を一通り触る・DevTools で violation 監視 | 違反 0 件で次へ |
| **2. staging 段階適用** | staging 環境の env に `CSP_STRICT=1` 設定、24〜72h 観測 | `[CSP-REPORT]` ログを集計、違反 < 0.1% で次へ |
| **3. production 適用** | production の env に `CSP_STRICT=1` 設定 | 違反増加を 1 週間モニタ |
| **4. Phase 1 撤去** | `CSP_HTML`（旧 string）と `CSP_STRICT` 分岐を削除、strict のみ残す | Phase 3（Trusted Types）へ |

---

## 4. ロールバック手順

### 4.1 即時ロールバック（運用環境）

```bash
# 環境変数を外して再起動するだけ
unset CSP_STRICT
# or .env / process manager / docker-compose.yml から CSP_STRICT=1 を削除
node server.js
```

これで Phase 1 互換に即座に戻る（`'unsafe-inline'` 復活、nonce 注入なし）。

### 4.2 コードレベルのロールバック

すべての変更は `security-2026-04-28-phase2:` タグ付きコメントでマークしてある。git revert で本コミットを戻すと完全に Phase 1 へ戻る。

```bash
git log --oneline | grep -i "phase 2"
git revert <commit-sha>
```

### 4.3 部分的ロールバック（CSP だけ Phase 1 に固定）

`server.js` の以下を編集：

```js
const CSP_STRICT = false;  // 強制 OFF
```

---

## 5. 既知の制約 / 次の課題

### 5.1 残る `'unsafe-inline'`

`style-src-attr 'unsafe-inline'` のみ残存。これは `<div style="...">` のような **属性 style** を許可するため。本サイトには数件残っており、Phase 3 で CSS class 化して撤廃予定（[csp-tuning doc](./csp-tuning-2026-04-28.md) L155 参照）。

### 5.2 `javascript:` URL

`offline.html` 等に `<a href="javascript:location.reload()">` が残っている場合、Phase 2 で壊れる可能性あり（[tuning doc L170](./csp-tuning-2026-04-28.md)）。
→ 検証段階（Roadmap 1）で violation report をモニタし、必要に応じて `<button id="retry-btn">` + 外部 JS に書き換え。

### 5.3 gzip 済みレスポンスへの非介入

writeHead ラッパで `Content-Encoding` が立っているケースは body 注入をスキップする。現状の HTML 配信パスで gzip を立てるのは「静的 HTML strict 分岐」だけだが、そこは事前に injectNonceIntoHTML を済ませてから gzip しているので問題なし。将来 `Content-Encoding` を立てる経路を追加する場合は、注入後に圧縮することを徹底する。

### 5.4 Phase 3（Trusted Types）

Phase 2 完了後、`require-trusted-types-for 'script'` 等で innerHTML 起因 XSS の構造的封じ込めへ進む。設計は [csp-tuning doc](./csp-tuning-2026-04-28.md) Phase 3 セクション参照。

---

## 6. 参考

- [W3C CSP Level 3 — strict-dynamic](https://www.w3.org/TR/CSP3/#strict-dynamic-usage)
- [Google web.dev — Mitigate XSS with a strict CSP](https://web.dev/articles/strict-csp)
- 本サイト Phase 1 実装: [csp-phase1-impl-2026-04-28.md](./csp-phase1-impl-2026-04-28.md)
- 設計母艦: [csp-tuning-2026-04-28.md](./csp-tuning-2026-04-28.md)
