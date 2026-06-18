#!/usr/bin/env bash
# scripts/restore.sh
# Restore data/ from a backup tar.gz produced by scripts/backup.sh.
#
# Usage:
#   bash scripts/restore.sh <archive.tar.gz>
#   bash scripts/restore.sh <archive.tar.gz> --dry-run
#   bash scripts/restore.sh <archive.tar.gz> --force
#   bash scripts/restore.sh <archive.tar.gz> --target /tmp/restore-test
#
# Behaviour:
#   1. Verifies sha256 against <archive>.sha256 if present.
#   2. Asks for confirmation before overwriting an existing data/ dir.
#      Skip with --force, or stop after verification with --dry-run.
#   3. Snapshots existing data/ as data.pre-restore-<TS> before extracting.
#   4. Runs scripts/verify-data.mjs against the restored tree.

set -u
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_ROOT="$ROOT"
ARCHIVE=""
DRY_RUN=0
FORCE=0

usage() { sed -n '2,18p' "$0"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    --target) shift; TARGET_ROOT="$1" ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown arg: $1" >&2; exit 2 ;;
    *) if [ -z "$ARCHIVE" ]; then ARCHIVE="$1"; else echo "extra arg: $1" >&2; exit 2; fi ;;
  esac
  shift
done

GREEN=$'\033[32m'; YEL=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RST=$'\033[0m'

if [ -z "$ARCHIVE" ]; then
  printf "%susage: bash scripts/restore.sh <archive.tar.gz> [--dry-run|--force]%s\n" "$RED" "$RST" >&2
  exit 2
fi

if [ ! -f "$ARCHIVE" ]; then
  printf "%sarchive not found: %s%s\n" "$RED" "$ARCHIVE" "$RST" >&2
  exit 1
fi

ARCHIVE_ABS="$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")"
ARCHIVE_DIR="$(dirname "$ARCHIVE_ABS")"
ARCHIVE_BASE="$(basename "$ARCHIVE_ABS")"

# 1. sha256 verification
SUM_FILE="$ARCHIVE_ABS.sha256"
if [ -f "$SUM_FILE" ]; then
  printf "%s==> verifying sha256%s\n" "$YEL" "$RST"
  if ( cd "$ARCHIVE_DIR" && shasum -a 256 -c "$ARCHIVE_BASE.sha256" >/dev/null 2>&1 ); then
    printf "%s    ok%s sha256 matches\n" "$GREEN" "$RST"
  else
    printf "%s    FAIL%s sha256 mismatch — refusing to restore\n" "$RED" "$RST" >&2
    exit 3
  fi
else
  printf "%s    warn%s no .sha256 file alongside archive — skipping integrity check\n" "$YEL" "$RST"
fi

# 2. tar listing sanity
if ! tar -tzf "$ARCHIVE_ABS" >/dev/null 2>&1; then
  printf "%s    FAIL%s archive is not a readable tar.gz\n" "$RED" "$RST" >&2
  exit 3
fi
if ! tar -tzf "$ARCHIVE_ABS" | grep -q '^data/\?'; then
  printf "%s    FAIL%s archive does not contain data/ — wrong file?\n" "$RED" "$RST" >&2
  exit 3
fi

DATA_DIR="$TARGET_ROOT/data"

if [ "$DRY_RUN" = "1" ]; then
  printf "\n%s[dry-run]%s would restore into %s\n" "$DIM" "$RST" "$DATA_DIR"
  printf "%s[dry-run]%s archive contents (first 20):\n" "$DIM" "$RST"
  tar -tzf "$ARCHIVE_ABS" | head -20
  exit 0
fi

# 3. confirm overwrite
if [ -d "$DATA_DIR" ] && [ "$FORCE" != "1" ]; then
  printf "\n%s==> %s already exists.%s This will overwrite it.\n" "$YEL" "$DATA_DIR" "$RST"
  printf "    type %sYES%s to continue: " "$RED" "$RST"
  read -r answer || answer=""
  if [ "$answer" != "YES" ]; then
    printf "%saborted.%s\n" "$RED" "$RST"
    exit 1
  fi
fi

# 4. snapshot existing
if [ -d "$DATA_DIR" ]; then
  TS=$(date +%Y%m%d-%H%M%S)
  SNAP="$TARGET_ROOT/data.pre-restore-$TS"
  printf "%s==> snapshotting current data/ → %s%s\n" "$YEL" "$SNAP" "$RST"
  mv "$DATA_DIR" "$SNAP"
fi

# 5. extract
printf "%s==> extracting archive%s\n" "$YEL" "$RST"
mkdir -p "$TARGET_ROOT"
tar -xzf "$ARCHIVE_ABS" -C "$TARGET_ROOT"

if [ ! -d "$DATA_DIR" ]; then
  printf "%s    FAIL%s data/ not present after extract\n" "$RED" "$RST" >&2
  exit 3
fi
printf "%s    ok%s extracted to %s\n" "$GREEN" "$RST" "$DATA_DIR"

# 6. verify integrity
VERIFY="$ROOT/scripts/verify-data.mjs"
if [ -f "$VERIFY" ]; then
  printf "\n%s==> verifying restored data%s\n" "$YEL" "$RST"
  if node "$VERIFY" --root "$TARGET_ROOT"; then
    printf "%srestore: OK%s\n" "$GREEN" "$RST"
  else
    printf "%srestore: data extracted but verify-data.mjs reported issues%s\n" "$RED" "$RST" >&2
    exit 4
  fi
else
  printf "%s(verify-data.mjs not found, skipping post-restore validation)%s\n" "$DIM" "$RST"
fi
