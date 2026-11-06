// 視線の引力 (inryoku/inryoku-gravity.js) — 純粋な数学のテスト
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAVITY_DEFAULTS as P,
  springAt,
  GravityEnvelope,
  envelopeIntegrals,
  createField,
  selectAttracted,
  rotateAboutAxis,
  pullInto,
  applyGravity,
  bakeRotation,
} from '../inryoku/inryoku-gravity.js';

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// 決定論的な殻 (inryoku-world.js と同じ分布: 半径 25..100)
function makeShell(count) {
  let s = 50;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const home = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * rand();
    const phi = Math.acos(2 * rand() - 1);
    const r = 100 * (0.25 + 0.75 * Math.cbrt(rand()));
    home[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    home[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    home[i * 3 + 2] = r * Math.cos(phi);
  }
  return home;
}

describe('springAt — 臨界減衰ばね', () => {
  test('静止から押すと、はみ出さずに単調に 1 へ近づく', () => {
    let prev = 0;
    for (let t = 0; t <= 8; t += 0.05) {
      const { x } = springAt(0, 0, 1, P.omegaIn, t);
      assert.ok(x >= prev - 1e-12 && x <= 1 + 1e-12, `t=${t} x=${x}`);
      prev = x;
    }
    assert.ok(prev > 0.99);
  });

  test('始まりはゆっくり (初速 0 = ease-in)', () => {
    const early = springAt(0, 0, 1, P.omegaIn, 0.1).x;
    const later = springAt(0, 0, 1, P.omegaIn, 1.1).x - springAt(0, 0, 1, P.omegaIn, 1.0).x;
    assert.ok(early < later, `最初の 0.1s (${early}) は中盤の 0.1s (${later}) より動きが小さい`);
  });

  test('返す速度は位置の微分と一致する', () => {
    const h = 1e-5;
    for (const t of [0.2, 1, 2.5]) {
      const a = springAt(0.3, 0.8, 0, P.omegaOut, t);
      const b = springAt(0.3, 0.8, 0, P.omegaOut, t + h);
      close(a.v, (b.x - a.x) / h, 1e-3, `t=${t}`);
    }
  });
});

describe('GravityEnvelope — 押す/離すの連続性', () => {
  test('途中で離しても値と速度は途切れない', () => {
    const env = new GravityEnvelope(P, { keepHistory: true });
    env.set(1, 1.0);
    const before = env.at(2.2);
    env.set(0, 2.2);
    const after = env.at(2.2);
    close(after.x, before.x, 1e-12, 'x');
    close(after.v, before.v, 1e-12, 'v');
  });

  test('押す→離す→押し直す、を通して 0..1 に収まり、最後は 0 へ戻る', () => {
    const env = new GravityEnvelope(P, { keepHistory: true });
    env.set(1, 0.5);
    env.set(0, 1.4);
    env.set(1, 2.0);
    env.set(0, 5.0);
    for (let t = 0; t <= 20; t += 0.02) {
      const { x } = env.at(t);
      assert.ok(x >= -1e-9 && x <= 1 + 1e-9, `t=${t.toFixed(2)} x=${x}`);
    }
    assert.ok(env.at(20).x < P.settle);
    assert.equal(env.at(0.2).x, 0, '最初に押す前は 0');
  });

  test('サイト用 (履歴なし) はフレーム時刻がイベントより前でも 0 に戻らない', () => {
    const env = new GravityEnvelope(P);
    env.set(1, 10);
    const held = env.at(13).x;
    env.set(0, 13);
    close(env.at(12.99).x, held, 1e-12, 'イベント直前のフレーム');
  });

  test('envelopeIntegrals: 一度集め切ると巻き込み量 M ≈ 1、I は増え続ける', () => {
    const env = new GravityEnvelope(P, { keepHistory: true });
    env.set(1, 0);
    const a = envelopeIntegrals(env, 6);
    const b = envelopeIntegrals(env, 8);
    close(a.M, env.at(6).x, 1e-9, 'M は増加分の総和');
    assert.ok(b.I > a.I);
    close(b.I - a.I, 2 * env.at(7).x, 0.02, '集め切った後の I はほぼ時間に比例');
  });
});

describe('回転と引き寄せ', () => {
  const field = createField(0.3, -0.2, -1);

  test('軸まわりの回転は原点からの距離を変えない (殻の厚みを保つ)', () => {
    const out = new Float64Array(3);
    for (const th of [0.3, 1.7, -2.2, 5]) {
      rotateAboutAxis(40, -12, -55, field.ax, field.ay, field.az, th, out);
      close(Math.hypot(...out), Math.hypot(40, -12, -55), 1e-9, `θ=${th}`);
    }
    rotateAboutAxis(40, -12, -55, field.ax, field.ay, field.az, 0, out);
    assert.deepEqual([...out].map((v) => +v.toFixed(9)), [40, -12, -55]);
  });

  test('k=0 なら動かさない / k=1 なら軸から r0、F から奥行き a0 の位置', () => {
    const out = new Float64Array(3);
    pullInto(out, 0, 10, 5, -50, field, 0, 6, 0.5);
    close(out[0], 10, 1e-9, 'x');
    close(out[1], 5, 1e-9, 'y');
    close(out[2], -50, 1e-9, 'z');

    pullInto(out, 0, 10, 5, -50, field, 1, 6, 0.5);
    const rx = out[0] - field.fx;
    const ry = out[1] - field.fy;
    const rz = out[2] - field.fz;
    const a = rx * field.ax + ry * field.ay + rz * field.az;
    close(a, 0.5, 1e-9, '奥行き');
    close(Math.hypot(rx - a * field.ax, ry - a * field.ay, rz - a * field.az), 6, 1e-9, '半径');
  });
});

describe('selectAttracted — 視線の円錐', () => {
  const count = 20000;
  const home = makeShell(count);
  const field = createField(0, 0, -1);
  const sel = selectAttracted(home, count, field);

  test('円錐の外の粒子は選ばれず、内側の芯は重み 1', () => {
    const cosOut = Math.cos((P.coneOuter * Math.PI) / 180);
    const cosIn = Math.cos((P.coneInner * Math.PI) / 180);
    assert.ok(sel.n > 0);
    for (let j = 0; j < sel.n; j++) {
      const i = sel.idx[j];
      const c = -home[i * 3 + 2] / Math.hypot(home[i * 3], home[i * 3 + 1], home[i * 3 + 2]);
      assert.ok(c > cosOut);
      if (c >= cosIn) close(sel.w[j], 1, 1e-6, '芯の重み');
      assert.ok(sel.r0[j] >= P.ringInner - 1e-6 && sel.r0[j] <= P.ringOuter + 1e-6);
    }
    // 立体角の比 (1 - cos40°)/2 ≈ 11.7% 前後
    const frac = sel.n / count;
    assert.ok(frac > 0.09 && frac < 0.15, `選ばれた割合 ${frac}`);
  });

  test('同じ入力なら毎回同じ (サイトと動画で一致)', () => {
    const again = selectAttracted(home, count, field);
    assert.deepEqual(again.idx, sel.idx);
    assert.deepEqual(again.r0, sel.r0);
    assert.deepEqual(again.spin, sel.spin);
  });
});

describe('applyGravity → bakeRotation — ほどけ切った瞬間に粒子が飛ばない', () => {
  test('焼き込み前後で位置が一致する', () => {
    const count = 4000;
    const home = makeShell(count);
    const field = createField(0.1, 0.05, -1);
    const sel = selectAttracted(home, count, field);
    const env = new GravityEnvelope(P, { keepHistory: true });
    env.set(1, 0);
    env.set(0, 4);
    const tEnd = 40;
    const { I, M } = envelopeIntegrals(env, tEnd);
    const g = { sel, field, E: env.at(tEnd).x, I, M, I0: 0, M0: 0 };
    assert.ok(g.E < P.settle);

    const identity = (x, y, z, _t, out) => { out[0] = x; out[1] = y; out[2] = z; };
    const pos = new Float32Array(count * 3);
    const pulls = new Float32Array(count);
    applyGravity(g, home, pos, pulls, tEnd, identity);
    const shown = Array.from(sel.idx, (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);

    bakeRotation(g, home, pulls);
    let maxJump = 0;
    let maxRadiusDrift = 0;
    const original = makeShell(count);
    sel.idx.forEach((i, j) => {
      const [x, y, z] = shown[j];
      maxJump = Math.max(maxJump, Math.hypot(home[i * 3] - x, home[i * 3 + 1] - y, home[i * 3 + 2] - z));
      maxRadiusDrift = Math.max(maxRadiusDrift, Math.abs(
        Math.hypot(home[i * 3], home[i * 3 + 1], home[i * 3 + 2]) -
        Math.hypot(original[i * 3], original[i * 3 + 1], original[i * 3 + 2])));
      assert.equal(pulls[i], 0);
    });
    assert.ok(maxJump < 0.25, `最大のずれ ${maxJump} (world units)`);
    assert.ok(maxRadiusDrift < 1e-3, `殻の半径は保たれる (${maxRadiusDrift})`);
  });
});
