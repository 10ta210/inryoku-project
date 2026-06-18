// tests/visual/halo_geometry.test.mjs
// Mathematical verification of tickPos() halo geometry.
// tick 0 = 12 o'clock (cos(-90°)=0, sin(-90°)=-1).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM } from '../setup.mjs';
import { assertBaseline } from './_helpers.mjs';

before(() => { setupDOM(); });

const EPS = 0.01;
const CENTER = 50;
const RADIUS = 26;
const INNER_RADIUS = 19;

function approx(a, b, eps = EPS, label = '') {
  assert.ok(Math.abs(a - b) <= eps, `${label}: |${a} - ${b}| > ${eps}`);
}

describe('visual/halo_geometry — tickPos() の数学的検証', () => {
  test('tickPos(0) は cos(-90°)≒0, sin(-90°)≒-1 → (50, 24)', () => {
    const p = ParticleRings.tickPos(0);
    approx(p.x, CENTER, EPS, 'x');
    approx(p.y, CENTER - RADIUS, EPS, 'y');
  });

  test('tickPos(3) は 3時方向 → (76, 50)', () => {
    const p = ParticleRings.tickPos(3);
    approx(p.x, CENTER + RADIUS, EPS, 'x');
    approx(p.y, CENTER, EPS, 'y');
  });

  test('tickPos(6) は 6時方向 → (50, 76)', () => {
    const p = ParticleRings.tickPos(6);
    approx(p.x, CENTER, EPS, 'x');
    approx(p.y, CENTER + RADIUS, EPS, 'y');
  });

  test('tickPos(9) は 9時方向 → (24, 50)', () => {
    const p = ParticleRings.tickPos(9);
    approx(p.x, CENTER - RADIUS, EPS, 'x');
    approx(p.y, CENTER, EPS, 'y');
  });

  test('全 12 tick の (x,y) — 浮動小数点比較 (誤差 ≤ 0.01)', () => {
    const expected = [];
    for (let t = 0; t < 12; t++) {
      const angle = (-90 + t * 30) * Math.PI / 180;
      expected.push({
        tick: t,
        x: CENTER + RADIUS * Math.cos(angle),
        y: CENTER + RADIUS * Math.sin(angle)
      });
    }
    for (const e of expected) {
      const p = ParticleRings.tickPos(e.tick);
      approx(p.x, e.x, EPS, `tick=${e.tick} x`);
      approx(p.y, e.y, EPS, `tick=${e.tick} y`);
    }
  });

  test('全 12 tick の中心からの距離は RADIUS=26 ± 0.01', () => {
    for (let t = 0; t < 12; t++) {
      const p = ParticleRings.tickPos(t);
      const d = Math.hypot(p.x - CENTER, p.y - CENTER);
      approx(d, RADIUS, EPS, `tick=${t} radius`);
    }
  });

  test('tickPos(t, customRadius) で半径スケール一貫性 — 内側半径 19', () => {
    for (let t = 0; t < 12; t++) {
      const p = ParticleRings.tickPos(t, INNER_RADIUS);
      const d = Math.hypot(p.x - CENTER, p.y - CENTER);
      approx(d, INNER_RADIUS, EPS, `inner tick=${t}`);
    }
  });

  test('haloScale 一貫性 — 半径スケールが線形', () => {
    const scales = [0.5, 1.0, 1.5, 2.0, 3.14];
    for (const s of scales) {
      for (let t = 0; t < 12; t++) {
        const p = ParticleRings.tickPos(t, RADIUS * s);
        const d = Math.hypot(p.x - CENTER, p.y - CENTER);
        approx(d, RADIUS * s, EPS, `scale=${s} tick=${t}`);
      }
    }
  });

  test('対極 tick (0/6, 3/9) は中心対称', () => {
    const pairs = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
    for (const [a, b] of pairs) {
      const pa = ParticleRings.tickPos(a);
      const pb = ParticleRings.tickPos(b);
      approx((pa.x + pb.x) / 2, CENTER, EPS, `pair ${a}/${b} mid x`);
      approx((pa.y + pb.y) / 2, CENTER, EPS, `pair ${a}/${b} mid y`);
    }
  });

  test('baseline: 全 12 tick × 内/外/拡大 の座標スナップショット', () => {
    const snap = {};
    for (const r of [INNER_RADIUS, RADIUS, 60]) {
      const arr = [];
      for (let t = 0; t < 12; t++) {
        const p = ParticleRings.tickPos(t, r);
        arr.push({ tick: t, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
      }
      snap[`r${r}`] = arr;
    }
    assertBaseline('halo_geometry_tick_positions', snap);
  });
});
