// ═══════════════════════════════════════════════════════════════
//  inryokü — Phase 6 コード一式（Claude引き継ぎ用）
//
//  このファイルはp5p6.jsからPhase 6に関連する部分を抽出したものです。
//  実際のプロジェクト: /Users/10ta210/.gemini/antigravity/scratch/antigravity/
//  起動: python3 -m http.server 8765 → http://localhost:8765/
//
//  Phase 6 概要:
//    - 粒子宇宙（Three.js Points 15000個 + 星座ネットワーク）
//    - inryokü ロゴ（各文字RGBCMY色）
//    - 商品カード（ENTER HOODIE, INFORMATION LOGO HOODIE）
//    - philosophy.txt フローティングウィンドウ（物理バウンス+ドラッグ）
//    - BGM: Holst - Jupiter
//    - ボレロプレーヤー（Web Audio API合成）
//    - Stripe Checkout準備済み
//
//  哲学: 「RGB（デジタル）で黒。CMY（アナログ）で白。現実はグレー。50%に気づいたら虹色。」
// ═══════════════════════════════════════════════════════════════

// ═══ P3 グローバル変数（p1と共存: let/const再宣言を避ける） ═══
// p1がlet currentPhase / let audioContextをグローバルで宣言済み
// var再宣言はlet/constと衝突してSyntaxErrorになるため、直接代入する
if (typeof currentPhase === 'undefined') { window.currentPhase = 0; }
if (typeof audioContext === 'undefined') { window.audioContext = null; }

// ═══ UNIVERSE SEED SYSTEM ═══
// URLパラメータ ?universe=xxxx → localStorage → 新規生成
(function initUniverseSeed() {
    const params = new URLSearchParams(window.location.search);
    let seed = params.get('universe');
    if (!seed) seed = localStorage.getItem('inryoku_universe_seed');
    if (!seed) {
        seed = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
    }
    localStorage.setItem('inryoku_universe_seed', seed);
    window._inryokuSeed = seed;

    // mulberry32 PRNG
    function mulberry32(a) {
        return function() {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    window.uRng = mulberry32(parseInt(seed, 16));

    // シェアURL生成ヘルパー
    window.getUniverseShareURL = function() {
        const url = new URL(window.location.href);
        url.searchParams.set('universe', seed);
        return url.toString();
    };

    console.log('[Universe] seed=' + seed + ' shareURL=' + window.getUniverseShareURL());
})();

// ═══ PRODUCT DATA ═══
const PRODUCTS = [
    {
        id: 'enter-hoodie',
        name: 'ENTER HOODIE',
        price: '¥12,800',
        priceNum: 12800,
        image: 'enter_hoodie.png',
        shopifyVariantId: 'gid://shopify/ProductVariant/49652498514214',
        description: 'EXIT is just the beginning. ENTER the next dimension.',
        details: 'Oversized fit · 100% Cotton · Washed Black · Neon green "ENTER" graphic',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Washed Black'
    },
    {
        id: 'info-logo-hoodie',
        name: 'INRYOKÜ LOGO HOODIE',
        price: '¥14,800',
        priceNum: 14800,
        image: 'info_logo_hoodie.png',
        shopifyVariantId: 'gid://shopify/ProductVariant/49652498546982',
        description: 'The information symbol reimagined. 101% identity.',
        details: 'Oversized fit · 100% Cotton · Washed Black · inryokü logo emblem',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Washed Black'
    },
    {
        id: 'enter-hoodie-white',
        name: 'ENTER HOODIE WHITE',
        price: '¥12,800',
        priceNum: 12800,
        image: 'enter_hoodie_white.png',
        shopifyVariantId: null,
        description: 'The white dimension. ENTER purity.',
        details: 'Oversized fit · 100% Cotton · White · Neon green "ENTER" graphic',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'White'
    },
    {
        id: 'info-logo-hoodie-oversized',
        name: 'INRYOKÜ LOGO HOODIE OVERSIZED',
        price: '¥14,800',
        priceNum: 14800,
        image: 'info_logo_hoodie_oversized.png',
        shopifyVariantId: null,
        description: 'Expanded silhouette. 101% presence.',
        details: 'Extra oversized fit · 100% Cotton · Washed Black · inryokü logo emblem',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Washed Black'
    },
    {
        id: 'enter-tee',
        name: 'ENTER TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'enter_tee.png',
        shopifyVariantId: null,
        description: 'Lightweight portal. ENTER everyday.',
        details: 'Regular fit · 100% Cotton · Washed Black · Neon green "ENTER" graphic',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Washed Black'
    },
    {
        id: 'info-logo-tee',
        name: 'INRYOKÜ LOGO TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'info_logo_tee.png',
        shopifyVariantId: null,
        description: 'Essential identity. Minimal gravity.',
        details: 'Regular fit · 100% Cotton · Washed Black · inryokü logo emblem',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Washed Black'
    },
    {
        id: 'enter-longsleeve',
        name: 'ENTER LONG SLEEVE',
        price: '¥9,800',
        priceNum: 9800,
        image: 'enter_longsleeve.png',
        shopifyVariantId: null,
        description: 'Extended reach. ENTER the continuum.',
        details: 'Regular fit · 100% Cotton · Washed Black · Neon green "ENTER" graphic',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Washed Black'
    },
    {
        id: 'info-logo-longsleeve',
        name: 'INRYOKÜ LOGO LONG SLEEVE',
        price: '¥9,800',
        priceNum: 9800,
        image: 'info_logo_longsleeve.png',
        shopifyVariantId: null,
        description: 'Sustained wavelength. 101% signal.',
        details: 'Regular fit · 100% Cotton · Washed Black · inryokü logo emblem',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Washed Black'
    },
    {
        id: 'enter-crewneck',
        name: 'ENTER CREWNECK',
        price: '¥11,800',
        priceNum: 11800,
        image: 'enter_crewneck.png',
        shopifyVariantId: null,
        description: 'Classic form. ENTER the orbit.',
        details: 'Regular fit · 100% Cotton · Washed Black · Neon green "ENTER" graphic',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Washed Black'
    },
    {
        id: 'info-logo-tank',
        name: 'INRYOKÜ LOGO TANK',
        price: '¥6,800',
        priceNum: 6800,
        image: 'info_logo_tank.png',
        shopifyVariantId: null,
        description: 'Zero resistance. Pure gravity.',
        details: 'Regular fit · 100% Cotton · Washed Black · inryokü logo emblem',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Washed Black'
    }
];

// ═══ CART SYSTEM ═══
const CART = {
    items: [], // { productId, size, qty, product }
    add: function(productId, size, qty) {
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product) return;
        const existing = this.items.find(it => it.productId === productId && it.size === size);
        if (existing) {
            existing.qty += qty;
        } else {
            this.items.push({ productId, size, qty, product });
        }
        this.updateBadge();
        this.showAddFeedback();
    },
    remove: function(idx) {
        this.items.splice(idx, 1);
        this.updateBadge();
    },
    getTotal: function() {
        return this.items.reduce((sum, it) => sum + it.product.priceNum * it.qty, 0);
    },
    updateBadge: function() {
        const badge = document.getElementById('cart-badge');
        const totalQty = this.items.reduce((sum, it) => sum + it.qty, 0);
        if (badge) {
            badge.textContent = totalQty;
            badge.style.display = totalQty > 0 ? 'flex' : 'none';
        }
    },
    showAddFeedback: function() {
        const btn = document.getElementById('cart-float-btn');
        if (btn) {
            btn.style.transform = 'scale(1.3)';
            setTimeout(() => { btn.style.transform = 'scale(1)'; }, 200);
        }
    }
};

function showCartDrawer() {
    let drawer = document.getElementById('cart-drawer');
    if (drawer) { drawer.classList.add('cart-open'); return; }

    drawer = document.createElement('div');
    drawer.id = 'cart-drawer';
    drawer.innerHTML = `
        <div class="cart-drawer-overlay" id="cart-drawer-overlay"></div>
        <div class="cart-drawer-panel glass-card">
            <div class="cart-drawer-header">
                <span class="cart-drawer-title">CART</span>
                <button class="cart-drawer-close" id="cart-drawer-close">\u2715</button>
            </div>
            <div class="cart-drawer-items" id="cart-drawer-items"></div>
            <div class="cart-drawer-footer" id="cart-drawer-footer"></div>
        </div>`;
    drawer.style.cssText = 'position:fixed;inset:0;z-index:10000;pointer-events:auto;';
    document.body.appendChild(drawer);

    document.getElementById('cart-drawer-close').addEventListener('click', hideCartDrawer);
    document.getElementById('cart-drawer-overlay').addEventListener('click', hideCartDrawer);

    renderCartItems();
    setTimeout(() => drawer.classList.add('cart-open'), 10);
}

function hideCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) {
        drawer.classList.remove('cart-open');
        setTimeout(() => drawer.remove(), 300);
    }
}

