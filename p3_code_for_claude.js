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

// ═══ 「全員違う宇宙」— シード付き疑似乱数 ═══
// 訪問者ごとに固有のシードで宇宙が生まれる
var _inryokuSeed = (function() {
    // URLパラメータ ?universe=xxxx があればそのシードを使う（シェア用）
    var params = new URLSearchParams(window.location.search);
    var shared = params.get('universe');
    if (shared) return parseInt(shared, 36) || Date.now();
    // localStorageに保存済みならそれを使う
    var stored = localStorage.getItem('inryoku_universe_seed');
    if (stored) return parseInt(stored);
    // 初回: タイムスタンプ + ランダムで生成
    var seed = Date.now() ^ (Math.random() * 0xFFFFFFFF >>> 0);
    localStorage.setItem('inryoku_universe_seed', String(seed));
    return seed;
})();

// mulberry32: 高速シード付きPRNG
function _inryokuRNG(seed) {
    var s = seed | 0;
    return function() {
        s = (s + 0x6D2B79F5) | 0;
        var t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// グローバル宇宙乱数（パーティクル配置用）
var uRng = _inryokuRNG(_inryokuSeed);

// シェアURL生成ヘルパー
function getUniverseShareURL() {
    var seedStr = (_inryokuSeed >>> 0).toString(36);
    return window.location.origin + window.location.pathname + '?universe=' + seedStr;
}

// ═══ P3 グローバル変数（p1と共存: let/const再宣言を避ける） ═══
// p1がlet currentPhase / let audioContextをグローバルで宣言済み
// var再宣言はlet/constと衝突してSyntaxErrorになるため、直接代入する
if (typeof currentPhase === 'undefined') { window.currentPhase = 0; }
if (typeof audioContext === 'undefined') { window.audioContext = null; }

// ═══ SHOPIFY STOREFRONT API CONFIG ═══
// 2026-05-09: 072xjz-qn ストア + Headless チャネルの公開アクセストークンに更新
// このトークンは Storefront API 公開アクセス専用 (公式に client-side 露出 OK)。
// CSP / connect-src に *.myshopify.com を許可済 (server.js)。
const SHOPIFY_CONFIG = {
    storeDomain: '072xjz-qn.myshopify.com',
    storefrontToken: '1a4aaf1ec1166f1e62d27f1ff0cc4b6a',
    apiVersion: '2024-10'
};

// 商品ごとの variant GID をここにまとめて入れる
// 2026-05-09 ENTER HOODIE 投入完了 (072xjz-qn ストア)
const SHOPIFY_VARIANT_MAP = {
    'enter-hoodie': {
        'S':   'gid://shopify/ProductVariant/48005115412634',
        'M':   'gid://shopify/ProductVariant/48005115445402',
        'L':   'gid://shopify/ProductVariant/48005115478170',
        'XL':  'gid://shopify/ProductVariant/48005115510938',
        '2XL': 'gid://shopify/ProductVariant/48005115543706'
    },
    'logo-hoodie': {},
    'enter-hoodie-white': {},
    'logo-hoodie-oversized': {},
    'enter-tee': {
        'S':   'gid://shopify/ProductVariant/48008480751770',
        'M':   'gid://shopify/ProductVariant/48008480784538',
        'L':   'gid://shopify/ProductVariant/48008480817306',
        'XL':  'gid://shopify/ProductVariant/48008480850074',
        '2XL': 'gid://shopify/ProductVariant/48008480882842'
    },
    'logo-tee': {},
    'enter-longsleeve': {},
    'logo-longsleeve': {},
    'enter-crewneck': {},
    'logo-crewneck': {},
    'enter-tank': {},
    'logo-tank': {}
};

// ═══ POD (Print-on-Demand) API CONFIG ═══
// 2026-05-09 司「ブランド世界観優先 — 業者名を client に露出しない」
// 各商品の _pod に印刷業者の product UID を保持 (server-side のみで使用)。
// API キーは .env に隠蔽。client は /api/pod/order を叩くだけ。
const POD_CONFIG = {
    apiEndpoint: '/api/pod/order',
    enabled: false  // 司さんが API キー設定後に true に
};

// 2026-05-21 P3 段階1.5: ?demo=1 グローバル判定 (アニメ確認専用)
//   実購入フローは走らず、UI/アニメだけが「変える状態」に見える
function __p3IsDemoMode() {
    try { return /[?&]demo=1/.test(location.search); } catch (e) { return false; }
}

function hasMappedVariant(product, size) {
    if (__p3IsDemoMode()) return true; // デモモード: 全 variant 有効化
    return !!(product && product.shopifyVariants && product.shopifyVariants[size]);
}

function isProductPurchasable(product) {
    if (__p3IsDemoMode()) return true; // デモモード: 全商品 purchasable
    return !!(product && Array.isArray(product.sizes) && product.sizes.some(function(size) {
        return hasMappedVariant(product, size);
    }));
}

function getCheckoutStatus(product, size) {
    if (!product) {
        return { available: false, message: '商品情報を読み込めませんでした' };
    }
    if (!isProductPurchasable(product)) {
        return { available: false, message: 'checkout準備中' };
    }
    if (!hasMappedVariant(product, size)) {
        return { available: false, message: 'このサイズはチェックアウト準備中' };
    }
    return { available: true, message: '' };
}

function getDefaultPurchasableSize(product) {
    if (!product || !Array.isArray(product.sizes) || product.sizes.length === 0) return '';
    return product.sizes.find(function(size) {
        return hasMappedVariant(product, size);
    }) || product.sizes[0];
}

function getProductAvailabilityLabel(product) {
    // 2026-05-09 EC launch: 文言を全UI surface で「チェックアウト準備中」に統一
    return isProductPurchasable(product) ? 'available' : 'チェックアウト準備中';
}

// 印刷業者の productUid テンプレートから size を展開 (server-side で意味あり)
function podBuildUid(template, size) {
    if (!template || !size) return null;
    return template.replace('{size}', size.toLowerCase());
}

function podCreateOrder(cartItems, shipping) {
    if (!POD_CONFIG.enabled) return Promise.reject(new Error('POD not configured'));
    var items = cartItems.map(function(it) {
        var p = PRODUCTS.find(function(x) { return x.id === it.id; });
        var uid = p && p._pod ? podBuildUid(p._pod, it.size) : null;
        return {
            productUid: uid,
            size: it.size,
            quantity: it.qty || 1,
            printFile: p && p.image ? (location.origin + '/' + p.image) : null
        };
    }).filter(function(x) { return x.productUid && x.printFile; });
    return fetch(POD_CONFIG.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items, shipping: shipping })
    }).then(function(r) { return r.json(); });
}

// Shopify Storefront API GraphQL呼び出し
function shopifyFetch(query, variables) {
    if (!SHOPIFY_CONFIG.storeDomain || !SHOPIFY_CONFIG.storefrontToken) {
        return Promise.reject(new Error('Shopify not configured'));
    }
    return fetch('https://' + SHOPIFY_CONFIG.storeDomain + '/api/' + SHOPIFY_CONFIG.apiVersion + '/graphql.json', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': SHOPIFY_CONFIG.storefrontToken
        },
        body: JSON.stringify({ query: query, variables: variables })
    }).then(function(r) { return r.json(); });
}

// Shopify カート作成 → チェックアウトURLへリダイレクト
function shopifyCheckout(cartItems) {
    var lines = cartItems.map(function(item) {
        var variantId = item.shopifyVariantId;
        if (!variantId) return null;
        return { merchandiseId: variantId, quantity: item.qty || 1 };
    }).filter(Boolean);

    if (lines.length === 0) return Promise.reject(new Error('No Shopify variants mapped'));

    var query = 'mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id checkoutUrl } userErrors { field message } } }';
    return shopifyFetch(query, {
        input: {
            lines: lines,
            attributes: [{ key: 'source', value: 'inryoku-p3' }]
        }
    }).then(function(data) {
        if (data.data && data.data.cartCreate && data.data.cartCreate.cart) {
            return data.data.cartCreate.cart.checkoutUrl;
        }
        var errors = data.data && data.data.cartCreate && data.data.cartCreate.userErrors;
        throw new Error(errors && errors.length ? errors[0].message : 'Cart creation failed');
    });
}

// ═══ PRODUCT DATA ═══
// shopifyVariants: サイズ→Shopify variant GIDのマッピング（司さんが商品登録後に埋める）
const PRODUCTS = [
    // ════════════════════════════════════════════════
    // 2026-06-08 司さん新ライン (実物デザイン6型を追加)
    //   画像は public/ に後で配置。ファイル名はここで予約。
    //   (画像未配置の間は onerror で頭文字フォールバック表示)
    // ════════════════════════════════════════════════
    {
        id: 'enter-the-inryoku-tee',
        name: 'ENTER THE inryokü TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'public/enter_the_inryoku_tee.jpg',
        description: 'グレーの中を、虹を曳いて走る。i は最初からそこにいた。',
        details: '200gsm · Oversized Fit · DTF Print · Heather Grey',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Heather Grey',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'enter-pixel-tee',
        name: 'ENTER (PIXEL) TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'public/enter_pixel_tee.jpg',
        description: 'EXIT は出口じゃない。視点を変えれば ENTER。同じ記号、違う意味。',
        details: '200gsm · Regular Fit · DTF Print · Sand Beige',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Sand Beige',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'heart-rocket-tee',
        name: 'HEART ROCKET TEE',
        price: '¥9,800',
        priceNum: 9800,
        image: 'public/heart_rocket_tee.jpg',
        description: 'ドットの惑星に、心臓が灯る。ロケットは、まだ知らない自分へ向かう。',
        details: '220gsm · Oversized Fit · DTF Print · Black',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'human-tee',
        name: 'HUMAN TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'public/human_tee.jpg',
        description: '作品名:Human / 制作年:現在 / 素材:衣服、記憶、選択。Hello world.',
        details: '200gsm · Oversized Fit · DTF Print · Black',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'yes-i-am-tee',
        name: 'YES. I am TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'public/yes_i_am_tee.jpg',
        description: 'カーソルが問いかける。"Are you human?" — YES. I am.',
        details: '200gsm · Regular Fit · DTF Print · Sky Blue',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Sky Blue',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'hello-world-tee',
        name: 'HELLO WORLD TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'public/hello_world_tee.jpg',
        description: 'HELLO WORLD — Space と Enter。最初の一歩は、いつもこの2つのキーから。',
        details: '200gsm · Oversized Fit · DTF Print · Black',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'heart-pixel-tee',
        name: 'HEART (PIXEL) TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'public/heart_pixel_tee.jpg',
        description: 'サーモグラフィのドットの心臓。Human — 体温だけが、君が生きてる証。',
        details: '200gsm · Regular Fit · DTF Print · Black',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'heart-thermo-tee',
        name: 'HEART (THERMO) TEE',
        price: '¥9,800',
        priceNum: 9800,
        image: 'public/heart_thermo_tee.jpg',
        description: '有刺鉄線に巻かれても、心臓は熱を放つ。ロケットは、その熱で飛ぶ。',
        details: '220gsm · Oversized Fit · DTF Print · Black',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'fuck-you-tee',
        name: 'F*CK YOU (MIRROR) TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'public/fuck_you_tee.jpg',
        description: '反転した言葉。鏡で読むと、意味が変わる。視点の転換 = 50%→101%。',
        details: '200gsm · Oversized Fit · DTF Print · Black',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        isQRT: false,
        shopifyVariants: {}
    },
    // ── パーカー2型 (2026-06-19 司「パーカー追加」: 既存画像で復活) ──
    {
        id: 'enter-hoodie',
        name: 'ENTER HOODIE',
        price: '¥12,800',
        priceNum: 12800,
        image: 'public/enter_hoodie.png',
        description: 'EXIT は出口じゃない。未知へ ENTER する。重厚な一着。',
        details: 'Heavyweight 400gsm · Oversized Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Washed Black',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'logo-hoodie',
        name: 'inryokü LOGO HOODIE',
        price: '¥12,800',
        priceNum: 12800,
        image: 'public/info_logo_hoodie.png',
        description: '原点。グレーの中に、すべての色が眠っている。',
        details: 'Heavyweight 400gsm · Oversized Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Washed Black',
        isQRT: false,
        shopifyVariants: {}
    }
];

PRODUCTS.forEach(function(product) {
    product.shopifyVariants = SHOPIFY_VARIANT_MAP[product.id] || product.shopifyVariants || {};
});

// ═══ Cart state management (localStorage) ═══
const CART = {
    items: JSON.parse(localStorage.getItem('inryoku_cart') || '[]'),
    save() { localStorage.setItem('inryoku_cart', JSON.stringify(this.items)); },
    add(productId, size, price, name, shopifyVariantId) {
        const existing = this.items.find(i => i.id === productId && i.size === size);
        if (existing) { existing.qty++; } else { this.items.push({ id: productId, size, price, name, qty: 1, shopifyVariantId: shopifyVariantId || '' }); }
        this.save(); this.updateBadge();
    },
    remove(idx) { this.items.splice(idx, 1); this.save(); this.updateBadge(); },
    total() { return this.items.reduce((s, i) => s + i.price * i.qty, 0); },
    count() { return this.items.reduce((s, i) => s + i.qty, 0); },
    updateBadge() {
        const badge = document.getElementById('cart-badge');
        if (badge) { const c = this.count(); badge.textContent = c; badge.style.display = c > 0 ? 'flex' : 'none'; }
    }
};

CART.items = CART.items.filter(function(item) {
    var product = PRODUCTS.find(function(p) { return p.id === item.id; });
    return product && getCheckoutStatus(product, item.size).available;
});
CART.save();

// ═══ 共有AudioContext + AnalyserNode（音響リアクティブ用・グローバル） ═══
var p3AudioCtx = null;
var p3Analyser = null;
var p3FreqData = null;
var p3AudioEnergy = 0;

function initP3Audio() {
    if (p3AudioCtx) return;
    try {
        p3AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        p3Analyser = p3AudioCtx.createAnalyser();
        p3Analyser.fftSize = 256;
        p3Analyser.smoothingTimeConstant = 0.8;
        p3Analyser.connect(p3AudioCtx.destination);
        p3FreqData = new Uint8Array(p3Analyser.frequencyBinCount);
    } catch(e) { console.warn('[P3Audio] init failed:', e); }
}

function updateAudioEnergy() {
    if (!p3Analyser || !p3FreqData) return;
    p3Analyser.getByteFrequencyData(p3FreqData);
    var bass = 0, mid = 0, high = 0;
    var len = p3FreqData.length;
    var bassEnd = Math.floor(len * 0.15);
    var midEnd = Math.floor(len * 0.5);
    for (var i = 0; i < len; i++) {
        if (i < bassEnd) bass += p3FreqData[i];
        else if (i < midEnd) mid += p3FreqData[i];
        else high += p3FreqData[i];
    }
    bass /= (bassEnd * 255);
    mid /= ((midEnd - bassEnd) * 255);
    high /= ((len - midEnd) * 255);
    p3AudioEnergy = bass * 0.5 + mid * 0.35 + high * 0.15;
    // 2026-04-30: 帯域別 export（shader uniform / Light Bridge 頻度で使用）
    // 非対称 EMA: 立ち上がり速・減衰遅 → ビート感を残しつつチラつき抑制
    window.p3AudioBands = window.p3AudioBands || { bass: 0, mid: 0, high: 0 };
    var _b = window.p3AudioBands;
    _b.bass += (bass - _b.bass) * (bass > _b.bass ? 0.4 : 0.1);
    _b.mid  += (mid  - _b.mid ) * 0.2;
    _b.high += (high - _b.high) * (high > _b.high ? 0.5 : 0.15);
}

// ═══ 3Dロゴ球体（PNGを置き換え） ═══
// Three.js SphereGeometry + カスタムシェーダー
// 虹色ニュートンリング + フレネル + 回転 + 脈動
function init3DLogoSphere() {
    // 2026-04-24: 司要望 — P2 の RGBCMY 球体 (rcSphere) と同じシェーダーを P3 ロゴに搭載
    // PNG img を非表示、canvas で i ドット位置に 3D 球を描画
    try {
        // 2026-04-30: WebGL context lost → 30 回連続再試行で「context could not be created」が
        // コンソールを埋め尽くすバグの対策。renderer が掴めた時点で成功キャッシュ、
        // 失敗時は _p3LogoSphere3DFailed フラグを立てて再呼出をブロック。
        if (window._p3LogoSphere3D && window._p3LogoSphere3D.renderer) {
            return window._p3LogoSphere3D; // 既に初期化済み（成功キャッシュ）
        }
        if (window._p3LogoSphere3DFailed) {
            return null; // 1度失敗したら再試行しない（WebGL context type lock 回避）
        }

        var imgEl = document.querySelector('.logo-sphere');
        var wrap  = document.querySelector('.logo-holo-wrap');
        if (!imgEl || !wrap || typeof THREE === 'undefined') return null;

        // 2026-05-09: ロゴ巨大化バグの再発防止。p3_styles.css 未読込時の clamp(90, 12vw, 140) フォールバック。
        // wrap.offsetWidth > 200 は CSS 制約が効いてない兆候 → 強制 140px に落とす。
        var wrapW = Math.max(wrap.offsetWidth, 60);
        if (wrapW > 200) {
            console.warn('[init3DLogoSphere] wrap too wide (' + wrapW + 'px), p3_styles.css 未読込の可能性。140px に clamp。');
            wrapW = 140;
        }
        var candleSize = Math.round(wrapW * 0.30); // 卵の i ドット — 司 30%
        var pxRatio = Math.min(window.devicePixelRatio || 1, 2);

        var canvas = document.createElement('canvas');
        canvas.className = 'logo-sphere-3d';
        canvas.width  = candleSize * pxRatio;
        canvas.height = candleSize * pxRatio;
        canvas.style.cssText = [
            'position: absolute',
            'top: 22%',                            // 司微調整
            'left: 50%',
            'transform: translateX(-50%)',
            'width: '  + candleSize + 'px',
            'height: ' + candleSize + 'px',
            'z-index: 3',
            'pointer-events: none',
            // initBrandParticleReveal が黒背景の中で点灯させる
            'opacity: 0'
        ].join(';');

        var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(pxRatio);
        renderer.setSize(candleSize, candleSize, false);
        renderer.setClearColor(0x000000, 0);

        var scene  = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
        camera.position.set(0, 0, 3.1);
        camera.lookAt(0, 0, 0);

        // ── P2 と完全に同一の vertex / fragment シェーダー (rcSphere / rcFrag / sVert) ──
        var sVert = [
            'varying vec3 vNormal;',
            'varying vec3 vViewDir;',
            'varying vec2 vUv;',
            'void main(){',
            '    vec4 wPos = modelMatrix * vec4(position, 1.0);',
            '    vNormal  = normalize(normalMatrix * normal);',
            '    vViewDir = normalize(cameraPosition - wPos.xyz);',
            '    vUv      = uv;',
            '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n');

        var rcFrag = [
            'precision highp float;',
            'uniform float u_time;',
            'uniform float u_hover;',
            'uniform float u_clickT;',
            'uniform float u_morph;',
            'uniform float u_phaseMix;',
            'uniform float u_speechPulse;',
            'uniform vec3 u_phaseColor;',
            'varying vec3 vNormal;',
            'varying vec3 vViewDir;',
            'varying vec2 vUv;',
            '',
            'float h1(float n){ return fract(sin(mod(n, 300.0) * 127.1) * 43758.545); }',
            'float noise3(vec3 p){',
            '    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.-2.*f);',
            '    float a = h1(i.x + i.y*57. + i.z*113.);',
            '    float b = h1(i.x+1. + i.y*57. + i.z*113.);',
            '    float c = h1(i.x + (i.y+1.)*57. + i.z*113.);',
            '    float d = h1(i.x+1. + (i.y+1.)*57. + i.z*113.);',
            '    float e = h1(i.x + i.y*57. + (i.z+1.)*113.);',
            '    float f2= h1(i.x+1. + i.y*57. + (i.z+1.)*113.);',
            '    float g = h1(i.x + (i.y+1.)*57. + (i.z+1.)*113.);',
            '    float hh= h1(i.x+1. + (i.y+1.)*57. + (i.z+1.)*113.);',
            '    return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),',
            '               mix(mix(e,f2,f.x),mix(g,hh,f.x),f.y),f.z);',
            '}',
            '',
            'void main(){',
            '    float phi   = vUv.x * 6.28318;',
            '    float theta = vUv.y * 3.14159;',
            '    vec3 sPos = vec3(sin(theta)*cos(phi), cos(theta), sin(theta)*sin(phi));',
            '    float spd = 0.10 + u_hover * 0.05 + u_clickT * 0.08 + u_speechPulse * 0.05;',
            '    float t   = u_time * spd;',
            '    vec3 nOff = vec3(',
            '        noise3(sPos * 2.5 + vec3(t,    0.,   0.)) * 2. - 1.,',
            '        noise3(sPos * 2.5 + vec3(0., t*0.8,  0.)) * 2. - 1.,',
            '        noise3(sPos * 2.5 + vec3(0.,   0., t*0.6))* 2. - 1.',
            '    );',
            '    vec3 wPos = normalize(sPos + nOff * 0.28);',
            // 2026-04-24: 司「b (12極) で」 — 6色 → 12色
            '    vec3 dirs[12];',
            '    dirs[0]=vec3(1.,0.,0.); dirs[1]=vec3(-1.,0.,0.);',
            '    dirs[2]=vec3(0.,1.,0.); dirs[3]=vec3(0.,-1.,0.);',
            '    dirs[4]=vec3(0.,0.,1.); dirs[5]=vec3(0.,0.,-1.);',
            '    dirs[6]=normalize(vec3(1.,1.,0.));   dirs[7]=normalize(vec3(-1.,-1.,0.));',
            '    dirs[8]=normalize(vec3(0.,1.,1.));   dirs[9]=normalize(vec3(0.,-1.,-1.));',
            '    dirs[10]=normalize(vec3(1.,0.,1.));  dirs[11]=normalize(vec3(-1.,0.,-1.));',
            '    vec3 cols[12];',
            '    cols[0]=vec3(1.,0.,0.);       cols[1]=vec3(0.,1.,1.);',
            '    cols[2]=vec3(0.,1.,0.);       cols[3]=vec3(1.,0.,1.);',
            '    cols[4]=vec3(0.,0.,1.);       cols[5]=vec3(1.,1.,0.);',
            '    cols[6]=vec3(1.0,0.45,0.);    cols[7]=vec3(0.0,0.55,1.0);',
            '    cols[8]=vec3(0.0,1.0,0.6);    cols[9]=vec3(1.0,0.25,0.55);',
            '    cols[10]=vec3(0.75,0.25,1.); cols[11]=vec3(0.85,0.85,0.2);',
            '    vec3 result = vec3(0.); float total = 0.;',
            '    for(int i = 0; i < 12; i++){',
            '        float w = max(0., dot(wPos, dirs[i]));',
            '        w = w * w * w;',
            '        result += cols[i] * w; total += w;',
            '    }',
            '    result /= max(total, 0.001);',
            '    vec3 N = normalize(vNormal);',
            '    vec3 V = normalize(vViewDir);',
            '    vec3 L = normalize(vec3(0.5, 0.7, 1.0));',
            '    float diff    = max(dot(N, L), 0.0);',
            '    float ambient = 0.05;',
            '    vec3  H    = normalize(L + V);',
            '    float spec = pow(max(dot(N, H), 0.0), 72.0) * 0.18;',
            '    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 1.8);',
            '    float frStr   = 0.74 + u_hover * 0.28 + u_clickT * 0.16 + u_speechPulse * 0.18;',
            '    vec3  frCol   = mix(vec3(0.58), u_phaseColor, 0.45) * fresnel * frStr;',
            '    float emissive = 0.045 + u_hover * 0.05 + u_clickT * 0.04 + u_speechPulse * 0.05;',
            '    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);',
            '    vec3 phaseBase = mix(result, u_phaseColor, u_phaseMix);',
            '    vec3 rimLight = phaseBase * rim * (0.15 + u_phaseMix * 0.18) + vec3(0.26, 0.30, 0.36) * rim * 0.07;',
            '    rimLight += u_phaseColor * rim * (u_hover * 0.08 + u_speechPulse * 0.14);',
            '    vec3 col = phaseBase * (ambient + diff * 0.82)',
            '             + phaseBase * emissive',
            '             + frCol',
            '             + vec3(spec)',
            '             + rimLight;',
            '    col = mix(col, vec3(1.0), u_clickT * 0.26 + u_speechPulse * 0.10);',
            '    if (u_morph > 0.0) {',
            '        float grey = dot(col, vec3(0.299, 0.587, 0.114));',
            '        vec3 holoGrey = vec3(grey) * 0.92;',
            '        float fr = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.5);',
            '        holoGrey += u_phaseColor * fr * 0.16;',
            '        col = mix(col, holoGrey, u_morph);',
            '    }',
            '    gl_FragColor = vec4(col, 1.0);',
            '}'
        ].join('\n');

        var uniforms = {
            u_time:{value:0},
            u_hover:{value:0},
            u_clickT:{value:0},
            u_morph:{value:0},
            u_phaseMix:{value:0.08},
            u_speechPulse:{value:0.0},
            u_phaseColor:{value:new THREE.Vector3(0.72, 0.78, 0.84)}
        };
        var mat = new THREE.ShaderMaterial({ vertexShader: sVert, fragmentShader: rcFrag, uniforms: uniforms });
        var geo = new THREE.SphereGeometry(1, 64, 64);
        var sphere = new THREE.Mesh(geo, mat);
        scene.add(sphere);

        // 2026-05-09: 司「コア/生成/世界」へ転換 — 'observe' は内部識別子としてのみ温存。
        // セマンティクスは「焦点 (focus / 視点が定まる)」 = コアに視線が合う相。
        // 改名すると LOGO_PHASES_BY_REGISTER / canonMeta / phase resolver の契約が壊れるため未変更。
        var LOGO_PHASES = {
            idle:       { color: [0.72, 0.78, 0.84], mix: 0.08, pulse: 0.00, spin: 0.02, tilt: 0.038, drift: 0.05,  priority: 0, hold:   0 },
            observe:    { color: [1.00, 0.90, 0.28], mix: 0.18, pulse: 0.06, spin: 0.05, tilt: 0.045, drift: 0.11, priority: 1, hold: 680 }, // = 焦点相 (旧: 観測相)
            shadow:     { color: [0.20, 0.55, 1.00], mix: 0.16, pulse: 0.04, spin: 0.04, tilt: 0.042, drift: 0.08, priority: 2, hold: 860 },
            emit:       { color: [0.22, 0.95, 0.95], mix: 0.22, pulse: 0.12, spin: 0.08, tilt: 0.048, drift: 0.14, priority: 3, hold: 980 },
            resonance:  { color: [0.98, 0.30, 0.78], mix: 0.26, pulse: 0.15, spin: 0.09, tilt: 0.052, drift: 0.16, priority: 3, hold: 1180 },
            summon:     { color: [0.18, 0.95, 0.42], mix: 0.32, pulse: 0.20, spin: 0.07, tilt: 0.046, drift: 0.12, priority: 4, hold: 1680 },
            revelation: { color: [1.00, 0.45, 0.15], mix: 0.40, pulse: 0.24, spin: 0.10, tilt: 0.055, drift: 0.18, priority: 4, hold: 1560 }
        };
        var canonMeta = window.InryokuCanonMeta || null;
        var FALLBACK_CANON_PHASE_RULES = {
            summon:           { phase: 'summon',     hold: 1800, priority: 4 },
            revelation:       { phase: 'revelation', hold: 1640, priority: 4 },
            leap:             { phase: 'revelation', hold: 1460, priority: 4 },
            future_command:   { phase: 'revelation', hold: 1280, priority: 4 },
            resonance:        { phase: 'resonance',  hold: 1320, priority: 3 },
            consensus:        { phase: 'resonance',  hold: 1280, priority: 3 },
            emit:             { phase: 'emit',       hold: 1040, priority: 3 },
            declaration:      { phase: 'emit',       hold: 1120, priority: 3 },
            quotation:        { phase: 'shadow',     hold: 960,  priority: 2 },
            past_speculation: { phase: 'shadow',     hold: 1040, priority: 2 },
            shadow:           { phase: 'shadow',     hold: 980,  priority: 2 },
            echo:             { phase: 'shadow',     hold: 820,  priority: 2 },
            observation:      { phase: 'observe',    hold: 920,  priority: 2 },
            self_question:    { phase: 'observe',    hold: 980,  priority: 2 },
            core:             { phase: 'idle',       hold: 520,  priority: 1 },
            ma:               { phase: 'idle',       hold: 620,  priority: 1 },
            silence:          { phase: 'idle',       hold: 460,  priority: 1 }
        };

        var logoState = {
            phase: 'idle',
            target: LOGO_PHASES.idle,
            phasePriority: 0,
            phaseUntil: 0,
            hoverActive: false,
            clickPulse: 0,
            speechBoost: 0,
            phaseDrift: 0
        };

        function getPhasePreset(name) {
            return LOGO_PHASES[name] || LOGO_PHASES.idle;
        }

        function currentTimeMs() {
            return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        }

        function getFallbackPhase() {
            return logoState.hoverActive ? 'observe' : 'idle';
        }

        function setPhase(name, opts) {
            opts = opts || {};
            var target = getPhasePreset(name);
            var now = currentTimeMs();
            var priority = typeof opts.priority === 'number' ? opts.priority : target.priority || 0;
            var hold = typeof opts.hold === 'number' ? opts.hold : target.hold || 0;
            if (opts.force !== true && now < logoState.phaseUntil && priority < logoState.phasePriority) return false;
            logoState.phase = name;
            logoState.target = target;
            logoState.phasePriority = priority;
            logoState.phaseUntil = hold > 0 ? now + hold : 0;
            return true;
        }

        function applyCanonPhase(canonName, register) {
            var rule = canonMeta && typeof canonMeta.getPhaseRule === 'function'
                ? canonMeta.getPhaseRule(canonName, register)
                : null;
            if (!rule) rule = FALLBACK_CANON_PHASE_RULES[canonName] || null;
            if (!rule && register === 'click') rule = { phase: 'emit', hold: 1020, priority: 3 };
            if (!rule && register === 'hover') rule = { phase: 'observe', hold: 860, priority: 1 };
            if (!rule) rule = { phase: 'idle', hold: 480, priority: 1 };
            setPhase(rule.phase, { hold: rule.hold, priority: rule.priority });
        }

        function settlePhase() {
            var fallback = getFallbackPhase();
            if (logoState.phase !== fallback) {
                setPhase(fallback, { force: true, priority: LOGO_PHASES[fallback].priority || 0, hold: 0 });
            }
        }

        // canvas を wrap に挿入、PNG img を非表示
        wrap.appendChild(canvas);
        imgEl.style.display = 'none';

        // 回転アニメ + uniform 更新
        var clock = new THREE.Clock();
        var alive = true;
        function loop() {
            if (!alive) return;
            var dt = clock.getDelta();
            var now = currentTimeMs();
            if (logoState.phaseUntil && now >= logoState.phaseUntil) {
                logoState.phaseUntil = 0;
                logoState.phasePriority = 0;
                settlePhase();
            }
            logoState.phaseDrift += dt * (logoState.target.drift || 0.05);
            uniforms.u_time.value = logoState.phaseDrift;
            var target = logoState.target || LOGO_PHASES.idle;
            var color = uniforms.u_phaseColor.value;
            color.x += (target.color[0] - color.x) * 0.085;
            color.y += (target.color[1] - color.y) * 0.085;
            color.z += (target.color[2] - color.z) * 0.085;
            uniforms.u_phaseMix.value += (target.mix - uniforms.u_phaseMix.value) * 0.08;
            logoState.speechBoost += (target.pulse - logoState.speechBoost) * 0.07;
            logoState.clickPulse = Math.max(0, logoState.clickPulse - dt * 1.2);
            uniforms.u_clickT.value += ((logoState.clickPulse > 0 ? logoState.clickPulse : 0) - uniforms.u_clickT.value) * 0.14;
            uniforms.u_speechPulse.value += (logoState.speechBoost - uniforms.u_speechPulse.value) * 0.12;
            sphere.rotation.y += dt * target.spin;
            sphere.rotation.x += (target.tilt - sphere.rotation.x) * 0.06;
            renderer.render(scene, camera);
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);

        // hover/click interaction (P2 と同じトリガー)
        function setHover(v) {
            var target = v ? 1 : 0;
            var start = uniforms.u_hover.value;
            var t0 = performance.now();
            logoState.hoverActive = !!v;
            if (v) {
                setPhase('observe', { priority: 1, hold: 0 });
            } else if (logoState.phasePriority <= 1 || !logoState.phaseUntil) {
                settlePhase();
            }
            (function ease(){
                var p = Math.min(1, (performance.now()-t0)/260);
                uniforms.u_hover.value = start + (target - start) * p;
                if (p < 1) requestAnimationFrame(ease);
            })();
        }
        function handlePointerEnter(){ setHover(true); }
        function handlePointerLeave(){ setHover(false); }
        function handlePointerDown(){
            logoState.clickPulse = 1;
            setPhase('emit', { priority: 3, hold: 980 });
        }
        wrap.addEventListener('pointerenter', handlePointerEnter);
        wrap.addEventListener('pointerleave', handlePointerLeave);
        wrap.addEventListener('pointerdown', handlePointerDown);

        var ref = {
            canvas: canvas, renderer: renderer, scene: scene, camera: camera,
            uniforms: uniforms, sphere: sphere,
            setPhase: setPhase,
            getPhase: function(){ return logoState.phase; },
            setSpeechCanon: function(canonName, register){
                logoState.clickPulse = register === 'click' ? 1 : Math.max(logoState.clickPulse, 0.36);
                applyCanonPhase(canonName, register);
            },
            clearSpeechCanon: function(){
                logoState.phaseUntil = 0;
                logoState.phasePriority = 0;
                settlePhase();
            },
            dispose: function(){
                alive = false;
                try {
                    wrap.removeEventListener('pointerenter', handlePointerEnter);
                    wrap.removeEventListener('pointerleave', handlePointerLeave);
                    wrap.removeEventListener('pointerdown', handlePointerDown);
                } catch(e){}
                try { geo.dispose(); mat.dispose(); renderer.forceContextLoss(); renderer.dispose(); } catch(e){}
                if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
                imgEl.style.display = '';
                window._p3LogoSphere3D = null;
            }
        };
        window._p3LogoSphere3D = ref;
        return ref;
    } catch(err) {
        console.warn('[init3DLogoSphere] failed, fallback to PNG:', err);
        window._p3LogoSphere3DFailed = true; // 再試行ブロック (WebGL context type lock 対策)
        return null;
    }
}

