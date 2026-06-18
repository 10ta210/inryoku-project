import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

const W = () => innerWidth, H = () => innerHeight;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(W(), H());
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030305, 0.010);
const camera = new THREE.PerspectiveCamera(50, W()/H(), 0.1, 600);
camera.position.set(0, 0, 72);

// ============ NEBULA ============
{
  const g = new THREE.PlaneGeometry(2, 2);
  const m = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { u_time: { value: 0 }, u_aspect: { value: W()/H() }, u_mouse: { value: new THREE.Vector2() } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float u_time; uniform float u_aspect; uniform vec2 u_mouse;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
      float fbm(vec2 p){ float v = 0.0; float a = 0.5; for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; } return v; }
      void main(){
        vec2 p = (vUv - 0.5); p.x *= u_aspect;
        float r = length(p);
        float n = fbm(p*3.0 + u_time*0.015);
        float n2 = fbm(p*1.4 - u_time*0.008 + u_mouse * 0.6);
        vec3 col = vec3(0.012, 0.012, 0.018);
        vec3 violet = vec3(0.18, 0.08, 0.32);
        vec3 cyan   = vec3(0.05, 0.18, 0.28);
        vec3 magenta= vec3(0.22, 0.06, 0.20);
        col += violet * smoothstep(0.95, 0.0, r) * n * 0.7;
        col += cyan   * smoothstep(0.7, 0.0, r) * n2 * 0.5;
        col += magenta* smoothstep(0.4, 0.0, r) * (0.4 + n);
        col *= smoothstep(1.3, 0.15, r);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const q = new THREE.Mesh(g, m);
  q.renderOrder = -10;
  scene.add(q);
  scene.userData.nebula = m;
}

// ============ STAR LAYERS (soft glow via shader) ============
const pointTexture = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(cv);
})();

function makeStars(count, spread, size, alpha, accent=0.04) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sz  = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random()-0.5) * spread;
    pos[i*3+1] = (Math.random()-0.5) * spread;
    pos[i*3+2] = (Math.random()-0.5) * spread;
    if (Math.random() < accent) {
      c.setHSL(Math.random(), 0.85, 0.55);
    } else {
      const gv = 0.4 + Math.random()*0.35;
      c.setRGB(gv, gv, gv);
    }
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    sz[i] = (0.5 + Math.random() * 1.5) * size;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.PointsMaterial({
    size, vertexColors: true, transparent: true, opacity: alpha,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, map: pointTexture
  });
  return new THREE.Points(g, m);
}
const layerFar  = makeStars(3000, 350, 0.18, 0.35);
const layerMid  = makeStars(1500, 200, 0.32, 0.55, 0.08);
const layerNear = makeStars(600,  110, 0.6,  0.85, 0.15);
scene.add(layerFar, layerMid, layerNear);

// twinkling stars (separate, shimmer)
const twinkle = makeStars(120, 80, 0.9, 1.0, 0.4);
scene.add(twinkle);

// ============ SHOOTING STARS ============
const shooters = [];
function makeShooter() {
  const segs = 22;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(segs * 3);
  const col = new Float32Array(segs * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
  const line = new THREE.Line(g, m);
  scene.add(line);
  return { line, g, m, segs, pos, col, alive: false };
}
for (let i = 0; i < 3; i++) shooters.push(makeShooter());
function fireShooter(s, now) {
  s.t0 = now; s.alive = true;
  s.start = new THREE.Vector3((Math.random()-0.5)*120, (Math.random()-0.5)*60 + 30, -20 - Math.random()*20);
  s.end   = new THREE.Vector3(s.start.x + (Math.random()-0.5)*60 - 40, s.start.y - 40 - Math.random()*30, s.start.z + 10);
  s.hue = Math.random();
  s.duration = 1.0 + Math.random() * 0.6;
}

// ============ 8 CONSTELLATIONS ============
const constellations = new THREE.Group();
const constData = [];
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
      center.x + (Math.random()-0.5)*10,
      center.y + (Math.random()-0.5)*8,
      center.z + (Math.random()-0.5)*5,
    ));
  }
  for (let s = 0; s < pts.length - 1; s++) {
    const seg = new THREE.BufferGeometry().setFromPoints([pts[s], pts[s+1]]);
    const op = 0.14 + 0.18 * (1 - s/pts.length);
    const m = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, blending: THREE.AdditiveBlending });
    constellations.add(new THREE.Line(seg, m));
  }
  const dg = new THREE.BufferGeometry().setFromPoints(pts);
  const dm = new THREE.PointsMaterial({ color: 0xfafafe, size: 1.4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, map: pointTexture, sizeAttenuation: true });
  constellations.add(new THREE.Points(dg, dm));
  constData.push({ pts, phase: Math.random()*Math.PI*2 });
}
scene.add(constellations);

