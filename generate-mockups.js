const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

const MW = 800;
const MH = 1000;

function drawTshirtPath(ctx, s, ox, oy) {
  // 左肩の付け根
  ctx.moveTo(ox + 105*s, oy + 32*s);
  // 左肩 → 左袖先端（自然なカーブ）
  ctx.bezierCurveTo(ox + 75*s, oy + 38*s, ox + 45*s, oy + 50*s, ox + 20*s, oy + 85*s);
  // 左袖底辺（丸みのある袖口）
  ctx.bezierCurveTo(ox + 25*s, oy + 95*s, ox + 35*s, oy + 98*s, ox + 42*s, oy + 95*s);
  // 左袖底 → 左脇下
  ctx.bezierCurveTo(ox + 52*s, oy + 82*s, ox + 58*s, oy + 72*s, ox + 62*s, oy + 65*s);
  // 左脇下 → 左裾（微妙な体のライン）
  ctx.bezierCurveTo(ox + 60*s, oy + 140*s, ox + 58*s, oy + 220*s, ox + 60*s, oy + 280*s);
  // 左裾の丸み
  ctx.quadraticCurveTo(ox + 62*s, oy + 296*s, ox + 80*s, oy + 298*s);
  // 裾ライン（微妙にカーブ）
  ctx.quadraticCurveTo(ox + 175*s, oy + 302*s, ox + 270*s, oy + 298*s);
  // 右裾の丸み
  ctx.quadraticCurveTo(ox + 288*s, oy + 296*s, ox + 290*s, oy + 280*s);
  // 右裾 → 右脇下
  ctx.bezierCurveTo(ox + 292*s, oy + 220*s, ox + 290*s, oy + 140*s, ox + 288*s, oy + 65*s);
  // 右脇下 → 右袖底
  ctx.bezierCurveTo(ox + 292*s, oy + 72*s, ox + 298*s, oy + 82*s, ox + 308*s, oy + 95*s);
  // 右袖底辺（丸みのある袖口）
  ctx.bezierCurveTo(ox + 315*s, oy + 98*s, ox + 325*s, oy + 95*s, ox + 330*s, oy + 85*s);
  // 右袖先端 → 右肩
  ctx.bezierCurveTo(ox + 305*s, oy + 50*s, ox + 275*s, oy + 38*s, ox + 245*s, oy + 32*s);
  // 襟ぐり（自然なUカーブ）
  ctx.bezierCurveTo(ox + 225*s, oy + 42*s, ox + 200*s, oy + 48*s, ox + 175*s, oy + 48*s);
  ctx.bezierCurveTo(ox + 150*s, oy + 48*s, ox + 125*s, oy + 42*s, ox + 105*s, oy + 32*s);
  ctx.closePath();
}

