#!/usr/bin/env bash
# check-sitemap.sh — verify each <loc> in sitemap.xml is reachable.
# Usage: bash scripts/check-sitemap.sh [base-url-override]
#   base-url-override: replace https://inryoku.com with this (e.g. http://localhost:3000)
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITEMAP="$ROOT/sitemap.xml"
BASE_OVERRIDE="${1:-}"

if [ ! -f "$SITEMAP" ]; then
    echo "[check-sitemap] not found: $SITEMAP" >&2
    exit 1
fi

# Extract <loc> values (one per line).
URLS=$(grep -oE '<loc>[^<]+</loc>' "$SITEMAP" | sed -E 's#</?loc>##g')

total=0
ok=0
fail=0
declare -a failures

while IFS= read -r url; do
    [ -z "$url" ] && continue
    total=$((total + 1))
    target="$url"
    if [ -n "$BASE_OVERRIDE" ]; then
        target="${url/https:\/\/inryoku.com/$BASE_OVERRIDE}"
    fi
    # Decode &amp; for curl.
    target="${target//&amp;/&}"

    code=$(curl -sS -o /dev/null -L --max-time 10 -w '%{http_code}' "$target" 2>/dev/null || echo "000")
    if [[ "$code" =~ ^2 ]]; then
        ok=$((ok + 1))
        printf '  ok  %s -> %s\n' "$code" "$target"
    else
        fail=$((fail + 1))
        failures+=("$code  $target")
        printf '  ERR %s -> %s\n' "$code" "$target"
    fi
done <<< "$URLS"

echo ""
echo "[check-sitemap] total=$total ok=$ok fail=$fail"
if [ "$fail" -gt 0 ]; then
    echo ""
    echo "Failures:"
    for f in "${failures[@]}"; do
        echo "  $f"
    done
    exit 2
fi
exit 0
