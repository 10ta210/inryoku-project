/* ──────────────────────────────────────────────────────────────────────────
 *  states.js — inryokü 空状態 / 読み込み中 / エラー UX 統一レイヤ
 *  2026-04-28
 *
 *  目的:
 *    - showLoading / showEmpty / showError / hide を全画面で同一作法に統一
 *    - aria-live で SR にも届ける
 *    - inryokü 美学: grey ベース / 静謐 / 余白 / 装飾過多回避
 *
 *  非破壊原則:
 *    - error-shield.js / enhance.js / p3_code_for_claude.js には触らない
 *    - target 要素の既存子要素は state 表示中のみ aria-hidden=true、解除時に元に戻す
 *    - 重複起動防止 (window.__inryokuStates)
 *    - 同一 target に対する多重表示は最後の指示で置換 (前を hide してから新規表示)
 *
 *  公開 API:
 *    window.inryokuStates.showLoading(target, opts)
 *    window.inryokuStates.showEmpty(target, opts)
 *    window.inryokuStates.showError(target, opts)
 *    window.inryokuStates.hide(target)
 *    window.inryokuStates.MESSAGES   // 文言辞書 (read-only 推奨)
 *
 *  opts:
 *    { message?: string, sub?: string, role?: 'status'|'alert', kind?: string }
 *
 *  依存: なし (vanilla)
 * ────────────────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  if (!root || typeof root.document === 'undefined') return;
  if (root.__inryokuStates) return;
  root.__inryokuStates = true;
  var window = root;
  var document = root.document;

  // ── 文言辞書 (inryokü philosophy) ──
  var MESSAGES = {
    cartEmpty:        'the cart is empty. observation begins here.',
    productLoading:   'the wave forms...',
    aiThinking:       'the observer thinks...',
    searchEmpty:      'no signal in this direction.',
    networkError:     'the connection is grey.',
    completed:        'the wave reached you.',
    validation:       'this needs more shape.',
    // generic fallbacks
    loading:          'the wave forms...',
    empty:            'silence is also a color.',
    error:            'the connection is grey.'
  };

  // ── 内部状態 ──
  // target 要素ごとに { node, prevHidden: Map<el,bool> } を保持
  var registry = new WeakMap();

  function resolveTarget(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    if (target.nodeType === 1) return target;
    return null;
  }

  function escText(s) {
    // textContent 使うので XSS は無いが、念のため string 化
    return s == null ? '' : String(s);
  }

  function buildStateNode(kind, opts) {
    opts = opts || {};
    var doc = document;
    var wrap = doc.createElement('div');
    wrap.className = 'inryoku-state state-' + kind;
    wrap.setAttribute('data-inryoku-state', kind);

    // a11y
    var role = opts.role || (kind === 'error' ? 'alert' : 'status');
    var live = (kind === 'error') ? 'assertive' : 'polite';
    wrap.setAttribute('role', role);
    wrap.setAttribute('aria-live', live);
    wrap.setAttribute('aria-busy', kind === 'loading' ? 'true' : 'false');

    // glyph (静的・装飾最小)
    var glyph = doc.createElement('span');
    glyph.className = 'inryoku-state__glyph';
    glyph.setAttribute('aria-hidden', 'true');
    if (kind === 'loading') {
      glyph.textContent = '·  ·  ·';
    } else if (kind === 'empty') {
      glyph.textContent = '—';
    } else {
      glyph.textContent = '·';
    }
    wrap.appendChild(glyph);

    // message
    var msg = doc.createElement('p');
    msg.className = 'inryoku-state__message';
    var defaultMsg = (kind === 'loading') ? MESSAGES.loading
                   : (kind === 'empty')   ? MESSAGES.empty
                   :                        MESSAGES.error;
    msg.textContent = escText(opts.message || defaultMsg);
    wrap.appendChild(msg);

    // sub (任意)
    if (opts.sub) {
      var sub = doc.createElement('p');
      sub.className = 'inryoku-state__sub';
      sub.textContent = escText(opts.sub);
      wrap.appendChild(sub);
    }

    // kind tag (CSS hook 用)
    if (opts.kind) {
      wrap.setAttribute('data-kind', String(opts.kind));
    }

    return wrap;
  }

  function hide(target) {
    var el = resolveTarget(target);
    if (!el) return false;
    var entry = registry.get(el);
    if (!entry) return false;

    // 既存子の aria-hidden を戻す
    if (entry.prevHidden) {
      entry.prevHidden.forEach(function (prev, child) {
        if (prev === null) {
          child.removeAttribute('aria-hidden');
        } else {
          child.setAttribute('aria-hidden', prev);
        }
      });
    }

    if (entry.node && entry.node.parentNode === el) {
      el.removeChild(entry.node);
    }
    el.removeAttribute('data-inryoku-state');
    el.removeAttribute('aria-busy');
    registry.delete(el);
    return true;
  }

  function show(kind, target, opts) {
    var el = resolveTarget(target);
    if (!el) return null;

    // 多重表示制御: 既存があれば一旦 hide
    if (registry.has(el)) {
      hide(el);
    }

    // 既存子を aria-hidden=true にして読み上げ衝突を防ぐ
    var prevHidden = new Map();
    var children = el.children;
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      prevHidden.set(c, c.getAttribute('aria-hidden'));
      c.setAttribute('aria-hidden', 'true');
    }

    var node = buildStateNode(kind, opts);
    el.appendChild(node);
    el.setAttribute('data-inryoku-state', kind);
    if (kind === 'loading') {
      el.setAttribute('aria-busy', 'true');
    }

    registry.set(el, { node: node, prevHidden: prevHidden, kind: kind });
    return node;
  }

  var api = {
    showLoading: function (target, opts) { return show('loading', target, opts); },
    showEmpty:   function (target, opts) { return show('empty',   target, opts); },
    showError:   function (target, opts) { return show('error',   target, opts); },
    hide:        hide,
    MESSAGES:    MESSAGES,
    // 内部参照 (テスト用)
    _registry:   registry
  };

  window.inryokuStates = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : null)));