function drawTshirt(ctx, color = '#111', bgColor = null) {
  ctx.save();
  const s = 1.8;
  const ox = 80, oy = 50;

  // Optional background fill (for visibility on dark pages)
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, MW, MH);
  }

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = color;
  ctx.beginPath();
  drawTshirtPath(ctx, s, ox, oy);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Clip to shirt shape for all overlays
  ctx.save();
  ctx.beginPath();
  drawTshirtPath(ctx, s, ox, oy);
  ctx.clip();

  // Fabric gradient (3D feel — light from top-left)
  const grad = ctx.createLinearGradient(ox, oy, ox + 350*s, oy + 300*s);
  grad.addColorStop(0, 'rgba(255,255,255,0.14)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.06)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.0)');
  grad.addColorStop(0.8, 'rgba(0,0,0,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.04)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, MW, MH);

  // Vertical fold lines (subtle wrinkles — center seam effect)
  const folds = [
    { x: ox + 175*s, w: 3, opacity: 0.04 },   // center
    { x: ox + 130*s, w: 2, opacity: 0.025 },   // left
    { x: ox + 220*s, w: 2, opacity: 0.025 },   // right
  ];
  folds.forEach(f => {
    const foldGrad = ctx.createLinearGradient(f.x - f.w, 0, f.x + f.w, 0);
    foldGrad.addColorStop(0, `rgba(255,255,255,0)`);
    foldGrad.addColorStop(0.3, `rgba(255,255,255,${f.opacity})`);
    foldGrad.addColorStop(0.5, `rgba(0,0,0,${f.opacity * 1.5})`);
    foldGrad.addColorStop(0.7, `rgba(255,255,255,${f.opacity})`);
    foldGrad.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.fillStyle = foldGrad;
    ctx.fillRect(f.x - 20, oy + 60*s, 40, 240*s);
  });

  // Horizontal fold (below chest — natural fabric drape)
  const hFold = ctx.createLinearGradient(0, oy + 180*s, 0, oy + 195*s);
  hFold.addColorStop(0, 'rgba(255,255,255,0)');
  hFold.addColorStop(0.4, 'rgba(255,255,255,0.03)');
  hFold.addColorStop(0.6, 'rgba(0,0,0,0.04)');
  hFold.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hFold;
  ctx.fillRect(ox + 60*s, oy + 170*s, 230*s, 30*s);

  // Shoulder highlight (left shoulder catches light)
  const shoulderGrad = ctx.createRadialGradient(
    ox + 90*s, oy + 45*s, 0,
    ox + 90*s, oy + 45*s, 60*s
  );
  shoulderGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
  shoulderGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shoulderGrad;
  ctx.fillRect(0, 0, MW, MH);

  ctx.restore(); // unclip

  // Edge highlight — define the silhouette clearly
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  drawTshirtPath(ctx, s, ox, oy);
  ctx.stroke();

  // Collar detail — double line for ribbed collar look
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ox + 125*s, oy + 42*s);
  ctx.bezierCurveTo(ox + 150*s, oy + 48*s, ox + 175*s, oy + 52*s, ox + 175*s, oy + 52*s);
  ctx.bezierCurveTo(ox + 200*s, oy + 52*s, ox + 225*s, oy + 48*s, ox + 245*s, oy + 35*s);
  ctx.stroke();
  // Inner collar line
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ox + 130*s, oy + 45*s);
  ctx.bezierCurveTo(ox + 152*s, oy + 50*s, ox + 175*s, oy + 54*s, ox + 175*s, oy + 54*s);
  ctx.bezierCurveTo(ox + 198*s, oy + 54*s, ox + 222*s, oy + 50*s, ox + 240*s, oy + 38*s);
  ctx.stroke();

  ctx.restore();
}

// Print area on the t-shirt (center chest)
const printArea = { x: 235, y: 200, w: 330, h: 385 };

async function generateQRMockup() {
  const canvas = createCanvas(MW, MH);
  const ctx = canvas.getContext('2d');

  // Transparent background — t-shirt floats on any bg
  // (canvas is already transparent by default)

  // Draw t-shirt — lighter shirt on medium-dark bg for contrast
  drawTshirt(ctx, '#3a3a3a', '#1c1c1c');

  // Load and draw print design
  const design = await loadImage('/Users/10ta210/Desktop/inryoku/print_qr_tee.png');
  ctx.drawImage(design, printArea.x, printArea.y, printArea.w, printArea.h);

  // Subtle vignette for depth
  const vg = ctx.createRadialGradient(MW/2, MH/2, MW*0.2, MW/2, MH/2, MW*0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, MW, MH);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('/Users/10ta210/Desktop/inryoku/public/mockup_qr_tee.png', buffer);
  console.log('QR mockup saved: mockup_qr_tee.png (' + Math.round(buffer.length/1024) + ' KB)');
}

async function generateUniverseMockup() {
  const canvas = createCanvas(MW, MH);
  const ctx = canvas.getContext('2d');

  // Draw t-shirt — lighter shirt on medium-dark bg for contrast
  drawTshirt(ctx, '#3a3a3a', '#1c1c1c');

  // Load and draw print design
  const design = await loadImage('/Users/10ta210/Desktop/inryoku/print_universe_tee.png');
  ctx.drawImage(design, printArea.x, printArea.y, printArea.w, printArea.h);

  // Subtle vignette for depth
  const vg = ctx.createRadialGradient(MW/2, MH/2, MW*0.25, MW/2, MH/2, MW*0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, MW, MH);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('/Users/10ta210/Desktop/inryoku/public/mockup_universe_tee.png', buffer);
  console.log('Universe mockup saved: mockup_universe_tee.png (' + Math.round(buffer.length/1024) + ' KB)');
}

(async () => {
  // Ensure public dir exists
  if (!fs.existsSync('/Users/10ta210/Desktop/inryoku/public')) {
    fs.mkdirSync('/Users/10ta210/Desktop/inryoku/public');
  }
  await generateQRMockup();
  await generateUniverseMockup();
  console.log('Both mockups ready!');
})();
