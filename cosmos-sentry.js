/**
 * cosmos-sentry.js
 * inryokü 本番エラー追跡 (Sentry browser SDK スタブ)
 *
 * 使い方:
 *   <script src="https://browser.sentry-cdn.com/8.40.0/bundle.min.js"
 *           integrity="sha384-..." crossorigin="anonymous"></script>
 *   <script src="/cosmos-sentry.js" data-dsn="https://YOUR_DSN@oXXX.ingest.sentry.io/YYY"></script>
 *
 * SRI / DSN は環境変数 or data-* 属性経由。production だけ起動 (dev/localhost はスキップ)。
 * シェーダー compile error / WebGL context lost / unhandled rejection を自動補足。
 *
 * @ts-check
 */
(function () {
    'use strict';

    if (typeof location === 'undefined') return;
    var loc = /** @type {Location} */ (location);
    var isLocal = /^(localhost|127\.|0\.0\.0\.0|192\.168\.)/i.test(loc.hostname);
    var isDev = /[\?&]dev=1/.test(loc.search || '');

    if (isLocal || isDev) {
        // ローカル / dev では Sentry を起動しない (ノイズ防止)
        if (typeof console !== 'undefined') {
            console.info('[cosmos-sentry] skipped (local/dev)');
        }
        return;
    }
    if (typeof window === 'undefined' || !window.Sentry) {
        // SDK 未ロード時はサイレント
        return;
    }

    var scriptEl = document.currentScript;
    var dsn = (scriptEl && scriptEl.dataset && scriptEl.dataset.dsn) || window.__INRYOKU_SENTRY_DSN__ || '';

    if (!dsn) {
        return;
    }

    try {
        window.Sentry.init({
            dsn: dsn,
            // パフォーマンス計測 5% サンプリング
            tracesSampleRate: 0.05,
            // session replay は OFF (プライバシー優先)
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 0,
            // 環境タグ
            environment: (window.__INRYOKU_ENV__ || 'production'),
            release: (window.__INRYOKU_RELEASE__ || 'unknown'),
            // 除外: ブラウザ拡張由来 / network error / cancelled
            ignoreErrors: [
                'ResizeObserver loop',
                'Non-Error promise rejection',
                'NetworkError',
                'cancelled',
                'AbortError'
            ],
            beforeSend: function (event) {
                // PII を絶対送らない (URL に email 等含まれてた場合の防御)
                try {
                    if (event.request && event.request.url) {
                        event.request.url = event.request.url.replace(/[?&](token|email|key)=[^&]+/gi, '$1=REDACTED');
                    }
                } catch (_) {}
                return event;
            }
        });

        // WebGL context lost を手動補足
        window.addEventListener('webglcontextlost', function (e) {
            try {
                window.Sentry.captureMessage('webglcontextlost', {
                    level: 'warning',
                    extra: {
                        canvas: e.target && e.target.id,
                        ua: navigator.userAgent
                    }
                });
            } catch (_) {}
        }, true);

        // Long Animation Frame (INP の根本原因)
        if (typeof PerformanceObserver === 'function') {
            try {
                var po = new PerformanceObserver(function (list) {
                    list.getEntries().forEach(function (entry) {
                        if (entry.duration > 200) {
                            window.Sentry.captureMessage('long-animation-frame', {
                                level: 'info',
                                extra: { duration: entry.duration, ts: entry.startTime }
                            });
                        }
                    });
                });
                po.observe({ entryTypes: ['long-animation-frame'] });
            } catch (_) {}
        }
    } catch (err) {
        // Sentry 初期化失敗時は無視 (アプリ本体は止めない)
        if (typeof console !== 'undefined') {
            console.warn('[cosmos-sentry] init failed', err);
        }
    }
})();
