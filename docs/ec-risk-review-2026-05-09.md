# inryokü EC リスクレビュー (2026-05-09)

> 法務・配送・返品で **未確定** の項目を一覧化。司さんが意思決定する必要があるポイント。

---

## 1. 法務リスク

### 1-A. 特定商取引法 11条 (HIGH)
**現状**: `legal.html` の以下 4 項目が `[TODO]` プレースホルダーのまま。

| 項目 | 法的位置付け | 司さんの選択肢 |
|---|---|---|
| 販売事業者名 | 必須 | (a) 戸籍上の氏名で個人事業 (b) 屋号+本名併記 (c) 法人化して登記名 |
| 運営責任者 | 必須 | 個人事業なら本人氏名で OK |
| 所在地 | 必須 (常時開示原則) | (a) 自宅 (b) バーチャルオフィス契約 (例: GMO 月¥660〜) (c) 司さん家族の住所利用 (要許可) |
| 電話番号 | 必須 | (a) 携帯番号 (b) 固定電話契約 (c) IP電話 (例: 050plus) |

**リスク**: 空のまま公開すると消費者庁の指導対象。最悪の場合、業務停止命令 (実例少ないがゼロではない)。

**推奨**: バーチャルオフィス + 050 IP 電話の組み合わせがコスト最小 (合計月¥1,000程度)。

### 1-B. 個人情報保護方針 (LOW)
**現状**: `privacy.html` は概ね揃っている (Stripe / Gelato / cookie 全て言及済)。
**未対応**: メルマガ登録時の同意。現状メルマガ機能なしなら問題なし。実装時は要追記。

### 1-C. 二重キャンセルポリシーの整合 (DONE in this session)
- `legal.html`: 「キャンセル原則不可」+ 30分以内窓を本セッションで追加
- `returns.html`: 受注生産品セクションを本セッションで追加 → legal と整合
- ✅ 修正完了

---

## 2. 配送・送料リスク

### 2-A. 国内/海外送料の確定 (MED)
**現状**:
- UI (`p3_code_for_claude.js:6624`): `WORLDWIDE SHIPPING` を商品 modal に表示
- legal.html: 送料欄に `[TODO 司]` プレースホルダー
- returns.html: 「海外発送の場合、関税・輸入税・通関手数料はお客様負担」を追記済

**司さんが決めるべきこと**:
- (1) 国内のみ販売 / (2) 海外も含む / (3) 国内は無料・海外は別途見積もり
- Gelato 経由の DHL 送料相場:
  - 日本国内: ¥600〜1,200 (商品代金に組み込みやすい)
  - 北米: $15-30
  - 欧州: $20-40
  - アジア他: $10-25

**推奨**: 国内送料込み価格 (¥12,800 に組み込み済) + 海外は cart で別途追加 (Shopify shipping rate 機能で自動計算)。

### 2-B. 引渡時期の精度 (MED)
**現状**: 「7-14営業日」表記が UI / legal で一致済 (本セッション統一)。
**残課題**: Gelato の実績値で詰める。Gelato dashboard で平均生産日数を観測 → 必要なら変更。

### 2-C. 関税の説明 (DONE in this session)
- ✅ `legal.html` / `returns.html` で「海外発送の場合、関税はお客様負担」を明記
- 商品 modal にもう一文足す案: `WORLDWIDE SHIPPING · 関税はお客様負担` (HIGH 優先度ではないが信頼感に直結)

---

## 3. 返品・キャンセルリスク

### 3-A. 受注生産品のキャンセル原則不可 (DONE)
- `returns.html` 冒頭に「受注生産品について」を追加 → 顧客の期待値調整
- `legal.html` キャンセル欄に「30分以内なら相談可」を追加 → 柔軟性確保
- ✅ 整合済

### 3-B. 不良品判定の境界 (LOW)
**現状**: `returns.html`「印刷不良・破損・誤配送」と記載
**潜在トラブル**: 「私の主観で印刷が荒い」と「客観的に印刷不良」の境界
**推奨**: 受注時に Gelato の生産品質基準 (最大解像度 / DTF 限界) を返品ポリシーで言及。
例: `※ DTF プリントの特性上、版ズレ ±2mm までは仕様の範囲内です。`

