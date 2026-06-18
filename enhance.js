/*!
 * enhance.js — inryokü a11y + browser compat enhancement layer
 * Created: 2026-04-28
 *
 * 責務:
 *   - 既存の DOM / スクリプトには触らず、後付けで a11y / 互換性を補強する
 *   - 監査ドキュメント:
 *       docs/accessibility-audit-2026-04-28.md (Critical 8 / Major 14)
 *       docs/browser-compatibility-matrix-2026-04-28.md (I-1〜I-20)
 *
 * 設計原則:
 *   - vanilla JS のみ (ライブラリ追加禁止)
 *   - 既存機能 (カルーセル / カート / フォーム / チャット) を破壊しない
 *   - 動的に DOM が生成される (`renderPhase3` 後) ため MutationObserver 監視
 *   - 各処理に `// a11y-2026-04-28:` `// compat-2026-04-28:` コメント根拠
 *   - 例外で他処理を巻き込まないよう各機能を try/catch で隔離
 */
(function () {
    'use strict';

    // 二重ロード防止
    if (window.__inryokuEnhanceLoaded) return;
    window.__inryokuEnhanceLoaded = true;

    var DEBUG = false;
    function log() {
        if (!DEBUG) return;
        try { console.log.apply(console, ['[enhance]'].concat([].slice.call(arguments))); } catch (e) {}
    }
    function safe(fn, label) {
        try { fn(); } catch (e) {
            try { console.warn('[enhance] failure in ' + (label || 'anon'), e); } catch (_) {}
        }
    }

    // ────────────────────────────────────────────────────────
    // 0. polyfill / fallback (古ブラウザ向け)
    // ────────────────────────────────────────────────────────

    // compat-2026-04-28: structuredClone の fallback (iOS 15.3 以下)
    // a11y には直接関係しないが、p3_code 内で使う可能性があるため共通フォールバック
    if (typeof window.structuredClone !== 'function') {
        window.structuredClone = function (obj) {
            // 簡易版: JSON シリアライズで replicable な値のみ対応
            try { return JSON.parse(JSON.stringify(obj)); }
            catch (e) { return obj; }
        };
    }

    // compat-2026-04-28: ResizeObserver の存在確認 (なければ no-op shim)
    // particle_speech_rings.js が依存 — モダンブラウザでは存在するが念のため
    if (typeof window.ResizeObserver !== 'function') {
        log('ResizeObserver missing → installing no-op shim');
        window.ResizeObserver = function (cb) {
            this._cb = cb;
            this._timer = null;
            var self = this;
            this._poll = function () {
                try { self._cb([]); } catch (e) {}
            };
            this.observe = function () {
                // window resize で代替トリガ
                if (!self._bound) {
                    self._bound = true;
                    window.addEventListener('resize', self._poll);
                }
            };
            this.unobserve = function () {};
            this.disconnect = function () {
                if (self._bound) {
                    window.removeEventListener('resize', self._poll);
                    self._bound = false;
                }
            };
        };
    }

    // ────────────────────────────────────────────────────────
    // 1. document の言語設定 / reduced-motion フラグ
    //    a11y-2026-04-28: WCAG 2.3.3 — html クラスとして OS 設定を露出
    // ────────────────────────────────────────────────────────
    safe(function () {
        var mql = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        function applyMotion() {
            if (mql && mql.matches) {
                document.documentElement.classList.add('enh-reduce-motion');
            } else {
                document.documentElement.classList.remove('enh-reduce-motion');
            }
        }
        applyMotion();
        if (mql) {
            // change listener (古い Safari 用 fallback)
            if (typeof mql.addEventListener === 'function') {
                mql.addEventListener('change', applyMotion);
            } else if (typeof mql.addListener === 'function') {
                mql.addListener(applyMotion);
            }
        }
    }, 'reduced-motion');

    // ────────────────────────────────────────────────────────
    // 2. 100vh フォールバック — `--enh-vh` を CSS 変数に注入
    //    compat-2026-04-28: Issue I-3 — iOS URL バー伸縮対応
    //    既存 CSS は触らないので、追加 CSS (.enh-full-height) でのみ利用
    // ────────────────────────────────────────────────────────
    safe(function () {
        function setVh() {
            var vv = window.visualViewport;
            var h = vv ? vv.height : window.innerHeight;
            document.documentElement.style.setProperty('--enh-vh', (h * 0.01) + 'px');
        }
        setVh();
        window.addEventListener('resize', setVh, { passive: true });
        window.addEventListener('orientationchange', setVh, { passive: true });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', setVh);
            window.visualViewport.addEventListener('scroll', setVh);
        }
    }, 'vh-fallback');

    // ────────────────────────────────────────────────────────
    // 3. visualViewport API による chat input の追従
    //    compat-2026-04-28: Issue I-19 — iOS 仮想キーボードで fixed 要素が隠れる対策
    //    `--enh-kb-bottom` を CSS 変数として供給 / 該当要素に `.enh-vv-tracked` を付与
    // ────────────────────────────────────────────────────────
    safe(function () {
        if (!window.visualViewport) return;
        function track() {
            var vv = window.visualViewport;
            // キーボードが出ている時は layout viewport の下部からキーボード高さ分浮かせる
            var kb = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop));
            document.documentElement.style.setProperty('--enh-kb-bottom', kb + 'px');
        }
        track();
        window.visualViewport.addEventListener('resize', track);
        window.visualViewport.addEventListener('scroll', track);
    }, 'vv-tracking');

    // ────────────────────────────────────────────────────────
    // 4. AudioContext 一括 resume ヘルパ
    //    compat-2026-04-28: Issue I-1, I-5 — ユーザージェスチャ時に複数 ctx を resume
    //    p3_code_for_claude.js が公開している ctx 群を「あれば」resume する
    // ────────────────────────────────────────────────────────
    safe(function () {
        var CTX_KEYS = [
            'p3AudioCtx', '_brandSFCtx', '_particleSpeakCtx',
            'famicomACtx', 'audioContext', '_inryokuAudioCtx'
        ];
        function resumeAll() {
            for (var i = 0; i < CTX_KEYS.length; i++) {
                var ctx = window[CTX_KEYS[i]];
                if (ctx && typeof ctx.resume === 'function' && ctx.state === 'suspended') {
                    try { ctx.resume(); } catch (e) {}
                }
            }
            // BGM 再生補助
            if (window._p6bgm && typeof window._p6bgm.play === 'function') {
                try {
                    var pr = window._p6bgm.play();
                    if (pr && pr.catch) pr.catch(function () {});
                } catch (e) {}
            }
        }
        // expose for debugging
        window.__enhResumeAudio = resumeAll;

        var fired = false;
        function kick() {
            if (fired) return;
            fired = true;
            resumeAll();
            // iOS DeviceOrientation permission を同じユーザージェスチャで要求
            requestDeviceOrientation();
        }
        // capture フェーズで先取り (既存の once ハンドラと衝突しないよう非破壊)
        document.addEventListener('click', kick, true);
        document.addEventListener('touchstart', kick, true);
        document.addEventListener('keydown', kick, true);
        document.addEventListener('pointerdown', kick, true);
    }, 'audio-resume');

    // ────────────────────────────────────────────────────────
    // 5. iOS DeviceOrientation permission ガード
    //    compat-2026-04-28: Issue I-7 — iOS 13+ 必須
    // ────────────────────────────────────────────────────────
    var _orientationRequested = false;
    function requestDeviceOrientation() {
        if (_orientationRequested) return;
        _orientationRequested = true;
        try {
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission().then(function (state) {
                    log('DeviceOrientation permission:', state);
                }).catch(function (err) {
                    log('DeviceOrientation permission denied:', err);
                });
            }
            if (typeof DeviceMotionEvent !== 'undefined' &&
                typeof DeviceMotionEvent.requestPermission === 'function') {
                DeviceMotionEvent.requestPermission().then(function () {}).catch(function () {});
            }
        } catch (e) {
            log('DeviceOrientation request error:', e);
        }
    }

    // ────────────────────────────────────────────────────────
    // 6. ランドマーク・skip link・h1 注入
    //    a11y-2026-04-28: WCAG 1.3.1 / 2.4.1 / 2.4.6
    // ────────────────────────────────────────────────────────
    function injectLandmarks() {
        var doc = document;
        var body = doc.body;
        if (!body) return;

        // skip link
        if (!doc.getElementById('enh-skip-link')) {
            var skip = doc.createElement('a');
            skip.id = 'enh-skip-link';
            skip.className = 'enh-skip-link';
            skip.href = '#enh-main';
            skip.textContent = 'メインコンテンツへスキップ';
            // focus 時に main 要素にフォーカス移動できるよう preventDefault は行わない
            body.insertBefore(skip, body.firstChild);
        }

        // root 要素を `<main>` 化できない (既存 div) ので role="main" を後付け
        var root = doc.getElementById('root');
        if (root) {
            if (!root.hasAttribute('role')) root.setAttribute('role', 'main');
            if (!root.id || root.id !== 'enh-main') {
                // 既存 id="root" は保持しつつ skip 先として利用するため id="enh-main" を持つ wrapper を兼ねる
                // 1 要素に 1 id しか付けられないため、内部に target 用 anchor を入れる
                if (!doc.getElementById('enh-main')) {
                    var anchor = doc.createElement('span');
                    anchor.id = 'enh-main';
                    anchor.tabIndex = -1;
                    anchor.className = 'enh-sr-only';
                    anchor.textContent = 'メインコンテンツ';
                    root.insertBefore(anchor, root.firstChild);
                }
            }
            if (!root.getAttribute('aria-label')) {
                root.setAttribute('aria-label', 'inryokü メインコンテンツ');
            }
        }

        // <h1> がページに無い場合、sr-only で挿入
        if (!doc.querySelector('h1')) {
            var h1 = doc.createElement('h1');
            h1.className = 'enh-sr-only';
            h1.textContent = 'inryokü';
            // body 直下の最初に
            (root || body).insertBefore(h1, (root || body).firstChild);
        }

        // <html lang> が未設定なら ja を付ける
        if (!doc.documentElement.getAttribute('lang')) {
            doc.documentElement.setAttribute('lang', 'ja');
        }
    }

    // ────────────────────────────────────────────────────────
    // 7. グローバル aria-live 領域 (toast / chat / cart 通知の集約先)
    //    a11y-2026-04-28: WCAG 4.1.3 — DOM 動的更新の SR 通知
    // ────────────────────────────────────────────────────────
    function injectLiveRegions() {
        if (!document.getElementById('enh-live-polite')) {
            var p = document.createElement('div');
            p.id = 'enh-live-polite';
            p.className = 'enh-live-region';
            p.setAttribute('role', 'status');
            p.setAttribute('aria-live', 'polite');
            p.setAttribute('aria-atomic', 'true');
            document.body.appendChild(p);
        }
        if (!document.getElementById('enh-live-assertive')) {
            var a = document.createElement('div');
            a.id = 'enh-live-assertive';
            a.className = 'enh-live-region';
            a.setAttribute('role', 'alert');
            a.setAttribute('aria-live', 'assertive');
            a.setAttribute('aria-atomic', 'true');
            document.body.appendChild(a);
        }
        // 公開 API: window.__enhAnnounce(text, opts)
        window.__enhAnnounce = function (text, opts) {
            opts = opts || {};
            var id = opts.assertive ? 'enh-live-assertive' : 'enh-live-polite';
            var el = document.getElementById(id);
            if (!el) return;
            // 同一テキスト連続でも通知されるようリセット
            el.textContent = '';
            setTimeout(function () { el.textContent = String(text || ''); }, 30);
        };
    }

    // ────────────────────────────────────────────────────────
    // 8. div ベースの clickable に role / tabindex / Enter+Space を後付け
    //    a11y-2026-04-28: WCAG 2.1.1 / 4.1.2
    // ────────────────────────────────────────────────────────
    var ENHANCE_BUTTONS_SELECTORS = [
        '#cart-icon',
        '#mute-btn',
        '.contact-toggle',
        '.size-guide-toggle',
        '.footer-toggle',
        '.carousel-item',
        '.cart-item-remove',
        '.cart-drawer-close',
        '.product-close-btn',
        '#pm-close',
        '.modal-overlay',
        '.cart-drawer-overlay'
    ];

    function enhanceClickable(el, opts) {
        if (!el || el.__enhEnhanced) return;
        el.__enhEnhanced = true;
        opts = opts || {};

        // 既に <button> や <a> ならスキップ
        var tag = (el.tagName || '').toLowerCase();
        var alreadyButton = (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button');

        if (!alreadyButton) {
            el.setAttribute('role', 'button');
        }
        if (!el.hasAttribute('tabindex') && tag !== 'button' && tag !== 'a') {
            el.tabIndex = 0;
        }

        // aria-label 補完 (テキストが無い、または記号のみのとき)
        if (!el.hasAttribute('aria-label') && opts.label) {
            var txt = (el.textContent || '').trim();
            if (!txt || /^[✕×✗ⓘ]+$/.test(txt)) {
                el.setAttribute('aria-label', opts.label);
            }
        }

        // Enter / Space → click 委譲
        if (!el.__enhKeyBound) {
            el.__enhKeyBound = true;
            el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    // ネイティブ click を発火 (既存ハンドラがそのまま反応する)
                    if (typeof el.click === 'function') {
                        el.click();
                    } else {
                        var ev = document.createEvent('MouseEvents');
                        ev.initEvent('click', true, true);
                        el.dispatchEvent(ev);
                    }
                }
            });
        }
    }

    function enhanceAllClickables() {
        // 個別ラベルマップ
        var labelMap = {
            '#cart-icon': 'カートを開く',
            '#mute-btn': 'BGM ミュート切替',
            '.contact-toggle': 'お問い合わせフォームを開閉',
            '.size-guide-toggle': 'サイズガイドを開閉',
            '.footer-toggle': 'サイト情報を開閉',
            '.cart-item-remove': 'この商品をカートから削除',
            '.cart-drawer-close': 'カートを閉じる',
            '.product-close-btn': '商品詳細を閉じる',
            '#pm-close': '商品詳細を閉じる',
            '.modal-overlay': 'モーダルを閉じる',
            '.cart-drawer-overlay': 'カートを閉じる'
        };

        ENHANCE_BUTTONS_SELECTORS.forEach(function (sel) {
            var nodes = document.querySelectorAll(sel);
            for (var i = 0; i < nodes.length; i++) {
                enhanceClickable(nodes[i], { label: labelMap[sel] });
            }
        });

        // カルーセル商品カード — 個別の name を data-* から推定
        var carousel = document.querySelectorAll('.carousel-item');
        for (var j = 0; j < carousel.length; j++) {
            var c = carousel[j];
            if (!c.hasAttribute('aria-label')) {
                var title = c.querySelector('.product-name, .product-title, .product-label');
                var price = c.querySelector('.product-price');
                var lbl = (title ? title.textContent.trim() : '商品') +
                          (price ? ' ' + price.textContent.trim() : '') +
                          ' の詳細を開く';
                c.setAttribute('aria-label', lbl);
            }
        }
    }

    // ────────────────────────────────────────────────────────
    // 9. SVG アイコンに role="img" / aria-hidden 補完
    //    a11y-2026-04-28: WCAG 1.1.1 / 4.1.2
    // ────────────────────────────────────────────────────────
    function enhanceSVGs() {
        var svgs = document.querySelectorAll('svg');
        for (var i = 0; i < svgs.length; i++) {
            var s = svgs[i];
            if (s.__enhProcessed) continue;
            s.__enhProcessed = true;

            // 親が button 化済 / aria-label 持ちなら、SVG は装飾扱い
            var parent = s.parentElement;
            var parentLabeled = parent && (
                parent.hasAttribute('aria-label') ||
                parent.getAttribute('role') === 'button' ||
                parent.tagName.toLowerCase() === 'button'
            );

            if (parentLabeled) {
                // 装飾 SVG として SR を回避
                if (!s.hasAttribute('aria-hidden')) s.setAttribute('aria-hidden', 'true');
                if (!s.hasAttribute('focusable')) s.setAttribute('focusable', 'false');
                s.classList.add('enh-deco-svg');
            } else {
                // 単独 SVG: role=img を付ける (label が無いものは装飾扱い)
                if (!s.hasAttribute('role') && !s.hasAttribute('aria-label') && !s.querySelector('title')) {
                    s.setAttribute('aria-hidden', 'true');
                    s.setAttribute('focusable', 'false');
                }
            }
        }
    }

    // ────────────────────────────────────────────────────────
    // 10. モーダルフォーカストラップ
    //    a11y-2026-04-28: WCAG 2.4.3 Focus Order
    // ────────────────────────────────────────────────────────
    var FOCUSABLE_SELECTOR = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[role="button"]:not([disabled])'
    ].join(',');

    var _focusReturnStack = [];

    function trapFocus(container) {
        if (!container || container.__enhTrapped) return;
        container.__enhTrapped = true;

        // 開く前のフォーカス記憶
        var prev = document.activeElement;
        _focusReturnStack.push({ container: container, prev: prev });

        // 開いた瞬間、最初の focusable へフォーカス (なければ container 自身)
        setTimeout(function () {
            var first = container.querySelector(FOCUSABLE_SELECTOR);
            if (first) {
                try { first.focus(); } catch (e) {}
            } else {
                if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
                try { container.focus(); } catch (e) {}
            }
        }, 50);

        function onKey(e) {
            if (e.key !== 'Tab') return;
            var focusables = container.querySelectorAll(FOCUSABLE_SELECTOR);
            if (!focusables.length) {
                e.preventDefault();
                return;
            }
            var first = focusables[0];
            var last = focusables[focusables.length - 1];
            var active = document.activeElement;

            if (e.shiftKey) {
                if (active === first || !container.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
        container.addEventListener('keydown', onKey);
        container.__enhTrapHandler = onKey;
    }

    function releaseFocus(container) {
        if (!container || !container.__enhTrapped) return;
        container.__enhTrapped = false;
        if (container.__enhTrapHandler) {
            container.removeEventListener('keydown', container.__enhTrapHandler);
            container.__enhTrapHandler = null;
        }
        // スタックから対応エントリを取り出してフォーカス復帰
        for (var i = _focusReturnStack.length - 1; i >= 0; i--) {
            if (_focusReturnStack[i].container === container) {
                var prev = _focusReturnStack[i].prev;
                _focusReturnStack.splice(i, 1);
                if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
                    setTimeout(function () { try { prev.focus(); } catch (e) {} }, 0);
                }
                break;
            }
        }
    }

    function enhanceModals() {
        // product-modal / cart-drawer / chat-overlay などダイアログ的要素
        var dialogs = document.querySelectorAll(
            '.product-modal, .cart-drawer, #cart-drawer, .chat-overlay, #chat-overlay'
        );
        for (var i = 0; i < dialogs.length; i++) {
            var d = dialogs[i];
            if (d.__enhDialogInit) continue;
            d.__enhDialogInit = true;

            if (!d.hasAttribute('role')) d.setAttribute('role', 'dialog');
            if (!d.hasAttribute('aria-modal')) d.setAttribute('aria-modal', 'true');
            if (!d.hasAttribute('aria-label')) {
                if (d.classList.contains('cart-drawer') || d.id === 'cart-drawer') {
                    d.setAttribute('aria-label', 'カート');
                } else if (d.classList.contains('product-modal')) {
                    d.setAttribute('aria-label', '商品詳細');
                } else if (d.classList.contains('chat-overlay') || d.id === 'chat-overlay') {
                    d.setAttribute('aria-label', 'AI チャット');
                }
            }
            // 表示済 (modal-visible 等が付いた状態で出てきた) ならフォーカストラップ起動
            if (d.classList.contains('modal-visible') || d.classList.contains('open') ||
                d.style.display !== 'none') {
                trapFocus(d);
            }
        }
    }

    // モーダルが visibility/display で開閉されるパターンを MutationObserver で捕捉
    function watchModals() {
        var modalRoot = document.body;
        if (!modalRoot) return;
        var mo = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'style')) {
                    var t = m.target;
                    if (!t || !t.classList) continue;
                    if (t.classList.contains('product-modal') ||
                        t.classList.contains('cart-drawer') ||
                        t.id === 'cart-drawer' ||
                        t.classList.contains('chat-overlay') ||
                        t.id === 'chat-overlay') {
                        var visible = t.classList.contains('modal-visible') ||
                                      t.classList.contains('open') ||
                                      t.classList.contains('cart-drawer-open');
                        if (visible) {
                            trapFocus(t);
                        } else if (t.classList.contains('modal-closing') ||
                                   !visible) {
                            releaseFocus(t);
                        }
                    }
                }
                // 新規追加されたモーダル
                if (m.type === 'childList') {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        var n = m.addedNodes[j];
                        if (n.nodeType !== 1) continue;
                        if (n.matches && (n.matches('.product-modal, .cart-drawer, #cart-drawer, .chat-overlay'))) {
                            enhanceModals();
                            // 表示中なら trap
                            setTimeout(function (node) {
                                return function () {
                                    if (node.classList.contains('modal-visible') ||
                                        node.style.display === 'flex' ||
                                        node.style.display === 'block') {
                                        trapFocus(node);
                                    }
                                };
                            }(n), 100);
                        }
                    }
                }
            }
        });
        mo.observe(modalRoot, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['class', 'style']
        });
    }

    // ────────────────────────────────────────────────────────
    // 11. 動的トースト/ステータス領域に aria-live 後付け
    //    a11y-2026-04-28: WCAG 4.1.3
    // ────────────────────────────────────────────────────────
    function enhanceLiveTargets() {
        var sel = [
            '.cart-toast',
            '#email-status',
            '#contact-status',
            '#grey-save-status',
            '#chat-messages',
            '.toast',
            '.block-toast',
            '#cart-badge'
        ];
        sel.forEach(function (s) {
            var nodes = document.querySelectorAll(s);
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (n.__enhLive) continue;
                n.__enhLive = true;
                if (!n.hasAttribute('aria-live')) n.setAttribute('aria-live', 'polite');
                if (!n.hasAttribute('aria-atomic')) n.setAttribute('aria-atomic', 'true');
                if (!n.hasAttribute('role')) {
                    n.setAttribute('role', s === '#chat-messages' ? 'log' : 'status');
                }
            }
        });

        // cart-badge が更新されたら __enhAnnounce で通知
        var badge = document.getElementById('cart-badge');
        if (badge && !badge.__enhBadgeWatched) {
            badge.__enhBadgeWatched = true;
            var lastVal = badge.textContent;
            new MutationObserver(function () {
                var v = (badge.textContent || '').trim();
                if (v && v !== lastVal) {
                    lastVal = v;
                    if (window.__enhAnnounce) {
                        window.__enhAnnounce('カート内の商品: ' + v + ' 点');
                    }
                }
            }).observe(badge, { childList: true, characterData: true, subtree: true });
        }
    }

    // ────────────────────────────────────────────────────────
    // 12. フォーム input — placeholder のみで <label> 不在の箇所に aria-label 補完
    //    a11y-2026-04-28: WCAG 3.3.2 / 4.1.2
    // ────────────────────────────────────────────────────────
    function enhanceForms() {
        var inputs = document.querySelectorAll('input, textarea, select');
        for (var i = 0; i < inputs.length; i++) {
            var el = inputs[i];
            if (el.__enhLabel) continue;
            el.__enhLabel = true;

            var hasLabel = !!(el.id && document.querySelector('label[for="' + el.id + '"]'));
            var hasAria = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
            var hasTitle = el.hasAttribute('title');

            if (!hasLabel && !hasAria) {
                var ph = el.getAttribute('placeholder');
                if (ph) {
                    el.setAttribute('aria-label', ph);
                } else if (hasTitle) {
                    el.setAttribute('aria-label', el.getAttribute('title'));
                } else if (el.id) {
                    el.setAttribute('aria-label', el.id.replace(/[-_]/g, ' '));
                }
            }

            // autocomplete ヒント (WCAG 1.3.5)
            if (!el.hasAttribute('autocomplete')) {
                var t = (el.type || '').toLowerCase();
                var name = (el.name || el.id || '').toLowerCase();
                if (t === 'email' || /email/.test(name)) el.setAttribute('autocomplete', 'email');
                else if (/name/.test(name)) el.setAttribute('autocomplete', 'name');
                else if (/tel|phone/.test(name)) el.setAttribute('autocomplete', 'tel');
            }
        }
    }

    // ────────────────────────────────────────────────────────
    // 13. ロゴ装飾画像が alt="" の場合の保護 — 親に aria-label が無ければ付ける
    //    a11y-2026-04-28: WCAG 1.1.1
    // ────────────────────────────────────────────────────────
    function enhanceLogos() {
        var brand = document.querySelector('.brand-name');
        if (brand && !brand.__enhBrand) {
            brand.__enhBrand = true;
            // brand-char 1 文字ずつ → aria-hidden 化、親に label
            if (!brand.hasAttribute('aria-label')) brand.setAttribute('aria-label', 'inryokü');
            var chars = brand.querySelectorAll('.brand-char');
            for (var i = 0; i < chars.length; i++) {
                if (!chars[i].hasAttribute('aria-hidden')) {
                    chars[i].setAttribute('aria-hidden', 'true');
                }
            }
        }
        var logoWrap = document.querySelector('.logo-holo-wrap');
        if (logoWrap && !logoWrap.__enhLogo) {
            logoWrap.__enhLogo = true;
            if (!logoWrap.hasAttribute('role')) logoWrap.setAttribute('role', 'img');
            if (!logoWrap.hasAttribute('aria-label')) {
                logoWrap.setAttribute('aria-label', 'inryokü ロゴ');
            }
            // 子 img は装飾化
            var imgs = logoWrap.querySelectorAll('img');
            for (var j = 0; j < imgs.length; j++) {
                if (!imgs[j].hasAttribute('aria-hidden')) imgs[j].setAttribute('aria-hidden', 'true');
                if (!imgs[j].hasAttribute('alt')) imgs[j].setAttribute('alt', '');
            }
        }
    }

    // ────────────────────────────────────────────────────────
    // 14. chat input を visualViewport トラックに登録
    //    compat-2026-04-28: Issue I-19
    // ────────────────────────────────────────────────────────
    function enhanceChatInput() {
        var chatInputs = document.querySelectorAll(
            '#chat-input, #chat-overlay-input, .chat-input, .chat-tp-input'
        );
        for (var i = 0; i < chatInputs.length; i++) {
            var el = chatInputs[i];
            if (el.__enhVV) continue;
            el.__enhVV = true;
            // input 自体ではなく親コンテナの位置を調整するパターンが多い
            var container = el.closest('.chat-input-wrap, .chat-overlay, #chat-overlay') || el.parentElement;
            if (container && !container.classList.contains('enh-vv-tracked')) {
                container.classList.add('enh-vv-tracked');
            }
        }
    }

    // ────────────────────────────────────────────────────────
    // 15. ESC キーでモーダル閉じる補助 (既存実装と二重発火しないよう注意)
    //    既存コードに既に ESC ハンドラがあるため、capture で監視のみ
    // ────────────────────────────────────────────────────────
    function installEscapeHelper() {
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' && e.key !== 'Esc') return;
            // フォーカスが trap 中の dialog 内なら、既存の ESC ハンドラに任せる
            // ここでは何もしない (重複発火回避)
        });
    }

    // ────────────────────────────────────────────────────────
    // メイン: 初期化 + 動的更新監視
    // ────────────────────────────────────────────────────────
    function runAll() {
        safe(injectLandmarks, 'landmarks');
        safe(injectLiveRegions, 'live-regions');
        safe(enhanceAllClickables, 'clickables');
        safe(enhanceSVGs, 'svgs');
        safe(enhanceModals, 'modals');
        safe(enhanceLiveTargets, 'live-targets');
        safe(enhanceForms, 'forms');
        safe(enhanceLogos, 'logos');
        safe(enhanceChatInput, 'chat-input');
    }

    function init() {
        runAll();
        safe(watchModals, 'watch-modals');
        safe(installEscapeHelper, 'escape');

        // P3 が遅延初期化なので、DOM 変化を監視して再適用
        // (renderPhase3 が #root.innerHTML を書き換えるため、最初の runAll では空の可能性)
        var debounce = null;
        var mo = new MutationObserver(function () {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(runAll, 250);
        });
        mo.observe(document.body, { childList: true, subtree: true });

        // P3 完了イベントが発火するならそれにも便乗
        window.addEventListener('inryoku:p3complete', function () {
            setTimeout(runAll, 200);
        });

        // 念のため複数タイミングで再実行
        setTimeout(runAll, 1000);
        setTimeout(runAll, 3000);
        setTimeout(runAll, 6000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 公開 API
    window.__inryokuEnhance = {
        version: '2026-04-28',
        runAll: runAll,
        announce: function (t, opts) { return window.__enhAnnounce && window.__enhAnnounce(t, opts); },
        trapFocus: trapFocus,
        releaseFocus: releaseFocus,
        resumeAudio: function () { return window.__enhResumeAudio && window.__enhResumeAudio(); },
        requestDeviceOrientation: requestDeviceOrientation
    };
})();
