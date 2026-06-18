/* ============================================================
   cosmos-postfx.js — post-processing helper for P3 effects
   作成: 2026-05-12
   stack: EffectComposer + RenderPass + UnrealBloomPass + AfterimagePass
   reduce-motion: bloom OK, afterimage OFF
   ============================================================ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

export function createPostFX(renderer, scene, camera, opts = {}) {
  let reduce =
    opts.reduceMotion ??
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const baseBloomStrength = opts.bloomStrength ?? 0.8;
  // WCAG 2.3.3 — when reduce-motion is set, vestibular triggers like bloom
  // halo should be tamed. Multiply by 0.5 (afterimage is also dropped below).
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    reduce ? baseBloomStrength * 0.5 : baseBloomStrength,
    opts.bloomRadius ?? 0.7,
    opts.bloomThreshold ?? 0.0
  );
  composer.addPass(bloom);

  let afterimage = null;
  if (!reduce) {
    afterimage = new AfterimagePass(opts.afterimageDamp ?? 0.78);
    composer.addPass(afterimage);
  }

  // Live-track prefers-reduced-motion so bloom strength reacts without reload.
  let mql = null;
  let mqlHandler = null;
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      mqlHandler = (e) => {
        reduce = !!e.matches;
        bloom.strength = reduce ? baseBloomStrength * 0.5 : baseBloomStrength;
      };
      if (mql.addEventListener) mql.addEventListener('change', mqlHandler);
      else if (mql.addListener) mql.addListener(mqlHandler);
    } catch (_) { /* test envs may lack matchMedia */ }
  }

  function render() {
    composer.render();
  }

  function setSize(w, h) {
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }

  function dispose() {
    composer.passes.forEach((p) => p.dispose?.());
    // EffectComposer in three r160 owns two ping-pong render targets that
    // composer.dispose() does not exist for — release them explicitly.
    try { composer.renderTarget1?.dispose(); } catch (_) {}
    try { composer.renderTarget2?.dispose(); } catch (_) {}
    if (mql && mqlHandler) {
      try {
        if (mql.removeEventListener) mql.removeEventListener('change', mqlHandler);
        else if (mql.removeListener) mql.removeListener(mqlHandler);
      } catch (_) {}
    }
  }

  return { render, setSize, dispose, composer, bloom, afterimage };
}
