/**
 * p3_pictogram_avatar.js — i (自己) のパーティクル人型アバター
 *
 * 司さん指示 (2026-05-23): 「ガチでやって、ベスプラ探して、めっちゃ高性能に」
 * Codex Opus SOTA リサーチ + design-critique + brainstorming 統合実装。
 *
 * 設計:
 *   - 3D pictogram primitive (頭/胴/腕/脚の capsule 彫刻) を MeshSurfaceSampler で表面 sample
 *   - Single Points + Single ShaderMaterial = 1 draw call
 *   - 全 attribute static (bake 1 回、GPU は読むだけ)
 *   - 3 uniform (uTint / uPulse / uClothMix) で全演出
 *
 * 哲学整合:
 *   - 「i は o の一部」: 同じ素材 (粒) で世界と地続き
 *   - 「染まりは波紋」: aSeed = aBase.y で足元→頭へ伝播
 *   - 「同じ存在が視点で変わる」: uClothMix で素↔着衣 morph
 *
 * パフォーマンス:
 *   - desktop 32,000 / mobile 10,000 / reduce-motion 6,000 粒
 *   - cosmos-adaptive ratchet 連動 (setDrawRange で密度可変、再 sampling なし)
 *   - gl_PointSize clamp(1, 8) mobile fill rate 保護
 *   - NormalBlending (色純度保持、AdditiveBlending 廃止)
 *
 * 起動:
 *   window.inryokuPictogramAvatar.attach({ scene, camera }) を呼ぶ
 *   または `threeAddonsReady` イベント後に自動 init (later integration 用)
 *
 * Debug:
 *   window.__p3Avatar.setTint(0.5)
 *   window.__p3Avatar.pulse()
 *   window.__p3Avatar.setCloth(1)
 *   window.__p3Avatar.setPersonalColor('cyan' | 'magenta' | 'yellow' | 'red' | 'green' | 'blue')
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.inryokuPictogramAvatar) return;

  // ─── Vertex Shader ──────────────────────────────────────────
  const VERT = /* glsl */`
    attribute vec3 aBaseClothed;
    attribute vec3 aScatter;       // 散らばった初期位置 (登場前)
    attribute vec3 aNormalLocal;
    attribute float aBodyZone;
    attribute float aSeed;

    uniform float uTime;
    uniform float uTint;        // 0..1 個人色への染まり度
    uniform float uPulse;       // 0..1 行動イベント (足→頭の波紋)
    uniform float uClothMix;    // 0..1 服着脱
    uniform float uSize;        // base point size
    uniform float uBreath;      // 0..1 呼吸振幅マスター
    uniform float uLife;        // 0..1 生きてる動き (呼吸/鼓動/重心)
    uniform float uInterest;    // 0..1 商品への興味反応
    uniform float uAssembly;    // 0..1 散らばり → 組成 (登場演出)
    uniform vec2  uMouse;       // NDC -1..1 (マウス追従、subtle tilt)
    uniform vec3  uGrey;
    uniform vec3  uPersonalColor;
    uniform vec3  uClothColor;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      // ── 着衣 morph: 胴 (zone=1) のみ aBaseClothed へ ──
      float clothZoneMask = step(0.5, aBodyZone) * step(aBodyZone, 1.5);
      vec3 baseTarget = mix(position, aBaseClothed, uClothMix * clothZoneMask);

      // ── 登場演出 (uAssembly 0→1): 散らばり → 組成 ──
      //   per-particle 遅延 (aSeed) で「足元から組み上がる」波
      float asmDelay = aSeed * 0.45;
      float asmT = smoothstep(asmDelay, asmDelay + 0.55, uAssembly);
      // ease 強化: smoothstep ベースに quintic で滑らかさ追加
      asmT = asmT * asmT * (3.0 - 2.0 * asmT);
      vec3 target = mix(aScatter, baseTarget, asmT);

      // ── マウス追従 (subtle tilt): 全 particle が世界中心を支点に微傾斜 ──
      //   tilt 強度は組成完了後だけ (uAssembly で gate)
      float tilt = 0.045 * uAssembly;
      mat3 mouseTilt = mat3(
        1.0,         0.0,             0.0,
        0.0,    cos(-uMouse.y * tilt), -sin(-uMouse.y * tilt),
        0.0,    sin(-uMouse.y * tilt),  cos(-uMouse.y * tilt)
      );
      mat3 mouseYaw = mat3(
        cos(uMouse.x * tilt), 0.0, sin(uMouse.x * tilt),
        0.0,                  1.0, 0.0,
       -sin(uMouse.x * tilt), 0.0, cos(uMouse.x * tilt)
      );
      target = mouseYaw * (mouseTilt * (target - vec3(0.0, 0.9, 0.0))) + vec3(0.0, 0.9, 0.0);

      // ── 生きてる動き: P0-P1 で走っていた i が、P3 で立ち止まって息をしている ──
      float breath = sin(uTime * 1.27 + sin(uTime * 0.31) * 0.22 + aSeed * 0.9) * 0.5 + 0.5;
      float heartbeat = pow(max(0.0, sin(uTime * 7.54 - aSeed * 0.45)), 18.0);
      float weightShift = sin(uTime * 0.52 + aSeed * 2.4);
      // 組成完了後だけ呼吸 (uAssembly で gate)
      target += aNormalLocal * (breath * 0.012 + heartbeat * 0.012 + uInterest * 0.010) * uBreath * uLife * uAssembly;
      target.x += weightShift * 0.010 * (1.0 - aSeed) * uLife * uAssembly;
      target.y += sin(uTime * 0.47) * 0.008 * uLife * uAssembly;
      target += normalize(vec3(uMouse.x, -uMouse.y * 0.25, 0.18)) * uInterest * 0.030 * (0.35 + aSeed) * uAssembly;

      // ── 微小ノイズ (生きてる感、seed で per-particle) ──
      target += aNormalLocal * (sin(uTime * 2.3 + aSeed * 19.0) * 0.0025) * uBreath * uLife * uAssembly;

      // ── 染まり (グレー → 個人色) ──
      //   aSeed = y 連動で足元 → 頭の波紋になる (bake 時に焼く)
      float tint = smoothstep(aSeed * 0.6, aSeed * 0.6 + 0.4, uTint);
      vec3 personalCol = mix(uGrey, uPersonalColor, tint);

      // ── 服色: 胴体 zone のみ uClothColor (個人色を混ぜない) ──
      bool isCloth = (uClothMix > 0.01) && (aBodyZone > 0.5) && (aBodyZone < 1.5);
      vec3 baseCol = isCloth
        ? mix(uGrey, uClothColor, uClothMix)
        : personalCol;

      // ── Pulse 波紋 (1 行動 = 1 回、足→頭へ流れる発光) ──
      //   uPulse 1→0 へ ease しながら、aSeed と差分で「波の前」を作る
      float ringFront = uPulse - aSeed * 0.7;
      float ring = smoothstep(0.0, 0.15, ringFront)
                 * (1.0 - smoothstep(0.15, 0.30, ringFront));
      vec3 col = baseCol + uPersonalColor * (ring * 0.95 + heartbeat * 0.16 + uInterest * 0.24);

      vColor = col;

      // ── 投影 + Point size ──
      vec4 mv = modelViewMatrix * vec4(target, 1.0);
      vec4 proj = projectionMatrix * mv;
      // Codex F-3: clamp(1, 8) mobile fill rate 保護
      float ps = uSize * (300.0 / max(1.0, -mv.z));
      // Pulse 中は粒が一瞬大きくなる (光って見える)
      ps *= 1.0 + ring * 0.55 + heartbeat * 0.10 + uInterest * 0.06;
      gl_PointSize = clamp(ps, 1.0, 8.0);

      // 距離フェード (奥は薄く、宇宙の星と前後関係)
      vAlpha = clamp(1.0 - (-mv.z - 3.0) * 0.05, 0.18, 1.0);

      gl_Position = proj;
    }
  `;

  // ─── Fragment Shader ────────────────────────────────────────
  const FRAG = /* glsl */`
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      // 円形 alpha (柔らかい粒)
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      float a = smoothstep(0.50, 0.32, d);
      // 中心輝度 (HDR ぽさ、bloom なしでも光って見える)
      a *= 0.92;
      if (a < 0.01) discard;
      gl_FragColor = vec4(vColor, a * vAlpha);
    }
  `;

  // ─── Personal color palette (RGBCMY) ────────────────────────
  const PERSONAL_COLORS = {
    red:     [1.00, 0.18, 0.22],
    green:   [0.30, 1.00, 0.40],
    blue:    [0.20, 0.45, 1.00],
    cyan:    [0.00, 0.92, 1.00],
    magenta: [1.00, 0.20, 0.92],
    yellow:  [1.00, 0.95, 0.20],
  };

  // ─── パーティクル数 ratchet ──────────────────────────────────
  function pickParticleCount() {
    let isMobile = false;
    let reduceMotion = false;
    try {
      isMobile = /iPhone|iPad|Android|Mobi/i.test(navigator.userAgent)
              || (window.innerWidth < 720 && 'ontouchstart' in window);
      reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (reduceMotion) return 6000;
    if (isMobile)     return 10000;
    return 32000;
  }

  // ─── ISO 7010 E002 SVG → Extrude Geometry (司さん指示 2026-05-24) ───
  //   /svg/exit_e002.svg を SVGLoader で読み、緑背景 rect を除外して
  //   running man path のみを ExtrudeGeometry で 3D 化。
  //   サンプリング後は破棄 (Sampler が内部で attribute を保持)。
  //   司さんの「3Dにしたのみして」要望: SVG path だけ抽出、シルエット 3D
  function buildExitSVGMesh(THREE, onLoad, onError) {
    if (!THREE.SVGLoader) {
      if (onError) onError(new Error('SVGLoader not loaded'));
      return;
    }
    const loader = new THREE.SVGLoader();
    loader.load(
      'svg/exit_e002.svg',
      function (data) {
        try {
          // ── 緑背景 rect (#237F52) と白背景 rect (#ffffff、純白) を除外 ──
          //   running man path は fill: #ffffff style だが、SVG では path タグ
          //   経由なので path 経路で識別 (rect は SVGLoader が別扱い)
          const paths = data.paths || [];
          const shapes = [];
          for (let i = 0; i < paths.length; i++) {
            const p = paths[i];
            const fill = p.userData && p.userData.style && p.userData.style.fill;
            // 背景 rect は SVGLoader でも path 化されるが、巨大な四角になる
            // → bounding box 比率で除外、または fill 色で除外
            const isBackground = (fill === '#237f52' || fill === '#237F52') ||
                                 (fill === 'none');
            if (isBackground) continue;
            const sub = THREE.SVGLoader.createShapes(p);
            for (let s = 0; s < sub.length; s++) {
              shapes.push(sub[s]);
            }
          }
          if (shapes.length === 0) {
            if (onError) onError(new Error('No usable shapes in SVG'));
            return;
          }
          // ── 巨大背景 shape を bounding 比率で除外 (最後の保険) ──
          //   running man は SVG 内で 70% 未満の領域、背景は 90% 超
          const filtered = shapes.filter(function (sh) {
            const pts = sh.getPoints(8);
            if (!pts || pts.length === 0) return false;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (let pi = 0; pi < pts.length; pi++) {
              if (pts[pi].x < minX) minX = pts[pi].x;
              if (pts[pi].x > maxX) maxX = pts[pi].x;
              if (pts[pi].y < minY) minY = pts[pi].y;
              if (pts[pi].y > maxY) maxY = pts[pi].y;
            }
            const w = maxX - minX, h = maxY - minY;
            // 背景は ~106x106 (mm 単位の viewBox)、人型はもっと小さい
            return w < 100 && h < 100;
          });
          const useShapes = filtered.length > 0 ? filtered : shapes;
          // ── ExtrudeGeometry で 3D 化 ──
          const geo = new THREE.ExtrudeGeometry(useShapes, {
            depth: 4,            // 押し出し厚 (SVG 単位、後で scale 0.02 → 0.08 にスケール)
            bevelEnabled: false,
            curveSegments: 18,
          });
          // ── 正規化 (Three.js 標準姿勢へ) ──
          // SVG y 軸下向き → 3D 反転、サイズ約 175cm 想定でスケール
          geo.computeBoundingBox();
          const bb = geo.boundingBox;
          const sz = new THREE.Vector3();
          bb.getSize(sz);
          const targetHeight = 1.75; // 175cm
          const scale = targetHeight / sz.y;
          geo.scale(scale, -scale, scale); // y 反転
          geo.computeBoundingBox();
          bb.getSize(sz);
          // 中心化 + 足元 y=0 に
          const cx = (bb.min.x + bb.max.x) * 0.5;
          const cz = (bb.min.z + bb.max.z) * 0.5;
          geo.translate(-cx, -bb.max.y, -cz);
          // bb 再計算
          geo.computeBoundingBox();

          if (onLoad) onLoad(new THREE.Mesh(geo));
        } catch (e) {
          if (onError) onError(e);
        }
      },
      undefined,
      function (err) { if (onError) onError(err); }
    );
  }

  // ─── 2026-05-25: 司さん「exit mark の本格3D。今のは全部チープ」 ───
  //   旧 buildExitSVGMesh は depth:4 / bevel なし = ペラペラのシルエット押し出し。
  //   新 buildExitPremium3D: bevel(面取り) ＋ 厚み ＋ MeshPhysicalMaterial
  //   (metal + iridescence 虹) ＋ 虹グラデ環境マップ。
  //   = inryoku 美学の「ガラス/クロームの3D EXIT サイン彫刻」。
  //   ※ Blender 非接続のため Three.js で完結。

  // 虹グラデ環境マップ (iridescence / 反射が映り込む土台。inryoku = 黒の中の虹)
  function makeRainbowEnvTexture(THREE) {
    const w = 24, h = 96;
    const data = new Uint8Array(w * h * 4);
    // RGBCMY を縦に並べ、上下は黒 (黒の宇宙の中に虹が眠る)
    const stops = [
      [10, 10, 14], [255, 46, 95], [255, 233, 77], [53, 255, 114],
      [41, 231, 255], [107, 92, 255], [255, 53, 208], [10, 10, 14],
    ];
    for (let y = 0; y < h; y++) {
      const f = y / (h - 1) * (stops.length - 1);
      const i0 = Math.floor(f), i1 = Math.min(stops.length - 1, i0 + 1);
      const t = f - i0;
      const r = stops[i0][0] + (stops[i1][0] - stops[i0][0]) * t;
      const g = stops[i0][1] + (stops[i1][1] - stops[i0][1]) * t;
      const b = stops[i0][2] + (stops[i1][2] - stops[i0][2]) * t;
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        // 横方向に軽い明暗 (映り込みに変化)
        const shade = 0.62 + 0.38 * Math.cos((x / w) * Math.PI * 2);
        data[idx]     = Math.min(255, r * shade);
        data[idx + 1] = Math.min(255, g * shade);
        data[idx + 2] = Math.min(255, b * shade);
        data[idx + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeRainbowEnv(THREE, renderer) {
    try {
      const tex = makeRainbowEnvTexture(THREE);
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const rt = pmrem.fromEquirectangular(tex);
      tex.dispose();
      return rt.texture;
    } catch (e) {
      return null;
    }
  }

  // EXIT man の SVG を bevel 付きで本格3D押し出し → premium material
  function buildExitPremium3D(THREE, renderer, onLoad, onError) {
    if (!THREE.SVGLoader) { if (onError) onError(new Error('SVGLoader not loaded')); return; }
    const loader = new THREE.SVGLoader();
    loader.load('svg/exit_e002.svg', function (data) {
      try {
        const paths = data.paths || [];
        let shapes = [];
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i];
          const fill = p.userData && p.userData.style && p.userData.style.fill;
          if (fill === '#237f52' || fill === '#237F52' || fill === 'none') continue;
          const sub = THREE.SVGLoader.createShapes(p);
          for (let s = 0; s < sub.length; s++) shapes.push(sub[s]);
        }
        // 背景 rect (巨大四角) を除外
        shapes = shapes.filter(function (sh) {
          const pts = sh.getPoints(8);
          if (!pts || !pts.length) return false;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (let pi = 0; pi < pts.length; pi++) {
            if (pts[pi].x < minX) minX = pts[pi].x; if (pts[pi].x > maxX) maxX = pts[pi].x;
            if (pts[pi].y < minY) minY = pts[pi].y; if (pts[pi].y > maxY) maxY = pts[pi].y;
          }
          return (maxX - minX) < 100 && (maxY - minY) < 100;
        });
        if (!shapes.length) { if (onError) onError(new Error('no shapes')); return; }

        // ── bevel 付き押し出し (面取り = 高級感の核) ──
        const geo = new THREE.ExtrudeGeometry(shapes, {
          depth: 11,
          bevelEnabled: true,
          bevelThickness: 2.4,
          bevelSize: 1.6,
          bevelOffset: 0,
          bevelSegments: 5,
          curveSegments: 36,
        });
        // 正規化: 175cm 相当、y 反転、中心化・足元 y=0
        geo.computeBoundingBox();
        const bb = geo.boundingBox, sz = new THREE.Vector3();
        bb.getSize(sz);
        const scale = 1.75 / sz.y;
        geo.scale(scale, -scale, scale);
        geo.computeBoundingBox();
        bb.getSize(sz);
        const cx = (bb.min.x + bb.max.x) * 0.5;
        const cz = (bb.min.z + bb.max.z) * 0.5;
        // 2026-05-25: 上下中心を原点へ (debug/inline 両方でフレーム内に収める)
        geo.translate(-cx, -(bb.min.y + bb.max.y) * 0.5, -cz);
        geo.computeVertexNormals();

        // ── premium material: クローム + 虹イリデッセンス ──
        const env = renderer ? makeRainbowEnv(THREE, renderer) : null;
        const mat = new THREE.MeshPhysicalMaterial({
          color: 0x0e1014,
          metalness: 1.0,
          roughness: 0.24,
          envMap: env || null,
          envMapIntensity: 1.55,
          clearcoat: 1.0,
          clearcoatRoughness: 0.28,
          emissive: 0x0a1a24,
          emissiveIntensity: 0.35,
        });
        // iridescence は 0.158+ で対応 (無ければ無視される)
        if ('iridescence' in mat) {
          mat.iridescence = 1.0;
          mat.iridescenceIOR = 1.6;
          mat.iridescenceThicknessRange = [130, 560];
        }
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData.noBloom = true;
        mesh.userData._env = env;
        if (onLoad) onLoad(mesh);
      } catch (e) { if (onError) onError(e); }
    }, undefined, function (err) { if (onError) onError(err); });
  }

  // ─── 2026-05-30: 司さん「正面向き EXIT 人を Blender で本格3D化」 ───
  //   Blender でモデリングした正面立ちピクト (public/glb/exit_man.glb) を読み込み、
  //   クローム + 虹iridescence マテリアルを付与。SVG押し出しより遥かに立体的。
  function buildExitGLB(THREE, renderer, onLoad, onError) {
    if (!THREE.GLTFLoader) { if (onError) onError(new Error('GLTFLoader not loaded')); return; }
    var loader = new THREE.GLTFLoader();
    loader.load('public/glb/exit_runner.glb?v=20260530run6', function (gltf) {
      try {
        var root = gltf.scene || gltf.scenes[0];
        var mesh = null;
        root.traverse(function (o) { if (o.isMesh && !mesh) mesh = o; });
        if (!mesh) { if (onError) onError(new Error('no mesh in glb')); return; }

        // ── 正規化: 身長 1.75、足元中心、Y-up ──
        var box = new THREE.Box3().setFromObject(root);
        var size = new THREE.Vector3(); box.getSize(size);
        var s = 1.75 / (size.y || 1);
        root.scale.setScalar(s);
        box.setFromObject(root);
        var c = new THREE.Vector3(); box.getCenter(c);
        root.position.x -= c.x; root.position.z -= c.z;
        root.position.y -= (box.min.y + box.max.y) * 0.5;

        // ── premium material (クローム + 虹) ──
        var env = renderer ? makeRainbowEnv(THREE, renderer) : null;
        // 2026-05-30 司「見えない」: 黒背景で消えないよう base を明るめ + emissive 強化。
        var mat = new THREE.MeshPhysicalMaterial({
          color: 0x3a4350, metalness: 0.95, roughness: 0.28,
          envMap: env || null, envMapIntensity: 1.8,
          clearcoat: 1.0, clearcoatRoughness: 0.26,
          emissive: 0x1c3a4a, emissiveIntensity: 0.55,
        });
        if ('iridescence' in mat) {
          mat.iridescence = 1.0; mat.iridescenceIOR = 1.6;
          mat.iridescenceThicknessRange = [130, 560];
        }
        root.traverse(function (o) { if (o.isMesh) { o.material = mat; o.userData.noBloom = true; } });
        root.userData._env = env;
        if (onLoad) onLoad(root);
      } catch (e) { if (onError) onError(e); }
    }, undefined, function (err) { if (onError) onError(err); });
  }

  // ─── 3D pictogram primitive 定義 ───────────────────────────
  // 身長 175cm 想定、scene 単位 1 = 1m
  // 2026-05-24: 司さん「3Dのピクトグラムみたいなデザイン」。
  // 旧: 垂直な頭/胴/腕/脚 6 primitive。低品質な棒人間に見えた。
  // 新: E002 から続く i が、P3 で正面に立ち止まった丸頭 + カプセル胴/四肢の記号彫刻。
  function makeSpherePart(THREE, x, y, z, radius, zone, weight, sx, sy, sz) {
    const geo = new THREE.SphereGeometry(radius, 28, 18);
    geo.scale(sx || 1, sy || 1, sz || 1);
    geo.translate(x, y, z);
    return { geo: geo, zone: zone, weight: weight };
  }

  function makeCapsulePart(THREE, ax, ay, az, bx, by, bz, radius, zone, weight, radialSegments) {
    const a = new THREE.Vector3(ax, ay, az);
    const b = new THREE.Vector3(bx, by, bz);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const len = Math.max(0.001, dir.length());
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

    const cyl = new THREE.CylinderGeometry(radius, radius, len, radialSegments || 16, 3, true);
    cyl.applyQuaternion(quat);
    cyl.translate(mid.x, mid.y, mid.z);
    return { geo: cyl, zone: zone, weight: weight };
  }

  function buildGamePictogramMesh(THREE) {
    const group = new THREE.Group();
    group.name = 'p3_game_pictogram_avatar';

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xbfc8d2,
      roughness: 0.28,
      metalness: 0.02,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      emissive: 0x18333a,
      emissiveIntensity: 0.18,
    });
    const clothMat = new THREE.MeshStandardMaterial({
      color: 0xe7fbff,
      roughness: 0.20,
      metalness: 0.04,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      emissive: 0x123e44,
      emissiveIntensity: 0.22,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x44f6ff,
      roughness: 0.38,
      metalness: 0.05,
      emissive: 0x00dfff,
      emissiveIntensity: 0.85,
    });

    function addSphere(x, y, z, r, mat, sx, sy, sz) {
      const geo = new THREE.SphereGeometry(r, 32, 20);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx || 1, sy || 1, sz || 1);
      group.add(mesh);
      return mesh;
    }

    function addCapsule(ax, ay, az, bx, by, bz, r, mat) {
      const a = new THREE.Vector3(ax, ay, az);
      const b = new THREE.Vector3(bx, by, bz);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const len = Math.max(0.001, dir.length());
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 4, true), mat);
      cyl.quaternion.copy(quat);
      cyl.position.copy(mid);
      group.add(cyl);
      addSphere(ax, ay, az, r, mat);
      addSphere(bx, by, bz, r, mat);
      return cyl;
    }

    // 旧: E002 の走りポーズ。P3 では「走っていた i が正面で立ち止まる」姿にする。
    addSphere(0, 1.62, 0.025, 0.155, bodyMat, 1, 1, 0.84);
    addCapsule(0, 1.39, 0, 0, 0.96, 0, 0.16, clothMat);
    addSphere(0, 1.17, 0.016, 0.128, clothMat, 1.14, 1.48, 0.74);

    // 腕は左右対称に下ろして、ゲームのキャラクター選択画面のような正面立ちへ。
    addCapsule(-0.14, 1.30, 0.02, -0.34, 1.04, 0.04, 0.056, bodyMat);
    addCapsule(-0.34, 1.04, 0.04, -0.32, 0.76, 0.035, 0.052, bodyMat);
    addCapsule(0.14, 1.30, 0.02, 0.34, 1.04, 0.04, 0.056, bodyMat);
    addCapsule(0.34, 1.04, 0.04, 0.32, 0.76, 0.035, 0.052, bodyMat);

    // 脚は踏み込みではなく、少し開いた安定した立ち姿。
    addCapsule(-0.07, 0.94, 0, -0.20, 0.55, 0.02, 0.072, bodyMat);
    addCapsule(-0.20, 0.55, 0.02, -0.21, 0.20, 0.035, 0.064, bodyMat);
    addSphere(-0.21, 0.17, 0.055, 0.070, bodyMat, 1.35, 0.58, 0.78);
    addCapsule(0.07, 0.94, 0, 0.20, 0.55, 0.02, 0.072, bodyMat);
    addCapsule(0.20, 0.55, 0.02, 0.21, 0.20, 0.035, 0.064, bodyMat);
    addSphere(0.21, 0.17, 0.055, 0.070, bodyMat, 1.35, 0.58, 0.78);

    // 胸の i / コア。ゲームキャラとしての焦点を作る。
    addSphere(0, 1.18, 0.145, 0.028, accentMat, 0.78, 1.72, 0.42);
    addSphere(0, 1.265, 0.145, 0.018, accentMat, 1, 1, 0.42);

    group.traverse(function (obj) {
      if (obj.isMesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
        obj.userData.noBloom = true;
      }
    });
    group.userData = {
      bodyMat: bodyMat,
      clothMat: clothMat,
      accentMat: accentMat,
      tryOn: 0,
      tryOnTarget: 0,
      clothBase: new THREE.Color(0xe7fbff),
      clothTarget: new THREE.Color(0xe7fbff),
    };
    group.position.set(0, -0.18, 0.22);
    group.scale.setScalar(0.82);
    return group;
  }

  function buildPrimitives(THREE) {
    // 正面から見た 2D 記号性を保ちつつ、Z 厚みを持つ浅い 3D 彫刻。
    // zone: 0=head, 1=torso/cloth, 2=limb
    return [
      // 頭: 少し大きめの完全円。ピクトグラム感の核。
      makeSpherePart(THREE, 0, 1.58, 0, 0.145, 0, 0.16, 1, 1, 0.72),

      // 胴: 正面に立つ太い capsule。服が乗る面なので粒密度高め。
      makeCapsulePart(THREE, 0, 1.34, 0, 0, 0.94, 0, 0.135, 1, 0.28, 22),
      makeSpherePart(THREE, 0, 1.34, 0, 0.135, 1, 0.05, 1, 0.78, 0.62),
      makeSpherePart(THREE, 0, 0.94, 0, 0.135, 1, 0.05, 1, 0.78, 0.62),

      // 腕: P3 では正面立ち。走りの方向性は消し、呼吸で生きている感じを出す。
      makeCapsulePart(THREE, -0.13, 1.28, 0, -0.32, 1.02, 0, 0.052, 2, 0.075, 14),
      makeCapsulePart(THREE, -0.32, 1.02, 0, -0.31, 0.76, 0, 0.048, 2, 0.055, 14),
      makeSpherePart(THREE, -0.31, 0.76, 0, 0.055, 2, 0.02, 1, 1, 0.7),

      makeCapsulePart(THREE, 0.13, 1.28, 0, 0.32, 1.02, 0, 0.052, 2, 0.075, 14),
      makeCapsulePart(THREE, 0.32, 1.02, 0, 0.31, 0.76, 0, 0.048, 2, 0.055, 14),
      makeSpherePart(THREE, 0.31, 0.76, 0, 0.055, 2, 0.02, 1, 1, 0.7),

      // 脚: 少し足を開いた静止姿勢。同じ i が立ち止まった状態。
      makeCapsulePart(THREE, -0.07, 0.92, 0, -0.20, 0.55, 0, 0.068, 2, 0.095, 16),
      makeCapsulePart(THREE, -0.20, 0.55, 0, -0.21, 0.20, 0, 0.060, 2, 0.075, 16),
      makeSpherePart(THREE, -0.21, 0.18, 0, 0.067, 2, 0.025, 1.18, 0.62, 0.72),

      makeCapsulePart(THREE, 0.07, 0.92, 0, 0.20, 0.55, 0, 0.068, 2, 0.095, 16),
      makeCapsulePart(THREE, 0.20, 0.55, 0, 0.21, 0.20, 0, 0.060, 2, 0.075, 16),
      makeSpherePart(THREE, 0.21, 0.18, 0, 0.067, 2, 0.025, 1.18, 0.62, 0.72),
    ];
  }

  // ─── Bake: primitive 群を Points 用 attribute に焼く ─────────
  function bakeAvatarGeometry(THREE, totalCount) {
    const parts = buildPrimitives(THREE);
    // 各パートの粒数を weight で配分
    const counts = parts.map(p => Math.round(totalCount * p.weight));
    const actual = counts.reduce((a, b) => a + b, 0);

    const aPos          = new Float32Array(actual * 3);
    const aBaseClothed  = new Float32Array(actual * 3);
    const aScatter      = new Float32Array(actual * 3);
    const aNormalLocal  = new Float32Array(actual * 3);
    const aBodyZone     = new Float32Array(actual);
    const aSeed         = new Float32Array(actual);

    const _p = new THREE.Vector3();
    const _n = new THREE.Vector3();
    const _c = new THREE.Vector3();

    let i = 0;
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];
      const mesh = new THREE.Mesh(part.geo);
      const sampler = new THREE.MeshSurfaceSampler(mesh).build();

      // 服を着た時の膨らみ (胴のみ +25mm、それ以外 0)
      const clothInflate = part.zone === 1 ? 0.025 : 0.0;
      const n = counts[pi];

      for (let k = 0; k < n; k++, i++) {
        sampler.sample(_p, _n);
        aPos[i*3]   = _p.x;
        aPos[i*3+1] = _p.y;
        aPos[i*3+2] = _p.z;
        // 服位置 = 表面法線方向に膨らみ
        aBaseClothed[i*3]   = _p.x + _n.x * clothInflate;
        aBaseClothed[i*3+1] = _p.y + _n.y * clothInflate;
        aBaseClothed[i*3+2] = _p.z + _n.z * clothInflate;
        aNormalLocal[i*3]   = _n.x;
        aNormalLocal[i*3+1] = _n.y;
        aNormalLocal[i*3+2] = _n.z;
        aBodyZone[i] = part.zone;
        // aSeed = y 座標連動 (足元 → 頭の波紋) + 微小ランダム
        aSeed[i] = Math.max(0, Math.min(1, _p.y / 1.75)) + (Math.random() - 0.5) * 0.10;
        // aScatter = 球状ランダム (登場前の散らばり、世界の粒に紛れる)
        //   半径 3-6m の球殻にランダム配置
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        const r     = 3.0 + Math.random() * 3.0;
        aScatter[i*3]     = r * Math.sin(phi) * Math.cos(theta);
        aScatter[i*3 + 1] = r * Math.cos(phi) + 1.0;  // 中心高さに揃える
        aScatter[i*3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      // primitive geometry の clean up (Sampler が内部で BufferAttribute を保持してるので
      // mesh.geometry.dispose() は build 後に呼んで OK)
      try { part.geo.dispose(); } catch (e) {}
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',      new THREE.BufferAttribute(aPos, 3));
    geo.setAttribute('aBaseClothed',  new THREE.BufferAttribute(aBaseClothed, 3));
    geo.setAttribute('aScatter',      new THREE.BufferAttribute(aScatter, 3));
    geo.setAttribute('aNormalLocal',  new THREE.BufferAttribute(aNormalLocal, 3));
    geo.setAttribute('aBodyZone',     new THREE.BufferAttribute(aBodyZone, 1));
    geo.setAttribute('aSeed',         new THREE.BufferAttribute(aSeed, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  // ─── Bake from single mesh (SVG extruded mesh 等) ─────────
  //   Y 座標で body zone を推定 (頭 top 20% / 胴 middle 50% / 脚 bottom 30%)
  function bakeFromMesh(THREE, mesh, totalCount) {
    const sampler = new THREE.MeshSurfaceSampler(mesh).build();

    // bounding box から body zone 推定
    const geomSrc = mesh.geometry;
    if (!geomSrc.boundingBox) geomSrc.computeBoundingBox();
    const bb = geomSrc.boundingBox;
    const height = bb.max.y - bb.min.y;
    const torsoTop = bb.min.y + height * 0.78;  // 頭 = top 22%
    const torsoBot = bb.min.y + height * 0.42;  // 脚 = bottom 42%

    const aPos          = new Float32Array(totalCount * 3);
    const aBaseClothed  = new Float32Array(totalCount * 3);
    const aScatter      = new Float32Array(totalCount * 3);
    const aNormalLocal  = new Float32Array(totalCount * 3);
    const aBodyZone     = new Float32Array(totalCount);
    const aSeed         = new Float32Array(totalCount);

    const _p = new THREE.Vector3();
    const _n = new THREE.Vector3();

    for (let i = 0; i < totalCount; i++) {
      sampler.sample(_p, _n);
      aPos[i*3]   = _p.x;
      aPos[i*3+1] = _p.y;
      aPos[i*3+2] = _p.z;
      // body zone: 0=head, 1=torso (clothing zone), 2=limb
      let zone = 2;
      if (_p.y >= torsoTop)      zone = 0;
      else if (_p.y >= torsoBot) zone = 1;
      aBodyZone[i] = zone;
      // 服を着た時の膨らみ: torso のみ 25mm 外側
      const clothInflate = zone === 1 ? 0.025 : 0;
      aBaseClothed[i*3]   = _p.x + _n.x * clothInflate;
      aBaseClothed[i*3+1] = _p.y + _n.y * clothInflate;
      aBaseClothed[i*3+2] = _p.z + _n.z * clothInflate;
      aNormalLocal[i*3]   = _n.x;
      aNormalLocal[i*3+1] = _n.y;
      aNormalLocal[i*3+2] = _n.z;
      // aSeed = y 連動 (足元 → 頭の波紋)
      aSeed[i] = Math.max(0, Math.min(1, (_p.y - bb.min.y) / height)) + (Math.random() - 0.5) * 0.10;
      // 散らばり (球状ランダム、半径 3-6m)
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 3.0 + Math.random() * 3.0;
      aScatter[i*3]     = r * Math.sin(phi) * Math.cos(theta);
      aScatter[i*3 + 1] = r * Math.cos(phi) + 1.0;
      aScatter[i*3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',      new THREE.BufferAttribute(aPos, 3));
    geo.setAttribute('aBaseClothed',  new THREE.BufferAttribute(aBaseClothed, 3));
    geo.setAttribute('aScatter',      new THREE.BufferAttribute(aScatter, 3));
    geo.setAttribute('aNormalLocal',  new THREE.BufferAttribute(aNormalLocal, 3));
    geo.setAttribute('aBodyZone',     new THREE.BufferAttribute(aBodyZone, 1));
    geo.setAttribute('aSeed',         new THREE.BufferAttribute(aSeed, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  // ─── createAvatarFromExitSVG: 公式 E002 → 3D 押し出し → 粒子化 ───
  //   buildExitSVGMesh 経由でロード、成功時に onReady(api) 呼ぶ
  //   失敗時は onError、または primitive fallback
  function createAvatarFromExitSVG(opts, onReady, onError) {
    if (typeof THREE === 'undefined' || !THREE.MeshSurfaceSampler || !THREE.SVGLoader) {
      const err = new Error('addons not ready (need MeshSurfaceSampler + SVGLoader)');
      if (onError) onError(err); else if (opts && opts.fallback !== false) {
        return createAvatar(opts);
      }
      return null;
    }
    buildExitSVGMesh(
      THREE,
      function (mesh) {
        try {
          const count = pickParticleCount();
          const geo = bakeFromMesh(THREE, mesh, count);
          const api = buildAvatarFromGeo(geo, opts || {});
          if (onReady) onReady(api);
        } catch (e) {
          if (onError) onError(e);
        }
      },
      function (err) {
        console.warn('[avatar] SVG load failed:', err);
        if (onError) onError(err);
        // fallback (opts.fallback !== false)
        if (opts && opts.fallback !== false) {
          const api = createAvatar(opts);
          if (api && onReady) onReady(api);
        }
      }
    );
  }

  // ─── Avatar class ──────────────────────────────────────────
  // ── buildAvatarFromGeo: ベイク済み geo から Points + Material + api を生成 ──
  function buildAvatarFromGeo(geo, opts) {
    opts = opts || {};
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime:           { value: 0 },
        uTint:           { value: 0 },
        uPulse:          { value: 0 },
        uClothMix:       { value: 0 },
        uSize:           { value: 2.05 * dpr },
        uBreath:         { value: 1 },
        uLife:           { value: 1 },
        uInterest:       { value: 0 },
        uAssembly:       { value: 0 },             // 0=散らばり, 1=組成完了
        uMouse:          { value: new THREE.Vector2(0, 0) }, // NDC tilt
        uGrey:           { value: new THREE.Color(0x8a8a8e) },
        uPersonalColor:  { value: new THREE.Color(0.00, 0.92, 1.00) }, // default cyan
        uClothColor:     { value: new THREE.Color(0xffffff) },
      },
      transparent: true,
      depthWrite:  false,
      depthTest:   true,
      blending:    THREE.NormalBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.name = 'p3_pictogram_avatar';
    points.frustumCulled = false;
    // bloom 対象から外す (Codex E: 色純度保持)
    points.userData.noBloom = true;

    const api = {
      points: points,
      geo: geo,
      mat: mat,
      uniforms: mat.uniforms,
      _pulseDecay: 0,
      _tintTarget: 0,
      _clothTarget: 0,
      _disposed: false,
      _lastT: 0,
      _interestTarget: 0,
      _asmStart: -1,             // assembly 開始時刻 (sec)、-1 = 未開始
      _asmDelay: 6.0,            // 登場までの delay (秒)
      _asmDuration: 3.5,         // 組成にかける時間
      _mouseTarget: { x: 0, y: 0 },

      setTint: function (v) {
        api._tintTarget = Math.max(0, Math.min(1, v));
      },
      setCloth: function (v, color) {
        api._clothTarget = Math.max(0, Math.min(1, v));
        if (color) {
          if (color.isColor) mat.uniforms.uClothColor.value.copy(color);
          else mat.uniforms.uClothColor.value.set(color);
        }
      },
      setPersonalColor: function (nameOrColor) {
        if (typeof nameOrColor === 'string' && PERSONAL_COLORS[nameOrColor]) {
          const c = PERSONAL_COLORS[nameOrColor];
          mat.uniforms.uPersonalColor.value.setRGB(c[0], c[1], c[2]);
        } else if (nameOrColor && nameOrColor.isColor) {
          mat.uniforms.uPersonalColor.value.copy(nameOrColor);
        } else if (typeof nameOrColor === 'number') {
          mat.uniforms.uPersonalColor.value.set(nameOrColor);
        }
      },
      pulse: function () {
        // 1 イベント = pulse 1.0 → 0.0 / 0.7秒 (vertex shader が自動で波紋化)
        api._pulseDecay = 1.0;
      },
      update: function (timeSec) {
        if (api._disposed) return;
        const u = mat.uniforms;
        u.uTime.value = timeSec;
        // ease uniforms (各 60fps で滑らかに目標へ)
        const dt = Math.max(0.001, Math.min(0.05, timeSec - (api._lastT || timeSec)));
        api._lastT = timeSec;
        const easeRate = 1 - Math.exp(-dt * 4.5); // 約 0.22s で 90% 到達
        u.uTint.value     += (api._tintTarget  - u.uTint.value)     * easeRate;
        u.uClothMix.value += (api._clothTarget - u.uClothMix.value) * easeRate;
        u.uInterest.value += (api._interestTarget - u.uInterest.value) * easeRate * 1.2;
        // pulse は 0.7秒で 1→0 へ exp 減衰
        if (api._pulseDecay > 0) {
          api._pulseDecay = Math.max(0, api._pulseDecay - dt / 0.7);
          u.uPulse.value = api._pulseDecay;
        } else {
          u.uPulse.value = 0;
        }
        // ── Assembly タイマー (登場演出) ──
        if (api._asmStart < 0) api._asmStart = timeSec;
        const asmElapsed = timeSec - api._asmStart - api._asmDelay;
        if (asmElapsed < 0) {
          u.uAssembly.value = 0;  // まだ散らばり
        } else if (asmElapsed < api._asmDuration) {
          const p = asmElapsed / api._asmDuration;
          // smoothstep^2 で「最後に決まる」感
          const ease = p * p * (3 - 2 * p);
          u.uAssembly.value = ease;
        } else {
          u.uAssembly.value = 1;  // 組成完了
        }
        // ── Mouse uniform: スムージング (急な動きを和らげる) ──
        u.uMouse.value.x += (api._mouseTarget.x - u.uMouse.value.x) * easeRate * 0.6;
        u.uMouse.value.y += (api._mouseTarget.y - u.uMouse.value.y) * easeRate * 0.6;
      },
      setMouse: function (ndcX, ndcY) {
        api._mouseTarget.x = Math.max(-1, Math.min(1, ndcX));
        api._mouseTarget.y = Math.max(-1, Math.min(1, ndcY));
      },
      setInterest: function (v) {
        api._interestTarget = Math.max(0, Math.min(1, v));
      },
      summonNow: function () {
        // delay スキップして即組成 (debug 用)
        api._asmStart = -1;
        api._asmDelay = 0;
        api._asmDuration = 1.0;
      },
      setRatchet: function (tier) {
        // tier 0..3 で密度可変 (再 sampling なし、draw range のみ)
        const total = geo.attributes.position.count;
        const ratio = [0.30, 0.55, 0.80, 1.00][Math.max(0, Math.min(3, tier))];
        geo.setDrawRange(0, Math.floor(total * ratio));
      },
      dispose: function () {
        api._disposed = true;
        try { geo.dispose(); } catch (e) {}
        try { mat.dispose(); } catch (e) {}
        if (points.parent) points.parent.remove(points);
      },
    };

    // scene にアタッチ
    if (opts.scene) opts.scene.add(points);
    // y=0 が足元、配置調整 (P3 scene の中心は logo の周りなので少し下げる)
    points.position.set(opts.x || 0, opts.y || -0.8, opts.z || 0);

    return api;
  }

  // ─── P3 本シーンへの自動 attach (auto-mount widget) ─────────
  //   既存 P3 を壊さず、固定位置の独立 canvas でアバターを表示。
  //   localStorage で tint / personalColor を永続化。
  //   ADD TO CART イベントで pulse() を自動発火 (Good Vibes 累積で tint 上昇)。
  const STORAGE_KEY = 'inryoku.avatar.state.v1';
  function loadAvatarState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function saveAvatarState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function attachToP3(opts) {
    opts = opts || {};
    if (window.__p3AvatarWidget) return window.__p3AvatarWidget;
    if (typeof THREE === 'undefined' || !THREE.MeshSurfaceSampler) {
      console.warn('[avatar.attachToP3] addons not ready');
      return null;
    }

    // 既存 state 読込
    const saved = loadAvatarState() || {};
    const initialColor   = saved.color || 'cyan';
    const initialTint    = typeof saved.tint   === 'number' ? saved.tint   : 0;
    const goodVibesCount = typeof saved.vibes  === 'number' ? saved.vibes  : 0;

    // ── 2026-05-24: 右下 HUD ではなく、商品 carousel の場に i を参加させる ──
    // 旧: document.body 右下 fixed widget。UI 小窓に見え、P3/EC 体験から分離していた。
    const host = (opts.host && document.querySelector(opts.host)) ||
                 document.getElementById('store-grid') ||
                 document.querySelector('.item-grid') ||
                 document.body;
    if (host !== document.body) {
      const hs = window.getComputedStyle(host);
      if (hs.position === 'static') host.style.position = 'relative';
    }

    const wrap = document.createElement('div');
    wrap.id = 'p3-avatar-widget';
    const useInlineAvatar = host !== document.body;
    const sideStage = useInlineAvatar && window.innerWidth >= 760;
    wrap.style.cssText = useInlineAvatar ? (
      'position:absolute;' +
      'left:' + (sideStage ? 'calc(50% + 240px)' : '50%') + ';' +
      'top:' + (sideStage ? '50%' : '50%') + ';' +
      'width:' + (opts.width || (sideStage ? '300px' : '420px')) + ';' +
      'height:' + (opts.height || (sideStage ? '430px' : '360px')) + ';' +
      'transform:translate(-50%,-50%);' +
      'z-index:7;' +
      'pointer-events:none;' +
      'border-radius:0;' +
      'overflow:visible;' +
      'background:transparent;' +
      'box-shadow:none;' +
      // 2026-05-30 司「アバター見えない」: screen 合成だと黒クロームが透明で消える。normalに。
      'mix-blend-mode:normal;' +
      'opacity:1;'
    ) : (
      'position:fixed;' +
      'right:' + (opts.right || '24px') + ';' +
      'bottom:' + (opts.bottom || '24px') + ';' +
      'width:' + (opts.width || '180px') + ';' +
      'height:' + (opts.height || '320px') + ';' +
      'z-index:9000;' +
      'pointer-events:auto;' +
      'border-radius:8px;' +
      'overflow:hidden;' +
      'background:radial-gradient(ellipse at center, oklch(20% 0.02 240 / .35), oklch(8% 0.01 240 / .65));' +
      'backdrop-filter:blur(6px);' +
      '-webkit-backdrop-filter:blur(6px);' +
      'box-shadow:0 8px 32px rgba(0,0,0,.5), inset 0 0 0 1px oklch(80% 0.13 200 / .18);' +
      'cursor:grab;'
    );

    // ラベル (上部小さく)
    const label = document.createElement('div');
    label.textContent = 'i';
    label.style.cssText =
      'position:absolute;left:10px;top:8px;font:600 12px/1 VT323, monospace;' +
      'color:oklch(80% 0.13 200);letter-spacing:.18em;mix-blend-mode:plus-lighter;' +
      'pointer-events:none;text-shadow:0 0 8px oklch(80% 0.13 200 / .6);' +
      (useInlineAvatar ? 'display:none;' : '');
    wrap.appendChild(label);

    // 個人色ピル (右上小)
    const colorDot = document.createElement('div');
    colorDot.style.cssText =
      'position:absolute;right:10px;top:10px;width:10px;height:10px;border-radius:50%;' +
      'box-shadow:0 0 8px currentColor;pointer-events:auto;cursor:pointer;' +
      (useInlineAvatar ? 'display:none;' : '');
    const setDotColor = function (name) {
      const c = PERSONAL_COLORS[name] || PERSONAL_COLORS.cyan;
      colorDot.style.background = 'rgb(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ')';
      colorDot.style.color      = colorDot.style.background;
    };
    setDotColor(initialColor);
    wrap.appendChild(colorDot);

    const tryOnAura = document.createElement('div');
    tryOnAura.setAttribute('aria-hidden', 'true');
    tryOnAura.style.cssText =
      'position:absolute;left:50%;top:53%;width:210px;height:300px;' +
      'transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;' +
      'background:conic-gradient(from 20deg, #ff245f, #ffe94d, #35ff72, #29e7ff, #6b5cff, #ff35d0, #ff245f);' +
      'filter:blur(28px) saturate(1.35);opacity:0;mix-blend-mode:screen;' +
      'transition:opacity .34s ease, transform .34s ease;';
    if (useInlineAvatar) wrap.appendChild(tryOnAura);

    const stageShadow = document.createElement('div');
    stageShadow.setAttribute('aria-hidden', 'true');
    stageShadow.style.cssText =
      'position:absolute;left:50%;bottom:21%;width:170px;height:30px;' +
      'transform:translateX(-50%);border-radius:50%;pointer-events:none;' +
      'background:radial-gradient(ellipse at center, rgba(120,250,255,.28), rgba(120,250,255,.08) 44%, transparent 72%);' +
      'filter:blur(7px);opacity:' + (useInlineAvatar ? '.72' : '0') + ';mix-blend-mode:screen;';
    if (useInlineAvatar) wrap.appendChild(stageShadow);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;';
    wrap.appendChild(canvas);
    if (useInlineAvatar && host.firstChild) host.insertBefore(wrap, host.firstChild);
    else host.appendChild(wrap);

    // ── Three.js ──
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputColorSpace;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(useInlineAvatar ? 30 : 34, W / H, 0.1, 30);
    camera.position.set(0, useInlineAvatar ? 1.05 : 1.0, useInlineAvatar ? 4.2 : 3.4);
    camera.lookAt(0, 0.85, 0);
    if (useInlineAvatar) {
      const hemi = new THREE.HemisphereLight(0xdffcff, 0x101016, 1.55);
      const key = new THREE.DirectionalLight(0xffffff, 2.25);
      key.position.set(1.8, 2.6, 3.0);
      const rim = new THREE.DirectionalLight(0x35f7ff, 1.25);
      rim.position.set(-2.2, 1.7, -1.7);
      scene.add(hemi, key, rim);
    }

    // ── Avatar は SVG 非同期ロードを試み、失敗時は primitive fallback ──
    let avatar = null;
    let backingMesh = null;
    let gameMesh = null;
    function onAvatarReady(a) {
      if (avatar) return;
      avatar = a;
      // 状態復元
      a.setPersonalColor(initialColor);
      a.setTint(useInlineAvatar ? Math.max(initialTint, 0.22) : initialTint);
      if (useInlineAvatar) {
        a.summonNow();
        a.setCloth(0.12, 0xf2f2f2);
        a.points.visible = false;
        a.points.scale.setScalar(0.72);
        a.points.position.y -= 0.08;
        // 2026-05-30 司「アバターいない繋げて」: Blender製 走る人GLB を carousel 脇へ。
        //   GLB(走る人) → SVG押し出し → capsule の順で fallback。
        var _placeMesh = function (mesh) {
          if (mesh.userData._env) scene.environment = mesh.userData._env;
          mesh.userData.tryOn = 0;
          mesh.userData.tryOnTarget = 0;
          gameMesh = mesh;
          scene.add(mesh);
        };
        if (THREE.GLTFLoader) {
          buildExitGLB(THREE, renderer, _placeMesh, function () {
            buildExitPremium3D(THREE, renderer, _placeMesh, function () {
              gameMesh = buildGamePictogramMesh(THREE); scene.add(gameMesh);
            });
          });
        } else {
          buildExitPremium3D(THREE, renderer, _placeMesh, function () {
            gameMesh = buildGamePictogramMesh(THREE); scene.add(gameMesh);
          });
        }
      }
    }
    if (useInlineAvatar && THREE.SVGLoader) {
      // まず高品質 capsule 版を即表示。SVG 読み込み待ちで空 canvas にしない。
      const immediate = createAvatar({ scene: scene, y: -0.08 });
      if (immediate) onAvatarReady(immediate);

      let fallbackTimer = setTimeout(function () {
        if (avatar) return;
        const fb = createAvatar({ scene: scene, y: -0.08 });
        if (fb) onAvatarReady(fb);
      }, 1500);

      // 2026-05-30 司「アバターよくして」: 走る人GLB が主役なので、手前に被さって
      //   丸い棒人間に見せていた SVGシルエット板 (backingMesh) は追加しない。
      //   (旧コードはコメント保持: 下の buildExitSVGMesh ブロックを無効化)

      createAvatarFromExitSVG({ scene: scene, y: -0.08, fallback: false },
        function (a) {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          if (avatar) {
            try { a.dispose(); } catch (e) {}
            return;
          }
          onAvatarReady(a);
        },
        function () {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          const fb = createAvatar({ scene: scene, y: -0.08 });
          if (fb) onAvatarReady(fb);
        }
      );
    } else if (THREE.SVGLoader) {
      let fallbackTimer = useInlineAvatar ? setTimeout(function () {
        if (avatar) return;
        const fb = createAvatar({ scene: scene, y: -0.08 });
        if (fb) onAvatarReady(fb);
      }, 1400) : null;
      createAvatarFromExitSVG({ scene: scene, y: useInlineAvatar ? -0.08 : 0, fallback: true },
        function (a) {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          onAvatarReady(a);
        },
        function () {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          const fb = createAvatar({ scene: scene, y: useInlineAvatar ? -0.08 : 0 });
          if (fb) onAvatarReady(fb);
        }
      );
    } else {
      const a = createAvatar({ scene: scene, y: useInlineAvatar ? -0.08 : 0 });
      if (a) onAvatarReady(a);
    }

    // ── インタラクション: 色ドットクリックで個人色 cycle ──
    const COLOR_CYCLE = ['cyan', 'magenta', 'yellow', 'red', 'green', 'blue'];
    let colorIdx = Math.max(0, COLOR_CYCLE.indexOf(initialColor));
    colorDot.addEventListener('click', function (e) {
      e.stopPropagation();
      colorIdx = (colorIdx + 1) % COLOR_CYCLE.length;
      const next = COLOR_CYCLE[colorIdx];
      if (avatar) avatar.setPersonalColor(next);
      setDotColor(next);
      const s = loadAvatarState() || {};
      s.color = next;
      saveAvatarState(s);
    });

    // ── Good Vibes 累積: pulse + tint じわじわ上昇 ──
    let vibes = goodVibesCount;
    function recordGoodVibe() {
      vibes++;
      const newTint = Math.min(1, Math.log(1 + vibes) / Math.log(1 + 30));
      if (avatar) {
        avatar.setTint(newTint);
        avatar.setInterest(1);
        avatar.pulse();
        setTimeout(function () { if (avatar) avatar.setInterest(0.22); }, 900);
      }
      const s = loadAvatarState() || {};
      s.vibes = vibes;
      s.tint  = newTint;
      saveAvatarState(s);
    }

    // ── ADD TO CART イベントを自動 hook (Good Vibes トリガ) ──
    function attachCartHooks() {
      const buttons = document.querySelectorAll('.add-btn, .add-to-cart-btn, #pm-cart');
      buttons.forEach(function (b) {
        if (b.dataset.avatarHooked === '1') return;
        b.dataset.avatarHooked = '1';
        b.addEventListener('click', recordGoodVibe);
      });
    }
    attachCartHooks();

    function getProductTryOnColor(card) {
      const nameEl = card.querySelector('.product-card-name');
      const name = (nameEl && nameEl.textContent || '').toLowerCase();
      if (name.indexOf('grey') >= 0 || name.indexOf('gray') >= 0) return new THREE.Color(0xc8cdd2);
      if (name.indexOf('logo') >= 0) return new THREE.Color(0x70f7ff);
      if (name.indexOf('enter') >= 0) return new THREE.Color(0xf2f4f5);
      const idx = parseInt(card.getAttribute('data-idx') || '0', 10) || 0;
      return new THREE.Color().setHSL((idx * 0.135 + 0.52) % 1, 0.92, 0.64);
    }

    function setTryOnStage(active, color) {
      if (!useInlineAvatar) return;
      tryOnAura.style.opacity = active ? '.52' : '0';
      tryOnAura.style.transform = active ? 'translate(-50%,-50%) scale(1.08)' : 'translate(-50%,-50%) scale(.92)';
      stageShadow.style.opacity = active ? '.96' : '.72';
      if (color) {
        const css = '#' + color.getHexString();
        stageShadow.style.background = 'radial-gradient(ellipse at center, ' + css + '70, ' + css + '24 44%, transparent 72%)';
      }
      if (gameMesh && gameMesh.userData) {
        gameMesh.userData.tryOnTarget = active ? 1 : 0;
        if (color && gameMesh.userData.clothTarget) gameMesh.userData.clothTarget.copy(color);
      }
    }

    let currentTryOnCard = null;
    function enterTryOnCard(card) {
      if (!avatar || currentTryOnCard === card) return;
      currentTryOnCard = card;
      const c = getProductTryOnColor(card);
      avatar.setCloth(0.88, c);
      avatar.setTint(Math.max(avatar._tintTarget || 0, 0.34));
      avatar.setInterest(0.95);
      avatar.pulse();
      wrap.style.opacity = '1';
      setTryOnStage(true, c);
    }

    function leaveTryOnCard(card) {
      if (!avatar || (card && currentTryOnCard !== card)) return;
      currentTryOnCard = null;
      avatar.setCloth(0.12);
      avatar.setInterest(0.10);
      setTryOnStage(false);
    }

    function findTryOnCardAt(x, y) {
      let best = null;
      let bestDist = Infinity;
      document.querySelectorAll('.carousel-item').forEach(function (card) {
        const cs = window.getComputedStyle(card);
        if (parseFloat(cs.opacity || '0') < 0.08 || cs.visibility === 'hidden') return;
        const r = card.getBoundingClientRect();
        const padX = Math.max(24, r.width * 0.18);
        const padY = Math.max(24, r.height * 0.08);
        if (x < r.left - padX || x > r.right + padX || y < r.top - padY || y > r.bottom + padY) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = x - cx;
        const dy = y - cy;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = card;
        }
      });
      return best;
    }

    // ── 商品に触れた時だけ i が試着反応する ──
    function attachProductHooks() {
      const cards = document.querySelectorAll('.carousel-item');
      cards.forEach(function (card) {
        if (card.dataset.avatarProductHooked === '1') return;
        card.dataset.avatarProductHooked = '1';
        const enter = function () {
          enterTryOnCard(card);
        };
        const leave = function () {
          leaveTryOnCard(card);
        };
        card.addEventListener('mouseenter', enter);
        card.addEventListener('pointerdown', enter);
        card.addEventListener('mouseleave', leave);
        card.addEventListener('pointercancel', leave);
      });
    }
    attachProductHooks();
    // 動的に追加されるボタンに対応 (modal 等)
    const cartObserver = new MutationObserver(attachCartHooks);
    cartObserver.observe(document.body, { childList: true, subtree: true });
    const productObserver = new MutationObserver(attachProductHooks);
    productObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('pointermove', function (e) {
      if (!useInlineAvatar) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const card = (el && el.closest ? el.closest('.carousel-item') : null) || findTryOnCardAt(e.clientX, e.clientY);
      if (card) enterTryOnCard(card);
      else if (currentTryOnCard) leaveTryOnCard();
    });
    window.addEventListener('pointerdown', function (e) {
      if (!useInlineAvatar) return;
      const card = findTryOnCardAt(e.clientX, e.clientY);
      if (card) enterTryOnCard(card);
    });

    // ── 起動時に小さな welcome pulse ──
    setTimeout(function () { if (avatar) avatar.pulse(); }, 10500);

    // ── Mouse 追従 (全画面ベース、widget の中央を 0,0 とする) ──
    window.addEventListener('pointermove', function (e) {
      if (!avatar) return;
      const r = wrap.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth  * 0.5);
      const dy = (e.clientY - cy) / (window.innerHeight * 0.5);
      avatar.setMouse(dx, dy);
    });

    // ── Drag 移動 (司さんが場所変えたい時) ──
    let dragStart = null;
    wrap.addEventListener('pointerdown', function (e) {
      if (useInlineAvatar) return;
      if (e.target === colorDot) return;
      dragStart = { x: e.clientX, y: e.clientY, r: wrap.getBoundingClientRect() };
      wrap.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragStart) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const newRight  = (window.innerWidth  - (dragStart.r.right - dx));
      const newBottom = (window.innerHeight - (dragStart.r.bottom - dy));
      wrap.style.right  = Math.max(0, newRight)  + 'px';
      wrap.style.bottom = Math.max(0, newBottom) + 'px';
    });
    window.addEventListener('pointerup', function () {
      if (!dragStart) return;
      dragStart = null;
      wrap.style.cursor = 'grab';
    });

    // ── 解像度 resize ──
    function onResize() {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    // ── Render loop ──
    const start = performance.now();
    let alive = true;
    let lastPulseBeat = -1;
    function loop() {
      if (!alive) return;
      const t = (performance.now() - start) / 1000;
      if (avatar) {
        avatar.update(t);
        const breath = Math.sin(t * 1.27 + Math.sin(t * 0.31) * 0.22);
        const sway = Math.sin(t * 0.52);
        const interest = avatar.uniforms.uInterest.value;
        const beat = Math.floor(t * 1.2); // 約72 BPM
        if (beat !== lastPulseBeat && beat % 4 === 0) {
          lastPulseBeat = beat;
          avatar.pulse();
        }
        avatar.points.rotation.y = Math.sin(t * 0.18) * 0.055 + avatar.uniforms.uMouse.value.x * 0.055 + interest * 0.035;
        avatar.points.rotation.z = sway * 0.010 + interest * 0.012;
        avatar.points.position.x = sway * 0.018 + avatar.uniforms.uMouse.value.x * 0.025;
        avatar.points.position.y = (useInlineAvatar ? -0.16 : 0) + breath * 0.014;
        const liveScale = 1.08 + breath * 0.016 + avatar.uniforms.uPulse.value * 0.038 + interest * 0.022;
        if (useInlineAvatar) avatar.points.scale.setScalar(liveScale);

        // 2026-05-31 司「アバターをもっと自由に動き回れる3Dキャラに」:
        //   widget 全体を宇宙の中でゆっくり大きく漂わせる(複数 sin の重ね合わせ=非周期的)。
        //   マウスにも少し引き寄せられる = 生きてる/自由に動く感。
        if (useInlineAvatar && wrap) {
          var driftX = Math.sin(t * 0.21) * 110 + Math.cos(t * 0.097) * 55
                     + avatar.uniforms.uMouse.value.x * 60;
          var driftY = Math.cos(t * 0.17) * 70  + Math.sin(t * 0.13) * 32
                     - avatar.uniforms.uMouse.value.y * 40;
          wrap.style.transform =
            'translate(calc(-50% + ' + driftX.toFixed(0) + 'px), calc(-50% + ' + driftY.toFixed(0) + 'px))';
        }
        if (backingMesh) {
          backingMesh.rotation.y = avatar.points.rotation.y;
          backingMesh.rotation.z = avatar.points.rotation.z;
          backingMesh.position.x = avatar.points.position.x;
          backingMesh.position.y = -0.08 + breath * 0.014;
          backingMesh.scale.setScalar(0.92 + breath * 0.012 + avatar.uniforms.uPulse.value * 0.030 + interest * 0.020);
          if (backingMesh.material) {
            backingMesh.material.opacity = 0.08 + avatar.uniforms.uPulse.value * 0.08 + interest * 0.06;
          }
        }
        if (gameMesh) {
          // 2026-05-30 司「動くようにして」: 走る人 GLB に生き生きした動きを付与。
          //   走るバウンド(上下) + 前後の体ゆれ + ゆっくり振り向き + 興味で前傾。
          var runT   = t * 2.6;                          // 走るテンポ
          var bounce = Math.abs(Math.sin(runT)) * 0.045; // 接地でゼロ、跳ねて上がる
          var lean   = Math.sin(runT) * 0.05;            // 前後の体ゆれ
          var turn   = Math.sin(t * 0.45) * 0.5;         // ゆっくり振り向き(±0.5rad)
          gameMesh.rotation.y = turn + avatar.uniforms.uMouse.value.x * 0.25;
          gameMesh.rotation.z = lean * 0.5 + sway * 0.02;
          gameMesh.rotation.x = -0.10 - interest * 0.12; // 常に少し前傾、興味で深く
          gameMesh.position.x = avatar.points.position.x + Math.sin(t * 0.3) * 0.04;
          gameMesh.position.y = -0.20 + bounce + breath * 0.012; // 走るバウンド
          gameMesh.scale.setScalar((sideStage ? 0.76 : 0.82) + breath * 0.014 + avatar.uniforms.uPulse.value * 0.050 + interest * 0.035);
          if (gameMesh.userData) {
            const ud = gameMesh.userData;
            ud.tryOn += ((ud.tryOnTarget || 0) - ud.tryOn) * 0.10;
            if (ud.bodyMat) {
              ud.bodyMat.opacity = 0.28 + ud.tryOn * 0.18 + avatar.uniforms.uPulse.value * 0.06;
              ud.bodyMat.emissiveIntensity = 0.16 + ud.tryOn * 0.18 + interest * 0.08;
            }
            if (ud.clothMat) {
              const base = ud.clothBase || new THREE.Color(0xe7fbff);
              const target = ud.clothTarget || base;
              ud.clothMat.color.copy(base).lerp(target, ud.tryOn);
              ud.clothMat.opacity = 0.36 + ud.tryOn * 0.34 + avatar.uniforms.uPulse.value * 0.05;
              ud.clothMat.emissive.copy(target);
              ud.clothMat.emissiveIntensity = 0.12 + ud.tryOn * 0.55 + interest * 0.16;
            }
            if (ud.accentMat) {
              ud.accentMat.emissiveIntensity = 0.8 + avatar.uniforms.uPulse.value * 1.2 + interest * 0.9 + ud.tryOn * 0.8;
            }
          }
        }
      }
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // ── 公開 API ──
    const widget = {
      get avatar() { return avatar; },
      wrap: wrap,
      renderer: renderer,
      scene: scene,
      camera: camera,
      recordGoodVibe: recordGoodVibe,
      dispose: function () {
        alive = false;
        try { cartObserver.disconnect(); } catch (e) {}
        try { productObserver.disconnect(); } catch (e) {}
        try { if (avatar) avatar.dispose(); } catch (e) {}
        try {
          if (backingMesh) {
            if (backingMesh.geometry) backingMesh.geometry.dispose();
            if (backingMesh.material) backingMesh.material.dispose();
            if (backingMesh.parent) backingMesh.parent.remove(backingMesh);
          }
        } catch (e) {}
        try {
          if (gameMesh) {
            gameMesh.traverse(function (obj) {
              if (obj.isMesh) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material && obj.material.dispose) obj.material.dispose();
              }
            });
            if (gameMesh.parent) gameMesh.parent.remove(gameMesh);
          }
        } catch (e) {}
        try { renderer.dispose(); } catch (e) {}
        try { wrap.remove(); } catch (e) {}
        window.__p3AvatarWidget = null;
      },
    };
    window.__p3AvatarWidget = widget;
    window.__p3Avatar = avatar; // shorthand
    return widget;
  }

  // ─── createAvatar: primitive 版 (旧 6 球+円柱) sync ───
  function createAvatar(opts) {
    if (typeof THREE === 'undefined' || !THREE.MeshSurfaceSampler) {
      console.warn('[p3_pictogram_avatar] THREE / MeshSurfaceSampler not ready');
      return null;
    }
    const geo = bakeAvatarGeometry(THREE, pickParticleCount());
    return buildAvatarFromGeo(geo, opts || {});
  }

  // ─── Public API ────────────────────────────────────────────
  window.inryokuPictogramAvatar = {
    create: createAvatar,                          // 旧 primitive 版 (sync)
    createFromExitSVG: createAvatarFromExitSVG,    // E002 SVG 版 (async callback)
    attachToP3: attachToP3,
    PERSONAL_COLORS: PERSONAL_COLORS,
  };

  // ─── Auto-mount on P3 ──────────────────────────────────────
  //   ?avatar=0 で OFF、それ以外は自動配置
  //   ?avatar=1 (debug) は full-screen テスト scene を優先
  function maybeAutoMountP3() {
    try {
      // 2026-05-31 司「アバターちょっと意味わからない」: 通常P3 への自動表示を停止。
      //   復活は ?avatar=on。debug 単体は ?avatar=1 で従来通り確認可能。
      if (!/[?&]avatar=on/.test(location.search)) return;
      if (/[?&]avatar=0/.test(location.search)) return; // OFF
      if (/[?&]avatar=1/.test(location.search)) return; // debug scene 優先
      // P3 page でのみ自動マウント (index.html / p3_test.html)
      const path = location.pathname;
      const isP3Page = /index\.html?$|p3_test\.html?$|^\/$/.test(path);
      if (!isP3Page) return;
      if (typeof THREE === 'undefined' || !THREE.MeshSurfaceSampler) return;
      // 少し遅延させて P3 init 完了を待つ
      setTimeout(function () { attachToP3(); }, 1200);
    } catch (e) {
      console.warn('[avatar.auto] mount failed:', e);
    }
  }

  // ─── Auto-init helper (THREE addons ready 後に自動 attach) ──
  //   注意: P3 既存 scene への自動 attach は無効。司さんが明示的に
  //   `window.inryokuPictogramAvatar.create({ scene, x, y, z })` を呼ぶ。
  //   debug 用: ?avatar=1 で確認シーン (小さい test scene) を起動
  function maybeRunDebugScene() {
    try {
      if (!/[?&]avatar=1/.test(location.search)) return;
      if (typeof THREE === 'undefined' || !THREE.MeshSurfaceSampler) return;

      // mini debug scene (P3 既存と独立)
      const canvas = document.createElement('canvas');
      canvas.id = 'p3-avatar-debug-canvas';
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;background:#0a0a12;';
      document.body.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x0a0a12, 1);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 50);
      camera.position.set(0, 0.1, 3.3);
      camera.lookAt(0, 0, 0);   // 2026-05-25: 中心化した premium 3D を正面フレーム

      // 2026-05-25 司さん「exit mark の本格3D」: bevel + クローム + 虹環境マップ
      //   color management (iridescence/PBR が正しく出る)
      renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputColorSpace;
      if ('toneMapping' in renderer) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping || renderer.toneMapping;
        renderer.toneMappingExposure = 1.15;
      }

      // ── ライティング (PBR を立体的に見せる) ──
      const hemi = new THREE.HemisphereLight(0xdffcff, 0x0a0a12, 0.9);
      const key  = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2.4, 3.2, 3.4);
      const rim  = new THREE.DirectionalLight(0x46f6ff, 1.7);  rim.position.set(-2.8, 1.8, -2.2);
      const fill = new THREE.DirectionalLight(0xff5fd0, 1.1);  fill.position.set(1.6, -1.2, 2.0);
      scene.add(hemi, key, rim, fill);

      // ── 床の淡い反射円 (彫刻が「立っている」接地感) ──
      const ringGeo = new THREE.RingGeometry(0.05, 1.15, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x2bd6ff, transparent: true, opacity: 0.10,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.001;
      scene.add(ring);

      let avatar = null;      // 旧 particle (fallback / pulse 用)
      let premium = null;     // 新 premium 3D mesh
      function _setAvatar(a) { avatar = a; window.__p3Avatar = a; }

      // 2026-05-30: Blender 製 正面立ち GLB を最優先 → SVG押し出し → 粒子 の順に fallback
      function _useExitMesh(mesh) {
        premium = mesh;
        if (mesh.userData._env) scene.environment = mesh.userData._env;
        scene.add(mesh);
        window.__p3Premium = mesh;
      }
      if (THREE.GLTFLoader) {
        buildExitGLB(THREE, renderer, _useExitMesh, function (err) {
          console.warn('[avatar] GLB failed, fallback SVG extrude:', err);
          if (THREE.SVGLoader) {
            buildExitPremium3D(THREE, renderer, _useExitMesh, function () {
              createAvatarFromExitSVG({ scene, y: 0, fallback: true },
                _setAvatar, function () { _setAvatar(createAvatar({ scene, y: 0 })); });
            });
          } else { _setAvatar(createAvatar({ scene, y: 0 })); }
        });
      } else if (THREE.SVGLoader) {
        buildExitPremium3D(THREE, renderer, _useExitMesh, function (err) {
          console.warn('[avatar] premium 3D failed, fallback particle:', err);
          createAvatarFromExitSVG({ scene, y: 0, fallback: true },
            _setAvatar, function () { _setAvatar(createAvatar({ scene, y: 0 })); });
        });
      } else {
        _setAvatar(createAvatar({ scene, y: 0 }));
      }
      window.__p3AvatarScene = scene;
      window.__p3AvatarRenderer = renderer;

      // 簡易 UI (HTML overlay)
      const ui = document.createElement('div');
      ui.style.cssText = 'position:fixed;left:14px;top:14px;z-index:10000;font:13px/1.5 monospace;color:#fff;background:rgba(0,0,0,.65);padding:14px 16px;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.4);';
      ui.innerHTML =
        '<div style="font-weight:700;margin-bottom:8px;color:#0cf;">P3 Avatar Debug</div>' +
        '<div style="margin-bottom:4px;">Tint (染まり): <input id="ava-tint" type="range" min="0" max="1" step="0.01" value="0" style="width:160px;vertical-align:middle;"></div>' +
        '<div style="margin-bottom:4px;">Cloth (服): <input id="ava-cloth" type="range" min="0" max="1" step="0.01" value="0" style="width:160px;vertical-align:middle;"></div>' +
        '<div style="margin-bottom:8px;">Color: ' +
          ['red','green','blue','cyan','magenta','yellow'].map(c =>
            `<button data-c="${c}" style="margin:2px;padding:3px 8px;background:rgb(${PERSONAL_COLORS[c].map(v=>Math.round(v*255)).join(',')});color:#000;border:none;border-radius:3px;cursor:pointer;font-family:inherit;">${c}</button>`
          ).join('') + '</div>' +
        '<button id="ava-pulse" style="padding:6px 14px;background:#0cf;color:#001;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-family:inherit;">PULSE (Good Vibes!)</button>';
      document.body.appendChild(ui);

      document.getElementById('ava-tint').addEventListener('input',  e => avatar && avatar.setTint(parseFloat(e.target.value)));
      document.getElementById('ava-cloth').addEventListener('input', e => avatar && avatar.setCloth(parseFloat(e.target.value)));
      document.getElementById('ava-pulse').addEventListener('click', () => avatar && avatar.pulse());
      ui.querySelectorAll('button[data-c]').forEach(b => {
        b.addEventListener('click', () => avatar && avatar.setPersonalColor(b.dataset.c));
      });

      // Render loop
      const start = performance.now();
      function loop() {
        if (avatar && avatar._disposed) return;
        const t = (performance.now() - start) / 1000;
        if (premium) {
          // ゆっくり回して 3D・面取り・虹の映り込みを見せる + 呼吸
          premium.rotation.y = Math.sin(t * 0.35) * 0.55;
          const breath = Math.sin(t * 1.27 + Math.sin(t * 0.31) * 0.22);
          premium.position.y = breath * 0.012;
          premium.scale.setScalar(1.0 + breath * 0.010);
        }
        if (avatar) {
          avatar.update(t);
          if (avatar.points) avatar.points.rotation.y = Math.sin(t * 0.18) * 0.18;
        }
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);

      // resize
      window.addEventListener('resize', function () {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });

      console.info('[p3_pictogram_avatar] debug scene ready — UI top-left');
    } catch (e) {
      console.warn('[p3_pictogram_avatar] debug scene failed:', e);
    }
  }

  // bridge ready 後に debug scene 起動 + auto-mount
  function onReady() {
    maybeRunDebugScene();
    maybeAutoMountP3();
  }
  if (typeof THREE !== 'undefined' && THREE.MeshSurfaceSampler) {
    onReady();
  } else {
    window.addEventListener('threeAddonsReady', onReady, { once: true });
  }
})();
