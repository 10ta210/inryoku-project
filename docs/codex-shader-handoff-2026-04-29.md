# Codex 申送り — inryokü P3 シェーダー / Postprocessing 改修ハンドオフ

**作成日:** 2026-04-29
**作成者:** Claude (Opus 4.7 1M context) — 設計・申送り担当
**実装担当:** Codex
**対象ファイル（hot）:** `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js`
**対象ファイル（補助）:** `/Users/10ta210/Desktop/inryoku_hp/index.html`, `/Users/10ta210/Desktop/inryoku_hp/p3_test.html`, `/Users/10ta210/Desktop/inryoku_hp/vendor/`
**触らない:** `particle_rings.js`, `particle_rings.css`, `particle_speech_rings.js`, `particle_canon_meta.js`（既に Codex 領域だが、本ハンドオフのスコープ外）
**Three.js バージョン:** 0.160（`vendor/three.min.js`、UMD 単体配布）
**根拠ドキュメント:**
- `docs/particle-cheap-diagnosis-2026-04-29.md`（主犯 3 つ、原因 10 個、CSS 5 案）
- `docs/light-emission-research-2026-04-29.md`（物理・技法カタログ）
- `docs/p3-performance-audit-2026-04-28.md`（既存パフォーマンス監査）

---

## 0. 読む前に — このドキュメントの位置づけ

このハンドオフは **Codex がそのまま実装着手できるレベル** を目指している。背景・哲学・パラメータ根拠・端末別リスク・検証手順まで全て含む。長い。が読んで欲しい。

司さんからの一貫した指示:
- **grey 美学** を壊さない（派手にしない）
- **CMYRGB 6 純色** を維持（白/橙/灰の粒子は出さない）
- **観測者によって光が見える**（50→101 哲学）

Codex が実装で迷ったときの判断基準は「**派手さではなく滲み**」「**色は維持、明部のレンジを広げる**」。

---

## 1. エクゼクティブサマリ — 5 タスクの優先度

### 1.1 結論先出し

> 「光が安っぽい」最大原因は **Bloom が production で動いていない** こと。粒子側のフラグメントは bloom 前提の過設計のまま、bloom 不在で出力されているため「光の絵」になり「光」にならない。Codex が今やるべきは **(A) postprocessing パイプを復活させ、(B) フラグメントを簡素化して bloom に仕事を譲り、(C) HDR/Tonemap で物理的に正しい合成路にする**。これだけで体感は「写真」に近づく。

### 1.2 5 タスク優先度マトリクス

| # | タスク | インパクト | 工数 | 依存 | 優先 |
|---|--------|-----------|------|------|------|
| 1 | UnrealBloomPass 復活（ESM jsm 自前 vendor 化 + composer6 配線） | ★★★★★ | 1.0 日 | なし | **P0 / 第一段階** |
| 2 | Fragment シェーダー簡素化（5 層 → 2 層、prism/codeBand 撤去） | ★★★★ | 0.5 日 | #1 完了 | **P0 / 第二段階** |
| 3 | HDR + ACES Tonemap + outputColorSpace + clearColor 純黒回避 | ★★★★ | 0.1 日 | #1 と同時 | **P0 / 第一段階に同梱** |
| 4 | パーティクルサイズ自然分布（log-normal + 距離減衰） | ★★★ | 0.3 日 | なし（独立） | **P1** |
| 5 | 観測者依存の発光（mouse/視野中心 → bloom 動的） | ★★★ | 0.5 日 | #1 完了 | **P1（哲学整合）** |

合計工数見積: **2.4 人日**（テスト・実機検証込みで 3.0 人日想定）

### 1.3 実装順序の推奨

```
[Day 1 午前] Task 3（renderer 設定）+ Task 1 前半（vendor 配置）
[Day 1 午後] Task 1 後半（importmap・composer 配線・動作確認）
[Day 2 午前] Task 2（fragment 簡素化）
[Day 2 午後] Task 4（粒子分布）
[Day 3 午前] Task 5（観測者発光）
[Day 3 午後] 実機検証（M1 / iPhone 13 / Pixel 6 / 旧端末）
```

依存関係:
- Task 3 は Task 1 と一緒にやる（renderer 設定変更は composer 設定と同タイミングが安全）
- Task 2 は Task 1 が動いて初めて意味を持つ（bloom があるから簡素化できる）
- Task 4 は完全独立、Task 1 と並行可能
- Task 5 は Task 1 の uniform 増設の延長線で、bloom strength を動的に動かす

---

## 2. タスク 1 — UnrealBloomPass 復活

### 2.1 問題の再確認

`index.html:1384-1386`:
```html
<!-- 2026-04-28 D-01: Three.js UMD (global THREE) for p5p6.js Phase 5 WebGL — ローカル配信化。
     0.160 では examples/js/postprocessing 系は廃止 (p3_test.html 同様、404 + 5s 遅延を回避) -->
<script src="vendor/three.min.js"></script>
```

`p3_code_for_claude.js:3279-3285`:
```js
// ── Bloom ──
let composer6 = null;
if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
    composer6 = new THREE.EffectComposer(renderer6);
    composer6.addPass(new THREE.RenderPass(scene6, camera6));
    composer6.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 1.6, 0.5, 0.15));
}
```

`p3_code_for_claude.js:3997`:
```js
if (composer6) composer6.render(); else renderer6.render(scene6, camera6);
```

事実関係:
- Three.js r160 では `examples/js/`（UMD グローバル付与スクリプト）は廃止。`examples/jsm/`（ESM モジュール）のみ供給。
- 現在 `vendor/three.min.js` は r160 の UMD ビルド。`THREE.EffectComposer` 等は **undefined**。
- ゆえに `composer6 === null` 固定 → `renderer6.render()` 直行 → bloom 0。

### 2.2 解決の方針 — 「ハイブリッド ESM」アプローチ

**選択肢検討:**

