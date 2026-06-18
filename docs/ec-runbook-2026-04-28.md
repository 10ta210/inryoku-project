# inryokü EC 本番稼働 完全 Runbook（2026-04-28）

対象: 司さん 1 人で **Shopify + Gelato POD** を本番稼働させるための単独完遂手順書。
前提コード: `server.js` / `p3_code_for_claude.js`（2026-04-28 時点）。
参照: `docs/ec-status-2026-04-27.md` / `docs/security-fixes-2026-04-28.md`。

このドキュメントは「上から順番にやる」ための運用書。読み物ではない。チェックボックスを 1 個ずつ潰していけば本番に立ち上がる構造にしてある。

---

## 目次

- Part 1: 前提確認チェックリスト
- Part 2: Gelato で 1 商品試作（enter-tee M）
- Part 3: Shopify 側 variant ID 取得
- Part 4: コードに埋め込む
- Part 5: ローカル動作確認
- Part 6: テスト購入（Bogus Gateway）
- Part 7: トラブルシューティング
- Part 8: 全 12 商品展開
- Part 9: 本番稼働前チェックリスト（30 項目）
- Part 10: 運用フェーズ

---

## Part 1: 前提確認チェックリスト

### 1.1 アカウント・契約状況

| 項目 | 確認 | 備考 |
|---|---|---|
| Shopify アカウント | 司さんが管理者 | `0xi10h-x1.myshopify.com` |
| Shopify プラン | Basic（¥4,850/月） | カスタム ドメイン・本番決済に必須。Starter（¥3,650）は Storefront API 使えるが Online Store のないモード。本 runbook は Basic 前提 |
| Gelato アカウント | Email でサインアップ済み | https://dashboard.gelato.com/ |
| Gelato Shopify 連携 | インストール済み | Shopify 管理画面 > アプリ > Gelato |
| ドメイン | （未取得 or 取得済み） | 本番は `inryoku.com` 想定。Shopify 側で設定 |
| 銀行口座 / 支払い情報 | Shopify Payments / Gelato 両方に登録 | Gelato は印刷代を Gelato 側に徴収される。Shopify は売上を司さんに送金 |

### 1.2 必要な API / トークン（4 種類）

全部 `.env` に書く。**コード内 (`p3_code_for_claude.js` の `SHOPIFY_CONFIG.storefrontToken`) には公開可能トークン (Storefront API public access token) のみ書く**。

`.env`（`/Users/10ta210/Desktop/inryoku_hp/.env`）の最終形:

```
SHOPIFY_STORE_DOMAIN=0xi10h-x1.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=（Storefront API access token、公開可能なやつ）
GELATO_API_KEY=（Gelato dashboard で発行する Order API key）
GROQ_API_KEY=（既存の AI チャット用、チェックアウトに無関係）
ADMIN_API_KEY=（既存の admin endpoint 用）
```

### 1.3 Storefront API トークンの取得手順

Shopify は Admin API（バックエンド用、漏らすと致命的） と Storefront API（公開フロント用） が別物。

1. https://0xi10h-x1.myshopify.com/admin にログイン
2. 左下の「**設定**」→「**アプリと販売チャネル**」
3. 右上「**アプリを開発**」→ 既に Headless / inryoku-headless 等があれば選ぶ。なければ「**アプリを作成**」
4. アプリ名: `inryoku-headless` 等
5. 「**設定**」タブ → **Storefront API access scopes**
6. 必要スコープを ON:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_inventory`
   - `unauthenticated_read_product_pickup_locations`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_checkouts`
   - `unauthenticated_write_customers`（任意）
   - `unauthenticated_read_customer_tags`（任意）
7. 「**保存**」
8. 「**API 認証情報**」タブ
9. 「**Storefront API アクセス トークンをインストール**」をクリック
10. 表示されるトークン（32 文字 hex）をコピー
11. `.env` の `SHOPIFY_STOREFRONT_TOKEN=` と、`p3_code_for_claude.js:66` の `storefrontToken:` 両方に貼る

注意:
- このトークンは **公開可能** なので JS にハードコードして OK（Shopify 公式仕様）
- ただし scope が広いと悪用される。**`unauthenticated_write_*` を必要最低限に絞る**
- ローテーションは「アクセス トークンを再生成」で随時可能

### 1.4 Gelato API キーの取得手順

1. https://dashboard.gelato.com/ にログイン
2. 右上アイコン → **Account settings** → **API**（左サイドバー）
3. **Create API key** をクリック
4. 名前: `inryoku-server`
5. Scopes: `Orders` (read/write), `Products` (read) を ON
6. 表示される API key（`f1g2h3...` 形式）をコピー
7. `.env` の `GELATO_API_KEY=` に貼る
8. **このキーはサーバーのみ。クライアント JS には絶対に書かない**（書いたら他人が司さんの代わりに無料注文できる）

### 1.5 必要権限スコープまとめ

| トークン | どこで使う | スコープ |
|---|---|---|
| Storefront API token | クライアント JS + サーバー `/api/checkout` | `unauthenticated_read_product_*`, `unauthenticated_write_checkouts` |
| Admin API token（任意） | Part 8 の variant 一括取得スクリプト | `read_products`, `read_product_listings` |
| Gelato API key | サーバー `/api/gelato/order` のみ | Orders read/write |

