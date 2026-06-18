/**
 * p0-to-p1.js — Mac dialog → Win95 loading.
 *
 * Spec §4.1. Duration ~600ms (P0 exit) + bus handoff for P1 pre-roll.
 *
 * What happens visually:
 *   1) The Mac dialog window scales down to a single bright pixel at viewport
 *      centre over 300ms (handled by the P0 exit DOM — we just snapshot positions).
 *   2) The pixel emits a radial burst of 256 grey particles in random directions
 *      at low velocity over ~300ms — we render these on our overlay canvas.
 *   3) Write __inryokuHandoff bus with those 256 final positions + grey hue.
 *      P1's boot pre-roll reads it and seeds its initial cloud's centre cluster
 *      from those positions — particles are *carried*, not re-spawned.
 *
 * fromState (optional): {
 *   centerX, centerY,            screen-space focal point (defaults to viewport centre)
 *   dialogRect: { x, y, w, h },  the dialog's last rect (informs particle origin spread)
 *   canvas:    HTMLCanvasElement  overlay canvas; created if missing
 * }
 * toState (optional): {
 *   particleCount: 256,
 *   reduce: false,
 * }
 */

import { easeInOutCubic, lerpRGB, rgbaCSS, rafAnim } from '../phase-bus.js';

const DEFAULT_DURATION = 600;

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
    const cx = (fromState.centerX != null) ? fromState.centerX : W / 2;
    const cy = (fromState.centerY != null) ? fromState.centerY : H / 2;
    const N = toState.particleCount || (isTabletLike() ? 128 : 256);
    const reduce = toState.reduce || prefersReducedMotion();

    // Provision an overlay canvas to render the burst
    const canvas = fromState.canvas || createOverlayCanvas();
    const ctx = canvas.getContext('2d');
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Build the radial burst particles
    const particles = new Array(N);
    for (let i = 0; i < N; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;    // px/sec
      const grey = 0.45 + Math.random() * 0.35;
      particles[i] = {
        x: cx, y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        hue: [grey, grey, grey],
        size: 1 + Math.random() * 1.5,
        alpha: 0.85,
      };
    }

    if (reduce) {
      // Reduce-motion: skip animation, still publish handoff so P1 seeds cluster
      publishHandoff(particles);
      return new Promise((resolve) => setTimeout(() => {
        try { canvas.remove(); } catch (_) {}
        resolve();
      }, 200));
    }

    // Animate the burst — particles fly outward, decelerate, fade in colour
    anim = rafAnim(duration, (t, elapsed) => {
      const dt = elapsed / 1000;
      ctx.clearRect(0, 0, W, H);
      // central pixel — bright until burst phase
      const burstFrac = Math.min(1, elapsed / 300);
      if (burstFrac < 1) {
        const r = 3 + (1 - burstFrac) * 4;
        ctx.fillStyle = 'rgba(255,255,255,' + (1 - burstFrac * 0.6) + ')';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // particles
      for (let i = 0; i < N; i++) {
        const p = particles[i];
        // ease-out velocity decay
        const k = 1 - 0.85 * easeInOutCubic(t);
        const x = cx + p.vx * dt * k;
        const y = cy + p.vy * dt * k;
        p.x = x;
        p.y = y;
        // fade colour from white → grey
        const col = lerpRGB([1, 1, 1], p.hue, easeInOutCubic(t));
        ctx.fillStyle = rgbaCSS(col, p.alpha * (1 - t * 0.2));
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    return anim.promise.then(() => {
      publishHandoff(particles);
      // leave the canvas in place for ~120ms so P1 boot can fade in atop it,
      // then remove. The 256 carriers now live in the handoff bus.
      setTimeout(() => {
        try { canvas.style.transition = 'opacity 200ms linear'; canvas.style.opacity = '0'; } catch(_) {}
        setTimeout(() => { try { canvas.remove(); } catch(_) {} }, 220);
      }, 120);
      if (debug) console.log('[p0-to-p1] handoff written, N=' + N);
    });
  }

  function cancel() {
    cancelled = true;
    if (anim) anim.cancel();
  }

  return { run, cancel };
}

function publishHandoff(particles) {
  const snap = particles.map((p) => ({ x: p.x, y: p.y, hue: p.hue, size: p.size }));
  window.__inryokuHandoff = {
    fromPhase: 'P0',
    toPhase: 'P1',
    particles: snap,
    bornAt: performance.now(),
    audioState: { lastTone: null },
  };
  // also fire the existing legacy completion event
  try { window.dispatchEvent(new CustomEvent('inryoku:p0complete')); } catch (_) {}
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
  // spec §9 — tablet uses reduced particle counts
  return window.innerWidth < 1024 && 'ontouchstart' in window;
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default createTransition;
