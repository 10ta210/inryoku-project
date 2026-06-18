// inryokü samples — shared helpers (seeded, identical motion across all samples)
window.INRYOKU = (function(){
  const RGBCMY = ['#FF0000','#00FF00','#0044FF','#00FFFF','#FF00FF','#FFFF00'];

  // Seeded PRNG (mulberry32) so every sample shares positions/colors/sizes/phases
  function mulberry32(seed){
    return function(){
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function setupCanvas(id){
    const cv = document.getElementById(id);
    const ctx = cv.getContext('2d');
    function resize(){
      cv.width = window.innerWidth * devicePixelRatio;
      cv.height = window.innerHeight * devicePixelRatio;
      cv.style.width = window.innerWidth+'px';
      cv.style.height = window.innerHeight+'px';
    }
    resize();
    window.addEventListener('resize', resize);
    return {cv, ctx, w:()=>cv.width, h:()=>cv.height};
  }

  // Build identical particle set from a fixed seed.
  // Size distribution: 50% small (2-4), 35% mid (8-14), 15% big (22-40), times DPR.
  function makeParticles(W, H){
    const rnd = mulberry32(20260428);
    const N = 800;
    const ps = [];
    const dpr = devicePixelRatio;
    for (let i = 0; i < N; i++){
      const t = rnd();
      let r;
      if (t < 0.50)      r = 2  + rnd() * 2;
      else if (t < 0.85) r = 8  + rnd() * 6;
      else               r = 22 + rnd() * 18;
      r *= dpr;
      const colorHex = RGBCMY[(rnd() * 6) | 0];
      ps.push({
        baseX: rnd() * W,
        baseY: rnd() * H,
        r,
        color: colorHex,
        rgb: hexToRgb(colorHex),
        // motion params (identical drift for every sample)
        ax: 20 + rnd() * 30,           // amplitude x (px)
        ay: 20 + rnd() * 30,           // amplitude y
        fx: 0.15 + rnd() * 0.25,       // frequency x
        fy: 0.15 + rnd() * 0.25,       // frequency y
        phx: rnd() * Math.PI * 2,
        phy: rnd() * Math.PI * 2,
      });
    }
    return ps;
  }

  // Identical drift formula across every sample.
  function step(p, time){
    p.x = p.baseX + Math.sin(time * p.fx + p.phx) * p.ax * devicePixelRatio;
    p.y = p.baseY + Math.cos(time * p.fy + p.phy) * p.ay * devicePixelRatio;
  }

  function hexToRgb(h){
    const n = parseInt(h.slice(1),16);
    return [(n>>16)&255,(n>>8)&255,n&255];
  }

  // Standard animation loop using the supplied draw function.
  function run(drawParticle){
    const {ctx, w, h} = setupCanvas('cv');
    let particles = makeParticles(w(), h());
    window.addEventListener('resize', ()=>{ particles = makeParticles(w(), h()); });
    const start = performance.now();
    function frame(){
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w(), h());
      const t = (performance.now() - start) / 1000;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles){
        step(p, t);
        drawParticle(ctx, p.x, p.y, p.r, p.color, p.rgb);
      }
      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    }
    frame();
  }

  function rgba(rgb, a){ return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

  return {RGBCMY, setupCanvas, makeParticles, step, hexToRgb, run, rgba};
})();
