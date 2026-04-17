# P3 ローンチ TODO

**Date:** 2026-04-13
**Goal:** inryokü P3 を公開して最初の1着を売る

---

## PHASE 1: Shopifyセットアップ（司さん）

- [ ] Shopify Starterプラン契約（$5/月）
- [ ] 商品12点をShopify管理画面で登録（名前・価格・サイズバリエーション）
- [ ] Gelato公式アプリをShopifyにインストール
- [ ] 各商品をGelatoの印刷テンプレートと紐付け + デザイン画像アップロード
- [ ] Storefront APIアクセストークン取得
- [ ] 各商品のvariant ID（GID）をリストにして共有

## PHASE 2: コード移行（Claude）

- [ ] server.jsからStripe/Gelato/Webhook関連コード削除
- [ ] p3_code_for_claude.jsにShopify Storefront APIクライアント追加
- [ ] CARTのチェックアウトフローをStorefront APIに差し替え
- [ ] PRODUCTSにShopify variant IDマッピング追加
- [ ] .env更新（STRIPE_SECRET_KEY削除、SHOPIFY系追加）
- [ ] ブラウザでテスト

## PHASE 3: 残りの必須タスク

- [ ] legal.html「運営責任者」を実名に更新
- [ ] 商品画像の差別化（12商品に2枚しかない → 最低限カテゴリ別）
- [ ] デプロイ先決定 + デプロイ（Railway / VPS / etc.）
- [ ] ドメイン設定（inryoku.com → サーバーに向ける）
- [ ] index.htmlにモバイル→P3直行ロジック追加

## PHASE 4: テスト注文

- [ ] Shopifyテストモードでテスト注文
- [ ] Shopify管理画面に注文が表示されることを確認
- [ ] Gelatoに注文が自動転送されることを確認
- [ ] success.htmlにリダイレクトされることを確認

## PHASE 5: 公開

- [ ] Shopifyをライブモードに切り替え
- [ ] SNS告知（X / Instagram）
- [ ] 最初の1着を売る

---

## 優先順位

**PHASE 1 → 2 → 4 → 3 → 5**

PHASE 1（Shopifyセットアップ）が終わらないとPHASE 2（コード移行）に進めない。
PHASE 3（画像・デプロイ等）はPHASE 4（テスト注文）と並行可能。
