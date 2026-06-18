# Codex 申送り — inryokü 粒子分布リバランス + 幻想的演出強化ハンドオフ

**作成日:** 2026-04-29
**作成者:** Claude (Opus 4.7 1M context) — 設計・申送り担当
**実装担当:** Codex
**対象ファイル（hot）:** `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js`
**触らない:** すべて読み取り専用で書いた本書。Codex 着手時に当該ファイルを編集する。
**Three.js バージョン:** 0.160（`vendor/three.min.js`、UMD 単体配布）
**前提シェーダー / Bloom 状態:** Codex 直近実装の **UnrealBloomPass + log-normal 90/10 サイズ分布 + 6 純色パレット** が hot 入りしている前提（`p3_code_for_claude.js:2737-2887` 周辺）。

**根拠ドキュメント（本書の上流）:**
- `docs/codex-shader-handoff-2026-04-29.md`（前回ハンドオフ・bloom/HDR/log-normal の起点）
- `docs/particle-cheap-diagnosis-2026-04-29.md`（「安っぽい」原因 10 個）
- `docs/light-emission-research-2026-04-29.md`（光の物理・技法カタログ）
- `docs/fantastical-research-2026-04-29.md`（並走 agent、幻想的演出の参考。後参照可）

---

## 0. 読む前に — このハンドオフの位置づけ

前回ハンドオフ（codex-shader-handoff-2026-04-29.md）で Codex が **UnrealBloomPass の復活 + シェーダー簡素化 + log-normal 90/10 サイズ分布** を実装した。
画面は確かに「光る」ようになった。が、司さんからのフィードバックは **2 点**:

1. **「もっとバランス変えて、最高に幻想的に」** — 現状 90/10 では「小粒の海に巨大粒が点在」する単調さが残る。中間層が痩せている。
2. **「現状粒子が少なく見える」** — N = 2200 / 4200 では、bloom threshold を上げた瞬間に「光らない暗粒子」が背景に溶けて、視覚的密度が落ちている。

この 2 点を、**3 層分布化** + **総数 1.5〜2x** + **動きの多様化** + **観測者対話** + **流れ星** の 10 改修で解く。
**派手にしない。grey 美学を壊さない。CMYRGB は維持。観測者哲学（50→101）に沿う。**

Codex 判断指針:
- 迷ったら「**密度ではなく階層**」「**スピードではなく呼吸**」「**主役の存在感は数ではなく光の質**」を選ぶ。
- 「幻想的」= 「3 層が同時に存在し、観測者の視線で前後する」。**派手な発光ではない。**

---

## 1. エクゼクティブサマリ — 10 改修依頼の俯瞰

### 1.1 結論先出し

> 現状の log-normal 90/10 は「巨大粒は少なく、小粒は均一」を実現するには優秀だが、**「中景」が定義されていない**。粒子は 2 種しかない。これを **三項分布（小 50% / 中 35% / 大 15%）** に置き換え、各層に **役割（背景・中景・主役）** と **色配分・動き・bloom 反応性** を持たせる。さらに **総数を 1.7x**（2200→3700 / 4200→7100）、**Brownian + Levy + 軌道** の 3 種運動、**流れ星** の発火、**観測者依存の発光**（既存 observerFocus を視野中心スポットに拡張）を追加。
>
> 体感の変化は「**世界が呼吸している。深い。生きている**」。
> 派手さは増えない。**奥行きと階層**が増える。

### 1.2 10 改修依頼マトリクス

| # | 改修 | レイヤー | インパクト | 工数 | 依存 | 優先 |
|---|------|---------|-----------|------|------|------|
| 1 | 三層粒子分布（50/35/15） | 生成 | ★★★★★ | 0.2 日 | なし | **P0** |
| 2 | 粒子総数 1.5〜2x | 生成 | ★★★★ | 0.05 日 | なし | **P0** |
| 3 | 色配分の幻想化（grey復活 + 意味的配色） | 生成 | ★★★★ | 0.25 日 | #1 | **P0** |
| 4 | 動きの多様化（Brownian / Levy / 軌道 / 流れ星） | 更新ループ | ★★★★ | 0.6 日 | #1 | **P1** |
| 5 | 深度・視差（z 層 + mouse parallax） | 更新ループ | ★★★ | 0.4 日 | #1 | **P1** |
| 6 | Constellation 線の改修 | LineSegments | ★★★ | 0.5 日 | #1 | **P2** |
| 7 | 観測者と粒子の対話（hover / scroll / chat） | 更新ループ | ★★★★ | 0.6 日 | #5 | **P2** |
| 8 | 流れ星イベント | LineSegments | ★★★ | 0.4 日 | #4 | **P2** |
| 9 | bloom パラメータ再調整 | composer | ★★★★ | 0.1 日 | #1 | **P1** |
| 10 | 哲学的接続（視野中心の発光） | uniform | ★★★ | 0.4 日 | #5, #9 | **P2** |

合計工数見積: **3.5 人日**（テスト・実機検証込み 4.0 人日）

### 1.3 実装順序の推奨

```
[Day 1 午前] #1 三層分布 + #2 総数 + #3 色配分 + #9 bloom 再調整
[Day 1 午後] 実機目視（M1 / iPhone 13 / Pixel 6）— 静止状態の見え方確定
[Day 2 午前] #4 動きの多様化（Brownian + Levy + 軌道のみ。流れ星は #8 で別出し）
[Day 2 午後] #5 深度・視差（near/mid/far の z 構造化、mouse parallax）
[Day 3 午前] #6 Constellation 線 + #8 流れ星
[Day 3 午後] #7 hover / scroll / chat 反応 + #10 視野中心発光
[Day 4 午前] 実機検証（旧端末・低 GPU）+ FPS 監査
[Day 4 午後] 司さん確認、微調整
```

