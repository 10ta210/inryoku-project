# inryokü セキュリティレビュー — 2026-04-28

レビュー対象: `server.js` (891行) / `p3_code_for_claude.js` (5356行) / `index.html` / `p3_test.html` / `package.json` / `.env`（構造のみ）。

レビュー手法: server.js を 2 周、p3_code_for_claude.js の主要セクション（Shopify/Gelato 設定、Cart、innerHTML 各箇所、Chat、Grey プロフィール、Easter egg、product modal、cart drawer、subscribe/contact）を 1 周読了。

---

## 1. エクゼクティブサマリ

inryokü のサーバ／クライアントは Node.js 標準 `http` モジュールベースの軽量実装で、Shopify Storefront / Gelato POD / Groq AI / メール登録 / Grey プロフィール / 影響力 ref tracking を担う。**.env の管理に致命的な事故が発生**しており（後述 C-1）、その他にも認可境界・XSS 露出面・レート制限欠如・データ層の race condition など中〜高リスクの問題が並ぶ。一方でパストラバーサル防御や body サイズ制限、Shopify トークンのサーバ側中継など基礎的な防御は整っており、構造は悪くない。

優先度トップ3:

1. **`.env` に書かれた全シークレットの即時ローテーション** — リポジトリ／ホームディレクトリ内に平文で存在し、Shopify Storefront / Groq / Gelato / Admin の鍵が読み取り可能。
2. **`p3_code_for_claude.js` 65-67 行の Shopify Storefront トークンのハードコード除去** — Storefront トークンは "公開可能" だが、サーバ中継 (`/api/checkout`) と同一トークンを併用することで Origin 制限が一切効かない構成。さらに同ファイル内に存在することで「フロントだから OK」という誤った安心感を関係者に植え付けている。
3. **API エンドポイント全体に対するレート制限・認証の追加** — `/api/subscribe` `/api/contact` `/api/ref/*` `/api/chat` `/api/gelato/order` 全てが匿名・無制限に叩ける。

CVSS 値はベクター v3.1 を簡易適用した参考値。

---

## 2. Critical 脆弱性（CVSS 7+ / 即修正）

### C-1. `.env` がコミット対象ディレクトリに平文で存在し、本番値と推定されるシークレットが含まれる
- 該当: `/Users/10ta210/Desktop/inryoku_hp/.env`
- 内容: `GROQ_API_KEY` / `SHOPIFY_STOREFRONT_TOKEN` / `SHOPIFY_STORE_DOMAIN` / `GELATO_API_KEY` / `ADMIN_API_KEY`（具体値はここには記載しない）。
- リスク:
  - `.gitignore` の有無を確認していないが、もしリポジトリにこのまま push されていれば `git log -p` で全コミット参照者が読める。
  - 共有 Mac／バックアップ／クラウド同期（iCloud Desktop など）経由で漏洩する経路が常時存在。
  - `GELATO_API_KEY` は Admin 権限相当のため、漏洩時には実注文を勝手に発行可能（金銭損害）。
  - `ADMIN_API_KEY` は `/api/subscribers` の全購読者メール一覧を取得可能。
- CVSS: 9.1 (Critical) — Confidentiality/Integrity High, Network, No PR.
- 即時アクション:
  1. 4 つのキーを **全て発行元コンソールでローテーション**（Groq / Shopify Admin / Gelato / 自前生成の Admin Key）。
  2. `.gitignore` に `.env` `data/` を追加し、`git ls-files | grep -E '^\.env$'` で履歴混入を確認。混入していれば `git filter-repo` で完全消去。
  3. Mac の Keychain か 1Password 連携の `op run` 等で `.env` を版管理外にする運用へ。

### C-2. `p3_code_for_claude.js` の Shopify Storefront トークン直書き
- 該当: `p3_code_for_claude.js` 64-68 行
  ```js
  const SHOPIFY_CONFIG = {
      storeDomain: '0xi10h-x1.myshopify.com',
      storefrontToken: 'ce0dc399245e874fd85d218df2d9bb04', // ←公開バンドル
      apiVersion: '2024-10'
  };
  ```
- Storefront トークン自体は仕様上「公開可能」だが、本構成では以下の追加リスクがある:
  - サーバ側 `/api/checkout` (`server.js` 405-460) も同じ env のトークンを使うため、**Storefront 側で IP / Origin 制限を一切掛けられない**。Shopify ダッシュボードで Allowed domains を絞っていない場合、誰でも `cartCreate` を叩いて公開商品ハンドルを総当たりで列挙したり、攻撃者ドメインからの cart 作成を行える。
  - `shopifyCheckout()` がフロント直叩き経路 (line 169) と `/api/checkout` 経由 (5188行) の両方を持っており、サーバ中継のメリットが消えている。
