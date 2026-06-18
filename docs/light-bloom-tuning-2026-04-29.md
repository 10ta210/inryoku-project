# light-bloom 強度チューニング (2026-04-29 R2)

## 動機
実機確認で「玉ぼけ / DVD 盤 / 安っぽい CRT 風」と判定。
派手すぎず、安っぽくないレベルへ調整する。

参照: docs/particle-cheap-diagnosis-2026-04-29.md / docs/light-emission-research-2026-04-29.md

## 方針サマリ
- bloom 強度を概ね 50% 削減
- blur を倍化して hard edge を消し Gaussian 風に soft 化
- 周期を倍近くに伸ばし、呼吸も静かに
- spotlight は「主役 1 つ」を中心に、たまに脇役（lead/sub の 2 階調）
- vignette 暗部はむしろ深く（黒の純度確保）
- chromatic 風 drop-shadow を半減し半径を増やす（CRT 化回避）
- mix-blend-mode は維持しつつ opacity 半減で「色のマジック」を抑制

## CSS 変更点 (light-bloom.css)

| 要素 | プロパティ | Before | After |
|---|---|---|---|
| .p6-bloom-layer | opacity | 0.55 | 0.28 |
| .p6-bloom-layer | filter blur | 8px | 16px |
| .p6-bloom-layer | filter saturate | 1.4 | 1.15 |
| .p6-bloom-layer | filter brightness | 1.05 | 1.02 |
| .p6-bloom-layer | breath 周期 | 7.3s | 13.7s |
| .p6-bloom-layer canvas | drop-shadow #1 alpha | 0.18 / 18px | 0.09 / 28px |
| .p6-bloom-layer canvas | drop-shadow #2 alpha | 0.10 / 36px | 0.05 / 56px |
| .p6-bloom-layer canvas | drop-shadow #3 alpha | 0.06 / 60px | 0.03 / 96px |
| breath keyframe | opacity 振幅 | 0.50–0.62 | 0.25–0.32 |
| breath keyframe | brightness ピーク | 1.10 | 1.05 |
| body.inryoku-speaking 時 | opacity | 0.22 | 0.12 |
| .p6-vignette-back | 周縁 alpha | 0.42 / 0.78 | 0.50 / 0.88 (深め) |
| .p6-vignette-back | overall opacity | 0.85 | 0.92 |
| .p6-vignette-front | center alpha | 0.06 / 0.04 | 0.03 / 0.02 |
| .p6-vignette-front | opacity | 0.75 | 0.45 |
| .p6-vignette-front | drift 周期 | 11.7s | 21.0s |
| .p6-vignette-front | drift opacity 振幅 | 0.65–0.85 | 0.38–0.50 |
| .p6-overexposure-spot | gradient peak alpha | 0.28 | 0.14 |
| .p6-overexposure-spot | filter blur | 6px | 12px |
| .p6-overexposure-spot | transition | 1400ms | 2200ms |
| .p6-overexposure-spot.is-on | opacity | 0.95 | 0.55 (脇役) |
| .p6-overexposure-spot.is-lead.is-on | opacity | — | 0.78 (新規・主役) |
| @keyframes p6-twinkle | brightness ピーク | 1.32 | 1.14 |
| @keyframes p6-twinkle | saturate ピーク | 1.6 | 1.28 |
| .p6-bloom-layer.has-twinkle | twinkle 周期 | 5.4s | 9.8s |

## JS 変更点 (light-bloom.js)
- `ensureSpots`: index 0 のスポットに `is-lead` を付与（主役 1 + 脇役 1）。
- `tickSpots`:
  - 次回点灯までの間隔 4–9s → **7–15s**
  - 主役を 75% 確率で選択、脇役 25%（均等点灯の安っぽさ回避）
  - 点灯持続 1600ms → **2600ms**（fade を CSS 2200ms で受ける）
- `init` low-power フォールバック opacity 0.30 → **0.16**

## Before / After 推定（観測者視点）

| 観測項目 | Before | After |
|---|---|---|
| 全体の発光強度 | 派手・玉ぼけ | 静かな星空、1 点だけ強く見える瞬間 |
| 個々の粒子の縁 | hard / 角ばる | Gaussian 風 soft |
| chromatic aberration | やや強め（DVD 盤） | 微弱（光が滲む程度） |
| 暗部 | 中庸 | 深い「無」 |
| 呼吸 / 点滅 | 5–7s 周期で目立つ | 10–14s 周期で気付かない程度 |
| spotlight 配分 | 全粒子均等＋ランダム 2 個 | 主役 1 個＋脇役 1 個（時差） |
| inryokü 美学 | 「光ってます」 | 「観測した瞬間に光が現れる」 |

## 実装制約遵守
- 触ったのは `light-bloom.css` / `light-bloom.js` のみ
- `p3_*` / `particle_*` / `p3_styles.css` は不変
- クラス名（`.p6-bloom-layer` / `.p6-overexposure-spot` / `.p6-vignette-*`）維持
- `prefers-reduced-motion` 対応継続（アニメ全停止）
- 二重ロード防止 / MutationObserver / visibilitychange 維持

## 検証
- `node --check light-bloom.js` → OK
- `node --test tests/light-bloom.test.mjs` → 全パス
