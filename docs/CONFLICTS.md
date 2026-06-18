# docs/ 矛盾・古くなった記述・修正候補リスト（2026-04-28）

> **作成日**: 2026-04-28
> **作成者**: Claude (Opus 4.7 / 1M context)
> **目的**: 31 本の doc 群を横断的に読み、**重複 / 矛盾 / 古い記述 / バージョン情報の不整合 / "今後実装予定" が既に対応済み** の箇所を機械的に洗い出す。
> **方針**: 修正は本 doc では一切行わない（指示通り）。**修正候補のリスト** に留める。司さんが見て採否を判断する。
> **関連**: `INDEX.md`（地図）／`TIMELINE.md`（時系列）／`TODO-MASTER-2026-04-28.md`（残作業）。

---

## 0. 凡例

各項目は以下のフォーマット：

```
### Cnn. 短い見出し
- 種別: 重複 / 矛盾 / 古い / バージョン不整合 / 暗黙の前提 / 推測
- 場所: doc とおおまかな箇所
- 何が問題: 1〜3 行
- 推奨アクション: 1〜3 行
- 信頼度: ★ / ★★ / ★★★（高いほど確実）
```

「推測」と明示したものは **本 INDEX 作成者の解釈** であり、司さん視点では当たり前 / 違うかもしれない。鵜呑みにしないこと。

---

## 1. 重複（同じトピックを別 doc が別粒度で書いている）

### C01. EC 接続情報の二重管理（`ec-status` ↔ `ec-runbook`）
- 種別: 重複 + 古い
- 場所:
  - `ec-status-2026-04-27.md` 全体（4KB の簡易版）
  - `ec-runbook-2026-04-28.md` 全体（38KB の完全版）
- 何が問題: 04-27 の `ec-status` は「司さん残作業 4 項目」を 1 ページにまとめた **スナップショット**。04-28 の `ec-runbook` はその 4 項目を含む **完全 Runbook**。両方が「正典」のように見えるため、どちらを更新すべきか不明。司さんが進捗を反映するときに二重管理になる。
- 推奨アクション:
  - 案 A（推奨）: `ec-status` を `archive/` に移すか、冒頭に「**この doc は ec-runbook に統合されました。残作業の追跡は ec-runbook を参照してください**」と注記。
  - 案 B: `ec-status` を「**進捗チェックボックス専用**」として残し、本文は `ec-runbook` を逆引きする運用に変更。
- 信頼度: ★★★

### C02. a11y Critical の対応状況が複数 doc に分散
- 種別: 重複
- 場所: `accessibility-audit` Critical C-1〜C-8 / `critical-fixes` / `enhance-layer`
- 何が問題: a11y Critical を「CSS 範囲」と「HTML 範囲」に分けて、前者は `critical-fixes` で潰し、後者は `enhance-layer` で部分肩代わり、残りは未対応。**「Critical のうち何が残っているか」が 1 箇所に集約されていない**。
- 推奨アクション: 本 doc または `TODO-MASTER` の T18 / T19 に集約済（既に対応）。`accessibility-audit` 冒頭に「**04-28 時点の対応状況: critical-fixes ✓ / enhance-layer 部分 ✓ / HTML 構造変更 未**」サマリ表を追記推奨。
- 信頼度: ★★★

### C03. ブラウザ互換の根拠と enhance-layer の対応関係が暗黙
- 種別: 暗黙の前提
- 場所: `browser-compatibility-matrix` ↔ `enhance-layer`
- 何が問題: `enhance-layer` は browser-compat の根拠で動いているが、相互リンクが doc 内に明示されていない。
- 推奨アクション: `enhance-layer` 冒頭の「参照ドキュメント」に `browser-compatibility-matrix-2026-04-28.md` を追記。`browser-compatibility-matrix` 末尾に「**この監査の対応 doc: enhance-layer**」を追記。
- 信頼度: ★★

---

## 2. 矛盾（同じ事実を異なる値 / 状態で書いている）

