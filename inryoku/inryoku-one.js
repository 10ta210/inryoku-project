// inryoku-one.js
// 全ては 1 — inRYOKU のループアニメーション (ラフ, 2026-11-11)
//
// あらすじ (司さん):
//   i の点から始まって、その下に線。その線から少し形の違う線が生まれ、もっと増殖して 1 ができる。
//   その 1 も色々な形の 1 になって増幅していき、遠くから見るとまた i の点 (⚪︎) になっている。
//   そしてまた 1 になる。
//
// 仕組み (自己相似ループ):
//   レベル L の構造全体 (中心 C・半径 R) = レベル L+1 の i の点 (中心 D・半径 r)。倍率 S = R / r。
//   カメラは相似変換 p ↦ C + S (p − D) の不動点を中心に、1 周で S 倍ズームアウトする。
//   1 周の最後の絵は最初の絵と一致するので、継ぎ目なく永遠に回る。
//   すべて t の純粋関数 (フレームを順不同に描いても同じ絵)。
//
// 素材は粒子 (inRYOKU の世界と同じ)。色は RGBCMY のみ (白黒禁則)、黒地に加算合成。
// THREE は呼び出し側から渡す (数学の部分を Node のテストからも読めるように)。

export const ONE_DEFAULTS = Object.freeze({
  period: 15,                         // 1 周の秒数
  dot: Object.freeze([0, 1.05]),      // i の点の中心 D (レベル座標)
  dotRadius: 0.13,                    // i の点の半径 r
  center: Object.freeze([0, 0]),      // 構造全体の中心 C
  radius: 3.0,                        // 構造全体の半径 R (= 次のレベルの i の点)
  stemTop: 0.84,                      // i の線の上端
  stemBottom: -1.0,                   // i の線の下端
  width: 0.035,                       // 線の太さ
  generations: 9,                     // 線が線を生む世代数
  seed: 27,                           // 円がまんべんなく丸く埋まる種 (60 通りから選んだ)
  viewHeight: 3.2,                    // 開始時に画面の高さに映る範囲
  viewCenter: Object.freeze([0, 0.05]),
  zoomEase: 0.85,                     // ズーム速度の緩急 (0 = 一定)。両端 (i の点が見える時) がゆっくり
  // 色: 'white' = 白 (司さん指示 2026-11-23、白黒禁則の例外) / 'wheel' = RGBCMY の色相環
  color: 'white',
  // 1 が星に見える: 1 が画面上で starNear px より小さくなると星が灯り始め、starFar px でほぼ星だけになる
  starNear: 48,
  starFar: 14,
});

const WHITE = [1, 1, 1];

// RGBCMY を色相環の順に並べる (R → Y → G → C → B → M)。遠くから見ると点が色相環になる。
// 純色 (CLAUDE.md のカラーパレット)。同じ色・隣り合う色はいくら重ねても白にならない
// (例: C + B = C)。白になり得るのは全色が集まる中心だけ。
// 旧: inryoku-world.js の PALETTE (副成分 0.23 入り) — 重なると副成分が積もって白く飽和した
const WHEEL = [
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 1, 1],
  [0, 0, 1],
  [1, 0, 1],
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function zoomRatio(P = ONE_DEFAULTS) {
  return P.radius / P.dotRadius;
}

// 1 周の中の位置 ph (0..1) → ズームの進み (0..1)。両端で速さが一致するので継ぎ目が出ない。
export function zoomProgress(ph, ease) {
  return ph - (ease / (2 * Math.PI)) * Math.sin(2 * Math.PI * ph);
}

// 時刻 t のカメラ: レベル 0 の座標で、画面中心 (cx, cy) と画面の高さに映る範囲 height
export function viewAt(t, P = ONE_DEFAULTS) {
  const S = zoomRatio(P);
  const T = P.period;
  const ph = (((t % T) + T) % T) / T;
  const z = Math.pow(S, zoomProgress(ph, P.zoomEase));
  // 相似変換の不動点 P* = (S·D − C) / (S − 1)。ここを中心に引いていく。
  const px = (S * P.dot[0] - P.center[0]) / (S - 1);
  const py = (S * P.dot[1] - P.center[1]) / (S - 1);
  return {
    cx: px + (P.viewCenter[0] - px) * z,
    cy: py + (P.viewCenter[1] - py) * z,
    height: P.viewHeight * z,
    phase: ph,
  };
}

