// tests/shopify-proxy.test.mjs
// /api/shopify/graphql の whitelist / parser ロジックを独立検証する。
// security.test.mjs と同じパターン: server.js の実装を等価コピーしてテスト。
// production code には触れず、不変条件を固定する。

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── server.js と等価コピー ───────────────────────────────────

const SHOPIFY_QUERY_WHITELIST = new Set([
  'products', 'productByHandle', 'productByHandles', 'product',
  'variantById', 'variantsByIds', 'cart', 'collections',
  'collectionByHandle', 'shop'
]);
const SHOPIFY_MUTATION_WHITELIST = new Set([
  'cartCreate', 'cartLinesAdd', 'cartLinesUpdate', 'cartLinesRemove',
  'cartBuyerIdentityUpdate', 'cartAttributesUpdate', 'cartNoteUpdate'
]);

function parseShopifyOperation(query) {
  if (typeof query !== 'string' || query.length === 0) {
    return { operations: [], error: 'empty query' };
  }
  if (query.length > 16 * 1024) {
    return { operations: [], error: 'query too large' };
  }
  let q = query.replace(/#[^\n]*/g, ' ');
  q = q.replace(/"""[\s\S]*?"""/g, '""');
  q = q.replace(/"(?:\\.|[^"\\])*"/g, '""');

  const operations = [];
  const opRe = /\b(query|mutation|subscription)\b/g;
  let m;
  while ((m = opRe.exec(q)) !== null) {
    const opType = m[1];
    let i = m.index + m[0].length;
    while (i < q.length && /\s/.test(q[i])) i++;
    let name = null;
    const nameMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(q.slice(i));
    if (nameMatch) { name = nameMatch[0]; i += name.length; }
    while (i < q.length && /\s/.test(q[i])) i++;
    if (q[i] === '(') {
      let depth = 1; i++;
      while (i < q.length && depth > 0) {
        if (q[i] === '(') depth++;
        else if (q[i] === ')') depth--;
        i++;
      }
    }
    while (i < q.length) {
      while (i < q.length && /\s/.test(q[i])) i++;
      if (q[i] !== '@') break;
      i++;
      const dn = /^[A-Za-z_][A-Za-z0-9_]*/.exec(q.slice(i));
      if (dn) i += dn[0].length;
      while (i < q.length && /\s/.test(q[i])) i++;
      if (q[i] === '(') {
        let depth = 1; i++;
        while (i < q.length && depth > 0) {
          if (q[i] === '(') depth++;
          else if (q[i] === ')') depth--;
          i++;
        }
      }
    }
    while (i < q.length && /\s/.test(q[i])) i++;
    if (q[i] !== '{') {
      operations.push({ opType, name, root: null, malformed: true });
      continue;
    }
    i++;
    while (i < q.length && /\s/.test(q[i])) i++;
    let root = null;
    const firstId = /^[A-Za-z_][A-Za-z0-9_]*/.exec(q.slice(i));
    if (firstId) {
      i += firstId[0].length;
      while (i < q.length && /\s/.test(q[i])) i++;
      if (q[i] === ':') {
        i++;
        while (i < q.length && /\s/.test(q[i])) i++;
        const realId = /^[A-Za-z_][A-Za-z0-9_]*/.exec(q.slice(i));
        if (realId) root = realId[0];
      } else {
        root = firstId[0];
      }
    }
    operations.push({ opType, name, root, malformed: false });
  }
  if (operations.length === 0) {
    let i = 0;
    while (i < q.length && /\s/.test(q[i])) i++;
    if (q[i] === '{') {
      i++;
      while (i < q.length && /\s/.test(q[i])) i++;
      const firstId = /^[A-Za-z_][A-Za-z0-9_]*/.exec(q.slice(i));
      if (firstId) {
        operations.push({ opType: 'query', name: null, root: firstId[0], malformed: false });
      }
    }
  }
  return { operations };
}

function validateSingleOp(op) {
  if (!op || op.malformed) {
    return { ok: false, reason: 'malformed operation' };
  }
  if (op.opType === 'subscription') {
    return { ok: false, reason: 'subscriptions not allowed' };
  }
  if (!op.root) {
    return { ok: false, reason: 'no root selection' };
  }
  if (op.opType === 'query' && !SHOPIFY_QUERY_WHITELIST.has(op.root)) {
    return { ok: false, reason: 'query not in whitelist: ' + op.root };
  }
  if (op.opType === 'mutation' && !SHOPIFY_MUTATION_WHITELIST.has(op.root)) {
    return { ok: false, reason: 'mutation not in whitelist: ' + op.root };
  }
  return { ok: true, opName: op.name, opType: op.opType, root: op.root };
}