// ═══ ロゴ専用ホログラム視差 ═══
// WebGL/Canvasを増やさず、CSS変数だけで投影レイヤーに奥行きを与える。
function initLogoHologramParallax() {
    var wrap = document.querySelector('.logo-holo-wrap');
    if (!wrap) return;

    if (window._inryokuLogoParallaxCleanup) {
        window._inryokuLogoParallaxCleanup();
        window._inryokuLogoParallaxCleanup = null;
    }

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    var targetX = 0;
    var targetY = 0;
    var currentX = 0;
    var currentY = 0;
    var raf = 0;
    var running = true;

    function setTargetFromPoint(x, y) {
        var rect = wrap.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        targetX = Math.max(-1, Math.min(1, (x - cx) / Math.max(rect.width * 2.1, 1)));
        targetY = Math.max(-1, Math.min(1, (y - cy) / Math.max(rect.height * 1.7, 1)));
    }

    function onPointerMove(e) {
        setTargetFromPoint(e.clientX, e.clientY);
    }

    function onPointerLeave() {
        targetX = 0;
        targetY = 0;
    }

    function onDeviceOrientation(e) {
        if (typeof e.gamma === 'number') targetX = Math.max(-1, Math.min(1, e.gamma / 24));
        if (typeof e.beta === 'number') targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 32));
    }

    function tick() {
        if (!running) return;
        currentX += (targetX - currentX) * 0.075;
        currentY += (targetY - currentY) * 0.075;
        wrap.style.setProperty('--holo-tilt-y', (currentX * 7).toFixed(3) + 'deg');
        wrap.style.setProperty('--holo-tilt-x', (-currentY * 5).toFixed(3) + 'deg');
        wrap.style.setProperty('--holo-shift-x', (currentX * 1.8).toFixed(3) + 'px');
        wrap.style.setProperty('--holo-shift-y', (currentY * 1.2).toFixed(3) + 'px');
        raf = requestAnimationFrame(tick);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    raf = requestAnimationFrame(tick);

    window._inryokuLogoParallaxCleanup = function() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('deviceorientation', onDeviceOrientation);
    };
}
function init3DLogoSphere_disabled() {
    var imgEl = document.querySelector('.logo-sphere');
    var wrap = document.querySelector('.logo-holo-wrap');
    if (!imgEl || !wrap || typeof THREE === 'undefined') return null;

    // canvasでキャンドル位置に小さな3Dロゴを配置
    var canvas = document.createElement('canvas');
    var wrapW = Math.max(wrap.offsetWidth, 60);
    var candleSize = Math.round(wrapW * 0.42);  // シェル幅の42%
    canvas.width = candleSize * 2;  // 高解像度
    canvas.height = candleSize * 2;
    // cssTextコピーは廃止（img の transition/transform 等が混入してズレるため）
    canvas.className = 'logo-sphere-3d';  // .logo-sphere クラスは付けない（ブランドリビール対象外にする）
    canvas.style.cssText = [
        'position: absolute',
        'top: 19%',
        'left: 50%',
        'transform: translateX(-50%)',
        'width: ' + candleSize + 'px',
        'height: ' + candleSize + 'px',
        'z-index: 3',
        'pointer-events: none',
        'mix-blend-mode: screen'
    ].join(';');

    // Three.jsセットアップ（ロゴ専用の小さなレンダラー）
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(candleSize * 2, candleSize * 2);
    renderer.setClearColor(0x000000, 0);  // 透明背景
    renderer.setPixelRatio(1);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3.2);
    camera.lookAt(0, 0, 0);

    // ── 球体ジオメトリ ──
    var geo = new THREE.SphereGeometry(1, 64, 64);

    // ── カスタムシェーダー: 虹色ニュートンリング + フレネル + 内部発光 ──
    var mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uPulse: { value: 0.0 },
            uAudioEnergy: { value: 0.0 }
        },
        vertexShader: [
            'varying vec3 vNormal;',
            'varying vec3 vViewDir;',
            'varying vec2 vUv;',
            'void main() {',
            '    vNormal = normalize(normalMatrix * normal);',
            '    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
            '    vViewDir = normalize(-mvPos.xyz);',
            '    vUv = uv;',
            '    gl_Position = projectionMatrix * mvPos;',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform float uTime;',
            'uniform float uPulse;',
            'uniform float uAudioEnergy;',
            'varying vec3 vNormal;',
            'varying vec3 vViewDir;',
            'varying vec2 vUv;',
            '',
            '// 6色スペクトル（RGBCMY）',
            'vec3 spectrum(float t) {',
            '    vec3 c = vec3(0.0);',
            '    float tt = fract(t) * 6.0;',
            '    if (tt < 1.0) c = mix(vec3(1,0,0), vec3(1,1,0), tt);',
            '    else if (tt < 2.0) c = mix(vec3(1,1,0), vec3(0,1,0), tt-1.0);',
            '    else if (tt < 3.0) c = mix(vec3(0,1,0), vec3(0,1,1), tt-2.0);',
            '    else if (tt < 4.0) c = mix(vec3(0,1,1), vec3(0,0,1), tt-3.0);',
            '    else if (tt < 5.0) c = mix(vec3(0,0,1), vec3(1,0,1), tt-4.0);',
            '    else c = mix(vec3(1,0,1), vec3(1,0,0), tt-5.0);',
            '    return c;',
            '}',
            '',
            'void main() {',
            '    // フレネル（エッジほど虹が強い）',
            '    float fresnel = 1.0 - abs(dot(vNormal, vViewDir));',
            '    fresnel = pow(fresnel, 2.5);',
            '',
            '    // ニュートンリング（球面座標ベース — 6波長干渉）',
            '    float theta = acos(vNormal.y);',
            '    float phi = atan(vNormal.z, vNormal.x);',
            '    float ringFreq = 8.0 + uAudioEnergy * 4.0;',
            '    float ring = sin(theta * ringFreq + uTime * 0.3) * 0.5 + 0.5;',
            '    ring *= sin(phi * 6.0 - uTime * 0.5) * 0.3 + 0.7;',
            '',
            '    // スペクトル色（時間 + 角度で流れる虹）',
            '    float specT = theta * 0.5 + phi * 0.15 + uTime * 0.08;',
            '    vec3 rainbow = spectrum(specT);',
            '',
            '    // 2層目: 補色の干渉パターン',
            '    float specT2 = theta * 0.3 - phi * 0.2 + uTime * 0.12 + 0.5;',
            '    vec3 rainbow2 = spectrum(specT2);',
            '',
            '    // 干渉合成',
            '    vec3 iridescent = mix(rainbow, rainbow2, ring * 0.4);',
            '',
            '    // グレーベース（inryokü哲学: グレーの中に虹がある）',
            '    vec3 grey = vec3(0.45);',
            '    vec3 color = mix(grey, iridescent, fresnel * 0.85 + 0.15);',
            '',
            '    // 内部発光（コア）',
            '    float core = pow(max(dot(vNormal, vViewDir), 0.0), 4.0);',
            '    color += vec3(0.3, 0.35, 0.4) * core * 0.3;',
            '',
            '    // エッジグロー',
            '    float edgeGlow = pow(fresnel, 4.0);',
            '    color += iridescent * edgeGlow * 0.6;',
            '',
            '    // 脈動（明るさの呼吸）',
            '    float pulse = 1.0 + uPulse * 0.15;',
            '    color *= pulse;',
            '',
            '    // アルファ（球体の縁は完全不透明、外側は透明）',
            '    float alpha = smoothstep(0.0, 0.15, 1.0 - fresnel) * 0.95 + 0.05;',
            '',
            '    gl_FragColor = vec4(color, alpha);',
            '}'
        ].join('\n'),
        transparent: true,
        side: THREE.FrontSide
    });

    var sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    // PNGを非表示にしてcanvasを追加
    imgEl.style.display = 'none';
    wrap.appendChild(canvas);

    // ── アニメーションループ ──
    var startTime = performance.now();
    var animId = null;

    function animate() {
        animId = requestAnimationFrame(animate);
        var elapsed = (performance.now() - startTime) * 0.001;

        mat.uniforms.uTime.value = elapsed;
        mat.uniforms.uPulse.value = Math.sin(elapsed * 1.2) * 0.5 + 0.5;
        mat.uniforms.uAudioEnergy.value = p3AudioEnergy || 0;

        // ゆっくり回転（Y軸 + 微小なX軸傾き）
        sphere.rotation.y = elapsed * 0.25;
        sphere.rotation.x = Math.sin(elapsed * 0.15) * 0.1;

        renderer.render(scene, camera);
    }
    animate();

    // 外部からアクセス可能なオブジェクトを返す
    return {
        canvas: canvas,
        renderer: renderer,
        sphere: sphere,
        material: mat,
        stop: function() { if (animId) cancelAnimationFrame(animId); },
        // ブランドリビール用: 球体の画面中心座標を返す
        getCenter: function() {
            var r = canvas.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
    };
}

// ═══ PHASE 6 メインエントリー ═══
var _p3Initialized = false;
function renderPhase3() {
    if (_p3Initialized) return;
    _p3Initialized = true;
    currentPhase = 3;
    localStorage.setItem('inryoku_visited', '1');
    console.log('[inryokü] Your universe seed:', _inryokuSeed);
    console.log('[inryokü] Share your universe:', getUniverseShareURL());

    // ── Ref tracking: ?ref= パラメータ検出 → サーバーに通知 ──
    (function() {
        var params = new URLSearchParams(window.location.search);
        var refCode = params.get('ref');
        if (refCode) {
            console.log('[inryokü] Referred by:', refCode);
            // サーバーにスキャン記録を送信
            fetch('/api/ref/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ref: refCode })
            }).then(function(r) { return r.json(); }).then(function(data) {
                if (data.level) {
                    console.log('[inryokü] Referrer level:', data.level.name, '(scans:', data.scans, ')');
                }
            }).catch(function(e) {
                console.warn('[inryokü] Ref tracking failed:', e);
            });
            // refパラメータをURLから除去（履歴は残さない）
            var cleanURL = new URL(window.location);
            cleanURL.searchParams.delete('ref');
            window.history.replaceState({}, '', cleanURL.toString());
        }
    })();

    // ── P2→P3 遷移: WebGL球体のシームレス引き継ぎ ──────────────────────
    // P2の黒フェード (#p2-fade-ov) をゆっくり消す
    const p2ov = document.getElementById('p2-fade-ov');
    if (p2ov) {
        p2ov.style.pointerEvents = 'none';
        requestAnimationFrame(() => requestAnimationFrame(() => {
            p2ov.style.transition = 'opacity 2.0s ease';
            p2ov.style.opacity = '0';
            setTimeout(() => { if (p2ov.parentNode) p2ov.remove(); }, 2200);
        }));
    }
    // P2のWebGL球体ブリッジ → logo-sphere位置へ3Dアニメーション → クロスフェード
    const bridge = window._p2Bridge;
    if (bridge) {
        // P2キャンバスをP3コンテンツの上に保持（z-index高め）
        bridge.renderer.domElement.style.zIndex = '200';
        bridge.renderer.domElement.style.pointerEvents = 'none';

        // P3のDOMが描画されるのを待ってから球体をアニメーション開始
        setTimeout(() => {
            const logoSphereEl = document.querySelector('.logo-sphere');
            const logoWrap = document.querySelector('.logo-holo-wrap');
            if (!logoSphereEl || !logoWrap) {
                // フォールバック: 即座にクリーンアップ
                bridge.dispose();
                return;
            }

            // logo-sphereの画面上の位置を取得
            const targetRect = logoWrap.getBoundingClientRect();
            const targetScreenX = targetRect.left + targetRect.width / 2;
            const targetScreenY = targetRect.top + targetRect.height / 2;
            // 画面座標 → NDC
            const targetNDC_X =  (targetScreenX / window.innerWidth) * 2 - 1;
            const targetNDC_Y = -(targetScreenY / window.innerHeight) * 2 + 1;

            // NDC → 3Dワールド座標（カメラz=8, 球体z=0平面）
            const fovRad = bridge.camera.fov * Math.PI / 180;
            const halfH = Math.tan(fovRad / 2) * bridge.camera.position.z;
            const halfW = halfH * bridge.camera.aspect;
            const targetX = targetNDC_X * halfW;
            const targetY = targetNDC_Y * halfH;
            // ターゲットスケール: logo-sphere のピクセルサイズ → 3D単位
            const targetRadius = targetRect.width / 2;
            const pixelsPerUnit = window.innerHeight / (2 * halfH);
            const targetScale = targetRadius / pixelsPerUnit / 0.9; // 0.9 = sphereGeo radius

            // 開始値を記録
            const startX = bridge.sphere.position.x;
            const startY = bridge.sphere.position.y;
            const startScale = bridge.sphere.scale.x;
            const startMorph = bridge.uni.u_morph.value;

            // P3のlogo-sphereを最初は非表示に（P2球が到達したら表示）
            logoSphereEl.style.opacity = '0';
            logoSphereEl.style.transition = 'none';

            const TRANSITION_DURATION = 2.0; // 2秒
            const tStart = performance.now();

            (function morphLoop() {
                const elapsed = (performance.now() - tStart) / 1000;
                const p = Math.min(1, elapsed / TRANSITION_DURATION);
                const ease = p * p * (3 - 2 * p); // smoothstep

                // 球を logo-sphere 位置へスライド
                bridge.sphere.position.x = startX + (targetX - startX) * ease;
                bridge.sphere.position.y = startY + (targetY - startY) * ease;
                bridge.sphere.scale.setScalar(startScale + (targetScale - startScale) * ease);
                bridge.sphere.rotation.y += 0.008; // ゆっくり回転

                // シェーダーをさらにホログラフィックに
                bridge.uni.u_morph.value = startMorph + (1.0 - startMorph) * ease;

                // P2キャンバスのフェードアウト（後半50%で）
                if (p > 0.5) {
                    const fadeP = (p - 0.5) / 0.5;
                    bridge.renderer.domElement.style.opacity = String(1.0 - fadeP);
                    // P3のlogo-sphereをフェードイン
                    logoSphereEl.style.transition = 'none';
                    logoSphereEl.style.opacity = String(fadeP);
                }

                // レンダー
                bridge.renderer.render(bridge.scene, bridge.camera);

                if (p < 1) {
                    requestAnimationFrame(morphLoop);
                } else {
                    // 遷移完了 — P2リソースを完全クリーンアップ
                    logoSphereEl.style.transition = '';
                    logoSphereEl.style.opacity = '1';
                    bridge.dispose();
                    console.log('✅ P2→P3 WebGL sphere transition complete');
                }
            })();
        }, 600); // P3 DOMが描画されるのを待つ
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
    // モバイル: スクロール許可 / デスクトップ: hidden
    var _isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth < 768 && 'ontouchstart' in window);
    document.body.style.overflow = _isMobile ? 'auto' : 'hidden';

    // ── BGM セレクタ（複数曲から選択） ──
    // 全曲 Wikimedia Commons パブリックドメイン
    // 全曲パブリックドメイン — Internet Archive MP3（Safari/全ブラウザ対応）
    const BGM_TRACKS = [
        { id: 'jupiter',    name: 'Jupiter',           emoji: '♃', url: 'vendor/jupiter.mp3' },
        { id: 'newworld',   name: '新世界 第2楽章',     emoji: '🌍', url: 'https://archive.org/download/DvorakSymphonyNo.9fromTheNewWorld/02_Largo.mp3' },
        { id: 'bolero',     name: 'Boléro',            emoji: '🥁', url: 'https://archive.org/download/ravel-bolero/RAVEL_BOLERO.mp3' },
        { id: 'gstring',    name: 'G線上のアリア',      emoji: '🎻', url: 'https://archive.org/download/Bach-airOnTheGString/LaMusicaClasicaMasRelajanteDelMundo-Bach-AirOnTheGString.mp3' },
        { id: 'clairdelune',name: '月の光',             emoji: '🌙', url: 'https://archive.org/download/ClairDeLunedebussy/2009-03-30-clairdelune.mp3' },
        { id: 'gymnopedie', name: 'Gymnopédie No.1',   emoji: '🍃', url: 'https://archive.org/download/GymnopedieNo.1/Gymnopedie%20No.1.mp3' },
        { id: 'gnossienne', name: 'Gnossienne',        emoji: '🔮', url: 'https://archive.org/download/ThreeGnossiennesErikSatie/gnossiennes.mp3' }
    ];
    var currentBGMIdx = 0; // デフォルト: Jupiter
    let p6bgm = null;
    let bgmFading = false;

