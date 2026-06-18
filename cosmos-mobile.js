/* ============================================================
   cosmos-mobile.js — mobile-specific shims for P3 (ESM, vanilla)
   作成: 2026-05-15

   Public API:
     applyMobile(opts?) → {
       isMobile,             // boolean
       hoverCtx,              // { x, y, ndcX, ndcY, active } — live ref
       gravity,               // { x, y, z } — from orientation, opt-in
       requestOrientation(),  // user-gesture trigger for iOS 13+ permission
       pause(), resume(),     // page-visibility hooks (also auto-wired)
       dispose()
     }

   Behavior:
     - touchmove → mousemove-equivalent (hoverCtx + dispatched 'mousemove')
     - VisualViewport API → CSS --vvh (real visible height)
     - dvh CSS variable injection (100dvh fallback for old iOS)
     - DeviceOrientation → gravity bias (opt-in, requires user gesture on iOS)
     - Page Visibility → pause/resume callbacks
     - Battery API → low-battery event → suggest tier 'low'
     - Frame-budget thermal proxy: listens for cosmos:perf-drop and
       triggers cosmos:thermal-throttle if drops keep firing.
   ============================================================ */

export function applyMobile(opts = {}) {
  const isMobile = detectMobile();
  const hoverCtx = { x: 0, y: 0, ndcX: 0, ndcY: 0, active: false };
  const gravity = { x: 0, y: 0, z: 0 };
  const cleanup = [];
  let paused = false;
  let pauseCb = opts.onPause || null;
  let resumeCb = opts.onResume || null;
  let suggestTierCb = opts.onSuggestTier || null;

  // ---- 100dvh injection --------------------------------------
  injectDvhVar();

  // ---- visual viewport (iOS keyboard / URL bar) ---------------
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const onVv = () => {
      document.documentElement.style.setProperty(
        '--vvh', `${vv.height}px`
      );
    };
    onVv();
    vv.addEventListener('resize', onVv);
    vv.addEventListener('scroll', onVv);
    cleanup.push(() => {
      vv.removeEventListener('resize', onVv);
      vv.removeEventListener('scroll', onVv);
    });
  }

  // ---- touch → hover mapping ---------------------------------
  if (isMobile) {
    const onTouch = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      updateHover(t.clientX, t.clientY);
      // Dispatch a synthesized mousemove so existing behavior code
      // (which listens to mousemove) gets coverage on mobile.
      try {
        const m = new MouseEvent('mousemove', {
          clientX: t.clientX,
          clientY: t.clientY,
          bubbles: true,
          cancelable: false
        });
        (e.target || document).dispatchEvent(m);
      } catch (_) {}
    };
    const onTouchEnd = () => { hoverCtx.active = false; };
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    cleanup.push(() => {
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onTouchEnd);
    });
  } else {
    // Desktop: still keep hoverCtx in sync for unified ctx.
    const onMove = (e) => updateHover(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMove, { passive: true });
    cleanup.push(() => window.removeEventListener('mousemove', onMove));
  }

  function updateHover(x, y) {
    hoverCtx.x = x; hoverCtx.y = y;
    hoverCtx.ndcX = (x / window.innerWidth) * 2 - 1;
    hoverCtx.ndcY = -((y / window.innerHeight) * 2 - 1);
    hoverCtx.active = true;
  }

  // ---- DeviceOrientation gravity bias (opt-in) ---------------
  let orientationBound = false;
  function bindOrientation() {
    if (orientationBound) return;
    orientationBound = true;
    const onOri = (e) => {
      // beta = front/back tilt (-180..180), gamma = left/right (-90..90)
      const beta = (e.beta || 0) / 90;
      const gamma = (e.gamma || 0) / 90;
      // gentle gravity bias — clamp
      gravity.x = clamp(gamma, -1, 1) * 0.3;
      gravity.y = clamp(-beta, -1, 1) * 0.3;
    };
    window.addEventListener('deviceorientation', onOri, { passive: true });
    cleanup.push(() => window.removeEventListener('deviceorientation', onOri));
  }

  // iOS 13+ requires explicit permission via user gesture.
  async function requestOrientation() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted') bindOrientation();
        return res === 'granted';
      }
      // Android / desktop: bind directly
      bindOrientation();
      return true;
    } catch (_) {
      return false;
    }
  }

  // ---- Page Visibility ---------------------------------------
  const onVis = () => {
    if (document.hidden) pause();
    else resume();
  };
  document.addEventListener('visibilitychange', onVis);
  cleanup.push(() => document.removeEventListener('visibilitychange', onVis));

  function pause() {
    if (paused) return;
    paused = true;
    try { pauseCb && pauseCb(); } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('cosmos:pause'));
    } catch (_) {}
  }
  function resume() {
    if (!paused) return;
    paused = false;
    try { resumeCb && resumeCb(); } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('cosmos:resume'));
    } catch (_) {}
  }

  // ---- Battery API -------------------------------------------
  if (navigator.getBattery) {
    navigator.getBattery().then((bat) => {
      const check = () => {
        if (bat.level < 0.2 && !bat.charging) {
          try { suggestTierCb && suggestTierCb('low', 'battery'); } catch (_) {}
          try {
            window.dispatchEvent(new CustomEvent('cosmos:low-battery', {
              detail: { level: bat.level }
            }));
          } catch (_) {}
        }
      };
      bat.addEventListener('levelchange', check);
      bat.addEventListener('chargingchange', check);
      check();
    }).catch(() => {});
  }

  // ---- Thermal throttle proxy --------------------------------
  // If perf-drop event fires 3+ times in a 30s window, force 'low'.
  const dropTimes = [];
  const onDrop = () => {
    const now = performance.now();
    dropTimes.push(now);
    while (dropTimes.length && now - dropTimes[0] > 30000) dropTimes.shift();
    if (dropTimes.length >= 3) {
      try { suggestTierCb && suggestTierCb('low', 'thermal'); } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent('cosmos:thermal-throttle'));
      } catch (_) {}
      dropTimes.length = 0;
    }
  };
  window.addEventListener('cosmos:perf-drop', onDrop);
  cleanup.push(() => window.removeEventListener('cosmos:perf-drop', onDrop));

  function dispose() {
    cleanup.forEach((fn) => { try { fn(); } catch (_) {} });
    cleanup.length = 0;
  }

  return {
    isMobile,
    hoverCtx,
    gravity,
    requestOrientation,
    pause,
    resume,
    dispose
  };
}

function detectMobile() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true;
  } catch (_) {}
  return false;
}

function injectDvhVar() {
  // 100dvh fallback for browsers without dvh unit support.
  const setVar = () => {
    const h = window.innerHeight;
    document.documentElement.style.setProperty('--dvh', `${h * 0.01}px`);
    document.documentElement.style.setProperty('--full-dvh', `${h}px`);
  };
  setVar();
  window.addEventListener('resize', setVar, { passive: true });
  window.addEventListener('orientationchange', setVar, { passive: true });
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