function renderCartItems() {
    const itemsEl = document.getElementById('cart-drawer-items');
    const footerEl = document.getElementById('cart-drawer-footer');
    if (!itemsEl || !footerEl) return;

    if (CART.items.length === 0) {
        itemsEl.innerHTML = '<div style="text-align:center;padding:40px 0;color:#888;font-size:14px;">CART IS EMPTY</div>';
        footerEl.innerHTML = '';
        return;
    }

    itemsEl.innerHTML = CART.items.map((it, idx) => `
        <div class="cart-item" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
            <img src="${it.product.image}" alt="${it.product.name}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;background:#111;">
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.product.name}</div>
                <div style="font-size:11px;color:#888;">Size: ${it.size} \u00d7 ${it.qty}</div>
            </div>
            <div style="font-size:13px;color:#fff;white-space:nowrap;">\u00a5${(it.product.priceNum * it.qty).toLocaleString()}</div>
            <button onclick="CART.remove(${idx});renderCartItems();CART.updateBadge();" style="background:none;border:none;color:#666;font-size:16px;cursor:pointer;padding:4px;">\u2715</button>
        </div>`).join('');

    const total = CART.getTotal();
    footerEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:16px 0 8px;font-size:14px;font-weight:600;color:#fff;">
            <span>TOTAL</span><span>\u00a5${total.toLocaleString()}</span>
        </div>
        <button id="cart-checkout-btn" style="width:100%;padding:14px;background:#fff;color:#000;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.05em;margin-top:8px;">CHECKOUT</button>`;

    document.getElementById('cart-checkout-btn').addEventListener('click', () => {
        shopifyCheckout(CART.items);
    });
}

// ═══ SHOPIFY STOREFRONT API ═══
const SHOPIFY_CONFIG = {
    storeDomain: '0xi10h-x1.myshopify.com',
    storefrontToken: 'ce0dc399245e874fd85d218df2d9bb04',
    apiVersion: '2026-04'
};

async function shopifyFetch(query, variables) {
    const url = 'https://' + SHOPIFY_CONFIG.storeDomain + '/api/' + SHOPIFY_CONFIG.apiVersion + '/graphql.json';
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': SHOPIFY_CONFIG.storefrontToken
        },
        body: JSON.stringify({ query, variables })
    });
    if (!resp.ok) throw new Error('Shopify API error: ' + resp.status);
    const json = await resp.json();
    if (json.errors) throw new Error('Shopify GQL error: ' + JSON.stringify(json.errors));
    return json.data;
}

async function shopifyCheckout(cartItems) {
    // shopifyVariantIdがある商品のみチェックアウト可能
    const lines = cartItems
        .filter(it => it.product.shopifyVariantId)
        .map(it => ({
            merchandiseId: it.product.shopifyVariantId,
            quantity: it.qty
        }));

    if (lines.length === 0) {
        alert('Currently unavailable for checkout. Coming soon.');
        return;
    }

    const checkoutBtn = document.getElementById('cart-checkout-btn');
    if (checkoutBtn) { checkoutBtn.textContent = 'LOADING...'; checkoutBtn.disabled = true; }

    try {
        const data = await shopifyFetch(`
            mutation cartCreate($input: CartInput!) {
                cartCreate(input: $input) {
                    cart { checkoutUrl }
                    userErrors { field message }
                }
            }
        `, { input: { lines: lines } });

        const result = data.cartCreate;
        if (result.userErrors && result.userErrors.length > 0) {
            throw new Error(result.userErrors.map(e => e.message).join(', '));
        }
        if (result.cart && result.cart.checkoutUrl) {
            window.location.href = result.cart.checkoutUrl;
        }
    } catch (e) {
        console.error('[Shopify] Checkout error:', e);
        alert('Checkout error: ' + e.message);
        if (checkoutBtn) { checkoutBtn.textContent = 'CHECKOUT'; checkoutBtn.disabled = false; }
    }
}

// ═══ PHASE 6 メインエントリー ═══
function renderPhase3() {
    currentPhase = 3;
    localStorage.setItem('inryoku_visited', '1');

    // ── ミュート状態初期化 ──
    if (window._inryokuMuted === undefined) window._inryokuMuted = true;

    // ── P2→P3 遷移オーバーレイを引き継ぐ ──────────────────────
    // P2のホワイトアウト (#p2-fade-ov) が残っていれば:
    //   白 → 黒 (500ms) → 透明 (800ms) でフェードしてP3を露出
    const p2ov = document.getElementById('p2-fade-ov');
    if (p2ov) {
        p2ov.style.pointerEvents = 'none';
        // double rAF: ブラウザが現在の状態（白）をコミットしてからtransitionを開始
        requestAnimationFrame(() => requestAnimationFrame(() => {
            p2ov.style.transition = 'opacity 1.2s ease';
            p2ov.style.opacity = '0';
            setTimeout(() => { if (p2ov.parentNode) p2ov.remove(); }, 1400);
        }));
    }

    // ── 残留DOM完全除去 ─────────────────────────────────────────
    document.querySelectorAll('body > canvas').forEach(el => el.remove());
    ['#sun-cross-overlay', '#door-overlay'].forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.remove();
    });
    document.querySelectorAll('body > div[style]').forEach(el => {
        const z = parseInt(el.style.zIndex || 0);
        if (z >= 9000) el.remove();
    });
    document.body.style.background = '#000';
    document.body.style.overflow = 'hidden';

    // ── BGM: Holst - Jupiter (The Bringer of Jollity) ──
    // Public domain recording from Wikimedia Commons
    let p6bgm = null;
    try {
        p6bgm = new Audio('https://upload.wikimedia.org/wikipedia/commons/a/a0/Holst_The_Planets_Jupiter.ogg');
        p6bgm.loop = true;
        p6bgm.volume = 0;
        p6bgm.crossOrigin = 'anonymous';
        if (window._inryokuMuted) p6bgm.muted = true;
        const playPromise = p6bgm.play();
        if (playPromise) {
            playPromise.catch(() => {
                // Autoplay blocked — play on first interaction
                const resumeBGM = () => {
                    p6bgm.play().catch(() => { });
                    document.removeEventListener('click', resumeBGM);
                    document.removeEventListener('touchstart', resumeBGM);
                };
                document.addEventListener('click', resumeBGM, { once: true });
                document.addEventListener('touchstart', resumeBGM, { once: true });
            });
        }
        // Fade in over 3 seconds
        let fadeVol = 0;
        const fadeIn = setInterval(() => {
            fadeVol += 0.01;
            if (fadeVol >= 0.7) { fadeVol = 0.7; clearInterval(fadeIn); }
            if (p6bgm) p6bgm.volume = fadeVol;
        }, 30);
    } catch (e) { console.warn('BGM load failed:', e); }
    // Store reference for cleanup
    window._p6bgm = p6bgm;

    const root = document.getElementById('root');
    root.className = 'phase-3';
    root.style.cssText = 'position:relative;z-index:1;background:transparent;pointer-events:none;';

    const CHAR_COLORS = ['#FF0000','#00FF00','#0000FF','#00FFFF','#FF00FF','#FFFF00'];
    let charColorIdx = 0;
    function colorizeChars(text) {
      return text.split('').map(ch => {
        const color = CHAR_COLORS[charColorIdx % 6];
        charColorIdx++;
        return `<span style="color:${color}">${ch}</span>`;
      }).join('');
    }

    const productCardsHTML = PRODUCTS.map((p, i) => `
        <div class="item-card glass-card" style="min-width:200px;flex-shrink:0;scroll-snap-align:center;" onclick="showProductModal(${i})" id="product-${p.id}">
          <div class="item-thumb">
            <img src="${p.image}" alt="${p.name}" class="item-thumb-img">
          </div>
          <div class="item-info">
            <div class="item-name">${colorizeChars(p.name)}</div>
            <div class="item-price">${p.price}</div>
          </div>
        </div>`).join('');

    const muteIcon = window._inryokuMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';

    root.innerHTML = `
        <canvas id="pu-cv" style="display:none;"></canvas>
    <!-- Cart floating button -->
    <div id="cart-float-btn" style="position:fixed;top:16px;right:16px;z-index:9999;pointer-events:auto;cursor:pointer;background:rgba(0,0,0,0.6);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:22px;transition:transform 0.2s ease;" onclick="showCartDrawer()">
        \uD83D\uDED2
        <span id="cart-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#ff3366;color:#fff;font-size:11px;font-weight:700;border-radius:50%;width:20px;height:20px;align-items:center;justify-content:center;">0</span>
    </div>
    <!-- Mute button -->
    <div id="mute-btn" style="position:fixed;top:16px;right:76px;z-index:9999;pointer-events:auto;cursor:pointer;background:rgba(0,0,0,0.6);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:22px;transition:transform 0.2s ease;">${muteIcon}</div>
    <div class="singularity-content" style="position:relative;z-index:5;pointer-events:auto;">
        <div class="hologram-logo">
            <div class="brand-name p6-logo-text">
                <span class="brand-char" style="color:#808080">i</span><span class="brand-char" style="color:#FF0000">n</span><span class="brand-char" style="color:#00FF00">r</span><span class="brand-char" style="color:#0044FF">y</span><span class="brand-char" style="color:#00FFFF">o</span><span class="brand-char" style="color:#FF00FF">k</span><span class="brand-char" style="color:#FFFF00">ü</span>
            </div>
            <div class="logo-holo-wrap" id="bb-logo" style="cursor:pointer;">
                <img src="logo_shell.png" alt="" class="logo-shell">
                <img src="logo_sphere.png" alt="" class="logo-sphere">
                <div class="holo-scanlines"></div>
                <div class="holo-overlay"></div>
                <div class="holo-scanline"></div>
            </div>
                <div class="prism-line"></div>
        </div>

        <div class="item-grid" style="opacity:0;transition:opacity 1.2s ease;">
          <div id="store-grid" style="width:100%;overflow:visible;position:relative;">
            <div id="carousel-ring" style="display:flex;gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:0 20px;scrollbar-width:none;">
              ${productCardsHTML}
            </div>
          </div>
        </div>

    </div>`;

    // ── ミュートボタンのイベント ──
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            window._inryokuMuted = !window._inryokuMuted;
            muteBtn.textContent = window._inryokuMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
            if (window._p6bgm) window._p6bgm.muted = window._inryokuMuted;
        });
    }

    // ── カルーセルスクロールバー非表示（webkit） ──
    const carouselStyle = document.createElement('style');
    carouselStyle.textContent = '#carousel-ring::-webkit-scrollbar{display:none;} .cart-drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);} .cart-drawer-panel{position:fixed;top:0;right:-360px;width:340px;height:100%;padding:20px;overflow-y:auto;transition:right 0.3s ease;background:rgba(10,10,10,0.9);backdrop-filter:blur(20px);border-left:1px solid rgba(255,255,255,0.1);} .cart-open .cart-drawer-panel{right:0;} .cart-drawer-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.1);} .cart-drawer-title{font-size:14px;font-weight:700;color:#fff;letter-spacing:0.1em;} .cart-drawer-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;}';
    document.head.appendChild(carouselStyle);


    // ── Bolero プレーヤー ──
    const boleroEl = document.createElement('div');
    boleroEl.id = 'bolero-player';
    boleroEl.innerHTML = `
        <button id="bolero-btn">▶</button>
        <span id="bolero-label">BOLERO (Ravel)</span>`;
    document.body.appendChild(boleroEl);

    console.log('[Phase 3] DOM setup complete, initializing particle universe...');
    // 同期呼び出し（rAFだとバックグラウンドタブや競合で不発になるケースがある）
    try {
        initParticleUniverse();
        initBoleroPlayer();
        console.log('[Phase 3] Particle universe initialized successfully');
    } catch(e) {
        console.error('[Phase 3] initParticleUniverse error:', e);
    }

    // ── ブランドネーム粒子形成アニメーション ──
    // 各文字を最初非表示→対応色の粒子が飛来して文字が現れる
    initBrandParticleReveal();
}

function initBrandParticleReveal() {
    var chars = document.querySelectorAll('.brand-char');
    if (!chars.length) return;

    var charColors = ['#808080','#FF0000','#00FF00','#0044FF','#00FFFF','#FF00FF','#FFFF00'];
    var charGlows  = ['rgba(128,128,128,0.5)','rgba(255,0,0,0.5)','rgba(0,255,0,0.5)','rgba(0,68,255,0.5)','rgba(0,255,255,0.5)','rgba(255,0,255,0.5)','rgba(255,255,0,0.5)'];
    var prismLine  = document.querySelector('.prism-line');
    var logoWrap   = document.querySelector('.logo-holo-wrap');
    var logoShell  = document.querySelector('.logo-shell');
    var logoSphere = document.querySelector('.logo-sphere');

    // ── 全要素初期非表示 ──
    if (prismLine)  { prismLine.style.opacity = '0'; prismLine.style.transition = 'none'; }
    if (logoWrap)   { logoWrap.style.opacity  = '1'; logoWrap.style.transition  = 'none'; }
    if (logoShell)  { logoShell.style.animation = 'none'; logoShell.style.opacity = '0'; logoShell.style.transition = 'none'; }
    if (logoSphere) { logoSphere.style.animation = 'none'; logoSphere.style.opacity = '0'; logoSphere.style.transition = 'none'; }
    chars.forEach(function(ch) {
        ch.style.opacity = '0';
        ch.style.color = '#0ff';
        ch.style.textShadow = '0 0 15px rgba(0,255,255,0.8), 0 0 30px rgba(0,255,255,0.3)';
        ch.style.transform = 'scaleY(1.5) scaleX(0.8)';
        ch.style.filter = 'brightness(2)';
        ch.style.transition = 'none';
        ch.style.display = 'inline-block';
    });

    // ═══════════════════════════════════════════
    //  STEP 1: 球体コアが光って実体化（0ms〜）
    // ═══════════════════════════════════════════
    if (logoSphere) {
        logoSphere.style.filter = 'drop-shadow(0 0 60px rgba(255,255,255,1)) drop-shadow(0 0 100px rgba(0,255,255,0.9)) brightness(2.5)';
    }
    setTimeout(function() {
        if (logoSphere) {
            logoSphere.style.transition = 'opacity 0.6s ease';
            logoSphere.style.opacity = '1';
        }
    }, 200);
    // 球体の過剰グローが落ち着く
    setTimeout(function() {
        if (logoSphere) {
            logoSphere.style.transition = 'filter 1.5s ease';
            logoSphere.style.filter = '';
        }
    }, 800);

    // ═══════════════════════════════════════════
    //  STEP 2: シェルがホログラム投影される（900ms〜）
    //  ノイズ的なフリッカーで徐々に安定
    // ═══════════════════════════════════════════
    var shellFlickers = [
        { t: 900,  op: '0.3',  dur: '0.04s' },
        { t: 960,  op: '0.0',  dur: '0.03s' },
        { t: 1020, op: '0.5',  dur: '0.06s' },
        { t: 1100, op: '0.1',  dur: '0.03s' },
        { t: 1160, op: '0.55', dur: '0.08s' },
        { t: 1260, op: '0.2',  dur: '0.04s' },
        { t: 1320, op: '0.65', dur: '0.1s'  },
        { t: 1440, op: '0.4',  dur: '0.05s' },
        { t: 1520, op: '0.75', dur: '0.12s' },
        { t: 1680, op: '0.6',  dur: '0.06s' },
        { t: 1760, op: '0.8',  dur: '0.15s' },
    ];
    shellFlickers.forEach(function(f) {
        setTimeout(function() {
            if (logoShell) {
                logoShell.style.transition = 'opacity ' + f.dur;
                logoShell.style.opacity = f.op;
            }
        }, f.t);
    });
    // 安定してCSSアニメーションへ
    setTimeout(function() {
        if (logoShell) {
            logoShell.style.transition = 'opacity 0.4s ease';
            logoShell.style.opacity = '';
            setTimeout(function() {
                if (logoShell) { logoShell.style.transition = ''; logoShell.style.animation = ''; }
            }, 500);
        }
        if (logoSphere) {
            setTimeout(function() {
                if (logoSphere) { logoSphere.style.transition = ''; logoSphere.style.animation = ''; }
            }, 500);
        }
    }, 1900);

    // ═══════════════════════════════════════════
    //  STEP 3: 球体から光が放たれてブランドネームへ（2000ms〜）
    //  光が到着したらSTEP 4のホログラム文字演出
    // ═══════════════════════════════════════════
    var LIGHT_START = 2000;
    var LIGHT_DELAY = 140;   // 文字間ディレイ
    var FLIGHT_MS   = 600;   // 光の飛行時間

    // 光粒子コンテナ
    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;z-index:99;pointer-events:none;overflow:hidden;';
    document.body.appendChild(container);

    // 球体の画面位置を取得
    var sphereRect = logoSphere ? logoSphere.getBoundingClientRect() : null;
    var sx = sphereRect ? sphereRect.left + sphereRect.width / 2 : window.innerWidth / 2;
    var sy = sphereRect ? sphereRect.top + sphereRect.height / 2 : window.innerHeight * 0.3;

    chars.forEach(function(ch, idx) {
        var color = charColors[idx];
        var glow  = charGlows[idx];
        var lightDelay = LIGHT_START + idx * LIGHT_DELAY;

        // 光粒子のカラーをHEXからRGBへ
        var hexToRgb = function(hex) {
            var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
            return {r:r, g:g, b:b};
        };
        var rgb = hexToRgb(color);

        // 光粒子を生成（各文字の色）
        var dot = document.createElement('div');
        dot.style.cssText =
            'position:absolute;border-radius:50%;will-change:transform,opacity;' +
            'width:8px;height:8px;' +
            'background:radial-gradient(circle, #ffffff 0%, ' + color + ' 40%, transparent 75%);' +
            'box-shadow:0 0 15px 6px rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.7),0 0 40px 12px rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.3);' +
            'left:' + sx + 'px;top:' + sy + 'px;opacity:0;';
        container.appendChild(dot);

        var charRect = ch.getBoundingClientRect();
        var tx = charRect.left + charRect.width / 2;
        var ty = charRect.top + charRect.height / 2;

        // 光を発射
        setTimeout(function() {
            dot.style.opacity = '1';
            var t0 = performance.now();

            function animateLight(now) {
                var elapsed = now - t0;
                var prog = Math.min(elapsed / FLIGHT_MS, 1.0);
                // ease-out cubic
                var ease = 1 - Math.pow(1 - prog, 3);
                var mx = sx + (tx - sx) * ease;
                var my = sy + (ty - sy) * ease;
                // 微小な揺れ
                var wobX = Math.sin(elapsed * 0.008 + idx * 2) * (6 * (1 - prog));
                var wobY = Math.cos(elapsed * 0.006 + idx * 1.5) * (4 * (1 - prog));

                dot.style.transform = 'translate(' + (mx - sx + wobX) + 'px,' + (my - sy + wobY) + 'px)';
                dot.style.opacity = 0.6 + 0.4 * (1 - prog);

                if (prog < 1.0) {
                    requestAnimationFrame(animateLight);
                } else {
                    // 光が到着 → フェードアウト
                    dot.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    dot.style.opacity = '0';
                    dot.style.transform = 'translate(' + (tx - sx) + 'px,' + (ty - sy) + 'px) scale(2)';
                    setTimeout(function() { dot.remove(); }, 400);

                    // ── STEP 4: ホログラム文字演出 ──
                    // シアンで出現
                    ch.style.transition = 'opacity 0.12s, transform 0.2s ease-out';
                    ch.style.opacity = '0.7';
                    ch.style.transform = 'scaleY(1.1) scaleX(0.95)';

                    // ちらつき
                    setTimeout(function() {
                        ch.style.transition = 'opacity 0.05s';
                        ch.style.opacity = '0.15';
                    }, 150);

                    // シアン再出現
                    setTimeout(function() {
                        ch.style.transition = 'opacity 0.1s, transform 0.15s ease-out';
                        ch.style.opacity = '0.85';
                        ch.style.transform = 'scaleY(1.0) scaleX(1.0)';
                        ch.style.filter = 'brightness(1.5)';
                    }, 230);

                    // 本来の色に変わる
                    setTimeout(function() {
                        ch.style.transition = 'color 0.5s ease, text-shadow 0.5s ease, filter 0.5s ease, opacity 0.3s ease';
                        ch.style.opacity = '1';
                        ch.style.color = color;
                        ch.style.textShadow = '0 0 8px ' + glow;
                        ch.style.filter = 'brightness(1.1)';
                    }, 450);

                    // 安定
                    setTimeout(function() {
                        ch.style.transition = 'text-shadow 1s ease, filter 0.5s ease';
                        ch.style.textShadow = '';
                        ch.style.filter = '';
                    }, 850);
                }
            }
            requestAnimationFrame(animateLight);
        }, lightDelay);
    });

    // ═══════════════════════════════════════════
    //  STEP 5: 全完了後 → プリズムライン + 商品カード
    // ═══════════════════════════════════════════
    var allDoneTime = LIGHT_START + (chars.length - 1) * LIGHT_DELAY + FLIGHT_MS + 1000;

    setTimeout(function() {
        container.remove();
        if (prismLine) { prismLine.style.transition = 'opacity 1s ease'; prismLine.style.opacity = '1'; }
        setTimeout(function() {
            var itemGrid = document.querySelector('.item-grid');
            if (itemGrid) itemGrid.style.opacity = '1';
        }, 800);
    }, allDoneTime);
}

// ═══ THREE.JS 粒子宇宙 ═══
function initParticleUniverse() {
    if (typeof THREE === 'undefined') { console.error('[P3] Three.js required'); return; }

    const W = window.innerWidth, H = window.innerHeight;
    document.querySelectorAll('body > canvas:not(#p6-canvas)').forEach(c => c.remove());
    const existing = document.getElementById('p6-canvas');
    if (existing) existing.remove();

    // ── Renderer ──
    const renderer6 = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer6.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer6.setSize(W, H);
    renderer6.setClearColor(0x000000, 1);
    renderer6.domElement.id = 'p6-canvas';
    renderer6.domElement.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;' +
        'pointer-events:none;display:block;';
    document.body.insertBefore(renderer6.domElement, document.body.firstChild);

    // ── Scene / Camera ──
    const scene6 = new THREE.Scene();
    const camera6 = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);
    camera6.position.set(0, 0, 200);
    camera6.lookAt(0, 0, 0);

    // ═══════════════════════════════════════════════════════════════
    //  15000 RGBCMY+White 星 — 呼吸する宇宙
    // ═══════════════════════════════════════════════════════════════
    const isMobile = W < 768;
    const N = isMobile ? 6000 : 15000;

    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const aSizes = new Float32Array(N);
    const aPhases = new Float32Array(N);

    const PALETTE = [
        [1, 0, 0], [0, 1, 0], [0, 0, 1],
        [0, 1, 1], [1, 0, 1], [1, 1, 0],
        [1, 1, 1]
    ];

    for (let i = 0; i < N; i++) {
        // 球状に均等分布
        const r = 80 + Math.random() * 400;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        // RGBCMY+White
        const c = PALETTE[Math.floor(Math.random() * 7)];
        colors[i * 3] = c[0];
        colors[i * 3 + 1] = c[1];
        colors[i * 3 + 2] = c[2];

        // サイズバラつき（よりランダムに、大きいのも混ぜる）
        const sR = Math.random();
        if (sR < 0.03) aSizes[i] = 12.0 + Math.random() * 8.0;       // 3%: 巨大な光球
        else if (sR < 0.10) aSizes[i] = 6.0 + Math.random() * 6.0;  // 7%: 大きい
        else if (sR < 0.30) aSizes[i] = 3.0 + Math.random() * 3.0;  // 20%: 中大
        else if (sR < 0.55) aSizes[i] = 1.5 + Math.random() * 2.0;  // 25%: 中
        else aSizes[i] = 0.3 + Math.random() * 1.5;                  // 45%: 小さい星

        // 呼吸フェーズ
        aPhases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(aSizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(aPhases, 1));

    // ═══════════════════════════════════════════════════════════════
    //  ShaderMaterial — 呼吸する丸い光の粒
    // ═══════════════════════════════════════════════════════════════
    const material = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0.0 } },
        vertexShader: `
            attribute float aSize;
            attribute float aPhase;
            varying vec3 vColor;
            varying float vBreathe;
            varying float vDist;
            uniform float uTime;

void main() {
    vColor = color;

    // 呼吸: 各粒子が独自のリズムで明滅（複数のsin波を重ねて有機的に）
    float breatheSpeed = 0.34 + aPhase * 0.13;
    float spatialWave = length(position) * 0.02;
    float b1 = sin(uTime * breatheSpeed + aPhase + spatialWave);
    float b2 = sin(uTime * breatheSpeed * 0.7 + aPhase * 2.3 + spatialWave * 1.5) * 0.3;
    vBreathe = (b1 + b2) * 0.5 * 0.5 + 0.5;

    // カメラからの距離（ニュートンリング風エフェクト用）
    vDist = length(position);

    // 呼吸に連動してサイズも変化
    float sizeBreath = 1.0 + vBreathe * 0.35;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * sizeBreath * (280.0 / -mvPos.z);
    gl_PointSize = max(gl_PointSize, 0.5);
    gl_Position = projectionMatrix * mvPos;
}
`,
        fragmentShader: `
            varying vec3 vColor;
            varying float vBreathe;
            varying float vDist;
            uniform float uTime;

void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    // 多層ガウシアン: コア + ソフトグロー + アウターヘイロー
    float core = exp(-d * d * 18.0);          // 明るいコア
    float glow = exp(-d * d * 5.0) * 0.6;    // ソフトグロー
    float halo = exp(-d * d * 2.0) * 0.15;   // アウターヘイロー
    float alpha = core + glow + halo;

    // 呼吸: 明るさが0.35〜1.0の間で変化
    float breathe = 0.35 + 0.65 * vBreathe;

    // ニュートンリング風: 距離に応じた虹色の干渉縞
    float ring = sin(vDist * 0.08 + uTime * 0.3) * 0.5 + 0.5;
    vec3 rainbow = vec3(
        sin(ring * 6.2832) * 0.5 + 0.5,
        sin(ring * 6.2832 + 2.094) * 0.5 + 0.5,
        sin(ring * 6.2832 + 4.189) * 0.5 + 0.5
    );
    // グレー→虹の観測エフェクト（コアに近いほど虹が見える）
    vec3 finalColor = mix(vColor, vColor + rainbow * 0.2, core * 0.4);

    gl_FragColor = vec4(finalColor * breathe, alpha * breathe);
}
`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true
    });

    const particles = new THREE.Points(geometry, material);
    scene6.add(particles);

    // ── パーティクル段階的出現（星がひとつずつ灯るように） ──
    let visibleCount = 0;
    const SPAWN_RATE = isMobile ? 30 : 80;  // 初回もう少し多め
    const SPAWN_ACCEL = 0.5; // やや加速（約20秒で全星が見える）
    geometry.setDrawRange(0, 0); // 初期: 0個表示

    // ═══════════════════════════════════════════════════════════════
    //  星座ネットワーク (Constellation Lines)
    // ═══════════════════════════════════════════════════════════════
    const MAX_LINES = 5000;
    const linePositions = new Float32Array(MAX_LINES * 6);
    const lineColors = new Float32Array(MAX_LINES * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    // 星座ライン用 ShaderMaterial（距離減衰+時間明滅でリアルに）
    const lineMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0.0 } },
        vertexShader: `
            attribute vec3 color;
            varying vec3 vColor;
            varying float vDepth;
            void main() {
                vColor = color;
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                vDepth = -mvPos.z;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vDepth;
            uniform float uTime;
            void main() {
                // 遠くのラインほど暗く
                float depthFade = clamp(1.0 - vDepth / 300.0, 0.0, 1.0);
                depthFade = depthFade * depthFade;
                // 微かな明滅（星座の瞬き）
                float twinkle = 0.7 + 0.3 * sin(uTime * 0.8 + vDepth * 0.05);
                float alpha = depthFade * twinkle * 0.8;
                gl_FragColor = vec4(vColor * (0.6 + depthFade * 0.4), alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene6.add(linesMesh);

    function updateConstellations() {
        const posArr = geometry.attributes.position.array;
        const colArr = geometry.attributes.color.array;
        const camZ = camera6.position.z;

        const nearby = [];
        const vCount = Math.floor(visibleCount);
        for (let i = 0; i < vCount; i++) {
            const z = posArr[i * 3 + 2];
            const dz = z - camZ;
            if (dz > -100 && dz < 30) {
                nearby.push(i);
            }
            if (nearby.length >= 800) break;
        }

        let lineIdx = 0;
        const CONNECT_DIST = 50;

        for (let a = 0; a < nearby.length && lineIdx < MAX_LINES; a++) {
            const ia = nearby[a];
            const ax = posArr[ia * 3], ay = posArr[ia * 3 + 1], az = posArr[ia * 3 + 2];

            for (let b = a + 1; b < nearby.length && lineIdx < MAX_LINES; b++) {
                const ib = nearby[b];
                const bx = posArr[ib * 3], by = posArr[ib * 3 + 1], bz = posArr[ib * 3 + 2];

                const dx = ax - bx, dy = ay - by, dz2 = az - bz;
                const dist = Math.sqrt(dx * dx + dy * dy + dz2 * dz2);

                if (dist < CONNECT_DIST) {
                    // cubic減衰（近いほど明るく、遠いほど急速に暗く）
                    const fade = Math.pow(1.0 - dist / CONNECT_DIST, 2.5);
                    const li = lineIdx * 6;

                    linePositions[li] = ax; linePositions[li + 1] = ay; linePositions[li + 2] = az;
                    linePositions[li + 3] = bx; linePositions[li + 4] = by; linePositions[li + 5] = bz;

                    // 端点ごとに元の色を使い、fadeで明るさ調整
                    lineColors[li]     = colArr[ia * 3]     * fade;
                    lineColors[li + 1] = colArr[ia * 3 + 1] * fade;
                    lineColors[li + 2] = colArr[ia * 3 + 2] * fade;
                    lineColors[li + 3] = colArr[ib * 3]     * fade;
                    lineColors[li + 4] = colArr[ib * 3 + 1] * fade;
                    lineColors[li + 5] = colArr[ib * 3 + 2] * fade;

                    lineIdx++;
                }
            }
        }

        for (let i = lineIdx * 6; i < MAX_LINES * 6; i++) {
            linePositions[i] = 0;
            lineColors[i] = 0;
        }

        lineGeo.attributes.position.needsUpdate = true;
        lineGeo.attributes.color.needsUpdate = true;
        lineGeo.setDrawRange(0, lineIdx * 2);
    }

    // ── Bloom ──
    let composer6 = null;
    if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
        composer6 = new THREE.EffectComposer(renderer6);
        composer6.addPass(new THREE.RenderPass(scene6, camera6));
        composer6.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 1.6, 0.5, 0.15));
    }

    // ── リサイズ ──
    const onR6 = () => {
        const nw = window.innerWidth, nh = window.innerHeight;
        renderer6.setSize(nw, nh);
        camera6.aspect = nw / nh;
        camera6.updateProjectionMatrix();
        if (composer6) composer6.setSize(nw, nh);
    };
    window.addEventListener('resize', onR6);

    // ═══════════════════════════════════════════════════════════════
    //  ORGANIC DRIFT — 滑らかに漂う光のプランクトン
    // ═══════════════════════════════════════════════════════════════
    const driftSpeedZ = new Float32Array(N);   // Z軸の前進速度
    const driftFreqX = new Float32Array(N);    // X揺らぎの周波数
    const driftFreqY = new Float32Array(N);    // Y揺らぎの周波数
    const driftAmpX = new Float32Array(N);     // X揺らぎの振幅
    const driftAmpY = new Float32Array(N);     // Y揺らぎの振幅
    const driftPhaseX = new Float32Array(N);   // X揺らぎの位相オフセット
    const driftPhaseY = new Float32Array(N);   // Y揺らぎの位相オフセット

    for (let i = 0; i < N; i++) {
        // Z速度: ゆるやかなバラつき
        // 約20%の粒子は逆方向（手前から奥へ）に流れる
        const isReverse = Math.random() < 0.2;
        const speed = 0.00875 + Math.random() * 0.045;
        driftSpeedZ[i] = isReverse ? -speed * 0.6 : speed;

        // X/Y揺らぎ: 各粒子が固有のリズムで柔らかく揺れる
        driftFreqX[i] = 0.13 + Math.random() * 0.34;
        driftFreqY[i] = 0.10 + Math.random() * 0.30;
        driftAmpX[i] = 0.017 + Math.random() * 0.10;
        driftAmpY[i] = 0.017 + Math.random() * 0.085;
        driftPhaseX[i] = Math.random() * Math.PI * 2;
        driftPhaseY[i] = Math.random() * Math.PI * 2;
    }

    const posArr = geometry.attributes.position.array;
    let uTime = 0;

    // ── 引力エフェクト用 velocity ──
    const attractVelX = new Float32Array(N);
    const attractVelY = new Float32Array(N);

    // ── 状態管理 ──
    let bigBangState = 'idle'; // 'idle' | 'absorb' | 'speaking' | 'chatting' | 'bb_collapse' | 'bb_explode' | 'done'
    let bigBangTimer = 0;
    // speaking用: 二進数テレパシー（1バイトずつ順番に表示）
    // 粒子1個=0（点）、線=1（繋がり）
    let msgNodeIndices = [];     // ノード粒子のインデックス
    let msgNodeTargets = [];     // [{idx, tx, ty, tz, isOne, bitIdx}]
    let msgNodeMap = new Map();  // idx → entry O(1)
    let msgEdges = [];           // [{from, to, progress}]
    let msgEdgeRevealIdx = 0;
    let msgLineMesh = null;      // Three.js LineSegments
    // ブロック単位の順次表示（複数バイト同時）
    let chatSpeaking = false;
    let chatSpeakTimer = 0;
    let chatSpeakCallback = null;
    let byteQueue = [];          // [{bits:'01001000'}, ...] 表示待ちバイト列
    let blockStart = 0;          // 現在のブロック開始バイトインデックス
    let bitRevealIdx = 0;        // ブロック内で何ビット目まで表示したか
    const BYTES_PER_BLOCK = 24;  // 同時表示バイト数
    const BIT_INTERVAL = 0.015;  // 1ビット出現間隔（秒）ゆっくり
    const BLOCK_HOLD = 0.5;      // ブロック表示後の余韻（秒）
    const bbVelX = new Float32Array(N);
    const bbVelY = new Float32Array(N);
    const bbVelZ = new Float32Array(N);
    const origColArr = geometry.attributes.color.array.slice();
    let logoWX6 = 0, logoWY6 = 0;

    // ── スクロールパララックス ──
    let scrollY6 = 0;
    const scrollEl = document.querySelector('.singularity-content');
    if (scrollEl) scrollEl.addEventListener('scroll', () => { scrollY6 = scrollEl.scrollTop; });

    // ── カーソル引力: canvasはpointer-events:noneなのでdocumentで取得 ──
    let mouseNX6 = 999, mouseNY6 = 999;
    const onMouseMove6 = e => {
        mouseNX6 = (e.clientX / window.innerWidth)  *  2 - 1;
        mouseNY6 = (e.clientY / window.innerHeight) * -2 + 1;
    };
    document.addEventListener('mousemove', onMouseMove6);
    document.addEventListener('mouseleave', () => { mouseNX6 = 999; mouseNY6 = 999; });

    // ── ロゴクリック → absorb（粒子吸収）起動 ──
    const bbLogoEl = document.getElementById('bb-logo');
    if (bbLogoEl) {
        bbLogoEl.addEventListener('click', () => {
            if (bigBangState !== 'idle') return;
            const rect = bbLogoEl.getBoundingClientRect();
            // 球体の中心 = ロゴ画像の上部33%（虹色の球の中心）
            const sphereCenterX = rect.left + rect.width / 2;
            const sphereCenterY = rect.top + rect.height * 0.33;
            const lnx = (sphereCenterX / window.innerWidth)  *  2 - 1;
            const lny = -(sphereCenterY / window.innerHeight) *  2 + 1;
            const vec = new THREE.Vector3(lnx, lny, 0.5);
            vec.unproject(camera6);
            const dir = vec.sub(camera6.position).normalize();
            const t = -camera6.position.z / dir.z;
            logoWX6 = camera6.position.x + dir.x * t;
            logoWY6 = camera6.position.y + dir.y * t;
            // absorb開始: 粒子がロゴに吸い込まれる
            bigBangState = 'absorb';
            bigBangTimer = 0;
            visibleCount = N;
            geometry.setDrawRange(0, N);
            console.log('[ABSORB] started, logoWX=' + logoWX6.toFixed(2) + ' logoWY=' + logoWY6.toFixed(2));
            for (let i = 0; i < N; i++) { attractVelX[i] = 0; attractVelY[i] = 0; }

            // ── UIフェードアウト（ロゴ=infoは残す）──
            var itemGrid = document.querySelector('.item-grid');
            var brandName = document.querySelector('.brand-name');
            var prismLine = document.querySelector('.prism-line');
            var bolero = document.getElementById('bolero-player');
            [itemGrid, brandName, prismLine, bolero].forEach(function(el) {
                if (el) { el.style.transition = 'opacity 1.5s ease'; el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
            });
        });
    }

    let lastFrameTime = performance.now();
    window._loop6FrameCount = 0;
    function loop6(nowMs) {
        window._loop6FrameCount++;
        if (currentPhase !== 3) {
            scene6.traverse(obj => {
                if (obj.isPoints || obj.isMesh || obj.isLine) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) obj.material.dispose();
                }
            });
            window.removeEventListener('resize', onR6);
            document.removeEventListener('mousemove', onMouseMove6);
            if (renderer6.domElement.parentNode) renderer6.domElement.remove();
            try { renderer6.dispose(); } catch (e) { }
            return;
        }

        // 実時間ベースのdelta（バックグラウンドタブ対策）
        const now = nowMs || performance.now();
        let dt = (now - lastFrameTime) / 1000;
        if (dt > 0.1) dt = 0.1; // 100msキャップ（タブ復帰時の暴走防止）
        lastFrameTime = now;

        uTime += dt;
        material.uniforms.uTime.value = uTime;
        lineMat.uniforms.uTime.value = uTime;

        // ── パーティクル段階的出現 ──
        if (visibleCount < N) {
            // 時間が経つほど加速的に増える（最初ちらほら→だんだん洪水）
            const spawnMultiplier = 1.0 + uTime * SPAWN_ACCEL;
            visibleCount += SPAWN_RATE * spawnMultiplier * dt;
            if (visibleCount > N) visibleCount = N;
            geometry.setDrawRange(0, Math.floor(visibleCount));
        }

        // 微かなカメラ揺らぎ + スクロールパララックス
        camera6.position.x = Math.sin(uTime * 0.17) * 0.43;
        camera6.position.y = Math.cos(uTime * 0.13) * 0.26 + scrollY6 * 0.04;
        camera6.lookAt(0, 0, 0);

        // ═══ 状態遷移: absorb → speaking → chatting → (close時) bb_collapse → bb_explode → idle ═══
        if (bigBangState !== 'idle' && bigBangState !== 'done' && bigBangState !== 'chatting') {
            bigBangTimer += dt;
            if (bigBangTimer < 0.05 || Math.floor(bigBangTimer) > Math.floor(bigBangTimer - dt)) {
                console.log('[STATE] ' + bigBangState + ' t=' + bigBangTimer.toFixed(3));
            }

            // absorb完了 → 直接chatting（二進数は最初は見えない、チャット内で発動）
            if (bigBangState === 'absorb' && bigBangTimer >= 3.0) {
                bigBangState = 'chatting';
                bigBangTimer = 0;
                console.log('[STATE] absorb→chatting: チャットUI表示（二進数は会話時に発動）');
                showChatUI();
            }
            // bb_collapse完了 → bb_explode（ビッグバン爆発）
            else if (bigBangState === 'bb_collapse' && bigBangTimer >= 2.5) {
                bigBangState = 'bb_explode';
                bigBangTimer = 0;
                console.log('[STATE] bb_collapse→bb_explode');
                const colArr = geometry.attributes.color.array;
                const BB_COLS = [[1,0,0],[0,1,0],[0,0,1],[0,1,1],[1,0,1],[1,1,0]];
                for (let j = 0; j < N; j++) {
                    const c = BB_COLS[j % 6];
                    colArr[j*3] = c[0]; colArr[j*3+1] = c[1]; colArr[j*3+2] = c[2];
                    posArr[j*3]   = logoWX6;
                    posArr[j*3+1] = logoWY6;
                    posArr[j*3+2] = 0;
                    const ang = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const spd = 0.5 + Math.random() * 2.0;
                    bbVelX[j] = spd * Math.sin(phi) * Math.cos(ang);
                    bbVelY[j] = spd * Math.sin(phi) * Math.sin(ang);
                    bbVelZ[j] = spd * Math.cos(phi);
                }
                geometry.attributes.color.needsUpdate = true;
            }
            // bb_explode完了 → done（idle復帰）
            else if (bigBangState === 'bb_explode' && bigBangTimer >= 4.0) {
                bigBangState = 'done';
                bigBangTimer = 0;
                console.log('[STATE] bb_explode→done: idle復帰');
                // 色を元に戻す
                const colArr = geometry.attributes.color.array;
                for (let j = 0; j < origColArr.length; j++) colArr[j] = origColArr[j];
                geometry.attributes.color.needsUpdate = true;
                removeConstellationMessage(); // 念のため
                setTimeout(() => { bigBangState = 'idle'; }, 2000);
            }
        }

        // ═══ チャット中の二進数演出（chatSpeaking: ブロック単位）═══
        if (bigBangState === 'chatting' && chatSpeaking && byteQueue.length > 0) {
            chatSpeakTimer += dt;

            // ブロック内の全ビットを高速reveal
            var blockBytes = Math.min(BYTES_PER_BLOCK, byteQueue.length - blockStart);
            var totalBitsInBlock = blockBytes * 8;
            var targetBit = Math.min(Math.floor(chatSpeakTimer / BIT_INTERVAL), totalBitsInBlock);
            while (bitRevealIdx < targetBit && bitRevealIdx < totalBitsInBlock) {
                revealBit(bitRevealIdx);
                bitRevealIdx++;
            }

            // エッジのprogressを育てる
            for (var e = 0; e < msgEdges.length; e++) {
                if (msgEdges[e].progress < 1.0) {
                    msgEdges[e].progress = Math.min(msgEdges[e].progress + dt * 5.0, 1.0);
                }
            }

            // ブロック全ビット出た + 余韻 → 次のブロックへ
            var blockCompleteTime = totalBitsInBlock * BIT_INTERVAL + BLOCK_HOLD;
            if (chatSpeakTimer >= blockCompleteTime) {
                blockStart += BYTES_PER_BLOCK;
                if (blockStart < byteQueue.length) {
                    // 次のブロック
                    chatSpeakTimer = 0;
                    bitRevealIdx = 0;
                    var nextBlock = byteQueue.slice(blockStart, blockStart + BYTES_PER_BLOCK);
                    setupBlock(nextBlock);
                } else {
                    // 全完了 → コールバック
                    chatSpeaking = false;
                    chatSpeakTimer = 0;
                    if (chatSpeakCallback) {
                        var cb = chatSpeakCallback;
                        chatSpeakCallback = null;
                        cb();
                    }
                    setTimeout(function() { clearByteDisplay(); }, 800);
                }
            }
        }

        // ═══ パーティクル物理 ═══
        const colArr = geometry.attributes.color.array;
        for (let i = 0; i < N; i++) {
            if (bigBangState === 'absorb') {
                // 粒子がロゴに吸い込まれる（ease-in: 最初ゆっくり→加速）
                const prog = Math.min(bigBangTimer / 3.0, 1.0);
                const ease = prog * prog * prog; // cubic ease-in
                const lerpF = 0.002 + ease * 0.15;
                posArr[i*3]   += (logoWX6 - posArr[i*3])   * lerpF;
                posArr[i*3+1] += (logoWY6 - posArr[i*3+1]) * lerpF;
                posArr[i*3+2] += (0       - posArr[i*3+2]) * lerpF;
                // 吸い込まれるにつれ暗く（消えていく感じ）
                const dimF = 1.0 - ease * 0.9;
                colArr[i*3]   = origColArr[i*3]   * dimF;
                colArr[i*3+1] = origColArr[i*3+1] * dimF;
                colArr[i*3+2] = origColArr[i*3+2] * dimF;

            } else if (bigBangState === 'chatting') {
                const node = msgNodeMap.get(i);
                if (node) {
                    // ── ヘプタポッド・ロゴグラム: スイープ描画→保持→ドレイン ──
                    const rp = ringPhases[0]; // 1ブロック=1ロゴグラム
                    if (!rp) continue;
                    const age = uTime - rp.birthTime;
                    const totalTime = RING_APPEAR_TIME + RING_HOLD_TIME + RING_DRAIN_TIME;

                    // スイープ遅延: 円環上の位置に応じて順番に描画される
                    var sweepDelay = (node.sweepOffset || 0) * RING_APPEAR_TIME * 0.75;
                    var expandDur = RING_APPEAR_TIME * 0.35;
                    var localAge = age - sweepDelay;

                    if (localAge < 0) {
                        // まだスイープが届いていない — ロゴ位置に隠す
                        posArr[i*3] = ringLogoX; posArr[i*3+1] = ringLogoY; posArr[i*3+2] = RING_Z;
                        colArr[i*3] = 0; colArr[i*3+1] = 0; colArr[i*3+2] = 0;
                        geometry.attributes.aSize.array[i] = 0;
                    } else if (age < RING_APPEAR_TIME) {
                        // ── スイープ描画: インクが円環を描くように流れる ──
                        var t2 = Math.min(localAge / expandDur, 1.0);
                        var ease2 = 1 - Math.pow(1 - t2, 3);
                        posArr[i*3]   = ringLogoX + (node.tx - ringLogoX) * ease2;
                        posArr[i*3+1] = ringLogoY + (node.ty - ringLogoY) * ease2;
                        posArr[i*3+2] = RING_Z;
                        var fade2 = t2;
                        var bc = node.byteColor || [0.9,0.92,1.0];
                        if (node.isOne) {
                            // 1 = バイト色そのまま、やや控えめ
                            colArr[i*3] = bc[0]*0.75*fade2; colArr[i*3+1] = bc[1]*0.75*fade2; colArr[i*3+2] = bc[2]*0.75*fade2;
                            geometry.attributes.aSize.array[i] = 5.0 * fade2;
                        } else {
                            // 0 = バイト色の暗いバージョン（見えるけど暗い）
                            colArr[i*3] = bc[0]*0.15*fade2; colArr[i*3+1] = bc[1]*0.15*fade2; colArr[i*3+2] = bc[2]*0.15*fade2;
                            geometry.attributes.aSize.array[i] = 3.0 * fade2;
                        }
                        for (var e = 0; e < msgEdges.length; e++) {
                            if (msgEdges[e].from === node.idx || msgEdges[e].to === node.idx) {
                                msgEdges[e].progress = Math.max(msgEdges[e].progress, ease2 * 0.8);
                            }
                        }
                        if (!node.revealed) node.revealed = true;
                    } else if (age < RING_APPEAR_TIME + RING_HOLD_TIME) {
                        // ── 保持: ロゴグラムが静かに呼吸する ──
                        var breath = 1.0 + 0.03 * Math.sin(uTime * 2.5 + node.angle * 2.0);
                        posArr[i*3] = ringLogoX + (node.tx - ringLogoX) * breath;
                        posArr[i*3+1] = ringLogoY + (node.ty - ringLogoY) * breath;
                        posArr[i*3+2] = RING_Z;
                        var bc = node.byteColor || [0.9,0.92,1.0];
                        if (node.isOne) {
                            var glow = 0.7 + 0.1 * Math.sin(uTime * 3.0 + node.col * 0.5);
                            colArr[i*3] = bc[0]*glow; colArr[i*3+1] = bc[1]*glow; colArr[i*3+2] = bc[2]*glow;
                            geometry.attributes.aSize.array[i] = 5.0;
                        } else {
                            colArr[i*3] = bc[0]*0.15; colArr[i*3+1] = bc[1]*0.15; colArr[i*3+2] = bc[2]*0.15;
                            geometry.attributes.aSize.array[i] = 3.0;
                        }
                        for (var e = 0; e < msgEdges.length; e++) {
                            if (msgEdges[e].from === node.idx || msgEdges[e].to === node.idx) {
                                msgEdges[e].progress = Math.min(msgEdges[e].progress + dt * 2.0, 1.0);
                            }
                        }
                    } else if (age < totalTime) {
                        // ── ドレイン: チャットへ吸い込まれる ──
                        var dt3 = age - RING_APPEAR_TIME - RING_HOLD_TIME;
                        var t3 = dt3 / RING_DRAIN_TIME;
                        var ease3 = t3 * t3;
                        // ヘリックスの下端粒子はすでにチャット近く。全粒子がチャット中心へ収束
                        posArr[i*3]   = node.tx + (drainTX - node.tx) * ease3;
                        posArr[i*3+1] = node.ty + (drainTY - node.ty) * ease3;
                        posArr[i*3+2] = RING_Z;
                        var fade3 = 1.0 - t3;
                        var bc = node.byteColor || [0.9,0.92,1.0];
                        if (node.isOne) {
                            colArr[i*3] = bc[0]*0.75*fade3; colArr[i*3+1] = bc[1]*0.75*fade3; colArr[i*3+2] = bc[2]*0.75*fade3;
                        } else {
                            colArr[i*3] = bc[0]*0.15*fade3; colArr[i*3+1] = bc[1]*0.15*fade3; colArr[i*3+2] = bc[2]*0.15*fade3;
                        }
                        geometry.attributes.aSize.array[i] = (node.isOne ? 5.0 : 3.0) * fade3;
                        for (var e = 0; e < msgEdges.length; e++) {
                            if (msgEdges[e].from === node.idx || msgEdges[e].to === node.idx) {
                                msgEdges[e].progress *= 0.93;
                            }
                        }
                    } else {
                        colArr[i*3] = 0; colArr[i*3+1] = 0; colArr[i*3+2] = 0;
                        geometry.attributes.aSize.array[i] = 0;
                    }
                } else if (chatSpeaking) {
                    colArr[i*3] *= 0.95; colArr[i*3+1] *= 0.95; colArr[i*3+2] *= 0.95;
                }

            } else if (bigBangState === 'bb_collapse') {
                // チャット終了後: 全粒子がロゴに再集結（ビッグバン準備）
                const prog = Math.min(bigBangTimer / 2.5, 1.0);
                const ease = prog * prog * prog;
                const lerpF = 0.003 + ease * 0.2;
                posArr[i*3]   += (logoWX6 - posArr[i*3])   * lerpF;
                posArr[i*3+1] += (logoWY6 - posArr[i*3+1]) * lerpF;
                posArr[i*3+2] += (0       - posArr[i*3+2]) * lerpF;
                // グレーへ（50%の世界）
                const greyF = ease * 0.8;
                colArr[i*3]   = origColArr[i*3]   * (1 - greyF) + 0.5 * greyF;
                colArr[i*3+1] = origColArr[i*3+1] * (1 - greyF) + 0.5 * greyF;
                colArr[i*3+2] = origColArr[i*3+2] * (1 - greyF) + 0.5 * greyF;

            } else if (bigBangState === 'bb_explode') {
                // ビッグバン: RGBCMY爆発
                posArr[i*3]   += bbVelX[i];
                posArr[i*3+1] += bbVelY[i];
                posArr[i*3+2] += bbVelZ[i];
                bbVelX[i] *= 0.993;
                bbVelY[i] *= 0.993;
                bbVelZ[i] *= 0.993;

            } else {
                // 通常ドリフト (idle / done)
                posArr[i*3+2] += driftSpeedZ[i];
                posArr[i*3]   += Math.sin(uTime * driftFreqX[i] + driftPhaseX[i]) * driftAmpX[i];
                posArr[i*3+1] += Math.cos(uTime * driftFreqY[i] + driftPhaseY[i]) * driftAmpY[i];

                const z = posArr[i*3+2];
                if (z > 250 || z < -500) {
                    if (driftSpeedZ[i] >= 0) {
                        posArr[i*3+2] = -300 - Math.random() * 200;
                    } else {
                        posArr[i*3+2] = 200 + Math.random() * 50;
                    }
                    const r = 20 + Math.random() * 180;
                    const angle = Math.random() * Math.PI * 2;
                    posArr[i*3]   = Math.cos(angle) * r;
                    posArr[i*3+1] = Math.sin(angle) * r;
                }
                // done→idleへの復帰中: 色を徐々に戻す
                if (bigBangState === 'done') {
                    colArr[i*3]   += (origColArr[i*3]   - colArr[i*3])   * 0.02;
                    colArr[i*3+1] += (origColArr[i*3+1] - colArr[i*3+1]) * 0.02;
                    colArr[i*3+2] += (origColArr[i*3+2] - colArr[i*3+2]) * 0.02;
                }
            }
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        if (bigBangState === 'chatting' && chatSpeaking) {
            geometry.attributes.aSize.needsUpdate = true;
        }

        // 星座ネットワーク更新
        updateConstellations();
        // 二進数メッセージの線更新（chatting中のみ）
        if (bigBangState === 'chatting') {
            updateConstellationLines();
        }

        if (composer6) composer6.render(); else renderer6.render(scene6, camera6);
        // rAF + setTimeoutフォールバック（バックグラウンドタブ対策）
        if (document.hidden) {
            setTimeout(() => loop6(performance.now()), 32);
        } else {
            requestAnimationFrame(loop6);
        }
    }

    // ── チャットUI ──
    let chatMode = 'win95';
    let glitchTimer = null;
    let tpCharEls = [];     // { span, pIdx, tx, ty, sx, sy }
    let sculptActive = false;
    let famicomACtx = null;
    // AI会話履歴
    let chatHistory = [];

    function famicomBeep() {
        try {
            if (!famicomACtx) famicomACtx = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = famicomACtx;
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'square';
            // NES-palette pitches: A4/C5/E5/G5/A5 + slight randomness
            const nesFreqs = [440, 494, 523, 587, 659, 784, 880];
            osc.frequency.value = nesFreqs[Math.floor(Math.random() * nesFreqs.length)] + (Math.random() * 18 - 9);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.032);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.032);
        } catch(e) {}
    }

    function buildChatHTML(mode) {
        const namebox = mode === 'famicom' ? '<div class="nes-namebox">INFO</div>' : '';
        const bubbleTail = mode === 'famicom' ? '<span class="chat-bubble-fill"></span>' : '';
        const inputRow = mode === 'dos'
            ? `<div id="chat-input-row">
                 <span id="chat-prompt">C:\\inryoku&gt;&nbsp;</span>
                 <input id="chat-input" type="text" autocomplete="off" spellcheck="false">
                 <span id="chat-cursor">█</span>
               </div>`
            : mode === 'famicom'
            ? `<div id="chat-input-row">
                 <span id="nes-prompt">▶</span>
                 <input id="chat-input" type="text" placeholder="..." autocomplete="off" spellcheck="false">
               </div>`
            : `<div id="chat-input-row">
                 <input id="chat-input" type="text" placeholder="message..." autocomplete="off">
                 <button id="chat-send">OK</button>
               </div>`;
        const header = mode === 'mac'
            ? `<div id="chat-header">
                 <button id="chat-close"></button>
                 <div id="chat-title-wrap"><span id="chat-title">info</span></div>
               </div>`
            : `<div id="chat-header">
                 <span id="chat-title">info</span>
                 <button id="chat-close">×</button>
               </div>`;
        return namebox + bubbleTail + header + `<div id="chat-messages"></div>` + inputRow;
    }

    // ═══════════════════════════════════════════════════════════════
    //  二進数テレパシー: テキスト→バイナリ→粒子で0と1を表現
    //  0 = 点（1粒子）  1 = 線（縦に3粒子 + LineSegmentsで結ぶ）
    //  グリッド配置: 8ビット×N行で画面中央に表示
    // ═══════════════════════════════════════════════════════════════

    function textToBinary(text) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        let bits = '';
        for (let i = 0; i < bytes.length; i++) {
            bits += bytes[i].toString(2).padStart(8, '0');
        }
        return bits;
    }

    // ノード粒子の元サイズ保存用
    let origSizeArr = null;

    // 複数バイト（ブロック）を同時配置。複数行で表示
    // ── ロゴ中心円形バイナリ + 下方チャット接続 ──
    // 各バイト = ロゴ中心の1リング（8粒子が円周上に配置）
    // リングが順次出現 → 拡大 → 下方へ流れてチャットに接続
    const RING_Z = 130;
    const RING_RADIUS = 13;          // 螺旋の基本半径
    const RING_APPEAR_TIME = 2.5;    // 螺旋描画時間(秒) — ゆっくり
    const RING_HOLD_TIME = 1.5;      // 表示保持(秒)
    const RING_DRAIN_TIME = 1.0;     // 下方ドレイン(秒)
    const RING_STAGGER = 0.0;        // 全ビット1ロゴグラムなのでスタガー不要
    let ringPhases = [];             // [{birthTime, state:'appear'|'hold'|'drain'|'done', particles[]}]
    let ringStartTime = 0;
    // ドレイン先（チャットパネル上部のワールド座標）
    let drainTX = 0, drainTY = 0;
    // RING_Z平面でのロゴ座標（setupBlockで計算）
    let ringLogoX = 0, ringLogoY = 0;

    function computeDrainTarget() {
        var chatEl = document.getElementById('inryoku-chat');
        if (chatEl) {
            var rect = chatEl.getBoundingClientRect();
            var cnx = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
            var cny = -(rect.top) / window.innerHeight * 2 + 1;
            var vec = new THREE.Vector3(cnx, cny, 0.5);
            vec.unproject(camera6);
            var dir = vec.sub(camera6.position).normalize();
            var t = (RING_Z - camera6.position.z) / dir.z;
            drainTX = camera6.position.x + dir.x * t;
            drainTY = camera6.position.y + dir.y * t;
        } else {
            drainTX = logoWX6;
            drainTY = logoWY6 - 40;
        }
    }

    function setupBlock(bytesArr) {
        clearByteDisplay();

        const sizeArr = geometry.attributes.aSize.array;
        if (!origSizeArr) origSizeArr = sizeArr.slice();

        computeDrainTarget();

        // ── ロゴのスクリーン位置をRING_Z平面にunproject ──
        var bbLogoElRef = document.getElementById('bb-logo');
        ringLogoX = logoWX6; ringLogoY = logoWY6;
        if (bbLogoElRef) {
            var rect = bbLogoElRef.getBoundingClientRect();
            var scx = rect.left + rect.width / 2;
            var scy = rect.top + rect.height * 0.33;
            var rnx = (scx / window.innerWidth) * 2 - 1;
            var rny = -(scy / window.innerHeight) * 2 + 1;
            var rvec = new THREE.Vector3(rnx, rny, 0.5);
            rvec.unproject(camera6);
            var rdir = rvec.sub(camera6.position).normalize();
            var rt = (RING_Z - camera6.position.z) / rdir.z;
            ringLogoX = camera6.position.x + rdir.x * rt;
            ringLogoY = camera6.position.y + rdir.y * rt;
        }
        console.log('[setupBlock] ringLogo=(' + ringLogoX.toFixed(2) + ',' + ringLogoY.toFixed(2) + ')');

        // ── 縦ヘリックス・バイナリストリーム ──
        // ロゴ→チャットへ向かって螺旋状にデータが流れ落ちる
        var byteCount = bytesArr.length;
        var HELIX_TURNS = 3.0;        // 螺旋の回転数
        var HELIX_RADIUS = 10.0;      // 螺旋の横幅
        // RGB = 精神・デジタル（ASCII）
        var RGB_COLORS = [
            [1.0, 0.15, 0.1],  // R
            [0.1, 1.0, 0.2],   // G
            [0.15, 0.3, 1.0]   // B
        ];
        // CMY = 物質・アナログ（日本語）
        var CMY_COLORS = [
            [0.0, 0.9, 0.9],   // C
            [0.9, 0.0, 0.8],   // M
            [0.9, 0.9, 0.0]    // Y
        ];

        // ロゴ付近の粒子を確保
        const dists = [];
        for (let i = 0; i < N; i++) {
            const dx = posArr[i*3] - logoWX6;
            const dy = posArr[i*3+1] - logoWY6;
            dists.push({ idx: i, d: dx*dx + dy*dy });
        }
        dists.sort((a, b) => a.d - b.d);

        msgNodeIndices = [];
        msgNodeTargets = [];
        msgNodeMap = new Map();
        msgEdges = [];
        msgEdgeRevealIdx = 0;
        ringPhases = [];
        ringStartTime = uTime;

        // ランダムシード
        var seed = 0;
        var allBitsStr = bytesArr.join('');
        for (var s = 0; s < allBitsStr.length; s++) seed += allBitsStr.charCodeAt(s) * (s + 1);
        function prand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

        let pCursor = 0;
        const allParticles = [];

        // 縦ヘリックス: ロゴ(上)→チャット(下)へ螺旋状に流れる
        var totalSlots = byteCount * 9;
        var totalAngle = HELIX_TURNS * Math.PI * 2;
        var globalPos = 0;

        // ロゴ→チャットのベクトル（RING_Z平面上）
        var startX = ringLogoX, startY = ringLogoY;
        var endX = drainTX, endY = drainTY;
        // 中間で少し広がるレンズ形状
        var midY = (startY + endY) * 0.5;

        for (var byteIdx = 0; byteIdx < byteCount && pCursor < dists.length; byteIdx++) {
            var bits8 = bytesArr[byteIdx];
            var byteVal = parseInt(bits8, 2);
            var isASCII = byteVal < 128;
            var palette = isASCII ? RGB_COLORS : CMY_COLORS;
            var byteColor = palette[byteIdx % palette.length];

            for (var bitIdx = 0; bitIdx < 8 && pCursor < dists.length; bitIdx++) {
                var isOne = bits8[bitIdx] === '1';
                var globalBitIdx = byteIdx * 8 + bitIdx;
                var sweep = globalBitIdx / (byteCount * 8);

                // t: 0(ロゴ)→1(チャット) 螺旋上の進行度
                var t = globalPos / totalSlots;
                var angle = totalAngle * t;
                // 螺旋の太さ: 上下で細く、中央で太い（レンズ形状）
                var widthFactor = Math.sin(t * Math.PI); // 0→1→0
                var radius = HELIX_RADIUS * (0.3 + 0.7 * widthFactor);

                // 位置: 直線補間(ロゴ→チャット) + 螺旋回転
                var tx = startX + (endX - startX) * t + Math.cos(angle) * radius;
                var ty = startY + (endY - startY) * t + Math.sin(angle) * radius * 0.3; // Y方向は控えめ
                globalPos++;

                var pIdx = dists[pCursor++].idx;
                posArr[pIdx*3] = startX;
                posArr[pIdx*3+1] = startY;
                posArr[pIdx*3+2] = RING_Z;

                msgNodeIndices.push(pIdx);
                var entry = {
                    idx: pIdx,
                    tx: tx, ty: ty, tz: RING_Z,
                    bitIdx: globalBitIdx, row: 0, col: globalBitIdx,
                    angle: angle, isOne: isOne,
                    sweepOffset: sweep,
                    isThickness: false,
                    byteColor: byteColor,
                    revealed: false
                };
                msgNodeTargets.push(entry);
                msgNodeMap.set(pIdx, entry);
                sizeArr[pIdx] = 0;
                allParticles.push(entry);
            }
            globalPos++; // バイト間ギャップ
        }

        ringPhases.push({
            birthTime: ringStartTime,
            particles: allParticles
        });

        geometry.attributes.aSize.needsUpdate = true;
        geometry.attributes.position.needsUpdate = true;
        rebuildLineMesh();
    }

    // revealBit — ロゴグラム方式ではスイープで自動reveal
    function revealBit(bitIndex) {
        // 互換性のため空関数として残す
    }

    // LineMesh を再構築
    function rebuildLineMesh() {
        if (msgLineMesh) {
            scene6.remove(msgLineMesh);
            msgLineMesh.geometry.dispose();
            msgLineMesh.material.dispose();
            msgLineMesh = null;
        }
        var edgeCount = msgEdges.length;
        if (edgeCount === 0) return;
        var lp = new Float32Array(edgeCount * 6);
        var lc = new Float32Array(edgeCount * 6);
        var lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
        lg.setAttribute('color',    new THREE.BufferAttribute(lc, 3));
        msgLineMesh = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
            vertexColors: true, transparent: true, opacity: 1.0,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        scene6.add(msgLineMesh);
    }

    // 現在のバイト表示をクリア
    function clearByteDisplay() {
        var sizeArr = geometry.attributes.aSize.array;
        if (origSizeArr) {
            for (var i = 0; i < msgNodeIndices.length; i++) {
                sizeArr[msgNodeIndices[i]] = origSizeArr[msgNodeIndices[i]];
            }
            geometry.attributes.aSize.needsUpdate = true;
        }
        if (msgLineMesh) {
            scene6.remove(msgLineMesh);
            msgLineMesh.geometry.dispose();
            msgLineMesh.material.dispose();
            msgLineMesh = null;
        }
        msgNodeIndices = [];
        msgNodeTargets = [];
        msgNodeMap = new Map();
        msgEdges = [];
        msgEdgeRevealIdx = 0;
        ringPhases = [];
    }

    // 二進数の「1」の縦線を毎フレーム更新
    function updateConstellationLines() {
        if (!msgLineMesh || msgEdges.length === 0) return;
        const lPos = msgLineMesh.geometry.attributes.position.array;
        const lCol = msgLineMesh.geometry.attributes.color.array;
        // 明るいRGBCMYパレット（白ブースト）
        const BB_COLS = [[1,0.5,0.4],[0.4,1,0.5],[0.5,0.5,1],[0.3,1,1],[1,0.3,1],[1,1,0.3]];

        for (let e = 0; e < msgEdges.length; e++) {
            const edge = msgEdges[e];
            lPos[e*6]   = posArr[edge.from*3];
            lPos[e*6+1] = posArr[edge.from*3+1];
            lPos[e*6+2] = posArr[edge.from*3+2];
            lPos[e*6+3] = posArr[edge.to*3];
            lPos[e*6+4] = posArr[edge.to*3+1];
            lPos[e*6+5] = posArr[edge.to*3+2];

            if (edge.progress > 0) {
                const pulse = 0.7 + 0.3 * Math.sin(uTime * 2.0 + e * 0.4);
                const bright = edge.progress * pulse * 1.5; // 1.5倍ブースト
                const c = BB_COLS[e % 6];
                lCol[e*6]   = c[0]*bright; lCol[e*6+1] = c[1]*bright; lCol[e*6+2] = c[2]*bright;
                lCol[e*6+3] = c[0]*bright; lCol[e*6+4] = c[1]*bright; lCol[e*6+5] = c[2]*bright;
            } else {
                lCol[e*6]=0;lCol[e*6+1]=0;lCol[e*6+2]=0;
                lCol[e*6+3]=0;lCol[e*6+4]=0;lCol[e*6+5]=0;
            }
        }
        msgLineMesh.geometry.attributes.position.needsUpdate = true;
        msgLineMesh.geometry.attributes.color.needsUpdate = true;
    }

    // 除去
    function removeConstellationMessage() {
        clearByteDisplay();
        byteQueue = [];
        byteIdx = 0;
        bitRevealIdx = 0;
        chatSpeaking = false;
        chatSpeakTimer = 0;
    }

    // ── 二進数粒子演出でテキストを「話す」 ──
    // 1バイトずつ: infoから粒子が飛び出し→8ビット並ぶ→文字デコード→次のバイト
    function speakBinary(text, callback) {
        removeConstellationMessage();

        // テキストをUTF-8バイト列にして、バイトキューを作成
        var encoder = new TextEncoder();
        var bytes = encoder.encode(text);
        byteQueue = [];
        for (var i = 0; i < bytes.length; i++) {
            byteQueue.push(bytes[i].toString(2).padStart(8, '0'));
        }
        blockStart = 0;
        bitRevealIdx = 0;
        chatSpeaking = true;
        chatSpeakTimer = 0;
        chatSpeakCallback = callback || null;

        // 最初のブロックをセットアップ
        var firstBlock = byteQueue.slice(0, BYTES_PER_BLOCK);
        if (firstBlock.length > 0) {
            setupBlock(firstBlock);
        }
        console.log('[SPEAK] block mode for: "' + text.substring(0, 20) + '..." (' + byteQueue.length + ' bytes)');
    }

    // ── タイプライター（showChatUI/sendChatMsgの外に配置してスコープ共有） ──
    function typeMsg(text, onDone) {
        const msgs = document.getElementById('chat-messages');
        if (!msgs) return;
        const isFamicom = chatMode === 'famicom';
        const aiPrefix = (chatMode === 'dos' || chatMode === 'glitch') ? 'info> ' : '';
        // 前の▼カーソルを除去
        msgs.querySelectorAll('.nes-cursor').forEach(c => c.remove());
        // ファミコンモード: 最大2行まで。古いものをフェードアウトして削除
        if (isFamicom) {
            const existing = msgs.querySelectorAll('.chat-msg');
            if (existing.length >= 2) {
                const oldest = existing[0];
                oldest.style.transition = 'opacity 0.3s';
                oldest.style.opacity = '0';
                setTimeout(() => oldest.remove(), 320);
            }
        }
        const div = document.createElement('div');
        div.className = 'chat-msg ai-msg';
        div.textContent = aiPrefix;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
        let idx = 0;
        const iv = setInterval(() => {
            if (idx < text.length) {
                div.textContent += text[idx++];
                if (isFamicom) famicomBeep();
                msgs.scrollTop = msgs.scrollHeight;
            } else {
                clearInterval(iv);
                if (isFamicom) {
                    const cur = document.createElement('span');
                    cur.className = 'nes-cursor';
                    cur.textContent = ' ▼';
                    div.appendChild(cur);
                    setTimeout(() => { cur.remove(); if (onDone) onDone(); }, 900);
                } else {
                    if (onDone) onDone();
                }
            }
        }, isFamicom ? 52 : 55);
    }

    function showChatUI() {
        if (document.getElementById('inryoku-chat') || document.getElementById('chat-tp-overlay')) return;

        // ── トーク中はロゴ+チャットのみ。他UI完全非表示 ──
        var hideEls = [
            document.querySelector('.item-grid'),
            document.querySelector('.brand-name'),
            document.querySelector('.prism-line'),
            document.getElementById('bolero-player')
        ];
        hideEls.forEach(function(el) {
            if (el) { el.style.transition = 'opacity 0.8s ease'; el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
        });

        const params = new URLSearchParams(location.search);
        chatMode = params.get('chat') || 'famicom';
        if (chatMode === 'telepathy' || chatMode === 'sculpt' || chatMode === 'quantum') { showTelepathyUI(); return; }

        const chat = document.createElement('div');
        chat.id = 'inryoku-chat';
        // glitch は win95ベースとして扱う
        const cssMode = chatMode === 'glitch' ? 'win95' : chatMode;
        chat.classList.add(`chat-${cssMode}`);
        if (chatMode === 'glitch') chat.classList.add('chat-glitch-mode');
        chat.innerHTML = buildChatHTML(cssMode);
        document.body.appendChild(chat);

        // チャットをロゴ下・画面中央に配置（粒子リングの下）
        chat.style.position = 'fixed';
        chat.style.left = '50%';
        chat.style.transform = 'translateX(-50%)';
        chat.style.bottom = '60px';
        chat.style.top = 'auto';
        chat.style.right = 'auto';

        requestAnimationFrame(() => chat.classList.add('chat-visible'));

        document.getElementById('chat-close').addEventListener('click', closeChatUI);
        document.getElementById('chat-send')?.addEventListener('click', sendChatMsg);
        document.getElementById('chat-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') sendChatMsg();
        });

        // DOS: 入力欄フォーカスでカーソル非表示
        if (cssMode === 'dos') {
            const cursor = document.getElementById('chat-cursor');
            const inp = document.getElementById('chat-input');
            if (cursor && inp) {
                inp.addEventListener('focus', () => cursor.style.display = 'none');
                inp.addEventListener('blur',  () => cursor.style.display = '');
            }
        }

        // グリッチモード開始
        if (chatMode === 'glitch') startGlitch();

        // 最初の挨拶: 二進数演出 → テキスト表示（infoが粒子で語りかける）
        setTimeout(() => {
            speakBinary('こんにちは、私は、infoです', function() {
                typeMsg('こんにちは、私は、infoです', () => {
                    speakBinary('何について知りたいですか？', function() {
                        typeMsg('何について知りたいですか？');
                    });
                });
            });
        }, 400);
    }

    function closeChatUI() {
        if (glitchTimer) { clearInterval(glitchTimer); glitchTimer = null; }
        // telepathy
        const tp = document.getElementById('chat-tp-overlay');
        if (tp) {
            tpDissolveChars();
            const bar = document.getElementById('chat-tp-bar');
            if (bar) bar.style.opacity = '0';
            setTimeout(() => tp.remove(), 1600);
        }
        // standard chat除去
        const chat = document.getElementById('inryoku-chat');
        if (chat) { chat.classList.remove('chat-visible'); setTimeout(() => chat.remove(), 500); }
        chatHistory = []; // 会話履歴リセット

        // ★ 星座メッセージ除去 → ビッグバン発動！
        removeConstellationMessage();
        console.log('[CLOSE] chatting→bb_collapse: ビッグバン開始');
        bigBangState = 'bb_collapse';
        bigBangTimer = 0;

        // ── UI復元: ビッグバン爆発後にフェードイン（ロゴ以外）──
        setTimeout(function() {
            var itemGrid = document.querySelector('.item-grid');
            var brandName = document.querySelector('.brand-name');
            var prismLine = document.querySelector('.prism-line');
            var bolero = document.getElementById('bolero-player');
            [itemGrid, brandName, prismLine, bolero].forEach(function(el) {
                if (el) { el.style.transition = 'opacity 2.0s ease'; el.style.opacity = '1'; el.style.pointerEvents = ''; }
            });
        }, 5000);
    }

    // ── AI応答を取得 ──
    function fetchAIResponse(userText, callback) {
        chatHistory.push({ role: 'user', content: userText });
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userText,
                history: chatHistory.slice(-10) // 直近10メッセージのみ送信
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var response = data.response || '……';
            chatHistory.push({ role: 'assistant', content: response });
            callback(response);
        })
        .catch(function() {
            var fallback = '波が揺れた。もう一度、話しかけて';
            chatHistory.push({ role: 'assistant', content: fallback });
            callback(fallback);
        });
    }

    function sendChatMsg() {
        // telepathy / sculpt / quantum
        if (chatMode === 'telepathy' || chatMode === 'sculpt' || chatMode === 'quantum') {
            var input = document.getElementById('chat-tp-input');
            if (!input || !input.value.trim()) return;
            var txt = input.value.trim();
            input.value = '';
            var appearFn = chatMode === 'sculpt'  ? sculptParticleAppear  :
                           chatMode === 'quantum' ? quantumParticleAppear :
                           tpParticleAppear;
            // ユーザーメッセージを表示
            appearFn(txt, 'tp-user', function() {
                // AI応答を取得して表示
                fetchAIResponse(txt, function(response) {
                    setTimeout(function() { appearFn(response, 'tp-ai'); }, 400);
                });
            });
            return;
        }
        // standard (win95 / dos / famicom / mac / glitch)
        var input = document.getElementById('chat-input');
        var msgs  = document.getElementById('chat-messages');
        if (!input || !msgs || !input.value.trim()) return;
        var txt = input.value.trim();
        input.value = '';
        var userPfx = chatMode === 'dos' || chatMode === 'glitch' ? 'C:\\inryoku> ' : '▶ ';
        var uDiv = document.createElement('div');
        uDiv.className = 'chat-msg user-msg';
        uDiv.textContent = userPfx + txt;
        msgs.appendChild(uDiv);
        msgs.scrollTop = msgs.scrollHeight;

        // 「...」を表示しながらAI応答を待つ
        var aiPfx = chatMode === 'dos' || chatMode === 'glitch' ? 'info> ' : '';
        var aDiv = document.createElement('div');
        aDiv.className = 'chat-msg ai-msg';
        msgs.querySelectorAll('.nes-cursor').forEach(function(c) { c.remove(); });
        aDiv.textContent = aiPfx + '...';
        msgs.appendChild(aDiv);
        msgs.scrollTop = msgs.scrollHeight;

        // AI応答を取得 → 二進数粒子演出 → テキスト表示
        fetchAIResponse(txt, function(response) {
            aDiv.remove();
            // 粒子が円環を形成してから「読み取り」としてテキスト表示
            speakBinary(response, function() {
                typeMsg(response);
            });
        });
    }

    // ── グリッチエフェクト ──
    function startGlitch() {
        const GLITCH_CHARS = 'ﾊﾋｿﾝｳｼﾅﾓﾆｻﾜﾂｵﾃｶｷｱｵﾃｶｸ%$#@!?∆∇×÷';
        function scheduleNext() {
            const delay = 2000 + Math.random() * 3000;
            glitchTimer = setTimeout(() => {
                const chat = document.getElementById('inryoku-chat');
                if (!chat) return;
                const duration = 100 + Math.random() * 200;
                const pick = Math.floor(Math.random() * 4); // 0=dos, 1=mac, 2=win95, 3=textGlitch

                if (pick === 3) {
                    // テキスト一瞬文字化け
                    const allMsgs = chat.querySelectorAll('.chat-msg');
                    if (allMsgs.length === 0) { scheduleNext(); return; }
                    const target = allMsgs[allMsgs.length - 1];
                    const orig = target.textContent;
                    target.textContent = orig.split('').map(c =>
                        Math.random() < 0.4 ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] : c
                    ).join('');
                    setTimeout(() => { if (target) target.textContent = orig; scheduleNext(); }, duration);
                } else {
                    const modes = ['gmode-dos', 'gmode-mac', 'gmode-win95'];
                    const cls = modes[pick];
                    chat.classList.add(cls);
                    setTimeout(() => { chat.classList.remove(cls); scheduleNext(); }, duration);
                }
            }, delay);
        }
        scheduleNext();
    }

    // ── Telepathy: パーティクル→文字変換 ──
    function tpDissolveChars() {
        const colArr = geometry.attributes.color.array;
        // sculpt: 全パーティクル色を徐々に復元
        if (sculptActive) {
            sculptActive = false;
            let t = 0;
            const iv = setInterval(() => {
                t = Math.min(t + 0.06, 1.0);
                const f = 0.04 + 0.96 * t;
                for (let i = 0; i < origColArr.length; i++) colArr[i] = origColArr[i] * f;
                geometry.attributes.color.needsUpdate = true;
                if (t >= 1.0) clearInterval(iv);
            }, 50);
        }
        // 通常チャー: 元の位置へ飛び戻り消える
        tpCharEls.forEach(({ span, pIdx }) => {
            span.style.animation  = 'none';
            span.style.transition = 'transform 1.4s ease-in, opacity 1.0s ease, filter 0.8s ease';
            span.style.transform  = 'translate(0,0)';
            span.style.opacity    = '0';
            span.style.filter     = 'blur(8px)';
            colArr[pIdx*3]   = origColArr[pIdx*3];
            colArr[pIdx*3+1] = origColArr[pIdx*3+1];
            colArr[pIdx*3+2] = origColArr[pIdx*3+2];
            setTimeout(() => span.remove(), 1500);
        });
        if (tpCharEls.length > 0) geometry.attributes.color.needsUpdate = true;
        tpCharEls = [];
    }

    function tpParticleAppear(text, cls, onDone) {
        const overlay = document.getElementById('chat-tp-overlay');
        if (!overlay) return;
        tpDissolveChars();

        const colArr = geometry.attributes.color.array;
        const chars = [...text];
        const charW = 13;
        const totalW = chars.length * charW;
        const targetBaseX = window.innerWidth - totalW - 36;
        const targetBaseY = 88;

        chars.forEach((ch, i) => {
            // 可視パーティクルをランダムに選ぶ
            let pIdx = 0, sx = 0, sy = 0;
            for (let att = 0; att < 40; att++) {
                const idx = Math.floor(Math.random() * N);
                const vec = new THREE.Vector3(posArr[idx*3], posArr[idx*3+1], posArr[idx*3+2]);
                vec.project(camera6);
                if (vec.z < 1 && Math.abs(vec.x) < 1.1 && Math.abs(vec.y) < 1.1) {
                    pIdx = idx;
                    sx = (vec.x + 1) / 2 * window.innerWidth;
                    sy = (-vec.y + 1) / 2 * window.innerHeight;
                    break;
                }
            }

            const tx = targetBaseX + i * charW;
            const ty = targetBaseY;

            // パーティクルを消灯
            colArr[pIdx*3] = 0; colArr[pIdx*3+1] = 0; colArr[pIdx*3+2] = 0;

            const span = document.createElement('span');
            span.className = 'tp-pc';
            span.textContent = ch === ' ' ? '\u00a0' : ch;
            span.style.left  = sx + 'px';
            span.style.top   = sy + 'px';
            overlay.appendChild(span);
            tpCharEls.push({ span, pIdx, tx, ty, sx, sy });

            // パーティクル位置から目標へ飛ぶ
            setTimeout(() => {
                span.style.transition = 'transform 1.0s cubic-bezier(0.16,1,0.3,1), color 0.9s ease, filter 0.8s ease';
                span.style.transform  = `translate(${tx - sx}px, ${ty - sy}px)`;
                span.style.color      = cls === 'tp-ai' ? 'rgba(180,180,180,0.9)' : 'rgba(255,255,255,0.85)';
                span.style.filter     = 'blur(0)';
            }, i * 55 + 200);
        });

        geometry.attributes.color.needsUpdate = true;
        if (onDone) setTimeout(onDone, chars.length * 55 + 1200);
    }

    // ── Sculpt: パーティクルが文字の形を彫り出す ──
    function sculptParticleAppear(text, cls, onDone) {
        if (!document.getElementById('chat-tp-overlay')) return;
        tpDissolveChars();

        // 文字サイズを大きめに（密度が上がる）
        const fontSize = 26;
        const div = document.createElement('div');
        div.style.cssText = `position:fixed;top:-300px;left:0;visibility:hidden;
            font-family:'IBM Plex Mono','Courier New',monospace;font-size:${fontSize}px;
            white-space:nowrap;pointer-events:none;`;
        [...text].forEach(ch => {
            const s = document.createElement('span');
            s.textContent = ch === ' ' ? '\u00a0' : ch;
            div.appendChild(s);
        });
        document.body.appendChild(div);
        const totalWidth = div.getBoundingClientRect().width;

        // 右上に配置して測定
        const tx0 = window.innerWidth - totalWidth - 40;
        const ty0 = 72;
        div.style.top  = ty0 + 'px';
        div.style.left = tx0 + 'px';
        div.style.visibility = 'visible';
        const charRects = [...div.children].map(s => s.getBoundingClientRect());
        div.remove();

        const colArr = geometry.attributes.color.array;

        // 全パーティクルを暗く
        for (let i = 0; i < N; i++) {
            colArr[i*3]   = origColArr[i*3]   * 0.04;
            colArr[i*3+1] = origColArr[i*3+1] * 0.04;
            colArr[i*3+2] = origColArr[i*3+2] * 0.04;
        }

        // 文字の型に入るパーティクルを白く灯す
        for (let i = 0; i < N; i++) {
            const vec = new THREE.Vector3(posArr[i*3], posArr[i*3+1], posArr[i*3+2]);
            vec.project(camera6);
            if (vec.z >= 1) continue;
            const sx = (vec.x + 1) / 2 * window.innerWidth;
            const sy = (-vec.y + 1) / 2 * window.innerHeight;
            for (const r of charRects) {
                if (sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom) {
                    colArr[i*3] = 1.0; colArr[i*3+1] = 1.0; colArr[i*3+2] = 1.0;
                    break;
                }
            }
        }
        geometry.attributes.color.needsUpdate = true;
        sculptActive = true;
        if (onDone) setTimeout(onDone, 900);
    }

    // ── Quantum: 不確定ゆらぎ → 突然の波動関数崩壊 ──
    function quantumParticleAppear(text, cls, onDone) {
        const overlay = document.getElementById('chat-tp-overlay');
        if (!overlay) return;
        tpDissolveChars();

        const colArr = geometry.attributes.color.array;
        const chars = [...text];
        const charW = 13;
        const totalW = chars.length * charW;
        const targetBaseX = window.innerWidth - totalW - 36;
        const targetBaseY = 88;

        // フェーズ1: 不確定状態（ゆらぎ）でパーティクル位置にスパン配置
        chars.forEach((ch, i) => {
            let pIdx = 0, sx = window.innerWidth * 0.5, sy = window.innerHeight * 0.5;
            for (let att = 0; att < 40; att++) {
                const idx = Math.floor(Math.random() * N);
                const vec = new THREE.Vector3(posArr[idx*3], posArr[idx*3+1], posArr[idx*3+2]);
                vec.project(camera6);
                if (vec.z < 1 && Math.abs(vec.x) < 1.1 && Math.abs(vec.y) < 1.1) {
                    pIdx = idx;
                    sx = (vec.x + 1) / 2 * window.innerWidth;
                    sy = (-vec.y + 1) / 2 * window.innerHeight;
                    break;
                }
            }
            colArr[pIdx*3] = 0; colArr[pIdx*3+1] = 0; colArr[pIdx*3+2] = 0;

            const tx = targetBaseX + i * charW;
            const ty = targetBaseY;
            const span = document.createElement('span');
            span.className = 'tp-pc quantum-uncertain';
            span.textContent = ch === ' ' ? '\u00a0' : ch;
            span.style.left  = sx + 'px';
            span.style.top   = sy + 'px';
            span.style.color = cls === 'tp-ai' ? 'rgba(180,180,180,0.9)' : 'rgba(255,255,255,0.9)';
            overlay.appendChild(span);
            tpCharEls.push({ span, pIdx, tx, ty, sx, sy });
        });
        geometry.attributes.color.needsUpdate = true;

        // フェーズ2: 崩壊 — 一斉にスナップ（トランジションなし）
        const flickerMs = 320 + Math.random() * 140;
        setTimeout(() => {
            tpCharEls.forEach(({ span, tx, ty, sx, sy }) => {
                span.classList.remove('quantum-uncertain');
                span.style.animation   = 'none';
                span.style.transition  = 'none';
                span.style.opacity     = '1';
                span.style.filter      = 'blur(0)';
                span.style.transform   = `translate(${tx - sx}px, ${ty - sy}px)`;
            });
        }, flickerMs);

        if (onDone) setTimeout(onDone, flickerMs + 200);
    }

    // ── Telepathy UI ──
    function showTelepathyUI() {
        const overlay = document.createElement('div');
        overlay.id = 'chat-tp-overlay';
        overlay.innerHTML = `
            <div id="chat-tp-area"></div>
            <div id="chat-tp-bar">
                <span id="chat-tp-label">telepathy</span>
                <input id="chat-tp-input" type="text" placeholder="..." autocomplete="off" spellcheck="false">
                <button id="chat-tp-close">×</button>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('chat-tp-close').addEventListener('click', closeChatUI);
        document.getElementById('chat-tp-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') sendChatMsg();
        });

        // モードに応じた登場関数
        const appearFn = chatMode === 'sculpt'  ? sculptParticleAppear  :
                         chatMode === 'quantum' ? quantumParticleAppear :
                         tpParticleAppear;

        // 初期メッセージ → 入力バーをフェードイン
        setTimeout(() => {
            appearFn('こんにちは、私は、infoです', 'tp-ai', () => {
                setTimeout(() => {
                    appearFn('何について知りたいですか？', 'tp-ai', () => {
                        const bar = document.getElementById('chat-tp-bar');
                        if (bar) bar.classList.add('tp-bar-show');
                        setTimeout(() => document.getElementById('chat-tp-input')?.focus(), 600);
                    });
                }, 900);
            });
        }, 500);
    }

    // loop6起動（rAFが不発でもsetIntervalでフォールバック）
    console.log('[P3] Starting loop6, currentPhase=' + currentPhase);
    let loop6Running = false;
    function ensureLoop6() {
        if (loop6Running) return;
        loop6Running = true;
        loop6(performance.now());
    }
    // rAFで起動を試みる
    requestAnimationFrame(ensureLoop6);
    // フォールバック: 200ms後にまだ起動してなければ強制起動
    setTimeout(ensureLoop6, 200);
}


// initParticleUniverseCanvas() — Canvas 2D使用のため削除 (inryokü技術制約違反)



// ═══ 商品モーダル ═══
function showProductModal(idx) {
    const p = PRODUCTS[idx];
    if (!p) return;
    const m = document.createElement('div');
    m.className = 'product-modal';
    m.innerHTML = `
    <div class="modal-overlay" id="pm-overlay"></div>
        <div class="product-detail glass-card">
            <button class="product-close-btn" id="pm-close">✕</button>
            <div class="product-detail-inner">
                <div class="product-image-wrap">
                    <img src="${p.image}" alt="${p.name}" class="product-detail-img">
                </div>
                <div class="product-info-wrap">
                    <h2 class="product-title">${p.name}</h2>
                    <div class="product-price-tag">${p.price}</div>
                    <p class="product-desc">${p.description}</p>
                    <p class="product-specs">${p.details}</p>
                    <div class="product-color">Color: ${p.color}</div>
                    <div class="size-selector">
                        <div class="size-label">SIZE</div>
                        <div class="size-options">
                            ${p.sizes.map((s, i) => `<button class="size-btn${i === 1 ? ' selected' : ''}" data-size="${s}">${s}</button>`).join('')}
                        </div>
                    </div>
                    <button class="add-to-cart-btn" id="pm-cart">
                        <span class="cart-btn-text">ADD TO CART</span>
                        <span class="cart-btn-price">${p.price}</span>
                    </button>
                    <div class="stripe-badge">Powered by <strong>Shopify</strong> · Secure Checkout</div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(m);

    // サイズ選択
    let selectedSize = p.sizes.length > 1 ? p.sizes[1] : p.sizes[0];
    m.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            m.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedSize = btn.dataset.size;
        });
    });

    // カートボタン → CARTに追加
    document.getElementById('pm-cart').addEventListener('click', () => {
        CART.add(p.id, selectedSize, 1);
        // ボタンフィードバック
        const cartBtn = document.getElementById('pm-cart');
        const origText = cartBtn.querySelector('.cart-btn-text').textContent;
        cartBtn.querySelector('.cart-btn-text').textContent = 'ADDED \u2713';
        setTimeout(() => { cartBtn.querySelector('.cart-btn-text').textContent = origText; }, 1200);
    });

    // 閉じる
    const cl = () => {
        m.classList.remove('modal-visible');
        setTimeout(() => m.remove(), 300);
    };
    document.getElementById('pm-close').addEventListener('click', cl);
    document.getElementById('pm-overlay').addEventListener('click', cl);
    setTimeout(() => m.classList.add('modal-visible'), 10);
}

