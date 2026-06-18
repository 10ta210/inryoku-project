#!/usr/bin/env node
// scripts/verify-data.mjs
// Daily integrity check for inryokü's data/ directory.
//
// Validates:
//   - data/subscribers.json   { subscribers: Subscriber[] }
//   - data/refs.json          { refs: Ref[] }   (optional)
//   - data/greys/*.json       Grey               (optional)
//
// Detects: invalid JSON, missing required fields, duplicates, out-of-range
// numbers, suspicious timestamps. Exits 0 on clean, 1 on any issue.
//
// Usage:
//   node scripts/verify-data.mjs
//   node scripts/verify-data.mjs --root /tmp/restore-test
//   node scripts/verify-data.mjs --json

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
let ROOT = DEFAULT_ROOT;
let JSON_OUT = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root') ROOT = resolve(args[++i]);
  else if (args[i] === '--json') JSON_OUT = true;
  else if (args[i] === '-h' || args[i] === '--help') {
    console.log('verify-data.mjs [--root <dir>] [--json]');
    process.exit(0);
  }
}

const DATA_DIR = join(ROOT, 'data');
const issues = [];
const stats = {
  subscribers: 0,
  refs: 0,
  greys: 0,
  greyRange: null,
  totalBytes: 0,
};

function err(file, msg) { issues.push({ level: 'error', file, msg }); }
function warn(file, msg) { issues.push({ level: 'warn', file, msg }); }

function readJson(path) {
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch (e) { err(path, `cannot read: ${e.message}`); return null; }
  stats.totalBytes += Buffer.byteLength(raw);
  try { return JSON.parse(raw); }
  catch (e) { err(path, `invalid JSON: ${e.message}`); return null; }
}