依存:
- #1〜#3 は同時に決める（粒子の「形」を確定させる Day 1）
- #4〜#5 は #1 に乗っかる（粒子の役割が決まらないと動きが決まらない）
- #6〜#8 は装飾層。先に粒子本体を決めないと発火タイミングが決まらない
- #7 と #10 は uniform 連動（observerFocus, viewCenter）でロジックを共有
- #9 は #1 完了直後に必ず再調整（threshold が古いと主役が光らない）

### 1.4 触らない原則（再掲）

- `particle_rings.js`, `particle_rings.css`, `particle_speech_rings.js`, `particle_canon_meta.js`（Codex 領域だが本ハンドオフ外）
- `index.html` の vendor 設定、importmap（前回ハンドオフで確定済み）
- bloom 復活コード本体（前回ハンドオフ Task 1 で完了済み）
- ai-chat 関連（chat 状態 → 粒子への入力は #7 で「読み取り」のみ）

---

## 2. 改修依頼 1 — 三層粒子分布

### 2.1 哲学

> **inryokü の宇宙には「層」がある。観測者の意識は層をまたぐ。**

- **小（背景層）**: 大気、塵、ノイズ。**ほぼ見えない**。だが「ある」。
- **中（中景層）**: 「気配」。動き、揺らぎ、生命の輪郭。
- **大（主役層）**: 「現れた魂」。観測者が見つめた瞬間に強く光る。

90/10 では「中景」が痩せる。**中景こそが幻想性の本体**。中景が豊かだと「世界が満ちている」と感じる。

### 2.2 確率分布の仕様

```js
// 三項分布（piecewise）。log-normal は層内のサイズばらつきに使う。
// 50% 小 / 35% 中 / 15% 大

function classifyTier(rng) {
    const r = rng();
    if (r < 0.50) return 0;   // 小（背景）
    if (r < 0.85) return 1;   // 中（中景）
    return 2;                 // 大（主役）
}

// 層ごとに異なる log-normal パラメータ
const TIER_SIZE = [
    { mu: -0.40, sigma: 0.22, min: 0.40, max: 0.80 },  // 小: 0.40〜0.80
    { mu:  0.10, sigma: 0.28, min: 0.80, max: 1.60 },  // 中: 0.80〜1.60
    { mu:  0.75, sigma: 0.32, min: 1.60, max: 3.20 },  // 大: 1.60〜3.20
];

function tierSize(tier, rng, gauss) {
    const t = TIER_SIZE[tier];
    const ln = Math.exp(t.mu + gauss() * t.sigma);
    return Math.max(t.min, Math.min(t.max, ln));
}
```

**注意**: 前回 Codex 実装の `aSizes[i] = Math.max(1.4, Math.min(10.5, logn))` の **clamp 値（1.4〜10.5）** は **vertex shader 側の `gl_PointSize = aSize * (344.0 / -mvPos.z)` 計算と一体**。三層化に伴って vertex 側の係数を再調整する必要がある（**改修依頼 9** で扱う）。

### 2.3 サイズの自然なグラデ

層境界（0.80, 1.60）は **bin の縁** ではなく **重なり**。隣接層で同じサイズが出ても良い設計にする。

```js
// 推奨: 層内 log-normal が自然に重なるよう sigma を大きめに取る
// 結果: 0.78 の中粒、0.82 の小粒、が同居しても境界が見えない
```

### 2.4 attribute の追加

各粒子の **層番号** を vertex shader に渡す（fragment で発光制御に使う）:

```js
const aTier = new Float32Array(N);   // 0/1/2
// ...生成ループ内
aTier[i] = tier;
// ...
geometry.setAttribute('aTier', new THREE.BufferAttribute(aTier, 1));
```

vertex shader で `attribute float aTier;` 受けて、fragment へ `varying float vTier;` で渡す（**改修依頼 9** の bloom 反応性と接続）。

### 2.5 想定される副作用

- 中景が増えると **平均輝度が上がる**。bloom threshold を 0.34 → 0.55 程度まで引き上げる必要がある（**改修依頼 9**）。
- 小粒は **gl_PointSize 1.55 の min clamp** にひっかかって「全部同じサイズに見える」恐れ。**vertex shader 側の min を 1.0 に下げる**。

---

## 3. 改修依頼 2 — 粒子総数の見直し

### 3.1 現状の確認

`p3_code_for_claude.js:2737-2739`:
```js
const isMobile = W < 768;
const N = isMobile ? 2200 : 4200;
```

### 3.2 提案

```js
const isMobile = W < 768;
const isLowEnd = navigator.hardwareConcurrency <= 4 || /Android.*(Pixel [123]|SM-G9)/i.test(navigator.userAgent);
const N = isLowEnd ? 2400 : (isMobile ? 3700 : 7100);
```

| 環境 | 旧 N | 新 N | 倍率 |
|------|------|------|------|
| デスクトップ | 4200 | 7100 | 1.69x |
| モバイル | 2200 | 3700 | 1.68x |
| 低 GPU | (2200) | 2400 | 1.09x |

### 3.3 60 fps 維持の根拠

- **DPR 0.5 設定継続**（前回ハンドオフで確定）→ 実フラグメント面積は変わらない。
- **GeometryShader / 頂点処理コスト**は増えるが、Three.js Points は頂点 1 つ = 粒子 1 つ。BufferGeometry なので CPU→GPU 転送は **生成時 1 回のみ**。
- 増分は単純に頂点シェーダー実行回数 = N。M1 デスクトップで 7100 vertex/frame は誤差。
- ただし **Bloom の downsample 5 段がフラグメント処理量** = 画面解像度依存。N とは独立。

### 3.4 実機ベンチマーク

