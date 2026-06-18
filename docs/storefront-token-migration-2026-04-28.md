# Shopify Storefront Token サーバ中継 移行設計（2026-04-28）

## 背景

`p3_code_for_claude.js:65-68` にクライアント Storefront token がハードコードされている：

```js
const SHOPIFY_CONFIG = {
    storeDomain: '0xi10h-x1.myshopify.com',
    storefrontToken: 'ce0dc399245e874fd85d218df2d9bb04',
    apiVersion: '2024-10'
};
```

Storefront token は public access token（read-only / cart 操作のみ）の建前ではあるが、

- ハードコードの token は revoke 困難（バンドル更新→キャッシュ→SW で長期間生存）
- rate limit / abuse 緩和をサーバ側で挟めない
- 将来 customer / order / private metafield に拡張する際、再設計が必要
- CSP `connect-src` から `https://*.myshopify.com` を外せない（self だけにできない）

→ サーバ中継（`/api/shopify/graphql`）へ全面移行する。

## 設計

### 1. サーバ側：許可リスト型 GraphQL プロキシ

`server.js` に `/api/shopify/graphql` を追加（実装済み）。

- POST `/api/shopify/graphql` { query, variables, operationName? }
- サーバが `.env` の `SHOPIFY_STOREFRONT_TOKEN` を使って Shopify に転送
- レスポンスは Shopify の `{ data, errors }` をそのまま返す
- 単一 operation 強制（複数の場合は `operationName` 必須）
- subscription は常に拒否

#### 許可リスト（whitelist）

| Type | 許可 root field |
|------|-----------------|
| query | products / productByHandle / productByHandles / product / variantById / variantsByIds / cart / collections / collectionByHandle / shop |
| mutation | cartCreate / cartLinesAdd / cartLinesUpdate / cartLinesRemove / cartBuyerIdentityUpdate / cartAttributesUpdate / cartNoteUpdate |

**禁止:** customerCreate / customerAccessTokenCreate / checkoutCreate / metaobject 系 / 任意の未知 root field。

alias での偽装（`cartCreate: customerCreate(...)`）も alias 後の実フィールド名を見て拒否する。

#### Rate limit

- 専用 bucket: `shopify_proxy` 90/min/IP（商品閲覧で連続発火しうるため checkout 20/min より寛容）
- 既存 generic 60/min/IP は別 bucket としてそのまま掛かる

### 2. クライアント側：`shopify-proxy-client.js`

`window.shopifyFetchProxy(query, variables, options)` を提供（新規ファイル、p3 とは独立）。

- `/api/shopify/graphql` に POST
- timeout 15s（AbortController）
- offline は `err.networkError = true`
- 4xx は `err.status / err.payload.reason` 付きで reject
- 200 は GraphQL レスポンスをそのまま resolve（`data.errors` は呼び出し側で見る）

ヘルパ `cartCreateViaProxy(lines, attributes)` を用意（既存 `shopifyCheckout` と互換的に使える）。

### 3. p3_code_for_claude.js の扱い（Codex hot file）

p3 は Codex に任せるため、本タスクでは触らない。代わりに以下を準備：

- `shopify-proxy-client.js` を `index.html`（および p3 を読む各 HTML）に `<script>` で先読みすれば `window.shopifyFetchProxy` が使えるようになる
- p3 側で必要な書き換えは「Codex への申送り」を参照

## 移行ロードマップ

### Phase 0：現状（2026-04-28 直前）

- p3 から直接 `https://*.myshopify.com/api/2024-10/graphql.json` を叩いている
- 既に `/api/checkout` は存在し、cartCreate のみサーバ中継済み
- token はクライアントにハードコード

### Phase 1：プロキシ追加（本タスク完了時）

- `/api/shopify/graphql` 追加（許可リスト型）
- `shopify-proxy-client.js` 追加（共存）
- 既存の `shopifyFetch` / `/api/checkout` は維持
- 動作変化なし（p3 は旧経路のまま）

### Phase 2：p3 切替（Codex 担当）

p3_code_for_claude.js を以下に書き換え：

```diff
 // Shopify Storefront API GraphQL呼び出し
 function shopifyFetch(query, variables) {
-    if (!SHOPIFY_CONFIG.storeDomain || !SHOPIFY_CONFIG.storefrontToken) {
-        return Promise.reject(new Error('Shopify not configured'));
-    }
-    return fetch('https://' + SHOPIFY_CONFIG.storeDomain + '/api/' + SHOPIFY_CONFIG.apiVersion + '/graphql.json', {
-        method: 'POST',
-        headers: {
-            'Content-Type': 'application/json',
-            'X-Shopify-Storefront-Access-Token': SHOPIFY_CONFIG.storefrontToken
-        },
-        body: JSON.stringify({ query: query, variables: variables })
-    }).then(function(r) { return r.json(); });
+    // サーバ中継経由（クライアントは token を持たない）
+    if (typeof window.shopifyFetchProxy !== 'function') {
+        return Promise.reject(new Error('shopifyFetchProxy not loaded'));
+    }
+    return window.shopifyFetchProxy(query, variables);
 }
```

加えて：

