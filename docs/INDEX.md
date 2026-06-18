# inryokü docs/ — マスターインデックス

> **作成日**: 2026-04-28
> **作成者**: Claude (Opus 4.7 / 1M context)
> **目的**: docs/ 配下に蓄積された 30+ 件のドキュメントを俯瞰し、役割別の読む順序・正典 / 参照関係・状態（完了 / 進行中 / 司さんアクション必要）を一覧化するハブ。
> **方針**: 既存 doc は触らない。本 INDEX は「地図」であり「真実」ではない。各 doc が真実、本 INDEX は索引。
> **関連**:
>   - `TIMELINE.md` — 2026-04-13 〜 2026-04-28 の時系列
>   - `TODO-MASTER-2026-04-28.md` — 司さんが今やるべきことの統合リスト
>   - `CONFLICTS.md` — 矛盾・古くなった記述・修正候補

---

## 0. 何のためにこの INDEX があるか

inryokü サイトは 2026-04-13 ごろから 2026-04-28 までの 2 週間で、複数のエージェント（司さん本人 / Claude 各セッション / Codex）が並列に開発を進めた。結果、`docs/` には **31 本** のドキュメントが堆積し、以下の問題が発生していた：

1. **同じトピックを別ファイルが扱う** — 例: a11y は `accessibility-audit` / `enhance-layer` / `critical-fixes` の 3 本にまたがる。
2. **「監査 → 実装」の対応が暗黙的** — 監査 doc（提案）と実装 doc（事実）の対応関係が doc 内で明示されていない。
3. **正典が不明** — 同じ事実が複数 doc に書かれているとき、どれを更新すべきか判断できない。
4. **司さん側で残っているアクション** が doc 横断で散らばっており、何を先にやればよいか追えない。
5. **「未対応」「今後実装予定」が既に対応済み** の記述が一部残っている可能性（特に critical-fixes / security-fixes 以前の監査 doc）。

本 INDEX はこの 5 問題を解くための地図である。

---

## 1. 全 31 ドキュメント一覧（ファイル名昇順 + メタ）

