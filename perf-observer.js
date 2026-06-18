/* perf-observer.js — Web Vitals 計測 (LCP / FID / CLS / INP / TTFB / FCP)
 * 2026-04-28
 *
 * 目的: 司さんが本番に入れた後、ブラウザの console に
 *       実 user の Core Web Vitals を吐き出す。
 *       送信先 (GA4 / Sentry / 自前 endpoint) は未確定なので
 *       一旦 console.log のみ。送信先決まったら sendBeacon で送る。
 *
 * 依存: なし (PerformanceObserver / Performance API のみ)
 * 既存スクリプト (p3_code_for_claude.js / particle_*.js / enhance.js) には触らない。
 *
 * 使い方: <head> または </body> 直前に <script src="perf-observer.js" defer></script>
 *         を入れるだけ。defer 必須。何も grobal を汚さない。
 *
 * 互換性:
 *   - PerformanceObserver: 全 modern browser (IE 不可)
 *   - LCP entry: Chrome 77+, Edge 79+, Firefox 122+, Safari 17.5+ (= Safari 17.4 以前は計測不可)
 *   - 'first-input' (FID 用): Safari 全バージョン非対応 (Web Vitals 公式実装と同じ制約)
 *   - 'event' (INP 用): Chrome 96+, Edge 96+, Safari 16.4+, Firefox 119+
 *   - try/catch で各 observer を分離しているので、未対応 entry type は静かに skip。
 */
