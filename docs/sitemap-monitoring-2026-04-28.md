# Sitemap auto-generation & monitoring runbook

_Last updated: 2026-04-28_

## 1. sitemap auto-generation

### Generate

```bash
npm run generate:sitemap
```

- Reads `PRODUCTS` from `p3_code_for_claude.js` via regex (no eval).
- Emits `/`, `/p3_test.html`, `/legal.html`, `/privacy.html`, `/returns.html`, `/size-guide.html`.
- Emits one `<url>` per product at `/?product=<slug>` with an `<image:image>` child.
- `hreflang`: `ja`, `en` (`?lang=en`), `x-default`.
- `lastmod` is the date of the last git commit (falls back to today).
- Existing `sitemap.xml` is copied to `sitemap.xml.bak-<iso-ts>` before overwrite.

### Verify

```bash
npm run check:sitemap                          # checks against https://inryoku.com
bash scripts/check-sitemap.sh http://localhost:3000   # against local dev server
```

Exits non-zero if any URL returns non-2xx.

### Tests

```bash
node --test tests/sitemap-gen.test.mjs
```

## 2. monitoring

### Daily snapshot

```bash
npm run monitor                # writes docs/monitoring/YYYY-MM-DD.md
INRYOKU_HOST=http://localhost:3000 npm run monitor
```

Captures: root healthcheck + response time, status of all key paths,
`data/` size, sw.js version constant, and the
last 100 lines of `data/error.log` (override with `INRYOKU_ERROR_LOG`).
(Note: `/api/admin/rate-limit` は実装されていない。admin endpoint の実体は `/api/subscribers` のみ。)

### Uptime ping (cron)

```bash
INRYOKU_HOST=https://inryoku.com /Users/10ta210/Desktop/inryoku_hp/scripts/uptime-ping.sh
```

Appends one line per check to `~/inryoku-uptime.log`:

```
2026-04-28T08:00:00Z  OK   200  0.412s  https://inryoku.com
```

#### Suggested crontab

```cron
# uptime ping every 5 min
*/5 * * * *  INRYOKU_HOST=https://inryoku.com /Users/10ta210/Desktop/inryoku_hp/scripts/uptime-ping.sh

# daily monitoring snapshot at 09:00
0 9 * * *    cd /Users/10ta210/Desktop/inryoku_hp && /usr/local/bin/npm run monitor

# weekly sitemap regen + check (Mon 03:00)
0 3 * * 1    cd /Users/10ta210/Desktop/inryoku_hp && /usr/local/bin/npm run generate:sitemap && /usr/local/bin/npm run check:sitemap
```

## 3. Files

| Path | Purpose |
|---|---|
| `scripts/generate-sitemap.mjs` | Regex-extract PRODUCTS, write sitemap.xml |
| `scripts/check-sitemap.sh`     | curl every `<loc>`; report 4xx/5xx |
| `scripts/monitor.sh`           | Daily ops snapshot → docs/monitoring/ |
| `scripts/uptime-ping.sh`       | 5-min cron uptime probe |
| `tests/sitemap-gen.test.mjs`   | Sitemap generator unit tests |

## 4. Safety

- The generator never imports `p3_code_for_claude.js`; it only reads it as text.
- Production code (`particle_*.*`, `p3_code_for_claude.js`, HTML) is never touched.
- `sitemap.xml` backups accumulate as `sitemap.xml.bak-*`; prune periodically.
