# Blender Hologram Render — inryokü Logo (2026-04-29)

最高品質ホログラム × 鏡仕上げの再レンダー記録。

## 成果物
- `/tmp/inryoku_logo_hologram.png`（1600×2200, RGBA）
- `/Users/10ta210/Desktop/inryoku_hp/inryoku_logo_hologram.png`（プロジェクトコピー）
- レンダー時間: 約130秒（Cycles 128 samples / OpenImageDenoise）

## シーン構成

`inryoku_logo` コレクションのみレンダー対象。`inryoku_hoodie_v2` `Cube` `inryoku_window_cutter` は `hide_render = True`。

### Mesh（既存維持）
- `inryoku_egg_shell` — 滑らか卵殻（凹み内側スロットあり）
- `inryoku_inset_dark` — 凹み内部の黒オブジェクト
- `inryoku_i_cone` — 細長い円錐（I 字）

## マテリアル（`*_holo` 別名で新規作成、元は保持）

### `egg_shell_holo`（卵殻 = ホログラムミラー）
ノード構造:
```
LayerWeight(Blend=0.35).Facing ──┐
                                 ├─ MixRGB(Mix, Fac=0.35) ── ColorRamp ── Principled.BaseColor
TexNoise(Scale=8, Detail=6) ─────┘                          (silver→cyan→
                                                             violet→magenta→warm)

LayerWeight.Facing ── ColorRamp(0.05→0.18) ── Principled.Roughness
```
Principled BSDF: Metallic = 1.0 / Roughness 動的(0.05〜0.18)
干渉縞は表面ノイズで揺らぎ、Fresnel で正面 silver / 縁 magenta 化。

### `inset_dark_holo`（凹み内部 = 黒鏡）
Principled BSDF: BaseColor = (0.01,0.01,0.012) / Metallic 1.0 / Roughness 0.02
完全鏡面で周囲の干渉色を映す。

### `i_cone_glass`（I 字 = ガラスクリスタル）
```
Glass BSDF (IOR=1.45, Color=#D9F8FF) ──┐
                                       ├─ MixShader(Fac=0.25) ── Output
Emission (Color=#44E0FF, Strength=3) ──┘
```
ガラス透過 + 内部薄シアン発光（観測者哲学: 儚い光）。

## World（環境）
```
TexCoord.Generated ── Mapping ──┬── Gradient(Spherical) ── ColorRamp(#050507→#2D2D33) ──┐
                                │                                                       ├─ MixRGB(Add, 0.5) ── Background(Strength=3.0)
                                └── Voronoi(Scale=8).Distance ── ColorRamp(constant)─────┘
                                    (magenta hot specks, 5%閾値)
```
グレイ球状グラデ + RGBCMY 微小光源（Voronoi）。鏡面に「inryokü 宇宙」が映る。
`film_transparent = True` で PNG アルファ出力（World は反射のみに寄与）。

## ライティング（3点 + リム + アンダー）
すべて Area light、卵中心 (3, 0, 0) を track。

| Name | Loc | Color | Energy | Size |
|---|---|---|---|---|
| HoloKey | (5.0, -3.5, 2.5) | white | 4000W | 2.5 |
| HoloFill | (0.5, -2.5, 0.8) | cyan #44E0FF | 1750W | 3.0 |
| HoloRim | (3.5, 2.5, 2.5) | magenta #FF44CC | 2000W | 2.0 |
| HoloUnder | (3.0, -2.0, -1.5) | violet #BF73FF | 750W | 2.0 |

旧ライト（KeyLight / FillLight / RimLight / BigLight / Light / inryoku_i_spot）は削除。

## カメラ
- `RenderCam`: location (3.0, -5.5, -0.05) — Y方向5.5m手前、わずかロー
- Lens 70mm（卵が画面 ~75%）
- DoF 有効, focus_object = `inryoku_i_cone`, f/4.0（I だけ pin focus）
- **重要修正**: 旧「トラック」コンストレイントが回転を上書きしていた→削除

## レンダー設定
- Engine: **Cycles**（鏡面反射のため EEVEE Next より優先）
- Samples: 128 / Denoiser: OpenImageDenoise
- Bounces: max 12 / glossy 8 / transmission 12（caustics 有効）
- Resolution: 1600 × 2200, Film transparent ON, PNG RGBA
- View Transform: Filmic / Look: Medium High Contrast

## Compositor
```
RenderLayers ── Glare(Fog Glow, threshold=0.85, size=8, HIGH)
              ── LensDistortion(Distortion=0, Dispersion=0.025)  // chromatic aberration
              ── MixRGB(Multiply, Fac=0.55) ── SetAlpha(REPLACE) ── Composite
                       ▲
                       └─ EllipseMask(0.95×0.95) ── Blur(Gauss 200×200)  // vignette
                                                              ▲
                                                 RenderLayers.Alpha ──┘ (set on output)
```
Vignette は乗算で四隅を暗く、最後に元アルファを再付与して透明背景を維持。

## 哲学整合チェック
- グレイ中心 + RGBCMY のみ（白光は鏡面ハイライトとして許容） ✅
- 観測者で世界が変わる: Fresnel + Noise で角度依存色変化 ✅
- 「鏡の中に虹」: Voronoi specks + thin film ramp ✅
- フルネーム不出現 ✅

## 既知のトラップ（次回の自分へ）
1. **camera constraint「トラック」**: 過去セッションで設定された Track To が `cam.matrix_world` を毎フレーム上書きする。`cam.constraints.clear()` してから rotation_euler を設定すること。
2. **CompositorNodeLensdist の入力名**: `Distort` ではなく `Distortion`（綴り注意）。
3. **`hide_render` だけでなく `hide_viewport`** も切らないと viewport screenshot で確認しにくい。
4. EEVEE Next は鏡面反射 / caustics が弱い → このルックは Cycles 必須。
