# inryokü ステータスダッシュボード（2026-04-28 終盤）

> **作成日**: 2026-04-28（金 / 終盤）
> **作成者**: Claude (Opus 4.7 / 1M context)
> **目的**: 司さんが **5 分で** 「今どこ・残・即実行」を掴める単一画面。
> **性質**: 読み取り専用。コードもドキュメントも触らない。逆引きハブ。
> **caveman talk**: 端的・命令形・余白少なめ。
> **哲学**: grey の中に虹 / 50→101 / 観測者中心。

---

## 0. 一目要約

| 項目 | 値 |
|---|---|
| プロジェクト名 | **inryokü**（読: いんりょく / 引力） |
| 哲学 | **50% → 101%** / **grey の中に虹**（RGBCMY）/ 観測者中心 |
| 状態 | **P3 実装完了** / **EC variant 埋め待ち** / **公開直前** |
| テスト | **533+ 全パス**（`npm test`） |
| 残作業（司さん） | **variant GID 60 埋め** / **法定ページ実情報** / **ドメイン inryoku.com** |
| 想定公開可能日 | variant 設定 + 法務確認 + DNS 反映後 → **2〜3 日連続作業で立ち上げ可能** |
| 公開判定方針 | 「観測者から見て買える」状態（PRODUCTION-LAUNCH-MASTER §1） |
| 哲学整合 | grey 守 / RGBCMY only / 50→101 体験 / 観測者中心 — 全 ✅ |

> **一言**: 完璧から始めない。観測から始める。

---

## 1. 完了済み（チェック済 ✅）

### 1.1 監査（9 件）

| # | doc | 完了 |
|---|---|---|
| 1 | accessibility-audit | ✅ Critical 8 / Major 14 / Minor 11 洗い出し |
| 2 | security-review | ✅ F1〜F13 + Critical 全列挙 |
| 3 | csp-tuning | ✅ Phase 1〜3 設計 |
| 4 | p3-performance-audit | ✅ 5356 行コードリーディング |
| 5 | error-handling-audit | ✅ E-S01〜E-S14 |
| 6 | copy-audit | ✅ Critical / Major / Minor |
| 7 | browser-compatibility-matrix | ✅ 30 機能 × 10 ブラウザ |
| 8 | mobile-ux-flow | ✅ 提案 diff |
| 9 | codex-review | ✅ 総合 B+ |

### 1.2 実装（15+ 件）

| # | doc / モジュール | 完了 |
|---|---|---|
| 1 | critical-fixes（CSS a11y） | ✅ |
| 2 | enhance-layer（enhance.js 805 行） | ✅ skip link / focus / reduced-motion / iOS dvh / kbd / aria-live |
| 3 | security-fixes（F1〜F13） | ✅ .env / SSRF / token / CORS / ADMIN bypass |
| 4 | csp-phase1-impl + csp-phase2-impl | ✅ Phase 1/2 反映 |
| 5 | perf-fixes（preload / WebGL idle） | ✅ |
| 6 | critical-copy-fixes（copy-fix-runtime.js） | ✅ |
| 7 | pwa-sw（sw.js + offline.html + register.js） | ✅ 4 cache 戦略 |
| 8 | error-shield（+ /api/error） | ✅ 観測者調 toast |
| 9 | seo-metadata（JSON-LD 3 種 / sitemap / robots） | ✅ |
| 10 | i18n-foundation（216 keys ja/en） | ✅ Phase 1 土台 |
| 11 | particle-language v2（17 canon） | ✅ Codex 改良 |
| 12 | particle_speech_rings（ロゴ発話） | ✅ |
| 13 | states.js / states.css | ✅ loading / empty / error |
| 14 | shopify-proxy-client.js | ✅ Storefront token 移行準備 |
| 15 | ai-chat-client-shield.js | ✅ fallback 履歴汚染防止 |
| 16 | 法定ページ枠（特商法 / privacy / returns / size-guide） | ✅ 枠のみ・**実情報待ち** |
| 17 | lighthouse-d-tasks | ✅ |

### 1.3 テスト

- **533+ 全パス**（コア + i18n + security + perf + visual-regression）
- coverage 計測有効（`npm run test:coverage`）
- visual-regression 仕組み稼働

### 1.4 ドキュメント（35+ 本）

