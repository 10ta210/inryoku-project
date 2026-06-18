/**
 * p1_zero_v2.js — inryokü P1 同一球体モーフ最高品質版
 *
 * 司さん指示 (2026-05-21):
 *   「同一球体モーフだけを最高品質に作り直す」
 *   - 最初は陰陽 (グレーから始めない)
 *   - 3D 陰陽 (P2 サンプルベース)
 *   - 内側の白黒点はいらない
 *   - グレー化は S 字境界から溶け合う (液体・分子拡散)
 *   - グレー → RGBCMY は内部から滲み出る (P2/P3 コア品質)
 *   - 白光は球が光源になる (外側にコロナ)
 *   - 瞳は白光の奥から浮かぶ
 *   - 十字架は球体の外側に太陽十字として伸びる
 *
 * 構成:
 *   - sphere (radius 1.0, 192×128) = 同一球体、全 morph
 *   - aura  (radius 1.18) = 外側微発光、white で強化
 *   - solar (fullscreen plane) = コロナ + 太陽十字
 *
 * Uniform 分離:
 *   uBirth (0..1)     白黒衝突から陰陽が凝結する過程
 *   uTaichi (0..1)    3D 陰陽の確立
 *   uGrey (0..1)      陰陽 → グレー (S字境界から溶ける)
 *   uColorLeak (0..1) グレー内部から虹が滲み出す
 *   uCoreColor (0..1) RGBCMY 完全体 (P2/P3 コア品質)
 *   uWhite (0..1)     白光球 (球が光源になる)
 *   uEye (0..1)       閉じた瞳の出現
 *   uEyeOpen (0..1)   開眼
 *   uCross (0..1)     外側の太陽十字
 *
 * 全 effect は mix() ベース、additive 禁止。
 */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { console.error('[p1_zero_v2] THREE not loaded'); return; }

  // ─────────── DOM ───────────
  const root    = document.getElementById('p1z-root');
  const canvas  = document.getElementById('p1z-webgl');
  const hud     = document.getElementById('p1z-stage');
  const pauseBtn= document.getElementById('p1z-pause');
  const jumpBtn = document.getElementById('p1z-jump');

  // ─────────── Renderer / Scene / Camera ───────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  // 司さん指示「背景 95win のデザインに変えて」→ Win95 teal #008080
  renderer.setClearColor(0x008080, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputColorSpace;

  const scene  = new THREE.Scene();
  // PerspectiveCamera で 3D 感を出す (P2 と同等)
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 3.6);
  camera.lookAt(0, 0, 0);

  // root 用 group (一括で揺らす)
  const root3D = new THREE.Group();
  scene.add(root3D);

  // ─────────── Common Uniforms ───────────
  const uniforms = {
    uTime:       { value: 0 },
    uBirth:      { value: 0 },
    uTaichi:     { value: 0 },
    uGrey:       { value: 0 },
    uColorLeak:  { value: 0 },
    uCoreColor:  { value: 0 },
    uWhite:      { value: 0 },
    uEye:        { value: 0 },
    uEyeOpen:    { value: 0 },
    uCross:      { value: 0 },
    // 2026-05-21 段階23: Belcour 2017 thin-film iridescence (Codex Agent A)
    uThickness:    { value: 380.0 }, // nm, 呼吸
    uIOR1:         { value: 1.30  }, // 膜 IOR
    uIridStrength: { value: 0.0   }, // 0..1 段階駆動
  };

  // ─────────── Sphere Shader (同一球体) ───────────
  const sphereMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite:  true,
    vertexShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vP;
      varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vN;
      varying vec3 vP;
      varying vec3 vV;

      uniform float uTime;
      uniform float uBirth;
      uniform float uTaichi;
      uniform float uGrey;
      uniform float uColorLeak;
      uniform float uCoreColor;
      uniform float uWhite;
      uniform float uEye;
      uniform float uEyeOpen;
      uniform float uCross;
      // ── 2026-05-21 段階23 (Codex Agent A): Belcour 2017 thin-film iridescence ──
      uniform float uThickness;    // nm, 380 ± 220 で呼吸
      uniform float uIOR1;         // 膜 IOR (1.30 シャボン → 1.45 油)
      uniform float uIridStrength; // 0..1 段階駆動

      // ── 6色スペクトル (RGBCMY 連続) ──
      vec3 spectrum(float t) {
        float x = fract(t) * 6.0;
        if (x < 1.0) return mix(vec3(1.0,0.0,0.0), vec3(1.0,1.0,0.0), x);
        if (x < 2.0) return mix(vec3(1.0,1.0,0.0), vec3(0.0,1.0,0.0), x - 1.0);
        if (x < 3.0) return mix(vec3(0.0,1.0,0.0), vec3(0.0,1.0,1.0), x - 2.0);
        if (x < 4.0) return mix(vec3(0.0,1.0,1.0), vec3(0.0,0.0,1.0), x - 3.0);
        if (x < 5.0) return mix(vec3(0.0,0.0,1.0), vec3(1.0,0.0,1.0), x - 4.0);
        return mix(vec3(1.0,0.0,1.0), vec3(1.0,0.0,0.0), x - 5.0);
      }

      // ── Belcour 2017 thin-film iridescence (glTF KHR_materials_iridescence 互換) ──
      // 物理ベース虹: Airy 反射率を XYZ 感度に解析積分 → linear sRGB
      // ref: Belcour & Barla SIGGRAPH 2017、Filament、glTF Sample Viewer
      #define IR_PI 3.14159265358979
      float sq_f(float x) { return x * x; }
      vec3  sq_v(vec3  x) { return x * x; }
      vec3 fresnel0ToIor(vec3 F0) {
          vec3 s = sqrt(min(F0, vec3(0.9999)));
          return (vec3(1.0) + s) / (vec3(1.0) - s);
      }
      float iorToF0(float t, float i) { return sq_f((t - i) / (t + i)); }
      vec3  iorToF0v(vec3 t, float i) { return sq_v((t - vec3(i)) / (t + vec3(i))); }
      vec3 evalSensitivity(float OPD, vec3 shift) {
          float phase = 2.0 * IR_PI * OPD * 1.0e-9;
          vec3 val = vec3(5.4856e-13, 4.4201e-13, 5.2481e-13);
          vec3 pos = vec3(1.6810e+06, 1.7953e+06, 2.2084e+06);
          vec3 vr  = vec3(4.3278e+09, 9.3046e+09, 6.6121e+09);
          vec3 xyz = val * sqrt(2.0 * IR_PI * vr)
                   * cos(pos * phase + shift) * exp(-sq_v(vec3(phase)) * vr);
          xyz.x += 9.7470e-14 * sqrt(2.0 * IR_PI * 4.5282e+09)
                 * cos(2.2399e+06 * phase + shift.x) * exp(-4.5282e+09 * sq_f(phase));
          xyz /= 1.0685e-7;
          mat3 M = mat3( 3.2404542, -0.9692660,  0.0556434,
                        -1.5371385,  1.8760108, -0.2040259,
                        -0.4985314,  0.0415560,  1.0572252);
          return M * xyz;
      }
      vec3 evalIridescence(float eta1, float eta2, float cosTheta1, float d, vec3 baseF0) {
          float sinT2Sq = sq_f(eta1 / eta2) * (1.0 - sq_f(cosTheta1));
          float cosT2Sq = 1.0 - sinT2Sq;
          if (cosT2Sq < 0.0) return vec3(1.0);
          float cosT2 = sqrt(cosT2Sq);
          float OPD = 2.0 * eta2 * d * cosT2;
          float R0  = iorToF0(eta2, eta1);
          float R12 = R0 + (1.0 - R0) * pow(1.0 - cosTheta1, 5.0);
          float T121 = 1.0 - R12;
          vec3 baseIor = fresnel0ToIor(clamp(baseF0, vec3(0.0), vec3(0.9999)));
          vec3 R23 = iorToF0v(baseIor, eta2);
          vec3 Rb  = R23 + (vec3(1.0) - R23) * pow(1.0 - cosT2, 5.0);
          float phi12 = (eta2 < eta1) ? IR_PI : 0.0;
          vec3  phi23 = vec3(
              (baseIor.x < eta2) ? IR_PI : 0.0,
              (baseIor.y < eta2) ? IR_PI : 0.0,
              (baseIor.z < eta2) ? IR_PI : 0.0
          );
          vec3 phi  = vec3(phi12) + phi23;
          vec3 R12v = vec3(R12);
          vec3 r123 = sqrt(R12v * Rb);
          vec3 Rs   = sq_v(vec3(T121)) * Rb / (vec3(1.0) - R12v * Rb);
          vec3 I = R12v + Rs;
          vec3 Cm = Rs - vec3(T121);
          for (int m = 1; m <= 2; ++m) {
              Cm *= r123;
              vec3 Sm = 2.0 * evalSensitivity(float(m) * OPD, float(m) * phi);
              I += Cm * Sm;
          }
          return max(I, vec3(0.0));
      }

      // ── value noise ──
      float hash31(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }
      float vnoise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash31(i);
        float b = hash31(i + vec3(1,0,0));
        float c = hash31(i + vec3(0,1,0));
        float d = hash31(i + vec3(1,1,0));
        float e = hash31(i + vec3(0,0,1));
        float g = hash31(i + vec3(1,0,1));
        float h = hash31(i + vec3(0,1,1));
        float j = hash31(i + vec3(1,1,1));
        return mix(
          mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
          mix(mix(e,g,f.x), mix(h,j,f.x), f.y),
          f.z
        );
      }
      float fbm3(vec3 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }
        return v;
      }

      // ── 2026-05-21 段階23 (Codex Agent B): gradient noise + analytic derivatives ──
      //   Quilez fBm derivative。法線摂動と AO に使う (SOTA 球質感の鍵)
      vec4 gnoised(vec3 x) {
        vec3 p = floor(x), w = fract(x);
        vec3 u  = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);
        vec3 du = 30.0 * w * w * (w * (w - 2.0) + 1.0);
        float a = hash31(p + vec3(0,0,0)) * 2.0 - 1.0;
        float b = hash31(p + vec3(1,0,0)) * 2.0 - 1.0;
        float c = hash31(p + vec3(0,1,0)) * 2.0 - 1.0;
        float d = hash31(p + vec3(1,1,0)) * 2.0 - 1.0;
        float e = hash31(p + vec3(0,0,1)) * 2.0 - 1.0;
        float f = hash31(p + vec3(1,0,1)) * 2.0 - 1.0;
        float g = hash31(p + vec3(0,1,1)) * 2.0 - 1.0;
        float h = hash31(p + vec3(1,1,1)) * 2.0 - 1.0;
        float k0 = a, k1 = b - a, k2 = c - a, k3 = e - a;
        float k4 = a - b - c + d, k5 = a - c - e + g, k6 = a - b - e + f;
        float k7 = -a + b + c - d + e - f - g + h;
        float val = k0 + k1*u.x + k2*u.y + k3*u.z
                  + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z;
        vec3 grad = du * vec3(
          k1 + k4*u.y + k6*u.z + k7*u.y*u.z,
          k2 + k5*u.z + k4*u.x + k7*u.z*u.x,
          k3 + k6*u.x + k5*u.y + k7*u.x*u.y);
        return vec4(val, grad);
      }
      vec4 fbmd(vec3 p) {
        vec4 acc = vec4(0.0);
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          vec4 nv = gnoised(p);
          acc.x   += a * nv.x;
          acc.yzw += a * nv.yzw;
          p   *= 2.02;
          a   *= 0.5;
        }
        return acc;
      }

      // ── Codex Agent B: bitangent noise (divergence-free, 2 fbm calls) ──
      //   curl noise の 6 倍速版。RGBCMY コアに渦流を与える
      vec3 bitNoise(vec3 p) {
        vec3 dx = fbmd(p).yzw;
        vec3 dy = fbmd(p + vec3(31.4, 52.7, 18.9)).yzw;
        return cross(dx, dy);
      }

      // ── 2026-05-21 段階22 (Codex A1): 球内部 raymarch
      //   「グレーの中に虹がある」を球内側の volumetric として literal 実装
      //   ro = ray origin (球表面)、rd = 内向き方向 (-vP)
      //   24 step、視点ごとに hue が回る (「視点で変わる」哲学)
      vec3 innerCosmos(vec3 ro, vec3 rd, float t) {
        vec3 acc   = vec3(0.0);
        float trans = 1.0;
        for (int i = 0; i < 24; i++) {
          float h = 0.035 + 0.034 * float(i);
          vec3 sp = ro + rd * h;
          if (length(sp) > 0.99) break;
          // (1) curl-advected position で fluid 流動 (Agent B)
          vec3 flow = bitNoise(sp * 1.4 + vec3(0, t * 0.06, 0)) * 0.22;
          vec3 sq   = sp + flow;
          // (2) warped fbm density + depth fog (奥が霞む)
          float d = fbmd(sq * 3.2 + vec3(t * 0.07)).x;
          float depthFog = exp(-h * 0.8);
          float density  = smoothstep(0.45, 0.85, d) * 0.16 * depthFog;
          // (3) 内部星 (voxel 単位でランダム強発光)
          float star    = pow(max(0.0, hash31(floor(sp * 45.0)) - 0.992), 2.0) * 80.0;
          vec3  starCol = spectrum(hash31(floor(sp * 45.0) + 1.0));
          // (4) 視点で hue が回る (「視点で変わる」哲学)
          float dither = hash31(sp * 71.3) * 0.005;
          vec3 spec    = spectrum(d + dot(rd, vec3(0.31, 0.27, 0.19)) + t * 0.04 + dither);
          acc   += trans * (spec * density + starCol * star * density * 0.6);
          trans *= 1.0 - density;
          if (trans < 0.02) break;
        }
        return acc;
      }

      void main() {
        vec3 n = normalize(vN);
        vec3 p = normalize(vP);

        // ─── 2026-05-21 段階23 (Codex Agent B): fBM derivative で法線摂動 ───
        //   解析勾配を使うと「光が凹凸を知る」3D 球体になる (SOTA 鍵)
        //   surfNoise.x = 値, .yzw = 勾配 (法線摂動に直接使える)
        vec4 surfNoise = fbmd(p * 4.2 + vec3(uTime * 0.03));
        vec3 nPerturb  = normalize(n - 0.32 * surfNoise.yzw);
        float fbmAO    = mix(0.80, 1.06, smoothstep(0.25, 0.85, surfNoise.x));

        // ─── 視点 / fresnel / カメラ向き光 (司さん「影いらん」、均一化) ───
        float view    = clamp(dot(n, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
        float fresnel = pow(1.0 - view, 2.1);
        // 摂動法線版の fresnel (grey 以降で凹凸を「彫る」用)
        float view2    = clamp(dot(nPerturb, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
        float fresnel2 = pow(1.0 - view2, 2.1);
        // 司さん「影いらん」反映: 完全均一に近い key (rim も中央もほぼ同じ明度)
        float key     = 0.92 + view * 0.08;

        // ─── 球面ディスク座標 (シンボルを正面に固定) ───
        // p.xy をそのまま使うとカメラ向きの「読みやすい円盤」になる
        vec2 q   = p.xy * 1.05;
        float disk    = length(q);
        float edgeFade = smoothstep(1.02, 0.82, disk);
        // 可視面マスク (背面に Taijitu を描かない、3D 感維持)
        float visibleFace = smoothstep(-0.05, 0.15, p.z);

        // ─── 衝突 (uBirth) — 左に黒 blob、右に白 blob が中央へ集まる ───
        //   司さん指示「直線に境界線がある いらない」→ 左右垂直分割を削除
        //   背景は深い暗黒 (空虚) のまま、blob だけが動く
        //   uBirth 0=完全に分離、1=中央で衝突 → 陰陽の素になる
        float collide = smoothstep(0.0, 1.0, uBirth);
        // 司さん「左側見えない」フィードバック反映:
        //   背景 Win95 teal (0, 0.5, 0.5) と dark grey 0.18 の対比が足りなかった
        //   dark を 0.32 に昇格、Classic Taijitu 50:50 の品位を維持しつつ
        //   teal 背景に対して確実に視認可能 (G/B チャンネル差を確保)
        vec3  dark    = vec3(0.32, 0.30, 0.36);
        vec3  light   = vec3(0.88, 0.90, 0.95);
        // 左から黒い blob、右から白い blob が中央へ
        vec2 lc = vec2(mix(-1.30, -0.34, collide), 0.0);
        vec2 rc = vec2(mix( 1.30,  0.34, collide), 0.0);
        float lBlob = exp(-dot((q - lc) * vec2(1.20, 0.92), (q - lc) * vec2(1.20, 0.92)) * 4.6);
        float rBlob = exp(-dot((q - rc) * vec2(1.20, 0.92), (q - rc) * vec2(1.20, 0.92)) * 4.6);
        // 背景は深い暗黒 (左右分割なし)
        vec3 birth = vec3(0.020, 0.022, 0.028);
        birth = mix(birth, dark,  lBlob * 0.92);
        birth = mix(birth, light, rBlob * 0.92);
        // 衝突点に微小な発光 (球が「生まれる」瞬間)
        float sparkBirth = exp(-dot(q, q) * 24.0) * (1.0 - collide) * 0.18;

        // ─── 3D 陰陽 (uTaichi) — Classic 太極図 (半円 2 つで太い S 字) ───
        //   司さん指示「Classic 太極図 (太い S字, 50:50)」
        //   上半球: 黒が左へ膨らむ (xBound = -sqrt(0.25 - (y-0.5)^2))
        //   下半球: 白が右へ膨らむ (xBound = +sqrt(0.25 - (y+0.5)^2))
        //   微小揺らぎ + 微小回転で「生きてる」3D 感
        float wobble = sin(uTime * 0.18) * 0.012;
        float xBound;
        if (q.y >= 0.0) {
          float r2 = max(0.0, 0.2500 - (q.y - 0.5) * (q.y - 0.5));
          xBound = -sqrt(r2);
        } else {
          float r2 = max(0.0, 0.2500 - (q.y + 0.5) * (q.y + 0.5));
          xBound =  sqrt(r2);
        }
        xBound += wobble;
        float sBoundary = q.x - xBound;
        // edge softness を可視面で柔らかく (3D 球面に馴染ませる)
        float edge = mix(0.018, 0.060, 1.0 - visibleFace);
        float side = smoothstep(-edge, edge, sBoundary);
        vec3  taichi    = mix(dark, light, side);
        // 司さん指示: 「内側の白黒点はいらない」→ 古典的な対極点は省略
        // S 字境界に薄い圧力 (sticker line ではなく球面の凹凸感)
        float seam      = 1.0 - smoothstep(0.0, 0.085, abs(sBoundary));
        // 陰陽専用の rim 虹色 (薄く)
        float hue = fract(atan(q.y, q.x) / 6.2831853 + 0.5 + p.z * 0.12 + uTime * 0.022);
        vec3  prism = spectrum(hue);
        taichi += prism * seam * 0.045;

        // ─── Birth → Taichi crossfade ───
        float taichiM = smoothstep(0.0, 1.0, uTaichi);
        vec3 symbol   = mix(birth, taichi, taichiM);
        symbol += vec3(1.0, 1.0, 1.0) * sparkBirth;

        // ─── Stage 3: 陰陽 → グレー (雲が広がる、収束型) ───
        //   司さん指示「雲が広がるように (収束型)」
        //   2 層 fbm を多重スケールで重ねて雲質感を作る
        //   wavefront は seam (境界) から距離で減衰し、雲ノイズに沿って前進
        float cloud1 = fbm3(p * 3.6 + vec3(uTime * 0.060, 0.0, 0.0));
        float cloud2 = fbm3(p * 9.0 + vec3(0.0, uTime * 0.040, 0.0));
        float cloud  = cloud1 * 0.62 + cloud2 * 0.38;
        // wavefront: uGrey が 0→1 で seam から外へ広がる
        float distFromSeam = abs(sBoundary);
        float waveFront    = uGrey * 1.45 - distFromSeam * 0.55 + (cloud - 0.5) * 0.42;
        // greySpread を強気に 1.0 へ収束 (smoothstep 上限 0.78→0.42)
        // 司さん「影ある」フィードバック反映: dark half の memory を grey 段階で完全消去
        float greySpread   = smoothstep(0.02, 0.42, waveFront);
        // のっぺりグレーを避ける微細密度 (雲の質感を残す)
        // 司さん「左側見えない」反映: teal 背景 (0, 0.5, 0.5) と差別化
        // 暖色寄りグレー (R 高め、B 低め) で teal とのコントラスト確保
        vec3  grey         = vec3(0.58, 0.52, 0.46) + vec3(0.030, 0.026, 0.034) * (cloud - 0.5);
        // 雲の途中で陰陽が「侵食され合う」: 黒側にも白の名残、白側にも黒の名残
        float crossover    = greySpread * (1.0 - greySpread) * 4.0; // bell shape 0..1
        float invadeBlack  = smoothstep(0.45, 0.95, cloud) * crossover;
        float invadeWhite  = smoothstep(0.05, 0.55, cloud) * crossover;
        vec3  mixed        = mix(symbol, grey, greySpread);
        mixed = mix(mixed, mix(light * 0.5, dark * 0.5, side), invadeBlack * 0.34);
        mixed = mix(mixed, mix(dark  * 1.5, light * 1.5, side), invadeWhite * 0.20);
        // S 字の記憶は uGrey 60% まで残す。それ以降は完全グレーに収束
        // 司さん「影いらん」フィードバック反映: 黒半球の memory を leak 段階で完全消去
        float residue = (1.0 - greySpread) * (1.0 - smoothstep(0.55, 0.78, uGrey));
        mixed = mix(mixed, symbol, residue * 0.14);
        // 司さん「影おる」フィードバック反映:
        //   leak phase 開始 (t=11s) ではもう手遅れ → uGrey 中盤 (0.5-0.75) で発動
        //   uGrey 0.5 = 約 t=9.75s で 50% force、uGrey 0.75 = 約 t=11s で 100% force
        float fullGreyForce = max(
          smoothstep(0.50, 0.75, uGrey),
          smoothstep(0.0, 0.20, uColorLeak)
        );
        mixed = mix(mixed, grey, fullGreyForce);
        vec3 col = mixed;
        // molecular alias (後続ステージで使う)
        float molecular = cloud;

        // ─── Stage 4 前段 (Codex A1): 球内部の小宇宙 (raymarch) ───
        //   グレー段階から薄く発火、coreColor で奥行きが最大に
        //   司さん指示「両立 (raymarch 深掘り + インタラクティブ)」の前者
        float innerStrength = uGrey * 0.18 + uColorLeak * 0.55 + uCoreColor * 0.85;
        if (innerStrength > 0.001) {
          vec3 ro = normalize(vP) * 0.985; // 球表面わずか内側を起点
          vec3 rd = -normalize(vP);        // 球中心へ向かう
          vec3 inner = innerCosmos(ro, rd, uTime);
          // mix-additive ハイブリッド (mix() で base に inner 光を混ぜる)
          col = mix(col, col + inner * 0.95, innerStrength);
        }

        // ─── Stage 4: グレー内部から虹が滲み出る (uColorLeak) ───
        //   seam (境界) と internalSpark (分子) と rim (外周) の 3 起点
        float internalSpark = smoothstep(0.62, 0.96, molecular + uColorLeak * 0.28);
        float leakMask      = (seam * 0.68 + internalSpark * 0.26 + fresnel * 0.22) * uColorLeak;
        vec3  leakColor     = spectrum(uTime * 0.05 + p.y * 0.22 + atan(p.z, p.x) / 6.2831853);
        // mix ベース (additive 禁止)、彩度 60% で馴染ませる
        col = mix(col, mix(col, leakColor, 0.60), leakMask);

        // ─── Stage 5: RGBCMY コア (uCoreColor) — P3 init3DLogoSphere 完全準拠 ───
        //   司さん指示「P3 ロゴ コアと同じ (流動 + Newton 干渉)」
        //   構造: 12 方向 metaball で流動 + 2 層 spectrum + Newton リング干渉
        //   全て mix() ベースで馴染ませる、追加加算なし
        // 2026-05-21 段階23 (Codex Agent B): bitangent curl noise で fluid 流動
        //   旧 value-noise 3 軸独立 → curl (divergence-free) で「渦」が作れる
        //   RGBCMY コアが drift から「生きた流動体」へ昇格
        vec3 nOff = bitNoise(p * 1.8 + vec3(0.0, uTime * 0.08, 0.0)) * 0.28;
        vec3 wPos = normalize(p + nOff);
        vec3 dirs[12];
        dirs[0]  = vec3( 1.0, 0.0, 0.0); dirs[1]  = vec3(-1.0, 0.0, 0.0);
        dirs[2]  = vec3( 0.0, 1.0, 0.0); dirs[3]  = vec3( 0.0,-1.0, 0.0);
        dirs[4]  = vec3( 0.0, 0.0, 1.0); dirs[5]  = vec3( 0.0, 0.0,-1.0);
        dirs[6]  = normalize(vec3( 1.0, 1.0, 0.0));
        dirs[7]  = normalize(vec3(-1.0,-1.0, 0.0));
        dirs[8]  = normalize(vec3( 0.0, 1.0, 1.0));
        dirs[9]  = normalize(vec3( 0.0,-1.0,-1.0));
        dirs[10] = normalize(vec3( 1.0, 0.0, 1.0));
        dirs[11] = normalize(vec3(-1.0, 0.0,-1.0));
        vec3 cols[12];
        cols[0]  = vec3(1.0, 0.0, 0.0); cols[1]  = vec3(0.0, 1.0, 1.0); // R / C
        cols[2]  = vec3(0.0, 1.0, 0.0); cols[3]  = vec3(1.0, 0.0, 1.0); // G / M
        cols[4]  = vec3(0.0, 0.0, 1.0); cols[5]  = vec3(1.0, 1.0, 0.0); // B / Y
        cols[6]  = vec3(1.0, 0.55, 0.0); cols[7] = vec3(0.0, 0.55, 1.0);
        cols[8]  = vec3(0.0, 1.0, 0.6);  cols[9] = vec3(1.0, 0.30, 0.55);
        cols[10] = vec3(0.78, 0.30, 1.0);cols[11]= vec3(0.85, 0.85, 0.20);
        float field = 0.0;
        vec3  rgbcmy = vec3(0.0);
        for (int i = 0; i < 12; i++) {
          float w = max(0.0, dot(wPos, dirs[i]));
          w = w * w * w;
          rgbcmy += cols[i] * w;
          field  += w;
        }
        rgbcmy /= max(field, 0.001);

        // ── 球面 Newton リング 2 層干渉 (P3 init3DLogoSphere 完全準拠) ──
        float theta  = acos(clamp(n.y, -1.0, 1.0));
        float phi    = atan(n.z, n.x);
        float ringFreq = 8.0;
        float ring1 = sin(theta * ringFreq + uTime * 0.30) * 0.5 + 0.5;
        ring1      *= sin(phi * 6.0 - uTime * 0.50) * 0.30 + 0.70;
        // 2 層目 (補色シフト + 異なる周期)
        float specT  = theta * 0.50 + phi * 0.15 + uTime * 0.08;
        float specT2 = theta * 0.30 - phi * 0.20 + uTime * 0.12 + 0.50;
        vec3  rainbow  = spectrum(specT);
        vec3  rainbow2 = spectrum(specT2);
        vec3  iridescent = mix(rainbow, rainbow2, ring1 * 0.40);
        // メタボール (流動) と Newton 干渉 (虹) を mix で融合
        vec3  coreCol  = mix(rgbcmy, iridescent, 0.55);
        // P3 流 グレーベース + fresnel 駆動の iridescence
        vec3  coreFinal = mix(vec3(0.45), coreCol, fresnel * 0.85 + 0.15);
        // 内部発光 (P3 init3DLogoSphere 準拠の core glow)
        float coreInner = pow(view, 4.0);
        coreFinal = mix(coreFinal, mix(coreFinal, vec3(0.95), 0.5), coreInner * 0.30);

        // pores で発光を粒状化、coreMask で時間進行
        float pores  = smoothstep(0.26, 0.90, vnoise(p * 5.2 + uTime * 0.10) + uCoreColor * 0.26);
        float coreMask = smoothstep(0.02, 1.0, uCoreColor) * (0.18 + 0.82 * pores);
        col = mix(col, coreFinal, coreMask);
        // edge glow (rim に Newton 干渉を強く)
        float edgeGlow = pow(fresnel, 4.0);
        col = mix(col, mix(col, iridescent, 0.7), edgeGlow * uCoreColor * 0.62);

        // ─── 2026-05-21 段階23 (Codex Agent A): Belcour 物理 thin-film 虹 ───
        //   現状色 (col) を基板 F0 として、視角依存の真の干渉色を計算
        //   rim mask × uIridStrength で「斜入射でのみ虹が見える」物理現象
        if (uIridStrength > 0.001) {
          float cosT1 = clamp(view, 0.001, 0.999);
          vec3  baseF0 = mix(vec3(0.04), col, 0.45);
          vec3  irid   = evalIridescence(1.0, uIOR1, cosT1, uThickness, baseF0);
          float iridMask = pow(1.0 - cosT1, 1.6);
          col = mix(col, irid, uIridStrength * iridMask * 0.85);
        }

        // ─── 3D ライティング (司さん「影いらない」反映、lowerShadow 廃止) ───
        //   key light + 微 rim のみ。下半球の暗さは除去
        col *= key;
        col += vec3(0.025, 0.028, 0.033) * fresnel;

        // ─── 司さん「左側見えない」反映: 球体境界を常時可視化 ───
        //   teal 背景 (0,0.5,0.5) と grey 球 (0.5,0.5,0.5) が溶ける問題を防ぐため、
        //   rim ぎりぎりに薄い暗色アウトラインを描く (球が背景に対して常に独立して見える)
        float outlineRim = smoothstep(0.62, 0.96, fresnel);
        col = mix(col, vec3(0.08, 0.06, 0.10), outlineRim * 0.55 * (1.0 - uWhite * 0.7));
        col += prism * pow(fresnel, 1.25) * (0.08 + uCoreColor * 0.14);

        // ─── ガラス肌 (subtle skin) ───
        float skin = pow(fresnel, 4.6) * 0.30;
        col += vec3(0.80, 0.86, 1.0) * skin * (1.0 - uWhite * 0.5);

        // ─── 2026-05-21 段階23 (Codex Agent B): SSS (裏側から透ける虹) + AO ───
        //   球が「半透明の宇宙」に見える奥行き layer
        vec3  lDir = normalize(vec3(0.4, 0.3, 0.8));
        vec3  lt   = -lDir + nPerturb * 0.4;
        float sssI = pow(clamp(dot(vec3(0.0, 0.0, 1.0), -lt), 0.0, 1.0), 3.0)
                   * exp(-(1.0 - fresnel2) * 2.5);
        vec3  sssC = spectrum(uTime * 0.03 + p.x * 0.4) * sssI;
        col += sssC * 0.18 * (uColorLeak + uCoreColor * 0.7);
        // fbmAO で凹凸を「彫る」(grey 以降のみ)
        col *= mix(1.0, fbmAO, smoothstep(0.0, 0.5, uGrey + uColorLeak));

        // ─── Stage 6: 白光球 (uWhite) — 球が光源になる ───
        //   surface detail をフェード、中心 → 白、rim に薄く虹を残す
        if (uWhite > 0.001) {
          // 表面パターンを白へ寄せる (彩度を落とす)
          vec3 fadedSurface = mix(col, vec3(0.5), uWhite * 0.78);
          vec3 lightCol     = mix(fadedSurface, vec3(1.0), uWhite * 0.60);
          // 中心からの強い発光 (球 = 光源)
          float coreGlow    = (1.0 - smoothstep(0.0, 0.7, length(vP))) * uWhite;
          lightCol = mix(lightCol, vec3(1.0), coreGlow * 0.65);
          // rim ハロー
          float rimHalo = pow(fresnel, 1.6) * uWhite;
          lightCol = mix(lightCol, vec3(1.0), rimHalo * 0.78);
          // 白の中にも虹は残る (rim にだけうっすら)
          vec3 rimRainbow = mix(vec3(1.0), spectrum(uTime * 0.04 + phi * 0.10), 0.55);
          lightCol = mix(lightCol, rimRainbow, pow(fresnel, 3.0) * uWhite * 0.16);
          col = lightCol;
        }

        // ─── Stage 7/8: 瞳 (uEye, uEyeOpen) ───
        //   閉じた瞳は線、開眼で sclera + iris + Newton 干渉 + pupil + catchLight
        //   crossPhase が立ち始めたら fade
        float crossP = clamp(uCross, 0.0, 1.0);
        float eyeFade= 1.0 - smoothstep(0.05, 0.45, crossP);
        float eyeP   = clamp(uEye, 0.0, 1.0) * eyeFade;
        float eyeO   = clamp(uEyeOpen, 0.0, 1.0);
        if (eyeP > 0.001) {
          vec2 e = q;
          e.y *= 1.14;
          float openEase  = smoothstep(0.08, 1.0, eyeO);
          float lidCurve  = e.y + 0.058 * sin(e.x * 3.14159265);
          float aperture  = mix(0.020, 0.46, openEase);
          float closedLine= exp(-lidCurve * lidCurve * 1180.0) * (1.0 - openEase);
          float mask      = 1.0 - smoothstep(aperture, aperture + 0.064, abs(lidCurve));
          float er        = length(e * vec2(1.0, 0.88));
          float sclera    = (1.0 - smoothstep(0.55, 0.74, er)) * mask;
          float iris      = (1.0 - smoothstep(0.31, 0.48, er)) * smoothstep(0.075, 0.16, er) * mask;
          float pupil     = (1.0 - smoothstep(0.10, 0.18, er)) * mask;
          float catchLight= 1.0 - smoothstep(0.038, 0.080, length(e - vec2(-0.13, 0.14)));
          // iris の hue は subtle drift (cyan ↔ blue、Stage 設計書準拠)
          float irisHueT  = 0.52 + 0.10 * sin(uTime * 0.5);
          vec3  irisCol   = mix(vec3(0.00, 0.16, 0.36), vec3(0.0, 0.85, 1.0), irisHueT);
          // iris 内に Newton リング干渉 (薄く)
          float irisRing  = sin(er * 90.0 - uTime * 1.35) * 0.5 + 0.5;
          vec3  irisInt   = mix(irisCol, spectrum(er * 1.5 + uTime * 0.08), 0.5);
          float openA     = eyeP * openEase;
          col = mix(col, vec3(0.0),  closedLine * eyeP);
          col = mix(col, vec3(0.96), sclera     * openA * 0.42);
          col = mix(col, irisCol,    iris       * openA);
          col = mix(col, irisInt,    iris       * openA * irisRing * 0.18);
          col = mix(col, vec3(0.0),  pupil      * openA);
          col = mix(col, vec3(1.0),  catchLight * openA * 0.78);
        }

        // ─── Alpha ───
        float alphaCore = clamp(uTaichi + uGrey + uCoreColor + uWhite, 0.0, 1.0);
        float baseAlpha = mix(uBirth * 0.55, 0.96, alphaCore);
        float a = baseAlpha * (0.92 + fresnel * 0.30);
        a = mix(a, 0.78 + fresnel * 0.55, uWhite);
        a *= edgeFade;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.0, 192, 128), sphereMat);
  root3D.add(sphere);

  // ─────────── Aura Shader (外側微発光) ───────────
  const auraMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vN; varying vec3 vP;
      uniform float uTime, uTaichi, uCoreColor, uWhite, uCross;
      vec3 spectrum(float t) {
        float x = fract(t) * 6.0;
        if (x < 1.0) return mix(vec3(1.0,0.0,0.0), vec3(1.0,1.0,0.0), x);
        if (x < 2.0) return mix(vec3(1.0,1.0,0.0), vec3(0.0,1.0,0.0), x - 1.0);
        if (x < 3.0) return mix(vec3(0.0,1.0,0.0), vec3(0.0,1.0,1.0), x - 2.0);
        if (x < 4.0) return mix(vec3(0.0,1.0,1.0), vec3(0.0,0.0,1.0), x - 3.0);
        if (x < 5.0) return mix(vec3(0.0,0.0,1.0), vec3(1.0,0.0,1.0), x - 4.0);
        return mix(vec3(1.0,0.0,1.0), vec3(1.0,0.0,0.0), x - 5.0);
      }
      void main() {
        float view = clamp(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
        float rim  = pow(1.0 - view, 2.4);
        float hue  = fract(atan(vP.y, vP.x) / 6.2831853 + 0.5 + uTime * 0.026);
        vec3  col  = spectrum(hue);
        float amp  = uTaichi * 0.10 + uCoreColor * 0.45 + uWhite * 0.30;
        gl_FragColor = vec4(col, rim * amp);
      }
    `,
  });
  const aura = new THREE.Mesh(new THREE.SphereGeometry(1.18, 128, 96), auraMat);
  root3D.add(aura);

  // ─────────── Solar Shader (外側コロナ + 太陽十字) ───────────
  //   フルスクリーン plane、加算合成
  const solarMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:    uniforms.uTime,
      uWhite:   uniforms.uWhite,
      uEyeOpen: uniforms.uEyeOpen,
      uCross:   uniforms.uCross,
      uAspect:  { value: window.innerWidth / window.innerHeight },
    },
    transparent: true,
    depthWrite: false,
    depthTest:  false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uWhite, uEyeOpen, uCross, uAspect;
      vec3 spectrum(float t) {
        float x = fract(t) * 6.0;
        if (x < 1.0) return mix(vec3(1.0,0.0,0.0), vec3(1.0,1.0,0.0), x);
        if (x < 2.0) return mix(vec3(1.0,1.0,0.0), vec3(0.0,1.0,0.0), x - 1.0);
        if (x < 3.0) return mix(vec3(0.0,1.0,0.0), vec3(0.0,1.0,1.0), x - 2.0);
        if (x < 4.0) return mix(vec3(0.0,1.0,1.0), vec3(0.0,0.0,1.0), x - 3.0);
        if (x < 5.0) return mix(vec3(0.0,0.0,1.0), vec3(1.0,0.0,1.0), x - 4.0);
        return mix(vec3(1.0,0.0,1.0), vec3(1.0,0.0,0.0), x - 5.0);
      }
      void main() {
        // 中心 (0,0) のスクエア座標 (aspect 補正)
        vec2 p = (vUv * 2.0 - 1.0);
        p.x *= uAspect;

        float r = length(p);

        // ── コロナ (球が光源) ──
        float corona  = exp(-r * 2.20) * uWhite * 0.85;
        float aureole = exp(-abs(r - 0.38) * 5.5) * uWhite * 0.22;
        // コロナの中に薄い虹色 (rim 干渉)
        vec3 coronaTint = mix(vec3(1.0), spectrum(atan(p.y, p.x) / 6.2831853 + uTime * 0.05), 0.18);

        // ── 太陽十字 (uCross) ──
        //   縦軸 = 白 (RGB / 精神) を太くて明るく
        //   横軸 = 黒 (CMY / 物質) は「光の不在」として subtract
        float crossWidth = 0.0035;
        // sharp ビーム + 広い halo
        float vBeam  = exp(-p.x * p.x / (crossWidth + 0.00010)) * smoothstep(0.0, 1.5, 1.5 - abs(p.y));
        float hBeam  = exp(-p.y * p.y / (crossWidth + 0.00010)) * smoothstep(0.0, 1.5, 1.5 - abs(p.x));
        float vHalo  = exp(-p.x * p.x * 22.0)                 * smoothstep(0.0, 1.5, 1.5 - abs(p.y));
        float hHalo  = exp(-p.y * p.y * 22.0)                 * smoothstep(0.0, 1.5, 1.5 - abs(p.x));
        float axisCore = exp(-r * r * 6.0);
        // 太陽光の脈動
        float pulse  = 0.60 + 0.40 * sin(uTime * 1.4);

        vec3 col = vec3(0.0);
        // コロナ
        col += coronaTint * (corona + aureole);
        // 開眼瞬間 solar flash (短パルス)
        float openFlash = exp(-r * 3.2) * smoothstep(0.05, 0.20, uEyeOpen)
                        * (1.0 - smoothstep(0.40, 0.95, uEyeOpen)) * 0.62;
        col += vec3(1.0) * openFlash;

        // 太陽十字
        float cP = smoothstep(0.0, 1.0, uCross);
        col += vec3(1.0) * (vBeam * 0.95 + vHalo * 0.30) * cP * (0.85 + pulse * 0.25);
        // 横軸はあえて加算しない代わりに、画面全体を暗くする (CMY = 黒の表現)
        // ただし AdditiveBlending なので「sub」できない → 横軸は薄い影として hBeam を暗色で乗せる
        col -= vec3(0.55, 0.50, 0.55) * (hBeam * 0.55 + hHalo * 0.20) * cP;
        col = max(col, vec3(0.0));
        // 中央 axisCore (十字が交わる白光の心臓部)
        col += vec3(1.0) * axisCore * cP * 1.20;
        // 縦軸に薄い RGBCMY 粒子流 (Stage 11 設計)
        float vParticle = exp(-p.x * p.x * 320.0)
                       * smoothstep(0.0, 1.0, sin(p.y * 14.0 - uTime * 2.8) * 0.5 + 0.5);
        col = mix(col, mix(vec3(1.0), spectrum(uTime * 0.13 + p.y * 0.9), 0.55),
                  vParticle * cP * 0.30 * smoothstep(0.0, 1.0, 1.0 - abs(p.y)));

        float alpha = clamp(corona + aureole + openFlash + (vBeam + hBeam) * cP * 0.45 + axisCore * cP, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const solar = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), solarMat);
  solar.renderOrder = 10;
  // solar は ortho 風に画面全体覆い、camera matrix 無視 (vertex で直接 NDC)
  scene.add(solar);

  // ─────────── Timeline ───────────
  // 設計書: 「同じ球体が変容する」ことが伝わるテンポを優先。
  // 司さん指示「最初は陰陽 (グレーから始めない)」→ Birth → Taichi を即時に。
  // 2026-05-21 更新: 司さん指示「スロー (4-6秒)」反映、全体延長 26→32 秒
  const T = {
    birth0:   0.0,   // 衝突開始
    birth1:   3.5,   // 衝突完了 = 陰陽が凝結
    taichi0:  2.5,   // 陰陽が読める状態 (Birth とオーバーラップ)
    taichi1:  6.0,
    grey0:    7.0,   // 陰陽はっきり 1秒キープ → 雲拡散でグレー化開始
    grey1:   12.5,   // 5.5秒かけてグレー化
    leak0:   11.0,   // グレー化終盤から虹滲み (オーバーラップで連続感)
    leak1:   15.5,
    core0:   14.5,   // RGBCMY 開花
    core1:   20.0,   // 5.5秒かけて完成
    white0:  20.5,   // 白光球
    white1:  23.5,
    eye0:    23.5,   // 閉じた瞳
    eye1:    25.5,
    open0:   25.5,   // 開眼
    open1:   26.8,
    cross0:  26.8,   // 太陽十字
    cross1:  30.0,
    end:     32.0,
  };

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function smoothstep01(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function range(t, a, b) { return clamp01((t - a) / Math.max(0.001, b - a)); }

  function stageName(t) {
    if (t < T.birth1)  return '衝突 → 陰陽誕生';
    if (t < T.taichi1) return '3D 陰陽';
    if (t < T.grey1)   return 'S字境界から溶解 → グレー';
    if (t < T.leak1)   return 'グレー内部から虹漏出';
    if (t < T.core1)   return 'RGBCMY 開花';
    if (t < T.white1)  return '球が光源化 (コロナ展開)';
    if (t < T.eye1)    return '白光の奥に閉じた瞳';
    if (t < T.open1)   return '開眼 + solar flash';
    if (t < T.cross1)  return '太陽十字';
    return '終わらない';
  }

  function update(t) {
    const u = uniforms;
    u.uTime.value      = t;
    u.uBirth.value     = smoothstep01(range(t, T.birth0,  T.birth1));
    u.uTaichi.value    = smoothstep01(range(t, T.taichi0, T.taichi1));
    u.uGrey.value      = smoothstep01(range(t, T.grey0,   T.grey1));
    u.uColorLeak.value = smoothstep01(range(t, T.leak0,   T.leak1));
    u.uCoreColor.value = smoothstep01(range(t, T.core0,   T.core1));
    u.uWhite.value     = smoothstep01(range(t, T.white0,  T.white1));
    u.uEye.value       = smoothstep01(range(t, T.eye0,    T.eye1));
    u.uEyeOpen.value   = smoothstep01(range(t, T.open0,   T.open1));
    u.uCross.value     = smoothstep01(range(t, T.cross0,  T.cross1));

    // 2026-05-21 段階23 (Codex Agent A): Belcour thin-film 駆動
    //   膜厚は呼吸 (可視光 160-600nm)、強度は leak/core で発火、white/cross で消える
    u.uThickness.value    = 380.0 + 220.0 * Math.sin(t * 0.45);
    u.uIOR1.value         = 1.30 + 0.15 * u.uCoreColor.value;
    u.uIridStrength.value = clamp01(
      u.uColorLeak.value * 0.55 +
      u.uCoreColor.value * 1.00 -
      u.uWhite.value     * 0.35 -
      u.uCross.value     * 0.80
    );

    // 司さん指示「目になったら球体回らない」→ 増分式で回転、uEye が立ったら停止
    //   累積方式: dt × speed × (1 - uEye) を加算 → uEye=1 で完全停止 (snap back 回避)
    const dt = Math.max(0, t - rotState.prevT);
    rotState.prevT = t;
    const eyeFreeze = 1.0 - u.uEye.value;
    rotState.sphereY += dt * 0.055 * eyeFreeze;
    sphere.rotation.y = rotState.sphereY;
    // root の微振動は eyeFreeze で減衰 (sin-based なので snap しない)
    root3D.rotation.y = Math.sin(t * 0.12) * 0.18  * eyeFreeze;
    root3D.rotation.x = Math.sin(t * 0.09) * 0.045 * eyeFreeze;
    sphere.rotation.z = Math.sin(t * 0.14) * 0.030 * eyeFreeze;
    // aura は subtle に回し続ける (球自体は停止しても aura は呼吸)
    aura.rotation.y = -t * 0.040 * Math.max(0.15, eyeFreeze);

    // 球のスケール: 白光化で少し膨張 + breathing (目が完全に開いたら呼吸も止める)
    const breath = Math.sin(t * 1.8) * 0.012 * Math.max(0.0, 1.0 - u.uEyeOpen.value);
    const scale = 1.0 + breath + u.uWhite.value * 0.06;
    sphere.scale.setScalar(scale);
    aura.scale.setScalar(scale * 1.0);

    hud.textContent = `P1 ${t.toFixed(2)}s | ${stageName(t)}`;
  }

  // ─────────── Resize ───────────
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, true);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    solarMat.uniforms.uAspect.value = w / h;
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // ─────────── Loop / Controls ───────────
  // 増分式回転 state (司さん指示「目で回らない」、snap back 回避)
  const rotState = { prevT: 0, sphereY: 0 };
  let paused = false;
  let frozenT = 0;
  let start = performance.now();
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'PLAY' : 'PAUSE';
    if (!paused) start = performance.now() - frozenT * 1000;
  });
  // JUMP → 次の Stage 境界へ
  jumpBtn.addEventListener('click', () => {
    const stages = [T.birth1, T.taichi1, T.grey1, T.leak1, T.core1, T.white1, T.eye1, T.open1, T.cross1, T.end];
    for (let i = 0; i < stages.length; i++) {
      if (frozenT < stages[i] - 0.01) {
        frozenT = stages[i] + 0.01;
        start = performance.now() - frozenT * 1000;
        return;
      }
    }
    // loop back
    frozenT = 0;
    start = performance.now();
  });

  function frame() {
    requestAnimationFrame(frame);
    if (!paused) frozenT = (performance.now() - start) / 1000;
    update(frozenT);
    renderer.render(scene, camera);
  }
  frame();

  // ─────────── Debug expose ───────────
  try {
    window.__p1zv2 = { sphere, aura, solar, uniforms, T };
    console.log('[p1_zero_v2] init OK');
  } catch (e) {}
})();