- CVSS: 7.4 — Storefront トークンの想定権限は読み出し+カート作成のみだが、abuse による Shopify レート消費・スパム cart で実害発生。
- 修正:
  1. Shopify ダッシュボードの Storefront API setup で **Allowed origins を `inryoku.com` 等に限定**。
  2. `p3_code_for_claude.js` の `shopifyCheckout()` を削除し、すべて `/api/checkout` 経由に統一。サーバ側で `Referer` / `Origin` 検証を追加。
  3. ハードコード値は `window.__INRYOKU_PUBLIC_CONFIG__` を `index.html` から注入する形に分離（コード差分管理上の取り違えを減らす）。

### C-3. `/api/grey/:number/update` のトークン検証が timing-safe でない
- 該当: `server.js` 652
  ```js
  if (s.token !== token) { ... 403 }
  ```
- リスク: 32 byte の hex (`crypto.randomBytes(32)`) なので実用上はブルートフォースは無理だが、JSON ファイル全件走査 → タイミング差分でユーザ存在確認・トークン先頭一致 oracle にされうる。さらに同エンドポイントは:
  - **レート制限なし**（後述 H-1）
  - **token は localStorage 平文**（H-3）
  - リクエストごとに `subscribers.json` 全体を `readFileSync` → `writeFileSync` で書き戻す（**race condition / TOCTOU**）。並列リクエストで購読者レコードが消失する可能性。
- CVSS: 7.5（race による永続データ破壊が支配的）。
- 修正:
  - `crypto.timingSafeEqual(Buffer.from(token,'hex'), Buffer.from(s.token,'hex'))` に置換。
  - subscribers.json アクセスをシリアライズ（プロセス内 mutex か、SQLite/LMDB への移行）。
  - 同様の問題は `/api/subscribe` / `/api/contact` / `/api/ref/*` 全 JSON 書き込みに存在。

### C-4. Admin エンドポイント `/api/subscribers` が dev モードで完全無認証
- 該当: `server.js` 307-326, 736-749
  ```js
  if (!adminKey) {
      if (process.env.NODE_ENV === 'production') { ...403 }
      console.warn('[WARN] ADMIN_API_KEY not set — admin endpoints unprotected in dev mode');
      return true;  // ← bypass
  }
  ```
- リスク:
  - `NODE_ENV` が未設定の場合 `process.env.NODE_ENV === 'production'` は false → bypass。本番デプロイ時に `NODE_ENV=production` を入れ忘れると **全購読者の email / token / number / 作成日時が無認証で取得可能**（個人情報＋トークン直露出 → 任意プロフィール乗っ取り）。
  - 現状 `.env` には `ADMIN_API_KEY` が入っているため即時の dev bypass は発火しないが、デプロイ手順の脆さが Critical 級。
- CVSS: 8.6（個人情報＋認証トークンの平文露出）。
- 修正:
  - dev bypass を削除し、`ADMIN_API_KEY` 未設定なら問答無用で 503 を返す。
  - レスポンスから `token` を**絶対に**返さない（後述 H-2）。

---

## 3. High 脆弱性（CVSS 4-7 / 次スプリント）

### H-1. 全 API エンドポイントにレート制限なし
- `/api/chat` (Groq への中継) は最も危険。匿名で叩き放題 → **Groq 利用料を攻撃者にバーンされる金銭 DoS**。max_tokens=200 の単発でも分単位で多額に。
- `/api/subscribe` も `subscribers.json` を肥大化させて DoS / ディスクフル可能。
- `/api/ref/track` でランダム ref を投げまくり 404 を量産させると `data/refs.json` の readFile を連打させられる。
- 修正案: シンプルな in-memory token bucket を `req.socket.remoteAddress` ベースで導入（10 req/min × IP）。Cloudflare 等を前段に置くなら CF 側のルールで十分。

### H-2. `/api/subscribe` レスポンスがトークンを含んでクライアント送信
- `server.js` 588-591:
  ```js
  res.end(JSON.stringify({ success:true, message:'subscribed', number, token, greyColor }));
  ```
  クライアントは `localStorage.setItem('inryoku.uchujin_token', data.token)` で保存。これで XSS 一発でトークン窃取 → 任意 Grey 乗っ取りに直結。
