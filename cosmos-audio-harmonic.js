/**
 * cosmos-audio-harmonic.js
 *
 * inryokü Harmonic Drone Engine
 *   A2 (110Hz) を基音とし、倍音 (2x/3x/4x/5x/6x/7x) を段階的に追加することで
 *   「50% → 101%」を音響でも進行させる。グレーコード = 全倍音同時 = 50% の核。
 *
 * 哲学:
 *   - 基音 (110Hz) = グレー
 *   - 倍音追加 = 「グレーの中の虹が見える」
 *   - cross flash で root を抜くと 5th が露出 = 101% (基底崩壊)
 *
 * Tone.js を使わない理由:
 *   バンドルサイズ + 既存 Web Audio コードベースとの整合性。
 *   harmonic series 程度なら OscillatorNode 直接が最軽量で哲学にも近い。
 *
 * @ts-check
 */
(function () {
    'use strict';

    /** @typedef {{freq:number, gain:number, osc:OscillatorNode, gainNode:GainNode}} Partial */

    var ctx = null;
    /** @type {GainNode|null} */
    var master = null;
    /** @type {Partial[]} */
    var partials = [];
    var started = false;
    var paused = false;

    // A2 = 110Hz、最大 6 partials (root + 5 overtones)
    var ROOT = 110;
    var RATIOS = [1, 2, 3, 4, 5, 6, 7];

    /** @returns {AudioContext|null} */
    function ensureCtx() {
        if (ctx) return ctx;
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        ctx = new Ctx();
        master = ctx.createGain();
        master.gain.value = 0.0;
        master.connect(ctx.destination);
        return ctx;
    }

    /**
     * Start the harmonic drone. Must be called after a user gesture (iOS Safari).
     * @param {object} [opts]
     * @param {number} [opts.fadeIn] - seconds to ramp master gain
     * @param {number} [opts.masterGain] - target master gain (0..1)
     */
    function start(opts) {
        if (started) return;
        if (!ensureCtx()) return;
        opts = opts || {};
        var fadeIn = opts.fadeIn || 1.2;
        var targetGain = opts.masterGain != null ? opts.masterGain : 0.08;

        // Root partial だけ最初から起動 (= グレー)
        addPartial(0, { fadeIn: fadeIn * 0.6 });
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(0, now);
        master.gain.linearRampToValueAtTime(targetGain, now + fadeIn);
        started = true;
    }

    /**
     * Add a partial (overtone) by index. Index 0 = root, 1 = 2x, ...
     * @param {number} idx
     * @param {object} [opts]
     * @param {number} [opts.fadeIn]
     * @param {number} [opts.gain]
     */
    function addPartial(idx, opts) {
        if (!ensureCtx()) return;
        if (idx < 0 || idx >= RATIOS.length) return;
        if (partials[idx]) return; // already added
        opts = opts || {};
        var fadeIn = opts.fadeIn != null ? opts.fadeIn : 0.6;
        // root 主役、上倍音は徐々に小さく (harmonic naturality)
        var defaultGain = 1.0 / (1.0 + idx * 1.6);
        var gain = opts.gain != null ? opts.gain : defaultGain;
        var freq = ROOT * RATIOS[idx];

        var osc = ctx.createOscillator();
        // sine = root の純粋さ、triangle = overtone の柔らかさ
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // 軽い detune で「複数の倍音が重なる」音響的厚み
        if (idx > 0) {
            osc.detune.setValueAtTime((idx % 2 === 0 ? +1 : -1) * 4, ctx.currentTime);
        }

        var g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(gain, ctx.currentTime + fadeIn);

        osc.connect(g);
        g.connect(master);
        osc.start();

        partials[idx] = { freq: freq, gain: gain, osc: osc, gainNode: g };
    }

    /**
     * Remove a partial (graceful fade-out).
     * @param {number} idx
     * @param {object} [opts]
     * @param {number} [opts.fadeOut]
     */
    function removePartial(idx, opts) {
        var p = partials[idx];
        if (!p || !ctx) return;
        opts = opts || {};
        var fadeOut = opts.fadeOut != null ? opts.fadeOut : 0.4;
        var now = ctx.currentTime;
        p.gainNode.gain.cancelScheduledValues(now);
        p.gainNode.gain.setValueAtTime(p.gainNode.gain.value, now);
        p.gainNode.gain.linearRampToValueAtTime(0.0001, now + fadeOut);
        try { p.osc.stop(now + fadeOut + 0.05); } catch (_) {}
        partials[idx] = undefined;
    }

    /**
     * Drive harmonic progression from a normalized progress [0..1].
     * 0.0  = root only         (grey)
     * 0.2  = +2x               (faint color)
     * 0.4  = +3x
     * 0.6  = +4x
     * 0.8  = +5x
     * 0.95 = +6x               (rainbow chord)
     * 1.0+ = +7x               (101% breach)
     * @param {number} p
     */
    function driveByProgress(p) {
        if (!started) return;
        var thresholds = [0.0, 0.20, 0.40, 0.60, 0.80, 0.95, 1.00];
        for (var i = 0; i < thresholds.length; i++) {
            if (p >= thresholds[i] && !partials[i]) {
                addPartial(i, { fadeIn: 0.8 });
            }
            if (p < thresholds[i] - 0.05 && partials[i] && i > 0) {
                removePartial(i, { fadeOut: 0.3 });
            }
        }
    }

    /**
     * Cross flash: pull the root (=fundamental) momentarily to expose the 5th.
     * Philosophy: 基底が崩壊して 5th が浮かぶ = 101% の体験
     * @param {object} [opts]
     * @param {number} [opts.duration]
     */
    function pullRoot(opts) {
        if (!partials[0] || !ctx) return;
        opts = opts || {};
        var duration = opts.duration || 0.6;
        var now = ctx.currentTime;
        var p = partials[0];
        var orig = p.gain;
        p.gainNode.gain.cancelScheduledValues(now);
        p.gainNode.gain.setValueAtTime(orig, now);
        p.gainNode.gain.linearRampToValueAtTime(0.0001, now + duration * 0.4);
        p.gainNode.gain.linearRampToValueAtTime(orig, now + duration);
    }

    /**
     * Bass impulse hit (101% breach moment).
     * 40Hz sine, exp decay 280ms.
     * @param {object} [opts]
     */
    function bassHit(opts) {
        if (!ensureCtx()) return;
        opts = opts || {};
        var freq = opts.freq || 40;
        var decay = opts.decay || 0.28;
        var peakGain = opts.gain || 0.45;
        var now = ctx.currentTime;

        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + decay);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peakGain, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + decay + 0.05);
        osc.connect(g);
        g.connect(ctx.destination); // bypass master for punch
        osc.start(now);
        osc.stop(now + decay + 0.1);
    }

    /** Pause master (e.g., user blur). */
    function pause() {
        if (!ctx || paused) return;
        paused = true;
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.linearRampToValueAtTime(0, now + 0.2);
    }

    /** Resume master. */
    function resume(targetGain) {
        if (!ctx || !paused) return;
        paused = false;
        var t = targetGain != null ? targetGain : 0.08;
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.linearRampToValueAtTime(t, now + 0.4);
    }

    /** Stop everything (P1 → P2 遷移時). */
    function stop(fadeOut) {
        if (!ctx) return;
        var fo = fadeOut != null ? fadeOut : 0.6;
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.linearRampToValueAtTime(0, now + fo);
        // 個別 osc も止める
        partials.forEach(function (p, i) { if (p) removePartial(i, { fadeOut: fo }); });
        setTimeout(function () {
            try { ctx.close(); } catch (_) {}
            ctx = null; master = null; partials = []; started = false; paused = false;
        }, (fo + 0.2) * 1000);
    }

    // window 経由で expose (UMD・vanilla)
    if (typeof window !== 'undefined') {
        window.inryokuHarmonic = {
            start: start,
            stop: stop,
            pause: pause,
            resume: resume,
            addPartial: addPartial,
            removePartial: removePartial,
            driveByProgress: driveByProgress,
            pullRoot: pullRoot,
            bassHit: bassHit,
            get partials() { return partials.slice(); }
        };
    }
})();
