/**
 * p1_v2_sphere.js — inryokü P1 sphere (v2 rebuild)
 *
 * Single Source of Truth: DESIGN_P1.md
 *
 * 同一 Three.js Mesh を uniform 駆動で morph:
 *   [陰陽] → [グレー] → [RGBCMY] → [白光球] → [閉じた瞳] → [開眼] → [十字架]
 *
 * 起動: window.dispatchEvent('inryoku:p1_50percent', { detail: { scene, camera, renderer } })
 * 終了: window.dispatchEvent('inryoku:p1complete')
 *
 * 全ての effect は uniform-gated, additive 禁止, mix() のみ, alpha ≤ 0.5
 *
 * @ts-nocheck
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;
    if (window.inryokuP1V2) return; // 二重初期化防止

    // 2026-05-31 司「v2 の球めっちゃいい」: v2 を本番デフォルトに昇格。
    //   立体ライティング版を常時 ON。旧 taichi に戻したい時だけ ?v2=0。
    const enabled = (function () {
        try {
            if (/[\?&]v2=0/.test(location.search)) return false;  // 明示 OFF のみ旧へ
        } catch (e) {}
        return true;  // デフォルト ON
    })();
    if (!enabled) return;
    // v2 起動時は旧 stage1 を無効化するためのフラグ
    try { window.P1_V2_ACTIVE = true; } catch (e) {}
    // 旧 v20260531: load 直後に stage1Enabled=true を立てていた。
    // 50% 前の Stage0/legacy 進行と衝突するため、v2 init 後にだけ true にする。
    try { if (!window.inryokuP1) window.inryokuP1 = {}; } catch (e) {}

    // ──────────────────────────────────────────────
    // GLSL Shaders
    // ──────────────────────────────────────────────
    const VERT = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
            vPosition    = position;
            vNormal      = normalize(normalMatrix * normal);
            vec4 wp      = modelMatrix * vec4(position, 1.0);
            vWorldPos    = wp.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const FRAG = `
        precision highp float;
        uniform float uTime;
        uniform vec3  uCameraPos;
        // Master morph
        uniform float uTaichiMix;        // 0=非表示, 1=可視
        uniform float uReveal;           // 0=陰陽, 0.5=グレー, 1=RGBCMY
        uniform float uPremonitionAlpha; // 出現前の予兆 alpha
        uniform float uBoundaryLeak;     // 境界からの虹漏出 (0..1)
        uniform float uBang;             // RGBCMY 開花の爆ぜ (0..1, 短パルス)
        uniform float uWhiteBirth;       // 0=RGBCMY 球 / 1=純白光球
        uniform float uEyePhase;         // 瞳の出現 (0..1)
        uniform float uEyeOpen;          // 閉眼→開眼 (0..1)
        uniform float uCrossPhase;       // 十字架 (0..1)

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;

        // ─── Helpers ─────────────────────────────────────
        // P3 風 6色 cycle (R→Y→G→C→B→M→R)
        vec3 spectrum(float t) {
            vec3 c;
            float tt = fract(t) * 6.0;
            if      (tt < 1.0) c = mix(vec3(1.0,0.0,0.0), vec3(1.0,1.0,0.0), tt);
            else if (tt < 2.0) c = mix(vec3(1.0,1.0,0.0), vec3(0.0,1.0,0.0), tt - 1.0);
            else if (tt < 3.0) c = mix(vec3(0.0,1.0,0.0), vec3(0.0,1.0,1.0), tt - 2.0);
            else if (tt < 4.0) c = mix(vec3(0.0,1.0,1.0), vec3(0.0,0.0,1.0), tt - 3.0);
            else if (tt < 5.0) c = mix(vec3(0.0,0.0,1.0), vec3(1.0,0.0,1.0), tt - 4.0);
            else               c = mix(vec3(1.0,0.0,1.0), vec3(1.0,0.0,0.0), tt - 5.0);
            return c;
        }

        // hash + value noise (fbm 不使用、軽量)
        float hash31(vec3 p) {
            p = fract(p * vec3(0.1031, 0.1030, 0.0973));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
        }
        float vnoise(vec3 p) {
            vec3 i = floor(p); vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash31(i);
            float b = hash31(i + vec3(1,0,0));
            float c = hash31(i + vec3(0,1,0));
            float d = hash31(i + vec3(1,1,0));
            float e = hash31(i + vec3(0,0,1));
            float g = hash31(i + vec3(1,0,1));
            float h = hash31(i + vec3(0,1,1));
            float k = hash31(i + vec3(1,1,1));
            return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
                       mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
        }
        // 2026-05-31: fbm (多層ノイズ) — 有機的な揺らぎ・質感の核
        float fbm(vec3 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }
            return v;
        }
        // 2026-05-31: ACES filmic tonemap — HDR の発光感を出す
        vec3 aces(vec3 x) {
            return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0);
        }

        // ─── 球体 face-uv (cross/eye 共通) ────────────
        // 球の正面を XY 平面に射影した uv (-1..1)
        vec2 faceUv(vec3 wn) {
            return vec2(wn.x, wn.y) * 1.05;
        }

        void main() {
            // ── 基底: yin-yang 陰陽 ──
            vec3 p = normalize(vPosition);
            float angle = atan(p.y, p.x);
            float s     = sin(angle + sin(p.y * 3.8 + uTime * 0.4) * 0.32 + p.z * 0.7);
            float yin   = smoothstep(-0.05, 0.05, s);
            // 純粋な白と黒 (彩度ゼロのグレースケール)
            vec3 taichi = mix(vec3(0.0), vec3(1.0), yin);

            // uReveal による段階マスク (DESIGN_P1.md の Stage 2..5)
            //   uReveal 0.00..0.50: 陰陽 → グレー
            //   uReveal 0.50..1.00: グレー → RGBCMY
            float greyMix     = smoothstep(0.00, 0.50, uReveal);
            float colorBirth  = smoothstep(0.50, 1.00, uReveal);

            // ── グレー化 (Stage 3) ──
            vec3 grey = vec3(0.50);
            vec3 base = mix(taichi, grey, greyMix);

            // ── 2026-06-05 司「虹の球体をロゴのコアと同じに」 ──
            //   P3 ロゴコア (rcFrag) と同じ「12極カラー流し」方式に統一。
            //   12方向に RGBCMY+中間色を配置、表面ノイズで揺らがせて
            //   dot^3 加重ブレンド = ロゴと同じ多色球の質感。
            float spd = 0.10;
            float tt  = uTime * spd;
            vec3 nOff = vec3(
                vnoise(p * 2.5 + vec3(tt, 0.0, 0.0)) * 2.0 - 1.0,
                vnoise(p * 2.5 + vec3(0.0, tt * 0.8, 0.0)) * 2.0 - 1.0,
                vnoise(p * 2.5 + vec3(0.0, 0.0, tt * 0.6)) * 2.0 - 1.0
            );
            vec3 wPos = normalize(p + nOff * 0.28);
            vec3 dirs[12];
            dirs[0]=vec3(1.,0.,0.);  dirs[1]=vec3(-1.,0.,0.);
            dirs[2]=vec3(0.,1.,0.);  dirs[3]=vec3(0.,-1.,0.);
            dirs[4]=vec3(0.,0.,1.);  dirs[5]=vec3(0.,0.,-1.);
            dirs[6]=normalize(vec3(1.,1.,0.));   dirs[7]=normalize(vec3(-1.,-1.,0.));
            dirs[8]=normalize(vec3(0.,1.,1.));   dirs[9]=normalize(vec3(0.,-1.,-1.));
            dirs[10]=normalize(vec3(1.,0.,1.));  dirs[11]=normalize(vec3(-1.,0.,-1.));
            vec3 lcols[12];
            lcols[0]=vec3(1.,0.,0.);     lcols[1]=vec3(0.,1.,1.);
            lcols[2]=vec3(0.,1.,0.);     lcols[3]=vec3(1.,0.,1.);
            lcols[4]=vec3(0.,0.,1.);     lcols[5]=vec3(1.,1.,0.);
            lcols[6]=vec3(1.0,0.45,0.);  lcols[7]=vec3(0.0,0.55,1.0);
            lcols[8]=vec3(0.0,1.0,0.6);  lcols[9]=vec3(1.0,0.25,0.55);
            lcols[10]=vec3(0.75,0.25,1.);lcols[11]=vec3(0.85,0.85,0.2);
            vec3 colorSum = vec3(0.0); float field = 0.0;
            for (int i = 0; i < 12; i++) {
                float w = max(0.0, dot(wPos, dirs[i]));
                w = w * w * w;
                colorSum += lcols[i] * w; field += w;
            }
            vec3 rgbcmy = colorSum / max(field, 0.001);

            // ── Fresnel (rim/iris の共通指標) ──
            vec3  viewDir = normalize(uCameraPos - vWorldPos);
            vec3  N       = normalize(vWorldNormal);
            float facing  = max(dot(N, viewDir), 0.0);
            float fresnel = pow(1.0 - facing, 2.2);

            // ── 2026-05-31: 立体ライティング基盤 (球を「のっぺり円」から救う) ──
            //   key/fill/rim の 3灯 + 法線 fbm マイクロ凹凸 + 内部 SSS で
            //   全段(陰陽〜RGBCMY)に陰影と深みを与える。
            //   法線にノイズを足して有機的な表面の揺らぎ
            vec3 nPert = N + 0.05 * vec3(
                fbm(p * 3.0 + uTime * 0.05),
                fbm(p * 3.0 + 11.3 - uTime * 0.04),
                fbm(p * 3.0 + 27.7)) - 0.025;
            nPert = normalize(nPert);
            vec3 keyDir  = normalize(vec3( 0.55, 0.70, 0.50));
            vec3 fillDir = normalize(vec3(-0.60, 0.10, 0.40));
            float keyD  = max(dot(nPert, keyDir),  0.0);
            float fillD = max(dot(nPert, fillDir), 0.0) * 0.45;
            // ソフトな半球環境光 (上明るく下暗く)
            float hemi  = 0.5 + 0.5 * nPert.y;
            // スペキュラ (key 由来のハイライト)
            vec3  hKey  = normalize(keyDir + viewDir);
            float spec  = pow(max(dot(nPert, hKey), 0.0), 48.0);
            // 内部 SSS 風: 中心ほど明るく抜ける
            float sss   = (1.0 - smoothstep(0.0, 1.0, length(vPosition))) * 0.5;
            // 陰影合成係数 (1.0 中心) — 後で col に乗算
            float shade = 0.42 + 0.72 * keyD + fillD + 0.18 * hemi + sss;

            // ── 表面開花: base → RGBCMY (Stage 5) ──
            //   colorBirth で gate、彩度を 70% に抑えて馴染ませる
            vec3 col = mix(base, mix(base, rgbcmy, 0.70), colorBirth);

            // ── Stage 4: 境界から虹漏出 (uBoundaryLeak) ──
            //   境界 (s≈0) の幅 = leakWidth、両側に虹が薄く滲む
            //   additive 禁止、mix() で base 色と馴染ませる
            float leakWidth = 0.06 + uBoundaryLeak * 0.10;
            float leakBand  = smoothstep(leakWidth, 0.0, abs(s));
            vec3  leakColRaw = spectrum(uTime * 0.16 + p.y * 1.8 + p.x * 0.5);
            // 既存色と 60% ブレンドした柔らかい虹
            vec3  leakColSoft = mix(col, leakColRaw, 0.55);
            col = mix(col, leakColSoft, leakBand * uBoundaryLeak * 0.55);

            // ── Stage 5: 開花の爆ぜ uBang (短パルス) ──
            //   RGBCMY ジャンプ瞬間に表面全体に chromatic shock
            if (uBang > 0.001) {
                vec3 shockHue = spectrum(uTime * 0.5 + dot(p, vec3(1.2, 0.8, 0.4)));
                col = mix(col, shockHue, uBang * 0.40);
            }

            // ── Newton リング干渉 (RGBCMY 完成後の表面光沢) ──
            //   colorBirth と連動、彩度低めの spectrum を rim に薄く
            float ringFreq = 70.0;
            float ring     = sin(fresnel * fresnel * ringFreq - uTime * 1.4) * 0.5 + 0.5;
            vec3  prism    = spectrum(ring * 0.7 + angle * 0.12);
            float prismMix = colorBirth * fresnel * 0.30;
            col = mix(col, mix(col, prism, 0.6), prismMix);

            // ── Stage 8: 白光球 (uWhiteBirth) ──
            //   表面パターンを vec3(0.5) → vec3(1.0) へフェード
            //   rim に虹 halo を控えめに残す (mix 0.14)
            float wb = uWhiteBirth;
            if (wb > 0.001) {
                vec3 fadedSurface = mix(col, vec3(0.5), wb * 0.7);
                vec3 lightCol     = mix(fadedSurface, vec3(1.0), wb * 0.55);
                // 中心 → 外の pulsing breath
                float coreGlow = (1.0 - smoothstep(0.0, 0.7, length(vPosition))) * wb;
                lightCol = mix(lightCol, vec3(1.0), coreGlow * 0.7);
                // rim halo (Fresnel)
                float rimHalo = pow(fresnel, 1.5) * wb * 0.85;
                lightCol = mix(lightCol, vec3(1.0), rimHalo);
                // 白の中にも虹 (rim にだけ薄く、mix 0.14)
                vec3 whiteRainbow = mix(vec3(1.0), spectrum(uTime * 0.04 + angle * 0.10), 0.55);
                lightCol = mix(lightCol, whiteRainbow, pow(fresnel, 3.0) * wb * 0.14);
                col = lightCol;
            }

            // ── Stage 9/10: 瞳 (uEyePhase, uEyeOpen) ──
            //   閉眼 = 線 (closedLine)、開眼 = sclera/iris/pupil 同心円
            //   crossPhase が立ち始めたら fade (1.0 - smoothstep(0.02, 0.34, crossP))
            float crossP   = clamp(uCrossPhase, 0.0, 1.0);
            float eyeFade  = 1.0 - smoothstep(0.02, 0.34, crossP);
            float eyePhase = clamp(uEyePhase, 0.0, 1.0) * eyeFade;
            float eyeOpen  = clamp(uEyeOpen, 0.0, 1.0);
            if (eyePhase > 0.001) {
                vec2 eyeUv = faceUv(vWorldNormal);
                eyeUv.y *= 1.16;
                float eyeRegion = 1.0 - smoothstep(0.82, 1.10, length(eyeUv * vec2(0.86, 1.14)));
                float lidCurve  = eyeUv.y + 0.060 * sin(eyeUv.x * 3.14159265);
                float openEase  = smoothstep(0.08, 1.0, eyeOpen);
                float aperture  = mix(0.024, 0.46, openEase);
                float closedLine= exp(-lidCurve * lidCurve * 1200.0) * (1.0 - openEase);
                float apertureMask = 1.0 - smoothstep(aperture, aperture + 0.060, abs(lidCurve));
                float lidShadow = smoothstep(aperture + 0.02, aperture + 0.13, abs(lidCurve));
                float eyeR      = length(eyeUv * vec2(1.00, 0.88));
                float sclera    = (1.0 - smoothstep(0.55, 0.75, eyeR)) * apertureMask;
                float iris      = (1.0 - smoothstep(0.32, 0.48, eyeR)) * smoothstep(0.07, 0.16, eyeR) * apertureMask;
                float irisRing  = exp(-abs(eyeR - 0.36) * 32.0) * apertureMask;
                float pupil     = (1.0 - smoothstep(0.105, 0.185, eyeR)) * apertureMask;
                float catchLight= 1.0 - smoothstep(0.035, 0.078, length(eyeUv - vec2(-0.13, 0.14)));
                // iris の hue は subtle drift (cyan ↔ blue)
                float irisHueT  = 0.52 + 0.10 * sin(uTime * 0.5);
                vec3  irisCol   = mix(vec3(0.00, 0.16, 0.34), vec3(0.0, 0.85, 1.0), irisHueT);
                // iris 内に Newton リング干渉 (mix 0.18)
                float irisRing2 = sin(eyeR * 90.0 - uTime * 1.4) * 0.5 + 0.5;
                vec3  irisInterference = mix(irisCol, spectrum(eyeR * 1.4 + uTime * 0.08), 0.5);
                col = mix(col, vec3(0.0), closedLine * eyeRegion * eyePhase);
                col = mix(col, vec3(0.96), sclera * eyeRegion * eyePhase * openEase * 0.42);
                col = mix(col, irisCol, iris * eyeRegion * eyePhase * openEase);
                col = mix(col, irisInterference, iris * eyeRegion * eyePhase * openEase * irisRing2 * 0.18);
                col = mix(col, vec3(0.0, 0.85, 1.0), irisRing * eyeRegion * eyePhase * openEase * 0.32);
                col = mix(col, vec3(0.0), pupil * eyeRegion * eyePhase * openEase);
                col = mix(col, vec3(1.0), catchLight * eyeRegion * eyePhase * openEase * 0.78);
                col *= mix(1.0, 0.88 + 0.12 * lidShadow, eyePhase * openEase);
            }

            // ── Stage 11: 十字架 (uCrossPhase) ──
            //   縦軸=純白(精神) / 横軸=純黒(物質) / 中央 axisCore + 軸粒子流
            if (crossP > 0.001) {
                vec2 cUv = faceUv(vWorldNormal);
                float spanV = 1.0 - smoothstep(0.12 + crossP * 0.80, 1.06, abs(cUv.y));
                float spanH = 1.0 - smoothstep(0.12 + crossP * 0.80, 1.06, abs(cUv.x));
                float vBeam = exp(-cUv.x * cUv.x * 72.0) * spanV;
                float hBeam = exp(-cUv.y * cUv.y * 72.0) * spanH;
                float vHalo = exp(-cUv.x * cUv.x * 18.0) * spanV;
                float hHalo = exp(-cUv.y * cUv.y * 18.0) * spanH;
                float axisCore = exp(-dot(cUv, cUv) * 30.0);
                vec3 crossBase = mix(col, vec3(0.0), hBeam * crossP * 0.96);
                crossBase = mix(crossBase, vec3(1.0), vBeam * crossP * 0.98);
                crossBase = mix(crossBase, vec3(1.0), vHalo * crossP * 0.62);
                crossBase = mix(crossBase, vec3(0.0), hHalo * crossP * 0.55);
                crossBase += vec3(1.0) * axisCore * crossP * 2.70;
                // 軸粒子流 (mix ベース、彩度落とし)
                float vParticle = exp(-cUv.x * cUv.x * 360.0)
                               * smoothstep(0.0, 1.0, sin(cUv.y * 16.0 - uTime * 3.0) * 0.5 + 0.5);
                float hParticle = exp(-cUv.y * cUv.y * 360.0)
                               * smoothstep(0.0, 1.0, sin(cUv.x * 16.0 + uTime * 2.4) * 0.5 + 0.5);
                vec3 vSpec = mix(vec3(1.0), spectrum(uTime * 0.13 + cUv.y * 1.0), 0.6);
                vec3 hSpec = mix(vec3(0.0), spectrum(uTime * 0.09 - cUv.x * 0.8), 0.4);
                crossBase = mix(crossBase, vSpec, vParticle * crossP * 0.40 * spanV);
                crossBase = mix(crossBase, hSpec, hParticle * crossP * 0.30 * spanH);
                col = mix(col, crossBase, smoothstep(0.02, 0.22, crossP));
                col = mix(col, vec3(1.0), crossP * fresnel * 0.35);
            }

            // ── 2026-05-31: 立体陰影 + スペキュラ + フィルミック を適用 ──
            //   白光球以降(uWhiteBirth)は自前の発光ロジックがあるので影響を弱める。
            float litAmt = 1.0 - clamp(uWhiteBirth, 0.0, 1.0) * 0.85;
            col = mix(col, col * shade, litAmt);                 // 陰影
            col += spec * vec3(1.0) * 0.35 * litAmt;             // ハイライト
            col += fresnel * mix(vec3(0.1,0.2,0.4), col, 0.5) * 0.25 * litAmt; // リム
            // フィルミックトーンマップ + 微 gamma (HDR 発光感)
            col = aces(col * 1.18);
            col = pow(col, vec3(0.9));

            // ── Alpha 計算 ──
            //   uTaichiMix=0 で完全透明、uPremonitionAlpha で予兆 alpha 底上げ
            //   後段 (whiteBirth/eye/cross) が立てば必ず不透明
            float postPhase = max(max(max(uWhiteBirth, uEyePhase), uCrossPhase), uBang);
            float baseAlpha = max(uTaichiMix, uPremonitionAlpha);
            // RGBCMY 完成時に rim だけ少し残す
            float rimAlpha = pow(fresnel, 2.5) * colorBirth * 0.5;
            float finalA = clamp(max(baseAlpha + rimAlpha, postPhase), 0.0, 1.0);

            gl_FragColor = vec4(col, finalA);
        }
    `;

    // ──────────────────────────────────────────────
    // Module state + lifecycle
    // ──────────────────────────────────────────────
    const state = {
        scene: null, camera: null, renderer: null,
        mesh: null, mat: null, geo: null,
        startTime: 0, rafId: 0,
        running: false, disposed: false,
        timers: new Set(),
        // event guards
        fired50: false,
        firedIngest: false,
        firedBreach: false,
        firedAudioStarted: false,
        firedAudioBreach: false,
        firedAudioStop: false,
        firedP2: false,
    };

    function setT(fn, ms) {
        const id = setTimeout(function () {
            state.timers.delete(id);
            try { fn(); } catch (e) {}
        }, ms);
        state.timers.add(id);
        return id;
    }
    function clearAllTimers() {
        state.timers.forEach(function (id) { try { clearTimeout(id); } catch (e) {} });
        state.timers.clear();
    }

    // ──────────────────────────────────────────────
    // Init: build mesh, attach to scene
    // ──────────────────────────────────────────────
    function init(detail) {
        if (state.running || state.disposed) return;
        if (!detail || !detail.scene || !detail.camera) return;
        if (typeof THREE === 'undefined') return;
        try {
            if (!window.inryokuP1) window.inryokuP1 = {};
            window.inryokuP1.stage1Enabled = true;
        } catch (e) {}

        state.scene    = detail.scene;
        state.camera   = detail.camera;
        state.renderer = detail.renderer || null;

        state.geo = new THREE.SphereGeometry(1.0, 64, 64);
        state.mat = new THREE.ShaderMaterial({
            vertexShader:   VERT,
            fragmentShader: FRAG,
            uniforms: {
                uTime:             { value: 0 },
                uCameraPos:        { value: new THREE.Vector3() },
                uTaichiMix:        { value: 0 },
                uReveal:           { value: 0 },
                uPremonitionAlpha: { value: 0 },
                uBoundaryLeak:     { value: 0 },
                uBang:             { value: 0 },
                uWhiteBirth:       { value: 0 },
                uEyePhase:         { value: 0 },
                uEyeOpen:          { value: 0 },
                uCrossPhase:       { value: 0 },
            },
            transparent: true,
            depthWrite:  false,
        });

        state.mesh = new THREE.Mesh(state.geo, state.mat);
        state.mesh.name = 'p1V2Sphere';
        state.mesh.position.set(0, 0, 0.5);
        state.mesh.renderOrder = 999;
        state.scene.add(state.mesh);

        // legacy sphere との衝突回避 (旧 mesh を非表示)
        try {
            const old = state.scene.getObjectByName('p1Stage1TaichiSphere');
            if (old) old.visible = false;
            const oldGrey = state.scene.getObjectByName('p1-old-grey-sphere');
            if (oldGrey) oldGrey.visible = false;
        } catch (e) {}

        // debug: console から uniform 直接操作可能に
        try { window.__p1v2mat = state.mat; } catch (e) {}

        state.startTime = performance.now();
        state.running   = true;
        try { bindManualScroll(); } catch (e) {}  // 手動スクロール進行を有効化

        // 起動ログ
        try { console.log('[p1_v2_sphere] init OK', { detail: detail }); } catch (e) {}

        loop();
    }

    // ──────────────────────────────────────────────
    // Timeline (bar progress → uniforms)
    //
    // 設計書: t は p1_50percent 発火からの秒数。
    //         barProgress は updateLoadingBar() が同時に管理。
    //         本 v2 ではバー進行を Stage 2..6 までは時間直結、
    //         Stage 7+ (ingest 後) はバー停止後の純粋時間ベース。
    // ──────────────────────────────────────────────
    //
    // 時刻表 (seconds since p1_50percent fired):
    //   0.0 - 1.5  : Stage 1 余韻 (球はうっすら premonition で出現)
    //   1.5 - 4.0  : Stage 2 陰陽はっきり (uTaichiMix 0→1)
    //   4.0 - 7.5  : Stage 3 タメ — グレー化 (uReveal 0→0.5、bar 99→100)
    //   7.5 - 8.0  : Stage 4 境界虹滲み (uBoundaryLeak 0→1、bar hold 100)
    //   8.0 - 8.4  : Stage 5 暴力ジャンプ (uReveal 0.5→1.0 + uBang pulse)
    //   8.4 - 8.9  : Stage 6 101% Breach (bar 100→101 + Newton ring leak + bass)
    //   8.9 -10.5  : Stage 7 UI ingest (Win95 black hole + 重力レンズ)
    //  10.5 -12.5  : Stage 8 白光球 (uWhiteBirth 0→1)
    //  12.5 -14.5  : Stage 9 閉じた瞳 (uEyePhase 0→1)
    //  14.5 -15.5  : Stage 10 開眼 (uEyeOpen 0→1 + solar flash)
    //  15.5 -17.0  : Stage 11 十字架 (uCrossPhase 0→1)
    //  17.0+       : Stage 12 P2 へ
    function tween(t, a, b, va, vb, ease) {
        if (t <= a) return va;
        if (t >= b) return vb;
        const p = (t - a) / (b - a);
        const e = ease ? ease(p) : p;
        return va + (vb - va) * e;
    }
    function smoothstep01(x) { return x * x * (3 - 2 * x); }
    function easeOutExpo(x)  { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }
    function pulse(t, peak, width) {
        // Gaussian pulse at peak time, width=stdev
        const d = (t - peak) / width;
        return Math.exp(-d * d);
    }

    function updateUniforms(t) {
        const u = state.mat.uniforms;
        u.uTime.value = t;
        if (state.camera) u.uCameraPos.value.copy(state.camera.position);

        // 球は微回転 (12°/s) + 微小 breathing
        state.mesh.rotation.y = t * 0.18;
        state.mesh.scale.setScalar(1.0 + Math.sin(t * 0.9) * 0.02);

        // ── Stage 1 余韻 (0..1.5s): 球は予兆だけ ──
        if (t < 1.5) {
            const p = t / 1.5;
            const e = smoothstep01(p);
            u.uTaichiMix.value        = 0;
            u.uPremonitionAlpha.value = 0.15 + e * 0.55;
            u.uReveal.value           = 0;
            u.uBoundaryLeak.value     = 0;
            u.uBang.value             = 0;
            u.uWhiteBirth.value       = 0;
            u.uEyePhase.value         = 0;
            u.uEyeOpen.value          = 0;
            u.uCrossPhase.value       = 0;
            return;
        }

        // 1.5s 以降は予兆 alpha は最大保持
        u.uPremonitionAlpha.value = 1.0;
        u.uBoundaryLeak.value     = 0;

        // ── Stage 2: 陰陽はっきり (1.5..4.0s) ──
        if (t < 4.0) {
            const p = (t - 1.5) / 2.5;
            u.uTaichiMix.value = smoothstep01(p);
            u.uReveal.value    = 0;
            u.uBang.value      = 0;
            u.uWhiteBirth.value = 0;
            u.uEyePhase.value   = 0;
            u.uEyeOpen.value    = 0;
            u.uCrossPhase.value = 0;
            return;
        }
        u.uTaichiMix.value = 1.0;

        // ── Stage 3: タメ — グレー化 (4.0..7.5s) ──
        //   uReveal は 0→0.5 のみ (RGBCMY はまだ)
        if (t < 7.5) {
            const p = (t - 4.0) / 3.5;
            u.uReveal.value    = smoothstep01(p) * 0.50;
            u.uBoundaryLeak.value = 0;
            u.uBang.value      = 0;
            u.uWhiteBirth.value = 0;
            u.uEyePhase.value   = 0;
            u.uEyeOpen.value    = 0;
            u.uCrossPhase.value = 0;
            return;
        }

        // ── Stage 4: 境界虹滲み (7.5..8.0s) ──
        if (t < 8.0) {
            const p = (t - 7.5) / 0.5;
            u.uReveal.value       = 0.50;
            u.uBoundaryLeak.value = smoothstep01(p);
            u.uBang.value         = 0;
            u.uWhiteBirth.value   = 0;
            u.uEyePhase.value     = 0;
            u.uEyeOpen.value      = 0;
            u.uCrossPhase.value   = 0;
            return;
        }

        // ── Stage 5: 暴力ジャンプ (8.0..8.4s) ──
        //   uReveal 0.5→1.0 easeOutExpo
        //   uBang Gaussian pulse at 8.2s
        if (t < 8.4) {
            const p = (t - 8.0) / 0.4;
            u.uReveal.value       = 0.50 + easeOutExpo(p) * 0.50;
            u.uBoundaryLeak.value = 1.0 - p; // 境界漏出は爆ぜに変質
            u.uBang.value         = pulse(t, 8.20, 0.10);
            u.uWhiteBirth.value   = 0;
            u.uEyePhase.value     = 0;
            u.uEyeOpen.value      = 0;
            u.uCrossPhase.value   = 0;
            return;
        }

        // 全 morph 完了
        u.uReveal.value       = 1.0;
        u.uBoundaryLeak.value = 0;
        u.uBang.value         = 0;

        // ── Stage 6: 101% Breach (8.4..8.9s) ──
        //   バーが breach に入る (updateLoadingBar 側で処理)
        //   球体は静止保持
        if (t < 8.9) {
            u.uWhiteBirth.value = 0;
            u.uEyePhase.value   = 0;
            u.uEyeOpen.value    = 0;
            u.uCrossPhase.value = 0;
            // breach 効果 1 度だけ
            if (!state.firedBreach) {
                state.firedBreach = true;
                onBreach();
            }
            return;
        }

        // ── Stage 7: UI ingest + 重力レンズ (8.9..10.5s) ──
        if (t < 10.5) {
            u.uWhiteBirth.value = Math.max(0, (t - 9.5) / 1.0); // 9.5s から白化を開始
            u.uEyePhase.value   = 0;
            u.uEyeOpen.value    = 0;
            u.uCrossPhase.value = 0;
            if (!state.firedIngest) {
                state.firedIngest = true;
                onIngest();
            }
            return;
        }

        // ── Stage 8: 白光球 (10.5..12.5s) ──
        if (t < 12.5) {
            u.uWhiteBirth.value = 1.0;
            u.uEyePhase.value   = 0;
            u.uEyeOpen.value    = 0;
            u.uCrossPhase.value = 0;
            return;
        }

        // ── Stage 9: 閉じた瞳 (12.5..14.5s) ──
        if (t < 14.5) {
            const p = (t - 12.5) / 2.0;
            u.uWhiteBirth.value = 1.0;
            u.uEyePhase.value   = smoothstep01(p);
            u.uEyeOpen.value    = 0;
            u.uCrossPhase.value = 0;
            return;
        }

        // ── Stage 10: 開眼 (14.5..15.5s) ──
        if (t < 15.5) {
            const p = (t - 14.5) / 1.0;
            u.uWhiteBirth.value = 1.0;
            u.uEyePhase.value   = 1.0;
            u.uEyeOpen.value    = smoothstep01(p);
            u.uCrossPhase.value = 0;
            return;
        }

        // ── Stage 11: 十字架 (15.5..17.0s) ──
        if (t < 17.0) {
            const p = (t - 15.5) / 1.5;
            u.uWhiteBirth.value = 1.0;
            u.uEyePhase.value   = 1.0;
            u.uEyeOpen.value    = 1.0;
            u.uCrossPhase.value = smoothstep01(p);
            return;
        }

        // ── Stage 12: P2 へ ──
        u.uCrossPhase.value = 1.0;
        if (!state.firedP2) {
            state.firedP2 = true;
            onP2Transition();
        }
    }

    // ──────────────────────────────────────────────
    // External effects (bar / harmonic / lens)
    // ──────────────────────────────────────────────

    function updateBar(t) {
        // バー: 0..7.5s で 50→99.5, 7.5..8.0 で 99.5→100, 8.0..8.9 で 101 へ
        const lb = document.getElementById('p1-lb');
        const lpct = document.getElementById('p1-lpct');
        if (!lb && !lpct) return;
        let percent;
        if      (t < 7.5) percent = 50 + smoothstep01(t / 7.5) * 49.5;
        else if (t < 8.0) percent = 99.5 + (t - 7.5) / 0.5 * 0.5;
        else if (t < 8.4) percent = 100;
        else if (t < 8.9) percent = 100 + (t - 8.4) / 0.5;
        else              percent = 101;

        const wall   = percent >= 99.5 && percent < 100.5;
        const breach = percent >= 100.5;

        if (lb) {
            lb.style.width = Math.min(percent, 101) + '%';
            lb.classList.toggle('p1-bar-wall', wall);
            lb.classList.toggle('p1-bar-breach', breach);
        }
        if (lpct) {
            if (breach) {
                ensureOdometer(lpct);
                const roll = lpct.querySelector('.p1-odo-roll');
                if (roll) roll.classList.add('is-rolled');
                lpct.classList.add('p1-pct-breach');
            } else {
                lpct.classList.remove('p1-pct-breach', 'p1-pct-odometer');
                lpct.textContent = 'Loading reality... ' + Math.round(Math.min(percent, 100)) + '%';
            }
        }
    }
    function ensureOdometer(lpct) {
        // 2026-06-04 司「途中で 1001% とか意味不明な数値が出るのやめて」:
        //   旧 odometer は「10」+回転「0/1」+「%」が 1001% に誤読される。
        //   シンプルに 101% 表記へ。
        if (lpct.dataset.odoSet === '1') return;
        lpct.dataset.odoSet = '1';
        lpct.classList.add('p1-pct-breach');
        lpct.textContent = 'Loading reality... 101%';
    }

    function updateHarmonic(t) {
        const H = window.inryokuHarmonic;
        if (!H) return;
        if (!state.firedAudioStarted) {
            state.firedAudioStarted = true;
            try { H.start({ fadeIn: 1.5, masterGain: 0.07 }); } catch (e) {}
        }
        // bar progress (0..1) で倍音段階追加
        let bp;
        if      (t < 7.5) bp = smoothstep01(t / 7.5) * 0.98;
        else if (t < 8.0) bp = 0.98;
        else              bp = 1.0;
        try { H.driveByProgress(bp); } catch (e) {}
    }

    function updateLens(t) {
        const lp = window.lensPass;
        if (!lp || window._p1LensDisabled) return;
        const u = lp.uniforms;
        u.uTime.value = performance.now() * 0.001;
        // 球体中心を uCenter に
        try {
            if (state.mesh && state.camera) {
                const v = state.mesh.position.clone().project(state.camera);
                u.uCenter.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
            }
        } catch (e) {}
        u.uAspect.value = window.innerWidth / window.innerHeight;
        if (u.uResolution.value.x !== window.innerWidth) {
            u.uResolution.value.set(window.innerWidth, window.innerHeight);
        }
        // mass driver
        let mass = 0, einstein = 0.22, disp = 0.012;
        if (t >= 8.4 && t < 8.9) {
            const p = (t - 8.4) / 0.5;
            mass = 0.04 * p;
            disp = 0.008 + 0.012 * p;
        } else if (t >= 8.9 && t < 10.5) {
            const p = (t - 8.9) / 1.6;
            const ease = p < 0.3 ? p / 0.3 : 1.0 - (p - 0.3) / 0.7 * 0.5;
            mass = 0.04 + 0.20 * ease;
            einstein = 0.22 + 0.06 * Math.sin(p * 6.28);
            disp = 0.020 + 0.018 * ease;
        } else if (t >= 10.5 && t < 12.5) {
            const p = (t - 10.5) / 2.0;
            mass = 0.12 * (1 - p);
            disp = 0.020 * (1 - p);
        }
        u.uMass.value       = mass;
        u.uEinstein.value   = einstein;
        u.uDispersion.value = disp;
    }

    // ──────────────────────────────────────────────
    // One-shot triggers
    // ──────────────────────────────────────────────
    function onBreach() {
        // 1) harmonic: pull root + bass hit
        try {
            const H = window.inryokuHarmonic;
            if (H) {
                H.pullRoot({ duration: 0.7 });
                setT(function () { try { H.bassHit({ gain: 0.42 }); } catch (e) {} }, 60);
            }
        } catch (e) {}
        // 2) odometer roll を確実に発火 (updateBar からも triggered)
        try {
            const lpct = document.getElementById('p1-lpct');
            if (lpct) ensureOdometer(lpct);
        } catch (e) {}
    }

    function onIngest() {
        // Win95 window を black hole に吸い込む (CSS animation)
        try {
            const win = document.getElementById('win95-main');
            if (!win || !state.mesh || !state.camera) return;
            const v = state.mesh.position.clone().project(state.camera);
            const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
            const rect = win.getBoundingClientRect();
            const clone = win.cloneNode(true);
            clone.id = 'p1-v2-shell-clone';
            clone.querySelectorAll('canvas').forEach(function (c) { c.remove(); });
            clone.classList.add('p1-ui-shell-ingest-strong');
            Object.assign(clone.style, {
                position: 'fixed',
                left: rect.left + 'px',
                top: rect.top + 'px',
                width: rect.width + 'px',
                height: rect.height + 'px',
                margin: '0',
                zIndex: '2147482000',
                pointerEvents: 'none',
            });
            clone.style.setProperty('--core-x', (sx - rect.left) + 'px');
            clone.style.setProperty('--core-y', (sy - rect.top) + 'px');
            clone.style.setProperty('--pull-x', (sx - rect.left - rect.width / 2) + 'px');
            clone.style.setProperty('--pull-y', (sy - rect.top - rect.height / 2) + 'px');
            document.body.appendChild(clone);
            win.style.opacity = '0';
            setT(function () { try { clone.remove(); } catch (e) {} }, 2900);
        } catch (e) {}
        // fullscreen unlock for legacy renderLoop
        try { window.p1FullScreenUnlocked = true; } catch (e) {}
        // bg を吸い込み完了後に消す
        try {
            if (state.scene) {
                const dualBg = state.scene.getObjectByName('p1-old-dual-bg');
                if (dualBg) {
                    setT(function () { dualBg.visible = false; }, 1400);
                }
            }
        } catch (e) {}

        // 2026-05-31 司「Win95 UI → 背景も飲み込んで真っ暗な世界に」:
        //   固定概念(Win95窓)に続き「現実の壁紙」(グレー背景・周辺DOM)も
        //   球へ吸い込まれた後、全画面を純黒へフェード。
        //   → 真っ暗な無の中に、球の morph(虹球→光球→瞳→十字)だけが残る。
        try {
            // ① 黒のフルスクリーン veil を最前面手前(球canvasより奥)に敷いてフェードイン
            var veil = document.getElementById('p1-blackout-veil');
            if (!veil) {
                veil = document.createElement('div');
                veil.id = 'p1-blackout-veil';
                // z-index:-1 = 球 canvas(z-index:0)の真下。球の morph は隠さず、
                //   その背後の周辺 DOM/壁紙だけを黒で覆う。
                veil.style.cssText =
                    'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;' +
                    'z-index:-1;transition:opacity 1.6s ease 0.6s;';
                document.body.appendChild(veil);
            }
            // body 自体も void(黒)へ
            document.body.style.transition = 'background 1.4s ease 0.6s';
            document.body.style.background = '#000';
            // 周辺 DOM(グレー背景・ローディング枠・タスクバー等)を吸い込み後に黒へ沈める。
            //   球の Three.js canvas は除外(morph を見せ続ける)。
            var swallowSel = ['.phase-1', '#win95-desktop', '.win95-taskbar',
                              '#win95-main', '.p1-desktop-bg', '.desktop'];
            swallowSel.forEach(function (sel) {
                document.querySelectorAll(sel).forEach(function (el) {
                    if (el.querySelector && el.querySelector('canvas')) return; // canvas 持ちは残す
                    el.style.transition = 'opacity 1.2s ease 0.4s, filter 1.2s ease';
                    el.style.opacity = '0';
                });
            });
            // veil をフェードイン → 真っ暗確定 (球 canvas は z-index 上で生存)
            setT(function () { veil.style.opacity = '1'; }, 60);
        } catch (e) {}
    }

    function onP2Transition() {
        try {
            const H = window.inryokuHarmonic;
            if (H && !state.firedAudioStop) {
                state.firedAudioStop = true;
                H.stop(1.0);
            }
        } catch (e) {}
        try {
            window.__inryokuP1ToP2 = {
                from: 'cross_v2',
                ts: performance.now(),
                seedLine: { x: 0, y0: -1, y1: 1, color: 'white', phase: 'vertical-axis' },
            };
            window.dispatchEvent(new CustomEvent('inryoku:p1complete'));
        } catch (e) {}
    }

    // ──────────────────────────────────────────────
    // Render loop
    // ──────────────────────────────────────────────
    // 2026-06-05 司「今のデザインを自分の手で動かせるように」:
    //   球モーフ全体(陰陽→グレー→虹→白光→瞳→十字)を、スクロール量で
    //   進める/戻せる手動モード。デフォルト ON。?manual=0 で自動に戻る。
    //   t (秒) は本来のタイムライン総尺。スクロールで _manualT を 0..TOTAL 補間。
    // 2026-06-08 司「球モーフのアニメが変わった」: v2 のスクロール手動進行は
    //   球モーフ(50%以降)を時間ベースから変えてしまうため デフォルトOFF に戻す。
    //   球モーフは従来通り自動。0→50%の手動合体は p1_code 側で別実装。
    //   手動スクロールを試す時だけ ?manual=1。
    state.manual = false;
    try { if (/[\?&]manual=1/.test(location.search)) state.manual = true; } catch (e) {}
    state._manualT = 0;        // 現在の手動時刻 (秒)
    state._manualTarget = 0;   // スクロールで動かす目標
    var P1_TOTAL_T = 17.5;     // タイムライン総尺 (秒)。これで 0→十字→P2 完走
    function bindManualScroll() {
        if (!state.manual) return;
        // ホイール: 下スクロールで進む / 上で戻る
        window.addEventListener('wheel', function (e) {
            state._manualTarget += e.deltaY * 0.012;  // 感度
            if (state._manualTarget < 0) state._manualTarget = 0;
            if (state._manualTarget > P1_TOTAL_T) state._manualTarget = P1_TOTAL_T;
        }, { passive: true });
        // タッチ: 縦ドラッグ
        var lastY = null;
        window.addEventListener('touchstart', function (e){ lastY = e.touches[0].clientY; }, { passive: true });
        window.addEventListener('touchmove', function (e){
            if (lastY == null) return;
            var y = e.touches[0].clientY;
            state._manualTarget += (lastY - y) * 0.03;
            lastY = y;
            if (state._manualTarget < 0) state._manualTarget = 0;
            if (state._manualTarget > P1_TOTAL_T) state._manualTarget = P1_TOTAL_T;
        }, { passive: true });
    }

    function loop() {
        if (!state.running || state.disposed) return;
        const now = performance.now();
        var t;
        if (state.manual) {
            // 目標へ慣性で滑らかに追従 (急がない、ぬるっと)
            state._manualT += (state._manualTarget - state._manualT) * 0.08;
            t = state._manualT;
        } else {
            t = (now - state.startTime) / 1000 * (window._p1FastForward || 1);
        }
        try { updateUniforms(t); } catch (e) {}
        try { updateBar(t); }      catch (e) {}
        try { updateHarmonic(t); } catch (e) {}
        try { updateLens(t); }     catch (e) {}
        state.rafId = requestAnimationFrame(loop);
    }

    function dispose() {
        state.disposed = true;
        state.running  = false;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        clearAllTimers();
        try {
            if (state.mesh && state.scene) state.scene.remove(state.mesh);
            if (state.geo) state.geo.dispose();
            if (state.mat) state.mat.dispose();
        } catch (e) {}
        state.mesh = null; state.mat = null; state.geo = null;
    }

    // ──────────────────────────────────────────────
    // Public API + auto-bind
    // ──────────────────────────────────────────────
    window.inryokuP1V2 = {
        init: init,
        dispose: dispose,
        get state() { return state; },
    };

    // legacy `inryoku:p1_50percent` イベントで起動
    window.addEventListener('inryoku:p1_50percent', function (e) {
        if (!state.running && !state.disposed) {
            init(e.detail || {});
        }
    });

    // 既存 inryokuP1 API 互換 (legacy が _invokeStage1 を呼ぶ)
    if (!window.inryokuP1) window.inryokuP1 = {};
    if (!window.inryokuP1.registerStage1Handler) {
        window.inryokuP1._handler_v2 = null;
        const origReg = window.inryokuP1.registerStage1Handler;
        window.inryokuP1.registerStage1Handler = function (fn) {
            window.inryokuP1._handler_v2 = fn;
            if (origReg) try { origReg(fn); } catch (e) {}
        };
        const origInvoke = window.inryokuP1._invokeStage1;
        window.inryokuP1._invokeStage1 = function (detail) {
            if (origInvoke) try { origInvoke(detail); } catch (e) {}
            if (!state.running && !state.disposed) init(detail);
        };
    }
})();
