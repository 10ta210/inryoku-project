# Visual Regression Tests — 円環粒子言語の構造的固定

**Date**: 2026-04-28
**Scope**: `particle_rings.js` / `particle_speech_rings.js` / `particle_rings.css`

## なぜ必要か

円環粒子言語は inryokü の「見えないものの可視化」の核。
小さなレンダリング差分（tick 座標が 0.01 ずれる、register opacity が 0.72 → 0.70 になる）は
肉眼では気付きにくいが、文字としての一貫性を破壊する。

VRT (Visual Regression Test) は、SVG 出力を構造的 JSON に焼き、commit 済み baseline と
一致しないと CI を落とすことで、**意図しない変更を不可能にする** 仕組み。

## 仕組み

### 1. ディレクトリ

```
tests/
├── canon_visual.test.mjs          # 既存・軽量 sanity test (responsibilities: 構造の最低限の指紋)
└── visual/                         # 新設・厳密 VRT
    ├── _helpers.mjs                # serializeDeep / assertBaseline
    ├── canon_visual_full.test.mjs  # 17 canon × deep snapshot
    ├── speech_lifecycle.test.mjs   # 発話 lifecycle (idle → utter → fade → remove)
    ├── halo_geometry.test.mjs      # tickPos() の数学的検証
    ├── css_token_consistency.test.mjs  # CSS変数 ⇔ JS 定数 の整合
    ├── baseline/                   # ✓ commit 対象 — 既知の正解
    └── snapshots/                  # 各実行の current snapshot — diff 用 (gitignore 推奨)
```

### 2. シリアライザ (`serializeDeep`)

SVG 要素を再帰的に JSON 化:

- `tag` (lowercased)
- `classes` (sorted array)
- `attrs` — 全属性を sort して捕捉、数値属性は **小数点 2 桁** に丸める
  (`cx, cy, r, x1, y1, x2, y2, width, height, ...`)
- `style` — inline CSS 変数も全部捕捉、sort 済み key
- `children` — 再帰

→ 同じ入力に対して毎回バイト一致する JSON が出る。

### 3. baseline 比較 (`assertBaseline`)

```
初回実行 (baseline 不在) → 自動生成して pass
2回目以降                 → 既存 baseline と diff、ミスマッチで fail (詳細出力)
VISUAL_UPDATE=1           → 強制上書き (意図的更新)
```

## 実行コマンド

```bash
# 全テスト (既存 + visual)
npm test

# visual のみ
npm run test:visual

# baseline 強制更新 (確認プロンプト付き)
bash scripts/update-visual-baseline.sh

# baseline 強制更新 (プロンプトなし — npm script 直叩き)
npm run test:visual:update
```

## baseline 更新フロー (意図的変更時)

1. production code (`particle_*.js` / `particle_*.css`) を変更
2. `npm run test:visual` → fail (期待される)
3. fail 出力を読み、変更が**意図通り**か確認
4. `bash scripts/update-visual-baseline.sh` で baseline 更新
5. `git diff tests/visual/baseline/` で差分を目視確認
6. commit: `tests/visual/baseline/*.json` も同じ commit に含める
7. PR レビュー時、レビュアが baseline diff を読む — これが視覚的変更の **公式記録** になる

## CI 統合

### GitHub Actions 例

```yaml
- name: Visual Regression
  run: npm run test:visual
  # 失敗時、tests/visual/snapshots/ を artifact upload して
  # 開発者が baseline と比較できるようにする
- name: Upload diff artifacts
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: visual-snapshots
    path: tests/visual/snapshots/
```

### PR レビュー必須化

`tests/visual/baseline/` を [CODEOWNERS](https://docs.github.com/codeowners) で
特定レビュア (デザイン責任者 = 司さん) 必須にすると、視覚仕様の変更が
無断 merge されない。

```
# .github/CODEOWNERS
/tests/visual/baseline/  @tsukasa
```

## 既存 `tests/canon_visual.test.mjs` との責務分離

| 観点         | 既存 `canon_visual.test.mjs`              | 新規 `tests/visual/`                            |
| ------------ | ----------------------------------------- | ----------------------------------------------- |
| 粒度         | 軽量 sanity (要素数・色種別のみ)         | 全属性 deep snapshot (座標・style 含む)         |
| baseline     | テスト内ハードコード                      | 外部 JSON ファイル (commit 対象)                |
| 失敗時の出力 | assert メッセージ                         | 行番号付き diff + 更新コマンド案内              |
| 用途         | 開発時の即時 sanity                       | リグレッション防止 / 視覚仕様の正式記録         |
| 依存         | 単独実行可                                | `tests/visual/baseline/*.json` に依存           |

両者は併存。既存テストは壊さない。

## テスト構成

| ファイル                          | テスト数 | 何を検証するか                                                      |
| --------------------------------- | -------- | ------------------------------------------------------------------- |
| `canon_visual_full.test.mjs`      | 19       | 17 canon の deep snapshot + 全 canon × size=200 の集合 fingerprint  |
| `speech_lifecycle.test.mjs`       | 6        | 発話 phase (idle→mount→utter→fade→remove) + 7 register×canon matrix |
| `halo_geometry.test.mjs`          | 10       | tickPos() の三角関数, 中心対称性, 半径スケール一貫性                |
| `css_token_consistency.test.mjs`  | 8        | CSS `--pr-c-*` / `--pring-speech-target-opacity` ⇔ JS 定数          |
| **合計**                          | **43**   |                                                                     |

## 実装上の注意

- **新規 dev dependencies なし** — node:test + jsdom (既存) のみで完結
- **production code は触らない** — `particle_*.js` / `particle_*.css` は read-only
- **タイマー圧縮** — speech lifecycle test は `crystallizeMs/holdMin/holdMax/fadeMs` を
  小さく上書きして実時間 < 50ms で完走させる
- **stableStringify** — JSON.stringify の key 順を sort して decisionistic にする
- **数値丸め** — 小数点 2 桁 (Math.round(x*100)/100) で浮動小数点ノイズを除去

## トラブルシュート

### Q. 全テストが突然 fail する
A. production code を変更したか? `git log -p particle_rings.js` で確認。
   意図的なら `bash scripts/update-visual-baseline.sh`。意図でないなら revert。

### Q. CI でだけ fail する
A. node version 不一致の可能性。jsdom の挙動が version で微妙に違う場合あり。
   `.nvmrc` を固定するか、CI と local で同一 node を使う。

### Q. baseline 更新したのに diff が消えない
A. `tests/visual/baseline/` を git に add 忘れ。`git status tests/visual/` で確認。
