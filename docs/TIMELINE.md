# inryokü 開発タイムライン（2026-04-13 〜 2026-04-28）

> **作成日**: 2026-04-28
> **作成者**: Claude (Opus 4.7 / 1M context)
> **目的**: 2 週間に及ぶ並列開発（司さん / Claude / Codex）の主要な決定・実装・哲学変更を時系列で 1 本に整理する。
> **典拠**: `docs/*.md` の本文・mtime・冒頭日付・本文中の「実施日」「監査日」「作成日」記述。直接観測されない事象は推測と明示する。
> **関連**: `INDEX.md`（カテゴリー別索引）／`TODO-MASTER-2026-04-28.md`（残作業）／`CONFLICTS.md`（矛盾）。

---

## 0. 凡例

- **decision** — 司さんの判断 / 哲学的決定。
- **impl** — 実装の着地。
- **audit** — 監査 doc 作成（事実の写真）。
- **design** — 設計 doc 作成（不変寄り）。
- **handoff** — エージェント間の引き継ぎ。
- **ops** — 運用上のイベント。
- 推測には **(推測)** を付ける。

---

## 1. フェーズ概観

| 期間 | 名称 | 主動 |
|---|---|---|
| 2026-04-13 頃〜04-26 | **P3 構築期** | 司さん + Codex を中心に、パーティクルユニバース（粒子言語）と EC（Shopify + Gelato）を載せた P3 を作る期間。docs/ にはまだ多くは残っていない（`ec-status-2026-04-27.md` / `ring-research-2026-04-27.md` が初期蓄積）。|
| 2026-04-27 | **引き継ぎ・監査前夜** | Codex への引き継ぎ、EC スナップショット、円環粒子言語のリサーチがまとめられる。Claude（本セッション系）が現状把握に入る。 |
| 2026-04-28 | **監査 → 修正 → 仕上げの大バースト** | Claude が一気に 28 本の doc を起こし、a11y / セキュリティ / パフォーマンス / コピー / CSP / エラー / SEO / PWA / i18n / DevOps を網羅。`docs/` のほぼ全量がこの 1 日に集中している。 |

---

## 2. 時系列（具体）

### 2026-04-13 頃 (推測) — 起点

- **decision (推測)**: 司さんが P3 として「パーティクルユニバース + EC」を載せた現行サイト形を確定。`p3_test.html` をモバイル直行入口、`index.html` をデスクトップ通しフローとする 2 段構成。
- **decision (推測)**: 「inryokü 美学」（暗背景・装飾色 grey/CMY/RGB・粒子言語）を全フェーズで保つ前提を固める。
- **impl (推測)**: `p3_code_for_claude.js` / `p3_styles.css` / `particle_*.{css,js}` の主要モジュールが書かれていく。

> 日付確証なし — 04-13 頃の起点は `architecture` doc が「2 週間で組まれた」記述を匂わせること、および各実装ファイルの規模感からの推測。

### 2026-04-14 〜 04-26 (推測) — P3 中身を作る期間

- **impl (推測)**: 円環粒子言語（`particle_rings.js` / `particle_rings.css` / `particle_glyphs.css` / `particle_speech_rings.js`）。
- **impl (推測)**: Shopify Storefront API 連携を `server.js` でラップ（最小限）。
- **impl (推測)**: Codex が並列で実装に入り、司さんが哲学・コピー・全体方針を出す体制が確立。
- **decision (推測)**: 「服を売るのが目的ではなく、見えないものを可視化して哲学者を増やす」という根幹が言語化（メモリ `project_inryoku_vision.md` の系譜）。
- **decision (推測)**: 「50 に戻して 101 を出す」という磨きの哲学が機能（メモリ `feedback_claude_behavior.md` 関連）。

### 2026-04-27（金 推定） — 引き継ぎと初期 doc 化

- 22:50 ごろ — **ops** `ec-status-2026-04-27.md` が作成される。
  - 全体構成のステータス表、司さん側残作業 4 項目（Gelato 商品作成 / variant GID / Gelato 連携有効化 / Storefront token 確認）。
- 22:51 ごろ — **design** `ring-research-2026-04-27.md` が作成される。
  - Heptapod（映画 Arrival）/ generative fonts / 篆書・象形文字 / SVG dasharray / canvas 各実装パターンのリサーチ。粒子言語の表現の幅を拡張する起点。
- 01:12（04-28 早朝に書かれた可能性 — mtime 04-28 01:12） — **handoff** `handoff-to-codex-2026-04-27.md`。
  - 「ブランド前提（必読）」「フェーズ構成」「触ってよい / ダメな範囲」を Codex に渡す。
