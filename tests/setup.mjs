// DOM mock setup for ParticleRings / ParticleSpeechRings
// jsdom + manual stubs for ResizeObserver / requestAnimationFrame
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export function setupDOM({ withSpeech = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true
  });
  const { window } = dom;

  // Globals expected by source modules
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
  global.Element = window.Element;
  global.SVGElement = window.SVGElement;
  global.Node = window.Node;
  global.CustomEvent = window.CustomEvent;
  global.Event = window.Event;
  global.MouseEvent = window.MouseEvent;
  global.MutationObserver = window.MutationObserver;
  global.getComputedStyle = window.getComputedStyle.bind(window);

  // requestAnimationFrame: synchronous-ish (deferred via setImmediate)
  let rafId = 0;
  const rafHandles = new Map();
  global.requestAnimationFrame = window.requestAnimationFrame = (cb) => {
    rafId += 1;
    const id = rafId;
    const handle = setImmediate(() => {
      rafHandles.delete(id);
      cb(performance.now());
    });
    rafHandles.set(id, handle);
    return id;
  };
  global.cancelAnimationFrame = window.cancelAnimationFrame = (id) => {
    const h = rafHandles.get(id);
    if (h) { clearImmediate(h); rafHandles.delete(id); }
  };

  // ResizeObserver / IntersectionObserver stubs
  class StubObserver {
    constructor(cb) { this.cb = cb; this.targets = new Set(); }
    observe(t) { this.targets.add(t); }
    unobserve(t) { this.targets.delete(t); }
    disconnect() { this.targets.clear(); }
    takeRecords() { return []; }
  }
  global.ResizeObserver = window.ResizeObserver = StubObserver;
  global.IntersectionObserver = window.IntersectionObserver = StubObserver;

  // visualViewport already exists on jsdom window? add stub if missing
  if (!window.visualViewport) {
    window.visualViewport = {
      addEventListener() {},
      removeEventListener() {}
    };
  }

  // getBoundingClientRect default for elements (jsdom returns zeros)
  // Provide a non-zero rect so _updateHaloPosition path runs.
  const protoBCR = window.Element.prototype.getBoundingClientRect;
  window.Element.prototype.getBoundingClientRect = function () {
    const r = protoBCR.call(this);
    if (r.width || r.height) return r;
    return {
      x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 100,
      width: 100, height: 100,
      toJSON() { return this; }
    };
  };

  // Load source scripts. They use IIFE attaching to window.
  const ringsCode = readFileSync(resolve(ROOT, 'particle_rings.js'), 'utf8');
  window.eval(ringsCode);
  global.ParticleRings = window.ParticleRings;

  const canonMetaPath = resolve(ROOT, 'particle_canon_meta.js');
  const canonMetaCode = readFileSync(canonMetaPath, 'utf8');
  window.eval(canonMetaCode);
  global.InryokuCanonMeta = window.InryokuCanonMeta;

  if (withSpeech) {
    const speechCode = readFileSync(resolve(ROOT, 'particle_speech_rings.js'), 'utf8');
    // speech module references global ParticleRings (without window. prefix)
    // expose it on the IIFE's window context
    window.ParticleRings = window.ParticleRings; // already set
    window.eval(speechCode);
    global.ParticleSpeechRings = window.ParticleSpeechRings;
  }

  return { dom, window };
}

export function teardownDOM() {
  // Reset globals between tests if needed
  delete global.ParticleRings;
  delete global.ParticleSpeechRings;
  delete global.InryokuCanonMeta;
}
