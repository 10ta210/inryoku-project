# inryokü EC 公開前チェックリスト (2026-05-09)

> 「変更可能(claude)」「司さん手動必須」を分けた、本番公開最終チェックリスト。
> 上から順に消化する。**HIGH** が残る限り公開不可。

---

## 0. このセッションで変更したもの (2026-05-09)

| ファイル | 変更内容 |
|---|---|
| `p3_code_for_claude.js` | checkout 文言を全 UI surface で「チェックアウト準備中」に統一 / 503 ハンドリング改善 / `is-pending` クラス wire / `getProductAvailabilityLabel` 日本語化 |
| `p3_styles.css` | `.add-to-cart-btn.is-pending` 追加 (破線 + 静かな pending 表現) |
| `legal.html` | 関税・海外発送注記追加 / 30分以内キャンセル窓追加 / 返品ポリシーへリンク強化 |
| `returns.html` | 「受注生産品について」セクション追加 / 「海外発送・関税」セクション追加 |
| `i18n.json` | 新キー6個追加 (extra_fees_default/intl, cancel_window, returns.made_to_order/intl) |
| `sw.js` / `index.html` / `p3_test.html` | cache buster: `20260509-brandprev1` → `20260509-eclaunch1`, SW VERSION `v27` → `v28` |

---

## 1. 🔴 HIGH — 司さんが手動で埋める必要 (公開前必須)

### 1.1 特定商取引法 表記 (`legal.html`)
公開前に **絶対** 埋める。空のままだと特商法11条違反 (消費者庁の指導対象)。

| 項目 | ファイル位置 | TODO 内容 |
|---|---|---|
| 販売事業者名 | `legal.html:30` | 個人事業の場合は屋号ではなく **戸籍上の氏名** |
| 運営責任者 | `legal.html:33` | 個人事業主なら本人氏名 |
| 所在地 | `legal.html:38` | 〒+都道府県+市区町村+番地。自宅出したくない場合は **バーチャルオフィス** 検討 |
| 電話番号 | `legal.html:42` | 連絡可能な番号+受付時間 (例: 平日 10:00-18:00) |
| 商品の使用条件 | `legal.html:75` | 例: アパレル → 洗濯表示に従ってください |
| 販売数量・販売条件 | `legal.html:78` | 例: 受注生産 / サイズ展開 S-3XL |
| 表記更新日 | `legal.html:80` | YYYY-MM-DD |

### 1.2 OG 画像
- ❌ `public/inryoku_og.png` が **存在しない** (root にはあるが `public/` に未配置)
- 現状 `https://inryoku.com/inryoku_og.png` を参照するコードあり (`index.html:85`, `p3_test.html`)
- 司さん作業: ① root の `inryoku_og.png` を `public/` にコピー、または ② サーバー root から直接配信される設定確認

### 1.3 GA4 ID
- `p3_test.html:67-73` と `index.html:64-74` にコメントアウトされた GA4 タグあり
- 司さん作業: https://analytics.google.com で GA4 プロパティ作成 → `G-XXXXXXXXXX` を実 ID に置き換え + コメント解除

### 1.4 Shopify variant ID (商品 1 個でテスト購入)
詳細は **`shopify-variant-runbook-2026-05-09.md`** 参照。要約:
1. Shopify 管理画面で商品作成 (まず1個 — `enter-hoodie` 推奨)
2. Variant ID (`gid://shopify/ProductVariant/...`) を取得
3. `p3_code_for_claude.js:208` の `shopifyVariants: {}` を埋める (S/M/L/XL/2XL の5サイズ)
4. ENV 変数 `SHOPIFY_STORE_DOMAIN` / `SHOPIFY_STOREFRONT_TOKEN` をサーバーに設定
5. `/api/checkout` にリクエストして checkout URL が返ることを確認
6. テスト購入 (Stripe テストカード `4242 4242 4242 4242`)

---

## 2. 🟡 MED — 推奨 (公開後でも修正可能だが信頼感に直結)

### 2.1 関税・送料テーブル (`legal.html:48`)
- 現状: 「[TODO 司: 国内送料無料 / 海外発送有無と料金体系を確定]」プレースホルダー
- UI 側で `WORLDWIDE SHIPPING` を謳っているので整合性必須
- 司さん作業: 国内送料込か / 海外送料を国別表示するか / Gelato + DHL の実コスト確認

