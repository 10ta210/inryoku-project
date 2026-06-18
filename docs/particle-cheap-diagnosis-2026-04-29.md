# Particle Universe — 「光が安っぽく見える」根本診断
**作成日:** 2026-04-29
**対象:** `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js`（5696行）, `/Users/10ta210/Desktop/inryoku_hp/p3_styles.css`（3183行）, `/Users/10ta210/Desktop/inryoku_hp/index.html`
**前提資料:** `docs/p3-performance-audit-2026-04-28.md`
**調査者:** Claude（Opus 4.7 1M context）
**作業モード:** 読み取り専用・推測明記・行番号付き
**触らない:** すべての実コード（提案は diff 提示のみ、適用しない）

---

## 1. エクゼクティブサマリ

> **一言:** 「光らせる仕掛け」は層として設計されているのに、**仕上げのトーンマッパーとブルームが production で動いていない**。だから明部がクリップしてぺったり貼り紙のように見える。粒子側の仕事ではなくパイプライン側の事故。

### 主犯 3 つ（インパクト順）

1. **【主犯 #1 — Bloom が production で全く効いていない】**
   `p3_code_for_claude.js:3281` で `if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined')` という guard を通って初めて `composer6` が生成され、`composer6.render()` 経由で UnrealBloomPass が走る設計。**しかし `index.html:1386` は `vendor/three.min.js` 単体しか読んでいない。** EffectComposer / UnrealBloomPass / RenderPass / LuminosityHighPassShader / CopyShader / ShaderPass のどれも production には存在しない（`index.html:1384-1385` のコメントで「0.160 では examples/js/postprocessing 系は廃止」と明記し、意図的に外している）。結果 `composer6` は常に `null`、`p3_code_for_claude.js:3997` の `if (composer6) composer6.render(); else renderer6.render(scene6, camera6);` は **else 分岐固定** → **HDR ブルーム 0、トーンマップ 0、ハイライト膨張 0**。フラグメントシェーダがどれだけ「core / innerGlow / outerHalo / rim」を重ねても、最終出力は SDR 8bit にクリップされる。これが「安っぽさ」の単独最大要因。

2. **【主犯 #2 — Additive blending + 真っ黒背景 + トーンマップ無し ＝ 飽和色のドット絵】**
   `setClearColor(0x000000, 1)` (`:2718`) + `THREE.AdditiveBlending` (`:2886`) + `transparent: true` + `depthWrite: false`。Additive は本来 HDR バッファに加算して、後段 bloom + tonemap で「白を超えた領域が周辺に滲む」表現になる。Bloom が無い状態で Additive だけ使うと、重なった粒子の RGB は **clamp(0,1) で各チャンネル独立に 1.0 へ張り付く** → 「**赤の点が重なっても赤のまま、ただ平らに濃い赤**」「白に向かわない」「滲まない」。粒子そのものが LED ステッカーのような印象を与える。さらに CMYRGB 6 色のみ（`:2745-2752`、司の指示で grey/white/橙を廃止）でパレットが原色固定 → 加算しても色が混ざらず**飽和した原色面**になり、夜景写真の暖かい白点光源のような味が出ない。

3. **【主犯 #3 — point sprite のフラグメントが「過設計」で逆に CG 臭】**
   `:2849-2883` のフラグメントシェーダは `core` (`exp(-d*d*36)`)、`innerGlow` (`exp(-d*d*11)`)、`outerHalo` (`exp(-d*d*2.8)`)、`rim` (smoothstep 帯)、`codeBand`（同心リップル）、`prism`（ring × 2π 分解の虹色）まで詰め込んでいる。**ガウシアン点光源の上に色相分解リング (`:2866-2870`) と sin リップル (`:2859`) を加算**しているため、近距離で見ると各粒子に「同心の虹輪 + 走査線」がはっきり見える。これは「光」というより「アイコン」「シール」「絵文字」の見え方で、**観測距離が近い (= gl_PointSize が大きい) ときほど安く見える**。core を白にブーストする補正 (`:2877` `vec3(0.92,0.95,1.0) * core * (0.28 + ...)`) はあるが、bloom が無い前提で書かれていないので白の量が控えめ＝飽和に届かない＝「光ってない色のドット」になる。

> **一言で言い換えると:** ブルームを切ったまま「ブルーム前提のシェーダ」を出している。手描きで滲み（rim/halo/codeBand）を粒子内部に書き込んでいるが、これは本物の発光ではなく「光のイラスト」。だから安っぽい。

---

## 2. 現状のパーティクル実装ダンプ（具体的なパラメータ表）

### 2.1 レンダラ・シーン・カメラ
| 項目 | 値 | 行番号 | 備考 |
|---|---|---|---|
| WebGLRenderer antialias | `false` | `:2715` | パフォーマンス優先で MSAA 無し |
| WebGLRenderer alpha | `false` | `:2715` | 不透明背景。`outputColorSpace` 設定なし → sRGB の暗黙仕様 |
| pixelRatio | `Math.min(window.devicePixelRatio, 1.5)` | `:2716` | **司認識「0.5 設定済み」と不一致**（既存 audit 既述）。実機では DPR 1.5 まで取る |
| ClearColor | `0x000000` (alpha 1) | `:2718` | 完全黒 |
| canvas z-index | `0` (`pointer-events:none`) | `:2721` | 一番奥 |
| Scene | 単一 `scene6` | `:2726` | fog なし、env map なし、PMREM なし |
| Camera | `PerspectiveCamera(60, W/H, 0.1, 2000)` 位置 (0,0,200) | `:2727-2728` | far 2000、近接粒子は z≈-110 まで来る |
| 出力色空間 | 未設定（デフォルト linear） | — | `renderer.outputColorSpace = THREE.SRGBColorSpace` 等の指定なし |
| トーンマッピング | 未設定（`NoToneMapping` デフォルト） | — | HDR→SDR 圧縮なし |

> **推測:** Three r160 ではデフォルトが `NoToneMapping` + `LinearSRGBColorSpace`。`outputColorSpace` を明示しないと sRGB エンコード自動化されない場合がある（バージョン差あり）。これも「色が浅く見える」一因の可能性（推測、行根拠なし）。

