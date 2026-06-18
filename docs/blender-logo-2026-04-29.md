# inryokü Blender ロゴ 仕上げ記録 — 2026-04-29

## 成果物
- `/tmp/inryoku_logo_final.png` — 最終レンダー（800×1100, EEVEE Next, RGBA 透明 PNG）
- `/Users/10ta210/Desktop/inryoku_hp/inryoku_logo_blender_final.png` — プロジェクトコピー

## 構造（Blender シーン: collection `inryoku_logo`）
| オブジェクト | 種別 | 役割 | 主要パラメータ |
|---|---|---|---|
| `inryoku_egg_shell` | MESH | 卵殻本体 | UV球を卵形変形 / Subsurf L=3,R=4 → Boolean(WindowCut, EXACT, hole_tolerant) → Solidify thickness=0.025 offset=-1 material_offset=1 |
| `inryoku_window_cutter` | MESH | 窓を切り抜く Boolean cutter | UV sphere 96×48 + Subsurf L=2 / loc (3.0, -1.0, 0.0) / scale (0.78, 0.55, 1.20) / hide_render, display=WIRE |
| `inryoku_inset_dark` | MESH | 凹み内部を真っ黒で埋めるインナー楕円体 | UV sphere 64×32 + Subsurf L=2 / loc (3.0, -0.20, 0.0) / scale (0.78, 0.45, 1.20) / mat=inryoku_inside_dark |
| `inryoku_i_cone` | MESH | 中央の I コーン | Cone v=64 r1=0.13 r2=0 depth=2.05 + Subsurf L=2,R=3 / loc (3.0, -0.55, 0.05) / mat=inryoku_i_grey |

## マテリアル（Principled BSDF）
| マテリアル | Base Color | Roughness | Specular |
|---|---|---|---|
| `inryoku_shell_grey` | (0.62, 0.62, 0.62) | 0.55 | 0.4 |
| `inryoku_inside_dark` | (0.01, 0.01, 0.01) | 1.0 | 0.0 |
| `inryoku_i_grey` | (0.78, 0.78, 0.78) | 0.45 | 0.5 |
| `inryoku_panel_dark` | (0.0, 0.0, 0.0) | 1.0 | — |

卵殻の slot 構成: [0]=shell_grey, [1]=inside_dark（Solidify material_offset=1 で内側面を inside_dark に）。

## ライティング（3 点 + I スポット）
- `KeyLight` AREA 2.5×3.5, energy=350, 暖色 (1.0, 0.97, 0.93), pos (1.2, -4.0, 2.0)
- `FillLight` AREA 3.0, energy=120, 寒色 (0.9, 0.93, 1.0), pos (5.0, -3.5, 0.5)
- `RimLight` AREA 3.0, energy=250, 白, pos (3.0, 2.0, 1.5) — 後方リム
- `inryoku_i_spot` SPOT angle=35°, energy=80 — I コーン強調
- `Light`, `BigLight` は hide_render/hide_viewport で停止

## カメラ
- `Camera`（scene.camera）: pos (3.0, -7.0, 0.0), rot (90°, 0, 0), lens=85mm — 卵正面ほぼフラット投影

## レンダー設定
- engine: BLENDER_EEVEE_NEXT
- resolution: 800 × 1100, 100%
- film_transparent: True
- format: PNG / RGBA
- world: 暗いニュートラル env (0.04, 0.04, 0.045) strength 0.6

## 設計上の判断
1. **凹みの構造**: Boolean+Solidify だけでは内側が暗くならず光が漏れたため、卵内部に小さな黒色楕円体 `inryoku_inset_dark` を仕込んで「窓越しに常に黒が見える」構造に変更。これがロゴ像として最も安定。
2. **I コーンは涙滴ではなく真円錐**: subsurf を控えめにし（L=2, R=3）、tip がシャープに残るよう depth=2.05, radius=0.13 に。
3. **Subsurf を Boolean の前に置いた**ことで凹みの縁ジャギーを解消。cutter 側にも Subsurf L=2 を適用してさらに滑らかに。
4. **lens=85mm**: 平面感を強めロゴ的な見え方に最適化。
5. 既存 `inryoku_hoodie_v2` 等の他コレクションは未変更。

## 再現手順（要点）
```python
# Boolean が Subsurf の後ろに来るよう順序固定
egg.modifiers: [Subsurf(L=3,R=4)] → [WindowCut(BOOL EXACT)] → [Solidify(t=0.025, off=-1, mat_off=1)]
```

```python
# 視覚的に最重要：黒インナー楕円体
inset.scale = (0.78, 0.45, 1.20); inset.location = (3.0, -0.20, 0.0)
```
