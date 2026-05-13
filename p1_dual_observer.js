(function () {
  'use strict';

  var TOTAL_MS = 22000;
  var HOLD_MS = 3000;
  var COLORS = {
    r: 0xff0033,
    o: 0xff7a00,
    g: 0x00e54a,
    b: 0x2f6bff,
    c: 0x00e5e5,
    m: 0xff00cc,
    y: 0xffe500,
    grey: 0x808085
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function phase(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }

  var LEFT_BALL_BASE = { c: [-3.0, 1.25, 0.25], m: [-3.65, -0.15, 0.25], y: [-2.35, -0.15, 0.25] };
  var RIGHT_BALL_BASE = { r: [3.0, 1.25, 0.25], g: [2.35, -0.15, 0.25], b: [3.65, -0.15, 0.25] };
  var LEFT_BALL_CENTER = [-3.0, 0.1, 0.45];
  var RIGHT_BALL_CENTER = [3.0, 0.1, 0.45];
  var CMY_BALL_IDS = ['c', 'm', 'y'];
  var RGB_BALL_IDS = ['r', 'g', 'b'];

  function renderDualObserverP1(options) {
    options = options || {};
    if (!window.THREE) throw new Error('Three.js 0.160.0 is required before p1_dual_observer.js');

    var root = document.getElementById(options.rootId || 'root') || document.body;
    var tunnelMode = options.mode || window.__P1_TUNNEL_MODE || 'prism';
    tunnelMode = tunnelMode === 'inside' ? 'inside' : 'prism';

    root.innerHTML = [
      '<div id="dual-p1">',
      '  <div id="dual-taskbar">',
      '    <button id="dual-start" type="button"><span class="start-logo"></span>Start</button>',
      '    <div class="task-pill">dual_observer.exe</div>',
      '    <div id="dual-clock">00:00</div>',
      '  </div>',
      '  <div id="dual-window">',
      '    <div class="titlebar"><span>inryokü — dual observer</span><button type="button">×</button></div>',
      '    <div class="menubar"><span>File</span><span>Edit</span><span>View</span><span>Observe</span><span>Help</span></div>',
      '    <div id="dual-stage-wrap">',
      '      <div id="dual-square"><div id="dual-canvas"></div><div id="dual-flash"></div><div id="dual-label">SEPARATION</div></div>',
      '    </div>',
      '    <div class="statusrow">',
      '      <span id="dual-status">SEPARATION: dual viewport online.</span>',
      '      <span class="progress"><i id="dual-progress"></i></span>',
      '      <span id="dual-percent">0%</span>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    installStyles();

    var square = document.getElementById('dual-square');
    var canvasSlot = document.getElementById('dual-canvas');
    var status = document.getElementById('dual-status');
    var percentLabel = document.getElementById('dual-percent');
    var progressBar = document.getElementById('dual-progress');
    var stageLabel = document.getElementById('dual-label');
    var flashEl = document.getElementById('dual-flash');
    var clockEl = document.getElementById('dual-clock');
    var startButton = document.getElementById('dual-start');

    var THREE = window.THREE;
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(0.5);
    renderer.setClearColor(0x808085, 1);
    canvasSlot.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808085);
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0, 0, 14);

    var rootGroup = new THREE.Group();
    scene.add(rootGroup);

    var ambient = new THREE.AmbientLight(0xffffff, 0.72);
    scene.add(ambient);
    var key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2.4, 4.2, 6);
    scene.add(key);
    var rgbLight = new THREE.PointLight(0xffffff, 1.4, 18);
    rgbLight.position.set(3.2, 0.8, 5);
    scene.add(rgbLight);

    var panels = makePanels(THREE);
    rootGroup.add(panels.group);

    var balls = makeBalls(THREE);
    Object.keys(balls.meshes).forEach(function (k) { rootGroup.add(balls.meshes[k]); });

    var merge = makeMergeObjects(THREE);
    rootGroup.add(merge.black, merge.white, merge.grey);

    var observe = makeObserveObjects(THREE, tunnelMode);
    rootGroup.add(observe.group);

    var overlays = makeOverlays(THREE);
    rootGroup.add(overlays.scanlines, overlays.vignette);

    var audio = makeAudio();
    startButton.addEventListener('click', audio.unlock);
    window.addEventListener('pointerdown', audio.unlock, { once: true });

    var loopStart = performance.now();
    var doneSince = 0;
    var lastPhaseName = '';
    var playedFuse = false;
    var playedMerge = false;
    var playedObserve = false;
    var disposed = false;
    var rafId = 0;
    var flashTimeout = 0;
    var lastCameraFov = camera.fov;

    function resize() {
      var rect = square.getBoundingClientRect();
      var size = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
      lastCameraFov = camera.fov;
    }

    window.addEventListener('resize', resize);
    resize();

    function tick(now) {
      if (disposed) return;
      var elapsed = now - loopStart;
      var raw = elapsed / TOTAL_MS;
      var p = clamp(raw, 0, 1);
      var pct = p < 0.95 ? Math.round(p * 100) : Math.round(95 + phase(p, 0.95, 1) * 6);
      pct = clamp(pct, 0, 101);

      updateClock(clockEl);
      updateUI(p, pct);
      updateScene(p, now * 0.001);
      renderer.render(scene, camera);

      if (raw >= 1) {
        if (!doneSince) doneSince = now;
        if (now - doneSince > HOLD_MS) {
          loopStart = performance.now();
          doneSince = 0;
          playedFuse = false;
          playedMerge = false;
          playedObserve = false;
          flashEl.classList.remove('hot');
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    function updateUI(p, pct) {
      progressBar.style.width = pct + '%';
      percentLabel.textContent = pct + '%';

      var phaseName = 'SEPARATION';
      var message = 'SEPARATION: dual viewport online.';
      if (p >= 0.15 && p < 0.40) {
        phaseName = 'FUSE_DUAL';
        message = 'FUSE_DUAL: CMY matter darkens / RGB light whitens.';
      } else if (p >= 0.40 && p < 0.65) {
        phaseName = 'MERGE_OPPOSITES';
        message = 'MERGE_OPPOSITES: black and white converge.';
      } else if (p >= 0.65 && p < 0.95) {
        phaseName = tunnelMode === 'inside' ? 'OBSERVE: INSIDE' : 'OBSERVE: PRISM';
        message = tunnelMode === 'inside' ? 'OBSERVE: entering the grey sphere.' : 'OBSERVE: grey ray refracted by prism.';
      } else if (p >= 0.95) {
        phaseName = 'DONE';
        message = 'DONE: 101% reference held.';
      }

      if (phaseName !== lastPhaseName) {
        stageLabel.textContent = phaseName;
        status.textContent = message;
        lastPhaseName = phaseName;
      }

      if (!playedFuse && p >= 0.15) {
        playedFuse = true;
        audio.fuse();
      }
      if (!playedMerge && p >= 0.58) {
        playedMerge = true;
        flashEl.classList.add('hot');
        if (flashTimeout) window.clearTimeout(flashTimeout);
        flashTimeout = window.setTimeout(function () {
          flashEl.classList.remove('hot');
          flashTimeout = 0;
        }, 260);
        audio.merge();
      }
      if (!playedObserve && p >= 0.66) {
        playedObserve = true;
        audio.observe();
      }
    }

    function updateScene(p, t) {
      var sep = phase(p, 0, 0.15);
      var fuse = phase(p, 0.15, 0.40);
      var mergeP = phase(p, 0.40, 0.65);
      var obs = phase(p, 0.65, 0.95);
      var done = phase(p, 0.95, 1);

      var nextFov = lerp(42, tunnelMode === 'inside' ? 76 : 48, easeInOut(phase(p, 0.65, 0.95)));
      if (Math.abs(nextFov - lastCameraFov) > 0.001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
        lastCameraFov = nextFov;
      }
      camera.position.z = tunnelMode === 'inside' ? lerp(14, 2.2, easeInOut(obs)) : 14;
      camera.position.x = tunnelMode === 'inside' ? Math.sin(t * 0.8) * obs * 0.22 : 0;
      camera.position.y = tunnelMode === 'inside' ? Math.cos(t * 0.7) * obs * 0.18 : 0;
      camera.lookAt(0, 0, 0);

      updatePanels(panels, p, sep, fuse, mergeP);
      updateBalls(balls, p, t, sep, fuse, mergeP);
      updateMerge(merge, p, t, mergeP, obs);
      updateObserve(observe, tunnelMode, p, t, obs, done);
      updateOverlays(overlays, p, t, obs, done);
    }

    rafId = requestAnimationFrame(tick);

    return {
      dispose: function () {
        disposed = true;
        if (rafId) window.cancelAnimationFrame(rafId);
        if (flashTimeout) window.clearTimeout(flashTimeout);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointerdown', audio.unlock);
        startButton.removeEventListener('click', audio.unlock);
        audio.dispose();
        disposeScene(scene);
        renderer.dispose();
        renderer.forceContextLoss();
        root.innerHTML = '';
      }
    };
  }

  function installStyles() {
    if (document.getElementById('dual-observer-style')) return;
    var style = document.createElement('style');
    style.id = 'dual-observer-style';
    style.textContent = [
      '*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;font-family:Arial,Tahoma,sans-serif}',
      '#root{width:100%;height:100%;position:relative;overflow:hidden}',
      '#dual-p1{position:fixed;inset:0;background:#008080;overflow:hidden;color:#000;font-family:"MS Sans Serif",Tahoma,Arial,sans-serif}',
      '#dual-p1:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px);pointer-events:none}',
      '#dual-window{position:absolute;left:50%;top:calc(50% - 12px);transform:translate(-50%,-50%);width:min(720px,calc(100vw - 18px));height:min(760px,calc(100vh - 54px));min-height:430px;background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;box-shadow:1px 1px 0 #000;display:flex;flex-direction:column;overflow:hidden}',
      '.titlebar{height:22px;background:linear-gradient(90deg,#0a246a,#a6b8e8);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:2px 4px 2px 7px;font-size:12px;font-weight:bold}',
      '.titlebar button{width:17px;height:15px;border:1px solid;border-color:#fff #808080 #808080 #fff;background:#c0c0c0;color:#000;font-size:10px;line-height:10px;padding:0;font-family:inherit}',
      '.menubar{height:21px;display:flex;gap:15px;align-items:center;padding:0 8px;background:#c0c0c0;border-bottom:1px solid #808080;font-size:11px}',
      '#dual-stage-wrap{flex:1;margin:8px;border:1px inset #808080;background:#808085;display:grid;place-items:center;min-height:0;overflow:hidden}',
      '#dual-square{position:relative;width:min(calc(100vw - 42px),calc(100vh - 126px),660px);height:min(calc(100vw - 42px),calc(100vh - 126px),660px);min-width:280px;min-height:280px;overflow:hidden;background:#808085;border:1px solid rgba(0,0,0,.22);box-shadow:inset 0 0 40px rgba(0,0,0,.08)}',
      '#dual-canvas,#dual-canvas canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}',
      '#dual-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;mix-blend-mode:screen}',
      '#dual-flash.hot{animation:dualFlash .24s steps(2,end)}@keyframes dualFlash{0%{opacity:.95}40%{opacity:.22}100%{opacity:0}}',
      '#dual-label{position:absolute;right:10px;bottom:9px;color:rgba(0,0,0,.62);font:10px "Courier New",monospace;letter-spacing:.22em;text-shadow:0 1px rgba(255,255,255,.18);pointer-events:none}',
      '.statusrow{height:26px;background:#c0c0c0;border-top:1px solid #fff;display:grid;grid-template-columns:minmax(0,1fr) 190px 42px;gap:8px;align-items:center;padding:4px 7px;font-size:11px}',
      '#dual-status{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#303030}.progress{height:12px;background:#000;border:1px inset #808080;display:block;overflow:hidden}.progress i{height:100%;width:0;display:block;background:repeating-linear-gradient(90deg,#0000aa 0 8px,#0000cc 8px 10px)}#dual-percent{text-align:right;font-family:"Courier New",monospace}',
      '#dual-taskbar{position:absolute;left:0;right:0;bottom:0;height:30px;background:#c0c0c0;border-top:1px solid #fff;display:flex;align-items:center;gap:6px;padding:3px 5px;z-index:2}',
      '#dual-start{height:22px;display:flex;align-items:center;gap:4px;background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;font-weight:bold;font-size:11px;font-family:inherit}.start-logo{width:13px;height:13px;display:inline-block;background:linear-gradient(135deg,#f00 0 25%,#0c0 25% 50%,#00f 50% 75%,#ff0 75%)}.task-pill{height:22px;min-width:150px;padding:3px 10px;border:1px solid;border-color:#808080 #fff #fff #808080;background:#d0d0d0;font-size:11px}#dual-clock{margin-left:auto;height:22px;min-width:58px;padding:4px 8px;border:1px solid;border-color:#808080 #fff #fff #808080;text-align:center;font-size:11px}',
      '@media(max-width:520px){#dual-window{width:calc(100vw - 10px);height:calc(100vh - 42px);top:calc(50% - 10px)}.menubar{gap:9px;font-size:10px}.statusrow{grid-template-columns:minmax(0,1fr) 96px 38px;font-size:10px;padding-left:5px;padding-right:5px}.task-pill{min-width:112px}.titlebar{font-size:11px}#dual-square{width:min(calc(100vw - 30px),calc(100vh - 122px));height:min(calc(100vw - 30px),calc(100vh - 122px));min-width:250px;min-height:250px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function makePanels(THREE) {
    var group = new THREE.Group();
    var planeGeo = new THREE.PlaneGeometry(4.75, 4.75);
    var left = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: 0xf4f1ea }));
    var right = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: 0x080808 }));
    left.position.set(-2.42, 0, -1.3);
    right.position.set(2.42, 0, -1.3);
    group.add(left, right);

    var lineGeo = new THREE.PlaneGeometry(0.035, 4.92);
    var divider = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0x808085, transparent: true, opacity: 0.95 }));
    divider.position.set(0, 0, -1.1);
    group.add(divider);

    var edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10 });
    var edgeGeo = new THREE.RingGeometry(6.25, 6.29, 4, 1);
    var edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.rotation.z = Math.PI / 4;
    edge.scale.y = 1;
    edge.position.z = -1.0;
    group.add(edge);
    return { group: group, left: left, right: right, divider: divider, edge: edge };
  }

  function disposeScene(scene) {
    var disposedGeometries = [];
    var disposedMaterials = [];

    function disposeMaterial(material) {
      if (!material || disposedMaterials.indexOf(material) !== -1) return;
      disposedMaterials.push(material);
      material.dispose();
    }

    scene.traverse(function (obj) {
      if (obj.geometry && disposedGeometries.indexOf(obj.geometry) === -1) {
        disposedGeometries.push(obj.geometry);
        obj.geometry.dispose();
      }
      if (Array.isArray(obj.material)) {
        obj.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(obj.material);
      }
    });
  }

  function makeMatteSphere(THREE, color) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.92,
      metalness: 0,
      transparent: true,
      opacity: 1,
      blending: THREE.MultiplyBlending
    });
  }

  function makeLightSphere(THREE, color) {
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.15,
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }

  function makeBalls(THREE) {
    var geo = new THREE.SphereGeometry(0.48, 48, 32);
    var meshes = {
      c: new THREE.Mesh(geo, makeMatteSphere(THREE, COLORS.c)),
      m: new THREE.Mesh(geo, makeMatteSphere(THREE, COLORS.m)),
      y: new THREE.Mesh(geo, makeMatteSphere(THREE, COLORS.y)),
      r: new THREE.Mesh(geo, makeLightSphere(THREE, COLORS.r)),
      g: new THREE.Mesh(geo, makeLightSphere(THREE, COLORS.g)),
      b: new THREE.Mesh(geo, makeLightSphere(THREE, COLORS.b))
    };
    return { meshes: meshes };
  }

  function makeMergeObjects(THREE) {
    var geo = new THREE.SphereGeometry(0.72, 64, 40);
    var black = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.72, metalness: 0.02, transparent: true, opacity: 0 }));
    var white = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.38, roughness: 0.22, transparent: true, opacity: 0 }));
    var grey = new THREE.Mesh(new THREE.SphereGeometry(0.84, 72, 42), new THREE.MeshStandardMaterial({ color: COLORS.grey, roughness: 0.5, metalness: 0.02, transparent: true, opacity: 0 }));
    black.position.set(-2.4, 0, 0.35);
    white.position.set(2.4, 0, 0.35);
    grey.position.set(0, 0, 0.4);
    return { black: black, white: white, grey: grey };
  }

  function makeObserveObjects(THREE, mode) {
    var group = new THREE.Group();
    var rayMat = new THREE.MeshBasicMaterial({ color: 0xd9d9dd, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    var ray = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 3.4), rayMat);
    ray.position.set(0, 1.24, 0.1);
    group.add(ray);

    var prismGeo = new THREE.ConeGeometry(1.05, 1.55, 3, 1);
    var prismMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      roughness: 0.05,
      transmission: 0.35,
      thickness: 0.8,
      side: THREE.DoubleSide
    });
    var prism = new THREE.Mesh(prismGeo, prismMat);
    prism.rotation.z = Math.PI;
    prism.position.set(0, -0.62, 0.45);
    group.add(prism);

    var fanMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uSpread: { value: 0 }
      },
      vertexShader: [
        'uniform float uSpread;',
        'varying vec2 vUv;',
        'void main(){',
        '  vUv = uv;',
        '  vec3 p = position;',
        '  p.x *= 0.25 + 1.35 * uSpread;',
        '  p.y *= 0.25 + 1.65 * uSpread;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision mediump float;',
        'varying vec2 vUv;',
        'uniform float uOpacity;',
        'uniform float uTime;',
        'vec3 band(float x){',
        '  vec3 c[7];',
        '  c[0]=vec3(1.0,0.0,0.2); c[1]=vec3(1.0,0.48,0.0); c[2]=vec3(1.0,0.9,0.0); c[3]=vec3(0.0,0.9,0.29);',
        '  c[4]=vec3(0.0,0.9,0.9); c[5]=vec3(0.18,0.42,1.0); c[6]=vec3(1.0,0.0,0.8);',
        '  float f = clamp(x,0.0,0.999) * 6.0;',
        '  int i = int(f);',
        '  float t = fract(f);',
        '  if(i==0) return mix(c[0],c[1],t);',
        '  if(i==1) return mix(c[1],c[2],t);',
        '  if(i==2) return mix(c[2],c[3],t);',
        '  if(i==3) return mix(c[3],c[4],t);',
        '  if(i==4) return mix(c[4],c[5],t);',
        '  return mix(c[5],c[6],t);',
        '}',
        'void main(){',
        '  float sideMask = smoothstep(0.02,0.22,vUv.x) * smoothstep(0.98,0.78,vUv.x);',
        '  float fade = smoothstep(1.0,0.08,vUv.y);',
        '  float stripe = 0.70 + 0.30 * sin((vUv.y * 24.0) - uTime * 2.2);',
        '  vec3 col = band(vUv.x);',
        '  gl_FragColor = vec4(col * stripe, uOpacity * sideMask * fade);',
        '}'
      ].join('\n')
    });
    var fan = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.2, 16, 16), fanMat);
    fan.position.set(0, -2.15, -0.05);
    fan.rotation.x = -0.46;
    group.add(fan);

    var insideMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uSpin: { value: 0 }
      },
      vertexShader: [
        'varying vec3 vPos;',
        'void main(){',
        '  vPos = position;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision mediump float;',
        'varying vec3 vPos;',
        'uniform float uOpacity;',
        'uniform float uTime;',
        'uniform float uSpin;',
        'vec3 wheel(float x){',
        '  vec3 c[7];',
        '  c[0]=vec3(1.0,0.0,0.2); c[1]=vec3(1.0,0.48,0.0); c[2]=vec3(1.0,0.9,0.0); c[3]=vec3(0.0,0.9,0.29);',
        '  c[4]=vec3(0.0,0.9,0.9); c[5]=vec3(0.18,0.42,1.0); c[6]=vec3(1.0,0.0,0.8);',
        '  float f = fract(x) * 7.0;',
        '  int i = int(f); float t = smoothstep(0.0,1.0,fract(f));',
        '  if(i==0) return mix(c[0],c[1],t); if(i==1) return mix(c[1],c[2],t); if(i==2) return mix(c[2],c[3],t);',
        '  if(i==3) return mix(c[3],c[4],t); if(i==4) return mix(c[4],c[5],t); if(i==5) return mix(c[5],c[6],t); return mix(c[6],c[0],t);',
        '}',
        'void main(){',
        '  float a = atan(vPos.y, vPos.x) / 6.2831853 + 0.5 + uSpin * 0.15;',
        '  float r = length(vPos.xy) / 4.6;',
        '  vec3 col = wheel(a + sin(r * 13.0 - uTime * 1.7) * 0.035);',
        '  float rings = 0.78 + 0.22 * sin(r * 42.0 - uTime * 3.0);',
        '  gl_FragColor = vec4(col * rings, uOpacity);',
        '}'
      ].join('\n')
    });
    var inside = new THREE.Mesh(new THREE.SphereGeometry(7.5, 96, 56), insideMat);
    inside.visible = mode === 'inside';
    group.add(inside);

    group.visible = true;
    return { group: group, ray: ray, prism: prism, fan: fan, inside: inside };
  }

  function makeOverlays(THREE) {
    var scanMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uOpacity: { value: 0.13 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: [
        'precision mediump float;varying vec2 vUv;uniform float uOpacity;uniform float uTime;',
        'void main(){float s=step(0.58,fract((vUv.y+uTime*.015)*170.0));gl_FragColor=vec4(0.0,0.0,0.0,s*uOpacity);}'
      ].join('')
    });
    var scanlines = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), scanMat);
    scanlines.frustumCulled = false;

    var vignetteMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uOpacity: { value: 0.35 }, uGrey: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: [
        'precision mediump float;varying vec2 vUv;uniform float uOpacity;uniform float uGrey;',
        'void main(){vec2 p=vUv-.5;float r=length(p);float v=smoothstep(.25,.72,r);vec3 c=mix(vec3(0.0),vec3(.5,.5,.52),uGrey);gl_FragColor=vec4(c,v*uOpacity);}'
      ].join('')
    });
    var vignette = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), vignetteMat);
    vignette.frustumCulled = false;
    return { scanlines: scanlines, vignette: vignette };
  }

  function updatePanels(panels, p, sep, fuse, mergeP) {
    var soften = smooth(mergeP);
    panels.left.material.opacity = 1;
    panels.right.material.opacity = 1;
    panels.left.material.transparent = true;
    panels.right.material.transparent = true;
    panels.left.scale.x = lerp(1, 1.08, soften);
    panels.right.scale.x = lerp(1, 1.08, soften);
    panels.left.position.x = lerp(-2.42, -2.18, soften);
    panels.right.position.x = lerp(2.42, 2.18, soften);
    panels.divider.material.opacity = lerp(0.95, 0, soften);
    panels.edge.material.opacity = lerp(0.10, 0.25, phase(p, 0.88, 1));
  }

  function updateBalls(balls, p, t, sep, fuse, mergeP) {
    var fuseEase = easeInOut(fuse);
    var visible = p < 0.42 ? 1 : 1 - phase(p, 0.40, 0.46);

    // 2026-04-23: 司「もっとシンプルな動き、小さくならないで」
    // スケール変動/呼吸/微細ノイズ削除、位置移動 + opacity のみ
    CMY_BALL_IDS.forEach(function (id) {
      var mesh = balls.meshes[id];
      var src = LEFT_BALL_BASE[id];
      mesh.position.set(
        lerp(src[0], LEFT_BALL_CENTER[0], fuseEase),
        lerp(src[1], LEFT_BALL_CENTER[1], fuseEase),
        src[2]
      );
      mesh.scale.setScalar(1);
      mesh.material.opacity = visible * lerp(0.96, 0, fuseEase);
    });

    RGB_BALL_IDS.forEach(function (id) {
      var mesh = balls.meshes[id];
      var src = RIGHT_BALL_BASE[id];
      mesh.position.set(
        lerp(src[0], RIGHT_BALL_CENTER[0], fuseEase),
        lerp(src[1], RIGHT_BALL_CENTER[1], fuseEase),
        src[2]
      );
      mesh.scale.setScalar(1);
      mesh.material.opacity = visible * lerp(0.66, 0, fuseEase);
      mesh.material.emissiveIntensity = lerp(1.0, 2.6, fuseEase);
    });
  }

  function updateMerge(merge, p, t, mergeP, obs) {
    var appear = phase(p, 0.28, 0.39);
    var travel = easeInOut(mergeP);
    var mergeFade = 1 - phase(p, 0.58, 0.66);
    merge.black.material.opacity = lerp(0, 1.0, smooth(appear)) * mergeFade;
    merge.white.material.opacity = lerp(0, 1.0, smooth(appear)) * mergeFade;
    // 2026-04-23: 司「小さくなる動きおかしい」→ スケール変動廃止、素直に移動して融合
    merge.black.position.x = lerp(-3.0, -0.18, travel);
    merge.white.position.x = lerp(3.0, 0.18, travel);
    merge.black.position.y = 0;
    merge.white.position.y = 0;
    merge.black.scale.setScalar(1);
    merge.white.scale.setScalar(1);
    merge.white.material.emissiveIntensity = lerp(0.7, 3.2, smooth(appear)) * mergeFade;

    var greyAppear = phase(p, 0.54, 0.66);
    merge.grey.material.opacity = Math.max(greyAppear, phase(p, 0.95, 1) * 0.18);
    merge.grey.position.y = -easeInOut(obs) * 0.6;
    merge.grey.position.z = 0.5;
    merge.grey.scale.setScalar(1);
  }

  function updateObserve(observe, mode, p, t, obs, done) {
    var o = easeInOut(obs);
    observe.ray.material.opacity = mode === 'prism' ? phase(p, 0.67, 0.78) * (1 - phase(p, 0.92, 1)) : 0;
    observe.ray.scale.y = lerp(0.15, 1.2, o);
    observe.ray.position.y = lerp(0.88, -0.12, o);

    observe.prism.visible = mode === 'prism';
    observe.prism.material.opacity = mode === 'prism' ? phase(p, 0.66, 0.76) * 0.42 : 0;
    observe.prism.rotation.y = Math.sin(t * 0.6) * 0.08;
    observe.prism.rotation.z = Math.PI + Math.sin(t * 0.9) * 0.02;

    observe.fan.visible = mode === 'prism';
    observe.fan.material.uniforms.uOpacity.value = mode === 'prism' ? phase(p, 0.73, 0.95) * lerp(0.92, 1, done) : 0;
    observe.fan.material.uniforms.uSpread.value = mode === 'prism' ? lerp(0, 1, easeOutCubic(phase(p, 0.72, 0.96))) : 0;
    observe.fan.material.uniforms.uTime.value = t;
    observe.fan.position.y = lerp(-1.72, -0.48, phase(p, 0.84, 1));
    observe.fan.scale.setScalar(lerp(1, 1.95, phase(p, 0.86, 1)));

    observe.inside.visible = mode === 'inside';
    observe.inside.material.uniforms.uOpacity.value = mode === 'inside' ? phase(p, 0.69, 0.90) * lerp(0.92, 1, done) : 0;
    observe.inside.material.uniforms.uTime.value = t;
    observe.inside.material.uniforms.uSpin.value = o;
    observe.inside.rotation.z = t * 0.05 + o * 0.8;
    observe.inside.rotation.x = Math.sin(t * 0.2) * 0.06;
  }

  function updateOverlays(overlays, p, t, obs, done) {
    overlays.scanlines.material.uniforms.uTime.value = t;
    overlays.scanlines.material.uniforms.uOpacity.value = lerp(0.09, 0.03, phase(p, 0.65, 1));
    overlays.vignette.material.uniforms.uOpacity.value = lerp(0.28, 0.48, obs) * (1 - done * 0.25);
    overlays.vignette.material.uniforms.uGrey.value = phase(p, 0.43, 0.70) * (1 - phase(p, 0.72, 1));
  }

  function makeAudio() {
    var ctx = null;
    var master = null;
    var unlocked = false;
    var fuseDelayTimeout = 0;

    function unlock() {
      if (unlocked) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        master = master || ctx.createGain();
        master.gain.value = 0.16;
        master.connect(ctx.destination);
        if (ctx.state === 'suspended') ctx.resume();
        unlocked = true;
      } catch (e) {
        unlocked = false;
      }
    }

    function tone(freq, time, dur, type, gain) {
      if (!ctx || !master || ctx.state !== 'running') return;
      var osc = ctx.createOscillator();
      var amp = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, time);
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.05), time + 0.04);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(amp);
      amp.connect(master);
      osc.start(time);
      osc.stop(time + dur + 0.08);
    }

    function chord(freqs, dur, gain, offsetStep) {
      unlock();
      if (!ctx) return;
      var now = ctx.currentTime + 0.02;
      var step = typeof offsetStep === 'number' ? offsetStep : 0.035;
      freqs.forEach(function (f, i) { tone(f, now + i * step, dur, 'sine', gain); });
    }

    function dispose() {
      if (fuseDelayTimeout) {
        window.clearTimeout(fuseDelayTimeout);
        fuseDelayTimeout = 0;
      }
      if (master) {
        master.disconnect();
        master = null;
      }
      if (ctx) {
        ctx.close();
        ctx = null;
      }
      unlocked = false;
    }

    return {
      unlock: unlock,
      fuse: function () {
        chord([220.00, 261.63, 329.63], 1.35, 0.035, 0.09);
        if (fuseDelayTimeout) window.clearTimeout(fuseDelayTimeout);
        fuseDelayTimeout = window.setTimeout(function () {
          chord([440.00, 554.37, 659.25], 1.25, 0.027, 0.075);
          fuseDelayTimeout = 0;
        }, 180);
      },
      merge: function () {
        chord([220.00, 261.63, 329.63, 440.00, 554.37, 659.25], 1.85, 0.026, 0);
      },
      observe: function () {
        unlock();
        if (!ctx || !master || ctx.state !== 'running') return;
        var now = ctx.currentTime + 0.02;
        [110, 165, 247.5].forEach(function (f, i) { tone(f, now + i * 0.03, 4.2, 'triangle', 0.018); });
      },
      dispose: dispose
    };
  }

  function updateClock(clockEl) {
    var d = new Date();
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    clockEl.textContent = h + ':' + m;
  }

  window.renderDualObserverP1 = renderDualObserverP1;
})();
