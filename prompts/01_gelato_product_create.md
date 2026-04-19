# Gelato 商品作成プロンプト

## 使う場面
画像アップロード後、商品詳細を埋めて Shopify 公開まで。

## コピペ用

```
Gelato Multiple Products フローの途中から続ける。

司さんは既にブラウザで design ファイルを Browse files 経由で
アップロード済み (enter.png または inryoku_logo_icon.png)。

今から俺(Claude)がやること:
1. claude-in-chrome で現在のタブ (dashboard.gelato.com) を screenshot
2. 選択すべき商品タイプを自動チェック:
   - ENTER画像の場合 → ENTER系5商品 (hoodie/tee/long/crew/tank)
   - LOGO画像の場合 → LOGO系5商品 (同上)
3. Products ステップ: 以下の製品タイプをクリック
   - T-Shirts (Bella+Canvas 3003 Premium, mens, black)
   - Hoodies (Independent SS4500, mens, black)
   - Sweatshirts/Crewneck (Champion S1049, mens, black)
   - Tank Tops (Comfort Colours 9360, unisex, black)
   - Long Sleeve T-Shirt (Bella+Canvas 3003 long-sleeve)
4. Mockups: 自動生成を待つ (約30秒)
5. Details: 各商品に以下を設定
   - Title: 下記テーブル参照
   - Description: 下記テーブル参照
   - Tags: inryoku, enter/logo, 商品タイプ
6. Prices: 下記テーブル参照
7. Review → Save & Publish to Shopify
8. 司さんに変換結果を報告

## 商品マスタ (p3_code_for_claude.js と同期)

ENTER系:
- ENTER HOODIE: ¥12,800 — "EXIT is not the only option. ENTER the unknown."
- ENTER TEE: ¥8,800 — "Lightweight signal. The door is always open."
- ENTER LONG SLEEVE: ¥9,800 — "Long reach into the unknown. Every sleeve tells a story."
- ENTER CREWNECK: ¥11,800 — "No hood, no hiding. Face the door head-on."
- ENTER TANK TOP: ¥6,800 — "Stripped down. Pure signal, zero noise."

LOGO系:
- inryokü LOGO HOODIE: ¥12,800 — "The origin point. Grey contains every color — you just have to look."
- inryokü LOGO TEE: ¥8,800 — "The mark. Minimal outside, infinite inside."
- inryokü LOGO LONG SLEEVE: ¥9,800 — "Extended wavelength. The signal carries further."
- inryokü LOGO CREWNECK: ¥11,800 — "Clean orbit. The symbol speaks without shouting."
- inryokü LOGO TANK TOP: ¥6,800 — "Bare minimum, maximum frequency."

## 完了後の次タスク
Shopify Admin API で variant GID 取得 → p3_code_for_claude.js の 
shopifyVariants{} に自動埋込 → Railway 再デプロイ → テスト購入
```
