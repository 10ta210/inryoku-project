# P3 Performance Audit — 2026-04-28

対象: `/Users/10ta210/Desktop/inryoku_hp/`
- `p3_code_for_claude.js` (5356 行)
- `p3_styles.css` (2796 行, 読みのみ)
- `p3_test.html` (P3 単体起動)
- 補助: `particle_speech_rings.js` (498 行), `particle_rings.js` (290 行)

注: 実機ベンチは取得できないため、本監査はコードリーディングと典型的な Chrome / Safari の挙動に基づく**静的見積り**。各ボトルネックには「測定推奨」を併記。シェーダ周り（`init3DLogoSphere` の `u_phaseColor / u_phaseMix / u_speechPulse`）は Codex 編集中につき**読み取りのみ・改変提案は周辺だけ**に留めた。`p3_styles.css` も同様、改変提案には含めない。

---

## 1. 概要 — 現状の体感パフォーマンス推定

### 1.1 ロード〜初回描画
- DOM 構築自体は軽い（root.innerHTML 1 回）。
- **初期化は同期で `initParticleUniverse()` を呼んでいる**（line 1324）。Three.js の WebGL コンテキスト生成 + 5,000 粒子分の Float32Array (3 本: position/color/size/phase ≒ 5000×4×4B ≒ 80KB×4) + シェーダコンパイル + 60 秒 spawn 設定が同期実行される。
  - Mac/Pixel 系 → 体感 80〜180ms 程度のメインスレッドブロック。
  - 旧 iOS Safari、Android ローエンド → 300〜600ms 級になり得る（特にシェーダコンパイル）。
- さらに `init3DLogoSphere()` を 1300ms 後に setTimeout でもう 1 つ WebGL コンテキスト + シェーダコンパイル発火。**WebGL コンテキスト 2 つ同時持ち**は iOS Safari の上限 (16 contexts、実質的に重い) と Android Chrome の context loss を呼びやすい。
- リード時間は P2→P3 の 600ms 待ち + 1200ms 後 `initBrandParticleReveal` + 1300ms 後 logo sphere → 「触れる」のは ~3〜4s 後。

### 1.2 定常時 (idle/done) のフレーム
- メインの粒子ループ `loop6()` は **毎フレーム** 5,000 粒子を for ループで JS 物理計算 → position/color/(size) `needsUpdate = true` で全 buffer 再アップロード。
  - Float32Array 60KB (position) + 60KB (color) を 60Hz で GPU へ送る ≒ **7.2MB/s** のバスバンド + JS 5,000 回 sin/cos × 数本。
  - デスクトップでも JS で 5〜9ms 食う見積り。`updateConstellations()` の **二重ループ最大 600×600 (= 36 万比較)** が乗ると合算 12〜18ms → 中位機で 60fps ボーダーぎりぎり、低位機で 30fps 落ち。
- `init3DLogoSphere` の球体ループは独立 rAF。1 本余分。
- `initLogoHologramParallax` の rAF も独立稼働。
- ロゴクリック時のチャットモードでは `for(N) {...msgNodeMap.get(i)...}` が毎フレーム回り、Map.get × N が乗る。

### 1.3 パイル感の主原因（順位）
1. constellation の near 候補 600 上限 + ペアリング二重ループ
2. 5,000 個全粒子の position/color **毎フレーム CPU 物理 + needsUpdate 全配列**
3. WebGL コンテキスト 2 個（main + logo sphere）+ Hologram parallax の独立 rAF
4. `setPixelRatio(Math.min(devicePixelRatio, 1.5))` → 司の「0.5 設定済み」と食い違う（後述）
5. 60 秒 ease-in spawn 中の `geometry.setDrawRange` は OK だが、**0〜60 秒間 audio energy + rainbow ring 全シェーダ動作中**で発光負荷は最初から MAX
6. cursor trail (mousemove ごとに `document.createElement` + `appendChild`)
7. EC カルーセル `tick()` が常時 `updateFrontCard()` で全 12 アイテムの `style.transform/filter/opacity` 文字列生成（毎フレーム）
8. `setTimeout` の階段（reveal の入れ子 6 段, allDoneTime 後の chain）。タイマー漏れ余地

### 1.4 ざっくり推定 fps
| 環境 | 推定 fps (idle) | 推定 fps (chat 中) |
|---|---|---|
| M1 Mac + Chrome | 60 | 50–60 |
| 中位 Win + Chrome (RTX 1650) | 55–60 | 35–50 |
| Pixel 6 / iPhone 13 | 40–55 | 20–35 |
| iPhone X / Android low | 25–35 | 10–20 |
| iPhone SE (1st), 古い Android | 15–25 | <10 (フリーズ寸前) |

---

## 2. Top 10 ボトルネック（優先度順）

### #1. `setPixelRatio` の値が司さん発言（0.5 設定済み）と一致していない【高インパクト・即効】
`initParticleUniverse` line 2712:
```js
renderer6.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
```
モバイル DPR 3 → **1.5** で動く。司さんが「0.5 設定済み」と認識しているのは別ファイルか古い改修。**フラグメントシェーダが重い（rainbow + halo + glow + audio modulation）ため、ピクセル数の支配が決定的。** 0.75 に下げるだけでフラグメント実行回数が約 60% に。

