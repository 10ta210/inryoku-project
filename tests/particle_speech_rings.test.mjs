import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOM } from './setup.mjs';

before(() => { setupDOM({ withSpeech: true }); });

function makeLogo() {
  const host = document.createElement('div');
  host.className = 'hologram-logo';
  const logo = document.createElement('div');
  logo.className = 'logo-holo-wrap';
  host.appendChild(logo);
  document.body.appendChild(host);
  return { host, logo };
}

function flush() {
  // Drain pending setImmediate (raf) callbacks
  return new Promise((r) => setImmediate(r));
}

describe('ParticleSpeechRings — constructor', () => {
  test('logo 要素が無いと throw', () => {
    assert.throws(() => new ParticleSpeechRings(null), /logo element required/);
  });

  test('正常に構築でき、初期状態は active=false / stopped=false', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    assert.equal(sp.active, false);
    assert.equal(sp.stopped, false);
    assert.equal(sp.container, null);
    assert.equal(sp.timer, null);
    sp.destroy();
  });

  test('opts は DEFAULTS とマージされる', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, { hoverCooldownMs: 100 });
    assert.equal(sp.opts.hoverCooldownMs, 100);
    assert.equal(sp.opts.whisperSize, 72, 'デフォルトが残る');
    sp.destroy();
  });
});

describe('ParticleSpeechRings — start / stop / destroy ライフサイクル', () => {
  test('start() でタイマーがセットされ、container が DOM 上にある', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    assert.ok(sp.timer != null, 'timer がセットされる');
    assert.ok(sp.container, 'container が生成される');
    assert.ok(sp.container.classList.contains('pring-speech'));
    sp.destroy();
  });

  test('stop() でタイマーが解除され、stopped=true', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp.stop();
    assert.equal(sp.stopped, true);
    assert.equal(sp.timer, null);
    sp.destroy();
  });

  test('destroy() で container が DOM から外れる', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const c = sp.container;
    assert.ok(c.parentElement, 'mount 時は親がある');
    sp.destroy();
    assert.equal(sp.container, null);
    assert.equal(c.parentElement, null);
  });

  test('destroy() で _cleanupFns が全て呼ばれる', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    let called = 0;
    sp._cleanupFns.push(() => { called++; });
    sp._cleanupFns.push(() => { called++; });
    sp.destroy();
    assert.equal(called, 2);
  });

  test('stop() 後の _utter は false を返す（発話拒否）', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp.stop();
    assert.equal(sp._utter('whisper'), false);
    sp.destroy();
  });
});

describe('ParticleSpeechRings._utter — 発話実行', () => {
  test('_utter("whisper") で container に pring-speech__ring が追加される', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const ok = sp._utter('whisper');
    assert.equal(ok, true);
    assert.equal(sp.active, true);
    const rings = sp.container.querySelectorAll('.pring-speech__ring');
    assert.equal(rings.length, 1);
    assert.ok(rings[0].classList.contains('pring-speech__ring--whisper'));
    sp.destroy();
  });

  test('register 別クラスが付く（hover）', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('hover');
    const r = sp.container.querySelector('.pring-speech__ring');
    assert.ok(r.classList.contains('pring-speech__ring--hover'));
    sp.destroy();
  });

  test('未知の register は false', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    assert.equal(sp._utter('bogus'), false);
    sp.destroy();
  });

  test('特殊 (special) で canon を直接指定できる', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const ok = sp._utter('special', { canon: 'summon', size: 200 });
    assert.equal(ok, true);
    assert.equal(sp._currentSpeech.canon, 'summon');
    sp.destroy();
  });

  test('存在しない canon を special 指定すると false（warn）', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const orig = console.warn; console.warn = () => {};
    try {
      assert.equal(sp._utter('special', { canon: '__nope__' }), false);
    } finally { console.warn = orig; }
    sp.destroy();
  });
});

