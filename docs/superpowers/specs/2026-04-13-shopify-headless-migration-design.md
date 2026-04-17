# Shopify Starter Headless Migration — Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Author:** Claude + 司

## Goal

P3 ECショップのバックエンド（決済・注文管理・印刷発注）を自前Stripe + Gelato API実装から **Shopify Starter ($5/月) + Gelato公式プラグイン** に移行する。P3フロントエンド（パーティクルユニバース）は一切変更しない。

## Motivation

- 自前Stripe Webhook + Gelato API連携が未テスト状態で、保守リスクが高い
- 注文管理画面がない（メモリ上の配列のみ、再起動で消失）
- 発送追跡・税金計算を自力で実装する必要がある
- Shopify + Gelato公式プラグインなら上記すべてが自動化される

## Architecture

```
[Customer] → [P3 Particle Universe (自前サーバー)]
                    ↓ カートに追加
              Shopify Storefront API (GraphQL)
                    ↓ cartCreate / cartLinesAdd
              [CHECKOUT] → cart.checkoutUrl へリダイレクト
                    ↓
              Shopify Checkout (hosted)
                    ↓ 決済完了
              Shopify Order → Gelato公式プラグインが自動で印刷・発送
```

## Scope

### 変更するファイル

#### 1. `p3_code_for_claude.js`

**PRODUCTS配列:**
- 各商品に `shopifyVariantId` フィールドを追加
- サイズごとにvariant IDが異なるため、`shopifyVariants: { S: 'gid://...', M: 'gid://...', ... }` のマッピングを追加
- 既存の `id`, `name`, `price`, `image`, `description` 等はフロント表示用にそのまま維持

**CARTオブジェクト:**
- 現在: localStorage保存 → `POST /api/checkout` → Stripe Checkout Session → リダイレクト
- 移行後: localStorage保存（UI表示用）+ Shopify Storefront API でサーバーサイドカート作成
- `CART.checkout()` メソッド追加: Storefront APIでカート→チェックアウトURL取得→リダイレクト

**Storefront API クライアント:**
- `fetch()` でGraphQL直接呼び出し（SDKは使わない、依存を増やさないため）
- エンドポイント: `https://{store}.myshopify.com/api/2024-10/graphql.json`
- ヘッダー: `X-Shopify-Storefront-Access-Token: {token}`

**GraphQL Mutations:**
```graphql
# カート作成
mutation cartCreate($input: CartInput!) {
  cartCreate(input: $input) {
    cart {
      id
      checkoutUrl
    }
    userErrors { field message }
  }
}

# カートにアイテム追加
mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) {
    cart {
      id
      checkoutUrl
      lines(first: 10) {
        edges { node { id quantity merchandise { ... on ProductVariant { id title } } } }
      }
    }
    userErrors { field message }
  }
}
```

**チェックアウトフロー:**
1. CHECKOUTボタン押下
2. CART.items からShopify variant IDとquantityを抽出
3. `cartCreate` mutation でカート作成（lines含む）
4. レスポンスの `checkoutUrl` へ `window.location.href` でリダイレクト
5. Shopifyホスト画面で決済完了
6. 完了後 `success.html` へリダイレクト（Shopify管理画面で設定）

**カートドロワー (`showCartDrawer`):**
- UI表示はlocalStorageのデータを引き続き使用（即時表示のため）
- CHECKOUTボタンのクリックハンドラのみ変更（`/api/checkout` → Storefront API）
- 「Powered by Stripe」→ 「Secure Checkout」に文言変更

#### 2. `server.js`

**削除するコード:**
- `POST /api/checkout` エンドポイント（Stripe Checkout Session作成）全体
- `POST /api/webhook` エンドポイント（Stripe webhook + Gelato注文作成）全体
- Stripe関連のインポート・設定コード
- Gelato API呼び出しコード
- `recentOrders` 配列と関連ロジック

**残すコード:**
- 静的ファイル配信
- `POST /api/subscribe` （メール登録）
- `POST /api/contact` （コンタクトフォーム）
- `POST /api/chat` （AIチャット）
- `GET /api/subscribers` （管理者用）
- QRTリファラル関連（もしあれば）

#### 3. `.env`

**削除:**
- `STRIPE_SECRET_KEY`

**追加:**
- `SHOPIFY_STORE_DOMAIN` — `{store-name}.myshopify.com`
- `SHOPIFY_STOREFRONT_TOKEN` — Storefront APIアクセストークン

**残す:**
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `GELATO_API_KEY` — server.jsからは削除するが、将来のために.envには残してもOK

### 変更しないファイル

- `p3_styles.css` — UIスタイルに変更なし
- `p3_test.html` — エントリーポイントに変更なし
- `p1_code_for_claude.js` / `p2_code_for_claude.js` — 関係なし
- `legal.html` / `privacy.html` / `returns.html` / `size-guide.html` — そのまま
- `success.html` — Shopify側でリダイレクト先として設定

## Pre-requisites（司さんがやること）

1. **Shopify Starterプラン契約** ($5/月)
2. **商品12点をShopify管理画面で登録**
   - 各商品のサイズバリエーション（S/M/L/XL/2XL等）も登録
   - 登録後、各variantのGID（`gid://shopify/ProductVariant/xxxxx`）を取得
3. **Gelato公式アプリをShopifyにインストール**
   - 各商品をGelatoの印刷テンプレートと紐付け
   - プリントファイル（デザイン画像）をアップロード
4. **Storefront APIアクセストークン取得**
   - Shopify管理画面 → Settings → Apps and sales channels → Develop apps
   - Storefront API scopes: `unauthenticated_read_product_listings`, `unauthenticated_write_checkouts`, `unauthenticated_read_checkouts`
5. **variant IDリストを共有** — コードに埋め込むため

## Implementation Order

1. server.jsからStripe/Gelato関連コード削除
2. p3_code_for_claude.jsにStorefront APIクライアント追加
3. CARTオブジェクトのcheckoutフローをStorefront APIに差し替え
4. PRODUCTSにShopify variant IDマッピング追加（司さんからID共有後）
5. ブラウザでテスト（テストモード）
6. 動作確認後コミット

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Storefront APIのCORS | フロントから直接呼べる（公開トークン設計） |
| variant IDの管理が面倒 | 1回登録すれば変わらない。商品追加時だけ更新 |
| Shopify Starterの制限 | チェックアウト・注文管理は使える。テーマカスタマイズ不可だがヘッドレスなので不要 |
| チェックアウト画面に「Powered by Shopify」| 受容済み（司さん承認） |

## Success Criteria

- [ ] P3からカートに追加 → Shopifyチェックアウトにリダイレクトされる
- [ ] テスト決済が成功し、Shopify管理画面に注文が表示される
- [ ] Gelatoに注文が自動転送される
- [ ] server.jsにStripe/Gelato関連コードが残っていない
- [ ] 既存機能（メール登録・コンタクト・AIチャット）が引き続き動作する
