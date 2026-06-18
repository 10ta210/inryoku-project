/**
 * tests/runtime-verification.test.mjs
 *
 * 静的検証 (子プロセス起動なし) — server.js の構造的不整合を CI で検出する。
 * runtime-verification-2026-04-28.md の手検証で明らかになった
 * 「将来再発しうる」項目だけを軽量にチェックする。
 *
 * 子プロセス起動による E2E は CI 重量化のため避ける。
 * 実 endpoint 動作は docs/runtime-verification-2026-04-28.md を参照。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SERVER_JS = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

test('server.js exists and is non-trivial', () => {
    assert.ok(SERVER_JS.length > 10_000, 'server.js should be substantial');
});

test('MAX_BODY_SIZE defined and reasonable (<= 64KB)', () => {
    const m = SERVER_JS.match(/MAX_BODY_SIZE\s*=\s*(\d+)\s*\*\s*(\d+)/);
    assert.ok(m, 'MAX_BODY_SIZE constant must be defined');
    const bytes = parseInt(m[1], 10) * parseInt(m[2], 10);
    assert.ok(bytes > 0 && bytes <= 64 * 1024, `MAX_BODY_SIZE ${bytes} should be 0..64KB`);
});

test('readBody enforces size limit with 413 status', () => {
    // 413 ステータスを書く処理が readBody 内に存在する
    assert.match(SERVER_JS, /writeHead\(413/, 'must send 413 on body too large');
});

test('admin endpoints require auth via checkAdminAuth', () => {
    assert.match(SERVER_JS, /checkAdminAuth\s*\(\s*req\s*,\s*res\s*\)/);
    // /api/subscribers が admin 認証必須
    const subsBlock = SERVER_JS.match(/\/api\/subscribers[\s\S]{0,500}/);
    assert.ok(subsBlock, '/api/subscribers handler must exist');
    assert.match(subsBlock[0], /checkAdminAuth/, '/api/subscribers must call checkAdminAuth');
});

test('subscribe endpoint sets HttpOnly cookie', () => {
    // HttpOnly が cookie helper に含まれる (buildAuthCookie)
    assert.match(SERVER_JS, /HttpOnly/);
    assert.match(SERVER_JS, /buildAuthCookie/);
});

test('CSP header is configured (default-src self)', () => {
    assert.match(SERVER_JS, /Content-Security-Policy/);
    assert.match(SERVER_JS, /default-src 'self'/);
    assert.match(SERVER_JS, /frame-ancestors 'none'/);
    assert.match(SERVER_JS, /object-src 'none'/);
});

test('security response headers are emitted', () => {
    for (const h of [
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy',
        'Strict-Transport-Security',
    ]) {
        assert.match(SERVER_JS, new RegExp(h), `${h} must be present`);
    }
});

test('deny list blocks .env, server.js, package.json', () => {
    // 何らかの方法で deny されている (パターンは複数有り得る)
    assert.match(SERVER_JS, /\.env/);
    assert.match(SERVER_JS, /package\.json/);
    // 403 を返す箇所
    assert.match(SERVER_JS, /writeHead\(403/);
});

test('rate limit has chat=30, subscribe=5 thresholds in comment/doc', () => {
    // 設定値はコメントに記載 (server.js:61)
    assert.match(SERVER_JS, /chat=30\/min/);
    assert.match(SERVER_JS, /subscribe=5\/hour/);
});

test('CSP report endpoint returns 204', () => {
    const block = SERVER_JS.match(/req\.url === '\/api\/csp-report'[\s\S]{0,2000}/);
    assert.ok(block, '/api/csp-report handler must exist');
    assert.match(block[0], /writeHead\s*\(\s*204\b/);
});

test('shopify graphql allowlist exists', () => {
    const block = SERVER_JS.match(/\/api\/shopify\/graphql[\s\S]{0,1500}/);
    assert.ok(block, '/api/shopify/graphql handler must exist');
    // 何らかの allowlist / whitelist のチェックがある
    assert.match(block[0], /allow|whitelist|UNAUTHORIZED|403|401/i);
});

test('error endpoint accepts errors array', () => {
    const block = SERVER_JS.match(/\/api\/error[\s\S]{0,800}/);
    assert.ok(block, '/api/error handler must exist');
    assert.match(block[0], /errors/);
});

test('grey lookup endpoint exists', () => {
    assert.match(SERVER_JS, /\/api\/grey\//);
});

test('checkout endpoint exists', () => {
    assert.match(SERVER_JS, /\/api\/checkout/);
});

// ─────────────────────────────────────────────────────────────
// runtime-fixes-2026-04-28: 5 軽微項目の修正後挙動を CI で固定
// ─────────────────────────────────────────────────────────────

test('readBody: writeHead(413) is called before req.destroy() (no empty reply)', () => {
    // readBody 関数本体を抽出してコメントを除去
    const m = SERVER_JS.match(/function readBody\([\s\S]*?\n\}/);
    assert.ok(m, 'readBody function must be findable');
    let body = m[0]
        .replace(/\/\*[\s\S]*?\*\//g, '')   // strip block comments
        .replace(/\/\/[^\n]*/g, '');         // strip line comments
    const idxWriteHead = body.indexOf('writeHead(413');
    const idxDestroy = body.indexOf('req.destroy()');
    assert.ok(idxWriteHead > 0, 'writeHead(413 must exist in readBody');
    assert.ok(idxDestroy > 0, 'req.destroy() must exist in readBody');
    assert.ok(idxWriteHead < idxDestroy,
        'writeHead(413) must come BEFORE req.destroy() so 413 reaches client');
});

