# Codex への引き継ぎ — inryokü EC (2026-05-09 / Codex review 反映 2026-05-11)

> claude が作業した内容を Codex がレビュー・継続できるよう、状態と前提を完全に書き出したドキュメント。

---

## ⭐ Codex レビュー結論 (2026-05-11 反映済)

| § | claude 質問 | Codex 結論 |
|---|---|---|
| 10-A | SHOPIFY_CONFIG client hardcode | Storefront token なので仕様上 OK。将来的に `/api/shopify/graphql` proxy 一本化が運用的に綺麗 |
| 10-A | `/api/gelato/order` alias 保持期間 | 公開後 1〜2 週間ログ観察 → 古いアクセス無ければ削除可 |
| 10-B | 利用規約・返品ポリシー法的妥当性 | 法務はまだ公開不可。`legal.html` の TODO (販売者名/責任者/所在地/電話/送料/引渡時期) が残ってる |
| 10-C | 11商品自動登録 vs 手動 | 自動登録は今は不要。ENTER HOODIE で実購入成功 → 次に ENTER TEE だけ手動追加が現実的 |
| 10-C | DNS setup ガイド要否 | **作る価値あり** → `dns-shopify-connect-2026-05-11.md` で対応済 |
| 10-E | perf budget 失敗対処 | 大改修不要。P3 は演出サイトなので Lighthouse 実測優先で判断 |

### Codex 推奨「今やる順番」 (2026-05-11)
```
1. Shopify Payments KYC
2. legal.html の TODO 埋める
3. ENTER HOODIE テスト購入 (実 Stripe 通す)
4. inryoku.com DNS 接続 (→ dns-shopify-connect-2026-05-11.md 参照)
5. ENTER TEE 追加 (→ shopify-variant-runbook §1-NEXT 参照)
6. 残り商品は後回し (ENTER HOODIE/TEE で売上立ってから)
```

---

## 0. 一言サマリー

inryokü は **本番 EC 販売直前**。Shopify 接続済 + 1 商品 (ENTER HOODIE) 投入済 + チェックアウト URL 取得まで動作確認済。残るは 司 さんの個人情報入力 (KYC) と DNS 設定、および 11 商品の variant ID 投入。Gelato 名は client 側から完全に隠蔽済。

**最重要: localhost:3000 で /p3_test.html → ENTER HOODIE → ADD TO CART → CHECKOUT が Shopify 決済画面まで通る状態。**

---

## 1. インフラ & クレデンシャル

| 項目 | 値 |
|---|---|
| Shopify ストアドメイン | `072xjz-qn.myshopify.com` |
| Storefront API token | `.env` の `SHOPIFY_STOREFRONT_TOKEN` (32 chars hex, public-safe) |
| 旧ストア (廃止) | `0xi10h-x1.myshopify.com` (`.env.backup-2026-05-09` に旧 token 履歴) |
| Custom App | Dev Dashboard `inryoku-frontend-2` (Storefront 4 scope: write/read_checkouts, read_product_listings/inventory) |
| Headless チャネル | 「My Store Headless」storefront 作成済 (公開 token = 上記) |
| local server | `node server.js` → `localhost:3000` (Antigravity launch.json) |
| `.env` | 司の home dir 範囲、git-ignored 想定 |
| cache buster | `20260509-hide2` / SW VERSION `inryoku-v32-20260509-hide2` |

---

## 2. Gelato (POD 業者) 隠蔽の状態

**client-side gelato 露出**: **0 hits** (`grep -rinE gelato *.html *.js i18n.json`)

| 場所 | 旧 | 新 |
|---|---|---|
| `p3_code_for_claude.js` PRODUCTS field | `gelato_product` | `_pod` (12商品) |
| `p3_code_for_claude.js` config | `GELATO_CONFIG` | `POD_CONFIG` |
| `p3_code_for_claude.js` functions | `gelatoBuildUid` / `gelatoCreateOrder` | `podBuildUid` / `podCreateOrder` |
| client → server endpoint | `/api/gelato/order` | `/api/pod/order` |
| `sw.js` | `/api/gelato` | `/api/pod` |
| `privacy.html` 第三者提供 | 「Gelato 等の生産・配送パートナー」 | 「当社の生産・配送パートナー」 |
| `i18n.json` privacy.body.third_party (ja/en/ko) | Gelato 言及あり | 一般化 |
| `legal.html:66` HTMLコメント | `Gelato 等のオンデマンド生産` | `オンデマンド生産パートナー` |

