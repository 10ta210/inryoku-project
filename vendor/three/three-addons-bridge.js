/**
 * three-addons-bridge.js — Three.js 0.160 ESM addons を UMD コードに橋渡し
 *
 * 既存 inryokü コードは `THREE.*` グローバルに依存している UMD コード。
 * Three.js 0.160 では addon (GLTFLoader 等) は ESM only なので、
 * このモジュールスクリプトが ESM を import → window.THREE に注入する。
 *
 * 使い方 (HTML):
 *   <script src="vendor/three.min.js"></script>             // UMD コア
 *   <script type="importmap">{"imports":{"three":"./vendor/three/build/three.module.js"}}</script>
 *   <script type="module" src="vendor/three/three-addons-bridge.js"></script>
 *   <script>
 *     window.addEventListener('threeAddonsReady', () => {
 *       // ここで THREE.GLTFLoader が使える
 *       const loader = new THREE.GLTFLoader();
 *     });
 *   </script>
 *
 * 2026-05-23 司さん指示「Three.js 必要なら更新検討可」「P3 GLB OK」を受けて導入。
 */

import { GLTFLoader }           from './examples/jsm/loaders/GLTFLoader.js';
import { SVGLoader }            from './examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from './examples/jsm/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler }   from './examples/jsm/math/MeshSurfaceSampler.js';

(function () {
  if (typeof window === 'undefined') return;
  // UMD の THREE が既に存在する前提
  if (!window.THREE) {
    console.warn('[three-addons-bridge] window.THREE not found — UMD core must load first');
    return;
  }
  // グローバル名前空間に addon を露出
  window.THREE.GLTFLoader          = GLTFLoader;
  window.THREE.SVGLoader           = SVGLoader;
  window.THREE.BufferGeometryUtils = BufferGeometryUtils;
  window.THREE.MeshSurfaceSampler  = MeshSurfaceSampler;
  // 既存ユーティリティを互換シム経由でも公開
  window.THREE_ADDONS = window.THREE_ADDONS || {};
  window.THREE_ADDONS.GLTFLoader          = GLTFLoader;
  window.THREE_ADDONS.SVGLoader           = SVGLoader;
  window.THREE_ADDONS.BufferGeometryUtils = BufferGeometryUtils;
  window.THREE_ADDONS.MeshSurfaceSampler  = MeshSurfaceSampler;
  // 通知
  try {
    window.dispatchEvent(new CustomEvent('threeAddonsReady', {
      detail: { addons: ['GLTFLoader', 'SVGLoader', 'BufferGeometryUtils', 'MeshSurfaceSampler'] }
    }));
  } catch (e) {}
  console.info('[three-addons-bridge] OK — GLTFLoader / SVGLoader / MeshSurfaceSampler available');
})();
