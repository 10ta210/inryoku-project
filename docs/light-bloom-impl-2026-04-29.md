# light-bloom 実装解説 (2026-04-29)

## 目的
P3 パーティクルユニバース (`#p6-canvas`) の「安っぽさ」を CSS / 後付け JS のみで解消し、真の発光感を引き出す。
Codex hot file (`p3_code_for_claude.js`, `particle_*.js`, `p3_styles.css`) は一切触らない。

## 構成
| ファイル | 役割 |
|---|---|
| `light-bloom.css` | 疑似 Bloom / vignette / overexposure spot のスタイル定義 |
| `light-bloom.js` | canvas clone を 30fps で描き直し、spot を脈動させる軽量レイヤ |
| `p3_test.html`, `index.html` | `<body>` 末尾で 2 ファイルをロード (states.js より後) |
| `tests/light-bloom.test.mjs` | 構造的不変条件 + jsdom ランタイムテスト |

## 6 つの技法 (採用 / 不採用 内訳)

1. **疑似 Bloom レイヤ** — 採用。`captureStream()` ではなく `drawImage(srcCanvas, ...)` を 30fps RAF で実行し、半解像度 canvas に描いて `blur(8px) saturate(1.4) brightness(1.05)` + `mix-blend-mode: screen`。captureStream は WebGL の preserveDrawingBuffer 制約や iOS 互換で不安定。
2. **多層 drop-shadow** — 採用 (clone canvas 側に付与)。ホット file 側の `filter: brightness(1.22) saturate(1.32) contrast(1.06)` は維持。bloom canvas に `drop-shadow(white) → drop-shadow(cyan) → drop-shadow(magenta)` を 3 層。
3. **vignette + glow ring** — 採用。`body::before/::after` ではなく **専用 div** (`.p6-vignette-back/front`) を採用。既存 production の `body::before` 衝突回避。`multiply` (周縁暗化) + `screen` (中央微発光) で観測者の視野表現。
4. **点滅アニメ強化** — 採用 (bloom 層 only)。既存パーティクルは触らないという制約があるため、bloom 層全体に `p6-twinkle` keyframe (5.4s 周期、92→94→96% で短時間ピーク)。
5. **暗部の沈黙化** — 採用。vignette-back の `multiply` で周縁を `rgba(4,5,7,0.78)` まで沈める → コントラスト UP。
6. **chromatic aberration** — 採用 (控えめ)。bloom canvas に cyan / magenta drop-shadow。production canvas 側の RGB ズレは過剰になるためしない。
7. **HDR 風 over-exposure spots** — 採用。`.p6-overexposure-spot` を 1〜2 個生成し、4-9 秒間隔でランダム位置に 1.6 秒間光らせる。中心 ±35% に制限し過剰拡散を防ぐ。

## パフォーマンス

- 半解像度 canvas (window/2) + 30fps 制限 → 60fps の半分のコスト。
- `prefers-reduced-motion` / `hardwareConcurrency <= 4` / モバイルで RAF ループ停止 (CSS の vignette のみ残る)。
- `visibilitychange` で tab 非表示中は RAF 停止。
- `will-change: opacity, filter` を bloom 層に付け GPU 合成へ。

## 司さん向け 調整可能パラメータ

### CSS 側 (`light-bloom.css`)

| 変えたい挙動 | 触る場所 |
|---|---|
| Bloom 全体を強くしたい | `.p6-bloom-layer { opacity: 0.55 }` を 0.65 / 0.75 に |
| Bloom をもっとボヤッと | `.p6-bloom-layer { filter: blur(8px) }` を 12px / 16px に |
| 周縁の暗さを変えたい | `.p6-vignette-back` の最後の `rgba(4,5,7,0.78)` を 0.6 / 0.9 に |
| 中央のリング光をはっきり | `.p6-vignette-front` の `rgba(180,200,230,0.06)` を 0.10 / 0.14 に |
| キラッの頻度を上げたい | `p6-twinkle 5.4s` を 3.4s / 2.4s に |
| 脈動の周期 | `p6-bloom-breath 7.3s` を 4-12s で |
| over-exposure spot のサイズ | `.p6-overexposure-spot { width:180px; height:180px; }` |
| spot の白の強さ | `radial-gradient` の最初の `rgba(255,255,255,0.28)` を 0.4 / 0.5 に |

### JS 側 (`light-bloom.js`)

| 変えたい挙動 | 触る場所 |
|---|---|
| FPS を上げたい / 下げたい | 先頭の `var TARGET_FPS = 30;` を 45 / 20 に |
| spot の点灯頻度 | `state.spotTimer = now + 4000 + Math.random() * 5000;` の数値 |
| spot の数 | `ensureSpots(prefersReducedMotion ? 1 : 2)` の 2 を 3 に |
| spot 配置範囲 | `pickSpotPosition` 内の `* w * 0.7` を 0.5 / 0.9 に |

### ランタイム調整 (DevTools console)

```js
window.inryokuLightBloom.setBloomOpacity(0.7);
window.inryokuLightBloom.disable();   // off
window.inryokuLightBloom.enable();    // on
```

## 既存機能との衝突回避

- production の `#p6-canvas` filter は **そのまま** (上書きしない)。bloom は別 div で **加算的** に重ねる。
- `body.inryoku-speaking` 中は bloom を `opacity: 0.22` に下げ、既存の speaking 演出 (`brightness(0.74)`) と整合。
- `body::before / ::after` は使わず class ベース → 既存セレクタとの衝突なし。
- z-index: bloom=0 / vignette-back=1 / vignette-front=2 / spot=3。`#p6-canvas` は z-index 未指定 (= auto) のため、各層は **下から bloom → canvas → vignette-back → vignette-front → spot → UI** の順で重なる想定。UI 要素 (footer / header / chat / particle_rings) は z-index ≥ 10 で問題なし。

## 検証

```bash
node --check light-bloom.js
npm test                         # tests/light-bloom.test.mjs を含む全件
```

ブラウザ:
- `/p3_test.html` を開いて画面が「中央集中 + 周縁暗化 + たまにキラッと光るスポット」になっていれば成功。
- DevTools Performance で 60fps 維持 (bloom 層は 30fps 部分描画) を確認。

## 今後の拡張余地 (未実装)

- WebGL Bloom (`UnrealBloomPass`) を p3 内部に組み込む路線 — Codex hot file 側のリファクタが必要なため未着手。
- spot の色味を時間帯で変える (朝 = 青白 / 夜 = 紫赤)。
- IntersectionObserver で section 切替に合わせて bloom 強度を変える。