### C04. Storefront token の取り扱い方針の矛盾候補
- 種別: 矛盾候補
- 場所:
  - `ec-status-2026-04-27.md`「Storefront API トークンの確認」: クライアント側ハードコード（`p3_code_for_claude.js:66`）と `.env` 側の **二重存在を許容** する記述。
  - `ec-runbook-2026-04-28.md` 1.3: Storefront token は **公開可能** としてフロントハードコード OK と明記。
  - `security-review-2026-04-28.md`: Storefront token のフロント露出を Critical として指摘（の可能性 — 全文未確認）。
  - `storefront-token-migration-2026-04-28.md`: フロント露出を **やめる** 設計を提示。
- 何が問題: 04-27 と 04-28 朝（`ec-runbook`）は「公開可能だから OK」、04-28 夜（`storefront-token-migration`）は「サーバ中継に移そう」。**方針が日内で動いている**。司さんがどちらを採用するか doc から読み取れない。
- 推奨アクション: `storefront-token-migration` を **採用方針として確定** するか、`ec-runbook` 1.3 に「**注: 04-28 時点で `storefront-token-migration` の方針に従いサーバ中継への移行を計画中。本節の手順は移行前の最低ライン**」を追記。
- 信頼度: ★★（`security-review` 全文未確認 — 推測あり）

### C05. Gelato 注文経路がどちらが正なのか未確定
- 種別: 矛盾 / 未決
- 場所:
  - `ec-status-2026-04-27.md` 既知の懸念: 「Shopify アプリ側が webhook で受けるので、サーバ側 `/api/gelato/order` は実は不要かも。要検証」。
  - `ec-runbook-2026-04-28.md` 7.6: Webhook 確認手順あり（=サーバ経路と Shopify アプリ経路の **両方を前提** に書かれている）。
- 何が問題: 「サーバ `/api/gelato/order` 経由」と「Shopify アプリ webhook 経由」の **どちらが正経路か** が未決のまま実装が両建て。本番で二重発注のリスクあり。
- 推奨アクション: T34（テスト注文時に経路確定）を実行 → どちらか一方を正経路にし、もう一方は無効化または fallback として明記。`ec-runbook` 末尾に「**正経路の確定: ___**」を後で書く欄を作る。
- 信頼度: ★★★

### C06. 司さんアクション項目の数が doc 間でずれている可能性
- 種別: 矛盾候補
- 場所: `ec-status` の「4 項目」 vs `ec-runbook` の Part 9「30 項目チェックリスト」
- 何が問題: `ec-status` は 4 項目に集約、`ec-runbook` は 30 項目に展開。**抽象度が違うだけで矛盾ではない**かもしれないが、司さんから見ると「結局何個やればいいの？」になりやすい。
- 推奨アクション: 本 `TODO-MASTER` で T01〜T35 として再展開し直し済（解決済 ✓）。`ec-status` 削除 / 集約推奨。
- 信頼度: ★★

---

## 3. 古い記述（"未対応" がもう対応済み / "今後実装予定" が既に実装済み）

### C07. `ec-status` の「司さん残作業 4 項目」のステータス
- 種別: 古い可能性
- 場所: `ec-status-2026-04-27.md` セクション「司さん側で残ってる作業」
- 何が問題: 04-27 時点では未対応とされた 4 項目が、04-28 大バーストの中で進捗があった可能性（`storefront-token-migration` / `ec-runbook` で展開）。ただしコード本体に variant が埋まったかは未確認（おそらく未）。
- 推奨アクション: 司さんが進捗を反映するか、本 `TODO-MASTER` の T01〜T08 を信頼するかどちらか。`ec-status` を archive 推奨。
- 信頼度: ★★（コードを直接見ていないため）

### C08. `accessibility-audit` の Critical のうち CSS で潰したもの
- 種別: 古い
- 場所: `accessibility-audit` Critical の C-4（コントラスト）/ C-5（フォーカスリング）/ C-6（reduced-motion）等
- 何が問題: `critical-fixes` で CSS 範囲は対応済だが、`accessibility-audit` 本文側に「対応済」のマーカーがない。新規で `accessibility-audit` を読むと「全部未対応」に見える。
- 推奨アクション: `accessibility-audit` 冒頭に対応状況サマリ表を追記（C02 と統合）。または本 INDEX を起点として読むことを徹底。
- 信頼度: ★★★

### C09. `security-review` の Critical のうち修正済の項目
- 種別: 古い
- 場所: `security-review-2026-04-28.md` Critical 章
- 何が問題: `security-fixes` で `.env` 等の Critical を一部対応済。`security-review` 本文に「対応済」のマーカーがない。
- 推奨アクション: 同上、サマリ表追記。
- 信頼度: ★★★

