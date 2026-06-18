#!/usr/bin/env bash
# scripts/data-stats.sh
# Quick at-a-glance stats for data/ — counts, ranges, last-modified, size.
# Delegates structural checks to scripts/verify-data.mjs.
#
# Usage:
#   bash scripts/data-stats.sh
#   bash scripts/data-stats.sh --root /tmp/restore-test

set -u
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --root) shift; ROOT="$1" ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

DATA="$ROOT/data"
GREEN=$'\033[32m'; YEL=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RST=$'\033[0m'

if [ ! -d "$DATA" ]; then
  printf "%sno data/ at %s%s\n" "$RED" "$DATA" "$RST" >&2
  exit 1
fi

printf "%s==> data stats%s  %s\n" "$YEL" "$RST" "$DATA"

# Total size
SIZE=$(du -sh "$DATA" 2>/dev/null | awk '{print $1}')
printf "    size:           %s\n" "$SIZE"

# Last modified (across all files)
LAST=$(find "$DATA" -type f -print0 2>/dev/null | xargs -0 stat -f '%m %Sm %N' 2>/dev/null | sort -n | tail -1)
if [ -n "$LAST" ]; then
  printf "    last modified:  %s\n" "$(echo "$LAST" | cut -d' ' -f2-)"
fi

# subscribers
SUBS="$DATA/subscribers.json"
if [ -f "$SUBS" ]; then
  N=$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(Array.isArray(d.subscribers)?d.subscribers.length:'?')}catch(e){console.log('ERR:'+e.message)}" "$SUBS")
  printf "    subscribers:    %s\n" "$N"
  # max number, latest created
  EXTRA=$(node -e "
    try{
      const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
      const a=d.subscribers||[];
      const nums=a.map(x=>x.number).filter(Number.isInteger);
      const dates=a.map(x=>x.created).filter(Boolean).sort();
      console.log(JSON.stringify({maxNum: nums.length?Math.max(...nums):null, minNum: nums.length?Math.min(...nums):null, latest: dates[dates.length-1]||null}));
    }catch(e){console.log('{}')}
  " "$SUBS")
  printf "      %s%s%s\n" "$DIM" "$EXTRA" "$RST"
else
  printf "    subscribers:    %s(none)%s\n" "$DIM" "$RST"
fi

# refs
REFS="$DATA/refs.json"
if [ -f "$REFS" ]; then
  N=$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const a=Array.isArray(d)?d:(d.refs||[]);console.log(a.length)}catch(e){console.log('ERR:'+e.message)}" "$REFS")
  printf "    refs:           %s\n" "$N"
else
  printf "    refs:           %s(none)%s\n" "$DIM" "$RST"
fi

# greys
GREYS="$DATA/greys"
if [ -d "$GREYS" ]; then
  COUNT=$(find "$GREYS" -maxdepth 1 -name '*.json' -type f 2>/dev/null | wc -l | tr -d ' ')
  printf "    greys:          %s files\n" "$COUNT"
  if [ "$COUNT" -gt 0 ]; then
    RANGE=$(node -e "
      const fs=require('fs'),p=require('path');
      const d=process.argv[1];
      const nums=fs.readdirSync(d).filter(f=>f.endsWith('.json')).map(f=>{try{return JSON.parse(fs.readFileSync(p.join(d,f),'utf8')).number}catch{return null}}).filter(Number.isInteger);
      if(!nums.length){console.log('?');return}
      console.log(Math.min(...nums)+'..'+Math.max(...nums));
    " "$GREYS")
    printf "    grey range:     %s\n" "$RANGE"
  fi
else
  printf "    greys:          %s(none)%s\n" "$DIM" "$RST"
fi

# anomalies → delegate to verify-data.mjs (errors only)
VERIFY="$ROOT/scripts/verify-data.mjs"
if [ -f "$VERIFY" ]; then
  printf "\n%s==> anomaly scan%s\n" "$YEL" "$RST"
  if node "$VERIFY" --root "$ROOT" >/dev/null 2>&1; then
    printf "%s    ok%s no anomalies detected\n" "$GREEN" "$RST"
  else
    printf "%s    found anomalies — run: node scripts/verify-data.mjs --root %s%s\n" "$RED" "$ROOT" "$RST"
  fi
fi