```diff
 const SHOPIFY_CONFIG = {
-    storeDomain: '0xi10h-x1.myshopify.com',
-    storefrontToken: 'ce0dc399245e874fd85d218df2d9bb04',
-    apiVersion: '2024-10'
+    // token / domain はサーバ側 .env で管理。クライアント保持しない。
+    apiVersion: '2024-10' // 互換のため残す（参照箇所があれば後段で削除）
 };
```

`shopifyCheckout(cartItems)` は内部で `shopifyFetch` を呼ぶため自動的にプロキシ経由になる。
`/api/checkout` を直接叩いている既存の checkout フォールバック（p3:5160 周辺）はそのまま維持。

### Phase 3：CSP 締め直し

p3 切替後、CSP `connect-src` から Shopify ドメインを削除：

```diff
- "connect-src 'self' https://*.myshopify.com",
+ "connect-src 'self'",
```

これにより、万一フロントが侵害されても外部 Shopify GraphQL に直接到達できなくなる。

### Phase 4：token 完全削除

- p3 のハードコード token 行を削除（Phase 2 で実質コメント化されているのを正式に消す）
- Shopify 管理画面で旧 token を **revoke**
- 新しい token を `.env.SHOPIFY_STOREFRONT_TOKEN` に設定（既存）
- バンドル / SW キャッシュをパージ（`sw.js` の version bump）
- `data/` 配下に旧 token 文字列が残っていないか `git grep` で確認

## 各段階の動作保証

| Phase | クライアント token | プロキシ | 旧 /api/checkout | 既存テスト |
|-------|---------------------|----------|-------------------|------------|
| 0 | あり | なし | あり | pass |
| 1 | あり（未使用化準備） | あり | あり | pass（30 件追加） |
| 2 | コードから削除（fallback で空文字） | あり | あり（保険） | pass |
| 3 | なし | あり | あり | CSP 違反テスト追加要 |
| 4 | なし、revoke 済み | あり | あり | pass |

各段階で「直前段階に戻せる」ように既存実装を残す（Phase 2 で `shopifyFetch` 関数自体を消さない）。

## セキュリティ考慮

### 攻撃ベクタ別の評価

1. **任意 GraphQL の透過** → whitelist で root field を制限。不明 op は 403。
2. **alias 偽装** (`cartCreate: customerCreate(...)`) → alias の後の実フィールド名を見て判定。
3. **複数 operation で禁止 op を混入** → operationName 必須化、該当 op のみ評価。
4. **コメント / 文字列内に `mutation` リテラル** → コメント除去・文字列リテラル除去後にパース。
5. **巨大 query DoS** → 16KB 超は拒否。
6. **Subscription 経由のロングコネクション** → 常に拒否。
7. **rate flood** → IP 単位 90/min。
8. **token 漏洩経路** → サーバプロセス内のみで保持。`.env` 以外に書かない。

### 制限事項

- 正規表現ベースのパーサのため、極端に変則的な GraphQL 構文（極端なネスト・改行・制御文字混入）で誤検出の可能性は理論上ある。許可リストは **default deny** なので、誤検出はあっても「許可されない側」に倒れる設計。
- 拒否されたクエリは log に出る。レスポンス本文には `reason` を含めるが、内部構造は露出しない。

## Codex への申送り

- **触ってほしい**:
  - `p3_code_for_claude.js:64-68` の `SHOPIFY_CONFIG` から `storefrontToken` / `storeDomain` を削除（Phase 2）
  - `p3_code_for_claude.js:154-166` の `shopifyFetch` 本体を `window.shopifyFetchProxy(query, variables)` への薄いラッパに置き換え
  - `index.html`（p1_index_for_claude.html / p3_test.html 含む）に `<script src="shopify-proxy-client.js" defer></script>` を p3 読み込み**前**に挿入
  - 旧 token 文字列が `data/` `public/` `vendor/` 等に残っていないか grep して掃除
- **触らないでほしい**:
  - `server.js` の `/api/shopify/graphql` 実装（仕様変更時は本ドキュメント更新を伴ってから）
  - `shopify-proxy-client.js`（仕様 freeze。バグ修正以外不可）
  - `tests/shopify-proxy.test.mjs`（whitelist の expectation を Codex が緩めないこと）
- **whitelist 拡張が必要になったら**:
  1. 本ドキュメントの whitelist 表を更新
  2. `server.js` の `SHOPIFY_QUERY_WHITELIST` / `SHOPIFY_MUTATION_WHITELIST` に追加
  3. `tests/shopify-proxy.test.mjs` に新 op の許可テストと、隣接する禁止 op の拒否テストを追加
  4. CSP に影響する場合は `csp-tuning-2026-04-28.md` を併せて更新

## 完了条件 / 確認

- [x] `node -c server.js` syntax OK
- [x] `npm test` 全 210 pass（うち shopify-proxy 30 件）
- [x] 既存 `/api/checkout` は触っていない（diff で確認）
- [x] `shopify-proxy-client.js` は p3 とは独立。p3 を触らずに切替準備が整っている
- [x] whitelist は default deny で、許可リスト追加なしには新 root field を通せない
