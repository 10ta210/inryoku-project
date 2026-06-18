# inryokü 最終引き継ぎ書（2026-04-28）

> 司さん、これ 1 つだけ読めば全把握できる。困ったら最後の「緊急時対応」へ飛ぶ。

---

## 0. TL;DR

- production HTML の主要アセット参照は `?v=20260428` 系に揃っているが、live では `?v=20260428canon1` も併用している
- `server.js` / JSON / XML の syntax 正常。Codex 環境では `node --test tests/*.test.mjs` が `509 pass / 0 fail`、visual も pass。`npm` は未導入なので、公開前に `npm test` / `npm run check` を再実行して最終確認する
- 公開前の本命は Shopify variant ID 差し込み、実機確認、ドメイン公開、外形監視
- 哲学（「見えないものの可視化」）と実装（particle / canon / register）の対応は概ね整理済み。UI と運用の最終確認は残る
- 過去全作業の docs は `docs/INDEX.md` から辿れる

---

## 1. 今の inryokü（全体像）

### 構造
- **P0 / P1 / P2** = 既存ランディング（index.html）
- **P3** = particle 系新章（p3_test.html で単体検証可能）
- **EC** = Shopify proxy 経由カート（variant ID は本番差し込み待ち）

### 動いているもの
- particle_rings / particle_speech_rings（現行の哲学的可視化レイヤ）
- particle_glyphs（旧系・demo/参照用）
- register × canon マッピング
- error-shield / ai-chat-client-shield / copy-fix-runtime（堅牢化レイヤ）
- enhance.js（progressive enhancement）
- i18n.js（JA/EN 軸、states.js と協調）
- perf-observer（Web Vitals 自前計測）
- Service Worker（4 戦略）/ offline.html

### スクリプトロード順序（index.html / p3_test.html）
```
vendor/three.min.js
→ p1_code_for_claude.js
→ particle_canon_meta.js（index は defer / p3_test は同期）
→ particle_rings.js (defer)
→ particle_speech_rings.js (defer)
→ p3_code_for_claude.js（p3_test は同期、index は P2 完了後に動的読込）
→ error-shield.js
→ ai-chat-client-shield.js
→ copy-fix-runtime.js
→ enhance.js
→ register.js / perf-observer.js（index.html では register → perf、p3_test.html では perf → register）
→ i18n.js
→ states.js
```
※ index.html の ring 系は defer、p3_test.html の ring / P3 本体は同期 script。`particle_glyphs` は live entrypoint では未使用で、demo / 参照用として残置。

### テスト
- Codex 環境での現行確認: `node --test tests/*.test.mjs` = `509 pass / 0 fail / 80 suites`
- visual regression: `node --test tests/visual/*.test.mjs` = `43 pass / 0 fail / 4 suites`
- この引き継ぎ更新時点では現環境に `npm` が無いため、公開前に `npm test` / `npm run check` を再実行して npm 側結果も再確認する
- カバレッジ: `npm run test:coverage`
- visual regression: `tests/visual/` 25 baseline

---

## 2. 公開までの最短経路（5 ステップ）

| # | やること | 参照 doc | 所要 |
|---|---------|---------|------|
| 1 | Shopify variant ID 差し込み | `docs/ec-runbook-2026-04-28.md` | 30 分 |
| 2 | `npm run check`（test + lint）/ `npm run perf:gate` | `docs/PRODUCTION-LAUNCH-MASTER-2026-04-28.md` | 5 分 |
| 3 | `npm run release:dry` → 問題なければ `npm run release` | `scripts/release.sh` | 10 分 |
| 4 | DNS 切替 / CDN cache purge / production HTML の `?v=20260428` 反映確認 | `docs/devops-2026-04-28.md` | 30 分 |
| 5 | BetterStack（or 同等）外形監視登録 / Lighthouse 本番計測 | `docs/lighthouse-roadmap-2026-04-28.md` | 30 分 |

公開判断ゲート: `docs/PRODUCTION-LAUNCH-MASTER-2026-04-28.md` の checklist を、variant ID 差し込みと実機確認の後に再確認して全 ✅ にする。

---

## 3. 公開後の運用

### 日次（自動 / 5 分）
- BetterStack で 200 OK / TTFB / LCP 監視
- `npm run healthcheck` を CI cron で 1 日 1 回

### 週次（手動 / 30 分）
- Search Console の coverage / CWV ダッシュボード
- 主要 canon の particle 動作を p3_test.html で目視
- `npm test` ローカル実行（依存更新時または公開前）

### 月次（手動 / 2 時間）
- `docs/STATUS-DASHBOARD-2026-04-28.md` を当月版にコピーして更新
- pentest 再実行（`tests/pentest.test.mjs`）
- バックアップ復元演習（`npm run backup` → 別環境で `npm run restore`）

---

## 4. 哲学的整合性の維持

