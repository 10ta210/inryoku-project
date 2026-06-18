#!/usr/bin/env node
// scripts/perf-budget.mjs
// Performance budget enforcer for inryokü.
// Reads perf-budget.json, measures current asset sizes (raw / gzip / brotli),
// compares against thresholds, emits JSON + Markdown reports, and exits 1 on violations.
//
// Usage:
//   node scripts/perf-budget.mjs                   # human + machine output, exit 1 if over budget
//   node scripts/perf-budget.mjs --json            # JSON only to stdout
//   node scripts/perf-budget.mjs --markdown        # Markdown only to stdout
//   node scripts/perf-budget.mjs --out-dir build/  # write report files there
//   node scripts/perf-budget.mjs --no-fail         # report but never exit non-zero
//
// No external deps. Uses node:zlib for gzip / brotli sizing.

import { readFileSync, statSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------- pure helpers (exported for tests) ----------

export function loadBudget(budgetPath = resolve(ROOT, 'perf-budget.json')) {
    const raw = readFileSync(budgetPath, 'utf8');
    const json = JSON.parse(raw);
    validateBudget(json);
    return json;
}

export function validateBudget(b) {
    if (!b || typeof b !== 'object') throw new Error('budget must be an object');
    if (typeof b.version !== 'number') throw new Error('budget.version must be a number');
    if (!b.files || typeof b.files !== 'object') throw new Error('budget.files must be an object');
    for (const [k, v] of Object.entries(b.files)) {
        if (!v || typeof v.max !== 'number' || v.max <= 0) {
            throw new Error(`budget.files["${k}"].max must be a positive number`);
        }
    }
    if (b.groups) {
        for (const [k, v] of Object.entries(b.groups)) {
            if (typeof v.max !== 'number' || v.max <= 0) {
                throw new Error(`budget.groups["${k}"].max must be a positive number`);
            }
            if (!v.members && !v.glob) {
                throw new Error(`budget.groups["${k}"] must define members or glob`);
            }
        }
    }
    return true;
}

export function classify(filename) {
    const ext = extname(filename).toLowerCase();
    if (ext === '.js' || ext === '.mjs') return 'js';
    if (ext === '.css') return 'css';
    if (ext === '.json') return 'json';
    if (ext === '.xml') return 'xml';
    if (ext === '.html' || ext === '.htm') return 'html';
    return 'bin';
}

export function measureBuffer(buf) {
    const raw = buf.length;
    let gzip = 0, brotli = 0;
    try { gzip = gzipSync(buf, { level: 9 }).length; } catch { gzip = 0; }
    try {
        brotli = brotliCompressSync(buf, {
            params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 }
        }).length;
    } catch { brotli = 0; }
    return { raw, gzip, brotli };
}

export function measureFile(absPath) {
    if (!existsSync(absPath)) return null;
    const st = statSync(absPath);
    if (!st.isFile()) return null;
    const buf = readFileSync(absPath);
    return measureBuffer(buf);
}

export function walkDir(absDir) {
    const out = [];
    if (!existsSync(absDir)) return out;
    const stack = [absDir];
    while (stack.length) {
        const dir = stack.pop();
        for (const ent of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, ent.name);
            if (ent.isDirectory()) stack.push(p);
            else if (ent.isFile()) out.push(p);
        }
    }
    return out;
}

export function estimateTransfer(rawBytes, kind, budget) {
    const cfg = budget.transferEstimate || {};
    const compression = cfg.compression || 'gzip';
    const ratios = compression === 'brotli'
        ? (cfg.brotliRatios || {})
        : (cfg.gzipRatios || {});
    const ratio = ratios[kind] ?? 1;
    return Math.round(rawBytes * ratio);
}

export function estimateLcpTbt(transferBytes, budget) {
    const cfg = budget.lcpTbtImpact || {};
    const kbps = cfg.transferKBps || 50;
    const tbtPerKB = cfg.tbtPerKB_ms || 1.2;
    const kb = transferBytes / 1024;
    const transferMs = Math.round((kb / kbps) * 1000);
    const tbtMs = Math.round(kb * tbtPerKB);
    return { transferMs, tbtMs };
}

