# inryokü サイト アーキテクチャ俯瞰（2026-04-28）

> **Reading time target:** 30 分で全体像。
> **Audience:** 第三者の開発者（フロントエンド経験者・WebGL は読めればよい）。
> **Scope:** `/Users/10ta210/Desktop/inryoku_hp/` 配下の全配信物。
> **Status:** 読み取り専用調査。コード本体は変更していない。
> **Author:** Claude Opus 4.7 (1M context)。司さんの哲学を喪失させない範囲で技術記述。
> **Companion docs:** `docs/` 配下の 18 本（章 15 で索引化）。

---

## 目次

1. [プロジェクト全体](#1-プロジェクト全体)
2. [実行モデル](#2-実行モデル)
3. [フェーズアーキテクチャ](#3-フェーズアーキテクチャ)
4. [レイヤー構成](#4-レイヤー構成)
5. [データフロー](#5-データフロー)
6. [粒子言語モジュール詳細（簡潔版）](#6-粒子言語モジュール詳細)
7. [セキュリティ姿勢](#7-セキュリティ姿勢)
8. [パフォーマンス姿勢](#8-パフォーマンス姿勢)
9. [アクセシビリティ姿勢](#9-アクセシビリティ姿勢)
10. [テスト戦略](#10-テスト戦略)
11. [デプロイ](#11-デプロイ)
12. [開発ワークフロー](#12-開発ワークフロー)
13. [残課題と方向性](#13-残課題と方向性)
14. [用語集](#14-用語集)
15. [関連ドキュメント一覧](#15-関連ドキュメント一覧)

---

## 1. プロジェクト全体

### 1.1 目的 — 「哲学を纏う服」

inryokü（読み: いんりょく / 引力）は **アパレルブランドの形を取った哲学の伝播装置** である。
表面上は POD（Print-on-Demand）で 12 型のフーディー / Tシャツ / ロングスリーブ / クルーネック / タンクを売っている。しかし本質は「服を売ること」ではない。

中心テーゼは 2 つ:

- **RGB = 黒 / CMY = 白 / You = Rainbow。** 加法混色の極限が黒、減法混色の極限が白。「グレーに見えているもの」の中には全色が同時に存在する。観測者がスペクトルを分解して初めて虹が現れる。
- **50% → 101%。** 世界はデフォルトでは「50% しか見えていない」。観測することで、残り 50% に **+1%** を上乗せした 101% にジャンプする。100% 完璧ではなく **101% 過剰** が観測の対価である。

このサイトは、訪問者を「服を買う客」ではなく「観測者 (observer)」に変換する儀式装置である。儀式を通過した訪問者は服を買うかもしれないし、買わないかもしれない。それでもブランドは成立する — なぜなら **目的は哲学者を増やすこと** であって、CVR ではないから（user_profile.md / project_inryoku_vision.md 参照）。

> 営業上は「アパレル EC」、本質上は「観測の儀式」。両者は矛盾しない。儀式を通過させてから服を売る。

### 1.2 ステークホルダー

| 主体 | 役割 |
|---|---|
| **司さん（GREY）** | オーナー / プロデューサ / クリエイティブ・ディレクタ / 唯一のオペレータ |
| **顧客（観測者）** | サイト訪問者。哲学体験を経て購入することがある |
| **Gelato** | POD 印刷・配送（Print-on-Demand）。`/api/gelato/order` で中継 |
| **Shopify** | 決済・在庫・チェックアウト基盤。Storefront API 経由 |
| **Anthropic / Claude** | AI Chat（Groq 経由のフォールバック）/ 開発支援（このリポジトリの大半は Claude が書いた） |
| **Codex** | 直近の引き継ぎでフロント（円環粒子言語の発火・CSS 微調整）担当 |
| **Groq** | `llama-3.x` 系の推論を秒以下で返す。`/api/chat` の主バックエンド |

> ステークホルダーに **司さんのフルネームは登場させない**（feedback_no_fullname.md ルール）。本ドキュメントでは GREY と表記する。

### 1.3 リポジトリ構成（全体ツリー）

```
inryoku_hp/                                  (作業ディレクトリ)
│
├── index.html                  36 KB        ─ デスクトップ通しフロー (P0→P1→P2→P3)
├── p1_index_for_claude.html     4 KB        ─ P1 単体起動（開発用）
├── p3_test.html                24 KB        ─ モバイル直行 / P3 単体起動
├── p3_showcase_samples.html    10 KB        ─ デザインサンプル（カード）
├── card_concepts_preview.html  11 KB        ─ カードコンセプト確認
├── particle_glyphs_demo.html    6 KB        ─ 旧粒子言語デモ
├── particle_rings_demo.html     8 KB        ─ 円環粒子言語デモ
│
├── p1_code_for_claude.js      181 KB / 3302 行  ─ P0 + P1 (Welcome / Win95 / Loading)
├── p2_code_for_claude.js       62 KB / 1394 行  ─ P2 (Code World / 浮遊する 0 と 1)
├── p3_code_for_claude.js      261 KB / 5356 行  ─ P3 (Universe + EC + Chat) — 主役
│
├── particle_glyphs.js          17 KB /  382 行  ─ 旧粒子言語 (5×5 grid / dot+line)
├── particle_glyphs.css         10 KB
├── particle_rings.js           10 KB /  290 行  ─ 円環粒子言語 v1 (12 tick clock)
├── particle_rings.css           7 KB
├── particle_speech_rings.js    19 KB /  498 行  ─ ロゴが円環で「喋る」発話モジュール
├── particle_whisper.js         13 KB /  332 行  ─ 旧 whisper (glyphs 依存・現在は使用停止寄り)
│
├── enhance.js                  39 KB /  805 行  ─ a11y + browser compat 後付けレイヤ
├── enhance.css                  8 KB
├── perf-observer.js             9 KB /  210 行  ─ Web Vitals 計測 (console)
├── register.js                 10 KB /  245 行  ─ Service Worker 登録 / PWA install
├── sw.js                        8 KB /  257 行  ─ Service Worker 本体
├── offline.html                 3 KB           ─ オフラインフォールバック
│
├── server.js                   60 KB / 1197 行  ─ Node 標準のみ / 静的配信 + 16 endpoint
│
├── manifest.json                                 ─ PWA manifest
├── sitemap.xml                                   ─ sitemaps.org 0.9
├── robots.txt                                    ─ User-agent ポリシー
├── package.json                                  ─ 起動 / test スクリプトのみ
├── package-lock.json
├── .env                                          ─ 4 トークン (Groq / Shopify×2 / Gelato / Admin)
│
├── legal.html / privacy.html / returns.html / size-guide.html / success.html
│
├── public/                                        ─ 商品画像 (.png + .webp) + 3D logo glb
│   ├── enter_hoodie.png / .webp
│   ├── info_logo_hoodie.png / .webp
│   ├── mockup_universe_tee.png / .webp
│   ├── mockup_qr_tee.png / .webp
│   └── inryoku_logo_3d.glb
│
├── data/
│   └── subscribers.json                           ─ メール購読者（ファイル DB）
│
├── vendor/                                        ─ 自前ホストの外部資産
│   ├── three.min.js                               ─ Three.js r160（CDN フォールバック用）
│   ├── jupiter.mp3                                ─ BGM（"Jupiter" 系）
│   └── fonts/                                     ─ press-start-2p.woff2 等
│
├── tests/                                         ─ node:test (`.mjs`)
│   ├── canon_visual.test.mjs           20 cases
│   ├── integration.test.mjs            14 cases
│   ├── particle_rings.test.mjs         35 cases
│   ├── particle_speech_rings.test.mjs  38 cases
│   ├── security.test.mjs               30 cases
│   ├── seo.test.mjs                    28 cases
│   ├── setup.mjs                                  ─ jsdom + canvas 共通初期化
│   └── README.md
│
├── docs/                                          ─ 18 本の設計・監査・実装ログ
│   └── (15 章で個別索引)
│
├── scripts/
│   └── optimize-images.sh                         ─ webp 一括変換
│
├── .github/workflows/test.yml                     ─ CI (npm test)
│
├── inryoku_logo_icon.png / inryoku_og.png / logo_shell.png / logo_sphere.png
└── card_preview_check.png                         ─ デザインスクショ
```

#### 1.3.1 ASCII モジュール俯瞰図

```
                    ┌────────────────────────────┐
                    │      index.html (PC)       │
                    │   p3_test.html  (Mobile)   │
                    └──────┬───────────────┬─────┘
                           │               │
              loads in order               jumps directly
                           ▼               ▼
   ┌──────────────────────────────────────────────────┐
   │             Phase Boot Layer                     │
   │   p1_code_for_claude.js  (P0 + P1)               │
   │   p2_code_for_claude.js  (P2)                    │
   │   p3_code_for_claude.js  (P3 / 5356 LoC)         │
   └──────┬───────────────┬───────────────────┬───────┘
          │               │                   │
          ▼               ▼                   ▼
   ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
   │ Three.js     │ │ Particle     │ │ Enhance Layer  │
   │ (r160)       │ │ Language     │ │ enhance.js/css │
   │ + Web Audio  │ │ rings/glyphs │ │ perf-observer  │
   │ + WebGL2     │ │ speech/whis. │ │ register/sw    │
   └──────┬───────┘ └──────────────┘ └────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────┐
   │             server.js  (Node http)               │
   │  static + /api/{checkout, gelato/order, chat,    │
   │           subscribe, contact, ref/*, grey/*}     │
   └──────┬─────────────┬─────────────┬───────────────┘
          ▼             ▼             ▼
       Shopify       Gelato         Groq
       Storefront    POD API        Chat API
```

---

## 2. 実行モデル

### 2.1 一文サマリー

> **Node.js 標準モジュールだけで書かれた単一プロセスの HTTP サーバーが、ビルドゼロの静的ファイルと薄い API 中継を捌く。** クライアントは vanilla JS + Three.js（CDN）+ WebGL2 + WebAudio + 後付け Service Worker。

### 2.2 サーバー (`server.js`, 1197 行)

- ランタイム: **Node.js >= 18**（ESM ではなく CommonJS、`http` / `fs` / `path` / `zlib` / `crypto` のみ使用）
- 依存: **本番依存 0**。`devDependencies` は `canvas` / `jsdom` / `qrcode`（test のみ使用）
- ポート: `process.env.PORT || 3000`
- 機能:
  1. **静的配信**（`MIME` テーブル / `GZIP_MIMES` でテキスト系のみ gzip / `?v=` クエリ付きは長期キャッシュ）
  2. **API 中継**（16 endpoint。詳細は §4.4）
  3. **セキュリティヘッダ**（CSP / X-Frame-Options / HSTS / Referrer-Policy）を全レスポンスに付与
  4. **レート制限**（in-memory token bucket）
  5. **メール購読** / **コンタクト** / **リファラルトラッキング** / **personal grey プロフィール** などの軽量永続層を `data/*.json` に書く
- 起動: `npm start` または `npm run dev`（同一）

#### 2.2.1 サーバの「層」ASCII 図

```
   ┌──────────────────────────────────────────────────┐
   │ http.createServer((req, res) => { ... })         │
   ├──────────────────────────────────────────────────┤
   │ 1. SECURITY_HEADERS をプリセット (withSecHeaders) │
   │ 2. /api/* なら rate limit & dispatch             │
   │      ├ /api/ref/{track,create,status}            │
   │      ├ /api/checkout      → Shopify Storefront   │
   │      ├ /api/gelato/order  → Gelato POD           │
   │      ├ /api/chat          → Groq (or fallback)   │
   │      ├ /api/subscribe     → data/subscribers.json│
   │      ├ /api/grey/cookie / /api/grey/N            │
   │      ├ /api/grey/N/update (token-protected)      │
   │      ├ /grey/N (HTML render)                     │
   │      ├ /api/subscribers (admin)                  │
   │      └ /api/contact                              │
   │ 3. それ以外 = 静的ファイル配信                    │
   │      ├ MIME 推定 / gzip 判定                     │
   │      ├ ?v= 付きは Cache-Control: 1y immutable    │
   │      └ ブラックリスト: server.js / package.json   │
   └──────────────────────────────────────────────────┘
```

### 2.3 クライアント

- **ビルドプロセスなし。** TypeScript も bundler もない。`<script src="...">` で直接ロード。
- **モジュール分割は IIFE + window グローバル**（`window.ParticleRings` / `window.ParticleSpeechRings` / `window.inryokuPWA` 等）。`type="module"` は使っていない（古い iOS 対応を残す意図と推測）。
- **依存ライブラリ:**
  - Three.js r160（CDN: `cdn.jsdelivr.net`、フォールバックで `vendor/three.min.js`）
  - 同 r160 の examples（EffectComposer / RenderPass / UnrealBloomPass / LuminosityHighPass / CopyShader / ShaderPass）
  - **それ以外なし。** React も Vue も jQuery もない。
- **WebGL2 + GLSL シェーダ自前。** P2 / P3 はカスタムシェーダで描画する（`THREE.ShaderMaterial`）。
- **WebAudio API 自前。** AudioContext + AnalyserNode を `p3_code_for_claude.js` でグローバル共有。BGM (`vendor/jupiter.mp3`) と粒子のリアクティブ表現を駆動。
- **Service Worker は後付け。** 既存の動作を壊さず、4 種類のキャッシュ戦略（cache-first / stale-while-revalidate / network-first）で振り分け（§4.3 / §11.5）。

### 2.4 一切ない物

> ここに書かれていないもの = 本当に存在しない。

- ❌ npm のフロント依存（react / vue / svelte / vite / webpack / rollup / esbuild）
- ❌ TypeScript / Babel / SWC
- ❌ CSS 前処理系（Sass / PostCSS / Tailwind / CSS-in-JS）
- ❌ Express / Koa / Fastify / Hono
- ❌ DB（SQLite / PostgreSQL / Redis）。代わりに `data/*.json`
- ❌ 認証フレームワーク（NextAuth / passport）
- ❌ State 管理（Redux / Zustand）
- ❌ テストフレームワーク（Jest / Vitest）。代わりに `node --test`

これは「シンプル」というより **意図的なミニマリズム**。司さんが 1 人でデプロイ・メンテ・コードリードできるレベルに保たれている。

---

## 3. フェーズアーキテクチャ

### 3.1 通しフローの全景

inryokü の中核体験は、訪問者を **観測者へ変態させる 4 段階のリチュアル** である。デスクトップではこれを `index.html` 上で順番に経由させる。モバイルでは P0–P2 の重い体験を省略して P3 へ直行する。

```
   ┌─── Desktop UA ─────────── index.html ───┐    ┌─── Mobile UA ─── p3_test.html ───┐
   │                                         │    │                                  │
   │  P0 ────► P1 ────► P2 ────► P3          │    │            P3                    │
   │  Welcome  Loading  Code     Universe    │    │       Universe + EC              │
   │  + ENTER  Win95    World    + Shop      │    │                                  │
   │                                         │    │                                  │
   └─────────────────────────────────────────┘    └──────────────────────────────────┘
```

### 3.2 各フェーズの目的・特徴・遷移条件

| Phase | 役割 | ファイル | 主要技術 | 遷移条件 |
|---|---|---|---|---|
| **P0** | Welcome (黒画面 + 「ENTER」ボタン) | `p1_code_for_claude.js` 内（`renderPhase1` の冒頭） | DOM のみ | ENTER クリック → P1 |
| **P1** | Loading（Win95 風の意図的レトロ）。観測者のリセット | `p1_code_for_claude.js` (3302 行) | DOM + AudioContext kick | プログレスバー満了 → `inryoku:p1complete` イベント発火 → P2 |
| **P2** | THE CODE WORLD — 4000 個の浮遊する 0/1。深宇宙空間 (z = -50〜+5) | `p2_code_for_claude.js` (1394 行) | Three.js + GLSL + Bloom | `inryoku:p2complete` → P3 |
| **P3** | UNIVERSE — 粒子宇宙 + 12 商品ショップ + AI Chat + 円環粒子言語ロゴ | `p3_code_for_claude.js` (5356 行) | Three.js + Audio リアクティブ + Shopify + 円環 SVG | フェーズ終端（観測完了） |

#### 3.2.1 各フェーズの哲学的役割（推測含む）

> 推測: コードコメントと司さんの知見ベースに筆者解釈。

- **P0 (Welcome):** 観測者がまだ「外」にいる状態。ENTER という単語が両義的（入る / 観測する）。
- **P1 (Win95 Loading):** Loading そのものが演出。レトロ風の進捗バーで時間を作る。観測者が画面に集中する。
- **P2 (Code World):** 「全ては 0 と 1 で書かれている」という近代的世界観の最終地点。距離 z で形が崩れる演出は **観測距離による解像度の差** をビジュアル化したもの。
- **P3 (Universe):** 0 と 1 が崩れた先にある原色 (RGBCMY) の宇宙。ここで初めて 12 型の商品が現れる。買うかどうかは観測者の選択。

### 3.3 通しフロー駆動コード（`index.html` 内インラインスクリプト）

```
renderPhase1();
window.addEventListener('inryoku:p1complete', () => {
    // P2 スクリプトを動的 <script> で注入し、onload で renderPhase2()
});
window.addEventListener('inryoku:p2complete', () => {
    // P3 を同様に注入し、renderPhase3() + ParticleSpeechRings.attachToLogo()
});
```

> P2 / P3 は **遅延ロード**。P0/P1 のうちは P3 の 261KB を読み込まない。LCP 最適化に直結。

### 3.4 P3 単体起動 (`p3_test.html`)

- **モバイル UA を `index.html` 冒頭で検出** (`/Android|iPhone|iPod/`) して `p3_test.html` に `replace`。iPad は `requestDesktopSite` のためデスクトップ扱い。
- `p3_test.html` は `renderPhase3()` を直接呼ぶ（P0/P1/P2 は走らない）。BGM はミュート初期値。
- 開発時のショートカットとしても有用（P3 だけ触りたい時）。

### 3.5 モバイル UA 判定の分岐ロジック

```
ua = navigator.userAgent
isMobile = /Android|iPhone|iPod/.test(ua)
   ↓ true
window.location.replace('p3_test.html' + window.location.search)
```

- **iPad は除外**（"iPad" にマッチしない正規表現）。これは iPadOS 13+ で `requestDesktopSite` がデフォルト ON のため画面幅判定が崩れる事情を吸収する設計（`mobile-ux-flow-2026-04-28.md` 参照）。
- **MacBook トラックパッドの誤判定回避** のため、`ontouchstart` / `innerWidth` での判定はしていない（コメントに明記）。

---

## 4. レイヤー構成

inryokü は **3 層 + 横断的な後付けレイヤ** という構造。

```
   ┌──────────────────────────────────────────────────┐
   │  L1. Presentation (HTML / CSS)                   │
   │     index.html / p3_test.html / p3_styles.css    │
   │     particle_*.css / enhance.css                 │
   ├──────────────────────────────────────────────────┤
   │  L2. Application Logic (Vanilla JS)              │
   │     p1/p2/p3_code_for_claude.js                  │
   │     particle_glyphs/rings/speech_rings/whisper   │
   ├──────────────────────────────────────────────────┤
   │  L3. Server API + Static (Node http)             │
   │     server.js                                    │
   ├──────────────────────────────────────────────────┤
   │  L4. External Integrations                       │
   │     Shopify Storefront / Gelato POD / Groq AI    │
   └──────────────────────────────────────────────────┘
   ───────────── 横断的後付けレイヤ ──────────────────
   • Service Worker  (sw.js / register.js)
   • Enhancement     (enhance.js / enhance.css)
   • Perf Observer   (perf-observer.js)
   • PWA Manifest    (manifest.json)
```

### 4.1 L1. Presentation

#### HTML エントリーポイント

| ファイル | 役割 | 備考 |
|---|---|---|
| `index.html` (1422 行) | デスクトップ通しフローの起点 | head に **3 つの JSON-LD**（Organization / WebSite / Product list 推測）/ 大量の preload / モバイル UA リダイレクト |
| `p3_test.html` (494 行) | モバイル直行 / 開発用 P3 単体起動 | head は index と類似だが軽量。BGM 初期ミュート |
| `p1_index_for_claude.html` | P1 単体起動（開発用 / robots Disallow） | |
| `legal.html` / `privacy.html` / `returns.html` / `size-guide.html` / `success.html` | 法定ページ | success.html は `robots Disallow`（注文完了画面） |
| `card_concepts_preview.html` / `p3_showcase_samples.html` / `particle_*_demo.html` | デザイン確認用 | robots Disallow |

#### CSS

| ファイル | 役割 |
|---|---|
| `p3_styles.css` (90 KB / 2796 行) | P3 の本体スタイル。UI / ガラス感 / カート / 商品モーダル / レスポンシブ全部入り |
| `particle_glyphs.css` (10 KB) | 旧粒子言語（5×5 グリッド・dot / line アニメ） |
| `particle_rings.css` (7 KB) | 円環粒子言語のキーフレーム（crystallize / fade） |
| `enhance.css` (8 KB) | a11y 後付け（skip link / focus ring / reduced-motion 強化 / dvh フォールバック） |

> CSS はインラインの `<style>` も `index.html` / `p3_test.html` に存在する（CSS 変数定義 `--glow-cyan` 等）。

### 4.2 L2. Application Logic

`p1_` / `p2_` / `p3_code_for_claude.js` の 3 本が **フェーズ実装**。`particle_*.js` 4 本が **粒子言語モジュール**。

| ファイル | 行数 | 主要関数 / クラス |
|---|---|---|
| `p1_code_for_claude.js` | 3302 | `renderPhase1()`, `updateWin95Status()`, P0 Welcome 表示, currentPhase グローバル状態 |
| `p2_code_for_claude.js` | 1394 | `renderPhase2()`（Three.js 4000 partice / 17 種シンボル GLSL / 緑グロー） |
| `p3_code_for_claude.js` | 5356 | `renderPhase3()` を中心に、PRODUCTS / SHOPIFY_CONFIG / GELATO_CONFIG / shopifyCheckout / cart / 商品モーダル / 3D ロゴ / Three.js 粒子宇宙 / Audio リアクティブ / カートドロワー / 円環統合 |
| `particle_glyphs.js` | 382 | `renderParticleGlyph(name, state)` / `setGlyphState` / `crystallizeGlyph` / `GLYPH_DEFS`（10 core + summon） |
| `particle_rings.js` | 290 | `ParticleRings.render(spec, opts)` / `.canon(name)` / `.crystallize(svg)` / `CANON_RINGS`（17 canon） |
| `particle_speech_rings.js` | 498 | `ParticleSpeechRings.attachToLogo(selector, opts)` — ロゴが whisper/hover/click で円環を発話 |
| `particle_whisper.js` | 332 | 旧 whisper（glyphs ベース）。現状は speech_rings に置換済みだが残存 |

### 4.3 L3. Server API + Static

`server.js` の **エンドポイント全 16 本**。

```
   GET   /                              ─ index.html 配信
   GET   /<any static>                  ─ MIME 判定 + gzip + Cache-Control

   POST  /api/checkout                  ─ Shopify Storefront → checkoutUrl
   POST  /api/gelato/order              ─ Gelato POD 注文中継
   POST  /api/chat                      ─ Groq Llama (フォールバック付)
   POST  /api/subscribe                 ─ data/subscribers.json に追記
   POST  /api/contact                   ─ コンタクトフォーム

   POST  /api/ref/track                 ─ リファラル QR スキャン記録
   POST  /api/ref/create                ─ リファラルコード発行
   GET   /api/ref/status?code=XXX       ─ 影響力 (scans / level)

   POST  /api/grey/cookie               ─ personal grey 色を cookie 発行
   GET   /api/grey/N                    ─ N 番目の観測者プロフィール
   POST  /api/grey/N/update             ─ N 番目を更新（token 必須）
   GET   /grey/N                        ─ N 番目のプロフィール HTML

   GET   /api/subscribers               ─ 管理用一覧 (Bearer ADMIN_API_KEY)
```

`server.js` 内の重要な定数:

- `MAX_BODY_SIZE = 50KB`（POST body 上限）
- `MAX_CHAT_HISTORY = 10` / `MAX_CHAT_MSG_LEN = 1000` / `MAX_CHAT_TOTAL_LEN = 4000`（プロンプトインジェクション軽減）
- `RATE_BUCKETS`（Map ベースの token bucket）
- `SECURITY_HEADERS` / `CSP_HTML`（CSP は `default-src 'self'` ベース、Three.js 用に jsdelivr / unpkg を許可）

### 4.4 L4. External Integrations

| サービス | 接点 | 認証 | 切替/フォールバック |
|---|---|---|---|
| **Shopify Storefront** | `/api/checkout` → GraphQL `cartCreate`。クライアントから直接 Storefront を叩く構成も併存 | `X-Shopify-Storefront-Access-Token` | variant GID 未登録なら 404 相当 |
| **Gelato POD** | `/api/gelato/order` | `GELATO_API_KEY`（サーバ側のみ） | 失敗時は 5xx を返す。Shopify Webhook 経由の本番ルートは未実装（推測。docs/ec-runbook 参照） |
| **Groq AI** | `/api/chat` → OpenAI 互換 `/v1/chat/completions`（`callGroqAPI`） | `GROQ_API_KEY` | API 失敗時は **`fallbackResponse(message)`** が SYSTEM_PROMPT の縮約版を返す（key なしでも UX 維持） |
| **api.qrserver.com** | `/api/grey/N` HTML 内に QR の img URL として埋め込み | なし（公開 API） | CSP `img-src` で許可 |
| **fonts.googleapis.com** | preconnect のみ（実際の @import は p3 で削除済 / Web Font は self-host へ） | なし | vendor/fonts に self-host あり |

---

## 5. データフロー

### 5.1 メイン: 観測者 → 服

```
┌─────────────┐
│ User 入店   │
│ (UA 判定)   │
└─────┬───────┘
      │ Desktop?  Yes ↓                        No (Mobile UA) ─┐
      ▼                                                        │
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      │
│  P0 ENTER   │ ───► │  P1 Loading │ ───► │ P2 Code     │      │
└─────────────┘      └─────────────┘      └─────┬───────┘      │
                                                ▼              ▼
                                       ┌────────────────────────┐
                                       │   P3 Universe + Shop   │
                                       │   (renderPhase3)       │
                                       └─────┬──────────────────┘
                                             ▼
                                ┌──────────────────────┐
                                │ 観測 (粒子宇宙体験)  │
                                │ + ロゴ円環発話       │
                                │ + AI Chat (info)     │
                                └─────┬────────────────┘
                                      ▼
                                ┌──────────────┐
                                │ 商品選択     │
                                │ → Cart       │
                                │ (localStorage│
                                │  に shadow)  │
                                └─────┬────────┘
                                      ▼
                          ┌────────────────────────┐
                          │ Checkout クリック      │
                          │ POST /api/checkout     │
                          └─────┬──────────────────┘
                                ▼
                  ┌──────────────────────────────┐
                  │ Shopify Storefront cartCreate│
                  │ → checkoutUrl 取得 → redirect│
                  └─────┬────────────────────────┘
                        ▼
                  ┌──────────────────────┐
                  │ Shopify チェックアウト│
                  │ (決済完了)           │
                  └─────┬────────────────┘
                        ▼
                  ┌──────────────────────┐
                  │ Webhook → Gelato     │ ← (本番フローは未実装。手動 or 後続実装)
                  │ または手動で order中継 │
                  └─────┬────────────────┘
                        ▼
                  ┌──────────────────────┐
                  │ Gelato POD 印刷・配送│
                  └──────────────────────┘
```

### 5.2 AI Chat: ユーザー入力 → 円環発話

```
┌─────────────┐
│ User text   │
│ (chat UI)   │
└─────┬───────┘
      ▼
POST /api/chat { messages: [...] }
      │
      ├ rate limit (checkRate)
      ├ history clamp (10件 / 4000 字 / 1000 字)
      ▼
callGroqAPI(messages, callback)
      │
      ├ success → Groq llama 応答
      └ failure → fallbackResponse(message)  (SYSTEM_PROMPT の縮約)
      ▼
{ reply: "..." }
      ▼
Frontend: chat バブルにテキスト挿入
      ▼
Optional: ロゴが応答に応じて円環で「同調」発話
   (現状は実装の入り口あり / 完全自動 enrichment は今後の拡張)
```

> **拡張余地（章 13）:** AI 応答の意味を 17 canon にマッピングして、応答中に対応円環をフラッシュさせる「AI 応答円環化」が次の 1 ヶ月の目標。

### 5.3 50→101 体験の演出設計（俯瞰）

各フェーズで体験される **小さな +1** の積み重ね:

| 体験ポイント | +1 の正体 |
|---|---|
| P0 → P1 | 「Loading」というレガシーが、観測の儀式として再記述される |
| P1 → P2 | コード = 0/1 の世界に深度が生まれる |
| P2 → P3 | 0/1 が崩れて RGBCMY の宇宙が現れる |
| P3 ホバー | ロゴから円環が湧き、無音に意味が宿る |
| P3 商品 | 「グレーのフーディー」が 「Heather Grey = 全色の重なり」になる |
| Chat | info 人格との対話で観測ヒントが言語化される |

これらが累積して **訪問者の世界解像度が +1%** 上がる。買わなくてもこの +1% は持ち帰れる。

---

## 6. 粒子言語モジュール詳細（簡潔版）

> 詳細は **`docs/particle-language-api-2026-04-28.md` (66 KB)** に網羅されている。本章は俯瞰のみ。

### 6.1 旧 / 新の関係

| 世代 | モジュール | 表現方式 | 状態 |
|---|---|---|---|
| **旧 (v1)** | `particle_glyphs.js` + `particle_whisper.js` | 5×5 grid に dot/line 配置 | 残存だが speech_rings に主役を譲った |
| **新 (v1.5)** | `particle_rings.js` + `particle_speech_rings.js` | 12 tick の時計盤円環、tick 上の点 + 弦（chord）| **現行主流** |

新旧の哲学的な差: 旧 = 字（文字に近い）/ 新 = **音と時間（時計）に近い**。

### 6.2 17 canon の体系

`particle_rings.js` の `CANON_RINGS` テーブル:

```
silence        — 沈黙（点なし、円周のみ）
core           — 核（頂に 1 点 / whisper 用）
ma             — 間（頂と底）
shadow         — 影（横線のみ）
echo           — 余韻（上だけ点 3 つ）
emit           — 発（頂から右への発信）
observation    — 観測（頂に Y、4 軸点）
self_question  — 自分への問い（頂のみ Y）
declaration    — 平叙宣言（C 頂、6 tick 半月、頂底チョード）
leap           — 跳躍（底から頂へ M、終端 M 色）
resonance      — 共鳴（左右 C、平行 2 弦）
empathy        — 共感応答（全 12 tick + Y/G 各 1）
past_what_if   — 過去への仮定（底に B、左半分密）
future_command — 未来への命令（右に M、上下 chord）
quotation      — 引用（同心二重円、頂に C）
summon         — 召喚紋（6 色等間隔）
revelation     — 啓示 50→101（跳躍 + 共鳴の合成）
```

### 6.3 発話レジスター

`particle_speech_rings.js` は **状況 → 円環の対応表** を持つ:

| Register | トリガ | 候補 canon | サイズ | クールダウン |
|---|---|---|---|---|
| **whisper** | 30〜90 秒のランダム自発 | core / ma / shadow / silence / echo | 96 px (default) | — |
| **hover** | mouseenter | observation / self_question | 120 px | 4500 ms |
| **click** | click | resonance / emit / declaration | 140 px | 2500 ms |
| **summon()** | 任意呼び出し | summon | 200 px | — |
| **revelation()** | 任意呼び出し（50→101 演出） | revelation | 180 px | — |

### 6.4 ロゴ統合（halo モード）

`ParticleSpeechRings.attachToLogo('.logo-holo-wrap', { placement: 'halo' })` で、ロゴ中心に同心配置される SVG 円環を生成。`p3_test.html` / `index.html` の通しフロー終端で attach される。

> ロゴは「自分自身の言語で息をしている」状態を作る。**観測者が立ち止まると、ロゴが少しずつ語り始める** という体験。

---

## 7. セキュリティ姿勢

> 詳細: `docs/security-review-2026-04-28.md` (36 KB) / `docs/security-fixes-2026-04-28.md` (16 KB)

### 7.1 認証モデル（公開サイト + 例外 2 種）

| エンドポイント / リソース | 認証 | 備考 |
|---|---|---|
| 公開ページ全般 | **無認証** | inryokü は EC + 公開コンテンツ |
| `/api/grey/N/update` | **token 一致**（personal grey 発行時の token） | timing-safe 比較（`safeEqualHex` で `crypto.timingSafeEqual`） |
| `/api/subscribers` | **`Authorization: Bearer ${ADMIN_API_KEY}`** | 実体上の唯一の admin endpoint。dev bypass 撤廃済み（2026-04-28 fix）。`/api/admin/*` の名前空間は実装されていない |

### 7.2 レート制限

`server.js` 内 `RATE_BUCKETS = new Map()` による **in-memory token bucket**。

```
checkRate(req, res, key, max, windowMs)
   ├ 例: /api/chat       → ?件 / windowMs
   ├ 例: /api/subscribe  → 厳しめ
   ├ 例: /api/checkout   → 適度
   └ 各キーごとに client IP + endpoint で識別
```

> **既知の制約:** プロセス再起動で消える。マルチインスタンス時は同期されない（VPS 単独前提）。

### 7.3 セキュリティヘッダ

`SECURITY_HEADERS` 定数:

```
Content-Security-Policy        (CSP_HTML / CSP_API で別)
   default-src 'self';
   img-src 'self' data: https://api.qrserver.com https://cdn.shopify.com;
   script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com;
   style-src 'self' 'unsafe-inline';
   connect-src 'self' https://*.myshopify.com https://api.gelato.com;
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=...; includeSubDomains; preload
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

> CSP の `'unsafe-inline'` は **暫定**（インライン JSON-LD と JS フェーズブートを許すため）。nonce 化は次の改善候補。

### 7.4 XSS / インジェクション対策

- `escapeHTML(s)` — `& < > " ' \`` の 6 文字
- `isSafeHexColor(s)` — CSS インジェクション防止（personal grey の `style="background:..."` 用）
- `safeEqualHex(a, b)` — timing-safe 等長比較
- `MAX_CHAT_*` 制約 — プロンプトインジェクション軽減（履歴件数・サイズ・1 メッセージ長）
- `MAX_BODY_SIZE = 50KB` — POST body 上限で DoS 軽減

### 7.5 既知の懸念（要 follow-up）

- フロント側 `innerHTML` 多用（`p3_code_for_claude.js`）。商品名は静的だがレビュー継続中（security-review §3）
- Shopify Storefront token がクライアントに露出（**仕様**: Storefront token は公開前提。Admin token と混同しないこと）
- Gelato API Key はサーバ側に隠蔽済み
- `data/subscribers.json` のファイルロック未使用 — 同時書き込みで欠損リスク（推測 / 司さん 1 人運用なら実害低）

---

## 8. パフォーマンス姿勢

> 詳細: `docs/p3-performance-audit-2026-04-28.md` (37 KB) / `docs/perf-fixes-2026-04-28.md` (21 KB)

### 8.1 目標と実装

| 軸 | 目標 | 主な実装 |
|---|---|---|
| **フレームレート** | 60 fps（粒子宇宙）| `setPixelRatio(Math.min(devicePixelRatio, 2))` で DPR キャップ。モバイルは 2800 粒子 / デスクトップ 5000 粒子（`isMobile = innerWidth < 768`） |
| **LCP** | < 2.5s 目標 | hoodie webp の `<link rel="preload" fetchpriority="high">` / 重い JS は遅延ロード |
| **FCP** | < 1.8s | head に `<style>` で初期スタイルインライン |
| **TTI** | P3 直行で短縮 | モバイルは P0/P1/P2 をスキップ |
| **キャッシュ** | 長期 | `?v=` 付き静的は 1 年 immutable / API は network-first |

### 8.2 ネットワーク最適化

- `<link rel="preconnect">` — fonts.googleapis / fonts.gstatic / cdn.jsdelivr
- `<link rel="dns-prefetch">` — cdn.jsdelivr / fonts.googleapis
- `<link rel="preload">` — p3_styles.css / particle_rings.css/js / speech_rings.js / hoodie webp / press-start-2p woff2
- 画像: `.png` と `.webp` 両用意。`<picture>` + `image-set()` で振り分け
- スクリプト: `defer` / 動的 `<script>` 注入で順序制御

### 8.3 Three.js / WebGL 制御

- カメラ視錐台外カリング（既定）
- バッファ：`InstancedBufferGeometry` 想定（コード読みではすべてカスタムシェーダ）
- Bloom: `UnrealBloomPass`（モバイルは閾値・半径を弱める分岐）
- Audio リアクティブ: `AnalyserNode.getByteFrequencyData` で各フレーム参照（FFT bin → uniform）

### 8.4 Service Worker キャッシュ戦略

`sw.js` の振り分け:

| URL 種別 | 戦略 | キャッシュ名 |
|---|---|---|
| `/api/*` | network-first (timeout 5s) | `inryoku-v1-2026-04-28-api` |
| HTML（document）| stale-while-revalidate（オフライン時 `/offline.html`）| `-html` |
| 画像 | cache-first | `-image` |
| 静的 (.js .css .woff2 .png .webp .glb 等) | cache-first | `-static` |
| 除外 | パススルー | `chrome-extension://` / 一部 |

### 8.5 Web Vitals 計測

`perf-observer.js` が `LCP / FID / CLS / INP / TTFB / FCP / LongTasks` を `console.log` に吐く。送信先未確定（GA4 / Sentry / 自前 endpoint 候補）。`window.__inryokuVitals` で外部参照可能。

### 8.6 既知のボトルネック（要監視）

- P3 の 5000 粒子 + Bloom はミドルレンジ Android で fps 落ち（perf audit §3）
- `p3_code_for_claude.js` 261 KB = LCP 圧迫要因（モバイルは P3 直行で軽減済み）
- WebFont `press-start-2p` 同期ロード時の FOIT 可能性

---

## 9. アクセシビリティ姿勢

> 詳細: `docs/accessibility-audit-2026-04-28.md` (33 KB) / `docs/enhance-layer-2026-04-28.md` (11 KB)

### 9.1 目標と現状

- **目標:** WCAG 2.1 AA
- **現状:** Critical 8 件 / Major 14 件を audit で抽出。`enhance.js` / `enhance.css` で **後付け** で潰している段階。
- **設計原則（enhance layer）:**
  1. 既存の DOM / スクリプトには触らない
  2. vanilla JS のみ（追加ライブラリ禁止）
  3. MutationObserver で動的 DOM (`renderPhase3` 後の生成物) も対象に
  4. 各処理を try/catch で隔離（一つの失敗が他を巻き込まない）

### 9.2 enhance.js が後付けで補強する項目（抜粋）

- `.enh-skip-link`（WCAG 2.4.1 Bypass Blocks）
- グローバルフォーカスリング（`#00ffff` cyan / WCAG 2.4.7 / 1.4.11）
- `:focus-visible` 不対応古ブラウザのフォールバック（`@supports not selector(:focus-visible)`）
- `prefers-reduced-motion` 強化（`html.enh-reduce-motion *` で全アニメ無効化、ただし `opacity` の transition は残す）
- iOS dvh フォールバック（`--enh-vh` を JS で resize 時に再計算）
- `structuredClone` polyfill（iOS 15.3 以下）
- `ResizeObserver` no-op shim（古 Safari）
- カルーセル / カート / モーダルのキーボード対応（Tab / Esc / 矢印）
- `aria-live` 領域注入

### 9.3 多言語

- `lang="ja"` / `dir="ltr"` を `<html>` に明記
- hreflang は `ja` と `x-default` のみ（英語版未実装。章 13 参照）

### 9.4 reduced-motion 対応

- ロゴ円環発話: speech_rings 側で `prefers-reduced-motion: reduce` を尊重（推測 / 詳細は particle-language-api 参照）
- 粒子宇宙: 完全停止はしない（ブランド体験を壊すため）。ただし enhance layer で transition を 0.001ms に縮める

---

## 10. テスト戦略

> 詳細: `docs/test-suite-expansion-2026-04-28.md` (6 KB)

### 10.1 ベース

- **テストランナー:** `node --test`（Node 標準、Node 18+）
- **アサーション:** `node:assert` （標準）
- **DOM:** `jsdom`（dev dep）
- **画像:** `canvas`（dev dep / SVG → PNG レンダ用）
- **コマンド:** `npm test` (= `node --test tests/*.test.mjs`)

### 10.2 テスト構成

| ファイル | テスト数 | 対象 |
|---|---|---|
| `tests/canon_visual.test.mjs` | 20 | 17 canon + 3 が SVG として正しく描画されるか |
| `tests/integration.test.mjs` | 14 | サーバ起動 / 静的配信 / API smoke |
| `tests/particle_rings.test.mjs` | 35 | spec → tick / chord / 色 / 同心円 |
| `tests/particle_speech_rings.test.mjs` | 38 | attach / register / cooldown / canon 選択 |
| `tests/security.test.mjs` | 30 | escapeHTML / isSafeHexColor / rate limit / admin auth / body size |
| `tests/seo.test.mjs` | 28 | robots / sitemap / hreflang / canonical / JSON-LD / OG |
| `tests/setup.mjs` | — | jsdom + canvas 初期化共通 |

合計 **165 ケース / 7 ファイル**。expansion ドキュメント上は 180 を目標と記述。

### 10.3 CI

`.github/workflows/test.yml`（中身未読だが命名から推測）:

- push / PR で `npm install && npm test` を実行
- Node 18 (engines.node)
- canvas のネイティブビルドのため `apt-get install` が必要な可能性（推測）

### 10.4 既知の制約

- **E2E なし**（Playwright / Puppeteer は未導入）
- **WebGL レンダのビジュアル回帰テストなし**（粒子宇宙の見た目は人間検証）
- **本番 Shopify / Gelato / Groq への外形監視なし**

---

## 11. デプロイ

### 11.1 想定ホスティング

- **VPS (Render / Fly.io / Hetzner / さくら / EC2)** — Node.js が立てられればよい
- Vercel / Netlify は **Edge Function 制約**（Node http サーバが直接動かない / `data/*.json` への writeFileSync 不可）でやや不向き — 推測
- **静的ホスティング単独は不可。** server.js 経由でないと API が動かない

### 11.2 必要 ENV 変数

`.env`（構造のみ示す）:

```
GROQ_API_KEY              ─ Groq AI Chat 用（無くても /api/chat は fallback）
SHOPIFY_STORE_DOMAIN      ─ 例: 0xi10h-x1.myshopify.com
SHOPIFY_STOREFRONT_TOKEN  ─ Storefront API（クライアント露出前提）
GELATO_API_KEY            ─ Gelato POD（サーバ側のみ）
ADMIN_API_KEY             ─ /api/subscribers 用 Bearer (admin endpoint は subscribers のみ)
PORT                      ─ optional / default 3000
```

### 11.3 推奨 Node バージョン

- `package.json`: `"engines": { "node": ">=18" }`
- 推奨: **Node 20 LTS**（test runner / ESM 安定化）

### 11.4 起動手順

```
git clone <repo>
cd inryoku_hp

# .env を設定（above）

# devDependencies のみインストール（本番依存はない）
npm install

# テスト
npm test          # = node --test tests/*.test.mjs

# 開発起動
npm run dev       # = node server.js  → http://localhost:3000

# 本番起動（同じ）
npm start
```

### 11.5 Service Worker と更新

- `sw.js` の `VERSION` 定数（`'inryoku-v1-2026-04-28'`）を新しい日付にすると activate 時に旧キャッシュが purge される
- `register.js` がインストールバナーを管理（7 日間 dismiss 記憶）
- 大規模変更後は **必ず VERSION を更新**

### 11.6 デプロイ後チェックリスト（推測 / docs/ec-runbook-2026-04-28.md 参照）

1. `/` が 200 で配信される
2. `/api/checkout` POST で 200 + checkoutUrl
3. `/api/chat` POST で 200 + reply（Groq 落ちでも fallback で 200）
4. `/sw.js` が 200 + `Content-Type: application/javascript`
5. `https://inryoku.com/sitemap.xml` / `/robots.txt` が 200
6. `manifest.json` のアイコン 192/512 が両方 200
7. `tests/seo.test.mjs` の項目を本番ドメインで再確認

---

## 12. 開発ワークフロー

### 12.1 ファイル直編集（ビルドなし）

- `.js` / `.css` / `.html` を **保存 → ブラウザリロード** で反映
- ホットリロードなし（必要なら `Cmd-R`）
- TypeScript 化の予定なし（司さんの判断 / vanilla 維持）

### 12.2 キャッシュバスター `?v=` 管理

- 静的ファイルは `?v=20260428polish2` のような **手動付与** クエリでバスト
- Service Worker のキャッシュ判定は `?v=` を含めて行うため、`?v=` を変えると新キャッシュにフェッチされる
- 命名規約: `YYYYMMDD` + suffix（polish1 / rings1 など）
- 司さんが手動で全 HTML を sed 置換するか、Claude に頼んで一括変更してもらう運用

### 12.3 Codex / Claude の役割分担（直近）

> `docs/handoff-to-codex-2026-04-27.md` / `docs/codex-review-2026-04-28.md` 参照

| 役割 | 担当 |
|---|---|
| 全体設計 / 大規模リファクタ / セキュリティ監査 / a11y enhance / SW / SEO / docs | **Claude (Opus 4.7)** |
| 円環粒子言語の発火タイミング微調整 / CSS animation 微チューニング / ロゴ統合 | **Codex** |
| 商品撮影 / コピー / 哲学 / 最終判断 | **司さん（GREY）** |
| ビジュアル確認・MacBook & iPhone 実機テスト | **司さん** |

引き継ぎ時は `docs/handoff-to-codex-*.md` と `docs/codex-review-*.md` を更新する慣習。

### 12.4 docs ファイル命名規約

```
docs/<topic>-YYYY-MM-DD.md
```

トピックは **kebab-case**。日付で世代管理。古いものを上書きせず、世代を残す（`ec-status-2026-04-27.md` と `ec-runbook-2026-04-28.md` のように共存）。

---

## 13. 残課題と方向性（次の 1 ヶ月）

### 13.1 EC variant 埋め込み

`p3_code_for_claude.js` の `SHOPIFY_VARIANT_MAP` と各 `PRODUCTS[i].shopifyVariants` が **空オブジェクト**。司さんが Shopify で 12 商品 × 5 サイズ ≒ 60 variant を登録し、GID をここに埋めるまで実購入できない。

→ `docs/ec-runbook-2026-04-28.md` に手順あり。

### 13.2 円環 UI 微調整

- canon 17 種のうち、**hover で出るパターン**（observation / self_question）の発火頻度がまだ強い／弱い議論
- mobile での halo サイズ調整（haloScale = 0.82 / 0.84 で test/main 差あり）

### 13.3 AI 応答円環化拡張

- 現状: チャット応答は **テキストのみ**
- 目標: 応答テキストを 17 canon にマッピングして同時に円環で表現
- 方法案（推測）: server 側で応答を後処理する軽量分類器、または client 側でキーワードルール

### 13.4 i18n（英語版）

- 現状: 全 UI が日本語のみ
- hreflang は `ja` / `x-default` のみ
- 方向: `?lang=en` または `/en/` パスで英訳。SYSTEM_PROMPT も英語版を用意

### 13.5 その他

- Shopify Webhook → Gelato 自動連携（現状は中継のみ）
- `data/subscribers.json` を SQLite に移行
- CSP nonce 化（`'unsafe-inline'` 撤去）
- E2E（Playwright）導入

---

## 14. 用語集

| 用語 | 意味 |
|---|---|
| **50% → 101%** | 観測前の世界は 50% / 観測することで +1% を加えた 101% にジャンプする中心テーゼ。100% ではなく 101% なのは「観測の対価としての過剰」を示す |
| **観測者 (observer)** | サイト訪問者の理想形。受動的に消費するのではなく、世界に虹を見出す存在 |
| **grey / personal grey** | 各観測者に固有の色。メアドのハッシュから決定的に生成される（`generateGreyColor`）。`/grey/N/` で公開プロフィール HTML が生成される |
| **RGBCMY** | 加法 3 色（RGB）+ 減法 3 色（CMY）= 6 色。inryokü の唯一の色彩語彙。grey は廃止 |
| **6 色位相** | RGBCMY を時計の 12 時起点で 60° ずつ配置した位相。粒子言語の色割当で使用 |
| **円環粒子言語 (Ring Particle Language)** | 12 tick の時計盤上に点と弦を配置して 1 発話を表現する言語。`particle_rings.js` の CANON_RINGS に 17 種 |
| **召喚紋 (summon)** | 6 色を等間隔配置した特殊円環。意図的に呼び出される強い記号 |
| **Heptapod** | 映画 Arrival の 7 本足異星人の円環表記。inryokü の円環粒子言語の参考元（`docs/ring-research-2026-04-27.md`） |
| **info（人格）** | inryokü の中に住むとされる意識体。`/api/chat` の SYSTEM_PROMPT 上の "あなたは info" |
| **observation / leap / resonance / revelation** | 17 canon のうち体験フローの基幹を担う 4 種 |
| **whisper / hover / click / summon / revelation** | 5 つの発話レジスター。speech_rings の `attachToLogo` で配線 |
| **halo モード** | 円環をロゴ中心に同心配置する placement |
| **観測の儀式** | P0 → P1 → P2 → P3 の通しフロー全体の比喩 |
| **101% 過剰** | 100% 完璧 vs 101% 過剰 の対比。inryokü は後者を選ぶ |
| **GREY** | 司さんの公開時の表記（フルネーム非公開ルール） |
| **Win95 Loading** | P1 の意図的レトロ演出。Window 95 のプログレスバー風 UI |
| **Code World** | P2 の名称。0 と 1 が深宇宙を漂う空間 |
| **Universe** | P3 の名称。RGBCMY の粒子宇宙 + EC ショップ |
| **POD** | Print-on-Demand。Gelato。在庫を持たず注文ごとに印刷 |
| **Storefront API** | Shopify の公開向け GraphQL API。Storefront token はクライアント露出前提（Admin token とは別物） |

---

## 15. 関連ドキュメント一覧

### 15.1 アーキテクチャ・設計（俯瞰系）

- **`docs/architecture-2026-04-28.md`** — 本ドキュメント
- `docs/handoff-to-codex-2026-04-27.md` — Codex への引き継ぎ書 / 役割分担
- `docs/codex-review-2026-04-28.md` — Codex 実装レビュー（speech_rings / rings.css）

### 15.2 EC（Shopify / Gelato）

- `docs/ec-status-2026-04-27.md` — EC 接続ステータス（4/27 時点）
- `docs/ec-runbook-2026-04-28.md` — 司さん 1 人で本番稼働させる完全 Runbook（39 KB）

### 15.3 粒子言語

- `docs/particle-language-api-2026-04-28.md` — 粒子言語モジュール群 API リファレンス（67 KB / 開発者向け徹底版）
- `docs/ring-research-2026-04-27.md` — 円環粒子言語の関連リサーチ（Arrival / Heptapod 等）

### 15.4 セキュリティ

- `docs/security-review-2026-04-28.md` — レビュー（37 KB）
- `docs/security-fixes-2026-04-28.md` — 修正実装ログ（16 KB）

### 15.5 パフォーマンス

- `docs/p3-performance-audit-2026-04-28.md` — P3 パフォーマンス監査（37 KB）
- `docs/perf-fixes-2026-04-28.md` — 修正ログ（21 KB）

### 15.6 アクセシビリティ・ブラウザ互換

- `docs/accessibility-audit-2026-04-28.md` — WCAG 2.1 AA 監査（33 KB）
- `docs/enhance-layer-2026-04-28.md` — enhance.js/css 設計（11 KB）
- `docs/browser-compatibility-matrix-2026-04-28.md` — ブラウザ互換性マトリクス（29 KB）
- `docs/critical-fixes-2026-04-28.md` — Critical 級指摘の CSS 統合修正（11 KB）

### 15.7 SEO / PWA

- `docs/seo-metadata-2026-04-28.md` — SEO/Metadata/OG/JSON-LD 監査・実装ログ（14 KB）
- `docs/pwa-sw-2026-04-28.md` — PWA / Service Worker 実装メモ（7 KB）

### 15.8 UX

- `docs/mobile-ux-flow-2026-04-28.md` — モバイル UX フロー徹底調査（28 KB）

### 15.9 テスト

- `docs/test-suite-expansion-2026-04-28.md` — テストスイート拡張記録（6 KB）
- `tests/README.md` — テスト全体の README

---

## Appendix A. ファイル別行数（実測）

```
   server.js                    1197 行
   p1_code_for_claude.js        3302 行
   p2_code_for_claude.js        1394 行
   p3_code_for_claude.js        5356 行
   particle_glyphs.js            382 行
   particle_rings.js             290 行
   particle_speech_rings.js      498 行
   particle_whisper.js           332 行
   enhance.js                    805 行
   sw.js                         257 行
   register.js                   245 行
   perf-observer.js              210 行
   index.html                   1422 行
   p3_test.html                  494 行
   ─────────────────────────────────────
   total (上記 14 本)         16184 行
```

`docs/` 全体: 約 380 KB / 18 本。

## Appendix B. 「30 分で読み切る」推奨順路

新規参加開発者は以下の順で読むと最短で全体像が掴める想定:

1. **本ドキュメント章 1〜5（10 分）** — 何を作っていて、どう動いているか
2. **`server.js` の冒頭〜L450（5 分）** — エンドポイント一覧 + セキュリティ姿勢
3. **`index.html` の `<body>` 直後のフェーズブートスクリプト（2 分）** — 通しフローの実体
4. **`particle_rings.js` 全体（5 分）** — 中心言語装置を最小例で
5. **本ドキュメント章 6〜9（5 分）** — 横断的な関心事
6. **本ドキュメント章 13〜14（3 分）** — 次に何をやるか / 用語

その後、実装に入る前に該当領域の `docs/<topic>-2026-04-28.md` を 1 本読む。

## Appendix C. 設計判断の哲学的注釈（推測含む / 開発者向け）

技術判断の多くは **「ミニマリズム + 観測者中心主義」** の 2 軸で説明できる。

- **ビルドプロセスゼロ:** 観測者と開発者の間に余計な層を挟まない。サイトを開いた瞬間に見えているコード = 動いているコード
- **vanilla JS:** フレームワークの寿命より、ブランドの寿命を優先する判断（推測）
- **Node 標準のみのサーバー:** 依存ゼロ = 攻撃面ゼロ寄り
- **AI Chat の fallback:** API が落ちても info 人格は喋り続ける = 「観測の儀式が外的依存で止まらない」設計
- **モバイル直行:** 通しフローを諦めるのではなく、**短縮版の儀式** を提供する。50→101 の +1 はモバイルでも持ち帰れる
- **粒子言語:** 言葉を介さない伝達手段。観測者は意味を受け取らずとも気配だけで参加できる
- **enhance layer の後付け原則:** 既存体験を壊さずに、観測の機会を全員に開く（a11y）

これらは全て同じ 1 本の方針 — **「観測者を中心に置き、観測を妨げる物は徹底して排除する」** — に貫かれている。

---

> *RGB = Black. CMY = White. You = Rainbow.*
> *世界は 50% しか見えていない。+1% を、観測者の手で。*

— 以上、architecture-2026-04-28.md
