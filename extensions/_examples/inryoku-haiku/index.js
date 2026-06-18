// extensions/_examples/inryoku-haiku/index.js
// Haiku extension — adds a single command that recites a poem as a
// 5-7-5 sequence of canons (17 syllables → 17 canons, one per beat).
//
// The command emits each canon by calling ctx.speak(canon) if provided,
// else collects them into an array which it returns. This makes the
// command testable without a running logo-speech host.

const POEM = [
  // 5
  'core', 'ma', 'echo', 'shadow', 'silence',
  // 7
  'observation', 'self_question', 'past_speculation', 'leap', 'resonance', 'declaration', 'consensus',
  // 5
  'emit', 'quotation', 'future_command', 'summon', 'revelation'
];

async function recite(ctx) {
  const ctxOrEmpty = ctx || {};
  const emitted = [];
  const speak = typeof ctxOrEmpty.speak === 'function' ? ctxOrEmpty.speak : null;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  for (let i = 0; i < POEM.length; i++) {
    const canon = POEM[i];
    emitted.push(canon);
    if (speak) {
      try { await speak(canon); } catch (_) { /* skip */ }
    }
    if (ctxOrEmpty.delayMs) await wait(ctxOrEmpty.delayMs);
  }
  return { canons: emitted, meter: [5, 7, 5] };
}

export default {
  commands: [
    {
      id: 'haiku.recite',
      label: 'Recite haiku (17 canons, 5-7-5)',
      run: recite
    }
  ]
};

// Test-only named export so unit tests can drive the poem deterministically.
export { POEM, recite };
