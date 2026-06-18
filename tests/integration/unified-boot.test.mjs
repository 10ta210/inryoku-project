// tests/integration/unified-boot.test.mjs
// Smoke test for cosmos-integration.js and cosmos-bus.js.
//
// We cannot import cosmos-integration directly in Node — it imports 'three'
// from an HTML importmap. Instead we:
//   1. Import cosmos-bus.js (pure JS, no deps) and verify event semantics.
//   2. Static-parse cosmos-integration.js to confirm it exports
//      `bootInryokuP3` and wires the documented event vocabulary.
//   3. Static-parse p3_unified_test.html to confirm it loads the orchestrator.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

// -- 1. cosmos-bus runtime semantics --------------------------------------
const busMod = await import(resolve(ROOT, 'cosmos-bus.js'));
const { createBus } = busMod;

test('bus.on / emit / off basic semantics', () => {
  const bus = createBus();
  let count = 0;
  let last = null;
  const off = bus.on('behavior:change', (p) => { count++; last = p; });
  bus.emit('behavior:change', { id: 'ring_resonance' });
  bus.emit('behavior:change', { id: 'idle_static' });
  off();
  bus.emit('behavior:change', { id: 'attractor_hover' });
  assert.equal(count, 2);
  assert.equal(last.id, 'idle_static');
});

test('bus isolates throwing listeners', () => {
  const bus = createBus();
  let other = 0;
  bus.on('x', () => { throw new Error('boom'); });
  bus.on('x', () => { other++; });
  bus.emit('x', null);
  assert.equal(other, 1);
});

test('bus.clear removes all listeners', () => {
  const bus = createBus();
  let n = 0;
  bus.on('a', () => n++);
  bus.clear();
  bus.emit('a', null);
  assert.equal(n, 0);
});

test('bus default export is createBus', async () => {
  assert.equal(busMod.default, createBus);
});

// -- 2. cosmos-integration source-level smoke -----------------------------
const integrationSrc = readFileSync(resolve(ROOT, 'cosmos-integration.js'), 'utf8');

test('cosmos-integration exports bootInryokuP3', () => {
  assert.ok(/export\s+function\s+bootInryokuP3/.test(integrationSrc),
            'expected named export bootInryokuP3');
  assert.ok(/export\s+default\s+bootInryokuP3/.test(integrationSrc),
            'expected default export bootInryokuP3');
});

test('cosmos-integration wires expected bus events', () => {
  const events = [
    'behavior:change',
    'observation:pulse',
    'audio:canon',
    'effects:burst',
    'scene:reduce-motion',
    'scene:behavior-change',
    'scene:resize',
    'audio:ready',
    'ui:request-behavior'
  ];
  for (const ev of events) {
    assert.ok(integrationSrc.includes(`'${ev}'`),
              `cosmos-integration must reference '${ev}'`);
  }
});

test('cosmos-integration propagates reduceMotion into shared ctx', () => {
  // ctx.reduceMotion contract — behaviors read this to clamp time. Must be
  // initialized at boot and updated via a11y.onReduceMotionChange.
  assert.match(integrationSrc, /ctx\.reduceMotion\s*=/,
    'ctx.reduceMotion must be assigned in the shared ctx');
  assert.match(integrationSrc, /onReduceMotionChange/,
    'cosmos-integration must subscribe to onReduceMotionChange');
});

test('cosmos-integration imports every required module', () => {
  const required = [
    './cosmos-bus.js',
    './cosmos-effects.js',
    './cosmos-postfx.js',
    './cosmos-audio.js',
    './cosmos-observation.js',
    './cosmos-interaction.js',
    './cosmos-percentage-hud.js',
    './behaviors/index.js'
  ];
  for (const r of required) {
    assert.ok(integrationSrc.includes(r),
              `cosmos-integration must import ${r}`);
  }
});

test('cosmos-integration calls effects.fireBurst, audio.play, observation.pulse', () => {
  for (const fn of ['effects.fireBurst', 'audio.play', 'observation.pulse']) {
    assert.ok(integrationSrc.includes(fn),
              `cosmos-integration should call ${fn}`);
  }
});

// -- 3. unified test HTML uses the orchestrator ---------------------------
test('p3_unified_test.html imports bootInryokuP3', () => {
  const html = readFileSync(resolve(ROOT, 'p3_unified_test.html'), 'utf8');
  assert.ok(html.includes('cosmos-integration.js'));
  assert.ok(html.includes('bootInryokuP3'));
  assert.ok(html.includes('data-contact-cta'),
            'should expose a CONTACT CTA for the contact-state hook');
  assert.ok(html.includes('importmap') && html.includes('three'),
            'should declare a three.js importmap');
});

// -- 4. behavior meta coverage -------------------------------------------
test('cosmos-integration BEHAVIOR_META covers all behaviors/index.js ids', async () => {
  const { BEHAVIORS } = await import(resolve(ROOT, 'behaviors', 'index.js'));
  for (const id of BEHAVIORS.keys()) {
    assert.ok(integrationSrc.includes(id + ':'),
              `BEHAVIOR_META must include entry for ${id}`);
  }
});