describe('ParticleSpeechRings — 同時発話禁止と優先度', () => {
  test('同 register が active 中は queue に入って即時発話しない', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('whisper');
    assert.equal(sp.active, true);
    const ringsBefore = sp.container.querySelectorAll('.pring-speech__ring').length;
    const ret = sp._utter('whisper');
    assert.equal(ret, false, '2 回目は false');
    const ringsAfter = sp.container.querySelectorAll('.pring-speech__ring').length;
    assert.equal(ringsBefore, ringsAfter, 'リングは増えない');
    assert.ok(sp._pendingSpeech, 'pending に積まれる');
    sp.destroy();
  });

  test('優先度: click は whisper を preempt する', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('whisper');
    assert.equal(sp._currentSpeech.register, 'whisper');
    sp._utter('click');
    assert.equal(sp._currentSpeech.register, 'click', 'click が preempt');
    sp.destroy();
  });

  test('優先度: special > click > hover > whisper', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    assert.ok(sp._getPriority('special') > sp._getPriority('click'));
    assert.ok(sp._getPriority('click') > sp._getPriority('hover'));
    assert.ok(sp._getPriority('hover') > sp._getPriority('whisper'));
    sp.destroy();
  });

  test('低優先 register は active 中の高優先を preempt しない', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('click');
    sp._utter('whisper');
    assert.equal(sp._currentSpeech.register, 'click', 'click のまま');
    sp.destroy();
  });

  test('pending: より高優先の発話が来たら pending を上書き', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('special', { canon: 'summon' });
    sp._utter('whisper');
    assert.equal(sp._pendingSpeech.register, 'whisper');
    sp._utter('click');
    assert.equal(sp._pendingSpeech.register, 'click', 'click で上書き');
    sp.destroy();
  });
});

describe('ParticleSpeechRings — クールダウン', () => {
  test('hover は cooldown 中は再発火しない', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, { hoverCooldownMs: 5000 });
    sp.start();
    assert.equal(sp._utter('hover'), true);
    // 終了させてから再発火
    sp._cancelCurrentSpeech('test');
    assert.equal(sp._utter('hover'), false, 'cooldown 中は false');
    sp.destroy();
  });

  test('click も cooldown が独立に効く', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, { clickCooldownMs: 5000, hoverCooldownMs: 0 });
    sp.start();
    assert.equal(sp._utter('click'), true);
    sp._cancelCurrentSpeech('test');
    assert.equal(sp._utter('click'), false);
    sp.destroy();
  });

  test('whisper は cooldown の対象外', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    assert.equal(sp._utter('whisper'), true);
    sp._cancelCurrentSpeech('test');
    assert.equal(sp._utter('whisper'), true);
    sp.destroy();
  });

  test('cooldown 経過後は再発火可能', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, { hoverCooldownMs: 1 });
    sp.start();
    sp._utter('hover');
    sp._cancelCurrentSpeech('test');
    sp.cooldownUntil.hover = 0;
    assert.equal(sp._utter('hover'), true);
    sp.destroy();
  });

  test('cooldown 経過: cooldownUntil < Date.now() なら再発火（時間進行のシミュレート）', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, { hoverCooldownMs: 100 });
    sp.start();
    sp._utter('hover');
    sp._cancelCurrentSpeech('test');
    // cooldown が過去になるよう書き換え（時間経過の代替）
    sp.cooldownUntil.hover = Date.now() - 1000;
    assert.equal(sp._utter('hover'), true, 'cooldown 経過後は許可');
    sp.destroy();
  });

  test('cooldownUntil > Date.now() の間はずっと拒否（境界条件）', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo, { hoverCooldownMs: 5000 });
    sp.start();
    sp._utter('hover');
    sp._cancelCurrentSpeech('test');
    // 何度叩いても false
    assert.equal(sp._utter('hover'), false);
    assert.equal(sp._utter('hover'), false);
    assert.equal(sp._utter('hover'), false);
    sp.destroy();
  });
});

