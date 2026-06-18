# 司さん マスター TODO（2026-04-28 時点）

> **作成日**: 2026-04-28
> **作成者**: Claude (Opus 4.7 / 1M context)
> **目的**: docs/ 配下 31 本から「司さん本人の手」が要る項目だけを抽出し、優先順位 / 所要時間 / 依存関係を一覧化する。コードは触らない。各 doc は正典のまま、本 doc は逆引き。
> **読み方**: 上から順に潰す。ただし「依存」列に上位タスクが書いてある項目はそれを先に。各タスクは「**なぜ**やるか」「**どこ**を見るか」「**完了条件**」を含む。
> **関連**: `INDEX.md`（地図）／`TIMELINE.md`（時系列）／`CONFLICTS.md`（矛盾）。

---

## 0. 全タスク総覧（優先順）

| # | タスク | 区分 | 優先 | 所要 | 依存 | 主 doc |
|---|---|---|---|---|---|---|
| T01 | Gelato で 12 商品を作成・Shopify 同期 | EC | P1 | 半日 | なし | `ec-runbook` Part 2 |
| T02 | Storefront API トークン確認・整理 | EC / sec | P1 | 30 分 | なし | `ec-runbook` 1.3 |
| T03 | Gelato API キー取得・`.env` 整備 | EC / sec | P1 | 20 分 | なし | `ec-runbook` 1.4 |
| T04 | variant GID を 12 商品 × サイズ分取得 | EC | P1 | 1〜2 時間 | T01 | `ec-runbook` Part 3 / `ec-status` 2 |
| T05 | `SHOPIFY_VARIANT_MAP` を埋める | EC | P1 | 30 分 | T04 | `ec-runbook` 4.1 |
| T06 | Gelato 連携を `enabled: true` に | EC | P1 | 5 分 | T05 | `ec-runbook` / `ec-status` 3 |
| T07 | キャッシュバスター `?v=` 更新 | EC | P1 | 5 分 | T05 | `ec-runbook` 4.3 |
| T08 | テスト注文（Bogus Gateway） | EC | P1 | 30 分 | T06 | `ec-runbook` Part 6 |
| T09 | Gelato 側「実印刷しない」設定確認 | EC | P1 | 10 分 | T01 | `ec-runbook` 2.4 |
| T10 | 統合実機テスト（MacBook Chrome） | テスト | P1 | 45 分 | T08 | `integration-test-plan` |
| T11 | 統合実機テスト（MacBook Safari） | テスト | P1 | 30 分 | T10 | 同上 |
| T12 | 統合実機テスト（iPhone iOS Safari） | テスト | P1 | 30 分 | T10 | 同上 |
| T13 | 統合実機テスト（iPad Safari） | テスト | P2 | 20 分 | T10 | 同上 |
| T14 | 統合実機テスト（Android Chrome） | テスト | P2 | 20 分 | T10 | 同上（手元にあれば） |
| T15 | Storefront token サーバ中継への移行 | sec | P1 | 1〜2 時間 | T02 | `storefront-token-migration` |
| T16 | CSP Phase 2（`'unsafe-inline'` 削減） | sec | P2 | 半日 | T15 | `csp-tuning` Phase 2 |
| T17 | CSP Phase 3（Trusted Types） | sec | P3 | 半日 | T16 | `csp-tuning` Phase 3 |
| T18 | a11y HTML 構造変更（landmark / button 化） | a11y | P2 | 半日〜 1 日 | なし | `accessibility-audit` Critical C-1〜C-3 |
| T19 | a11y aria-live / フォーカストラップ | a11y | P2 | 数時間 | T18 | `accessibility-audit` Critical C-7, C-8 |
| T20 | mobile-ux-flow 改善案を実装 doc 化 | UX | P2 | 数時間 | なし | `mobile-ux-flow` 末尾 diff |
| T21 | copy-audit Major 残対応 | コピー | P2 | 数時間 | なし | `copy-audit` Major 章 |
| T22 | error-handling E-S 状態異常 個別 UX | UX / err | P2 | 数時間〜 1 日 | なし | `error-handling-audit` 2.4 |
| T23 | Codex review 未対応指摘 ~3 件の解消 | 品質 | P2 | 1〜2 時間 | なし | `codex-review` 末尾 |
| T24 | Lighthouse 実機計測（4 軸） | 計測 | P2 | 1 時間 | T08 | `lighthouse-roadmap` |
| T25 | Lighthouse D-tasks 残部分着地 | perf | P2 | 数時間 | T24 | `lighthouse-d-tasks` |
| T26 | i18n Phase 1 公開判断（`?lang=en`） | i18n | P3 | 30 分 | T10 | `i18n-foundation` Phase 1 |
| T27 | i18n Phase 2 着手判断（`/en/` prerender） | i18n | P3 | TBD | T26 + 反応 | `i18n-foundation` Phase 2 |
| T28 | sitemap.xml / robots.txt 本番ホスト名整合 | SEO | P2 | 15 分 | なし | `seo-metadata` |
| T29 | JSON-LD Product 拡張 | SEO | P3 | 1 時間 | T05 | `seo-metadata` |
| T30 | DevOps mental model のチーム共有 | ops | P3 | 30 分 | なし | `devops` |
| T31 | テストスイート CI 接続 | ops | P3 | 1 時間 | なし | `test-suite-expansion` |
| T32 | 本番ドメイン `inryoku.com` 取得 / DNS / SSL | ops | P1 | 1 時間〜 | なし | `ec-runbook` 1.1 |
| T33 | Shopify Payments 本番モード切替 | ops | P1 | 30 分 | T08 | `ec-runbook` Part 6 |
| T34 | Webhook 動作確認（Gelato 自動注文） | ops | P1 | 20 分 | T08 | `ec-runbook` 7.6 / `ec-status` 既知の懸念 |
| T35 | Storefront token のスコープ最小化 | sec | P2 | 15 分 | T02 | `ec-runbook` 1.3 末尾 |

