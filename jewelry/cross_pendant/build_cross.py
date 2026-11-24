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
from manifold3d import Manifold, OpType, set_circular_segments

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


# ---------- 案 D: 太陽十字 (P1 開眼の sun flash + Stage 7 cross をそのまま金属に) ----------
# 元シェーダー (p1_stage6_eye.js SUN_FRAG):
#   core   = exp(-r²·18)        → 中心の鏡面球
#   corona = exp(-r²·2.2)       → 中心が厚く縁へ薄くなるレンズ円盤
#   vertical / horizontal = 針のように細い光線、同じ長さ、外へ減衰
#                               → 稜線 (ナイフエッジ) をもつ菱形断面の光線、先へ細る
def sun_ray(length, axis):
    """菱形断面の光線。正面に稜線 → 一本の細い光の線が走る"""
    root = [(-0.95, 0, 0), (0.95, 0, 0), (0, 0, 1.6), (0, 0, -0.6)]
    tip = [(-0.42, length, 0), (0.42, length, 0), (0, length, 0.48), (0, length, -0.4)]
    m = Manifold.batch_hull([Manifold.hull_points(root + tip), sphere(0.45, (0, length, 0.03))])
    # +Y 向きに作って回転
    rot = {"up": 0, "left": 90, "down": 180, "right": -90}[axis]
    return m.rotate((0, 0, rot))


def design_d():
    L = 16.0                                           # 中心から光線の先端まで (4 本とも同じ)
    core = sphere(2.4, (0, 0, 1.1))                   # 太陽の核
    rim = Manifold.cylinder(0.9, 5.2, 5.2, center=True)          # 縁の厚み 0.9mm
    lens = Manifold.sphere(5.2).scale((1, 1, 0.27))              # 中心の厚み約 2.8mm
    corona = rim + lens
    vert = sun_ray(L, "up") + sun_ray(L, "down")
    horiz = sun_ray(L, "left") + sun_ray(L, "right")
    # 隠しバチカン: コロナの裏、中心より上。正面からは見えない
    bail = (Manifold.cylinder(3.2, 1.9, 1.9, center=True)
            - Manifold.cylinder(6.0, 1.25, 1.25, center=True)
            ).rotate((0, 90, 0)).translate((0, 2.8, -2.4))
    solid = core + corona + vert + horiz + bail
    # プレビュー色分け用 (重なりは手前のパーツ優先)
    core_p = core
    vert_p = vert - core_p
    horiz_p = horiz - core_p - vert
    corona_p = corona - core - vert - horiz
    bail_p = bail - corona
    return {"core": core_p, "vert": vert_p, "horiz": horiz_p,
            "corona": corona_p, "bail": bail_p, "_solid": solid}


# ---------- 案 D2: 太陽十字 v2 (太い十字 / ジグザグの光 / フラクタルの核) ----------
# 司さん指示 (2026-11-24): 「もっと太くして十字、太陽の光みたいにジグザグ、真ん中をもっとフラクタル」
#   核   = ヴィチェック・フラクタル (十字の中に十字) を 3 段の段差で彫る
#   光線 = 矢じりを 3 つ重ねたジグザグの十字 (太く、稜線つき)
#   コロナ = 腕の間から長短交互に出る 12 本の短い光 (太陽の縁のジグザグ)
def vicsek(level, size, cx=0.0, cy=0.0):
    """ヴィチェック・フラクタルの正方形リスト [(cx, cy, 一辺)]"""
    if level == 0:
        return [(cx, cy, size)]
    s3 = size / 3.0
    out = []
    for dx, dy in ((0, 0), (s3, 0), (-s3, 0), (0, s3), (0, -s3)):
        out += vicsek(level - 1, s3, cx + dx, cy + dy)
    return out


def plus(cx, cy, size, z0, z1, r):
    """レベル 1 の十字を継ぎ目なしの 2 本の棒で作る (小さな隙間・トンネルを作らない)"""
    a = size / 3.0
    zc, zh = (z0 + z1) / 2, z1 - z0
    return (rounded_box(a, size, zh, r, (cx, cy, zc))
            + rounded_box(size, a, zh, r, (cx, cy, zc)))