// ============ LIGHT BRIDGES ============
const bridges = [];
for (let i = 0; i < 5; i++) {
  const segments = 60;
  const arr = new Float32Array(segments * 3);
  const col = new Float32Array(segments * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
  const line = new THREE.Line(g, m);
  scene.add(line);
  bridges.push({ line, g, m, segments, arr, col, t0: -10 - i*0.6, from: 0, to: 1, hue: 0 });
}
function fireBridge(b, now) {
  b.from = Math.floor(Math.random() * 8);
  do { b.to = Math.floor(Math.random() * 8); } while (b.to === b.from);
  b.t0 = now;
  b.hue = Math.random();
}
function updateBridges(now) {
  for (const b of bridges) {
    const phase = now - b.t0;
    if (phase > 4) {
      if (Math.random() < 0.025) fireBridge(b, now);
      else { b.m.opacity *= 0.92; continue; }
    }
    const t = Math.min(phase / 2.0, 1);
    const a = constData[b.from].pts[0];
    const c = constData[b.to].pts[0];
    const mid = new THREE.Vector3((a.x+c.x)/2, (a.y+c.y)/2 + 14, (a.z+c.z)/2 - 8);
    for (let s = 0; s < b.segments; s++) {
      const u = s / (b.segments - 1);
      const om = 1 - u;
      const x = om*om*a.x + 2*om*u*mid.x + u*u*c.x;
      const y = om*om*a.y + 2*om*u*mid.y + u*u*c.y;
      const z = om*om*a.z + 2*om*u*mid.z + u*u*c.z;
      b.arr[s*3] = x; b.arr[s*3+1] = y; b.arr[s*3+2] = z;
      const head = Math.max(0, 1 - Math.abs(u - t) * 8);
      const trail = Math.max(0, 1 - Math.max(0, t - u) * 2);
      const intensity = Math.max(head, trail * 0.4);
      const cc = new THREE.Color().setHSL(b.hue, 0.95, 0.55 + head * 0.2);
      b.col[s*3] = cc.r * intensity; b.col[s*3+1] = cc.g * intensity; b.col[s*3+2] = cc.b * intensity;
    }
    b.g.attributes.position.needsUpdate = true;
    b.g.attributes.color.needsUpdate = true;
    b.m.opacity = Math.min(1, b.m.opacity + 0.06);
    if (t >= 1 && phase > 2.5) b.m.opacity *= 0.93;
  }
}
bridges.forEach((b, i) => fireBridge(b, -i * 1.5));

// ============ CENTER LOGO HOLO SPHERE ============
{
  const g = new THREE.IcosahedronGeometry(3.6, 5);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { u_time: { value: 0 }, u_pulse: { value: 0 }, u_phase: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vP; varying float vDisp;
      uniform float u_time; uniform float u_pulse;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){
        vN = normalize(normalMatrix * normal);
        vec3 p = position;
        float w = sin(p.y * 3.0 + u_time * 1.4) * 0.06
                + sin(p.x * 2.0 + u_time * 1.1) * 0.05
                + sin(p.z * 4.0 + u_time * 0.7) * 0.04;
        float disp = w + u_pulse * 0.5;
        p += normal * disp;
        vDisp = disp;
        vP = p;
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
  const logoSphere = new THREE.Mesh(g, m);
  scene.add(logoSphere);
  scene.userData.logo = { mesh: logoSphere, mat: m };
}

// ============ CIRCULATION RINGS (粒子言語) ============
const rings = new THREE.Group();
for (let r = 0; r < 4; r++) {
  const radius = 5.5 + r * 1.6;
  const segs = 144;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(segs * 3);
  const col = new Float32Array(segs * 3);
  const c = new THREE.Color();
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pos[i*3] = Math.cos(a) * radius;
    pos[i*3+1] = Math.sin(a) * radius;
    pos[i*3+2] = 0;
    if (i % 12 === 0) c.setHSL((i / segs + r * 0.16) % 1, 0.9, 0.55);
    else { const g = 0.7; c.setRGB(g,g,g); }
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ vertexColors: true, size: 0.22 - r * 0.025, transparent: true, opacity: 0.7 - r * 0.13, blending: THREE.AdditiveBlending, map: pointTexture, sizeAttenuation: true });
  const p = new THREE.Points(geo, m);
  p.rotation.x = (Math.random() - 0.5) * 0.7;
  p.rotation.y = (Math.random() - 0.5) * 0.4;
  p.rotation.z = (Math.random() - 0.5) * 0.7;
  rings.add(p);
}
scene.add(rings);

