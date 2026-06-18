// integration.test.mjs — ParticleRings + ParticleSpeechRings の連携・lifecycle 全体
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM } from './setup.mjs';

before(() => { setupDOM({ withSpeech: true }); });

let _logoCounter = 0;
function makeLogo() {
  // 各テストで独立した DOM ツリーを作る（_controllers レジストリと干渉しない）
  const id = ++_logoCounter;
  const host = document.createElement('div');
  host.className = 'hologram-logo';
  host.dataset.testId = String(id);
  const logo = document.createElement('div');
  logo.className = 'logo-holo-wrap logo-' + id;
  host.appendChild(logo);
  document.body.appendChild(host);
  return { host, logo, id };
}

describe('integration — ParticleRings と ParticleSpeechRings の連携', () => {
  test('Speech 経由で発火された ring は ParticleRings.canon で生成された SVG である', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('whisper', { canon: 'core' });
    const ring = sp._currentRing;
    assert.ok(ring, '_currentRing が設定される');
    assert.equal(ring.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.ok(ring.classList.contains('pring'), 'ParticleRings の SVG');
    assert.ok(ring.classList.contains('pring-speech__ring'));
    assert.ok(ring.classList.contains('pring-speech__ring--whisper'));
    sp.destroy();
  });

  test('CANON_SIZES 全 17 canon が _utter("special") で正しく解決される', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    for (const canonName of ParticleRings.KINDS) {
      sp._cancelCurrentSpeech('reset');
      const ok = sp.speakCanon(canonName);
      assert.equal(ok, true, canonName + ' is uterable');
      assert.equal(sp._currentSpeech.canon, canonName);
      // ring に size が px で適用されている
      const sizeStyle = sp._currentRing.style.getPropertyValue('--pring-speech-size');
      assert.match(sizeStyle, /\d+px$/, canonName + ' has size');
    }
    sp.destroy();
  });

  test('REGISTER_OPACITY が register に応じて --pring-speech-target-opacity に反映される', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const expected = { whisper: '0.46', hover: '0.72', click: '0.84', special: '0.9' };
    for (const reg of ['whisper', 'hover', 'click']) {
      sp._cancelCurrentSpeech('reset');
      sp.cooldownUntil[reg] = 0;
      sp._utter(reg);
      const op = sp._currentRing.style.getPropertyValue('--pring-speech-target-opacity');
      assert.equal(op, expected[reg], reg);
    }
    sp._cancelCurrentSpeech('reset');
    sp._utter('special', { canon: 'summon' });
    assert.equal(
      sp._currentRing.style.getPropertyValue('--pring-speech-target-opacity'),
      expected.special
    );
    sp.destroy();
  });
});

describe('integration — lifecycle 全体（mount → utter → cancel → destroy）', () => {
  test('完全な発話サイクル: mount → 発火 → cancel → destroy で副作用が残らない', () => {
    const { logo, host } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    assert.equal(sp.container, null, '初期は未 mount');
    sp.start();
    assert.ok(sp.container, 'mount 済み');
    assert.ok(sp.container.parentElement, 'host にぶら下がる');
    sp._utter('whisper');
    assert.equal(sp.active, true);
    sp._cancelCurrentSpeech('test');
    assert.equal(sp.active, false);
    assert.equal(sp._currentRing, null);
    assert.ok(!document.body.classList.contains('inryoku-speaking'));
    sp.destroy();
    assert.equal(sp.container, null);
    // host 自体は残るが container は消える
    assert.ok(host.isConnected);
    assert.equal(host.querySelector('.pring-speech'), null);
  });

  test('destroy 後の bind イベントは無効化されている', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const target = document.createElement('div');
    document.body.appendChild(target);
    sp.bindHover(target);
    sp.bindClick(target);
    sp.destroy();
    // どちらも throw / active 変化しない
    assert.doesNotThrow(() => target.dispatchEvent(new window.Event('mouseenter')));
    assert.doesNotThrow(() => target.dispatchEvent(new window.Event('click')));
    assert.equal(sp.active, false);
  });

  test('destroy 後に _utter / start / stop を呼んでも throw しない（防御）', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp.destroy();
    assert.doesNotThrow(() => sp.stop());
    // _utter は container=null だが stopped=true なので false で抜ける
    assert.equal(sp._utter('whisper'), false);
  });

  test('多重 destroy は安全（idempotent）', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    assert.doesNotThrow(() => sp.destroy());
    assert.doesNotThrow(() => sp.destroy());
    assert.doesNotThrow(() => sp.destroy());
  });
});

