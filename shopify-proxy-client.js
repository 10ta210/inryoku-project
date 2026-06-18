// ═══════════════════════════════════════════════════════════════
//  shopify-proxy-client.js — Storefront token を持たない GraphQL クライアント
//  サーバ側 /api/shopify/graphql に中継させる。クライアントから token を完全削除するための準備層。
//
//  公開 API:
//    window.shopifyFetchProxy(query, variables, options)
//      → Promise<{ data, errors }>  // Shopify GraphQL の生レスポンス互換
//
//  使い方（p3_code_for_claude.js 側で将来切替する想定）:
//    // 旧:
//    //   shopifyFetch(query, variables).then(...)
//    // 新:
//    //   window.shopifyFetchProxy(query, variables).then(...)
//    // 既存 shopifyFetch とは別関数として共存させる（段階移行のため）。
//
//  エラーハンドリング:
//    - offline:           { networkError: true }   を reject
//    - 4xx (whitelist 外): { status: 403, error: 'operation not allowed', reason }
//    - 5xx:               { status: 5xx, error: ... }
//    - 200 + GraphQL errors: そのまま resolve（呼び出し側で data.errors を見る）
//
//  注意:
//    - p3_code_for_claude.js は触らない（Codex hot file）。本ファイルは独立 JS として読み込む想定。
//    - 既存 shopifyFetch を破壊しない（共存）。
//    - Storefront token を持たないので CSP の connect-src に shopify ドメインは不要（self のみで足りる）。
// ═══════════════════════════════════════════════════════════════

(function (global) {
    'use strict';

    var ENDPOINT = '/api/shopify/graphql';
    var DEFAULT_TIMEOUT_MS = 15000;
    var MIN_TIMEOUT_MS = 1000;
    var MAX_TIMEOUT_MS = 30000;
    var MAX_QUERY_LEN = 16 * 1024;
    var MAX_VARIABLES_JSON_LEN = 32 * 1024;

    function clampTimeoutMs(value) {
        var n = Number(value);
        if (!isFinite(n)) return DEFAULT_TIMEOUT_MS;
        n = Math.floor(n);
        if (n < MIN_TIMEOUT_MS) return MIN_TIMEOUT_MS;
        if (n > MAX_TIMEOUT_MS) return MAX_TIMEOUT_MS;
        return n;
    }

    function shopifyFetchProxy(query, variables, options) {
        options = options || {};
        var timeoutMs = clampTimeoutMs(options.timeoutMs);
        var operationName = options.operationName || null;

        if (typeof query !== 'string' || query.length === 0) {
            return Promise.reject(new Error('shopifyFetchProxy: query is required'));
        }
        if (query.length > MAX_QUERY_LEN) {
            return Promise.reject(new Error('shopifyFetchProxy: query too large'));
        }
        if (variables != null && (typeof variables !== 'object' || Array.isArray(variables))) {
            return Promise.reject(new Error('shopifyFetchProxy: variables must be an object'));
        }

        // AbortController でタイムアウト
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timeoutId = null;
        if (controller) {
            timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);
        }

        var payload = {
            query: query,
            variables: variables || {},
            operationName: operationName || undefined
        };
        var body = JSON.stringify(payload);
        if (body.length > MAX_VARIABLES_JSON_LEN + MAX_QUERY_LEN) {
            return Promise.reject(new Error('shopifyFetchProxy: payload too large'));
        }

        return fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            credentials: 'same-origin',
            signal: controller ? controller.signal : undefined
        }).then(function (res) {
            if (timeoutId) clearTimeout(timeoutId);
            // ステータス別ハンドリング
            return res.text().then(function (text) {
                var data;
                try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { error: 'invalid JSON', raw: text }; }
                if (!res.ok) {
                    var err = new Error('shopify proxy error: ' + res.status);
                    err.status = res.status;
                    err.payload = data;
                    err.proxy = true;
                    throw err;
                }
                return data;
            });
        }, function (err) {
            if (timeoutId) clearTimeout(timeoutId);
            // ネットワークエラー / abort
            var isTimeout = !!(err && (err.name === 'AbortError' || /abort/i.test(err.message || '')));
            var wrapped = new Error(
                isTimeout
                    ? 'shopify proxy timeout'
                    : 'shopify proxy network error: ' + (err && err.message ? err.message : String(err))
            );
            wrapped.networkError = true;
            if (isTimeout) wrapped.timeout = true;
            wrapped.cause = err;
            throw wrapped;
        });
    }

    // ヘルパ: cartCreate のショートカット（移行期に shopifyCheckout 互換用）
    function cartCreateViaProxy(lines, attributes) {
        var query =
            'mutation cartCreate($input: CartInput!) {' +
            '  cartCreate(input: $input) {' +
            '    cart { id checkoutUrl }' +
            '    userErrors { field message }' +
            '  }' +
            '}';
        return shopifyFetchProxy(query, {
            input: {
                lines: lines,
                attributes: attributes || [{ key: 'source', value: 'inryoku-p3' }]
            }
        }, { operationName: 'cartCreate' }).then(function (data) {
            var cart = data && data.data && data.data.cartCreate && data.data.cartCreate.cart;
            if (cart && cart.checkoutUrl) return cart.checkoutUrl;
            var errors = data && data.data && data.data.cartCreate && data.data.cartCreate.userErrors;
            throw new Error(errors && errors.length ? errors[0].message : 'Cart creation failed');
        });
    }

    global.shopifyFetchProxy = shopifyFetchProxy;
    global.cartCreateViaProxy = cartCreateViaProxy;

})(typeof window !== 'undefined' ? window : this);