function isNonEmptyString(v) { return typeof v === 'string' && v.length > 0; }
function isISODate(v) {
  if (typeof v !== 'string') return false;
  const d = Date.parse(v);
  if (Number.isNaN(d)) return false;
  // sanity: between 2020-01-01 and 30 days in the future
  const now = Date.now();
  if (d < Date.parse('2020-01-01')) return false;
  if (d > now + 30 * 86400000) return false;
  return true;
}
function isHexColor(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v); }
function isEmail(v) { return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

// ---- subscribers ------------------------------------------------------------
function validateSubscriber(s, idx, file) {
  const tag = `${file}#subscribers[${idx}]`;
  if (typeof s !== 'object' || s === null) { err(tag, 'not an object'); return; }
  if (!isEmail(s.email)) err(tag, `email invalid: ${JSON.stringify(s.email)}`);
  if (!Number.isInteger(s.number) || s.number < 1) err(tag, `number invalid: ${s.number}`);
  if (!isNonEmptyString(s.token) || s.token.length < 16) err(tag, 'token missing or too short');
  if (s.greyColor != null && !isHexColor(s.greyColor)) err(tag, `greyColor not #rrggbb: ${s.greyColor}`);
  if (s.bio != null && typeof s.bio !== 'string') err(tag, 'bio not string');
  if (s.isArtist != null && typeof s.isArtist !== 'boolean') err(tag, 'isArtist not boolean');
  if (s.isPublic != null && typeof s.isPublic !== 'boolean') err(tag, 'isPublic not boolean');
  if (!isISODate(s.created)) err(tag, `created not ISO date: ${s.created}`);
}

function validateSubscribers(file) {
  const data = readJson(file);
  if (!data) return;
  if (!Array.isArray(data.subscribers)) {
    err(file, 'top-level .subscribers must be an array'); return;
  }
  stats.subscribers = data.subscribers.length;
  const seenEmails = new Map();
  const seenNumbers = new Map();
  const seenTokens = new Map();
  data.subscribers.forEach((s, i) => {
    validateSubscriber(s, i, file);
    if (s && typeof s === 'object') {
      if (s.email) {
        const key = String(s.email).toLowerCase();
        if (seenEmails.has(key)) err(file, `duplicate email at index ${i} and ${seenEmails.get(key)}: ${key}`);
        else seenEmails.set(key, i);
      }
      if (Number.isInteger(s.number)) {
        if (seenNumbers.has(s.number)) err(file, `duplicate number at index ${i} and ${seenNumbers.get(s.number)}: ${s.number}`);
        else seenNumbers.set(s.number, i);
      }
      if (s.token) {
        if (seenTokens.has(s.token)) err(file, `duplicate token at index ${i} and ${seenTokens.get(s.token)}`);
        else seenTokens.set(s.token, i);
      }
    }
  });
}

// ---- refs -------------------------------------------------------------------
function validateRef(r, idx, file) {
  const tag = `${file}#refs[${idx}]`;
  if (typeof r !== 'object' || r === null) { err(tag, 'not an object'); return; }
  if (!isNonEmptyString(r.id) && !isNonEmptyString(r.code) && !isNonEmptyString(r.token)) {
    err(tag, 'no identifier (expected id/code/token)');
  }
  if (r.created != null && !isISODate(r.created)) err(tag, `created not ISO: ${r.created}`);
  if (r.uses != null && (!Number.isInteger(r.uses) || r.uses < 0)) err(tag, `uses invalid: ${r.uses}`);
}

function validateRefs(file) {
  const data = readJson(file);
  if (!data) return;
  let arr;
  if (Array.isArray(data)) arr = data;
  else if (Array.isArray(data.refs)) arr = data.refs;
  else { err(file, 'expected array or { refs: [...] }'); return; }
  stats.refs = arr.length;
  arr.forEach((r, i) => validateRef(r, i, file));
}

// ---- greys ------------------------------------------------------------------
function validateGrey(g, file) {
  if (typeof g !== 'object' || g === null) { err(file, 'not an object'); return; }
  if (!Number.isInteger(g.number) || g.number < 1) err(file, `number invalid: ${g.number}`);
  if (g.color != null && !isHexColor(g.color)) err(file, `color not #rrggbb: ${g.color}`);
  if (g.created != null && !isISODate(g.created)) err(file, `created not ISO: ${g.created}`);
  return g;
}

function validateGreys(dir) {
  let files;
  try { files = readdirSync(dir).filter(f => f.endsWith('.json')); }
  catch { return; }
  stats.greys = files.length;
  let min = Infinity, max = -Infinity;
  for (const f of files) {
    const path = join(dir, f);
    const g = readJson(path);
    if (!g) continue;
    const v = validateGrey(g, path);
    if (v && Number.isInteger(v.number)) {
      if (v.number < min) min = v.number;
      if (v.number > max) max = v.number;
    }
  }
  if (Number.isFinite(min)) stats.greyRange = [min, max];
}

// ---- run --------------------------------------------------------------------
if (!existsSync(DATA_DIR)) {
  err(DATA_DIR, 'data/ directory does not exist');
} else {
  const subsPath = join(DATA_DIR, 'subscribers.json');
  if (existsSync(subsPath)) validateSubscribers(subsPath);
  else warn(subsPath, 'subscribers.json missing (ok if zero signups)');

  const refsPath = join(DATA_DIR, 'refs.json');
  if (existsSync(refsPath)) validateRefs(refsPath);

  const greysDir = join(DATA_DIR, 'greys');
  if (existsSync(greysDir) && statSync(greysDir).isDirectory()) validateGreys(greysDir);
}

const errors = issues.filter(i => i.level === 'error');
const warnings = issues.filter(i => i.level === 'warn');

if (JSON_OUT) {
  console.log(JSON.stringify({ ok: errors.length === 0, stats, issues }, null, 2));
} else {
  const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', D = '\x1b[2m', X = '\x1b[0m';
  console.log(`${Y}==> verify-data${X}  root=${ROOT}`);
  console.log(`${D}    subscribers=${stats.subscribers} refs=${stats.refs} greys=${stats.greys} bytes=${stats.totalBytes}${X}`);
  if (stats.greyRange) console.log(`${D}    grey numbers: ${stats.greyRange[0]}..${stats.greyRange[1]}${X}`);
  for (const i of warnings) console.log(`${Y}    warn${X} ${i.file}: ${i.msg}`);
  for (const i of errors) console.log(`${R}    err ${X} ${i.file}: ${i.msg}`);
  if (errors.length === 0) console.log(`${G}verify-data: OK${X}  (${warnings.length} warnings)`);
  else console.log(`${R}verify-data: FAIL${X}  ${errors.length} errors, ${warnings.length} warnings`);
}

process.exit(errors.length === 0 ? 0 : 1);
