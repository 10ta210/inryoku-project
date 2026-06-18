/**
 * p3_contact_pin.js — CONTACT を常時知覚できる固定ピンに (P3 専用)
 *
 * 司さん (2026-05-25):「コンタクトどこにもない / スクロールしないと気づかない」
 *
 * 原因対策:
 *   - #contact-form は .singularity-content 末尾にあり、スクロールしないと見えない。
 *   - position:fixed を付けても、祖先に transform/filter があると viewport 基準に
 *     ならず罠化する (= どこにもない状態)。
 *   → #contact-form を document.body 直下へ移設し、fixed を確実に効かせる。
 *     ノード移動なので既存の getElementById ハンドラ (toggle/submit) はそのまま動く。
 *
 * 既存 DOM/JS は削除しない。表示位置だけを保証する後付けレイヤ。
 * OFF: ?contactpin=0
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.__p3ContactPinned) return;

  try {
    // 2026-05-31 司「最初から CONTACT が出てておかしい」: 常時ピンを停止。
    //   元の自然な挙動 (singularity-content 末尾、スクロールで出る) に戻す。
    //   復活は ?contactpin=on。
    if (!/[?&]contactpin=on/.test(location.search)) return;
    if (/[?&]avatar=1/.test(location.search)) return;
    var path = location.pathname;
    if (!/index\.html?$|p3_test\.html?$|^\/$/.test(path)) return;
  } catch (e) {}

  function pin() {
    var form = document.getElementById('contact-form');
    if (!form) return false;
    if (form.parentNode !== document.body) {
      document.body.appendChild(form);   // body 直下へ (fixed を viewport 基準に)
    }
    // 既存 inline opacity:0 を確実に解除 (CSS !important と二重保険)
    form.style.opacity = '1';
    form.style.removeProperty('display');
    window.__p3ContactPinned = true;
    console.info('[p3_contact_pin] CONTACT pinned to body (always visible)');
    return true;
  }

  function boot() {
    if (pin()) return;
    // P3 init 後に生成されるので少し待ってリトライ
    var tries = 0;
    var iv = setInterval(function () {
      if (pin() || ++tries > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 1400);
  } else {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1400); });
  }
})();
