#!/usr/bin/env bash
# scripts/check-env.sh
# Verifies required env vars are present and shaped correctly.
# Never prints values — only the variable name and a verdict.
#
# Usage:
#   bash scripts/check-env.sh                # reads .env if present, else env
#   bash scripts/check-env.sh --file .env.production
#   bash scripts/check-env.sh --strict       # also enforce optional vars
#
# Exit codes:
#   0 — all required ok
#   1 — at least one required var missing or malformed

set -u
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
STRICT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --file) shift; ENV_FILE="$1" ;;
    --strict) STRICT=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

GREEN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'

# Load .env if it exists, but DO NOT export to current shell beyond this script.
if [ -f "$ENV_FILE" ]; then
  printf "%susing %s%s\n" "$DIM" "$ENV_FILE" "$RST"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
else
  printf "%sno %s — using current environment%s\n" "$YEL" "$ENV_FILE" "$RST"
fi

fail=0

# get_value VAR — echoes value without ever logging it.
get_value() { eval "printf %s \"\${$1-}\""; }

mask() {
  local v="$1"
  local n="${#v}"
  if [ "$n" -le 4 ]; then printf "****"; else printf "****(%d chars)" "$n"; fi
}

check() {
  # check NAME REGEX REQUIRED HUMAN
  local name="$1" pattern="$2" required="$3" human="$4"
  local v; v=$(get_value "$name")
  if [ -z "$v" ]; then
    if [ "$required" = "1" ]; then
      printf "%s  MISSING%s %s — %s\n" "$RED" "$RST" "$name" "$human"
      fail=1
    else
      printf "%s  empty  %s %s (optional) — %s\n" "$YEL" "$RST" "$name" "$human"
    fi
    return
  fi
  if [ -n "$pattern" ] && ! printf "%s" "$v" | grep -Eq "$pattern"; then
    printf "%s  BADFMT %s %s [%s] — expected: %s\n" "$RED" "$RST" "$name" "$(mask "$v")" "$human"
    fail=1
    return
  fi
  printf "%s  ok     %s %s [%s]\n" "$GREEN" "$RST" "$name" "$(mask "$v")"
}

printf "\n%s== required ==%s\n" "$YEL" "$RST"
# Shopify
check SHOPIFY_STORE_DOMAIN     '^[a-z0-9-]+\.myshopify\.com$|^[a-z0-9.-]+\.[a-z]{2,}$' 1 "*.myshopify.com or custom domain"
check SHOPIFY_STOREFRONT_TOKEN '^[A-Za-z0-9]{20,}$'                                   1 "Storefront access token (alnum 20+)"
# Gelato
check GELATO_API_KEY           '^[A-Za-z0-9_-]{20,}$'                                  1 "Gelato API key"
# Groq (info chat)
check GROQ_API_KEY             '^gsk_[A-Za-z0-9]{20,}$|^[A-Za-z0-9_-]{20,}$'           1 "Groq API key (gsk_...)"
# Admin
check ADMIN_API_KEY            '^[A-Fa-f0-9]{32,}$|^[A-Za-z0-9_-]{24,}$'               1 "32+ hex or 24+ url-safe token"

printf "\n%s== optional / recommended ==%s\n" "$YEL" "$RST"
check NODE_ENV                 '^(development|production|test)$' "$STRICT" "node env"
check PORT                     '^[0-9]{2,5}$'                    0         "tcp port"
check SHOPIFY_PRODUCT_ID       '^gid://shopify/Product/[0-9]+$'  0         "Shopify product GID"
check SHOPIFY_VARIANT_ID       '^gid://shopify/ProductVariant/[0-9]+$' 0   "Shopify variant GID"
check SITE_ORIGIN              '^https?://'                      0         "canonical https origin"

printf "\n"
if [ "$fail" -ne 0 ]; then
  printf "%scheck-env: FAIL%s — fix the items marked MISSING / BADFMT.\n" "$RED" "$RST"
  exit 1
fi
printf "%scheck-env: OK%s\n" "$GREEN" "$RST"
