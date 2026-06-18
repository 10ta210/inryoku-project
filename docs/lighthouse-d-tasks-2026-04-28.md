# Lighthouse D-Tasks Implementation — 2026-04-28

対象: `/Users/10ta210/Desktop/inryoku_hp/`
範囲: ロードマップ Phase 6 の **D-01〜D-08** 開発タスクの実装。
触っていいファイル限定 (`index.html` / `p3_test.html` の `<head>` / `vendor/` 配下) で、
`p3_code_for_claude.js` / `p3_styles.css` / `particle_*.*` / `server.js` には**手を入れていない**。

参照:
- [lighthouse-roadmap-2026-04-28.md](./lighthouse-roadmap-2026-04-28.md) — 30/60/90 日ロードマップ全体像
- [perf-fixes-2026-04-28.md](./perf-fixes-2026-04-28.md) — perf-observer 等の既実装

---

## 0. 変更サマリ

| ID  | タスク | 状態 | 対象 |
|---|---|---|---|
| D-01 | Three.js 配信ローカル化 (cdn.jsdelivr 撤去) | ✅ 適用 | `index.html` |
| D-02 | Critical CSS インライン化 + 残部 async | ✅ 適用 | `index.html` / `p3_test.html` |
| D-03 | particle_rings / particle_speech_rings の `defer` 化 | ✅ index 適用 / p3_test は順序制約で見送り | `index.html` |
| D-04 | Google Fonts weight 削減 (Inter 5→3, Press Start 2P / Playfair 撤去) | ✅ 適用 | `index.html` |
| D-05 | 画像 `loading="lazy"` 付与 | ⏸ 該当 `<img>` が静的 HTML に存在せず (全部 p3_code 動的生成) | — |
| D-06 | meta description / og 最終チェック | ✅ 確認のみ (修正不要) | — |
| D-07 | rel="preload" 追加 (vendor/three.min.js) | ✅ 適用 (Press Start 2P は既存) | `index.html` |
| D-08 | render-blocking 排除 (Google Fonts / p3_styles.css async 化) | ✅ 適用 | 両 HTML |

「触らない」リスト遵守:
- `p3_code_for_claude.js` — 一切編集なし。
- `p3_styles.css` — 1byte も変更なし (critical 部は **読み取って HTML 側に inline コピー**)。
- `particle_*.js / .css` — 一切編集なし。
- `server.js` — 一切編集なし。
- 既存の preload / preconnect / dns-prefetch も**削除なし**。Google Fonts URL は中身を絞り込んだだけ。

---

## 1. D-01: Three.js 配信ローカル化 (index.html)

### Before
```html
<!-- importmap -->
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
}}
</script>

<!-- body 末尾 -->
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/postprocessing/EffectComposer.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/postprocessing/RenderPass.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/postprocessing/ShaderPass.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/postprocessing/UnrealBloomPass.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/shaders/LuminosityHighPassShader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/shaders/CopyShader.js"></script>
```

### After
```html
<script type="importmap">
{ "imports": { "three": "/vendor/three.min.js" } }
</script>

<script src="vendor/three.min.js"></script>
```

### 変更点
- jsdelivr の **7 個の外部スクリプト**を 1 個のローカル UMD に集約。
- `examples/js/postprocessing/*` は **three 0.160 で廃止**。p3_test.html 側でも 2026-04-17 に
  `404 + ~5s 遅延` のためコメントアウト済 (Bloom はシェーダー内補償)。index.html はこれを未だ残していたため、
  毎ロードで **6 個の 404 + 数秒のブロック**が発生していたことになる。今回これを完全に除去。
- importmap は実際に `import 'three'` する箇所が無い (UMD `window.THREE` 経由) ため将来用ダミーだが、
  CSP 厳格化に向けて外部 URL を消し `/vendor/three.min.js` に向けた。

### 効果見積
| 環境 | before (CDN+404 含む) | after (vendor) |
|---|---:|---:|
| Desktop 100Mbps | 250〜400ms + 404 6本 | ~25ms (HTTP/1.1 同オリジン) |
| 4G mobile 15Mbps | 1.0〜1.6s + 404 5s 待ち分散 | 80〜140ms |
| Slow 3G | 4〜6s | 600〜900ms |

