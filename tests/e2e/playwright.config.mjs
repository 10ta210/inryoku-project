// tests/e2e/playwright.config.mjs
// Playwright configuration for inryokü P3 E2E + visual regression.
// - webServer: spins up server.js on port 3000 (the canonical source of truth)
// - browsers:  chromium + webkit (macOS / Safari parity)
// - retries:   2 — animated WebGL content has minor frame timing variance
// - screenshot only-on-failure, trace on-first-retry
// - output:    tests/e2e/results/

import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.spec.mjs', 'visual/**/*.spec.mjs'],
  outputDir: './results/',
  snapshotDir: './visual/__snapshots__',
  fullyParallel: false,            // canvas/audio contexts dislike heavy parallelism
  workers: process.env.CI ? 2 : 2,
  retries: 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: './results/html' }]],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    // Visual regression tolerance — animated WebGL content has natural variance.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.10,
      threshold: 0.2,
      animations: 'allow'
    }
  },
  use: {
    baseURL: BASE,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    // grant microphone permission no-op; tests do not actually use mic
    permissions: [],
    launchOptions: {
      args: ['--autoplay-policy=no-user-gesture-required']
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } }
    }
  ],
  webServer: {
    command: 'node server.js',
    cwd: '../..',                // project root (server.js lives there)
    url: BASE + '/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { PORT: String(PORT) }
  }
});
