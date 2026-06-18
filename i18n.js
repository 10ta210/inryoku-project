/**
 * i18n.js — inryokü 言語切替の薄い土台
 * ─────────────────────────────────────────────────────────────
 * 設計方針:
 *   - 日本語が 1st language。en は明示的切替時のみ。
 *   - 既存 DOM を破壊しない後付け方式。
 *   - data-i18n="key" / data-i18n-attr="attr:key,attr2:key2" を翻訳。
 *   - URL ?lang=en or /en/ パスプレフィックス、localStorage、Accept-Language の順で判定。
 *   - SSR なし。CSR のみ。
 *
 * グローバル: window.inryokuI18n = { t, getLang, setLang, ready, dict }
 *
 * 触らない: p3_code_for_claude.js / particle_*.* / p3_styles.css / server.js
 * 依存: なし (vanilla JS)
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'inryoku.lang';
  var DEFAULT_LANG = 'ja';
  var SUPPORTED = ['ja', 'en', 'ko'];
  // 2026-05-05: KO 追加に伴い辞書 URL に v= を付与（ブラウザキャッシュ無効化）
  var DICT_URL = 'i18n.json?v=20260506back';

  var state = {
    lang: DEFAULT_LANG,
    dict: null,
    ready: false,
    listeners: []
  };

  // ── 言語判定 ──────────────────────────────────────────────
  function detectLang() {
    try {
      // 1) URL クエリ ?lang=en
      var qs = new URLSearchParams(window.location.search);
      var q = qs.get('lang');
      if (q && SUPPORTED.indexOf(q) !== -1) return q;

      // 2) パスプレフィックス /en/...
      var path = window.location.pathname || '';
      var seg = path.split('/').filter(Boolean)[0];
      if (seg && SUPPORTED.indexOf(seg) !== -1) return seg;

      // 3) localStorage
      var stored = null;
      try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode */ }
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;

      // 4) Accept-Language (ja は強くデフォルト維持。en* / ko* のみ倒す)
      var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (nav.indexOf('ko') === 0) return 'ko';
      if (nav.indexOf('en') === 0) return 'en';

      return DEFAULT_LANG;
    } catch (err) {
      return DEFAULT_LANG;
    }
  }

  // ── 辞書ロード ────────────────────────────────────────────
  function loadDict() {
    return fetch(DICT_URL, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('i18n.json fetch failed: ' + r.status);
        return r.json();
      })
      .then(function (json) {
        state.dict = json;
        state.ready = true;
        return json;
      })
      .catch(function (err) {
        console.warn('[i18n] dict load failed, falling back to ja-only', err);
        state.dict = {};
        state.ready = true;
      });
  }

  // ── 翻訳取得 ──────────────────────────────────────────────
  function t(key, fallback) {
    if (!state.dict || !state.dict[key]) {
      return fallback != null ? fallback : key;
    }
    var entry = state.dict[key];
    if (entry && typeof entry === 'object') {
      return entry[state.lang] || entry[DEFAULT_LANG] || (fallback != null ? fallback : key);
    }
    return fallback != null ? fallback : key;
  }

  // ── DOM 適用 ──────────────────────────────────────────────
  function applyDom(root) {
    if (!state.ready) return;
    root = root || document;

    // <html lang="..."> を更新
    if (document.documentElement) {
      var htmlLang = 'ja';
      if (state.lang === 'en') htmlLang = 'en';
      else if (state.lang === 'ko') htmlLang = 'ko';
      document.documentElement.setAttribute('lang', htmlLang);
    }

    // data-i18n="key" → textContent
    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var key = n.getAttribute('data-i18n');
      if (!key) continue;
      // 元コピーを保持 (初回のみ)
      if (!n.hasAttribute('data-i18n-orig')) {
        n.setAttribute('data-i18n-orig', n.textContent);
      }
      var val = t(key, n.getAttribute('data-i18n-orig'));
      n.textContent = val;
    }

    // data-i18n-attr="placeholder:key,aria-label:key2"
    var attrNodes = root.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var an = attrNodes[j];
      var spec = an.getAttribute('data-i18n-attr') || '';
      var pairs = spec.split(',');
      for (var k = 0; k < pairs.length; k++) {
        var p = pairs[k].split(':');
        if (p.length !== 2) continue;
        var attr = p[0].trim();
        var akey = p[1].trim();
        if (!attr || !akey) continue;
        var origAttr = 'data-i18n-attr-orig-' + attr;
        if (!an.hasAttribute(origAttr)) {
          an.setAttribute(origAttr, an.getAttribute(attr) || '');
        }
        an.setAttribute(attr, t(akey, an.getAttribute(origAttr)));
      }
    }
  }

  // ── 言語切替 ──────────────────────────────────────────────
  function setLang(lang, opts) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    state.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    if (!opts || opts.updateUrl !== false) {
      try {
        var url = new URL(window.location.href);
        if (lang === DEFAULT_LANG) {
          url.searchParams.delete('lang');
        } else {
          url.searchParams.set('lang', lang);
        }
        window.history.replaceState({}, '', url.toString());
      } catch (e) {}
    }
    applyDom();
    fireChange();
  }

  function getLang() { return state.lang; }

  function onChange(fn) {
    if (typeof fn === 'function') state.listeners.push(fn);
    return function off() {
      var i = state.listeners.indexOf(fn);
      if (i !== -1) state.listeners.splice(i, 1);
    };
  }

  function fireChange() {
    for (var i = 0; i < state.listeners.length; i++) {
      try { state.listeners[i](state.lang); } catch (e) { /* swallow */ }
    }
    try {
      window.dispatchEvent(new CustomEvent('inryoku:langchange', { detail: { lang: state.lang } }));
    } catch (e) {}
  }

  // ── 言語切替 UI 注入 (控えめ・フッター右下) ────────────────
  function injectToggleUi() {
    if (document.getElementById('inryoku-lang-toggle')) return;
    var wrap = document.createElement('div');
    wrap.id = 'inryoku-lang-toggle';
    wrap.setAttribute('role', 'group');
    var ariaByLang = {
      ja: '言語: 日本語 / English / 한국어',
      en: 'Language: 日本語 / English / 한국어',
      ko: '언어: 日本語 / English / 한국어'
    };
    wrap.setAttribute('aria-label', ariaByLang[state.lang] || ariaByLang.ja);

    var btnJa = document.createElement('button');
    btnJa.type = 'button';
    btnJa.className = 'inryoku-lang-btn' + (state.lang === 'ja' ? ' is-active' : '');
    btnJa.setAttribute('data-lang', 'ja');
    btnJa.setAttribute('aria-label', '日本語に切り替え');
    btnJa.textContent = 'JA';

    var sep1 = document.createElement('span');
    sep1.className = 'inryoku-lang-sep';
    sep1.textContent = '/';
    sep1.setAttribute('aria-hidden', 'true');

    var btnEn = document.createElement('button');
    btnEn.type = 'button';
    btnEn.className = 'inryoku-lang-btn' + (state.lang === 'en' ? ' is-active' : '');
    btnEn.setAttribute('data-lang', 'en');
    btnEn.setAttribute('aria-label', 'Switch to English');
    btnEn.textContent = 'EN';

    var sep2 = document.createElement('span');
    sep2.className = 'inryoku-lang-sep';
    sep2.textContent = '/';
    sep2.setAttribute('aria-hidden', 'true');

    var btnKo = document.createElement('button');
    btnKo.type = 'button';
    btnKo.className = 'inryoku-lang-btn' + (state.lang === 'ko' ? ' is-active' : '');
    btnKo.setAttribute('data-lang', 'ko');
    var koAriaByLang = {
      ja: '韓国語に切り替え',
      en: 'Switch to Korean',
      ko: '한국어로 전환'
    };
    btnKo.setAttribute('aria-label', koAriaByLang[state.lang] || koAriaByLang.ja);
    btnKo.textContent = 'KO';

    btnJa.addEventListener('click', function () { setLang('ja'); refreshActive(); });
    btnEn.addEventListener('click', function () { setLang('en'); refreshActive(); });
    btnKo.addEventListener('click', function () { setLang('ko'); refreshActive(); });

    function refreshActive() {
      btnJa.classList.toggle('is-active', state.lang === 'ja');
      btnEn.classList.toggle('is-active', state.lang === 'en');
      btnKo.classList.toggle('is-active', state.lang === 'ko');
      // aria 同期
      btnKo.setAttribute('aria-label', koAriaByLang[state.lang] || koAriaByLang.ja);
      wrap.setAttribute('aria-label', ariaByLang[state.lang] || ariaByLang.ja);
    }

    wrap.appendChild(btnJa);
    wrap.appendChild(sep1);
    wrap.appendChild(btnEn);
    wrap.appendChild(sep2);
    wrap.appendChild(btnKo);
    document.body.appendChild(wrap);

    // CSS が未ロードでも最低限は機能するインライン保険
    if (!document.querySelector('link[href*="i18n.css"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'i18n.css';
      document.head.appendChild(link);
    }

    onChange(refreshActive);
  }

  // ── 初期化 ────────────────────────────────────────────────
  function init() {
    state.lang = detectLang();
    loadDict().then(function () {
      applyDom();
      // UI は本番動作確認後に有効化したい場合に切り替え可。今は常時表示。
      injectToggleUi();
      fireChange();
    });
  }

  // ── 公開 API ──────────────────────────────────────────────
  window.inryokuI18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    onChange: onChange,
    applyDom: applyDom,
    isReady: function () { return state.ready; },
    SUPPORTED: SUPPORTED,
    DEFAULT_LANG: DEFAULT_LANG
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