**server-side (server.js) では gelato 名残存** — これは server-only コード (`process.env.GELATO_API_KEY` 読込 / `order.gelatoapis.com` upstream)。client には届かない。Codex が refactor する場合は env var 名 (`GELATO_API_KEY`) と upstream URL (`order.gelatoapis.com`) を保ちつつ rename したいなら自由に。

**互換性**: `server.js:1376` で `/api/pod/order` と `/api/gelato/order` 両方を accept する OR 条件にした (alias)。古い SW を持つブラウザでも動く。

---

## 3. PRODUCTS / Shopify variant 状態

`p3_code_for_claude.js:71` `SHOPIFY_VARIANT_MAP`:

```js
{
  'enter-hoodie': {
    'S':   'gid://shopify/ProductVariant/48005115412634',
    'M':   'gid://shopify/ProductVariant/48005115445402',
    'L':   'gid://shopify/ProductVariant/48005115478170',
    'XL':  'gid://shopify/ProductVariant/48005115510938',
    '2XL': 'gid://shopify/ProductVariant/48005115543706'
  },
  'logo-hoodie': {},
  'enter-hoodie-white': {},
  'logo-hoodie-oversized': {},
  'enter-tee': {},
  'logo-tee': {},
  'enter-longsleeve': {},
  'logo-longsleeve': {},
  'enter-crewneck': {},
  'logo-crewneck': {},
  'enter-tank': {},
  'logo-tank': {}
}
```

ENTER HOODIE のみ Shopify 側に商品作成済 (在庫 100 ×5 サイズ)。残り 11 商品は Shopify admin に未登録。

UI は `getCheckoutStatus(p, size)` ヘルパー (line 113) でサイズごとに `availableForSale` を判定。variant 未登録のものは **「チェックアウト準備中」** 表示 (UI 全 surface で文言統一)。

---

## 4. checkout フロー

**現在のフロー (client-direct)**:

```
ブラウザ
  → SHOPIFY_CONFIG (p3_code_for_claude.js:64) を使って
  → 直接 https://072xjz-qn.myshopify.com/api/2024-10/graphql.json (Storefront API)
  → cartCreate mutation
  → checkoutUrl 取得
  → window.location.href = checkoutUrl
  → Shopify checkout 画面
```

**fallback フロー (server proxy)**:

```
SHOPIFY_CONFIG が未設定 / shopifyVariantId が無い場合
  → /api/checkout (server.js:1305)
  → server-side で Storefront API を proxy
  → checkout URL を返す
  → client がそれにリダイレクト
```

両方の経路で動作検証済。`curl -X POST localhost:3000/api/checkout ...` で `HTTP 200 + {"url":"..."}` を確認 (このセッションで実機テスト済)。

---

## 5. Shopify 側で完了した設定

| 設定 | 状態 |
|---|---|
| ストア名 | `inryokü` |
| password 保護 | OFF |
| Custom App `inryoku-frontend-2` | リリース + インストール済 |
| Headless チャネル「My Store Headless」 | 作成済 (storefront token 取得元) |
| 商品 `ENTER HOODIE` | 作成済 / 在庫 100 ×5 サイズ |
| 返品・返金ポリシー | 登録済 (受注生産+海外関税フル網羅) |
| 配送ポリシー | 登録済 (7-14営業日 / 国内込 / 海外関税注記) |
| 利用規約 | 登録済 (8条構成) |
| プライバシーポリシー | 自動生成 (Shopify 標準) |

---

## 6. Shopify 側で **未** 設定 (司の手動必須)

