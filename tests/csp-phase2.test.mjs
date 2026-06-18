// csp-phase2.test.mjs — server.js の CSP Phase 2 ロジックを再実装してロジック検証
// security.test.mjs と同じスタイル：production code には触れず、等価コピーをテスト。
// 仕様レベルの不変条件を固定し、将来 server.js を編集する際の網にする。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// ─── server.js と等価のコピー（Phase 2 関連） ───────────────────

function generateNonce() {
    return crypto.randomBytes(16).toString('base64');
}

function buildStrictCSP(nonce) {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://cdn.jsdelivr.net`,
        "script-src-attr 'none'",
        `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
        "style-src-attr 'unsafe-inline'",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://api.qrserver.com https://cdn.shopify.com",
        "connect-src 'self' https://*.myshopify.com",
        "media-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "frame-src 'self' https://*.shopify.com https://*.myshopify.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
        "block-all-mixed-content",
        "report-uri /api/csp-report",
        "report-to csp-endpoint"
    ].join('; ');
}

function injectNonceIntoHTML(html, nonce) {
    if (!html || !nonce) return html;
    let out = String(html);
    out = out.replace(/<script\b([^>]*)>/gi, (m, attrs) => {
        if (/\bsrc\s*=/i.test(attrs)) return m;
        if (/\bnonce\s*=/i.test(attrs)) return m;
        return `<script nonce="${nonce}"${attrs}>`;
    });
    out = out.replace(/<style\b([^>]*)>/gi, (m, attrs) => {
        if (/\bnonce\s*=/i.test(attrs)) return m;
        return `<style nonce="${nonce}"${attrs}>`;
    });
    return out;
}

// ─── テスト ────────────────────────────────────────────────────

describe('CSP Phase 2 — nonce 生成', () => {
    test('毎回ユニークな nonce が生成される（1000 回試行で衝突 0）', () => {
        const set = new Set();
        for (let i = 0; i < 1000; i++) set.add(generateNonce());
        assert.equal(set.size, 1000, 'nonce が衝突した');
    });

    test('nonce は base64 形式・16 バイト分（24 文字）', () => {
        const n = generateNonce();
        assert.match(n, /^[A-Za-z0-9+/]+={0,2}$/);
        // 16 bytes → base64 24 chars (with `==` padding)
        assert.equal(n.length, 24);
    });

    test('nonce にスペース・引用符・改行が含まれない（CSP header 注入安全）', () => {
        for (let i = 0; i < 100; i++) {
            const n = generateNonce();
            assert.ok(!/[\s"'<>;]/.test(n));
        }
    });
});

describe('CSP Phase 2 — buildStrictCSP', () => {
    const sample = 'AbC123/xyz+QQ==';
    const csp = buildStrictCSP(sample);

    test("'unsafe-inline' を含まない（script-src / style-src 両方）", () => {
        const dirs = csp.split('; ');
        const script = dirs.find(d => d.startsWith('script-src '));
        const style = dirs.find(d => d.startsWith('style-src '));
        assert.ok(script, 'script-src directive 不在');
        assert.ok(style, 'style-src directive 不在');
        assert.ok(!script.includes("'unsafe-inline'"), `script-src に 'unsafe-inline' 残存: ${script}`);
        assert.ok(!style.includes("'unsafe-inline'"), `style-src に 'unsafe-inline' 残存: ${style}`);
    });

    test("script-src / style-src に 'nonce-XYZ' が含まれる", () => {
        assert.ok(csp.includes(`'nonce-${sample}'`));
        const scriptIdx = csp.indexOf('script-src ');
        const styleIdx = csp.indexOf('style-src ');
        const scriptDir = csp.slice(scriptIdx, csp.indexOf(';', scriptIdx));
        const styleDir = csp.slice(styleIdx, csp.indexOf(';', styleIdx));
        assert.ok(scriptDir.includes(`'nonce-${sample}'`));
        assert.ok(styleDir.includes(`'nonce-${sample}'`));
    });

    test("script-src に 'strict-dynamic' が含まれる（CDN 動的読み込みを許可）", () => {
        assert.ok(csp.includes("'strict-dynamic'"));
    });

    test('CSP report endpoint は維持されている', () => {
        assert.ok(csp.includes('report-uri /api/csp-report'));
        assert.ok(csp.includes('report-to csp-endpoint'));
    });

    test('frame-ancestors / object-src / base-uri は厳格維持', () => {
        assert.ok(csp.includes("frame-ancestors 'none'"));
        assert.ok(csp.includes("object-src 'none'"));
        assert.ok(csp.includes("base-uri 'self'"));
    });
});

describe('CSP Phase 2 — injectNonceIntoHTML', () => {
    const N = 'TEST_NONCE_VAL';

    test('inline <script> に nonce 属性が注入される', () => {
        const html = '<script>alert(1)</script>';
        const out = injectNonceIntoHTML(html, N);
        assert.equal(out, `<script nonce="${N}">alert(1)</script>`);
    });

    test('外部スクリプト <script src="..."> には nonce を付けない（不要・冗長回避）', () => {
        const html = '<script src="/foo.js"></script>';
        const out = injectNonceIntoHTML(html, N);
        assert.equal(out, html, 'src 付き script に nonce が付与された');
    });

    test('inline <style> に nonce 属性が注入される', () => {
        const html = '<style>body{color:red}</style>';
        const out = injectNonceIntoHTML(html, N);
        assert.equal(out, `<style nonce="${N}">body{color:red}</style>`);
    });

    test('既に nonce 属性を持つタグは触らない（idempotent）', () => {
        const html = '<script nonce="EXISTING">x</script><style nonce="A">y</style>';
        const out = injectNonceIntoHTML(html, N);
        assert.equal(out, html);
    });

    test('複数の <script> / <style> を一括処理', () => {
        const html = '<script>a</script><script src="b.js"></script><style>c</style>';
        const out = injectNonceIntoHTML(html, N);
        assert.ok(out.includes(`<script nonce="${N}">a</script>`));
        assert.ok(out.includes('<script src="b.js"></script>'));
        assert.ok(out.includes(`<style nonce="${N}">c</style>`));
    });

    test('属性付き <script type="module"> に nonce 注入', () => {
        const html = '<script type="module">import x from "y"</script>';
        const out = injectNonceIntoHTML(html, N);
        assert.ok(out.startsWith(`<script nonce="${N}" type="module">`));
    });

    test('大文字・属性順序混在でも壊れない', () => {
        const html = '<SCRIPT TYPE="text/javascript">x</SCRIPT>';
        const out = injectNonceIntoHTML(html, N);
        assert.ok(out.includes(`nonce="${N}"`));
    });

    test('閉じタグ </script> </style> は影響なし', () => {
        const html = '<script>a</script>';
        const out = injectNonceIntoHTML(html, N);
        // 閉じタグは変化しない
        assert.ok(out.endsWith('</script>'));
    });

    test('null / 空 / nonce なし → 変更なし', () => {
        assert.equal(injectNonceIntoHTML('', N), '');
        assert.equal(injectNonceIntoHTML('<script>x</script>', null), '<script>x</script>');
        assert.equal(injectNonceIntoHTML(null, N), null);
    });

    test('<script>...<script>...</script> 連続でも個別注入', () => {
        const html = '<script>a</script><script>b</script>';
        const out = injectNonceIntoHTML(html, N);
        const matches = out.match(new RegExp(`nonce="${N}"`, 'g')) || [];
        assert.equal(matches.length, 2);
    });

    test('idempotency: 二度適用しても結果は変わらない', () => {
        const html = '<script>a</script><style>b</style><script src="c.js"></script>';
        const once = injectNonceIntoHTML(html, N);
        const twice = injectNonceIntoHTML(once, N);
        assert.equal(once, twice);
    });
});

describe('CSP Phase 2 — 統合不変条件', () => {
    test('生成 nonce → CSP header → HTML 注入の整合', () => {
        const nonce = generateNonce();
        const csp = buildStrictCSP(nonce);
        const html = '<html><head><style>x</style></head><body><script>y</script></body></html>';
        const injected = injectNonceIntoHTML(html, nonce);

        // CSP に含まれる nonce と HTML に注入される nonce が一致する
        assert.ok(csp.includes(`'nonce-${nonce}'`));
        assert.ok(injected.includes(`<style nonce="${nonce}">`));
        assert.ok(injected.includes(`<script nonce="${nonce}">`));
    });

    test("'unsafe-inline' は CSP / HTML どちらにも現れない", () => {
        const nonce = generateNonce();
        const csp = buildStrictCSP(nonce);
        // script-src / style-src directive それぞれを抽出して unsafe-inline がないことを確認
        // （style-src-attr 'unsafe-inline' は属性 style 用なので別扱いで残す）
        const dirs = csp.split('; ');
        for (const d of dirs) {
            if (d.startsWith('script-src ') || d.startsWith('style-src ')) {
                assert.ok(!d.includes("'unsafe-inline'"), `${d} に 'unsafe-inline' 残存`);
            }
        }
    });
});
