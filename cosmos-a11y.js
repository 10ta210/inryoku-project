// cosmos-a11y.js — inryokü P3 accessibility layer
// ESM. Self-contained. Aim: WCAG 2.1 AA.
//
// Exports: applyA11y(opts) → {
//   announce(msg, priority), focusTrap(el), releaseFocus(),
//   reduceMotion (boolean — live), onReduceMotionChange(cb),
//   dispose
// }
//
// Hard rules:
//  - reduceMotion is the single source of truth, subscribed by other layers
//  - never auto-plays audio (gesture-gated upstream)
//  - aria-live polite + assertive announcer regions are injected once
//  - focus trap for the gesture / modal overlays (WCAG 2.1.2)
//  - keyboard handler: '?' = help, 'm' = mute, Escape = close overlay
//  - light=0.5 always for accents (inryokü 白黒禁則)

const SR_ONLY_STYLE = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;'
  + 'overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function applyA11y(opts = {}) {
  const cfg = {
    root: opts.root || (typeof document !== 'undefined' ? document.body : null),
    audio: opts.audio || null,
    helpHtml: opts.helpHtml || null,
    enableKeyboard: opts.enableKeyboard !== false,
    enableHelpDialog: opts.enableHelpDialog !== false,
    ...opts
  };

  if (!cfg.root) {
    return {
      announce() {}, focusTrap() {}, releaseFocus() {},
      reduceMotion: false, onReduceMotionChange() { return () => {}; },
      dispose() {}
    };
  }

  // ───── aria-live announcer regions ─────────────────────────────
  const politeEl = document.createElement('div');
  politeEl.setAttribute('aria-live', 'polite');
  politeEl.setAttribute('aria-atomic', 'true');
  politeEl.setAttribute('role', 'status');
  politeEl.id = 'cosmos-a11y-live-polite';
  politeEl.style.cssText = SR_ONLY_STYLE;

  const assertiveEl = document.createElement('div');
  assertiveEl.setAttribute('aria-live', 'assertive');
  assertiveEl.setAttribute('aria-atomic', 'true');
  assertiveEl.setAttribute('role', 'alert');
  assertiveEl.id = 'cosmos-a11y-live-assertive';
  assertiveEl.style.cssText = SR_ONLY_STYLE;

  document.body.appendChild(politeEl);
  document.body.appendChild(assertiveEl);

  // Coalesce repeated announcements
  let lastMsg = '', lastAt = 0;
  function announce(msg, priority = 'polite') {
    if (!msg) return;
    const now = Date.now();
    if (msg === lastMsg && now - lastAt < 600) return;
    lastMsg = msg; lastAt = now;
    const el = priority === 'assertive' ? assertiveEl : politeEl;
    // Clear + set on next tick — AT picks up text changes
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 30);
  }

  // ───── reduce-motion live tracker ──────────────────────────────
  let reduceMotion = prefersReducedMotion();
  const reduceListeners = new Set();
  let mql = null;
  if (typeof window !== 'undefined' && window.matchMedia) {
    mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => {
      reduceMotion = !!e.matches;
      api.reduceMotion = reduceMotion;
      reduceListeners.forEach(cb => { try { cb(reduceMotion); } catch (_) {} });
      document.documentElement.classList.toggle('cosmos-reduce-motion', reduceMotion);
    };
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
    mql._cosmosA11yChange = onChange;
    document.documentElement.classList.toggle('cosmos-reduce-motion', reduceMotion);
  }

  function onReduceMotionChange(cb) {
    reduceListeners.add(cb);
    return () => reduceListeners.delete(cb);
  }

  // ───── Focus trap ──────────────────────────────────────────────
  // WCAG 2.4.3 Focus Order / 2.1.2 No Keyboard Trap (escape via close UI)
  let trapEl = null;
  let trapHandler = null;
  let prevFocus = null;

  function focusables(root) {
    return [...root.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
      'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function focusTrap(el) {
    if (!el) return;
    releaseFocus();
    trapEl = el;
    prevFocus = document.activeElement;
    const items = focusables(el);
    if (items.length) items[0].focus();
    else { el.setAttribute('tabindex', '-1'); el.focus(); }

    trapHandler = (e) => {
      if (e.key !== 'Tab') return;
      const list = focusables(trapEl);
      if (!list.length) { e.preventDefault(); return; }
      const i = list.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && (i === list.length - 1 || i === -1)) {
        e.preventDefault(); list[0].focus();
      }
    };
    document.addEventListener('keydown', trapHandler, true);
  }

  function releaseFocus() {
    if (trapHandler) document.removeEventListener('keydown', trapHandler, true);
    trapHandler = null; trapEl = null;
    if (prevFocus && typeof prevFocus.focus === 'function') {
      try { prevFocus.focus(); } catch (_) {}
    }
    prevFocus = null;
  }

  // ───── Help dialog ('?' key) ───────────────────────────────────
  let helpDialog = null;
  function buildHelpDialog() {
    if (helpDialog) return helpDialog;
    helpDialog = document.createElement('div');
    helpDialog.className = 'cosmos-a11y-help';
    helpDialog.setAttribute('role', 'dialog');
    helpDialog.setAttribute('aria-modal', 'true');
    helpDialog.setAttribute('aria-label', '操作 / Controls');
    helpDialog.hidden = true;
    // JP-first content. See docs/superpowers/specs/2026-05-12-ux-copy-style.md §9
    helpDialog.innerHTML = cfg.helpHtml || `
      <div class="cosmos-a11y-help-inner">
        <h2 id="cosmos-a11y-help-title" lang="ja">操作 <span class="cosmos-a11y-help-en" lang="en">— controls</span></h2>
        <p class="cosmos-a11y-help-sub" lang="ja">観測のための鍵 <span class="cosmos-a11y-help-en" lang="en">— keys for observing</span></p>
        <dl>
          <dt><kbd>?</kbd></dt><dd lang="ja">この案内を開閉 <span class="cosmos-a11y-help-en" lang="en">open or close this panel</span></dd>
          <dt><kbd>M</kbd></dt><dd lang="ja">静寂と観測の切替 <span class="cosmos-a11y-help-en" lang="en">fall to silence, or return</span></dd>
          <dt><kbd>R</kbd></dt><dd lang="ja">共鳴 (kyōmei) を鳴らす <span class="cosmos-a11y-help-en" lang="en">sound the resonance</span></dd>
          <dt><kbd>I</kbd></dt><dd lang="ja">啓示 (keiji) を鳴らす <span class="cosmos-a11y-help-en" lang="en">sound the revelation</span></dd>
          <dt><kbd>Esc</kbd></dt><dd lang="ja">開いている窓を閉じる <span class="cosmos-a11y-help-en" lang="en">close any open window</span></dd>
          <dt><kbd>Tab</kbd></dt><dd lang="ja">操作の順に移る <span class="cosmos-a11y-help-en" lang="en">move through controls</span></dd>
        </dl>
        <button type="button" class="cosmos-a11y-help-close" autofocus aria-label="案内を閉じる / close panel">閉じる (Esc)</button>
      </div>
    `;
    document.body.appendChild(helpDialog);
    helpDialog.querySelector('.cosmos-a11y-help-close')
      ?.addEventListener('click', closeHelp);
    return helpDialog;
  }

  function openHelp() {
    if (!cfg.enableHelpDialog) return;
    buildHelpDialog();
    helpDialog.hidden = false;
    focusTrap(helpDialog);
    announce('操作の案内を開きました / the controls panel is open', 'polite');
  }

  function closeHelp() {
    if (!helpDialog || helpDialog.hidden) return;
    helpDialog.hidden = true;
    releaseFocus();
    announce('操作の案内を閉じました / the controls panel is closed', 'polite');
  }

  function isHelpOpen() {
    return !!(helpDialog && !helpDialog.hidden);
  }

  // ───── Global keyboard handler ─────────────────────────────────
  function onKey(e) {
    // Don't hijack typing in inputs
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault();
      isHelpOpen() ? closeHelp() : openHelp();
      return;
    }
    if (e.key === 'Escape') {
      if (isHelpOpen()) { closeHelp(); return; }
      if (trapEl) { releaseFocus(); return; }
      // bubble for page to close other overlays
    }
    if ((e.key === 'm' || e.key === 'M') && cfg.audio?.setMuted) {
      const next = !cfg.audio.__a11y_muted;
      cfg.audio.setMuted(next);
      cfg.audio.__a11y_muted = next;
      announce(next ? '静寂に落ちました / fallen to silence' : '観測に戻りました / returned to observing', 'polite');
    }
  }
  if (cfg.enableKeyboard && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKey);
  }

  function dispose() {
    if (cfg.enableKeyboard && typeof window !== 'undefined') {
      window.removeEventListener('keydown', onKey);
    }
    if (mql) {
      const h = mql._cosmosA11yChange;
      if (mql.removeEventListener) mql.removeEventListener('change', h);
      else if (mql.removeListener) mql.removeListener(h);
    }
    releaseFocus();
    politeEl.remove();
    assertiveEl.remove();
    if (helpDialog) helpDialog.remove();
    helpDialog = null;
    reduceListeners.clear();
  }

  const api = {
    announce,
    focusTrap,
    releaseFocus,
    openHelp,
    closeHelp,
    get reduceMotion() { return reduceMotion; },
    set reduceMotion(v) { reduceMotion = !!v; }, // allow override
    onReduceMotionChange,
    dispose
  };
  return api;
}

export default applyA11y;
