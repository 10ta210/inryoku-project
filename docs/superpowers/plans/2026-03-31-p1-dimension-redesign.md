# P1 四次元リビルド 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** P1を4段階の次元変化（Win95ピクセル世界 → 次元転換グリッチ → モダン高解像度世界 → 白爆発P2遷移）に改修する

**Architecture:** 単一ファイル `p1_code_for_claude.js` のみを変更。既存のシェーダー・フェーズ構造（PH.ATTRACT→EVENT_FUSE→DUALITY→EVENT_SING→WARP_GROW→EVENT_BREACH→CONSUME→EVENT_COLLAPSE）を維持しながら、Phase B/C/Dに次元変化演出を追加する。Phase毎にnode --check + コミットで安全に進める。

**Tech Stack:** Three.js 0.160.0, GLSL ShaderMaterial, HTML/CSS, Web Audio API
**対象ファイル:** `/Users/10ta210/.gemini/antigravity/scratch/antigravity/p1_code_for_claude.js`
**確認URL:** `http://localhost:3000/p1_index_for_claude.html`

---

## ファイル構造（変更箇所マップ）

```
p1_code_for_claude.js
├── L654-882  : HTML UI構造 (Win95ウィンドウ + プログレスバー)
│              [Task 3] Phase C用ミニバーを body 直下に追加
├── L913-916  : DOM参照 (bar, pct, logoEl, barWrap, sqBorder)
│              [Task 3] phase-c-bar 参照を追加
├── L919-961  : HOLD-TO-LOAD setInterval
│              [Task 1] AUTO_RATE自動進行に完全置換
├── L1430-1441: showProg()
│              [Task 3] phase-c-barも同期更新するよう拡張
├── L1427-1428: 状態変数 (phase, prog, tunnelBorn 等)
│              [Task 3] phaseCInited フラグを追加
├── L1571-1688: EVENT_SING フェーズロジック
│              [Task 2] タイムライン拡張 (3.5s→5.0s)
├── L1690-1699: WARP_GROW フェーズロジック
│              [Task 3] Phase C UI切り替え初期化を追加
├── L1071-1089: newtonRingMat シェーダー定義
│              [Task 3] 動的ニュートンリングに作り直し
```

---

## Task 1: Hold-to-Load廃止 → AUTO_RATE自動進行

**Files:**
- Modify: `p1_code_for_claude.js:919-961`

現行の `holding` フラグ依存ロジックを、フェーズごとのprog/秒で自動進行するコードに置き換える。

- [ ] **Step 1: 現行コードを確認**

現在 L919-961 は以下の構造:
```javascript
setTimeout(() => {
    ...
    let holding = false;
    barTrack.addEventListener('mousedown', (e) => { holding = true; e.preventDefault(); });
    // ... touchstart, mouseup, touchend
    setInterval(() => {
        if (phase === PH.DONE) return;
        const inEvent = [...].includes(phase);
        if (inEvent) { tick(); return; }
        if (holding) { prog = Math.min(101, prog + 0.35); showProg(prog); tick(); }
    }, 16);
}, 100);
```
これを全て置き換える。

- [ ] **Step 2: L919-961を自動進行ロジックに置換**

置換前（L919の`// ── HOLD-TO-LOAD + AUTO-TICK ──`から L961の`}, 100);`まで）:

```javascript
        // ── AUTO-TICK (自動進行) ──
        setTimeout(() => {
            if (!document.getElementById('bar-wrap')) { console.error('bar-wrap not found'); return; }

            // フェーズごとの自動進行速度 (prog / 秒)
            // 62.5 fps 想定: rate/62.5 = prog/tick
            const AUTO_RATE = {};
            AUTO_RATE[PH.ATTRACT]   = 8.5;  // 0→30%  ≈ 3.5s
            AUTO_RATE[PH.DUALITY]   = 6.5;  // 30→50% ≈ 3.1s
            AUTO_RATE[PH.WARP_GROW] = 6.0;  // 50→75% ≈ 4.2s
            AUTO_RATE[PH.CONSUME]   = 5.0;  // 75→101% ≈ 5.2s

            const EVENT_PHASES = [
                PH.EVENT_FUSE, PH.EVENT_SING,
                PH.EVENT_BREACH, PH.EVENT_COLLAPSE
            ];

            setInterval(() => {
                if (phase === PH.DONE) return;
                if (EVENT_PHASES.includes(phase)) return;
                const rate = AUTO_RATE[phase] !== undefined ? AUTO_RATE[phase] : 5.0;
                prog = Math.min(101, prog + rate / 62.5);
                showProg(prog);
            }, 16);
        }, 100);
```

