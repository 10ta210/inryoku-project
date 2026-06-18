/* ============================================================
   cosmos-effects.js — inryokü P3 visual effects layer (ESM)
   作成: 2026-05-12
   依存: three r160 (import map 必須: 'three')
   role:
     P3 prototype の "visual upgrade" を本番に移植する単体モジュール。
     cosmos-layer.js (DOM overlay, P0–P2) には触らない。
     本ファイルは Three.js scene にぶら下がる nebula / stars / shooters /
     constellations / light bridges / burst ring / logo holo sphere /
     circulation rings を提供する。

   Public API:
     createEffectsLayer(renderer, scene, camera, opts) → {
       update(time, ctx),      // 毎フレーム呼ぶ
       setActiveScene(state),  // 'breathing' | 'hover' | 'ring' | ...
       dispose(),
       constData,              // 8 constellations の中心点 (behavior engine 連携用)
       fireBurst(color)        // behavior 切替時の shockwave
     }

   Update order (1 frame):
     nebula → stars → constellations → bridges → shooters → particles
     → logo → rings → composer
   (particles は behavior engine 側で描画される。本層は前後を担う。)

   White/black 禁則:
     - logo_sphere: gray base = vec3(0.5), fresnel に RGBCMY を mix
     - shooter / bridge: HSL l=0.5 固定
     - star accent: 4-15% を rainbow accent (HSL l=0.5), 残りは gv=0.4-0.75 グレー
     - constellation line/dot: neutral grey (HSL l=0.5 keyed by k); additive blend
       gives the apparent brightness instead of pushing l>0.5.

   Mobile fallback (opts.tier === 'low'):
     star count 1/3, shooter pool 2, bridge pool 3, ring segs 96, no twinkle
   ============================================================ */

import * as THREE from 'three';

/* -------- shared helpers --------------------------------------- */

function makePointTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function disposeObject(obj) {
  obj.traverse?.((n) => {
    if (n.geometry) n.geometry.dispose?.();
    if (n.material) {
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose?.();
        m.dispose?.();
      });
    }
  });
  obj.parent?.remove(obj);
}

/* =====================================================================
   createEffectsLayer
   ===================================================================== */