---

## Part 2: Gelato で 1 商品試作（enter-tee M）

**戦略**: いきなり 12 商品作らない。1 商品 1 サイズだけ作って、Shopify 同期 → variant 取得 → checkout → テスト決済まで通してから残り 11 個に展開する。最小ループを 1 周する。

### 2.1 Gelato ダッシュボードで商品作成

1. https://dashboard.gelato.com/ ログイン
2. 左サイドバー「**Stores**」→ Shopify ストア (`0xi10h-x1`) が連携されていることを確認
3. 左サイドバー「**Products**」→ 右上「**Create product**」
4. **Choose a category** → **Apparel** → **T-shirts** → **Crew neck T-shirts**
5. **Bella + Canvas 3001 Unisex Jersey Short Sleeve Tee** を選択
   - `p3_code_for_claude.js` の `enter-tee` の `gelato_product` が `..._bella-and-canvas_3003` になっているが、現行 Gelato カタログでは `bella_canvas_3001` が標準。3003 が見つからなければ 3001 で進める。productUid は商品作成完了後に再取得して JS 側を直す
6. **Color**: Black
7. **Size**: M のみまずチェック（残りは後で追加）
8. **Print area**: Front
9. **Upload design**: `/Users/10ta210/Desktop/inryoku_hp/public/enter_hoodie.png`（仮）
   - 本来は `enter_tee_design.png` を別途用意すべきだが、最小ループなのでこれで進める
   - 推奨解像度: **4500×5400 px（300 DPI）**。`enter_hoodie.png` は確認: `file public/enter_hoodie.png` → 解像度確認。低ければ低解像度警告が出るが進める
10. **Position**: Center chest（プレビューでドラッグして調整）
11. **Print file**: PNG with transparent background
12. 右上「**Continue**」
13. **Mockup gallery**: Gelato 自動生成のモックアップを 1〜2 枚選ぶ
14. **Continue**

### 2.2 Shopify 連携設定

15. **Publish to store** ステップ
16. **Store**: `0xi10h-x1.myshopify.com` を選択
17. **Title**: `ENTER TEE (M / Black)` ← Shopify 商品タイトル
18. **Description**: 任意（後で Shopify 側で編集可）
19. **Product type**: `Apparel`
20. **Vendor**: `inryokü`
21. **Tags**: `enter-tee, tee, black`
22. **Pricing**:
    - Cost (Gelato 印刷+配送代): 自動表示（例 ¥2,400）
    - Selling price: ¥8,800（`p3_code_for_claude.js` の `priceNum`）
    - Profit: 自動計算
23. **Inventory**: Continue selling when out of stock = ON（POD なので在庫概念なし）
24. **Status**: **Active**（公開）or **Draft**（一旦下書き）
    - 最初の試作は **Draft** 推奨。テスト後に Active に
25. 右上「**Publish**」
26. 「Publishing...」→ 30 秒〜2 分待つ
27. 完了画面で「**View on Shopify**」リンクをクリック → Shopify 管理画面の商品ページが開く

### 2.3 Shopify 側で連携確認

28. Shopify 管理画面 → **商品** → `ENTER TEE (M / Black)` が表示される
29. クリックして詳細ページへ
30. ページ最下部の「**バリエーション**」セクションに **M / Black** が 1 行ある
31. 「**メディア**」セクションに Gelato が生成したモックアップ画像
32. 上部メニュー「**商品ステータス**」が **Draft** なら **Active** に変更（テストは draft でも可だが Storefront API は active のみ取得）
33. **販売チャネル**: 「**Online Store**」を ON

### 2.4 Gelato 側で「実印刷しない」設定（重要）

テスト購入で実際に Gelato が印刷を始めると課金される。**テストモード**にする:

34. Gelato dashboard → **Stores** → `0xi10h-x1.myshopify.com` の歯車アイコン
35. **Order processing**: **Manual approval** に切り替え（自動印刷を停止）
   - 自動: Shopify で注文 → 即 Gelato が印刷
   - Manual: Shopify で注文 → Gelato dashboard で「Approve」して初めて印刷
36. テストフェーズ中はずっと Manual に。本番リリース時に Automatic に戻す
37. もしくは Shopify 側で Bogus Gateway（Part 6）を使えば、決済が通らないので Gelato にも実注文が飛ばない

---

## Part 3: Shopify 側 variant ID 取得

variant ID = 「商品の特定サイズ・色の組み合わせ」を指す Shopify 内部 ID。Storefront API には `gid://shopify/ProductVariant/数字` 形式で渡す必要がある。

### 3.1 方法 A: 商品詳細 URL から抽出（簡単・1 商品ずつ）

1. Shopify 管理画面 → 商品 → `ENTER TEE (M / Black)` をクリック
2. 「**バリエーション**」セクションの **M / Black** 行をクリック → variant 編集画面
3. ブラウザの URL バーを見る:
   ```
   https://0xi10h-x1.myshopify.com/admin/products/8123456789012/variants/49876543210123
                                                                              ↑ これが variant ID
   ```
4. 末尾の数字 `49876543210123` をコピー
5. GID 形式に変換: `gid://shopify/ProductVariant/49876543210123`

