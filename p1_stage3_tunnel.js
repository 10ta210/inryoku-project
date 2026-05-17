// 2026-05-17 P1 拡張シーン Stage 3: RGBCMY オーブ → 虹色トンネル
// Scene D (4.2–6.6s): RGBCMY オーブが奥行きに引き伸ばされ、
//   背後に虹色トンネルが形成される。カメラ FOV を 50→72 に広げ
//   「ワープ感」を演出。6.4s で中心が白く強発光して Scene E へ橋渡し。
// 6.6s で inryoku:p1stage3complete 発火。
//
// アクセス: window.inryokuP1Stage1 経由で scene / camera / renderer /
//   rcMesh / mat (taichi base) を取得。Stage 1/2 は破壊しない。
// reduce-motion: 即最終状態にして遅延ゼロで完了イベント発火。

(function p1Stage3IIFE() {
    'use strict';
    if (typeof window === 'undefined') return;

    const REDUCE_MOTION = (typeof window.matchMedia === 'function')
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    // 2026-05-17 段階3.1: timeline 4.0s (was 2.4s)
    //   0.0 → 1.6 : orb 縮小 + tunnel フェードイン (旧 SHRINK)
    //   1.6 → 3.4 : フルラッシュ
    //   3.4 → 4.0 : 白フラッシュ
    // const DUR_TOTAL_OLD = 2.4; // 旧 (互換のため残置)
    const DUR_TOTAL    = 4.0;
    const SHRINK_END   = 1.6;
    const RUSH_END     = 3.4;
    const FLASH_END    = 4.0;

    // 2026-05-17 段階3.1: モバイル検出 (FOV cap, UV speed reduction)
    const IS_MOBILE = (typeof navigator !== 'undefined')
        && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    // 2026-05-17 段階3.1: FOV cap mobile 60, desktop 72
    const FOV_DELTA_MAX = IS_MOBILE ? 10 : 22;  // 50 → 60 (mobile) / 50 → 72 (desktop)
    // 2026-05-17 段階3.1: モバイルは UV speed を 30% 削減
    const SPEED_SCALE = IS_MOBILE ? 0.7 : 1.0;

    const TUNNEL_VERT = [
        'varying vec2 vUv;',
        'void main(){',
        '    vUv = uv;',
        '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
    ].join('\n');

    const TUNNEL_FRAG = [
        'precision highp float;',
        'uniform float uTime;',
        'uniform float uTunnelProgress;',
        'uniform float uSpeed;',
        'uniform float uWarp;',
        'uniform float uPulse;',
        'varying vec2 vUv;',
        '',
        'vec3 hsv2rgb(vec3 c){',
        '    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);',
        '    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
        '    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
        '}',
        '',
        'void main(){',
        '    vec2 uv = vUv - 0.5;',
        '    float r = length(uv);',
        '    float angle = atan(uv.y, uv.x);',
        '',
        '    // tunnel depth (1/r)',
        '    float depth = 1.0 / max(r, 0.05);',
        '',
        '    // scrolling rings into the distance',
        '    float spiral = sin(angle * 6.0 + depth * 8.0 * uWarp - uTime * uSpeed * 5.0);',
        '    float ring   = sin(depth * 20.0 - uTime * uSpeed * 8.0);',
        '    float tunnel = smoothstep(0.2, 1.0, spiral * ring);',
        '',
        '    // 6 波長 (RGBCMY) を意識した hue cycle',
        '    float hue = fract(angle / 6.283 + depth * 0.05 + uTime * 0.04);',
        '    vec3 col = hsv2rgb(vec3(hue, 0.9, 1.0));',
        '    col *= tunnel;',
        '',
        '    // 中央の白核 (Scene E への橋渡し)',
        '    float focal = exp(-r * r * 12.0) * (0.6 + uPulse * 0.8);',
        '    col += vec3(0.9, 0.92, 1.0) * focal;',
        '',
        '    // 外周フェード (矩形端の干渉を消す)',
        '    float outerFade = 1.0 - smoothstep(0.45, 0.7, r);',
        '    col *= outerFade;',
        '',
        '    float a = uTunnelProgress * (tunnel * 0.85 + focal);',
        '    gl_FragColor = vec4(col * uTunnelProgress, clamp(a, 0.0, 1.0));',
        '}'
    ].join('\n');

    function easeOutCubic(t)   { return 1.0 - Math.pow(1.0 - t, 3.0); }
    function easeInCubic(t)    { return t * t * t; }
    function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

    let state = {
        scene: null,
        camera: null,
        renderer: null,
        tunnelMesh: null,
        tunnelMat:  null,
        tunnelGeo:  null,
        rcMesh: null,        // Stage 2 の RGBCMY オーブ
        baseMat: null,       // Stage 1/2 の taichi/grey base
        startTime: 0,
        rafId: 0,
        running: false,
        disposed: false,
        stage3Fired: false,
        savedFov: null,
        usePerspective: false,
        // 2026-05-17 段階3.1: pre-warp / breakthrough event state
        prewarpActive: false,    // event 受信したか (fade-in start)
        breakthroughActive: false, // event 受信したか (full alpha ramp start)
        prewarpStartTime: 0,
        breakthroughStartTime: 0,
        fullscreenOverlay: true, // フルスクリーン覆い被せ
    };

    // tunnel plane のサイズ算出: camera から一定距離前にカメラビューを満たす
    function buildTunnelPlane(camera) {
        let w = 2.0, h = 2.0;
        // PerspectiveCamera: 距離 d で見える高さ = 2 * d * tan(fov/2)
        if (camera && camera.isPerspectiveCamera) {
            const d = 0.6; // カメラ前面 0.6 にプレートを置く
            const aspect = camera.aspect || 1.0;
            const vFov = (camera.fov * Math.PI) / 180.0;
            h = 2 * d * Math.tan(vFov / 2);
            w = h * aspect;
            // 2026-05-17 段階3.1: フルスクリーン overlay (×2.2 拡大、FOV 72 でも端まで覆う)
            w *= 2.2; h *= 2.2;
        } else if (camera && camera.isOrthographicCamera) {
            w = (camera.right - camera.left) * 1.1;
            h = (camera.top - camera.bottom) * 1.1;
        }
        return new THREE.PlaneGeometry(w, h, 1, 1);
    }

    function initStage3() {
        if (state.running || state.disposed) return;
        const s1 = window.inryokuP1Stage1;
        if (!s1 || typeof THREE === 'undefined') {
            console.warn('[P1 stage3] missing inryokuP1Stage1 or THREE');
            return;
        }
        // 内部 state へアクセス (公開されてない場合はメッシュ名で取得)
        // s1.init/update/dispose のみ公開なので、scene 経由でメッシュを引く
        const rcMesh = (s1.scene && s1.scene.getObjectByName)
            ? s1.scene.getObjectByName('p1Stage1RCSphere')
            : null;
        const baseMesh = (s1.scene && s1.scene.getObjectByName)
            ? s1.scene.getObjectByName('p1Stage1TaichiSphere')
            : null;

        // scene/camera/renderer は s1 が露出してないので、rcMesh の親から拾う
        let scene = null, camera = null, renderer = null;
        if (rcMesh) {
            let p = rcMesh.parent;
            while (p) { scene = p; p = p.parent; }
        }
        // フォールバック: window.inryokuP1 から拾う
        if (!scene && window.inryokuP1) {
            scene   = window.inryokuP1.scene    || scene;
            camera  = window.inryokuP1.camera   || camera;
            renderer= window.inryokuP1.renderer || renderer;
        }
        if (!camera && window.inryokuP1)   camera   = window.inryokuP1.camera   || null;
        if (!renderer && window.inryokuP1) renderer = window.inryokuP1.renderer || null;

        if (!scene) {
            console.warn('[P1 stage3] cannot find scene from rcMesh / inryokuP1');
            return;
        }

        state.scene    = scene;
        state.camera   = camera;
        state.renderer = renderer;
        state.rcMesh   = rcMesh;
        state.baseMat  = baseMesh ? baseMesh.material : null;

        // FOV 保存
        if (state.camera && state.camera.isPerspectiveCamera) {
            state.usePerspective = true;
            state.savedFov = state.camera.fov;
        }

        // tunnel plane 生成
        state.tunnelGeo = buildTunnelPlane(state.camera);
        state.tunnelMat = new THREE.ShaderMaterial({
            vertexShader:   TUNNEL_VERT,
            fragmentShader: TUNNEL_FRAG,
            uniforms: {
                uTime:            { value: 0 },
                uTunnelProgress:  { value: 0 },
                uSpeed:           { value: 0 },
                uWarp:            { value: 1.0 },
                uPulse:           { value: 0 },
            },
            transparent: true,
            depthWrite:  false,
            depthTest:   false, // 2026-05-17 段階3.1: フルスクリーン overlay
            blending:    THREE.AdditiveBlending,
        });
        state.tunnelMesh = new THREE.Mesh(state.tunnelGeo, state.tunnelMat);
        state.tunnelMesh.name = 'p1Stage3TunnelPlane';
        // 2026-05-17 段階3.1: フルスクリーン overlay (UI ingest 後の void を覆う)
        state.tunnelMesh.frustumCulled = false;
        // カメラ前面に固定するため、camera が PerspectiveCamera なら
        // camera の child にする → カメラと一緒に動く / 常に正面
        if (state.camera && state.camera.isPerspectiveCamera) {
            state.tunnelMesh.position.set(0, 0, -0.6); // camera の前 0.6
            state.camera.add(state.tunnelMesh);
            // camera が scene に追加されてないと描画されないので確認
            if (!state.camera.parent) {
                try { state.scene.add(state.camera); } catch (e) {}
            }
        } else {
            // Orthographic: 一旦 z=0.3 (sphere の手前ちょい奥) に置く
            state.tunnelMesh.position.set(0, 0, 0.3);
            state.scene.add(state.tunnelMesh);
        }
        // 2026-05-17 段階3.1: renderOrder 9999 (球より上、フルスクリーン)
        state.tunnelMesh.renderOrder = 9999;

        // sphere は前面 (renderOrder 999/1000 のまま) — Stage1 既に設定済み

        state.startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        state.running   = true;

        if (REDUCE_MOTION) {
            // 即最終状態 → 完了イベント
            applyFinalState();
            setTimeout(function() { fireStage3Complete(); }, 50);
            return;
        }

        const tick = function(now) {
            if (!state.running || state.disposed) return;
            const t = ((now || performance.now()) - state.startTime) / 1000.0
                      * (window._p1FastForward || 1);
            updateStage(t);
            if (t < DUR_TOTAL + 0.05) {
                state.rafId = requestAnimationFrame(tick);
            } else {
                fireStage3Complete();
            }
        };
        state.rafId = requestAnimationFrame(tick);
    }

    function applyFinalState() {
        if (!state.tunnelMat) return;
        const u = state.tunnelMat.uniforms;
        u.uTunnelProgress.value = 1;
        u.uSpeed.value          = 0.6;
        u.uWarp.value           = 1.4;
        u.uPulse.value          = 1.0;
        // orb fade out
        if (state.rcMesh) {
            state.rcMesh.scale.setScalar(0.05);
            if (state.rcMesh.material && state.rcMesh.material.uniforms
                && state.rcMesh.material.uniforms.uAlpha) {
                state.rcMesh.material.uniforms.uAlpha.value = 0;
            }
        }
        if (state.baseMat && state.baseMat.uniforms
            && state.baseMat.uniforms.uTaichiMix) {
            state.baseMat.uniforms.uTaichiMix.value = 0;
        }
    }

    function updateStage(t) {
        if (!state.tunnelMat) return;
        const u = state.tunnelMat.uniforms;
        u.uTime.value = t;

        let progress, speed, warp, pulse;
        let orbScale = 1, orbAlpha = 1, baseMix = 1;
        let fovExtra = 0;

        if (t < SHRINK_END) {
            // 0.0 → 1.2s: orb 縮小 + tunnel フェードイン
            const p = t / SHRINK_END;
            const e = easeInOutCubic(p);
            progress = e;
            speed    = 0.15 + 0.35 * e;       // 0.15 → 0.5
            warp     = 0.6 + 0.6 * e;          // 0.6 → 1.2
            pulse    = 0;
            // orb shrink (ease-in cubic) 1.0 → 0.05
            const sP = easeInCubic(p);
            orbScale = 1.0 - 0.95 * sP;
            orbAlpha = 1.0 - sP;
            baseMix  = 1.0 - 0.7 * e;
            fovExtra = FOV_DELTA_MAX * e * 0.55; // 50 → ~62
        } else if (t < RUSH_END) {
            // 1.2 → 2.2s: フルラッシュ
            const p = (t - SHRINK_END) / (RUSH_END - SHRINK_END);
            const e = easeInOutCubic(p);
            progress = 1;
            speed    = 0.5 + 0.6 * e;          // 0.5 → 1.1
            warp     = 1.2 + 0.4 * e;          // 1.2 → 1.6
            pulse    = 0.2 * e;
            orbScale = 0.05;
            orbAlpha = 0;
            baseMix  = 0.3 * (1.0 - e);
            // FOV: 62 → 72 (max)
            fovExtra = FOV_DELTA_MAX * (0.55 + 0.45 * e);
        } else if (t < FLASH_END) {
            // 2.2 → 2.4s: 白フラッシュ + FOV を 72 → 50 へ戻し始め
            const p = (t - RUSH_END) / (FLASH_END - RUSH_END);
            const e = easeOutCubic(p);
            progress = 1;
            speed    = 1.1 + 0.6 * e;
            warp     = 1.6;
            pulse    = 0.2 + 0.8 * e;
            orbScale = 0.05;
            orbAlpha = 0;
            baseMix  = 0;
            // FOV 戻し (急ぐと酔うので半分だけ戻す。dispose で完全復元)
            fovExtra = FOV_DELTA_MAX * (1.0 - e * 0.5);
        } else {
            // 終了後 (念のため)
            progress = 1; speed = 1.4; warp = 1.6; pulse = 1.0;
            orbScale = 0.05; orbAlpha = 0; baseMix = 0;
            fovExtra = 0;
        }

        u.uTunnelProgress.value = progress;
        u.uSpeed.value          = speed;
        u.uWarp.value           = warp;
        u.uPulse.value          = pulse;

        if (state.rcMesh) {
            state.rcMesh.scale.setScalar(Math.max(0.001, orbScale));
            if (state.rcMesh.material && state.rcMesh.material.uniforms
                && state.rcMesh.material.uniforms.uAlpha) {
                state.rcMesh.material.uniforms.uAlpha.value = orbAlpha;
            }
        }
        if (state.baseMat && state.baseMat.uniforms
            && state.baseMat.uniforms.uTaichiMix) {
            state.baseMat.uniforms.uTaichiMix.value = baseMix;
        }

        // 2026-05-17 段階3.1: prewarp-only state では progress を 0.15 にクランプ
        // (breakthrough 受信前はうっすら radial distortion だけ見せる)
        if (state.prewarpActive && !state.breakthroughActive) {
            u.uTunnelProgress.value = Math.min(0.15, progress);
            u.uSpeed.value          = Math.min(0.2, speed) * SPEED_SCALE;
        } else {
            u.uSpeed.value *= SPEED_SCALE;
        }

        // 2026-05-17 段階3.1: breakthrough 後 1.2s かけて full alpha ramp
        if (state.breakthroughActive) {
            const elapsed = (performance.now() - state.breakthroughStartTime) / 1000;
            const rampIn = Math.min(1, elapsed / 1.2);
            u.uTunnelProgress.value = Math.max(u.uTunnelProgress.value, rampIn * progress);
        }

        // FOV 適用 (mobile cap 60)
        if (state.usePerspective && state.camera && state.savedFov != null) {
            const fovCap = IS_MOBILE ? 60 : 72;
            const newFov = Math.min(fovCap, state.savedFov + fovExtra);
            if (newFov !== state.camera.fov) {
                state.camera.fov = newFov;
                state.camera.updateProjectionMatrix();
            }
        }
    }

    function fireStage3Complete() {
        if (state.stage3Fired) return;
        state.stage3Fired = true;
        // FOV を完全復元
        if (state.usePerspective && state.camera && state.savedFov != null) {
            state.camera.fov = state.savedFov;
            state.camera.updateProjectionMatrix();
        }
        try {
            window.dispatchEvent(new CustomEvent('inryoku:p1stage3complete'));
        } catch (e) {}
    }

    function dispose() {
        state.disposed = true;
        state.running  = false;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        if (state.tunnelMesh) {
            if (state.tunnelMesh.parent) {
                state.tunnelMesh.parent.remove(state.tunnelMesh);
            }
        }
        if (state.tunnelGeo) state.tunnelGeo.dispose();
        if (state.tunnelMat) state.tunnelMat.dispose();
        // FOV を必ず元へ
        if (state.usePerspective && state.camera && state.savedFov != null) {
            state.camera.fov = state.savedFov;
            state.camera.updateProjectionMatrix();
        }
        state.tunnelMesh = null;
        state.tunnelGeo  = null;
        state.tunnelMat  = null;
    }

    window.inryokuP1Stage3 = {
        init:    initStage3,
        update:  updateStage,
        dispose: dispose,
    };

    // stage2complete を受けて自走
    window.addEventListener('inryoku:p1stage2complete', function() {
        if (!state.running && !state.disposed) {
            initStage3();
        }
    });

    // 2026-05-17 段階3.1: pre-warp イベント (reveal>=0.72 で発火)
    //   tunnel を早期 init して faint radial distortion を流し始める
    window.addEventListener('inryoku:p1_prewarp', function() {
        if (state.disposed) return;
        if (!state.running) {
            initStage3();
        }
        state.prewarpActive = true;
        state.prewarpStartTime = performance.now();
    });

    // 2026-05-17 段階3.1: breakthrough イベント (11.7s)
    //   tunnel が full alpha へ ramp、UI ingest が CSS 側で進行中
    window.addEventListener('inryoku:p1_breakthrough', function() {
        if (state.disposed) return;
        if (!state.running) {
            initStage3();
        }
        state.breakthroughActive = true;
        state.breakthroughStartTime = performance.now();
        // breakthrough を 0 起点として timeline をリスタート (4.0s)
        state.startTime = performance.now();
    });
})();
