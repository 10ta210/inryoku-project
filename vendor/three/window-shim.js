/* ═══════════════════════════════════════════════════════════════════
   Three.js ESM ⇄ UMD ブリッジ
   2026-04-29: P0/P1/P2 が UMD (vendor/three.min.js → window.THREE) を要求し、
   postprocessing は ESM `import ... from 'three'` を要求するため、両者を
   1 つの Three.js インスタンスで共有させる薄い shim。
   importmap の "three" をこのファイルに向ける。
   ─────────────────────────────────────────────────────────────────── */

const T = (typeof globalThis !== 'undefined' && globalThis.THREE)
  ? globalThis.THREE
  : (typeof window !== 'undefined' ? window.THREE : null);

if (!T) {
  throw new Error('[three-shim] window.THREE が見つかりません。vendor/three.min.js が先に読み込まれている必要があります。');
}

// postprocessing / shaders が要求する named exports を全部ブリッジ
export const AdditiveBlending = T.AdditiveBlending;
export const BufferGeometry = T.BufferGeometry;
export const Clock = T.Clock;
export const Color = T.Color;
export const Float32BufferAttribute = T.Float32BufferAttribute;
export const HalfFloatType = T.HalfFloatType;
export const Mesh = T.Mesh;
export const MeshBasicMaterial = T.MeshBasicMaterial;
export const NoBlending = T.NoBlending;
export const OrthographicCamera = T.OrthographicCamera;
export const ShaderMaterial = T.ShaderMaterial;
export const UniformsUtils = T.UniformsUtils;
export const Vector2 = T.Vector2;
export const Vector3 = T.Vector3;
export const WebGLRenderTarget = T.WebGLRenderTarget;

// 念のため default export も
export default T;