| # | ファイル | 日付 | 行数規模 | 種別 | 状態 |
|---|---|---|---|---|---|
| 01 | `accessibility-audit-2026-04-28.md` | 04-28 | 大 (~33KB) | 監査 | 部分対応済（`critical-fixes` / `enhance-layer` 反映） |
| 02 | `architecture-2026-04-28.md` | 04-28 | 特大 (~58KB) | 設計 | 完了（最新の俯瞰） |
| 03 | `browser-compatibility-matrix-2026-04-28.md` | 04-28 | 大 (~28KB) | 監査 | 完了 |
| 04 | `codex-review-2026-04-28.md` | 04-28 | 中 (~17KB) | 監査 | 完了（Codex 実装の B+ 評価） |
| 05 | `copy-audit-2026-04-28.md` | 04-28 | 特大 (~62KB) | 監査 | 部分対応（`critical-copy-fixes`） |
| 06 | `critical-copy-fixes-2026-04-28.md` | 04-28 | 小 (~7KB) | 実装 | 完了 |
| 07 | `critical-fixes-2026-04-28.md` | 04-28 | 中 (~11KB) | 実装 | 完了（CSS のみ） |
| 08 | `csp-phase1-impl-2026-04-28.md` | 04-28 | 大 (~23KB) | 実装 | 完了（Phase 1） |
| 09 | `csp-tuning-2026-04-28.md` | 04-28 | 特大 (~53KB) | 監査 | 部分対応（Phase 2/3 残） |
| 10 | `devops-2026-04-28.md` | 04-28 | 中 (~13KB) | 運用 | 完了 |
| 11 | `ec-runbook-2026-04-28.md` | 04-28 | 特大 (~38KB) | 運用 | **司さんアクション必要** |
| 12 | `ec-status-2026-04-27.md` | 04-27 | 小 (~4KB) | 運用 | **司さんアクション必要**（runbook と二重） |
| 13 | `enhance-layer-2026-04-28.md` | 04-28 | 中 (~11KB) | 実装 | 完了 |
| 14 | `error-handling-audit-2026-04-28.md` | 04-28 | 特大 (~51KB) | 監査 | 部分対応（`error-shield`） |
| 15 | `error-shield-2026-04-28.md` | 04-28 | 中 (~10KB) | 実装 | 完了 |
| 16 | `handoff-to-codex-2026-04-27.md` | 04-27 | 中 (~10KB) | 設計 | 完了（Codex 引き継ぎ済） |
| 17 | `i18n-foundation-2026-04-28.md` | 04-28 | 中 (~10KB) | 言語 | 完了（Phase 1 土台） |
| 18 | `integration-test-plan-2026-04-28.md` | 04-28 | 特大 (~66KB) | 運用 | **司さんアクション必要**（実機テスト） |
| 19 | `lighthouse-d-tasks-2026-04-28.md` | 04-28 | 中 (~15KB) | 実装 | 完了 |
| 20 | `lighthouse-roadmap-2026-04-28.md` | 04-28 | 特大 (~54KB) | 運用 | 進行中（90+ 達成は途上） |
| 21 | `mobile-ux-flow-2026-04-28.md` | 04-28 | 大 (~28KB) | 監査 | 提案のみ（未実装多） |
| 22 | `p3-performance-audit-2026-04-28.md` | 04-28 | 大 (~36KB) | 監査 | 部分対応（`perf-fixes`） |
| 23 | `particle-language-api-2026-04-28.md` | 04-28 | 特大 (~66KB) | 設計 | 完了（粒子言語 API） |
| 24 | `perf-fixes-2026-04-28.md` | 04-28 | 大 (~20KB) | 実装 | 完了 |
| 25 | `pwa-sw-2026-04-28.md` | 04-28 | 小 (~6KB) | 実装 | 完了 |
| 26 | `ring-research-2026-04-27.md` | 04-27 | 小 (~5KB) | リサーチ | 完了 |
| 27 | `security-fixes-2026-04-28.md` | 04-28 | 中 (~16KB) | 実装 | 完了 |
| 28 | `security-review-2026-04-28.md` | 04-28 | 大 (~36KB) | 監査 | 部分対応（Critical は `security-fixes`） |
| 29 | `seo-metadata-2026-04-28.md` | 04-28 | 中 (~13KB) | 実装 | 完了 |
| 30 | `storefront-token-migration-2026-04-28.md` | 04-28 | 中 (~9KB) | 実装 | 設計のみ（実装は司さん作業） |
| 31 | `test-suite-expansion-2026-04-28.md` | 04-28 | 小 (~6KB) | 実装 | 完了 |

> **規模の目安**: 小 = 1〜10KB / 中 = 10〜20KB / 大 = 20〜40KB / 特大 = 40KB+。

---

## 2. カテゴリー別索引（5 カテゴリー）

### 2.1 設計・哲学（"なぜ" を語る doc）

| ファイル | 1 行要約 | 状態 |
|---|---|---|
| `architecture-2026-04-28.md` | 全配信物（HTML / JS / CSS / server / 粒子言語）のアーキテクチャ俯瞰。30 分で全体像を掴むためのエントリ点。 | 完了 |
| `particle-language-api-2026-04-28.md` | 円環粒子言語モジュール群（particle_rings / glyphs / speech_rings 等）の API リファレンス。各関数のシグネチャ・呼び出し関係。 | 完了 |
| `handoff-to-codex-2026-04-27.md` | Codex（別エージェント）への引き継ぎ書。inryokü のブランド前提・触ってよい / ダメな範囲・哲学。 | 完了（Codex 作業反映済） |
| `ring-research-2026-04-27.md` | Heptapod（映画 Arrival）風円環表現のリサーチ。SVG dasharray / canvas / WebGL 各実装パターン。 | 完了（実装は粒子言語に反映） |

