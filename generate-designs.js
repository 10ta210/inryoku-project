const { createCanvas } = require('canvas');
const QRCode = require('qrcode');
const fs = require('fs');

// Print area: ~12x14 inches at 300 DPI = 3600x4200px
const W = 3600;
const H = 4200;

async function generateQRDesign() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, W, H);

  // Generate actual QR code data
  const qrData = await QRCode.create('https://inryoku.com', { errorCorrectionLevel: 'H' });
  const modules = qrData.modules;
  const size = modules.size;

  // Draw large QR code in center
  const qrSize = 2400;
  const cellSize = qrSize / size;
  const qrX = (W - qrSize) / 2;
  const qrY = (H - qrSize) / 2 - 200;

  // QR code cells - white on transparent (for black shirt)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules.get(col, row)) {
        const x = qrX + col * cellSize;
        const y = qrY + row * cellSize;
        // Slightly rounded cells for style
        const padding = cellSize * 0.08;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2);
      }
    }
  }

  // "SCAN ME" text below QR
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = 'bold 120px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN ME', W / 2, qrY + qrSize + 180);

  // "inryoku" small text at bottom
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '80px "Courier New", monospace';
  ctx.fillText('inryoku\u0308', W / 2, qrY + qrSize + 320);

  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('/Users/10ta210/Desktop/inryoku/print_qr_tee.png', buffer);
  console.log('QR T design saved: print_qr_tee.png (' + Math.round(buffer.length/1024) + ' KB)');
}

function generateUniverseDesign() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, W, H);

  // RGBCMY particle universe
  const colors = [
    '#FF0000', '#00FF00', '#0000FF', // RGB
    '#00FFFF', '#FF00FF', '#FFFF00', // CMY
    '#FFFFFF',
  ];

  // Seed random for reproducibility
  let seed = 42;
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  // Draw scattered particles
  const particleCount = 300;
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    const x = W * 0.1 + rand() * W * 0.8;
    const y = H * 0.05 + rand() * H * 0.7;
    const r = 4 + rand() * 20;
    const color = colors[Math.floor(rand() * colors.length)];
    const opacity = 0.3 + rand() * 0.7;
    particles.push({ x, y, r, color, opacity });
  }

  // Draw constellation lines first (behind particles)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 350 && rand() > 0.7) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  // Draw particles with glow
  for (const p of particles) {
    // Glow
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
    gradient.addColorStop(0, p.color + Math.round(p.opacity * 80).toString(16).padStart(2, '0'));
    gradient.addColorStop(1, p.color + '00');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.opacity;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Central sphere (grey, subtle)
  const cx = W / 2;
  const cy = H / 2 - 200;
  const sphereR = 300;
  const sphereGrad = ctx.createRadialGradient(cx - 80, cy - 80, 0, cx, cy, sphereR);
  sphereGrad.addColorStop(0, 'rgba(180, 180, 180, 0.15)');
  sphereGrad.addColorStop(0.7, 'rgba(100, 100, 100, 0.08)');
  sphereGrad.addColorStop(1, 'rgba(50, 50, 50, 0)');
  ctx.fillStyle = sphereGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, sphereR, 0, Math.PI * 2);
  ctx.fill();

  // Sphere outline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, sphereR, 0, Math.PI * 2);
  ctx.stroke();

  // "YOUR UNIVERSE" text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = 'bold 140px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('YOUR', W / 2, H * 0.78);
  ctx.fillText('UNIVERSE', W / 2, H * 0.78 + 170);

  // "inryoku" small
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '70px "Courier New", monospace';
  ctx.fillText('inryoku\u0308', W / 2, H * 0.78 + 320);

  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('/Users/10ta210/Desktop/inryoku/print_universe_tee.png', buffer);
  console.log('Universe T design saved: print_universe_tee.png (' + Math.round(buffer.length/1024) + ' KB)');
}

(async () => {
  await generateQRDesign();
  generateUniverseDesign();
  console.log('Done! Both designs ready for upload.');
})();