`init3DLogoSphere` line 445:
```js
var pxRatio = Math.min(window.devicePixelRatio || 1, 2);
```
ロゴ卵は小さい (≒ 60×60 px) のでモバイル DPR3 でも 360×360 で済むが、**シェーダが 12 極ループ + フレネル + ノイズ** で重く、画素 130k で MAX。0.75DPR で 73k に減らしてよい。

### #2. constellation の二重ループが最大 600×600 = 360,000 比較 / フレーム【高】
line 3068-3102。`nearby` 配列を 600 で打ち切るのは緩和策だが、**a, b 全ペア**を回す。実質早期終了は dist チェックのみ。spatial bin (cell hash) を入れれば 1 桁速度向上。ただし `MAX_LINES=1200` でラインキャップは効いている。

### #3. 5,000 粒子の position / color / size の毎フレーム全配列 needsUpdate【高】
line 3743-3747。`needsUpdate=true` は **配列全体を BufferData で再アップロード**。idle 時は position だけ書きかわる（color はほぼ static）にも関わらず、`bigBangState !== 'chatting'` でも color を毎フレーム書き「done→idle」レーンで 0.02 lerp → 全 N 個書き込み → needsUpdate。done 復帰中以外は不要。

### #4. WebGL コンテキスト 2 個 + 独立 rAF 3 本【中・モバイル致命】
- `loop6` (main 粒子)
- `init3DLogoSphere` の `loop`
- `initLogoHologramParallax` の `tick`
- 加えて `particle_speech_rings.js` 内にも独自 rAF が走る可能性

iOS Safari は WebGL ctx が 8 を超えると古いものが破棄される。2 個は OK だが、複数タブ切り替えで context loss の引き金になる。`initLogoHologramParallax` は WebGL 不要なのに**毎フレーム CSS 変数を 4 つ書き込む** → Style recalc を毎フレ誘発するためコスト高い。

### #5. logo sphere の SphereGeometry(1, 64, 64) 解像度過多【中】
line 592。64×64 = 約 8,000 頂点。直径 60px の卵にはオーバースペック。32×32 (≒2,000) で十分（特にモバイル）。フラグメントが重い設計なので頂点削減はそこまで効かないが、転送と頂点シェーダコストは明確に減る。

### #6. mousemove cursor trail が DOM ノード生成・削除を毎 40ms【中】
line 1394-1432。throttle 40ms = 25/s。各ノードに `box-shadow`, `will-change`, transition、800ms 後に `removeChild`。**最大 30 ノード保持**でレイヤー化はされる。が、**touch デバイスでも mousemove イベントは pointer emul で発火**するケースあり。モバイルで box-shadow 30 枚 = 合成負荷。スマホでは disable 推奨。

### #7. 60 秒 ease-in spawn は drawRange だけだが、シェーダ uniform は最初から MAX【中】
`SPAWN_DURATION=60` (line 2894)。`geometry.setDrawRange(0, vCount)` で実描画粒子は段階制御されるが、`updateConstellations()` の `vCount = floor(visibleCount)` は OK。一方 fragment の `audioGlow / rainbow ring` は粒子数によらず常時計算される。**初期 0 粒子でも shader pipeline は走る**ためここは問題なし。むしろ **60 秒も拘束される**ことで「最初は寂しい体感」のほうがブランド意図と相反する可能性（司は粒子鮮やかさ要望→ #4 とトレードオフ）。

### #8. EC カルーセル `updateFrontCard()` が 12 枚 × 文字列構築を毎フレーム【中】
line 1819-1866。`tick()` (line 1984) → `updateFrontCard()` 毎フレ。各カードに `.transform = '... ' + ...` の文字列構築 + `.filter = 'brightness(...) saturate(...) blur(...)'` を**毎フレーム再代入**。CSS 値が同一でも JS 側で文字列生成。`activeCard` を除いた 11 個に対して。Style recalc + Composite 再計算が 60Hz。

### #9. spawnBigBang / cursor trail / form-particle が CSS box-shadow ヘビー【中】
line 1409-1416 (cursor)、line 1762-1782 (bigBang)。各ドットに `box-shadow:0 0 6px <color>` × 30 個 〜 60 個。モバイル GPU でブラーは合成負荷。`box-shadow` は filter:blur や WebGL 加算合成より高コスト。

### #10. 60 秒 spawn 中 `audioContext` 未起動でも `updateAudioEnergy()` 毎フレ呼ぶ【低】
line 3391。`p3Analyser` が null の場合は早期 return しているので影響軽微。ただし audio 起動後は `getByteFrequencyData(Uint8Array(128))` を毎フレ → ~1〜2µs/frame、許容内。