> **優先**: P1 = 今週中 / P2 = 2 週間以内 / P3 = 余裕で順次。
> **所要**: 連続作業時間目安。中断ありの実時間ではない。

---

## 1. 区分別詳細

### 1.A EC ローンチ（P1 — 最重要クラスタ）

これは「サイトを公開して買えるようにする」最終段。**T01 → T04 → T05 → T06 → T08 → T33** が直列の hot path。

#### T01. Gelato で 12 商品を作成・Shopify 同期
- **なぜ**: variant GID を埋めるには Shopify 側に商品が存在している必要がある。Gelato で作ると Shopify に同期される。
- **どこ**: Gelato dashboard → 商品作成。12 SKU は `ec-status` に列挙：
  - `enter-hoodie` / `logo-hoodie` / `enter-hoodie-white` / `logo-hoodie-oversized`
  - `enter-tee` / `logo-tee`
  - `enter-longsleeve` / `logo-longsleeve`
  - `enter-crewneck` / `logo-crewneck`
  - `enter-tank` / `logo-tank`
- **完了条件**: Shopify 管理画面 → 商品 で全 12 SKU が出ており、サイズ展開（XS〜XXL 等）も同期されている。
- **詳細手順**: `ec-runbook` Part 2.1 〜 2.3。

#### T02. Storefront API トークン確認・整理
- **なぜ**: クライアント側ハードコード（`p3_code_for_claude.js:66`）と `.env` 側の二重に存在している可能性。整理しないと（a）漏れる、（b）期限切れで突然落ちる。
- **どこ**: Shopify 管理画面 → アプリ → Headless → トークン表。
- **完了条件**: 1 つのトークンに統一、スコープが必要最低限（unauthenticated_read_product_*, write_checkouts のみ）、`.env` に書かれている値とコード内の値が一致。
- **詳細**: `ec-runbook` 1.3 / 1.5。

#### T03. Gelato API キー取得・`.env` 整備
- **なぜ**: サーバ `/api/gelato/order` で必要。**クライアント JS には絶対書かない**（漏れたら他人が司さん名義で無料注文できる）。
- **どこ**: Gelato dashboard → Account settings → API → Create API key。
- **完了条件**: `.env` の `GELATO_API_KEY=` が埋まっている。`server.js` から読めている。
- **詳細**: `ec-runbook` 1.4。

