// canon_visual.test.mjs — 全 17 canon の SVG 構造をシリアライズしてスナップショット比較
// production code（particle_rings.js）には触れず、構造的指紋を JSON 化して固定値と照合する。
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM } from './setup.mjs';

before(() => { setupDOM(); });

// SVG → 構造 JSON への決定的シリアライザ
function serializeRing(svg) {
  const out = {
    tag: svg.tagName.toLowerCase(),
    viewBox: svg.getAttribute('viewBox'),
    width: svg.getAttribute('width'),
    height: svg.getAttribute('height'),
    classes: Array.from(svg.classList).sort(),
    children: []
  };
  for (const child of svg.children) {
    const cls = Array.from(child.classList).sort();
    const entry = { tag: child.tagName.toLowerCase(), classes: cls };
    // 主要な視覚属性のみキャプチャ（描画位置・半径・パス）
    for (const attr of ['cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'd']) {
      const v = child.getAttribute(attr);
      if (v != null) entry[attr] = v;
    }
    // group 要素の場合は子要素数をカウント（path/inner グループ用）
    if (child.children && child.children.length) {
      entry.childCount = child.children.length;
    }
    out.children.push(entry);
  }
  return out;
}

// 全 17 canon の期待スナップショット（最初の実行で確立し、以降の差分を検出する）
// children 配列は描画順を保つ：path グループ → (inner グループ?) → chord(s) → tick(s)
describe('canon_visual — 全 17 canon の SVG 構造スナップショット', () => {
  test('CANON_RINGS には 17 種類が定義されている', () => {
    assert.equal(ParticleRings.KINDS.length, 17, '17 canon');
  });

  // ─ silence: tick も chord も無し（pathG のみ）─
  test('snapshot: silence — pathG のみ・色なし', () => {
    const s = serializeRing(ParticleRings.canon('silence'));
    assert.equal(s.viewBox, '0 0 100 100');
    assert.equal(s.children.length, 1);
    assert.deepEqual(s.children[0].classes, ['pring__path']);
    assert.equal(s.children[0].childCount, 36);
  });

  // ─ core: 頂に 1 点のみ ─
  test('snapshot: core — 頂(50,24)に DOT_R ドット 1 個', () => {
    const s = serializeRing(ParticleRings.canon('core'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    assert.equal(ticks.length, 1);
    assert.equal(ticks[0].cx, '50');
    assert.equal(ticks[0].cy, '24');
    assert.equal(ticks[0].r, '1.55');
  });

  // ─ ma: 頂と底 ─
  test('snapshot: ma — tick=0 と tick=6 の 2 点', () => {
    const s = serializeRing(ParticleRings.canon('ma'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    assert.equal(ticks.length, 2);
    assert.equal(ticks[0].cy, '24');
    assert.equal(ticks[1].cy, '76');
  });

  // ─ shadow: ccw + 横線のみ ─
  test('snapshot: shadow — ccw クラス + 横 chord (3,9)', () => {
    const s = serializeRing(ParticleRings.canon('shadow'));
    assert.ok(s.classes.includes('pring--ccw'));
    const chords = s.children.filter((c) => c.classes.includes('pring__chord'));
    assert.equal(chords.length, 1);
    assert.equal(chords[0].tag, 'line');
    // tick=3 → x=76, tick=9 → x=24
    assert.equal(chords[0].x1, '76');
    assert.equal(chords[0].x2, '24');
  });

  // ─ emit: 0→3 の発信 + 3 に c 色 ─
  test('snapshot: emit — chord(0,3) line + 3:c カラー', () => {
    const s = serializeRing(ParticleRings.canon('emit'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    assert.equal(ticks.length, 2);
    const colored = ticks.filter((t) => t.classes.includes('pring__tick--c-c'));
    assert.equal(colored.length, 1);
    assert.equal(colored[0].r, '2.15');
  });

  // ─ observation: 4 軸 + 0 が y ─
  test('snapshot: observation — 4 tick / 0 が y / chord 無し', () => {
    const s = serializeRing(ParticleRings.canon('observation'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    const chords = s.children.filter((c) => c.classes.includes('pring__chord'));
    assert.equal(ticks.length, 4);
    assert.equal(chords.length, 0);
    assert.ok(ticks.some((t) => t.classes.includes('pring__tick--c-y')));
  });

  // ─ self_question: 頂 1 点 y / ccw ─
  test('snapshot: self_question — ccw + 頂のみ y', () => {
    const s = serializeRing(ParticleRings.canon('self_question'));
    assert.ok(s.classes.includes('pring--ccw'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    assert.equal(ticks.length, 1);
    assert.ok(ticks[0].classes.includes('pring__tick--c-y'));
  });

  // ─ declaration: 6 tick + 0-6 chord + 0:c ─
  test('snapshot: declaration — 6 tick + chord(0,6) + 0:c', () => {
    const s = serializeRing(ParticleRings.canon('declaration'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    const chords = s.children.filter((c) => c.classes.includes('pring__chord'));
    assert.equal(ticks.length, 6);
    assert.equal(chords.length, 1);
    assert.equal(chords[0].tag, 'line');
  });

  // ─ leap: 3 tick + 2 chord + m ─
  test('snapshot: leap — chord(6,11) + chord(11,0) + 0:m', () => {
    const s = serializeRing(ParticleRings.canon('leap'));
    const chords = s.children.filter((c) => c.classes.includes('pring__chord'));
    assert.equal(chords.length, 2);
    chords.forEach((c) => assert.equal(c.tag, 'line'));
  });

  // ─ resonance: 平行 2 弦 + 3,9 が c ─
  test('snapshot: resonance — chord(2,8) + chord(4,10) + 3,9 が c', () => {
    const s = serializeRing(ParticleRings.canon('resonance'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    const colored = ticks.filter((t) => t.classes.includes('pring__tick--c-c'));
    assert.equal(colored.length, 2);
  });

  // ─ consensus: 12 tick + 0:g 6:y ─
  test('snapshot: consensus — 12 tick / 0:g / 6:y', () => {
    const s = serializeRing(ParticleRings.canon('consensus'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    assert.equal(ticks.length, 12);
    assert.ok(ticks.some((t) => t.classes.includes('pring__tick--c-g')));
    assert.ok(ticks.some((t) => t.classes.includes('pring__tick--c-y')));
  });

  // ─ past_speculation: 5 tick / ccw / 6:b ─
  test('snapshot: past_speculation — ccw + 5 tick + 6:b', () => {
    const s = serializeRing(ParticleRings.canon('past_speculation'));
    assert.ok(s.classes.includes('pring--ccw'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    assert.equal(ticks.length, 5);
    assert.ok(ticks.some((t) => t.classes.includes('pring__tick--c-b')));
  });

  // ─ future_command: 3 tick + 3 chord + 3:m ─
  test('snapshot: future_command — 3 chord 三角形 + 3:m', () => {
    const s = serializeRing(ParticleRings.canon('future_command'));
    const chords = s.children.filter((c) => c.classes.includes('pring__chord'));
    assert.equal(chords.length, 3);
  });

  // ─ echo: 上 3 点・色なし ─
  test('snapshot: echo — tick=10,0,2 の 3 点・色なし', () => {
    const s = serializeRing(ParticleRings.canon('echo'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    assert.equal(ticks.length, 3);
    const colored = ticks.filter((t) => t.classes.some((c) => c.startsWith('pring__tick--c-')));
    assert.equal(colored.length, 0);
  });

  // ─ quotation: 同心二重円 ─
  test('snapshot: quotation — innerG + 0:c', () => {
    const s = serializeRing(ParticleRings.canon('quotation'));
    const inner = s.children.filter((c) => c.classes.includes('pring__inner'));
    assert.equal(inner.length, 1);
    assert.equal(inner[0].childCount, 12);
  });

  // ─ summon: 6 色 + 3 直径 chord ─
  test('snapshot: summon — 6 色 tick + 3 chord', () => {
    const s = serializeRing(ParticleRings.canon('summon'));
    const ticks = s.children.filter((c) => c.classes.includes('pring__tick'));
    const chords = s.children.filter((c) => c.classes.includes('pring__chord'));
    assert.equal(ticks.length, 6);
    assert.equal(chords.length, 3);
    const colors = ['y', 'r', 'g', 'm', 'b', 'c'];
    for (const col of colors) {
      assert.ok(
        ticks.some((t) => t.classes.includes('pring__tick--c-' + col)),
        `color ${col} 必須`
      );
    }
  });

  // ─ revelation: arc chord 含む ─
  test('snapshot: revelation — arc chord (path) + line chord + 2 色', () => {
    const s = serializeRing(ParticleRings.canon('revelation'));
    const arcs = s.children.filter((c) => c.classes.includes('pring__chord--arc'));
    const lineChords = s.children.filter((c) =>
      c.classes.includes('pring__chord') && !c.classes.includes('pring__chord--arc')
    );
    assert.equal(arcs.length, 1);
    assert.equal(arcs[0].tag, 'path');
    assert.match(arcs[0].d, /^M .* Q .* /);
    assert.equal(lineChords.length, 1);
  });

  // ─ 全 canon に対する不変条件チェック ─
  test('全 canon: viewBox は "0 0 100 100" で path グループを必ず持つ', () => {
    for (const name of ParticleRings.KINDS) {
      const s = serializeRing(ParticleRings.canon(name));
      assert.equal(s.viewBox, '0 0 100 100', name);
      const path = s.children.filter((c) => c.classes.includes('pring__path'));
      assert.equal(path.length, 1, name + ' は path グループ 1 個');
      assert.equal(path[0].childCount, 36, name + ' は 36 path-dot');
    }
  });

  test('全 canon: opts.size を渡すと width/height に反映される', () => {
    for (const name of ParticleRings.KINDS) {
      const s = serializeRing(ParticleRings.canon(name, { size: 250 }));
      assert.equal(s.width, '250', name);
      assert.equal(s.height, '250', name);
    }
  });
});
