# P3 Audio + Interaction Layer — Design

Date: 2026-05-12
Scope: inryokü P3 universe — audio synthesis (17 canon), observation +1% counter, DOM interaction wiring, percentage HUD.
Files: `cosmos-audio.js`, `cosmos-observation.js`, `cosmos-interaction.js`, `cosmos-percentage-hud.js`, `p3_audio_test.html`. All ESM, no build, no external libs.

## Philosophy hooks honored

- **観測で +1%** — every distinct interaction emits a pulse via `cosmos-observation.js`.
- **100% は無い** — counter floors at 50, ceils at 99, wraps to 50. Never displays 100.
- **円環言語 17 canon** — every audible response maps to a canon.
- **白黒禁則** — all HUD/flash colors use HSL with light=0.5; no pure white or black highlights.
- **No fullnames** — none used.

## Canon → sound mapping table

| Canon              | Synth approach                                | Frequencies (Hz)                    | Envelope a/h/r (s) | Peak |
|--------------------|-----------------------------------------------|-------------------------------------|--------------------|------|
| silence            | noop (canonical silence)                       | —                                   | —                  | 0    |
| core               | dual sine drone w/ 0.4Hz beat                  | 60 + 60.4                           | 0.08 / 0.38 / 0.18 | 0.50 |
| ma                 | sub-bass pulse + low octave                    | 45, 90                              | 0.18 / 0.18 / 0.32 | 0.55 |
| shadow             | high-pass noise + low sine bed                 | noise>3200, 110                     | 0.04 / 0.60 / 0.32 | 0.18 |
| emit               | rising exponential sweep, triangle             | A3 220 → E6 1318                    | 0.02 / 0.54 / 0.36 | 0.32 |
| observation        | shimmer ping — 5 partial bell at E5            | 659 × {1, 2.01, 3.02, 4.7, 5.43}    | 0.002 / 0.06 / 0.90| 0.35 |
| self_question      | rising minor third C5 → Eb5                    | 523, 622                            | 0.02 / 0.40 / 0.34 | 0.28 |
| declaration        | square attack + octave triangle + noise tick   | A4 440, A5 880, noise               | 0.002 / 0.10 / 0.20| 0.32 |
| leap               | octave jump A3 → A5                            | 220 → 880                           | staggered          | 0.30 |
| resonance          | sustained 3-note chord (C–E–G)                 | 261.6, 329.6, 392.0                 | 0.06 / 0.90 / 0.50 | 0.32 |
| consensus          | warm major (C–E–G–C) sine + triangle blend     | 261.6, 329.6, 392.0, 523.3          | 0.05 / 0.70 / 0.60 | 0.28 |
| past_speculation   | reversed bell — swell-in, hard cut             | E5 + G5×2.01                        | swell 0.9 / cut 0.06| 0.35 |
| future_command     | 16th-note square stutter at E5                 | 659 × 8 ticks @ 70ms                | 0.002 / 0.02 / 0.04| 0.18 |
| echo               | feedback delay (0.18s, fb 0.55) on 3 taps      | G4 392 → ×0.5 ×0.25                 | per-tap            | 0.30 |
| quotation          | pitched-down voice formant (a-vowel)           | base G3 196, BPFs 700/1220/2600     | 0.04 / 0.50 / 0.40 | 0.12 |
| summon             | low rumble crescendo, lowpass sweep            | C2 32.7 → C2 65.4 + C2→C3 saw       | 0 → 1.4 / 1.8      | 0.45 |
| revelation         | RGBCMY 6-tone chord + shimmer + sweep          | C4 E4 G4 A4 B4 D5 + E5 partials     | 0.04 / 0.60 / 1.00 | 0.46 |

RGBCMY map: R=C4, G=E4, B=G4, C=A4, M=B4, Y=D5 — RGB lower (light=精神=深い基音), CMY upper (色=物質=高音).

All output goes through `master gain → DynamicsCompressor (limiter) → Analyser → destination`. Limiter prevents clipping on stacked canons (`-8dB threshold, 6:1 ratio`).

## Interaction → pulse + canon mapping

