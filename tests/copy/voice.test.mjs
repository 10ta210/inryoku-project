// tests/copy/voice.test.mjs
// Enforces the inryokü UX copy voice (docs/superpowers/specs/2026-05-12-ux-copy-style.md)
// across the files touched in the P3 upgrade copy wave.
//
// Bans the obvious tone clashes (marketing speak, generic CTAs, emoji, 100%, !).
// Requires the canonical vocabulary (観測, 円環) to appear at least once.
//
// Run: node --test tests/copy/voice.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

const FILES_HTML = [
  'p3_unified_test.html',
  'p3_effects_test.html',
  'p3_audio_test.html',
  'p1_upgrade_preview.html',
  'p2_upgrade_preview.html',
  'p3_logo_speech_test.html',
  'transitions_test.html'
];

const FILES_JS = [
  'cosmos-percentage-hud.js',
  'cosmos-integration.js',
  'cosmos-audio.js',
  'cosmos-a11y.js'
];

const ALL_FILES = [...FILES_HTML, ...FILES_JS].map((f) => path.join(ROOT, f));

// ---------------------------------------------------------------------------
// Visible-text extractor. Pulls the strings a user could actually read.
// HTML: text between tags, plus aria-label / title / placeholder attribute
//       values. Strips <script>, <style>, HTML comments.
// JS:   double-quoted, single-quoted, and template-literal string contents.
//       Skips // and /* … */ comments to avoid flagging banned words from
//       commentary about what the code avoids.
// ---------------------------------------------------------------------------
function extractVisibleHtml(src) {
  let s = src;
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  const out = [];
  for (const m of s.matchAll(/(?:aria-label|title|placeholder|alt)\s*=\s*"([^"]*)"/gi)) {
    out.push(m[1]);
  }
  for (const m of s.matchAll(/>([^<>]+)</g)) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}

