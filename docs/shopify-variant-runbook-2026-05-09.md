# Shopify variant ID 投入 + 1商品テスト購入 Runbook (2026-05-09 / updated 2026-05-11)

> 司さんが Shopify と inryokü EC を結線する手順。1商品から始めて、徐々に12商品に展開する設計。
> 全商品の variant ID が空でも UI は破綻しないので、慌てなくて OK。

---

## 0. 前提と現状 (2026-05-11 更新)

- ストア: **`072xjz-qn.myshopify.com`** (作成済 / password 保護 OFF / 有料化済)
- Custom App: **`inryoku-frontend-2`** リリース + インストール済
- Headless チャネル: **「My Store Headless」** storefront 作成済
- Storefront API token: `.env` に投入済 (`SHOPIFY_STOREFRONT_TOKEN`) + `p3_code_for_claude.js:64` `SHOPIFY_CONFIG` にも反映
- 商品 12 個中 **1 個 (ENTER HOODIE) が投入済**:
  - 在庫 100 ×5 サイズ (S/M/L/XL/2XL)
  - variant ID は `SHOPIFY_VARIANT_MAP` (line 71) に注入済
  - UI 上で「AVAILABLE」表示
- 残り 11 商品は `SHOPIFY_VARIANT_MAP[id] = {}` のまま → UI で「チェックアウト準備中」表示
- サーバー `/api/checkout` は接続テスト済 (HTTP 200 + checkoutUrl 返却確認済)
- client → 直接 Storefront API 呼び (server proxy 経由しないルート) も動作確認済

### 検証済 (このセッション内)
- ✅ `cartCreate` mutation → checkout URL 取得成功
- ✅ ローカルブラウザで modal → ADD TO CART → カートバッジ反映
- ✅ サーバー `/api/checkout` で同じ checkout URL 取得成功

### Codex レビュー結論 (2026-05-11)
- SHOPIFY_CONFIG の client hardcode = Storefront token なので仕様上 OK
- 将来的には `/api/shopify/graphql` proxy 一本化が運用的に綺麗
- `/api/gelato/order` alias は公開後 1〜2 週間ログ観察 → 古いアクセス無ければ削除可
- 11 商品の自動登録は不要、まず ENTER TEE だけ手動追加が現実的

---

## 1. Shopify 側のセットアップ (✅ 済 / 履歴)

### 1-A. ストア作成 ✅
- 完了済 (`072xjz-qn.myshopify.com`)
- password 保護 OFF 済

### 1-B. 商品 ENTER HOODIE 登録 ✅
- 価格 ¥12,800 / サイズ S/M/L/XL/2XL / 在庫 100 ×5

### 1-C. Storefront API token 取得 ✅
- `inryoku-frontend-2` Custom App + Headless チャネル経由で取得
- `.env` の `SHOPIFY_STOREFRONT_TOKEN` に投入済
- 4 scope ON:
  - `unauthenticated_read_product_listings`
  - `unauthenticated_read_product_inventory`
  - `unauthenticated_write_checkouts`
  - `unauthenticated_read_checkouts`

### 1-D. variant ID 取得 ✅
ENTER HOODIE 5 サイズ分取得済:
```
S   gid://shopify/ProductVariant/48005115412634
M   gid://shopify/ProductVariant/48005115445402
L   gid://shopify/ProductVariant/48005115478170
XL  gid://shopify/ProductVariant/48005115510938
2XL gid://shopify/ProductVariant/48005115543706
```

---

## 1-NEXT. 次の商品 (ENTER TEE) 追加手順 (Codex 推奨フロー)

### Step 1. ENTER HOODIE で 1回テスト購入する
- ローカル: http://localhost:3000/p3_test.html?nocache=hide2
- ENTER HOODIE → サイズM → ADD TO CART → カート → CHECKOUT
- Stripe テストカード `4242 4242 4242 4242` で完了画面まで通せれば OK
- ⚠ Shopify Payments KYC 完了後しか実 Stripe 通らない可能性あり (テストモードで先に検証)

### Step 2. ENTER TEE を Shopify に追加
1. 管理画面 → 商品 → 商品を追加
2. タイトル: `ENTER TEE`
3. 価格: ¥8,800
4. バリアント: S / M / L / XL / 2XL
5. 画像: 司の手元の TEE 商品画像
6. 公開: アクティブ → 保存

### Step 3. Variant ID 取得
GraphQL で variant ID を一括取得:
```bash
set -a && source .env && set +a
curl -s -X POST "https://${SHOPIFY_STORE_DOMAIN}/api/2024-10/graphql.json" \
  -H "X-Shopify-Storefront-Access-Token: ${SHOPIFY_STOREFRONT_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ products(first:20){edges{node{title handle variants(first:10){edges{node{id title}}}}}}}"}'  \
  | python3 -m json.tool
```

### Step 4. `SHOPIFY_VARIANT_MAP` に追記
`p3_code_for_claude.js:71` を編集:
```js
'enter-tee': {
    'S':   'gid://shopify/ProductVariant/<step 3 で取得>',
    'M':   'gid://shopify/ProductVariant/<...>',
    'L':   'gid://shopify/ProductVariant/<...>',
    'XL':  'gid://shopify/ProductVariant/<...>',
    '2XL': 'gid://shopify/ProductVariant/<...>'
},
```

### Step 5. 在庫を 100 に設定
管理画面 → 在庫 → ENTER TEE 全 5 サイズ select → 一括編集 → 100

