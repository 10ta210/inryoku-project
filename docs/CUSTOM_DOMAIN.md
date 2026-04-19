# 独自ドメイン取得 → Railway 接続

## 現状
`https://inryoku-project-production-f827.up.railway.app/` — Railwayの無料サブドメイン。

## 目標
`https://inryoku.com/` や `https://inryoku.jp/` で公開。

## 手順（30分）

### STEP 1: ドメイン購入（5分）

**おすすめ:**
- **Cloudflare Registrar** https://domains.cloudflare.com
  - 原価販売（`inryoku.com` なら年 $10 ≒ ¥1,500）
  - DNS設定が一番シンプル

- **お名前.com** https://www.onamae.com
  - 日本語対応、円決済可
  - 初年度セール多い
  - `.jp` も買える

**空き確認:**
- `inryoku.com` — 未確認、要検索
- `inryoku.jp` — `.jp` は別途
- `inryoku.shop` — 購入容易
- `inryoku.store` — 購入容易

### STEP 2: Cloudflare DNS 設定（5分）
ドメイン購入後、Cloudflare Dashboard → DNS → Add record

```
Type: CNAME
Name: @ (または www)
Target: inryoku-project-production-f827.up.railway.app
Proxy: OFF (Railway が SSL発行するため DNS only にする)
TTL: Auto
```

### STEP 3: Railway で Custom Domain 登録（5分）
1. Railway dashboard → inryoku-project → Settings
2. **Networking → Custom Domain → + Custom Domain**
3. `inryoku.com` を入力
4. Railway が DNS target を表示 → Cloudflare で CNAME 設定
5. **Verify** ボタン → 通ればOK
6. Railway が Let's Encrypt 自動発行（数分）

### STEP 4: HTTPS 確認（数分）
`https://inryoku.com/` → 鍵マークついて普通にアクセスできる

### STEP 5: コード内のURL更新（10分）
以下のファイルで `inryoku-project-production-f827.up.railway.app` を
`inryoku.com` に置換:

- `p3_test.html` (canonical, OG url, Twitter image等)
- `sitemap.xml`
- `robots.txt`
- `manifest.json`
- `DEPLOY_STATUS.md`

```bash
cd /Users/10ta210/Desktop/inryoku
grep -rl "inryoku-project-production-f827.up.railway.app" --include="*.html" --include="*.xml" --include="*.json" --include="*.md" | xargs sed -i '' 's|inryoku-project-production-f827.up.railway.app|inryoku.com|g'
git add -A && git commit -m "domain: Railway サブドメイン → 独自ドメイン inryoku.com" && git push
```

## 費用感

| ドメイン | 初年度 | 以降/年 |
|---|---|---|
| .com (Cloudflare) | ¥1,500 | ¥1,500 |
| .com (お名前.com) | ¥1〜 (セール) | ¥1,500〜 |
| .jp (お名前.com) | ¥3,000 | ¥3,000 |
| .shop | ¥500〜 | ¥3,000 |
| .store | ¥500〜 | ¥3,000 |

## 注意点
- Railway は Trial 中でも Custom Domain 使える
- SSL/HTTPS は自動、別契約不要
- DNS 反映は5〜30分（長くて24時間）
- `www` サブドメインも別途 CNAME が必要
