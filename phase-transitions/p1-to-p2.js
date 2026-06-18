/**
 * p1-to-p2.js — Win95 boot → quantum code world + yin-yang.
 *
 * Spec §4.2. Duration 900ms.
 *
 * What happens:
 *   1) Whiteout flash (assumed already triggered by P1 EVENT_COLLAPSE — we render
 *      a 200ms alpha bloom on overlay if no caller-provided canvas).
 *   2) Sample 64 (or 32 on tablet) particles from P1's pre-roll cloud at their
 *      final post-collapse positions, snapshot hue. Caller passes them in
 *      fromState.particles — if missing, we synthesise a small grid.
 *   3) Particles scatter outward (code-rain feel) for the middle 500ms.
 *   4) Re-converge toward a yin-yang manifold radius for the last 300ms —
 *      this is the visual hand-off into P2's manifold density.
 *   5) Write __inryokuHandoff with mid-flight positions + P2 cameraHint.
 *
 * fromState: {
 *   particles: [{ x, y, hue }],   sampled P1 cloud points (screen-space)
 *   canvas:    overlay canvas (optional; created if missing)
 * }
 * toState: { particleCount: 64, reduce, manifoldRadius: 220 }
 */

import { easeInOutCubic, lerpRGB, rgbaCSS, rafAnim } from '../phase-bus.js';

const DEFAULT_DURATION = 900;
const P2_NATIVE_GREEN = [0.27, 0.93, 0.48];   // P2 quantum-code green target

export function createTransition(opts = {}) {
  const debug = !!opts.debug;
  const duration = opts.duration || DEFAULT_DURATION;
  let anim = null;
  let cancelled = false;

  function run(fromState, toState) {
    if (cancelled) return Promise.resolve();
    fromState = fromState || {};
    toState = toState || {};

    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = W / 2, cy = H / 2;
    const N = toState.particleCount || (isTabletLike() ? 32 : 64);
    const reduce = toState.reduce || prefersReducedMotion();
    const manifoldR = toState.manifoldRadius || Math.min(W, H) * 0.28;

    // Source particles — sample from caller, or synthesise
    let src = fromState.particles && fromState.particles.length
      ? fromState.particles.slice(0, N)
      : null;
    if (!src) {
      src = [];
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2 + Math.random() * 0.3;
        const r = 60 + Math.random() * 120;
        src.push({
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * r,
          hue: [0.92, 0.92, 0.96],  // P1 BIOS dot pale
        });
      }
    }

    // Build particle state — each has origin, scatter target, manifold target
    const particles = src.map((p, i) => {
      const scatterAng = Math.random() * Math.PI * 2;
      const scatterR = manifoldR * (1.8 + Math.random() * 0.6);
      const manifoldAng = (i / N) * Math.PI * 2 + Math.random() * 0.05;
      // yin-yang split: half on top semicircle, half on bottom; alternating hue
      const isYin = i % 2 === 0;
      return {
        ox: p.x, oy: p.y,
        sx: cx + Math.cos(scatterAng) * scatterR,
        sy: cy + Math.sin(scatterAng) * scatterR,
        mx: cx + Math.cos(manifoldAng) * manifoldR,
        my: cy + Math.sin(manifoldAng) * manifoldR,
        x: p.x, y: p.y,
        hueIn: p.hue || [1, 1, 1],
        hueOut: isYin ? [0.02, 0.02, 0.05] : [0.95, 0.97, 1.0],
        size: 1.4 + Math.random() * 1.2,
        isYin,
      };
    });

    const canvas = fromState.canvas || createOverlayCanvas();
    const ctx = canvas.getContext('2d');
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);

    if (reduce) {
      publishHandoff(particles, N);
      return new Promise((r) => setTimeout(() => { try { canvas.remove(); } catch(_){} r(); }, 200));
    }

    anim = rafAnim(duration, (t) => {
      ctx.clearRect(0, 0, W, H);

      // whiteout bloom for first 200ms
      if (t < 0.22) {
        const a = 1 - (t / 0.22);
        ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.9) + ')';
        ctx.fillRect(0, 0, W, H);
      }

      // Two-phase motion: scatter (0..0.55) then converge (0.55..1)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let x, y, col;
        if (t < 0.55) {
          const u = easeInOutCubic(t / 0.55);
          x = p.ox + (p.sx - p.ox) * u;
          y = p.oy + (p.sy - p.oy) * u;
          col = lerpRGB(p.hueIn, P2_NATIVE_GREEN, u * 0.6);
          // brief vertical code-rain streak
          ctx.fillStyle = rgbaCSS(col, 0.4);
          ctx.fillRect(x - 0.5, y - 6 * u, 1, 6 * u);
        } else {
          const u = easeInOutCubic((t - 0.55) / 0.45);
          x = p.sx + (p.mx - p.sx) * u;
          y = p.sy + (p.my - p.sy) * u;
          col = lerpRGB(P2_NATIVE_GREEN, p.hueOut, u);
        }
        p.x = x; p.y = y;
        ctx.fillStyle = rgbaCSS(col, 0.9);
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    return anim.promise.then(() => {
      publishHandoff(particles, N);
      setTimeout(() => {
        canvas.style.transition = 'opacity 220ms linear';
        canvas.style.opacity = '0';
        setTimeout(() => { try { canvas.remove(); } catch(_){} }, 240);
      }, 100);
      if (debug) console.log('[p1-to-p2] handoff N=' + N);
    });
  }

  function cancel() { cancelled = true; if (anim) anim.cancel(); }

  return { run, cancel };
}

function publishHandoff(particles, N) {
  // map screen → world: (sx - W/2) * 0.02 per spec §4.2
  const W = window.innerWidth, H = window.innerHeight;
  const snap = particles.slice(0, N).map((p) => ({
    x: (p.x - W / 2) * 0.02,
    y: (p.y - H / 2) * 0.02,
    z: 0,
    hue: p.isYin ? [0.02, 0.02, 0.05] : [0.95, 0.97, 1.0],
    size: p.size,
  }));
  window.__inryokuHandoff = {
    fromPhase: 'P1',
    toPhase: 'P2',
    particles: snap,
    bornAt: performance.now(),
    cameraHint: { z: 8, fov: 60 },
    audioState: { lastTone: 1000 },
  };
  try { window.dispatchEvent(new CustomEvent('inryoku:p1complete')); } catch (_) {}
}

function createOverlayCanvas() {
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:99997;background:transparent';
  document.body.appendChild(c);
  return c;
}

function isTabletLike() {
  return window.innerWidth < 1024 && 'ontouchstart' in window;
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default createTransition;
