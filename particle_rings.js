/* ═══════════════════════════════════════════════════════════════════
   inryokü 円環粒子言語 v1 — Particle Rings
   1 円環 = 1 発話。12 tick の時計盤。0=点 / 1=線（弦）。
   色は RGBCMY のみ。grey 廃止。
   ───────────────────────────────────────────────────────────────────
   API:
     ParticleRings.render(spec, { size?: px })
     ParticleRings.canon('observation')
     ParticleRings.crystallize(svgEl)

   spec フォーマット:
     {
       ticks: [0..11],            // 点を置く tick
       chords: [[a,b], ...],      // 線を引く tick ペア
       colors: { tickIdx: 'y' },  // tick 単位の色（max 2 色推奨）
       direction: 'cw' | 'ccw',
       doubleRing: true | false,  // 同心二重 = 引用・伝聞
       cluster: true | false      // 粒子クラスタで描画（default false）
     }
   ─────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var CENTER = 50;
  var RADIUS = 26;
  var DOT_R = 1.55;
  var COLOR_DOT_R = 2.15;
  var INNER_RADIUS = 19;

  // tick 0 = 12時, CW で +30°ずつ
  function tickPos(tick, radius) {
    radius = radius == null ? RADIUS : radius;
    var angle = (-90 + tick * 30) * Math.PI / 180;
    return {
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle)
    };
  }

  function makeEl(tag, attrs, classes) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (classes) classes.forEach(function (c) { el.classList.add(c); });
    return el;
  }

  // ── 粒子クラスタ（1 tick を複数粒子で表現） ─────────────
  function spawnCluster(svg, cx, cy, radius, count, baseClass) {
    var g = makeEl('g', null, ['pring__cluster']);
    for (var i = 0; i < count; i++) {
      var ang = Math.random() * Math.PI * 2;
      var dist = (Math.random() * 0.6 + 0.4) * radius;
      var dot = makeEl('circle', {
        cx: cx + dist * Math.cos(ang),
        cy: cy + dist * Math.sin(ang),
        r: 0.6 + Math.random() * 0.4
      }, [baseClass]);
      g.appendChild(dot);
    }
    svg.appendChild(g);
  }

  // ── renderRingGlyph ─────────────────────────────────────
  function renderRingGlyph(spec, options) {
    spec = spec || {};
    options = options || {};
    var size = options.size || 100;
    var svg = makeEl('svg', { viewBox: '0 0 100 100' }, ['pring']);
    if (size) {
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
    }
    if (spec.direction === 'ccw') svg.classList.add('pring--ccw');

    // ── 円周パス（背景の薄い粒子トラック） ──
    var pathG = makeEl('g', null, ['pring__path']);
    var dotOrder = 0;
    for (var t = 0; t < 12; t++) {
      var p = tickPos(t);
      // メインドット（tick 中心の薄点）
      var pd = makeEl('circle', { cx: p.x, cy: p.y, r: 0.5 }, ['pring__path-dot']);
      pd.style.setProperty('--i', dotOrder++);
      pathG.appendChild(pd);
      // tick の間に微小粒子を 2 つずつ配置（円周感）
      var nextP = tickPos((t + 1) % 12);
      for (var k = 1; k <= 2; k++) {
        var ratio = k / 3;
        var ix = p.x + (nextP.x - p.x) * ratio;
        var iy = p.y + (nextP.y - p.y) * ratio;
        // 円周方向にわずかに膨らます
        var dx = ix - CENTER, dy = iy - CENTER;
        var len = Math.sqrt(dx * dx + dy * dy);
        var bulge = RADIUS / len;
        ix = CENTER + dx * bulge;
        iy = CENTER + dy * bulge;
        var interDot = makeEl('circle', { cx: ix, cy: iy, r: 0.35 }, ['pring__path-dot']);
        pathG.appendChild(interDot);
      }
    }
    svg.appendChild(pathG);

    // ── 同心二重円（引用・伝聞） ──
    if (spec.doubleRing) {
      var innerG = makeEl('g', null, ['pring__inner']);
      for (var ti = 0; ti < 12; ti++) {
        var ip = tickPos(ti, INNER_RADIUS);
        innerG.appendChild(makeEl('circle', { cx: ip.x, cy: ip.y, r: 0.45 }, ['pring__inner-dot']));
      }
      svg.appendChild(innerG);
    }

    // ── 弦（線）── ticks より先に描画して、点が上に乗るように
    var chords = spec.chords || [];
    chords.forEach(function (pair, i) {
      var a = tickPos(pair[0]);
      var b = tickPos(pair[1]);
      var arc = pair[2]; // 'arc' 指定時は曲線
      if (arc) {
        // 円の内側へ膨らむ弧
        var mx = (a.x + b.x) / 2;
        var my = (a.y + b.y) / 2;
        var dx = mx - CENTER, dy = my - CENTER;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var bulge = -RADIUS * 0.3;
        var qx = CENTER + (dx / d) * (d + bulge);
        var qy = CENTER + (dy / d) * (d + bulge);
        var ln = makeEl('path', {
          d: 'M ' + a.x + ' ' + a.y + ' Q ' + qx + ' ' + qy + ' ' + b.x + ' ' + b.y
        }, ['pring__chord', 'pring__chord--arc']);
        ln.style.setProperty('--i', i);
        svg.appendChild(ln);
      } else {
        var ln2 = makeEl('line', {
          x1: a.x, y1: a.y, x2: b.x, y2: b.y
        }, ['pring__chord']);
        ln2.style.setProperty('--i', i);
        svg.appendChild(ln2);
      }
    });

    // ── ticks（点） ──
    var ticks = spec.ticks || [];
    var colors = spec.colors || {};
    ticks.forEach(function (t, i) {
      var p = tickPos(t);
      var color = colors[t];
      var radius = color ? COLOR_DOT_R : DOT_R;
      var classes = ['pring__tick'];
      if (color) classes.push('pring__tick--c-' + color);
      var dot = makeEl('circle', { cx: p.x, cy: p.y, r: radius }, classes);
      dot.style.setProperty('--i', i);
      svg.appendChild(dot);
    });

    return svg;
  }

  function crystallizeRing(svg) {
    svg.classList.remove('pring--crystallizing');
    void svg.getBoundingClientRect();
    svg.classList.add('pring--crystallizing');
  }

  // ═══════════════════════════════════════════════════════════
  // CANON 円環 — よく使う発話パターン
  // ═══════════════════════════════════════════════════════════
  var CANON_RINGS = {
    // 沈黙 — パスのみ・点なし
    silence: {
      ticks: [],
      direction: 'cw'
    },
    // 核 — 頂に 1 点のみ（whisper 用）
    core: {
      ticks: [0],
      direction: 'cw'
    },
    // 間 — 頂と底（whisper 用）
    ma: {
      ticks: [0, 6],
      direction: 'cw'
    },
    // 影 — 点なし、横線のみ（whisper 用）
    shadow: {
      ticks: [],
      chords: [[3, 9]],
      direction: 'ccw'
    },
    // 発 — 頂から右（未来）への発信
    emit: {
      ticks: [0, 3],
      chords: [[0, 3]],
      colors: { 3: 'c' },
      direction: 'cw'
    },
    // 観測 — 頂に Y、4 軸に点
    observation: {
      ticks: [0, 3, 6, 9],
      colors: { 0: 'y' },
      direction: 'cw'
    },
    // 自分への問い — 頂のみ Y
    self_question: {
      ticks: [0],
      colors: { 0: 'y' },
      direction: 'ccw'
    },
    // 平叙宣言 — C を頂、6 tick で半月、頂底チョード
    declaration: {
      ticks: [0, 2, 4, 6, 8, 10],
      chords: [[0, 6]],
      colors: { 0: 'c' },
      direction: 'cw'
    },
    // 跳躍 — 底から頂へ斜め M、終端 M 色
    leap: {
      ticks: [6, 11, 0],
      chords: [[6, 11], [11, 0]],
      colors: { 0: 'm' },
      direction: 'cw'
    },
    // 共鳴 — 左右に C、平行 2 弦
    resonance: {
      ticks: [3, 9],
      chords: [[2, 8], [4, 10]],
      colors: { 3: 'c', 9: 'c' },
      direction: 'cw'
    },
    // 共感応答 — 全 12 tick + 中央なし、Y/G 各 1
    consensus: {
      ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      colors: { 0: 'g', 6: 'y' },
      direction: 'cw'
    },
    // 過去への仮定 — 底に B、左半分が密
    past_speculation: {
      ticks: [6, 7, 8, 9, 10],
      colors: { 6: 'b' },
      direction: 'ccw'
    },
    // 未来への命令 — 右に M、上下チョード
    future_command: {
      ticks: [3, 0, 6],
      chords: [[0, 6], [0, 3], [6, 3]],
      colors: { 3: 'm' },
      direction: 'cw'
    },
    // 余韻 — 上だけ点 3 つ
    echo: {
      ticks: [10, 0, 2],
      direction: 'cw'
    },
    // 引用 — 同心二重円、頂に C
    quotation: {
      ticks: [0],
      colors: { 0: 'c' },
      doubleRing: true,
      direction: 'cw'
    },
    // 召喚紋 — 6 色を等間隔配置
    summon: {
      ticks: [0, 2, 4, 6, 8, 10],
      colors: { 0: 'y', 2: 'r', 4: 'g', 6: 'm', 8: 'b', 10: 'c' },
      chords: [[0, 6], [2, 8], [4, 10]],
      direction: 'cw'
    },
    // 啓示（50→101） — 跳躍 + 共鳴の合成
    revelation: {
      ticks: [0, 6, 11, 1],
      chords: [[6, 0, 'arc'], [11, 1]],
      colors: { 0: 'm', 6: 'y' },
      direction: 'cw'
    }
  };

  function renderCanonRing(name, options) {
    var spec = CANON_RINGS[name];
    if (!spec) throw new Error('[ParticleRings] unknown canon: ' + name);
    return renderRingGlyph(spec, options);
  }

  global.ParticleRings = {
    render: renderRingGlyph,
    canon: renderCanonRing,
    crystallize: crystallizeRing,
    CANON: CANON_RINGS,
    KINDS: Object.keys(CANON_RINGS),
    tickPos: tickPos
  };
})(typeof window !== 'undefined' ? window : this);