- 加えて `GET /api/subscribers`（admin）も `subscribers` 配列にトークンを含めて返している。
- 修正案:
  - サーバから token を返すのは初回登録時のみとし、ログイン的なクッキーフロー（HttpOnly cookie）に切替。
  - 暫定策としても、admin `/api/subscribers` のレスポンスから `token` フィールドを stripped する。

### H-3. localStorage に長寿命トークン・カート・購読番号
- `p3_code_for_claude.js` 1480-1491, 1604-1606, 372-373.
  - `inryoku.uchujin_token` (32 byte 認証トークン)
  - `inryoku.uchujin_number`（一意識別子）
  - `inryoku_cart`（金額・variant ID 含む）
- localStorage は XSS で全部抜かれる。あらゆる `innerHTML` 経路（後述 H-4）が成功すれば即乗っ取り。
- 修正案: トークンは HttpOnly `Set-Cookie` で配布。カートはサーバ側 cart id にひもづけ、JSON は cart id + checksum のみフロントに置く。

### H-4. `onerror` HTML 属性内テンプレリテラルでの XSS（自己 XSS だが将来データ駆動になると即危険）
- `p3_code_for_claude.js` 1283:
  ```js
  <img src="${p.image}" alt="${p.name}" loading="lazy"
       onerror="this.style.display='none';
                this.parentNode.innerHTML='<div ...>${p.name.charAt(0)}</div>'">
  ```
- 現状 `PRODUCTS` は静的・コード内定数なので即発火はしない。だが:
  - 将来 Shopify から動的に商品名を取得する際、この行を直さずに使うと XSS。
  - `p.image` も同様に属性インジェクション可能（"`onload=...`" を仕込む等）。
- CVSS: 4.7（現時点では残留リスク／将来活性化）。
- 修正案: `onerror` ハンドラはテンプレ展開ではなく、別途 `img.addEventListener('error', ...)` で `replaceWith(textNode)`。

### H-5. Grey プロフィール HTML ページ (`/grey/:number`) のサニタイズが不完全
- `server.js` 691:
  ```js
  const bio = (s.bio || '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  ```
  そのうえで:
  ```js
  <meta property="og:description" content="${bio || 'a Grey observes the 50%.'}">
  <div class="bio">${bio}</div>
  ```
- `<` `>` `&` はエスケープされているが **`"` (double quote) と `'` がエスケープされていない**。`og:description` の `content="..."` 属性に `"` を仕込めば属性ブレイクして任意の meta 属性追加・OGP 偽装が可能（XSS は `>` がないので限定的だが、最低でも OGP スプーフィング）。
- 加えて `s.greyColor` は無検証のまま `style="background:${s.greyColor}"` に展開されている (line 720)。`#abc;}<style>...` のような注入で `</style>` を含めれば CSS インジェクション → CSS exfil 攻撃可能。`generateGreyColor()` の出力は安全だが、将来 user editable になると即 XSS。
- CVSS: 5.8。
- 修正案: HTML エスケープを `&` `<` `>` `"` `'` の 5 文字に拡張し、専用 helper `escapeHTML()` を共通化。`greyColor` は `/^#[0-9a-f]{6}$/i` で wash する。

### H-6. ファイル提供時の symlink / 隠しファイル / `data/` 拒否ロジックの抜け
- `server.js` 779-801:
  - `path.resolve` 後の `__dirname + path.sep` プリフィックスチェックは正しいが、`fs.realpath` を取らないため **`__dirname` 配下にあるシンボリックリンクが外を指している** ケースで読まれる。
  - `data/` の禁止は `filePath.startsWith(path.join(__dirname,'data'))` だが、`/datax` のようなディレクトリ・ファイル名でバイパスされ得る（現存しないが正しくは `path.sep` を後置すべき）。
  - 同じ問題は `_dev` `prompts` `docs` `.superpowers` `.claude` 全てに該当。
  - `.env` 拒否は basename だけ見ているので `cp .env public/foo.env` のようなケースでは拒否されない。基本拡張子ベースのホワイトリスト方式に倒したい。
  - `package.json` `package-lock.json` `server.js` `p3_code_for_claude.js` 自体が `MIME['.js']`/`.json` 経由で**そのまま配信される**。Storefront トークンが書かれた p3_code_for_claude.js は意図された配信だが、`server.js` を `GET /server.js` で取得すると Groq/Shopify ロジック・Admin 認証ロジック全て見られる。
