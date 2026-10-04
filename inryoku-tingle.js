// inryoku-tingle.js — inryokü Tingle Engine (近接バイノーラル粒子音)
// ESM, no build, no external libs. Raw Web Audio API.
//
// 「脳イキ」(ASMR tingle) と frisson (音楽の鳥肌) が起きる条件を、
// 声・息・口の音を一切使わずに組み直したエンジン:
//   1. 近接     — 耳元 10〜30cm に HRTF 定位 + 近接 ILD 補強 + 低域の近接効果 + ドライ
//   2. 粒子     — 2〜9kHz の微小トランジェント (帯域ノイズ = グレーの粒)
//   3. 半予測   — 密度は一定、タイミングと位置はランダム (Poisson) + たまに強い粒
//   4. 接近→間→開花 — looming で期待を溜め、無音で裏切り、RGBCMY が頭の周りに灯る
//
// 任意の BaseAudioContext で動く (AudioContext / OfflineAudioContext)。
// 全 API は絶対時刻 at (ctx 秒) を取る。ライブでは clock() が先読みで計画し、
// オフラインでは plan(end) を一度呼んでから startRendering() する
// (tools/render-tingle.mjs が同じ譜面を WAV に書き出す)。
//
// iOS contract: AudioContext はユーザー操作ハンドラの中で作ってから渡すこと。
//
// 座標: azimuth は度・連続値 (wrap しない)。0 = 正面, 90 = 右耳, -90 = 左耳,
//       ±180 = 後ろ。elevation は度 (+ が上)。dist はメートル。

const DEG = Math.PI / 180;

// RGBCMY → 音高 (cosmos-audio.js の 17 canon と同じ割当: RGB 低 / CMY 高)
export const RGBCMY = {
    R: 261.63, // C4
    G: 329.63, // E4
    B: 392.0, // G4
    C: 440.0, // A4
    M: 493.88, // B4
    Y: 587.33, // D5
};
const KEYS = 'RGBCMY';
// 色相環の並びで頭の周りに配置 (R 正面から時計回り)
const WHEEL = [['R', 0], ['Y', 60], ['G', 120], ['C', 180], ['B', 240], ['M', 300]];

const ROOT = 110; // A2 — cosmos-audio-harmonic.js と同じ基音
const CLOUD_HZ = 15; // 粒子雲の位置更新レート
const LOOKAHEAD = 0.3; // ライブ時の先読み (秒)

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// 折れ線タイムライン。to() は後勝ち (at 以降のキーを捨てて書き直す)。
function timeline(v0) {
    const keys = [{ t: -Infinity, v: v0 }];
    function at(t) {
        for (let i = keys.length - 1; i >= 0; i--) {
            const k = keys[i];
            if (t < k.t) continue;
            const n = keys[i + 1];
            if (!n || !Number.isFinite(k.t)) return k.v;
            return k.v + (n.v - k.v) * ((t - k.t) / (n.t - k.t));
        }
        return keys[0].v;
    }
    function to(t0, dur, v) {
        const start = at(t0);
        while (keys.length > 1 && keys[keys.length - 1].t >= t0) keys.pop();
        keys.push({ t: t0, v: start }, { t: t0 + Math.max(dur, 1e-3), v });
    }
    return { at, to };
}

// 数値 | 関数(t) | timeline | [[相対秒, 値], ...] を時刻 t の値に
function valueAt(x, t) {
    if (typeof x === 'number') return x;
    if (typeof x === 'function') return x(t);
    return x.at(t);
}
function keyframes(t0, spec) {
    if (!Array.isArray(spec)) return spec;
    const tl = timeline(spec[0][1]);
    let prev = spec[0];
    for (let i = 1; i < spec.length; i++) {
        tl.to(t0 + prev[0], spec[i][0] - prev[0], spec[i][1]);
        prev = spec[i];
    }
    return tl;
}

// 宇宙の残響: 手続き生成の指数減衰ノイズ (時間とともに高域が先に消える)
function makeImpulse(ctx, seconds, rnd) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    const pre = Math.floor(sr * 0.025);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = pre; i < len; i++) {
            const t = (i - pre) / sr;
            const k = 0.12 + 0.85 * Math.exp(-t * 1.4);
            lp += k * (rnd() * 2 - 1 - lp);
            d[i] = lp * Math.exp((-6.9 * t) / seconds);
        }
    }
    // 左右のエネルギーを揃える (片側に寄った残響にしない)
    const energy = [0, 1].map((ch) => buf.getChannelData(ch).reduce((a, v) => a + v * v, 0));
    const ref = Math.sqrt((energy[0] + energy[1]) / 2);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        const k = ref / Math.sqrt(energy[ch]);
        for (let i = 0; i < len; i++) d[i] *= k;
    }
    return buf;
}

