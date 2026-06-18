import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const LEGAL_PAGES = [
  'legal.html',
  'privacy.html',
  'returns.html',
  'size-guide.html',
  'success.html',
  'offline.html',
];

function read(file) {
  return readFileSync(resolve(ROOT, file), 'utf8');
}

function parse(file) {
  return new JSDOM(read(file));
}

describe('Document shell contract', () => {
  for (const file of ['index.html', 'p3_test.html', ...LEGAL_PAGES]) {
    test(`${file}: has doctype, lang=ja, title, and viewport`, () => {
      const html = read(file);
      const dom = parse(file);
      const doc = dom.window.document;

      assert.match(html, /^\s*<!DOCTYPE html>/i, `${file}: missing HTML5 doctype`);
      assert.equal(doc.documentElement.lang, 'ja', `${file}: lang must be ja`);
      assert.ok(doc.querySelector('title')?.textContent.trim(), `${file}: missing title`);
      assert.ok(doc.querySelector('meta[name="viewport"]'), `${file}: missing viewport`);
    });
  }
});

describe('Secondary page contract', () => {
  for (const file of LEGAL_PAGES) {
    test(`${file}: has exactly one h1`, () => {
      const doc = parse(file).window.document;
      assert.equal(doc.querySelectorAll('h1').length, 1, `${file}: expected exactly one h1`);
    });

    test(`${file}: mounts i18n UI and runtime`, () => {
      const doc = parse(file).window.document;
      assert.ok(doc.querySelector('.i18n-toggle-host'), `${file}: missing .i18n-toggle-host`);
      assert.ok(doc.querySelector('script[src="/i18n.js"]'), `${file}: missing /i18n.js`);
      assert.ok(doc.querySelector('link[href="/i18n.css"]'), `${file}: missing /i18n.css`);
    });
  }

  test('legal/privacy/returns/size-guide/success pages expose a back link to the shop flow', () => {
    const expected = new Map([
      ['legal.html', '/p1_index_for_claude.html'],
      ['privacy.html', '/p1_index_for_claude.html'],
      ['returns.html', '/p1_index_for_claude.html'],
      ['size-guide.html', '/p1_index_for_claude.html'],
      ['success.html', '/p3_test.html'],
    ]);

    for (const [file, href] of expected) {
      const doc = parse(file).window.document;
      const link = doc.querySelector(`a[href="${href}"]`);
      assert.ok(link, `${file}: missing back link to ${href}`);
    }
  });

  test('offline page provides retry button and home fallback link', () => {
    const doc = parse('offline.html').window.document;
    assert.ok(doc.querySelector('button#retry-btn[type="button"]'));
    assert.ok(doc.querySelector('a.home[href="/"]'));
  });
});

describe('index/p3 runtime bootstrap contract', () => {
  for (const file of ['index.html', 'p3_test.html']) {
    test(`${file}: provides #root and local Three.js bootstrap`, () => {
      const doc = parse(file).window.document;
      assert.ok(doc.querySelector('#root'), `${file}: missing #root`);
      assert.ok(doc.querySelector('script[src="vendor/three.min.js"]'), `${file}: missing local Three.js`);
    });

    test(`${file}: defines importmap aliases for self-hosted three addons`, () => {
      const html = read(file);
      const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/i);
      assert.ok(m, `${file}: missing importmap`);
      const map = JSON.parse(m[1]);
      assert.equal(map.imports.three, '/vendor/three/window-shim.js');
      assert.equal(map.imports['three/addons/'], '/vendor/three/examples/jsm/');
    });

    test(`${file}: preserves particle script order`, () => {
      const html = read(file);
      const canonIdx = html.indexOf('particle_canon_meta.js');
      const ringsIdx = html.indexOf('particle_rings.js');
      const speechIdx = html.indexOf('particle_speech_rings.js');
      assert.ok(canonIdx >= 0 && ringsIdx >= 0 && speechIdx >= 0, `${file}: particle scripts missing`);
      assert.ok(canonIdx < ringsIdx, `${file}: canon meta must load before rings`);
      assert.ok(ringsIdx < speechIdx, `${file}: rings must load before speech rings`);
    });

    test(`${file}: includes runtime guard layers after core app scripts`, () => {
      const html = read(file);
      for (const asset of [
        'error-shield.js',
        'ai-chat-client-shield.js',
        'copy-fix-runtime.js',
        'enhance.js',
        'register.js',
        'perf-observer.js',
        'i18n.js',
        'states.js',
        'cosmos-layer.js',
      ]) {
        assert.match(html, new RegExp(asset.replace('.', '\\.')), `${file}: missing ${asset}`);
      }
    });
  }
});
