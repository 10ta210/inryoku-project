// inryoku-gravity.js
// 視線の引力 — inRYOKU (50% line) の動詞は「引力」。
//
// 長押し (観測の同意) をすると、視線の先の粒子が螺旋を描いて集まり、
// 中心を黒く残したまま公転する。指を離すと、爆発させずにほどけて漂い戻る。
// 膨張・爆発は 101% line (inryokü) 側の動詞なので、ここでは使わない。
//
// THREE に依存しない純粋な数学だけを置く。
// サイト (inryoku-world.js) と動画書き出し (HyperFrames) が同じ式を共有する。
//
// 座標系: カメラは原点。視線方向 A (単位ベクトル) の先、距離 D に引力の中心 F = A·D。
// A を軸とする回転は原点を通るので、粒子の原点からの距離 (殻の厚み) を変えない。

export const GRAVITY_DEFAULTS = Object.freeze({
  distance: 30,           // 引力の中心までの距離 (粒子の殻は 25..100)
  coneInner: 18,          // deg: この内側の粒子は全量引かれる
  coneOuter: 40,          // deg: この外側の粒子は引かれない
  ringInner: 3.5,         // 公転半径の内側 — 中心は黒く空く (black side)
  ringOuter: 9.0,         // 公転半径の外側
  thickness: 1.2,         // 円盤の厚み (±)
  spinMin: 0.6 * Math.PI, // 落ちる間に巻き込む角度 (rad)
  spinMax: 1.4 * Math.PI,
  orbitRef: 0.22,         // 半径 6 での公転角速度 (rad/s)。内側ほど速い (ケプラー的)
  omegaIn: 1.6,           // 集まる速さ (臨界減衰ばね)。90% 到達 ≈ 2.4s
  omegaOut: 0.9,          // ほどける速さ。90% 到達 ≈ 4.3s
  settle: 0.002,          // これ未満でほどけ切ったとみなす
});

const DEG = Math.PI / 180;

// 臨界減衰ばね x'' = -2ω x' - ω² (x - target) の厳密解。
// 静止から動き出すので始まりはゆっくり、終わりは止まるように着地する (線形補間は使わない)。
export function springAt(x0, v0, target, omega, tau) {
  const d0 = x0 - target;
  const b = v0 + omega * d0;
  const e = Math.exp(-omega * tau);
  return { x: target + (d0 + b * tau) * e, v: (v0 - omega * b * tau) * e };
}

// 引力の強さ E(t) ∈ [0,1]。
// 押す/離すたびに、その瞬間の値と速度から次のばねへ繋ぐ。途中で離しても押し直しても連続。
// keepHistory: false = サイト (最新の区間だけ保持), true = 動画 (全区間を保持し任意の t を評価)
export class GravityEnvelope {
  constructor(params = GRAVITY_DEFAULTS, { keepHistory = false } = {}) {
    this.omegaIn = params.omegaIn;
    this.omegaOut = params.omegaOut;
    this.keepHistory = keepHistory;
    this.anchors = []; // { t, x, v, target, omega } — t 昇順
  }

  get target() {
    const a = this.anchors[this.anchors.length - 1];
    return a ? a.target : 0;
  }

  at(t) {
    const a = this._anchorAt(t);
    if (!a) return { x: 0, v: 0 };
    // rAF のフレーム時刻はイベント時刻より僅かに前のことがある → 0 で止める
    return springAt(a.x, a.v, a.target, a.omega, Math.max(0, t - a.t));
  }

  set(target, t) {
    const s = this.at(t);
    const omega = target > 0 ? this.omegaIn : this.omegaOut;
    const anchor = { t, x: s.x, v: s.v, target, omega };
    if (this.keepHistory) this.anchors.push(anchor);
    else this.anchors = [anchor];
  }

  _anchorAt(t) {
    for (let i = this.anchors.length - 1; i >= 0; i--) {
      if (this.anchors[i].t <= t) return this.anchors[i];
    }
    return this.keepHistory ? null : this.anchors[0] || null;
  }
}

