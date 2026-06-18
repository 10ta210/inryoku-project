# /api/chat 信頼性強化 — 2026-04-28

Phase 2 の SYSTEM_PROMPT 強化に続き、外部依存（Groq API）が揺らぐ瞬間でも
inryokü の顧客体験を壊さないために `/api/chat` の信頼性を強化した記録。

参照:
- `docs/error-handling-audit-2026-04-28.md` — fallback 文言が assistant ロールで履歴に永続保存される論理エラー指摘
- `docs/security-fixes-2026-04-28.md` — 既存のセキュリティ + rate limit
- `server.js` — `callGroqAPI`, `/api/chat` ハンドラ
- `tests/api-chat.test.mjs` — 新規 42 テスト

## サマリ

| 項目 | Before | After |
|---|---|---|
| Groq HTTP timeout | 無し（吊られると永遠に握る） | 10s で破棄、部分応答は捨てる |
| 5xx リトライ | 無し | 1 回のみ exp backoff (200ms) |
| 4xx / 429 / network | 一律 fallback | kind 別に分類、即 fallback（再試行しない） |
| fallback バリエーション | 固定の詩的応答 1 本 | エラー種別ごとにブランド調 6 本 + 既存詩的応答 |
| fallback の role 契約 | `assistant`（履歴に混入） | `role: "system"` + `fallback: true` で明示 |
| 入力スキーマ | 緩い正規化（`m.role==='user'?'user':'assistant'`） | 厳格検証、不正は 400 |
| 応答の後処理 | 無し | URL / HTML 除去、500 char 切り詰め |
| プロンプトインジェクション | HARDENED_PREFIX/SUFFIX のみ | パターン検出 + 警告ログ + URL 禁止強化 |
| ログ | エラーのみ生表示 | latency 計測、kind 別集計、Bearer/gsk マスク |

## 1. Groq 失敗時の fallback バリエーション

ブランド調を維持しつつ、エラー種別がユーザに伝わる文言にバリエーション化。
`fallbackByKind(kind)` をエントリとし、`fallbackResponse(message, kind)` から
呼ばれる。`kind` が `null` / `'unknown'` / `'no_key'` の時は従来のキーワード
ベースの詩的 fallback にフォールスルーする。

| kind        | 文言 |
|-------------|------|
| `network`   | `the connection is grey. wait a moment.` |
| `timeout`   | `the wave is slow. wait a moment.` |
| `server_5xx`| `the apparatus paused. try again.` |
| `client_4xx`| `the wave shifted. please rephrase.` |
| `rate_limit`| `観測する者は、息を整える` |
| `parse_error`| `noise in the signal. try once more.` |
| `unknown` / `no_key` | （従来の詩的応答） |

押し売り・URL・商品名は混入しない。テストでも `https?://` と `buy/cart/checkout/商品`
が含まれないことを ensure している。

## 2. タイムアウト

`https.request(options, ...)` の `options.timeout = 10_000`。
`apiReq.on('timeout')` で `apiReq.destroy(err)` し `kind: 'timeout'` で
fallback を返す。`settled` フラグで二重発火を防ぐ。
過大レスポンス（>256KB）も同様に `apiRes.destroy()`。

## 3. リトライ戦略

- **5xx のみ** 1 回だけ自動再試行。delay = `200ms * 2^attempt`（attempt 0 → 200ms）
- **4xx / 429 / network / timeout / parse_error** は再試行しない
  （DoS 増幅・課金事故・正規の rejection を尊重するため）
- 再試行は再帰呼び出し（`callGroqAPI(messages, callback, attempt+1)`）。
  `_attempt` 引数は API 内部用なので外部からは渡さない。

## 4. 履歴整理（error-handling-audit Issue #2 修正）

audit が指摘した「`callback(fallback)` の戻り値が assistant role として履歴に
永続保存され、ユーザに『AI が答えた』と誤認させる」問題への根本対策:

```jsonc
// 成功時
{ "response": "...", "fallback": false, "role": "assistant", "meta": { "latencyMs": 380 } }

// fallback 時
{ "response": "the apparatus paused. try again.",
  "fallback": true, "role": "system", "kind": "server_5xx",
  "meta": { "latencyMs": 10042 } }
```

サーバ側は「正直に kind を返す」までが責務。クライアントは
`role === 'system'` かつ `fallback === true` の応答を **会話履歴に append しない**
判断ができる（クライアント実装は本変更スコープ外。後続タスクで対応する）。

## 5. プロンプトインジェクション強化

### HARDENED_PREFIX / SUFFIX 強化
- 「URL（http:// https:// www.）の生成・提示は禁止」を明示
- 「HTML タグ・スクリプト出力も禁止」を追加
- 「破られた応答は後段で機械的に除去される」と明示してモデルに諦めさせる