| 優先 | 項目 | 必要なもの |
|---|---|---|
| 🔴 高 | Shopify Payments KYC | 戸籍名 / 住所 / 生年月日 / 銀行口座 / 本人確認書類 |
| 🔴 高 | カスタムドメイン `inryoku.com` 紐付け | DNS A / CNAME 編集権限 |
| 🔴 高 | 連絡先情報 (Settings → Legal → 連絡先) | 司の連絡先 (email / phone) |
| 🔴 高 | 特定商取引法に基づく表記 (Settings → Legal → 特商法) | 販売者名 / 責任者 / 所在地 / 電話 |
| 🟡 中 | チェックアウトブランディング (ロゴ / 色) | ロゴ画像 |
| 🟡 中 | メール送信元 `noreply@inryoku.com` | inryoku.com の DKIM/SPF |
| 🟢 低 | 残り11商品 Shopify 登録 | 商品画像 / 説明 / variant 設定 |
| 🟢 低 | Gelato Plus ($14.99/月) | クレカ |

---

## 7. ローカル側で **未** 完了

`legal.html` の `[TODO 司]` プレースホルダー (HTML 上で見える):

| line | 項目 |
|---|---|
| 30 | 販売事業者 (氏名) |
| 33 | 運営責任者 |
| 38 | 所在地 |
| 42 | 電話番号 + 受付時間 |
| 75 | 商品の使用条件 |
| 78 | 販売数量・販売条件 |
| 80 | 表記更新日 |

---

## 8. 既知のテスト失敗 (本セッション以前から)

`npm test` 結果: **586 pass / 6 fail** (本セッション edits は regression なし)

| # | テスト | 原因 |
|---|---|---|
| 21 | html-asset-reference | 古いハッシュ `?v=20260430wgl22mq` を expect (テスト側更新漏れ) |
| 25 | i18n.json `philosophy.sub` 空 ja | 翻訳補充1件 |
| 101-103 | perf budget | `p3_code_for_claude.js` 328KB / `p3_styles.css` 142KB が budget 超過 (運用継続中の既知) |
| 153 | css_token_consistency `--pr-chord-opacity` | CSS 変数 ↔ JS 定数の値不一致 |

これらは Codex がついでに直しても良いし、放置でも本番影響なし。

---

## 9. 関連ドキュメント

すべて `docs/` 直下:

- **`ec-launch-checklist-2026-05-09.md`** — 公開前チェックリスト (HIGH/MED/LOW + 既知 test 失敗説明)
- **`shopify-variant-runbook-2026-05-09.md`** — Shopify variant 投入手順 (1商品テスト購入の完全フロー)
- **`ec-risk-review-2026-05-09.md`** — 法務 / 配送 / 返品 / 決済 / SEO リスク優先度
- **`branding-whitelabel-todo-2026-05-09.md`** — Gelato/Shopify 痕跡完全消去 TODO
- (このファイル) `handoff-to-codex-2026-05-09.md`

---

## 10. Codex に確認してほしいポイント

### A. 私の judgement の検証
- `SHOPIFY_CONFIG` を client-side に hardcode した (p3_code_for_claude.js:64)。Storefront token は 公開仕様だが、敢えて server proxy 維持したほうが良いケースがあるか?
- `/api/pod/order` alias の OR 条件 (server.js:1376) は backwards compat 重視。古い SW から来る `/api/gelato/order` を受け続ける期間をいつまで持つべきか?

### B. UX レビュー
- 利用規約 (Shopify 側) の文言、特に「第3条 契約成立」「第4条 30分以内キャンセル窓」が妥当か。日本の消費者契約法と特商法の観点で。
- 返品ポリシーで「受注生産品のため原則お受けできません」 vs 「個別に承れる場合があります」の表現は曖昧で消費者庁グレーゾーンか?

### C. 残作業の優先度
- 11 商品の Shopify 一括登録: GraphQL Admin API で自動化 (custom app に admin scope `write_products` 追加 → mutation `productCreate`) するのと、司が手動で UI から1個ずつやるのとどちらが推奨?
- DNS 紐付けは司の DNS provider 次第 (お名前.com? Cloudflare?) — Codex 側で setup ガイドを書くべきか?

