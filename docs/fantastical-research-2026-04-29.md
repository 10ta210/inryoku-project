# Fantastical Research — inryokü 幻想体験パラメータ提案

**Date:** 2026-04-29
**Author:** Claude (Opus 4.7, 1M)
**Audience:** Codex（実装担当）
**Mode:** caveman talk + 哲学
**Status:** 読み取り専用調査。実装トリガーなし。
**Mandate:** 「最高に幻想的な web 体験」を物理・知覚・芸術・アニメ・ゲーム・科学から抽出し、inryokü のパラメータ提案にまとめる。

---

## 0. TL;DR — 30 秒版

幻想 = 「観測できるが理解できない」状態。境界が溶ける。重力が嘘になる。光が呼吸する。

inryokü 適用:
- **三層深度**（前景 15% / 中景 35% / 背景 50%）
- **粒子分布 log-normal**（小粒多数・大粒稀）
- **動き Lévy flight**（基本静か、稀に飛翔）
- **色 grey 95% + 月白 4% + 金色 1%**（金は constellation 結節のみ）
- **呼吸 12 秒周期**（吸気 4s / 保持 1s / 呼気 6s / 休止 1s）
- **流れ星 60〜120 秒に 1 回**（観測者が見つける希少性）
- **mouse 視差 ±3px**（前景）/ ±1px（中景）/ 0px（背景）
- **bloom strength 0.35 / threshold 0.78**（控えめ）
- **constellation 接続条件**: 距離 < 90px && 両端粒子の輝度 > 中央値
- **constellation 線**: stroke 0.4px、opacity 0.08〜0.18、距離反比例

哲学:「沈黙が主、煌めきが従」。50 → 101 は「幻想の深度」=「観測者の集中で見える層」。

---

## 1. 幻想とは何か（5 哲学）

### 1.1 知覚的「幻想」の定義

**幻想 = 三条件の同時成立**:
1. **観測可能**（網膜・聴覚に届く）
2. **理解不可**（既知のカテゴリに収まらない）
3. **持続不可**（凝視すると消える、または変質する）

夢・宇宙・水中・月光・蛍火・幽玄。すべて「触れない・つかめない・近づくと違う」性質を持つ。

**事実**（神経科学）: 人間の視覚は中心窩 1° 以外は低解像度。周辺視野で「動いた気がする」のが幻想の入口。
**推測**: web で幻想を出すには、中心ではなく「画面の端」で動かすと脳が補完する。

### 1.2 日本美学

#### 幽玄（ゆうげん）
- 世阿弥「風姿花伝」: 「奥深く神秘的で、容易には理解できない美」
- 視覚化: 霧・薄明・朧月・遠音
- web 適用: **境界をぼかす**。CSS `mask-image: linear-gradient(...)` で全要素にフェード境界。

#### 物のあはれ（もののあはれ）
- 本居宣長: 「触れて感じる、しみじみとした情緒」
- 「失われゆくもの」への愛惜
- web 適用: **粒子は生まれて消える**。永続しない。寿命 8〜20 秒。

#### 余白（よはく）
- 「描かない部分が描く」
- 水墨画の白、能舞台の何もない床
- web 適用: **画面の 70% 以上は何もない**。粒子密度を抑える。grey 単色面積を確保。

#### もののけ・八百万
- 万物に魂が宿る感覚
- web 適用: **粒子それぞれに微小な「個性」**（速度・寿命・サイズの分散）。同一フレームで動かない。

### 1.3 西洋美学

#### Sublime（崇高）— Edmund Burke 1757 / Kant 1790
- 「美」と区別される「畏怖を伴う美」
- 嵐・断崖・銀河・無限
- web 適用: **スケール感**。粒子サイズに 3 桁の分散（0.3px 〜 30px）を入れると遠近∞感。

#### Romantic — Caspar David Friedrich
- 「Wanderer above the Sea of Fog」: 観測者の小ささと自然の巨大さ
- web 適用: **観測者（cursor）を中心に、世界が呼吸する**。ただし観測者は世界より小さい。