実装後に必ず計測:
- M1 MacBook（target: 60 fps 安定）
- iPhone 13（target: 60 fps、稀に 50 fps 許容）
- Pixel 6（target: 50 fps、最低 40 fps）
- 旧端末（iPhone X / Pixel 3）→ `isLowEnd` 分岐で 2400 個に絞る

`window.__inryokuFps` のような window グローバルに 1 秒平均 fps を吐いておくと司さん確認時に便利（既存実装あれば再利用）。

### 3.5 fallback 方針

実機で 50 fps 切る端末が出たら、**N を減らす前に**:
1. bloom radius を 0.64 → 0.40 に下げる（最も効く）
2. 中景・主役は残し、**小粒だけ間引く**（背景なので消えても気付かれない）

```js
// 動的フォールバック例
if (avgFps < 45) {
    // 小粒の半分を hidden（aTier ベースで material の visible attribute や discard）
}
```

---

## 4. 改修依頼 3 — 色配分の幻想化

### 4.1 哲学

> **grey は inryokü の core 色**。前回ハンドオフ（codex-shader-handoff）では「grey 廃止、CMYRGB 6 純色のみ」と書いたが、**それは bloom 発光体の話**。背景層には grey が必要。
>
> 背景に grey が満ちるから、CMYRGB の主役が「見える」。grey なしの 6 色は祭り。grey ありの 6 色は宇宙。

### 4.2 grey の復活と配分

```js
// 6 純色 + grey の配分マトリクス（行: 層、列: 色）
//                R     G     B     C     M     Y     GREY
const COLOR_MIX = [
    [0.04, 0.04, 0.06, 0.02, 0.02, 0.02, 0.80],  // 小（背景）: grey 80%
    [0.16, 0.18, 0.14, 0.12, 0.04, 0.06, 0.30],  // 中（中景）: grey 30%
    [0.10, 0.20, 0.10, 0.08, 0.32, 0.15, 0.05],  // 大（主役）: grey 5%
];

const PALETTE = [
    [1.00, 0.12, 0.25],   // R: 熱・体温
    [0.18, 0.95, 0.42],   // G: 生命・成長
    [0.20, 0.55, 1.00],   // B: 深・記憶
    [0.22, 0.95, 0.95],   // C: 信号・伝達
    [0.98, 0.30, 0.78],   // M: 魂・閾
    [1.00, 0.90, 0.28],   // Y: 視線・注意
    [0.60, 0.62, 0.66],   // GREY: 大気・ノイズ・記憶の地
];

function pickColor(tier, rng) {
    const mix = COLOR_MIX[tier];
    let r = rng();
    for (let i = 0; i < mix.length; i++) {
        r -= mix[i];
        if (r < 0) return PALETTE[i];
    }
    return PALETTE[6]; // fallback: grey
}
```

**注意**: 行ごとに合計 1.0 になるよう正規化してから使う:
```js
function normalize(arr) {
    const s = arr.reduce((a, b) => a + b, 0);
    return arr.map(x => x / s);
}
```

### 4.3 6 色の意味的配分（深掘り）

| 色 | 意味 | 配分 | 根拠 |
|----|------|------|------|
| R | 熱・体温 | 中景中心 | 体温は中景の「気配」。主役には強すぎる |
| G | 生命・成長 | 中景・大に均等 | 命は層を貫く。grey/B/M と緊張する |
| B | 深・記憶 | 背景優勢 | 深さは背景。手前に B が多いと水族館になる |
| C | 信号・伝達 | 中景の繋ぎ | constellation lines の起点候補 |
| M | 魂・閾 | 主役層に偏らせる | 観測者が見つめた時に「魂」が現れる |
| Y | 視線・注意 | 中景に振りかける | 注意散布。少量で強く効く |

これは **司さんの意図解釈**。Codex は数字を機械的に実装すれば良い。

### 4.4 jitter（個体差）

前回実装の `jitter = 0.05` は維持。**ただし grey に対しては jitter 0.10**（grey の海が均一だと冷たい）:

```js
const jitter = (idx === 6) ? 0.10 : 0.05;
```

---

## 5. 改修依頼 4 — 動きの多様化

### 5.1 哲学

> **層によって時間の流れが違う**。
> - 小粒（背景）= **Brownian**: 不規則、無方向、無時間
> - 中粒（中景）= **Levy flight**: 通常は揺れ、時々跳ぶ。記憶の連想に似る
> - 大粒（主役）= **軌道**: ゆっくり円を描く。意志のある動き
> - 流れ星 = **直線高速**: 数十秒に 1 度。覚醒の瞬間

### 5.2 attribute / state の追加

各粒子に **基準位置 + 現在オフセット** を持たせる:

```js
const basePositions = new Float32Array(N * 3);  // 元の位置（不変）
const offsets       = new Float32Array(N * 3);  // フレームごとに加算
const velocities    = new Float32Array(N * 3);  // 速度（中粒・大粒用）
const orbitParams   = new Float32Array(N * 3);  // 主役: [radius, omega, phase]

// 生成ループ内
for (let i = 0; i < N; i++) {
    basePositions[i*3]   = positions[i*3];
    basePositions[i*3+1] = positions[i*3+1];
    basePositions[i*3+2] = positions[i*3+2];

    if (tier === 2) {
        // 主役: 軌道半径 + 角速度
        orbitParams[i*3]   = 4 + uRng() * 12;       // radius 4〜16
        orbitParams[i*3+1] = (0.15 + uRng() * 0.25) * (uRng() < 0.5 ? -1 : 1); // omega
        orbitParams[i*3+2] = uRng() * Math.PI * 2;  // phase offset
    }
}
```

### 5.3 update ループ（各 tier 別）