- CVSS: 6.8（情報漏洩の足場として極めて有用）。
- 修正案:
  - 配信ルートを `public/` 配下に明示的に移し、サーバスクリプトは外に出す。
  - もしくは `denyList` に `server.js` `package.json` `package-lock.json` `*.md` を追加。
  - パス比較は `path.relative(__dirname, filePath)` の結果が `..` で始まらないかで判定。`fs.realpath` を取り、再度プリフィックスチェック。

### H-7. プロンプトインジェクションの実質無防御
- `server.js` 519-526, 200-205: ユーザ入力 `parsed.message` と `parsed.history` を加工せず Groq に渡す。
- `parsed.history` は **クライアント任意** なので、攻撃者は role: 'system' を仕込むことはできない（コード上は user/assistant のみに固定されている — line 521 で正規化されている → 軽減）。
- 残存リスク:
  - ユーザ入力で SYSTEM_PROMPT を override する古典プロンプト注入（"前の指示は忘れて..." など）は防げない。Brand 価値の毀損・暴言生成・他ユーザ向けに不適切応答。
  - history 配列のサイズ制限がない → 50KB body の中で 1000 件の history を入れて Groq への課金を最大化される。
- CVSS: 5.5。
- 修正案:
  - history を直近 N=10 件に切る、文字数合計を制限。
  - 入力に対して "system プロンプトを変更しようとしている" 系の簡易検出（LLM ガード or 単純なキーワードフィルタ）。
  - max_tokens=200 を維持、temperature=0.8 のままで OK。Groq 側のレート/予算アラートを設定。

### H-8. `/api/contact` / `/api/checkout` / `/api/gelato/order` のエラー応答での情報漏洩
- `server.js` 446 — `cartCreate` 失敗時に `raw: data` で Shopify GraphQL の生レスポンスをそのまま返している。Shopify 側のエラーメッセージに内部 ID やハンドル情報が含まれる場合がある。
- `server.js` 496-498 — Gelato は `res.end(chunks)` で statusCode と body を**そのまま透過**。Gelato 側の rate limit メッセージや内部スタックを暴露。
- `server.js` 502 — `err.message`（ネットワークエラー）を返す。`getaddrinfo` 系で内部 DNS / IP がリークする可能性。
- CVSS: 4.3。
- 修正案: 4xx/5xx は固定文言、詳細はサーバログだけに残す。

---

## 4. Medium / Low 脆弱性

### M-1. CORS 未設定
- 現状 `Access-Control-Allow-Origin` が一切ない。**これは寧ろ安全**（同一オリジン強制）だが、将来 SPA 分離で叩く時にハマるので方針を docs に明記すべし。

### M-2. CSP / X-Frame-Options / X-Content-Type-Options なし
- 静的レスポンスの headers (`server.js` 854-868) に security header が一つもない。最低限:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy:` `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://api.qrserver.com https://cdn.shopify.com; connect-src 'self' https://*.myshopify.com; frame-ancestors 'none'`
- 注意: 現状 `innerHTML` で大量にインライン style を吹き付けているため `style-src 'unsafe-inline'` は当面必須。`'unsafe-inline'` script は将来的に nonce 化したい（nonce ベース CSP は `innerHTML` 内 inline event handler `onerror=` を弾けるので H-4 と相性が良い）。

### M-3. Prototype Pollution の足場
- `server.js` 内では `JSON.parse` の結果を直接プロパティアクセスしているだけで、**マージ／代入を伴わないため現状は安全**。ただし将来 `Object.assign(s, parsed)` のような書き方を入れると `__proto__` 経由汚染が発火する。`/api/grey/:number/update` の更新ロジックは個別フィールドに代入しているため OK。差分パッチ時の指針として docs 化を推奨。

### M-4. `data/refs.json` の ref 正規化なし
- `/api/ref/track` で `parsed.ref` が `__proto__` や `constructor` の場合、`refs[ref]` は Object.prototype を指すため `refs[ref].scans++` で `Object.prototype.scans` を汚染できる。
- CVSS: 4.0（grade-2 prototype pollution、影響は同プロセス内）。
- 修正案: `if (typeof ref !== 'string' || !/^ir_[a-z0-9]{4,}$/.test(ref)) return 400;`

### M-5. `/api/contact` 入力検証が緩い
- `server.js` 755-769 — `name` `email` `message` の長さ・型・email 形式を検証していない。`message` に 49KB のスパム文を 1 IP から繰り返し投げて contacts.json を肥大化可能（ストレージ/メンテ DoS）。
- 同様に `name` には HTML を含められるが、現在は console.log と JSON 保存だけなので即時 XSS はなし。Admin が contacts.json を HTML レンダラで眺めると stored XSS 候補。
- 修正案: email 形式正規表現、name<=100, message<=2000、URL の出現回数 <=2 などのスパム抑止。

