(() => {
  'use strict';

  const T = {
    birth0: 0,
    birth1: 4.5,
    taichi0: 4.5,
    taichi1: 9.0,
    grey0: 9.0,
    grey1: 14.0,
    leak0: 12.4,
    leak1: 17.0,
    bloom0: 16.0,
    bloom1: 19.2,
    wall0: 19.2,
    wall1: 20.4,
    breach0: 20.4,
    breach1: 21.2,
    ingest0: 21.2,
    ingest1: 24.4,
    white0: 24.4,
    white1: 28.0,
    eye0: 28.0,
    eye1: 31.2,
    open0: 31.2,
    open1: 32.6,
    cross0: 32.6,
    cross1: 35.0
  };

  const root = document.getElementById('p1-zero-root');
  const canvas = document.getElementById('p1-zero-webgl');
  const ui = document.getElementById('p1-zero-ui');
  const bar = document.getElementById('p1-zero-bar');
  const pct = document.getElementById('p1-zero-percent');
  const runner = document.getElementById('p1-zero-runner');
  const hud = document.getElementById('p1-zero-stage');
  const pauseBtn = document.getElementById('p1-zero-pause');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  camera.position.z = 5;

  const bgMat = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uSplit: { value: 1 },
      uLens: { value: 0 },
      uCenter: { value: new THREE.Vector2(0, 0) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uSplit;
      uniform float uLens;

      vec3 spectrum(float t) {
        float x = fract(t) * 6.0;
        if (x < 1.0) return mix(vec3(1,0,0), vec3(1,1,0), x);
        if (x < 2.0) return mix(vec3(1,1,0), vec3(0,1,0), x - 1.0);
        if (x < 3.0) return mix(vec3(0,1,0), vec3(0,1,1), x - 2.0);
        if (x < 4.0) return mix(vec3(0,1,1), vec3(0,0,1), x - 3.0);
        if (x < 5.0) return mix(vec3(0,0,1), vec3(1,0,1), x - 4.0);
        return mix(vec3(1,0,1), vec3(1,0,0), x - 5.0);
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        vec3 split = mix(vec3(0.02), vec3(0.94), step(p.x, 0.0));
        vec3 black = vec3(0.0);
        vec3 col = mix(black, split, uSplit);

        float r = length(p);
        float ring = exp(-abs(r - (0.28 + 0.012 * sin(uTime * 5.0))) * 44.0);
        float wave = sin(r * 38.0 - uTime * 7.0) * 0.5 + 0.5;
        vec3 einstein = mix(vec3(1.0), spectrum(atan(p.y,p.x)/6.28318 + uTime * 0.06), 0.38);
        col = mix(col, einstein, ring * wave * uLens * 0.45);

        float gravity = smoothstep(1.1, 0.0, r) * uLens;
        col *= 1.0 - gravity * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  scene.add(bg);

  const solarMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uWhite: { value: 0 },
      uEyeOpen: { value: 0 },
      uCross: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uWhite, uEyeOpen, uCross;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float corona = exp(-r * 2.55) * uWhite * 0.82;
        float aureole = exp(-abs(r - 0.34) * 7.5) * uWhite * 0.18;
        float rays = (pow(abs(p.x), -0.18) + pow(abs(p.y), -0.18)) * 0.010;
        rays *= smoothstep(0.04, 1.0, uCross) * (0.55 + 0.45 * sin(uTime * 2.0));
        float v = exp(-p.x*p.x * 420.0) * smoothstep(0.02, 1.15, abs(p.y));
        float h = exp(-p.y*p.y * 420.0) * smoothstep(0.02, 1.15, abs(p.x));
        vec3 cross = vec3(1.0) * v * uCross * 0.88 + vec3(0.02) * h * uCross * 0.34;
        float openFlash = exp(-r * 3.0) * smoothstep(0.03, 0.22, uEyeOpen) * (1.0 - smoothstep(0.38, 0.9, uEyeOpen)) * 0.58;
        vec3 col = vec3(1.0) * (corona + aureole + openFlash + rays) + cross;
        float alpha = clamp(corona + aureole + openFlash + (v + h) * uCross * 0.52, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const solar = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), solarMat);
  solar.renderOrder = 1;
  scene.add(solar);

  const sphereMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uVisible: { value: 0 },
      uTaichi: { value: 0 },
      uGrey: { value: 0 },
      uLeak: { value: 0 },
      uBloom: { value: 0 },
      uWhite: { value: 0 },
      uEye: { value: 0 },
      uEyeOpen: { value: 0 },
      uCross: { value: 0 },
      uLens: { value: 0 }
    },
    vertexShader: `
      varying vec3 vP;
      varying vec3 vN;
      void main() {
        vP = position;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vP;
      varying vec3 vN;
      uniform float uTime, uVisible, uTaichi, uGrey, uLeak, uBloom, uWhite, uEye, uEyeOpen, uCross, uLens;

      vec3 spectrum(float t) {
        float x = fract(t) * 6.0;
        if (x < 1.0) return mix(vec3(1,0,0), vec3(1,1,0), x);
        if (x < 2.0) return mix(vec3(1,1,0), vec3(0,1,0), x - 1.0);
        if (x < 3.0) return mix(vec3(0,1,0), vec3(0,1,1), x - 2.0);
        if (x < 4.0) return mix(vec3(0,1,1), vec3(0,0,1), x - 3.0);
        if (x < 5.0) return mix(vec3(0,0,1), vec3(1,0,1), x - 4.0);
        return mix(vec3(1,0,1), vec3(1,0,0), x - 5.0);
      }
      float hash(vec3 p) { return fract(sin(dot(p, vec3(41.2, 17.7, 63.1))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        float n = mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                      mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
        return n;
      }

      void main() {
        vec3 p = normalize(vP);
        vec2 uv = p.xy * 1.18;
        float rim = pow(1.0 - max(dot(normalize(vN), vec3(0,0,1)), 0.0), 1.8);

        float form = smoothstep(0.0, 1.0, uTaichi);
        float birth = 1.0 - form;

        // P2寄りの3D太極。球面法線からS字を作り、平面ステッカー感を避ける。
        float xBound;
        if (p.y >= 0.0) {
          xBound = -sqrt(max(0.0, 0.25 - (p.y - 0.5) * (p.y - 0.5)));
        } else {
          xBound =  sqrt(max(0.0, 0.25 - (p.y + 0.5) * (p.y + 0.5)));
        }
        xBound += sin(p.z * 2.2 + uTime * 0.08) * 0.018;
        float s = p.x - xBound;
        float side = smoothstep(-0.035, 0.035, s);
        vec3 dark = vec3(0.004, 0.005, 0.008);
        vec3 light = vec3(0.92, 0.93, 0.97);
        vec3 taichi = mix(dark, light, side);

        // 50%直後: 左の黒と右の白が中央で衝突し、その衝突が太極のS字へ整う。
        float leftBlob = exp(-dot((uv - vec2(mix(-1.25, -0.22, form), 0.0)) * vec2(1.35, 0.82), (uv - vec2(mix(-1.25, -0.22, form), 0.0)) * vec2(1.35, 0.82)) * 4.4);
        float rightBlob = exp(-dot((uv - vec2(mix(1.25, 0.22, form), 0.0)) * vec2(1.35, 0.82), (uv - vec2(mix(1.25, 0.22, form), 0.0)) * vec2(1.35, 0.82)) * 4.4);
        vec3 collision = mix(dark, light, smoothstep(-0.15, 0.15, uv.x));
        collision = mix(collision, dark, leftBlob * 0.86);
        collision = mix(collision, light, rightBlob * 0.86);
        collision += vec3(1.0) * exp(-dot(uv, uv) * 20.0) * birth * 0.08;

        float seam = 1.0 - smoothstep(0.0, 0.105, abs(s));
        float viewLight = 0.46 + 0.68 * pow(max(p.z * 0.5 + 0.5, 0.0), 0.72);
        vec3 symbol = mix(collision, taichi, smoothstep(0.10, 0.82, form));
        symbol *= viewLight;
        symbol += vec3(0.80, 0.86, 1.0) * pow(rim, 4.2) * 0.22;

        // グレー化は全体フェードではなく、S字境界から白黒が溶け合う。
        float molecular = noise(p * 7.0 + vec3(0.0, 0.0, uTime * 0.055));
        float meltWave = uGrey + seam * 0.34 + molecular * 0.15 - abs(s) * 0.12;
        float greySpread = smoothstep(0.08, 1.0, meltWave);
        float residue = (1.0 - greySpread) * (1.0 - smoothstep(0.70, 1.0, uGrey));
        vec3 grey = vec3(0.50) + vec3(0.026, 0.024, 0.030) * (molecular - 0.5);
        vec3 mixedGrey = mix(symbol, grey, greySpread);
        mixedGrey = mix(mixedGrey, symbol, residue * 0.18);
        vec3 col = mixedGrey;

        // 虹は境界から漏れ、次にグレー内部の分子に点火していく。
        vec3 leakColor = spectrum(uTime * 0.045 + p.y * 0.22 + atan(p.z, p.x) / 6.28318);
        float internalSpark = smoothstep(0.64, 0.98, molecular + uLeak * 0.28);
        float leakMask = (seam * 0.72 + internalSpark * 0.22 + rim * 0.20) * uLeak;
        col = mix(col, mix(col, leakColor, 0.58), leakMask);

        // P2/P3コア寄り: 球面ノイズで流動する12極RGBCMY発光コア。
        vec3 nOff = vec3(
          noise(p * 2.5 + vec3(uTime * .10, 0.0, 0.0)) * 2.0 - 1.0,
          noise(p * 2.5 + vec3(0.0, uTime * .08, 0.0)) * 2.0 - 1.0,
          noise(p * 2.5 + vec3(0.0, 0.0, uTime * .06)) * 2.0 - 1.0
        );
        vec3 wPos = normalize(p + nOff * 0.28);
        vec3 dirs[12];
        dirs[0]=vec3(1.,0.,0.); dirs[1]=vec3(-1.,0.,0.);
        dirs[2]=vec3(0.,1.,0.); dirs[3]=vec3(0.,-1.,0.);
        dirs[4]=vec3(0.,0.,1.); dirs[5]=vec3(0.,0.,-1.);
        dirs[6]=normalize(vec3(1.,1.,0.)); dirs[7]=normalize(vec3(-1.,-1.,0.));
        dirs[8]=normalize(vec3(0.,1.,1.)); dirs[9]=normalize(vec3(0.,-1.,-1.));
        dirs[10]=normalize(vec3(1.,0.,1.)); dirs[11]=normalize(vec3(-1.,0.,-1.));
        vec3 cols[12];
        cols[0]=vec3(1.,0.,0.); cols[1]=vec3(0.,1.,1.);
        cols[2]=vec3(0.,1.,0.); cols[3]=vec3(1.,0.,1.);
        cols[4]=vec3(0.,0.,1.); cols[5]=vec3(1.,1.,0.);
        cols[6]=vec3(1.0,0.45,0.0); cols[7]=vec3(0.0,0.55,1.0);
        cols[8]=vec3(0.0,1.0,0.6); cols[9]=vec3(1.0,0.25,0.55);
        cols[10]=vec3(0.75,0.25,1.0); cols[11]=vec3(0.85,0.85,0.2);
        float field = 0.0;
        vec3 rgbcmy = vec3(0.0);
        for (int i=0; i<12; i++) {
          float w = max(0.0, dot(wPos, dirs[i]));
          w = w * w * w;
          rgbcmy += cols[i] * w;
          field += w;
        }
        rgbcmy /= max(field, 0.001);
        float pores = smoothstep(.26, .88, noise(p*5.0 + uTime*.10) + uBloom*.26 + leakMask*.20);
        float bloomMask = smoothstep(.02, 1.0, uBloom) * (0.12 + 0.88 * pores);
        col = mix(col, rgbcmy, bloomMask);
        col += rgbcmy * rim * (uLeak*.12 + uBloom*.24);

        vec3 white = vec3(1.0);
        vec3 whiteCol = mix(col, white, uWhite * 0.84);
        whiteCol += white * rim * uWhite * 3.8;
        whiteCol += vec3(1.0) * exp(-dot(uv, uv) * 7.5) * uWhite * 0.42;
        whiteCol = mix(whiteCol, mix(whiteCol, spectrum(atan(p.y,p.x)/6.28318), .30), rim * uWhite * .20);
        col = whiteCol;

        vec2 e = uv;
        e.y *= 1.12;
        float open = smoothstep(0.0, 1.0, uEyeOpen);
        float lid = e.y + 0.055 * sin(e.x * 3.14159265);
        float aperture = mix(0.018, 0.46, open);
        float mask = 1.0 - smoothstep(aperture, aperture + 0.065, abs(lid));
        float closed = exp(-lid*lid*1100.0) * (1.0 - open);
        float er = length(e * vec2(1.0, .88));
        float sclera = (1.0 - smoothstep(.55, .72, er)) * mask;
        float iris = (1.0 - smoothstep(.31, .48, er)) * smoothstep(.075, .16, er) * mask;
        float pupil = (1.0 - smoothstep(.10, .18, er)) * mask;
        float rings = sin(er * 96.0 - uTime * 1.2) * .5 + .5;
        vec3 irisCol = mix(vec3(0,.14,.34), vec3(0,.92,1), .55 + .1*sin(uTime*.5));
        col = mix(col, vec3(0), closed * uEye);
        col = mix(col, vec3(.96), sclera * uEye * open * .38);
        col = mix(col, irisCol, iris * uEye * open);
        col = mix(col, spectrum(er*1.6 + uTime*.04), iris * rings * uEye * open * .16);
        col = mix(col, vec3(0), pupil * uEye * open);
        col = mix(col, vec3(1), (1.0 - smoothstep(.035,.075,length(e-vec2(-.13,.14)))) * uEye * open * .78);

        float vBeam = exp(-uv.x*uv.x*78.0) * (1.0 - smoothstep(.12, 1.08, abs(uv.y)));
        float hBeam = exp(-uv.y*uv.y*78.0) * (1.0 - smoothstep(.12, 1.08, abs(uv.x)));
        vec3 crossCol = col + vec3(1.0) * exp(-dot(uv,uv)*24.0) * uCross * 0.75;
        col = mix(col, crossCol, smoothstep(.02,.25,uCross));

        float alpha = uVisible * (0.92 + rim*.35);
        alpha = mix(alpha, 0.72 + rim*.65, uWhite);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 96, 64), sphereMat);
  sphere.position.z = 0.2;
  scene.add(sphere);

  const clock = new THREE.Clock();
  let paused = false;
  let frozenT = 0;
  let start = performance.now();
  let firedIngest = false;

  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'PLAY' : 'PAUSE';
    if (!paused) start = performance.now() - frozenT * 1000;
  });

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function smooth(x) { x = clamp01(x); return x*x*x*(x*(x*6-15)+10); }
  function range(t, a, b) { return clamp01((t-a)/(b-a)); }

  function stageName(t) {
    if (t < T.birth1) return '核凝結';
    if (t < T.taichi1) return '3D 陰陽';
    if (t < T.grey1) return 'グレー化';
    if (t < T.leak1) return '境界虹漏れ';
    if (t < T.bloom1) return 'RGBCMY 開花';
    if (t < T.wall1) return '100% WALL';
    if (t < T.breach1) return '101% BREACH';
    if (t < T.ingest1) return 'BLACK HOLE';
    if (t < T.white1) return '白光球';
    if (t < T.eye1) return '閉じた瞳';
    if (t < T.open1) return '開眼';
    if (t < T.cross1) return '十字架';
    return '終わらない';
  }

  function progress(t) {
    if (t < T.birth1) return 50 + smooth(range(t, T.birth0, T.birth1)) * 25;
    if (t < T.wall0) return 75 + smooth(range(t, T.taichi0, T.wall0)) * 24.5;
    if (t < T.wall1) return 100;
    if (t < T.breach1) return 100;
    return 101;
  }

  function update(t) {
    const u = sphereMat.uniforms;
    bgMat.uniforms.uTime.value = t;
    solarMat.uniforms.uTime.value = t;
    u.uTime.value = t;

    const p = progress(t);
    pct.textContent = `Loading reality... ${Math.round(p)}%`;
    bar.style.width = `${Math.min(101, p)}%`;
    bar.classList.toggle('breach', p >= 101);
    runner.style.left = `${Math.min(101, Math.max(50, p))}%`;

    u.uVisible.value = smooth(range(t, 0.8, 4.5));
    u.uTaichi.value = smooth(range(t, 3.2, T.taichi1));
    u.uGrey.value = smooth(range(t, T.grey0, T.grey1));
    u.uLeak.value = smooth(range(t, T.leak0, T.leak1));
    u.uBloom.value = smooth(range(t, T.bloom0, T.bloom1));
    u.uWhite.value = smooth(range(t, T.white0, T.white1));
    u.uEye.value = smooth(range(t, T.eye0, T.eye1));
    u.uEyeOpen.value = smooth(range(t, T.open0, T.open1));
    u.uCross.value = smooth(range(t, T.cross0, T.cross1));
    u.uLens.value = Math.max(smooth(range(t, T.ingest0, T.ingest0 + 1.35)) * (1 - smooth(range(t, T.ingest1 - 0.55, T.white0))), 0);
    solarMat.uniforms.uWhite.value = u.uWhite.value;
    solarMat.uniforms.uEyeOpen.value = u.uEyeOpen.value;
    solarMat.uniforms.uCross.value = u.uCross.value;

    bgMat.uniforms.uSplit.value = 1 - smooth(range(t, T.ingest0, T.ingest1));
    bgMat.uniforms.uLens.value = u.uLens.value;

    sphere.scale.setScalar(1 + Math.sin(t * 2.1) * 0.015 + u.uLens.value * 0.10 + u.uWhite.value * 0.04);
    sphere.rotation.y = Math.sin(t * 0.23) * 0.10;
    sphere.rotation.x = Math.sin(t * 0.17) * 0.045;

    if (t >= T.ingest0 && !firedIngest) {
      firedIngest = true;
      const sx = window.innerWidth / 2;
      const sy = window.innerHeight / 2;
      const rect = ui.getBoundingClientRect();
      ui.style.setProperty('--px', `${sx - rect.left - rect.width / 2}px`);
      ui.style.setProperty('--py', `${sy - rect.top - rect.height / 2}px`);
      root.classList.add('ingest');
    }

    hud.textContent = `P1 ${t.toFixed(2)}s | ${stageName(t)} | ${p.toFixed(1)}%`;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function frame() {
    requestAnimationFrame(frame);
    if (!paused) frozenT = (performance.now() - start) / 1000;
    update(frozenT);
    renderer.render(scene, camera);
  }
  frame();
})();
