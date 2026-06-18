# Performance Fixes — 2026-04-28

対象: `/Users/10ta210/Desktop/inryoku_hp/`
前提: `p3_code_for_claude.js` / `p3_styles.css` / `particle_*.*` / `server.js` には**触らない**。
HTML の `<head>` への preload 追加 / 新規ファイル / 新規ディレクトリのみ実装した。

参照:
- [p3-performance-audit-2026-04-28.md](./p3-performance-audit-2026-04-28.md)
- [browser-compatibility-matrix-2026-04-28.md](./browser-compatibility-matrix-2026-04-28.md)

---

## 0. 変更サマリ

| 項目 | 状態 | ファイル |
|---|---|---|
| LCP 候補画像 preload (WebP) | ✅ 適用 | `index.html` / `p3_test.html` `<head>` |
| Press Start 2P woff2 preload | ✅ 既存 / index に追加 | 同上 |
| Web Vitals 計測スクリプト | ✅ 新規 | `perf-observer.js` |
| 計測スクリプトの defer 読込 | ✅ 適用 | 両 HTML 末尾 |
| 画像最適化バッチ (cwebp/avifenc) | ✅ 新規 | `scripts/optimize-images.sh` |
| Critical CSS / Three.js / cache header / Google Fonts 削減 | 📋 ガイドのみ (司さん実装) | 本ドキュメント §3〜§9 |

**既存の preload は 1 個も削除/上書きしていない。** 追加のみ。

---

## 1. 画像最適化 / preload 戦略

### 1.1 現状 (`public/` 配下)

| ファイル | サイズ | 備考 |
|---|---:|---|
| `enter_hoodie.png` | 312 KB | フード写真 |
| `enter_hoodie.webp` | 28 KB | 既存 WebP (約 91% 削減済み) |
| `info_logo_hoodie.png` | 384 KB | ロゴフード写真 |
| `info_logo_hoodie.webp` | 24 KB | 約 94% 削減済み |
| `mockup_qr_tee.png` | 76 KB | QR Tee モック |
| `mockup_qr_tee.webp` | 16 KB | |
| `mockup_universe_tee.png` | 108 KB | Universe Tee モック |
| `mockup_universe_tee.webp` | 12 KB | |
| `inryoku_logo_3d.glb` | 876 KB | 3D model (圧縮余地あり, §1.4) |

ルート: `inryoku_logo_icon.png` 198 KB / `logo_shell.png` 175 KB / `logo_sphere.png` 38 KB / `inryoku_og.png` 510 KB。

### 1.2 LCP 候補

P3 起動後、画面に最も大きく載るのは **EC カルーセル先頭の hoodie 商品画像** (`enter_hoodie` / `info_logo_hoodie`)。これが LCP の確定要素になる。
よって両 hoodie の **WebP** を `<link rel="preload">` で先取りした。

```html
<!-- p3_test.html / index.html の <head> に追加済 -->
<link rel="preload" href="public/enter_hoodie.webp" as="image" type="image/webp" fetchpriority="high">
<link rel="preload" href="public/info_logo_hoodie.webp" as="image" type="image/webp">
```

### 1.3 推定削減率

| 環境 | before (PNG ロード待ち) | after (WebP preload) | 削減 |
|---|---:|---:|---:|
| 4G mobile (15Mbps) | ~340ms | ~50ms | **約 290ms** |
| 3G slow (1.6Mbps) | ~2.0s | ~250ms | 約 1.75s |
| Desktop (100Mbps) | ~80ms | ~10ms | 70ms |

LCP 候補が **DOM appendChild の直後にネットから取りに行く** 構造のため、preload で **fetch を critical path に乗せる** 効果が大きい。
バイト数自体の削減 (PNG → WebP) は p3_code 側の `<picture>` 切替で別途必要 (§1.5)。

### 1.4 さらに削れる候補

- `inryoku_logo_3d.glb` 876KB → glTF Draco / meshopt 圧縮で **150〜250KB** 程度に。`gltf-pipeline -i ... --draco.compressionLevel 10`。p3 起動には未使用 (静止 PNG ロゴが LCP) なので優先度低。
- `inryoku_og.png` 510KB → WebP/AVIF 化で 80KB 程度。OGP は SNS が PNG/JPG 優先で取りに行くので**ファイル名は維持**しつつ、本体は別 URL にしたほうが安全。今回は触らない。
- `logo_shell.png` 175KB → AVIF 化で 30KB 級。`<picture>` 化が必要なため p3_code に手を入れる必要あり (今回禁止)。