### M-6. `localStorage` 上の `inryoku_chat_history` を直接 fetch ボディに送信
- `p3_code_for_claude.js` 3775 → `/api/chat` の `history` に流れる。XSS で改変可能だが、それ以前にレート制限と max history が無いのが問題（H-7 と重複）。

### M-7. Subresource Integrity (SRI) 未設定
- `index.html` / `p3_test.html` は CDN 利用を最小化し vendor/ ローカル化済（良い）。Google Fonts CDN 経由 (`fonts.googleapis.com`, `fonts.gstatic.com`) は preconnect のみで SRI なし → 不要なら self-host に。

### M-8. `manifest.json` を任意で読み込ませる仕組みでパストラバーサル試験
- 試した: `GET /../etc/passwd` → `decodeURIComponent` 後に `path.resolve` でクランプされ、prefix チェックで弾かれる。**OK**。NULL byte (`%00`) も Node.js v18 系では `path.resolve` がそのまま含むが、`fs.stat` で ENOENT になる。**OK**。

### L-1. `crypto.randomBytes(32).toString('hex')` のみで予測可能性なし → OK。

### L-2. Easter egg unlock を localStorage に書く `inryoku.layers` は無害。

### L-3. `package.json` は依存ゼロ（実行時）に近く `canvas`/`qrcode` が devDependencies として置かれている。サーバ実行に標準モジュール以外が要らない構成は脆弱性表面を最小化していて良い。`npm audit` 上の脆弱性は dev でしか刺さらない。本番ビルドに devDependencies を入れない CI ガードがあるか確認。

### L-4. `success.html` `legal.html` `privacy.html` `returns.html` `size-guide.html` は静的で動的展開なし → ざっと確認した範囲で問題なし。

