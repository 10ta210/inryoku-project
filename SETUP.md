# inryokü — API連携セットアップガイド

現状まとめ + やることリスト。コピペして進める用。

---

## 🔴 今の状態

### 設定済み（.env）
- ✅ `GROQ_API_KEY` — AIチャット動く
- ✅ `SHOPIFY_STORE_DOMAIN` — Shopify接続OK
- ✅ `SHOPIFY_STOREFRONT_TOKEN` — checkoutOK

### 足りないもの
- ❌ `GELATO_API_KEY` — **注文来ても発送できない**
- ❌ `ADMIN_API_KEY` — 本番で管理API無防備
- ❌ 12商品の `shopifyVariants` GID — **全部空、買えない**
- ❌ Shopify ⇔ Gelato 自動連携

---

## 📋 やること（順番通り）

### STEP 1: Gelato API キー取得（5分）
1. https://dashboard.gelato.com/ ログイン
2. 右上 **Developer** → **API Keys**
3. **Create API Key** → 名前: `inryoku-prod`
4. キーをコピー（1回しか見れない）
5. `.env` に追記:
   ```
   GELATO_API_KEY=ここに貼る
   ```
6. サーバー再起動

### STEP 2: Gelato 商品UID確認（10分）
現状コード: 全12商品が `gelato_product: 'bella_canvas_3001'`
→ フーディーとタンクトップが同じUID = **間違い**

正しいUID取得方法:
1. Gelato dashboard → **Products** → **Catalog**
2. 各商品タイプ選択 → URL末尾が product_uid
3. 例: `apparel_hoodie_heavyweight_unisex_bc-3739`

更新必要な商品:
- ENTER HOODIE, LOGO HOODIE → hoodie UID
- ENTER TEE, LOGO TEE → tee UID
- LONG SLEEVE → longsleeve UID
- CREWNECK → crewneck UID
- TANK TOP → tank UID

### STEP 3: Shopify 商品登録（30分）
1. Shopify管理画面 → **Products** → **Add product**
2. 12商品をそれぞれ登録（名前・価格・画像・サイズバリエーション）
3. 各バリエーションの GID 取得:
   ```
   Products画面 → 該当商品 → Variants
   → 各サイズのURL末尾数字が variant ID
   → GID形式: gid://shopify/ProductVariant/{数字}
   ```

### STEP 4: p3_code_for_claude.js 更新（15分）
各商品の `shopifyVariants: {}` を埋める:
```js
shopifyVariants: {
  'S': 'gid://shopify/ProductVariant/44123456789',
  'M': 'gid://shopify/ProductVariant/44123456790',
  'L': 'gid://shopify/ProductVariant/44123456791',
  'XL': 'gid://shopify/ProductVariant/44123456792',
  '2XL': 'gid://shopify/ProductVariant/44123456793'
}
```

### STEP 5: Shopify ⇔ Gelato 自動連携（15分）
**この連携がないと、注文来ても手動でGelatoに流す必要ある。**

方法A（推奨）: Shopify App Store で **Gelato: Print on Demand** インストール
- Shopify商品 ↔ Gelato商品マッピング
- 注文自動転送
- 在庫不要

方法B: server.js の `/api/gelato/order` を webhook で自動呼び出し
- Shopify Webhook: Order created → server.js → Gelato
- 複雑、方法A推奨

### STEP 6: ADMIN_API_KEY 生成（2分）
ターミナルで:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
出力をコピーして `.env` に:
```
ADMIN_API_KEY=ここに貼る
NODE_ENV=production
```

### STEP 7: 本番デプロイ前チェック
- [ ] Gelatoでサンプル注文→品質確認
- [ ] Shopifyでテスト購入（Bogus Gateway）
- [ ] checkoutUrl でShopify決済画面開くか
- [ ] 注文後 Gelato に注文が来るか
- [ ] メール送信動作確認

---

## 🔄 お金の流れ

```
顧客
  ↓ カード決済
Shopify Checkout（手数料 2.9% + ¥30）
  ↓ webhook / Gelato App
Gelato（製造原価 + 送料 = 約¥3,000〜5,000）
  ↓ 発送
顧客に到着

利益 = 販売価格 − Shopify手数料 − Gelato原価
例) ¥8,800 Tee:
  ¥8,800 − ¥285（Shopify）− ¥3,200（Gelato）= ¥5,315 利益
```

---

## 🧠 設計上の穴

1. **現状 `/api/gelato/order` は未使用**
   - Shopify App使えば不要
   - webhook経由にするなら改修必要

2. **全商品 gelato_product 同じ**
   - 12商品とも `bella_canvas_3001`
   - 正しいUIDに差し替え必要（STEP 2）

3. **shopifyVariants 全部空**
   - 今Checkoutボタン押しても "No Shopify variants mapped" エラー
   - STEP 3-4 完了するまで**誰も買えない**

4. **画像が2種類しかない**
   - `enter_hoodie.png` / `info_logo_hoodie.png`
   - 12商品中 6パターンが同じ画像使い回し
   - 実商品撮影 or モックアップ必要

---

## ⚡ 最速ルート（MVP販売開始）

最小限の1商品（ENTER HOODIE）だけ先に売る:
1. Gelatoキー取得（STEP 1）
2. Shopify App Store で Gelato アプリ入れる（STEP 5 方法A）
3. Shopifyに ENTER HOODIE 1商品だけ登録
4. その variantId を p3 に埋める
5. 残り11商品は「Coming Soon」表示

→ **半日で1商品販売開始可能**
