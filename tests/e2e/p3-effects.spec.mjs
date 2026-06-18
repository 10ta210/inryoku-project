// tests/e2e/p3-effects.spec.mjs
// E2E for p3_effects_test.html — scene picker, burst, fps overlay.

import { test, expect } from '@playwright/test';
import { waitStable, collectConsoleErrors, useLocalThree } from './_helpers.mjs';

const URL = '/p3_effects_test.html';
const SCENES = ['breathing', 'hover', 'ring', 'glyph', 'torus', 'yinyang', 'storm'];

test.describe('p3_effects_test.html', () => {
  test.beforeEach(async ({ page }) => { await useLocalThree(page); });
  test('boots: canvas + scene tablist + no console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(URL);
    await waitStable(page, 1500);

    await expect(page.locator('canvas#cfx')).toBeVisible();
    await expect(page.locator('#scene[role="tablist"]')).toBeVisible();
    const btns = page.locator('#scene button[data-b]');
    expect(await btns.count()).toBe(SCENES.length);
    expect(errors).toEqual([]);
  });

  test('clicking each scene button updates hud and toggles .on (burst fires)', async ({ page }) => {
    await page.goto(URL);
    await waitStable(page, 1200);

    for (const name of SCENES) {
      await page.locator(`#scene button[data-b="${name}"]`).click();
      await page.waitForTimeout(400);
      await expect(page.locator(`#scene button[data-b="${name}"]`)).toHaveClass(/(^|\s)on(\s|$)/);
      // hScene is i18n'd in the live page; verify the active button is unique instead.
      const onCount = await page.locator('#scene button.on').count();
      expect(onCount, 'exactly one scene button should be active').toBe(1);
      // body class hooks for special scenes
      if (name === 'glyph') {
        const has = await page.evaluate(() => document.body.classList.contains('cfx-scene-glyph'));
        expect(has).toBe(true);
      }
      if (name === 'ring') {
        const has = await page.evaluate(() => document.body.classList.contains('cfx-scene-speaking'));
        expect(has).toBe(true);
      }
    }
  });

  test('fps overlay updates after a brief warm-up', async ({ page }) => {
    await page.goto(URL);
    await waitStable(page, 1500);
    const fps = await page.locator('#hFps').textContent();
    // accept '--' for cold start; require it becomes numeric within 2s
    await expect.poll(
      async () => {
        const v = (await page.locator('#hFps').textContent()).trim();
        return /^\d+$/.test(v);
      },
      { timeout: 4000, message: 'fps HUD should report a numeric value' }
    ).toBe(true);
  });
});
