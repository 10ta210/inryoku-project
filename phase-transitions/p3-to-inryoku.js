/**
 * p3-to-inryoku.js — P3 → inRYOKU 裏ルート (spiritual sub-route).
 *
 * The unlock path. When the 6 RGBCMY pulses of P3 fully merge (all 6 colours
 * observed in revelation canon), the universe particles fold inward, a portal
 * opens at the centre, and we route to the inRYOKU page.
 *
 * This is the only transition that ROUTES (changes location). All others stay
 * on the same DOM and crossfade canvases.
 *
 * Spec §4.4 (reserved future). Duration ~1800ms — the longest, most ceremonial.
 *
 * fromState: {
 *   universeParticles: [{ x, y, z, hue }]  sampled subset of 38000 universe
 *   sixColorState:     { r, g, b, c, m, y } each 0..1 — must all be > 0.95
 *   portalCenter:      { x, y } screen
 *   canvas:            overlay
 * }
 * toState: {
 *   route: '/inryoku',
 *   navigate: (url) => void   navigation hook; defaults to location.assign
 * }
 */

import { easeInOutCubic, lerpRGB, rgbaCSS, rafAnim } from '../phase-bus.js';

const DEFAULT_DURATION = 1800;
const UNLOCK_THRESHOLD = 0.95;

export function createTransition(opts = {}) {
  const debug = !!opts.debug;
  const duration = opts.duration || DEFAULT_DURATION;
  let anim = null;
  let cancelled = false;

  /** Verify all 6 colours have been observed past threshold. */
  function unlocked(state) {
    if (!state) return false;
    const keys = ['r', 'g', 'b', 'c', 'm', 'y'];
    for (const k of keys) if ((state[k] || 0) < UNLOCK_THRESHOLD) return false;
    return true;
  }

  function run(fromState, toState) {
    if (cancelled) return Promise.resolve();
    fromState = fromState || {};
    toState = toState || {};

    if (!opts.skipUnlockCheck && !unlocked(fromState.sixColorState)) {
      // Quietly refuse — the route is gated by the 6-colour merge
      if (debug) console.log('[p3-to-inryoku] unlock condition not met');
      return Promise.reject(new Error('inRYOKU unlock condition not met'));
    }

    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = (fromState.portalCenter && fromState.portalCenter.x) || W / 2;
    const cy = (fromState.portalCenter && fromState.portalCenter.y) || H / 2;
    const reduce = toState.reduce || prefersReducedMotion();
    const navigate = toState.navigate || ((u) => { location.assign(u); });
    const route = toState.route || '/inryoku';

    const src = (fromState.universeParticles && fromState.universeParticles.length)
      ? fromState.universeParticles
      : synthUniverse(cx, cy, 480);

    // Each particle has an inward spiral trajectory toward portalCenter
    const particles = src.slice(0, 720).map((p, i) => {
      const sx = (p.x != null) ? p.x : cx + (Math.random() - 0.5) * W;
      const sy = (p.y != null) ? p.y : cy + (Math.random() - 0.5) * H;
      const r0 = Math.hypot(sx - cx, sy - cy);
      const a0 = Math.atan2(sy - cy, sx - cx);
      return {
        sx, sy,
        r0, a0,
        spin: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.8),
        hueIn: p.hue || P3_PULSE_HUES[i % 6],
        size: 1 + Math.random() * 1.8,
        x: sx, y: sy,
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
      // instant cut + 200ms fade then navigate
      canvas.style.transition = 'opacity 200ms linear';
      canvas.style.background = '#000';
      canvas.style.opacity = '1';
      return new Promise((resolve) => {
        setTimeout(() => {
          publishHandoff(particles);
          navigate(route);
          resolve();
        }, 220);
      });
    }

    anim = rafAnim(duration, (t) => {
      ctx.clearRect(0, 0, W, H);

      // Phase A (0..0.55): spiral inward, fold particles toward portal
      // Phase B (0.55..0.85): portal expands as bright disc
      // Phase C (0.85..1):   whiteout pulse → portal open

      // background fold — gradient darkens around portal
      const bgA = easeInOutCubic(Math.min(1, t / 0.55));
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) / 2);
      grad.addColorStop(0, 'rgba(20,10,30,' + (bgA * 0.4) + ')');
      grad.addColorStop(1, 'rgba(0,0,0,' + (bgA * 0.95) + ')');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // particles spiral inward
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const u = easeInOutCubic(Math.min(1, t / 0.7));
        const r = p.r0 * (1 - u);
        const a = p.a0 + p.spin * u * Math.PI * 1.2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        p.x = x; p.y = y;
        // hue eases toward perceptual-white (but not pure white per canon)
        const col = lerpRGB(p.hueIn, [0.93, 0.94, 0.98], u * 0.85);
        ctx.fillStyle = rgbaCSS(col, 0.9 * (1 - u * 0.3));
        ctx.beginPath();
        ctx.arc(x, y, p.size * (1 - u * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      // portal core
      if (t > 0.45) {
        const u = easeInOutCubic((t - 0.45) / 0.55);
        const portalR = 4 + u * Math.min(W, H) * 0.7;
        const portalGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, portalR);
        portalGrad.addColorStop(0, 'rgba(255,250,240,' + (u * 0.96) + ')');
        portalGrad.addColorStop(0.4, 'rgba(220,210,255,' + (u * 0.6) + ')');
        portalGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = portalGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, portalR, 0, Math.PI * 2);
        ctx.fill();
      }

      // whiteout pulse near end
      if (t > 0.85) {
        const u = (t - 0.85) / 0.15;
        ctx.fillStyle = 'rgba(252,252,250,' + (u * 0.85) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    });

    return anim.promise.then(() => {
      publishHandoff(particles);
      // hold the whiteout briefly, then route
      setTimeout(() => {
        try { navigate(route); } catch (e) { console.error('[p3-to-inryoku] nav', e); }
        setTimeout(() => { try { canvas.remove(); } catch(_){} }, 600);
      }, 80);
      if (debug) console.log('[p3-to-inryoku] portal opened → ' + route);
    });
  }

  function cancel() { cancelled = true; if (anim) anim.cancel(); }

  return { run, cancel, unlocked };
}