- **decision** (この時点で確定 / 推測): 司さんは Codex に実装を任せ、Claude（別セッション）には監査・俯瞰・運用 doc を任せる役割分担。

### 2026-04-28（土 推定） — 監査と仕上げの大バースト

doc の mtime が 02:25 〜 17:14 に集中。実質 1 日の中で監査 → 修正 → 設計 → 運用整備が完了する。以下、時刻順に再構成：

#### 02:25 — Codex 実装レビュー
- **audit** `codex-review-2026-04-28.md`。Codex の実装に対し総合 **B+（良作・致命なし・小さな仕上げ残）** と評価。

#### 02:26 — a11y / 性能の大型監査
- **audit** `accessibility-audit-2026-04-28.md`。WCAG 2.1 AA 不適合と診断。Critical 8 / Major 14 / Minor 11 / Pass 7。
- **audit** `p3-performance-audit-2026-04-28.md`。ロード〜初回描画 / 定常時フレーム / メモリ / WebGL アイドル制御。

#### 02:27 — モバイル UX / セキュリティ
- **audit** `mobile-ux-flow-2026-04-28.md`。`index.html → p3_test.html` のモバイル振り分けロジックを起点に、P3 モバイル UX 全体の動線を診断。改善は diff 形式提案のみ（実装は別レーン）。
- **audit** `security-review-2026-04-28.md`。`.env` 平文同居 / Storefront token フロント露出 / SSRF / CORS など複数 Critical を指摘。

#### 02:34 — 最初の対応着地（CSS 範囲の Critical / Critical fixes）
- **impl** `critical-fixes-2026-04-28.md`。a11y Critical のうち CSS で潰せる範囲（コントラスト底上げ / フォーカスリング復活 / `prefers-reduced-motion` 等）を `p3_styles.css` に統合。HTML / JS は別エージェント担当。
- **impl** `seo-metadata-2026-04-28.md`。`<head>` の OG / JSON-LD / sitemap.xml（新規）/ robots.txt（新規）整備。

#### 02:35 — セキュリティ即時修正 / 互換マトリクス
- **impl** `security-fixes-2026-04-28.md`。`.env` の扱い / SSRF 系 / CORS / token 周りの即時 Critical 対応。
- **audit** `browser-compatibility-matrix-2026-04-28.md`。Chrome / Safari / Firefox / iOS Safari / Android Chrome のマトリクス。

#### 02:37 — 粒子言語の API 化（"言葉" を凍結）
- **design** `particle-language-api-2026-04-28.md`。`particle_*.js` の関数シグネチャと相互呼び出し関係を「API リファレンス」として確定。今後の改修で哲学が壊れない楔となる。

#### 16:32 〜 16:42 — 後付けレイヤと運用の整備（午後セッション）
- 16:32 **impl** `enhance-layer-2026-04-28.md`。`enhance.js` 等で a11y + browser-compat を「後付けで被せる」レイヤを設計。既存コードに触らない原則。
- 16:34 **ops** `ec-runbook-2026-04-28.md`。EC 本番稼働の完全 Runbook が確定。`ec-status-2026-04-27.md` を実質的に上位互換で置き換え。
- 16:37 **impl** `pwa-sw-2026-04-28.md`。Service Worker / `register.js` / `manifest.json` を導入。Lighthouse の PWA 軸を埋める。
- 16:40 **impl** `perf-fixes-2026-04-28.md`。preload 追加 / 無駄 reflow 削減 / WebGL idle 制御。`p3-performance-audit` への直接の応答。
- 16:42 **impl** `test-suite-expansion-2026-04-28.md`。自動テストスイートの拡張ログ。

#### 16:48 〜 16:53 — 多言語土台 / アーキテクチャ俯瞰 / コピー監査
- 16:48 **design** `i18n-foundation-2026-04-28.md`。`?lang=en` で起動 → `/en/` prerender へ昇格の 2 段ロードマップ。日本語動作は完全維持の前提。
- 16:51 **design** `architecture-2026-04-28.md`。第三者開発者が 30 分で全体像を掴むための俯瞰。58KB の特大 doc。
- 16:53 **audit** `copy-audit-2026-04-28.md`。inryokü のトーンとずれているコピーを全面棚卸。62KB。

#### 16:59 — コピーの critical 修正
- **impl** `critical-copy-fixes-2026-04-28.md`。`copy-fix-runtime.js` でコピーをランタイム差し替え。HTML を直接触らない後付け原則。