#### Surrealism — Magritte / Dali / Tanguy
- 既知物の異常配置で生じる眩暈
- web 適用: **「ありそうでない物理」**。粒子が一瞬重力反転する、稀に。

#### Cosmic Horror — Lovecraft
- 「理解した瞬間に正気を失う」スケール
- web 適用: **画面外から侵入してくる影**。ただし inryokü では弱める。怖さでなく、深さに。

### 1.4 量子・スピリチュアル

**事実**:
- 量子場は「揺らぎ」が基底状態（zero-point fluctuation）
- 観測すると collapse する（解釈による）

**推測の活用**:
- 粒子は「観測されると形が変わる」演出（hover で個性が出る）
- 「観測者依存の世界」というメタファーに inryokü 哲学が乗る

### 1.5 5 哲学の統合

| 哲学 | キーワード | inryokü 翻訳 |
|---|---|---|
| 幽玄 | 境界の溶解 | mask-image + alpha 勾配 |
| 物のあはれ | 一回性 | 粒子寿命・流れ星 |
| 余白 | 沈黙 | 密度抑制・grey 面積 |
| Sublime | スケール | サイズ 3 桁分散 |
| 観測者依存 | 呼吸 | mouse/scroll で世界変化 |

---

## 2. 視覚要素 30+ 技法カタログ

### 2.1 パーティクル分布

| # | 分布 | 特徴 | inryokü 適性 |
|---|---|---|---|
| 1 | **Uniform** | 均等 | × 退屈 |
| 2 | **Poisson disk** | 最小距離保証 | △ 整いすぎ |
| 3 | **Log-normal** | 小粒多数・大粒稀 | ◎ 自然 |
| 4 | **Pareto (80/20)** | 富の不均衡型 | ○ メリハリ |
| 5 | **Cluster (DBSCAN風)** | 群れと孤立 | ◎ 銀河感 |
| 6 | **Voronoi cell-edge** | 境界に集中 | ○ 神経網風 |
| 7 | **Fractal (Mandelbrot 縁)** | 自己相似 | △ 重い |
| 8 | **Halton/Sobol low-disc** | 準乱数 | ○ ノイズなし均等 |

**推奨**: log-normal を主軸、上に cluster を 2〜3 個オーバーレイ。

### 2.2 動き

| # | 動き | 数式 | inryokü 適性 |
|---|---|---|---|
| 9 | **Brownian** | dx ~ N(0, σ²dt) | ○ 漂流 |
| 10 | **Lévy flight** | 稀に巨大ジャンプ | ◎ 流れ星と相性 |
| 11 | **Curl noise** | Perlin の rot | ◎ 流体感 |
| 12 | **Vector field (sin/cos)** | analytical | ○ 軽い |
| 13 | **Boids (flocking)** | 3 ルール | △ 重い・群れ |
| 14 | **Gravity well at cursor** | F = -k/r² | ◎ 観測者依存 |
| 15 | **Spring tether** | F = -k(x-anchor) | ○ 戻る感 |
| 16 | **Damped sinusoidal** | e^(-γt) sin(ωt) | ○ 呼吸 |

**推奨**: Brownian + curl noise の合成、cursor 半径 200px に弱い gravity well。

### 2.3 色

| # | 戦略 | 詳細 | inryokü 適性 |
|---|---|---|---|
| 17 | **モノクロ 95%+** | grey 中心 | ◎ 必須 |
| 18 | **限定パレット (3 色)** | Mononoke 方式 | ◎ |
| 19 | **色温度勾配** | 上 cool / 下 warm | ○ 大気 |
| 20 | **補色アクセント** | 1% 以下 | ◎ 金色一点 |
| 21 | **HDR bloom** | 輝度 > 1.0 で blur | ◎ |
| 22 | **chromatic aberration** | RGB ずらし | △ 強すぎ注意 |