**読み順**: `handoff-to-codex` → `architecture` → `particle-language-api` → `ring-research`。
最初に「哲学」、次に「全体地図」、次に「個別 API」、最後に「リサーチ起点」。

### 2.2 監査（"今どうなっているか / 何が問題か" を語る doc）

| ファイル | 1 行要約 | 対応する実装 doc | 状態 |
|---|---|---|---|
| `p3-performance-audit-2026-04-28.md` | P3 フェーズ（パーティクルユニバース + EC）のロード/フレーム/メモリ性能監査。 | `perf-fixes` / `lighthouse-d-tasks` | 部分対応 |
| `accessibility-audit-2026-04-28.md` | WCAG 2.1 AA 監査。Critical 8 / Major 14 / Minor 11。 | `critical-fixes` / `enhance-layer` | 部分対応（Critical は CSS 範囲で潰し済） |
| `security-review-2026-04-28.md` | サーバ + フロントの脆弱性レビュー。`.env` 平文 / CSP 緩い / token フロント露出 等。 | `security-fixes` / `csp-phase1-impl` / `storefront-token-migration` | 部分対応 |
| `mobile-ux-flow-2026-04-28.md` | モバイル振り分け（index.html → p3_test.html）と P3 モバイル UX のフロー監査。 | （実装 doc なし — 提案のみ） | 提案のみ |
| `browser-compatibility-matrix-2026-04-28.md` | Chrome / Safari / Firefox / iOS Safari / Android Chrome での挙動マトリクス。 | `enhance-layer` | 部分対応 |
| `copy-audit-2026-04-28.md` | コピー（言葉）の監査。inryokü の哲学・トーンとずれている箇所を洗い出し。 | `critical-copy-fixes` | 部分対応 |
| `codex-review-2026-04-28.md` | Codex が実装した部分の品質レビュー。総合 B+。 | （Codex 自身がフォロー） | 完了 |
| `error-handling-audit-2026-04-28.md` | E-S01〜E-S14 の状態異常・エラー UX 監査。 | `error-shield` | 部分対応 |
| `csp-tuning-2026-04-28.md` | CSP 厳格化監査。`'unsafe-inline'` 残存で防御力 70% 損失と診断。 | `csp-phase1-impl` | 部分対応（Phase 2/3 残） |

**読み順**: 監査 doc は基本「読む対象を決めて」読む。全部通すなら `architecture` → `p3-performance-audit` → `accessibility-audit` → `security-review` → `csp-tuning` → `error-handling-audit` → `mobile-ux-flow` → `browser-compatibility-matrix` → `copy-audit` → `codex-review`。

### 2.3 実装（"何を変えたか" を語る doc）

| ファイル | 1 行要約 | 親（監査 doc） | 状態 |
|---|---|---|---|
| `critical-fixes-2026-04-28.md` | a11y Critical 級を CSS 範囲で潰した記録。HTML/JS は別エージェント担当。 | `accessibility-audit` | 完了 |
| `security-fixes-2026-04-28.md` | `.env` / SSRF / token / CORS 等の Critical 修正。 | `security-review` | 完了 |
| `enhance-layer-2026-04-28.md` | a11y + browser-compat の後付けレイヤ（enhance.js）。既存コードを触らずに被せる設計。 | `accessibility-audit` / `browser-compatibility-matrix` | 完了 |
| `pwa-sw-2026-04-28.md` | PWA / Service Worker（sw.js / register.js / manifest.json）導入記録。 | `lighthouse-roadmap` | 完了 |
| `perf-fixes-2026-04-28.md` | preload 追加 / 無駄 reflow 削減 / WebGL idle 制御。 | `p3-performance-audit` | 完了 |
| `critical-copy-fixes-2026-04-28.md` | `copy-fix-runtime.js` でコピー差し替え。HTML を触らない後付け。 | `copy-audit` | 完了 |
| `csp-phase1-impl-2026-04-28.md` | CSP / Security Headers Phase 1（nonce 化第 1 段）。 | `csp-tuning` | 完了 |
| `lighthouse-d-tasks-2026-04-28.md` | Lighthouse D 軸（最後の詰め）タスク群。 | `lighthouse-roadmap` | 完了 |
| `error-shield-2026-04-28.md` | グローバルエラーハンドラ + 観測者調 toast UI + `/api/error`。 | `error-handling-audit` | 完了 |
| `storefront-token-migration-2026-04-28.md` | Shopify Storefront Token をフロント露出からサーバ中継へ移行する設計。 | `security-review` | 設計のみ |