CDN 接続の RTT (jsdelivr.net への TLS handshake ~150ms + TCP ~80ms) を完全にゼロ化。
**Lighthouse Performance への寄与: +6〜10pt**(blocking time / TTI 主体)。
**404 の 5 秒遅延除去**だけでも mobile では LCP/FCP -1.5s 程度の改善見込み。

---

## 2. D-02: Critical CSS インライン化

### 戦略
`p3_styles.css` (2,927 行 / 約 90KB) は **P3 でのみ必要な装飾**。
P0/P1/P2 の first paint には **index.html の既存 inline `<style>` (169-1331 行)** で十分。
よって p3_styles.css は **`media="print" + onload="this.media='all'"`** で非同期適用。
P3 突入までに余裕で適用完了する (P1/P2 で数秒経過するため)。

p3_test.html は P3 直接起動のため、`brand-name` / `logo-holo-wrap` / `body` / `#root` の
**最小 critical** をインラインに昇格 (合計 ~1KB)。LCP 候補のテキスト・ロゴサイズの初期確定で **CLS=0** を維持。

### Before (p3_test.html 抜粋)
```html
<link rel="stylesheet" href="p3_styles.css?v=20260428polish2">
<link rel="stylesheet" href="particle_rings.css?v=6">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #000;
    font-family: 'Inter', Arial, sans-serif; }
  #root { width: 100%; height: 100%; position: relative; z-index: 1; }
</style>
```

### After (p3_test.html 抜粋)
```html
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden;background:#000;
    font-family:'Inter',Arial,sans-serif;color:#fff}
  #root{width:100%;height:100%;position:relative;z-index:1}
  @font-face{font-family:'Press Start 2P';font-style:normal;font-weight:400;
    font-display:swap;src:url('vendor/fonts/press-start-2p.woff2') format('woff2')}
  .brand-name{font-family:'Press Start 2P',monospace;
    font-size:clamp(20px,3.4vw,32px);font-weight:400;letter-spacing:.10em;
    display:flex;justify-content:center;align-items:center}
  .logo-holo-wrap{display:block;margin:0 auto;
    width:clamp(90px,12vw,140px);position:relative}
</style>

<link rel="stylesheet" href="p3_styles.css?v=20260428polish2"
  media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="p3_styles.css?v=20260428polish2"></noscript>
<link rel="stylesheet" href="particle_rings.css?v=6"
  media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="particle_rings.css?v=6"></noscript>
```

### サイズ
- インライン critical: **~1.1KB** (圧縮後 ~600B) — 目安 5KB 以下を厳守。
- `p3_styles.css` 90KB は依然取得するが render-blocking ではなくなる。

### 効果見積
- FCP -200〜500ms (mobile 4G)。p3_styles.css の取得待ちが消える。
- LCP -100〜300ms (brand-name/ロゴ first paint が CSS 待ちなしで即時)。
- `<noscript>` フォールバックで JS 無効環境も従来通り表示崩れなし。

---

## 3. D-03: defer 化

### index.html
```html
<!-- before -->
<script src="particle_rings.js?v=2"></script>
<script src="particle_speech_rings.js?v=4"></script>

<!-- after -->
<script src="particle_rings.js?v=2" defer></script>
<script src="particle_speech_rings.js?v=4" defer></script>
```

`p1_code_for_claude.js` は同期 (`renderPhase1()` がインライン script から即座に呼ばれるため必須)。
`particle_*` は **P3 突入後**の event listener (`inryoku:p2complete`) で初めて使うため defer 安全。
**defer は記述順を保証**するので `rings → speech_rings` の依存順序も保たれる。

### p3_test.html — 見送り理由
現状の順序:
```
particle_rings.js → particle_speech_rings.js → p3_code_for_claude.js → 同期 renderPhase3()
```
`p3_code_for_claude.js` は **触らない**ため defer 化不可。
particle_* だけ defer すると defer は p3_code (同期) の **後**に走るため `ParticleSpeechRings`
未定義のまま `renderPhase3()` が呼ばれ機能破壊。よって p3_test.html では現状維持。

