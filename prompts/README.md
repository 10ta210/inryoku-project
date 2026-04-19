# prompts/ — 司さん用プロンプト集

## 使い方
新しいClaudeセッション始めるとき、対応するプロンプトをコピペする。
`00_session_start.md` は毎回最初に使う。その後、タスクに応じて 01〜 を選ぶ。

## 一覧

| ファイル | 場面 |
|---|---|
| `00_session_start.md` | 新セッション開始時、毎回 |
| `01_gelato_product_create.md` | Gelatoで商品作る時 |
| `02_shopify_variant_sync.md` | Gelato→Shopify同期後、コードに埋込 |
| `03_ui_improvement.md` | UI改善する時 (codex議論で決定した方針) |

## 追加ルール
- 新しいタスクが出てきたら `04_*.md`, `05_*.md` と番号振って追加
- 古くなったプロンプトは `_archived/` に移動
- 毎回 `00_session_start.md` → タスク別プロンプト の順でコピペ

## Chrome で Claude 使う場合
claude.ai/code (Web版) や Claude Mobile アプリから同じプロンプトが使える。
GitHubリポから直接 `prompts/` ディレクトリを参照してもらえばOK。