#### 17:02 〜 17:14 — CSP / エラー / SEO / Lighthouse / DevOps の総仕上げ
- 17:02 **audit** `csp-tuning-2026-04-28.md`。CSP の `'unsafe-inline'` 残存で防御力 70% 損失と診断。Phase 1/2/3 の昇格ロードマップ。
- 17:03 **audit** `error-handling-audit-2026-04-28.md`。E-S01 〜 E-S14 の状態異常を一覧化。
- 17:03 **ops** `lighthouse-roadmap-2026-04-28.md`。Lighthouse 4 軸の推定スコア + 90+ 達成までのロードマップ。54KB。
- 17:06 **ops** `integration-test-plan-2026-04-28.md`。司さんが MacBook + iPhone + iPad + Android で潰す実機テスト計画。66KB（最大）。
- 17:11 **impl** `csp-phase1-impl-2026-04-28.md`。CSP Phase 1（nonce 化第 1 段）。
- 17:12 **impl** `error-shield-2026-04-28.md`。グローバルエラーハンドラ + 観測者調 toast UI + `/api/error` 受信。
- 17:12 **ops** `devops-2026-04-28.md`。DevOps Operations Guide（mental model / デプロイ / ログ / アラート）。
- 17:13 **impl** `lighthouse-d-tasks-2026-04-28.md`。Lighthouse D 軸の最後の詰めタスク群。
- 17:13 **design** `storefront-token-migration-2026-04-28.md`。Shopify Storefront Token をフロント露出からサーバ中継へ移行する設計（実装は司さん作業として残置）。
- 17:14 — 最終 mtime（ディレクトリ自身）。docs/ 大バーストの実質的なクローズ。

---

## 3. 主要な「司さんフィードバック」と方針変更（doc 横断で読み取れるもの）

直接日付が刻印された変更ログは存在しないため、doc 本文と meta（`feedback_*` メモリ参照）から推測する。**(推測)** マーク付き：

1. **(推測)** P3 起点で「服を売る」ではなく「見えないものを可視化して哲学者を増やす」を本質と再定義 — `handoff-to-codex` の「ブランド前提（必読）」、メモリ `project_inryoku_vision.md`。
2. **(推測)** 「caveman talk」採用 — 極限簡潔スタイルへの転換。doc 群の散文には反映されていないが、UI コピーには `critical-copy-fixes` 経由で部分反映。
3. **(推測)** 「公開物にフルネームを書かない」徹底 — `seo-metadata` / OG / JSON-LD / `architecture` の著者名表記が「Claude / 司さん」表記で統一されている。
4. **(推測)** 「ブラウザは司さんの Chrome を直接 claude-in-chrome で操作」 — `integration-test-plan` でローカル実機テストを前提化、Lighthouse は実機未実行で推定値止まりにする判断（`lighthouse-roadmap` 冒頭）。
5. **(推測)** 「触ってよい / ダメ」の境界明示 — `handoff-to-codex` で範囲確定、`critical-fixes` が「CSS のみ」「HTML / JS は別エージェント」と自己制限する根拠に。
6. **(推測)** Codex 実装の品質コントロール導入 — `codex-review` の総合 B+ 判定。司さんが「監査されたうえで前進する」体制を採用。
7. **(推測)** 「50 → 101」哲学（メモリ）— 機能を加えるより「いったん 50 に戻して別の 101 を出す」ことを優先。`enhance-layer` / `copy-fix-runtime.js` / `error-shield` の **後付け非破壊レイヤ** という選択がこの哲学の表れ。

---

## 4. 04-28 大バーストの内部ロジック（なぜ 1 日で 28 本書けたか）

- **02:25 〜 02:37（深夜セッション 1）**: 監査中心の 7 本（codex / a11y / perf / mobile / security / browser-compat / particle-api）。状態を「写真」で固定する作業。
- **16:32 〜 17:14（午後セッション 2）**: 修正・運用・仕上げの 21 本。「写真」を踏まえて「実装と運用」を埋める。
- 深夜と午後のあいだ（13 時間ほど）に司さん側の判断・Codex 側の動きが挟まっていた **(推測)**。
- 深夜の監査 doc は「Claude が読み取るための地図」、午後の実装 doc は「Claude / Codex が動くための手順書」。

---

## 5. 主要マイルストーン（達成済 / 未達）

