// cosmos-integration.js — inryokü P3 orchestrator
// ESM. Boots renderer/scene/camera + effects + postfx + behavior particle
// cloud + audio + observation + interaction + HUD, wired via cosmos-bus.
//
// Public API:
//   bootInryokuP3({ root, count?, tier?, reduceMotion?, urlBehavior? })
//     → { dispose, bus, audio, observation, effects, post, setBehavior,
//         setScene, getState }
//
// Boot order:
//   1. parse url/reduce-motion flags
//   2. create bus + observation
//   3. create renderer/scene/camera + resize listener
//   4. createEffectsLayer (nebula, stars, constellations, bridges, logo,
//      rings, burst, shooting stars)
//   5. createBehaviorParticles (38k Points added to same scene, additive)
//   6. createPostFX (composer + bloom + afterimage)
//   7. createAudio (gesture-gated; overlay drives audio.start())
//   8. createPercentageHud
//   9. wireInteractions (mouse / scroll / keys)
//   10. wire bus glue (behavior:change → effects.setActiveScene + burst +
//       audio canon, observation:pulse → HUD + audio.pulse, etc.)
//   11. start RAF loop
//
// Per-frame order:
//   nebula uniforms.time ← effects.update(t, ctx) ← behavior particles update
//   ← camera orbit ← post.render()

import * as THREE from 'three';
import { createBus } from './cosmos-bus.js';
import { createEffectsLayer } from './cosmos-effects.js';
import { createPostFX } from './cosmos-postfx.js';
import { createAudio } from './cosmos-audio.js';
import { createObservation } from './cosmos-observation.js';
import { wireInteractions } from './cosmos-interaction.js';
import { createPercentageHud } from './cosmos-percentage-hud.js';
import { applyA11y } from './cosmos-a11y.js';
import { BEHAVIORS, resolveBehavior, safeStep, getBehavior } from './behaviors/index.js';

// ---------------------------------------------------------------------------
// Behavior id → effects scene name + burst color + canon mapping.
// effects scene names are 'breathing' | 'hover' | 'ring' | 'glyph' | ...
// (taken from cosmos-effects internal activeScene values).
// ---------------------------------------------------------------------------
const BEHAVIOR_META = {
  breathing_sphere:    { scene: 'breathing', burst: '#a78bfa', canon: 'core' },
  attractor_hover:     { scene: 'hover',     burst: '#22d3ee', canon: 'observation' },
  ring_resonance:      { scene: 'ring',      burst: '#f472b6', canon: 'resonance' },
  convergence_glyph:   { scene: 'glyph',     burst: '#facc15', canon: 'declaration' },
  light_bridge_accent: { scene: 'bridge',    burst: '#a3e635', canon: 'leap' },
  idle_static:         { scene: 'breathing', burst: '#6b7280', canon: 'silence' }
};

function behaviorMeta(id) {
  return BEHAVIOR_META[id] || BEHAVIOR_META.breathing_sphere;
}

