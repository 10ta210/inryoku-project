# Codex Review Round 2 — 2026-04-30

対象:
- `/Users/10ta210/Desktop/inryoku_hp/index.html`
- `/Users/10ta210/Desktop/inryoku_hp/p3_test.html`
- `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js`
- `/Users/10ta210/Desktop/inryoku_hp/p3_styles.css`
- `/Users/10ta210/Desktop/inryoku_hp/server.js`
- `/Users/10ta210/Desktop/inryoku_hp/enhance.js`

方針:
- 高負荷時の失敗モード
- 公開前 blocker
- 既知設計の崩れや運用事故の起点

## Findings

### P0 — 認証トークンが依然として `localStorage` に残り、Cookie 化の意味が薄れている
- 該当箇所:
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1516`
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1526`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1486`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1524`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1611`
- 内容:
  - サーバは `HttpOnly` Cookie を発行していますが、同時に `token` をレスポンス JSON へ返し、クライアントはそれを `localStorage` に保存しています。
  - その後のプロフィール更新も `localStorage` 上のトークンを request body に載せて送っています。
- リスク:
  - 同一オリジン XSS、サードパーティスクリプト混入、拡張機能、共有端末などでトークンが即時に窃取され、Grey プロフィールの乗っ取りに直結します。
  - サーバ側で Cookie 移行を始めているのに、クライアント側が旧方式を維持しているため、防御が半端な状態です。
- 判定:
  - 公開前 blocker。

### P1 — `localStorage` の破損値 1 件で P3 初期化が落ちる
- 該当箇所:
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:372`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1708`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1726`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:4412`
- 内容:
  - `inryoku_cart` `inryoku.layers` `inryoku_chat_history` をトップレベルまたは通常フロー中で無防備に `JSON.parse` しています。
  - 破損値、旧バージョン値、手動編集値が 1 件あるだけで例外が飛び、復旧処理なしで Phase 3 の描画やチャット初期化が止まります。
- リスク:
  - 戻りユーザーだけが再現する壊れ方なので検知しづらく、本番で「一部ユーザーだけ画面が壊れる」系の障害になります。
  - 高負荷時ではなくても、サポートコストが高い障害です。
- 判定:
  - 公開前に潰したい高優先度不具合。

### P1 — チャットのエラー経路がクライアントで握り潰され、負荷時に静かに壊れる
- 該当箇所:
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1453`
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1457`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:5451`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:5458`
- 内容:
  - サーバは fallback 応答を `role: "system"` として返す設計ですが、クライアントは `response.ok` も `data.role` も `data.fallback` も見ていません。
  - そのため rate limit、4xx、fallback を区別できず、最終的に応答を assistant 発話として `chatHistory` に保存します。
- リスク:
  - 高負荷時に `/api/chat` が 429 や fallback を返しても、UI は単に曖昧な返答を出すだけで障害が表面化しません。
  - サーバ側で意図した「fallback を履歴汚染させない」設計が、クライアント側で無効化されています。
- 判定:
  - 高負荷レビュー観点では優先度高。

### P1 — `subscribe` / `contact` / `grey update` が同期ファイル I/O でイベントループを止める
- 該当箇所:
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1486`
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1514`
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1620`
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1640`
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1820`
  - `/Users/10ta210/Desktop/inryoku_hp/server.js:1824`
- 内容:
  - 各エンドポイントが `fs.readFileSync` / `fs.writeFileSync` で JSON 全体を毎回読み書きしています。
  - しかも request path 上で実行されるため、I/O 中は Node のイベントループが塞がります。
- リスク:
  - 登録・問い合わせ・プロフィール保存が増えるほど、同居している `/api/chat` や `/api/checkout` の待ち時間にも直接波及します。
  - データ件数が増えるほど 1 回の書き込みコストも増える、劣化型のボトルネックです。
- 判定:
  - トラフィックを受ける前提なら要対処。

### P2 — モバイル本番導線が `p3_test.html` に依存し、公開面と検証面が分離できていない
- 該当箇所:
  - `/Users/10ta210/Desktop/inryoku_hp/index.html:1365`
  - `/Users/10ta210/Desktop/inryoku_hp/index.html:1375`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_test.html:13`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_test.html:23`
- 内容:
  - `index.html` はモバイル UA を `p3_test.html` へリダイレクトしています。
  - 一方で `p3_test.html` 自体は `robots=index,follow` と canonical を持つ公開ページです。
- リスク:
  - 本番モバイル体験が「test」ファイル名のページに直結しており、検証用 URL と公開用 URL の責務分離が崩れています。
  - ルーティング、解析、SEO、障害切り戻しの運用が不安定になります。
- 判定:
  - 即死バグではないが、公開運用上かなり悪い。

### P2 — 外部 `target="_blank"` に `rel="noopener"` が付いていない
- 該当箇所:
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1754`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1755`
- 内容:
  - X と Instagram のリンクが `target="_blank"` ですが `rel="noopener"` がありません。
- リスク:
  - 逆タブナビングの余地が残ります。
  - 同ファイル内の法務リンクでは `rel="noopener"` を付けているため、実装が不統一です。
- 判定:
  - 低コストで塞げる公開前修正候補。

### P2 — 商品データを `innerHTML` に直接差し込む構造で、将来の供給源変更に弱い
- 該当箇所:
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1277`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1287`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:1291`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:6327`
  - `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js:6449`
- 内容:
  - 商品名、画像 URL、説明文などがテンプレート文字列経由で `innerHTML` に流し込まれています。
  - 現状は定数配列ベースに見えますが、将来 CMS や外部 API に寄せた瞬間に DOM XSS 面になります。
- リスク:
  - 今回の auth token の `localStorage` 保存と組み合わさると、XSS の被害が即アカウント乗っ取りへ拡大します。
- 判定:
  - 今すぐ爆発していないが、設計上の危険点として明示すべき。

## 総評

最大の問題は、認証まわりが「Cookie 移行途中の中途半端な状態」で止まっている点と、クライアントの永続データ破損耐性が低い点です。高負荷レビューとしては、サーバの同期ファイル I/O とチャット失敗時の静かな劣化も無視できません。

公開前に最低限止めるべきなのは以下です。
- `localStorage` の認証トークン依存をやめる
- `localStorage` 読み出しの破損耐性を入れる
- `/api/chat` の fallback / 4xx / 429 をクライアントで正しく扱う
- 同期ファイル I/O を request path から外す、または少なくとも保存経路を分離する

## 変更ファイル
- `/Users/10ta210/Desktop/inryoku_hp/docs/codex-review-round2-2026-04-30.md`

## 検証内容
- `node --check /Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js`
- `node --check /Users/10ta210/Desktop/inryoku_hp/enhance.js`
- `node --check /Users/10ta210/Desktop/inryoku_hp/server.js`
- `rg` と `nl -ba` で対象 6 ファイルの該当実装・行番号を確認
