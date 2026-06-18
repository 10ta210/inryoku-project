import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
p.on('console', m => console.log('[c]', m.type(), m.text().slice(0,180)));
p.on('pageerror', e => console.log('[err]', e.message));
p.on('response', r => { if (r.status() >= 400) console.log('[400+]', r.status(), r.url()); });
await p.route(/\.html(\?.*)?$/, async (route) => {
  const response = await route.fetch();
  const body = await response.body();
  const headers = { ...response.headers() };
  delete headers['content-security-policy'];
  delete headers['content-security-policy-report-only'];
  await route.fulfill({ response, body, headers });
});
await p.goto('http://localhost:3000/p3_audio_test.html');
await p.waitForTimeout(4000);
const info = await p.evaluate(() => ({
  canons: document.querySelectorAll('#canons button').length,
  enterText: document.getElementById('enter')?.textContent,
  log: document.getElementById('log')?.textContent?.slice(0, 200)
}));
console.log('info', JSON.stringify(info, null, 2));
await b.close();
