# inryokü Lighthouse 4 軸 推定スコア + 90+ 達成ロードマップ

**作成日**: 2026-04-28
**作成者**: Claude (Opus 4.7 / 1M context)
**対象**: `https://inryoku.com/`（`index.html` デスクトップ通しフロー）/ `https://inryoku.com/p3_test.html`（モバイル直行）
**手法**: 実機 Lighthouse 未実行（環境制約）。すべて根拠ベースの推定。各推定値には信頼度（★/★★/★★★）と数値根拠を併記。
**信頼度凡例**: ★ = 推定の不確実性大（実測必須）/ ★★ = 主要要因は把握、二次要因に幅あり / ★★★ = 既施策で確度高い

参照ドキュメント全部読了済み:
- `p3-performance-audit-2026-04-28.md`（5356 行コードリーディング監査）
- `accessibility-audit-2026-04-28.md`（WCAG 2.1 AA, Critical 8 / Major 14 / Minor 11）
- `security-review-2026-04-28.md` + `security-fixes-2026-04-28.md`（F1〜F13 適用済み）
- `seo-metadata-2026-04-28.md`（JSON-LD 6 type @graph + Product×12 + sitemap + robots）
- `critical-fixes-2026-04-28.md`（`p3_styles.css` で a11y / mobile UX を統合実装済み）
- `perf-fixes-2026-04-28.md`（preload / perf-observer.js / 画像最適化スクリプト）
- `enhance-layer-2026-04-28.md`（`enhance.js` 805 行で a11y 後付けレイヤ完備）
- `pwa-sw-2026-04-28.md`（SW + offline.html + register.js + 4 cache 戦略）
- `browser-compatibility-matrix-2026-04-28.md`（30 機能 × 10 ブラウザ）
- `architecture-2026-04-28.md`（全体俯瞰）
- `copy-audit-2026-04-28.md`（コピー監査）
- `codex-review-2026-04-28.md`（Codex 実装レビュー B+）

---

## 目次

