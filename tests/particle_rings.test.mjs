import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM } from './setup.mjs';

before(() => { setupDOM(); });

const SVG_NS = 'http://www.w3.org/2000/svg';

function q(svg, sel) { return svg.querySelectorAll(sel); }
function one(svg, sel) { return svg.querySelector(sel); }

describe('ParticleRings.tickPos — 12 tick 時計盤の座標', () => {
  test('tick=0 は 12 時方向（上、x=50, y≈24）', () => {
    const p = ParticleRings.tickPos(0);
    assert.ok(Math.abs(p.x - 50) < 1e-9, 'x ≈ 50');
    assert.ok(Math.abs(p.y - 24) < 1e-9, 'y ≈ 24 (50 - 26)');
  });

  test('tick=3 は 3 時方向（右、x≈76, y=50）', () => {
    const p = ParticleRings.tickPos(3);
    assert.ok(Math.abs(p.x - 76) < 1e-9);
    assert.ok(Math.abs(p.y - 50) < 1e-9);
  });

  test('tick=6 は 6 時方向（下、x=50, y≈76）', () => {
    const p = ParticleRings.tickPos(6);
    assert.ok(Math.abs(p.x - 50) < 1e-9);
    assert.ok(Math.abs(p.y - 76) < 1e-9);
  });

  test('tick=9 は 9 時方向（左、x≈24, y=50）', () => {
    const p = ParticleRings.tickPos(9);
    assert.ok(Math.abs(p.x - 24) < 1e-9);
    assert.ok(Math.abs(p.y - 50) < 1e-9);
  });

  test('明示的 radius を渡すと中心からの距離が変わる', () => {
    const p = ParticleRings.tickPos(0, 19);
    assert.equal(p.x, 50);
    assert.equal(p.y, 50 - 19);
  });

  test('tick 0..11 すべての座標が center=(50,50), radius=26 の円周上にある', () => {
    const CENTER = 50, RADIUS = 26;
    for (let t = 0; t < 12; t++) {
      const p = ParticleRings.tickPos(t);
      const dx = p.x - CENTER;
      const dy = p.y - CENTER;
      const d = Math.sqrt(dx * dx + dy * dy);
      assert.ok(Math.abs(d - RADIUS) < 1e-9, `tick=${t} 半径 ≈ 26（実測 ${d}）`);
    }
  });

  test('tick 0..11 全数式: angle = (-90 + tick*30) deg を再計算して厳密一致', () => {
    const CENTER = 50, RADIUS = 26;
    for (let t = 0; t < 12; t++) {
      const p = ParticleRings.tickPos(t);
      const ang = (-90 + t * 30) * Math.PI / 180;
      const ex = CENTER + RADIUS * Math.cos(ang);
      const ey = CENTER + RADIUS * Math.sin(ang);
      assert.ok(Math.abs(p.x - ex) < 1e-9, `tick=${t} x`);
      assert.ok(Math.abs(p.y - ey) < 1e-9, `tick=${t} y`);
    }
  });

  test('対角 tick (t と t+6) は中心対称', () => {
    for (let t = 0; t < 6; t++) {
      const a = ParticleRings.tickPos(t);
      const b = ParticleRings.tickPos(t + 6);
      assert.ok(Math.abs((a.x + b.x) / 2 - 50) < 1e-9, `t=${t} x 中心`);
      assert.ok(Math.abs((a.y + b.y) / 2 - 50) < 1e-9, `t=${t} y 中心`);
    }
  });
});

