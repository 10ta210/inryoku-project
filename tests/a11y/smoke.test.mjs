// tests/a11y/smoke.test.mjs — structural a11y smoke test for P3 wave-1 files.
// No jsdom — regex parsing is enough for these specific assertions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const HTML_FILES = [
  'p1_upgrade_preview.html',
  'p2_upgrade_preview.html',
  'p3_effects_test.html',
  'p3_audio_test.html'
];

test('all wave-1 HTMLs declare <html lang="...">', () => {
  for (const f of HTML_FILES) {
    const src = read(f);
    assert.match(src, /<html\s+lang=["'][a-z]{2}/i, `${f}: missing <html lang>`);
  }
});

test('all wave-1 HTMLs have a skip link', () => {
  for (const f of HTML_FILES) {
    const src = read(f);
    assert.match(
      src,
      /class=["'][^"']*cosmos-skip-link[^"']*["'][^>]*href=["']#main/i,
      `${f}: missing cosmos-skip-link → #main`
    );
  }
});

test('all wave-1 HTMLs declare a <main id="main"> landmark', () => {
  for (const f of HTML_FILES) {
    const src = read(f);
    assert.match(src, /<main\s+id=["']main["']/i, `${f}: missing <main id="main">`);
  }
});

test('all wave-1 HTMLs include cosmos-a11y.css', () => {
  for (const f of HTML_FILES) {
    const src = read(f);
    assert.match(src, /href=["']cosmos-a11y\.css["']/, `${f}: missing cosmos-a11y.css`);
  }
});

test('all wave-1 HTMLs have at least one aria-live region', () => {
  for (const f of HTML_FILES) {
    const src = read(f);
    assert.match(src, /aria-live=["'](polite|assertive)["']/, `${f}: no aria-live region`);
  }
});

test('no `outline: none` without a replacement focus style', () => {
  for (const f of HTML_FILES) {
    const src = read(f);
    // Allow `outline: none` only if a `:focus-visible` style is also present
    // in the same file. We don't enforce ordering — presence is enough.
    const hasOutlineNone = /outline\s*:\s*none/i.test(src);
    if (hasOutlineNone) {
      assert.match(
        src,
        /:focus-visible|cosmos-a11y\.css/,
        `${f}: outline:none without :focus-visible replacement`
      );
    }
  }
});

test('cosmos-a11y.css provides :focus-visible ring', () => {
  const css = read('cosmos-a11y.css');
  assert.match(css, /:focus-visible/, 'cosmos-a11y.css: missing :focus-visible');
  assert.match(css, /outline:\s*\d+px\s+solid\s+hsl/i,
    'cosmos-a11y.css: focus ring must use HSL (light=0.5 brand rule)');
  // light=0.5 enforced — search for ", 50%)" in HSL (3rd channel = lightness)
  assert.match(css, /hsl\([^)]*,\s*\d{1,3}%\s*,\s*50%\s*\)/i,
    'cosmos-a11y.css: focus accent must be light=50%');
});

test('cosmos-a11y.css ships reduce-motion override', () => {
  const css = read('cosmos-a11y.css');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    'cosmos-a11y.css: missing prefers-reduced-motion media query');
});

test('cosmos-a11y.css defines .sr-only utility', () => {
  const css = read('cosmos-a11y.css');
  assert.match(css, /\.sr-only/, 'cosmos-a11y.css: missing .sr-only');
});

test('cosmos-a11y.js exports applyA11y', () => {
  const js = read('cosmos-a11y.js');
  assert.match(js, /export\s+(function|default|\{[^}]*applyA11y)/,
    'cosmos-a11y.js: applyA11y export not found');
});

test('cosmos-percentage-hud has aria-label and role=status', () => {
  const js = read('cosmos-percentage-hud.js');
  assert.match(js, /setAttribute\(['"]role['"],\s*['"]status['"]\)/);
  assert.match(js, /setAttribute\(['"]aria-label['"]/);
});

test('cosmos-percentage-hud: root aria-live is off; dedicated announcer is polite', () => {
  // B7: root must NOT have aria-live=polite (tween would flood SR). The
  // off-screen announcer span carries aria-live=polite and is updated only
  // on +1% boundaries / wraps.
  const js = read('cosmos-percentage-hud.js');
  assert.match(js, /setAttribute\(['"]aria-live['"],\s*['"]off['"]\)/,
    'root aria-live should be "off"');
  assert.match(js, /cosmos-pct-srtext[^<]*aria-live=["']polite["']/,
    'dedicated .cosmos-pct-srtext announcer must be aria-live=polite');
});

test('p3_audio_test gesture overlay has dialog role', () => {
  const src = read('p3_audio_test.html');
  assert.match(src, /id=["']gesture["'][^>]*role=["']dialog["']/,
    'gesture overlay must be role=dialog');
  assert.match(src, /aria-modal=["']true["']/);
});

test('all wave-1 HTMLs mark decorative canvases aria-hidden', () => {
  for (const f of HTML_FILES) {
    const src = read(f);
    const canvasMatches = src.match(/<canvas\b[^>]*>/g) || [];
    for (const c of canvasMatches) {
      assert.match(
        c,
        /aria-hidden=["']true["']/,
        `${f}: canvas without aria-hidden: ${c}`
      );
    }
  }
});
