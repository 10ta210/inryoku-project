// behaviors/breathing_sphere.js
// idle baseline: golden-angle sphere with a gentle radial breath. Hue drifts
// extremely slowly, lightness is pinned to 0.5 (grey-anchored RGBCMY rule).

export const meta = {
  id: 'breathing_sphere',
  label: 'Breathing Sphere',
  tags: ['idle'],
};

const GOLDEN = 2.39996322972865332;

export function step(i, count, target, color, time, ctx) {
  // ctx.reduceMotion (contract — propagated by cosmos-integration). When set,
  // clamp the time parameter to 0 so positions/colors no longer vary frame
  // to frame. Effectively a static snapshot of the breathing pose.
  if (ctx && ctx.reduceMotion) time = 0;
  const u = i / Math.max(1, count);
  const phi = Math.acos(2 * u - 1);
  const theta = i * GOLDEN;
  const r = 16 + 0.9 * Math.sin(time * 0.6 + u * 6.28318);
  const sp = Math.sin(phi);
  target.set(
    r * sp * Math.cos(theta),
    r * Math.cos(phi),
    r * sp * Math.sin(theta)
  );
  const hue = (time * 0.02 + u * 0.1) % 1;
  // sat ∈ [0.12, 0.48] by construction — no need to guard against negatives.
  const sat = 0.30 + 0.18 * Math.sin(time + u * 14);
  color.setHSL(hue, sat, 0.5);
}