(function () {
  'use strict';
  if (typeof PerformanceObserver === 'undefined') return;
  if (window.__inryokuPerfObserverLoaded) return;
  window.__inryokuPerfObserverLoaded = true;

  var TAG = '[perf]';
  var t0 = (performance.timeOrigin || 0);

  // 計測値バッファ。 window.__inryokuVitals で外部から参照可能 (debug 用)
  var vitals = {
    lcp: null,    // Largest Contentful Paint (ms)
    lcpElement: null,
    fcp: null,    // First Contentful Paint (ms)
    fid: null,    // First Input Delay (ms) — Safari 不可
    cls: 0,       // Cumulative Layout Shift (unit-less, 累積)
    inp: null,    // Interaction to Next Paint (ms) — 最大値を保持
    ttfb: null,   // Time To First Byte (ms)
    nav: null,    // navigation entry (lazy)
    longTasks: 0  // 50ms 超 long task の累積件数
  };
  window.__inryokuVitals = vitals;

  function log(label, value, extra) {
    var v = (typeof value === 'number') ? value.toFixed(1) : value;
    if (extra) console.log(TAG, label, v, extra);
    else console.log(TAG, label, v);
  }

  // ─── TTFB / FCP (Navigation + Paint) ────────────────────────────
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      vitals.nav = nav;
      vitals.ttfb = nav.responseStart - nav.startTime;
      log('TTFB', vitals.ttfb, 'ms');
    }
  } catch (e) {}

  try {
    var paintObs = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (e.name === 'first-contentful-paint') {
          vitals.fcp = e.startTime;
          log('FCP', vitals.fcp, 'ms');
        }
      });
    });
    paintObs.observe({ type: 'paint', buffered: true });
  } catch (e) {}

  // ─── LCP ────────────────────────────────────────────────────────
  try {
    var lcpObs = new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      var last = entries[entries.length - 1];
      if (!last) return;
      vitals.lcp = last.renderTime || last.loadTime || last.startTime;
      vitals.lcpElement = last.element ? (last.element.tagName + (last.element.id ? '#' + last.element.id : '')) : null;
      log('LCP', vitals.lcp, vitals.lcpElement || '');
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });

    // LCP は user interaction 後に確定。pagehide / visibilitychange で flush。
    var lcpFinalized = false;
    function finalizeLCP() {
      if (lcpFinalized) return;
      lcpFinalized = true;
      try { lcpObs.takeRecords(); lcpObs.disconnect(); } catch (e) {}
      if (vitals.lcp != null) console.log(TAG, 'LCP final', vitals.lcp.toFixed(1), 'ms', vitals.lcpElement || '');
    }
    addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') finalizeLCP();
    }, { capture: true });
    addEventListener('pagehide', finalizeLCP, { capture: true });
    // 最初の click / keydown でも LCP は止まる(public spec)
    ['keydown', 'click'].forEach(function (t) {
      addEventListener(t, finalizeLCP, { capture: true, once: true });
    });
  } catch (e) {}

  // ─── FID (first-input) — Safari 非対応で例外。catch で握り潰す ──
  try {
    var fidObs = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        vitals.fid = e.processingStart - e.startTime;
        log('FID', vitals.fid, 'ms (' + e.name + ')');
        try { fidObs.disconnect(); } catch (_) {}
      });
    });
    fidObs.observe({ type: 'first-input', buffered: true });
  } catch (e) {}

  // ─── CLS ────────────────────────────────────────────────────────
  try {
    var clsValue = 0;
    var clsEntries = [];
    var sessionValue = 0;
    var sessionEntries = [];

    var clsObs = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (e.hadRecentInput) return; // user 起因はカウントしない
        var firstSession = sessionEntries[0];
        var lastSession = sessionEntries[sessionEntries.length - 1];
        // 1s 以内 / session 5s 以内なら累積、それ以外は新セッション
        if (lastSession && (e.startTime - lastSession.startTime < 1000) && (e.startTime - firstSession.startTime < 5000)) {
          sessionValue += e.value;
          sessionEntries.push(e);
        } else {
          sessionValue = e.value;
          sessionEntries = [e];
        }
        if (sessionValue > clsValue) {
          clsValue = sessionValue;
          clsEntries = sessionEntries.slice();
          vitals.cls = clsValue;
        }
      });
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });

    addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        try { clsObs.takeRecords(); clsObs.disconnect(); } catch (_) {}
        console.log(TAG, 'CLS final', clsValue.toFixed(4));
      }
    }, { capture: true });
  } catch (e) {}

  // ─── INP (Interaction to Next Paint) — Chrome 96+ / Safari 16.4+ ─
  try {
    var maxInp = 0;
    var inpObs = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        // duration は entry の interactionId 単位。最大値が INP の代表値
        if (!e.interactionId) return;
        if (e.duration > maxInp) {
          maxInp = e.duration;
          vitals.inp = maxInp;
          log('INP (current max)', maxInp, e.name);
        }
      });
    });
    // durationThreshold は最低 16ms 以上の event のみ拾う
    inpObs.observe({ type: 'event', buffered: true, durationThreshold: 40 });
  } catch (e) {
    // Safari 16.3 以下はここで例外
  }

  // ─── Long Tasks (>50ms) ─────────────────────────────────────────
  try {
    var ltObs = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        vitals.longTasks++;
        // verbose: 初期化時の長タスクを把握したい時用
        if (e.duration > 100) {
          console.log(TAG, 'long-task', e.duration.toFixed(1), 'ms @ ' + e.startTime.toFixed(0));
        }
      });
    });
    ltObs.observe({ type: 'longtask', buffered: true });
  } catch (e) {}

  // ─── pagehide で全 vitals を 1 行で吐く (送信先確定したらここを差し替え)
  function flushSummary() {
    var summary = {
      lcp: vitals.lcp != null ? Math.round(vitals.lcp) : null,
      fcp: vitals.fcp != null ? Math.round(vitals.fcp) : null,
      ttfb: vitals.ttfb != null ? Math.round(vitals.ttfb) : null,
      fid: vitals.fid != null ? Math.round(vitals.fid) : null,
      cls: +vitals.cls.toFixed(4),
      inp: vitals.inp != null ? Math.round(vitals.inp) : null,
      longTasks: vitals.longTasks,
      ua: navigator.userAgent.slice(0, 80)
    };
    console.log(TAG, 'SUMMARY', JSON.stringify(summary));
    // ─── 送信先決まったらここで sendBeacon ─────────
    // try {
    //   navigator.sendBeacon('/api/vitals', JSON.stringify(summary));
    // } catch (e) {}
  }
  addEventListener('pagehide', flushSummary, { capture: true });
  // 30 秒後にも 1 度吐いておく (SPA 的に長居するユーザ用)
  setTimeout(function () { console.log(TAG, '30s snapshot', JSON.stringify({
    lcp: vitals.lcp, fcp: vitals.fcp, cls: +vitals.cls.toFixed(4),
    inp: vitals.inp, fid: vitals.fid, longTasks: vitals.longTasks
  })); }, 30000);
})();
