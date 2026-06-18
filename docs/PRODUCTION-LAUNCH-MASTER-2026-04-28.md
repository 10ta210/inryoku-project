# inryokü 本番公開 マスターチェックリスト（2026-04-28）

> **作成日**: 2026-04-28
> **作成者**: Claude (Opus 4.7 / 1M context)
> **目的**: docs/ 31 本横断の「司さん 1 人で本番公開を完遂する」ための単一窓口。チェックボックスだけ追えば公開できる粒度に砕いてある。
> **性質**: 読み取り専用ハブ。コードは触らない。各項目は「正典 doc」へ逆引き。
> **読み方**: §1 で公開判定の前提を読む → §2 P0 ブロッカーから順に潰す → §5 検証フローで実走 → §8 公開当日タイムラインで本番化。
> **caveman talk**: 端的・命令形・余白少なめ。
> **哲学**: 「観測者」原則（`TODO-MASTER` §6）— ダッシュボード / ブラウザ / curl で **実物を見て** 完了とする。「設定した」は完了でない、「見えた」が完了。

参照（必読、本 doc は地図、これら doc が真実）:
- [`INDEX.md`](INDEX.md) — 全 31 doc の地図
- [`TODO-MASTER-2026-04-28.md`](TODO-MASTER-2026-04-28.md) — 全 35 タスクの詳細
- [`ec-runbook-2026-04-28.md`](ec-runbook-2026-04-28.md) — EC 運用 Runbook
- [`integration-test-plan-2026-04-28.md`](integration-test-plan-2026-04-28.md) — 実機テスト計画
- [`devops-2026-04-28.md`](devops-2026-04-28.md) — DevOps Operations Guide
- [`lighthouse-roadmap-2026-04-28.md`](lighthouse-roadmap-2026-04-28.md) — Lighthouse 90+ ロードマップ
- [`security-fixes-2026-04-28.md`](security-fixes-2026-04-28.md) — セキュリティ修正反映
- [`accessibility-audit-2026-04-28.md`](accessibility-audit-2026-04-28.md) — a11y 監査
- [`csp-tuning-2026-04-28.md`](csp-tuning-2026-04-28.md) / [`csp-phase1-impl-2026-04-28.md`](csp-phase1-impl-2026-04-28.md) — CSP

---

## 目次

