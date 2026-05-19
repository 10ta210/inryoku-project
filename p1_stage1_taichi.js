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

    // 2026-05-18 P1 Stage 13: clean reset — one linear cinematic timeline post-50%
    //   When P1_STAGE13_RESET is true, all chaos overlays (tunnel/quantum/reality
    //   frame/glitch/warp) are no-oped and a single unified timeline runs.
    //   Set to false to restore previous Stage12 behavior (revert path).
    window.P1_STAGE13_RESET = (typeof window.P1_STAGE13_RESET === 'boolean')
        ? window.P1_STAGE13_RESET : true;
    window.inryokuP1 = window.inryokuP1 || {};
    window.inryokuP1.stage13Reset = window.P1_STAGE13_RESET;

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
    // 2026-05-17 段階3.1: 100% plateau → breakthrough
    //   10.2 → 11.7 : 100% plateau (uHundredPlateau 0→1, UI shake)
    //   11.7 → 12.0 : BREAKTHROUGH (bar burst, white flash, glass shatter)
    //   12.0 → 12.4 : settle 101%, UI ingest start
    //   12.4 +      : stage2complete → stage3 takes over
    const BREAKTHROUGH_T = 11.7;
    const SETTLE_END     = 12.0;
    // 2026-05-18 段階4: ingest 1.35s → 2.4s に延長、BANG は ingest 終了 (14.1s) で発火
    // 旧 STAGE2_FIRE_T = 12.4 (互換のため保持)
    const STAGE2_FIRE_T  = 12.4;
    const INGEST_START_T = 12.0;   // settle end = ingest start
    const INGEST_DUR     = 2.4;    // 2400ms
    const BANG_T         = INGEST_START_T + INGEST_DUR; // 14.4s
    const BANG_RAMP_DUR  = 0.7;    // 700ms uBang 0→1

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
        // ── 2026-05-18 段階4: big bang / compression / tunnel sync ──
        uniform float uCompression; // 0=normal, 1=fully compressed (anticipation)
        uniform float uBang;        // 0=normal, 1=fully exploded (0.7s ramp)
        uniform float uTunnel;      // 0=invisible, 1=full tunnel
        uniform vec2  uCenter;      // sphere NDC center (-1..1)
        // 2026-05-18 段階5/6/7: 後続フェーズ駆動 (tunnel/white/eye/cross)
        uniform float uTunnelPhase; // tunnel 中の球の表情変化 (0..1)
        uniform float uWhitePhase;  // white world での tint (0..1)
        uniform float uEyePhase;    // eye phase 中の瞳孔風 (0..1)
        uniform float uCrossPhase;  // cross phase の中心グロー (0..1)
        // 2026-05-18 Stage 13: 球そのものが白光へ変容するブレンド係数
        uniform float uWhiteBirth;  // 0=RGBCMY 球 / 1=純白光球
        uniform float uPremonitionAlpha; // 2026-05-18 段階15: 0-2s premonition core alpha (Codex P0-1)

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

            // ── 2026-05-18 段階4: 6色 CRACK radiation (big bang) ──
            //   uBang 0→1 で球表面が方向別 (RGBCMY 6セクター) に裂け、
            //   亀裂から色光が漏れ出す。alpha も bang で減衰 (爆ぜて消える)。
            float crackSeed = fbm(p * 8.0 + uTime * 0.2);
            float crack = smoothstep(0.72, 0.86, crackSeed + uBang * 0.55);
            float fissure = pow(crack, 3.0);
            vec3 dirCol;
            float aAng = atan(p.y, p.x);
            float sector = floor(fract(aAng / 6.2831853 + 0.5) * 6.0);
            if (sector < 1.0)      dirCol = vec3(1.0, 0.0, 0.0);   // R
            else if (sector < 2.0) dirCol = vec3(1.0, 1.0, 0.0);   // Y
            else if (sector < 3.0) dirCol = vec3(0.0, 1.0, 0.0);   // G
            else if (sector < 4.0) dirCol = vec3(0.0, 1.0, 1.0);   // C
            else if (sector < 5.0) dirCol = vec3(0.0, 0.15, 1.0);  // B
            else                   dirCol = vec3(1.0, 0.0, 1.0);   // M
            col += dirCol * fissure * uBang * 2.0;

            // ── 2026-05-18 段階5/6/7: 後続フェーズによる球の表情 ──
            // white world tint (RGB混合の白)
            col = mix(col, vec3(1.0), uWhitePhase * 0.42);
            col += fresnel * vec3(1.0) * uWhitePhase * 0.7;
            // 2026-05-19 段階18: 白「光」化 — 球の固体感を消して光源として見せる
            //   旧（段階16）: 70%白寄せ + halo 2.5x → 「白い球」感が残った
            //   新（段階18）: 表面パターン80%抑制 / 白ブレンド50% / halo 1.5x強化 / 中心放射追加
            //   uWhiteBirth: 0=RGBCMY球, 1=暗闇に浮かぶ光源そのもの
            float wb = uWhiteBirth;
            vec3 whiteCore = vec3(1.0);
            vec3 viewDir18 = normalize(uCameraPos - vWorldPos);
            float wbFres = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir18), 0.0), 1.6);
            // 表面パターン (yin-yang/fbm/rgbcmy) を中間グレーへフェード (80%)
            vec3 fadedSurface = mix(col, vec3(0.5), wb * 0.8);
            // 白へのブレンドは控えめ (50%まで)
            vec3 lightCol = mix(fadedSurface, whiteCore, wb * 0.5);
            // Fresnel halo 強化 (旧2.5x → 3.75x = 1.5倍)
            lightCol += whiteCore * wbFres * wb * 3.75;
            // 中心の発光感 (内側から外側へ放射)
            float coreGlow = (1.0 - smoothstep(0.0, 0.7, length(vPosition))) * wb * 0.8;
            lightCol += whiteCore * coreGlow;
            col = lightCol;
            // 旧: float wbFres = pow(1.0 - facing, 1.8);
            // 旧: lightCol = mix(lightCol, whiteCore, wb * 0.7);
            // 旧: lightCol += whiteCore * wbFres * wb * 2.5;
            // eye depth (中心に小さな暗い瞳孔)
            float eyeDepth = uEyePhase * pow(facing, 5.0);
            col = mix(col, vec3(0.02), eyeDepth * 0.18);
            // cross center glow (RGBCMY 白光)
            col += vec3(1.0) * uCrossPhase * fresnel * 1.2;
            // tunnel phase: ほのかな微震/色循環ブースト
            col += vec3(0.1, 0.1, 0.15) * uTunnelPhase * fresnel * 0.4;

            // ── 2026-05-18 段階4.1: 球は最後まで残す（観測の核）
            // 旧: uBang で 85% 消失 → 修正: 20% 微減衰のみ。常時可視
            // 2026-05-18 段階5以降: bang 後は alpha を 1.0 へ復元 (uWhitePhase/uEyePhase/uCrossPhase が立てば不透明)
            float postBang = max(max(max(uWhitePhase, uEyePhase), uCrossPhase), uWhiteBirth);
            float alphaOut = uTaichiMix * mix(
                1.0 - smoothstep(0.45, 1.0, uBang) * 0.20,
                1.0,
                postBang
            );
            // 2026-05-18 段階15 P0-1: premonition core alpha
            //   0-2s フェーズで uTaichiMix=0 でも球が薄く見えるよう、低 alpha 出力。
            //   uPremonitionAlpha=1.0 で従来動作と等価。
            float baseAlpha = max(alphaOut, uPremonitionAlpha);
            vec3  baseCol   = col * max(uTaichiMix, uPremonitionAlpha * 0.5);
            // 2026-05-19 段階18: 白光化で球本体をさらに半透明化、リムは強く
            //   旧（段階16）: surfaceFade 0.4→1.0 で 70%減衰 / rimGlow 0.4倍
            //   新（段階18）: surfaceFade 0.2→1.0 で 65%減衰 (0.35残し) / rimGlow 0.6倍
            float surfaceFade = 1.0 - smoothstep(0.2, 1.0, uWhiteBirth) * 0.65;
            float rimGlow = wbFres * smoothstep(0.0, 0.6, uWhiteBirth);
            float finalA = baseAlpha * surfaceFade + rimGlow * 0.6;
            // 旧: float surfaceFade = 1.0 - smoothstep(0.4, 1.0, uWhiteBirth) * 0.7;
            // 旧: float finalA = baseAlpha * surfaceFade + rimGlow * 0.4;
            gl_FragColor = vec4(baseCol, clamp(finalA, 0.0, 1.0));
        }
    `;

    // イージング
    function easeOutCubic(t) { return 1.0 - Math.pow(1.0 - t, 3.0); }
    // 2026-05-18 Stage 13: 陰陽→グレー→RGBCMY のホールド→ジャンプカーブ
    function holdThenJump(t) {
        if (t < 0.55) {
            const k = t / 0.55;
            return (4 * k * k - 3 * k * k * k) * 0.45;
        }
        return 0.45 + Math.pow((t - 0.55) / 0.45, 0.55) * 0.55;
    }
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
    // 2026-05-17 段階3.1: 急跳躍 0.97 で着地、0.86→1.0 で drift 0.97→1.0
    //   100% snap at t=1.0 (the breakthrough to 101% happens AFTER morph ends)
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
            // 跳躍 (0.67 → 0.97)
            return 0.67 + 0.30 * easeOutExpo((t - 0.72) / 0.14);
        }
        // "almost there..." 0.97 → 1.0 drift
        const d = (t - 0.86) / 0.14;
        return 0.97 + 0.03 * easeInOutCubic(Math.min(1, d));
    }

    // 2026-05-17 段階2.4: milestone-based text snapping
    // 2026-05-17 段階3.1: 100 milestone 追加 (plateau 表示用)
    const P101_MILESTONES = [50, 51, 55, 64, 72, 88, 99, 100, 101];
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
        // 2026-05-17 段階3.1: plateau / breakthrough state
        hundredPlateau: 0,        // 0 → 1 across 10.2 → 11.7
        prewarpFired: false,      // CSS prewarp class added
        prewarpEventFired: false, // inryoku:p1_prewarp event (reveal>=0.72)
        breakthroughFired: false, // breakthrough event + visuals
        ingestFired: false,       // UI ingest class applied
        flashEl: null,            // white flash overlay
        cssInjected: false,
        audio_breakthroughFired: false,
        audio_ingestFired: false,
        isMobile: false,
        // 2026-05-18 段階3.2: discovery / clone / quantized bar / runner / glitch
        win95Root: null,         // discoverWin95Root() の結果 (DOM clone source)
        uiIngestClone: null,     // body に append された clone 要素
        uiIngestSource: null,    // 元 DOM (visibility hidden で隠した参照)
        runner: null,            // #exit-runner キャッシュ
        visualPct: 50,           // バーの視覚追従値 (50 → 101)
        lastTime: 0,             // dt 計算用 (performance.now ms)
        glitchTextFired: false,  // breakthrough 直前 1-2 フレームの "10█%" 表示
        glitchAudioDucked: false,// 120ms 無音化済みか
        // 2026-05-18 段階4: big bang / ingest extended timeline
        bangFired: false,
        bangStart: 0,
        ingestStartMs: 0,        // applyIngestClass 呼ばれた瞬間 (performance.now)
        gooSvgInjected: false,
        audio_bangFired: false,
        audio_gooFired: false,
        audio_tunnelRiseFired: false,
        easterCmyInked: false,
        easterGreyPointFired: false,
        easterRunnerLastFired: false,
        // 2026-05-18 段階2.5: Codex redesign — grey OS bar + color leak only at key moments
        bled50: false,            // 50% bleed flash one-shot guard
        breakthroughTime: 0,      // performance.now() at fireBreakthrough
        ingestStartTime: 0,       // performance.now() at applyIngestClass
        pressureActive: false,    // class state tracker
        // 2026-05-18 段階4.2: Reality Frame Collapse (whole .phase-1 dissolution)
        realityFrame: null,       // { source, clone }
        screenWarp: null,         // fullscreen warp overlay element
        realityFrameRoot: null,   // discoverRealityFrameRoot() cached result
        // 2026-05-18 Stage 13: clean reset linear timeline (post-50%)
        stage13Started: false,
        stage13T0: 0,
        s13_whiteFired: false,
        s13_eyeFired: false,
        s13_eyeOpenFired: false,
        s13_crossFired: false,
        s13_p2Fired: false,
        s13_chaosHidden: false,
        // 2026-05-18 段階14: UI shell ingest + fullscreen unlock guards
        stage14UnlockFired: false,
        stage14IngestFired: false,
        stage14Clone: null,
        stage14TitleSwapped: false,
        hundredShownAt: 0,
        // 2026-05-19 段階17: concept-breaking moment (101 flash + bg ingest)
        text101Fired: false,
        bgEaten: false,
    };

    // 2026-05-17 段階3.1: モバイル検出 (FOV cap / flash skip 用)
    const IS_MOBILE = (typeof navigator !== 'undefined')
        && (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
            || (typeof window !== 'undefined' && window.innerWidth < 640)
            || (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
                && window.matchMedia('(pointer: coarse)').matches));
    // 2026-05-18 段階3.2: モバイル妥協値 (spark 数 / blur 強度)
    const SPARK_COUNT  = IS_MOBILE ? 8 : 18;
    const INGEST_BLUR  = IS_MOBILE ? 2 : 7;
    // 2026-05-18 段階4: mobile-tuned constants
    const GOO_SCALE_MAX  = IS_MOBILE ? 24 : 44;   // feDisplacementMap peak
    const GOO_SCALE_PEAK = IS_MOBILE ? 14 : 18;   // ramp-up peak
    const BLOOM_STRENGTH_MAX = IS_MOBILE ? 1.5 : 2.2;
    const FOV_MAX_LOCAL  = IS_MOBILE ? 60 : 72;

    // 2026-05-18 段階4: SVG goo filter (feTurbulence + feDisplacementMap)
    //   UI の最終消失を「液体が落ちて消える」表現に置き換える。
    //   旧: clip-path circle + filter blur (.is-ingesting)
    //   新: filter: url(#p1-goo-ingest-filter) + clip-path ellipse (.p1-goo-ingest)
    function ensureP1GooFilter() {
        if (state.gooSvgInjected) return;
        if (typeof document === 'undefined') return;
        try {
            if (document.getElementById('p1-goo-filter-svg')) {
                state.gooSvgInjected = true;
                return;
            }
            const peak = GOO_SCALE_PEAK;
            const apex = GOO_SCALE_MAX;
            // SVG namespace 必須 (innerHTML だと filter が機能しないことがあるが
            //  ここでは body 直下に挿入するため動作する)
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:fixed;width:0;height:0;pointer-events:none;';
            wrap.innerHTML =
                '<svg id="p1-goo-filter-svg" width="0" height="0" '
                + 'xmlns="http://www.w3.org/2000/svg" style="position:fixed;pointer-events:none;">'
                +   '<filter id="p1-goo-ingest-filter">'
                +     '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" '
                +       'numOctaves="3" seed="7" result="noise">'
                +       '<animate attributeName="baseFrequency" dur="2.4s" '
                +         'values="0.012 0.028;0.045 0.090;0.018 0.055" fill="freeze" />'
                +     '</feTurbulence>'
                +     '<feDisplacementMap in="SourceGraphic" in2="noise" scale="0" '
                +       'xChannelSelector="R" yChannelSelector="G">'
                +       '<animate attributeName="scale" dur="2.4s" '
                +         'values="0;' + peak + ';' + apex + ';' + Math.round(apex * 0.27)
                +         ';0" keyTimes="0;0.28;0.64;0.86;1" fill="freeze" />'
                +     '</feDisplacementMap>'
                +   '</filter>'
                + '</svg>';
            document.body.appendChild(wrap);
            state.gooSvgInjected = true;
        } catch (e) {}
    }

    // 2026-05-18 段階3.2: Win95 ルート DOM 探索 (Codex)
    //   ID/class が安定しない問題に対する fallback。
    //   候補→大きさ→上半分中央性 で最有力候補をキャッシュ。
    function discoverWin95Root() {
        try {
            const candidates = [
                '#win95-main', '#win95-window', '.win95-window',
                '#win95-bar', '#root .phase-1 > *'
            ];
            for (const sel of candidates) {
                const el = document.querySelector(sel);
                if (el && el.offsetWidth > 200 && el.offsetHeight > 100) return el;
            }
            // Fallback: 視野上 80% 内の最大可視中央要素
            const all = Array.from(document.querySelectorAll('*'));
            let best = null, bestArea = 0;
            for (const el of all) {
                const r = el.getBoundingClientRect();
                if (r.width > 250 && r.height > 120
                    && r.top < window.innerHeight * 0.8 && r.left > 0) {
                    const area = r.width * r.height;
                    if (area > bestArea) { bestArea = area; best = el; }
                }
            }
            return best;
        } catch (e) { return null; }
    }

    // 2026-05-18 段階3.2: DOM clone overlay (clip-path / transform を確実に乗せる)
    function createUiIngestClone(source) {
        if (!source) return null;
        try {
            const rect = source.getBoundingClientRect();
            const clone = source.cloneNode(true);
            clone.id = 'p1-ui-ingest-clone';
            clone.classList.add('p1-ui-ingest-clone');
            // 元の id 衝突を防ぐ: 子の id をリネーム
            try {
                const ids = clone.querySelectorAll('[id]');
                ids.forEach(function(n){ n.id = 'cl-' + n.id; });
                clone.id = 'p1-ui-ingest-clone';
            } catch (e) {}
            Object.assign(clone.style, {
                position: 'fixed',
                left: rect.left + 'px',
                top:  rect.top  + 'px',
                width:  rect.width  + 'px',
                height: rect.height + 'px',
                margin: '0',
                zIndex: '2147483000',
                pointerEvents: 'none',
                transformOrigin: '50% 50%',
                willChange: 'transform, opacity, filter, clip-path'
            });
            document.body.appendChild(clone);
            // 元 DOM を隠す (レイアウトは維持)
            source.style.visibility = 'hidden';
            return { source: source, clone: clone };
        } catch (e) { return null; }
    }

    // 2026-05-18 段階4.2: Reality Frame discovery (P1 root 全体 — .phase-1 優先)
    //   Codex: 101% は Win95 window だけでなく、四角フレームの概念ごと溶解させる。
    //   priority: .phase-1 → #phase-1 → #root (contains .phase-1) → largest fallback
    function discoverRealityFrameRoot() {
        try {
            const phase1 = document.querySelector('.phase-1')
                        || document.querySelector('#phase-1');
            if (phase1 && phase1.offsetWidth > 200 && phase1.offsetHeight > 100) return phase1;
            const root = document.getElementById('root');
            if (root && root.querySelector && root.querySelector('.phase-1')
                && root.offsetWidth > 200 && root.offsetHeight > 100) {
                return root;
            }
            // Fallback: 既存ロジック (Win95 window) を再利用
            return discoverWin95Root();
        } catch (e) { return null; }
    }

    // 2026-05-18 段階4.2: P1 root 全体を clone → reality-frame-collapse 用 overlay
    // 2026-05-18 段階8: fullscreen 化 (100vw/100vh) — 外枠を viewport 全体に拡張し
    //   ingest collapse 後の外側残骸 (page 背景) を見せない。
    function createRealityFrameClone() {
        if (window.P1_STAGE13_RESET) return null; // Stage 13: chaos overlay disabled
        try {
            const source = discoverRealityFrameRoot();
            if (!source) return null;
            // 旧 (段階4.2): source rect サイズで clone — 外側に元 page 背景が見えていた
            // const rect = source.getBoundingClientRect();
            const clone = source.cloneNode(true);
            clone.id = 'p1-reality-frame-clone';
            try {
                const ids = clone.querySelectorAll('[id]');
                ids.forEach(function(n){ n.id = 'rfc-' + n.id; });
                clone.id = 'p1-reality-frame-clone';
            } catch (e) {}
            // 2026-05-18 段階8.1: clone は UI シェルのみ。WebGL canvas を剥がして
            //   下層 Three.js (sphere/tunnel/eye/cross) を遮蔽しないようにする。
            try {
                clone.querySelectorAll('canvas').forEach(function(c){ c.remove(); });
            } catch (e) {}
            Object.assign(clone.style, {
                position: 'fixed',
                left: '0',
                top:  '0',
                width:  '100vw',      // 2026-05-18 段階8: fullscreen
                height: '100vh',      // 2026-05-18 段階8: fullscreen
                margin: '0',
                zIndex: '2147483000',
                pointerEvents: 'none',
                transformOrigin: '50% 50%',
                overflow: 'hidden',
                willChange: 'transform, opacity, filter, clip-path'
            });
            document.body.appendChild(clone);
            // 2026-05-18 段階8.1: source.style.visibility='hidden' を撤去。
            //   .phase-1 全体を隠すと中の Three.js canvas まで消えて black-screen 化する。
            //   個別 UI 要素は hideP1UiOnly() で隠す。
            // 旧コード: source.style.visibility = 'hidden';
            return { source: source, clone: clone };
        } catch (e) { return null; }
    }

    // 2026-05-18 段階8.1: 個別 UI 要素のみ隠す (.phase-1 root や canvas は触らない)
    //   Codex root-cause fix: .phase-1 を visibility:hidden すると中の Three.js canvas
    //   まで消えるので、UI セレクタ単位で hide する。canvas には絶対付与しない。
    function hideP1UiOnly() {
        try {
            const phase = document.querySelector('.phase-1');
            if (!phase) return;
            const selectors = [
                '#win95-main', '#p1-lpct', '#p1-lb', '#exit-runner',
                '.p1-loader', '.p1-window', '.p1-panel',
                '.p1-left-panel', '.p1-right-panel', '.p1-copy', '.p1-label'
            ];
            selectors.forEach(function(sel){
                phase.querySelectorAll(sel).forEach(function(el){
                    if (el.tagName === 'CANVAS') return; // never hide canvas
                    el.classList.add('p1-ui-hidden-after-collapse');
                });
            });
        } catch (e) {}
    }

    // 2026-05-18 段階8.1: 防御的に .phase-1 と canvas の visibility/opacity/z-index を持ち上げる
    function liftP1Canvas() {
        try {
            const phase = document.querySelector('.phase-1');
            if (phase) {
                phase.style.visibility = 'visible';
                phase.style.opacity = '1';
            }
            document.querySelectorAll('.phase-1 canvas').forEach(function(canvas){
                canvas.style.visibility = 'visible';
                canvas.style.opacity = '1';
                canvas.style.zIndex = '20';
            });
        } catch (e) {}
    }

    // 2026-05-18 段階8: void backdrop — collapse 後の真の暗黒を保証
    function createVoidBackdrop() {
        try {
            const v = document.createElement('div');
            v.id = 'p1-void-backdrop';
            Object.assign(v.style, {
                position: 'fixed',
                inset: '0',
                zIndex: '2147482998',   // warp overlay の下
                pointerEvents: 'none',
                background: '#000',
                opacity: '0',
                transition: 'opacity 800ms ease-in'
            });
            document.body.appendChild(v);
            requestAnimationFrame(function(){
                setTimeout(function(){ try { v.style.opacity = '1'; } catch (e) {} }, 1200);
            });
            return v;
        } catch (e) { return null; }
    }

    // 2026-05-18 段階4.2: フルビューポート warp overlay (圧縮 blur gradient)
    function createScreenWarpOverlay() {
        if (window.P1_STAGE13_RESET) return null; // Stage 13: chaos overlay disabled
        try {
            const overlay = document.createElement('div');
            overlay.className = 'p1-screen-warp';
            document.body.appendChild(overlay);
            return overlay;
        } catch (e) { return null; }
    }

    // 2026-05-18 段階3.2: バーから RGBCMY スパーク放出
    function emitBarSparks() {
        try {
            const bar = document.getElementById('p1-lb');
            if (!bar) return;
            const r = bar.getBoundingClientRect();
            const x = r.right;
            const y = r.top + r.height / 2;
            const colors = ['#ff0000','#00ff00','#0000ff','#00ffff','#ff00ff','#ffff00'];
            for (let i = 0; i < SPARK_COUNT; i++) {
                const s = document.createElement('i');
                s.className = 'p1-bar-spark';
                s.style.left = x + 'px';
                s.style.top  = y + 'px';
                s.style.setProperty('--dx', ((Math.random() - 0.5) * 90) + 'px');
                s.style.setProperty('--dy', ((Math.random() - 0.5) * 34) + 'px');
                s.style.color      = colors[i % 6];
                s.style.background = colors[i % 6];
                document.body.appendChild(s);
                s.addEventListener('animationend', function(){
                    try { s.remove(); } catch (e) {}
                }, { once: true });
            }
        } catch (e) {}
    }

    // 2026-05-18 段階3.2: 100% 直前 1-2 フレームのグリッチ文字
    function showGlitchPercent(pctEl) {
        if (!pctEl) return;
        try {
            const glyphs = ['█','▓','◢','✕'];
            pctEl.textContent = 'Loading reality... 10'
                + glyphs[Math.floor(Math.random() * glyphs.length)] + '%';
        } catch (e) {}
    }

    // 2026-05-18 段階2.5: Codex 文字グリッチ生成 (ingest 中の breakdown 用)
    function glitchText(src, intensity) {
        try {
            const chars = ['▒','█','▓','◢','◣','✕','░','■'];
            return src.split('').map(function (c) {
                if (c === ' ' || c === '.') return c;
                return Math.random() < intensity ? chars[Math.floor(Math.random() * chars.length)] : c;
            }).join('');
        } catch (e) { return src; }
    }

    // 2026-05-18 段階2.5: Codex text degradation sequence
    //   normal → 100% → 10█% → ∞% → 101% → glitch → empty
    function updateLoadingText(rv, now) {
        const pctEl = document.getElementById('p1-lpct');
        if (!pctEl) return;
        if (state.ingestFired) {
            const elapsed = now - (state.ingestStartTime || state.ingestStartMs || now);
            if (elapsed < 100)       pctEl.textContent = glitchText('Loading reality... 101%', 0.4);
            else if (elapsed < 240)  pctEl.textContent = glitchText('Loading reality... 101%', 0.7);
            else if (elapsed < 380)  pctEl.textContent = glitchText('Loading reality... 101%', 0.95);
            else                     pctEl.textContent = '';
            return;
        }
        if (state.breakthroughFired) {
            const elapsed = now - (state.breakthroughTime || now);
            if (elapsed < 50)        pctEl.textContent = 'Loading reality... 10█%';
            else if (elapsed < 100)  pctEl.textContent = 'Loading reality... ∞%';
            else                     pctEl.textContent = 'Loading reality... 101%';
            return;
        }
        if (rv >= 1.0) {
            // 2026-05-18 段階14 Priority 1: 100% を 1 フレームだけ見せて 101% へ
            if (!state.hundredShownAt) {
                state.hundredShownAt = now;
                pctEl.textContent = 'Loading reality... 100%';
                return;
            }
            if ((now - state.hundredShownAt) < 40) {
                pctEl.textContent = 'Loading reality... 100%';
                return;
            }
            pctEl.textContent = 'Loading reality... 101%';
            return;
        }
        // normal: milestone snap (既存の nearestMilestone を流用)
        const morphProg = 50 + rv * 50;
        const shown = nearestMilestone(morphProg);
        pctEl.textContent = 'Loading reality... ' + shown + '%';
    }

    // 2026-05-18 段階3.2: ローディングバー quantized milestones
    //   width:x% の直接補間ではなく "packet" 単位で進ませる
    const BAR_MILESTONES = [50, 51, 53, 55, 58, 62, 67, 72, 79, 88, 96, 99, 100, 101];
    function quantizedPct(rawPct) {
        let nearest = BAR_MILESTONES[0];
        for (let i = 0; i < BAR_MILESTONES.length; i++) {
            if (BAR_MILESTONES[i] <= rawPct) nearest = BAR_MILESTONES[i];
        }
        return nearest;
    }

    // 2026-05-18 段階3.2: breakthrough 120ms 前に master gain を一瞬絞る
    function preBreakthroughSilence() {
        if (!state.audioCtx || !state.audioMaster) return;
        try {
            const ctx = state.audioCtx;
            const now = ctx.currentTime;
            const prev = state.audioMaster.gain.value || 1.0;
            state.audioMaster.gain.cancelScheduledValues(now);
            state.audioMaster.gain.setValueAtTime(prev, now);
            state.audioMaster.gain.linearRampToValueAtTime(0.0001, now + 0.02);
            state.audioMaster.gain.linearRampToValueAtTime(prev,   now + 0.14);
        } catch (e) {}
    }

    // 2026-05-17 段階3.1: CSS 注入 (prewarp shake / ingest / bar burst)
    function injectStage31CSS() {
        if (state.cssInjected) return;
        state.cssInjected = true;
        try {
            const css = [
                '.p1-window-prewarp {',
                '  animation: p1UiPrewarp 1.5s ease-in-out infinite;',
                '}',
                /* 2026-05-18 段階5/6/7: 量子崩壊と並行で DOM 側もフェード */
                '.p1-quantum-collapse {',
                '  animation: p1QuantumSourceFade 1200ms ease-in forwards;',
                '}',
                '@keyframes p1QuantumSourceFade {',
                '  0%   { opacity: 1; filter: contrast(1) saturate(1); }',
                '  45%  { opacity: .92; filter: contrast(1.5) saturate(2.2)',
                '         drop-shadow(2px 0 rgba(0,255,255,.45))',
                '         drop-shadow(-2px 0 rgba(255,0,255,.38)); }',
                '  100% { opacity: 0; filter: contrast(2.4) saturate(3) blur(2px); }',
                '}',
                '.p1-window-ingest {',
                '  animation: p1UiIngest 1.35s cubic-bezier(.72,0,.15,1) forwards;',
                '  pointer-events: none;',
                '}',
                '.p1-bar-burst {',
                '  transform-origin: 0 50%;',
                '  transition: transform 0.18s cubic-bezier(.4,0,.6,1),',
                '              filter 0.18s cubic-bezier(.4,0,.6,1);',
                '}',
                '.p1-bar-burst.is-burst {',
                '  transform: scaleX(1.08);',
                '  filter: brightness(1.8) saturate(2);',
                '}',
                '@keyframes p1UiPrewarp {',
                '  0%, 100% { filter: contrast(1) saturate(1); transform: translate3d(0,0,0) skew(0deg); }',
                '  50% { filter: contrast(1.12) saturate(1.35)',
                '       drop-shadow(1px 0 rgba(255,0,0,.45))',
                '       drop-shadow(-1px 0 rgba(0,255,255,.35));',
                '       transform: translate3d(0,-1px,0) skew(.25deg); }',
                '}',
                '@keyframes p1UiIngest {',
                '  0%   { opacity: 1; transform: scale(1); filter: contrast(1.1) saturate(1.4); clip-path: circle(120% at 50% 50%); }',
                '  55%  { opacity: .92; transform: scale(.72) rotate(.8deg); filter: contrast(1.6) saturate(2.2) blur(.3px); clip-path: circle(58% at 50% 50%); }',
                '  82%  { opacity: .62; transform: scale(.18) rotate(-8deg); filter: contrast(2.2) saturate(3.0) blur(1.2px); clip-path: circle(18% at 50% 50%); }',
                '  100% { opacity: 0; transform: scale(.02) rotate(-30deg); filter: blur(4px) brightness(2.5); clip-path: circle(1% at 50% 50%); }',
                '}',
                '#p1-white-flash {',
                '  position: fixed; inset: 0; background: #ffffff;',
                '  opacity: 0; pointer-events: none; z-index: 99999;',
                '  mix-blend-mode: screen;',
                '}',
                '#p1-white-flash.is-flashing {',
                '  animation: p1WhiteFlash 0.2s ease-out forwards;',
                '}',
                '@keyframes p1WhiteFlash {',
                '  0%   { opacity: 0; }',
                '  40%  { opacity: 0.85; }',
                '  100% { opacity: 0; }',
                '}',
                // ── 2026-05-18 段階3.2: clone overlay ingest ──
                '.p1-ui-ingest-clone {',
                '  contain: paint;',
                '  backface-visibility: hidden;',
                '}',
                '.p1-ui-ingest-clone.is-ingesting {',
                '  animation: p1UiCollapse 1350ms cubic-bezier(.76,0,.14,1) forwards;',
                '}',
                '@keyframes p1UiCollapse {',
                '  0%   { opacity: 1; transform: translate3d(0,0,0) scale(1) rotate(0deg);',
                '         filter: contrast(1.05) saturate(1.1);',
                '         clip-path: circle(145% at 50% 50%); }',
                '  28%  { opacity: .98; transform: translate3d(0,-2px,0) scale(.98, .92) rotate(.2deg);',
                '         filter: contrast(1.25) saturate(1.7)',
                '                 drop-shadow(2px 0 rgba(255,0,0,.55))',
                '                 drop-shadow(-2px 0 rgba(0,255,255,.42));',
                '         clip-path: circle(96% at 50% 50%); }',
                '  56%  { opacity: .88; transform: translate3d(0,4px,0) scale(.58, .34) rotate(-2.5deg);',
                '         filter: contrast(1.8) saturate(2.6) blur(.35px);',
                '         clip-path: circle(44% at 50% 50%); }',
                '  78%  { opacity: .58; transform: translate3d(0,0,0) scale(.18, .08) rotate(12deg);',
                '         filter: contrast(2.4) saturate(3.2) blur(1.6px) brightness(1.8);',
                '         clip-path: circle(12% at 50% 50%); }',
                '  100% { opacity: 0; transform: translate3d(0,0,0) scale(.015) rotate(36deg);',
                '         filter: blur(' + INGEST_BLUR + 'px) brightness(3); clip-path: circle(1% at 50% 50%); }',
                '}',
                // ── 2026-05-18 段階3.2: runner (#exit-runner) plateau/breakthrough/ingest ──
                '#exit-runner.is-plateau {',
                '  animation: runnerWallHit 520ms cubic-bezier(.7,0,.3,1) infinite;',
                '  filter: drop-shadow(1px 0 rgba(255,0,0,.55))',
                '          drop-shadow(-1px 0 rgba(0,255,255,.45));',
                '}',
                '@keyframes runnerWallHit {',
                '  0%,100% { transform: translateX(-2px) scale(1); }',
                '  45% { transform: translateX(3px) scale(.96, 1.04); }',
                '  60% { transform: translateX(-5px) scale(1.04, .96); }',
                '}',
                '#exit-runner.is-breakthrough {',
                '  animation: runnerBreakthrough 680ms cubic-bezier(.18,0,.1,1) forwards;',
                '  filter: brightness(2.8) drop-shadow(0 0 8px #fff)',
                '          drop-shadow(4px 0 rgba(0,255,255,.55))',
                '          drop-shadow(-4px 0 rgba(255,0,255,.45));',
                '}',
                '@keyframes runnerBreakthrough {',
                '  0%   { transform: translateX(0) scale(1); opacity: 1; }',
                '  26%  { transform: translateX(-8px) scale(.88,1.12); }',
                '  42%  { transform: translateX(8px) scale(1.18,.82); }',
                '  100% { transform: translateX(46px) scale(.65); opacity: .78; }',
                '}',
                '#exit-runner.is-ingesting {',
                '  animation: runnerIngest 900ms cubic-bezier(.8,0,.12,1) forwards;',
                '  transform-origin: center center;',
                '}',
                '@keyframes runnerIngest {',
                '  0%   { opacity: 1; transform: translate3d(0,0,0) scale(.8); }',
                '  55%  { opacity: .95; transform: translate3d(18px,-8px,0) scale(.42) rotate(12deg); }',
                '  100% { opacity: 0; transform: translate3d(42vw, -18vh, 0) scale(.02) rotate(80deg); filter: blur(5px) brightness(3); }',
                '}',
                // ── 2026-05-18 段階3.2: bar strain (plateau) + breakthrough burst ──
                '#p1-lb.is-plateau {',
                '  animation: p1BarStrain 420ms steps(2, end) infinite;',
                '  transform-origin: left center;',
                '}',
                '@keyframes p1BarStrain {',
                '  0%   { filter: saturate(1.4) brightness(1); transform: scaleX(1); }',
                '  50%  { filter: saturate(2.4) brightness(1.35)',
                '                 drop-shadow(1px 0 rgba(255,0,0,.55))',
                '                 drop-shadow(-1px 0 rgba(0,255,255,.45));',
                '         transform: scaleX(1.012) skewX(-1deg); }',
                '  100% { filter: saturate(1.7) brightness(1.1); transform: scaleX(.998); }',
                '}',
                '#p1-lb.is-breakthrough {',
                '  animation: p1BarBreak 480ms cubic-bezier(.2,0,.1,1) forwards;',
                '}',
                '@keyframes p1BarBreak {',
                '  0%   { transform: scaleX(1); filter: brightness(1) saturate(1.5); }',
                '  35%  { transform: scaleX(1.08); filter: brightness(2.2) saturate(3.2) blur(.2px); }',
                '  58%  { transform: scaleX(.92); filter: brightness(3.4) saturate(4) blur(.8px); }',
                '  100% { transform: scaleX(1); filter: brightness(1.4) saturate(2); }',
                '}',
                // ── 2026-05-18 段階3.2: sparks ──
                '.p1-bar-spark {',
                '  position: fixed; width: 2px; height: 2px;',
                '  z-index: 2147483001; pointer-events: none;',
                '  box-shadow: 0 0 8px currentColor;',
                '  animation: p1Spark 520ms ease-out forwards;',
                '}',
                '@keyframes p1Spark {',
                '  to { opacity: 0; transform: translate3d(var(--dx), var(--dy), 0) scale(.2); filter: blur(1px); }',
                '}',
                // ── 2026-05-18 段階4: SVG goo ingest (liquid UI 吸引) ──
                //   旧 .is-ingesting (1350ms) → 新 .p1-goo-ingest (2400ms)
                '.p1-goo-ingest {',
                '  transform-origin: 50% 50%;',
                '  will-change: transform, opacity, filter, clip-path;',
                '  filter: url(#p1-goo-ingest-filter);',
                '  animation: p1GooIngest 2400ms cubic-bezier(.72,0,.12,1) forwards;',
                '}',
                '@keyframes p1GooIngest {',
                '  0%   { opacity: 1; transform: scale(1) rotate(0deg);',
                '         clip-path: ellipse(145% 120% at 50% 50%); border-radius: 0; }',
                '  22%  { opacity: .98; transform: scale(.97, .91) rotate(.2deg);',
                '         clip-path: ellipse(105% 84% at 50% 50%); border-radius: 14px; }',
                '  48%  { opacity: .92; transform: scale(.72, .46) rotate(-1.6deg);',
                '         clip-path: ellipse(68% 38% at 50% 50%); border-radius: 42% 58% 48% 52%; }',
                '  70%  { opacity: .76; transform: scale(.34, .16) rotate(7deg);',
                '         clip-path: ellipse(30% 12% at 50% 50%); border-radius: 65% 35% 60% 40%; }',
                '  88%  { opacity: .45; transform: scale(.09, .035) rotate(-18deg);',
                '         clip-path: ellipse(8% 3% at 50% 50%); border-radius: 50%; }',
                '  100% { opacity: 0; transform: scale(.012) rotate(-42deg);',
                '         clip-path: ellipse(1% 1% at 50% 50%); }',
                '}',
                // ── 2026-05-18 段階4: CMY ink bleed easter egg (最初の 600ms) ──
                // ── 2026-05-18 段階4: runner as last particle ──
                '#exit-runner.is-final-particle {',
                '  filter: brightness(2.8) drop-shadow(0 0 6px #fff)',
                '          drop-shadow(0 0 12px rgba(255,255,255,.8));',
                '  animation: runnerFinalParticle 1200ms ease-in forwards;',
                '}',
                '@keyframes runnerFinalParticle {',
                '  0%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }',
                '  60%  { opacity: 1; transform: translate(calc(-50% + 2px), calc(-50% - 2px)) scale(.6); }',
                '  100% { opacity: 0; transform: translate(-50%, -50%) scale(.05); }',
                '}',
                '.p1-goo-ingest.is-cmy-ink {',
                '  filter: url(#p1-goo-ingest-filter)',
                '          drop-shadow(2px 0 rgba(0,255,255,.55))',
                '          drop-shadow(-2px 0 rgba(255,0,255,.55))',
                '          drop-shadow(0 2px rgba(255,255,0,.45));',
                '}',
                // ── 2026-05-18 段階4.2: Reality Frame Collapse (P1 root 全体の崩壊) ──
                //   Codex: 101% は .phase-1 全域を square → ellipse → dot に溶解する。
                '#p1-reality-frame-clone.reality-frame-collapse {',
                '  animation: realityFrameCollapse 2400ms cubic-bezier(.76,0,.1,1) forwards;',
                (IS_MOBILE ? '  filter: contrast(1.08) saturate(1.18);' : '  filter: contrast(1.2) saturate(1.4);'),
                '}',
                '@keyframes realityFrameCollapse {',
                '  0%   { opacity: 1; transform: scale(1);',
                '         clip-path: inset(0% 0% 0% 0% round 0px); }',
                '  22%  { opacity: .98; transform: scale(1.015);',
                '         clip-path: inset(1% 1% 1% 1% round 18px); }',
                '  45%  { opacity: .94; transform: scale(.92, .86) rotate(.4deg);',
                '         clip-path: ellipse(78% 62% at 50% 50%); }',
                '  68%  { opacity: .78; transform: scale(.55, .34) rotate(-2deg);',
                '         clip-path: ellipse(42% 22% at 50% 50%); }',
                '  86%  { opacity: .45; transform: scale(.16, .07) rotate(13deg);',
                '         clip-path: ellipse(12% 5% at 50% 50%); }',
                '  100% { opacity: 0; transform: scale(.01) rotate(38deg);',
                '         clip-path: ellipse(1% 1% at 50% 50%); }',
                '}',
                '.p1-screen-warp {',
                '  position: fixed; inset: 0;',
                '  z-index: 2147482999;',
                '  pointer-events: none;',
                '  background: radial-gradient(circle at 50% 50%,',
                '    transparent 0 18%,',
                '    rgba(255,255,255,.08) 28%,',
                '    rgba(0,0,0,0) 60%);',
                '  animation: screenWarp 2400ms ease-in forwards;',
                '}',
                '@keyframes screenWarp {',
                '  0%   { transform: scale(1); filter: blur(0); opacity: 0; }',
                '  30%  { opacity: .35; }',
                (IS_MOBILE
                    ? '  70%  { opacity: .8; transform: scale(.82); filter: blur(.6px); }'
                    : '  70%  { opacity: .8; transform: scale(.82); filter: blur(1px); }'),
                (IS_MOBILE
                    ? '  100% { opacity: 0; transform: scale(.05); filter: blur(4px); }'
                    : '  100% { opacity: 0; transform: scale(.05); filter: blur(8px); }'),
                '}',
                // ── 2026-05-18 段階2.5: Codex redesign — grey OS bar (default) ──
                //   旧: JS が rainbow gradient を毎フレーム inline 書き換え
                //   新: クラス制で grey が default、色は 50/100/101 の 3 瞬間だけ漏れる
                '#p1-lb {',
                '  background: repeating-linear-gradient(',
                '    90deg,',
                '    #6f6f6f 0 2px,',
                '    #9a9a9a 2px 4px',
                '  );',
                '  box-shadow:',
                '    inset 0 1px 0 rgba(255,255,255,.55),',
                '    inset 0 -1px 0 rgba(0,0,0,.45);',
                '  filter: none;',
                '  position: relative;',
                '  overflow: visible;',
                '}',
                // ── 50% bleed: 240ms CMY/RGB chromatic aberration flash ──
                '#p1-lb.is-bleed-50 {',
                '  animation: p1Bleed50 240ms cubic-bezier(.7,0,.2,1) forwards;',
                '}',
                '@keyframes p1Bleed50 {',
                '  0%   { filter: none; }',
                '  35%  { filter: saturate(2.4)',
                '         drop-shadow(2px 0 rgba(0,255,255,.55))',
                '         drop-shadow(-2px 0 rgba(255,0,255,.5)); }',
                '  70%  { filter: saturate(1.6); }',
                '  100% { filter: none; }',
                '}',
                // ── 50-99% pressure: grey stripe + contrast pulse ──
                '#p1-lb.is-pressure {',
                '  background:',
                '    repeating-linear-gradient(',
                '      90deg,',
                '      #777 0 2px,',
                '      #aaa 2px 3px,',
                '      #555 3px 5px',
                '    );',
                '  animation: p1Pressure 900ms steps(4,end) infinite;',
                '}',
                '@keyframes p1Pressure {',
                '  0%,100% { filter: contrast(1.05); }',
                '  50% { filter: contrast(1.35) brightness(1.12); }',
                '}',
                // ── 2026-05-18 段階2.5: 100% plateau refine (override 旧 is-plateau) ──
                '#p1-lb.is-plateau {',
                '  background: linear-gradient(90deg, #777, #bdbdbd 72%, #f2f2f2 98%);',
                '  animation: p1Strain 320ms steps(2,end) infinite;',
                '}',
                '@keyframes p1Strain {',
                '  0% { transform: scaleX(1); }',
                '  50% { transform: scaleX(1.012) skewX(-1deg); }',
                '  100% { transform: scaleX(.998); }',
                '}',
                // ── 101% breakthrough: right-edge RGBCMY color leak eruption ──
                '#p1-lb.is-breakthrough {',
                '  /* bar stays grey; ::after carries the only color moment */',
                '}',
                '#p1-lb.is-breakthrough::after {',
                '  content: "";',
                '  position: absolute;',
                '  right: -6px;',
                '  top: -4px;',
                '  width: 18px;',
                '  height: calc(100% + 8px);',
                '  background: linear-gradient(180deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f);',
                '  filter: blur(2px) brightness(1.8);',
                '  animation: p1ColorLeak 520ms ease-out forwards;',
                '  pointer-events: none;',
                '}',
                '@keyframes p1ColorLeak {',
                '  from { opacity: 0; transform: scaleY(.4); }',
                '  35%  { opacity: 1; transform: scaleY(1.3); }',
                '  to   { opacity: 0; transform: translateX(34px) scaleY(.1); }',
                '}',
                // ── 2026-05-18 段階2.5: runner double-bump wall (override 旧 is-plateau) ──
                '#exit-runner.is-plateau {',
                '  animation: runnerDoubleBump 1500ms cubic-bezier(.7,0,.3,1) forwards;',
                '}',
                '@keyframes runnerDoubleBump {',
                '  0%   { transform: translateX(0); }',
                '  18%  { transform: translateX(6px) scaleX(.85); }',
                '  34%  { transform: translateX(-4px) scaleX(1.05); }',
                '  50%  { transform: translateX(2px); }',
                '  68%  { transform: translateX(10px) scaleX(.8); }',
                '  84%  { transform: translateX(-6px) scaleX(1.08); }',
                '  100% { transform: translateX(4px); }',
                '}',
                // ── 2026-05-18 段階14: UI shell ingest (sphere absorbs Win95 shell) ──
                '.p1-ui-shell-ingest {',
                '  transform-origin: var(--core-x) var(--core-y);',
                '  animation: p1UiShellIngest 1600ms cubic-bezier(.18,.82,.16,1) forwards;',
                '  filter: contrast(1.08) saturate(0.85) brightness(1.15);',
                '}',
                '@keyframes p1UiShellIngest {',
                '  0%   { opacity: 1; transform: translate3d(0,0,0) scale(1);',
                '         clip-path: ellipse(75% 75% at 50% 50%); }',
                '  55%  { opacity: .92; transform: translate3d(var(--pull-x), var(--pull-y), 0) scale(.72);',
                '         clip-path: ellipse(55% 36% at 50% 50%);',
                '         filter: blur(.3px) contrast(1.2) saturate(.7); }',
                '  82%  { opacity: .75; transform: translate3d(var(--pull-x), var(--pull-y), 0) scale(.18);',
                '         clip-path: ellipse(18% 9% at 50% 50%);',
                '         filter: blur(1.2px) brightness(1.7); }',
                '  100% { opacity: 0; transform: translate3d(var(--pull-x), var(--pull-y), 0) scale(.02);',
                '         clip-path: ellipse(2% 2% at 50% 50%);',
                '         filter: blur(3px) brightness(3); }',
                '}',
                // ── 2026-05-18 段階8.1: 個別 UI 要素 hide (black-screen 修正) ──
                '.p1-ui-hidden-after-collapse {',
                '  opacity: 0 !important;',
                '  visibility: hidden !important;',
                '  pointer-events: none !important;',
                '}',
                // ── 2026-05-18 段階15 P0-2: loading bar wall / breach states ──
                '#p1-lb.p1-bar-wall {',
                '  filter: brightness(1.4) contrast(1.25);',
                '  transform: scaleX(1.015);',
                '}',
                '#p1-lb.p1-bar-breach {',
                '  filter: brightness(2.2) saturate(1.4);',
                '  box-shadow: 0 0 18px rgba(255,255,255,.8);',
                '}',
                // ── 2026-05-18 段階15 P1-2: 強化された UI ingest (gravity crush) ──
                '.p1-ui-shell-ingest-strong {',
                '  transform-origin: var(--core-x) var(--core-y);',
                '  animation: p1ShellGravityCrush 1280ms cubic-bezier(.12,.9,.08,1) forwards;',
                '  will-change: transform, clip-path, filter, opacity;',
                '}',
                '@keyframes p1ShellGravityCrush {',
                '  0%   { opacity: 1; transform: translate3d(0,0,0) scale(1) rotate(0deg);',
                '         clip-path: polygon(0 0,100% 0,100% 100%,0 100%);',
                '         filter: blur(0) contrast(1) brightness(1); }',
                '  32%  { opacity: 1; transform: translate3d(calc(var(--pull-x) * .18), calc(var(--pull-y) * .18), 0) scaleX(1.08) scaleY(.82) rotate(-1.2deg);',
                '         clip-path: polygon(3% 8%,98% 0,94% 93%,0 100%);',
                '         filter: blur(.2px) contrast(1.25) brightness(1.15); }',
                '  58%  { opacity: .95; transform: translate3d(calc(var(--pull-x) * .62), calc(var(--pull-y) * .62), 0) scaleX(.48) scaleY(.18) rotate(2.4deg);',
                '         clip-path: polygon(20% 36%,83% 28%,76% 69%,16% 74%);',
                '         filter: blur(1px) contrast(1.6) brightness(1.5); }',
                '  82%  { opacity: .72; transform: translate3d(calc(var(--pull-x) * .9), calc(var(--pull-y) * .9), 0) scaleX(.16) scaleY(.045) rotate(-5deg);',
                '         clip-path: ellipse(18% 6% at 50% 50%);',
                '         filter: blur(2px) contrast(2) brightness(2.2); }',
                // 2026-05-19 段階18: 最後の 5% で更に「snap」を入れる (Codex tweak)
                '  95%  { opacity: .3; transform: translate3d(var(--pull-x), var(--pull-y), 0) scale(.04) rotate(12deg);',
                '         clip-path: ellipse(6% 3% at 50% 50%);',
                '         filter: blur(3px) brightness(3); }',
                '  100% { opacity: 0; transform: translate3d(var(--pull-x), var(--pull-y), 0) scale(.015) rotate(18deg);',
                '         clip-path: ellipse(2% 2% at 50% 50%);',
                '         filter: blur(5px) brightness(4); }',
                '}'
            ].join('\n');
            const style = document.createElement('style');
            style.id = 'p1-stage31-css';
            style.textContent = css;
            document.head.appendChild(style);

            // white flash overlay (モバイルではスキップ)
            if (!IS_MOBILE) {
                const flash = document.createElement('div');
                flash.id = 'p1-white-flash';
                document.body.appendChild(flash);
                state.flashEl = flash;
            }
        } catch (e) {}
    }

    // 2026-05-17 段階3.1: ブレイクスルー音 (glass shatter ish)
    function playBreakthroughCue() {
        const ctx = ensureMorphAudio(); if (!ctx) return;
        try {
            const now = ctx.currentTime;
            // ダウンワード whoosh
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
            osc.connect(gain).connect(state.audioMaster);
            osc.start(now); osc.stop(now + 0.55);
            // ノイズバースト (glass shatter)
            const bufSize = Math.floor(ctx.sampleRate * 0.45);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.8);
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buf;
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 1800;
            const ng = ctx.createGain();
            ng.gain.value = 0.18;
            noise.connect(hp).connect(ng).connect(state.audioMaster);
            noise.start(now + 0.02);

            // 2026-05-18 段階15: 101% breakthrough cue (Codex audio P1)
            //   low boom (42Hz, 0.55s) + air suck (band-passed noise sweep, 1.1s)
            try {
                const boom = ctx.createOscillator();
                const boomG = ctx.createGain();
                boom.type = 'sine';
                boom.frequency.setValueAtTime(64, now);
                boom.frequency.exponentialRampToValueAtTime(42, now + 0.12);
                boomG.gain.setValueAtTime(0.0001, now);
                boomG.gain.exponentialRampToValueAtTime(0.42, now + 0.015);
                boomG.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
                boom.connect(boomG).connect(state.audioMaster);
                boom.start(now); boom.stop(now + 0.6);

                // air suck: filtered noise sweep with rising bandpass
                const suckLen = Math.floor(ctx.sampleRate * 1.1);
                const sBuf = ctx.createBuffer(1, suckLen, ctx.sampleRate);
                const sData = sBuf.getChannelData(0);
                for (let i = 0; i < suckLen; i++) {
                    const env = Math.pow(i / suckLen, 0.7);
                    sData[i] = (Math.random() * 2 - 1) * env;
                }
                const sSrc = ctx.createBufferSource();
                sSrc.buffer = sBuf;
                const bp = ctx.createBiquadFilter();
                bp.type = 'bandpass';
                bp.frequency.setValueAtTime(220, now);
                bp.frequency.exponentialRampToValueAtTime(1800, now + 1.1);
                bp.Q.value = 1.4;
                const sG = ctx.createGain();
                sG.gain.setValueAtTime(0.0001, now);
                sG.gain.exponentialRampToValueAtTime(0.10, now + 0.6);
                sG.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
                sSrc.connect(bp).connect(sG).connect(state.audioMaster);
                sSrc.start(now);
            } catch (e) {}
        } catch (e) {}
    }

    // 2026-05-18 段階4: BIG BANG cue (kick 58Hz + 6音和音 [C D E F# G# A#])
    function playBigBangCue() {
        const ctx = ensureMorphAudio(); if (!ctx) return;
        try {
            const now = ctx.currentTime;
            // Kick: 58Hz sine, exp decay 0.55s
            const kickOsc = ctx.createOscillator();
            const kickGain = ctx.createGain();
            kickOsc.type = 'sine';
            kickOsc.frequency.setValueAtTime(180, now);
            kickOsc.frequency.exponentialRampToValueAtTime(58, now + 0.08);
            kickGain.gain.setValueAtTime(0.0001, now);
            kickGain.gain.exponentialRampToValueAtTime(0.55, now + 0.01);
            kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
            kickOsc.connect(kickGain).connect(state.audioMaster);
            kickOsc.start(now); kickOsc.stop(now + 0.6);
            // 6音和音 (C4 D4 E4 F#4 G#4 A#4)
            const freqs = [261.63, 293.66, 329.63, 369.99, 415.30, 466.16];
            const chordGain = ctx.createGain();
            chordGain.gain.setValueAtTime(0.0001, now);
            chordGain.gain.exponentialRampToValueAtTime(0.7, now + 0.04);
            chordGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
            chordGain.connect(state.audioMaster);
            for (let i = 0; i < freqs.length; i++) {
                const o = ctx.createOscillator();
                o.type = 'sine';
                o.frequency.value = freqs[i];
                o.connect(chordGain);
                o.start(now); o.stop(now + 1.5);
            }
        } catch (e) {}
    }

    // 2026-05-18 段階4: goo ingest rumble (low rumble + filter sweep)
    function playGooRumbleCue() {
        const ctx = ensureMorphAudio(); if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const bufSize = Math.floor(ctx.sampleRate * 2.4);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = buf;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(220, now);
            bp.frequency.exponentialRampToValueAtTime(3200, now + 2.3);
            bp.Q.value = 4;
            const ng = ctx.createGain();
            ng.gain.setValueAtTime(0.0001, now);
            ng.gain.exponentialRampToValueAtTime(0.14, now + 0.6);
            // 2.3-2.4s pre-bang 100ms silence
            ng.gain.exponentialRampToValueAtTime(0.14, now + 2.30);
            ng.gain.linearRampToValueAtTime(0.0001, now + 2.40);
            noise.connect(bp).connect(ng).connect(state.audioMaster);
            noise.start(now); noise.stop(now + 2.45);
            // Low rumble sine drone underneath
            const lo = ctx.createOscillator();
            const loG = ctx.createGain();
            lo.type = 'sine'; lo.frequency.value = 48;
            loG.gain.setValueAtTime(0.0001, now);
            loG.gain.exponentialRampToValueAtTime(0.18, now + 0.5);
            loG.gain.exponentialRampToValueAtTime(0.22, now + 2.0);
            loG.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
            lo.connect(loG).connect(state.audioMaster);
            lo.start(now); lo.stop(now + 2.5);
        } catch (e) {}
    }

    // 2026-05-18 段階4: tunnel rise (2.8s 後に filtered noise + sine 220→880Hz)
    function playTunnelRiseCue() {
        const ctx = ensureMorphAudio(); if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const dur = 2.8;
            const lo = ctx.createOscillator();
            const loG = ctx.createGain();
            lo.type = 'sine';
            lo.frequency.setValueAtTime(220, now);
            lo.frequency.exponentialRampToValueAtTime(880, now + dur);
            loG.gain.setValueAtTime(0.0001, now);
            loG.gain.exponentialRampToValueAtTime(0.10, now + 0.4);
            loG.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            lo.connect(loG).connect(state.audioMaster);
            lo.start(now); lo.stop(now + dur + 0.1);
            // filtered noise rising
            const bufSize = Math.floor(ctx.sampleRate * dur);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const ns = ctx.createBufferSource();
            ns.buffer = buf;
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.setValueAtTime(600, now);
            hp.frequency.exponentialRampToValueAtTime(4000, now + dur);
            const ng = ctx.createGain();
            ng.gain.setValueAtTime(0.0001, now);
            ng.gain.exponentialRampToValueAtTime(0.08, now + 0.5);
            ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            ns.connect(hp).connect(ng).connect(state.audioMaster);
            ns.start(now); ns.stop(now + dur);
        } catch (e) {}
    }

    // 2026-05-17 段階3.1: UI ingest sweep (band-pass 220 → 3200 Hz)
    function playIngestCue() {
        const ctx = ensureMorphAudio(); if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const bufSize = Math.floor(ctx.sampleRate * 1.1);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = buf;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(220, now);
            bp.frequency.exponentialRampToValueAtTime(3200, now + 1.05);
            bp.Q.value = 6;
            const ng = ctx.createGain();
            ng.gain.setValueAtTime(0.0001, now);
            ng.gain.exponentialRampToValueAtTime(0.10, now + 0.5);
            ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
            noise.connect(bp).connect(ng).connect(state.audioMaster);
            noise.start(now); noise.stop(now + 1.15);
        } catch (e) {}
    }

    // 2026-05-17 段階3.1: Win95 UI に prewarp/ingest クラスを適用
    function applyPrewarpClass() {
        // 2026-05-18 段階10.2: legacy phases (WARP_GROW/BREACH) が同時に走るため
        // prewarp の skew/contrast 振動が win95-main を歪ませる → 無効化
        return;
        // 旧コード (フォールバック用に保持):
        // try {
        //     const win = document.getElementById('win95-main');
        //     if (win && !win.classList.contains('p1-window-prewarp')) {
        //         win.classList.add('p1-window-prewarp');
        //     }
        // } catch (e) {}
    }
    // ── 2026-05-18 段階5/6/7: 量子崩壊パーティクルオーバーレイ (WebGL) ──
    // UI ingest と並行して動く。CMY = particle path / RGB = wave path。
    // uCollapse 0→1 で散らばった粒子が中心 (sphere) に収束する。
    function buildQuantumCollapseParticles() {
        if (window.P1_STAGE13_RESET) return null; // Stage 13: chaos overlay disabled
        if (!state.scene || !state.camera || typeof THREE === 'undefined') return null;
        if (state.quantumPoints) return state.quantumPoints; // 二重生成防止
        const COUNT = IS_MOBILE ? 900 : 1800;
        const positions = new Float32Array(COUNT * 3);
        const seeds     = new Float32Array(COUNT);
        const sides     = new Float32Array(COUNT);
        const starts    = new Float32Array(COUNT * 2);

        // bgPlane (dual panels) の NDC をサンプリング。左半分=CMY, 右半分=RGB。
        // Win95 window 中心は UI 用 side=2。
        let win95Rect = null;
        try {
            const w = document.getElementById('win95-main');
            if (w && w.getBoundingClientRect) {
                const r = w.getBoundingClientRect();
                const innerW = window.innerWidth || 1, innerH = window.innerHeight || 1;
                win95Rect = {
                    x0: (r.left  / innerW) * 2 - 1,
                    x1: (r.right / innerW) * 2 - 1,
                    y0: 1 - (r.bottom / innerH) * 2,
                    y1: 1 - (r.top    / innerH) * 2,
                };
            }
        } catch (e) {}

        for (let i = 0; i < COUNT; i++) {
            const r = Math.random();
            let side;
            let sx, sy;
            if (r < 0.36) {
                // CMY: 左半分
                side = 0;
                sx = -0.95 + Math.random() * 0.85; // -0.95..-0.10
                sy = -0.9 + Math.random() * 1.8;
            } else if (r < 0.72) {
                // RGB: 右半分
                side = 1;
                sx = 0.10 + Math.random() * 0.85;
                sy = -0.9 + Math.random() * 1.8;
            } else {
                // UI (win95): rect 内 or 中央近傍
                side = 2;
                if (win95Rect) {
                    sx = win95Rect.x0 + Math.random() * (win95Rect.x1 - win95Rect.x0);
                    sy = win95Rect.y0 + Math.random() * (win95Rect.y1 - win95Rect.y0);
                } else {
                    sx = -0.4 + Math.random() * 0.8;
                    sy = -0.25 + Math.random() * 0.5;
                }
            }
            positions[i * 3]     = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            seeds[i]    = Math.random();
            sides[i]    = side;
            starts[i*2] = sx;
            starts[i*2+1] = sy;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));
        geo.setAttribute('aSide',    new THREE.BufferAttribute(sides, 1));
        geo.setAttribute('aStart',   new THREE.BufferAttribute(starts, 2));

        const QUANT_VERT = [
            'uniform float uTime;',
            'uniform float uCollapse;',
            'attribute float aSeed;',
            'attribute float aSide;',
            'attribute vec2  aStart;',
            'varying vec3 vColor;',
            'varying float vAlpha;',
            'void main(){',
            '    vec2 p = aStart;',
            '    vec2 center = vec2(0.0);',
            '    float t = uCollapse;',
            '    float phase = aSeed * 6.28318;',
            '    float uncertainty = (1.0 - t) * 0.08;',
            '    p += vec2(sin(uTime*6.0+phase), cos(uTime*5.0+phase*1.7)) * uncertainty;',
            '    vec2 particlePath = mix(p, center, smoothstep(0.15, 1.0, t));',
            '    float wave = sin(length(p - center) * 34.0 - uTime * 8.0 + phase);',
            '    vec2 tangent = normalize(vec2(-p.y, p.x) + 0.0001);',
            '    vec2 wavePath = mix(p + tangent * wave * 0.10 * (1.0 - t), center, smoothstep(0.25, 1.0, t));',
            '    vec2 finalP = mix(particlePath, wavePath, step(0.5, aSide));',
            '    if (aSide > 1.5) {',
            '        finalP = mix(particlePath, wavePath, 0.5 + 0.5 * sin(phase));',
            '    }',
            '    vec4 mv = modelViewMatrix * vec4(finalP.x * 4.0, finalP.y * 2.4, 0.0, 1.0);',
            '    gl_Position = projectionMatrix * mv;',
            '    float collapseGlow = smoothstep(0.65, 1.0, t);',
            '    gl_PointSize = mix(2.0, 7.0, collapseGlow) * (1.0 + aSeed);',
            '    vec3 cmy = mix(vec3(0,1,1), vec3(1,0,1), aSeed);',
            '    vec3 rgb = mix(vec3(1,0,0), vec3(0,0.2,1), aSeed);',
            '    vColor = mix(cmy, rgb, step(0.5, aSide));',
            '    vAlpha = 0.35 + collapseGlow * 0.65;',
            '}'
        ].join('\n');
        const QUANT_FRAG = [
            'precision highp float;',
            'varying vec3 vColor;',
            'varying float vAlpha;',
            'void main(){',
            '    vec2 uv = gl_PointCoord - 0.5;',
            '    float d = length(uv);',
            '    float a = smoothstep(0.5, 0.05, d);',
            '    gl_FragColor = vec4(vColor, a * vAlpha);',
            '}'
        ].join('\n');

        const mat = new THREE.ShaderMaterial({
            vertexShader:   QUANT_VERT,
            fragmentShader: QUANT_FRAG,
            uniforms: {
                uTime:     { value: 0 },
                uCollapse: { value: 0 },
            },
            transparent: true,
            depthWrite:  false,
            depthTest:   false,
            blending:    THREE.AdditiveBlending,
        });
        const pts = new THREE.Points(geo, mat);
        pts.name = 'p1QuantumCollapse';
        pts.frustumCulled = false;
        pts.renderOrder = 9997;
        // camera の子にしてフルスクリーン固定
        try {
            if (state.camera && state.camera.isPerspectiveCamera) {
                pts.position.set(0, 0, -0.6);
                state.camera.add(pts);
                if (!state.camera.parent) state.scene.add(state.camera);
            } else {
                pts.position.set(0, 0, 0.4);
                state.scene.add(pts);
            }
        } catch (e) {
            try { state.scene.add(pts); } catch (e2) {}
        }
        state.quantumPoints  = pts;
        state.quantumMat     = mat;
        state.quantumGeo     = geo;
        state.quantumStartMs = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        return pts;
    }

    function disposeQuantumCollapse() {
        try {
            if (state.quantumPoints) {
                if (state.quantumPoints.parent) state.quantumPoints.parent.remove(state.quantumPoints);
            }
            if (state.quantumGeo) state.quantumGeo.dispose();
            if (state.quantumMat) state.quantumMat.dispose();
        } catch (e) {}
        state.quantumPoints = null;
        state.quantumGeo = null;
        state.quantumMat = null;
    }

    function applyIngestClass() {
        // 2026-05-18 段階10 B案: Stage 4 reality collapse / quantum particles を停止
        // 旧 tunnelPlane / haloPlane / warpTunnel の自然な「飲み込み」演出を採用するため
        return;
        // 2026-05-18 段階4.2: Reality Frame Collapse へ置換
        //   Codex: 101% は Win95 window だけではなく .phase-1 全域を溶解させる。
        //   旧 createUiIngestClone (#win95-main) は左右パネル/外枠が残り
        //   "四角の中で四角が縮む" 違和感があった → reality frame 全体を clone。
        try {
            // 旧: discoverWin95Root() ベースの ingest source キャッシュ。fallback 用に残す。
            if (!state.win95Root) {
                state.win95Root = discoverWin95Root();
            }
            // 段階4.2: P1 root (.phase-1) 全体を発見
            if (!state.realityFrameRoot) {
                state.realityFrameRoot = discoverRealityFrameRoot();
                if (state.realityFrameRoot) {
                    try {
                        const el = state.realityFrameRoot;
                        console.log('[P1 stage4.2] discoverRealityFrameRoot →',
                            el,
                            '(' + (el.tagName || '') + '#' + (el.id || '') + '.' + (el.className || '') + ')',
                            el.getBoundingClientRect());
                    } catch (e) {}
                }
            }
            const rootSrc = state.realityFrameRoot || state.win95Root;
            if (!rootSrc) return;
            // prewarp class は元に付いている可能性があるので外す
            try {
                if (state.win95Root && state.win95Root.classList) {
                    state.win95Root.classList.remove('p1-window-prewarp');
                }
            } catch (e) {}
            // 2026-05-18 段階4: SVG goo filter を保証 (warp overlay と層をなす)
            ensureP1GooFilter();

            // ── 旧コード (段階3.2/4): #win95-main のみ clone — フォールバック用に保持 ──
            // const pair = createUiIngestClone(rootSrc);
            // if (!pair) return;
            // state.uiIngestClone = pair.clone;
            // state.uiIngestSource = pair.source;

            // ── 段階4.2: Reality Frame Clone (P1 root 全体) ──
            const pair = createRealityFrameClone();
            if (!pair) return;
            state.realityFrame = pair;
            state.uiIngestClone = pair.clone;     // 既存コードとの後方互換
            state.uiIngestSource = pair.source;
            // フルスクリーン warp overlay
            state.screenWarp = createScreenWarpOverlay();
            // 2026-05-18 段階8.1: black-screen 修正
            //   旧: body.background='#000' + createVoidBackdrop() + .phase-1 visibility:hidden
            //        → 下層 Three.js canvas (sphere/tunnel/eye/cross) を全部黒で覆い隠していた。
            //   新: void backdrop と body 黒化を撤去 (Three.js scene の暗背景がそのまま見える)、
            //        個別 UI のみ hideP1UiOnly() で hide、canvas は liftP1Canvas() で持ち上げる。
            // 旧コード:
            //   try { document.body.style.background = '#000'; } catch (e) {}
            //   try { state.voidBackdrop = createVoidBackdrop(); } catch (e) {}
            try { hideP1UiOnly(); } catch (e) {}
            try { liftP1Canvas(); } catch (e) {}
            try {
                console.log('[P1 stage8.1] canvases:',
                    document.querySelectorAll('canvas').length,
                    'phase:', !!document.querySelector('.phase-1'));
            } catch (e) {}
            try {
                const runner = document.getElementById('exit-runner');
                if (runner) {
                    setTimeout(function(){
                        try { runner.style.visibility = 'hidden'; runner.style.opacity = '0'; } catch (e) {}
                    }, 1400);
                }
            } catch (e) {}

            state.ingestStartMs = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            // 2026-05-18 段階2.5: alias for Codex text degradation sequence
            state.ingestStartTime = state.ingestStartMs;
            // 2026-05-18 段階5/6/7: 量子崩壊 WebGL オーバーレイを同時起動
            // 粒子は reality-frame collapse の下層に layer される (Z 順は WebGL canvas に依存)。
            try { buildQuantumCollapseParticles(); } catch (e) {}
            // CSS フェード (p1-quantum-collapse) も元 root に付与 (sphere/tunnel と層をなす)
            try {
                if (rootSrc && rootSrc.classList) rootSrc.classList.add('p1-quantum-collapse');
            } catch (e) {}
            requestAnimationFrame(function(){
                try {
                    // 段階4.2: reality-frame-collapse animation を発火
                    pair.clone.classList.add('reality-frame-collapse');
                    // 後方互換 (既存 hook/teardown が .p1-goo-ingest を待つかもしれない)
                    pair.clone.classList.add('p1-goo-ingest');
                    // Easter Egg 1: CMY ink bleed (最初の 600ms)
                    if (!REDUCE_MOTION) {
                        pair.clone.classList.add('is-cmy-ink');
                        state.easterCmyInked = true;
                        setTimeout(function(){
                            try { pair.clone.classList.remove('is-cmy-ink'); } catch (e) {}
                        }, 600);
                    }
                } catch (e) {}
                // ingest dur (2.4s) + 余裕 ~0.1s 後に clone / overlay を片付ける
                setTimeout(function(){
                    try {
                        if (state.realityFrame && state.realityFrame.clone) {
                            state.realityFrame.clone.remove();
                        }
                    } catch (e) {}
                    try {
                        if (state.screenWarp && state.screenWarp.remove) {
                            state.screenWarp.remove();
                        }
                    } catch (e) {}
                    // 元 DOM は visibility:hidden のまま保持 (post-handoff state 用)
                }, 2500);
            });
        } catch (e) {}
    }
    function triggerBarBurst() {
        try {
            const bar = document.getElementById('p1-lb');
            if (bar) {
                bar.classList.add('p1-bar-burst');
                // force reflow then add is-burst
                void bar.offsetWidth;
                bar.classList.add('is-burst');
            }
        } catch (e) {}
    }
    function triggerWhiteFlash() {
        if (IS_MOBILE) return; // モバイルではフラッシュ省略
        if (!state.flashEl) return;
        try {
            state.flashEl.classList.remove('is-flashing');
            void state.flashEl.offsetWidth;
            state.flashEl.classList.add('is-flashing');
        } catch (e) {}
    }

    // 2026-05-17 段階3.1: breakthrough 本体
    function fireBreakthrough() {
        if (state.breakthroughFired) return;
        state.breakthroughFired = true;
        // 2026-05-18 段階2.5: record breakthrough timestamp for text degradation
        state.breakthroughTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        triggerBarBurst();
        triggerWhiteFlash();
        // 2026-05-18 段階3.2: bar breakthrough animation + sparks
        try {
            const bar = document.getElementById('p1-lb');
            if (bar) {
                bar.classList.remove('is-plateau');
                bar.classList.add('is-breakthrough');
            }
        } catch (e) {}
        emitBarSparks();
        if (!REDUCE_MOTION && !state.audio_breakthroughFired) {
            state.audio_breakthroughFired = true;
            playBreakthroughCue();
        }
        try {
            window.dispatchEvent(new CustomEvent('inryoku:p1_breakthrough', {
                detail: {
                    scene:    state.scene,
                    camera:   state.camera,
                    renderer: state.renderer,
                }
            }));
        } catch (e) {}
    }
    function firePrewarpEvent() {
        if (state.prewarpEventFired) return;
        state.prewarpEventFired = true;
        try {
            window.dispatchEvent(new CustomEvent('inryoku:p1_prewarp', {
                detail: {
                    scene:    state.scene,
                    camera:   state.camera,
                    renderer: state.renderer,
                }
            }));
        } catch (e) {}
    }

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
        // 2026-05-18 段階10 B案: 旧 tunnel/halo/warp/bg は隠さず、legacy 演出を復活
        // greySphere のみ非表示（新 sphere morph と二重表示しないため）
        const names = ['p1-old-grey-sphere'];
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
                // 2026-05-17 段階3.1: 100% plateau 駆動 (0→1 across 10.2→11.7)
                uHundredPlateau: { value: 0 },
                // 2026-05-18 段階4: big bang / compression / tunnel / center
                uCompression: { value: 0 },
                uBang:        { value: 0 },
                uTunnel:      { value: 0 },
                uCenter:      { value: new THREE.Vector2(0, 0) },
                // 2026-05-18 段階5/6/7: 後続フェーズ駆動 (Stage5/6/7 が直接書き換え)
                uTunnelPhase: { value: 0 },
                uWhitePhase:  { value: 0 },
                uEyePhase:    { value: 0 },
                uCrossPhase:  { value: 0 },
                // 2026-05-18 Stage 13: white-birth (球そのものが白光へ変容)
                uWhiteBirth:  { value: 0 },
                // 2026-05-18 段階15: premonition core (0-2s) — Codex P0-1
                uPremonitionAlpha: { value: 0.0 },
                // 2026-05-18 段階15: gravity pulse (7.2-8.5s ingest punch) — Codex P1-2
                uGravityPulse: { value: 0.0 },
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

        // 2026-05-17 段階3.1: CSS 注入 (prewarp / ingest / bar burst / flash)
        state.isMobile = IS_MOBILE;
        injectStage31CSS();

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
            // 2026-05-17 段階3.1: prewarp/breakthrough も即発火
            state.stage2Fired = true;
            state.prewarpEventFired = true;
            state.breakthroughFired = true;
            setTimeout(function() {
                try {
                    window.dispatchEvent(new CustomEvent('inryoku:p1_prewarp', {
                        detail: { scene: state.scene, camera: state.camera, renderer: state.renderer }
                    }));
                } catch (e) {}
            }, 80);
            setTimeout(function() {
                try {
                    window.dispatchEvent(new CustomEvent('inryoku:p1_breakthrough', {
                        detail: { scene: state.scene, camera: state.camera, renderer: state.renderer }
                    }));
                } catch (e) {}
            }, 140);
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

    // 2026-05-18 Stage 13: chaos overlay を強制非表示 (1 度だけ)
    function hideChaosOverlays() {
        if (!state.scene) return;
        const names = [
            'p1-old-tunnel-plane',
            'p1-old-halo-plane',
            'p1-old-warp-tunnel'
            // bgPlane (p1-old-dual-bg) は legacy merge 表示のため残す
        ];
        names.forEach(function(n) {
            const o = state.scene.getObjectByName(n);
            if (o) o.visible = false;
        });
    }

    // 2026-05-18 段階14: UI shell ingest — sphere absorbs Win95 shell at 7.2s
    //   Codex final plan: subject is sphere, UI is固定概念 → one thin DOM clone
    //   absorbed cleanly into the sphere center. Followed by scissor unlock.
    // 2026-05-19 段階17: "101" text flash (concept-breaking moment)
    function triggerStage17TextFlash() {
        // 2026-05-19 段階19.1: バー位置 + 虹フォント。中央巨大表示は廃止 (安っぽい)
        try {
            if (typeof document === 'undefined') return;
            // バー要素を起点に配置
            const bar = document.getElementById('p1-lb');
            const lpct = document.getElementById('p1-lpct');
            const anchor = lpct || bar;
            if (!anchor) return;
            const rect = anchor.getBoundingClientRect();
            const el = document.createElement('div');
            el.id = 'p1-stage17-text';
            el.textContent = '101';
            Object.assign(el.style, {
                position: 'fixed',
                left: (rect.right + 8) + 'px',
                top:  (rect.top - 4) + 'px',
                font: '900 28px/1 ui-monospace, monospace',
                background: 'linear-gradient(90deg,#ff0000,#ff8800,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff)',
                'background-clip': 'text',
                '-webkit-background-clip': 'text',
                color: 'transparent',
                '-webkit-text-fill-color': 'transparent',
                letterSpacing: '-0.02em',
                textShadow: '0 0 18px rgba(255,255,255,0.65)',
                filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.45))',
                zIndex: '2147483646',
                pointerEvents: 'none',
                opacity: '0',
                transform: 'translateY(2px) scale(0.92)',
                transition: 'opacity 120ms ease-out, transform 220ms cubic-bezier(.16,1,.3,1)'
            });
            document.body.appendChild(el);
            requestAnimationFrame(function () {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0) scale(1.0)';
            });
            setTimeout(function () {
                el.style.transition = 'opacity 220ms ease-in, transform 260ms ease-in';
                el.style.opacity = '0';
                el.style.transform = 'translateY(-2px) scale(1.04)';
            }, 520);
            setTimeout(function () { try { el.remove(); } catch (e) {} }, 820);
        } catch (e) {}
    }

    function startStage14UiIngest() {
        if (state.stage14IngestFired) return;
        state.stage14IngestFired = true;
        // runner is-ingesting toggle が外れないよう ingestFired を立てる
        state.ingestFired = true;
        try {
            const win = document.getElementById('win95-main');
            if (!win || !state.mesh || !state.camera) return;

            // sphere → screen position
            const v = state.mesh.position.clone().project(state.camera);
            const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
            const rect = win.getBoundingClientRect();

            const clone = win.cloneNode(true);
            clone.id = 'p1-ui-shell-clone';
            clone.querySelectorAll('[id]').forEach(function (el) {
                el.id = 'shell-' + el.id;
            });
            clone.querySelectorAll('canvas').forEach(function (c) { c.remove(); });
            // 2026-05-18 段階15 P1-2: 強化版 ingest (shorter, gravity crush)
            //   旧: clone.classList.add('p1-ui-shell-ingest');
            clone.classList.add('p1-ui-shell-ingest-strong');

            Object.assign(clone.style, {
                position:     'fixed',
                left:         rect.left + 'px',
                top:          rect.top + 'px',
                width:        rect.width + 'px',
                height:       rect.height + 'px',
                margin:       '0',
                zIndex:       '2147482000',
                pointerEvents:'none'
            });
            clone.style.setProperty('--core-x', (sx - rect.left) + 'px');
            clone.style.setProperty('--core-y', (sy - rect.top) + 'px');
            clone.style.setProperty('--pull-x', (sx - rect.left - rect.width / 2) + 'px');
            clone.style.setProperty('--pull-y', (sy - rect.top - rect.height / 2) + 'px');

            document.body.appendChild(clone);
            // 元の win95-main は非表示 (clone が吸引アニメを担う)
            win.style.opacity = '0';
            state.stage14Clone = clone;
            // Priority 2: runner も球へ吸われる (既存 is-ingesting class を利用)
            try {
                const runner = document.getElementById('exit-runner');
                if (runner) {
                    runner.classList.remove('is-plateau');
                    runner.classList.remove('is-breakthrough');
                    runner.classList.add('is-ingesting');
                }
            } catch (e) {}
            // 2026-05-18 段階15 P1-2: cleanup を 1350ms に短縮 (旧 1700ms)
            setTimeout(function () {
                try { if (state.stage14Clone === clone) clone.remove(); } catch (e) {}
            }, 1350);
        } catch (e) {}
    }

    // 2026-05-18 段階15: Stage 13 loading bar sync (Codex P0-2)
    //   バー (#p1-lb) とテキスト (#p1-lpct) を Stage 13 の 14s タイムラインに合わせて駆動。
    //   50→99.5 → wall(100) → breach(101)
    // 2026-05-19 段階19: 22s timeline (option A 中速) — bar progress 再設計
    // 0-13s: 50→99.5 (smoothstep) / 13-14s: 100 wall / 14s+: 101 breach
    function stage13Progress(t) {
        if (t < 13.0) {
            const p = Math.max(0, Math.min(1, t / 13.0));
            const ease = p * p * (3 - 2 * p); // smoothstep
            return 50 + ease * 49.5; // 50 → 99.5
        }
        if (t < 14.0) return 100;
        if (t < 14.42) return 100; // hold during 101 flash setup
        return 101;
    }
    // 旧 stage13Progress (14s timeline) — 2026-05-19 段階19 で置換、保持コメント
    // function stage13Progress(t) {
    //     const p = Math.max(0, Math.min(1, t / 14.0));
    //     if (p < 0.72) { ... 50→99.5 ... } if (p<0.78) return 100; ... 100→101
    // }
    function updateStage13Bar(t) {
        try {
            const lb = document.getElementById('p1-lb');
            const lpct = document.getElementById('p1-lpct');
            if (!lb && !lpct) return;
            const percent = stage13Progress(t);
            const visual = Math.min(percent, 101);
            if (lb) lb.style.width = visual + '%';
            if (lpct) {
                // 2026-05-19 段階19: 22s timeline テキスト
                if (t < 13.0) {
                    lpct.textContent = 'Loading reality... ' + Math.round(visual) + '%';
                } else if (t < 14.0) {
                    lpct.textContent = 'Loading reality... 100%';
                } else {
                    lpct.textContent = 'Loading reality... 101%';
                }
            }
            if (lb) {
                lb.classList.toggle('p1-bar-wall',   visual >= 99.5 && visual < 100.5);
                lb.classList.toggle('p1-bar-breach', visual >= 100.5);
            }
        } catch (e) {}
    }

    // 2026-05-19 段階19: runner を stage13Progress に同期 (50→101 連続走行)
    function updateStage13Runner(t) {
        try {
            const runner = state.runner || document.getElementById('exit-runner');
            if (!runner) return;
            state.runner = runner;
            runner.style.display    = 'block';
            runner.style.visibility = 'visible';
            runner.style.opacity    = '1';
            const percent = stage13Progress(t);
            const leftPct = Math.min(101, Math.max(50, percent));
            runner.style.left = leftPct + '%';
            // 状態クラス
            runner.classList.toggle('is-plateau',
                percent >= 99.5 && percent < 100.5);
            runner.classList.toggle('is-breakthrough',
                percent >= 100.5 && t < 14.5);
            runner.classList.toggle('is-ingesting', t >= 14.5);
        } catch (e) {}
    }

    // 2026-05-19 段階19: 22s cinematic timeline (option A 中速) — replaces 14s ver
    //   0-6s    legacy merge play (bar 50→78%, runner走, sphere premonition core)
    //   6-9s    陰陽 sphere clearly visible (3s yin-yang hold)
    //   9-13s   陰陽 → grey → RGBCMY morph (uReveal 0→1)
    //   13-14s  bar 99→100% wall
    //   14-14.42s "101" text flash
    //   14.5-17s UI shell ingest + bg fade (smooth opacity, no snap)
    //   17-19s  white light alone (sphere breathes)
    //   19-21s  closed eye fades in
    //   21-22s  eye opens
    //   22-23s  cross flash
    //   23s     P1 end
    // 旧 14s timeline 実装は git history 参照 (2026-05-18 Stage 13)
    function updateStage13(t) {
        const u = state.mat.uniforms;
        u.uTime.value = t;
        if (state.camera && u.uCameraPos) {
            u.uCameraPos.value.copy(state.camera.position);
        }
        // 球はゆったり回転 (12°/s)
        state.mesh.rotation.y = t * 0.2094;

        if (!state.s13_chaosHidden) {
            state.s13_chaosHidden = true;
            hideChaosOverlays();
        }

        // 2026-05-19 段階19: loading bar + runner 同期
        updateStage13Bar(t);
        updateStage13Runner(t);

        // sphere は常に可視 (premonition → full)
        state.mesh.visible = true;

        // PHASE 0: legacy merge play (0-6s) — sphere premonition core
        if (t < 6.0) {
            const pre = Math.min(1, t / 6.0);
            const preEase = pre * pre * (3 - 2 * pre);
            state.mesh.scale.setScalar(0.65 + preEase * 0.20);
            if (u.uPremonitionAlpha) {
                u.uPremonitionAlpha.value = 0.05 + preEase * 0.25;
            }
            u.uReveal.value     = 0;
            u.uWhiteBirth.value = 0;
            u.uTaichiMix.value  = 0;
            return;
        }

        // t>=6s: 通常 alpha + full scale
        state.mesh.scale.setScalar(1.0);
        if (u.uPremonitionAlpha) u.uPremonitionAlpha.value = 1.0;

        // PHASE A: 陰陽球がはっきり見える (6-9s)
        if (t < 9.0) {
            const p = (t - 6.0) / 3.0;
            u.uTaichiMix.value  = Math.min(1, p * 1.5); // 加速して 1 で hold
            u.uReveal.value     = 0;
            u.uWhiteBirth.value = 0;
            return;
        }

        // PHASE B: 陰陽 → グレー → RGBCMY (9-13s)
        if (t < 13.0) {
            u.uTaichiMix.value  = 1;
            const raw = (t - 9.0) / 4.0;
            u.uReveal.value     = holdThenJump(Math.max(0, Math.min(1, raw)));
            u.uWhiteBirth.value = 0;
            return;
        }

        // PHASE C: bar 99→100 wall (13-14s, sphere holds RGBCMY)
        if (t < 14.0) {
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 1;
            return;
        }

        // PHASE D: "101" text flash (14-14.42s)
        if (t < 14.42) {
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 1;
            if (!state.text101Fired) {
                state.text101Fired = true;
                triggerStage17TextFlash();
            }
            return;
        }

        // PHASE E: UI ingest + bg fade (14.42-17s, ingest起動は14.5)
        if (t < 17.0) {
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 1;
            if (!state.stage14UnlockFired) {
                state.stage14UnlockFired = true;
                window.p1FullScreenUnlocked = true;
                if (!state.stage14TitleSwapped) {
                    state.stage14TitleSwapped = true;
                    try {
                        const win = document.getElementById('win95-main');
                        if (win) {
                            const titleSpan = win.querySelector('span');
                            if (titleSpan) titleSpan.textContent = 'REALITY.SYS BREACHED';
                        }
                    } catch (e) {}
                }
            }
            if (t >= 14.5 && !state.stage14IngestFired) {
                startStage14UiIngest();
            }
            // Smooth bg fade — opacity / u_alpha 経由 (snap visible=false 回避)
            try {
                const dualBg = state.scene && state.scene.getObjectByName('p1-old-dual-bg');
                if (dualBg && dualBg.material) {
                    const c = Math.max(0, Math.min(1, (t - 14.5) / 2.5));
                    if (dualBg.material.uniforms && dualBg.material.uniforms.u_frameCollapse) {
                        const bu = dualBg.material.uniforms;
                        bu.u_frameCollapse.value = Math.max(bu.u_frameCollapse.value || 0, c);
                        if (bu.u_alpha) {
                            bu.u_alpha.value = Math.min(
                                bu.u_alpha.value !== undefined ? bu.u_alpha.value : 1.0,
                                1.0 - c
                            );
                        } else {
                            if (!dualBg.material.transparent) {
                                dualBg.material.transparent = true;
                                dualBg.material.needsUpdate = true;
                            }
                            dualBg.material.opacity = Math.max(0.0, 1.0 - c);
                        }
                    } else {
                        // uniforms 無し fallback
                        if (!dualBg.material.transparent) {
                            dualBg.material.transparent = true;
                            dualBg.material.needsUpdate = true;
                        }
                        dualBg.material.opacity = Math.max(0.0, 1.0 - c);
                    }
                }
            } catch (e) {}
            // White birth ramp (14.5-17s)
            if (t >= 14.5) {
                const w = Math.min(1, (t - 14.5) / 2.5);
                u.uWhiteBirth.value = w;
            }
            // Force black bg from 14.5
            if (!state.bgBlackSet && t >= 14.5) {
                state.bgBlackSet = true;
                try {
                    if (state.renderer && state.renderer.setClearColor) {
                        state.renderer.setClearColor(0x000000, 1);
                    }
                    if (typeof document !== 'undefined') {
                        document.body.style.background = '#000';
                        const root = document.querySelector('.phase-1');
                        if (root) root.style.background = '#000';
                    }
                } catch (e) {}
            }
            return;
        }

        // PHASE F: white light alone (17-19s) — sphere breathes
        if (t < 19.0) {
            u.uTaichiMix.value  = 1;
            u.uReveal.value     = 1;
            u.uWhiteBirth.value = 1;
            state.mesh.scale.setScalar(1.0 + Math.sin((t - 17.0) * 2.0) * 0.03);
            // bgPlane を完全に隠す (fade完了後のみ)
            if (!state.bgEaten) {
                state.bgEaten = true;
                try {
                    const dualBg = state.scene && state.scene.getObjectByName('p1-old-dual-bg');
                    if (dualBg) dualBg.visible = false; // ← bgPlane のみ。球(state.mesh)は対象外
                } catch (e) {}
            }
            if (!state.s13_whiteFired) {
                state.s13_whiteFired = true;
                state.stage2Fired = true;
                try {
                    window.dispatchEvent(new CustomEvent('inryoku:p1stage2complete'));
                } catch (e) {}
            }
            return;
        }

        // PHASE G: eye fade-in (19-21s)
        if (t < 21.0) {
            u.uWhiteBirth.value = 1;
            u.uEyePhase.value   = Math.min(1, (t - 19.0) / 2.0);
            state.mesh.scale.setScalar(1.0);
            if (!state.s13_eyeFired) {
                state.s13_eyeFired = true;
                try {
                    window.dispatchEvent(new CustomEvent('inryoku:p1stage5complete'));
                } catch (e) {}
            }
            return;
        }

        // PHASE H: eye opens + solar flash (21-22s)
        if (t < 22.0) {
            u.uWhiteBirth.value = 1;
            u.uEyePhase.value   = 1;
            if (!state.s13_eyeOpenFired) {
                state.s13_eyeOpenFired = true;
            }
            return;
        }

        // PHASE I: cross flash (22-23s)
        if (t < 23.0) {
            u.uWhiteBirth.value = 1;
            u.uEyePhase.value   = 1;
            u.uCrossPhase.value = Math.max(0, Math.min(1, (t - 22.0)));
            if (!state.s13_crossFired) {
                state.s13_crossFired = true;
                try {
                    window.dispatchEvent(new CustomEvent('inryoku:p1stage6complete'));
                } catch (e) {}
            }
            return;
        }

        // PHASE J: end (P1_ONLY_MODE blocks renderPhase2)
        u.uCrossPhase.value = 1;
        if (!state.s13_p2Fired) {
            state.s13_p2Fired = true;
            try {
                window.__inryokuP1ToP2 = {
                    from: 'cross',
                    ts: performance.now(),
                    seedLine: { x: 0, y0: -1, y1: 1, color: 'white', phase: 'vertical-axis' }
                };
                window.dispatchEvent(new CustomEvent('inryoku:p1complete'));
            } catch (e) {}
        }
    }

    function updateStage(t) {
        if (!state.mat || !state.mesh) return;
        // 2026-05-18 Stage 13: clean reset — 単一線形タイムライン
        if (window.P1_STAGE13_RESET) {
            updateStage13(t);
            return;
        }
        // 2026-05-18 段階3.2: dt 計算 (bar visualPct lerp 用)
        const nowMs = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const dt = state.lastTime ? Math.min(0.1, (nowMs - state.lastTime) / 1000) : 0.016;
        state.lastTime = nowMs;
        const u = state.mat.uniforms;
        u.uTime.value = t;
        if (state.camera && u.uCameraPos) {
            u.uCameraPos.value.copy(state.camera.position);
        }

        // 回転 ~12°/sec
        state.mesh.rotation.y = t * 0.2094;

        // 2026-05-18 段階4: 毎フレーム sphere の NDC を shared bus に公開
        //   (tunnel が uCenter として読み込み、球から放射されるよう同期)
        if (state.camera && state.mesh) {
            try {
                const cv = state.mesh.getWorldPosition(new THREE.Vector3());
                cv.project(state.camera);
                u.uCenter.value.set(cv.x, cv.y);
                window._p1ShaderShared = window._p1ShaderShared || {};
                window._p1ShaderShared.centerX = cv.x;
                window._p1ShaderShared.centerY = cv.y;
            } catch (e) {}
        }

        // 2026-05-18 段階11: 全 legacy material に「球の中心 UV」を配る
        //   各 plane は world (0,0,*) 中心に置かれているので、球の world XY を
        //   plane の幅高さで正規化して UV (0..1) を求める。
        //   これで tunnel/halo/warp/bg-swirl の中心点が必ず球の位置になる。
        try {
            if (state.camera && state.mesh && state.scene) {
                const wp = state.mesh.getWorldPosition(new THREE.Vector3());
                const targets = [
                    'p1-old-tunnel-plane',
                    'p1-old-halo-plane',
                    'p1-old-warp-tunnel',
                    'p1-old-dual-bg'
                ];
                for (let i = 0; i < targets.length; i++) {
                    const obj = state.scene.getObjectByName(targets[i]);
                    if (!obj || !obj.material || !obj.material.uniforms) continue;
                    if (!obj.material.uniforms.u_centerUV) continue;
                    // plane の world サイズを推定（geometry.parameters.width/height × scale）
                    const geom = obj.geometry;
                    let pw = 1, ph = 1;
                    if (geom && geom.parameters) {
                        pw = (geom.parameters.width  || 1) * (obj.scale.x || 1);
                        ph = (geom.parameters.height || 1) * (obj.scale.y || 1);
                    }
                    // plane の world 中心からのオフセットを正規化 → UV
                    const localX = wp.x - obj.position.x;
                    const localY = wp.y - obj.position.y;
                    const uvx = 0.5 + (pw > 0 ? localX / pw : 0);
                    const uvy = 0.5 + (ph > 0 ? localY / ph : 0);
                    obj.material.uniforms.u_centerUV.value.set(uvx, uvy);
                }
            }
        } catch (e) {}

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
        } else if (t < BREAKTHROUGH_T) {
            // ── 2026-05-17 段階3.1: 100% Plateau (10.2 → 11.7s, 1.5s) ──
            // バーは EXACTLY 100% で停止、UI が微震、audio duck
            const hold = t - MORPH_END;
            const plateau = Math.max(0, Math.min(1, hold / (BREAKTHROUGH_T - MORPH_END)));
            state.mesh.scale.setScalar(1.0 + 0.008 * Math.sin(hold * 1.2));
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 1.0; // snap to 100
            u.uHundredPlateau.value = plateau;
            state.hundredPlateau = plateau;
            // prewarp class adoption (即時) + audio duck once
            if (!state.prewarpFired) {
                state.prewarpFired = true;
                applyPrewarpClass();
                if (!REDUCE_MOTION && !state.audio_duckFired) {
                    state.audio_duckFired = true;
                    duckMaster();
                }
            }
        } else if (t < SETTLE_END) {
            // ── 2026-05-17 段階3.1: BREAKTHROUGH (11.7 → 12.0s, 300ms) ──
            // bar 突破: scaleX 1.08, white flash, glass-shatter audio, event fire
            if (!state.breakthroughFired) {
                fireBreakthrough();
            }
            const bp = (t - BREAKTHROUGH_T) / (SETTLE_END - BREAKTHROUGH_T);
            // reveal を 1.0 → 1.01 へ overshoot 表示 (バー視覚のみ)
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 1.0 + 0.01 * easeOutCubic(bp);
            u.uHundredPlateau.value = 1.0;
            state.mesh.scale.setScalar(1.0 + 0.012 * Math.sin(t * 1.4));
        } else if (t < BANG_T) {
            // ── 2026-05-18 段階4: INGEST (12.0 → 14.4s, 2400ms) ──
            //   旧 SETTLE_END→STAGE2_FIRE_T (12.0→12.4 = 400ms) を 2400ms に拡張。
            //   1) goo ingest 開始 (t=12.0s)
            //   2) anticipation 圧縮 (ingestElapsed 1.5→2.4s, sphere shrink 22% + uCompression)
            //   3) pre-bang grey-point easter (t=2.3-2.4s)
            //   4) BANG @ t=14.4s (uBang ramp + dispatch events)
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 1.01;
            u.uHundredPlateau.value = 1.0;
            if (!state.ingestFired) {
                state.ingestFired = true;
                applyIngestClass();
                if (!REDUCE_MOTION && !state.audio_ingestFired) {
                    state.audio_ingestFired = true;
                    playIngestCue();
                }
                if (!REDUCE_MOTION && !state.audio_gooFired) {
                    state.audio_gooFired = true;
                    playGooRumbleCue();
                }
                // Easter Egg 3: runner becomes last bright dot (centered on sphere)
                try {
                    const r = state.runner || document.getElementById('exit-runner');
                    if (r) {
                        state.runner = r;
                        r.classList.add('is-final-particle');
                    }
                } catch (e) {}
            }
            const ingestElapsed = t - INGEST_START_T;
            // 2026-05-18 段階5/6/7: 量子粒子の uCollapse を駆動 (0→1 over 1.4s, then hold)
            if (state.quantumMat && state.quantumMat.uniforms) {
                const qc = Math.max(0, Math.min(1, ingestElapsed / 1.4));
                state.quantumMat.uniforms.uCollapse.value = qc;
                state.quantumMat.uniforms.uTime.value = t;
            }
            // 2026-05-18 段階9: legacy bgPlane (p1-old-dual-bg) を白/黒 swirl 素材として駆動
            try {
                const _bg = state.scene && state.scene.getObjectByName('p1-old-dual-bg');
                if (_bg && _bg.material && _bg.material.uniforms && _bg.material.uniforms.u_frameCollapse) {
                    _bg.visible = true; // bgPlane を残す
                    const collapseT = Math.max(0, Math.min(1, ingestElapsed / 2.0));
                    _bg.material.uniforms.u_frameCollapse.value = collapseT;
                }
            } catch (e) {}
            // anticipation compression (1.5 → 2.4s into ingest)
            const compressT = Math.max(0, Math.min(1, (ingestElapsed - 1.5) / 0.9));
            const compress = compressT * compressT * (3 - 2 * compressT);
            const scaleBase = 1.0 - compress * 0.22 + Math.sin(t * 0.042 * 1000) * compress * 0.006;
            state.mesh.scale.setScalar(scaleBase + 0.008 * Math.sin(t * 1.2) * (1 - compress));
            u.uCompression.value = compress;
            // Easter Egg 2: brief grey-point at ingestElapsed 2.3-2.4s (100ms desat)
            if (!state.easterGreyPointFired && ingestElapsed >= 2.30 && ingestElapsed < 2.40) {
                state.easterGreyPointFired = true;
                // reveal を一時的に 0 に戻す (グレーに見える瞬間)
                u.uReveal.value = 0.0;
                state.mesh.scale.setScalar(0.04); // 小さなグレー点
            }
        } else {
            // ── 2026-05-18 段階4: BIG BANG + tunnel + stage2complete (≥14.4s) ──
            u.uTaichiMix.value = 1;
            u.uReveal.value    = 1.01;
            u.uHundredPlateau.value = 1.0;
            // BANG initial fire (一度だけ)
            if (!state.bangFired) {
                state.bangFired = true;
                state.bangStart = (typeof performance !== 'undefined') ? performance.now() : Date.now();
                // Shared uniform bus for tunnel
                try {
                    window._p1ShaderShared = window._p1ShaderShared || {};
                    window._p1ShaderShared.bangStart = state.bangStart;
                    window._p1ShaderShared.bangActive = true;
                } catch (e) {}
                // Compute sphere screen-space center (NDC) — sphere is at z=0.7
                let cx = 0, cy = 0;
                if (state.camera && state.mesh) {
                    try {
                        const v = state.mesh.getWorldPosition(new THREE.Vector3());
                        v.project(state.camera);
                        cx = v.x; cy = v.y;
                    } catch (e) {}
                }
                u.uCenter.value.set(cx, cy);
                try {
                    window._p1ShaderShared.centerX = cx;
                    window._p1ShaderShared.centerY = cy;
                } catch (e) {}
                if (!REDUCE_MOTION && !state.audio_bangFired) {
                    state.audio_bangFired = true;
                    playBigBangCue();
                }
                if (!REDUCE_MOTION && !state.audio_tunnelRiseFired) {
                    state.audio_tunnelRiseFired = true;
                    setTimeout(playTunnelRiseCue, 100);
                }
                // Dispatch bigbang + stage2complete (stage3 listens for stage2complete)
                try {
                    window.dispatchEvent(new CustomEvent('inryoku:p1_bigbang', {
                        detail: {
                            scene: state.scene,
                            camera: state.camera,
                            renderer: state.renderer,
                            centerNdc: { x: cx, y: cy }
                        }
                    }));
                } catch (e) {}
                if (!state.stage2Fired) {
                    state.stage2Fired = true;
                    if (!state.audio_fadedOut) {
                        state.audio_fadedOut = true;
                        fadeOutAllAudio(1.2);
                    }
                    try {
                        window.dispatchEvent(new CustomEvent('inryoku:p1stage2complete'));
                    } catch (e) {}
                }
            }
            // BANG ramp (0 → 1 over 700ms)
            const nowB = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            const bangT = Math.min(1, (nowB - state.bangStart) / (BANG_RAMP_DUR * 1000));
            u.uBang.value = bangT;
            u.uTunnel.value = Math.min(1, bangT * 1.3);
            // 2026-05-18 段階5/6/7: tunnel phase mirror (sphere 表情)
            u.uTunnelPhase.value = u.uTunnel.value;
            // 2026-05-18 段階5/6/7: 量子粒子は bang 後 600ms かけて消える (中心に吸われる)
            if (state.quantumMat && state.quantumMat.uniforms) {
                const fadeMs = nowB - state.bangStart;
                const fade = Math.max(0, 1.0 - fadeMs / 600);
                state.quantumMat.uniforms.uTime.value = t;
                state.quantumMat.uniforms.uCollapse.value = 1.0;
                if (state.quantumPoints) state.quantumPoints.material.opacity = fade;
                if (fadeMs > 900 && !state.quantumDisposed) {
                    state.quantumDisposed = true;
                    disposeQuantumCollapse();
                }
            }
            try {
                window._p1ShaderShared = window._p1ShaderShared || {};
                window._p1ShaderShared.uBang   = bangT;
                window._p1ShaderShared.uTunnel = u.uTunnel.value;
            } catch (e) {}
            // Sphere: brief expansion at bang then collapse to invisible
            const expand = bangT < 0.25 ? (1.0 + bangT * 4.0 * 0.4) : (1.4 - (bangT - 0.25) * 2.0);
            state.mesh.scale.setScalar(Math.max(0.01, expand));
            // ── Bloom safety: ramp up at bang, decay over 200ms after ──
            try {
                const w = window;
                const bloomRef = w.bloom || (w.inryokuP1 && w.inryokuP1.bloom);
                if (bloomRef) {
                    const flashElapsed = Math.min(1, (nowB - state.bangStart) / 200);
                    const bangFlash = 1.0 - flashElapsed;
                    bloomRef.threshold = 0.22;
                    bloomRef.strength = 0.75 + (BLOOM_STRENGTH_MAX - 0.75) * bangFlash;
                    bloomRef.radius   = 0.35 + 0.27 * bangFlash;
                }
            } catch (e) {}
        }

        // 旧 uniforms を reveal から派生 (後方互換 — 他コードが参照しても破綻しないように)
        const rv = u.uReveal.value;

        // ── 2026-05-17 段階3.1: prewarp event (reveal>=0.72 で 1 度だけ) ──
        if (!state.prewarpEventFired && rv >= 0.72) {
            firePrewarpEvent();
        }

        u.uGreyMix.value    = Math.min(1, rv / 0.48) * 0.85;
        u.uPrism.value      = 0.3 + 0.9 * rv;
        u.uColorBirth.value = smoothstepJS(0.38, 0.92, rv);
        u.uLiquid.value     = smoothstepJS(0.45, 1.0, rv);

        // ── 2026-05-18 段階12: Sphere ↔ legacy tunnel sync (Codex plan) ──
        //   旧 rainbow tunnel (tunnelPlane / tunnelMat) を「球から生まれる背景」
        //   として復権させる。球の uReveal / uBang に応じて alpha / rainbow /
        //   radius を駆動 → トンネルが球の状態を反映して立ち上がる。
        //   ※ tunnelPlane.visible 自体は legacy phase ロジック側 (phase >= WARP_GROW)
        //     で既に true になるが、stage1 時間軸で先行的に visible にしておくと
        //     reveal 0.7+ で薄く立ち上がってブレイクスルー前後を繋げる。
        try {
            if (state.scene) {
                const bangV = (u.uBang && typeof u.uBang.value === 'number') ? u.uBang.value : 0;
                const tunnelObj = state.scene.getObjectByName('p1-old-tunnel-plane');
                if (tunnelObj && tunnelObj.material && tunnelObj.material.uniforms) {
                    const tu = tunnelObj.material.uniforms;
                    // alpha: reveal<0.7 → 微か (~0.10) / 0.7-1.0 → 0.10→0.4
                    //        rv>=1.0 (breakthrough) → 0.4→0.9 (bang で押し上げ)
                    let tAlpha;
                    if (rv < 0.7) {
                        tAlpha = 0.10 * smoothstepJS(0.35, 0.70, rv);
                    } else if (rv < 1.0) {
                        tAlpha = 0.10 + (0.40 - 0.10) * smoothstepJS(0.70, 1.0, rv);
                    } else {
                        // breakthrough 以降は bang で 0.4 → 0.9 へ
                        tAlpha = 0.40 + 0.50 * bangV;
                    }
                    if (tu.u_alpha) {
                        // 既存 legacy ロジックの値が大きい場合は尊重 (上書きしすぎない)
                        tu.u_alpha.value = Math.max(tu.u_alpha.value || 0, tAlpha);
                    }
                    if (tu.u_rainbow) {
                        // rainbow: reveal で 0 → 0.7, bang で 0.7 → 1.0
                        const tRainbow = Math.min(1.0,
                            0.70 * smoothstepJS(0.55, 1.0, rv) + 0.30 * bangV);
                        tu.u_rainbow.value = Math.max(tu.u_rainbow.value || 0, tRainbow);
                    }
                    if (tu.u_radius) {
                        // radius: 球から滲み出る半径感
                        const tRadius = 0.05
                            + 0.35 * smoothstepJS(0.55, 1.0, rv)
                            + 0.25 * bangV;
                        tu.u_radius.value = Math.max(tu.u_radius.value || 0, tRadius);
                    }
                    // reveal 0.55+ で visible (球の準備完了で薄く立ち上げる)
                    if (rv >= 0.55 && tunnelObj.visible === false) {
                        tunnelObj.visible = true;
                    }
                }
                // warpTunnelPlane: 「ぼんやり光」レイヤーは 30% に弱める
                const warpObj = state.scene.getObjectByName('p1-old-warp-tunnel');
                if (warpObj && warpObj.material && warpObj.material.uniforms) {
                    const wu = warpObj.material.uniforms;
                    if (wu.u_alpha && wu.u_alpha.value > 0.30) {
                        wu.u_alpha.value = wu.u_alpha.value * 0.30;
                    }
                }
            }
        } catch (e) {}

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
        // 2026-05-18 段階3.2: quantized milestones + visualPct lerp + strain
        // 50% → 101% を reveal で駆動。色も 陰陽 → グレー → RGBCMY と同期
        try {
            const barFill = document.getElementById('p1-lb');
            const pctEl   = document.getElementById('p1-lpct');
            if (barFill || pctEl) {
                // 2026-05-17 段階3.1: rv 1.0 = 100%, rv 1.01+ = 101%
                //   rv ∈ [0, 1.0] → percent ∈ [50, 100] (50% start, 100% snap)
                //   rv > 1.0     → percent = 101 (breakthrough)
                let morphProg;
                if (rv <= 1.0) {
                    morphProg = 50 + rv * 50; // 50 → 100
                } else {
                    morphProg = 101; // breakthrough: snap to 101
                }
                const pv = Math.round(morphProg);

                // 2026-05-18 段階3.2: quantized milestones + 視覚追従
                //   morphProg は raw、visualPct は packet-by-packet で追従。
                //   plateau (99-101) では sin strain を加算してプルプル震わせる。
                const target = quantizedPct(morphProg);
                const speed  = morphProg >= 99 ? 18 : 36;
                state.visualPct += (target - state.visualPct) * (1 - Math.exp(-dt * speed));
                const plateau  = morphProg >= 99 && morphProg < 101;
                const strain   = plateau ? Math.sin(performance.now() * 0.045) * 0.35 : 0;

                if (barFill) {
                    // 2026-05-18 段階3.2: quantized visualPct (旧: 直接 morphProg)
                    // 旧コード: barFill.style.width = Math.min(100, morphProg) + '%';
                    barFill.style.width = Math.min(100, state.visualPct + strain) + '%';
                    // 2026-05-18 段階2.5: Codex redesign — class-based state only
                    //   旧コード (rainbow gradient inline 書き換え) は完全に廃止。
                    //   bar は default で grey OS dither、色は 3 瞬間だけ漏れる。
                    // 旧コード (削除):
                    //   if (rv < 0.04) { barFill.style.background = '...白黒...'; }
                    //   else if (rv < 1.0) { barFill.style.background = '...rainbow stops...'; }
                    //   else { barFill.style.background = '...full rainbow...'; }
                    // 旧コードで inline 設定された style.background をクリア (再進入対策)
                    if (barFill.style.background) {
                        barFill.style.background = '';
                    }
                    // 50% bleed flash (1-shot, reveal が初めて 0.04 を超えた瞬間)
                    if (!state.bled50 && rv >= 0.04) {
                        state.bled50 = true;
                        try {
                            barFill.classList.add('is-bleed-50');
                            setTimeout(function () {
                                try { barFill.classList.remove('is-bleed-50'); } catch (e) {}
                            }, 260);
                        } catch (e) {}
                    }
                    // pressure class (50-99%, breakthrough/plateau 前)
                    const wantPressure = (rv >= 0.04 && rv < 0.96)
                        && !plateau
                        && !state.breakthroughFired;
                    if (wantPressure) {
                        if (!barFill.classList.contains('is-pressure')) {
                            barFill.classList.add('is-pressure');
                        }
                    } else {
                        barFill.classList.remove('is-pressure');
                    }
                    // plateau class (100% wall)
                    if (plateau && !state.breakthroughFired) {
                        if (!barFill.classList.contains('is-plateau')) {
                            barFill.classList.add('is-plateau');
                        }
                    } else {
                        barFill.classList.remove('is-plateau');
                    }
                }
                if (pctEl) {
                    // 2026-05-18 段階2.5: Codex text degradation sequence
                    //   旧 milestone snap + preGlitch ロジックは updateLoadingText に統合
                    // 旧コード (削除):
                    //   const preGlitchWindow = ...; if (preGlitchWindow && !state.glitchTextFired) {...}
                    //   else if (rv > 1.0) shown = 101; else if (rv >= 1.0) shown = 100; ...
                    const nowMs = (typeof performance !== 'undefined') ? performance.now() : Date.now();
                    updateLoadingText(rv, nowMs);
                }
            }
        } catch (e) { /* DOM 未準備でも黙って続行 */ }

        // ── 2026-05-18 段階3.2: runner (#exit-runner) を Stage1 から駆動 ──
        // 旧 tick は EVENT_SING 以降バイパスされるため、ここで left を 50→101 まで
        // 確実に進ませる。状態クラス (plateau/breakthrough/ingest) も同期。
        try {
            const runner = state.runner || document.getElementById('exit-runner');
            if (runner) {
                state.runner = runner;
                runner.style.display    = 'block';
                runner.style.visibility = 'visible';
                runner.style.opacity    = '1';
                // 2026-05-18 段階3.3: 50→101 連続走行 (戻りバグ修正)
                // 旧: (rp-50)/51 を 0-100%にマップ → 50% で左端に戻る
                // 新: rp そのものを左 % に。50→101 でバー上を連続走行
                let rp;
                if (rv <= 1.0) rp = 50 + rv * 50; else rp = 101;
                const leftPct = Math.min(101, Math.max(50, rp));
                runner.style.left = leftPct + '%';
                // 状態クラス
                const plateauNow = rp >= 99 && rp < 101;
                runner.classList.toggle('is-plateau',
                    plateauNow && !state.breakthroughFired);
                runner.classList.toggle('is-breakthrough',
                    state.breakthroughFired && !state.ingestFired);
                runner.classList.toggle('is-ingesting',
                    state.ingestFired === true);
            }
        } catch (e) {}

        // ── 2026-05-18 段階3.2: breakthrough 120ms 前に audio を一瞬絞る ──
        if (!state.glitchAudioDucked
            && !REDUCE_MOTION
            && t >= BREAKTHROUGH_T - 0.12
            && t < BREAKTHROUGH_T) {
            state.glitchAudioDucked = true;
            preBreakthroughSilence();
        }

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
        disposeQuantumCollapse();
        state.hiddenLegacy.forEach(function(o) { try { o.visible = true; } catch(e){} });
        state.hiddenLegacy = [];
        state.mesh = null;
        state.geo  = null;
        state.mat  = null;
        state.rcMesh = null;
        state.rcGeo  = null;
        state.rcMat  = null;
    }

    // 2026-05-18 段階5/6/7: Stage5/6/7 が scene/camera/sphere に直接アクセスするため
    // getter で state を露出 (mutable 参照は避け、毎回現在値を返す)
    window.inryokuP1Stage1 = {
        init:    initStage1,
        update:  updateStage,
        dispose: dispose,
        get scene()    { return state.scene;    },
        get camera()   { return state.camera;   },
        get renderer() { return state.renderer; },
        get mesh()     { return state.mesh;     },
        get mat()      { return state.mat;      },
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