| 案 | 説明 | 採否 |
|----|------|------|
| A. UMD バンドル自作 | rollup/webpack で postprocessing 5 ファイルを 1 つの IIFE に固めて `THREE.*` にぶら下げる | × ビルドパイプライン増、CSP/監査負担増 |
| B. ESM 個別 import（jsm そのまま） | `vendor/three/examples/jsm/postprocessing/*.js` を配置、importmap で `three/addons/...` 解決 | ◎ 採用（公式形式・CSP 維持・将来性） |
| C. CDN 直 import | `https://unpkg.com/three@0.160.0/examples/jsm/...` を直接 | × CSP self-host 方針違反 |

**採用: 案 B（ESM 個別 import）**

### 2.3 必要ファイル一覧

`https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/` および `https://unpkg.com/three@0.160.0/examples/jsm/shaders/` から以下を取得し、`vendor/three/examples/jsm/` 配下に **同一ディレクトリ構造で** 配置する。

```
vendor/
├── three.min.js                          ← 既存（UMD、削除しない）
└── three/
    ├── build/
    │   └── three.module.js               ← 新規（ESM 本体、importmap 解決用）
    └── examples/
        └── jsm/
            ├── postprocessing/
            │   ├── EffectComposer.js
            │   ├── Pass.js               ← EffectComposer が依存
            │   ├── RenderPass.js
            │   ├── ShaderPass.js
            │   ├── MaskPass.js           ← EffectComposer が依存
            │   └── UnrealBloomPass.js
            └── shaders/
                ├── CopyShader.js
                ├── LuminosityHighPassShader.js
                └── ConvolutionShader.js  ← UnrealBloomPass が依存
```

> **依存関係の注意:** `UnrealBloomPass.js` は内部で `LuminosityHighPassShader`, `CopyShader`, `ConvolutionShader` を import している。`EffectComposer.js` は `Pass.js`, `MaskPass.js`, `ShaderPass.js`, `CopyShader.js` を import している。**1 つでも欠けると ESM ロード失敗で全消えする** のでチェックリスト形式で必ず全 9 ファイル + ESM 本体 = 10 ファイル落とすこと。

> **取得コマンド例（zsh）:**
> ```sh
> cd /Users/10ta210/Desktop/inryoku_hp/vendor
> mkdir -p three/build three/examples/jsm/postprocessing three/examples/jsm/shaders
> BASE=https://unpkg.com/three@0.160.0
> curl -fsSL $BASE/build/three.module.js -o three/build/three.module.js
> for f in EffectComposer Pass RenderPass ShaderPass MaskPass UnrealBloomPass; do
>   curl -fsSL $BASE/examples/jsm/postprocessing/$f.js -o three/examples/jsm/postprocessing/$f.js
> done
> for f in CopyShader LuminosityHighPassShader ConvolutionShader; do
>   curl -fsSL $BASE/examples/jsm/shaders/$f.js -o three/examples/jsm/shaders/$f.js
> done
> ```
> 取得後 `wc -l vendor/three/**/*.js` で空ファイルが無いことを確認。

### 2.4 importmap 改修

**`index.html:1356-1362` 現状:**
```html
<script type="importmap">
{
  "imports": {
    "three": "/vendor/three.min.js"
  }
}
</script>
```

**改修後:**
```html
<script type="importmap">
{
  "imports": {
    "three": "/vendor/three/build/three.module.js",
    "three/addons/": "/vendor/three/examples/jsm/"
  }
}
</script>
```

ポイント:
- `"three"` を `three.min.js`（UMD）→ `three.module.js`（ESM 本体）に切替。**UMD 副作用が消えるので、`window.THREE` を使っている既存箇所が壊れる可能性がある**。
- そのため、UMD は **互換のため `<script src="vendor/three.min.js">` を残す**。importmap の `three` は jsm からの import 解決用に別系統で動く（同じ URL を二重ロードしないよう配慮 — UMD 側はグローバル `THREE` を提供、ESM 側は `import` 解決のみで重複コストは初回ロード分だけ）。
- `three/addons/` は Three.js 公式 docs の慣用キー。`UnrealBloomPass.js` 内部の `import { ... } from 'three'` と `import { ... } from 'three/addons/...'` の両方を解決できる。

`p3_test.html` も同じ importmap に揃える（同 42 行・440 行付近）。

### 2.5 p3_code_for_claude.js の改修

**現状（再掲）`:3279-3285`:**
```js
let composer6 = null;
if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
    composer6 = new THREE.EffectComposer(renderer6);
    composer6.addPass(new THREE.RenderPass(scene6, camera6));
    composer6.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 1.6, 0.5, 0.15));
}
```

**問題:** このファイルは現状 `<script>` で読まれている（`type="module"` ではない）。`import` 文は使えない。

**選択肢:**
- (a) ファイル全体を `<script type="module">` に切替 → 規模が大きく副作用未知
- (b) **動的 import**（`import()` 関数）で必要箇所だけ ESM 取得 → スコープ最小、推奨

**採用: (b) 動的 import**

**改修コード（疑似コード、Codex はこれをベースに調整）:**
```js
// ── Bloom（動的 import で ESM postprocessing を取得） ──
let composer6 = null;
let bloomPass = null;     // Task 5 で動的に strength を変えるため module-scope に保持

(async () => {
  try {
    const [
      { EffectComposer },
      { RenderPass },
      { UnrealBloomPass }
    ] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js')
    ]);

    composer6 = new EffectComposer(renderer6);
    composer6.addPass(new RenderPass(scene6, camera6));

    // ── パラメータ（grey 美学整合、控えめ） ──
    // strength: 0.8 — 過剰滲みを避けつつ写真的滲みを得る
    // radius:   0.6 — 中広域、近接ハイライトと拡散ハロの中間
    // threshold:0.6 — 高輝度のみ bloom 対象。暗ノイズ粒子を除外し白コアと飽和粒子だけ滲む
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(W, H),
      0.8,   // strength
      0.6,   // radius
      0.6    // threshold
    );
    composer6.addPass(bloomPass);

    // モバイル DPR 0.5 維持。EffectComposer の internal RT もそれに従う
    composer6.setPixelRatio(renderer6.getPixelRatio());
    composer6.setSize(W, H);

    // 既存 onR6 リサイザは composer6.setSize を呼んでいる（:3295）。OK。

    console.log('[P3] UnrealBloomPass enabled', { strength: 0.8, radius: 0.6, threshold: 0.6 });
  } catch (e) {
    console.warn('[P3] postprocessing load failed, fallback to direct render:', e);
    composer6 = null;
  }
})();
```

