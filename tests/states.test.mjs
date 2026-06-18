// tests/states.test.mjs
// states.js — inryokü 空/読込/エラー UX 統一レイヤのテスト
// JSDOM 環境で window.inryokuStates の挙動と aria-live / 多重表示制御を検証。

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = readFileSync(resolve(ROOT, 'states.js'), 'utf8');

function freshDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="host"><span class="kid">x</span></div></body></html>', {
    url: 'http://localhost/'
  });
  // states.js は IIFE。jsdom の window.eval では `window` 識別子が未束縛なので
  // 既存 setup.mjs と同様、global に window/document を生やしてから eval する。
  global.window = dom.window;
  global.document = dom.window.document;
  global.Node = dom.window.Node;
  global.Element = dom.window.Element;
  // ブラウザでも Node でも同形に走る IIFE を直接 eval。
  dom.window.eval(SRC);
  return dom;
}

describe('inryokuStates: 公開 API', () => {
  test('window.inryokuStates が存在する', () => {
    const { window } = freshDom();
    assert.ok(window.inryokuStates);
    assert.equal(typeof window.inryokuStates.showLoading, 'function');
    assert.equal(typeof window.inryokuStates.showEmpty, 'function');
    assert.equal(typeof window.inryokuStates.showError, 'function');
    assert.equal(typeof window.inryokuStates.hide, 'function');
  });

  test('MESSAGES に inryokü 文言が揃っている', () => {
    const { window } = freshDom();
    const M = window.inryokuStates.MESSAGES;
    assert.equal(M.cartEmpty, 'the cart is empty. observation begins here.');
    assert.equal(M.productLoading, 'the wave forms...');
    assert.equal(M.aiThinking, 'the observer thinks...');
    assert.equal(M.searchEmpty, 'no signal in this direction.');
    assert.equal(M.networkError, 'the connection is grey.');
    assert.equal(M.completed, 'the wave reached you.');
    assert.equal(M.validation, 'this needs more shape.');
  });
});

describe('showLoading', () => {
  test('state-loading ノードを target に挿入し aria-busy=true / aria-live=polite', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    window.inryokuStates.showLoading(host);

    const node = host.querySelector('.inryoku-state.state-loading');
    assert.ok(node, 'loading ノードが挿入される');
    assert.equal(node.getAttribute('role'), 'status');
    assert.equal(node.getAttribute('aria-live'), 'polite');
    assert.equal(node.getAttribute('aria-busy'), 'true');
    assert.equal(host.getAttribute('aria-busy'), 'true');
  });

  test('既定文言は productLoading 系 (the wave forms...)', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    window.inryokuStates.showLoading(host);
    const msg = host.querySelector('.inryoku-state__message');
    assert.equal(msg.textContent, 'the wave forms...');
  });

  test('opts.message でカスタム文言', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    window.inryokuStates.showLoading(host, { message: 'the observer thinks...' });
    const msg = host.querySelector('.inryoku-state__message');
    assert.equal(msg.textContent, 'the observer thinks...');
  });
});

describe('showEmpty', () => {
  test('state-empty / aria-live=polite / aria-busy なし', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    window.inryokuStates.showEmpty(host, { message: window.inryokuStates.MESSAGES.cartEmpty });
    const node = host.querySelector('.inryoku-state.state-empty');
    assert.ok(node);
    assert.equal(node.getAttribute('role'), 'status');
    assert.equal(node.getAttribute('aria-live'), 'polite');
    assert.equal(node.getAttribute('aria-busy'), 'false');
    assert.equal(host.hasAttribute('aria-busy'), false);
    const msg = host.querySelector('.inryoku-state__message');
    assert.equal(msg.textContent, 'the cart is empty. observation begins here.');
  });
});

