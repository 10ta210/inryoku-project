# Worker F Copy / i18n Plan — 2026-04-30

対象: Home / P3 / legal pages  
編集責務: 情報設計とコピー実装支援  
所有範囲: `docs/` 新規文書, `i18n.json`

## 1. 方針

- 現行サイトの強みは、`50% → 101%`、`見えないものの可視化`、`グレーの中に虹` の反復が UI と同期している点にある。
- そのため、コピー改善は「説明を増やす」のではなく、「直書きの断片を辞書化し、言い回しの軸を揃える」方向が安全。
- 法務ページは情報の正確性が最優先。詩性は足さず、語尾とラベルの統一に留める。

## 2. Home 改善候補

現状評価:

- meta/title 系の主軸は強い。
- 英語公開の種としては `title / description / og / twitter` のキー粒度がまだ不足。
- UI 上の導線文言より、共有時の外部表示テキスト整備を先にやる価値が高い。

改善候補:

- `meta.og.description`
  - ja: `観測すれば世界は変わる。グレーの中に虹がある。哲学を纏う服 inryokü。`
  - en: `Observe, and the world changes. The rainbow lives within grey. inryokü is philosophy worn as cloth.`
- `meta.twitter.title`
  - ja/en 共通: `inryokü — 50% → 101%`
- `meta.twitter.description`
  - ja: `観測すれば世界は変わる。グレーの中に虹がある。哲学を纏う服。`
  - en: `Observe, and the world changes. The rainbow lives within grey. Philosophy worn as cloth.`

実装メモ:

- Home の head 内文言は将来 `data-i18n-attr` か JS で同期。
- 先に辞書を置いておけば、他ワーカーが head 側を触るときの命名衝突を避けられる。

## 3. P3 改善候補

現状評価:

- P3 は体験の核だが、フッター・カート・チャットに直書き英語 / 日本語が混在している。
- ブランドの静かなトーンに対し、`Secure Checkout` や `WORLDWIDE SHIPPING` は機能語としては正しいが、辞書未管理で将来の英語公開時に揺れやすい。

優先度順:

1. フッター最小セット
   - `p3.footer.info`
   - `p3.footer.copyright_short`
   - `p3.footer.legal`
   - `p3.footer.privacy`
   - `p3.footer.returns`
   - `p3.footer.secure_checkout`

2. ストア周辺
   - `shop.worldwide_shipping`
   - `shop.delivery_window`
   - `shop.checkout_soon`

3. チャット導線
   - `chat.info_name`
   - `chat.input_placeholder_compact`
   - `chat.greeting`

推奨コピー:

- `p3.footer.secure_checkout`
  - ja: `Secure Checkout`
  - en: `Secure Checkout`
  - 理由: 法務性のある機能語なので、ここは無理に和訳しないほうが UI の緊張感を保てる。
- `shop.worldwide_shipping`
  - ja: `WORLDWIDE SHIPPING`
  - en: `WORLDWIDE SHIPPING`
- `shop.delivery_window`
  - ja: `配送目安 7–14 営業日`
  - en: `DELIVERY · 7–14 BUSINESS DAYS`
- `shop.checkout_soon`
  - ja: `CHECKOUT SOON`
  - en: `CHECKOUT SOON`
- `chat.greeting`
  - ja: `こんにちは、私は、infoです`
  - en: `hello, i am info`

補足:

- `footer.privacy` / `footer.returns` には既に policy 名義の長い表現がある。
- P3 フッターは視認面積が狭いので、短い UI ラベル用に `p3.footer.*` を別で持つほうが安全。

## 4. legal pages 改善候補

現状評価:

- `legal.html`, `privacy.html`, `returns.html` は辞書配線が進んでいる。
- ただし legal の TODO プレースホルダは未辞書化で、英語公開時に最も粗く見える。
- `returns.html` の更新日が `privacy.updated` を参照しており、意味上の分離が弱い。

改善候補:

1. TODO プレースホルダを辞書化
   - `legal.placeholder.seller`
   - `legal.placeholder.operator`
   - `legal.placeholder.address`
   - `legal.placeholder.phone`
   - `legal.placeholder.phone_hours`
   - `legal.placeholder.shipping`
   - `legal.placeholder.extra_fees`
   - `legal.placeholder.delivery`
   - `legal.placeholder.usage`
   - `legal.placeholder.conditions`
   - `legal.placeholder.updated`

2. 更新日キーの分離
   - `returns.updated`

3. legal 内リンク文言の分離
   - `legal.link.returns`

推奨コピー原則:

- legal: 名詞ラベル中心。余分な比喩は不要。
- privacy: トラッキング非利用、Cookie の用途、外部決済処理を簡潔に固定。
- returns: 返送条件、返金時間、例外条件を箇条書き前提の短文で固定。

## 5. 言語キー整理ルール

- 共有概念は `common.*` や `footer.*` に置く。
- P3 固有 UI は `p3.*` に閉じる。
- 法務は `legal.*`, `privacy.*`, `returns.*` に分離し、相互参照は最小化する。
- 同じ意味でも表示幅が違う場合は、無理に共通化せず `*_short` かセクション別キーを持つ。

避けるべきこと:

- 既存キーの削除
- 既存キー名の改名
- `footer.*` に P3 専用の短縮ラベルを混ぜること

## 6. 英語公開に向けた種

- Phase 1: 辞書先行
  - 今回追加した head / P3 / legal placeholder キーを source of truth にする。
- Phase 2: 配線
  - Home meta, P3 footer, cart modal, chat placeholder を順次 `data-i18n` 化。
- Phase 3: SEO
  - `/ ?lang=en` 用の `og:*`, `twitter:*`, `hreflang` を同期。
- Phase 4: legal completeness
  - プレースホルダを実値に置換し、英語版でも未確定文言が露出しない状態にする。

## 7. 今回の `i18n.json` 追加対象

- Home head 用:
  - `meta.og.description`
  - `meta.twitter.title`
  - `meta.twitter.description`
- P3 用:
  - `p3.footer.info`
  - `p3.footer.copyright_short`
  - `p3.footer.legal`
  - `p3.footer.privacy`
  - `p3.footer.returns`
  - `p3.footer.secure_checkout`
  - `shop.worldwide_shipping`
  - `shop.delivery_window`
  - `shop.checkout_soon`
  - `chat.info_name`
  - `chat.input_placeholder_compact`
  - `chat.greeting`
- legal 用:
  - `legal.placeholder.*`
  - `legal.link.returns`
  - `returns.updated`

## 8. リスク

- 現時点では辞書だけ追加しても UI は変わらない。実際の表示改善には他ワーカー側の配線が必要。
- `legal.value.payment_note` は Stripe のみ前提。将来 Shopify native checkout を主にするなら文言再確認が必要。
- `WORLDWIDE SHIPPING` と legal の送料表記は実運用確定後に整合確認が必要。
