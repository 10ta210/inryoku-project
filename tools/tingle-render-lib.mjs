// tools/tingle-render-lib.mjs — Tingle 書き出しツール共通 (音: render-tingle / 映像: render-tingle-video)
//
// ヘッドレス Chromium の OfflineAudioContext で、HP で鳴るのと同じエンジンを鳴らす。
// file:// では ES module が読めないので、仮想 origin http://tingle.local でリポジトリを配る。

import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'http://tingle.local';
export const SR = 48000;

// 出力ごとの目標ラウドネス: ヘッドホンは ASMR として静かめ、スピーカーは小さな端末でも聞こえる大きさ
export const TARGET_LUFS = { headphones: -21, speakers: -16 };

export function loadPlaywright() {
    const require = createRequire(import.meta.url);
    try {
        return require('playwright');
    } catch {
        const globalRoot = execFileSync('npm', ['root', '-g']).toString().trim();
        return require(join(globalRoot, 'playwright'));
    }
}

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css' };

/** ブラウザを起動し、仮想 origin でリポジトリを配るページを返す */
export async function openPage({ webgl = false, html = '<!DOCTYPE html><title>render</title>', viewport } = {}) {
    const { chromium } = loadPlaywright();
    const args = ['--autoplay-policy=no-user-gesture-required'];
    if (webgl) args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist');
    const browser = await chromium.launch({ args });
    const page = await browser.newPage(viewport ? { viewport } : {});
    await page.route(`${ORIGIN}/**`, (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/') return route.fulfill({ contentType: 'text/html', body: html });
        return route.fulfill({
            contentType: TYPES[extname(path)] || 'application/octet-stream',
            body: readFileSync(join(ROOT, decodeURIComponent(path))),
        });
    });
    await page.goto(`${ORIGIN}/`);
    return { browser, page };
}

/**
 * ページ内で譜面をオフライン書き出しする。-1 dBFS に正規化した Float32 2ch を返す。
 * keep=true ならエンジンを window.__eng に残す (映像が同じ状態・イベントを読むため)。
 */
export async function renderScore(page, { id, output = 'headphones', keep = false }) {
    const res = await page.evaluate(
        async ({ id, output, keep, SR }) => {
            const { createTingle, SCORES } = await import('/inryoku-tingle.js');
            const score = SCORES[id];
            const ctx = new OfflineAudioContext(2, Math.ceil(score.dur * SR), SR);
            const eng = createTingle(ctx, { seed: score.seed, output, events: keep });
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
            if (keep) window.__eng = eng;
            const ch = [out.getChannelData(0), out.getChannelData(1)];
            let peak = 0;
            for (const c of ch) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
            const norm = peak > 0 ? 0.891 / peak : 1;
            const toB64 = (c) => {
                const f = new Float32Array(c.length);
                for (let i = 0; i < c.length; i++) f[i] = c[i] * norm;
                const bytes = new Uint8Array(f.buffer);
                let s = '';
                for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                return btoa(s);
            };
            return { title: score.title, dur: score.dur, peak, norm, L: toB64(ch[0]), R: toB64(ch[1]) };
        },
        { id, output, keep, SR }
    );
    const toF32 = (b64) => {
        const b = Buffer.from(b64, 'base64');
        return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
    };
    return { title: res.title, dur: res.dur, peak: res.peak, norm: res.norm, channels: [toF32(res.L), toF32(res.R)] };
}

export function wav16(channels, sr = SR) {
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

/** 統合ラウドネス (LUFS) を ffmpeg で測る */
export function measureLufs(wav) {
    const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', 'pipe:0', '-af', 'ebur128', '-f', 'null', '-'], {
        input: wav,
    });
    const m = run.stderr.toString().split('Summary:')[1]?.match(/I:\s+(-?[\d.]+) LUFS/);
    return m ? Number(m[1]) : null;
}

/**
 * マスタリングの ffmpeg フィルタ: 目標ラウドネスまで持ち上げ → ルックアヘッド・リミッター (-1.5 dBFS)。
 * 削れるのは「たまに強い粒」の頭だけで、溜め → 間 → 開花のダイナミクスは残る。
 */
export function masterChain(wav, output) {
    const lufs = measureLufs(wav) ?? -28;
    const gain = Math.max(0, TARGET_LUFS[output] - lufs);
    return { lufs, gain, chain: `volume=${gain.toFixed(1)}dB,alimiter=limit=0.84:attack=1.5:release=60:level=disabled` };
}
