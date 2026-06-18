// extensions/_examples/inryoku-aurora/index.js
// Aurora extension — a slow chromatic curtain. Adds:
//   - behavior  'aurora'           (golden-angle sphere, hue drifts along latitude)
//   - canon     'aurora_breath'    (cyan→magenta breath across the ring)
//   - scene     state 'inspired' → behavior 'aurora'

const aurora = {
  meta: { id: 'aurora', label: 'Aurora', tags: ['idle'] },
  step(i, count, target, color, time /*, ctx */) {
    const u = i / Math.max(1, count);
    const phi = Math.acos(2 * u - 1);
    const theta = u * count * 2.39996;
    const r = 14 + 2 * Math.sin(time * 0.4 + u * 6.0);
    const sp = Math.sin(phi);
    target.set(r * sp * Math.cos(theta), r * Math.cos(phi), r * sp * Math.sin(theta));
    // Aurora hue: slow drift along latitude (y), banded.
    const hue = (Math.cos(phi) * 0.5 + 0.5 + time * 0.04) % 1;
    color.setHSL(hue, 0.7, 0.5);
  }
};

const aurora_breath = {
  glyph: {
    canon: 'aurora_breath',
    direction: 'cw',
    doubleRing: false,
    ticks: [
      { tick: 0,  color: 'C' },
      { tick: 3,  color: 'C' },
      { tick: 6,  color: 'M' },
      { tick: 9,  color: 'M' }
    ],
    strings: [
      { from: 0, to: 6, arc: true,  color: 'C' },
      { from: 3, to: 9, arc: true,  color: 'M' }
    ],
    phaseAdvance: 1
  },
  audio: { register: 'whisper' }
};

export default {
  behaviors: [aurora],
  canons:    [aurora_breath],
  scenes:    [{ state: 'inspired', behavior: 'aurora' }]
};
