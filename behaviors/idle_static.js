// behaviors/idle_static.js
// Reduce-motion fallback. Deterministic golden-angle sphere with NO time
// dependence in position. Hue derived from index only — completely static.

export const meta = {
  id: 'idle_static',
  label: 'Idle (Static)',
  tags: ['idle'],
};

const GOLDEN = 2.39996322972865332;

export function step(i, count, target, color) {
  const u = i / Math.max(1, count);
  const phi = Math.acos(2 * u - 1);
  const theta = i * GOLDEN;
  const sp = Math.sin(phi);
  const r = 16;
  target.set(
    r * sp * Math.cos(theta),
    r * Math.cos(phi),
    r * sp * Math.sin(theta)
  );
  let hue = (u * 0.7) % 1;
  if (hue < 0) hue += 1;
  color.setHSL(hue, 0.35, 0.5);
}