### C10. `csp-tuning` の Phase 1 はもう着地している
- 種別: 古い
- 場所: `csp-tuning-2026-04-28.md` Phase 1 章
- 何が問題: `csp-phase1-impl` で Phase 1 着地済。`csp-tuning` は監査時点の写真のため Phase 1 が「**これからやる**」風に書かれている可能性。
- 推奨アクション: `csp-tuning` 冒頭に「**Phase 1 は csp-phase1-impl で着地済。本 doc は Phase 1〜3 の全体ロードマップ**」を 1 行追記。
- 信頼度: ★★★

### C11. `error-handling-audit` の E-S のうち error-shield で吸収されるもの
- 種別: 古い
- 場所: `error-handling-audit` 2.4 状態異常 E-S01〜E-S14
- 何が問題: `error-shield` でグローバル吸収する範囲（uncaught error / 5xx / network 全般）と、個別 UX が要る範囲（オフライン / 在庫切れ / token 失効 等）の境界が doc から不明瞭。
- 推奨アクション: `error-handling-audit` 末尾に「**E-S01〜E-S14 のうち error-shield で吸収: E-S0X / 個別 UX 要: E-S0Y**」の対応表を追記。
- 信頼度: ★★

### C12. `copy-audit` Critical はもう潰している
- 種別: 古い
- 場所: `copy-audit-2026-04-28.md` Critical 章
- 何が問題: `critical-copy-fixes` で Critical は対応済。`copy-audit` 本文側に対応マーカーなし。
- 推奨アクション: 冒頭サマリ表に対応状況を追記。
- 信頼度: ★★★

### C13. `lighthouse-roadmap` の D 軸タスクは一部完了済
- 種別: 古い
- 場所: `lighthouse-roadmap-2026-04-28.md` D 軸（仕上げ）章
- 何が問題: `lighthouse-d-tasks` で D 軸の一部は着地済。`lighthouse-roadmap` 側で「これからやる」風の記述が残っている可能性。
- 推奨アクション: `lighthouse-roadmap` 冒頭に「**04-28 時点の進捗: D 軸の N/M 項目が lighthouse-d-tasks で着地**」を追記。
- 信頼度: ★★

---

## 4. バージョン情報・キャッシュバスター不整合

### C14. `?v=N` の値が doc と実コードでずれている可能性
- 種別: バージョン不整合候補
- 場所: `ec-runbook` 4.3「キャッシュバスター v 更新」/ `index.html` / `p3_test.html` の `<script src="...?v=N">` 群
- 何が問題: 04-28 中の連続更新で各 JS の `?v=` が個別に動いている可能性。doc に書かれた手順「v を +1 する」だけでは、**どのファイルの v を上げるか** が不明。
- 推奨アクション: `ec-runbook` 4.3 に「**更新対象ファイル一覧**」を明記（特に `p3_code_for_claude.js` / `enhance.js` / `copy-fix-runtime.js` / `error-shield.js` / `i18n.js` / `register.js` / `particle_*.js`）。
- 信頼度: ★★（実コード未確認）

### C15. doc 上の「最新版」記述が時刻表現に依存している
- 種別: バージョン不整合
- 場所: ほぼすべての doc 冒頭の「**実施日 / 監査日 / 作成日**: 2026-04-28」
- 何が問題: 同じ 04-28 でも午前と午後で別のことが起きている（`TIMELINE` 参照）。doc 名と冒頭の日付だけでは順序が読めない。
- 推奨アクション: 重要 doc には冒頭に **作成時刻** を入れる（例: `2026-04-28 17:11`）か、`TIMELINE.md` を参照させる注記を入れる。
- 信頼度: ★★

---

## 5. 暗黙の前提・記述漏れ（読み手が誤読しやすい箇所）

### C16. `architecture` 内の「P3 は何を指すか」の前提
- 種別: 暗黙の前提
- 場所: `architecture` 全文
- 何が問題: P3 = 「パーティクルユニバース + EC を載せた現行フェーズ」という定義が `architecture` 内で完全には説明されていない可能性。`handoff-to-codex` を先に読まないと P3 が何を指すか分からない。
- 推奨アクション: `architecture` 冒頭に「**P1 〜 P3 の歴史**」を 5 行で要約。あるいは `handoff-to-codex` を必読として冒頭に明記。
- 信頼度: ★★

