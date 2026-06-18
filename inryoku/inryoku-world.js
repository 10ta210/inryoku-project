// inryoku-world.js
// First-person particle field — inRYOKU 裏ルート.
// Camera lives INSIDE a 100-unit sphere; mouse drag rotates the gaze.
// Perlin-ish slow drift on the field. Low-end safe via tier hints.
//
// ESM, no build. Three.js r160 (imported by caller / importmap).

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const SPHERE_RADIUS = 100;
const DEFAULT_COUNT = 50000;
const MID_COUNT     = 24000;
const LOW_COUNT     = 9000;

// RGBCMY palette — 白黒禁則
const PALETTE = [
  [1.00, 0.23, 0.23],
  [0.22, 1.00, 0.48],
  [0.23, 0.71, 1.00],
  [0.23, 0.94, 1.00],
  [1.00, 0.23, 0.81],
  [1.00, 0.90, 0.23],
];

function pickCount(tier, reduce) {
  if (reduce) return Math.min(LOW_COUNT, 6000);
  if (tier === 'low')    return LOW_COUNT;
  if (tier === 'medium') return MID_COUNT;
  return DEFAULT_COUNT;
}

// Cheap 3D value-noise — sufficient for slow drift.
function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi,        yf = y - yi,        zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  function lerp(a, b, t) { return a + (b - a) * t; }
  const n000 = hash3(xi, yi, zi),     n100 = hash3(xi+1, yi, zi);
  const n010 = hash3(xi, yi+1, zi),   n110 = hash3(xi+1, yi+1, zi);
  const n001 = hash3(xi, yi, zi+1),   n101 = hash3(xi+1, yi, zi+1);
  const n011 = hash3(xi, yi+1, zi+1), n111 = hash3(xi+1, yi+1, zi+1);
  const x00 = lerp(n000, n100, u), x10 = lerp(n010, n110, u);
  const x01 = lerp(n001, n101, u), x11 = lerp(n011, n111, u);
  const y0 = lerp(x00, x10, v), y1 = lerp(x01, x11, v);
  return lerp(y0, y1, w);
}

