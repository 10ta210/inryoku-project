// logo-speech-renderer.js
// Three.js renderer for a single utterance.
// Self-contained — does NOT edit cosmos-effects.js. Multiple concurrent
// utterances stack on different ring radii by register.
//
// Glyph is 2D (12-tick clock). Renderer projects it onto a ring plane that
// faces the camera-up axis (XY plane around the sphere position). Points
// fade in (per-tick stagger), strings draw from→to, hold for register
// decay, then fade out together.
//
// Reduced motion: spawns the full composition instantly at full opacity
// and dissolves after a short floor hold.
//
// Usage:
//   const renderer = createSpeechRenderer({
//     scene, getSpherePosition: () => v3, getSphereRadius: () => 1,
//     reducedMotion: false
//   });
//   const handle = renderer.play(glyph, register, { onComplete, decay });
//   renderer.update(dt);    // call each frame
//   renderer.dispose();

import * as THREE from 'three';
import { COLOR_HEX, tickUnitPos, colorHex } from './logo-glyph.js';

const FADE_IN_MS = 280;
const STAGGER_MS = 60;
const STRING_DRAW_MS = 420;
const FADE_OUT_MS = 520;
const REDUCED_HOLD_MIN = 200;

// Stack radius multiplier per register (cumulative on sphereRadius).
const STACK_BY_REGISTER = {
  whisper: 1.6,
  hover: 1.9,
  click: 2.3,
  summon: 2.9,
  revelation: 3.6
};

const DEFAULT_FALLBACK_COLOR = '#dadada'; // used when tick color is null

function nowMs() { return performance.now ? performance.now() : Date.now(); }

function makeColor(code, fallback) {
  return new THREE.Color(colorHex(code, fallback || DEFAULT_FALLBACK_COLOR));
}

