# 波動関数リファレンス

## inryoküで使う主要な波動パターン

### 1. 薄膜干渉（ニュートンリング）
```
I = I₁ + I₂ + 2√(I₁I₂) cos(δ)
δ = 4πnt/λ + π  (反射時のπ位相シフト)
r² = nλR  (n次リングの半径)
```

GLSL実装のポイント：
- `r²` をUV座標から計算（中心からの距離の二乗）
- 波長λを6つ用意して各色チャンネルに分配
- time uniformで位相をシフトさせると動くリングになる

### 2. フレネル反射
```
R = R₀ + (1 - R₀)(1 - cosθ)⁵
```
θ = 視線と法線の角度。端ほど反射が強い。
球体のリム発光に使う。pow(1.0 - dot(N, V), 2.0〜5.0)

### 3. 回折格子
```
d sinθ = mλ
```
CDの虹色のような効果。法線マップの代わりにUV座標の微分で近似可能。

### 4. ドップラー効果（色シフト）
近づく光は青方偏移、遠ざかる光は赤方偏移。
パーティクルの速度に応じて色をシフトさせると臨場感が出る。

```glsl
float velocity = length(particleVel);
float shift = velocity * 0.1;
vec3 shifted = vec3(
    color.r * (1.0 + shift),
    color.g,
    color.b * (1.0 - shift)
);
```

### 5. 量子トンネリング（確率的透過）
壁を一定確率で透過する量子効果。
パーティクルが障壁を「すり抜ける」演出に使える。

```javascript
// 透過確率 = exp(-2κa)
// κ = sqrt(2m(V-E))/ℏ
const tunnelProb = Math.exp(-2 * barrier * thickness);
if (Math.random() < tunnelProb) {
    // 透過！ → 粒子が壁の向こう側に出現
}
```