#### T04. variant GID を 12 商品 × サイズ分取得
- **なぜ**: Shopify Storefront API の cartCreate は variant GID を要求する。サイズ毎に別 GID。
- **どこ**: 方法 A（簡単・1 個ずつ）= 商品詳細 URL から抽出 / 方法 B（推奨）= Admin API GraphQL で一括。
- **完了条件**: 12 商品 × サイズ数 の `gid://shopify/ProductVariant/...` を全部スプレッドシート等に控えている。
- **詳細**: `ec-runbook` Part 3 全体（特に 3.2 GraphQL Admin API 推奨、3.3 ID 形式）。

#### T05. `SHOPIFY_VARIANT_MAP` を埋める
- **なぜ**: `p3_code_for_claude.js:71` の MAP に GID が入らないと「カートに入れる」が落ちる（`Cart creation failed`）。
- **どこ**: `p3_code_for_claude.js:71` 付近、`SHOPIFY_VARIANT_MAP = { ... }`。
- **完了条件**: 12 商品分の全サイズに値が入っている。空文字 / プレースホルダ残ゼロ。
- **詳細**: `ec-runbook` 4.1 / `ec-status` セクション 2 にコード例あり。

#### T06. Gelato 連携を `enabled: true` に
- **なぜ**: 現状は安全のため `false`（注文時に Gelato に投げない）。本番では `true` にする。
- **どこ**: `p3_code_for_claude.js:91` の `GELATO_CONFIG.enabled`。
- **完了条件**: `true` になっており、サーバ `/api/gelato/order` 経由でテスト注文が Gelato 側にも届く。
- **詳細**: `ec-status` セクション 3 / `ec-runbook` 4.2。

#### T07. キャッシュバスター `?v=` 更新
- **なぜ**: `index.html` / `p3_test.html` の各 `<script src="...?v=N">` を更新しないと、ブラウザキャッシュで旧 JS が走り、variant が空に見える。
- **完了条件**: 主要スクリプトの `?v=` が現状最新値より +1。
- **詳細**: `ec-runbook` 4.3。

#### T08. テスト注文（Bogus Gateway）
- **なぜ**: 本番決済前に「商品 → カート → checkout → 注文確定 → Gelato 受信」の一気通貫を 1 度実走する。
- **どこ**: Shopify 管理画面 → 設定 → 決済 → Bogus Gateway を有効化、または Shopify Payments テストモード。
- **完了条件**: Shopify 側に注文レコード、Gelato 側に注文（**実印刷しない設定** 前提 / T09）が来る。
- **詳細**: `ec-runbook` Part 6 全体。

#### T09. Gelato 側「実印刷しない」設定確認
- **なぜ**: テスト注文で実物が刷られて司さんに届くと無駄。Gelato 側でテスト時は印刷停止に。
- **完了条件**: Gelato dashboard でテスト注文が「待機 / 印刷しない」で止まっている。
- **詳細**: `ec-runbook` 2.4。

#### T32. 本番ドメイン `inryoku.com` 取得 / DNS / SSL
- **なぜ**: Shopify 側にカスタムドメインを当てないと OG / SEO / メール送信元が `*.myshopify.com` のままになる。
- **完了条件**: `https://inryoku.com/` が司さんのサイトを返し、SSL 証明書有効、Shopify 側で primary domain 設定済み。
- **詳細**: `ec-runbook` 1.1 周辺。

#### T33. Shopify Payments 本番モード切替
- **なぜ**: Bogus Gateway / テストモードのままでは本番で決済できない。
- **完了条件**: 本番モード ON、銀行口座送金先確認、最初の実注文で実カード決済が通る。

#### T34. Webhook 動作確認（Gelato 自動注文）
- **なぜ**: `ec-status` の「既知の懸念」に「Gelato Shopify アプリ側が webhook で受けるので、サーバ側 `/api/gelato/order` は実は不要かも」とある。**どちらが正経路か** を実測で確定。
- **完了条件**: 「正経路は X」と決まり、もう一方は無効化または fallback として記録。
- **詳細**: `ec-runbook` 7.6。

---

### 1.B 実機テスト（P1）

T08 が通った後にやる。各端末でクリティカルフローを潰す。

#### T10. MacBook Chrome
- **なぜ**: 司さんのメイン環境。最も再現される。
- **完了条件**: `integration-test-plan` のチェックリスト（粒子表示 / コピー / カート / checkout / フッター / ESC / Tab / reduced-motion）全部 `[x]`。

