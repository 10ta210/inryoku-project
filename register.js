/* inryokü Service Worker registration & PWA install hooks — 2026-04-28
 *
 * 既存コードを破壊しない原則:
 *   - window への global 注入は最小限（window.inryokuPWA 名前空間のみ）
 *   - 失敗は console.warn で握る（UX を止めない）
 *   - インストールバナーは控えめ・閉じたら 7 日表示しない
 */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  var SW_URL = '/sw.js';
  var SW_SCOPE = '/';
  var BANNER_DISMISS_KEY = 'inryoku.pwa.banner.dismissed';
  var BANNER_DISMISS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  var deferredInstallPrompt = null;
  var registration = null;

  var ns = window.inryokuPWA = window.inryokuPWA || {};

  // ---- helpers ----

  function isStandalone() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true; // iOS
    return false;
  }

  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) && !window.MSStream;
  }

  function bannerDismissedRecently() {
    try {
      var v = localStorage.getItem(BANNER_DISMISS_KEY);
      if (!v) return false;
      var t = parseInt(v, 10);
      if (!isFinite(t)) return false;
      return (Date.now() - t) < BANNER_DISMISS_TTL;
    } catch (e) { return false; }
  }

  function markBannerDismissed() {
    try { localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now())); } catch (e) {}
  }

  // ---- update toast (controlled, minimal) ----

  function showUpdateToast(reg) {
    if (document.getElementById('inryoku-sw-toast')) return;
    var toast = document.createElement('div');
    toast.id = 'inryoku-sw-toast';
    toast.setAttribute('role', 'status');
    toast.style.cssText = [
      'position:fixed','left:50%','bottom:24px','transform:translateX(-50%)',
      'background:rgba(10,10,10,.92)','color:#cfcfcf','border:1px solid #2a2a2a',
      'padding:10px 18px','font:11px/1.6 -apple-system,BlinkMacSystemFont,sans-serif',
      'letter-spacing:.16em','text-transform:uppercase','z-index:99998',
      'backdrop-filter:blur(8px)','-webkit-backdrop-filter:blur(8px)',
      'box-shadow:0 8px 32px rgba(0,0,0,.4)','border-radius:2px'
    ].join(';');
    toast.innerHTML = '<span style="margin-right:14px">new version ready</span>' +
      '<button type="button" id="inryoku-sw-reload" style="background:transparent;border:1px solid #555;color:#fff;padding:4px 14px;font:inherit;letter-spacing:.16em;cursor:pointer">reload</button>' +
      '<button type="button" id="inryoku-sw-dismiss" aria-label="dismiss" style="background:transparent;border:none;color:#777;margin-left:10px;font-size:14px;cursor:pointer">×</button>';
    document.body.appendChild(toast);

    var r = document.getElementById('inryoku-sw-reload');
    var d = document.getElementById('inryoku-sw-dismiss');
    if (r) r.addEventListener('click', function () {
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    if (d) d.addEventListener('click', function () {
      var t = document.getElementById('inryoku-sw-toast');
      if (t) t.remove();
    });
  }

  // ---- install banner ----

  function showInstallBanner() {
    if (document.getElementById('inryoku-pwa-banner')) return;
    if (isStandalone()) return;
    if (bannerDismissedRecently()) return;

    var banner = document.createElement('div');
    banner.id = 'inryoku-pwa-banner';
    banner.setAttribute('role', 'complementary');
    banner.style.cssText = [
      'position:fixed','left:50%','bottom:18px','transform:translateX(-50%)',
      'background:rgba(10,10,10,.88)','color:#a8a8a8','border:1px solid #2a2a2a',
      'padding:10px 16px','font:10.5px/1.6 -apple-system,BlinkMacSystemFont,sans-serif',
      'letter-spacing:.22em','text-transform:uppercase','z-index:99997',
      'backdrop-filter:blur(8px)','-webkit-backdrop-filter:blur(8px)',
      'border-radius:2px','display:flex','align-items:center','gap:14px',
      'max-width:calc(100vw - 32px)','opacity:0','transition:opacity .8s ease'
    ].join(';');
    banner.innerHTML =
      '<span style="color:#888">install inryokü</span>' +
      '<button type="button" id="inryoku-pwa-install" style="background:transparent;border:1px solid #555;color:#cfcfcf;padding:4px 14px;font:inherit;letter-spacing:.22em;text-transform:uppercase;cursor:pointer">add</button>' +
      '<button type="button" id="inryoku-pwa-dismiss" aria-label="dismiss" style="background:transparent;border:none;color:#555;font-size:14px;cursor:pointer;padding:0 4px">×</button>';
    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.style.opacity = '1'; });

    document.getElementById('inryoku-pwa-install').addEventListener('click', function () {
      if (!deferredInstallPrompt) return;
      try {
        deferredInstallPrompt.prompt();
        var p = deferredInstallPrompt.userChoice;
        if (p && p.then) {
          p.then(function () { deferredInstallPrompt = null; banner.remove(); });
        } else {
          deferredInstallPrompt = null;
          banner.remove();
        }
      } catch (e) {
        console.warn('[pwa] prompt failed:', e && e.message);
      }
    });
    document.getElementById('inryoku-pwa-dismiss').addEventListener('click', function () {
      markBannerDismissed();
      banner.remove();
    });
  }

  function showIOSHint() {
    if (document.getElementById('inryoku-ios-hint')) return;
    if (isStandalone()) return;
    if (bannerDismissedRecently()) return;
    if (!isIOS()) return;

    var hint = document.createElement('div');
    hint.id = 'inryoku-ios-hint';
    hint.setAttribute('role', 'complementary');
    hint.style.cssText = [
      'position:fixed','left:50%','bottom:18px','transform:translateX(-50%)',
      'background:rgba(10,10,10,.88)','color:#a8a8a8','border:1px solid #2a2a2a',
      'padding:10px 16px','font:10px/1.7 -apple-system,BlinkMacSystemFont,sans-serif',
      'letter-spacing:.18em','z-index:99997','border-radius:2px',
      'backdrop-filter:blur(8px)','-webkit-backdrop-filter:blur(8px)',
      'max-width:calc(100vw - 32px)','text-align:center'
    ].join(';');
    hint.innerHTML =
      '<span style="color:#888">add to home screen: tap </span>' +
      '<span style="color:#cfcfcf">share</span>' +
      '<span style="color:#888"> &#x2192; </span>' +
      '<span style="color:#cfcfcf">add to home screen</span>' +
      '<button type="button" id="inryoku-ios-dismiss" aria-label="dismiss" style="background:transparent;border:none;color:#555;font-size:14px;cursor:pointer;padding:0 0 0 12px">×</button>';
    document.body.appendChild(hint);
    document.getElementById('inryoku-ios-dismiss').addEventListener('click', function () {
      markBannerDismissed();
      hint.remove();
    });
  }

  // ---- install prompt capture ----

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    // ある程度ユーザがサイトに慣れてから（30s 後）控えめに出す
    setTimeout(function () {
      if (!isStandalone() && deferredInstallPrompt) showInstallBanner();
    }, 30000);
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    var b = document.getElementById('inryoku-pwa-banner');
    if (b) b.remove();
    markBannerDismissed();
  });

  // iOS は beforeinstallprompt 非対応 → ヒントを 45s 後に
  if (isIOS() && !isStandalone()) {
    setTimeout(showIOSHint, 45000);
  }

  // ---- SW registration ----

  function attachUpdateListener(reg) {
    if (!reg) return;
    if (reg.waiting) showUpdateToast(reg);

    reg.addEventListener('updatefound', function () {
      var sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', function () {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateToast(reg);
        }
      });
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    // file:// 等の非 http(s) は登録を試みない
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
      .then(function (reg) {
        registration = reg;
        ns.registration = reg;
        attachUpdateListener(reg);

        // 1 時間ごとに update をチェック
        setInterval(function () {
          if (reg && reg.update) reg.update().catch(function () {});
        }, 60 * 60 * 1000);
      })
      .catch(function (err) {
        console.warn('[sw] registration failed:', err && err.message);
      });

    // SW がコントローラ切替したらリロード（ユーザがリロード押した直後の二重制御を避けるため一度きり）
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  // load 後に登録（critical path を邪魔しない）
  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }

  // ---- background sync hook (feature-detected) ----

  ns.requestSync = function (tag) {
    if (!registration || !registration.sync) return Promise.resolve(false);
    return registration.sync.register(tag).then(function () { return true; })
      .catch(function () { return false; });
  };

  ns.isStandalone = isStandalone;
  ns.isIOS = isIOS;

})();
