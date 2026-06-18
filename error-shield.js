/* ──────────────────────────────────────────────────────────────────────────
 *  error-shield.js — inryokü グローバルエラーシールド
 *  2026-04-28
 *
 *  目的:
 *    - window.onerror / unhandledrejection を一括キャッチ
 *    - dedup + バッチ送信 (sendBeacon) で /api/error へ
 *    - WebGL contextlost / localStorage 拒否 / SW 失敗 / オフラインを観測
 *    - inryokü ブランド調 toast を aria-live で出す（任意）
 *
 *  非破壊原則:
 *    - alert() は touch しない（copy-fix-runtime.js 担当）
 *    - 既存スクリプトの内部状態を読み書きしない
 *    - 重複起動防止フラグあり (window.__inryokuErrorShield)
 *
 *  依存: なし（vanilla）
 * ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  if (window.__inryokuErrorShield) return;
  window.__inryokuErrorShield = true;

  // ── 環境判定 ──
  var HOST = (location && location.hostname) || '';
  var IS_DEV = HOST === 'localhost' || HOST === '127.0.0.1' || HOST === '::1' ||
               HOST.indexOf('.local') !== -1 || location.protocol === 'file:';
  var IS_PROD = !IS_DEV;

  // ── 設定 ──
  var MAX_QUEUE       = 50;     // メモリ内キュー上限
  var FLUSH_INTERVAL  = 5000;   // 5 秒
  var FLUSH_THRESHOLD = 10;     // 10 件溜まったら即送信
  var DEDUP_MAX       = 200;    // dedup マップ上限
  var ENDPOINT        = '/api/error';
  var LS_QUEUE_KEY    = 'inryoku.errq';
  var LS_AVAILABLE    = (function () {
    try {
      var k = '__irk_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  // ── 内部状態 ──
  var queue = [];
  var dedup = Object.create(null); // key -> { idx, count }
  var flushTimer = null;
  var notifiedLocalStorage = false;
  var consecutiveFails = 0;

  // ── ブランド文言マッピング（生エラー → 観測者調） ──
  function brandify(rawMsg) {
    var m = String(rawMsg || '').toLowerCase();
    if (!m) return 'the signal flickered.';
    if (m.indexOf('network') !== -1 || m.indexOf('failed to fetch') !== -1 ||
        m.indexOf('networkerror') !== -1 || m.indexOf('load failed') !== -1) {
      return 'the connection is grey.';
    }
    if (m.indexOf('offline') !== -1) return 'the connection is grey.';
    if (m.indexOf('quota') !== -1 || m.indexOf('storage') !== -1) {
      return 'your memory has no room.';
    }
    if (m.indexOf('webgl') !== -1 || m.indexOf('context lost') !== -1) {
      return 'the apparatus paused. observe again.';
    }
    if (m.indexOf('script error') !== -1) return 'the wave broke quietly.';
    if (m.indexOf('timeout') !== -1) return 'signal in transit. give it a breath.';
    return 'the wave shifted. observe again.';
  }

  // ── toast UI ──
  // aria-live="polite" 既定。retryable のときは action ボタン付き。
  function ensureToastStyles() {
    if (document.getElementById('inryoku-error-shield-style')) return;
    var s = document.createElement('style');
    s.id = 'inryoku-error-shield-style';
    s.textContent =
      '.inryoku-shield-toast{' +
        'position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(20px);' +
        'min-width:220px;max-width:min(420px, calc(100vw - 32px));' +
        'padding:14px 18px;background:rgba(18,18,18,0.92);' +
        'color:rgba(255,255,255,0.78);' +
        'border:1px solid rgba(255,255,255,0.12);border-radius:10px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"SF Mono","Helvetica Neue",sans-serif;' +
        'font-size:12px;letter-spacing:0.04em;line-height:1.6;' +
        'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
        'box-shadow:0 8px 32px rgba(0,0,0,0.35);' +
        'opacity:0;transition:opacity .35s ease, transform .35s ease;' +
        'z-index:2147483600;pointer-events:auto;' +
        'display:flex;align-items:center;gap:12px;' +
      '}' +
      '.inryoku-shield-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
      '.inryoku-shield-toast .ist-orb{' +
        'width:8px;height:8px;border-radius:50%;' +
        'background:rgba(180,180,180,0.6);flex:0 0 auto;' +
        'box-shadow:0 0 12px rgba(180,180,180,0.35);' +
      '}' +
      '.inryoku-shield-toast .ist-text{flex:1 1 auto;color:rgba(230,230,230,0.85)}' +
      '.inryoku-shield-toast .ist-sub{display:block;font-size:10.5px;color:rgba(180,180,180,0.55);margin-top:2px;letter-spacing:0.06em}' +
      '.inryoku-shield-toast button{' +
        'all:unset;cursor:pointer;font-size:10.5px;letter-spacing:0.18em;' +
        'text-transform:uppercase;color:rgba(220,220,220,0.7);' +
        'padding:6px 10px;border:1px solid rgba(255,255,255,0.18);border-radius:4px;' +
        'transition:background .2s ease, color .2s ease;' +
      '}' +
      '.inryoku-shield-toast button:hover{background:rgba(255,255,255,0.06);color:#fff}' +
      '.inryoku-shield-toast button:focus-visible{outline:1px solid rgba(255,255,255,0.4);outline-offset:2px}' +
      '@media (max-width:520px){.inryoku-shield-toast{left:16px;right:16px;bottom:16px;transform:translateY(20px);max-width:none}.inryoku-shield-toast.show{transform:translateY(0)}}' +
      '@media (prefers-reduced-motion: reduce){.inryoku-shield-toast{transition:opacity .15s linear}}';
    (document.head || document.documentElement).appendChild(s);
  }

  function showToast(opts) {
    if (!document.body) {
      // body 未到達: DOMContentLoaded で再試行
      document.addEventListener('DOMContentLoaded', function () { showToast(opts); }, { once: true });
      return null;
    }
    ensureToastStyles();
    opts = opts || {};
    var role = opts.role || 'status';
    var t = document.createElement('div');
    t.className = 'inryoku-shield-toast';
    t.setAttribute('role', role); // 'alert' or 'status'
    t.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
    t.setAttribute('aria-atomic', 'true');

    var orb = document.createElement('span');
    orb.className = 'ist-orb';
    orb.setAttribute('aria-hidden', 'true');
    t.appendChild(orb);

    var textWrap = document.createElement('span');
    textWrap.className = 'ist-text';
    textWrap.textContent = opts.text || 'the wave shifted.';
    if (opts.subtext) {
      var sub = document.createElement('span');
      sub.className = 'ist-sub';
      sub.textContent = opts.subtext;
      textWrap.appendChild(sub);
    }
    t.appendChild(textWrap);

    var dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
    }

    if (opts.retry && typeof opts.retry === 'function') {
      var retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.textContent = 'retry';
      retryBtn.addEventListener('click', function () {
        try { opts.retry(); } catch (e) {}
        dismiss();
      });
      t.appendChild(retryBtn);
    }

    var dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.setAttribute('aria-label', 'dismiss');
    dismissBtn.textContent = '×';
    dismissBtn.addEventListener('click', dismiss);
    t.appendChild(dismissBtn);

    document.body.appendChild(t);
    // raf 後に show class
    requestAnimationFrame(function () { t.classList.add('show'); });

    var ttl = opts.ttl == null ? 4000 : opts.ttl;
    if (ttl > 0) setTimeout(dismiss, ttl);
    return { dismiss: dismiss, el: t };
  }

  // ── キュー操作 ──
  function dedupKey(p) {
    return p.type + '|' + (p.msg || '').slice(0, 120) + '|' + (p.src || '') + ':' + (p.line || 0);
  }

  function enqueue(payload) {
    if (!payload) return;
    var key = dedupKey(payload);
    if (dedup[key] != null) {
      var entry = queue[dedup[key]];
      if (entry) { entry.count = (entry.count || 1) + 1; entry.last_ts = payload.ts; }
      return;
    }
    if (Object.keys(dedup).length > DEDUP_MAX) {
      // 緩やかにリセット（古い順序が分からないので全消し）
      dedup = Object.create(null);
    }
    payload.count = 1;
    payload.last_ts = payload.ts;
    queue.push(payload);
    dedup[key] = queue.length - 1;
    if (queue.length > MAX_QUEUE) {
      // 古い順に捨てる + dedup index 再構築
      queue.shift();
      dedup = Object.create(null);
      for (var i = 0; i < queue.length; i++) {
        dedup[dedupKey(queue[i])] = i;
      }
    }
    scheduleFlush();
    if (queue.length >= FLUSH_THRESHOLD) flushNow();
  }

  function pack(type, msg, src, line, col, errOrStack) {
    var stack = '';
    if (errOrStack) {
      if (typeof errOrStack === 'string') stack = errOrStack;
      else if (errOrStack.stack) stack = String(errOrStack.stack);
    }
    return {
      type: type,
      msg: String(msg || '').slice(0, 500),
      src: String(src || '').slice(0, 200),
      line: line || 0,
      col: col || 0,
      stack: stack.slice(0, 1500),
      ua: (navigator.userAgent || '').slice(0, 200),
      url: (location && location.pathname) || '',
      ts: Date.now()
    };
  }

  // ── 送信 ──
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      flushNow();
    }, FLUSH_INTERVAL);
  }

  function flushNow() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (queue.length === 0) return;
    var batch = queue.slice();
    var payload = { errors: batch };

    if (IS_DEV) {
      // dev は console.warn のみ。送信しない。
      try { console.warn('[error-shield] dev queue flush', batch); } catch (e) {}
      queue.length = 0;
      dedup = Object.create(null);
      return;
    }

    if (!navigator.onLine) {
      // オフラインなら localStorage queue へ退避
      if (LS_AVAILABLE) {
        try {
          var raw = localStorage.getItem(LS_QUEUE_KEY);
          var prev = raw ? JSON.parse(raw) : [];
          prev = prev.concat(batch).slice(-MAX_QUEUE);
          localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(prev));
        } catch (e) {
          // 容量超過 → メモリオンリーへ fallback（queue 維持）
          return;
        }
      }
      // メモリは温存（次の online で flush）
      return;
    }

    var sent = false;
    try {
      if (navigator.sendBeacon) {
        var blob;
        try {
          blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        } catch (e) {
          blob = JSON.stringify(payload);
        }
        sent = navigator.sendBeacon(ENDPOINT, blob);
      }
    } catch (e) { sent = false; }

    if (!sent && typeof fetch === 'function') {
      try {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
          credentials: 'same-origin'
        }).then(function (r) {
          consecutiveFails = r && r.ok ? 0 : (consecutiveFails + 1);
        }).catch(function () { consecutiveFails++; });
        sent = true;
      } catch (e) { sent = false; }
    }

    if (sent) {
      queue.length = 0;
      dedup = Object.create(null);
      consecutiveFails = 0;
    } else {
      consecutiveFails++;
      if (consecutiveFails > 3) {
        // 完全に届かない: 諦めて queue を縮小し、メモリオンリー化
        queue = queue.slice(-MAX_QUEUE / 2);
        dedup = Object.create(null);
      }
    }
  }

  function flushPersistedQueue() {
    if (!LS_AVAILABLE || IS_DEV) return;
    try {
      var raw = localStorage.getItem(LS_QUEUE_KEY);
      if (!raw) return;
      var prev = JSON.parse(raw);
      if (!Array.isArray(prev) || prev.length === 0) {
        localStorage.removeItem(LS_QUEUE_KEY);
        return;
      }
      var ok = false;
      try {
        if (navigator.sendBeacon) {
          var blob = new Blob([JSON.stringify({ errors: prev })], { type: 'application/json' });
          ok = navigator.sendBeacon(ENDPOINT, blob);
        }
      } catch (e) {}
      if (ok) localStorage.removeItem(LS_QUEUE_KEY);
    } catch (e) {}
  }

  // ── window.onerror / unhandledrejection ──
  window.addEventListener('error', function (e) {
    // Resource error (img/script/link load failure) → target は Element
    if (e && e.target && e.target !== window && e.target.nodeName) {
      var tag = String(e.target.nodeName).toLowerCase();
      var src = e.target.src || e.target.href || '';
      enqueue(pack('resource', tag + ' load failed', src, 0, 0, null));
      return;
    }
    enqueue(pack('error', e.message, e.filename, e.lineno, e.colno, e.error));
  }, true); // capture phase で resource error も拾う

  window.addEventListener('unhandledrejection', function (e) {
    var reason = e && e.reason;
    var msg, stack;
    if (reason && typeof reason === 'object') {
      msg = reason.message || String(reason);
      stack = reason.stack || '';
    } else {
      msg = String(reason || 'unhandled rejection');
      stack = '';
    }
    enqueue(pack('rejection', msg, '', 0, 0, stack));
  });

  // ── 主要エラー specific handlers ──

  // 1) WebGL contextlost: 黒画面回避 + リロード提案
  function attachWebGLHandlers() {
    var canvases = document.querySelectorAll('canvas');
    Array.prototype.forEach.call(canvases, function (cv) {
      if (cv.__inryokuShieldAttached) return;
      cv.__inryokuShieldAttached = true;
      cv.addEventListener('webglcontextlost', function (ev) {
        try { ev.preventDefault(); } catch (e) {}
        enqueue(pack('webgl_lost', 'webgl context lost', cv.id || 'canvas', 0, 0, null));
        showToast({
          text: 'the apparatus paused.',
          subtext: '観測装置が一瞬眠った。リロードで戻る。',
          role: 'status',
          ttl: 0,
          retry: function () { try { location.reload(); } catch (e) {} }
        });
      }, false);
      cv.addEventListener('webglcontextrestored', function () {
        enqueue(pack('webgl_restored', 'webgl context restored', cv.id || 'canvas', 0, 0, null));
      }, false);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachWebGLHandlers);
  } else {
    attachWebGLHandlers();
  }
  // 後から canvas が追加されるケースのため、軽い MutationObserver
  try {
    if (typeof MutationObserver === 'function') {
      var mo = new MutationObserver(function () { attachWebGLHandlers(); });
      var startObserve = function () {
        if (document.body) mo.observe(document.body, { childList: true, subtree: true });
      };
      if (document.body) startObserve();
      else document.addEventListener('DOMContentLoaded', startObserve, { once: true });
    }
  } catch (e) {}

  // 2) localStorage 失敗（プライベートモード）通知 — 1 回だけ
  if (!LS_AVAILABLE && !notifiedLocalStorage) {
    notifiedLocalStorage = true;
    enqueue(pack('storage_unavailable', 'localStorage unavailable', '', 0, 0, null));
    // 顧客にはプライベートモード時のみ静かに通知
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        showToast({
          text: 'private observation.',
          subtext: '番号は記録されません。',
          role: 'status',
          ttl: 5000
        });
      }, { once: true });
    } else {
      showToast({
        text: 'private observation.',
        subtext: '番号は記録されません。',
        role: 'status',
        ttl: 5000
      });
    }
  }

  // 3) Service Worker 登録失敗 — 静かに無視（ログのみ）
  // register.js が console.warn してくれているので observation のみ。
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener &&
    navigator.serviceWorker.addEventListener('error', function (e) {
      enqueue(pack('sw_error', (e && e.message) || 'sw error', '', 0, 0, null));
    });
  }

  // 4) ネットワーク失敗 / オフライン警告
  window.addEventListener('offline', function () {
    enqueue(pack('offline', 'navigator went offline', '', 0, 0, null));
    showToast({
      text: 'the connection is grey.',
      subtext: '接続が失われた。波を待つ。',
      role: 'status',
      ttl: 6000
    });
  });
  window.addEventListener('online', function () {
    showToast({
      text: 'the signal returned.',
      subtext: '接続が戻った。',
      role: 'status',
      ttl: 3000
    });
    // 永続化キューを送信
    flushPersistedQueue();
    // メモリキューも flush
    flushNow();
  });

  // 5) ページ離脱時に確実に送信
  window.addEventListener('pagehide', function () { flushNow(); });
  window.addEventListener('beforeunload', function () { flushNow(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushNow();
  });

  // 起動時に永続化キューがあれば送る
  if (navigator.onLine) {
    setTimeout(flushPersistedQueue, 1000);
  }

  // ── 公開 API（任意で他コードから呼べる）──
  window.inryokuShield = {
    report: function (msg, extra) {
      enqueue(pack('manual', msg, (extra && extra.src) || '', 0, 0, (extra && extra.stack) || null));
    },
    toast: showToast,
    brandify: brandify,
    flush: flushNow,
    _state: function () {
      return { queue: queue.slice(), dev: IS_DEV, lsAvailable: LS_AVAILABLE };
    }
  };

  if (IS_DEV) {
    try { console.info('[error-shield] active (dev mode — no network send)'); } catch (e) {}
  }
})();