### 2.2 粒子ジオメトリ
| 項目 | 値 | 行番号 |
|---|---|---|
| 粒子数 N | mobile 3400 / desktop 6200 | `:2734-2736` |
| 形状 | `THREE.Points` (point sprite) | `:2891` |
| 分布 | 球状、半径 60〜480、`pow(uRng(),1.6)` で近接寄せ | `:2755-2763` |
| サイズ分布（5 段） | 超大 10% (11.0〜19.6) / 大 22% (5.8〜10.4) / 中 33% (3.0〜5.3) / 小 27% (1.55〜2.7) / 微 8% (0.78〜1.53) | `:2773-2779` |
| 色パレット | CMYRGB 6 色固定（`:2745-2752`） + jitter ±0.025 | `:2768-2771` |
| 流れ星 | 0.8% を白 (1,1,1)、サイズ 2.0〜5.0 | `:3319-3331` |

### 2.3 マテリアル（メイン粒子 ShaderMaterial）
| 項目 | 値 | 行番号 |
|---|---|---|
| transparent | `true` | `:2885` |
| blending | `AdditiveBlending` | `:2886` |
| depthWrite | `false` | `:2887` |
| depthTest | デフォルト `true`（明示なし） | — |
| vertexColors | `true` | `:2888` |
| Texture | **無し**（procedural ガウシアンを fragment で計算） | `:2849-` |
| Soft particle | 未実装 | — |
| gl_PointSize | `aSize * (1+breath*0.26..0.56) * (318.0 / -mvPos.z)`、min 0.72、max 42.0 | `:2833-2836` |
| Fragment 構造 | `core` + `innerGlow` + `outerHalo` + `rim` + `codeBand` + `prism`（虹色リング） | `:2853-2870` |
| 白コア注入 | `vec3(0.92,0.95,1.0)*core*0.28〜0.42` | `:2877` |
| アルファ | `1 - exp(-alphaRaw*1.18)`、`* breathe * (0.74+vDepthGlow*0.22)` | `:2881-2882` |

### 2.4 ポストプロセス
| 項目 | 値 | 行番号 |
|---|---|---|
| EffectComposer 取得 | `typeof THREE.EffectComposer !== 'undefined'` で条件分岐 | `:3281` |
| **production での実行** | **常に `composer6 = null` → `renderer6.render(scene6, camera6)` 直行** | `:3997` |
| UnrealBloomPass 引数（コード上） | `(Vector2(W,H), strength=1.6, radius=0.5, threshold=0.15)` | `:3284` |
| FXAA / TAA / ChromaticAberration | 全て無し | — |

### 2.5 CSS 側の見た目補正（`#p6-canvas`）
| 状態 | filter | 行番号 |
|---|---|---|
| 通常 | `brightness(1.22) saturate(1.32) contrast(1.06)` | `p3_styles.css:196` |
| `body.inryoku-speaking` | `brightness(0.74) saturate(0.86) blur(0.28px)` | `:200-203` |
| `prefers-reduced-motion` | `brightness(0.82) saturate(0.92)`（speaking 時） | `:620-623` |
| 重複定義 | `body.inryoku-speaking #p6-canvas` がもう一つ `:2271-2274` にある（filter 値違い：blur 0.18px） | `:2271` |
| mix-blend-mode | **未指定** | — |

### 2.6 spawn / 呼吸 / 音響
| 項目 | 値 | 行番号 |
|---|---|---|
| SPAWN_DURATION | 34.0 秒 | `:2898` |
| ease | `1 - (1-t)^2.1`（ease-out 寄り） | `:3577` |
| breathe | `(b1 + b2) * (0.5 + audio*0.3) * 0.5 + 0.5`、`breatheSpeed = (0.34 + aPhase*0.13) * audioBoost` | `:2815-2821` |
| sizeBreath | `1 + vBreathe * (0.26 + audio*0.3)` | `:2827` |
| audioGlow | `1 + uAudioEnergy * 0.42`（fragment 内 glow 緩和方向） | `:2854` |

### 2.7 星座ライン（補助）
| 項目 | 値 | 行番号 |
|---|---|---|
| MAX_LINES | 2200 | `:3010` |
| material blending | Additive | `:3060` |
| depthWrite | false | `:3061` |
| 構造 | LineSegments、ShaderMaterial、距離フェード + twinkle + codePulse | `:3019-3062` |
| アルファ | `0.36〜0.54 * depthFade^2 * twinkle` | `:3055` |

### 2.8 フレームレート目標 / 実態（既存 audit 抜粋）
- desktop M1: 60fps（idle）
- 中位 Win: 55-60 / chat 中 35-50
- iPhone 13 / Pixel 6: 40-55 / chat 中 20-35
- 旧端末: 15-25 / 10 未満
- ボトルネック筆頭は constellation 二重ループと毎フレーム全 buffer needsUpdate（既存 `p3-performance-audit-2026-04-28.md` §1.3）

---

## 3. 「安っぽさ」の根本原因 10 個（行番号付き）

> **読み方:** 「安っぽい」を **(a) 物理的に光に見えない / (b) CG として古い見た目 / (c) 飽和して情報量が落ちる / (d) 仕上げ不足** に分解して、各原因をどれかにマップする。

### 原因 #1 — UnrealBloomPass が production で実行されない 【最重要・(a)(d)】
- 行: `p3_code_for_claude.js:3281-3285`, `:3997`、`index.html:1384-1386`
- 現象: ハイライトのにじみ・ハロー膨張・色温度シフトが**全部欠落**。粒子内部で smoothstep/exp の glow を描いているが、これは「光」ではなく「光の絵」。
- 推測: `p3_test.html` 単体起動と `p1_index_for_claude.html` では postprocessing スクリプトを読んでいる（`p1_index_for_claude.html:30-35`）ので、開発時はブルーム有りで見ている。**司さんが見ている本番はブルーム無し**で、見え方が大きく異なる可能性が高い（要確認）。
- 影響度: **★★★★★**

### 原因 #2 — トーンマッピング未設定（`NoToneMapping` デフォルト） 【(a)(c)(d)】
- 行: `p3_code_for_claude.js:2715-2718` 周辺、`renderer6.toneMapping`/`outputColorSpace` の設定行が **存在しない**
- 現象: Additive で 1.0 を超える領域がただクリップされるだけ。`ACESFilmic` や `Reinhard` を入れると「白飛び風→温かい白へ」のロールオフが入り、点光源が映画的になる。
- 影響度: **★★★★☆**

### 原因 #3 — Additive blending を bloom 前提で使っているのに bloom が無い 【(a)(c)】
- 行: `:2886`, `:3060`, `:4470`
- 現象: Additive は本来「光は積み上がるほど白へ向かう」表現。bloom が無い + tonemap が無いと、R/G/B 各チャンネルが clamp(0,1) で頭打ち → **重なっても色相が動かず、彩度だけ最大張り付き**。「赤の塊」「青の塊」の見え方。
- 影響度: **★★★★★**

