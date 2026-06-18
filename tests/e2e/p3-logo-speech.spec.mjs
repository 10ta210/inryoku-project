// tests/e2e/p3-logo-speech.spec.mjs
// E2E for p3_logo_speech_test.html — 17 canon glyph rendering, queue priority,
// interrupt.

import { test, expect } from '@playwright/test';
import { waitStable, collectConsoleErrors, useLocalThree } from './_helpers.mjs';

const URL = '/p3_logo_speech_test.html';
const CANON_KINDS = [
  'silence', 'core', 'ma', 'shadow', 'emit', 'observation',
  'self_question', 'declaration', 'leap', 'resonance', 'consensus',
  'past_speculation', 'future_command', 'echo', 'quotation',
  'summon', 'revelation'
];

test.describe('p3_logo_speech_test.html', () => {
  test.beforeEach(async ({ page }) => { await useLocalThree(page); });
  test('boots: 17 canon buttons render in #canon-buttons', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(URL);
    await waitStable(page, 1500);

    const btns = page.locator('#canon-buttons button');
    await expect.poll(async () => btns.count(), { timeout: 5000 }).toBe(CANON_KINDS.length);
    const labels = await btns.evaluateAll((els) => els.map((e) => e.textContent.trim()));
    for (const c of CANON_KINDS) {
      expect(labels, `expected ${c} in canon button labels`).toContain(c);
    }
    expect(errors).toEqual([]);
  });

  test('clicking a canon shows it as current then idles', async ({ page }) => {
    await page.goto(URL);
    await waitStable(page, 1200);

    await page.locator('#canon-buttons button:has-text("core")').first().click();
    // current display should show a non-idle entry briefly
    await expect.poll(
      async () => (await page.locator('#current-display').textContent()).trim(),
      { timeout: 2500 }
    ).not.toBe('idle');
    // log should record start
    await expect(page.locator('#log')).toContainText(/start\s+core/i, { timeout: 3000 });
  });

  test('interrupt drains queue', async ({ page }) => {
    await page.goto(URL);
    await waitStable(page, 1200);

    // Stack several canons quickly so a queue forms
    await page.locator('#canon-buttons button:has-text("resonance")').first().click();
    await page.locator('#canon-buttons button:has-text("declaration")').first().click();
    await page.locator('#canon-buttons button:has-text("emit")').first().click();
    await page.waitForTimeout(150);

    await page.locator('#interrupt-btn').click();
    await page.waitForTimeout(400);
    const queue = (await page.locator('#queue-list').textContent()).trim();
    expect(queue.toLowerCase()).toContain('empty');
  });

  test('special canons (summon/revelation/leap) use forced register', async ({ page }) => {
    await page.goto(URL);
    await waitStable(page, 1200);

    await page.locator('#canon-buttons button:has-text("revelation")').first().click();
    await expect(page.locator('#log')).toContainText(/start\s+revelation\/revelation/i, { timeout: 3000 });
  });
});