export function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ---------- core run ----------

export function runBudget({ root = ROOT, budget } = {}) {
    if (!budget) budget = loadBudget(resolve(root, 'perf-budget.json'));

    const fileResults = [];
    const violations = [];

    for (const [rel, spec] of Object.entries(budget.files)) {
        const abs = resolve(root, rel);
        const m = measureFile(abs);
        if (!m) {
            fileResults.push({
                path: rel, exists: false, max: spec.max,
                raw: 0, gzip: 0, brotli: 0, ok: false, missing: true
            });
            violations.push({ kind: 'missing', path: rel });
            continue;
        }
        const kind = classify(rel);
        const transfer = estimateTransfer(m.raw, kind, budget);
        const impact = estimateLcpTbt(transfer, budget);
        const ok = m.raw <= spec.max;
        fileResults.push({
            path: rel, exists: true, kind,
            raw: m.raw, gzip: m.gzip, brotli: m.brotli,
            max: spec.max, ok,
            pct: Math.round((m.raw / spec.max) * 100),
            transferEstimate: transfer,
            lcpTbtEstimate: impact,
            note: spec.note || ''
        });
        if (!ok) {
            violations.push({
                kind: 'file', path: rel, raw: m.raw, max: spec.max,
                over: m.raw - spec.max
            });
        }
    }

    const groupResults = [];
    for (const [name, spec] of Object.entries(budget.groups || {})) {
        let total = 0;
        let totalGzip = 0;
        let totalBrotli = 0;
        const members = [];
        if (spec.members) {
            for (const rel of spec.members) {
                const abs = resolve(root, rel);
                const m = measureFile(abs);
                if (m) {
                    total += m.raw; totalGzip += m.gzip; totalBrotli += m.brotli;
                    members.push({ path: rel, raw: m.raw });
                }
            }
        } else if (spec.glob) {
            // limited glob support: prefix/**/* style
            const m = spec.glob.match(/^(.+?)\/\*\*\/\*$/);
            const dir = m ? resolve(root, m[1]) : resolve(root, spec.glob);
            for (const f of walkDir(dir)) {
                const meas = measureFile(f);
                if (meas) {
                    total += meas.raw; totalGzip += meas.gzip; totalBrotli += meas.brotli;
                    members.push({ path: relative(root, f), raw: meas.raw });
                }
            }
        }
        const ok = total <= spec.max;
        groupResults.push({
            name, max: spec.max, raw: total,
            gzip: totalGzip, brotli: totalBrotli,
            pct: Math.round((total / spec.max) * 100),
            ok, members, note: spec.note || ''
        });
        if (!ok) {
            violations.push({
                kind: 'group', name, raw: total, max: spec.max,
                over: total - spec.max
            });
        }
    }

    return {
        ok: violations.length === 0,
        timestamp: new Date().toISOString(),
        files: fileResults,
        groups: groupResults,
        violations,
        summary: {
            fileCount: fileResults.length,
            groupCount: groupResults.length,
            violationCount: violations.length,
            totalRaw: fileResults.reduce((a, f) => a + (f.raw || 0), 0),
            totalGzip: fileResults.reduce((a, f) => a + (f.gzip || 0), 0),
            totalBrotli: fileResults.reduce((a, f) => a + (f.brotli || 0), 0)
        }
    };
}

