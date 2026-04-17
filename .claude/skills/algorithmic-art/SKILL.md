---
name: algorithmic-art
description: |
  inryokü専用アルゴリズミック・アート設計スキル。哲学的コンセプトをGLSL/Three.jsのビジュアルアルゴリズムに変換する。
  使用タイミング: 新しいビジュアル演出のアイデア出し、シェーダーの設計、パーティクルシステムの物理設計、
  ニュートンリング・干渉パターン・波動関数の実装、「グレー→虹」の観測エフェクト設計、
  RGBCMY色彩アルゴリズムの設計。P0〜P3の演出を考える時は必ずこのスキルを参照すること。
  「演出どうしよう」「もっとかっこよくしたい」「新しいエフェクト」「シェーダー書いて」
  「粒子の動き」「色の変化」「アニメーション設計」などの文脈で発動。
---

# Algorithmic Art for inryokü

## 哲学 → アルゴリズム変換フレームワーク

inryoküでは、ビジュアルは飾りではなく哲学の表現。コードを書く前に、必ずこの思考プロセスを踏む：

1. **哲学的問い**: 何を表現したいのか？（例：「観測が現実を変える」）
2. **物理的メタファー**: どの物理現象がそれを表せるか？（例：ニュートンリング＝光の干渉）
3. **数学的モデル**: どの数式が核になるか？（例：r² ∝ nλR）
4. **コード設計**: Three.js/GLSLでどう実装するか？

この順序を逆にしてはいけない。「かっこいいエフェクト」から始めると表面的になる。

## inryokü の核心アルゴリズム

### グレー→虹の観測エフェクト（最重要）
グレー（#808080）は全色（RGBCMY）の混合。観測者の視点が変わると、グレーの中から虹が見える。

```glsl
// 基本パターン: 観測度（observe）に応じてグレーから虹を抽出
vec3 grey = vec3(0.5);
float observe = /* 何らかのインタラクション値 0.0〜1.0 */;
vec3 rainbow = vec3(
    sin(phase * 6.2832) * 0.5 + 0.5,
    sin(phase * 6.2832 + 2.094) * 0.5 + 0.5,
    sin(phase * 6.2832 + 4.189) * 0.5 + 0.5
);
vec3 color = mix(grey, rainbow, observe);
```

`observe` の入力例：
- マウス距離（近づくと虹が見える）
- 時間経過（じわじわ見えてくる）
- クリック/タップ（一瞬で切り替わる）
- カメラ角度（視点を変えると見える）

### ニュートンリング（物理ベース干渉）
薄膜干渉の物理式に基づく虹色リング。6波長を必ず含める。

```glsl
// r² ∝ nλR — n次のリング半径の二乗は波長λと曲率半径Rに比例
float r2 = dot(uv - center, uv - center);

// 6波長: 赤(620nm) / 橙(590nm) / 黄(570nm) / 緑(530nm) / 青(470nm) / 紫(420nm)
float wavelengths[6] = float[6](0.620, 0.590, 0.570, 0.530, 0.470, 0.420);
vec3 color = vec3(0.0);
for (int i = 0; i < 6; i++) {
    float ring = sin(r2 / wavelengths[i] * scale + time) * 0.5 + 0.5;
    // 各波長の色を加算
}
```

### CMY/RGB 二重性
CMY（物質・アナログ）とRGB（精神・デジタル）は対になる概念。

| 概念 | CMY | RGB |
|------|-----|-----|
| 質感 | MeshPhysicalMaterial（水滴・屈折） | ShaderMaterial（内側発光） |
| 混合結果 | 黒（物質の終着点） | 白（精神の終着点） |
| 音 | Aマイナー（暗い） | Aメジャー（明るい） |
| 配置 | 正三角形 | 正三角形（CMYと反転） |

```glsl
// CMY球: 物理ベースの屈折・反射
// → MeshPhysicalMaterial { transmission, ior, roughness }

// RGB球: 内側からの発光
// → ShaderMaterial { emissive glow based on fresnel }
float fresnel = pow(1.0 - dot(normal, viewDir), 2.0);
vec3 glow = sphereColor * (1.0 + fresnel * 2.0);
```

### 50% → 101% の跳躍
現実（50%=グレー）から101%への非連続的ジャンプ。100%は存在しない。