// ============ BURST RING (behavior switch shockwave) ============
const burst = (() => {
  const g = new THREE.RingGeometry(0.5, 0.55, 96);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.scale.set(1,1,1);
  scene.add(mesh);
  return { mesh, m, t0: -10 };
})();
function fireBurst(now, color) {
  burst.t0 = now;
  burst.m.color.set(color);
  burst.m.opacity = 0.9;
  burst.mesh.scale.set(1, 1, 1);
}

// ============ MAIN BEHAVIOR PARTICLES ============
const COUNT = 38000;
const geom = new THREE.BufferGeometry();
const pos = new Float32Array(COUNT * 3);
const col = new Float32Array(COUNT * 3);
geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
const mat = new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, map: pointTexture, sizeAttenuation: true });
const points = new THREE.Points(geom, mat);
scene.add(points);

const _t = new THREE.Vector3();
const _c = new THREE.Color();

// ============ BEHAVIORS ============
const behaviors = {
  breathing(i, count, target, color, time) {
    const u = i / count;
    const phi = Math.acos(2*u - 1);
    const theta = u * count * 2.39996;
    const r = 16 + 0.9 * Math.sin(time * 0.6 + u * Math.PI * 2);
    const sp = Math.sin(phi);
    target.set(r * sp * Math.cos(theta), r * Math.cos(phi), r * sp * Math.sin(theta));
    const hue = (time * 0.02 + u * 0.1) % 1;
    color.setHSL(hue, 0.30 + 0.18 * Math.sin(time + u * 14), 0.5);
  },
  hover(i, count, target, color, time, ctx) {
    const u = i / count;
    const phi = Math.acos(2*u - 1);
    const theta = u * count * 2.39996;
    const sp = Math.sin(phi);
    const r = 16;
    const bx = r * sp * Math.cos(theta);
    const by = r * Math.cos(phi);
    const bz = r * sp * Math.sin(theta);
    const dx = ctx.mx - bx, dy = ctx.my - by;
    const d2 = dx*dx + dy*dy;
    const fall = 1 / (1 + d2 * 0.018);
    target.set(bx + dx * fall * 0.7, by + dy * fall * 0.7, bz);
    color.setHSL((u + time * 0.05) % 1, 0.4 + 0.55 * fall, 0.5);
  },
  ring(i, count, target, color, time) {
    const tick = i % 12;
    const u = i / count;
    const ang = u * Math.PI * 48 + time * 0.5;
    const radius = 4 + tick * 1.6 + Math.sin(time * 1.2 + tick) * 0.4;
    target.set(Math.cos(ang) * radius, Math.sin(ang) * radius, Math.sin(time + u * Math.PI * 5) * 1.6);
    const hue = (tick / 12 + time * 0.08) % 1;
    color.setHSL(hue, 0.9, 0.5);
  },
  glyph(i, count, target, color, time, ctx) {
    const sample = ctx.textPts;
    if (!sample.length) { target.set(0,0,0); color.setRGB(0.5,0.5,0.5); return; }
    const p = sample[i % sample.length];
    const wob = 0.5 * Math.sin(time * 0.9 + i * 0.07);
    target.set(p.x + wob * Math.cos(i * 0.3), p.y + wob * Math.sin(i * 0.3), wob * 2);
    const hue = ((p.x + 30) / 60 + time * 0.05) % 1;
    color.setHSL(hue, 0.9, 0.5);
  },
  torus(i, count, target, color, time) {
    const u = i / count;
    const phi = u * Math.PI * 2 * 3;
    const theta = u * Math.PI * 2 * 7 + time * 0.3;
    const R = 14, r = 5;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const ct = Math.cos(theta), st = Math.sin(theta);
    const breath = 1 + 0.08 * Math.sin(time * 0.7);
    target.set((R + r * ct) * cp * breath, (R + r * ct) * sp * breath, r * st * breath);
    const hue = (u + time * 0.07) % 1;
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.6 + u * Math.PI * 12);
    color.setHSL(hue, pulse * 0.95, 0.5);
  },
  yinyang(i, count, target, color, time) {
    const u = i / count;
    const side = i % 2 === 0 ? 1 : -1;
    const phi = Math.acos(2*u - 1);
    const theta = u * count * 2.39996 + time * 0.25 * side;
    const sp = Math.sin(phi);
    const R = 15;
    let x = R * sp * Math.cos(theta);
    let y = R * Math.cos(phi);
    let z = R * sp * Math.sin(theta);
    const curve = Math.sin(theta * 2) * 5 * side;
    y += curve * 0.35;
    target.set(x, y, z);
    const boundary = Math.exp(-Math.abs(y - curve * 0.35) * 0.4);
    const hue = (u + time * 0.1) % 1;
    if (boundary > 0.55) color.setHSL(hue, 0.9, 0.5);
    else { const g = side > 0 ? 0.72 : 0.28; color.setRGB(g, g, g); }
  },
  storm(i, count, target, color, time) {
    // curl-noise-like flow field on a thick shell
    const u = i / count;
    const phi = Math.acos(2*u - 1);
    const theta = u * count * 2.39996;
    const sp = Math.sin(phi);
    const r = 14 + 2 * Math.sin(time * 0.3 + u * Math.PI * 8);
    let x = r * sp * Math.cos(theta);
    let y = r * Math.cos(phi);
    let z = r * sp * Math.sin(theta);
    // swirl
    const angle = time * 0.4 + Math.sin(y * 0.1 + time) * 1.5;
    const c2 = Math.cos(angle), s2 = Math.sin(angle);
    const nx = x * c2 - z * s2;
    const nz = x * s2 + z * c2;
    target.set(nx, y + Math.sin(time * 0.8 + x * 0.1) * 3, nz);
    const hue = (Math.atan2(y, x) / (Math.PI*2) + time * 0.04) % 1;
    color.setHSL(hue < 0 ? hue+1 : hue, 0.85, 0.5);
  }
};