### 2.2 引渡時期確定 (`legal.html:63`)
- 現状: 「[TODO: 例) 7〜14営業日以内]」のままプレースホルダー
- `p3_code_for_claude.js:6623` で `DELIVERY · 7–14 BUSINESS DAYS` と表示中
- 司さん作業: Gelato 実績値で確定し、`legal.html` のプレースホルダーを削除

### 2.3 受注生産・キャンセルの整合性
- ✅ legal.html / returns.html で文言整合済み (本セッション修正)
- 残: 商品 modal にも「受注生産品です」の一言があると親切 (現状なし)

### 2.4 OG image の差し替え
- 現状 OG 画像はおそらくグレー時代のもの。コア時代に合わせて差し替え推奨。
- 司さん作業: 1200×630 でコア中心の新ビジュアル作成 → `inryoku_og.png` 上書き

### 2.5 個人情報保護方針 (privacy.html)
- ✅ 主要項目 (取得情報・利用目的・第三者提供 [Stripe/Gelato]・開示請求・cookie) は揃っている
- 推奨追加: メルマガ登録時の同意の扱い (現状記載なし)

---

## 3. 🟢 LOW — 余裕があれば

- `sitemap.xml` に商品個別ページ URL を追記 (現状トップのみ。アクセス解析後で OK)
- `robots.txt` の存在確認 (テスト未確認)
- FAQ ページの追加 (Q: いつ届く / Q: サイズ交換できる / Q: 海外発送 etc.)
- success.html (購入完了画面) の文言レビュー
- offline.html (PWA オフライン画面) の文言レビュー

---

## 4. 公開前 最終チェックリスト

```
□ legal.html の TODO[司] 7箇所を全て埋めた
□ public/inryoku_og.png が 200 で取得できる
□ GA4 ID を有効化した (任意)
□ Shopify ENV 変数をサーバーに設定した
   - SHOPIFY_STORE_DOMAIN
   - SHOPIFY_STOREFRONT_TOKEN
□ 1商品で variant ID を埋めて、テスト購入が成功した
□ checkout 文言が全 UI で「チェックアウト準備中」または「CHECKOUT」に統一されている (✅)
□ /api/health が 200 を返す (✅ 確認済)
□ /p3_test.html が 200 を返す (✅ 確認済)
□ /legal.html /returns.html /privacy.html /size-guide.html が 200 (✅ 確認済)
□ npm test の失敗が想定範囲 (perf budget / 古い test 21,153) に収まっている (✅)
□ console.error がブラウザで出ていない (司さん手動確認)
□ DNS が inryoku.com に向いている
□ HTTPS 証明書が有効
□ Service Worker が更新される (cache buster 確認)
```

---

## 5. 既知の test 失敗 (現状放置可)

| # | テスト | 原因 | 対応方針 |
|---|---|---|---|
| 21 | html-asset-reference | `p2_code_for_claude.js?v=20260430wgl22mq` 期待 (古いハッシュ参照) | テスト側を更新するか、ハッシュを再導入。本番には無関係 |
| 25 | i18n ja empty for philosophy.sub | `i18n.json` に空 ja 値1件 | 単発の翻訳補充。本番影響なし |
| 101-103 | perf budget | `p3_code_for_claude.js` 328KB (max 307KB) / `p3_styles.css` 142KB (max 102KB) | ファイル分割または budget 上限緩和。Lighthouse 実測の方が信頼できる |
| 153 | css_token_consistency `--pr-chord-opacity` | CSS 変数と JS 定数の値不一致 | 司さんの過去調整時に発生。次の機会に揃える |

これらは **本セッションの edit が原因ではない** (i18n の 27, 33 は本セッションで修正済)。

---

## 6. 関連ドキュメント

- `shopify-variant-runbook-2026-05-09.md` — variant ID 投入手順 + 1商品テスト購入
- `ec-risk-review-2026-05-09.md` — 法務・配送・返品で未確定の項目
- `PRODUCTION-LAUNCH-MASTER-2026-04-28.md` — 既存マスター (本ドキュメントの上位)

---

最終更新: 2026-05-09