### 原因 #4 — パレット 6 色固定で色温度の自然分布が無い 【(b)(c)】
- 行: `:2745-2752`, `:2765-2766`
- 現象: CMYRGB 純色 6 種のみ（jitter ±0.025）。本物の星空・夜景は黒体放射に沿った色温度（1800K〜10000K）の **連続スペクトル + 白色比率高め**。原色 6 種混合は「色付き LED マトリクス」の見え方。
- 司の指示（`:2743-2744` コメント「司「粒子の色は CMYRGB だけ」」）との衝突: **美学指示は尊重しつつ、6 色それぞれに weight をかけて、白寄り (R+G+B=1.0近傍) と暗赤・暗青（黒体放射の冷端 / 暖端）を内挿で 5〜10% 混ぜる**余地はある。
- 影響度: **★★★★☆**

### 原因 #5 — fragment の prism / codeBand が粒子内に「色相分解リング」を強制描画 【(b)】
- 行: `:2859`, `:2865-2870`, `:2873-2878`
- 現象: 各粒子に `sin(d*30 - uTime*0.32 + vPhase*8)` の同心リップル + `prism` の RGB 位相分解。**これは「光」ではなく「DVD 盤の干渉縞」あるいは「CD レーベルの反射」に近い**。粒子サイズが大きいとき (gl_PointSize が 20+ になる近距離粒子) に縞が露骨に見え、「シェーダ芸」感が出る。
- 推測根拠: `:2855-2858` のガウシアン重ね合わせは正攻法だが、`:2859` 以降の `codeBand` と `:2866` 以降の `prism` はリアル発光から離れる方向の追加レイヤ。
- 影響度: **★★★★☆**

### 原因 #6 — gl_PointSize の min 0.72 / max 42 で「ジリジリ」と「ベタ」が同居 【(b)(c)】
- 行: `:2834`, `:2836`
- 現象: 遠距離粒子は **0.72 px** に下限クランプ → 1px の点滅で aliasing。近距離粒子は **42 px** 上限 → 大きな円盤に prism 縞が見える。中間粒子だけ自然。サイズの **dynamic range** がレンダラ側の事情で潰れている。
- 影響度: **★★★☆☆**

### 原因 #7 — 流れ星の色が `(1,1,1)` ベタ + サイズも特別ではない 【(b)(d)】
- 行: `:3330`（`colors[i*3]=1; ...=1; ...=1;`）, `:3331`（`aSizes[i] = 2.0 + uRng()*3.0`）
- 現象: 流れ星は本来 **コア白 + 後ろにテーパー（モーションブラー）+ 手前に伸びるトレイル**。現実装は単一 Point に色 (1,1,1) を入れただけで、**形状的に通常粒子と同じ**。動きで「速い」とは分かるが「光線」には見えない。
- 影響度: **★★★☆☆**

### 原因 #8 — soft particle が無い（深度比較によるエッジ吸収なし） 【(b)】
- 行: 該当なし（depthTexture を読み込む uniform/varying が**存在しない**）
- 現象: 粒子と背後オブジェクト（ロゴ球体、UI レイヤー）の境界で hard edge。他オブジェクトと粒子の同居領域でぱつっと切れて見える。
- 影響度: **★★☆☆☆**（このサイトは粒子が殆ど単独レイヤなので影響中）

### 原因 #9 — CSS filter `brightness(1.22) saturate(1.32) contrast(1.06)` が「乗算ブースト」しかしない 【(d)】
- 行: `p3_styles.css:193-198`
- 現象: brightness は **乗算**、contrast は **線形ストレッチ**。Additive のクリップ点は変えずにスロープだけ動かすので、**飽和の張り付きはむしろ悪化**する（暗部だけ持ち上がってクリップ点に押し付ける）。本物の bloom の「暗部はそのまま、明部だけ滲ませる」とは逆動作。
- 影響度: **★★★☆☆**

### 原因 #10 — `mix-blend-mode` が `#p6-canvas` に設定されていない 【(d)】
- 行: `p3_styles.css:182-198`（canvas には mix-blend-mode 指定なし）
- 現象: canvas 全体は背景に**普通に重ねられているだけ**。`mix-blend-mode: screen` や `lighten` を当てれば、CSS 合成で「白に向かって積み上がる」表現が**疑似 bloom 風に効く**ケースがある（背景が真っ黒なので影響少だが、UI overlay やロゴと粒子のレイヤ関係で挙動を変えられる）。現状は単純 over 合成。
- 影響度: **★★☆☆☆**

#### 補助的に「安っぽさ」に効いている要素（10 個に入りきらない次点）
- `mix-blend-mode: screen` が brand-name 等他レイヤには効いていて canvas にはない（`:78`, `:134`, `:259` など）。粒子と他光物のレイヤ整合性が破れる。
- ロゴ周辺のフィルタが saturate(3.5〜4.4) と非常に強く（`:215`, `:301-311`）、**ロゴだけが派手で粒子だけが地味**な対比が出来てしまっている。粒子の安っぽさが**周辺のクオリティとのギャップ**で増幅される。
- `:2815` `audioBoost = 1.0 + uAudioEnergy * 1.5` は呼吸速度を最大 2.5 倍にするが、**振幅 (`breatheAmp`) は +0.3 だけ** → 音が大きいと「速いだけで派手にならない」。発光感の演出としては伸び代がある。
- `outputColorSpace` 未設定で sRGB エンコード明示されていない（`SRGBColorSpace` を `renderer6.outputColorSpace = THREE.SRGBColorSpace` で指定している箇所が grep で見つからない、推測）。

---

## 4. 高品質パーティクル理論（参照ベース）

> **目的:** 「真に光って見える」とは何か、要素分解。各要素について現状実装との差分を併記。

### 4.1 真の発光感を出す 8 要素

#### 4.1.1 HDR bloom（multi-pass blur）
- 理論: 線形空間の HDR バッファ（RGBA16F）で 1.0 を超えた明部を luminance threshold で抽出 → 5〜6 段の mip でガウシアンぼかし → 元バッファに加算 → tonemap → sRGB。
- inryokü 現状: **完全欠落**（主犯 #1）。コード上は `UnrealBloomPass(strength=1.6, radius=0.5, threshold=0.15)` が定義されているが production で読み込まれない。
- 修正効果: 体感的に 「写真→絵」が「絵→写真」へ。

#### 4.1.2 Additive blending + soft particle
- 理論: Additive は HDR 前提。SDR の上で使うと飽和でぺちゃんこ。Soft particle は depth テクスチャ参照で背景との距離が近い粒子の alpha を落として「ぶつかりエッジ」を消す。
- inryokü 現状: Additive のみ（`:2886`）、soft particle 無し。HDR バッファ無し → 飽和。
- 修正効果: bloom と同時導入で初めて意味が出る。