function extractStringsJs(src) {
  // Strip comments first.
  let s = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const out = [];
  for (const m of s.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'/g)) out.push(m[1]);
  for (const m of s.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)) out.push(m[1]);
  for (const m of s.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`/g)) out.push(m[1]);
  return out;
}

function visibleStrings(file) {
  const src = fs.readFileSync(file, 'utf8');
  return file.endsWith('.js') ? extractStringsJs(src) : extractVisibleHtml(src);
}

// ---------------------------------------------------------------------------
// Banned tokens. These should not appear anywhere user-visible.
// Some are word-boundary regex; some are bare substrings. Kept conservative
// to avoid false-positives on internal canon ids (e.g. 'silence' in scripts).
// ---------------------------------------------------------------------------
const BANNED = [
  { pattern: /\bclick here\b/i,                  reason: 'infantilising CTA' },
  { pattern: /\btap here\b/i,                    reason: 'infantilising CTA' },
  { pattern: /\bACTIVATE\b/,                     reason: 'shouting / marketing' },
  { pattern: /\bSTART NOW\b/i,                   reason: 'marketing imperative' },
  { pattern: /\b(awesome|amazing)\b/i,           reason: 'marketing flavor' },
  { pattern: /\bWOW\b/,                          reason: 'marketing flavor' },
  { pattern: /Are you sure\?/i,                  reason: 'nag' },
  { pattern: /Oops/i,                            reason: 'apologetic tone' },
  // 100% as user-facing percentage state is forbidden by the 50→101 canon.
  { pattern: /\b100\s*%/,                        reason: '100% violates 50→101 canon' },
  // Emoji ranges (CJK kept exempt). The site uses no emoji.
  { pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, reason: 'emoji' },
  // Exclamation in UI tone — checked separately with allowlist below.
];

// Strings allowed to contain '!' (almost none).
function isExclamationAllowed(s) {
  // Permit '!' only when it is clearly part of identifier or punctuation
  // outside the UI tone — e.g. CSS '!important' (won't appear in visible text)
  // or programmatic operators (won't appear in extracted strings either).
  // In practice, no visible string should carry '!'.
  return false;
}

// ---------------------------------------------------------------------------
// Required canonical vocabulary — at least one of these must appear across
// the combined edited surface for the wave to be considered applied.
// ---------------------------------------------------------------------------
const REQUIRED_CORPUS = [
  '観測',     // core verb
  '円環',     // canon ring language
  '静寂',     // mute state
  '101%',    // revelation marker
  '50%'      // tagline fragment — 50% → 101% appears across corner labels & HUD
];

// English fields where ALL-CAPS button labels would be tone-wrong.
// We allow CONTACT as the one branded exception per the spec.
const ALLOWED_ALLCAPS = new Set(['CONTACT', 'INRYOKÜ', 'INRYOKU', 'RGB', 'CMY', 'RGBCMY']);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('voice — banned tokens', () => {
  for (const file of ALL_FILES) {
    test(path.relative(ROOT, file), () => {
      const strings = visibleStrings(file);
      const hits = [];
      for (const s of strings) {
        // Skip inline CSS rules (`width:100%`, `100vh`, etc.) — they aren't UI copy.
        const looksLikeCss = /:\s*\d+\s*%\s*[;}]?/.test(s) || /position\s*:|display\s*:|background\s*:/.test(s);
        for (const b of BANNED) {
          if (b.reason.startsWith('100%') && looksLikeCss) continue;
          if (b.pattern.test(s)) {
            hits.push({ string: s, reason: b.reason, pattern: String(b.pattern) });
          }
        }
        // Exclamation punctuation in UI copy. Tolerate strings that are clearly
        // CSS (`!important`) or selectors.
        if (s.includes('!') && !s.includes('!important') && !isExclamationAllowed(s)) {
          hits.push({ string: s, reason: 'exclamation in UI copy', pattern: '!' });
        }
      }
      assert.deepEqual(hits, [], `banned tokens found in ${path.basename(file)}:\n` +
        hits.map(h => `  • "${h.string.slice(0,80)}"  ← ${h.reason}`).join('\n'));
    });
  }
});

describe('voice — required vocabulary present', () => {
  test('the corpus contains the canonical inryokü terms', () => {
    const corpus = ALL_FILES.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const missing = REQUIRED_CORPUS.filter((term) => !corpus.includes(term));
    assert.deepEqual(missing, [],
      'These required terms appear nowhere in the edited corpus: ' + missing.join(', '));
  });
});

describe('voice — i18n.json carries the P3 copy keys', () => {
  test('cosmos.* and p3.* keys exist with ja and en', () => {
    const i18n = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n.json'), 'utf8'));
    const requiredKeys = [
      'cosmos.gate.body', 'cosmos.mute.observing', 'cosmos.mute.silent',
      'cosmos.mic.begin', 'cosmos.mic.stop', 'cosmos.contact.aria',
      'cosmos.scene.discovery', 'cosmos.scene.speaking', 'cosmos.scene.glyph',
      'cosmos.scene.rainbow', 'cosmos.scene.yinyang', 'cosmos.scene.storm',
      'cosmos.hud.scene', 'cosmos.hud.canon', 'cosmos.hud.reduce',
      'cosmos.observe.label', 'cosmos.observe.revelation', 'cosmos.observe.wrap',
      'cosmos.announce.scene_changed', 'cosmos.help.title', 'cosmos.skip.link',
      'cosmos.canon.revelation.name', 'cosmos.canon.silence.romaji',
      'p1.boot.window', 'p2.subtitle', 'p3.title.unified'
    ];
    for (const k of requiredKeys) {
      assert.ok(i18n[k], `missing i18n key: ${k}`);
      assert.ok(i18n[k].ja, `key ${k} missing ja`);
      assert.ok(i18n[k].en, `key ${k} missing en`);
    }
  });

  test('"100%" never appears as a value in the new cosmos.* / p1.* / p2.* / p3.* keys', () => {
    const i18n = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n.json'), 'utf8'));
    const offenders = [];
    for (const [k, v] of Object.entries(i18n)) {
      if (k.startsWith('_')) continue;
      if (!/^(cosmos|p1|p2|p3|transitions)\./.test(k)) continue;
      for (const lang of ['ja', 'en']) {
        const s = v[lang] || '';
        if (/\b100\s*%/.test(s)) offenders.push(`${k}.${lang}: ${s}`);
      }
    }
    assert.deepEqual(offenders, [],
      'cosmos/p1/p2/p3 keys must not contain 100% as a hit state: ' + offenders.join(' | '));
  });

  test('17 canon kanji names are exactly the canonical set', () => {
    const i18n = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n.json'), 'utf8'));
    const expected = {
      silence: '沈黙', core: '中心', ma: '間', shadow: '影', emit: '放出',
      observation: '観測', self_question: '自問', declaration: '宣言',
      leap: '跳躍', resonance: '共鳴', consensus: '合意',
      past_speculation: '過去推測', future_command: '未来命令',
      echo: '反響', quotation: '引用', summon: '召喚', revelation: '啓示'
    };
    for (const [id, kanji] of Object.entries(expected)) {
      const key = `cosmos.canon.${id}.name`;
      assert.ok(i18n[key], `missing ${key}`);
      assert.equal(i18n[key].ja, kanji, `${key}.ja should be ${kanji}`);
    }
  });
});