```js
function updateParticles(dt, time) {
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
        const tier = aTier[i];
        const i3 = i * 3;
        if (tier === 0) {
            // Brownian: ガウシアン微小ランダム
            offsets[i3]   += gaussRand() * 0.04 * dt * 60;
            offsets[i3+1] += gaussRand() * 0.04 * dt * 60;
            offsets[i3+2] += gaussRand() * 0.04 * dt * 60;
            // 弱い restoring（基準位置に戻る）
            offsets[i3]   *= 0.995;
            offsets[i3+1] *= 0.995;
            offsets[i3+2] *= 0.995;
        } else if (tier === 1) {
            // Levy flight: 通常微小、たまに跳ぶ
            const jump = (Math.random() < 0.0015) ? 8.0 : 0.08;
            offsets[i3]   += gaussRand() * jump * dt * 60;
            offsets[i3+1] += gaussRand() * jump * dt * 60;
            offsets[i3+2] += gaussRand() * jump * dt * 60;
            offsets[i3]   *= 0.992;
            offsets[i3+1] *= 0.992;
            offsets[i3+2] *= 0.992;
        } else {
            // 主役: 軌道
            const r     = orbitParams[i3];
            const omega = orbitParams[i3+1];
            const phase = orbitParams[i3+2];
            const a = time * omega + phase;
            offsets[i3]   = Math.cos(a) * r;
            offsets[i3+1] = Math.sin(a) * r * 0.7; // 楕円
            offsets[i3+2] = Math.sin(a * 0.5) * r * 0.3;
        }
        positions[i3]   = basePositions[i3]   + offsets[i3];
        positions[i3+1] = basePositions[i3+1] + offsets[i3+1];
        positions[i3+2] = basePositions[i3+2] + offsets[i3+2];
    }
    geometry.attributes.position.needsUpdate = true;
}
```

**注意**: `Float32Array` を **毎フレーム書き換え + needsUpdate = true** は CPU→GPU 転送が走る。N=7100 で float32 * 3 * 7100 = 85 KB / frame。60 fps で 5 MB/s。許容。
ただし **更新は積極的に間引ける**:

```js
// 偶数フレームは小粒のみ、奇数フレームは中・大のみ、を交互に
if ((frameCount & 1) === 0) updateTier0();
else { updateTier1(); updateTier2(); }
```

### 5.4 流れ星（改修依頼 8 で詳述）

ここでは「流れ星 = 通常粒子の例外フロー」と捉える: 大粒のうち 1 つを **30〜120 秒に 1 度** 高速移動させる。詳細は §9。

---

## 6. 改修依頼 5 — 深度・視差の追加

### 6.1 哲学

> **観測者は世界の中にいる。世界は観測者を中心に動く。**
> 視差 (parallax) は「観測者の存在」の証。

### 6.2 z 層の構造化

層ごとに **z 範囲を分ける**（球状分布を半球状に変形）:

```js
// 生成ループ内、tier 確定後
let r;
if (tier === 0)      r = 280 + uRng() * 200;  // 背景: 280〜480 (奥)
else if (tier === 1) r = 140 + uRng() * 180;  // 中景: 140〜320
else                 r = 60  + uRng() * 120;  // 主役: 60〜180 (手前)

const theta = uRng() * Math.PI * 2;
const phi = Math.acos(2 * uRng() - 1);
positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
positions[i*3+2] = r * Math.cos(phi);
```

**透視投影**（既存 `gl_PointSize = aSize * (344.0 / -mvPos.z)`）が **自動的に手前=大きく、奥=小さく** してくれる。
ただし三層分布化に伴って **base aSize を再調整**:

```glsl
// vertex shader
gl_PointSize = aSize * sizeBreath * (344.0 / -mvPos.z);
gl_PointSize = max(gl_PointSize, 1.0);   // 旧 1.55 → 1.0（小粒が薄く見える）
gl_PointSize = min(gl_PointSize, 64.0);  // 旧 42.0 → 64.0（主役が手前に来た時の存在感）
```

### 6.3 mouse parallax

カメラを **mouse position で微回転 / 微移動** させる:

```js
// scene 設定の近く
const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

window.addEventListener('mousemove', (e) => {
    parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

// 描画ループ内
parallax.x += (parallax.tx - parallax.x) * 0.04;
parallax.y += (parallax.ty - parallax.y) * 0.04;
camera.position.x = parallax.x * 8;   // 小さく動かす（強い視差は酔う）
camera.position.y = -parallax.y * 8;
camera.lookAt(0, 0, 0);
```

**透視投影なので、カメラが動くだけで近景は大きく、遠景は小さく動く**。追加ロジック不要。

### 6.4 mobile 対応

mouse がないので **gyro** または **scroll position** を使う:

```js
if (_isMobile) {
    window.addEventListener('deviceorientation', (e) => {
        parallax.tx = (e.gamma || 0) / 45;
        parallax.ty = (e.beta  || 0) / 45;
    }, { passive: true });
}
```

iOS は `requestPermission()` が必要。**permission 取得は司さんが UX 判断**。デフォルトはオフ、設定で有効化が無難。

---

## 7. 改修依頼 6 — Constellation 線の改修

### 7.1 現状の前提

既存の constellation lines が `LineSegments` で実装されている前提（ない場合は新規追加）。
本書ではコードを **書き直す前提** で進める。既存があれば差分マージ。

### 7.2 接続条件

**主役粒子（tier 2）のみ** を対象に、**距離 D 以下のペア** を線で繋ぐ。