**レンダーループの既存行（`:3997`）はそのままで OK:**
```js
if (composer6) composer6.render(); else renderer6.render(scene6, camera6);
```
fallback パスを残しているので、import 失敗・端末非対応時も画は出る。

### 2.6 パラメータ根拠 — `(0.8, 0.6, 0.6)` を選んだ理由

| パラメータ | 推奨値 | 旧コード値 | 根拠 |
|------------|--------|-----------|------|
| strength | **0.8** | 1.6 | 1.6 は派手すぎ。grey 美学では明部の「ふわっとした拡張」が欲しいだけ。0.8 は写真的露出オーバーの薄滲みに相当。 |
| radius | **0.6** | 0.5 | 0.5 だとハロが粒子に近すぎ「太った点」に見える。0.6〜0.7 で星空写真の白点まわりの hazy halo に近づく。 |
| threshold | **0.6** | 0.15 | 0.15 だと暗い粒子まで bloom され全体が霞む。**高輝度コア（白注入された core）だけ滲ませたい** ので 0.6 に上げる。fragment 側で core を 1.0+ に押し上げる Task 2 と連動。 |

> **重要な相互依存:** threshold 0.6 は「fragment が 0.6 を超える明部を出す」ことが前提。Task 2 で `core * 1.6` 程度のブースト（後述）を入れて初めて bloom が拾う。**Task 1 単独で動かすと「ほぼ何も bloom されない」** 可能性がある。Codex は Task 1 と Task 2 をペアで検証すること。

### 2.7 工数 / リスク / 検証

- **工数:** 1.0 人日（vendor 取得 0.2 + importmap・script 配線 0.2 + composer 配線 0.3 + 実機確認 0.3）
- **リスク:**
  - importmap の二重 ESM/UMD 同居 → `THREE` グローバルと ESM の `import { ... } from 'three'` が**異なるインスタンス**を返す危険。`bloomPass.material` のシェーダは ESM 側 THREE を参照、`renderer6` は UMD 側 THREE で生成。**動くが内部判定で `instanceof` 失敗の可能性**あり（推測）。回避: composer も UMD 側で生成するため動的 import で取った class が UMD と互換である必要がある。実装後に DevTools console で `composer6.passes[0] instanceof THREE.RenderPass` を確認。問題が出たら `vendor/three.min.js` を撤去し全 ESM 化（規模拡大）。
  - iOS Safari 旧端末で `WebGLRenderTarget` half-float 拡張未対応 → composer 落ちる。fallback 経路（catch）を必ず残す。
  - メモリ +20MB 前後（推測、5 段 RT）。低メモリ端末で OOM 警戒。
- **検証:**
  1. `composer6` が non-null であることを console 確認
  2. `renderer6.info.render.calls` が bloom 有無で +5〜6 増えるか
  3. 流れ星粒子（白色）が明らかに滲むか目視
  4. M1 / iPhone 13 / iPhone X / Pixel 6 / 旧 Android で fallback 経路の動作確認

---

## 3. タスク 2 — Fragment シェーダー簡素化

### 3.1 現状（`p3_code_for_claude.js:2849-2882`）

```glsl
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float radial = smoothstep(0.52, 0.0, d);
    float audioGlow = 1.0 + uAudioEnergy * 0.42;
    float core = exp(-d * d * 36.0);
    float innerGlow = exp(-d * d * (11.0 / audioGlow)) * 0.66;
    float outerHalo = exp(-d * d * (2.8 / audioGlow)) * 0.16;
    float rim = smoothstep(0.49, 0.24, d) * (1.0 - smoothstep(0.24, 0.02, d));
    float codeBand = smoothstep(0.30, 0.72, sin(d * 30.0 - uTime * 0.32 + vPhase * 8.0) * 0.5 + 0.5);

    float breathe = 0.58 + 0.42 * vBreathe;
    float shimmer = 0.94 + 0.06 * sin(uTime * (0.22 + vPhase * 0.08) + vPhase * 6.0 + vDist * 0.015);

    float ring = sin(vDist * 0.075 - uTime * (0.16 + uAudioEnergy * 0.18) + vPhase * 4.0) * 0.5 + 0.5;
    vec3 prism = vec3(
        sin(ring * 6.2832) * 0.5 + 0.5,
        sin(ring * 6.2832 + 2.094) * 0.5 + 0.5,
        sin(ring * 6.2832 + 4.189) * 0.5 + 0.5
    );

    vec3 baseColor = vColor * (0.78 + vDepthGlow * 0.18);
    vec3 codeColor = mix(vColor, prism, 0.46);
    vec3 finalColor = baseColor * (0.26 + innerGlow * 0.52);
    finalColor += codeColor * rim * (0.16 + codeBand * 0.10 + uAudioEnergy * 0.05);
    finalColor += mix(baseColor, prism, 0.18) * outerHalo * (0.32 + vDepthGlow * 0.14);
    finalColor += vec3(0.92, 0.95, 1.0) * core * (0.28 + vDepthGlow * 0.06 + uAudioEnergy * 0.08);
    finalColor += codeColor * codeBand * outerHalo * 0.12;

    float alphaRaw = (core * 0.86 + innerGlow + outerHalo + rim * 0.14 + codeBand * outerHalo * 0.10) * radial;
    float alpha = 1.0 - exp(-alphaRaw * 1.18);
    gl_FragColor = vec4(finalColor * breathe * shimmer, alpha * breathe * (0.74 + vDepthGlow * 0.22));
}
```