describe('integration — 多重 attach 検出', () => {
  test('attachToLogo は同一 selector で同じ controller を返す（重複 attach 抑止）', () => {
    const { logo } = makeLogo();
    logo.classList.add('logo-multi-1');
    const c1 = ParticleSpeechRings.attachToLogo('.logo-multi-1', { hover: false, click: false });
    const c2 = ParticleSpeechRings.attachToLogo('.logo-multi-1', { hover: false, click: false });
    assert.strictEqual(c1, c2, '同じ controller 参照');
    if (c1.destroy) c1.destroy();
  });

  test('同一 logo 要素への直接 attach は __inryokuParticleSpeechRings で重複防止', () => {
    const { logo } = makeLogo();
    logo.classList.add('logo-multi-2');
    const c1 = ParticleSpeechRings.attachToLogo('.logo-multi-2', { hover: false, click: false });
    // attach 完了後、要素にマーカーが付く
    assert.ok(logo.__inryokuParticleSpeechRings, 'マーカー設定');
    assert.strictEqual(logo.__inryokuParticleSpeechRings, c1.instance);
    if (c1.destroy) c1.destroy();
  });

  test('controller.destroy で __inryokuParticleSpeechRings が解除される', () => {
    const { logo } = makeLogo();
    logo.classList.add('logo-multi-3');
    const c = ParticleSpeechRings.attachToLogo('.logo-multi-3', { hover: false, click: false });
    assert.ok(logo.__inryokuParticleSpeechRings);
    c.destroy();
    assert.ok(!logo.__inryokuParticleSpeechRings, 'マーカー解除（delete or null）');
  });

  test('連続 attach（10 回）でも controller は 1 つに収束', () => {
    const { logo } = makeLogo();
    logo.classList.add('logo-multi-burst');
    const controllers = [];
    for (let i = 0; i < 10; i++) {
      controllers.push(ParticleSpeechRings.attachToLogo('.logo-multi-burst', { hover: false, click: false }));
    }
    const first = controllers[0];
    for (const c of controllers) {
      assert.strictEqual(c, first, '全 attach 結果が同一参照');
    }
    if (first.destroy) first.destroy();
    assert.ok(!logo.__inryokuParticleSpeechRings, 'destroy 後はマーカー解除');
  });

  test('attach → destroy → 再 attach でも別 instance として正常に取得できる', () => {
    const { logo } = makeLogo();
    logo.classList.add('logo-multi-recycle');
    const c1 = ParticleSpeechRings.attachToLogo('.logo-multi-recycle', { hover: false, click: false });
    c1.destroy();
    const c2 = ParticleSpeechRings.attachToLogo('.logo-multi-recycle', { hover: false, click: false });
    assert.ok(c2, '再 attach 成功');
    assert.notStrictEqual(c1.instance, c2.instance, '別 instance になっている');
    if (c2.destroy) c2.destroy();
  });
});

describe('integration — fetch wrap 競合（多重ラップでも元 fetch が破壊されない）', () => {
  test('fetch を 2 重にラップしても original の挙動が保たれる', async () => {
    // 元実装の独立検証: 多重 wrap パターンが順番通り chain することを確認
    const calls = [];
    const original = async (url) => ({ ok: true, url });
    const wrap1 = (next) => async (...args) => { calls.push('w1-in'); const r = await next(...args); calls.push('w1-out'); return r; };
    const wrap2 = (next) => async (...args) => { calls.push('w2-in'); const r = await next(...args); calls.push('w2-out'); return r; };
    const wrapped = wrap2(wrap1(original));
    const r = await wrapped('/test');
    assert.equal(r.ok, true);
    assert.equal(r.url, '/test');
    assert.deepEqual(calls, ['w2-in', 'w1-in', 'w1-out', 'w2-out'], 'wrap 順序は LIFO chain');
  });

  test('idempotent guard 付き wrap は 2 回適用しても 1 回ぶんしか効かない', async () => {
    // 多重ロード時の防御パターン（__wrapped マーカー）
    const MARK = '__inryoku_wrapped';
    let wrapCount = 0;
    function safeWrap(fn) {
      if (fn[MARK]) return fn;
      const wrapped = async (...args) => { wrapCount++; return fn(...args); };
      wrapped[MARK] = true;
      return wrapped;
    }
    const base = async () => 'ok';
    const w1 = safeWrap(base);
    const w2 = safeWrap(w1); // 2 度 wrap してもマーカーで弾かれる
    assert.strictEqual(w1, w2, '同一参照（再 wrap されない）');
    await w2();
    await w2();
    assert.equal(wrapCount, 2, '実行回数は 2（wrap 自体は 1 回ぶん）');
  });
});

describe('integration — _scheduleHaloSettle のフレーム制御', () => {
  test('placement!="halo" では _scheduleHaloSettle は no-op', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, { placement: 'below' });
    sp.start();
    assert.equal(sp._haloFrame, 0);
    sp._scheduleHaloSettle(5);
    assert.equal(sp._haloFrame, 0, 'halo 以外では予約されない');
    sp.destroy();
  });

  test('placement="halo" では _scheduleHaloSettle がフレームを予約する', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, { placement: 'halo' });
    sp.start();
    sp._scheduleHaloSettle(3);
    assert.notEqual(sp._haloFrame, 0, 'rAF id がセットされる');
    // 二重呼び出しで前の rAF を cancel
    const before = sp._haloFrame;
    sp._scheduleHaloSettle(3);
    assert.notEqual(sp._haloFrame, before, '前回の rAF はキャンセルされ新規 ID');
    sp.destroy();
    assert.equal(sp._haloFrame, 0, 'destroy で rAF キャンセル');
  });
});

describe('integration — haloScale オプション伝播', () => {
  test('opts.haloScale を渡すと container の --prs-halo-scale に伝播', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, { haloScale: 1.4 });
    sp.start();
    const v = sp.container.style.getPropertyValue('--prs-halo-scale');
    assert.equal(v, '1.4');
    sp.destroy();
  });

  test('opts.haloScale 未指定では既定値 0.72 が反映される', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const v = sp.container.style.getPropertyValue('--prs-halo-scale');
    assert.equal(v, '0.72');
    sp.destroy();
  });
});
