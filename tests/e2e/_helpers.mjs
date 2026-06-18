// tests/e2e/_helpers.mjs
// Shared helpers for inryokü E2E tests. Keep this small and pure.

export const STABILIZE_MS = 2000;   // post-load animation settle window
export const FRAME_BUDGET_MS = 500; // single-frame UI assertion budget

/**
 * Production CSP blocks the unpkg.com importmap that the P3 test pages use.
 * The locally vendored three.js is incomplete (missing AfterimagePass etc.),
 * so the simplest reliable approach is to strip CSP headers from HTML
 * responses during E2E so unpkg loads. The server is otherwise unmodified.
 *
 * Call BEFORE page.goto().
 */
export async function useLocalThree(page) {
  await page.route(/\.html(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.body();
    const headers = { ...response.headers() };
    // Drop policies that block third-party module/script loads in tests.
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];
    delete headers['cross-origin-embedder-policy'];
    delete headers['cross-origin-opener-policy'];
    delete headers['cross-origin-resource-policy'];
    await route.fulfill({ response, body, headers });
  });
}

/**
 * Wait for the page to be visually stable: networkidle + 2s after first paint.
 * Returns when both have elapsed.
 */
export async function waitStable(page, ms = STABILIZE_MS) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/**
 * Collect console errors. Returns an array that mutates during page lifetime.
 * Filters known noise (favicon 404, importmap warnings on webkit, three.js info).
 */
export function collectConsoleErrors(page) {
  const errors = [];
  const IGNORE = [
    /favicon/i,
    /importmap/i,
    /three.module/i,
    /Failed to load resource.*favicon/i,
    /AudioContext was not allowed to start/i,    // expected pre-gesture
    /The play\(\) request was interrupted/i,
    /webkit.*Unrecognized Content-Security-Policy/i
  ];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (IGNORE.some((rx) => rx.test(text))) return;
      errors.push(text);
    }
  });
  page.on('pageerror', (err) => {
    const text = String(err?.message || err);
    if (IGNORE.some((rx) => rx.test(text))) return;
    errors.push(text);
  });
  return errors;
}

/**
 * Wait until the page exposes window.__p3 with a getState() method.
 * Returns the state snapshot.
 */
export async function waitForP3Boot(page, timeoutMs = 10_000) {
  await page.waitForFunction(
    () => typeof window.__p3 === 'object' &&
          window.__p3 !== null &&
          typeof window.__p3.getState === 'function',
    null,
    { timeout: timeoutMs }
  );
  return page.evaluate(() => window.__p3.getState());
}

/**
 * Move the mouse in a small loop to trigger observation pulses.
 */
export async function pumpMouseMoves(page, n = 12, step = 24) {
  let x = 200, y = 200;
  for (let i = 0; i < n; i++) {
    x += step; y += step;
    await page.mouse.move(x % 800 + 50, y % 600 + 50);
    await page.waitForTimeout(60);
  }
}

/**
 * Click the audio gesture overlay if present (best-effort).
 */
export async function dismissGesture(page) {
  // unified test uses .cosmos-audio-gate
  // audio/logo tests use #gesture > #enter or pointerdown anywhere
  const gate = page.locator('.cosmos-audio-gate');
  if (await gate.count()) {
    await gate.first().click({ trial: false }).catch(() => {});
    await page.waitForTimeout(300);
    return;
  }
  const enter = page.locator('#enter, #gesture button').first();
  if (await enter.count() && await enter.isVisible().catch(() => false)) {
    await enter.click().catch(() => {});
    await page.waitForTimeout(300);
    return;
  }
  // fallback: click center to satisfy pointerdown listeners
  const vp = page.viewportSize() || { width: 800, height: 600 };
  await page.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
  await page.waitForTimeout(300);
}