### C17. 「Codex」が誰を指すかの説明
- 種別: 暗黙の前提
- 場所: `handoff-to-codex` / `codex-review`
- 何が問題: 司さんと Claude には自明だが、第三者が読むと「Codex」が OpenAI の旧モデル名なのか、別エージェント名なのか曖昧。
- 推奨アクション: `INDEX.md` の用語表で対応済（既に対応 ✓）。各 doc 冒頭でも「司さんが並行で動かす別エージェント」と注記推奨。
- 信頼度: ★★★

### C18. `enhance.js` / `copy-fix-runtime.js` / `error-shield.js` の「後付け 3 レイヤ」原則の根拠
- 種別: 暗黙の前提
- 場所: `enhance-layer` / `critical-copy-fixes` / `error-shield` 各冒頭
- 何が問題: 各 doc は「既存コードに触らない後付け」と書くが、**なぜそうしているか**（= 50→101 哲学 / Codex / 別エージェントが触っているコードを壊さない）が doc 内に説明されていない。
- 推奨アクション: 3 doc とも冒頭に「**設計原則**: 既存コードを直接編集しない理由 = 司さんの『50→101』哲学 + 並列エージェントの作業範囲を侵さないため」を 2 行追記。
- 信頼度: ★★★

### C19. `integration-test-plan` の対象期間の表記
- 種別: 暗黙の前提
- 場所: `integration-test-plan-2026-04-28.md` 冒頭「**対象期間の変更:** 2026-04-27 〜 2026-04-28」
- 何が問題: 「対象期間の変更」という表現が、何から何への変更か不明瞭（過去に別期間があった？）。
- 推奨アクション: 「**対象期間**: 2026-04-27 〜 2026-04-28（の作業に対する実機テスト）」と書き換え推奨。
- 信頼度: ★★

### C20. `lighthouse-roadmap` の「実機未実行」の含意
- 種別: 暗黙の前提
- 場所: `lighthouse-roadmap` 冒頭「実機 Lighthouse 未実行（環境制約）。すべて根拠ベースの推定」
- 何が問題: 司さんは MacBook で Lighthouse を実行できる立場のため、「環境制約」が誰の制約か（= Claude のサンドボックスから実機ブラウザを叩けない）が読み手に伝わらない可能性。
- 推奨アクション: 「**実機未実行（Claude セッションからブラウザ実機 Lighthouse を実行できないため）。司さんが実機計測したら本 doc を更新する想定**」と補足。
- 信頼度: ★★

---

## 6. 推測（観測されないが文脈から強く示唆される）

### C21. (推測) Codex 自身が書いた doc は本セットに含まれていない
- 種別: 推測
- 何が問題: `handoff-to-codex` / `codex-review` は **Claude 側からの** doc。Codex 側の作業ログは独立に存在しないか、コード差分のみとして残っている可能性。
- 推奨アクション: 司さんに確認 — Codex のログ / 差分メモがどこかにあるなら docs/ に統合するか、`INDEX.md` に外部リンクとして記載。
- 信頼度: ★★（観測不可）

### C22. (推測) Claude セッションが複数走っていた
- 種別: 推測
- 何が問題: 04-28 の 02:25〜02:37 と 16:32〜17:14 は別セッションの可能性が高い。Claude のコンテキストが連続していたなら 1 日中起きていたことになり、不自然。
- 推奨アクション: 仮説のままでよい。doc の品質には影響しない。
- 信頼度: ★★

### C23. (推測) 司さんは英語版を「やる前提」ではない
- 種別: 推測
- 場所: `i18n-foundation` 冒頭「日本語完全動作維持」
- 何が問題: i18n は土台だけ作って実運用は反応見て決める方針。doc 上は「Phase 1 で稼働」と書いてあるが、実際には **司さんはまだ公開判断していない**可能性。
- 推奨アクション: T26（i18n Phase 1 公開判断）として TODO-MASTER に切り出し済（対応済 ✓）。
- 信頼度: ★★

---

## 7. 「捨ててよい」候補（50→101 哲学）

司さんの「いったん 50 に戻す」哲学に沿って、**整理しても失わないもの** の候補：

