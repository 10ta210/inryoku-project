// security.test.mjs — server.js のセキュリティヘルパを再実装してロジック検証
// production code（server.js）には触れず、同じ実装を独立コピーしてエッジケースを精査する。
// 目的: 仕様レベルの不変条件を固定し、将来 server.js を編集する際の網にする。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// ─── 対象実装（server.js と等価のコピー） ─────────────────────
function escapeHTML(s) {
  return String(s).replace(/[<>&"'`]/g, c =>
    ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
}

function isSafeHexColor(s) {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length || a.length === 0) return false;
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch { return false; }
}

// rate limiter — server.js と同等のロジックを再現
function makeLimiter() {
  const buckets = new Map();
  return function check(ip, key, max, windowMs, now = Date.now()) {
    const k = `${key}:${ip}`;
    const b = buckets.get(k) || { count: 0, reset: now + windowMs };
    if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
    b.count++;
    buckets.set(k, b);
    return { ok: b.count <= max, count: b.count, reset: b.reset, size: buckets.size };
  };
}

// ─── テスト ────────────────────────────────────────────────────

describe('security — escapeHTML エッジケース', () => {
  test('6 文字 (& < > " \' `) すべてエスケープされる', () => {
    assert.equal(escapeHTML('&'), '&amp;');
    assert.equal(escapeHTML('<'), '&lt;');
    assert.equal(escapeHTML('>'), '&gt;');
    assert.equal(escapeHTML('"'), '&quot;');
    assert.equal(escapeHTML("'"), '&#39;');
    assert.equal(escapeHTML('`'), '&#96;');
  });

  test('属性ブレイク攻撃: " onerror=... を中和する', () => {
    const evil = '" onerror="alert(1)';
    const safe = escapeHTML(evil);
    assert.ok(!safe.includes('"'), 'raw " は残らない');
    assert.ok(safe.includes('&quot;'));
  });

  test('スクリプトタグを中和する（タグ生成不可に）', () => {
    const evil = '<script>alert(1)</script>';
    const safe = escapeHTML(evil);
    assert.ok(!safe.includes('<script'));
    assert.equal(safe, '&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('テンプレートリテラルバックティック攻撃を中和', () => {
    assert.equal(escapeHTML('`${alert(1)}`'), '&#96;${alert(1)}&#96;');
  });

  test('null / undefined / 数値も String 化されて安全', () => {
    assert.equal(escapeHTML(null), 'null');
    assert.equal(escapeHTML(undefined), 'undefined');
    assert.equal(escapeHTML(42), '42');
    assert.equal(escapeHTML(0), '0');
  });

  test('空文字は空文字を返す', () => {
    assert.equal(escapeHTML(''), '');
  });

  test('多重エスケープは &amp;amp; のように冪等ではない（意図通り）', () => {
    assert.equal(escapeHTML(escapeHTML('&')), '&amp;amp;');
  });

  test('連続する特殊文字を取りこぼさない', () => {
    assert.equal(escapeHTML('<<>>&&""\'\'``'),
      '&lt;&lt;&gt;&gt;&amp;&amp;&quot;&quot;&#39;&#39;&#96;&#96;');
  });

  test('日本語など非 ASCII はそのまま通る', () => {
    assert.equal(escapeHTML('司さん<script>'), '司さん&lt;script&gt;');
  });

  test('NULL byte (\\0) は変換せずそのまま通す（仕様固定: HTML 上は無害）', () => {
    const r = escapeHTML('a\0<b');
    assert.ok(r.includes('\0'), 'NULL byte は保持');
    assert.ok(r.includes('&lt;b'));
  });

  test('Unicode コードポイント（絵文字 / 全角 / RTL）は破壊されない', () => {
    assert.equal(escapeHTML('🌈'), '🌈');
    assert.equal(escapeHTML('ＡＢＣ'), 'ＡＢＣ');
    // RTL override (U+202E) — XSS 関与する制御文字でも escapeHTML 仕様としてはそのまま通す
    assert.equal(escapeHTML('a‮b'), 'a‮b');
  });

  test('Surrogate pair（U+1F308 RAINBOW など）が分裂せずに保持される', () => {
    const rainbow = '🌈'; // 🌈
    assert.equal(escapeHTML(rainbow), rainbow);
    assert.equal(escapeHTML('<' + rainbow + '>'), '&lt;' + rainbow + '&gt;');
  });

  test('lone surrogate（壊れた UTF-16）でも throw しない', () => {
    const lone = '\uD800'; // 単独 high surrogate
    assert.doesNotThrow(() => escapeHTML(lone));
    assert.equal(escapeHTML(lone + '<'), lone + '&lt;');
  });

  test('結合文字（NFD 分解）が崩れない', () => {
    const nfd = 'が'.normalize('NFD'); // か + 濁点
    assert.equal(escapeHTML(nfd), nfd);
  });
});

describe('security — isSafeHexColor', () => {
  test('正しい 6 桁 hex は受理', () => {
    assert.equal(isSafeHexColor('#ff00ff'), true);
    assert.equal(isSafeHexColor('#000000'), true);
    assert.equal(isSafeHexColor('#FFFFFF'), true);
    assert.equal(isSafeHexColor('#aBcDeF'), true);
  });

  test('3 桁 hex は拒否（CSS 仕様としては有効でも厳格運用）', () => {
    assert.equal(isSafeHexColor('#fff'), false);
  });

  test('# が無いと拒否', () => {
    assert.equal(isSafeHexColor('ff00ff'), false);
  });

  test('CSS インジェクション (red; background: ...) を拒否', () => {
    assert.equal(isSafeHexColor('red; background: url(x)'), false);
    assert.equal(isSafeHexColor('#fff; }body{'), false);
  });

  test('文字列以外は拒否', () => {
    assert.equal(isSafeHexColor(null), false);
    assert.equal(isSafeHexColor(undefined), false);
    assert.equal(isSafeHexColor(0xfff), false);
    assert.equal(isSafeHexColor({}), false);
  });
});

describe('security — safeEqualHex（タイミング攻撃緩和）', () => {
  test('同一 hex は true', () => {
    const t = crypto.randomBytes(32).toString('hex');
    assert.equal(safeEqualHex(t, t), true);
  });

  test('異なる hex は false', () => {
    const a = crypto.randomBytes(32).toString('hex');
    const b = crypto.randomBytes(32).toString('hex');
    assert.equal(safeEqualHex(a, b), false);
  });

  test('長さ違いは false（早期 return）', () => {
    assert.equal(safeEqualHex('aa', 'aabb'), false);
  });

  test('空文字は false（防御的）', () => {
    assert.equal(safeEqualHex('', ''), false);
  });

  test('非文字列は false', () => {
    assert.equal(safeEqualHex(null, 'aa'), false);
    assert.equal(safeEqualHex('aa', null), false);
    assert.equal(safeEqualHex(undefined, undefined), false);
    assert.equal(safeEqualHex(123, '7b'), false);
  });

  test('不正 hex 文字列でも throw せず false', () => {
    // Buffer.from は不正文字を切り詰めるため長さが変わる → false
    assert.doesNotThrow(() => safeEqualHex('zzzz', 'zzzz'));
    // 完全に同じ "zzzz" は両側とも空 buffer になるので length=0 で false
    assert.equal(safeEqualHex('zzzz', 'zzzz'), false);
  });

  test('1 文字違いでも検出する', () => {
    const a = 'a'.repeat(64);
    const b = 'a'.repeat(63) + 'b';
    assert.equal(safeEqualHex(a, b), false);
  });
});

describe('security — rate limiter ロジック', () => {
  test('閾値以下は ok、超過すると ok=false', () => {
    const check = makeLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      const r = check('1.2.3.4', 'chat', 5, 60_000, t0);
      assert.equal(r.ok, true, `${i + 1} 回目`);
    }
    const r6 = check('1.2.3.4', 'chat', 5, 60_000, t0);
    assert.equal(r6.ok, false, '6 回目で拒否');
  });

  test('IP ごとに独立してカウントされる', () => {
    const check = makeLimiter();
    const t0 = 2_000_000;
    for (let i = 0; i < 5; i++) check('1.1.1.1', 'k', 5, 60_000, t0);
    const a = check('1.1.1.1', 'k', 5, 60_000, t0);
    const b = check('2.2.2.2', 'k', 5, 60_000, t0);
    assert.equal(a.ok, false, '同 IP は超過');
    assert.equal(b.ok, true, '別 IP は影響なし');
  });

  test('key（endpoint）ごとに独立してカウントされる', () => {
    const check = makeLimiter();
    const t0 = 3_000_000;
    for (let i = 0; i < 5; i++) check('1.1.1.1', 'chat', 5, 60_000, t0);
    const chat = check('1.1.1.1', 'chat', 5, 60_000, t0);
    const sub = check('1.1.1.1', 'subscribe', 5, 60_000, t0);
    assert.equal(chat.ok, false);
    assert.equal(sub.ok, true, '別 key は別 bucket');
  });

  test('window 経過後はリセットされる', () => {
    const check = makeLimiter();
    const t0 = 4_000_000;
    for (let i = 0; i < 5; i++) check('1.1.1.1', 'k', 5, 60_000, t0);
    const blocked = check('1.1.1.1', 'k', 5, 60_000, t0);
    assert.equal(blocked.ok, false);
    // window をまたぐ
    const reset = check('1.1.1.1', 'k', 5, 60_000, t0 + 60_001);
    assert.equal(reset.ok, true, 'reset 後は再カウント');
  });
});

describe('security — prototype pollution 防御', () => {
  test('Object.create(null) ベースのマップは __proto__ 経由攻撃を受け付けない', () => {
    const m = Object.create(null);
    m['__proto__'] = { polluted: true };
    // Object.create(null) は __proto__ を通常プロパティとして扱う
    assert.equal(({}).polluted, undefined, 'Object.prototype は汚染されていない');
  });

  test('JSON.parse + 浅いマージで __proto__ / constructor を弾く（safeAssign 例）', () => {
    function safeAssign(target, src) {
      for (const k of Object.keys(src)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        target[k] = src[k];
      }
      return target;
    }
    const evil = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}},"ok":1}');
    const out = safeAssign({}, evil);
    assert.equal(out.ok, 1);
    assert.equal(({}).polluted, undefined, 'Object.prototype 汚染なし');
    assert.equal(out.__proto__.polluted, undefined, 'safeAssign が __proto__ を skip');
  });

  test('Map を使えば文字列キー攻撃から構造的に守れる', () => {
    const ref = new Map();
    ref.set('__proto__', { evil: true });
    assert.equal(ref.get('__proto__').evil, true, 'Map は値として保持するだけ');
    assert.equal(({}).evil, undefined, 'prototype は汚染されない');
  });

  test('hasOwnProperty 経由のチェックで in 演算子の継承プロパティを除外', () => {
    const obj = { foo: 1 };
    assert.equal('toString' in obj, true, 'in は prototype を見る');
    assert.equal(Object.prototype.hasOwnProperty.call(obj, 'toString'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(obj, 'foo'), true);
  });
});
