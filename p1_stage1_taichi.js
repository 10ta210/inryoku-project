// 2026-05-17 P1 拡張シーン Stage 1: 太極球 → グレー溶解
// Scene A (0.0–1.2s): 陰陽パターンが球面に出現・回転
// Scene B (1.2–2.8s): 境界が溶けてグレーに侵食、リム虹干渉
// 2.8s 以降: グレー球を保持し、次のステージを待つ
// 2026-05-17 段階2: Scene C (2.8–4.2s) — グレー球が同一メッシュのまま
//   RGBCMY 水滴オーブへ変容。6 metaball を球面に配置・field blend。
//   中心には微小な太極核を保持 (101% は 50% を否定しない)。
//   4.2s で inryoku:p1stage2complete 発火、以降は微呼吸＋色循環で保持。
// 2026-05-17 段階2.2: Codex リファクタ — 単一マテリアル uReveal 駆動モーフ
//   旧 Scene B + Scene C を MorphScene (1.2 → 4.2s, 3.0s) として統合。
//   基底マテリアル一つで taichi → grey → 内圧 → RGBCMY → 表面開花 を完結。
//   太極核は表面残像ではなく中心深層 (facing^5) のメモリ化。
//   rcSphere はブルームアシスタント (uAlpha ≤ 0.18, reveal>0.62 で出現)。
(function p1Stage1IIFE() {
    'use strict';
    if (typeof window === 'undefined') return;

    // prefers-reduced-motion 検出
    const REDUCE_MOTION = (typeof window.matchMedia === 'function')
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const SCENE_A_DUR = 1.2;
    const SCENE_B_DUR = 1.6; // 1.2 → 2.8 (旧定数、互換のため残置)
    const TOTAL_DUR   = SCENE_A_DUR + SCENE_B_DUR; // 2.8s (旧)
    // 2026-05-17 段階2: Scene C タイムライン (旧、互換のため残置)
    const STAGE2_START   = 2.8;
    const STAGE2_RAMP_IN = 2.95;
    const STAGE2_RAMP_END = 4.0;
    const STAGE2_END      = 4.2; // settle 完了 → イベント発火

    // 2026-05-17 段階2.2: 新タイムライン (Codex)
    //   0.0 → 1.2s : Scene A (taichi 出現)
    //   1.2 → 4.2s : MorphScene (uReveal 0 → 1, easeInOutCubic)  ← 旧
    //   4.2s +    : Hold, rcSphere assistant 0.18, microbreath, event fire
    // 2026-05-17 段階2.4: Codex C' — 9s non-linear pacing curve + 1.5s 余韻
    //   0.0 → 1.2s : Scene A (taichi 出現)
    //   1.2 → 10.2s: MorphScene (uReveal 0 → 1, p101Curve 4-phase)
    //   10.2 → 11.7s: Hold (余韻)
    //   11.7s+     : fire inryoku:p1stage2complete
    const MORPH_START = 1.2;
    const MORPH_END   = 10.2;
    const HOLD_END    = 11.7;

    const RADIUS = 0.42;

    // ───────────────────────────────────────────────────────────────
    // 2026-05-17 段階2.1: P2/P3 rcSphere シェーダ移植
    //   段階2.2 でアシスタント (uAlpha ≤ 0.18) に降格。
    //   フラグメント本文は触らず、uAlpha クランプのみで補助役に。
    // ───────────────────────────────────────────────────────────────
    const RC_VERT = [
        'varying vec3 vNormal;',
        'varying vec3 vViewDir;',
        'varying vec2 vUv;',
        'void main(){',
        '    vec4 wPos = modelMatrix * vec4(position, 1.0);',
        '    vNormal  = normalize(normalMatrix * normal);',
        '    vViewDir = normalize(cameraPosition - wPos.xyz);',
        '    vUv      = uv;',
        '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
    ].join('\n');

    // P3 init3DLogoSphere の rcFrag (12極バリアント) と完全同一の本文。
    // uAlpha だけ追加して taichi ベースとブレンドできるようにする。
    const RC_FRAG = [
        'precision highp float;',
        'uniform float u_time;',
        'uniform float u_hover;',
        'uniform float u_clickT;',
        'uniform float u_morph;',
        'uniform float uAlpha;',
        'varying vec3 vNormal;',
        'varying vec3 vViewDir;',
        'varying vec2 vUv;',
        '',
        'float h1(float n){ return fract(sin(mod(n, 300.0) * 127.1) * 43758.545); }',
        'float noise3(vec3 p){',
        '    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.-2.*f);',
        '    float a = h1(i.x + i.y*57. + i.z*113.);',
        '    float b = h1(i.x+1. + i.y*57. + i.z*113.);',
        '    float c = h1(i.x + (i.y+1.)*57. + i.z*113.);',
        '    float d = h1(i.x+1. + (i.y+1.)*57. + i.z*113.);',
        '    float e = h1(i.x + i.y*57. + (i.z+1.)*113.);',
        '    float f2= h1(i.x+1. + i.y*57. + (i.z+1.)*113.);',
        '    float g = h1(i.x + (i.y+1.)*57. + (i.z+1.)*113.);',
        '    float hh= h1(i.x+1. + (i.y+1.)*57. + (i.z+1.)*113.);',
        '    return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),',
        '               mix(mix(e,f2,f.x),mix(g,hh,f.x),f.y),f.z);',
        '}',
        '',
        'void main(){',
        '    float phi   = vUv.x * 6.28318;',
        '    float theta = vUv.y * 3.14159;',
        '    vec3 sPos = vec3(sin(theta)*cos(phi), cos(theta), sin(theta)*sin(phi));',
        '    float spd = 0.21 + u_hover * 0.15 + u_clickT * 0.25;',
        '    float t   = u_time * spd;',
        '    vec3 nOff = vec3(',
        '        noise3(sPos * 2.5 + vec3(t,    0.,   0.)) * 2. - 1.,',
        '        noise3(sPos * 2.5 + vec3(0., t*0.8,  0.)) * 2. - 1.,',
        '        noise3(sPos * 2.5 + vec3(0.,   0., t*0.6))* 2. - 1.',
        '    );',
        '    vec3 wPos = normalize(sPos + nOff * 0.28);',
        '    vec3 dirs[12];',
        '    dirs[0]=vec3(1.,0.,0.); dirs[1]=vec3(-1.,0.,0.);',
        '    dirs[2]=vec3(0.,1.,0.); dirs[3]=vec3(0.,-1.,0.);',
        '    dirs[4]=vec3(0.,0.,1.); dirs[5]=vec3(0.,0.,-1.);',
        '    dirs[6]=normalize(vec3(1.,1.,0.));   dirs[7]=normalize(vec3(-1.,-1.,0.));',
        '    dirs[8]=normalize(vec3(0.,1.,1.));   dirs[9]=normalize(vec3(0.,-1.,-1.));',
        '    dirs[10]=normalize(vec3(1.,0.,1.));  dirs[11]=normalize(vec3(-1.,0.,-1.));',
        '    vec3 cols[12];',
        '    cols[0]=vec3(1.,0.,0.);       cols[1]=vec3(0.,1.,1.);',
        '    cols[2]=vec3(0.,1.,0.);       cols[3]=vec3(1.,0.,1.);',
        '    cols[4]=vec3(0.,0.,1.);       cols[5]=vec3(1.,1.,0.);',
        '    cols[6]=vec3(1.0,0.45,0.);    cols[7]=vec3(0.0,0.55,1.0);',
        '    cols[8]=vec3(0.0,1.0,0.6);    cols[9]=vec3(1.0,0.25,0.55);',
        '    cols[10]=vec3(0.75,0.25,1.); cols[11]=vec3(0.85,0.85,0.2);',
        '    vec3 result = vec3(0.); float total = 0.;',
        '    for(int i = 0; i < 12; i++){',
        '        float w = max(0., dot(wPos, dirs[i]));',
        '        w = w * w * w;',
        '        result += cols[i] * w; total += w;',
        '    }',
        '    result /= max(total, 0.001);',
        '    vec3 N = normalize(vNormal);',
        '    vec3 V = normalize(vViewDir);',
        '    vec3 L = normalize(vec3(0.5, 0.7, 1.0));',
        '    float diff    = max(dot(N, L), 0.0);',
        '    float ambient = 0.05;',
        '    vec3  H    = normalize(L + V);',
        '    float spec = pow(max(dot(N, H), 0.0), 72.0) * 0.18;',
        '    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 1.8);',
        '    float frStr   = 0.9 + u_hover * 0.8;',
        '    float greyVal = 0.45 + 0.10 * sin(u_time * 0.3);',
        '    vec3  frCol   = vec3(greyVal) * fresnel * frStr;',
        '    float emissive = 0.05 + u_hover * 0.10;',
        '    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);',
        '    vec3 rimLight = result * rim * 0.22 + vec3(0.3, 0.4, 0.5) * rim * 0.10;',
        '    rimLight += result * rim * u_hover * 0.18;',
        '    vec3 col = result * (ambient + diff * 0.90)',
        '             + result * emissive',
        '             + frCol',
        '             + vec3(spec)',
        '             + rimLight;',
        '    col = mix(col, vec3(1.0), u_clickT * 0.5);',
        '    if (u_morph > 0.0) {',
        '        float grey = dot(col, vec3(0.299, 0.587, 0.114));',
        '        vec3 holoGrey = vec3(grey) * (0.8 + 0.2 * sin(u_time * 2.0));',
        '        float fr = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.5);',
        '        vec3 aurora = vec3(',
        '            0.5 + 0.5 * sin(u_time * 1.3 + fr * 6.28),',
        '            0.5 + 0.5 * sin(u_time * 1.7 + fr * 6.28 + 2.094),',
        '            0.5 + 0.5 * sin(u_time * 2.1 + fr * 6.28 + 4.189)',
        '        );',
        '        holoGrey += aurora * fr * 0.4 * (1.0 - u_morph * 0.25);',
        '        col = mix(col, holoGrey, u_morph);',
        '    }',
        '    gl_FragColor = vec4(col, uAlpha);',
        '}'
    ].join('\n');

    const VERT = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        // 2026-05-17 段階1.2: ワールド空間出力 (本物の Fresnel 用)
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            vUv = uv;
            // 2026-05-17 段階1.2: ワールド空間座標と法線
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    // 2026-05-17 段階2.2: 単一マテリアル uReveal モーフ (Codex)
    //   uReveal 0 → 1 で taichi → grey → 内部圧 → 表面開花 → RGBCMY を一気通貫。
    //   旧 uColorBirth / uGreyMix / uPrism / uLiquid uniforms は宣言だけ残し
    //   後方互換 (現在は新ロジックが上書き)。
    const FRAG = `
        precision highp float;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        uniform vec3 uCameraPos;
        uniform float uTime;
        uniform float uTaichiMix;
        // ── 旧 uniforms (後方互換のため保持。新ロジックは uReveal 駆動) ──
        uniform float uGreyMix;
        uniform float uPrism;
        uniform float uColorBirth;
        uniform float uLiquid;
        // ── 新: 主駆動 ──
        uniform float uReveal; // 0 → 1

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        // 軽量 fbm: 3 オクターブの sin-noise (外部ライブラリ不使用)
        float hash31(vec3 p) {
            p = fract(p * vec3(0.1031, 0.1030, 0.0973));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
        }
        float vnoise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
            float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
            float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
            float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
            float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
            float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
            float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
            float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
            return mix(
                mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
                mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
                f.z
            );
        }
        float fbm(vec3 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 3; i++) {
                v += a * vnoise(p);
                p *= 2.02;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            // ── reveal から派生する段階マスク ──
            float greyMix     = smoothstep(0.00, 0.48, uReveal);
            float colorBirth  = smoothstep(0.38, 0.92, uReveal);
            float surfaceOpen = smoothstep(0.58, 1.00, uReveal);
            float coreRemain  = 0.18 * smoothstep(0.70, 1.00, uReveal);

            // ── Taichi → Grey ベース ──
            vec3 p = normalize(vPosition);
            float angle = atan(p.y, p.x);
            float s = sin(angle + sin(p.y * 3.8 + uTime * 0.4) * 0.32 + p.z * 0.7);
            float yin = smoothstep(-0.06, 0.06, s);
            vec3 taichi = mix(vec3(0.015), vec3(0.82), yin);
            vec3 grey   = vec3(0.50);
            vec3 base   = mix(taichi, grey, greyMix);

            // ── 内圧 (色が漏れ出る前駆) ──
            float n = fbm(p * 3.8 + uTime * 0.16);
            float innerPressure = smoothstep(0.25, 0.85, uReveal);
            float innerMask = smoothstep(0.34, 0.95, n + innerPressure * 0.58);

            // ── RGBCMY 6 メタボール (有機的に微オフセット) ──
            vec3 centers[6];
            centers[0] = normalize(vec3( 1.0,  0.2,  0.1)); // R
            centers[1] = normalize(vec3(-0.8,  0.7, -0.1)); // G
            centers[2] = normalize(vec3( 0.1, -1.0,  0.2)); // B
            centers[3] = normalize(vec3(-0.2,  0.1,  1.0)); // C
            centers[4] = normalize(vec3( 0.5, -0.4, -1.0)); // M
            centers[5] = normalize(vec3(-1.0, -0.2,  0.3)); // Y
            vec3 cols[6];
            cols[0] = vec3(1.0, 0.0, 0.0);
            cols[1] = vec3(0.0, 1.0, 0.0);
            cols[2] = vec3(0.0, 0.15, 1.0);
            cols[3] = vec3(0.0, 1.0, 1.0);
            cols[4] = vec3(1.0, 0.0, 1.0);
            cols[5] = vec3(1.0, 1.0, 0.0);
            float field = 0.0;
            vec3 colorSum = vec3(0.0);
            for (int i = 0; i < 6; i++) {
                float fi = float(i);
                vec3 c = normalize(centers[i] + 0.07 * vec3(
                    sin(uTime * 0.40 + fi),
                    cos(uTime * 0.33 + fi * 1.7),
                    sin(uTime * 0.27 + fi * 2.1)
                ));
                float d = length(p - c);
                float m = exp(-d * d * 5.2);
                field    += m;
                colorSum += cols[i] * m;
            }
            vec3 rgbcmy = colorSum / max(field, 0.001);

            // ── サブサーフェス (内側からの色漏れ) ──
            vec3 viewDir = normalize(uCameraPos - vWorldPos);
            float facing = max(dot(normalize(vWorldNormal), viewDir), 0.0);
            float fresnel = pow(1.0 - facing, 2.2);
            float subsurface = pow(1.0 - facing, 1.7) * 0.28 + pow(facing, 3.6) * 0.14;
            vec3 innerGlow = rgbcmy * innerMask * colorBirth * subsurface * 0.75;

            // ── 表面開花 ──
            float surfaceMask = innerMask * surfaceOpen;
            vec3 col = mix(base, rgbcmy, surfaceMask);
            col += innerGlow;

            // ── 中心深層の太極核 (記憶。表面残像ではない) ──
            float coreMask = pow(facing, 5.0) * coreRemain;
            vec3 hiddenTaichi = mix(vec3(0.03), vec3(0.88), yin);
            col = mix(col, hiddenTaichi, coreMask);

            // ── リムにニュートンリング風プリズム ──
            float boundary = 1.0 - smoothstep(0.0, 0.12, abs(s));
            float newton = 0.5 + 0.5 * sin((fresnel * fresnel) * 90.0 - uTime * 2.0);
            vec3 prism = hsv2rgb(vec3(fract(newton * 0.16 + angle * 0.08), 0.82, 1.0));
            col += prism * fresnel * (0.10 + colorBirth * 0.34);
            col += prism * boundary * (1.0 - greyMix) * 0.05;

            // ── 旧 alpha ロジック互換: taichi 出現スケール ──
            gl_FragColor = vec4(col * uTaichiMix, uTaichiMix);
        }
    `;

    // イージング
    function easeOutCubic(t) { return 1.0 - Math.pow(1.0 - t, 3.0); }
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    // 2026-05-17 段階2.4: easeOutExpo 追加 (跳躍フェーズ用)
    function easeOutExpo(x) {
        return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
    }
    function smoothstepJS(edge0, edge1, x) {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }

    // 2026-05-17 段階2.4: p101Curve (Codex C')
    //   4-phase: タメ(0-22%) → 内部上昇(22-72%) → 急跳躍(72-86%) → 101%余韻(86-100%)
    //   t は 0..1 (MorphScene 9.0s 全体に対する正規化時間)
    function p101Curve(t) {
        if (t < 0.22) {
            // 50% で止まっているように見えるタメ (0 → 0.05)
            return 0.05 * easeOutCubic(t / 0.22);
        }
        if (t < 0.72) {
            // 内部から色が増える (0.05 → 0.67)
            return 0.05 + 0.62 * easeInOutCubic((t - 0.22) / 0.50);
        }
        if (t < 0.86) {
            // 跳躍 (0.67 → 1.0)
            return 0.67 + 0.33 * easeOutExpo((t - 0.72) / 0.14);
        }
        // 101% 余韻
        return 1.0;
    }

    // 2026-05-17 段階2.4: milestone-based text snapping
    const P101_MILESTONES = [50, 51, 55, 64, 72, 88, 101];
    function nearestMilestone(pct) {
        let best = P101_MILESTONES[0];
        let bestD = Math.abs(best - pct);
        for (let i = 1; i < P101_MILESTONES.length; i++) {
            const d = Math.abs(P101_MILESTONES[i] - pct);
            if (d < bestD) { best = P101_MILESTONES[i]; bestD = d; }
        }
        return best;
    }

    let state = {
        mesh: null,
        mat:  null,
        geo:  null,
        scene: null,
        camera: null,
        renderer: null,
        startTime: 0,
        rafId: 0,
        running: false,
        disposed: false,
        hiddenLegacy: [],
        stage2Fired: false,
        rcMesh: null,
        rcMat:  null,
        rcGeo:  null,
        // 2026-05-17 段階2.4: 音声ガード/コンテキスト
        audioCtx: null,
        audioMaster: null,
        droneOsc: null,
        droneGain: null,
        harmOsc: null,
        harmGain: null,
        audio_droneFired: false,
        audio_harmFired: false,
        audio_duckFired: false,
        audio_arrivalFired: false,
        audio_fadedOut: false,
    };

    // Web Audio (オプション)
    function playEntranceTone() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 220;
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 1.3);

            const padOsc = ctx.createOscillator();
            const padOsc2 = ctx.createOscillator();
            const padGain = ctx.createGain();
            padOsc.type = 'sine';
            padOsc2.type = 'sine';
            padOsc.frequency.value = 220;
            padOsc2.frequency.value = 277.18;
            padGain.gain.setValueAtTime(0.0001, now + 2.8);
            padGain.gain.exponentialRampToValueAtTime(0.025, now + 4.0);
            padOsc.connect(padGain);
            padOsc2.connect(padGain);
            padGain.connect(ctx.destination);
            padOsc.start(now + 2.8);
            padOsc2.start(now + 2.8);
            padOsc.stop(now + 6.0);
            padOsc2.stop(now + 6.0);
        } catch (e) {}
    }

    // 2026-05-17 段階2.4: morph 用音声 (drone → harmonics → duck → arrival)
    function ensureMorphAudio() {
        if (state.audioCtx) return state.audioCtx;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            state.audioCtx = new Ctx();
            state.audioMaster = state.audioCtx.createGain();
            state.audioMaster.gain.value = 1.0;
            state.audioMaster.connect(state.audioCtx.destination);
        } catch (e) { state.audioCtx = null; }
        return state.audioCtx;
    }
    function startDrone() {
        const ctx = ensureMorphAudio(); if (!ctx) return;
        try {
            const now = ctx.currentTime;
            state.droneOsc = ctx.createOscillator();
            state.droneGain = ctx.createGain();
            state.droneOsc.type = 'sine';
            state.droneOsc.frequency.value = 220; // A3
            state.droneGain.gain.setValueAtTime(0.0001, now);
            state.droneGain.gain.exponentialRampToValueAtTime(0.10, now + 0.6);
            state.droneOsc.connect(state.droneGain).connect(state.audioMaster);
            state.droneOsc.start(now);
        } catch (e) {}
    }
    function startHarmonics() {
        const ctx = ensureMorphAudio(); if (!ctx) return;
        try {
            const now = ctx.currentTime;
            state.harmOsc = ctx.createOscillator();
            const harmOsc2 = ctx.createOscillator();
            state.harmGain = ctx.createGain();
            state.harmOsc.type = 'sine';
            harmOsc2.type = 'sine';
            state.harmOsc.frequency.value = 220;      // A
            harmOsc2.frequency.value = 277.18;        // C#4
            state.harmGain.gain.setValueAtTime(0.0001, now);
            state.harmGain.gain.exponentialRampToValueAtTime(0.08, now + 1.5);
            state.harmOsc.connect(state.harmGain);
            harmOsc2.connect(state.harmGain);
            state.harmGain.connect(state.audioMaster);
            state.harmOsc.start(now);
            harmOsc2.start(now);
        } catch (e) {}
    }
    function duckMaster() {
        if (!state.audioCtx || !state.audioMaster) return;
        try {
            const ctx = state.audioCtx;
            const now = ctx.currentTime;
            const cur = state.audioMaster.gain.value || 1.0;
            state.audioMaster.gain.cancelScheduledValues(now);
            state.audioMaster.gain.setValueAtTime(cur, now);
            state.audioMaster.gain.linearRampToValueAtTime(cur * 0.30, now + 0.04);
            state.audioMaster.gain.linearRampToValueAtTime(cur, now + 0.16);
        } catch (e) {}
    }
    function playArrivalChord() {
        const ctx = ensureMorphAudio(); if (!ctx) return;
        try {
            const now = ctx.currentTime;
            // RGBCMY → 6音: C4 D4 E4 F#4 G#4 A#4
            const freqs = [261.63, 293.66, 329.63, 369.99, 415.30, 466.16];
            const chordGain = ctx.createGain();
            chordGain.gain.setValueAtTime(0.0001, now);
            chordGain.gain.exponentialRampToValueAtTime(0.09, now + 0.05);
            chordGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
            chordGain.connect(state.audioMaster);
            for (let i = 0; i < freqs.length; i++) {
                const o = ctx.createOscillator();
                o.type = 'sine';
                o.frequency.value = freqs[i];
                o.connect(chordGain);
                o.start(now);
                o.stop(now + 1.0);
            }
        } catch (e) {}
    }
    function fadeOutAllAudio(durSec) {
        if (!state.audioCtx) return;
        try {
            const ctx = state.audioCtx;
            const now = ctx.currentTime;
            [state.droneGain, state.harmGain].forEach(function(g){
                if (!g) return;
                try {
                    const cur = g.gain.value || 0.001;
                    g.gain.cancelScheduledValues(now);
                    g.gain.setValueAtTime(Math.max(0.0001, cur), now);
                    g.gain.exponentialRampToValueAtTime(0.0001, now + durSec);
                } catch (e) {}
            });
            setTimeout(function(){
                try { if (state.droneOsc) state.droneOsc.stop(); } catch(e){}
                try { if (state.harmOsc)  state.harmOsc.stop();  } catch(e){}
            }, durSec * 1000 + 50);
        } catch (e) {}
    }

    function hideLegacyGreySphere(scene) {
        if (!scene || typeof scene.getObjectByName !== 'function') return;
        const names = ['p1-old-grey-sphere', 'p1-old-tunnel-plane', 'p1-old-halo-plane', 'p1-old-warp-tunnel'];
        names.forEach(function(n){
            var o = scene.getObjectByName(n);
            if (o && o.visible) {
                state.hiddenLegacy.push(o);
                o.visible = false;
            }
        });
    }

    function initStage1(detail) {
        if (state.running || state.disposed) return;
        if (!detail || !detail.scene || typeof THREE === 'undefined') {
            console.warn('[P1 stage1] missing scene or THREE');
            return;
        }

        state.scene = detail.scene;
        state.camera = detail.camera || null;
        state.renderer = detail.renderer || null;

        state.geo = new THREE.SphereGeometry(RADIUS, 64, 64);
        state.mat = new THREE.ShaderMaterial({
            vertexShader:   VERT,
            fragmentShader: FRAG,
            uniforms: {
                uTime:      { value: 0 },
                uTaichiMix: { value: 0 },
                uGreyMix:   { value: 0 }, // 旧互換
                uPrism:     { value: 0 }, // 旧互換
                uCameraPos: { value: new THREE.Vector3() },
                uColorBirth: { value: 0 }, // 旧互換
                uLiquid:     { value: 0 }, // 旧互換
                // 2026-05-17 段階2.2: 新主駆動
                uReveal:     { value: 0 },
            },
            transparent: true,
            depthWrite: false,
        });

        state.mesh = new THREE.Mesh(state.geo, state.mat);
        state.mesh.name = 'p1Stage1TaichiSphere';
        state.mesh.position.set(0, 0, 0.7);
        state.mesh.renderOrder = 999;
        state.mesh.scale.setScalar(REDUCE_MOTION ? 1 : 0.001);
        state.scene.add(state.mesh);

        // 2026-05-17 段階2.2: rcSphere はアシスタント (uAlpha ≤ 0.18)
        state.rcGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
        state.rcMat = new THREE.ShaderMaterial({
            vertexShader: RC_VERT,
            fragmentShader: RC_FRAG,
            uniforms: {
                u_time:   { value: 0 },
                u_hover:  { value: 0 },
                u_clickT: { value: 0 },
                u_morph:  { value: 0 },
                uAlpha:   { value: REDUCE_MOTION ? 0.18 : 0 },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        state.rcMesh = new THREE.Mesh(state.rcGeo, state.rcMat);
        state.rcMesh.name = 'p1Stage1RCSphere';
        state.rcMesh.position.set(0, 0, 0.69);
        state.rcMesh.renderOrder = 1000;
        state.rcMesh.scale.setScalar(REDUCE_MOTION ? 1 : 0.001);
        state.rcMesh.visible = REDUCE_MOTION; // 段階2.2: reveal>0.62 で表示
        state.scene.add(state.rcMesh);

        hideLegacyGreySphere(state.scene);

        if (!REDUCE_MOTION) playEntranceTone();

        state.startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        state.running = true;

        if (REDUCE_MOTION) {
            // 動きなし: 即時 reveal=1
            state.mat.uniforms.uTaichiMix.value  = 1;
            state.mat.uniforms.uReveal.value     = 1;
            // 互換: 旧 uniforms も最終値に
            state.mat.uniforms.uGreyMix.value    = 0.85;
            state.mat.uniforms.uPrism.value      = 1.0;
            state.mat.uniforms.uColorBirth.value = 1;
            state.mat.uniforms.uLiquid.value     = 1;
            // 2026-05-17 段階2.4: REDUCE_MOTION は 200ms 後に発火 (即発火だと挙動共有が不安定)
            state.stage2Fired = true;
            setTimeout(function() {
                try {
                    window.dispatchEvent(new CustomEvent('inryoku:p1stage2complete'));
                } catch (e) {}
            }, 200);
            return;
        }

        const tick = function(now) {
            if (!state.running || state.disposed) return;
            const t = ((now || performance.now()) - state.startTime) / 1000.0
                      * (window._p1FastForward || 1);
            updateStage(t);
            state.rafId = requestAnimationFrame(tick);
        };
        state.rafId = requestAnimationFrame(tick);
    }

    function updateStage(t) {
        if (!state.mat || !state.mesh) return;
        const u = state.mat.uniforms;
        u.uTime.value = t;
        if (state.camera && u.uCameraPos) {
            u.uCameraPos.value.copy(state.camera.position);
        }

        // 回転 ~12°/sec
        state.mesh.rotation.y = t * 0.2094;

        // ── Scene A (0.0 → 1.2s): taichi 出現 ──
        if (t < 0.4) {
            const p = easeOutCubic(t / 0.4);
            state.mesh.scale.setScalar(Math.max(0.001, p));
            u.uTaichiMix.value = p;
            u.uReveal.value    = 0;
        } else if (t < MORPH_START) {
            state.mesh.scale.setScalar(1);
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 0;
        } else if (t < MORPH_END) {
            // ── 2026-05-17 段階2.4: MorphScene (1.2 → 10.2s, 9.0s) ──
            //   p101Curve 4-phase (タメ → 内部上昇 → 急跳躍 → 余韻) で uReveal 駆動
            const raw = (t - MORPH_START) / (MORPH_END - MORPH_START);
            const reveal = p101Curve(Math.max(0, Math.min(1, raw)));
            // 微呼吸 (3%)
            const breath = 1.0 + 0.03 * Math.sin(raw * Math.PI);
            state.mesh.scale.setScalar(breath);
            u.uTaichiMix.value = 1;
            u.uReveal.value    = reveal;
        } else if (t < HOLD_END) {
            // ── 2026-05-17 段階2.4: Hold (10.2 → 11.7s) 1.5s 余韻 ──
            const hold = t - MORPH_END;
            state.mesh.scale.setScalar(1.0 + 0.008 * Math.sin(hold * 1.2));
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 1;
        } else {
            // ── 2026-05-17 段階2.4: 余韻終了 → 次ステージへ ──
            const hold = t - MORPH_END;
            state.mesh.scale.setScalar(1.0 + 0.008 * Math.sin(hold * 1.2));
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 1;
            if (!state.stage2Fired) {
                state.stage2Fired = true;
                // 高周波残響のみ残してフェードアウト
                if (!state.audio_fadedOut) {
                    state.audio_fadedOut = true;
                    fadeOutAllAudio(1.2);
                }
                try {
                    window.dispatchEvent(new CustomEvent('inryoku:p1stage2complete'));
                } catch (e) {}
            }
        }

        // 旧 uniforms を reveal から派生 (後方互換 — 他コードが参照しても破綻しないように)
        const rv = u.uReveal.value;
        u.uGreyMix.value    = Math.min(1, rv / 0.48) * 0.85;
        u.uPrism.value      = 0.3 + 0.9 * rv;
        u.uColorBirth.value = smoothstepJS(0.38, 0.92, rv);
        u.uLiquid.value     = smoothstepJS(0.45, 1.0, rv);

        // ── 2026-05-17 段階2.4: 音声キュー (drone → harmonics → duck → arrival) ──
        if (!REDUCE_MOTION) {
            if (!state.audio_droneFired && rv > 0.0 && rv < 0.05) {
                state.audio_droneFired = true;
                startDrone();
            }
            if (!state.audio_harmFired && rv > 0.25 && rv < 0.70) {
                state.audio_harmFired = true;
                startHarmonics();
            }
            if (!state.audio_duckFired && rv > 0.88 && rv < 1.0) {
                state.audio_duckFired = true;
                duckMaster();
            }
            if (!state.audio_arrivalFired && rv >= 1.0) {
                state.audio_arrivalFired = true;
                playArrivalChord();
            }
        }

        // ── 2026-05-17 段階2.3: ローディングバー morph 同期 ──
        // 50% → 101% を reveal で駆動。色も 陰陽 → グレー → RGBCMY と同期
        try {
            const barFill = document.getElementById('p1-lb');
            const pctEl   = document.getElementById('p1-lpct');
            if (barFill || pctEl) {
                const morphProg = 50 + rv * 51; // 50→101
                const pv = Math.round(morphProg);
                if (barFill) {
                    barFill.style.width = morphProg + '%';
                    if (rv < 0.04) {
                        // 50%: 陰陽 — 白黒ストライプ
                        barFill.style.background =
                            'repeating-linear-gradient(to right,' +
                            '#ffffff 0px,#ffffff 5px,#000000 5px,#000000 10px)';
                    } else if (rv < 1.0) {
                        // 51%〜100%: グレーから rainbow が湧き出す
                        const greyA   = (1 - rv) * 0.85;          // グレー側
                        const colorA  = Math.min(1, rv * 1.15);   // 虹側 (少し早めに濃く)
                        const stops = [
                            'rgba(128,128,128,' + greyA + ')',
                            'rgba(255,0,0,'   + (colorA * 0.85) + ')',
                            'rgba(255,140,0,' + (colorA * 0.75) + ')',
                            'rgba(255,255,0,' + (colorA * 0.85) + ')',
                            'rgba(0,255,0,'   + (colorA * 0.85) + ')',
                            'rgba(0,255,255,' + (colorA * 0.85) + ')',
                            'rgba(0,0,255,'   + (colorA * 0.85) + ')',
                            'rgba(255,0,255,' + (colorA * 0.85) + ')'
                        ];
                        barFill.style.background = 'linear-gradient(to right,' + stops.join(',') + ')';
                    } else {
                        // 101%: 完全 RGBCMY 虹
                        barFill.style.background =
                            'linear-gradient(to right,' +
                            '#ff0000,#ff8800,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)';
                    }
                }
                if (pctEl) {
                    // 2026-05-17 段階2.4: milestone snap (50/51/55/64/72/88/101)
                    const shown = nearestMilestone(morphProg);
                    pctEl.textContent = 'Loading reality... ' + shown + '%';
                }
            }
        } catch (e) { /* DOM 未準備でも黙って続行 */ }

        // ── rcSphere アシスタント (uAlpha ≤ 0.18, reveal>0.62 で出現) ──
        if (state.rcMesh && state.rcMat) {
            const ru = state.rcMat.uniforms;
            ru.u_time.value   = t;
            ru.u_hover.value  = 0;
            ru.u_clickT.value = 0;
            ru.u_morph.value  = 0;
            const assistAlpha = smoothstepJS(0.62, 1.0, rv) * 0.18;
            ru.uAlpha.value   = assistAlpha;
            state.rcMesh.visible = rv > 0.62;
            state.rcMesh.rotation.y = state.mesh.rotation.y;
            state.rcMesh.scale.copy(state.mesh.scale);
        }
    }

    function dispose() {
        state.disposed = true;
        state.running  = false;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        if (state.mesh && state.scene) {
            state.scene.remove(state.mesh);
        }
        if (state.geo)  state.geo.dispose();
        if (state.mat)  state.mat.dispose();
        if (state.rcMesh && state.scene) {
            state.scene.remove(state.rcMesh);
        }
        if (state.rcGeo) state.rcGeo.dispose();
        if (state.rcMat) state.rcMat.dispose();
        state.hiddenLegacy.forEach(function(o) { try { o.visible = true; } catch(e){} });
        state.hiddenLegacy = [];
        state.mesh = null;
        state.geo  = null;
        state.mat  = null;
        state.rcMesh = null;
        state.rcGeo  = null;
        state.rcMat  = null;
    }

    window.inryokuP1Stage1 = {
        init:    initStage1,
        update:  updateStage,
        dispose: dispose,
    };

    function setEnabled() {
        if (window.inryokuP1) {
            window.inryokuP1.stage1Enabled = true;
        }
    }
    setEnabled();

    function tryRegister(attempts) {
        if (window.inryokuP1 && typeof window.inryokuP1.registerStage1Handler === 'function') {
            window.inryokuP1.stage1Enabled = true;
            window.inryokuP1.registerStage1Handler(initStage1);
            return;
        }
        setEnabled();
        if (attempts <= 0) return;
        setTimeout(function() { tryRegister(attempts - 1); }, 100);
    }
    tryRegister(50);

    window.addEventListener('inryoku:p1_50percent', function(ev) {
        if (window.inryokuP1) window.inryokuP1.stage1Enabled = true;
        if (!state.running && !state.disposed) {
            initStage1(ev.detail);
        }
    });
})();
