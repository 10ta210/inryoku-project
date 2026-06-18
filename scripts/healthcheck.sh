#!/usr/bin/env bash
# scripts/healthcheck.sh
# Hits a running inryokü server and verifies key endpoints + security headers.
#
# Usage:
#   bash scripts/healthcheck.sh                       # http://localhost:3000
#   bash scripts/healthcheck.sh https://inryoku.com
#   BASE=https://staging.example.com bash scripts/healthcheck.sh

set -u
set -o pipefail

BASE="${1:-${BASE:-http://localhost:3000}}"
BASE="${BASE%/}"

GREEN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'

fail=0
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

probe() {
  # probe PATH EXPECTED_STATUS [EXPECTED_CONTENT_TYPE_REGEX]
  local path="$1" expect="$2" ct="${3:-}"
  local url="$BASE$path"
  printf "%s-> %s%s\n" "$YEL" "$url" "$RST"

  if ! curl -sS -o "$TMP" -D "$TMP.h" -m 10 -w "%{http_code}" "$url" > "$TMP.code"; then
    printf "  %sNETWORK%s curl failed\n" "$RED" "$RST"
    fail=1; return
  fi
  local code; code=$(cat "$TMP.code")
  if [ "$code" != "$expect" ]; then
    printf "  %sSTATUS%s got %s expected %s\n" "$RED" "$RST" "$code" "$expect"
    fail=1
  else
    printf "  %sok%s status %s\n" "$GREEN" "$RST" "$code"
  fi
  if [ -n "$ct" ]; then
    if grep -iE "^content-type:" "$TMP.h" | grep -Eqi "$ct"; then
      printf "  %sok%s content-type matches %s\n" "$GREEN" "$RST" "$ct"
    else
      local got; got=$(grep -iE "^content-type:" "$TMP.h" | head -1 | tr -d '\r')
      printf "  %sCT%s expected %s, got: %s\n" "$RED" "$RST" "$ct" "$got"
      fail=1
    fi
  fi
}

check_security_headers() {
  printf "\n%s== security headers (on /) ==%s\n" "$YEL" "$RST"
  curl -sS -o /dev/null -D "$TMP.h" -m 10 "$BASE/" || true
  for h in \
      "content-security-policy" \
      "x-content-type-options" \
      "referrer-policy" \
      "permissions-policy" \
      "strict-transport-security"; do
    if grep -iqE "^$h:" "$TMP.h"; then
      printf "  %sok%s %s\n" "$GREEN" "$RST" "$h"
    else
      # HSTS only required on https
      if [ "$h" = "strict-transport-security" ] && [[ "$BASE" != https://* ]]; then
        printf "  %sskip%s %s (http base)\n" "$DIM" "$RST" "$h"
        continue
      fi
      printf "  %sMISSING%s %s\n" "$RED" "$RST" "$h"
      fail=1
    fi
  done
}

printf "%shealthcheck: %s%s\n\n" "$YEL" "$BASE" "$RST"

probe "/"             200 "text/html"
probe "/robots.txt"   200 "text/plain"
probe "/sitemap.xml"  200 "(text/xml|application/xml)"
probe "/manifest.json" 200 "(application/(json|manifest)|text/json)"
probe "/offline.html" 200 "text/html"

check_security_headers

printf "\n"
if [ "$fail" -ne 0 ]; then
  printf "%shealthcheck: FAIL%s\n" "$RED" "$RST"
  exit 1
fi
printf "%shealthcheck: OK%s\n" "$GREEN" "$RST"
