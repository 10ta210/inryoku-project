// cosmos-percentage-hud.js — 観測 XX% HUD with RGB/CMY split bar
// ESM. Self-contained, no framework. Mounts to parent element.
// 白黒禁則: light values stay at 0.5 in HSL.

export function createPercentageHud(opts = {}) {
  const cfg = {
    parent: opts.parent || document.body,
    observation: opts.observation,
    label: opts.label || '観測',
    compact: opts.compact || false,
    ...opts
  };

  if (!cfg.observation) throw new Error('cosmos-percentage-hud: observation required');

  const root = document.createElement('div');
  root.className = 'cosmos-pct-hud';
  root.setAttribute('data-cosmos-chrome', '');
  root.setAttribute('role', 'status');
  // aria-live OFF on root: the visible number tweens 25-60 times/pulse and
  // would flood screen readers as a polite live region. The separate
  // .cosmos-pct-srtext span (below) is the single announcer, updated only
  // when the integer rounds to a new +1% boundary or wraps.
  root.setAttribute('aria-live', 'off');
  root.setAttribute('aria-atomic', 'true');
  root.setAttribute('aria-label', cfg.label + ' の表示 / ' + cfg.label + ' percentage display');

  root.innerHTML = `
    <div class="cosmos-pct-row">
      <span class="cosmos-pct-label"></span>
      <span class="cosmos-pct-num" aria-hidden="true">--</span>
      <span class="cosmos-pct-sign" aria-hidden="true">%</span>
      <span class="cosmos-pct-srtext sr-only" role="status" aria-live="polite" aria-atomic="true" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;"></span>
    </div>
    <div class="cosmos-pct-bar" aria-hidden="true">
      <span class="seg seg-R" style="background:hsl(0,80%,50%)"></span>
      <span class="seg seg-G" style="background:hsl(120,80%,50%)"></span>
      <span class="seg seg-B" style="background:hsl(220,80%,50%)"></span>
      <span class="seg seg-C" style="background:hsl(180,75%,50%)"></span>
      <span class="seg seg-M" style="background:hsl(300,75%,50%)"></span>
      <span class="seg seg-Y" style="background:hsl(55,85%,50%)"></span>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .cosmos-pct-hud {
      position: fixed;
      bottom: 14px;
      right: 14px;
      z-index: 9999;
      padding: 10px 14px;
      border-radius: 12px;
      background: hsla(0,0%,8%,0.72);
      color: hsl(0,0%,92%);
      font-family: ui-sans-serif, -apple-system, "Helvetica Neue", "Hiragino Sans", "Yu Gothic", sans-serif;
      font-size: 12px;
      letter-spacing: 0.06em;
      backdrop-filter: blur(8px) saturate(140%);
      -webkit-backdrop-filter: blur(8px) saturate(140%);
      box-shadow: 0 6px 24px hsla(0,0%,0%,0.4);
      pointer-events: none;
      user-select: none;
      min-width: 140px;
    }
    .cosmos-pct-hud.compact { padding: 6px 10px; min-width: 0; }
    .cosmos-pct-row {
      display: flex; align-items: baseline; gap: 6px;
      margin-bottom: 6px;
    }
    .cosmos-pct-label { opacity: 0.78; font-size: 11px; }
    .cosmos-pct-num {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      font-size: 18px;
      color: hsl(0,0%,98%);
      transition: color 240ms ease;
    }
    .cosmos-pct-num.cosmos-pct-pulse { color: hsl(50,85%,68%); }
    .cosmos-pct-num.cosmos-pct-wrap  { color: hsl(300,70%,72%); }
    .cosmos-pct-sign { opacity: 0.6; font-size: 11px; }
    .cosmos-pct-bar {
      display: flex; gap: 2px; height: 4px;
      border-radius: 2px; overflow: hidden;
    }
    .cosmos-pct-bar .seg {
      flex: 1 1 0;
      opacity: 0.25;
      transition: opacity 320ms ease, flex-grow 320ms ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .cosmos-pct-num, .cosmos-pct-bar .seg { transition: none; }
    }
  `;
  root.appendChild(style);

  if (cfg.compact) root.classList.add('compact');
  cfg.parent.appendChild(root);

  const labelEl = root.querySelector('.cosmos-pct-label');
  const numEl   = root.querySelector('.cosmos-pct-num');
  const srEl    = root.querySelector('.cosmos-pct-srtext');
  const segs = {
    R: root.querySelector('.seg-R'),
    G: root.querySelector('.seg-G'),
    B: root.querySelector('.seg-B'),
    C: root.querySelector('.seg-C'),
    M: root.querySelector('.seg-M'),
    Y: root.querySelector('.seg-Y')
  };
  labelEl.textContent = cfg.label;

  let animFrom = cfg.observation.getPct();
  let animTo = animFrom;
  let animStart = 0;
  const ANIM_MS = 420;

  function tween(t) {
    if (!animStart) animStart = t;
    const p = Math.min(1, (t - animStart) / ANIM_MS);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = Math.round(animFrom + (animTo - animFrom) * eased);
    numEl.textContent = String(v).padStart(2, '0');
    if (p < 1) requestAnimationFrame(tween);
    else animStart = 0;
  }

  function render(pct, wrapped) {
    animFrom = parseInt(numEl.textContent, 10);
    if (Number.isNaN(animFrom)) animFrom = pct;
    animTo = pct;
    animStart = 0;
    if (wrapped) {
      // I11: skip tween on wrap — counting *down* from 99→50 contradicts
      // the "+1%" semantic. Snap visible number, then flash the pulse class.
      numEl.textContent = String(pct).padStart(2, '0');
    } else {
      requestAnimationFrame(tween);
    }

    numEl.classList.remove('cosmos-pct-pulse', 'cosmos-pct-wrap');
    void numEl.offsetWidth;
    numEl.classList.add(wrapped ? 'cosmos-pct-wrap' : 'cosmos-pct-pulse');

    // AT-only announcement (single source — the .cosmos-pct-srtext live
    // region). Speak on every +1% boundary, on wrap, and explicitly on
    // milestones (every 5%) for added clarity. Root has aria-live=off so the
    // tween cannot flood.
    // 101% は無い、しかし観測された。99% wraps to 50%; never says "100%".
    if (wrapped) {
      srEl.textContent = '99% から 50% に戻りました。もう一度観測が始まります。 / ' +
                        cfg.label + ' wrapped back to ' + pct + ' percent';
    } else if (pct === 101) {
      srEl.textContent = '101% は無い、しかし観測された。 / 101% does not exist, and yet it was observed.';
    } else {
      srEl.textContent = cfg.label + ' ' + pct + '% / ' + cfg.label + ' ' + pct + ' percent';
    }

    // Update RGB/CMY decomposition bar
    const decomp = cfg.observation.decomposition();
    const total = Math.max(1, Object.values(decomp).reduce((a, b) => a + b, 0));
    Object.entries(segs).forEach(([k, el]) => {
      const w = (decomp[k] || 0) / total;
      el.style.flexGrow = String(0.4 + w * 4);
      el.style.opacity = String(0.25 + w * 0.7);
    });
  }

  // Initial render
  render(cfg.observation.getPct(), false);

  const unsub = cfg.observation.onPulse(({ pct, wrapped }) => render(pct, wrapped));

  return {
    root,
    setLabel(t) { labelEl.textContent = t; },
    dispose() {
      unsub();
      root.remove();
    }
  };
}
