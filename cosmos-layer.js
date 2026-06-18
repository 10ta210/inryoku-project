/* ============================================================
   cosmos-layer.js — inryokü atmospheric overlay (vanilla, zero-dep)
   作成: 2026-04-29
   役割:
     2. Shooting stars (SVG line, 30〜120s 間隔, 1s で消える)
     3. Mouse trail (10 SVG circles, 「観測者がここに居る」)
     4. Parallax stars (背景の星座, scrollY * 0.1)
     6. 景深 (中央まばら / 周辺密集)

   触らない: 既存 production 全部。canvas 触らず、独立 overlay。
   pointer-events: none で UI 邪魔しない。

   司さん向け調整: cosmos-layer-2026-04-29.md を参照。
   tweak は CONFIG オブジェクトで一箇所に集約。
   ============================================================ */
(function () {
  'use strict';

  // ----- guard: SSR / 多重ロード防止 ---------------------------
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__inryokuCosmosLayerLoaded) return;
  window.__inryokuCosmosLayerLoaded = true;

  // ----- prefers-reduced-motion -------------------------------
  var reduce = false;
  try {
    reduce = window.matchMedia &&
             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { reduce = false; }

  // ----- 司さん向け調整パラメータ（一箇所集約）-----------------
  var CONFIG = {
    PARALLAX_STAR_COUNT: 36,           // 視差スクロールする星の総数
    PARALLAX_FOCUS_RADIUS: 0.18,       // 0-1 (画面短辺比) これ以内は星まばら
    PARALLAX_SCROLL_FACTOR: 0.08,      // scrollY * これ で transformY
    SHOOTING_MIN_INTERVAL_MS: 30000,   // 流れ星最小間隔
    SHOOTING_MAX_INTERVAL_MS: 120000,  // 流れ星最大間隔
    SHOOTING_DURATION_MS: 1000,        // 1 本の持続時間
    TRAIL_COUNT: 10,                   // mouse trail dot 数
    TRAIL_FADE_MS: 1000,               // trail フェード時間
    TRAIL_MIN_RADIUS: 1.0,             // 最小半径 (px)
    TRAIL_MAX_RADIUS: 2.4              // 先頭 dot の半径
  };
  // 必要なら window.cosmosConfig で上書き可能
  if (window.cosmosConfig && typeof window.cosmosConfig === 'object') {
    for (var k in window.cosmosConfig) {
      if (Object.prototype.hasOwnProperty.call(window.cosmosConfig, k)) {
        CONFIG[k] = window.cosmosConfig[k];
      }
    }
  }

  var SVGNS = 'http://www.w3.org/2000/svg';

  // ----- DOM 構築 ---------------------------------------------
  function init() {
    if (document.getElementById('cosmos-overlay')) return;

    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('id', 'cosmos-overlay');
    svg.setAttribute('xmlns', SVGNS);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('preserveAspectRatio', 'none');
    // viewBox は resize で更新
    var w = window.innerWidth, h = window.innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    // 4. Parallax stars layer (group, scrollY で transform)
    var gStars = document.createElementNS(SVGNS, 'g');
    gStars.setAttribute('id', 'cosmos-stars');
    svg.appendChild(gStars);

    // 3. Mouse trail (10 circles)
    var gTrail = document.createElementNS(SVGNS, 'g');
    gTrail.setAttribute('id', 'cosmos-trail');
    svg.appendChild(gTrail);

    // 2. Shooting star line (1 本だけ使い回し)
    var shoot = document.createElementNS(SVGNS, 'line');
    shoot.setAttribute('class', 'cosmos-shooting');
    shoot.setAttribute('x1', '0');
    shoot.setAttribute('y1', '0');
    shoot.setAttribute('x2', '0');
    shoot.setAttribute('y2', '0');
    shoot.style.opacity = '0';
    svg.appendChild(shoot);

    document.body.appendChild(svg);

    return { svg: svg, gStars: gStars, gTrail: gTrail, shoot: shoot };
  }

  // ----- 4 + 6. Parallax stars 生成（中央まばら、周辺密）----
  function buildStars(gStars) {
    while (gStars.firstChild) gStars.removeChild(gStars.firstChild);
    var w = window.innerWidth, h = window.innerHeight;
    var cx = w / 2, cy = h / 2;
    var minSide = Math.min(w, h);
    var focusR = CONFIG.PARALLAX_FOCUS_RADIUS * minSide;
    var stars = [];
    var attempts = 0;
    var max = CONFIG.PARALLAX_STAR_COUNT;
    while (stars.length < max && attempts < max * 12) {
      attempts++;
      var x = Math.random() * w;
      var y = Math.random() * h;
      var d = Math.hypot(x - cx, y - cy);
      // 中央 (focusR 以内) は出現確率を下げる（観測者の焦点）
      if (d < focusR && Math.random() > 0.18) continue;
      // 周辺ほど密（1.0 で必ず出る）。中央外は累進的に確率上昇
      var p = Math.min(1.0, (d / minSide) * 1.4 + 0.25);
      if (Math.random() > p) continue;

      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('class', 'cosmos-star');
      c.setAttribute('cx', x.toFixed(1));
      c.setAttribute('cy', y.toFixed(1));
      // 周辺ほど少し大きく（景深の遠近錯覚）
      var rBase = 0.7 + (d / minSide) * 0.9;
      var r = rBase * (0.7 + Math.random() * 0.6);
      c.setAttribute('r', r.toFixed(2));
      // 微弱な opacity ばらつき
      c.setAttribute('opacity', (0.35 + Math.random() * 0.45).toFixed(2));
      gStars.appendChild(c);
      stars.push(c);
    }
  }

  // ----- 4. parallax: scrollY で gStars を縦移動 ---------------
  function bindParallax(gStars) {
    var raf = 0, lastY = -1;
    function tick() {
      raf = 0;
      var y = window.scrollY || window.pageYOffset || 0;
      if (y === lastY) return;
      lastY = y;
      gStars.setAttribute('transform',
        'translate(0,' + (y * CONFIG.PARALLAX_SCROLL_FACTOR).toFixed(2) + ')');
    }
    window.addEventListener('scroll', function () {
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    tick();
  }

  // ----- 2. Shooting star ピンガ -----------------------------
  function scheduleShooting(shoot) {
    if (reduce) return; // reduce 時は出さない
    function fire() {
      var w = window.innerWidth, h = window.innerHeight;
      // 上空〜中段から斜め下方向へ
      var startX = Math.random() * w;
      var startY = Math.random() * h * 0.5;
      // 角度 -25deg 〜 -55deg（左下〜右下のいずれか）
      var dir = Math.random() < 0.5 ? -1 : 1;
      var angle = (25 + Math.random() * 30) * (Math.PI / 180);
      var len = 120 + Math.random() * 220;
      var endX = startX + dir * len * Math.cos(angle);
      var endY = startY + len * Math.sin(angle);

      shoot.setAttribute('x1', startX.toFixed(1));
      shoot.setAttribute('y1', startY.toFixed(1));
      shoot.setAttribute('x2', endX.toFixed(1));
      shoot.setAttribute('y2', endY.toFixed(1));
      // dasharray で軌跡が走る演出
      var L = Math.hypot(endX - startX, endY - startY);
      shoot.setAttribute('stroke-dasharray', L.toFixed(1));
      shoot.setAttribute('stroke-dashoffset', L.toFixed(1));
      // stroke 太さに微小ランダム
      shoot.setAttribute('stroke-width', (1 + Math.random() * 1.6).toFixed(2));
      shoot.style.opacity = '0';

      // force reflow → animation 確実に発火
      void shoot.getBoundingClientRect();

      var dur = CONFIG.SHOOTING_DURATION_MS;
      shoot.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.2,.7,.3,1), opacity ' + dur + 'ms ease-out';
      shoot.style.opacity = '0.85';
      shoot.setAttribute('stroke-dashoffset', '0');

      // フェードアウト（途中から）
      setTimeout(function () {
        shoot.style.opacity = '0';
      }, Math.max(50, dur - 200));

      // 次回スケジュール
      var next = CONFIG.SHOOTING_MIN_INTERVAL_MS +
                 Math.random() * (CONFIG.SHOOTING_MAX_INTERVAL_MS - CONFIG.SHOOTING_MIN_INTERVAL_MS);
      setTimeout(fire, next);
    }
    // 初回は 5〜30 秒後（即出ると唐突）
    setTimeout(fire, 5000 + Math.random() * 25000);
  }

  // ----- 3. Mouse trail --------------------------------------
  function bindTrail(gTrail) {
    var dots = [];
    for (var i = 0; i < CONFIG.TRAIL_COUNT; i++) {
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('class', 'cosmos-trail-dot');
      c.setAttribute('cx', '-100');
      c.setAttribute('cy', '-100');
      var r = CONFIG.TRAIL_MIN_RADIUS + (CONFIG.TRAIL_MAX_RADIUS - CONFIG.TRAIL_MIN_RADIUS) *
              (1 - i / CONFIG.TRAIL_COUNT);
      c.setAttribute('r', r.toFixed(2));
      c.setAttribute('opacity', '0');
      gTrail.appendChild(c);
      dots.push({ el: c, x: -100, y: -100, t: 0 });
    }

    var head = { x: -100, y: -100, time: 0 };
    var lastSampleTime = 0;
    var SAMPLE_INTERVAL = 30; // ms ごとにサンプリング（過密回避）
    var rafId = 0;

    window.addEventListener('mousemove', function (e) {
      var now = performance.now();
      head.x = e.clientX;
      head.y = e.clientY;
      head.time = now;
      if (now - lastSampleTime >= SAMPLE_INTERVAL) {
        lastSampleTime = now;
        // shift: 末尾削除、先頭追加（配列ローテーション）
        for (var i = dots.length - 1; i > 0; i--) {
          dots[i].x = dots[i - 1].x;
          dots[i].y = dots[i - 1].y;
          dots[i].t = dots[i - 1].t;
        }
        dots[0].x = head.x;
        dots[0].y = head.y;
        dots[0].t = now;
      }
      if (!rafId) rafId = requestAnimationFrame(render);
    }, { passive: true });

    function render() {
      rafId = 0;
      var now = performance.now();
      var stillFading = false;
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var age = now - d.t;
        if (d.t === 0 || age > CONFIG.TRAIL_FADE_MS) {
          d.el.setAttribute('opacity', '0');
          continue;
        }
        var k = 1 - age / CONFIG.TRAIL_FADE_MS;
        // 先頭ほど濃く、末尾ほど薄く（順位 i で減衰）
        var rank = 1 - i / CONFIG.TRAIL_COUNT;
        var op = (reduce ? 0.12 : 0.55) * k * rank;
        d.el.setAttribute('cx', d.x.toFixed(1));
        d.el.setAttribute('cy', d.y.toFixed(1));
        d.el.setAttribute('opacity', op.toFixed(3));
        stillFading = true;
      }
      if (stillFading) rafId = requestAnimationFrame(render);
    }
  }

  // ----- resize ----------------------------------------------
  function bindResize(svg, gStars) {
    var t = 0;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var w = window.innerWidth, h = window.innerHeight;
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        buildStars(gStars);
      }, 220);
    }, { passive: true });
  }

  // ----- boot -------------------------------------------------
  function boot() {
    var ctx;
    try {
      ctx = init();
    } catch (e) {
      // 何があっても本体機能は壊さない
      try { console.warn('[cosmos-layer] init skipped:', e); } catch (_) {}
      return;
    }
    if (!ctx) return;
    try { buildStars(ctx.gStars); } catch (_) {}
    try { bindParallax(ctx.gStars); } catch (_) {}
    try { scheduleShooting(ctx.shoot); } catch (_) {}
    try { bindTrail(ctx.gTrail); } catch (_) {}
    try { bindResize(ctx.svg, ctx.gStars); } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // 公開（デバッグ用、最小限）
  window.cosmosLayer = {
    config: CONFIG,
    version: '2026-04-29'
  };

  // ===========================================================
  // P3 Behavior Engine bridge — 2026-05-12
  // Adds setBehavior(id) / resolveBehavior(state) routing without
  // touching existing SVG overlay logic above. Backward compatible:
  // if behaviors/index.js fails to load, this block is a no-op and
  // ?sample=N continues to work exactly as before.
  // ===========================================================
  var currentBehavior = 'breathing_sphere';
  var lastBehavior = 'breathing_sphere';
  var blendFrames = 0;        // one-frame blend on swap
  var behaviorAPI = null;     // populated when ESM loader resolves

  // Parse ?behavior=<id> from URL (override).
  var urlBehavior = null;
  try {
    var qs = new URLSearchParams(window.location.search);
    var qb = qs.get('behavior');
    if (qb && /^[a-z0-9_]+$/i.test(qb)) urlBehavior = qb;
  } catch (_) { /* IE / weird env */ }

  function resolveBehaviorLocal(state) {
    if (behaviorAPI && typeof behaviorAPI.resolve === 'function') {
      return behaviorAPI.resolve({
        state: state && state.state,
        reduceMotion: reduce,
        urlBehavior: urlBehavior
      });
    }
    // Pre-loader fallback: best-effort static table.
    if (urlBehavior) return urlBehavior;
    if (reduce) return 'idle_static';
    if (state && state.state) {
      var m = {
        idle: 'breathing_sphere',
        discovery: 'attractor_hover',
        speaking: 'ring_resonance',
        contact: 'convergence_glyph',
        bridge: 'light_bridge_accent'
      };
      if (m[state.state]) return m[state.state];
    }
    return 'breathing_sphere';
  }

  function setBehavior(id) {
    if (!id || typeof id !== 'string') return currentBehavior;
    if (behaviorAPI && !behaviorAPI.list().includes(id)) {
      // Unknown id — keep current, log once.
      try { console.warn('[cosmos-layer] unknown behavior:', id); } catch (_) {}
      return currentBehavior;
    }
    if (id === currentBehavior) return currentBehavior;
    lastBehavior = currentBehavior;
    currentBehavior = id;
    blendFrames = 1;
    window.__inryokuBehavior = id;
    return id;
  }

  // Public surface.
  window.cosmosLayer.setBehavior = setBehavior;
  window.cosmosLayer.resolveBehavior = resolveBehaviorLocal;
  window.cosmosLayer.getBehavior = function () { return currentBehavior; };
  window.cosmosLayer.getLastBehavior = function () { return lastBehavior; };
  window.cosmosLayer.consumeBlendFrame = function () {
    if (blendFrames > 0) { blendFrames--; return true; }
    return false;
  };
  window.__inryokuBehavior = currentBehavior;

  // Load the ESM behavior collector via dynamic import. Direct, no polling.
  // If the module fails to load (404, network, syntax), the overlay above is
  // unaffected and we degrade to `idle_static` as the fallback behavior.
  try {
    import('./behaviors/index.js').then(function (api) {
      behaviorAPI = {
        list: function () { return Array.from(api.BEHAVIORS.keys()); },
        get: api.getBehavior,
        resolve: api.resolveBehavior,
        step: api.safeStep
      };
      window.__inryokuBehaviorAPI = behaviorAPI;
      window.cosmosLayer.behaviorsReady = true;
      try {
        var url = new URLSearchParams(location.search).get('behavior');
        if (url && api.BEHAVIORS.has(url)) window.cosmosLayer.setBehavior(url);
      } catch (_) {}
    }).catch(function (e) {
      try { console.warn('[cosmos-layer] behavior loader failed, falling back to idle_static:', e); } catch (_) {}
      // Fallback: pin currentBehavior to idle_static so any consumer that
      // queries window.__inryokuBehavior gets the safe option.
      currentBehavior = 'idle_static';
      window.__inryokuBehavior = currentBehavior;
    });
  } catch (e) {
    try { console.warn('[cosmos-layer] behavior loader skipped:', e); } catch (_) {}
    currentBehavior = 'idle_static';
    window.__inryokuBehavior = currentBehavior;
  }
})();