#### T11. MacBook Safari
- **なぜ**: WebKit 固有のバグ（CSS / Service Worker / WebGL）。`browser-compatibility-matrix` で要注意ポイント明示。
- **完了条件**: 同上 + Safari 固有チェック（IndexedDB / SW / OG プレビュー）。

#### T12. iPhone iOS Safari
- **なぜ**: モバイル振り分け（→ `p3_test.html`）の本番経路。
- **完了条件**: タップ / ピンチ / safe-area / address bar 動作 / モーション / カート / checkout が全部動く。

#### T13. iPad Safari
- **なぜ**: タブレットのレイアウト分岐確認。
- **完了条件**: 横向き / 縦向き両方で動く。

#### T14. Android Chrome（手元にあれば）
- **なぜ**: 取りこぼし防止。
- **完了条件**: 主要フロー通る。手元に無ければ skip 可。

---

### 1.C セキュリティ仕上げ（P1〜P2）

#### T15. Storefront token サーバ中継への移行（P1）
- **なぜ**: フロント JS にトークンが書かれていると（公開可能 token とはいえ）スコープ拡大時に攻撃面になる。サーバ中継にすると一段安全。
- **どこ**: `storefront-token-migration` doc に設計あり。`server.js` に `/api/storefront/*` プロキシ追加 + フロントから直接 Shopify を叩く部分を全部この経路に切り替え。
- **完了条件**: フロント JS 内の `storefrontToken` ハードコードがなくなり、CSP の `connect-src` から Shopify ドメインを外してもサイトが動く。
- **詳細**: `storefront-token-migration` 全文。

#### T16. CSP Phase 2（P2）
- **なぜ**: 現状の CSP は `'unsafe-inline'` を script-src/style-src 両方に持ち、防御力 70% 損失（`csp-tuning` 診断）。
- **完了条件**: nonce 完全化、`'unsafe-inline'` 削除、サイトが落ちない。
- **詳細**: `csp-tuning` Phase 2 / `csp-phase1-impl` の続き。

#### T17. CSP Phase 3（P3）
- **なぜ**: Trusted Types で DOM XSS の主要ベクタを潰す。
- **完了条件**: `require-trusted-types-for 'script'` を強制、違反ゼロ。
- **詳細**: `csp-tuning` Phase 3。

#### T35. Storefront token のスコープ最小化（P2）
- **なぜ**: 現状 scope を絞っているか不明。広いと万一漏れたとき被害大。
- **完了条件**: `unauthenticated_read_product_*`, `unauthenticated_write_checkouts` のみに絞る。書き込み顧客系 / 在庫系を切る。
- **詳細**: `ec-runbook` 1.3 末尾。

---

### 1.D アクセシビリティ仕上げ（P2）

#### T18. a11y HTML 構造変更（landmark / button 化）
- **なぜ**: `accessibility-audit` Critical C-1（landmark / `<h1>` 不在）/ C-2（ロゴ alt 空 + brand-name span 集合で SR 一字読み）/ C-3（クリック可 div の button 化）。CSS では潰せない。
- **完了条件**: SR で「メインコンテンツへスキップ」が効く / `<h1>` 1 個 / brand-name 全体に `aria-label="inryokü"` / クリック可要素は `<button>` か `role="button" tabindex="0"`。
- **詳細**: `accessibility-audit` C-1, C-2, C-3。

#### T19. a11y aria-live / フォーカストラップ
- **なぜ**: モーダル / ドロワーのフォーカストラップ未実装、動的更新の `aria-live` 不在（C-7, C-8）。
- **完了条件**: モーダル開でフォーカスが内側に閉じる / ESC で閉じる / 開いた要素にフォーカス戻る / カート追加時 `aria-live` でアナウンス。
- **詳細**: `accessibility-audit` C-7, C-8。

---

### 1.E UX / コピー / エラー（P2）

#### T20. mobile-ux-flow 改善案を実装 doc 化
- **なぜ**: `mobile-ux-flow` には diff 形式の提案が末尾にあるが、実装 doc が存在しない。やるなら提案を細分化して doc 化 → 実装。
- **完了条件**: `mobile-ux-fixes-2026-XX-XX.md` 等を新規起こし、提案を分類（採用 / 後回し / 不採用）したうえで採用分を反映。
- **詳細**: `mobile-ux-flow` 末尾。

