// 2026-05-18 P1 Stage 5: White World (RGB混合の白)
// inryoku:p1stage3complete を受信 → 1.1s の white world フェーズ → inryoku:p1stage5complete 発火
//
// アクセス: window.inryokuP1Stage1 から scene/camera を取得し、camera 子に
// フルスクリーン plane を追加。sphere の uWhitePhase を 0→1→0 で駆動。
// reduce-motion: 即最終状態へ遷移し short timeout で完了イベント発火。

(function p1Stage5IIFE() {
    'use strict';
    if (typeof window === 'undefined') return;

    const REDUCE_MOTION = (typeof window.matchMedia === 'function')
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    const IS_MOBILE = (typeof navigator !== 'undefined')
        && (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
            || (window.innerWidth < 640)
            || (typeof window.matchMedia === 'function'
                && window.matchMedia('(pointer: coarse)').matches));

    const DUR_TOTAL = 1.1;       // 5.4 → 6.5s (Stage4 morph end 基準)
    const FADE_IN_DUR = 0.35;
    const HOLD_DUR    = 0.35;
    const FADE_OUT_DUR = 0.40;

    function smoothstep(a, b, x) {
        const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    }
    function easeOutCubic(t) { return 1.0 - Math.pow(1.0 - t, 3.0); }

    const VERT = [
        'varying vec2 vUv;',
        'void main(){',
        '    vUv = uv;',
        '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
    ].join('\n');

    const FRAG = [
        'precision highp float;',
        'varying vec2 vUv;',
        'uniform float uTime;',
        'uniform float uWhiteWorld;',
        'void main(){',
        '    vec2 p = vUv * 2.0 - 1.0;',
        '    float r = length(p);',
        '    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);',
        '    float rings = sin(r * r * 120.0 - uTime * 1.8) * 0.5 + 0.5;',
        '    vec3 white = vec3(1.0);',
        '    vec3 rgbWhite = vec3(1.0, 0.985, 0.965)',
        '        + vec3(sin(r*32.0+uTime), sin(r*34.0+uTime+2.1), sin(r*36.0+uTime+4.2)) * 0.018;',
        '    vec3 col = mix(white, rgbWhite, 0.55);',
        '    col += rings * 0.025;',
        '    col += (grain - 0.5) * 0.012;',
        '    float vignette = smoothstep(1.4, 0.15, r);',
        '    gl_FragColor = vec4(col, uWhiteWorld * vignette);',
        '}'
    ].join('\n');

    const state = {
        scene: null, camera: null,
        mesh: null, mat: null, geo: null,
        startTime: 0, rafId: 0,
        running: false, disposed: false,
        fired: false,
    };

    function buildPlane(camera) {
        let w = 4.4, h = 2.6;
        if (camera && camera.isPerspectiveCamera) {
            const d = 0.55;
            const aspect = camera.aspect || 1.0;
            const vFov = (camera.fov * Math.PI) / 180.0;
            h = 2 * d * Math.tan(vFov / 2) * 4.0;
            w = h * aspect;
        }
        return new THREE.PlaneGeometry(w, h, 1, 1);
    }

    function initStage5() {
        if (state.running || state.disposed) return;
        const s1 = window.inryokuP1Stage1;
        if (!s1 || typeof THREE === 'undefined') {
            console.warn('[P1 stage5] missing inryokuP1Stage1 or THREE');
            return;
        }
        const scene = s1.scene;
        const camera = s1.camera;
        if (!scene) {
            console.warn('[P1 stage5] no scene');
            return;
        }
        state.scene = scene;
        state.camera = camera;

        state.geo = buildPlane(camera);
        state.mat = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
                uTime:       { value: 0 },
                uWhiteWorld: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.NormalBlending,
        });
        state.mesh = new THREE.Mesh(state.geo, state.mat);
        state.mesh.name = 'p1Stage5WhiteWorld';
        state.mesh.frustumCulled = false;
        state.mesh.renderOrder = 9998; // tunnel(9999) より下、球(999/1000) より上
        if (camera && camera.isPerspectiveCamera) {
            state.mesh.position.set(0, 0, -0.55);
            camera.add(state.mesh);
            if (!camera.parent) scene.add(camera);
        } else {
            state.mesh.position.set(0, 0, 0.35);
            scene.add(state.mesh);
        }

        state.startTime = performance.now();
        state.running = true;

        if (REDUCE_MOTION) {
            state.mat.uniforms.uWhiteWorld.value = 0;
            setTimeout(fireComplete, 80);
            return;
        }

        // Audio: kill low frequencies (sphere1 audioMaster fade)
        // 既存 fadeOutAllAudio が既に呼ばれているはず → ここでは無音保持

        const tick = function(now) {
            if (!state.running || state.disposed) return;
            const t = ((now || performance.now()) - state.startTime) / 1000.0;
            update(t);
            if (t < DUR_TOTAL + 0.15) {
                state.rafId = requestAnimationFrame(tick);
            } else {
                fireComplete();
            }
        };
        state.rafId = requestAnimationFrame(tick);
    }

    function update(t) {
        if (!state.mat) return;
        const u = state.mat.uniforms;
        u.uTime.value = t;

        let w;
        if (t < FADE_IN_DUR) {
            w = easeOutCubic(t / FADE_IN_DUR);
        } else if (t < FADE_IN_DUR + HOLD_DUR) {
            w = 1.0;
        } else if (t < FADE_IN_DUR + HOLD_DUR + FADE_OUT_DUR) {
            const p = (t - FADE_IN_DUR - HOLD_DUR) / FADE_OUT_DUR;
            w = 1.0 - easeOutCubic(p);
        } else {
            w = 0;
        }
        u.uWhiteWorld.value = w;

        // 球の uWhitePhase をミラー
        try {
            const sphere = state.scene && state.scene.getObjectByName('p1Stage1TaichiSphere');
            if (sphere && sphere.material && sphere.material.uniforms
                && sphere.material.uniforms.uWhitePhase) {
                sphere.material.uniforms.uWhitePhase.value = w;
            }
        } catch (e) {}
    }

    function fireComplete() {
        if (state.fired) return;
        state.fired = true;
        try {
            window.dispatchEvent(new CustomEvent('inryoku:p1stage5complete'));
        } catch (e) {}
        // dispose は少し遅らせて自然消去
        setTimeout(dispose, 250);
    }

    function dispose() {
        state.disposed = true;
        state.running = false;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        if (state.mesh) {
            if (state.mesh.parent) state.mesh.parent.remove(state.mesh);
        }
        if (state.geo) state.geo.dispose();
        if (state.mat) state.mat.dispose();
        // 球の uWhitePhase をリセット
        try {
            const sphere = state.scene && state.scene.getObjectByName('p1Stage1TaichiSphere');
            if (sphere && sphere.material && sphere.material.uniforms
                && sphere.material.uniforms.uWhitePhase) {
                sphere.material.uniforms.uWhitePhase.value = 0;
            }
        } catch (e) {}
        state.mesh = null; state.mat = null; state.geo = null;
    }

    window.inryokuP1Stage5 = { init: initStage5, dispose: dispose };

    window.addEventListener('inryoku:p1stage3complete', function() {
        if (!state.running && !state.disposed) initStage5();
    });
})();
