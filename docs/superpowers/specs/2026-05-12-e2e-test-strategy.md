# P3 E2E + Visual Regression Test Strategy

**Date:** 2026-05-12
**Status:** Initial drop — P3 upgrade tests live under `tests/e2e/`
**Stack:** Playwright (chromium + webkit on macOS), Playwright snapshot diff

---

## Scope

E2E coverage for the five P3 test harness pages plus the two phase-preview pages:

| Page | What we assert |
|------|----------------|
| `p3_unified_test.html` | boot, canvas, no console errors, scene-picker 7 buttons, behavior toggle, CONTACT → glyph, audio gesture overlay dismiss → ctx running, observation HUD increments, resize tracks viewport, `?reduce=1` forces idle_static, `?behavior=ring_resonance` URL boot |
| `p3_effects_test.html` | 7-scene tablist, picker toggles `.on`, HUD label updates, FPS counter ticks |
| `p3_audio_test.html` | gesture overlay present, 17 canon buttons render, each canon clickable without crash, log records playback, mute aria-pressed toggles, mic button does not crash on denial |
| `p3_logo_speech_test.html` | 17 canon glyph buttons, click sets current ≠ idle, log records start, special canons (revelation/summon/leap) use forced register, interrupt drains queue |
| `transitions_test.html` | HUD shows valid phase, all 5 phases observed within 45 s, ≥3 transitions complete with ✓ marker, no console errors |
| `p1_upgrade_preview.html` (visual) | boot baseline, post-handoff baseline |
| `p2_upgrade_preview.html` (visual) | idle baseline, 101%-revealed-on-hover baseline |

Visual snapshots use `toHaveScreenshot()` with `maxDiffPixelRatio: 0.10–0.25` depending on motion content. Baselines are committed under `tests/e2e/visual/__snapshots__/`.

## What is NOT covered

- **Audible audio playback** — headless browsers cannot reliably emit audio; we only assert API plumbing (analyzer level / log entries).
- **Microphone capture** — `getUserMedia` is denied in headless without explicit grant. We only assert the UI does not crash.
- **WebGPU paths** — the test harness boots WebGL2; WebGPU variants have separate fixtures.
- **Frame-perfect animation timing** — we wait `networkidle + 2 s` and rely on tolerance thresholds.
- **iOS Safari Audio quirks** — webkit project skips audio-gesture tests because headless WebKit AudioContext is flaky.

## CI integration

Recommended GitHub Actions step:

```yaml
- run: npm ci
- run: npx playwright install --with-deps chromium webkit
- run: npm run test:e2e
- if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: tests/e2e/results/html
```

Visual baselines are platform-sensitive. Re-record on macOS (the production design platform). Linux runners produce slightly different antialiasing; consider running visual tests as a separate macOS-only job, or pinning the baselines per-platform via Playwright's snapshot suffix.

## Flake mitigation

1. **`waitForLoadState('networkidle') + 2 s settle`** before assertions on animated content. Helper: `waitStable(page, ms)` in `_helpers.mjs`.
2. **Retries: 2** in `playwright.config.mjs` — animated WebGL has natural variance.
3. **`maxDiffPixelRatio: 0.10` (rising to 0.25 for mid-transition snapshots)** absorbs subframe variance.
4. **`fullyParallel: false, workers: 2`** — multiple GPU contexts under heavy parallelism stutter on M-series.
5. **WebKit audio tests skipped** — headless WebKit AudioContext often refuses to resume even post-gesture.
6. **Console error allowlist** in `_helpers.collectConsoleErrors` filters known third-party noise (favicon, importmap, three.module info).

## Local run

```bash
# install browsers once
npx playwright install chromium webkit

# run full suite
npm run test:e2e

# interactive runner (debugging)
npm run test:e2e:ui

# regenerate visual baselines after intentional change
npm run test:e2e:update
```

Server lifecycle is managed by Playwright's `webServer` block: `node server.js` on `PORT=3000`. If a server is already running, `reuseExistingServer: true` (locally) skips re-launch.

## Files

```
tests/e2e/
├── _helpers.mjs              ~80 LOC   shared helpers
├── playwright.config.mjs     ~60 LOC   config + webServer + retries
├── p3-unified.spec.mjs       ~150 LOC  unified test
├── p3-effects.spec.mjs       ~55 LOC   effects test
├── p3-audio.spec.mjs         ~80 LOC   audio test
├── p3-logo-speech.spec.mjs   ~70 LOC   logo-speech test
├── transitions.spec.mjs      ~60 LOC   phase transitions
├── visual/
│   ├── visual.spec.mjs       ~120 LOC  screenshot baselines
│   └── __snapshots__/        committed PNGs
└── results/                  .gitignored test output (HTML report, traces)
```

## Target run time

≈ 90 s on Apple M-series for the non-visual specs (chromium + webkit parallel × 2 workers).
≈ +60 s for visual specs (chromium only).
Total: under 3 minutes.

## Bugs surfaced during E2E authoring

- **`p3_unified_test.html` ships no skip link.** Other pages (`p3_effects_test.html`, `p3_audio_test.html`, `p1_upgrade_preview.html`, `p2_upgrade_preview.html`) ship `a.cosmos-skip-link`. The unified test is the production-shape stage; it should also expose one. Documented as a soft assertion in `p3-unified.spec.mjs › skip-link presence`.
- The `audio` and `speech` runtime objects in `p3_audio_test.html` / `p3_logo_speech_test.html` are not exposed on `window`. The unified test exposes `window.__p3`. Consider mirroring that pattern for the standalone harnesses so tests can introspect analyzer level, queue depth, etc., without UI scraping.