アルゴリズム的には：
- 0%〜50%: 線形変化（ease-in）
- 50%: 一瞬の停止（認識の瞬間）
- 50%→101%: 非線形爆発（cubic/exponential ease-out）

```javascript
// プログレスバーの動き
if (progress <= 0.5) {
    visual = progress * progress * 2; // ease-in
} else {
    // 50%から一気に101%へ — 100%をスキップ
    let t = (progress - 0.5) * 2;
    visual = 0.5 + t * t * t * 0.51; // cubic burst to 101%
}
```

## パーティクル物理パターン

### 呼吸（Breathing）
全ての粒子は呼吸する。線形（linear）アニメーションは禁止。

```glsl
// 複数のsin波を重ねて有機的な呼吸を作る
float b1 = sin(time * speed + phase);
float b2 = sin(time * speed * 0.7 + phase * 2.3) * 0.3;
float breathe = (b1 + b2) * 0.5 + 0.5;
```

### 引力と斥力
粒子間の力学。距離の逆二乗則がベース。

```javascript
// 引力: ease-in（ゆっくり→加速）
const prog = timer / duration;
const ease = prog * prog * prog; // cubic ease-in
const lerpF = 0.002 + ease * 0.15;
pos += (target - pos) * lerpF;

// 爆発: 初速→減衰
vel *= 0.993; // 空気抵抗
pos += vel;
```

### 螺旋軌道（Spiral Trajectory）
粒子が目標に向かって螺旋を描く。

```javascript
const arriveF = 1.0 - Math.min(dist / maxDist, 1.0);
const spiralR = (1.0 - arriveF) * radius;
const spiralAngle = time * speed + particleId * offset;
pos.x += dx * lerp + Math.cos(spiralAngle) * spiralR * dt;
pos.y += dy * lerp + Math.sin(spiralAngle) * spiralR * dt;
```

## シェーダー品質基準

すべてのGLSLシェーダーは以下を満たすこと：

1. **time uniform**: 必ずアニメーションさせる（静的なシェーダーは禁止）
2. **6波長**: ニュートンリング系は赤/橙/黄/緑/青/紫を含める
3. **グレー→虹**: 観測エフェクトを基本とする
4. **多層構造**: コア + グロー + ヘイロー の3層以上

```glsl
// 粒子の基本シェーダーパターン
float core = exp(-d * d * 18.0);       // 明るいコア
float glow = exp(-d * d * 5.0) * 0.6;  // ソフトグロー
float halo = exp(-d * d * 2.0) * 0.15; // アウターヘイロー
float alpha = core + glow + halo;
```

## アニメーション設計パターン

各フェーズには固有のイージングがある：

| フェーズ | イージング | 意味 |
|---------|----------|------|
| ATTRACT | ease-in (cubic) | ゆっくり引き合い→加速 |
| EVENT_FUSE | ease-out (cubic) | 急激な融合→安定 |
| DUALITY | sin波 | 呼吸する脈動 |
| WARP_GROW | exponential | 加速しながら膨張 |
| EVENT_COLLAPSE | ease-in→burst | 急収縮→爆発 |

## 禁止事項（CLAUDE.mdと同期）

- Canvas 2D (`getContext('2d')`) 完全禁止
- Three.js バージョン 0.160.0 から変更禁止
- テクスチャ画像の使用禁止
- linear アニメーション禁止（必ずイージング）
- ShaderMaterialの fragmentShader runtime書き換え禁止
- setInterval内でphase変数参照禁止（requestAnimationFrame使用）

## カラーパレット

```
CMY:  Cyan #00FFFF / Magenta #FF00FF / Yellow #FFFF00
RGB:  Red #FF0000 / Green #00FF00 / Blue #0000FF
Grey: #808080（現実 = 50%）
BG:   White #FFFFFF / Black #000000
UI:   Win95 Blue #0000AA / Win95 Grey #C0C0C0
```

## 演出アイデアを出す時のプロセス

1. 司さんに哲学的意図を確認する
2. 3つのアプローチ（A/B/C）を提案する
3. 各アプローチの数学的根拠を説明する
4. 司さんの選択後、小さく実装→確認のサイクルで進める
5. デザイン判断が必要な場面では必ず立ち止まって確認する

references/ ディレクトリには追加の技術ドキュメントを置ける。
新しいパターンを発見したらここに追加していく。