// レベル k (0 = いま育っている i, 1 = その点, 2 = さらにその点) をレベル 0 の座標へ: world = offset + p·scale
export function levelTransform(k, P = ONE_DEFAULTS) {
  const S = zoomRatio(P);
  let ox = 0;
  let oy = 0;
  let scale = 1;
  for (let i = 0; i < k; i++) {
    // p ↦ D + (p − C)/S を合成していく
    ox += scale * (P.dot[0] - P.center[0] / S);
    oy += scale * (P.dot[1] - P.center[1] / S);
    scale /= S;
  }
  return { ox, oy, scale };
}

// 方向 ang に長さ len、全体で bend だけ曲がる線を step 間隔の点列にする
function samplePath(x, y, ang, len, bend, step) {
  const n = Math.max(2, Math.ceil(len / step));
  const pts = [[x, y]];
  let px = x;
  let py = y;
  for (let k = 0; k < n; k++) {
    const phi = ang + bend * ((k + 0.5) / n - 0.5);
    px += (Math.cos(phi) * len) / n;
    py += (Math.sin(phi) * len) / n;
    pts.push([px, py]);
  }
  return pts;
}

function pointOnPath(pts, s) {
  const f = s * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const u = f - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
}

// 他の 1 と重なっていないか。1 本の 1 を「長さを直径とする円」とみなし、円どうしが重なれば近すぎる。
// 1 が一つずつ離れて並ぶので、遠くから見ると星空になる (重なると白い塊になってしまう)。
const SEPARATION = 1.0;
const SPREAD = 0.25; // 細い 1 なので、長さの 0.25 倍を半径とする円で重なりを見る
function crowded(placed, x, y, r) {
  for (const q of placed) {
    const d = (r + q.r) * SEPARATION;
    const ex = x - q.x;
    const ey = y - q.y;
    if (ex * ex + ey * ey < d * d) return true;
  }
  return false;
}

// 親の線から「少しだけ形の違う」子を 1 本生む。円 (半径 R) からはみ出す・他の 1 と重なる場合は引き直す。
function spawn(parent, g, rand, P, step, placed) {
  const [cx, cy] = P.center;
  const limit = P.radius * 0.97;
  for (let tries = 0; tries < 8; tries++) {
    const [ax, ay] = pointOnPath(parent.main, 0.15 + 0.7 * rand());
    // 親のそばに生まれる。中心の近くでは外へ、縁の近くでは内へ寄せて、円の中を満たしていく
    const ox = ax - cx;
    const oy = ay - cy;
    const ol = Math.hypot(ox, oy) || 1;
    const bias = 0.9 * (0.65 - ol / P.radius);
    const th = rand() * Math.PI * 2;
    let dx = Math.cos(th) + (ox / ol) * bias;
    let dy = Math.sin(th) + (oy / ol) * bias;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    // 旧: dist = len × (0.35〜0.70)、len = 親 × (0.72〜0.90) — 重なり放題で白い塊になった
    const dist = parent.len * (0.55 + 0.45 * rand());
    const ang = parent.ang + (rand() - 0.5) * 0.7;
    const len = parent.len * (0.6 + 0.16 * rand());
    // 選んだ点に子の線の「中央」を置く (上端を置くと世代ごとに全体が下へずれていく)
    const mx = ax + dx * dist;
    const my = ay + dy * dist;
    if (crowded(placed, mx, my, len * SPREAD)) continue;
    const x = mx - (Math.cos(ang) * len) / 2;
    const y = my - (Math.sin(ang) * len) / 2;
    const bend = parent.bend * 0.5 + (rand() - 0.5) * 0.6;
    const main = samplePath(x, y, ang, len, bend, step);
    const end = main[main.length - 1];
    if (Math.hypot(x - cx, y - cy) > limit || Math.hypot(end[0] - cx, end[1] - cy) > limit) continue;
    placed.push({ x: mx, y: my, r: len * SPREAD });
    const birth = parent.birth + parent.dur * 0.7 + 0.2 + 0.4 * rand();
    if (birth > P.period - 2) return null; // 1 周の終わりまでに描き終える (ループの継ぎ目のため)
    // 2 世代目から「1」の旗 (左上の払い)、3 世代目から台座が付き始める
    const hasFlag = g >= 2 && rand() < Math.min(0.92, 0.25 + 0.2 * g);
    const hasBase = g >= 3 && rand() < 0.3;
    return {
      x, y, ang, len, bend, gen: g, main,
      birth,
      dur: 0.35 + 0.35 * rand(),
      flagLen: hasFlag ? len * (0.22 + 0.18 * rand()) : 0,
      flagAng: 0.785 + (rand() - 0.5) * 0.7,
      baseLen: hasBase ? len * (0.25 + 0.2 * rand()) : 0,
    };
  }
  return null;
}

