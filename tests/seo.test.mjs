// seo.test.mjs — SEO ファイル群の妥当性検証
//   - manifest.json: PWA Web App Manifest schema 妥当性
//   - sitemap.xml: XML 構文 + sitemaps.org 0.9 schema
//   - robots.txt: 標準形式
//   - JSON-LD (index.html 内): Schema.org パース妥当性
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

describe('SEO — manifest.json schema 妥当性', () => {
  const manifest = JSON.parse(read('manifest.json'));

  test('PWA 必須フィールドが揃っている', () => {
    assert.ok(manifest.name, 'name');
    assert.ok(manifest.short_name, 'short_name');
    assert.ok(manifest.start_url, 'start_url');
    assert.ok(manifest.display, 'display');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'icons');
  });

  test('display は許可された値（standalone / fullscreen / minimal-ui / browser）', () => {
    assert.ok(['standalone', 'fullscreen', 'minimal-ui', 'browser'].includes(manifest.display));
  });

  test('theme_color / background_color は #RRGGBB 形式', () => {
    assert.match(manifest.theme_color, /^#[0-9a-fA-F]{6}$/);
    assert.match(manifest.background_color, /^#[0-9a-fA-F]{6}$/);
  });

  test('icons は src/sizes/type を持ち、192x192 と 512x512 を含む', () => {
    for (const ic of manifest.icons) {
      assert.ok(ic.src, 'src');
      assert.ok(ic.sizes, 'sizes');
      assert.ok(ic.type, 'type');
      assert.match(ic.sizes, /^\d+x\d+$/);
    }
    const sizes = manifest.icons.map((i) => i.sizes);
    assert.ok(sizes.includes('192x192'), '192x192 必須');
    assert.ok(sizes.includes('512x512'), '512x512 必須');
  });

  test('maskable purpose の icon が存在する（PWA installability）', () => {
    const maskable = manifest.icons.filter((i) =>
      i.purpose && i.purpose.split(/\s+/).includes('maskable')
    );
    assert.ok(maskable.length > 0, 'maskable icon 必須');
  });

  test('start_url / scope は同一オリジンの相対 or "/"', () => {
    assert.match(manifest.start_url, /^\//);
    if (manifest.scope) assert.match(manifest.scope, /^\//);
  });

  test('shortcuts があれば url / name を持つ', () => {
    if (manifest.shortcuts) {
      for (const s of manifest.shortcuts) {
        assert.ok(s.name);
        assert.ok(s.url);
      }
    }
  });

  test('lang / dir が設定されている', () => {
    assert.equal(manifest.lang, 'ja');
    assert.ok(['ltr', 'rtl', 'auto'].includes(manifest.dir));
  });
});

describe('SEO — sitemap.xml XML 構文と schema', () => {
  const xml = read('sitemap.xml');

  test('XML 宣言で始まる', () => {
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  test('sitemaps.org 0.9 namespace を持つ urlset', () => {
    assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
  });

  test('JSDOM の XML パーサで構文エラーなくパースできる', () => {
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const errors = dom.window.document.querySelectorAll('parsererror');
    assert.equal(errors.length, 0, 'parsererror なし');
  });

  test('全 url 要素は loc を持ち、http(s):// で始まる', () => {
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const urls = dom.window.document.querySelectorAll('url');
    assert.ok(urls.length > 0, 'url が 1 つ以上');
    for (const u of urls) {
      const loc = u.querySelector('loc');
      assert.ok(loc, 'loc 必須');
      assert.match(loc.textContent.trim(), /^https?:\/\//, 'loc は absolute URL');
    }
  });

  test('priority は 0.0〜1.0 の範囲', () => {
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const ps = dom.window.document.querySelectorAll('priority');
    for (const p of ps) {
      const v = parseFloat(p.textContent);
      assert.ok(v >= 0 && v <= 1, `priority=${v}`);
    }
  });

  test('changefreq は許容語彙', () => {
    const valid = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const cs = dom.window.document.querySelectorAll('changefreq');
    for (const c of cs) {
      assert.ok(valid.has(c.textContent.trim()), c.textContent);
    }
  });

  test('lastmod は ISO 8601 (YYYY-MM-DD) 形式', () => {
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const lms = dom.window.document.querySelectorAll('lastmod');
    for (const lm of lms) {
      assert.match(lm.textContent.trim(), /^\d{4}-\d{2}-\d{2}/);
    }
  });

  test('image:image があれば image:loc を持つ', () => {
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const imgs = dom.window.document.getElementsByTagName('image:image');
    for (const im of imgs) {
      const loc = im.getElementsByTagName('image:loc')[0];
      assert.ok(loc, 'image:loc 必須');
      assert.match(loc.textContent.trim(), /^https?:\/\//);
    }
  });
});

describe('SEO — robots.txt 標準形式', () => {
  const robots = read('robots.txt');

  test('User-agent: ディレクティブを少なくとも 1 つ含む', () => {
    assert.match(robots, /^User-agent:\s*\S+/m);
  });

  test('Sitemap: ディレクティブを含み URL は absolute', () => {
    const m = robots.match(/^Sitemap:\s*(.+)$/m);
    assert.ok(m, 'Sitemap: 必須');
    assert.match(m[1].trim(), /^https?:\/\//);
  });

  test('User-agent: * 行が含まれる（汎用ルール）', () => {
    assert.match(robots, /^User-agent:\s*\*/m);
  });

  test('Allow / Disallow のパスは / で始まる', () => {
    const lines = robots.split('\n');
    for (const line of lines) {
      const m = line.match(/^(?:Allow|Disallow):\s*(.+?)\s*(?:#.*)?$/);
      if (m && m[1]) {
        assert.match(m[1], /^\//, `path "${m[1]}" は / で始まる`);
      }
    }
  });

  test('攻撃的スクレイパ（Ahrefs / Semrush / MJ12）が Disallow されている', () => {
    assert.match(robots, /User-agent:\s*AhrefsBot[\s\S]*?Disallow:\s*\//);
    assert.match(robots, /User-agent:\s*SemrushBot[\s\S]*?Disallow:\s*\//);
    assert.match(robots, /User-agent:\s*MJ12bot[\s\S]*?Disallow:\s*\//);
  });

  test('機微パス（/.env / /tests/ / /docs/）が Disallow されている', () => {
    assert.match(robots, /Disallow:\s*\/\.env/);
    assert.match(robots, /Disallow:\s*\/tests\//);
    assert.match(robots, /Disallow:\s*\/docs\//);
  });
});

describe('SEO — JSON-LD（index.html 埋め込み）パース妥当性', () => {
  const html = read('index.html');
  const dom = new JSDOM(html);
  const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]');

  test('少なくとも 1 つ以上の JSON-LD ブロックが存在する', () => {
    assert.ok(scripts.length > 0);
  });

  test('全 JSON-LD ブロックが JSON.parse 可能', () => {
    for (const s of scripts) {
      assert.doesNotThrow(() => JSON.parse(s.textContent), 'parse');
    }
  });

  test('JSON-LD は @context: schema.org を持つ', () => {
    for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      assert.match(data['@context'], /schema\.org/, '@context');
    }
  });

  test('@graph があれば各エントリは @type を持つ', () => {
    for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      if (Array.isArray(data['@graph'])) {
        for (const node of data['@graph']) {
          assert.ok(node['@type'], '@type 必須: ' + JSON.stringify(node).slice(0, 80));
        }
      }
    }
  });

  test('Organization / WebSite / WebPage のいずれかが含まれる', () => {
    let types = [];
    for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      types.push(...nodes.map((n) => n['@type']));
    }
    const must = ['Organization', 'WebSite', 'WebPage'];
    for (const t of must) {
      assert.ok(types.includes(t), `${t} 必須`);
    }
  });

  test('Organization の url / name は必須', () => {
    for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      for (const n of nodes) {
        if (n['@type'] === 'Organization') {
          assert.ok(n.name, 'Organization.name');
          assert.ok(n.url, 'Organization.url');
          assert.match(n.url, /^https?:\/\//);
        }
      }
    }
  });
});

describe('SEO — canonical / hreflang（index.html）', () => {
  const html = read('index.html');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  test('rel="canonical" が 1 つだけ存在する', () => {
    const links = doc.querySelectorAll('link[rel="canonical"]');
    assert.equal(links.length, 1, 'canonical は 1 つだけ');
  });

  test('canonical の href は absolute https URL', () => {
    const link = doc.querySelector('link[rel="canonical"]');
    assert.ok(link, 'canonical link 必須');
    const href = link.getAttribute('href');
    assert.match(href, /^https:\/\//, 'https で始まる');
  });

  test('hreflang を持つ alternate が少なくとも 1 つ存在する', () => {
    const alts = doc.querySelectorAll('link[rel="alternate"][hreflang]');
    assert.ok(alts.length >= 1, 'hreflang alternate 必須');
  });

  test('x-default hreflang を含む（多言語展開時の SEO ベストプラクティス）', () => {
    const alts = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]'));
    const langs = alts.map((a) => a.getAttribute('hreflang'));
    assert.ok(langs.includes('x-default'), 'x-default 必須');
  });

  test('全 hreflang alternate の href は absolute', () => {
    const alts = doc.querySelectorAll('link[rel="alternate"][hreflang]');
    for (const a of alts) {
      const href = a.getAttribute('href');
      assert.match(href, /^https?:\/\//, `${a.getAttribute('hreflang')} の href は absolute`);
    }
  });

  test('hreflang 値は ISO 639-1 風 or x-default のいずれか', () => {
    const alts = doc.querySelectorAll('link[rel="alternate"][hreflang]');
    for (const a of alts) {
      const lang = a.getAttribute('hreflang');
      assert.match(lang, /^(x-default|[a-z]{2}(-[A-Z]{2})?)$/, `hreflang=${lang} 形式`);
    }
  });
});
