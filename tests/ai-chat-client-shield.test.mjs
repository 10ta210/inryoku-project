// tests/ai-chat-client-shield.test.mjs
// ai-chat-client-shield.js の単体テスト。
// 純粋関数（detectFallback / shouldAppendToHistory / record*）に加え、
// JSDOM 内で fetch をモックして install 後の wrappedFetch 経路と
// localStorage 永続化、toast 連携、onFallback 通知を検証する。

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SHIELD_PATH = resolve(ROOT, 'ai-chat-client-shield.js');
const SHIELD_SRC = readFileSync(SHIELD_PATH, 'utf8');

// Node 直 require 用（純粋関数テスト）
const require = createRequire(import.meta.url);
const shieldModule = require(SHIELD_PATH);

// ─── 1. 純粋関数 ─────────────────────────────────────────

describe('detectFallback', () => {
    const { detectFallback } = shieldModule;

    test('null/undefined/プリミティブは null', () => {
        assert.equal(detectFallback(null), null);
        assert.equal(detectFallback(undefined), null);
        assert.equal(detectFallback('x'), null);
        assert.equal(detectFallback(42), null);
    });

    test('通常応答 (assistant) は null', () => {
        assert.equal(detectFallback({
            response: 'hi', fallback: false, role: 'assistant'
        }), null);
    });

    test('fallback:true + role:system は info を返す', () => {
        const info = detectFallback({
            response: 'the apparatus paused. try again.',
            fallback: true,
            role: 'system',
            kind: 'server_5xx',
            meta: { latencyMs: 10042 }
        });
        assert.ok(info);
        assert.equal(info.isFallback, true);
        assert.equal(info.role, 'system');
        assert.equal(info.kind, 'server_5xx');
        assert.equal(info.response, 'the apparatus paused. try again.');
        assert.deepEqual(info.meta, { latencyMs: 10042 });
    });

    test('fallback:true でも role が system でない場合は null（厳格契約）', () => {
        assert.equal(detectFallback({
            response: '...', fallback: true, role: 'assistant', kind: 'unknown'
        }), null);
    });

    test('kind 欠落時は "unknown" を埋める', () => {
        const info = detectFallback({
            response: 'x', fallback: true, role: 'system'
        });
        assert.ok(info);
        assert.equal(info.kind, 'unknown');
    });
});

describe('shouldAppendToHistory', () => {
    const { shouldAppendToHistory } = shieldModule;

    test('通常 assistant 応答 → true', () => {
        assert.equal(shouldAppendToHistory({
            response: 'ok', fallback: false, role: 'assistant'
        }), true);
    });

    test('fallback:true → false', () => {
        assert.equal(shouldAppendToHistory({
            response: 'x', fallback: true, role: 'system', kind: 'timeout'
        }), false);
    });

    test('role:system 単独でも → false', () => {
        assert.equal(shouldAppendToHistory({
            response: 'x', role: 'system'
        }), false);
    });

    test('未知形式は壊さず true（後方互換）', () => {
        assert.equal(shouldAppendToHistory(null), true);
        assert.equal(shouldAppendToHistory({}), true);
        assert.equal(shouldAppendToHistory('weird'), true);
    });
});

describe('record helpers', () => {
    const { makeStats, recordSuccess, recordFallback } = shieldModule;

    test('makeStats は zero 状態', () => {
        const s = makeStats();
        assert.equal(s.totalRequests, 0);
        assert.equal(s.fallbackCount, 0);
        assert.equal(s.consecutive, 0);
        assert.equal(s.lastFallbackAt, null);
    });

    test('recordSuccess は consecutive をリセット', () => {
        const s = makeStats();
        recordFallback(s, 'timeout', 1000);
        recordFallback(s, 'timeout', 2000);
        assert.equal(s.consecutive, 2);
        recordSuccess(s);
        assert.equal(s.consecutive, 0);
        assert.equal(s.successCount, 1);
        assert.equal(s.totalRequests, 3);
    });

    test('recordFallback は kind 別にカウントする', () => {
        const s = makeStats();
        recordFallback(s, 'timeout', 1);
        recordFallback(s, 'server_5xx', 2);
        recordFallback(s, 'timeout', 3);
        assert.equal(s.fallbackCount, 3);
        assert.equal(s.byKind.timeout, 2);
        assert.equal(s.byKind.server_5xx, 1);
        assert.equal(s.lastKind, 'timeout');
        assert.equal(s.lastFallbackAt, 3);
    });
});