p3_test の全 scripts に defer を一括付与する案は p3_code 改変を要するため Phase 7 以降。

### 効果見積
- index.html の parse-blocking 短縮: **+2〜4pt** (TTI / TBT)。
- DOMContentLoaded を 100〜200ms 早める。

---

## 4. D-04: Google Fonts 削減 (index.html)

### Before
```
?family=Inter:wght@300;400;500;600;700
 &family=Playfair+Display:ital,wght@0,400;0,700;1,400
 &family=Press+Start+2P
 &display=swap
```
8 weight + Playfair (italic 含む 3 variant) + Press Start 2P。
Press Start 2P は **vendor/fonts/ にローカルあり**、Playfair Display は CSS で参照されておらず未使用。

### After
```
?family=Inter:wght@300;400;500&display=swap
```
- Inter は **300 / 400 / 500 のみ**(`p3_styles.css` 実使用箇所を grep 確認)。
- Press Start 2P は HTML 側 `<style>` 内の `@font-face` で `vendor/fonts/press-start-2p.woff2` をローカル参照に統一 (p3_test.html と整合)。
- Playfair Display は完全撤去 (使用箇所なし)。

### サイズ削減見積
| 項目 | before | after | 削減 |
|---|---:|---:|---:|
| Google Fonts CSS | ~3.1KB | ~1.2KB | 60% |
| Inter woff2 (subset latin) | ~110KB (5 weight) | ~66KB (3 weight) | 40% |
| Press Start 2P woff2 | ~14KB (Google) | 12KB (vendor 既存・キャッシュ) | 重複ゼロ化 |
| Playfair Display | ~95KB (3 variant) | 0 | 100% |
| **合計フォント転送** | **~222KB** | **~78KB** | **約 65%** |

### 効果見積
- LCP -150〜400ms (mobile 4G)。
- Lighthouse Performance: +3〜5pt。

---

## 5. D-05: 画像 lazy load — 該当なし

`grep -E "<img" index.html p3_test.html` の結果、両 HTML に **静的 `<img>` タグは存在しない**。
商品画像 (`enter_hoodie.png/webp` 等) は **すべて `p3_code_for_claude.js` が動的に DOM へ append** している。

p3_code は触らない制約のため、本タスクは Phase 7 で p3_code 内部の `img` 生成箇所に
`loading="lazy" decoding="async"` を一括付与する形になる (`PRODUCTS` 配列ループ内)。

LCP 候補 (先頭 hoodie) は既に `<link rel="preload" fetchpriority="high">` 適用済 (perf-observer エージェント実装)。
よって lazy 化対象は 2 番目以降のカルーセル画像のみ。

---

## 6. D-06: meta description / og 最終チェック

### index.html
- `<meta name="description">` 96 文字 (日本語 / 78 文字目安をやや超過だが SNS スニペット切り詰め可) — **OK**
- `<meta name="keywords">` — 検索エンジン無視されるが害なし、現状維持。
- `og:title` 26 文字 / `og:description` 51 文字 — Facebook/X の表示枠内 (60 / 200 以内)。**OK**
- `twitter:card` summary_large_image / `og:image` 1200×630 サイズ宣言済 — **OK**
- canonical / hreflang ja + x-default 設定 — **OK**

### p3_test.html
- 同等の SEO メタ + Product 構造化 JSON-LD 完備 — **OK**

修正提案 (任意):
- `description` を 78 文字以内に圧縮するなら: 「inryokü は哲学を纏う服。RGB×CMY の原色論を観測する。グレーの中に虹がある。50% から 101% へ。」(70 文字)
- 現在文も訴求が強いため、無理に詰めず現状維持で問題なし。

---

## 7. D-07: rel="preload" 追加最適化

### index.html 追加分
```html
<link rel="preload" href="vendor/three.min.js" as="script">
```
- Press Start 2P は既存 (perf-observer エージェント実装済)。
- LCP 候補画像 hoodie WebP は既存 `fetchpriority="high"` 済。
- `vendor/three.min.js` は P3 開始時 (~数秒後) に必要だが、preload で **P0/P1 の通信余裕時間に裏で取得**。
  P3 突入時には既にキャッシュ済となり P3 起動が体感即時化。