#### 番外（リーク疑惑）
- `init3DLogoSphere` の `dispose()` は wrap.removeEventListener しているが、**ループの `requestAnimationFrame(loop)` の dispose 時に `alive=false` でループ自体は止まる** → OK。geo/mat/renderer dispose 済 → OK。
- `loop6` 内 `currentPhase !== 3` で dispose するが、`onMouseMove6` のみ removeListener、 `onR6` の resize、`document.mouseleave` の listener、`scrollEl.scroll`、cursor trail の `mousemove`、KONAMI keydown、`document.click` (bgmMenu close) などは**ページ寿命中残留**。SPA でページ遷移するなら問題化、現状 P3 単体起動なら無害。
- 60 秒 spawn と Brand reveal の入れ子 setTimeout は `chatTimerIds` でしか管理されておらず、**外側 (renderPhase3 直下) の setTimeout は再呼出時に重複起動の余地**。`_p3Initialized` ガードがあるので実害なし。
- `initLogoHologramParallax` は `_inryokuLogoParallaxCleanup` で再呼出時にクリーンアップ済 → OK。

---

## 3. 各ボトルネックの diff 提案

### #1 — pixelRatio を 0.75 にし、モバイルではさらに下げる

**現状** (line 2710-2714):
```js
const renderer6 = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer6.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer6.setSize(W, H);
renderer6.setClearColor(0x000000, 1);
renderer6.domElement.id = 'p6-canvas';
```

**修正提案**:
```js
const renderer6 = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
// 2026-04-28: フラグメントが重い rainbow shader のため画素削減で実効 fps 改善
// mobile=0.5 / desktop=0.75 に下げる（司発言と整合）
const _isMobile2 = (W < 768) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
renderer6.setPixelRatio(_isMobile2 ? 0.5 : 0.75);
renderer6.setSize(W, H);
renderer6.setClearColor(0x000000, 1);
renderer6.domElement.id = 'p6-canvas';
```

**logo sphere 側** (line 444-446) は Codex 編集中なので変更しないが、**もし許可があれば** 以下を提案：
```js
// 現状
var pxRatio = Math.min(window.devicePixelRatio || 1, 2);
// 提案: 卵は小さいので 1.0 で十分
var pxRatio = Math.min(window.devicePixelRatio || 1, 1.0);
```
→ 編集禁止のため未適用。Codex に伝言推奨。

---

### #2 — constellation を spatial cell hash で O(N×k) に

**現状** (line 3049-3112):
```js
function updateConstellations() {
    const posArr = geometry.attributes.position.array;
    const colArr = geometry.attributes.color.array;
    const camZ = camera6.position.z;

    const nearby = [];
    const vCount = Math.floor(visibleCount);
    for (let i = 0; i < vCount; i++) {
        const z = posArr[i * 3 + 2];
        const dz = z - camZ;
        if (dz > -150 && dz < 60) {
            nearby.push(i);
        }
        if (nearby.length >= 600) break;
    }

    let lineIdx = 0;
    const CONNECT_DIST = 70;

    for (let a = 0; a < nearby.length && lineIdx < MAX_LINES; a++) {
        const ia = nearby[a];
        const ax = posArr[ia * 3], ay = posArr[ia * 3 + 1], az = posArr[ia * 3 + 2];

        for (let b = a + 1; b < nearby.length && lineIdx < MAX_LINES; b++) {
            const ib = nearby[b];
            const bx = posArr[ib * 3], by = posArr[ib * 3 + 1], bz = posArr[ib * 3 + 2];

            const dx = ax - bx, dy = ay - by, dz2 = az - bz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz2 * dz2);

            if (dist < CONNECT_DIST) {
                ...
            }
        }
    }
    ...
}
```

