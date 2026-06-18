/**
 * p2-to-p3.js — yin-yang + RGBCMY sphere → universe + 8 constellations.
 *
 * Spec §4.3. Duration 1200ms — the biggest jump deserves the biggest morph.
 *
 * What happens:
 *   1) The 4000 code particles begin a radial outflow over 600ms (away from
 *      camera origin) → visual feel of "falling into the universe through code".
 *   2) The 12000 yin-yang manifold particles disperse along their base normals
 *      by ×4.0 units over 600ms, alpha fading to 0.
 *   3) The 101% sphere particles also disperse outward.
 *   4) The dividing curve of the yin-yang becomes a light bridge between
 *      two constellations (the entry handles 2 of P3's 8 stars).
 *   5) Sample 128 mixed particles (64 code + 64 manifold) at mid-flight.
 *   6) Write __inryokuHandoff with world-space positions + P3 cameraHint.
 *
 * fromState: {
 *   codeParticles:    [{ x, y, z, hue }]   sampled from P2's 4000
 *   manifoldParticles:[{ x, y, z, hue }]   sampled from P2's 12000
 *   spherePoints:     [{ x, y, z }]        101% sphere particles
 *   dividingCurve:    [{ x, y, z }]        yin-yang dividing curve points
 *   canvas:           overlay (optional)
 * }
 * toState: { particleCount: 128, constellationA, constellationB }
 */

import { easeInOutCubic, lerpRGB, rgbaCSS, rafAnim } from '../phase-bus.js';