function fadeBGMIn() {
        if (bgmFading || !p6bgm) return;
        bgmFading = true;
        const BGM_TARGET = 0.5;
        const BGM_FADE_MS = 3000;
        const t0 = performance.now();
        function fadeStep(now) {
            const p = Math.min((now - t0) / BGM_FADE_MS, 1.0);
            if (p6bgm) p6bgm.volume = Math.max(0, Math.min(1, p * BGM_TARGET));
            if (p < 1.0) requestAnimationFrame(fadeStep);
        }
        requestAnimationFrame(fadeStep);
    }
    function tryPlayBGM() {
        if (!p6bgm) return;
        if (window._inryokuMuted) { p6bgm.muted = true; }
        const pr = p6bgm.play();
        if (pr) pr.then(fadeBGMIn).catch(() => {});
    }
    function loadBGM(idx) {
        if (p6bgm) { p6bgm.pause(); p6bgm.src = ''; }
        bgmFading = false;
        currentBGMIdx = idx;
        try {
            p6bgm = new Audio(BGM_TRACKS[idx].url);
            p6bgm.loop = true;
            p6bgm.volume = 0;
            p6bgm.preload = 'auto';
            if (window._inryokuMuted) p6bgm.muted = true;
            window._p6bgm = p6bgm;
            // canplaythrough で再生開始（読み込み完了後）
            p6bgm.addEventListener('canplaythrough', function() {
                var pr = p6bgm.play();
                if (pr) pr.then(function() { fadeBGMIn(); }).catch(function() {});
            }, { once: true });
            // フォールバック: 3秒後にも再生を試みる
            setTimeout(function() {
                if (p6bgm && p6bgm.paused) {
                    var pr = p6bgm.play();
                    if (pr) pr.then(function() { fadeBGMIn(); }).catch(function() {});
                }
            }, 3000);
        } catch(e) { console.warn('BGM load failed:', e); }
        // セレクタのアクティブ表示を更新
        document.querySelectorAll('.bgm-track-btn').forEach(function(b, i) {
            b.classList.toggle('bgm-active', i === idx);
        });
        localStorage.setItem('inryoku_bgm', BGM_TRACKS[idx].id);
    }

    // デフォルト: Jupiter（idx 0）
    currentBGMIdx = 0;
    loadBGM(currentBGMIdx);
    // Autoplay blocked → ユーザー操作で再生
    const resumeBGM = () => { tryPlayBGM(); };
    document.addEventListener('click', resumeBGM, { once: true });
    document.addEventListener('touchstart', resumeBGM, { once: true });

    // 音響リアクティブはグローバル関数として定義済み（initParticleUniverseからもアクセス可能）

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

    /* ── F案改: 1商品中央表示 + 矢印切り替え + パーティクル形成 ── */
    const PARTICLE_COUNT = 30;
    function buildParticles() {
      let particles = '';
      for (let j = 0; j < PARTICLE_COUNT; j++) {
        const colors = ['#FF0000','#00FF00','#0044FF','#00FFFF','#FF00FF','#FFFF00'];
        const c = colors[j % 6];
        const angle = (j / PARTICLE_COUNT) * Math.PI * 2;
        const radius = 60 + Math.random() * 100;
        const ox = Math.cos(angle) * radius;
        const oy = Math.sin(angle) * radius;
        const delay = (Math.random() * 6).toFixed(2);
        const size = 1.5 + Math.random() * 2.5;
        const dur = (5 + Math.random() * 5).toFixed(1);
        particles += `<div class="form-particle" style="--ox:${ox.toFixed(0)}px;--oy:${oy.toFixed(0)}px;--delay:${delay}s;--dur:${dur}s;--size:${size.toFixed(1)}px;--color:${c};"></div>`;
      }
      return particles;
    }

    const productCardsHTML = `
      <div class="carousel-wrap" id="store-grid">
        <div class="carousel-scene">
          <div class="carousel-ring" id="carousel-ring">
            ${PRODUCTS.map((p, i) => {
              var angle = (360 / PRODUCTS.length) * i;
              return `<div class="carousel-item${isProductPurchasable(p) ? '' : ' product-card-disabled'}" data-idx="${i}" id="product-${p.id}" style="transform: translateX(0) translateZ(0);">
                <div class="product-showcase">
                  <div class="product-showcase-frame"></div>
                  <div class="product-showcase-glow"></div>
                  <div class="product-showcase-aurora"></div>
                  <div class="product-showcase-orbit"></div>
                  <div class="product-showcase-pedestal"></div>
                  <div class="product-card-img" data-3d-slot="${p.id}" data-glb="${p.glb || ''}">
                    <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.parentNode.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:32px;color:rgba(255,255,255,0.15);font-family:monospace;\\'>${p.name.charAt(0)}</div>'">
                  </div>
                </div>
                <div class="product-card-info">
                  <div class="product-card-name">${p.name}</div>
                  <div class="product-card-price" data-final="${p.price}">¥0</div>
                  <div class="product-card-status">${getProductAvailabilityLabel(p)}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;

    root.innerHTML = `
    <div class="singularity-content" style="position:relative;z-index:5;pointer-events:auto;">
        <div class="hologram-logo" style="opacity:0;" id="holo-logo-wrap">
            <div class="brand-name p6-logo-text">
                <span class="brand-char" data-char="i" style="color:#808080;opacity:0;">i</span><span class="brand-char" data-char="n" style="color:#FF0000;opacity:0;">n</span><span class="brand-char" data-char="r" style="color:#00FF00;opacity:0;">r</span><span class="brand-char" data-char="y" style="color:#0044FF;opacity:0;">y</span><span class="brand-char" data-char="o" style="color:#00FFFF;opacity:0;">o</span><span class="brand-char" data-char="k" style="color:#FF00FF;opacity:0;">k</span><span class="brand-char" data-char="ü" style="color:#FFFF00;opacity:0;">ü</span>
            </div>
            <div class="logo-holo-wrap" id="bb-logo" style="cursor:pointer;opacity:0;">
                <img src="logo_shell.png" alt="" class="logo-shell" width="671" height="953" decoding="async" draggable="false" style="opacity:0;">
                <img src="logo_sphere.png" alt="" class="logo-sphere" width="671" height="953" decoding="async" draggable="false" style="opacity:0;animation:none;">
                <div class="holo-scanlines"></div>
                <div class="holo-overlay"></div>
                <div class="holo-scanline"></div>
            </div>
            <div class="point-link-language" aria-hidden="true">
                <span class="pl-dot" style="--x:13%;--y:42%;--c:#00FFFF;--d:0.0s;--float:0.7;"></span>
                <span class="pl-dot" style="--x:30%;--y:30%;--c:#FFFF00;--d:0.18s;--float:1.4;"></span>
                <span class="pl-dot" style="--x:49%;--y:38%;--c:#FF00FF;--d:0.36s;--float:2.1;"></span>
                <span class="pl-dot" style="--x:66%;--y:56%;--c:#00FF00;--d:0.54s;--float:2.8;"></span>
                <span class="pl-dot" style="--x:84%;--y:47%;--c:#FF0000;--d:0.72s;--float:3.5;"></span>
                <span class="pl-line" style="--x:15%;--y:41%;--w:18%;--r:-21deg;--d:0.95s;--float:0.4;"></span>
                <span class="pl-line" style="--x:31%;--y:31%;--w:20%;--r:12deg;--d:1.18s;--float:1.1;"></span>
                <span class="pl-line" style="--x:50%;--y:39%;--w:19%;--r:33deg;--d:1.41s;--float:1.8;"></span>
                <span class="pl-line" style="--x:67%;--y:55%;--w:18%;--r:-13deg;--d:1.64s;--float:2.5;"></span>
            </div>
        </div>


        <div class="item-grid" style="opacity:0;transition:opacity 1.2s ease;">
            ${productCardsHTML}
        </div>

    </div>`;

    console.log('[Phase 3] DOM setup complete, initializing particle universe...');
    initLogoHologramParallax();
    // 同期呼び出し（rAFだとバックグラウンドタブや競合で不発になるケースがある）
    // 2026-05-09: 新シーケンス「黒 → コア → ロゴ → 粒子宇宙 → 服 → UI」
    // STEP 2 (ロゴ brand-name reveal) 開始直後、コア materialize 完了後に粒子発火。
    // 7000 → 3000ms に前倒し。コア出現 (280-1880ms) → ロゴ出現 (2450-4970ms) と並行して粒子が広がる。
    setTimeout(() => {
        try {
            initParticleUniverse();
            console.log('[Phase 3] Particle universe initialized successfully');
        } catch(e) {
            console.error('[Phase 3] initParticleUniverse error:', e);
        }
    }, 3000);

    // ── 「間」の演出: 真っ暗→5秒後にリビール開始（ラッパー表示は子要素リセット後） ──
    // 旧: 3秒でラッパーfadeIn→5秒でリビール → 2秒間子要素が一瞬見えるバグあり
    // 修正: ラッパー表示をinitBrandParticleReveal内に統合
    // 2026-05-07: 黒い世界にまずコアだけを出す
    setTimeout(initBrandParticleReveal, 180);

    // 2026-05-07: 3Dコアを先に作り、後続の全要素はこのコアから生成される
    setTimeout(function() {
        try { init3DLogoSphere(); } catch(e) { console.warn('[3DLogo] init failed:', e); }
    }, 60);

    // 2026-05-05: #4 哲学コピーのタイプオン演出（ブランドリビール完了後）
    // 2026-05-05 KO追加: 初回 textContent を data-final に保存し、言語切替時は data-final を即時更新
    setTimeout(function() {
        const typeOut = (el, charDelayMs) => {
            if (!el) return 0;
            const text = el.textContent || '';
            // 初回 textContent を data-final に固定 (言語変更時は i18n 側で更新される)
            el.dataset.final = text;
            el.textContent = '';
            el.style.minHeight = '1em';
            let i = 0;
            const id = setInterval(() => {
                if (i >= text.length) { clearInterval(id); return; }
                el.textContent += text[i++];
            }, charDelayMs);
            return text.length * charDelayMs;
        };
        const phMain = document.querySelector('.philosophy-copy');
        const phSub  = document.querySelector('.philosophy-sub');
        const mainDur = typeOut(phMain, 130);
        setTimeout(() => typeOut(phSub, 60), mainDur + 350);
    }, 7600);

    // 2026-05-05 KO追加: 言語切替時に哲学コピーを即時 swap（タイプオンはやり直さず textContent を一括上書き）
    try {
        window.addEventListener('inryoku:langchange', function() {
            // i18n.js 側の applyDom() が data-i18n で textContent を上書き済み。
            // タイプオン中に来た場合は途中状態が壊れるが、現実的には reveal 完了後しか起こらない。
            // data-final を新言語で再保存（価格ロジックなど他箇所が参照しても問題なくする）
            const phMain = document.querySelector('.philosophy-copy');
            const phSub  = document.querySelector('.philosophy-sub');
            if (phMain) phMain.dataset.final = phMain.textContent || '';
            if (phSub)  phSub.dataset.final  = phSub.textContent  || '';
        });
    } catch(e) { /* swallow */ }

    // 2026-05-05: #5 価格カウントアップ（初回 reveal 時に ¥0→最終値）
    setTimeout(function() {
        const priceEls = document.querySelectorAll('.product-card-price[data-final]');
        priceEls.forEach((el, idx) => {
            const finalStr = el.dataset.final || '';
            // ¥12,800 形式から数値抽出
            const m = finalStr.match(/[\d,]+/);
            if (!m) { el.textContent = finalStr; return; }
            const finalNum = parseInt(m[0].replace(/,/g, ''), 10);
            if (!finalNum || isNaN(finalNum)) { el.textContent = finalStr; return; }
            const prefix = finalStr.slice(0, m.index);
            const suffix = finalStr.slice(m.index + m[0].length);
            const DUR = 1400 + idx * 80;  // 商品ごとに微小ずらし
            const start = performance.now();
            const tick = () => {
                const t = (performance.now() - start) / DUR;
                if (t >= 1) { el.textContent = finalStr; return; }
                // ease-out cubic でスロット風に減速
                const eased = 1 - Math.pow(1 - t, 3);
                const v = Math.floor(finalNum * eased);
                el.textContent = prefix + v.toLocaleString() + suffix;
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }, 9600);

    // ── ストアグリッド制御 ──
    initStoreGrid();

    // ── カートアイコン（フローティング） ──
    const cartIcon = document.createElement('div');
    cartIcon.id = 'cart-icon';
    // 2026-04-22: 絵文字全廃止 — 細線 SVG バッグ
    cartIcon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
          <path d="M6 7h12l-1.2 11.3a2 2 0 0 1-2 1.7H9.2a2 2 0 0 1-2-1.7L6 7Z"/>
          <path d="M9 7V5a3 3 0 0 1 6 0v2"/>
        </svg>
        <span id="cart-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#ff0055;color:#fff;font-size:10px;min-width:16px;height:16px;border-radius:50%;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;letter-spacing:0;">0</span>`;
    cartIcon.style.cssText = 'position:fixed;top:20px;right:20px;z-index:1000;cursor:pointer;padding:10px;background:rgba(255,255,255,0.08);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:12px;opacity:0;transition:opacity 1.2s ease;pointer-events:none;';
    cartIcon.addEventListener('click', function() { showCartDrawer(); });
    document.body.appendChild(cartIcon);
    CART.updateBadge();

    // ── ミュートボタン ──
    // ミュート状態を維持（P1で設定された_inryokuMutedを引き継ぐ）
    if (window._inryokuMuted === undefined) window._inryokuMuted = true;
    const muteBtn = document.createElement('div');
    muteBtn.id = 'mute-btn';
    // 2026-04-22: 絵文字廃止 — 細線 SVG (音ON/OFF)
    var _muteOnSVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M4 10v4h4l5 4V6L8 10H4Z"/><line x1="17" y1="9" x2="21" y2="13"/><line x1="21" y1="9" x2="17" y2="13"/></svg>';
    var _muteOffSVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="M16 8a5 5 0 0 1 0 8"/><path d="M19 5a8 8 0 0 1 0 14"/></svg>';
    muteBtn.innerHTML = window._inryokuMuted ? _muteOnSVG : _muteOffSVG;
    muteBtn.style.cssText = 'position:fixed;top:20px;right:75px;z-index:1000;cursor:pointer;padding:10px;background:rgba(255,255,255,0.08);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:12px;opacity:0;pointer-events:none;transition:opacity 1.2s ease;';
    muteBtn.addEventListener('click', function() {
        window._inryokuMuted = !window._inryokuMuted;
        muteBtn.innerHTML = window._inryokuMuted
            ? _muteOnSVG
            : _muteOffSVG;
        // BGMミュート
        if (window._p6bgm) window._p6bgm.muted = window._inryokuMuted;
        // 全AudioContextをsuspend/resume
        [window._brandSFCtx, window._particleSpeakCtx, window.p3AudioCtx].forEach(function(ctx) {
            if (ctx) {
                if (window._inryokuMuted) { ctx.suspend(); }
                else { ctx.resume(); }
            }
        });
    });
    document.body.appendChild(muteBtn);

    // ── RGBCMY Cursor Particle Trail ──
    var _cursorParticles = [];
    var _cursorColorIdx = 0;
    var _cursorColors = ['#FF0000', '#00FF00', '#0044FF', '#00FFFF', '#FF00FF', '#FFFF00'];
    var _cursorLastSpawn = 0;
    var _CURSOR_THROTTLE = 40;
    var _CURSOR_MAX = 30;

    document.addEventListener('mousemove', function(e) {
        var now = Date.now();
        if (now - _cursorLastSpawn < _CURSOR_THROTTLE) return;
        _cursorLastSpawn = now;

        // Remove oldest if at max
        if (_cursorParticles.length >= _CURSOR_MAX) {
            var oldest = _cursorParticles.shift();
            if (oldest && oldest.parentNode) oldest.parentNode.removeChild(oldest);
        }

        var color = _cursorColors[_cursorColorIdx % _cursorColors.length];
        _cursorColorIdx++;

        var dot = document.createElement('div');
        dot.style.cssText = 'position:fixed;pointer-events:none;z-index:999;' +
            'width:3px;height:3px;border-radius:50%;' +
            'background:' + color + ';' +
            'opacity:0.8;' +
            'box-shadow:0 0 6px ' + color + ';' +
            'left:' + e.clientX + 'px;top:' + e.clientY + 'px;' +
            'transition:opacity 800ms ease-out, transform 800ms ease-out;' +
            'will-change:opacity,transform;';
        document.body.appendChild(dot);
        _cursorParticles.push(dot);

        // Trigger animation on next frame
        requestAnimationFrame(function() {
            dot.style.opacity = '0';
            dot.style.transform = 'translateY(-10px) scale(0)';
        });

        // Remove from DOM after animation
        setTimeout(function() {
            if (dot.parentNode) dot.parentNode.removeChild(dot);
            var idx = _cursorParticles.indexOf(dot);
            if (idx > -1) _cursorParticles.splice(idx, 1);
        }, 820);
    });

    // ── BGMセレクタ（♫ボタン → ドロップダウン） ──
    const bgmBtn = document.createElement('div');
    bgmBtn.id = 'bgm-btn';
    bgmBtn.innerHTML = '<span style="font-size:16px;">♫</span>';
    bgmBtn.style.cssText = 'position:fixed;top:20px;right:130px;z-index:1000;cursor:pointer;padding:10px;background:rgba(255,255,255,0.08);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:12px;opacity:0;pointer-events:none;transition:opacity 1.2s ease;';

    const bgmMenu = document.createElement('div');
    bgmMenu.id = 'bgm-menu';
    bgmMenu.style.cssText = 'position:fixed;top:60px;right:130px;z-index:1001;background:rgba(10,10,15,0.92);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:6px 0;display:none;min-width:180px;max-height:300px;overflow-y:auto;';

    BGM_TRACKS.forEach(function(track, i) {
        var item = document.createElement('div');
        item.className = 'bgm-track-btn' + (i === currentBGMIdx ? ' bgm-active' : '');
        item.textContent = track.emoji + ' ' + track.name;
        item.style.cssText = 'padding:8px 14px;cursor:pointer;font-size:12px;color:#aaa;font-family:"Press Start 2P",monospace;transition:background 0.2s,color 0.2s;white-space:nowrap;';
        item.addEventListener('mouseenter', function() { item.style.background = 'rgba(255,255,255,0.08)'; });
        item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            loadBGM(i);
            bgmMenu.style.display = 'none';
        });
        bgmMenu.appendChild(item);
    });
    // アクティブ曲のスタイル用CSS
    var bgmStyle = document.createElement('style');
    bgmStyle.textContent = '.bgm-active { color: #fff !important; text-shadow: 0 0 8px rgba(0,255,255,0.4); }';
    document.head.appendChild(bgmStyle);

    bgmBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        bgmMenu.style.display = bgmMenu.style.display === 'none' ? 'block' : 'none';
    });
    // 外側クリックで閉じる
    document.addEventListener('click', function() { bgmMenu.style.display = 'none'; });

    document.body.appendChild(bgmBtn);
    document.body.appendChild(bgmMenu);

    // ── Email Signup / Grey 入団 ──
    const emailSignup = document.createElement('div');
    emailSignup.className = 'email-signup';
    emailSignup.id = 'email-signup';
    emailSignup.style.cssText = 'opacity:0;transition:opacity 1.2s ease;';

    var savedNum = localStorage.getItem('inryoku.uchujin_number');
    var savedToken = localStorage.getItem('inryoku.uchujin_token');
    var savedColor = localStorage.getItem('inryoku.uchujin_color');
    var savedBio = localStorage.getItem('inryoku.uchujin_bio') || '';
    var savedArtist = localStorage.getItem('inryoku.uchujin_artist') === '1';
    var savedPublic = localStorage.getItem('inryoku.uchujin_public') === '1';

    function renderGreyProfile() {
        var num = localStorage.getItem('inryoku.uchujin_number');
        var color = localStorage.getItem('inryoku.uchujin_color') || '#808080';
        var bio = localStorage.getItem('inryoku.uchujin_bio') || '';
        var isArtist = localStorage.getItem('inryoku.uchujin_artist') === '1';
        var isPublic = localStorage.getItem('inryoku.uchujin_public') === '1';
        var padded = String(num).padStart(4, '0');
        emailSignup.innerHTML = `
            ${buildParticles()}
            <div class="email-signup-label">you are Grey</div>
            <div class="email-signup-sub" style="font-size:22px;letter-spacing:0.25em;color:rgba(255,255,255,0.8);margin-top:8px;">#${padded}</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:14px;font-size:10px;letter-spacing:0.2em;color:rgba(255,255,255,0.5);">
              <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${color};border:1px solid rgba(255,255,255,0.2);"></span>
              <span>personal grey ${color}</span>
            </div>
            <div style="margin-top:20px;">
              <textarea id="grey-bio" maxlength="200" placeholder="bio (optional, max 200 chars)" style="width:100%;max-width:320px;min-height:60px;padding:8px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:rgba(255,255,255,0.8);font-family:inherit;font-size:11px;letter-spacing:0.05em;resize:vertical;box-sizing:border-box;">${bio.replace(/</g, '&lt;')}</textarea>
            </div>
            <div style="margin-top:12px;display:flex;gap:14px;justify-content:center;font-size:10px;letter-spacing:0.15em;color:rgba(255,255,255,0.55);">
              <label style="cursor:pointer;"><input type="checkbox" id="grey-artist" ${isArtist ? 'checked' : ''} style="margin-right:6px;vertical-align:middle;"> artist</label>
              <label style="cursor:pointer;"><input type="checkbox" id="grey-public" ${isPublic ? 'checked' : ''} style="margin-right:6px;vertical-align:middle;"> public (/grey/${padded})</label>
            </div>
            <div style="margin-top:14px;">
              <button id="grey-save" class="email-signup-btn" style="padding:6px 18px;font-size:10px;letter-spacing:0.2em;">SAVE</button>
            </div>
            <div class="email-signup-status" id="grey-save-status" style="margin-top:8px;"></div>
        `;

        var saveBtn = document.getElementById('grey-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                var token = localStorage.getItem('inryoku.uchujin_token');
                var num = localStorage.getItem('inryoku.uchujin_number');
                var newBio = (document.getElementById('grey-bio').value || '').slice(0, 200);
                var newArtist = document.getElementById('grey-artist').checked;
                var newPublic = document.getElementById('grey-public').checked;
                var st = document.getElementById('grey-save-status');
                st.textContent = 'saving…';
                st.style.color = 'rgba(255,255,255,0.4)';
                fetch('/api/grey/' + num + '/update', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ token: token, bio: newBio, isArtist: newArtist, isPublic: newPublic })
                }).then(function(r) { return r.json(); })
                  .then(function(data) {
                      if (data.success) {
                          localStorage.setItem('inryoku.uchujin_bio', newBio);
                          localStorage.setItem('inryoku.uchujin_artist', newArtist ? '1' : '0');
                          localStorage.setItem('inryoku.uchujin_public', newPublic ? '1' : '0');
                          st.textContent = '✓ saved';
                          st.style.color = 'rgba(100,255,150,0.6)';
                      } else {
                          st.textContent = data.error || 'error';
                          st.style.color = 'rgba(255,100,100,0.6)';
                      }
                  }).catch(function() {
                      st.textContent = 'network error';
                      st.style.color = 'rgba(255,100,100,0.6)';
                  });
            });
        }
    }

    if (savedNum && savedToken) {
        renderGreyProfile();
    } else {
        // 2026-04-30: 司「Grey になる / 観測する者たちへ 削除」
        // 哲学コピーは singularity-content 直下の .philosophy-copy / .philosophy-sub に集約
        emailSignup.innerHTML = `
            ${buildParticles()}
            <div class="email-signup-row">
                <input type="email" id="email-input" placeholder="your@email.com" class="email-signup-input">
                <button id="email-submit" class="email-signup-btn">→</button>
            </div>
            <div class="email-signup-status" id="email-status"></div>
        `;
    }
    const scContentForEmail = document.querySelector('.singularity-content');
    // 2026-05-31 司「メール欄を CONTACT に統合」: 下部の email-signup は
    //   CONTACT フォーム内のチェックボックスに移したので、DOM へ追加しない。
    //   (Grey ハッシュ表示モードのみ従来通り表示。通常メール欄は非表示)
    var __isGreyMode = /you are Grey|grey-save/.test(emailSignup.innerHTML);
    if (scContentForEmail && __isGreyMode) { scContentForEmail.appendChild(emailSignup); }

    // Email submit handler
    const emailSubmitBtn = document.getElementById('email-submit');
    if (emailSubmitBtn) {
        emailSubmitBtn.addEventListener('click', function() {
            const input = document.getElementById('email-input');
            const status = document.getElementById('email-status');
            const email = input.value.trim();

            // Basic email validation
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                status.textContent = 'メールアドレスを正しく入力してください';
                status.style.color = 'rgba(255,100,100,0.6)';
                return;
            }

            status.textContent = '送信中...';
            status.style.color = 'rgba(255,255,255,0.4)';

            fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            })
            .then(function(res) {
                if (!res.ok) throw new Error('登録に失敗しました');
                return res.json();
            })
            .then(function(data) {
                // メール欄中心からビッグバン
                var emailEl = document.getElementById('email-signup');
                if (emailEl) {
                    var er = emailEl.getBoundingClientRect();
                    spawnBigBang(er.left + er.width / 2, er.top + er.height / 2, 30);
                }
                var num = data && data.number ? ' #' + String(data.number).padStart(4, '0') : '';
                // 入団番号・token・色を永続化
                if (data && data.number) {
                    try {
                        localStorage.setItem('inryoku.uchujin_number', String(data.number));
                        if (data.token)     localStorage.setItem('inryoku.uchujin_token', data.token);
                        if (data.greyColor) localStorage.setItem('inryoku.uchujin_color', data.greyColor);
                    } catch(e) {}
                }
                status.textContent = '✓ welcome, Grey' + num;
                status.style.color = 'rgba(100,255,150,0.6)';
                // 1.5秒後にプロフィール編集画面に切替
                setTimeout(function() {
                    try { renderGreyProfile(); } catch(e) {}
                }, 1500);
                input.disabled = true;
                emailSubmitBtn.disabled = true;
                input.style.opacity = '0.4';
                emailSubmitBtn.style.opacity = '0.4';
                emailSubmitBtn.style.cursor = 'default';
            })
            .catch(function(err) {
                status.textContent = err.message || 'エラーが発生しました';
                status.style.color = 'rgba(255,100,100,0.6)';
            });
        });
    }

    // ── 問い合わせフォーム ──
    const contactForm = document.createElement('div');
    contactForm.className = 'contact-form';
    contactForm.id = 'contact-form';
    contactForm.style.cssText = 'opacity:0;transition:opacity 1.2s ease;';
    // 2026-05-31 司「メール欄を CONTACT に統合、メール登録もできるように」:
    //   下部の email-signup を廃し、CONTACT フォームにメール登録チェックを内蔵。
    //   メッセージは任意 (メール登録だけでも送信可)。
    contactForm.innerHTML = `
        <div class="contact-toggle" id="contact-toggle">CONTACT</div>
        <div class="contact-body" id="contact-body" style="display:none;">
            <input type="text" id="contact-name" placeholder="Name" class="contact-input">
            <input type="email" id="contact-email" placeholder="Email" class="contact-input">
            <textarea id="contact-msg" placeholder="Message (任意)" class="contact-textarea" rows="3"></textarea>
            <label class="contact-news" for="contact-news-cb">
                <input type="checkbox" id="contact-news-cb" checked>
                <span>最新情報を受け取る</span>
            </label>
            <button id="contact-submit" class="contact-submit-btn">SEND</button>
            <div class="contact-status" id="contact-status"></div>
        </div>
    `;
    var scContentForContact = document.querySelector('.singularity-content');
    if (scContentForContact) { scContentForContact.appendChild(contactForm); }

    // 問い合わせ展開トグル
    document.getElementById('contact-toggle').addEventListener('click', function() {
        var body = document.getElementById('contact-body');
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
        // 2026-04-30: CONTACT 押下で ロゴが話しかけてくる（コアタップと同じ挙動）
        var bbLogo = document.getElementById('bb-logo');
        if (bbLogo) bbLogo.click();
    });


    // 問い合わせ送信
    document.getElementById('contact-submit').addEventListener('click', function() {
        var name = document.getElementById('contact-name').value.trim();
        var email = document.getElementById('contact-email').value.trim();
        var msg = document.getElementById('contact-msg').value.trim();
        var wantNews = document.getElementById('contact-news-cb');
        var subscribe = wantNews ? wantNews.checked : false;
        var status = document.getElementById('contact-status');

        // 2026-05-31: メールは必須。メッセージは任意 (空ならメール登録のみ)。
        if (!email) {
            status.textContent = 'メールアドレスを入力してください';
            status.style.color = 'rgba(255,100,100,0.6)';
            return;
        }
        var hasMessage = !!msg;
        if (!hasMessage && !subscribe) {
            status.textContent = 'メッセージ入力 か 最新情報受け取りを選んでください';
            status.style.color = 'rgba(255,100,100,0.6)';
            return;
        }
        status.textContent = '送信中...';
        status.style.color = 'rgba(255,255,255,0.4)';

        var jobs = [];
        // 問い合わせ (メッセージがある時だけ)
        if (hasMessage) {
            jobs.push(fetch('/api/contact', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, email: email, message: msg })
            }).then(function(res){ if(!res.ok) throw new Error('送信に失敗しました'); return res.json(); }));
        }
        // メール登録 (チェック時)
        if (subscribe) {
            jobs.push(fetch('/api/subscribe', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, name: name })
            }).then(function(res){ if(!res.ok) throw new Error('登録に失敗しました'); return res.json().catch(function(){return{};}); }));
        }

        Promise.all(jobs)
        .then(function() {
            spawnBigBang(window.innerWidth / 2, window.innerHeight / 2, 25);
            status.textContent = subscribe && !hasMessage ? '✓ 登録完了' : '✓ 送信完了';
            status.style.color = 'rgba(100,255,150,0.6)';
        })
        .catch(function(err) {
            status.textContent = err.message || 'エラーが発生しました';
            status.style.color = 'rgba(255,100,100,0.6)';
        });
    });

    // 2026-04-22: THEME スイッチャー完全削除（司さん確定）— サンプル確認用だったため本番トップから撤去

    // ── イースターエッグ: Konami Code → レイヤー解放 ──
    (function setupEasterEggs() {
        var KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
        var progress = 0;
        var LAYERS = ['os9', 'imacg3', 'apple2'];
        function showToast(msg) {
            var t = document.createElement('div');
            t.textContent = msg;
            t.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#000;color:#0f0;padding:10px 18px;border:1px solid #0f0;font-family:monospace;font-size:11px;letter-spacing:0.15em;z-index:9999;opacity:0;transition:opacity .4s;';
            document.body.appendChild(t);
            requestAnimationFrame(function() { t.style.opacity = '1'; });
            setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 500); }, 3500);
        }
        function unlockLayer(name) {
            var layers = JSON.parse(localStorage.getItem('inryoku.layers') || '[]');
            if (layers.indexOf(name) !== -1) return;
            layers.push(name);
            localStorage.setItem('inryoku.layers', JSON.stringify(layers));
            var messages = { os9: '// core detected: layer 1', imacg3: '// light revealed: layer 2', apple2: '// 101%: the origin' };
            showToast(messages[name] || '// layer unlocked');
            // スキン即時反映
            document.querySelectorAll('.carousel-item').forEach(function(c) {
                c.classList.remove('mac-system1','mac-os9','mac-imacg3','mac-apple2');
                c.classList.add('mac-' + name);
            });
            document.body.setAttribute('data-theme', 'mac');
        }
        document.addEventListener('keydown', function(e) {
            if (e.code === KONAMI[progress]) {
                progress++;
                if (progress === KONAMI.length) {
                    progress = 0;
                    var layers = JSON.parse(localStorage.getItem('inryoku.layers') || '[]');
                    // 未解放レイヤーを順次解放
                    for (var i = 0; i < LAYERS.length; i++) {
                        if (layers.indexOf(LAYERS[i]) === -1) {
                            unlockLayer(LAYERS[i]);
                            return;
                        }
                    }
                    showToast('// all layers already unlocked');
                }
            } else {
                progress = 0;
            }
        });
    })();

    // ── フッター（最小化 — クリックで展開） ──
    const footer = document.createElement('footer');
    footer.className = 'site-footer site-footer--mini';
    footer.style.cssText = 'opacity:0;transition:opacity 1.2s ease;';
    footer.innerHTML = `
        <div class="footer-toggle" title="info">ⓘ</div>
        <div class="footer-expanded">
            <div class="footer-brand">© 2026 inryokü</div>
            <div class="footer-links">
                <a href="/legal.html" class="footer-link" target="_blank" rel="noopener">特定商取引法</a>
                <a href="/privacy.html" class="footer-link" target="_blank" rel="noopener">プライバシー</a>
                <a href="/returns.html" class="footer-link" target="_blank" rel="noopener">返品</a>
                <a href="https://x.com/intent/tweet?text=inryok%C3%BC%20%E2%80%94%2050%25%20%E2%86%92%20101%25&url=https%3A%2F%2Finryoku.com" target="_blank" class="footer-link">X</a>
                <a href="https://instagram.com/inryoku" target="_blank" class="footer-link">Instagram</a>
            </div>
            <div class="footer-stripe">Secure Checkout</div>
        </div>
    `;
    footer.querySelector('.footer-toggle').addEventListener('click', function() {
        footer.classList.toggle('site-footer--open');
    });
    const scContent = document.querySelector('.singularity-content');
    if (scContent) { scContent.appendChild(footer); }
}

// ── ビッグバン粒子エフェクト（アクション時のみ発火） ──
function spawnBigBang(x, y, count) {
    var colors = ['#FF0000','#00FF00','#0044FF','#00FFFF','#FF00FF','#FFFF00'];
    count = count || 20;
    for (var i = 0; i < count; i++) {
        (function(i){
            var dot = document.createElement('div');
            dot.className = 'bang-particle';
            var c = colors[i % 6];
            var angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            var dist = 40 + Math.random() * 80;
            var bx = Math.cos(angle) * dist;
            var by = Math.sin(angle) * dist;
            var size = 2 + Math.random() * 4;
            dot.style.cssText = 'left:' + x + 'px;top:' + y + 'px;' +
                'width:' + size + 'px;height:' + size + 'px;' +
                'background:' + c + ';' +
                'box-shadow:0 0 ' + (size * 3) + 'px ' + c + ';' +
                '--bx:' + bx.toFixed(0) + 'px;--by:' + by.toFixed(0) + 'px;';
            document.body.appendChild(dot);
            setTimeout(function() { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 900);
        })(i);
    }
}

function initStoreGrid() {
    var grid = document.getElementById('store-grid');
    if (!grid) return;

    var ring = document.getElementById('carousel-ring');
    if (!ring) return;

    var scene = grid.querySelector('.carousel-scene');
    var items = ring.querySelectorAll('.carousel-item');
    var count = items.length;
    var sliceAngle = 360 / count;
    // 2026-04-21: カード密度をレスポンシブに — mobile でリング半径を縮め接続を緻密に
    var isMobile = window.matchMedia('(max-width: 768px)').matches;

    // 2026-05-30 司「絶対に壊れないようにして」: 螺旋再発の恒久対策。
    //   updateFrontCard が毎フレーム transform を書き換えるのに、CSS の
    //   transition:transform が残っていると補間が追いつかず螺旋に見える。
    //   CSS の上書き合戦に依存せず JS 側で transform の transition を恒久的に殺す
    //   (filter/opacity の transition は活かす)。p3_styles / p3_ec_polish どちらの
    //   設定でも螺旋は二度と起きない。
    items.forEach(function (it) {
        it.style.transitionProperty = 'filter, opacity';
        it.style.willChange = 'transform';
    });
    // 2026-04-24: 司「カード大きく」 RING/FRONT 拡大、scale 抑制 (ロゴ被らない)
    var RING_Z  = isMobile ? 190 : 290;
    var FRONT_Z = isMobile ? 300 : 470;
    // 2026-05-24 v8: 司「服小さすぎる、デザイン配置下に置きサイズ大きく」
    //   FRONT_S 復活 + base scale 拡大 + 配置下げは CSS margin-top で
    // 旧 v20260619: mobile 1.55 はタップ時に画面内の余白を潰し、
    // 商品名/価格と重なって安っぽく見えていた。desktop は維持。
    var FRONT_S = isMobile ? 1.22 : 1.45;
    var currentAngle = 0;
    // 2026-04-22: ぬるっと ゆっくり → 司「ほんのちょっとスピード上げて」 0.025 → 0.04
    var autoRotateSpeed = 0.04; // deg per frame
    var isDragging = false;
    var dragStartX = 0;
    var dragAngle = 0;
    var autoRotateId = null;
    var velocity = 0; // 慣性用
    var lastDragX = 0;
    var lastDragTime = 0;
    var dragMoved = false;

    // ── 正面カード検出 + グロー + タイプライター ──
    var currentFrontIdx = -1;
    var typewriterTimer = null;
    var GLOW_COLORS = ['#FF0000','#00FF00','#0044FF','#00FFFF','#FF00FF','#FFFF00'];

    function updateFrontCard() {
        var bestIdx = 0;
        var bestDist = 999;

        items.forEach(function(item, i) {
            // -180〜180 に正規化した相対角度
            var itemAngle = ((i * sliceAngle + currentAngle) % 360 + 360) % 360;
            if (itemAngle > 180) itemAngle -= 360;
            var absDist = Math.abs(itemAngle); // 0 = 正面 / 180 = 真裏

            if (absDist < bestDist) {
                bestDist = absDist;
                bestIdx = i;
            }

            // 2026-04-21: 接続を緻密に — 角度距離に基づく連続補間
            // 正面(0°)→遠景(180°) を滑らかな ease で結ぶ (activeCard は bring/reset が上書き)
            if (item === activeCard) return;

            var t = absDist / 180;                    // 0..1
            var ease = t * t * (3 - 2 * t);           // smoothstep
            // 2026-05-24 v8: 司「服小さすぎる」 base scale up + 側面落差少なめ
            var scale      = (isMobile ? 1.13 : 1.30) - ease * (isMobile ? 0.20 : 0.32);
            var opacity    = 1.0  - ease * (isMobile ? 0.82 : 0.65);
            var brightness = 1.35 - ease * (isMobile ? 0.92 : 0.80);
            var saturate   = 1.15 - ease * (isMobile ? 0.62 : 0.55);
            var blur       = ease * (isMobile ? 1.4 : 2.2);
            // cinematic lift: 側面カードはわずかに下へ沈み、奥で持ち上がる
            var lift       = -Math.sin(itemAngle * Math.PI / 180) * 6; // -6..+6
            var angle      = i * sliceAngle;

            // 2026-05-24 v4 (司さん「曲面めっちゃ綺麗に」):
            //   Y は固定したまま、X/Z/rotateY のみで水平な曲面 coverflow にする。
            //   旧 v3: var cfX = itemAngle * pxPerDeg; transform = translateX(cfX) scale(scale)
            // 2026-05-24 v7 (司さん「もっと密着、前の曲面ガラスに戻す」):
            //   curveRadius を縮めて密着感、rotateY は強めキープで曲面感
            //   scale 落差を緩めて side cards もガラスっぽく透ける
            // 2026-05-31 司「もっと平面に・ガラスが横の服と重なる」:
            //   rotateY と depth を弱めてほぼ平面の横スクロールに。
            //   カード間隔(curveRadius)は広げて、正面カードの虹背景が隣に被らない。
            var rad = itemAngle * Math.PI / 180;
            // 旧 v20260619: mobile curveRadius 230 は 375px 幅で左右カードが画面端へはみ出し、
            // 横カードの文字が中央に被った。mobile だけ半径を圧縮し、3枚が静かに収まる幅へ。
            var curveRadius = isMobile ? 118 : 340;
            var depth = isMobile ? 58 : 130;
            var cfX = Math.sin(rad) * curveRadius;
            var cfZ = (Math.cos(rad) - 1) * depth;
            var cfRotY = -itemAngle * (isMobile ? 0.18 : 0.30);
            var rotLimit = isMobile ? 18 : 32;
            if (cfRotY > rotLimit) cfRotY = rotLimit; else if (cfRotY < -rotLimit) cfRotY = -rotLimit;
            var backHide = Math.abs(itemAngle) > 105 ? 0 : 1;
            item.style.transform =
                'translate3d(' + cfX.toFixed(1) + 'px,0,' + cfZ.toFixed(1) + 'px) rotateY(' + cfRotY.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';
            item.style.opacity = (opacity * backHide).toFixed(3);
            item.style.filter  =
                'brightness(' + brightness.toFixed(2) + ') saturate(' + saturate.toFixed(2) + ') blur(' + blur.toFixed(2) + 'px)';

            if (absDist < sliceAngle * 0.55) {
                item.classList.add('carousel-front');
            } else {
                item.classList.remove('carousel-front');
            }
        });

        if (bestIdx !== currentFrontIdx) {
            currentFrontIdx = bestIdx;
            startTypewriter(bestIdx);
        }
    }

    function startTypewriter(idx) {
        if (typewriterTimer) clearInterval(typewriterTimer);
        var nameEl = items[idx] ? items[idx].querySelector('.product-card-name') : null;
        if (!nameEl) return;
        var fullText = PRODUCTS[idx].name;
        var charIdx = 0;
        nameEl.textContent = '';
        nameEl.style.borderRight = '1px solid rgba(255,255,255,0.5)';
        typewriterTimer = setInterval(function() {
            charIdx++;
            nameEl.textContent = fullText.substring(0, charIdx);
            if (charIdx >= fullText.length) {
                clearInterval(typewriterTimer);
                typewriterTimer = null;
                // カーソル点滅して消える
                setTimeout(function() { nameEl.style.borderRight = 'none'; }, 1200);
            }
        }, 60);
    }

    // ── ホバー/タップで前に出る + クリック(2回目)でモーダル ──
    var isHovering = false;
    var activeCard = null; // 現在前に出てるカード (mobile tap用)
    var __angleTweenId = null;
    function bringCardForward(card, idx) {
        var targetAngle = -(360 / count) * idx;
        var diff = targetAngle - currentAngle;
        diff = ((diff % 360) + 540) % 360 - 180;
        var dest = currentAngle + diff;
        ring.style.transition = 'transform 0.7s cubic-bezier(0.16,1,0.3,1)';
        // 2026-05-24 v7: 司「スライド早すぎてコントロールできない」
        //   currentAngle を 900ms かけて ease-out で dest までトゥイーン (snap禁止)
        if (__angleTweenId) cancelAnimationFrame(__angleTweenId);
        var fromA = currentAngle;
        var startT = performance.now();
        var dur = 900;
        var step = function(now) {
            var k = Math.min(1, (now - startT) / dur);
            // ease-out cubic
            var e = 1 - Math.pow(1 - k, 3);
            currentAngle = fromA + (dest - fromA) * e;
            velocity = 0;
            if (k < 1) {
                __angleTweenId = requestAnimationFrame(step);
            } else {
                currentAngle = dest;
                __angleTweenId = null;
            }
        };
        __angleTweenId = requestAnimationFrame(step);
        // 2026-05-24 coverflow: ring 自体は静止、updateFrontCard が
        // currentAngle 経由で各カードの itemAngle を計算して X 軸の弧に配置
        ring.style.transform = 'none';
        card.classList.add('carousel-active');
        card.style.transition = 'transform 0.55s cubic-bezier(0.16,1,0.3,1), filter 0.35s ease, opacity 0.35s ease';
        // bringCardForward は updateFrontCard に任せる (per-frame で coverflow 位置に到達)
        card.style.transform = 'translateX(0) translateZ(0) rotateY(0deg) scale(' + FRONT_S + ')';
        card.style.filter = 'brightness(1.5) saturate(1.2)';
        card.style.opacity = '1';
        card.style.zIndex = '20';

    }
    function resetCard(card, idx) {
        card.classList.remove('carousel-active');
        card.style.transition = 'transform 0.55s cubic-bezier(0.16,1,0.3,1), filter 0.35s ease, opacity 0.35s ease';
        // coverflow: updateFrontCard が次フレで coverflow 位置に補正、ここは中性 transform
        card.style.transform = 'translateX(0) translateZ(0) rotateY(0deg) scale(1)';
        card.style.filter = '';
        card.style.zIndex = '';
        setTimeout(function() {
            if (card !== activeCard) {
                card.style.transition = 'filter 0.35s cubic-bezier(0.23,1,0.32,1), opacity 0.35s cubic-bezier(0.23,1,0.32,1)';
            }
        }, 560);
    }
    items.forEach(function(card) {
        card.style.cursor = 'pointer';
        // 2026-04-21: rAF が毎フレーム transform を書くので transform には transition を付けない (競合防止)
        // filter/opacity は離散イベント時に滑らかに効かせる
        card.style.transition = 'filter 0.35s cubic-bezier(0.23,1,0.32,1), opacity 0.35s cubic-bezier(0.23,1,0.32,1)';

        card.addEventListener('mouseenter', function() {
            isHovering = true;
            velocity = 0;
            bringCardForward(card, parseInt(card.dataset.idx));
        });

        // 2026-05-24: 司「服タッチしたら虹色にして背景」 → 押下中 is-tapped で halo 強化
        var __tapClear = null;
        card.addEventListener('pointerdown', function() {
            card.classList.add('is-tapped');
            if (__tapClear) clearTimeout(__tapClear);
        });
        var releaseTap = function() {
            if (__tapClear) clearTimeout(__tapClear);
            __tapClear = setTimeout(function() { card.classList.remove('is-tapped'); }, 450);
        };
        card.addEventListener('pointerup', releaseTap);
        card.addEventListener('pointercancel', releaseTap);
        card.addEventListener('pointerleave', releaseTap);

        card.addEventListener('mouseleave', function() {
            isHovering = false;
            ring.style.transition = 'none';
            resetCard(card, parseInt(card.dataset.idx));
        });

        // 2026-04-22: 2タップ混乱解消 — VIEW ボタン化
        card.addEventListener('click', function(e) {
            if (isDragging || dragMoved) return;
            // VIEW ボタンが押されたらモーダル
            if (e.target.classList && e.target.classList.contains('card-view-btn')) {
                e.stopPropagation();
                var i2 = parseInt(card.dataset.idx);
                spawnBigBang(e.clientX, e.clientY, 15);
                showProductModal(i2);
                return;
            }
            var idx = parseInt(card.dataset.idx);
            if (activeCard !== card) {
                if (activeCard) { resetCard(activeCard, parseInt(activeCard.dataset.idx)); removeViewBtn(activeCard); }
                activeCard = card;
                velocity = 0;
                bringCardForward(card, idx);
                attachViewBtn(card, idx);
                spawnBigBang(e.clientX, e.clientY, 8);
            }
        });
    });
    // 2026-04-22: VIEW ボタン helpers
    function attachViewBtn(card, idx) {
        if (card.querySelector('.card-view-btn')) return;
        var p = PRODUCTS[idx];
        var btn = document.createElement('button');
        btn.className = 'card-view-btn';
        btn.textContent = 'VIEW / ' + p.price;
        card.appendChild(btn);
        requestAnimationFrame(function() { btn.classList.add('visible'); });
    }
    function removeViewBtn(card) {
        var b = card.querySelector('.card-view-btn');
        if (b) { b.classList.remove('visible'); setTimeout(function() { if (b.parentNode) b.parentNode.removeChild(b); }, 240); }
    }

    document.addEventListener('click', function(e) {
        if (!activeCard) return;
        if (!activeCard.contains(e.target)) {
            removeViewBtn(activeCard);
            resetCard(activeCard, parseInt(activeCard.dataset.idx));
            activeCard = null;
        }
    }, true);

    // ── メインループ（自動回転 + 慣性 + 正面検出） ──
    function tick() {
        if (!isDragging && !isHovering) {
            if (Math.abs(velocity) > 0.01) {
                // 最大速度制限
                if (velocity > 1.5) velocity = 1.5;
                if (velocity < -1.5) velocity = -1.5;
                currentAngle += velocity;
                velocity *= 0.96;  // 2026-04-22: ぬるっと余韻 0.92 → 0.96
            } else {
                velocity = 0;
                currentAngle -= autoRotateSpeed;
            }
        }

        // 2026-05-24 coverflow: ring 静止、currentAngle は state 用のみ
        ring.style.transform = 'none';

        updateFrontCard();
        autoRotateId = requestAnimationFrame(tick);
    }
    autoRotateId = requestAnimationFrame(tick);

    // ── ドラッグ（慣性付き） ──
    grid.addEventListener('mousedown', function(e) {
        isDragging = true;
        dragMoved = false;
        velocity = 0;
        dragStartX = e.clientX;
        lastDragX = e.clientX;
        lastDragTime = Date.now();
        dragAngle = currentAngle;
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        var dx = e.clientX - dragStartX;
        if (Math.abs(dx) > 3) dragMoved = true;
        currentAngle = dragAngle + dx * 0.09;

        // 速度計算（慣性用）
        var now = Date.now();
        var dt = now - lastDragTime;
        if (dt > 0) {
            velocity = (e.clientX - lastDragX) * 0.15 / Math.max(dt / 16, 1);
        }
        lastDragX = e.clientX;
        lastDragTime = now;
    });
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            // 慣性で減速
            setTimeout(function() { dragMoved = false; }, 50);
        }
    });

    // ── タッチ（慣性付き） ──
    grid.addEventListener('touchstart', function(e) {
        isDragging = true;
        dragMoved = false;
        velocity = 0;
        dragStartX = e.touches[0].clientX;
        lastDragX = e.touches[0].clientX;
        lastDragTime = Date.now();
        dragAngle = currentAngle;
    }, { passive: true });
    grid.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        var tx = e.touches[0].clientX;
        var dx = tx - dragStartX;
        if (Math.abs(dx) > 3) dragMoved = true;
        currentAngle = dragAngle + dx * 0.09;
        var now = Date.now();
        var dt = now - lastDragTime;
        if (dt > 0) {
            velocity = (tx - lastDragX) * 0.15 / Math.max(dt / 16, 1);
        }
        lastDragX = tx;
        lastDragTime = now;
    }, { passive: true });
    grid.addEventListener('touchend', function() {
        isDragging = false;
        setTimeout(function() { dragMoved = false; }, 50);
    });

}

function showCartToast(message, duration) {
    var toast = document.createElement('div');
    toast.className = 'cart-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, duration || 2000);
}

// ── カードからカートに追加 ──
// 2026-05-21 P3 段階1 (Codex): Add-to-Cart Flight + Badge Punch + Logo Pulse
//   GLSL × GSAP 三層構造の最初の実証:
//     第3層 DOM: ghost element がカードからカートへ flight、badge が punch
//     第2層 GSAP: uniform u_clickT を expo.out で 0→1→0 駆動 (sphere 呼応)
//     第1層 GLSL: 既存 spawnBigBang() を完了時に発火 (パーティクル爆発)
//   既存 setTimeout の素朴な ✓ADDED 表示は廃止し、ボタン自体も timeline で feedback
function addToCartFromCard(idx) {
    var p = PRODUCTS[idx];
    if (!p) return;
    var card = document.getElementById('product-' + p.id);
    var selectedBtn = card ? card.querySelector('.size-btn.selected') : null;
    var size = selectedBtn ? selectedBtn.dataset.size : (p.sizes.length > 1 ? p.sizes[1] : p.sizes[0]);
    // 2026-05-21 P3 段階1.5: ?demo=1 で variant check を skip (アニメ確認専用)
    //   本番では Shopify variant 未設定だと早期 return でアニメ見えないため、
    //   デモモード時のみ available=true 上書き。実購入は走らない (CART.add はローカルのみ)
    var demoMode = /[?&]demo=1/.test(location.search);
    var checkoutStatus = getCheckoutStatus(p, size);
    if (!checkoutStatus.available && !demoMode) {
        showCartToast(p.name + ' は ' + checkoutStatus.message);
        return;
    }
    if (demoMode && !checkoutStatus.available) {
        // デモ表示: トーストに「DEMO」を明記
        showCartToast('[DEMO] ' + p.name + ' (' + size + ') アニメ確認モード');
    }
    var variantId = (p.shopifyVariants && p.shopifyVariants[size]) || '';
    CART.add(p.id, size, p.priceNum, p.name, variantId);

    var cartEl = document.getElementById('cart-icon');
    var btn    = card ? card.querySelector('.add-btn') : null;
    var hasGsap = typeof window.gsap !== 'undefined';

    // GSAP が無い環境 (CDN failure 等) は従来挙動にフォールバック
    if (!hasGsap || !cartEl || !card) {
        if (cartEl) {
            var cr0 = cartEl.getBoundingClientRect();
            spawnBigBang(cr0.left + cr0.width / 2, cr0.top + cr0.height / 2, 12);
        }
        showCartToast(p.name + ' (' + size + ') をカートに追加しました');
        if (btn) {
            btn.textContent = '✓ ADDED';
            btn.style.background = 'rgba(0,255,100,0.2)';
            setTimeout(function() { btn.textContent = 'ADD TO CART'; btn.style.background = ''; }, 1500);
        }
        return;
    }

    // ─── 第3層 DOM: Ghost flight ────────────────────────────
    // カードの画像/サムネを複製して position:fixed で打ち上げる
    var img = card.querySelector('img, [data-3d-slot], .product-thumb') || card;
    var srcRect = img.getBoundingClientRect();
    var dstRect = cartEl.getBoundingClientRect();
    var ghost = img.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.style.cssText =
        'position:fixed;' +
        'left:' + srcRect.left + 'px;top:' + srcRect.top + 'px;' +
        'width:' + srcRect.width + 'px;height:' + srcRect.height + 'px;' +
        'margin:0;padding:0;pointer-events:none;z-index:2147482000;' +
        'transition:none;will-change:transform,opacity;' +
        'border-radius:12px;overflow:hidden;' +
        'box-shadow:0 0 24px rgba(255,255,255,.45),0 0 48px rgba(255,80,200,.25);';
    document.body.appendChild(ghost);

    var dx = (dstRect.left + dstRect.width  / 2) - (srcRect.left + srcRect.width  / 2);
    var dy = (dstRect.top  + dstRect.height / 2) - (srcRect.top  + srcRect.height / 2);

    // ─── 第2層 GSAP: timeline で三層を時間的に紡ぐ ──────────
    var tl = window.gsap.timeline({
        onComplete: function() {
            try { ghost.remove(); } catch (e) {}
            // 着地パーティクル (第1層 GLSL 既存資産)
            spawnBigBang(
                dstRect.left + dstRect.width / 2,
                dstRect.top  + dstRect.height / 2,
                14
            );
        }
    });

    // Ghost: 放物線 + 縮小 + 回転 (商品の魂が空間を飛ぶ)
    tl.to(ghost, {
        x: dx,
        y: dy,
        scale: 0.18,
        rotation: 24,
        opacity: 0.85,
        duration: 0.62,
        ease: 'power3.in'
    }, 0);
    // 終端で fade out
    tl.to(ghost, { opacity: 0, duration: 0.12, ease: 'power1.in' }, 0.5);

    // Sphere u_clickT: ロゴ球が呼応して脈動 (第1層 GLSL × 第2層 GSAP)
    try {
        var logoRef = window._p3LogoSphere3D;
        if (logoRef && logoRef.uniforms && logoRef.uniforms.u_clickT) {
            tl.to(logoRef.uniforms.u_clickT, {
                value: 1,
                duration: 0.18,
                ease: 'expo.out',
                yoyo: true,
                repeat: 1
            }, 0);
        }
    } catch (e) {}

    // Badge punch: カートの数字が "ボン!" と弾ける
    var badge = document.getElementById('cart-badge') || cartEl.querySelector('.cart-badge');
    if (badge) {
        tl.fromTo(badge,
            { scale: 1.0 },
            { scale: 1.55, duration: 0.16, ease: 'back.out(3)', yoyo: true, repeat: 1 },
            0.46  // ghost 着地直前
        );
    }

    // Button feedback (text + bg を timeline 内で)
    if (btn) {
        var origText = btn.textContent;
        var origBg   = btn.style.background;
        tl.call(function() {
            btn.textContent = '✓ ADDED';
            btn.style.background = 'rgba(0,255,100,0.22)';
        }, null, 0);
        tl.to(btn, { scale: 0.94, duration: 0.10, ease: 'power2.out', yoyo: true, repeat: 1 }, 0);
        // 1.4 秒後に戻す
        tl.call(function() {
            btn.textContent = origText || 'ADD TO CART';
            btn.style.background = origBg || '';
        }, null, 1.4);
    }

    showCartToast(p.name + ' (' + size + ') をカートに追加しました');
}

// ── ブランド名出現SFサウンド（グローバル: initBrandParticleRevealから呼ばれる） ──
var _brandSFCtx = null;
function playBrandRevealSF(charIndex, totalChars) {
    if (window._inryokuMuted) return;
    try {
        if (!_brandSFCtx) _brandSFCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { return; }
    var ctx = _brandSFCtx;
    var now = ctx.currentTime;

    // 各文字で音程が上がる（SFチャイム感）
    var baseFreq = 440 + charIndex * 180;
    var masterG = ctx.createGain();
    masterG.gain.setValueAtTime(0, now);
    masterG.gain.linearRampToValueAtTime(0.06, now + 0.02);
    masterG.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    masterG.connect(ctx.destination);

    // レイヤー1: メインのSFトーン
    var osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 1.0);
    osc1.connect(masterG);
    osc1.start(now); osc1.stop(now + 1.2);

    // レイヤー2: オクターブ上のキラキラ
    var osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = baseFreq * 2;
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.03, now + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(g2); g2.connect(masterG);
    osc2.start(now); osc2.stop(now + 0.7);

    // レイヤー3: ノイズのシュワッ（ハイパス）
    var nLen = ctx.sampleRate * 0.3;
    var nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
    var nd = nBuf.getChannelData(0);
    for (var i = 0; i < nLen; i++) {
        nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / ctx.sampleRate * 8);
    }
    var ns = ctx.createBufferSource(); ns.buffer = nBuf;
    var hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 3000 + charIndex * 500;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.04, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    ns.connect(hpf); hpf.connect(ng); ng.connect(masterG);
    ns.start(now);

    // 最後の文字: 特別な和音（全体が揃った感じ）
    if (charIndex === totalChars - 1) {
        var chord = [baseFreq * 0.5, baseFreq * 0.75, baseFreq];
        chord.forEach(function(f) {
            var co = ctx.createOscillator();
            co.type = 'sine';
            co.frequency.value = f;
            var cg = ctx.createGain();
            cg.gain.setValueAtTime(0, now + 0.1);
            cg.gain.linearRampToValueAtTime(0.04, now + 0.3);
            cg.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
            co.connect(cg); cg.connect(ctx.destination);
            co.start(now + 0.1); co.stop(now + 2.6);
        });
    }
}

// ── ロゴ登場シグネチャーサウンド ──
// ジュピター風ファンファーレ — 「ジャーン…ジャジャジャジャン！」
// ブラス感のあるsawtooth+LPFで荘厳かつポジティブ
// シェルの実体化タイミングとシンク
function playSignatureSound() {
    if (window._inryokuMuted) return;
    var ctx;
    try { ctx = _brandSFCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return; }
    if (!_brandSFCtx) _brandSFCtx = ctx;
    var now = ctx.currentTime;

    var master = ctx.createGain();
    master.gain.setValueAtTime(0.25, now);
    master.gain.setValueAtTime(0.25, now + 3.5);
    master.gain.exponentialRampToValueAtTime(0.001, now + 5.0);
    master.connect(ctx.destination);

    // ── ブラスコード（sawtooth + LPFでブラス質感） ──
    function brassChord(time, freqs, duration, power) {
        freqs.forEach(function(f) {
            // メインのブラス音（sawtooth → LPF）
            var osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = f;
            var lpf = ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.setValueAtTime(800, time);
            lpf.frequency.linearRampToValueAtTime(2500, time + 0.08); // アタックで開く
            lpf.frequency.linearRampToValueAtTime(1200, time + duration * 0.5); // 徐々に閉じる
            lpf.Q.value = 1.5;
            var g = ctx.createGain();
            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(0.12 * power, time + 0.03); // シャープなアタック
            g.gain.setValueAtTime(0.10 * power, time + duration * 0.7);
            g.gain.exponentialRampToValueAtTime(0.001, time + duration);
            osc.connect(lpf); lpf.connect(g); g.connect(master);
            osc.start(time); osc.stop(time + duration + 0.05);

            // 倍音層（明るさを加える）
            var h = ctx.createOscillator();
            h.type = 'triangle';
            h.frequency.value = f * 2;
            var hg = ctx.createGain();
            hg.gain.setValueAtTime(0, time);
            hg.gain.linearRampToValueAtTime(0.03 * power, time + 0.04);
            hg.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.6);
            h.connect(hg); hg.connect(master);
            h.start(time); h.stop(time + duration * 0.7);
        });
    }

    // タイミング: playSignatureSoundはシェルゴースト出現(100ms)と同時に呼ばれる
    // → ジャーン(0s)=ゴースト, ジャジャジャ(0.7-0.85s)=グリッチ(800-920ms), ジャン!(0.88s)=安定化(980ms)

    // ── ジャーン（荘厳なサスティン — ゴースト出現の瞬間） ──
    // Eb major: Eb3, G3, Bb3（壮大・希望）
    brassChord(now, [155.56, 196.00, 233.08], 0.9, 1.0);

    // ── ジャ（スタッカート1 — グリッチフリッカー開始と同期） ──
    brassChord(now + 0.70, [174.61, 220.00, 261.63], 0.12, 0.7);

    // ── ジャ（スタッカート2 — グリッチ中） ──
    brassChord(now + 0.78, [196.00, 246.94, 293.66], 0.12, 0.75);

    // ── ジャ（スタッカート3 — 上昇） ──
    brassChord(now + 0.85, [220.00, 277.18, 329.63], 0.10, 0.8);

    // ── ジャン！（最終アクセント — シェル完全実体化！） ──
    // Ab major: Ab3, C4, Eb4（フィナーレ、輝き）
    brassChord(now + 0.88, [207.65, 261.63, 311.13], 2.0, 1.4);

    // ── 最終アクセントにティンパニ風の打撃 ──
    var timp = ctx.createOscillator();
    timp.type = 'sine';
    timp.frequency.setValueAtTime(90, now + 0.88);
    timp.frequency.exponentialRampToValueAtTime(55, now + 1.08);
    var tg = ctx.createGain();
    tg.gain.setValueAtTime(0.3, now + 0.88);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    timp.connect(tg); tg.connect(master);
    timp.start(now + 0.88); timp.stop(now + 1.65);

    // ── 余韻のシマー（宇宙的な残響） ──
    var shimmerNotes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    shimmerNotes.forEach(function(f, i) {
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        var g = ctx.createGain();
        var t = now + 1.1 + i * 0.12;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.025, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 1.6);
    });
}

// ── 粒子言語サウンド（二進数演出時のデータ通信音） ──
var _particleSpeakCtx = null;
function playParticleSpeakSound() {
    if (window._inryokuMuted) return;
    try {
        if (!_particleSpeakCtx) _particleSpeakCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { return; }
    var ctx = _particleSpeakCtx;
    var now = ctx.currentTime;

    // データ転送感のある電子音（R2-D2風）
    var master = ctx.createGain();
    master.gain.setValueAtTime(0.06, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    master.connect(ctx.destination);

    // ランダムなピッチのビープ音（毎回違う音色）
    var baseFreq = 300 + Math.random() * 1200;
    var steps = 3 + Math.floor(Math.random() * 5);
    for (var i = 0; i < steps; i++) {
        var o = ctx.createOscillator();
        o.type = Math.random() > 0.5 ? 'square' : 'sine';
        var freq = baseFreq * (0.5 + Math.random());
        o.frequency.setValueAtTime(freq, now + i * 0.06);
        o.frequency.setValueAtTime(freq * (0.8 + Math.random() * 0.4), now + i * 0.06 + 0.03);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, now + i * 0.06);
        g.gain.linearRampToValueAtTime(0.15, now + i * 0.06 + 0.005);
        g.gain.linearRampToValueAtTime(0, now + i * 0.06 + 0.05);
        o.connect(g); g.connect(master);
        o.start(now + i * 0.06); o.stop(now + i * 0.06 + 0.06);
    }
}

// ── BGMダッキング（Big Bang時に音量を下げる → 終了後に戻す） ──
function duckBGM() {
    var bgm = window._p6bgm;
    if (!bgm) return;
    var startVol = bgm.volume || 0.5;
    var targetVol = 0.08;
    var t0 = performance.now();
    var dur = 1500;
    function fadeDown(now) {
        var p = Math.min((now - t0) / dur, 1.0);
        bgm.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * p));
        if (p < 1.0) requestAnimationFrame(fadeDown);
    }
    requestAnimationFrame(fadeDown);
}
function unduckBGM() {
    var bgm = window._p6bgm;
    if (!bgm) return;
    var startVol = bgm.volume;
    var targetVol = 0.5;
    var t0 = performance.now();
    var dur = 2000;
    function fadeUp(now) {
        var p = Math.min((now - t0) / dur, 1.0);
        bgm.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * p));
        if (p < 1.0) requestAnimationFrame(fadeUp);
    }
    requestAnimationFrame(fadeUp);
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
    var logoCore   = null;

    // ── 全要素初期非表示（子要素をリセットしてからラッパーを表示） ──
    if (prismLine)  { prismLine.style.opacity = '0'; prismLine.style.transition = 'none'; }
    if (logoWrap)   { logoWrap.classList.add('core-only'); logoWrap.style.opacity  = '0'; logoWrap.style.transition  = 'none'; }
    if (logoShell)  { logoShell.style.animation = 'none'; logoShell.style.opacity = '0'; logoShell.style.transition = 'none'; }
    if (logoSphere) { logoSphere.style.animation = 'none'; logoSphere.style.opacity = '0'; logoSphere.style.transition = 'none'; }
    if (logoCore)   { logoCore.style.animation = 'none'; logoCore.style.opacity = '0'; logoCore.style.transition = 'none'; }
    chars.forEach(function(ch, idx) {
        if (ch.dataset.real) { ch.textContent = ch.dataset.real; delete ch.dataset.real; }
        delete ch.dataset.decoded;
        ch.style.opacity = '0';
        ch.style.color = '#808080';
        ch.style.textShadow = '0 0 15px rgba(128,128,128,0.6), 0 0 30px rgba(128,128,128,0.2)';
        ch.style.transform = idx === 0 ? 'scaleX(-1) scaleY(1.5) translateY(20px)' : 'scaleY(1.5) scaleX(0.8) translateY(20px)';
        ch.style.filter = 'brightness(2)';
        ch.style.transition = 'none';
        ch.style.display = 'inline-block';
    });
    // scramble timer clear (以前の実装の残骸)
    if (window._inryokuBinaryScrambleTimer) { clearInterval(window._inryokuBinaryScrambleTimer); window._inryokuBinaryScrambleTimer = null; }
    if (window._inryokuCharTimers) { window._inryokuCharTimers.forEach(function(t){ clearInterval(t); }); window._inryokuCharTimers = []; }

    // ── 子要素リセット完了 → ラッパーを表示（中身は全てopacity:0なので何も見えない） ──
    var holoWrap = document.getElementById('holo-logo-wrap');
    if (holoWrap) { holoWrap.style.transition = 'none'; holoWrap.style.opacity = '1'; }
    // logoWrapも表示。ただし core-only 中は殻/scanline/投影光を隠し、コアだけを見せる。
    if (logoWrap) { logoWrap.classList.add('core-only'); logoWrap.style.opacity = '1'; logoWrap.style.transition = 'none'; }
    // 3Dコア生成が早すぎて空振りした場合も、ここで必ず再試行する。
    try { init3DLogoSphere(); } catch(e) { console.warn('[3DLogo] core birth retry failed:', e); }
    logoCore = document.querySelector('.logo-sphere-3d') || logoSphere;

    // ═══════════════════════════════════════════
    //  STEP 1: 球体コアが深淵から実体化（0ms〜）
    //  暗闇の中心にまず微かな光点 → 脈動しながら拡大 → 完全実体化
    // ═══════════════════════════════════════════
    if (logoCore) {
        logoCore.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,0.18)) brightness(0.08) saturate(0)';
        logoCore.style.opacity = '0';
        logoCore.style.transform = 'translateX(-50%) translateZ(34px) scale(0.24)';
    }
    setTimeout(function() {
        if (logoCore) {
            logoCore.style.transition = 'opacity 1.0s ease-in, filter 1.15s ease, transform 1.15s cubic-bezier(0.16,1,0.3,1)';
            logoCore.style.opacity = '0.46';
            logoCore.style.transform = 'translateX(-50%) translateZ(34px) scale(0.62)';
            logoCore.style.filter = 'drop-shadow(0 0 6px rgba(128,128,128,0.42)) brightness(0.34) saturate(0.15)';
        }
    }, 100);
    setTimeout(function() {
        if (logoCore) {
            logoCore.style.transition = 'opacity 0.9s ease, filter 1s ease, transform 1s cubic-bezier(0.16,1,0.3,1)';
            logoCore.style.opacity = '0.82';
            logoCore.style.transform = 'translateX(-50%) translateZ(34px) scale(0.86)';
            logoCore.style.filter = 'drop-shadow(0 0 8px rgba(0,255,255,0.30)) drop-shadow(0 0 16px rgba(255,0,255,0.14)) brightness(0.68) saturate(0.55)';
        }
    }, 900);
    setTimeout(function() {
        if (logoCore) {
            logoCore.style.transition = 'filter 1.0s ease, transform 0.9s cubic-bezier(0.16,1,0.3,1), opacity 0.8s ease';
            logoCore.style.opacity = '1';
            logoCore.style.transform = 'translateX(-50%) translateZ(34px) scale(1.0)';
            logoCore.style.filter = '';
        }
    }, 1700);

    function projectLogoShellFromCore() {
        if (logoWrap) {
            logoWrap.classList.remove('core-only');
        }
        if (!logoShell) return;

        logoShell.style.opacity = '0';
        logoShell.style.transform = 'translate3d(0,0,0) scale(0.88) rotateY(18deg)';
        logoShell.style.filter = 'brightness(1.55) saturate(0.35) hue-rotate(180deg)';

        // コアが先に存在し、その光でロゴ殻が投影される。
        setTimeout(function() {
            logoShell.style.transition = 'opacity 0.8s ease-in, transform 1.5s cubic-bezier(0.16,1,0.3,1), filter 1.2s ease';
            logoShell.style.opacity = '0.18';
            logoShell.style.transform = 'translate3d(0,0,0) scale(0.94) rotateY(8deg)';
            logoShell.style.filter = 'brightness(1.35) saturate(0.5) hue-rotate(120deg)';
        }, 80);
        setTimeout(function() {
            logoShell.style.transition = 'opacity 0.03s, transform 0.03s';
            logoShell.style.opacity = '0.02';
            logoShell.style.transform = 'translate3d(2px,0,0) scale(0.95) rotateY(6deg)';
        }, 720);
        setTimeout(function() {
            logoShell.style.transition = 'opacity 0.03s, transform 0.03s';
            logoShell.style.opacity = '0.42';
            logoShell.style.transform = 'translate3d(-1.5px,0,0) scale(0.98) rotateY(-3deg)';
        }, 780);
        setTimeout(function() {
            logoShell.style.transition = 'opacity 0.03s, transform 0.03s';
            logoShell.style.opacity = '0.1';
            logoShell.style.transform = 'translate3d(1px,0,0) scale(0.99) rotateY(2deg)';
        }, 840);
        setTimeout(function() {
            logoShell.style.transition = 'opacity 1.0s ease, transform 1.2s cubic-bezier(0.16,1,0.3,1), filter 1.5s ease';
            logoShell.style.opacity = '0.76';
            logoShell.style.transform = 'translate3d(0,0,0) scale(1.0) rotateY(0deg)';
            logoShell.style.filter = '';
        }, 920);
        setTimeout(function() {
            logoShell.style.transition = 'opacity 0.8s ease';
            logoShell.style.opacity = '';
            logoShell.style.transform = '';
            setTimeout(function() {
                if (logoShell) { logoShell.style.transition = ''; logoShell.style.animation = ''; }
            }, 900);
        }, 2100);
    }

    // STEP 1.5: コアが実体化したあと、ロゴ本体を先に投影する。
    setTimeout(function() {
        projectLogoShellFromCore();
        playSignatureSound();
    }, 2050);

    // ═══════════════════════════════════════════
    //  STEP 2: ロゴ本体が現れたあと、ブランドネームへ光が走る（2850ms〜）
    // ═══════════════════════════════════════════
    // 2026-04-24: 司「ブランドネームゆっくり」— 2.5倍スロー
    var LIGHT_START = 2850;
    var LIGHT_DELAY = 220;
    var FLIGHT_MS   = 1200;

    // 光粒子コンテナ
    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;z-index:99;pointer-events:none;overflow:hidden;';
    document.body.appendChild(container);

    // ── 球体の中心座標を取得するヘルパー（毎回最新のrectから計算） ──
    function getSphereCenter() {
        // 3D canvas版があればそちらを優先
        var canvas3d = document.querySelector('.logo-sphere-3d');
        if (canvas3d) {
            var r = canvas3d.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
        if (!logoSphere) return { x: window.innerWidth / 2, y: window.innerHeight * 0.15 };
        var r = logoSphere.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * 0.3 };
    }

    chars.forEach(function(ch, idx) {
        var color = charColors[idx];
        var glow  = charGlows[idx];
        var lightDelay = LIGHT_START + idx * LIGHT_DELAY;

        var hexToRgb = function(hex) {
            var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
            return {r:r, g:g, b:b};
        };
        var rgb = hexToRgb(color);

        // 光を発射（setTimeoutの中で全てを生成 — 球体位置が確定してから）
        setTimeout(function() {
            // ★ 球体の正確な中心座標を発射時に取得（これが絶対の出発点）
            var origin = getSphereCenter();
            var osx = origin.x;
            var osy = origin.y;

            // 光粒子（コア + トレイル） — そのままの光
            var dot = document.createElement('div');
            dot.style.cssText =
                'position:absolute;border-radius:50%;will-change:transform,opacity;' +
                'width:6px;height:6px;' +
                'background:radial-gradient(circle, #ffffff 0%, ' + color + ' 50%, transparent 80%);' +
                'box-shadow:0 0 12px 5px rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.8),' +
                '0 0 35px 10px rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.4),' +
                '0 0 60px 20px rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.15);' +
                'left:' + osx + 'px;top:' + osy + 'px;opacity:0;';
            container.appendChild(dot);

            // トレイル粒子（光の尾）
            var TRAIL_COUNT = 5;
            var trails = [];
            for (var ti = 0; ti < TRAIL_COUNT; ti++) {
                var trail = document.createElement('div');
                var trailSize = 4 - ti * 0.6;
                var trailOp = 0.5 - ti * 0.08;
                trail.style.cssText =
                    'position:absolute;border-radius:50%;will-change:transform,opacity;' +
                    'width:' + trailSize + 'px;height:' + trailSize + 'px;' +
                    'background:radial-gradient(circle, ' + color + ' 0%, transparent 80%);' +
                    'box-shadow:0 0 8px rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + trailOp + ');' +
                    'left:' + osx + 'px;top:' + osy + 'px;opacity:0;';
                container.appendChild(trail);
                trails.push(trail);
            }

            var charRect = ch.getBoundingClientRect();
            var tx = charRect.left + charRect.width / 2;
            var ty = charRect.top + charRect.height / 2;
            // 中間経由点 — 球体中心から扇状に広がる弧
            var spread = (idx - 3) * 30;
            var midX = osx + spread;
            var midY = Math.min(osy, ty) - 60 - Math.abs(idx - 3) * 10;
            var posHistory = [];

            dot.style.opacity = '1';
            trails.forEach(function(t) { t.style.opacity = '1'; });
            var t0 = performance.now();

            function animateLight(now) {
                var elapsed = now - t0;
                var prog = Math.min(elapsed / FLIGHT_MS, 1.0);
                var ease = prog < 0.5
                    ? 4 * prog * prog * prog
                    : 1 - Math.pow(-2 * prog + 2, 3) / 2;
                // 二次ベジェ曲線（球体中心→中間→文字）
                var oneMinE = 1 - ease;
                var mx = oneMinE * oneMinE * osx + 2 * oneMinE * ease * midX + ease * ease * tx;
                var my = oneMinE * oneMinE * osy + 2 * oneMinE * ease * midY + ease * ease * ty;
                var wobAmp = 8 * (1 - prog) * Math.sin(prog * Math.PI);
                var wobX = Math.sin(elapsed * 0.01 + idx * 2.5) * wobAmp;
                var wobY = Math.cos(elapsed * 0.007 + idx * 1.8) * wobAmp * 0.6;

                var fx = mx + wobX;
                var fy = my + wobY;
                dot.style.transform = 'translate(' + (fx - osx) + 'px,' + (fy - osy) + 'px)';
                var brightness = prog > 0.8 ? 1.0 : 0.5 + 0.5 * prog;
                dot.style.opacity = String(brightness);

                posHistory.push({x: fx, y: fy});
                for (var ti = 0; ti < trails.length; ti++) {
                    var histIdx = posHistory.length - 1 - (ti + 1) * 3;
                    if (histIdx >= 0) {
                        var hp = posHistory[histIdx];
                        trails[ti].style.transform = 'translate(' + (hp.x - osx) + 'px,' + (hp.y - osy) + 'px)';
                        trails[ti].style.opacity = String((0.4 - ti * 0.07) * (1 - prog * 0.5));
                    }
                }

                if (prog < 1.0) {
                    requestAnimationFrame(animateLight);
                } else {
                    dot.style.transition = 'opacity 0.25s ease, transform 0.3s ease';
                    dot.style.opacity = '0';
                    dot.style.transform = 'translate(' + (tx - osx) + 'px,' + (ty - osy) + 'px) scale(3)';
                    trails.forEach(function(t) {
                        t.style.transition = 'opacity 0.2s ease';
                        t.style.opacity = '0';
                    });
                    setTimeout(function() {
                        dot.remove();
                        trails.forEach(function(t) { t.remove(); });
                    }, 400);

                    // ── STEP 4: ホログラム文字演出 + SF音 ──
                    playBrandRevealSF(idx, chars.length);
                    // シアンで出現（translateYからの浮上 + スケール補正） — 司要望でスロー化
                    ch.style.transition = 'opacity 1.1s ease, transform 1.1s cubic-bezier(0.23, 1, 0.32, 1)';
                    ch.style.opacity = '0.7';
                    ch.style.transform = 'scaleY(1.1) scaleX(0.95) translateY(0px)';

                    setTimeout(function() {
                        ch.style.transition = 'opacity 0.12s';
                        ch.style.opacity = '0.15';
                    }, 380);

                    setTimeout(function() {
                        ch.style.transition = 'opacity 0.22s, transform 1.1s cubic-bezier(0.23, 1, 0.32, 1)';
                        ch.style.opacity = '0.85';
                        ch.style.transform = 'scaleY(1.0) scaleX(1.0) translateY(0px)';
                        ch.style.filter = 'brightness(1.5)';
                    }, 580);

                    setTimeout(function() {
                        ch.style.transition = 'color 1.1s cubic-bezier(0.23, 1, 0.32, 1), text-shadow 1.1s ease, filter 1.1s ease, opacity 1.1s ease';
                        ch.style.opacity = '1';
                        ch.style.color = color;
                        ch.style.textShadow = '0 0 8px ' + glow;
                        ch.style.filter = 'brightness(1.1)';
                    }, 1100);

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
    //  STEP 3: ブランド名完了後 → シェル(0+1)ホログラム登場
    // ═══════════════════════════════════════════
    var allDoneTime = LIGHT_START + (chars.length - 1) * LIGHT_DELAY + FLIGHT_MS + 800;

    setTimeout(function() {
        container.remove();

        // ── STEP 4: プリズムライン + 商品カード + 球体ビーコン ──
        setTimeout(function() {
            if (prismLine) { prismLine.style.transition = 'opacity 1s ease'; prismLine.style.opacity = '1'; }
            setTimeout(function() {
                var itemGrid = document.querySelector('.item-grid');
                if (itemGrid) {
                    itemGrid.style.opacity = '1';
                    var cards = itemGrid.querySelectorAll('.carousel-item');
                    cards.forEach(function(card, idx) {
                        card.style.setProperty('--entry-index', String(idx));
                    });
                    requestAnimationFrame(function() {
                        itemGrid.classList.add('store-materialized');
                    });
                }
                // 全UIフェードイン（ブランドロゴ完了後）
                var cartIcon = document.getElementById('cart-icon');
                var muteBtn = document.getElementById('mute-btn');
                var bgmBtn = document.getElementById('bgm-btn');
                var emailSignup = document.getElementById('email-signup');
                var siteFooter = document.querySelector('.site-footer');
                var themeSw = document.getElementById('theme-switcher');
                var contactFrm = document.getElementById('contact-form');
                [cartIcon, muteBtn, bgmBtn, emailSignup, siteFooter, themeSw, contactFrm].forEach(function(el) {
                    if (el) { el.style.opacity = '1'; el.style.pointerEvents = 'auto'; }
                });
            }, 800);

            // 球体ビーコン
            setTimeout(function() {
                if (logoSphere) {
                    logoSphere.style.animation = 'sphereBeacon 1.8s ease-in-out infinite';
                    logoSphere.style.cursor = 'pointer';
                }
            }, 1000);

            // 2026-04-22: 司要望「ホログラム感は最初だけ、後はちょっっとでいい」
            // UI 出現 (800ms 後) + 余韻 1.4s で holo を calm mode に
            setTimeout(function() {
                var wrap = document.querySelector('.logo-holo-wrap');
                if (wrap) wrap.classList.add('holo-calmed');
            }, 2200);
        }, 2500);

        // 球体のCSSアニメーション移行
        if (logoSphere) {
            setTimeout(function() {
                logoSphere.style.transition = ''; logoSphere.style.animation = '';
            }, 2000);
        }
    }, allDoneTime);
}

// ═══ THREE.JS 粒子宇宙 ═══
function initParticleUniverse() {
    if (typeof THREE === 'undefined') { console.error('[P3] Three.js required'); return; }

    // 2026-04-19: 初期化時に window が 0x0 になるケース（iframe/タブ初期）対策
    // 0 の場合はフォールバックサイズで初期化し、初回リサイズで正しくなる
    let W = window.innerWidth || document.documentElement.clientWidth || 1280;
    let H = window.innerHeight || document.documentElement.clientHeight || 720;
    if (W < 2 || H < 2) { W = 1280; H = 720; }

    // 2026-04-30: prefers-reduced-motion: reduce 対応
    // 検出は initParticleUniverse 冒頭で 1 回。OS 設定変更には mql.change で追従。
    // 星座と粒子は「見える」が、drift / rotation / twinkle は静止する。
    let reduceMotion = false;
    // 2026-04-30: closure leak fix — initParticleUniverse が再呼出 (sample 切替等) されると
    // 古い material を掴むハンドラが残るバグ対策。named handler を変数に保存し、
    // destroy 経路 (currentPhase !== 3) で removeEventListener を呼ぶ。
    let _onMotionChange = null;
    let _mqlRef = null;
    try {
        const mql = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mql) {
            _mqlRef = mql;
            reduceMotion = !!mql.matches;
            _onMotionChange = (ev) => {
                reduceMotion = !!ev.matches;
                try {
                    if (typeof material !== 'undefined' && material && material.uniforms && material.uniforms.uReduceMotion)
                        material.uniforms.uReduceMotion.value = reduceMotion ? 1.0 : 0.0;
                    // 旧 csMat/csEdgeMat reduce-motion 同期 - 2026-05-09 削除: 星座レイヤ全削除に伴い
                    // モード切替時に reveal を再正規化（既存進捗を保つ）
                    // REVEAL_DUR は loop で動的参照されるので自動追従。
                } catch(e){}
            };
            if (typeof mql.addEventListener === 'function') mql.addEventListener('change', _onMotionChange);
            else if (typeof mql.addListener === 'function') mql.addListener(_onMotionChange);
        }
    } catch(e){ reduceMotion = false; }
    console.log('[P3] prefers-reduced-motion:', reduceMotion);

    document.querySelectorAll('body > canvas:not(#p6-canvas)').forEach(c => c.remove());
    const existing = document.getElementById('p6-canvas');
    if (existing) existing.remove();

    // ── Renderer ──
    // 2026-05-05: 司「重い」→ DPR 上限 2→1.5、antialias OFF（bloom がぼかし吸収）
    const renderer6 = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer6.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer6.setSize(W, H);
    renderer6.setClearColor(0x000000, 1);
    if (typeof THREE.SRGBColorSpace !== 'undefined') renderer6.outputColorSpace = THREE.SRGBColorSpace;
    if (typeof THREE.ACESFilmicToneMapping !== 'undefined') renderer6.toneMapping = THREE.ACESFilmicToneMapping;
    renderer6.toneMappingExposure = 1.06;
    renderer6.domElement.id = 'p6-canvas';
    renderer6.domElement.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;' +
        'pointer-events:none;display:block;';
    document.body.insertBefore(renderer6.domElement, document.body.firstChild);

    // ── Scene / Camera ──
    const scene6 = new THREE.Scene();
    const camera6 = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);
    camera6.position.set(0, 0, 270);
    camera6.lookAt(0, 0, 0);

    // 2026-05-05: ?cstyle=N で星座の幻想バリエーション切替
    //   0=default / 1=mist / 2=pulse / 3=flare / 4=all / 5=spectral echo
    const CSTYLE = (() => {
        try {
            const m = location.search.match(/[?&]cstyle=(\d+)/);
            return m ? Math.max(0, Math.min(5, parseInt(m[1], 10))) : 5;
        } catch (e) { return 5; }
    })();
    const CS_MIST   = (CSTYLE === 1 || CSTYLE === 4);
    const CS_PULSE  = (CSTYLE === 2 || CSTYLE === 4);
    const CS_FLARE  = (CSTYLE === 3 || CSTYLE === 4);
    const CS_DRIFT  = (CSTYLE === 4);
    const CS_ECHO   = (CSTYLE === 5);
    // 旧 SHOW_CONSTELLATIONS フラグ - 2026-05-09 削除: 星座レイヤ全削除に伴い (新コンセプト「コア → ロゴ → 粒子 → 服」)
    console.log('[P3] cstyle=', CSTYLE, '{mist:', CS_MIST, 'pulse:', CS_PULSE, 'flare:', CS_FLARE, 'drift:', CS_DRIFT, 'echo:', CS_ECHO, '}');

    // ═══════════════════════════════════════════════════════════════
    //  パーティクル宇宙
    // ═══════════════════════════════════════════════════════════════
    const isMobile = W < 768;
    // 2026-05-07: 粒子密度を半分へ調整。余白を残して服とロゴを立たせる。
    const N = isMobile ? 850 : 1500;

    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const aSizes = new Float32Array(N);
    const aPhases = new Float32Array(N);
    const aBirth = new Float32Array(N);  // 2026-04-30: per-particle reveal time (0..1)
    const driftTempo = new Float32Array(N);
    const motionKind = new Uint8Array(N);      // 0=drift / 1=inbound / 2=fast-cross
    const travelAngle = new Float32Array(N);
    const travelOffset = new Float32Array(N);
    const travelSpeed = new Float32Array(N);

    function gaussRand() {
        let u = 0, v = 0;
        while (u === 0) u = uRng();
        while (v === 0) v = uRng();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    // 司「粒子の色は CMYRGB だけ」
    // 2026-05-06: 純粋 RGBCMY に統一（混色なし）+ HDR 化で bloom にも乗る
    const PALETTE = [
        [1.50, 0.00, 0.00],   // R 純赤
        [0.00, 1.50, 0.00],   // G 純緑
        [0.00, 0.00, 1.60],   // B 純青
        [0.00, 1.50, 1.50],   // C 純シアン
        [1.50, 0.00, 1.50],   // M 純マゼンタ
        [1.50, 1.50, 0.00],   // Y 純イエロー
    ];

    for (let i = 0; i < N; i++) {
        const r = 80 + Math.pow(uRng(), 1.16) * 420;
        const theta = uRng() * Math.PI * 2;
        const phi = Math.acos(2 * uRng() - 1);
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        const idx = Math.floor(uRng() * PALETTE.length);
        const c = PALETTE[idx];
        const jitter = 0.05;
        colors[i * 3]     = Math.max(0, Math.min(1, c[0] + (uRng() - 0.5) * jitter));
        colors[i * 3 + 1] = Math.max(0, Math.min(1, c[1] + (uRng() - 0.5) * jitter));
        colors[i * 3 + 2] = Math.max(0, Math.min(1, c[2] + (uRng() - 0.5) * jitter));

        // 2026-04-30: サイズ4層（微70/中22/大6/超大2%）— 大粒は希少にして「遠近の光」に見せる
        const sizeRoll = uRng();
        let s;
        // 旧来の落ち着いたバランス + 大粒もそこそこ。徐々に出る方を主役に
        if (sizeRoll < 0.30) {
            s = 1.5 + uRng() * 2.5;        // 微: 1.5–4（30%）
        } else if (sizeRoll < 0.62) {
            s = 5.0 + uRng() * 6.0;        // 中: 5–11（32%）
        } else if (sizeRoll < 0.88) {
            s = 12.0 + uRng() * 12.0;      // 大: 12–24（26%）
        } else {
            s = 26.0 + Math.pow(uRng(), 0.5) * 22.0;  // 超大: 26–48（12%）
        }
        aSizes[i] = s;

        aPhases[i] = uRng() * Math.PI * 2;
        // birth: ほぼ全粒子が 0..0.85 の範囲でランダムに灯る → uReveal が 0→1 のとき長く尾を引く
        aBirth[i] = Math.pow(uRng(), 1.2) * 0.88;
        driftTempo[i] = uRng() < 0.07 ? (1.63 + uRng() * 0.61) : (0.97 + uRng() * 0.46);
        // 2026-04-30: 静止粒子を廃止。全粒子が動く
        // 1=arc(70% 弧軌道) / 2=approach(12% 奥→手前) / 3=passthrough(18% 奥を横切る)
        const motionRoll = uRng();
        motionKind[i] = motionRoll < 0.70 ? 1 : motionRoll < 0.82 ? 2 : 3;
        travelAngle[i] = uRng() * Math.PI * 2;
        travelOffset[i] = uRng();
        // 役割別 speed: approach=ゆっくり / passthrough=やや速め
        travelSpeed[i] = motionKind[i] === 2 ? (0.006 + uRng() * 0.009) : (0.018 + uRng() * 0.022);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(aSizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(aPhases, 1));
    geometry.setAttribute('aBirth', new THREE.BufferAttribute(aBirth, 1));
    const idleBasePositions = positions.slice();

    const SIMPLE_IDLE_UNIVERSE = true;
    const ENABLE_COMPLEX_CHAT_FIELDS = false;

    // ═══════════════════════════════════════════════════════════════
    //  ShaderMaterial — 呼吸する丸い光の粒
    // ═══════════════════════════════════════════════════════════════
    // 2026-04-30: ?sample=N で粒子の質感を切替（光・グロー・コアの違い）
    const SAMPLE_N = (() => {
        try { const m = location.search.match(/[?&]sample=(\d+)/); if (m) { const n = parseInt(m[1]); if (n>=0 && n<=10) return n; } } catch(e){}
        return 0;
    })();
    const FRAGMENT_VARIANTS = {
        0: `// default(hybrid 4+7): 三層グロー + 微ノイズ（スパイクなし）
float _hash21(vec2 p) { return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    // 三層グロー（4）
    float core = exp(-d*d*60.0) * 0.85;
    float halo = exp(-d*d*8.0) * 0.18;
    float veil = exp(-d*d*2.0) * 0.06;
    // 微ノイズ（7）— 質感だけ加える
    float n = 0.85 + 0.15 * _hash21(gl_PointCoord * 60.0);
    float breathe = 0.88 + 0.12 * vBreathe;
    // 2026-04-30: audio glow — uAudioEnergy で 18% まで光量ブースト（旧 5%→18%）
    float audioGlow = 1.0 + uAudioEnergy * 0.18;
    vec3 col = vColor * (core * 1.55 + halo * 0.95 + veil * 0.45) * n * audioGlow;
    float a = (core * 1.05 + halo * 0.55 + veil * 0.22) * vReveal;
    gl_FragColor = vec4(col * breathe, clamp(a, 0.0, 0.96));
}`,
        1: `// 1: Sharp / no halo
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float edge = 1.0 - smoothstep(0.42, 0.5, d);
    float breathe = 0.88 + 0.12 * vBreathe;
    gl_FragColor = vec4(vColor * breathe, edge * 0.95 * vReveal);
}`,
        2: `// 2: Gaussian soft
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float g = exp(-d*d*16.0);
    float breathe = 0.88 + 0.12 * vBreathe;
    gl_FragColor = vec4(vColor * g * 1.6 * breathe, g * 0.92 * vReveal);
}`,
        3: `// 3: Two-layer glow
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = exp(-d*d*45.0) * 0.85;
    float halo = exp(-d*d*5.0) * 0.18;
    float a = (core + halo) * vReveal;
    gl_FragColor = vec4(vColor * (core*1.6 + halo*1.0), clamp(a, 0.0, 0.95));
}`,
        4: `// 4: Three-layer glow
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = exp(-d*d*60.0) * 0.85;
    float halo = exp(-d*d*8.0) * 0.18;
    float veil = exp(-d*d*2.0) * 0.06;
    float a = (core + halo + veil) * vReveal;
    gl_FragColor = vec4(vColor * (core*1.6 + halo*0.9 + veil*0.5), clamp(a, 0.0, 0.95));
}`,
        5: `// 5: Lens flare cross
