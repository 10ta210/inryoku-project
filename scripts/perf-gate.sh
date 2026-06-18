#!/usr/bin/env bash
# scripts/perf-gate.sh
# CI gate: runs perf-budget.mjs, writes JSON + Markdown reports for PR comments,
# and exits non-zero on violations.
#
# Usage:
#   bash scripts/perf-gate.sh [out-dir]
#
# out-dir defaults to "perf-report".

set -euo pipefail

OUT_ARG="${1:-perf-report}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Resolve OUT_DIR absolutely so absolute / relative inputs both work.
case "$OUT_ARG" in
    /*) OUT_DIR="$OUT_ARG" ;;
    *)  OUT_DIR="$ROOT_DIR/$OUT_ARG" ;;
esac

mkdir -p "$OUT_DIR"

echo "perf-gate: running budget check (out=$OUT_DIR)"

# Run budget. --no-fail so we capture report files first; we re-evaluate exit code below.
node "$ROOT_DIR/scripts/perf-budget.mjs" --no-fail --out-dir "$OUT_DIR"

REPORT_JSON="$OUT_DIR/perf-budget.json"
REPORT_MD="$OUT_DIR/perf-budget.md"

if [ ! -f "$REPORT_JSON" ]; then
    echo "perf-gate: report not generated at $REPORT_JSON" >&2
    exit 2
fi

# Generate PR comment markdown (with collapsible details).
PR_COMMENT="$OUT_DIR/pr-comment.md"
{
    echo "<!-- perf-budget -->"
    echo "## Performance budget"
    echo
    cat "$REPORT_MD"
} > "$PR_COMMENT"

# Determine pass/fail from JSON without external deps.
OK=$(node -e "const fs=require('node:fs');const r=JSON.parse(fs.readFileSync('$REPORT_JSON','utf8'));process.stdout.write(r.ok?'1':'0');")

if [ "$OK" = "1" ]; then
    echo "perf-gate: PASS"
    exit 0
else
    echo "perf-gate: FAIL — see $REPORT_MD" >&2
    # Print the report so CI logs show what broke.
    cat "$REPORT_MD" >&2
    exit 1
fi