export function createInryokuWorld(opts = {}) {
  const container = opts.container || document.body;
  const reduce = opts.reduceMotion || (window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const tier = opts.tier || 'high';
  const count = pickCount(tier, reduce);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true,
    powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:0;display:block';
  container.appendChild(renderer.domElement);

  // Scene + first-person camera at sphere centre
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75,
    window.innerWidth / window.innerHeight, 0.1, SPHERE_RADIUS * 4);
  camera.position.set(0, 0, 0);

  // Particle geometry — distributed on a thick shell around the camera
  const positions  = new Float32Array(count * 3);
  const home       = new Float32Array(count * 3);  // drift anchor
  const colors     = new Float32Array(count * 3);
  const sizes      = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Sample inside a spherical shell [0.25R, 1.0R]
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi   = Math.acos(2 * v - 1);
    const r = SPHERE_RADIUS * (0.25 + 0.75 * Math.cbrt(Math.random()));
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    home[i*3]   = positions[i*3]   = x;
    home[i*3+1] = positions[i*3+1] = y;
    home[i*3+2] = positions[i*3+2] = z;

    const pal = PALETTE[i % PALETTE.length];
    // Slight brightness variance — but no white/black drift
    const k = 0.6 + Math.random() * 0.4;
    colors[i*3]   = pal[0] * k;
    colors[i*3+1] = pal[1] * k;
    colors[i*3+2] = pal[2] * k;

    sizes[i] = 0.4 + Math.random() * 1.6;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:  { value: 0 },
      uPxRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uPxRatio;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = max(0.001, -mv.z);
        gl_PointSize = size * uPxRatio * (160.0 / d);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r2 = dot(c, c);
        if (r2 > 0.25) discard;
        float a = smoothstep(0.25, 0.0, r2);
        gl_FragColor = vec4(vColor, a * 0.75);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // Gaze rotation — yaw/pitch driven by drag (no clicking actions).
  let yaw = 0, pitch = 0;
  let targetYaw = 0, targetPitch = 0;
  let dragging = false, dragX = 0, dragY = 0;

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    const p = e.touches ? e.touches[0] : e;
    dragX = p.clientX; dragY = p.clientY;
  }
  function onMove(e) {
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - dragX;
    const dy = p.clientY - dragY;
    dragX = p.clientX; dragY = p.clientY;
    targetYaw   -= dx * 0.0025;
    targetPitch -= dy * 0.0025;
    targetPitch = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, targetPitch));
  }
  function onUp() { dragging = false; }

  const surface = renderer.domElement;
  surface.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onUp);
  surface.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('touchmove',  onMove,  { passive: true });
  window.addEventListener('touchend',   onUp);

  // Even with no input, camera also drifts on a slow autonomous course.
  // This keeps the field alive when the user is still.
  const autoDriftAmp = reduce ? 0 : 0.04;

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mat.uniforms.uPxRatio.value = renderer.getPixelRatio();
  }
  window.addEventListener('resize', resize);

  // Animation loop
  let running = true;
  let last = performance.now();
  const posAttr = geo.getAttribute('position');
  const driftScale = reduce ? 0 : 1;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    const t = now * 0.001;
    mat.uniforms.uTime.value = t;

    // Gaze ease
    yaw   += (targetYaw   - yaw)   * 0.06;
    pitch += (targetPitch - pitch) * 0.06;

    // Auto-drift adds a tiny ongoing parallax even when still.
    const dy = Math.sin(t * 0.07) * autoDriftAmp;
    const dp = Math.cos(t * 0.05) * autoDriftAmp * 0.5;

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw + dy;
    camera.rotation.x = pitch + dp;

    if (driftScale > 0) {
      // Slow Perlin-ish drift on a subset of particles each frame (cheap LOD)
      const stride = (tier === 'low') ? 6 : (tier === 'medium' ? 3 : 2);
      const offset = (Math.floor(now * 0.06)) % stride;
      const arr = posAttr.array;
      const scale = 0.012;
      const amp = 1.6;
      for (let i = offset; i < count; i += stride) {
        const hx = home[i*3], hy = home[i*3+1], hz = home[i*3+2];
        const nx = vnoise(hx * scale,        hy * scale + t * 0.05, hz * scale) - 0.5;
        const ny = vnoise(hx * scale + 12.3, hy * scale,             hz * scale + t * 0.05) - 0.5;
        const nz = vnoise(hx * scale,        hy * scale - 7.7,       hz * scale + t * 0.05) - 0.5;
        arr[i*3]   = hx + nx * amp;
        arr[i*3+1] = hy + ny * amp;
        arr[i*3+2] = hz + nz * amp;
      }
      posAttr.needsUpdate = true;
    } else {
      // Reduce-motion: sparse twinkle via size variance only.
      // We still need *some* update so the field doesn't feel dead.
      const sAttr = geo.getAttribute('size');
      const sArr = sAttr.array;
      const twinkleStride = 200;
      const off = (Math.floor(now * 0.001)) % twinkleStride;
      for (let i = off; i < count; i += twinkleStride) {
        sArr[i] = 0.4 + (Math.sin(now * 0.0008 + i) * 0.5 + 0.5) * 1.6;
      }
      sAttr.needsUpdate = true;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function dispose() {
    running = false;
    surface.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    surface.removeEventListener('touchstart', onDown);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
    window.removeEventListener('resize', resize);
    geo.dispose(); mat.dispose();
    try { renderer.domElement.remove(); } catch (_) {}
    renderer.dispose();
  }

  // Project a 3D world point to screen coords (used by phrase engine).
  function projectToScreen(x, y, z, out) {
    const v = new THREE.Vector3(x, y, z);
    v.project(camera);
    out = out || {};
    out.x = (v.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    out.behind = v.z > 1 || v.z < -1;
    return out;
  }

  // Sample a particle position currently in front of the camera (within fov-ish cone).
  function pickAnchorInFront() {
    const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const arr = posAttr.array;
    let best = -1, bestDot = 0.55; // cos(~57deg) — generous
    const tmp = new THREE.Vector3();
    const tries = 32;
    for (let k = 0; k < tries; k++) {
      const i = (Math.random() * count) | 0;
      tmp.set(arr[i*3], arr[i*3+1], arr[i*3+2]);
      const len = tmp.length();
      if (len < 0.001) continue;
      const dot = (tmp.x * camDir.x + tmp.y * camDir.y + tmp.z * camDir.z) / len;
      if (dot > bestDot) { bestDot = dot; best = i; }
    }
    if (best < 0) {
      // fallback: a point in front of camera
      const p = camDir.multiplyScalar(SPHERE_RADIUS * 0.55);
      return { x: p.x, y: p.y, z: p.z };
    }
    return { x: arr[best*3], y: arr[best*3+1], z: arr[best*3+2] };
  }

  return {
    renderer, scene, camera, points,
    projectToScreen, pickAnchorInFront,
    dispose,
    get reduceMotion() { return reduce; },
    get count() { return count; },
  };
}

export default createInryokuWorld;
