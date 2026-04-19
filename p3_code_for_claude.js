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
// 司さんがStorefront APIトークン取得後に設定
const SHOPIFY_CONFIG = {
    storeDomain: '0xi10h-x1.myshopify.com',
    storefrontToken: 'ce0dc399245e874fd85d218df2d9bb04', // Dev Dashboard クライアントID
    apiVersion: '2024-10' // 2026-04 は存在しない。実 API バージョンに修正
};

// ═══ GELATO POD API CONFIG (Print-on-Demand) ═══
// 各商品の gelato_product に bella_canvas_3001 等の UID が記録済み
// サーバー側 /api/gelato/order に API キーを隠蔽して中継する方式
const GELATO_CONFIG = {
    apiEndpoint: '/api/gelato/order',
    enabled: false  // 司さんが API キー設定後に true に
};

// Gelato productUid テンプレートから size を展開
function gelatoBuildUid(template, size) {
    if (!template || !size) return null;
    return template.replace('{size}', size.toLowerCase());
}

function gelatoCreateOrder(cartItems, shipping) {
    if (!GELATO_CONFIG.enabled) return Promise.reject(new Error('Gelato not configured'));
    var items = cartItems.map(function(it) {
        var p = PRODUCTS.find(function(x) { return x.id === it.id; });
        var uid = p && p.gelato_product ? gelatoBuildUid(p.gelato_product, it.size) : null;
        return {
            productUid: uid,
            size: it.size,
            quantity: it.qty || 1,
            printFile: p && p.image ? (location.origin + '/' + p.image) : null
        };
    }).filter(function(x) { return x.productUid && x.printFile; });
    return fetch(GELATO_CONFIG.apiEndpoint, {
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
    {
        id: 'enter-hoodie',
        name: 'ENTER HOODIE',
        price: '¥12,800',
        priceNum: 12800,
        image: 'public/enter_hoodie.png',
        description: 'EXIT is not the only option. ENTER the unknown.',
        details: 'Heavyweight 400gsm · Oversized Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Washed Black',
        gelato_product: 'apparel_product_gca_hoodie_gsc_pullover_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_independent_ss4500',
        isQRT: false,
        shopifyVariants: {} // { 'S': 'gid://shopify/ProductVariant/xxx', 'M': 'gid://...', ... }
    },
    {
        id: 'logo-hoodie',
        name: 'inryokü LOGO HOODIE',
        price: '¥12,800',
        priceNum: 12800,
        image: 'public/info_logo_hoodie.png',
        description: 'The origin point. Grey contains every color — you just have to look.',
        details: 'Heavyweight 400gsm · Oversized Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Washed Black',
        gelato_product: 'apparel_product_gca_hoodie_gsc_pullover_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_independent_ss4500',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'enter-hoodie-white',
        name: 'ENTER HOODIE — GREY',
        price: '¥12,800',
        priceNum: 12800,
        image: 'public/enter_hoodie.png',
        description: 'The same door, different light. Grey is not absence — it is everything at once.',
        details: 'Heavyweight 400gsm · Oversized Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Heather Grey',
        gelato_product: 'apparel_product_gca_hoodie_gsc_pullover_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_independent_ss4500',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'logo-hoodie-oversized',
        name: 'inryokü LOGO OVERSIZED',
        price: '¥14,800',
        priceNum: 14800,
        image: 'public/info_logo_hoodie.png',
        description: '101% oversized. When you stop fitting in, you start standing out.',
        details: 'Heavyweight 450gsm · Ultra Oversized · DTF Print (50+ washes)',
        sizes: ['M', 'L', 'XL', '2XL', '3XL'],
        color: 'Washed Black',
        gelato_product: 'apparel_product_gca_hoodie_gsc_pullover_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_independent_ss4500',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'enter-tee',
        name: 'ENTER TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'public/enter_hoodie.png',
        description: 'Lightweight signal. The door is always open.',
        details: '200gsm · Regular Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        gelato_product: 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_bella-and-canvas_3003',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'logo-tee',
        name: 'inryokü LOGO TEE',
        price: '¥8,800',
        priceNum: 8800,
        image: 'public/info_logo_hoodie.png',
        description: 'The mark. Minimal outside, infinite inside.',
        details: '200gsm · Regular Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        gelato_product: 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_bella-and-canvas_3003',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'enter-longsleeve',
        name: 'ENTER LONG SLEEVE',
        price: '¥9,800',
        priceNum: 9800,
        image: 'public/enter_hoodie.png',
        description: 'Long reach into the unknown. Every sleeve tells a story.',
        details: '220gsm · Regular Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        gelato_product: 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_bella-and-canvas_3003',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'logo-longsleeve',
        name: 'inryokü LOGO LONG SLEEVE',
        price: '¥9,800',
        priceNum: 9800,
        image: 'public/info_logo_hoodie.png',
        description: 'Extended wavelength. The signal carries further.',
        details: '220gsm · Regular Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Black',
        gelato_product: 'apparel_product_gca_t-shirt_gsc_crewneck_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_bella-and-canvas_3003',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'enter-crewneck',
        name: 'ENTER CREWNECK',
        price: '¥11,800',
        priceNum: 11800,
        image: 'public/enter_hoodie.png',
        description: 'No hood, no hiding. Face the door head-on.',
        details: '360gsm · Oversized Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Washed Black',
        gelato_product: 'apparel_product_gca_sweatshirt_gsc_crewneck_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_champion_s1049',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'logo-crewneck',
        name: 'inryokü LOGO CREWNECK',
        price: '¥11,800',
        priceNum: 11800,
        image: 'public/info_logo_hoodie.png',
        description: 'Clean orbit. The symbol speaks without shouting.',
        details: '360gsm · Oversized Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        color: 'Washed Black',
        gelato_product: 'apparel_product_gca_sweatshirt_gsc_crewneck_gcu_mens_gqa_prm_gsi_{size}_gco_black_gpr_4-0_champion_s1049',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'enter-tank',
        name: 'ENTER TANK TOP',
        price: '¥6,800',
        priceNum: 6800,
        image: 'public/enter_hoodie.png',
        description: 'Stripped down. Pure signal, zero noise.',
        details: '180gsm · Regular Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Black',
        gelato_product: 'apparel_product_gca_t-shirt_gsc_tank-top_gcu_unisex_gqa_prm_gsi_{size}_gco_black_gpr_4-0_comfort-colours_9360',
        isQRT: false,
        shopifyVariants: {}
    },
    {
        id: 'logo-tank',
        name: 'inryokü LOGO TANK TOP',
        price: '¥6,800',
        priceNum: 6800,
        image: 'public/info_logo_hoodie.png',
        description: 'Bare minimum, maximum frequency.',
        details: '180gsm · Regular Fit · DTF Print (50+ washes)',
        sizes: ['S', 'M', 'L', 'XL'],
        color: 'Black',
        gelato_product: 'apparel_product_gca_t-shirt_gsc_tank-top_gcu_unisex_gqa_prm_gsi_{size}_gco_black_gpr_4-0_comfort-colours_9360',
        isQRT: false,
        shopifyVariants: {}
    }
];

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
}

// ═══ 3Dロゴ球体（PNGを置き換え） ═══
// Three.js SphereGeometry + カスタムシェーダー
// 虹色ニュートンリング + フレネル + 回転 + 脈動
function init3DLogoSphere() {
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
    renderer.setSize(size * 2, size * 2);
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
            if (p6bgm) p6bgm.volume = p * BGM_TARGET;
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
              return `<div class="carousel-item" data-idx="${i}" id="product-${p.id}" style="transform: rotateY(${angle}deg) translateZ(240px);">
                <div class="product-card-img">
                  <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.parentNode.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:32px;color:rgba(255,255,255,0.15);font-family:monospace;\\'>${p.name.charAt(0)}</div>'">
                </div>
                <div class="product-card-info">
                  <div class="product-card-name">${p.name}</div>
                  <div class="product-card-price">${p.price}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;

    root.innerHTML = `
        <canvas id="pu-cv" style="display:none;"></canvas>
    <div class="singularity-content" style="position:relative;z-index:5;pointer-events:auto;">
        <div class="hologram-logo" style="opacity:0;" id="holo-logo-wrap">
            <div class="brand-name p6-logo-text">
                <span class="brand-char" style="color:#808080;opacity:0;">i</span><span class="brand-char" style="color:#FF0000;opacity:0;">n</span><span class="brand-char" style="color:#00FF00;opacity:0;">r</span><span class="brand-char" style="color:#0044FF;opacity:0;">y</span><span class="brand-char" style="color:#00FFFF;opacity:0;">o</span><span class="brand-char" style="color:#FF00FF;opacity:0;">k</span><span class="brand-char" style="color:#FFFF00;opacity:0;">ü</span>
            </div>
            <div class="logo-holo-wrap" id="bb-logo" style="cursor:pointer;opacity:0;">
                <img src="logo_shell.png" alt="" class="logo-shell" style="opacity:0;">
                <img src="logo_sphere.png" alt="" class="logo-sphere" style="opacity:0;animation:none;">
                <div class="holo-scanlines"></div>
                <div class="holo-overlay"></div>
                <div class="holo-scanline"></div>
            </div>
        </div>

        <div class="item-grid" style="opacity:0;transition:opacity 1.2s ease;">
            ${productCardsHTML}
        </div>

    </div>`;


    console.log('[Phase 3] DOM setup complete, initializing particle universe...');
    // 同期呼び出し（rAFだとバックグラウンドタブや競合で不発になるケースがある）
    try {
        initParticleUniverse();
        console.log('[Phase 3] Particle universe initialized successfully');
    } catch(e) {
        console.error('[Phase 3] initParticleUniverse error:', e);
    }

    // ── 「間」の演出: 真っ暗→5秒後にリビール開始（ラッパー表示は子要素リセット後） ──
    // 旧: 3秒でラッパーfadeIn→5秒でリビール → 2秒間子要素が一瞬見えるバグあり
    // 修正: ラッパー表示をinitBrandParticleReveal内に統合
    setTimeout(initBrandParticleReveal, 5000);

    // ── 3Dホログラムロゴ球体（ShaderMaterial）を起動 ──
    // brand reveal 完了後、PNG sphere を Three.js sphere に置換
    setTimeout(function() {
        try { init3DLogoSphere(); } catch(e) { console.warn('[3DLogo] init failed:', e); }
    }, 7500);

    // ── ストアグリッド制御 ──
    initStoreGrid();

    // ── カートアイコン（フローティング） ──
    const cartIcon = document.createElement('div');
    cartIcon.id = 'cart-icon';
    cartIcon.innerHTML = `<span style="font-size:20px;">🛒</span><span id="cart-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#ff0055;color:#fff;font-size:10px;min-width:16px;height:16px;border-radius:50%;align-items:center;justify-content:center;font-family:monospace;">0</span>`;
    cartIcon.style.cssText = 'position:fixed;top:20px;right:20px;z-index:1000;cursor:pointer;padding:10px;background:rgba(255,255,255,0.08);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:12px;opacity:0;transition:opacity 1.2s ease;pointer-events:none;';
    cartIcon.addEventListener('click', function() { showCartDrawer(); });
    document.body.appendChild(cartIcon);
    CART.updateBadge();

    // ── ミュートボタン ──
    // ミュート状態を維持（P1で設定された_inryokuMutedを引き継ぐ）
    if (window._inryokuMuted === undefined) window._inryokuMuted = true;
    const muteBtn = document.createElement('div');
    muteBtn.id = 'mute-btn';
    muteBtn.innerHTML = window._inryokuMuted ? '<span style="font-size:16px;">🔇</span>' : '<span style="font-size:16px;">🔊</span>';
    muteBtn.style.cssText = 'position:fixed;top:20px;right:75px;z-index:1000;cursor:pointer;padding:10px;background:rgba(255,255,255,0.08);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:12px;opacity:0;pointer-events:none;transition:opacity 1.2s ease;';
    muteBtn.addEventListener('click', function() {
        window._inryokuMuted = !window._inryokuMuted;
        muteBtn.innerHTML = window._inryokuMuted
            ? '<span style="font-size:16px;">🔇</span>'
            : '<span style="font-size:16px;">🔊</span>';
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

    // ── Email Signup ──
    const emailSignup = document.createElement('div');
    emailSignup.className = 'email-signup';
    emailSignup.id = 'email-signup';
    emailSignup.style.cssText = 'opacity:0;transition:opacity 1.2s ease;';
    emailSignup.innerHTML = `
        ${buildParticles()}
        <div class="email-signup-label">DROP NOTIFICATION</div>
        <div class="email-signup-sub">新作・限定ドロップの通知を受け取る</div>
        <div class="email-signup-row">
            <input type="email" id="email-input" placeholder="your@email.com" class="email-signup-input">
            <button id="email-submit" class="email-signup-btn">→</button>
        </div>
        <div class="email-signup-status" id="email-status"></div>
    `;
    const scContentForEmail = document.querySelector('.singularity-content');
    if (scContentForEmail) { scContentForEmail.appendChild(emailSignup); }

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
            .then(function() {
                // メール欄中心からビッグバン
                var emailEl = document.getElementById('email-signup');
                if (emailEl) {
                    var er = emailEl.getBoundingClientRect();
                    spawnBigBang(er.left + er.width / 2, er.top + er.height / 2, 30);
                }
                status.textContent = '✓ 登録完了';
                status.style.color = 'rgba(100,255,150,0.6)';
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
    contactForm.innerHTML = `
        <div class="contact-toggle" id="contact-toggle">CONTACT</div>
        <div class="contact-body" id="contact-body" style="display:none;">
            <input type="text" id="contact-name" placeholder="Name" class="contact-input">
            <input type="email" id="contact-email" placeholder="Email" class="contact-input">
            <textarea id="contact-msg" placeholder="Message" class="contact-textarea" rows="3"></textarea>
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
    });

    // 問い合わせ送信
    document.getElementById('contact-submit').addEventListener('click', function() {
        var name = document.getElementById('contact-name').value.trim();
        var email = document.getElementById('contact-email').value.trim();
        var msg = document.getElementById('contact-msg').value.trim();
        var status = document.getElementById('contact-status');
        if (!name || !email || !msg) {
            status.textContent = '全項目を入力してください';
            status.style.color = 'rgba(255,100,100,0.6)';
            return;
        }
        status.textContent = '送信中...';
        status.style.color = 'rgba(255,255,255,0.4)';
        fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, email: email, message: msg })
        })
        .then(function(res) {
            if (!res.ok) throw new Error('送信に失敗しました');
            return res.json();
        })
        .then(function() {
            spawnBigBang(window.innerWidth / 2, window.innerHeight / 2, 25);
            status.textContent = '✓ 送信完了';
            status.style.color = 'rgba(100,255,150,0.6)';
        })
        .catch(function(err) {
            status.textContent = err.message || 'エラーが発生しました';
            status.style.color = 'rgba(255,100,100,0.6)';
        });
    });

    // ── OSテーマスイッチャー ──
    const themeSwitcher = document.createElement('div');
    themeSwitcher.className = 'theme-switcher';
    themeSwitcher.id = 'theme-switcher';
    themeSwitcher.style.cssText = 'opacity:0;transition:opacity 1.2s ease;';
    themeSwitcher.innerHTML = `
        <div class="theme-label">THEME</div>
        <div class="theme-buttons">
            <button class="theme-btn theme-btn--active" data-theme="cosmos" title="Cosmos">✦</button>
            <button class="theme-btn" data-theme="mac" title="macOS"></button>
            <button class="theme-btn" data-theme="win95" title="Windows 95">⊞</button>
        </div>
    `;
    var scContentForTheme = document.querySelector('.singularity-content');
    if (scContentForTheme) { scContentForTheme.appendChild(themeSwitcher); }

    // テーマ切替ロジック（カードスキンも連動）
    var THEME_SKIN_MAP = { cosmos: 'glass', mac: 'mac-system1', win95: 'win95' };
    function applyThemeSkin(theme) {
        document.body.setAttribute('data-theme', theme);
        var skin = THEME_SKIN_MAP[theme] || 'glass';
        // 全カードの data-skin 属性更新
        document.querySelectorAll('.carousel-item').forEach(function(c) {
            c.classList.remove('mac-system1','mac-os9','mac-imacg3','mac-apple2','win95-skin');
            if (skin === 'mac-system1') c.classList.add('mac-system1');
            if (skin === 'win95') c.classList.add('win95-skin');
        });
        // イースターエッグ解放済みスキンがあれば優先
        var layers = JSON.parse(localStorage.getItem('inryoku.layers') || '[]');
        if (layers.length && theme === 'mac') {
            var active = layers[layers.length - 1];
            document.querySelectorAll('.carousel-item').forEach(function(c) {
                c.classList.remove('mac-system1');
                c.classList.add('mac-' + active);
            });
        }
    }
    themeSwitcher.querySelectorAll('.theme-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var theme = btn.dataset.theme;
            applyThemeSkin(theme);
            themeSwitcher.querySelectorAll('.theme-btn').forEach(function(b) { b.classList.remove('theme-btn--active'); });
            btn.classList.add('theme-btn--active');
        });
    });

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
            var messages = { os9: '// observer detected: layer 1', imacg3: '// you saw the grey: layer 2', apple2: '// 101%: the origin' };
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
    var currentAngle = 0;
    var autoRotateSpeed = 0.08; // deg per frame
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
        var normAngle = ((currentAngle % 360) + 360) % 360;
        var bestIdx = 0;
        var bestDist = 999;

        items.forEach(function(item, i) {
            var itemAngle = ((i * sliceAngle + currentAngle) % 360 + 360) % 360;
            if (itemAngle > 180) itemAngle -= 360;
            var absDist = Math.abs(itemAngle);

            if (absDist < bestDist) {
                bestDist = absDist;
                bestIdx = i;
            }

            if (absDist < sliceAngle * 0.6) {
                item.classList.add('carousel-front');
                item.style.filter = 'brightness(1.3)';
            } else {
                item.classList.remove('carousel-front');
                var dimAmount = Math.min(absDist / 180, 0.7);
                item.style.filter = 'brightness(' + (1 - dimAmount * 0.6).toFixed(2) + ')';
            }
        });

        // タイプライター演出（正面が変わった時のみ）
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

    // ── ホバーで停止 + 前に出る ──
    var isHovering = false;
    items.forEach(function(card) {
        card.style.cursor = 'pointer';
        card.style.transition = 'filter 0.3s ease, transform 0.4s cubic-bezier(0.23,1,0.32,1)';

        card.addEventListener('mouseenter', function() {
            isHovering = true;
            velocity = 0;
            // そのカードが正面に来る角度を計算
            var idx = parseInt(card.dataset.idx);
            var targetAngle = -(360 / count) * idx;
            // 最短距離で回転
            var diff = targetAngle - currentAngle;
            diff = ((diff % 360) + 540) % 360 - 180;
            var dest = currentAngle + diff;
            // スムーズにアニメーション
            ring.style.transition = 'transform 0.5s cubic-bezier(0.23,1,0.32,1)';
            currentAngle = dest;
            ring.style.transform = 'rotateY(' + dest + 'deg)';
            // カードを前に出す
            var angle = (360 / count) * idx;
            card.style.transform = 'rotateY(' + angle + 'deg) translateZ(290px) scale(1.15)';
            card.style.filter = 'brightness(1.4)';
            card.style.zIndex = '20';
        });

        card.addEventListener('mouseleave', function() {
            isHovering = false;
            // transitionを戻す
            ring.style.transition = 'none';
            // カードを元に戻す
            var idx = parseInt(card.dataset.idx);
            var angle = (360 / count) * idx;
            card.style.transform = 'rotateY(' + angle + 'deg) translateZ(240px) scale(1)';
            card.style.filter = '';
            card.style.zIndex = '';
        });

        card.addEventListener('click', function(e) {
            if (isDragging || dragMoved) return;
            spawnBigBang(e.clientX, e.clientY, 15);
            var idx = parseInt(card.dataset.idx);
            showProductModal(idx);
        });
    });

    // ── メインループ（自動回転 + 慣性 + 正面検出） ──
    function tick() {
        if (!isDragging && !isHovering) {
            if (Math.abs(velocity) > 0.01) {
                // 最大速度制限
                if (velocity > 1.5) velocity = 1.5;
                if (velocity < -1.5) velocity = -1.5;
                currentAngle += velocity;
                velocity *= 0.92;
            } else {
                velocity = 0;
                currentAngle -= autoRotateSpeed;
            }
        }

        ring.style.transform = 'rotateY(' + currentAngle + 'deg)';

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
        currentAngle = dragAngle + dx * 0.15;

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
        currentAngle = dragAngle + dx * 0.15;
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

// ── カードからカートに追加 ──
function addToCartFromCard(idx) {
    var p = PRODUCTS[idx];
    if (!p) return;
    var card = document.getElementById('product-' + p.id);
    var selectedBtn = card ? card.querySelector('.size-btn.selected') : null;
    var size = selectedBtn ? selectedBtn.dataset.size : (p.sizes.length > 1 ? p.sizes[1] : p.sizes[0]);
    var variantId = (p.shopifyVariants && p.shopifyVariants[size]) || '';
    CART.add(p.id, size, p.priceNum, p.name, variantId);
    // カートアイコンからビッグバン
    var cartEl = document.getElementById('cart-icon');
    if (cartEl) {
        var cr = cartEl.getBoundingClientRect();
        spawnBigBang(cr.left + cr.width / 2, cr.top + cr.height / 2, 12);
    }
    // トースト通知
    var toast = document.createElement('div');
    toast.className = 'cart-toast';
    toast.textContent = p.name + ' (' + size + ') をカートに追加しました';
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.remove(); }, 300); }, 2000);
    // ボタンのフィードバック
    var btn = card ? card.querySelector('.add-btn') : null;
    if (btn) {
        btn.textContent = '✓ ADDED';
        btn.style.background = 'rgba(0,255,100,0.2)';
        setTimeout(function() { btn.textContent = 'ADD TO CART'; btn.style.background = ''; }, 1500);
    }
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
        bgm.volume = startVol + (targetVol - startVol) * p;
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
        bgm.volume = startVol + (targetVol - startVol) * p;
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

    // ── 全要素初期非表示（子要素をリセットしてからラッパーを表示） ──
    if (prismLine)  { prismLine.style.opacity = '0'; prismLine.style.transition = 'none'; }
    if (logoWrap)   { logoWrap.style.opacity  = '0'; logoWrap.style.transition  = 'none'; }
    if (logoShell)  { logoShell.style.animation = 'none'; logoShell.style.opacity = '0'; logoShell.style.transition = 'none'; }
    if (logoSphere) { logoSphere.style.animation = 'none'; logoSphere.style.opacity = '0'; logoSphere.style.transition = 'none'; }
    chars.forEach(function(ch, idx) {
        ch.style.opacity = '0';
        ch.style.color = '#808080';
        ch.style.textShadow = '0 0 15px rgba(128,128,128,0.6), 0 0 30px rgba(128,128,128,0.2)';
        ch.style.transform = idx === 0 ? 'scaleX(-1) scaleY(1.5) translateY(20px)' : 'scaleY(1.5) scaleX(0.8) translateY(20px)';
        ch.style.filter = 'brightness(2)';
        ch.style.transition = 'none';
        ch.style.display = 'inline-block';
    });

    // ── 子要素リセット完了 → ラッパーを表示（中身は全てopacity:0なので何も見えない） ──
    var holoWrap = document.getElementById('holo-logo-wrap');
    if (holoWrap) { holoWrap.style.transition = 'none'; holoWrap.style.opacity = '1'; }
    // logoWrapも表示
    if (logoWrap) { logoWrap.style.opacity = '1'; logoWrap.style.transition = 'none'; }

    // ═══════════════════════════════════════════
    //  STEP 1: 球体コアが深淵から実体化（0ms〜）
    //  暗闇の中心にまず微かな光点 → 脈動しながら拡大 → 完全実体化
    // ═══════════════════════════════════════════
    if (logoSphere) {
        logoSphere.style.filter = 'drop-shadow(0 0 4px rgba(255,255,255,0.2)) brightness(0.05) saturate(0)';
        logoSphere.style.opacity = '0';
        logoSphere.style.transform = 'scale(0.3)';
    }
    // 第一波: 微かな光点が出現（ゆっくり）
    setTimeout(function() {
        if (logoSphere) {
            logoSphere.style.transition = 'opacity 2.5s ease-in, filter 3.0s ease, transform 3.0s cubic-bezier(0.16,1,0.3,1)';
            logoSphere.style.opacity = '0.4';
            logoSphere.style.transform = 'scale(0.7)';
            logoSphere.style.filter = 'drop-shadow(0 0 8px rgba(128,128,128,0.6)) brightness(0.3) saturate(0)';
        }
    }, 300);
    // 第二波: グレーから色が滲み出す（グレーの中に虹がある）
    setTimeout(function() {
        if (logoSphere) {
            logoSphere.style.transition = 'opacity 2.0s ease, filter 2.5s ease, transform 2.5s cubic-bezier(0.16,1,0.3,1)';
            logoSphere.style.opacity = '0.8';
            logoSphere.style.transform = 'scale(0.9)';
            logoSphere.style.filter = 'drop-shadow(0 0 15px rgba(0,255,255,0.4)) drop-shadow(0 0 30px rgba(255,0,255,0.2)) brightness(0.6) saturate(0.5)';
        }
    }, 1600);
    // 第三波: 完全実体化 — 彩度が戻り、光が満ちる
    setTimeout(function() {
        if (logoSphere) {
            logoSphere.style.transition = 'filter 2.5s ease, transform 2.0s ease, opacity 1.5s ease';
            logoSphere.style.opacity = '1';
            logoSphere.style.transform = 'scale(1.0)';
            logoSphere.style.filter = '';
        }
    }, 2200);

    // シェル(0+1)は初期非表示のまま — ブランド名の後にホログラムで出す

    // ═══════════════════════════════════════════
    //  STEP 2: 球体から光が放たれてブランドネームへ（2500ms〜）
    //  球体実体化後すぐに光を放射
    // ═══════════════════════════════════════════
    var LIGHT_START = 3200;  // 球体実体化後、少し間を置いてから（ゆっくり）
    var LIGHT_DELAY = 280;   // 文字間ディレイ（ゆっくり）
    var FLIGHT_MS   = 1400;  // 光の飛行時間（ゆっくり）

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

            // 光粒子（コア + トレイル）
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
                    // シアンで出現（translateYからの浮上 + スケール補正）
                    ch.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
                    ch.style.opacity = '0.7';
                    ch.style.transform = 'scaleY(1.1) scaleX(0.95) translateY(0px)';

                    // ちらつき
                    setTimeout(function() {
                        ch.style.transition = 'opacity 0.05s';
                        ch.style.opacity = '0.15';
                    }, 150);

                    // シアン再出現
                    setTimeout(function() {
                        ch.style.transition = 'opacity 0.1s, transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
                        ch.style.opacity = '0.85';
                        ch.style.transform = 'scaleY(1.0) scaleX(1.0) translateY(0px)';
                        ch.style.filter = 'brightness(1.5)';
                    }, 230);

                    // 本来の色に変わる
                    setTimeout(function() {
                        ch.style.transition = 'color 0.6s cubic-bezier(0.23, 1, 0.32, 1), text-shadow 0.6s ease, filter 0.6s ease, opacity 0.6s ease';
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
    //  STEP 3: ブランド名完了後 → シェル(0+1)ホログラム登場
    // ═══════════════════════════════════════════
    var allDoneTime = LIGHT_START + (chars.length - 1) * LIGHT_DELAY + FLIGHT_MS + 800;

    setTimeout(function() {
        container.remove();

        // ── シェル(0+1)がホログラムで投影される ──
        if (logoShell) {
            logoShell.style.opacity = '0';
            logoShell.style.transform = 'scale(0.3) rotateY(90deg)';
            logoShell.style.filter = 'brightness(3) saturate(0) hue-rotate(180deg)';

            // フェーズ1: ゴーストのように薄く出現
            setTimeout(function() {
                logoShell.style.transition = 'opacity 0.8s ease-in, transform 1.5s cubic-bezier(0.16,1,0.3,1), filter 1.2s ease';
                logoShell.style.opacity = '0.2';
                logoShell.style.transform = 'scale(0.7) rotateY(30deg)';
                logoShell.style.filter = 'brightness(2.5) saturate(0) hue-rotate(120deg)';
            }, 100);

            // フェーズ2: グリッチフリッカー
            setTimeout(function() {
                logoShell.style.transition = 'opacity 0.03s, transform 0.03s';
                logoShell.style.opacity = '0.02';
                logoShell.style.transform = 'scale(0.7) rotateY(30deg) translateX(5px)';
            }, 800);
            setTimeout(function() {
                logoShell.style.transition = 'opacity 0.03s, transform 0.03s';
                logoShell.style.opacity = '0.5';
                logoShell.style.transform = 'scale(0.85) rotateY(-10deg) translateX(-3px)';
            }, 860);
            setTimeout(function() {
                logoShell.style.transition = 'opacity 0.03s, transform 0.03s';
                logoShell.style.opacity = '0.1';
                logoShell.style.transform = 'scale(0.9) rotateY(5deg) translateX(2px)';
            }, 920);

            // フェーズ3: 安定化 — 完全実体化
            setTimeout(function() {
                logoShell.style.transition = 'opacity 1.0s ease, transform 1.2s cubic-bezier(0.16,1,0.3,1), filter 1.5s ease';
                logoShell.style.opacity = '0.7';
                logoShell.style.transform = 'scale(1.0) rotateY(0deg)';
                logoShell.style.filter = '';
            }, 980);

            // CSSアニメーションへ移行
            setTimeout(function() {
                logoShell.style.transition = 'opacity 0.8s ease';
                logoShell.style.opacity = '';
                logoShell.style.transform = '';
                setTimeout(function() {
                    if (logoShell) { logoShell.style.transition = ''; logoShell.style.animation = ''; }
                }, 900);
            }, 2200);
        }

        // ── シグネチャーサウンド（シェル出現の瞬間から — ジュピター風ファンファーレ） ──
        // ゴースト出現(100ms)と同時に「ジャーン」、グリッチ(800ms)で「ジャジャジャ」、安定化(980ms)で「ジャン！」
        setTimeout(function() {
            playSignatureSound();
        }, 100);

        // ── STEP 4: プリズムライン + 商品カード + 球体ビーコン ──
        setTimeout(function() {
            if (prismLine) { prismLine.style.transition = 'opacity 1s ease'; prismLine.style.opacity = '1'; }
            setTimeout(function() {
                var itemGrid = document.querySelector('.item-grid');
                if (itemGrid) itemGrid.style.opacity = '1';
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
    const N = isMobile ? 3000 : 8000;

    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const aSizes = new Float32Array(N);
    const aPhases = new Float32Array(N);

    const PALETTE = [
        [1, 0, 0], [0, 1, 0], [0, 0, 1],
        [0, 1, 1], [1, 0, 1], [1, 1, 0],
        [1, 1, 1]
    ];

    // ★ シード付き乱数で「全員違う宇宙」を生成
    for (let i = 0; i < N; i++) {
        // 球状に均等分布（シード依存）
        const r = 80 + uRng() * 400;
        const theta = uRng() * Math.PI * 2;
        const phi = Math.acos(2 * uRng() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        // RGBCMY+White（シード依存 — 宇宙ごとに色の比率が違う）
        const c = PALETTE[Math.floor(uRng() * 7)];
        colors[i * 3] = c[0];
        colors[i * 3 + 1] = c[1];
        colors[i * 3 + 2] = c[2];

        // サイズバラつき（シード依存）
        const sR = uRng();
        if (sR < 0.03) aSizes[i] = 12.0 + uRng() * 8.0;
        else if (sR < 0.10) aSizes[i] = 6.0 + uRng() * 6.0;
        else if (sR < 0.30) aSizes[i] = 3.0 + uRng() * 3.0;
        else if (sR < 0.55) aSizes[i] = 1.5 + uRng() * 2.0;
        else aSizes[i] = 0.3 + uRng() * 1.5;

        // 呼吸フェーズ（シード依存）
        aPhases[i] = uRng() * Math.PI * 2;
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
        uniforms: {
            uTime: { value: 0.0 },
            uAudioEnergy: { value: 0.0 }  // 音響リアクティブ: 0.0〜1.0
        },
        vertexShader: `
            attribute float aSize;
            attribute float aPhase;
            varying vec3 vColor;
            varying float vBreathe;
            varying float vDist;
            uniform float uTime;
            uniform float uAudioEnergy;

void main() {
    vColor = color;

    // 呼吸: 各粒子が独自のリズムで明滅（複数のsin波を重ねて有機的に）
    // 音楽のエネルギーが高い → 呼吸が速くなる + 振幅が大きくなる
    float audioBoost = 1.0 + uAudioEnergy * 1.5;
    float breatheSpeed = (0.34 + aPhase * 0.13) * audioBoost;
    float spatialWave = length(position) * 0.02;
    float b1 = sin(uTime * breatheSpeed + aPhase + spatialWave);
    float b2 = sin(uTime * breatheSpeed * 0.7 + aPhase * 2.3 + spatialWave * 1.5) * 0.3;
    float breatheAmp = 0.5 + uAudioEnergy * 0.3; // 音が大きい → 呼吸の振幅UP
    vBreathe = (b1 + b2) * breatheAmp * 0.5 + 0.5;

    // カメラからの距離（ニュートンリング風エフェクト用）
    vDist = length(position);

    // 呼吸に連動してサイズも変化（音が大きい → サイズ変動が大きい）
    float sizeBreath = 1.0 + vBreathe * (0.35 + uAudioEnergy * 0.4);

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    // 2026-04-19: 破損前の元サイズに戻す（480→280, min 1.4→0.5）
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
            uniform float uAudioEnergy;

void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    // 多層ガウシアン: 明るいコア + 広いグロー + ソフトヘイロー
    // 音が大きい → グローが広がる
    float audioGlow = 1.0 + uAudioEnergy * 0.6;
    float core = exp(-d * d * 28.0);
    float glow = exp(-d * d * (6.0 / audioGlow)) * (0.8 + uAudioEnergy * 0.3);
    float halo = exp(-d * d * (1.5 / audioGlow)) * (0.25 + uAudioEnergy * 0.15);
    float alpha = core + glow + halo;

    // 呼吸: 明るさが0.5〜1.0の間で変化
    float breathe = 0.5 + 0.5 * vBreathe;

    // ニュートンリング風: 距離に応じた虹色の干渉縞
    // 音が大きい → 虹の干渉が強くなる（見える色が増える）
    float ringSpeed = 0.3 + uAudioEnergy * 0.5;
    float ring = sin(vDist * 0.08 + uTime * ringSpeed) * 0.5 + 0.5;
    float rainbowStrength = 0.25 + uAudioEnergy * 0.2;
    vec3 rainbow = vec3(
        sin(ring * 6.2832) * 0.5 + 0.5,
        sin(ring * 6.2832 + 2.094) * 0.5 + 0.5,
        sin(ring * 6.2832 + 4.189) * 0.5 + 0.5
    );
    vec3 finalColor = mix(vColor, vColor + rainbow * rainbowStrength, core * 0.5);
    // コア中心を白く飛ばす（音が大きい → さらに眩しく）
    finalColor += vec3(core * (0.6 + uAudioEnergy * 0.3));
    // 2026-04-19: 破損前の輝度に戻す（1.5→1.0）
    // finalColor *= 1.5;

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
    // 60秒かけて真っ暗→全星: 最初はぽつぽつ、後半じわじわ加速（ease-in cubic）
    const SPAWN_DURATION = 60.0; // 秒
    let spawnElapsed = 0;
    geometry.setDrawRange(0, 0); // 初期: 0個表示

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
    const MAX_LINES = 5000;
    const linePositions = new Float32Array(MAX_LINES * 6);
    const lineColors = new Float32Array(MAX_LINES * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    // 星座ライン用 ShaderMaterial（距離減衰+時間明滅+音楽反応）
    const lineMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0.0 }, uAudioEnergy: { value: 0.0 } },
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
            uniform float uAudioEnergy;
            void main() {
                // 遠くのラインほど暗く
                float depthFade = clamp(1.0 - vDepth / 300.0, 0.0, 1.0);
                depthFade = depthFade * depthFade;
                // 微かな明滅（星座の瞬き）+ 音楽で脈動
                float twinkle = 0.7 + 0.3 * sin(uTime * 0.8 + vDepth * 0.05) + uAudioEnergy * 0.4;
                // 2026-04-19: 0.8→1.3 星座の繋がり視認性アップ
                float alpha = depthFade * twinkle * 1.3;
                gl_FragColor = vec4(vColor * (0.6 + depthFade * 0.4 + uAudioEnergy * 0.3), alpha);
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
            if (dz > -150 && dz < 60) {
                nearby.push(i);
            }
            if (nearby.length >= 1200) break;
        }

        let lineIdx = 0;
        const CONNECT_DIST = 110;  // 2026-04-19: 70→110 視認性UP

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

                    // 端点の色をHSL的に鮮やかに保つ: max(r,g,b)で正規化して彩度キープ
                    var ar = colArr[ia*3], ag = colArr[ia*3+1], ab = colArr[ia*3+2];
                    var br = colArr[ib*3], bg = colArr[ib*3+1], bb = colArr[ib*3+2];
                    var aBright = Math.max(ar, ag, ab, 0.3);
                    var bBright = Math.max(br, bg, bb, 0.3);
                    lineColors[li]     = (ar / aBright) * fade;
                    lineColors[li + 1] = (ag / aBright) * fade;
                    lineColors[li + 2] = (ab / aBright) * fade;
                    lineColors[li + 3] = (br / bBright) * fade;
                    lineColors[li + 4] = (bg / bBright) * fade;
                    lineColors[li + 5] = (bb / bBright) * fade;

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
        const nw = window.innerWidth || document.documentElement.clientWidth;
        const nh = window.innerHeight || document.documentElement.clientHeight;
        if (nw < 2 || nh < 2) return;
        renderer6.setSize(nw, nh);
        camera6.aspect = nw / nh;
        camera6.updateProjectionMatrix();
        if (composer6) composer6.setSize(nw, nh);
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

    // ★ ドリフトもシード依存（同じ宇宙は同じ流れ方）
    // 流れ星フラグ: 一部のパーティクルが超高速で飛ぶ
    const isShootingStar = new Uint8Array(N);
    const shootingDirX = new Float32Array(N);
    const shootingDirY = new Float32Array(N);
    var shootingStarRate = 0.008; // 全体の0.8%が流れ星

    for (let i = 0; i < N; i++) {
        if (uRng() < shootingStarRate) {
            // 流れ星: 超高速 + ランダム方向
            isShootingStar[i] = 1;
            const speed = 0.3 + uRng() * 0.8;
            driftSpeedZ[i] = speed;
            const ang = uRng() * Math.PI * 2;
            shootingDirX[i] = Math.cos(ang) * 0.15 * speed;
            shootingDirY[i] = Math.sin(ang) * 0.15 * speed;
            // 流れ星は白く明るい
            colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
            aSizes[i] = 2.0 + uRng() * 3.0;
        } else {
            isShootingStar[i] = 0;
            const isReverse = uRng() < 0.2;
            const speed = 0.00875 + uRng() * 0.045;
            driftSpeedZ[i] = isReverse ? -speed * 0.6 : speed;
            shootingDirX[i] = 0;
            shootingDirY[i] = 0;
        }
        driftFreqX[i] = 0.13 + uRng() * 0.34;
        driftFreqY[i] = 0.10 + uRng() * 0.30;
        driftAmpX[i] = 0.017 + uRng() * 0.10;
        driftAmpY[i] = 0.017 + uRng() * 0.085;
        driftPhaseX[i] = uRng() * Math.PI * 2;
        driftPhaseY[i] = uRng() * Math.PI * 2;
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
        lineMat.uniforms.uAudioEnergy.value = material.uniforms.uAudioEnergy.value;

        // ── 音響リアクティブ: AnalyserNodeからエネルギーを取得 ──
        updateAudioEnergy();
        // スムーズに追従（急変を防ぐ）
        const targetEnergy = p3AudioEnergy;
        const currentEnergy = material.uniforms.uAudioEnergy.value;
        material.uniforms.uAudioEnergy.value += (targetEnergy - currentEnergy) * 0.15;

        // ── パーティクル段階的出現（60秒: 暗闇→ぽつぽつ→加速→全星） ──
        if (visibleCount < N) {
            spawnElapsed += dt;
            // ease-in cubic: 最初はほとんど出ない → 後半一気に加速
            var t = Math.min(spawnElapsed / SPAWN_DURATION, 1.0);
            var eased = t * t * t; // cubic ease-in
            visibleCount = eased * N;
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
            else if (bigBangState === 'bb_collapse' && bigBangTimer >= 2.5) {
                bigBangState = 'bb_explode';
                bigBangTimer = 0;
                // console.log('[STATE] bb_collapse→bb_explode'); // perf: disabled
                const colArr = geometry.attributes.color.array;
                const sizeArr = geometry.attributes.aSize.array;
                const BB_COLS = [[1,0,0],[0,1,0],[0,0,1],[0,1,1],[1,0,1],[1,1,0]];
                for (let j = 0; j < N; j++) {
                    const c = BB_COLS[j % 6];
                    colArr[j*3] = c[0]; colArr[j*3+1] = c[1]; colArr[j*3+2] = c[2];
                    posArr[j*3]   = logoWX6;
                    posArr[j*3+1] = logoWY6;
                    posArr[j*3+2] = 0;
                    // ★ 爆発時にサイズを元に戻す（0のまま放出されていたバグ修正）
                    sizeArr[j] = origSizeArr ? origSizeArr[j] : 2.0;
                    const ang = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const spd = 0.5 + Math.random() * 2.0;
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
                // 色とサイズを元に戻す
                const colArr = geometry.attributes.color.array;
                for (let j = 0; j < origColArr.length; j++) colArr[j] = origColArr[j];
                geometry.attributes.color.needsUpdate = true;
                if (origSizeArr) {
                    const sizeArr = geometry.attributes.aSize.array;
                    for (let j = 0; j < N; j++) sizeArr[j] = origSizeArr[j];
                    geometry.attributes.aSize.needsUpdate = true;
                }
                removeConstellationMessage(); // 念のため
                setTimeout(() => { bigBangState = 'idle'; bbCooldownUntil = Date.now() + 5000; }, 2000);
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
                        posArr[i*3] = ringLogoX; posArr[i*3+1] = ringLogoY; posArr[i*3+2] = RING_Z;
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
                        posArr[i*3+1] = ringLogoY + Math.sin(curAngle) * curRadius * 0.45;
                        posArr[i*3+2] = RING_Z;

                        // 1-bit: 両方同じサイズ・同じ輝度（方向が違うだけ）
                        var bc = node.byteColor || [0.9,0.92,1.0];
                        var gs = node.groupScale || 1.0;
                        var bright = 0.7 * ease2 * gs;
                        colArr[i*3] = bc[0]*bright; colArr[i*3+1] = bc[1]*bright; colArr[i*3+2] = bc[2]*bright;
                        geometry.attributes.aSize.array[i] = 2.0 + 5.5 * ease2 * gs;

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
                        var breath = 1.0 + 0.06 * gs * Math.sin(uTime * 2.0 + (node.ringIdx || 0) * 1.2);
                        // +1粒子と-1粒子が逆方向に回転（対称性の可視化）
                        var pol = node.polarity || (node.isOne ? 1 : -1);
                        var rotSpeed = 0.18 + (node.ringIdx || 0) * 0.04;
                        // 粒子の極性で回転方向が決まる（リング交互 × 極性）
                        var ringDir = (node.ringIdx || 0) % 2 === 0 ? 1 : -1;
                        var holdAngle = node.angle + holdAge * rotSpeed * ringDir * pol;
                        var r = (node.ringRadius || MANDALA_INNER_R) * breath;
                        posArr[i*3] = ringLogoX + Math.cos(holdAngle) * r;
                        posArr[i*3+1] = ringLogoY + Math.sin(holdAngle) * r * 0.45;
                        posArr[i*3+2] = RING_Z;
                        // 1-bit: +1も-1も同じサイズ・同じ輝度で脈動
                        var bc = node.byteColor || [0.9,0.92,1.0];
                        var glow = (0.65 + 0.15 * Math.sin(uTime * 3.0 + node.col * 0.8)) * gs;
                        colArr[i*3] = bc[0]*glow; colArr[i*3+1] = bc[1]*glow; colArr[i*3+2] = bc[2]*glow;
                        geometry.attributes.aSize.array[i] = 7.0 * gs;
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
                        // 全粒子がチャット中心へ収束
                        posArr[i*3]   = node.tx + (drainTX - node.tx) * ease3;
                        posArr[i*3+1] = node.ty + (drainTY - node.ty) * ease3;
                        posArr[i*3+2] = RING_Z;
                        var fade3 = 1.0 - t3;
                        // 1-bit収束: 色が補色→グレーへ（+1と-1が混ざる）
                        // R+C=白, G+M=白, B+Y=白 → 暗くなるとグレー
                        var bc = node.byteColor || [0.9,0.92,1.0];
                        var greyMix = ease3; // 0→1 でグレーへ
                        var greyVal = 0.5 * fade3;
                        var cr = bc[0] * 0.65 * (1.0 - greyMix) + greyVal * greyMix;
                        var cg = bc[1] * 0.65 * (1.0 - greyMix) + greyVal * greyMix;
                        var cb = bc[2] * 0.65 * (1.0 - greyMix) + greyVal * greyMix;
                        colArr[i*3] = cr * fade3; colArr[i*3+1] = cg * fade3; colArr[i*3+2] = cb * fade3;
                        geometry.attributes.aSize.array[i] = 6.0 * fade3;
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
                // 音響リアクティブ: 音が大きい → 粒子が速く動く + 揺れが大きくなる
                const spdMod = window._universeParams ? window._universeParams.speed : 1.0;
                const audioMod = (1.0 + material.uniforms.uAudioEnergy.value * 2.0) * spdMod;
                posArr[i*3+2] += driftSpeedZ[i] * audioMod;
                if (isShootingStar[i]) {
                    // 流れ星: 直線的に高速移動
                    posArr[i*3]   += shootingDirX[i] * audioMod;
                    posArr[i*3+1] += shootingDirY[i] * audioMod;
                } else {
                    posArr[i*3]   += Math.sin(uTime * driftFreqX[i] + driftPhaseX[i]) * driftAmpX[i] * audioMod;
                    posArr[i*3+1] += Math.cos(uTime * driftFreqY[i] + driftPhaseY[i]) * driftAmpY[i] * audioMod;
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
                    // 流れ星はリスポーン時にランダムに新しい方向
                    if (isShootingStar[i]) {
                        const a2 = Math.random() * Math.PI * 2;
                        const sp = 0.3 + Math.random() * 0.8;
                        driftSpeedZ[i] = sp;
                        shootingDirX[i] = Math.cos(a2) * 0.15 * sp;
                        shootingDirY[i] = Math.sin(a2) * 0.15 * sp;
                    }
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
    // AI会話履歴（localStorageで永続化）
    let chatHistory = JSON.parse(localStorage.getItem('inryoku_chat_history') || '[]');
    function saveChatHistory() { try { localStorage.setItem('inryoku_chat_history', JSON.stringify(chatHistory.slice(-20))); } catch(e) {} }

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
    const MANDALA_INNER_R = 12;      // 最内リング半径
    const MANDALA_RING_GAP = 8;      // リング間隔
    const RING_APPEAR_TIME = 4.0;    // 全リング出現時間(秒)
    const RING_HOLD_TIME = 2.5;      // 表示保持(秒)
    const RING_DRAIN_TIME = 1.2;     // 下方ドレイン(秒)
    const MANDALA_STAGGER = 0.4;     // リング間の出現遅延(秒)
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
            var ringRotOffset = byteIdx * Math.PI / byteCount * 0.7;

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
                var ty = ringLogoY + Math.sin(angle) * ringRadius * 0.45;

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

        // 同心リング間を結ぶエッジ（曼荼羅の骨格線）
        for (var pi = 0; pi < allParticles.length; pi++) {
            var p = allParticles[pi];
            // 同じビット位置の次リングと接続
            if (p.ringIdx < byteCount - 1) {
                var nextBitIdx = (p.ringIdx + 1) * 8 + p.col;
                if (nextBitIdx < allParticles.length) {
                    var np = allParticles[nextBitIdx];
                    msgEdges.push({ from: p.idx, to: np.idx, progress: 0 });
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
            playParticleSpeakSound();
        }
        // console.log('[SPEAK] block mode for: "' + text.substring(0,20) + '..."'); // perf: disabled
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
            if (idx < text.length) {
                var ch = text[idx];
                div.textContent += ch;
                if (isFamicom) famicomBeep();
                msgs.scrollTop = msgs.scrollHeight;
                idx++;
                setTimeout(typeNext, getDelay(ch));
            } else {
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
        }
        // 最初の文字の前に少しだけ間を置く（考え始める感）
        setTimeout(typeNext, 300 + Math.random() * 200);
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
        chatHistory = []; saveChatHistory(); // 会話履歴リセット + localStorage同期

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

    function fetchAIResponse(userText, callback) {
        chatHistory.push({ role: 'user', content: userText }); saveChatHistory();
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
            chatHistory.push({ role: 'assistant', content: response }); saveChatHistory();
            callback(response);
        })
        .catch(function() {
            var fallback = '波が揺れた。もう一度、話しかけて';
            chatHistory.push({ role: 'assistant', content: fallback }); saveChatHistory();
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

        // ── トークで宇宙変更: コマンドチェック ──
        var universeFeedback = parseUniverseCommand(txt);

        // AI応答を取得 → 二進数粒子演出 → テキスト表示
        fetchAIResponse(txt, function(response) {
            aDiv.remove();
            // 宇宙変更のフィードバックがあれば応答に追加
            var fullResponse = universeFeedback
                ? response + '\n\n' + universeFeedback
                : response;
            // 粒子が円環を形成してから「読み取り」としてテキスト表示
            speakBinary(fullResponse, function() {
                typeMsg(fullResponse);
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
                <button class="cart-checkout-btn" id="cd-checkout">CHECKOUT</button>
                <div class="cart-stripe-note">Secure Checkout</div>
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
            var hasShopify = CART.items.some(function(item) { return !!item.shopifyVariantId; });

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
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.url) {
                        window.location.href = data.url;
                    } else {
                        alert(data.error || 'Checkout not ready yet');
                        btn.textContent = 'CHECKOUT';
                        btn.disabled = false;
                    }
                })
                .catch(function(err) {
                    alert('Checkout error: ' + err.message);
                    btn.textContent = 'CHECKOUT';
                    btn.disabled = false;
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
                            ${p.sizes.map((s, i) => `<button class="size-btn${i === 1 ? ' selected' : ''}" data-size="${s}">${s}</button>`).join('')}
                        </div>
                    </div>
                    <button class="add-to-cart-btn" id="pm-cart">
                        <span class="cart-btn-text">ADD TO CART</span>
                        <span class="cart-btn-price">${p.price}</span>
                    </button>
                    <div class="product-shipping-info">
                        <span>🚚 お届けまで 7〜14営業日</span>
                        <span>🌍 全世界配送対応</span>
                    </div>
                    <div class="size-guide-toggle" id="sg-toggle">📏 サイズガイド</div>
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
                    <div class="stripe-badge">Secure Checkout</div>
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

    // カートボタン → カートに追加 + トースト通知
    document.getElementById('pm-cart').addEventListener('click', () => {
        var vid = (p.shopifyVariants && p.shopifyVariants[selectedSize]) || '';
        CART.add(p.id, selectedSize, p.priceNum, p.name, vid);
        // Show toast notification
        const toast = document.createElement('div');
        toast.className = 'cart-toast';
        toast.textContent = `${p.name} (${selectedSize}) をカートに追加しました`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2000);
    });

    // サイズガイド展開
    document.getElementById('sg-toggle').addEventListener('click', function() {
        var table = document.getElementById('sg-table');
        table.style.display = table.style.display === 'none' ? 'block' : 'none';
    });

    // カート追加時ビッグバン
    var pmCartBtn = document.getElementById('pm-cart');
    pmCartBtn.addEventListener('click', function() {
        var cr = pmCartBtn.getBoundingClientRect();
        spawnBigBang(cr.left + cr.width / 2, cr.top + cr.height / 2, 12);
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
