// extensions/_loader.js
// Extension loader for inryokü. Pure ESM, no eval, no Function(), no fetch.
//
// Usage:
//   import { loadExtensions } from './_loader.js';
//   const result = await loadExtensions({
//     // optional overrides — these defaults run in the browser:
//     root: '/extensions',
//     readJSON: async (path) => (await fetch(path)).json(),
//     importer: (path) => import(path),
//     log: (...a) => console.warn('[ext]', ...a)
//   });
//   // result = { extensions: [...], registries: { behaviors, canons, scenes, commands }, errors: [...] }
//
// `extensions/registry.json` is an opt-in list of folder names (relative to
// the extensions root). The loader will only import entries whose resolved
// path matches `<root>/<name>/<entry>` and whose entry filename ends in .js.
// Anything else is rejected — no escape via "../" or absolute paths.

const ID_RX = /^[a-z][a-z0-9-]{0,63}$/;
const ENTRY_RX = /^[a-zA-Z0-9_-]+\.js$/;
const VERSION_RX = /^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/;
const ALLOWED_TYPES = new Set(['bundle', 'behavior', 'canon', 'scene', 'command']);

const CANON_ID_RX = /^[a-z][a-z0-9_]{0,39}$/;
const RGBCMY = new Set(['R', 'G', 'B', 'C', 'M', 'Y']);

export function validateManifest(m) {
  const errs = [];
  if (!m || typeof m !== 'object') return ['manifest must be object'];
  if (!ID_RX.test(String(m.id || ''))) errs.push('id invalid');
  if (typeof m.name !== 'string' || !m.name.length) errs.push('name required');
  if (!VERSION_RX.test(String(m.version || ''))) errs.push('version must be semver');
  if (!ALLOWED_TYPES.has(m.type)) errs.push('type invalid');
  if (!ENTRY_RX.test(String(m.entry || ''))) errs.push('entry must be <name>.js');
  if (m.deps != null && !Array.isArray(m.deps)) errs.push('deps must be array');
  if (m.contributes != null && typeof m.contributes !== 'object') errs.push('contributes must be object');
  return errs;
}

export function validateGlyph(g) {
  const errs = [];
  if (!g || typeof g !== 'object') return ['glyph must be object'];
  if (!CANON_ID_RX.test(String(g.canon || ''))) errs.push('canon id invalid');
  if (g.direction !== 'cw' && g.direction !== 'ccw') errs.push('direction invalid');
  if (typeof g.doubleRing !== 'boolean') errs.push('doubleRing must be boolean');
  if (!Array.isArray(g.ticks) || g.ticks.length > 12) errs.push('ticks invalid');
  if (!Array.isArray(g.strings)) errs.push('strings invalid');
  if (!Number.isInteger(g.phaseAdvance) || g.phaseAdvance < -6 || g.phaseAdvance > 6) errs.push('phaseAdvance invalid');
  if (Array.isArray(g.ticks)) {
    const seen = new Set();
    for (const t of g.ticks) {
      if (!Number.isInteger(t.tick) || t.tick < 0 || t.tick > 11) errs.push('tick index oob');
      if (t.color !== null && !RGBCMY.has(t.color)) errs.push('tick color not RGBCMY');
      if (seen.has(t.tick)) errs.push('duplicate tick');
      seen.add(t.tick);
    }
  }
  if (Array.isArray(g.strings)) {
    for (const s of g.strings) {
      if (!Number.isInteger(s.from) || s.from < 0 || s.from > 11) errs.push('string.from oob');
      if (!Number.isInteger(s.to) || s.to < 0 || s.to > 11) errs.push('string.to oob');
      if (s.from === s.to) errs.push('string self-loop');
      if (s.color !== null && !RGBCMY.has(s.color)) errs.push('string color not RGBCMY');
      if (typeof s.arc !== 'boolean') errs.push('string.arc must be boolean');
    }
  }
  return errs;
}

export function validateBehavior(b) {
  const errs = [];
  if (!b || typeof b !== 'object') return ['behavior must be object'];
  if (!b.meta || typeof b.meta.id !== 'string') errs.push('behavior.meta.id required');
  if (typeof b.step !== 'function') errs.push('behavior.step must be function');
  return errs;
}

// Resolve a manifest folder name to an entry path within the root. Rejects
// anything that escapes the root or that doesn't match `<root>/<name>/`.
function resolveEntry(root, name, entry) {
  if (typeof name !== 'string' || name.includes('/') || name.includes('..') || name.startsWith('.')) {
    throw new Error('illegal folder name: ' + name);
  }
  if (!ENTRY_RX.test(entry)) {
    throw new Error('illegal entry filename: ' + entry);
  }
  // Trailing slash on root is fine; we always join with one slash.
  const r = root.replace(/\/+$/, '');
  return r + '/' + name + '/' + entry;
}

