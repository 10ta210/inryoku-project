# i18n Foundation — 2026-04-28

inryokü サイトの英語版骨格 (Phase 1: 土台のみ)。
**今は本実装ではない。将来切替できる土台。日本語完全動作維持。**

## 0. 完了したもの

- `/i18n.json` — 翻訳辞書 (118 キー + メタ)
- `/i18n.js` — 切替ロジック・DOM 適用・UI 注入
- `/i18n.css` — 言語切替トグルのスタイル
- `index.html` / `p3_test.html` の `<body>` 末尾に i18n ロード追加
- `node --check i18n.js` ✓
- `JSON.parse(i18n.json)` ✓ / 118 翻訳キー

## 1. URL 戦略の比較

| 方式 | 例 | SEO | 工数 | リスク | 採用判断 |
|---|---|---|---|---|---|
| **クエリ ?lang=en** | `inryoku.com/?lang=en` | △ (canonical注意) | 低 | サーバ変更不要 | **Phase 1: 採用** |
| **パス /en/** | `inryoku.com/en/` | ◎ | 中 | server.js / nginx ルーティング必要 | Phase 2: 移行候補 |
| **サブドメイン en.** | `en.inryoku.com` | ◎ | 高 | DNS / 証明書 / Stripe Webhook 別経路 | 不採用 |

**推奨ロードマップ**: Phase 1 で `?lang=en` を稼働 → 反応を見て Phase 2 で `/en/` (静的 prerender) へ昇格。i18n.js は既に両方読める実装。

## 2. 設計原則

1. **日本語が source of truth**。en は派生。`_meta.philosophy_glossary` で哲学用語の対応を一元管理。
2. **既存 DOM 非破壊**。`data-i18n` 属性が付いた要素のみ翻訳。未付与要素はそのまま。
3. **後付け方式**。p3_code_for_claude.js / particle_*.* / p3_styles.css / server.js には触らない。
4. **初期状態は ja**。`?lang=en` または UI クリックで明示的に切替。
5. **localStorage で記憶**。次回訪問時は最後の選択を尊重 (ただし URL クエリ優先)。

## 3. 言語判定の優先順位

i18n.js `detectLang()` の順序:

1. URL クエリ `?lang=en|ja`
2. パスプレフィックス `/en/` (将来用)
3. `localStorage['inryoku.lang']`
4. `navigator.language` が `en*` → en
5. デフォルト `ja`

ja は強くデフォルト維持 (Accept-Language で en 以外なら ja)。

## 4. data-i18n 属性 — 適用ガイド

```html
<!-- textContent を翻訳 -->
<button data-i18n="p0.welcome.cta">ENTER</button>

<!-- 属性を翻訳 (placeholder, aria-label, title など) -->
<input data-i18n-attr="placeholder:p2.passcode.placeholder,aria-label:p2.passcode.label">

<!-- 複数組み合わせ可 -->
<a data-i18n="footer.legal" data-i18n-attr="aria-label:footer.legal">特定商取引法</a>
```

- 元コピーは `data-i18n-orig` に自動退避 → 翻訳失敗時のフォールバック。
- 翻訳キー欠落時はキー名がそのまま入る (デバッグしやすさ優先)。

## 5. キー命名規則

`section.element.purpose` のドット区切り 3 階層を基本。

- `meta.*` — `<meta>` / `<title>` / OG
- `brand.*` — ブランド固有語
- `p0.*` / `p1.*` / `p2.*` / `p3.*` — 各 Phase
- `shop.*` / `product.<id>.*` / `cart.*` / `checkout.*` — EC
- `philosophy.*` — 哲学用語 (両言語で核を維持)
- `chat.*` — AI チャット
- `footer.*` / `common.*` / `a11y.*` / `lang.*` / `modal.*`

## 6. 哲学用語の英訳指針 (固定)

| 日本語 | 英訳 | 備考 |
|---|---|---|
| 50% → 101% | 50% → 101% | **記号として両言語共通** |
| 観測 / 観測者 | observe / the observer | quantum的含意を残す |
| 見えないものの可視化 | making the invisible visible | 動詞句で能動性 |
| グレーの中に虹 | the rainbow within grey | "in" でなく "within" |
| 50→101 を観測する者たちへ | for those who observe the 50→101 | 矢印は記号維持 |
| 哲学を纏う服 | philosophy worn as cloth | "wear" でなく分詞 |
| 引力 | inryokü (gravity) | ブランド名の由来として括弧で補足 |
| 原色論 | doctrine of primary color | 哲学用語感を維持 |
| RGB=Black, CMY=White, You=Rainbow | そのまま | 数式的シグネチャは不変 |

**翻訳の核**: 直訳ではなく "響き" を保つ。商業的な英語にしない。grey は "gray" でなく "grey" を一貫採用 (英国綴り = inryokü 美学)。

## 7. SEO — hreflang 設定方針

`index.html` / `p3_test.html` の `<head>` に追加する (Phase 2 で en 公開時):

```html
<link rel="canonical" href="https://inryoku.com/">
<link rel="alternate" href="https://inryoku.com/" hreflang="ja">
<link rel="alternate" href="https://inryoku.com/?lang=en" hreflang="en">
<link rel="alternate" href="https://inryoku.com/" hreflang="x-default">
```

`/en/` パス採用時は `href` を `https://inryoku.com/en/` に差し替え。

`<html lang="ja">` は i18n.js が動的に `en` へ書き換える。SEO 的には初期 `lang="ja"` が canonical。

## 8. sitemap.xml 更新案

Phase 2 (`?lang=en` 公開時) でエントリ追加:

```xml
<url>
  <loc>https://inryoku.com/</loc>
  <xhtml:link rel="alternate" hreflang="ja" href="https://inryoku.com/"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://inryoku.com/?lang=en"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://inryoku.com/"/>
</url>
```

namespace 追加: `xmlns:xhtml="http://www.w3.org/1999/xhtml"`。

## 9. 動的コンテンツ

### 9.1 AI チャット

`window.inryokuI18n.getLang()` を読んで system prompt を切替:

```js
var lang = window.inryokuI18n ? window.inryokuI18n.getLang() : 'ja';
var systemPrompt = window.inryokuI18n.t('chat.system_prompt_lang');
// → ja: "日本語で返答してください。inryokü の哲学を保ちながら。"
// → en: "Respond in English. Preserve the inryokü philosophy."
```

p3_code_for_claude.js は触らない方針なので、チャット呼び出し箇所が分離されたら適用。

### 9.2 商品説明

`product.<sku>.name` / `product.<sku>.desc` を辞書に追加。実商品 12 型のうち主要 4 型を辞書に登録済み。残り 8 型は司さんの最終コピー確定後に追加。

`<h2 data-i18n="product.enter_hoodie.name">ENTER フーディー</h2>` のように差し込む。p3_code_for_claude.js が動的生成しているなら、生成後に `window.inryokuI18n.applyDom(productNode)` を呼ぶ。

## 10. 残実装ロードマップ

### Phase 1 (今): 土台 ← **完了**
- [x] 辞書 + 切替ロジック + UI
- [x] HTML への ロード追加
- [x] node --check 通過

### Phase 2: data-i18n 付与 (1〜2 日)
- [ ] index.html / p3_test.html の `<title>`, `<meta name="description">`, OG タグに `data-i18n-attr` を後付け
- [ ] フッターリンク (legal/privacy/returns/size-guide) に `data-i18n`
- [ ] 静的に書かれている主要見出し・ボタンに `data-i18n`
- [ ] 動的生成されている要素 (cart, product modal) は p3_code_for_claude.js を触らずに `MutationObserver` で `applyDom()` する観察者を i18n.js に増設するか、生成完了 event をフックする

### Phase 3: SEO 本実装 (1 日)
- [ ] hreflang タグ追加
- [ ] sitemap.xml 更新
- [ ] `<meta http-equiv="Content-Language">` を JS で動的更新
- [ ] OG locale を `getLang()` に追従

### Phase 4: /en/ パス昇格 (要 server.js 変更 → 司さんの判断)
- [ ] server.js に `/en/*` ルーティング (静的 mirror or rewrite)
- [ ] prerender して static HTML 生成
- [ ] `?lang=en` は 301 → `/en/` に統一

### Phase 5: 動的コンテンツ言語追従
- [ ] AI チャット system prompt を `getLang()` で切替
- [ ] 商品全 12 型の英訳 (司さんの最終コピー確定待ち)
- [ ] Stripe checkout `locale` パラメータを `getLang()` で

## 11. 翻訳ガイド (司さん向け)

新キー追加時:

1. `i18n.json` を開く。
2. 適切な section に追加: `"section.element.purpose": { "ja": "...", "en": "..." }`
3. 哲学用語が含まれるなら §6 表に従う。迷ったら `_meta.philosophy_glossary` 参照。
4. HTML 側で `<el data-i18n="section.element.purpose">日本語コピー</el>` のように差し込む。
5. ブラウザで `?lang=en` を開いて確認。

**英訳トーン規範**:

- **避ける**: 商業的な誇張 (`amazing`, `incredible`)、過剰な感嘆符、SEO 詰め込み
- **目指す**: 静かな宣言、詩的な余白、句点で止まる短文
- **小文字**: 哲学的フレーズ (`making the invisible visible`) は文中でも小文字維持。固有名詞 (`ENTER`, `RGB`, `inryokü`) のみ大文字。
- **記号**: `→` `=` は両言語で同一。
- **句読点**: 全角句読点 (。、) は en では使わない。en は `.` `,` のみ。

## 12. 実装制約 — 確認

- [x] 触らない: p3_code_for_claude.js / particle_*.* / p3_styles.css / server.js
- [x] 新規依存追加なし (vanilla JS / fetch / localStorage のみ)
- [x] 初期動作 ja のまま (en は明示的切替時のみ)
- [x] index.html / p3_test.html は `<body>` 末尾の追加 1 セットのみ

## 13. 既知の限界 / Phase 2 で扱う

- **p3_code_for_claude.js が動的に DOM 生成する箇所** (商品カード、モーダル等) は data-i18n 不在のため `?lang=en` でも翻訳されない。MutationObserver か明示的 `applyDom()` 呼び出しのいずれかで解決予定。
- **JSON-LD 構造化データ**は `inLanguage: "ja-JP"` 固定。Phase 3 で en 用の duplicate ブロックを追加。
- **OG locale の動的切替**は `<meta property="og:locale">` を JS 書き換えしても SNS クロール時には反映されない (キャッシュ済み)。Phase 4 で `/en/` に独立 OG を持たせる。
- **flash of untranslated content**: `?lang=en` で訪問しても初回描画は ja。fetch + applyDom 完了後に切替。許容範囲だが、気になれば critical 文字列だけ inline 辞書化可能。

## 14. テスト手順

```bash
# 1. 構文チェック
node --check i18n.js

# 2. JSON 健全性
node -e "JSON.parse(require('fs').readFileSync('i18n.json','utf8'))"

# 3. ブラウザ手動
# - / で開く → ja で全部見える、左下に "JA / EN" トグル
# - /?lang=en で開く → data-i18n 付与要素のみ en に切替
# - EN クリック → URL に ?lang=en 付加、localStorage 保存
# - リロード → 言語維持
# - JA クリック → URL から ?lang 除去、ja に戻る
```

## 15. 触ったファイル / 触っていないファイル

**新規**: i18n.json / i18n.js / i18n.css / docs/i18n-foundation-2026-04-28.md
**最小変更**: index.html (末尾 4 行), p3_test.html (末尾 4 行)
**触っていない**: p3_code_for_claude.js / particle_*.* / p3_styles.css / server.js / enhance.* / register.js / perf-observer.js / sw.js / manifest.json