### Step 6. cache buster bump
```bash
sed -i '' 's/20260509-hide2/20260511-tee/g; s/inryoku-v32-/inryoku-v33-/g' index.html p3_test.html sw.js
```

### Step 7. 確認
ブラウザでハードリロード → ENTER TEE が「AVAILABLE」表示になる + ADD TO CART 可能になる。

---

## 2. inryokü 側に投入

### 2-A. ENV 変数をサーバーに設定
`server.js` が読む環境変数:
```bash
export SHOPIFY_STORE_DOMAIN="inryoku-store.myshopify.com"
export SHOPIFY_STOREFRONT_TOKEN="<step 1-C で取得した token>"
# 起動
npm start
```

確認: `curl http://localhost:3000/api/health` のレスポンスで `"shopify": true` が出ていれば OK
(現状: `features.shopify: true` 確認済 = 接続できているはず)

### 2-B. variant ID を PRODUCTS に埋める
`p3_code_for_claude.js:195` の `PRODUCTS` 配列の `enter-hoodie` (line 197付近):

**変更前**:
```js
{
    id: 'enter-hoodie',
    name: 'ENTER HOODIE',
    ...
    shopifyVariants: {} // ← ここを埋める
}
```

**変更後**:
```js
{
    id: 'enter-hoodie',
    name: 'ENTER HOODIE',
    ...
    shopifyVariants: {
        'S':   'gid://shopify/ProductVariant/1234567890001',
        'M':   'gid://shopify/ProductVariant/1234567890002',
        'L':   'gid://shopify/ProductVariant/1234567890003',
        'XL':  'gid://shopify/ProductVariant/1234567890004',
        '2XL': 'gid://shopify/ProductVariant/1234567890005'
    }
}
```

**または** `SHOPIFY_VARIANT_MAP` (`p3_code_for_claude.js` を全文 grep して場所特定) に外部マップとして記述する方法もあり (line 367 の `product.shopifyVariants = SHOPIFY_VARIANT_MAP[product.id] || product.shopifyVariants || {};` で merge される)。

### 2-C. cache buster を bump
`p3_code_for_claude.js` を編集したら以下を更新:
```bash
# 例: 20260509-eclaunch1 → 20260510-shopify1
sed -i '' 's/20260509-eclaunch1/20260510-shopify1/g' index.html p3_test.html sw.js
sed -i '' 's/inryoku-v28-/inryoku-v29-/g' sw.js
```

ハードリロード (Cmd+Shift+R) で確認。

---

## 3. テスト購入手順

### 3-A. ブラウザで購入フロー確認
1. http://localhost:3000/ (または p3_test.html) を開く
2. ENTER HOODIE を選択 → サイズ M クリック
3. ADD TO CART (有効になっているはず)
4. カートアイコン → CHECKOUT (有効)
5. Shopify checkout URL にリダイレクト

### 3-B. テスト決済
Stripe テストモード:
- カード番号: `4242 4242 4242 4242`
- 有効期限: 任意の未来日 (12/30 等)
- CVC: 任意 (123 等)
- 郵便番号: 任意 (1000001 等)

### 3-C. 確認項目
- [ ] チェックアウト URL が `{store}.myshopify.com/cart/{variantId}:1?...` 形式
- [ ] Shopify 側で注文が `テストモード` で作成される
- [ ] success.html or Shopify thank-you ページが表示される
- [ ] 注文完了メールが届く (Shopify の通知設定次第)

---

## 4. 12商品への段階展開

1商品テストが成功したら:
1. 残り11商品も Shopify に登録 (まとめて or 1個ずつ)
2. variant ID を `PRODUCTS` に追記
3. 全商品で UI が「チェックアウト準備中」→「ADD TO CART」に切り替わることを確認
4. もう一度 testmode で1個ずつ purchase 確認 (異なる商品で重複バグがないか)

---

## 5. 本番モード切替前の最終確認

- [ ] Shopify ストアが本番モード (有料プラン契約済)
- [ ] Stripe アカウントが本番認証済
- [ ] 特定商取引法表記 (`legal.html`) の TODO 全て埋まっている
- [ ] テスト購入で実カードを使った疎通確認 (返金前提で1人分)
- [ ] 在庫管理ロジック (Gelato は受注生産なので無在庫扱い) を Shopify 側で確認

---

## 6. トラブルシュート

### Q: checkout 押しても「Shopify not configured」が出る
→ サーバーの ENV 変数が未設定。`echo $SHOPIFY_STORE_DOMAIN` で確認。

### Q: variant ID 入れたのに「チェックアウト準備中」のまま表示される
→ ブラウザキャッシュ。Cmd+Shift+R でハードリロード。
→ それでもダメなら DevTools → Application → Service Worker → Unregister → リロード

### Q: GraphQL エラー `Variable $merchandiseId is required`
→ variant ID の形式間違い。`gid://shopify/ProductVariant/...` 完全形が必須。

### Q: チェックアウトページが 404
→ Storefront API の `unauthenticated_write_checkouts` スコープが付いていない。

---

## 7. 関連ファイル

- `p3_code_for_claude.js:94-115` ← variant gating helpers (`hasMappedVariant` / `isProductPurchasable` / `getCheckoutStatus`)
- `p3_code_for_claude.js:195-364` ← PRODUCTS 配列
- `server.js:1304-1360` ← `/api/checkout` 実装
- `server.js:1024` ← `shopifyUpstream()` GraphQL プロキシ

---

最終更新: 2026-05-09
