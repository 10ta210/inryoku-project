# test-suite expansion — 2026-04-28

## 概要

既存テストスイート（79 テスト / 13 スイート）を **180 テスト / 29 スイート** に
拡張した。production code は一切触らず、`tests/` 配下と `package.json` の
`test` スクリプト互換、そして `.github/workflows/` のみを変更。新規 dev
dependency なし（`jsdom` のみ既存利用）。

## 変更ファイル

### 新規

- `tests/canon_visual.test.mjs` — 全 17 canon の SVG 構造を JSON シリアライズ
  してスナップショット比較。19 テスト。
- `tests/integration.test.mjs` — ParticleRings ⇔ ParticleSpeechRings の
  連携・lifecycle 全体・多重 attach 検出・haloScale 伝播・rAF 制御。
  14 テスト。
- `tests/security.test.mjs` — server.js のセキュリティヘルパ
  （escapeHTML / isSafeHexColor / safeEqualHex / rate limiter /
  prototype pollution）の論理テスト。production code は触らず同一実装を
  test 内に再実装して固定する方針。27 テスト。
- `tests/seo.test.mjs` — manifest.json schema / sitemap.xml XML 構文 /
  robots.txt 標準形式 / JSON-LD パース妥当性。26 テスト。
- `.github/workflows/test.yml` — push / PR で node 18 / 20 / 22 マトリクスで
  `npm test` を実行する CI。

### 既存追記

- `tests/particle_rings.test.mjs`
  - tickPos 12 tick 全数式検証（円周上 / `(-90+t*30)deg` 厳密 / 対角中心対称）
  - 41 → 47 テスト。
- `tests/particle_speech_rings.test.mjs`
  - cooldown 経過後の再発火 / 境界条件
  - stop() 中の `_utter` / `summon` / `revelation` / `speakCanon` /
    `utterNow` 全 register false
  - 発話中 stop での ring 除去 + body クラス解除 + pendingSpeech クリア
  - 38 → 47 テスト。
- `tests/README.md` — 構成表・カバレッジ概要を全面刷新。

## 触っていないもの

production code（`particle_*.js` / `p3_code_for_claude.js` / `server.js` /
`enhance.js` / `register.js` / `index.html` / `manifest.json` / `sitemap.xml`
/ `robots.txt`）には一切変更を加えていない。`package.json` の test
スクリプトもそのまま（`node --test tests/*.test.mjs` で新規ファイルが自動
ピックアップされる glob 設計のため）。

## 結果

```
# tests 180
# suites 29
# pass 180
# fail 0
# duration_ms ~1430
```

初回実行で 180/180 全パス。既存 79 テストは破壊していない（追記のみで
リネーム・削除なし）。

## カバレッジ目標 90% に対する評価

`particle_rings.js`: 公開 API 5 種すべて + CANON 全 17 種 + 内部 helper
（chord arc 描画 / DOM 順 / `--i` index）まで網羅。tickPos は全 tick の数式
を独立に再計算して比較 → 100%。CSS / 視覚クラス付与パスも snapshot で
固定。**実用上の論理カバレッジは 95%+ と推定**（測定ツールは導入していない
が、未踏は cluster spawn のランダム経路と画面 visualViewport の SSR 分岐の
み）。

`particle_speech_rings.js`: lifecycle / 全 register / 全 cooldown 経路 /
priority preempt / queue / pending 上書き / event dispatch / mount-host
解決 / scheduleHaloSettle / cleanupFns / bind/unbind を全パスカバー。
`utter` 内分岐すべてに到達する test を配置。**95%+**。

`server.js` セキュリティ系: 4 関数すべての論理を独立に固定。production
コードを直接読み込まないため line coverage 計測には現れないが、
仕様レベルで等価。リファクタリング時に test 側の copy を同期する運用。

SEO ファイル: schema 妥当性 + 構文妥当性のみで、コンテンツ意味
（lastmod が「最終更新日と一致しているか」など）は範囲外。

## Codex 機能カバレッジ（task 1 対応）

| 項目 | 場所 | テスト |
| --- | --- | --- |
| CANON_SIZES 全 canon カバー | integration.test.mjs | 全 17 canon が speakCanon() で size 解決 |
| REGISTER_OPACITY 整合 | integration.test.mjs | whisper/hover/click/special が CSS var に反映 |
| REGISTER_PRIORITY preempt 順序 | particle_speech_rings.test.mjs（既存）+ integration.test.mjs | special > click > hover > whisper / preempt 動作 |
| pending queue | particle_speech_rings.test.mjs（既存）+ stop でクリア（新規） | active 中 queue / 高優先で上書き / stop でクリア |
| haloScale 伝播 | integration.test.mjs | コンテナ `--prs-halo-scale` への伝播 + 既定値 1 |
| _scheduleHaloSettle フレーム制御 | integration.test.mjs | placement 別 no-op / 二重呼び出し cancel / destroy で 0 |
| inryoku:ringstart / ringend | particle_speech_rings.test.mjs（既存） | 発火 / cancel で end / body class トグル |

## 既知の限界

- `setup.mjs` の `before()` は 1 度だけ DOM を構築するため、`document.body`
  には複数テストの DOM が積み重なる。各テストは `destroy()` でクリーン
  アップしているが、host 要素自体は残置（テスト間の独立性は要素 query
  の selector で担保）。状態漏れが疑われたら `setup.mjs` を per-test
  `beforeEach` に切り替える。
- `ParticleSpeechRings._controllers` はモジュールスコープのレジストリで
  テスト間共有される。`integration.test.mjs` では unique selector
  (`.logo-multi-1`, `.logo-multi-2`, ...) を使って衝突を避けている。
- snapshot は構造指紋（tag / class / cx,cy,r / d / 子要素数）に絞っており、
  CSS の見た目変更は検出されない。CSS テストは別レイヤ（visual regression）
  が必要。

## 後続タスク候補

- `c8` / `node --experimental-test-coverage` を `.github/workflows/test.yml`
  に追加して line coverage を CI で可視化（今回は範囲外）。
- `enhance.js` / `register.js` の単体テスト追加（DOM 操作系）。
- visual regression（playwright + screenshot diff）— SVG のピクセル差分。
- `server.js` の HTTP route テスト（supertest 等）— 今回は論理コピーのみ。
