# inryokü Logo — 立体 O リング (2026-04-29)

## 司さんの指示
> ０みたいに空洞にして 立体だけど０の立体 卵じゃない

卵殻ではなく、中心が貫通した立体「0」リング。

## 結果
- `/tmp/inryoku_logo_O_ring.png`
- `/Users/10ta210/Desktop/inryoku_hp/inryoku_logo_O_ring.png`
- 1600×2200 / RGBA / Cycles 128 + OIDN denoise

## 実装

### 1. 旧オブジェクト削除
- `inryoku_egg_shell` 削除
- `inryoku_inset_dark` 削除
- `inryoku_window_cutter` 削除（卵専用カッターのため不要）

### 2. 立体 O リング作成
方式 (A) Torus 変形を採用。Boolean 不要で整流された形になる。

```python
bpy.ops.mesh.primitive_torus_add(
    major_radius=1.0,
    minor_radius=0.18,
    major_segments=128,
    minor_segments=32,
    location=(3.0, 0.0, 0.0),
)
ring = bpy.context.active_object
ring.name = 'inryoku_O_ring'

# 軸を Y にして、リング面を X-Z 平面（カメラ正対）に
ring.rotation_euler = (math.radians(90), 0, 0)
bpy.ops.object.transform_apply(rotation=True)

# 縦長 0 シルエット (Z 1.4 倍 stretch)
ring.scale = (1.0, 1.0, 1.4)
bpy.ops.object.transform_apply(scale=True)

bpy.ops.object.shade_smooth()
mod = ring.modifiers.new('Subdiv', 'SUBSURF')
mod.levels = 2
mod.render_levels = 3
```

最終寸法: **2.36 × 0.50 × 3.30** （旧卵 1.99 × 1.73 × 2.80 と近い高さ感、薄いリング厚）

### 3. マテリアル流用
既存 `egg_shell_holo`（ホログラム鏡面）を割り当て。inset_dark_holo は不要に。

### 4. I コーン位置調整
旧: `(3.0, -0.55, 0.05)` — 卵手前にオフセット  
新: `(3.0, 0.0, 0.0)` — リング中心の穴の中で立つ  
形状・材質 (`i_cone_glass`) は維持。

### 5. レンダー
- Camera: `RenderCam` `(3.0, -5.5, -0.05)` から -Y 方向を正対
- Cycles 128 samples + OpenImageDenoise
- Film Transparent ON / RGBA
- 1600×2200
- HDRI、3点ライト (`HoloKey`/`HoloFill`/`HoloRim`/`HoloUnder`)、Compositor 設定はすべて維持

## 触っていないもの
- `inryoku_hoodie_v2` 関連
- `i_cone_glass` `egg_shell_holo` などホログラムマテリアル本体
- ライティング・Compositor・カメラ設定
