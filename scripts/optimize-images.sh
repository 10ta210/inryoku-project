#!/usr/bin/env bash
# optimize-images.sh — public/ + ルート直下の PNG を WebP / AVIF に並列変換
# 2026-04-28 (v2: 並列処理 / skip-if-fresh / lossless 自動判定 / 統計出力)
#
# 使い方:
#   $ bash scripts/optimize-images.sh           # 通常実行（差分のみ）
#   $ bash scripts/optimize-images.sh --force   # 強制再生成
#   $ bash scripts/optimize-images.sh --dry-run # 何が変換されるか表示のみ
#
# 必要ツール (brew):
#   brew install webp libavif pngquant
#
# 仕様:
#   - 元 PNG は絶対に削除しない（バックアップ不要）
#   - WebP/AVIF が PNG より新しければスキップ
#   - ロゴ系 (logo_*, *_icon, _logo_) は lossless / 写真系は q=80 lossy
#   - xargs -P で CPU 並列実行
#   - 統計（変換数 / 元合計サイズ / 出力合計サイズ / 削減率）を最後に出す
#   - p3_code_for_claude.js / particle_*.* / tests/visual/baselines は対象外

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUB="$ROOT/public"

# ─── flags ─────────────────────────────────────────
FORCE=0
DRY=0
for arg in "$@"; do
  case "$arg" in
    --force)   FORCE=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"; exit 0 ;;
  esac
done

# ─── tool checks ───────────────────────────────────
HAS_WEBP=0; HAS_AVIF=0
command -v cwebp   >/dev/null 2>&1 && HAS_WEBP=1
command -v avifenc >/dev/null 2>&1 && HAS_AVIF=1

if [ $HAS_WEBP -eq 0 ] && [ $HAS_AVIF -eq 0 ]; then
  echo "[error] neither cwebp nor avifenc found."
  echo "        install: brew install webp libavif"
  exit 1
fi
[ $HAS_WEBP -eq 0 ] && echo "[warn] cwebp missing — WebP skipped (brew install webp)"
[ $HAS_AVIF -eq 0 ] && echo "[warn] avifenc missing — AVIF skipped (brew install libavif)"

# 並列度 (CPUコア数 or 4)
JOBS="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)"

echo "== inryokü image optimizer v2 =="
echo "root=$ROOT  jobs=$JOBS  force=$FORCE  dry-run=$DRY"
echo "tools: webp=$HAS_WEBP avif=$HAS_AVIF"
echo

# ─── helpers ───────────────────────────────────────

# is_lossless <basename> -> echo 1 if logo / icon / transparent UI asset
is_lossless() {
  case "$1" in
    *logo*|*icon*|*shell*|*sphere*) echo 1 ;;
    *) echo 0 ;;
  esac
}

# needs_update <src.png> <dst.webp|avif>
# returns 0 if dst missing or older than src (or FORCE=1)
needs_update() {
  local src="$1" dst="$2"
  [ $FORCE -eq 1 ] && return 0
  [ ! -f "$dst" ] && return 0
  # dst exists and is newer -> skip
  if [ "$dst" -nt "$src" ]; then return 1; fi
  return 0
}

# size in bytes (mac/linux 両対応)
fsize() {
  if stat -f%z "$1" >/dev/null 2>&1; then stat -f%z "$1"
  else stat -c%s "$1"; fi
}

# 統計用 tmp
STATS_DIR="$(mktemp -d)"
trap 'rm -rf "$STATS_DIR"' EXIT

# convert_one <png_abs_path>
convert_one() {
  local png="$1"
  local dir base lossless
  dir="$(dirname "$png")"
  base="$(basename "${png%.png}")"
  lossless="$(is_lossless "$base")"

  local src_size
  src_size="$(fsize "$png")"

  # WebP -------------------------------------------------
  if [ "$HAS_WEBP" -eq 1 ]; then
    local webp="$dir/$base.webp"
    if needs_update "$png" "$webp"; then
      if [ "$DRY" -eq 1 ]; then
        echo "[dry][webp] $png -> $webp ($([ "$lossless" = 1 ] && echo lossless || echo q=80))"
      else
        if [ "$lossless" = "1" ]; then
          cwebp -lossless -m 6 -mt -quiet "$png" -o "$webp"
        else
          cwebp -q 80 -m 6 -mt -quiet "$png" -o "$webp"
        fi
        local out_size; out_size="$(fsize "$webp")"
        printf '%s\t%s\t%s\twebp\n' "$png" "$src_size" "$out_size" >> "$STATS_DIR/log"
        echo "[webp] $base.png -> $base.webp  ($((src_size/1024))K -> $((out_size/1024))K)"
      fi
    fi
  fi

  # AVIF -------------------------------------------------
  if [ "$HAS_AVIF" -eq 1 ]; then
    local avif="$dir/$base.avif"
    if needs_update "$png" "$avif"; then
      if [ "$DRY" -eq 1 ]; then
        echo "[dry][avif] $png -> $avif ($([ "$lossless" = 1 ] && echo lossless || echo q=80))"
      else
        if [ "$lossless" = "1" ]; then
          avifenc --lossless --speed 6 -j all "$png" "$avif" >/dev/null
        else
          avifenc --min 20 --max 28 --speed 6 -j all "$png" "$avif" >/dev/null
        fi
        local out_size; out_size="$(fsize "$avif")"
        printf '%s\t%s\t%s\tavif\n' "$png" "$src_size" "$out_size" >> "$STATS_DIR/log"
        echo "[avif] $base.png -> $base.avif  ($((src_size/1024))K -> $((out_size/1024))K)"
      fi
    fi
  fi
}

export -f convert_one needs_update is_lossless fsize
export FORCE DRY HAS_WEBP HAS_AVIF STATS_DIR

# ─── 対象 PNG を集める ─────────────────────────────
# 対象: public/*.png + ルートのロゴ/OGのみ。dev用 card_preview_check.png は除外。
TARGETS=()
[ -d "$PUB" ] && while IFS= read -r -d '' f; do TARGETS+=("$f"); done < <(find "$PUB" -maxdepth 1 -type f -name '*.png' -print0)
for n in inryoku_logo_icon.png inryoku_og.png logo_sphere.png logo_shell.png; do
  [ -f "$ROOT/$n" ] && TARGETS+=("$ROOT/$n")
done

if [ "${#TARGETS[@]}" -eq 0 ]; then
  echo "[info] no PNG targets found."
  exit 0
fi

echo "targets: ${#TARGETS[@]} PNG"
echo

# ─── 並列実行 ──────────────────────────────────────
printf '%s\0' "${TARGETS[@]}" | xargs -0 -n1 -P "$JOBS" bash -c 'convert_one "$0"'

# ─── 統計出力 ──────────────────────────────────────
echo
echo "== summary =="
if [ -f "$STATS_DIR/log" ]; then
  awk -F'\t' '
    { count++; src += $2; out += $3; per[$4]++ }
    END {
      if (count == 0) { print "  (nothing converted)"; exit }
      printf "  converted: %d files\n", count
      for (k in per) printf "    %-5s: %d\n", k, per[k]
      printf "  total src: %.1f MB\n", src/1024/1024
      printf "  total out: %.1f MB\n", out/1024/1024
      if (src > 0) printf "  reduction: %.1f%%\n", (1 - out/src) * 100
    }
  ' "$STATS_DIR/log"
else
  echo "  (everything up-to-date — no conversions needed)"
  echo "  use --force to regenerate."
fi