### L-5. HTTPS / 通信
- 開発時 `http://localhost:3000` は OK。本番は逆プロキシ（Cloudflare / Nginx / Vercel）で TLS 終端する想定だが:
  - HSTS ヘッダ (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`) を本番で必ず付与。
  - サーバ自身が TLS を喋らないのは設計判断としては正しい。

### L-6. 個人情報の取扱
- 決済情報は Shopify Checkout / Gelato 側で完結 → サーバは触らない。**OK**。
- 住所は `/api/gelato/order` で `parsed.shipping` をそのまま中継し、サーバ側ストレージには残さない。**OK**。
- メール / Grey 番号 / token は `data/subscribers.json` に永続。これが個人情報保護上の主たるリスク。privacy.html の文言と整合させ、退会 (`DELETE /api/grey/:number`) を実装すること。

---

## 5. 防御的提案 (Defense in Depth)

1. **シークレット管理**: Mac のみで運用するなら `op run -- node server.js` (1Password CLI) か `direnv` + 暗号化 .envrc。リポジトリ内の `.env` は禁止。`.gitignore` に `data/`, `.env*` を追加。
2. **JSON ファイル DB の置換**: `subscribers.json` `refs.json` `contacts.json` のいずれも同時書き込みでデータ消失する。`better-sqlite3`（同期 API）か `level` への移行を強く推奨。
3. **アクセスログと監査**: `/api/subscribers` などの admin 系は IP/UA/timestamp を `data/admin-audit.log` に記録。
4. **入力検証層**: `validateBody(schema, body)` ユーティリティを 1 つ作って全 POST に適用。型チェック / 長さ制限 / 形式正規表現を一箇所に集約。
5. **Cookie ベース認証への移行**: Grey トークンは HttpOnly + Secure + SameSite=Lax クッキー。XSS 即乗っ取りの足場を奪う。
6. **CSP 段階導入**: `Content-Security-Policy-Report-Only` でまず観測 → 1 週間後に enforce。`'unsafe-inline'` script は当面残し、style だけ徐々に nonce 化。
7. **Honeypot / Rate Limit**: `/api/contact` `/api/subscribe` に hidden field（人間は記入しないフィールド）を仕込んで bot を弾く。`Bot Fight Mode` を CDN 側で有効化。
8. **エラーモデル統一**: 全エンドポイントで `{ error: 'human_message', code: 'machine_code' }` 形式とし、5xx の詳細は出さない。`raw: data` のような pass-through を全廃。
9. **依存導入時のポリシー**: 実行時 dependency を増やすときは `npm audit --omit=dev` の CI ゲートと `lockfileVersion` 固定を必須化。
10. **退会フロー**: GDPR / 改正個人情報保護法（日本）対応として `POST /api/grey/:number/delete` を必ず実装し、`bio`/`email` を tombstone 化。
11. **AI 出力モデレーション**: Groq 応答を `info` キャラクターから逸脱しないようサーバ側で簡易フィルタ（NG ワード、URL 出力禁止など）。
12. **ホストヘッダ injection**: `req.headers.host` をそのまま `shareURL` に入れている (`server.js` 370)。攻撃者が `Host: evil.com` を付けて `/api/ref/create` を叩くと `https://evil.com/?ref=...` の QR を生成してサーバ側 DB に痕跡を残せる（後で正規ドメインで status 取れる）。期待値ホワイトリスト (`inryoku.com`, `localhost:3000`) に正規化推奨。

---

## 6. 優先修正パッチ案 (上位 3 件 / diff 形式)

### Patch 1 — `server.js`: timing-safe トークン比較 + 全 POST のレート制限 + admin から token 漏洩抑止

```diff
--- a/server.js
+++ b/server.js
@@ -42,6 +42,28 @@ const GZIP_MIMES = new Set([
 // ── セキュリティ定数 ──
 const MAX_BODY_SIZE = 1024 * 50; // 50KB — POST bodyの上限

+// ── 簡易レートリミッタ (in-memory token bucket) ──
+const RATE_BUCKETS = new Map();
+function checkRate(req, res, key, max, windowMs) {
+    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
+    const k = `${key}:${ip}`;
+    const now = Date.now();
+    const b = RATE_BUCKETS.get(k) || { count: 0, reset: now + windowMs };
+    if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
+    b.count++;
+    RATE_BUCKETS.set(k, b);
+    if (b.count > max) {
+        res.writeHead(429, {'Content-Type':'application/json','Retry-After': Math.ceil((b.reset - now)/1000)});
+        res.end(JSON.stringify({ error: 'rate_limited' }));
+        return false;
+    }
+    return true;
+}
+function safeEqualHex(a, b) {
+    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
+    try { return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); }
+    catch { return false; }
+}
+
 // ── .env 読み込み ──
@@ -649,7 +671,7 @@
                 if (!s) {
                     res.writeHead(404, {'Content-Type':'application/json'});
                     return res.end(JSON.stringify({ error: 'grey not found' }));
                 }
-                if (s.token !== token) {
+                if (!safeEqualHex(s.token, token)) {
                     res.writeHead(403, {'Content-Type':'application/json'});
                     return res.end(JSON.stringify({ error: 'invalid token' }));
                 }
@@ -510,6 +532,7 @@
     // ── POST /api/chat ──
     if (req.method === 'POST' && req.url === '/api/chat') {
+        if (!checkRate(req, res, 'chat', 20, 60_000)) return;
         readBody(req, res, MAX_BODY_SIZE, (body) => {
@@ -541,6 +564,7 @@
     // ── POST /api/subscribe — メール登録 ──
     if (req.method === 'POST' && req.url === '/api/subscribe') {
+        if (!checkRate(req, res, 'sub', 5, 60_000)) return;
         readBody(req, res, MAX_BODY_SIZE, (body) => {
@@ -736,6 +760,7 @@
     // ── GET /api/subscribers — 登録者一覧（管理用・要認証） ──
     if (req.method === 'GET' && req.url === '/api/subscribers') {
         if (!checkAdminAuth(req, res)) return;
+        // tokenとemailの完全列挙を避け、最低限のフィールドのみ返す
         const dbPath = path.join(__dirname, 'data', 'subscribers.json');
         ensureDataDir();
         let db;
@@ -744,8 +769,11 @@
         } catch(e) {
             db = { subscribers: [] };
         }
-        res.writeHead(200, {'Content-Type':'application/json'});
-        res.end(JSON.stringify({ count: db.subscribers.length, subscribers: db.subscribers }));
+        const safe = db.subscribers.map(s => ({
+            number: s.number, email: s.email, greyColor: s.greyColor,
+            isArtist: !!s.isArtist, isPublic: !!s.isPublic, created: s.created
+        })); // ← token / bio は admin にも返さない（DB を直接参照させる）
+        res.writeHead(200, {'Content-Type':'application/json'});
+        res.end(JSON.stringify({ count: safe.length, subscribers: safe }));
         return;
     }
@@ -307,9 +307,9 @@ function checkAdminAuth(req, res) {
     const adminKey = process.env.ADMIN_API_KEY;
     if (!adminKey) {
-        if (process.env.NODE_ENV === 'production') {
-            res.writeHead(403, ...);
-            ...
-        }
-        console.warn('[WARN] ADMIN_API_KEY not set — admin endpoints unprotected in dev mode');
-        return true;
+        // dev モード bypass を撤廃 — 設定漏れによる本番事故を防止
+        res.writeHead(503, {'Content-Type':'application/json'});
+        res.end(JSON.stringify({ error: 'admin not configured' }));
+        return false;
     }
```

### Patch 2 — `server.js`: HTML エスケープ強化 + 静的配信 deny list 拡張 + 共通セキュリティヘッダ

```diff
--- a/server.js
+++ b/server.js
@@ -29,6 +29,17 @@
 function generateToken() {
     return crypto.randomBytes(32).toString('hex');
 }
+
+function escapeHTML(s) {
+    return String(s).replace(/[<>&"'`]/g, c =>
+        ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
+}
+function isSafeHexColor(s) { return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s); }
+
+const SECURITY_HEADERS = {
+    'X-Content-Type-Options': 'nosniff',
+    'X-Frame-Options': 'DENY',
+    'Referrer-Policy': 'strict-origin-when-cross-origin',
+    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
+};
+
 const PORT = process.env.PORT || 3000;