/**
 * @param {BaseAudioContext} ctx
 * @param {object} [opts]
 * @param {number} [opts.gain]  master gain (0..1)
 * @param {number} [opts.seed]  乱数 seed (同じ譜面 = 同じ音)
 * @param {AudioNode} [opts.destination]
 */
export function createTingle(ctx, opts = {}) {
    const cfg = { gain: 0.8, seed: 101, emitters: 8, destination: ctx.destination, ...opts };
    const live = typeof OfflineAudioContext === 'undefined' || !(ctx instanceof OfflineAudioContext);
    const rnd = mulberry32(cfg.seed);
    const r = (a, b) => a + (b - a) * rnd();
    const rlog = (a, b) => a * Math.pow(b / a, rnd());
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

    // ── master: dry(近接) + wet(宇宙) → limiter → master ──
    const master = ctx.createGain();
    master.gain.value = cfg.gain;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    const dry = ctx.createGain();
    const send = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx, 4.2, rnd);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    send.connect(verb);
    verb.connect(wet);
    wet.connect(limiter);
    dry.connect(limiter);
    limiter.connect(master);
    master.connect(cfg.destination);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    {
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    }

    // 10cm で 1、2m 以上で 0 (対数)
    const nearness = (dist) => clamp(1 - Math.log(dist / 0.1) / Math.log(20), 0, 1);
    const distGain = (dist) => Math.min(2.2, 0.3 / Math.max(dist, 0.05));
    const setP = (param, t, v, ramp) =>
        ramp ? param.linearRampToValueAtTime(v, t) : param.setValueAtTime(v, t);

    // ── 空間ボイス: HRTF + 近接 ILD 補強 + 近接効果 + 距離に応じた残響 ──
    function makeVoice(wetBase = 0.04) {
        const input = ctx.createGain();
        const shelf = ctx.createBiquadFilter();
        shelf.type = 'lowshelf';
        shelf.frequency.value = 220;
        const pan = ctx.createPanner();
        pan.panningModel = 'HRTF';
        pan.distanceModel = 'linear';
        pan.rolloffFactor = 0; // 距離減衰は level で自前管理
        const split = ctx.createChannelSplitter(2);
        const gL = ctx.createGain();
        const gR = ctx.createGain();
        const merge = ctx.createChannelMerger(2);
        const level = ctx.createGain();
        const sendGain = ctx.createGain();
        input.connect(shelf);
        shelf.connect(pan);
        pan.connect(split);
        split.connect(gL, 0);
        split.connect(gR, 1);
        gL.connect(merge, 0, 0);
        gR.connect(merge, 0, 1);
        merge.connect(level);
        level.connect(dry);
        input.connect(sendGain);
        sendGain.connect(send);
        const nodes = [input, shelf, pan, split, gL, gR, merge, level, sendGain];
        const voice = {
            input,
            pos: { az: 0, el: 0, dist: 1 },
            place(t, az, el, dist, ramp) {
                const a = az * DEG;
                const e = el * DEG;
                const x = dist * Math.sin(a) * Math.cos(e);
                const y = dist * Math.sin(e);
                const z = -dist * Math.cos(a) * Math.cos(e);
                if (pan.positionX) {
                    setP(pan.positionX, t, x, ramp);
                    setP(pan.positionY, t, y, ramp);
                    setP(pan.positionZ, t, z, ramp);
                } else if (!ramp) {
                    pan.setPosition(x, y, z);
                }
                const n = nearness(dist);
                // 近い音源ほど耳間レベル差が開く (far-field HRTF では足りない分を補う)
                const s = Math.sin(a) * Math.cos(e);
                const att = Math.pow(10, (-12 * n * Math.abs(s)) / 20);
                setP(gL.gain, t, s > 0 ? att : 1, ramp);
                setP(gR.gain, t, s < 0 ? att : 1, ramp);
                setP(shelf.gain, t, 7 * n, ramp);
                setP(level.gain, t, distGain(dist), ramp);
                setP(sendGain.gain, t, wetBase + 0.6 * (1 - n), ramp);
                voice.pos = { az, el, dist };
            },
            dispose() {
                for (const n of nodes) n.disconnect();
            },
        };
        return voice;
    }

    // 鳴り始める少し前に初期位置へ置く (HRTF の位置クロスフェードを無音中に済ませる)
    const preroll = (t) => Math.max(live ? ctx.currentTime : 0, t - 0.05);

    function later(t, fn) {
        if (!live) return;
        setTimeout(fn, Math.max(0, (t - ctx.currentTime) * 1000));
    }

    // ── 粒 1 個 ──
    // グレーの粒 = 帯域ノイズの微小クリック。sparkle の確率で RGBCMY の色の粒になる。
    function grain(t, target, amp, sparkle, maxLen = 1) {
        if (rnd() < sparkle && maxLen > 0.1) {
            const f = RGBCMY[pick(KEYS)] * (rnd() < 0.5 ? 4 : 8);
            const o = ctx.createOscillator();
            o.frequency.value = f * r(0.997, 1.003);
            const g = ctx.createGain();
            const d = r(0.03, 0.09);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(amp * 0.35, t + 0.002);
            g.gain.exponentialRampToValueAtTime(1e-4, t + d);
            o.connect(g);
            g.connect(target);
            o.start(t);
            o.stop(t + d + 0.01);
            o.onended = () => g.disconnect();
            return;
        }
        const s = ctx.createBufferSource();
        s.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = rlog(1800, 9000);
        f.Q.value = r(0.6, 2.8);
        const g = ctx.createGain();
        const d = rlog(0.0015, 0.007);
        const pop = rnd() < 0.08 ? r(2, 3.2) : 1; // たまに強い粒 = 予測の中の不意打ち
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(2.2 * amp * pop * Math.exp(r(-0.7, 0.3)), t + 0.0004);
        g.gain.exponentialRampToValueAtTime(1e-4, t + d);
        s.connect(f);
        f.connect(g);
        g.connect(target);
        s.start(t, rnd() * 1.9, d + 0.005);
        s.onended = () => g.disconnect();
    }

    // ── 粒子雲: 頭の周りを回る emitter 群。半径と回転速度は timeline ──
    const cloud = {
        radius: timeline(0.8),
        spin: timeline(0.05), // 回転/秒
        angle: 0,
        t: null,
        emitters: [],
    };
    for (let i = 0; i < cfg.emitters; i++) {
        cloud.emitters.push({
            v: makeVoice(0.04),
            phase: (i / cfg.emitters) * 360 + r(-20, 20),
            dir: i % 4 === 3 ? -1 : 1,
            speed: r(0.6, 1.4),
            elBase: r(-25, 35),
            elAmp: r(5, 20),
            elRate: r(0.05, 0.2),
            rMul: r(0.75, 1.3),
        });
    }
    function placeCloud(t, ramp) {
        const rad = valueAt(cloud.radius, t);
        for (const e of cloud.emitters) {
            const az = e.phase + cloud.angle * e.speed * e.dir;
            const el = e.elBase + e.elAmp * Math.sin(t * e.elRate * 2 * Math.PI + e.phase);
            e.v.place(t, az, el, rad * e.rMul, ramp);
        }
    }
    function planCloud(from, until) {
        const dt = 1 / CLOUD_HZ;
        if (cloud.t === null) {
            cloud.t = from;
            placeCloud(from, false);
        }
        while (cloud.t + dt <= until) {
            cloud.t += dt;
            cloud.angle += 360 * valueAt(cloud.spin, cloud.t) * dt;
            placeCloud(cloud.t, true);
        }
    }

    // ── 粒の流れ (Poisson)。target 省略時は粒子雲のどれか ──
    const streams = [];
    function addStream(s) {
        s.next = s.t0;
        streams.push(s);
        return s;
    }
    function planStreams(until) {
        const floor = live ? ctx.currentTime + 0.01 : 0;
        for (let i = streams.length - 1; i >= 0; i--) {
            const s = streams[i];
            while (s.next < until && s.next < s.t1) {
                const t = s.next;
                const dens = valueAt(s.density, t);
                s.next += dens > 0.01 ? -Math.log(1 - rnd()) / dens : 0.05;
                if (dens <= 0.01 || t < floor) continue;
                const target = s.target ? s.target.input : pick(cloud.emitters).v.input;
                grain(t, target, valueAt(s.amp, t), valueAt(s.sparkle, t), s.t1 - t);
            }
            if (s.next >= s.t1) streams.splice(i, 1);
        }
    }

    // ── 常時モードの演出家: たまに撫でる / 叩く ──
    const director = { on: false, next: 0, quietUntil: 0 };
    function runDirector(from, until) {
        if (!director.on) return;
        if (director.next < from) director.next = from + r(3, 6);
        while (director.next < until) {
            const t = director.next;
            director.next += r(7, 15);
            if (t < director.quietUntil) continue;
            if (rnd() < 0.5) {
                const side = rnd() < 0.5 ? -1 : 1;
                brush({ at: t, dur: r(1.6, 2.6), from: side * 95, to: side * 265, amp: 0.8 });
            } else {
                taps({ at: t, dur: r(1.5, 3), amp: 0.8 });
            }
        }
    }

    let plannedTo = 0;
    function plan(until) {
        const from = Math.max(plannedTo, live ? ctx.currentTime : 0);
        if (until <= from) return;
        planCloud(from, until);
        planStreams(until);
        runDirector(from, until);
        plannedTo = until;
    }
    let timer = null;
    function clock() {
        if (timer || !live) return;
        plan(ctx.currentTime + LOOKAHEAD);
        timer = setInterval(() => plan(ctx.currentTime + LOOKAHEAD), 50);
    }

    // ── 公開 API ─────────────────────────────

    function cloudTo({ at, dur = 2, radius, spin }) {
        if (radius !== undefined) cloud.radius.to(at, dur, radius);
        if (spin !== undefined) cloud.spin.to(at, dur, spin);
    }

    function grains({ at, dur, density = 10, sparkle = 0.08, amp = 0.5 }) {
        return addStream({
            t0: at,
            t1: at + dur,
            density: keyframes(at, density),
            sparkle: keyframes(at, sparkle),
            amp: keyframes(at, amp),
        });
    }

    // 撫でる: 帯域ノイズのストローク + 毛先の細かい粒が、耳から耳へ移動する。
    // 低域 (息の帯域) は削ってあるので、息ではなく「刷毛 / 紙」に聞こえる。
    function brush({ at, dur = 2, from = -95, to = -265, el = 5, arc = 10, dist = 0.18, amp = 1 }) {
        const v = makeVoice(0.03);
        const steps = Math.ceil(dur * 40);
        const ease = (u) => u * u * (3 - 2 * u);
        v.place(preroll(at), from, el, dist, false);
        for (let k = 0; k <= steps; k++) {
            const u = k / steps;
            const az = from + (to - from) * ease(u);
            v.place(at + u * dur, az, el + arc * Math.sin(Math.PI * u), dist * (1 + 0.3 * Math.sin(Math.PI * u)), true);
        }
        const shape = (t) => Math.pow(Math.sin(Math.PI * clamp((t - at) / dur, 0, 1)), 1.4);
        const src = ctx.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 0.9;
        bp.frequency.setValueAtTime(1700, at);
        bp.frequency.linearRampToValueAtTime(3800, at + dur * 0.5);
        bp.frequency.linearRampToValueAtTime(2300, at + dur);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1000;
        const env = ctx.createGain();
        const curve = new Float32Array(64);
        for (let i = 0; i < curve.length; i++) curve[i] = 0.09 * amp * shape(at + (i / (curve.length - 1)) * dur);
        env.gain.setValueAtTime(0, at);
        env.gain.setValueCurveAtTime(curve, at, dur);
        src.connect(bp);
        bp.connect(hp);
        hp.connect(env);
        env.connect(v.input);
        src.start(at, rnd() * 1.5);
        src.stop(at + dur + 0.05);
        addStream({ t0: at, t1: at + dur, density: 170, sparkle: 0, amp: (t) => 0.12 * amp * shape(t), target: v });
        later(at + dur + 1, () => v.dispose());
    }

    // 叩く: 指先で硬いものを叩く音。自由棒の固有振動比 1 : 2.756 : 5.404 で RGBCMY の高さ。
    function tap({ at, az = 95, el = 0, dist = 0.14, color, amp = 1 }) {
        const v = makeVoice(0.03);
        v.place(preroll(at), az, el, dist, false);
        const f0 = RGBCMY[color || pick(KEYS)] * 2 * r(0.99, 1.01);
        const modes = [
            [1, 1, 0.09],
            [2.756, 0.45, 0.04],
            [5.404, 0.22, 0.018],
        ];
        for (const [ratio, a, decay] of modes) {
            const o = ctx.createOscillator();
            o.frequency.value = f0 * ratio;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, at);
            g.gain.linearRampToValueAtTime(0.09 * a * amp, at + 0.0015);
            g.gain.exponentialRampToValueAtTime(1e-4, at + decay * r(0.8, 1.25));
            o.connect(g);
            g.connect(v.input);
            o.start(at);
            o.stop(at + 0.15);
        }
        // 爪先の click
        const s = ctx.createBufferSource();
        s.buffer = noise;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2500;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.25 * amp, at);
        cg.gain.exponentialRampToValueAtTime(1e-4, at + 0.004);
        s.connect(hp);
        hp.connect(cg);
        cg.connect(v.input);
        s.start(at, rnd() * 1.9, 0.01);
        // 指の腹の thump (耳元の物理感)
        const th = ctx.createOscillator();
        th.frequency.setValueAtTime(160, at);
        th.frequency.exponentialRampToValueAtTime(85, at + 0.03);
        const tg = ctx.createGain();
        tg.gain.setValueAtTime(0, at);
        tg.gain.linearRampToValueAtTime(0.12 * amp, at + 0.002);
        tg.gain.exponentialRampToValueAtTime(1e-4, at + 0.035);
        th.connect(tg);
        tg.connect(v.input);
        th.start(at);
        th.stop(at + 0.05);
        later(at + 0.5, () => v.dispose());
    }

    // 叩くパターン: 左右の耳元で 1〜4 回ずつ、少し揺らぎのあるリズム
    function taps({ at, dur = 4, amp = 1, gap = [0.7, 1.6] }) {
        let t = at;
        let side = rnd() < 0.5 ? -1 : 1;
        while (t < at + dur) {
            const n = 1 + Math.floor(rnd() * 4);
            const color = pick(KEYS);
            const az = side * r(75, 115);
            const el = r(-10, 25);
            const dist = r(0.11, 0.2);
            for (let i = 0; i < n; i++) {
                tap({ at: t + i * r(0.09, 0.18), az: az + r(-6, 6), el, dist, color, amp: amp * r(0.7, 1) });
            }
            t += n * 0.14 + r(gap[0], gap[1]);
            if (rnd() < 0.7) side = -side;
        }
    }

    // ── ベッド: 110Hz の灰色の芯。110 と 110.1 のうなり = 10 秒の呼吸 ──
    const bed = { gain: null, lp: null, partials: [], oscs: [], level: 0, started: false };
    function ensureBed(at) {
        if (bed.started) return;
        bed.started = true;
        bed.gain = ctx.createGain();
        bed.gain.gain.value = 0;
        bed.lp = ctx.createBiquadFilter();
        bed.lp.type = 'lowpass';
        bed.lp.frequency.value = 700;
        bed.lp.Q.value = 0.3;
        const bedSend = ctx.createGain();
        bedSend.gain.value = 0.25;
        bed.gain.connect(bed.lp);
        bed.lp.connect(dry);
        bed.lp.connect(bedSend);
        bedSend.connect(send);
        const add = (freq, type, g) => {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = freq;
            const og = ctx.createGain();
            og.gain.value = g;
            o.connect(og);
            og.connect(bed.gain);
            o.start(at);
            bed.oscs.push(o);
            return og;
        };
        add(ROOT, 'sine', 1);
        add(ROOT + 0.1, 'sine', 0.55);
        add(ROOT * 1.5, 'sine', 0.16);
        // 倍音 2x〜7x は frisson の溜めで順に灯る
        for (let k = 2; k <= 7; k++) bed.partials.push({ k, g: add(ROOT * k, 'sine', 0) });
    }
    function bedOn({ at, fade = 4, level = 0.025 }) {
        ensureBed(at);
        bed.gain.gain.setValueAtTime(bed.level, at);
        bed.gain.gain.linearRampToValueAtTime(level, at + fade);
        bed.level = level;
    }
    function bedOff({ at, fade = 3 }) {
        if (!bed.started) return;
        bed.gain.gain.setValueAtTime(bed.level, at);
        bed.gain.gain.linearRampToValueAtTime(0, at + fade);
        bed.level = 0;
    }

    // ── frisson: 接近 (looming) → 間 → RGBCMY 開花。開花の時刻を返す ──
    function frisson({ at, build = 10, silence = 0.75, amp = 1 }) {
        const tPeak = at + build;
        const tBloom = tPeak + silence;
        director.quietUntil = Math.max(director.quietUntil, tBloom + 4);
        ensureBed(at);
        const base = bed.level || 0.025;

        // 1) 溜め: 粒子雲が遠く (1.6m) から耳元 (13cm) へ迫り、回転が加速、粒が増える
        cloudTo({ at, dur: 0.01, radius: 1.6 });
        cloudTo({ at: at + 0.01, dur: build, radius: 0.13, spin: 0.7 });
        grains({
            at,
            dur: build,
            density: [[0, 12], [build * 0.6, 45], [build, 150]],
            sparkle: [[0, 0.04], [build, 0.3]],
            amp: [[0, 0.4 * amp], [build, 0.55 * amp]],
        });
        // 倍音が 2x から順に灯り、ローパスが開く (= グレーの中の虹が見えてくる)
        bed.partials.forEach((p, i) => {
            const t = at + build * (0.1 + 0.13 * i);
            p.g.gain.setValueAtTime(0, t);
            p.g.gain.linearRampToValueAtTime([0.35, 0.25, 0.18, 0.12, 0.09, 0.07][i], t + 1.2);
        });
        bed.lp.frequency.setValueAtTime(700, at);
        bed.lp.frequency.exponentialRampToValueAtTime(5000, tPeak);
        bed.gain.gain.setValueAtTime(bed.level, at);
        bed.gain.gain.linearRampToValueAtTime(base, at + 0.5);
        bed.gain.gain.linearRampToValueAtTime(base * 1.8, tPeak);
        // 上昇するノイズの渦 (共鳴の強い細い帯域 = 息には聞こえない)
        {
            const v = makeVoice(0.02);
            const steps = Math.ceil(build * 30);
            v.place(preroll(at), 0, 0, 1.8, false);
            for (let k = 0; k <= steps; k++) {
                const u = k / steps;
                v.place(at + u * build, 720 * u * u, 10 * Math.sin(6 * u), 1.8 - 1.65 * u, true);
            }
            const src = ctx.createBufferSource();
            src.buffer = noise;
            src.loop = true;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 6;
            bp.frequency.setValueAtTime(1500, at);
            bp.frequency.exponentialRampToValueAtTime(9000, tPeak);
            const g = ctx.createGain();
            g.gain.setValueAtTime(1e-4, at);
            g.gain.exponentialRampToValueAtTime(0.12 * amp, tPeak - 0.02);
            g.gain.linearRampToValueAtTime(0, tPeak);
            src.connect(bp);
            bp.connect(g);
            g.connect(v.input);
            src.start(at);
            src.stop(tPeak + 0.01);
            later(tPeak + 1, () => v.dispose());
        }

        // 2) 間: 全部が一瞬で消える。残響も切る (余韻が残ると「間」にならない)
        bed.gain.gain.linearRampToValueAtTime(0, tPeak + 0.012);
        bed.lp.frequency.setValueAtTime(700, tPeak + 0.05);
        for (const p of bed.partials) p.g.gain.setValueAtTime(0, tPeak + 0.03);
        wet.gain.setValueAtTime(0.7, tPeak);
        wet.gain.linearRampToValueAtTime(0, tPeak + 0.02);
        wet.gain.setValueAtTime(0, tBloom - 0.01);
        wet.gain.linearRampToValueAtTime(0.7, tBloom);
        // 無音の中、右耳のすぐ横で一度だけ叩く = 「ずっといた自分に気づく」
        tap({ at: tPeak + silence * 0.5, az: 95, el: 5, dist: 0.1, color: 'C', amp: 0.9 * amp });

        // 3) 開花: RGBCMY の 6 音が色相環の位置で頭の周りに灯る (灰色の芯 110Hz は抜く = 101%)
        WHEEL.forEach(([key, az], i) => {
            const v = makeVoice(0.0);
            const t = tBloom + i * 0.025;
            v.place(preroll(tBloom), az, r(-5, 25), 2.4, false);
            v.place(tBloom + 9, az + 30, 10, 1.3, true);
            const f = RGBCMY[key];
            for (const [mul, type, a] of [[1, 'sine', 1], [2, 'sine', 0.22], [3, 'triangle', 0.05]]) {
                const o = ctx.createOscillator();
                o.type = type;
                o.frequency.value = f * mul * r(0.998, 1.002);
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.055 * a * amp, t + 0.05);
                g.gain.linearRampToValueAtTime(0.035 * a * amp, t + 1.6);
                g.gain.exponentialRampToValueAtTime(1e-4, t + 10);
                o.connect(g);
                g.connect(v.input);
                o.start(t);
                o.stop(t + 10.1);
            }
            later(tBloom + 11, () => v.dispose());
        });
        // 5 度 (E2) の体の鳴り — root を抜いて 5th を露出 (cosmos-audio-harmonic の cross flash と同じ思想)
        {
            const o = ctx.createOscillator();
            o.frequency.value = ROOT * 0.75;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, tBloom);
            g.gain.linearRampToValueAtTime(0.1 * amp, tBloom + 0.03);
            g.gain.exponentialRampToValueAtTime(1e-4, tBloom + 3.5);
            o.connect(g);
            g.connect(dry);
            o.start(tBloom);
            o.stop(tBloom + 3.6);
        }
        // 色の粒が頭の内側から宇宙へ弾け出る (視点の転換: 内 → 外)
        cloudTo({ at: tBloom, dur: 0.01, radius: 0.1, spin: 0.6 });
        cloudTo({ at: tBloom + 0.01, dur: 3, radius: 3 });
        cloudTo({ at: tBloom + 3, dur: 5, spin: 0.05 });
        grains({
            at: tBloom,
            dur: 7,
            density: [[0, 220], [0.5, 120], [2, 40], [7, 4]],
            sparkle: 0.55,
            amp: 0.6 * amp,
        });
        // 灰色の芯が戻る (中に虹を抱えたまま)
        bed.gain.gain.setValueAtTime(0, tBloom + 2.5);
        bed.gain.gain.linearRampToValueAtTime(base, tBloom + 7.5);
        bed.level = base;
        return tBloom;
    }

    // 常時モード (HP 想定): 灰色の芯 + まばらな粒 + たまに撫でる/叩く
    function ambient({ at, level = 0.022 }) {
        bedOn({ at, fade: 5, level });
        cloudTo({ at, dur: 4, radius: 0.7, spin: 0.05 });
        director.on = true;
        director.next = at + r(4, 7);
        return addStream({
            t0: at,
            t1: Infinity,
            density: (t) => 5 + 3 * Math.sin(t * 0.07) + 2 * Math.sin(t * 0.23),
            sparkle: 0.07,
            amp: 0.4,
        });
    }
    function ambientOff({ at }) {
        director.on = false;
        for (const s of streams) if (s.t1 === Infinity) s.t1 = at;
        bedOff({ at, fade: 2 });
    }

    // カーソル追従: 動かした分だけ、その方向の耳元で粒が鳴る (止まれば無音)。
    // x, y は -1..1 (y は上が +)。「見られている = personal attention」を声なしで作る。
    let ptr = null;
    function pointer(x, y) {
        const now = ctx.currentTime;
        const az = clamp(x, -1, 1) * 100;
        const el = clamp(y, -1, 1) * 35;
        if (!ptr) {
            ptr = { v: makeVoice(0.03), x, y, t: now };
            ptr.v.place(now, az, el, 0.22, false);
            return;
        }
        const dt = clamp(now - ptr.t, 0.001, 0.25);
        const speed = Math.hypot(x - ptr.x, y - ptr.y) / dt;
        ptr.v.place(now + 0.04, az, el, 0.22, true);
        const expected = Math.min(90, speed * 40) * dt;
        const n = Math.min(8, Math.floor(expected) + (rnd() < expected % 1 ? 1 : 0));
        for (let i = 0; i < n; i++) grain(now + 0.02 + rnd() * dt, ptr.v.input, 0.45, 0.06);
        ptr.x = x;
        ptr.y = y;
        ptr.t = now;
    }
    // 商品カードの hover など: その側の耳元で 1 回叩く
    function hover({ side = 1, color } = {}) {
        tap({ at: ctx.currentTime + 0.01, az: side * 95, el: 8, dist: 0.15, color, amp: 0.7 });
    }

    // 譜面の終わり: 全体をフェードし、芯を止めてから master を戻す (ライブで続けて鳴らせるように)
    function fadeOut({ at, dur = 3 }) {
        master.gain.setValueAtTime(cfg.gain, at);
        master.gain.linearRampToValueAtTime(0, at + dur);
        bedOff({ at: at + dur, fade: 0.05 });
        master.gain.setValueAtTime(0, at + dur + 0.1);
        master.gain.linearRampToValueAtTime(cfg.gain, at + dur + 0.2);
    }
    function setGain(g) {
        cfg.gain = g;
        master.gain.setTargetAtTime(g, ctx.currentTime, 0.05);
    }

    // 表示用: 粒子雲 emitter の現在位置
    function snapshot() {
        return {
            cloud: cloud.emitters.map((e) => e.v.pos),
            pointer: ptr ? ptr.v.pos : null,
        };
    }

    function dispose() {
        if (timer) clearInterval(timer);
        timer = null;
        streams.length = 0;
        director.on = false;
        for (const o of bed.oscs) o.stop();
        for (const e of cloud.emitters) e.v.dispose();
        if (ptr) ptr.v.dispose();
        master.disconnect();
    }

    return {
        ctx,
        master,
        plan,
        clock,
        cloudTo,
        grains,
        brush,
        tap,
        taps,
        bedOn,
        bedOff,
        frisson,
        ambient,
        ambientOff,
        pointer,
        hover,
        fadeOut,
        setGain,
        snapshot,
        dispose,
    };
}