export function createEffectsLayer(renderer, scene, camera, opts = {}) {
  const tier = opts.tier || 'auto';
  const reduce =
    opts.reduceMotion ??
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  // tier-driven counts ------------------------------------------------
  const low = tier === 'low';
  const COUNT_FAR = low ? 1000 : 3000;
  const COUNT_MID = low ? 500 : 1500;
  const COUNT_NEAR = low ? 200 : 600;
  const COUNT_TWINKLE = low ? 60 : 120;
  const SHOOT_POOL = low ? 2 : 3;
  const BRIDGE_POOL = low ? 3 : 5;
  const RING_SEGS = low ? 96 : 144;

  const pointTexture = makePointTexture();
  const disposables = [pointTexture];
  const tmpColor = new THREE.Color();
  const _v = new THREE.Vector3();

  /* -------- NEBULA --------------------------------------------------- */
  const nebulaMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      u_time: { value: 0 },
      u_aspect: { value: innerWidth / innerHeight },
      u_mouse: { value: new THREE.Vector2() }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float u_time; uniform float u_aspect; uniform vec2 u_mouse;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
      float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
      void main(){
        vec2 p = (vUv - 0.5); p.x *= u_aspect;
        float r = length(p);
        float n  = fbm(p*3.0 + u_time*0.015);
        float n2 = fbm(p*1.4 - u_time*0.008 + u_mouse * 0.6);
        vec3 col = vec3(0.012, 0.012, 0.018);
        vec3 violet  = vec3(0.18, 0.08, 0.32);
        vec3 cyan    = vec3(0.05, 0.18, 0.28);
        vec3 magenta = vec3(0.22, 0.06, 0.20);
        col += violet  * smoothstep(0.95, 0.0, r) * n  * 0.7;
        col += cyan    * smoothstep(0.7,  0.0, r) * n2 * 0.5;
        col += magenta * smoothstep(0.4,  0.0, r) * (0.4 + n);
        col *= smoothstep(1.3, 0.15, r);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const nebula = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), nebulaMat);
  nebula.renderOrder = -10;
  nebula.frustumCulled = false;
  scene.add(nebula);

  /* -------- STARS ---------------------------------------------------- */
  function makeStars(count, spread, size, alpha, accent = 0.04) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
      if (Math.random() < accent) {
        c.setHSL(Math.random(), 0.85, 0.5);
      } else {
        const gv = 0.4 + Math.random() * 0.35;
        c.setRGB(gv, gv, gv);
      }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      sz[i] = (0.5 + Math.random() * 1.5) * size;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    const m = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity: alpha,
      blending: THREE.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true, map: pointTexture
    });
    return new THREE.Points(g, m);
  }
  const layerFar  = makeStars(COUNT_FAR, 350, 0.18, 0.35);
  const layerMid  = makeStars(COUNT_MID, 200, 0.32, 0.55, 0.08);
  const layerNear = makeStars(COUNT_NEAR, 110, 0.6, 0.85, 0.15);
  const twinkle   = makeStars(COUNT_TWINKLE, 80, 0.9, 1.0, 0.4);
  scene.add(layerFar, layerMid, layerNear, twinkle);

  /* -------- 8 CONSTELLATIONS ---------------------------------------- */
  const constellations = new THREE.Group();
  const constData = [];
  const constLineColor = new THREE.Color();
  const constDotColor = new THREE.Color();
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2;
    const radius = 44;
    const center = new THREE.Vector3(
      Math.cos(ang) * radius,
      Math.sin(ang) * (radius * 0.55),
      -10 - Math.random() * 16
    );
    const nodes = 6 + Math.floor(Math.random() * 5);
    const pts = [];
    for (let n = 0; n < nodes; n++) {
      pts.push(new THREE.Vector3(
        center.x + (Math.random() - 0.5) * 10,
        center.y + (Math.random() - 0.5) * 8,
        center.z + (Math.random() - 0.5) * 5
      ));
    }
    // Per-constellation hue: 8 buckets around the wheel, HSL l=0.5.
    // Brightness comes from additive blending + opacity, NOT from lightness.
    const constHue = (k / 8) % 1;
    constLineColor.setHSL(constHue, 0.5, 0.5);
    constDotColor.setHSL(constHue, 0.5, 0.5);
    for (let s = 0; s < pts.length - 1; s++) {
      const seg = new THREE.BufferGeometry().setFromPoints([pts[s], pts[s + 1]]);
      const op = 0.14 + 0.18 * (1 - s / pts.length);
      const m = new THREE.LineBasicMaterial({
        color: constLineColor.clone(), transparent: true, opacity: op,
        blending: THREE.AdditiveBlending
      });
      constellations.add(new THREE.Line(seg, m));
    }
    const dg = new THREE.BufferGeometry().setFromPoints(pts);
    const dm = new THREE.PointsMaterial({
      color: constDotColor.clone(), size: 1.4, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
      map: pointTexture, sizeAttenuation: true
    });
    constellations.add(new THREE.Points(dg, dm));
    constData.push({ pts, center, phase: Math.random() * Math.PI * 2 });
  }
  scene.add(constellations);

  /* -------- SHOOTING STARS ------------------------------------------ */
  const shooters = [];
  for (let i = 0; i < SHOOT_POOL; i++) {
    const segs = 22;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(segs * 3), 3));
    const m = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(g, m);
    scene.add(line);
    shooters.push({
      line, g, m, segs,
      pos: g.attributes.position.array,
      col: g.attributes.color.array,
      alive: false, t0: 0, duration: 1.2,
      start: new THREE.Vector3(), end: new THREE.Vector3(), hue: 0
    });
  }
  function fireShooter(s, now) {
    s.t0 = now; s.alive = true;
    s.start.set(
      (Math.random() - 0.5) * 120,
      (Math.random() - 0.5) * 60 + 30,
      -20 - Math.random() * 20
    );
    s.end.set(
      s.start.x + (Math.random() - 0.5) * 60 - 40,
      s.start.y - 40 - Math.random() * 30,
      s.start.z + 10
    );
    s.hue = Math.random();
    s.duration = 1.0 + Math.random() * 0.6;
  }
  let nextShoot = 0;
  function updateShooters(now) {
    if (reduce) return;
    const cap = Math.max(0, runtimeCaps.shooters | 0);
    if (cap === 0) return;
    if (now > nextShoot) {
      // Only spawn if an unused shooter exists within the cap window.
      const s = shooters.slice(0, cap).find((x) => !x.alive);
      if (s) { fireShooter(s, now); nextShoot = now + 3 + Math.random() * 5; }
      else nextShoot = now + 1;
    }
    for (let idx = 0; idx < shooters.length; idx++) {
      const s = shooters[idx];
      if (idx >= cap) {
        // Beyond runtime cap — make sure the line is invisible.
        if (s.alive) { s.alive = false; s.m.opacity = 0; }
        continue;
      }
      if (!s.alive) continue;
      const phase = (now - s.t0) / s.duration;
      if (phase > 1.4) { s.alive = false; s.m.opacity = 0; continue; }
      for (let i = 0; i < s.segs; i++) {
        const u = i / (s.segs - 1);
        const tail = Math.max(0, phase - u * 0.3);
        s.pos[i * 3]     = s.start.x + (s.end.x - s.start.x) * tail;
        s.pos[i * 3 + 1] = s.start.y + (s.end.y - s.start.y) * tail;
        s.pos[i * 3 + 2] = s.start.z + (s.end.z - s.start.z) * tail;
        const head = Math.max(0, 1 - Math.abs(u - 0.2) * 3);
        tmpColor.setHSL(s.hue, 0.9, 0.5);
        s.col[i * 3]     = tmpColor.r * head;
        s.col[i * 3 + 1] = tmpColor.g * head;
        s.col[i * 3 + 2] = tmpColor.b * head;
      }
      s.g.attributes.position.needsUpdate = true;
      s.g.attributes.color.needsUpdate = true;
      s.m.opacity = phase < 1 ? 1 : Math.max(0, 1 - (phase - 1) * 3);
    }
  }

  /* -------- LIGHT BRIDGES ------------------------------------------- */
  const bridges = [];
  for (let i = 0; i < BRIDGE_POOL; i++) {
    const segments = 60;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(segments * 3), 3));
    const m = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(g, m);
    scene.add(line);
    bridges.push({
      line, g, m, segments,
      arr: g.attributes.position.array,
      col: g.attributes.color.array,
      t0: -10 - i * 0.6, from: 0, to: 1, hue: 0
    });
  }
  function fireBridge(b, now) {
    b.from = Math.floor(Math.random() * constData.length);
    do { b.to = Math.floor(Math.random() * constData.length); } while (b.to === b.from);
    b.t0 = now;
    b.hue = Math.random();
  }
  function updateBridges(now) {
    const cap = Math.max(0, runtimeCaps.bridges | 0);
    for (let bi = 0; bi < bridges.length; bi++) {
      const b = bridges[bi];
      if (bi >= cap) {
        if (b.m.opacity > 0.001) b.m.opacity *= 0.92;
        continue;
      }
      const phase = now - b.t0;
      if (phase > 4) {
        if (Math.random() < 0.025) fireBridge(b, now);
        else { b.m.opacity *= 0.92; continue; }
      }
      const t = Math.min(phase / 2.0, 1);
      const a = constData[b.from].pts[0];
      const c = constData[b.to].pts[0];
      const midX = (a.x + c.x) / 2;
      const midY = (a.y + c.y) / 2 + 14;
      const midZ = (a.z + c.z) / 2 - 8;
      for (let s = 0; s < b.segments; s++) {
        const u = s / (b.segments - 1);
        const om = 1 - u;
        b.arr[s * 3]     = om * om * a.x + 2 * om * u * midX + u * u * c.x;
        b.arr[s * 3 + 1] = om * om * a.y + 2 * om * u * midY + u * u * c.y;
        b.arr[s * 3 + 2] = om * om * a.z + 2 * om * u * midZ + u * u * c.z;
        const head = Math.max(0, 1 - Math.abs(u - t) * 8);
        const trail = Math.max(0, 1 - Math.max(0, t - u) * 2);
        const intensity = Math.max(head, trail * 0.4);
        tmpColor.setHSL(b.hue, 0.95, 0.5);
        b.col[s * 3]     = tmpColor.r * intensity;
        b.col[s * 3 + 1] = tmpColor.g * intensity;
        b.col[s * 3 + 2] = tmpColor.b * intensity;
      }
      b.g.attributes.position.needsUpdate = true;
      b.g.attributes.color.needsUpdate = true;
      b.m.opacity = Math.min(1, b.m.opacity + 0.06);
      if (t >= 1 && phase > 2.5) b.m.opacity *= 0.93;
    }
  }
  bridges.forEach((b, i) => fireBridge(b, -i * 1.5));

  /* -------- LOGO HOLO SPHERE ---------------------------------------- */
  const logoMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      u_time: { value: 0 },
      u_pulse: { value: 0 },
      u_phase: { value: 0 }
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vP; varying float vDisp;
      uniform float u_time; uniform float u_pulse;
      void main(){
        vN = normalize(normalMatrix * normal);
        vec3 p = position;
        float w = sin(p.y * 3.0 + u_time * 1.4) * 0.06
                + sin(p.x * 2.0 + u_time * 1.1) * 0.05
                + sin(p.z * 4.0 + u_time * 0.7) * 0.04;
        float disp = w + u_pulse * 0.5;
        p += normal * disp;
        vDisp = disp; vP = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vP; varying float vDisp;
      uniform float u_time; uniform float u_pulse; uniform float u_phase;
      void main(){
        float fres = pow(1.0 - max(dot(vN, vec3(0,0,1)), 0.0), 2.0);
        float h = mod(u_phase + vP.y * 0.06 + u_time * 0.08, 1.0);
        vec3 gray = vec3(0.5);
        vec3 rainbow;
        rainbow.r = 0.5 + 0.5 * sin(h * 6.2831);
        rainbow.g = 0.5 + 0.5 * sin(h * 6.2831 + 2.094);
        rainbow.b = 0.5 + 0.5 * sin(h * 6.2831 + 4.188);
        vec3 col = mix(gray, rainbow, fres * 0.75 + u_pulse * 0.6 + abs(vDisp) * 0.8);
        float alpha = fres * 0.9 + 0.06 + u_pulse * 0.2;
        gl_FragColor = vec4(col, alpha);
      }`
  });
  const logoSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 5), logoMat);
  scene.add(logoSphere);

  /* -------- CIRCULATION RINGS --------------------------------------- */
  const rings = new THREE.Group();
  for (let r = 0; r < 4; r++) {
    const radius = 5.5 + r * 1.6;
    const segs = RING_SEGS;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(segs * 3);
    const col = new Float32Array(segs * 3);
    const c = new THREE.Color();
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pos[i * 3]     = Math.cos(a) * radius;
      pos[i * 3 + 1] = Math.sin(a) * radius;
      pos[i * 3 + 2] = 0;
      if (i % 12 === 0) c.setHSL((i / segs + r * 0.16) % 1, 0.9, 0.5);
      else { const g = 0.7; c.setRGB(g, g, g); }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({
      vertexColors: true, size: 0.22 - r * 0.025,
      transparent: true, opacity: 0.7 - r * 0.13,
      blending: THREE.AdditiveBlending, map: pointTexture, sizeAttenuation: true
    });
    const p = new THREE.Points(geo, m);
    p.rotation.x = (Math.random() - 0.5) * 0.7;
    p.rotation.y = (Math.random() - 0.5) * 0.4;
    p.rotation.z = (Math.random() - 0.5) * 0.7;
    rings.add(p);
  }
  scene.add(rings);

  /* -------- BURST RING (behavior shockwave) ------------------------- */
  const burst = (() => {
    const g = new THREE.RingGeometry(0.5, 0.55, 96);
    const m = new THREE.MeshBasicMaterial({
      // initial neutral grey; fireBurst overrides per-call to the canon color.
      color: 0x808088, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(g, m);
    scene.add(mesh);
    return { mesh, m, t0: -10 };
  })();
  // fireBurst debounce — WCAG 2.3.1 safety margin: collapse calls within 333ms.
  let lastBurstTime = -10;
  function fireBurst(color) {
    const now = performance.now() / 1000;
    if (now - lastBurstTime < 0.333) {
      // No-op for rapid repeats. Keeps flashes well under 3 / sec.
      return false;
    }
    lastBurstTime = now;
    burst.t0 = now;
    if (color != null) burst.m.color.set(color);
    burst.m.opacity = reduce ? 0.0 : 0.9;
    burst.mesh.scale.set(reduce ? 60 : 1, reduce ? 60 : 1, 1);
    return true;
  }

  /* -------- state --------------------------------------------------- */
  let activeScene = 'breathing';

  // Runtime caps — perf/transitions/logo-speech hooks can mutate these
  // each frame. shooter/bridge updates honor pool caps; twinkle / nebula
  // honor their toggles.
  const runtimeCaps = {
    shooters: SHOOT_POOL,
    bridges: BRIDGE_POOL,
    ringRotateRate: 1.0,
    twinkleEnabled: true,
    nebulaIntensity: 1.0
  };

  /* -------- update -------------------------------------------------- */
  function update(time, ctx = {}) {
    // nebula — intensity scaled via material opacity for runtime control.
    nebulaMat.uniforms.u_time.value = time;
    if (ctx.mouseNDC) {
      nebulaMat.uniforms.u_mouse.value.copy(ctx.mouseNDC);
    }
    const ni = Math.max(0, Math.min(1.5, runtimeCaps.nebulaIntensity ?? 1.0));
    if (nebulaMat.opacity !== ni || nebulaMat.transparent !== (ni < 1.0)) {
      nebulaMat.opacity = ni;
      nebulaMat.transparent = ni < 1.0;
      nebulaMat.needsUpdate = nebulaMat.transparent;
    }

    // stars
    layerFar.rotation.y  = time * 0.005;
    layerMid.rotation.y  = time * 0.012;
    layerNear.rotation.y = time * 0.02;
    if (runtimeCaps.twinkleEnabled) {
      twinkle.visible = true;
      twinkle.material.size = 0.7 + Math.sin(time * 3) * 0.3;
      twinkle.rotation.z = time * 0.01;
    } else {
      twinkle.visible = false;
    }

    // constellations
    constellations.rotation.z = Math.sin(time * 0.04) * 0.06;
    constellations.rotation.y = time * 0.005;

    // bridges
    updateBridges(time);

    // shooters
    updateShooters(time);

    // logo
    logoMat.uniforms.u_time.value = time;
    logoMat.uniforms.u_phase.value = time * 0.05;
    const pulsing = activeScene === 'ring' || activeScene === 'glyph' || activeScene === 'speaking';
    logoMat.uniforms.u_pulse.value = pulsing
      ? (0.5 + 0.5 * Math.sin(time * 4))
      : 0.05 * Math.sin(time * 1.3);
    logoSphere.rotation.y = time * 0.18;
    logoSphere.rotation.x = Math.sin(time * 0.1) * 0.25;

    // rings
    const rrate = runtimeCaps.ringRotateRate ?? 1.0;
    rings.children.forEach((r, idx) => {
      r.rotation.z = time * (0.06 + idx * 0.04) * rrate;
      r.rotation.y = Math.sin(time * 0.07 + idx) * 0.3;
    });

    // burst
    const bp = time - burst.t0;
    if (bp < 1.5 && burst.m.opacity > 0.01) {
      const s = 1 + bp * 60;
      burst.mesh.scale.set(s, s, 1);
      burst.m.opacity = Math.max(0, 0.9 * (1 - bp / 1.5));
    }

    // aspect (cheap, no resize listener needed here)
    const a = innerWidth / innerHeight;
    if (Math.abs(nebulaMat.uniforms.u_aspect.value - a) > 0.001) {
      nebulaMat.uniforms.u_aspect.value = a;
    }
  }

  function setActiveScene(state) {
    activeScene = state || 'breathing';
  }
  function getActiveScene() {
    return activeScene;
  }

  // Return n random points from constData (for inter-phase transitions
  // morph targets). Each entry is a {x,y,z} object cloned from a constellation
  // node so callers may mutate freely. GC-light path: shared scratch when n=1.
  function sampleConstellationPts(n) {
    const out = [];
    const k = Math.max(0, n | 0);
    if (k === 0 || constData.length === 0) return out;
    for (let i = 0; i < k; i++) {
      const c = constData[Math.floor(Math.random() * constData.length)];
      const p = c.pts[Math.floor(Math.random() * c.pts.length)];
      out.push({ x: p.x, y: p.y, z: p.z });
    }
    return out;
  }

  function dispose() {
    [nebula, layerFar, layerMid, layerNear, twinkle, constellations,
     logoSphere, rings, burst.mesh].forEach(disposeObject);
    shooters.forEach((s) => disposeObject(s.line));
    bridges.forEach((b) => disposeObject(b.line));
    disposables.forEach((d) => d.dispose?.());
  }

  return {
    update,
    setActiveScene,
    getActiveScene,
    sampleConstellationPts,
    runtimeCaps,
    dispose,
    fireBurst,
    constData,
    // expose for behavior engine if needed
    nebula, logoSphere, rings, constellations,
    layers: { far: layerFar, mid: layerMid, near: layerNear, twinkle }
  };
}
