# 画像最適化ガイド — inryokü (2026-04-28)

LCP / 転送量改善のための画像最適化方針・手順・ロードマップ。

スクリプト 1 本で `public/` + ルートのブランド画像を WebP/AVIF 化する。HTML 修正は段階的に司さん側で行う。

---

## 1. 現状インベントリ (2026-04-28 時点)

| 場所 | ファイル | 用途 | サイズ | WebP | AVIF | LCP候補 |
|------|----------|------|--------|------|------|---------|
| `public/` | `enter_hoodie.png` | ENTER hoodie (1st card) | 318 KB | ✅ 24 KB | ❌ | ★ メインLCP |
| `public/` | `info_logo_hoodie.png` | LOGO hoodie | 393 KB | ✅ 23 KB | ❌ | — |
| `public/` | `mockup_qr_tee.png` | QR tee | 75 KB | ✅ 14 KB | ❌ | — |
| `public/` | `mockup_universe_tee.png` | Universe tee | 109 KB | ✅ 10 KB | ❌ | — |
| ルート | `inryoku_logo_icon.png` | PWA icon / favicon | 198 KB | ❌ | ❌ | △ ヘッダ |
| ルート | `inryoku_og.png` | OGP / SNS シェア | 510 KB | ❌ | ❌ | — (外部用) |
| ルート | `logo_sphere.png` | ロゴ・球 | 37 KB | ❌ | ❌ | — |
| ルート | `logo_shell.png` | ロゴ・殻 | 175 KB | ❌ | ❌ | — |
| `public/` | `inryoku_logo_3d.glb` | 3Dロゴモデル | 856 KB | — | — | (別カテゴリ) |

**合計**: PNG 約 **1.8 MB** / WebP（既存4つ）約 **72 KB**。残り 4 PNG が未変換。

---

## 2. 削減効果見積もり

`scripts/optimize-images.sh` 適用後の予測：

| カテゴリ | 元 PNG 合計 | 予測 WebP | 予測 AVIF | 削減率 |
|----------|-------------|-----------|-----------|--------|
| 写真系 (`public/*.png`) | 895 KB | 73 KB *(既存)* | ~55 KB | **−92% / −94%** |
| ロゴ系 lossless | 410 KB | ~110 KB | ~70 KB | **−73% / −83%** |
| OG (`inryoku_og.png`) | 510 KB | ~80 KB | ~55 KB | **−84% / −89%** |
| **合計** | **1.81 MB** | **~263 KB** | **~180 KB** | **~−85% / −90%** |

LCP 候補 `enter_hoodie` は既に WebP 化済 (24 KB)。AVIF を追加すれば追加で 20–30% 削減。

---

## 3. 司さん向け実行手順 (1 コマンド)

### 初回: ツールインストール

```bash
brew install webp libavif pngquant
```

### 全画像を最適化

```bash
cd ~/Desktop/inryoku_hp
bash scripts/optimize-images.sh
```

差分のみ変換するので、毎回呼んでもコストは低い（既存 WebP/AVIF が PNG より新しければスキップ）。

### 強制再生成

```bash
bash scripts/optimize-images.sh --force
```

### 何が変わるか確認だけ

```bash
bash scripts/optimize-images.sh --dry-run
```

### 状況診断（変換せず読むだけ）

```bash
bash scripts/check-images.sh
# 不足/古い WebP/AVIF と、HTML 参照切れがあれば一覧する
bash scripts/check-images.sh --strict   # CI 用、問題があれば exit 1
```

### テスト

```bash
npm test
# tests/image-inventory.test.mjs を含めて 全 PASS が期待値
```

---

## 4. `<picture>` タグ移行ロードマップ

HTML 側の段階移行手順。司さんが手で書き換える。`p3_code_for_claude.js` の動的生成箇所は触らない（別タスク）。

### Phase 1 — LCP 画像のみ先行 (必須)

`index.html` の最初のカルーセル要素 `enter_hoodie`：

```html
<!-- BEFORE -->
<img src="public/enter_hoodie.webp" alt="ENTER hoodie" loading="eager">

<!-- AFTER -->
<picture>
  <source srcset="public/enter_hoodie.avif" type="image/avif">
  <source srcset="public/enter_hoodie.webp" type="image/webp">
  <img src="public/enter_hoodie.png" alt="ENTER hoodie"
       loading="eager" fetchpriority="high"
       width="1080" height="1350">
</picture>
```

