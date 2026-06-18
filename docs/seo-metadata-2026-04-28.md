# SEO / Metadata / OG / JSON-LD 監査・改善実装ログ

**日付**: 2026-04-28
**範囲**: index.html `<head>` / p3_test.html `<head>` / manifest.json / sitemap.xml (新規) / robots.txt (新規)
**触らなかったファイル**: server.js / p3_code_for_claude.js / p3_styles.css / particle_*.* / Codex 編集中の body 部分

---

## 1. エグゼクティブサマリー

inryokü は哲学的ブランドかつ EC（12商品）。SEO の本質は「**観測されない哲学は存在しないのと同じ**」── すなわちクローラと SNS bot とユーザーの三者すべてに「見えるかたち」で意味を提示する作業。

実装方針は次の三層:

| 層 | 目的 | 実装 |
|---|---|---|
| **Layer 1: 機械可読** | クローラ / LLM / リッチリザルト | JSON-LD @graph, Product×12, ItemList, Breadcrumb, Org, Brand, OnlineStore, WebSite, WebPage |
| **Layer 2: SNS 共有** | OGP / Twitter Card | image:width/height/alt, locale:alternate, twitter:site/creator |
| **Layer 3: モバイル / PWA** | iOS / Android ホーム追加 | maskable icons, shortcuts, screenshots, apple-mobile-web-app-* |

哲学的トーン（`50% → 101%` / `見えないものの可視化` / `グレーの中に虹がある`）は title / description / og:* / JSON-LD slogan / manifest description すべてに織り込み、**SEO とブランディングを切り離さない**形にした。

---

## 2. ファイル別 diff サマリー

### 2.1 `index.html` `<head>`

#### 追加・改善

| 項目 | Before | After |
|---|---|---|
| title | `inryokü - 101% TRUTH` | `inryokü — 50% → 101% / 見えないものの可視化` |
| description | 英語1行のみ | 日本語＋英語、観測哲学を含む、150字以内 |
| keywords | なし | inryoku, 引力, 哲学, アパレル, RGB, CMY, 観測, 50%, 101%, グレー, 虹 ほか |
| author / publisher | なし | `inryokü` |
| robots | なし | `index, follow, max-image-preview:large, max-snippet:-1` |
| googlebot | なし | `index, follow` |
| color-scheme | なし | `dark light` |
| theme-color | 単発 | dark/light メディアクエリ両対応 |
| canonical / hreflang | canonical のみ | hreflang `ja` / `x-default` 追加 |
| icons | sizes 指定なし | 192/512 + shortcut + apple-touch-icon 180x180 |
| apple-mobile-web-app-* | なし | capable / status-bar-style / title 完備 |
| mobile-web-app-capable | なし | 追加 |
| msapplication-* | なし | TileColor / TileImage |
| og:image:width/height/type/alt | なし | 1200x630 / image/png / alt 日本語 |
| og:locale:alternate | なし | `en_US`（将来英語版用） |
| twitter:site / creator / image:alt | なし | `@inryoku` / alt 日本語 |
| preconnect | google-fonts のみ | + cdn.jsdelivr.net |
| dns-prefetch | なし | jsdelivr / fonts.googleapis |
| JSON-LD | （なし） | **`@graph` で Organization / Brand / WebSite / OnlineStore / WebPage / BreadcrumbList を一括宣言** |

#### 哲学トーンの埋め込み箇所

- `<title>`: `50% → 101% / 見えないものの可視化`
- `og:description`: 「観測すれば世界は変わる。グレーの中に虹がある。」
- JSON-LD `Organization.slogan`: `50% → 101% / 見えないものの可視化`
- JSON-LD `Brand.slogan`: `50% → 101%`
- `Organization.alternateName`: `["inryoku", "引力"]` ← 漢字表記も検索に拾わせる

### 2.2 `p3_test.html` `<head>`

`index.html` と同じ Layer 1〜3 を適用した上で、**12商品の Product JSON-LD を完全列挙**。

#### 追加された JSON-LD

1. **`@graph`**: Organization / Brand / WebSite / OnlineStore / BreadcrumbList（Home → Shop の2階層）
2. **`ItemList`**: 12商品の position 1〜12 を列挙（コレクションページ風）
3. **`Product × 12`**: schema.org/Product 完全準拠
   - `@id`: `https://inryoku.com/#<product.id>`
   - `name`, `sku`, `image`, `description`, `brand`, `category`, `color`
   - `offers`: priceCurrency=JPY, price, availability=InStock, itemCondition=NewCondition, seller=#organization