#### 4.1.3 色温度（黒体放射に近いガウス分布の色）
- 理論: 星の色は黒体放射 1800K〜30000K のスペクトル。実夜景の点光源は「白＋少しの色」「橙系白」「青系白」が圧倒的多数。CMYRGB 純色は人工的。
- inryokü 現状: `:2745-2752` で 6 純色固定、jitter ±0.025（実質ほぼ純色）。
- 修正効果: `vec3 starColor = mix(blackbody, palette, mixRatio)` で純色との橋渡し。司さんの「CMYRGB だけ」指示と衝突するなら、**白比率（純色の RGB 合計 / max）を高めた変種** ＝ R={1.00,0.55,0.65} のような優しい色に振る案。

#### 4.1.4 サイズ揺らぎ（自然分布、log-normal）
- 理論: 自然界のサイズ分布は対数正規分布（log-normal）。等比階段の方が見た目が「自然」。
- inryokü 現状: 5 区間の uniform 連結（`:2773-2779`）。区間内 uniform、区間境界で離散ジャンプ。
- 修正効果: `aSize = exp(mu + sigma*gauss())` でなめらかな heavy-tail。区間ジャンプ感が消える。

#### 4.1.5 距離減衰（near/far で size + alpha 変化）
- 理論: ハイライトは近距離で大きく明るく、遠距離では小さくぼやける。alpha も far で減衰。
- inryokü 現状: `gl_PointSize = aSize * sizeBreath * (318/-mvPos.z)` で size は OK。alpha は `vDepthGlow` で `0.74 + vDepthGlow*0.22` として遠距離 + 0.22（つまり**遠距離で alpha が増える**）。これは逆方向。
- 推測根拠: `:2830` `depthNorm = clamp((-mvPos.z - 60) / 560, 0, 1)` で far ほど 1.0 → `vDepthGlow=1` → alpha 係数 0.96。near (0) で alpha 係数 0.74。**司さんの直感「奥の粒子も見せる」設計**だが、写真的にはこれが「奥にもぺったり張り付いてる」感を生む可能性。
- 修正効果: 距離 alpha を反転 or 飽和カーブ化で奥行き感が出る。

#### 4.1.6 多層構造（コア + ハロー + 拡散光）
- 理論: 1 粒子 ＝ 内側コア（白く硬い）＋ 中間ハロー（色を持つ）＋ 外側拡散（広く薄い）の 3 層。bloom と組み合わせると 4 層目の post-bloom halo が生じる。
- inryokü 現状: コード上は core/innerGlow/outerHalo/rim/codeBand/prism と **5 層**（`:2855-2870`）。**過剰**。bloom が無い前提で粒子内に bloom を描き込んでいるため、**点光源の 5cm 周りに虹輪が貼り付いている**ように見える。
- 修正効果: bloom 導入後は粒子側を core+halo の 2 層に簡素化。「素の白い点 + bloom が滲ませる」が王道。

#### 4.1.7 lens flare / chromatic aberration（控えめ）
- 理論: 強いハイライト点に対する横長フレア / 6 角絞りゴースト / RGB ずれ。**控えめに**入れる（多用すると安くなる逆方向）。
- inryokü 現状: 無し。代わりに `prism` 同心リング（`:2866-2870`）を粒子内部に持っているが、これは flare ではなく**粒子表面の干渉模様**で別物。
- 修正効果: 一部の超大粒子（`aSize > 11.0` の上位 10%）にだけ十字スパイク or 6 軸ゴーストを texture で貼ると劇的。

#### 4.1.8 depth-aware（被写界深度ボケ）
- 理論: フォーカス面から外れた粒子はブラー。望遠的 bokeh。
- inryokü 現状: 無し。すべての粒子がパンフォーカス。
- 修正効果: 重い。Phase 3 ではコスパ悪く優先度低。

### 4.2 inryokü 現状との差分マトリクス

| 要素 | 必要度 | 現状 | 行根拠 |
|---|---|---|---|
| HDR bloom | ★★★★★ | 欠落（production） | `:3281` + `index.html:1386` |
| ToneMapping | ★★★★★ | 未設定 | `:2715` 周辺 |
| outputColorSpace | ★★★★ | 未設定（推測） | grep で hit せず |
| 色温度的色 | ★★★★ | 6 純色固定 | `:2745-2752` |
| Soft particle | ★★ | 無し | — |
| サイズ log-normal | ★★ | 5 区間 uniform | `:2773-2779` |
| 距離 alpha 減衰 | ★★★ | 逆方向（far で +0.22） | `:2882` |
| 多層構造 | OK | むしろ過剰（5 層） | `:2855-2870` |
| lens flare | ★★（限定） | 無し | — |
| DOF | ★ | 無し | — |
| FXAA | ★ | 無し（antialias:false） | `:2715` |

---

## 5. CSS 側で即できる強化案 5 つ（diff 形式、副作用ゼロ目安）

> **方針:** JS とシェーダに触らず、CSS だけで「ぺったり感」を緩和する。bloom の代替には絶対にならないが、**主犯 #1 が修正される前の応急処置 + 修正後の仕上げ**として有効。

### 5.1 CSS-A — `#p6-canvas` に疑似 bloom フィルタチェーンを導入

**現状** (`p3_styles.css:193-198`):
```css
    #p6-canvas {
      /* 2026-04-29: 司「粒子の光らしさ上げて」— canvas 側のブースト
         brightness/saturate/contrast で星の発光感を底上げ */
      filter: brightness(1.22) saturate(1.32) contrast(1.06);
      transition: filter 420ms ease, opacity 420ms ease;
    }
```

**提案 diff**:
```diff
     #p6-canvas {
-      /* 2026-04-29: 司「粒子の光らしさ上げて」— canvas 側のブースト
-         brightness/saturate/contrast で星の発光感を底上げ */
-      filter: brightness(1.22) saturate(1.32) contrast(1.06);
+      /* 2026-04-29 v2: bloom 不在の代替として明部だけ持ち上げる擬似 HDR 風
+         drop-shadow を 2 重に重ねて canvas の明部を滲ませる
+         brightness は 1.0 据置 → 暗部を上げない（黒は黒のまま）
+         saturate は 1.18 で原色の「LED 感」を抑え気味に
+         contrast 1.10 で暗部をさらに沈める = 明部とのレンジを広げる */
+      filter:
+        contrast(1.10)
+        saturate(1.18)
+        drop-shadow(0 0 0.6px rgba(255,255,255,0.42))
+        drop-shadow(0 0 6px rgba(255,255,255,0.18))
+        drop-shadow(0 0 22px rgba(120,180,255,0.10));
       transition: filter 420ms ease, opacity 420ms ease;
     }
```