// ─── 2. install + JSDOM 統合 ──────────────────────────────

function bootShieldDOM() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
        url: 'http://localhost/',
        pretendToBeVisual: true,
        runScripts: 'outside-only'
    });
    const { window } = dom;

    // localStorage は jsdom が提供。fetch をモックして差し替え。
    const fetchCalls = [];
    let nextResponse = null;
    window.fetch = function (input, init) {
        fetchCalls.push({ input, init });
        const r = nextResponse;
        if (r instanceof Error) return Promise.reject(r);
        return Promise.resolve(r);
    };

    function setNext(r) { nextResponse = r; }

    function jsonResponse(body, { status = 200, contentType = 'application/json' } = {}) {
        const text = JSON.stringify(body);
        return {
            ok: status >= 200 && status < 300,
            status,
            headers: {
                get(name) {
                    if (String(name).toLowerCase() === 'content-type') return contentType;
                    return null;
                }
            },
            clone() { return jsonResponse(body, { status, contentType }); },
            json() { return Promise.resolve(JSON.parse(text)); },
            text() { return Promise.resolve(text); }
        };
    }

    // shield ソースを window コンテキストで実行 → install 自動起動
    window.eval(SHIELD_SRC);

    return { dom, window, setNext, jsonResponse, fetchCalls };
}

// fetch promise のチェーンで shield が副作用を完了するのを待つヘルパ
function flush() {
    return new Promise((r) => setImmediate(r));
}

