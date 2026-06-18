# inryoku.com → Shopify チェックアウト紐付け DNS ガイド (2026-05-11)

> **目的**: チェックアウト URL を `072xjz-qn.myshopify.com/cart/c/...` から `inryoku.com/checkouts/...` に変える。
> ブランド世界観の最大の目視バレを消す施策。

---

## 0. 事前確認

司さんが既に持っている前提:
- ドメイン `inryoku.com` (お名前.com / Cloudflare / Route53 等のレジストラ契約済)
- DNS 編集権限 (レジストラ管理画面ログイン可)
- Shopify ストア `072xjz-qn.myshopify.com` (admin 権限)

DNS の知識がゼロでも 30 分で完了。反映に最大 24 時間。

---

## 1. Shopify 側で DOMAIN を追加

### 1-A. ドメイン設定画面を開く
1. Shopify 管理画面 → 設定 (左下歯車) → ドメイン
2. 「**既存のドメインを接続**」ボタンクリック
3. ドメイン入力: `inryoku.com` → 次へ

### 1-B. Shopify が指示する DNS 値をメモ
Shopify が以下のような値を提示する (実際の値は司さんが画面で確認):

```
A レコード     ホスト @     値: 23.227.38.65
CNAME レコード ホスト www   値: shops.myshopify.com
```

**司さん作業**: この 2 つの値を画面からコピー。次の手順で使う。

---

## 2. レジストラ側で DNS 編集

司さんが使ってる DNS 業者によって UI が違う。代表的なやつ:

### 2-A. お名前.com の場合
1. お名前.com にログイン
2. 「ドメイン」タブ → `inryoku.com` をクリック
3. 「DNS / 転送設定」 → 「DNS レコード設定を利用する」
4. 既存の A / CNAME レコードを **全削除** (または編集)
5. 新規追加:
   ```
   ホスト名: (空欄)        TYPE: A       VALUE: 23.227.38.65       TTL: 3600
   ホスト名: www           TYPE: CNAME   VALUE: shops.myshopify.com TTL: 3600
   ```
6. 「確認画面へ進む」 → 「設定する」

### 2-B. Cloudflare の場合
1. Cloudflare ダッシュボード → `inryoku.com` 選択
2. 「DNS」タブ
3. 既存の A / CNAME 編集 or 新規追加:
   ```
   Type: A     Name: @     Content: 23.227.38.65          Proxy: DNS only (グレー雲)
   Type: CNAME Name: www   Content: shops.myshopify.com   Proxy: DNS only (グレー雲)
   ```
4. ⚠ **Proxy をオレンジ雲のままにしない**: Shopify は CDN を持っているので Cloudflare の Proxy 通すと checkout が壊れる可能性

### 2-C. Route53 の場合
1. AWS console → Route53 → Hosted zones → `inryoku.com`
2. Create record:
   ```
   Type: A     Name: (空欄)  Value: 23.227.38.65         TTL: 300
   Type: CNAME Name: www     Value: shops.myshopify.com  TTL: 300
   ```
3. Create

### 2-D. Google Domains / Squarespace 等
レジストラの「DNS records」「カスタムリソースレコード」「nameserver」あたりに同じ値を入力。
わからなければ各レジストラのサポートチャットに「Shopify に接続したい」と伝えれば 5分で教えてくれる。

---

## 3. Shopify 側で確認

### 3-A. DNS 反映を待つ
- 通常は 15分〜数時間
- 最大 24時間 (TTL 次第)
- 確認方法: ターミナルで
  ```bash
  dig inryoku.com +short
  # → 23.227.38.65 が返ればOK

  dig www.inryoku.com +short
  # → shops.myshopify.com → 何かのIP が返ればOK
  ```

### 3-B. Shopify 管理画面で確認ボタン
1. ドメイン設定画面に戻る
2. `inryoku.com` の隣の「確認」ボタンクリック
3. 緑のチェックマーク = 接続成功

### 3-C. プライマリドメインに設定
1. 同じドメイン設定画面で `inryoku.com` を「プライマリドメインに変更」
2. 副ドメインの自動リダイレクト設定: ON (任意 / 推奨)

---

## 4. 動作確認

### 4-A. ストアフロント
- `https://inryoku.com` を開く → Shopify ストア (現状空っぽ) が表示される
- ※ inryokü のプロジェクト本体 (P3 の演出付き) は別ホスティング (Railway 等) なので、ここは Shopify ストア表示でOK

