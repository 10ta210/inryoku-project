# Cache Buster (?v=) 整合性監査 — 2026-04-28

## 目的
`<link>` / `<script>` の `?v=...` クエリ（キャッシュバスター）が HTML ファイル間でズレており、ユーザー側で同一アセットの古い版がキャッシュされたまま新版が来ない／逆に不要な再ダウンロードが発生するリスクを排除する。

## 対象 HTML
- `index.html`
- `p3_test.html`
- `particle_rings_demo.html`
- `particle_glyphs_demo.html`
- `offline.html`（参照なし）
- `legal.html` / `privacy.html` / `returns.html` / `size-guide.html` / `success.html`（参照なし）

## 修正前テーブル

| アセット | index.html | p3_test.html | particle_rings_demo.html | particle_glyphs_demo.html |
|---|---|---|---|---|
| `p3_styles.css` | `20260428polish2` | `20260428polish2` | — | — |
| `p3_code_for_claude.js` | `20260427rings1` | `20260427rings1` | — | — |
| `particle_rings.css` | `6` | `6` | **`7`** | — |
| `particle_rings.js` | `2` | `2` | `2` | — |
| `particle_speech_rings.js` | `4` | `4` | — | — |
| `particle_glyphs.css` | — | — | — | `2` |
| `particle_glyphs.js` | — | — | — | `2` |
| `error-shield.js` | `20260428` | `20260428` | — | — |
| `copy-fix-runtime.js` | `20260428` | `20260428` | — | — |
| `enhance.css` | `20260428` | `20260428` | — | — |
| `enhance.js` | `20260428` | `20260428` | — | — |
| `register.js` | `20260428` | `20260428` | — | — |
| `perf-observer.js` | `20260428` | `20260428` | — | — |
| `i18n.css` | `20260428` | `20260428` | — | — |
| `i18n.js` | `20260428` | `20260428` | — | — |

### 検出された不整合
1. **`particle_rings.css`** — `index.html` / `p3_test.html` は `?v=6`、`particle_rings_demo.html` は `?v=7`。同一ファイルなのに別バージョンを名乗っている。
2. **混在する命名規則** — `?v=20260428polish2` / `?v=20260427rings1` / `?v=6` / `?v=2` 等、日付型と連番型が同居しており保守性が低い。

`legal.html` / `privacy.html` / `returns.html` / `size-guide.html` / `success.html` / `offline.html` は `?v=` 参照なし（リスクなし）。

## 修正後テーブル
全 HTML 内の全 `?v=...` を **`?v=20260428`** に統一。

| アセット | index.html | p3_test.html | particle_rings_demo.html | particle_glyphs_demo.html |
|---|---|---|---|---|
| `p3_styles.css` | `20260428` | `20260428` | — | — |
| `p3_code_for_claude.js` | `20260428` | `20260428` | — | — |
| `particle_rings.css` | `20260428` | `20260428` | `20260428` | — |
| `particle_rings.js` | `20260428` | `20260428` | `20260428` | — |
| `particle_speech_rings.js` | `20260428` | `20260428` | — | — |
| `particle_glyphs.css` | — | — | — | `20260428` |
| `particle_glyphs.js` | — | — | — | `20260428` |
| `error-shield.js` / `copy-fix-runtime.js` / `enhance.css` / `enhance.js` / `register.js` / `perf-observer.js` / `i18n.css` / `i18n.js` | `20260428` | `20260428` | — | — |

検証コマンド:
```bash
for f in index.html p3_test.html particle_rings_demo.html particle_glyphs_demo.html offline.html legal.html privacy.html returns.html size-guide.html success.html; do
  grep -nE '\?v=' "$f" | grep -v '20260428'
done
# 出力なし = 全 HTML が ?v=20260428 に統一済み
```

## 採用ポリシー
- **形式**: `?v=YYYYMMDD`（8 桁の日付）。連番（`?v=6`）や接尾辞付き（`?v=20260428polish2`）は禁止。
- **粒度**: その日にデプロイした全アセットを **同一の日付値** で揃える。リリース日 = `?v=` 値。
- **対象**: HTML から参照される自前の `.js` / `.css`（外部 CDN・サードパーティ除く）。
- **適用範囲**: 同一アセットへの参照は **全 HTML で必ず同じ `?v=`**。1 ファイルでも食い違ったらバグ。

## 司さん向け運用ルール

### リリース時にやること
1. その日のデプロイで触った／触っていない関わらず、**全 HTML の `?v=` を一括で当日日付に更新**する。
   ```bash
   cd /Users/10ta210/Desktop/inryoku_hp
   TODAY=$(date +%Y%m%d)
   for f in index.html p3_test.html particle_rings_demo.html particle_glyphs_demo.html; do
     perl -i -pe 's/\?v=[A-Za-z0-9._-]+/?v='"$TODAY"'/g' "$f"
   done
   ```
2. 検証:
   ```bash
   grep -rnE '\?v=' *.html | grep -v "$TODAY" && echo "NG: 不一致あり" || echo "OK"
   ```

### やってはいけないこと
- 一部のファイルだけ `?v=` を進める（→必ず全 HTML 揃える）
- `?v=20260428polish2` のような接尾辞をつける（→ 同日に再デプロイなら `?v=20260429` にする）
- 連番（`?v=6` → `?v=7`）に戻す（→日付型に統一）

### 新しい HTML / アセットを追加するとき
- 新規 HTML を作ったら、その時点の最新 `?v=YYYYMMDD` を必ず付ける
- 新規アセットを `<link>` / `<script>` で参照するときも同様

## 影響範囲
- 値の差し替えのみ。ファイル本体・パス・属性は無変更。既存機能への影響なし。
- ユーザー側ブラウザは初回アクセス時に統一済み URL で 1 回だけ再取得 → 以後はキャッシュヒット。