// 後方互換: 古いonclick="showComingSoonModal()" が残っている場合
function showComingSoonModal() { showProductModal(0); }

// ═══ AUDIO ═══
function iac() { try { if (!audioContext && (window.AudioContext || window.webkitAudioContext)) audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } return audioContext; }
function playDialupSound() { if (!iac()) return; const n = audioContext.currentTime;[697, 770, 852, 941, 1209, 1336].forEach((f, i) => { const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.frequency.value = f; o.type = 'sine'; const t = n + i * .15; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .01); g.gain.linearRampToValueAtTime(0, t + .1); o.start(t); o.stop(t + .15); }); }
function playUnlockSound() { if (!iac()) return; const n = audioContext.currentTime; const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.frequency.value = 880; o.type = 'sine'; g.gain.setValueAtTime(.14, n); g.gain.exponentialRampToValueAtTime(.01, n + .3); o.start(n); o.stop(n + .3); }
function playDivineSound() { if (!iac()) return; const n = audioContext.currentTime;[261.63, 329.63, 392, 493.88].forEach((f, i) => { const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.frequency.value = f; o.type = 'sine'; const t = n + i * .1; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.11, t + .3); g.gain.linearRampToValueAtTime(0, t + 3); o.start(t); o.stop(t + 3); }); }
function playWaterSplashSound() { if (!iac()) return; const n = audioContext.currentTime; const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.frequency.value = 280; o.type = 'sine'; g.gain.setValueAtTime(.13, n); g.gain.exponentialRampToValueAtTime(.01, n + .28); o.start(n); o.stop(n + .28); }
function playGlitchSound() { if (!iac()) return; const n = audioContext.currentTime; const bs = audioContext.sampleRate * .5, nb = audioContext.createBuffer(1, bs, audioContext.sampleRate), out = nb.getChannelData(0); for (let i = 0; i < bs; i++)out[i] = Math.random() * 2 - 1; const s = audioContext.createBufferSource(); s.buffer = nb; const g = audioContext.createGain(), f = audioContext.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 10; s.connect(f); f.connect(g); g.connect(audioContext.destination); g.gain.setValueAtTime(.18, n); g.gain.exponentialRampToValueAtTime(.01, n + .5); s.start(n); }

