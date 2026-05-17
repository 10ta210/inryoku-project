// 2026-05-17 P1 拡張シーン Stage 1: 太極球 → グレー溶解
// Scene A (0.0–1.2s): 陰陽パターンが球面に出現・回転
// Scene B (1.2–2.8s): 境界が溶けてグレーに侵食、リム虹干渉
// 2.8s 以降: グレー球を保持し、次のステージを待つ
// 2026-05-17 段階2: Scene C (2.8–4.2s) — グレー球が同一メッシュのまま
//   RGBCMY 水滴オーブへ変容。6 metaball を球面に配置・field blend。
//   中心には微小な太極核を保持 (101% は 50% を否定しない)。
//   4.2s で inryoku:p1stage2complete 発火、以降は微呼吸＋色循環で保持。
(function p1Stage1IIFE() {
    'use strict';
    if (typeof window === 'undefined') return;

    // prefers-reduced-motion 検出
    const REDUCE_MOTION = (typeof window.matchMedia === 'function')
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const SCENE_A_DUR = 1.2;
    const SCENE_B_DUR = 1.6; // 1.2 → 2.8
    const TOTAL_DUR   = SCENE_A_DUR + SCENE_B_DUR; // 2.8s
    // 2026-05-17 段階2: Scene C タイムライン
    const STAGE2_START   = 2.8;
    const STAGE2_RAMP_IN = 2.95; // 0.15s ホールド余韻
    const STAGE2_RAMP_END = 4.0; // 0 → 1 完了
    const STAGE2_END      = 4.2; // settle 完了 → イベント発火

    const RADIUS = 0.42;

    // ───────────────────────────────────────────────────────────────
    // 2026-05-17 段階2.1: P2/P3 rcSphere シェーダ移植
    //   最終 RGBCMY オーブ (uColorBirth=1) を P3 i ドットロゴ球と
    //   ピクセル単位で一致させるため、独立した第二メッシュとして搭載。
    //   既存の taichi/grey ベース (state.mesh) は維持し、上に
    //   rcSphere (state.rcMesh) を被せる。uColorBirth を opacity に
    //   反映してフェードイン。taichi ベースは uColorBirth=1 で 18% 残し
    //   「101% は 50% を否定しない」哲学を保つ。
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

    const FRAG = `
        precision highp float;
        varying vec3 vNormal;
        varying vec3 vPosition;
        // 2026-05-17 段階1.2: ワールド空間入力 (本物の Fresnel 用)
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        uniform vec3 uCameraPos;
        uniform float uTime;
        uniform float uTaichiMix;
        uniform float uGreyMix;
        uniform float uPrism;
        // 2026-05-17 段階2: 色生 (0=灰/太極, 1=RGBCMYオーブ) と液体歪み
        uniform float uColorBirth;
        uniform float uLiquid;

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
            vec3 p = normalize(vPosition);
            float angle = atan(p.y, p.x);
            // 呼吸する蛇行境界線
            float s = sin(angle + sin(p.y * 3.8 + uTime * 0.4) * 0.32 + p.z * 0.7);
            float yin = smoothstep(-0.06, 0.06, s);

            vec3 black = vec3(0.01);
            vec3 white = vec3(0.82);
            vec3 grey  = vec3(0.50);

            vec3 taichi = mix(black, white, yin);
            vec3 col = mix(taichi, grey, uGreyMix);

            // 2026-05-17 段階1.2: 本物の Fresnel — ワールド空間の view ベクトル
            vec3 viewDir = normalize(uCameraPos - vWorldPos);
            float rim = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 2.0);

            // 境界帯（陰陽の境）— 溶けるにつれ広がる
            float boundary = 1.0 - smoothstep(0.0, 0.12 + uGreyMix * 0.25, abs(s));

            // ニュートンリング風干渉 (r² ∝ nλR 簡略)
            float r2 = rim * rim;
            float rings = sin(r2 * 80.0 - uTime * 2.0);
            float hue = fract(rings * 0.08 + uTime * 0.02 + angle * 0.04);
            vec3 prism = hsv2rgb(vec3(hue, 0.85, 1.0));

            // 6波長加算（赤橙黄緑青紫を少しずつ混ぜる）
            vec3 sixBand = vec3(0.0);
            for (int i = 0; i < 6; i++) {
                float fi = float(i);
                float bh = fi / 6.0;
                vec3 bc = hsv2rgb(vec3(bh, 0.9, 1.0));
                float bw = 0.5 + 0.5 * sin(r2 * (40.0 + fi * 8.0) - uTime * 1.5 + fi);
                sixBand += bc * bw;
            }
            sixBand /= 6.0;

            vec3 rimColor = mix(prism, sixBand, 0.45);
            col += rimColor * rim * (boundary * 0.18 + 0.05) * uPrism;

            // 2026-05-17 段階2.1: 旧 metaball オーブは rcSphere (第二メッシュ) に置換済み。
            //   ベースメッシュは taichi/grey の「残像」専用となり、uColorBirth=1 で
            //   alpha 18% まで減衰させて「101% の奥に 50% が残る」哲学を担う。
            //   metaball ブロックは無効化 (false ガード) しつつ、ロジック自体は残置。
            if (false && uColorBirth > 0.001) {
                vec3 centers[6];
                centers[0] = vec3( 1.0, 0.0, 0.0); // R
                centers[1] = vec3(-1.0, 0.0, 0.0); // G
                centers[2] = vec3( 0.0, 1.0, 0.0); // B
                centers[3] = vec3( 0.0,-1.0, 0.0); // C
                centers[4] = vec3( 0.0, 0.0, 1.0); // M
                centers[5] = vec3( 0.0, 0.0,-1.0); // Y

                vec3 colorsArr[6];
                colorsArr[0] = vec3(1.0, 0.0, 0.0);
                colorsArr[1] = vec3(0.0, 1.0, 0.0);
                colorsArr[2] = vec3(0.0, 0.0, 1.0);
                colorsArr[3] = vec3(0.0, 1.0, 1.0);
                colorsArr[4] = vec3(1.0, 0.0, 1.0);
                colorsArr[5] = vec3(1.0, 1.0, 0.0);

                float field = 0.0;
                vec3 colorSum = vec3(0.0);
                // 全中心を共通 Y 軸でゆるく回す (~8s で一周相当)
                float ang = uTime * 0.08;
                float ca = cos(ang);
                float sa = sin(ang);
                for (int i = 0; i < 6; i++) {
                    vec3 c = centers[i];
                    vec3 cr = vec3(c.x * ca - c.z * sa, c.y, c.x * sa + c.z * ca);
                    float d = length(p - normalize(cr));
                    float m = exp(-d * d * 4.0);
                    field += m;
                    colorSum += colorsArr[i] * m;
                }
                vec3 orb = colorSum / max(field, 0.001);

                // 液体感: 球面方向の微小ノイズで明度を揺らす（normal 改変は省略・安全策）
                float liqN = sin(p.x * 6.0 + uTime * 0.6) * sin(p.y * 5.0 - uTime * 0.5)
                           * sin(p.z * 7.0 + uTime * 0.4);
                orb *= (1.0 + 0.08 * uLiquid * liqN);

                // 哲学: 中心に微小な太極核を残す (101% は 50% を消さない)
                float coreMask = smoothstep(0.18, 0.04, length(p.xy));
                vec3 taichiCore = mix(black, white, yin);
                orb = mix(orb, taichiCore, coreMask * 0.18);

                // 強い Fresnel (pow 2.5) のリムグロー
                float strongRim = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 2.5);
                vec3 orbRim = orb * strongRim * 0.8;

                // ベースを orb に混ぜる
                col = mix(col, orb, uColorBirth);
                col += orbRim * uColorBirth;
            }

            // 2026-05-17 段階2.1: rcSphere が前面に被さると base alpha を絞る
            //   uColorBirth 0 → 1 で base 透明度を 1.0 → 0.18 (核 18% 残し)
            float baseAlpha = mix(1.0, 0.18, clamp(uColorBirth, 0.0, 1.0));
            gl_FragColor = vec4(col * uTaichiMix, uTaichiMix * baseAlpha);
        }
    `;

    // イージング
    function easeOutCubic(t) { return 1.0 - Math.pow(1.0 - t, 3.0); }
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
        hiddenLegacy: [], // 元の greySphere を保持
        stage2Fired: false, // 2026-05-17 段階2: イベント二重発火防止
        // 2026-05-17 段階2.1: P2/P3 rcSphere 移植用の第二メッシュ
        rcMesh: null,
        rcMat:  null,
        rcGeo:  null,
    };

    // Web Audio (オプション)
    function playEntranceTone() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const now = ctx.currentTime;

            // 0.0s: 柔らかな A3 単音
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 220; // A3
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 1.3);

            // 2.8s: グレーパッド (微小)
            const padOsc = ctx.createOscillator();
            const padOsc2 = ctx.createOscillator();
            const padGain = ctx.createGain();
            padOsc.type = 'sine';
            padOsc2.type = 'sine';
            padOsc.frequency.value = 220;
            padOsc2.frequency.value = 277.18; // C#4
            padGain.gain.setValueAtTime(0.0001, now + 2.8);
            padGain.gain.exponentialRampToValueAtTime(0.025, now + 4.0);
            padOsc.connect(padGain);
            padOsc2.connect(padGain);
            padGain.connect(ctx.destination);
            padOsc.start(now + 2.8);
            padOsc2.start(now + 2.8);
            padOsc.stop(now + 6.0);
            padOsc2.stop(now + 6.0);
        } catch (e) {
            // 失敗しても無視
        }
    }

    // 2026-05-17 段階1.2: 名前ベース hide のみ採用（ヒューリスティック / uniform 検出は廃止）
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
                uGreyMix:   { value: 0 },
                uPrism:     { value: 0 },
                // 2026-05-17 段階1.2: 本物の Fresnel 用カメラ位置
                uCameraPos: { value: new THREE.Vector3() },
                // 2026-05-17 段階2: RGBCMY オーブ生成
                uColorBirth: { value: 0 },
                uLiquid:     { value: 0 },
            },
            transparent: true,
            depthWrite: false,
        });

        state.mesh = new THREE.Mesh(state.geo, state.mat);
        state.mesh.name = 'p1Stage1TaichiSphere';
        state.mesh.position.set(0, 0, 0.7); // 既存 greySphere(z=0.5) の手前
        state.mesh.renderOrder = 999;
        state.mesh.scale.setScalar(REDUCE_MOTION ? 1 : 0.001);
        state.scene.add(state.mesh);

        // 2026-05-17 段階2.1: P2/P3 rcSphere 第二メッシュを生成
        //   z=0.69 (base mesh より僅か手前) で z-fight を回避
        //   uAlpha は uColorBirth と同期 (毎フレーム更新)
        //   render order を base より大きくして前面描画
        state.rcGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
        state.rcMat = new THREE.ShaderMaterial({
            vertexShader: RC_VERT,
            fragmentShader: RC_FRAG,
            uniforms: {
                u_time:   { value: 0 },
                u_hover:  { value: 0 },
                u_clickT: { value: 0 },
                u_morph:  { value: 0 },
                uAlpha:   { value: REDUCE_MOTION ? 1 : 0 },
            },
            transparent: true,
            depthWrite: false,
        });
        state.rcMesh = new THREE.Mesh(state.rcGeo, state.rcMat);
        state.rcMesh.name = 'p1Stage1RCSphere';
        state.rcMesh.position.set(0, 0, 0.69);
        state.rcMesh.renderOrder = 1000;
        state.rcMesh.scale.setScalar(REDUCE_MOTION ? 1 : 0.001);
        state.rcMesh.visible = true;
        state.scene.add(state.rcMesh);

        // 既存グレー球を隠す
        hideLegacyGreySphere(state.scene);

        // 音
        if (!REDUCE_MOTION) playEntranceTone();

        state.startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        state.running = true;

        if (REDUCE_MOTION) {
            // 動きなし: 最終 RGBCMY オーブ状態を即時セット (段階2 完了形)
            state.mat.uniforms.uTaichiMix.value  = 1;
            state.mat.uniforms.uGreyMix.value    = 0.85;
            state.mat.uniforms.uPrism.value      = 1.0;
            state.mat.uniforms.uColorBirth.value = 1;
            state.mat.uniforms.uLiquid.value     = 1;
            // 段階2完了イベントも即発火 (Stage 3 を待たせない)
            try {
                window.dispatchEvent(new CustomEvent('inryoku:p1stage2complete'));
                state.stage2Fired = true;
            } catch (e) {}
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
        // 2026-05-17 段階1.2: 毎フレーム camera 位置を uniform に反映 (本物の Fresnel)
        if (state.camera && u.uCameraPos) {
            u.uCameraPos.value.copy(state.camera.position);
        }

        // 回転 ~12°/sec = 0.2094 rad/s
        state.mesh.rotation.y = t * 0.2094;


        if (t < 0.4) {
            // 0.0–0.4s: 出現
            const p = easeOutCubic(t / 0.4);
            state.mesh.scale.setScalar(Math.max(0.001, p));
            u.uTaichiMix.value = p;
            u.uGreyMix.value   = 0;
            u.uPrism.value     = 0.3 * p;
        } else if (t < SCENE_A_DUR) {
            // 0.4–1.2s: 太極安定
            state.mesh.scale.setScalar(1);
            u.uTaichiMix.value = 1;
            u.uGreyMix.value   = 0;
            u.uPrism.value     = 0.3;
        } else if (t < TOTAL_DUR) {
            // 1.2–2.8s: グレーへ溶解
            const p = easeInOutCubic((t - SCENE_A_DUR) / SCENE_B_DUR);
            state.mesh.scale.setScalar(1);
            u.uTaichiMix.value = 1;
            u.uGreyMix.value   = 0.85 * p;
            u.uPrism.value     = 0.3 + 0.7 * p;
        } else if (t < STAGE2_RAMP_IN) {
            // 2.8–2.95s: Stage 1 から滑らかにバトンタッチ (ほぼホールド)
            state.mesh.scale.setScalar(1);
            u.uTaichiMix.value  = 1;
            u.uGreyMix.value    = 0.85;
            var holdT0 = t - TOTAL_DUR;
            u.uPrism.value      = 0.55 + 0.45 * Math.sin(holdT0 * 0.8);
            // ほぼ感じない程度に色生を立ち上げ
            var pre = (t - STAGE2_START) / (STAGE2_RAMP_IN - STAGE2_START);
            u.uColorBirth.value = 0.02 * easeOutCubic(pre);
            u.uLiquid.value     = 0;
        } else if (t < STAGE2_RAMP_END) {
            // 2.95–4.0s: uColorBirth が 0 → 1 (ease-in-out cubic) で開花、液体感も付与
            var p2 = (t - STAGE2_RAMP_IN) / (STAGE2_RAMP_END - STAGE2_RAMP_IN);
            var e2 = easeInOutCubic(p2);
            // 3% 呼吸スケール
            state.mesh.scale.setScalar(1.0 + 0.03 * Math.sin(p2 * Math.PI));
            u.uTaichiMix.value  = 1;
            u.uGreyMix.value    = 0.85;
            u.uPrism.value      = 0.8 + 0.4 * e2;
            u.uColorBirth.value = e2;
            u.uLiquid.value     = e2;
        } else if (t < STAGE2_END) {
            // 4.0–4.2s: settle (光がふっと締まる)
            var p3 = (t - STAGE2_RAMP_END) / (STAGE2_END - STAGE2_RAMP_END);
            // settle ライトパルス
            var puls = 1.0 + 0.04 * (1.0 - p3);
            state.mesh.scale.setScalar(puls);
            u.uTaichiMix.value  = 1;
            u.uGreyMix.value    = 0.85;
            u.uPrism.value      = 1.2 - 0.2 * p3; // 1.2 → 1.0
            u.uColorBirth.value = 1;
            u.uLiquid.value     = 1;
        } else {
            // 4.2s+: RGBCMY オーブを保持。微呼吸 + 内部色循環は uTime で自動
            state.mesh.scale.setScalar(1);
            u.uTaichiMix.value  = 1;
            u.uGreyMix.value    = 0.85;
            var holdT2 = t - STAGE2_END;
            u.uPrism.value      = 0.9 + 0.25 * Math.sin(holdT2 * 0.7);
            u.uColorBirth.value = 1;
            u.uLiquid.value     = 1;
            // 段階2完了イベント (一度だけ)
            if (!state.stage2Fired) {
                state.stage2Fired = true;
                try {
                    window.dispatchEvent(new CustomEvent('inryoku:p1stage2complete'));
                } catch (e) {}
            }
        }

        // 2026-05-17 段階2.1: rcSphere を base と同期 (uniform/rotation/scale)
        //   uAlpha は base 側で確定した uColorBirth を直結 → 最終的に 1.0 で
        //   P3 i ドットロゴ球と同一の不透明描画になる。
        if (state.rcMesh && state.rcMat) {
            var ru = state.rcMat.uniforms;
            ru.u_time.value   = t;
            ru.u_hover.value  = 0;
            ru.u_clickT.value = 0;
            ru.u_morph.value  = 0;
            ru.uAlpha.value   = Math.max(0, Math.min(1, u.uColorBirth.value));
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
        // 2026-05-17 段階2.1: rcSphere (第二メッシュ) も破棄
        if (state.rcMesh && state.scene) {
            state.scene.remove(state.rcMesh);
        }
        if (state.rcGeo) state.rcGeo.dispose();
        if (state.rcMat) state.rcMat.dispose();
        // 隠した既存球を元に戻す
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

    // 2026-05-17 段階1.2: フラグは登録試行前に即セット
    // → renderPhase1 がまだ走っていない段階でも、後から inryokuP1 が
    //   作られた瞬間に stage1Enabled=true を上書きする。
    function setEnabled() {
        if (window.inryokuP1) {
            window.inryokuP1.stage1Enabled = true;
        }
    }
    setEnabled();

    // 登録: window.inryokuP1 が後から定義される場合に備えてポーリング
    function tryRegister(attempts) {
        if (window.inryokuP1 && typeof window.inryokuP1.registerStage1Handler === 'function') {
            // 2026-05-17 段階1.2: registerStage1Handler 呼び出し前に必ずフラグを立てる
            window.inryokuP1.stage1Enabled = true;
            window.inryokuP1.registerStage1Handler(initStage1);
            return;
        }
        // 2026-05-17 段階1.2: inryokuP1 がまだ無くてもポーリング中に出来たら即フラグセット
        setEnabled();
        if (attempts <= 0) return;
        setTimeout(function() { tryRegister(attempts - 1); }, 100);
    }
    tryRegister(50); // 最大 5 秒

    // フォールバック: イベント直接購読（registerStage1Handler 取りこぼし対策）
    window.addEventListener('inryoku:p1_50percent', function(ev) {
        // 2026-05-17 段階1.2: イベント経由でも必ずフラグを立てる
        if (window.inryokuP1) window.inryokuP1.stage1Enabled = true;
        if (!state.running && !state.disposed) {
            initStage1(ev.detail);
        }
    });
})();
