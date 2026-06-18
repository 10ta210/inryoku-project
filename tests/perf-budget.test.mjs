import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    loadBudget,
    validateBudget,
    measureBuffer,
    classify,
    estimateTransfer,
    estimateLcpTbt,
    runBudget,
    toMarkdown
} from '../scripts/perf-budget.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

test('perf-budget.json parses and matches schema expectations', () => {
    const b = loadBudget(resolve(ROOT, 'perf-budget.json'));
    assert.equal(typeof b.version, 'number');
    assert.ok(b.files && typeof b.files === 'object');
    assert.ok(Object.keys(b.files).length >= 10, 'expect a meaningful number of file budgets');

    for (const [k, v] of Object.entries(b.files)) {
        assert.ok(typeof v.max === 'number' && v.max > 0, `${k}.max positive number`);
    }
    assert.ok(b.groups && b.groups.js_total_excluding_three_and_p3);
    assert.ok(b.groups.css_total);
    assert.ok(b.groups.public_total);
});

test('validateBudget rejects malformed budget objects', () => {
    assert.throws(() => validateBudget(null));
    assert.throws(() => validateBudget({}));
    assert.throws(() => validateBudget({ version: 1 }));
    assert.throws(() => validateBudget({ version: 1, files: { 'x.js': { max: -1 } } }));
    assert.throws(() => validateBudget({
        version: 1,
        files: { 'x.js': { max: 100 } },
        groups: { g: { max: 1 } } // no members nor glob
    }));
    assert.equal(validateBudget({
        version: 1,
        files: { 'x.js': { max: 100 } },
        groups: { g: { max: 1, members: ['x.js'] } }
    }), true);
});

test('classify maps extensions to kinds', () => {
    assert.equal(classify('a.js'), 'js');
    assert.equal(classify('a.mjs'), 'js');
    assert.equal(classify('a.css'), 'css');
    assert.equal(classify('a.json'), 'json');
    assert.equal(classify('a.xml'), 'xml');
    assert.equal(classify('a.html'), 'html');
    assert.equal(classify('a.png'), 'bin');
});

test('measureBuffer returns raw, gzip, and brotli sizes', () => {
    const buf = Buffer.from('a'.repeat(2000));
    const m = measureBuffer(buf);
    assert.equal(m.raw, 2000);
    assert.ok(m.gzip > 0 && m.gzip < m.raw, 'gzip should compress repeating data');
    assert.ok(m.brotli > 0 && m.brotli < m.raw, 'brotli should compress repeating data');
});

test('estimateTransfer applies gzip ratios per kind', () => {
    const b = loadBudget(resolve(ROOT, 'perf-budget.json'));
    const js = estimateTransfer(10000, 'js', b);
    const bin = estimateTransfer(10000, 'bin', b);
    assert.ok(js < 10000, 'js compresses');
    assert.equal(bin, 10000, 'binary stays same');
});

test('estimateLcpTbt produces non-negative numeric estimates', () => {
    const b = loadBudget(resolve(ROOT, 'perf-budget.json'));
    const r = estimateLcpTbt(50000, b);
    assert.ok(typeof r.transferMs === 'number' && r.transferMs >= 0);
    assert.ok(typeof r.tbtMs === 'number' && r.tbtMs >= 0);
});

test('runBudget output has the required shape', () => {
    const report = runBudget();
    assert.equal(typeof report.ok, 'boolean');
    assert.ok(Array.isArray(report.files));
    assert.ok(Array.isArray(report.groups));
    assert.ok(Array.isArray(report.violations));
    assert.ok(report.summary && typeof report.summary.fileCount === 'number');
    assert.ok(typeof report.timestamp === 'string');
    for (const f of report.files) {
        assert.ok(typeof f.path === 'string');
        assert.ok(typeof f.max === 'number');
        if (f.exists) {
            assert.ok(typeof f.raw === 'number');
            assert.ok(typeof f.gzip === 'number');
            assert.ok(typeof f.brotli === 'number');
            assert.ok(f.transferEstimate >= 0);
            assert.ok(f.lcpTbtEstimate.tbtMs >= 0);
        }
    }
});

test('toMarkdown renders a non-empty markdown report with required sections', () => {
    const report = runBudget();
    const md = toMarkdown(report);
    assert.match(md, /# inryokü — performance budget report/);
    assert.match(md, /## Files/);
    assert.match(md, /Status: \*\*(PASS|FAIL)\*\*/);
});

test('all current production files are within their per-file budget', () => {
    const report = runBudget();
    const fileViolations = report.violations.filter(v => v.kind === 'file' || v.kind === 'missing');
    if (fileViolations.length) {
        const detail = fileViolations.map(v => JSON.stringify(v)).join('\n');
        assert.fail(`per-file budget violations:\n${detail}`);
    }
});

test('all current production groups are within their group budget', () => {
    const report = runBudget();
    const groupViolations = report.violations.filter(v => v.kind === 'group');
    if (groupViolations.length) {
        const detail = groupViolations.map(v => JSON.stringify(v)).join('\n');
        assert.fail(`group budget violations:\n${detail}`);
    }
});

test('runBudget overall ok is true for current repo state', () => {
    const report = runBudget();
    assert.equal(report.ok, true, `unexpected violations: ${JSON.stringify(report.violations)}`);
});