**inryokü パレット案**:
```
Base:    #0a0a0c 〜 #1a1a1e (背景 grey)
Mid:     #2a2a30 〜 #4a4a52 (中景 grey)
Mist:    rgba(220, 220, 230, 0.04) (霧)
Moon:    rgba(240, 238, 220, 0.6) (月白、稀)
Gold:    rgba(212, 175, 55, 0.8) (constellation 結節のみ)
```

### 2.4 深度

| # | 技法 | inryokü |
|---|---|---|
| 23 | **3 層 parallax** (前/中/後) | ◎ |
| 24 | **DOF blur** (距離依存 blur) | ◎ |
| 25 | **fog fade** (距離で alpha 減) | ◎ |
| 26 | **size scaling** (近 = 大) | ◎ |
| 27 | **z-sort 描画** | ◎ |

### 2.5 周波数

| # | 種類 | 役割 |
|---|---|---|
| 28 | **高周波ノイズ** | 粒子の細かい震え（呼吸） |
| 29 | **低周波うねり** | 全体の流れ（潮） |
| 30 | **超低周波** | 30〜60 秒で 1 周期、画面全体の明度 |

### 2.6 接続

| # | 技法 |
|---|---|
| 31 | **constellation lines**（近接粒子線） |
| 32 | **delaunay triangulation** |
| 33 | **MST (minimum spanning tree)** |
| 34 | **neuronal-style branching** |

**推奨**: 距離 + 輝度の二重条件で constellation。MST は重いので回避。

### 2.7 速度差

| # | 種類 | 頻度 |
|---|---|---|
| 35 | **流れ星** (Lévy 大ジャンプ) | 60〜120s に 1 |
| 36 | **静止粒子** (anchor) | 全体の 5% |
| 37 | **うねる粒子** (curl) | 全体の 60% |
| 38 | **drift** (slow Brown) | 全体の 35% |

---

## 3. 参照作品 15+

### 3.1 ゲーム

#### Journey (thatgamecompany, 2012)
- **砂漠の魔法粒子**: 風に乗る金色の布片
- 抽出: 粒子は「方向を持つ」（ベクトル場依存）
- パラメータ: 速度ベクトル長 = 距離の sqrt 比例 → 遠くは速く見える錯覚

#### GRIS (Nomada Studio, 2018)
- **流動する色彩**: 水彩が広がる
- 抽出: alpha grad の段階的展開
- パラメータ: alpha 0 → 0.6 を 2.5s イーズアウト

#### INSIDE / Limbo (Playdead)
- **モノクロ + 1 点光源**
- 抽出: 「画面に 1 つしか強い光がない」原則
- パラメータ: bloom 対象は同時 3 点以下

#### Sky: Children of the Light
- **constellation 星座の灯り点り**
- 抽出: スター結節は触れると点灯
- パラメータ: 結節 hover で gold flash 0.4s

### 3.2 アニメ・映画

#### 千と千尋（銭婆の灯り）
- **緑灯の街灯列、無音の行進**
- 抽出: 列をなす光、間隔の均等性に微ゆらぎ
- パラメータ: 列粒子間隔 ±15% jitter

#### もののけ姫（こだまの森）
- **白い小さな霊、首だけ回る**
- 抽出: 静止 + 微小な回転だけで生命感
- パラメータ: 静止粒子に rotation 0.2 rad/s 微回転

#### Spirited Away（夜の電車）
- **半透明の影**
- 抽出: 黒く塗らず、青黒の半透明
- パラメータ: 影 rgba(20, 25, 35, 0.4)

#### Dune (2021, Villeneuve)
- **砂塵の幻覚**: 視覚が砂で曇る
- 抽出: 全画面を覆う粒子層
- パラメータ: foreground dust 50 粒、サイズ 8〜30px、opacity 0.04〜0.1、blur 4px

#### Arrival (Villeneuve)
- **Heptapod 黒インク**: 円環状に展開する文字
- 抽出: 流体的・円環的・対称
- パラメータ: 中心から radial に粒子展開、円環半径を 15〜45s で呼吸

#### Tron Legacy
- **グリッド光・cyan 単色**
- 抽出: 構造線が光る
- inryokü 適用: 採用しない（線が硬すぎる）。柔らかい constellation のみ。