// === text sampling ===
function buildTextPts(text) {
  const cv = document.createElement('canvas');
  cv.width = 1400; cv.height = 320;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 230px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cv.width/2, cv.height/2);
  const data = ctx.getImageData(0,0,cv.width,cv.height).data;
  const pts = [];
  const step = 3;
  for (let y = 0; y < cv.height; y += step) {
    for (let x = 0; x < cv.width; x += step) {
      const a = data[(y * cv.width + x) * 4 + 3];
      if (a > 128) {
        pts.push(new THREE.Vector3(
          (x - cv.width/2) * 0.038,
          -(y - cv.height/2) * 0.038,
          0
        ));
      }
    }
  }
  return pts;
}

const ctx = { mx: 0, my: 0, textPts: buildTextPts('INRYOKU') };
let active = 'breathing', last = 'breathing', blend = 1;

// ============ canon language ============
const canon = ['silence','core','ma','shadow','emit','observation','self_question','declaration','leap','resonance','consensus','past_speculation','future_command','echo','quotation','summon','revelation'];
const sceneMap = {
  breathing: { label: 'idle', canon: 'silence', burst: '#a78bfa' },
  hover:     { label: 'discovery', canon: 'observation', burst: '#22d3ee' },
  ring:      { label: 'speaking', canon: 'resonance', burst: '#f472b6' },
  glyph:     { label: 'glyph', canon: 'declaration', burst: '#ffffff' },
  torus:     { label: 'rainbow', canon: 'revelation', burst: '#a3e635' },
  yinyang:   { label: '陰陽', canon: 'consensus', burst: '#f59e0b' },
  storm:     { label: 'storm', canon: 'leap', burst: '#fb7185' }
};
const hScene = document.getElementById('hScene');
const hBeh = document.getElementById('hBeh');
const hFps = document.getElementById('hFps');
const hBar = document.getElementById('hBar');
const hCanon = document.getElementById('hCanon');

