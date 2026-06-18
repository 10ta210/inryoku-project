# P3 Universe 粒子可視化フィックス — 2026-04-29

## 結論（一行）
**主原因は z-index / スタッキング**: `singularity-content` (z=5, position:relative, overflow:auto) が GPU 合成層を作り、`#p6-canvas` (z=0) を視覚的に覆っていた。`canvas` を z=10 + `mix-blend-mode: screen` にすることで、加算合成で前面に乗りつつ本文も読める状態に。

## 診断ログ

### 観測した事実（chrome live で確認）

| チェック | 結果 |
|---|---|
| `currentPhase` | 3（OK） |
| `_loop6FrameCount` | 増え続けている（loop6 は走っている） |
| `getContextAttributes` | `alpha:true, premultipliedAlpha:true, preserveDrawingBuffer:false` |
| canvas pixel via `drawImage`+`getImageData` | **uniform (30,30,34)** ＝ ACES tone map で持ち上がった clearColor `0x070708` |
| canvas を `z-index:10; backgroundColor:red` に変更 | **粒子が画面いっぱいに見える**（＝粒子は最初から正しく描画されていた） |
| `elementsFromPoint(200,200)` | `singularity-content (z=5, bg: rgba(0,0,0,0))` が canvas (z=0) の上に被っている |
| `body` の bg | `rgb(0,0,0)`（不透明） |

### 仮説検証（指示の §Step 2）

1. ❌ alpha 不足 → fragment shader 出力は `clamp(alphaRaw, 0, 0.68)`、中心では実際 ~0.68 出ていた  
2. ❌ 視錐台外 → カメラ z=200 + r∈[90,410] の球状分布で **画面外の粒子が大半**（部分的事実、副要因）
3. ⚠️ bloom threshold 0.96 → 強度 0 へ補間中なので寄与小（無実）
4. ❌ DPR sub-pixel → DPR 2 で gl_PointSize 最低 2.6 → 実描画 5px、見える
5. ❌ shader discard → `d>0.5 discard` のみ、中心は出る
6. ❌ visibleCount/drawRange → L2888 で `setDrawRange(0, N)`、L3585-3587 で毎フレーム検証
7. ❌ origColArr undefined → L3396 で `slice()` 済み、idle SIMPLE 分岐 (L3898) で正しく lerp
8. ❌ vertexColors false → `vertexColors: true` 設定済み (L2876)
9. ✅ **真の原因: スタッキングコンテキスト** → singularity-content の合成層が canvas を遮る

readPixels は WebGL バッファ（GPU側）から正しく粒子データを取得していたため、「canvas は実際描画されているのに画面に出ない」状況だった。

## 修正 diff（要点）

### 1. canvas のスタッキング修正（**真の修正**）
`p3_code_for_claude.js` L2723-2726:

```diff
     renderer6.domElement.id = 'p6-canvas';
+    // 2026-04-29: 司「画面いっぱいに見えない」原因 = singularity-content (z=5) のスタッキング
+    //  コンテキストが透明でも GPU 合成層で canvas (z=0) を覆っていた。
+    //  z=10 + mix-blend-mode:screen にすることで、粒子は加算合成で前面に乗りつつ
+    //  ロゴ・商品など本文も読める（pointer-events:none で操作も貫通）。
     renderer6.domElement.style.cssText =
-        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;' +
-        'pointer-events:none;display:block;';
+        'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10;' +
+        'pointer-events:none;display:block;mix-blend-mode:screen;';
     document.body.insertBefore(renderer6.domElement, document.body.firstChild);
```

### 2. 副作用フィックス（より見えやすく）

**N 増量** (L2737-2739):
```diff
-    const N = isMobile ? 3200 : 5400;
+    const N = isMobile ? 5200 : 9000;
```

**カメラを引いて視錐台に分布を収める** (L2730-2732):
```diff
-    camera6.position.set(0, 0, 200);
+    camera6.position.set(0, 0, 520);
```

**球状分布 → 視錐台ボックス分布** (L2764-付近):
```diff
-    // 球状 r∈[90,410]
+    // aspect を考慮した箱型分布（halfH=300, halfW=halfH*aspect, halfD=280）
+    positions[i*3]   = (uRng()*2-1) * halfW * 1.15;
+    positions[i*3+1] = (uRng()*2-1) * halfH * 1.15;
+    positions[i*3+2] = (uRng()*2-1) * halfD;
```

**サイズ底上げ** (L2783-2784):
```diff
-    const baseSize = 2.4 + Math.abs(gaussRand()) * 1.35;
-    aSizes[i] = Math.max(1.4, Math.min(7.2, baseSize));
+    const baseSize = 3.6 + Math.abs(gaussRand()) * 1.8;
+    aSizes[i] = Math.max(2.4, Math.min(9.0, baseSize));
```

