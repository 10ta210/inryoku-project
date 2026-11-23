"""
inryokü 十字架ペンダント — 鋳造用 3D データ生成 (2026-11-23)

単位: mm / Y 上 / Z 手前 (正面)
出力: out/<案>.stl (鋳造業者入稿用) + out/<案>.glb (プレビュー用、パーツ別ノード)

素材想定: シルバー925 (比重 10.36)。ロストワックス鋳造。
最小肉厚 0.8mm 以上 / チェーン穴内径 2.6mm (幅 2mm までのチェーン可)。

実行: python3 build_cross.py
"""
import json
import os

import numpy as np
import trimesh
from manifold3d import Manifold, set_circular_segments

set_circular_segments(64)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
SV925_DENSITY = 10.36  # g/cm3


# ---------- 基本形 ----------
def sphere(r, c=(0, 0, 0)):
    return Manifold.sphere(r).translate(c)


def rounded_box(sx, sy, sz, r, c=(0, 0, 0)):
    """角丸直方体 (8 球の凸包)。r = 角の丸み半径"""
    hx, hy, hz = sx / 2 - r, sy / 2 - r, sz / 2 - r
    pts = [sphere(r, (c[0] + i * hx, c[1] + j * hy, c[2] + k * hz))
           for i in (-1, 1) for j in (-1, 1) for k in (-1, 1)]
    return Manifold.batch_hull(pts)


def ray(p0, r0, p1, r1, flat=1.0):
    """光線: 太い根元 → 細い先端 (2 球の凸包)。flat < 1 で前後に潰す"""
    m = Manifold.batch_hull([sphere(r0, p0), sphere(r1, p1)])
    return m.scale((1, 1, flat)) if flat != 1.0 else m


def tube_bail(y_center, outer_r=2.4, inner_r=1.3, length=3.4):
    """チューブバチカン: 左右に貫通する穴 (チェーンを横から通す)"""
    outer = Manifold.cylinder(length, outer_r, outer_r, center=True)
    inner = Manifold.cylinder(length + 2, inner_r, inner_r, center=True)
    tube = outer - inner
    # Z 軸向き → X 軸向きに回転
    return tube.rotate((0, 90, 0)).translate((0, y_center, 0))


# ---------- 案 A: 白と黒の十字 (P1 Stage 11 直訳) ----------
def design_a():
    # 縦軸 = 白 (RGB / 精神): 鏡面。前面に乗る
    vert = rounded_box(3.4, 34.0, 2.6, 0.9, (0, -2.0, 0.55))
    # 横軸 = 黒 (CMY / 物質): いぶし or 黒ロジウム。背面側に一段下げる
    horiz = rounded_box(22.0, 3.4, 2.0, 0.8, (0, 6.0, -0.35))
    bail = tube_bail(y_center=15.0 + 2.0, outer_r=2.3, inner_r=1.3, length=3.4)
    # 縦軸とバチカンを一体化 (鋳造は一体、色分けは仕上げで)
    white = vert + bail
    black = horiz - white  # 重なり部分は白側に属させる (プレビュー色分け用)
    # 鋳造用の一体形状は元の形同士で合成 (切り分け後の再合成は微小な隙間が出る)
    return {"white": white, "black": black, "_solid": vert + horiz + bail}


# ---------- 案 B: 開眼 (球から光線が伸びる) ----------
def design_b():
    core = sphere(3.0, (0, 0, 0))                     # 同一球体
    flat = 0.78                                       # 光線を前後に薄く
    up = ray((0, 0, 0), 1.45, (0, 11.0, 0), 0.75, flat)
    down = ray((0, 0, 0), 1.45, (0, -19.0, 0), 0.62, flat)
    left = ray((0, 0, 0), 1.35, (-11.0, 0, 0), 0.62, flat)
    right = ray((0, 0, 0), 1.35, (11.0, 0, 0), 0.62, flat)
    # 瞳: 正面に浅いくぼみ (いぶしが溜まって黒い瞳になる)
    pupil = sphere(1.25, (0, 0, 3.0 + 0.55))
    body = (core + up + down + left + right) - pupil
    bail = tube_bail(y_center=11.0 + 2.1, outer_r=2.1, inner_r=1.3, length=3.0)
    return {"silver": body + bail}


# ---------- 案 C: 101% (重厚な等腕十字) ----------
def design_c():
    t = 3.2
    v = rounded_box(5.4, 26.0, t, 1.3)
    h = rounded_box(26.0, 5.4, t, 1.3)
    body = v + h
    # 中央の交点に小さな貫通穴 = 「視点の転換」の覗き穴
    hole = Manifold.cylinder(t + 2, 0.9, 0.9, center=True)
    body = body - hole
    bail = tube_bail(y_center=13.0 + 2.2, outer_r=2.4, inner_r=1.3, length=3.6)
    return {"silver": body + bail}


DESIGNS = {
    "A_white_black": design_a,
    "B_eye_open": design_b,
    "C_101": design_c,
}


def to_trimesh(m: Manifold) -> trimesh.Trimesh:
    mesh = m.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3],
                           faces=np.asarray(mesh.tri_verts), process=False)


def main():
    os.makedirs(OUT, exist_ok=True)
    report = {}
    for name, fn in DESIGNS.items():
        parts = fn()
        whole = parts.pop("_solid", None)
        if whole is None:
            for p in parts.values():
                whole = p if whole is None else whole + p
        tm_whole = to_trimesh(whole)
        tm_whole.export(os.path.join(OUT, f"{name}.stl"))

        scene = trimesh.Scene()
        for pname, p in parts.items():
            scene.add_geometry(to_trimesh(p), node_name=pname, geom_name=pname)
        scene.export(os.path.join(OUT, f"{name}.glb"))

        ext = tm_whole.bounds[1] - tm_whole.bounds[0]
        vol_cm3 = tm_whole.volume / 1000.0
        report[name] = {
            "size_mm": [round(float(x), 1) for x in ext],
            "volume_cm3": round(vol_cm3, 3),
            "weight_sv925_g": round(vol_cm3 * SV925_DENSITY, 2),
            "watertight": bool(tm_whole.is_watertight),
            "holes_genus": int(whole.genus()),
            "triangles": int(len(tm_whole.faces)),
        }
    with open(os.path.join(OUT, "report.json"), "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()


# ---------- プレビュー用データ (preview.html に埋め込む) ----------
def export_viewer_data():
    import base64
    data = {}
    for name, fn in DESIGNS.items():
        parts = fn()
        parts.pop("_solid", None)
        enc = {}
        for pname, p in parts.items():
            mesh = p.to_mesh()
            pos = np.asarray(mesh.vert_properties)[:, :3].astype(np.float32)
            idx = np.asarray(mesh.tri_verts).astype(np.uint32)
            enc[pname] = {
                "p": base64.b64encode(pos.tobytes()).decode(),
                "i": base64.b64encode(idx.tobytes()).decode(),
            }
        data[name] = enc
    return data


def build_preview():
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "preview_template.html")) as f:
        html = f.read()
    with open(os.path.join(OUT, "report.json")) as f:
        report = f.read()
    html = html.replace("/*__MESH__*/null", json.dumps(export_viewer_data()))
    html = html.replace("/*__REPORT__*/null", report)
    with open(os.path.join(here, "preview.html"), "w") as f:
        f.write(html)
    print("preview.html written", len(html) // 1024, "KB")


if __name__ == "__main__" and os.path.exists(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "preview_template.html")):
    build_preview()
