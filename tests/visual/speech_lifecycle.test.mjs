// tests/visual/speech_lifecycle.test.mjs
// Capture the DOM tree at each phase of a speech utterance lifecycle:
// idle → mounted → utter → fade-class → removed. Plus a transition matrix
// across all 7 register × canon entry points.
import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM } from '../setup.mjs';
import { serializeDeep, assertBaseline } from './_helpers.mjs';

before(() => { setupDOM({ withSpeech: true }); });

function makeLogo() {
  // Clean DOM between tests
  document.body.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'hologram-logo';
  const logo = document.createElement('div');
  logo.className = 'logo-holo-wrap';
  host.appendChild(logo);
  document.body.appendChild(host);
  return { host, logo };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Snapshot the speech container subtree (or null) — strips the logo wrapper noise
function snapshotContainer(sp) {
  if (!sp.container) return { state: 'no-container' };
  return serializeDeep(sp.container);
}

describe('visual/speech_lifecycle — utterance phase snapshots', () => {
  test('lifecycle: idle → mount → utter → fade → removed', async () => {
    const { logo } = makeLogo();
    // Tight timings so the test completes quickly while preserving phases.
    // Use widely separated timings so the test can sample each phase
    // without racing the timers: crystallize+hold = 50ms, fade = 100ms.
    const sp = new ParticleSpeechRings(logo, {
      placement: 'below',
      crystallizeMs: 25,
      holdMin: 25, holdMax: 25,
      fadeMs: 100,
      initialDelayMin: 100000, initialDelayMax: 100000 // never auto-fire
    });

    const phases = {};
    // 1) idle: pre-start, no container
    phases.idle = snapshotContainer(sp);

    // 2) mounted: after start, container exists, no ring yet
    sp.start();
    phases.mounted = snapshotContainer(sp);

    // 3) utter: ring appended synchronously inside _utter
    const fired = sp._utter('whisper', { canon: 'core' });
    assert.equal(fired, true, '_utter returns true');
    phases.uttered = snapshotContainer(sp);

    // 4) fade-class: hold timer fires at ~50ms, sample at 80ms (well into fade window)
    await wait(80);
    phases.fading = snapshotContainer(sp);
    // Sanity: ring still present, with --fade class
    assert.ok(sp._currentRing, 'ring still in DOM during fade');
    assert.ok(sp._currentRing.classList.contains('pring-speech__ring--fade'),
      'ring has --fade class');

    // 5) removed: fadeMs(100) ends at ~150ms total; sample at 220ms
    await wait(140);
    phases.removed = snapshotContainer(sp);
    assert.equal(sp._currentRing, null, 'ring detached');

    sp.destroy();
    assertBaseline('speech_lifecycle_whisper_core', phases);
  });

  test('lifecycle: register=hover canon=observation', async () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, {
      placement: 'below',
      crystallizeMs: 5, holdMin: 5, holdMax: 5, fadeMs: 10,
      initialDelayMin: 100000, initialDelayMax: 100000,
      hoverCooldownMs: 0
    });
    sp.start();
    sp._utter('hover', { canon: 'observation' });
    const snap = snapshotContainer(sp);
    sp.destroy();
    assertBaseline('speech_lifecycle_hover_observation', snap);
  });

  test('lifecycle: register=click canon=resonance', async () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, {
      placement: 'below',
      crystallizeMs: 5, holdMin: 5, holdMax: 5, fadeMs: 10,
      initialDelayMin: 100000, initialDelayMax: 100000,
      clickCooldownMs: 0
    });
    sp.start();
    sp._utter('click', { canon: 'resonance' });
    const snap = snapshotContainer(sp);
    sp.destroy();
    assertBaseline('speech_lifecycle_click_resonance', snap);
  });

  test('lifecycle: register=special canon=summon', async () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, {
      placement: 'below',
      crystallizeMs: 5, holdMin: 5, holdMax: 5, fadeMs: 10,
      initialDelayMin: 100000, initialDelayMax: 100000
    });
    sp.start();
    sp.summon();
    const snap = snapshotContainer(sp);
    sp.destroy();
    assertBaseline('speech_lifecycle_special_summon', snap);
  });

  test('register × canon transition matrix (7 entries)', () => {
    const matrix = [
      { register: 'whisper', canon: 'core' },
      { register: 'whisper', canon: 'silence' },
      { register: 'hover', canon: 'observation' },
      { register: 'hover', canon: 'self_question' },
      { register: 'click', canon: 'resonance' },
      { register: 'special', canon: 'summon' },
      { register: 'special', canon: 'revelation' }
    ];
    const out = {};
    for (const { register, canon } of matrix) {
      const { logo } = makeLogo();
      const sp = new ParticleSpeechRings(logo, {
        placement: 'below',
        crystallizeMs: 5, holdMin: 5, holdMax: 5, fadeMs: 10,
        initialDelayMin: 100000, initialDelayMax: 100000,
        hoverCooldownMs: 0, clickCooldownMs: 0
      });
      sp.start();
      if (register === 'special') {
        sp._utter('special', { canon, size: 180 });
      } else {
        sp._utter(register, { canon });
      }
      const ring = sp._currentRing;
      out[`${register}_${canon}`] = ring ? {
        classes: Array.from(ring.classList).sort(),
        targetOpacity: ring.style.getPropertyValue('--pring-speech-target-opacity'),
        size: ring.style.getPropertyValue('--pring-speech-size')
      } : { state: 'no-ring' };
      sp.destroy();
    }
    assertBaseline('speech_register_canon_matrix', out);
  });

  test('ringstart / ringend events are dispatched on _utter and on cleanup', async () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, {
      placement: 'below',
      crystallizeMs: 5, holdMin: 5, holdMax: 5, fadeMs: 10,
      initialDelayMin: 100000, initialDelayMax: 100000
    });
    const events = [];
    const onStart = (e) => events.push({ type: 'ringstart', detail: e.detail });
    const onEnd = (e) => events.push({ type: 'ringend', detail: e.detail });
    window.addEventListener('inryoku:ringstart', onStart);
    window.addEventListener('inryoku:ringend', onEnd);

    sp.start();
    sp._utter('whisper', { canon: 'core' });
    await wait(40);
    window.removeEventListener('inryoku:ringstart', onStart);
    window.removeEventListener('inryoku:ringend', onEnd);
    sp.destroy();

    assert.ok(events.length >= 2, `expected ≥2 events, got ${events.length}`);
    assert.equal(events[0].type, 'ringstart');
    assert.equal(events[0].detail.canon, 'core');
    assert.equal(events[0].detail.register, 'whisper');
    const endEvent = events.find((e) => e.type === 'ringend');
    assert.ok(endEvent, 'ringend dispatched');
  });
});