問題:
- 5 層構造（core / innerGlow / outerHalo / rim / codeBand / prism）+ 干渉縞 + RGB 位相分解
- `prism`（`:2866-2870`）+ `codeBand`（`:2859`）が **粒子内部に干渉模様** を描き「DVD 盤」化
- `vec3(0.92, 0.95, 1.0) * core * 0.28` の白注入係数 0.28 は bloom threshold 0.6 を超えない（0.28 × vColor.max ≈ 0.4 max）→ Task 1 で threshold 0.6 にしたとき bloom が拾えない

### 3.2 提案 — core + halo の 2 層 + 白コア強ブースト

**目標:**
- 粒子内に「描き込まない」（bloom に仕事を譲る）
- core 領域は **1.6 倍程度に push** して bloom threshold 0.6 を確実に超える
- halo は色を持つ（vColor）が低 alpha で広域

**新フラグメント（diff 形式、置換）:**

```diff
 fragmentShader: `
     varying vec3 vColor;
     varying float vBreathe;
     varying float vDist;
     varying float vPhase;
     varying float vDepthGlow;
     uniform float uTime;
     uniform float uAudioEnergy;

 void main() {
-    float d = length(gl_PointCoord - vec2(0.5));
-    if (d > 0.5) discard;
-
-    float radial = smoothstep(0.52, 0.0, d);
-    float audioGlow = 1.0 + uAudioEnergy * 0.42;
-    float core = exp(-d * d * 36.0);
-    float innerGlow = exp(-d * d * (11.0 / audioGlow)) * 0.66;
-    float outerHalo = exp(-d * d * (2.8 / audioGlow)) * 0.16;
-    float rim = smoothstep(0.49, 0.24, d) * (1.0 - smoothstep(0.24, 0.02, d));
-    float codeBand = smoothstep(0.30, 0.72, sin(d * 30.0 - uTime * 0.32 + vPhase * 8.0) * 0.5 + 0.5);
-
-    float breathe = 0.58 + 0.42 * vBreathe;
-    float shimmer = 0.94 + 0.06 * sin(uTime * (0.22 + vPhase * 0.08) + vPhase * 6.0 + vDist * 0.015);
-
-    float ring = sin(vDist * 0.075 - uTime * (0.16 + uAudioEnergy * 0.18) + vPhase * 4.0) * 0.5 + 0.5;
-    vec3 prism = vec3(
-        sin(ring * 6.2832) * 0.5 + 0.5,
-        sin(ring * 6.2832 + 2.094) * 0.5 + 0.5,
-        sin(ring * 6.2832 + 4.189) * 0.5 + 0.5
-    );
-
-    vec3 baseColor = vColor * (0.78 + vDepthGlow * 0.18);
-    vec3 codeColor = mix(vColor, prism, 0.46);
-    vec3 finalColor = baseColor * (0.26 + innerGlow * 0.52);
-    finalColor += codeColor * rim * (0.16 + codeBand * 0.10 + uAudioEnergy * 0.05);
-    finalColor += mix(baseColor, prism, 0.18) * outerHalo * (0.32 + vDepthGlow * 0.14);
-    finalColor += vec3(0.92, 0.95, 1.0) * core * (0.28 + vDepthGlow * 0.06 + uAudioEnergy * 0.08);
-    finalColor += codeColor * codeBand * outerHalo * 0.12;
-
-    float alphaRaw = (core * 0.86 + innerGlow + outerHalo + rim * 0.14 + codeBand * outerHalo * 0.10) * radial;
-    float alpha = 1.0 - exp(-alphaRaw * 1.18);
-    gl_FragColor = vec4(finalColor * breathe * shimmer, alpha * breathe * (0.74 + vDepthGlow * 0.22));
+    // === 簡素化 fragment（bloom 前提、粒子内に干渉模様を描かない） ===
+    float d = length(gl_PointCoord - vec2(0.5));
+    if (d > 0.5) discard;
+
+    // 2 層構造のみ
+    float core = exp(-d * d * 28.0);                           // 中心の硬いコア
+    float halo = exp(-d * d * 3.0);                            // 外周のなめらかなハロ
+
+    // 呼吸（既存仕様維持）
+    float breathe = 0.58 + 0.42 * vBreathe;
+    float audioBoost = 1.0 + uAudioEnergy * 0.35;
+
+    // コアは白寄り（bloom threshold 0.6 を超えるため 1.6 倍 push）
+    // vColor が CMYRGB 純色 → mix で白を 0.55 注入し、視覚的彩度を保ちつつ bloom 食わせる
+    vec3 hotWhite  = mix(vColor, vec3(1.0), 0.55);
+    vec3 coreColor = hotWhite * core * 1.6 * audioBoost;       // ← bloom 主役。1.0 を超える
+    vec3 haloColor = vColor   * halo * 0.32;                   // 色を持つ広域グロー
+
+    vec3 finalColor = coreColor + haloColor;
+
+    // 距離による彩度減衰（遠距離は白く近距離は色濃く — 大気散乱の真逆だが点光源では有効）
+    finalColor *= breathe;
+
+    // alpha: コア優先、halo は控えめ。Additive なので alpha は「強度」として機能
+    float alpha = (core * 0.95 + halo * 0.35) * breathe;
+
+    gl_FragColor = vec4(finalColor, alpha);
 }
 `,
```

### 3.3 削除した要素と理由

| 削除した要素 | 理由 |
|--------------|------|
| `innerGlow`, `outerHalo`, `rim` の 3 層 | 2 層（core+halo）で十分。多層は bloom 不在前提の代償措置だった |
| `codeBand`（同心リップル） | 「DVD 盤」化の主因。bloom が滲ませるので要らない |
| `prism` RGB 位相分解 | 干渉模様は粒子に書き込むものではない。bloom + tonemap で chromatic な感じが自然に出る |
| `shimmer` の sin 揺らぎ | 呼吸 `vBreathe` で十分。重ねると「ノイズ的安っぽさ」になる |
| `vDepthGlow` の alpha 加算（far で +0.22） | far で alpha が増える挙動は写真的に逆。今回 `breathe` だけに統一 |

### 3.4 注意点

