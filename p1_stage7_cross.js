// 2026-05-18 P1 Stage 7: Cross Axis (RGB vertical / CMY horizontal) → P2 handoff
// 2026-05-18 段階8: cross が eye の中心から POINT → BEAM として爆発成長する
// inryoku:p1stage6complete を受信 → 1.7s cross + 0.9s P2 transition → inryoku:p1complete 発火
//
// 0.0-0.6s: 中心の一点から十字光線が伸びる (uGrow 0→1, easeOutCubic)
// 0.6-1.2s: peak brightness (divine hold)
// 1.2-1.7s: 縦線優位 (CMY 横軸フェード、RGB 縦軸残る)
// 1.7-2.6s: P2 へ橋渡し (window.__inryokuP1ToP2 を立てて p1complete 発火)
//
// 縦軸 = RGB (精神・デジタル) / 横軸 = CMY (物質・アナログ)

(function p1Stage7IIFE() {
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

    // 旧 (段階7): T_BUILD=0.4s で 0→1 だけ。点→十字の概念がなかった。
    // const T_BUILD = 0.4;
    // 2026-05-18 段階8: 点→ビーム成長を 0.6s
    const T_BUILD = 0.6;
    const T_HOLD  = 1.2;
    const T_VERTICAL = 1.7;
    const T_P2 = 2.6; // 1.7 + 0.9
    const HANDOFF_TIME = 1.7;

    function easeOutCubic(t) { return 1.0 - Math.pow(1.0 - t, 3.0); }
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

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
        'uniform float uCross;',
        'uniform float uCrossTime;',
        'uniform float uHorizFade;',
        'uniform float uGrow;',         // 2026-05-18 段階8: 0=point 1=full cross
        'void main(){',
        '    vec2 p = vUv * 2.0 - 1.0;',
        // 2026-05-18 段階8: beam length は uGrow で 0.05→1.2 に成長
        '    float beamLen = mix(0.05, 1.2, uGrow);',
        '    float vertical = exp(-abs(p.x) * 70.0) * smoothstep(beamLen, 0.0, abs(p.y));',
        '    float horizontal = exp(-abs(p.y) * 70.0) * smoothstep(beamLen, 0.0, abs(p.x));',
        '    horizontal *= uHorizFade;',
        '    float core = exp(-dot(p,p) * 45.0);',
        '    vec3 rgbAxis = vec3(0.75, 0.88, 1.0);',
        '    vec3 cmyAxis = vec3(1.0, 0.82, 0.92);',
        '    vec3 col = vertical * rgbAxis + horizontal * cmyAxis + core * vec3(1.0) * 2.5;',
        '    float flash = uCross * exp(-uCrossTime * 1.8);',
        '    col *= 0.4 + flash * 2.8;',
        // 2026-05-18 段階8: divine intensity boost during growth
        '    col *= 1.0 + uGrow * 1.5;',
        '    float alpha = clamp(vertical + horizontal + core, 0.0, 1.0) * uCross;',
        '    gl_FragColor = vec4(col, alpha);',
        '}'
    ].join('\n');

    const state = {
        scene: null, camera: null,
        mesh: null, mat: null, geo: null,
        startTime: 0, rafId: 0,
        running: false, disposed: false,
        handoffFired: false, completeFired: false,
        audioStarted: false,
        audioCtx: null, humOsc: null, humGain: null,
    };

    function buildPlane(camera) {
        let w = 5.0, h = 2.8;
        if (camera && camera.isPerspectiveCamera) {
            const d = 0.45;
            const aspect = camera.aspect || 1.0;
            const vFov = (camera.fov * Math.PI) / 180.0;
            h = 2 * d * Math.tan(vFov / 2) * 2.4;
            w = h * aspect;
        }
        return new THREE.PlaneGeometry(w, h, 1, 1);
    }

    function startCrossHum() {
        if (REDUCE_MOTION || state.audioStarted) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            state.audioStarted = true;
            const ctx = new Ctx();
            state.audioCtx = ctx;
            const now = ctx.currentTime;
            state.humOsc = ctx.createOscillator();
            state.humGain = ctx.createGain();
            state.humOsc.type = 'sine';
            state.humOsc.frequency.setValueAtTime(110, now);
            state.humOsc.frequency.exponentialRampToValueAtTime(220, now + 1.2);
            state.humGain.gain.setValueAtTime(0.0001, now);
            state.humGain.gain.exponentialRampToValueAtTime(0.06, now + 0.5);
            state.humGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
            state.humOsc.connect(state.humGain).connect(ctx.destination);
            state.humOsc.start(now);
            state.humOsc.stop(now + 2.7);

            // chord at vertical-dominant moment (~1.2s)
            const chordTime = now + 1.2;
            const freqs = [261.63, 329.63, 392.00]; // C major triad (RGB digital chord)
            for (let i = 0; i < freqs.length; i++) {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'sine';
                o.frequency.value = freqs[i];
                g.gain.setValueAtTime(0.0001, chordTime);
                g.gain.exponentialRampToValueAtTime(0.04, chordTime + 0.05);
                g.gain.exponentialRampToValueAtTime(0.0001, chordTime + 0.9);
                o.connect(g).connect(ctx.destination);
                o.start(chordTime); o.stop(chordTime + 1.0);
            }
        } catch (e) {}
    }

    function initStage7() {
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
                uTime: { value: 0 },
                uCross: { value: 0 },
                uCrossTime: { value: 0 },
                uHorizFade: { value: 1 },
                uGrow: { value: 0 },     // 2026-05-18 段階8
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
        });
        state.mesh = new THREE.Mesh(state.geo, state.mat);
        state.mesh.name = 'p1Stage7Cross';
        state.mesh.frustumCulled = false;
        state.mesh.renderOrder = 10001;
        if (camera && camera.isPerspectiveCamera) {
            state.mesh.position.set(0, 0, -0.45);
            camera.add(state.mesh);
            if (!camera.parent) scene.add(camera);
        } else {
            state.mesh.position.set(0, 0, 0.25);
            scene.add(state.mesh);
        }

        state.startTime = performance.now();
        state.running = true;
        startCrossHum();

        if (REDUCE_MOTION) {
            state.mat.uniforms.uCross.value = 1;
            setTimeout(fireHandoff, 80);
            setTimeout(fireComplete, 300);
            return;
        }

        const tick = function(now) {
            if (!state.running || state.disposed) return;
            const t = ((now || performance.now()) - state.startTime) / 1000.0;
            update(t);
            if (t >= HANDOFF_TIME && !state.handoffFired) fireHandoff();
            if (t < T_P2 + 0.05) {
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
        u.uCrossTime.value = t;

        let cross;
        let horizFade = 1;
        // 2026-05-18 段階8: uGrow は最初の 0.6s で 0→1 (point→full cross)
        const growT = Math.min(1, t / T_BUILD);
        u.uGrow.value = easeOutCubic(growT);
        if (t < T_BUILD) {
            cross = easeOutCubic(t / T_BUILD);
        } else if (t < T_HOLD) {
            cross = 1;
        } else if (t < T_VERTICAL) {
            cross = 1;
            const p = (t - T_HOLD) / (T_VERTICAL - T_HOLD);
            horizFade = 1 - easeInOutCubic(p);
        } else if (t < T_P2) {
            // P2 transition: cross fades but vertical stays bright
            const p = (t - T_VERTICAL) / (T_P2 - T_VERTICAL);
            cross = 1 - easeOutCubic(p) * 0.7;
            horizFade = 0;
        } else {
            cross = 0; horizFade = 0;
        }
        u.uCross.value = cross;
        u.uHorizFade.value = horizFade;

        // sphere uCrossPhase mirror
        try {
            const sphere = state.scene && state.scene.getObjectByName('p1Stage1TaichiSphere');
            if (sphere && sphere.material && sphere.material.uniforms
                && sphere.material.uniforms.uCrossPhase) {
                sphere.material.uniforms.uCrossPhase.value = cross;
            }
        } catch (e) {}
    }

    function fireHandoff() {
        if (state.handoffFired) return;
        state.handoffFired = true;
        try {
            window.__inryokuP1ToP2 = {
                from: 'cross',
                ts: performance.now(),
                seedLine: { x: 0, y0: -1, y1: 1, color: 'white', phase: 'vertical-axis' },
                core: { exists: true, colorState: 'rgbcmy-white' },
            };
        } catch (e) {}
        // 即 p1complete 発火 (HTML が renderPhase2 を呼ぶ)
        // 縦線は 0.9s かけて自然消去 (P2 が起動した上でフェード)
        try {
            window.dispatchEvent(new CustomEvent('inryoku:p1complete', {
                detail: window.__inryokuP1ToP2,
            }));
        } catch (e) {}
    }

    function fireComplete() {
        if (state.completeFired) return;
        state.completeFired = true;
        // handoff がまだなら今発火
        if (!state.handoffFired) fireHandoff();
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
        try {
            const sphere = state.scene && state.scene.getObjectByName('p1Stage1TaichiSphere');
            if (sphere && sphere.material && sphere.material.uniforms
                && sphere.material.uniforms.uCrossPhase) {
                sphere.material.uniforms.uCrossPhase.value = 0;
            }
        } catch (e) {}
        state.mesh = null; state.mat = null; state.geo = null;
    }

    window.inryokuP1Stage7 = { init: initStage7, dispose: dispose };

    window.addEventListener('inryoku:p1stage6complete', function() {
        if (!state.running && !state.disposed) initStage7();
    });
})();
