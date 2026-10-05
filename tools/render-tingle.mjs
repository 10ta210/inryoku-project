#!/usr/bin/env node
// tools/render-tingle.mjs — inryoku-tingle.js の譜面を WAV / MP3 に書き出す
//
// ヘッドレス Chromium の OfflineAudioContext で、HP で鳴るのと同じエンジン・
// 同じ HRTF で書き出す (ブラウザの音 = 書き出した音)。
//
//   node tools/render-tingle.mjs [outDir] [scoreId ...]
//
// 依存: playwright (グローバル可), ffmpeg (MP3 変換、無ければ WAV のみ)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.argv[2] || join(ROOT, 'audio', 'tingle'));
const only = process.argv.slice(3);
const SR = 48000;

function loadPlaywright() {
    const require = createRequire(import.meta.url);
    try {
        return require('playwright');
    } catch {
        const globalRoot = execFileSync('npm', ['root', '-g']).toString().trim();
        return require(join(globalRoot, 'playwright'));
    }
}

function wav16(channels, sr) {
    const n = channels[0].length;
    const buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + n * 4, 4);
    buf.write('WAVEfmt ', 8);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 4, 28);
    buf.writeUInt16LE(4, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) {
        for (let c = 0; c < 2; c++) {
            const v = Math.max(-1, Math.min(1, channels[c][i]));
            buf.writeInt16LE(Math.round(v * 32767), 44 + i * 4 + c * 2);
        }
    }
    return buf;
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
// file:// では ES module が読めないので、仮想 origin でリポジトリを配る
await page.route('http://tingle.local/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><title>render</title>' });
    return route.fulfill({ contentType: 'text/javascript', body: readFileSync(join(ROOT, path)) });
});
await page.goto('http://tingle.local/');

const ids = await page.evaluate(async () => {
    const m = await import('/inryoku-tingle.js');
    return Object.keys(m.SCORES);
});

mkdirSync(outDir, { recursive: true });
for (const id of ids) {
    if (only.length && !only.includes(id)) continue;
    const t0 = Date.now();
    const res = await page.evaluate(
        async ({ id, SR }) => {
            const { createTingle, SCORES } = await import('/inryoku-tingle.js');
            const score = SCORES[id];
            const ctx = new OfflineAudioContext(2, Math.ceil(score.dur * SR), SR);
            const eng = createTingle(ctx, { seed: score.seed });
            score.build(eng, 0);
            // ライブと同じく先読み計画で少しずつ組む (全ノードを先に作ると遅い)
            for (let t = 0.25; t < score.dur; t += 0.25) {
                ctx.suspend(t).then(() => {
                    eng.plan(Math.min(score.dur, t + 0.5));
                    ctx.resume();
                });
            }
            eng.plan(0.5);
            const out = await ctx.startRendering();
            const ch = [out.getChannelData(0), out.getChannelData(1)];
            let peak = 0;
            for (const c of ch) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
            // -1 dBFS に正規化 (ダイナミクスはそのまま)
            const norm = peak > 0 ? 0.891 / peak : 1;
            const toB64 = (c) => {
                const f = new Float32Array(c.length);
                for (let i = 0; i < c.length; i++) f[i] = c[i] * norm;
                const bytes = new Uint8Array(f.buffer);
                let s = '';
                for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                return btoa(s);
            };
            return { title: score.title, peak, norm, L: toB64(ch[0]), R: toB64(ch[1]) };
        },
        { id, SR }
    );
    const toF32 = (b64) => {
        const b = Buffer.from(b64, 'base64');
        return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
    };
    const name = { full: '00_full', particles: '01_particles', brushTap: '02_brush_tap', frisson101: '03_frisson_101' }[id] || id;
    const wavPath = join(outDir, `inryoku_tingle_${name}.wav`);
    const raw = wav16([toF32(res.L), toF32(res.R)], SR);
    let mastered = 'raw';
    try {
        // 軽いマスタリング: +7dB → ルックアヘッド・リミッター (-1.5 dBFS)。
        // 削れるのは「たまに強い粒」の頭だけで、溜め → 間 → 開花のダイナミクスは残る。
        const chain = 'volume=7dB,alimiter=limit=0.84:attack=1.5:release=60:level=disabled';
        const ff = (out, codec) =>
            execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'pipe:0', '-af', chain, ...codec, out], { input: raw });
        ff(wavPath, ['-c:a', 'pcm_s16le']);
        ff(wavPath.replace(/\.wav$/, '.mp3'), ['-c:a', 'libmp3lame', '-b:a', '256k']);
        mastered = 'wav + mp3';
    } catch {
        // ffmpeg なし: 正規化だけの WAV
        writeFileSync(wavPath, raw);
    }
    console.log(
        `${res.title}\n  peak ${(20 * Math.log10(res.peak)).toFixed(1)} dBFS (norm x${res.norm.toFixed(2)})  ${((Date.now() - t0) / 1000).toFixed(1)}s  → ${wavPath.split('/').pop().replace(/\.wav$/, '')} (${mastered})`
    );
}
await browser.close();