- [ ] **Step 3: node --check で構文確認**

```bash
/Users/10ta210/.nvm/versions/node/v22.22.0/bin/node --check /Users/10ta210/.gemini/antigravity/scratch/antigravity/p1_code_for_claude.js
```
Expected: 出力なし（エラーなし）

- [ ] **Step 4: コミット**

```bash
cd /Users/10ta210/.gemini/antigravity/scratch/antigravity
git add p1_code_for_claude.js
git commit -m "P1 AUTO_RATE: replace hold-to-load with auto-progression"
```

---

## Task 2: Phase B — EVENT_SING 次元転換演出

**Files:**
- Modify: `p1_code_for_claude.js:1571-1688`

現行EVENT_SINGの3.5秒シーケンスを5.0秒に拡張し、グリッチ・pixelRatio切り替え・フォント変更を追加する。

**新タイムライン:**
```
0.0-0.3s  : 衝突フラッシュ (既存維持)
0.3-0.8s  : グリッチ (win95-main が震える + bgMat flash点滅)
0.8s      : pixelRatio 0.5 → devicePixelRatio + フォント変更
0.8-1.5s  : UIフリッカー (文字がmonospaceに切り替わる)
1.5-2.2s  : grey sphere出現・脈動
2.0-3.0s  : Yin-Yang fade-in
3.0-3.5s  : Yin-Yang → grey morphing
3.5-4.0s  : tunnel born
4.0-5.0s  : tunnel grows
5.0s      : → PH.WARP_GROW
```

- [ ] **Step 1: EVENT_SINGの開始行を確認**

L1571 の `} else if (phase === PH.EVENT_SING) {` から L1688 の `if (et >= 3.5) { phase = PH.WARP_GROW; progPaused = false; }` の行の手前まで（`// ═══ PHASE 4:` コメント行の直前まで）が置換対象。

- [ ] **Step 2: EVENT_SING全体を新タイムラインに置換**

L1571（`// ═══ PHASE 3: EVENT_SING`）からL1688（`if (et >= 3.5)...`の行）を以下に置換:

