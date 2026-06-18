import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractProducts, buildSitemap, getLastmod, run } from '../scripts/generate-sitemap.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

test('extractProducts pulls all 12 products with required fields', () => {
    const src = readFileSync(resolve(ROOT, 'p3_code_for_claude.js'), 'utf8');
    const products = extractProducts(src);
    assert.equal(products.length, 12, 'expected 12 products');
    for (const p of products) {
        assert.ok(p.slug && /^[a-z0-9-]+$/.test(p.slug), `slug invalid: ${p.slug}`);
        assert.ok(p.title && p.title.length > 0);
        assert.ok(p.image && p.image.startsWith('public/'));
    }
    const slugs = products.map(p => p.slug);
    for (const expected of ['enter-tee', 'logo-tee', 'enter-hoodie', 'logo-tank']) {
        assert.ok(slugs.includes(expected), `missing slug ${expected}`);
    }
});

test('buildSitemap output is valid-looking XML with required structure', () => {
    const products = [{ slug: 'enter-tee', title: 'ENTER TEE', image: 'public/enter_hoodie.png' }];
    const xml = buildSitemap(products, '2026-04-26');
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<urlset[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
    assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    assert.match(xml, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemaps\/image\/1\.1"/);
    assert.ok(xml.endsWith('</urlset>\n'));
    // Tag balance check.
    const opens = (xml.match(/<url>/g) || []).length;
    const closes = (xml.match(/<\/url>/g) || []).length;
    assert.equal(opens, closes);
});

test('buildSitemap includes all required static pages', () => {
    const xml = buildSitemap([], '2026-04-26');
    for (const path of ['/', '/p3_test.html', '/legal.html', '/privacy.html', '/returns.html', '/size-guide.html']) {
        assert.ok(xml.includes(`<loc>https://inryoku.com${path}</loc>`), `missing static page: ${path}`);
    }
});

test('buildSitemap includes hreflang ja, en, x-default for static pages', () => {
    const xml = buildSitemap([], '2026-04-26');
    assert.match(xml, /hreflang="ja"/);
    assert.match(xml, /hreflang="en"/);
    assert.match(xml, /hreflang="x-default"/);
});

test('buildSitemap emits product URLs and images for each product', () => {
    const products = [
        { slug: 'enter-tee',  title: 'ENTER TEE',  image: 'public/enter_hoodie.png' },
        { slug: 'logo-tank',  title: 'inryokü LOGO TANK TOP', image: 'public/info_logo_hoodie.png' },
    ];
    const xml = buildSitemap(products, '2026-04-26');
    assert.ok(xml.includes('<loc>https://inryoku.com/?product=enter-tee</loc>'));
    assert.ok(xml.includes('<loc>https://inryoku.com/?product=logo-tank</loc>'));
    assert.ok(xml.includes('<image:loc>https://inryoku.com/public/enter_hoodie.png</image:loc>'));
    assert.ok(xml.includes('<image:loc>https://inryoku.com/public/info_logo_hoodie.png</image:loc>'));
});

test('lastmod is ISO yyyy-mm-dd format', () => {
    const lm = getLastmod();
    assert.match(lm, /^\d{4}-\d{2}-\d{2}$/);
    const xml = buildSitemap([], lm);
    assert.ok(xml.includes(`<lastmod>${lm}</lastmod>`));
});

test('run() in dry mode produces sitemap with all real products', () => {
    const { products, xml } = run({ write: false });
    assert.equal(products.length, 12);
    for (const p of products) {
        assert.ok(xml.includes(`<loc>https://inryoku.com/?product=${p.slug}</loc>`),
            `sitemap missing product loc for ${p.slug}`);
    }
});
