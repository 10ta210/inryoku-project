/* ═══════════════════════════════════════════════════════════════════
   inryokü Particle Speech (Rings) — ロゴが円環で喋る
   ───────────────────────────────────────────────────────────────────
   既存の点線記号 (particle_whisper.js) を置き換える、
   円環粒子言語 (particle_rings.js) ベースの発話モジュール。

   レジスター:
     whisper  — 30〜90s ランダム / canon: core, ma, shadow, silence, echo
     hover    — mouseenter / canon: observation, self_question
     click    — click / canon: resonance, emit, declaration
     summon() — 任意呼び出し / canon: summon
     revelation() — 任意呼び出し / canon: revelation

   API:
     ParticleSpeechRings.attachToLogo('.logo-holo-wrap', { ... });
   ─────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  var DEFAULTS = {
    whisperSize: 72,
    hoverSize:   88,
    clickSize:   102,
    summonSize:  124,
    revelationSize: 124,

    initialDelayMin: 6000,
    initialDelayMax: 14000,
    minInterval: 30000,
    maxInterval: 90000,

    crystallizeMs: 1900,   // ring の結晶化完了想定
    holdMin: 2800,
    holdMax: 4400,
    fadeMs: 1200,

    hoverCooldownMs: 4500,
    clickCooldownMs: 2500,

    placement: 'halo',     // 'halo' = ロゴ中心に同心配置 / 'below' = 真下
    offsetY: 12,
    haloScale: 0.72
  };

  var REGISTER_OPACITY = {
    whisper: 0.46,
    hover: 0.72,
    click: 0.84,
    special: 0.9
  };

  var REGISTER_HALO_SCALE = {
    whisper: 0.56,
    hover: 0.62,
    click: 0.68,
    special: 0.72
  };

  var REGISTER_SIZE_CAP = {
    whisper: 0.72,
    hover: 0.86,
    click: 0.98,
    special: 1.08
  };

  var REGISTER_SIZE_FLOOR = {
    whisper: { mobile: 0.34, desktop: 0.28, pxMobile: 28, pxDesktop: 34 },
    hover:   { mobile: 0.42, desktop: 0.35, pxMobile: 34, pxDesktop: 42 },
    click:   { mobile: 0.50, desktop: 0.43, pxMobile: 40, pxDesktop: 50 },
    special: { mobile: 0.56, desktop: 0.48, pxMobile: 48, pxDesktop: 58 }
  };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function getCanonMeta() { return global.InryokuCanonMeta || null; }
  function getRegisterMeta(name) {
    var meta = getCanonMeta();
    return meta && typeof meta.getRegister === 'function' ? meta.getRegister(name) : null;
  }
  function getCanonConfig(name) {
    var meta = getCanonMeta();
    return meta && typeof meta.getCanon === 'function' ? meta.getCanon(name) : null;
  }

  function ParticleSpeechRings(logoEl, opts) {
    if (!logoEl) throw new Error('[ParticleSpeechRings] logo element required');
    if (!global.ParticleRings) {
      throw new Error('[ParticleSpeechRings] ParticleRings not loaded');
    }
    this.logo = logoEl;
    this.opts = Object.assign({}, DEFAULTS, opts || {});
    this.container = null;
    this.timer = null;
    this.active = false;
    this.stopped = false;
    this.cooldownUntil = { hover: 0, click: 0 };
    this._cleanupFns = [];
    this._haloFrame = 0;
    this._holdTimer = null;
    this._fadeTimer = null;
    this._currentRing = null;
    this._currentSpeech = null;
    this._pendingSpeech = null;
  }

  ParticleSpeechRings.prototype.start = function () {
    this.stopped = false;
    this._mount();
    var self = this;
    var d = rand(this.opts.initialDelayMin, this.opts.initialDelayMax);
    this.timer = setTimeout(function () { self._utter('whisper'); }, d);
  };

  ParticleSpeechRings.prototype.stop = function () {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this._cancelCurrentSpeech('stop');
    this._pendingSpeech = null;
  };

  ParticleSpeechRings.prototype.destroy = function () {
    this.stop();
    while (this._cleanupFns.length) {
      try { this._cleanupFns.pop()(); } catch (err) {}
    }
    if (this._haloFrame) {
      cancelAnimationFrame(this._haloFrame);
      this._haloFrame = 0;
    }
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
    if (this.logo && this.logo.__inryokuParticleSpeechRings === this) {
      try { delete this.logo.__inryokuParticleSpeechRings; } catch (err) {
        this.logo.__inryokuParticleSpeechRings = null;
      }
    }
  };

  ParticleSpeechRings.prototype._mount = function () {
    if (this.container && this.container.isConnected) return;
    // 親 (.hologram-logo) を host にしてロゴと干渉しない
    var host = this.logo.closest('.hologram-logo') || this.logo.parentElement || this.logo;
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }
	    var c = document.createElement('div');
	    c.className = 'pring-speech pring-speech--' + this.opts.placement;
	    c.style.setProperty('--prs-offset-y', this.opts.offsetY + 'px');
	    c.style.setProperty('--prs-halo-scale', String(this.opts.haloScale || 1));
	    host.appendChild(c);
	    this.container = c;

    // halo モードはロゴ要素の中心座標を offset として記録
    if (this.opts.placement === 'halo') {
      this._updateHaloPosition();
      this._bindHaloTracking();
    }
  };

  ParticleSpeechRings.prototype._bindHaloTracking = function () {
    var self = this;
    var ticking = false;
    function sync() {
      ticking = false;
      self._updateHaloPosition();
    }
    function requestSync() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sync);
    }
    window.addEventListener('resize', requestSync, { passive: true });
    window.addEventListener('scroll', requestSync, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', requestSync, { passive: true });
      window.visualViewport.addEventListener('scroll', requestSync, { passive: true });
    }
    var resizeObserver = null;
    var anchor = this._getHaloAnchor();
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(requestSync);
      try {
        resizeObserver.observe(this.logo);
        if (anchor && anchor !== this.logo) {
          resizeObserver.observe(anchor);
        }
        if (this.container && this.container.parentElement) {
          resizeObserver.observe(this.container.parentElement);
        }
      } catch (err) {}
    }
    this._cleanupFns.push(function () {
      window.removeEventListener('resize', requestSync);
      window.removeEventListener('scroll', requestSync);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', requestSync);
        window.visualViewport.removeEventListener('scroll', requestSync);
      }
      if (resizeObserver) resizeObserver.disconnect();
    });
  };

  ParticleSpeechRings.prototype._getHaloAnchor = function () {
    if (!this.logo || !this.logo.isConnected) return this.logo;
    var sphere3d = this.logo.querySelector('.logo-sphere-3d');
    if (sphere3d && sphere3d.isConnected) {
      var sphereRect = sphere3d.getBoundingClientRect();
      if (sphereRect.width > 0 && sphereRect.height > 0) return sphere3d;
    }
    return this.logo;
  };

  ParticleSpeechRings.prototype._scheduleHaloSettle = function (frames) {
    var self = this;
    if (this.opts.placement !== 'halo') return;
    frames = frames || 10;
    if (this._haloFrame) cancelAnimationFrame(this._haloFrame);
    function tick() {
      self._haloFrame = 0;
      self._updateHaloPosition();
      if (frames > 0) {
        frames -= 1;
        self._haloFrame = requestAnimationFrame(tick);
      }
    }
    this._haloFrame = requestAnimationFrame(tick);
  };

  // ロゴの位置を取得して halo 中心を合わせる
  ParticleSpeechRings.prototype._updateHaloPosition = function () {
    if (!this.container || this.opts.placement !== 'halo') return;
    if (!this.logo.isConnected || !this.container.parentElement) return;
    var anchor = this._getHaloAnchor();
    var lr = (anchor || this.logo).getBoundingClientRect();
    var hr = this.container.parentElement.getBoundingClientRect();
    if (!lr.width || !lr.height || !hr.width || !hr.height) return;
    // ロゴ中心 - ホスト原点 = ホスト内でのロゴ中心座標
    var cx = (lr.left + lr.width / 2) - hr.left;
    var cy = (lr.top + lr.height / 2) - hr.top;
    this.container.style.top = cy + 'px';
    this.container.style.left = cx + 'px';
  };

  ParticleSpeechRings.prototype._isMobileViewport = function () {
    if (global.matchMedia) {
      try { return global.matchMedia('(max-width: 767px)').matches; } catch (err) {}
    }
    var width = global.innerWidth || document.documentElement.clientWidth || 0;
    return width > 0 && width <= 767;
  };

  ParticleSpeechRings.prototype._setSpeechDataState = function (active, register, canonName) {
    var body = document.body;
    var phaseRule = null;
    var meta = getCanonMeta();
    if (meta && typeof meta.getPhaseRule === 'function') {
      phaseRule = meta.getPhaseRule(canonName, register);
    }
    var phase = phaseRule && phaseRule.phase ? phaseRule.phase : 'idle';
    if (!body) return;
    if (active) {
      body.setAttribute('data-inryoku-speech-register', register || 'whisper');
      body.setAttribute('data-inryoku-speech-canon', canonName || 'silence');
      body.setAttribute('data-inryoku-speech-phase', phase);
    } else {
      body.removeAttribute('data-inryoku-speech-register');
      body.removeAttribute('data-inryoku-speech-canon');
      body.removeAttribute('data-inryoku-speech-phase');
    }
  };

  ParticleSpeechRings.prototype._setRingVisualState = function (ring, register, canonName, size) {
    var opacity = REGISTER_OPACITY[register] || REGISTER_OPACITY.special;
    var sizeKey = this._getSizeKey(canonName, register);
    var resolvedSize = size || (sizeKey ? this.opts[sizeKey] : this.opts.hoverSize) || this.opts.hoverSize;
    var haloScale = REGISTER_HALO_SCALE[register] || this.opts.haloScale || 1;
    var anchor = this._getHaloAnchor();
    if (anchor && typeof anchor.getBoundingClientRect === 'function') {
      var anchorRect = anchor.getBoundingClientRect();
      var capRatio = REGISTER_SIZE_CAP[register] || REGISTER_SIZE_CAP.special;
      var floorRule = REGISTER_SIZE_FLOOR[register] || REGISTER_SIZE_FLOOR.special;
      var isMobile = this._isMobileViewport();
      var sizeFloor = Math.max(
        isMobile ? floorRule.pxMobile : floorRule.pxDesktop,
        Math.round(anchorRect.width * (isMobile ? floorRule.mobile : floorRule.desktop))
      );
      var cap = Math.max(sizeFloor, Math.round(anchorRect.width * capRatio));
      resolvedSize = clamp(Math.round(resolvedSize), sizeFloor, cap);
    }
    ring.style.setProperty('--pring-speech-target-opacity', opacity);
    ring.style.setProperty('--pring-speech-current-opacity', opacity);
    ring.style.setProperty('--pring-speech-size', resolvedSize + 'px');
    ring.style.setProperty('--prs-halo-scale', String(haloScale));
  };

  ParticleSpeechRings.prototype._getPriority = function (register) {
    var registerMeta = getRegisterMeta(register);
    return registerMeta ? registerMeta.priority : 0;
  };

  ParticleSpeechRings.prototype._getSpeechPriority = function (register, canonName) {
    var canon = getCanonConfig(canonName);
    return canon && typeof canon.priority === 'number'
      ? canon.priority
      : this._getPriority(register);
  };

  ParticleSpeechRings.prototype._getSizeKey = function (canonName, register) {
    var meta = getCanonMeta();
    if (meta && typeof meta.getSizeKey === 'function') {
      return meta.getSizeKey(canonName, register);
    }
    var registerMeta = getRegisterMeta(register);
    return (registerMeta && registerMeta.fallbackSizeKey) || 'hoverSize';
  };

  ParticleSpeechRings.prototype._getRegisterVocab = function (register) {
    var meta = getCanonMeta();
    if (meta && typeof meta.listByTrigger === 'function') {
      var vocab = meta.listByTrigger(register);
      if (Array.isArray(vocab) && vocab.length) return vocab;
    }
    return [];
  };

  ParticleSpeechRings.prototype._resolveCanonRegister = function (canonName, fallbackRegister) {
    var meta = getCanonMeta();
    if (meta && typeof meta.getRegisterClass === 'function') {
      return meta.getRegisterClass(canonName, fallbackRegister);
    }
    return fallbackRegister || 'hover';
  };

  ParticleSpeechRings.prototype._clearSpeechTimers = function () {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
    }
  };

  ParticleSpeechRings.prototype._cancelCurrentSpeech = function (reason) {
    this._clearSpeechTimers();
    if (this._currentRing && this._currentRing.parentElement) {
      this._currentRing.parentElement.removeChild(this._currentRing);
    }
    this._currentRing = null;
    this.active = false;
    this._currentSpeech = null;
    this._setSpeakingState(false, reason || 'cancel', 'silence');
  };

  ParticleSpeechRings.prototype._queueSpeech = function (register, options) {
    var incoming = { register: register, options: options || {} };
    if (!this._pendingSpeech ||
        this._getSpeechPriority(register, incoming.options.canon) >=
          this._getSpeechPriority(this._pendingSpeech.register, this._pendingSpeech.options.canon)) {
      this._pendingSpeech = incoming;
    }
    return false;
  };

  ParticleSpeechRings.prototype._flushPendingSpeech = function () {
    if (!this._pendingSpeech || this.stopped) return false;
    var next = this._pendingSpeech;
    this._pendingSpeech = null;
    return this._utter(next.register, next.options);
  };

  ParticleSpeechRings.prototype._scheduleNext = function () {
    if (this.stopped) return;
    var self = this;
    var d = rand(this.opts.minInterval, this.opts.maxInterval);
    this.timer = setTimeout(function () { self._utter('whisper'); }, d);
  };

  ParticleSpeechRings.prototype._setSpeakingState = function (active, register, canonName) {
    var body = document.body;
    if (body) body.classList.toggle('inryoku-speaking', !!active);
    this._setSpeechDataState(active, register, canonName);
    if (global._p3LogoSphere3D) {
      try {
        if (active && typeof global._p3LogoSphere3D.setSpeechCanon === 'function') {
          global._p3LogoSphere3D.setSpeechCanon(canonName, register);
        } else if (!active && typeof global._p3LogoSphere3D.clearSpeechCanon === 'function') {
          global._p3LogoSphere3D.clearSpeechCanon();
        }
      } catch (err) {
        console.warn('[ParticleSpeechRings] logo sync failed:', err);
      }
    }
    try {
      global.dispatchEvent(new CustomEvent(active ? 'inryoku:ringstart' : 'inryoku:ringend', {
        detail: { register: register, canon: canonName }
      }));
    } catch (err) {}
  };

  ParticleSpeechRings.prototype._utter = function (register, options) {
    if (this.stopped) return false;
    options = options || {};
    var requestedCanon = options.canon || null;
    if (this.active) {
      var currentPriority = this._currentSpeech
        ? this._getSpeechPriority(this._currentSpeech.register, this._currentSpeech.canon)
        : 0;
      var incomingPriority = this._getSpeechPriority(register, requestedCanon);
      if (incomingPriority > currentPriority) {
        this._cancelCurrentSpeech('preempt');
      } else {
        return this._queueSpeech(register, options);
      }
    }
    this._mount();

	    // クールダウン判定
	    if (!options.canon && (register === 'hover' || register === 'click')) {
	      var now = Date.now();
	      if (now < this.cooldownUntil[register]) return false;
	      this.cooldownUntil[register] =
	        now + (register === 'hover' ? this.opts.hoverCooldownMs : this.opts.clickCooldownMs);
	    }

	    var vocab, size;
	    if (register === 'whisper')      { vocab = this._getRegisterVocab('whisper'); size = this.opts.whisperSize; }
	    else if (register === 'hover')   { vocab = this._getRegisterVocab('hover');   size = this.opts.hoverSize; }
	    else if (register === 'click')   { vocab = this._getRegisterVocab('click');   size = this.opts.clickSize; }
	    else if (register === 'special') {
	      vocab = [options.canon];
	      size = options.size || this.opts[this._getSizeKey(options.canon, 'special')] || this.opts.revelationSize || 180;
	    } else {
	      return false;
	    }

    var canonName = options.canon || pick(vocab);
    if (!canonName && options.canon) canonName = options.canon;
    if (!ParticleRings.CANON[canonName]) {
      console.warn('[ParticleSpeechRings] canon not found:', canonName);
      return false;
    }

    this.active = true;
    this._currentSpeech = { register: register, canon: canonName };
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this._updateHaloPosition();
    this._setSpeakingState(true, register, canonName);

    var ring = ParticleRings.canon(canonName, { size: size });
    ring.classList.add('pring-speech__ring', 'pring-speech__ring--' + register);
    this._setRingVisualState(ring, register, canonName, size);
    this.container.appendChild(ring);
    ParticleRings.crystallize(ring);
    this._scheduleHaloSettle(12);
    this._currentRing = ring;

    var hold = rand(this.opts.holdMin, this.opts.holdMax);
    var self = this;
    this._holdTimer = setTimeout(function () {
      self._holdTimer = null;
      ring.classList.add('pring-speech__ring--fade');
      self._fadeTimer = setTimeout(function () {
        self._fadeTimer = null;
        if (ring.parentElement) ring.parentElement.removeChild(ring);
        self._currentRing = null;
        self.active = false;
        self._currentSpeech = null;
        self._setSpeakingState(false, register, canonName);
        if (self._flushPendingSpeech()) return;
        // whisper のみ次サイクルへ
        if (register === 'whisper') self._scheduleNext();
      }, self.opts.fadeMs);
    }, this.opts.crystallizeMs + hold);

    return true;
  };

  // ── デバッグ / 任意発話 ─────────────────────────────────
  ParticleSpeechRings.prototype.utterNow = function (register) {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    return this._utter(register || 'whisper');
  };

  ParticleSpeechRings.prototype.summon = function () {
    return this.speakCanon('summon', 'special');
  };

  ParticleSpeechRings.prototype.revelation = function () {
    return this.speakCanon('revelation', 'special');
  };

  ParticleSpeechRings.prototype.speakCanon = function (canonName, register) {
    var resolvedRegister = this._resolveCanonRegister(canonName, register === 'special' ? 'special' : register);
    var sizeKey = this._getSizeKey(canonName, resolvedRegister);
    return this._utter(resolvedRegister, {
      canon: canonName,
      size: this.opts[sizeKey] || this.opts.hoverSize
    });
  };

  // ── ホバー / クリック バインド ─────────────────────────
  ParticleSpeechRings.prototype.bindHover = function (targetEl) {
    var self = this;
    var fire = function () { self._utter('hover'); };
    targetEl.addEventListener('mouseenter', fire);
    targetEl.addEventListener('pointerenter', fire);
    this._cleanupFns.push(function () {
      targetEl.removeEventListener('mouseenter', fire);
      targetEl.removeEventListener('pointerenter', fire);
    });
    return fire;
  };

  ParticleSpeechRings.prototype.bindClick = function (targetEl) {
    var self = this;
    var fire = function () { self._utter('click'); };
    targetEl.addEventListener('click', fire);
    this._cleanupFns.push(function () {
      targetEl.removeEventListener('click', fire);
    });
    return fire;
  };

  // ── factory: ロゴ要素を polling して自動 attach ────────
  ParticleSpeechRings.attachToLogo = function (selector, opts) {
    opts = opts || {};
    ParticleSpeechRings._controllers = ParticleSpeechRings._controllers || {};
    if (ParticleSpeechRings._controllers[selector]) {
      return ParticleSpeechRings._controllers[selector];
    }
    var controller = null;
    var attach = function (el) {
      if (el.__inryokuParticleSpeechRings) return el.__inryokuParticleSpeechRings;
      var w = new ParticleSpeechRings(el, opts);
      w.start();
      if (opts.hover !== false) w.bindHover(el);
      if (opts.click !== false) w.bindClick(el);
      el.__inryokuParticleSpeechRings = w;
      return w;
    };
    controller = {
      instance: null,
      get ready() { return !!this.instance; },
      start: function () { return this.instance && this.instance.start(); },
      stop: function () { return this.instance && this.instance.stop(); },
      utterNow: function (register) { return this.instance && this.instance.utterNow(register); },
      summon: function () { return this.instance && this.instance.summon(); },
      revelation: function () { return this.instance && this.instance.revelation(); },
      speakCanon: function (canonName, register) { return this.instance && this.instance.speakCanon(canonName, register); },
      bindHover: function (targetEl) { return this.instance && this.instance.bindHover(targetEl); },
      bindClick: function (targetEl) { return this.instance && this.instance.bindClick(targetEl); },
      destroy: function () {
        if (observer) observer.disconnect();
        if (iv) clearInterval(iv);
        if (this.instance) this.instance.destroy();
        delete ParticleSpeechRings._controllers[selector];
      }
    };
    ParticleSpeechRings._controllers[selector] = controller;
    var found = document.querySelector(selector);
    if (found) {
      controller.instance = attach(found);
      return controller;
    }

    var tries = 0;
    var iv = null;
    var observer = null;
    var connect = function () {
      var el = document.querySelector(selector);
      if (!el) return false;
      if (observer) observer.disconnect();
      if (iv) clearInterval(iv);
      controller.instance = attach(el);
      return true;
    };
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(connect);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      if (connect()) return controller;
    }
    iv = setInterval(function () {
      if (connect()) return;
      if (++tries > 200) {
        clearInterval(iv);
        if (observer) observer.disconnect();
        delete ParticleSpeechRings._controllers[selector];
        console.warn('[ParticleSpeechRings] logo not found:', selector);
      }
    }, 100);
    return controller;
  };

  global.ParticleSpeechRings = ParticleSpeechRings;
})(typeof window !== 'undefined' ? window : this);
