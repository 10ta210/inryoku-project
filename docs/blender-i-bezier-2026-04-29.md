# Blender: inryokü ロゴ I 部分 — Bezier + Screw 旋盤手法

**日付**: 2026-04-29
**対象**: `inryoku_i_cone` (collection: `inryoku_logo`)
**バージョン**: v4 (Bezier カーブ + Screw Modifier 旋盤方式)

## 背景

過去の bmesh 直接生成アプローチ（v2, v3）は形状制御が困難で、参考画像と合わない結果に：

- bmesh + Z 反転 → teardrop（先端が球状に丸い）
- bmesh + 円弧プロファイル → tip 丸すぎ + base 細すぎ

参考画像のプロポーション：
- 高さ : 底幅 ≈ 2 : 1（縦長）
- tip: 鋭い（半径 0.02〜0.03）
- base: 広い（半径 0.40〜0.46）
- 側面: ほぼ直線で広がる
- 底部 rim: 軽い丸み

## 採用手法: 旋盤方式

X-Z 平面で右半分の輪郭（プロファイル）を Curve（POLY spline）で描き、Screw Modifier で Z 軸 360° 回転させて回転体を生成する。

利点：
1. 輪郭点を直接編集できるので形状制御が確実
2. 回転対称形状が一発で得られる
3. 旋盤プロファイルなので底のリム膨らみも自然に実現

## プロファイル点座標（最終確定）

`(X = 半径, Z = 高さ)` の順、ローカル座標：

```python
points = [
    (0.0,  -0.50),    # 中心底（Z軸上の点）
    (0.44, -0.50),    # 底外周（フラット）
    (0.46, -0.485),   # rim 外向きの軽い膨らみ
    (0.45, -0.47),    # rim 内側に少し戻る
    (0.42, -0.44),    # 直線テーパー開始点
    (0.32, -0.20),    # 中腹
    (0.20,  0.05),    # 上半
    (0.10,  0.30),    # tip 直前
    (0.025, 0.50),    # tip（鋭い）
]
```

総高さ: 1.00 (Z = -0.50 〜 +0.50)
最大半径: 0.46
tip 半径: 0.025

## 実装スクリプト概要

```python
import bpy

# 既存削除
old = bpy.data.objects.get('inryoku_i_cone')
if old:
    data = old.data
    bpy.data.objects.remove(old, do_unlink=True)
    if isinstance(data, bpy.types.Curve):
        bpy.data.curves.remove(data)

# Curve 生成
crv_data = bpy.data.curves.new('inryoku_i_curve', 'CURVE')
crv_data.dimensions = '3D'
spline = crv_data.splines.new('POLY')
spline.points.add(len(points) - 1)
for i, (x, z) in enumerate(points):
    spline.points[i].co = (x, 0, z, 1)

obj = bpy.data.objects.new('inryoku_i_cone', crv_data)
bpy.context.collection.objects.link(obj)

# inryoku_logo コレクションへ
target = bpy.data.collections.get('inryoku_logo')
for c in list(obj.users_collection):
    c.objects.unlink(obj)
target.objects.link(obj)

# Screw modifier (旋盤)
mod = obj.modifiers.new('Screw', 'SCREW')
mod.axis = 'Z'
mod.angle = 6.2831853  # 360°
mod.steps = 64
mod.render_steps = 96
mod.use_normal_calculate = True
mod.use_smooth_shade = True

# Subsurf (滑らか化)
mod2 = obj.modifiers.new('Subsurf', 'SUBSURF')
mod2.levels = 2
mod2.render_levels = 3

# マテリアル
mat = bpy.data.materials.get('silver_matte')
obj.data.materials.append(mat)

# 配置 (O リング中心)
obj.location = (3, 0, -0.10)
```

## モディファイヤ設定

| Modifier | 設定 | 目的 |
|---|---|---|
| Screw | axis=Z, angle=360°, steps=64, render_steps=96 | Z 軸旋盤 |
| Screw | use_smooth_shade=True | スムースシェード |
| Subsurf | levels=2, render_levels=3 | 表面を滑らかに |

## 配置

- `obj.location = (3, 0, -0.10)` — O リング中心と整合
- 高さ方向に -0.10 オフセット（ビジュアルバランス調整）

## 制約遵守

- O リング (`inryoku_O_ring`) 触らず
- カメラ・ライト・Compositor 維持
- `inryoku_logo` コレクション内のみ操作
- マテリアル `silver_matte` 流用

## 成果物

- `/tmp/inryoku_logo_silver_v4.png`
- `/Users/10ta210/Desktop/inryoku_hp/inryoku_logo_silver_v4.png`

## 反省・知見

1. **bmesh 直接生成は形状ミスマッチが起きやすい** — 旋盤プロファイル方式の方が直感的かつ正確
2. **POLY spline で十分** — Bezier ハンドル制御は不要、点列で輪郭定義 → Subsurf で滑らか化が単純で確実
3. **viewport screenshot は別アングル**で見えがちなので、形状検証はメッシュ vertex 座標を直接確認するか、レンダーで判定する
4. **rim の表現**は2点（外側膨らみ + 内側戻り）の組み合わせが効果的

## 次回への申し送り

- プロファイル微調整したい場合は `points` リストの該当行のみ変更すればよい
- スパイラル効果を出したい場合は Screw `screw_offset` を 0 以外に設定（現在は純旋盤）
- tip をさらに鋭くしたい場合は最終点 X を 0.01 まで下げる（現在 0.025）