ポイント:
- LCP 画像には `loading="eager" fetchpriority="high"` を付ける（lazy 禁止）
- `width` / `height` 明示で CLS 0 を維持
- フォールバックを PNG にしておけば古い Safari でも壊れない

### Phase 2 — 残り商品画像

`info_logo_hoodie` / `mockup_qr_tee` / `mockup_universe_tee` を同じパターンで `<picture>` 化。これらは `loading="lazy"`（カルーセル先頭以外）。

### Phase 3 — ロゴ / OG

`<head>` の Open Graph タグ：

```html
<meta property="og:image" content="https://inryoku.com/inryoku_og.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<!-- secure_url を WebP にしても多くのクローラは type ごとに解釈する。
     PNG をプライマリにしておく方が SNS 互換性が高い。 -->
```

OG は **PNG のままが安全**（Twitter / Slack / Discord / LINE すべて WebP/AVIF を読まないクローラがある）。WebP/AVIF はサイト内表示用としてのみ生成・配信する。

manifest.json の icons は PWA 仕様上 PNG のままで OK。WebP icon は対応端末が限定的なので無理に追加しない。

### Phase 4 — 動的生成箇所 (あとで)

`p3_code_for_claude.js` 内の `<img>` 動的生成は、`<picture>` を吐く helper を別タスクで導入予定。本タスク範囲外。

---

## 5. スクリプト仕様サマリ

### `scripts/optimize-images.sh`

- **対象**: `public/*.png` + ルートの `inryoku_logo_icon.png` / `inryoku_og.png` / `logo_sphere.png` / `logo_shell.png`
- **除外**: `card_preview_check.png`（dev only）/ `node_modules/` / `tests/visual/baselines`
- **並列**: `xargs -P $(nproc)` でコア数並列
- **lossless 自動判定**: ファイル名に `logo` / `icon` / `shell` / `sphere` を含むもの
- **lossy**: `cwebp -q 80` / `avifenc --min 20 --max 28`
- **OG 専用**: `inryoku_og.png` は `q=85` （文字混じりなので少し高め）
- **skip-if-fresh**: WebP/AVIF が PNG より `-nt` ならスキップ
- **元 PNG は絶対に削除しない**
- **統計出力**: 変換数 / 元合計 / 出力合計 / 削減率

### `scripts/check-images.sh`

- 各 PNG → WebP / AVIF の対応有無
- 古い (PNG が更新されたが派生が古い) ものを `stale` 検出
- `*.html` / `manifest.json` / `sitemap.xml` から抽出した画像参照が物理存在するか
- `--strict` で CI 用（問題があれば exit 1）

### `tests/image-inventory.test.mjs`

- public/ + ルートの主要画像が存在するか
- LCP 候補 `enter_hoodie.webp` が存在するか
- manifest / sitemap の参照が壊れていないか
- スクリプトが `bash -n` を通るか
- public/ に想定外の拡張子が混入していないか

既存 477 tests と独立して動作。

---

## 6. 既知の落とし穴

1. **AVIF + Safari 15 以下**: AVIF は Safari 16 から。`<picture>` で WebP fallback 必須。
2. **lossless の AVIF はサイズが大きくなることがある**: ロゴで AVIF が WebP より重ければ手で削除する。
3. **`brew install libavif` の avifenc バージョン**: 0.11+ 推奨。古いと `-j all` オプション無し → スクリプトはエラー時 PNG を残すので致命傷にはならない。
4. **CI 環境で cwebp/avifenc が無い場合**: `optimize-images.sh` は警告して該当形式だけスキップする（exit code 0）。`check-images.sh` は変換しないので常に通る。
5. **`card_preview_check.png` (689 KB)** はリポジトリにあるがリリースに不要。`/Users/10ta210/Desktop/inryoku_hp/.gitignore` 化 or 削除を別タスクで検討。

---

## 7. 関連ドキュメント

- [perf-fixes-2026-04-28.md](./perf-fixes-2026-04-28.md) — LCP 改善計画全体
- [lighthouse-roadmap-2026-04-28.md](./lighthouse-roadmap-2026-04-28.md) — Lighthouse スコア改善
- [seo-metadata-2026-04-28.md](./seo-metadata-2026-04-28.md) — OG / sitemap 仕様