**修正提案** — グリッドハッシュで近隣のみ走査:
```js
// updateConstellations の外で持つ（モジュール内 let）
const CELL = 70; // CONNECT_DIST と同じ
const _gridMap = new Map(); // key="ix,iy,iz" → number[]

function updateConstellations() {
    const posArr = geometry.attributes.position.array;
    const colArr = geometry.attributes.color.array;
    const camZ = camera6.position.z;

    const nearby = [];
    const vCount = Math.floor(visibleCount);
    // ── nearby を抽出しつつ、同時にグリッドへ登録 ──
    _gridMap.clear();
    for (let i = 0; i < vCount; i++) {
        const z = posArr[i * 3 + 2];
        const dz = z - camZ;
        if (dz > -150 && dz < 60) {
            nearby.push(i);
            const x = posArr[i*3], y = posArr[i*3+1];
            const ix = Math.floor(x / CELL);
            const iy = Math.floor(y / CELL);
            const iz = Math.floor(z / CELL);
            const k = ix + ',' + iy + ',' + iz;
            let arr = _gridMap.get(k);
            if (!arr) { arr = []; _gridMap.set(k, arr); }
            arr.push(i);
        }
        if (nearby.length >= 600) break;
    }

    let lineIdx = 0;
    const CONNECT_DIST = CELL;
    const CD2 = CONNECT_DIST * CONNECT_DIST;

    for (let a = 0; a < nearby.length && lineIdx < MAX_LINES; a++) {
        const ia = nearby[a];
        const ax = posArr[ia*3], ay = posArr[ia*3+1], az = posArr[ia*3+2];
        const ix = Math.floor(ax / CELL);
        const iy = Math.floor(ay / CELL);
        const iz = Math.floor(az / CELL);
        // 自セル + 隣接 26 セルだけ走査
        for (let dx = -1; dx <= 1 && lineIdx < MAX_LINES; dx++) {
            for (let dy = -1; dy <= 1 && lineIdx < MAX_LINES; dy++) {
                for (let dz_ = -1; dz_ <= 1 && lineIdx < MAX_LINES; dz_++) {
                    const cell = _gridMap.get((ix+dx) + ',' + (iy+dy) + ',' + (iz+dz_));
                    if (!cell) continue;
                    for (let bb = 0; bb < cell.length && lineIdx < MAX_LINES; bb++) {
                        const ib = cell[bb];
                        if (ib <= ia) continue; // ペアの重複除去
                        const bx = posArr[ib*3], by = posArr[ib*3+1], bz = posArr[ib*3+2];
                        const ddx = ax-bx, ddy = ay-by, ddz = az-bz;
                        const d2 = ddx*ddx + ddy*ddy + ddz*ddz;
                        if (d2 < CD2) {
                            const dist = Math.sqrt(d2);
                            const fade = Math.pow(1.0 - dist / CONNECT_DIST, 2.5);
                            const li = lineIdx * 6;
                            linePositions[li]   = ax; linePositions[li+1] = ay; linePositions[li+2] = az;
                            linePositions[li+3] = bx; linePositions[li+4] = by; linePositions[li+5] = bz;
                            var ar = colArr[ia*3], ag = colArr[ia*3+1], ab = colArr[ia*3+2];
                            var br_ = colArr[ib*3], bg = colArr[ib*3+1], bb_ = colArr[ib*3+2];
                            var aBright = Math.max(ar, ag, ab, 0.3);
                            var bBright = Math.max(br_, bg, bb_, 0.3);
                            lineColors[li]     = (ar / aBright) * fade;
                            lineColors[li + 1] = (ag / aBright) * fade;
                            lineColors[li + 2] = (ab / aBright) * fade;
                            lineColors[li + 3] = (br_ / bBright) * fade;
                            lineColors[li + 4] = (bg / bBright) * fade;
                            lineColors[li + 5] = (bb_ / bBright) * fade;
                            lineIdx++;
                        }
                    }
                }
            }
        }
    }

    for (let i = lineIdx * 6; i < MAX_LINES * 6; i++) {
        linePositions[i] = 0;
        lineColors[i] = 0;
    }

    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate = true;
    lineGeo.setDrawRange(0, lineIdx * 2);
}
```
**期待効果**: idle で 600^2/2 = 180k 比較 → 各セル平均 ~600/(球状半径 480 / 70 = 7^3 セル) = ~2 個 × 27 セル = 54 比較 / 候補 → 32k 比較 (約 1/6)。実機で 3〜5ms 短縮見込み。

**追加：**さらに `updateConstellations()` を**毎フレームでなく 2 フレームに 1 回**にする (line 3750):
```js
// 現状
updateConstellations();
// 修正
if ((window._loop6FrameCount & 1) === 0) updateConstellations();
```
30Hz 更新でも twinkle は shader 側 `uTime * 0.8` で 60Hz 補完、目視差なし。

---

### #3 — color/aSize の needsUpdate を必要時のみ

**現状** (line 3743-3747):
```js
geometry.attributes.position.needsUpdate = true;
geometry.attributes.color.needsUpdate = true;
if (bigBangState === 'chatting' && chatSpeaking) {
    geometry.attributes.aSize.needsUpdate = true;
}
```

**修正提案**:
```js
// position は毎フレ書きかわるので必須
geometry.attributes.position.needsUpdate = true;
// color は state により必要なときだけ
const colorDirty = bigBangState === 'absorb' ||
                   bigBangState === 'chatting' ||
                   bigBangState === 'bb_collapse' ||
                   bigBangState === 'bb_explode' ||
                   bigBangState === 'done';
if (colorDirty) geometry.attributes.color.needsUpdate = true;

// aSize は chat / absorb / bb_explode のみ
const sizeDirty = bigBangState === 'absorb' ||
                  bigBangState === 'chatting' ||
                  bigBangState === 'bb_explode' ||
                  bigBangState === 'done'; // origSize 復元中
if (sizeDirty) geometry.attributes.aSize.needsUpdate = true;
```
**期待効果**: idle 時のバスバンド 60KB×60Hz → 0。GPU upload 削減で 1〜2ms 改善見込み。