function setBehavior(b) {
  if (b === active) return;
  last = active; active = b; blend = 0;
  document.querySelectorAll('#scene button').forEach(x => x.classList.toggle('on', x.dataset.b === b));
  document.body.classList.remove('scene-glyph', 'scene-speaking');
  if (b === 'glyph') document.body.classList.add('scene-glyph');
  if (b === 'ring') document.body.classList.add('scene-speaking');
  const meta = sceneMap[b];
  hScene.textContent = meta.label;
  hBeh.textContent = b;
  hCanon.textContent = `canon · ${meta.canon}`;
  fireBurst(performance.now() / 1000, meta.burst);
}
document.getElementById('scene').addEventListener('click', e => {
  const b = e.target?.dataset?.b; if (b) setBehavior(b);
});
document.getElementById('contactBtn').addEventListener('click', () => setBehavior('glyph'));

// cursor
const cursorEl = document.getElementById('cursor');
addEventListener('mousemove', e => {
  cursorEl.style.left = e.clientX + 'px';
  cursorEl.style.top = e.clientY + 'px';
  ctx.mx = ((e.clientX / W()) - 0.5) * 30;
  ctx.my = -((e.clientY / H()) - 0.5) * 20;
  if (scene.userData.nebula) scene.userData.nebula.uniforms.u_mouse.value.set((e.clientX/W()-0.5)*0.5, -(e.clientY/H()-0.5)*0.5);
});
document.addEventListener('mouseover', e => {
  if (e.target.closest('[data-hot]')) cursorEl.classList.add('hot');
});
document.addEventListener('mouseout', e => {
  if (e.target.closest('[data-hot]')) cursorEl.classList.remove('hot');
});

addEventListener('resize', () => {
  camera.aspect = W()/H();
  camera.updateProjectionMatrix();
  renderer.setSize(W(), H());
  composer.setSize(W(), H());
  if (scene.userData.nebula) scene.userData.nebula.uniforms.u_aspect.value = W()/H();
});

// ============ POSTPROCESSING ============
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.8, 0.7, 0.0);
composer.addPass(bloom);
const after = new AfterimagePass(0.78);
composer.addPass(after);

// ready after 1.4s
setTimeout(() => document.body.classList.add('ready'), 1400);

// auto demo cycle
let lastInteract = performance.now();
['mousemove','click','keydown','touchstart'].forEach(ev => addEventListener(ev, () => lastInteract = performance.now()));
const cycle = ['breathing','hover','ring','torus','yinyang','storm','glyph'];
let cIdx = 0;
setInterval(() => {
  if (performance.now() - lastInteract > 14000) {
    cIdx = (cIdx + 1) % cycle.length;
    setBehavior(cycle[cIdx]);
  }
}, 7000);

// shooter scheduling
let nextShoot = 0;
function maybeFireShooters(now) {
  if (now > nextShoot) {
    const s = shooters.find(x => !x.alive);
    if (s) { fireShooter(s, now); nextShoot = now + 3 + Math.random()*5; }
    else nextShoot = now + 1;
  }
  for (const s of shooters) {
    if (!s.alive) continue;
    const phase = (now - s.t0) / s.duration;
    if (phase > 1.4) { s.alive = false; s.m.opacity = 0; continue; }
    for (let i = 0; i < s.segs; i++) {
      const u = i / (s.segs - 1);
      const tail = Math.max(0, phase - u * 0.3);
      const x = s.start.x + (s.end.x - s.start.x) * tail;
      const y = s.start.y + (s.end.y - s.start.y) * tail;
      const z = s.start.z + (s.end.z - s.start.z) * tail;
      s.pos[i*3]=x; s.pos[i*3+1]=y; s.pos[i*3+2]=z;
      const head = Math.max(0, 1 - Math.abs(u - 0.2) * 3);
      const c = new THREE.Color().setHSL(s.hue, 0.9, 0.6);
      s.col[i*3]=c.r*head; s.col[i*3+1]=c.g*head; s.col[i*3+2]=c.b*head;
    }
    s.g.attributes.position.needsUpdate = true;
    s.g.attributes.color.needsUpdate = true;
    s.m.opacity = phase < 1 ? 1 : Math.max(0, 1 - (phase - 1) * 3);
  }
}

