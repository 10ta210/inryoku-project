// 全ては 1 (inryoku/inryoku-one.js) — 自己相似ループの数学のテスト
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONE_DEFAULTS as P,
  zoomRatio,
  zoomProgress,
  viewAt,
  levelTransform,
  buildLevel,
} from '../inryoku/inryoku-one.js';

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// レベル k の点 p が、時刻 t に画面のどこに映るか (画面の高さ = 1 の座標)
function screenOf(p, k, t) {
  const v = viewAt(t);
  const tr = levelTransform(k);
  return [
    (tr.ox + p[0] * tr.scale - v.cx) / v.height,
    (tr.oy + p[1] * tr.scale - v.cy) / v.height,
  ];
}

describe('ループの継ぎ目', () => {
  const T = P.period;
  const end = T - 1e-9;

  test('1 周の終わりの絵 = 始まりの絵 (レベル k の終わり = レベル k+1 の始まり)', () => {
    const samples = [[0, 0], [P.dot[0], P.dot[1]], [2.1, -1.3], [-2.8, 0.4], [0.3, -0.95]];
    for (const p of samples) {
      for (const k of [0, 1]) {
        const a = screenOf(p, k, end);
        const b = screenOf(p, k + 1, 0);
        close(a[0], b[0], 1e-7, `x p=${p} k=${k}`);
        close(a[1], b[1], 1e-7, `y p=${p} k=${k}`);
      }
    }
  });

  test('ズームの速さも両端で一致する (継ぎ目で速度が跳ばない)', () => {
    const h = 1e-6;
    const rate = (ph) => (zoomProgress(ph + h, P.zoomEase) - zoomProgress(ph - h, P.zoomEase)) / (2 * h);
    close(rate(h), rate(1 - h), 1e-4, '両端の速さ');
    assert.ok(rate(h) < rate(0.5), '両端 (i の点が見える時) はゆっくり、途中は速い');
  });

  test('1 周で S 倍引き、構造全体 (半径 R) が i の点 (半径 r) の大きさになる', () => {
    close(viewAt(end).height / viewAt(0).height, zoomRatio(), 1e-6, '倍率');
    const tr = levelTransform(1);
    close(tr.ox + P.center[0] * tr.scale, P.dot[0], 1e-12, '中心 C → 点 D (x)');
    close(tr.oy + P.center[1] * tr.scale, P.dot[1], 1e-12, '中心 C → 点 D (y)');
    close(P.radius * tr.scale, P.dotRadius, 1e-12, '半径 R → 点の半径 r');
  });
});

describe('buildLevel — i の線から 1 が増えていく', () => {
  const L = buildLevel();

  test('毎回同じ形になる (サイトと動画で一致)', () => {
    const again = buildLevel();
    assert.equal(again.count, L.count);
    assert.deepEqual(again.pos, L.pos);
    assert.deepEqual(again.birth, L.birth);
  });

  test('全ての粒子は 1 周の終わりより前に灯る (終わりの絵が完成している)', () => {
    let last = 0;
    for (const b of L.birth) last = Math.max(last, b);
    assert.ok(last < P.period - 1, `最後に灯る粒子 ${last}s`);
  });

  test('構造全体は半径 R の円の中に収まる (遠くから見て i の点になる)', () => {
    for (let i = 0; i < L.count; i++) {
      const r = Math.hypot(L.pos[i * 3] - P.center[0], L.pos[i * 3 + 1] - P.center[1]);
      assert.ok(r <= P.radius + 1e-6, `粒子 ${i} が円の外 (${r})`);
    }
  });

  test('最初に灯るのは i の線、そのあと増えた線の多くが「1」の形になる', () => {
    let first = 0;
    for (let i = 1; i < L.count; i++) if (L.birth[i] < L.birth[first]) first = i;
    close(L.pos[first * 3], 0, 1e-6, '最初の粒子は i の線の上端 (x)');
    close(L.pos[first * 3 + 1], P.stemTop, 1e-6, '最初の粒子は i の線の上端 (y)');
    assert.ok(L.glyphs > 500, `線の数 ${L.glyphs}`);
    assert.ok(L.flags / L.glyphs > 0.6, `「1」の旗がある割合 ${L.flags / L.glyphs}`);
  });

  test('既定の色は白 (司さん指示 2026-11-23)', () => {
    for (let i = 0; i < L.count; i++) {
      const [r, g, b] = [L.color[i * 3], L.color[i * 3 + 1], L.color[i * 3 + 2]];
      assert.ok(r > 0 && r === g && g === b, `粒子 ${i} が白でない ${[r, g, b]}`);
    }
  });

  test('色相環版 (color: wheel) は RGBCMY のみ', () => {
    const W = buildLevel({ ...P, color: 'wheel' });
    for (let i = 0; i < W.count; i++) {
      const c = [W.color[i * 3], W.color[i * 3 + 1], W.color[i * 3 + 2]];
      const spread = Math.max(...c) - Math.min(...c);
      assert.ok(spread > 0.4 * Math.max(...c), `粒子 ${i} が無彩色に近い ${c}`);
    }
  });
});

describe('1 が星に見える', () => {
  const L = buildLevel();

  test('星は 1 本の 1 につき 1 つ、その 1 を描き終えてから灯る', () => {
    let stars = 0;
    let lastStroke = -1;
    for (let i = 0; i < L.count; i++) {
      if (L.star[i] === 1) {
        stars++;
        assert.ok(lastStroke >= 0, '星の前にその 1 の線がある');
        assert.ok(L.birth[i] >= L.birth[lastStroke] - 1e-6, `星 ${i} が線より先に灯っている`);
        assert.equal(L.glen[i], L.glen[lastStroke], '星と線は同じ 1 に属する');
      } else {
        lastStroke = i;
      }
    }
    assert.equal(stars, L.glyphs);
  });

  test('瞬きは 1 周に整数回 (ループの継ぎ目でずれない)、同じ 1 の中では揃う', () => {
    for (let i = 0; i < L.count; i++) {
      assert.ok(Number.isInteger(L.twf[i]) && L.twf[i] >= 3 && L.twf[i] <= 8, `瞬きの回数 ${L.twf[i]}`);
      if (i > 0 && L.star[i - 1] === 0 && L.glen[i] === L.glen[i - 1]) {
        assert.equal(L.twf[i], L.twf[i - 1]);
        assert.equal(L.phase[i], L.phase[i - 1]);
      }
    }
  });
});