void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);
    if (d > 0.5) discard;
    float core = exp(-d*d*40.0) * 0.7;
    float fx = exp(-p.y*p.y*120.0) * exp(-abs(p.x)*3.0) * 0.5;
    float fy = exp(-p.x*p.x*120.0) * exp(-abs(p.y)*3.0) * 0.5;
    float flare = fx + fy;
    float a = (core + flare * 0.6) * vReveal;
    gl_FragColor = vec4(vColor * (core*1.4 + flare*1.5), clamp(a, 0.0, 0.95));
}`,
        6: `// 6: Ring (donut)
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float ring = exp(-pow(d - 0.30, 2.0) * 200.0);
    float a = ring * 0.85 * vReveal;
    gl_FragColor = vec4(vColor * ring * 1.6, a);
}`,
        7: `// 7: Noisy / granular
float _hash21(vec2 p) { return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = exp(-d*d*30.0) * 0.85;
    float n = 0.5 + 0.5 * _hash21(gl_PointCoord * 80.0);
    float a = core * n * vReveal;
    gl_FragColor = vec4(vColor * core * n * 1.6, clamp(a, 0.0, 0.95));
}`,
        8: `// 8: Chromatic aberration
void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);
    if (d > 0.55) discard;
    float ar = exp(-pow(length(p + vec2( 0.04, 0.0)), 2.0) * 35.0);
    float ag = exp(-d*d*35.0);
    float ab = exp(-pow(length(p + vec2(-0.04, 0.0)), 2.0) * 35.0);
    vec3 col = vec3(ar, ag, ab) + vColor * ag * 0.5;
    float a = max(max(ar, ag), ab) * vReveal * 0.9;
    gl_FragColor = vec4(col * 1.3, clamp(a, 0.0, 0.95));
}`,
        9: `// 9: 4-point twinkle star