describe('ParticleRings.render — spec → SVG 構築', () => {
  test('空 spec でも円周パスが生成される（pring__path グループ）', () => {
    const svg = ParticleRings.render({});
    assert.equal(svg.namespaceURI, SVG_NS);
    assert.ok(svg.classList.contains('pring'));
    assert.equal(q(svg, '.pring__path').length, 1, 'path グループは 1 個');
    // 12 tick × (1 main + 2 minor) = 36 dots
    assert.equal(q(svg, '.pring__path-dot').length, 36);
    assert.equal(q(svg, '.pring__tick').length, 0, 'tick は無し');
    assert.equal(q(svg, '.pring__chord').length, 0, 'chord は無し');
  });

  test('viewBox は "0 0 100 100" に設定される', () => {
    const svg = ParticleRings.render({});
    assert.equal(svg.getAttribute('viewBox'), '0 0 100 100');
  });

  test('size オプションで width/height が設定される', () => {
    const svg = ParticleRings.render({}, { size: 200 });
    assert.equal(svg.getAttribute('width'), '200');
    assert.equal(svg.getAttribute('height'), '200');
  });

  test('ticks 配列で circle 要素が生成され、座標が tickPos と一致する', () => {
    const svg = ParticleRings.render({ ticks: [0, 3] });
    const ticks = q(svg, '.pring__tick');
    assert.equal(ticks.length, 2);
    const p0 = ParticleRings.tickPos(0);
    assert.equal(Number(ticks[0].getAttribute('cx')), p0.x);
    assert.equal(Number(ticks[0].getAttribute('cy')), p0.y);
    const p3 = ParticleRings.tickPos(3);
    assert.equal(Number(ticks[1].getAttribute('cx')), p3.x);
    assert.equal(Number(ticks[1].getAttribute('cy')), p3.y);
  });

  test('chords は line 要素で描かれる（arc 指定なし）', () => {
    const svg = ParticleRings.render({ chords: [[0, 6]] });
    const lines = q(svg, 'line.pring__chord');
    assert.equal(lines.length, 1);
    assert.equal(q(svg, 'path.pring__chord').length, 0);
  });

  test('chords の arc 指定で path 要素 + pring__chord--arc が付く', () => {
    const svg = ParticleRings.render({ chords: [[0, 6, 'arc']] });
    const paths = q(svg, 'path.pring__chord');
    assert.equal(paths.length, 1);
    assert.ok(paths[0].classList.contains('pring__chord--arc'));
    assert.match(paths[0].getAttribute('d'), /^M .* Q .* /);
  });

  test('colors マップで該当 tick に pring__tick--c-<color> クラス', () => {
    const svg = ParticleRings.render({ ticks: [0, 3], colors: { 0: 'y', 3: 'm' } });
    const ticks = q(svg, '.pring__tick');
    assert.ok(ticks[0].classList.contains('pring__tick--c-y'));
    assert.ok(ticks[1].classList.contains('pring__tick--c-m'));
  });

  test('色付き tick は半径が COLOR_DOT_R(2.15) になる', () => {
    const svg = ParticleRings.render({ ticks: [0], colors: { 0: 'y' } });
    const dot = one(svg, '.pring__tick');
    assert.equal(Number(dot.getAttribute('r')), 2.15);
  });

  test('色なし tick は半径が DOT_R(1.55)', () => {
    const svg = ParticleRings.render({ ticks: [0] });
    const dot = one(svg, '.pring__tick');
    assert.equal(Number(dot.getAttribute('r')), 1.55);
  });

  test('direction:ccw で svg に pring--ccw クラスが付く', () => {
    const svg = ParticleRings.render({ direction: 'ccw' });
    assert.ok(svg.classList.contains('pring--ccw'));
  });

  test('direction:cw の場合は pring--ccw が付かない', () => {
    const svg = ParticleRings.render({ direction: 'cw' });
    assert.ok(!svg.classList.contains('pring--ccw'));
  });

  test('doubleRing:true で同心 inner グループが追加される', () => {
    const svg = ParticleRings.render({ doubleRing: true });
    assert.equal(q(svg, '.pring__inner').length, 1);
    assert.equal(q(svg, '.pring__inner-dot').length, 12);
  });

  test('doubleRing:false（既定）で inner グループは無い', () => {
    const svg = ParticleRings.render({});
    assert.equal(q(svg, '.pring__inner').length, 0);
  });

  test('chord は ticks より先に描かれる（DOM 順で先）', () => {
    const svg = ParticleRings.render({ ticks: [0], chords: [[0, 6]] });
    const children = Array.from(svg.children);
    const chordIdx = children.findIndex((c) => c.classList.contains('pring__chord'));
    const tickIdx = children.findIndex((c) => c.classList.contains('pring__tick'));
    assert.ok(chordIdx < tickIdx, 'chord が tick より前にあるべき');
  });

  test('複数 chord に --i インデックス変数が振られる', () => {
    const svg = ParticleRings.render({ chords: [[0, 6], [3, 9]] });
    const lines = q(svg, '.pring__chord');
    assert.equal(lines[0].style.getPropertyValue('--i'), '0');
    assert.equal(lines[1].style.getPropertyValue('--i'), '1');
  });
});