// ── 譜面 (オフライン書き出しとラボ再生で共通) ─────────────────
// build(eng, t0) は t0 からの相対で全イベントを組む。

function particles(eng, t0) {
    eng.bedOn({ at: t0, fade: 5 });
    eng.cloudTo({ at: t0, dur: 0.01, radius: 1.4, spin: 0.04 });
    eng.cloudTo({ at: t0 + 0.01, dur: 12, radius: 0.32, spin: 0.12 });
    eng.cloudTo({ at: t0 + 13, dur: 9, radius: 0.9, spin: 0.06 });
    eng.grains({
        at: t0,
        dur: 24,
        density: [[0, 4], [4, 14], [12, 38], [16, 22], [24, 8]],
        sparkle: 0.08,
        amp: 0.5,
    });
    eng.brush({ at: t0 + 8, dur: 2.2, from: -95, to: -265 });
    eng.brush({ at: t0 + 17.5, dur: 2.4, from: 95, to: 265, amp: 0.8 });
}

function brushTap(eng, t0) {
    eng.bedOn({ at: t0, fade: 3, level: 0.02 });
    eng.cloudTo({ at: t0, dur: 0.01, radius: 0.8, spin: 0.05 });
    eng.grains({ at: t0, dur: 22, density: 5, sparkle: 0.06, amp: 0.4 });
    eng.taps({ at: t0 + 1, dur: 4.5 });
    eng.brush({ at: t0 + 6.5, dur: 2.2, from: -95, to: -265 });
    eng.taps({ at: t0 + 9.5, dur: 3.5 });
    // 頭の上を越えて左 → 右
    eng.brush({ at: t0 + 13.5, dur: 2.6, from: -90, to: 90, el: 0, arc: 75, dist: 0.2 });
    eng.taps({ at: t0 + 16.8, dur: 3 });
    eng.brush({ at: t0 + 20, dur: 2.2, from: 95, to: 265, amp: 0.85 });
}

