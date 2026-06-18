/* ============================================================
   cosmos-perf-overlay.js — dev FPS / tier overlay (ESM, vanilla)
   作成: 2026-05-15

   Auto-mount when location.search contains ?perf=1.
   Mount manually with mountOverlay(profiler, adaptive, opts).

     <small monospace HUD, top-left, pointer-events:none>
       fps 59   ms 16.9
       p95 18.1 p99 22.4
       tier high
       drops 0  gc 3
       particles 38000
       audio off
       battery 87% / discharge

   Self-disposes when ?perf is absent.
   ============================================================ */

export function mountOverlay(profiler, adaptive, opts = {}) {
  if (typeof document === 'undefined') return null;

  const wrap = document.createElement('div');
  wrap.id = 'cosmos-perf-overlay';
  wrap.style.cssText = [
    'position:fixed', 'top:8px', 'left:8px', 'z-index:2147483646',
    'pointer-events:none',
    'font:11px/1.4 ui-monospace,Menlo,Consolas,monospace',
    'color:#a8ffd6', 'background:rgba(6,8,12,0.72)',
    'border:1px solid rgba(168,255,214,0.25)', 'border-radius:6px',
    'padding:6px 8px', 'min-width:160px',
    'backdrop-filter:blur(6px)',
    '-webkit-backdrop-filter:blur(6px)',
    'text-shadow:0 0 4px rgba(168,255,214,0.5)',
    'white-space:pre'
  ].join(';');
  wrap.setAttribute('aria-hidden', 'true');

  document.body.appendChild(wrap);

  let battery = null;
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => { battery = b; }).catch(() => {});
  }

  let rafId = 0;
  let lastDraw = 0;
  const DRAW_INTERVAL = 250; // 4 Hz updates — gentle on the main thread

  function draw(now) {
    rafId = requestAnimationFrame(draw);
    if (now - lastDraw < DRAW_INTERVAL) return;
    lastDraw = now;

    const s = profiler ? profiler.getStats() : null;
    const tier = adaptive ? adaptive.getCurrent() : (s ? s.tier : 'n/a');
    const particles = (opts.behaviorOpts && opts.behaviorOpts.count) || 'n/a';
    const audio = window.__inryokuAudio?.isPlaying ? 'on' : 'off';

    let batStr = '—';
    if (battery) {
      batStr = `${(battery.level * 100).toFixed(0)}% / ${battery.charging ? 'charge' : 'discharge'}`;
    }

    if (!s) {
      wrap.textContent = `tier ${tier}\nprofiler not running`;
      return;
    }

    wrap.textContent =
      `fps ${s.fps.toFixed(1).padStart(4)}   ms ${s.frameMs.toFixed(1).padStart(4)}\n` +
      `p95 ${s.p95.toFixed(1).padStart(4)} p99 ${s.p99.toFixed(1).padStart(4)}\n` +
      `tier ${tier}\n` +
      `drops ${s.drops}  gc ${s.gcHits}\n` +
      `particles ${particles}\n` +
      `audio ${audio}\n` +
      `battery ${batStr}`;

    // Color hint on tier
    const c =
      tier === 'high' ? '#a8ffd6' :
      tier === 'medium' ? '#ffe28a' : '#ff8a8a';
    wrap.style.color = c;
    wrap.style.borderColor = c.replace(/^#/, 'rgba(') + ',0.25)';
  }
  rafId = requestAnimationFrame(draw);

  function dispose() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    wrap.remove();
  }

  return { dispose, el: wrap };
}

// Auto-mount when ?perf=1 — exposes hook for boot code to attach the
// real profiler/adaptive instances.
export function autoMount() {
  if (typeof window === 'undefined') return null;
  let enabled = false;
  try {
    enabled = new URLSearchParams(location.search).get('perf') === '1';
  } catch (_) {}
  if (!enabled) return null;

  // Defer until boot publishes the instances on window.__inryokuPerf.
  let handle = null;
  const tryMount = () => {
    const p = window.__inryokuPerf;
    if (!p || !p.profiler) return false;
    handle = mountOverlay(p.profiler, p.adaptive, {
      behaviorOpts: p.behaviorOpts
    });
    return true;
  };
  if (!tryMount()) {
    const t = setInterval(() => {
      if (tryMount()) clearInterval(t);
    }, 200);
    setTimeout(() => clearInterval(t), 10000);
  }
  return { dispose: () => handle && handle.dispose() };
}

// Auto-run on import in browsers.
if (typeof window !== 'undefined') {
  autoMount();
}
