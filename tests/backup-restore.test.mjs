// tests/backup-restore.test.mjs
// Round-trip test: build a fake data tree → archive → tamper detection →
// restore into a tmp root → verify integrity.
// Never touches the real data/ directory.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync, chmodSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const BACKUP_SH  = join(REPO, 'scripts', 'backup.sh');
const RESTORE_SH = join(REPO, 'scripts', 'restore.sh');
const VERIFY_MJS = join(REPO, 'scripts', 'verify-data.mjs');

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

function makeTmpRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'inryoku-br-'));
  return dir;
}

function seedData(root) {
  const dataDir = join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const subs = {
    subscribers: [
      {
        email: 'test+1@example.com',
        number: 1,
        token: 'a'.repeat(64),
        greyColor: '#abcdef',
        bio: '',
        isArtist: false,
        isPublic: false,
        created: '2026-04-27T00:00:00.000Z',
      },
      {
        email: 'test+2@example.com',
        number: 2,
        token: 'b'.repeat(64),
        greyColor: '#123456',
        bio: 'hi',
        isArtist: true,
        isPublic: true,
        created: '2026-04-28T00:00:00.000Z',
      },
    ],
  };
  writeFileSync(join(dataDir, 'subscribers.json'), JSON.stringify(subs, null, 2));
  writeFileSync(join(dataDir, 'refs.json'), JSON.stringify({ refs: [
    { id: 'ref-1', uses: 0, created: '2026-04-27T00:00:00.000Z' },
  ] }, null, 2));
  const greysDir = join(dataDir, 'greys');
  mkdirSync(greysDir);
  writeFileSync(join(greysDir, '0001.json'), JSON.stringify({
    number: 1, color: '#abcdef', created: '2026-04-27T00:00:00.000Z',
  }));
  return dataDir;
}

function archiveData(rootForBackup, outDir) {
  // backup.sh expects ROOT/data; we run it with custom --out and a custom ROOT
  // by invoking through cd into rootForBackup so its $(dirname $0)/.. resolves
  // correctly. Easiest: tar manually here, mirroring backup.sh's format.
  mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const archive = join(outDir, `inryoku-data-${ts}.tar.gz`);
  const r = sh('tar', ['-czf', archive, '-C', rootForBackup, 'data']);
  assert.equal(r.status, 0, `tar failed: ${r.stderr}`);
  // sha256
  const buf = readFileSync(archive);
  const sum = createHash('sha256').update(buf).digest('hex');
  writeFileSync(`${archive}.sha256`, `${sum}  ${archive.split('/').pop()}\n`);
  return archive;
}

