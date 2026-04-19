# メール送信設定（Gmail SMTP 経由）

## 目的
現在 `/api/contact` と `/api/subscribe` は **JSONファイルに保存するだけ**。
実際にメールで通知を受け取るには Gmail SMTP 連携が必要。

## 手順

### 1. Gmailアプリパスワード発行
1. Google アカウント → https://myaccount.google.com/security
2. **2段階認証** を ON
3. **アプリパスワード** → 新規発行
4. 名前: `inryoku-smtp`
5. 16桁のパスワードをコピー

### 2. `.env` に追加
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tsukasa.2000922@gmail.com
SMTP_PASS=発行した16桁
SMTP_FROM=inryoku <tsukasa.2000922@gmail.com>
SMTP_TO=tsukasa.2000922@gmail.com
```

### 3. Railway環境変数にも追加
Railway dashboard → Variables → Raw Editor → 上記をペースト

### 4. server.js に nodemailer 追加
```bash
npm install nodemailer
```

`/api/contact` エンドポイントに以下を追加:
```js
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

await transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: process.env.SMTP_TO,
  subject: 'inryoku contact: ' + parsed.name,
  text: `From: ${parsed.email}\n\n${parsed.message}`
});
```

### 5. テスト
サイトで問い合わせフォーム送信 → Gmailに着信確認

## 代替案（Gmailじゃない場合）
- **Resend** (月3,000通無料) https://resend.com
- **SendGrid** (月100通無料) https://sendgrid.com
- **Brevo** (日300通無料) https://brevo.com

どれも API keyだけで動く。コードもシンプル。