```javascript
                // ═══ PHASE 3: EVENT_SING (50% — 5s) — 次元転換 ═══
            } else if (phase === PH.EVENT_SING) {
                eventTimer += dt;
                const et = eventTimer;

                // Step 1 (0-0.3s): 衝突フラッシュ
                if (et < 0.3) {
                    updateWin95Status('⚠ DIMENSION SHIFT DETECTED');
                    const t2 = et / 0.3;
                    bDot.position.x += (0 - bDot.position.x) * 0.3;
                    wDot.position.x += (0 - wDot.position.x) * 0.3;
                    bgMat.uniforms.u_flash.value = t2 * t2;
                    if (bloom) bloom.strength = 1.0 + t2 * 4.0;
                }

                // Step 2 (0.3-0.8s): グリッチ — win95-mainジッター + flash点滅
                if (et >= 0.3 && et < 0.8) {
                    const t2 = (et - 0.3) / 0.5;
                    bDot.visible = false; wDot.visible = false;
                    bgMat.uniforms.u_flash.value = Math.abs(Math.sin(et * 25)) * 0.6 * (1 - t2);

                    const win95 = document.getElementById('win95-main');
                    if (win95) {
                        const jx = (Math.random() - 0.5) * 14 * (1 - t2);
                        const jy = (Math.random() - 0.5) * 6 * (1 - t2);
                        win95.style.transform = `translate(${jx}px, ${jy}px)`;
                    }
                    if (bloom) bloom.strength = 1.5 + Math.abs(Math.sin(et * 30)) * 1.5;
                    updateWin95Status('⚠ REALITY.SYS CORRUPTED');
                }

                // Step 3 (0.8-0.85s): pixelRatio切り替え + フォント変更 (一回だけ)
                if (et >= 0.8 && et < 0.85) {
                    renderer.setPixelRatio(window.devicePixelRatio);
                    renderer.setSize(window.innerWidth, window.innerHeight);
                    bgMat.uniforms.u_pixelSize.value = 1.0;
                    if (yyMat.uniforms.u_pixelSize) yyMat.uniforms.u_pixelSize.value = 1.0;

                    const win95 = document.getElementById('win95-main');
                    if (win95) {
                        win95.style.transform = 'translate(0px, 0px)';
                        win95.querySelectorAll('*').forEach(el => {
                            const ff = el.style.fontFamily;
                            if (ff && (ff.includes('MS Sans Serif') || ff.includes('Tahoma'))) {
                                el.style.fontFamily = "'Courier New', monospace";
                                el.style.letterSpacing = '0.04em';
                            }
                        });
                    }
                    updateWin95Status('RELOADING DIMENSION...');
                }

                // Step 4 (0.85-1.5s): UIフリッカー → 安定
                if (et >= 0.85 && et < 1.5) {
                    const t2 = (et - 0.85) / 0.65;
                    bgMat.uniforms.u_flash.value = Math.abs(Math.sin(et * 18)) * 0.25 * (1 - t2);
                    if (bloom) bloom.strength = 1.5 - t2 * 0.5;
                }

                // Step 5 (1.5-1.7s): Flash peak + grey sphere出現
                if (et >= 1.5 && et < 1.7) {
                    bDot.visible = false; wDot.visible = false;
                    bgMat.uniforms.u_flash.value = Math.max(0, 1.0 - (et - 1.5) / 0.2);
                    bgMat.uniforms.u_grey.value = 1.0;
                    bDot.visible = true; bDot.position.set(0, 0, 0.5);
                    bDot.scale.setScalar(1.0);
                }

                // Step 6 (1.5-2.2s): grey sphere脈動
                if (et >= 1.5 && et < 2.2) {
                    const t2 = (et - 1.5) / 0.7;
                    bDot.visible = true;
                    bDot.scale.setScalar(1.0 + Math.sin(t2 * Math.PI * 3) * 0.2 * (1 - t2));
                    if (bloom) bloom.strength = 1.0 + Math.abs(Math.sin(t2 * Math.PI * 3)) * 1.5 * (1 - t2);
                }

                // Step 7 (2.0-3.0s): Yin-Yang fade-in
                if (et >= 2.0 && et < 3.0) {
                    const t2 = (et - 2.0) / 1.0;
                    bDot.visible = false;
                    yyPlane.visible = true;
                    yyMat.uniforms.u_alpha.value = Math.min(1.0, t2 * 1.5);
                    yyMat.uniforms.u_rot.value = globalTime * 1.5;
                    yyMat.uniforms.u_grey.value = 0.0;
                    if (bloom) bloom.strength = 1.5;
                }

                // Step 8 (3.0-3.5s): Yin-Yang → grey morphing
                if (et >= 3.0 && et < 3.5) {
                    const t2 = (et - 3.0) / 0.5;
                    yyPlane.visible = true;
                    yyMat.uniforms.u_grey.value = t2;
                    yyMat.uniforms.u_rot.value = globalTime * (1.5 + t2 * 8.0);
                    yyMat.uniforms.u_alpha.value = 1.0 - t2 * 0.8;
                    if (t2 > 0.4) {
                        const gt = (t2 - 0.4) / 0.6;
                        bDot.visible = true;
                        bDot.position.set(0, 0, 0.5);
                        if (!bDot.userData.greySet) {
                            bDot.material.fragmentShader = [
                                'precision highp float;',
                                'varying vec3 vNormal;',
                                'uniform float u_time;',
                                'void main(){',
                                '  vec3 N = normalize(vNormal);',
                                '  float r = length(gl_FragCoord.xy / 400.0 - vec2(1.0));',
                                '  float ring = sin(r * 60.0 - u_time * 2.0) * 0.5 + 0.5;',
                                '  float grey = 0.45 + ring * 0.08;',
                                '  float fresnel = pow(1.0 - max(dot(N, vec3(0.0,0.0,1.0)), 0.0), 3.0);',
                                '  vec3 rainbow = vec3(',
                                '    0.5+0.5*sin(fresnel*8.0+u_time),',
                                '    0.5+0.5*sin(fresnel*8.0+u_time+2.094),',
                                '    0.5+0.5*sin(fresnel*8.0+u_time+4.189)',
                                '  );',
                                '  vec3 col = mix(vec3(grey), rainbow, fresnel * 0.25);',
                                '  gl_FragColor = vec4(col, 1.0);',
                                '}'
                            ].join('\n');
                            bDot.material.needsUpdate = true;
                            bDot.userData.greySet = true;
                        }
                        bDot.scale.setScalar(gt * 1.0);
                        if (bloom) bloom.strength = 1.0 + gt * 0.5;
                    }
                    const shake = Math.sin(et * 30) * 0.015 * (1 - t2);
                    if (yyPlane.visible) yyPlane.position.x = shake;
                    if (bloom) bloom.strength = 1.5 + t2 * 2.0;
                }

                // Step 9 (3.5-4.0s): Yin-Yang消去 → tunnel born
                if (et >= 3.5 && et < 4.0) {
                    yyPlane.visible = false;
                    yyPlane.position.x = 0;
                    bDot.userData.greySet = false;
                    bgMat.uniforms.u_flash.value = Math.max(0, 1.0 - (et - 3.5) / 0.5);
                    tunnelPlane.visible = true;
                    const t2 = (et - 3.5) / 0.5;
                    tunnelMat.uniforms.u_radius.value = 0.05 + t2 * 0.15;
                    tunnelMat.uniforms.u_alpha.value = t2;
                    tunnelMat.uniforms.u_progress.value = t2 * 0.2;
                    if (bloom) bloom.strength = 4.0 * (1 - t2) + 1.5;
                }

                // Step 10 (4.0-5.0s): Tunnel安定成長
                if (et >= 4.0) {
                    const t2 = Math.min((et - 4.0) / 1.0, 1.0);
                    const pulse = 1 + Math.sin(et * 6) * 0.04;
                    tunnelMat.uniforms.u_radius.value = (0.2 + t2 * 0.05) * pulse;
                    tunnelMat.uniforms.u_alpha.value = 1.0;
                    tunnelMat.uniforms.u_progress.value = 0.2 + t2 * 0.1;
                    if (bloom) bloom.strength = 1.5;
                }

                if (et >= 5.0) { phase = PH.WARP_GROW; progPaused = false; }
```