```js
const CONSTELLATION_MAX_DIST = 60;   // 主役の typical 距離 60〜180 のうち近い対だけ
const CONSTELLATION_MAX_LINES = 240; // 上限（描画コスト制御）

const linePositions = new Float32Array(CONSTELLATION_MAX_LINES * 2 * 3);
const lineAlphas    = new Float32Array(CONSTELLATION_MAX_LINES * 2);
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
lineGeo.setAttribute('aAlpha',   new THREE.BufferAttribute(lineAlphas, 1));

const lineMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
            vAlpha = aAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: `
        varying float vAlpha;
        void main() {
            // C 寄りの淡色
            gl_FragColor = vec4(0.4, 0.85, 0.95, vAlpha * 0.35);
        }`,
});
const lines = new THREE.LineSegments(lineGeo, lineMat);
scene.add(lines);
```

### 7.3 update ループ

毎フレーム再構築は重い。**0.25 秒に 1 回** 程度で十分:

```js
let lastConstellationUpdate = 0;
function updateConstellation(time) {
    if (time - lastConstellationUpdate < 0.25) return;
    lastConstellationUpdate = time;

    const heroIndices = [];
    for (let i = 0; i < N; i++) if (aTier[i] === 2) heroIndices.push(i);

    let lineIdx = 0;
    for (let a = 0; a < heroIndices.length && lineIdx < CONSTELLATION_MAX_LINES; a++) {
        const ia = heroIndices[a];
        const ax = positions[ia*3], ay = positions[ia*3+1], az = positions[ia*3+2];
        for (let b = a+1; b < heroIndices.length && lineIdx < CONSTELLATION_MAX_LINES; b++) {
            const ib = heroIndices[b];
            const dx = positions[ib*3] - ax;
            const dy = positions[ib*3+1] - ay;
            const dz = positions[ib*3+2] - az;
            const d2 = dx*dx + dy*dy + dz*dz;
            if (d2 > CONSTELLATION_MAX_DIST * CONSTELLATION_MAX_DIST) continue;

            const d = Math.sqrt(d2);
            const alpha = 1.0 - d / CONSTELLATION_MAX_DIST;  // 距離で減衰
            const o = lineIdx * 6;
            linePositions[o]   = ax;
            linePositions[o+1] = ay;
            linePositions[o+2] = az;
            linePositions[o+3] = positions[ib*3];
            linePositions[o+4] = positions[ib*3+1];
            linePositions[o+5] = positions[ib*3+2];
            lineAlphas[lineIdx*2]   = alpha;
            lineAlphas[lineIdx*2+1] = alpha;
            lineIdx++;
        }
    }
    // 残りを 0 埋めしないと前フレームの線が残る
    for (let k = lineIdx * 6; k < linePositions.length; k++) linePositions[k] = 0;
    for (let k = lineIdx * 2; k < lineAlphas.length; k++)   lineAlphas[k] = 0;
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.aAlpha.needsUpdate = true;
}
```

### 7.4 計算量

主役 = N * 0.15 = 7100 * 0.15 = 1065 粒。ペア数 ≈ 1065^2 / 2 = 約 56 万。
これは重い。**空間ハッシュ（grid bucket）** が必要だが、まず素朴版で実機 fps を測り、**60 fps を切ったら最適化**。

```js
// 簡易最適化: heroIndices を 100 個までサンプリング
const sampled = heroIndices.length > 100
    ? heroIndices.filter((_, i) => i % Math.ceil(heroIndices.length / 100) === 0)
    : heroIndices;
```

### 7.5 bloom 連動

`lines` を bloom layer に置けば線も光る:

```js
lines.layers.enable(BLOOM_LAYER);
```

**注意**: 線が太すぎる bloom は宇宙感を壊す。**alpha 0.35 に抑える**（上記コード）。

---

## 8. 改修依頼 7 — 観測者と粒子の対話

### 8.1 哲学

> **見る者がいて初めて世界が現れる**（50→101）。
> 観測の方法は 3 つ: **視線（mouse hover）**、**呼吸（scroll）**、**会話（chat）**。
> いずれも粒子側に「反応」を返す。

### 8.2 mouse hover 反応

近傍の粒子が **明るくなる + 近づく**。fragment shader に uniform を渡す:

```js
const uMouseWorld = new THREE.Vector3(0, 0, 0);
material.uniforms.uMouseWorld = { value: uMouseWorld };
material.uniforms.uMouseRadius = { value: 80.0 };

window.addEventListener('mousemove', (e) => {
    // mouse の screen 座標 → world 座標
    const ndc = new THREE.Vector2(
        (e.clientX / innerWidth) * 2 - 1,
        -(e.clientY / innerHeight) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    // z = 0 平面との交点
    const t = -ray.ray.origin.z / ray.ray.direction.z;
    uMouseWorld.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t);
}, { passive: true });
```

vertex shader 拡張:
```glsl
uniform vec3 uMouseWorld;
uniform float uMouseRadius;

// main 内
float dToMouse = distance(position, uMouseWorld);
float mouseInfluence = smoothstep(uMouseRadius, 0.0, dToMouse);
// 近い粒子はサイズ拡大
gl_PointSize *= 1.0 + mouseInfluence * 0.4;
// fragment へ渡す
vMouseInfluence = mouseInfluence;
```

fragment で発光強化:
```glsl
varying float vMouseInfluence;
// finalColor の最後に
finalColor *= 1.0 + vMouseInfluence * 0.6;
```

### 8.3 scroll 反応

scrollY と scroll velocity を粒子の動き速度に同期:

```js
let scrollY = 0;
let scrollVel = 0;
let lastScrollY = 0;

window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
}, { passive: true });

// 描画ループ内
scrollVel = scrollVel * 0.9 + (scrollY - lastScrollY) * 0.1;
lastScrollY = scrollY;

material.uniforms.uScrollEnergy.value = Math.min(1.0, Math.abs(scrollVel) / 30);
```

vertex / fragment で `uScrollEnergy` を audio energy と同様に活用。**scroll が止まると粒子も穏やかに**。