加えて、line 3736-3740 の `done` レーンの color lerp は完了後 (差分が十分小さい時) に**dirty を落とす**仕組みを追加：
```js
if (bigBangState === 'done') {
    let totalDiff = 0;
    // 全粒子をなめて色差分を見るのは重いので、最初の 1 個だけサンプリング
    const i0 = 0;
    totalDiff = Math.abs(origColArr[i0*3] - colArr[i0*3])
              + Math.abs(origColArr[i0*3+1] - colArr[i0*3+1])
              + Math.abs(origColArr[i0*3+2] - colArr[i0*3+2]);
    if (totalDiff < 0.01) {
        // 復元完了 → 状態を idle へ移して以降の毎フレ書き込みを止める
        for (let j = 0; j < origColArr.length; j++) colArr[j] = origColArr[j];
        // 既に line 3487 で setTimeout 後に idle 化される予定なので、強制移行は不要
        // ただし needsUpdate は明示的に false 維持にする
    }
}
```
（既存タイマと衝突しないよう監視のみで実装は控えめ）

---

### #4 — ロゴパララックスの style.setProperty 毎フレ書きを 30Hz に

**現状** (line 818-832):
```js
function tick() {
    if (!running) return;
    currentX += (targetX - currentX) * 0.075;
    currentY += (targetY - currentY) * 0.075;
    wrap.style.setProperty('--holo-tilt-y', (currentX * 7).toFixed(3) + 'deg');
    wrap.style.setProperty('--holo-tilt-x', (-currentY * 5).toFixed(3) + 'deg');
    wrap.style.setProperty('--holo-shift-x', (currentX * 1.8).toFixed(3) + 'px');
    wrap.style.setProperty('--holo-shift-y', (currentY * 1.2).toFixed(3) + 'px');
    raf = requestAnimationFrame(tick);
}
```

**修正提案** — diff が無視できるサイズなら書き込まない + 偶数フレームだけ書く:
```js
let _parTickN = 0;
let _parLastX = 999, _parLastY = 999;
function tick() {
    if (!running) return;
    currentX += (targetX - currentX) * 0.075;
    currentY += (targetY - currentY) * 0.075;
    _parTickN++;
    // 30Hz / 0.0008 以上の差分のみ書き込み（モバイル style recalc 削減）
    if ((_parTickN & 1) === 0) {
        if (Math.abs(currentX - _parLastX) > 0.0008 || Math.abs(currentY - _parLastY) > 0.0008) {
            wrap.style.setProperty('--holo-tilt-y', (currentX * 7).toFixed(2) + 'deg');
            wrap.style.setProperty('--holo-tilt-x', (-currentY * 5).toFixed(2) + 'deg');
            wrap.style.setProperty('--holo-shift-x', (currentX * 1.8).toFixed(2) + 'px');
            wrap.style.setProperty('--holo-shift-y', (currentY * 1.2).toFixed(2) + 'px');
            _parLastX = currentX; _parLastY = currentY;
        }
    }
    raf = requestAnimationFrame(tick);
}
```

加えて `prefers-reduced-motion: reduce` 以外にも、**マウスが動いていない**時に rAF 自体停止するべき:
```js
function onPointerMove(e) {
    setTargetFromPoint(e.clientX, e.clientY);
    if (!running || !raf) { running = true; raf = requestAnimationFrame(tick); }
    _idleSince = performance.now();
}
let _idleSince = performance.now();
function tick() {
    if (!running) return;
    // 静止 1.5s でループ自体停止（大きく削減）
    if (performance.now() - _idleSince > 1500
        && Math.abs(targetX - currentX) < 0.001
        && Math.abs(targetY - currentY) < 0.001) {
        raf = 0;
        return;
    }
    ...
}
```

---

### #5 — logo sphere の geometry を 32×32 に

**現状** (line 592):
```js
var geo = new THREE.SphereGeometry(1, 64, 64);
```
（Codex 編集中ファイルゾーンの直近、ただし geo 行自体は uniforms / shader と独立）

**修正提案** (もし Codex 許可があれば):
```js
// 卵は 60〜90px で表示されるため 64x64 は過剰。32x32 で頂点 1/4。
var geo = new THREE.SphereGeometry(1, 32, 32);
```
**期待効果**: 頂点 ~8000 → ~2000、頂点シェーダ 1/4。フラグメントが支配的なため全体は 5〜10% 改善程度だが、初期化時間は明確に短縮。

---

### #6 — cursor trail をモバイルで無効化

**現状** (line 1394):
```js
document.addEventListener('mousemove', function(e) {
    var now = Date.now();
    if (now - _cursorLastSpawn < _CURSOR_THROTTLE) return;
    ...
});
```

**修正提案**:
```js
// タッチ主体デバイスではカーソル trail を出さない（pointer 模倣の mousemove で大量発火を回避）
var _isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
var _prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!_isTouchDevice && !_prefersReduce) {
    document.addEventListener('mousemove', function(e) {
        var now = Date.now();
        if (now - _cursorLastSpawn < _CURSOR_THROTTLE) return;
        // ...既存処理...
    });
}
```
さらに `_CURSOR_THROTTLE` を 40ms → 60ms に。box-shadow を `box-shadow: 0 0 6px <c>` → `filter: drop-shadow(...)` は逆効果なので**そのままでよい**が、サイズを 3px → 2.5px に：
```js
'width:2.5px;height:2.5px;border-radius:50%;' +
'background:' + color + ';' +
'opacity:0.7;' +
'box-shadow:0 0 4px ' + color + ';' +  // 6 → 4
```