function validateShopifyOperation(query, operationName) {
  const parsed = parseShopifyOperation(query);
  if (parsed.error) return { ok: false, reason: parsed.error };
  const ops = parsed.operations || [];
  if (ops.length === 0) return { ok: false, reason: 'no operation' };
  if (ops.length > 1) {
    if (!operationName) return { ok: false, reason: 'multiple operations require operationName' };
    const matching = ops.filter(o => o.name === operationName);
    if (matching.length !== 1) return { ok: false, reason: 'operationName not found / ambiguous' };
    return validateSingleOp(matching[0]);
  }
  return validateSingleOp(ops[0]);
}

// rate limiter コピー
function makeLimiter() {
  const buckets = new Map();
  return function check(ip, key, max, windowMs, now = Date.now()) {
    const k = `${key}:${ip}`;
    const b = buckets.get(k) || { count: 0, reset: now + windowMs };
    if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
    b.count++;
    buckets.set(k, b);
    return { ok: b.count <= max };
  };
}

// ─── tests ───────────────────────────────────────────────────

describe('shopify-proxy — operation parser', () => {
  test('shorthand query `{ products { id } }` を query/products として認識', () => {
    const r = parseShopifyOperation('{ products { id } }');
    assert.equal(r.operations.length, 1);
    assert.equal(r.operations[0].opType, 'query');
    assert.equal(r.operations[0].root, 'products');
  });

  test('named query: query Foo { productByHandle(handle: "x") { id } }', () => {
    const r = parseShopifyOperation('query Foo($h: String!) { productByHandle(handle: $h) { id title } }');
    assert.equal(r.operations.length, 1);
    assert.equal(r.operations[0].opType, 'query');
    assert.equal(r.operations[0].name, 'Foo');
    assert.equal(r.operations[0].root, 'productByHandle');
  });

  test('mutation: mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id } } }', () => {
    const r = parseShopifyOperation('mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id checkoutUrl } } }');
    assert.equal(r.operations.length, 1);
    assert.equal(r.operations[0].opType, 'mutation');
    assert.equal(r.operations[0].root, 'cartCreate');
  });

  test('alias: mutation { aliased: cartCreate(...) { ... } } → root=cartCreate', () => {
    const r = parseShopifyOperation('mutation { aliased: cartCreate(input: {}) { cart { id } } }');
    assert.equal(r.operations.length, 1);
    assert.equal(r.operations[0].root, 'cartCreate');
  });

  test('コメント行内の "mutation" は誤検出しない', () => {
    const q = '# mutation customerCreate(...)\nquery { products { id } }';
    const r = parseShopifyOperation(q);
    assert.equal(r.operations.length, 1);
    assert.equal(r.operations[0].opType, 'query');
    assert.equal(r.operations[0].root, 'products');
  });

  test('文字列リテラル内の "mutation" を誤検出しない', () => {
    const q = 'query { productByHandle(handle: "mutation customerCreate") { id } }';
    const r = parseShopifyOperation(q);
    assert.equal(r.operations.length, 1);
    assert.equal(r.operations[0].opType, 'query');
    assert.equal(r.operations[0].root, 'productByHandle');
  });

  test('複数 operation は両方検出', () => {
    const q = 'query A { products { id } } mutation B { cartCreate(input: {}) { cart { id } } }';
    const r = parseShopifyOperation(q);
    assert.equal(r.operations.length, 2);
    assert.equal(r.operations[0].opType, 'query');
    assert.equal(r.operations[1].opType, 'mutation');
  });

  test('subscription も検出される（拒否は validation 側）', () => {
    const r = parseShopifyOperation('subscription S { something }');
    assert.equal(r.operations.length, 1);
    assert.equal(r.operations[0].opType, 'subscription');
  });

  test('directive をスキップして root を取れる', () => {
    const r = parseShopifyOperation('query Foo @directive(arg: "x") { products { id } }');
    assert.equal(r.operations[0].root, 'products');
  });

  test('16KB 超は reject', () => {
    const big = 'query X { products { id } } ' + 'x'.repeat(20 * 1024);
    const r = parseShopifyOperation(big);
    assert.equal(r.error, 'query too large');
  });

  test('空文字 / 非文字列', () => {
    assert.equal(parseShopifyOperation('').error, 'empty query');
    assert.equal(parseShopifyOperation(null).error, 'empty query');
    assert.equal(parseShopifyOperation(undefined).error, 'empty query');
  });
});