**読み順**: 「やったこと」を辿りたいときは `critical-fixes` → `security-fixes` → `enhance-layer` → `perf-fixes` → `critical-copy-fixes` → `pwa-sw` → `csp-phase1-impl` → `error-shield` → `lighthouse-d-tasks` → `storefront-token-migration`。
時系列順ではなく「重大度高 → 仕上げ」順。

### 2.4 運用（"どう動かすか / どう守るか" を語る doc）

| ファイル | 1 行要約 | 状態 |
|---|---|---|
| `ec-status-2026-04-27.md` | EC 接続のスナップショット（04-27 時点）。司さん側残作業 4 項目。 | **司さんアクション必要** |
| `ec-runbook-2026-04-28.md` | EC 本番稼働の完全 Runbook（Storefront token 取得 / Gelato 連携 / variant ID 抽出 / テスト注文 / トラブルシュート）。 | **司さんアクション必要** |
| `seo-metadata-2026-04-28.md` | SEO / Metadata / OG / JSON-LD / sitemap / robots 整備記録。 | 完了 |
| `lighthouse-roadmap-2026-04-28.md` | Lighthouse 4 軸の推定スコア + 90+ 達成までのロードマップ。 | 進行中 |
| `integration-test-plan-2026-04-28.md` | 司さんが手元の MacBook + iPhone + iPad + Android で潰す実機テスト計画。 | **司さんアクション必要** |
| `devops-2026-04-28.md` | DevOps Operations Guide（mental model / デプロイ / ログ / アラート）。 | 完了 |
| `test-suite-expansion-2026-04-28.md` | 自動テストスイートの拡張記録。 | 完了 |

**読み順**: 司さん運用視点なら `ec-status` → `ec-runbook` → `integration-test-plan` → `devops` → `lighthouse-roadmap` → `seo-metadata` → `test-suite-expansion`。
最初に「現状」、次に「手順」、次に「テスト」、最後に「保守」。

### 2.5 言語拡張（"どう広げるか" を語る doc）

| ファイル | 1 行要約 | 状態 |
|---|---|---|
| `i18n-foundation-2026-04-28.md` | 多言語化（ja / en）の土台。`?lang=en` 起動 → `/en/` prerender 昇格の 2 段ロードマップ。 | Phase 1 土台完了 |
| `ring-research-2026-04-27.md` | （※ 設計カテゴリと重複） 円環粒子言語の異言語表現のリサーチ。 | 完了 |

---

## 3. 役割別「読む順序」推奨フロー

### 3.1 新規開発者（フロントエンド経験あり / WebGL は読めればよい）

```
1. handoff-to-codex-2026-04-27.md       (10 分) — 哲学・触ってよい範囲
2. architecture-2026-04-28.md           (30 分) — 全体地図
3. particle-language-api-2026-04-28.md  (45 分) — 粒子言語 API
4. ec-runbook-2026-04-28.md             (流し読み 15 分) — EC が裏でどう繋がってるか
5. integration-test-plan-2026-04-28.md  (流し読み 15 分) — どこをいじると壊れるか
合計: ~ 2 時間で読み込み完了
```

