// logo-glyph.js
// inryokü 円環粒子言語 — canon → glyph composition.
// Pure data module. 17 canon. 12-tick clock face. RGBCMY only (no grey).
//
// Glyph shape:
//   {
//     canon: string,
//     direction: 'cw' | 'ccw',
//     doubleRing: boolean,
//     ticks:   Array<{ tick: 0..11, color: 'R'|'G'|'B'|'C'|'M'|'Y'|null }>,
//     strings: Array<{ from: 0..11, to: 0..11, arc: boolean, color: 'R'|'G'|'B'|'C'|'M'|'Y'|null }>,
//     phaseAdvance: number     // signed integer applied to logo phase index
//   }

export const COLOR_HEX = {
  R: '#ff3b3b', // red
  G: '#39ff7a', // green
  B: '#3bb6ff', // blue
  C: '#3bf0ff', // cyan
  M: '#ff3bd0', // magenta
  Y: '#ffe53b'  // yellow
};

// Phase progression: R → G → B → C → M → Y → R …
export const PHASE_ORDER = ['R', 'G', 'B', 'C', 'M', 'Y'];

function tick(t, color) {
  return { tick: t, color: color || null };
}

function chord(a, b, color, arc) {
  return { from: a, to: b, arc: !!arc, color: color || null };
}

export const GLYPHS = Object.freeze({
  silence: {
    canon: 'silence',
    direction: 'cw',
    doubleRing: false,
    ticks: [],
    strings: [],
    phaseAdvance: 0
  },
  core: {
    canon: 'core',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(0, null)],
    strings: [],
    phaseAdvance: 0
  },
  ma: {
    canon: 'ma',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(0, null), tick(6, null)],
    strings: [],
    phaseAdvance: 1
  },
  shadow: {
    canon: 'shadow',
    direction: 'ccw',
    doubleRing: false,
    ticks: [],
    strings: [chord(3, 9, null, false)],
    phaseAdvance: 0
  },
  echo: {
    canon: 'echo',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(10, null), tick(0, null), tick(2, null)],
    strings: [],
    phaseAdvance: 1
  },
  emit: {
    canon: 'emit',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(0, null), tick(3, 'C')],
    strings: [chord(0, 3, 'C', false)],
    phaseAdvance: 1
  },
  observation: {
    canon: 'observation',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(0, 'Y'), tick(3, null), tick(6, null), tick(9, null)],
    strings: [],
    phaseAdvance: 1
  },
  self_question: {
    canon: 'self_question',
    direction: 'ccw',
    doubleRing: false,
    ticks: [tick(0, 'Y')],
    strings: [],
    phaseAdvance: 1
  },
  declaration: {
    canon: 'declaration',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(0, 'C'), tick(2, null), tick(4, null), tick(6, null), tick(8, null), tick(10, null)],
    strings: [chord(0, 6, 'C', false)],
    phaseAdvance: 1
  },
  leap: {
    canon: 'leap',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(6, null), tick(11, null), tick(0, 'M')],
    strings: [chord(6, 11, null, false), chord(11, 0, 'M', false)],
    phaseAdvance: 2
  },
  resonance: {
    canon: 'resonance',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(3, 'C'), tick(9, 'C')],
    strings: [chord(2, 8, 'C', false), chord(4, 10, 'C', false)],
    phaseAdvance: 1
  },
  consensus: {
    canon: 'consensus',
    direction: 'cw',
    doubleRing: false,
    ticks: [
      tick(0, 'G'), tick(1, null), tick(2, null), tick(3, null),
      tick(4, null), tick(5, null), tick(6, 'Y'), tick(7, null),
      tick(8, null), tick(9, null), tick(10, null), tick(11, null)
    ],
    strings: [],
    phaseAdvance: 1
  },
  past_speculation: {
    canon: 'past_speculation',
    direction: 'ccw',
    doubleRing: false,
    ticks: [tick(6, 'B'), tick(7, null), tick(8, null), tick(9, null), tick(10, null)],
    strings: [],
    phaseAdvance: -1
  },
  future_command: {
    canon: 'future_command',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(3, 'M'), tick(0, null), tick(6, null)],
    strings: [chord(0, 6, 'M', false), chord(0, 3, 'M', false), chord(6, 3, 'M', false)],
    phaseAdvance: 2
  },
  quotation: {
    canon: 'quotation',
    direction: 'cw',
    doubleRing: true,
    ticks: [tick(0, 'C')],
    strings: [],
    phaseAdvance: 0
  },
  summon: {
    canon: 'summon',
    direction: 'cw',
    doubleRing: false,
    ticks: [
      tick(0, 'Y'), tick(2, 'R'), tick(4, 'G'),
      tick(6, 'M'), tick(8, 'B'), tick(10, 'C')
    ],
    strings: [chord(0, 6, null, false), chord(2, 8, null, false), chord(4, 10, null, false)],
    phaseAdvance: 3
  },
  revelation: {
    canon: 'revelation',
    direction: 'cw',
    doubleRing: false,
    ticks: [tick(0, 'M'), tick(6, 'Y'), tick(11, null), tick(1, null)],
    strings: [chord(6, 0, 'M', true), chord(11, 1, 'Y', false)],
    phaseAdvance: 6  // full cycle
  }
});

export const CANON_KINDS = Object.freeze(Object.keys(GLYPHS));

export function getGlyph(canon) {
  const g = GLYPHS[canon];
  if (!g) return GLYPHS.silence;
  return g;
}

// Helper: tick index → (x, y) on unit circle (tick 0 = top, CW).
export function tickUnitPos(t) {
  const a = (-Math.PI / 2) + (t * Math.PI / 6);
  return { x: Math.cos(a), y: Math.sin(a) };
}

// Hex color for a code, or null → fallback.
export function colorHex(code, fallback) {
  if (!code) return fallback || '#cfcfcf';
  return COLOR_HEX[code] || fallback || '#cfcfcf';
}

// Glyph "completes the 6 colors" check (used by 裏ルート detector).
export function glyphCoversAllColors(glyph) {
  if (!glyph) return false;
  const seen = new Set();
  for (const t of glyph.ticks) if (t.color) seen.add(t.color);
  for (const s of glyph.strings) if (s.color) seen.add(s.color);
  return ['R', 'G', 'B', 'C', 'M', 'Y'].every((c) => seen.has(c));
}

export default { GLYPHS, getGlyph, COLOR_HEX, PHASE_ORDER, tickUnitPos, colorHex, glyphCoversAllColors, CANON_KINDS };
