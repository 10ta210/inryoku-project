// 2026-05-18 P1 Stage 6: Eye (観測の眼)
// 2026-05-18 段階8: 時間倍増 — 神聖な weight を与え、開眼の瞬間に divine flash + chord
// inryoku:p1stage5complete を受信 → 2.7s の eye フェーズ → inryoku:p1stage6complete 発火
//
// 0.0-0.6s: 閉じた状態で fade-in (uEyeOpen=0, uEyeAlpha 0→1)
// 0.6-1.6s: HOLD CLOSED (1.0s anticipation — sacred deliberateness)
// 1.6-2.2s: SLOW OPEN (0.6s, easeOutCubic — weighted)
// 2.2-2.7s: 開いた状態でマウスを追う (uGaze) + divine flash @ 2.2s
//
// audio: 開く瞬間 (~2.2s) に divine chime (high tone + 5th)

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

    // 旧 (段階6): 1.5s 総尺。素早すぎて重みが足りなかった。
    // const DUR_TOTAL = 1.5;
    // const T_FADE_IN_END = 0.5;
    // const T_HOLD_CLOSED_END = 0.9;
    // const T_OPEN_END = 1.15;
    // 2026-05-18 段階8: doubled weight
    // const DUR_TOTAL = 2.7;
    // const T_FADE_IN_END = 0.6;
    // const T_HOLD_CLOSED_END = 1.6;
    // const T_OPEN_END = 2.2;
    // 2026-05-18 段階15 P2-1: 凍結 (freeze) フェーズ追加で神聖感を強化 (Codex)
    //   0.0-1.3s  fade-in (closed, darker)
    //   1.3-2.0s  hold closed
    //   2.0-2.2s  完全静止 (freeze, 0.2s)
    //   2.2-2.5s  slow open (0.3s, sun flash trigger)
    //   2.5-3.0s  open hold + gaze
    const DUR_TOTAL = 3.0;
    const T_FADE_IN_END = 1.3;
    const T_HOLD_CLOSED_END = 2.0;
    const T_FREEZE_END = 2.2;
    const T_OPEN_END = 2.5;

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

    // 2026-05-18 段階16: 瞳は横からではなく "白い光の奥" に
    //   旧（段階9）: lateral eye (sclera + lid + iris + pupil from the side) — コメントアウト保存
    //   新: 白い光の世界に、奥へ後退する暗い瞳孔 + 同心リングの虹彩
    /* === 段階9 旧シェーダー（保存） ===
    const FRAG_OLD = [
        'precision highp float;',
        'varying vec2 vUv;',
        'uniform float uTime;',
        'uniform float uEyeOpen;',
        'uniform float uEyeAlpha;',
        'uniform vec2  uGaze;',
        'void main() {',
        '  // ...lateral eye omitted for brevity...',
        '}'
    ].join('\n');
    === */
    const FRAG = [
        'precision highp float;',
        'varying vec2 vUv;',
        'uniform float uTime;',
        'uniform float uEyeOpen;',
        'uniform float uEyeAlpha;',
        'uniform vec2  uGaze;',
        '',
        'void main() {',
        '  vec2 p = vUv * 2.0 - 1.0;',
        '  float r = length(p);',
        '',
        '  // 白い光の世界 (背景は白く滲み)',
        '  vec3 bgWhite = vec3(1.0);',
        '',
        '  // 中心の暗い瞳孔 (奥に向かって暗くなる)',
        '  float pupilR = 0.12;',
        '  float pupil = smoothstep(pupilR, pupilR * 0.6, r);',
        '',
        '  // 瞳孔の濃さは eyeOpen に従う',
        '  float pupilDark = pupil * (0.3 + uEyeOpen * 0.7);',
        '',
        '  // 虹彩 (瞳孔の周りのリング, eyeOpen で出現)',
        '  float irisInner = pupilR;',
        '  float irisOuter = 0.28;',
        '  float iris = smoothstep(irisOuter, irisInner, r) - pupil;',
        '  iris = max(0.0, iris);',
        '',
        '  vec3 irisCol = mix(vec3(0.7, 0.85, 0.95), vec3(0.3, 0.5, 0.8), uEyeOpen);',
        '',
        '  // まぶた (uEyeOpen が低い時、上下から白光が覆う)',
        '  float lid = 1.0 - smoothstep(0.0, 1.0, uEyeOpen);',
        '  float lidMask = smoothstep(uEyeOpen * 0.55, uEyeOpen * 0.55 - 0.04, abs(p.y));',
        '',
        '  // 合成',
        '  vec3 col = bgWhite;',
        '  col = mix(col, irisCol, iris * uEyeOpen * 0.6);',
        '  col = mix(col, vec3(0.0), pupilDark);',
        '',
        '  // まぶたで覆う (閉じている時は白で覆う)',
        '  col = mix(col, bgWhite, lidMask * lid);',
        '',
        '  // 外周は白光に滲んで消える',
        '  float outerFade = smoothstep(1.4, 0.8, r);',
        '',
        '  gl_FragColor = vec4(col, outerFade * uEyeAlpha);',
        '}'
    ].join('\n');

    // 2026-05-18 段階9: Sun flash plane — 開眼の瞬間に vertical/horizontal beams + corona
    const SUN_FRAG = [
        'precision highp float;',
        'varying vec2 vUv;',
        'uniform float uFlash;',
        'void main() {',
        '  vec2 p = vUv * 2.0 - 1.0;',
        '  float r = length(p);',
        '  float core = exp(-r*r*18.0);',
        '  float vertical = exp(-p.x*p.x*900.0) * exp(-abs(p.y)*0.8);',
        '  float horizontal = exp(-p.y*p.y*900.0) * exp(-abs(p.x)*0.8);',
        '  float corona = exp(-r*r*2.2);',
        '  vec3 col = vec3(1.0, 0.96, 0.86) * core * 2.5;',
        '  col += vec3(1.0, 0.9, 0.55) * corona * 0.65;',
        '  col += vec3(0.8, 0.92, 1.0) * vertical;',
        '  col += vec3(1.0, 0.84, 0.72) * horizontal;',
        '  gl_FragColor = vec4(col, (core + vertical + horizontal + corona) * uFlash);',
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
        divineFlashFired: false,   // 2026-05-18 段階8
        // 2026-05-18 段階9: separate sun flash plane (open 0.95 で発火)
        sunMesh: null, sunMat: null, sunGeo: null,
        sunFlashFired: false,
        sunFlashStart: 0,
    };

    // 2026-05-18 段階9: sun flash plane factory
    function createSunFlashPlane() {
        const geo = new THREE.PlaneGeometry(20, 20);
        const mat = new THREE.ShaderMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { uFlash: { value: 0 } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: SUN_FRAG,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, 0, -1);
        mesh.renderOrder = 10005;
        mesh.frustumCulled = false;
        mesh.name = 'p1Stage6SunFlash';
        return { mesh: mesh, mat: mat, geo: geo };
    }

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
            h = 2 * d * Math.tan(vFov / 2) * 4.0;
            w = h * aspect;
        }
        return new THREE.PlaneGeometry(w, h, 1, 1);
    }

    function playOpenCue() {
        // 2026-05-18 段階8: divine chime (root + 5th, soft 8va)
        if (REDUCE_MOTION) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const now = ctx.currentTime;
            // high note (~1200 Hz, E6)
            const freqs = [1318.51, 1975.53]; // E6 + B6 (perfect fifth)
            for (let i = 0; i < freqs.length; i++) {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freqs[i];
                g.gain.setValueAtTime(0.0001, now);
                g.gain.exponentialRampToValueAtTime(i === 0 ? 0.06 : 0.035, now + 0.04);
                g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
                osc.connect(g).connect(ctx.destination);
                osc.start(now); osc.stop(now + 1.0);
            }
        } catch (e) {}
    }

    // 2026-05-18 段階8: divine flash overlay at full-open moment
    function triggerDivineFlash(centerXFrac, centerYFrac) {
        try {
            const cx = (typeof centerXFrac === 'number') ? centerXFrac : 0.5;
            const cy = (typeof centerYFrac === 'number') ? centerYFrac : 0.5;
            const flash = document.createElement('div');
            flash.className = 'p1-divine-flash';
            Object.assign(flash.style, {
                position: 'fixed',
                inset: '0',
                zIndex: '2147483050',
                pointerEvents: 'none',
                background: 'radial-gradient(circle at ' + (cx * 100) + '% ' + (cy * 100) + '%, '
                    + 'rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 15%, transparent 45%)',
                opacity: '0',
                transition: 'opacity 150ms ease-out'
            });
            document.body.appendChild(flash);
            requestAnimationFrame(function(){
                try {
                    flash.style.opacity = '1';
                    setTimeout(function(){
                        try {
                            flash.style.opacity = '0';
                            setTimeout(function(){ try { flash.remove(); } catch (e) {} }, 220);
                        } catch (e) {}
                    }, 120);
                } catch (e) {}
            });
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

        // 2026-05-18 段階9: sun flash plane (camera 親子) — 開眼の瞬間に発火
        try {
            const sun = createSunFlashPlane();
            state.sunMesh = sun.mesh; state.sunMat = sun.mat; state.sunGeo = sun.geo;
            if (camera && camera.isPerspectiveCamera) {
                camera.add(state.sunMesh);
            } else {
                scene.add(state.sunMesh);
            }
        } catch (e) {}

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
            // 2026-05-18 段階15 P2-1: ややダークに fade-in (旧より深い闇)
            alpha = easeOutCubic(t / T_FADE_IN_END);
            open = 0;
        } else if (t < T_HOLD_CLOSED_END) {
            alpha = 1; open = 0;
        } else if (t < T_FREEZE_END) {
            // 2026-05-18 段階15 P2-1: 完全静止フェーズ (0.2s freeze)
            alpha = 1; open = 0;
        } else if (t < T_OPEN_END) {
            alpha = 1;
            const p = (t - T_FREEZE_END) / (T_OPEN_END - T_FREEZE_END);
            open = easeOutCubic(p);
            if (!state.openCueFired && p > 0.0) {
                state.openCueFired = true;
                playOpenCue();
            }
        } else {
            alpha = 1; open = 1;
            // 2026-05-18 段階8: 完全開眼の瞬間 divine flash
            if (!state.divineFlashFired) {
                state.divineFlashFired = true;
                triggerDivineFlash(0.5, 0.5);
            }
        }
        u.uEyeAlpha.value = alpha;
        u.uEyeOpen.value = open;

        // 2026-05-18 段階9: open が 0.95 を初めて越えた瞬間に sun flash 発火
        if (!state.sunFlashFired && open >= 0.95) {
            state.sunFlashFired = true;
            state.sunFlashStart = t;
        }
        if (state.sunMat && state.sunFlashFired) {
            const dt = t - state.sunFlashStart;
            let flash = 0;
            if (dt < 0.2) {
                flash = dt / 0.2;            // 0 → 1 over 200ms (linear-ish in)
            } else if (dt < 0.7) {
                const dd = (dt - 0.2) / 0.5; // 1 → 0 over 500ms (ease-out)
                flash = 1.0 - dd * dd;
            } else {
                flash = 0;
            }
            state.sunMat.uniforms.uFlash.value = Math.max(0, Math.min(1.4, flash));
        }

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
        // 2026-05-18 段階9: sun flash plane cleanup
        if (state.sunMesh) {
            if (state.sunMesh.parent) state.sunMesh.parent.remove(state.sunMesh);
        }
        if (state.sunGeo) state.sunGeo.dispose();
        if (state.sunMat) state.sunMat.dispose();
        state.sunMesh = null; state.sunMat = null; state.sunGeo = null;
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
