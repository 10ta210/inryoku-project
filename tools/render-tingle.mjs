#!/usr/bin/env node
// tools/render-tingle.mjs — inryoku-tingle.js の譜面を WAV / MP3 に書き出す
//
// ヘッドレス Chromium の OfflineAudioContext で、HP で鳴るのと同じエンジン・
// 同じ HRTF で書き出す (ブラウザの音 = 書き出した音)。
//
//   node tools/render-tingle.mjs [--speakers] [outDir] [scoreId ...]
//
//   --speakers  スピーカー向けモードで書き出す (ファイル名に _spk)
//
// 依存: playwright (グローバル可), ffmpeg (マスタリングと MP3 変換、無ければ正規化 WAV のみ)

import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { ROOT, openPage, renderScore, wav16, masterChain } from './tingle-render-lib.mjs';

const argv = process.argv.slice(2);
const output = argv.includes('--speakers') ? 'speakers' : 'headphones';
const rest = argv.filter((a) => !a.startsWith('--'));
const outDir = resolve(rest[0] || join(ROOT, 'audio', 'tingle'));
const only = rest.slice(1);
const NAMES = { full: '00_full', particles: '01_particles', brushTap: '02_brush_tap', frisson101: '03_frisson_101' };

const { browser, page } = await openPage();
const ids = await page.evaluate(async () => Object.keys((await import('/inryoku-tingle.js')).SCORES));

mkdirSync(outDir, { recursive: true });
for (const id of ids) {
    if (only.length && !only.includes(id)) continue;
    const t0 = Date.now();
    const res = await renderScore(page, { id, output });
    const suffix = output === 'speakers' ? '_spk' : '';
    const wavPath = join(outDir, `inryoku_tingle_${NAMES[id] || id}${suffix}.wav`);
    const raw = wav16(res.channels);
    let note = 'raw (ffmpeg なし)';
    try {
        const { lufs, gain, chain } = masterChain(raw, output);
        const ff = (out, codec) =>
            execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'pipe:0', '-af', chain, ...codec, out], { input: raw });
        ff(wavPath, ['-c:a', 'pcm_s16le']);
        ff(wavPath.replace(/\.wav$/, '.mp3'), ['-c:a', 'libmp3lame', '-b:a', '256k']);
        note = `${lufs.toFixed(1)} → +${gain.toFixed(1)}dB, wav + mp3`;
    } catch {
        writeFileSync(wavPath, raw);
    }
    console.log(
        `${res.title} [${output}]\n  peak ${(20 * Math.log10(res.peak)).toFixed(1)} dBFS  ${((Date.now() - t0) / 1000).toFixed(1)}s  → ${wavPath.split('/').pop().replace(/\.wav$/, '')} (${note})`
    );
}
await browser.close();