### D. セキュリティ
- `.env` に Storefront token 入ってる + `p3_code_for_claude.js` にも hardcode (二重)。一方で source は public 配信。CSP の `connect-src https://*.myshopify.com` は許可済 (server.js:158)。これで Storefront direct call は問題なく通る — 不正な connect-src の見落としないか?
- `tests/shopify-proxy.test.mjs` がまだ古いストアドメインを expect している可能性。再確認推奨。

### E. 既知 test 失敗の優先度
- perf budget over: ファイル分割で対処すべきか、budget 緩和で済ますか?
- p3 helpers tests (4件 failing 関連) は本セッションでまだ対処してない。

---

## 11. 司への申し送り (Codex 経由で伝言可)

1. **Shopify Payments KYC を最優先**: 1〜2 営業日待ちなので今日着手すべし
2. **DNS 設定 (`inryoku.com`)**: チェックアウト URL 自然化のため。1日反映なので並行着手
3. **legal.html の TODO 4箇所**: バーチャルオフィス + 050 IP電話で約 ¥1,000/月で揃う
4. **テスト購入 1 回**: ENTER HOODIE M / Stripe テストカード `4242…` で完了画面まで通すと安心
5. **残り11商品**: ENTER HOODIE が安定して売れることを確認してから順次拡張推奨

---

## 12. 環境再現コマンド

```bash
cd /Users/10ta210/Desktop/inryoku_hp

# 状態確認
curl -s localhost:3000/api/health | jq
curl -s -X POST localhost:3000/api/shopify/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ shop { name } }"}'

# Storefront API 直接
set -a && source .env && set +a
curl -s -X POST "https://${SHOPIFY_STORE_DOMAIN}/api/2024-10/graphql.json" \
  -H "X-Shopify-Storefront-Access-Token: ${SHOPIFY_STOREFRONT_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ products(first:5){edges{node{title availableForSale variants(first:5){edges{node{id title availableForSale}}}}}} }"}'

# Gelato 露出チェック (client-facing)
grep -rinE gelato *.html *.js i18n.json | grep -v '\.bak\|server\.js'
# → 0 hits expected

# サーバー再起動
pkill -f 'node server.js'; sleep 1
nohup node server.js > /tmp/server.log 2>&1 &

# 全 syntax check
node --check p3_code_for_claude.js && \
node --check server.js && \
node --check sw.js && echo OK
```

---

## 13. ファイル変更サマリー (このセッション)

```
modified:   p3_code_for_claude.js         (gelato → pod, SHOPIFY_CONFIG 更新, variant 投入)
modified:   p3_styles.css                  (.add-to-cart-btn.is-pending 追加)
modified:   server.js                      (/api/pod/order alias 追加)
modified:   sw.js                          (/api/gelato → /api/pod, VERSION v28→v32)
modified:   index.html                     (cache buster eclaunch1→hide2)
modified:   p3_test.html                   (cache buster eclaunch1→hide2)
modified:   legal.html                     (関税・キャンセル窓・コメント Gelato 削除)
modified:   returns.html                   (受注生産品セクション・海外関税)
modified:   privacy.html                   (Gelato 削除)
modified:   i18n.json                      (新キー 6個 + 第三者提供 文言修正 ja/en/ko)
modified:   .env                           (SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN 更新)
created:    public/inryoku_og.png          (root から copy)
created:    docs/ec-launch-checklist-2026-05-09.md
created:    docs/shopify-variant-runbook-2026-05-09.md
created:    docs/ec-risk-review-2026-05-09.md
created:    docs/branding-whitelabel-todo-2026-05-09.md
created:    docs/handoff-to-codex-2026-05-09.md  (このファイル)
backup:     .env.backup-2026-05-09         (旧ストアドメイン)
backup:     .env.backup-2026-05-09-v2      (旧 storefront token)
backup:     p3_code_for_claude.js.bak-gelato-hide
```

---

最終更新: 2026-05-09 / by claude