inryokü は「服販売」ではなく「見えないものの可視化で哲学者を増やす」プロジェクト。
コード変更時、以下に反していないか確認：

- **削除しない**: P0–P2 の旧 phase コードは絶対に消さない（`feedback_no_delete_phases`）
- **フルネーム禁止**: 公開物には司さんのフルネームを書かない（GREY 等）
- **particle = 哲学**: particle_rings / glyphs / speech_rings は装飾ではなく「言葉が物質化する瞬間」の可視化。性能のために削るときは visual ではなく algorithmic の方を削る
- **RGB=Black, CMY=White, You=Rainbow**: 配色判断で迷ったらこの 1 行に戻る（package.json description 参照）

参照: `memory/project_inryoku_vision.md`

---

## 5. Codex / Claude / サブエージェントとの今後の付き合い方

### 役割分担（この repo で使った実例）
| 用途 | エージェント | 例 |
|------|------------|----|
| 大規模リファクタ / 新規機能 | Claude（このセッション） | particle 実装 / i18n 全面 |
| コード品質レビュー / 別視点 | Codex | `docs/codex-review-2026-04-28.md` |
| 並列独立タスク | サブエージェント（Claude Task） | 監査系・syntax check 系 |
| ブラウザ操作 | claude-in-chrome（毎回 Chrome 直） | Shopify 管理画面 / Lighthouse |

### 依頼の仕方
- 大粒度 1 個より、独立な小粒度 N 個の並列展開が速い（`feedback_max_subagent_deployment`）
- caveman talk: 短く命令形（`feedback_caveman_talk`）
- 触らせる範囲を明示（「触っていい / 触らない」を毎回書く）

---

## 6. 緊急時対応

### サイトが落ちた
1. `npm run healthcheck` ローカル実行
2. CDN / DNS 状態確認
3. 直前 commit を `git revert` → `npm run release`
4. `docs/backup-restore-2026-04-28.md` の復旧手順

### テストが急に落ちた
1. `git diff HEAD~5 -- tests/` で diff 確認
2. visual baseline は意図変更なら `npm run test:visual:update`
3. それ以外は `node --test tests/<name>.test.mjs` で単体実行 → 原因特定

### Shopify proxy がエラー
1. `shopify-proxy-client.js` の console / network
2. `docs/ec-runbook-2026-04-28.md` の variant ID 再確認
3. CSP 違反は `docs/csp-tuning-2026-04-28.md`

### CSP 違反で何か動かない
1. ブラウザ console の CSP report を読む
2. `docs/csp-phase2-impl-2026-04-28.md` で許可方針確認
3. inline script を増やすのではなく外部化 → hash 追加

---

## 7. 30 / 60 / 90 日先の理想形

### 30 日
- 公開済み / 外形監視稼働 / Lighthouse mobile 90 以上維持
- 哲学者第 1 号からの感想収集（particle が「響いた」かどうか）
- 司さん側で `npm test` → release を 1 度自走完了

### 60 日
- 情報販売 / 集客代行 / AI 爆速制作（`memory/project_inryoku_business`）の最初の 1 件着手
- 「inryokü を見て買った人」の声を 3 件以上 docs/ に記録
- E2E（Playwright）導入検討（必要性が見えてから）

### 90 日
- 検索流入が brand 名 + 哲学キーワード（「可視化」「物質化」）で安定
- P4 phase の構想（次の章。特に「沈黙の可視化」）を docs/ にスケッチ
- 司さんが Claude / Codex 不在でも 1 人でリリースできる状態

---

## 8. 司さんからのフィードバック方法（メモリ反映ルール）

### 即時反映してほしい挙動
「これからは X して」「毎回 Y」→ Claude が `memory/feedback_*.md` に追記。

### プロジェクト状態の更新
P3 完了 / EC 開通など → `memory/project_inryoku.md` 該当セクション更新 + `MEMORY.md` の説明文更新。

### 哲学・ビジョンの追記
「本質はこうだ」と気付いたら → `memory/project_inryoku_vision.md` に追記（既存記述は消さない、追記のみ）。

### 不要になったルール
「もう X はやめて」→ 該当 feedback ファイルに「廃止: 日付 / 理由」を追記。**削除しない**（履歴として残す、`feedback_no_delete_phases` の精神）。

---

## 付録: 重要 doc 索引（迷ったらここから）

- 全体目次: `docs/INDEX.md`
- 公開チェックリスト: `docs/PRODUCTION-LAUNCH-MASTER-2026-04-28.md`
- 残タスク: `docs/TODO-MASTER-2026-04-28.md`
- 状態ダッシュボード: `docs/STATUS-DASHBOARD-2026-04-28.md`
- アーキテクチャ: `docs/architecture-2026-04-28.md`
- 整合性監査結果: `docs/final-consistency-2026-04-28.md`

---

**司さん、ここまで来た。残りは variant ID、実機確認、公開作業。**