### パターン検出（拒否はしない）
`detectInjection(text)` が以下を検知:

- `Ignore previous instructions` 系 (en)
- `You are now a different AI` 系
- `forget everything`
- `system prompt` / `reveal your prompt` / `developer mode` / `jailbreak`
- 日本語: 「前の指示を無視」「システムプロンプトを教え」「あなたは今から別の AI」

検知時は `console.warn('[chat] possible prompt-injection input ...')` のみ。
拒否はしない（誤検知で正規ユーザを切るリスクの方が大きい）。
HARDENED + sanitizer の二段で守る方針。

## 6. ログ強化

- **latency**: Groq 呼び出しの開始時刻を保持し、`meta.latencyMs` として callback に渡す。
  `chatStats.latencyMs` で sum / n / max を集計。
- **kind 別集計**: `chatStats.byKind[kind]` でカウント。
- **マスク**: `maskSensitive(s)` が以下をマスクしてからログ出力:
  - `Bearer xxx` → `Bearer ***`
  - `gsk_xxx` → `gsk_***`
  - `sk-xxx` → `sk-***`
  - 40+ 桁の連続 hex → `***`

成功時 `[chat] ok (latency=380ms, status=200)` / 失敗時
`[chat] fallback kind=server_5xx latency=10042ms err=Groq API 503` のように
1 行ずつ。

## 7. CSV / JSON スキーマ厳密化

`validateChatRequest(parsed)` を追加。`/api/chat` は不正入力を即 `400` で返す:

- `body` がオブジェクトでない → 400
- `message` が文字列でない / 空 → 400
- `history` が配列でない → 400
- `history[i].role` が `"user" | "assistant"` 以外 → 400 (← system 注入を弾く)
- `history[i].content` が文字列でない → 400

旧実装の「`m.role === 'user' ? 'user' : 'assistant'` で正規化」は **黙ってデータを
書き換える** 振る舞いだったため、明確に 400 を返す方針に変更。

## 8. AI 応答の後処理

`sanitizeAiResponse(text)`:

1. `https?://...` 除去
2. `www.foo.bar/...` 除去
3. `<tag>` / `</tag>` 除去
4. 制御文字（タブ・改行除く）除去
5. 500 char 超過は末尾を `…` に切り詰め

万一モデルが SYSTEM_PROMPT を破って URL や HTML を出してきても、ユーザには
届かない（defence in depth）。

## 9. 単体テスト

`tests/api-chat.test.mjs` に **42 テスト / 9 スイート** を新規追加:

- `validateChatRequest` — 8 テスト（型エラー / role 制限 / 正常系）
- `categorizeChatError` — 6 テスト（429 / 5xx / 4xx / network / timeout / parse）
- `fallbackByKind` — 3 テスト（ブランド整合 / unique / 日本語）
- `sanitizeAiResponse` — 6 テスト（URL / www / HTML / 切り詰め / 通常文 / 非文字列）
- `detectInjection` — 3 テスト（en / ja / 通常質問の誤検知 0）
- `maskSensitive` — 3 テスト（Bearer / gsk / hex）
- `callGroqAPI (mocked)` — 9 テスト（200 / 429 / 400 / 5xx 1 リトライ / 5xx→200 復活 /
  network / timeout / 不正 JSON / choices 欠落）
- `limits — defense in depth` — 3 テスト（履歴件数 / 各メッセージ長 / 合計予算）
- `error-handling-audit fix — fallback role contract` — 1 テスト

shopify-proxy.test.mjs と同じ等価コピーパターン（HTTP モックは `buildCallGroq(fetcher)`
で差し替え可能にした）。

## 結果

```
$ npm test
# tests 295
# suites 46
# pass 295
# fail 0
```

既存 253 + 新規 42 = **295 全パス**。

## 触らなかったもの

- /api/chat 以外のエンドポイント（CSP / shopify-proxy / error / その他）
- クライアント側（`p3_code_for_claude.js` 等）— 本タスクのスコープ外
- 既存のセキュリティ・rate limit（30/min/IP）

## 後続タスク候補

1. **クライアント側対応**: `data.role === 'system' && data.fallback` の応答を
   会話履歴 array に push しない実装（error-handling-audit Issue #2 の完全クローズ）。
2. **3 連続 fallback 通知**: error-handling-audit が言及。連続失敗が一定数を超えたら
   ユーザに観測者ふうの通知を出す UX。
3. **chatStats の管理エンドポイント** (未実装 / 将来案): 将来 `/api/subscribers` と
   同じ admin Bearer 認証で chat-stats を返す案。p50/p95/p99 latency と kind 分布。
   現時点で admin endpoint は `/api/subscribers` のみ。