### 3.2 方法 B: GraphQL Admin API（推奨・全商品一気に）

Admin API トークンが要る。Storefront API とは別物。

1. Shopify 管理画面 → 設定 → アプリと販売チャネル → アプリを開発 → 該当アプリ
2. **Configuration** → **Admin API access scopes** → `read_products` を ON → 保存
3. **API credentials** → **Install app** → Admin API access token を表示（`shpat_...` 形式）
4. **このトークンは絶対に公開しない**。`.env` 用 + 一時的なスクリプト用のみ
5. ターミナルで叩く:

```bash
ADMIN_TOKEN="shpat_xxx"
curl -s -X POST \
  -H "X-Shopify-Access-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://0xi10h-x1.myshopify.com/admin/api/2024-10/graphql.json \
  -d '{"query":"{ products(first: 50) { edges { node { id title handle variants(first: 20) { edges { node { id title sku } } } } } } }"}' \
  | jq '.data.products.edges[] | { title: .node.title, handle: .node.handle, variants: [.node.variants.edges[].node | { id, title }] }'
```

レスポンス例:
```json
{
  "title": "ENTER TEE (M / Black)",
  "handle": "enter-tee-m-black",
  "variants": [
    { "id": "gid://shopify/ProductVariant/49876543210123", "title": "M / Black" }
  ]
}
```

この `id` フィールドがそのまま `SHOPIFY_VARIANT_MAP` に貼れる形式。

### 3.3 variant ID 形式

| 形式 | 例 | どこで使う |
|---|---|---|
| 数字のみ | `49876543210123` | Shopify 管理画面 URL |
| GID | `gid://shopify/ProductVariant/49876543210123` | Storefront API / `SHOPIFY_VARIANT_MAP` |
| Base64 | `Z2lkOi8vc2hvcGlmeS9Qcm9kdWN0VmFyaWFudC80OTg3NjU0MzIxMDEyMw==` | 旧 API。**使わない** |

`p3_code_for_claude.js` の `SHOPIFY_VARIANT_MAP` には **GID 形式** で入れる。

---

## Part 4: コードに埋め込む

### 4.1 `SHOPIFY_VARIANT_MAP` を埋める

ファイル: `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js` (line 71-84)

最初は `enter-tee` の M だけ:

```js
const SHOPIFY_VARIANT_MAP = {
  'enter-hoodie': {},
  'logo-hoodie': {},
  'enter-hoodie-white': {},
  'logo-hoodie-oversized': {},
  'enter-tee': {
    'M': 'gid://shopify/ProductVariant/49876543210123'  // ← Part 3 で取得した GID
  },
  'logo-tee': {},
  'enter-longsleeve': {},
  'logo-longsleeve': {},
  'enter-crewneck': {},
  'logo-crewneck': {},
  'enter-tank': {},
  'logo-tank': {}
};
```

### 4.2 Gelato 連携を「ひとまず無効のまま」にしておく

ファイル: `p3_code_for_claude.js:89-92`

```js
const GELATO_CONFIG = {
    apiEndpoint: '/api/gelato/order',
    enabled: false  // ← Part 6 のテスト購入が通るまでは false のまま
};
```

理由: Shopify + Gelato アプリ が webhook で勝手に注文を Gelato に渡すので、`/api/gelato/order` は冗長な可能性が高い（`docs/ec-status-2026-04-27.md` 既知の懸念参照）。Part 6 で Shopify アプリ経由の注文同期が動くか確認してから、必要なら有効化する。

### 4.3 キャッシュバスター v 更新

`index.html` / `p3_test.html` で `<script src="p3_code_for_claude.js?v=...">` のような読み込みがあれば `v=` を更新する。ブラウザキャッシュで variant 0 件のままで動かない事故を防ぐ。

```bash
grep -n 'p3_code_for_claude.js' /Users/10ta210/Desktop/inryoku_hp/*.html
```

該当行の `?v=2026-04-27` のような部分を `?v=2026-04-28-01` に書き換える。

### 4.4 `.env` 確認

```bash
cat /Users/10ta210/Desktop/inryoku_hp/.env
```

最低この 3 行があれば checkout は動く:

```
SHOPIFY_STORE_DOMAIN=0xi10h-x1.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=ce0dc399245e874fd85d218df2d9bb04
GELATO_API_KEY=（任意。enabled=false なら未設定でも OK）
```

---

## Part 5: ローカル動作確認

### 5.1 サーバー起動

```bash
cd /Users/10ta210/Desktop/inryoku_hp
node server.js
```

期待ログ:
```
  ║  inryokü server — localhost:3000    ║
  ║  Checkout: ✅ Shopify 接続済み      ║
```

