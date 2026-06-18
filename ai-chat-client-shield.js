/* ──────────────────────────────────────────────────────────────────────────
 *  ai-chat-client-shield.js — inryokü AI チャット クライアント側 shield
 *  2026-04-28
 *
 *  目的:
 *    サーバ /api/chat が返す `role: "system"` + `fallback: true` 応答を
 *    クライアント側で正しく扱う。p3_code_for_claude.js（hot file = 直接編集禁止）
 *    に触らずに、fetch をプロキシしてメタ情報を露出する。
 *
 *  契約 (docs/ai-chat-reliability-2026-04-28.md):
 *    成功:   { response, fallback:false, role:"assistant", meta:{ latencyMs } }
 *    失敗:   { response, fallback:true,  role:"system",   kind, meta:{...} }
 *
 *  非破壊原則:
 *    - /api/chat 以外の fetch は素通し
 *    - レスポンス body は clone して読む（消費しない）
 *    - p3_code_for_claude.js が history に append した後、メタを残すだけ
 *    - 重複起動防止フラグあり (window.__inryokuChatShield)
 *
 *  公開 API: window.inryokuChatShield
 *    - onFallback(cb): fallback 検知時のコールバック登録（unsubscribe 関数を返す）
 *    - stats(): { totalRequests, fallbackCount, byKind, lastFallbackAt, consecutive }
 *    - reset(): カウンタを 0 に
 *    - shouldAppendToHistory(payload): payload を履歴 push してよいか真偽
 *    - _internal: テスト用フック
 *
 *  依存: なし。error-shield.js があれば toast 連携。
 * ────────────────────────────────────────────────────────────────────────── */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        // Node テスト用
        module.exports = api;
    }
    if (typeof root !== 'undefined' && root && root.document) {
        // ブラウザ: 自動 install
        if (root.__inryokuChatShield) return;
        root.__inryokuChatShield = true;
        var shield = api.install(root);
        root.inryokuChatShield = shield;
    }
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    var LS_KEY = 'inryoku.chat.shield.stats';
    var CHAT_ENDPOINT_RE = /\/api\/chat(\?|$)/;
    var CONSECUTIVE_TOAST_THRESHOLD = 3;

    // fallback kind → ブランド調 toast 文言（控えめ）
    var TOAST_BY_KIND = {
        network:     { text: 'the connection is grey.',      sub: '波が遠い。少し待つ。' },
        timeout:     { text: 'the wave is slow.',            sub: '波が遅い。少し待つ。' },
        server_5xx:  { text: 'the apparatus paused.',        sub: '装置が一瞬眠った。' },
        client_4xx:  { text: 'the wave shifted.',            sub: '言い換えてみる。' },
        rate_limit:  { text: '観測する者は、息を整える',     sub: 'rate limit。少し待つ。' },
        parse_error: { text: 'noise in the signal.',         sub: '信号にノイズ。再試行を。' },
        unknown:     { text: 'the wave is slow.',            sub: '波が揺れた。' },
        no_key:      { text: 'the wave is slow.',            sub: '波が揺れた。' }
    };

    // ── 純粋関数 ────────────────────────────────────────────

    /**
     * payload が fallback (system/fallback:true) ならその情報を返す。
     * 形が違う / 通常応答なら null。
     */
    function detectFallback(payload) {
        if (!payload || typeof payload !== 'object') return null;
        if (payload.fallback !== true) return null;
        // role:"system" を厳格に要求（後方互換が必要なら緩めるが、現契約では要求）
        if (payload.role !== 'system') return null;
        return {
            isFallback: true,
            role: 'system',
            kind: typeof payload.kind === 'string' ? payload.kind : 'unknown',
            response: typeof payload.response === 'string' ? payload.response : '',
            meta: payload.meta || null
        };
    }

    /**
     * 履歴 (assistant ロール) に push してよいか。
     * fallback (role:system) なら false。
     */
    function shouldAppendToHistory(payload) {
        if (!payload || typeof payload !== 'object') return true;
        if (payload.fallback === true) return false;
        if (payload.role === 'system') return false;
        return true;
    }

    function makeStats() {
        return {
            totalRequests: 0,
            fallbackCount: 0,
            successCount: 0,
            byKind: Object.create(null),
            lastFallbackAt: null,
            lastKind: null,
            consecutive: 0
        };
    }

    function recordSuccess(stats) {
        stats.totalRequests++;
        stats.successCount++;
        stats.consecutive = 0;
    }

    function recordFallback(stats, kind, ts) {
        stats.totalRequests++;
        stats.fallbackCount++;
        stats.consecutive++;
        stats.lastFallbackAt = ts;
        stats.lastKind = kind;
        var k = kind || 'unknown';
        stats.byKind[k] = (stats.byKind[k] || 0) + 1;
    }

    // ── ブラウザ install ───────────────────────────────────

    function install(win) {
        var doc = win.document;
        var origFetch = win.fetch ? win.fetch.bind(win) : null;

        // localStorage 永続化（best-effort）
        var lsAvailable = false;
        try {
            win.localStorage.setItem('__irk_cs_test__', '1');
            win.localStorage.removeItem('__irk_cs_test__');
            lsAvailable = true;
        } catch (e) { lsAvailable = false; }

        var stats = makeStats();
        if (lsAvailable) {
            try {
                var raw = win.localStorage.getItem(LS_KEY);
                if (raw) {
                    var prev = JSON.parse(raw);
                    if (prev && typeof prev === 'object') {
                        // counters は引き継ぐが consecutive はリセット（セッション越境で連続性が崩れるため）
                        stats.totalRequests = prev.totalRequests | 0;
                        stats.fallbackCount = prev.fallbackCount | 0;
                        stats.successCount  = prev.successCount  | 0;
                        stats.byKind = (prev.byKind && typeof prev.byKind === 'object') ? prev.byKind : Object.create(null);
                        stats.lastFallbackAt = prev.lastFallbackAt || null;
                        stats.lastKind = prev.lastKind || null;
                        stats.consecutive = 0;
                    }
                }
            } catch (e) {}
        }

        function persist() {
            if (!lsAvailable) return;
            try {
                win.localStorage.setItem(LS_KEY, JSON.stringify({
                    totalRequests: stats.totalRequests,
                    fallbackCount: stats.fallbackCount,
                    successCount: stats.successCount,
                    byKind: stats.byKind,
                    lastFallbackAt: stats.lastFallbackAt,
                    lastKind: stats.lastKind
                }));
            } catch (e) {}
        }

        var listeners = [];
        function emitFallback(info) {
            for (var i = 0; i < listeners.length; i++) {
                try { listeners[i](info); } catch (e) {
                    try { console.warn('[chat-shield] listener threw', e); } catch (_) {}
                }
            }
        }

        function showToastIfPossible(info) {
            var es = win.inryokuShield;
            if (!es || typeof es.toast !== 'function') return;
            var t = TOAST_BY_KIND[info.kind] || TOAST_BY_KIND.unknown;
            // 連続失敗が閾値を超えたらメッセージを強める
            var sub = t.sub;
            if (stats.consecutive >= CONSECUTIVE_TOAST_THRESHOLD) {
                sub = '波が続けて揺れている。少し休んで観測を。';
            }
            try {
                es.toast({
                    text: t.text,
                    subtext: sub,
                    role: 'status',
                    ttl: 4500
                });
            } catch (e) {}
        }

        function isChatRequest(input, init) {
            try {
                var url = '';
                if (typeof input === 'string') url = input;
                else if (input && typeof input.url === 'string') url = input.url;
                else if (input && typeof input.toString === 'function') url = input.toString();
                if (!url) return false;
                if (!CHAT_ENDPOINT_RE.test(url)) return false;
                // method check (default GET — chat は POST のみ)
                var method = (init && init.method) ||
                             (input && input.method) || 'GET';
                return String(method).toUpperCase() === 'POST';
            } catch (e) { return false; }
        }

        async function processResponse(res) {
            // clone して JSON 試行（消費しない）
            if (!res || typeof res.clone !== 'function') return;
            var clone;
            try { clone = res.clone(); } catch (e) { return; }
            var data;
            try {
                var ctype = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
                if (ctype.indexOf('application/json') === -1) return;
                data = await clone.json();
            } catch (e) { return; }

            var info = detectFallback(data);
            var ts = Date.now();
            if (info) {
                recordFallback(stats, info.kind, ts);
                persist();
                showToastIfPossible(info);
                emitFallback(info);
            } else if (data && (data.role === 'assistant' || data.fallback === false)) {
                recordSuccess(stats);
                persist();
            }
            // それ以外（不明形式 / エラーレスポンス）は計測しない
        }

        function wrappedFetch(input, init) {
            if (!origFetch) {
                throw new Error('fetch is not available');
            }
            if (!isChatRequest(input, init)) {
                return origFetch(input, init);
            }
            var p = origFetch(input, init);
            // 後処理は副作用のみ。元の Promise はそのまま返す。
            p.then(function (res) {
                // ok 以外でも fallback で 200 を返すサーバ仕様なので解釈する
                processResponse(res);
                return res;
            }).catch(function () {
                // fetch 自体が失敗したら shield は何もしない（error-shield が拾う）
            });
            return p;
        }

        // ── fetch override ──
        if (origFetch) {
            try {
                win.fetch = wrappedFetch;
            } catch (e) {
                try { console.warn('[chat-shield] cannot override fetch', e); } catch (_) {}
            }
        }

        // 公開 API
        var apiSurface = {
            onFallback: function (cb) {
                if (typeof cb !== 'function') return function () {};
                listeners.push(cb);
                return function unsubscribe() {
                    var i = listeners.indexOf(cb);
                    if (i >= 0) listeners.splice(i, 1);
                };
            },
            stats: function () {
                // shallow clone
                var out = {
                    totalRequests: stats.totalRequests,
                    fallbackCount: stats.fallbackCount,
                    successCount: stats.successCount,
                    byKind: Object.assign({}, stats.byKind),
                    lastFallbackAt: stats.lastFallbackAt,
                    lastKind: stats.lastKind,
                    consecutive: stats.consecutive
                };
                return out;
            },
            reset: function () {
                stats = makeStats();
                if (lsAvailable) {
                    try { win.localStorage.removeItem(LS_KEY); } catch (e) {}
                }
            },
            shouldAppendToHistory: shouldAppendToHistory,
            detectFallback: detectFallback,
            // 内部フック（テスト用）
            _internal: {
                processResponse: processResponse,
                isChatRequest: isChatRequest,
                wrappedFetch: wrappedFetch
            }
        };

        try { console.info('[chat-shield] active'); } catch (e) {}

        return apiSurface;
    }

    return {
        install: install,
        // Node テスト用ピュア関数 export
        detectFallback: detectFallback,
        shouldAppendToHistory: shouldAppendToHistory,
        makeStats: makeStats,
        recordSuccess: recordSuccess,
        recordFallback: recordFallback,
        TOAST_BY_KIND: TOAST_BY_KIND,
        CHAT_ENDPOINT_RE: CHAT_ENDPOINT_RE
    };
}));