describe('shopify-proxy — whitelist enforcement', () => {
  test('許可 query: products → ok', () => {
    const r = validateShopifyOperation('{ products { id } }');
    assert.equal(r.ok, true);
    assert.equal(r.root, 'products');
  });

  test('許可 query: productByHandle → ok', () => {
    const r = validateShopifyOperation('query Q { productByHandle(handle: "x") { id } }');
    assert.equal(r.ok, true);
  });

  test('許可 mutation: cartCreate → ok', () => {
    const r = validateShopifyOperation('mutation { cartCreate(input: {}) { cart { id } } }');
    assert.equal(r.ok, true);
  });

  test('許可 mutation: cartLinesAdd → ok', () => {
    const r = validateShopifyOperation('mutation { cartLinesAdd(cartId: "x", lines: []) { cart { id } } }');
    assert.equal(r.ok, true);
  });

  test('禁止 mutation: customerCreate → 拒否', () => {
    const r = validateShopifyOperation('mutation { customerCreate(input: {}) { customer { id } } }');
    assert.equal(r.ok, false);
    assert.match(r.reason, /not in whitelist/);
  });

  test('禁止 mutation: customerAccessTokenCreate → 拒否', () => {
    const r = validateShopifyOperation('mutation { customerAccessTokenCreate(input: {}) { customerAccessToken { accessToken } } }');
    assert.equal(r.ok, false);
  });

  test('禁止 mutation: checkoutCreate（旧 API）→ 拒否', () => {
    const r = validateShopifyOperation('mutation { checkoutCreate(input: {}) { checkout { id } } }');
    assert.equal(r.ok, false);
  });

  test('未知 query: someInternalThing → 拒否', () => {
    const r = validateShopifyOperation('{ someInternalThing { secret } }');
    assert.equal(r.ok, false);
  });

  test('subscription は常に拒否', () => {
    const r = validateShopifyOperation('subscription S { products { id } }');
    assert.equal(r.ok, false);
    assert.match(r.reason, /subscription/);
  });

  test('複数 operation で operationName 未指定 → 拒否', () => {
    const q = 'query A { products { id } } mutation B { cartCreate(input: {}) { cart { id } } }';
    const r = validateShopifyOperation(q);
    assert.equal(r.ok, false);
    assert.match(r.reason, /operationName/);
  });

  test('複数 operation で operationName 指定 → 該当 op のみ評価', () => {
    const q = 'query A { products { id } } mutation B { cartCreate(input: {}) { cart { id } } }';
    const r = validateShopifyOperation(q, 'A');
    assert.equal(r.ok, true);
    assert.equal(r.opType, 'query');
  });

  test('複数 operation で operationName が禁止 op を指す → 拒否', () => {
    const q = 'query A { products { id } } mutation Bad { customerCreate(input: {}) { customer { id } } }';
    const r = validateShopifyOperation(q, 'Bad');
    assert.equal(r.ok, false);
  });

  test('alias で禁止 mutation を偽装する攻撃 → 拒否', () => {
    // alias `cartCreate: customerCreate(...)` は alias=cartCreate, real=customerCreate
    // パーサは alias の後の real field 名を見るので拒否されるべき
    const r = validateShopifyOperation('mutation { cartCreate: customerCreate(input: {}) { customer { id } } }');
    assert.equal(r.ok, false);
    assert.match(r.reason, /customerCreate/);
  });

  test('コメントで禁止 op を隠して許可 op に偽装 → 許可 op のみ評価される', () => {
    const r = validateShopifyOperation('# mutation { customerCreate { x } }\nquery { products { id } }');
    assert.equal(r.ok, true);
  });
});

describe('shopify-proxy — rate limit', () => {
  test('90/min を超えると ok=false', () => {
    const limiter = makeLimiter();
    const ip = '1.2.3.4';
    let lastOk = true;
    for (let i = 0; i < 90; i++) {
      lastOk = limiter(ip, 'shopify_proxy', 90, 60_000).ok;
    }
    assert.equal(lastOk, true, '90 回目までは ok');
    const r = limiter(ip, 'shopify_proxy', 90, 60_000);
    assert.equal(r.ok, false, '91 回目で拒否');
  });

  test('window 経過後にリセット', () => {
    const limiter = makeLimiter();
    const ip = '5.6.7.8';
    for (let i = 0; i < 90; i++) limiter(ip, 'shopify_proxy', 90, 60_000, 1000);
    assert.equal(limiter(ip, 'shopify_proxy', 90, 60_000, 1000).ok, false);
    // 60_001ms 後はリセット
    assert.equal(limiter(ip, 'shopify_proxy', 90, 60_000, 62_000).ok, true);
  });

  test('IP ごとに独立カウント', () => {
    const limiter = makeLimiter();
    for (let i = 0; i < 90; i++) limiter('a', 'shopify_proxy', 90, 60_000);
    assert.equal(limiter('a', 'shopify_proxy', 90, 60_000).ok, false);
    assert.equal(limiter('b', 'shopify_proxy', 90, 60_000).ok, true);
  });
});

describe('shopify-proxy — error handling shape', () => {
  test('whitelist 外は 403 を返す前提（reason フィールドを持つ）', () => {
    const r = validateShopifyOperation('mutation { customerCreate(input: {}) { customer { id } } }');
    assert.equal(r.ok, false);
    assert.ok(typeof r.reason === 'string');
  });

  test('malformed 文字列は ok=false', () => {
    const r = validateShopifyOperation('not a graphql query');
    assert.equal(r.ok, false);
  });
});