1. [エクゼクティブサマリ](#1-エクゼクティブサマリ)
2. [Performance（推定）](#2-performance推定)
3. [Accessibility（推定）](#3-accessibility推定)
4. [Best Practices（推定）](#4-best-practices推定)
5. [SEO（推定）](#5-seo推定)
6. [PWA（参考）](#6-pwa参考)
7. [30 日ロードマップ](#7-30-日ロードマップ)
8. [60 日ロードマップ](#8-60-日ロードマップ)
9. [90 日ロードマップ](#9-90-日ロードマップ)
10. [リスク・トレードオフ](#10-リスクトレードオフ)
11. [実測コマンド・運用手順](#11-実測コマンド運用手順)

---

## 1. エクゼクティブサマリ

### 1.1 推定スコア表（現時点 / 2026-04-28）

#### Mobile（Slow 4G + CPU 4× throttle / Lighthouse モバイルプロファイル）

| カテゴリ | `index.html` (PC通しフロー) | `p3_test.html` (モバイル直行) | 信頼度 |
|---|---:|---:|:---:|
| **Performance** | **18–32** | **42–58** | ★★ |
| **Accessibility** | **72–82** | **74–84** | ★★ |
| **Best Practices** | **92–96** | **92–96** | ★★★ |
| **SEO** | **96–100** | **96–100** | ★★★ |
| **PWA** (参考) | installable ✓ | installable ✓ | ★★★ |

#### Desktop（高速回線 + CPU 1× / Lighthouse デスクトッププロファイル）

| カテゴリ | `index.html` | `p3_test.html` | 信頼度 |
|---|---:|---:|:---:|
| **Performance** | **48–62** | **70–82** | ★★ |
| **Accessibility** | **76–86** | **78–88** | ★★ |
| **Best Practices** | **95–100** | **95–100** | ★★★ |
| **SEO** | **96–100** | **96–100** | ★★★ |

**重要前提**: `index.html` は P0→P1→P2→P3 の通しフロー設計のため、**モバイル UA は冒頭で `p3_test.html` へ replace される**（`p3_code_for_claude.js` 観察 + `architecture-2026-04-28.md` 3.5 節）。Lighthouse Mobile プロファイルは UA を Moto G4 系に偽装するためモバイル判定で `p3_test.html` に飛ぶ。すなわち実際のモバイルユーザーが踏む経路は `p3_test.html` 一本。`index.html` のモバイルスコアは「もし誰かが UA を偽装したら」の参考値。

### 1.2 達成可能性ロードマップ

| 期間 | 軸 | 目標 | 達成可能性 | 主要施策 |
|---|---|---:|---|---|
| **30 日** | Performance | 70+ (mobile) / 85+ (desktop) | 高（image opt + Three.js defer + Inter ウェイト削減 + GA4 ID 投入だけで到達） | §7 |
| **30 日** | Accessibility | 90+ | 高（HTML 側で C-1〜C-5 残作業 = `<main>`/`<button>` 化 + viewport-fit=cover + フォーカストラップ完成） | §7 |
| **30 日** | Best Practices | 95+ | **すでに到達見込み**。CSP の `'unsafe-inline'` 警告のみが減点要因 | §7 |
| **30 日** | SEO | 100 | **ほぼ到達済**。GA4 実 ID 置換 + 商品 alt 完備のみ | §7 |
| **60 日** | Performance | 85+ (mobile) / 92+ (desktop) | 中（粒子削減 + Critical CSS + AVIF 適用 + キャッシュヘッダ） | §8 |
| **60 日** | Accessibility | 95+ | 中（`user-scalable=no` 撤廃 + 全 div→button 化 + アニメーション一時停止 UI） | §8 |
| **90 日** | 全軸 | **95+** | 中〜要 trade-off（粒子宇宙の DPR / 粒子数の妥協が必要、§10 参照） | §9 |

### 1.3 30 秒で要点

- **SEO は実質完成**。GA4 ID（現在 `G-XXXXXXXXXX` placeholder）を実 ID に差し替えれば 100 が見える。
- **Best Practices は 95 前後で安定**。`security-fixes-2026-04-28.md` の F9 で CSP / HSTS / XFO / Referrer-Policy / Permissions-Policy / nosniff の 6 ヘッダが全レスポンスに乗っており、HTTPS 配信であれば即 95+。`'unsafe-inline'` script で減点 0〜5 程度。
- **Accessibility は CSS 修正と `enhance.js` で 80 前後まで上がっているが**、HTML 側の真の `<button>` 化 / `<main>` 化 / `aria-label` 直書きが残っており 90 ラインを超えるには **Codex 編集ロックの `p3_code_for_claude.js` への侵食が必須**。
- **Performance が最大の地雷**。`p3_code_for_claude.js` 261KB 同期 parse + `vendor/three.min.js` 656KB 同期 + 5000 粒子 + 60 秒 spawn + 2 つの WebGL コンテキスト + 3 本の独立 rAF。モバイル fps は中位機で 25〜50。Lighthouse スコアは TBT（Total Blocking Time）と LCP に支配される。施策を全部入れても **モバイル 90 は哲学的こだわり（粒子宇宙）と衝突するため、85 で打ち止めが現実的**（§10）。

---

## 2. Performance（推定）

### 2.1 現状推定スコア

**Mobile (`p3_test.html`, Slow 4G + CPU 4× throttle):**
- **推定 42–58 / 100**（信頼度 ★★）
- 中央値推定: **48**

**Desktop (`p3_test.html`, 高速回線 + CPU 1×):**
- **推定 70–82 / 100**（信頼度 ★★）
- 中央値推定: **76**

**Mobile (`index.html` の場合 / UA 偽装時):**
- **推定 18–32 / 100**（信頼度 ★★）
- 中央値推定: **25**

### 2.2 Core Web Vitals 推定

#### `p3_test.html` (Slow 4G + CPU 4× throttle)

| メトリック | 推定値 | 良/中/悪 (Lighthouse 閾値) | 寄与度 (重み) | 根拠 |
|---|---:|---|---:|---|
| **TTFB** | 80–250ms | 良 (<800ms) | 内訳 | server.js は Node 標準 http、`MAX_BODY_SIZE` のみ介在、`Cache-Control: no-store` 等の遅延要因なし |
| **FCP** | 0.9–1.5s | 良 (<1.8s) | 10% | head に Press Start 2P woff2 preload + p3_styles.css preload。p3_test.html 自体 24KB 軽量 |
| **LCP** | **2.4–3.6s** | 中〜悪 (<2.5s 良 / <4.0s 中) | **25%** | hoodie webp 28KB は preload 済 (`fetchpriority=high`) で取得は早い。**ただし LCP 候補要素自体が DOM に挿入されるのは `renderPhase3()` 内 `root.innerHTML` 後。p3_code_for_claude.js 261KB 同期 parse (≒ Slow 4G で 1.4s ダウンロード + 0.7s parse) を待つ** |
| **TBT** | **600–1400ms** | **悪** (<200ms 良) | **30%** | three.min.js 656KB 同期 parse (≒ 4× CPU throttle で 0.5s) + p3_code 5356 行同期 parse (≒ 0.7–1.2s) + initParticleUniverse 同期実行 + 5000 粒子 BufferGeometry 構築 + 2 つのシェーダコンパイル |
| **CLS** | 0.00–0.05 | 良 (<0.1) | 25% | レイアウトはほぼ全て `position: absolute/fixed` + `transform`。商品画像に width/height 未指定の箇所はあるが、`aspect-ratio: 1/1.14` を `p3_styles.css:839` で予約済 |
| **Speed Index** | 2.8–4.5s | 中 (<3.4s 良 / <5.8s 中) | 10% | 60 秒 spawn のため 5 秒目時点で粒子 0.06% (3 個) しか出ていない。視覚進捗は遅い |

**TTI (Lighthouse v10 では非主要だが参考):**
- 推定 **3.5–5.5s**（mobile）。`renderPhase3()` 完了 → 3D logo sphere 起動 1300ms 後 → ブランドリビール 1200ms 後で「触れる」のは ≒ 4–6s。

#### Desktop（CPU 1× + 高速）

| メトリック | 推定値 | 根拠 |
|---|---:|---|
| TTFB | 30–80ms | localhost / 同一リージョン VPS |
| FCP | 0.4–0.8s | head 内 preload + ローカル vendor |
| **LCP** | **1.6–2.6s** | hoodie webp は preload で取得早いが、`p3_code_for_claude.js` parse + `renderPhase3` 同期実行で DOM 挿入が遅延 |
| **TBT** | **150–450ms** | three.min.js + p3_code を CPU 1× で parse すれば 250–500ms。Long Tasks 1〜2 本 |
| CLS | 0.00–0.03 | 同上 |

### 2.3 既施策で効いている項目（=推定スコアの底支え）

`docs/perf-fixes-2026-04-28.md` で実装済み:

1. **LCP 候補画像 preload (WebP)** — `enter_hoodie.webp` 28KB / `info_logo_hoodie.webp` 24KB を `<link rel="preload" as="image" type="image/webp" fetchpriority="high">`。ネット待ちは消えている（ただし DOM 挿入待ちは残る）。**LCP 改善幅: Slow 4G で約 290ms 短縮**。
2. **Press Start 2P woff2 preload** — 12.2KB を crossorigin preload。FOIT 回避。
3. **粒子宇宙の DPR キャップ** — `renderer6.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))`（`p3_code_for_claude.js:2712`）。モバイル DPR 3 → 1.5 で fragment shader 実行回数 50% 削減。
4. **Service Worker** — `sw.js` で 2 回目以降の訪問は cache-first（static / image）/ stale-while-revalidate（HTML）。**初回訪問の Lighthouse には効かないが、cold reload や反復測定での実体験は劇的改善**。
5. **画像最適化バッチ完備** — `scripts/optimize-images.sh` で `cwebp` / `avifenc` の 1 コマンド。すでに hoodie 系は WebP 化済み（PNG 312KB → WebP 28KB、91% 削減）。
6. **Web Vitals 計測** — `perf-observer.js` (210 行) が `LCP/FID/CLS/INP/FCP/TTFB/longtask` を console + `window.__inryokuVitals` に出力。本番でリアル数値を取れる態勢。
7. **Three.js examples 削除** — p3_test.html では `EffectComposer/UnrealBloomPass` 等の examples/js を CDN 読込から外し、UMD 単体に統一済（`browser-compatibility-matrix-2026-04-28.md` 1-C 表）。
8. **粒子モバイル分岐**（推定） — `architecture-2026-04-28.md` 8.1 に「モバイルは 2800 粒子 / デスクトップ 5000 粒子」と記載。`isMobile = innerWidth < 768` で半減できているなら fps の谷が浅くなる（コード上の確証は `browser-compatibility-matrix-2026-04-28.md` Issue I-12 で「要確認」とされており、未確認）。

### 2.4 残課題（優先度順）

#### P0（30 日、必須）

**P-1. `p3_code_for_claude.js` 261KB の同期 parse が TBT を支配**
- **数値根拠**: 261KB / 4G 2.5MB/s ≒ 0.10s ダウンロード（preload なし） + V8 parse 約 1KB/ms × CPU 4× throttle = **約 1.0–1.4s parse**。これが TBT の 60% を占める。
- **対策**: `<script src="p3_code_for_claude.js" defer>` 化。ただし inline `<script>` の `renderPhase3()` 呼び出しが load 完了前に走る危険があるため、呼び出し側を `DOMContentLoaded` 待ちに包む必要あり（`perf-fixes-2026-04-28.md` §4.2）。
- **改善幅**: TBT **−400〜−800ms**、Performance スコア **+10〜+18**。

**P-2. `vendor/three.min.js` 656KB が `<head>` 同期**
- **数値根拠**: 656KB / 4G ≒ 0.26s + parse 0.5–0.7s（CPU 4×）。head blocking のため FCP もこの分遅延。
- **対策**: `<body>` 末尾移動 + `defer`（順序維持）。
- **改善幅**: FCP **−200〜−400ms**、TBT **−300〜−500ms**、Performance **+8〜+12**。

**P-3. Inter ウェイト 5 → 2 に削減（`index.html` のみ該当）**
- **数値根拠**: Google Fonts CSS + woff2 合計 80–120KB → 30–45KB（`perf-fixes-2026-04-28.md` §5.3）。
- **対策**: `Inter:wght@300;400;500;600;700` → `Inter:wght@400;700`。Press Start 2P 重複ロード削除。
- **改善幅**: TTFB / FCP **−100〜−200ms**、Performance **+3〜+6**。

**P-4. `inryoku_og.png` 522KB のまま**
- og:image は LCP 候補ではないが、SNS bot のフェッチで帯域を食う。WebP 化で 80KB 級に。
- ファイル名は維持しつつ `og:image:type=image/png` のまま、本体だけ webp 用 og 画像を別フィールドで補強する方針が安全。
- **改善幅**: 直接 Lighthouse には響かないが、`.well-known/...` 系の audit は無し。優先度低。

**P-5. 画像最適化バッチ未適用**
- `scripts/optimize-images.sh` の実行（司さん作業）。残 PNG（`logo_shell.png` 175KB / `logo_sphere.png` 38KB / `inryoku_logo_icon.png` 198KB）の AVIF/WebP 化。
- **改善幅**: LCP 直結ではないが、後続画像の総 transfer **−400KB 級**。Performance **+2〜+5**。

#### P1（60 日）

**P-6. Critical CSS インライン化**
- `p3_styles.css` 91KB / 2927 行のうち、first paint に必要なのは数 KB。
- **対策**: `perf-fixes-2026-04-28.md` §3.1 のテンプレに従い、`<style>` インライン + `<link rel="preload" as="style" onload>` 化。
- **改善幅**: FCP **−50〜−120ms**、Performance **+3〜+6**。

**P-7. 粒子削減（5000 → 3000 / 60 秒 → 30 秒 spawn）**
- `p3-performance-audit-2026-04-28.md` #7。idle fps **+15〜25%**。
- TBT には直接効かないが、INP（後段の操作応答性）が改善。
- **改善幅**: Performance **+2〜+4**。哲学的こだわりとのトレードオフ（§10）。

**P-8. constellation の spatial cell hash + 30Hz 化**
- `p3-performance-audit-2026-04-28.md` #2。idle 60Hz → 30Hz、二重ループ 360k → 32k 比較。
- **改善幅**: モバイル fps **+5〜10%**、Performance **+1〜+3**。視覚差分なし。

**P-9. キャッシュヘッダ**
- `server.js` で `?v=` 付き静的に `Cache-Control: public, max-age=31536000, immutable`。HTML は `max-age=300, must-revalidate`。
- **改善幅**: 反復訪問の Lighthouse スコア **+5〜+10**（cache audit 通過 + LCP -300ms）。

**P-10. logo sphere の SphereGeometry(1, 64, 64) → (1, 32, 32)**
- 頂点 8000 → 2000、初期化時間短縮。
- ただし Codex 編集中ファイル領域、要確認（`p3-performance-audit-2026-04-28.md` 補足 1）。

#### P2（90 日）

**P-11. `index.html` の Three.js を `vendor/` ローカル化**
- `cdn.jsdelivr.net` への接続セッション削減 → mobile で **−50〜100ms**。
- `browser-compatibility-matrix-2026-04-28.md` Issue I-10 で既に推奨されている。

**P-12. Three.js を ESM tree-shake で 250KB 級に**
- 必要モジュール（Scene/Camera/WebGLRenderer/BufferGeometry/Float32BufferAttribute/ShaderMaterial/LineBasicMaterial/Points/LineSegments/SphereGeometry/Color/AdditiveBlending）のみ rollup でバンドル。
- **改善幅**: 656 → 250KB、TBT **−300〜−500ms**。
- ただし `p3_code_for_claude.js` を `import` 形式に書き換え必要 → 中規模リファクタ。

**P-13. logo sphere の DPR 1.0 化**
- 卵は 60×60 px のため DPR 2 は過剰。`init3DLogoSphere` の `pxRatio = Math.min(devicePixelRatio, 1.0)`（`p3-performance-audit-2026-04-28.md` #1 後段）。

### 2.5 90+ までのギャップ（数値分解）

#### Mobile (`p3_test.html`)、現状中央値 48 → 目標 90:

| 段階 | 施策 | 推定スコア | 累積改善 |
|---|---|---:|---:|
| 0. 現状 | — | 48 | — |
| 1. P-1 + P-2 (defer 化) | Three.js + p3_code defer | 60 | +12 |
| 2. P-5 (画像最適化) | optimize-images.sh 実行 + 残 PNG → WebP/AVIF | 64 | +4 |
| 3. P-6 (Critical CSS) | inline + async load | 68 | +4 |
| 4. P-9 (Cache Header) | 反復測定でキャッシュ恩恵 | 73 | +5 |
| 5. P-7 (粒子削減 5000→3000) | spawn 30s | 76 | +3 |
| 6. P-12 (Three.js tree-shake 250KB) | rollup ESM | 84 | +8 |
| 7. P-13 + #1 (DPR 全面 0.5/0.75) | 司発言と整合 | 87 | +3 |
| 8. P-8 (constellation 最適化) | grid hash + 30Hz | 90 | +3 |
| **合計** | | **90** | **+42** |

→ **モバイル 90 達成は技術的には可能だが、粒子削減（P-7）+ Three.js リファクタ（P-12）が必要**で、両方とも哲学的こだわりに触る。中央値 85 で打ち止めの判断もあり（§10）。

#### Desktop (`p3_test.html`)、現状中央値 76 → 目標 95:

| 段階 | 施策 | 推定スコア |
|---|---|---:|
| 0. 現状 | — | 76 |
| 1. P-1 + P-2 | defer 化 | 84 |
| 2. P-5 + P-6 | image opt + Critical CSS | 88 |
| 3. P-9 | Cache Header | 92 |
| 4. P-12 | Three.js tree-shake | 96 |

→ Desktop 95 は 60 日で十分達成可能。

### 2.6 推定改善幅まとめ

| 軸 | 30 日後（推定） | 60 日後 | 90 日後 |
|---|---:|---:|---:|
| Mobile (`p3_test.html`) | 48 → **70** | → **84** | → **90** |
| Desktop (`p3_test.html`) | 76 → **88** | → **94** | → **97** |
| Mobile (`index.html`) | 25 → **45**（UA 振り分けで実害なし） | → **65** | → **80** |
| Desktop (`index.html`) | 56 → **76** | → **88** | → **94** |

---

## 3. Accessibility（推定）

### 3.1 現状推定スコア

**両 HTML 共通（Mobile / Desktop ほぼ同値）:**
- **推定 72–84 / 100**（信頼度 ★★）
- 中央値推定: **78**

### 3.2 WCAG 2.1 AA 適合状況（`accessibility-audit-2026-04-28.md` 5 章を圧縮）

| Principle | A | AA | 主な不達成 |
|---|:---:|:---:|---|
| **1. Perceivable** | ⚠ | ❌ | 1.1.1 (alt 空), 1.3.1 (landmark 不在), 1.4.3 (コントラスト多数), 1.4.4 (`user-scalable=no`), 1.4.11 (UI 枠 1.6:1) |
| **2. Operable** | ❌ | ❌ | 2.1.1 (キーボード排除), 2.2.2 (5秒以上自動アニメ停止 UI 無), 2.4.1 (skip link 無), 2.4.3 (focus trap 無), 2.4.7 (focus visible 抑止) |
| **3. Understandable** | ⚠ | ⚠ | 3.1.2 (英語混在に lang 無), 3.3.2 (label 無し / placeholder のみ) |
| **4. Robust** | ❌ | ❌ | 4.1.2 (div clickable / SVG aria-label 無), 4.1.3 (aria-live 無) |

### 3.3 既施策で効いている項目（=スコアの底支え）

#### CSS 側（`critical-fixes-2026-04-28.md` で `p3_styles.css` に統合済）:

1. **C-6 コントラスト全面底上げ** — `.cart-stripe-note 0.25→0.6` / `.cart-empty 0.3→0.7` / `.product-specs #666→#b0b0b0` / `.footer-toggle 0.15→0.55` / フッター系全 0.7 / Press Start 2P 8–9px → 11px 12px に底上げ。**WCAG 1.4.3 通常文字 4.5:1 が 24 セレクタで充足**。
2. **C-7 :focus-visible 復活** — `outline: 2px solid #00ffff; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(0,255,255,0.25)` を全 interactive 要素にグローバル適用。マウス時には出ない。**WCAG 2.4.7 充足**。
3. **M-2 ボタン枠 0.15 → 0.4** — UI 要素 1.4.11 (3:1) 達成。
4. **mobile UX 提案 1〜5 適用** — safe-area-inset / size-btn 44×44 / form input 16px / `touch-action: pan-y` / 商品カード文字 11px。

#### JS 側（`enhance.js` 805 行で後付け、`enhance-layer-2026-04-28.md`）:

5. **A1: skip link 注入** + 6. **A2: `#root` を `role="main"` 化** + 7. **A3: sr-only `<h1>inryokü</h1>` 注入** → C-1 / C-2 を CSS 改変なしでカバー。
8. **A4: div clickable に `role="button" / tabindex=0` + Enter/Space ハンドラ** → C-3 / C-4 を後付け解決（**真の `<button>` ではないが Lighthouse axe-core の `button-name` チェックは通過する**）。
9. **A5: SVG `role="img"` / `aria-hidden`** → M-8。
10. **A6: モーダルフォーカストラップ + 元要素返却**（MutationObserver 監視）→ C-5。
11. **A7: aria-live グローバル領域 + cart-badge 監視**（polite / assertive 二系統）→ C-8。
12. **A8: focus-visible の polyfill 補完** → 古ブラウザ対応。
13. **A9: `prefers-reduced-motion` 強化**（`html.enh-reduce-motion` で全アニメ抑止）→ M-11 / M-12。
14. **A10: フォーム input に `aria-label` + `autocomplete` 推定注入** → M-5 / m-1。
15. **A11: `.brand-name` に `aria-label="inryokü"`、子 `.brand-char` を `aria-hidden`** → C-2 補完（SR が "i n r y o k ü" を一字読みする問題解消）。
16. **A12: `<html lang>` 保証**（無ければ `ja` 注入）→ 3.1.1。

→ **enhance.js のカバー率: Critical 8 件中 7 件（C-6 のみ CSS 側）。axe-core ベースの Lighthouse a11y チェックの大半を後付けで通過する設計**。

### 3.4 残課題（90+ までのギャップ）

#### Lighthouse Accessibility が直接減点する項目で、現状残っているもの:

**A-R1. `<meta viewport>` の `user-scalable=no` (M-13)**
- `index.html:6` / `p3_test.html:5` 両方 `maximum-scale=1.0, user-scalable=no`。
- Lighthouse audit `meta-viewport` で **直接失格**（−7〜−10 点）。
- 対策: `maximum-scale=1.0, user-scalable=no` を削除して `viewport-fit=cover` を追加。
- ブランド意図（没入演出）と衝突するが、**Lighthouse 90+ には必須**。

**A-R2. 商品画像 alt が template literal だが SR が情報不足**
- `<img src="${p.image}" alt="${p.name}">` で `p.name` は入っているが、`color` や `category` が欠けている。Lighthouse の `image-alt` audit は通過するが、axe-core の追加チェックで部分減点。
- 対策: alt を `${p.name} — ${p.color} ${p.category}` に拡張。

**A-R3. true `<button>` 化**（HTML 直書き / JS 編集）
- `enhance.js` の `role="button" + tabindex=0` で axe-core は通るが、Lighthouse の **`button-name` audit は SR 互換性まで見ない**ので影響軽微。**90 達成には enhance.js だけで足りる**。
- 95+ には真の `<button>` 化が望ましい（Codex 編集ロック解除後）。

**A-R4. アニメーション一時停止 UI（M-12 / WCAG 2.2.2）**
- `prefers-reduced-motion` は `enhance.js` で対応済だが、OS 設定をしていないユーザー向けの「停止ボタン」は無い。
- Lighthouse は直接減点しない（manual audit 扱い）が、95+ で慎重なら追加検討。

**A-R5. lang 動的更新（M-1）**
- 「CHECKOUT」「ADD TO CART」などの英語混在に `<span lang="en">` ラップが無い。
- Lighthouse 直接減点なし（`html-has-lang` のみ）、ただし axe-core の `valid-lang` で警告。

**A-R6. C-1 真の landmark 階層**
- `enhance.js` の `role="main"` 後付けで Lighthouse は通る。`<main>` への HTML 化は 95+ 段階での磨き上げ。

**A-R7. グリッチモード閃光（M-10 / WCAG 2.3.1）**
- 3Hz 以上の閃光があれば即失格。**実機 / 動画キャプチャでの周波数測定が必要**。Codex 担当。

### 3.5 90+ までの数値ギャップ

Lighthouse a11y スコアは「重大度ウェイト付きの全 audit pass/fail」の集計。enhance.js + critical-fixes が適用済の現状で、残る減点項目を試算:

| 項目 | 現減点 | 30 日後施策 | 残減点 |
|---|---:|---|---:|
| `meta-viewport` (A-R1) | -7 | viewport-fit=cover 化 | 0 |
| `color-contrast` 残り | -4 | brand char `#0044FF` を `#3060FF` 寄りに | -1 |
| `image-alt` 詳細 (A-R2) | -2 | alt 拡張 | 0 |
| `tap-targets` 残り | -3 | `cart-item-remove` などの 44px 確保 | -1 |
| `button-name` (axe 内訳) | -2 | true button 化 | -1 |
| `link-name` | -1 | aria-label SNS リンク | 0 |
| `valid-lang` | -1 | span lang ラップ | 0 |
| その他 manual | 0 | — | 0 |
| **合計減点** | **−20** | | **−3** |

現状 78 → 30 日後 **92**、60 日後 **96**、90 日後 **98**。

---

## 4. Best Practices（推定）

### 4.1 現状推定スコア

**両 HTML 共通:**
- **推定 92–96 / 100**（信頼度 ★★★）
- 中央値推定: **94**

### 4.2 既施策で効いている項目

`security-fixes-2026-04-28.md` の F1〜F13 が **server.js 全面適用済み**。Lighthouse Best Practices の主要 audit を網羅:

| Lighthouse audit | 状態 | 既施策 |
|---|:---:|---|
| `is-on-https` | ✅ | 本番 HTTPS 前提（HSTS で max-age=63072000 + includeSubDomains 設定済 / F9） |
| `geolocation-on-start` | ✅ | 使用していない |
| `notification-on-start` | ✅ | 同上 |
| `no-vulnerable-libraries` | ✅ | 本番依存 0、Three.js r160 は脆弱性なし |
| `no-document-write` | ✅ | 使用なし |
| `external-anchors-use-rel-noopener` | ✅ | `target="_blank" rel="noopener"`（X / Instagram リンク） |
| `password-inputs-can-be-pasted-into` | ✅ | password input 不在 |
| `image-aspect-ratio` | ⚠ | 商品画像に width/height 未指定。`aspect-ratio: 1/1.14` CSS で予約済だがブラウザ計算で警告余地 |
| `image-size-responsive` | ⚠ | `srcset` 未設定。ただし WebP は単一サイズで十分 |
| `deprecations` | ✅ | `-webkit-overflow-scrolling: touch` のみ deprecated 警告（Issue I-2） |
| `errors-in-console` | ✅ | enhance.js / register.js は try/catch 完備、SW は console.warn 隔離 |
| `valid-source-maps` | ⚠ | source maps 無し（=減点なし、Lighthouse は警告のみ） |
| `csp-xss` | **⚠** | CSP は適用済（F9）だが `'unsafe-inline'` script を許可しているため Lighthouse は警告（=−2〜−5 減点） |
| `inspector-issues` | ✅ | DevTools Issues は報告なしのはず |

#### セキュリティヘッダ（F9 適用済）:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://api.qrserver.com https://cdn.shopify.com; connect-src 'self' https://*.myshopify.com https://api.groq.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
```

→ Lighthouse の Best Practices で **HTTPS / セキュリティ系 audit はすべて通過**。

### 4.3 残課題

**B-1. CSP `'unsafe-inline'` script 警告**
- 現状: インライン JSON-LD + `index.html` 内 phase boot script + `<script>renderPhase3();</script>` 等で `'unsafe-inline'` 必須。
- Lighthouse v10 の `csp-xss` audit は `'unsafe-inline'` を strict CSP 違反として警告（=−2〜−5）。
- 30 日対策: 受容（Lighthouse スコアは 95 で頭打ち、事実上の上限）。
- 60 日対策: nonce 化。`server.js` でリクエストごとに nonce 生成 → HTML 内 `<script nonce="...">` に注入 → CSP `'nonce-XXX'`。**インライン全箇所への nonce 付与が必要で工数大**。

**B-2. `image-aspect-ratio` 警告**
- 商品画像 `<img src="..." alt="...">` に width/height 属性が無い箇所あり。`aspect-ratio` CSS で予約しているが、Lighthouse の image-aspect-ratio audit は HTML 属性ベース。
- 対策: `<img width="800" height="912" ...>` を全商品画像に追加。Codex 編集中ファイル領域。

**B-3. `image-size-responsive` 警告**
- 1 サイズの WebP のみ。`<picture>` + `srcset` で 400w/800w/1200w 提供すれば警告解消。
- 対策: `perf-fixes-2026-04-28.md` §1.5 の `<picture>` テンプレ + 複数解像度生成。

**B-4. console errors の防止監視**
- 現状はクリーンと推定だが、本番デプロイ後に `errors-in-console` で検出されたら個別修正。

**B-5. paste 可能な password input**
- N/A（input 自体不在）

### 4.4 90+ までのギャップ

現状 94 → 30 日 **96**（B-2 修正） → 60 日 **98**（CSP nonce 化）→ 90 日 **100**（B-3 srcset 完備）。

すでに Best Practices は 90 達成済み。**95+ も視界にある**。

---

## 5. SEO（推定）

### 5.1 現状推定スコア

**両 HTML 共通:**
- **推定 96–100 / 100**（信頼度 ★★★）
- 中央値推定: **98**

`seo-metadata-2026-04-28.md` で **Lighthouse SEO 100 を狙って実装されたドキュメント**。

### 5.2 既施策で効いている項目（=ほぼフル装備）

#### Lighthouse SEO audit 全 13 項目チェック:

| Audit | 状態 | 根拠 |
|---|:---:|---|
| `document-title` | ✅ | `inryokü — 50% → 101% / 見えないものの可視化`（60 字以内） |
| `meta-description` | ✅ | 日本語+英語、観測哲学、150 字前後 |
| `http-status-code` | ✅ | server.js が 200 |
| `link-text` | ✅ | "click here" 系なし（copy audit 確認済） |
| `crawlable-anchors` | ✅ | href 付きリンクのみ |
| `is-crawlable` | ✅ | `robots: index, follow, max-image-preview:large` + robots.txt allow |
| `robots-txt` | ✅ | 新規作成、Googlebot/Bingbot 明示許可 + AI クローラ（GPTBot/ClaudeBot/anthropic-ai/CCBot/PerplexityBot）明示 Allow + 攻撃的スクレイパ Disallow |
| `image-alt` | ⚠ | enhance.js の補完で大半は通るが、Codex 編集中ファイルの直書き alt はまだ template literal 依存 |
| `hreflang` | ✅ | `ja` / `x-default` |
| `canonical` | ✅ | 両 HTML 完備 |
| `font-size` | ✅ | clamp 設計 + critical-fixes で 11px+ |
| `tap-targets` | ✅ | 44×44 確保（critical-fixes M-9 対応） |
| `viewport` | ✅ | 完備（ただし `user-scalable=no` は SEO audit には影響しない、a11y のみ） |
| `structured-data` | ✅ | JSON-LD `@graph` で Organization/Brand/WebSite/OnlineStore/WebPage/BreadcrumbList + ItemList(12) + Product×12 |

#### SNS/OGP 系（Lighthouse 直接 audit ではないが SEO 一般）:

- `og:image:width=1200` / `og:image:height=630` / `og:image:type=image/png` / `og:image:alt`
- `twitter:card=summary_large_image` / `twitter:site=@inryoku` / `twitter:creator=@inryoku` / `twitter:image:alt`
- `og:locale=ja_JP` + `og:locale:alternate=en_US`（将来英語版用予約）

#### 構造化データの厚み:

- **Organization** with `slogan: "50% → 101% / 見えないものの可視化"`、`alternateName: ["inryoku", "引力"]`（漢字検索拾い）
- **Brand** with `slogan: "50% → 101%"`
- **WebSite** with potential `SearchAction`（`{search_term_string}` placeholder）
- **OnlineStore**
- **WebPage** + **BreadcrumbList**
- **ItemList** with 12 positions
- **Product × 12** 完全列挙（`p3_test.html`）: `@id`, `name`, `sku`, `image`, `description`, `brand`, `category`, `color`, `offers` (priceCurrency=JPY, price, availability=InStock, itemCondition=NewCondition, seller)

→ **Lighthouse SEO は 98–100 で安定**。

### 5.3 残課題（実は既に近い）

**S-1. GA4 実 ID 投入**
- `p3_test.html:59,64` の `G-XXXXXXXXXX` placeholder を実 ID に置換（司さん作業）。
- Lighthouse SEO 直接減点なし（GA4 は推奨ではない）。**Best Practices にも影響なし**。
- ただし計測体制として必須。

**S-2. 商品画像 alt の充実**
- 現状 template literal の `${p.name}` のみ。`color` / `category` 拡張で SEO 効果向上（image search 流入）。
- Lighthouse 直接減点なし。

**S-3. `og:image` の WebP 版**
- 現在 PNG 522KB。Lighthouse 直接減点なし。SNS bot のフェッチ帯域削減目的のみ。
- **og:image は PNG/JPG が SNS で安全**（X が WebP 対応済だが Slack や古いクライアントでブランクリスク）。維持推奨。

**S-4. `inryoku.com` のクロール完了確認**
- Google Search Console での URL 検査・インデックス状況確認。Lighthouse audit ではなくサーチコンソール側。

**S-5. AggregateRating / Review 追加（将来）**
- 商品レビュー機能実装後、Product JSON-LD に `aggregateRating` 追加 → ★表示。
- Lighthouse は直接見ないが、Rich Results Test で +1 type。

**S-6. FAQPage JSON-LD（size-guide.html / returns.html）**
- 検索結果でアコーディオン展開 → CTR 向上。

**S-7. Server-side hreflang Header**
- `Link: <...>; rel="alternate"; hreflang="ja"` を server.js で送出。link rel と二重で堅牢化。

### 5.4 90+ までのギャップ

現状 98 → 30 日 **100**（GA4 ID 投入のみで実質完了、ただし GA4 は SEO audit に影響しないので現状でも 100 可能性高）。

**SEO は事実上完成**。

---

## 6. PWA（参考）

Lighthouse v10+ から PWA カテゴリは独立スコアから外れたが、`installable` / offline 対応 / manifest 構造は **Best Practices と SEO 双方の補強要素**として効くため記載。

### 6.1 現状

`pwa-sw-2026-04-28.md` で **完成度高**:

#### 既施策

1. **Service Worker** (`sw.js` 257 行) — `inryoku-v1-2026-04-28-static/-html/-api/-image` の 4 cache、cache-first / network-first(5s timeout) / SWR 振り分け、precache（`/`, `offline.html`, `manifest.json`, ロゴ, p3_styles.css, particle_*.css, three.min.js）。
2. **`offline.html`** 3.3 KB — breathing grey orb、external 依存 0、`online` イベント検知で retry → reconnect、`prefers-reduced-motion` 対応。
3. **`register.js`** 245 行 — load 後に `/sw.js` 登録 + 1 時間ごと update + updatefound で update toast + reload 時に `SKIP_WAITING` + `controllerchange` でリロード。
4. **`beforeinstallprompt`** 制御 — 30 秒後に install banner、appinstalled で消す、7 日間 dismiss 記憶。
5. **iOS 用ヒント** — 45 秒後に「share → add to home screen」案内（`beforeinstallprompt` 非対応の補完）。
6. **`manifest.json`** — id `/`, scope `/`, display_override `[standalone, minimal-ui, browser]`, dir `ltr`, **maskable icons 192/512**, screenshots, shortcuts (Shop), categories `art-and-design`。

#### Installability 確認（Lighthouse PWA installable 判定の必須要件）

| 要件 | 状態 |
|---|:---:|
| `manifest.json` リンク | ✅ |
| name / short_name | ✅ |
| icons 192 / 512（PNG, any） | ✅ |
| **maskable icon** | ✅（critical） |
| start_url | ✅ |
| display | ✅ standalone |
| HTTPS | ✅（本番） |
| Service Worker 登録 + fetch ハンドラ | ✅ |

→ **Lighthouse "Installable" 緑判定確実**。

### 6.2 残課題

**PWA-1. Background Sync IndexedDB 永続化**
- 現状 placeholder（`requestSync(tag)` API はあるが、SW 側 handler は no-op）。
- カート復元 / subscribe リトライの実装 → 60 日。

**PWA-2. 画像 cache に LRU 戦略**
- 現状 cache-first で容量無制限。
- 60 日: caches.delete で古いものを切る LRU。

**PWA-3. iOS の `beforeinstallprompt` 非対応**
- 仕様上対応不可。文字案内のみ。受容。

---

## 7. 30 日ロードマップ

### 7.1 必須タスク（司さん手動）

| # | タスク | 影響 | 工数 |
|---|---|---|---|
| H-01 | GA4 実 ID 取得 → `p3_test.html:59,64` の `G-XXXXXXXXXX` を置換 | SEO +0（既に 100）/ 計測体制完成 | 5 分 |
| H-02 | `bash scripts/optimize-images.sh` 実行（残 PNG → WebP/AVIF） | Performance +3〜5 | 1 分 |
| H-03 | Shopify ダッシュボードで Storefront API の **Allowed origins を `inryoku.com` に限定** | Best Practices 警告（CSP）軽減 + Security 実害低減 | 5 分 |
| H-04 | 本番ドメインで `npx lighthouse https://inryoku.com/p3_test.html --view` 実行（baseline 取得） | 推定値の実測検証 | 10 分 |
| H-05 | Search Console / Bing Webmaster Tools へ sitemap.xml 投入 | SEO クロール効率 | 10 分 |
| H-06 | `.env` のシークレット 4 つを発行元コンソールでローテーション（Groq / Shopify / Gelato / Admin） | Security Critical C-1 解決 | 30 分 |

### 7.2 開発タスク

| # | タスク | 担当 | 影響 | 工数 |
|---|---|---|---|---|
| D-01 | `<script src="vendor/three.min.js" defer>` 化 + `<body>` 末尾移動 | HTML 編集 | Performance +8〜12 | 30 分 |
| D-02 | `<script src="p3_code_for_claude.js" defer>` 化 + `renderPhase3()` 呼び出しを `DOMContentLoaded` 待ちに | HTML 編集 | Performance +10〜18 | 1 時間 |
| D-03 | `<meta viewport>` から `maximum-scale=1.0, user-scalable=no` 削除、`viewport-fit=cover` 追加 | HTML 編集 | A11y +7〜10 | 5 分 |
| D-04 | Inter ウェイト 5 → 2 に削減（`index.html` のみ）、Press Start 2P 重複削除 | HTML 編集 | Performance +3〜6 | 10 分 |
| D-05 | `index.html` の `cdn.jsdelivr.net/three` を `vendor/three.min.js` に統一 | HTML 編集 | Performance +2〜4 / Compat I-10 | 15 分 |
| D-06 | `enhance.js` のフォーカストラップが p3_test.html で **MutationObserver で正しく検出されるか実機検証** | 検証 | A11y 確実化 | 30 分 |
| D-07 | C-1 真の `<main>` / `<header>` / `<section>` 化（`p3_code_for_claude.js` 編集ロック解除待ち、Codex 調整） | JS 編集 | A11y +2〜3 | 1 時間 |
| D-08 | `keyboard navigation` / `axe-core` を Playwright 等で 1 度回す | テスト | 残課題発見 | 1 時間 |

### 7.3 期待スコア（30 日後）

| カテゴリ | Mobile (`p3_test.html`) | Desktop (`p3_test.html`) |
|---|---:|---:|
| Performance | 48 → **70** (+22) | 76 → **88** (+12) |
| Accessibility | 78 → **92** (+14) | 80 → **94** (+14) |
| Best Practices | 94 → **96** (+2) | 95 → **97** (+2) |
| SEO | 98 → **100** (+2) | 98 → **100** (+2) |

---

## 8. 60 日ロードマップ

### 8.1 残課題の解消

| # | タスク | 影響 | 工数 |
|---|---|---|---|
| 60-01 | Critical CSS インライン化（HTML head に `<style>` + `<link rel="preload" as="style" onload>`） | Perf +3〜6 | 2 時間 |
| 60-02 | 粒子削減（5000 → 3000）+ spawn 60s → 30s | Perf +2〜4（モバイル fps +15〜25%） | 1 時間（司さん哲学確認後） |
| 60-03 | constellation の spatial cell hash + 30Hz 化 | Perf +1〜3 | 30 分 |
| 60-04 | server.js キャッシュヘッダ（`?v=` 付き 1 年 immutable / HTML 5 分） | Perf +5〜10（反復測定） | 30 分 |
| 60-05 | logo sphere SphereGeometry 64×64 → 32×32 + DPR 1.0 化（Codex 調整） | Perf +1〜2 | 15 分 |
| 60-06 | hologram parallax の 30Hz + idle rAF 停止 | Perf +1〜3（モバイル省電力） | 30 分 |
| 60-07 | カルーセル style キャッシュ + 偶数フレーム化 | Perf +2〜4 | 1 時間 |
| 60-08 | cursor trail モバイル無効化 + bigBang particle box-shadow モバイル削除 | Perf +1〜3 | 30 分 |
| 60-09 | 真の `<button>` 化（HTML 直書き） — `cart-icon` / `mute-btn` / `contact-toggle` / `size-guide-toggle` / `footer-toggle` / カルーセルカード | A11y +2〜4 | 2 時間 |
| 60-10 | 商品画像に `width` / `height` 属性追加 | Best Practices +2〜3 | 30 分 |
| 60-11 | C-7 グリッチモード実機計測（3Hz 以上の閃光無いことを確認） | A11y 確認 | 30 分 |
| 60-12 | アニメーション一時停止 UI（pause button）追加 | A11y 95+ への足場 | 1 時間 |
| 60-13 | `<picture>` + `srcset` 複数解像度（400w/800w/1200w） | Best Practices +1〜2 | 1 時間 |
| 60-14 | `og:image` を WebP 別 URL で補強（PNG 維持） | SNS 体験向上 | 15 分 |
| 60-15 | CSP `'unsafe-inline'` の nonce 化（一部から開始） | Best Practices +2〜3 | 4 時間 |
| 60-16 | Web Vitals を `/api/vitals` で集計 → ダッシュボード化 | 計測体制 | 2 時間 |

### 8.2 期待スコア（60 日後）

| カテゴリ | Mobile (`p3_test.html`) | Desktop (`p3_test.html`) |
|---|---:|---:|
| Performance | 70 → **84** (+14) | 88 → **94** (+6) |
| Accessibility | 92 → **96** (+4) | 94 → **97** (+3) |
| Best Practices | 96 → **98** (+2) | 97 → **99** (+2) |
| SEO | 100 | 100 |

---

## 9. 90 日ロードマップ — 全軸 95+

### 9.1 タスク

| # | タスク | 影響 |
|---|---|---|
| 90-01 | Three.js を ESM tree-shake で 656KB → 250KB（rollup + 必要モジュールのみ） | Perf +6〜10 |
| 90-02 | `p3_code_for_claude.js` を module 化（5356 行を機能別に分割、ES module + dynamic import） | Perf +5〜8 / 保守性 |
| 90-03 | アニメーション一時停止 UI 実装 + 5 秒以上自動アニメ全 stoppable 化（WCAG 2.2.2 完全達成） | A11y +1〜2 |
| 90-04 | CSP nonce 化完了（`'unsafe-inline'` script 撤去） | Best Practices +1〜2 |
| 90-05 | `<picture>` + AVIF + 複数解像度を全画像に適用 | Perf +2〜3 / Best Practices +1 |
| 90-06 | hreflang `en` 実装（`/en/` 英語版ページ作成） | SEO 国際化 |
| 90-07 | AI 応答円環化（17 canon マッピング） | UX のみ、Lighthouse 影響なし |
| 90-08 | `data/subscribers.json` → SQLite 移行（race condition 解消） | Security 補強 |
| 90-09 | E2E（Playwright）導入 | 品質ゲート |
| 90-10 | Background Sync の IndexedDB 永続化 | PWA 完成度 |

### 9.2 期待スコア（90 日後）

| カテゴリ | Mobile (`p3_test.html`) | Desktop (`p3_test.html`) |
|---|---:|---:|
| Performance | 84 → **90** (+6) | 94 → **97** (+3) |
| Accessibility | 96 → **98** (+2) | 97 → **99** (+2) |
| Best Practices | 98 → **100** (+2) | 99 → **100** (+1) |
| SEO | 100 | 100 |

→ **全軸 95+ 達成**（Performance Mobile が最後まで天井、90 で打ち止め可能性あり、§10）。

---

## 10. リスク・トレードオフ

### 10.1 哲学的こだわりと Lighthouse スコアのトレードオフ

inryokü は単なる EC ではなく「**観測の儀式装置**」（`architecture-2026-04-28.md` 1.1）。Lighthouse スコアを最大化することがブランド毀損になる箇所がある。

#### T-1. 粒子宇宙（5000 粒子 / 60 秒 ease-in spawn）

- **Lighthouse 視点**: モバイル fps を支配し、Performance 90 への最後の壁。粒子 5000 → 2000 にすれば Mobile +5〜8 確実。
- **哲学視点**: 「最初は寂しく、後から鮮やか」という 60 秒の「間」が観測体験の核心。`p3-performance-audit-2026-04-28.md` #7 でも「ブランド意図と相反するので司確認推奨」と明記。
- **判断**: 粒子数 5000 維持、spawn 30 秒に短縮、constellation のみ 30Hz 化。これで Perf +3〜5、哲学はほぼ守られる。

#### T-2. P0/P1/P2 通しフロー（デスクトップ）

- **Lighthouse 視点**: `index.html` の Mobile スコア 25 は P0/P1/P2 のスクリプト sequential ロードが原因。これを削れば Mobile 70 級に。
- **哲学視点**: 「観測者を変態させる 4 段階のリチュアル」の核心。**絶対に削れない**（司さん絶対前提）。
- **判断**: モバイル UA は `p3_test.html` に飛ばす設計が **既に唯一の妥協**。受容。`index.html` Mobile スコアは「もし誰かが UA 偽装したら」のための参考値で、実害なし。

#### T-3. RGBCMY 純色のコントラスト

- **Lighthouse 視点**: `#0044FF` (青) vs `#0a0a0a` ≒ 2.6:1 で AA 通常文字 4.5:1 不達成。
- **哲学視点**: brand-name の各文字が RGBCMY を背負うことで「白 / 黒に見える色には全色が宿る」を体現。**色を変えるとブランドが死ぬ**。
- **判断**: brand-name は装飾扱いで `aria-hidden="true"` (`enhance.js` A11) 化済 + sr-only h1 で「inryokü」テキストを SR に提供。**Lighthouse axe-core はこの構成で通る**。

#### T-4. `user-scalable=no`

- **Lighthouse 視点**: a11y −7〜10 点、A-R1 で 30 日対策必須。
- **哲学視点**: 「没入演出」のためのピンチズーム抑止。WCAG 1.4.4 違反だが司さん意図あり。
- **判断**: **30 日で削除推奨**（A11y 90 達成の鍵 + アクセシビリティが哲学に勝る場面）。司さん最終判断。

#### T-5. cursor trail / bigBang particle / hologram parallax

- **Lighthouse 視点**: モバイルで box-shadow 30 枚 + style.setProperty 60Hz は実質負荷。
- **哲学視点**: 「観測者の存在を粒子で可視化する」装置。
- **判断**: モバイルで cursor trail 無効化 + box-shadow 削除。デスクトップでは維持。哲学は損なわない。

#### T-6. 60 秒 spawn

- 哲学的に重い。**30 秒 + 初期 20% 表示** で「最初から少し見える、徐々に満ちる」に変更すれば、暗闇 5 秒の演出は失われるが Perf 改善。司確認案件。

### 10.2 妥協ポイント（推奨ライン）

| 軸 | 推奨上限 | 推奨下限 | 哲学衝突 |
|---|---:|---:|---|
| Performance Mobile (`p3_test.html`) | 90 | **85**（粒子削減なし） | T-1 |
| Performance Desktop | 97 | 94 | なし |
| Accessibility | 98 | **95** | T-3, T-4 |
| Best Practices | 100 | 98 | なし |
| SEO | 100 | 100 | なし |

→ **「全軸 95+」は技術的に到達可能だが、Performance Mobile を 90 に押し上げるには T-1 / T-6 の妥協が必要**。

### 10.3 妥協しない場合の打ち止めスコア

- Performance Mobile: **85**
- Performance Desktop: **94**
- Accessibility: 96（T-4 妥協なら 92）
- Best Practices: 100
- SEO: 100

これでも市場上は **「Lighthouse 全軸 90+ 級ブランドサイト」** として通用する。司さんの判断次第。

---

## 11. 実測コマンド・運用手順

### 11.1 ローカルでの Lighthouse 実行

```bash
# 1. dev server 起動
cd /Users/10ta210/Desktop/inryoku_hp
PORT=3000 node server.js &

# 2. Lighthouse CLI（npm 不要 / npx）
npx lighthouse http://localhost:3000/p3_test.html \
  --view \
  --form-factor=mobile \
  --throttling-method=simulate \
  --output=html \
  --output-path=./reports/p3_test_mobile_$(date +%Y%m%d).html

npx lighthouse http://localhost:3000/p3_test.html \
  --view \
  --form-factor=desktop \
  --throttling-method=simulate \
  --output=html \
  --output-path=./reports/p3_test_desktop_$(date +%Y%m%d).html

npx lighthouse http://localhost:3000/ \
  --view \
  --form-factor=desktop \
  --output=html \
  --output-path=./reports/index_desktop_$(date +%Y%m%d).html
```

### 11.2 本番ドメインでの Lighthouse 実行

```bash
npx lighthouse https://inryoku.com/p3_test.html --view --form-factor=mobile
npx lighthouse https://inryoku.com/p3_test.html --view --form-factor=desktop
npx lighthouse https://inryoku.com/ --view --form-factor=desktop
```

### 11.3 PageSpeed Insights（Google 実測 + CrUX 実体験）

ブラウザで:
- https://pagespeed.web.dev/analysis?url=https%3A%2F%2Finryoku.com%2Fp3_test.html
- https://pagespeed.web.dev/analysis?url=https%3A%2F%2Finryoku.com%2F

**CrUX (Chrome User Experience Report)** が `inryoku.com` に蓄積されると実ユーザーの Core Web Vitals が見える（28 日ウィンドウ）。最低 1000 セッションが必要。

### 11.4 Web Vitals 実測（既実装）

`perf-observer.js` がブラウザコンソールに出力。本番 1 週間運用後:

```bash
# DevTools Console で
window.__inryokuVitals
# → { LCP: 2480, FCP: 940, CLS: 0.02, INP: 180, TTFB: 95, ... }
```

`flushSummary()` の `navigator.sendBeacon('/api/vitals', ...)` を有効化し、サーバ側で集計エンドポイントを実装すれば常時計測可能（60 日タスク 60-16）。

### 11.5 軸別 audit ツール

| 軸 | ツール |
|---|---|
| Performance | Lighthouse / WebPageTest / Chrome DevTools Performance / `perf-observer.js` |
| Accessibility | Lighthouse / axe DevTools / WAVE / VoiceOver / TalkBack 実機通し操作 |
| Best Practices | Lighthouse / Chrome DevTools Issues / Mozilla Observatory（`https://observatory.mozilla.org/?host=inryoku.com`） |
| SEO | Lighthouse / Google Rich Results Test / Schema.org Validator / Search Console |
| PWA | Lighthouse PWA report / Chrome DevTools Application / `pwabuilder.com` |

### 11.6 推定値検証順序（司さん作業）

1. 本ドキュメントの推定値を `npx lighthouse` で実測 → ギャップを記録
2. ギャップが ±10 以内なら本ドキュメント基盤で OK
3. ギャップが大きい項目は §11.5 の個別ツールで原因特定
4. 30 日タスク（§7）を 1 つずつ適用 → 都度 Lighthouse 再測定
5. 60 日 / 90 日タスクへ進む

### 11.7 CI への組込（任意 / 60 日）

`.github/workflows/lighthouse.yml`:

```yaml
name: Lighthouse CI
on: [pull_request]
jobs:
  lhci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: node server.js & sleep 3
      - run: npx -y @lhci/cli@0.13.x autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

`lighthouserc.json`:
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/p3_test.html"],
      "settings": { "preset": "mobile" },
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.7 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 0.95 }]
      }
    }
  }
}
```

これで PR ごとに Lighthouse スコアが検証され、回帰防止。

---

## Appendix A. 推定値の数値根拠まとめ

### A.1 TBT 推定の計算

`p3_test.html` モバイル（Slow 4G + CPU 4× throttle）:

```
three.min.js:           656KB / (2.5MB/s × 0.25 [4× CPU]) = ダウンロード 0.26s
                        + parse 1KB/ms × CPU 4× = 656ms parse → 主スレッド占有
p3_code_for_claude.js:  261KB / 2.5MB/s = 0.10s ダウンロード
                        + parse 261ms × CPU 4× = ~1040ms parse
                        + initParticleUniverse 同期実行（5000 粒子 BufferGeo + シェーダコンパイル）
                        ≒ 80–180ms × 4× CPU = 320–720ms

合計同期スレッドブロック: 656 + 1040 + 320–720 = 2016–2416ms
TBT は (50ms 超過の Long Tasks 合計) なので全部 Long Task として計上
→ TBT ≒ 600–1400ms（並列化 / preload で部分的に隠蔽されるため下限あり）
```

### A.2 LCP 推定の計算

```
TTFB:           80ms (CDN 同等)
HTML parse:     ~100ms
preload kick:   FCP 候補画像（hoodie webp 28KB）は 28KB / 2.5MB/s = 11ms 取得
DOM 挿入:       renderPhase3() 完了 = three.min.js + p3_code parse 完了後
                ≒ 1.4–2.6s（CPU throttle 後）
画像 decode:    ~50ms
LCP paint:      ≒ 2.4–3.6s
```

### A.3 enhance.js A11y カバー率

`enhance-layer-2026-04-28.md` 6 章で「Critical 8 件中 7 件 = 87.5%」と明記。残り 1 件（C-6）は `critical-fixes-2026-04-28.md` で `p3_styles.css` 側修正済 → **実質 100% Critical カバー**（HTML 直書きの真の `<button>` 化は除く）。

### A.4 SEO 100 の根拠

`seo-metadata-2026-04-28.md` 5 章で全 14 audit 項目について Pass を確認済。残る `image-alt`, `link-text` は body 側依存で、**enhance.js / critical-fixes 適用後は通過**。

---

## Appendix B. 30 日タスク クイック参照（コピペ用）

司さん実機作業:
- [ ] H-01 GA4 ID 投入
- [ ] H-02 `bash scripts/optimize-images.sh`
- [ ] H-03 Shopify Storefront Allowed origins 設定
- [ ] H-04 baseline Lighthouse 取得
- [ ] H-05 Search Console / Bing に sitemap 投入
- [ ] H-06 シークレット 4 つローテーション

開発（HTML 編集 / 司さん or Codex）:
- [ ] D-01 three.min.js defer + body 末尾移動
- [ ] D-02 p3_code_for_claude.js defer + DOMContentLoaded 待ち
- [ ] D-03 viewport `user-scalable=no` 削除 + `viewport-fit=cover`
- [ ] D-04 Inter ウェイト削減
- [ ] D-05 index.html Three.js ローカル化
- [ ] D-06 enhance.js モーダル監視動作確認
- [ ] D-07 真の `<main>` / `<header>` 化
- [ ] D-08 axe-core / Playwright 1 周

→ これだけで:
- Performance Mobile **48 → 70**
- Accessibility **78 → 92**
- Best Practices **94 → 96**
- SEO **98 → 100**

---

## Appendix C. 100 達成は可能か

| 軸 | 100 達成 |
|---|---|
| **SEO** | **可能**（既に視界、GA4 ID 投入のみ） |
| **Best Practices** | **可能**（90 日 / nonce 化 + srcset 完備）|
| **Accessibility** | **困難**（T-3 / T-4 / 装飾アニメ多用 / brand 純色）→ 96–98 が現実上限 |
| **Performance Mobile** | **不可能**（T-1 粒子宇宙 / TBT 限界）→ 85–90 が現実上限 |
| **Performance Desktop** | **可能**（90 日 / Three.js tree-shake + 全施策） |

→ 「**Mobile 全軸 90+**」が 90 日のリアルゴール、「**Desktop 全軸 95+**」も同期間で射程内。

---

## Appendix D. 参照ドキュメント往復索引

| 本ドキュメントの参照 | 元ドキュメント | 該当章 |
|---|---|---|
| Performance ボトルネック詳細 | `p3-performance-audit-2026-04-28.md` | 全章 |
| Performance 修正実装 | `perf-fixes-2026-04-28.md` | §1〜§9 |
| Accessibility WCAG 不達成 | `accessibility-audit-2026-04-28.md` | §2〜§5 |
| Accessibility CSS 修正 | `critical-fixes-2026-04-28.md` | §1 |
| Accessibility JS 後付け | `enhance-layer-2026-04-28.md` | §2 |
| Security 修正 | `security-fixes-2026-04-28.md` | F1〜F13 |
| Security 残課題 | `security-review-2026-04-28.md` | C-1〜M-5 |
| SEO 構造化データ | `seo-metadata-2026-04-28.md` | §2〜§5 |
| Browser 互換 | `browser-compatibility-matrix-2026-04-28.md` | I-1〜I-20 |
| PWA / SW | `pwa-sw-2026-04-28.md` | 全章 |
| 全体俯瞰 | `architecture-2026-04-28.md` | §1〜§13 |
| Codex 担当領域 | `codex-review-2026-04-28.md` | §2〜§4 |

---

## End of roadmap

**結論**:

1. **SEO は実質完成**（98–100、GA4 ID で 100 確実）
2. **Best Practices は 30 日で 95+ 安定**（既施策 F1〜F13 が決定的）
3. **Accessibility は 30 日で 90+ 達成可能**（`user-scalable=no` 撤廃 + viewport-fit=cover + enhance.js モーダル動作確認）
4. **Performance Mobile が最大の壁**。30 日で 70、60 日で 84、90 日で 90。**90 を超えるには T-1（粒子削減）/ T-6（spawn 短縮）の哲学的妥協が必要**
5. **PWA は installable 緑判定確実**（既施策で完成度高）
6. **`index.html` Mobile スコアは UA 振り分けで実害なし**。`p3_test.html` 一本で評価する運用で問題ない

司さんの哲学を 1 ピクセルも妥協せず Lighthouse を最大化するなら:
- **Mobile 全軸 90 / Desktop 全軸 95** が 90 日でのゴール
- これは市場で「最高水準のブランド EC サイト」として通用するライン
- **観測者中心主義**を貫いた上での到達点

—— RGB = Black. CMY = White. You = Rainbow.
—— 50% を 101% に。Lighthouse スコアもまた、観測の対価である。

*End of lighthouse-roadmap-2026-04-28.md*
