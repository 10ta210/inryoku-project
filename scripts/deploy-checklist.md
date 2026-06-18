# inryokü — Production Deploy Checklist

Run **top to bottom** before promoting anything to production.
Boxes left unchecked = do not deploy.

> All paths are repo-relative. All commands assume cwd = repo root.

---

## 0. Pre-flight

- [ ] On `main` (or release branch) and clean: `git status` shows no untracked / unstaged changes
- [ ] Latest `main` pulled: `git pull --ff-only`
- [ ] Node 20.x installed locally: `node -v`
- [ ] `.env` for the target environment is loaded (NOT the dev one)

## 1. Code quality

- [ ] `npm ci` succeeds
- [ ] `npm test` — all 180+ tests pass
- [ ] `npm run lint` (precommit script) — no failures
- [ ] `bash scripts/precommit.sh` — clean
- [ ] No TODO / FIXME / `console.log` left in shipped code that would leak in production

## 2. Configuration

- [ ] `bash scripts/check-env.sh --strict` — all required vars present, formats sane
- [ ] `SHOPIFY_STORE_DOMAIN` points to **production** store (NOT dev/staging)
- [ ] `SHOPIFY_VARIANT_ID` matches the variant the launch SKU expects
- [ ] `GELATO_API_KEY` is the live key (not sandbox)
- [ ] `ADMIN_API_KEY` rotated in the last 90 days
- [ ] `GROQ_API_KEY` quota is healthy (info chat fallback path exists, but check anyway)
- [ ] `NODE_ENV=production`
- [ ] `SITE_ORIGIN` matches the canonical https domain (used in OG / sitemap)

## 3. Static asset / cache busting

- [ ] `bash scripts/release.sh --dry-run` shows the expected `?v=` bump
- [ ] Run `bash scripts/release.sh` (or with `--version YYYYMMDD`)
- [ ] Commit the bump: `git commit -am "release: bump cache-buster YYYYMMDD"`
- [ ] Service worker version (`sw.js` `CACHE_NAME`) was bumped if any precached asset changed

## 4. Legal / commerce-required pages

- [ ] `/legal.html`, `/privacy.html`, `/returns.html`, `/size-guide.html` — visible, copy current
- [ ] Specified Commercial Transactions Act / 特定商取引法 fields filled (operator, address, contact)
- [ ] Refund / shipping policy date matches launch date
- [ ] Footer links to all four legal pages from every shippable page

## 5. SEO / metadata

- [ ] `robots.txt` does **not** disallow `/`
- [ ] `sitemap.xml` lists every public page with current `lastmod`
- [ ] `<link rel="canonical">` on every page points to absolute https URL
- [ ] OG image (`inryoku_og.png`) loads (no 404)
- [ ] `manifest.json` icons resolve
- [ ] Lighthouse SEO ≥ 95

## 6. Domain / TLS

- [ ] DNS A / AAAA / CNAME records correct
- [ ] TLS cert covers apex + www, not expiring within 30 days
- [ ] HSTS header present and `max-age >= 15552000`
- [ ] HTTP → HTTPS redirect (301)
- [ ] `www` ↔ apex redirect consistent and 301

## 7. Runtime smoke

- [ ] Boot the prod build locally with prod `.env` — server logs are clean
- [ ] `bash scripts/healthcheck.sh https://<production-host>` — all green
- [ ] Add-to-cart flow → checkout redirect works against the prod Shopify store with a test SKU
- [ ] Subscribe form succeeds; subscriber appears in `data/subscribers.json` (or downstream sink)
- [ ] AI info chat answers; visible fallback when `GROQ_API_KEY` is absent
- [ ] Service worker registers; offline page renders for a forced offline reload

## 8. Observability

- [ ] Server logs going somewhere durable (file / log drain / vendor)
- [ ] Uptime monitor pointed at `/` and `/robots.txt`
- [ ] Error reporting hook (if any) exercised at least once

## 9. Backup

- [ ] `bash scripts/backup.sh` ran in the last 24h
- [ ] Backup archive copied off-host (S3 / Drive / etc.)

## 10. Tag & deploy

- [ ] Tag: `git tag -a vYYYY.MM.DD -m "release"` then `git push --tags`
- [ ] Deploy via the chosen target (Render / Vercel / VPS) — see `docs/devops-2026-04-28.md`
- [ ] Post-deploy: re-run `bash scripts/healthcheck.sh https://<production-host>` — all green
- [ ] Visual sanity check on a real device (mobile + desktop) — hero, particles, CTA

---

## Rollback procedure

When something is wrong **after** deploy:

1. **Stop the bleeding.**
   - VPS / systemd: `sudo systemctl stop inryoku && sudo systemctl start inryoku@previous`
   - Render / Vercel: trigger a redeploy from the previous successful commit via the dashboard, or
     `git revert <bad-sha> && git push` and let CI redeploy.
2. **Verify rollback healthy:** `bash scripts/healthcheck.sh https://<production-host>`.
3. **Restore data if needed:** `tar -xzf backups/inryoku-data-<ts>.tar.gz -C /tmp/restore && rsync -a /tmp/restore/data/ ./data/`.
4. **Bust caches:** if a bad asset shipped with `?v=`, run `bash scripts/release.sh` with a higher version and redeploy so clients refetch.
5. **Post-mortem:** open a `docs/incident-YYYY-MM-DD.md` with timeline, blast radius, fix, prevention.

> Rule of thumb: if you cannot reproduce green health within **10 minutes** of detection, roll back first and diagnose after.