| id | name | price | category |
|---|---|---|---|
| enter-hoodie | ENTER HOODIE | ¥12,800 | Hoodies |
| logo-hoodie | inryokü LOGO HOODIE | ¥12,800 | Hoodies |
| enter-hoodie-white | ENTER HOODIE — GREY | ¥12,800 | Hoodies |
| logo-hoodie-oversized | inryokü LOGO OVERSIZED | ¥14,800 | Hoodies |
| enter-tee | ENTER TEE | ¥8,800 | T-Shirts |
| logo-tee | inryokü LOGO TEE | ¥8,800 | T-Shirts |
| enter-longsleeve | ENTER LONG SLEEVE | ¥9,800 | Long Sleeves |
| logo-longsleeve | inryokü LOGO LONG SLEEVE | ¥9,800 | Long Sleeves |
| enter-crewneck | ENTER CREWNECK | ¥11,800 | Sweatshirts |
| logo-crewneck | inryokü LOGO CREWNECK | ¥11,800 | Sweatshirts |
| enter-tank | ENTER TANK TOP | ¥6,800 | Tank Tops |
| logo-tank | inryokü LOGO TANK TOP | ¥6,800 | Tank Tops |

### 2.3 `manifest.json`

| 追加項目 | 値 |
|---|---|
| id | `/` |
| scope | `/` |
| display_override | `["standalone","minimal-ui","browser"]` |
| dir | `ltr` |
| icons (maskable) | 192 + 512 を `purpose: "maskable"` でも追加（Android アダプティブアイコン対応） |
| screenshots | inryoku_og.png をワイドフォームで |
| shortcuts | "Shop" → /p3_test.html |
| categories | + `art-and-design` |
| description | 「グレーの中に虹を見る人のためのストア」追加 |

### 2.4 `sitemap.xml`（新規）

- xmlns: sitemap 0.9 + image 1.1 + xhtml
- Top（priority 1.0, daily）/ p3_test.html（0.9, daily）/ 法定ページ4種 / 商品12種（フラグメント URL）
- `<image:image>` で og.png / 商品画像（webp） / ロゴを記述
- `<xhtml:link hreflang>` で ja / x-default

### 2.5 `robots.txt`（新規）

- `*`: success / dev用 HTML / node_modules / tests / vendor / docs / .env / クエリ付きを Disallow
- Googlebot / Googlebot-Image / Bingbot 明示許可
- **AI クローラ（GPTBot, ClaudeBot, anthropic-ai, CCBot, PerplexityBot）を明示 Allow** ← 司さんの「哲学を広める」方針との整合
- 攻撃的スクレイパ（Semrush, Ahrefs, MJ12）を Disallow
- Sitemap: https://inryoku.com/sitemap.xml

---

## 3. 既存問題の指摘（実装で解決済み）

| # | Issue | 解決 |
|---|---|---|
| 1 | index.html title が英語のみで日本語検索クエリに引っかからない | ja/en 両言語混合 title |
| 2 | og:image の width/height 未指定 → SNS で blank プレビュー発生 | 1200x630 明示 |
| 3 | og:image:alt 欠落 → アクセシビリティ違反 | alt 追加 |
| 4 | twitter:site / creator なし → X カードで attribution 不可 | `@inryoku` |
| 5 | JSON-LD なし（index.html）→ Google ナレッジパネル候補にならない | @graph で 6 type 同時宣言 |
| 6 | 商品の構造化データなし → リッチリザルト機会喪失 | Product × 12 完全列挙 |
| 7 | sitemap.xml / robots.txt 不在 → クロール効率低下 | 両方新規 |
| 8 | manifest.json に maskable icons なし → Android アダプティブで欠ける | maskable 追加 |
| 9 | hreflang なし → 将来英語版で重複コンテンツ判定リスク | x-default 予約 |
| 10 | apple-mobile-web-app-* 不完全 → iOS ホーム追加時にラベル/ステータスバーが崩れる | 完備 |

---

## 4. 検証方法（推奨ツール）

### 4.1 構造化データ
- **Schema.org Validator** — https://validator.schema.org/
  - p3_test.html を貼って `Product × 12` がパースされること
  - エラー 0、警告は brand のロゴ画素サイズ警告のみ許容
- **Google Rich Results Test** — https://search.google.com/test/rich-results
  - "Products" / "Sitelinks searchbox" / "Logo" / "Breadcrumbs" の 4 つが緑になる想定
- **Google Search Console > URL 検査**
  - 公開後、https://inryoku.com/ と https://inryoku.com/p3_test.html を投入

### 4.2 OG / Twitter
- **Facebook Sharing Debugger** — https://developers.facebook.com/tools/debug/
- **X Card Validator** — https://cards-dev.twitter.com/validator (現在は廃止傾向、X 上で実プレビュー確認)
- **LinkedIn Post Inspector** — https://www.linkedin.com/post-inspector/

### 4.3 PWA / Lighthouse
- Chrome DevTools > Lighthouse > **SEO + PWA + Best Practices** を実行
- 期待値:
  - **SEO: 100**（根拠は §5）
  - **PWA: installable** （maskable icon + manifest 完備）
  - **Best Practices: 100**

### 4.4 robots.txt / sitemap.xml
- **https://www.google.com/webmasters/tools/robots-testing-tool**
- **https://www.xml-sitemaps.com/validate-xml-sitemap.html**

### 4.5 HTML / Meta
- **https://metatags.io/** （リアルタイムプレビュー）
- **https://www.heymeta.com/**

