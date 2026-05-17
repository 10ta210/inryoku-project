// 2026-05-18 P1 Stage 6: Eye (観測の眼)
// inryoku:p1stage5complete を受信 → 1.5s の eye フェーズ → inryoku:p1stage6complete 発火
//
// 0.0-0.5s: 眼が閉じた状態で出現 (uEyeOpen=0, uEyeAlpha 0→1)
// 0.5-0.9s: 閉じたままホールド
// 0.9-1.15s: 開く (uEyeOpen 0→1, easeOutCubic)
// 1.15-1.5s: 開いた状態でマウスを追う (uGaze)
//
// audio: 100-140ms の静寂 → 開く瞬間に短い高音 (~1200Hz)

(function p1Stage6IIFE() {
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

    const DUR_TOTAL = 1.5;
    const T_FADE_IN_END = 0.5;
    const T_HOLD_CLOSED_END = 0.9;
    const T_OPEN_END = 1.15;

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
        'uniform float uEyeOpen;',
        'uniform float uEyeAlpha;',
        'uniform vec2  uGaze;',
        'void main(){',
        '    vec2 p = vUv * 2.0 - 1.0;',
        '    p.x *= 1.65;',
        '    float open = uEyeOpen;',
        '    float lid = smoothstep(open + 0.02, open - 0.02, abs(p.y) - (0.05 + open * 0.34));',
        '    float eyeShape = smoothstep(1.0, 0.72, length(vec2(p.x, p.y * 2.2)));',
        '    vec2 gaze = uGaze * 0.08;',
        '    float iris = smoothstep(0.22, 0.18, length(p - gaze));',
        '    float pupil = smoothstep(0.085, 0.055, length(p - gaze));',
        '    vec3 col = vec3(1.0);',
        '    col = mix(col, vec3(0.02), eyeShape * lid * 0.9);',
        '    col = mix(col, vec3(0.55), iris * lid);',
        '    col = mix(col, vec3(0.0), pupil * lid);',
        '    float alpha = eyeShape * smoothstep(0.0, 0.1, open);',
        '    gl_FragColor = vec4(col, alpha * uEyeAlpha);',
        '}'
    ].join('\n');

    const state = {
        scene: null, camera: null,
        mesh: null, mat: null, geo: null,
        startTime: 0, rafId: 0,
        running: false, disposed: false, fired: false,
        targetGaze: { x: 0, y: 0 },
        smoothedGaze: { x: 0, y: 0 },
        openCueFired: false,
    };

    function onPointerMove(ev) {
        try {
            const x = (ev.clientX / (window.innerWidth || 1)) * 2 - 1;
            const y = -(((ev.clientY || 0) / (window.innerHeight || 1)) * 2 - 1);
            state.targetGaze.x = Math.max(-1, Math.min(1, x));
            state.targetGaze.y = Math.max(-1, Math.min(1, y));
        } catch (e) {}
    }
    function onTouchStart(ev) {
        try {
            const t0 = ev.touches && ev.touches[0];
            if (!t0) return;
            const x = (t0.clientX / (window.innerWidth || 1)) * 2 - 1;
            const y = -((t0.clientY / (window.innerHeight || 1)) * 2 - 1);
            state.targetGaze.x = x; state.targetGaze.y = y;
        } catch (e) {}
    }

    function buildPlane(camera) {
        let w = 5.0, h = 2.8;
        if (camera && camera.isPerspectiveCamera) {
            const d = 0.5;
            const aspect = camera.aspect || 1.0;
            const vFov = (camera.fov * Math.PI) / 180.0;
            h = 2 * d * Math.tan(vFov / 2) * 2.4;
            w = h * aspect;
        }
        return new THREE.PlaneGeometry(w, h, 1, 1);
    }

    function playOpenCue() {
        if (REDUCE_MOTION) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 1200;
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
            osc.connect(g).connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.32);
        } catch (e) {}
    }

    function initStage6() {
        if (state.running || state.disposed) return;
        const s1 = window.inryokuP1Stage1;
        if (!s1 || typeof THREE === 'undefined') return;
        const scene = s1.scene; const camera = s1.camera;
        if (!scene) return;
        state.scene = scene; state.camera = camera;

        state.geo = buildPlane(camera);
        state.mat = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
                uTime:     { value: 0 },
                uEyeOpen:  { value: 0 },
                uEyeAlpha: { value: 0 },
                uGaze:     { value: new THREE.Vector2(0, 0) },
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.NormalBlending,
        });
        state.mesh = new THREE.Mesh(state.geo, state.mat);
        state.mesh.name = 'p1Stage6Eye';
        state.mesh.frustumCulled = false;
        state.mesh.renderOrder = 10000;
        if (camera && camera.isPerspectiveCamera) {
            state.mesh.position.set(0, 0, -0.5);
            camera.add(state.mesh);
            if (!camera.parent) scene.add(camera);
        } else {
            state.mesh.position.set(0, 0, 0.3);
            scene.add(state.mesh);
        }

        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('touchstart', onTouchStart, { passive: true });

        state.startTime = performance.now();
        state.running = true;

        if (REDUCE_MOTION) {
            state.mat.uniforms.uEyeAlpha.value = 1;
            state.mat.uniforms.uEyeOpen.value = 1;
            setTimeout(fireComplete, 120);
            return;
        }

        const tick = function(now) {
            if (!state.running || state.disposed) return;
            const t = ((now || performance.now()) - state.startTime) / 1000.0;
            update(t);
            if (t < DUR_TOTAL + 0.05) {
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

        let alpha = 0, open = 0;
        if (t < T_FADE_IN_END) {
            alpha = easeOutCubic(t / T_FADE_IN_END);
            open = 0;
        } else if (t < T_HOLD_CLOSED_END) {
            alpha = 1; open = 0;
        } else if (t < T_OPEN_END) {
            alpha = 1;
            const p = (t - T_HOLD_CLOSED_END) / (T_OPEN_END - T_HOLD_CLOSED_END);
            open = easeOutCubic(p);
            if (!state.openCueFired && p > 0.0) {
                state.openCueFired = true;
                playOpenCue();
            }
        } else {
            alpha = 1; open = 1;
        }
        u.uEyeAlpha.value = alpha;
        u.uEyeOpen.value = open;

        // Smooth gaze
        state.smoothedGaze.x += (state.targetGaze.x - state.smoothedGaze.x) * 0.12;
        state.smoothedGaze.y += (state.targetGaze.y - state.smoothedGaze.y) * 0.12;
        u.uGaze.value.set(state.smoothedGaze.x, state.smoothedGaze.y);

        // sphere uEyePhase mirror (open に応じて 0→1)
        try {
            const sphere = state.scene && state.scene.getObjectByName('p1Stage1TaichiSphere');
            if (sphere && sphere.material && sphere.material.uniforms
                && sphere.material.uniforms.uEyePhase) {
                sphere.material.uniforms.uEyePhase.value = open * alpha;
            }
        } catch (e) {}
    }

    function fireComplete() {
        if (state.fired) return;
        state.fired = true;
        try {
            window.dispatchEvent(new CustomEvent('inryoku:p1stage6complete'));
        } catch (e) {}
        setTimeout(dispose, 400);
    }

    function dispose() {
        state.disposed = true;
        state.running = false;
        if (state.rafId) cancelAnimationFrame(state.rafId);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('touchstart', onTouchStart);
        if (state.mesh) {
            if (state.mesh.parent) state.mesh.parent.remove(state.mesh);
        }
        if (state.geo) state.geo.dispose();
        if (state.mat) state.mat.dispose();
        try {
            const sphere = state.scene && state.scene.getObjectByName('p1Stage1TaichiSphere');
            if (sphere && sphere.material && sphere.material.uniforms
                && sphere.material.uniforms.uEyePhase) {
                sphere.material.uniforms.uEyePhase.value = 0;
            }
        } catch (e) {}
        state.mesh = null; state.mat = null; state.geo = null;
    }

    window.inryokuP1Stage6 = { init: initStage6, dispose: dispose };

    window.addEventListener('inryoku:p1stage5complete', function() {
        if (!state.running && !state.disposed) initStage6();
    });
})();
