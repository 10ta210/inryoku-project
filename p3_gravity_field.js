/**
 * p3_gravity_field.js — 「服の重力場」(P3 専用)
 *
 * 司さん確定デザイン (2026-05-25):
 *   商品カードを「カード」ではなく、服の周りに見えない引力・虹・粒子が
 *   宿る重力場にする。selected (中央/正面) カードの背面だけに、
 *   普段シルバーの粒子を漂わせ、タップ/ホバーで RGB/CMY に灯して
 *   中心へ吸い寄せる。
 *
 * 設計の肝:
 *   - per-card に renderer を 12 個置かない (即死)。
 *   - 画面空間の透明オーバーレイ canvas を 1 枚だけ。
 *   - 毎フレーム .carousel-item.carousel-front の getBoundingClientRect() を読み、
 *     その位置にだけ粒子場を描く (= 常に 1 カード分の描画)。
 *   - carousel の transform(translate3d/rotateY/scale)とは別レイヤなので競合ゼロ。
 *   - .carousel-item の position には一切触らない。
 *
 * 役割分担:
 *   - conic-gradient 虹背景 (p3_ec_polish.css) = 面の光
 *   - この粒子 = 引力 / 揺らぎ / 生命感 (上に薄く、服より目立たせない)
 *
 * 哲学: 普段グレー/シルバー → 選んだ服だけ虹 (グレーの中に虹が眠る、50%→101%)
 *
 * 無効化: ?gravity=0
 * 確認:   http://127.0.0.1:3000/p3_test.html
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.__p3GravityField) return;

  // ── 起動条件 ──
  try {
    if (/[?&]gravity=0/.test(location.search)) return;     // 明示 OFF
    if (/[?&]avatar=1/.test(location.search)) return;      // avatar debug 全画面とは排他
    var path = location.pathname;
    if (!/index\.html?$|p3_test\.html?$|^\/$/.test(path)) return; // P3 page のみ
  } catch (e) {}

  // ── パーティクル数 (軽量。常時 1 カード分しか描かない) ──
  function pickCount() {
    try {
      var mob = /iPhone|iPad|Android|Mobi/i.test(navigator.userAgent) ||
                (window.innerWidth < 720 && 'ontouchstart' in window);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 280;
      return mob ? 420 : 900;
    } catch (e) { return 600; }
  }

  // ── Shaders (画面空間 ortho、ピクセル座標) ──
  var VERT = /* glsl */`
    attribute vec2 aBase;   // 楕円内オフセット (-1..1)
    attribute float aSeed;  // 0..1 個体差
    attribute float aHue;   // 0..1 虹相

    uniform float uTime;
    uniform vec2  uCenter;  // 正面カード中心 (px)
    uniform vec2  uRadius;  // 楕円半径 rx, ry (px)
    uniform float uActive;  // 0..1 正面カード存在
    uniform float uColorMix;// 0..1 シルバー→虹
    uniform float uGather;  // 0..1 中心への吸着 (hover/tap)
    uniform float uSize;

    varying vec3  vColor;
    varying float vA;

    void main() {
      vec2 off = aBase;

      // ゆっくりした渦の漂い (引力場の揺らぎ)
      float ang = uTime * 0.16 + aSeed * 6.2831;
      off += vec2(cos(ang), sin(ang)) * 0.045 * (0.4 + aSeed);

      // P2: hover/tap で服の輪郭(楕円の縁)へ吸い寄せ → 光る輪郭を形成
      vec2 dir = normalize(off + vec2(0.0001, 0.0001));
      vec2 rim = dir * (0.98 + 0.06 * sin(uTime * 1.6 + aSeed * 6.2831));
      off = mix(off, rim, uGather * 0.78);
      off *= mix(1.0, 0.90, uGather);   // 全体も少し締める

      // 呼吸 (場が脈動)
      float br = 1.0 + sin(uTime * 0.8 + aSeed * 6.2831) * 0.05;

      vec2 pos = uCenter + off * uRadius * br;

      // 色: 普段シルバー → 選択で RGB/CMY (per-particle hue でグレーの中の虹)
      vec3 silver  = vec3(0.70, 0.74, 0.80);
      vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (aHue + vec3(0.0, 0.33, 0.67)));
      vColor = mix(silver, rainbow, uColorMix);

      // 中心ほど濃く (服の輪郭内に集まる印象) + tap 時は輪郭が光る
      float edge = smoothstep(1.15, 0.15, length(off));
      float rimGlow = smoothstep(0.82, 1.02, length(off)) * uGather; // 縁の発光
      vA = uActive * (0.20 + 0.50 * aSeed) * (0.35 + 0.65 * edge);
      vA += rimGlow * 0.45;                          // 輪郭をはっきり
      vA *= (1.0 + uGather * 0.5);                   // tap 中は全体も明るく

      gl_PointSize = uSize * (0.55 + aSeed) * (1.0 + uGather * 0.7 + rimGlow * 0.6);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
    }
  `;

  var FRAG = /* glsl */`
    precision mediump float;
    varying vec3  vColor;
    varying float vA;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      float a = smoothstep(0.5, 0.18, d);
      if (a < 0.01) discard;
      gl_FragColor = vec4(vColor, a * vA * 0.55);
    }
  `;

  function start(THREE) {
    if (window.__p3GravityField) return;

    // ── オーバーレイ canvas (画面空間、カードの背面 = z-index 低め) ──
    var canvas = document.createElement('canvas');
    canvas.id = 'p3-gravity-field';
    canvas.setAttribute('aria-hidden', 'true');
    // z-index 2: P3 宇宙背景 (0付近) より上、carousel content (.singularity-content z5) より下
    //   → 粒子が正面カードの「背面」に見える
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:2;';
    document.body.appendChild(canvas);

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);

    var W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H, false);

    // 画面空間 ortho (left=0,right=W,top=0,bottom=H → y 下向き = DOM 座標)
    var camera = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
    var scene = new THREE.Scene();

    // ── 粒子 bake ──
    var N = pickCount();
    var aBase = new Float32Array(N * 2);
    var aSeed = new Float32Array(N);
    var aHue  = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      // 楕円内 (服っぽい縦長) にランダム配置。中心寄りを濃く (sqrt で内側密)
      var th = Math.random() * Math.PI * 2;
      var rr = Math.sqrt(Math.random());
      aBase[i * 2]     = Math.cos(th) * rr * 0.85;  // 横は少し狭く
      aBase[i * 2 + 1] = Math.sin(th) * rr;
      aSeed[i] = Math.random();
      aHue[i]  = Math.random();
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('aBase', new THREE.BufferAttribute(aBase, 2));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    geo.setAttribute('aHue',  new THREE.BufferAttribute(aHue, 1));
    // position dummy (Three が要求するので 0 埋め)
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));

    var uniforms = {
      uTime:     { value: 0 },
      uCenter:   { value: new THREE.Vector2(W * 0.5, H * 0.5) },
      uRadius:   { value: new THREE.Vector2(120, 160) },
      uActive:   { value: 0 },
      uColorMix: { value: 0 },
      uGather:   { value: 0 },
      uSize:     { value: 5.0 * dpr },
    };
    var mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // ── 状態 (target を ease) ──
    var activeTarget = 0, colorTarget = 0, gatherTarget = 0;
    var centerTarget = { x: W * 0.5, y: H * 0.5 };
    var radiusTarget = { x: 120, y: 160 };

    // ④ ロゴ連動: 服を選んだ時に中央ロゴ(コア)が共鳴する
    var _logoEl = null;
    function setLogoResonance(on) {
      if (_logoEl === null) _logoEl = document.querySelector('.hologram-logo') || false;
      if (_logoEl) _logoEl.classList.toggle('field-hot', !!on);
    }

    function readFrontCard() {
      var card = document.querySelector('.carousel-item.carousel-front');
      if (!card) { activeTarget = 0; setLogoResonance(false); return; }
      var imgWrap = card.querySelector('.product-card-img') || card;
      var r = imgWrap.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) { activeTarget = 0; return; }
      activeTarget = 1;
      centerTarget.x = r.left + r.width  * 0.5;
      centerTarget.y = r.top  + r.height * 0.5;
      // 楕円は服画像より一回り大きく (背面に滲む場)
      radiusTarget.x = r.width  * 0.62;
      radiusTarget.y = r.height * 0.66;
      // tap/hover で虹 + 吸着
      var hot = card.classList.contains('is-tapped') || card.matches(':hover');
      colorTarget  = hot ? 1.0 : 0.16;   // 普段ほぼシルバー、選択で虹
      gatherTarget = hot ? 1.0 : 0.0;
      setLogoResonance(hot);             // ④ 選択中はロゴが共鳴
    }

    var alive = true;
    var t0 = performance.now();
    var lastRead = 0;
    function loop(now) {
      if (!alive) return;
      var t = (now - t0) / 1000;
      uniforms.uTime.value = t;

      // DOM 読みは ~30fps に間引き (rect 読みのコスト削減)
      if (now - lastRead > 33) { readFrontCard(); lastRead = now; }

      var k = 0.12;
      uniforms.uActive.value   += (activeTarget - uniforms.uActive.value) * k;
      uniforms.uColorMix.value += (colorTarget  - uniforms.uColorMix.value) * k;
      uniforms.uGather.value   += (gatherTarget - uniforms.uGather.value) * k;
      uniforms.uCenter.value.x += (centerTarget.x - uniforms.uCenter.value.x) * 0.18;
      uniforms.uCenter.value.y += (centerTarget.y - uniforms.uCenter.value.y) * 0.18;
      uniforms.uRadius.value.x += (radiusTarget.x - uniforms.uRadius.value.x) * 0.12;
      uniforms.uRadius.value.y += (radiusTarget.y - uniforms.uRadius.value.y) * 0.12;

      // ほぼ消えてる時は描画スキップ (性能)
      if (uniforms.uActive.value > 0.01) renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function onResize() {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H, false);
      camera.right = W; camera.bottom = H;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    window.__p3GravityField = {
      canvas: canvas, renderer: renderer, scene: scene, uniforms: uniforms,
      dispose: function () {
        alive = false;
        window.removeEventListener('resize', onResize);
        try { geo.dispose(); } catch (e) {}
        try { mat.dispose(); } catch (e) {}
        try { renderer.dispose(); } catch (e) {}
        try { canvas.remove(); } catch (e) {}
        window.__p3GravityField = null;
      },
    };
    console.info('[p3_gravity_field] ready — selected card gravity field active');
  }

  // ── THREE 待ち (core のみで動く: Points/ShaderMaterial/Ortho) ──
  function boot() {
    if (typeof window.THREE !== 'undefined' && window.THREE.WebGLRenderer) {
      // P3 init を少し待ってから (carousel DOM 生成後)
      setTimeout(function () { try { start(window.THREE); } catch (e) { console.warn('[p3_gravity_field]', e); } }, 1400);
      return true;
    }
    return false;
  }
  if (!boot()) {
    window.addEventListener('threeAddonsReady', boot, { once: true });
    // 保険: addons 無しでも THREE が来たら起動
    var tries = 0;
    var iv = setInterval(function () {
      if (boot() || ++tries > 40) clearInterval(iv);
    }, 250);
  }
})();
