// behaviors/ring_resonance.js
// speaking state: particles bucket into 12 concentric rings keyed by i%12.
// Each ring carries its own hue and breathes on the canon beat (time * 1.2).

export const meta = {
  id: 'ring_resonance',
  label: 'Ring Resonance',
  tags: ['speaking'],
};

export function step(i, count, target, color, time, ctx) {
  // ctx.reduceMotion clamp — freeze the breathing rings + hue drift so the
  // visual is a static portrait. WCAG 2.3.3 vestibular safety.
  if (ctx && ctx.reduceMotion) time = 0;
  const tick = i % 12;
  const u = i / Math.max(1, count);
  const ang = u * Math.PI * 48 + time * 0.5;
  const radius = 4 + tick * 1.6 + Math.sin(time * 1.2 + tick) * 0.4;
  target.set(
    Math.cos(ang) * radius,
    Math.sin(ang) * radius,
    Math.sin(time + u * Math.PI * 5) * 1.6
  );
  let hue = (tick / 12 + time * 0.08) % 1;
  if (hue < 0) hue += 1;
  color.setHSL(hue, 0.9, 0.5);
}