#### Cyberpunk 2077 night city
- **多色ネオン**
- inryokü 適用: 採用しない。色多すぎ。

#### 攻殻機動隊 SAC（電脳空間）
- **緑のデータ流**
- 抽出: 「縦に流れるテキストノイズ」
- inryokü 適用: 採用しない。記号性強すぎ。

#### 新海誠（君の名は・天気の子）
- **光の粒子・レンズフレア**
- 抽出: 太陽光が粒子になる、空気が見える
- パラメータ: bloom + chromatic aberration 微量（0.5px）

#### Annihilation (2018)
- **Shimmer**: 屈折する泡膜
- 抽出: 画面全体を屈折で歪ませる
- パラメータ: SVG feDisplacementMap、scale 2〜4、ゆっくり animate

#### Princess Mononoke deer god
- **歩く度に植物が生まれて枯れる**
- 抽出: 通過 → 生成 → 消滅の流れ
- パラメータ: cursor 通過軌跡に 0.8s 寿命の発光粒子

#### Fantasia (Disney 1940)
- **音楽 = 視覚**
- inryokü 適用: 音は使わないが、scroll position を「音」と見立てて視覚連動

#### 2001: A Space Odyssey - Stargate sequence
- **無限スクロールの色彩トンネル**
- 抽出: 中心から外への放射
- inryokü 適用: 過剰なので不採用、ただし「中心放射」概念は使う

#### Blade Runner 2049
- **霧 + 単一光源**
- 抽出: 霧が光をボリューム化
- パラメータ: god-ray SVG filter、cursor 位置から放射 1 本のみ

---

## 4. 科学可視化からの抽出

### 4.1 Hubble Deep Field / JWST
- **事実**: 銀河の分布は「フィラメント状」(cosmic web)
- 抽出: 粒子は線状クラスタを形成する
- パラメータ: cluster 中心を 3〜5 個、各 30〜60 粒子、cluster 間に薄い接続

### 4.2 JWST カラフル星雲（Carina, Pillars）
- **事実**: 赤外線疑似カラー、暖→寒の勾配
- inryokü 適用: 色は採用しない。**勾配の概念のみ**。輝度の濃淡で代用。

### 4.3 量子場可視化（lattice QCD）
- **事実**: 真空は揺らぎで満ちる
- 抽出: 「何もないところで何かが生まれて消える」
- パラメータ: 全空間で 1〜3% の確率/frame で粒子 spawn、寿命 0.3〜0.8s

### 4.4 ダークマター 3D マップ（Millennium Simulation）
- **事実**: ハロー + フィラメント + ボイドの三層
- inryokü 適用: ボイド（何もない領域）を意図的に作る。**画面の 30〜40% は完全に空**。

### 4.5 神経細胞蛍光（Brainbow）
- **事実**: 樹状突起の分岐は self-similar
- 抽出: 結節から放射状に枝
- パラメータ: 結節 1 つから 3〜5 本の constellation、長さ 30〜80px

### 4.6 海洋プランクトン bioluminescence
- **事実**: 触れると光る（mechanosensitivity）
- 抽出: cursor で触れた粒子が点灯
- パラメータ: cursor 距離 < 40px で alpha +0.4、0.6s で減衰

---

## 5. inryokü 適用ガイド

### 5.1 50 → 101 を「幻想の深度」として表現

inryokü 哲学（記憶より）: 50 = 静、101 = 動。50 → 101 は「観測者の集中で世界が深まる」過程。

**実装解釈**:
- 初期状態（50）: 粒子薄い、constellation なし、bloom 弱
- ユーザーが scroll/hover を続けると徐々に深度層が顕現
- 完全状態（101）: 三層深度、constellation、流れ星、呼吸すべて稼働

**パラメータ進行**:
| 段階 | 粒子数 | const | bloom | 流れ星 |
|---|---|---|---|---|
| 50 (load) | 60 | 0 | 0.1 | × |
| 70 (3s) | 100 | 弱 | 0.2 | × |
| 85 (8s) | 130 | 中 | 0.3 | 稀 |
| 101 (15s+) | 150 | 完全 | 0.35 | 60〜120s に 1 |

