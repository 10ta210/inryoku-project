// tests/e2e/visual/visual.spec.mjs
// Visual regression baselines for the P3 stages.
// We use Playwright's toHaveScreenshot with a generous tolerance — animated
// WebGL content has natural frame variance. Baselines live in __snapshots__/.
//
// To (re)generate baselines:
//   npm run test:e2e:update -- tests/e2e/visual/visual.spec.mjs

import { test, expect } from '@playwright/test';
import { waitStable, waitForP3Boot, dismissGesture, useLocalThree } from '../_helpers.mjs';

const BEHAVIORS = [
  'breathing_sphere', 'attractor_hover', 'ring_resonance',
  'convergence_glyph', 'light_bridge_accent', 'idle_static'
];

const CANONS = [
  'silence', 'core', 'ma', 'shadow', 'emit', 'observation',
  'self_question', 'declaration', 'leap', 'resonance', 'consensus',
  'past_speculation', 'future_command', 'echo', 'quotation',
  'summon', 'revelation'
];

// Visual tests only run on chromium for stable baselines.
test.describe('visual regression', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'baselines pinned to chromium');
  test.beforeEach(async ({ page }) => { await useLocalThree(page); });

  test('p3_unified_test default state', async ({ page }) => {
    await page.goto('/p3_unified_test.html?reduce=1');
    await waitForP3Boot(page);
    await waitStable(page, 2000);
    await expect(page).toHaveScreenshot('unified-default.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.10
    });
  });

  for (const id of BEHAVIORS) {
    test(`p3_unified_test behavior: ${id}`, async ({ page }) => {
      // ?reduce=1 + URL behavior fixes the canvas to a deterministic state.
      await page.goto(`/p3_unified_test.html?reduce=1&behavior=${id}`);
      await waitForP3Boot(page);
      await waitStable(page, 2000);
      // In reduce mode behavior is forced to idle_static unless URL override.
      // The url override beats reduce-motion (see loader.test.mjs).
      await expect(page).toHaveScreenshot(`unified-${id}.png`, {
        maxDiffPixelRatio: 0.10
      });
    });
  }

  for (const c of CANONS) {
    test(`logo-speech glyph: ${c}`, async ({ page }) => {
      await page.goto('/p3_logo_speech_test.html');
      await waitStable(page, 1500);
      // Force reduced-motion so the glyph holds steady for capture
      await page.locator('#reduced-toggle').check();
      await page.waitForTimeout(200);
      await page.locator(`#canon-buttons button:has-text("${c}")`).first().click();
      await page.waitForTimeout(900); // glyph render settle
      const stage = page.locator('#stage');
      await expect(stage).toHaveScreenshot(`logo-${c}.png`, {
        maxDiffPixelRatio: 0.15
      });
    });
  }

  test('p1_upgrade_preview at boot', async ({ page }) => {
    await page.goto('/p1_upgrade_preview.html');
    await waitStable(page, 1500);
    await expect(page).toHaveScreenshot('p1-boot.png', { maxDiffPixelRatio: 0.10 });
  });

  test('p1_upgrade_preview post-handoff', async ({ page }) => {
    await page.goto('/p1_upgrade_preview.html');
    // boot sequence is timed; wait for handoff window then capture
    await waitStable(page, 8000);
    await expect(page).toHaveScreenshot('p1-post-handoff.png', { maxDiffPixelRatio: 0.15 });
  });

  test('p2_upgrade_preview idle', async ({ page }) => {
    await page.goto('/p2_upgrade_preview.html');
    await waitStable(page, 2500);
    await expect(page).toHaveScreenshot('p2-idle.png', { maxDiffPixelRatio: 0.12 });
  });

  test('p2_upgrade_preview 101% revealed', async ({ page }) => {
    await page.goto('/p2_upgrade_preview.html');
    await waitStable(page, 1800);
    // Hover the right-side region where the 101% sphere reveals
    const vp = page.viewportSize();
    await page.mouse.move(vp.width * 0.72, vp.height * 0.5);
    await page.waitForTimeout(400);
    // hold hover by jittering slightly
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(vp.width * 0.72 + (i % 2 ? 4 : -4), vp.height * 0.5);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('p2-revealed.png', { maxDiffPixelRatio: 0.15 });
  });

  for (const phase of ['P1', 'P2', 'P3', 'inRYOKU']) {
    test(`transitions midpoint: → ${phase}`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto('/transitions_test.html');
      await waitStable(page, 500);
      // Poll HUD until we see the transition arrow toward target phase, then
      // snap immediately for the mid-frame.
      const start = Date.now();
      while (Date.now() - start < 50_000) {
        const ev = (await page.locator('#hud-event').textContent()).trim();
        if (ev.includes(`→ ${phase}`) && !ev.includes('✓')) break;
        await page.waitForTimeout(150);
      }
      // Capture immediately — this is intentionally mid-animation. Tolerance is
      // wide to absorb variance.
      await expect(page).toHaveScreenshot(`transition-to-${phase}.png`, {
        maxDiffPixelRatio: 0.25
      });
    });
  }
});
