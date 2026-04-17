'use strict';
// ═══════════════════════════════════════════════════════════════
//  P2 — THE CODE WORLD  v2  |  Step 1: 浮遊する0と1 (改良版)
//  Three.js 0.160.0 | GLSL only | No Canvas 2D | No textures
//
//  「デジタルの星空」「コードでできた宇宙」
//  - 4000パーティクル、z軸 -50〜+5 の深宇宙空間
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
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 150);
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

    const COUNT = 4000;

    const bLocalPos = new Float32Array(COUNT * 4 * 3);
    const bUv       = new Float32Array(COUNT * 4 * 2);
    const bWPos     = new Float32Array(COUNT * 4 * 3);
    const bId       = new Float32Array(COUNT * 4);
    const bIdx      = new Uint32Array(COUNT * 6);
    const bSize     = new Float32Array(COUNT * 4);

    const QV = [[-0.5,-0.5], [0.5,-0.5], [0.5,0.5], [-0.5,0.5]];
    const QU = [[0,0],        [1,0],      [1,1],      [0,1]];

    function rand(a, b) { return a + Math.random() * (b - a); }
    function randNormal(mean, std) {
        const u1 = Math.random() + 1e-10, u2 = Math.random();
        return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(6.28318 * u2);
    }
    function randSize() {
        const r = Math.random();
        if (r < 0.05) return 3.0 + Math.random() * 2.0;   // 5% 大型光球
        if (r < 0.20) return 1.5 + Math.random() * 0.8;   // 15% 中型
        return 0.5 + Math.random() * 0.7;                   // 80% 小型
    }

    // 渦巻き配置: 2つの球体を中心に銀河のような軌道分布
    // + 球体間を流れるストリーム粒子
    const STREAM_COUNT = 200; // 最初の200個はストリーム粒子
    const bOrbitType = new Float32Array(COUNT * 4); // 0=YY軌道, 1=RC軌道, 2=ストリーム, 3=遠景

    for (let i = 0; i < COUNT; i++) {
        let wx, wy, wz, sz, orbitType;

        if (i < STREAM_COUNT) {
            // ── ストリーム粒子: 2球の間を流れる ──
            orbitType = 2;
            const streamT = rand(0, 1); // 0=YY側, 1=RC側
            wx = -2.5 + streamT * 5.0 + rand(-0.3, 0.3);
            wy = rand(-0.8, 0.8);
            wz = rand(-3, 3);
            sz = 0.3 + Math.random() * 0.4;
        } else if (i < STREAM_COUNT + 1500) {
            // ── YY球(50%)の軌道粒子 ──
            orbitType = 0;
            const angle = rand(0, Math.PI * 2);
            const r = 1.5 + Math.pow(Math.random(), 0.5) * 8;
            const tilt = rand(-0.3, 0.3); // 軌道面の傾き
            wx = -2.5 + Math.cos(angle) * r;
            wy = Math.sin(angle) * r * (0.6 + Math.random() * 0.4) + Math.sin(angle * 2 + tilt) * r * 0.15;
            wz = rand(-40, 3) + Math.sin(angle + tilt) * r * 0.3;
            sz = randSize();
        } else if (i < STREAM_COUNT + 3000) {
            // ── RC球(101%)の軌道粒子 ──
            orbitType = 1;
            const angle = rand(0, Math.PI * 2);
            const r = 1.5 + Math.pow(Math.random(), 0.5) * 8;
            const tilt = rand(-0.3, 0.3);
            wx = 2.5 + Math.cos(angle) * r;
            wy = Math.sin(angle) * r * (0.6 + Math.random() * 0.4) + Math.sin(angle * 2 + tilt) * r * 0.15;
            wz = rand(-40, 3) + Math.sin(angle + tilt) * r * 0.3;
            sz = randSize();
        } else {
            // ── 遠景粒子: 深宇宙の星 ──
            orbitType = 3;
            wx = rand(-22, 22);
            wy = rand(-16, 16);
            wz = rand(-75, -20);
            sz = randSize();
        }

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
            bSize[vi]         = sz;
            bOrbitType[vi]    = orbitType;
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
    pGeo.setAttribute('aSize',    new THREE.BufferAttribute(bSize,     1));
    pGeo.setAttribute('aOrbitType', new THREE.BufferAttribute(bOrbitType, 1));
    pGeo.setIndex(new THREE.BufferAttribute(bIdx, 1));

    // ── Vertex Shader (Binary Decay Style) ──
    const pVert = `
precision mediump float;
attribute vec3  aWPos;
attribute float aId;
attribute float aSize;
attribute float aOrbitType;
uniform   float u_time;
uniform   float u_intro;
uniform   vec3  u_resPos[6];
uniform   float u_resTime[6];
uniform   vec3  u_mouseWorld;
uniform   vec3  u_sphereYY;
uniform   vec3  u_sphereRC;
uniform   float u_attract;
uniform   vec3  u_attractTarget;
varying   vec2  vUv;
varying   float vDepth;
varying   float vIsOne;
varying   float vFlash;
varying   float vColorId;
varying   float vResonance;
varying   float vObserve;
varying   float vDecay;

float h(float n){ return fract(sin(mod(n,97.)*127.1)*43758.5); }

float vnoise(vec3 p){
    vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.-2.*f);
    float n=i.x+i.y*57.+i.z*113.;
    return mix(
        mix(mix(h(n),h(n+1.),f.x),mix(h(n+57.),h(n+58.),f.x),f.y),
        mix(mix(h(n+113.),h(n+114.),f.x),mix(h(n+170.),h(n+171.),f.x),f.y),
        f.z);
}

void main(){
    vUv      = uv;
    vObserve = 0.0;
    vColorId = h(aId*13.7+3.3);
    float seed = h(aId*7.3+1.1);
    float t    = u_time*0.09;

    // ── 有機的ドリフト（ノイズベースの浮遊感） ──
    float dx = (vnoise(vec3(seed*8.+t*0.3, seed*3., seed*5.))-0.5)*1.2;
    float dy = (vnoise(vec3(seed*6., seed*9.+t*0.5, seed))-0.5)*1.8;
    float dz = (vnoise(vec3(seed*4., seed*7., seed*11.+t*0.3))-0.5)*2.0;
    // 第2層ノイズ: より大きなスケールの緩やかなうねり
    float dx2 = (vnoise(vec3(seed*1.2+t*0.08, seed*2.1, t*0.12))-0.5)*3.5;
    float dy2 = (vnoise(vec3(t*0.1, seed*1.8+t*0.06, seed*3.3))-0.5)*2.5;
    vec3 wp = aWPos + vec3(dx+dx2, dy+dy2, dz);

    // ── 軌道運動（楕円＋z軸うねり） ──
    if(aOrbitType < 0.5) {
        vec2 rel = wp.xy - u_sphereYY.xy;
        float r = length(rel);
        float angle = atan(rel.y, rel.x);
        float speed = 0.12 / max(r * 0.25, 0.25);
        angle += u_time * speed * 0.09;
        // 楕円軌道 + 呼吸するようなr変動
        float rBreath = r * (1.0 + sin(u_time * 0.3 + seed * 4.0) * 0.15);
        float ellipse = 0.7 + seed * 0.6; // 楕円率
        wp.x = u_sphereYY.x + cos(angle) * rBreath * ellipse;
        wp.y = u_sphereYY.y + sin(angle) * rBreath;
        wp.z += sin(u_time * 0.2 + angle * 2.0 + seed * 5.0) * 1.5;
    } else if(aOrbitType < 1.5) {
        vec2 rel = wp.xy - u_sphereRC.xy;
        float r = length(rel);
        float angle = atan(rel.y, rel.x);
        float speed = 0.12 / max(r * 0.25, 0.25);
        angle -= u_time * speed * 0.09;
        float rBreath = r * (1.0 + sin(u_time * 0.35 + seed * 3.0) * 0.15);
        float ellipse = 0.7 + seed * 0.6;
        wp.x = u_sphereRC.x + cos(angle) * rBreath;
        wp.y = u_sphereRC.y + sin(angle) * rBreath * ellipse;
        wp.z += sin(u_time * 0.25 + angle * 2.0 + seed * 7.0) * 1.5;
    } else if(aOrbitType < 2.5) {
        // ストリーム: 波状の流れ（直線的でなく）
        float streamPhase = seed * 6.28 + u_time * (0.25 + seed * 0.15);
        float streamT = sin(streamPhase) * 0.5 + 0.5;
        wp.x = mix(u_sphereYY.x, u_sphereRC.x, streamT);
        wp.y += sin(streamPhase * 2.3 + seed * 10.0) * 0.6;
        wp.z += cos(streamPhase * 1.7 + seed * 8.0) * 0.8;
        // 8の字の揺れ
        wp.y += sin(streamPhase * 0.7) * cos(streamPhase * 1.1) * 0.3;
    }
    // 遠景: 自由浮遊（カラム固定なし）
    if(aOrbitType >= 2.5) {
        // ゆっくり漂う（落下ではなく全方向ドリフト）
        float drift = u_time * 0.08;
        wp.x += sin(drift + seed * 20.0) * 2.0;
        wp.y += cos(drift * 0.7 + seed * 15.0) * 1.5;
        wp.z += sin(drift * 0.5 + seed * 30.0) * 3.0;
    }

    // ── Binary Decay: 崩壊サイクル ──
    float cycle = mod(u_time * 0.12 + seed * 3.0, 5.0);
    vDecay = 0.0;
    if(cycle > 2.0 && cycle < 3.5) {
        float dt2 = (cycle - 2.0) / 1.5;
        vDecay = dt2 * dt2;
        float angle2 = h(aId*31.0 + floor(u_time*1.5)) * 6.28;
        float dist = vDecay * (0.5 + seed * 1.5);
        wp.x += cos(angle2) * dist;
        wp.y += sin(angle2) * dist - vDecay * vDecay * 1.0;
    } else if(cycle >= 3.5 && cycle < 5.0) {
        float dt2 = (cycle - 3.5) / 1.5;
        vDecay = max(0.0, 1.0 - dt2 * dt2);
    }

    // 球体近くのパーティクルは崩壊を抑制（球体を見やすくする）
    float dYY = length(wp.xy - u_sphereYY.xy);
    float dRC = length(wp.xy - u_sphereRC.xy);
    float nearSphere = smoothstep(2.0, 1.0, min(dYY, dRC));
    // 球体近くのパーティクルは暗く小さくする
    float sphereDim = 1.0 - nearSphere * 0.7;

    // Birth animation
    float birthDelay = h(aId * 2.17 + 5.5) * 0.75;
    float bp = clamp((u_intro - birthDelay) / 0.28, 0.0, 1.0);
    float bpSmooth = bp * bp * (3.0 - 2.0 * bp);
    wp.y += (1.0 - bpSmooth) * 22.0;

    // 0/1 切り替え
    float iv = 0.5 + h(aId*3.7+1.)*2.5;
    float ph = mod(u_time*0.8 + h(aId)*100., iv*2.);
    vIsOne = step(iv, ph);
    float sm = min(abs(ph-iv), min(ph, iv*2.-ph));
    vFlash = smoothstep(0.12, 0.0, sm);

    // 共鳴
    vResonance = 0.0;
    for(int k=0; k<6; k++){
        float dt3 = u_time - u_resTime[k];
        if(dt3>0.0 && dt3<5.0){
            float d = length(wp - u_resPos[k]);
            float waveFront = d - dt3*5.5;
            float ring = exp(-waveFront*waveFront*2.2);
            vResonance += ring * exp(-dt3*0.65);
        }
    }
    vResonance = clamp(vResonance, 0.0, 1.8);

    // P2→P3遷移
    if(u_attract > 0.0){
        float pullStr = u_attract * u_attract;
        wp = mix(wp, u_attractTarget, pullStr);
        vObserve = max(vObserve, u_attract);
    }

    // 観測度
    float dMouse = length(wp - u_mouseWorld);
    float minDist = min(dMouse, min(dYY, dRC));
    vObserve = max(vObserve, 1.0 - smoothstep(1.5, 4.5, minDist));

    // ビルボード
    vec4 mvPos = modelViewMatrix * vec4(wp, 1.0);
    float d01 = clamp((-mvPos.z - 3.) / 85., 0., 1.);
    vDepth = d01;

    float sc = mix(0.22, 0.006, d01) * aSize;
    sc *= 1.0 + smoothstep(0.15, 0.0, d01) * 0.6;
    sc *= 1.0 + (1.0 - vObserve) * 0.3;
    sc *= 1.0 - vDecay * 0.5; // 崩壊中は縮小
    sc *= sphereDim; // 球体近くは小さく

    gl_Position = projectionMatrix * (mvPos + vec4(position.xy*sc, 0., 0.));
}`.trim();

    // ── Fragment Shader (Binary Decay Style) ──
    const pFrag = `
precision mediump float;
uniform float u_density;
uniform float u_time;
uniform float u_rainbowMix;
varying vec2  vUv;
varying float vDepth;
varying float vIsOne;
varying float vFlash;
varying float vColorId;
varying float vResonance;
varying float vObserve;
varying float vDecay;

// 0: 正円リング
float draw0(vec2 p){
    vec2 q = p / vec2(1.0, 1.4);
    float d = length(q);
    float ring = smoothstep(1.05, 0.76, d) * smoothstep(0.38, 0.58, d);
    float glow = exp(-abs(d - 0.72) * 4.0) * 0.70;
    return max(ring, glow);
}
// 1: 縦線 + 上部光点
float draw1(vec2 p){
    float stem = smoothstep(0.18, 0.04, abs(p.x))
               * smoothstep(1.05, 0.80, abs(p.y - 0.05));
    float dDot = length(p - vec2(0.0, 1.1));
    float dot  = smoothstep(0.32, 0.10, dDot);
    float halo = exp(-dDot * 2.5) * 0.90;
    return max(stem, max(dot, halo));
}

void main(){
    vec2 uv2 = vUv - 0.5;
    float gd = length(uv2 * 2.0);

    // ── Binary Decay: 崩壊中はピクセルダストに ──
    float shape;
    vec2 p = uv2 * vec2(2.0, 2.8);
    if(vDecay < 0.15) {
        // 完全体: 0/1
        shape = mix(draw0(p), draw1(p), vIsOne);
    } else {
        // ピクセルダスト: 四角い粒に分解
        vec2 pix = floor(uv2 * 6.0) / 6.0;
        float pixD = length(uv2 - pix - 0.083);
        shape = smoothstep(0.15, 0.04, pixD) * (1.0 - vDecay * 0.3);
    }

    // 波動⇔粒子
    float wavePhase = sin(u_time * 1.2 + vColorId * 20.0) * 0.5 + 0.5;
    float waveHalo = exp(-gd*gd*0.6) * (0.6 + wavePhase * 0.4);
    float particleHalo = exp(-gd*gd*1.5);
    float halo = mix(waveHalo, particleHalo, vObserve);

    float shapeVis = smoothstep(0.75, 0.08, vDepth);
    shapeVis *= vObserve;
    float shapeContrib = shape * shapeVis * (1.0 + vFlash * 6.0);
    float resonGlow = vResonance * halo * 1.5;
    float totalBright = halo * 0.6 + shapeContrib * 1.0 + resonGlow;

    // フォグ
    float fog = exp(-vDepth * 3.5);

    // カラー (RGBCMY)
    vec3 baseHue;
    float seg = vColorId * 6.0;
    if(seg < 1.0)      baseHue = vec3(1.0, 0.0, 0.0);
    else if(seg < 2.0) baseHue = vec3(0.0, 1.0, 0.0);
    else if(seg < 3.0) baseHue = vec3(0.0, 0.0, 1.0);
    else if(seg < 4.0) baseHue = vec3(0.0, 1.0, 1.0);
    else if(seg < 5.0) baseHue = vec3(1.0, 0.0, 1.0);
    else               baseHue = vec3(1.0, 1.0, 0.0);

    // ── RGBCMY レインボー変色 (rc101クリック時) ──
    if(u_rainbowMix > 0.0) {
        float angle = atan(uv2.y, uv2.x) + u_time * 0.8 + vColorId * 6.28;
        float rbSeg = mod(angle / 6.28318 * 6.0 + 6.0, 6.0);
        vec3 rbCol;
        if(rbSeg < 1.0)      rbCol = mix(vec3(1.,0.,0.), vec3(0.,1.,0.), fract(rbSeg));
        else if(rbSeg < 2.0) rbCol = mix(vec3(0.,1.,0.), vec3(0.,0.,1.), fract(rbSeg));
        else if(rbSeg < 3.0) rbCol = mix(vec3(0.,0.,1.), vec3(0.,1.,1.), fract(rbSeg));
        else if(rbSeg < 4.0) rbCol = mix(vec3(0.,1.,1.), vec3(1.,0.,1.), fract(rbSeg));
        else if(rbSeg < 5.0) rbCol = mix(vec3(1.,0.,1.), vec3(1.,1.,0.), fract(rbSeg));
        else                 rbCol = mix(vec3(1.,1.,0.), vec3(1.,0.,0.), fract(rbSeg));
        baseHue = mix(baseHue, rbCol, u_rainbowMix);
    }

    // 崩壊中: 色が白く飛ぶ
    vec3 decayCol = mix(baseHue * 0.5, vec3(1.0), vDecay * 0.6);
    vec3 normalCol = mix(
        mix(vec3(0.08, 0.10, 0.14), baseHue * 0.4, 0.5),
        baseHue * 0.55 + vec3(0.03, 0.04, 0.08),
        vObserve
    );
    // レインボー時は明るさをブースト
    normalCol = mix(normalCol, baseHue * 0.7, u_rainbowMix * 0.6);
    vec3 baseCol = mix(normalCol, decayCol, step(0.1, vDecay));

    baseCol = mix(baseCol, mix(baseHue, vec3(1.0), 0.18), clamp(vResonance * 0.9, 0., 1.));
    vec3 col = mix(baseCol, vec3(1.0), vFlash * shapeVis * 0.8);

    float alpha = totalBright * fog * u_density;
    alpha *= 1.0 - vDecay * 0.2; // 崩壊中は少し透明に
    if(alpha < 0.003) discard;
    gl_FragColor = vec4(col * alpha, alpha);
}`.trim();

    // ── 共鳴イベント リングバッファ (6スロット) ──
    const RES_N = 6;
    const resPositions = Array.from({length: RES_N}, () => new THREE.Vector3(0, 0, -999));
    const resTimes     = new Array(RES_N).fill(-999);
    let   resHead      = 0;
    let   nextResTrigger = rand(1.8, 3.5);

    const pUniforms = {
        u_time:    { value: 0 },
        u_intro:   { value: 0 },
        u_density: { value: 0 },
        u_resPos:  { value: resPositions },
        u_resTime: { value: resTimes },
        // #7 波と粒の二重性: 観測者の位置
        u_mouseWorld: { value: new THREE.Vector3(0, 0, 50) },
        u_sphereYY:   { value: new THREE.Vector3(-2.5, 0, 0) },
        u_sphereRC:   { value: new THREE.Vector3(2.5, 0, 0) },
        // P2→P3遷移: パーティクル吸引
        u_attract:       { value: 0 },
        u_attractTarget: { value: new THREE.Vector3(2.5, 0, 0) },
        // rc101クリック時: パーティクルRGBCMY変色
        u_rainbowMix:    { value: 0 }
    };
    const pMat = new THREE.ShaderMaterial({
        vertexShader: pVert, fragmentShader: pFrag,
        uniforms: pUniforms,
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending
    });
    const particleMesh = new THREE.Mesh(pGeo, pMat);
    scene.add(particleMesh);

    // Fix: Constellation lines geometry was allocated but never added to scene
    // (scene.add was already commented out). Commented out entire block to avoid
    // wasting memory on unused geometry and material.
    /*
    // ── 星座ライン (近接パーティクルを繋ぐ・静的ネットワーク → P3の予兆) ──
    {
        const LINE_N = 700, LINE_DIST2 = 3.2 * 3.2, LINE_MAX = 450;
        const lineVerts = [];
        outer: for (let i = 0; i < LINE_N; i++) {
            const ax = bWPos[i*4*3], ay = bWPos[i*4*3+1], az = bWPos[i*4*3+2];
            for (let j = i + 1; j < LINE_N; j++) {
                if (lineVerts.length / 6 >= LINE_MAX) break outer;
                const bx = bWPos[j*4*3], by = bWPos[j*4*3+1], bz = bWPos[j*4*3+2];
                const dx = ax-bx, dy = ay-by, dz = az-bz;
                if (dx*dx + dy*dy + dz*dz < LINE_DIST2) {
                    lineVerts.push(ax, ay, az, bx, by, bz);
                }
            }
        }
        const lGeo = new THREE.BufferGeometry();
        lGeo.setAttribute('position',
            new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
        const lMat = new THREE.LineBasicMaterial({
            color: 0x004422, transparent: true, opacity: 0.35,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        const constellationLines = new THREE.LineSegments(lGeo, lMat);
        // scene.add(constellationLines);
    }
    */

    // ══════════════════════════════════════════════════════════════
    //  STEP 2: 陰陽太極図 3D球体 (50%)
    //
    //  - ShaderMaterial: 球面UV座標でS字陰陽パターンをGLSL描画
    //  - ゆっくりY軸回転 (0.2 rad/s)
    //  - 暗い緑の環境光 (コードの世界)
    //  - ホバー: scale 1.0→1.1, グレーの光輪, 周囲の0/1が落ち着く
    //  - クリック: 0に収束→球体に吸い込み→グレーフェード→別URL
    // ══════════════════════════════════════════════════════════════

    // Fix: Both spheres (YY/RC) use ShaderMaterial which ignores Three.js lights entirely.
    // These lights have no effect — commented out to avoid wasted GPU overhead.
    // scene.add(new THREE.AmbientLight(0x111122, 0.6));
    // const cyanPt = new THREE.PointLight(0x00cccc, 0.35, 18);
    // cyanPt.position.set(-3, 3, 5);
    // scene.add(cyanPt);
    // const magPt = new THREE.PointLight(0xcc00cc, 0.35, 18);
    // magPt.position.set(3, 3, 5);
    // scene.add(magPt);
    // const topPt = new THREE.PointLight(0x888899, 0.25, 25);
    // topPt.position.set(0, 5, 4);
    // scene.add(topPt);

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
    // #8 鏡の部屋: フレネル反射にRGBCMY虹色を映す
    //   「50%のグレーの中に全色が隠れている」を視覚化
    const yyFrag = `
precision highp float;
uniform float u_hover;
uniform float u_clickT;
uniform float u_time;
varying vec3 vNormal;
varying vec3 vViewDir;

void main(){
    vec3 N  = normalize(vNormal);
    float xf = N.x;
    float yf = N.y;

    // ── 陰陽 S字カーブ ──
    float xBound;
    if (yf >= 0.0) {
        xBound = -sqrt(max(0.0, 0.25 - (yf - 0.5)*(yf - 0.5)));
    } else {
        xBound = sqrt(max(0.0, 0.25 - (yf + 0.5)*(yf + 0.5)));
    }
    float pat = smoothstep(-0.018, 0.018, xf - xBound);

    // ── 魚眼 ──
    float R_EYE = 0.17;
    float dUp = length(vec2(xf, yf - 0.5));
    float dDn = length(vec2(xf, yf + 0.5));
    float inUp = smoothstep(R_EYE + 0.018, R_EYE - 0.018, dUp);
    float inDn = smoothstep(R_EYE + 0.018, R_EYE - 0.018, dDn);
    pat = mix(pat, 0.0, inUp);
    pat = mix(pat, 1.0, inDn);

    vec3 baseCol = vec3(pat);

    // ライティング
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(vec3(0.2, 0.6, 1.0));
    float diff = max(dot(N, L), 0.0) * 0.5 + 0.5;

    // #8 鏡の部屋: フレネルにRGBCMY虹色を映す
    //   50%の球の縁に101%の世界（RGBCMY）が映り込む
    //   = 「グレーの中に虹がある」のビジュアル化
    float fr = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    // 球面角度でRGBCMY 6色を配置 (atan2で角度)
    float angle = atan(N.y, N.x) + u_time * 0.15;
    float seg = mod(angle / 6.28318 * 6.0 + 6.0, 6.0);
    vec3 frColor;
    if(seg < 1.0)      frColor = mix(vec3(1.,0.,0.), vec3(0.,1.,0.), fract(seg));   // R→G
    else if(seg < 2.0) frColor = mix(vec3(0.,1.,0.), vec3(0.,0.,1.), fract(seg));   // G→B
    else if(seg < 3.0) frColor = mix(vec3(0.,0.,1.), vec3(0.,1.,1.), fract(seg));   // B→C
    else if(seg < 4.0) frColor = mix(vec3(0.,1.,1.), vec3(1.,0.,1.), fract(seg));   // C→M
    else if(seg < 5.0) frColor = mix(vec3(1.,0.,1.), vec3(1.,1.,0.), fract(seg));   // M→Y
    else               frColor = mix(vec3(1.,1.,0.), vec3(1.,0.,0.), fract(seg));   // Y→R

    float frStr = 0.3 + u_hover * 1.2;
    vec3 fresnel = frColor * fr * frStr;

    // リムライト: 球体の輪郭を強く光らせる
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 rimLight = vec3(0.6, 0.7, 0.8) * rim * 0.5;

    // ホバー時: レインボーフレネル + リム強化
    vec3 hoverGlow = frColor * fr * u_hover * 0.5;
    rimLight += vec3(1.0) * rim * u_hover * 0.8;

    vec3 col = baseCol * diff + fresnel + hoverGlow + rimLight;
    col = mix(col, vec3(1.0), u_clickT * 0.8);

    gl_FragColor = vec4(col, 1.0);
}`.trim();

    const yyUni = { u_hover:{value:0}, u_clickT:{value:0}, u_time:{value:0} };
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

    // ── CRT scanline overlay (P2は暗いテーマのため低opacity) ──
    // Fix: Old version used rgba(0,0,0,0.04) + mix-blend-mode:multiply which is invisible
    // on black backgrounds (black * anything = black). Changed to bright scanlines with screen blend.
    // old: background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px);
    // old: mix-blend-mode:multiply;
    const crtOverlay = document.createElement('div');
    crtOverlay.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9999;
        background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.015) 2px,rgba(255,255,255,0.015) 4px);
        mix-blend-mode:screen;`;
    document.body.appendChild(crtOverlay);

    // ── Digital glitch timer initialization ──
    window._p2GlitchNext = performance.now() + 5000 + Math.random() * 10000;

    function makeLabel(leftPct, bigText, subText, subStyle) {
        const w = document.createElement('div');
        w.style.cssText = `position:absolute;left:${leftPct}%;top:60%;transform:translateX(-50%);
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

    const lblYY = makeLabel(20, '50%', 'inRYOKÜ', {
        background: 'linear-gradient(90deg,#0ff,#f0f,#ff0,#f00,#0f0,#00f,#0ff)',
        backgroundSize: '200% 100%',
        webkitBackgroundClip: 'text',
        webkitTextFillColor: 'transparent',
        animation: 'p2rbflow 3s linear infinite'
    });
    // '50%' big text: グレー→レインボー (50%=グレー=全色の集合 の哲学)
    Object.assign(lblYY.big.style, {
        background: 'linear-gradient(90deg, #888 0%, #f66 15%, #fa0 30%, #ff0 45%, #0f8 60%, #4af 75%, #88f 88%, #888 100%)',
        backgroundSize: '300% 100%',
        webkitBackgroundClip: 'text',
        webkitTextFillColor: 'transparent',
        animation: 'p2graybow 7s linear infinite',
        fontSize: '22px'
    });

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
        @keyframes p2graybow {
            0%   { background-position: 0%   50%; }
            100% { background-position: 300% 50%; }
        }
    `;
    document.head.appendChild(p2css);

    // ── RGBCMY フラグメントシェーダー ──
    // #8 鏡の部屋: フレネル反射にモノクロ（グレー＝50%）を映す
    //   「101%の虹の縁に50%のグレーが映る」
    //   = 両方の視点は同じものの異なる見え方
    const rcFrag = `
