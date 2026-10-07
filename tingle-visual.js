// tingle-visual.js — inryokü Tingle の映像 (Three.js + GLSL のみ、Canvas 2D 不使用)
//
// inryoku-tingle.js のエンジンが「鳴らす予定」として出すイベント (粒・叩く・撫でる・frisson) と
// 状態 (粒子雲の半径・回転角・芯の音量・フェード) を、音と同じ時刻で描く。
//   ・粒が鳴る瞬間に、その方向・距離で光の粒が灯る (イベントは先読みで GPU に積み、shader が時刻で出す)
//   ・粒子雲の塵は、音の emitter と同じ回転角・半径で回る
//   ・101%: 迫る → 間 (真っ黒、右耳の「コッ」だけが光る) → RGBCMY が色相環の位置で灯る
//
// 画面は「頭上から見た i」。中心の灰色の球 = i (110Hz の芯)、周り = o (宇宙)。
// 正面 (az 0) が画面の奥、右耳 (az 90) が画面の右。
//
// 使い方:
//   const vis = createTingleVisual({ canvas, eng });
//   requestAnimationFrame 毎に vis.render(聞こえている ctx 時刻)

import * as THREE from 'three';

const DEG = Math.PI / 180;
// RGBCMY の光 (P3 のパーティクルと同じ 6 色)
const COLORS = {
    R: [1.0, 0.2, 0.22],
    Y: [1.0, 0.86, 0.22],
    G: [0.28, 0.92, 0.38],
    C: [0.22, 0.88, 0.96],
    B: [0.32, 0.42, 1.0],
    M: [0.96, 0.28, 0.9],
};
const KEYS = 'RGBCMY';
const GREY = [0.62, 0.62, 0.62];

// 音の距離 (m) → 画面の半径 (対数: 10cm = 0.45 (耳の横), 30cm = 1.05, 1.6m = 1.97, 3m 以上 = 2.4 で頭打ち)
const radiusOf = (d) => Math.min(2.4, Math.max(0.2, 0.45 + 0.55 * Math.log(Math.max(d, 0.05) / 0.1)));
function toWorld(az, el, dist, out = new THREE.Vector3()) {
    const r = radiusOf(dist);
    const a = az * DEG;
    const e = el * DEG;
    return out.set(r * Math.sin(a) * Math.cos(e), r * 0.8 * Math.sin(e), -r * Math.cos(a) * Math.cos(e));
}

const GLSL_RADIUS = /* glsl */ `
float radiusOf(float d) { return min(2.4, max(0.2, 0.45 + 0.55 * log(max(d, 0.05) / 0.1))); }
`;

// ── 光の粒 (イベント): kind 0 = 粒, 1 = 輪 (叩く / 開花), 2 = 叩いた点 ──
const SPARK_VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;
uniform float uDim;
uniform float uFade;
attribute vec3 aColor;
attribute float aBirth;
attribute float aLife;
attribute float aSize;
attribute float aKind;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
void main() {
    float age = uTime - aBirth;
    float u = age / aLife;
    float on = step(0.0, age) * step(u, 1.0);
    bool ring = aKind > 0.5 && aKind < 1.5;
    float a = on * (ring ? (1.0 - u) : (1.0 - u) * (1.0 - u));
    if (aKind < 0.5) a *= uDim; // 間では粒は消える (叩いた光だけ残る)
    a *= uFade;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float s = aSize * (ring ? (0.3 + 2.7 * sqrt(max(u, 0.0))) : (1.0 + 0.5 * (1.0 - u)));
    gl_PointSize = a > 0.002 ? s * uPx / -mv.z : 0.0;
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = a;
    vKind = aKind;
}`;
const SPARK_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = length(p);
    if (d > 1.0) discard;
    if (vKind > 0.5 && vKind < 1.5) {
        float m = smoothstep(0.08, 0.0, abs(d - 0.86));
        gl_FragColor = vec4(vColor, vAlpha * m * 0.8);
        return;
    }
    float halo = exp(-d * d * 5.0);
    float core = exp(-d * d * 42.0);
    vec3 col = mix(vColor, vec3(1.0), core * 0.55);
    gl_FragColor = vec4(col, vAlpha * clamp(halo * 0.65 + core * 0.7, 0.0, 1.0));
}`;

