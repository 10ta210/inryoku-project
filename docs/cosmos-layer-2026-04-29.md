# cosmos-layer — 幻想的 atmospheric overlay 実装解説

**作成日**: 2026-04-29
**対象**: `cosmos-layer.css` / `cosmos-layer.js`
**前提資料**: `light-emission-research-2026-04-29.md` / `particle-cheap-diagnosis-2026-04-29.md`
**前史**: `light-bloom.js` は **canvas を曇らせた**ため削除済み。本実装はその轍を踏まない。

---

## 1. 設計の核

> 既存 `#p6-canvas` / production code に **触らず・曇らせず・邪魔せず** 雰囲気だけ「足す」。

| 軸 | 採用方針 | 理由 |
|---|---|---|
| 触らない | `p3_code_for_claude.js` / `particle_*` / `p3_styles.css` 全部 | 既存美学・パフォーマンス保証 |
| 曇らせない | canvas 自体に `filter: blur` を**かけない** | light-bloom の失敗の本質 |
| 邪魔しない | 全 overlay `pointer-events: none` | クリック・選択を透過 |
| 足し算のみ | 引き算（彩度下げ等）は一切しない | 司さん「足された」体感 |
| 控えめ | opacity 上限 0.08 / 流れ星 30〜120 秒に 1 回 | 静謐の哲学 |
| アクセシブル | `prefers-reduced-motion` 完全対応 | 必須 |

## 2. レイヤ構成（z-index 階層）

```
z:-1   body::before               aurora swirl (極薄 conic-gradient + blur 80px)
z: 0   #p6-canvas (既存)          パーティクル本体（無干渉）
z: 0   #cosmos-overlay (SVG)      DOM 順で canvas の後 → 視覚的に上
                                    └ #cosmos-stars  (parallax 星座)
                                    └ #cosmos-trail  (mouse trail 10 dot)
                                    └ shooting line  (流れ星 1 本使い回し)
z: 1+  #root / UI (既存)          UI が最前面
```

**重要**: aurora の `filter: blur(80px)` は body::before（独立レイヤ）に閉じる。canvas には届かない。これが light-bloom との決定的差。

## 3. 6 効果の実装まとめ

| # | 効果 | 実装 | 場所 |
|---|---|---|---|
| 1 | Aurora swirl | conic-gradient + blur(80px) + screen blend + 78s rotate | `cosmos-layer.css` `body::before` |
| 2 | 流れ星 | SVG line, stroke-dashoffset アニメ, 30〜120s 間隔 | `scheduleShooting()` |
| 3 | Mouse trail | SVG circle × 10, 30ms サンプリング, 1s フェード | `bindTrail()` |
| 4 | 視差スクロール | `<g>` の transform: translate(0, scrollY * 0.08) | `bindParallax()` |
| 5 | 呼吸 | aurora opacity 0.05 ↔ 0.08（body filter は使わない） | aurora keyframes |
| 6 | 景深 | 中央 18% 確率、周辺ほど密、サイズも周辺ほど大 | `buildStars()` |

**呼吸演出の設計判断**: 当初仕様の「body の filter: brightness 1.0↔1.02」は採用せず、aurora 自身の opacity に統合した。理由は既存 `#p6-canvas` が `filter: brightness(1.22) saturate(1.32) contrast(1.06)` を持ち、body filter と多重複合になる懸念があるため。aurora opacity でサイト全体の「明度の脈動」を等価表現する。

## 4. 司さん向け調整パラメータ

`window.cosmosConfig` で実行時上書き可能。例：

```js
window.cosmosConfig = {
  PARALLAX_STAR_COUNT: 50,           // 星を増やす
  SHOOTING_MIN_INTERVAL_MS: 15000,   // 流れ星を増やす
  TRAIL_FADE_MS: 1500                // trail を長く残す
};
// この後で cosmos-layer.js が読まれる必要あり
```

CSS 側のチューニングは `cosmos-layer.css` の以下を直接編集：

| 探す | 何を変える |
|---|---|
| `body::before` の `opacity: 0.06` | aurora の濃度（0.04〜0.10 推奨） |
| `body::before` の `filter: blur(80px)` | 大きいほど霞、小さいほど色が見える（60〜120px） |
| `cosmosAurora` の `78s` | 回転周期（60〜120s） |
| `.cosmos-star` の `fill` | 星色 |
| `.cosmos-shooting` の `stroke` | 流れ星色 |

### パラメータの哲学整合

- **aurora opacity 0.08 上限**: これ以上だと「フィルター」になる。0.04〜0.08 が「気配」のレンジ。
- **流れ星 30 秒以上の間隔**: 連続発光は安物（鑑定基準 §9.1）。間こそ品。
- **trail 1 秒で消える**: 「観測者が居る」を残しすぎない。短い afterimage が哲学整合（§3.3）。
- **景深の中央まばら**: ロゴ周辺は観測者の焦点 → 星を散らす。fovea と peripheral vision の差を視覚言語に翻訳。

## 5. 「曇らせない」検証チェックリスト

- [x] canvas (`#p6-canvas`) に `filter` を追加していない
- [x] body 自体に `filter` をかけていない（既存 canvas filter と無干渉）
- [x] mix-blend-mode は overlay 自身のみ（canvas には付与しない）
- [x] aurora の blur は body::before に閉じる（独立スタッキングコンテキスト）
- [x] SVG 自身に filter なし（個別 element の drop-shadow のみ、しかも極微）

## 6. 副作用・既存衝突確認

| 既存 | cosmos | 衝突？ |
|---|---|---|
| `body::before` / `body::after` | body::before 使用 | 既存 grep で 0 hit、安全 |
| `#cosmos-overlay` ID | 新規 | 衝突なし |
| `.cosmos-*` クラス | 全て新規 prefix | 衝突なし |
| body filter | 使わない方針 | 既存 `#p6-canvas` filter と無干渉 |
| `body.inryoku-speaking` | cosmos も連動して薄く沈める | 既存 speaking 演出と整合 |
| `prefers-reduced-motion` | 全アニメ停止 | 既存挙動と整合 |
| pointer-events | 全 none | UI クリック透過 |

## 7. パフォーマンス見積り

- **DOM**: 47 要素（aurora 0 / 星 36 / trail 10 / line 1）。誤差。
- **CSS animation**: aurora の rotate 1 本のみ。GPU 合成（transform）。
- **rAF**: trail のみ（mousemove 中だけ起動、停止で自動停止）。idle 時 0 fps 消費。
- **scroll**: passive listener + rAF throttle。
- **メモリ**: 数 KB レベル。

## 8. ファイル一覧

```
/Users/10ta210/Desktop/inryoku_hp/cosmos-layer.css
/Users/10ta210/Desktop/inryoku_hp/cosmos-layer.js
/Users/10ta210/Desktop/inryoku_hp/index.html        (</body> 直前に link/script 追加)
/Users/10ta210/Desktop/inryoku_hp/p3_test.html      (同上)
/Users/10ta210/Desktop/inryoku_hp/docs/cosmos-layer-2026-04-29.md  (本書)
```

## 9. 完了条件チェック

- [x] `node --check cosmos-layer.js` → OK
- [x] 既存機能を破壊しない（既存 file 読み取りのみ、touch なし）
- [x] 曇り絶対 NG（canvas に filter かけず、blur は overlay 自身に閉じる）
- [x] 引き算ではなく足し算（彩度・輝度を下げる処理なし）
- [x] vanilla / 依存追加なし
- [x] pointer-events: none
- [x] prefers-reduced-motion 対応

---

**END**