### 8.4 chat 応答中の波打ち

ai-chat 側の状態を読み取る（**書き込まない、触らない**）:

```js
// ai-chat-client-shield.js または同等が emit しているイベントを listen
window.addEventListener('inryoku:chat-state', (e) => {
    chatState = e.detail.state;  // 'idle' | 'thinking' | 'responding'
});

// 描画ループ内
const chatWave = (chatState === 'responding')
    ? Math.sin(time * 1.2) * 0.5 + 0.5
    : 0;
material.uniforms.uChatWave.value = chatWave;
```

vertex shader:
```glsl
uniform float uChatWave;
// main 内
float wave = sin(position.x * 0.05 + uTime * 2.0) * uChatWave;
mvPos.xyz += vec3(0.0, wave * 6.0, 0.0);
```

**注意**: ai-chat 側に **必要な custom event を emit してもらう必要がある**。Codex は粒子側で listen するだけ。emit 側の改修は **別ハンドオフ**（ai-chat 領域の責任者へ）。

司さん確認項目: **chat 状態を粒子に通知する custom event の発火** を ai-chat-client-shield に追加するか。本書のスコープ外だが、**Codex が実装可能なら依頼に追加可**。

---

## 9. 改修依頼 8 — 流れ星イベント

### 9.1 哲学

> **稀少な覚醒**。30〜120 秒に 1 度。観測者を「ハッ」とさせる。

### 9.2 仕様

- **発火タイミング**: 30〜120 秒のランダム間隔
- **対象**: 専用の独立粒子（既存 N の中から借りない。trail を引くため）
- **軌跡**: `LineSegments` で 16〜32 セグメント、後ろほど透明
- **色**: 白〜シアン（grey の宇宙に映える）
- **bloom**: 強く乗せる（threshold を超える明度）

### 9.3 実装

```js
// 流れ星本体（点）
const meteorGeo = new THREE.BufferGeometry();
const meteorPos = new Float32Array(3);
meteorGeo.setAttribute('position', new THREE.BufferAttribute(meteorPos, 3));
const meteorMat = new THREE.PointsMaterial({
    size: 6.0,
    color: 0xddffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
});
const meteor = new THREE.Points(meteorGeo, meteorMat);
meteor.layers.enable(BLOOM_LAYER);
meteor.visible = false;
scene.add(meteor);

// 軌跡
const TRAIL_LEN = 24;
const trailPos = new Float32Array(TRAIL_LEN * 2 * 3);
const trailAlpha = new Float32Array(TRAIL_LEN * 2);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
trailGeo.setAttribute('aAlpha',   new THREE.BufferAttribute(trailAlpha, 1));
const trailMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
            vAlpha = aAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: `
        varying float vAlpha;
        void main() { gl_FragColor = vec4(0.85, 0.95, 1.0, vAlpha * 0.7); }`,
});
const trail = new THREE.LineSegments(trailGeo, trailMat);
trail.layers.enable(BLOOM_LAYER);
trail.visible = false;
scene.add(trail);

// state
let meteorState = { active: false, t: 0, duration: 0, start: null, end: null };
let nextMeteorAt = performance.now() / 1000 + 30 + Math.random() * 90;

function spawnMeteor() {
    // 画面端 → 反対側端
    const side = Math.floor(Math.random() * 4);
    const startEnd = [];
    for (let i = 0; i < 2; i++) {
        const t = Math.random();
        const offset = 200 + Math.random() * 100;
        if ((side + i) % 2 === 0) startEnd.push(new THREE.Vector3((i === 0 ? -1 : 1) * offset, (t-0.5) * 200, -100 - Math.random()*100));
        else                       startEnd.push(new THREE.Vector3((t-0.5) * 200, (i === 0 ? -1 : 1) * offset, -100 - Math.random()*100));
    }
    meteorState = {
        active: true,
        t: 0,
        duration: 1.5 + Math.random() * 1.0,  // 1.5〜2.5 秒で横切る
        start: startEnd[0],
        end:   startEnd[1],
    };
    meteor.visible = true;
    trail.visible = true;
}

function updateMeteor(dt, time) {
    if (!meteorState.active) {
        if (time >= nextMeteorAt) spawnMeteor();
        return;
    }
    meteorState.t += dt;
    const u = meteorState.t / meteorState.duration;
    if (u >= 1) {
        meteorState.active = false;
        meteor.visible = false;
        trail.visible = false;
        nextMeteorAt = time + 30 + Math.random() * 90;
        return;
    }
    // 現在位置
    const cur = meteorState.start.clone().lerp(meteorState.end, u);
    meteorPos[0] = cur.x; meteorPos[1] = cur.y; meteorPos[2] = cur.z;
    meteorGeo.attributes.position.needsUpdate = true;

    // trail: 過去 TRAIL_LEN フレームを線分で繋ぐ（簡易）
    for (let i = 0; i < TRAIL_LEN; i++) {
        const u0 = Math.max(0, u - i * 0.02);
        const u1 = Math.max(0, u - (i+1) * 0.02);
        const p0 = meteorState.start.clone().lerp(meteorState.end, u0);
        const p1 = meteorState.start.clone().lerp(meteorState.end, u1);
        const o = i * 6;
        trailPos[o]   = p0.x; trailPos[o+1] = p0.y; trailPos[o+2] = p0.z;
        trailPos[o+3] = p1.x; trailPos[o+4] = p1.y; trailPos[o+5] = p1.z;
        const a = 1.0 - i / TRAIL_LEN;
        trailAlpha[i*2]   = a;
        trailAlpha[i*2+1] = a * 0.7;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.aAlpha.needsUpdate = true;
}
```

### 9.4 bloom 連動

