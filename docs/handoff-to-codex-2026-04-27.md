# Codex への引き継ぎ書（2026-04-27）

inryokü プロジェクト — Claude Opus からの引き継ぎ。
作業ディレクトリ: `/Users/10ta210/Desktop/inryoku_hp/`

---

## 1. ブランド前提（必読）

- **inryokü**: 哲学を纏う服。RGB×CMY 原色論 + 観測の 50%→101%
- **核哲学**: grey = 50% = 現実 / その中に虹 / 観測者で 101% へ
- **6 色**: R 熱・G 生・B 深・C 信号・M 魂・Y 視線
- **白と黒は禁則**（grey に内包）
- **司さんの好み**: 簡潔（caveman talk）/ 実装スピード重視 / 哲学と美学を尊重
- **絶対禁止**: P0 / P1 / P2 のコードを削除しない（既存の通しフロー資産）

メモリ参照（ユーザーローカル）:
- `~/.claude/projects/-Users-10ta210/memory/MEMORY.md`
- `project_inryoku.md` / `project_inryoku_vision.md` / `feedback_no_delete_phases.md` 等

---

## 2. フェーズ構成（既存）

| フェーズ | 内容 | コード |
|---|---|---|
| P0 | Mac ダイアログ | `p1_code_for_claude.js` 内 |
| P1 | Win95 ローディング | `p1_code_for_claude.js` |
| P2 | 量子コードワールド + 球体 | `p2_code_for_claude.js` |
| P3 | パーティクルユニバース + EC | `p3_code_for_claude.js` |

通しフロー: `index.html` が renderPhase1 → p1complete → renderPhase2 → p2complete → renderPhase3。

P3 単体: `p3_test.html`（モバイル UA は自動 redirect）。

---

## 3. 今日 Claude が実装したもの

### 円環粒子言語（メイン成果）

哲学:
- 1 円環 = 1 発話
- 12 tick 時計盤、0=点 / 1=線（弦）
- grey 廃止、RGBCMY のみ
- Heptapod 的「全体を一度に感じる」表現

ファイル:
| ファイル | 役割 |
|---|---|
| [particle_rings.js](../particle_rings.js) | `ParticleRings.render(spec)` / `canon(name)` / `crystallize(svg)` + canon 円環群 |
| [particle_rings.css](../particle_rings.css) | 円環スタイル + halo 配置 + crystallize アニメ |
| [particle_speech_rings.js](../particle_speech_rings.js) | ロゴへの統合（whisper/hover/click） |
| [particle_rings_demo.html](../particle_rings_demo.html) | canon 一覧デモ |

主要 canon（[particle_rings.js:152〜](../particle_rings.js)）:
silence / core / ma / shadow / emit / observation / self_question / declaration / leap / resonance / consensus / past_speculation / future_command / echo / quotation / summon / revelation

### ロゴ統合（halo モード）

ロゴ卵を中心に円環が同心配置:
- マウント先: `.hologram-logo`（`.logo-holo-wrap` の親）
- JS が `_updateHaloPosition` でロゴ中心座標を計算 → top/left を inline 設定
- ロゴ内側には何も触れない → P3 WebGL 球と干渉ゼロ

レジスター:
| トリガー | canon vocab | サイズ (mobile/desktop) |
|---|---|---|
| 30〜90s ランダム whisper | core / ma / shadow / silence / echo | 70 / 80 |
| ロゴ mouseenter | observation / self_question | 90 / 96 |
| ロゴ click | resonance / emit / declaration | 102 / 110 |
| `summon()` | summon | 124 / 136 |
| `revelation()` | revelation | 118 / 128 |

組込済: `p3_test.html` / `index.html` 両方。

最新状態:
- 発話コントローラは `special > click > hover > whisper` の優先度制御あり
- 発話中に弱い `body.inryoku-speaking` を付与し、P3 universe を軽く dim
- halo は `resize` / `scroll` / `visualViewport` / `ResizeObserver` で追従
- `stop()` は発話とタイマー停止、`destroy()` は listener / halo / singleton まで teardown

### ロゴ球 phase 制御（Codex 更新）

- `p3_code_for_claude.js` の P3 WebGL ロゴ球は、常時の気まぐれ色変化をかなり抑制済み
- 新 uniform: `u_phaseColor` / `u_phaseMix` / `u_speechPulse`
- phase: `idle / observe / shadow / emit / resonance / summon / revelation`
- 発話リングに合わせて球の色と光り方を決定論的に寄せる方向
- まだ perception 調整は残るので、CSS 側の apparent size 変更は要注意

### 旧モジュール（残置）

円環で置き換えた前の点線記号モジュールも残してる（参照用）:
- `particle_glyphs.js` / `particle_glyphs.css` / `particle_glyphs_demo.html`
- `particle_whisper.js`（旧 whisper、現在は呼んでない）

削除しないで残置してる。Codex が消したい場合は司さん確認のうえで。

補足:
- `particle_glyphs.*` と `particle_whisper.js` は **live entrypoint からは外れている**
- 現在の `index.html` / `p3_test.html` は `particle_rings.*` + `particle_speech_rings.js` のみ読んでいる

### EC 状況ドキュメント

[docs/ec-status-2026-04-27.md](./ec-status-2026-04-27.md):
- Shopify Storefront API + Gelato POD 統合状態
- 司さんが variant GID 埋める作業が残ってる
- 推奨: `enter-tee` 1 商品で動作確認 → 全 12 商品展開

### リサーチドキュメント

