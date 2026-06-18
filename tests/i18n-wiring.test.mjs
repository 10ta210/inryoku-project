// i18n wiring test — verifies legal/static HTML uses keys that exist in i18n.json
// and that data-i18n-attr syntax is well-formed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TARGETS = [
  'legal.html',
  'privacy.html',
  'returns.html',
  'size-guide.html',
  'success.html',
  'offline.html'
];

function loadDict() {
  const raw = readFileSync(resolve(ROOT, 'i18n.json'), 'utf8');
  const json = JSON.parse(raw);
  return json;
}

function parse(file) {
  const html = readFileSync(resolve(ROOT, file), 'utf8');
  return new JSDOM(html);
}

const dict = loadDict();
const validKeys = new Set(Object.keys(dict).filter((k) => k !== '_meta'));

test('i18n.json parses and contains both ja/en for every key', () => {
  for (const key of validKeys) {
    const entry = dict[key];
    assert.ok(entry && typeof entry === 'object', `entry missing for ${key}`);
    assert.equal(typeof entry.ja, 'string', `ja missing for ${key}`);
    assert.equal(typeof entry.en, 'string', `en missing for ${key}`);
    assert.ok(entry.ja.length > 0, `ja empty for ${key}`);
    assert.ok(entry.en.length > 0, `en empty for ${key}`);
  }
});

test('i18n.json has ≥ 50 legal-page keys (legal/privacy/returns/size_guide/success/offline)', () => {
  const prefixes = ['legal.', 'privacy.', 'returns.', 'size_guide.', 'success.', 'offline.'];
  const count = [...validKeys].filter((k) => prefixes.some((p) => k.startsWith(p))).length;
  assert.ok(count >= 50, `expected >= 50 legal-page keys, got ${count}`);
});

for (const file of TARGETS) {
  test(`${file}: every data-i18n key exists in i18n.json`, () => {
    const dom = parse(file);
    const nodes = dom.window.document.querySelectorAll('[data-i18n]');
    assert.ok(nodes.length > 0, `${file} has no data-i18n attributes`);
    for (const n of nodes) {
      const k = n.getAttribute('data-i18n');
      assert.ok(validKeys.has(k), `${file}: unknown key "${k}"`);
    }
  });

  test(`${file}: every data-i18n-attr spec is well-formed and references valid keys`, () => {
    const dom = parse(file);
    const nodes = dom.window.document.querySelectorAll('[data-i18n-attr]');
    for (const n of nodes) {
      const spec = n.getAttribute('data-i18n-attr') || '';
      const pairs = spec.split(',').map((s) => s.trim()).filter(Boolean);
      assert.ok(pairs.length > 0, `${file}: empty data-i18n-attr`);
      for (const p of pairs) {
        const parts = p.split(':');
        assert.equal(parts.length, 2, `${file}: malformed pair "${p}"`);
        const [attr, key] = parts.map((s) => s.trim());
        assert.ok(attr.length > 0 && key.length > 0, `${file}: empty attr/key in "${p}"`);
        assert.ok(validKeys.has(key), `${file}: unknown attr-key "${key}"`);
      }
    }
  });

  test(`${file}: includes i18n-toggle-host placeholder and loads i18n.js`, () => {
    const html = readFileSync(resolve(ROOT, file), 'utf8');
    assert.match(html, /i18n-toggle-host/, `${file}: missing toggle host`);
    assert.match(html, /i18n\.js/, `${file}: missing i18n.js script`);
  });
}

test('data-i18n total coverage across legal pages ≥ 30', () => {
  let total = 0;
  for (const file of TARGETS) {
    const dom = parse(file);
    total += dom.window.document.querySelectorAll('[data-i18n]').length;
  }
  assert.ok(total >= 30, `expected >= 30 data-i18n nodes across legal pages, got ${total}`);
});
