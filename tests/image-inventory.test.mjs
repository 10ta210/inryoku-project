// tests/image-inventory.test.mjs
// 画像インベントリ整合性テスト (2026-04-28)
// - public/ + ルートの画像が想定どおり揃っているか
// - manifest.json / sitemap.xml が参照する画像が物理存在するか
// - 主要画像（ENTER hoodie / ロゴ / OG）の存在保証
//
// 触らない方針: scripts/optimize-images.sh を実行しないので、AVIF/WebP の
// 存在は "あれば検査" にとどめる（ローカルで cwebp/avifenc が無い CI でも通す）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUB = resolve(ROOT, 'public');

// ─── 期待値: public/ 配下のプロダクト画像 (PNG ベース) ─────────────
const PUBLIC_PRODUCT_PNGS = [
  'enter_hoodie.png',
  'info_logo_hoodie.png',
  'mockup_qr_tee.png',
  'mockup_universe_tee.png',
];

// ─── 期待値: ルート直下のロゴ / OG ─────────────────────────────
const ROOT_BRAND_PNGS = [
  'inryoku_logo_icon.png',
  'inryoku_og.png',
  'logo_sphere.png',
  'logo_shell.png',
];

test('image-inventory: public/ contains all expected product PNGs', () => {
  for (const f of PUBLIC_PRODUCT_PNGS) {
    const p = resolve(PUB, f);
    assert.ok(existsSync(p), `missing public asset: ${f}`);
    const sz = statSync(p).size;
    assert.ok(sz > 1024, `${f} suspiciously small (${sz} bytes)`);
  }
});

test('image-inventory: root contains brand / OG PNGs', () => {
  for (const f of ROOT_BRAND_PNGS) {
    const p = resolve(ROOT, f);
    assert.ok(existsSync(p), `missing brand asset: ${f}`);
  }
});

test('image-inventory: ENTER hoodie WebP exists (LCP candidate)', () => {
  // index.html が参照している webp。これが消えると LCP が PNG fallback になる。
  assert.ok(
    existsSync(resolve(PUB, 'enter_hoodie.webp')),
    'public/enter_hoodie.webp must exist (referenced by index.html as LCP)'
  );
});

test('image-inventory: manifest.json icons exist on disk', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(ROOT, 'manifest.json'), 'utf8')
  );
  const refs = [
    ...(manifest.icons ?? []).map(i => i.src),
    ...(manifest.screenshots ?? []).map(s => s.src),
    ...((manifest.shortcuts ?? []).flatMap(s => (s.icons ?? []).map(i => i.src))),
  ];
  for (const ref of refs) {
    const local = resolve(ROOT, ref.replace(/^\//, ''));
    assert.ok(existsSync(local), `manifest.json references missing file: ${ref}`);
  }
});

test('image-inventory: sitemap.xml image refs resolve to local files', () => {
  const xml = readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8');
  const imgRe = /<image:loc>\s*([^<\s]+)\s*<\/image:loc>/g;
  const refs = [];
  let m;
  while ((m = imgRe.exec(xml)) !== null) refs.push(m[1]);
  assert.ok(refs.length > 0, 'sitemap.xml should contain at least one <image:loc>');
  for (const url of refs) {
    // https://inryoku.com/foo.png -> ROOT/foo.png
    const path = url.replace(/^https?:\/\/[^/]+\//, '');
    const local = resolve(ROOT, path);
    assert.ok(existsSync(local), `sitemap.xml references missing file: ${url}`);
  }
});

test('image-inventory: WebP variants for product PNGs are present (current state)', () => {
  // 現状 public/ の 4 PNG にはすべて .webp が同梱されている前提（リポジトリ既知の状態）
  for (const f of PUBLIC_PRODUCT_PNGS) {
    const webp = resolve(PUB, f.replace(/\.png$/, '.webp'));
    assert.ok(existsSync(webp), `expected sibling WebP missing: public/${f.replace(/\.png$/, '.webp')}`);
  }
});

test('image-inventory: optimizer / checker scripts are syntactically valid bash', async () => {
  // shellcheck は CI 環境前提なので、ここでは bash -n のみ走らせる。
  const { spawnSync } = await import('node:child_process');
  for (const s of ['scripts/optimize-images.sh', 'scripts/check-images.sh']) {
    const p = resolve(ROOT, s);
    assert.ok(existsSync(p), `script missing: ${s}`);
    const r = spawnSync('bash', ['-n', p], { encoding: 'utf8' });
    assert.equal(r.status, 0, `bash -n failed for ${s}: ${r.stderr}`);
  }
});

test('image-inventory: no unexpected dev-only PNGs leak into public/', () => {
  // public/ には PNG/WebP/AVIF/GLB しか入らない想定
  const entries = readdirSync(PUB);
  for (const e of entries) {
    assert.match(
      e,
      /\.(png|webp|avif|jpe?g|glb|svg)$/i,
      `unexpected file in public/: ${e}`
    );
  }
});
