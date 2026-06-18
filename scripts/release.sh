#!/usr/bin/env bash
# scripts/release.sh
# Bumps cache-buster query strings (?v=YYYYMMDD or ?v=N) across HTML/JS/CSS.
#
# Usage:
#   bash scripts/release.sh              # bumps to today's YYYYMMDD
#   bash scripts/release.sh --dry-run    # show diffs only
#   bash scripts/release.sh --version 20260501
#   bash scripts/release.sh --integer    # bump pure-integer ?v=N → N+1 instead
#
# Notes:
# - Targets *.html, *.js, *.css, *.mjs at repo root.
# - Skips node_modules / vendor / public.
# - Backs up edited files to .release-backup/<timestamp>/ unless --no-backup.

set -u
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

DRY=0
INTEGER_MODE=0
BACKUP=1
TARGET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run|-n) DRY=1 ;;
    --version|-v) shift; TARGET="$1" ;;
    --integer)    INTEGER_MODE=1 ;;
    --no-backup)  BACKUP=0 ;;
    -h|--help)
      sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

if [ -z "$TARGET" ]; then
  TARGET=$(date +%Y%m%d)
fi

TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$ROOT/.release-backup/$TS"

GREEN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'

step() { printf "%s==> %s%s\n" "$YEL" "$1" "$RST"; }

step "release: target version = $TARGET   dry-run=$DRY  integer-mode=$INTEGER_MODE"

files=$(find "$ROOT" \
  \( -path "$ROOT/node_modules" -o -path "$ROOT/vendor" -o -path "$ROOT/public" \
     -o -path "$ROOT/.git" -o -path "$ROOT/.release-backup" -o -path "$ROOT/data" \) -prune -o \
  -maxdepth 2 -type f \( -name "*.html" -o -name "*.js" -o -name "*.mjs" -o -name "*.css" \) -print)

changed=0
for f in $files; do
  # Find existing ?v= occurrences and decide replacement.
  if ! grep -qE '\?v=[0-9A-Za-z._-]+' "$f"; then continue; fi

  if [ "$INTEGER_MODE" -eq 1 ]; then
    # Bump every ?v=N where N is integer to N+1, but using TARGET if numeric.
    new=$(perl -pe 's{\?v=(\d+)}{ "?v=" . ($1+1) }ge' "$f")
  else
    # Replace any ?v=<token> with the target version.
    new=$(perl -pe 's{\?v=[0-9A-Za-z._-]+}{?v='"$TARGET"'}g' "$f")
  fi

  if [ "$new" != "$(cat "$f")" ]; then
    rel="${f#$ROOT/}"
    if [ "$DRY" -eq 1 ]; then
      printf "%s  would-update%s %s\n" "$DIM" "$RST" "$rel"
      diff <(printf "%s" "$(cat "$f")") <(printf "%s" "$new") | grep -E '^[<>]' | head -6 || true
    else
      if [ "$BACKUP" -eq 1 ]; then
        mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
        cp "$f" "$BACKUP_DIR/$rel"
      fi
      printf "%s" "$new" > "$f"
      printf "%s  updated%s %s\n" "$GREEN" "$RST" "$rel"
    fi
    changed=$((changed+1))
  fi
done

if [ "$DRY" -eq 1 ]; then
  printf "\n%s(dry-run) %d file(s) would change.%s\n" "$YEL" "$changed" "$RST"
else
  printf "\n%sbumped %d file(s) to ?v=%s%s\n" "$GREEN" "$changed" "$TARGET" "$RST"
  [ "$BACKUP" -eq 1 ] && [ "$changed" -gt 0 ] && printf "%sbackup: %s%s\n" "$DIM" "$BACKUP_DIR" "$RST"
fi