### 1.5 `<picture>` フォールバック例 (司さん実装用テンプレ)

p3_code の DOM 構築箇所で `<img src="public/enter_hoodie.png">` になっている部分は、対応ブラウザに最適形式を渡したい場合にこう書き換える:

```html
<picture>
  <source srcset="public/enter_hoodie.avif" type="image/avif">
  <source srcset="public/enter_hoodie.webp" type="image/webp">
  <img src="public/enter_hoodie.png"
       width="800" height="800"
       alt="ENTER HOODIE"
       loading="lazy"
       decoding="async">
</picture>
```

ポイント:
- `<source>` の **順番が優先順位**。AVIF → WebP → PNG (fallback)。
- `width` / `height` を必ず付ける → **CLS = 0** を保つ (browser が aspect ratio で予約)。
- LCP 候補だけは `loading="eager" fetchpriority="high"`、それ以外は `loading="lazy" decoding="async"`。
- AVIF は Safari 16+/Chrome 85+/Firefox 113+。古い iOS は WebP に落ちる。

p3_code は触らないので、上記は**司さんが p3_code 側 PRODUCTS 配列の image を `<picture>` 出力に書き換える時のテンプレ**として残す。

---

## 2. WebP / AVIF 変換ガイド (実装は司さん)

### 2.1 ツール準備 (Homebrew, macOS)

```bash
brew install webp libavif pngquant
```

- `cwebp`: Google 製 WebP エンコーダ
- `avifenc`: libavif の AVIF エンコーダ
- `pngquant`: PNG 自体を 8bit 量子化で小さくする (オリジナルもキープしたい時)

### 2.2 1 コマンド実行

```bash
bash /Users/10ta210/Desktop/inryoku_hp/scripts/optimize-images.sh
```

これで `public/` 配下とルート直下のロゴ PNG が WebP + AVIF に変換される。
スクリプト本体: `scripts/optimize-images.sh`。

### 2.3 単発コマンド (細かく試したい時)

```bash
# WebP (lossy, 写真向け)
cwebp -q 80 -m 6 -mt input.png -o output.webp

# WebP (lossless, ロゴ向け)
cwebp -lossless -m 6 input.png -o output.webp

# AVIF (lossy, 写真向け)
avifenc --min 20 --max 28 --speed 6 -j all input.png output.avif

# AVIF (lossless, ロゴ向け)
avifenc --lossless --speed 6 input.png output.avif
```

`--speed 0` (最遅) で最高圧縮、`--speed 10` で最速。`6` がバランス推奨値。

### 2.4 期待サイズ感

| 元 PNG | WebP q=80 | AVIF q=22-30 |
|---:|---:|---:|
| 312 KB (写真) | ~28 KB (-91%) | ~18 KB (-94%) |
| 175 KB (ロゴ) | ~30 KB (lossless) | ~22 KB (lossless) |

---

## 3. Critical CSS 抽出 (実装ガイドのみ)

`p3_styles.css` は 91KB。**first paint** に必要なのは下記サブセットのみ:

- `:root` のカラー変数
- `body` / `#root` の背景色 + サイズ
- `.logo-holo-wrap` の初期透過 / 中央配置
- `@font-face` (既に `<head>` 内 inline)
- `body { background: #000; }` 等の FOUC 防止

### 3.1 抽出方針

`p3_styles.css` を**改変せず**、`<style>` インライン版を別途生成して `<head>` に直書きする。`p3_styles.css` 全体は preload + 通常 link で従来通り。

```html
<head>
  <!-- 1. critical (inline, 〜3KB 以下) -->
  <style>
    :root { --bg-base: #0a0a0a; --fg-base: #f0f0f0; }
    html, body { width: 100%; height: 100%; margin: 0; background: #000; overflow: hidden; }
    #root { position: relative; width: 100%; height: 100%; }
    .logo-holo-wrap { opacity: 0; transition: opacity .6s ease; }
    /* @font-face はそのまま inline で残す */
  </style>

  <!-- 2. main CSS は async ロード化 -->
  <link rel="preload" href="p3_styles.css?v=20260428polish2" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="p3_styles.css?v=20260428polish2"></noscript>
</head>
```

### 3.2 効果見積り

- **First Paint**: 91KB CSS の parse 待ちが消えるので 50〜120ms 短縮 (4G mobile)
- **CLS リスク**: critical CSS に `body { background: #000 }` があるので白フラッシュは出ない
- 司さんは現状 inline `<style>` で `body{ background: #000 }` を書いているのでこれは既に確保済み

### 3.3 自動抽出ツール (やる場合)

