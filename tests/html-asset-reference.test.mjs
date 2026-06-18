import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const HTML_FILES = [
  'index.html',
  'p3_test.html',
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

function toLocalPath(ref) {
  if (!ref || /^([a-z]+:)?\/\//i.test(ref)) return null;
  if (ref.startsWith('data:') || ref.startsWith('blob:') || ref.startsWith('#')) return null;
  if (ref === '/') return 'index.html';
  return ref.replace(/^\//, '').replace(/[?#].*$/, '');
}

function collectLocalRefs(file) {
  const html = read(file);
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const refs = [];

  for (const node of doc.querySelectorAll('[src], [href]')) {
    const attr = node.hasAttribute('src') ? 'src' : 'href';
    const raw = node.getAttribute(attr);
    const local = toLocalPath(raw);
    if (!local) continue;

    if (attr === 'href' && node.tagName === 'A') {
      if (!/\.(html?)$/i.test(local) && local !== 'index.html') continue;
    }

    refs.push({ attr, raw, local, tag: node.tagName.toLowerCase() });
  }

  return refs;
}

describe('HTML asset references resolve to local files', () => {
  for (const file of HTML_FILES) {
    test(`${file}: all local script/link/image/html refs exist`, () => {
      const refs = collectLocalRefs(file);
      assert.ok(refs.length > 0, `${file} should reference at least one local asset`);

      for (const ref of refs) {
        const abs = resolve(ROOT, ref.local);
        assert.ok(
          existsSync(abs),
          `${file}: missing ${ref.tag}[${ref.attr}] target ${ref.raw} -> ${ref.local}`
        );
      }
    });
  }
});

describe('Dynamic script targets referenced from inline bootstraps exist', () => {
  test('index.html lazy-load targets exist on disk', () => {
    const html = read('index.html');
    const matches = [...html.matchAll(/s\.src\s*=\s*'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(matches, ['p2_code_for_claude.js', 'p3_code_for_claude.js?v=20260430wgl22mq']);

    for (const raw of matches) {
      const local = toLocalPath(raw);
      assert.ok(existsSync(resolve(ROOT, local)), `missing lazy-loaded script: ${raw}`);
    }
  });
});