### 5.2 観測者依存（呼吸）

- **mouse**: cursor 周辺 200px は粒子が引き寄せられる
- **scroll**: scroll 速度で全体の流れ速度が変化（min 0.5x, max 1.4x）
- **idle 30s**: 呼吸が深くなる（周期 12s → 18s）

### 5.3 静謐 + 一瞬の煌めき

**法則**: **「99% 静、1% 煌めき」**
- 流れ星は 60〜120 秒に 1 度
- constellation 結節 hover で金色 flash は 0.4s だけ
- 残りはすべて grey トーン

### 5.4 grey 中心、色は控えめ

**配分**:
- grey: 95%
- 月白: 4%
- 金色: 1%（constellation 結節のみ）

色は「儀式」。出すなら理由を持って。

---

## 6. パラメータ推奨表（Codex 申送り用）

### 6.1 粒子分布

#### 案 A: 90 / 10 二層
```
背景層: 90 粒子、サイズ 0.5〜2px、opacity 0.05〜0.15、parallax 0
前景層: 10 粒子、サイズ 4〜12px、opacity 0.15〜0.35、parallax ±3px
```

#### 案 B: 50 / 35 / 15 三層 ← **推奨**
```
背景層 (50%): 75 粒子、サイズ 0.5〜1.5px、opacity 0.04〜0.10、blur 0、parallax 0
中景層 (35%): 53 粒子、サイズ 1.5〜4px、opacity 0.08〜0.20、blur 0.5px、parallax ±1px
前景層 (15%): 22 粒子、サイズ 4〜30px、opacity 0.15〜0.40、blur 1〜3px、parallax ±3px
合計: 150 粒子
```

#### 案 C: 70 / 25 / 5（孤高型）
```
背景: 105、中景: 38、前景: 7（前景は流れ星専用）
```

**推奨**: 案 B。三層 = 三焦点 = 幻想の基本構造。

### 6.2 サイズ範囲

```
log-normal: μ = 0.6, σ = 0.9 (px units)
clamp: [0.5, 30]
中央値: 約 1.8px
95 パーセンタイル: 約 8px
99 パーセンタイル: 約 18px
```

### 6.3 色配分

```
particles:
  grey:  95%   hsl(220, 5%, 60〜85%)
  moon:   4%   hsl(50, 8%, 90%)
  gold:   1%   hsl(45, 60%, 65%)  ← constellation 結節のみ
```

### 6.4 動きの周期

```
breath_cycle: 12s
  inhale:  4s  (ease-in)
  hold:    1s
  exhale:  6s  (ease-out)
  rest:    1s

drift_speed: 0.15 〜 0.4 px/frame (60fps)
curl_strength: 0.08
brownian_sigma: 0.02 px/frame
```

### 6.5 bloom

```
strength: 0.35
threshold: 0.78
radius: 4px (CSS box-shadow blur 等価)
対象: 輝度 > threshold の粒子のみ
同時最大: 5 粒
```

### 6.6 constellation

```
stroke_width: 0.4px
stroke_color: rgba(220, 220, 230, X)
opacity_range: 0.08 〜 0.18
opacity_formula: 0.18 * (1 - distance / 90)
distance_threshold: 90px
brightness_threshold: 中央値以上の粒子のみ
max_connections_per_particle: 3
node_glow_color: rgba(212, 175, 55, 0.8)
node_glow_trigger: hover within 30px
node_glow_duration: 0.4s ease-out
```

### 6.7 流れ星

```
frequency: 60〜120s (Poisson, λ = 1/90)
length: 80〜200px
duration: 0.6〜1.2s
opacity_peak: 0.5
trail_fade: ease-out
direction: random angle, but 主に左下→右上 (60% 確率)
```

### 6.8 深度層数と parallax

