# inryokü — Backup & Restore Runbook (2026-04-28)

Companion to `docs/devops-2026-04-28.md`. Covers everything related to the
`data/` directory: snapshots, integrity checks, restoring after disaster,
and the periodic tasks 司さん should run.

> **Scope.** Only `data/` is covered here (subscribers, refs, greys). Application
> code is in git; assets are static. If `data/` is gone, only this runbook
> brings it back — git won't.

---

## 0. Files at a glance

| path                              | role                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `scripts/backup.sh`               | Snapshot `data/` → `backups/inryoku-data-<ts>.tar.gz` + .sha256 |
| `scripts/restore.sh`              | Restore from a tar.gz with sha verification + confirm prompt |
| `scripts/verify-data.mjs`         | Schema/integrity scan of `data/`                             |
| `scripts/data-stats.sh`           | Counts, ranges, last-modified, size, anomaly flag            |
| `tests/backup-restore.test.mjs`   | Round-trip test (tmp dir, never touches real data)           |

npm shortcuts:

```bash
npm run backup        # tar.gz + sha256 + prune
npm run verify:data   # JSON/schema check (exit 1 on issue)
npm run data:stats    # human-friendly summary
npm run restore -- backups/inryoku-data-XXXX.tar.gz
```

---

## 1. Recurring tasks for 司さん

| cadence | command                                              | why |
| ------- | ---------------------------------------------------- | --- |
| daily   | `npm run verify:data`                                | catch corruption early |
| daily   | `npm run backup`                                     | rolling 14-archive window |
| weekly  | `npm run data:stats`                                 | visual sanity (counts grow as expected) |
| monthly | restore drill (Section 4)                            | proves the backup is actually usable |
| on incident | run all three above before touching anything    | snapshot the crime scene |

If you skip everything else, **don't skip the monthly restore drill.** A
backup nobody has restored is a hope, not a backup.

---

## 2. Daily backup

```bash
npm run backup
```

Produces `backups/inryoku-data-YYYYMMDD-HHMMSS.tar.gz` plus a `.sha256`
sidecar. Keeps the most recent 14 by default. Adjust:

```bash
bash scripts/backup.sh --keep 30 --out /var/backup/inryoku
```

Off-machine copy (recommended): rsync `backups/` to a different disk or
cloud bucket. The hashes travel with the archives — verification still
works on any machine.

---

## 3. Daily verification

```bash
npm run verify:data
```

Exit code 0 = clean. Exit code 1 = at least one error. Add `--json` for
machine-readable output. Checks performed:

- `subscribers.json` parses, has `.subscribers` array
  - each entry: valid email, integer `number ≥ 1`, token length ≥ 16,
    `created` is a sane ISO date, `greyColor` is `#rrggbb` if present
  - no duplicate `email` / `number` / `token`
- `refs.json` (if present): array or `.refs`, each has an identifier
- `data/greys/*.json` (if present): each has `number` and optionally
  `color`/`created` in valid shape

`data-stats.sh` runs `verify-data.mjs` at the end as a tripwire.

---

## 4. Restore drill (monthly)

A drill that does **not** touch the real `data/`:

```bash
# 1. fresh backup
npm run backup
ARCHIVE=$(ls -t backups/inryoku-data-*.tar.gz | head -1)

# 2. restore into a throwaway target
mkdir -p /tmp/inryoku-drill
bash scripts/restore.sh "$ARCHIVE" --force --target /tmp/inryoku-drill

# 3. verify
node scripts/verify-data.mjs --root /tmp/inryoku-drill

# 4. clean up
rm -rf /tmp/inryoku-drill
```

If step 3 prints `verify-data: OK`, the backup is good. Log the date
somewhere you'll see it (calendar, this file's footer, anywhere).

---

## 5. Disaster scenarios

### Scenario A: `data/` totally lost

Symptom: `data/` directory missing, server fails to read subscribers, or
every subscriber lookup 404s.