test('/api/checkout: variant unmapped returns 4xx/5xx (not 200)', () => {
    const block = SERVER_JS.match(/\/api\/checkout[\s\S]{0,2500}/);
    assert.ok(block, '/api/checkout handler must exist');
    // "No Shopify variants mapped" の手前は writeHead(422) でなければならない
    const noVariantIdx = block[0].indexOf('No Shopify variants mapped');
    assert.ok(noVariantIdx > 0, 'No Shopify variants mapped path must exist');
    const before = block[0].slice(Math.max(0, noVariantIdx - 200), noVariantIdx);
    assert.match(before, /writeHead\(422/,
        'variant 未マップは 422 Unprocessable Entity を返すこと');
    // env 未設定は 503
    const envIdx = block[0].indexOf('Shopify not configured');
    if (envIdx > 0) {
        const beforeEnv = block[0].slice(Math.max(0, envIdx - 200), envIdx);
        assert.match(beforeEnv, /writeHead\(503/,
            'Shopify env 未設定は 503 を返すこと');
    }
});

test('/api/shopify/graphql: upstream 401 is remapped to 403', () => {
    const block = SERVER_JS.match(/\/api\/shopify\/graphql[\s\S]{0,4000}/);
    assert.ok(block, '/api/shopify/graphql handler must exist');
    // 401 → 403 のリマップ記述があること
    assert.match(block[0], /===\s*401[\s\S]{0,60}=\s*403/,
        'upstream 401 を 403 にリマップする記述が必要');
});

test('MIME map includes .xml (application/xml) and .txt (text/plain)', () => {
    assert.match(SERVER_JS, /'\.xml':\s*'application\/xml/,
        'sitemap.xml 用に .xml → application/xml');
    assert.match(SERVER_JS, /'\.txt':\s*'text\/plain/,
        'robots.txt 用に .txt → text/plain');
});

test('sw.js is served with short Cache-Control', () => {
    // 何らかの形で sw.js を no-cache / max-age 0..300 で配信
    assert.match(SERVER_JS, /sw\.js[\s\S]{0,500}(no-cache|max-age=0|max-age=300)/,
        'sw.js は short TTL (no-cache / max-age <=300) で配信すべき');
});

/**
 * 補足: 実動作 (起動 → curl → 停止) の検証結果は
 * docs/runtime-verification-2026-04-28.md にスナップショットされている。
 * 5 軽微項目の修正サマリは docs/runtime-fixes-2026-04-28.md。
 */
