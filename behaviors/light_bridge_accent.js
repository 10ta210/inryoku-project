// behaviors/light_bridge_accent.js
// accent layer for Light Bridge events. ctx.bridge = { from, to, t }.
// Particles near the bridge's midline get pulled toward an interpolated point
// on it; the rest drift on the breathing sphere. When no bridge is active,
// behaves exactly like idle.

export const meta = {
  id: 'light_bridge_accent',
  label: 'Light Bridge Accent',
  tags: ['discovery'],
};

const GOLDEN = 2.39996322972865332;

export function step(i, count, target, color, time, ctx) {
  // ctx.reduceMotion clamp — freezes the breathing/hue drift. The bridge
  // pull itself stays geometrically correct against ctx.bridge.t.
  if (ctx && ctx.reduceMotion) time = 0;
  const u = i / Math.max(1, count);
  const phi = Math.acos(2 * u - 1);
  const theta = i * GOLDEN;
  const sp = Math.sin(phi);
  const r = 16 + 0.6 * Math.sin(time * 0.5 + u * 6.28318);
  const bx = r * sp * Math.cos(theta);
  const by = r * Math.cos(phi);
  const bz = r * sp * Math.sin(theta);

  const bridge = ctx && ctx.bridge;
  if (!bridge || !bridge.from || !bridge.to) {
    target.set(bx, by, bz);
    let hue = (time * 0.02 + u * 0.1) % 1;
    if (hue < 0) hue += 1;
    color.setHSL(hue, 0.35, 0.5);
    return;
  }

  // Particle's own param along bridge, hashed from i for stable scatter.
  const s = ((i * 0.6180339887) % 1);
  const fx = bridge.from.x, fy = bridge.from.y, fz = bridge.from.z;
  const tx = bridge.to.x, ty = bridge.to.y, tz = bridge.to.z;
  const lx = fx + (tx - fx) * s;
  const ly = fy + (ty - fy) * s;
  const lz = fz + (tz - fz) * s;

  // Distance from this particle's idle pos to its lane point.
  const dx = lx - bx, dy = ly - by, dz = lz - bz;
  const d2 = dx * dx + dy * dy + dz * dz;
  // Pull factor grows as particle is near the line, scaled by bridge head t.
  const head = typeof bridge.t === 'number' ? bridge.t : 0.5;
  const pull = (1 / (1 + d2 * 0.05)) * (0.4 + head * 0.5);

  target.set(bx + dx * pull, by + dy * pull, bz + dz * pull);
  let hue = (head + u * 0.3 + time * 0.04) % 1;
  if (hue < 0) hue += 1;
  color.setHSL(hue, 0.5 + 0.4 * pull, 0.5);
}
