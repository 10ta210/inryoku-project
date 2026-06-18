// behaviors/attractor_hover.js
// discovery state: particles are anchored to the breathing sphere but get
// pulled toward the cursor with quadratic falloff. Saturation rises near the
// pointer so attention has a visible "warmth" radius.

export const meta = {
  id: 'attractor_hover',
  label: 'Attractor (Hover)',
  tags: ['discovery'],
};

const GOLDEN = 2.39996322972865332;
// Attractor falloff coefficient — tuned to r=16 sphere; halflife ~7.4 units.
// Bumping the sphere radius will require re-tuning this.
const FALLOFF = 0.018;

export function step(i, count, target, color, time, ctx) {
  if (ctx && ctx.reduceMotion) time = 0;
  const u = i / Math.max(1, count);
  const phi = Math.acos(2 * u - 1);
  const theta = i * GOLDEN;
  const sp = Math.sin(phi);
  const r = 16;
  const bx = r * sp * Math.cos(theta);
  const by = r * Math.cos(phi);
  const bz = r * sp * Math.sin(theta);
  const mx = (ctx && typeof ctx.mx === 'number') ? ctx.mx : 0;
  const my = (ctx && typeof ctx.my === 'number') ? ctx.my : 0;
  const dx = mx - bx;
  const dy = my - by;
  const d2 = dx * dx + dy * dy;
  const fall = 1 / (1 + d2 * FALLOFF);
  target.set(bx + dx * fall * 0.7, by + dy * fall * 0.7, bz);
  let hue = (u + time * 0.05) % 1;
  if (hue < 0) hue += 1;
  color.setHSL(hue, 0.4 + 0.55 * fall, 0.5);
}