`⚠️ Shopify未設定` が出たら `.env` の 2 変数 (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN`) が読まれていない。`.env` のスペース・改行を確認。

### 5.2 ブラウザで確認

1. http://localhost:3000/p3_test.html を開く
2. 商品一覧が表示される。`ENTER TEE` カードに「**available**」バッジ（variant が 1 個でも埋まってるから）。他の 11 商品は「**checkout soon**」
3. `ENTER TEE` カードをクリック → 詳細モーダル / 拡大表示
4. **サイズ選択**: M を選ぶ（M 以外は灰色＝選べない）
5. 「**カートに入れる**」or 「**checkout**」ボタン

### 5.3 ネットワーク確認（DevTools）

1. Cmd+Opt+I で DevTools を開く → **Network** タブ
2. checkout ボタンを押す
3. `/api/checkout` リクエストが POST で飛ぶ
4. Request payload:
   ```json
   { "items": [{ "id": "enter-tee", "size": "M", "qty": 1, "shopifyVariantId": "gid://shopify/ProductVariant/49876543210123", "price": 8800 }] }
   ```
5. Response (200):
   ```json
   { "url": "https://0xi10h-x1.myshopify.com/cart/c/Z2NwLWFzaWE..." }
   ```
6. ブラウザが自動で `window.location = url` で Shopify 公式 checkout 画面へ遷移
7. 遷移先で:
   - 商品名: `ENTER TEE (M / Black)`
   - 価格: ¥8,800
   - 配送先入力フォーム / メール入力フォーム
8. ここまで来たら **checkout 接続は成功**

### 5.4 失敗時のレスポンス例

| Response | 原因 | 対処 |
|---|---|---|
| `{ "error": "Shopify not configured (env missing)" }` | `.env` 未読込 | サーバー再起動 |
| `{ "error": "No Shopify variants mapped" }` | item.shopifyVariantId が空 | `SHOPIFY_VARIANT_MAP` の M が空 |
| `{ "error": "Cart creation failed" }` | Shopify 側で variant 不在 / token 無効 / scope 不足 | サーバーログ `[checkout] cartCreate failed:` の内容を見る |
| `{ "error": "upstream unavailable" }` | DNS / ネットワーク失敗 | wifi / `SHOPIFY_STORE_DOMAIN` のスペル |

---

## Part 6: テスト購入

実印刷・実決済を起こさずに、Shopify checkout → 注文確定 → Gelato 同期まで通す。

### 6.1 Bogus Gateway を有効化（推奨・最も安全）

Bogus Gateway = Shopify 公式のテスト用ダミー決済。クレカ番号 `1` で成功、`2` で失敗を返す。

1. Shopify 管理画面 → **設定** → **決済**
2. 既存の Shopify Payments がある場合は **一旦無効化**（テスト中のみ）
3. ページ下部「**サポートされている決済方法**」→ 「**(for testing) Bogus Gateway**」を有効化
   - 出ない場合: ブラウザで直接 `https://0xi10h-x1.myshopify.com/admin/payments?provider=bogus` を踏むと出る
4. 「**有効化**」

### 6.2 もしくは Shopify Payments テストモード

Bogus が使えない場合（プランによっては隠されている）:

1. **設定** → **決済** → **Shopify Payments** → 「**テストモード**」ON
2. テスト用カード番号:
   - `4242 4242 4242 4242` → 成功
   - `4000 0000 0000 0002` → 失敗 (decline)
   - 有効期限: 任意未来 / CVC: 任意 3 桁

### 6.3 テスト注文を実行

1. http://localhost:3000/p3_test.html → ENTER TEE M → checkout
2. Shopify checkout 画面:
   - **Email**: `tsukasa.test+001@gmail.com`（普段のメールに `+001` で alias）
   - **配送先**: 司さんの自宅 or テスト用住所
   - **配送方法**: 表示された配送オプションを選ぶ（Gelato が自動計算）
   - **支払い**: Bogus Gateway → カード番号 `1` / 任意の名前 / 有効期限 `12/30` / CVC `111`
3. 「**今すぐ支払う**」
4. 注文確定画面 → 注文番号 `#1001` 表示

### 6.4 Shopify 側の注文確認

5. Shopify 管理画面 → **注文管理** → `#1001` クリック
6. 商品: `ENTER TEE (M / Black)` x 1, ¥8,800
7. 支払い状況: `支払済 (テスト)`
8. **Fulfillment**: `Unfulfilled` → Gelato へ送信中、または送信済み

### 6.5 Gelato 側の注文確認

9. https://dashboard.gelato.com/ → **Orders**
10. 数秒〜数分後に Shopify 注文 #1001 が `Pending approval`（Manual mode の場合）or `Processing`（Auto mode）で出現
11. **Manual mode** にしてあれば「**Approve**」ボタンを押さない限り印刷は始まらない → **押さない**
12. 注文詳細を開いて以下を確認:
    - 商品: Bella+Canvas 3001 / Black / M
    - 印刷ファイル URL（プレビュー画像）
    - 配送先住所
    - 印刷代 + 配送代の見積

### 6.6 テスト注文のキャンセル

13. Gelato dashboard → 該当注文 → **Cancel order**（Manual mode で承認前ならいつでも可）
14. Shopify 管理画面 → 注文 → **その他のアクション** → **注文をキャンセル** → **返金**
15. Bogus / テストモードでは実際の課金は発生しないので返金は形式的

---

## Part 7: トラブルシューティング

### 7.1 「Shopify not configured」

サーバーログに `⚠️ Shopify未設定` が出る場合:

```bash
cd /Users/10ta210/Desktop/inryoku_hp
node -e "require('fs').readFileSync('.env','utf8').split('\n').forEach(l=>console.log(l))"
```

確認:
- `=` の前後にスペースが入っていない (`SHOPIFY_STORE_DOMAIN=0xi10h-x1.myshopify.com` ← OK / `SHOPIFY_STORE_DOMAIN = 0xi...` ← NG)
- 末尾に余分な `;` や引用符がない
- 改行コードが LF（`cat -A .env | head` で `$` だけなら OK / `^M$` なら CRLF）

### 7.2 variant 不在 (`Cart creation failed`)

サーバーログ `[checkout] cartCreate failed: ... Variant does not exist ...`:

- variant ID をコピペミス（先頭 `gid://shopify/ProductVariant/` 抜け、末尾改行）
- Shopify 側で商品が **Draft** のまま → Active に変更
- 商品が Online Store チャネルに公開されていない
- Storefront API トークンの scope に `unauthenticated_read_product_listings` がない

確認コマンド:
```bash
curl -s -X POST \
  -H "X-Shopify-Storefront-Access-Token: $SHOPIFY_STOREFRONT_TOKEN" \
  -H "Content-Type: application/json" \
  https://0xi10h-x1.myshopify.com/api/2024-10/graphql.json \
  -d '{"query":"{ node(id: \"gid://shopify/ProductVariant/49876543210123\") { ... on ProductVariant { id availableForSale price { amount } } } }"}'
```

`null` が返ったら variant が公開されていない or トークン不足。

### 7.3 CORS エラー

DevTools コンソールに `Access-Control-Allow-Origin` 系エラー:

- **検証対象が違う**。`/api/checkout` はサーバー (Node) に飛ばすので CORS 問題は出ない
- 出る場合は `p3_code_for_claude.js` 内で **直接** Shopify ドメインに fetch している箇所が原因（line 158 周辺）。サーバー中継 (`/api/checkout`) を経由するパス (line 5176 付近) を通すべき
- 直接 Shopify を叩く場合、Shopify は Storefront API に CORS `*` を返す仕様なので普通は通る。通らないなら `apiVersion` の値が無効（例: `2026-04` などの未来バージョン）

### 7.4 「決済画面に飛ばない」

- DevTools Network タブで `/api/checkout` のレスポンスに `url` フィールドがあるか
- ある: `window.location = data.url` の代入が呼ばれていない（line 5176 周辺の checkout ハンドラ）
- ない: Part 7.2 へ

### 7.5 「Gelato に注文が来ない」

- Shopify 管理画面 → アプリ → Gelato → ステータス: 接続中
- Gelato dashboard → Stores → 該当ストア → **Sync orders**（手動再同期）
- Shopify 注文画面で `Tags` に `gelato` が自動付与されているか
- Gelato dashboard → **Webhooks** → エラー履歴

### 7.6 「Webhook が届いているか確認」

Shopify 管理画面 → 設定 → **通知** → **Webhooks**
- `Order create` Webhook が Gelato アプリ向けに登録されているはず（Gelato アプリインストール時に自動登録）
- 「テストを送信」で疎通確認
- 過去の delivery 履歴で 200 OK になっているか

### 7.7 Storefront API レスポンス例（成功）

```json
{
  "data": {
    "cartCreate": {
      "cart": {
        "id": "gid://shopify/Cart/Z2NwLWFzaWE...",
        "checkoutUrl": "https://0xi10h-x1.myshopify.com/cart/c/Z2NwLWFzaWE...?key=abc"
      },
      "userErrors": []
    }
  }
}
```

### 7.8 Gelato API レスポンス例（成功）

```json
{
  "id": "ord_8a1b2c3d",
  "orderReferenceId": "inryoku-1714305000000",
  "fulfillmentStatus": "created",
  "financialStatus": "draft",
  "items": [
    {
      "itemReferenceId": "item-1",
      "productUid": "apparel_product_gca_t-shirt_..._gsi_m_gco_black_..._bella-and-canvas_3001",
      "fulfillmentStatus": "created"
    }
  ]
}
```

`server.js:670` で内部的に最低限のフィールド (`{ ok, orderId, orderReferenceId }`) のみクライアントに返すため、フロントから生フィールドにアクセスしようとすると undefined。

---

## Part 8: 全 12 商品展開

### 8.1 戦略

- **1 商品 = 1 Gelato product = 1 Shopify product**
- 各 Shopify product 配下に **サイズ x 色 = N 個の variant**
- 12 商品 × 5 サイズ平均 = 60 variants 程度

### 8.2 Gelato 一括作成は不可（手動が現実解）

Gelato dashboard には bulk create がない。各商品 5〜7 分かかる。**1 日で全部やる気で集中時間を取る**（1.5 時間程度）。

順序推奨（gelato_product 別にグループ化、デザイン使い回し）:

| グループ | gelato_product | 商品 |
|---|---|---|
| Hoodie (Independent SS4500) | `..._independent_ss4500` | enter-hoodie / logo-hoodie / enter-hoodie-white / logo-hoodie-oversized |
| Tee (Bella 3001) | `..._bella-and-canvas_3001` | enter-tee / logo-tee / enter-longsleeve / logo-longsleeve |
| Crewneck (Champion S1049) | `..._champion_s1049` | enter-crewneck / logo-crewneck |
| Tank (Comfort Colors 9360) | `..._comfort-colours_9360` | enter-tank / logo-tank |

Gelato で **Duplicate product** 機能を使えば、デザインだけ差し替えて高速化できる。

### 8.3 デザインファイル

`/Users/10ta210/Desktop/inryoku_hp/public/` に存在するもの:
- `info_logo_hoodie.png` ← logo 系の印刷ファイル（4 商品で使い回し）
- `enter_hoodie.png` ← enter 系の印刷ファイル（8 商品で使い回し）
- `mockup_qr_tee.png` / `mockup_universe_tee.png` ← モックアップ用（印刷には使わない）

**注意**: 同じ PNG をフロントとフードに使うと印刷位置が崩れる。**フロント用 / バック用 / フード用** を分けて Gelato に登録する設計だが、本 runbook の最小ループでは「フロント中央配置」のみで進める。

### 8.4 Admin API で variant ID 一括取得スクリプト

12 商品 × 5 サイズ = 60 variants を手動コピペは事故る。スクリプトで一気に取得:

`/Users/10ta210/Desktop/inryoku_hp/_dev/fetch_variants.js`（新規作成、`_dev` ディレクトリは静的配信から自動 deny される）:

```js
#!/usr/bin/env node
// 使い方: ADMIN_TOKEN=shpat_xxx node _dev/fetch_variants.js > variant_map.json
const https = require('https');
const TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) { console.error('ADMIN_TOKEN 必須'); process.exit(1); }

const query = `{
  products(first: 50) {
    edges { node {
      id title handle tags
      variants(first: 20) {
        edges { node { id title selectedOptions { name value } } }
      }
    } }
  }
}`;

const payload = JSON.stringify({ query });
const opts = {
  method: 'POST',
  hostname: '0xi10h-x1.myshopify.com',
  path: '/admin/api/2024-10/graphql.json',
  headers: {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(opts, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const data = JSON.parse(body);
    const map = {};
    for (const edge of data.data.products.edges) {
      const p = edge.node;
      // tag に "enter-tee" 等を入れておくとマッチしやすい
      const handleTag = (p.tags || []).find(t => /^(enter|logo)-/.test(t)) || p.handle;
      const productKey = handleTag;
      map[productKey] = map[productKey] || {};
      for (const v of p.variants.edges) {
        const sizeOpt = v.node.selectedOptions.find(o => o.name.toLowerCase() === 'size');
        const size = sizeOpt ? sizeOpt.value : v.node.title;
        map[productKey][size] = v.node.id;
      }
    }
    console.log(JSON.stringify(map, null, 2));
  });
});
req.on('error', e => console.error(e));
req.write(payload);
req.end();
```

実行:
```bash
ADMIN_TOKEN=shpat_xxx node _dev/fetch_variants.js > /tmp/variant_map.json
cat /tmp/variant_map.json
```

出力例:
```json
{
  "enter-tee": {
    "S": "gid://shopify/ProductVariant/498000000001",
    "M": "gid://shopify/ProductVariant/498000000002",
    "L": "gid://shopify/ProductVariant/498000000003",
    "XL": "gid://shopify/ProductVariant/498000000004",
    "2XL": "gid://shopify/ProductVariant/498000000005"
  },
  "logo-tee": { "S": "...", "M": "...", ... }
}
```

これを `p3_code_for_claude.js:71-84` の `SHOPIFY_VARIANT_MAP` に貼り替える。

### 8.5 タグ運用が肝

Gelato で商品作成時に **Tags** に `enter-tee` / `logo-tee` などを入れておけば、上記スクリプトの `productKey` が PRODUCTS の `id` と一致して自動マッピングできる。

Gelato 経由で Shopify に送る Tags はデフォルトでは付かないので、Shopify 商品ページで手動 or 一括編集で `Tags` 欄に商品 ID を追記する作業が発生する。これは **1 商品 30 秒** で済む。

### 8.6 スプレッドシート管理（推奨）

Google Sheets で以下の表を作る:

| product_id | gelato_status | shopify_status | sizes | shopify_handle | gid_S | gid_M | gid_L | gid_XL | gid_2XL |
|---|---|---|---|---|---|---|---|---|---|
| enter-tee | ✅ | ✅ active | 5 | enter-tee | gid://... | gid://... | gid://... | gid://... | gid://... |
| logo-tee | ✅ | ✅ active | 5 | logo-tee | ... | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

進捗管理 + variant ID 検索 + 抜け漏れ検知に使う。Sheets → JSON 変換は GAS で 5 分。

### 8.7 各商品 Gelato productUid 確認

`p3_code_for_claude.js` の `gelato_product` フィールドが現行 Gelato カタログと整合しているか:

| product_id | コード上の productUid | 確認すべき点 |
|---|---|---|
| enter-tee / logo-tee / enter-longsleeve / logo-longsleeve | `..._bella-and-canvas_3003` | **3003 は long sleeve / short sleeve どちらか要確認**。Bella 3001=tee, 3501=long sleeve, 3003=trail。実商品作成時の URL の productUid を見て JS 側を直す |
| enter-hoodie / logo-hoodie / enter-hoodie-white / logo-hoodie-oversized | `..._independent_ss4500` | Independent SS4500 Hoodie。oversized は `_relaxed_` フラグが入る場合あり |
| enter-crewneck / logo-crewneck | `..._champion_s1049` | Champion S1049。日本配送はカタログに含まれないことがある |
| enter-tank / logo-tank | `..._comfort-colours_9360` | Comfort Colors 9360 Tank。日本可否要確認 |

Gelato dashboard の **Catalog** → 商品名で検索 → 商品ページの URL に productUid が入っている。それと突き合わせて差分があれば JS を直す。

`docs/ec-status-2026-04-27.md` でも「Gelato 自動注文: Shopify アプリ側が webhook で受けるので、サーバー側 `/api/gelato/order` は実は不要かも。要検証」と書かれている通り、Part 6 でテスト注文が Shopify アプリ経由で Gelato に届くなら **`GELATO_CONFIG.enabled = false` のまま運用** で十分。productUid の正確性は最悪 Gelato 側で正しければ JS の値は使われない。

---

## Part 9: 本番稼働前チェックリスト（30 項目）

ローンチ前夜に上から潰す。

### A. ドメイン / インフラ（5 項目）

1. ☐ `inryoku.com` を取得（Cloudflare / お名前.com 等）
2. ☐ Shopify 管理画面 → 設定 → ドメイン → カスタムドメインを接続（CNAME 設定）
3. ☐ DNS 伝播確認（`dig inryoku.com` → Shopify の IP）
4. ☐ SSL 証明書発行待ち（Shopify が自動。30 分〜24 時間）
5. ☐ メインドメイン (`inryoku.com`) を Primary に。`0xi10h-x1.myshopify.com` は 301 redirect

### B. 法定ページ（4 項目）

6. ☐ `legal.html`（特定商取引法）に必須項目記載: 販売事業者名 / 所在地 / 電話番号 / 代表者 / 公開メール / 販売価格 / 送料 / 支払方法 / 引渡時期 / 返品交換条件
7. ☐ `privacy.html`（個人情報保護方針）: 個情法に準拠。取得項目・利用目的・第三者提供（Gelato への配送先提供を明記）・開示請求方法
8. ☐ `returns.html`（返品ポリシー）: POD は基本不可だが、不良品交換は対応する旨
9. ☐ Shopify 管理画面 → 設定 → ポリシー で各 URL を登録（checkout 画面下部に自動表示）

### C. 配送・関税・通貨（5 項目）

10. ☐ Shopify 設定 → 配送と配達 → ゾーン: 日本のみ or グローバル（日本＋海外）を決める
11. ☐ Gelato 配送料金は注文時自動計算なので Shopify 側で「実費転嫁」設定
12. ☐ 海外発送する場合: Gelato が現地印刷拠点を自動選択（DDP/DDU は商品による）
13. ☐ 通貨: 日本のみなら JPY 固定。多通貨は Markets で設定
14. ☐ Gelato dashboard → Account → Billing currency = JPY または EUR

### D. 決済（4 項目）

15. ☐ Bogus Gateway 無効化
16. ☐ Shopify Payments 本番モード ON（テストモード OFF）
17. ☐ Shopify 銀行口座登録 + 本人確認書類アップロード完了
18. ☐ 追加決済: Apple Pay / Google Pay / コンビニ払い / Amazon Pay 等を必要に応じて有効化

### E. Gelato 本番化（3 項目）

19. ☐ Gelato dashboard → Stores → Order processing = **Automatic**（Manual を解除）
20. ☐ Gelato 支払い方法登録（クレカ or 口座振替）
21. ☐ テスト注文を全部 Cancel + 返金処理済み

### F. 商品データ（4 項目）

22. ☐ 12 商品 × 全サイズの variant が `SHOPIFY_VARIANT_MAP` に埋まっている
23. ☐ 全商品の Shopify ステータスが Active
24. ☐ 各商品のメイン画像が Gelato モックアップ or 司さんが用意した写真
25. ☐ 価格が `priceNum` と Shopify variant 価格で一致

### G. セキュリティ / 運用（5 項目）

26. ☐ `.env` がリポジトリにコミットされていない（`.gitignore` で除外済み）
27. ☐ `ADMIN_API_KEY` を強固なランダム文字列に設定（`openssl rand -hex 32`）
28. ☐ `ADMIN_DEV_BYPASS` 環境変数が **本番に設定されていない**
29. ☐ HTTPS 強制（Shopify は自動。Node サーバーをホストする場合は別途）
30. ☐ Google Analytics / Google Tag Manager のトラッキング ID を `index.html` に埋めて動作確認

---

## Part 10: 運用フェーズ

### 10.1 注文監視

毎日（or 通知設定）:
- Shopify 管理画面 → 注文 → 新規注文の確認
- Gelato dashboard → Orders → 印刷ステータスの確認
- 異常注文（同じ住所 / 同じカードで連続注文）は手動キャンセル

通知設定:
- Shopify: 設定 → 通知 → 注文確認メールを `tsukasa.2000922@gmail.com` に
- Gelato: dashboard → Account → Notifications → Order events を ON

### 10.2 在庫の概念（POD なので基本「無限」）

- POD = 印刷オンデマンドなので Shopify の在庫数は無視 OK
- ただし **Gelato カタログから商品が落ちる**ことがある（生産終了）→ メールで通知が来る
- 落ちた場合: 該当 Shopify 商品を Draft に戻す or 別 productUid で再作成

### 10.3 カスタマーサポート

問い合わせ経路:
- `/api/contact` → `data/contacts.json` に蓄積
- 司さんが定期的に確認

よくある問い合わせと一次回答:

| 種別 | 一次回答テンプレ |
|---|---|
| 配送いつ届く | Gelato dashboard → 該当注文 → tracking URL を返信 |
| サイズ間違えた | 出荷前なら Gelato dashboard で cancel → 再注文促す |
| 不良品 | 写真送付要求 → Gelato support に reprint request |
| 返金 | Shopify 管理画面 → 注文 → 返金処理 |

### 10.4 個人情報保護法対応

- `data/subscribers.json` / `data/contacts.json` には メールアドレス・配送先（注文側は Shopify 内）が入る
- 開示請求があったら 1 ヶ月以内に対応（個情法）
- 削除請求: subscribers.json の該当行を物理削除 + 「削除完了」を返信
- 漏洩した場合: 個情委に 3〜5 日以内に報告（速報）+ 30 日以内に確報

### 10.5 売上 / 利益管理

- Shopify Analytics → 売上 / 注文数 / 平均注文額
- Gelato Analytics → 印刷代 / 配送代 / 利益（Selling - Cost）
- 月次で突合: Shopify 売上 - Gelato 仕入 - Shopify 手数料 - 決済手数料 = 純利益

Shopify 手数料（Basic）: 国内オンライン 3.4%、海外 / Amex 3.9%
Gelato コスト: 商品ごと変動（Tee ¥1,800〜2,400、Hoodie ¥3,800〜4,500）

### 10.6 ローテーション・バックアップ

四半期ごと:
- ☐ Storefront API token を再生成 → `.env` 更新
- ☐ Gelato API key を再生成 → `.env` 更新
- ☐ ADMIN_API_KEY を再生成
- ☐ `data/` ディレクトリのバックアップ（Time Machine or 手動 cp）

---

## 付録 A: コマンドチートシート

```bash
# サーバー起動
cd /Users/10ta210/Desktop/inryoku_hp && node server.js

# .env 検査
cat /Users/10ta210/Desktop/inryoku_hp/.env

# checkout エンドポイント疎通テスト
curl -sX POST http://localhost:3000/api/checkout \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"id":"enter-tee","size":"M","qty":1,"shopifyVariantId":"gid://shopify/ProductVariant/49876543210123","price":8800}]}' | jq

# Storefront API 直叩き（variant 存在確認）
curl -sX POST https://0xi10h-x1.myshopify.com/api/2024-10/graphql.json \
  -H "X-Shopify-Storefront-Access-Token: $SHOPIFY_STOREFRONT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ node(id: \"gid://shopify/ProductVariant/49876543210123\") { ... on ProductVariant { id title availableForSale } } }"}' | jq

# Admin API で全 variant 取得
ADMIN_TOKEN=shpat_xxx node /Users/10ta210/Desktop/inryoku_hp/_dev/fetch_variants.js | jq

# Gelato 注文中継テスト（dry run、enabled=false なら 200 で error 返る）
curl -sX POST http://localhost:3000/api/gelato/order \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"productUid":"...","quantity":1,"printFile":"https://..."}],"shipping":{}}' | jq

# サーバープロセス kill
lsof -ti:3000 | xargs kill -9
```

## 付録 B: 関連ファイル一覧

- `/Users/10ta210/Desktop/inryoku_hp/server.js` — API 中継 (`/api/checkout`: 565 行〜, `/api/gelato/order`: 630 行〜)
- `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js` — クライアント設定 (`SHOPIFY_CONFIG`: 64, `SHOPIFY_VARIANT_MAP`: 71, `GELATO_CONFIG`: 89, `PRODUCTS`: 195)
- `/Users/10ta210/Desktop/inryoku_hp/.env` — トークン格納（リポジトリ外）
- `/Users/10ta210/Desktop/inryoku_hp/p3_test.html` — ローカル動作確認用
- `/Users/10ta210/Desktop/inryoku_hp/legal.html` / `privacy.html` / `returns.html` — 法定ページ
- `/Users/10ta210/Desktop/inryoku_hp/docs/ec-status-2026-04-27.md` — 現状把握
- `/Users/10ta210/Desktop/inryoku_hp/docs/security-fixes-2026-04-28.md` — server.js セキュリティ仕様

---

## 付録 C: 最小ループのおさらい（Part 2-6 の凝縮）

10 ステップで本番への最初の 1 周:

1. Gelato で `enter-tee` の M サイズだけ作る（Bella 3001 / Black）
2. Shopify に同期される（30 秒〜2 分）
3. Shopify 管理画面 → 商品 → variant 編集ページの URL から ID をコピー
4. `gid://shopify/ProductVariant/<id>` 形式で `SHOPIFY_VARIANT_MAP['enter-tee']['M']` に貼る
5. `node server.js` で起動
6. http://localhost:3000/p3_test.html → ENTER TEE → M → checkout
7. Shopify checkout に飛ぶ
8. Bogus Gateway / カード番号 `1` で決済
9. Gelato Manual mode で注文を確認 → Cancel
10. 全部通ったら Part 8 で残り 11 商品展開

---

— END —
