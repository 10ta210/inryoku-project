// tests/e2e/transitions.spec.mjs
// E2E for transitions_test.html — phase cycle P0 → P1 → P2 → P3 → inRYOKU.

import { test, expect } from '@playwright/test';
import { waitStable, collectConsoleErrors, useLocalThree } from './_helpers.mjs';

const URL = '/transitions_test.html';
const PHASES = ['P0', 'P1', 'P2', 'P3', 'inRYOKU'];

test.describe('transitions_test.html', () => {
  test.beforeEach(async ({ page }) => { await useLocalThree(page); });
  test('boots cleanly and HUD reports a phase', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(URL);
    await waitStable(page, 1200);
    const hud = await page.locator('#hud-phase').textContent();
    expect(PHASES.concat(['—'])).toContain(hud.trim());
    expect(errors).toEqual([]);
  });

  test('cycles through every phase within a reasonable window', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(URL);
    await waitStable(page, 500);

    // Collect phases observed via HUD. The test page holds each for 3s with
    // ~2s transitions; one full lap ≈ 25s.
    const seen = new Set();
    const start = Date.now();
    while (Date.now() - start < 45_000 && seen.size < PHASES.length) {
      const cur = (await page.locator('#hud-phase').textContent()).trim();
      if (PHASES.includes(cur)) seen.add(cur);
      await page.waitForTimeout(400);
    }
    for (const p of PHASES) {
      expect(seen, `phase ${p} should appear in HUD within 45s`).toContain(p);
    }
  });

  test('each transition completes (✓ marker observed) without JS errors', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectConsoleErrors(page);
    await page.goto(URL);
    await waitStable(page, 500);

    let completions = 0;
    const start = Date.now();
    while (Date.now() - start < 40_000 && completions < 3) {
      const ev = (await page.locator('#hud-event').textContent()).trim();
      if (/✓/.test(ev)) completions++;
      await page.waitForTimeout(500);
    }
    expect(completions, 'should observe ≥ 3 completed transitions in 40s').toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
  });
});