void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);
    if (d > 0.5) discard;
    float core = exp(-d*d*55.0) * 0.6;
    float fx = exp(-p.y*p.y*250.0) * exp(-abs(p.x)*2.5) * 0.65;
    float fy = exp(-p.x*p.x*250.0) * exp(-abs(p.y)*2.5) * 0.65;
    float spike = fx + fy;
    float a = (core + spike * 0.8) * vReveal;
    gl_FragColor = vec4(vColor * (core*1.4 + spike*1.7), clamp(a, 0.0, 0.95));
}`,
        10: `// 10: Nebula / reverse glow
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float ring = exp(-pow(d - 0.32, 2.0) * 30.0) * 0.7;
    float dim = exp(-d*d*3.0) * 0.15;
    float a = (ring + dim) * vReveal * 0.85;
    gl_FragColor = vec4(vColor * (ring + dim * 0.6) * 1.3, clamp(a, 0.0, 0.92));
}`
    };
    const _fragVariantBody = FRAGMENT_VARIANTS[SAMPLE_N] || FRAGMENT_VARIANTS[0];
    console.log('[P3] particle sample variant:', SAMPLE_N);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uAudioEnergy: { value: 0.0 },
            uAudioBass: { value: 0.0 },
            uAudioHigh: { value: 0.0 },
            uObserverFocus: { value: 0.0 },
            uReveal: { value: 0.0 },
            uReduceMotion: { value: reduceMotion ? 1.0 : 0.0 },
            // 2026-05-05: ロゴ周辺の粒子を薄める（NDC -1..1 / NDC半径）
            uLogoCenterNDC: { value: new THREE.Vector2(0, 0.55) },
            uLogoRadiusNDC: { value: 0.18 }
        },
        vertexShader: `
            attribute float aSize;
            attribute float aPhase;
            attribute float aBirth;
            varying vec3 vColor;
            varying float vBreathe;
            varying float vDist;
            varying float vPhase;
            varying float vDepthGlow;
            varying float vReveal;
            uniform float uTime;
            uniform float uAudioEnergy;
            uniform float uAudioBass;
            uniform float uAudioHigh;
            uniform float uObserverFocus;
            uniform float uReveal;
            uniform float uReduceMotion;
            uniform vec2 uLogoCenterNDC;
            uniform float uLogoRadiusNDC;

void main() {
    vColor = color;
    vPhase = aPhase;

    // 呼吸は残すが単純化する
    float audioBoost = 1.0 + uAudioEnergy * 0.35;
    float breatheSpeed = (0.28 + aPhase * 0.08) * audioBoost;
    float b1 = sin(uTime * breatheSpeed + aPhase);
    vBreathe = b1 * 0.5 + 0.5;
    // reduce-motion: twinkle/breath を中立値 0.5 に固定
    vBreathe = mix(vBreathe, 0.5, uReduceMotion);

    // カメラからの距離（ニュートンリング風エフェクト用）
    vDist = length(position);

    float sizeBreath = 1.0 + vBreathe * (0.10 + uAudioBass * 0.20 + uAudioHigh * 0.04);

    // 2026-04-30: per-particle reveal — uReveal が aBirth を超えてから 0.18 で全開
    float rv = smoothstep(0.0, 0.18, uReveal - aBirth);
    vReveal = rv;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    float depthNorm = clamp((-mvPos.z - 100.0) / 700.0, 0.0, 1.0);
    vDepthGlow = depthNorm;
    // サイズも reveal に応じてふわっと拡大（最後の20%でほぼ等倍）
    float sizeReveal = 0.55 + 0.45 * rv;
    gl_PointSize = aSize * sizeBreath * sizeReveal * (455.0 / -mvPos.z);
    gl_PointSize = max(gl_PointSize, 1.4);
    gl_PointSize = min(gl_PointSize, 180.0);
    gl_Position = projectionMatrix * mvPos;

    // 2026-05-06: ロゴマスクを「ロゴそのものだけ」に縮小（黒い穴感を解消）
    // 縁ですぐ復活、外側は完全に通常。最低 0.35 で残し「消える」ではなく「薄くなる」だけ
    vec2 ndc = gl_Position.xy / max(gl_Position.w, 0.0001);
    float distFromLogo = length(ndc - uLogoCenterNDC);
    float logoMaskRaw = smoothstep(uLogoRadiusNDC * 0.78, uLogoRadiusNDC * 1.02, distFromLogo);
    float logoMask = mix(0.35, 1.0, logoMaskRaw);
    gl_PointSize *= logoMask;
    vReveal *= logoMask;
}
`,
        fragmentShader: `
            varying vec3 vColor;
            varying float vBreathe;
            varying float vDist;
            varying float vPhase;
            varying float vDepthGlow;
            varying float vReveal;
            uniform float uTime;
            uniform float uAudioEnergy;
            uniform float uAudioBass;
            uniform float uAudioHigh;
            uniform float uObserverFocus;
            uniform float uReduceMotion;
