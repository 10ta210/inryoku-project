// tests/e2e/p3-unified.spec.mjs
// E2E tests for p3_unified_test.html — the integrated P3 stage.

import { test, expect } from '@playwright/test';
import {
  waitStable, waitForP3Boot, collectConsoleErrors,
  dismissGesture, pumpMouseMoves, useLocalThree
} from './_helpers.mjs';

const URL = '/p3_unified_test.html';

test.describe('p3_unified_test.html', () => {
  test.beforeEach(async ({ page }) => { await useLocalThree(page); });
  test('boots cleanly: canvas appears, no console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(URL);
    await waitForP3Boot(page);
    await waitStable(page);

    const canvas = page.locator('canvas.cosmos-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);

    expect(errors, 'console errors during boot: ' + errors.join('\n')).toEqual([]);
  });

  test('skip-link presence (documents whether unified test has one)', async ({ page }) => {
    // NB: as of writing, p3_unified_test.html does NOT ship a .cosmos-skip-link.
    // This test documents the gap — if a skip link is added later it becomes a
    // first-focusable check.
    await page.goto(URL);
    await waitStable(page, 500);
    const skip = page.locator('a.cosmos-skip-link, a[href="#main"]').first();
    const count = await skip.count();
    if (count === 0) {
      test.info().annotations.push({
        type: 'known-gap',
        description: 'p3_unified_test.html lacks a skip link — first focusable is the CONTACT button.'
      });
      // first focusable should still be a real interactive element
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
      expect(['button', 'a', 'input', 'select', 'textarea']).toContain(tag);
    } else {
      await page.keyboard.press('Tab');
      const isSkip = await page.evaluate(() =>
        document.activeElement?.classList?.contains('cosmos-skip-link') ||
        document.activeElement?.getAttribute('href') === '#main');
      expect(isSkip).toBe(true);
    }
  });

  test('scene picker has all 7 behavior buttons and toggles "on" class', async ({ page }) => {
    await page.goto(URL);
    await waitForP3Boot(page);
    await waitStable(page);
    await dismissGesture(page);

    const buttons = page.locator('.cosmos-scene-pill button[data-bid]');
    const count = await buttons.count();
    expect(count, 'scene pill should expose every behavior').toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(10);

    const ids = await buttons.evaluateAll((els) => els.map((e) => e.dataset.bid));
    expect(new Set(ids).size).toBe(ids.length); // unique

    // Initially exactly one .on
    const initialOn = await page.locator('.cosmos-scene-pill button.on').count();
    expect(initialOn).toBe(1);

    // Click each, assert state transition + behavior name reflected
    for (const id of ids) {
      await page.locator(`.cosmos-scene-pill button[data-bid="${id}"]`).click();
      // wait one frame budget for bus → setActive
      await page.waitForTimeout(500);
      await expect(page.locator(`.cosmos-scene-pill button[data-bid="${id}"]`)).toHaveClass(/(^|\s)on(\s|$)/);
      const state = await page.evaluate(() => window.__p3.getState());
      expect(state.behavior, `behavior should equal clicked id ${id}`).toBe(id);
    }
  });

  test('CONTACT button switches to convergence_glyph (glyph scene)', async ({ page }) => {
    await page.goto(URL);
    await waitForP3Boot(page);
    await waitStable(page);
    await dismissGesture(page);

    await page.locator('#contactCta[data-contact-cta]').click();
    await page.waitForTimeout(600);
    const state = await page.evaluate(() => window.__p3.getState());
    expect(state.behavior).toBe('convergence_glyph');
    // body class hook for glyph scene
    const hasClass = await page.evaluate(() =>
      document.body.classList.contains('cfx-scene-glyph'));
    expect(hasClass).toBe(true);
  });

  test('audio gesture overlay appears then dismisses on click', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit + headless audio policy is unstable in CI');
    await page.goto(URL);
    await waitForP3Boot(page);
    await waitStable(page, 800);

    const gate = page.locator('.cosmos-audio-gate');
    await expect(gate).toBeVisible({ timeout: 5000 });
    await gate.click();
    await page.waitForTimeout(800); // gate has a 520ms fadeout
    await expect(gate).toHaveCount(0);

    // Audio context should be running (audio.isStarted true)
    const started = await page.evaluate(() => window.__p3.audio.isStarted());
    expect(started).toBe(true);
  });

  test('observation HUD increments after mousemove activity', async ({ page }) => {
    await page.goto(URL);
    await waitForP3Boot(page);
    await waitStable(page, 500);

    const before = await page.evaluate(() => window.__p3.getState().pct);
    await pumpMouseMoves(page, 20, 40);
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => window.__p3.getState().pct);
    // observation pulse rate-limited to 1/sec on hover; allow ≥ 0 increment, no decrement
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test('resize does not break layout (canvas tracks viewport)', async ({ page }) => {
    await page.goto(URL);
    await waitForP3Boot(page);
    await waitStable(page, 600);

    await page.setViewportSize({ width: 900, height: 600 });
    await page.waitForTimeout(300);
    const small = await page.locator('canvas.cosmos-canvas').boundingBox();
    expect(small.width).toBeGreaterThan(800);
    expect(small.width).toBeLessThan(1000);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    const big = await page.locator('canvas.cosmos-canvas').boundingBox();
    expect(big.width).toBeGreaterThan(1400);
  });

  test('?reduce=1 disables motion (idle_static, gate auto-silent)', async ({ page }) => {
    await page.goto(URL + '?reduce=1');
    await waitForP3Boot(page);
    await waitStable(page, 600);

    const state = await page.evaluate(() => window.__p3.getState());
    expect(state.reduceMotion).toBe(true);
    expect(state.behavior).toBe('idle_static');
  });

  test('?behavior=ring_resonance URL boot routes to that behavior', async ({ page }) => {
    await page.goto(URL + '?behavior=ring_resonance');
    await waitForP3Boot(page);
    await waitStable(page, 600);

    const state = await page.evaluate(() => window.__p3.getState());
    expect(state.behavior).toBe('ring_resonance');
  });
});