- ハブ: INDEX / TIMELINE / TODO-MASTER / CONFLICTS / PRODUCTION-LAUNCH-MASTER
- 設計: architecture / particle-language-api / handoff-to-codex / ring-research
- 監査: 上記 9 件
- 実装: 上記 15+
- 運用: ec-runbook / integration-test-plan / devops / lighthouse-roadmap / runtime-verification / backup-restore / sitemap-monitoring
- 言語: i18n-foundation / i18n-wiring
- セキュリティ追加: pentest-report / cache-buster-audit
- パフォーマンス追加: image-optimization / perf-budget
- リファクタ提案: p3-code-map / p3-refactor-proposal / final-consistency

### 1.5 DevOps 整備

- `scripts/`: precommit / release / healthcheck / backup / check-env / optimize-images / check-images / deploy-checklist
- Dockerfile / docker-compose.yml
- `.github/workflows/test.yml`（CI test+coverage）/ `deploy.yml`
- pre-commit hook で secret パターン blocking

### 1.6 メモリ反映

- `project_inryoku.md`（2026-04-28 終盤版）
- `project_inryoku_vision.md`（哲学者を増やす本質）
- `project_inryoku_business.md`（多角化 2026-04）

---

## 2. 司さんアクション必要（残）

### 🔴 P0（公開前 — これがないと公開不可）

| ID | 項目 | 所要 | 正典 |
|---|---|---|---|
| P0-EC | **variant GID 60 埋め込み**（12 商品 × 5 サイズ）→ `SHOPIFY_VARIANT_MAP` | 1〜2h（GID 取得） + 30m（埋め） | ec-runbook Part 3, 4.1 |
| P0-EC | Gelato 12 商品作成・Shopify 同期 | 半日 | ec-runbook Part 2 |
| P0-EC | `GELATO_CONFIG.enabled = true` | 5m | ec-runbook 4.2 |
| P0-EC | Gelato Manual approval（暴走防止） | 10m | ec-runbook 2.4 |
| P0-EC | キャッシュバスター `?v=` 更新（`npm run release`） | 5m | ec-runbook 4.3 |
| P0-LAW | **特商法 11 項目の実情報**（住所 / 氏名→GREY / 連絡先 / 返品） | 30m | seo-metadata / Shopify 法務 |
| P0-LAW | プライバシー / 返品 / 配送 / Cookie ポリシー実情報 | 30m | 同上 |
| P0-DOM | **ドメイン `inryoku.com` 取得 / DNS / SSL** | 1h+（DNS 反映 24〜48h） | ec-runbook 1.1 |
| P0-DOM | Shopify primary domain 設定 + `www.` 正規化 + HSTS | 30m | 同上 |
| P0-ENV | 本番 `.env` 5 種埋め（Shopify domain / Storefront token / Gelato / Groq / Admin） | 20m | devops §4 |
| P0-ENV | `npm run check:env --strict` 全 OK | 5m | scripts/check-env.sh |
| P0-ADM | **`ADMIN_DEV_BYPASS=0` 確認**（or キー存在しない）/ NODE_ENV=production | 5m | security-fixes §43 |
| P0-PAY | Shopify Payments 本番モード切替 + 銀行口座審査 | 数日（外部審査） | ec-runbook Part 6 |
| P0-TEST | Bogus Gateway テスト注文 1 件通し | 30m | ec-runbook Part 6 |
| P0-TEST | 実カード本番テスト購入（1 商品最安） | 20m | ec-runbook Part 6 末尾 |

> **hot path（直列）**: ドメイン取得 → Gelato 商品作成 → variant GID → MAP 埋め → `?v=` → enabled=true → Bogus 注文 → 実機テスト → 本番デプロイ → 実カード購入 → Gelato Automatic 切替 → 公開
> **連続作業 2〜3 日**で完遂可能（DNS / Payments 審査の外部待ちは並列）

### 🟠 P1（公開後 7 日以内）