def fractal_core(S=13.5):
    # 1 段目: レベル 1 の十字 (一辺 4.5mm の正方形 5 つ分)
    t1 = [plus(0, 0, S, -0.8, 1.6, 0.4)]
    # 2 段目: レベル 2 — 5 つの正方形それぞれの中に、また十字 (一辺 1.5mm)
    t2 = [plus(x, y, s, 1.0, 2.3, 0.25) for x, y, s in vicsek(1, S)]
    # 3 段目: 中心の十字をもう一段持ち上げる (自己相似の芯)
    t3 = [plus(0, 0, S / 3, 2.0, 2.9, 0.25)]
    # 頂点: 中心の 1.5mm 角にピラミッド (光の一点)
    h = S / 18
    apex = Manifold.hull_points([(-h, -h, 2.6), (h, -h, 2.6), (h, h, 2.6), (-h, h, 2.6), (0, 0, 3.6)])
    return Manifold.batch_boolean(t1 + t2 + t3 + [apex], OpType.Add)


def zigzag_ray(axis, teeth=((5.5, 11.5, 3.3), (9.5, 15.5, 2.7), (13.5, 19.0, 2.1))):
    """矢じりを重ねたジグザグの光線 (+Y 向きで作って回転)"""
    parts = []
    for i, (y0, y1, w) in enumerate(teeth):
        last = i == len(teeth) - 1
        tw = 0.5 if last else 0.9                      # 先端の半幅 (最小肉厚 1.0mm)
        base = [(-w, y0, 0), (w, y0, 0), (0, y0, 1.9), (0, y0, -0.9)]
        tip = [(-tw, y1, 0), (tw, y1, 0), (0, y1, 1.0), (0, y1, -0.55)]
        parts.append(Manifold.hull_points(base + tip))
    m = Manifold.batch_boolean(parts, OpType.Add)
    rot = {"up": 0, "left": 90, "down": 180, "right": -90}[axis]
    return m.rotate((0, 0, rot))


def sun_corona():
    disc = Manifold.cylinder(1.0, 6.2, 6.2, 96, center=True).translate((0, 0, -0.1))
    spikes = []
    for k in range(16):
        ang = k * 22.5
        if k % 4 == 0:
            continue                                  # 十字の腕の方向は空ける
        R = 9.2 if k % 2 == 1 else 8.0                # 長短交互 = 縁のジグザグ
        a = np.radians(ang)
        d = np.array([np.cos(a), np.sin(a)])
        n = np.array([-d[1], d[0]])
        b = d * 5.6
        pts = [(*(b + n * 1.25), 0), (*(b - n * 1.25), 0), (*b, 1.0), (*b, -0.6),
               (*(d * R + n * 0.42), 0), (*(d * R - n * 0.42), 0), (*(d * R), 0.45), (*(d * R), -0.45)]
        spikes.append(Manifold.hull_points(pts))
    return Manifold.batch_boolean([disc] + spikes, OpType.Add)


def design_d2():
    core = fractal_core()
    vert = zigzag_ray("up") + zigzag_ray("down")
    horiz = zigzag_ray("left") + zigzag_ray("right")
    corona = sun_corona()
    bail = (Manifold.cylinder(3.2, 1.9, 1.9, center=True)
            - Manifold.cylinder(6.0, 1.25, 1.25, center=True)
            ).rotate((0, 90, 0)).translate((0, 3.0, -2.3))
    solid = core + vert + horiz + corona + bail
    vert_p = vert - core
    horiz_p = horiz - core - vert
    corona_p = corona - core - vert - horiz
    bail_p = bail - core - corona
    return {"core": core, "vert": vert_p, "horiz": horiz_p,
            "corona": corona_p, "bail": bail_p, "_solid": solid}


