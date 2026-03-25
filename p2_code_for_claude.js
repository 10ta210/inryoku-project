'use strict';
// ═══════════════════════════════════════════════════════════════
//  P2 — THE CODE WORLD  v2  |  Step 1: 浮遊する0と1 (改良版)
//  Three.js 0.160.0 | GLSL only | No Canvas 2D | No textures
//
//  「デジタルの星空」「コードでできた宇宙」
//  - 6000パーティクル、z軸 -50〜+5 の深宇宙空間
//  - 近い: 形が読める、明るく大きい
//  - 遠い: ただの発光点（光の星）
//  - 各パーティクルが放つ緑のグロー
// ═══════════════════════════════════════════════════════════════

function renderPhase2() {

    const INRYOKU_50_URL = 'https://inryoku.com/';
    const W = window.innerWidth, H = window.innerHeight;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(0.5);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;';
    document.body.appendChild(renderer.domElement);

    let alive = true, globalTime = 0;

    // ── Camera & Scene ──
    // far=120に拡張 (z=-50の深度まで描画)
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 120);
    camera.position.set(0, 0, 8);
    const scene = new THREE.Scene();

    // ── Mouse ──
    const mouseNDC = new THREE.Vector2(0, 0);
    window.addEventListener('mousemove', e => {
        mouseNDC.x =  (e.clientX / W) * 2 - 1;
        mouseNDC.y = -(e.clientY / H) * 2 + 1;
    });

    // ══════════════════════════════════════════════════════════════
    //  STEP 1: 浮遊する0と1 — 「コードの宇宙」
    //
    //  6000個のビルボードクワッドを1バッチで描画
    //  グロー設計:
    //    - 各クワッドはガウシアン型のソフトな光輪を持つ
    //    - 近い(depth<0.5): 0/1の形も見える + グロー
    //    - 遠い(depth>0.7): グロー光点のみ（星のような点光源）
    //  奥行き設計:
    //    - z: -50 〜 +5 (camera z=8 なのでカメラ空間で-3〜-58)
    //    - 近い: 大きく明るい (scale 0.16)
    //    - 遠い: 極小の輝く点 (scale 0.02)
    //    - 指数フォグで遠景が暗闇に溶ける
    // ══════════════════════════════════════════════════════════════

    const COUNT = 6000;

    const bLocalPos = new Float32Array(COUNT * 4 * 3);
    const bUv       = new Float32Array(COUNT * 4 * 2);
    const bWPos     = new Float32Array(COUNT * 4 * 3);
    const bId       = new Float32Array(COUNT * 4);
    const bIdx      = new Uint32Array(COUNT * 6);

    const QV = [[-0.5,-0.5], [0.5,-0.5], [0.5,0.5], [-0.5,0.5]];
    const QU = [[0,0],        [1,0],      [1,1],      [0,1]];

    function rand(a, b) { return a + Math.random() * (b - a); }

    for (let i = 0; i < COUNT; i++) {
        const wx = rand(-22, 22);
        const wy = rand(-16, 16);
        // z分布: 近くは少なく、遠くに多く（奥が詰まって見える）
        const wz = rand(-50, 5);

        for (let v = 0; v < 4; v++) {
            const vi = i * 4 + v;
            bLocalPos[vi*3]   = QV[v][0];
            bLocalPos[vi*3+1] = QV[v][1];
            bLocalPos[vi*3+2] = 0;
            bUv[vi*2]         = QU[v][0];
            bUv[vi*2+1]       = QU[v][1];
            bWPos[vi*3]       = wx;
            bWPos[vi*3+1]     = wy;
            bWPos[vi*3+2]     = wz;
            bId[vi]           = i;
        }
        const ii = i * 6, vi = i * 4;
        bIdx[ii]  =vi; bIdx[ii+1]=vi+1; bIdx[ii+2]=vi+2;
        bIdx[ii+3]=vi; bIdx[ii+4]=vi+2; bIdx[ii+5]=vi+3;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(bLocalPos, 3));
    pGeo.setAttribute('uv',       new THREE.BufferAttribute(bUv,       2));
    pGeo.setAttribute('aWPos',    new THREE.BufferAttribute(bWPos,     3));
    pGeo.setAttribute('aId',      new THREE.BufferAttribute(bId,       1));
    pGeo.setIndex(new THREE.BufferAttribute(bIdx, 1));

    // ── Vertex Shader ──
    const pVert = `
precision mediump float;
attribute vec3  aWPos;
attribute float aId;
uniform   float u_time;
varying   vec2  vUv;
varying   float vDepth;
varying   float vIsOne;
varying   float vFlash;

float h(float n){ return fract(sin(mod(n,97.)*127.1)*43758.5); }

void main(){
    vUv = uv;

    // 漂い: 全方向ランダム正弦波 (重力なし)
    float dx = sin(u_time*h(aId*1.1+.1)*.25 + h(aId)    *6.283) * 0.8;
    float dy = cos(u_time*h(aId*2.3+.2)*.20 + h(aId*2.) *6.283) * 0.6;
    float dz = sin(u_time*h(aId*3.7+.3)*.15 + h(aId*3.) *6.283) * 0.5;
    vec3 wp = aWPos + vec3(dx, dy, dz);

    // 0/1 切り替え (0.5〜3.0s間隔)
    float iv = 0.5 + h(aId*3.7+1.) * 2.5;
    float ph = mod(u_time*0.8 + h(aId)*100., iv*2.);
    vIsOne   = step(iv, ph);
    float sm = min(abs(ph-iv), min(ph, iv*2.-ph));
    vFlash   = smoothstep(0.15, 0.0, sm);

    // ビルボード
    vec4 mvPos = modelViewMatrix * vec4(wp, 1.0);
    // カメラ(z=8)から最近傍(wz=5)までcam-z≈-3, 最遠(wz=-50)までcam-z≈-58
    float d01 = clamp((-mvPos.z - 3.) / 55., 0., 1.);
    vDepth    = d01;

    // 近: 0.16 / 遠: 0.02 (1/8スケール)
    float sc = mix(0.16, 0.02, d01);

    gl_Position = projectionMatrix * (mvPos + vec4(position.xy * sc, 0., 0.));
}`.trim();

    // ── Fragment Shader ──
    const pFrag = `
precision mediump float;
uniform float u_density;
varying vec2  vUv;
varying float vDepth;
varying float vIsOne;
varying float vFlash;

// 0: 縦長楕円リング
float draw0(vec2 p){
    float dOut = length(p / vec2(0.65, 1.05));
    float dIn  = length(p / vec2(0.30, 0.52));
    return smoothstep(0.95, 0.85, dOut) * smoothstep(0.88, 0.98, dIn);
}
// 1: 縦棒 + ベースライン + セリフ
float draw1(vec2 p){
    float stem  = step(abs(p.x),      0.13) * step(abs(p.y), 1.1);
    float base  = step(abs(p.y+1.02), 0.11) * step(abs(p.x), 0.33);
    float serif = step(abs(p.y-0.88), 0.11) * step(p.x, 0.08) * step(-0.27, p.x);
    return max(max(stem, base), serif);
}

void main(){
    vec2 uv2 = vUv - 0.5;  // [-0.5, 0.5]

    // ── グロー光輪 (ガウシアン、クワッド全体に広がる) ──
    float glowDist  = length(uv2 * 2.0);              // [0, √2]
    float halo      = exp(-glowDist * glowDist * 2.8); // ガウシアンフォール

    // ── 形 (近くだけ見える) ──
    // shapeVis: depth<0.30で1、depth>0.65で0
    float shapeVis = smoothstep(0.65, 0.25, vDepth);
    vec2 p = uv2 * vec2(2.0, 2.8);                    // [-1,1] x [-1.4,1.4]
    float shape = mix(draw0(p), draw1(p), vIsOne);

    // ── 合成 ──
    // 遠: ハロのみ / 近: ハロ + 形 + フラッシュ
    float shapeContrib = shape * shapeVis * (1.0 + vFlash * 2.0);
    float totalBright  = halo * 0.55 + shapeContrib * 0.9;

    // ── 指数フォグ (遠景が暗闇へ) ──
    float fog = exp(-vDepth * 3.0);

    // ── カラー ──
    // 基本: 緑 (0.0, 1.0, 0.15)
    // フラッシュ時: 白に向かう
    float flashW = vFlash * shapeVis * 0.55;
    vec3 green   = vec3(0.0, 1.0, 0.15);
    vec3 col     = mix(green, vec3(1.0), flashW);

    float alpha = totalBright * fog * u_density;
    if (alpha < 0.004) discard;

    // Additive blending: col*alpha で出力
    gl_FragColor = vec4(col * alpha, alpha);
}`.trim();

    const pUniforms = {
        u_time:    { value: 0 },
        u_density: { value: 0 }
    };
    const pMat = new THREE.ShaderMaterial({
        vertexShader: pVert, fragmentShader: pFrag,
        uniforms: pUniforms,
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending
    });
    scene.add(new THREE.Mesh(pGeo, pMat));

    // ══════════════════════════════════════════════════════════════
    //  STEP 2: 陰陽太極図 3D球体 (50%)
    //
    //  - ShaderMaterial: 球面UV座標でS字陰陽パターンをGLSL描画
    //  - ゆっくりY軸回転 (0.2 rad/s)
    //  - 暗い緑の環境光 (コードの世界)
    //  - ホバー: scale 1.0→1.1, グレーの光輪, 周囲の0/1が落ち着く
    //  - クリック: 0に収束→球体に吸い込み→グレーフェード→別URL
    // ══════════════════════════════════════════════════════════════

    scene.add(new THREE.AmbientLight(0x002200, 0.8));
    const greenPt = new THREE.PointLight(0x00ff44, 0.5, 20);
    greenPt.position.set(0, 4, 6);
    scene.add(greenPt);

    const sphereGeo = new THREE.SphereGeometry(0.9, 64, 64);

    // ── 共通 vertex shader ──
    const sVert = `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
void main(){
    vec4 wPos = modelMatrix * vec4(position, 1.0);
    vNormal  = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - wPos.xyz);
    vUv      = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`.trim();

    // ── 陰陽フラグメントシェーダー ──
    const yyFrag = `
precision highp float;
uniform float u_time;
uniform float u_hover;
uniform float u_clickT;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;

void main(){
    // 球面UV → θ/φ
    float phi   = vUv.x * 6.28318;
    float theta = (vUv.y - 0.5) * 3.14159;

    // Y軸回転 (u_time で自動回転)
    float pu = fract(vUv.x + u_time * 0.032);
    float pp = (pu - 0.5) * 6.28318;

    // S字境界: sin(theta)*0.5 で経度方向に分割
    float boundary = sin(theta) * 0.5;
    float phiNorm  = pp / 6.28318;
    bool  isWhite  = phiNorm > boundary;

    // 2つの小円 (陰中の陽 / 陽中の陰)
    float d1 = length(vec2(phiNorm,       theta / 3.14159 - 0.25));
    float d2 = length(vec2(phiNorm,       theta / 3.14159 + 0.25));
    float pat = (d1 < 0.12) ? 0.0 : (d2 < 0.12) ? 1.0 : (isWhite ? 1.0 : 0.0);

    vec3 baseCol = vec3(pat);

    // ライティング
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(vec3(0.2, 0.6, 1.0));
    float diff = max(dot(N, L), 0.0) * 0.5 + 0.5;

    // フレネル: 縁が緑に光る (コードの世界を反射)
    float fr = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    vec3 fresnel = vec3(0.0, 0.75, 0.2) * fr * (0.15 + u_hover * 0.5);

    // ホバー時: グレーの淡い光輪を追加
    vec3 hoverGlow = vec3(0.5, 0.6, 0.5) * fr * u_hover * 0.4;

    vec3 col = baseCol * diff + fresnel + hoverGlow;
    col = mix(col, vec3(1.0), u_clickT * 0.8);

    gl_FragColor = vec4(col, 1.0);
}`.trim();

    const yyUni = { u_time:{value:0}, u_hover:{value:0}, u_clickT:{value:0} };
    const yyMat = new THREE.ShaderMaterial({
        vertexShader: sVert, fragmentShader: yyFrag,
        uniforms: yyUni
    });
    const yySphere = new THREE.Mesh(sphereGeo, yyMat);
    yySphere.position.set(-2.5, 0, 0);
    scene.add(yySphere);

    // ── DOM ラベル ──
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10;pointer-events:none;font-family:"Courier New",monospace;';
    document.body.appendChild(overlay);

    const fadeOv = document.createElement('div');
    fadeOv.id    = 'p2-fade-ov'; // P3遷移時に引き継ぐためID付与
    fadeOv.style.cssText = 'position:fixed;inset:0;z-index:100;opacity:0;pointer-events:none;transition:opacity 0.1s;';
    document.body.appendChild(fadeOv);

    function makeLabel(leftPct, bigText, subText, subStyle) {
        const w = document.createElement('div');
        w.style.cssText = `position:absolute;left:${leftPct}%;top:62%;transform:translateX(-50%);
            text-align:center;pointer-events:auto;cursor:pointer;opacity:0;transition:opacity 0.6s;`;
        const b = document.createElement('div');
        b.textContent = bigText;
        b.style.cssText = 'font-size:20px;font-weight:bold;color:#aaa;letter-spacing:3px;transition:color 0.3s,text-shadow 0.3s;';
        const s = document.createElement('div');
        s.textContent = subText;
        s.style.cssText = 'font-size:11px;margin-top:6px;letter-spacing:4px;color:#555;';
        Object.assign(s.style, subStyle || {});
        w.appendChild(b); w.appendChild(s);
        overlay.appendChild(w);
        return { wrap: w, big: b, sub: s };
    }

    const lblYY = makeLabel(28, '50%', 'inRYOKU', {});

    // ══════════════════════════════════════════════════════════════
    //  STEP 3: RGBCMY 3D球体 (101%)
    //
    //  6色が球面の6極(±X/±Y/±Z)に配置、dot^3で加重平均
    //  3Dノイズで色の境界が有機的に流動する
    //  内側から発光 (emissive)、縁にレインボーフレネル
    //  R=+X, C=-X, G=+Y, M=-Y, B=+Z, Y=-Z
    // ══════════════════════════════════════════════════════════════

    // ── CSSアニメーション (inryokü レインボーラベル) ──
    const p2css = document.createElement('style');
    p2css.textContent = `
        @keyframes p2rbflow {
            0%   { background-position: 0%   50%; }
            100% { background-position: 200% 50%; }
        }
    `;
    document.head.appendChild(p2css);

    // ── RGBCMY フラグメントシェーダー ──
    const rcFrag = `
precision highp float;
uniform float u_time;
uniform float u_hover;
uniform float u_clickT;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;

// 3D値ノイズ (色境界の有機的流動)
float h1(float n){ return fract(sin(mod(n, 300.0) * 127.1) * 43758.545); }
float noise3(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.-2.*f);
    float a = h1(i.x + i.y*57. + i.z*113.);
    float b = h1(i.x+1. + i.y*57. + i.z*113.);
    float c = h1(i.x + (i.y+1.)*57. + i.z*113.);
    float d = h1(i.x+1. + (i.y+1.)*57. + i.z*113.);
    float e = h1(i.x + i.y*57. + (i.z+1.)*113.);
    float f2= h1(i.x+1. + i.y*57. + (i.z+1.)*113.);
    float g = h1(i.x + (i.y+1.)*57. + (i.z+1.)*113.);
    float hh= h1(i.x+1. + (i.y+1.)*57. + (i.z+1.)*113.);
    return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),
               mix(mix(e,f2,f.x),mix(g,hh,f.x),f.y),f.z);
}

void main(){
    // 球面座標
    float phi   = vUv.x * 6.28318;
    float theta = vUv.y * 3.14159;
    vec3 sPos = vec3(sin(theta)*cos(phi), cos(theta), sin(theta)*sin(phi));

    // ノイズで表面を変形 (色境界が有機的に流れる)
    float spd = 0.07 + u_hover * 0.10 + u_clickT * 0.20;
    float t   = u_time * spd;
    vec3 nOff = vec3(
        noise3(sPos * 2.5 + vec3(t,    0.,   0.)) * 2. - 1.,
        noise3(sPos * 2.5 + vec3(0., t*0.8,  0.)) * 2. - 1.,
        noise3(sPos * 2.5 + vec3(0.,   0., t*0.6))* 2. - 1.
    );
    vec3 wPos = normalize(sPos + nOff * 0.28);

    // 6極 (立方体面法線) と対応色
    vec3 dirs[6];
    dirs[0]=vec3(1.,0.,0.); dirs[1]=vec3(-1.,0.,0.); // R, C
    dirs[2]=vec3(0.,1.,0.); dirs[3]=vec3(0.,-1.,0.); // G, M
    dirs[4]=vec3(0.,0.,1.); dirs[5]=vec3(0.,0.,-1.); // B, Y

    vec3 cols[6];
    cols[0]=vec3(1.,0.,0.); cols[1]=vec3(0.,1.,1.);  // R, C
    cols[2]=vec3(0.,1.,0.); cols[3]=vec3(1.,0.,1.);  // G, M
    cols[4]=vec3(0.,0.,1.); cols[5]=vec3(1.,1.,0.);  // B, Y

    // dot^3 加重平均 → 色の「島」が鮮明に
    vec3 result = vec3(0.); float total = 0.;
    for(int i = 0; i < 6; i++){
        float w = max(0., dot(wPos, dirs[i]));
        w = w * w * w;
        result += cols[i] * w; total += w;
    }
    result /= max(total, 0.001);

    // ライティング
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(vec3(0.3, 0.5, 1.0));
    float diff    = max(dot(N,L), 0.) * 0.35 + 0.65;
    float fresnel = pow(1. - max(dot(N,V), 0.), 2.2);

    // 内側発光 (emissive)
    float emissive = 0.35 + u_hover * 0.35 + u_clickT * 0.6;
    // レインボーフレネル (縁が6色に光る)
    float frStr   = 0.55 + u_hover * 0.65 + u_clickT * 1.2;
    vec3  frCol   = result * fresnel * frStr;

    vec3 col = result * diff + result * emissive + frCol;

    // クリック時の最大発光
    col = mix(col, vec3(1.0), u_clickT * 0.5);

    gl_FragColor = vec4(col, 1.0);
}`.trim();

    const rcUni  = { u_time:{value:0}, u_hover:{value:0}, u_clickT:{value:0} };
    const rcMat  = new THREE.ShaderMaterial({
        vertexShader: sVert, fragmentShader: rcFrag,
        uniforms: rcUni
    });
    const rcSphere = new THREE.Mesh(sphereGeo.clone(), rcMat);
    rcSphere.position.set(2.5, 0, 0);
    scene.add(rcSphere);

    // ── inryokü レインボーラベル ──
    const lblRC = makeLabel(72, '101%', 'inryokü', {
        background: 'linear-gradient(90deg,#0ff,#f0f,#ff0,#f00,#0f0,#00f,#0ff)',
        backgroundSize: '200% 100%',
        webkitBackgroundClip: 'text',
        webkitTextFillColor: 'transparent',
        animation: 'p2rbflow 3s linear infinite'
    });

    // ── Raycaster ──
    const raycaster = new THREE.Raycaster();
    const mouse3D   = new THREE.Vector2();
    let hovYY = false, hovRC = false;
    let hoverYY = 0,   hoverRC = 0;
    window.addEventListener('mousemove', e => {
        mouse3D.x =  (e.clientX / W) * 2 - 1;
        mouse3D.y = -(e.clientY / H) * 2 + 1;
    });

    // ══════════════════════════════════════════════════════════════
    //  STEP 4: Web Audio API
    //
    //  環境音: 48Hz/96Hz ドローン + バンドパスノイズ (コードの世界の静謐)
    //  ホバー音: 陰陽=100Hz正弦波 / RGBCMY=C-E-Gコード
    //  選択音: 50%=収束(200→55Hz下降) / 101%=和音拡散+ホワイトノイズ
    // ══════════════════════════════════════════════════════════════

    let audioCtx = null;
    function getCtx() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    // ── アンビエント (ドローン + ノイズ) ──
    let ambGain = null;
    function startAmbient() {
        if (ambGain) return;
        const ctx = getCtx();
        ambGain = ctx.createGain();
        ambGain.gain.setValueAtTime(0, ctx.currentTime);
        ambGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3.0);
        ambGain.connect(ctx.destination);

        // 48Hz + 96Hz ドローン
        [48, 96].forEach((f, i) => {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
            const g = ctx.createGain(); g.gain.value = i ? 0.20 : 0.55;
            o.connect(g); g.connect(ambGain); o.start();
        });

        // バンドパスノイズ (コードの世界の微かなハム)
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.01;
        const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
        const nf = ctx.createBiquadFilter();
        nf.type = 'bandpass'; nf.frequency.value = 600; nf.Q.value = 0.4;
        ns.connect(nf); nf.connect(ambGain); ns.start();
    }
    function stopAmbient(fadeT = 1.0) {
        if (!ambGain || !audioCtx) return;
        ambGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeT);
    }

    // ── ホバー音 ──
    let lastHovYY = false, lastHovRC = false;
    function playHover(type) {
        const ctx = getCtx();
        const g   = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.07);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        g.connect(ctx.destination);

        if (type === 'yy') {
            // 100Hz正弦波 (安定・現実)
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 100;
            o.connect(g); o.start();
            setTimeout(() => { try { o.stop(); } catch(e) {} }, 600);
        } else {
            // C-E-G コード (きらめき・101%)
            [262, 330, 392].forEach(f => {
                const o  = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
                const og = ctx.createGain(); og.gain.value = 0.33;
                o.connect(og); og.connect(g); o.start();
                setTimeout(() => { try { o.stop(); } catch(e) {} }, 600);
            });
        }
    }

    // ── 選択音 ──
    function playSelect(type) {
        const ctx = getCtx(), now = ctx.currentTime;
        if (type === 'yy50') {
            // 200→55Hz 下降グライド → 収束 → 静寂
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.10, now);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
            g.connect(ctx.destination);
            const o = ctx.createOscillator(); o.type = 'sine';
            o.frequency.setValueAtTime(200, now);
            o.frequency.exponentialRampToValueAtTime(55, now + 1.8);
            o.connect(g); o.start();
            setTimeout(() => { try { o.stop(); } catch(e) {} }, 2200);
        } else {
            // C-E-G-B コードが広がる + ホワイトノイズバースト
            [261, 329, 392, 494].forEach((f, i) => {
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, now);
                g.gain.linearRampToValueAtTime(0.06, now + 0.06 + i * 0.08);
                g.gain.linearRampToValueAtTime(0.0001, now + 2.0);
                g.connect(ctx.destination);
                const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
                o.connect(g); o.start();
                setTimeout(() => { try { o.stop(); } catch(e) {} }, 2200);
            });
            // ホワイトノイズバースト (1.0s後)
            const nLen = ctx.sampleRate;
            const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
            const nd   = nBuf.getChannelData(0);
            for (let i = 0; i < nLen; i++) nd[i] = Math.random() * 2 - 1;
            const ns = ctx.createBufferSource(); ns.buffer = nBuf;
            const ng = ctx.createGain();
            ng.gain.setValueAtTime(0, now + 1.0);
            ng.gain.linearRampToValueAtTime(0.22, now + 1.15);
            ng.gain.linearRampToValueAtTime(0, now + 2.0);
            ns.connect(ng); ng.connect(ctx.destination); ns.start(now + 1.0);
        }
    }

    // ── クリック遷移 ──
    let clickState = null, clickTimer = 0;
    window.addEventListener('click', () => {
        if (clickState) return;
        raycaster.setFromCamera(mouse3D, camera);
        if (raycaster.intersectObject(yySphere).length > 0) {
            clickState = 'yy50'; clickTimer = 0;
            stopAmbient(1.5); playSelect('yy50');
        } else if (raycaster.intersectObject(rcSphere).length > 0) {
            clickState = 'rc101'; clickTimer = 0;
            stopAmbient(1.8); playSelect('rc101');
        }
    });

    // ── レンダーループ ──
    const DENSITY_START = 0.3, DENSITY_FULL = 2.5;
    const SPHERE_SHOW = 2.8, SPHERE_FULL = 3.8;
    let lastTime = performance.now();
    let sA = 0; // 球体フェードイン [0,1]

    (function loop(){
        if (!alive) return;
        requestAnimationFrame(loop);
        const now = performance.now();
        const dt  = Math.min((now - lastTime) / 1000, 0.05);
        lastTime  = now;
        globalTime += dt;

        // パーティクル
        const dT = Math.max(0, Math.min(1,
            (globalTime - DENSITY_START) / (DENSITY_FULL - DENSITY_START)));
        pUniforms.u_time.value    = globalTime;
        pUniforms.u_density.value = dT * dT * (3 - 2 * dT);

        // 球体フェードイン
        const sT = Math.max(0, Math.min(1,
            (globalTime - SPHERE_SHOW) / (SPHERE_FULL - SPHERE_SHOW)));
        sA = sT * sT * (3 - 2 * sT);
        lblYY.wrap.style.opacity = String(sA);
        lblRC.wrap.style.opacity = String(sA);

        // ── クリック遷移 ──
        if (clickState === 'yy50') {
            clickTimer += dt;
            const ct = clickTimer;
            yySphere.rotation.y += dt * (0.5 + ct * 5);
            yyUni.u_clickT.value = Math.min(1, ct / 0.8);
            if (ct >= 0.8 && ct < 1.8) {
                pUniforms.u_density.value *= 0.92; // 0に収束: 暗くなる
            }
            if (ct >= 1.4) {
                const p = Math.min(1, (ct - 1.4) / 0.9);
                fadeOv.style.background = '#808080';
                fadeOv.style.opacity    = String(p);
            }
            if (ct >= 2.5) { window.location.href = INRYOKU_50_URL; return; }

        } else if (clickState === 'rc101') {
            clickTimer += dt;
            const ct = clickTimer;
            rcSphere.rotation.y += dt * (0.5 + ct * 6);
            rcUni.u_clickT.value = Math.min(1, ct / 0.5);
            if (ct >= 0.5 && ct < 1.5) {
                // 1に固定: パーティクルが高速切り替え (u_time加速は不可なので密度維持)
                rcUni.u_clickT.value = 1.0;
            }
            if (ct >= 1.0 && ct < 2.2) {
                // レインボーフラッシュ → ホワイトアウト
                const p = (ct - 1.0) / 1.2;
                const hue = Math.floor(p * 360);
                if (ct < 1.6) {
                    fadeOv.style.background =
                        `linear-gradient(${hue}deg,#f0f,#0ff,#ff0,#0f0,#f00,#00f)`;
                } else {
                    fadeOv.style.background = '#ffffff';
                }
                fadeOv.style.opacity = String(Math.min(1, p));
            }
            if (ct >= 2.4) { completeP2(); return; }

        } else {
            // 通常回転
            yySphere.rotation.y += dt * 0.2;
            rcSphere.rotation.y += dt * 0.3;
        }

        // ── ホバー検出 ──
        if (!clickState && sA > 0.5) {
            raycaster.setFromCamera(mouse3D, camera);
            hovYY = raycaster.intersectObject(yySphere).length > 0;
            hovRC = raycaster.intersectObject(rcSphere).length > 0;
        } else if (!clickState) { hovYY = hovRC = false; }

        // アンビエント起動 (球体が見え始めたら)
        if (sA > 0.1 && !ambGain) startAmbient();

        const prevHYY = hoverYY > 0.5;
        const prevHRC = hoverRC > 0.5;
        hoverYY += ((hovYY ? 1 : 0) - hoverYY) * 6 * dt;
        hoverRC += ((hovRC ? 1 : 0) - hoverRC) * 6 * dt;

        // ホバー音 (立ち上がり瞬間のみ)
        if (!clickState) {
            if (!prevHYY && hoverYY > 0.5) playHover('yy');
            if (!prevHRC && hoverRC > 0.5) playHover('rc');
        }

        yyUni.u_hover.value = hoverYY;
        yyUni.u_time.value  = globalTime;
        rcUni.u_hover.value = hoverRC;
        rcUni.u_time.value  = globalTime;

        // ホバー時スケール (1.0 → 1.1)
        yySphere.scale.setScalar(sA * (1.0 + hoverYY * 0.1));
        rcSphere.scale.setScalar(sA * (1.0 + hoverRC * 0.1));

        // ラベル変化
        lblYY.big.style.color      = hovYY ? '#ffffff' : '#aaaaaa';
        lblYY.big.style.textShadow = hovYY
            ? '0 0 15px #fff, 0 0 30px rgba(150,220,150,0.6)' : 'none';
        lblRC.big.style.color      = hovRC ? '#ffffff' : '#aaaaaa';
        lblRC.big.style.textShadow = hovRC
            ? '0 0 15px #fff, 0 0 35px rgba(255,100,255,0.7)' : 'none';

        document.body.style.cursor = (hovYY || hovRC) ? 'pointer' : '';

        renderer.render(scene, camera);
    })();

    function dispose(){
        alive = false;
        stopAmbient(0.2);
        setTimeout(() => { if (audioCtx) { audioCtx.close(); audioCtx = null; } }, 400);
        pGeo.dispose(); pMat.dispose();
        sphereGeo.dispose(); yyMat.dispose(); rcMat.dispose();
        renderer.dispose(); renderer.domElement.remove();
        overlay.remove(); fadeOv.remove(); p2css.remove();
        document.body.style.cursor = '';
    }
    function completeP2(){
        // WebGL/DOMをクリーンアップするが fadeOv (ホワイトアウト) は残す
        // → P3 が白→黒→透明の遷移を引き継ぐ
        alive = false;
        stopAmbient(0.3);
        setTimeout(() => { if (audioCtx) { audioCtx.close(); audioCtx = null; } }, 500);
        pGeo.dispose(); pMat.dispose();
        sphereGeo.dispose(); yyMat.dispose(); rcMat.dispose();
        renderer.dispose(); renderer.domElement.remove();
        overlay.remove(); p2css.remove();
        document.body.style.cursor = '';
        // fadeOv は削除しない（P3 が #p2-fade-ov として参照して使う）
        window.dispatchEvent(new CustomEvent('inryoku:p2complete'));
    }
    window._p2 = { dispose, completeP2 };
}