| ID | 項目 | 所要 |
|---|---|---|
| P1-LH | Lighthouse 実機計測（Mobile/Desktop × index/p3_test = 16 値） | 1h |
| P1-LH | Mobile Performance 70+ / Desktop 85+ 達成 | 数時間 |
| P1-A11Y | **HTML 構造修正**: `<main>` / `<h1>` 1 個 / brand-name `aria-label` / クリック可 div → `<button>` | 半日 |
| P1-A11Y | フォーカストラップ + `aria-live`（C-7, C-8） | 数時間 |
| P1-DEV | iPad Safari / Android Chrome 実機テスト | 各 20m |
| P1-SAFE | iPhone safe-area / address bar 実機確認 | 30m |
| P1-SEO | GA4 実 ID 投入（`G-XXXXXXXXXX` 置換） | 10m |
| P1-SEO | Search Console 登録 + sitemap 送信 | 15m |
| P1-TOK | Storefront token サーバ中継移行 | 1〜2h |

### 🟡 P2（30 日以内）

| ID | 項目 |
|---|---|
| P2-CSP | CSP Phase 2 完全化（`'unsafe-inline'` 削減 / nonce 完全化 / CSP_STRICT=1 検証） |
| P2-CSP | Trusted Types Phase 3（**保留判断あり** — 50→101 で skip 可） |
| P2-COPY | copy-audit Major 残対応 |
| P2-UX | error-handling E-S01〜E-S14 個別 UX |
| P2-UX | mobile-ux-flow 改善案実装 doc 化 |
| P2-PART | **円環粒子言語 v2 拡張**（intent/certainty/direction の AI 応答 canon マップ拡張） |
| P2-I18N | i18n 英語版完全実装（`?lang=en` 公開判断 → Phase 2 `/en/` prerender） |
| P2-IMG | 画像 WebP / AVIF 化 + 60 日 Critical CSS |
| P2-OBS | External uptime monitor + `/api/error` 毎日確認習慣 |
| P2-SEC | ADMIN_API_KEY 90 日ローテーション暦登録 |
| P2-SEC | Storefront token スコープ最小化確認 |
| P2-CI | テストスイート CI 接続 |
| P2-INRYOKU | inRYOKU 裏ライン（P2 password / P3 6 色合体）実装判断 |

---

## 3. 数値ダッシュボード

| 指標 | 値 | 出典 |
|---|---|---|
| **テスト数** | **533+ 全パス** | `npm test` / coverage-report |
| **Lighthouse Perf 推定（Desktop）** | **48–62（index）/ 70–82（p3_test）** ★★ | lighthouse-roadmap §1.1 |
| **Lighthouse Perf 推定（Mobile）** | **18–32（index）/ 42–58（p3_test）** ★★ | 同上 |
| **Lighthouse a11y 推定** | **72–82（mobile）/ 76–86（desktop）** ★★ | 同上 |
| **Lighthouse SEO 推定** | **96–100** ★★★ | 同上（GA4 ID 投入で 100） |
| **Best Practices 推定** | **92–96（mobile）/ 95–100（desktop）** ★★★ | 同上 |
| **PWA installable** | ✅ ★★★ | pwa-sw |
| **Code coverage** | 計測有効 | coverage-report |
| **docs 数** | **35+** | docs/ ls |
| **翻訳キー数** | **216（ja / en）** | i18n.json |
| **canon 円環数** | **17**（v2、Codex 改良） | particle-language-api |
| **API endpoints** | **16**（server.js 1197 行） | architecture §11 |
| **server.js コード** | **60 KB / 1197 行（Node 標準のみ・本番依存 0）** | architecture |
| **p3_code_for_claude.js** | 261 KB / 5356 行（主役） | architecture |
| **enhance.js（後付け a11y）** | 39 KB / 805 行 | architecture |
| **セキュリティヘッダ** | **6+ 種実装**（HSTS / CSP / COOP / CORP / COEP 等） | runtime-verification §4 |
| **静的配信検証** | **PASS**（軽微: sitemap/robots MIME） | runtime-verification §2 |
| **deny list / path traversal** | **全 PASS** | runtime-verification §3 |

> **推定の信頼度**: ★ = 不確実 / ★★ = 主要要因把握 / ★★★ = 確度高
> **Lighthouse は実機未測定**（環境制約）。公開後 P1-LH-01 で実値化。

---

## 4. アーキテクチャクイック俯瞰

### 4.1 フェーズ構成