### 3.2 司さん（運用 / 仕上げ）

```
1. ec-status-2026-04-27.md              (5 分) — 何が残ってるか
2. TODO-MASTER-2026-04-28.md            (10 分) — 全 doc 横断 TODO
3. ec-runbook-2026-04-28.md             (実作業時に逆引き)
4. integration-test-plan-2026-04-28.md  (実機テスト時に逆引き)
5. lighthouse-roadmap-2026-04-28.md     (90+ 達成までのアクション)
```

### 3.3 監査担当（外部レビュアー / コードレビュー / セキュリティ監査）

```
1. architecture-2026-04-28.md
2. security-review-2026-04-28.md → security-fixes-2026-04-28.md
3. csp-tuning-2026-04-28.md → csp-phase1-impl-2026-04-28.md
4. accessibility-audit-2026-04-28.md → critical-fixes / enhance-layer
5. error-handling-audit-2026-04-28.md → error-shield
6. p3-performance-audit-2026-04-28.md → perf-fixes
7. codex-review-2026-04-28.md
```

### 3.4 哲学・コピー担当（言葉を書く / 監修する人）

```
1. handoff-to-codex-2026-04-27.md
2. copy-audit-2026-04-28.md
3. critical-copy-fixes-2026-04-28.md
4. ring-research-2026-04-27.md
5. particle-language-api-2026-04-28.md（粒子＝言語の哲学を理解する用）
```

### 3.5 デザイン / UX 担当

```
1. mobile-ux-flow-2026-04-28.md
2. accessibility-audit-2026-04-28.md
3. browser-compatibility-matrix-2026-04-28.md
4. copy-audit-2026-04-28.md
5. lighthouse-roadmap-2026-04-28.md（UX が直接スコアに効く部分）
```

---

## 4. 監査 ↔ 実装 対応マトリクス（正典の所在）

複数 doc にまたがる事実は「**実装 doc が正典**」。監査 doc は「過去の問題リスト」として固定し、新たに見つかった問題は新規 audit doc を起こすか、**正典側に追記する**。

| トピック | 監査（問題リスト） | 実装（正典） | 残作業 doc |
|---|---|---|---|
| a11y Critical（CSS で潰せる範囲） | `accessibility-audit` C-1〜C-8 | `critical-fixes` | （HTML 側は `enhance-layer` が一部肩代わり） |
| a11y Major / 後付け | `accessibility-audit` Major | `enhance-layer` | （`landmark` / `aria-live` の HTML 直挿入は未） |
| ブラウザ互換 | `browser-compatibility-matrix` | `enhance-layer` | （Safari 個別の polyfill 残） |
| パフォーマンス | `p3-performance-audit` | `perf-fixes` / `lighthouse-d-tasks` | `lighthouse-roadmap` |
| セキュリティ Critical | `security-review` C-1〜C-N | `security-fixes` | `storefront-token-migration`（実装未） |
| CSP | `csp-tuning` | `csp-phase1-impl` | Phase 2 / 3（`csp-tuning` 末尾） |
| エラーハンドリング | `error-handling-audit` | `error-shield` | （E-S 状態異常の個別 UX 残） |
| コピー | `copy-audit` | `critical-copy-fixes` | （Major / Minor 残） |
| EC（Shopify / Gelato） | （監査 doc なし） | `ec-runbook` | `ec-status` の 4 項目 |
| 粒子言語 API | （監査 doc なし） | `particle-language-api` | （拡張は `ring-research`） |
| i18n | （監査 doc なし） | `i18n-foundation` | Phase 2（`/en/` prerender） |
| PWA | （`lighthouse-roadmap` 内） | `pwa-sw` | （installability 残点） |
| SEO | （`lighthouse-roadmap` 内） | `seo-metadata` | （JSON-LD の Product 拡張余地） |
| Codex 実装の品質 | `codex-review` | （Codex 自身が反映） | （未対応指摘 ~3 件） |
| 統合実機テスト | （doc なし） | `integration-test-plan` | 実行は司さん |