// 書き順の点列: 旗 (払いの先 → 頂点) → 縦線 (上 → 下) → 台座 (左 → 右)
function glyphPath(gl, step) {
  const segs = [];
  if (gl.flagLen > 0) {
    const fa = gl.ang - gl.bend * 0.5 - gl.flagAng;
    const fx = gl.x + Math.cos(fa) * gl.flagLen;
    const fy = gl.y + Math.sin(fa) * gl.flagLen;
    segs.push(samplePath(fx, fy, Math.atan2(gl.y - fy, gl.x - fx), gl.flagLen, 0, step));
  }
  segs.push(gl.main);
  if (gl.baseLen > 0) {
    const [bx, by] = gl.main[gl.main.length - 1];
    const pa = gl.ang + gl.bend * 0.5 + Math.PI / 2;
    const sx = bx - (Math.cos(pa) * gl.baseLen) / 2;
    const sy = by - (Math.sin(pa) * gl.baseLen) / 2;
    segs.push(samplePath(sx, sy, pa, gl.baseLen, 0, step));
  }
  return segs;
}

// 1 レベル分の粒子 (i の線 → 少し違う線 → 1 → 色々な 1)。レベル座標で、毎回同じ結果。
export function buildLevel(P = ONE_DEFAULTS) {
  const rand = mulberry32(P.seed);
  const rand2 = mulberry32(P.seed + 1);
  const step = P.width * 0.55;
  const root = {
    x: 0, y: P.stemTop, ang: -Math.PI / 2, len: P.stemTop - P.stemBottom, bend: 0, gen: 0,
    birth: 0.35, dur: 1.4, flagLen: 0, flagAng: 0, baseLen: 0,
  };
  root.main = samplePath(root.x, root.y, root.ang, root.len, root.bend, step);
  const glyphs = [root];
  const placed = [{ x: 0, y: (P.stemTop + P.stemBottom) / 2, r: root.len * SPREAD }];
  let frontier = [root];
  for (let g = 1; g <= P.generations; g++) {
    const next = [];
    for (const parent of frontier) {
      const n = 3; // 旧: 2〜3 本。重ならない置き方にしたので毎回 3 本生む
      for (let c = 0; c < n; c++) {
        const child = spawn(parent, g, rand, P, step, placed);
        if (child) { glyphs.push(child); next.push(child); }
      }
    }
    frontier = next;
  }

  const rand3 = mulberry32(P.seed + 2);
  const pos = [];
  const col = [];
  const birth = [];
  const size = [];
  const phase = [];  // 瞬きの位相 (1 本の 1 ごとに共通)
  const twf = [];    // 瞬きの回数 / 1 周 (整数なので継ぎ目でずれない)
  const star = [];   // 1 = その 1 の中心に灯る星
  const glen = [];   // その 1 の長さ (画面で何 px かを測って、星に変わる距離を決める)
  const [cx, cy] = P.center;
  for (const gl of glyphs) {
    const mid = gl.main[gl.main.length >> 1];
    const a = Math.atan2(mid[1] - cy, mid[0] - cx) / (2 * Math.PI);
    const pal = P.color === 'wheel' ? WHEEL[Math.floor((a + 1 + 1 / 12) * 6) % 6] : WHITE;
    const f = 3 + Math.floor(rand3() * 6);
    const ph = rand3() * Math.PI * 2;
    // 書き順に沿って、筆が進んだ瞬間に粒子が灯る (筆の速さは sine の ease-in-out)
    const pts = [];
    let total = 0;
    for (const seg of glyphPath(gl, step)) {
      for (let k = 0; k < seg.length; k++) {
        if (k > 0) total += Math.hypot(seg[k][0] - seg[k - 1][0], seg[k][1] - seg[k - 1][1]);
        pts.push([seg[k][0], seg[k][1], total]);
      }
    }
    for (const [x, y, d] of pts) {
      const u = total > 0 ? d / total : 0;
      const tau = Math.acos(1 - 2 * u) / Math.PI;
      const k = 0.6 + rand2() * 0.4;
      pos.push(x, y, 0);
      col.push(pal[0] * k, pal[1] * k, pal[2] * k);
      birth.push(gl.birth + gl.dur * tau);
      size.push(P.width * (0.85 + 0.3 * rand2()));
      // 旧: phase.push(rand2() * Math.PI * 2); (粒子ごとの呼吸) → 1 本の 1 ごとに瞬く
      phase.push(ph);
      twf.push(f);
      star.push(0);
      glen.push(gl.len);
    }
    // その 1 の中心に星を 1 つ。描き終わった瞬間から灯る
    pos.push(mid[0], mid[1], 0);
    col.push(pal[0], pal[1], pal[2]);
    birth.push(gl.birth + gl.dur);
    size.push(P.width);
    phase.push(ph);
    twf.push(f);
    star.push(1);
    glen.push(gl.len);
  }
  return {
    count: birth.length,
    glyphs: glyphs.length,
    flags: glyphs.filter((gl) => gl.flagLen > 0).length,
    pos: Float32Array.from(pos),
    color: Float32Array.from(col),
    birth: Float32Array.from(birth),
    size: Float32Array.from(size),
    phase: Float32Array.from(phase),
    twf: Float32Array.from(twf),
    star: Float32Array.from(star),
    glen: Float32Array.from(glen),
  };
}

