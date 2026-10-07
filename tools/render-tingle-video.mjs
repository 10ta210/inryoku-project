#!/usr/bin/env node
// tools/render-tingle-video.mjs — Tingle の譜面を「音 + 同期映像」の MP4 に書き出す
//
// 1. ヘッドレス Chromium の OfflineAudioContext で音を書き出す (HP と同じエンジン)
// 2. 同じエンジンが残したイベント / 状態で、tingle-visual.js を 1 フレームずつ描く
//    (実時間ではなく時刻を指定して描くので、遅いマシンでも音と 1 フレームもずれない)
// 3. ffmpeg で JPEG 連番 + 音を MP4 (H.264 / AAC) に
//
//   node tools/render-tingle-video.mjs [--headphones] [--size=1080] [--fps=30] [--score=frisson101] [--at=sec,...] [out.mp4]
//
//   既定はスピーカー版 (SNS / スマホで見る前提)。--at=秒,秒 はその時刻のフレームを PNG で書き出す (見た目の確認用)。

import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { ROOT, openPage, renderScore, wav16, masterChain } from './tingle-render-lib.mjs';

const argv = process.argv.slice(2);
const opt = (name, def) => {
    const a = argv.find((x) => x.startsWith(`--${name}=`));
    return a ? a.split('=')[1] : def;
};
const output = argv.includes('--headphones') ? 'headphones' : 'speakers';
const size = Number(opt('size', 1080));
const fps = Number(opt('fps', 30));
const id = opt('score', 'frisson101');
const at = opt('at', null);
const NAMES = { full: '00_full', particles: '01_particles', brushTap: '02_brush_tap', frisson101: '03_frisson_101' };
const out = resolve(
    argv.find((a) => !a.startsWith('--')) ||
        join(ROOT, 'audio', 'tingle', `inryoku_tingle_${NAMES[id] || id}${output === 'speakers' ? '_spk' : ''}.${at ? 'png' : 'mp4'}`)
);

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>render</title>
<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js"}}</script>
<style>html,body{margin:0;background:#000}canvas{display:block}</style></head>
<body><canvas id="c" width="${size}" height="${size}" style="width:${size}px;height:${size}px"></canvas></body></html>`;

const t0 = Date.now();
const { browser, page } = await openPage({ webgl: true, html, viewport: { width: size, height: size } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));

// 1) 音
const res = await renderScore(page, { id, output, keep: true });
console.log(`audio: ${res.title} [${output}] ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// 2) 映像の準備
await page.evaluate(async ({ size }) => {
    const { createTingleVisual } = await import('/tingle-visual.js');
    const vis = createTingleVisual({ canvas: document.getElementById('c'), eng: window.__eng, pixelRatio: 1, preserve: true });
    vis.resize(size, size);
    window.__vis = vis;
}, { size });

const grab = (times, type) =>
    page.evaluate(
        ({ times, type }) =>
            times.map((t) => {
                window.__vis.render(t);
                return document.getElementById('c').toDataURL(type, 0.92).split(',')[1];
            }),
        { times, type }
    );

mkdirSync(dirname(out), { recursive: true });

if (at !== null) {
    // 確認用: --at=2,9.5,14.4 の各時刻を PNG に (時刻順に描くので、間のイベントも積まれる)
    const targets = at.split(',').map(Number).sort((a, b) => a - b);
    for (const target of targets) {
        const [png] = await grab([target], 'image/png');
        const file = out.replace(/\.png$/, `_${target}s.png`);
        writeFileSync(file, Buffer.from(png, 'base64'));
        console.log(`frame @${target}s → ${file}`);
    }
    await browser.close();
    process.exit(0);
}

// 音をマスタリングして一時 WAV に
const raw = wav16(res.channels);
const { chain } = masterChain(raw, output);
const tmp = mkdtempSync(join(tmpdir(), 'tingle-'));
const wavPath = join(tmp, 'audio.wav');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'pipe:0', '-af', chain, '-c:a', 'pcm_s16le', wavPath], { input: raw });

// 3) フレーム → ffmpeg
const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-i', wavPath,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
    out,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((ok, ng) => ff.on('close', (code) => (code === 0 ? ok() : ng(new Error(`ffmpeg ${code}`)))));
const write = (buf) => new Promise((ok) => (ff.stdin.write(buf) ? ok() : ff.stdin.once('drain', ok)));

const frames = Math.ceil(res.dur * fps);
const BATCH = 12;
for (let f = 0; f < frames; f += BATCH) {
    const times = [];
    for (let k = f; k < Math.min(frames, f + BATCH); k++) times.push(k / fps);
    const jpgs = await grab(times, 'image/jpeg');
    for (const j of jpgs) await write(Buffer.from(j, 'base64'));
    if (f % (fps * 5) < BATCH) process.stdout.write(`  ${(f / fps).toFixed(0)}s / ${res.dur}s\r`);
}
ff.stdin.end();
await done;
await browser.close();
console.log(`video → ${out}  (${frames} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