function makeRegistries() {
  return {
    behaviors: new Map(),
    canons:    new Map(),
    scenes:    new Map(),
    commands:  []
  };
}

function safeRegister(reg, ext, errors, log) {
  const contrib = ext.entry || {};
  // behaviors
  for (const b of (contrib.behaviors || [])) {
    const e = validateBehavior(b);
    if (e.length) { errors.push({ ext: ext.manifest.id, kind: 'behavior', errors: e }); continue; }
    const id = b.meta.id;
    if (reg.behaviors.has(id)) { log('duplicate behavior id ignored:', id, 'from', ext.manifest.id); continue; }
    reg.behaviors.set(id, { meta: b.meta, step: b.step, ext: ext.manifest.id });
  }
  // canons
  for (const c of (contrib.canons || [])) {
    const glyph = c.glyph || c;
    const e = validateGlyph(glyph);
    if (e.length) { errors.push({ ext: ext.manifest.id, kind: 'canon', errors: e }); continue; }
    if (reg.canons.has(glyph.canon)) { log('duplicate canon ignored:', glyph.canon, 'from', ext.manifest.id); continue; }
    reg.canons.set(glyph.canon, { glyph, audio: c.audio || null, ext: ext.manifest.id });
  }
  // scenes
  for (const s of (contrib.scenes || [])) {
    if (!s || typeof s.state !== 'string' || typeof s.behavior !== 'string') {
      errors.push({ ext: ext.manifest.id, kind: 'scene', errors: ['scene.state/behavior required'] });
      continue;
    }
    if (reg.scenes.has(s.state)) { log('duplicate scene state ignored:', s.state); continue; }
    reg.scenes.set(s.state, { behavior: s.behavior, ext: ext.manifest.id });
  }
  // commands
  for (const cmd of (contrib.commands || [])) {
    if (!cmd || typeof cmd.id !== 'string' || typeof cmd.run !== 'function') {
      errors.push({ ext: ext.manifest.id, kind: 'command', errors: ['command.id/run required'] });
      continue;
    }
    if (reg.commands.some((x) => x.id === cmd.id)) { log('duplicate command id ignored:', cmd.id); continue; }
    reg.commands.push({ id: cmd.id, label: cmd.label || cmd.id, run: cmd.run, ext: ext.manifest.id });
  }
}

/**
 * Load all extensions listed in registry.json.
 *
 * @param {object} opts
 * @param {string} [opts.root='/extensions']      base path or URL
 * @param {(path: string) => Promise<any>} [opts.readJSON]   reads JSON files
 * @param {(path: string) => Promise<any>} [opts.importer]   dynamic-imports the entry
 * @param {(...a: any[]) => void} [opts.log]
 * @returns {Promise<{extensions: any[], registries: any, errors: any[]}>}
 */
export async function loadExtensions(opts) {
  const o = opts || {};
  const root = o.root || '/extensions';
  const readJSON = o.readJSON || (async (p) => (await fetch(p)).json());
  const importer = o.importer || ((p) => import(p));
  const log = o.log || ((...a) => { try { console.warn('[ext]', ...a); } catch (_) {} });

  const registries = makeRegistries();
  const extensions = [];
  const errors = [];

  let registry;
  try {
    registry = await readJSON(root.replace(/\/+$/, '') + '/registry.json');
  } catch (e) {
    errors.push({ kind: 'registry', errors: [String(e && e.message || e)] });
    return { extensions, registries, errors };
  }
  if (!Array.isArray(registry)) {
    errors.push({ kind: 'registry', errors: ['registry.json must be a JSON array'] });
    return { extensions, registries, errors };
  }

  const seenIds = new Set();

  for (const name of registry) {
    try {
      if (typeof name !== 'string') throw new Error('registry entry must be a string');
      const manifestPath = root.replace(/\/+$/, '') + '/' + name + '/manifest.json';
      const manifest = await readJSON(manifestPath);
      const mErrs = validateManifest(manifest);
      if (mErrs.length) { errors.push({ ext: name, kind: 'manifest', errors: mErrs }); continue; }
      if (seenIds.has(manifest.id)) {
        errors.push({ ext: name, kind: 'duplicate-id', errors: ['extension id already registered: ' + manifest.id] });
        continue;
      }
      seenIds.add(manifest.id);

      const entryPath = resolveEntry(root, name, manifest.entry);
      const mod = await importer(entryPath);
      const entry = mod && (mod.default || mod);

      const ext = { folder: name, manifest, entry };
      safeRegister(registries, ext, errors, log);
      extensions.push(ext);
    } catch (e) {
      errors.push({ ext: name, kind: 'load', errors: [String(e && e.message || e)] });
      // continue with next; one bad extension never breaks the others.
    }
  }

  return { extensions, registries, errors };
}

export default { loadExtensions, validateManifest, validateGlyph, validateBehavior };