const VERT = `
  attribute float birth;
  attribute float wsize;
  attribute float phase;
  attribute float twf;
  attribute float star;
  attribute float glen;
  uniform float uTime;
  uniform float uScale;
  uniform vec2 uOffset;
  uniform vec2 uCenter;
  uniform float uHeight;
  uniform float uAspect;
  uniform float uViewportH;
  uniform float uLoop;      // 2π × (1 周の中の位置)
  uniform float uStarNear;
  uniform float uStarFar;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vStar;
  void main() {
    vec2 w = uOffset + position.xy * uScale;
    vec2 ndc = (w - uCenter) / (uHeight * 0.5);
    ndc.x /= uAspect;
    gl_Position = vec4(ndc, 0.0, 1.0);
    float px = uViewportH / uHeight;
    float g = clamp((uTime - birth) / 0.25, 0.0, 1.0);
    g = 1.0 - (1.0 - g) * (1.0 - g);
    // 瞬き: 1 周にちょうど twf 回 (整数) なので、ループの継ぎ目でずれない
    float tw = 0.5 + 0.5 * sin(uLoop * twf + phase);
    // その 1 が画面で何 px か。小さいほど「星」に見えていく
    float gpx = glen * uScale * px;
    float far = 1.0 - smoothstep(uStarFar, uStarNear, gpx);
    vStar = star;
    if (star > 0.5) {
      gl_PointSize = (5.0 + 9.0 * tw) * clamp(gpx / 20.0, 0.35, 1.0);
      // 点より小さくなった星は消す (どのレベルでも同じ規則なので、継ぎ目で光が増減しない)
      float tiny = clamp(gpx / 2.0, 0.0, 1.0);
      vAlpha = g * far * (0.35 + 0.65 * tw) * tiny * tiny;
    } else {
      // 本当の大きさ (px)。1.5px 未満は 1.5px で描き、面積の比で光を弱める
      float dTrue = wsize * uScale * px;
      float dDraw = max(dTrue, 1.5);
      gl_PointSize = dDraw;
      // 星に変わるにつれて線は薄れていく
      vAlpha = g * (0.85 + 0.15 * tw) * (1.0 - 0.75 * far) * (dTrue * dTrue) / (dDraw * dDraw);
    }
    vColor = color;
  }
`;