#### T21. copy-audit Major 残対応
- **なぜ**: `critical-copy-fixes` で潰したのは Critical のみ。Major / Minor が `copy-fix-runtime.js` に未追加。
- **完了条件**: Major の指摘がすべて差し替えられているか、保留判断が doc 化されている。
- **詳細**: `copy-audit` Major / Minor 章。

#### T22. error-handling E-S 状態異常 個別 UX
- **なぜ**: `error-handling-audit` の E-S01〜E-S14（オフライン / 在庫切れ / token 失効 / 4xx / 5xx / タイムアウト 等）の UX が `error-shield` で網羅されていない。
- **完了条件**: 各 E-S に対し「その状況で何が画面に出るか」が決まり、実装または保留判断あり。
- **詳細**: `error-handling-audit` 2.4。

#### T23. Codex review 未対応指摘 ~3 件
- **なぜ**: `codex-review` で総合 B+ ながら未消化指摘あり（小さな仕上げ残）。
- **完了条件**: 指摘 3 件をそれぞれ「対応 / 保留 / 不採用」で決着。
- **詳細**: `codex-review` 末尾。

---

### 1.F 計測と Lighthouse（P2）

#### T24. Lighthouse 実機計測（4 軸）
- **なぜ**: `lighthouse-roadmap` は推定値止まり（実機未実行）。実数値を取ってから残タスクを決定。
- **完了条件**: Performance / Accessibility / Best Practices / SEO の 4 軸の実値が 1 セット記録されている（モバイル / デスクトップ）。
- **詳細**: `lighthouse-roadmap` 冒頭。

#### T25. Lighthouse D-tasks 残部分着地
- **なぜ**: 実値を見て、ボトルネックの大きいものから順に潰す。`lighthouse-d-tasks` の進捗表で残を確認。
- **完了条件**: 4 軸とも 90+。

---

### 1.G i18n（P3）

#### T26. i18n Phase 1 公開判断（`?lang=en`）
- **なぜ**: 土台は出来ている（`i18n-foundation`）。`?lang=en` で英訳が走るか実機で確認 → 公開可否判断。
- **完了条件**: 司さんが「公開する / しない / 一部だけ」を決定。
- **詳細**: `i18n-foundation` Phase 1。

#### T27. i18n Phase 2 着手判断（`/en/` prerender）
- **なぜ**: Phase 1 の反応次第で Phase 2（静的 prerender ＋ `hreflang`）に昇格。
- **完了条件**: 「やる / やらない / 後回し」が決まる。
- **詳細**: `i18n-foundation` Phase 2。

---

### 1.H SEO（P2〜P3）

#### T28. sitemap.xml / robots.txt 本番ホスト名整合
- **なぜ**: 現状の sitemap / robots は仮ホスト名の可能性。本番 `inryoku.com` 確定後にチェック。
- **完了条件**: sitemap の URL が `https://inryoku.com/` で始まる。robots が production 用。
- **詳細**: `seo-metadata`。

#### T29. JSON-LD Product 拡張
- **なぜ**: 現状 JSON-LD は基本のみ。Product / Offer まで詳細化すると検索結果に効く。
- **完了条件**: 12 商品分の Product JSON-LD が `<head>` または body 末に挿入されている（variant 価格 / 在庫まで）。
- **依存**: T05（variant が固まってから）。
- **詳細**: `seo-metadata`。

---

### 1.I 運用基盤（P3）

#### T30. DevOps mental model のチーム共有
- **なぜ**: 司さんがいま 1 人運用でも、Codex / Claude セッションで作業者が変わる。`devops` の mental model を毎回読み直すより固定する。
- **完了条件**: `devops` 冒頭の mental model 章を、新規セッションのオンボーディング起点として `INDEX.md` 推奨フローに組み込み済（本 INDEX で対応済 ✓）。

#### T31. テストスイート CI 接続
- **なぜ**: `test-suite-expansion` で揃えたテストが手動実行のまま。CI に乗せるとレグレッション検知。
- **完了条件**: GitHub Actions / 何らかの CI で push 時にテストが走る。
- **詳細**: `test-suite-expansion`。

---

