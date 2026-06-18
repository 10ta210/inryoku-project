// tests/visual/_helpers.mjs
// Shared helpers for visual regression tests.
// - Deep, deterministic SVG → JSON serializer (numeric attrs rounded to 2 decimals)
// - Baseline read/write/diff orchestration with VISUAL_UPDATE=1 escape hatch
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const VISUAL_DIR = __dirname;
export const BASELINE_DIR = resolve(VISUAL_DIR, 'baseline');
export const SNAPSHOT_DIR = resolve(VISUAL_DIR, 'snapshots');

if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true });

// Numeric attributes whose values may include floats and should be rounded.
const NUMERIC_ATTRS = new Set([
  'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'rx', 'ry', 'stroke-width', 'opacity'
]);

// Round any numeric tokens within a string to 2 decimal places.
// Used for `d` (path) attribute and similar compound numeric strings.
function roundNumbersInString(s) {
  return String(s).replace(/-?\d+\.\d+/g, (m) => {
    const n = Number(m);
    if (!Number.isFinite(n)) return m;
    return (Math.round(n * 100) / 100).toString();
  });
}

function roundAttrValue(name, value) {
  if (value == null) return value;
  if (NUMERIC_ATTRS.has(name)) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
    return value;
  }
  // path data, transform, etc — round embedded floats
  if (name === 'd' || name === 'transform' || name === 'points') {
    return roundNumbersInString(value);
  }
  return value;
}

// Recursive deep serializer.
// Captures: tag, sorted classes, all attributes (rounded), inline style props (sorted),
// recursive children. Stable across runs.
export function serializeDeep(el) {
  const tag = el.tagName ? el.tagName.toLowerCase() : '#unknown';
  const classes = el.classList ? Array.from(el.classList).sort() : [];
  const attrs = {};
  if (el.attributes) {
    const list = Array.from(el.attributes)
      .map((a) => a.name)
      .filter((n) => n !== 'class' && n !== 'style')
      .sort();
    for (const n of list) {
      attrs[n] = roundAttrValue(n, el.getAttribute(n));
    }
  }
  // inline style: capture CSS custom properties + standard properties deterministically
  const styleMap = {};
  if (el.style && el.style.length != null) {
    const names = [];
    for (let i = 0; i < el.style.length; i++) names.push(el.style.item(i));
    names.sort();
    for (const n of names) {
      styleMap[n] = roundNumbersInString(el.style.getPropertyValue(n));
    }
  }
  const out = { tag, classes, attrs };
  if (Object.keys(styleMap).length) out.style = styleMap;
  const children = [];
  if (el.children) {
    for (const c of el.children) children.push(serializeDeep(c));
  }
  if (children.length) out.children = children;
  return out;
}

// Stable, sorted-key JSON serialization for diff stability.
export function stableStringify(obj) {
  return JSON.stringify(obj, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted = {};
      for (const k of Object.keys(v).sort()) sorted[k] = v[k];
      return sorted;
    }
    return v;
  }, 2);
}

const VISUAL_UPDATE = process.env.VISUAL_UPDATE === '1';

// Compare a payload against baseline file. On first run (no baseline), writes
// baseline and passes. On subsequent runs, diffs and throws on mismatch.
// VISUAL_UPDATE=1 always overwrites baseline (intentional update).
export function assertBaseline(name, payload) {
  const file = resolve(BASELINE_DIR, name + '.json');
  const text = stableStringify(payload);
  // Always write a "current snapshot" alongside baseline for diff inspection.
  writeFileSync(resolve(SNAPSHOT_DIR, name + '.json'), text, 'utf8');

  if (VISUAL_UPDATE || !existsSync(file)) {
    writeFileSync(file, text, 'utf8');
    return { created: !existsSync(file) ? false : true, updated: VISUAL_UPDATE };
  }
  const expected = readFileSync(file, 'utf8');
  if (expected !== text) {
    const diff = firstDiff(expected, text);
    const err = new Error(
      `[visual-regression] baseline mismatch for "${name}".\n` +
      `  baseline: tests/visual/baseline/${name}.json\n` +
      `  current:  tests/visual/snapshots/${name}.json\n` +
      `  first diff at line ${diff.line}:\n` +
      `    expected: ${diff.expected}\n` +
      `    received: ${diff.received}\n` +
      `  If this change is intentional, run: bash scripts/update-visual-baseline.sh`
    );
    throw err;
  }
  return { created: false, updated: false };
}

function firstDiff(a, b) {
  const al = a.split('\n');
  const bl = b.split('\n');
  const n = Math.max(al.length, bl.length);
  for (let i = 0; i < n; i++) {
    if (al[i] !== bl[i]) {
      return { line: i + 1, expected: al[i] ?? '<eof>', received: bl[i] ?? '<eof>' };
    }
  }
  return { line: 0, expected: '', received: '' };
}