precision highp float;
uniform float u_time;
uniform float u_hover;
uniform float u_clickT;
uniform float u_morph;
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

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(vec3(0.5, 0.7, 1.0));

    float diff    = max(dot(N, L), 0.0);
    float ambient = 0.05;

    // Blinn-Phong スペキュラ
    vec3  H    = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 72.0) * 0.85;

    // #8 鏡の部屋: フレネルをモノクロ（グレー＝50%の世界）に
    //   虹の球の縁に「もう一つの視点」＝グレーが映る
    //   ホバーするとグレーが明るくなる（陰陽球を意識する）
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 1.8);
    float frStr   = 2.2 + u_hover * 1.5 + u_clickT * 2.0;
    // モノクロ反射: 白〜グレーのグラデーション
    float greyVal = 0.55 + 0.15 * sin(u_time * 0.3);
    vec3  frCol   = vec3(greyVal) * fresnel * frStr;

    // 内側発光
    float emissive = 0.08 + u_hover * 0.18 + u_clickT * 0.45;

    // リムライト: 球体を背景から際立たせる
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    vec3 rimLight = result * rim * 0.6 + vec3(0.3, 0.4, 0.5) * rim * 0.3;
    rimLight += result * rim * u_hover * 0.5;

    vec3 col = result * (ambient + diff * 0.90)
             + result * emissive
             + frCol
             + vec3(spec)
             + rimLight;
    col = mix(col, vec3(1.0), u_clickT * 0.5);

    // ── P2→P3 モーフ: RGBCMY → ホログラフィック灰 ──
    if (u_morph > 0.0) {
        // 虹色がグレーに収束しながら、縁にオーロラ残光
        float grey = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 holoGrey = vec3(grey) * (0.8 + 0.2 * sin(u_time * 2.0));
        // フレネル縁にオーロラ（虹の名残）
        float fr = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.5);
        vec3 aurora = vec3(
            0.5 + 0.5 * sin(u_time * 1.3 + fr * 6.28),
            0.5 + 0.5 * sin(u_time * 1.7 + fr * 6.28 + 2.094),
            0.5 + 0.5 * sin(u_time * 2.1 + fr * 6.28 + 4.189)
        );
        holoGrey += aurora * fr * 0.4 * (1.0 - u_morph * 0.25);
        col = mix(col, holoGrey, u_morph);
    }

    gl_FragColor = vec4(col, 1.0);
}`.trim();

    const rcUni  = { u_time:{value:0}, u_hover:{value:0}, u_clickT:{value:0}, u_morph:{value:0} };
    const rcMat  = new THREE.ShaderMaterial({
        vertexShader: sVert, fragmentShader: rcFrag,
        uniforms: rcUni
    });
    const rcSphere = new THREE.Mesh(sphereGeo.clone(), rcMat);
    rcSphere.position.set(2.5, 0, 0);
    scene.add(rcSphere);

    // ── inryokü レインボーラベル ──
    const lblRC = makeLabel(80, '101%', 'inryokü', {
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
        if (!window._inryokuMuted && audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    // ── アンビエント (明るいパッド + シマー) ──
    let ambGain = null;
    function startAmbient() {
        if (ambGain) return;
        const ctx = getCtx();
        ambGain = ctx.createGain();
        ambGain.gain.setValueAtTime(0, ctx.currentTime);
        ambGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3.0);
        ambGain.connect(ctx.destination);

        // Aメジャー系パッド: A2(110) + E3(164.81) + A3(220) — 明るく広がる和音
        [110, 164.81, 220].forEach((f, i) => {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
            const g = ctx.createGain(); g.gain.value = [0.35, 0.25, 0.18][i];
            o.connect(g); g.connect(ambGain); o.start();
        });

        // 高域シマー: 微かなきらめき感 (ハイパスノイズ)
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.005;
        const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
        const nf = ctx.createBiquadFilter();
        nf.type = 'highpass'; nf.frequency.value = 3000; nf.Q.value = 0.3;
        ns.connect(nf); nf.connect(ambGain); ns.start();
    }
    function stopAmbient(fadeT = 1.0) {
        if (!ambGain || !audioCtx) return;
        ambGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeT);
        // #10 サウンドスケープもフェードアウト
        if (scapeGain) {
            scapeGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeT);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  #10 サウンドスケープ: マウス位置で空間音響
    //
    //  左 (陰陽球側): Am コード (A3:220, C4:261.63, E4:329.63) = 物質
    //  右 (RGBCMY球側): A major コード (A4:440, C#5:554.37, E5:659.25) = 精神
    //  中央: グレーコード (全6音 = 50%)
    //  静寂から始まり、マウスが左右に移動するほど音が聞こえる
    // ══════════════════════════════════════════════════════════════
    let scapeGain = null;
    let scapeAmGains = [];  // Am chord gains (3)
    let scapeMajGains = []; // A major chord gains (3)
    let scapeStarted = false;

    function startSoundscape() {
        if (scapeStarted) return;
        scapeStarted = true;
        const ctx = getCtx();

        // マスターゲイン (静寂から始まる)
        scapeGain = ctx.createGain();
        scapeGain.gain.setValueAtTime(0, ctx.currentTime);
        scapeGain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 4.0);
        scapeGain.connect(ctx.destination);

        // Dmaj7 コード (物質・CMY — 温かく開放的): D4, F#4, A4, C#5
        const amFreqs = [293.66, 369.99, 440, 554.37];
        amFreqs.forEach(f => {
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = 0;
            o.connect(g);
            g.connect(scapeGain);
            o.start();
            scapeAmGains.push(g);
        });

        // Amaj9 コード (精神・RGB — 輝く開放感): A4, C#5, E5, B5
        const majFreqs = [440, 554.37, 659.25, 987.77];
        majFreqs.forEach(f => {
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = 0;
            o.connect(g);
            g.connect(scapeGain);
            o.start();
            scapeMajGains.push(g);
        });
    }

    // マウスXで各コードの音量を制御
    // mouseNDC.x: -1 (左=陰陽) → 0 (中央=グレー) → +1 (右=RGBCMY)
    function updateSoundscape() {
        if (!scapeStarted || !audioCtx || audioCtx.state === 'suspended') return;
        const mx = mouseNDC.x; // -1 to +1
        const now = audioCtx.currentTime;

        // Am (左側) = マウスが左にあるほど大きい
        // A major (右側) = マウスが右にあるほど大きい
        // 中央ではどちらも50%音量 = グレーコード（全6音）
        const amVol  = Math.max(0, 1.0 - mx) * 0.5;  // 左で1.0, 中央で0.5, 右で0
        const majVol = Math.max(0, 1.0 + mx) * 0.5;   // 左で0, 中央で0.5, 右で1.0

        scapeAmGains.forEach(g => {
            g.gain.linearRampToValueAtTime(amVol * 0.33, now + 0.1);
        });
        scapeMajGains.forEach(g => {
            g.gain.linearRampToValueAtTime(majVol * 0.33, now + 0.1);
        });
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
            // 5度和音 (安定感+明るさ): A4+E5
            [440, 659.25].forEach(f => {
                const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
                const og = ctx.createGain(); og.gain.value = 0.5;
                o.connect(og); og.connect(g); o.start();
                setTimeout(() => { try { o.stop(); } catch(e) {} }, 600);
            });
        } else {
            // Amaj7 コード (きらめき・101%): A4, C#5, E5, G#5
            [440, 554.37, 659.25, 830.61].forEach(f => {
                const o  = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
                const og = ctx.createGain(); og.gain.value = 0.25;
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

    // ── 共鳴音 (波紋が発生した位置に応じた微かなチャイム) ──
    function playResonance(x, y) {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        const ctx = audioCtx, now = ctx.currentTime;
        // 位置でピッチが変わる（ペンタトニック音階で明るく）
        const pentatonic = [440, 495, 556.88, 660, 742.5, 880, 990]; // A pentatonic
        const idx = Math.floor((Math.abs(x) * 3 + Math.abs(y) * 2) % pentatonic.length);
        const freq = pentatonic[idx];
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.022, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
        g.connect(ctx.destination);
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = freq;
        // ハーモニクス (倍音で豊かに)
        const o2 = ctx.createOscillator();
        o2.type = 'sine'; o2.frequency.value = freq * 2.01;
        const g2 = ctx.createGain(); g2.gain.value = 0.28;
        o2.connect(g2); g2.connect(g);
        o.connect(g); o.start(now); o2.start(now);
        setTimeout(() => {
            try { o.stop(); o2.stop(); } catch(e) {}
        }, 1700);
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
            stopAmbient(2.5); playSelect('rc101');
        }
    });

    // ── レンダーループ ──
    const DENSITY_START = 0.3, DENSITY_FULL = 2.5;
    const SPHERE_SHOW = 2.8, SPHERE_FULL = 3.8;
    let lastTime = performance.now();
    let sA = 0; // 球体フェードイン [0,1]

    // Fix: Cache Vector3 to avoid per-frame allocation in render loop
    const _tempVec3 = new THREE.Vector3();

    (function loop(){
        if (!alive) return;
        requestAnimationFrame(loop);
        const now = performance.now();
        const dt  = Math.min((now - lastTime) / 1000, 0.05);
        lastTime  = now;
        globalTime += dt;

        // カメラ: 前後揺れ + FOVブリージング (呼吸する視野角)
        camera.position.z = 8.0 + Math.sin(globalTime * 0.28) * 0.18;
        camera.fov = 60 + Math.sin(globalTime * 0.22) * 3.5;
        camera.updateProjectionMatrix();

        // 共鳴イベント: ランダムな間隔で波紋を発生させる
        nextResTrigger -= dt;
        if (nextResTrigger <= 0 && globalTime > 1.0) {
            const rx = randNormal(0, 7), ry = randNormal(0, 5);
            const rz = rand(-45, -5);
            resPositions[resHead].set(rx, ry, rz);
            resTimes[resHead] = globalTime;
            resHead = (resHead + 1) % RES_N;
            nextResTrigger = rand(2.2, 4.8);
            if (audioCtx) playResonance(rx, ry);
        }

        // #7 波と粒の二重性: マウスのワールド座標を計算
        //   NDC → カメラレイ → z=0平面との交点
        {
            // old: const ray = new THREE.Vector3(mouseNDC.x, mouseNDC.y, 0.5);
            const ray = _tempVec3.set(mouseNDC.x, mouseNDC.y, 0.5);
            ray.unproject(camera);
            ray.sub(camera.position).normalize();
            // z=0平面との交点を求める
            const t_plane = -camera.position.z / ray.z;
            if (t_plane > 0) {
                pUniforms.u_mouseWorld.value.set(
                    camera.position.x + ray.x * t_plane,
                    camera.position.y + ray.y * t_plane,
                    0
                );
            }
        }

        // パーティクル
        const dT = Math.max(0, Math.min(1,
            (globalTime - DENSITY_START) / (DENSITY_FULL - DENSITY_START)));
        pUniforms.u_time.value    = globalTime;
        pUniforms.u_intro.value   = Math.min(1.0, globalTime / 2.2);
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

            // ── Phase A (0〜1.5s): 球が加速回転、パーティクルが吸い寄せられ始める ──
            rcSphere.rotation.y += dt * (0.5 + ct * 8);
            rcUni.u_clickT.value = Math.min(1, ct / 1.2);

            if (ct < 1.5) {
                // パーティクル吸引開始: 緩やかに → 強く
                const attract = Math.min(1, ct / 1.5);
                pUniforms.u_attract.value = attract * attract * 0.6; // ease-in
                // パーティクルRGBCMY変色: 0→1 (ease-out)
                const rbT = Math.min(1, ct / 1.2);
                pUniforms.u_rainbowMix.value = 1.0 - (1.0 - rbT) * (1.0 - rbT);
                // 球が脈動するように拡大
                const pulse = 1.0 + Math.sin(ct * 12) * 0.05 * attract;
                rcSphere.scale.setScalar(sA * pulse * (1.0 + attract * 0.3));
                // 陰陽球もフェードアウト
                const yyFade = Math.max(0, 1.0 - ct / 1.2);
                yySphere.scale.setScalar(sA * yyFade);
                lblYY.wrap.style.opacity = String(sA * yyFade);
                lblRC.wrap.style.opacity = String(sA * Math.max(0, 1.0 - ct / 1.5));
            }

            // ── Phase B (1.5〜3.0s): パーティクルが球に完全吸収、球がRGBCMY閃光 ──
            if (ct >= 1.5 && ct < 3.0) {
                const p = (ct - 1.5) / 1.5;
                pUniforms.u_attract.value = 0.6 + p * 0.4; // 完全吸引
                // パーティクル密度を下げる（球に吸収されていく）
                pUniforms.u_density.value *= (1.0 - p * 0.7);
                // 球が膨張
                const scale = 1.3 + p * 1.5;
                rcSphere.scale.setScalar(sA * scale);
                rcSphere.rotation.y += dt * 30 * p; // 超高速回転
                // 陰陽球は消滅
                yySphere.scale.setScalar(0);
                // RGBCMYレインボー回転グラデーション（フェードオーバーレイ）
                if (p > 0.4) {
                    const oP = (p - 0.4) / 0.6;
                    const hue = Math.floor((ct * 180) % 360);
                    fadeOv.style.background =
                        `conic-gradient(from ${hue}deg, #f00, #0f0, #00f, #0ff, #f0f, #ff0, #f00)`;
                    fadeOv.style.opacity = String(oP * 0.7);
                }
            }

            // ── Phase C (3.0〜5.5s): 球が中央に収束→縮小、RGBCMY→ホログラム灰にモーフ ──
            if (ct >= 3.0 && ct < 5.5) {
                const p = (ct - 3.0) / 2.5; // 0→1 over 2.5s
                const ease = p * p * (3 - 2 * p); // smoothstep
                // パーティクル完全消滅
                pUniforms.u_density.value = 0;
                // 球が中央(0,0)に移動しながら縮小
                const shrink = Math.max(0.25, 1.0 - ease * 0.75);
                rcSphere.scale.setScalar(sA * 2.8 * shrink);
                // 位置を(2.5,0)→(0,0)に移動
                rcSphere.position.x = 2.5 * (1.0 - ease);
                rcSphere.position.y = 0;
                rcSphere.rotation.y += dt * (30 - ease * 27); // 回転減速→ゆっくり
                // RGBCMY→ホログラフィック灰にシェーダーモーフ
                rcUni.u_morph.value = ease;
                // 虹→黒背景
                if (p < 0.3) {
                    const hue = Math.floor((ct * 240) % 360);
                    fadeOv.style.background =
                        `conic-gradient(from ${hue}deg, #f00, #0f0, #00f, #0ff, #f0f, #ff0, #f00)`;
                    fadeOv.style.opacity = String(0.7 * (1.0 - p / 0.3));
                } else {
                    // 黒にフェード
                    const blackP = (p - 0.3) / 0.7;
                    fadeOv.style.background = '#000';
                    fadeOv.style.opacity = String(blackP);
                }
            }

            // ── Phase D (5.5s〜): WebGLレンダラーを生かしたまま P3 起動 ──
            if (ct >= 5.5) {
                // パーティクル・陰陽球・ラベル・オーディオをクリーンアップ
                pUniforms.u_density.value = 0;
                yySphere.scale.setScalar(0);
                lblYY.wrap.style.display = 'none';
                lblRC.wrap.style.display = 'none';
                overlay.style.display = 'none';
                crtOverlay.style.display = 'none';

                // レンダラー・球体を生かしたままブリッジを公開
                // P3がこのブリッジを使って球体をアニメーション＆最終クリーンアップする
                window._p2Bridge = {
                    renderer: renderer,
                    scene: scene,
                    camera: camera,
                    sphere: rcSphere,
                    uni: rcUni,
                    // P3がクリーンアップする用
                    disposables: { pGeo, pMat, sphereGeo, yyMat, rcMat, overlay, fadeOv, crtOverlay, p2css },
                    dispose: function() {
                        alive = false;
                        stopAmbient(2.8);
                        setTimeout(() => { if (audioCtx) { audioCtx.close(); audioCtx = null; } }, 3200);
                        pGeo.dispose(); pMat.dispose();
                        sphereGeo.dispose(); yyMat.dispose(); rcMat.dispose();
                        renderer.dispose(); renderer.domElement.remove();
                        overlay.remove(); crtOverlay.remove(); p2css.remove();
                        fadeOv.remove();
                        document.body.style.cursor = '';
                        window._p2Bridge = null;
                    }
                };

                // P2完了イベント発火（レンダラーはまだ生きている）
                window.dispatchEvent(new CustomEvent('inryoku:p2complete'));

                // P2のレンダーループは球を回し続ける（P3がdisposeするまで）
                // ただし clickState をクリアして Phase C/D に再入しない
                clickState = null;
                return;
            }

        } else {
            // 通常回転 + 微小な浮遊（ラベルと被らない範囲）
            yySphere.rotation.y += dt * 0.3;
            yySphere.rotation.x = Math.sin(globalTime * 0.4) * 0.06;
            yySphere.position.y = 0.15 + Math.sin(globalTime * 0.6) * 0.06;
            yySphere.position.x = -2.5;

            rcSphere.rotation.y += dt * 0.4;
            rcSphere.rotation.x = Math.cos(globalTime * 0.5) * 0.06;
            rcSphere.position.y = 0.15 + Math.sin(globalTime * 0.7 + 1.5) * 0.06;
            rcSphere.position.x = 2.5;
        }

        // ── ホバー検出 ──
        if (!clickState && sA > 0.5) {
            raycaster.setFromCamera(mouse3D, camera);
            hovYY = raycaster.intersectObject(yySphere).length > 0;
            hovRC = raycaster.intersectObject(rcSphere).length > 0;
        } else if (!clickState) { hovYY = hovRC = false; }

        // アンビエント起動 (球体が見え始めたら)
        if (sA > 0.1 && !ambGain) startAmbient();
        // #10 サウンドスケープ起動 (球体が完全に見えてから)
        if (sA > 0.7 && !scapeStarted) startSoundscape();
        updateSoundscape();

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

        // ラベル変化 (gradientテキストはopacityで明暗)
        lblYY.big.style.opacity    = hovYY ? '1.0' : '0.65';
        lblYY.big.style.textShadow = hovYY
            ? '0 0 18px rgba(100,255,180,0.5)' : 'none';
        lblRC.big.style.color      = hovRC ? '#ffffff' : '#aaaaaa';
        lblRC.big.style.textShadow = hovRC
            ? '0 0 15px #fff, 0 0 35px rgba(255,100,255,0.7)' : 'none';

        document.body.style.cursor = (hovYY || hovRC) ? 'pointer' : '';

        // ── Digital glitch effect (reusable divs, HSL thin lines) ──
        if (!window._p2GlitchDivs) {
            window._p2GlitchDivs = [];
            for (let gi = 0; gi < 4; gi++) {
                const gd = document.createElement('div');
                gd.style.cssText = 'position:fixed;left:0;width:100%;pointer-events:none;z-index:9998;mix-blend-mode:screen;display:none;';
                document.body.appendChild(gd);
                window._p2GlitchDivs.push(gd);
            }
            window._p2GlitchIdx = 0;
            window._p2GlitchNext = performance.now() + 5000 + Math.random() * 10000;
        }
        if (performance.now() > window._p2GlitchNext) {
            window._p2GlitchNext = performance.now() + 5000 + Math.random() * 10000;
            const lineCount = 2 + Math.floor(Math.random() * 3); // 2-4 lines
            for (let li = 0; li < lineCount; li++) {
                const gd = window._p2GlitchDivs[window._p2GlitchIdx % 4];
                window._p2GlitchIdx++;
                const y = Math.random() * window.innerHeight;
                const h = 1 + Math.random() * 1; // 1-2px thin
                const hue = Math.floor(Math.random() * 360);
                gd.style.top = y + 'px';
                gd.style.height = h + 'px';
                gd.style.background = 'hsla(' + hue + ',100%,60%,0.18)';
                gd.style.display = 'block';
                setTimeout(() => { gd.style.display = 'none'; }, 100 + Math.random() * 100);
            }
        }

        renderer.render(scene, camera);
    })();

    function dispose(){
        alive = false;
        stopAmbient(0.2);
        setTimeout(() => { if (audioCtx) { audioCtx.close(); audioCtx = null; } }, 400);
        pGeo.dispose(); pMat.dispose();
        sphereGeo.dispose(); yyMat.dispose(); rcMat.dispose();
        renderer.dispose(); renderer.domElement.remove();
        overlay.remove(); fadeOv.remove(); crtOverlay.remove(); p2css.remove();
        if (window._p2GlitchDivs) { window._p2GlitchDivs.forEach(d => d.remove()); window._p2GlitchDivs = null; }
        document.body.style.cursor = '';
    }
    function completeP2(){
        // Phase D のブリッジ経由で遷移する場合、この関数は直接呼ばない
        // （_p2Bridge.dispose() を P3 が呼ぶ）
        // フォールバック用に残す
        if (window._p2Bridge) return; // ブリッジ使用中は何もしない
        alive = false;
        stopAmbient(2.8);
        setTimeout(() => { if (audioCtx) { audioCtx.close(); audioCtx = null; } }, 3200);
        pGeo.dispose(); pMat.dispose();
        sphereGeo.dispose(); yyMat.dispose(); rcMat.dispose();
        renderer.dispose(); renderer.domElement.remove();
        overlay.remove(); fadeOv.remove(); crtOverlay.remove(); p2css.remove();
        if (window._p2GlitchDivs) { window._p2GlitchDivs.forEach(d => d.remove()); window._p2GlitchDivs = null; }
        document.body.style.cursor = '';
        window.dispatchEvent(new CustomEvent('inryoku:p2complete'));
    }
    window._p2 = { dispose, completeP2 };
}
