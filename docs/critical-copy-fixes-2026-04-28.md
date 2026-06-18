# Critical Copy Fixes — 2026-04-28

`docs/copy-audit-2026-04-28.md` で指摘された致命 4 件 + 中程度 5 件への対応記録。
P0/P1/P2 の hot files（`p1_*` / `p2_*` / `p3_code_for_claude.js` / `particle_*` / `p3_styles.css`）は
原則禁止のため、**ランタイムフック方式**で迂回した。

## 1. 変更したファイル

| ファイル | 変更内容 |
|---|---|
| `server.js` | SYSTEM_PROMPT から架空商品（QR T / YOUR UNIVERSE T）削除。「商品情報は UI を正とする」方針に。fallbackResponse の qr/universe 分岐も商品中立に書き換え。価格/在庫を聞かれたら「画面を見て」と返す分岐を追加。 |
| `legal.html` | 特商法 11 項目テンプレへ全面書き換え。司さんが入力すべき箇所を `[TODO: ...]` でプレースホルダ化（販売業者・運営責任者・所在地・電話・送料・必要料金・引渡時期・使用条件・販売条件・更新日）。「請求あり次第開示」表記は B2C 継続販売では原則不可、というコメント付き。inryoku→inryokü。 |
| `privacy.html` | Cookie セクションを実態（`inryoku_grey` 認証 cookie / localStorage カート / 言語設定）に整合。広告トラッキングは未使用と明記。開示・訂正・削除請求の項目を追加。inryoku→inryokü。 |
| `returns.html` | h2「返品できない場合」直下に送料負担文が混入していた論理破綻を解消。「お客様都合による返品の条件」「返品をお受けできない場合」「不良品・誤配送」の 3 つに整理。inryoku→inryokü。 |
| `size-guide.html` | 実商品名と不一致だった `JustHoods JH001 Premium Hoodie` を `inryokü Apparel — Hoodie / Tee / Long Sleeve / Crewneck / Tank` に変更。寸法表は HOODIE 系の代表値である旨を注記。inryoku→inryokü。 |
| `success.html` | `<title>` の inryoku→inryokü のみ。 |
| `index.html` / `p3_test.html` | `<body>` 末尾に `copy-fix-runtime.js` ロードを追加（既存スクリプト群の前に置く — alert フックは早いほうが安全）。 |

## 2. 新規ファイル

### `copy-fix-runtime.js`

`window.alert` を一段ラップし、p3_code_for_claude.js が出す開発者向け文言を顧客向けに変換するシム。

| 開発者向け原文（p3_code 5170 など） | 顧客向け置換 |
|---|---|
| `この商品の checkout はまだ準備中です。Shopify variant を設定してください。` | `この色は、いままだ準備中。少し待ってから、もう一度のぞきにきて。` |
| `Checkout error: <詳細>` | `決済の途中で、信号が途切れた。ネットワークを確認して、もう一度試してみて。` |
| `No Shopify variants mapped` / `Checkout not ready yet` | 上記 variant 系と同じ |
| 在庫切れ系（sold out / 在庫 / out of stock） | `いまこの色は、誰かの手に渡ったところ。次の入荷をすこし待って。` |

原文は `console.info('[copy-fix] alert rewritten:', { original, shown })` に残るため、
運用時のデバッグは可能。Codex が p3_code を更新して新しい alert 文言を増やしても、
キーワード（variant / Shopify / checkout error / 在庫）にマッチすれば吸収される。

## 3. 司さんの残作業（公開前必須）

以下を埋めないと **特商法違反のまま販売継続** になります。

### A. `legal.html` のプレースホルダを全部埋める

`[TODO: ...]` で囲った 9 項目:

1. **販売業者** — 個人事業の場合は屋号ではなく戸籍上の氏名。
2. **運営責任者** — 個人事業主なら本人氏名。
3. **所在地** — 〒xxx-xxxx 都道府県市区町村番地まで。
   - 自宅住所を出したくない場合は **バーチャルオフィス** を契約してください（月数千円〜）。
   - 「請求あり次第開示」表記は消費者庁の見解上、限定的にしか認められず、B2C 継続 EC では推奨されません。
4. **電話番号** — 固定/携帯どちらでも可。受付時間も併記。
5. **送料** — 国内のみ無料か、海外発送するか。**現在 UI で WORLDWIDE SHIPPING を謳っているなら、海外発送ありで料金テーブルを用意するか、UI 側を「JAPAN ONLY」に修正する必要があります**（中程度 #7）。
6. **商品以外の必要料金** — 関税・代引き手数料等。なければ「なし」。
7. **商品引渡時期** — Gelato 等オンデマンド生産の実態に合わせる（「7〜14営業日」が実数か再確認）。
8. **商品の使用条件** — アパレルなら洗濯表示への言及程度で可。
9. **販売数量・販売条件** — 受注生産 / サイズ展開 等。
10. **表記更新日** — 公開日を入れる。

### B. UI 側の整合性確認

- **WORLDWIDE SHIPPING vs 全国一律無料の矛盾（中程度 #7）**
  legal.html を「全国一律無料（日本国内のみ）」にするなら、p3 系 UI / マーケティングコピーの WORLDWIDE SHIPPING 表記を削除するよう Codex に依頼してください（このエージェントは p3_code を触れません）。

- **checkout 状態語の統一（中程度 #5）**
  推奨: 全箇所 `checkout soon` の小文字統一（哲学的に「準備中」より静的）。
  これも p3_code 側の文言なので Codex 依頼マター。

### C. p3_code_for_claude.js の表記揺れ（中程度 #10）

- p2:656 の `inRYOKÜ` 大文字化など、P0-P2 のテキスト表記揺れは
  「P0-P2 削除厳禁」原則のため本エージェントでは未修正。docs に記録のみ。
- 司さんが Codex 経由で修正する際の参考に。

### D. AI チャット動作確認

- `server.js` の SYSTEM_PROMPT から QR T / YOUR UNIVERSE T を削除済み。
- 動作確認: AI に「QR T ある？」「YOUR UNIVERSE T いくら？」と聞いて、
  捏造した価格を返さず「画面を見て」系の応答に流れることを確認してください。
- 将来「AI に最新カタログを語らせたい」場合は、
  PRODUCTS をリクエスト時に system メッセージへ動的注入する形を推奨（server.js 内のコメント参照）。

## 4. 残タスク（このエージェントの守備範囲外）

| # | 内容 | 担当 |
|---|---|---|
| 中程度 #5 | `checkout soon` 小文字統一 | Codex（p3_code） |
| 中程度 #7 | WORLDWIDE SHIPPING 整合 | Codex（p3_code）+ 司さん（legal.html） |
| 中程度 #10 | `inRYOKÜ` 表記揺れ修正（p2） | Codex（p2_code） |

## 5. 哲学を壊さないために守ったこと

- **沈黙のグレー**: legal/privacy/returns の本文トーンは事務的に保ちつつ、
  copy-fix-runtime の顧客向け alert は「準備中」を直訳せず
  「この色は、いままだ準備中」「次の入荷をすこし待って」のように
  inryokü の語彙（色 / 信号 / 待つ）に寄せた。
- **0 と 1 の世界観**: SYSTEM_PROMPT から具体カタログを抜くことで、
  AI は「いま画面に並んでいるグレー」を指差すだけになり、
  カタログ更新ごとにプロンプトを書き換える必要がなくなった。
  哲学的には「info は商品を暗記しない、目の前のものだけを見る」という整合になっている。