### 4.6 hreflang
- **https://www.aleydasolis.com/english/international-seo-tools/hreflang-tags-generator/**

---

## 5. Lighthouse SEO 100 の根拠

Lighthouse の SEO スコアは以下のチェックで構成されている。各項目の充足状況:

| Audit | 充足 | 根拠 |
|---|---|---|
| `document-title` | ✅ | 両 HTML に `<title>` 60字以内 |
| `meta-description` | ✅ | 両 HTML に description 150字前後 |
| `http-status-code` | ✅ | server.js が 200 返す（既存） |
| `link-text` | ⚠️ body 側依存 | "click here" 系は Codex 担当 body にないことを目視確認推奨 |
| `crawlable-anchors` | ✅ | href 付きリンクのみ |
| `is-crawlable` | ✅ | robots.txt で / 全許可 + meta robots index,follow |
| `robots-txt` | ✅ | 新規作成、200 返却（server.js は静的配信） |
| `image-alt` | ⚠️ body 側依存 | 商品画像 alt は Codex 担当 |
| `hreflang` | ✅ | `ja` / `x-default` 設定 |
| `canonical` | ✅ | 両 HTML 完備 |
| `font-size` | ✅ | p3_styles.css 側の clamp 設計 |
| `tap-targets` | ✅ | 既存ボタン 44px 以上 |
| `viewport` | ✅ | 完備 |
| `structured-data` | ✅ | JSON-LD 6 type + Product 12 + ItemList |

**期待スコア: 100**（body 側 alt 漏れがなければ）

---

## 6. 商品 JSON-LD の動的生成案（将来の自動同期）

現在は p3_test.html に Product × 12 を**手書き列挙**している。これは「**読み取り限定**」のルールで p3_code_for_claude.js を編集できなかったため。将来、安全に編集できるタイミングで以下を実装すると保守性が上がる:

```javascript
// p3_code_for_claude.js の PRODUCTS 配列定義の直後に追加するコード（提案）
function injectProductJsonLd() {
  const products = PRODUCTS.map(p => ({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `https://inryoku.com/#${p.id}`,
    "name": p.name,
    "sku": p.id,
    "image": `https://inryoku.com/${p.image}`,
    "description": `${p.description} ${p.details}`,
    "brand": { "@type": "Brand", "name": "inryokü" },
    "color": p.color,
    "offers": {
      "@type": "Offer",
      "url": `https://inryoku.com/#${p.id}`,
      "priceCurrency": "JPY",
      "price": String(p.priceNum),
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": { "@id": "https://inryoku.com/#organization" }
    }
  }));
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(products);
  document.head.appendChild(s);
}
// renderPhase3() の冒頭で injectProductJsonLd() 呼び出し
```

利点: 価格や商品追加時に PRODUCTS 配列だけ更新すれば JSON-LD も自動同期。
欠点: ランタイム生成のため、JS 無効環境のクローラ（古い Bing 等）には届かない。Googlebot は JS 実行するので問題なし。

**推奨**: 当面は手書き（このコミット）+ Codex の編集ロックが解けたら動的化に移行。

---

## 7. 残課題 / Next Steps

1. **GA4 ID 投入** — p3_test.html L29 の `G-XXXXXXXXXX` を実 ID に置換（司さん作業）
2. **og:image の WebP 版** — 現在 PNG 522KB。1200x630 WebP 化で 80% 削減見込み
3. **画像 alt** — Codex の編集ロックが解けたら body 側商品 img の alt を全件埋める
4. **英語版 (`/en/`)** — `og:locale:alternate` と `hreflang` を予約済み。実ページ作成時に `https://inryoku.com/en/` を sitemap と alternate に追加
5. **AggregateRating / Review** — 商品レビュー機能実装後、Product JSON-LD に追加すれば★表示
6. **FAQPage JSON-LD** — size-guide.html / returns.html に Q&A 形式の構造化データを追加すると、検索結果でアコーディオン展開
7. **Server-side hreflang Header** — 現在 link rel で対応。将来 server.js 側で `Link: <...>; rel="alternate"; hreflang="ja"` HTTP ヘッダも併記すると堅牢
8. **Vary: Accept-Encoding / Accept-Language** — server.js の HTTP ヘッダに追加すべき（別エージェント担当）

---

## 8. 哲学的整合チェックリスト

- [x] `50% → 101%` が title / og:title / twitter:title / JSON-LD slogan に登場
- [x] `見えないものの可視化` が title / description / og:description に登場
- [x] `観測` の概念が description / og:description に明記
- [x] `グレーの中に虹` が og:description に含まれる
- [x] `引力` （inryokü の漢字）が JSON-LD `alternateName` で検索可能化
- [x] AI クローラ（哲学を広める対象）を robots.txt で明示許可
- [x] フルネーム不使用（feedback_no_fullname.md 遵守 — author は "inryokü" のみ）

司さんの哲学が SEO の構造に染み込んだ。観測されるべきものが、観測される形で並んでいる。
