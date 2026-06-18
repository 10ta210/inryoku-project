// tests/visual/css_token_consistency.test.mjs
// Verify that CSS custom properties in particle_rings.css and JS-side constants
// (REGISTER_OPACITY, COLOR_VALUES if defined) stay in sync.
// Failure mode: a value drift in either side fails this test, forcing the
// developer to update both intentionally.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assertBaseline } from './_helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const CSS = readFileSync(resolve(ROOT, 'particle_rings.css'), 'utf8');
const JS = readFileSync(resolve(ROOT, 'particle_speech_rings.js'), 'utf8');

// Extract --var: value; pairs from a CSS string.
function extractCssVars(css) {
  const out = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

// Extract REGISTER_OPACITY object literal from JS source.
function extractRegisterOpacity(js) {
  const m = js.match(/REGISTER_OPACITY\s*=\s*\{([\s\S]*?)\}/);
  if (!m) return null;
  const body = m[1];
  const out = {};
  const re = /(\w+)\s*:\s*([0-9.]+)/g;
  let mm;
  while ((mm = re.exec(body)) !== null) out[mm[1]] = Number(mm[2]);
  return out;
}

const cssVars = extractCssVars(CSS);
const REGISTER_OPACITY = extractRegisterOpacity(JS);

describe('visual/css_token_consistency — CSS変数 ⇔ JS 定数 整合性', () => {
  test('REGISTER_OPACITY が抽出できる', () => {
    assert.ok(REGISTER_OPACITY, 'REGISTER_OPACITY 抽出成功');
    assert.equal(typeof REGISTER_OPACITY.whisper, 'number');
    assert.equal(typeof REGISTER_OPACITY.hover, 'number');
    assert.equal(typeof REGISTER_OPACITY.click, 'number');
    assert.equal(typeof REGISTER_OPACITY.special, 'number');
  });

  test('--pr-c-{r,g,b,c,m,y} が CSS に存在する', () => {
    for (const k of ['r', 'g', 'b', 'c', 'm', 'y']) {
      const name = `--pr-c-${k}`;
      assert.ok(cssVars[name], `${name} 必須`);
      assert.match(cssVars[name], /^#[0-9a-f]{6}$/i, `${name} は #rrggbb 形式`);
    }
  });

  test('CSS .pring-speech__ring--hover の --pring-speech-target-opacity と JS REGISTER_OPACITY.hover が一致', () => {
    // セクション抽出
    const m = CSS.match(/\.pring-speech__ring--hover\s*\{([\s\S]*?)\}/);
    assert.ok(m, 'hover ルールが見つかる');
    const opacityMatch = m[1].match(/--pring-speech-target-opacity\s*:\s*([0-9.]+)/);
    assert.ok(opacityMatch, 'hover に --pring-speech-target-opacity がある');
    assert.equal(Number(opacityMatch[1]), REGISTER_OPACITY.hover,
      `CSS hover opacity ${opacityMatch[1]} ≠ JS REGISTER_OPACITY.hover ${REGISTER_OPACITY.hover}`);
  });

  test('CSS .pring-speech__ring--click と JS REGISTER_OPACITY.click が一致', () => {
    const m = CSS.match(/\.pring-speech__ring--click\s*\{([\s\S]*?)\}/);
    assert.ok(m);
    const o = m[1].match(/--pring-speech-target-opacity\s*:\s*([0-9.]+)/);
    assert.ok(o);
    assert.equal(Number(o[1]), REGISTER_OPACITY.click);
  });

  test('CSS .pring-speech__ring--special と JS REGISTER_OPACITY.special が一致', () => {
    const m = CSS.match(/\.pring-speech__ring--special\s*\{([\s\S]*?)\}/);
    assert.ok(m);
    const o = m[1].match(/--pring-speech-target-opacity\s*:\s*([0-9.]+)/);
    assert.ok(o);
    assert.equal(Number(o[1]), REGISTER_OPACITY.special);
  });

  test('CSS pring-speech-fadein keyframe の fallback opacity (0.84) が REGISTER_OPACITY.click と一致', () => {
    // CSS のデフォルト fallback は click と同じ 0.84 のはず（仕様的に最も標準的な register）
    const m = CSS.match(/@keyframes\s+pring-speech-fadein\s*\{([\s\S]*?)\}/);
    assert.ok(m, 'keyframe pring-speech-fadein が存在');
    const fallback = m[1].match(/--pring-speech-target-opacity\s*,\s*([0-9.]+)/);
    if (fallback) {
      assert.equal(Number(fallback[1]), REGISTER_OPACITY.click,
        'keyframe fallback は click 値と一致すべき');
    }
  });

  test('CSS の RGBCMY 色パレットが概念的に一貫 (R系=赤, G系=緑, B系=青, C系=シアン, M系=マゼンタ, Y系=黄)', () => {
    function hexToRgb(hex) {
      const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
    }
    const expectations = [
      { tok: '--pr-c-r', dom: 'r' },
      { tok: '--pr-c-g', dom: 'g' },
      { tok: '--pr-c-b', dom: 'b' },
      { tok: '--pr-c-c', dom: 'gb' },   // cyan = green + blue
      { tok: '--pr-c-m', dom: 'rb' },   // magenta = red + blue
      { tok: '--pr-c-y', dom: 'rg' }    // yellow = red + green
    ];
    for (const { tok, dom } of expectations) {
      const rgb = hexToRgb(cssVars[tok]);
      const channels = ['r', 'g', 'b'];
      const dominant = dom.split('');
      for (const ch of dominant) {
        // dominant channels should be ≥ 200 (bright)
        assert.ok(rgb[ch] >= 200, `${tok}: ${ch} channel should dominate (≥200), got ${rgb[ch]}`);
      }
      for (const ch of channels.filter((c) => !dominant.includes(c))) {
        // non-dominant channels can have a bit of bleed but shouldn't dominate
        assert.ok(rgb[ch] <= 200, `${tok}: ${ch} channel should be subordinate (≤200), got ${rgb[ch]}`);
      }
    }
  });

  test('baseline: 抽出した CSS トークン + JS 定数のスナップショット', () => {
    const snap = {
      registerOpacity: REGISTER_OPACITY,
      colorTokens: {
        '--pr-c-r': cssVars['--pr-c-r'],
        '--pr-c-g': cssVars['--pr-c-g'],
        '--pr-c-b': cssVars['--pr-c-b'],
        '--pr-c-c': cssVars['--pr-c-c'],
        '--pr-c-m': cssVars['--pr-c-m'],
        '--pr-c-y': cssVars['--pr-c-y']
      },
      chordVars: {
        '--pr-chord-width': cssVars['--pr-chord-width'],
        '--pr-chord-opacity': cssVars['--pr-chord-opacity']
      }
    };
    assertBaseline('css_token_consistency', snap);
  });
});
