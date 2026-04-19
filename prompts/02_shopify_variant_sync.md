# Shopify Variant GID 同期プロンプト

## 使う場面
Gelato で商品作成 → Shopify に同期された後、各商品の variant GID を
p3_code_for_claude.js の shopifyVariants{} に自動埋込。

## コピペ用

```
Shopify の商品同期確認 → variant GID を取得 → コード埋込まで自動化。

## 手順
1. Shopify Admin API で商品リスト取得:
   export $(grep -v '^#' /Users/10ta210/Desktop/inryoku/.env | xargs)
   curl -H "X-Shopify-Access-Token: $SHOPIFY_ADMIN_TOKEN" \
     "https://$SHOPIFY_STORE_DOMAIN/admin/api/2024-10/products.json"

   ※ SHOPIFY_ADMIN_TOKEN が無い場合は Shopify Admin → App → inryoku-storefront
     から Admin API access token を発行する必要あり

2. 各商品の variants[].id を抽出 (GID形式に変換):
   gid://shopify/ProductVariant/{id}

3. p3_code_for_claude.js の PRODUCTS 配列内 shopifyVariants{} を更新:
   {
     'S': 'gid://shopify/ProductVariant/xxxxxxxx',
     'M': 'gid://shopify/ProductVariant/xxxxxxxy',
     ...
   }

4. 商品名マッチング:
   - Shopify product.title が "ENTER HOODIE" → p3 id "enter-hoodie"
   - etc.

5. node --check で syntax 確認

6. git add/commit/push → Railway 自動再デプロイ

7. デプロイ後、購入フロー全テスト:
   - P3 でカードクリック → サイズ選択 → カート → Stripe Checkout
   - 実通るか (テスト用 Bogus Gateway で)

## 司さんに報告する内容
- 同期済み商品数
- 各商品のvariant数
- 購入フローが機能するか否か
- 残タスクリスト
```