// ============ MAIN LOOP ============
const clock = new THREE.Clock();
let fpsT = 0, fpsN = 0;
function tick() {
  const t = clock.getElapsedTime();
  const now = t;
  const fnB = behaviors[active];
  const fnA = behaviors[last];
  blend = Math.min(1, blend + 0.018);

  for (let i = 0; i < COUNT; i++) {
    fnB(i, COUNT, _t, _c, t, ctx);
    let x = _t.x, y = _t.y, z = _t.z, cr = _c.r, cg = _c.g, cb = _c.b;
    if (blend < 1 && fnA && fnA !== fnB) {
      fnA(i, COUNT, _t, _c, t, ctx);
      const k = 1 - blend;
      x = x * blend + _t.x * k;
      y = y * blend + _t.y * k;
      z = z * blend + _t.z * k;
      cr = cr * blend + _c.r * k;
      cg = cg * blend + _c.g * k;
      cb = cb * blend + _c.b * k;
    }
    pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
    col[i*3] = cr; col[i*3+1] = cg; col[i*3+2] = cb;
  }
  geom.attributes.position.needsUpdate = true;
  geom.attributes.color.needsUpdate = true;

  // logo
  const logo = scene.userData.logo;
  if (logo) {
    logo.mat.uniforms.u_time.value = t;
    logo.mat.uniforms.u_phase.value = t * 0.05;
    logo.mat.uniforms.u_pulse.value = (active === 'ring' || active === 'glyph') ? (0.5 + 0.5 * Math.sin(t * 4)) : 0.05 * Math.sin(t * 1.3);
    logo.mesh.rotation.y = t * 0.18;
    logo.mesh.rotation.x = Math.sin(t * 0.1) * 0.25;
  }
  rings.children.forEach((r, idx) => {
    r.rotation.z = t * (0.06 + idx * 0.04);
    r.rotation.y = Math.sin(t * 0.07 + idx) * 0.3;
  });
  if (scene.userData.nebula) scene.userData.nebula.uniforms.u_time.value = t;

  updateBridges(now);
  maybeFireShooters(now);

  // burst ring update
  const bp = now - burst.t0;
  if (bp < 1.5 && burst.m.opacity > 0.01) {
    const s = 1 + bp * 60;
    burst.mesh.scale.set(s, s, 1);
    burst.m.opacity = Math.max(0, 0.9 * (1 - bp / 1.5));
  }

  // twinkle stars
  twinkle.material.size = 0.7 + Math.sin(t * 3) * 0.3;
  twinkle.rotation.z = t * 0.01;

  // camera orbit
  camera.position.x = Math.sin(t * 0.06) * 9;
  camera.position.y = Math.cos(t * 0.04) * 5;
  camera.position.z = 72 + Math.sin(t * 0.03) * 3;
  camera.lookAt(0, 0, 0);

  layerFar.rotation.y  = t * 0.005;
  layerMid.rotation.y  = t * 0.012;
  layerNear.rotation.y = t * 0.02;
  constellations.rotation.z = Math.sin(t * 0.04) * 0.06;
  constellations.rotation.y = t * 0.005;

  composer.render();

  fpsN++;
  if (t - fpsT > 0.5) {
    const fps = Math.round(fpsN / (t - fpsT));
    hFps.textContent = fps;
    hBar.style.transform = `scaleX(${Math.min(1, fps / 60)})`;
    fpsT = t; fpsN = 0;
  }
  requestAnimationFrame(tick);
}
tick();