# ---------- 案 D3: 太陽十字架 (P1 最後の十字 = 縦軸優位、下へ伸びる光) ----------
# 司さん指示 (2026-11-24): 「下だけ長くして十字架らしく / もっと光のジグザグ / P1 の最後の十字」
#   p1_stage7_cross.js: 1.2-1.7s で横軸 (CMY) がフェードし縦軸 (RGB) が残る → 画面外へ伸びる
#   → 縦: 上 13mm / 下 26mm (十字架の比率)。横: 11mm で少し細く (消えていく途中の光)
#   → 光線の両側にのこぎり歯。長短交互で、先端へ向かって斜めに散る (光のジグザグ)
def serrated_ray(axis, length, root_w, tip_w=0.45, front=1.9, back=0.9,
                 start=6.0, pitch=2.3, long_t=2.3, short_t=1.2):
    """稜線つきの芯 + 両側に長短交互ののこぎり歯 (+Y 向きで作って回転)"""
    spine = Manifold.hull_points([
        (-root_w, 0, 0), (root_w, 0, 0), (0, 0, front), (0, 0, -back),
        (-tip_w, length, 0), (tip_w, length, 0), (0, length, front * 0.45), (0, length, -back * 0.5),
    ])
    parts = [spine]
    n = int((length - start - 2.5) / pitch) + 1
    for i in range(n):
        ya = start + i * pitch
        f = 1.0 - ya / length                         # 先へいくほど歯も小さく
        t = (long_t if i % 2 == 0 else short_t) * (0.45 + 0.55 * f)
        w = root_w + (tip_w - root_w) * (ya / length)  # その位置の芯の半幅
        yb = ya + pitch * 0.85
        zf, zb = front * (1 - 0.55 * ya / length) * 0.55, back * 0.6
        for sgn in (1, -1):
            xe = sgn * (w - 0.4)
            xt = sgn * (w + t)
            yt = yb + t * 0.55                          # 斜め前へ散る
            parts.append(Manifold.hull_points([
                (xe, ya, zf), (xe, ya, -zb), (xe, yb, zf), (xe, yb, -zb),
                (xt, yt, 0.35), (xt, yt, -0.35),
            ]))
    m = Manifold.batch_boolean(parts, OpType.Add)
    rot = {"up": 0, "left": 90, "down": 180, "right": -90}[axis]
    return m.rotate((0, 0, rot))


def sun_corona_fine(r_disc=6.2, n=24):
    """24 方向の長短交互の光 (腕の方向は空ける)"""
    disc = Manifold.cylinder(1.0, r_disc, r_disc, 96, center=True).translate((0, 0, -0.1))
    spikes = []
    step = 360.0 / n
    for k in range(n):
        if k % (n // 4) in (0,):
            continue
        near_arm = k % (n // 4) in (1, n // 4 - 1)
        R = (8.4 if k % 2 else 9.8) - (0.8 if near_arm else 0.0)
        a = np.radians(k * step)
        d = np.array([np.cos(a), np.sin(a)])
        nn = np.array([-d[1], d[0]])
        b = d * (r_disc - 0.6)
        spikes.append(Manifold.hull_points([
            (*(b + nn * 0.95), 0), (*(b - nn * 0.95), 0), (*b, 0.9), (*b, -0.6),
            (*(d * R + nn * 0.3), 0), (*(d * R - nn * 0.3), 0), (*(d * R), 0.4), (*(d * R), -0.4),
        ]))
    return Manifold.batch_boolean([disc] + spikes, OpType.Add)


def design_d3():
    core = fractal_core(12.0)
    up = serrated_ray("up", 14.5, 3.0)
    down = serrated_ray("down", 28.0, 3.0, tip_w=0.5)
    left = serrated_ray("left", 12.5, 2.4, front=1.6, long_t=1.9, short_t=1.0)
    right = serrated_ray("right", 12.5, 2.4, front=1.6, long_t=1.9, short_t=1.0)
    vert = up + down
    horiz = left + right
    corona = sun_corona_fine()
    bail = (Manifold.cylinder(3.2, 1.9, 1.9, center=True)
            - Manifold.cylinder(6.0, 1.25, 1.25, center=True)
            ).rotate((0, 90, 0)).translate((0, 3.0, -2.3))
    solid = core + vert + horiz + corona + bail
    vert_p = vert - core
    horiz_p = horiz - core - vert
    corona_p = corona - core - vert - horiz
    bail_p = bail - core - corona
    return {"core": core, "vert": vert_p, "horiz": horiz_p,
            "corona": corona_p, "bail": bail_p, "_solid": solid}


DESIGNS = {
    "D3_sun_crucifix": design_d3,
    "D2_sun_fractal": design_d2,
    "D_sun_cross": design_d,
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