- **司さんへの説明:** `prism` 同心リング・`codeBand` スキャンラインは **意図的演出** だった可能性。削除前に司確認推奨。Codex は実装前に司に「prism / codeBand を消しても OK ですか？」を確認するか、 `if (uReducedFx > 0.5)` のような uniform フラグで残せるよう実装してもよい（推奨: 完全削除でシンプルに）。
- **音響反応:** 旧仕様は `audioGlow` で innerGlow/outerHalo の σ を狭めていた。新仕様は `coreColor *= audioBoost` のみ。**音が大きいとコアが明るくなり bloom が強く反応**するので、結果的に「音で滲みが広がる」演出になる（むしろ自然）。

### 3.5 工数 / リスク

- **工数:** 0.5 人日（diff 適用 0.1 + 微調整 0.2 + 司確認・実機 0.2）
- **リスク:** prism/codeBand 削除で「inryokü ぽい質感」が変わる。Task 1 が動いていない状態で Task 2 だけ適用すると「色が薄いただの点」になり退化に見える。**必ず Task 1 の後に Task 2** を適用。

---

## 4. タスク 3 — HDR + ACES Tonemap + 純黒回避

### 4.1 現状

`p3_code_for_claude.js:2715-2718`:
```js
const renderer6 = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer6.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer6.setSize(W, H);
renderer6.setClearColor(0x000000, 1);
```

不在:
- `outputColorSpace`（r160 デフォルト `LinearSRGBColorSpace` だが UMD では挙動差あり）
- `toneMapping`（デフォルト `NoToneMapping` → 1.0 でクリップ）
- `toneMappingExposure`（デフォルト 1.0）
- clearColor が **完全黒 0x000000** → 純黒は CRT 時代の演出。OLED/IPS では黒つぶれで「画面オフ」感が出る。1% 灰のほうが「夜空がそこにある」気配を作る

### 4.2 改修コード

```diff
-    const renderer6 = new THREE.WebGLRenderer({ antialias: false, alpha: false });
-    renderer6.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
-    renderer6.setSize(W, H);
-    renderer6.setClearColor(0x000000, 1);
+    const renderer6 = new THREE.WebGLRenderer({ antialias: false, alpha: false });
+    renderer6.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
+    renderer6.setSize(W, H);
+
+    // === HDR / Tonemapping 設定（Task 3） ===
+    // outputColorSpace: sRGB エンコードを明示（r160 デフォルト挙動の不確実性を排除）
+    renderer6.outputColorSpace = THREE.SRGBColorSpace;
+    // ACESFilmic: 映画的トーンマップ。明部の「白に向かうロールオフ」が自然
+    renderer6.toneMapping = THREE.ACESFilmicToneMapping;
+    // 露出: 1.0 基準。Task 5 で動的に動かす
+    renderer6.toneMappingExposure = 1.1;
+
+    // 純黒回避: 1% 灰で「夜空がそこにある」気配を作る（OLED 黒つぶれ対策）
+    renderer6.setClearColor(0x070708, 1);
```

### 4.3 パラメータ根拠

| 項目 | 値 | 根拠 |
|------|-----|------|
| outputColorSpace | `SRGBColorSpace` | 出力先がブラウザ canvas（sRGB 想定）なので明示 |
| toneMapping | `ACESFilmicToneMapping` | 映画的。`Reinhard` は古い見た目、`Cineon` は青寄り、`ACES` は中庸かつ標準 |
| toneMappingExposure | `1.1` | 1.0 だと簡素化 fragment（core × 1.6）でも全体やや暗くなる。1.1 で底を上げる |
| clearColor | `0x070708` | 1% 灰、わずかに青寄り。`#070708` ≈ RGB(7,7,8) — 人間の視覚閾値に近い「黒に最も近い灰」 |

### 4.4 注意 — UnrealBloomPass との相互作用

ACES tonemap はデフォルトで **renderer 末尾** に挟まれる（`renderer6.render()` の最後）。**しかし composer 経由だとどこに入るか挙動が変わる**。

事実: `EffectComposer` は最終 `Pass` 出力をそのままバックバッファに描く。Three r160 では composer 内で `renderer.toneMapping` は **適用されない** ことが多い（composer 自体が renderTarget に書くため）。

**解決:** `OutputPass`（`three/addons/postprocessing/OutputPass.js`）を composer の最後に追加すると、tonemap + outputColorSpace が正しく適用される。

```js
const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
// ...
composer6.addPass(bloomPass);
composer6.addPass(new OutputPass());     // ← tonemap & sRGB を最後に適用
```

> **重要:** `OutputPass` を入れない場合、bloom は効くが ACES が効かず明部がただクリップする可能性がある。Codex は必ず `OutputPass` を最後に追加。Task 1 のファイルリストに `OutputPass.js` を追加する（§2.3 のリストに追記が必要）。

> **2.3 リストへの追記項目:**
> ```
> vendor/three/examples/jsm/postprocessing/OutputPass.js
> ```
> 取得コマンドのループに `OutputPass` を追加すること。

### 4.5 工数 / リスク

- **工数:** 0.1 人日（数行追加 + 検証）
- **リスク:** ACES によって「色が浅く見える」と感じる場合がある（実は線形 → sRGB エンコードが正しくなったので人間が「派手すぎ」に慣れていた）。司に「以前の方が色が濃く見えた」と言われたら exposure を 1.2 に上げて様子を見る。

---

## 5. タスク 4 — パーティクルサイズ自然分布

### 5.1 現状（`p3_code_for_claude.js:2773-2779`）

```js
const sR = uRng();
if (sR < 0.10)       aSizes[i] = 11.0 + uRng() * 8.6;   // 超大 10%
else if (sR < 0.32)  aSizes[i] = 5.8  + uRng() * 4.6;   // 大 22%
else if (sR < 0.65)  aSizes[i] = 3.0  + uRng() * 2.3;   // 中 33%
else if (sR < 0.92)  aSizes[i] = 1.55 + uRng() * 1.15;  // 小 27%
else                 aSizes[i] = 0.78 + uRng() * 0.75;  // 微粒子 8%
```