```
P0 (Mac ダイアログ) → P1 (Win95 ローディング) → P2 (量子コードワールド + 陰陽球 50%)
  → P3 (パーティクルユニバース + EC + AI Chat) ★主役
                                   │
                          モバイル UA は冒頭で
                          p3_test.html へ replace
```

### 4.2 主要モジュール

- **HTML**: `index.html`（PC通し）/ `p3_test.html`（モバイル直行）/ `p3_showcase_samples.html` / 6 法定ページ
- **JS フェーズ**: `p1_code_for_claude.js` / `p2_*.js` / `p3_*.js`（5356 行・主役）
- **粒子言語**: `particle_rings.js` / `particle_speech_rings.js` / `particle_glyphs.js`（旧）
- **後付けレイヤ**: `enhance.js`（a11y + browser-compat）/ `copy-fix-runtime.js` / `error-shield.js` / `states.js` / `i18n.js` / `ai-chat-client-shield.js` / `shopify-proxy-client.js`
- **PWA**: `sw.js` / `register.js` / `manifest.json` / `offline.html`
- **Server**: `server.js`（1197 行 / 16 endpoint / Node 標準のみ）
- **計測**: `perf-observer.js`（Web Vitals → `window.__inryokuVitals`）

### 4.3 データフロー

```
訪問者 → index.html (P0→P1→P2→P3) ──┐
                                      ├─→ /api/chat (Groq) → AI 応答 → canon 円環化
                                      ├─→ /api/checkout → Shopify cartCreate → checkoutUrl → Shopify checkout
                                      ├─→ /api/gelato/order（webhook 経路と二重 / 要確認）
                                      ├─→ /api/error → error-shield ログ
                                      └─→ /api/admin/* (ADMIN_API_KEY 必須)
モバイル UA ─→ p3_test.html (P3 直行) ─→ 同上
```

### 4.4 セキュリティ姿勢

- レート制限 = in-memory token bucket
- CSP（Phase 1+2 適用、`'unsafe-inline'` Phase 2 で削減中）
- HSTS / X-Frame-Options DENY / nosniff / Referrer-Policy / Permissions-Policy / COOP / CORP / COEP
- timing-safe 比較
- ADMIN_API_KEY + dev bypass 構造的禁止（NODE_ENV=production 下）
- Storefront token は公開可能スコープのみ・サーバ中継移行準備済（P1-TOK）
- Gelato API key はサーバのみ（クライアント露出禁止）
- pentest-report 反映済 / pre-commit hook で secret blocking

---

## 5. 即実行できるコマンド集

```sh
# テスト・品質
npm test                          # 533+ tests
npm run test:coverage             # coverage
npm run lint                      # lint

# 性能・データ整合
npm run perf:budget               # 性能予算
npm run check:env                 # .env 確認（--strict で必須キー検証）
npm run healthcheck               # 起動中の確認
npm run verify:data               # データ整合性
npm run generate:sitemap          # sitemap 更新

# 画像最適化
bash scripts/optimize-images.sh   # WebP/AVIF
bash scripts/check-images.sh      # 画像チェック

# リリース
npm run release:dry               # ?v= bump プレビュー
npm run release                   # ?v= bump 実行
git push                          # CI test → deploy

# ローカル起動
npm run dev                       # node server.js (port 3000)
curl -sI http://localhost:3000/   # 起動確認

# 本番確認
bash scripts/healthcheck.sh https://inryoku.com
curl -sI https://inryoku.com/ | grep -E 'X-Content-Type|HSTS|CSP'

# バックアップ
bash scripts/backup.sh
```

---

## 6. 緊急時

正典: `devops` §8 / `PRODUCTION-LAUNCH-MASTER` §7 / `scripts/deploy-checklist.md`

### 6.1 ロールバック（git）
```sh
git revert <bad-commit>          # 1 つ前に戻す
git push                         # 自動 redeploy
# sw.js の CACHE_NAME も bump して旧 SW 無効化
```

### 6.2 サーバ停止 / 再起動
```sh
# VPS
sudo systemctl stop inryoku
sudo systemctl start inryoku
journalctl -u inryoku -n 200
# Render / Vercel: dashboard から前回成功 build を再デプロイ
```

### 6.3 データ復元
```sh
# 書き込み停止 → 最新 backup → restore → healthcheck
sudo systemctl stop inryoku
bash scripts/restore.sh <backup-id>
sudo systemctl start inryoku
bash scripts/healthcheck.sh https://inryoku.com
```