---

### #7 — 60 秒 spawn を 30 秒に短縮 / ease 緩和

**現状** (line 2894):
```js
const SPAWN_DURATION = 60.0; // 秒
```
60 秒は長すぎ。最初の 5 秒は `eased = 5^3/60^3 ≒ 0.06%` → 3 粒子しか出ない。司の「数減らして」「鮮やかさ消えた」と合わせると、**初期可視粒子数を増やして spawn を短く**するのが筋。

**修正提案**:
```js
// 最初から 20% は表示、残り 80% を 30 秒で出す（暗闇からの覚醒は 5 秒で全体 50%）
const SPAWN_DURATION = 30.0;
const SPAWN_INITIAL = 0.20;
let visibleCount = N * SPAWN_INITIAL;
geometry.setDrawRange(0, Math.floor(visibleCount));
// ループ内
if (visibleCount < N) {
    spawnElapsed += dt;
    var t = Math.min(spawnElapsed / SPAWN_DURATION, 1.0);
    var eased = t * t; // cubic → quad に緩和
    visibleCount = (SPAWN_INITIAL + (1 - SPAWN_INITIAL) * eased) * N;
    if (visibleCount > N) visibleCount = N;
    geometry.setDrawRange(0, Math.floor(visibleCount));
}
```
※ 体感は上がるが「最初は寂しく後から鮮やか」という意図と相反するので**司確認推奨**。

---

### #8 — カルーセルの style 書き込みをキャッシュ + 偶数フレ化

**現状** (line 1819-1866):
```js
function updateFrontCard() {
    var bestIdx = 0;
    var bestDist = 999;
    items.forEach(function(item, i) {
        ...
        item.style.transform = 'rotateY(' + angle + 'deg) translateZ(' + RING_Z + 'px) translateY(' + lift.toFixed(2) + 'px) scale(' + scale.toFixed(3) + ')';
        item.style.opacity = opacity.toFixed(3);
        item.style.filter  = 'brightness(' + brightness.toFixed(2) + ') saturate(' + saturate.toFixed(2) + ') blur(' + blur.toFixed(2) + 'px)';
        ...
    });
    ...
}
```

**修正提案**:
```js
// 各カードの最終文字列をキャッシュ。同値ならスキップ。
var _cardCache = items.map(function() { return { tf: '', op: '', ft: '' }; });

function updateFrontCard() {
    var bestIdx = 0;
    var bestDist = 999;

    items.forEach(function(item, i) {
        var itemAngle = ((i * sliceAngle + currentAngle) % 360 + 360) % 360;
        if (itemAngle > 180) itemAngle -= 360;
        var absDist = Math.abs(itemAngle);

        if (absDist < bestDist) {
            bestDist = absDist;
            bestIdx = i;
        }

        if (item === activeCard) return;

        var t = absDist / 180;
        var ease = t * t * (3 - 2 * t);
        var scale      = 1.0  - ease * 0.28;
        var opacity    = 1.0  - ease * 0.65;
        var brightness = 1.35 - ease * 0.80;
        var saturate   = 1.15 - ease * 0.55;
        var blur       = ease * 2.2;
        var lift       = -Math.sin(itemAngle * Math.PI / 180) * 6;
        var angle      = i * sliceAngle;

        var tf = 'rotateY(' + angle.toFixed(1) + 'deg) translateZ(' + RING_Z + 'px) translateY(' + lift.toFixed(1) + 'px) scale(' + scale.toFixed(2) + ')';
        var op = opacity.toFixed(2);
        var ft = 'brightness(' + brightness.toFixed(2) + ') saturate(' + saturate.toFixed(2) + ') blur(' + blur.toFixed(1) + 'px)';

        var c = _cardCache[i];
        if (c.tf !== tf) { item.style.transform = tf; c.tf = tf; }
        if (c.op !== op) { item.style.opacity = op; c.op = op; }
        if (c.ft !== ft) { item.style.filter = ft; c.ft = ft; }

        if (absDist < sliceAngle * 0.55) {
            item.classList.add('carousel-front');
        } else {
            item.classList.remove('carousel-front');
        }
    });

    if (bestIdx !== currentFrontIdx) {
        currentFrontIdx = bestIdx;
        startTypewriter(bestIdx);
    }
}
```
桁数を toFixed(2) に削ったことで、ぴたっと止まったときの差分なし判定が効きやすくなる。**Style recalc が発火する DOM write が 30〜50% 削減される。**

加えて `tick()` (line 1984) で `updateFrontCard()` を毎フレ呼んでいるが、**ring の transform は毎フレ必要だがカードの位置補正は 30Hz で十分**:
```js
// tick() 内、最後の updateFrontCard 呼び出し
if ((window._loop6FrameCount & 1) === 0) updateFrontCard();
// ↑ ただしこれは loop6 のカウンタ。カルーセル独自カウンタが安全
var _carTickN = 0;
function tick() {
    _carTickN++;
    ...
    ring.style.transform = 'rotateY(' + currentAngle + 'deg)';
    if ((_carTickN & 1) === 0) updateFrontCard();
    autoRotateId = requestAnimationFrame(tick);
}
```