問題:
- 5 区間 uniform → 区間境界で離散ジャンプ（自然界に存在しない分布）
- 距離による減衰なし → far の大粒子も近場と同じ size に見える

### 5.2 提案 — log-normal 分布 + 距離減衰

**数式:**

サイズ生成（log-normal、Box-Muller で正規分布から）:
```
gauss = sqrt(-2 * ln(u1)) * cos(2π * u2)
aSize = exp(μ + σ * gauss)
```
- μ = 1.0（中央値 ≈ exp(1.0) ≈ 2.72）
- σ = 0.7（裾の重さ。0.5 だと尖る、1.0 だと過剰に重い）

統計的性質（μ=1.0, σ=0.7 のとき）:
- 中央値: 2.72
- 平均値: ≈ 3.47
- 95% 上限: ≈ 8.6
- 99% 上限: ≈ 14
- ロングテール最大値: 16〜25（自然な「特別な大粒子」が生まれる）

距離減衰（vertex shader 内）:
```glsl
gl_PointSize = aSize * sizeBreath * (318.0 / -mvPos.z);
// 既存ロジックは OK だが、far で size が小さくなりすぎる対策として:
gl_PointSize *= 1.0 / (1.0 + 0.0008 * vDist);   // 緩い距離減衰、k=0.0008
```

### 5.3 実装コード

**JS 側（粒子生成、`:2773-2779` を置換）:**
```js
// === log-normal サイズ分布（Task 4） ===
// 90% は中位サイズ、10% が大きく主役化、ロングテールで稀に超大
function gaussRng() {
    // Box-Muller
    const u1 = Math.max(uRng(), 1e-9);
    const u2 = uRng();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}
const mu = 1.0;
const sigma = 0.7;
let s = Math.exp(mu + sigma * gaussRng());
// 安全クランプ（極端な裾を抑える）
s = Math.max(0.6, Math.min(s, 22.0));
aSizes[i] = s;
```

**Vertex shader（`:2829-2836` 付近）:**
```diff
     vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
     float depthNorm = clamp((-mvPos.z - 60.0) / 560.0, 0.0, 1.0);
     vDepthGlow = depthNorm;
-    gl_PointSize = aSize * sizeBreath * (318.0 / -mvPos.z);
-    gl_PointSize = max(gl_PointSize, 0.72);
-    gl_PointSize = min(gl_PointSize, 42.0);
+    // === Task 4: 距離減衰追加 ===
+    float baseSize = aSize * sizeBreath * (318.0 / -mvPos.z);
+    float distFalloff = 1.0 / (1.0 + 0.0008 * vDist);
+    gl_PointSize = baseSize * distFalloff;
+    gl_PointSize = clamp(gl_PointSize, 1.5, 32.0);
     gl_Position = projectionMatrix * mvPos;
```

clamp 範囲変更:
- 旧: `[0.72, 42.0]` → 新: `[1.5, 32.0]`
- 0.72px は aliasing（ジリジリ）の主因 → 1.5px 下限で消える代わりに alpha で薄め表現
- 42px は近接で prism 縞が見える主因 → 32px に下げて簡素化 fragment と整合

### 5.4 工数 / リスク

- **工数:** 0.3 人日（実装 0.15 + 分布パラメータ微調整 0.1 + 実機 0.05）
- **リスク:** 中央値が 2.72 に下がる（旧仕様の中域 3.0〜5.3 より小さい）→ 全体的に「粒子が小さく感じる」可能性。司確認後、μ を 1.2 に上げる調整余地あり（中央値 3.32）。

---

## 6. タスク 5 — 観測者依存の発光（哲学整合）

### 6.1 哲学的背景

- inryokü 命題: **「観測する側が居なければ光は意味を持たない」**「100 の観測者に対して 101 の真実」
- 50→101: 沈黙の grey から、観測者の意識を経て光が生まれる
- 物理的隠喩: 量子論の観測効果（コペンハーゲン解釈）— 観測されて初めて状態が確定する

実装的に何を意味するか:
- ユーザの **視野中心**（カメラ向きベクトルと粒子位置の内積が 1 に近い）の粒子だけ強く発光
- ユーザの **マウス位置**（あるいはタッチ位置）に応じて bloom strength が動的変化
- 「眺めている方向の粒子が応答する」体験

### 6.2 実装案 — 2 段階

#### 6.2.1 段階 A — マウス位置 → bloom strength 動的

**Uniform 追加（粒子マテリアルとは別、`bloomPass.strength` を直接動かす）:**
```js
// マウス位置（normalized: 中央 0,0、四隅 ±1）
let mouseNX = 0, mouseNY = 0;
let mouseTargetIntensity = 1.0;     // 中央で 1.0、端で薄く
let mouseSmoothIntensity = 1.0;

window.addEventListener('pointermove', (e) => {
    mouseNX = (e.clientX / window.innerWidth) * 2.0 - 1.0;
    mouseNY = (e.clientY / window.innerHeight) * 2.0 - 1.0;
    // 中央に近いほど高、端で減衰（gauss 風）
    const r2 = mouseNX * mouseNX + mouseNY * mouseNY;
    mouseTargetIntensity = Math.exp(-r2 * 0.8);    // r=0 で 1.0, r=1 で 0.45
}, { passive: true });

// loop6 の中で smoothing
mouseSmoothIntensity += (mouseTargetIntensity - mouseSmoothIntensity) * 0.06;

// bloom strength を動的に
if (bloomPass) {
    // base 0.8、観測（中央注視）で +0.4 まで強化、端で -0.2
    bloomPass.strength = 0.6 + mouseSmoothIntensity * 0.5;
}
```

#### 6.2.2 段階 B — 視野中心の粒子だけ強発光（vertex/fragment 拡張）

カメラ向きベクトルと粒子方向の内積で「視野中心度」を計算し、fragment の core ブースト係数に乗せる。

**Uniform 追加:**
```js
material.uniforms.uViewCenter = { value: new THREE.Vector3(0, 0, -1) };  // カメラ前方
material.uniforms.uObserverPower = { value: 0.0 };  // 0〜1 で観測強度
```

