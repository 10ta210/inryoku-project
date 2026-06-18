// inryoku-phrase-engine.js
// Picks phrases from phrases.json, projects them onto particle clusters in front
// of the camera, fades them in ~3s, holds ~5s, fades out. 1-2 concurrent phrases.
// Weighted by user's observation history in localStorage `__inryokuObservations`.
//
// Reduce-motion: phrases appear at fixed screen positions, no drift tracking.
// Always echoes phrase text to a polite aria-live region for screen readers.

const FADE_IN_MS  = 3000;
const HOLD_MS     = 5000;
const FADE_OUT_MS = 2500;
const SPAWN_MIN_MS = 5200;
const SPAWN_MAX_MS = 9400;
const MAX_CONCURRENT = 2;

function readObservations() {
  try {
    const raw = localStorage.getItem('__inryokuObservations');
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

function weightedPick(phrases, observations) {
  // Weight = phrase.weight * (1 + log(1 + obsCount[canon]))
  let total = 0;
  const weights = phrases.map((p) => {
    const obs = observations[p.canon] || 0;
    const w = (p.weight || 1) * (1 + Math.log(1 + obs) * 0.6);
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < phrases.length; i++) {
    r -= weights[i];
    if (r <= 0) return phrases[i];
  }
  return phrases[phrases.length - 1];
}

export async function createPhraseEngine(opts) {
  const world = opts.world;
  const container = opts.container || document.body;
  const reduce = opts.reduceMotion || (world && world.reduceMotion);
  const ariaLive = opts.ariaLive;
  const phrasesUrl = opts.phrasesUrl || './phrases.json';

  const res = await fetch(phrasesUrl, { credentials: 'omit' });
  const data = await res.json();
  const phrases = data.phrases || [];
  const colorMap = data.canonColorMap || {};
  const colorHex = {
    R: '#ff3b3b', G: '#39ff7a', B: '#3bb6ff',
    C: '#3bf0ff', M: '#ff3bd0', Y: '#ffe53b',
  };

  // Phrase layer
  const layer = document.createElement('div');
  layer.className = 'inryoku-phrase-layer';
  layer.setAttribute('aria-hidden', 'true');
  container.appendChild(layer);

  const active = []; // { el, anchor, born, state }
  let running = true;
  let lastRecent = []; // dedupe recently shown ids

  function colorForCanon(canon) {
    return colorHex[colorMap[canon] || 'C'] || '#3bf0ff';
  }

  function spawn() {
    if (!running) return;
    if (active.length >= MAX_CONCURRENT) return;

    const obs = readObservations();
    // Avoid the last 4 ids repeating
    const pool = phrases.filter((p) => !lastRecent.includes(p.id));
    const phrase = weightedPick(pool.length ? pool : phrases, obs);
    lastRecent.push(phrase.id);
    if (lastRecent.length > 4) lastRecent.shift();

    const el = document.createElement('div');
    el.className = 'inryoku-phrase inryoku-phrase--cat-' + phrase.category;
    el.textContent = phrase.text;
    el.style.color = colorForCanon(phrase.canon);
    el.style.opacity = '0';
    layer.appendChild(el);

    let anchor;
    if (reduce || !world) {
      // Static position — gentle vertical band, randomized
      const x = window.innerWidth * (0.18 + Math.random() * 0.64);
      const y = window.innerHeight * (0.28 + Math.random() * 0.44);
      anchor = { mode: 'static', x, y };
    } else {
      const a = world.pickAnchorInFront();
      anchor = { mode: 'world', wx: a.x, wy: a.y, wz: a.z };
    }

    const entry = { el, anchor, born: performance.now(), phrase, state: 'in' };
    active.push(entry);

    // Politely surface to screen-reader users (text only — no styling matters here)
    if (ariaLive && phrase.category !== 'silence') {
      try { ariaLive.textContent = phrase.text; } catch (_) {}
    }

    // Record an observation so weight evolves
    try {
      const o = readObservations();
      o[phrase.canon] = (o[phrase.canon] || 0) + 1;
      localStorage.setItem('__inryokuObservations', JSON.stringify(o));
    } catch (_) {}

    // schedule the next spawn
    const next = SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
    setTimeout(spawn, next);
  }

  function tick(now) {
    if (!running) return;
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      const age = now - e.born;

      // position
      let sx, sy, behind = false;
      if (e.anchor.mode === 'static') {
        sx = e.anchor.x; sy = e.anchor.y;
      } else {
        const out = world.projectToScreen(e.anchor.wx, e.anchor.wy, e.anchor.wz);
        sx = out.x; sy = out.y; behind = out.behind;
      }

      // opacity envelope
      let alpha = 0;
      if (age < FADE_IN_MS) {
        alpha = age / FADE_IN_MS;
      } else if (age < FADE_IN_MS + HOLD_MS) {
        alpha = 1;
      } else if (age < FADE_IN_MS + HOLD_MS + FADE_OUT_MS) {
        alpha = 1 - (age - FADE_IN_MS - HOLD_MS) / FADE_OUT_MS;
      } else {
        e.el.remove();
        active.splice(i, 1);
        continue;
      }

      if (behind) alpha *= 0.0; // hide if anchor went behind camera
      e.el.style.opacity = alpha.toFixed(3);
      e.el.style.transform =
        'translate3d(' + (sx | 0) + 'px,' + (sy | 0) + 'px,0) translate(-50%,-50%)';
    }
    requestAnimationFrame(tick);
  }

  // Start
  setTimeout(spawn, 1200);
  requestAnimationFrame(tick);

  function dispose() {
    running = false;
    active.forEach((e) => { try { e.el.remove(); } catch (_) {} });
    try { layer.remove(); } catch (_) {}
  }

  return { dispose, layer, phrases };
}

export default createPhraseEngine;
