/* ═══════════════════════════════════════════════════════════════════
   inryokü 粒子言語 v1 — Particle Glyphs
   構造は JS / 見た目とアニメは CSS / 記号は GLYPH_DEFS
   ═══════════════════════════════════════════════════════════════════
   使い方:
     const svg = renderParticleGlyph('observe');         // formed
     const svg = renderParticleGlyph('leap', 'seed');    // 種状態
     setGlyphState(svg, 'resonant');                     // 状態切替
     crystallizeGlyph(svg);                              // 結晶化アニメ再生
   ─────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  // ── 要素フォーマット ─────────────────────────────────────────────
  // dot:  ['d', col, row, color?]
  // line: ['l', col1, row1, col2, row2, color?, style?('dashed')]
  // col/row は 0–4 の cell 座標。SVG 座標は (cell*10+5)。

  var GLYPH_DEFS = {
    // ── コア記号 10 ──
    i:         { name: '核',     els: [['d', 2, 2]] },
    emit:      { name: '発',     els: [['d', 1, 2], ['l', 1, 2, 4, 2]] },
    recv:      { name: '受',     els: [['l', 0, 2, 3, 2], ['d', 3, 2]] },
    ma:        { name: '間',     els: [['d', 1, 2], ['d', 3, 2]] },
    circuit:   { name: '回',     els: [['d', 1, 2], ['l', 1, 2, 3, 2], ['d', 3, 2]] },
    observe:   { name: '観',     els: [
                   ['l', 0, 2, 1, 2],
                   ['d', 2, 2, 'y'],
                   ['l', 3, 2, 4, 2]
                 ] },
    leap:      { name: '跳',     els: [
                   ['d', 1, 4],
                   ['l', 1, 4, 3, 0],
                   ['d', 3, 0, 'm']
                 ] },
    resonance: { name: '共',     els: [
                   ['d', 0, 2],
                   ['l', 1, 1, 3, 1, 'c'],
                   ['l', 1, 3, 3, 3, 'c'],
                   ['d', 4, 2]
                 ] },
    shadow:    { name: '影',     els: [['l', 1, 2, 3, 2, 'b-muted', 'dashed']] },

    // ── 召喚紋章（特例） ──
    summon:    { name: '混',     summon: true, els: [
                   ['d', 2, 2],
                   ['d', 2, 0, 'y'],
                   ['d', 4, 1, 'r'],
                   ['d', 4, 3, 'g'],
                   ['d', 2, 4, 'm'],
                   ['d', 0, 3, 'b'],
                   ['d', 0, 1, 'c']
                 ] },

    // ── 句読点 3 ──
    ellipsis:  { name: '…',     els: [['d', 0, 2], ['d', 2, 2], ['d', 4, 2]] },
    pause:     { name: '· ·',   els: [['d', 0, 2], ['d', 4, 2]] },
    breath:    { name: '◌',     els: [
                   ['d', 1, 1], ['d', 2, 1], ['d', 2, 2], ['d', 1, 2],
                   ['l', 1, 1, 2, 1],
                   ['l', 2, 1, 2, 2],
                   ['l', 2, 2, 1, 2],
                   ['l', 1, 2, 1, 1]
                 ] }
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var STATES = ['seed', 'formed', 'resonant'];

  function cellToCoord(n) { return n * 10 + 5; }

  // ── renderParticleGlyph ────────────────────────────────────────
  // kind:    GLYPH_DEFS のキー
  // state:   'seed' | 'formed' | 'resonant'  (default: 'formed')
  // options: { size?: px, id?: string, className?: string }
  function renderParticleGlyph(kind, state, options) {
    var def = GLYPH_DEFS[kind];
    if (!def) throw new Error('[ParticleGlyph] unknown kind: ' + kind);
    state = state || 'formed';
    options = options || {};

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 50 50');
    if (options.size) {
      svg.setAttribute('width', options.size);
      svg.setAttribute('height', options.size);
    }
    svg.classList.add('pglyph', 'pglyph--' + kind, 'pglyph--state-' + state);
    if (def.summon) svg.classList.add('pglyph--summon');
    if (options.className) svg.classList.add(options.className);
    if (options.id) svg.id = options.id;

    var dotIdx = 0, lineIdx = 0;
    def.els.forEach(function (el) {
      if (el[0] === 'd') {
        var col = el[1], row = el[2], color = el[3];
        var c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', cellToCoord(col));
        c.setAttribute('cy', cellToCoord(row));
        c.setAttribute('r', 1.6);
        c.classList.add('pglyph__el', 'pglyph__dot');
        if (color) c.classList.add('pglyph__el--c-' + color);
        c.style.setProperty('--i', dotIdx++);
        svg.appendChild(c);
      } else if (el[0] === 'l') {
        var c1 = el[1], r1 = el[2], c2 = el[3], r2 = el[4];
        var color2 = el[5], style = el[6];
        var ln = document.createElementNS(SVG_NS, 'line');
        ln.setAttribute('x1', cellToCoord(c1));
        ln.setAttribute('y1', cellToCoord(r1));
        ln.setAttribute('x2', cellToCoord(c2));
        ln.setAttribute('y2', cellToCoord(r2));
        ln.classList.add('pglyph__el', 'pglyph__line');
        if (style === 'dashed') ln.classList.add('pglyph__line--dashed');
        if (color2) ln.classList.add('pglyph__el--c-' + color2);
        ln.style.setProperty('--i', lineIdx++);
        svg.appendChild(ln);
      }
    });

    return svg;
  }

  // ── 状態切替 ────────────────────────────────────────────────
  function setGlyphState(svg, state) {
    if (STATES.indexOf(state) === -1) {
      throw new Error('[ParticleGlyph] invalid state: ' + state);
    }
    STATES.forEach(function (s) { svg.classList.remove('pglyph--state-' + s); });
    svg.classList.add('pglyph--state-' + state);
  }

  // ── 結晶化アニメ再生（class 付与 → reflow → 再付与で再起動） ──
  function crystallizeGlyph(svg) {
    svg.classList.remove('pglyph--crystallizing');
    // force reflow to restart CSS animation
    void svg.getBoundingClientRect();
    svg.classList.add('pglyph--crystallizing');
  }

  // ── 連鎖発話（記号配列を順に出現させる） ─────────────────────
  // sequence: [{kind, state?, hold?}] / containerEl: 挿入先
  // hold: この記号の表示後どれだけ待つか (ms)。default 300。
  // 句読点で長めに hold したい場合は明示。
  function speakGlyphs(containerEl, sequence, options) {
    options = options || {};
    var gap = options.gap != null ? options.gap : 300;
    var glyphSize = options.size || 28;
    var i = 0;
    var nodes = [];
    function next() {
      if (i >= sequence.length) {
        if (options.onComplete) options.onComplete(nodes);
        return;
      }
      var item = sequence[i++];
      var svg = renderParticleGlyph(item.kind, item.state || 'formed', { size: glyphSize });
      containerEl.appendChild(svg);
      nodes.push(svg);
      crystallizeGlyph(svg);
      var hold = item.hold != null ? item.hold
               : item.kind === 'ellipsis' ? 800
               : item.kind === 'breath'   ? 600
               : gap;
      setTimeout(next, hold);
    }
    next();
    return nodes;
  }

  // ═══════════════════════════════════════════════════════════
  // 文字フォント層 (CHAR_PATTERNS)
  // 5×5 dot pattern。'*' = dot / '.' = empty。線は使わない（概念記号と区別）
  // 大文字 A-Z + 数字 0-9 + 句読点。grey のみ・色なし。
  // ═══════════════════════════════════════════════════════════
  var CHAR_PATTERNS = {
    'A': ['.***.', '*...*', '*****', '*...*', '*...*'],
    'B': ['****.', '*...*', '****.', '*...*', '****.'],
    'C': ['.****', '*....', '*....', '*....', '.****'],
    'D': ['***..', '*..*.', '*...*', '*..*.', '***..'],
    'E': ['*****', '*....', '****.', '*....', '*****'],
    'F': ['*****', '*....', '****.', '*....', '*....'],
    'G': ['.****', '*....', '*..**', '*...*', '.***.'],
    'H': ['*...*', '*...*', '*****', '*...*', '*...*'],
    'I': ['*****', '..*..', '..*..', '..*..', '*****'],
    'J': ['..***', '....*', '....*', '*...*', '.***.'],
    'K': ['*...*', '*..*.', '***..', '*..*.', '*...*'],
    'L': ['*....', '*....', '*....', '*....', '*****'],
    'M': ['*...*', '**.**', '*.*.*', '*...*', '*...*'],
    'N': ['*...*', '**..*', '*.*.*', '*..**', '*...*'],
    'O': ['.***.', '*...*', '*...*', '*...*', '.***.'],
    'P': ['****.', '*...*', '****.', '*....', '*....'],
    'Q': ['.***.', '*...*', '*...*', '*..*.', '.**.*'],
    'R': ['****.', '*...*', '****.', '*..*.', '*...*'],
    'S': ['.****', '*....', '.***.', '....*', '****.'],
    'T': ['*****', '..*..', '..*..', '..*..', '..*..'],
    'U': ['*...*', '*...*', '*...*', '*...*', '.***.'],
    'V': ['*...*', '*...*', '*...*', '.*.*.', '..*..'],
    'W': ['*...*', '*...*', '*.*.*', '**.**', '*...*'],
    'X': ['*...*', '.*.*.', '..*..', '.*.*.', '*...*'],
    'Y': ['*...*', '.*.*.', '..*..', '..*..', '..*..'],
    'Z': ['*****', '...*.', '..*..', '.*...', '*****'],

    '0': ['.***.', '*..**', '*.*.*', '**..*', '.***.'],
    '1': ['..*..', '.**..', '..*..', '..*..', '*****'],
    '2': ['.***.', '*...*', '...*.', '.*...', '*****'],
    '3': ['****.', '....*', '.***.', '....*', '****.'],
    '4': ['...*.', '..**.', '.*.*.', '*****', '...*.'],
    '5': ['*****', '*....', '****.', '....*', '****.'],
    '6': ['.***.', '*....', '****.', '*...*', '.***.'],
    '7': ['*****', '....*', '...*.', '..*..', '.*...'],
    '8': ['.***.', '*...*', '.***.', '*...*', '.***.'],
    '9': ['.***.', '*...*', '.****', '....*', '.***.'],

    '.': ['.....', '.....', '.....', '.....', '..*..'],
    ',': ['.....', '.....', '.....', '..*..', '.*...'],
    '!': ['..*..', '..*..', '..*..', '.....', '..*..'],
    '?': ['.***.', '*...*', '..**.', '.....', '..*..'],
    "'": ['..*..', '..*..', '.....', '.....', '.....'],
    '-': ['.....', '.....', '.***.', '.....', '.....'],
    ':': ['.....', '..*..', '.....', '..*..', '.....']
  };

  // 文字 1 つから char-glyph SVG を生成（dot のみ・grey・5×5）
  function renderCharGlyph(ch, state, options) {
    state = state || 'formed';
    options = options || {};
    var upper = ch.toUpperCase();
    var pattern = CHAR_PATTERNS[upper];
    if (!pattern) {
      // 未定義文字: 空の透明 placeholder
      var blank = document.createElementNS(SVG_NS, 'svg');
      blank.setAttribute('viewBox', '0 0 50 50');
      if (options.size) {
        blank.setAttribute('width', options.size);
        blank.setAttribute('height', options.size);
      }
      blank.classList.add('pglyph', 'pglyph--char', 'pglyph--char-blank',
                          'pglyph--state-' + state);
      return blank;
    }

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 50 50');
    if (options.size) {
      svg.setAttribute('width', options.size);
      svg.setAttribute('height', options.size);
    }
    svg.classList.add('pglyph', 'pglyph--char', 'pglyph--char-' + upper,
                      'pglyph--state-' + state);
    var dotIdx = 0;
    pattern.forEach(function (rowStr, y) {
      for (var x = 0; x < 5; x++) {
        if (rowStr[x] === '*') {
          var c = document.createElementNS(SVG_NS, 'circle');
          c.setAttribute('cx', cellToCoord(x));
          c.setAttribute('cy', cellToCoord(y));
          c.setAttribute('r', 1.4);
          c.classList.add('pglyph__el', 'pglyph__dot');
          c.style.setProperty('--i', dotIdx++);
          svg.appendChild(c);
        }
      }
    });
    return svg;
  }

  // ═══════════════════════════════════════════════════════════
  // 概念エイリアス: [name] や 漢字 1 字を概念グリフへマップ
  // ═══════════════════════════════════════════════════════════
  var CONCEPT_ALIASES = {
    // 英字エイリアス（[brackets] 内）
    'i': 'i', 'core': 'i',
    'emit': 'emit', 'send': 'emit',
    'recv': 'recv', 'receive': 'recv',
    'ma': 'ma', 'between': 'ma',
    'circuit': 'circuit', 'circ': 'circuit',
    'observe': 'observe', 'obs': 'observe', 'eye': 'observe',
    'leap': 'leap', 'jump': 'leap',
    'resonance': 'resonance', 'reso': 'resonance', 'sync': 'resonance',
    'shadow': 'shadow', 'hidden': 'shadow',
    'summon': 'summon', 'mix': 'summon',
    'ellipsis': 'ellipsis', '...': 'ellipsis',
    'pause': 'pause',
    'breath': 'breath',
    // 漢字 1 字エイリアス
    '核': 'i', '発': 'emit', '受': 'recv', '間': 'ma', '回': 'circuit',
    '観': 'observe', '跳': 'leap', '共': 'resonance', '影': 'shadow',
    '混': 'summon'
  };

  // ═══════════════════════════════════════════════════════════
  // renderText: 文章を粒子化し container に並べる
  //   構文:
  //     - 通常文字: A-Z 0-9 . , ! ? ' - :  → CHAR_PATTERNS で描画
  //     - 半角空白: 単語間スペース
  //     - [name]:   概念グリフを挿入（CONCEPT_ALIASES）
  //     - 漢字 1 字: 直接概念マップ参照（あれば）
  // ═══════════════════════════════════════════════════════════
  function tokenizeText(text) {
    var tokens = [];
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (ch === '[') {
        var end = text.indexOf(']', i + 1);
        if (end > i) {
          var name = text.substring(i + 1, end).toLowerCase().trim();
          if (CONCEPT_ALIASES[name]) {
            tokens.push({ type: 'concept', kind: CONCEPT_ALIASES[name] });
            i = end + 1; continue;
          }
        }
        tokens.push({ type: 'char', ch: ch }); i++; continue;
      }
      if (CONCEPT_ALIASES[ch]) {
        tokens.push({ type: 'concept', kind: CONCEPT_ALIASES[ch] });
        i++; continue;
      }
      if (ch === ' ') { tokens.push({ type: 'space' }); i++; continue; }
      if (ch === '\n') { tokens.push({ type: 'break' }); i++; continue; }
      tokens.push({ type: 'char', ch: ch }); i++;
    }
    return tokens;
  }

  function renderText(text, container, options) {
    options = options || {};
    var size = options.size || 24;
    container.classList.add('pglyph-text');
    container.innerHTML = '';

    var tokens = tokenizeText(text);
    var nodes = [];
    tokens.forEach(function (tok) {
      if (tok.type === 'char') {
        var s = renderCharGlyph(tok.ch, 'formed', { size: size });
        container.appendChild(s);
        nodes.push(s);
      } else if (tok.type === 'concept') {
        var c = renderParticleGlyph(tok.kind, 'formed', { size: size });
        c.classList.add('pglyph--inline-concept');
        container.appendChild(c);
        nodes.push(c);
      } else if (tok.type === 'space') {
        var sp = document.createElement('span');
        sp.className = 'pglyph-space';
        sp.style.width = (size * 0.5) + 'px';
        container.appendChild(sp);
      } else if (tok.type === 'break') {
        container.appendChild(document.createElement('br'));
      }
    });

    if (options.crystallize) {
      // 順次クリスタライズ
      var delay = 0;
      var step = options.staggerStep != null ? options.staggerStep : 80;
      nodes.forEach(function (n) {
        setTimeout(function () { crystallizeGlyph(n); }, delay);
        delay += step;
      });
    }
    return nodes;
  }

  // ── export ─────────────────────────────────────────────────
  global.ParticleGlyphs = {
    GLYPH_DEFS: GLYPH_DEFS,
    CHAR_PATTERNS: CHAR_PATTERNS,
    CONCEPT_ALIASES: CONCEPT_ALIASES,
    render: renderParticleGlyph,
    renderChar: renderCharGlyph,
    renderText: renderText,
    setState: setGlyphState,
    crystallize: crystallizeGlyph,
    speak: speakGlyphs,
    STATES: STATES,
    KINDS: Object.keys(GLYPH_DEFS)
  };
})(typeof window !== 'undefined' ? window : this);