**カメラ更新時（毎フレーム）:**
```js
const fwd = new THREE.Vector3();
camera6.getWorldDirection(fwd);
material.uniforms.uViewCenter.value.copy(fwd);
material.uniforms.uObserverPower.value = mouseSmoothIntensity;
```

**Vertex shader 拡張（粒子の視野中心度を計算して varying に渡す）:**
```glsl
uniform vec3 uViewCenter;
uniform float uObserverPower;
varying float vObserved;

// main() の中:
vec3 toParticle = normalize(position - cameraPosition);
float centerDot = dot(toParticle, uViewCenter);          // -1〜1
float fov = smoothstep(0.7, 1.0, centerDot);              // 視野中心 30度くらいで 1.0
vObserved = fov * uObserverPower;
```

**Fragment shader 拡張（簡素化版にブースト追加）:**
```glsl
varying float vObserved;
// ...
vec3 coreColor = hotWhite * core * (1.6 + vObserved * 1.2) * audioBoost;
//                                          ^^^^^^^^^^^^^^
//                                          観測されて初めて 2.8 倍まで上がる
```

### 6.3 哲学的整合の確認

- **観測されたから光る** ✓（視野中心 + マウス位置で発光ブースト）
- **静謐の中の光** ✓（端の粒子は base のまま、中央だけ滲む）
- **派手にしない** ✓（増分は最大 +1.2 倍、bloom 強度差は 0.6〜1.1 の範囲）
- **grey 美学** ✓（色は変えず、明度 / 滲みのみ変化）

### 6.4 工数 / リスク

- **工数:** 0.5 人日（マウス追従 0.15 + uniform 配線 0.15 + fragment 拡張 0.1 + 哲学整合の微調整 0.1）
- **リスク:**
  - モバイルでは pointermove が touch 限定 → タッチしていないとき `mouseSmoothIntensity` がどう振る舞うか設計必要。**推奨: モバイルは画面中央固定で `mouseSmoothIntensity = 0.7` 一定**、または角度センサ（DeviceOrientation）連動（ただし DeviceOrientation は permission 必要、ハードル高）
  - bloom strength を毎フレーム書き換えると WebGL state cache が走る。**1 フレーム差を超えるときだけ書く** などの最適化推奨

---

## 7. 各タスクの工数見積もり総括

| タスク | 工数 | 累積 |
|--------|------|------|
| Task 3 (HDR/Tonemap) | 0.1 d | 0.1 d |
| Task 1 (Bloom 復活) | 1.0 d | 1.1 d |
| Task 2 (Fragment 簡素化) | 0.5 d | 1.6 d |
| Task 4 (粒子分布) | 0.3 d | 1.9 d |
| Task 5 (観測者発光) | 0.5 d | 2.4 d |
| 実機検証・微調整・司確認 | 0.6 d | **3.0 d** |

---

## 8. 実装順序の推奨（再掲・詳細版）

### Day 1 — Bloom パイプライン復活

**午前:**
1. Task 3 を先に（renderer 設定 5 行追加）
2. Task 1 のファイル取得（vendor/three/ 配下に 10 ファイル）
3. importmap 改修（index.html, p3_test.html 両方）

**午後:**
4. Task 1 の composer 配線（動的 import）
5. console で `composer6` non-null 確認、`bloomPass` 確認
6. 流れ星の白粒子が滲むか目視

**Day 1 終了時のチェックリスト:**
- [ ] `vendor/three/` 配下に 10 ファイルあり
- [ ] importmap で `three`, `three/addons/` 両方解決
- [ ] DevTools で `composer6.passes.length === 4`（Render + Bloom + Output 含めれば 3、+ 動的なら 4）
- [ ] 流れ星にハロ
- [ ] ACES で明部が白くロールオフ
- [ ] 既存の `body.inryoku-speaking` トリガで bloom が壊れない

### Day 2 — Fragment 簡素化 + 粒子分布

**午前:**
7. Task 2 適用、prism/codeBand 削除、core × 1.6 ブースト
8. **Task 1 の threshold が 0.6 で正しく拾えているか再確認**（簡素化後に bloom が薄くなっていないか）

**午後:**
9. Task 4 適用（log-normal + 距離減衰）
10. 司に Day 2 の見え方を共有・フィードバック取得

### Day 3 — 観測者発光 + 仕上げ

**午前:**
11. Task 5 段階 A（マウス → bloom strength）
12. Task 5 段階 B（視野中心ブースト）

**午後:**
13. 実機検証（M1 / iPhone 13 / Pixel 6 / 旧 Android）
14. モバイルで DPR 0.5 維持確認、composer 落ちる端末で fallback 動作確認
15. 司最終確認

---

## 9. 検証方法（before/after スクショ撮影手順）

### 9.1 撮影シナリオ

各シナリオで **before（現行）** と **after（実装後）** の 2 枚ずつ。

| # | シナリオ | 状態 | 注目点 |
|---|---------|------|--------|
| S1 | 起動直後の宇宙 | `bigBangState=watching` | 全体の明部の滲み量 |
| S2 | チャット中 | `body.inryoku-speaking` ON | speaking 時の粒子減光と bloom 共存 |
| S3 | 流れ星出現の瞬間 | shooting star アクティブ | 白粒子のハロ、痕跡の見え方 |
| S4 | 中央注視 vs 端注視（Task 5 検証） | マウス中央 vs 隅 | bloom strength 動的差 |
| S5 | 至近粒子（カメラ z=200, 粒子 z≈-110） | 大粒子クローズアップ | prism 縞が消えていること |
| S6 | 遠景粒子 | far cluster | 距離減衰で size 自然 |
| S7 | dark mode（暗室で） | OS dark + 暗室 | 純黒回避（0x070708）の効き |
| S8 | 明所（日中の明るい部屋） | 環境光あり | 明所での視認性低下が許容範囲か |

### 9.2 撮影方法