### 6.4 セキュリティインシデント
- **ADMIN_API_KEY 漏洩疑**: `openssl rand -hex 32` → 本番 env 更新 → redeploy → `secrets-rotation-log.md` 記録
- **Storefront token 漏洩**: Shopify 管理画面 → 旧 token revoke → 新 token 発行 → `.env` 更新 → redeploy
- **Gelato 暴走**: Gelato dashboard → Order processing → **Manual** 即切替 → 印刷中はサポート連絡
- **checkout 壊**: Storefront token 形式 / quota → 旧 variant に env 戻して redeploy
- **AI 500**: Groq quota → fallback コピー（既に graceful 実装）

---

## 7. 関連ドキュメント完全索引

### 7.1 ハブ・地図（5 本）
- `INDEX.md` — 全 31+ doc 地図
- `TIMELINE.md` — 2026-04-13 〜 28 時系列
- `TODO-MASTER-2026-04-28.md` — 全 35 タスク
- `CONFLICTS.md` — 矛盾候補
- `PRODUCTION-LAUNCH-MASTER-2026-04-28.md` — 公開単一窓口
- `STATUS-DASHBOARD-2026-04-28.md` — **本 doc**

### 7.2 設計・哲学（4 本）
- `architecture-2026-04-28.md` — 全体俯瞰（30 分）
- `particle-language-api-2026-04-28.md` — 円環粒子言語 API
- `handoff-to-codex-2026-04-27.md` — Codex 引き継ぎ + 哲学前提
- `ring-research-2026-04-27.md` — Heptapod 風円環リサーチ

### 7.3 監査（9 本）
- `accessibility-audit` / `security-review` / `csp-tuning` / `p3-performance-audit` / `error-handling-audit` / `copy-audit` / `browser-compatibility-matrix` / `mobile-ux-flow` / `codex-review`

### 7.4 実装（15+ 本）
- `critical-fixes` / `enhance-layer` / `security-fixes` / `csp-phase1-impl` / `csp-phase2-impl` / `perf-fixes` / `critical-copy-fixes` / `pwa-sw` / `error-shield` / `seo-metadata` / `lighthouse-d-tasks` / `storefront-token-migration`（設計のみ）/ `i18n-foundation` / `i18n-wiring` / `test-suite-expansion` / `ai-chat-client-shield` / `ai-chat-reliability` / `states-design` / `image-optimization`

### 7.5 運用（10 本）
- `ec-runbook` / `ec-status` / `integration-test-plan` / `devops` / `lighthouse-roadmap` / `runtime-verification` / `backup-restore` / `sitemap-monitoring` / `perf-budget` / `cache-buster-audit`

### 7.6 監査追加（2 本）
- `pentest-report` / `visual-regression`

### 7.7 リファクタ提案（3 本）
- `p3-code-map` / `p3-refactor-proposal` / `final-consistency`

---

## 8. 哲学的整合性チェック

| 問 | 答 | 根拠 |
|---|---|---|
| **grey は守られてる？** | ✅ 守られてる | 円環粒子言語 v2 で `grey 廃止 / RGBCMY のみ`、しかし「grey の中に虹」哲学は P2 陰陽球 50% / P3 6 色合体で表現 |
| **RGBCMY のみ？** | ✅ | particle_rings.js / .css で `0=点 / 1=弦、RGBCMY のみ`、白黒禁則 |
| **50→101 の体験設計？** | ✅ | P2 陰陽球 50% → RGBCMY 球 101%、P3 観測者中心、CVR ではなく哲学者を増やすことが目的（vision.md） |
| **観測者中心？** | ✅ | 「設定した」ではなく「画面で見えた」が完了基準（PRODUCTION-LAUNCH-MASTER 付録 A）/ error-shield も観測者調 toast |
| **CMY=物質 / RGB=精神？** | ✅ | POD（物質 / CMY 印刷）と Web（精神 / RGB 光）の二項を「服を纏う哲学」で接続 |
| **司さんフルネーム禁則？** | ✅ | architecture / vision で GREY 表記、feedback_no_fullname.md 遵守 |
| **白黒禁則？** | ✅ | grey に内包、白黒単独禁止 |