// ---------------------------------------------------------------------------
// Behavior particle cloud — single Points mesh, 38k particles.
// Each frame: write target/color through scratch into BufferGeometry attrs.
// Additive blending so it stacks naturally with effects layer.
// ---------------------------------------------------------------------------
function createBehaviorParticles(scene, opts = {}) {
  const count = opts.count || 38000;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // Scratch — written by behavior.step. Three.Vector3 has .set; Three.Color
  // has .setHSL / .setRGB. They are reused every call (GC-zero contract).
  const scratchPos = new THREE.Vector3();
  const scratchCol = new THREE.Color();

  let currentId = 'breathing_sphere';
  let lastId = 'breathing_sphere';
  let blendT = 0; // 0..1 blend from lastId → currentId

  function setBehavior(id) {
    if (!id || id === currentId) return currentId;
    if (!BEHAVIORS.has(id)) return currentId;
    lastId = currentId;
    currentId = id;
    blendT = 0;
    return id;
  }

  function update(time, ctx) {
    blendT = Math.min(1, blendT + 0.05); // ~20-frame crossfade
    const blendActive = blendT < 1;

    const posArr = positions;
    const colArr = colors;

    // If blending, sample BOTH behaviors and mix. Slightly more cost during
    // ~300ms swap window only.
    for (let i = 0; i < count; i++) {
      safeStep(currentId, i, count, scratchPos, scratchCol, time, ctx);
      let x = scratchPos.x, y = scratchPos.y, z = scratchPos.z;
      let r = scratchCol.r, g = scratchCol.g, b = scratchCol.b;

      if (blendActive && lastId !== currentId) {
        safeStep(lastId, i, count, scratchPos, scratchCol, time, ctx);
        const k = blendT;
        x = scratchPos.x * (1 - k) + x * k;
        y = scratchPos.y * (1 - k) + y * k;
        z = scratchPos.z * (1 - k) + z * k;
        r = scratchCol.r * (1 - k) + r * k;
        g = scratchCol.g * (1 - k) + g * k;
        b = scratchCol.b * (1 - k) + b * k;
      }

      const j = i * 3;
      posArr[j]     = x;
      posArr[j + 1] = y;
      posArr[j + 2] = z;
      colArr[j]     = r;
      colArr[j + 1] = g;
      colArr[j + 2] = b;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  function dispose() {
    scene.remove(points);
    geo.dispose();
    mat.dispose();
  }

  return { points, update, setBehavior, getBehavior: () => currentId, dispose };
}

// ---------------------------------------------------------------------------
// Audio gesture overlay — single-shot click-to-start.
// ---------------------------------------------------------------------------
function createAudioGate(root, audio, bus) {
  const overlay = document.createElement('div');
  overlay.className = 'cosmos-audio-gate';
  overlay.setAttribute('data-cosmos-chrome', '');
  overlay.setAttribute('role', 'button');
  overlay.setAttribute('tabindex', '0');
  // 観測 (kansoku) is the core verb of inryokü. Never "start"/"begin"/"tap".
  overlay.setAttribute('aria-label', '観測を始めるには触れる / Touch or press Enter to begin observing');
  overlay.innerHTML = `
    <div class="cosmos-audio-gate-inner">
      <div class="cosmos-audio-gate-pulse" aria-hidden="true"></div>
      <div class="cosmos-audio-gate-text">触れて、観測を始める</div>
      <div class="cosmos-audio-gate-sub">音と粒子の観測へ</div>
      <div class="cosmos-audio-gate-en" lang="en">touch to begin observing</div>
    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    .cosmos-audio-gate {
      position: fixed; inset: 0; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center,
                  hsla(260,30%,10%,0.55) 0%, hsla(0,0%,2%,0.85) 80%);
      backdrop-filter: blur(4px);
      cursor: pointer;
      animation: cosmosGateIn 600ms ease-out;
    }
    @keyframes cosmosGateIn { from { opacity: 0; } to { opacity: 1; } }
    .cosmos-audio-gate-inner {
      text-align: center; color: hsl(0,0%,92%);
      font-family: ui-sans-serif, -apple-system, "Helvetica Neue",
                   "Hiragino Sans", "Yu Gothic", sans-serif;
      letter-spacing: 0.32em; text-transform: uppercase;
    }
    .cosmos-audio-gate-pulse {
      width: 80px; height: 80px; margin: 0 auto 20px;
      border-radius: 50%;
      border: 1px solid hsla(280,50%,60%,0.6);
      box-shadow: 0 0 32px hsla(280,60%,50%,0.35),
                  inset 0 0 24px hsla(180,60%,50%,0.18);
      animation: cosmosGatePulse 2.4s ease-in-out infinite;
    }
    @keyframes cosmosGatePulse {
      0%,100% { transform: scale(1); opacity: 0.7; }
      50%     { transform: scale(1.12); opacity: 1; }
    }
    .cosmos-audio-gate-text { font-size: 14px; text-transform: none; letter-spacing: 0.18em; }
    .cosmos-audio-gate-sub  {
      font-size: 10px; opacity: 0.55; margin-top: 8px;
      letter-spacing: 0.5em;
    }
    .cosmos-audio-gate-en {
      font-size: 9px; opacity: 0.42; margin-top: 10px;
      letter-spacing: 0.36em; text-transform: lowercase;
    }
    .cosmos-audio-gate.hide { opacity: 0; pointer-events: none;
                              transition: opacity 480ms ease-out; }
  `;
  overlay.appendChild(style);
  root.appendChild(overlay);

  let started = false;
  async function start() {
    if (started) return;
    started = true;
    overlay.classList.add('hide');
    setTimeout(() => overlay.remove(), 520);
    try {
      const ok = await audio.start();
      bus.emit('audio:ready', { started: !!ok });
    } catch (_) {
      bus.emit('audio:ready', { started: false });
    }
  }
  overlay.addEventListener('click', start);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
  });

  return {
    dispose() { try { overlay.remove(); } catch (_) {} }
  };
}