1. ブラウザを 1280×720 に固定（`window.resizeTo(1280, 720)` を console で）
2. DevTools で `await new Promise(r => setTimeout(r, 5000))` で安定化を待つ
3. macOS: `Cmd+Shift+4 → Space → click window` でウィンドウ単体撮影
4. ファイル名規約: `p3-{shader}-{scenario}-{before|after}-{date}.png`
5. 保管先: `/Users/10ta210/Desktop/inryoku_hp/docs/screenshots/2026-04-29-shader-handoff/`

### 9.3 数値検証

```js
// DevTools console で以下を実行（before/after 両方）:
console.table({
    composer:    !!window.__p3.composer6,
    passes:      window.__p3.composer6?.passes?.length ?? 0,
    bloomStr:    window.__p3.bloomPass?.strength ?? 'N/A',
    bloomThresh: window.__p3.bloomPass?.threshold ?? 'N/A',
    toneMap:     window.__p3.renderer6?.toneMapping,
    colorSpace:  window.__p3.renderer6?.outputColorSpace,
    drawCalls:   window.__p3.renderer6?.info.render.calls,
    triangles:   window.__p3.renderer6?.info.render.triangles,
    fps:         window.__p3.lastFps
});
```

> **前提:** Codex は実装時に `window.__p3 = { renderer6, composer6, bloomPass, ... }` を debug 用にぶら下げておくこと。production ビルドでは外す。

### 9.4 主観基準（鑑定観点）

- [ ] 流れ星が **線** に見える（点ではない）
- [ ] 大粒子の周囲に **柔らかいハロ**（DVD 盤の同心リングではない）
- [ ] 端粒子が暗く、中央粒子が明るい（観測者効果）
- [ ] 全体に「写真の夜空」感（「LED マトリクス」感ではない）
- [ ] grey 静謐感が壊れていない（派手さに振れていない）
- [ ] CMYRGB 6 色が識別できる（白く飛んで色が消えていない）

---

## 10. リスクと留保事項

### 10.1 推測に依存している箇所（Codex は実装時に検証）

- importmap 二重 ESM/UMD 同居の `instanceof` 互換性 — **要実機検証**
- ACES + bloom の合成順序（OutputPass 必須かどうか） — **r160 の挙動を実機確認**
- モバイル half-float 拡張 — **iPhone X 以前で fallback 動作確認**
- log-normal 分布の中央値が司の感性と合うか — **実装後に司確認**

### 10.2 やらないこと（スコープ外）

- 粒子色パレットの変更（CMYRGB 6 色固定は司指示）
- 音響反応のロジック大幅改修（既存 `uAudioEnergy` 流用）
- DOF（被写界深度）— 重い、Phase 3 ではコスパ悪い
- Lens flare（クロスフレア）— 既に CSS-E で足場準備済（粒子診断ドキュメント参照）。本タスクでは扱わない
- Soft particle（depth texture 比較）— 別 RT 必要、規模大

### 10.3 司確認が必要なポイント

1. **prism / codeBand の削除可否**（粒子内の干渉模様が好きだった可能性）
2. **bloom strength = 0.8** が控えめすぎないか（grey 美学的には控えめが正解だが司の好みで 1.0 に上げる選択肢あり）
3. **clearColor を 0x000000 → 0x070708** にすることで「漆黒の夜空」が「気配のある夜空」に変わる（哲学的には 50→101 整合だが、司の好みで純黒戻しもあり）
4. **観測者発光（Task 5）の実装範囲**（マウスのみ / 視野中心も / モバイル対応）

---

## 11. ファイルパス索引

| 用途 | パス |
|------|------|
| 本ハンドオフ | `/Users/10ta210/Desktop/inryoku_hp/docs/codex-shader-handoff-2026-04-29.md` |
| 主犯診断 | `/Users/10ta210/Desktop/inryoku_hp/docs/particle-cheap-diagnosis-2026-04-29.md` |
| 技法カタログ | `/Users/10ta210/Desktop/inryoku_hp/docs/light-emission-research-2026-04-29.md` |
| 実装ターゲット | `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js` |
| HTML（importmap） | `/Users/10ta210/Desktop/inryoku_hp/index.html` |
| HTML（テスト） | `/Users/10ta210/Desktop/inryoku_hp/p3_test.html` |
| Vendor | `/Users/10ta210/Desktop/inryoku_hp/vendor/` |
| 既存 perf 監査 | `/Users/10ta210/Desktop/inryoku_hp/docs/p3-performance-audit-2026-04-28.md` |

---

## 付録 A — Codex 着手時のチェックリスト

```
[ ] §2.3 の 10 ファイルを vendor/three/ 配下に取得・配置
[ ] index.html / p3_test.html の importmap を §2.4 に従い改修
[ ] p3_code_for_claude.js の renderer 設定に Task 3 の 4 行追加
[ ] composer 配線を動的 import 化（§2.5）
[ ] OutputPass を composer 末尾に追加（§4.4）
[ ] Day 1 終了時チェックリストを全項目通過
[ ] Fragment を §3.2 の diff で置換
[ ] 粒子サイズ生成を §5.3 の log-normal に置換
[ ] vertex shader の clamp 範囲を [1.5, 32.0] に変更
[ ] Task 5 段階 A（マウス → bloom strength）実装
[ ] Task 5 段階 B（視野中心 → core ブースト）実装
[ ] §9 の S1〜S8 シナリオで before/after スクショ撮影
[ ] §9.3 の数値検証 console.table 実行・記録
[ ] 司最終確認・フィードバック反映
```

---

## 付録 B — 一行サマリ（司さん向け）

> 「光が安っぽい」のは粒子の絵が悪いんじゃなく **光らせる工程が抜けている** から。Codex に出すのは（1）その工程を復活させる、（2）粒子側で頑張りすぎた絵を引き算する、（3）色空間とトーンを物理的に正しくする、（4）粒子の大きさを自然な分布に直す、（5）観測者によって光が変わる演出を入れる、の 5 タスク。grey 美学は壊さない。CMYRGB 6 色も守る。3 日。

---

**END OF HANDOFF — 2026-04-29**
