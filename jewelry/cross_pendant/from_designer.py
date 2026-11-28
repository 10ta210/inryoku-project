"""
太陽十字デザイナー (sun_cross_designer.html) で保存したデザイン → 鋳造用 STL (2026-11-28)

デザイナーの buildPrims() と同じ式で、部品を manifold3d で 1 つの立体に合成する。
デザイナーの確認用 STL は部品が重なったままだが、こちらは水密な 1 つの立体になる。

使い方:
  python3 from_designer.py design.json            # {"name": ..., "params": {...}} か params だけの JSON
  → out/designer/<名前>.stl と <名前>.glb (色分けプレビュー) と report を出力
"""
import json
import math
import os
import re
import sys

import numpy as np
import trimesh
from manifold3d import CrossSection, Manifold, OpType, set_circular_segments

from build_cross import SV925_DENSITY, rounded_box, sphere

set_circular_segments(64)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "designer")

DEFAULTS = {
    "armUp": 17.5, "armDown": 31, "armSide": 16.5, "armW": 3.0, "sideRatio": 0.8,
    "teethOn": True, "pitch": 2.3, "longT": 2.3, "shortT": 1.2, "spread": 0.55,
    "center": "eye", "R": 8, "eye": "right",
    "ringOn": True, "ringR": 12.5, "ringW": 1.2, "beamsOn": True, "beamsQ": 3,
    "coronaOn": True, "coronaQ": 5, "coronaLong": 4.4, "coronaShort": 2.6,
    "scale": 100,
}
ROT = {"up": 0, "left": 90, "down": 180, "right": -90}