**効果（推測）:**
- `drop-shadow` は GPU 合成のガウシアン。1 段目 0.6px で hard edge をやわらげ、2 段目 6px で halo、3 段目 22px で広域グロー。**3 層 ＝ 擬似 multi-pass bloom**。
- contrast を 1.06 → 1.10 に上げて暗部をより沈める＝明部のダイナミックレンジを広げる。
- brightness を撤去：暗部を持ち上げると主犯 #2 のクリップが悪化する。
- saturate を 1.32 → 1.18 に下げる：原色の「LED 感」を抑え、写真寄りの白を残す。

**副作用:** drop-shadow は filter チェーンとして合成負荷が増える。モバイルで -3〜5fps の見積り（推測）。`prefers-reduced-motion` 経路（`p3_styles.css:611-618`）では drop-shadow を外す変種を提示すべき。

**美学整合:** grey 中心。むしろ saturate を下げる方向で grey 寄り。司の「もっと光らしさ」要望には drop-shadow ハロー側で対応。50→101 哲学的には「観測者によって光が見える」＝ドラマ薄め、滲み多めが整合。

---

### 5.2 CSS-B — `mix-blend-mode: screen` を canvas に当てる（条件付き）

**現状** (`p3_styles.css:193-198`): mix-blend-mode 指定なし。

**提案 diff:**
```diff
     #p6-canvas {
       filter:
         contrast(1.10)
         saturate(1.18)
         drop-shadow(0 0 0.6px rgba(255,255,255,0.42))
         drop-shadow(0 0 6px rgba(255,255,255,0.18))
         drop-shadow(0 0 22px rgba(120,180,255,0.10));
+      /* z-index:0 で最背面、背景は完全黒。screen 合成は背景黒なら no-op だが、
+         body や html に微小なグラデを後付けした場合に「黒をさらに沈める」効果が出る。
+         また stacking context 上位に CSS で半透明レイヤを置いた場合、その下の粒子が
+         screen 合成で透けて見える挙動を担保できる。 */
+      mix-blend-mode: screen;
+      isolation: auto;
       transition: filter 420ms ease, opacity 420ms ease;
     }
```

**効果（推測）:** 現状 `setClearColor(0x000000, 1)` で canvas 自身が黒く塗っているため screen 合成は **背景が真黒なら効かない**（`screen(black, x) = x`）。が、`mix-blend-mode` を入れておけば、

- bloom 導入後に renderer の clear を `0x000000, 0` に変えて canvas alpha を有効化した瞬間、CSS 合成側で「下のレイヤと screen 加算」になる仕組みが**先回りで効くようになる**。
- ロゴホロやスキャンラインを後ろから透かす設計に切り替える布石になる。

**副作用:** 真黒 alpha=1 のままなら**視覚変化はゼロ**（推測）。先回り設定として副作用ゼロを担保。**ただし**:
- `mix-blend-mode: screen` が指定された要素は新しい stacking context を作る → z-index の挙動が微妙に変わる。事前に `index.html:1383` の `#root` の `z-index:1` と canvas の `z-index:0` の関係を維持できるか実測必要。

**慎重対応:** これは効果が条件付きなので、優先度は CSS-A より低い。

---

### 5.3 CSS-C — `body` のベース背景に微弱なラジアルグラデ + パイプ vignette

**現状** (`p3_styles.css` 周辺): body 背景は黒。vignette なし。

**提案 diff** (新規追加、既存ルールに干渉しないクラス):
```diff
+    /* 2026-04-29: 粒子背景に映画的ヴィネット — JS には触らず、CSS の擬似要素で被せる
+       z-index 0 (canvas) と z-index 1 (#root) の間に置く想定なので、専用要素なし
+       body::before 1 枚で済ませる
+       注: 既存の body::before / ::after があれば衝突する。要確認。 */
+    body::before {
+      content: "";
+      position: fixed;
+      inset: 0;
+      z-index: 0;
+      pointer-events: none;
+      background:
+        radial-gradient(
+          120% 90% at 50% 38%,
+          rgba(0,0,0,0) 0%,
+          rgba(0,0,0,0) 55%,
+          rgba(0,0,0,0.18) 78%,
+          rgba(0,0,0,0.42) 100%
+        );
+      mix-blend-mode: multiply;
+    }
```

**効果（推測）:**
- 中央は素通し、周辺だけ徐々に黒で multiply → **画面端の粒子は暗く沈み、中央は明るい**。映画的ヴィネット。
- 「光が中央に集中している」錯覚で、明部の存在感が増す（ダイナミックレンジ知覚は背景コントラストに依存）。

**副作用:**
- `body::before` が既に他用途で使われていないか要確認（`grep -n "body::before" p3_styles.css` 必須、本診断ではスキップ）。
- multiply は黒成分しか足さないので「明部が暗くなる」可能性。粒子側の明部が drop-shadow で広がっていれば総合的にプラス。

**美学整合:** grey 中心 + 静謐 ＝ ヴィネットは適合。50→101 ＝ 中央に意識を集中させる構図はメッセージ性的にむしろポジティブ。

---

### 5.4 CSS-D — `body.inryoku-speaking #p6-canvas` の重複ルール解消

**現状の問題:** `p3_styles.css:200-203` と `p3_styles.css:2271-2274` の **両方に** `body.inryoku-speaking #p6-canvas` ルールが存在し、blur 値が違う（0.28px vs 0.18px）。後勝ちで `:2271` が効くが、メンテナンス上の罠。

**該当箇所 1** (`:200-203`):
```css
    body.inryoku-speaking #p6-canvas {
      filter: brightness(0.74) saturate(0.86) blur(0.28px);
      opacity: 0.94;
    }
```

**該当箇所 2** (`:2271-2274`, 末尾):
```css
    body.inryoku-speaking #p6-canvas {
        filter: brightness(0.79) saturate(0.9) blur(0.18px);
    }
```

**提案 diff（後者を削除し、前者を更新）:**
```diff
-    body.inryoku-speaking #p6-canvas {
-      filter: brightness(0.74) saturate(0.86) blur(0.28px);
-      opacity: 0.94;
-    }
+    body.inryoku-speaking #p6-canvas {
+      /* speaking 中は粒子を一段下げて、ロゴと chat UI に主役を譲る
+         brightness を控えめに、blur を薄く、opacity を 0.92 へ */
+      filter: brightness(0.78) saturate(0.88) blur(0.22px);
+      opacity: 0.92;
+    }
```
+ `:2271-2274` を**削除**。