---

## 5. ファイル間相互リンク（同一トピックの doc 群）

### 5.1 a11y クラスタ
- `accessibility-audit-2026-04-28.md`（問題リスト = 不変）
- `critical-fixes-2026-04-28.md`（CSS 範囲の Critical 対応）
- `enhance-layer-2026-04-28.md`（後付け JS で Major / browser-compat 同居）
- `browser-compatibility-matrix-2026-04-28.md`（互換性マトリクス、enhance-layer の根拠）

### 5.2 セキュリティクラスタ
- `security-review-2026-04-28.md`（脆弱性リスト = 不変）
- `security-fixes-2026-04-28.md`（Critical 対応ログ）
- `csp-tuning-2026-04-28.md`（CSP 監査）
- `csp-phase1-impl-2026-04-28.md`（CSP Phase 1 実装）
- `storefront-token-migration-2026-04-28.md`（Shopify token 露出問題の設計解）

### 5.3 パフォーマンスクラスタ
- `p3-performance-audit-2026-04-28.md`（性能監査）
- `perf-fixes-2026-04-28.md`（修正ログ）
- `lighthouse-roadmap-2026-04-28.md`（90+ 達成ロードマップ）
- `lighthouse-d-tasks-2026-04-28.md`（D 軸タスク完了ログ）
- `pwa-sw-2026-04-28.md`（PWA installability、Lighthouse PWA 軸）

### 5.4 EC クラスタ
- `ec-status-2026-04-27.md`（04-27 スナップショット — 04-28 runbook で上書き相当）
- `ec-runbook-2026-04-28.md`（正典 / 完全 Runbook）
- `storefront-token-migration-2026-04-28.md`（セキュリティ観点の改善設計）

### 5.5 コピー / 哲学クラスタ
- `handoff-to-codex-2026-04-27.md`（哲学 = 不変の前提）
- `copy-audit-2026-04-28.md`（言葉の監査）
- `critical-copy-fixes-2026-04-28.md`（修正実装）
- `particle-language-api-2026-04-28.md`（粒子＝言語の API）
- `ring-research-2026-04-27.md`（円環粒子言語のリサーチ）
- `i18n-foundation-2026-04-28.md`（多言語化土台）

### 5.6 エラー / 観測クラスタ
- `error-handling-audit-2026-04-28.md`（E-S01〜E-S14 監査）
- `error-shield-2026-04-28.md`（実装）
- `devops-2026-04-28.md`（運用観点のログ / アラート）
- `test-suite-expansion-2026-04-28.md`（自動テスト）
- `integration-test-plan-2026-04-28.md`（手動テスト）

### 5.7 粒子言語クラスタ
- `particle-language-api-2026-04-28.md`（API リファレンス = 正典）
- `ring-research-2026-04-27.md`（リサーチ起点）
- `architecture-2026-04-28.md`（全体地図に位置付け）

---

## 6. 「司さんアクション必要」が含まれる doc（要約）

詳細は `TODO-MASTER-2026-04-28.md`。ここでは doc レベルで列挙：

| doc | 概要 | 推定所要 |
|---|---|---|
| `ec-status-2026-04-27.md` / `ec-runbook-2026-04-28.md` | Shopify variant GID 取得 / Gelato 商品作成 / Storefront token 確認 / `.env` 整備 / テスト注文 | 半日〜 1 日 |
| `integration-test-plan-2026-04-28.md` | 実機テスト（MacBook Chrome/Safari + iPhone iOS Safari + iPad + Android） | 2〜3 時間 |
| `lighthouse-roadmap-2026-04-28.md` | 90+ 達成までの残タスク | 数時間（依存項目多い） |
| `storefront-token-migration-2026-04-28.md` | サーバ中継 API への切り替え（設計のみ） | 1〜2 時間 |
| `csp-tuning-2026-04-28.md` Phase 2/3 | nonce 完全化 / `'unsafe-inline'` 削除 / Trusted Types | 半日 |
| `i18n-foundation-2026-04-28.md` Phase 2 | `?lang=en` で反応見て `/en/` 静的 prerender に昇格 | 反応見てから判断 |