const FRAG = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vStar;
  void main() {
    if (vAlpha < 0.002) discard;
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c);
    float a;
    if (vStar > 0.5) {
      // 星: 明るい芯 + 柔らかい光 + 十字の光芒
      float core = exp(-r2 * 90.0);
      float glow = exp(-r2 * 22.0) * 0.35;
      float spike = exp(-abs(c.x) * 40.0) * exp(-c.y * c.y * 10.0)
                  + exp(-abs(c.y) * 40.0) * exp(-c.x * c.x * 10.0);
      a = (core + glow + spike * 0.45) * smoothstep(0.5, 0.35, max(abs(c.x), abs(c.y)));
    } else {
      if (r2 > 0.25) discard;
      float core = exp(-r2 * 30.0);
      float glow = exp(-r2 * 10.0) * 0.4;
      float halo = exp(-r2 * 4.0) * 0.12;
      float edge = smoothstep(0.25, 0.16, r2);
      // 旧: × 0.5 (色相環版で白飛びを防ぐため)。白版は白が狙いなので少し戻す
      a = (core + glow + halo) * edge * 0.6;
    }
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

// 描画: いま育っている i (レベル 0) と、その点 (レベル 1)、さらにその点 (レベル 2) を同じ粒子で描く
export function createOneView(opts) {
  const THREE = opts.THREE;
  const P = { ...ONE_DEFAULTS, ...(opts.params || {}) };
  const manual = !!opts.manual;
  const reduce = !!opts.reduceMotion;
  let W = opts.width || window.innerWidth;
  let H = opts.height || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: manual });
  renderer.setPixelRatio(opts.pixelRatio || Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  opts.container.appendChild(renderer.domElement);

  const level = buildLevel(P);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(level.pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(level.color, 3));
  geo.setAttribute('birth', new THREE.BufferAttribute(level.birth, 1));
  geo.setAttribute('wsize', new THREE.BufferAttribute(level.size, 1));
  geo.setAttribute('phase', new THREE.BufferAttribute(level.phase, 1));
  geo.setAttribute('twf', new THREE.BufferAttribute(level.twf, 1));
  geo.setAttribute('star', new THREE.BufferAttribute(level.star, 1));
  geo.setAttribute('glen', new THREE.BufferAttribute(level.glen, 1));

  const scene = new THREE.Scene();
  const camera = new THREE.Camera(); // 位置と拡大はシェーダーで計算する
  const mats = [];
  for (let k = 0; k < 3; k++) {
    const tr = levelTransform(k, P);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: tr.scale },
        uOffset: { value: new THREE.Vector2(tr.ox, tr.oy) },
        uCenter: { value: new THREE.Vector2() },
        uHeight: { value: P.viewHeight },
        uAspect: { value: W / H },
        uViewportH: { value: H * renderer.getPixelRatio() },
        uLoop: { value: 0 },
        uStarNear: { value: P.starNear },
        uStarFar: { value: P.starFar },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    mats.push(mat);
  }

  // 時刻 t の 1 枚。周期 period で同じ絵に戻る。
  function renderAt(t) {
    const v = viewAt(t, P);
    for (let k = 0; k < 3; k++) {
      const u = mats[k].uniforms;
      u.uTime.value = k === 0 ? v.phase * P.period : 1e6; // 点の中のレベルは描き終わった姿
      u.uCenter.value.set(v.cx, v.cy);
      u.uHeight.value = v.height;
      u.uLoop.value = 2 * Math.PI * v.phase; // 瞬きの回数は粒子側 (twf) に整数で持つ
    }
    renderer.render(scene, camera);
  }

  function resize(w, h) {
    W = w; H = h;
    renderer.setSize(W, H);
    for (const m of mats) {
      m.uniforms.uAspect.value = W / H;
      m.uniforms.uViewportH.value = H * renderer.getPixelRatio();
    }
  }

  let running = !manual;
  const t0 = performance.now();
  function frame(now) {
    if (!running) return;
    renderAt((now - t0) / 1000);
    requestAnimationFrame(frame);
  }
  if (reduce) { running = false; renderAt(P.period * 0.6); } // 動かさず、1 が並んだ 1 枚だけ
  else if (running) requestAnimationFrame(frame);

  function dispose() {
    running = false;
    geo.dispose();
    for (const m of mats) m.dispose();
    try { renderer.domElement.remove(); } catch (_) {}
    renderer.dispose();
  }

  return { renderAt, resize, dispose, period: P.period, level, renderer };
}
