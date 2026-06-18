#!/usr/bin/env bash
# check-images.sh — 画像最適化の状況を診断（読み取り専用、変換しない）
# 2026-04-28
#
# 使い方:
#   $ bash scripts/check-images.sh
#   $ bash scripts/check-images.sh --strict  # 1件でも問題があれば exit 1
#
# 検査内容:
#   1. public/ + ルートの各 PNG に対応する WebP / AVIF が存在するか
#   2. WebP/AVIF が PNG より古ければ "stale" としてフラグ
#   3. HTML / manifest.json / sitemap.xml から参照される画像が物理存在するか
#   4. 推奨アクション: bash scripts/optimize-images.sh

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUB="$ROOT/public"

STRICT=0
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
  esac
done

ISSUES=0
MISSING_WEBP=()
MISSING_AVIF=()
STALE=()
BROKEN_REF=()

# ─── 1. PNG → WebP/AVIF カバレッジ ─────────────────
echo "== 1. WebP / AVIF coverage =="
collect_pngs() {
  [ -d "$PUB" ] && find "$PUB" -maxdepth 1 -type f -name '*.png'
  for n in inryoku_logo_icon.png inryoku_og.png logo_sphere.png logo_shell.png; do
    [ -f "$ROOT/$n" ] && echo "$ROOT/$n"
  done
}

while IFS= read -r png; do
  [ -z "$png" ] && continue
  base="${png%.png}"
  rel="${png#$ROOT/}"

  if [ ! -f "$base.webp" ]; then
    MISSING_WEBP+=("$rel")
  elif [ "$png" -nt "$base.webp" ]; then
    STALE+=("$rel.webp (older than PNG)")
  fi

  if [ ! -f "$base.avif" ]; then
    MISSING_AVIF+=("$rel")
  elif [ "$png" -nt "$base.avif" ]; then
    STALE+=("$rel.avif (older than PNG)")
  fi
done < <(collect_pngs)

printf '  missing WebP : %d\n' "${#MISSING_WEBP[@]}"
for f in "${MISSING_WEBP[@]:-}"; do [ -n "$f" ] && echo "    - $f"; done
printf '  missing AVIF : %d\n' "${#MISSING_AVIF[@]}"
for f in "${MISSING_AVIF[@]:-}"; do [ -n "$f" ] && echo "    - $f"; done
printf '  stale        : %d\n' "${#STALE[@]}"
for f in "${STALE[@]:-}"; do [ -n "$f" ] && echo "    - $f"; done

ISSUES=$((ISSUES + ${#MISSING_WEBP[@]} + ${#MISSING_AVIF[@]} + ${#STALE[@]}))

# ─── 2. HTML / manifest / sitemap が参照する画像の物理存在 ─────────
echo
echo "== 2. referenced-image existence =="

REFS_FILE="$(mktemp)"
trap 'rm -f "$REFS_FILE"' EXIT

# HTML / manifest / sitemap から *.png|*.webp|*.avif を抽出
grep -hEo '[A-Za-z0-9_./-]+\.(png|webp|avif|jpg|jpeg)' \
  "$ROOT"/*.html "$ROOT/manifest.json" "$ROOT/sitemap.xml" 2>/dev/null \
  | sort -u > "$REFS_FILE" || true

while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  # 絶対 URL は scheme + host を取り除いてパスだけにする
  case "$ref" in
    https://*) ref="${ref#https://}"; ref="${ref#*/}" ;;
    http://*)  ref="${ref#http://}";  ref="${ref#*/}" ;;
  esac
  # 先頭の / を最大2つまで除去 (grep が "//inryoku.com/..." を拾うことがある)
  ref="${ref#/}"; ref="${ref#/}"
  # grep が host から拾った場合 (e.g. "inryoku.com/foo.png") も剥がす
  case "$ref" in
    inryoku.com/*) ref="${ref#inryoku.com/}" ;;
  esac
  # 候補パス: ROOT/<ref> or ROOT/<ref> after stripping leading public/
  if [ -f "$ROOT/$ref" ]; then
    : ok
  elif [ -f "$PUB/$(basename "$ref")" ] && [[ "$ref" == public/* ]]; then
    : ok
  else
    BROKEN_REF+=("$ref")
  fi
done < "$REFS_FILE"

if [ "${#BROKEN_REF[@]}" -eq 0 ]; then
  echo "  all referenced images exist on disk."
else
  echo "  broken references: ${#BROKEN_REF[@]}"
  for f in "${BROKEN_REF[@]}"; do echo "    - $f"; done
  ISSUES=$((ISSUES + ${#BROKEN_REF[@]}))
fi

# ─── 3. recommendation ─────────────────────────────
echo
echo "== summary =="
if [ "$ISSUES" -eq 0 ]; then
  echo "  OK — all images are optimized and referenced."
  exit 0
fi

echo "  $ISSUES issue(s) found."
if [ "${#MISSING_WEBP[@]}" -gt 0 ] || [ "${#MISSING_AVIF[@]}" -gt 0 ] || [ "${#STALE[@]}" -gt 0 ]; then
  echo "  -> run: bash scripts/optimize-images.sh"
fi
if [ "${#BROKEN_REF[@]}" -gt 0 ]; then
  echo "  -> 上記 broken references は HTML/manifest/sitemap で参照されているがファイルが存在しない。"
fi

[ "$STRICT" -eq 1 ] && exit 1
exit 0