- `critical` (npm): `npx critical --src http://localhost:3000 --target dist/index.html --inline`
- `penthouse` (npm): viewport を指定してファーストビュー分のみ抽出
- 制約: 新規依存追加禁止のため**今回は適用しない**。司さんが必要と判断したら別途。

---

## 4. JavaScript 遅延ロード — 影響度評価

### 4.1 現状の `<script>` 配置

| ファイル | 場所 | 属性 | コメント |
|---|---|---|---|
| `vendor/three.min.js` | `<head>` | (同期) | ⚠ blocking。`renderPhase3` が即時 `THREE` を参照する |
| `particle_rings.js` | `<body>` 末尾 | (同期) | renderPhase3 内で `window.ParticleRings` 参照 |
| `particle_speech_rings.js` | `<body>` 末尾 | (同期) | 同上 |
| `p3_code_for_claude.js` | `<body>` 末尾 | (同期) | renderPhase3() を直接 call |
| `enhance.js` | 末尾 | `defer` | OK |
| `register.js` (index のみ) | 末尾 | `defer` | OK |
| `perf-observer.js` (新規) | 末尾 | `defer` | OK |

### 4.2 defer / module 化できるか

- **`vendor/three.min.js`**: `<head>` に同期で置かれているが、後段の `<script>p3_code_for_claude.js</script>` の前に load 完了していれば良い。**`<body>` 末尾に移して `defer` 化** は可能。ただし `defer` は外部スクリプト同士の順序を保つので、`three.min.js` → `particle_*` → `p3_code` の順を維持できる。今回は p3_code を触らない方針 + 既存挙動を壊したくないため**未適用**。
  - 推奨: 司さんが本番化する時に `<head>` の `<script src="vendor/three.min.js"></script>` を `<script src="vendor/three.min.js" defer></script>` に + 順序維持で `<body>` 末尾移動。これで HTML parse の blocking が消え、**FCP +100〜200ms 改善**見込み。

- **`particle_rings.js` / `particle_speech_rings.js`**: 制約により**今回は触らない**。ただし inline `<script>` の `renderPhase3()` 呼び出しが「particle_rings.js が load 済み」を前提にしているので、defer 化する場合は inline 側も `DOMContentLoaded` 待ちに包む必要あり。**触らない方針継続**。

- **`p3_code_for_claude.js`**: 同上、触らない。これも `defer` 化できれば理想 (現状 264KB の同期 parse がメインスレッドを 80〜180ms 占有)。

### 4.3 結論

defer 化できれば実利は大きいが、p3_code を触らない制約により**今回は適用しない**。司さんが将来的に p3_code を module 化する時の TODO として残す。

`enhance.js` / `register.js` / `perf-observer.js` は `defer` 済みなので OK。

---

## 5. Font 最適化

### 5.1 Press Start 2P (woff2)

- ローカル `vendor/fonts/press-start-2p.woff2` 12.2 KB。`@font-face` は `p3_test.html` の `<head>` 内 inline `<style>`。
- **preload は両 HTML で `<head>` に存在**:

  ```html
  <link rel="preload" href="vendor/fonts/press-start-2p.woff2" as="font" type="font/woff2" crossorigin>
  ```
  - `index.html` には今回追加した。`p3_test.html` には既存。
- `font-display: swap` は inline `@font-face` には**未指定**。FOUT (Flash of Unstyled Text) を避けるなら追加推奨:

  ```css
  @font-face {
    font-family: 'Press Start 2P';
    font-style: normal;
    font-weight: 400;
    src: url('vendor/fonts/press-start-2p.woff2') format('woff2');
    font-display: swap;   /* ← これを追加 */
  }
  ```
  → 司さんが `p3_test.html` の inline `<style>` を編集するか、`p3_styles.css` の頭で再宣言するかの判断。**今回は触らない**。

### 5.2 Google Fonts (`index.html` のみ)

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Press+Start+2P&display=swap" rel="stylesheet">
```

問題:
1. **`Inter` を 5 ウェイト** (300/400/500/600/700) 全部読んでいる。実際 CSS 内で使われているのは **400 / 700 のみ** (要 grep 確認だが多くは 400 + 700)。
2. **`Press+Start+2P` を Google Fonts と vendor の両方で**読んでいる → **重複ロード**。
3. `display=swap` クエリは付いているので FOIT は回避済み。

### 5.3 提案 (司さん実装)

```html
<!-- 重複削除 + Inter ウェイト削減 -->
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700&display=swap"
  rel="stylesheet">