function frisson101(eng, t0) {
    eng.bedOn({ at: t0, fade: 3 });
    eng.grains({ at: t0, dur: 4, density: [[0, 3], [4, 10]], sparkle: 0.05, amp: 0.4 });
    eng.frisson({ at: t0 + 4, build: 10 });
}

export const SCORES = {
    particles: { title: '01 粒子 — 頭の周りを回る粒', dur: 30, seed: 11, build: particles },
    brushTap: { title: '02 撫でる / 叩く — 耳から耳へ', dur: 27, seed: 22, build: brushTap },
    frisson101: { title: '03 101% — 接近 → 間 → 開花', dur: 27, seed: 33, build: frisson101 },
    full: {
        title: '00 通し — 粒子 → 撫でる/叩く → 101%',
        dur: 76,
        seed: 101,
        build(eng, t0) {
            particles(eng, t0);
            brushTap(eng, t0 + 23);
            eng.frisson({ at: t0 + 46, build: 10 });
            eng.fadeOut({ at: t0 + 72, dur: 4 });
        },
    },
};
// 単体譜面も最後に 3 秒でフェードアウト
for (const key of ['particles', 'brushTap', 'frisson101']) {
    const s = SCORES[key];
    const build = s.build;
    s.build = (eng, t0) => {
        build(eng, t0);
        eng.fadeOut({ at: t0 + s.dur - 3, dur: 3 });
    };
}