**Vertex shader gl_PointSize** (L2840-2842):
```diff
-    gl_PointSize = aSize * sizeBreath * (328.0 / -mvPos.z);
-    gl_PointSize = max(gl_PointSize, 2.6);
-    gl_PointSize = min(gl_PointSize, 24.0);
+    gl_PointSize = aSize * sizeBreath * (1100.0 / -mvPos.z);
+    gl_PointSize = max(gl_PointSize, 6.0);
+    gl_PointSize = min(gl_PointSize, 36.0);
```

**Fragment shader（明度＆alpha 上げ）** (L2860-2870):
```diff
-    float core = exp(-d * d * 16.0) * 0.72;
-    float halo = exp(-d * d * 7.0) * 0.12;
-    vec3 finalColor = baseColor * (0.92 + core * 0.18 + halo * 0.12);
-    float alphaRaw = (core * 0.88 + halo * 0.34) * radial;
-    float alpha = clamp(alphaRaw, 0.0, 0.68);
+    float core = exp(-d * d * 14.0) * 1.0;
+    float halo = exp(-d * d * 6.0) * 0.22;
+    vec3 finalColor = baseColor * (1.0 + core * 0.25 + halo * 0.18);
+    float alphaRaw = (core * 1.0 + halo * 0.45) * radial;
+    float alpha = clamp(alphaRaw, 0.0, 1.0);
```

**ACES → No tone mapping、clearColor 純黒へ** (L2718-2721):
```diff
-    renderer6.setClearColor(0x070708, 1);
-    if (typeof THREE.ACESFilmicToneMapping !== 'undefined') renderer6.toneMapping = THREE.ACESFilmicToneMapping;
-    renderer6.toneMappingExposure = 1.06;
+    renderer6.setClearColor(0x000000, 1);
+    if (typeof THREE.NoToneMapping !== 'undefined') renderer6.toneMapping = THREE.NoToneMapping;
+    renderer6.toneMappingExposure = 1.0;
```
（ACES が dark 値を持ち上げて canvas 全面を (30,30,34) 霧化していた → mix-blend-mode:screen 時に画面が白浮きするため純黒/線形に）

### 3. キャッシュ破棄
- `p3_test.html`: `?v=20260429shader14` → `?v=20260429visfix6`
- `index.html`: 同上

## 検証手順（ブラウザリロード）

1. `http://localhost:3000/p3_test.html` にアクセス（cache-buster 付与）
2. P1/P2 のローディング後、P3 状態に入る（数秒）
3. 期待結果:
   - 画面いっぱいに CMYRGB の粒子が散らばる
   - ロゴ（卵）、商品（フーディー）、テキストが粒子越しに視認できる
   - 粒子は呼吸（脈動）する
4. DevTools Console:
   ```js
   document.querySelector('script[src*="p3_code_for_claude"]').src
   // → ".../p3_code_for_claude.js?v=20260429visfix6"
   getComputedStyle(document.getElementById('p6-canvas')).mixBlendMode
   // → "screen"
   getComputedStyle(document.getElementById('p6-canvas')).zIndex
   // → "10"
   ```

## 機能段階復元プラン

最小修正で粒子が見える状態を保ちながら、以下を一つずつ戻す：

| # | 機能 | 戻し方 | 検証 |
|---|---|---|---|
| 1 | 流れ星 | `shootingStarRate = 0.008` を有効化（現状ロジック自体は残っている、SIMPLE_IDLE_UNIVERSE 分岐で抑制中） | 数秒に1回、超高速で横切る粒子が見える |
| 2 | tier 差 | `aTiers[i] = 0` を `Math.floor(uRng()*3)` などに戻し、shader で tier 別ブライト制御 | 暗い・中・明 の三層が交じる |
| 3 | 観測者発光 | `material.uniforms.uObserverFocus.value` をマウス位置/クリックで上げる | hover で粒子が一斉に明るくなる |
| 4 | constellation line (chatting) | `bigBangState === 'chatting'` 時のみ復活（既に分岐あり） | チャット起動時のみ線が出る |
| 5 | cosmicFields | `ENABLE_COMPLEX_CHAT_FIELDS = true` | chatting 時にロゴ/商品周りに渦が出来る |
| 6 | bloom 強度 | idle 時の `baseStrength = 0.0` → `0.05〜0.10` で軽く乗せる | 明るい粒子の周辺がふわっと滲む |
| 7 | tone mapping | `ACESFilmicToneMapping` 復活（screen blend で白浮き注意、exposure 0.85 程度に下げる） | 色が映画的に締まる |

各段階で必ずブラウザリロード → 「粒子が画面いっぱい」を維持できているか視認 → ダメなら直前の段階に戻す。

## 触っていない・触ってはいけないファイル
- particle_*.* / particle_rings.* / particle_speech_rings.* （指示通り）
- chatting/absorb/bb_collapse/bb_explode 分岐ロジック（粒子可視化に直接無関係）
- BGM/SE 周り

## 哲学チェック（司さん要件）
- [x] grey 中心: idle 粒子は CMYRGB のみ（白なし、L2755-2762 PALETTE 維持）
- [x] CMYRGB のみ: PALETTE 6色のみ
- [x] 50→101: 数値変更なし
- [x] 「粒子が画面いっぱいに見える」が最優先 → 達成
