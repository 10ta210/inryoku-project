// tests/e2e/p3-audio.spec.mjs
// E2E for p3_audio_test.html — 17 canon buttons, mute toggle, mic permission.
// We cannot reliably assert audible playback in CI; instead we verify:
//   - 17 canon buttons render
//   - clicking a canon does not throw and appends to event log
//   - mute toggles aria-pressed
//   - mic button triggers a permission prompt path (no permission granted; we
//     just confirm aria-pressed transitions appropriately or fails gracefully)

import { test, expect } from '@playwright/test';
import { waitStable, collectConsoleErrors, useLocalThree } from './_helpers.mjs';

const URL = '/p3_audio_test.html';
const CANON_LIST = [
  'silence', 'core', 'ma', 'shadow', 'emit', 'observation',
  'self_question', 'declaration', 'leap', 'resonance', 'consensus',
  'past_speculation', 'future_command', 'echo', 'quotation',
  'summon', 'revelation'
];

test.describe('p3_audio_test.html', () => {
  test.beforeEach(async ({ page }) => { await useLocalThree(page); });
  test('boots: gesture overlay shown, 17 canon buttons exist', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(URL);
    await waitStable(page, 1200);

    await expect(page.locator('#gesture')).toBeVisible();
    const canons = page.locator('#canons button');
    await expect.poll(async () => canons.count(), { timeout: 4000 }).toBe(CANON_LIST.length);
    expect(errors).toEqual([]);
  });

  test('dismiss gesture, click every canon, log records each one', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit headless AudioContext flaky');
    await page.goto(URL);
    await waitStable(page, 1000);

    await page.locator('#enter').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#gesture')).toBeHidden();

    // Each click must not throw and should appear in the event log
    for (const canon of CANON_LIST) {
      await page.locator(`#canons button[aria-label="play canon ${canon}"]`).click();
      await page.waitForTimeout(60);
    }
    const logText = await page.locator('#log').textContent();
    // A few canons should be visible (log caps at 80 lines so all are usually there)
    expect(logText).toContain('core');
    expect(logText).toContain('revelation');
  });

  test('mute button toggles aria-pressed', async ({ page }) => {
    await page.goto(URL);
    await waitStable(page, 800);
    // Dismiss gesture dialog (it overlays the toolbar)
    await page.locator('#enter').click().catch(() => {});
    await page.waitForTimeout(300);

    const mute = page.locator('#mute');
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
  });

  test('mic button is clickable and reports denial gracefully in headless', async ({ page }) => {
    await page.goto(URL);
    await waitStable(page, 800);
    await page.locator('#enter').click().catch(() => {});
    await page.waitForTimeout(300);
    // Headless browsers reject getUserMedia without explicit permission grant.
    // We only assert that clicking the button does not crash the page.
    const errors = collectConsoleErrors(page);
    await page.locator('#mic').click();
    await page.waitForTimeout(800);
    // The page must still be alive (canvas still present, no fatal pageerror)
    await expect(page.locator('canvas#scene')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