- [ ] **Step 3: node --check**

```bash
/Users/10ta210/.nvm/versions/node/v22.22.0/bin/node --check /Users/10ta210/.gemini/antigravity/scratch/antigravity/p1_code_for_claude.js
```
Expected: 出力なし（エラーなし）

- [ ] **Step 4: コミット**

```bash
cd /Users/10ta210/.gemini/antigravity/scratch/antigravity
git add p1_code_for_claude.js
git commit -m "P1 Phase B: EVENT_SING glitch + pixelRatio switch + font change (5s sequence)"
```

---

## Task 3: Phase C — Win95 UI消滅 + プログレスバー残存 + ニュートンリング

**Files:**
- Modify: `p1_code_for_claude.js:660-882` (HTML UI追加)
- Modify: `p1_code_for_claude.js:913-916` (DOM参照追加)
- Modify: `p1_code_for_claude.js:1427-1428` (状態変数追加)
- Modify: `p1_code_for_claude.js:1430-1441` (showProg拡張)
- Modify: `p1_code_for_claude.js:1071-1089` (newtonRingMat: 動的アニメーション化)
- Modify: `p1_code_for_claude.js:1690-1699` (WARP_GROW: Phase C初期化を追加)

### Sub-task 3a: newtonRingMatをアニメーション付きに更新