describe('showError', () => {
  test('state-error / role=alert / aria-live=assertive', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    window.inryokuStates.showError(host);
    const node = host.querySelector('.inryoku-state.state-error');
    assert.ok(node);
    assert.equal(node.getAttribute('role'), 'alert');
    assert.equal(node.getAttribute('aria-live'), 'assertive');
  });

  test('既定文言はネットワーク失敗 (the connection is grey.)', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    window.inryokuStates.showError(host);
    const msg = host.querySelector('.inryoku-state__message');
    assert.equal(msg.textContent, 'the connection is grey.');
  });

  test('opts.sub があれば __sub が出る', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    window.inryokuStates.showError(host, { message: 'x', sub: 'retry possible.' });
    const sub = host.querySelector('.inryoku-state__sub');
    assert.ok(sub);
    assert.equal(sub.textContent, 'retry possible.');
  });
});

describe('hide', () => {
  test('hide でノード除去 / aria-busy 解除 / 既存子の aria-hidden 復元', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    const kid = host.querySelector('.kid');
    assert.equal(kid.hasAttribute('aria-hidden'), false);

    window.inryokuStates.showLoading(host);
    assert.equal(kid.getAttribute('aria-hidden'), 'true', '表示中は子を hidden に');

    const ok = window.inryokuStates.hide(host);
    assert.equal(ok, true);
    assert.equal(host.querySelector('.inryoku-state'), null, 'ノード除去');
    assert.equal(host.hasAttribute('aria-busy'), false);
    assert.equal(kid.hasAttribute('aria-hidden'), false, '元に戻る');
  });

  test('表示していない target を hide しても false で安全', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    assert.equal(window.inryokuStates.hide(host), false);
  });
});

describe('多重表示制御', () => {
  test('同一 target に show を続けて呼ぶと最後の状態のみ残る', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');

    window.inryokuStates.showLoading(host);
    window.inryokuStates.showError(host, { message: 'the connection is grey.' });

    const all = host.querySelectorAll('.inryoku-state');
    assert.equal(all.length, 1, 'state ノードは常に 1 つ');
    assert.ok(all[0].classList.contains('state-error'));
    assert.equal(all[0].getAttribute('aria-live'), 'assertive');
  });

  test('show -> show -> hide で完全クリーンアップ', () => {
    const { window } = freshDom();
    const host = window.document.getElementById('host');
    const kid = host.querySelector('.kid');

    window.inryokuStates.showEmpty(host);
    window.inryokuStates.showLoading(host);
    window.inryokuStates.hide(host);

    assert.equal(host.querySelector('.inryoku-state'), null);
    assert.equal(kid.hasAttribute('aria-hidden'), false);
    assert.equal(host.hasAttribute('aria-busy'), false);
    assert.equal(host.hasAttribute('data-inryoku-state'), false);
  });
});

describe('target 解決', () => {
  test('CSS セレクタ文字列で target 指定可', () => {
    const { window } = freshDom();
    // global document を states.js が見るので window.document に揃える
    window.inryokuStates.showLoading.call(null, '#host');
    // 実装は document.querySelector を使うので window.document 上の host に挿入される
    const host = window.document.getElementById('host');
    assert.ok(host.querySelector('.inryoku-state.state-loading'));
  });

  test('null/不正 target は no-op で例外を出さない', () => {
    const { window } = freshDom();
    assert.doesNotThrow(() => window.inryokuStates.showLoading(null));
    assert.doesNotThrow(() => window.inryokuStates.hide(null));
    assert.doesNotThrow(() => window.inryokuStates.showError(undefined));
  });
});

describe('既存スクリプトとの非干渉', () => {
  test('window.__inryokuErrorShield フラグ等を踏まない (states.js は __inryokuStates のみ)', () => {
    const { window } = freshDom();
    assert.equal(window.__inryokuStates, true);
    // error-shield 系のフラグは触らない
    assert.equal(window.__inryokuErrorShield, undefined);
  });

  test('二重ロードしても再初期化されない', () => {
    const dom = freshDom();
    const before = dom.window.inryokuStates;
    dom.window.eval(SRC); // 再評価
    const after = dom.window.inryokuStates;
    assert.equal(before, after, '同じインスタンスのまま');
  });
});