**効果:** 仕様の一貫性。実視覚的には差が小さい。重複を放置すると将来の改修で衝突源になる。

**副作用:** ほぼゼロ。

---

### 5.5 CSS-E — 超大粒子用「クロスハイライト」を CSS で擬似的に表現するための準備

**現状:** 流れ星 / 超大粒子に lens flare 表現が無い（原因 #7）。

**提案:** これは **JS 側で `<div class="cross-flare">` を spawn する仕組みが必要**なので、CSS だけでは完成しない。が、**CSS 側にスタイルだけ用意しておく**ことで、JS 改修の足場になる。副作用ゼロ。

**提案 diff（新規ルール、未参照なので副作用なし）:**
```diff
+    /* 2026-04-29: 流れ星 / 超大粒子用クロスフレア（JS 側で生成想定、未使用なら無害）
+       使う側は <div class="p3-cross-flare" style="left:Xpx;top:Ypx;--c:#fff;--s:42px;"></div>
+       として生成すれば、十字 + 6 角の薄いゴーストが見える */
+    .p3-cross-flare {
+      position: fixed;
+      pointer-events: none;
+      width: var(--s, 32px);
+      height: var(--s, 32px);
+      transform: translate(-50%, -50%);
+      background:
+        radial-gradient(circle, var(--c, #fff) 0%, transparent 22%),
+        linear-gradient(0deg, transparent 48%, var(--c, #fff) 50%, transparent 52%),
+        linear-gradient(90deg, transparent 48%, var(--c, #fff) 50%, transparent 52%);
+      mix-blend-mode: screen;
+      opacity: 0;
+      filter: blur(0.4px) drop-shadow(0 0 6px var(--c, #fff));
+      z-index: 0;
+      transition: opacity 320ms ease;
+    }
+    .p3-cross-flare.on { opacity: 0.78; }
```

**効果:** 即時の視覚効果なし（要素が DOM に追加されないと出ない）。**JS 改修の準備として置いておく**。

**副作用:** ゼロ（参照されていなければ何も描画されない）。

**美学整合:** 控えめ（opacity 0.78、blur 0.4px、`mix-blend-mode: screen`）に振っているので grey 美学を破らない。

---

### CSS 5 案のサマリ表

| 案 | 即効性 | 副作用 | 美学リスク | 推奨度 |
|---|---|---|---|---|
| CSS-A drop-shadow 3 層 | ★★★★ | モバイル -3〜5fps | 低 | **採用最優先** |
| CSS-B mix-blend-mode | ★★（条件付き） | ほぼ無 | 低 | 採用OK |
| CSS-C ヴィネット | ★★★ | body::before 衝突要確認 | 中 | 確認後採用 |
| CSS-D 重複ルール解消 | ★（保守） | ゼロ | ゼロ | 採用 |
| CSS-E クロスフレア準備 | 0 | ゼロ | ゼロ | 採用（足場） |

---

## 6. シェーダ改修案 3 つ（Codex 申送り、設計のみ）

> **触らない方針:** 以下は設計案のみ。実装は Codex 担当。

### 6.1 SHADER-A — UnrealBloomPass を production で正規に有効化

**目的:** 主犯 #1 を解消。
**変更点:**
1. `index.html:1386` の `<script src="vendor/three.min.js"></script>` の直後に、**ローカル配信**の postprocessing スクリプトを追加：
   - `vendor/three-postprocessing/EffectComposer.js`
   - `vendor/three-postprocessing/RenderPass.js`
   - `vendor/three-postprocessing/UnrealBloomPass.js`
   - `vendor/three-postprocessing/LuminosityHighPassShader.js`
   - `vendor/three-postprocessing/CopyShader.js`
   - `vendor/three-postprocessing/ShaderPass.js`
   - 入手元: `https://unpkg.com/three@0.160.0/examples/js/postprocessing/*` を `/vendor/three-postprocessing/` に同梱（CSP self ホスト維持）。

2. `p3_code_for_claude.js:3281-3285` の guard はそのまま残す（フォールバック保険）。

3. **パラメータ調整**: 現在 `(W,H), 1.6, 0.5, 0.15`（strength, radius, threshold）。
   - inryokü grey 美学 + 司の「派手すぎず光らしく」 を考えると **`strength=0.85, radius=0.65, threshold=0.22`** を推奨（推測値）。
   - threshold 0.22 ＝ luminance 0.22 以上を bloom 対象にする → 暗いノイズ粒子を bloom から除外し、白コアと飽和粒子だけが滲む。
   - strength 0.85 ＝ 過剰滲みを避けて grey 静謐を保つ。
   - radius 0.65 ＝ 中広域。0.5 だと近接、0.85 だと拡散すぎる。

4. **renderer 設定の追記**:
   ```js
   renderer6.outputColorSpace = THREE.SRGBColorSpace;
   renderer6.toneMapping = THREE.ACESFilmicToneMapping;
   renderer6.toneMappingExposure = 1.0;
   ```
   `:2715-2718` の周辺に追加。

**重さ見積り:**
- Bloom は full-screen で 5 段の downsample + upsample + 加算 → **fragment heavy**。
- DPR 1.5 / 1080p で 1 フレーム +2〜4ms（M1）/ +8〜12ms（モバイル中位）。
- 既存 audit `#1` で DPR を 0.75 に下げる提案がある（未実装）。Bloom 導入と同時に DPR 0.75 へ落とすセット運用が現実解。

**副作用 / リスク:**
- WebGL コンテキストへの追加負荷。既存 audit の `#4`（WebGL ctx 2 個 + 独立 rAF 3 本）と相乗。
- iOS Safari で `WebGLRenderingContext` の half-float 拡張が落ちると Bloom が動かない端末がある（古い iPhone 推測）→ try/catch + fallback `renderer6.render()` 必須。
- `UnrealBloomPass` は内部で `WebGLRenderTarget` を 5 段確保 → メモリ +20MB 級（推測）。

**美学整合:** strength 0.85 で抑え気味なら grey 美学維持。50→101 哲学的には「光が滲む = 観測者の認識が広がる」と意味付け可能。

---

### 6.2 SHADER-B — fragment 簡素化 + ガウシアンテクスチャ + 色温度ミックス

**目的:** 原因 #5（過設計 fragment）+ #4（純色固定）+ #6（gl_PointSize クランプの安っぽさ）を同時に解消。