def rot_pts(pts, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return [(x * c - y * s, x * s + y * c, z) for x, y, z in pts]


def hull(pts):
    return Manifold.hull_points(pts)


def ray(axis, L, o):
    rootW, tipW = o["rootW"], o.get("tipW", 0.45)
    front, back = o.get("front", 1.9), o.get("back", 0.9)
    y0, start = o["y0"], o["start"]
    t0 = y0 / L
    lerp = lambda a, b, t: a + (b - a) * t  # noqa: E731
    w0, f0, b0 = lerp(rootW, tipW, t0), lerp(front, front * 0.45, t0), lerp(back, back * 0.5, t0)
    r = lambda pts: rot_pts(pts, ROT[axis])  # noqa: E731
    parts = [hull(r([(-w0, y0, 0), (w0, y0, 0), (0, y0, f0), (0, y0, -b0),
                     (-tipW, L, 0), (tipW, L, 0), (0, L, front * 0.45), (0, L, -back * 0.5)]))]
    if o["teethOn"] and L - start >= 1.5:
        n = math.trunc((L - start - 2.5) / o["pitch"]) + 1
        for i in range(n):
            ya = start + i * o["pitch"]
            yb = ya + o["pitch"] * 0.85
            if yb > L:
                break
            f = 1 - ya / L
            t = (o["longT"] if i % 2 == 0 else o["shortT"]) * (0.45 + 0.55 * f)
            w = rootW + (tipW - rootW) * (ya / L)
            zf, zb = front * (1 - 0.55 * ya / L) * 0.55, back * 0.6
            for sg in (1, -1):
                xe, xt, yt = sg * (w - 0.4), sg * (w + t), yb + t * o["spread"]
                parts.append(hull(r([(xe, ya, zf), (xe, ya, -zb), (xe, yb, zf), (xe, yb, -zb),
                                     (xt, yt, 0.35), (xt, yt, -0.35)])))
    return Manifold.batch_boolean(parts, OpType.Add)


def lathe(profile, segs=160):
    return Manifold.revolve(CrossSection([profile]), segs)


def plate(R):
    return lathe([(0, -0.9), (R - 0.7, -0.9), (R, -0.5), (R, 0.5), (R - 0.7, 0.9), (0, 0.9)])


def ring(rm, w, front=1.5, back=0.8):
    return lathe([(rm, -back), (rm + w, 0), (rm, front), (rm - w, 0)])


def spokes(n, r0, r1, half, front, back, len_fn=None):
    out = []
    for k in range(n):
        if k % (n // 4) == 0:
            continue
        a = k * 2 * math.pi / n
        d = np.array([math.cos(a), math.sin(a)])
        nn = np.array([-d[1], d[0]])
        R1 = len_fn(k) if len_fn else r1
        ends = [(r0, half, front, back), (R1, 0.3, 0.4, 0.4)] if len_fn else [(r0, half, front, back), (R1, half, front, back)]
        pts = []
        for rr, hw, fz, bz in ends:
            c = d * rr
            pts += [(*(c + nn * hw), 0), (*(c - nn * hw), 0), (*c, fz), (*c, -bz)]
        out.append(hull(pts))
    return Manifold.batch_boolean(out, OpType.Add)


def qbez(p0, c, p1, n=24):
    t = np.linspace(0, 1, n)[:, None]
    p0, c, p1 = map(np.array, (p0, c, p1))
    return [tuple(v) for v in (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t ** 2 * p1]


def eye_lines():
    upper = qbez((-6, 0), (0, 4.6), (6.4, 0.8)) + [(9.4, 0.9)]
    lower = qbez((-6, 0), (0, -3.6), (5.8, 0.75))
    brow = qbez((-6, 3.9), (0.5, 6.9), (9, 4.3))
    tear = [(-0.9, -1.5), (-1.05, -4.0), (-1.3, -6.8)]
    lead = qbez((1.9, -1.4), (2.7, -4.1), (5.2, -4.4), 16)
    c, a0, a1 = np.array((6.8, -4.9)), math.radians(162), math.radians(500)
    sp = []
    for k in range(40):
        a = a0 + (a1 - a0) * k / 39
        R = 1.68 + (0.8 - 1.68) * k / 39
        sp.append(tuple(c + R * np.array((math.cos(a), math.sin(a)))))
    return [(upper, 0.56), (lower, 0.55), (brow, 0.66), (tear, 0.66), (lead + sp, 0.56)]


def stroke(pts, r, zc, flat=0.8):
    segs = []
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        segs.append(Manifold.batch_hull([
            Manifold.sphere(r, 20).scale((1, 1, flat)).translate((x0, y0, zc)),
            Manifold.sphere(r, 20).scale((1, 1, flat)).translate((x1, y1, zc)),
        ]))
    return Manifold.batch_boolean(segs, OpType.Add)


def eye_center(R, flip):
    k, kk, sx = 0.82 * R / 8, R / 8, (-1 if flip else 1)
    lines = [stroke([(sx * (x - 1.4) * k, (y + 0.4) * k) for x, y in line], r * k, 1.0)
             for line, r in eye_lines()]
    ic = (sx * (0.25 - 1.4) * k, (0.35 + 0.4) * k)
    ir = 1.7 * kk
    iris = Manifold.sphere(ir, 64).scale((1, 1, 0.6)).translate((ic[0], ic[1], 0.7))
    pupil = sphere(0.6 * kk, (ic[0], ic[1], 0.7 + ir * 0.6 + 0.3))
    return Manifold.batch_boolean(lines + [iris], OpType.Add) - pupil


def plus(cx, cy, S, z0, z1, r):
    a = S / 3
    zc, zh = (z0 + z1) / 2, z1 - z0
    rr = lambda w: min(r, w / 2 - 0.01, zh / 2 - 0.01)  # noqa: E731
    return rounded_box(a, S, zh, rr(a), (cx, cy, zc)) + rounded_box(S, a, zh, rr(a), (cx, cy, zc))


def fractal_center(R):
    S = (R - 0.8) / 0.53
    s3 = S / 3
    parts = [plus(0, 0, S, 0.6, 1.8, 0.4)]
    for dx, dy in ((0, 0), (s3, 0), (-s3, 0), (0, s3), (0, -s3)):
        parts.append(plus(dx, dy, s3, 1.5, 2.4, 0.25))
    parts.append(plus(0, 0, s3, 2.2, 2.9, 0.25))
    h = S / 18
    parts.append(hull([(-h, -h, 2.7), (h, -h, 2.7), (h, h, 2.7), (-h, h, 2.7), (0, 0, 3.5)]))
    return Manifold.batch_boolean(parts, OpType.Add)


def sun_center(R):
    r = 0.42 * R
    return Manifold.sphere(r, 96).scale((1, 1, 0.75)).translate((0, 0, 0.9))


def design_params(p):
    """デザイナーの buildPrims() + bailPrim() と同じ形。部品ごとの dict と合成済み _solid を返す"""
    p = {**DEFAULTS, **p}
    R = p["R"]
    ring_r = max(p["ringR"], R + 2.2)
    parts = {"plate": plate(R)}
    parts["center"] = (eye_center(R, p["eye"] == "left") if p["center"] == "eye"
                       else fractal_center(R) if p["center"] == "fractal" else sun_center(R))

    start = ring_r + p["ringW"] + 0.5 if p["ringOn"] else R + 0.4
    base = {"teethOn": p["teethOn"], "pitch": p["pitch"], "spread": p["spread"], "start": start, "y0": R - 0.7}
    v_opt = {**base, "rootW": p["armW"], "longT": p["longT"], "shortT": p["shortT"]}
    sr = 0.6 + 0.4 * p["sideRatio"]
    h_opt = {**base, "rootW": p["armW"] * p["sideRatio"], "front": 1.9 * sr,
             "longT": p["longT"] * sr, "shortT": p["shortT"] * sr}
    parts["vert"] = ray("up", p["armUp"], v_opt) + ray("down", p["armDown"], {**v_opt, "tipW": 0.5})
    parts["horiz"] = ray("left", p["armSide"], h_opt) + ray("right", p["armSide"], h_opt)

    if p["ringOn"]:
        parts["ring"] = ring(ring_r, p["ringW"])
        if p["beamsOn"]:
            parts["beams"] = spokes(4 * (p["beamsQ"] + 1), R - 0.6, ring_r - 0.8 * p["ringW"] / 1.2, 0.5, 0.95, 0.5)
    if p["coronaOn"]:
        n = 4 * (p["coronaQ"] + 1)
        q = n // 4
        rin = ring_r + 0.7 * p["ringW"] / 1.2 if p["ringOn"] else R - 0.4

        def length(k):
            near = (k % q == 1) or (k % q == q - 1)
            return rin + (p["coronaShort"] if k % 2 else p["coronaLong"]) - (1.0 if near and q > 2 else 0)
        parts["corona"] = spokes(n, rin, 0, 1.05, 0.8, 0.6, length)

    s = p["scale"] / 100
    parts = {k: m.scale((s, s, s)) for k, m in parts.items()}
    # チェーン穴は大きさを変えても同じ寸法
    by, bz = 0.44 * R * s, -0.9 * s - 1.45
    parts["bail"] = (Manifold.cylinder(3.2, 1.9, 1.9, 48, center=True)
                     - Manifold.cylinder(6.0, 1.25, 1.25, 48, center=True)
                     ).rotate((0, 90, 0)).translate((0, by, bz))
    parts["_solid"] = Manifold.batch_boolean(list(parts.values()), OpType.Add)
    return parts


def to_trimesh(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(np.asarray(mesh.vert_properties)[:, :3], np.asarray(mesh.tri_verts), process=False)


def build(name, params):
    os.makedirs(OUT, exist_ok=True)
    safe = re.sub(r'[\\/:*?"<>|\s]+', "_", name).strip("_")[:40] or "sun_cross"
    parts = design_params(params)
    solid = parts.pop("_solid")
    tm = to_trimesh(solid)
    stl = os.path.join(OUT, f"{safe}.stl")
    tm.export(stl)
    scene = trimesh.Scene()
    for k, m in parts.items():
        scene.add_geometry(to_trimesh(m), node_name=k, geom_name=k)
    scene.export(os.path.join(OUT, f"{safe}.glb"))
    ext = tm.bounds[1] - tm.bounds[0]
    rep = {
        "name": name, "stl": os.path.relpath(stl, HERE),
        "size_mm": [round(float(x), 1) for x in ext],
        "weight_sv925_g": round(tm.volume / 1000 * SV925_DENSITY, 2),
        "watertight": bool(tm.is_watertight), "genus": int(solid.genus()),
        "params": params,
    }
    with open(os.path.join(OUT, f"{safe}.json"), "w") as f:
        json.dump(rep, f, indent=2, ensure_ascii=False)
    return rep


if __name__ == "__main__":
    src = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {"name": "default", "params": DEFAULTS}
    params = src.get("params", src)
    print(json.dumps(build(src.get("name", "design"), params), indent=2, ensure_ascii=False))