```
layers: 3
parallax_strength:
  background: 0px
  midground:  ±1px (mouse 距離に比例)
  foreground: ±3px (mouse 距離に比例)
parallax_easing: 0.08 (低めで滑らか)
```

### 6.9 呼吸サイクル詳細

```
全体明度: ±5%
粒子サイズ: ±8%
constellation opacity: ±20%
流速: 0.85x 〜 1.15x
位相: 全粒子同位相（強）/ 個別位相（弱、推奨）
```

### 6.10 マウス連動

```
attraction_radius: 200px
attraction_strength: 0.012
trail_particle_spawn: cursor 速度 > 200px/s で発生
trail_lifetime: 0.8s
trail_size: 1.5〜3px
trail_color: moon
```

### 6.11 性能目安

```
target: 60fps
particles_max: 150 (desktop) / 80 (mobile)
constellation_lines_max: 60
bloom: post-process 1 pass のみ
canvas: OffscreenCanvas + requestAnimationFrame
mobile fallback: bloom OFF, constellation OFF, particles 50%
```

---

## 7. CSS 演出カタログ

### 7.1 Aurora swirl
```css
.aurora {
  position: fixed; inset: 0;
  background: conic-gradient(from 0deg at 50% 60%,
    transparent 0deg,
    rgba(180, 200, 255, 0.03) 60deg,
    transparent 120deg,
    rgba(220, 200, 255, 0.025) 200deg,
    transparent 280deg);
  filter: blur(40px);
  animation: aurora-rotate 90s linear infinite;
  mix-blend-mode: screen;
  pointer-events: none;
}
@keyframes aurora-rotate { to { transform: rotate(360deg); } }
```

### 7.2 Vignette（控えめ）
```css
.vignette::after {
  content: ''; position: fixed; inset: 0;
  background: radial-gradient(ellipse at center,
    transparent 50%, rgba(0,0,0,0.35) 100%);
  pointer-events: none;
}
```

### 7.3 Subtle starfield SVG overlay
```html
<svg class="starfield" preserveAspectRatio="none">
  <filter id="stars">
    <feTurbulence baseFrequency="0.9" numOctaves="1" seed="3"/>
    <feColorMatrix values="0 0 0 0 1
                           0 0 0 0 1
                           0 0 0 0 1
                           0 0 0 8 -7"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#stars)" opacity="0.15"/>
</svg>
```

### 7.4 浮遊する dust（CSS only）
```css
.dust { position: fixed; width: 2px; height: 2px;
  background: rgba(220, 220, 230, 0.25);
  border-radius: 50%; filter: blur(0.5px);
  animation: drift var(--dur, 18s) ease-in-out infinite; }
@keyframes drift {
  0%, 100% { transform: translate(0,0); }
  50% { transform: translate(var(--dx, 30px), var(--dy, -50px)); }
}
```

### 7.5 mouse-trail（光の尾）
```js
// pointermove で粒子 spawn、CSS animation で fade
// JS 必要だが CSS で fade 完結
```
```css
.trail-spark {
  position: fixed; width: 3px; height: 3px;
  background: radial-gradient(circle, rgba(240,238,220,0.6), transparent);
  animation: spark-fade 0.8s ease-out forwards;
  pointer-events: none;
}
@keyframes spark-fade { to { opacity: 0; transform: scale(2.5); } }
```

### 7.6 視差スクロール
```css
.layer-back  { transform: translateY(calc(var(--scroll) * 0.2px)); }
.layer-mid   { transform: translateY(calc(var(--scroll) * 0.5px)); }
.layer-front { transform: translateY(calc(var(--scroll) * 0.9px)); }
/* JS: document.documentElement.style.setProperty('--scroll', window.scrollY) */
```

### 7.7 Shimmer（Annihilation 風）
```html
<svg><filter id="shimmer">
  <feTurbulence baseFrequency="0.015" numOctaves="2">
    <animate attributeName="baseFrequency" values="0.015;0.025;0.015" dur="20s" repeatCount="indefinite"/>
  </feTurbulence>
  <feDisplacementMap in="SourceGraphic" scale="3"/>
</filter></svg>
```
特定要素に `filter: url(#shimmer)` 適用。重いので前景の数要素のみ。

