// tests/extensions/loader.test.mjs
// Unit tests for the extension loader. Uses injected readJSON + importer
// so no filesystem layout or live server is required (and so we can simulate
// broken modules deterministically).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  loadExtensions,
  validateManifest,
  validateGlyph,
  validateBehavior
} from '../../extensions/_loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

// ----------------------------------------------------------------------- //
// helpers
// ----------------------------------------------------------------------- //
function mkLoader(filesystem, modules) {
  // filesystem: { '/extensions/registry.json': [...], '/extensions/foo/manifest.json': {...} }
  // modules:    { '/extensions/foo/index.js': { default: { behaviors: [...] } } }
  return {
    root: '/extensions',
    readJSON: async (path) => {
      if (!(path in filesystem)) throw new Error('ENOENT ' + path);
      return JSON.parse(JSON.stringify(filesystem[path]));
    },
    importer: async (path) => {
      if (!(path in modules)) throw new Error('Cannot find module ' + path);
      const m = modules[path];
      if (typeof m === 'function') return m(); // throw simulator
      return m;
    },
    log: () => {}
  };
}

// ----------------------------------------------------------------------- //
// manifest validation
// ----------------------------------------------------------------------- //
test('validateManifest accepts a minimal valid manifest', () => {
  const errs = validateManifest({
    id: 'a-b', name: 'X', version: '0.1.0', type: 'bundle', entry: 'index.js'
  });
  assert.deepEqual(errs, []);
});

test('validateManifest rejects bad id', () => {
  const errs = validateManifest({
    id: 'Bad ID!', name: 'X', version: '0.1.0', type: 'bundle', entry: 'index.js'
  });
  assert.ok(errs.includes('id invalid'));
});

test('validateManifest rejects bad version', () => {
  const errs = validateManifest({
    id: 'good', name: 'X', version: 'one.two.three', type: 'bundle', entry: 'index.js'
  });
  assert.ok(errs.includes('version must be semver'));
});

test('validateManifest rejects unknown type', () => {
  const errs = validateManifest({
    id: 'good', name: 'X', version: '0.1.0', type: 'mystery', entry: 'index.js'
  });
  assert.ok(errs.includes('type invalid'));
});

test('validateManifest rejects entry with subpath', () => {
  const errs = validateManifest({
    id: 'good', name: 'X', version: '0.1.0', type: 'bundle', entry: '../outside.js'
  });
  assert.ok(errs.includes('entry must be <name>.js'));
});

// ----------------------------------------------------------------------- //
// glyph + behavior validation
// ----------------------------------------------------------------------- //
test('validateGlyph rejects non-RGBCMY color', () => {
  const errs = validateGlyph({
    canon: 'test', direction: 'cw', doubleRing: false,
    ticks: [{ tick: 0, color: 'K' }],
    strings: [], phaseAdvance: 0
  });
  assert.ok(errs.some((m) => m.includes('not RGBCMY')));
});

test('validateGlyph rejects duplicate tick indices', () => {
  const errs = validateGlyph({
    canon: 'test', direction: 'cw', doubleRing: false,
    ticks: [{ tick: 1, color: null }, { tick: 1, color: null }],
    strings: [], phaseAdvance: 0
  });
  assert.ok(errs.includes('duplicate tick'));
});

test('validateGlyph rejects string self-loop', () => {
  const errs = validateGlyph({
    canon: 'test', direction: 'cw', doubleRing: false,
    ticks: [], strings: [{ from: 3, to: 3, arc: false, color: null }],
    phaseAdvance: 0
  });
  assert.ok(errs.includes('string self-loop'));
});

test('validateBehavior requires meta.id and step', () => {
  assert.deepEqual(validateBehavior({}), ['behavior.meta.id required', 'behavior.step must be function']);
  assert.deepEqual(validateBehavior({ meta: { id: 'a' }, step: () => {} }), []);
});