export function createSpeechRenderer(opts = {}) {
  const scene = opts.scene;
  if (!scene) throw new Error('[logo-speech-renderer] scene is required');
  const getSpherePosition = typeof opts.getSpherePosition === 'function'
    ? opts.getSpherePosition
    : () => new THREE.Vector3(0, 0, 0);
  const getSphereRadius = typeof opts.getSphereRadius === 'function'
    ? opts.getSphereRadius
    : () => 1;
  const reducedMotionFn = typeof opts.reducedMotion === 'function'
    ? opts.reducedMotion
    : () => !!opts.reducedMotion;

  const utterances = new Set();   // active utterance state

  // ── per-utterance scaffolding ─────────────────────────────
  function buildUtterance(glyph, register, options) {
    const reduced = options.reducedMotion === true
      || options.reducedMotion == null && reducedMotionFn();
    const stackMul = STACK_BY_REGISTER[register] || STACK_BY_REGISTER.whisper;
    const sphereR = Math.max(0.1, getSphereRadius() || 1);
    const ringR = sphereR * stackMul;

    const root = new THREE.Group();
    const center = getSpherePosition();
    root.position.copy(center);
    // Always face camera if camera up is +Y. We render on XY plane (Z faces viewer).
    root.rotation.x = 0;
    scene.add(root);

    // ── tick points (small spheres) ─────────────────────────
    const tickMeshes = [];
    glyph.ticks.forEach((tk, idx) => {
      const pos = tickUnitPos(tk.tick);
      const x = pos.x * ringR;
      const y = -pos.y * ringR; // invert y so tick 0 is up in world Y
      const color = makeColor(tk.color);
      const geo = new THREE.SphereGeometry(sphereR * 0.07, 14, 10);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, 0);
      root.add(m);
      tickMeshes.push({ mesh: m, mat, geo, color, idx, tick: tk.tick });
    });

    // ── strings (Line2-ish — we use simple Line for portability) ──
    const stringObjs = [];
    glyph.strings.forEach((s, idx) => {
      const a = tickUnitPos(s.from);
      const b = tickUnitPos(s.to);
      const ax = a.x * ringR, ay = -a.y * ringR;
      const bx = b.x * ringR, by = -b.y * ringR;
      const color = makeColor(s.color);
      const pts = [];
      if (s.arc) {
        // Quadratic Bezier inward to a control point near the origin.
        const ctrlScale = 0.18 * ringR;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const len = Math.sqrt(mx * mx + my * my) || 1;
        const cx = mx - (mx / len) * ctrlScale;
        const cy = my - (my / len) * ctrlScale;
        const segs = 40;
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const ux = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
          const uy = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
          pts.push(new THREE.Vector3(ux, uy, 0));
        }
      } else {
        const segs = 24;
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          pts.push(new THREE.Vector3(ax + (bx - ax) * t, ay + (by - ay) * t, 0));
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      // Draw range is animated for the "drawing" effect.
      geo.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const line = new THREE.Line(geo, mat);
      root.add(line);
      stringObjs.push({ line, mat, geo, totalPoints: pts.length, idx });
    });

    // ── double ring outline (quotation only) ────────────────
    let doubleRingMesh = null;
    if (glyph.doubleRing) {
      const segs = 96;
      const innerR = ringR * 0.78;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const ang = (i / segs) * Math.PI * 2 - Math.PI / 2;
        pts.push(new THREE.Vector3(Math.cos(ang) * innerR, -Math.sin(ang) * innerR, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(COLOR_HEX.C),
        transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      doubleRingMesh = new THREE.LineLoop(geo, mat);
      root.add(doubleRingMesh);
    }

    const decay = typeof options.decay === 'number'
      ? options.decay
      : 1600;

    const state = {
      root,
      glyph,
      register,
      tickMeshes,
      stringObjs,
      doubleRingMesh,
      startedAt: nowMs(),
      reduced,
      decay,
      fadeOutStart: 0,
      phase: 'in',
      ringR,
      onComplete: typeof options.onComplete === 'function' ? options.onComplete : null,
      _disposed: false
    };
    state.fadeOutStart = state.startedAt + Math.max(
      reduced ? REDUCED_HOLD_MIN : (FADE_IN_MS + glyph.ticks.length * STAGGER_MS + STRING_DRAW_MS),
      decay
    );

    return state;
  }

  function updateUtterance(u, t) {
    if (u._disposed) return false;
    const elapsed = t - u.startedAt;

    // ── reduced motion: snap visible, then linear fade after fadeOutStart ──
    if (u.reduced) {
      const visibleOpacity = 0.9;
      u.tickMeshes.forEach((tm) => { tm.mat.opacity = visibleOpacity; });
      u.stringObjs.forEach((so) => {
        so.geo.setDrawRange(0, so.totalPoints);
        so.mat.opacity = visibleOpacity * 0.85;
      });
      if (u.doubleRingMesh) u.doubleRingMesh.material.opacity = visibleOpacity * 0.7;
    } else {
      // tick fade-in with stagger
      u.tickMeshes.forEach((tm) => {
        const delay = tm.idx * STAGGER_MS;
        const local = elapsed - delay;
        if (local <= 0) { tm.mat.opacity = 0; return; }
        const op = Math.min(1, local / FADE_IN_MS);
        tm.mat.opacity = 0.95 * op;
        // gentle scale-in
        const s = 0.6 + 0.4 * op;
        tm.mesh.scale.setScalar(s);
      });
      // string draw
      u.stringObjs.forEach((so) => {
        const stringStart = FADE_IN_MS * 0.6 + so.idx * STAGGER_MS;
        const local = elapsed - stringStart;
        if (local <= 0) { so.geo.setDrawRange(0, 0); so.mat.opacity = 0; return; }
        const ratio = Math.min(1, local / STRING_DRAW_MS);
        so.geo.setDrawRange(0, Math.max(1, Math.floor(so.totalPoints * ratio)));
        so.mat.opacity = 0.85 * ratio;
      });
      if (u.doubleRingMesh) {
        const drStart = FADE_IN_MS * 0.4;
        const local = elapsed - drStart;
        const op = local <= 0 ? 0 : Math.min(1, local / (FADE_IN_MS * 1.4));
        u.doubleRingMesh.material.opacity = 0.55 * op;
      }
    }

    // ── follow sphere position if it moves ──
    const c = getSpherePosition();
    if (c && u.root) u.root.position.copy(c);

    // ── fade-out phase ──
    if (t >= u.fadeOutStart) {
      if (u.phase !== 'out') u.phase = 'out';
      const local = t - u.fadeOutStart;
      const fadeMs = u.reduced ? Math.max(160, FADE_OUT_MS * 0.5) : FADE_OUT_MS;
      const k = 1 - Math.min(1, local / fadeMs);
      u.tickMeshes.forEach((tm) => { tm.mat.opacity *= k; });
      u.stringObjs.forEach((so) => { so.mat.opacity *= k; });
      if (u.doubleRingMesh) u.doubleRingMesh.material.opacity *= k;
      if (local >= fadeMs) {
        disposeUtterance(u, 'natural');
        return false;
      }
    }
    return true;
  }

  function disposeUtterance(u, reason) {
    if (u._disposed) return;
    u._disposed = true;
    try {
      u.tickMeshes.forEach((tm) => { tm.geo.dispose(); tm.mat.dispose(); });
      u.stringObjs.forEach((so) => { so.geo.dispose(); so.mat.dispose(); });
      if (u.doubleRingMesh) {
        u.doubleRingMesh.geometry.dispose();
        u.doubleRingMesh.material.dispose();
      }
      if (u.root && u.root.parent) u.root.parent.remove(u.root);
    } catch (_) {}
    utterances.delete(u);
    if (u.onComplete) {
      try { u.onComplete(reason || 'natural'); } catch (_) {}
    }
  }

  function play(glyph, register, options = {}) {
    const u = buildUtterance(glyph, register, options);
    utterances.add(u);
    return {
      stop(reason) { disposeUtterance(u, reason || 'stop'); },
      isActive() { return !u._disposed; }
    };
  }

  function update(dt) {
    const t = nowMs();
    for (const u of Array.from(utterances)) {
      try { updateUtterance(u, t); } catch (e) { disposeUtterance(u, 'error'); }
    }
  }

  function dispose() {
    for (const u of Array.from(utterances)) disposeUtterance(u, 'dispose');
    utterances.clear();
  }

  return { play, update, dispose, _active: () => utterances.size };
}

export default createSpeechRenderer;
