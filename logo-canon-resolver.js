// logo-canon-resolver.js
// Pure deterministic mapping from (intent, tone, certainty, direction) → { canon, register }.
// AI integration point for inryokü logo speech.
//
// Inputs:
//   intent    ∈ {greet, question, assert, conclude, doubt, agree, summon, reveal, silence, quote}
//   tone      ∈ {neutral, warm, cold, urgent, gentle, intense}
//   certainty ∈ [0, 1]
//   direction ∈ {inward, outward}
//
// Output: { canon, register }
// Canon ∈ 17-canon set (see logo-glyph.js).
// Register ∈ {whisper, hover, click, summon, revelation}.

const VALID_INTENTS = new Set([
  'greet', 'question', 'assert', 'conclude', 'doubt', 'agree',
  'summon', 'reveal', 'silence', 'quote'
]);
const VALID_TONES = new Set([
  'neutral', 'warm', 'cold', 'urgent', 'gentle', 'intense'
]);
const VALID_DIRS = new Set(['inward', 'outward']);

// Canon default register (used before tone/certainty perturbations).
const CANON_DEFAULT_REGISTER = {
  silence: 'whisper',
  core: 'whisper',
  ma: 'whisper',
  shadow: 'whisper',
  echo: 'whisper',
  emit: 'click',
  observation: 'hover',
  self_question: 'hover',
  declaration: 'click',
  leap: 'summon',
  resonance: 'click',
  consensus: 'click',
  past_speculation: 'hover',
  future_command: 'click',
  quotation: 'hover',
  summon: 'summon',
  revelation: 'revelation'
};

const REGISTER_LADDER = ['whisper', 'hover', 'click', 'summon', 'revelation'];

function bumpRegister(reg, delta) {
  const i = REGISTER_LADDER.indexOf(reg);
  if (i < 0) return reg;
  const j = Math.max(0, Math.min(REGISTER_LADDER.length - 1, i + delta));
  return REGISTER_LADDER[j];
}

function safe(intent, tone, dir) {
  return {
    intent: VALID_INTENTS.has(intent) ? intent : 'silence',
    tone: VALID_TONES.has(tone) ? tone : 'neutral',
    direction: VALID_DIRS.has(dir) ? dir : 'outward'
  };
}

// Base canon picker — intent-dominant.
function baseCanon(intent, certainty, direction) {
  switch (intent) {
    case 'greet':     return 'core';
    case 'question':  return direction === 'inward' ? 'self_question' : 'observation';
    case 'assert':    return 'declaration';
    case 'conclude':  return 'consensus';
    case 'doubt':     return certainty < 0.30 ? 'past_speculation' : 'self_question';
    case 'agree':     return 'resonance';
    case 'summon':    return 'summon';
    case 'reveal':    return 'revelation';
    case 'silence':   return 'silence';
    case 'quote':     return 'quotation';
    default:          return 'core';
  }
}

// Tone × intent perturbations. Returns the (possibly) overridden canon.
function applyTone(canon, intent, tone, certainty, direction) {
  // Urgent
  if (tone === 'urgent' && intent === 'assert') return 'future_command';
  if (tone === 'urgent' && intent === 'summon') return 'revelation';
  if (tone === 'urgent' && intent === 'question') return 'future_command';

  // Intense
  if (tone === 'intense' && intent === 'agree') return 'consensus';
  if (tone === 'intense' && intent === 'reveal') return 'revelation';
  if (tone === 'intense' && intent === 'assert' && certainty >= 0.9) return 'leap';

  // Gentle
  if (tone === 'gentle' && intent === 'question') return 'self_question';
  if (tone === 'gentle' && intent === 'assert')   return 'emit';
  if (tone === 'gentle' && intent === 'reveal')   return 'emit';
  if (tone === 'gentle' && intent === 'greet')    return 'ma';

  // Warm
  if (tone === 'warm' && intent === 'greet') return 'ma';
  if (tone === 'warm' && intent === 'agree' && direction === 'outward') return 'echo';
  if (tone === 'warm' && intent === 'agree') return 'resonance';

  // Cold
  if (tone === 'cold' && intent === 'silence') return 'shadow';
  if (tone === 'cold' && intent === 'question' && certainty < 0.30) return 'shadow';
  if (tone === 'cold' && intent === 'conclude') return 'past_speculation';

  // Direction overrides
  if (direction === 'inward'  && intent === 'reveal') return 'quotation';
  if (direction === 'outward' && intent === 'agree' && tone !== 'warm') return 'consensus';
  if (direction === 'inward'  && intent === 'assert' && tone === 'neutral') return 'self_question';

  return canon;
}

// Certainty-based register adjustment.
function adjustRegister(register, tone, certainty) {
  let r = register;
  if (certainty >= 0.85) r = bumpRegister(r, +1);
  if (certainty < 0.30)  r = bumpRegister(r, -1);
  // Tone modulation
  if (tone === 'cold')   r = bumpRegister(r, -1);
  if (tone === 'gentle') r = bumpRegister(r, -1);
  if (tone === 'urgent') r = bumpRegister(r, +1);
  if (tone === 'intense') r = bumpRegister(r, +1);
  return r;
}

export function resolveCanon(intent, tone, certainty, direction) {
  const s = safe(intent, tone, direction);
  const cert = typeof certainty === 'number' && certainty >= 0 && certainty <= 1
    ? certainty
    : 0.5;

  let canon = baseCanon(s.intent, cert, s.direction);
  canon = applyTone(canon, s.intent, s.tone, cert, s.direction);

  // Special canons override default register.
  if (canon === 'summon')     return { canon, register: 'summon' };
  if (canon === 'revelation') return { canon, register: 'revelation' };

  const baseReg = CANON_DEFAULT_REGISTER[canon] || 'whisper';
  const register = adjustRegister(baseReg, s.tone, cert);
  return { canon, register };
}

// Useful for UIs / tests.
export const INTENTS = Object.freeze(Array.from(VALID_INTENTS));
export const TONES = Object.freeze(Array.from(VALID_TONES));
export const DIRECTIONS = Object.freeze(Array.from(VALID_DIRS));
export const REGISTERS = Object.freeze(REGISTER_LADDER.slice());

export default resolveCanon;
