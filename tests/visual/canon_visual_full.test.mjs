// tests/visual/canon_visual_full.test.mjs
// Full deep-serialization snapshot of every canon ring's SVG output.
// First run creates baseline files; subsequent runs diff against them.
// Intentional updates: VISUAL_UPDATE=1 npm run test:visual or scripts/update-visual-baseline.sh
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM } from '../setup.mjs';
import { serializeDeep, assertBaseline } from './_helpers.mjs';

before(() => { setupDOM(); });

describe('visual/canon_visual_full — 全 17 canon の deep snapshot', () => {
  test('CANON_RINGS は 17 種類', () => {
    assert.equal(ParticleRings.KINDS.length, 17);
  });

  // Generate one test per canon — each writes its own baseline file.
  for (const name of [
    'silence', 'core', 'ma', 'shadow', 'echo',
    'observation', 'self_question', 'past_speculation', 'quotation',
    'declaration', 'leap', 'resonance', 'consensus', 'emit', 'future_command',
    'summon', 'revelation'
  ]) {
    test(`baseline: canon "${name}"`, () => {
      const svg = ParticleRings.canon(name, { size: 100 });
      const payload = serializeDeep(svg);
      assertBaseline(`canon_${name}`, payload);
    });
  }

  test('baseline: full canon set fingerprint (size=200)', () => {
    const map = {};
    for (const name of ParticleRings.KINDS) {
      const svg = ParticleRings.canon(name, { size: 200 });
      map[name] = serializeDeep(svg);
    }
    assertBaseline('canon_all_size200', map);
  });
});