describe('ParticleSpeechRings — stop() / destroy() 中の発話無視', () => {
  test('stop() 中の _utter は全 register で false', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp.stop();
    assert.equal(sp._utter('whisper'), false);
    assert.equal(sp._utter('hover'), false);
    assert.equal(sp._utter('click'), false);
    assert.equal(sp._utter('special', { canon: 'summon' }), false);
    sp.destroy();
  });

  test('発話中に stop() するとリングが除去され body クラスも外れる', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('whisper');
    assert.equal(sp.active, true);
    assert.ok(document.body.classList.contains('inryoku-speaking'));
    sp.stop();
    assert.equal(sp.active, false);
    assert.equal(sp._currentRing, null);
    assert.ok(!document.body.classList.contains('inryoku-speaking'));
    sp.destroy();
  });

  test('stop() で _pendingSpeech もクリアされる', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('whisper');
    sp._utter('whisper'); // pending に積まれる（同優先・active 中）
    assert.ok(sp._pendingSpeech);
    sp.stop();
    assert.equal(sp._pendingSpeech, null);
    sp.destroy();
  });

  test('summon() / revelation() / speakCanon() も stop() 中は false', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp.stop();
    assert.equal(sp.summon(), false);
    assert.equal(sp.revelation(), false);
    assert.equal(sp.speakCanon('observation'), false);
    sp.destroy();
  });

  test('utterNow() も stop() 中は false', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp.stop();
    assert.equal(sp.utterNow('whisper'), false);
    sp.destroy();
  });
});

describe('ParticleSpeechRings — bindHover / bindClick', () => {
  test('bindHover は mouseenter / pointerenter リスナーを登録', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const target = document.createElement('div');
    document.body.appendChild(target);
    sp.bindHover(target);
    target.dispatchEvent(new window.Event('mouseenter'));
    assert.equal(sp.active, true);
    sp.destroy();
  });

  test('bindClick は click リスナーを登録', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const target = document.createElement('div');
    document.body.appendChild(target);
    sp.bindClick(target);
    target.dispatchEvent(new window.Event('click'));
    assert.equal(sp.active, true);
    assert.equal(sp._currentSpeech.register, 'click');
    sp.destroy();
  });

  test('destroy 後は bind したリスナーが効かない', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    const target = document.createElement('div');
    document.body.appendChild(target);
    sp.bindClick(target);
    sp.destroy();
    // クリックしてもエラーにならず、active も false のまま
    target.dispatchEvent(new window.Event('click'));
    assert.equal(sp.active, false);
  });
});

describe('ParticleSpeechRings — summon / revelation / speakCanon', () => {
  test('summon() は canon=summon の special 発話', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp.summon();
    assert.equal(sp._currentSpeech.canon, 'summon');
    assert.equal(sp._currentSpeech.register, 'special');
    sp.destroy();
  });

  test('revelation() は canon=revelation', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp.revelation();
    assert.equal(sp._currentSpeech.canon, 'revelation');
    sp.destroy();
  });

  test('speakCanon("observation") は canon に紐づく register で任意 canon を発話', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp.speakCanon('observation');
    assert.equal(sp._currentSpeech.canon, 'observation');
    assert.equal(sp._currentSpeech.register, 'hover');
    sp.destroy();
  });
});

describe('ParticleSpeechRings — 状態遷移イベント', () => {
  test('発話開始時に inryoku:ringstart が dispatch される', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    let detail = null;
    const handler = (e) => { detail = e.detail; };
    window.addEventListener('inryoku:ringstart', handler);
    sp._utter('whisper');
    window.removeEventListener('inryoku:ringstart', handler);
    assert.ok(detail, 'event 発火');
    assert.equal(detail.register, 'whisper');
    sp.destroy();
  });

  test('cancel 時に inryoku:ringend が dispatch される', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('whisper');
    let ended = false;
    const handler = () => { ended = true; };
    window.addEventListener('inryoku:ringend', handler);
    sp._cancelCurrentSpeech('test');
    window.removeEventListener('inryoku:ringend', handler);
    assert.equal(ended, true);
    sp.destroy();
  });

  test('発話中は body に inryoku-speaking クラスが付く', () => {
    const { logo } = makeLogo();
    const sp = new ParticleSpeechRings(logo);
    sp.start();
    sp._utter('whisper');
    assert.ok(document.body.classList.contains('inryoku-speaking'));
    sp._cancelCurrentSpeech('test');
    assert.ok(!document.body.classList.contains('inryoku-speaking'));
    sp.destroy();
  });
});
