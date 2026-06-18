# inryokü Error Handling & Recovery UX Audit

> **Audit date**: 2026-04-28
> **Scope**: 全 .js / .html / server.js / sw.js / register.js / i18n.js / enhance.js / particle_*.js / 法定ページ
> **Auditor mandate**: 読み取りのみ。実装変更は含まず、提案ドキュメントとして残す。
> **Brand voice anchor**: `grey / 50 → 101 / 観測者 / 見えないものの可視化`
> **Cross-refs**:
> - docs/accessibility-audit-2026-04-28.md
> - docs/browser-compatibility-matrix-2026-04-28.md
> - docs/security-review-2026-04-28.md
> - docs/copy-audit-2026-04-28.md
> - docs/pwa-sw-2026-04-28.md
> - docs/mobile-ux-flow-2026-04-28.md

---

## 目次

1. [エクゼクティブサマリ — 致命的なエラー UX 問題 5 件](#1-エクゼクティブサマリ)
2. [エラーパス全リスト（73 件）](#2-エラーパス全リスト)
   - 2.1 ネットワーク失敗 (E-N01〜E-N18)
   - 2.2 ユーザー入力エラー (E-U01〜E-U12)
   - 2.3 認証・権限エラー (E-A01〜E-A08)
   - 2.4 状態異常 (E-S01〜E-S14)
   - 2.5 互換性エラー (E-C01〜E-C10)
   - 2.6 論理エラー (E-L01〜E-L11)
3. [alert() 全使用箇所と改善案](#3-alert-全使用箇所と改善案)
4. [ブランドボイスに合うエラー文言 50 個](#4-ブランドボイスに合うエラー文言-50-個)
5. [リカバリ UX 設計（リトライ / オフライン / 部分機能）](#5-リカバリ-ux-設計)
6. [グローバル error handler 設計案](#6-グローバル-error-handler-設計案)
7. [司さんが実機テストすべきエラー再現手順 30 件](#7-実機テスト手順-30-件)

---

## 1. エクゼクティブサマリ

### 1.1 致命的な問題ベスト 5

| # | 問題 | ファイル / 行 | 影響 |
|---|------|---------------|------|
| **1** | `alert()` 4 箇所がカートチェックアウトの失敗時に発火し、`<dialog>` でも `aria-live` でもない OS 標準のブロッキングダイアログで世界観を破壊する | `p3_code_for_claude.js:5170, 5182, 5198, 5204` | 致命的（Brand voice） |
| **2** | チャット送信失敗時の "波が揺れた。もう一度、話しかけて" は文言は良いが、`callback(fallback)` で **assistant role として履歴に保存**されるため、ユーザに「AI が答えた」と誤認させ、リトライ手段が無い | `p3_code_for_claude.js:4727-4731` | 致命的（UX 機能性） |
| **3** | `/api/checkout` の Shopify 未マップ商品が 200 で `{error}` を返す欠陥仕様。クライアントは `r.ok` を見て処理するため、200 + error 文字列で `data.url` 不在 → `alert(data.error)` が出るまで気付かない | `server.js:577-579, 587-590` ↔ `p3_code_for_claude.js:5188-5208` | 致命的（プロトコル整合性） |
| **4** | フォントロード失敗（Google Fonts CDN 502 等）に対するフォールバックフォントの指定が `index.html:73` に依存。SW 側で Google Fonts は cross-origin なので **キャッシュ対象外** → オフライン時に `Inter / Press Start 2P` が黒い空白のまま (FOIT) | `sw.js:150` の `url.origin !== self.location.origin` パススルー | 高（Brand voice / オフライン UX） |
| **5** | `fetch('/api/grey/' + num + '/update')` 等が **無言で失敗**するパスが複数。ネットワークエラー時 `st.textContent = 'network error'` のみで、リトライボタンも背景同期もなし | `p3_code_for_claude.js:1541-1544` | 高（リカバリ性） |

### 1.2 構造的所見

- **alert() 廃止すべき箇所が 4 件**（実 2 ファイル）。既に `cart-toast` 機構が `p3_code_for_claude.js:2079-2101` に存在するため、流用するだけで Brand voice 整合は容易。
- **ロード状態が永続化するリスク**: `btn.textContent = 'PROCESSING...'` で `disabled` を真にしてから fetch 失敗 → catch で復元しているが、`r.json()` 段階で throw した時（5xx HTML 応答 → JSON parse 失敗）に **catch までは流れる**ので OK。ただし `await` が無いため **コルーチンが他の場所で死んだ**ケース（例: タブをバックグラウンドにして throttling される）では復元されない可能性あり。
- **toast / aria-live の使い分け不統一**: `cart-toast` は視覚のみ（aria-live なし）。emailSignup の status は `<div class="email-signup-status">` で aria-live 不在。スクリーンリーダがエラーを拾わない。
- **Service Worker のオフライン体験**は `offline.html` が良いが、**SPA のサブパス（/p3_test.html, /grey/123 等）に navigate した時のオフラインフォールバックが i18n 未対応**。`offline.html` は ja のみハードコード。
- **rate limit の UX**: `checkRate` で 429 を返すが、クライアントは fetch で `r.json()` を呼び、`{ error: '...' }` を `alert` するだけ（または status の `r.ok` 分岐で握り潰す）。残り何分待てば良いかの hint が無い。
- **prompt injection mitigations は実装済み**（server.js:302-308 の HARDENED_PREFIX/SUFFIX）が、injection が検出された時の応答ループは設計されておらず、AI が「はい、忘れます」と返すリスクは server-side 側に頼り切り。
- **WebGL コンテキストロス（OS GPU リセット / context lost イベント）の handler が無い**。`renderer6.domElement` 上で `webglcontextlost` を listen していない。

---

## 2. エラーパス全リスト

> **凡例**:
> - 行番号は読み取り時点（2026-04-28）。
> - 「現状」は実コード挙動。「改善案」は Brand voice + UX 双方を勘案した推奨。
> - 推測（実機未検証）は **[推測]** タグを付与。

### 2.1 ネットワーク失敗（E-N01〜E-N18）

#### E-N01 — Shopify Storefront API 直接接続失敗（client → shopify domain）
- **発生条件**: クライアントから `https://<storeDomain>/api/<ver>/graphql.json` への fetch が DNS / TLS / 5xx で失敗（CDN downtime / 顧客のキャプティブポータル経由）。
- **コード**: `p3_code_for_claude.js:154-166` の `shopifyFetch()` → `:185-190` で `data.data.cartCreate` 不在時 `throw`。
- **現状の挙動**: `:5181-5185` の `.catch(function(err) { alert('Checkout error: ' + err.message); })`。
- **ユーザー体験**: OS の `alert()` が出る。Brand voice 完全破壊。エラー message は英語混じり。
- **改善提案**: `cart-toast` を流用し、`role="alert"` の固定下部 toast に「the connection is grey — try again」。リトライボタンを inline で再表示。
- **ブランドボイス案**: 「the signal flickered. observe again.」 / 「波が揺れた。もう一度。」

#### E-N02 — `/api/checkout` プロキシ経由失敗（server upstream error）
- **発生条件**: Shopify 設定済みで Variant 未マップ (`server.js:587-590`)、または upstream 502 (`:625-630`)。
- **現状**: 502 で `{ error: 'upstream unavailable' }` 返却 → `:5198` で `alert(data.error || 'Checkout not ready yet')`。
- **改善案**: 200/error は禁止し全て `4xx/5xx + JSON{ code, message_ja, message_en, retryable }` に統一。クライアント側は `code` で分岐。
- **文言**: 「checkout が未観測。少し時間をあけてもう一度。」

#### E-N03 — Gelato API キー未設定
- **発生条件**: `process.env.GELATO_API_KEY` 不在 (`server.js:642-645`)。
- **現状**: 200 + `{ error: 'Gelato not configured' }`（200 で error 返すアンチパターン）。
- **改善案**: 503 + `{ code: 'config_missing' }`。
- **文言（観測者向け）**: 「製造ラインがまだ目を覚ましていない。」

#### E-N04 — Gelato API upstream 5xx / network down
- **コード**: `server.js:692-700`。
- **現状**: 502 + `{ error: 'order failed' / 'upstream unavailable' }`。クライアント `gelatoCreateOrder` (`p3_code_for_claude.js:134-151`) は `r.json()` を返すだけで、エラー UI が**呼び出し側に存在しない**。
- **改善案**: `gelatoCreateOrder` の戻り値に `ok` フラグを必ず含め、呼び出し側が toast を出す。

#### E-N05 — AI チャット (Groq) API キー欠如
- **発生条件**: `GROQ_API_KEY` 未設定 → server.js が `fallbackResponse` を返す（推測 — readBody 内で fallback 経路あり）。**[推測]**
- **現状**: クライアント側は `data.fallback === true` を見ない。
- **改善案**: `data.fallback === true` の時は粒子色をニュートラルにする / aria-live polite で「観測者は静かに見ている」のような演出。

#### E-N06 — Groq API 5xx / rate limit
- **コード**: `server.js:341-356`、`:740-751`。
- **現状**: `aiText` 不在時 `fallbackResponse(userMsg)` を返し `fallback: true`。クライアントは `data.response || '……'` で表示するため fallback がそのまま流れる。
- **改善案**: 透過的 fallback は良いが、**3 連続 fallback でユーザに通知**。

#### E-N07 — `/api/chat` ネットワーク完全断
- **コード**: `p3_code_for_claude.js:4725-4733`。
- **現状**: `'波が揺れた。もう一度、話しかけて'` を assistant メッセージとして履歴に **永続保存** → 次の API 送信時にも会話履歴に混ざる。
- **改善案**: 履歴に push しない。代わりに UI 上の error bubble（再送ボタン付き）として表示。`aria-live="assertive"`。

#### E-N08 — 商品画像読み込み失敗
- **コード**: `p3_code_for_claude.js:1283` の `onerror` インライン。
- **現状**: 親要素の innerHTML を `<div>` の頭文字に置換 → **イベントリスナーごと消える**ため、その後カードクリックで動かない可能性。
- **改善案**: `<img onerror>` で `this.replaceWith(...)` ではなく、隣の placeholder div を表示し img は `display:none`。
- **文言**: 「画像は静かに。」

#### E-N09 — フォント (Google Fonts) 読み込み失敗
- **発生条件**: `fonts.googleapis.com` 502 / 顧客環境で blocked（中国本土 / 一部企業 NW）。
- **コード**: `index.html:67-74`。
- **現状**: FOIT。`font-family` フォールバックは `-apple-system, BlinkMacSystemFont` なので OS 標準には倒れる。**ただし `Press Start 2P` の代替が無い** → success.html の H1 は OS 標準で表示される。
- **改善案**: `vendor/fonts/press-start-2p.woff2` は既に preload されている (`index.html:85`) ため、`@font-face` で local fallback を保証。

#### E-N10 — Three.js (vendor) スクリプト読み込み失敗
- **コード**: `p3_code_for_claude.js:2699`。
- **現状**: `if (typeof THREE === 'undefined') { console.error('[P3] Three.js required'); return; }`。**ユーザに何も表示されない**。
- **改善案**: `<noscript>` 同様、root コンテナに「観測装置が起動できません」と静かな grey orb（offline.html の orb 流用）。

#### E-N11 — particle スクリプト 404
- **コード**: `register.js:38` (`/^\/particle_[\w]+\.(?:js|css)$/`)。
- **現状**: SW がキャッシュにあれば返す。なければ素通り → 404。クライアント側ハンドラなし。
- **改善案**: 失敗時は no-op stub で継続動作（`enhance.js` 内の polyfill 路線と統一）。

#### E-N12 — SW fetch 失敗 → offline.html フォールバック
- **コード**: `sw.js:212-219`。
- **現状**: HTML navigation 失敗時のみ offline.html を返す。**API 失敗時は JSON `{error:'offline'}` のみ**。
- **改善案**: チャット API オフライン時にクライアントが `{error:'offline'}` を検出し、grey orb を chat 内に inline 表示。

#### E-N13 — `/api/subscribe` 失敗
- **コード**: `p3_code_for_claude.js:1584-1624`、`server.js:757-819`。
- **現状**: `if (!res.ok) throw new Error('登録に失敗しました')` のみ。**HTTP 状態コードで分岐していない** ため `409 already subscribed` も `500 サーバエラー` も同じ文言。
- **改善案**:
  - 409 → 「すでに観測されている。Grey #XXXX として再ログインしますか？」
  - 5xx → 「サーバが沈黙している。波を待つ。」
  - timeout → 「signal in transit. observed in 5s.」（リトライボタン）

#### E-N14 — `/api/contact` 送信失敗
- **コード**: `p3_code_for_claude.js:1665-1683`。
- **現状**: `'送信に失敗しました'` 一行のみ。下書き保持なし → ユーザがリロードすると入力消失。
- **改善案**: 失敗時 `localStorage.setItem('inryoku.contact_draft', ...)` で下書き永続化、同フォーム再 mount 時に復元。

#### E-N15 — `/api/grey/:n/update` 失敗
- **コード**: `p3_code_for_claude.js:1541-1544`。
- **現状**: `st.textContent = 'network error'`。リトライ手段なし。チェックボックス変更が反映されたかどうか不明瞭。
- **改善案**: 楽観的更新は外し、`st` を `aria-live="polite"`、リトライボタン inline。

#### E-N16 — `/api/ref/track` 失敗（QR スキャン記録）
- **コード**: `p3_code_for_claude.js:1029-1041`。
- **現状**: `.catch(function(e) { console.warn('[inryokü] Ref tracking failed:', e); })` で**サイレント**。
- **改善案**: 影響度トラッキング失敗はユーザに見せなくて良いが、**localStorage に未送信キューを積み**、次回 visit で `navigator.sendBeacon` 再送。

#### E-N17 — i18n 辞書 (i18n.json) 取得失敗
- **コード**: `i18n.js:71-75`。
- **現状**: `console.warn` のみ、`state.dict = {}` で ja-only fallback。
- **改善案**: 日本語が 1st language なので妥当。ただし en URL (`?lang=en`) 直リンクで来た訪問者には `<html lang="en">` だが本文 ja の不整合が残る → 言語トグル UI に「dictionary unobserved — JA only」のヒント。

#### E-N18 — BGM (audio file) ロード失敗
- **コード**: `p3_code_for_claude.js:1196-1219`。
- **現状**: try/catch で console.warn。再生は autoplay policy で blocked される可能性大。
- **改善案**: 必須機能ではないので silent OK。ただし「mute」アイコンの状態が `_inryokuMuted` と乖離するケースがあるので、ロード失敗時は mute 状態を強制反映。

---

### 2.2 ユーザー入力エラー（E-U01〜E-U12）

#### E-U01 — 不正なメールアドレス（subscribe）
- **コード**: `p3_code_for_claude.js:1575-1579`。
- **現状**: クライアントは `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` で簡易検証 → `'メールアドレスを正しく入力してください'`。サーバも同正規表現 (`server.js:768`)。
- **改善案**: メッセージは可。ただし入力中に `@` 入力時点でも red になり続けるので、blur 時のみ検証する。

#### E-U02 — 必須フィールド未入力（contact）
- **コード**: `p3_code_for_claude.js:1658-1662`、`server.js:1049-1052`。
- **現状**: `'全項目を入力してください'`。どのフィールドが空か示さない。
- **改善案**: 各 input に `aria-invalid` を付け、ラベル下に「name が観測されていません」等の個別メッセージ。

#### E-U03 — サイズ未選択でカートイン
- **コード**: `p3_code_for_claude.js:2076`。
- **現状**: `(p.sizes.length > 1 ? p.sizes[1] : p.sizes[0])` を**勝手にデフォルト**として採用。ユーザは選んでいない。
- **改善案**: 未選択なら toast 「サイズを観測してから。」を出して止める（黙って M を入れない）。

#### E-U04 — 文字数超過（bio 200, contact message 2000）
- **コード**: `p3_code_for_claude.js:1502` の `maxlength="200"` / server `server.js:923, 1053-1056`。
- **現状**: HTML maxlength で入力制限済み。`server.js:1053` で 100/2000 超過は 400。
- **改善案**: bio counter UI（「あと N 文字」）。

#### E-U05 — 不正な JSON / payload（chat history が array でない）
- **コード**: `server.js:726`。
- **現状**: `Array.isArray(parsed.history) ? parsed.history : []` で安全に握り潰し。
- **改善案**: 妥当。

#### E-U06 — `/api/contact` の email 形式不正
- **コード**: `server.js:1057-1060`。
- **現状**: 400 + `'メールアドレスの形式が不正です'`。クライアントは `throw new Error('送信に失敗しました')` で詳細メッセージを捨てる。
- **改善案**: クライアント `.then((r) => r.json().then(j => ({ok: r.ok, ...j})))` でサーバ message を尊重。

#### E-U07 — `parseInt(parsed.number)` で NaN
- **コード**: `server.js:831-836`。
- **現状**: `if (!num || !token)` で 400。OK。
- **改善案**: 妥当。

#### E-U08 — `/api/ref/track` で ref 形式不正
- **コード**: `server.js:498-501`。
- **現状**: `/^ir_[a-z0-9]{4,32}$/` 不一致なら 400 + `'{}'`。
- **改善案**: 妥当（QR は user-facing でないので OK）。

#### E-U09 — チャット入力空文字
- **コード**: `p3_code_for_claude.js:4761`。
- **現状**: `if (!input || !msgs || !input.value.trim()) return;`。サイレントに無視。
- **改善案**: 妥当（押せても何も起きないだけ）。

#### E-U10 — チャット入力で巨大文字列（コピペ攻撃）
- **コード**: なし（クライアント制限なし）。
- **現状**: server 側 `MAX_CHAT_MSG_LEN` で truncate (`server.js:724`)。
- **改善案**: `<textarea maxlength>` を chat-input に付与。

#### E-U11 — bio に HTML / script タグ注入試行
- **コード**: `p3_code_for_claude.js:1502` の `${bio.replace(/</g, '&lt;')}` のみ。属性出力では unsafe。
- **現状**: textarea 内では問題なし。一方 `/grey/:n` HTML レスポンス側は `escapeHTML` で全エスケープ (`server.js:960`)。
- **改善案**: クライアント側でも DOM 直挿入時には `textContent` 推奨。

#### E-U12 — チャット内コマンド (`parseUniverseCommand`) 不正
- **コード**: `p3_code_for_claude.js:4781`。
- **現状**: 正常パースで universeFeedback 文字列を返す、不一致なら null。エラー UI なし。
- **改善案**: 妥当。

---

### 2.3 認証・権限エラー（E-A01〜E-A08）

#### E-A01 — admin token 不正
- **コード**: `server.js:431-456`。
- **現状**: 401 + `{ error: 'Unauthorized' }`、timing-safe compare。
- **改善案**: 妥当。鍵漏洩防止のため `WWW-Authenticate` ヘッダは付けず（既に未付与）。

#### E-A02 — admin 未設定 (`ADMIN_API_KEY` 不在)
- **コード**: `server.js:432-441`。
- **現状**: 503 + `{ error: 'admin not configured' }`。Dev bypass は明示変数のみ。
- **改善案**: 妥当。

#### E-A03 — `/api/grey/:n/update` token 不正
- **コード**: `server.js:918-921`。
- **現状**: 403 + `{ error: 'invalid token' }`、timing-safe。
- **改善案**: クライアント側 `data.error` を表示する文言を「観測者として認証されていません。あなたの番号と token をもう一度。」に。

#### E-A04 — token 未送信
- **コード**: `server.js:903-906`。
- **現状**: 401 + `{ error: 'token required' }`。
- **改善案**: 妥当。

#### E-A05 — `/api/grey/cookie` で credentials 不正
- **コード**: `server.js:841-844`。
- **現状**: 403 + `{ error: 'invalid credentials' }`。
- **改善案**: 妥当。

#### E-A06 — rate limit 超過 (generic 60/min)
- **コード**: `server.js:487-489`、`checkRate` 実装。
- **現状**: `checkRate` が false を返した時のレスポンスは未確認（推測: 429 + `{error}`）。**[推測]**
- **改善案**: クライアントが 429 を検出したら「観測の波がまだ落ち着いていない。少し静かにしてから。」と toast、Retry-After ヘッダを尊重した自動再送。

#### E-A07 — checkout rate limit (20/min)
- **コード**: `server.js:574-575`。
- **改善案**: 同上。`localStorage` の最終 checkout 時刻を持ち、フロントでも throttle。

#### E-A08 — chat rate limit (30/min)
- **コード**: `server.js:710-711`。
- **改善案**: 30/min に到達するユーザは恐らく自動化。一般ユーザに刺さる UI 不要だが、刺さった時の文言は「あなたの観測が早すぎる。世界が追いつくまで」。

---

### 2.4 状態異常（E-S01〜E-S14）

#### E-S01 — WebGL コンテキスト失敗（`new WebGLRenderer` throw）
- **コード**: `p3_code_for_claude.js:2711`。`init3DLogoSphere` は `:436-772` で try/catch あり、PNG にフォールバック。
- **現状**: ロゴ球体は OK。粒子宇宙 (`initParticleUniverse`) は `:1326-1328` の try/catch で `console.error` のみ → **背景が黒のまま**。
- **改善案**: catch 時に grey orb + offline 風の poetic スピナーを root に出す。

#### E-S02 — WebGL コンテキストロス（GPU リセット）
- **コード**: なし。
- **現状**: `webglcontextlost` event listener なし → 黒画面のまま。
- **改善案**: `renderer6.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); /* show grey orb */ })`、`webglcontextrestored` で再 init。

#### E-S03 — AudioContext 作成失敗
- **コード**: `p3_code_for_claude.js:402-409`、`:2116`、`:2189`、`:2286`、`:2906`、`:5337`、`p1_code_for_claude.js:667`。
- **現状**: try/catch で握りつぶし。サウンドなし動作可。
- **改善案**: 妥当。

#### E-S04 — AudioContext suspended（autoplay policy）
- **コード**: `enhance.js:145-181`。
- **現状**: ユーザー gesture で resume、複数 ctx を一括処理。
- **改善案**: 妥当。

#### E-S05 — localStorage アクセス拒否（プライベートモード）
- **コード**: 多数。`p3_code_for_claude.js:3776`、`i18n.js:46`、`register.js:43-47`。
- **現状**: try/catch でサイレントスキップ。読み出し時も `null` チェックあり。
- **改善案**: Grey 番号が永続化できないと「Grey #XXXX のあなた」が再訪時に消える。**初回登録時に「プライベートモードでは番号が記録できません」と一回だけ通知**。

#### E-S06 — localStorage 容量超過 (QuotaExceededError)
- **コード**: try/catch で握り潰し。
- **現状**: 静かに失敗。chat history は `slice(-20)` で制限済 (`p3_code_for_claude.js:3776`)。
- **改善案**: 妥当。

#### E-S07 — Service Worker 登録失敗
- **コード**: `register.js:214-216`。
- **現状**: `console.warn`、UX 影響なし。
- **改善案**: 妥当。ただし HTTPS でない環境（http://localhost 以外）では諦める実装になっており妥当。

#### E-S08 — Service Worker scope 範囲外
- **発生条件**: `/sw.js` を `/grey/123` 等から register しようとした場合。
- **現状**: register.js は `/sw.js` を `/` scope で登録するため OK。
- **改善案**: 妥当。

#### E-S09 — DeviceOrientation permission 拒否（iOS）
- **コード**: `enhance.js:194-198`。
- **現状**: `console.log`、機能無効化のみ。
- **改善案**: パララックスやジャイロ依存の演出が「動かない」だけで黙って劣化。問題なし。

#### E-S10 — IntersectionObserver 不在（古い Safari）
- **コード**: `enhance.js:50-76` の polyfill は `ResizeObserver` のみ。`IntersectionObserver` は未 polyfill。
- **現状**: 古いブラウザでは粒子の lazy 起動 (`p3_code_for_claude.js` 内で IO 使用箇所あり) が機能しない。
- **改善案**: `enhance.js` に IntersectionObserver の no-op shim を追加。

#### E-S11 — `requestIdleCallback` 不在
- **コード**: 検索で hit せず（推測）。
- **改善案**: 必要なら `setTimeout(fn, 1)` shim。

#### E-S12 — performance.now / requestAnimationFrame 不在（極古）
- **コード**: なし。
- **改善案**: 不要（現代ブラウザ前提）。

#### E-S13 — `crypto.timingSafeEqual` 不在 (Node < 6.6)
- **コード**: `server.js:445-449`。
- **現状**: try/catch で false 返却。
- **改善案**: 妥当。

#### E-S14 — fs read/write 失敗（disk full / permission）
- **コード**: `server.js:801, 927, 1066` 等の `fs.writeFileSync`。
- **現状**: throw されるが、`/api/contact` のみ outer try/catch あり（500）。subscribe / grey/update は catch なしで **process が落ちる可能性**。
- **改善案**: 各書き込みを try/catch で包み、`{error:'storage unavailable'}` を返す。

---

### 2.5 互換性エラー（E-C01〜E-C10）

#### E-C01 — `structuredClone` 不在 (iOS < 15.4)
- **コード**: `enhance.js:42-48`。
- **現状**: JSON shim。
- **改善案**: 妥当。

#### E-C02 — `ResizeObserver` 不在
- **コード**: `enhance.js:52-76`。
- **改善案**: 妥当。

#### E-C03 — IntersectionObserver 不在
- **改善案**: shim を追加 (E-S10)。

#### E-C04 — WebGL 非対応
- **コード**: `p3_code_for_claude.js:436-770` で try/catch、PNG fallback。
- **改善案**: 妥当。

#### E-C05 — Web Audio 非対応
- **コード**: 多数の try/catch。
- **改善案**: 妥当。

#### E-C06 — `AbortController` 不在
- **コード**: `p3_code_for_claude.js:4705`。
- **現状**: `typeof AbortController !== 'undefined'` チェック済 → undefined なら abort 不可だがリクエストは飛ぶ。
- **改善案**: 妥当。

#### E-C07 — `URL`, `URLSearchParams` 不在 (古 IE)
- **コード**: `i18n.js:35`、`server.js:551`。
- **現状**: 古 IE 切り捨て。
- **改善案**: 妥当（モダン前提）。

#### E-C08 — fetch 不在
- **コード**: `enhance.js`、`p3_code_for_claude.js`。
- **改善案**: 必要なら polyfill。現状 IE 全切で OK。

#### E-C09 — CSP で inline script blocked
- **コード**: `server.js:478-479`、CSP ヘッダ HTML レスポンスに付与。
- **現状**: inline script が p3_test.html / index.html にあり、CSP で `'unsafe-inline'` 許容している前提。許容していなければ全壊。**[推測]**
- **改善案**: `CSP_HTML` の中身を別途確認し、`'self' 'unsafe-inline'` または nonce 戦略。

#### E-C10 — `navigator.vibrate` 不在
- **コード**: `p3_code_for_claude.js:5355`。
- **現状**: try/catch。
- **改善案**: 妥当。

---

### 2.6 論理エラー（E-L01〜E-L11）

#### E-L01 — 商品 ID 不在 (`PRODUCTS.find` returns undefined)
- **コード**: `p3_code_for_claude.js:2073`、`:5164`。
- **現状**: `if (!p) return;` で早期 return。サイレント。
- **改善案**: 妥当だが、`onerror` で console.warn。

#### E-L02 — `shopifyVariants[size]` 不在
- **コード**: `p3_code_for_claude.js:2087`。
- **現状**: `''` を variantId として CART に追加 → checkout 時 `r.shopifyVariantId` で filter 漏れ。**蓄積されるバグ**。
- **改善案**: `getCheckoutStatus` を CART.add 前に必ず通す（既に通っているが、二重チェック）。

#### E-L03 — PRODUCTS 配列の不整合（gelato uid template 欠如）
- **コード**: `p3_code_for_claude.js:130-132`。
- **現状**: template null なら null variantId → filter で除外。
- **改善案**: 妥当。

#### E-L04 — フェーズ遷移の不整合（P3 → P2 戻り）
- **コード**: `p3_code_for_claude.js:5068`。
- **現状**: `currentPhase` グローバル管理。クリーンアップ漏れあり（推測）。**[推測]**
- **改善案**: 状態マシン化、illegal transition で console.warn。

#### E-L05 — Cart 重複追加（同一 size 既にあり）
- **コード**: `CART.add()` 実装は不明（推測）。**[推測]**
- **改善案**: 既存 item の qty++ にする。

#### E-L06 — 既購読メール再登録（409）
- **コード**: `server.js:782-785`。
- **現状**: 409 + `'already subscribed'`。クライアントは `r.ok` false で `'登録に失敗しました'` を表示し詳細捨てる。
- **改善案**: クライアントで 409 を検出し、「すでに観測されている。Grey として戻りますか？」プロンプト → 既存 token 再発行 / `/api/grey/cookie` POST。

#### E-L07 — 巨大商品配列のレンダリング（PRODUCTS.length 増加）
- **コード**: `p3_code_for_claude.js:1270-1295`。
- **現状**: 配列が増えるとカルーセル輪が密集。エラーではないが UX 劣化。
- **改善案**: `PRODUCTS.length > 12` でグリッドに切替。

#### E-L08 — i18n キー欠落 → key 文字列がそのまま表示
- **コード**: `i18n.js:81` の `return fallback != null ? fallback : key`。
- **現状**: key が表示される（"home.cta.checkout" 等）。
- **改善案**: `data-i18n-orig` を fallback として尊重しているのは良い。i18n.json missing key を console.warn。

#### E-L09 — 入団番号の重複（race condition）
- **コード**: `server.js:787` `db.subscribers.length + 1`。
- **現状**: ファイル書き込み中の同時 subscribe で重複可能性。**[推測]**
- **改善案**: `crypto.randomUUID()` ベースに。または mutex（簡易ロックファイル）。

#### E-L10 — グレー色 (`generateGreyColor`) 衝突
- **コード**: `server.js:789` (実装は別)。
- **現状**: 同じ email で同じ色になる前提（推測）。**[推測]**
- **改善案**: 衝突は意図的な設計の可能性あり、要確認。

#### E-L11 — `chatSessionId` の競合
- **コード**: `p3_code_for_claude.js:4701, 4717, 4721, 4730`。
- **現状**: `isChatSessionActive(sessionId)` で古いリクエストを破棄する設計。良い。
- **改善案**: 妥当。

---

## 3. alert() 全使用箇所と改善案

### 3.1 全件リスト（4 件）

#### A-1: `p3_code_for_claude.js:5170`
```js
alert('この商品の checkout はまだ準備中です。Shopify variant を設定してください。');
```
- **発生条件**: カートに variant 未マップ品が含まれた状態で「CHECKOUT」ボタン。
- **問題点**: 司さん向け開発メッセージ（"Shopify variant を設定してください"）が**顧客に露出**。
- **改善案**:
```js
showInryokuToast({
  text: 'この商品はまだ観測の途中です。',
  subtext: 'checkout soon — please choose another piece.',
  role: 'alert',
  retryable: false
});
btn.textContent = 'CHECKOUT SOON';
btn.disabled = true;
```

#### A-2: `p3_code_for_claude.js:5182`
```js
.catch(function(err) {
    alert('Checkout error: ' + err.message);
    btn.textContent = 'CHECKOUT';
    btn.disabled = false;
});
```
- **発生条件**: Shopify Storefront API 直接呼び出し失敗。
- **問題点**: `err.message` が英語の network 文字列で世界観を壊す。
- **改善案**:
```js
.catch(function(err) {
    showInryokuToast({
      text: 'the signal flickered.',
      subtext: '波が揺れた。もう一度。',
      action: { label: 'retry', onClick: () => triggerCheckout() }
    });
    btn.textContent = 'CHECKOUT';
    btn.disabled = false;
});
```

#### A-3: `p3_code_for_claude.js:5198`
```js
alert(data.error || 'Checkout not ready yet');
```
- **発生条件**: server `/api/checkout` 200 + `{error}` 返却時。
- **問題点**: server がそのまま返した英語 error を露出。
- **改善案**: `data.code` ベースの言語別マッピング。

#### A-4: `p3_code_for_claude.js:5204`
```js
.catch(function(err) {
    alert('Checkout error: ' + err.message);
    ...
});
```
- 同 A-2。

### 3.2 toast 統一実装案

```js
// p3_code_for_claude.js または別ファイルに 1 関数で統一
function showInryokuToast({ text, subtext, role = 'status', action, ttl = 4500 }) {
  var t = document.createElement('div');
  t.className = 'inryoku-toast';
  t.setAttribute('role', role); // 'alert' (assertive) | 'status' (polite)
  t.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
  // grey orb + text
  t.innerHTML = '<span class="t-orb" aria-hidden="true"></span>' +
                '<span class="t-text">' + text + '</span>' +
                (subtext ? '<span class="t-sub">' + subtext + '</span>' : '');
  if (action) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.addEventListener('click', function() { action.onClick(); t.remove(); });
    t.appendChild(b);
  }
  document.body.appendChild(t);
  setTimeout(function(){ t.classList.add('show'); }, 10);
  if (!action) {
    setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ t.remove(); }, 400); }, ttl);
  }
  return t;
}
```

### 3.3 既存 `cart-toast` との統合

`p3_code_for_claude.js:2079-2101` の `cart-toast` を発展させた汎用版に統合。
- 既存の `aria-live` なし → 上記実装で `role="alert"` を必須化。
- `ttl` 4500ms（現状 2000ms）に伸ばす（哲学的文言は読む時間が必要）。

---

## 4. ブランドボイスに合うエラー文言 50 個

> 各文言は **JA / EN ペア**で提示。`grey / 50→101 / 観測 / 波 / signal / unobserved` の語彙を中心に。

### 4.1 ネットワーク失敗系（10 件）

1. **JA**: 接続が grey に滲んだ。 / **EN**: the connection is grey.
2. **JA**: 信号が静かに消えた。 / **EN**: the signal faded.
3. **JA**: 波が揺れた。もう一度。 / **EN**: the wave shifted. observe again.
4. **JA**: 観測の糸が切れた。 / **EN**: the thread of observation broke.
5. **JA**: 世界がまだ目を覚ましていない。 / **EN**: the world has not yet woken.
6. **JA**: 50% に戻った。再観測してください。 / **EN**: returned to 50%. observe once more.
7. **JA**: signal in transit. しばらく待つ。 / **EN**: signal in transit. give it a breath.
8. **JA**: ネットワークが沈黙している。 / **EN**: the network is silent.
9. **JA**: あなたの観測が、まだ届いていない。 / **EN**: your observation has not yet arrived.
10. **JA**: グレーの中で、信号を探している。 / **EN**: searching for signal inside the grey.

### 4.2 入力エラー系（10 件）

11. **JA**: メールアドレスが、まだ観測されていない。 / **EN**: the email is unobserved.
12. **JA**: 全項目が観測されてから。 / **EN**: every field must be observed first.
13. **JA**: サイズを観測してから、カートへ。 / **EN**: observe a size first.
14. **JA**: 文字が長すぎる。短く、深く。 / **EN**: too long. shorter, deeper.
15. **JA**: 入力に色がない。 / **EN**: no color in your input.
16. **JA**: 半分しか書かれていない。残り 50%。 / **EN**: only half written. the other 50% awaits.
17. **JA**: あなたの言葉を、まだ受け取れない。 / **EN**: your words are not yet received.
18. **JA**: メールの形が、整っていない。 / **EN**: the shape of the email is uneven.
19. **JA**: 一文字、足りない。 / **EN**: one character is missing.
20. **JA**: 観測者として、まずはサイズを。 / **EN**: as an observer, choose a size.

### 4.3 認証・権限系（5 件）

21. **JA**: あなたは、まだ Grey として認証されていない。 / **EN**: you are not yet a Grey.
22. **JA**: token が、世界に一致しない。 / **EN**: the token does not match the world.
23. **JA**: 観測の権限が、もう一度確認される必要がある。 / **EN**: your observation permission needs renewal.
24. **JA**: 番号と token を、もう一度。 / **EN**: number and token, once more.
25. **JA**: 観測の波が、まだ落ち着いていない。少し静かにしてから。 / **EN**: the wave of observation has not settled. wait quietly.

### 4.4 状態異常系（10 件）

26. **JA**: 観測装置が、起動していない。 / **EN**: the apparatus is dormant.
27. **JA**: グレーが深すぎて、何も見えない。 / **EN**: the grey is too deep to see.
28. **JA**: あなたのブラウザは、この宇宙を描けない。 / **EN**: this browser cannot render the universe.
29. **JA**: 音が、まだ届いていない。クリックすると始まる。 / **EN**: sound is dormant. click to begin.
30. **JA**: あなたの記憶装置に、空きがない。 / **EN**: your memory has no room.
31. **JA**: プライベートな観測のため、番号は記録されません。 / **EN**: private observation — number not stored.
32. **JA**: GPU が眠っている。再観測する。 / **EN**: the GPU is asleep. reobserving.
33. **JA**: WebGL が、まだ届いていない。PNG で代替。 / **EN**: WebGL unreceived. PNG fallback.
34. **JA**: AudioContext が、許可されなかった。 / **EN**: audio permission unobserved.
35. **JA**: localStorage が拒否された。Grey は再訪で消える。 / **EN**: localStorage refused. your Grey will fade on return.

### 4.5 互換性系（5 件）

36. **JA**: 古いブラウザでは、この観測は完全に見えない。 / **EN**: this observation is incomplete on old browsers.
37. **JA**: あなたの環境では、宇宙が静かにレンダリングされる。 / **EN**: your environment renders the universe quietly.
38. **JA**: フォントが、まだ観測されていない。 / **EN**: fonts are still arriving.
39. **JA**: ジャイロが拒否された。視差は静止する。 / **EN**: gyroscope denied. parallax stilled.
40. **JA**: 一部の演出が、grey のまま。 / **EN**: some effects remain grey.

### 4.6 論理・データ系（5 件）

41. **JA**: この商品はまだ、観測の途中。 / **EN**: this piece is still being observed.
42. **JA**: あなたはすでに、観測されています。Grey #XXXX。 / **EN**: you are already observed. Grey #XXXX.
43. **JA**: checkout が、まだ準備されていない。 / **EN**: checkout is not yet prepared.
44. **JA**: このサイズは、まだこの宇宙に存在しない。 / **EN**: this size does not yet exist in this universe.
45. **JA**: カートに、何も観測されていない。 / **EN**: nothing observed in your cart.

### 4.7 オフライン・空状態系（5 件）

46. **JA**: グレーは欠落ではない。 / **EN**: grey is not absence.
47. **JA**: 観測されていないものは、まだここにある。 / **EN**: the unobserved is still here.
48. **JA**: 接続が戻れば、世界も戻る。 / **EN**: when the signal returns, so does the world.
49. **JA**: 50% から、いつでも始められる。 / **EN**: you can always begin again from 50%.
50. **JA**: 静かに待つ。波は、また来る。 / **EN**: wait quietly. the wave returns.

---

## 5. リカバリ UX 設計

### 5.1 リトライ可能性マトリクス

| エンドポイント | 自動リトライ | 手動リトライ UI | バックグラウンド同期 |
|--------------|------------|-----------------|----------------------|
| `/api/chat` | × (履歴汚染を避ける) | error bubble の 「もう一度」 button | × |
| `/api/checkout` | × (二重決済リスク) | toast の retry button | × |
| `/api/subscribe` | × | input 復活 + retry button | ◯ (sw.js:247-256 の placeholder を実装) |
| `/api/contact` | × | toast retry + draft 永続化 | ◯ |
| `/api/grey/:n/update` | × | save button 再活性 + status reset | △ |
| `/api/ref/track` | sendBeacon 失敗 → localStorage queue | × | ◯ (visibility:visible で再送) |
| Shopify direct | × | retry button | × |
| i18n.json | initial fetch のみ | reload page | × |
| sw fetch | sw 内で 1 回 | offline.html 上の reload | × |
| BGM 音声 | 3s 後に 1 回 (実装済) | ユーザクリックで再試行 | × |

### 5.2 オフラインモードの段階設計

**Tier 0**: 完全オフライン, sw cache あり
- `/`, `/p3_test.html`, `/offline.html` を cache hit。
- BGM, vendor/three.min.js は cache hit なら動作。
- AI チャット, checkout, subscribe は無効化（ボタン disabled, 「Grey when online」表示）。

**Tier 1**: ネットあるが API 部分劣化
- /api/chat だけ落ちている → fallback response でローカル応答 (server 実装済 `fallbackResponse`)。
- /api/checkout 落ち → 「checkout が grey になっている。Grey として後で。」

**Tier 2**: 全機能正常
- 通常動作。

### 5.3 部分機能の優雅な劣化

| 機能 | 劣化先 | 文言 |
|------|--------|------|
| 3D logo sphere | PNG image (実装済) | 静かに | 
| Particle universe | static gradient background | 「宇宙は今、静か」 |
| BGM | mute | (UI 上に no-text mute icon) |
| AI チャット | predefined reply pool | 「観測者は今、考えている」 |
| Shopify checkout | mailto: フォーム | 「order via signal — info@inryoku.com」 |
| Gelato | manual order email | 同上 |
| QR/ref tracking | localStorage queue | 通知不要 |

### 5.4 自動オンライン復帰検出

```js
window.addEventListener('online', function() {
  // queued sendBeacon を flush
  flushRefQueue();
  flushSubscribeQueue();
  showInryokuToast({
    text: 'the signal returned.',
    subtext: '世界が戻った。',
    role: 'status'
  });
});
window.addEventListener('offline', function() {
  showInryokuToast({
    text: 'the connection is grey.',
    subtext: '50% に戻った。',
    role: 'status',
    ttl: 8000
  });
});
```

---

## 6. グローバル error handler 設計案

### 6.1 現状

- 各処理は局所 try/catch。
- グローバル `window.onerror` / `unhandledrejection` リスナーなし。
- エラーは console に流れるだけ。

### 6.2 提案実装

新規ファイル `error-shield.js`（後付け、enhance.js と同じ非破壊原則）:

```js
(function () {
  'use strict';
  if (window.__inryokuErrorShield) return;
  window.__inryokuErrorShield = true;

  var SAMPLING = 1.0; // 100% 送信。本番で beacon 化したら 0.1 等に
  var DEDUP = new Set();

  function postError(payload) {
    if (!navigator.onLine) {
      // オフラインなら queue
      try {
        var q = JSON.parse(localStorage.getItem('inryoku.errq') || '[]');
        q.push(payload);
        localStorage.setItem('inryoku.errq', JSON.stringify(q.slice(-50)));
      } catch (e) {}
      return;
    }
    try {
      navigator.sendBeacon('/api/error', JSON.stringify(payload));
    } catch (e) {
      // 何もしない（観測できないエラーは 50% のまま）
    }
  }

  function pack(type, msg, src, line, col, err) {
    var key = type + '|' + (msg || '') + '|' + (src || '') + ':' + (line || '');
    if (DEDUP.has(key)) return null;
    DEDUP.add(key);
    if (DEDUP.size > 100) DEDUP.clear(); // 緩やかにリセット
    return {
      type: type,
      msg: String(msg || '').slice(0, 500),
      src: String(src || '').slice(0, 200),
      line: line || 0,
      col: col || 0,
      stack: err && err.stack ? String(err.stack).slice(0, 1500) : '',
      ua: (navigator.userAgent || '').slice(0, 200),
      url: location.pathname,
      ts: Date.now()
    };
  }

  window.addEventListener('error', function (e) {
    if (Math.random() > SAMPLING) return;
    // resource error (img, script, link) は target が Element
    if (e.target && e.target !== window && e.target.tagName) {
      var tag = e.target.tagName.toLowerCase();
      var src = e.target.src || e.target.href || '';
      var p = pack('resource', tag + ' load fail', src, 0, 0, null);
      if (p) postError(p);
      return;
    }
    var p = pack('error', e.message, e.filename, e.lineno, e.colno, e.error);
    if (p) postError(p);
  }, true); // capture for resource errors

  window.addEventListener('unhandledrejection', function (e) {
    if (Math.random() > SAMPLING) return;
    var reason = e.reason;
    var msg = reason && reason.message ? reason.message : String(reason || '');
    var stack = reason && reason.stack ? reason.stack : '';
    var p = pack('rejection', msg, '', 0, 0, { stack: stack });
    if (p) postError(p);
  });

  // online 復帰時に queue を flush
  window.addEventListener('online', function () {
    try {
      var q = JSON.parse(localStorage.getItem('inryoku.errq') || '[]');
      if (q.length) {
        navigator.sendBeacon('/api/error', JSON.stringify({ batch: q }));
        localStorage.removeItem('inryoku.errq');
      }
    } catch (e) {}
  });
})();
```

### 6.3 サーバ側 `/api/error` エンドポイント

`server.js` に追加（rate-limit 厳しめ 60/min/IP, ペイロード ≤ 4KB）:

```js
if (req.method === 'POST' && req.url === '/api/error') {
  if (!checkRate(req, res, 'error', 60, 60_000)) return;
  readBody(req, res, 4096, (body) => {
    try {
      const data = JSON.parse(body);
      // ファイルにラインで append（DoS 防止のため日次ローテ前提）
      const line = JSON.stringify({ ...data, ip_hash: hashIp(req), at: Date.now() }) + '\n';
      ensureDataDir();
      fs.appendFile(path.join(__dirname, 'data', 'errors.log'), line, () => {});
    } catch (e) {}
    res.writeHead(204).end();
  });
  return;
}
```

### 6.4 ユーザに見せるかどうか

- **見せない**（既存方針と整合）。エラーはサイレントに記録、UX は劣化先で吸収。
- 例外: 致命的に画面が白くなったケース → `error-shield.js` 内で `setTimeout(check, 5000)` で root が空なら "the universe is grey" を表示。

---

## 7. 実機テスト手順 30 件

### 7.1 ネットワーク（10 件）

1. **DevTools Network → Offline** にして `/p3_test.html` を navigate → offline.html 表示確認。
2. Offline 状態でチャット送信 → "波が揺れた" メッセージが履歴に残るかを確認（**残らないのが正解**）。
3. Offline 状態でカートに追加 → toast 出るか / checkout ボタンが disabled に変わるか。
4. **DevTools → Network → Slow 3G** で `/api/checkout` を 30 秒待たせる → ボタンが PROCESSING のまま固まるか、5 秒で timeout するか。
5. `Block request URL → fonts.googleapis.com` で `Press Start 2P` のフォールバックを確認（success.html のヘッダ）。
6. `Block request URL → cdn.jsdelivr.net` で Three.js 読み込み失敗時の振る舞い → ロゴが PNG のまま、粒子なし状態の root 表示確認。
7. `/api/chat` を server stop で 5xx → fallback response が表示されるか、3 連続で fallback ループに陥らないか。
8. Wi-Fi を物理的にオフ → online → offline イベント連動で toast 出るか。
9. iPhone Safari の Low Data Mode（Settings → Cellular → Low Data Mode）で BGM が読み込まれない時の挙動。
10. Captive Portal（カフェ Wi-Fi）で `/api/subscribe` が HTML を返した時 → JSON parse 失敗の handling。

### 7.2 入力（5 件）

11. メール欄に `a@a` のような不完全アドレスで送信 → クライアント検証メッセージ表示。
12. contact form を全空で送信 → 個別フィールドエラーが出ないことを確認（現状仕様）。
13. bio textarea に 250 文字入力 → maxlength で 200 に制限されるか。
14. サイズ未選択で ADD TO CART → デフォルトで `M` が黙って入る現状の挙動を確認（要修正対象）。
15. chat 入力に絵文字 + 改行で 1000 文字貼り付け → server truncate 動作。

### 7.3 認証・権限（3 件）

16. `/api/grey/9999/update` を localStorage の token を改竄して送る → 403 invalid token。
17. localStorage を削除してから「SAVE」 → token なしで 401 token required。
18. 異なるブラウザで同一 number の更新を 11 回/min → rate limit 429 確認。

### 7.4 状態（7 件）

19. Safari Private Browsing → /p3_test.html → subscribe 成功するが localStorage 書き込み失敗 → 番号永続せず。
20. Chrome の `chrome://settings/cookies` で localStorage を block → エラー出ずに動作するか。
21. iOS で DeviceOrientation permission を拒否 → 視差が静止するだけで他に影響なし確認。
22. WebGL を `chrome://flags` で disable → ロゴが PNG fallback、粒子宇宙が黒画面。
23. PC のスリープ → 復帰 → 30 分後に AudioContext が `suspended` になっているか、enhance.js の resume 機構が動くか。
24. カートに 100 商品追加 → localStorage 容量到達 → エラーで動作停止しないか。
25. Service Worker を `chrome://serviceworker-internals` で unregister → 次回 visit で再登録、reload toast が想定通り。

### 7.5 互換性（3 件）

26. iOS 14 Safari（古 iPad）で `structuredClone` shim が効くか。
27. Firefox ESR 102 で IntersectionObserver は OK だが `requestIdleCallback` 無し時のパフォーマンス測定。
28. UC Browser（Android）で fetch + Promise が動くか。

### 7.6 論理（2 件）

29. PRODUCTS の shopifyVariants を全空で checkout → toast「checkout 準備中」が出る、空アラートが出ないか。
30. 同じ email で subscribe を 2 回 → 1 回目 200, 2 回目 409 → クライアントが「すでに観測されている」プロンプトを表示するか（要実装）。

---

## 付録 A: 観測されたファイルの行番号インデックス

```
i18n.js              253 行
enhance.js           805 行
register.js          245 行
sw.js                257 行
perf-observer.js     210 行
particle_whisper.js  332 行
particle_glyphs.js   382 行
particle_rings.js    290 行
particle_speech_rings.js 498 行
p3_code_for_claude.js   5356 行
p2_code_for_claude.js   1394 行
p1_code_for_claude.js   3302 行
server.js            1197 行
index.html           1426 行
offline.html         50 行
success.html         189 行
size-guide.html      76 行
returns.html         53 行
privacy.html         47 行
legal.html           42 行
```

## 付録 B: 主要エラー grep 結果サマリ

- `alert(` 出現 4 件（全て p3_code_for_claude.js）
- `console.error` 出現箇所: server.js (8), p3_code_for_claude.js (2)
- `console.warn` 出現箇所: 多数。i18n / register / sw / particle / p3 にバランス良く分散
- `try { ... } catch` ブロック総数: 124
- `throw new Error` 件数: 11
- `.catch(` Promise rejection 数: 多数

## 付録 C: 司さんへの推奨優先順位

**今日（1 時間で対応可）**:
1. `alert()` 4 箇所を `cart-toast` 流用 toast に置換。
2. `'Shopify variant を設定してください'` の開発文言削除。
3. checkout success.html を grey orb + 「あなたの宇宙は、また少し広がった」(既存) のままで良いが、**注文番号の表示**を追加。

**今週（半日で対応可）**:
4. `error-shield.js` 追加 + `/api/error` 実装。
5. /api/subscribe の 409 を「すでに Grey として観測されている」プロンプトに分岐。
6. WebGL contextlost handler 追加。

**今月（1 日以上）**:
7. リトライ + バックグラウンド同期で subscribe / contact のオフライン送信。
8. /api/checkout のレスポンス契約を `2xx 正常 / 4xx,5xx エラー` に統一。
9. i18n.json を error 文言で拡張、上記 50 文言を ja/en 両方収録。

---

**文末**: 観測されない error は、本当には存在しない。けれど、観測されない error は、ある日突然 100% になる。50% のうちに、grey で受け止める仕組みを。

— audit by claude, for inryokü.