**設計:**

1. **point sprite に soft particle texture を貼る**:
   - 64×64 RGBA8 の **正規化ガウシアン**（中心 1.0、外周 0.0、`exp(-r^2 * 6)`）を 1 枚 procedural で生成（init 時 `Canvas2D` で書き出し → `THREE.CanvasTexture`）。
   - fragment 内で `texture2D(uMap, gl_PointCoord)` 一発でガウス取得。`exp(-d*d*36)` を CPU で 1 回計算した結果を GPU が読むだけになる → **fragment の演算量激減**。

2. **fragment を 2 層構造に簡素化**:
   ```glsl
   // 旧: core + innerGlow + outerHalo + rim + codeBand + prism (5 層 + 干渉縞)
   // 新: hot core + soft halo (2 層)
   void main() {
     vec4 tex = texture2D(uMap, gl_PointCoord);     // ガウシアン
     float core = pow(tex.a, 4.0);                  // 中心硬く
     float halo = tex.a;                            // 外周なめらか
     vec3 hotWhite = mix(vColor, vec3(1.0), 0.55);  // コアは白寄り
     vec3 finalColor = hotWhite * core * 1.6        // bloom が滲ませる前提で 1.6 倍
                     + vColor * halo * 0.32;        // 色は外周で
     float alpha = (core * 0.9 + halo * 0.4) * vBreathe;
     gl_FragColor = vec4(finalColor, alpha);
   }
   ```
   `prism / codeBand / ring` を**全削除**。bloom が「滲み」と「色温度シフト」を担うので、粒子側で書き込む必要がない。

3. **色温度ミックス**:
   - `:2745-2752` の PALETTE は維持（司指示尊重）。
   - 各粒子に対して `vec3 starColor = mix(palette[idx], vec3(1.0, 0.94, 0.86), warmMix)` で warm white を 0〜0.45 ランダムにブレンド。
   - 「6 純色」維持 + 「白寄り個体が一定割合」 ＝ 司指示と現実発光感の両立。

4. **gl_PointSize 範囲の見直し**:
   - 現状 min 0.72 / max 42 → min 1.5 / max 32 を推奨。微粒子は alpha で表現し、サイズ最小は 1.5px から（aliasing 軽減）。最大も 32px に下げて prism 縞が消えた後の単純ガウスでも安く見えないライン。

**重さ:**
- texture lookup 1 回は exp() 数本より軽い → 体感ニュートラル or 微高速化。
- bloom と組み合わせで初めて意味が出るので **SHADER-A 適用後**にやる。

**副作用:**
- `prism` の RGB 同心リングを楽しみにしているユーザがいるなら見え方変化大（grey 美学的には消す方が整合）。
- `codeBand`（`sin(d*30 - uTime*0.32)`）の「スキャンライン感」が消える。これは**意図的な演出**なので司確認必須。

**美学整合:** grey + 静謐 + 50→101 ＝ **粒子内に情報を書き込まない、滲みで語る**方向は完全整合。

---

### 6.3 SHADER-C — 粒子サイズ分布を log-normal 化 + 流れ星をポリゴン LineSegment に昇格

**目的:** 原因 #4（区間 uniform → log-normal）+ #7（流れ星が単一 Point）を解消。

**設計:**

1. **サイズ分布**:
   - 旧 5 区間 uniform（`:2773-2779`） → 新: log-normal `aSize = exp(mu + sigma * gauss())`、 mu=1.0, sigma=0.7。
   - `gauss()` は Box-Muller で `Math.sqrt(-2*Math.log(uRng())) * Math.cos(2*Math.PI*uRng())`。
   - 結果: 中央値 ≈ 2.7、95% 上限 ≈ 11、最大値ロングテールで 18〜25。区間ジャンプが消えて自然な heavy-tail。

2. **流れ星を `THREE.LineSegments` のセグメント追加に昇格**:
   - 現状: 流れ星は通常 Points 配列の中に混ぜて (1,1,1) 色 + サイズ 2〜5 で描画（`:3322-3331`）。
   - 提案: 別の `LineSegments` インスタンスを作り、流れ星 1 個 = 短い線分（進行方向に沿って 8〜16px の線）として描画。各セグメントに前端 alpha=1, 後端 alpha=0 のテーパーを入れる。
   - 実装規模: 流れ星は 0.8% ＝ 6200×0.008 = 約 50 個 → LineSegments は 50×2 = 100 頂点。軽い。
   - bloom と合わせると「すっと光が走る」表現になる。

3. **超大粒子（aSize > 11）に lens flare スプライト合成**:
   - 別 `THREE.Points` (or Sprite) で flare 専用テクスチャを上位 10% 粒子だけに重ねる。
   - texture: 64×64 で十字 + 6 軸ゴースト（CSS-E と同思想を GLSL に持ってくる）。
   - 色 = vColor、alpha = aSize / 20。

**重さ:**
- 流れ星 LineSegments：頂点 100 程度で無視できる。
- flare 用追加 Points：上位 10% ＝ 620 個。微増。

**副作用:**
- 流れ星が「明確に光線として走る」 ＝ 演出強化方向。司の grey + 静謐美学と若干トレードオフ（flare 過剰は安くなる）。
- 流れ星別 LineSegments を `bigBangState` の各遷移（absorb/explode）でちゃんと隠す処理が必要 → 漏れたら見栄え崩れる。

**美学整合:** flare はあえて控えめ（alpha 0.4 上限）で。50→101 哲学的には「上位 10% の特別な粒子」が文脈を持てる。

---

### シェーダ改修案サマリ

| 案 | 解決する原因 | 工数 | 重さ増 | 美学リスク | 推奨順序 |
|---|---|---|---|---|---|
| SHADER-A bloom 復活 | #1, #2, #3 | 1 日 | +3〜10ms/frame | 低（パラメータ控えめ） | **第 1 段** |
| SHADER-B fragment 簡素化 | #4, #5, #6 | 1〜2 日 | -1〜0ms | 中（codeBand/prism 削除） | A 完了後 |
| SHADER-C 分布 + 流れ星 | #4, #7 | 半日〜1 日 | +0〜1ms | 低 | A,B と独立に並行可 |

---

## 7. 推奨ロードマップ

### Phase 0 — 今日（1 時間以内、副作用ゼロ）
1. **CSS-A 適用** — `#p6-canvas` の filter を drop-shadow 3 層 + contrast 1.10 + saturate 1.18 へ。
2. **CSS-D 適用** — speaking ルールの重複解消。
3. **CSS-E 適用** — クロスフレア用クラスを「準備のみ」追加（未参照、無害）。