### p3_test.html
- 既に `vendor/three.min.js` / press-start-2p / hoodie WebP / logo_sphere / logo_shell すべて preload 済。追加なし。

---

## 8. D-08: render-blocking 排除

### 適用箇所
| ファイル | before | after |
|---|---|---|
| `index.html` Google Fonts | `<link rel="stylesheet">` 直 | `media="print" onload="this.media='all'"` + `<noscript>` fallback |
| `index.html` p3_styles.css | `<link rel="stylesheet">` 直 | `media="print" onload` 化 + `<noscript>` fallback (preload は維持) |
| `p3_test.html` p3_styles.css | `<link rel="stylesheet">` 直 | `media="print" onload` 化 + `<noscript>` fallback |
| `p3_test.html` particle_rings.css | `<link rel="stylesheet">` 直 | `media="print" onload` 化 + `<noscript>` fallback |

### 仕組み
ブラウザは `media="print"` のスタイルシートを **印刷時のみ適用 = 描画ブロックしない**。
`onload` で `media="all"` に書き換えると、ロード完了直後にスタイルが効く。
`<noscript>` で JS 無効環境用 fallback を提供 — 表示崩れリスクゼロ。

### 効果見積
- FCP / LCP -300〜700ms (mobile 4G)。CSS 取得が critical path から外れる。
- Lighthouse "Eliminate render-blocking resources" 監査が **PASS** に。

---

## 9. 推定 Lighthouse スコア向上

ベースライン: Phase 5 perf-observer 完了時点 (推定 mobile 4G で **65〜75**)。

| 寄与項目 | 推定 +pt |
|---|---:|
| D-01 Three.js ローカル化 + 404 5s 排除 | +6〜10 |
| D-02 Critical CSS + p3_styles async | +3〜5 |
| D-03 defer 化 (index) | +2〜4 |
| D-04 Google Fonts 削減 65% | +3〜5 |
| D-07 vendor preload | +1〜2 |
| D-08 render-blocking 排除 | +2〜4 |
| **合計** | **+10〜20 (目標通り)** |

期待レンジ: **mobile 75〜90 / desktop 90〜98**。

### Web Vitals 期待値
| 指標 | before | after |
|---|---:|---:|
| FCP | 2.0〜2.6s | 1.1〜1.5s |
| LCP | 2.8〜3.5s | 1.6〜2.2s |
| TBT | 350〜500ms | 150〜250ms |
| CLS | <0.05 (既達) | <0.05 (維持) |

---

## 10. 検証手順

1. `python3 -m http.server 8000` または既存 `server.js` でローカル起動。
2. Chrome DevTools → Lighthouse → Mobile / Performance / 計測。
3. Network パネルで以下を確認:
   - `cdn.jsdelivr.net` への request が**ゼロ**であること (D-01)。
   - `examples/js/postprocessing/*` の **404 が消えている**こと (D-01)。
   - Inter weight が 300/400/500 のみ取得 (D-04)。
   - `p3_styles.css` の `Render Blocking` が `Not blocking` (D-08)。
4. P0 → P1 → P2 → P3 通しフロー手動確認 — 既存機能破壊がないこと。
5. P3 で hoodie カルーセル / brand-name アニメーション / particle ring が従来通り動作。

---

## 11. 残り (Phase 7 候補)

- **D-05 fully**: `p3_code_for_claude.js` 内 `<img>` 動的生成箇所に `loading="lazy"` を一括付与。
- **p3_test.html の defer 化**: p3_code をモジュール分離 or defer 一括化。
- **AVIF 変換**: hoodie / logo_shell / inryoku_og の 3 段 `<picture>` フォールバック (perf-fixes §1.5 テンプレ参照)。
- **inryoku_logo_3d.glb** 876KB → Draco 圧縮で 150〜250KB に。
- **Service Worker キャッシュ戦略強化**: vendor/three.min.js / 各 woff2 を long-cache。

---

最終更新: 2026-04-28