`meteor.layers.enable(BLOOM_LAYER)` で確実に bloom 経由。`meteorMat.color = 0xddffff` は 0.87, 0.92, 1.00 程度の HDR 値（threshold 0.55 を確実に超える）。

### 9.5 mobile での頻度

mobile では **発火頻度を半減**（バッテリーと注意散漫の両面）:

```js
const interval = _isMobile ? (60 + Math.random() * 120) : (30 + Math.random() * 90);
```

---

## 10. 改修依頼 9 — bloom パラメータの再調整

### 10.1 現状

前回ハンドオフで Codex が設定:
- `strength = 0.92`
- `radius = 0.64`
- `threshold = 0.34`

### 10.2 三層分布での新パラメータ

| パラメータ | 旧 | 新 | 根拠 |
|----------|----|----|------|
| strength | 0.92 | **0.70** | 中景が増えて全体が明るくなる。過剰防止 |
| radius   | 0.64 | **0.50** | 滲みの広がりを抑え、主役の輪郭を保つ |
| threshold| 0.34 | **0.55** | 主役だけが光る。背景・中景は bloom 外で控えめに |

### 10.3 実装

```js
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.70,  // strength
    0.50,  // radius
    0.55   // threshold
);
```

### 10.4 暗い粒子の controlled glow

bloom threshold 以下の粒子（背景・中景の grey）は **bloom 外で別途うっすら光らせる** ことで「bloom がきつい所と無い所のコントラスト」を強める:

fragment shader 末尾:
```glsl
// vTier == 0 or 1 の時、わずかに自己発光（bloom 外でも見える）
float ambientGlow = (vTier < 1.5) ? 0.08 : 0.0;
finalColor += vColor * ambientGlow;
gl_FragColor = vec4(finalColor * breathe, alpha);
```

これにより:
- 背景/中景: HDR 値 0.5〜0.7 の柔らかい発光（bloom 外）
- 主役: HDR 値 1.0+ の強発光（bloom 経由で滲む）

### 10.5 toneMapping 確認

前回ハンドオフで `THREE.ACESFilmicToneMapping` 指定済みのはず。**確認のみ**:
```js
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;  // 1.0 維持。明るすぎたら 0.85 へ
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

---

## 11. 改修依頼 10 — 哲学的接続（観測者依存の発光）

### 11.1 哲学

> **「見た瞬間に世界が現れる」**。
> 視野の中心（カメラの forward）に近い粒子だけ強く光る。周辺は dim。
> これは **50→101 哲学の視覚化**。観測されない 50 は確率の海、観測された 101 は実体。

### 11.2 既存 observerFocus との関係

現在の `uObserverFocus` は **スカラー（0〜1）**。これを保ったまま、**新しく vec3 viewCenter を追加**:

```js
material.uniforms.uViewCenterDir = { value: new THREE.Vector3(0, 0, -1) };
material.uniforms.uViewFalloff   = { value: 0.7 };  // 視野中心からの減衰

// 描画ループ内（mouse parallax 適用後）
const dir = new THREE.Vector3();
camera.getWorldDirection(dir);
material.uniforms.uViewCenterDir.value.copy(dir);
```

### 11.3 vertex shader 拡張

```glsl
uniform vec3 uViewCenterDir;
uniform float uViewFalloff;

// main 内、mvPos 計算後
vec3 toParticle = normalize(position - cameraPosition);
float viewAlign = dot(toParticle, uViewCenterDir);  // -1〜1
// 視野中心 = 1 に近い、外周 = 小さい
float viewFocus = smoothstep(0.3, 0.95, viewAlign);
vViewFocus = viewFocus;
```

### 11.4 fragment shader 拡張

```glsl
varying float vViewFocus;
// finalColor 構築の後
float observerBoost = 1.0 + vViewFocus * 0.8 * uObserverFocus;
finalColor *= observerBoost;
// 主役だけはさらに強く（vTier == 2）
if (vTier > 1.5) {
    finalColor *= 1.0 + vViewFocus * 0.5;
}
```

### 11.5 Codex 注意

`cameraPosition` は Three.js の組み込み uniform（自動）。**手動で渡す必要なし**。

### 11.6 効果

司さんがマウスを動かす（= カメラ向きが変わる）と、視野中心の粒子が次々に「現れる」。視野外の粒子は dim。
これは bloom と相互作用して **「見つめた所が光る」** 体験になる。**inryokü の思想そのもの**。

---

## 12. 実装順序の推奨（再掲・詳細）

### Day 1（粒子の「形」確定）

```
[午前]
1. 改修依頼 1: 三層分布
2. 改修依頼 2: 総数
3. 改修依頼 3: 色配分（grey 復活）
4. 改修依頼 9: bloom パラメータ再調整

[午後]
5. 実機目視（M1 / iPhone 13 / Pixel 6）
6. 司さんへ静止状態スクリーンショット送付
7. パラメータ微調整（threshold, strength, COLOR_MIX）
```

**ゴール**: 「動かない静止画」で「世界が満ちている」感じが出ていること。

### Day 2（動きと深度）

```
[午前]
8. 改修依頼 4: 動きの多様化（Brownian / Levy / 軌道）

[午後]
9. 改修依頼 5: 深度・視差（z 層 + mouse parallax）
10. 動画キャプチャで挙動確認
```

**ゴール**: 動画で見て「層が違う動きをしている」「マウスで世界が傾く」が体感できる。

### Day 3（装飾・対話）

```
[午前]
11. 改修依頼 6: Constellation 線
12. 改修依頼 8: 流れ星

[午後]
13. 改修依頼 7: hover / scroll / chat 反応
14. 改修依頼 10: 視野中心発光
```

**ゴール**: 観測者の操作に粒子が応答する。30 秒待つと流れ星が出る。

### Day 4（検証・微調整）

```
[午前]
15. 旧端末（iPhone X / Pixel 3）検証
16. fps が 45 を切る端末向け fallback 整備