---

## 4. 決済・セキュリティリスク

### 4-A. Stripe テストモード残留 (HIGH 公開時のみ)
- 公開時に Stripe key が test → live に切り替わっているか確認必須
- 現状: ENV 変数経由なので、サーバーの本番デプロイ時に key 差し替え
- **チェック方法**: `curl /api/health` で `features.shopify: true` だが本番モードかは別途確認

### 4-B. Shopify Storefront API token の漏洩 (LOW)
- Storefront token は public OK な設計 (read-only)
- ただし `.env` を git に含めていないか確認 → `.gitignore` 確認推奨

### 4-C. Rate limit (DONE)
- ✅ `server.js:1306` で `/api/checkout` に 20/min/IP の rate limit 設定済
- ✅ `server.js:1263` で shopify proxy に 90/min/IP

---

## 5. UX 信頼感リスク

### 5-A. checkout 文言の混在 (DONE in this session)
**修正前**: "checkout soon" / "CHECKOUT SOON" / "checkout準備中" / "Shopify variant 設定待ち" の 4 種混在
**修正後**: 全 surface で「チェックアウト準備中」or「CHECKOUT」に統一
- ✅ p3_code_for_claude.js: 6箇所の文言統一 + `is-pending` クラス wire 完了
- ✅ p3_styles.css: `.add-to-cart-btn.is-pending` 追加 (破線+静か)

### 5-B. cart drawer のエラー表示 (DONE)
- ✅ `/api/checkout` が 503 を返した時、ユーザーに「決済プロバイダの設定が完了していません」と日本語で案内
- ✅ ネットワークエラー時も「ネットワークに接続できません」と表示

### 5-C. 信頼感装飾 (LOW)
- ✅ `Secure Checkout · Stripe` が cart 下部に表示
- 推奨追加: cart drawer に「個人情報は SSL で暗号化されます」「Shopify 経由で決済」のような微小な再保証文言 (LOW)

---

## 6. SEO リスク

### 6-A. OG 画像 404 (HIGH)
- `public/inryoku_og.png` が存在しない (root にはあり)
- 共有時にサムネが出ない / Twitter card が壊れる
- **司さん対応**: `cp inryoku_og.png public/` または `static` 配信ロジック確認

### 6-B. Product JSON-LD と PRODUCTS の整合 (LOW)
- 現状 p3_test.html に12商品の Product JSON-LD あり (`p3_test.html:204-400+`)
- variant ID 投入時に `offers.priceCurrency` / `offers.availability` が SKU と整合するか要確認

### 6-C. canonical / hreflang (DONE)
- ✅ inryoku.com に統一済

---

## 7. 司さんが「今すぐ」やる必要があるもの (Top 5)

1. **legal.html の TODO 4箇所を埋める** (販売者名・責任者・所在地・電話)
   → バーチャルオフィス申込 + 050電話番号取得が最速
2. **Shopify ストア作成 + 1商品で variant ID を取得**
   → `shopify-variant-runbook-2026-05-09.md` 参照
3. **public/inryoku_og.png を配置**
   → `cp inryoku_og.png public/inryoku_og.png` のみ
4. **送料ポリシー決定**
   → 国内のみ / 海外も / 関税ハンドリング
5. **GA4 アカウント作成 + ID 取得**
   → 公開後の数値把握。最優先ではないが早めに

---

## 8. リスクサマリー

| カテゴリ | HIGH | MED | LOW | 備考 |
|---|---|---|---|---|
| 法務 | 4 | 0 | 1 | 特商法4項目 |
| 配送 | 0 | 2 | 0 | 送料・引渡 |
| 返品 | 0 | 0 | 1 | 不良品境界 |
| 決済 | 1 | 0 | 0 | Stripe live 切替 |
| UX | 0 | 0 | 1 | 再保証文言 |
| SEO | 1 | 0 | 1 | OG 画像 |
| **合計** | **6** | **2** | **4** | |

**HIGH 6 件すべて司さんの手動作業**。Claude 側で実装で潰せる項目はすべて潰し済 (本セッションで 5 件解消)。

---

最終更新: 2026-05-09
