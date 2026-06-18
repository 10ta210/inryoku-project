import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
p.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 200)));
p.on('pageerror', e => console.log('[pageerror]', e.message));
p.on('requestfailed', r => console.log('[reqfail]', r.url(), r.failure()?.errorText));
p.on('response', r => { if (r.status() >= 400) console.log('[404]', r.status(), r.url()); });

await p.route('**/*.html', async (route) => {
  const response = await route.fetch();
  const body = await response.body();
  const headers = { ...response.headers() };
  delete headers['content-security-policy'];
  delete headers['content-security-policy-report-only'];
  delete headers['cross-origin-embedder-policy'];
  delete headers['cross-origin-opener-policy'];
  delete headers['cross-origin-resource-policy'];
  await route.fulfill({ response, body, headers });
});

await p.goto('http://localhost:3000/p3_unified_test.html');
await p.waitForTimeout(5000);
const info = await p.evaluate(() => ({
  p3: !!window.__p3,
  canvas: document.querySelectorAll('canvas').length,
  has_importmap: !!document.querySelector('script[type=importmap]'),
  importmap_src: document.querySelector('script[type=importmap]')?.textContent?.slice(0,200),
}));
console.log('info', JSON.stringify(info, null, 2));
await b.close();