1. [公開判定の前提](#1-公開判定の前提)
2. [P0 ブロッカー（公開停止級）](#2-p0-ブロッカー公開停止級)
3. [P1 重要（公開後すぐ）](#3-p1-重要公開後すぐ)
4. [P2 推奨（30 日以内）](#4-p2-推奨30-日以内)
5. [検証フロー（順序付き 10 ステップ）](#5-検証フロー順序付き-10-ステップ)
6. [設定本番値チェック](#6-設定本番値チェック)
7. [緊急時対応](#7-緊急時対応)
8. [公開当日タイムライン](#8-公開当日タイムライン)
9. [公開後 7 日間運用](#9-公開後-7-日間運用)
10. [最短公開ルート（ミニマム）](#10-最短公開ルートミニマム)

---

## 1. 公開判定の前提

「公開できる状態」とは何か。先に定義してから判定する。

### 1.1 公開とは何か

- 「**観測者から見て買える**」状態にすること。
- カート → checkout → 決済 → 注文確定 → Gelato 受注 まで実物が観測できる。
- ドメイン `inryoku.com` で SSL 証明書付き 200 OK。
- 司さんが管理画面と error toast を 1 日 1 回見られる体制ができている。

### 1.2 公開判定の必要十分条件

**必要条件（これがないと公開不可、§2）:**

- [ ] P0 ブロッカー全て解消
- [ ] §5 の検証フロー 10 ステップ全通過（最低 MacBook Chrome / iPhone Safari は実走）
- [ ] §6 の本番値チェック全埋

**十分条件（公開後すぐ追える、§3）:**

- P1 は公開後 7 日以内に潰せばよい。

### 1.3 推測の明示

本 doc は以下を **推測** している（実機未確認 / 司さん側の状況不明）:

- 推測 1: ドメイン `inryoku.com` は **未取得 or 取得済みか不明**。`ec-runbook` 1.1 が「未取得 or 取得済み」と両論併記。
- 推測 2: Shopify Payments の本番審査（銀行口座 / 本人確認）状況は不明。`TODO-MASTER` T33。
- 推測 3: Gelato の 12 商品作成は **未着手** と仮定（`ec-status` セクション 1）。
- 推測 4: 司さんの実機は MacBook + iPhone は確実、iPad / Android は手元にあるか不明。
- 推測 5: GA4 プロパティが用意済か不明。`lighthouse-roadmap` 1.3 で「placeholder `G-XXXXXXXXXX`」とある。
- 推測 6: 本番ホスティング先（Render / Vercel / VPS）の決定状況不明。`devops` §5 で 3 択提示。

これらが司さん側で **既に解決済み** なら該当チェックは即 `[x]`。未解決なら本 doc が示す手順で潰す。

### 1.4 哲学的前提

> 公開は「完成」ではない。**観測の開始点**。
> P0 = 観測される前に閉じておくべき穴。
> P1 = 観測されながら塞ぐ穴。
> P2 = 観測の精度を上げる作業。
> 50→101 哲学（メモリ）に従い、**P3 は公開後やらない判断もある**。

---

## 2. P0 ブロッカー（公開停止級）

これらが 1 個でも未解消なら公開しない。各項目「観測条件」を満たして `[x]`。

### 2.1 EC: variant ID 全埋（最重要 hot path）

正典: [`ec-runbook` Part 3 / Part 4](ec-runbook-2026-04-28.md) / [`TODO-MASTER` T01〜T07](TODO-MASTER-2026-04-28.md#0-全タスク総覧優先順)

- [ ] **P0-EC-01** Gelato で 12 商品作成・Shopify 同期完了（`ec-runbook` 2.1〜2.3 / `TODO-MASTER` T01）
  - 観測: Shopify 管理画面 → 商品 で 12 SKU 全表示
  - SKU: `enter-hoodie`, `logo-hoodie`, `enter-hoodie-white`, `logo-hoodie-oversized`, `enter-tee`, `logo-tee`, `enter-longsleeve`, `logo-longsleeve`, `enter-crewneck`, `logo-crewneck`, `enter-tank`, `logo-tank`
- [ ] **P0-EC-02** variant GID を 12 商品 × 全サイズ分取得（`ec-runbook` Part 3 / `TODO-MASTER` T04）
  - 観測: スプレッドシートに `gid://shopify/ProductVariant/...` が全行埋まる
  - 推奨: 方法 B（GraphQL Admin API、`ec-runbook` 3.2）で一括
- [ ] **P0-EC-03** `SHOPIFY_VARIANT_MAP` を `p3_code_for_claude.js:71` に埋める（`ec-runbook` 4.1 / `TODO-MASTER` T05）
  - 観測: ブラウザ DevTools console で `SHOPIFY_VARIANT_MAP` を console.log → 12 SKU 全部 GID 入り、空文字 / プレースホルダゼロ
- [ ] **P0-EC-04** Gelato 連携を `enabled: true` に（`p3_code_for_claude.js:91` / `TODO-MASTER` T06）
  - 観測: コード grep で `GELATO_CONFIG.enabled = true`
- [ ] **P0-EC-05** キャッシュバスター `?v=` を全主要 script で更新（`ec-runbook` 4.3 / `TODO-MASTER` T07）
  - 観測: `index.html` / `p3_test.html` の `<script src="...?v=">` が今日の日付
  - コマンド: `npm run release`（`devops` §3）
- [ ] **P0-EC-06** Gelato 側「Manual approval」または本番自動印刷の判断（`ec-runbook` 2.4 / `TODO-MASTER` T09）
  - 観測: 公開直前は Manual のまま → 公開判断後に Automatic に切替（順序重要）

### 2.2 法定ページ・必須ページ

正典: [`seo-metadata-2026-04-28.md`](seo-metadata-2026-04-28.md) / Shopify 管理画面

- [ ] **P0-LAW-01** 特定商取引法に基づく表記（販売者名 / 住所 / 連絡先 / 返品条件）が公開ページとして存在
  - 推測: Shopify 管理画面 → 設定 → 法務 → ポリシー で生成可能
  - 観測: `https://inryoku.com/policies/terms-of-service` 等が 200
- [ ] **P0-LAW-02** プライバシーポリシー（GDPR / 個人情報保護法）
  - 観測: `/policies/privacy-policy` 200
- [ ] **P0-LAW-03** 返品・交換ポリシー（POD なので原則受注生産・返品不可を明記）
  - 観測: `/policies/refund-policy` 200
- [ ] **P0-LAW-04** 配送ポリシー（Gelato 経由・配送日数・国際配送対応範囲）
  - 観測: `/policies/shipping-policy` 200
- [ ] **P0-LAW-05** Cookie / トラッキング同意（GA4 入れるなら必須地域あり）
  - 推測: 日本市場のみなら最低限「使用してます」表記。EU 出荷するなら同意バナー必須

### 2.3 ドメイン・SSL・DNS

正典: [`ec-runbook` 1.1](ec-runbook-2026-04-28.md) / [`devops` §5](devops-2026-04-28.md) / [`TODO-MASTER` T32](TODO-MASTER-2026-04-28.md)

- [ ] **P0-DOM-01** ドメイン `inryoku.com`（または決定ドメイン）取得済
  - 観測: `whois inryoku.com` で司さん名義
- [ ] **P0-DOM-02** DNS A / CNAME を Shopify or ホスティング先に向け済
  - 観測: `dig +short inryoku.com` で正しい IP / CNAME
- [ ] **P0-DOM-03** SSL 証明書有効
  - 観測: `curl -sI https://inryoku.com/ | head -1` で `HTTP/2 200`
  - ブラウザで鍵アイコン緑
- [ ] **P0-DOM-04** Shopify primary domain に `inryoku.com` 設定済（Shopify 管理画面 → 設定 → ドメイン）
  - 観測: `*.myshopify.com` にアクセスしても `inryoku.com` に 301 リダイレクト
- [ ] **P0-DOM-05** `https://www.inryoku.com/` も `https://inryoku.com/` に正規化（または逆）
  - 観測: どちらか一方 301、もう一方 200
- [ ] **P0-DOM-06** `http://` → `https://` の強制リダイレクト（HSTS）
  - 観測: `curl -sI http://inryoku.com/ | head -1` で `301`、レスポンスに `Strict-Transport-Security`

### 2.4 `.env` 本番値完備

正典: [`devops` §4](devops-2026-04-28.md) / [`ec-runbook` 1.2](ec-runbook-2026-04-28.md)

- [ ] **P0-ENV-01** 本番 `.env`（or プラットフォーム env vars）に必須キー 5 種全埋
  - `SHOPIFY_STORE_DOMAIN`
  - `SHOPIFY_STOREFRONT_TOKEN`
  - `GELATO_API_KEY`
  - `GROQ_API_KEY`
  - `ADMIN_API_KEY`
- [ ] **P0-ENV-02** `NODE_ENV=production` 明示
  - 観測: 本番サーバログに 起動時 `production` 表示
- [ ] **P0-ENV-03** `npm run check:env` を本番 env file に対して実行 → 全 `OK`
  - コマンド: `bash scripts/check-env.sh --file .env.production --strict`
- [ ] **P0-ENV-04** `.env*` が git リポジトリに **コミットされていない**
  - 観測: `git ls-files | grep -E '^\.env' | grep -v '\.env\.example$'` 空
- [ ] **P0-ENV-05** Storefront token / Gelato key / Groq key が **コミットされていない**
  - 観測: `git log --all -p | grep -E 'shpat_|gsk_|GELATO_API_KEY=...' | head` で値漏洩なし
  - もし漏れていたら **即ローテーション**（`devops` §9）

### 2.5 `ADMIN_DEV_BYPASS` 本番無効

正典: [`security-fixes-2026-04-28.md` §43](security-fixes-2026-04-28.md) / [`ec-runbook` 9-28](ec-runbook-2026-04-28.md)

- [ ] **P0-ADM-01** 本番 env vars に `ADMIN_DEV_BYPASS` が **存在しない**（or `=0`）
  - 観測: 本番ホスティング dashboard に該当キーが無いことを目視
- [ ] **P0-ADM-02** 本番で admin endpoint (`/api/subscribers`) を `ADMIN_API_KEY` 無し curl → 503 / 401 が返る
  - コマンド: `curl -i https://inryoku.com/api/subscribers` → `401` or `503`
  - 注: `/api/admin/*` 名前空間は実装されていない（実体は `/api/subscribers` のみ）
- [ ] **P0-ADM-03** `NODE_ENV=production` 下で bypass が構造的に効かないことを確認
  - 根拠: `security-fixes` §43 「`ADMIN_DEV_BYPASS=1` かつ `NODE_ENV !== 'production'` の組合せ時のみ bypass」

### 2.6 セキュリティ修正反映

正典: [`security-fixes-2026-04-28.md`](security-fixes-2026-04-28.md) / [`security-review-2026-04-28.md`](security-review-2026-04-28.md) / [`csp-phase1-impl-2026-04-28.md`](csp-phase1-impl-2026-04-28.md)

- [ ] **P0-SEC-01** F1〜F13（`security-fixes` 全 Critical 項目）が反映済
  - 観測: `git log --grep="security-fixes" --oneline | head` で commit 一覧
- [ ] **P0-SEC-02** セキュリティヘッダ 6 種返る（`integration-test-plan` 0.3.3）
  - コマンド: `curl -sI https://inryoku.com/ | grep -E 'X-Content-Type-Options|X-Frame-Options|Referrer-Policy|Permissions-Policy|Strict-Transport-Security|Content-Security-Policy'`
  - 期待: 6 行返る
- [ ] **P0-SEC-03** CSP Phase 1 適用（`csp-phase1-impl` 完了確認）
  - 観測: `Content-Security-Policy` ヘッダに nonce が含まれる
- [ ] **P0-SEC-04** Storefront token のスコープが必要最低限
  - 観測: Shopify 管理画面 → アプリ → Headless → スコープが `unauthenticated_read_product_*` + `unauthenticated_write_checkouts` のみ
  - `TODO-MASTER` T35
- [ ] **P0-SEC-05** Gelato API key が **クライアント JS に書かれていない**
  - 観測: `grep -ri "GELATO_API_KEY\|gelato.*key" *.js *.html` でハードコード無し
- [ ] **P0-SEC-06** SSRF / CORS / `.env` 平文の Critical 修正反映（`security-fixes` F2 / F3 / F1）
- [ ] **P0-SEC-07** pre-commit hook が secret パターン検知で blocking する（`devops` §2）
  - 観測: テスト用にダミー `sk-...` を含むファイル作って commit 試行 → reject
  - 後始末: ダミーファイル削除

---

## 3. P1 重要（公開後すぐ）

公開してから 7 日以内に潰す。観測されながら塞ぐ。

### 3.1 Lighthouse 実機計測 + 90 達成

正典: [`lighthouse-roadmap-2026-04-28.md`](lighthouse-roadmap-2026-04-28.md) / [`lighthouse-d-tasks-2026-04-28.md`](lighthouse-d-tasks-2026-04-28.md) / [`TODO-MASTER` T24, T25](TODO-MASTER-2026-04-28.md)

- [ ] **P1-LH-01** Lighthouse 実機計測 4 軸（Mobile / Desktop 各）
  - コマンド: Chrome DevTools → Lighthouse → 各プロファイルで run
  - 対象: `https://inryoku.com/` / `https://inryoku.com/p3_test.html`
  - 観測: スコア 4 軸 × 2 プロファイル × 2 ページ = 16 値を記録
- [ ] **P1-LH-02** SEO 100（GA4 ID 実値投入で到達見込み、`lighthouse-roadmap` 1.3）
  - 観測: 実値スコア 100
- [ ] **P1-LH-03** Best Practices 95+（`lighthouse-roadmap` 推定で到達見込み）
- [ ] **P1-LH-04** Performance 70+ Mobile / 85+ Desktop（30 日目標、`lighthouse-roadmap` §7）
- [ ] **P1-LH-05** Accessibility 90+（HTML 側 C-1〜C-5 残作業の解消、`lighthouse-roadmap` §7）

### 3.2 a11y Critical（HTML 側残作業）

正典: [`accessibility-audit-2026-04-28.md`](accessibility-audit-2026-04-28.md) C-1〜C-8 / [`TODO-MASTER` T18, T19](TODO-MASTER-2026-04-28.md)

- [ ] **P1-A11Y-01** landmark / `<h1>` 1 個 / `<main>` 構造（C-1）
- [ ] **P1-A11Y-02** brand-name 全体に `aria-label="inryokü"`、ロゴ alt 適切（C-2）
- [ ] **P1-A11Y-03** クリック可 div を `<button>` か `role="button" tabindex="0"` 化（C-3）
- [ ] **P1-A11Y-04** モーダル/ドロワーのフォーカストラップ（C-7）
  - 観測: モーダル開でフォーカスが内側に閉じる、ESC で閉じる、開いた要素にフォーカス戻る
- [ ] **P1-A11Y-05** 動的更新の `aria-live` 不在解消（C-8）
  - 観測: カート追加時に SR がアナウンス
- [ ] **P1-A11Y-06** SR で「メインコンテンツへスキップ」リンク有効
- [ ] **P1-A11Y-07** `viewport-fit=cover` 入り（`lighthouse-roadmap` §7 / `critical-fixes`）
- [ ] **P1-A11Y-08** `user-scalable=no` の撤廃判断（60 日でもよい、`lighthouse-roadmap` §8）

### 3.3 iPad / Android 実機テスト

正典: [`integration-test-plan` §3, §4](integration-test-plan-2026-04-28.md) / [`TODO-MASTER` T13, T14](TODO-MASTER-2026-04-28.md)

- [ ] **P1-DEV-01** iPad Safari 横向き / 縦向きで主要フロー通過（10 項目チェック）
- [ ] **P1-DEV-02** Android Chrome（手元にあれば）主要フロー通過（15 項目チェック）
- [ ] **P1-DEV-03** Android Chrome 無ければ BrowserStack / 友人端末で代替確認

### 3.4 safe-area / モバイル UX

正典: [`mobile-ux-flow-2026-04-28.md`](mobile-ux-flow-2026-04-28.md) / [`critical-fixes-2026-04-28.md`](critical-fixes-2026-04-28.md)

- [ ] **P1-SAFE-01** iPhone（ノッチ機種）でヘッダ / フッタが safe-area-inset を尊重
  - 観測: 実機で notch にコンテンツがかぶらない
- [ ] **P1-SAFE-02** iPhone ホーム indicator にカート CTA がかぶらない
- [ ] **P1-SAFE-03** Address bar の伸縮で粒子宇宙が破綻しない
  - 観測: スクロールで address bar 縮小 → 粒子のレイアウトが追従
- [ ] **P1-SAFE-04** `mobile-ux-flow` の改善提案（diff 形式末尾）から採用分を `mobile-ux-fixes-YYYY-MM-DD.md` に切り出し、実装（`TODO-MASTER` T20）

### 3.5 SEO 仕上げ

正典: [`seo-metadata-2026-04-28.md`](seo-metadata-2026-04-28.md) / [`TODO-MASTER` T28, T29](TODO-MASTER-2026-04-28.md)

- [ ] **P1-SEO-01** sitemap.xml の URL が `https://inryoku.com/` 始まり（仮ホスト名残置なし）
- [ ] **P1-SEO-02** robots.txt が production 用（`Disallow:` のみで全 allow / sitemap 行あり）
- [ ] **P1-SEO-03** GA4 実 ID 投入（placeholder `G-XXXXXXXXXX` を実値置換）
  - 観測: GA4 リアルタイムで自分のアクセスが見える
- [ ] **P1-SEO-04** OG プレビュー実機確認（Twitter Card Validator / Facebook Debugger）
- [ ] **P1-SEO-05** Google Search Console にサイト登録 + sitemap 送信

### 3.6 Storefront token サーバ中継

正典: [`storefront-token-migration-2026-04-28.md`](storefront-token-migration-2026-04-28.md) / [`TODO-MASTER` T15](TODO-MASTER-2026-04-28.md)

- [ ] **P1-TOK-01** `server.js` に `/api/storefront/*` プロキシ追加
- [ ] **P1-TOK-02** フロント JS 内 `storefrontToken` ハードコード除去
- [ ] **P1-TOK-03** CSP `connect-src` から Shopify ドメイン外してもサイト動く
  - 観測: 上記設定で carousel / 商品取得 / カート全部通る

---

## 4. P2 推奨（30 日以内）

公開しつつ並走。スコアと UX を磨く。

正典: [`TODO-MASTER` 1.C〜1.I](TODO-MASTER-2026-04-28.md)

### 4.1 セキュリティ

- [ ] **P2-CSP-02** CSP Phase 2（`'unsafe-inline'` 削減）— `csp-tuning` Phase 2 / T16
- [ ] **P2-CSP-03** CSP Phase 3（Trusted Types）— `csp-tuning` Phase 3 / T17（**保留判断あり**、`TODO-MASTER` §4）
- [ ] **P2-SEC-04** Storefront token スコープ最小化確認（T35）
- [ ] **P2-SEC-05** ADMIN_API_KEY 90 日ローテーションを暦に登録（`devops` §9）

### 4.2 コピー / UX

- [ ] **P2-COPY-01** copy-audit Major 残対応（T21）
- [ ] **P2-UX-01** error-handling E-S01〜E-S14 個別 UX（T22）
- [ ] **P2-UX-02** mobile-ux-flow 改善案実装 doc 化 + 実装（T20）

### 4.3 品質

- [ ] **P2-QA-01** Codex review 未対応指摘 ~3 件 決着（T23）
- [ ] **P2-QA-02** Lighthouse D-tasks 残部分（T25）
- [ ] **P2-QA-03** テストスイート CI 接続（T31、`devops` §10）
- [ ] **P2-QA-04** visual-regression 仕組み稼働確認（`visual-regression-2026-04-28.md`）

### 4.4 観測体制

- [ ] **P2-OBS-01** External uptime monitor（BetterStack / UptimeRobot）`/robots.txt` を 1〜5 分間隔（`devops` §6）
- [ ] **P2-OBS-02** error-shield からの `/api/error` ログを毎日 1 回確認する習慣（5 分）
- [ ] **P2-OBS-03** Backup cron 起動 + 別ホストへ同期（`devops` §7）

### 4.5 i18n

- [ ] **P2-I18N-01** `?lang=en` 公開判断（T26）
- [ ] **P2-I18N-02** Phase 2 `/en/` prerender 着手判断（T27、**反応見て判断**）

---

## 5. 検証フロー（順序付き 10 ステップ）

公開判定の本走。上から順に潰す。途中で失敗 → §7 緊急時対応へ。

正典: [`integration-test-plan-2026-04-28.md`](integration-test-plan-2026-04-28.md) / [`ec-runbook` Part 5, 6](ec-runbook-2026-04-28.md)

### Step 1. ローカル sanity（30 分）

正典: `integration-test-plan` §0

- [ ] **5.1.1** `cd /Users/10ta210/Desktop/inryoku_hp`
- [ ] **5.1.2** `node -v` → v18+
- [ ] **5.1.3** `ls -la .env` → 存在 / `cat .env | sed 's/=.*/=***/'` → 値漏れなし
- [ ] **5.1.4** `lsof -ti:3000` → 空（占有なし）
- [ ] **5.1.5** `npm install` → エラーなし（canvas のビルドに Xcode CLI tools 必要）
- [ ] **5.1.6** `npm test` → `# pass 180+ / # fail 0`
- [ ] **5.1.7** `npm run lint` → エラーなし
- [ ] **5.1.8** `npm run check:env` → 全 OK
- [ ] **5.1.9** JSON 構文チェック（`integration-test-plan` 0.2.4）

### Step 2. ローカルサーバ起動 + サニティ（15 分）

正典: `integration-test-plan` §0.3 / `ec-runbook` Part 5

- [ ] **5.2.1** `npm run dev` → 起動メッセージで `Checkout: ✅ / AI: ✅`
- [ ] **5.2.2** `curl -sI http://localhost:3000/ | head -1` → `200 OK`
- [ ] **5.2.3** セキュリティヘッダ 6 種返る（`integration-test-plan` 0.3.3）
- [ ] **5.2.4** `npm run healthcheck` → 全 OK

### Step 3. ローカルブラウザで主要フロー（45 分）

正典: `integration-test-plan` §1（30 項目）

- [ ] **5.3.1** Chrome incognito で `http://localhost:3000/` 開く
- [ ] **5.3.2** P0→P1→P2→P3 通しフロー全部通る
- [ ] **5.3.3** カートに入れる → checkout 開く → Shopify checkout 画面遷移
- [ ] **5.3.4** ESC / Tab / reduced-motion 全部効く
- [ ] **5.3.5** DevTools console エラーゼロ（warn は許容）
- [ ] **5.3.6** Network タブで `?v=` が今日の日付
- [ ] **5.3.7** Service Worker が active（Application タブ）

### Step 4. ローカル Safari + モバイル emulation（30 分）

正典: `integration-test-plan` §1 末尾 + §2

- [ ] **5.4.1** Safari incognito でも同じく通す
- [ ] **5.4.2** Chrome DevTools → Device toolbar → iPhone 14 Pro で `p3_test.html` 直行
- [ ] **5.4.3** 粒子宇宙が壊れない / カート CTA 押せる

### Step 5. EC テスト注文（Bogus Gateway、30 分）

正典: [`ec-runbook` Part 6](ec-runbook-2026-04-28.md) / `TODO-MASTER` T08

- [ ] **5.5.1** Shopify 管理画面 → 設定 → 決済 → Bogus Gateway 有効化（or テストモード）
- [ ] **5.5.2** ローカルで商品 → カート → checkout → Bogus カード `1` 番で決済
- [ ] **5.5.3** Shopify 注文ダッシュボードに 1 件レコード
- [ ] **5.5.4** Gelato dashboard に 1 件注文（Manual approval 状態 / 印刷停止）
- [ ] **5.5.5** Webhook 経路の確認（Gelato Shopify アプリ webhook vs サーバ `/api/gelato/order` どちらが正経路か実測 / T34）

### Step 6. 本番デプロイ（dry run、30 分）

正典: [`devops` §3, §5](devops-2026-04-28.md) / `scripts/deploy-checklist.md`

- [ ] **5.6.1** `npm run release:dry` でキャッシュバスター bump をプレビュー
- [ ] **5.6.2** `npm run release` で実 bump
- [ ] **5.6.3** `git diff` で eyeball
- [ ] **5.6.4** `git commit -am "release: bump cache-buster $(date +%Y%m%d)"`
- [ ] **5.6.5** `git push` → CI（`workflows/test.yml`）が green
- [ ] **5.6.6** ホスティング先（Render / Vercel / VPS）に env vars 全投入済か再確認
- [ ] **5.6.7** Deploy hook 起動 or push triggered deploy で本番反映

### Step 7. 本番 healthcheck（15 分）

正典: [`devops` §6](devops-2026-04-28.md)

- [ ] **5.7.1** `bash scripts/healthcheck.sh https://inryoku.com` → 全 OK
- [ ] **5.7.2** `curl -sI https://inryoku.com/` → 200 + 6 セキュリティヘッダ
- [ ] **5.7.3** `https://inryoku.com/robots.txt` 200
- [ ] **5.7.4** `https://inryoku.com/sitemap.xml` 200
- [ ] **5.7.5** `https://inryoku.com/manifest.json` 200
- [ ] **5.7.6** `https://inryoku.com/offline.html` 200

### Step 8. 本番実機テスト（MacBook Chrome / Safari + iPhone Safari、1.5 時間）

正典: [`integration-test-plan` §1, §2](integration-test-plan-2026-04-28.md) / `TODO-MASTER` T10〜T12

- [ ] **5.8.1** MacBook Chrome 全 30 項目 `[x]`（`integration-test-plan` §1）
- [ ] **5.8.2** MacBook Safari + Safari 固有チェック（IndexedDB / SW / OG プレビュー）
- [ ] **5.8.3** iPhone iOS Safari 全 25 項目 `[x]`（§2）
- [ ] **5.8.4** カート → checkout → Bogus 決済 → Shopify / Gelato 観測

### Step 9. 本番テスト購入（実カード、20 分）

正典: [`ec-runbook` Part 6 末尾](ec-runbook-2026-04-28.md) / `TODO-MASTER` T33

- [ ] **5.9.1** Shopify Payments 本番モード ON
- [ ] **5.9.2** Bogus Gateway 無効化
- [ ] **5.9.3** 司さんの実カードで 1 商品（最安）購入
- [ ] **5.9.4** Shopify 注文 / Gelato 注文 / 銀行送金予約 観測
- [ ] **5.9.5** Gelato Manual approval を解除 → 実印刷開始 → 司さんに届く
- [ ] **5.9.6** 届いた現物の品質確認

### Step 10. 公開後監視（公開直後 2 時間）

- [ ] **5.10.1** error-shield の `/api/error` ログを 30 分おきにチェック
- [ ] **5.10.2** Shopify / Gelato dashboard を 30 分おきにチェック
- [ ] **5.10.3** GA4 リアルタイムで実アクセス観測
- [ ] **5.10.4** External uptime pinger 起動済 / アラートメール来ない

---

## 6. 設定本番値チェック

### 6.1 `.env` / プラットフォーム env vars

正典: [`devops` §4](devops-2026-04-28.md)

| key | 必須 | 形式 | 観測条件 |
|---|---|---|---|
| `SHOPIFY_STORE_DOMAIN` | ✅ | `*.myshopify.com` or `inryoku.com` | サーバ起動メッセージで認識 |
| `SHOPIFY_STOREFRONT_TOKEN` | ✅ | alnum 20+ | `check:env` OK |
| `GELATO_API_KEY` | ✅ | url-safe 20+ | `check:env` OK |
| `GROQ_API_KEY` | ✅ | `gsk_...` | AI チャットが動く |
| `ADMIN_API_KEY` | ✅ | hex 32+ | `/api/subscribers` curl で 401 |
| `NODE_ENV` | 推奨 | `production` | サーバログ |
| `PORT` | 任意 | int | デフォ 3000 |
| `SHOPIFY_PRODUCT_ID` | 任意 | `gid://shopify/Product/<id>` | OG 商品リンク |
| `SHOPIFY_VARIANT_ID` | 任意 | `gid://shopify/ProductVariant/<id>` | ローンチ variant |
| `SITE_ORIGIN` | 任意 | `https://inryoku.com` | OG / sitemap |
| `ADMIN_DEV_BYPASS` | **存在しないこと** | — | dashboard 目視 |

- [ ] **6.1.1** 上記キー全て本番 dashboard で確認済
- [ ] **6.1.2** `ADMIN_DEV_BYPASS` がリスト外
- [ ] **6.1.3** `bash scripts/check-env.sh --file <prod env> --strict` 全 OK

### 6.2 Shopify 本番設定

正典: [`ec-runbook` Part 1, Part 6, Part 9](ec-runbook-2026-04-28.md)

- [ ] **6.2.1** Shopify プラン: Basic 以上（Storefront API + custom domain 必須）
- [ ] **6.2.2** primary domain: `inryoku.com`
- [ ] **6.2.3** Shopify Payments: 本番モード / 銀行口座登録済
- [ ] **6.2.4** 法務ページ 4 種（特商法 / プライバシー / 返品 / 配送）が published
- [ ] **6.2.5** 商品 12 SKU 全 Active / Online Store チャネル ON
- [ ] **6.2.6** Storefront API token のスコープが最小（`unauthenticated_read_product_*` + `unauthenticated_write_checkouts`）
- [ ] **6.2.7** Admin API token は `.env` に書かない（一時スクリプト用のみ）

### 6.3 Gelato 本番設定

正典: [`ec-runbook` 1.4, 2.1〜2.4](ec-runbook-2026-04-28.md)

- [ ] **6.3.1** Gelato dashboard で Shopify ストア連携済
- [ ] **6.3.2** 12 商品 全部 published（Bella+Canvas 3001 等の正しい productUid）
- [ ] **6.3.3** Order processing: 公開直前まで Manual / 公開後 Automatic
- [ ] **6.3.4** API key の scope: Orders read/write + Products read

### 6.4 GA4 / 解析

正典: [`lighthouse-roadmap` 1.3](lighthouse-roadmap-2026-04-28.md) / [`seo-metadata`](seo-metadata-2026-04-28.md)

- [ ] **6.4.1** GA4 プロパティ作成済 → Measurement ID（`G-` 始まり）取得済
- [ ] **6.4.2** placeholder `G-XXXXXXXXXX` を実値に置換（`grep -r "G-XXXX" .` で残置確認）
- [ ] **6.4.3** リアルタイム計測で自分のアクセスが見える
- [ ] **6.4.4** Search Console 登録 + sitemap 送信

---

## 7. 緊急時対応

正典: [`devops` §8](devops-2026-04-28.md) / `scripts/deploy-checklist.md`

### 7.1 Scenario A: サイトが落ちた

- [ ] **7.1.1** `bash scripts/healthcheck.sh https://inryoku.com` で正確な失敗を捕捉
- [ ] **7.1.2** ホスティング先の status page 確認
- [ ] **7.1.3** Render/Vercel: dashboard から前回成功 build を再デプロイ
- [ ] **7.1.4** VPS: `sudo systemctl status inryoku && journalctl -u inryoku -n 200`
- [ ] **7.1.5** 10 分で復旧しなければ rollback（`scripts/deploy-checklist.md`）

### 7.2 Scenario B: checkout が壊れた

- [ ] **7.2.1** Storefront token 有効性: `curl -I https://$SHOPIFY_STORE_DOMAIN/api/...`
- [ ] **7.2.2** `npm run check:env` で token 形式 OK
- [ ] **7.2.3** Shopify side（rate limit / プラン）確認
- [ ] **7.2.4** 旧 variant に env を戻して redeploy

### 7.3 Scenario C: AI チャット 500

- [ ] **7.3.1** Groq key 有効 / quota OK
- [ ] **7.3.2** quota 超過なら `i18n.json` の fallback コピーに切替（サーバは graceful fallback 実装済）

### 7.4 Scenario D: 古い JS がブラウザにキャッシュ

- [ ] **7.4.1** `?v=` bump 確認: `grep -h '?v=' index.html | head`
- [ ] **7.4.2** 未 bump なら `npm run release && git push`
- [ ] **7.4.3** bump 済みでも残るなら `sw.js` の `CACHE_NAME` を bump

### 7.5 Scenario E: ADMIN_API_KEY 漏洩疑い

- [ ] **7.5.1** `openssl rand -hex 32` で新キー生成
- [ ] **7.5.2** 本番 env 更新 → redeploy
- [ ] **7.5.3** healthcheck + admin endpoint 通る
- [ ] **7.5.4** `docs/secrets-rotation-log.md`（無ければ作成）に日付記録

### 7.6 Scenario F: Gelato で実印刷暴走

- [ ] **7.6.1** Gelato dashboard → Stores → Order processing を **Manual** に即切替
- [ ] **7.6.2** 既に印刷中の注文は Gelato サポートに連絡 / cancel 試行
- [ ] **7.6.3** 原因特定（webhook 二重 / `enabled: true` 早すぎ等）

### 7.7 Scenario G: subscriber data loss

- [ ] **7.7.1** `sudo systemctl stop inryoku`（書き込み停止）
- [ ] **7.7.2** 最新 backup を restore（`devops` §7）
- [ ] **7.7.3** 差分を logs から照合
- [ ] **7.7.4** `sudo systemctl start inryoku` + healthcheck

### 7.8 Scenario H: 全面ロールバック

- [ ] **7.8.1** 1 つ前の git tag に revert: `git revert <commit>` or `git checkout <prev-tag>`
- [ ] **7.8.2** 緊急 push → 自動 redeploy
- [ ] **7.8.3** `sw.js` の `CACHE_NAME` も bump して旧 SW を無効化
- [ ] **7.8.4** 司さん個人 SNS で「一時メンテ」告知

---

## 8. 公開当日タイムライン

時刻はサンプル。司さんの稼働時間で調整。

### T-7 日 〜 T-1 日（前準備、並列可）

- [ ] **T-7** P0-DOM-01 ドメイン取得（DNS 反映 24〜48h 想定）
- [ ] **T-7** P0-EC-01 Gelato 12 商品作成開始（`ec-runbook` 推奨「1 商品ずつ」、合計半日〜 1 日）
- [ ] **T-5** Shopify Payments 本番審査申請（数日〜 1 週間）
- [ ] **T-3** P0-EC-02〜03 variant GID 取得 + MAP 埋め
- [ ] **T-2** P0-LAW-01〜05 法定ページ Shopify 管理画面で生成
- [ ] **T-1** §5 Step 1〜5 ローカル検証 + テスト注文 完了

### 公開当日

| 時刻 | 作業 | 参照 |
|---|---|---|
| **08:00** | 朝食 + 落ち着く（運用は冷静さが資産） | — |
| **09:00** | §5 Step 1〜2 ローカル sanity 再走（前日と同じ環境を再確認） | `integration-test-plan` §0 |
| **09:30** | §5 Step 6 本番デプロイ（`npm run release` → `git push`） | `devops` §3 |
| **10:00** | §5 Step 7 本番 healthcheck 全 OK 確認 | `devops` §6 |
| **10:15** | §6 設定本番値チェック全埋確認（dashboard 目視） | §6 |
| **10:30** | §5 Step 8 本番実機テスト（MacBook Chrome / Safari / iPhone）| `integration-test-plan` §1, §2 |
| **12:00** | 昼休憩 | — |
| **13:00** | §5 Step 9 本番テスト購入（実カード） | `ec-runbook` Part 6 |
| **13:30** | Gelato Order processing を **Automatic** に切替（暴走防止確認後） | `ec-runbook` 2.4 |
| **13:45** | External uptime pinger 起動 / GA4 リアルタイム監視 | `devops` §6 |
| **14:00** | **公開**（=「観測の開始点」） | — |
| **14:00〜16:00** | §5 Step 10 公開直後 2h 監視（30 分おきに error log / Shopify / Gelato） | — |
| **16:00** | 1 件目の本物注文（あれば）の通しを完走確認 | — |
| **18:00** | 当日サマリ作成: 注文数 / エラー数 / Lighthouse 実値 / 不具合メモ | — |

### 公開禁止条件（1 個でも当てはまったら公開延期）

- [ ] §2 P0 ブロッカーに `[ ]` が残っている
- [ ] §5 Step 8 で重大バグ発覚（カート / checkout 落ちる / 粒子宇宙が破綻）
- [ ] §5 Step 9 で実カード決済が通らない
- [ ] §6 で本番 env vars に空 / placeholder 残置
- [ ] 司さんの体調が悪い（運用は冷静さが資産）

---

## 9. 公開後 7 日間運用

### Day 1

- [ ] **D1-01** 終日 30〜60 分おきに error log / Shopify / Gelato dashboard
- [ ] **D1-02** GA4 で当日 PV / セッション数記録
- [ ] **D1-03** 1 件目の実注文（来たら）の Gelato 印刷 → 配送追跡を観測
- [ ] **D1-04** SNS / 友人からのフィードバックを 1 つの doc にメモ

### Day 2〜3

- [ ] **D2-01** §3 P1-LH-01 Lighthouse 実機計測 + 値記録
- [ ] **D2-02** 検出された P1 バグを順に潰す
- [ ] **D2-03** §3 P1-DEV-01〜02 iPad / Android 実機テスト
- [ ] **D2-04** §3 P1-SAFE-01〜04 safe-area 実機確認

### Day 4〜7

- [ ] **D4-01** §3 P1-A11Y-01〜08 a11y HTML 構造変更（半日〜 1 日）
- [ ] **D4-02** §3 P1-TOK-01〜03 Storefront token サーバ中継移行
- [ ] **D4-03** §3 P1-SEO-01〜05 SEO 仕上げ + Search Console 確認
- [ ] **D4-04** Day 7: 公開 1 週間レビュー doc を起こす（注文数 / エラー / 学び）

### 7 日経過後

- [ ] §4 P2 タスクへ移行（30 日以内に潰す）
- [ ] backup cron が正常動作しているか確認（`devops` §7）
- [ ] 公開 1 週間時点の Lighthouse 値を再計測 → §3 P1-LH-04, P1-LH-05 達成判定

---

## 10. 最短公開ルート（ミニマム）

「とにかく今週中に立ち上げる」最小構成。`TODO-MASTER` §3 hot path に準拠。

**前提**: P3（Trusted Types / i18n Phase 2 / JSON-LD Product 拡張 / mobile-ux-flow 全採用 / 完璧な a11y）は **やらない**。50→101 哲学に従い、まず観測の場を開く。

### 順序（直列、依存に従う）

1. [ ] **M-01** P0-DOM-01〜06 ドメイン + SSL 一式（`TODO-MASTER` T32）
2. [ ] **M-02** P0-EC-01 Gelato 12 商品作成（`TODO-MASTER` T01）
3. [ ] **M-03** P0-ENV-01 `.env` 本番値全埋（T02 + T03）
4. [ ] **M-04** P0-EC-02〜03 variant GID 取得 + MAP 埋め（T04 + T05）
5. [ ] **M-05** P0-EC-05 `?v=` bump（T07）
6. [ ] **M-06** P0-EC-06 Gelato Manual approval 設定（T09）
7. [ ] **M-07** P0-EC-04 `GELATO_CONFIG.enabled = true`（T06）
8. [ ] **M-08** §5 Step 5 Bogus Gateway テスト注文（T08）
9. [ ] **M-09** §5 Step 8 MacBook Chrome + iPhone Safari 実機テスト（T10 + T12）
10. [ ] **M-10** §5 Step 6〜7 本番デプロイ + healthcheck
11. [ ] **M-11** §5 Step 9 Shopify Payments 本番切替 + 実カードテスト購入（T33）
12. [ ] **M-12** Gelato Automatic 切替（暴走監視を確認しつつ）

**所要時間目安**: 連続作業で 2〜3 日。並列で動かせるのはドメイン取得（DNS 待ち）と Gelato 商品作成。

### 最短ルートで **やらないこと**（公開後に追える）

- a11y HTML 構造変更（CSS 範囲は既に潰し済 = 公開可能ライン）
- CSP Phase 2/3
- Storefront token サーバ中継（公開可能 token なので即時危険ではない）
- copy-audit Major
- Lighthouse 90+ 達成
- iPad / Android 実機テスト
- i18n
- JSON-LD Product 拡張

> 最短ルートで立ち上げ → 観測しながら §3 P1 を 7 日で潰す → §4 P2 を 30 日で潰す。これが 50→101。
> 完璧から始めない。観測から始める。

---

## 付録 A. 「観測者」原則の運用

各チェックは「設定した」ではなく「**画面で見えた**」を完了基準にする（`TODO-MASTER` §6）。

- env 入れた → ❌
- env 入れて `check:env` OK → ✅
- variant MAP 埋めた → ❌
- 埋めて DevTools console.log で 12 SKU 全 GID 入り → ✅
- 商品作った → ❌
- 作って Shopify 管理画面と Gelato dashboard 両方に出ている → ✅
- ヘッダ追加した → ❌
- `curl -sI` で 6 種返る → ✅

> **観測なしの完了は完了でない。**

---

## 付録 B. 本 doc の保守

- 公開後、新しい不具合が出たら本 doc に **追記**（既存項目は変えない）
- 新項目は P0/P1/P2 のいずれかに分類
- 「観測条件」を必ず書く
- 各項目は対応する正典 doc へ逆引きリンクを保持
- 30 日後に「達成済」項目を過去ログとして圧縮

---

## 付録 C. 一言サマリ

> **P0 全潰し → §5 検証 10 ステップ → §8 当日タイムライン → 観測の開始**
> **公開は完成でない。観測の場を開くこと。**
> **完璧から始めない。観測から始める。**