// ── 粒子雲の塵: 音の emitter と同じ式・同じ回転角で回る ──
const DUST_VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;
uniform float uRadius;
uniform float uAngle;
uniform float uAlpha;
uniform float uColorMix;
uniform float uFade;
attribute vec4 aOrbit; // phase(deg), speed, elBase(deg), rMul
attribute vec4 aAux;   // dir, elAmp(deg), elRate, colorWeight
attribute vec3 aColor;
attribute float aSize;
varying vec4 vC;
const float DEG = 0.017453292;
${GLSL_RADIUS}
void main() {
    float az = (aOrbit.x + uAngle * aOrbit.y * aAux.x) * DEG;
    float el = (aOrbit.z + aAux.y * sin(uTime * aAux.z * 6.2831853 + aOrbit.x * DEG)) * DEG;
    float r = radiusOf(uRadius * aOrbit.w);
    vec3 pos = vec3(r * sin(az) * cos(el), r * 0.8 * sin(el), -r * cos(az) * cos(el));
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float tw = 0.6 + 0.4 * sin(uTime * (0.8 + aAux.z * 9.0) + aOrbit.x);
    float a = uAlpha * tw * uFade;
    gl_PointSize = a > 0.002 ? aSize * uPx / -mv.z : 0.0;
    gl_Position = projectionMatrix * mv;
    vC = vec4(mix(vec3(0.58), aColor, clamp(uColorMix * aAux.w, 0.0, 1.0)), a);
}`;
const DUST_FRAG = /* glsl */ `
varying vec4 vC;
void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    gl_FragColor = vec4(vC.rgb, vC.a * exp(-d * 4.0));
}`;

// ── 開花の 6 色 / 撫でる軌跡: CPU で毎フレーム位置と濃さを入れる ──
const GLOW_VERT = /* glsl */ `
uniform float uPx;
attribute vec3 aColor;
attribute float aAlpha;
attribute float aSize;
varying vec3 vColor;
varying float vAlpha;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aAlpha > 0.002 ? aSize * uPx / -mv.z : 0.0;
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = aAlpha;
}`;
const GLOW_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    float m = exp(-d * 3.2) * 0.8 + exp(-d * 30.0) * 0.5;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), exp(-d * 30.0) * 0.4), vAlpha * clamp(m, 0.0, 1.0));
}`;

