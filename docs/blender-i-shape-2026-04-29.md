# inryokü ロゴ I 形状 (teardrop / 逆さ涙滴) 制作ノート

日付: 2026-04-29
対象: `inryoku_i_cone` (inryoku_logo コレクション)
出力: `/tmp/inryoku_logo_silver_v2.png`, `/Users/10ta210/Desktop/inryoku_hp/inryoku_logo_silver_v2.png`

## ゴール

司さん指定の I 形状:
- 上端: わずかに丸い tip（完全な pinpoint ではない）
- 中段: 上が細く、下に向かって緩やかに膨らむ
- 下端: 半球状に丸く膨らんだ底（フラットでない）
- 全体: pear / teardrop の逆さま (tip up, dome down)
- 質感: マット silver、ソフトハイライト

## 実装方針

bmesh で 2D 輪郭プロファイル (r, z) を作って Z 軸まわりに 72 セグメントで lathe (revolve) する方式を採用。理由: cone primitive + 後加工より、teardrop の連続的な曲率を直接コントロールできる。

### プロファイル構成

3 セクションを連結:

1. **トップ丸キャップ** (8 ステップ, 1/4 円弧, R=0.04)
   - 頂点 (0, 0, 0.49) から (0.04, 0, 0.45) へ
   - tip を完全な点にせず R_top=0.04 の小ドームで丸める
2. **ボディ** (24 ステップ, t^1.5 で外側に膨らむ曲線)
   - (0.04, 0.45) → (0.22, -0.30) へ z を線形、r を t^1.5 で広げる
   - exponent 1.5 にすると上が細く下が膨らむ teardrop 曲線
3. **底面ドーム** (16 ステップ, 1/4 円弧, R=0.22)
   - (0.22, -0.30) から (0, -0.52) へ半球状に閉じる

### lathe (revolve)

- セグメント数: 72 (滑らかさ十分)
- 各 ring を bmesh で生成 → ring 間に quad、軸頂点（r=0）には triangle fan
- `recalc_face_normals` で外向き法線

### 後処理

- スケール Z 反転 (上下逆だったため `scale.z *= -1` → apply transform → recalc normals)
- Subsurf modifier (levels=2, render=3) で更に滑らか
- 全 face `use_smooth = True`

### マテリアル

- `silver_matte`: `silver_mirror` を `.copy()` してロードネスを 0.22 に変更
  - O リング (`inryoku_O_ring`) は元の `silver_mirror` のまま (touchない)
  - I 単体だけ少しマット

### Transform

- location: (3.0, 0.0, -0.05)
- 高さ約 1.01、最大幅約 0.44

## 司さん画像との一致

- 上が細く下が丸い: yes
- tip 半丸み: yes (R_top=0.04)
- 底が半球: yes (full quarter-circle dome)
- マット silver: yes (roughness 0.22)

## 再現コード抜粋

```python
import bmesh, math
profile = []
# top dome (R=0.04 quarter arc)
for i in range(9):
    a = (math.pi/2)*(i/8)
    profile.append((0.04*math.sin(a), 0.49 - 0.04*(1-math.cos(a))))
# body (t^1.5 widening)
for i in range(1, 25):
    t = i/24
    profile.append((0.04 + 0.18*(t**1.5), 0.45 + (-0.30 - 0.45)*t))
# bottom hemisphere
for i in range(1, 17):
    a = (math.pi/2)*(i/16)
    profile.append((0.22*math.cos(a), -0.30 - 0.22*math.sin(a)))
# revolve 72 seg with bmesh ...
```

## レンダー

- RenderCam, 1600x2200, RGBA 透明 PNG
- 既存ライト/Compositor 維持

## 既知の改善点 (将来)

- もし司さんが「もっと丸い tip」希望なら R_top を 0.05〜0.06 に
- 「もっとずんぐり」なら exponent を 1.2 へ、R_max を 0.25 へ
- ハイライトを更にソフトにするなら roughness 0.28 まで