describe('install + fetch wrapping', () => {
    test('/api/chat 以外の fetch は素通し（計測しない）', async () => {
        const { window, setNext, jsonResponse } = bootShieldDOM();
        setNext(jsonResponse({ ok: true }));
        const res = await window.fetch('/api/other', { method: 'POST' });
        assert.ok(res);
        await flush();
        const stats = window.inryokuChatShield.stats();
        assert.equal(stats.totalRequests, 0);
    });

    test('GET /api/chat（POST 以外）も計測しない', async () => {
        const { window, setNext, jsonResponse } = bootShieldDOM();
        setNext(jsonResponse({ response: 'x', fallback: false, role: 'assistant' }));
        await window.fetch('/api/chat', { method: 'GET' });
        await flush();
        const stats = window.inryokuChatShield.stats();
        assert.equal(stats.totalRequests, 0);
    });

    test('通常応答は successCount を増やし fallbackCount は 0 のまま', async () => {
        const { window, setNext, jsonResponse } = bootShieldDOM();
        setNext(jsonResponse({
            response: 'こんにちは。', fallback: false, role: 'assistant',
            meta: { latencyMs: 380 }
        }));
        const res = await window.fetch('/api/chat', { method: 'POST', body: '{}' });
        assert.equal(res.ok, true);
        // 透過: 元の body も読める
        const body = await res.json();
        assert.equal(body.response, 'こんにちは。');
        await flush();
        await flush();

        const stats = window.inryokuChatShield.stats();
        assert.equal(stats.totalRequests, 1);
        assert.equal(stats.successCount, 1);
        assert.equal(stats.fallbackCount, 0);
        assert.equal(stats.consecutive, 0);
    });

    test('fallback 応答で fallbackCount/byKind/lastKind が記録され onFallback が発火', async () => {
        const { window, setNext, jsonResponse } = bootShieldDOM();
        const got = [];
        window.inryokuChatShield.onFallback((info) => got.push(info));

        setNext(jsonResponse({
            response: 'the apparatus paused. try again.',
            fallback: true, role: 'system', kind: 'server_5xx',
            meta: { latencyMs: 10042 }
        }));
        await window.fetch('/api/chat', { method: 'POST', body: '{}' });
        await flush();
        await flush();

        const stats = window.inryokuChatShield.stats();
        assert.equal(stats.totalRequests, 1);
        assert.equal(stats.fallbackCount, 1);
        assert.equal(stats.successCount, 0);
        assert.equal(stats.consecutive, 1);
        assert.equal(stats.lastKind, 'server_5xx');
        assert.equal(stats.byKind.server_5xx, 1);

        assert.equal(got.length, 1);
        assert.equal(got[0].kind, 'server_5xx');
    });

    test('fallback → 成功 で consecutive がリセット', async () => {
        const { window, setNext, jsonResponse } = bootShieldDOM();

        setNext(jsonResponse({
            response: 'x', fallback: true, role: 'system', kind: 'timeout'
        }));
        await window.fetch('/api/chat', { method: 'POST' });
        await flush(); await flush();

        setNext(jsonResponse({
            response: 'ok', fallback: false, role: 'assistant'
        }));
        await window.fetch('/api/chat', { method: 'POST' });
        await flush(); await flush();

        const stats = window.inryokuChatShield.stats();
        assert.equal(stats.fallbackCount, 1);
        assert.equal(stats.successCount, 1);
        assert.equal(stats.consecutive, 0);
    });

    test('localStorage に stats が永続化される', async () => {
        const { window, setNext, jsonResponse } = bootShieldDOM();

        setNext(jsonResponse({
            response: 'x', fallback: true, role: 'system', kind: 'rate_limit'
        }));
        await window.fetch('/api/chat', { method: 'POST' });
        await flush(); await flush();

        const raw = window.localStorage.getItem('inryoku.chat.shield.stats');
        assert.ok(raw, 'localStorage に書かれている');
        const parsed = JSON.parse(raw);
        assert.equal(parsed.fallbackCount, 1);
        assert.equal(parsed.lastKind, 'rate_limit');
        assert.equal(parsed.byKind.rate_limit, 1);
    });

    test('reset() でカウンタも localStorage もクリア', async () => {
        const { window, setNext, jsonResponse } = bootShieldDOM();
        setNext(jsonResponse({
            response: 'x', fallback: true, role: 'system', kind: 'network'
        }));
        await window.fetch('/api/chat', { method: 'POST' });
        await flush(); await flush();

        window.inryokuChatShield.reset();
        const stats = window.inryokuChatShield.stats();
        assert.equal(stats.totalRequests, 0);
        assert.equal(stats.fallbackCount, 0);
        assert.equal(window.localStorage.getItem('inryoku.chat.shield.stats'), null);
    });

    test('inryokuShield.toast があれば fallback で呼ばれる', async () => {
        const { window, setNext, jsonResponse } = bootShieldDOM();
        const toastCalls = [];
        window.inryokuShield = {
            toast(opts) { toastCalls.push(opts); }
        };

        setNext(jsonResponse({
            response: 'x', fallback: true, role: 'system', kind: 'timeout'
        }));
        await window.fetch('/api/chat', { method: 'POST' });
        await flush(); await flush();

        assert.equal(toastCalls.length, 1);
        assert.equal(toastCalls[0].text, 'the wave is slow.');
        assert.equal(toastCalls[0].role, 'status');
    });

    test('content-type が JSON でないレスポンスは無視（誤検知しない）', async () => {
        const { window, setNext, jsonResponse } = bootShieldDOM();
        setNext({
            ok: true, status: 200,
            headers: { get: () => 'text/html' },
            clone() { return this; },
            json() { return Promise.resolve({ fallback: true, role: 'system' }); }
        });
        await window.fetch('/api/chat', { method: 'POST' });
        await flush(); await flush();
        const stats = window.inryokuChatShield.stats();
        assert.equal(stats.totalRequests, 0);
    });

    test('shouldAppendToHistory はクライアント側公開 API として使える', () => {
        const { window } = bootShieldDOM();
        const shield = window.inryokuChatShield;
        assert.equal(shield.shouldAppendToHistory({
            response: 'x', fallback: true, role: 'system', kind: 'timeout'
        }), false);
        assert.equal(shield.shouldAppendToHistory({
            response: 'x', fallback: false, role: 'assistant'
        }), true);
    });

    test('二重 install を防ぐ（__inryokuChatShield フラグ）', () => {
        const { window } = bootShieldDOM();
        const first = window.inryokuChatShield;
        // 再度 eval しても上書きされない
        window.eval(SHIELD_SRC);
        assert.strictEqual(window.inryokuChatShield, first);
    });
});