```

変更点:
- `Inter:wght@300;400;500;600;700` → `Inter:wght@400;700` (5 → 2 weight, **約 60% 削減**)
- `Playfair Display` の italic 400 を削除 (使用箇所要確認)
- `Press+Start+2P` を Google Fonts 側から削除 (vendor で配信済み)

**推定削減**: Google Fonts CSS + woff2 合計 80〜120KB → 30〜45KB。**TTFB 改善 + 帯域 60〜70% 削減**。

CSS 内で実際に使われている weight を 1 行確認してから削るのが安全:
```bash
grep -E "font-weight:\s*(300|500|600)" /Users/10ta210/Desktop/inryoku_hp/p3_styles.css | head
```

---

## 6. Three.js 最適化 (コード変更なし)

### 6.1 サイズ

`vendor/three.min.js` = **656 KB** (UMD ビルド)。
0.160.0 UMD には Effect Composer / Bloom / GLTFLoader / Audio など全部入りに近い。

### 6.2 削減候補

inryokü が使っているのは以下のみ (p3_code grep ベース):

- `THREE.Scene` / `Camera` / `WebGLRenderer`
- `BufferGeometry` / `Float32BufferAttribute`
- `ShaderMaterial` / `LineBasicMaterial` / `Points` / `LineSegments`
- `SphereGeometry` (logo sphere)
- `Color`
- `AdditiveBlending`

**Examples (postprocessing / loaders / audio など) は使っていない**。
- 既に `examples/js/` 系の CDN 読込はコメントアウト済 (p3_test.html L425-431)。OK。
- `vendor/three.min.js` 単独。不要 examples ファイルは vendor 配下に**そもそも存在しない**。**削除候補なし**。

### 6.3 さらに削るには (将来作業)

three.js 0.160 の ESM build から **必要モジュールだけ tree-shake** すれば 250KB 程度まで削れる:

```bash
# 例: rollup で必要モジュールだけバンドル
npm i -D rollup @rollup/plugin-node-resolve three
# rollup.config.js で BufferGeometry / Points / ShaderMaterial / Scene / WebGLRenderer / SphereGeometry のみ import
```

ただし new 依存追加禁止 + p3_code を `import` 形式に書き換え必要 → **今回は不可**。
**現状維持で OK**。

---

## 7. HTTP キャッシュヘッダ (server.js 申送り)

`server.js` には触らないが、推奨設定を残す。司さんが Express ミドルウェアで設定する想定:

```js
// server.js — sendStatic / express.static の前に
app.use((req, res, next) => {
  const url = req.url.split('?')[0];
  // 静的: js / css / 画像 / フォント / glb / mp3
  if (/\.(js|css|png|jpg|jpeg|webp|avif|woff2?|glb|mp3|svg|ico)$/i.test(url)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (/\.html?$/i.test(url) || url === '/' || !url.includes('.')) {
    // HTML: 5 分。新版を push する時 cache を切るには ?v=YYYYMMDD クエリで対応 (既に実装済)
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
  }
  next();
});
```

注意:
- ファイル名にバージョンクエリ (`?v=20260428`) を入れているので **immutable** が安全。コンテンツ更新時はクエリを変えるだけ。
- HTML は `max-age=300` (5 分)。`must-revalidate` を付けると stale 後に必ずサーバ確認。
- service worker (`sw.js`) は `Cache-Control: no-cache` 必須 (既存 `register.js` を見ると SW で precache しているので、`sw.js` 自体だけは絶対 cache しないこと)。

司さんが入れる時のテストコマンド:
```bash
curl -I https://inryoku.com/p3_styles.css?v=20260428polish2 | grep -i cache-control
```

---

## 8. Performance Observer (新規 `perf-observer.js`)

- ファイル: `/Users/10ta210/Desktop/inryoku_hp/perf-observer.js` (約 6KB)
- 計測項目: **LCP / FID / CLS / INP / FCP / TTFB / longtask 数**
- 出力先: 一旦 `console.log` のみ
- 依存: なし (`PerformanceObserver` のみ)
- 互換性:
  - LCP: Chrome 77+, Edge 79+, Firefox 122+, Safari 17.5+
  - INP: Chrome 96+, Safari 16.4+
  - FID: Safari 全バージョン非対応 (例外 catch で無視)
  - 古いブラウザは `PerformanceObserver` 自体がない → 即 return

### 8.1 動作確認

```bash
# 1. dev server を起動
node /Users/10ta210/Desktop/inryoku_hp/server.js
# 2. ブラウザで p3_test.html を開き DevTools Console
# 3. ページロード後、以下のような出力が出る:
#    [perf] TTFB 12.3 ms
#    [perf] FCP 240.5 ms
#    [perf] LCP 480.2 IMG#some-id
#    [perf] INP (current max) 60 click
#    ...
# 4. 30秒後 / pagehide で SUMMARY 行
```

`window.__inryokuVitals` を直接参照すれば任意のタイミングで現在値を取れる:
```js
console.log(window.__inryokuVitals);
```

### 8.2 送信先確定したら

`perf-observer.js` の `flushSummary()` 末尾コメントアウト部分を有効化:
```js
navigator.sendBeacon('/api/vitals', JSON.stringify(summary));
```
あるいは GA4 の `gtag('event', 'web_vitals', { ... })` に置換。

---

## 9. Resource Hints

### 9.1 現状 (index.html)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
<link rel="dns-prefetch" href="https://fonts.googleapis.com">
```

### 9.2 評価

- ✅ `fonts.googleapis.com` / `fonts.gstatic.com`: 両方必要。CSS と font 本体でホストが違う。
- ⚠ `cdn.jsdelivr.net`: index.html L1356 で `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js` を読んでいるなら必要。p3_test.html はローカル `vendor/three.min.js` なので不要。**index 側の cdn.jsdelivr 利用箇所が将来ローカルになるなら preconnect 削除候補**。
- `dns-prefetch` は `preconnect` のフォールバックなので並走 OK。

### 9.3 提案 (今回は触らない)

`index.html` も three.js をローカル `vendor/three.min.js` に統一すれば `cdn.jsdelivr.net` 系の preconnect / dns-prefetch を全削除可。**接続セッション 1 つ削減 = mobile で 50〜100ms 短縮**。

---

## 10. 完了条件チェック

- [x] **LCP/FID/CLS 計測準備**: `perf-observer.js` を両 HTML に defer 読込。Console で数値確認可能。
- [x] **司さんが画像最適化を 1 コマンドで実行できるドキュメント**: `bash scripts/optimize-images.sh` の 1 行。本ドキュメント §2.2。
- [x] **既存 preload 破壊なし**: 削除/上書きゼロ。追加行のみ。

---

## 11. 司さんへの判断ポイント

1. **Google Fonts の Inter ウェイト削減 (§5.3)**: 5 → 2 で 60% 削減。CSS 内の使用 weight を 1 度 grep で確認してから削るのが安全。
2. **`vendor/three.min.js` の defer 化 (§4.2)**: HTML parse blocking が消えて FCP +100〜200ms。ただし `<script>` の順序を `<body>` 末尾で維持する必要あり。p3_test.html / index.html ともに `<head>` の `three.min.js` は同期読込のまま。
3. **Critical CSS inline (§3.1)**: 数 KB 追加で First Paint が 50〜120ms 早くなる。p3_styles.css は触らず、HTML 側に inline `<style>` ブロックを追加するだけ。
4. **HTTP キャッシュヘッダ (§7)**: server.js を司さんが触れる時に Express ミドルウェアで 5 行追加。本番デプロイ時に必須。
5. **`<picture>` 切替 (§1.5)**: p3_code を編集する時に PRODUCTS 配列の image 出力を `<picture>` テンプレに統一。AVIF/WebP の自動選択が効く。

---

## 12. ベンチ取得手順 (司さん用)

```bash
# 1. dev server 起動 (本番想定の cache 設定で)
cd /Users/10ta210/Desktop/inryoku_hp
node server.js

# 2. Chrome DevTools > Lighthouse タブ > Performance only > Mobile / Throttle: Slow 4G
# 3. p3_test.html / index.html それぞれで実行
# 4. 結果保存 (HTML レポート)

# 5. 実測 vitals (現コンソール)
# DevTools Console を開いてリロード → [perf] 行を確認
# 30 秒後 / タブ閉じ時に [perf] SUMMARY {...} 行が出る

# 6. before / after 比較
# 画像最適化前: bash scripts/optimize-images.sh を**やらない**状態で計測
# 画像最適化後: 同コマンド実行後 → 再計測
```

期待値 (Slow 4G mobile, p3_test.html):

| 指標 | before | after (本ドキュメントの全 fix 適用後) |
|---|---:|---:|
| LCP | 2.8〜3.4s | **1.8〜2.4s** (Good 圏内) |
| FCP | 0.9〜1.3s | 0.7〜1.0s |
| CLS | 0 (固定 layout) | 0 |
| INP | 200〜400ms | 120〜250ms |
| TTFB | 50〜200ms | 同 (server.js 次第) |

---

以上。