// ── 中心の球 = i。灰色 (50%) の芯。倍音が灯るほど縁に虹が出る ──
const CORE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
}`;
const CORE_FRAG = /* glsl */ `
uniform float uLevel;
uniform float uRainbow;
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
void main() {
    float fr = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
    float lit = 0.55 + 0.45 * max(dot(vN, normalize(vec3(0.3, 0.8, 0.5))), 0.0);
    vec3 grey = vec3(0.5) * lit;
    vec3 rim = hue(atan(vN.y, vN.x) / 6.2831853 + uTime * 0.04) * fr * uRainbow;
    gl_FragColor = vec4((grey + rim + fr * 0.12) * uLevel, 1.0);
}`;

function points(count, attrs, vertexShader, fragmentShader, uniforms) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    for (const [name, size] of Object.entries(attrs)) {
        geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(count * size), size));
    }
    const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending, // 「重ねる」(additive) ではなく「混ぜる」
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
}

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {ReturnType<import('./inryoku-tingle.js').createTingle>} o.eng  events:true で作ったエンジン
 * @param {number} [o.pixelRatio]
 * @param {boolean} [o.preserve]  書き出し用 (preserveDrawingBuffer)
 */
export function createTingleVisual({ canvas, eng, pixelRatio = Math.min(2, window.devicePixelRatio || 1), preserve = false }) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: preserve });
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    const uPx = { value: 1000 };
    const uTime = { value: 0 };
    const uFade = { value: 1 };

    // 塵
    const DUST = 2600;
    const dust = points(
        DUST,
        { aOrbit: 4, aAux: 4, aColor: 3, aSize: 1 },
        DUST_VERT,
        DUST_FRAG,
        {
            uTime,
            uPx,
            uFade,
            uRadius: { value: 0.8 },
            uAngle: { value: 0 },
            uAlpha: { value: 0.45 },
            uColorMix: { value: 0 },
        }
    );
    {
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const g = dust.geometry;
        for (let i = 0; i < DUST; i++) {
            g.attributes.aOrbit.setXYZW(i, rnd() * 360, 0.6 + rnd() * 0.8, -30 + rnd() * 70, 0.55 + rnd() * 1.1);
            g.attributes.aAux.setXYZW(i, i % 4 === 3 ? -1 : 1, 5 + rnd() * 18, 0.05 + rnd() * 0.15, rnd() < 0.45 ? 0.6 + rnd() * 0.4 : rnd() * 0.25);
            const c = COLORS[KEYS[i % 6]];
            g.attributes.aColor.setXYZ(i, c[0], c[1], c[2]);
            g.attributes.aSize.setX(i, 0.022 + rnd() * 0.034);
        }
    }
    scene.add(dust);

    // 光の粒 (リングバッファ)
    const SPARKS = 4096;
    const sparks = points(SPARKS, { aColor: 3, aBirth: 1, aLife: 1, aSize: 1, aKind: 1 }, SPARK_VERT, SPARK_FRAG, {
        uTime,
        uPx,
        uFade,
        uDim: { value: 1 },
    });
    {
        const b = sparks.geometry.attributes.aBirth;
        for (let i = 0; i < SPARKS; i++) b.setX(i, -1e9);
    }
    scene.add(sparks);
    let sparkHead = 0;
    let sparkDirty = false;
    const tmp = new THREE.Vector3();
    function spark(pos, color, birth, life, size, kind) {
        const g = sparks.geometry.attributes;
        const i = sparkHead;
        sparkHead = (sparkHead + 1) % SPARKS;
        g.position.setXYZ(i, pos.x, pos.y, pos.z);
        g.aColor.setXYZ(i, color[0], color[1], color[2]);
        g.aBirth.setX(i, birth);
        g.aLife.setX(i, life);
        g.aSize.setX(i, size);
        g.aKind.setX(i, kind);
        sparkDirty = true;
    }

    // 開花の 6 色 + 撫でる軌跡 (共用プール)
    const GLOWS = 6 + 4 * 28;
    const glows = points(GLOWS, { aColor: 3, aAlpha: 1, aSize: 1 }, GLOW_VERT, GLOW_FRAG, { uPx });
    scene.add(glows);

    // 中心の球
    const coreMat = new THREE.ShaderMaterial({
        uniforms: { uLevel: { value: 0 }, uRainbow: { value: 0 }, uTime },
        vertexShader: CORE_VERT,
        fragmentShader: CORE_FRAG,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.17, 48, 32), coreMat);
    scene.add(core);

    // イベント
    const pending = [];
    const frissons = [];
    const brushes = [];
    function intake(now) {
        const evs = eng.drain();
        if (evs.length) {
            for (const ev of evs) {
                if (ev.type === 'frisson') frissons.push(ev);
                else if (ev.type === 'brush') brushes.push(ev);
                else pending.push(ev);
            }
            pending.sort((a, b) => a.t - b.t);
            for (const f of evs) {
                if (f.type !== 'frisson') continue;
                // 開花の瞬間、中心から白い輪が広がる (RGB を混ぜると白)
                spark(tmp.set(0, 0, 0), [0.9, 0.9, 0.9], f.tBloom, 1.2, 2.6, 1);
            }
        }
        // 0.6 秒先までを GPU に積む (shader が誕生時刻まで隠す)
        while (pending.length && pending[0].t <= now + 0.6) {
            const ev = pending.shift();
            if (ev.type === 'grain') {
                toWorld(ev.az, ev.el, ev.dist, tmp);
                if (ev.color) spark(tmp, COLORS[ev.color], ev.t, 0.8, 0.13 + ev.amp * 0.06, 0);
                else spark(tmp, ev.pop ? [0.92, 0.92, 0.92] : GREY, ev.t, ev.pop ? 0.45 : 0.3, (ev.pop ? 0.1 : 0.06) * (0.7 + ev.amp), 0);
            } else if (ev.type === 'tap') {
                toWorld(ev.az, ev.el, ev.dist, tmp);
                const c = COLORS[ev.color] || GREY;
                spark(tmp, [0.5 + c[0] * 0.5, 0.5 + c[1] * 0.5, 0.5 + c[2] * 0.5], ev.t, 0.55, 0.13, 2);
                spark(tmp, c, ev.t, 0.8, 0.32, 1);
            }
        }
    }

    function frissonAt(t) {
        let f = null;
        for (const x of frissons) if (x.t <= t && t < x.tBloom + 14) f = x;
        return f;
    }

    // 開花の光の濃さ (音の包絡と同じ形: 立ち上がり 0.05s → 1.6s で 64% → 指数で消える)
    function bloomEnv(age) {
        if (age < 0) return 0;
        if (age < 0.05) return age / 0.05;
        if (age < 1.6) return 1 - 0.36 * ((age - 0.05) / 1.55);
        return 0.64 * Math.exp(-(age - 1.6) * 0.7);
    }

    function render(t) {
        uTime.value = t;
        intake(t);
        const st = eng.stateAt(t);
        uFade.value = st.fade;

        const f = frissonAt(t);
        const u = f ? Math.min(1, Math.max(0, (t - f.t) / f.build)) : 0;
        const silent = f && t >= f.tPeak && t < f.tBloom;
        const bloomAge = f ? t - f.tBloom : -1;

        // 塵: 溜めで明るく・色が覗き、開花で虹 → グレーの中に虹が残る
        const du = dust.material.uniforms;
        du.uRadius.value = st.radius;
        du.uAngle.value = st.angle;
        let colorMix = 0.1;
        let alpha = 0.45;
        if (f && bloomAge < 0) {
            colorMix = 0.1 + 0.35 * u * u;
            alpha = 0.45 + 0.4 * u;
        } else if (f) {
            colorMix = 0.4 + 0.7 * Math.exp(-bloomAge * 0.35);
            alpha = 0.5 + 0.35 * Math.exp(-bloomAge * 0.5);
        }
        du.uColorMix.value = colorMix;
        du.uAlpha.value = silent ? 0 : alpha;
        sparks.material.uniforms.uDim.value = silent ? 0 : 1;

        // 芯: 音の芯と同じ音量で光り、10 秒で呼吸。倍音が灯るほど縁に虹
        const level = Math.min(2, st.bed / 0.025) * (0.82 + 0.18 * Math.sin(t * 2 * Math.PI * 0.1));
        coreMat.uniforms.uLevel.value = silent ? 0 : level * st.fade;
        core.visible = coreMat.uniforms.uLevel.value > 0.002; // 黒い球が後ろの光を隠さないように
        coreMat.uniforms.uRainbow.value = f ? (bloomAge < 0 ? u : 0.35 + 0.65 * Math.exp(-bloomAge * 0.3)) : 0.08;
        core.scale.setScalar(1 + 0.05 * Math.sin(t * 2 * Math.PI * 0.1) + (f && bloomAge < 0 ? 0.25 * u * u : 0));

        // 開花の 6 色 + 撫でる軌跡
        const g = glows.geometry.attributes;
        for (let i = 0; i < GLOWS; i++) g.aAlpha.setX(i, 0);
        if (f && bloomAge >= 0) {
            f.wheel.forEach(([key, az], i) => {
                const age = bloomAge - i * 0.025;
                const k = Math.min(1, Math.max(0, age / 9));
                toWorld(az + 30 * k, 10, 2.4 + (1.3 - 2.4) * k, tmp);
                const c = COLORS[key];
                g.position.setXYZ(i, tmp.x, tmp.y, tmp.z);
                g.aColor.setXYZ(i, c[0], c[1], c[2]);
                g.aAlpha.setX(i, 0.85 * bloomEnv(age) * st.fade);
                g.aSize.setX(i, 1.05);
            });
        }
        let slot = 6;
        for (let bi = brushes.length - 1; bi >= 0; bi--) {
            const b = brushes[bi];
            if (t > b.t + b.dur + 0.6) {
                brushes.splice(bi, 1);
                continue;
            }
            if (t < b.t || slot + 28 > GLOWS) continue;
            const ease = (x) => x * x * (3 - 2 * x);
            const shape = (x) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, x))), 1.4);
            for (let k = 0; k < 28; k++) {
                const uu = (t - b.t) / b.dur - k * 0.012;
                if (uu < 0 || uu > 1) continue;
                const az = b.from + (b.to - b.from) * ease(uu);
                toWorld(az, b.el + b.arc * Math.sin(Math.PI * uu), b.dist * (1 + 0.3 * Math.sin(Math.PI * uu)), tmp);
                g.position.setXYZ(slot + k, tmp.x, tmp.y, tmp.z);
                g.aColor.setXYZ(slot + k, 0.78, 0.8, 0.85);
                g.aAlpha.setX(slot + k, 0.55 * shape(uu) * (1 - k / 28) * st.fade);
                g.aSize.setX(slot + k, 0.16 * (1 - k / 40));
            }
            slot += 28;
        }
        g.position.needsUpdate = true;
        g.aColor.needsUpdate = true;
        g.aAlpha.needsUpdate = true;
        g.aSize.needsUpdate = true;

        if (sparkDirty) {
            for (const name of ['position', 'aColor', 'aBirth', 'aLife', 'aSize', 'aKind']) {
                sparks.geometry.attributes[name].needsUpdate = true;
            }
            sparkDirty = false;
        }
        renderer.render(scene, camera);
    }

    function resize(w, h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // 縦長 (スマホ) では引いて左右が切れないようにする
        const dist = 7.0 / Math.min(1, Math.pow(camera.aspect, 0.8));
        const dir = new THREE.Vector3(0, 0.7, 0.72).normalize();
        camera.position.copy(dir.multiplyScalar(dist));
        camera.lookAt(0, -0.25, 0);
        camera.updateProjectionMatrix();
        uPx.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * DEG) / 2));
    }

    // 別のエンジン (再生し直し) に付け替える
    function attach(next) {
        eng = next;
        pending.length = 0;
        frissons.length = 0;
        brushes.length = 0;
        const b = sparks.geometry.attributes.aBirth;
        for (let i = 0; i < SPARKS; i++) b.setX(i, -1e9);
        b.needsUpdate = true;
    }

    return {
        render,
        resize,
        attach,
        dispose() {
            renderer.dispose();
        },
    };
}