// 動画用: I(t) = ∫E dt (公転の量) と M(t) = E の増加分の総和 (巻き込みの量)。
// どちらも t だけで決まるので、フレームを順不同に描いても同じ絵になる。
export function envelopeIntegrals(envelope, t, t0 = 0, h = 1 / 240) {
  let I = 0;
  let M = 0;
  let prev = envelope.at(t0).x;
  let tPrev = t0;
  const n = Math.max(0, Math.ceil((t - t0) / h));
  for (let k = 1; k <= n; k++) {
    const tk = Math.min(t, t0 + k * h);
    const x = envelope.at(tk).x;
    I += 0.5 * (prev + x) * (tk - tPrev);
    if (x > prev) M += x - prev;
    prev = x;
    tPrev = tk;
  }
  return { I, M };
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// 粒子ごとの固定値に使うハッシュ。Math.random を使わないのでサイトと動画で同じになる。
function hash01(i, salt) {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// 視線方向 A に直交する基底 U, V
export function basisFor(ax, ay, az) {
  let hx = 0;
  let hy = 1;
  const hz = 0;
  if (Math.abs(ay) > 0.9) { hx = 1; hy = 0; }
  let ux = hy * az - hz * ay;
  let uy = hz * ax - hx * az;
  let uz = hx * ay - hy * ax;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;
  return {
    ux, uy, uz,
    vx: ay * uz - az * uy,
    vy: az * ux - ax * uz,
    vz: ax * uy - ay * ux,
  };
}

// 視線方向 (ax, ay, az) に引力の場を作る。F は視線の先 distance の点。
export function createField(ax, ay, az, params = GRAVITY_DEFAULTS) {
  const l = Math.hypot(ax, ay, az) || 1;
  const nx = ax / l;
  const ny = ay / l;
  const nz = az / l;
  const D = params.distance;
  return { ax: nx, ay: ny, az: nz, fx: nx * D, fy: ny * D, fz: nz * D, ...basisFor(nx, ny, nz) };
}

// 視線の円錐に入る粒子を選び、引かれ方 (重み・公転半径・奥行き・巻き角・公転速度) を決める。
export function selectAttracted(home, count, field, params = GRAVITY_DEFAULTS) {
  const cosIn = Math.cos(params.coneInner * DEG);
  const cosOut = Math.cos(params.coneOuter * DEG);
  const idx = [];
  const w = [];
  for (let i = 0; i < count; i++) {
    const x = home[i * 3];
    const y = home[i * 3 + 1];
    const z = home[i * 3 + 2];
    const len = Math.hypot(x, y, z);
    if (len < 1e-6) continue;
    const c = (x * field.ax + y * field.ay + z * field.az) / len;
    if (c <= cosOut) continue;
    idx.push(i);
    w.push(smoothstep(cosOut, cosIn, c));
  }
  const n = idx.length;
  const sel = {
    n,
    idx: Int32Array.from(idx),
    w: Float32Array.from(w),
    r0: new Float32Array(n),
    a0: new Float32Array(n),
    spin: new Float32Array(n),
    orbit: new Float32Array(n),
  };
  const ri2 = params.ringInner * params.ringInner;
  const ro2 = params.ringOuter * params.ringOuter;
  for (let j = 0; j < n; j++) {
    const i = sel.idx[j];
    // 面積あたり一様に配る (内側に詰まって白く飽和しないように)
    const r0 = Math.sqrt(ri2 + (ro2 - ri2) * hash01(i, 1));
    sel.r0[j] = r0;
    sel.a0[j] = (hash01(i, 2) * 2 - 1) * params.thickness;
    sel.spin[j] = params.spinMin + (params.spinMax - params.spinMin) * hash01(i, 3);
    sel.orbit[j] = params.orbitRef * Math.pow(6 / r0, 1.5);
  }
  return sel;
}

// 原点を通る軸 A まわりに (x, y, z) を θ 回す (Rodrigues)。原点からの距離は変わらない。
export function rotateAboutAxis(x, y, z, ax, ay, az, theta, out) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const k = (x * ax + y * ay + z * az) * (1 - c);
  out[0] = x * c + (ay * z - az * y) * s + ax * k;
  out[1] = y * c + (az * x - ax * z) * s + ay * k;
  out[2] = z * c + (ax * y - ay * x) * s + az * k;
  return out;
}

// 点 P を、F のまわりの円盤 (軸からの半径 r0・奥行き a0) へ k (0..1) だけ寄せて out[o..o+2] に書く。
// 寄せるのは半径と奥行きだけ。角度 (公転・巻き込み) は rotateAboutAxis が担う。
export function pullInto(out, o, px, py, pz, field, k, r0, a0) {
  const rx = px - field.fx;
  const ry = py - field.fy;
  const rz = pz - field.fz;
  const a = rx * field.ax + ry * field.ay + rz * field.az;
  const xu = rx * field.ux + ry * field.uy + rz * field.uz;
  const xv = rx * field.vx + ry * field.vy + rz * field.vz;
  const r = Math.hypot(xu, xv);
  const cu = r > 1e-6 ? xu / r : 1;
  const cv = r > 1e-6 ? xv / r : 0;
  const a2 = a + (a0 - a) * k;
  const r2 = r + (r0 - r) * k;
  out[o] = field.fx + field.ax * a2 + (field.ux * cu + field.vx * cv) * r2;
  out[o + 1] = field.fy + field.ay * a2 + (field.uy * cu + field.vy * cv) * r2;
  out[o + 2] = field.fz + field.az * a2 + (field.uz * cu + field.vz * cv) * r2;
}

// 粒子 j の回転角: 公転 (∫E) + 巻き込み (E の増加分)。重み w が小さい粒子ほど少しだけ回る。
function thetaOf(g, j) {
  return g.sel.w[j] * (g.sel.orbit[j] * (g.I - g.I0) + g.sel.spin[j] * (g.M - g.M0));
}

// 1 フレーム分: 選ばれた粒子を回し (公転)、漂わせ (drift)、円盤へ寄せる。
// g = { sel, field, E, I, M, I0, M0 }, drift(hx, hy, hz, t, out) は world 側の漂いの式。
export function applyGravity(g, home, positions, pulls, t, drift) {
  const tmp = g._tmp || (g._tmp = new Float64Array(3));
  const dp = g._dp || (g._dp = new Float64Array(3));
  const { sel, field } = g;
  for (let j = 0; j < sel.n; j++) {
    const i = sel.idx[j];
    rotateAboutAxis(home[i * 3], home[i * 3 + 1], home[i * 3 + 2],
      field.ax, field.ay, field.az, thetaOf(g, j), tmp);
    drift(tmp[0], tmp[1], tmp[2], t, dp);
    const k = sel.w[j] * g.E;
    pullInto(positions, i * 3, dp[0], dp[1], dp[2], field, k, sel.r0[j], sel.a0[j]);
    pulls[i] = k;
  }
}

// ほどけ切ったら、公転で回った分を home に焼き込む。
// 見つめた場所は少しねじれたまま残る (観測は加担である)。位置は連続のまま。
export function bakeRotation(g, home, pulls) {
  const tmp = new Float64Array(3);
  const { sel, field } = g;
  for (let j = 0; j < sel.n; j++) {
    const i = sel.idx[j];
    rotateAboutAxis(home[i * 3], home[i * 3 + 1], home[i * 3 + 2],
      field.ax, field.ay, field.az, thetaOf(g, j), tmp);
    home[i * 3] = tmp[0];
    home[i * 3 + 1] = tmp[1];
    home[i * 3 + 2] = tmp[2];
    if (pulls) pulls[i] = 0;
  }
}