### 7.8 Breath（全画面呼吸）
```css
@keyframes breath {
  0%, 100% { filter: brightness(0.97); }
  50% { filter: brightness(1.03); }
}
body { animation: breath 12s ease-in-out infinite; }
```

### 7.9 Fog edge（境界フェード）
```css
.fog-edge {
  mask-image: radial-gradient(ellipse at center,
    black 60%, transparent 100%);
}
```

---

## 8. 「最高に幻想的」の判定基準

実装後の自己レビュー用チェックリスト。

### 8.1 知覚チェック

- [ ] **5 秒見て、何が動いているか言語化できない**（理解可だと幻想消失）
- [ ] **画面の 30% 以上は何もない**（余白）
- [ ] **強い光は同時 5 点以下**
- [ ] **色は grey 系が 90%+**
- [ ] **マウス止めて 10 秒、世界が呼吸している**

### 8.2 美学チェック

- [ ] **幽玄**: 境界がぼけているか
- [ ] **物のあはれ**: 消える要素があるか
- [ ] **余白**: ボイド領域があるか
- [ ] **Sublime**: スケール感（粒子サイズ 2 桁以上分散）
- [ ] **観測者依存**: cursor/scroll で世界が変わるか

### 8.3 技術チェック

- [ ] 60fps（desktop, particles 150）
- [ ] 30fps 以上（mobile, particles 80）
- [ ] CLS < 0.05
- [ ] prefers-reduced-motion 対応（粒子静止、流れ星なし）
- [ ] tab 非表示で停止

### 8.4 inryokü 哲学チェック

- [ ] 「服を売る web」に見えないか（見えてはいけない）
- [ ] 「観測者を哲学者に変える」入口になっているか
- [ ] 騒がしくないか（静謐 99%）
- [ ] 安っぽくないか（cyberpunk 風 NG）
- [ ] 一目で「何かが違う」と感じるか

### 8.5 失敗パターン（避けるべき）

- ❌ 多色ネオン（cyberpunk 風）
- ❌ 等速回転（メカニカル）
- ❌ 派手な bloom（クリスマスツリー）
- ❌ 等間隔粒子（規則性が見える）
- ❌ 大量 constellation（ノイズ）
- ❌ 極端な parallax（酔う）
- ❌ 音（inryokü は音なし）

---

## 9. Codex 着手用 priority

P0（必須）:
1. 三層粒子（背景/中景/前景、log-normal）
2. Brownian + curl 動き
3. mouse parallax
4. breath 呼吸

P1（強推奨）:
5. constellation（距離 + 輝度条件）
6. bloom 控えめ
7. 流れ星

P2（余裕あれば）:
8. mouse trail
9. shimmer 微量
10. aurora swirl

---

## 10. 推測 vs 事実

**事実**:
- log-normal は自然界の分布（Limpert 2001）
- 中心窩 1° 以外の低解像度（visual neuroscience 標準）
- 量子場の zero-point fluctuation（QFT）
- cosmic web のフィラメント構造（Millennium Simulation）
- bioluminescence の機械感受性（marine biology）
- Edmund Burke "Philosophical Enquiry" (1757)

**推測 / 美学的判断**:
- 「99% 静 / 1% 煌めき」配分
- 12 秒呼吸サイクル
- 流れ星 60〜120 秒頻度
- bloom strength 0.35 / threshold 0.78
- 三層 50/35/15 配分

数値はすべて出発点。実装後 A/B で調整。

---

## 11. 申送り note

- このドキュメントは読み取り専用調査。実装は別タスク。
- 既存 `docs/light-bloom-tuning-2026-04-29.md` `docs/codex-shader-handoff-2026-04-29.md` と整合性確認のこと。
- 既存パラメータと衝突する場合は本書を「方向性提案」として扱い、既存数値を尊重。
- 実装着手時は本書 §6 のパラメータ表を参照。

— end —
