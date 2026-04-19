# inryokü — デプロイ状況 (2026-04-19)

## 🌐 公開URL
**https://inryoku-project-production-f827.up.railway.app/**

Railway上で稼働中。スマホ・PC問わずアクセス可能。

---

## ✅ 動いてる機能（本番検証済）

| API | エンドポイント | 状態 |
|---|---|---|
| ホーム (P3) | `GET /` | HTTP 200 ✅ |
| メール登録 | `POST /api/subscribe` | `{"success":true}` ✅ |
| お問い合わせ | `POST /api/contact` | `{"ok":true}` ✅ |
| Gelato 注文 | `POST /api/gelato/order` | Gelato API応答 ✅ (キー有効) |
| AIチャット | `POST /api/chat` | Groq API連携 ✅ |

## ⚠️ 未完了（司さんの判断必要）

| 項目 | 問題 | 必要作業 |
|---|---|---|
| Shopify Checkout | Storefront Tokenが無効 (UNAUTHORIZED) | 新トークン発行 or Shopify直接cart URL方式に変更 |
| 商品のShopify登録 | 12商品すべて`shopifyVariants: {}` 空 | Gelato App → 商品1つ作成で自動同期 |
| Gelato productUID | 全商品`bella_canvas_3001` 統一 | hoodie/tee/tank等それぞれ正しいUID必要 |

---

## 🔑 保存済みキー（`.env` + Railway環境変数）

| 変数 | 状態 |
|---|---|
| `GROQ_API_KEY` | ✅ 有効 |
| `SHOPIFY_STORE_DOMAIN` | ✅ `0xi10h-x1.myshopify.com` (= inryokü) |
| `SHOPIFY_STOREFRONT_TOKEN` | ❌ 無効 (再発行必要) |
| `GELATO_API_KEY` | ✅ 新規作成済 (前キー削除+再作成) |
| `ADMIN_API_KEY` | ✅ 64文字ランダム生成 |
| `NODE_ENV` | ✅ `production` |
| `PORT` | ✅ `3000` |

---

## 📦 GitHub
- Repo: https://github.com/10ta210/inryoku-project
- 最新push: `c005a74` (2026-04-19)
- Personal Access Token 発行済 (90日、Mac Keychain保存)
- Railway連携済み：mainブランチに push するたび自動デプロイ

---

## 🎯 次にやるべきこと（2時間以内で可能）

### 🥇 最優先: Shopify商品1つ作成
**経路**: Gelato Dashboard → Product catalog → 「Create product」
1. Product type: T-shirt (Bella+Canvas 3001)
2. デザイン画像アップロード
3. 商品名: 「ENTER TEE」等
4. 価格設定
5. Save → 「Publish to Shopify」
→ Shopify側にも自動反映、variant GID生成される

### 🥈 variant GID取得→p3コードに埋め込み
```js
// p3_code_for_claude.js 内
shopifyVariants: {
  'S': 'gid://shopify/ProductVariant/...',
  'M': 'gid://shopify/ProductVariant/...',
  ...
}
```

### 🥉 Shopify Storefront Token 再発行
inryoku-storefront (Dev Dashboard app) → Settings → シークレットのローテーション

---

## 🚨 Gotchas

1. **Railway Trial**: `21 days or $5.00 left` — 近いうちに有料化必要
2. **GitHub PAT**: 90日有効 (2026-07-18まで)
3. **Gelato Key**: Rotation不要、ずっと有効
4. **Shopifyストア通貨**: inryokü は Store=JPY, Billing=EUR になってる → JPY統一推奨
5. **Railway Private URL**: `inryoku-project.railway.internal` (内部通信用、ユーザーアクセス不可)

---

## 📱 スマホから遠隔操作

**閲覧系**:
- サイト: https://inryoku-project-production-f827.up.railway.app/
- GitHub: https://github.com/10ta210/inryoku-project (GitHubモバイルアプリ推奨)
- Railway: https://railway.com/dashboard

**編集系（スマホ）**:
- GitHubで直接ファイル編集 → commit → Railway自動再デプロイ
- もしくはclaude.ai/code でClaude Codeをブラウザ版で起動して会話継続