// ----------------------------------------------------------------------- //
// loader: happy path
// ----------------------------------------------------------------------- //
test('loadExtensions registers behaviors, canons, scenes, commands', async () => {
  const fs = {
    '/extensions/registry.json': ['alpha'],
    '/extensions/alpha/manifest.json': {
      id: 'alpha', name: 'A', version: '0.1.0', type: 'bundle', entry: 'index.js'
    }
  };
  const mods = {
    '/extensions/alpha/index.js': {
      default: {
        behaviors: [{ meta: { id: 'b1', label: 'B1' }, step: () => {} }],
        canons: [{
          glyph: {
            canon: 'c1', direction: 'cw', doubleRing: false,
            ticks: [{ tick: 0, color: 'R' }], strings: [], phaseAdvance: 1
          }
        }],
        scenes: [{ state: 's1', behavior: 'b1' }],
        commands: [{ id: 'cmd.run', run: async () => 42 }]
      }
    }
  };
  const r = await loadExtensions(mkLoader(fs, mods));
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  assert.equal(r.extensions.length, 1);
  assert.ok(r.registries.behaviors.has('b1'));
  assert.ok(r.registries.canons.has('c1'));
  assert.equal(r.registries.scenes.get('s1').behavior, 'b1');
  assert.equal(r.registries.commands.length, 1);
  const cmd = r.registries.commands[0];
  assert.equal(await cmd.run(), 42);
});

// ----------------------------------------------------------------------- //
// broken extension isolation
// ----------------------------------------------------------------------- //
test('one broken extension does not break the others', async () => {
  const fs = {
    '/extensions/registry.json': ['bad', 'good'],
    '/extensions/bad/manifest.json': {
      id: 'bad', name: 'Bad', version: '0.1.0', type: 'bundle', entry: 'index.js'
    },
    '/extensions/good/manifest.json': {
      id: 'good', name: 'Good', version: '0.1.0', type: 'bundle', entry: 'index.js'
    }
  };
  const mods = {
    '/extensions/bad/index.js': () => { throw new Error('boom'); },
    '/extensions/good/index.js': {
      default: { behaviors: [{ meta: { id: 'okay' }, step: () => {} }] }
    }
  };
  const r = await loadExtensions(mkLoader(fs, mods));
  assert.ok(r.errors.find((e) => e.ext === 'bad'));
  assert.equal(r.extensions.length, 1);
  assert.ok(r.registries.behaviors.has('okay'));
});

// ----------------------------------------------------------------------- //
// duplicate id detection
// ----------------------------------------------------------------------- //
test('duplicate extension id is rejected on second load', async () => {
  const fs = {
    '/extensions/registry.json': ['one', 'two'],
    '/extensions/one/manifest.json': {
      id: 'dup', name: 'One', version: '0.1.0', type: 'bundle', entry: 'index.js'
    },
    '/extensions/two/manifest.json': {
      id: 'dup', name: 'Two', version: '0.2.0', type: 'bundle', entry: 'index.js'
    }
  };
  const mods = {
    '/extensions/one/index.js': { default: {} },
    '/extensions/two/index.js': { default: {} }
  };
  const r = await loadExtensions(mkLoader(fs, mods));
  assert.equal(r.extensions.length, 1);
  assert.ok(r.errors.some((e) => e.kind === 'duplicate-id'));
});

test('duplicate behavior id within registries is rejected fail-soft', async () => {
  const fs = {
    '/extensions/registry.json': ['a', 'b'],
    '/extensions/a/manifest.json': { id: 'a', name: 'A', version: '0.1.0', type: 'bundle', entry: 'index.js' },
    '/extensions/b/manifest.json': { id: 'b', name: 'B', version: '0.1.0', type: 'bundle', entry: 'index.js' }
  };
  const mods = {
    '/extensions/a/index.js': { default: { behaviors: [{ meta: { id: 'same' }, step: () => {} }] } },
    '/extensions/b/index.js': { default: { behaviors: [{ meta: { id: 'same' }, step: () => {} }] } }
  };
  const r = await loadExtensions(mkLoader(fs, mods));
  assert.equal(r.extensions.length, 2); // both loaded
  assert.equal(r.registries.behaviors.get('same').ext, 'a'); // first wins
});