// ---------------------------------------------------------------------------
// Scene switcher pill (DOM).
// ---------------------------------------------------------------------------
function createSceneSwitcher(root, bus, initialId) {
  const ids = Array.from(BEHAVIORS.keys());
  // 場面 (bamen) labels in JP — overrides any meta.label coming up untranslated
  // from behaviors/*. EN aria-label kept for screen-reader localisation.
  const SCENE_JA = {
    idle_static:         '静止',
    breathing_sphere:    '呼吸',
    attractor_hover:     '発見',
    ring_resonance:      '発話',
    convergence_glyph:   '文字',
    light_bridge_accent: '跳躍'
  };
  const SCENE_EN = {
    idle_static:         'idle',
    breathing_sphere:    'breathing',
    attractor_hover:     'discovery',
    ring_resonance:      'speaking',
    convergence_glyph:   'glyph',
    light_bridge_accent: 'leap'
  };
  const pill = document.createElement('div');
  pill.className = 'cosmos-scene-pill';
  pill.setAttribute('data-cosmos-chrome', '');
  pill.setAttribute('role', 'tablist');
  pill.setAttribute('aria-label', '場面の選び / scene selector');
  pill.innerHTML = ids.map((id) => {
    const m = getBehavior(id);
    const ja = SCENE_JA[id] || m?.meta?.label || id;
    const en = SCENE_EN[id] || id;
    const on = id === initialId ? 'on' : '';
    return `<button data-bid="${id}" class="${on}" type="button" aria-label="場面：${ja} / scene: ${en}">${ja}</button>`;
  }).join('');

  const style = document.createElement('style');
  style.textContent = `
    .cosmos-scene-pill {
      position: fixed; bottom: 22px; left: 50%;
      transform: translateX(-50%); z-index: 200;
      display: flex; flex-wrap: wrap; gap: 3px; padding: 5px;
      max-width: calc(100vw - 32px); justify-content: center;
      border: 1px solid hsl(240,8%,18%); border-radius: 22px;
      background: hsla(240,12%,6%,0.78);
      backdrop-filter: blur(12px) saturate(140%);
      font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
    }
    .cosmos-scene-pill button {
      appearance: none; border: 0; background: transparent;
      color: hsl(240,5%,62%); padding: 7px 13px;
      border-radius: 14px; cursor: pointer;
      font: inherit; font-size: 10px; letter-spacing: 0.16em;
      text-transform: uppercase;
      transition: background 220ms ease, color 220ms ease;
    }
    .cosmos-scene-pill button:hover { color: hsl(0,0%,96%); }
    .cosmos-scene-pill button.on {
      background: hsl(240,10%,12%); color: hsl(0,0%,96%);
      box-shadow: inset 0 0 0 1px hsl(240,8%,28%),
                  0 0 16px hsla(265,80%,60%,0.18);
    }
  `;
  pill.appendChild(style);
  root.appendChild(pill);

  pill.addEventListener('click', (e) => {
    const b = e.target?.closest?.('button[data-bid]');
    if (!b) return;
    const id = b.dataset.bid;
    bus.emit('ui:request-behavior', { id, source: 'pill' });
  });

  function setActive(id) {
    pill.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.bid === id);
    });
  }

  return { setActive, dispose() { try { pill.remove(); } catch (_) {} } };
}