現行newtonRingMatは静的グラデーション（使われていない）。これを動的ニュートンリングシェーダーに作り直す。

- [ ] **Step 1: L1071-1089のnewtonRingMat定義を確認**

L1071の `// ── 境界線: CMY/RGB静止虹色グラデーション ──` からL1089の `});` までが置換対象。

- [ ] **Step 2: newtonRingMatをアニメーション付きシェーダーに置換**

```javascript
        // ── Newton Rings (Phase C 背景 — RGBCMY動的干渉縞) ──
        const newtonRingMat = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 },
                u_alpha: { value: 0 },
                u_scale: { value: 1.0 }
            },
            vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: [
                'precision highp float;',
                'varying vec2 vUv;',
                'uniform float u_time, u_alpha, u_scale;',
                '',
                'void main(){',
                '  vec2 p = (vUv - 0.5) * 2.0 * u_scale;',
                '  float dist = length(p);',
                '',
                '  // 6波長 (R,O,Y,G,B,V) ニュートンリング r²∝nλ',
                '  float wl[6];',
                '  wl[0]=0.700; wl[1]=0.600; wl[2]=0.550;',
                '  wl[3]=0.510; wl[4]=0.470; wl[5]=0.430;',
                '',
                '  vec3 wc[6];',
                '  wc[0]=vec3(1.0, 0.05, 0.05);  // Red',
                '  wc[1]=vec3(0.0,  1.0,  1.0);  // Cyan',
                '  wc[2]=vec3(1.0,  0.0,  1.0);  // Magenta',
                '  wc[3]=vec3(0.05, 1.0, 0.05);  // Green',
                '  wc[4]=vec3(0.05,0.05,  1.0);  // Blue',
                '  wc[5]=vec3(1.0,  1.0,  0.0);  // Yellow',
                '',
                '  vec3 col = vec3(0.0);',
                '  float speed = u_time * 0.3;',
                '',
                '  for(int i=0; i<6; i++){',
                '    float n = (dist * dist) / (wl[i] * 0.4);',
                '    float phase = n * 6.28318 - speed * (1.0 + float(i) * 0.05);',
                '    float bright = pow(cos(phase * 0.5), 2.0);',
                '    col += wc[i] * bright;',
                '  }',
                '  col /= 6.0;',
                '',
                '  // 中心ほど明るく、端ほど暗く',
                '  float falloff = exp(-dist * dist * 0.8);',
                '  col *= (0.15 + falloff * 1.2);',
                '',
                '  gl_FragColor = vec4(col, u_alpha);',
                '}'
            ].join('\n'),
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
```

- [ ] **Step 3: newtonRingMatのPlaneとsceneへの追加**

L1089直後 (元の `});` の次の行) に以下を追加:

```javascript
        // newtonRingPlane は bgPlane と同サイズ (Phase Cで bgPlane の上に表示)
        const newtonRingPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(sqWorld * 6, sqWorld * 6),
            newtonRingMat
        );
        newtonRingPlane.position.z = -0.5; // bgPlaneより手前
        newtonRingPlane.visible = false;
        scene.add(newtonRingPlane);
```

### Sub-task 3b: Phase C用プログレスバーをHTMLに追加

- [ ] **Step 4: HTML末尾 (L881の`};`直前) にPhase Cプログレスバーを追加**

wrap.innerHTML のテンプレートリテラル内（L881の `` ` `` の直前）に以下を追加:

```html
<!-- Phase C プログレスバー (モダン、初期非表示) -->
<div id="phase-c-bar-wrap" style="
  display:none;
  position:fixed;
  bottom:36px;
  left:50%;
  transform:translateX(-50%);
  width:420px;
  z-index:100;
  pointer-events:none;