### 4-B. checkout URL がドメイン化されたか
ターミナルで:
```bash
set -a && source .env && set +a
curl -s -X POST "https://${SHOPIFY_STORE_DOMAIN}/api/2024-10/graphql.json" \
  -H "X-Shopify-Storefront-Access-Token: ${SHOPIFY_STOREFRONT_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { cartCreate(input: { lines: [{ merchandiseId: \"gid://shopify/ProductVariant/48005115445402\", quantity: 1 }] }) { cart { checkoutUrl } } }"}' \
  | python3 -m json.tool | grep checkoutUrl
```

期待値の変化:
- **接続前**: `https://072xjz-qn.myshopify.com/cart/c/...`
- **接続後 (プライマリドメイン inryoku.com)**: `https://inryoku.com/cart/c/...`

---

## 5. inryokü サイト本体の DNS

サイト本体 (`localhost:3000` で動いてる Node サーバー) を本番公開する場合は別途必要:

### Railway / Vercel / Fly.io 等で公開する場合
1. ホスティング側にデプロイ
2. ホスティングが指示する CNAME を `inryoku.com` (または `app.inryoku.com` 等のサブドメイン) に登録

⚠ **問題**: `inryoku.com` のルートドメインを Shopify の A レコード `23.227.38.65` に向けてるので、サイト本体は `app.inryoku.com` などのサブドメインで公開する必要がある。

または:
- ルートを inryokü サイト本体に向けて、Shopify は `shop.inryoku.com` などサブドメインで運用

司さんの判断次第。**推奨**:
- `inryoku.com` → inryokü サイト本体 (P3 演出 / メインのブランド体験)
- `shop.inryoku.com` → Shopify ストア (チェックアウト用)

→ チェックアウト URL: `shop.inryoku.com/cart/c/...`

ブランド的には `inryoku.com/checkouts/...` の方が綺麗だが、サイト本体を別 path (例: `inryoku.com/store`) に当てるのが Shopify では難しい。

---

## 6. 変更後の `.env` / コード更新

DNS 接続後、Shopify 側のドメインが切り替わっても `.env` の `SHOPIFY_STORE_DOMAIN` は **`072xjz-qn.myshopify.com` のまま**で OK (Storefront API endpoint は myshopify.com 直叩きのため)。

ただし client から見える checkout URL のドメインは Shopify 側のプライマリドメイン設定が反映される。コード側の修正は不要。

---

## 7. トラブルシュート

### Q: 「DNS 確認失敗」と出る
→ DNS の TTL 待ち (最大 24時間)。または DNS 値の typo。`dig inryoku.com` で確認。

### Q: Cloudflare で接続したけど SSL エラー
→ Cloudflare の Proxy (オレンジ雲) を OFF にして DNS only (グレー雲) に。

### Q: チェックアウト URL がまだ `myshopify.com` のまま
→ プライマリドメインに `inryoku.com` を設定したか確認 (Shopify 設定 → ドメイン → 「プライマリドメインに変更」)

### Q: A レコードを追加したいが既に @ レコードが存在する
→ 既存のものを Shopify の値で上書き。Wordpress 等の既存サイトと共存はできない。

### Q: ルートドメインじゃなくサブドメインで運用したい
→ `shop.inryoku.com` を Shopify、`inryoku.com` を別サービスに振る。Shopify 側の追加で `shop.inryoku.com` を入力 → CNAME `shop` → `shops.myshopify.com` を DNS に追加。

---

## 8. チェックリスト

```
□ Shopify 管理画面で inryoku.com を追加
□ Shopify が指示する A / CNAME 値をメモ
□ レジストラ DNS 編集画面に上記値を登録
□ dig コマンドで反映確認
□ Shopify 側「確認」ボタンで接続成功
□ プライマリドメインを inryoku.com に変更
□ checkout URL が inryoku.com に切り替わったか確認
□ 既存サブドメインがある場合は別途振り分け検討
```

---

## 9. 関連ドキュメント

- `branding-whitelabel-todo-2026-05-09.md` — 全体 white-label TODO
- `ec-launch-checklist-2026-05-09.md` — 公開前チェックリスト
- `handoff-to-codex-2026-05-09.md` — Codex 引き継ぎ

---

最終更新: 2026-05-11