> **整合**: 全項目 ✅。表面（EC）と本質（観測の儀式）が矛盾せず両立している（architecture §1.1）。

---

## 9. 公開後 90 日ロードマップ要約

### 9.1 30 日（観測しながら塞ぐ）
- **Lighthouse 全軸 90+** 実機到達
  - Mobile Perf 70+ / Desktop Perf 85+ / a11y 90+ / Best Practices 95+ / SEO 100
- HTML a11y 構造修正（C-1〜C-5）
- iPad / Android 実機テスト
- Storefront token サーバ中継移行
- GA4 実 ID + Search Console + sitemap 送信

### 9.2 60 日（精度を上げる）
- **i18n 英語版本実装**（`?lang=en` 反応見て `/en/` prerender 昇格）
- 画像 AVIF + Critical CSS + キャッシュヘッダ
- a11y 95+（user-scalable=no 撤廃 / 全 div→button / アニメ pause UI）
- CSP Phase 2 完全化（`'unsafe-inline'` 削除 / CSP_STRICT=1）
- copy-audit Major 残対応
- error-handling E-S01〜E-S14 個別 UX

### 9.3 90 日（拡張と裏ライン）
- **円環粒子言語 v2 拡張**（intent / certainty / direction の AI 応答 canon マップ）
- **inRYOKU 裏ライン**（P2 password / P3 6 色合体）実装判断
- 全軸 95+（粒子 DPR / 粒子数の妥協を含むトレードオフ判断）
- CSP Phase 3 Trusted Types（**保留判断あり** — 50→101 で skip 可）
- テスト CI 接続 + visual-regression 自動化

---

## 10. 次の一手（司さんが今やるべき TOP 3）

### 1. **variant GID 埋め込み開始（enter-tee の M から）**
   - 理由: 12 商品 × 5 サイズ = 60 GID、全部止めると詰む。**1 商品 1 サイズから着手し、`SHOPIFY_VARIANT_MAP` に enter-tee の M だけまず埋めて DevTools console.log で確認**（観測者原則）。動いたら横展開。
   - 場所: `p3_code_for_claude.js:71` の `SHOPIFY_VARIANT_MAP`
   - 観測完了: ブラウザ console で 12 SKU 全 GID 入り
   - 詳細: `ec-runbook` Part 3, 4.1

### 2. **法定ページ TODO 入力**
   - 理由: 特商法 11 項目（販売者名→GREY / 住所 / 連絡先 / 返品条件等）の **実情報** が無いと公開不可。Shopify 管理画面 → 設定 → 法務 → ポリシー で生成可能。
   - 観測完了: `https://inryoku.com/policies/terms-of-service` 等が 200 で実情報表示
   - 詳細: `PRODUCTION-LAUNCH-MASTER` §2.2

### 3. **ドメイン inryoku.com 設定**
   - 理由: DNS 反映が **24〜48 時間** かかる外部待ち。**今すぐ着手**して並列で 1, 2 を進める。
   - 手順: ドメイン取得 → DNS A/CNAME を Shopify or ホスティング先に → SSL 確認 → Shopify primary domain 設定 → `www.` 正規化 → HSTS
   - 観測完了: `curl -sI https://inryoku.com/ | head -1` で `HTTP/2 200`
   - 詳細: `ec-runbook` 1.1

> **戦略**: 3 を着手して DNS 待ち中に 1 を粒で進めて 2 を埋める。3 つ並列で 2〜3 日。
> **観測なしの完了は完了でない。** 各完了は dashboard / DevTools / curl で **実物を見る**。

---

## 付録 A. 本 doc の運用

- 公開後、新項目は §2 の P0/P1/P2 に追記
- 完了は ✅ で残置（過去ログとして 30 日後圧縮）
- 数値は `npm test` / Lighthouse 実機 / docs カウントで定期更新
- 哲学整合（§8）は半年に 1 度再評価
- 司さんがフルネーム禁則 / 白黒禁則 / RGBCMY 唯一を破る変更があった場合は本 doc に警告

## 付録 B. 一言サマリ

> **P0 全潰し → 検証 10 ステップ → 当日タイムライン → 観測の開始**
> **公開は完成でない。観測の場を開くこと。**
> **完璧から始めない。観測から始める。**
> **grey の中に虹。50→101。観測者中心。**