---

### #9 — bigBang particle / cursor の box-shadow 抑制

`spawnBigBang` line 1762:
```js
'box-shadow:0 0 ' + (size * 3) + 'px ' + c + ';' +
```
**修正提案** — モバイルでは shadow を切る:
```js
var _bgIsMobile = window.innerWidth < 768;
var bgShadow = _bgIsMobile ? '' : 'box-shadow:0 0 ' + (size * 3) + 'px ' + c + ';';
dot.style.cssText = 'left:' + x + 'px;top:' + y + 'px;' +
    'width:' + size + 'px;height:' + size + 'px;' +
    'background:' + c + ';' +
    bgShadow +
    '--bx:' + bx.toFixed(0) + 'px;--by:' + by.toFixed(0) + 'px;';
```

---

### #10 — 背景タブで loop6 を 32ms から大幅減

**現状** (line 3758):
```js
if (document.hidden) {
    setTimeout(() => loop6(performance.now()), 32);
} else {
    requestAnimationFrame(loop6);
}
```
バックグラウンドで 30Hz は無駄。バッテリ食う。`document.hidden` 時は 1Hz でも shader は再描画される必要なし。

**修正提案**:
```js
if (document.hidden) {
    // 背景時は 1 秒間隔で生存確認のみ（描画も skip）
    setTimeout(() => loop6(performance.now()), 1000);
    return; // render skip
} else {
    requestAnimationFrame(loop6);
}
```
ただし return 位置の都合で render 直前に hidden 判定するほうが自然:
```js
// 既存の renderer.render の後
if (composer6) composer6.render(); else renderer6.render(scene6, camera6);
if (document.hidden) {
    setTimeout(() => loop6(performance.now()), 800);
} else {
    requestAnimationFrame(loop6);
}
```
**いまの loop6 は描画は通常通りやってから setTimeout(32)** している。これを「hidden なら描画も skip」にしたい場合:
```js
const hidden = document.hidden;
if (!hidden) {
    if (composer6) composer6.render(); else renderer6.render(scene6, camera6);
}
if (hidden) {
    setTimeout(() => loop6(performance.now()), 800);
} else {
    requestAnimationFrame(loop6);
}
```

---

### #11（番外） — Audio reactive の getByteFrequencyData をミュート時 skip

**現状** (line 3391):
```js
updateAudioEnergy();
const targetEnergy = p3AudioEnergy;
const currentEnergy = material.uniforms.uAudioEnergy.value;
material.uniforms.uAudioEnergy.value += (targetEnergy - currentEnergy) * 0.15;
```

**修正提案**:
```js
if (!window._inryokuMuted && p3Analyser) {
    updateAudioEnergy();
}
const targetEnergy = window._inryokuMuted ? 0 : p3AudioEnergy;
const currentEnergy = material.uniforms.uAudioEnergy.value;
material.uniforms.uAudioEnergy.value += (targetEnergy - currentEnergy) * 0.15;
```
副作用ほぼなし、CPU 微減。

---

## 4. 計測方法の推奨

### 4.1 Chrome DevTools Performance タブ
1. P3 単体起動 (`p3_test.html`)。
2. DevTools > Performance > 録画開始 (CPU 4× throttle, Network Slow 4G ON でモバイルシミュ)。
3. 「ビッグバン」ロゴクリック → チャット表示までを 8 秒録画。
4. 確認ポイント:
   - **Long Tasks** (>50ms) → 初期化と setupBlock がそれ。
   - **Frames セクション** で fps の谷を見る。idle / chat / absorb 各ステートで断面を取る。
   - Bottom-Up で `loop6 / updateConstellations / updateFrontCard` の self time。
   - 「Layout / Recalculate Style」が増える時間 → カルーセルか hologram parallax の犯人。

### 4.2 Performance API（コードを汚さず軽量に）
`p3_test.html` の `<script>` ブロック末尾、`renderPhase3()` の前後に:
```js
performance.mark('p3-start');
renderPhase3();
performance.mark('p3-after-render');
performance.measure('p3-init', 'p3-start', 'p3-after-render');

// loop6 の毎フレーム計測
window._fpsBuf = [];
let _lastT = performance.now();
function _fpsTick() {
    const now = performance.now();
    const dt = now - _lastT; _lastT = now;
    window._fpsBuf.push(1000 / dt);
    if (window._fpsBuf.length > 600) window._fpsBuf.shift();
    requestAnimationFrame(_fpsTick);
}
requestAnimationFrame(_fpsTick);

// 30 秒後にレポート
setTimeout(() => {
    const buf = window._fpsBuf;
    const avg = buf.reduce((a,b)=>a+b,0)/buf.length;
    const sorted = [...buf].sort((a,b)=>a-b);
    const p1  = sorted[Math.floor(sorted.length*0.01)];
    const p50 = sorted[Math.floor(sorted.length*0.5)];
    console.log('[P3 fps] avg=' + avg.toFixed(1) + ' median=' + p50.toFixed(1) + ' p1(low)=' + p1.toFixed(1));
}, 30000);
```

