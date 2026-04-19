# inryokü — デプロイ状況 (2026-04-19 最新)

## 🌐 本番URL
**https://inryoku-project-production-f827.up.railway.app/**

スマホ・PC・タブレット全部アクセス可能。PWA対応（iOSホーム画面追加可）。

---

## ✅ 完全稼働中

| 機能 | 状態 |
|---|---|
| P3 (ECショップUI) | ✅ |
| 粒子宇宙 (15000+星座網) | ✅ コア非ホログラム・強化済 |
| カルーセル商品棚 (12品) | ✅ モバイル対応済 |
| OSテーマ×カードスキン連動 | ✅ Cosmos/macOS/Win95 |
| Konami easter egg | ✅ os9/imacg3/apple2 解放 |
| メール登録 /api/subscribe | ✅ |
| お問い合わせ /api/contact | ✅ |
| Gelato API /api/gelato/order | ✅ キー有効 |
| AIチャット /api/chat | ✅ Groq |
| BGMメニュー | ✅ |
| SEO/OG/Twitter Card | ✅ |
| JSON-LD (Organization + WebSite) | ✅ |
| sitemap.xml / robots.txt | ✅ |
| manifest.json (PWA) | ✅ |
| favicon / apple-touch-icon | ✅ |
| 404 BSOD風ページ | ✅ "REALITY NOT FOUND" |
| preload最適化 | ✅ 初回描画高速化 |
| _dev/prompts/docs 非公開化 | ✅ |

## ⚠️ 人力必要（司さん）

| 項目 | やること | 時間 |
|---|---|---|
| Gelato商品登録 | 画像2枚upload → Multiple products | 30秒×2 |
| Shopify variant GID | 自動同期後、俺が取得→埋込 | 待つだけ |
| Shopify Storefront Token | Dev Dashboard で シークレットローテーション | 1分 |
| Railway有料化 | Upgrade plan（Trial 残 20日 / $5） | 5分 |
| GA4 ID取得 | analytics.google.com 登録→ID置換 | 10分 |
| 独自ドメイン | お名前.com/Cloudflare → Railway接続 | 30分 |

---

## 🔑 環境変数（Railway + ローカル .env）

| 変数 | 状態 |
|---|---|
| `GROQ_API_KEY` | ✅ |
| `SHOPIFY_STORE_DOMAIN` | ✅ `0xi10h-x1.myshopify.com` |
| `SHOPIFY_STOREFRONT_TOKEN` | ⚠️ 無効 (Client IDを誤設定していた) |
| `GELATO_API_KEY` | ✅ 新規発行済 |
| `ADMIN_API_KEY` | ✅ |
| `NODE_ENV` | ✅ production |
| `PORT` | ✅ 3000 |

## 📦 Git/デプロイ
- Repo: https://github.com/10ta210/inryoku-project
- PAT: 90日有効（Mac Keychain保存、2026-07-18まで）
- Railway: mainブランチpush→自動再デプロイ
- 最新commit: `de714e7`

## 🎨 UI改善実装済
- UI#3: OSテーマ×カードスキン連動 ✅
- UI#4: Konamiイースターエッグ ✅
- **保留** UI#1 フォーカスモード扇展開（既存カルーセル壊す恐れ）
- **保留** UI#2 カード直購入（既存モーダル壊す恐れ）

## 📂 ディレクトリ構成
```
inryoku/
├── p3_test.html (public entry)
├── p3_code_for_claude.js / p3_styles.css
├── server.js
├── public/ (product mockups)
├── vendor/ (three.js, fonts)
├── prompts/ (Claude prompts ← 非公開)
├── _dev/ (design demos ← 非公開)
├── docs/ (internal docs ← 非公開)
└── data/ (subscribers.json ← 非公開)
```

## 🧠 俺のスタンス (memoryに保存済)
- caveman talk / 3文以内
- ブラウザは司のChrome直操作 (claude-in-chromeで)
- file upload以外全部自律
- 承認なしでpush・デプロイ・ファイル編集OK

## 📱 新セッション始め方
`/prompts/AUTORUN.md` のMASTER PROMPTコピペ → Claude貼り付け → 「続き」

---
最終更新: 2026-04-19 23:30 JST