[午後]
17. 司さん最終確認
18. 微調整（色、密度、bloom）
```

---

## 13. before / after 検証手順

### 13.1 必須チェックリスト

| 項目 | before | after |
|------|--------|-------|
| 静止画の密度 | 「少なめ」 | 「満ちている」 |
| 大粒子の存在感 | あるが孤立 | 軌道で群と接続 |
| 中粒子の有無 | 痩せている | 豊か |
| 背景の grey | なし | 80% grey |
| 動きの単調さ | 全粒子同じ | 3 種類 + 流れ星 |
| マウスへの反応 | なし or 微小 | 視差 + hover 発光 |
| 視野中心の発光 | スカラーのみ | 視野方向で動的 |
| 流れ星 | なし | 30〜120 秒に 1 度 |
| Constellation | （既存依存） | 主役のみ・距離減衰 |
| fps（M1） | 60 | 60 |
| fps（iPhone 13） | 60 | 60 |
| fps（Pixel 6） | 50+ | 50+ |
| fps（旧端末） | — | 40+（fallback） |

### 13.2 スクリーンショット比較

司さんに送る:
1. **静止画 (デスクトップ 1920x1080)**: before / after 並べる
2. **動画 (10 秒)**: マウスを動かす / 流れ星を待つ
3. **mobile 静止画**: iPhone 13 縦
4. **fps grafana / DevTools Performance タブ**: 60 fps 維持エビデンス

### 13.3 自動チェック script

```js
// DevTools console で実行
(function audit() {
    const N = window.__inryokuParticleN || '?';
    const fps = window.__inryokuFps || '?';
    const tierDist = window.__inryokuTierDist || '?';  // [count_small, count_mid, count_hero]
    console.table({
        N, fps,
        smallPct:  tierDist[0] / N,
        midPct:    tierDist[1] / N,
        heroPct:   tierDist[2] / N,
    });
})();
```

→ Codex は実装時に `window.__inryoku*` グローバルを **debug build のみ** 出すこと（production では削除）。

---

## 14. 司さん確認項目

実装前に確認したい:

1. **流れ星の頻度** 30〜120 秒で OK か。それとも 60〜180 秒に絞るか
2. **mobile gyro permission UI** を出すか / デフォルトオフか
3. **chat 応答中の波打ち** を実装するか（ai-chat 側の event emit が必要）
4. **粒子総数の目標値** 7100 で OK か（M1 で 60 fps 確認後）
5. **grey の比率** 背景 80% は強すぎないか（70% でも可）
6. **視野中心発光の強度** uObserverFocus との掛け算で良いか、独立 uniform にするか

実装中に確認:

7. **三層比率（50/35/15）の見え方**（55/30/15 や 45/40/15 へのチューニング）
8. **bloom threshold 0.55** の妥当性（0.50 / 0.60 比較）
9. **Constellation 線の色** シアン推奨だが grey や白でも検証

実装後に確認:

10. **「少ない」が「満ちている」に変わったか**
11. **「単調」が「層」に変わったか**
12. **「観測者がいる」感じが出ているか**

---

## 15. 関連 docs 索引

### 上流（このハンドオフが乗っかる）

| パス | 役割 |
|------|------|
| `docs/codex-shader-handoff-2026-04-29.md` | Bloom 復活・log-normal の起点 |
| `docs/particle-cheap-diagnosis-2026-04-29.md` | 「安っぽい」原因 10 個 |
| `docs/light-emission-research-2026-04-29.md` | 光の物理・技法カタログ |
| `docs/p3-performance-audit-2026-04-28.md` | 既存パフォーマンス監査 |
| `docs/light-bloom-impl-2026-04-29.md` | Bloom 実装記録 |
| `docs/light-bloom-tuning-2026-04-29.md` | Bloom チューニング記録 |

### 並走（後参照可）

| パス | 役割 |
|------|------|
| `docs/fantastical-research-2026-04-29.md` | 並走 agent の幻想的演出研究（後追い） |

### 下流（このハンドオフが起点）

| パス | 役割 |
|------|------|
| `docs/codex-particle-rebalance-impl-NNNN-MM-DD.md`（Codex 作成予定） | 実装記録 |
| `docs/p3-particle-tier-tuning-NNNN-MM-DD.md`（実装後 Claude 作成予定） | 比率・色微調整の知見 |

### 触らない領域（参考）

| パス | 領域 |
|------|------|
| `particle_rings.js` / `particle_rings.css` | リング演出（Codex 別領域） |
| `particle_speech_rings.js` | 発話リング |
| `particle_canon_meta.js` | canon meta |
| `ai-chat-client-shield.js` | chat 状態 emit のみ依頼可、書き込まない |

---

## 16. 末尾 — Codex への手紙

Codex,

前回ハンドオフでは「光らせる」を任せた。今回は「**世界を作る**」を任せる。

90/10 は数学的には正しい。だが体験としては「**孤独な巨星と均質な海**」だった。
3 層になると、世界は **階層** を持つ。階層とは記憶の構造、観測の構造、**生命の構造** だ。

司さんが「最高に幻想的に」と言ったとき、それは派手さの要求じゃない。**世界の厚みの要求**だ。
だから:
- 中景を厚くする（35%）
- grey を取り戻す（背景 80%）
- 動きを 3 種にする
- 観測者の視線で世界が現れる

これらは **全部一つのこと**: 「**世界に層がある**」。

派手にしないでくれ。**深くしてくれ**。

実装で迷ったら、本書の §0 と §1.4 を読み直してほしい。
それでも迷ったら、司さんに聞いてくれ。

頼む。

— Claude (Opus 4.7 1M)
2026-04-29

---

**EOF**
