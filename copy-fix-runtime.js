/* copy-fix-runtime.js — 2026-04-28
 *
 * 目的:
 *   p3_code_for_claude.js は Codex の hot file のため直接編集しない。
 *   そのなかに残る「開発者向けの alert 文言」を、
 *   ランタイムでフックして「顧客向けの静かな文言」に置換する。
 *
 *   対象（p3_code_for_claude.js 由来）:
 *     - "この商品の checkout はまだ準備中です。Shopify variant を設定してください。"
 *     - "Checkout error: ..." （詳細を顧客に晒さない）
 *     - "Checkout not ready yet"
 *     - "No Shopify variants mapped"
 *     - "variant 設定" を含む全文言
 *
 *   方針:
 *     - window.alert を一段ラップする
 *     - 開発者向けキーワード（variant / Shopify / not ready / mapped 等）を含む文言を
 *       哲学を壊さない簡潔な顧客向け表現に変換
 *     - console には原文を残し、運用デバッグを妨げない
 *
 *   触らない:
 *     p3_code_for_claude.js 本体 / p1 / p2 / particle_*.* / enhance.js / sw.js / register.js / i18n.js
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.alert) return;
  if (window.__inryokuCopyFixInstalled__) return;
  window.__inryokuCopyFixInstalled__ = true;

  var nativeAlert = window.alert.bind(window);

  // 開発者向け語彙 → 顧客向け文言への変換ルール（先勝ち）
  var RULES = [
    {
      // Shopify variant 未設定のチェックアウト
      test: function (m) {
        return /variant/i.test(m) || /shopify/i.test(m) || /not\s*ready/i.test(m) || /mapped/i.test(m);
      },
      replace: 'この色は、いままだ準備中。少し待ってから、もう一度のぞきにきて。'
    },
    {
      // 一般的な checkout error。エラー詳細はユーザーに見せない（XSS含む情報漏洩対策にも寄与）
      test: function (m) { return /checkout\s*error/i.test(m); },
      replace: '決済の途中で、信号が途切れた。ネットワークを確認して、もう一度試してみて。'
    },
    {
      // 在庫切れ等
      test: function (m) { return /sold\s*out|在庫|out\s*of\s*stock/i.test(m); },
      replace: 'いまこの色は、誰かの手に渡ったところ。次の入荷をすこし待って。'
    },
    {
      // 「準備中」を含む既存文言の最終フォールバック（哲学トーンに寄せる）
      test: function (m) { return /準備中/.test(m); },
      replace: 'この色は、いままだ準備中。少し待ってから、もう一度のぞきにきて。'
    }
  ];

  function transform(message) {
    var m = String(message == null ? '' : message);
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].test(m)) return RULES[i].replace;
    }
    return m;
  }

  window.alert = function (message) {
    var original = String(message == null ? '' : message);
    var rewritten = transform(original);
    if (rewritten !== original) {
      try {
        // 運用デバッグ用に原文を console に残す（顧客には見えない）
        if (window.console && console.info) {
          console.info('[copy-fix] alert rewritten:', { original: original, shown: rewritten });
        }
      } catch (_) {}
      return nativeAlert(rewritten);
    }
    return nativeAlert(original);
  };
})();