">
  <div style="
    font-size:10px;
    font-family:'Courier New',monospace;
    color:rgba(255,255,255,0.5);
    text-align:center;
    margin-bottom:6px;
    letter-spacing:0.1em;
  " id="phase-c-pct">LOADING REALITY... 50%</div>
  <div style="
    height:4px;
    background:rgba(255,255,255,0.08);
    border-radius:2px;
    overflow:hidden;
  ">
    <div id="phase-c-lb" style="
      width:50%;
      height:100%;
      background:linear-gradient(90deg,#00FFFF,#FF00FF,#FFFF00,#FF0000,#00FF00,#0000FF);
      background-size:400% 100%;
      animation:p1Slide 3s linear infinite;
      border-radius:2px;
    "></div>
  </div>
</div>
```

### Sub-task 3c: 状態変数・showProg拡張・DOM参照追加

- [ ] **Step 5: 状態変数にphaseCInitedフラグを追加**

L1428の `let phase = PH.ATTRACT, prog = 0, progPaused = false, eventTimer = 0, tunnelBorn = false;` を:

```javascript
        let phase = PH.ATTRACT, prog = 0, progPaused = false, eventTimer = 0, tunnelBorn = false, phaseCInited = false;
```

- [ ] **Step 6: showProg()を拡張してPhase CバーにもprogをSync**

L1430-1441 の showProg を:

```javascript
        function showProg(v) {
            const pv = Math.min(101, Math.floor(v));
            const fillPct = Math.min(100, pv);

            const barFill = document.getElementById('p1-lb');
            const handle = document.getElementById('drag-handle');
            if (barFill) barFill.style.width = fillPct + '%';
            if (handle) handle.style.left = fillPct + '%';

            const pctEl = document.getElementById('p1-lpct');
            if (pctEl) pctEl.textContent = 'Loading reality... ' + pv + '%';

            // Phase C バー同期
            const pcLb = document.getElementById('phase-c-lb');
            const pcPct = document.getElementById('phase-c-pct');
            if (pcLb) pcLb.style.width = fillPct + '%';
            if (pcPct) pcPct.textContent = 'LOADING REALITY... ' + pv + '%';
        }
```

### Sub-task 3d: tick()のnewtonRingMat時間更新追加

- [ ] **Step 7: tick()内のuniform更新にnewtonRingMatを追加**

L1451 の `// newtonRingMat は MeshBasicMaterial のため u_time 不要` の行を:

```javascript
            if (newtonRingPlane.visible) newtonRingMat.uniforms.u_time.value = globalTime;
```

### Sub-task 3e: WARP_GROW Phase C初期化

- [ ] **Step 8: WARP_GROWフェーズの先頭にPhase C初期化を追加**

L1691の `} else if (phase === PH.WARP_GROW) {` 直後に追加:

```javascript
                // Phase C初期化 (一回だけ実行)
                if (!phaseCInited) {
                    phaseCInited = true;

                    // Win95 UIをフェードアウト
                    const win95 = document.getElementById('win95-main');
                    if (win95) {
                        win95.style.transition = 'opacity 0.6s ease-out';
                        win95.style.opacity = '0';
                        setTimeout(() => {
                            if (win95) win95.style.display = 'none';
                        }, 700);
                    }
                    // タスクバー(wrap内の最初のposition:absoluteの下部div)もフェードアウト
                    // wrap.innerHTML内の<div style="position:absolute;bottom:0...">
                    if (wrap) {
                        const taskbar = wrap.querySelector('div[style*="bottom:0"]');
                        if (taskbar) {
                            taskbar.style.transition = 'opacity 0.6s ease-out';
                            taskbar.style.opacity = '0';
                            setTimeout(() => { if (taskbar) taskbar.style.display = 'none'; }, 700);
                        }
                    }

                    // Phase C プログレスバーを表示
                    const pcBar = document.getElementById('phase-c-bar-wrap');
                    if (pcBar) {
                        pcBar.style.display = 'block';
                        pcBar.style.opacity = '0';
                        pcBar.style.transition = 'opacity 0.8s ease-in';
                        setTimeout(() => { if (pcBar) pcBar.style.opacity = '1'; }, 100);
                    }

                    // bgPlaneを非表示にしてnewtonRingPlaneに切り替え
                    bgPlane.visible = false;
                    renderer.setClearColor(0x000000, 1);
                    newtonRingPlane.visible = true;
                    newtonRingMat.uniforms.u_alpha.value = 0.0;
                    newtonRingMat.uniforms.u_scale.value = 1.5;
                }

                // Newton Ring alpha をprogに応じてフェードイン
                const nrAlpha = Math.min(1.0, (prog - 50) / 15);
                newtonRingMat.uniforms.u_alpha.value = nrAlpha;
                newtonRingMat.uniforms.u_scale.value = 1.5 - (prog - 50) / 25 * 0.5;
```

- [ ] **Step 9: node --check**

```bash
/Users/10ta210/.nvm/versions/node/v22.22.0/bin/node --check /Users/10ta210/.gemini/antigravity/scratch/antigravity/p1_code_for_claude.js
```
Expected: 出力なし

- [ ] **Step 10: コミット**

```bash
cd /Users/10ta210/.gemini/antigravity/scratch/antigravity
git add p1_code_for_claude.js
git commit -m "P1 Phase C: Win95 UI fade, newton ring background, minimal progress bar"
```

---

## Task 4: Phase D — EVENT_COLLAPSE 確認 + 静寂の追加

**Files:**
- Modify: `p1_code_for_claude.js:1744-1831`

現行EVENT_COLLAPSEはほぼ仕様通り（tunnel overflow → camera warp → whiteout → solar cross → P2遷移）。Phase Cの変更でwin95-mainが既に消えているため、Step 1のUI吸収アニメーション（barWrap/pct/logoEl参照）が壊れないよう確認し、Phase Cのprogress barを正しくクリーンアップする。また「静寂」（tunnel消えた後の黒い瞬間）を追加する。

- [ ] **Step 1: EVENT_COLLAPSEのStep 1を確認**

L1754-1762を読む:
```javascript
// Step 1 (0-0.5s): UI absorbed into center
if (et < 0.5) {
    const t2 = et / 0.5, ease = t2 * t2 * t2;
    if (barWrap) { barWrap.style.transition = 'none'; ... }
    pct.style.transform = ...
    if (logoEl) { ... }
}
if (et >= 0.5 && et < 0.55) {
    if (barWrap) barWrap.style.display = 'none'; pct.style.display = 'none';
    if (logoEl) logoEl.style.display = 'none';
    ...
}
```

`barWrap`, `pct`, `logoEl` はPhase Cで既に非表示 (`display:none`) になっているが、参照自体は有効。これらはguard (`if (barWrap)`) で保護されているので問題ない。

- [ ] **Step 2: Phase Cのprogress bar (#phase-c-bar-wrap) をSTEP 1で吸収アニメーション**

L1754の `if (et < 0.5) {` ブロック内に追加:

```javascript
                // Phase C progress bar も吸収
                const pcBarWrap = document.getElementById('phase-c-bar-wrap');
                if (pcBarWrap) {
                    pcBarWrap.style.transition = 'none';
                    pcBarWrap.style.transform = `translateX(-50%) translateY(${ease * 60}px) scale(${Math.max(0.01, 1 - ease)})`;
                    pcBarWrap.style.opacity = String(Math.max(0, 1 - ease * 2));
                }
```

L1760の `if (et >= 0.5 && et < 0.55) {` ブロック内に追加:

```javascript
                    const pcBarWrap2 = document.getElementById('phase-c-bar-wrap');
                    if (pcBarWrap2) pcBarWrap2.style.display = 'none';
```

- [ ] **Step 3: 静寂の追加（tunnelが消えた後の黒い一瞬）**

現行の Step 5 (5.8-6.6s): solar cross の前に、L1808 の `if (et >= 5.8 && et < 6.6) {` の直前に静寂期間を挿入:

```javascript
                // Step 4.5 (5.0-5.8s): 静寂 — 完全な黒 (既存のwhiteOvフェードの前)
                // → 現行の Step 4 (5.0-5.8s) whiteOv フェードはそのまま維持
```

（現行はStep 4でwhiteOvをフェードインしている。5.0-5.8sがホワイトアウトなので「静寂」は5.0s以前に必要。実際には2.5-5.0sのcamera warpがtunnelで埋め尽くされており、Step 3（2.5-5.0s）のカメラ回転時が「引力に飲み込まれる」体験になっているのでこれで十分。現行構造のまま維持する。）

- [ ] **Step 4: node --check**

```bash
/Users/10ta210/.nvm/versions/node/v22.22.0/bin/node --check /Users/10ta210/.gemini/antigravity/scratch/antigravity/p1_code_for_claude.js
```
Expected: 出力なし

- [ ] **Step 5: コミット**

```bash
cd /Users/10ta210/.gemini/antigravity/scratch/antigravity
git add p1_code_for_claude.js
git commit -m "P1 Phase D: EVENT_COLLAPSE cleanup for phase-c-bar, verified P2 transition"
```

---

## Self-Review

### 1. Spec coverage

| 仕様要件 | 対応Task |
|---|---|
| Phase A (0→50%) Win95ピクセル世界 | 既存維持（変更なし）|
| Hold-to-Load廃止 → AUTO_RATE自動進行 | Task 1 |
| Phase B (50%) グリッチ演出 | Task 2 Step 2 |
| Phase B pixelRatio 0.5 → devicePixelRatio | Task 2 Step 2 (et=0.8-0.85) |
| Phase B フォント変更 (Win95→モダン) | Task 2 Step 2 (et=0.8-0.85) |
| Phase C Win95 UI消滅 | Task 3 Sub-task 3e |
| Phase C プログレスバーのみ残存 | Task 3 Sub-task 3b+3c |
| Phase C ニュートンリング展開 | Task 3 Sub-task 3a+3d+3e |
| Phase D トンネルが全要素を吸い込む | Task 4 (現行維持) |
| Phase D 白爆発→P2遷移 | Task 4 (現行維持) |
| 各段階node --check + コミット | 各Taskに含む |

### 2. Placeholder scan

なし。全ステップに実際のコードを記載済み。

### 3. Type consistency

- `newtonRingMat.uniforms.u_alpha` / `u_time` / `u_scale` — Task 3aで定義、3d/3eで参照 ✓
- `newtonRingPlane` — Task 3aで定義、3e/4で参照 ✓
- `phaseCInited` — Task 3c (L1428) で定義、3eで使用 ✓
- `phase-c-bar-wrap`, `phase-c-lb`, `phase-c-pct` — Task 3bで定義、3c/4で参照 ✓
- `AUTO_RATE[PH.XXX]` — Task 1でPHオブジェクト使用（L1427で定義済み）✓

---

## 実装後の動作確認チェックリスト

1. `http://localhost:3000/p1_index_for_claude.html` を開く
2. P0が完了してP1に遷移することを確認
3. ATTRACT (0→30%): Win95ウィンドウ内でCMY/RGBが引き合うことを確認
4. EVENT_FUSE: 自動で発動することを確認（holdingなしで）
5. DUALITY (30→50%): 自動進行することを確認
6. EVENT_SING (50%): グリッチ → pixelRatio切り替え（解像度が上がる）→ フォント変更 → yin-yang → tunnel を確認
7. WARP_GROW (50→75%): Win95 UIが消える、プログレスバーが下部に表示、ニュートンリング背景が出ることを確認
8. EVENT_BREACH/CONSUME (75→101%): 自動進行でtunnelが拡大することを確認
9. EVENT_COLLAPSE (101%): tunnel overflows → camera warp → whiteout → solar cross → P2 `inryoku:p1complete` 発火を確認
