# inryokü ブランド世界観保護 / 業者名隠蔽 TODO (2026-05-09)

> 司さん「サイトの世界観を壊したくない / Gelato が一切バレないように」要望に対する作業メモ。
> 完了済 と 司さん手動 を分離。

---

## ✅ 完了済 (claude が即実装)

| 項目 | 場所 | 結果 |
|---|---|---|
| client JS から `gelato` 全削除 | `p3_code_for_claude.js` 全体 | view-source / DevTools で 0 hits |
| フィールド `gelato_product` → `_pod` | `PRODUCTS[*]._pod` (12商品) | 業者名がデータ構造から消滅 |
| 設定 `GELATO_CONFIG` → `POD_CONFIG` | line 98 付近 | |
| 関数 `gelato*()` → `pod*()` | `podBuildUid` / `podCreateOrder` | |
| サーバー endpoint 統一 | `/api/pod/order` (alias `/api/gelato/order`) | client は POD パスのみ |
| `sw.js` の `/api/gelato` → `/api/pod` | line 69 | service worker 配信源にも露出ゼロ |
| **`privacy.html` から「Gelato」削除** | 第三者提供セクション | 「生産・配送パートナー」総称に |
| **`i18n.json` privacy.body.third_party** | ja/en/ko 全言語 | 同上 |
| **`legal.html` HTMLコメント内の Gelato** | 配送目安 TODO 注記 | view-source からも消滅 |
| **Shopify ストア名 変更** | Settings → 一般 → 連絡先 | `My Store` → `inryokü` (アバターも反映) |
| **Shopify 返品・返金ポリシー登録** | Settings → ポリシー | 受注生産品 / 海外関税 / 返金期間 全網羅 |
| **Shopify 配送ポリシー登録** | Settings → ポリシー | 7-14営業日 / 国内送料込 / 海外関税注記 |
| **Shopify 利用規約登録** | Settings → ポリシー | 8条構成 (適用/性質/契約/キャンセル/著作権/免責/変更/管轄) |
| **`public/inryoku_og.png` 配置** | `public/` | OG カード 200 OK |
| cache buster bump | `20260509-hide2` / SW v32 | 旧キャッシュ破棄 |

検証コマンド:
```bash
curl -s http://localhost:3000/p3_code_for_claude.js | grep -ic gelato   # → 0
curl -s http://localhost:3000/p3_test.html         | grep -ic gelato   # → 0
curl -s http://localhost:3000/index.html           | grep -ic gelato   # → 0
```

---

## 🔴 HIGH — 司さん手動必須 (公開前 / 公開直後)

### 1. Shopify Payments 本人確認 (KYC)
- **どこで**: Shopify 管理画面 → 設定 → 決済 → `Shopify Payments を設定` 押下
- **必要なもの**:
  - 戸籍上の氏名
  - 住所 (郵便番号〜建物名)
  - 生年月日
  - 銀行口座 (入金先)
  - 本人確認書類 (運転免許証 or マイナンバーカード)
- **所要時間**: 入力 10分 + 審査 1〜2営業日
- **効果**: 決済が動く + Stripe 業者名が inryokü に固定 (現状 `tsukasa.20...@gmail.com` 由来)

### 2. カスタムドメイン `inryoku.com` の Shopify 紐付け
- **どこで**: Shopify 管理画面 → 設定 → ドメイン → 既存のドメインを接続
- **必要なもの**:
  - inryoku.com の DNS 編集権限 (お名前.com / Cloudflare 等)
  - Shopify が指示する A レコード / CNAME 値
- **やる手順**:
  1. Shopify が `A レコード = 23.227.38.65 / CNAME = shops.myshopify.com` を提示
  2. ドメインレジストラの DNS 設定でその値を登録
  3. 反映まで数時間〜24時間
  4. Shopify 側で「確認」ボタン押すとチェック
- **効果**: チェックアウトURL が `072xjz-qn.myshopify.com` → `inryoku.com/checkouts/...` に → **一番のバレが消える**

### 3. メール送信元を `noreply@inryoku.com` に
- **どこで**: Shopify 管理画面 → 設定 → 通知 → 差出人メールアドレス
- **必要なもの**:
  - inryoku.com のメールサーバー側の SPF / DKIM レコード追加