// ---------------------------------------------------------------------------
// Canon display strip — small label showing the last canon fired.
// ---------------------------------------------------------------------------
function createCanonDisplay(root, bus) {
  const el = document.createElement('div');
  el.className = 'cosmos-canon-display';
  el.setAttribute('data-cosmos-chrome', '');
  // 円環 (en'kan) — the particle ring language. Never just "canon" in UI.
  el.innerHTML = `<span class="lbl">円環</span><span class="val">—</span>`;
  el.setAttribute('aria-label', '直前に灯った円環 / last canon kindled');
  const style = document.createElement('style');
  style.textContent = `
    .cosmos-canon-display {
      position: fixed; top: 14px; left: 14px; z-index: 200;
      padding: 8px 12px; border-radius: 8px;
      background: hsla(240,12%,6%,0.7);
      border: 1px solid hsl(240,8%,18%);
      backdrop-filter: blur(8px);
      font: 11px/1.4 ui-monospace, Menlo, monospace;
      color: hsl(0,0%,92%); letter-spacing: 0.16em;
      text-transform: uppercase; pointer-events: none;
    }
    .cosmos-canon-display .lbl { opacity: 0.5; margin-right: 8px; }
    .cosmos-canon-display .val { color: hsl(280,70%,80%); }
    .cosmos-canon-display.flash .val { animation: cosmosCanonFlash 480ms ease-out; }
    @keyframes cosmosCanonFlash {
      from { color: hsl(50,90%,72%); text-shadow: 0 0 8px hsl(50,90%,60%); }
      to   { color: hsl(280,70%,80%); text-shadow: none; }
    }
  `;
  el.appendChild(style);
  root.appendChild(el);
  const valEl = el.querySelector('.val');

  const unsub = bus.on('audio:canon', ({ canon }) => {
    valEl.textContent = canon || '—';
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  });

  return { dispose() { unsub(); try { el.remove(); } catch (_) {} } };
}