[docs/ring-research-2026-04-27.md](./ring-research-2026-04-27.md):
- Heptapod 参考、SVG アニメパターン
- P3 背景埋もれ問題 → 発話中 universe dim 案
- AI 応答→円環マッピングのキーワードルール草案

---

## 4. Codex が引き継ぐ 3 タスク（司さん指定）

### 優先度 1: ロゴコア（P3 WebGL 球）の色変動制御

**問題**: 司さんが「サイズ毎回違う気がする」と感じる。実体は P3 シェーダーの色変化。

**調査ポイント**:
- [p3_code_for_claude.js:433](../p3_code_for_claude.js:433) `init3DLogoSphere` — 卵中央の Three.js 球体初期化
- シェーダー uniform: `u_time` / `u_hover` / `u_clickT` / `u_morph`
- `candleSize = wrapW * 0.30` でサイズ計算（固定）

**やってほしいこと**:
1. シェーダーの色変化アニメーションを止める／固定化
2. 必要なら hover / click / revelation 時のみ色変化
3. サイズは固定維持
4. 2026-04-27 時点で Codex が phase ベース制御を一部導入済み。残課題は perception と lifecycle 側

### 優先度 2: 円環 UI 微調整

実機基準で詰める:
- chord 太さ（[particle_rings.css](../particle_rings.css) の `.pring__chord` stroke-width）
- tick glow 強度（`.pring__tick` の filter drop-shadow）
- halo opacity（fadein keyframes の to opacity）
- whisper / hover / click のサイズ差
- mobile での見え方（小さすぎ / 大きすぎ）

**Claude の推奨**: 発話中 P3 universe を dim する案（[ring-research-2026-04-27.md セクション 3](./ring-research-2026-04-27.md) 参照）

### 優先度 3: AI 応答接続ルール

司さんの希望:
- テキスト全文を円環化しない
- intent / mood / certainty / direction を抽出 → canon にマップ
- まずは 6〜8 パターン

**現状**: Codex が軽量版を導入済み。全文円環化はしていない。
- `inferSpeechCanon()` で返答の tone / intent を軽く分類
- `observation / self_question / resonance / future_command / quotation / shadow / declaration / revelation / emit` に 1 発だけマップ
- 本格化するなら次は `intent / certainty / direction` ベースへ整理

接続先:
- `showChatUI` / `sendChatMsg` / `speakBinary` あたり（[p3_code_for_claude.js:4071〜](../p3_code_for_claude.js:4071)）
- AI の答え生成後、応答文を分類 → 既存 canon を 1 回発話

---

## 5. 触っちゃダメ・要注意ファイル

| ファイル | 注意 |
|---|---|
| `p1_code_for_claude.js` | P0/P1 — 削除厳禁、変更も慎重に |
| `p2_code_for_claude.js` | P2 量子球 — 削除厳禁 |
| `index.html` 1230〜1260 | フロー切替（P1→P2→P3） — 円環統合の attach 処理だけ追加済み |

---

## 6. テスト / プレビュー

ローカル開発:
```sh
cd /Users/10ta210/Desktop/inryoku_hp
npm run dev  # → http://localhost:3000
```

主要ページ:
- `/p3_test.html` — P3 単体（円環統合済み）
- `/particle_rings_demo.html` — 13 canon 一覧
- `/particle_glyphs_demo.html` — 旧グリフ一覧（参考）
- `/index.html` — 通しフロー（P0→P3）

デバッグ API:
```js
window._inryokuSpeech.utterNow('whisper');   // 即発話
window._inryokuSpeech.utterNow('hover');
window._inryokuSpeech.utterNow('click');
window._inryokuSpeech.summon();
window._inryokuSpeech.revelation();
window._inryokuSpeech.stop();
window._inryokuSpeech.destroy();
```

---

## 7. バージョン管理

各ファイルにキャッシュバスター付与済み。変更時は version を bump:
```
particle_rings.css?v=6
particle_speech_rings.js?v=4
particle_rings.js?v=2
p3_styles.css?v=20260428polish2
```

p3_test.html と index.html の両方を更新する。

---

## 8. 司さんへのコミュニケーション原則

- **caveman talk**（簡潔・冗長禁止）
- 確認は 1 度、不要な再確認しない
- 提案は箇条書き or 表で
- 哲学的問いには真面目に答える（流さない）
- 「削除は絶対しない」
- 公開物に司さんのフルネーム書かない（GREY 等に置換）

---

## 9. 残タスクリスト（優先順）

| # | タスク | 担当（推奨） | 状態 |
|---|---|---|---|
| 1 | ロゴコア色変動制御 | Codex | phase 化済み・微調整中 |
| 2 | 円環 UI 微調整 | Codex | dim/サイズ/halo 調整済み・継続 |
| 3 | AI 応答→円環マッピング | Codex | 初版実装済み・改善中 |
| 4 | EC: Gelato 1 商品試作 | 司さん（手動） | 待ち |
| 5 | EC: variant GID 埋め込み | 司さん（手動） | 待ち |
| 6 | 円環 canon 拡張（必要に応じて） | 後回し | 未着手 |
| 7 | 旧 glyph モジュールの整理 / 削除判断 | 司さん確認後 | 保留 |

---

## 10. メモリへの追記推奨

Codex で円環統合まわり完了したら、`~/.claude/projects/-Users-10ta210/memory/project_inryoku.md` に円環粒子言語の現状を追記する（既に Claude が一部追記済み）。

---

引き継ぎ完了。Codex 健闘を祈る。
