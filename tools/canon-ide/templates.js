// tools/canon-ide/templates.js
// The 17 existing canons re-exported as editable templates for the Canon IDE.
// Loaded on demand — the IDE deep-clones each template before editing so the
// originals stay immutable.
//
// This module is the single point of contact between the IDE and core glyphs.
// If `logo-glyph.js` changes shape, only this file needs to follow.

import { GLYPHS, CANON_KINDS } from '../../logo-glyph.js';

function clone(g) {
  return {
    canon: g.canon,
    direction: g.direction,
    doubleRing: !!g.doubleRing,
    ticks: g.ticks.map((t) => ({ tick: t.tick, color: t.color || null })),
    strings: g.strings.map((s) => ({
      from: s.from, to: s.to, arc: !!s.arc, color: s.color || null
    })),
    phaseAdvance: g.phaseAdvance | 0
  };
}

export const TEMPLATES = Object.freeze(
  CANON_KINDS.reduce((acc, id) => { acc[id] = clone(GLYPHS[id]); return acc; }, {})
);

export const TEMPLATE_IDS = Object.freeze([...CANON_KINDS]);

export function getTemplate(id) {
  const t = TEMPLATES[id];
  if (!t) return clone(GLYPHS.silence);
  return clone(t); // fresh editable copy each time
}

export function blankCanon(id) {
  return {
    canon: id || 'untitled',
    direction: 'cw',
    doubleRing: false,
    ticks: [],
    strings: [],
    phaseAdvance: 0
  };
}

export default { TEMPLATES, TEMPLATE_IDS, getTemplate, blankCanon };