// ---------------------------------------------------------------------------
// bootInryokuP3 — main entrypoint.
// ---------------------------------------------------------------------------
export function bootInryokuP3(opts = {}) {
  const root = opts.root || document.body;

  // URL flags
  const url = (typeof window !== 'undefined') ? new URL(window.location.href) : null;
  const urlBehavior = opts.urlBehavior ?? (url?.searchParams.get('behavior') || null);
  const urlReduce   = url?.searchParams.get('reduce') === '1';
  const mediaReduce = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const reduceMotion = opts.reduceMotion ?? (urlReduce || mediaReduce);

  // Tier heuristic
  const tier = opts.tier ||
    (/iPhone|iPad|Android/.test(navigator.userAgent) && innerWidth < 900 ? 'low' : 'auto');

  // 1. bus + observation + a11y (a11y first so audio can use its announce)
  const bus = createBus();
  const observation = createObservation();
  const a11y = applyA11y({ root });

  // 2. Three.js renderer / scene / camera
  const canvas = document.createElement('canvas');
  canvas.className = 'cosmos-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;display:block;width:100%;height:100%;';
  root.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030305, 0.010);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);
  camera.position.set(0, 0, 72);

  // 3. effects layer
  const effects = createEffectsLayer(renderer, scene, camera, { tier, reduceMotion });

  // 4. behavior particle cloud (SAME scene → additive stacks with effects)
  const particles = createBehaviorParticles(scene, { count: opts.count || 38000 });

  // 5. post-fx
  const post = createPostFX(renderer, scene, camera, { reduceMotion });

  // 6. audio (silent until user gesture via gate). Pass a11y.announce so mic
  // permission prompts and mute toggles reach screen readers.
  const audio = createAudio({
    forceSilent: reduceMotion,
    announce: (msg, pri) => { try { a11y.announce(msg, pri); } catch (_) {} }
  });

  // 7. HUD
  const hud = createPercentageHud({ parent: root, observation });

  // 8. scene switcher pill
  const initialBehaviorId = resolveBehavior({
    state: 'idle',
    reduceMotion,
    urlBehavior
  });
  particles.setBehavior(initialBehaviorId);
  effects.setActiveScene(behaviorMeta(initialBehaviorId).scene);
  const pill = createSceneSwitcher(root, bus, initialBehaviorId);
  const canonDisplay = createCanonDisplay(root, bus);

  // 9. interactions (mouse/keys/scroll)
  const interactions = wireInteractions({
    scope: document.documentElement,
    audio,
    observation
  });

  // 10. audio gesture gate
  const gate = createAudioGate(root, audio, bus);

  // 11. shared ctx (used by effects nebula + behavior steps)
  //   ctx.reduceMotion — single source of truth, mirrored from a11y so live
  //   media-query changes propagate without a reboot. behaviors honor this
  //   to clamp their internal time parameter (WCAG 2.3.3).
  const ctx = {
    mouseNDC: new THREE.Vector2(),
    mx: 0, my: 0,
    textPts: null,
    bridge: null,
    reduceMotion: !!reduceMotion
  };
  const offReduceMotion = a11y.onReduceMotionChange((v) => {
    ctx.reduceMotion = !!v;
    bus.emit('scene:reduce-motion', { reduce: !!v });
  });

  // --- BUS WIRING ----------------------------------------------------------
  // ui pill click → behavior change request
  bus.on('ui:request-behavior', ({ id, source }) => {
    setBehavior(id, source);
  });

  // observation pulse → HUD already auto-updates via its own onPulse sub.
  // We also: audio pulse (soft shimmer) + occasional burst.
  observation.onPulse((p) => {
    bus.emit('observation:pulse', p);
    if (audio.isStarted()) audio.pulse(0.4);
    // Every 8th pulse fire a small burst — gives rhythm without being noisy.
    // Read reduceMotion live from ctx (a11y media-query may flip at runtime).
    if (p.total % 8 === 0 && !ctx.reduceMotion) {
      const m = behaviorMeta(particles.getBehavior());
      if (effects.fireBurst(m.burst)) {
        // fireBurst now returns false when the 333ms debounce swallows the
        // call; only emit when an actual burst was rendered.
        bus.emit('effects:burst', { color: m.burst });
      }
    }
  });

  // behavior:change → effects scene + burst + audio canon + pill highlight
  bus.on('behavior:change', ({ id, meta }) => {
    pill.setActive(id);
    effects.setActiveScene(meta.scene);
    if (!ctx.reduceMotion) effects.fireBurst(meta.burst);
    bus.emit('effects:burst', { color: meta.burst });
    if (audio.isStarted()) {
      audio.play(meta.canon);
      bus.emit('audio:canon', { canon: meta.canon, source: 'behavior' });
    }
    observation.pulse('behavior:' + id);

    // body class hooks for cosmos-effects.css
    document.body.classList.remove('cfx-scene-glyph', 'cfx-scene-speaking');
    if (meta.scene === 'glyph') document.body.classList.add('cfx-scene-glyph');
    if (meta.scene === 'ring')  document.body.classList.add('cfx-scene-speaking');

    // a11y plumbing: emit scene:behavior-change for any listener (HUD,
    // captions, telemetry) and announce the new behavior label politely.
    bus.emit('scene:behavior-change', {
      id,
      scene: meta.scene,
      canon: meta.canon,
      register: getBehavior(id)?.meta?.tags?.[0] || 'idle'
    });
    try {
      const label = getBehavior(id)?.meta?.label || id;
      a11y.announce('scene: ' + label, 'polite');
    } catch (_) {}
  });

  bus.emit('scene:reduce-motion', { reduce: !!reduceMotion });

  // --- SET BEHAVIOR API ---------------------------------------------------
  function setBehavior(id, source = 'api') {
    if (!BEHAVIORS.has(id)) return particles.getBehavior();
    const prev = particles.getBehavior();
    if (prev === id) return id;
    particles.setBehavior(id);
    const meta = behaviorMeta(id);
    bus.emit('behavior:change', { id, prev, meta, source });
    return id;
  }

  function setScene(state) {
    const id = resolveBehavior({ state, reduceMotion, urlBehavior });
    return setBehavior(id, 'scene:' + state);
  }

  // CONTACT — clicking hands off to convergence_glyph (文字) and lights the
  // 宣言 (sengen) ring. The button itself stays as "CONTACT" so visitors who
  // arrive looking for it find it; the meaning is in the handoff.
  document.querySelectorAll('[data-contact-cta]').forEach((el) => {
    if (!el.hasAttribute('aria-label')) {
      el.setAttribute('aria-label', '問いを届ける — 円環粒子で受け取ります / send a question, received as a particle ring');
    }
    el.addEventListener('click', () => {
      setBehavior('convergence_glyph', 'contact');
      bus.emit('audio:canon', { canon: 'declaration', source: 'contact' });
    });
  });

  // --- INPUT: mouse ctx, hover hot-zones, sparse observation pulse --------
  let lastMoveT = 0;
  function onMove(e) {
    ctx.mouseNDC.set(
      (e.clientX / innerWidth - 0.5) * 0.5,
      -(e.clientY / innerHeight - 0.5) * 0.5
    );
    ctx.mx = (e.clientX / innerWidth - 0.5) * 30;
    ctx.my = -(e.clientY / innerHeight - 0.5) * 20;
    // Sparse observation pulse on hover (1 per second max)
    const now = performance.now();
    if (now - lastMoveT > 1000) {
      lastMoveT = now;
      observation.pulse('hover');
    }
  }
  window.addEventListener('mousemove', onMove, { passive: true });

  // --- RESIZE -------------------------------------------------------------
  function onResize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(w, h);
    // nebula aspect is also updated inside effects.update each frame.
    bus.emit('scene:resize', { w, h });
  }
  window.addEventListener('resize', onResize, { passive: true });

  // --- 12s idle auto-cycle (skipped in reduce-motion) ---------------------
  const cycleIds = [
    'breathing_sphere', 'attractor_hover', 'ring_resonance',
    'convergence_glyph', 'light_bridge_accent'
  ];
  let cycleIdx = 0;
  let lastInteract = performance.now();
  ['mousemove', 'click', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, () => { lastInteract = performance.now(); },
                            { passive: true })
  );
  let cycleTimer = null;
  if (!reduceMotion) {
    cycleTimer = setInterval(() => {
      if (performance.now() - lastInteract > 12000) {
        cycleIdx = (cycleIdx + 1) % cycleIds.length;
        setBehavior(cycleIds[cycleIdx], 'autocycle');
      }
    }, 6000);
  }

  // --- MAIN LOOP ----------------------------------------------------------
  const clock = new THREE.Clock();
  let rafId = 0;
  let disposed = false;

  function tick() {
    if (disposed) return;
    const t = clock.getElapsedTime();

    // Per-frame order:
    //  1) effects.update (nebula uniforms, stars, constellations, bridges,
    //                     shooters, logo, rings, burst)
    //  2) behavior particle update
    //  3) camera orbit
    //  4) composer render
    effects.update(t, ctx);
    particles.update(t, ctx);

    camera.position.x = Math.sin(t * 0.06) * 9;
    camera.position.y = Math.cos(t * 0.04) * 5;
    camera.position.z = 72 + Math.sin(t * 0.03) * 3;
    camera.lookAt(0, 0, 0);

    post.render();
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  // --- DISPOSE -----------------------------------------------------------
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (cycleTimer) clearInterval(cycleTimer);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('resize', onResize);
    try { interactions.dispose(); } catch (_) {}
    try { gate.dispose(); } catch (_) {}
    try { hud.dispose(); } catch (_) {}
    try { pill.dispose(); } catch (_) {}
    try { canonDisplay.dispose(); } catch (_) {}
    try { particles.dispose(); } catch (_) {}
    try { effects.dispose(); } catch (_) {}
    try { post.dispose(); } catch (_) {}
    try { audio.dispose(); } catch (_) {}
    try { renderer.dispose(); } catch (_) {}
    try { canvas.remove(); } catch (_) {}
    try { offReduceMotion?.(); } catch (_) {}
    try { a11y.dispose(); } catch (_) {}
    bus.clear();
  }

  return {
    dispose,
    bus,
    audio,
    observation,
    effects,
    post,
    particles,
    setBehavior,
    setScene,
    getState: () => ({
      behavior: particles.getBehavior(),
      reduceMotion,
      tier,
      pct: observation.getPct()
    })
  };
}

export default bootInryokuP3;
