// p3-helpers.test.mjs — p3_code_for_claude.js の純粋ヘルパ関数を独立コピーして単体検証
// production code を import せず、関数本体を物理コピーする方針（既存 security.test.mjs と同じパターン）。
// 目的: ロジック上の不変条件を固定し、p3 を編集する際の網にする。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── 対象実装（p3_code_for_claude.js と等価のコピー） ────────────────
function hasMappedVariant(product, size) {
  return !!(product && product.shopifyVariants && product.shopifyVariants[size]);
}

function isProductPurchasable(product) {
  return !!(product && Array.isArray(product.sizes) && product.sizes.some(function (size) {
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
    return { available: false, message: '選択サイズは準備中' };
  }
  return { available: true, message: '' };
}

function getDefaultPurchasableSize(product) {
  if (!product || !Array.isArray(product.sizes) || product.sizes.length === 0) return '';
  return product.sizes.find(function (size) {
    return hasMappedVariant(product, size);
  }) || product.sizes[0];
}

function getProductAvailabilityLabel(product) {
  return isProductPurchasable(product) ? 'available' : 'checkout soon';
}

function gelatoBuildUid(template, size) {
  if (!template || !size) return null;
  return template.replace('{size}', size.toLowerCase());
}

// ─── fixtures ────────────────────────────────────────────────────────
const fullyMapped = {
  id: 'p1',
  sizes: ['S', 'M', 'L'],
  shopifyVariants: { S: 'gid://1', M: 'gid://2', L: 'gid://3' }
};
const partial = {
  id: 'p2',
  sizes: ['S', 'M', 'L'],
  shopifyVariants: { M: 'gid://m' }
};
const noVariants = { id: 'p3', sizes: ['S', 'M'], shopifyVariants: {} };
const noShopify  = { id: 'p4', sizes: ['S', 'M'] };
const noSizes    = { id: 'p5', shopifyVariants: { S: 'gid://x' } };
const emptySizes = { id: 'p6', sizes: [], shopifyVariants: {} };

// ─── tests ──────────────────────────────────────────────────────────
describe('p3 — hasMappedVariant', () => {
  test('size に variant ID が紐付いていれば true', () => {
    assert.equal(hasMappedVariant(fullyMapped, 'S'), true);
    assert.equal(hasMappedVariant(fullyMapped, 'M'), true);
  });

  test('size に variant 未登録なら false', () => {
    assert.equal(hasMappedVariant(partial, 'S'), false);
    assert.equal(hasMappedVariant(partial, 'L'), false);
  });

  test('product が null / undefined なら false', () => {
    assert.equal(hasMappedVariant(null, 'S'), false);
    assert.equal(hasMappedVariant(undefined, 'S'), false);
  });

  test('shopifyVariants が無い product は false', () => {
    assert.equal(hasMappedVariant(noShopify, 'S'), false);
  });

  test('未知 size は false（任意 key への昇格なし）', () => {
    assert.equal(hasMappedVariant(fullyMapped, 'XL'), false);
    assert.equal(hasMappedVariant(fullyMapped, ''), false);
  });

  test('empty string variant value も false（!! で 0 値除外）', () => {
    const p = { sizes: ['S'], shopifyVariants: { S: '' } };
    assert.equal(hasMappedVariant(p, 'S'), false);
  });
});

describe('p3 — isProductPurchasable', () => {
  test('全 size mapped → true', () => {
    assert.equal(isProductPurchasable(fullyMapped), true);
  });

  test('部分的に mapped でも true（some 判定）', () => {
    assert.equal(isProductPurchasable(partial), true);
  });

  test('一切 variant が無いと false', () => {
    assert.equal(isProductPurchasable(noVariants), false);
  });

  test('null / undefined product は false', () => {
    assert.equal(isProductPurchasable(null), false);
    assert.equal(isProductPurchasable(undefined), false);
  });

  test('sizes が配列でない場合は false', () => {
    assert.equal(isProductPurchasable(noSizes), false);
    assert.equal(isProductPurchasable({ sizes: 'S,M', shopifyVariants: { S: 'gid://1' } }), false);
  });

  test('sizes が空配列なら false', () => {
    assert.equal(isProductPurchasable(emptySizes), false);
  });
});

describe('p3 — getCheckoutStatus', () => {
  test('product が null → 商品情報読込失敗メッセージ', () => {
    const r = getCheckoutStatus(null, 'S');
    assert.equal(r.available, false);
    assert.match(r.message, /読み込め/);
  });

  test('未 mapped product → checkout準備中', () => {
    const r = getCheckoutStatus(noVariants, 'S');
    assert.equal(r.available, false);
    assert.equal(r.message, 'checkout準備中');
  });

  test('購入可能 product だが選択 size が未 mapped → サイズ準備中', () => {
    const r = getCheckoutStatus(partial, 'S');
    assert.equal(r.available, false);
    assert.equal(r.message, '選択サイズは準備中');
  });

  test('mapped size → available=true / message=""', () => {
    const r = getCheckoutStatus(partial, 'M');
    assert.equal(r.available, true);
    assert.equal(r.message, '');
  });

  test('全 mapped product でどの size も available', () => {
    for (const s of ['S', 'M', 'L']) {
      assert.equal(getCheckoutStatus(fullyMapped, s).available, true);
    }
  });

  test('返却オブジェクトは常に available / message を持つ', () => {
    const cases = [
      getCheckoutStatus(null, 'S'),
      getCheckoutStatus(noVariants, 'S'),
      getCheckoutStatus(partial, 'S'),
      getCheckoutStatus(partial, 'M')
    ];
    for (const c of cases) {
      assert.ok('available' in c);
      assert.ok('message' in c);
      assert.equal(typeof c.available, 'boolean');
      assert.equal(typeof c.message, 'string');
    }
  });
});

describe('p3 — getDefaultPurchasableSize', () => {
  test('全 mapped product は最初の size を返す', () => {
    assert.equal(getDefaultPurchasableSize(fullyMapped), 'S');
  });

  test('部分 mapped は最初に mapped されている size を返す', () => {
    assert.equal(getDefaultPurchasableSize(partial), 'M');
  });

  test('一切 mapped 無し → fallback で最初の size を返す', () => {
    assert.equal(getDefaultPurchasableSize(noVariants), 'S');
  });

  test('product が無効なら空文字', () => {
    assert.equal(getDefaultPurchasableSize(null), '');
    assert.equal(getDefaultPurchasableSize(undefined), '');
    assert.equal(getDefaultPurchasableSize({}), '');
    assert.equal(getDefaultPurchasableSize(emptySizes), '');
  });

  test('sizes が文字列など非配列でも空文字（throw しない）', () => {
    assert.equal(getDefaultPurchasableSize({ sizes: 'S,M' }), '');
  });
});

describe('p3 — getProductAvailabilityLabel', () => {
  test('購入可能 product は "available"', () => {
    assert.equal(getProductAvailabilityLabel(fullyMapped), 'available');
    assert.equal(getProductAvailabilityLabel(partial), 'available');
  });

  test('未購入可能 product は "checkout soon"', () => {
    assert.equal(getProductAvailabilityLabel(noVariants), 'checkout soon');
    assert.equal(getProductAvailabilityLabel(noShopify), 'checkout soon');
  });

  test('null / undefined → "checkout soon"', () => {
    assert.equal(getProductAvailabilityLabel(null), 'checkout soon');
    assert.equal(getProductAvailabilityLabel(undefined), 'checkout soon');
  });

  test('返り値は 2 値のみ（仕様固定）', () => {
    const v = getProductAvailabilityLabel(fullyMapped);
    assert.ok(v === 'available' || v === 'checkout soon');
  });

  test('empty sizes は "checkout soon"', () => {
    assert.equal(getProductAvailabilityLabel(emptySizes), 'checkout soon');
  });
});

describe('p3 — gelatoBuildUid', () => {
  test('{size} を size lowercase に置換', () => {
    assert.equal(gelatoBuildUid('bella_canvas_3001_{size}_white', 'M'), 'bella_canvas_3001_m_white');
  });

  test('小文字化される（XL → xl）', () => {
    assert.equal(gelatoBuildUid('shirt_{size}', 'XL'), 'shirt_xl');
  });

  test('template / size いずれかが空なら null', () => {
    assert.equal(gelatoBuildUid('', 'M'), null);
    assert.equal(gelatoBuildUid('shirt_{size}', ''), null);
    assert.equal(gelatoBuildUid(null, 'M'), null);
    assert.equal(gelatoBuildUid('shirt_{size}', null), null);
    assert.equal(gelatoBuildUid(undefined, undefined), null);
  });

  test('placeholder が無い template はそのまま返る', () => {
    assert.equal(gelatoBuildUid('static_uid_no_placeholder', 'M'), 'static_uid_no_placeholder');
  });

  test('複数 placeholder のうち最初の 1 つだけ置換（String.replace 仕様）', () => {
    assert.equal(gelatoBuildUid('{size}_and_{size}', 'L'), 'l_and_{size}');
  });

  test('混合大文字 size も lowercase に正規化', () => {
    assert.equal(gelatoBuildUid('t_{size}', 'Xl'), 't_xl');
  });
});