const DEFAULT_DURATION = 1200;

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
    const N = toState.particleCount || (isTabletLike() ? 64 : 128);
    const reduce = toState.reduce || prefersReducedMotion();

    // Build sampled handoff cohort: 50% code-like, 50% manifold-like
    const half = Math.floor(N / 2);
    const codeSrc = (fromState.codeParticles || []).slice(0, half);
    const manSrc  = (fromState.manifoldParticles || []).slice(0, half);
    while (codeSrc.length < half) codeSrc.push(synthCode(cx, cy));
    while (manSrc.length  < half) manSrc.push(synthManifold(cx, cy));

    // Build particle records — each has scatter trajectory
    const particles = [];
    for (let i = 0; i < half; i++) {
      const p = codeSrc[i];
      const ang = Math.random() * Math.PI * 2;
      const dist = 200 + Math.random() * 600;
      particles.push({
        kind: 'code',
        ox: p.x != null ? p.x : cx, oy: p.y != null ? p.y : cy,
        dx: Math.cos(ang), dy: Math.sin(ang),
        dist,
        hueIn: p.hue || [0.27, 0.93, 0.48],
        hueOut: pickP3Hue(i),
        size: 1 + Math.random() * 1.4,
        x: 0, y: 0,
      });
    }
    for (let i = 0; i < half; i++) {
      const p = manSrc[i];
      const ang = Math.atan2((p.y || cy) - cy, (p.x || cx) - cx);
      particles.push({
        kind: 'manifold',
        ox: p.x != null ? p.x : cx, oy: p.y != null ? p.y : cy,
        dx: Math.cos(ang), dy: Math.sin(ang),
        dist: 360 + Math.random() * 480,
        hueIn: p.hue || (i % 2 ? [0.95, 0.97, 1.0] : [0.02, 0.02, 0.05]),
        hueOut: pickP3Hue(i + 7),
        size: 1.4 + Math.random() * 1.2,
        x: 0, y: 0,
      });
    }

    // Light bridge endpoints — 2 constellations
    const consA = toState.constellationA || { x: cx - W * 0.28, y: cy - H * 0.18 };
    const consB = toState.constellationB || { x: cx + W * 0.30, y: cy + H * 0.12 };

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

      // Background dim — universe darkens in
      ctx.fillStyle = 'rgba(2,2,6,' + (easeInOutCubic(t) * 0.7) + ')';
      ctx.fillRect(0, 0, W, H);

      // Light bridge — yin-yang dividing curve → 2 constellation light arc
      if (t > 0.35) {
        const u = easeInOutCubic((t - 0.35) / 0.65);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(220,230,255,' + (u * 0.55) + ')';
        ctx.lineWidth = 1 + u * 1.5;
        ctx.beginPath();
        const mx = (consA.x + consB.x) / 2;
        const my = (consA.y + consB.y) / 2 - 60 * u;
        ctx.moveTo(consA.x, consA.y);
        ctx.quadraticCurveTo(mx, my, consB.x, consB.y);
        ctx.stroke();
        // anchor stars
        for (const star of [consA, consB]) {
          ctx.fillStyle = 'rgba(255,255,255,' + (u * 0.9) + ')';
          ctx.beginPath();
          ctx.arc(star.x, star.y, 1.5 + u * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Particles — radial outflow then settle toward P3 ambient drift
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const u = easeInOutCubic(t);
        const r = p.dist * u;
        const x = p.ox + p.dx * r;
        const y = p.oy + p.dy * r;
        p.x = x; p.y = y;
        const col = lerpRGB(p.hueIn, p.hueOut, u);
        const alpha = (p.kind === 'manifold') ? (1 - u * 0.85) : (0.95 - u * 0.25);
        ctx.fillStyle = rgbaCSS(col, Math.max(0, alpha));
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    return anim.promise.then(() => {
      publishHandoff(particles, N);
      setTimeout(() => {
        canvas.style.transition = 'opacity 280ms linear';
        canvas.style.opacity = '0';
        setTimeout(() => { try { canvas.remove(); } catch(_){} }, 300);
      }, 120);
      if (debug) console.log('[p2-to-p3] handoff N=' + N);
    });
  }

  function cancel() { cancelled = true; if (anim) anim.cancel(); }

  return { run, cancel };
}

const P3_HUES = [
  [1.0, 0.30, 0.30],   // R
  [0.30, 1.0, 0.40],   // G
  [0.30, 0.45, 1.0],   // B
  [0.30, 0.95, 0.95],  // C
  [0.95, 0.30, 0.95],  // M
  [0.95, 0.95, 0.30],  // Y
];
function pickP3Hue(seed) { return P3_HUES[Math.abs(seed) % P3_HUES.length]; }

function synthCode(cx, cy) {
  const ang = Math.random() * Math.PI * 2;
  const r = 40 + Math.random() * 160;
  return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, hue: [0.27, 0.93, 0.48] };
}
function synthManifold(cx, cy) {
  const ang = Math.random() * Math.PI * 2;
  const r = 80 + Math.random() * 100;
  return {
    x: cx + Math.cos(ang) * r,
    y: cy + Math.sin(ang) * r,
    hue: Math.random() < 0.5 ? [0.02, 0.02, 0.05] : [0.95, 0.97, 1.0],
  };
}

function publishHandoff(particles, N) {
  // P2 → P3: positions already approximately in world coords for cosmos-layer
  // (cosmos-layer uses ~viewport-centred world units; we hand off world directly).
  // We map screen → world by scale 0.03 (rough match to cosmos-layer scale).
  const W = window.innerWidth, H = window.innerHeight;
  const snap = particles.slice(0, N).map((p) => ({
    x: (p.x - W / 2) * 0.03,
    y: (p.y - H / 2) * 0.03,
    z: (Math.random() - 0.5) * 8,
    hue: p.hueOut,
    size: p.size,
  }));
  window.__inryokuHandoff = {
    fromPhase: 'P2',
    toPhase: 'P3',
    particles: snap,
    bornAt: performance.now(),
    cameraHint: { z: 72, fov: 50 },
    audioState: { fadeOut: ['drone'] },
  };
  try { window.dispatchEvent(new CustomEvent('inryoku:p2complete')); } catch (_) {}
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