// ----------------------------------------------------------------------- //
// path whitelist
// ----------------------------------------------------------------------- //
test('rejects folder name containing slash or ..', async () => {
  const fs = {
    '/extensions/registry.json': ['../escape']
  };
  const mods = {};
  const r = await loadExtensions(mkLoader(fs, mods));
  assert.equal(r.extensions.length, 0);
  assert.ok(r.errors.some((e) => /illegal folder name|ENOENT/i.test(JSON.stringify(e))));
});

test('rejects entry filename with slash', async () => {
  const fs = {
    '/extensions/registry.json': ['x'],
    '/extensions/x/manifest.json': { id: 'x', name: 'X', version: '0.1.0', type: 'bundle', entry: 'sub/dir.js' }
  };
  const mods = {};
  const r = await loadExtensions(mkLoader(fs, mods));
  assert.ok(r.errors.some((e) => e.kind === 'manifest'));
});

// ----------------------------------------------------------------------- //
// registry shape
// ----------------------------------------------------------------------- //
test('non-array registry.json is rejected', async () => {
  const fs = { '/extensions/registry.json': { not: 'array' } };
  const r = await loadExtensions(mkLoader(fs, {}));
  assert.ok(r.errors.some((e) => e.kind === 'registry'));
});

// ----------------------------------------------------------------------- //
// shipped example extensions: integrity smoke
// ----------------------------------------------------------------------- //
test('shipped example extensions pass manifest schema', () => {
  const aurora = JSON.parse(readFileSync(resolve(ROOT, 'extensions/_examples/inryoku-aurora/manifest.json'), 'utf8'));
  const haiku  = JSON.parse(readFileSync(resolve(ROOT, 'extensions/_examples/inryoku-haiku/manifest.json'), 'utf8'));
  assert.deepEqual(validateManifest(aurora), []);
  assert.deepEqual(validateManifest(haiku), []);
});

test('aurora canon passes glyph validation', async () => {
  const mod = await import(resolve(ROOT, 'extensions/_examples/inryoku-aurora/index.js'));
  const glyph = mod.default.canons[0].glyph;
  assert.deepEqual(validateGlyph(glyph), []);
});

test('haiku command emits exactly 17 canons in 5-7-5 meter', async () => {
  const mod = await import(resolve(ROOT, 'extensions/_examples/inryoku-haiku/index.js'));
  const { recite, POEM } = mod;
  assert.equal(POEM.length, 17);
  const out = await recite({});
  assert.equal(out.canons.length, 17);
  assert.deepEqual(out.meter, [5, 7, 5]);
});

// ----------------------------------------------------------------------- //
// sandbox source-level checks
// ----------------------------------------------------------------------- //
test('loader source contains no eval or new Function', () => {
  const src = readFileSync(resolve(ROOT, 'extensions/_loader.js'), 'utf8');
  assert.equal(/\beval\s*\(/.test(src), false, 'eval() found in loader');
  assert.equal(/\bnew\s+Function\b/.test(src), false, 'new Function found in loader');
});

test('example extensions contain no eval / Function / fetch', () => {
  for (const p of [
    'extensions/_examples/inryoku-aurora/index.js',
    'extensions/_examples/inryoku-haiku/index.js'
  ]) {
    const src = readFileSync(resolve(ROOT, p), 'utf8');
    assert.equal(/\beval\s*\(/.test(src), false, 'eval in ' + p);
    assert.equal(/\bnew\s+Function\b/.test(src), false, 'new Function in ' + p);
    assert.equal(/\bfetch\s*\(/.test(src), false, 'fetch in ' + p);
  }
});
