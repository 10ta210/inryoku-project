/**
 * p3_logo_pointcloud.js — 中央ロゴを「本物の3D点群ホログラム」に (P3専用 / 案B)
 *
 * 司さん (2026-05-25):「ホログラム案B(真3D点群ロゴ)を最高クオリティで」
 *
 * 哲学: i (自己/コア) も o (宇宙) も同じ粒でできている。
 *   → ロゴを PNG/ソリッド球ではなく、回転する3D点群で構成する。
 *
 * 構成 (単一 Points + 単一 ShaderMaterial = 1 draw call):
 *   - 殻 (egg shell)  : 卵型 ellipsoid 表面のシルバー粒子 (透ける aura)
 *   - 核 (core)       : 上部の RGBCMY 高密度球 (呼吸する光源)
 *   - 尖塔 (spire)    : 核から下へ伸びる i の身体 (細い粒子の柱)
 *
 * 既存 init3DLogoSphere / PNG は削除しない:
 *   - .logo-shell / .logo-sphere / .logo-3d-canvas を opacity:0 で裏へ退ける
 *   - #bb-logo の click(粒子吸収)はそのまま (canvas は pointer-events:none)
 *
 * 連動: 服選択中 (.hologram-logo.field-hot) は核が強く脈動。
 * 無効化: ?logo3d=0
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.__p3LogoPointCloud) return;

  try {
    // 2026-05-30 司「ロゴ PNG に戻して」: 点群ロゴはデフォルト OFF。
    //   復活は ?logo3d=1。通常は既存 PNG / 卵ロゴをそのまま使う。
    if (!/[?&]logo3d=1/.test(location.search)) return;
    if (/[?&]avatar=1/.test(location.search)) return;
    var path = location.pathname;
    if (!/index\.html?$|p3_test\.html?$|^\/$/.test(path)) return;
  } catch (e) {}

  function pickCounts() {
    var mob = false, rm = false;
    try {
      mob = /iPhone|iPad|Android|Mobi/i.test(navigator.userAgent) ||
            (window.innerWidth < 720 && 'ontouchstart' in window);
      rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (rm)  return { shell: 1400, core: 800,  spire: 300 };
    if (mob) return { shell: 1800, core: 1000, spire: 380 };
    return     { shell: 3200, core: 1700, spire: 620 };
  }

  var VERT = /* glsl */`
    attribute float aType;   // 0 殻 / 1 核 / 2 尖塔
    attribute float aSeed;
    attribute float aHue;
    uniform float uTime;
    uniform float uPulse;    // 0..1 連動脈動
    uniform float uSize;
    varying vec3  vCol;
    varying float vA;
    void main() {
      vec3 p = position;
      float breath = sin(uTime * 1.1 + aSeed * 6.2831) * 0.5 + 0.5;
      // 核は呼吸 + 連動で膨らむ
      if (aType > 0.5 && aType < 1.5) p *= 1.0 + breath * 0.05 + uPulse * 0.10;
      // 殻はわずかに揺らぐ (生きてる aura)
      if (aType < 0.5) p += normalize(p) * (sin(uTime * 0.8 + aSeed * 9.0) * 0.012);

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float depth = -mv.z;

      float base = (aType > 0.5 && aType < 1.5) ? 2.6 : (aType > 1.5 ? 1.9 : 1.5);
      gl_PointSize = base * uSize * (3.2 / max(0.5, depth));

      vec3 silver  = vec3(0.60, 0.68, 0.82);
      vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (aHue + vec3(0.0, 0.33, 0.67)));
      if (aType < 0.5) {            // 殻: 淡いシルバー(虹ほのか)
        vCol = mix(silver, rainbow, 0.22);
        vA = 0.45;
      } else if (aType < 1.5) {     // 核: RGBCMY 全開
        vCol = rainbow;
        vA = 0.92 + uPulse * 0.08;
      } else {                      // 尖塔: 中間
        vCol = mix(silver, rainbow, 0.5);
        vA = 0.6;
      }
      // 奥行きフェード (後ろの粒は暗く = 立体に見える)
      vA *= clamp(1.0 - (depth - 2.8) * 0.28, 0.22, 1.0);
    }
  `;

  var FRAG = /* glsl */`
    precision mediump float;
    varying vec3  vCol;
    varying float vA;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      float a = smoothstep(0.5, 0.12, d);
      if (a < 0.01) discard;
      gl_FragColor = vec4(vCol, a * vA);
    }
  `;

  function build(THREE) {
    if (window.__p3LogoPointCloud) return;
    var wrap = document.querySelector('.logo-holo-wrap');
    if (!wrap) return false;

    var W = wrap.clientWidth || 140;
    var H = wrap.clientHeight || 198;
    if (W < 8 || H < 8) return false;

    // 既存ロゴ(PNG / 旧3D球canvas)を裏へ退ける
    function dimOld() {
      ['.logo-shell', '.logo-sphere', '.logo-3d-canvas'].forEach(function (sel) {
        var el = wrap.querySelector(sel);
        if (el) { el.style.transition = 'opacity .6s ease'; el.style.opacity = '0'; }
      });
    }
    dimOld();
    // init3DLogoSphere が後から opacity を戻す場合に備え数回再適用
    var dimTries = 0;
    var dimIv = setInterval(function () { dimOld(); if (++dimTries > 8) clearInterval(dimIv); }, 400);

    var canvas = document.createElement('canvas');
    canvas.className = 'logo-pointcloud-canvas';
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    wrap.appendChild(canvas);

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 50);
    cam.position.set(0, 0, 3.6);
    cam.lookAt(0, 0, 0);

    var C = pickCounts();
    var N = C.shell + C.core + C.spire;
    var pos = new Float32Array(N * 3);
    var aType = new Float32Array(N);
    var aSeed = new Float32Array(N);
    var aHue = new Float32Array(N);

    var i = 0, k;
    // ── 殻: 卵型 ellipsoid 表面 ──
    var EGG_A = 0.66, EGG_B = 1.02;   // 横半径 / 縦半径
    for (k = 0; k < C.shell; k++, i++) {
      var phi = Math.acos(2 * Math.random() - 1);     // 0..pi
      var th = Math.random() * Math.PI * 2;
      var sinp = Math.sin(phi);
      // 卵の非対称: 上(phi小)を細く
      var aMod = EGG_A * (1.0 - 0.22 * Math.cos(phi));
      pos[i * 3]     = aMod * sinp * Math.cos(th);
      pos[i * 3 + 1] = EGG_B * Math.cos(phi) + 0.05;
      pos[i * 3 + 2] = aMod * sinp * Math.sin(th);
      aType[i] = 0;
      aSeed[i] = Math.random();
      aHue[i] = Math.random();
    }
    // ── 核: 上部の RGBCMY 球 ──
    var CORE_R = 0.30, CORE_Y = 0.34;
    for (k = 0; k < C.core; k++, i++) {
      var ph2 = Math.acos(2 * Math.random() - 1);
      var th2 = Math.random() * Math.PI * 2;
      var rr = CORE_R * Math.cbrt(Math.random());      // 体積一様
      var sp2 = Math.sin(ph2);
      pos[i * 3]     = rr * sp2 * Math.cos(th2);
      pos[i * 3 + 1] = rr * Math.cos(ph2) + CORE_Y;
      pos[i * 3 + 2] = rr * sp2 * Math.sin(th2);
      aType[i] = 1;
      aSeed[i] = Math.random();
      // 核は位置で虹 (球面で色が回る)
      aHue[i] = (Math.atan2(pos[i * 3 + 2], pos[i * 3]) / (Math.PI * 2)) + 0.5;
    }
    // ── 尖塔: 核から下へ伸びる i の身体 ──
    for (k = 0; k < C.spire; k++, i++) {
      var tt = Math.random();                           // 0(上)→1(下)
      var y = CORE_Y - 0.18 - tt * 1.00;
      var rad = 0.05 + tt * 0.10;
      var ang = Math.random() * Math.PI * 2;
      var rr3 = rad * Math.sqrt(Math.random());
      pos[i * 3]     = rr3 * Math.cos(ang);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = rr3 * Math.sin(ang);
      aType[i] = 2;
      aSeed[i] = Math.random();
      aHue[i] = 0.55 + Math.random() * 0.3;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aType', new THREE.BufferAttribute(aType, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    geo.setAttribute('aHue', new THREE.BufferAttribute(aHue, 1));
    geo.computeBoundingSphere();

    var uniforms = {
      uTime:  { value: 0 },
      uPulse: { value: 0 },
      uSize:  { value: 1.0 * dpr },
    };
    var mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // マウス視差
    var mx = 0, my = 0, tmx = 0, tmy = 0;
    window.addEventListener('pointermove', function (e) {
      var r = wrap.getBoundingClientRect();
      tmx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5);
      tmy = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5);
    });

    // 服選択中の連動脈動 (.hologram-logo.field-hot)
    var holo = document.querySelector('.hologram-logo');
    var pulseTarget = 0;

    var alive = true;
    var t0 = performance.now();
    function loop(now) {
      if (!alive) return;
      var t = (now - t0) / 1000;
      uniforms.uTime.value = t;
      pulseTarget = (holo && holo.classList.contains('field-hot')) ? 1 : 0;
      uniforms.uPulse.value += (pulseTarget - uniforms.uPulse.value) * 0.08;
      mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
      points.rotation.y = t * 0.28 + mx * 0.5;     // 自転 + マウス
      points.rotation.x = my * 0.3;
      renderer.render(scene, cam);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function onResize() {
      var w = wrap.clientWidth || 140, h = wrap.clientHeight || 198;
      renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    window.__p3LogoPointCloud = {
      points: points, renderer: renderer, uniforms: uniforms,
      dispose: function () {
        alive = false; clearInterval(dimIv);
        try { geo.dispose(); mat.dispose(); renderer.dispose(); canvas.remove(); } catch (e) {}
        window.__p3LogoPointCloud = null;
      },
    };
    console.info('[p3_logo_pointcloud] 3D point-cloud logo ready (案B)');
    return true;
  }

  function boot() {
    if (typeof window.THREE === 'undefined' || !window.THREE.WebGLRenderer) return false;
    var tries = 0;
    var iv = setInterval(function () {
      try { if (build(window.THREE) || ++tries > 50) clearInterval(iv); }
      catch (e) { console.warn('[p3_logo_pointcloud]', e); clearInterval(iv); }
    }, 250);
    return true;
  }
  if (!boot()) window.addEventListener('threeAddonsReady', boot, { once: true });
})();