- **現状**: Gmail 由来のため自動的に `store+xxxxxx@shopifyemail.com` に書き換えられている (Gelato は隠れてる、Shopify ブランドが見える)
- **効果**: 注文確認メールが `noreply@inryoku.com` から届く → 完全 inryokü ブランド

---

## 🟡 MED — 公開後でもよい (信頼感に直結)

### 4. チェックアウトブランディング (ロゴ + 色)
- **どこで**: Shopify 管理画面 → 設定 → チェックアウト → カスタマイズ
- **必要なもの**:
  - inryokü ロゴ画像 (PNG, 透過, 推奨 200x60px)
  - ブランドカラー (推奨: 黒背景 + RGBCMY アクセント)
- **効果**: 決済画面が inryokü ぽくなる

### 5. OG画像配置
- **作業**: `cp /Users/10ta210/Desktop/inryoku_hp/inryoku_og.png public/inryoku_og.png`
- **効果**: SNSシェア時のサムネが出る

### 6. legal.html の TODO 4 箇所埋める
- 販売事業者名 / 運営責任者 / 所在地 / 電話番号
- 詳細は `ec-launch-checklist-2026-05-09.md` 参照

---

## 🟢 LOW — 余裕あれば (完全 white-label)

### 7. Gelato Plus 加入 ($14.99/月)
- **どこで**: gelato.com → Plan の Plus にアップグレード
- **得られる機能**:
  - **Branded packing slip**: 梱包内のパッキングスリップに inryokü ロゴ
  - **Custom return address**: 返送先 (もし返品されたら) を inryokü 指定アドレスに
  - **Branded tracking page**: `inryoku.com/track/...` で追跡画面表示
  - **Sender name override**: 配送ラベルの「差出人」が `Gelato Inc` じゃなく `inryokü` になる
- **効果**: 顧客が **物理的に箱を受け取った時も** inryokü ブランドのみ。Gelato 痕跡完全消滅。
- **判断**: 国内発送が大半なら必須度低め (国際配送だと税関で「製造元: Gelato」が見える可能性ありなので、ブランディング重視なら必須)

### 8. Shopify テーマの「powered by Shopify」削除
- **どこで**: テーマエディタ → footer
- **効果**: フッターから "Powered by Shopify" 文言が消える

### 9. Stripe レシート差出人を `inryokü`
- **どこで**: Stripe ダッシュボード → 設定 → ビジネス情報 → ビジネス名
- **前提**: 上記 #1 (Shopify Payments KYC 完了) 後にアクセス可能
- **効果**: クレカ明細の業者名が `inryokü` に統一

---

## 完了基準: 顧客視点で「Gelato」「Shopify」一切見えない状態

| 接点 | デフォルト表示 | 完全 white-label 後 |
|---|---|---|
| サイト URL | `inryoku-project-production-f827.up.railway.app` (現) | `inryoku.com` (#2 後) |
| チェックアウト URL | `072xjz-qn.myshopify.com` | `inryoku.com/checkouts/...` (#2 後) |
| 注文確認メール 送信元 | `store+xxx@shopifyemail.com` | `noreply@inryoku.com` (#3 後) |
| クレカ明細 業者名 | (未設定) | `inryokü` (#1 + #9 後) |
| 配送ラベル 差出人 | `Gelato Inc / Latvia` | `inryokü / 東京...` (#7 Gelato Plus 後) |
| 梱包内 packing slip | プレーン Gelato 標準 | inryokü ロゴ付き (#7 後) |
| 追跡 URL | `track.gelatoapis.com/...` または DHL 直 | `inryoku.com/track/...` (#7 後) |

---

## 推奨順序 (司さん作業フロー)

1. **今日**: Shopify Payments KYC 開始 (#1) — 審査待ちにかける
2. **今日 or 明日**: カスタムドメイン DNS 設定 (#2) — 反映待ちにかける
3. **明日 or KYC審査中**: チェックアウトブランディング (#4) + OG 画像 (#5) + legal.html (#6)
4. **公開直前**: メール送信元設定 (#3)
5. **公開後 1ヶ月運用してから判断**: Gelato Plus (#7) 加入

---

## 関連ドキュメント

- `ec-launch-checklist-2026-05-09.md` — 公開前チェックリスト全体
- `shopify-variant-runbook-2026-05-09.md` — Shopify variant 投入手順
- `ec-risk-review-2026-05-09.md` — 法務 / 配送 / 返品 リスク

---

最終更新: 2026-05-09
