// inryoku-gate.js
// Gating logic for the inRYOKU 裏ルート.
//
// Two entry paths (either suffices):
//   1) P2 password gate — front route. Sets localStorage `__inryokuP2Password`.
//   2) P3 6色合体 — back route. revelation canon observed in all 6 RGBCMY colours,
//      checkpointed by phase-bus / logo-speech into localStorage `__inryokuSixColorState`.
//
// If neither holds, redirect to P3 with a soft message in sessionStorage.
//
// ESM, no build. Browser only.

const P2_KEY     = '__inryokuP2Password';
const SIX_KEY    = '__inryokuSixColorState';
const MSG_KEY    = '__inryokuGateMsg';
const REDIRECT   = '/p3_test.html'; // production: '/'  — but P3 lives at root with /p3_test.html as dev entry

const UNLOCK_THRESHOLD = 0.95;
const REQUIRED_COLORS = ['r', 'g', 'b', 'c', 'm', 'y'];

function readLS(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

/** True if the P2 password gate has been satisfied. */
export function hasP2Password() {
  const v = readLS(P2_KEY);
  return !!(v && v.length > 0);
}

/** True if all 6 RGBCMY colours have been observed past threshold. */
export function hasSixColorMerge() {
  const state = readJSON(SIX_KEY);
  if (!state || typeof state !== 'object') return false;
  for (const k of REQUIRED_COLORS) {
    if ((state[k] || 0) < UNLOCK_THRESHOLD) return false;
  }
  return true;
}

/** The gate. Either path opens it. */
export function canEnterInryoku() {
  return hasP2Password() || hasSixColorMerge();
}

/** Best-effort reason string (for diagnostics; not shown). */
export function gateReason() {
  if (hasP2Password()) return 'p2-password';
  if (hasSixColorMerge()) return 'six-color-merge';
  return 'locked';
}

/**
 * Enforce the gate. If locked, write a soft message to sessionStorage and redirect.
 * Returns true if the page may proceed; false if a redirect was issued.
 */
export function enforceGate(opts = {}) {
  if (canEnterInryoku()) return true;
  const target = opts.redirectTo || REDIRECT;
  try {
    sessionStorage.setItem(MSG_KEY,
      '裏ルートはまだ開いていない。6色を観測するか、合言葉を持って戻る。');
  } catch (_) {}
  try { location.replace(target); } catch (_) { location.href = target; }
  return false;
}

/**
 * Record a colour observation. Called by phase-bus listeners (logo-speech revelation events).
 * key: 'r'|'g'|'b'|'c'|'m'|'y'. value defaults to 1.0.
 */
export function recordColorObservation(key, value) {
  if (!REQUIRED_COLORS.includes(key)) return;
  const state = readJSON(SIX_KEY) || {};
  state[key] = Math.max(state[key] || 0, value == null ? 1.0 : value);
  state.updatedAt = Date.now();
  try { localStorage.setItem(SIX_KEY, JSON.stringify(state)); } catch (_) {}
}

export default { canEnterInryoku, hasP2Password, hasSixColorMerge, enforceGate, gateReason, recordColorObservation };
