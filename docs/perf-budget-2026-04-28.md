# Performance budget — 2026-04-28

inryokü のバンドサイズ閾値を `perf-budget.json` で定義し、`scripts/perf-budget.mjs` が CI で違反検出する。本書はその運用と各 budget の根拠をまとめる。

## なぜ budget が必要か

- 現状 Mobile Lighthouse Perf 推定 48（`docs/lighthouse-roadmap-2026-04-28.md`）。
- 体重増加（バンドル肥大）は LCP / TBT に直接効く。回帰を機械的に止める仕組みがないと「気付かないうちに重くなる」。
- インフラ変更や依存追加なしでも、小さなコード追加が積み重なって致命傷になる。
- `perf-budget.json` を司さんが直接編集できるようにし、調整権限を運用側へ寄せる。

## 構成

| 場所 | 役割 |
|---|---|
| `perf-budget.json` | 閾値の定義（人が編集する唯一のファイル） |
| `scripts/perf-budget.mjs` | 計測・比較・レポート出力 |
| `scripts/perf-gate.sh` | CI 用ラッパー。JSON / Markdown / PR コメント md を生成 |
| `tests/perf-budget.test.mjs` | スキーマ妥当性 + 現状ファイルが budget 内に収まる契約 |
| `.github/workflows/test.yml > perf-budget` | CI ジョブ |

## 閾値の根拠

実測（2026-04-26 時点）と、その上にどれだけ余裕を持たせるか、を組み合わせて決めた。

| アセット | 実測 | 閾値 | 余裕 | 根拠 |
|---|---:|---:|---:|---|
| `vendor/three.min.js` | ~656 KB | 700 KB | +44 KB | 第三者ライブラリ、CDN化検討中。次バージョンで多少肥大しても通す。 |
| `p3_code_for_claude.js` | ~261 KB | 300 KB | +39 KB | 主要バンドル。商品追加でじわじわ増える想定。 |
| `p3_styles.css` | ~89 KB | 100 KB | +11 KB | デザイン変更で増えやすいので近めに張る。 |
| `particle_rings.js` | ~10 KB | 30 KB | +20 KB | 余裕大、悪化を早期検知する用。 |
| `particle_speech_rings.js` | ~19 KB | 25 KB | +6 KB | 近い。実装拡張は別ファイルへ。 |
| `enhance.js` | ~38 KB | 50 KB | +12 KB | runtime polyfill が増えがちなので余裕。 |
| その他小物 | 各 3〜18 KB | 8〜25 KB | — | 各責務にフィットする小さい上限。 |
| `manifest.json` | ~1.6 KB | 4 KB | — | 急増は設定ミスのサイン。 |
| `sitemap.xml` | ~10 KB | 50 KB | — | 商品増加で線形に増える。 |
| **JS 合計（three / p3_code 除く）** | ~158 KB | 200 KB | +42 KB | 「補助系の総量」を抑えるネット。 |
| **CSS 合計** | ~95 KB | 150 KB | +55 KB | テーマ追加に備える。 |
| **`public/` 合計** | ~1.76 MB | 2 MB | +0.24 MB | ヒーロー画像追加 1〜2 枚分の余裕。 |

## 違反時の対処

CI が `perf-budget` ジョブで fail したら：

1. `npm run perf:budget` をローカルで再現。
2. レポート（`perf-report/perf-budget.md`）の `## Violations` を確認。
3. 対処方針：
   - **削れるか**: 死んだコード・重複セレクタ・未使用 polyfill を削除（既存 `docs/perf-fixes-2026-04-28.md` を参照）。
   - **分割できるか**: 大きくなった機能を遅延 import / 別ファイルへ。
   - **本当に必要なら**: `perf-budget.json` の対象 `max` を上げる。**ただし PR で根拠を書くこと**（実測値・LCP 影響）。
4. `tests/perf-budget.test.mjs` の「all current production files are within their per-file budget」も同時に通す必要がある。

## 司さんへの推奨運用

- **PR ごと**: GitHub Actions の `perf-budget` ジョブが緑か確認。レポート artifact (`perf-budget-report`) を眺めて gzip 後の転送量推定をチェック。
- **月次**: 実測サイズ / 閾値の比率 (`pct`) が 80% を超えた行をリスト。次の余裕削減ターゲットにする。
- **大きな依存追加前**: `npm run perf:budget --markdown > /tmp/before.md` → 追加 → 再実行 → diff で影響を可視化。
- **閾値を緩める PR**: 緊急時のみ。レビューで根拠（LCP 推定 / 代替検討）を必ず添える。

## 圧縮後サイズの扱い

`perf-budget.mjs` は `node:zlib` で gzip / brotli 後サイズも算出する。閾値は今のところ raw サイズに対してのみ適用しているが、レポートには両方出る。実環境では Cloudflare/Nginx が brotli 圧縮するので、**ユーザー転送量 ≈ brotli サイズ** と考えてよい。

## LCP / TBT 影響の推定

`perf-budget.json > lcpTbtImpact` の係数（slow 3G ≈ 50KB/s, 1KB ≈ 1.2ms TBT）で各ファイルの `transferEstimate` と `lcpTbtEstimate` を計算する。これは絶対値ではなく **回帰検知用の単位系**。新規 50 KB の JS を入れたら +60ms TBT 相当、と感覚を合わせるためのもの。

## 関連ドキュメント

- `docs/lighthouse-roadmap-2026-04-28.md` — Lighthouse 改善計画
- `docs/perf-fixes-2026-04-28.md` — 即効性のある最適化メニュー
- `docs/architecture-2026-04-28.md` — 全体アーキテクチャ
