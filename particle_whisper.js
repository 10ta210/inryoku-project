/* ═══════════════════════════════════════════════════════════════════
   inryokü 粒子言語 — Idle Whisper
   ロゴが「自分だけに分かる言葉で息をする」状態を作る常駐モジュール
   ───────────────────────────────────────────────────────────────────
   依存: particle_glyphs.js (window.ParticleGlyphs)
   使い方:
     ParticleWhisper.attachToLogo('.logo-holo-wrap');
     // または
     var w = new ParticleWhisper(logoEl, options);
     w.start();
   ─────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  // ── 既定設定 ─────────────────────────────────────────────────
  // 静かな記号だけ。summon / leap / observe / resonance などの強い記号は除外。
  var DEFAULTS = {
    vocab: ['i', 'ma', 'ellipsis', 'shadow', 'pause'],
    initialDelayMin: 6000,
    initialDelayMax: 14000,
    minInterval: 30000,        // 沈黙最短: 30s
    maxInterval: 90000,        // 沈黙最長: 90s
    holdMin: 2000,             // formed 状態 hold: 2s
    holdMax: 4000,             // 同上 max: 4s
    crystallizeMs: 1050,       // 結晶化アニメ完了想定
    fadeMs: 1000,              // fade out 時間
    glyphSize: 26,             // ロゴの 0.4× 以下を意識
    twoGlyphChance: 0.5,       // 2 記号発話の確率
    glyphGapMs: 320,           // 記号間の小さな間
    gentleResonant: true,      // hold 後半でごく弱く resonant
    placement: 'below',        // 'below' | 'bottomRight'
    offsetX: 0,
    offsetY: 14
  };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── ParticleWhisper コンストラクタ ─────────────────────────────
  function ParticleWhisper(logoEl, opts) {
    if (!logoEl) throw new Error('[ParticleWhisper] logo element required');
    if (!global.ParticleGlyphs) {
      throw new Error('[ParticleWhisper] ParticleGlyphs not loaded');
    }
    this.logo = logoEl;
    this.opts = Object.assign({}, DEFAULTS, opts || {});
    this.container = null;
    this.timer = null;
    this.active = false;       // 同時発話禁止フラグ
    this.stopped = false;
  }

  ParticleWhisper.prototype.start = function () {
    this.stopped = false;
    this._mount();
    var self = this;
    var d = rand(this.opts.initialDelayMin, this.opts.initialDelayMax);
    this.timer = setTimeout(function () { self._utter(); }, d);
  };

  ParticleWhisper.prototype.stop = function () {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.container) this.container.innerHTML = '';
  };

  ParticleWhisper.prototype._mount = function () {
    if (this.container) return;
    var host = this.logo.parentElement || this.logo;
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }
    var c = document.createElement('div');
    c.className = 'pglyph-whisper pglyph-whisper--' + this.opts.placement;
    c.style.setProperty('--pgw-offset-x', this.opts.offsetX + 'px');
    c.style.setProperty('--pgw-offset-y', this.opts.offsetY + 'px');
    host.appendChild(c);
    this.container = c;

    // 断言レジスター用コンテナ（色を許可）
    var st = document.createElement('div');
    st.className = 'pglyph-statement pglyph-statement--' + this.opts.placement;
    st.style.setProperty('--pgw-offset-x', this.opts.offsetX + 'px');
    st.style.setProperty('--pgw-offset-y', this.opts.offsetY + 'px');
    host.appendChild(st);
    this.statementContainer = st;
  };

  ParticleWhisper.prototype._scheduleNext = function () {
    if (this.stopped) return;
    var self = this;
    var d = rand(this.opts.minInterval, this.opts.maxInterval);
    this.timer = setTimeout(function () { self._utter(); }, d);
  };

  // ── 1 発話 ───────────────────────────────────────────────────
  ParticleWhisper.prototype._utter = function () {
    if (this.stopped) return;
    if (this.active) { this._scheduleNext(); return; }
    this.active = true;

    var n = (Math.random() < this.opts.twoGlyphChance) ? 2 : 1;
    var seq = [];
    for (var i = 0; i < n; i++) seq.push(pick(this.opts.vocab));

    var self = this;
    var nodes = [];
    var idx = 0;

    function next() {
      if (self.stopped) { self._cleanup(nodes); self.active = false; return; }
      if (idx >= seq.length) {
        var hold = rand(self.opts.holdMin, self.opts.holdMax);
        if (self.opts.gentleResonant && nodes.length) {
          var last = nodes[nodes.length - 1];
          setTimeout(function () {
            if (last.parentElement && !self.stopped) {
              ParticleGlyphs.setState(last, 'resonant');
            }
          }, hold * 0.45);
        }
        setTimeout(function () { self._fadeOut(nodes); }, hold);
        return;
      }
      var kind = seq[idx++];
      var svg = ParticleGlyphs.render(kind, 'seed', { size: self.opts.glyphSize });
      svg.classList.add('pglyph-whisper__glyph');
      self.container.appendChild(svg);
      nodes.push(svg);
      ParticleGlyphs.crystallize(svg);
      var nextDelay = self.opts.crystallizeMs +
                      (idx < seq.length ? self.opts.glyphGapMs : 0);
      setTimeout(next, nextDelay);
    }
    next();
  };

  ParticleWhisper.prototype._fadeOut = function (nodes) {
    nodes.forEach(function (n) {
      n.classList.remove('pglyph--state-resonant');
      ParticleGlyphs.setState(n, 'formed');
      n.classList.add('pglyph-whisper__fade');
    });
    var self = this;
    setTimeout(function () {
      self._cleanup(nodes);
      self.active = false;
      self._scheduleNext();
    }, self.opts.fadeMs);
  };

  ParticleWhisper.prototype._cleanup = function (nodes) {
    nodes.forEach(function (n) {
      if (n.parentElement) n.parentElement.removeChild(n);
    });
  };

  // 手動トリガ（debug / 早送り検証用）
  ParticleWhisper.prototype.utterNow = function () {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this._utter();
  };

  // ═══════════════════════════════════════════════════════════
  // 断言レジスター (Statement)
  // ホバー等で即時発話。色を許可。囁きより速く・少し濃く。
  // ═══════════════════════════════════════════════════════════
  var STATEMENT_DEFAULTS = {
    sequences: [
      ['observe', 'pause'],
      ['observe', 'ma'],
      ['i', 'observe'],
      ['observe', 'ellipsis'],
      ['ma', 'observe', 'pause'],
      ['observe']
    ],
    cooldownMs: 4500,
    sizeScale: 1.5,         // whisper の何倍にするか（視認性のため大きめ）
    glyphSize: null,        // 明示指定があればこちら優先
    perGlyphMs: 700,
    holdMin: 2200,
    holdMax: 3600,
    fadeMs: 800
  };

  ParticleWhisper.prototype.speakStatement = function (sequence, options) {
    if (this.stopped) return false;
    var now = Date.now();
    if (now < (this.statementCooldownUntil || 0)) return false;
    if (this.statementActive) return false;
    if (this.active) return false; // 囁きと衝突回避

    var st = Object.assign({}, STATEMENT_DEFAULTS, options || {});
    this.statementCooldownUntil = now + st.cooldownMs;
    this.statementActive = true;

    // 囁きスケジューラを一時停止
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }

    var size = st.glyphSize || Math.round(this.opts.glyphSize * (st.sizeScale || 1));
    var hold = rand(st.holdMin, st.holdMax);
    var self = this;
    var nodes = [];
    var idx = 0;

    function next() {
      if (self.stopped) { self._cleanupStatement(nodes); return; }
      if (idx >= sequence.length) {
        setTimeout(function () { self._fadeOutStatement(nodes); }, hold);
        return;
      }
      var kind = sequence[idx++];
      var svg = ParticleGlyphs.render(kind, 'seed', { size: size });
      svg.classList.add('pglyph-statement__glyph');
      self.statementContainer.appendChild(svg);
      nodes.push(svg);
      ParticleGlyphs.crystallize(svg);
      setTimeout(next, st.perGlyphMs);
    }
    next();
    return true;
  };

  ParticleWhisper.prototype._fadeOutStatement = function (nodes) {
    nodes.forEach(function (n) {
      n.classList.remove('pglyph--state-resonant');
      ParticleGlyphs.setState(n, 'formed');
      n.classList.add('pglyph-statement__fade');
    });
    var self = this;
    setTimeout(function () {
      self._cleanupStatement(nodes);
      self.statementActive = false;
      // 通常スケジュールに戻す
      self._scheduleNext();
    }, STATEMENT_DEFAULTS.fadeMs);
  };

  ParticleWhisper.prototype._cleanupStatement = function (nodes) {
    nodes.forEach(function (n) {
      if (n.parentElement) n.parentElement.removeChild(n);
    });
  };

  // ── ホバー反応バインド ─────────────────────────────────────
  // mouseenter: 入った瞬間
  // mousemove: 入りっぱなしでクールダウン明けたら再発火（throttle 不要、cooldown が gating）
  ParticleWhisper.prototype.bindHover = function (targetEl, options) {
    options = options || {};
    var sequences = options.sequences || STATEMENT_DEFAULTS.sequences;
    var cooldownMs = options.cooldownMs || STATEMENT_DEFAULTS.cooldownMs;
    var self = this;
    var fire = function () {
      var seq = sequences[Math.floor(Math.random() * sequences.length)];
      self.speakStatement(seq, { cooldownMs: cooldownMs });
    };
    targetEl.addEventListener('mouseenter', fire);
    targetEl.addEventListener('mousemove', fire);
    targetEl.addEventListener('pointerenter', fire);
    return fire;
  };

  // ── クリック反応バインド（少し強めの断言・跳躍を匂わせる） ───
  var CLICK_SEQUENCES = [
    ['observe', 'leap', 'pause'],
    ['observe', 'leap', 'ellipsis'],
    ['i', 'observe', 'leap'],
    ['ma', 'observe', 'leap'],
    ['observe', 'resonance'],
    ['observe', 'leap']
  ];

  ParticleWhisper.prototype.bindClick = function (targetEl, options) {
    options = options || {};
    var sequences = options.sequences || CLICK_SEQUENCES;
    var cooldownMs = options.cooldownMs || 2500;     // ホバーより短め
    var sizeScale = options.sizeScale || 1.7;        // ホバーより少し大きい
    var perGlyphMs = options.perGlyphMs || 600;
    var holdMin = options.holdMin || 2800;
    var holdMax = options.holdMax || 4200;
    var self = this;
    var fire = function (ev) {
      // クリックでホバーの cooldown もリセット（クリックは強い意志表示）
      var seq = sequences[Math.floor(Math.random() * sequences.length)];
      self.speakStatement(seq, {
        cooldownMs: cooldownMs,
        sizeScale: sizeScale,
        perGlyphMs: perGlyphMs,
        holdMin: holdMin,
        holdMax: holdMax
      });
    };
    targetEl.addEventListener('click', fire);
    return fire;
  };

  // ── factory: セレクタを polling して自動 attach ────────────
  // opts.hover === false で hover bind を抑制可能。既定は bind する。
  ParticleWhisper.attachToLogo = function (selector, opts) {
    opts = opts || {};
    var attach = function (el) {
      var w = new ParticleWhisper(el, opts);
      w.start();
      if (opts.hover !== false) {
        w.bindHover(el, opts.hoverOptions || {});
      }
      if (opts.click !== false) {
        w.bindClick(el, opts.clickOptions || {});
      }
      return w;
    };
    var found = document.querySelector(selector);
    if (found) return attach(found);

    var ref = { instance: null };
    var tries = 0;
    var iv = setInterval(function () {
      var el = document.querySelector(selector);
      if (el) {
        clearInterval(iv);
        ref.instance = attach(el);
      } else if (++tries > 200) {
        clearInterval(iv);
        console.warn('[ParticleWhisper] logo not found:', selector);
      }
    }, 100);
    return ref;
  };

  global.ParticleWhisper = ParticleWhisper;
})(window);
