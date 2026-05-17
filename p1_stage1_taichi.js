// 2026-05-17 P1 拡張シーン Stage 1: 太極球 → グレー溶解
// Scene A (0.0–1.2s): 陰陽パターンが球面に出現・回転
// Scene B (1.2–2.8s): 境界が溶けてグレーに侵食、リム虹干渉
// 2.8s 以降: グレー球を保持し、次のステージを待つ
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

    const RADIUS = 0.42;

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

            gl_FragColor = vec4(col * uTaichiMix, uTaichiMix);
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

        // 既存グレー球を隠す
        hideLegacyGreySphere(state.scene);

        // 音
        if (!REDUCE_MOTION) playEntranceTone();

        state.startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        state.running = true;

        if (REDUCE_MOTION) {
            // 動きなし: 最終グレー状態を即時セット
            state.mat.uniforms.uTaichiMix.value = 1;
            state.mat.uniforms.uGreyMix.value   = 0.85;
            state.mat.uniforms.uPrism.value     = 1.0;
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
        } else {
            // 2.8s+: 静止グレー保持、ゆっくり回転継続
            state.mesh.scale.setScalar(1);
            u.uTaichiMix.value = 1;
            u.uGreyMix.value   = 0.85;
            // 2026-05-17 段階1.2: ホールド中の微呼吸（リム虹がゆるく脈動）
            var holdT = t - TOTAL_DUR;
            u.uPrism.value = 0.55 + 0.45 * Math.sin(holdT * 0.8);
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
        // 隠した既存球を元に戻す
        state.hiddenLegacy.forEach(function(o) { try { o.visible = true; } catch(e){} });
        state.hiddenLegacy = [];
        state.mesh = null;
        state.geo  = null;
        state.mat  = null;
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