export function toMarkdown(report) {
    const lines = [];
    lines.push('# inryokü — performance budget report');
    lines.push('');
    lines.push(`Generated: ${report.timestamp}`);
    lines.push('');
    lines.push(`Status: **${report.ok ? 'PASS' : 'FAIL'}** (${report.summary.violationCount} violations)`);
    lines.push('');
    lines.push(`Total raw: ${formatBytes(report.summary.totalRaw)} | gzip: ${formatBytes(report.summary.totalGzip)} | brotli: ${formatBytes(report.summary.totalBrotli)}`);
    lines.push('');
    lines.push('## Files');
    lines.push('');
    lines.push('| File | Raw | Gzip | Brotli | Budget | % | Transfer~ | TBT~ | Status |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|:---:|');
    for (const f of report.files) {
        if (!f.exists) {
            lines.push(`| \`${f.path}\` | — | — | — | ${formatBytes(f.max)} | — | — | — | MISSING |`);
            continue;
        }
        lines.push(`| \`${f.path}\` | ${formatBytes(f.raw)} | ${formatBytes(f.gzip)} | ${formatBytes(f.brotli)} | ${formatBytes(f.max)} | ${f.pct}% | ${formatBytes(f.transferEstimate)} | ${f.lcpTbtEstimate.tbtMs}ms | ${f.ok ? 'ok' : 'OVER'} |`);
    }
    if (report.groups.length) {
        lines.push('');
        lines.push('## Groups');
        lines.push('');
        lines.push('| Group | Raw | Gzip | Brotli | Budget | % | Status |');
        lines.push('|---|---:|---:|---:|---:|---:|:---:|');
        for (const g of report.groups) {
            lines.push(`| ${g.name} | ${formatBytes(g.raw)} | ${formatBytes(g.gzip)} | ${formatBytes(g.brotli)} | ${formatBytes(g.max)} | ${g.pct}% | ${g.ok ? 'ok' : 'OVER'} |`);
        }
    }
    if (report.violations.length) {
        lines.push('');
        lines.push('## Violations');
        lines.push('');
        for (const v of report.violations) {
            if (v.kind === 'missing') {
                lines.push(`- MISSING: \`${v.path}\``);
            } else if (v.kind === 'file') {
                lines.push(`- FILE \`${v.path}\` — ${formatBytes(v.raw)} > ${formatBytes(v.max)} (over by ${formatBytes(v.over)})`);
            } else {
                lines.push(`- GROUP \`${v.name}\` — ${formatBytes(v.raw)} > ${formatBytes(v.max)} (over by ${formatBytes(v.over)})`);
            }
        }
    }
    lines.push('');
    return lines.join('\n');
}

// ---------- CLI ----------

function parseArgs(argv) {
    const out = { json: false, markdown: false, outDir: null, fail: true };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') out.json = true;
        else if (a === '--markdown') out.markdown = true;
        else if (a === '--no-fail') out.fail = false;
        else if (a === '--out-dir') out.outDir = argv[++i];
    }
    return out;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const report = runBudget();

    if (args.outDir) {
        mkdirSync(args.outDir, { recursive: true });
        writeFileSync(join(args.outDir, 'perf-budget.json'), JSON.stringify(report, null, 2));
        writeFileSync(join(args.outDir, 'perf-budget.md'), toMarkdown(report));
    }

    if (args.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else if (args.markdown) {
        process.stdout.write(toMarkdown(report) + '\n');
    } else {
        // Human summary.
        const status = report.ok ? 'PASS' : 'FAIL';
        process.stdout.write(`perf-budget: ${status} — ${report.summary.violationCount} violations, ${report.summary.fileCount} files, ${report.summary.groupCount} groups\n`);
        for (const f of report.files) {
            const s = !f.exists ? 'MISSING' : (f.ok ? 'ok' : 'OVER');
            const raw = f.exists ? formatBytes(f.raw) : '—';
            const gz = f.exists ? formatBytes(f.gzip) : '—';
            process.stdout.write(`  [${s}] ${f.path}: ${raw} (gzip ${gz}) / ${formatBytes(f.max)} (${f.pct ?? '—'}%)\n`);
        }
        for (const g of report.groups) {
            const s = g.ok ? 'ok' : 'OVER';
            process.stdout.write(`  [${s}] group ${g.name}: ${formatBytes(g.raw)} / ${formatBytes(g.max)} (${g.pct}%)\n`);
        }
        if (report.violations.length) {
            process.stdout.write('\nViolations:\n');
            for (const v of report.violations) {
                process.stdout.write(`  - ${JSON.stringify(v)}\n`);
            }
        }
    }

    if (!report.ok && args.fail) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
