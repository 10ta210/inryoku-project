#!/usr/bin/env bash
# scripts/precommit.sh
# Lightweight pre-commit gate: tests + node syntax + html/css sanity.
# Wire as a git hook with:
#   ln -s ../../scripts/precommit.sh .git/hooks/pre-commit
# or call directly: bash scripts/precommit.sh
#
# Exits non-zero on any failure to block the commit.

set -u
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

RED=$'\033[31m'; GREEN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'
fail=0

step() { printf "\n%s==> %s%s\n" "$YEL" "$1" "$RST"; }
ok()   { printf "%s   ok%s %s\n" "$GREEN" "$RST" "$1"; }
err()  { printf "%s   FAIL%s %s\n" "$RED" "$RST" "$1"; fail=1; }

# ---------- 1. node --test ----------
step "npm test"
if npm test --silent; then
  ok "tests passed"
else
  err "tests failed"
fi

# ---------- 2. node --check on every .js / .mjs ----------
step "node --check (js syntax)"
syntax_fail=0
# Avoid node_modules / vendor / public.
files=$(find "$ROOT" \
  \( -path "$ROOT/node_modules" -o -path "$ROOT/vendor" -o -path "$ROOT/public" -o -path "$ROOT/.git" \) -prune -o \
  -type f \( -name "*.js" -o -name "*.mjs" -o -name "*.cjs" \) -print)
for f in $files; do
  if ! node --check "$f" 2>/dev/null; then
    err "syntax: $f"
    syntax_fail=1
  fi
done
[ "$syntax_fail" -eq 0 ] && ok "all .js/.mjs/.cjs parse"

# ---------- 3. HTML quick lint ----------
step "html sanity"
html_fail=0
for f in "$ROOT"/*.html; do
  [ -e "$f" ] || continue
  # unbalanced <script>/<style> tags
  open_s=$(grep -c '<script' "$f" || true)
  close_s=$(grep -c '</script>' "$f" || true)
  open_st=$(grep -c '<style'  "$f" || true)
  close_st=$(grep -c '</style>' "$f" || true)
  if [ "$open_s" -ne "$close_s" ]; then
    err "$(basename "$f"): <script> tags unbalanced ($open_s open / $close_s close)"
    html_fail=1
  fi
  if [ "$open_st" -ne "$close_st" ]; then
    err "$(basename "$f"): <style> tags unbalanced ($open_st open / $close_st close)"
    html_fail=1
  fi
  # Missing <!DOCTYPE
  if ! head -3 "$f" | grep -qi '<!doctype'; then
    printf "%s   warn%s %s missing <!DOCTYPE>\n" "$YEL" "$RST" "$(basename "$f")"
  fi
done
[ "$html_fail" -eq 0 ] && ok "html structure ok"

# ---------- 4. CSS quick lint ----------
step "css sanity"
css_fail=0
for f in "$ROOT"/*.css; do
  [ -e "$f" ] || continue
  open=$(tr -cd '{' < "$f" | wc -c | tr -d ' ')
  close=$(tr -cd '}' < "$f" | wc -c | tr -d ' ')
  if [ "$open" != "$close" ]; then
    err "$(basename "$f"): braces unbalanced ($open { / $close })"
    css_fail=1
  fi
done
[ "$css_fail" -eq 0 ] && ok "css braces balanced"

# ---------- 5. JSON sanity (manifest, i18n, package) ----------
step "json sanity"
json_fail=0
for f in "$ROOT"/manifest.json "$ROOT"/i18n.json "$ROOT"/package.json; do
  [ -e "$f" ] || continue
  if ! node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>/dev/null; then
    err "$f invalid"
    json_fail=1
  fi
done
[ "$json_fail" -eq 0 ] && ok "json valid"

# ---------- 6. forbidden patterns ----------
step "secrets scan (staged-ish)"
secret_fail=0
patterns='AKIA[0-9A-Z]{16}|-----BEGIN (RSA|OPENSSH) PRIVATE KEY-----|sk-[A-Za-z0-9]{20,}'
hits=$(grep -REn --binary-files=without-match \
  --include="*.js" --include="*.mjs" --include="*.html" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=vendor \
  -E "$patterns" "$ROOT" || true)
if [ -n "$hits" ]; then
  err "possible secret in tracked files:"
  printf "%s\n" "$hits" | head -5
  secret_fail=1
fi
[ "$secret_fail" -eq 0 ] && ok "no obvious secret patterns"

printf "\n"
if [ "$fail" -ne 0 ]; then
  printf "%spre-commit: BLOCKED%s — fix the failures above.\n" "$RED" "$RST"
  exit 1
fi
printf "%spre-commit: OK%s\n" "$GREEN" "$RST"
exit 0