```bash
# stop the server first (avoid concurrent writes during restore)
pkill -f "node server.js"   # or systemctl stop / fly machines stop

# pick the most recent good backup
ls -lt backups/inryoku-data-*.tar.gz | head -5

# restore (will prompt for YES, or use --force for unattended)
npm run restore -- backups/inryoku-data-YYYYMMDD-HHMMSS.tar.gz

# restart
npm start
```

`restore.sh` will:
1. verify sha256
2. (if `data/` somehow still exists) snapshot it as `data.pre-restore-<ts>`
3. extract
4. run `verify-data.mjs` automatically

If sha256 fails, **stop**. Try the next-older archive. Don't `--force`
past a hash failure — that's how you turn a recoverable incident into a
permanent one.

### Scenario B: partial corruption

Symptom: `verify:data` reports invalid JSON or missing fields in one file.

```bash
# 1. snapshot current broken state for forensics
cp -a data data.broken-$(date +%s)

# 2. find a backup from BEFORE the corruption
for a in $(ls -t backups/inryoku-data-*.tar.gz); do
  tar -xzOf "$a" data/subscribers.json | node scripts/verify-data.mjs --root /dev/stdin >/dev/null 2>&1 && echo "GOOD: $a" && break
done
# (or simpler: extract each into /tmp and verify)

# 3. for a single-file restore, extract just that file
tar -xzf backups/inryoku-data-XXX.tar.gz -C /tmp data/subscribers.json
diff data/subscribers.json /tmp/data/subscribers.json
cp /tmp/data/subscribers.json data/subscribers.json

# 4. re-verify
npm run verify:data
```

If the corruption is small (e.g., one new subscriber missing a field),
hand-edit may be cheaper than full restore. Always re-verify after.

### Scenario C: tampering / unauthorised writes

Symptom: unexpected entries; timestamps in the future; emails you don't
recognise; subscriber counts dropped.

```bash
# 1. take the server offline immediately
pkill -f "node server.js"

# 2. snapshot the current state (chain of custody)
TS=$(date +%Y%m%d-%H%M%S)
cp -a data data.tampered-$TS
cp -a backups backups.snapshot-$TS

# 3. compare against the most recent verified-good archive
LAST_GOOD=$(ls -t backups/inryoku-data-*.tar.gz | head -1)
shasum -a 256 -c "$LAST_GOOD.sha256"   # MUST pass; if not, try older
mkdir /tmp/cmp && tar -xzf "$LAST_GOOD" -C /tmp/cmp
diff -r /tmp/cmp/data data > /tmp/tamper.diff
less /tmp/tamper.diff

# 4. restore the last verified-good archive
bash scripts/restore.sh "$LAST_GOOD" --force

# 5. rotate any tokens/secrets the attacker might have seen
#    - check .env  (do NOT copy values into chat)
#    - rotate anything that appears in the diff
#    - revoke and reissue subscriber tokens if the attacker had write
#      access to subscribers.json

# 6. only then bring the server back up
npm start
```

Keep `data.tampered-$TS` and `backups.snapshot-$TS` until the incident is
fully understood. They're evidence.

---

## 6. Test coverage

`tests/backup-restore.test.mjs` covers:

- verify-data on a clean tree (positive case)
- sha256 in `.sha256` matches archive bytes
- `restore.sh --dry-run` does not modify the target
- `restore.sh --force` writes the right files, snapshots the old `data/`,
  and post-verify passes
- tampered archive is rejected (single-byte flip → restore aborts, target
  untouched)
- corrupted JSON is detected
- missing required field is detected
- duplicate subscriber numbers are detected
- `data-stats.sh` runs and reports counts

These tests work entirely in a `mkdtemp` directory and never touch the real
`data/`.

```bash
node --test tests/backup-restore.test.mjs
# or as part of the suite
npm test
```

---

## 7. Quick reference card

```
backup:    npm run backup
verify:    npm run verify:data
stats:     npm run data:stats
restore:   npm run restore -- <path/to/archive.tar.gz>
drill:     bash scripts/restore.sh <archive> --force --target /tmp/drill
           node scripts/verify-data.mjs --root /tmp/drill
           rm -rf /tmp/drill
```

If you only remember one rule: **never `--force` past a sha256 failure.**

— last drill: ____ / ____ / ____  (fill in monthly)