function cleanup(...dirs) {
  for (const d of dirs) {
    if (d && existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
}

describe('backup → restore round-trip', () => {
  test('verify-data.mjs reports OK on a freshly seeded tree', () => {
    const root = makeTmpRoot();
    try {
      seedData(root);
      const r = sh('node', [VERIFY_MJS, '--root', root, '--json']);
      assert.equal(r.status, 0, `verify-data failed: ${r.stdout}\n${r.stderr}`);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.stats.subscribers, 2);
      assert.equal(out.stats.refs, 1);
      assert.equal(out.stats.greys, 1);
    } finally { cleanup(root); }
  });

  test('archive sha256 matches the bytes on disk', () => {
    const src = makeTmpRoot();
    const out = makeTmpRoot();
    try {
      seedData(src);
      const archive = archiveData(src, out);
      const sumLine = readFileSync(`${archive}.sha256`, 'utf8').trim();
      const recorded = sumLine.split(/\s+/)[0];
      const actual = createHash('sha256').update(readFileSync(archive)).digest('hex');
      assert.equal(recorded, actual);
    } finally { cleanup(src, out); }
  });

  test('restore.sh --dry-run does not touch the target', () => {
    const src = makeTmpRoot();
    const out = makeTmpRoot();
    const dst = makeTmpRoot();
    try {
      seedData(src);
      const archive = archiveData(src, out);
      // Pre-seed dst with sentinel content
      mkdirSync(join(dst, 'data'), { recursive: true });
      writeFileSync(join(dst, 'data', 'sentinel.txt'), 'do-not-touch');
      const r = sh('bash', [RESTORE_SH, archive, '--dry-run', '--target', dst]);
      assert.equal(r.status, 0, `restore --dry-run failed: ${r.stderr}`);
      assert.equal(readFileSync(join(dst, 'data', 'sentinel.txt'), 'utf8'), 'do-not-touch');
    } finally { cleanup(src, out, dst); }
  });

  test('restore.sh --force replaces data/ and post-verify passes', () => {
    const src = makeTmpRoot();
    const out = makeTmpRoot();
    const dst = makeTmpRoot();
    try {
      seedData(src);
      const archive = archiveData(src, out);
      // Pre-existing data/ in dst should be snapshotted, not silently lost
      mkdirSync(join(dst, 'data'), { recursive: true });
      writeFileSync(join(dst, 'data', 'old.txt'), 'old');

      const r = sh('bash', [RESTORE_SH, archive, '--force', '--target', dst]);
      assert.equal(r.status, 0, `restore failed: ${r.stdout}\n${r.stderr}`);

      // restored files present
      assert.ok(existsSync(join(dst, 'data', 'subscribers.json')));
      assert.ok(existsSync(join(dst, 'data', 'refs.json')));
      assert.ok(existsSync(join(dst, 'data', 'greys', '0001.json')));

      // subscribers.json content matches source
      const a = JSON.parse(readFileSync(join(src, 'data', 'subscribers.json'), 'utf8'));
      const b = JSON.parse(readFileSync(join(dst, 'data', 'subscribers.json'), 'utf8'));
      assert.deepEqual(a, b);

      // pre-restore snapshot exists
      const snaps = readdirSync(dst).filter(n => n.startsWith('data.pre-restore-'));
      assert.equal(snaps.length, 1, 'expected one pre-restore snapshot');

      // permissions readable by owner
      const st = statSync(join(dst, 'data', 'subscribers.json'));
      assert.ok((st.mode & 0o400) !== 0, 'owner-readable bit set');
    } finally { cleanup(src, out, dst); }
  });

  test('restore.sh refuses tampered archive (sha256 mismatch)', () => {
    const src = makeTmpRoot();
    const out = makeTmpRoot();
    const dst = makeTmpRoot();
    try {
      seedData(src);
      const archive = archiveData(src, out);
      // Tamper with a single byte
      const buf = readFileSync(archive);
      buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff;
      writeFileSync(archive, buf);

      const r = sh('bash', [RESTORE_SH, archive, '--force', '--target', dst]);
      assert.notEqual(r.status, 0, 'expected non-zero exit on sha mismatch');
      // dst/data should NOT have been created
      assert.equal(existsSync(join(dst, 'data')), false);
    } finally { cleanup(src, out, dst); }
  });

  test('verify-data.mjs detects corrupted JSON', () => {
    const root = makeTmpRoot();
    try {
      seedData(root);
      writeFileSync(join(root, 'data', 'subscribers.json'), '{not json');
      const r = sh('node', [VERIFY_MJS, '--root', root, '--json']);
      assert.notEqual(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, false);
      assert.ok(out.issues.some(i => /invalid JSON/.test(i.msg)));
    } finally { cleanup(root); }
  });

  test('verify-data.mjs detects missing required field', () => {
    const root = makeTmpRoot();
    try {
      seedData(root);
      const broken = { subscribers: [{ email: 'x@y.z', number: 1, token: 'short', created: '2026-04-27T00:00:00.000Z' }] };
      writeFileSync(join(root, 'data', 'subscribers.json'), JSON.stringify(broken));
      const r = sh('node', [VERIFY_MJS, '--root', root, '--json']);
      assert.notEqual(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.ok(out.issues.some(i => /token/.test(i.msg)));
    } finally { cleanup(root); }
  });

  test('verify-data.mjs detects duplicate subscriber numbers', () => {
    const root = makeTmpRoot();
    try {
      seedData(root);
      const subs = JSON.parse(readFileSync(join(root, 'data', 'subscribers.json'), 'utf8'));
      subs.subscribers[1].number = subs.subscribers[0].number;
      writeFileSync(join(root, 'data', 'subscribers.json'), JSON.stringify(subs));
      const r = sh('node', [VERIFY_MJS, '--root', root, '--json']);
      assert.notEqual(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.ok(out.issues.some(i => /duplicate number/.test(i.msg)));
    } finally { cleanup(root); }
  });

  test('data-stats.sh runs and reports counts', () => {
    const root = makeTmpRoot();
    try {
      seedData(root);
      const r = sh('bash', [join(REPO, 'scripts', 'data-stats.sh'), '--root', root]);
      assert.equal(r.status, 0, `data-stats failed: ${r.stderr}`);
      assert.match(r.stdout, /subscribers:\s+2/);
      assert.match(r.stdout, /refs:\s+1/);
      assert.match(r.stdout, /greys:\s+1/);
    } finally { cleanup(root); }
  });
});