describe('ParticleRings.canon — 命名済み発話パターン', () => {
  test('KINDS は CANON のキー一覧と一致', () => {
    assert.deepEqual(ParticleRings.KINDS.sort(), Object.keys(ParticleRings.CANON).sort());
  });

  test('canon("silence") は ticks も chord も無い純粋パス', () => {
    const svg = ParticleRings.canon('silence');
    assert.equal(q(svg, '.pring__tick').length, 0);
    assert.equal(q(svg, '.pring__chord').length, 0);
  });

  test('canon("observation") は 4 軸 tick + 0 に y 色', () => {
    const svg = ParticleRings.canon('observation');
    assert.equal(q(svg, '.pring__tick').length, 4);
    assert.equal(q(svg, '.pring__tick--c-y').length, 1);
  });

  test('canon("leap") は 3 tick + 2 chord + 0 に m 色', () => {
    const svg = ParticleRings.canon('leap');
    assert.equal(q(svg, '.pring__tick').length, 3);
    assert.equal(q(svg, '.pring__chord').length, 2);
    assert.equal(q(svg, '.pring__tick--c-m').length, 1);
  });

  test('canon("summon") は 6 色 tick + 3 直径 chord', () => {
    const svg = ParticleRings.canon('summon');
    assert.equal(q(svg, '.pring__tick').length, 6);
    assert.equal(q(svg, '.pring__chord').length, 3);
    ['y', 'r', 'g', 'm', 'b', 'c'].forEach((c) => {
      assert.equal(q(svg, `.pring__tick--c-${c}`).length, 1, `color ${c}`);
    });
  });

  test('canon("revelation") は arc chord を含む', () => {
    const svg = ParticleRings.canon('revelation');
    assert.equal(q(svg, 'path.pring__chord--arc').length, 1);
  });

  test('canon("quotation") は doubleRing true', () => {
    const svg = ParticleRings.canon('quotation');
    assert.equal(q(svg, '.pring__inner').length, 1);
  });

  test('未知の name で Error を throw', () => {
    assert.throws(() => ParticleRings.canon('unknown_xyz'), /unknown canon/);
  });

  test('canon に size オプションを渡せる', () => {
    const svg = ParticleRings.canon('core', { size: 50 });
    assert.equal(svg.getAttribute('width'), '50');
  });
});

describe('CANON_RINGS visual snapshot — 形状の固定値検証', () => {
  // 各 canon について、構造的な指紋をスナップショットとして固定
  const expectedFingerprints = {
    silence:         { tick: 0,  chord: 0, color: 0, ccw: false, dbl: false },
    core:            { tick: 1,  chord: 0, color: 0, ccw: false, dbl: false },
    ma:              { tick: 2,  chord: 0, color: 0, ccw: false, dbl: false },
    shadow:          { tick: 0,  chord: 1, color: 0, ccw: true,  dbl: false },
    emit:            { tick: 2,  chord: 1, color: 1, ccw: false, dbl: false },
    observation:     { tick: 4,  chord: 0, color: 1, ccw: false, dbl: false },
    self_question:   { tick: 1,  chord: 0, color: 1, ccw: true,  dbl: false },
    declaration:     { tick: 6,  chord: 1, color: 1, ccw: false, dbl: false },
    leap:            { tick: 3,  chord: 2, color: 1, ccw: false, dbl: false },
    resonance:       { tick: 2,  chord: 2, color: 2, ccw: false, dbl: false },
    consensus:       { tick: 12, chord: 0, color: 2, ccw: false, dbl: false },
    past_speculation:{ tick: 5,  chord: 0, color: 1, ccw: true,  dbl: false },
    future_command:  { tick: 3,  chord: 3, color: 1, ccw: false, dbl: false },
    echo:            { tick: 3,  chord: 0, color: 0, ccw: false, dbl: false },
    quotation:       { tick: 1,  chord: 0, color: 1, ccw: false, dbl: true  },
    summon:          { tick: 6,  chord: 3, color: 6, ccw: false, dbl: false },
    revelation:      { tick: 4,  chord: 2, color: 2, ccw: false, dbl: false }
  };

  for (const name of Object.keys(expectedFingerprints)) {
    test(`canon("${name}") の構造指紋が固定値と一致`, () => {
      const svg = ParticleRings.canon(name);
      const fp = {
        tick: q(svg, '.pring__tick').length,
        chord: q(svg, '.pring__chord').length,
        color: q(svg, '[class*="pring__tick--c-"]').length,
        ccw: svg.classList.contains('pring--ccw'),
        dbl: q(svg, '.pring__inner').length > 0
      };
      assert.deepEqual(fp, expectedFingerprints[name]);
    });
  }
});

describe('ParticleRings.crystallize — 結晶化トリガ', () => {
  test('pring--crystallizing クラスを付与する', () => {
    const svg = ParticleRings.render({});
    document.body.appendChild(svg);
    ParticleRings.crystallize(svg);
    assert.ok(svg.classList.contains('pring--crystallizing'));
  });

  test('既に結晶化中でも再呼出しできる（一度外して付け直す）', () => {
    const svg = ParticleRings.render({});
    document.body.appendChild(svg);
    svg.classList.add('pring--crystallizing');
    assert.doesNotThrow(() => ParticleRings.crystallize(svg));
    assert.ok(svg.classList.contains('pring--crystallizing'));
  });
});