## 2. 「依存グラフ」テキスト版

```
T01 (Gelato 商品作成)
 ├── T04 (variant GID 取得)
 │    └── T05 (MAP 埋め)
 │         ├── T06 (Gelato 有効化)
 │         │    └── T08 (テスト注文)
 │         │         ├── T10 (実機テスト Chrome)
 │         │         │    ├── T11 (Safari)
 │         │         │    ├── T12 (iPhone)
 │         │         │    ├── T13 (iPad)
 │         │         │    └── T14 (Android)
 │         │         ├── T24 (Lighthouse 実機)
 │         │         │    └── T25 (D-tasks 残)
 │         │         ├── T33 (Payments 本番切替)
 │         │         └── T34 (Webhook 確認)
 │         └── T29 (Product JSON-LD)
 │         └── T07 (?v= 更新)
 └── T09 (実印刷しない設定)

T02 (Storefront token 確認)
 └── T15 (token サーバ中継)
      └── T16 (CSP Phase 2)
           └── T17 (CSP Phase 3)
 └── T35 (token スコープ最小化)

T03 (Gelato API key)（独立）

T18 (HTML 構造変更)（独立）
 └── T19 (aria-live / focus trap)

T20 (mobile-ux 実装 doc 化)（独立）
T21 (copy Major)（独立）
T22 (error E-S 個別 UX)（独立）
T23 (Codex review 未対応)（独立）

T26 (i18n Phase 1 判断)
 └── T27 (Phase 2 着手判断)

T28 (sitemap 本番ホスト名)（独立、T32 後）
T32 (本番ドメイン取得)（独立、T33 前）

T30 (DevOps 共有)（独立）
T31 (テスト CI)（独立）
```

---

## 3. 「最短で公開」走り方（hot path だけ）

T01 → T02 → T03 → T04 → T05 → T07 → T09 → T06 → T08 → T10 → T32 → T33

これだけ通せば「買える状態」になる。a11y / CSP Phase 2/3 / i18n / Lighthouse 仕上げは **公開後でも追える**（既に最低限は済んでいる）。

---

## 4. 「先送りしてよい」候補（50→101 哲学）

メモリの「50 に戻して 101 を出す」哲学に沿って、**やらない選択もある** 項目：

- **T17 CSP Phase 3 (Trusted Types)** — Phase 2 まで行けば実害は小。Phase 3 は理想形だが司さん 1 人運用では維持コスト高。**保留推奨**。
- **T27 i18n Phase 2** — Phase 1 の反応がなければ着手意義薄い。**反応見て判断**。
- **T20 mobile-ux 改善の全部** — 提案には「やらないほうが inryokü らしさが残る」項目があり得る。**取捨選択前提**。
- **T29 JSON-LD Product 拡張** — 検索流入を主導線にしないなら過剰。**広告 / SNS 起点なら不要**。
- **T31 CI 接続** — 1 人運用なら手動 npm test でも回る。**チーム化したら導入**。

---

## 5. 「外部依存で詰まりがち」な箇所

司さんの裁量で進められない部分：

- **T01 Gelato 商品作成** — Gelato 側のフォーム入力 + 印刷データ準備で詰まりがち。1 商品ずつ進める（`ec-runbook` 推奨）。
- **T32 ドメイン取得** — DNS 反映 24〜48 時間待ち。早めに着手。
- **T33 Shopify Payments 審査** — 銀行口座 / 本人確認の審査時間。早めに着手。

---

## 6. 完了条件の「観測者」原則

各タスクは「**画面 / ログ / dashboard で実物を見る**」で完了とする。「コミットした」「設定した」は完了ではない。

- T05 完了 = ブラウザ DevTools で `SHOPIFY_VARIANT_MAP` を console.log して 12 SKU すべて埋まっている。
- T08 完了 = Shopify 注文 1 件、Gelato 注文 1 件、両方 dashboard に映る。
- T10〜T14 完了 = チェックリストの全項目が `[x]`。

「観測した」を完了の判定基準にする。

---

## 7. 一言サマリ

> **EC を動かす → 実機で潰す → セキュリティ仕上げ → a11y / Lighthouse 仕上げ → i18n は様子見。**
> P1 だけで公開可能。P2 は公開しつつ並走。P3 は数ヶ月単位。