### 5.1 達成済
- WCAG 2.1 AA Critical の **CSS で潰せる範囲** を解消（`critical-fixes`）。
- セキュリティ Critical の `.env` 平文等の即時対応（`security-fixes`）。
- CSP Phase 1 着地（`csp-phase1-impl`）。
- `enhance.js` / `copy-fix-runtime.js` / `error-shield.js` の **後付け非破壊 3 レイヤ** 導入。
- PWA / Service Worker 投入（`pwa-sw`）。
- SEO / sitemap / robots / OG / JSON-LD（`seo-metadata`）。
- 粒子言語 API リファレンス凍結（`particle-language-api`）。
- アーキテクチャ俯瞰の確立（`architecture`）。
- EC 完全 Runbook（`ec-runbook`）。
- 統合実機テスト計画（`integration-test-plan`）。
- DevOps mental model 文書化（`devops`）。
- i18n 土台（`i18n-foundation`）。

### 5.2 未達 / 残作業（詳細は `TODO-MASTER`）
- a11y Major（HTML 構造変更：landmark / button 化 / aria-live）。
- セキュリティ Critical のうち Storefront token サーバ中継 **実装**（設計のみ）。
- CSP Phase 2/3（`'unsafe-inline'` 完全排除 / Trusted Types）。
- EC 司さん側 4 項目（Gelato 商品作成 / variant GID 取得 / Gelato 連携 ON / `.env` 整備）。
- 実機テスト実行（司さん）。
- Lighthouse 90+ 達成までの最後の詰め。
- mobile-ux-flow の改善提案の実装（diff 形式提案のみで実装 doc なし）。
- copy-audit Major / Minor の残対応。
- error-handling-audit E-S 状態異常の個別 UX。
- Codex review の未対応指摘 ~3 件。
- i18n Phase 2（`/en/` prerender 昇格 — 反応見てから判断）。

---

## 6. 04-28 以降の論理的な次のステップ（推奨順）

1. 司さんの **EC 司さん側 4 項目** を片付ける（`ec-runbook` を逆引きしながら）。
2. 司さんの **実機テスト実行**（`integration-test-plan`）。バグが出たら新規 issue 化。
3. Storefront token サーバ中継の **実装**（`storefront-token-migration`）。
4. CSP Phase 2 の段階的着地。
5. a11y HTML 構造変更（landmark / button 化）。本格対応は `accessibility-audit-2026-05-XX.md` を新規に起こすのが筋。
6. Lighthouse 実機計測 → ロードマップの D タスク残を潰す。
7. mobile-ux-flow の Major 改善案を実装 doc 化。
8. copy-audit Major を `copy-fix-runtime.js` に追加。
9. i18n Phase 2 の判断（反応見てから）。

---

## 7. 「読み返したときに迷わない」ための注記

- 04-27 の 3 本（`ec-status` / `ring-research` / `handoff-to-codex`）は **04-28 大バーストの「前史」**。本体ではない。
- 04-28 の 28 本は **「監査」と「実装」がペア**になっている部分（a11y / security / perf / copy / CSP / error）と、**運用・設計の独立 doc**（architecture / particle-language-api / ec-runbook / integration-test-plan / lighthouse-roadmap / devops / i18n / pwa-sw / seo-metadata / test-suite-expansion）の二層構造。
- doc は「写真」と「ログ」と「地図」の 3 種に分かれる：
  - **写真**: audit 系（不変）。
  - **ログ**: impl 系（追記対象）。
  - **地図**: design / ops 系（更新対象）。

---

## 8. メタ・限界

- 04-13 〜 04-26 の期間は doc 化されていない（ローカルコミット履歴 / `.git` がない場合は復元不可）。本タイムラインは **(推測)** で補っている。
- 04-28 の 02:25 〜 17:14 の流れは mtime に依拠。doc 内に明示の作成時刻はない場合が多く、時刻順序は mtime 順 = 作成順という仮定。
- 司さんのフィードバック原文は doc 内に残っていない（メモリ側に蓄積されている系譜）。本タイムラインの「方針変更」は doc 群の **行間と整合性** からの逆算で、原文ではない。
- Codex 側の作業ログは `codex-review` を通じてのみ観測されている。Codex 自身が書いた doc は本セットには含まれていないと思われる **(推測)**。
- 本タイムラインは「決定論的」ではなく「再構成」。司さんが見て「ここ違う」となったら本 doc を更新する想定。

---

## 9. 1 行サマリ

> **2 週間で P3 を作り、最後の 1 日で監査 → 修正 → 仕上げを 28 本の doc に蒸留した。残るのは「司さんの手」が要る EC ・実機テスト・トークン移行・CSP 仕上げ。**