// ═══ BOLERO (Ravel) ═══
let boleroPlaying = false, boleroNodes = [], boleroInterval = null;
function initBoleroPlayer() {
    const btn = document.getElementById('bolero-btn'), lbl = document.getElementById('bolero-label'); if (!btn) return;
    btn.addEventListener('click', () => { if (!boleroPlaying) { startBolero(); btn.textContent = '⏸'; } else { stopBolero(); btn.textContent = '▶'; } boleroPlaying = !boleroPlaying; });
}
function startBolero() {
    if (!iac()) return;
    const themeA = [[261.63, .5], [261.63, .25], [293.66, .25], [261.63, .25], [233.08, .25], [261.63, .5], [261.63, .25], [293.66, .25], [261.63, .25], [311.13, .5], [293.66, .5], [261.63, .25], [293.66, .25], [349.23, .25], [329.63, .25], [293.66, .5], [261.63, .5], [220.00, .25], [246.94, .25], [261.63, 1.0]];
    const themeB = [[392.00, .5], [349.23, .25], [329.63, .25], [293.66, .5], [261.63, .5], [293.66, .25], [329.63, .25], [349.23, .25], [392.00, .25], [440.00, .5], [392.00, .5], [349.23, .5], [329.63, .25], [293.66, .75], [261.63, .5], [293.66, .25], [329.63, .25], [261.63, .25], [293.66, .25], [261.63, 1.0]];
    const snare = [0, 1.5, 2, 3, 4, 4.5, 5, 6, 7, 7.5];
    const bpm = 76, bl = 60 / bpm; let mt = audioContext.currentTime + .1, mc = 0;
    function pm() {
        if (!boleroPlaying) return;
        const theme = mc % 4 < 2 ? themeA : themeB, vol = .04 + Math.min(.18, mc * .006);
        let tOff = mt;
        theme.forEach(([freq, dur]) => {
            const o = audioContext.createOscillator(), g2 = audioContext.createGain(), filt = audioContext.createBiquadFilter();
            filt.type = 'bandpass'; filt.frequency.value = freq * 2; filt.Q.value = 2;
            o.type = mc < 8 ? 'sine' : mc < 16 ? 'triangle' : 'sawtooth'; o.frequency.value = freq;
            g2.gain.setValueAtTime(0, tOff); g2.gain.linearRampToValueAtTime(vol, tOff + .02); g2.gain.linearRampToValueAtTime(vol * .7, tOff + dur * bl - .05); g2.gain.linearRampToValueAtTime(0, tOff + dur * bl);
            o.connect(filt); filt.connect(g2); g2.connect(audioContext.destination); o.start(tOff); o.stop(tOff + dur * bl + .01);
            boleroNodes.push(o); tOff += dur * bl;
        });
        const md = 8 * bl;
        snare.forEach(beat => {
            const st = mt + beat * bl;
            const buf = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * .08), audioContext.sampleRate);
            const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++)d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * .3));
            const src = audioContext.createBufferSource(); src.buffer = buf;
            const sg = audioContext.createGain(); sg.gain.setValueAtTime(.08 + Math.min(.25, mc * .008), st); sg.gain.exponentialRampToValueAtTime(.001, st + .08);
            src.connect(sg); sg.connect(audioContext.destination); src.start(st); boleroNodes.push(src);
        });
        mt += md; mc++; boleroInterval = setTimeout(pm, (md - .2) * 1000);
    }
    pm();
}
function stopBolero() { if (boleroInterval) clearTimeout(boleroInterval); boleroNodes.forEach(n => { try { n.stop(); } catch (e) { } }); boleroNodes = []; }

// ═══ SKIP TO SHOP ═══
function skipToShop() {
    localStorage.setItem('inryoku_visited', '1');
    location.hash = 'shop';
    renderPhase3();
}

// ═══ vibrate helper ═══
function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {}
}
