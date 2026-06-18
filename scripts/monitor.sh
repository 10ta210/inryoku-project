#!/usr/bin/env bash
# monitor.sh — daily operational snapshot for inryokü
# Writes report to docs/monitoring/YYYY-MM-DD.md
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${INRYOKU_HOST:-http://localhost:3000}"
DATE=$(date +%Y-%m-%d)
OUT_DIR="$ROOT/docs/monitoring"
OUT="$OUT_DIR/${DATE}.md"
mkdir -p "$OUT_DIR"

{
    echo "# inryokü monitoring — $DATE"
    echo ""
    echo "_generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)_  "
    echo "_host: $HOST_"
    echo ""

    echo "## Healthcheck"
    code=$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "$HOST/" 2>/dev/null || echo "000")
    rt=$(curl -sS -o /dev/null --max-time 5 -w '%{time_total}' "$HOST/" 2>/dev/null || echo "n/a")
    echo "- root status: \`$code\`"
    echo "- response time: \`${rt}s\`"
    echo ""

    echo "## Endpoints"
    for path in / /p3_test.html /legal.html /privacy.html /returns.html /size-guide.html /sitemap.xml /robots.txt; do
        c=$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "$HOST$path" 2>/dev/null || echo "000")
        t=$(curl -sS -o /dev/null --max-time 5 -w '%{time_total}' "$HOST$path" 2>/dev/null || echo "-")
        echo "- \`$path\` → $c (${t}s)"
    done
    echo ""

    echo "## Rate limit (admin probe)"
    rl=$(curl -sS --max-time 5 "$HOST/api/admin/rate-limit" 2>/dev/null || echo "")
    if [ -n "$rl" ]; then
        echo '```json'
        echo "$rl"
        echo '```'
    else
        echo "_unavailable_"
    fi
    echo ""

    echo "## data/ size"
    if [ -d "$ROOT/data" ]; then
        du -sh "$ROOT/data" 2>/dev/null | sed "s#$ROOT/##" | awk '{print "- "$0}'
        find "$ROOT/data" -type f 2>/dev/null | wc -l | awk '{print "- file count: "$1}'
    else
        echo "_no data/ dir_"
    fi
    echo ""

    echo "## Service worker version"
    sw_ver=$(grep -oE "(SW_VERSION|VERSION|CACHE_NAME)\\s*=\\s*['\"][^'\"]+['\"]" "$ROOT/sw.js" 2>/dev/null | head -3)
    if [ -n "$sw_ver" ]; then
        echo '```'
        echo "$sw_ver"
        echo '```'
    else
        echo "_sw.js: version constant not found_"
    fi
    echo ""

    echo "## Recent error log (last 100 lines)"
    LOG="${INRYOKU_ERROR_LOG:-$ROOT/data/error.log}"
    if [ -f "$LOG" ]; then
        echo '```'
        tail -n 100 "$LOG"
        echo '```'
    else
        echo "_no error log at $LOG_"
    fi
} > "$OUT"

echo "[monitor] wrote $OUT"
