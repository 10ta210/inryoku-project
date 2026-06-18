/* ============================================================
   cosmos-perf.js — inryokü P3 frame-time profiler (ESM, vanilla)
   作成: 2026-05-15
   役割:
     rAF 駆動の per-frame timing + GC heuristic を提供。
     adaptive layer / overlay / mobile shim から共有される。
     allocation 0: stat buffers は pre-allocated TypedArray.

   Public API:
     createProfiler(opts?) → {
       start(),
       stop(),
       getStats(),    // { fps, frameMs, p95, p99, tier, drops, gcHits, sample }
       onDrop(cb),    // (info) => void, fires after N consecutive sub-30 frames
       tier()         // 'high' | 'medium' | 'low'
     }

   Opts:
     window:       sliding-window size in frames (default 60)
     dropFrames:   N consecutive sub-30 fps frames to fire onDrop (default 12)
     gcDeltaMB:    heap delta threshold to count a GC hit (default 4)
     highFps:      tier ≥ 'high'    (default 58)
     mediumFps:    tier ≥ 'medium'  (default 44)
     reduceMotion: bool — locks tier to whatever opts.lowOnReduce sets

   Notes:
     - tier classification uses median of window (robust against single drop)
     - performance.memory is Chrome-only; absence is silently tolerated
     - dispatching 'cosmos:perf-drop' on window for cross-module sinks
   ============================================================ */

export function createProfiler(opts = {}) {
  const WINDOW = Math.max(10, opts.window | 0 || 60);
  const DROP_FRAMES = opts.dropFrames | 0 || 12;
  const GC_DELTA = (opts.gcDeltaMB || 4) * 1024 * 1024;
  const HIGH_FPS = opts.highFps || 58;
  const MED_FPS = opts.mediumFps || 44;
  const LOW_FPS_DROP = 30;

  // Pre-allocated sliding window — no per-frame allocation.
  const frameBuf = new Float32Array(WINDOW); // frame ms
  const sortBuf = new Float32Array(WINDOW);  // scratch for p95/p99
  let bufIdx = 0;
  let bufFilled = 0;

  let running = false;
  let rafId = 0;
  let lastT = 0;
  let consecLow = 0;
  let dropCb = null;
  let drops = 0;
  let gcHits = 0;
  let lastHeap = 0;
  let cachedTier = inferInitialTier();
  let cachedFps = 60;
  let cachedFrameMs = 16.67;

  function inferInitialTier() {
    if (typeof navigator === 'undefined') return 'high';
    const mem = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    let coarse = false;
    let smallScreen = false;
    try {
      coarse = window.matchMedia?.('(pointer: coarse)').matches || false;
      smallScreen = (screen?.width || 1920) < 500;
    } catch (_) {}
    if (mem <= 2 || cores <= 2 || smallScreen) return 'low';
    if (mem <= 4 || (coarse && cores <= 6)) return 'medium';
    return 'high';
  }

  function classify(fps) {
    if (fps >= HIGH_FPS) return 'high';
    if (fps >= MED_FPS) return 'medium';
    return 'low';
  }

  function tick(now) {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    const dt = now - lastT;
    lastT = now;
    if (dt <= 0 || dt > 1000) return; // first frame / tab return

    frameBuf[bufIdx] = dt;
    bufIdx = (bufIdx + 1) % WINDOW;
    if (bufFilled < WINDOW) bufFilled++;

    cachedFrameMs = dt;
    cachedFps = 1000 / dt;

    // GC heuristic — Chrome-only
    const mem = performance.memory;
    if (mem) {
      const used = mem.usedJSHeapSize;
      if (lastHeap && used < lastHeap - GC_DELTA) gcHits++;
      lastHeap = used;
    }

    // sub-30 fps tracking
    if (cachedFps < LOW_FPS_DROP) {
      consecLow++;
      if (consecLow === DROP_FRAMES) {
        drops++;
        const info = {
          fps: cachedFps,
          frameMs: cachedFrameMs,
          tier: cachedTier,
          consecutive: consecLow
        };
        try { dropCb && dropCb(info); } catch (_) {}
        try {
          window.dispatchEvent(new CustomEvent('cosmos:perf-drop', { detail: info }));
        } catch (_) {}
      }
    } else if (cachedFps > LOW_FPS_DROP + 4) {
      consecLow = 0;
    }

    // Tier re-eval every 30 frames using median of window.
    if (bufFilled >= 30 && bufIdx % 30 === 0) {
      const n = bufFilled;
      for (let i = 0; i < n; i++) sortBuf[i] = frameBuf[i];
      // partial sort sufficient for median
      quickSelectInPlace(sortBuf, 0, n - 1, n >> 1);
      const medMs = sortBuf[n >> 1];
      const medFps = 1000 / medMs;
      cachedTier = classify(medFps);
    }
  }

  // In-place quickselect (no allocation, mutates buf up to right index).
  function quickSelectInPlace(a, lo, hi, k) {
    while (lo < hi) {
      const pivot = a[(lo + hi) >> 1];
      let i = lo, j = hi;
      while (i <= j) {
        while (a[i] < pivot) i++;
        while (a[j] > pivot) j--;
        if (i <= j) {
          const t = a[i]; a[i] = a[j]; a[j] = t;
          i++; j--;
        }
      }
      if (k <= j) hi = j;
      else if (k >= i) lo = i;
      else return;
    }
  }

  function start() {
    if (running) return;
    running = true;
    lastT = performance.now();
    consecLow = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function getStats() {
    const n = bufFilled;
    if (n < 3) {
      return {
        fps: cachedFps,
        frameMs: cachedFrameMs,
        p95: cachedFrameMs,
        p99: cachedFrameMs,
        tier: cachedTier,
        drops,
        gcHits,
        sample: n
      };
    }
    // Copy + sort scratch for percentiles (sortBuf reused, OK while reading).
    for (let i = 0; i < n; i++) sortBuf[i] = frameBuf[i];
    // Full sort here is fine — runs at overlay cadence, not per-frame.
    Array.prototype.sort.call(sortBuf.subarray(0, n), (a, b) => a - b);
    const p95 = sortBuf[Math.min(n - 1, Math.floor(n * 0.95))];
    const p99 = sortBuf[Math.min(n - 1, Math.floor(n * 0.99))];
    return {
      fps: cachedFps,
      frameMs: cachedFrameMs,
      p95,
      p99,
      tier: cachedTier,
      drops,
      gcHits,
      sample: n
    };
  }

  function onDrop(cb) {
    dropCb = typeof cb === 'function' ? cb : null;
  }

  function tier() {
    return cachedTier;
  }

  function forceTier(t) {
    if (t === 'high' || t === 'medium' || t === 'low') cachedTier = t;
  }

  return { start, stop, getStats, onDrop, tier, forceTier };
}
