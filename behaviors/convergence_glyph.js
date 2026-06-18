// behaviors/convergence_glyph.js
// contact state: particles converge into the INRYOKU glyph sampled to points
// via an offscreen canvas (host builds ctx.textPts once at boot). Each
// particle picks a target point and trembles around it; hue is a horizontal
// gradient so the word reads left-to-right.

export const meta = {
  id: 'convergence_glyph',
  label: 'Convergence Glyph',
  tags: ['contact'],
};

export function step(i, count, target, color, time, ctx) {
  if (ctx && ctx.reduceMotion) time = 0;
  const pts = ctx && ctx.textPts;
  if (!pts || !pts.length) {
    // Fallback: small grey cloud at origin. No allocations.
    const u = i / Math.max(1, count);
    const a = i * 2.39996322972865332;
    const r = 2 + u * 0.5;
    target.set(Math.cos(a) * r, Math.sin(a * 1.3) * r, Math.cos(a * 0.7) * r);
    color.setRGB(0.5, 0.5, 0.5);
    return;
  }
  const p = pts[i % pts.length];
  const wob = 0.5 * Math.sin(time * 0.9 + i * 0.07);
  const px = p.x, py = p.y;
  target.set(
    px + wob * Math.cos(i * 0.3),
    py + wob * Math.sin(i * 0.3),
    wob * 2
  );
  let hue = ((px + 30) / 60 + time * 0.05) % 1;
  if (hue < 0) hue += 1;
  color.setHSL(hue, 0.9, 0.5);
}
