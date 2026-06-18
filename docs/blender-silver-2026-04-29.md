# Blender — inryoku ロゴ Silver 鏡面化 (2026-04-29)

## 目的
ホログラム干渉縞 → **シルバー鏡面**へ。I は元画像準拠の「短い円錐」へ作り直し。

## 変更点

### 1. 新マテリアル `silver_mirror`
- Principled BSDF
  - Base Color: (0.78, 0.79, 0.82, 1.0)
  - Metallic: 1.0
  - Roughness: 0.14
- Coat / Sheen 全て 0
- 干渉縞・ColorRamp 完全廃止

### 2. `inryoku_O_ring`
- マテリアル `egg_shell_holo` → `silver_mirror` 差替
- 形状・位置・サイズは維持（楕円トーラス）

### 3. `inryoku_i_cone` 再作成
- 旧 cone 削除
- `mesh.primitive_cone_add(vertices=64, radius1=0.18, radius2=0.0, depth=0.85)`
- location = (3.0, 0.0, -0.10) — ベースを少し下げて O リング中心線下寄りに
- tip up（+Z 方向）
- マテリアル: `silver_mirror`（リングと同一）
- shade smooth

### 4. `inryoku_inset_dark`
- シーンに存在せず → スキップ

### 5. ライト調整
| ライト | エネルギー | カラー | 備考 |
| --- | --- | --- | --- |
| HoloKey | 4000 → **1800** | 白寄り (mix 0.85) | 銀の反射が刺さらない強度 |
| HoloFill | × 0.7 → 1225 | やや cyan を残し中和 (mix 0.6) | |
| HoloRim | × 0.5 → 1000 | 微 magenta (mix 0.5) | 縁の色味アクセント |
| HoloUnder | × 0.2 → 150 | violet 残し中和 (mix 0.3) | 削除せず最小限 |

### 6. Compositor
- Glare: Fog Glow, threshold 0.95 → **0.98**, size 6（弱め）
- Lens Distortion ノード: **mute**（Dispersion OFF）
- Vignette: 維持

### 7. レンダー
- Cycles 128 samples + OpenImageDenoise
- 1600 × 2200, 透明背景 PNG
- Camera: `RenderCam`

## 出力
- `/tmp/inryoku_logo_silver.png`
- `/Users/10ta210/Desktop/inryoku_hp/inryoku_logo_silver.png`

## 結果
- O リング: 白銀の鏡面、Key/Rim ライトで上下に強いハイライト
- I コーン: 短く立つ尖り、O リング内 60-70% に収まる、リングと同質感

## 制約遵守
- `inryoku_hoodie_v2` 等の他コレクション無変更
- `inryoku_logo` コレクション内で完結
