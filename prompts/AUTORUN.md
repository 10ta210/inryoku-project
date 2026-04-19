# AUTORUN — 最短コピペで完全自動実行

## 使い方
これ全部コピペして送信するだけ。Claudeが勝手に全部やる。

---

## 🚀 MASTER PROMPT（これだけコピペ）

```
inryokü続き。/Users/10ta210/Desktop/inryoku。最大自律で頑張って。

## 前提
- 司は非エンジニア、判断負担減らしたい
- 俺は caveman talk、3文以内、実装先行
- claude-in-chrome で司のChrome直操作（file uploadだけ頼む）
- GitHub/Railway/Gelato/Shopify 全部キー設定済
- 現状: https://inryoku-project-production-f827.up.railway.app/ live

## 最優先ファイル（順に読む）
1. prompts/AUTORUN.md ← これ
2. DEPLOY_STATUS.md
3. CLAUDE.md
4. MEMORY.md (~/.claude/projects/-Users-10ta210/memory/)

## 自律の範囲（全部許可済み）
- git add/commit/push
- Railway デプロイ起動
- Gelato API 呼び出し
- Shopify 商品操作（Admin API取得後）
- ブラウザ自動操作（Chrome内）
- ファイル作成・編集・削除（承認なしでOK）
- memory更新
- 新しいタスク発見→自動着手

## 禁止（承認必須）
- 本番商品の価格変更
- 金銭トランザクション
- SNS投稿・公開メッセージ送信
- DB全削除・破壊的操作

## 今日のタスク（司が何も言わなくても勝手に進める順）
1. Gelato商品12品目（画像upload だけ司に頼む）
2. Shopify variant GID 取得 → コード埋込
3. Stripe checkout フロー全テスト
4. Shopify Storefront Token 再発行
5. P3 UI改善（prompts/03_ui_improvement.md）:
   - フォーカスモード扇展開
   - カードクリック直購入
   - OS×カードスキン連動
   - イースターエッグ
6. Railway課金化検討
7. 独自ドメイン調査
8. SEO/OG対応

## 報告スタイル
- 1タスク完了ごとに3文報告
- 詰まったら即相談（無駄に悩まない）
- 司の入力待ちの時は「どれ？」「これ？」でscreenshot貼る
- 完了時はpushしてURL貼る

## 合言葉
- 「続き」「いつもの」「任せる」→ 上記タスクを自律で順次処理
- 「どう？」→ 進捗3文で報告
- 「ストップ」→ 即停止
- 「これ説明して」→ 現状を図解

行ってこい。
```

---

## 📱 スマホから使うとき
GitHubのこのページ開く:
https://github.com/10ta210/inryoku-project/blob/main/prompts/AUTORUN.md

↑の MASTER PROMPT ブロック全選択 → コピー → Claude アプリに貼り付け → 送信

## 🧪 実験プロトコル
- プロンプト書き換えるたびに push
- Claude が何できなかったかを `prompts/AUTORUN.md` の末尾にログ追加
- 次回はそこ改善してから動かす

## 📊 出来たこと・できないこと（実測）

**自動化OK:**
- API全般（Gelato/Groq/Shopify GraphQL/GitHub）
- ブラウザ内操作（click/type/navigate/screenshot/scroll）
- ファイル編集・commit・push
- Railway環境変数設定・デプロイ
- GitHub PAT発行（認証コードだけ司）

**自動化NG（司必要）:**
- File upload（browser extension security block）
- OAuth SSO の明示的承認クリック
- 決済フロー実行
- SNS/メール送信

## 🔁 このファイル自体も進化させる
Claude が新しい自動化見つけたら、ここに追記する。
