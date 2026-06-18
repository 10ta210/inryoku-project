#!/usr/bin/env bash
# uptime-ping.sh — minimal cron-friendly uptime probe.
# Suggested cron: */5 * * * * /path/to/inryoku_hp/scripts/uptime-ping.sh
set -u

HOST="${INRYOKU_HOST:-https://inryoku.com}"
LOG="${INRYOKU_UPTIME_LOG:-$HOME/inryoku-uptime.log}"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

code=$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' "$HOST/" 2>/dev/null || echo "000")
rt=$(curl -sS -o /dev/null --max-time 10 -w '%{time_total}' "$HOST/" 2>/dev/null || echo "-")

if [[ "$code" =~ ^2 ]]; then
    echo "$TS  OK   $code  ${rt}s  $HOST" >> "$LOG"
    exit 0
else
    echo "$TS  FAIL $code  ${rt}s  $HOST" >> "$LOG"
    exit 1
fi