` + _fragVariantBody,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true
    });

    const particles = new THREE.Points(geometry, material);
    scene6.add(particles);

    // 旧 名前付き星座 (Observer/Egg/Trinity/Bridge/Eye/Resonance) + Bridge + Mist + Discovery Hover
    // 2026-05-09 削除: 約 800 行。新コンセプト「黒→コア→ロゴ→粒子→服」では星座レイヤを廃止。
    // 削除対象: CONSTELLATIONS_REAL/LACE/NEURON データ、csGeom/csMat、csLines、csDotLines、
    //           bridgeMat/bridgePoints、csMistMat/csMistPoints、hoverState/pickConstellation 等。
    // 関連 helper (MAX_LINES / linePositions / updateConstellations 等 4120-4395) はチャット粒子網用なので残置。

    // ── パーティクル段階的出現（星がひとつずつ灯るように） ──
    let visibleCount = N;
    // 2026-04-29: 司「もっと宇宙を感じたい」→ 初速が遅すぎたので出現を前倒し
    // 最初の数秒で宇宙の母数を見せつつ、後半もじわっと増える
    const SPAWN_DURATION = 10.0; // 秒
    let spawnElapsed = SPAWN_DURATION;
    geometry.setDrawRange(0, N);

    // ── ビッグバン音: 宇宙誕生の衝撃波 ──
    // 超低音ドローン + ホワイトノイズバースト + 上昇ハーモニクス
    function playBigBangSound() {
        if (window._inryokuMuted) return;
        // 共有AudioContext + Analyserを使う（粒子がビッグバン音にも反応する）
        initP3Audio();
        let ctx = p3AudioCtx;
        if (!ctx) {
            try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return; }
        }
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0, now);
        master.gain.linearRampToValueAtTime(0.15, now + 0.05);
        master.gain.linearRampToValueAtTime(0.08, now + 2.0);
        master.gain.exponentialRampToValueAtTime(0.001, now + 6.0);
        // Analyserに通す（粒子が音に反応する）— initP3Audioで既にanalyser→destinationは接続済み
        if (p3Analyser) { master.connect(p3Analyser); }
        else { master.connect(ctx.destination); }

        // 1) 温かいサブベース C2（宇宙の始まりの温もり）
        const sub = ctx.createOscillator();
        sub.type = 'sine'; sub.frequency.setValueAtTime(65.41, now);
        sub.frequency.exponentialRampToValueAtTime(130.81, now + 3.0); // C2→C3 上昇
        const subG = ctx.createGain(); subG.gain.value = 0.6;
        sub.connect(subG); subG.connect(master);
        sub.start(now); sub.stop(now + 4.0);

        // 2) ソフトノイズブルーム（爆発ではなく花が咲くような）
        const nLen = ctx.sampleRate * 3;
        const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
        const nd = nBuf.getChannelData(0);
        for (let i = 0; i < nLen; i++) {
            // ゆっくり膨らんで消える（花びらの開き方）
            const t = i / ctx.sampleRate;
            const env = Math.sin(Math.min(t * 2, 1) * Math.PI * 0.5) * Math.exp(-t * 1.2);
            nd[i] = (Math.random() * 2 - 1) * env;
        }
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const nf = ctx.createBiquadFilter();
        nf.type = 'bandpass'; nf.frequency.setValueAtTime(400, now);
        nf.frequency.exponentialRampToValueAtTime(3000, now + 2.0);
        nf.Q.value = 0.7;
        const nsG = ctx.createGain(); nsG.gain.value = 0.2;
        ns.connect(nf); nf.connect(nsG); nsG.connect(master);
        ns.start(now);

        // 3) 上昇メジャーコード（Cmaj → Emaj）希望の光
        const chords = [
            { f: [130.81, 164.81, 196.00], start: 0.2 },  // C3, E3, G3 = Cmaj
            { f: [164.81, 207.65, 246.94], start: 1.5 },  // E3, G#3, B3 = Emaj
            { f: [196.00, 246.94, 293.66], start: 2.5 }   // G3, B3, D4 = Gmaj
        ];
        chords.forEach(ch => {
            ch.f.forEach((f, fi) => {
                const o = ctx.createOscillator();
                o.type = fi === 0 ? 'sine' : 'triangle';
                o.frequency.setValueAtTime(f, now + ch.start);
                o.frequency.exponentialRampToValueAtTime(f * 2, now + ch.start + 3.0);
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, now + ch.start);
                g.gain.linearRampToValueAtTime(0.12, now + ch.start + 0.5);
                g.gain.exponentialRampToValueAtTime(0.001, now + ch.start + 4.0);
                o.connect(g); g.connect(master);
                o.start(now + ch.start); o.stop(now + ch.start + 4.5);
            });
        });

        // 4) きらめきアルペジオ（星が次々と灯る）
        const sparkleNotes = [523, 659, 784, 1047, 1319, 1568, 2093]; // C5→C7
        sparkleNotes.forEach((f, i) => {
            const o = ctx.createOscillator();
            o.type = 'sine'; o.frequency.value = f;
            const g = ctx.createGain();
            const t = now + 0.8 + i * 0.25;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.05, t + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
            o.connect(g); g.connect(master);
            o.start(t); o.stop(t + 1.7);
        });

        // 5) ハープグリッサンド風（上昇する光の粒）
        for (let i = 0; i < 12; i++) {
            const o = ctx.createOscillator();
            o.type = 'sine';
            // ペンタトニック: C D E G A の繰り返し
            const penta = [261.63, 293.66, 329.63, 392.00, 440.00];
            const octave = Math.floor(i / 5);
            o.frequency.value = penta[i % 5] * Math.pow(2, octave);
            const g = ctx.createGain();
            const t = now + 1.5 + i * 0.08;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.025, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
            o.connect(g); g.connect(master);
            o.start(t); o.stop(t + 1.0);
        }

        // 共有AudioContextなのでcloseしない（BGMとAnalyserが使い続ける）
    }
    // 初回スポーン開始時にビッグバン音を鳴らす
    setTimeout(playBigBangSound, 300);

    // ═══════════════════════════════════════════════════════════════
    //  星座ネットワーク (Constellation Lines)
    // ═══════════════════════════════════════════════════════════════
    // 2026-04-29: ロゴ/商品周辺のコード宇宙を見せるため少し増やす
    const MAX_LINES = 640;
    const linePositions = new Float32Array(MAX_LINES * 6);
    const lineColors = new Float32Array(MAX_LINES * 6);
    const lineStrengths = new Float32Array(MAX_LINES * 2);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    lineGeo.setAttribute('lineStrength', new THREE.BufferAttribute(lineStrengths, 1));
    // 星座ライン用 ShaderMaterial（距離減衰+時間明滅+音楽反応）
    const lineMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0.0 }, uAudioEnergy: { value: 0.0 } },
        vertexShader: `
            attribute float lineStrength;
            varying vec3 vColor;
            varying float vDepth;
            varying float vLineStrength;
            void main() {
                vColor = color;
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                vDepth = -mvPos.z;
                vLineStrength = lineStrength;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vDepth;
            varying float vLineStrength;
            uniform float uTime;
            uniform float uAudioEnergy;
            void main() {
                // 遠くのラインほど暗く、少しだけ冷たい信号線へ寄せる
                float depthFade = clamp(1.0 - vDepth / 400.0, 0.0, 1.0);
                depthFade = depthFade * depthFade;
                float calmTwinkle = 0.90 + 0.07 * sin(uTime * 0.42 + vDepth * 0.032);
                float fieldTwinkle = 0.94 + 0.04 * sin(uTime * 0.22 + vDepth * 0.018);
                float twinkle = mix(calmTwinkle, fieldTwinkle, vLineStrength) + uAudioEnergy * 0.08;
                float pulse = mix(
                    0.94 + 0.06 * sin(uTime * 0.24 + vDepth * 0.020),
                    0.98 + 0.03 * sin(uTime * 0.16 + vDepth * 0.014),
                    vLineStrength
                );
                float codePulse = smoothstep(0.18, 0.88, sin(uTime * 1.1 - vDepth * 0.06) * 0.5 + 0.5);
                vec3 lineColor = mix(vColor, vec3(0.74, 0.86, 0.98), 0.12 + codePulse * 0.05 + vLineStrength * 0.06);
                float alpha = depthFade * twinkle * mix(0.18 + codePulse * 0.05, 0.30 + codePulse * 0.06, vLineStrength);
                gl_FragColor = vec4(lineColor * (0.60 + depthFade * 0.26) * pulse, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true
    });
    const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene6.add(linesMesh);

    const fieldTints = {
        logo: [0.30, 0.88, 1.0],
        product: [0.86, 0.96, 0.42]
    };
    const cosmicFields = {
        logo: {
            active: false, x: 0, y: 0, z: 18, radius: 68, tint: fieldTints.logo,
            pull: 0.010, swirl: 0.006, damping: 0.90
        },
        product: {
            active: false, x: 0, y: 0, z: 10, radius: 92, tint: fieldTints.product,
            pull: 0.008, swirl: -0.004, damping: 0.92
        }
    };
    let cosmicFieldTick = 0;

    function screenToWorldAtZ(clientX, clientY, zPlane) {
        const nx = (clientX / window.innerWidth) * 2 - 1;
        const ny = -(clientY / window.innerHeight) * 2 + 1;
        const vec = new THREE.Vector3(nx, ny, 0.5);
        vec.unproject(camera6);
        const dir = vec.sub(camera6.position).normalize();
        const t = (zPlane - camera6.position.z) / dir.z;
        return {
            x: camera6.position.x + dir.x * t,
            y: camera6.position.y + dir.y * t,
            z: zPlane
        };
    }

    function updateCosmicFields() {
        var logoEl = document.getElementById('bb-logo');
        if (logoEl) {
            var lr = logoEl.getBoundingClientRect();
            if (lr.width > 0 && lr.height > 0) {
                var logoWorld = screenToWorldAtZ(lr.left + lr.width / 2, lr.top + lr.height * 0.34, cosmicFields.logo.z);
                cosmicFields.logo.x = logoWorld.x;
                cosmicFields.logo.y = logoWorld.y;
                cosmicFields.logo.active = true;
            } else {
                cosmicFields.logo.active = false;
            }
        } else {
            cosmicFields.logo.active = false;
        }

        var productEl = document.querySelector('.carousel-item.carousel-front .product-card-img');
        if (productEl) {
            var pr = productEl.getBoundingClientRect();
            if (pr.width > 0 && pr.height > 0) {
                var productWorld = screenToWorldAtZ(pr.left + pr.width / 2, pr.top + pr.height * 0.48, cosmicFields.product.z);
                cosmicFields.product.x = productWorld.x;
                cosmicFields.product.y = productWorld.y;
                cosmicFields.product.active = true;
            } else {
                cosmicFields.product.active = false;
            }
        } else {
            cosmicFields.product.active = false;
        }
    }

    function fieldInfluence(x, y, field) {
        if (!field || !field.active) return 0;
        const dx = x - field.x;
        const dy = y - field.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return Math.max(0, 1.0 - dist / field.radius);
    }

    function strongestField(x, y) {
        var best = null;
        var bestScore = 0;
        var keys = Object.keys(cosmicFields);
        for (var i = 0; i < keys.length; i++) {
            var field = cosmicFields[keys[i]];
            var influence = fieldInfluence(x, y, field);
            if (influence > bestScore) {
                bestScore = influence;
                best = field;
            }
        }
        return { field: best, score: bestScore };
    }

    function applyCosmicFieldMotion(i, dt, audioMod) {
        var x = posArr[i * 3];
        var y = posArr[i * 3 + 1];
        var strongest = strongestField(x, y);
        var field = strongest.field;
        var influence = strongest.score;
        if (!field || influence <= 0.02) {
            attractVelX[i] *= 0.94;
            attractVelY[i] *= 0.94;
            return;
        }

        var dx = field.x - x;
        var dy = field.y - y;
        var dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);
        var nx = dx / dist;
        var ny = dy / dist;
        var tangentX = -ny;
        var tangentY = nx;
        var orbitGate = 0.35 + influence * 0.65;
        var forceScale = dt * (0.55 + audioMod * 0.10);

        attractVelX[i] += (nx * field.pull + tangentX * field.swirl * orbitGate) * influence * forceScale;
        attractVelY[i] += (ny * field.pull + tangentY * field.swirl * orbitGate) * influence * forceScale;

        attractVelX[i] *= field.damping;
        attractVelY[i] *= field.damping;

        posArr[i * 3] += attractVelX[i];
        posArr[i * 3 + 1] += attractVelY[i];
    }

    function updateConstellations() {
        const posArr = geometry.attributes.position.array;
        const colArr = geometry.attributes.color.array;
        const camZ = camera6.position.z;

        const nearby = [];
        const vCount = Math.floor(visibleCount);
        const degree = new Uint8Array(vCount);
        for (let i = 0; i < vCount; i++) {
            const z = posArr[i * 3 + 2];
            const dz = z - camZ;
            const x = posArr[i * 3];
            const y = posArr[i * 3 + 1];
            const localField = strongestField(x, y).score;
            if ((dz > -150 && dz < 60) || localField > 0.10) {
                nearby.push(i);
            }
            if (nearby.length >= 640) break;
        }

        let lineIdx = 0;
        const CONNECT_DIST = 54;

        for (let a = 0; a < nearby.length && lineIdx < MAX_LINES; a++) {
            const ia = nearby[a];
            const ax = posArr[ia * 3], ay = posArr[ia * 3 + 1], az = posArr[ia * 3 + 2];
            const fieldA = strongestField(ax, ay);

            for (let b = a + 1; b < nearby.length && lineIdx < MAX_LINES; b++) {
                const ib = nearby[b];
                const bx = posArr[ib * 3], by = posArr[ib * 3 + 1], bz = posArr[ib * 3 + 2];
                const fieldB = strongestField(bx, by);

                const dx = ax - bx, dy = ay - by, dz2 = az - bz;
                const dist = Math.sqrt(dx * dx + dy * dy + dz2 * dz2);
                const fieldBoost = Math.max(fieldA.score, fieldB.score);
                const localConnect = CONNECT_DIST + fieldBoost * 22.0;

                if (dist < localConnect) {
                    if (degree[ia] >= 3 || degree[ib] >= 3) continue;
                    const axisAlign = Math.abs(dz2) / Math.max(dist, 0.001);
                    const planarBias = 1.0 - axisAlign * 0.24;
                    const fade = Math.pow(1.0 - dist / localConnect, 2.5) * (0.48 + fieldBoost * 0.52) * planarBias;
                    const li = lineIdx * 6;
                    const si = lineIdx * 2;

                    linePositions[li] = ax; linePositions[li + 1] = ay; linePositions[li + 2] = az;
                    linePositions[li + 3] = bx; linePositions[li + 4] = by; linePositions[li + 5] = bz;
                    lineStrengths[si] = Math.min(1.0, fieldBoost * 0.92);
                    lineStrengths[si + 1] = Math.min(1.0, fieldBoost * 0.92);

                    // 端点の色をHSL的に鮮やかに保つ: max(r,g,b)で正規化して彩度キープ
                    var ar = colArr[ia*3], ag = colArr[ia*3+1], ab = colArr[ia*3+2];
                    var br = colArr[ib*3], bg = colArr[ib*3+1], bb = colArr[ib*3+2];
                    var aBright = Math.max(ar, ag, ab, 0.3);
                    var bBright = Math.max(br, bg, bb, 0.3);
                    var tintA = fieldA.field ? fieldA.field.tint : null;
                    var tintB = fieldB.field ? fieldB.field.tint : null;
                    var mixA = fieldA.score * 0.38;
                    var mixB = fieldB.score * 0.38;
                    var acr = (ar / aBright), acg = (ag / aBright), acb = (ab / aBright);
                    var bcr = (br / bBright), bcg = (bg / bBright), bcb = (bb / bBright);
                    if (tintA) {
                        acr = acr * (1.0 - mixA) + tintA[0] * mixA;
                        acg = acg * (1.0 - mixA) + tintA[1] * mixA;
                        acb = acb * (1.0 - mixA) + tintA[2] * mixA;
                    }
                    if (tintB) {
                        bcr = bcr * (1.0 - mixB) + tintB[0] * mixB;
                        bcg = bcg * (1.0 - mixB) + tintB[1] * mixB;
                        bcb = bcb * (1.0 - mixB) + tintB[2] * mixB;
                    }
                    lineColors[li]     = acr * fade;
                    lineColors[li + 1] = acg * fade;
                    lineColors[li + 2] = acb * fade;
                    lineColors[li + 3] = bcr * fade;
                    lineColors[li + 4] = bcg * fade;
                    lineColors[li + 5] = bcb * fade;

                    degree[ia] += 1;
                    degree[ib] += 1;
                    lineIdx++;
                }
            }
        }

        for (let i = lineIdx * 6; i < MAX_LINES * 6; i++) {
            linePositions[i] = 0;
            lineColors[i] = 0;
        }
        for (let i = lineIdx * 2; i < MAX_LINES * 2; i++) {
            lineStrengths[i] = 0;
        }

        lineGeo.attributes.position.needsUpdate = true;
        lineGeo.attributes.color.needsUpdate = true;
        lineGeo.attributes.lineStrength.needsUpdate = true;
        lineGeo.setDrawRange(0, lineIdx * 2);
    }

    // ── Bloom ──
    let composer6 = null;
    let bloomPass = null;
    (async function initP3PostFx() {
        try {
            const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] = await Promise.all([
                import('three/addons/postprocessing/EffectComposer.js'),
                import('three/addons/postprocessing/RenderPass.js'),
                import('three/addons/postprocessing/UnrealBloomPass.js')
            ]);
            composer6 = new EffectComposer(renderer6);
            composer6.addPass(new RenderPass(scene6, camera6));
            // 2026-04-29: threshold は低めにして bg/mid 層も見える / strength 抑え目
            // 2026-05-06: bloom 微増（収縮時の輝きを取り戻す）。strength 0.62→0.78 / radius 0.40→0.50
            bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 0.78, 0.50, 0.40);
            composer6.addPass(bloomPass);
            if (typeof composer6.setPixelRatio === 'function') composer6.setPixelRatio(renderer6.getPixelRatio());
            composer6.setSize(W, H);
            console.log('[P3] bloom enabled');
        } catch (e) {
            console.warn('[P3] bloom disabled, fallback render', e);
            composer6 = null;
            bloomPass = null;
        }
    })();

    // ── リサイズ ──
    const onR6 = () => {
        const nw = window.innerWidth || document.documentElement.clientWidth;
        const nh = window.innerHeight || document.documentElement.clientHeight;
        if (nw < 2 || nh < 2) return;
        renderer6.setSize(nw, nh);
        camera6.aspect = nw / nh;
        camera6.updateProjectionMatrix();
        if (composer6) {
            if (typeof composer6.setPixelRatio === 'function') composer6.setPixelRatio(renderer6.getPixelRatio());
            composer6.setSize(nw, nh);
        }
    };
    window.addEventListener('resize', onR6);
    // 2026-04-19: 初期化時に 0x0 だった場合に備え数回リサイズを試みる
    [100, 500, 1500, 3000].forEach(function(ms) { setTimeout(onR6, ms); });

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
    const flowLayer = new Float32Array(N);     // 深度ごとの場の位相
    const flowBias = new Float32Array(N);      // 場に乗る強さ

    // ★ ドリフトもシード依存（同じ宇宙は同じ流れ方）
    // 流れ星フラグ: 一部のパーティクルが超高速で飛ぶ
    const isShootingStar = new Uint8Array(N);
    const shootingDirX = new Float32Array(N);
    const shootingDirY = new Float32Array(N);
    var shootingStarRate = 0.008; // 全体の0.8%が流れ星

    // 2026-04-24: 司「スピードも早すぎ」→ さらに 0.5x
    for (let i = 0; i < N; i++) {
        if (uRng() < shootingStarRate) {
            isShootingStar[i] = 1;
            const speed = 0.08 + uRng() * 0.22;
            driftSpeedZ[i] = speed;
            const ang = uRng() * Math.PI * 2;
            shootingDirX[i] = Math.cos(ang) * 0.15 * speed;
            shootingDirY[i] = Math.sin(ang) * 0.15 * speed;
            colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
            aSizes[i] = 2.0 + uRng() * 3.0;
        } else {
            isShootingStar[i] = 0;
            const isReverse = uRng() < 0.2;
            const speed = 0.0022 + uRng() * 0.011;
            driftSpeedZ[i] = isReverse ? -speed * 0.6 : speed;
            shootingDirX[i] = 0;
            shootingDirY[i] = 0;
        }
        driftFreqX[i] = 0.04 + uRng() * 0.11;
        driftFreqY[i] = 0.03 + uRng() * 0.10;
        driftAmpX[i] = 0.020 + uRng() * 0.12;
        driftAmpY[i] = 0.020 + uRng() * 0.10;
        driftPhaseX[i] = uRng() * Math.PI * 2;
        driftPhaseY[i] = uRng() * Math.PI * 2;
        flowLayer[i] = uRng() * Math.PI * 2;
        flowBias[i] = 0.35 + uRng() * 0.65;
    }
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;

    const posArr = geometry.attributes.position.array;
    let uTime = 0;

    // ── 引力エフェクト用 velocity ──
    const attractVelX = new Float32Array(N);
    const attractVelY = new Float32Array(N);

    // ── 状態管理 ──
    let bigBangState = 'idle'; // 'idle' | 'absorb' | 'speaking' | 'chatting' | 'bb_collapse' | 'bb_explode' | 'done'
    let absorbOrigins = null;  // absorb開始時の全粒子元位置
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
    const BYTES_PER_BLOCK = 16;  // 同時表示バイト数（可読性優先で少し減らす）
    const BIT_INTERVAL = 0.018;  // 1ビット出現間隔（秒）
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
    var bbCooldownUntil = 0; // Big Bang後のクールダウン（スパム防止）
    if (bbLogoEl) {
        bbLogoEl.addEventListener('click', () => {
            if (bigBangState !== 'idle') return;
            if (Date.now() < bbCooldownUntil) return; // 5秒クールダウン
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
            absorbOrigins = null; // loop6内で初回フレームに保存される
            // BGMダッキング（Big Bang演出中は音量を下げる）
            duckBGM();
            // origSizeArr を吸収前に保存
            if (!origSizeArr) origSizeArr = geometry.attributes.aSize.array.slice();
            visibleCount = N;
            geometry.setDrawRange(0, N);
            console.log('[ABSORB] started, logoWX=' + logoWX6.toFixed(2) + ' logoWY=' + logoWY6.toFixed(2));
            for (let i = 0; i < N; i++) { attractVelX[i] = 0; attractVelY[i] = 0; }

            // ── 吸収サウンド: 降下するドローン + 収束パルス ──
            playAbsorbSound();

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

    // ── Logo Click Easter Egg: RGBCMY Explosion ──
    // 2026-04-19: 司さん要望により無効化（Big Bang本編で十分）
    if (false) (function() {
        var _eggColors = ['#FF0000', '#00FF00', '#0044FF', '#00FFFF', '#FF00FF', '#FFFF00'];
        var _eggCooldown = false;
        var _eggLogoEl = document.getElementById('bb-logo');
        if (!_eggLogoEl) return;

        // CSS class for brand flash
        var _eggStyle = document.createElement('style');
        _eggStyle.textContent = '.brand-flash { color: #fff !important; text-shadow: 0 0 20px #fff, 0 0 40px #fff, 0 0 60px #fff !important; transition: all 0.15s ease-out !important; }';
        document.head.appendChild(_eggStyle);

        _eggLogoEl.addEventListener('click', function(e) {
            if (_eggCooldown) return;
            _eggCooldown = true;
            setTimeout(function() { _eggCooldown = false; }, 2000);

            var rect = _eggLogoEl.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height * 0.33;

            // Spawn 30 explosion particles
            for (var i = 0; i < 30; i++) {
                var angle = (Math.random() * Math.PI * 2);
                var dist = 50 + Math.random() * 150;
                var dx = Math.cos(angle) * dist;
                var dy = Math.sin(angle) * dist;
                var color = _eggColors[Math.floor(Math.random() * _eggColors.length)];

                var p = document.createElement('div');
                p.style.cssText = 'position:fixed;pointer-events:none;z-index:999;' +
                    'width:4px;height:4px;border-radius:50%;' +
                    'background:' + color + ';' +
                    'box-shadow:0 0 8px ' + color + ';' +
                    'left:' + cx + 'px;top:' + cy + 'px;' +
                    'opacity:1;' +
                    'transition:transform 1s ease-out, opacity 1s ease-out;' +
                    'will-change:transform,opacity;';
                document.body.appendChild(p);

                // Closure to capture dx, dy, p
                (function(particle, tx, ty) {
                    requestAnimationFrame(function() {
                        particle.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(0.3)';
                        particle.style.opacity = '0';
                    });
                    setTimeout(function() {
                        if (particle.parentNode) particle.parentNode.removeChild(particle);
                    }, 1050);
                })(p, dx, dy);
            }

            // Flash brand name brighter
            var brandEl = document.querySelector('.brand-name');
            if (brandEl) {
                brandEl.classList.add('brand-flash');
                setTimeout(function() { brandEl.classList.remove('brand-flash'); }, 400);
            }

            // Play chord: A3, C4, E4, A4, C#5, E5
            if (!window._inryokuMuted) {
                try {
                    var ac = window.audioContext || new (window.AudioContext || window.webkitAudioContext)();
                    var chordFreqs = [220, 261.63, 329.63, 440, 554.37, 659.25];
                    var now = ac.currentTime;
                    for (var f = 0; f < chordFreqs.length; f++) {
                        var osc = ac.createOscillator();
                        var gain = ac.createGain();
                        osc.type = 'sine';
                        osc.frequency.value = chordFreqs[f];
                        osc.connect(gain);
                        gain.connect(ac.destination);
                        gain.gain.setValueAtTime(0.08, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
                        osc.start(now);
                        osc.stop(now + 1.0);
                    }
                } catch(e) {}
            }
        });
    })();

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
            // 2026-04-30: prefers-reduced-motion リスナーの closure leak 対策
            try {
                if (_mqlRef && _onMotionChange) {
                    if (typeof _mqlRef.removeEventListener === 'function') _mqlRef.removeEventListener('change', _onMotionChange);
                    else if (typeof _mqlRef.removeListener === 'function') _mqlRef.removeListener(_onMotionChange);
                }
            } catch(e){}
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
        const REVEAL_DUR = reduceMotion ? 1.5 : 14.0;
        material.uniforms.uReveal.value = Math.min(1.05, uTime / REVEAL_DUR);
        // 2026-05-06: ロゴ位置 NDC マスク（idle 時のみ。absorb/speaking では粒子が飛び込めるよう 0）
        const _logoEl = document.querySelector('.logo-holo-wrap');
        if (_logoEl) {
            const _r = _logoEl.getBoundingClientRect();
            const _w = window.innerWidth || 1, _h = window.innerHeight || 1;
            const _cx = (_r.left + _r.width  / 2) / _w * 2 - 1;
            const _cy = -((_r.top  + _r.height / 2) / _h * 2 - 1);
            material.uniforms.uLogoCenterNDC.value.set(_cx, _cy);
            // 半径: ロゴ枠ピッタリ (1.55 → 1.05)。absorb/speaking 中は 0 にして粒子が自由に通る
            const _absorbing = (typeof bigBangState !== 'undefined') &&
                (bigBangState === 'absorb' || bigBangState === 'speaking' || bigBangState === 'chatting');
            material.uniforms.uLogoRadiusNDC.value = _absorbing ? 0.0 : (_r.width / _w) * 1.05;
        }
        // 旧 星座 uniforms 同期 + 公転 + Discovery Hover - 2026-05-09 削除: 星座レイヤ全削除に伴い
        lineMat.uniforms.uTime.value = uTime;
        lineMat.uniforms.uAudioEnergy.value = material.uniforms.uAudioEnergy.value;
        cosmicFieldTick += dt;
        if (cosmicFieldTick >= 0.08) {
            updateCosmicFields();
            cosmicFieldTick = 0;
        }

        // ── 音響リアクティブ: AnalyserNodeからエネルギーを取得 ──
        updateAudioEnergy();
        // スムーズに追従（急変を防ぐ）
        const targetEnergy = p3AudioEnergy;
        const currentEnergy = material.uniforms.uAudioEnergy.value;
        material.uniforms.uAudioEnergy.value += (targetEnergy - currentEnergy) * 0.15;
        // 2026-04-30: 帯域別 uniform を全 ShaderMaterial に流す
        const _bands = window.p3AudioBands || { bass: 0, mid: 0, high: 0 };
        material.uniforms.uAudioBass.value = _bands.bass;
        material.uniforms.uAudioHigh.value = _bands.high;
        // 旧 csMat / csEdgeMat 帯域 uniform 同期 - 2026-05-09 削除

        // 2026-04-29: 司「完全に見えるようにして、ややこしすぎ」
        // idle から全粒子を見せる。遅いスポーン演出はやめる。
        if (visibleCount !== N) {
            visibleCount = N;
            geometry.setDrawRange(0, N);
        }

        // 微かなカメラ揺らぎ + スクロールパララックス
        camera6.position.x = Math.sin(uTime * 0.09) * 0.43;
        camera6.position.y = Math.cos(uTime * 0.07) * 0.26 + scrollY6 * 0.04;
        camera6.lookAt(0, 0, 0);

        // 2026-04-29: ロゴと商品まわりに見えない重力場をつくる
        // 毎フレーム取らず、数フレームごとにDOM位置を拾って負荷を抑える
        cosmicFieldTick = (cosmicFieldTick + 1) % 6;
        if (cosmicFieldTick === 0) {
            updateCosmicFields();
        }

        // ═══ 状態遷移: absorb → speaking → chatting → (close時) bb_collapse → bb_explode → idle ═══
        if (bigBangState !== 'idle' && bigBangState !== 'done' && bigBangState !== 'chatting') {
            bigBangTimer += dt;
            // perf: STATE log disabled (was firing every frame)
            // if (bigBangTimer < 0.05 || Math.floor(bigBangTimer) > Math.floor(bigBangTimer - dt)) {
            //     console.log('[STATE] ' + bigBangState + ' t=' + bigBangTimer.toFixed(3));
            // }

            // absorb完了 → 直接chatting（二進数は最初は見えない、チャット内で発動）
            if (bigBangState === 'absorb' && bigBangTimer >= 3.0) {
                // origSizeArr をまだ保存してなければ、0にする前に保存
                // （setupBlock が後から参照する元サイズ）
                if (!origSizeArr) origSizeArr = geometry.attributes.aSize.array.slice();
                // 全粒子をロゴ中心に強制スナップ（はみ出し完全防止）
                var snapColArr = geometry.attributes.color.array;
                for (let j = 0; j < N; j++) {
                    posArr[j*3]   = logoWX6;
                    posArr[j*3+1] = logoWY6;
                    posArr[j*3+2] = 0;
                    snapColArr[j*3] = 0; snapColArr[j*3+1] = 0; snapColArr[j*3+2] = 0;
                    geometry.attributes.aSize.array[j] = 0;
                }
                geometry.attributes.position.needsUpdate = true;
                geometry.attributes.color.needsUpdate = true;
                geometry.attributes.aSize.needsUpdate = true;
                absorbOrigins = null; // 元位置データ解放
                bigBangState = 'chatting';
                bigBangTimer = 0;
                // console.log('[STATE] absorb→chatting'); // perf: disabled
                showChatUI();
            }
            // bb_collapse完了 → bb_explode（ビッグバン爆発）
            else if (bigBangState === 'bb_collapse' && bigBangTimer >= 3.4) {
                bigBangState = 'bb_explode';
                bigBangTimer = 0;
                // console.log('[STATE] bb_collapse→bb_explode'); // perf: disabled
                const colArr = geometry.attributes.color.array;
                const sizeArr = geometry.attributes.aSize.array;
                // ビッグバン自体は元の強さを維持。戻りの荒さは done 側で補間する。
                const BB_COLS = [[1.45,0.10,0.20],[0.18,1.45,0.32],[0.22,0.40,1.50],[0.20,1.40,1.40],[1.45,0.18,1.20],[1.45,1.30,0.18]];
                for (let j = 0; j < N; j++) {
                    const c = BB_COLS[j % 6];
                    colArr[j*3] = c[0]; colArr[j*3+1] = c[1]; colArr[j*3+2] = c[2];
                    posArr[j*3]   = logoWX6;
                    posArr[j*3+1] = logoWY6;
                    posArr[j*3+2] = 0;
                    sizeArr[j] = (origSizeArr ? origSizeArr[j] : 2.0) * 1.30;
                    const ang = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const spd = 0.8 + Math.random() * 2.8;
                    bbVelX[j] = spd * Math.sin(phi) * Math.cos(ang);
                    bbVelY[j] = spd * Math.sin(phi) * Math.sin(ang);
                    bbVelZ[j] = spd * Math.cos(phi);
                }
                geometry.attributes.color.needsUpdate = true;
                geometry.attributes.aSize.needsUpdate = true;
            }
            // bb_explode完了 → done（idle復帰）
            else if (bigBangState === 'bb_explode' && bigBangTimer >= 4.0) {
                bigBangState = 'done';
                bigBangTimer = 0;
                // console.log('[STATE] bb_explode→done: idle復帰'); // perf: disabled
                // BGM音量を戻す
                unduckBGM();
                removeConstellationMessage(); // 念のため
                setTimeout(() => { bigBangState = 'idle'; bbCooldownUntil = Date.now() + 5000; }, 9000);
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
                    playParticleSpeakSound();
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
                // 粒子がロゴに吸い込まれる
                // 初回: 元の位置を保存（絶対位置補間のため）
                if (bigBangTimer < dt + 0.001 && !absorbOrigins) {
                    absorbOrigins = posArr.slice(); // 全粒子の元位置を保存
                }
                const prog = Math.min(bigBangTimer / 3.0, 1.0);
                // ease-in-out: ゆっくり→加速→最後にピタッと収束
                const ease = prog < 0.5
                    ? 4 * prog * prog * prog
                    : 1 - Math.pow(-2 * prog + 2, 3) / 2;
                // 元位置 → ロゴ中心を絶対補間（lerpではない → 確実に収束）
                if (absorbOrigins) {
                    posArr[i*3]   = absorbOrigins[i*3]   + (logoWX6 - absorbOrigins[i*3])   * ease;
                    posArr[i*3+1] = absorbOrigins[i*3+1] + (logoWY6 - absorbOrigins[i*3+1]) * ease;
                    posArr[i*3+2] = absorbOrigins[i*3+2] + (0       - absorbOrigins[i*3+2]) * ease;
                }
                // 吸い込まれるにつれ暗く
                const dimF = 1.0 - ease * 0.9;
                colArr[i*3]   = origColArr[i*3]   * dimF;
                colArr[i*3+1] = origColArr[i*3+1] * dimF;
                colArr[i*3+2] = origColArr[i*3+2] * dimF;
                // サイズも縮小
                geometry.attributes.aSize.array[i] = (origSizeArr ? origSizeArr[i] : 1.0) * (1.0 - ease);

            } else if (bigBangState === 'chatting') {
                const node = msgNodeMap.get(i);
                if (node) {
                    // ── ヘプタポッド・ロゴグラム: スイープ描画→保持→ドレイン ──
                    const rp = ringPhases[0]; // 1ブロック=1ロゴグラム
                    if (!rp) continue;
                    const age = uTime - rp.birthTime;
                    const totalTime = RING_APPEAR_TIME + RING_HOLD_TIME + RING_DRAIN_TIME;

                    // 曼荼羅: リングごとの出現遅延（内側→外側へ波紋）
                    var ringDelay = (node.ringIdx || 0) * MANDALA_STAGGER;
                    var expandDur = 1.2; // 各粒子の展開時間
                    var localAge = age - ringDelay;

                    if (localAge < 0) {
                        // まだ生まれていない — 球体コアの中に潜む
                        posArr[i*3] = ringLogoX;
                        posArr[i*3+1] = ringLogoY;
                        posArr[i*3+2] = RING_Z + (node.ringZOffset || 0) * 0.16;
                        colArr[i*3] = 0; colArr[i*3+1] = 0; colArr[i*3+2] = 0;
                        geometry.attributes.aSize.array[i] = 0;
                    } else if (age < RING_APPEAR_TIME) {
                        // ── 1-bit曼荼羅展開: +1と-1が対称的に広がる ──
                        var t2 = Math.min(localAge / expandDur, 1.0);
                        var ease2 = t2 * t2 * (3 - 2 * t2); // smoothstep

                        // コアから放射状に広がる — 各リングが水面の波紋のように
                        var curRadius = ease2 * (node.ringRadius || MANDALA_INNER_R);
                        // +1=時計回りに展開, -1=逆時計回りに展開（対称性）
                        var pol = node.polarity || (node.isOne ? 1 : -1);
                        var spinDir = pol; // +1 or -1
                        var curAngle = node.angle + (1 - ease2) * Math.PI * 0.5 * spinDir;
                        posArr[i*3]   = ringLogoX + Math.cos(curAngle) * curRadius;
                        posArr[i*3+1] = ringLogoY + Math.sin(curAngle) * curRadius * 0.62;
                        posArr[i*3+2] = RING_Z
                            + (node.ringZOffset || 0) * (0.32 + ease2 * 0.88)
                            + Math.sin(curAngle * 2.0 + (node.ringPhaseOffset || 0)) * 1.12;

                        // 1-bit: 両方同じサイズ・同じ輝度（方向が違うだけ）
                        var bc = node.byteColor || [0.9,0.92,1.0];
                        var gs = node.groupScale || 1.0;
                        var bright = (0.82 + 0.12 * Math.sin(node.col * 0.7 + uTime * 0.8)) * ease2 * gs;
                        colArr[i*3] = bc[0]*bright; colArr[i*3+1] = bc[1]*bright; colArr[i*3+2] = bc[2]*bright;
                        geometry.attributes.aSize.array[i] = 3.4 + 7.2 * ease2 * gs;

                        for (var e = 0; e < msgEdges.length; e++) {
                            if (msgEdges[e].from === node.idx || msgEdges[e].to === node.idx) {
                                msgEdges[e].progress = Math.max(msgEdges[e].progress, ease2 * 0.8);
                            }
                        }
                        if (!node.revealed) node.revealed = true;
                    } else if (age < RING_APPEAR_TIME + RING_HOLD_TIME) {
                        // ── 1-bit保持: +1と-1が対称回転、グループスケールで脈動 ──
                        var holdAge = age - RING_APPEAR_TIME;
                        var gs = node.groupScale || 1.0;
                        // グループスケール脈動: バイトの「重み」が呼吸する
                        var breath = 1.0 + 0.08 * gs * Math.sin(uTime * 2.0 + (node.ringIdx || 0) * 1.2);
                        // +1粒子と-1粒子が逆方向に回転（対称性の可視化）
                        var pol = node.polarity || (node.isOne ? 1 : -1);
                        var rotSpeed = 0.18 + (node.ringIdx || 0) * 0.04;
                        // 粒子の極性で回転方向が決まる（リング交互 × 極性）
                        var ringDir = (node.ringIdx || 0) % 2 === 0 ? 1 : -1;
                        var holdAngle = node.angle + holdAge * rotSpeed * ringDir * pol;
                        var r = (node.ringRadius || MANDALA_INNER_R) * breath;
                        posArr[i*3] = ringLogoX + Math.cos(holdAngle) * r;
                        posArr[i*3+1] = ringLogoY + Math.sin(holdAngle) * r * 0.62;
                        posArr[i*3+2] = RING_Z
                            + (node.ringZOffset || 0) * 1.22
                            + Math.sin(uTime * 1.6 + node.col * 0.7 + (node.ringPhaseOffset || 0)) * 1.7;
                        // 1-bit: +1も-1も同じサイズ・同じ輝度で脈動
                        var bc = node.byteColor || [0.9,0.92,1.0];
                        var glow = (0.84 + 0.16 * Math.sin(uTime * 3.0 + node.col * 0.8) + 0.08 * Math.sin(holdAngle * 3.0)) * gs;
                        colArr[i*3] = bc[0]*glow; colArr[i*3+1] = bc[1]*glow; colArr[i*3+2] = bc[2]*glow;
                        geometry.attributes.aSize.array[i] = 8.6 * gs;
                        for (var e = 0; e < msgEdges.length; e++) {
                            if (msgEdges[e].from === node.idx || msgEdges[e].to === node.idx) {
                                msgEdges[e].progress = Math.min(msgEdges[e].progress + dt * 2.0, 1.0);
                            }
                        }
                    } else if (age < totalTime) {
                        // ── 1-bitドレイン: +1/-1がグレーに収束→テキスト復号 ──
                        var dt3 = age - RING_APPEAR_TIME - RING_HOLD_TIME;
                        var t3 = dt3 / RING_DRAIN_TIME;
                        var ease3 = t3 * t3;
                        var fade3 = 1.0 - t3;
                        // 全粒子がチャット中心へ収束しつつ、小さく螺旋して翻訳される
                        var spiralDrift = 1.0 - ease3;
                        posArr[i*3]   = node.tx + (drainTX - node.tx) * ease3 + Math.cos(node.angle + t3 * 4.6 * (node.polarity || 1)) * 1.8 * spiralDrift;
                        posArr[i*3+1] = node.ty + (drainTY - node.ty) * ease3 + Math.sin(node.angle + t3 * 4.6 * (node.polarity || 1)) * 1.1 * spiralDrift;
                        posArr[i*3+2] = RING_Z
                            + (node.ringZOffset || 0) * fade3 * 1.15
                            + Math.sin((node.col + 1) * 0.9 + (node.ringPhaseOffset || 0) + t3 * Math.PI) * 1.08 * fade3;
                        // 1-bit収束: grey へは落とさず、極性の色を保ったまま減衰
                        var bc = node.byteColor || [0.9,0.92,1.0];
                        var sink = 0.50 + 0.22 * Math.sin(t3 * Math.PI * 2.0 + node.col * 0.7);
                        colArr[i*3] = bc[0] * sink * fade3;
                        colArr[i*3+1] = bc[1] * sink * fade3;
                        colArr[i*3+2] = bc[2] * sink * fade3;
                        geometry.attributes.aSize.array[i] = 6.8 * fade3;
                        for (var e = 0; e < msgEdges.length; e++) {
                            if (msgEdges[e].from === node.idx || msgEdges[e].to === node.idx) {
                                msgEdges[e].progress *= 0.93;
                            }
                        }
                    } else {
                        colArr[i*3] = 0; colArr[i*3+1] = 0; colArr[i*3+2] = 0;
                        geometry.attributes.aSize.array[i] = 0;
                    }
                } else {
                    // 非ノード粒子: ロゴ中心に留めて暗くする（はみ出し防止）
                    posArr[i*3]   += (logoWX6 - posArr[i*3])   * 0.15;
                    posArr[i*3+1] += (logoWY6 - posArr[i*3+1]) * 0.15;
                    posArr[i*3+2] += (0       - posArr[i*3+2]) * 0.15;
                    colArr[i*3] *= 0.92; colArr[i*3+1] *= 0.92; colArr[i*3+2] *= 0.92;
                    geometry.attributes.aSize.array[i] *= 0.95;
                }

            } else if (bigBangState === 'bb_collapse') {
                // チャット終了後: 小さい吸収コアへ集める。ただし吸引加速度は抑えて暴れを防ぐ。
                const prog = Math.min(bigBangTimer / 3.4, 1.0);
                const ease = prog * prog * (3.0 - 2.0 * prog);
                const orbit = uTime * (0.20 + (i % 11) * 0.003) + aPhases[i];
                const orbitR = (5.0 + (i % 13) * 0.55) * (1.0 - ease * 0.90);
                const targetX = logoWX6 + Math.cos(orbit) * orbitR;
                const targetY = logoWY6 + Math.sin(orbit * 0.83) * orbitR * 0.55;
                const targetZ = Math.sin(orbit * 0.71) * 6.0 * (1.0 - ease);
                const lerpF = 0.010 + ease * 0.048;
                posArr[i*3]   += (targetX - posArr[i*3]) * lerpF;
                posArr[i*3+1] += (targetY - posArr[i*3+1]) * lerpF;
                posArr[i*3+2] += (targetZ - posArr[i*3+2]) * lerpF;
                // 色は少しだけ落ち着かせる。完全な灰色化は硬く見えるので避ける。
                const dimF = 1.0 - ease * 0.24;
                colArr[i*3]   = origColArr[i*3]   * dimF;
                colArr[i*3+1] = origColArr[i*3+1] * dimF;
                colArr[i*3+2] = origColArr[i*3+2] * dimF;

            } else if (bigBangState === 'bb_explode') {
                // ビッグバン: RGBCMY爆発
                posArr[i*3]   += bbVelX[i];
                posArr[i*3+1] += bbVelY[i];
                posArr[i*3+2] += bbVelZ[i];
                bbVelX[i] *= 0.978;
                bbVelY[i] *= 0.978;
                bbVelZ[i] *= 0.978;

            } else {
                // 通常ドリフト (idle / done)
                // 音響リアクティブ: 音が大きい → 粒子が速く動く + 揺れが大きくなる
                const spdMod = window._universeParams ? window._universeParams.speed : 1.0;
                const audioMod = (1.0 + material.uniforms.uAudioEnergy.value * 0.8) * spdMod;
                if (SIMPLE_IDLE_UNIVERSE && bigBangState !== 'chatting') {
                    const bx = idleBasePositions[i*3];
                    const by = idleBasePositions[i*3+1];
                    const bz = idleBasePositions[i*3+2];
                    const ph = aPhases[i];
                    const tempo = driftTempo[i];
                    const kind = motionKind[i];
                    let xNext = bx, yNext = by, zNext = bz;

                    // reduce-motion: drift 計算を完全に bypass（idleBase に固定）
                    if (reduceMotion) {
                        posArr[i*3]   = bx;
                        posArr[i*3+1] = by;
                        posArr[i*3+2] = bz;
                        colArr[i*3]   += (origColArr[i*3]   - colArr[i*3])   * 0.06;
                        colArr[i*3+1] += (origColArr[i*3+1] - colArr[i*3+1]) * 0.06;
                        colArr[i*3+2] += (origColArr[i*3+2] - colArr[i*3+2]) * 0.06;
                        geometry.attributes.aSize.array[i] = origSizeArr ? origSizeArr[i] : aSizes[i];
                        continue;
                    }

                    // 2026-04-30: 役割別 idle motion で「無重力の層」を作る
                    if (kind === 0) {
                        // breath: ほぼ静止＋微呼吸（60%）。光が漂って点いている層
                        const slow = uTime * (0.04 + driftFreqX[i] * 0.03) * tempo;
                        const dx = Math.sin(slow + driftPhaseX[i]) * (1.5 + driftAmpX[i] * 2.5);
                        const dy = Math.cos(slow * 0.83 + driftPhaseY[i]) * (1.2 + driftAmpY[i] * 2.2);
                        const dz = Math.sin(slow * 0.6 + ph) * 1.8;
                        xNext = bx + dx;
                        yNext = by + dy;
                        zNext = bz + dz;
                    } else if (kind === 1) {
                        // 2026-05-06: 真の Curl noise advection — 現在位置をフィールドで流す
                        // 毎フレーム posArr の現在位置に curl ベクトルを加算 → 流れる
                        // ベースポジションへの極弱い restoring force で領域内に保つ
                        const t = uTime * 0.05 * tempo;
                        const px = posArr[i*3], py = posArr[i*3+1], pz = posArr[i*3+2];
                        const _n = (x, y) => (
                            Math.sin(x * 0.0085 + t * 1.0  + driftPhaseX[i]) +
                            Math.sin(y * 0.0070 + t * 0.83 + driftPhaseY[i] * 0.5) +
                            Math.sin((x + y) * 0.0050 - t * 0.62 + ph)
                        );
                        const e = 8.0;
                        const dnx = _n(px + e, py) - _n(px - e, py);
                        const dny = _n(px, py + e) - _n(px, py - e);
                        // curl velocity (流速)
                        const vx =  dny * 1.2;
                        const vy = -dnx * 1.2;
                        const vz = Math.sin(t * 1.3 + ph) * 0.45
                                 + Math.cos(t * 0.7 + driftPhaseX[i]) * 0.30;
                        // restoring: ベース位置にゆっくり戻す（領域外に飛ばないため）
                        const k = 0.0035;
                        xNext = px + vx + (bx - px) * k;
                        yNext = py + vy + (by - py) * k;
                        zNext = pz + vz + (bz - pz) * k;
                    } else if (kind === 2) {
                        // approach: 奥→手前（12%）— 速度ゆっくり戻す
                        const cycle = (uTime * travelSpeed[i] * 0.55 + travelOffset[i]) % 1;
                        const p = cycle < 0.94 ? cycle / 0.94 : 1.0;
                        const ease = p * p * (3.0 - 2.0 * p);
                        const ax = Math.cos(travelAngle[i]);
                        const ay = Math.sin(travelAngle[i]);
                        const startX = ax * (420.0 + (i % 7) * 22.0);
                        const startY = ay * (300.0 + (i % 5) * 26.0);
                        const startZ = -420.0 + Math.sin(ph) * 60.0;
                        const wob = Math.sin(uTime * 0.25 + ph) * 8.0;
                        xNext = startX + (bx - startX) * ease + wob;
                        yNext = startY + (by - startY) * ease + wob * 0.7;
                        zNext = startZ + (bz - startZ) * ease;
                    } else {
                        // passthrough: 奥を横切る（18%）— ゆっくり sweep
                        const run = (uTime * travelSpeed[i] * 0.55 + travelOffset[i]) % 1;
                        const sweep = (run - 0.5) * 720.0;
                        const ax = Math.cos(travelAngle[i]);
                        const ay = Math.sin(travelAngle[i]);
                        const sideX = -ay;
                        const sideY = ax;
                        const wave = Math.sin(run * Math.PI * 2.0 + ph) * 36.0;
                        xNext = bx * 0.45 + sideX * sweep + ax * wave;
                        yNext = by * 0.45 + sideY * sweep + ay * wave;
                        zNext = bz + Math.sin(run * Math.PI * 2.0 + ph) * 44.0;
                    }

                    if (bigBangState === 'done') {
                        // ビッグバン後の通常宇宙への復帰だけを緩くする。一発で戻すと暴れて見える。
                        const returnF = 0.012;
                        posArr[i*3]   += (xNext - posArr[i*3]) * returnF;
                        posArr[i*3+1] += (yNext - posArr[i*3+1]) * returnF;
                        posArr[i*3+2] += (zNext - posArr[i*3+2]) * returnF;
                    } else {
                        posArr[i*3] = xNext;
                        posArr[i*3+1] = yNext;
                        posArr[i*3+2] = zNext;
                    }
                    colArr[i*3]   += (origColArr[i*3]   - colArr[i*3])   * 0.06;
                    colArr[i*3+1] += (origColArr[i*3+1] - colArr[i*3+1]) * 0.06;
                    colArr[i*3+2] += (origColArr[i*3+2] - colArr[i*3+2]) * 0.06;
                    geometry.attributes.aSize.array[i] = origSizeArr ? origSizeArr[i] : aSizes[i];
                } else {
                    posArr[i*3+2] += driftSpeedZ[i] * audioMod;
                    if (isShootingStar[i]) {
                        // 流れ星: 直線的に高速移動
                        posArr[i*3]   += shootingDirX[i] * audioMod;
                        posArr[i*3+1] += shootingDirY[i] * audioMod;
                    } else {
                        const baseDriftX = Math.sin(uTime * driftFreqX[i] + driftPhaseX[i]) * driftAmpX[i] * audioMod;
                        const baseDriftY = Math.cos(uTime * driftFreqY[i] + driftPhaseY[i]) * driftAmpY[i] * audioMod;

                        if (ENABLE_COMPLEX_CHAT_FIELDS && bigBangState === 'chatting') {
                        let swirlX = 0;
                        let swirlY = 0;
                        let fieldPullX = 0;
                        let fieldPullY = 0;
                        const px = posArr[i*3];
                        const py = posArr[i*3+1];
                        const pz = posArr[i*3+2];

                        const shearX = (
                            Math.sin(pz * 0.014 + uTime * 0.10 + flowLayer[i]) * 0.010 +
                            Math.cos(py * 0.010 - uTime * 0.06 + flowLayer[i] * 0.7) * 0.006
                        ) * flowBias[i];
                        const shearY = (
                            Math.cos(pz * 0.012 - uTime * 0.08 + flowLayer[i]) * 0.009 +
                            Math.sin(px * 0.011 + uTime * 0.05 + flowLayer[i] * 0.6) * 0.005
                        ) * flowBias[i];

                        const globalR = Math.sqrt(px * px + py * py) + 0.001;
                        const globalNorm = Math.max(0.0, 1.0 - globalR / 320.0);
                        const globalSwirl = (0.0020 + globalNorm * 0.0028) * audioMod;
                        swirlX += (-py / globalR) * globalSwirl;
                        swirlY += (px / globalR) * globalSwirl;

                        const fieldKeys = Object.keys(cosmicFields);
                        for (let fi = 0; fi < fieldKeys.length; fi++) {
                            const field = cosmicFields[fieldKeys[fi]];
                            if (!field || !field.active) continue;
                            const dx = field.x - px;
                            const dy = field.y - py;
                            const dist2 = dx * dx + dy * dy;
                            const dist = Math.sqrt(dist2) + 0.001;
                            if (dist >= field.radius) continue;

                            const influence = Math.max(0, 1.0 - dist / field.radius);
                            const tangentX = -dy / dist;
                            const tangentY = dx / dist;
                            const orbitStrength = (0.0024 + field.radius * 0.00002) * influence;
                            const pullStrength = 0.0018 * influence * influence;

                            swirlX += tangentX * orbitStrength;
                            swirlY += tangentY * orbitStrength;
                            fieldPullX += dx * pullStrength;
                            fieldPullY += dy * pullStrength;
                        }

                            posArr[i*3]   += baseDriftX + shearX + swirlX + fieldPullX;
                            posArr[i*3+1] += baseDriftY + shearY + swirlY + fieldPullY;
                        } else {
                            posArr[i*3]   += baseDriftX;
                            posArr[i*3+1] += baseDriftY;
                        }
                    }
                    if (ENABLE_COMPLEX_CHAT_FIELDS && bigBangState === 'chatting') {
                        applyCosmicFieldMotion(i, dt, audioMod);
                    }

                    const z = posArr[i*3+2];
                    // 流れ星はXY方向にも画面外に出る可能性
                    const x = posArr[i*3], y = posArr[i*3+1];
                    if (z > 250 || z < -500 || (isShootingStar[i] && (Math.abs(x) > 400 || Math.abs(y) > 400))) {
                        if (driftSpeedZ[i] >= 0) {
                            posArr[i*3+2] = -300 - Math.random() * 200;
                        } else {
                            posArr[i*3+2] = 200 + Math.random() * 50;
                        }
                        const r = 20 + Math.random() * 180;
                        const angle = Math.random() * Math.PI * 2;
                        posArr[i*3]   = Math.cos(angle) * r;
                        posArr[i*3+1] = Math.sin(angle) * r;
                        if (isShootingStar[i]) {
                            const a2 = Math.random() * Math.PI * 2;
                            const sp = 0.3 + Math.random() * 0.8;
                            driftSpeedZ[i] = sp;
                            shootingDirX[i] = Math.cos(a2) * 0.15 * sp;
                            shootingDirY[i] = Math.sin(a2) * 0.15 * sp;
                        }
                    }
                }
                // done→idleへの復帰中: 色を徐々に戻す
                if (bigBangState === 'done') {
                    colArr[i*3]   += (origColArr[i*3]   - colArr[i*3])   * 0.02;
                    colArr[i*3+1] += (origColArr[i*3+1] - colArr[i*3+1]) * 0.02;
                    colArr[i*3+2] += (origColArr[i*3+2] - colArr[i*3+2]) * 0.02;
                    if (origSizeArr) {
                        geometry.attributes.aSize.array[i] += (origSizeArr[i] - geometry.attributes.aSize.array[i]) * 0.025;
                    }
                }
            }
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        if ((bigBangState === 'chatting' && chatSpeaking) || bigBangState === 'bb_explode' || bigBangState === 'done') {
            geometry.attributes.aSize.needsUpdate = true;
        }

        // 待機宇宙は粒子を主役にする。線は chatting 中だけ。
        if (bigBangState === 'chatting') {
            updateConstellations();
        } else {
            lineGeo.setDrawRange(0, 0);
        }
        // 二進数メッセージの線更新（chatting中のみ）
        if (bigBangState === 'chatting') {
            updateConstellationLines();
        }

        const audioLevelForBloom = material.uniforms.uAudioEnergy.value || 0.0;
        material.uniforms.uObserverFocus.value = 0.0;
        if (bloomPass) {
            const baseStrength = bigBangState === 'chatting' ? 0.10 : 0.0;
            const baseRadius = bigBangState === 'chatting' ? 0.12 : 0.0;
            const baseThreshold = bigBangState === 'chatting' ? 0.78 : 0.96;
            bloomPass.strength += ((baseStrength + audioLevelForBloom * 0.01) - bloomPass.strength) * 0.08;
            bloomPass.radius += (baseRadius - bloomPass.radius) * 0.08;
            bloomPass.threshold += (baseThreshold - bloomPass.threshold) * 0.08;
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
    let chatSessionId = 0;
    let chatTimerIds = new Set();
    let chatFetchController = null;
    let tpCharEls = [];     // { span, pIdx, tx, ty, sx, sy }
    let sculptActive = false;
    let famicomACtx = null;
    // AI会話履歴（localStorageで永続化）
    let chatHistory = JSON.parse(localStorage.getItem('inryoku_chat_history') || '[]');
    function saveChatHistory() { try { localStorage.setItem('inryoku_chat_history', JSON.stringify(chatHistory.slice(-20))); } catch(e) {} }
    function isChatSessionActive(sessionId) {
        return sessionId === chatSessionId && (!!document.getElementById('inryoku-chat') || !!document.getElementById('chat-tp-overlay'));
    }
    function clearChatTimers() {
        chatTimerIds.forEach(function(id) { clearTimeout(id); });
        chatTimerIds.clear();
    }
    function scheduleChatTimeout(fn, delay, sessionId) {
        var timerId = setTimeout(function() {
            chatTimerIds.delete(timerId);
            if (!isChatSessionActive(sessionId)) return;
            fn();
        }, delay);
        chatTimerIds.add(timerId);
        return timerId;
    }
    function abortChatFetch() {
        if (!chatFetchController) return;
        try { chatFetchController.abort(); } catch (e) {}
        chatFetchController = null;
    }
    function beginChatSession() {
        chatSessionId += 1;
        clearChatTimers();
        abortChatFetch();
        return chatSessionId;
    }
    function endChatSession() {
        chatSessionId += 1;
        clearChatTimers();
        abortChatFetch();
        removeConstellationMessage();
    }

    // ── 吸収サウンド: 粒子がロゴに吸い込まれる時の引力音 ──
    // 降下するドローン（高→低）+ パルス + ハーモニクス
    function playAbsorbSound() {
        try {
            if (!famicomACtx) famicomACtx = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = famicomACtx;
            const now = ctx.currentTime;
            const dur = 3.0; // absorb duration と同じ

            // ── レイヤー1: 降下するドローン（引力感） ──
            const drone = ctx.createOscillator();
            const droneGain = ctx.createGain();
            drone.connect(droneGain); droneGain.connect(ctx.destination);
            drone.type = 'sine';
            drone.frequency.setValueAtTime(220, now);
            drone.frequency.exponentialRampToValueAtTime(55, now + dur);
            droneGain.gain.setValueAtTime(0, now);
            droneGain.gain.linearRampToValueAtTime(0.08, now + 0.3);
            droneGain.gain.linearRampToValueAtTime(0.12, now + dur * 0.7);
            droneGain.gain.linearRampToValueAtTime(0, now + dur);
            drone.start(now); drone.stop(now + dur);

            // ── レイヤー2: オクターブ上の倍音（煌めき） ──
            const harm = ctx.createOscillator();
            const harmGain = ctx.createGain();
            harm.connect(harmGain); harmGain.connect(ctx.destination);
            harm.type = 'triangle';
            harm.frequency.setValueAtTime(440, now);
            harm.frequency.exponentialRampToValueAtTime(110, now + dur);
            harmGain.gain.setValueAtTime(0, now);
            harmGain.gain.linearRampToValueAtTime(0.04, now + 0.5);
            harmGain.gain.linearRampToValueAtTime(0.06, now + dur * 0.6);
            harmGain.gain.linearRampToValueAtTime(0, now + dur);
            harm.start(now); harm.stop(now + dur);

            // ── レイヤー3: パルス音（粒子が一つずつ吸い込まれる） ──
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            const pulseGain = ctx.createGain();
            lfo.connect(lfoGain);
            lfoGain.connect(pulseGain.gain);
            const pulse = ctx.createOscillator();
            pulse.connect(pulseGain); pulseGain.connect(ctx.destination);
            pulse.type = 'sine';
            pulse.frequency.setValueAtTime(165, now);
            pulse.frequency.exponentialRampToValueAtTime(82.5, now + dur);
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(2, now);
            lfo.frequency.linearRampToValueAtTime(12, now + dur); // 加速するパルス
            lfoGain.gain.setValueAtTime(0.03, now);
            pulseGain.gain.setValueAtTime(0.03, now);
            pulseGain.gain.linearRampToValueAtTime(0, now + dur);
            lfo.start(now); lfo.stop(now + dur);
            pulse.start(now); pulse.stop(now + dur);

            // ── レイヤー4: 最後の収束音（シュッ） ──
            const woosh = ctx.createOscillator();
            const wooshGain = ctx.createGain();
            const wooshFilter = ctx.createBiquadFilter();
            woosh.connect(wooshFilter); wooshFilter.connect(wooshGain); wooshGain.connect(ctx.destination);
            woosh.type = 'sawtooth';
            woosh.frequency.setValueAtTime(880, now + dur * 0.8);
            woosh.frequency.exponentialRampToValueAtTime(55, now + dur);
            wooshFilter.type = 'lowpass';
            wooshFilter.frequency.setValueAtTime(2000, now + dur * 0.8);
            wooshFilter.frequency.exponentialRampToValueAtTime(200, now + dur);
            wooshGain.gain.setValueAtTime(0, now);
            wooshGain.gain.setValueAtTime(0, now + dur * 0.75);
            wooshGain.gain.linearRampToValueAtTime(0.07, now + dur * 0.85);
            wooshGain.gain.linearRampToValueAtTime(0, now + dur);
            woosh.start(now + dur * 0.75); woosh.stop(now + dur + 0.1);

        } catch(e) { console.warn('absorb sound error:', e); }
    }

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
    //  1-bit テレパシー: テキスト→バイナリ→ +1/-1 極性粒子
    //  +1 = 光の方向（RGB — 精神）  -1 = 影の方向（CMY — 物質・補色）
    //  両方が同じサイズ・同じ重要度。方向が違うだけ。
    //  「0は無じゃない。逆の方向。」— 1-bit LLM の哲学
    //  グループスケール: 各リング（バイト）が独自振幅で脈動 = 重みの文脈
    //  収束: +1と-1がペアで重なる → グレー → テキスト復号
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

    // 複数バイト（ブロック）を同時配置 — 曼荼羅方式
    // ── 同心円: バイトごとに1リング、中心から外へ波紋のように広がる ──
    // 各バイト = 1つの同心円リング（8粒子が円周上に配置）
    // 内側リングから順に出現 → 保持 → ドレイン
    const RING_Z = 130;
    const MANDALA_INNER_R = 16;      // 最内リング半径
    const MANDALA_RING_GAP = 10;     // リング間隔
    const RING_APPEAR_TIME = 4.0;    // 全リング出現時間(秒)
    const RING_HOLD_TIME = 2.5;      // 表示保持(秒)
    const RING_DRAIN_TIME = 1.2;     // 下方ドレイン(秒)
    const MANDALA_STAGGER = 0.34;    // リング間の出現遅延(秒)
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
        // console.log('[setupBlock] ringLogo=(' + ringLogoX.toFixed(2) + ',' + ringLogoY.toFixed(2) + ')'); // perf: disabled

        // ── 1-bit曼荼羅: 同心円リング、バイトごとに1リング ──
        // +1/-1 の補色ペア: 対極でありながら同等の重み
        var byteCount = bytesArr.length;
        // +1 方向（光・RGB）
        var PLUS_COLORS = [
            [1.0, 0.15, 0.1],  // R (赤)
            [0.1, 1.0, 0.2],   // G (緑)
            [0.15, 0.3, 1.0]   // B (青)
        ];
        // -1 方向（影・CMY）— 補色ペア
        var MINUS_COLORS = [
            [0.0, 0.95, 0.95], // C (シアン) ← Rの補色
            [0.95, 0.0, 0.85], // M (マゼンタ) ← Gの補色
            [0.95, 0.95, 0.0]  // Y (イエロー) ← Bの補色
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

        for (var byteIdx = 0; byteIdx < byteCount && pCursor < dists.length; byteIdx++) {
            var bits8 = bytesArr[byteIdx];
            var byteVal = parseInt(bits8, 2);

            // グループスケール: バイト内の+1の密度で振幅が変わる
            // 1が多い=強い重み、0が多い=静かな重み（でも同じ情報量）
            var onesCount = 0;
            for (var ci = 0; ci < 8; ci++) { if (bits8[ci] === '1') onesCount++; }
            var groupScale = 0.6 + (onesCount / 8) * 0.6; // 0.6〜1.2

            // カラーペアのインデックス（R↔C, G↔M, B↔Y を循環）
            var colorPairIdx = byteIdx % 3;

            // このバイトのリング半径（内側から外側へ）
            var ringRadius = MANDALA_INNER_R + byteIdx * MANDALA_RING_GAP;
            // リング出現遅延（内側が先、外側が後 — 波紋）
            var ringDelay = byteIdx * MANDALA_STAGGER;
            // リングごとの回転オフセット（曼荼羅的な回転ずれ）
            var ringRotOffset = byteIdx * Math.PI / byteCount * 1.05;
            // 平面記号感は保ったまま、リングごとにごく薄い奥行きを持たせる
            var ringZOffset = (byteIdx - (byteCount - 1) * 0.5) * 0.72;

            for (var bitIdx = 0; bitIdx < 8 && pCursor < dists.length; bitIdx++) {
                // 1-bit: +1(光の方向) か -1(影の方向) — 0は存在しない
                var polarity = bits8[bitIdx] === '1' ? 1 : -1;
                // +1 → RGB色, -1 → CMY補色（対極ペア）
                var byteColor = polarity === 1
                    ? PLUS_COLORS[colorPairIdx]
                    : MINUS_COLORS[colorPairIdx];

                // 8ビットを円周上に均等配置
                var angle = (bitIdx / 8) * Math.PI * 2 + ringRotOffset;
                // Y圧縮で立体的な楕円に
                var tx = ringLogoX + Math.cos(angle) * ringRadius;
                var ty = ringLogoY + Math.sin(angle) * ringRadius * 0.58;

                var pIdx = dists[pCursor++].idx;
                // 初期位置: 球体コア中心
                posArr[pIdx*3] = ringLogoX;
                posArr[pIdx*3+1] = ringLogoY;
                posArr[pIdx*3+2] = RING_Z;

                msgNodeIndices.push(pIdx);
                var entry = {
                    idx: pIdx,
                    tx: tx, ty: ty, tz: RING_Z,
                    bitIdx: byteIdx * 8 + bitIdx,
                    row: byteIdx, col: bitIdx,
                    angle: angle, polarity: polarity,
                    // 互換性のため isOne も残す
                    isOne: polarity === 1,
                    sweepOffset: ringDelay / (RING_APPEAR_TIME * 0.7),
                    ringIdx: byteIdx,
                    ringRadius: ringRadius,
                    ringZOffset: ringZOffset,
                    ringPhaseOffset: ringRotOffset + bitIdx * 0.22,
                    isThickness: false,
                    byteColor: byteColor,
                    groupScale: groupScale,
                    revealed: false
                };
                msgNodeTargets.push(entry);
                msgNodeMap.set(pIdx, entry);
                sizeArr[pIdx] = 0;
                allParticles.push(entry);
            }
        }

        // 同心リングの円周骨格 + リング間スポーク
        for (var ri = 0; ri < byteCount; ri++) {
            var ringStart = ri * 8;
            for (var bi = 0; bi < 8; bi++) {
                var current = allParticles[ringStart + bi];
                var next = allParticles[ringStart + ((bi + 1) % 8)];
                if (current && next) {
                    msgEdges.push({
                        from: current.idx,
                        to: next.idx,
                        progress: 0,
                        kind: 'ring',
                        strength: 0.75
                    });
                }
            }
        }

        // 同心リング間を結ぶエッジ（曼荼羅の骨格線）
        for (var pi = 0; pi < allParticles.length; pi++) {
            var p = allParticles[pi];
            // 同じビット位置の次リングと接続
            if (p.ringIdx < byteCount - 1) {
                var nextBitIdx = (p.ringIdx + 1) * 8 + p.col;
                if (nextBitIdx < allParticles.length) {
                    var np = allParticles[nextBitIdx];
                    msgEdges.push({
                        from: p.idx,
                        to: np.idx,
                        progress: 0,
                        kind: 'spoke',
                        strength: 1.0
                    });
                }
            }
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
        msgLineMesh = new THREE.LineSegments(lg, new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uSignal: { value: 0.0 }
            },
            vertexShader: `
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
                uniform float uSignal;
                void main() {
                    float depthFade = clamp(1.0 - vDepth / 230.0, 0.0, 1.0);
                    depthFade = pow(depthFade, 1.6);
                    float energy = clamp((vColor.r + vColor.g + vColor.b) / 2.2, 0.0, 1.0);
                    float lane = 0.84 + 0.16 * sin(uTime * 1.35 + vDepth * 0.08 + energy * 2.0);
                    float shimmer = 0.92 + 0.08 * sin(uTime * (2.1 + energy * 0.9) - vDepth * 0.11);
                    vec3 lineColor = mix(vColor, vec3(0.86, 0.94, 1.0), 0.12 + uSignal * 0.10 + energy * 0.08);
                    float alpha = depthFade * (0.24 + uSignal * 0.18 + energy * 0.30) * lane;
                    gl_FragColor = vec4(lineColor * shimmer, alpha);
                }
            `,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
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
        // 冷たい軌道線と、強い放射線を分ける
        const BB_COLS = [[0.98,0.46,0.52],[0.46,0.95,0.62],[0.55,0.66,1.0],[0.38,0.94,0.98],[0.98,0.38,0.88],[1.0,0.92,0.42]];
        const ORBIT_TINT = [0.52, 0.76, 1.0];
        const SPOKE_TINT = [1.0, 0.96, 0.84];
        var signalLevel = 0.0;

        for (let e = 0; e < msgEdges.length; e++) {
            const edge = msgEdges[e];
            const ax = posArr[edge.from*3];
            const ay = posArr[edge.from*3+1];
            const az = posArr[edge.from*3+2];
            const bx = posArr[edge.to*3];
            const by = posArr[edge.to*3+1];
            const bz = posArr[edge.to*3+2];
            const reveal = Math.max(0.0, Math.min(edge.progress, 1.0));
            const tipEase = reveal * reveal * (3 - 2 * reveal);
            const tx = ax + (bx - ax) * tipEase;
            const ty = ay + (by - ay) * tipEase;
            const tz = az + (bz - az) * tipEase;
            const fromNode = msgNodeMap.get(edge.from);
            const toNode = msgNodeMap.get(edge.to);
            lPos[e*6]   = ax;
            lPos[e*6+1] = ay;
            lPos[e*6+2] = az;
            lPos[e*6+3] = tx;
            lPos[e*6+4] = ty;
            lPos[e*6+5] = tz;

            if (edge.progress > 0) {
                signalLevel = Math.max(signalLevel, edge.progress);
                const isRing = edge.kind === 'ring';
                const strength = edge.strength || (isRing ? 0.78 : 1.0);
                const pulse = isRing
                    ? 0.72 + 0.16 * Math.sin(uTime * 1.3 + e * 0.33)
                    : 0.84 + 0.26 * Math.sin(uTime * 2.2 + e * 0.45);
                const head = isRing
                    ? 0.80 + 0.10 * Math.sin(uTime * 2.1 + e * 0.22)
                    : 0.96 + 0.18 * Math.sin(uTime * 3.0 + e * 0.28);
                const brightA = Math.pow(edge.progress, 1.15) * pulse * strength * (isRing ? 0.88 : 1.04);
                const brightB = Math.pow(edge.progress, 1.15) * head * strength * (isRing ? 0.96 : 1.18);
                const ca = fromNode && fromNode.byteColor ? fromNode.byteColor : BB_COLS[e % 6];
                const cb = toNode && toNode.byteColor ? toNode.byteColor : ca;
                const tint = isRing ? ORBIT_TINT : SPOKE_TINT;
                const mixA = isRing ? 0.38 : 0.12;
                const mixB = isRing ? 0.26 : 0.08;
                lCol[e*6]   = (ca[0] * (1.0 - mixA) + tint[0] * mixA) * brightA;
                lCol[e*6+1] = (ca[1] * (1.0 - mixA) + tint[1] * mixA) * brightA;
                lCol[e*6+2] = (ca[2] * (1.0 - mixA) + tint[2] * mixA) * brightA;
                lCol[e*6+3] = (cb[0] * (1.0 - mixB) + tint[0] * mixB) * brightB;
                lCol[e*6+4] = (cb[1] * (1.0 - mixB) + tint[1] * mixB) * brightB;
                lCol[e*6+5] = (cb[2] * (1.0 - mixB) + tint[2] * mixB) * brightB;
            } else {
                lCol[e*6]=0;lCol[e*6+1]=0;lCol[e*6+2]=0;
                lCol[e*6+3]=0;lCol[e*6+4]=0;lCol[e*6+5]=0;
            }
        }
        if (msgLineMesh.material && msgLineMesh.material.uniforms) {
            msgLineMesh.material.uniforms.uTime.value = uTime;
            msgLineMesh.material.uniforms.uSignal.value = signalLevel;
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
        chatSpeakCallback = null;
    }

    // ── 二進数粒子演出でテキストを「話す」 ──
    // 1バイトずつ: infoから粒子が飛び出し→8ビット並ぶ→文字デコード→次のバイト
    function speakBinary(text, callback, sessionId) {
        if (typeof sessionId === 'number' && !isChatSessionActive(sessionId)) return;
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
        chatSpeakCallback = function() {
            if (typeof sessionId === 'number' && !isChatSessionActive(sessionId)) return;
            if (callback) callback();
        };

        // 最初のブロックをセットアップ
        var firstBlock = byteQueue.slice(0, BYTES_PER_BLOCK);
        if (firstBlock.length > 0) {
            setupBlock(firstBlock);
            playParticleSpeakSound();
        }
        // console.log('[SPEAK] block mode for: "' + text.substring(0,20) + '..."'); // perf: disabled
    }

    // ── タイプライター（showChatUI/sendChatMsgの外に配置してスコープ共有） ──
    function typeMsg(text, onDone, sessionId) {
        if (typeof sessionId === 'number' && !isChatSessionActive(sessionId)) return;
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
                scheduleChatTimeout(() => oldest.remove(), 320, sessionId || chatSessionId);
            }
        }
        const div = document.createElement('div');
        div.className = 'chat-msg ai-msg';
        div.textContent = aiPrefix;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;

        // ── 「間（ま）」のあるタイピング ──
        // 句読点でタメ、通常文字にランダム揺らぎ、思考中の「…」で長い間
        let idx = 0;
        const BASE_SPEED = isFamicom ? 52 : 50;

        function getDelay(ch) {
            // 句読点・読点 → 長めのタメ（思考してる感）
            if (ch === '。' || ch === '.' || ch === '？' || ch === '?') return BASE_SPEED + 280 + Math.random() * 150;
            if (ch === '、' || ch === ',' || ch === '…') return BASE_SPEED + 160 + Math.random() * 100;
            if (ch === '―' || ch === '—' || ch === '─') return BASE_SPEED + 120 + Math.random() * 80;
            // 改行 → 少し間
            if (ch === '\n') return BASE_SPEED + 200;
            // 通常文字 → ランダム揺らぎ（±20ms）
            return BASE_SPEED + (Math.random() * 40 - 20);
        }

        function typeNext() {
            if (typeof sessionId === 'number' && !isChatSessionActive(sessionId)) return;
            if (idx < text.length) {
                var ch = text[idx];
                div.textContent += ch;
                if (isFamicom) famicomBeep();
                msgs.scrollTop = msgs.scrollHeight;
                idx++;
                scheduleChatTimeout(typeNext, getDelay(ch), sessionId || chatSessionId);
            } else {
                if (isFamicom) {
                    const cur = document.createElement('span');
                    cur.className = 'nes-cursor';
                    cur.textContent = ' ▼';
                    div.appendChild(cur);
                    scheduleChatTimeout(() => {
                        if (!cur.isConnected) return;
                        cur.remove();
                        if (onDone) onDone();
                    }, 900, sessionId || chatSessionId);
                } else {
                    if (onDone) onDone();
                }
            }
        }
        // 最初の文字の前に少しだけ間を置く（考え始める感）
        scheduleChatTimeout(typeNext, 300 + Math.random() * 200, sessionId || chatSessionId);
    }

    function showChatUI() {
        if (document.getElementById('inryoku-chat') || document.getElementById('chat-tp-overlay')) return;
        var sessionId = beginChatSession();

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
        scheduleChatTimeout(function() {
            speakBinary('こんにちは、私は、infoです', function() {
                typeMsg('こんにちは、私は、infoです', function() {
                    speakBinary('何について知りたいですか？', function() {
                        typeMsg('何について知りたいですか？', function() {
                            // 2026-05-06: 挨拶完了後、質問候補をチャット内に表示（粒子言語の世界観のまま）
                            showChatSuggestions(sessionId);
                        }, sessionId);
                    }, sessionId);
                }, sessionId);
            }, sessionId);
        }, 400, sessionId);
    }

    // 2026-05-06: チャット内に質問候補チップを表示（挨拶後）
    function showChatSuggestions(sessionId) {
        if (typeof sessionId === 'number' && !isChatSessionActive(sessionId)) return;
        var msgs = document.getElementById('chat-messages');
        if (!msgs) return;
        // 既存があれば消す（再入防止）
        var existing = document.getElementById('chat-suggestions');
        if (existing) existing.remove();
        var box = document.createElement('div');
        box.id = 'chat-suggestions';
        box.className = 'chat-suggestions';
        var SUGGESTIONS = [
            { q: '商品について', full: '商品について教えてください。' },
            { q: '次のドロップ', full: '次のドロップはいつですか？' },
            { q: 'サイズ・素材', full: 'サイズ・素材について教えてください。' },
            { q: '取材・コラボ', full: '取材・コラボのご相談です。' },
            { q: 'その他', full: 'その他のお問い合わせ：' }
        ];
        SUGGESTIONS.forEach(function(s) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chat-suggestion';
            btn.textContent = s.q;
            btn.addEventListener('click', function() {
                var input = document.getElementById('chat-input');
                if (input) {
                    input.value = s.full;
                    // 既存の send ロジックに乗せる
                    var sendBtn = document.getElementById('chat-send');
                    if (sendBtn) sendBtn.click();
                    else {
                        // Enter キー押下を simulate
                        var ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
                        input.dispatchEvent(ev);
                    }
                }
                box.remove();
            });
            box.appendChild(btn);
        });
        msgs.appendChild(box);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function closeChatUI() {
        if (glitchTimer) { clearInterval(glitchTimer); glitchTimer = null; }
        endChatSession();
        clearChatAwaitingState();
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
        chatHistory = []; saveChatHistory(); // 会話履歴リセット + localStorage同期

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
    // ── トークで宇宙を変える: コマンドパーサー ──
    // ユーザーが自然言語で話すと、パーティクルの見た目が変わる
    window._universeParams = {
        palette: null,   // カスタムカラーパレット
        speed: 1.0,      // 速度倍率
        size: 1.0,       // サイズ倍率
        shootingRate: shootingStarRate
    };

    function parseUniverseCommand(text) {
        var t = text.toLowerCase();
        var changed = false;
        var feedback = '';

        // ── 色変更 ──
        if (t.match(/赤|red|火|炎|情熱/)) {
            applyPalette([[1,0,0],[1,0.2,0],[1,0.4,0.1],[0.8,0,0],[1,0.1,0.1],[0.6,0,0],[1,0.3,0]]);
            feedback = '…宇宙が赤く燃え始めた'; changed = true;
        } else if (t.match(/青|blue|海|水|冷|氷/)) {
            applyPalette([[0,0,1],[0,0.3,1],[0,0.6,1],[0.1,0.1,0.8],[0,0.2,0.6],[0.2,0.4,1],[0,0.5,0.8]]);
            feedback = '…深い青に沈んでいく'; changed = true;
        } else if (t.match(/緑|green|森|草|自然|木/)) {
            applyPalette([[0,1,0],[0.1,0.8,0.2],[0,0.6,0.1],[0.2,1,0.3],[0,0.5,0],[0.3,0.9,0.1],[0.1,0.7,0.3]]);
            feedback = '…森の息吹が広がる'; changed = true;
        } else if (t.match(/虹|rainbow|全色|カラフル|色/)) {
            applyPalette([[1,0,0],[0,1,0],[0,0,1],[0,1,1],[1,0,1],[1,1,0],[1,1,1]]);
            feedback = '…虹が宇宙を包む'; changed = true;
        } else if (t.match(/白|white|光|明|星/)) {
            applyPalette([[1,1,1],[0.95,0.95,1],[1,1,0.95],[0.9,0.95,1],[1,0.98,0.9],[0.85,0.9,1],[1,1,1]]);
            feedback = '…純粋な光に満ちた'; changed = true;
        } else if (t.match(/黒|dark|闇|暗|夜|宇宙/)) {
            applyPalette([[0.15,0.15,0.2],[0.1,0.1,0.15],[0.2,0.15,0.25],[0.05,0.1,0.15],[0.15,0.1,0.2],[0.1,0.15,0.1],[0.2,0.2,0.25]]);
            feedback = '…暗黒が広がる'; changed = true;
        } else if (t.match(/桜|pink|ピンク|春/)) {
            applyPalette([[1,0.6,0.7],[1,0.4,0.6],[0.9,0.5,0.6],[1,0.7,0.8],[0.8,0.3,0.5],[1,0.8,0.85],[0.95,0.6,0.65]]);
            feedback = '…桜が咲く'; changed = true;
        } else if (t.match(/金|gold|黄金|太陽|sun/)) {
            applyPalette([[1,0.85,0],[1,0.7,0.1],[0.9,0.6,0],[1,0.9,0.3],[0.8,0.65,0],[1,0.8,0.15],[0.95,0.75,0.1]]);
            feedback = '…黄金の光が差す'; changed = true;
        } else if (t.match(/元に戻|リセット|reset|default|普通|戻し/)) {
            applyPalette([[1,0,0],[0,1,0],[0,0,1],[0,1,1],[1,0,1],[1,1,0],[1,1,1]]);
            feedback = '…宇宙が元の姿に戻る'; changed = true;
        }

        // ── 速度変更 ──
        if (t.match(/速く|はやく|fast|加速|スピード|急/)) {
            window._universeParams.speed = 2.5;
            feedback += (feedback ? '。' : '…') + '粒子が加速した';
            changed = true;
        } else if (t.match(/遅く|ゆっくり|slow|減速|静か/)) {
            window._universeParams.speed = 0.3;
            feedback += (feedback ? '。' : '…') + '静かに漂う';
            changed = true;
        }

        // ── 流れ星 ──
        if (t.match(/流れ星|shooting|meteor|彗星|コメット/)) {
            spawnShootingStarBurst();
            feedback += (feedback ? '。' : '…') + '流れ星が降り注ぐ';
            changed = true;
        }

        // ── サイズ変更 ──
        if (t.match(/大きく|でかく|big|巨大/)) {
            window._universeParams.size = 2.0;
            applySize(2.0);
            feedback += (feedback ? '。' : '…') + '星が膨らむ';
            changed = true;
        } else if (t.match(/小さく|ちいさく|small|tiny|微/)) {
            window._universeParams.size = 0.5;
            applySize(0.5);
            feedback += (feedback ? '。' : '…') + '星が繊細になる';
            changed = true;
        }

        return changed ? feedback : null;
    }

    function applyPalette(newPalette) {
        var colArr = geometry.attributes.color.array;
        for (var i = 0; i < N; i++) {
            if (isShootingStar[i]) continue; // 流れ星は白のまま
            var c = newPalette[i % newPalette.length];
            colArr[i*3] = c[0]; colArr[i*3+1] = c[1]; colArr[i*3+2] = c[2];
            origColArr[i*3] = c[0]; origColArr[i*3+1] = c[1]; origColArr[i*3+2] = c[2];
        }
        geometry.attributes.color.needsUpdate = true;
    }

    function applySize(mult) {
        var sArr = geometry.attributes.aSize.array;
        for (var i = 0; i < N; i++) {
            var base = origSizeArr ? origSizeArr[i] : sArr[i];
            sArr[i] = base * mult;
        }
        geometry.attributes.aSize.needsUpdate = true;
    }

    function spawnShootingStarBurst() {
        // 50個の流れ星を一気に発生
        var count = 0;
        for (var i = 0; i < N && count < 50; i++) {
            if (!isShootingStar[i] && Math.random() < 0.02) {
                isShootingStar[i] = 1;
                var sp = 0.5 + Math.random() * 1.2;
                driftSpeedZ[i] = sp;
                var a = Math.random() * Math.PI * 2;
                shootingDirX[i] = Math.cos(a) * 0.2 * sp;
                shootingDirY[i] = Math.sin(a) * 0.2 * sp;
                var colArr = geometry.attributes.color.array;
                colArr[i*3] = 1; colArr[i*3+1] = 1; colArr[i*3+2] = 1;
                geometry.attributes.aSize.array[i] = 3.0 + Math.random() * 3.0;
                count++;
            }
        }
        geometry.attributes.color.needsUpdate = true;
        geometry.attributes.aSize.needsUpdate = true;
        // 5秒後に元に戻す
        setTimeout(function() {
            for (var i = 0; i < N; i++) {
                if (isShootingStar[i] && Math.random() < 0.6) {
                    isShootingStar[i] = 0;
                    var spd = 0.00875 + Math.random() * 0.045;
                    driftSpeedZ[i] = spd;
                    shootingDirX[i] = 0;
                    shootingDirY[i] = 0;
                    var colArr = geometry.attributes.color.array;
                    colArr[i*3] = origColArr[i*3];
                    colArr[i*3+1] = origColArr[i*3+1];
                    colArr[i*3+2] = origColArr[i*3+2];
                    geometry.attributes.aSize.array[i] = origSizeArr ? origSizeArr[i] : 1.5;
                }
            }
            geometry.attributes.color.needsUpdate = true;
            geometry.attributes.aSize.needsUpdate = true;
        }, 5000);
    }

    function countMatches(text, patterns) {
        var score = 0;
        if (!text || !patterns || !patterns.length) return score;
        for (var i = 0; i < patterns.length; i++) {
            var pattern = patterns[i];
            if (pattern && pattern.test(text)) score += 1;
        }
        return score;
    }

    function startsWithAny(text, patterns) {
        if (!text || !patterns || !patterns.length) return false;
        for (var i = 0; i < patterns.length; i++) {
            if (patterns[i] && patterns[i].test(text)) return true;
        }
        return false;
    }

    function inferSpeechProfile(userText, responseText) {
        var user = String(userText || '').trim();
        var response = String(responseText || '').trim();
        var userLower = user.toLowerCase();
        var responseLower = response.toLowerCase();
        var source = (userLower + ' ' + responseLower).trim();
        var reportedQuestion = /you asked|you said|as you said|as i said|asked\s+[“"']|質問した|と言ってた|という質問|引用/.test(responseLower);
        var responseStartsDirective = startsWithAny(responseLower, [
            /^(let's|go|open|look|enter|watch|start|try|take)\b/,
            /^(進め|開け|見ろ|入れ|始め|試して|行け|向かえ)/
        ]);
        var responseStartsAnswer = startsWithAny(responseLower, [
            /^(yes|no|it is|it will|you can|you should|i can|we can|sure|maybe)\b/,
            /^(はい|いいえ|可能|無理|まだ|できる|できます|そうです|たぶん|了解)/
        ]);
        var responseStartsQuestion = startsWithAny(responseLower, [
            /^(what|why|which|where|when|who|how|can you|do you|would you)\b/,
            /^(何|なぜ|どれ|どこ|いつ|誰|どう|できますか|してほしい)/
        ]);
        return {
            user: user,
            response: response,
            source: source,
            asksBack: !reportedQuestion && ((/[?？]/.test(response) && response.length < 120) || responseStartsQuestion),
            refusal: /できない|無理|can't|cannot|not available|unavailable|later|wait|拒否|だめ|not now|still closed|未設定|準備中|soon|checkout soon|まだ.*(ない|できない)|hold/.test(responseLower),
            quote: /記憶|過去|remember|echo|quote|heard|told|伝聞|引用|said|taught|according to|as you said|as i said/.test(responseLower),
            reveal: /101|啓示|覚醒|超え|越え|unlock|awaken|reveal|\bleap\b|\bjump\b|breakthrough|threshold/.test(source),
            directive: /やれ|進め|open|go\b|must|should|いけ|見ろ|command|enter|unlock|move|して\b|してくれ|try|begin|start|take\b/.test(responseLower) || responseStartsDirective,
            // observe = 焦点フラグ (旧: 観測フラグ) [2026-05-09 改名]。
            // ユーザー文の日本語マッチに「観測」が含まれるのは入力テキスト側の語彙であり、
            // ブランドコピーではない。LOGO_PHASES.observe / canonMeta の契約と連動するため key 名は不変。
            observe: /見て|観測|observe|\blook\b|気づ|notice|signal|vision|read|watch|focus/.test(responseLower),
            resonance: /\bwe\b|\bus\b|一緒|ともに|共に|align|consensus|resonate|connect|with you|same wave|sync/.test(responseLower),
            certainty: /definitely|certain|clearly|must|will\b|断言|確実|明確|確か|guarantee|for sure|もちろん|必ず|間違いなく/.test(responseLower),
            emit: /hello|こんにちは|signal|speak|tell|show|transmit|saying|message/.test(responseLower),
            selfScope: /\b(i|me|my|myself)\b|私|ぼく|俺/.test(responseLower),
            youScope: /\byou\b|あなた|君/.test(responseLower),
            worldScope: /\b(world|they|it|site|system)\b|世界|サイト|システム|あれ|それ/.test(responseLower),
            responseStartsAnswer: responseStartsAnswer
        };
    }

    function inferSpeechCanon(userText, responseText) {
        var canonMeta = window.InryokuCanonMeta || null;
        function finalizeCanon(canonName, fallbackCanon) {
            var resolved = canonName || fallbackCanon || 'emit';
            if (!canonMeta || typeof canonMeta.getCanon !== 'function') return resolved;
            var config = canonMeta.getCanon(resolved);
            if (!config) return fallbackCanon || 'emit';
            // AI 応答は whisper 系へ落とさない。最低でも可視の emit に寄せる。
            if (config.triggerClass === 'whisper') return fallbackCanon || 'emit';
            return resolved;
        }

        var profile = inferSpeechProfile(userText, responseText);

        if (profile.reveal) return finalizeCanon('revelation', 'emit');
        if (profile.refusal) return finalizeCanon(profile.quote ? 'quotation' : 'shadow', 'emit');
        if (profile.quote) return finalizeCanon('quotation', 'emit');
        if (profile.asksBack) return finalizeCanon(profile.selfScope && !profile.youScope ? 'self_question' : 'observation', 'observation');
        if (profile.directive) return finalizeCanon('future_command', 'emit');
        if (profile.observe) return finalizeCanon(profile.youScope || profile.worldScope ? 'observation' : 'emit', 'emit');
        if (profile.resonance) return finalizeCanon('resonance', 'emit');
        if (profile.certainty) return finalizeCanon('declaration', 'emit');
        if (profile.emit) return finalizeCanon('emit', 'emit');
        if (profile.responseStartsAnswer) return finalizeCanon('declaration', 'emit');
        return finalizeCanon('emit', 'emit');
    }

    function setLogoSphereCanon(canonName, register) {
        var sphere3d = window._p3LogoSphere3D;
        if (!sphere3d || typeof sphere3d.setSpeechCanon !== 'function') return;
        try { sphere3d.setSpeechCanon(canonName, register); } catch (err) {}
    }

    function clearLogoSphereCanon() {
        var sphere3d = window._p3LogoSphere3D;
        if (!sphere3d || typeof sphere3d.clearSpeechCanon !== 'function') return;
        try { sphere3d.clearSpeechCanon(); } catch (err) {}
    }

    function emitSpeechCanon(canonName, register) {
        if (!canonName) return false;
        var canonMeta = window.InryokuCanonMeta || null;
        if ((!register || register === 'special') && canonMeta && typeof canonMeta.getRegisterClass === 'function') {
            register = canonMeta.getRegisterClass(canonName, register);
        }
        if (window._inryokuSpeech && typeof window._inryokuSpeech.speakCanon === 'function') {
            try {
                return window._inryokuSpeech.speakCanon(canonName, register) !== false;
            } catch (err) {}
        }
        setLogoSphereCanon(canonName, register);
        return true;
    }

    function setChatAwaitingState() {
        setLogoSphereCanon('self_question', 'hover');
    }

    function clearChatAwaitingState() {
        clearLogoSphereCanon();
    }

    function fetchAIResponse(userText, callback, sessionId) {
        if (typeof sessionId === 'number' && !isChatSessionActive(sessionId)) return;
        chatHistory.push({ role: 'user', content: userText }); saveChatHistory();
        setChatAwaitingState();
        abortChatFetch();
        chatFetchController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: chatFetchController ? chatFetchController.signal : undefined,
            body: JSON.stringify({
                message: userText,
                history: chatHistory.slice(-10) // 直近10メッセージのみ送信
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (chatFetchController && typeof sessionId === 'number' && !isChatSessionActive(sessionId)) return;
            var response = data.response || '……';
            chatFetchController = null;
            clearChatAwaitingState();
            if (typeof sessionId === 'number' && !isChatSessionActive(sessionId)) return;
            chatHistory.push({ role: 'assistant', content: response }); saveChatHistory();
            callback(response);
        })
        .catch(function(err) {
            if (err && err.name === 'AbortError') return;
            var fallback = '波が揺れた。もう一度、話しかけて';
            chatFetchController = null;
            clearChatAwaitingState();
            if (typeof sessionId === 'number' && !isChatSessionActive(sessionId)) return;
            chatHistory.push({ role: 'assistant', content: fallback }); saveChatHistory();
            callback(fallback);
        });
    }

    function sendChatMsg() {
        var sessionId = chatSessionId;
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
                    if (!isChatSessionActive(sessionId)) return;
                    emitSpeechCanon(inferSpeechCanon(txt, response), 'chat');
                    scheduleChatTimeout(function() { appearFn(response, 'tp-ai'); }, 400, sessionId);
                }, sessionId);
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

        // ── トークで宇宙変更: コマンドチェック ──
        var universeFeedback = parseUniverseCommand(txt);

        // AI応答を取得 → 二進数粒子演出 → テキスト表示
        fetchAIResponse(txt, function(response) {
            if (!isChatSessionActive(sessionId)) return;
            aDiv.remove();
            // 宇宙変更のフィードバックがあれば応答に追加
            var fullResponse = universeFeedback
                ? response + '\n\n' + universeFeedback
                : response;
            emitSpeechCanon(inferSpeechCanon(txt, response), 'chat');
            // 粒子が円環を形成してから「読み取り」としてテキスト表示
            speakBinary(fullResponse, function() {
                typeMsg(fullResponse, null, sessionId);
            }, sessionId);
        }, sessionId);
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


// ═══ 2026-04-30: Canvas2D 星空版（旧 antigravity evolution_fixed.js 準拠） ═══
// initParticleUniverse の代替。WebGL版を保持したまま、こちらを呼び出すことで切替。
function initParticleUniverseCanvas2D() {
    if (window.__p3Canvas2DUniverse && typeof window.__p3Canvas2DUniverse.destroy === 'function') {
        try { window.__p3Canvas2DUniverse.destroy(); } catch (_) {}
    }

    document.querySelectorAll('body > canvas:not(#p6-canvas)').forEach(c => c.remove());
    const existing = document.getElementById('p6-canvas');
    if (existing) existing.remove();

    const cv = document.createElement('canvas');
    cv.id = 'p6-canvas';
    cv.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;' +
        'pointer-events:none;display:block;opacity:1;';
    document.body.insertBefore(cv, document.body.firstChild);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = cv.getContext('2d', { alpha: true, desynchronized: true });
    let W = 0, H = 0, lastNow = 0, rafId = 0, running = false;
    let mx = 0, my = 0;
    let activeMeteor = null;
    let nextMeteorAt = 16 + Math.random() * 8;
    let nextFlashAt = 5;
    let flashGroupId = null;
    let flashStartAt = -100;

    const COLS = ['#FF0000', '#00FF00', '#0000FF', '#00FFFF', '#FF00FF', '#FFFF00'];
    const COLS_RGB = [[255,0,0],[0,255,0],[0,0,255],[0,255,255],[255,0,255],[255,255,0]];
    const isMobile = window.innerWidth < 768;
    const N = isMobile ? 3200 : 6400;
    const CN = isMobile ? 42 : 80;
    const FADE_TOTAL = 5.0;
    const DEPTH_MIN = 180;
    const DEPTH_MAX = 1850;
    const FOV = 560 * dpr;

    function applyCanvasMetrics() {
        cv.width = Math.floor((window.innerWidth || 1280) * dpr);
        cv.height = Math.floor((window.innerHeight || 720) * dpr);
        W = cv.width;
        H = cv.height;
        mx = W * 0.5;
        my = H * 0.5;
        ctx.setTransform(1, 0, 0, 1, 0.5, 0.5);
    }
    applyCanvasMetrics();

    function pickColor(index) {
        const ci = typeof index === 'number' ? index % COLS.length : Math.floor(Math.random() * COLS.length);
        return { col: COLS[ci], rgb: COLS_RGB[ci], ci };
    }

    function sampleParticleSize() {
        const roll = Math.random();
        if (roll < 0.80) return (0.3 + Math.random() * 0.7) * dpr;
        if (roll < 0.98) return (1.0 + Math.random() * 1.5) * dpr;
        return (2.5 + Math.random() * 2.5) * dpr;
    }

    function sampleTwinkleBand() {
        const roll = Math.random();
        if (roll < 0.34) return { speed: 1.8 + Math.random() * 1.1, amp: 0.20 };
        if (roll < 0.68) return { speed: 0.9 + Math.random() * 0.55, amp: 0.14 };
        return { speed: 0.35 + Math.random() * 0.25, amp: 0.10 };
    }

    const pts = Array.from({ length: N }, (_, i) => {
        const picked = pickColor(i);
        const band = sampleTwinkleBand();
        return {
            bx: (Math.random() - 0.5) * W * 1.9,
            by: (Math.random() - 0.5) * H * 1.9,
            z: DEPTH_MIN + Math.random() * (DEPTH_MAX - DEPTH_MIN),
            vz: 52 + Math.random() * 96,
            swayX: 18 + Math.random() * 48,
            swayY: 18 + Math.random() * 48,
            phX: Math.random() * Math.PI * 2,
            phY: Math.random() * Math.PI * 2,
            col: picked.col,
            rgb: picked.rgb,
            sz: sampleParticleSize(),
            tw: Math.random() * Math.PI * 2,
            tspd: band.speed,
            tamp: band.amp,
            birth: Math.random() * 3.0
        };
    });

    function makeRandomStars(count) {
        return Array.from({ length: count }, () => {
            const picked = pickColor();
            const band = sampleTwinkleBand();
            return {
                x: Math.random() * W,
                y: Math.random() * H,
                col: picked.col,
                rgb: picked.rgb,
                sz: (1.1 + Math.random() * 1.2) * dpr,
                tw: Math.random() * Math.PI * 2,
                tspd: 0.22 + Math.random() * 0.42,
                tamp: 0.18 + Math.random() * 0.10,
                links: [],
                group: null,
                birth: 0
            };
        });
    }

    function buildNamedConstellation(groupId, cx, cy, scale, points, links) {
        return points.map((pt, idx) => {
            const picked = pickColor((groupId * 2 + idx) % COLS.length);
            return {
                x: cx + pt[0] * scale,
                y: cy + pt[1] * scale,
                col: picked.col,
                rgb: picked.rgb,
                sz: (1.5 + Math.random() * 1.0) * dpr,
                tw: Math.random() * Math.PI * 2,
                tspd: 0.20 + idx * 0.02,
                tamp: 0.16,
                links: links.filter(pair => pair[0] === idx).map(pair => pair[1]),
                group: groupId,
                named: true,
                birth: 0
            };
        });
    }

    function buildConstellations() {
        const named = [];
        const scaleA = Math.min(W, H) * 0.12;
        const scaleB = Math.min(W, H) * 0.10;
        const scaleC = Math.min(W, H) * 0.11;

        named.push(...buildNamedConstellation(
            0,
            W * 0.24,
            H * 0.30,
            scaleA,
            [[-0.7, 0.2], [0.0, -0.6], [0.7, 0.25]],
            [[0, 1], [1, 2], [2, 0]]
        ));
        named.push(...buildNamedConstellation(
            1,
            W * 0.76,
            H * 0.26,
            scaleB,
            [[-1.1, -0.1], [-0.65, -0.22], [-0.25, -0.08], [0.15, 0.10], [0.55, 0.22], [0.95, 0.34], [1.28, 0.56]],
            [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]
        ));
        named.push(...buildNamedConstellation(
            2,
            W * 0.54,
            H * 0.70,
            scaleC,
            [[0, -1.05], [0, -0.38], [0, 0.30], [0, 0.98], [-0.62, -0.06], [0.62, -0.06]],
            [[0, 1], [1, 2], [2, 3], [4, 2], [2, 5]]
        ));

        const rest = Math.max(0, CN - named.length);
        const randoms = makeRandomStars(rest);
        const all = randoms.concat(named);
        const maxLink = Math.min(W, H) * 0.28;
        for (let i = 0; i < randoms.length; i++) {
            const s = randoms[i];
            const cand = [];
            for (let j = 0; j < randoms.length; j++) {
                if (j === i) continue;
                const o = randoms[j];
                const d = Math.hypot(s.x - o.x, s.y - o.y);
                if (d < maxLink) cand.push({ j, d });
            }
            cand.sort((a, b) => a.d - b.d);
            s.links = cand.slice(0, 2).map(c => c.j);
        }

        all.sort((a, b) => a.y - b.y || a.x - b.x);
        all.forEach((s, i) => { s.birth = 1.0 + i * 0.15; });
        return all;
    }

    let cstars = buildConstellations();
    let namedGroups = [...new Set(cstars.filter(s => s.group !== null).map(s => s.group))];

    function haloGradient(x, y, radius, rgb, innerAlpha, outerAlpha) {
        const rg = ctx.createRadialGradient(x, y, 0, x, y, radius);
        rg.addColorStop(0.0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${innerAlpha})`);
        rg.addColorStop(0.3, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${innerAlpha * 0.45})`);
        rg.addColorStop(0.7, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${outerAlpha})`);
        rg.addColorStop(1.0, 'rgba(0,0,0,0)');
        return rg;
    }

    function drawLensFlare(x, y, len, alpha, rgb) {
        ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
        ctx.lineWidth = Math.max(0.6 * dpr, 0.8);
        ctx.beginPath();
        ctx.moveTo(x - len, y);
        ctx.lineTo(x + len, y);
        ctx.moveTo(x, y - len);
        ctx.lineTo(x, y + len);
        ctx.stroke();
    }

    function resetMeteor(elapsed) {
        const side = Math.floor(Math.random() * 4);
        const picked = pickColor();
        let x, y, vx, vy;
        const speed = 1500 * dpr;
        if (side === 0) { x = -120 * dpr; y = Math.random() * H * 0.55; vx = speed * 0.85; vy = speed * 0.35; }
        else if (side === 1) { x = W + 120 * dpr; y = Math.random() * H * 0.45; vx = -speed * 0.82; vy = speed * 0.28; }
        else if (side === 2) { x = Math.random() * W; y = -120 * dpr; vx = speed * 0.42; vy = speed * 0.92; }
        else { x = Math.random() * W; y = H + 120 * dpr; vx = speed * 0.48; vy = -speed * 0.96; }
        activeMeteor = {
            x, y, vx, vy,
            col: picked.col,
            rgb: picked.rgb,
            life: 0,
            maxLife: 1.2,
            tail: 200 * dpr
        };
        nextMeteorAt = elapsed + 15 + Math.random() * 10;
    }

    function pointerMove(e) {
        if (e.touches && e.touches[0]) {
            mx = e.touches[0].clientX * dpr;
            my = e.touches[0].clientY * dpr;
        } else {
            mx = e.clientX * dpr;
            my = e.clientY * dpr;
        }
    }

    function onResize() {
        const oldW = W || 1;
        const oldH = H || 1;
        applyCanvasMetrics();
        const sx = W / oldW;
        const sy = H / oldH;
        pts.forEach(p => {
            p.bx *= sx;
            p.by *= sy;
        });
        cstars.forEach(s => {
            s.x *= sx;
            s.y *= sy;
        });
    }

    function onVisibility() {
        if (document.hidden) {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
        } else if (!running) {
            running = true;
            lastNow = performance.now();
            rafId = requestAnimationFrame(draw);
        }
    }

    function destroy() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        document.removeEventListener('mousemove', pointerMove);
        document.removeEventListener('touchmove', pointerMove, { passive: true });
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        if (cv && cv.isConnected) cv.remove();
        if (window.__p3Canvas2DUniverse && window.__p3Canvas2DUniverse.canvas === cv) {
            delete window.__p3Canvas2DUniverse;
        }
    }

    document.addEventListener('mousemove', pointerMove);
    document.addEventListener('touchmove', pointerMove, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    function draw(nowMs) {
        if (!running || !cv.isConnected) {
            if (!cv.isConnected) destroy();
            return;
        }

        const now = nowMs || performance.now();
        const dt = lastNow ? Math.min(0.033, Math.max(0.001, (now - lastNow) / 1000)) : 0.016;
        lastNow = now;
        const elapsed = now / 1000 - startT;
        const fadeIn = Math.min(1, elapsed / FADE_TOTAL);
        const breath = 0.85 + 0.15 * Math.sin(elapsed * 0.4 * Math.PI * 2);
        const swirlX = Math.cos(elapsed * (Math.PI * 2 / 15)) * 10 * dpr;
        const swirlY = Math.sin(elapsed * (Math.PI * 2 / 15)) * 10 * dpr;
        const parallaxX = ((mx / Math.max(W, 1)) - 0.5) * 40 * dpr;
        const parallaxY = ((my / Math.max(H, 1)) - 0.5) * 40 * dpr;
        const windPhase = elapsed % 30;
        const windActive = windPhase < 5;
        const windKick = windActive ? Math.sin((windPhase / 5) * Math.PI) * 18 * dpr : 0;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0.5, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(-1, -1, W + 2, H + 2);
        ctx.globalCompositeOperation = 'lighter';

        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            p.z -= p.vz * dt;
            if (p.z < DEPTH_MIN) p.z = DEPTH_MAX;

            const bornFade = Math.min(1, Math.max(0, (elapsed - p.birth) / 1.8));
            if (bornFade <= 0) continue;

            const sc = FOV / p.z;
            const tw = 1 + Math.sin(elapsed * p.tspd + p.tw) * p.tamp;
            const depthNorm = 1 - (p.z - DEPTH_MIN) / (DEPTH_MAX - DEPTH_MIN);
            const driftX = Math.sin(elapsed * 0.18 + p.phX) * p.swayX;
            const driftY = Math.cos(elapsed * 0.16 + p.phY) * p.swayY;
            const px = p.bx + driftX + swirlX + windKick + parallaxX * (0.28 + depthNorm * 0.72);
            const py = p.by + driftY + swirlY + parallaxY * (0.28 + depthNorm * 0.72);
            const sx = W * 0.5 + px * sc;
            const sy = H * 0.5 + py * sc;
            if (sx < -32 || sx > W + 32 || sy < -32 || sy > H + 32) continue;

            const size = Math.min(6.5 * dpr, Math.max(0.24 * dpr, p.sz * sc * 1.18));
            const alpha = Math.min(1, (0.16 + depthNorm * 0.84) * bornFade * breath * tw);

            if (size >= 0.55 * dpr) {
                const tightR = size * 1.8;
                ctx.fillStyle = haloGradient(sx, sy, tightR, p.rgb, 0.24 * alpha, 0.05 * alpha);
                ctx.beginPath();
                ctx.arc(sx, sy, tightR, 0, Math.PI * 2);
                ctx.fill();
            }
            if (size >= 1.1 * dpr) {
                const softR = size * 3.4;
                ctx.fillStyle = haloGradient(sx, sy, softR, p.rgb, 0.06 * alpha, 0.02 * alpha);
                ctx.beginPath();
                ctx.arc(sx, sy, softR, 0, Math.PI * 2);
                ctx.fill();
            }

            if (size <= 0.75 * dpr) {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.col;
                ctx.fillRect(sx, sy, Math.max(1, size), Math.max(1, size));
                ctx.globalAlpha = 1;
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.col;
                ctx.beginPath();
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            if (size >= 3.0 * dpr) {
                drawLensFlare(sx, sy, size * 7.0, 0.10 * alpha, p.rgb);
            }
        }

        const flashProgress = Math.max(0, Math.min(1, (elapsed - flashStartAt) / 1.0));
        const flashBoost = flashProgress > 0 && flashProgress < 1 ? 1 + Math.sin(flashProgress * Math.PI) * 2.0 : 1;

        ctx.lineCap = 'round';
        for (let i = 0; i < cstars.length; i++) {
            const s = cstars[i];
            const sFade = Math.min(1, Math.max(0, (elapsed - s.birth) / 0.9));
            if (sFade <= 0) continue;
            const sTw = 1 + Math.sin(elapsed * s.tspd + s.tw) * s.tamp;
            const groupBoost = s.group !== null && s.group === flashGroupId ? flashBoost : 1;

            for (const j of s.links) {
                const o = cstars[j];
                const linkStart = Math.max(s.birth, o.birth);
                const lineProg = Math.min(1, Math.max(0, (elapsed - linkStart) / 0.8));
                if (lineProg <= 0) continue;
                const ex = s.x + (o.x - s.x) * lineProg;
                const ey = s.y + (o.y - s.y) * lineProg;
                const lineAlpha = (s.named || o.named ? 0.12 : 0.07) * sFade * sTw * groupBoost;
                const grad = ctx.createLinearGradient(s.x, s.y, ex, ey);
                grad.addColorStop(0, `rgba(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]},${lineAlpha})`);
                grad.addColorStop(1, `rgba(${o.rgb[0]},${o.rgb[1]},${o.rgb[2]},${lineAlpha})`);
                ctx.strokeStyle = grad;
                ctx.lineWidth = (s.named || o.named ? 1.0 : 0.6) * dpr;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(ex, ey);
                ctx.stroke();
            }
        }

        for (let i = 0; i < cstars.length; i++) {
            const s = cstars[i];
            const sFade = Math.min(1, Math.max(0, (elapsed - s.birth) / 0.9));
            if (sFade <= 0) continue;
            const sTw = 1 + Math.sin(elapsed * s.tspd + s.tw) * s.tamp;
            const groupBoost = s.group !== null && s.group === flashGroupId ? flashBoost : 1;
            const size = s.sz * (0.92 + sTw * 0.20) * groupBoost;
            const alpha = 0.82 * sFade * breath;

            const tightR = size * 2.4;
            ctx.fillStyle = haloGradient(s.x, s.y, tightR, s.rgb, 0.18 * alpha, 0.05 * alpha);
            ctx.beginPath();
            ctx.arc(s.x, s.y, tightR, 0, Math.PI * 2);
            ctx.fill();

            const softR = size * 4.8;
            ctx.fillStyle = haloGradient(s.x, s.y, softR, s.rgb, 0.05 * alpha, 0.02 * alpha);
            ctx.beginPath();
            ctx.arc(s.x, s.y, softR, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = Math.min(1, alpha);
            ctx.fillStyle = s.col;
            ctx.beginPath();
            ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        if (!activeMeteor && elapsed >= nextMeteorAt) {
            resetMeteor(elapsed);
        }
        if (activeMeteor) {
            activeMeteor.life += dt;
            activeMeteor.x += activeMeteor.vx * dt;
            activeMeteor.y += activeMeteor.vy * dt;
            const meteorFade = Math.max(0, 1 - activeMeteor.life / activeMeteor.maxLife);
            const tailX = activeMeteor.x - activeMeteor.vx * 0.10;
            const tailY = activeMeteor.y - activeMeteor.vy * 0.10;
            const grad = ctx.createLinearGradient(activeMeteor.x, activeMeteor.y, tailX, tailY);
            grad.addColorStop(0, `rgba(${activeMeteor.rgb[0]},${activeMeteor.rgb[1]},${activeMeteor.rgb[2]},${0.85 * meteorFade})`);
            grad.addColorStop(0.6, `rgba(${activeMeteor.rgb[0]},${activeMeteor.rgb[1]},${activeMeteor.rgb[2]},${0.22 * meteorFade})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2.2 * dpr;
            ctx.beginPath();
            ctx.moveTo(activeMeteor.x, activeMeteor.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();

            ctx.fillStyle = haloGradient(activeMeteor.x, activeMeteor.y, 18 * dpr, activeMeteor.rgb, 0.32 * meteorFade, 0.08 * meteorFade);
            ctx.beginPath();
            ctx.arc(activeMeteor.x, activeMeteor.y, 18 * dpr, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = meteorFade;
            ctx.fillStyle = activeMeteor.col;
            ctx.beginPath();
            ctx.arc(activeMeteor.x, activeMeteor.y, 2.4 * dpr, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            if (
                activeMeteor.life >= activeMeteor.maxLife ||
                activeMeteor.x < -activeMeteor.tail || activeMeteor.x > W + activeMeteor.tail ||
                activeMeteor.y < -activeMeteor.tail || activeMeteor.y > H + activeMeteor.tail
            ) {
                activeMeteor = null;
            }
        }

        if (elapsed >= nextFlashAt && namedGroups.length) {
            flashGroupId = namedGroups[Math.floor(Math.random() * namedGroups.length)];
            flashStartAt = elapsed;
            nextFlashAt = elapsed + 5;
        }

        ctx.restore();
        rafId = requestAnimationFrame(draw);
    }

    const startT = performance.now() / 1000;
    lastNow = performance.now();
    running = true;
    window.__p3Canvas2DUniverse = { destroy, canvas: cv };
    rafId = requestAnimationFrame(draw);
    console.log('[P3] Canvas2D particle universe started (N=' + N + ', constellations=' + CN + ')');
}

// initParticleUniverseCanvas() — Canvas 2D使用のため削除 (inryokü技術制約違反)



// ═══ カートドロワー ═══
function showCartDrawer() {
    // 既存のドロワーがあれば削除
    var existing = document.getElementById('cart-drawer');
    if (existing) { existing.remove(); return; }

    var drawer = document.createElement('div');
    drawer.id = 'cart-drawer';

    function renderCartContent() {
        var items = CART.items;
        if (items.length === 0) {
            return `
                <div class="cart-drawer-header">
                    <span class="cart-drawer-title">CART</span>
                    <button class="cart-drawer-close" id="cd-close">✕</button>
                </div>
                <div class="cart-empty">カートは空です</div>`;
        }
        var itemsHTML = items.map(function(item, idx) {
            return `<div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-meta">${item.size} × ${item.qty}</div>
                </div>
                <div class="cart-item-right">
                    <div class="cart-item-price">¥${(item.price * item.qty).toLocaleString()}</div>
                    <button class="cart-item-remove" data-idx="${idx}">✕</button>
                </div>
            </div>`;
        }).join('');
        var allCheckoutReady = items.every(function(item) {
            var product = PRODUCTS.find(function(p) { return p.id === item.id; });
            return product && getCheckoutStatus(product, item.size).available;
        });

        return `
            <div class="cart-drawer-header">
                <span class="cart-drawer-title">CART (${CART.count()})</span>
                <button class="cart-drawer-close" id="cd-close">✕</button>
            </div>
            <div class="cart-items">${itemsHTML}</div>
            <div class="cart-footer">
                <div class="cart-total">
                    <span>TOTAL</span>
                    <span>¥${CART.total().toLocaleString()}</span>
                </div>
                <button class="cart-checkout-btn${allCheckoutReady ? '' : ' is-pending'}" id="cd-checkout"${allCheckoutReady ? '' : ' disabled aria-disabled="true"'}>${allCheckoutReady ? 'CHECKOUT' : 'チェックアウト準備中'}</button>
                <div class="cart-stripe-note">${allCheckoutReady ? 'Secure Checkout · Stripe 経由' : 'チェックアウト準備中。最終確定後に決済が有効になります。'}</div>
            </div>`;
    }

    drawer.innerHTML = renderCartContent();
    document.body.appendChild(drawer);
    setTimeout(function() { drawer.classList.add('cart-drawer-open'); }, 10);

    // 閉じる
    function closeDrawer() {
        drawer.classList.remove('cart-drawer-open');
        setTimeout(function() { drawer.remove(); }, 300);
    }

    drawer.addEventListener('click', function(e) {
        if (e.target.id === 'cd-close') closeDrawer();
        if (e.target.classList.contains('cart-item-remove')) {
            var idx = parseInt(e.target.dataset.idx);
            CART.remove(idx);
            drawer.innerHTML = renderCartContent();
        }
        if (e.target.id === 'cd-checkout') {
            if (CART.items.length === 0) return;
            var btn = e.target;
            btn.textContent = 'PROCESSING...';
            btn.disabled = true;

            // Shopify Storefront API でカート作成 → チェックアウトURLへリダイレクト
            // CART.itemsにshopifyVariantIdがない場合はフォールバック
            var allCheckoutReady = CART.items.every(function(item) {
                var product = PRODUCTS.find(function(p) { return p.id === item.id; });
                return product && getCheckoutStatus(product, item.size).available;
            });
            var hasShopify = CART.items.some(function(item) { return !!item.shopifyVariantId; });

            if (!allCheckoutReady) {
                alert('この商品はチェックアウト準備中です。今しばらくお待ちください。');
                btn.textContent = 'チェックアウト準備中';
                btn.classList.add('is-pending');
                btn.disabled = true;
                return;
            }

            if (hasShopify && SHOPIFY_CONFIG.storeDomain && SHOPIFY_CONFIG.storefrontToken) {
                shopifyCheckout(CART.items)
                    .then(function(checkoutUrl) {
                        window.location.href = checkoutUrl;
                    })
                    .catch(function(err) {
                        alert('Checkout error: ' + err.message);
                        btn.textContent = 'CHECKOUT';
                        btn.disabled = false;
                    });
            } else {
                // Shopify未設定時のフォールバック
                fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: CART.items })
                })
                .then(function(r) {
                    // 2026-05-09 EC launch: 503 (Shopify env 未設定) 等を本文と共に握る
                    return r.json().then(function(data) {
                        return { ok: r.ok, status: r.status, data: data };
                    }).catch(function() {
                        return { ok: r.ok, status: r.status, data: { error: 'サーバー応答を解析できませんでした (' + r.status + ')' } };
                    });
                })
                .then(function(result) {
                    if (result.ok && result.data && result.data.url) {
                        window.location.href = result.data.url;
                    } else {
                        var msg = (result.data && result.data.error) || 'チェックアウトはまだ準備中です。';
                        if (result.status === 503) {
                            msg = 'チェックアウト準備中: 決済プロバイダの設定が完了していません。'
                                + ' お手数ですが暫くしてから再度お試しください。';
                        }
                        alert(msg);
                        btn.textContent = 'CHECKOUT';
                        btn.disabled = false;
                        btn.classList.remove('is-pending');
                    }
                })
                .catch(function(err) {
                    alert('チェックアウトエラー: ' + (err && err.message ? err.message : 'ネットワークに接続できません'));
                    btn.textContent = 'CHECKOUT';
                    btn.disabled = false;
                    btn.classList.remove('is-pending');
                });
            }
        }
    });

    // ESCで閉じる
    function onEsc(e) { if (e.key === 'Escape') { closeDrawer(); window.removeEventListener('keydown', onEsc); } }
    window.addEventListener('keydown', onEsc);
}

// ═══ 商品モーダル ═══
function showProductModal(idx) {
    const p = PRODUCTS[idx];
    if (!p) return;
    const modalCheckoutReady = isProductPurchasable(p);
    const initialSize = getDefaultPurchasableSize(p);
    const m = document.createElement('div');
    m.className = 'product-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
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
                            ${p.sizes.map((s) => {
                                var enabled = hasMappedVariant(p, s);
                                var selected = enabled && s === initialSize;
                                return `<button class="size-btn${selected ? ' selected' : ''}" data-size="${s}"${enabled ? '' : ' disabled'}>${s}</button>`;
                            }).join('')}
                        </div>
                    </div>
                    <button class="add-to-cart-btn${modalCheckoutReady ? '' : ' disabled is-pending'}" id="pm-cart"${modalCheckoutReady ? '' : ' disabled aria-disabled="true"'}>
                        <span class="cart-btn-text">${modalCheckoutReady ? 'ADD TO CART' : 'チェックアウト準備中'}</span>
                        <span class="cart-btn-price">${p.price}</span>
                    </button>
                    <div class="product-shipping-info">
                        <span>DELIVERY · 7–14 BUSINESS DAYS</span>
                        <span>WORLDWIDE SHIPPING</span>
                    </div>
                    <div class="size-guide-toggle" id="sg-toggle">SIZE GUIDE</div>
                    <div class="size-guide-table" id="sg-table" style="display:none;">
                        <table>
                            <thead><tr><th></th><th>S</th><th>M</th><th>L</th><th>XL</th><th>2XL</th></tr></thead>
                            <tbody>
                                <tr><td>身幅</td><td>50</td><td>53</td><td>56</td><td>59</td><td>62</td></tr>
                                <tr><td>着丈</td><td>67</td><td>70</td><td>73</td><td>76</td><td>79</td></tr>
                                <tr><td>袖丈</td><td>60</td><td>62</td><td>64</td><td>66</td><td>68</td></tr>
                            </tbody>
                        </table>
                        <div class="size-guide-note">※ cm表記 · 個体差±2cm</div>
                    </div>
                    <div class="stripe-badge">${modalCheckoutReady ? 'Secure Checkout · Stripe' : 'チェックアウト準備中'}</div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(m);

    // サイズ選択
    let selectedSize = initialSize;
    m.querySelectorAll('.size-btn').forEach(btn => {
        if (btn.disabled) return;
        btn.addEventListener('click', () => {
            m.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedSize = btn.dataset.size;
        });
    });

    // 2026-05-21 P3 段階1.7: モーダルの ADD TO CART にも三層アニメ統合
    //   司さん「カート入れた時のアニメーションない」発覚: ユーザは modal の pm-cart を押していた
    //   カードの addToCartFromCard と同じ三層構造をここにも適用
    document.getElementById('pm-cart').addEventListener('click', () => {
        var demoMode = /[?&]demo=1/.test(location.search);
        var checkoutStatus = getCheckoutStatus(p, selectedSize);
        if (!checkoutStatus.available && !demoMode) {
            showCartToast(p.name + ' は ' + checkoutStatus.message);
            return;
        }
        var vid = (p.shopifyVariants && p.shopifyVariants[selectedSize]) || '';
        CART.add(p.id, selectedSize, p.priceNum, p.name, vid);
        if (demoMode && !checkoutStatus.available) {
            showCartToast('[DEMO] ' + p.name + ' (' + selectedSize + ') アニメ確認モード');
        } else {
            showCartToast(`${p.name} (${selectedSize}) をカートに追加しました`);
        }

        var cartEl = document.getElementById('cart-icon');
        var pmBtn  = document.getElementById('pm-cart');
        var hasGsap = typeof window.gsap !== 'undefined';

        if (!hasGsap || !cartEl || !pmBtn) {
            // フォールバック: 旧 spawnBigBang のみ
            if (pmBtn) {
                var cr = pmBtn.getBoundingClientRect();
                spawnBigBang(cr.left + cr.width / 2, cr.top + cr.height / 2, 12);
            }
            return;
        }

        // 第3層: ghost flight (modal の商品画像 or pm-cart ボタン位置から)
        var modalImg = m.querySelector('.product-modal-image img, .product-modal img') || pmBtn;
        var srcRect = modalImg.getBoundingClientRect();
        var dstRect = cartEl.getBoundingClientRect();
        var ghost = modalImg.cloneNode(true);
        ghost.removeAttribute('id');
        ghost.style.cssText =
            'position:fixed;' +
            'left:' + srcRect.left + 'px;top:' + srcRect.top + 'px;' +
            'width:' + srcRect.width + 'px;height:' + srcRect.height + 'px;' +
            'margin:0;padding:0;pointer-events:none;z-index:2147482000;' +
            'transition:none;will-change:transform,opacity;' +
            'border-radius:12px;overflow:hidden;' +
            'box-shadow:0 0 24px rgba(255,255,255,.45),0 0 48px rgba(255,80,200,.25);';
        document.body.appendChild(ghost);
        var dx = (dstRect.left + dstRect.width  / 2) - (srcRect.left + srcRect.width  / 2);
        var dy = (dstRect.top  + dstRect.height / 2) - (srcRect.top  + srcRect.height / 2);

        var tl = window.gsap.timeline({
            onComplete: function() {
                try { ghost.remove(); } catch (e) {}
                spawnBigBang(dstRect.left + dstRect.width / 2, dstRect.top + dstRect.height / 2, 14);
            }
        });
        tl.to(ghost, {
            x: dx, y: dy, scale: 0.18, rotation: 24, opacity: 0.85,
            duration: 0.62, ease: 'power3.in'
        }, 0);
        tl.to(ghost, { opacity: 0, duration: 0.12, ease: 'power1.in' }, 0.5);

        // 第1+2層: ロゴ球 u_clickT pulse
        try {
            var logoRef = window._p3LogoSphere3D;
            if (logoRef && logoRef.uniforms && logoRef.uniforms.u_clickT) {
                tl.to(logoRef.uniforms.u_clickT, {
                    value: 1, duration: 0.18, ease: 'expo.out', yoyo: true, repeat: 1
                }, 0);
            }
        } catch (e) {}

        // Badge punch
        var badge = document.getElementById('cart-badge') || cartEl.querySelector('.cart-badge');
        if (badge) {
            tl.fromTo(badge,
                { scale: 1.0 },
                { scale: 1.55, duration: 0.16, ease: 'back.out(3)', yoyo: true, repeat: 1 },
                0.46);
        }

        // pm-cart ボタン feedback
        tl.to(pmBtn, { scale: 0.94, duration: 0.10, ease: 'power2.out', yoyo: true, repeat: 1 }, 0);
    });

    // サイズガイド展開
    document.getElementById('sg-toggle').addEventListener('click', function() {
        var table = document.getElementById('sg-table');
        table.style.display = table.style.display === 'none' ? 'block' : 'none';
    });

    // 閉じる（modal-closing クラスで退場アニメーション → 300ms後にDOM除去）
    const closeModal = () => {
        m.classList.remove('modal-visible');
        m.classList.add('modal-closing');
        setTimeout(() => m.remove(), 300);
    };
    document.getElementById('pm-close').addEventListener('click', closeModal);
    document.getElementById('pm-overlay').addEventListener('click', closeModal);
    setTimeout(() => m.classList.add('modal-visible'), 10);

    // Accessibility: ESC to close
    function onEsc(e) { if (e.key === 'Escape') { closeModal(); window.removeEventListener('keydown', onEsc); } }
    window.addEventListener('keydown', onEsc);
    // Focus first interactive element
    setTimeout(() => { const firstBtn = m.querySelector('.size-btn, .product-close-btn'); if(firstBtn) firstBtn.focus(); }, 100);
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

// ═══ BOLERO removed ═══

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