@@ -688,12 +699,13 @@
             res.writeHead(s && s.isPublic ? 200 : 404, {'Content-Type': 'text/html; charset=utf-8'});
             if (!s || !s.isPublic) {
                 return res.end(`<!DOCTYPE html>...`);
             }
             const padded = String(s.number).padStart(4, '0');
-            const bio = (s.bio || '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
+            const bio = escapeHTML(s.bio || '');
+            const grey = isSafeHexColor(s.greyColor) ? s.greyColor : '#808080';
             return res.end(`<!DOCTYPE html>
 ...
-<meta property="og:description" content="${bio || 'a Grey observes the 50%.'}">
+<meta property="og:description" content="${bio || 'a Grey observes the 50%.'}">
 ...
-    <div class="swatch" style="background:${s.greyColor}"></div>
-    <span>personal grey: ${s.greyColor}</span>
+    <div class="swatch" style="background:${grey}"></div>
+    <span>personal grey: ${grey}</span>
 ...
@@ -785,12 +797,21 @@
-    if (!filePath.startsWith(__dirname + path.sep) && filePath !== __dirname) {
+    const rel = path.relative(__dirname, filePath);
+    if (rel.startsWith('..') || path.isAbsolute(rel)) {
         res.writeHead(403); return res.end('Forbidden');
     }
-    const basename = path.basename(filePath);
-    if (basename === '.env' || basename === '.gitignore' || filePath.startsWith(path.join(__dirname, 'data'))) {
+    const basename = path.basename(filePath);
+    const denyExact = new Set(['.env','.gitignore','server.js','package.json','package-lock.json']);
+    const denyExt   = new Set(['.md','.lock']);
+    const denyDirs  = ['data', '_dev', 'prompts', 'docs', '.superpowers', '.claude'];
+    if (denyExact.has(basename) || basename.startsWith('.env') || denyExt.has(path.extname(basename))) {
         res.writeHead(403); return res.end('Forbidden');
     }
+    if (denyDirs.some(d => rel === d || rel.startsWith(d + path.sep))) {
+        res.writeHead(404); return res.end('Not Found');
+    }
@@ -854,6 +875,7 @@
         const headers = {
             'Content-Type': mime,
             'Last-Modified': stats.mtime.toUTCString(),
             'ETag': '"' + stats.mtimeMs + '-' + stats.size + '"',
             'Vary': 'Accept-Encoding'
         };
+        Object.assign(headers, SECURITY_HEADERS);
+        if (mime === 'text/html') {
+            headers['Content-Security-Policy'] =
+              "default-src 'self'; " +
+              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; " +
+              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
+              "font-src 'self' https://fonts.gstatic.com; " +
+              "img-src 'self' data: https://api.qrserver.com https://cdn.shopify.com; " +
+              "connect-src 'self' https://*.myshopify.com https://api.groq.com; " +
+              "frame-ancestors 'none'; base-uri 'self'";
+        }
```

### Patch 3 — `p3_code_for_claude.js`: Storefront トークンの直書き廃止 + onerror フォールバックの DOM 化

```diff
--- a/p3_code_for_claude.js
+++ b/p3_code_for_claude.js
@@ -62,11 +62,15 @@
-// ═══ SHOPIFY STOREFRONT API CONFIG ═══
-// 司さんがStorefront APIトークン取得後に設定
-const SHOPIFY_CONFIG = {
-    storeDomain: '0xi10h-x1.myshopify.com',
-    storefrontToken: 'ce0dc399245e874fd85d218df2d9bb04', // Dev Dashboard クライアントID
-    apiVersion: '2024-10'
-};
+// ═══ SHOPIFY STOREFRONT API CONFIG ═══
+// 重要: トークンの直書きは禁止。index.html から window.__INRYOKU_PUBLIC_CONFIG__ で注入する。
+// またトークンは Shopify ダッシュボード側で Allowed origins を inryoku.com に限定する前提。
+const SHOPIFY_CONFIG = (window.__INRYOKU_PUBLIC_CONFIG__ && window.__INRYOKU_PUBLIC_CONFIG__.shopify) || {
+    storeDomain: '',
+    storefrontToken: '',
+    apiVersion: '2024-10'
+};
@@ -167,10 +171,12 @@
-function shopifyCheckout(cartItems) {
-    var lines = cartItems.map(function(item) {
-        var variantId = item.shopifyVariantId;
-        if (!variantId) return null;
-        return { merchandiseId: variantId, quantity: item.qty || 1 };
-    }).filter(Boolean);
-    if (lines.length === 0) return Promise.reject(new Error('No Shopify variants mapped'));
-    var query = '...';
-    return shopifyFetch(query, { ... }).then(...);
-}
+// 直接フロントから Shopify GraphQL を叩く経路は廃止し、必ずサーバ /api/checkout 経由にする。
+// これにより Storefront トークンを Origin 縛りで運用しても破綻しない。
+function shopifyCheckout(cartItems) {
+    return fetch('/api/checkout', {
+        method: 'POST',
+        headers: { 'Content-Type': 'application/json' },
+        body: JSON.stringify({ items: cartItems })
+    }).then(r => r.json()).then(data => {
+        if (data && data.url) return data.url;
+        throw new Error((data && data.error) || 'Cart creation failed');
+    });
+}
@@ -1280,9 +1286,15 @@
-                  <div class="product-card-img" data-3d-slot="${p.id}" data-glb="${p.glb || ''}">
-                    <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.parentNode.innerHTML='<div style=\\'...\\'>${p.name.charAt(0)}</div>'">
-                  </div>
+                  <div class="product-card-img" data-3d-slot="${p.id}" data-glb="${escapeAttr(p.glb || '')}">
+                    <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" loading="lazy" data-fallback="${escapeAttr(p.name.charAt(0))}">
+                  </div>
@@ -1297,6 +1309,16 @@
     root.innerHTML = `...`;
+    // 画像フォールバックを DOM API で安全に
+    root.querySelectorAll('.product-card-img img[data-fallback]').forEach(img => {
+        img.addEventListener('error', () => {
+            const fb = document.createElement('div');
+            fb.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:32px;color:rgba(255,255,255,0.15);font-family:monospace;';
+            fb.textContent = img.dataset.fallback || '';
+            img.replaceWith(fb);
+        }, { once: true });
+    });
+
+function escapeAttr(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
```

加えて、`index.html` 側で以下を入れる（`p3_test.html` も同様）:

```html
<script>
  window.__INRYOKU_PUBLIC_CONFIG__ = {
    shopify: {
      storeDomain: '<%= STORE_DOMAIN %>',
      storefrontToken: '<%= STOREFRONT_TOKEN %>', // Origin 制限済みトークン
      apiVersion: '2024-10'
    }
  };
</script>
```

ビルド時テンプレ展開（簡易には `server.js` で `index.html` を読み込み時に置換する）でリポジトリ平文混入を回避する。

---

## 付録 — 確認した「良い実装」

- `MAX_BODY_SIZE = 50KB` で全 POST に上限が掛かっている (`readBody`)。
- パストラバーサル対策（`path.resolve` + prefix チェック）は基本形として正しい。
- `crypto.randomBytes(32).toString('hex')` でトークン生成、`sha256` で grey color 派生 → 暗号学的に妥当。
- `/api/grey/:number` は `isPublic=false` を 404 で見せない設計（プライバシー優先）。
- typeMsg / sendChatMsg のメッセージ表示は `textContent` で行っており XSS 安全 (line 4292, 4767)。
- 商品データ `PRODUCTS` は静的定数のため innerHTML テンプレ展開してもユーザ起点 XSS は発火しない（将来動的化に注意）。
- vendor/ ローカル化により外部 CDN 依存を最小化（SRI なしのリスクを下げている）。
- 実行時 npm dependency が無く supply chain 攻撃面が小さい。

— END —