→ **体感:** 粒子境界が滲み、「LED ステッカー感」が「写真に近い淡い発光」へ。bloom 不在の最大限の代替。

### Phase 1 — 今週（CSS + 軽い JS、1 日）
4. **CSS-B 適用** — `mix-blend-mode: screen` を canvas に。
5. **CSS-C 適用** — body::before のヴィネット（`body::before` 重複の確認後）。
6. **既存 audit #1 の DPR 引き下げ** — `setPixelRatio(0.75)`。シェーダ重い前提で fragment 実行回数 60% 化。Bloom 導入の余裕を作る前段。

→ **体感:** 周辺暗化で中央の明部が引き立つ。原色 LED 感がさらに薄まる。

### Phase 2 — 来週（Codex 申送り、シェーダ改修、3 日）
7. **SHADER-A** — UnrealBloomPass の self-host 化 + 有効化（`strength=0.85, radius=0.65, threshold=0.22`） + `outputColorSpace=SRGB` + `toneMapping=ACESFilmic`。
8. **SHADER-B** — fragment の core+halo 2 層化、ガウシアンテクスチャ化、色温度ミックス。
9. **SHADER-C** — log-normal 分布、流れ星 LineSegments 化、上位 10% への flare 合成。

→ **体感:** 「写真」になる。grey 美学を保ったまま明部だけが滲み、CMYRGB 6 色は維持しつつも白寄り個体で柔らかく。50→101 哲学的に「観測者の意識で光が広がる」表現が成立。

### Phase 3 — 仕上げ（任意、1 日）
10. **`renderer6.toneMappingExposure` を音響 energy で動的に変える**（`uAudioEnergy * 0.2 + 1.0`）。BGM が盛り上がると露出が上がって明部がより滲む。
11. **モバイル DPR 0.5 への追加引き下げ** + bloom 強度を mobile では 0.6 に落とす条件分岐。

---

### 優先順位の根拠（インパクト × 工数 マトリクス）

| 案 | インパクト | 工数 | コスパ |
|---|---|---|---|
| CSS-A | ★★★★ | ★（30 分） | **最優先** |
| CSS-D | ★（保守） | ★（10 分） | 次いで |
| SHADER-A | ★★★★★ | ★★★（1 日） | **本丸** |
| SHADER-B | ★★★★ | ★★★（1〜2 日） | 本丸 2 |
| CSS-C | ★★★ | ★（30 分） | 高 |
| SHADER-C | ★★★ | ★★（半日） | 高 |
| CSS-B | ★★ | ★（10 分） | 中 |
| CSS-E | 0（足場） | ★（10 分） | 必要時 |

---

## 8. inryokü 美学との整合に関する補論

### 8.1 grey 中心の世界観でどこまで光らせるか
- 司さんの一貫指示: **grey 基調 + CMYRGB 6 色の点光源 + 白/橙廃止**。
- 「光らせる」≠「派手にする」。grey 美学では光は **「滲み」「広がり」「気配」** で表現される。
- 本診断の提案は**全て滲み方向**（drop-shadow / bloom / soft particle）であり、**彩度方向には行かない**（むしろ saturate を 1.32→1.18 に下げる）。
- 主犯 #4 の「色温度」も、6 純色を **白寄りに 0〜0.45 ブレンド** する形で純度を保つ。

### 8.2 派手さと静謐さのバランス
- 静謐 ＝ 暗部の保持 ＝ contrast を上げて暗部を沈める方向。
- 派手 ＝ 明部の張り付き ＝ bloom + tonemap で明部だけを「白に向かう滲み」に変える方向。
- 両立解: **「暗部を深く、明部を白く滲ませる」**。これは ACESFilmic + UnrealBloom 標準の挙動そのもの。本診断の Phase 2 で完成。

### 8.3 50→101 哲学（観測者によって光が見える）の表現
- 哲学: 「観測する側が居なければ光は意味を持たない」「100 の観測者に対して 101 の真実がある」。
- 本診断の整合: bloom = **観測距離が変わると見え方が変わる**（モバイル ≠ デスクトップ ≠ プロジェクタで強度感が変わる）。これは 50→101 と整合。
- 流れ星 LineSegments 化（SHADER-C） = **見ている瞬間にしか掴めない一回性** ＝ 哲学整合。
- 過剰演出（lens flare 派手 / chromatic aberration 強）は哲学的に**「観測の押し付け」**になるので避ける。本診断は控えめ側で全提案を統一。

---

## 9. 検証方法（実装後の確認手順、参考）

> 触らない方針なので**実行はしない**。将来の検証担当向けメモ。

1. `p3_test.html` 単体起動（postprocessing 入り） vs `index.html` Phase 3（postprocessing 無し）を**同じ画面で並べ**、明部のにじみ量・色相シフトを目視比較。**両者の差が「安っぽさ」の正体**。
2. Chrome DevTools の Performance タブで `loop6` と composer の実時間計測。
3. `renderer6.info.render.calls` をコンソールに dump して bloom 有無で draw call 数を確認（bloom ON で +5〜6 増えるはず）。
4. iPhone 13 / Pixel 6 / iPhone X / iPhone SE1 で実機確認。低端末で composer fallback が効いているか確認。
5. `body.inryoku-speaking` トリガ（chat 開始） / Big Bang クリック / 音響反応のそれぞれで bloom が破綻しないか目視。

---

## 10. 参照行リスト（grep 一発再現用）

```bash
# 主犯 #1（bloom 不在）
grep -n "EffectComposer\|UnrealBloom\|composer6" /Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js
grep -n "Bloom\|Composer\|postprocessing" /Users/10ta210/Desktop/inryoku_hp/index.html

# 粒子マテリアル本体
sed -n '2702,2900p' /Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js

# fragment 詳細
sed -n '2840,2890p' /Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js

# CSS フィルタ
grep -n "p6-canvas\|brightness\|saturate\|contrast" /Users/10ta210/Desktop/inryoku_hp/p3_styles.css

# 既存 audit
cat /Users/10ta210/Desktop/inryoku_hp/docs/p3-performance-audit-2026-04-28.md
```

---

## 付録 A — 司さんへの説明用「一行サマリ」

> 「光が安っぽい」のは粒子の作りではなく、**仕上げのブルームが本番で動いてないから**。粒子の中に頑張って光の絵を描いてるけど、本当に光らせる工程が抜けてる。CSS で滲ませる擬似対応は今日中に入る。本物の対応は Codex に渡すと 3 日。grey 美学は壊さない。CMYRGB 6 色も守る。

---

**END OF DIAGNOSIS — 2026-04-29**