### D01. `ec-status-2026-04-27.md` を archive 化
- 理由: `ec-runbook` に完全統合されている。残しても二重管理になる。
- リスク: 04-27 時点のスナップショットが消える。`TIMELINE.md` で「4 項目」言及があれば足りる。
- 推奨: archive 化。
- 信頼度: ★★★

### D02. `ring-research-2026-04-27.md` の position 再考
- 理由: 純粋なリサーチ doc で、最終 API には反映済み。`particle-language-api` の起点としては有用。
- リスク: ほぼなし。残置でよい。
- 推奨: 残す。`particle-language-api` の冒頭から相互リンク追加。
- 信頼度: ★★

### D03. 監査 doc 同士の冗長
- 理由: 監査 doc は「写真」原則で残置。捨てるべきではない。
- 推奨: 何も捨てない。`INDEX.md` を地図として使う。
- 信頼度: ★★★

### D04. 設計 doc の冗長
- 理由: `architecture` と `particle-language-api` は粒度違いで相補的。`handoff-to-codex` は哲学起点で別物。
- 推奨: 何も捨てない。
- 信頼度: ★★★

### D05. 実装 doc の小さなもの（`pwa-sw` / `seo-metadata` / `test-suite-expansion`）
- 理由: 6KB 前後。ログとして十分。検索性も高い。
- 推奨: 残す。
- 信頼度: ★★★

---

## 8. 「正典」原則の運用提案

doc 群の量がここまで来た以上、運用ルールを固定する。

1. **各 audit doc の冒頭に対応状況サマリ表**（C02, C08, C09, C10, C11, C12 で言及）。雛形：

   ```markdown
   ## 0.1 対応状況（YYYY-MM-DD 時点）

   | 重大度 | 件数 | 対応済 doc | 残数 |
   |---|---|---|---|
   | Critical | 8 | critical-fixes ✓ / enhance-layer ✓（部分） | 3 |
   | Major | 14 | enhance-layer ✓（部分） | 10 |
   | Minor | 11 | — | 11 |
   ```

2. **各 impl doc の冒頭に親 audit doc を明記**（C03 で言及）。

3. **doc 名に時刻を含めない**（日付までで十分）が、本文冒頭に時刻を書く（C15）。

4. **新規 doc は INDEX.md に追加が必須**。INDEX を更新しない doc は「孤児」として警告。

5. **古くなった `?v=` / 設定値は実コードを正典に**（C14）。doc に値を書くのではなく、実コードへのリンクと行番号を書く。

---

## 9. 修正候補チェックリスト（司さん向け）

doc 修正をするなら、以下の順で：

- [ ] C01: `ec-status` を archive または注記（5 分）
- [ ] C02 + C08: `accessibility-audit` 冒頭に対応状況サマリ表（10 分）
- [ ] C04: `ec-runbook` 1.3 に token 移行計画注記（5 分）
- [ ] C09: `security-review` 冒頭に対応状況サマリ表（10 分）
- [ ] C10: `csp-tuning` 冒頭に Phase 1 完了注記（5 分）
- [ ] C11: `error-handling-audit` 末尾に E-S 対応表（15 分）
- [ ] C12: `copy-audit` 冒頭に対応状況サマリ表（10 分）
- [ ] C13: `lighthouse-roadmap` 冒頭に進捗注記（5 分）
- [ ] C14: `ec-runbook` 4.3 に更新対象ファイル一覧（10 分）
- [ ] C16: `architecture` 冒頭に P1〜P3 の 5 行サマリ（10 分）
- [ ] C18: `enhance-layer` / `critical-copy-fixes` / `error-shield` 冒頭に設計原則注記（各 5 分）
- [ ] C19: `integration-test-plan` 冒頭の表現修正（2 分）
- [ ] C20: `lighthouse-roadmap` 冒頭の「実機未実行」補足（5 分）

合計 ~ 1.5 時間。**やるかは司さん判断**。本 INDEX セットだけで運用するなら、これらは**やらなくても回る**。

---

## 10. 一言サマリ

> **致命的な矛盾はない。あるのは「監査 doc に対応状況マーカーがない」「EC まわりが二重管理」「token 方針が日内で動いた」の 3 点。INDEX + TODO-MASTER + TIMELINE があればそのままでも回せる。**
