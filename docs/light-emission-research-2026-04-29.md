# 真の光らしい発光 — 物理・知覚・芸術の徹底調査と inryokü 適用カタログ

**作成日**: 2026-04-29
**対象**: inryokü プロジェクト（Three.js + CSS による「観測されたとき光る」体験設計）
**スコープ**: 読み取り専用研究ドキュメント。実装は別タスクで判断する。
**注記**: 「事実」と明示した箇所は物理・知覚科学の確立した知見。「推測」「設計判断」は筆者の解釈・提案。

---

## 目次

1. [Executive Summary — 結論先出し](#1-executive-summary)
2. [物理理論サマリ](#2-物理理論サマリ)
3. [知覚の科学](#3-知覚の科学)
4. [デジタル光の技法カタログ（30+ 技法）](#4-デジタル光の技法カタログ)
5. [WebGL / Three.js 実装パターン](#5-webgl--threejs-実装パターン)
6. [CSS / DOM 実現可能性マトリクス](#6-css--dom-実現可能性マトリクス)
7. [芸術参照（10+ 事例）](#7-芸術参照)
8. [inryokü 適用ガイド（哲学整合）](#8-inryokü-適用ガイド)
9. [「安っぽい光」vs「本物の光」鑑定基準](#9-鑑定基準)
10. [付録：用語集・参考文献](#10-付録)

---

## 1. Executive Summary

### 1.1 「本物の光」を構成する 7 要素（鑑定基準の核）

実装の良し悪しを決めるのは、派手さではなく以下の整合性である。

1. **線形空間で計算されているか**（事実：sRGB のまま加算すると物理的に間違う）
2. **HDR レンジで蓄積されているか**（事実：1.0 を超える光量を保持しないと bloom は嘘になる）
3. **色温度に整合があるか**（事実：黒体軌跡に乗らない色は「LED の安物」に見える）
4. **falloff が物理的に正しいか**（事実：1/r² が基本、近距離は bias で発散回避）
5. **散乱・霧があるか**（事実：真空の光は逆に偽物に見える。媒質が必要）
6. **観測者の knowing**（設計：誰が見るのか。視線、瞳孔、afterimage の演出）
7. **静寂とのコントラスト**（設計：暗の深さが光の深さを決める。grey の中に光がある）

### 1.2 inryokü における核心命題

- inryokü = 「見えないものの可視化」（メモリ参照）。
- 光は「観測者がいるから出現する」量子的隠喩として機能する。
- 50→101 体験 = 沈黙の grey から光への遷移。
- RGBCMY = 加法 3 原色（RGB）+ 減法 3 原色（CMY）= 光と物質の双対。

### 1.3 採用判断の優先度（推測：筆者の優先順位）

| Tier | 技法 | 理由 |
|------|------|------|
| S | 線形空間レンダリング、ACES tonemap、UnrealBloom | これがないと全部「安物」 |
| A | 色温度ベースのカラーパレット、soft falloff、additive blend | 物理整合 |
| A | CSS filter: drop-shadow 多層、SVG feGaussianBlur | DOM 側の限界 |
| B | god rays、volumetric、chromatic aberration | 文脈次第で過剰 |
| C | lens flare、星キラキラ | 「安物確定」リスク高、慎重に |

---

## 2. 物理理論サマリ

### 2.1 黒体放射 (Black-body Radiation)

**事実**：プランクの法則。温度 T の黒体が放射する分光放射輝度 B(λ, T) は

```
B(λ, T) = (2hc² / λ⁵) · 1 / (exp(hc / λkT) - 1)
```

- h: プランク定数 6.626e-34 J·s
- c: 光速 2.998e8 m/s
- k: ボルツマン定数 1.381e-23 J/K
- λ: 波長 [m]
- T: 絶対温度 [K]

**色温度の代表値**：

| 温度 | 色味 | 例 |
|------|------|-----|
| 1700K | 深いオレンジ | マッチの炎 |
| 2000K | オレンジ | 蝋燭、夕日 |
| 2700K | 暖白 | 白熱電球（タングステン） |
| 3200K | 暖白 | スタジオライト（タングステン） |
| 4000K | ニュートラル | 蛍光灯（昼白色） |
| 5000K | 昼光 | 水平太陽（D50） |
| 5500K | 昼光 | 写真標準（D55） |
| 6500K | 昼光 | sRGB 白色点（D65） |
| 7500K | 寒色 | 曇天 |
| 10000K | 青白 | 晴天日陰、青空 |
| 20000K+ | 青 | 高山の青空、若い恒星 |

**CIE 1931 xy 色度座標での黒体軌跡 (Planckian locus)**：

近似式（McCamy 1992 の逆）で T → (x, y) を求められる。実装上は LUT で十分。

**設計指針（inryokü）**：
- inryokü のコア発光は **5000K-6500K 寄り**（中性、知性、観測の白）が哲学に合う。
- アクセントに **2700K**（人間の暖かさ、灯火）と **9000K**（冷たい知性、青空）。
- **絶対避けるべき**：3500K の蛍光灯っぽい緑被り → コンビニ感。

### 2.2 ガウス分布としての光

**事実**：理想的な点光源を有限ピクセルにレンダリングすると、
カメラの PSF (Point Spread Function) は近似的にガウス：

```
G(x, y) = (1 / (2πσ²)) · exp(-(x² + y²) / (2σ²))
```

bloom はこの PSF を画像全体に畳み込んだもの、と理解できる。
σ が大きいほど「眩しい」印象。実装上は separable Gaussian (横→縦 2 pass) で O(n) に。

**多重ガウスの和 = より物理的**：実カメラの PSF はガウス単体ではなく、コア + 大域ハロー。
複数 σ のガウスを重み付け加算すると本物っぽくなる（UnrealBloom はこれをやっている）。

### 2.3 HDR と線形空間

**事実**：人間が認識する色は sRGB (gamma ~2.2) で符号化されているが、**光の物理は線形空間で起こる**。

```
linear = pow(sRGB, 2.2)            // decode
sRGB   = pow(linear, 1.0 / 2.2)    // encode
```

正確には sRGB は 0.04045 以下が線形セグメント、それ以上が gamma 2.4 のべき乗。

**HDR の意味**：
- LDR（Low Dynamic Range）：[0.0, 1.0]
- HDR（High Dynamic Range）：[0.0, ∞)（実装上は float16 / float32）
- 太陽の輝度は地表で約 100,000 nits、ディスプレイは 100-1000 nits。**3-4 桁差**。

**Three.js での設定**：
```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
// テクスチャを読むときは
texture.colorSpace = THREE.SRGBColorSpace;
```

### 2.4 トーンマッピング

線形 HDR → 表示可能 LDR への圧縮。代表的なオペレーター：

#### 2.4.1 Reinhard

```
L_out = L_in / (1 + L_in)
```

シンプル、ハイライトを 1 に漸近させる。ややフラット。

#### 2.4.2 Reinhard Extended

```
L_out = L_in · (1 + L_in / L_white²) / (1 + L_in)
```

`L_white` 以上を完全に飽和させる。コントロール可能。

#### 2.4.3 Filmic (Hable / Uncharted 2)

```
A = 0.15; B = 0.50; C = 0.10; D = 0.20; E = 0.02; F = 0.30;
F(x) = ((x(Ax + CB) + DE) / (x(Ax + B) + DF)) - E/F;
```

シャドウを締めハイライトを伸ばす。映画的。

#### 2.4.4 ACES (Academy Color Encoding System)

実写映画標準。簡略化版（Narkowicz 2015）：

```
const float a = 2.51;
const float b = 0.03;
const float c = 2.43;
const float d = 0.59;
const float e = 0.14;
vec3 ACES(vec3 x) {
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
```

**inryokü 推奨**：ACES Filmic。シャドウが沈み、ハイライトが鈍く伸びる。grey + 光の哲学に最適。
Reinhard は雰囲気が「軽い」。Filmic は重厚。

### 2.5 光源の falloff

**事実**：点光源（実用上の太陽以外の全光源）は **逆二乗則** に従う：

```
I(r) = P / (4π r²)        // 点光源の照度（W/m²）
```

**実装上の罠**：
- r=0 で発散 → `I = P / (r² + ε)` または `I = P / max(r², ε)`
- 物理的に正しいのに「暗すぎる」と感じる場合、線形空間で計算していないかチェック。
- ゲーム実装では `(1 - (r/R_max)²)²` のような **smooth falloff** で打ち切る（人工的だが破綻しない）。

**Three.js**:
```js
const light = new THREE.PointLight(color, intensity, distance, decay);
// decay = 2 が物理的（逆二乗）。デフォルト 2。
// distance = 0 で無限大、有効値で smooth cutoff。
```

### 2.6 散乱：Mie / Rayleigh

**事実**：光が媒質中を進むとき、粒子サイズによって散乱の波長依存性が変わる。

#### 2.6.1 Rayleigh 散乱

粒子サイズ << 波長（空気分子）。散乱断面積は **λ⁻⁴** に比例。

```
σ_R(λ) ∝ 1 / λ⁴
```

→ 短波長（青）が強く散乱される → **空が青い**、**夕日が赤い**（青が散乱で抜けた残り）。

#### 2.6.2 Mie 散乱

粒子サイズ ≈ 波長（水滴、エアロゾル、霧）。波長依存性が弱く、前方散乱が強い。

```
phase_HG(θ) = (1 - g²) / (4π · (1 + g² - 2g cos θ)^(3/2))
```

Henyey-Greenstein 位相関数。`g ∈ [-1, 1]`、`g > 0` で前方散乱。

**「霧の中の光」が美しい理由**：Mie 散乱により光源近傍の空気自体が光って見える。
これが **god rays** の物理的根拠。

**inryokü 設計**：grey の地に発光を置くとき、わずかに「霧」を仕込むと光が深くなる。
具体的には post-process で輝度の高い領域から radial blur を出す（god rays）。

### 2.7 偏光・回折・干渉

**事実**：これらは「虹色」「玉虫色」の物理的根拠。

- **干渉**：薄膜（石鹸膜、CD）、距離差による位相のずれで波長選択的に強め合う／弱め合う。
- **回折**：開口・障害物で波が広がる。レンズの絞り羽根 → 星型ボケ → スタービュー（後述）。
- **偏光**：光波の振動方向。空の青は部分偏光している（偏光フィルムで暗くなる）。

**虹色グラデの物理的本質**：薄膜干渉での波長選択。実装上は HSL で hue を回すだけだと薄っぺらい。
**反射角依存性**を持たせると本物っぽい：

```glsl
float ndotv = dot(normal, viewDir);
vec3 iridescent = hsl2rgb(vec3(ndotv * 0.3 + 0.5, 0.7, 0.6));
```

**inryokü 警告**：虹色は「Pride」「メタリック」「ホログラム」の文脈を強く想起させる。
inryokü の静謐に虹色を持ち込むなら、**極めて低彩度・極めて狭いレンジ**でのみ。

### 2.8 ブルーム（フルエクスポージャー）

**事実**：ブルームは光学現象＋知覚現象の混合。
- **光学**：レンズ内散乱、CCD/CMOS のセンサー spill。
- **知覚**：眼球内散乱（後述）。

実装上は次の擬似コードに集約される：

```
1. シーンを HDR でレンダ
2. 輝度しきい値 T を超えたピクセルだけ抽出（threshold）
3. 解像度を下げながら Gaussian blur を多段（mip chain）
4. 加算して元シーンに足し戻す（strength）
```

**重要**：threshold は **線形空間** の値。1.5-3.0 程度が目安。
sRGB 値で考えると 0.85 を超えるくらい。

---

## 3. 知覚の科学

### 3.1 ガンマ補正と人間の応答

**事実**：人間の輝度応答はおおむねべき乗的。CRT のべき乗特性と一致したのは偶然ではなく、設計の整合。
sRGB の 2.2 は近似。実際の網膜応答は明所・暗所で異なる（Stevens のべき乗則、輝度では γ ≈ 0.33）。

実用上：**画像処理は線形、表示は sRGB**。これを守るだけで品質が一段上がる。

### 3.2 暗順応・明順応

**事実**：
- **明順応 (light adaptation)**：明所→暗所、約 5-10 分で大幅進行、完全には 30 分以上。
- **暗順応 (dark adaptation)**：暗所→明所、数秒で粗く完了。
- 桿体細胞（暗所）と錐体細胞（明所）の切替（Purkinje shift）は 507nm 付近にピーク移動。

**演出への適用**：
- 「暗い画面に光が出現」は数秒で目が慣れて bloom 効果が薄れる → **動的露出 (auto exposure)** で補正するか、
  あえて慣れさせて静寂を演出する。
- 50→101 遷移：grey に長く滞在 → 暗順応 → わずかな光でも強く感じる。

### 3.3 残像 (Afterimage)

**事実**：強い光を見た後の残像は補色に近い色を持つ（陰性残像）。
網膜の局所順応とオプポーネントカラー機構による。

**演出**：演出としての afterimage はパーティクル trail と等価。位置情報を 1-2 秒保持してフェード。

### 3.4 網膜散乱 (Retinal scattering / Veiling glare)

**事実**：直視光源は眼内（角膜、水晶体、硝子体）で散乱し、網膜上に光のハロー (veil) を作る。
これは **bloom が美しく感じる根本理由**。脳は「明るい」=「散乱ハローがある」と学習している。

**実装の含意**：bloom がないと「明るい白いピクセル」は単なる白い四角。
逆に、threshold が低すぎる bloom は **全体が霞む** = 眼が常に散乱している = 不快。

### 3.5 視野残像 (Persistence of vision)

**事実**：網膜の応答時間 ~50ms。これがモーションブラー、24fps 映画、CRT のフリッカー閾値の根拠。

**演出**：
- 速い動きには **motion blur** または trail。
- 強い光の点滅は ~30Hz 以下にしないと「ちらつき」として認識されてしまう。

### 3.6 サッカード (Saccade) と中心窩

**事実**：眼球は秒間 3-4 回サッカード（高速跳躍）。サッカード中は視覚情報が抑制される (saccadic suppression)。
中心窩 (fovea) のみ高解像度で、それ以外は色・動きに敏感だが解像度は低い。

**演出**：
- 周辺視では **動き（揺らぎ）** が強く知覚される → grey に微細な揺らぎを散らすと「気配」になる。
- 中心視では **解像度・色** が強く知覚される → 注視点に色温度の整った光を置く。

### 3.7 グレア (Glare) の段階

**Disability glare**（視機能を阻害）と **Discomfort glare**（不快だが見える）がある。
inryokü は明確に **Discomfort 寄りも Disability 寄りも避ける**。「畏れ」ではなく「沈黙」が哲学。

---

## 4. デジタル光の技法カタログ

各技法に **物理的根拠**、**実装難度**、**安物リスク**、**inryokü 適合度**を付す。

### 4.1 加算合成 (Additive Blending)

- **物理根拠**：光は重なれば足される（線形）。
- **実装**：`blendFunc(SRC_ALPHA, ONE)` または GL の `ADD`。
- **CSS**：`mix-blend-mode: screen` / `lighten` / `plus-lighter`。
- **安物リスク**：低。基礎技法。
- **inryokü**：★★★★★ 必須。

### 4.2 スクリーン合成 (Screen Blending)

```
result = 1 - (1 - a) * (1 - b)
```

加算より上限飽和が緩やか。LDR 画像に対する近似的「光の合成」。
HDR ならば加算が物理的。LDR では screen が破綻しにくい。

### 4.3 乗算合成 (Multiply)

光ではなく **物質の透過** を表す（フィルター、影）。光の発光には使わない。

### 4.4 Bloom (Multi-pass Gaussian Blur)

- **アルゴリズム**：threshold → downsample 5-7 段 → 各段で Gaussian blur → 上向きに加算。
- **パラメータ**：threshold（輝度しきい）、strength（強度）、radius（半径）。
- **安物リスク**：中。**全体に効きすぎる** と眠い画像になる（threshold が低すぎる罠）。
- **inryokü**：★★★★★ コア技法。threshold を高めに、半径は広めに。

### 4.5 ACES Tonemap

前述。

### 4.6 Lens Flare (光学的アーティファクト)

カメラのレンズ間反射による **ゴースト**。
- **物理根拠**：あり。だが「カメラが介在することの強調」になる。
- **安物リスク**：★★★★★（高）。Adobe After Effects の lens flare は極めて陳腐化している。
- **inryokü**：原則 **使わない**。物語が「映像」になり、観測者と光の直接性が壊れる。

### 4.7 Anamorphic Streak

横長の bloom（シネマカメラのアナモルフィックレンズ風）。
ブレラン 2049、Cyberpunk 2077 で多用。**強い文脈を持つ** ので無前提で使うとサイバーパンクに見える。
- **inryokü**：使うなら **垂直軸** に短く控えめに（重力・時間軸の暗示）。

### 4.8 Chromatic Aberration

レンズの波長分散による縁の RGB ずれ。**強いカメラ感**。
- **inryokü**：使わない、または極微量（subpixel 1-2px）。

### 4.9 God Rays / Volumetric Light

- **物理根拠**：Mie 散乱（霧の中の光柱）。
- **実装**：radial blur from light source / 真面目には ray-march。
- **安物リスク**：中。光源から放射状に伸ばすだけだと「シャワー」っぽくなる。
- **inryokü**：★★★★（高い）。grey に深さを与える。

### 4.10 Rim Light / Fresnel Glow

縁が光る。`pow(1.0 - dot(N, V), k)`。
- **物理根拠**：あり（フレネル反射、SSS の縁透過）。
- **安物リスク**：低-中。`k` が小さすぎるとオーラっぽい。
- **inryokü**：★★★★ 観測者依存性の暗喩に合う（縁＝視線との接点）。

### 4.11 Soft Particle / Soft Edge

距離が近づくと α を下げる（深度交差時の縁立ちを防ぐ）。
- 物理根拠：粒子は固体ではないので近接で透過するという近似。
- 必須技法。

### 4.12 Point Sprite + Soft Texture

各粒子を 4 頂点 quad で billboard、α テクスチャ（中心→周辺で 1→0 のガウス）。
- **inryokü**：パーティクルベース発光のコア。

### 4.13 Particle Trail / Streak

粒子の移動履歴を α で残す。**速度感**＋**残像感**。

### 4.14 Halo (Radial Gradient)

CSS でも Three.js でも実装可能な「光源の周りの円形薄明」。
複数層・色温度違いで重ねると深くなる。

### 4.15 Starburst / Aperture Flare

レンズ絞りの回折。**6-8 本の光条**。
- **安物リスク**：高。「キラッ」素材は陳腐の代表格。
- **inryokü**：原則使わない。

### 4.16 Caustics

水面・透明物体を通した光が床に作る網目。inryokü のスコープ外（ただし grey 床にうっすらは美しい）。

### 4.17 Subsurface Scattering (SSS)

物体内部での光の散乱。蝋・肌・ミルク・大理石。
- **inryokü**：★★★★ 「物質の内側に光がある」表現は哲学に直結する。
  リアルタイム近似は wrap lighting や Burley curvature 法。

### 4.18 Emissive Map / Self-illumination

メッシュの一部だけ発光。bloom と組み合わせ。

### 4.19 Light Probe / IBL (Image-Based Lighting)

環境マップを光源として使う。inryokü のような閉じた抽象空間には過剰だが、
**極低周波 (3rd-order SH)** の極めて穏やかなライティングは grey の質感に効く。

### 4.20 Screen-Space Ambient Occlusion (SSAO)

「光のなさ」の表現。発光強調の裏返し。

### 4.21 Auto Exposure / Eye Adaptation

シーン平均輝度に応じて露出を動的調整。
- **inryokü**：状況遷移（grey→光出現）の演出に使える。慣れさせて、また奪う。

### 4.22 Dithering / Blue-noise

bloom や gradient のバンディング（縞）を防ぐ。1bit の青色ノイズを加算。
- **必須**：8bit 出力時のグラデは必ずバンドが出る。

### 4.23 Filmic Grain

弱い加算ノイズ。フィルム感。
- **安物リスク**：高。**雑にやると古臭い**。inryokü では極微（α=0.02-0.04 の青ノイズ）。

### 4.24 Vignette

周辺減光。注視を中心に誘導。
- **安物リスク**：中。強いと「インスタフィルター」。

### 4.25 Dynamic Range Compression (DRC)

ハイライト保存しつつ全体露出を上げる。auto exposure と一体。

### 4.26 Hue-shift in Brightness

明るくなるほど hue が黄色〜白へシフトする物理現象（黒体軌跡）。
hue を線形に保ったまま明度だけ上げると「LED の安物」になる。
- **実装**：明度関数として hue を補正するカラーグレーディング。

### 4.27 Color Grading LUT

3D LUT による全体色調整。映画的仕上げ。

### 4.28 Light Shaft from Window

特定の方向から falloff する god rays。Vermeer 的光線。

### 4.29 Caustic Noise (Animated)

水面下の動く明暗。perlin noise を加算合成。

### 4.30 Bokeh DoF

被写界深度。ボケの形が絞り形。
- **inryokü**：使うなら極控えめ（abstract に DoF はくどい）。

### 4.31 Motion Blur

カメラ／オブジェクト動きに応じた blur。視覚の persistence 模倣。

### 4.32 Particle Soft Light Volume

数百〜数千の半透明 billboard を重ねて「光の体積」を作る。**灰の中の光**に最適。

### 4.33 Edge Glow (Outline Bloom)

エッジ検出 → そのエッジだけ bloom 強化。
- **inryokü**：★★★ 注視オブジェクトに使える。

### 4.34 Iridescence / Thin-film

前述。慎重に。

---

## 5. WebGL / Three.js 実装パターン

### 5.1 EffectComposer の標準チェーン

```js
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8,   // strength
  0.6,   // radius
  0.85   // threshold (linear)
);
composer.addPass(bloom);

composer.addPass(new OutputPass()); // tone-mapping + sRGB encode
```

**重要**：`OutputPass` は最後に置く。tone mapping は線形 → sRGB 変換と一体。

### 5.2 UnrealBloomPass の中身

擬似的に：
```
1. brightPass: 入力から threshold 以下を 0 に
2. blurPass × 5 段: 解像度を 1/2, 1/4, ... に下げ各々 separable Gaussian
3. compositePass: 各段を radius/strength で重み付け加算
```

つまり **multi-scale Gaussian pyramid**。Activate Mip blur が肝。

### 5.3 Additive Particles

```js
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  size: 0.05,
  map: softCircleTexture,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,           // 重要：加算は深度書き込みしない
  depthTest: true,
  color: 0xffffff,
  toneMapped: true,            // HDR→tonemap で扱う
});
material.color.multiplyScalar(2.0); // HDR 相当（>1.0）

const points = new THREE.Points(geometry, material);
scene.add(points);
```

### 5.4 ShaderMaterial で柔らかい点光源

```glsl
// fragment
varying vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity;

void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float r = length(c);
  // ガウシアンに近い soft falloff
  float a = exp(-r * r * 16.0);
  vec3 col = uColor * uIntensity * a;
  gl_FragColor = vec4(col, a);
}
```

`gl_PointCoord` が point sprite の UV [0,1]^2。中心からの距離で α を作る。

### 5.5 InstancedMesh で高速大量光源

```js
const mesh = new THREE.InstancedMesh(quadGeo, glowMat, 10000);
const dummy = new THREE.Object3D();
for (let i = 0; i < 10000; i++) {
  dummy.position.set(...);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
  mesh.setColorAt(i, color);
}
mesh.instanceMatrix.needsUpdate = true;
```

### 5.6 Selective Bloom（一部のみ光らせる）

UnrealBloom は全画面に効くので、特定オブジェクトのみ光らせるには **Layer 分離**：

```js
const BLOOM_LAYER = 1;
glowMesh.layers.enable(BLOOM_LAYER);

// 1st pass: BLOOM_LAYER のみで render → bloom
// 2nd pass: 通常 layer で render → 上に bloom 結果を加算
```

`SelectiveUnrealBloom` の例コードが three.js examples にある。

### 5.7 God Rays (Volumetric Light Scattering, Mitchell 2007)

```glsl
// post-process: 光源スクリーン位置から放射状に sample しつつ減衰
vec2 lightPos = uLightScreenPos;
vec2 deltaUV = (vUv - lightPos) / float(NUM_SAMPLES) * uDensity;
vec2 uv = vUv;
float decay = 1.0;
vec4 col = texture2D(uOcclusion, uv);
for (int i = 0; i < NUM_SAMPLES; i++) {
  uv -= deltaUV;
  vec4 s = texture2D(uOcclusion, uv) * decay * uWeight;
  col += s;
  decay *= uDecay;
}
gl_FragColor = col * uExposure;
```

`uOcclusion` は光源以外を黒で塗りつぶしたテクスチャ。

### 5.8 Volumetric Fog (Henyey-Greenstein)

```glsl
// ray-march
float phaseHG(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0*g*cosTheta, 1.5));
}
// 各サンプルで光源までの距離 → phase で散乱寄与計算
```

### 5.9 Chromatic Aberration

```glsl
vec2 dir = vUv - 0.5;
float r = texture2D(tex, vUv + dir * 0.003).r;
float g = texture2D(tex, vUv).g;
float b = texture2D(tex, vUv - dir * 0.003).b;
gl_FragColor = vec4(r, g, b, 1.0);
```

### 5.10 Dithering (Blue-noise)

```glsl
float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
vec3 col = ...;
col += (rand(gl_FragCoord.xy) - 0.5) / 255.0;
gl_FragColor = vec4(col, 1.0);
```

### 5.11 ACES in shader

```glsl
vec3 ACES(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
gl_FragColor = vec4(pow(ACES(hdr), vec3(1.0/2.2)), 1.0);
```

Three.js の `ACESFilmicToneMapping` がこれをやってくれる。

### 5.12 MRT (Multiple Render Targets, WebGL2)

複数のテクスチャに同時に書き出す。Bloom 用に通常色 + emission を分離：

```js
const renderTarget = new THREE.WebGLMultipleRenderTargets(w, h, 2);
// shader で
// layout(location = 0) out vec4 gColor;
// layout(location = 1) out vec4 gEmission;
```

Selective Bloom が安価に。

### 5.13 MSAA / FXAA / SMAA

- MSAA：HW、bloom 前のジオメトリエッジに有効。
- FXAA / SMAA：post-process、bloom 後の最終仕上げ。
- **重要**：bloom がエッジを和らげるので、faint シーンなら FXAA 不要なことも。

### 5.14 Bayer Dithering Bloom

```
Bayer 4x4 行列でしきい値を変調 → bloom が滑らかに
```

帯感を消すレシピ。

### 5.15 Soft Particles 実装

```glsl
float sceneZ = readDepth(uDepthTex, screenUV);
float fragZ = ...;
float softness = saturate((sceneZ - fragZ) / uSoftness);
gl_FragColor.a *= softness;
```

### 5.16 GPGPU Particle (FBO ping-pong)

位置を float texture に書き、毎フレーム update shader で進める。
inryokü の「観測者依存パーティクル」に向く。

### 5.17 Three.js Lights

| ライト | 用途 |
|--------|------|
| AmbientLight | 全体オフセット。inryokü の grey ベース |
| HemisphereLight | 上下色違い、抽象空間に効く |
| DirectionalLight | 平行光、太陽 |
| PointLight | 点光源、`decay=2` |
| SpotLight | スポット |
| RectAreaLight | 面光源（PBR 専用） |

### 5.18 Reinhard 拡張をシェーダで

```glsl
vec3 reinhardExt(vec3 x, float Lwhite) {
  return x * (1.0 + x / (Lwhite * Lwhite)) / (1.0 + x);
}
```

### 5.19 Bloom の thresholdSmooth

UnrealBloomPass は内部で `smoothstep(threshold - knee, threshold + knee, luma)` の様な
ソフトしきい値を持つ。ハードしきい値だとちらつく。

### 5.20 PMREM / Prefiltered Environment Map

IBL の roughness 別 mip。inryokü には過剰だが、SSS ガラスを置くなら必須。

---

## 6. CSS / DOM 実現可能性マトリクス

| 技法 | CSS 実現可能性 | 手段 | 限界 |
|------|---------------|------|------|
| 単色発光 | ◎ | `box-shadow`, `filter: drop-shadow` | sRGB 圧縮、HDR 不可 |
| 多層ハロー | ◎ | `drop-shadow` × 複数 / `box-shadow` × 複数 | パフォーマンス |
| ぼかし | ◎ | `filter: blur(Npx)` | radius >50px でコスト増 |
| Gaussian Blur | ○ | `filter: blur` または SVG `feGaussianBlur` | exact stdDeviation 制御は SVG 側 |
| 加算合成 | ◎ | `mix-blend-mode: screen` / `plus-lighter` | sRGB 空間での合成（厳密ではない） |
| 真の HDR Bloom | × | 不可 | LDR のみ |
| Tone mapping | △ | LUT を SVG `feColorMatrix` / `feComponentTransfer` | 動的露出は不可 |
| 動く揺らぎ | ◎ | `animation`, `@keyframes` | jank なら GPU 化 |
| 形状制御 | ○ | `clip-path`, `mask-image` | 滑らかなアルファは画像必要 |
| Backdrop ぼかし | ◎ | `backdrop-filter: blur()` | iOS で重い |
| 虹色 | ○ | `conic-gradient`, `linear-gradient` | 物理的整合は手動 |
| Chromatic aberration | ○ | SVG `feOffset` × 3 + `feBlend` | パフォーマンス |
| God rays | △ | SVG `feSpecularLighting` + ぼかし | リアルさに限界 |
| Lens flare | ○ | 画像オーバーレイ | 文字通り「画像」 |
| Particle | △ | 大量 DOM は遅い、Canvas が現実 | DOM 数百が限界 |
| 動的露出 | × | 不可 | JS で輝度測定すれば擬似的に |
| ACES | × | 完全には不可 | LUT で近似 |

### 6.1 CSS 多層 drop-shadow による自然な発光

```css
.glow {
  filter:
    drop-shadow(0 0 2px rgba(255, 240, 220, 0.9))
    drop-shadow(0 0 8px rgba(255, 220, 180, 0.6))
    drop-shadow(0 0 24px rgba(255, 200, 150, 0.4))
    drop-shadow(0 0 64px rgba(255, 180, 120, 0.2));
}
```

**ポイント**：
1. **半径を指数的に**（2 → 8 → 24 → 64）。これが multi-scale gaussian pyramid の代用。
2. **色を黒体軌跡に乗せる**：内側ほど白く、外側ほど暖色（短波長は遠くで散乱して抜ける現象の模倣）。
3. **α を内側ほど強く**：核を保つ。

### 6.2 SVG feGaussianBlur + feMerge

```html
<svg>
  <defs>
    <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b1"/>
      <feGaussianBlur stdDeviation="12" in="SourceGraphic" result="b2"/>
      <feGaussianBlur stdDeviation="32" in="SourceGraphic" result="b3"/>
      <feMerge>
        <feMergeNode in="b3"/>
        <feMergeNode in="b2"/>
        <feMergeNode in="b1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <text filter="url(#bloom)">inryokü</text>
</svg>
```

**filter の x/y/width/height**：bloom の半径だけ拡張する必要がある。
デフォルトの `-10%/120%` だと外側が切れる。

### 6.3 mix-blend-mode による加算

```css
.layer {
  mix-blend-mode: screen; /* または plus-lighter */
}
```

`plus-lighter` は CSS Compositing Level 2 で、より物理に近い加算（線形空間ではないが近似）。

### 6.4 backdrop-filter による「光のにじみ」

```css
.glow-volume {
  backdrop-filter: blur(8px) brightness(1.1) saturate(0.9);
  background: radial-gradient(circle, rgba(255,255,240,0.1), transparent);
}
```

背景を取り込みつつ、**光源越しに後ろが滲む** 表現。霧の擬似。

### 6.5 radial-gradient による疑似 PSF

```css
.halo {
  background: radial-gradient(
    circle,
    rgba(255, 240, 220, 1.0) 0%,
    rgba(255, 220, 180, 0.6) 8%,
    rgba(255, 200, 150, 0.2) 24%,
    rgba(255, 180, 120, 0.05) 60%,
    transparent 100%
  );
}
```

ストップを物理 PSF に合わせる：中心 1.0、急速減衰、長い裾。

### 6.6 揺らぎ（CSS animation）

```css
@keyframes flicker {
  0%, 100% { opacity: 1.0; filter: brightness(1.0); }
  37%      { opacity: 0.92; filter: brightness(1.05); }
  61%      { opacity: 0.97; filter: brightness(0.98); }
}
.flame { animation: flicker 2.7s ease-in-out infinite; }
```

**ポイント**：
- **非整数の周期**（2.7s）→ ループ感を消す。
- 0/100 を同値に、中間に複数ステップ。
- 振幅は **小さく**（±5-10%）。大きいと「点滅」になり安物。

### 6.7 conic-gradient で薄い虹

```css
.iris {
  background: conic-gradient(
    from 90deg,
    hsl(40, 30%, 80%),
    hsl(100, 25%, 78%),
    hsl(180, 20%, 78%),
    hsl(260, 25%, 78%),
    hsl(340, 30%, 80%),
    hsl(40, 30%, 80%)
  );
  filter: blur(40px);
}
```

低彩度 + 大きな blur で「気配の虹」。grey 寄り。

### 6.8 clip-path で形を残す

```css
.shard {
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  filter: drop-shadow(...);
}
```

`clip-path` の境界が drop-shadow で発光する。

### 6.9 CSS の限界の本質

CSS は **sRGB 空間** で合成する（一部 `color()` 関数で linear sRGB を扱える方向にある）。
HDR がないため：

- 加算で 1.0 を超えても **クランプされる** → bloom の物理的な「眩しさ」は再現できない。
- ただし、人間の知覚は近似で誤魔化せる。**多層 shadow + screen blend** で十分美しい。

---

## 7. 芸術参照

### 7.1 James Turrell

光そのものを彫刻する。Ganzfeld、Skyspace、Aten Reign。
**示唆**：媒体を見せず、知覚だけを残す。inryokü の「物質の不在に光がある」と直結。
**実装ヒント**：背景に巨大なソフトグラデ。エッジを完全に消す。`filter: blur(200px)` レベル。

### 7.2 Olafur Eliasson

The Weather Project（Tate Modern, 2003）。霧と片色光（589nm ナトリウムランプ）。
**示唆**：単色光は色覚を退化させ、観測者を意識化する。grey と単色の関係。
**実装ヒント**：シーン全体を一時的に **モノクロマティック** にする瞬間を作る（ある色温度に支配）。

### 7.3 日本：幽玄・余白・もののあはれ

- **幽玄**（世阿弥）：見えないものに本質。inryokü の核。
- **余白**：描かれない領域が描かれた領域を成立させる。
- **もののあはれ**：消えゆくものへの感受性。光が「現れて消える」演出。

**実装ヒント**：光を **持続させない**。出現 → 短い滞在 → ゆっくりフェード（指数 EaseOut）。

### 7.4 茶室（千利休）

暗い空間に微弱光。閉じ目で開く感覚。窓 1 つの光線。
**実装ヒント**：画面の 80% は grey、光は 20% 以下の面積。集中。

### 7.5 Hubble / JWST

宇宙写真の発光は **多重露光合成 + 偽色** だが、構造の真実は美しい。
- 渦巻銀河の星間散乱は完全に Mie 散乱の天文版。
- JWST の回折スパイク（6 本）は鏡面の物理。

**示唆**：科学画像は構造の honesty で美しい。**信号の抽出 = 観測**。
inryokü の「観測者がいるから出現」と整合。

### 7.6 細胞蛍光顕微鏡

GFP, RFP, DAPI などの蛍光タンパクで標識された細胞。
- 黒の中に微弱な色つき発光。
- **核 + 細胞質 + 細胞骨格** の重ね合わせ。
- 各色が **独立した観測軸**（excitation/emission のチャンネル分離）。

**示唆**：inryokü の RGBCMY 6 色を **6 つの観測チャンネル** として扱える。
それぞれが異なる「見えないもの」の可視化。

### 7.7 量子場可視化（教育系アート）

ファインマン図、確率密度雲、フェルミオン場。
存在自体が確率的にしか表現できない。**観測 = 波束の収縮**。

**示唆**：inryokü の「観測者依存」は量子論の比喩であって良い。
パーティクルの位置を観測されるまで揺らがせる演出は philosophically deep。

### 7.8 Cyberpunk 2077

- ネオンサイン：ハイサチュレーション、高彩度ピンク・シアン。
- 霧 + 雨 + ネオン = god rays の楽園。
- **アナモルフィック横長フレア** が文化的記号化。

**示唆**：高彩度ネオンは inryokü の対極。**何を捨てるか** の参照として有用。

### 7.9 Blade Runner 2049 (Roger Deakins)

- 巨大単色光面（Las Vegas のオレンジ砂塵シーン）。
- 霧の中の構造光（god rays）。
- 影の深さで光を立てる。

**示唆**：**単色支配 + 霧 + 深い影**。inryokü が学ぶべき教科書。

### 7.10 Tarkovsky『Stalker』『Solaris』

- 室内の **窓からの単一光源**。
- 物質（水、葉、肌）に光が宿る。
- 動かない長回し → 観測の時間。

**示唆**：時間を引き延ばす。光は素早くは到来しない。

### 7.11 Mark Rothko

色面の光。エッジが滲み、面そのものが発光しているように見える。
**実装ヒント**：色面の境界に **極めて広い blur**（>100px）。境界を曖昧化。

### 7.12 Anish Kapoor『Cloud Gate』『Descent into Limbo』

反射と無反射（Vantablack）。光と非光の極限。
**示唆**：grey の中の **黒** も光と同等に重要。深い黒を描けないと光は浮かない。

### 7.13 ヒルマ・アフ・クリント

抽象絵画、神智学的記号、観測されない世界の visualizations。
**示唆**：inryokü の哲学に近い：**感覚以前の構造の visualisation**。

### 7.14 京都の苔寺

緑と影のグラデ。光は隙間から差すのみ。
**示唆**：自然と都市の中間に inryokü の grey は存在する。

---

## 8. inryokü 適用ガイド

### 8.1 哲学的整合チェックリスト

光を加える前に問う：

- [ ] それは **観測者がいるから出現する** か？（常時光は退屈）
- [ ] それは **静寂を破壊しない** か？（grey の支配を尊重）
- [ ] それは **フィルター** ではなく **物質** か？（lens flare は物語を壊す）
- [ ] それは **時間を引き延ばす** か？（短いフラッシュは TikTok 的）
- [ ] それは **誰かのフルネームを書いていない** か？（メモリ準拠）

### 8.2 6 色 RGBCMY の物理的意味（提案）

| 色 | 波長帯 | 物理 | 哲学的意味（提案） |
|----|--------|------|---------------------|
| R 赤 | 620-750nm | 長波長、霧を抜ける、夕日 | 終わり、肉体、温度 |
| G 緑 | 495-570nm | 視感度ピーク 555nm | 中庸、生命、観測の中心 |
| B 青 | 450-495nm | 短波長、Rayleigh で散乱 | 距離、空、知性 |
| C シアン | 490nm | R の補色（吸収する） | R の不在 |
| M マゼンタ | スペクトル外 | スペクトルにない、脳の合成色 | **存在しない色＝可視化** |
| Y 黄 | 570-590nm | R+G、太陽中心 | 観測の極、現在 |

**inryokü 哲学的核**：**マゼンタは物理スペクトルに存在しない、脳が合成する色**。
inryokü = 見えないものの可視化 とまさに同型。

### 8.3 50→101 体験の光設計（提案）

| Phase | 数値 | 視覚状態 | 光の演出 |
|-------|------|----------|---------|
| Resting | 50 | grey 主導、光なし | AmbientLight 0.05 のみ |
| Approach | 60-70 | 周辺視に微小揺らぎ | 低輝度パーティクル数粒 |
| Recognition | 80-90 | 中心視に光出現 | bloom threshold 突破、单色（5500K） |
| Emergence | 95-100 | 6 色が分化 | RGBCMY が独立軸として現れる |
| Crossing | 101 | 全色統合、白へ | bloom radius 増、tone map で穏やかにロールオフ |

**重要**：101 で「白に飽和して全部見えない」は失敗。**白の中に色がまだ感じられる** が成功。
ACES のロールオフが優しいのが効く（Reinhard 単純版だと飽和が早すぎる）。

### 8.4 grey + 発光の配色ガイド

- **grey の正確な値**：`#3a3a3a`〜`#5a5a5a`（推測：実装側で確認推奨）。
- **発光のホワイトポイント**：D65 (6500K) を基準、暖か方向に少しシフト（5500-6500K）。
- **絶対避ける**：純白 `#ffffff` の発光。tone map 後でも `#fafaf2` 程度に黄色を残す。

### 8.5 観測者依存性の実装（提案）

JS：
```js
// マウス／視線（前提：フォーカス可能）→ パーティクルが発光
particles.forEach(p => {
  const d = distance(p.pos, mouse);
  p.intensity = lerp(p.intensity, smoothstep(200, 50, d), 0.05);
});
```

スクロール、滞在時間、ページ訪問回数なども「観測」として扱える。
**滞在時間に応じて画面が静かに発光する** 設計は、ユーザーへの応答ではなく **対話**。

### 8.6 静寂時間の設計

光のフラッシュ後、最低 **3-5 秒の沈黙** を保証。
連続発光は安物。**間** が品。

### 8.7 SSS 的な「物質の内側に光」

inryokü の grey ボリュームに薄く SSS を仕込む（メッシュベース）。
フラットな grey よりも、わずかに「内側から発光している」grey の方が深い。

### 8.8 音との連動（追加検討）

光と音の同期は強い体験を作る。ただし inryokü 哲学では **音は控えめ**。
- 出現時に **超低周波** の sub-bass 一点。
- 持続音は使わない。

---

## 9. 「安っぽい光」vs「本物の光」鑑定基準

### 9.1 即死サイン（これが一つでもあると安物）

1. **lens flare の anamorphic streak**（古い After Effects 感）
2. **8 角形のスタービュー**（アプリ広告感）
3. **彩度の高いネオンピンク・シアン全画面**
4. **HSL を線形に回す虹色グラデ**（黒体軌跡を無視）
5. **bloom が画面全体に効いてコントラスト消失**
6. **threshold が低すぎて常時 hazy**
7. **chromatic aberration が肉眼で見える強度**
8. **drop shadow の色が `#000` で硬い**（散乱光は黒ではない）
9. **`filter: blur(2px)` 程度のぼかしを「ぼかし」と呼ぶ**（PSF として薄い）
10. **常時最大輝度の発光**（暗順応を許さない）

### 9.2 合格サイン（本物の徴候）

1. **線形空間** で計算 + ACES tonemap
2. **多重 σ の Gaussian pyramid**（multi-scale halo）
3. **色温度が黒体軌跡** に乗っている
4. **暗の深さ** が確保されている（コントラスト保持）
5. **falloff が物理に近い**（逆二乗 + bias）
6. **dithering** で帯感がない
7. **微量の grain or noise** で「映像感」がある
8. **時間軸の控えめな揺らぎ**（ループ感がない）
9. **observer dependence**（マウス／時間／visit に応答）
10. **沈黙の時間** が明確に存在する

### 9.3 鑑定スコア（0-10、提案）

| 項目 | 配点 |
|------|------|
| 線形空間 + tone map | 2 |
| HDR bloom（threshold 適切） | 2 |
| 色温度整合 | 1 |
| falloff 物理 | 1 |
| 暗のコントラスト | 1 |
| dithering | 0.5 |
| 観測者依存 | 1 |
| 静寂時間 | 1 |
| 揺らぎ非ループ | 0.5 |

**8 点以上 = 公開に耐える**、6 点以下 = 修正必須。

### 9.4 失敗例の典型パターン

#### 9.4.1 「Discord 配信」感

- bloom 過剰、neon green/purple、emoji-friendly。
- 治療：threshold を 1.5 倍、彩度を 0.5 倍、grey を増やす。

#### 9.4.2 「ECサイトのキラキラ」感

- 8 角スタービュー、白い背景に金色光。
- 治療：背景を grey に、スタービューを **完全に削除**、bloom のみに。

#### 9.4.3 「Free WordPress テーマ」感

- 彩度高い radial-gradient のヘッダー、ぼけ過ぎ。
- 治療：彩度を **20% に**、blur を多重化、エッジに微細 grain。

#### 9.4.4 「RGB ゲーミング」感

- 動く虹色背景、HSL 360 度回転。
- 治療：完全削除。inryokü には来ない。

### 9.5 実機チェックポイント

- [ ] iPhone 標準輝度で hazy 過ぎないか
- [ ] M1 MacBook P3 ディスプレイで色が破綻しないか
- [ ] 安物 1080p IPS（典型的事務所モニター）で grey が潰れないか
- [ ] ダークモード／ライトモード切り替えで意図が保てるか
- [ ] 暗室と日中窓辺の両方で適切か（auto exposure 検討）

---

## 10. 付録

### 10.1 用語集

- **PSF**：Point Spread Function。点光源が結像系を通った後の像。
- **MTF**：Modulation Transfer Function。空間周波数応答。
- **CCT**：Correlated Color Temperature。相関色温度。
- **CRI**：Color Rendering Index。演色性。
- **EOTF**：Electro-Optical Transfer Function。信号→光。
- **OETF**：Optical-Electro Transfer Function。光→信号。
- **HDR10 / Dolby Vision / HLG**：HDR 表示規格。Web では現状未対応に近い。
- **PBR**：Physically Based Rendering。物理ベース。
- **BRDF**：Bidirectional Reflectance Distribution Function。
- **Fresnel**：屈折率による反射係数の角度依存。

### 10.2 参考文献（事実・確立した知見）

- Hable, J. "Filmic Tonemapping Operators" (Uncharted 2 GDC slides).
- Reinhard, E. et al. "Photographic Tone Reproduction for Digital Images" SIGGRAPH 2002.
- Narkowicz, K. "ACES Filmic Tone Mapping Curve" (2015 blog).
- Akenine-Möller, T., Haines, E., Hoffman, N. *Real-Time Rendering* 4th ed.
- Pharr, M., Jakob, W., Humphreys, G. *Physically Based Rendering* 4th ed.
- Stevens, S.S. "On the psychophysical law" Psych Review 1957.
- IEC 61966-2-1 sRGB standard.
- ITU-R BT.709, BT.2020 color spaces.
- McCamy, C.S. "Correlated color temperature as an explicit function of chromaticity coordinates" Color Research & Application 1992.
- Mitchell, K. "Volumetric Light Scattering as a Post-Process" GPU Gems 3 (2007).

### 10.3 推測・設計判断と明示している箇所の一覧

本文中で「設計」「提案」「推測」とラベルした箇所：

- §1.3 採用判断 Tier 表
- §2.1 inryokü のコア発光色温度
- §2.4 ACES Filmic 推奨
- §6.1 多層 drop-shadow の指数半径
- §8.2 RGBCMY の哲学的意味
- §8.3 50→101 各 phase の数値設計
- §8.4 grey の RGB 値（実装側で要確認）
- §9.3 鑑定スコア配点

### 10.4 inryokü 内 関連ドキュメント（要相互参照）

- `/Users/10ta210/Desktop/inryoku_hp/docs/states-design-2026-04-28.md`
- `/Users/10ta210/Desktop/inryoku_hp/docs/enhance-layer-2026-04-28.md`
- `/Users/10ta210/Desktop/inryoku_hp/docs/particle-language-api-2026-04-28.md`
- `/Users/10ta210/Desktop/inryoku_hp/docs/ring-research-2026-04-27.md`

これらと整合させる際の注意：本ドキュメントは **理論カタログ** であり、実装の前提となる物理・知覚知見と
鑑定基準を提供する。具体パラメータ（threshold 値、色 hex、半径 px）は実装側 PR で決定する。

---

## 11. 実装テンプレート（採用判断は別タスク）

### 11.1 Three.js + Bloom 標準スターター

```js
// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// composer
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.8, 0.9));
composer.addPass(new OutputPass());

// 発光マテリアル例
const mat = new THREE.MeshStandardMaterial({
  color: 0x000000,
  emissive: new THREE.Color(0xfff2dc),    // 暖白 (~5500K)
  emissiveIntensity: 2.5,                  // HDR 値
});
```

### 11.2 CSS 完全静的発光テンプレート

```css
:root {
  --inryoku-grey: #4a4a4a;
  --light-core: rgba(255, 244, 224, 0.95);
  --light-mid:  rgba(255, 224, 188, 0.55);
  --light-far:  rgba(255, 200, 156, 0.18);
  --light-haze: rgba(255, 180, 132, 0.05);
}
body { background: var(--inryoku-grey); }
.glyph {
  color: var(--light-core);
  filter:
    drop-shadow(0 0 2px var(--light-core))
    drop-shadow(0 0 8px var(--light-mid))
    drop-shadow(0 0 24px var(--light-far))
    drop-shadow(0 0 64px var(--light-haze));
}
```

### 11.3 SVG bloom フィルタ（再利用可能）

```html
<svg width="0" height="0" style="position:absolute">
  <filter id="inryoku-bloom" x="-100%" y="-100%" width="300%" height="300%"
          color-interpolation-filters="sRGB">
    <feGaussianBlur stdDeviation="1.5" in="SourceGraphic" result="b1"/>
    <feGaussianBlur stdDeviation="6"   in="SourceGraphic" result="b2"/>
    <feGaussianBlur stdDeviation="20"  in="SourceGraphic" result="b3"/>
    <feGaussianBlur stdDeviation="60"  in="SourceGraphic" result="b4"/>
    <feMerge>
      <feMergeNode in="b4"/>
      <feMergeNode in="b3"/>
      <feMergeNode in="b2"/>
      <feMergeNode in="b1"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</svg>
```

利用：`<element style="filter: url(#inryoku-bloom)" />`

`color-interpolation-filters="linearRGB"` にすると線形空間で合成される（より物理的）。
ただしブラウザ間差異がある。**現状 sRGB が安全**、確認できれば linearRGB を選ぶ。

---

## 12. 結語

「真の光らしい発光」とは、派手さではなく **物理整合 + 知覚整合 + 哲学整合** の三角形だ。
inryokü においては、その三角形の中心に **「観測者がいるから光が出現する」** という命題が立つ。

光は加えるものではなく、grey の中から **呼び出される** もの。
本ドキュメントは、その呼び出し方の語彙集である。

採用判断は本ドキュメントを根拠にしつつ、実装ごとの文脈で別途行う。