| Event                       | Pulse source        | Canon         | Notes                                              |
|----------------------------|---------------------|---------------|----------------------------------------------------|
| First interaction (wake)   | `wakeup`            | core          | Fires once per session on idle reset.              |
| mousemove (throttled 900ms)| `mousemove`         | — (pulse only)| Audio `.pulse(0.3)` shimmer only — too noisy for canon. |
| click                      | `click`             | declaration   | Skipped when `[data-cosmos-chrome]` ancestor.      |
| scroll bottom              | `scroll-bottom`     | revelation    | 4s re-arm to avoid repeats.                        |
| key `r`/`R`                | `key-r`             | resonance     |                                                    |
| key `i`/`I`                | `key-i`             | revelation    |                                                    |
| key `m`/`M`                | — (no pulse)        | —             | Toggles mute.                                      |
| any other key              | `keypress`          | —             |                                                    |
| Konami ↑↑↓↓←→←→ba          | `konami:<canon>`×17 | full sequence | 380ms gap, philosophical order.                    |
| idle 30s                   | —                   | silence       | No pulse; silence is the absence of observation.   |
| mic blow (>0.32 RMS, 120ms)| `mic-blow`          | emit          | Only when mic explicitly enabled.                  |

Konami sequence order (philosophical): silence → core → ma → shadow → echo → observation → self_question → past_speculation → quotation → emit → declaration → resonance → consensus → future_command → leap → summon → revelation.

## Observation counter math

- Storage: `localStorage["inryoku.observation.v1"]` = `{ pct, total, lastAt, history[32] }`.
- Floor = 50, Ceil = 99. `next = pct + 1; if (next > 99) next = 50`.
- Debounce: same-source pulses within 80ms collapse — protects against mousemove flood.
- RGB/CMY decomposition: history items cycle R→G→B→C→M→Y by index. HUD bar segment widths reflect color counts in last 32 pulses (the universe's recent palette).
- `wrapped` flag emitted on the rollover pulse; HUD flashes magenta-tinted instead of gold.

## Audio context lifecycle

1. **Gesture-gated start** — `audio.start()` must be called from within a `click`/`keydown`. `p3_audio_test.html` enforces this with a "観測を始める" full-screen overlay. `AudioContext` is constructed lazily inside `ensureCtx()`, only after start.
2. **Page visibility** — `visibilitychange` handler suspends ctx when hidden, resumes when foregrounded (if `started`).
3. **Mute** — `setMuted(true)` ramps master gain to 0 via `setTargetAtTime` (no zipper noise). Ctx remains running for analyzer continuity.
4. **Dispose** — disconnects mic, closes ctx, nulls references. Safe to GC.
5. **Reduced motion / forced silent** — `prefersReducedMotion()` checked at construct; `silentMode()` short-circuits `play`, `pulse`, `start`. No ctx is even created. Mic request is refused.
6. **No allocations per frame** — analyzer typed arrays (`spectrumBuf`, `waveformBuf`, `micSpectrumBuf`) are pre-allocated.

## Mobile considerations

- `latencyHint: 'interactive'` on context.
- iOS unlock: gesture overlay also satisfies WebKit's "user gesture required to resume" rule. `ctx.resume()` is called after construction.
- Compressor used as soft limiter — prevents peak overload on small speakers.
- Smaller fftSize (1024) keeps per-frame analyzer cheap on mid-tier mobile (≈0.05ms).

## Accessibility

- **No audio without user gesture** — enforced both by browser policy and explicit overlay UX.
- **Mute toggle** — `m` key + chrome button, `aria-pressed` updated.
- **prefers-reduced-motion** — silences ambient audio entirely (`forceSilent=true` at construct). Per-pulse `audio.play()` becomes a noop. HUD removes its transitions via media query.
- **`aria-live="polite"` HUD** — percentage changes announced without flooding (debounced naturally by `setTimeout`-based tween).
- **Mic opt-in** — never requested without explicit button press. `getUserMedia` permission propagates errors silently to UI.

## Cooperation needed with `cosmos-layer.js`

To wire this into the live P3 page (not just the test page), `cosmos-layer.js` would need:

1. An exported reference (or window-bus) to the constellation render loop so `audio.getSpectrum()` can drive their `audio reaction` field (the project memory notes "固有呼吸 + audio 反応").
2. A hook to receive `observation.onPulse(...)` events and feed them into the Light Bridge trigger (suggest: every N=10 pulses primes an early bridge).
3. A `body.inryoku-speaking` listener already exists from particle_speech_rings — `cosmos-audio` does not touch it, but a future revision could duck master gain by -6dB while speaking rings are active.

No edits to `cosmos-layer.js` were made — these are integration notes for a follow-up.
