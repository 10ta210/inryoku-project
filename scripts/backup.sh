#!/usr/bin/env bash
# scripts/backup.sh
# Snapshots data/ to a dated tar.gz, prunes old archives.
#
# Usage:
#   bash scripts/backup.sh                  # backups → ./backups/
#   bash scripts/backup.sh --out /var/backup/inryoku
#   bash scripts/backup.sh --keep 7         # keep last 7 archives (default 14)

set -u
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/backups"
KEEP=14

while [ $# -gt 0 ]; do
  case "$1" in
    --out) shift; OUT="$1" ;;
    --keep) shift; KEEP="$1" ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

GREEN=$'\033[32m'; YEL=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RST=$'\033[0m'

if [ ! -d "$ROOT/data" ]; then
  printf "%sno data/ directory — nothing to back up%s\n" "$YEL" "$RST"
  exit 0
fi

mkdir -p "$OUT"

TS=$(date +%Y%m%d-%H%M%S)
ARCHIVE="$OUT/inryoku-data-$TS.tar.gz"

printf "%s==> archiving data/ → %s%s\n" "$YEL" "$ARCHIVE" "$RST"
tar -czf "$ARCHIVE" -C "$ROOT" data
size=$(du -h "$ARCHIVE" | awk '{print $1}')
printf "%s    ok%s %s (%s)\n" "$GREEN" "$RST" "$ARCHIVE" "$size"

# checksum
( cd "$OUT" && shasum -a 256 "$(basename "$ARCHIVE")" > "$ARCHIVE.sha256" )
printf "%s    sha256%s $(cat "$ARCHIVE.sha256")\n" "$DIM" "$RST"

# prune
printf "\n%s==> pruning (keep %d)%s\n" "$YEL" "$KEEP" "$RST"
# List archives newest-first, skip the first $KEEP, delete the rest.
ls -1t "$OUT"/inryoku-data-*.tar.gz 2>/dev/null | awk -v k="$KEEP" 'NR>k' | while read -r old; do
  printf "%s    rm%s %s\n" "$DIM" "$RST" "$old"
  rm -f "$old" "$old.sha256"
done

printf "\n%sbackup: OK%s\n" "$GREEN" "$RST"