const P3_PULSE_HUES = [
  [1.0, 0.30, 0.30],
  [0.30, 1.0, 0.40],
  [0.30, 0.45, 1.0],
  [0.30, 0.95, 0.95],
  [0.95, 0.30, 0.95],
  [0.95, 0.95, 0.30],
];

function synthUniverse(cx, cy, N) {
  const W = window.innerWidth, H = window.innerHeight;
  const out = [];
  for (let i = 0; i < N; i++) {
    out.push({
      x: cx + (Math.random() - 0.5) * W * 0.9,
      y: cy + (Math.random() - 0.5) * H * 0.9,
      hue: P3_PULSE_HUES[i % 6],
    });
  }
  return out;
}

function publishHandoff(particles) {
  const W = window.innerWidth, H = window.innerHeight;
  const snap = particles.slice(0, 64).map((p) => ({
    x: (p.x - W / 2) * 0.02,
    y: (p.y - H / 2) * 0.02,
    z: 0,
    hue: [0.93, 0.94, 0.98],
    size: p.size,
  }));
  window.__inryokuHandoff = {
    fromPhase: 'P3',
    toPhase: 'inRYOKU',
    particles: snap,
    bornAt: performance.now(),
    audioState: { fadeOut: ['ambient', 'drone'] },
  };
  try { window.dispatchEvent(new CustomEvent('inryoku:p3complete')); } catch (_) {}
}

function createOverlayCanvas() {
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:99997;background:transparent';
  document.body.appendChild(c);
  return c;
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default createTransition;