---

## 7. 「正典」原則（運用ルール）

今後 doc を更新するときの原則：

1. **監査 doc は「過去の写真」**。書き換えない。新たな知見は新しい監査 doc を起こす（例: `accessibility-audit-2026-05-XX.md`）。
2. **実装 doc は「現在の事実」**。実装が変わったら追記する。古い記述には `~~取り消し線~~` ではなく、「**更新（YYYY-MM-DD）**:」見出しで上書き履歴を残す。
3. **設計 doc は「不変に近い」**。哲学・アーキテクチャは大きく動かない。動いたら新版を起こし、旧版は `archive/` に。
4. **運用 doc は「逆引き対象」**。常に最新であるべき。古くなったら速攻直す。
5. **新トピックは新規 doc**。既存 doc に間借りしない。

---

## 8. 既知の重複・矛盾サマリ（詳細は `CONFLICTS.md`）

- `ec-status-2026-04-27.md` と `ec-runbook-2026-04-28.md` は **同じトピックを別粒度で**書いている。`ec-runbook` が新しく完全。`ec-status` は「司さんが今思い出すスナップショット」として残置可能だが、04-28 時点の進捗反映なし → `CONFLICTS.md` 参照。
- `accessibility-audit` の Critical は `critical-fixes` で CSS 範囲は潰した。HTML 構造変更（landmark / button 化 / aria-live）は **未対応**。`enhance-layer` で一部肩代わり。
- `security-review` の Critical のうち `.env` / token フロント露出 は `security-fixes` / `storefront-token-migration` で対応中。設計のみで実装未の項目あり。
- `csp-tuning` Phase 2/3 は **未着手**。`'unsafe-inline'` 残存。
- `mobile-ux-flow` の改善提案は **diff 形式提案のみ**で、実装 doc が存在しない。
- `copy-audit` の Major / Minor は `critical-copy-fixes` でカバーされていない範囲が大きい。

---

## 9. 用語の統一（doc 横断）

| 用語 | 定義 | 表記揺れ（避ける） |
|---|---|---|
| inryokü | サイト名 / ブランド名 | "inryoku"（ASCII）, "陰瞭句", "INRYOKU" |
| 司さん | プロダクトオーナー / ブランドオーナー | フルネーム禁止（メモリ参照） |
| P3 | パーティクルユニバース + EC を載せた現行フェーズ | "Phase 3", "p3" 単独 |
| 粒子言語 | 円環状の独自グリフ言語システム | "ring language", "Heptapod" |
| Codex | 司さんが並行で動かす別エージェント（実装担当） | "codex"（小文字）, "AI" |
| 観測者 | エラーや状態を「眺めるもの」として扱う UI 言語 | "監視", "オブザーバー" |

---

## 10. メタ情報

- **本 INDEX のスコープ外**: コード本体 / production アセット / `superpowers/specs/*` の skill 定義。
- **更新頻度**: 新規 doc が追加されたら、本 INDEX に 1 行追加 + 該当カテゴリーに項目追加。
- **副産物**: 本 INDEX 作成時点で `CONFLICTS.md` に矛盾候補を蓄積。実際のコード修正は本 INDEX 作成では行わない（指示通り）。
- **caveman talk 適用**: 本 INDEX 自体は索引のため敢えて構造化を優先。読み物の章は最小限。
- **50→101 哲学**: 50（最小限）に戻すための「捨てるべきもの一覧」を `CONFLICTS.md` 末尾で明示。