### 4.3 Three.js renderer.info
ループ末尾で抜き取り:
```js
if (window._loop6FrameCount % 120 === 0) {
    console.log('[three]', renderer6.info.render.calls, 'calls,',
                renderer6.info.render.triangles, 'tri,',
                renderer6.info.memory.geometries, 'geo,',
                renderer6.info.memory.textures, 'tex');
}
```
- triangles が想定より多ければシェーダ over-draw 確認。
- geometries が増え続けるならリーク（rebuildLineMesh が dispose 漏れ等）。

### 4.4 GPU プロファイラ
- Chrome `chrome://tracing` の `disabled-by-default-gpu.service` カテゴリで GPU フレーム時間。
- Safari Web Inspector → Graphics Inspector で WebGL コール一覧。
- iOS Safari リモートデバッグ → Timelines > Frames。

### 4.5 メモリ
- DevTools > Memory > Heap snapshot を 3 回取る (起動直後 / 1 分 / 5 分)。
- `Detached HTMLDivElement` が増え続けていれば cursor trail or bigBang particle 漏れ。
- `WebGLBuffer` の数が増え続けていれば lineMesh 再構築での dispose 漏れ。

---

## 5. 副作用なしで効果が見込まれる Quick Wins 3 つ

ブランド体験・ビジュアル意図を**1 ピクセルも変えない**順に。

### Quick Win A — `#10` 背景タブの skip 描画
- 影響範囲: タブ非表示時のみ。ユーザーは見えない。
- バッテリ消費削減、サーマルスロット回避。CPU 30Hz × 5,000 粒子計算が 1Hz に。
- 実装は loop6 末尾の 1 行差し替え。

### Quick Win B — `#3` color/aSize の needsUpdate を必要時のみ
- 影響範囲: idle 時の GPU 転送 60KB×60Hz が消える。視覚は完全同一（書き換えていない値を upload しないだけ）。
- 実装は state 判定 4 行追加。

### Quick Win C — `#11` ミュート時の getByteFrequencyData skip
- 影響範囲: 司さんはデフォルトでミュート (`window._inryokuMuted = true` line 117) で起動するため、このパスがほぼ常時無音。`p3FreqData` が全 0 のままだから視覚的にも同一。
- 実装は 1 関数 1 if 追加。

---

## 補足: 司さんへ伝えたい 3 つの判断ポイント

1. **#5 logo sphere geometry 64→32 と #1 logo sphere DPR 削減** は Codex が編集中の同一関数内なので、Codex に「`SphereGeometry(1, 32, 32)` と `pxRatio = 1.0` で OK か」確認を取った上で適用するのが安全。
2. **#7 spawn 60 秒短縮** は美学方針 ("間" の演出) と直結する。技術的には強く推奨だが、ブランド意図 (5 秒の暗闇 → ぽつぽつ → 全宇宙) を捨てる判断。データを残し**司さん判断扱い**にした。
3. **#4 hologram parallax** は P3 で常時稼働しており、ロゴ周りに視覚効果が乗っている。30Hz 化は気付かれないが、**マウス静止時に rAF 自体停止**させると iPad/iPhone の電池でかなり差が出る。

---

## まとめ表（影響と工数）

| # | 項目 | 改善幅 (推定) | 副作用 | 工数 |
|---|---|---|---|---|
| 1 | DPR 0.75/0.5 | **大** (+15〜30% fps) | 微シャープ低下 | 5 分 |
| 2 | constellation grid hash + 30Hz | 中 (+5〜10% fps) | なし (twinkle 60→30Hz) | 30 分 |
| 3 | needsUpdate 限定化 | 中 (+3〜8% fps モバイル) | なし | 5 分 |
| 4 | parallax 30Hz + idle 停止 | 小〜中 | なし | 15 分 |
| 5 | sphere geo 64→32 | 小 | なし (60px なら不可視) | 1 分 (Codex 確認後) |
| 6 | cursor trail mobile off | 中 (タッチ機) | trail なし (元々 mouse 専用) | 5 分 |
| 7 | spawn 60→30s | n/a (UX) | 司確認 | 5 分 |
| 8 | カルーセル style キャッシュ | 中 (+3〜5% fps) | なし | 15 分 |
| 9 | box-shadow mobile off | 小 | shadow 消失 | 5 分 |
| 10 | hidden で 800ms slow | バッテリ | なし | 2 分 |
| 11 | mute 時 audio skip | 微 | なし | 2 分 |

すべて適用で**モバイル fps +30〜50%**、デスクトップ fps +10〜20% を見込む。

---

以上。**実測ベンチは未取得なので、Quick Wins A/B/C を入れた上で 4.2 のスニペットで before/after 取って効果検証推奨。**
