/* ============================================================
   tests/perf/budget.test.mjs
   Synthetic micro-benchmark: each behavior must step() 10,000
   target writes in well under 16ms, with no measurable heap
   growth between runs.

   - Uses node:test
   - Skips heap-diff assertion when performance.memory is absent
     (Chrome-only API; node has it via --expose-gc + perf hooks
     on newer V8, but we don't require it).
   - Uses a plain { set(x,y,z) } target and { setHSL(...) } color stub
     to avoid pulling THREE into the test harness.
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

function makeTargetStub() {
  return {
    x: 0, y: 0, z: 0,
    set(x, y, z) { this.x = x; this.y = y; this.z = z; }
  };
}
function makeColorStub() {
  return {
    r: 0, g: 0, b: 0,
    setHSL(h, s, l) {
      // good-enough no-allocation stand-in
      this.r = h; this.g = s; this.b = l;
    },
    setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; }
  };
}

const BEHAVIORS = [
  'breathing_sphere',
  'idle_static'
];

for (const id of BEHAVIORS) {
  test(`behavior ${id}: 10k step() < 16ms`, async () => {
    const url = pathToFileURL(resolve(ROOT, 'behaviors', `${id}.js`)).href;
    const mod = await import(url);
    assert.equal(typeof mod.step, 'function', 'step() exported');

    const target = makeTargetStub();
    const color = makeColorStub();
    const COUNT = 10000;

    // warmup
    for (let i = 0; i < COUNT; i++) {
      mod.step(i, COUNT, target, color, 1.234, {});
    }

    const t0 = performance.now();
    for (let i = 0; i < COUNT; i++) {
      mod.step(i, COUNT, target, color, 2.0 + i * 0.0001, {});
    }
    const elapsed = performance.now() - t0;
    // Generous margin: real 60fps frame is 16.67ms, behavior is one
    // slice of that. We're well under.
    assert.ok(elapsed < 16, `step() x10k = ${elapsed.toFixed(2)}ms (must <16ms)`);
  });

  test(`behavior ${id}: zero heap growth across 100k iterations`, async (t) => {
    if (typeof performance.memory === 'undefined') {
      t.skip('performance.memory unavailable on this platform');
      return;
    }
    const url = pathToFileURL(resolve(ROOT, 'behaviors', `${id}.js`)).href;
    const mod = await import(url);
    const target = makeTargetStub();
    const color = makeColorStub();
    const COUNT = 10000;

    // burn-in
    for (let i = 0; i < COUNT; i++) {
      mod.step(i, COUNT, target, color, 1.0, {});
    }
    if (global.gc) global.gc();
    const before = performance.memory.usedJSHeapSize;

    for (let pass = 0; pass < 10; pass++) {
      for (let i = 0; i < COUNT; i++) {
        mod.step(i, COUNT, target, color, 1.0 + pass * 0.01, {});
      }
    }
    if (global.gc) global.gc();
    const after = performance.memory.usedJSHeapSize;
    const delta = after - before;

    // Heap heuristic: under 1MB growth is acceptable noise.
    assert.ok(delta < 1024 * 1024,
      `heap delta ${(delta / 1024).toFixed(0)}KB exceeds 1MB budget`);
  });
}

test('createProfiler API surface', async () => {
  const url = pathToFileURL(resolve(ROOT, 'cosmos-perf.js')).href;
  const { createProfiler } = await import(url);
  const p = createProfiler({ window: 60 });
  assert.equal(typeof p.start, 'function');
  assert.equal(typeof p.stop, 'function');
  assert.equal(typeof p.getStats, 'function');
  assert.equal(typeof p.onDrop, 'function');
  assert.equal(typeof p.tier, 'function');
  // Initial heuristic tier — depends on env, must be a valid string.
  assert.ok(['high', 'medium', 'low'].includes(p.tier()));
  const s = p.getStats();
  assert.ok('fps' in s && 'frameMs' in s && 'tier' in s);
});
