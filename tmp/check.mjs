import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
p.on('console', m => console.log('[console]', m.type(), m.text()));
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('http://localhost:3000/p3_unified_test.html');
await p.waitForTimeout(4000);
const info = await p.evaluate(() => ({
  p3: !!window.__p3,
  canvas: document.querySelectorAll('canvas').length,
  bodyHTML: document.body.innerHTML.slice(0,400)
}));
console.log('info', JSON.stringify(info, null, 2));
await b.close();
