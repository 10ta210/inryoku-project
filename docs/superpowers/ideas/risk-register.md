# Risk Register

| # | Risk | Prob | Impact | Mitigation |
|---|------|------|--------|------------|
| 1 | **ブランド希釈**（事業多角化で哲学曖昧化） | M | H | すべての新事業に「これは見え方を変える体験になるか？」チェックを必須化。年 1 回 vision メモを再読、矛盾事業は廃止。EC variant が哲学に整合しているか四半期レビュー。|
| 2 | **司さんバーンアウト**（1 人運営） | H | Critical | (a) 制作 SOP 化で外注ライン確保（C プランの一部）。(b) ストック収入比率 50% 目標（A/D/9/月額系）でスポット依存を下げる。(c) 月 1 完全オフ日を schedule。(d) スポンサーシップを早期に最小確保（IRL イベント協賛など）。|
| 3 | **パフォーマンス退行**（idea 追加で fps 低下） | H | H | 全 idea は `experiments/` で隔離検証、Lighthouse mobile 70+ を merge gate。Web Vitals 監視（既存 `perf-observer.js`）に regression alert を追加。粒子上限 / DPR cap を絶対遵守。|
| 4 | **a11y 後退 / 訴訟** | L | H | 新 idea ごとに `design:accessibility-review` skill 走査。SR 検出経路は phantom 入力テスト。EU 向けは EAA 2025 適合維持。WCAG AA 維持を CI gate に。|
| 5 | **IP: Win95 ビジュアル / フォント** | M | H | Win95 P1 は明確に「homage」と位置づけ、Microsoft 商標 / ロゴは使わず色面 + 罫線 modeled-after に留める。フォントは Inter / Noto Sans JP / 自社ライセンスのみ。Pixel-perfect 模倣禁止を内規化。|
| 6 | **Platform dependency**（Shopify / Gelato 値上げ・終了） | M | H | (a) Storefront API 抽象層（`shopify-proxy-client.js`）を保持し、Snipcart / Lemon Squeezy への切替設計を docs 化。(b) Gelato → Printful / Cloudprinter 比較表を維持。年 1 回見積もり再取得。|
| 7 | **コピー / クローン**（円環粒子言語が模倣される） | M | M | (a) OSS で先に publish して「originator」を確定（marketing 13）。(b) 17 canon は商標出願（日本 9 類 / 42 類）。(c) 哲学文脈とセットでしか機能しない構造を維持。|
| 8 | **AI コスト暴騰 / API 制限** | M | M | (a) prompt cache 必須運用。(b) 日次 IP 5 リク制限。(c) Anthropic / OpenAI 二系統対応。(d) ローカル Llama 系 fallback の R&D を年 1 回再評価。|
| 9 | **SEO 過依存 → アルゴリズム変更** | M | M | organic 流入を全体の 40% 以下に維持。残りは IRL イベント / 紙 / Awwwards / 招待 URL / メールリスト。RSS / Atom feed も提供。|
| 10 | **法務: 特商法 / 個人情報** | L | Critical | 既存ページ実情報埋め込み（残課題 #2）を完了。住所は私書箱可。GDPR / 改正個情法準拠の Cookie 弁明文。マイク / カメラ機能はオプトイン + サーバ送信なし明示。|
| 11 | **モバイル劣化体験**（redirect で二級扱い） | H | H | mobile-first touch trail（HP idea 9）を P3 mobile に投入し、`p3_test.html` の体験を本体と同等にする。Mobile retention を KPI 化。|
| 12 | **コミュニティ毒性**（guestbook / multiplayer） | M | H | (a) 事前承認制。(b) 17 文字上限・NG ワード辞書（多言語）。(c) IP / fingerprint rate limit。(d) 「炎上時 1 クリック全消し」管理画面。|
| 13 | **データ消失 / バックアップ** | M | Critical | 既存 `scripts/backup.sh` を週次 cron + 月次オフサイト（暗号化 → 別ストレージ）。哲学者 guestbook DB は別系統。|
| 14 | **検閲 / アクセス遮断**（IRL イベントで保健所等） | L | M | 屋内・少人数・既存ギャラリー会場限定で開始。許可必要な企画は弁護士の chat 確認。|
| 15 | **依存の重さ** (Three.js r160 EOL) | L | M | 年 1 回バージョン同期、major bump は worktree で検証。最悪自前 WebGL に縮退。|
| 16 | **「観測 +1%」の遊戯化過剰** | M | M | メーター数字非表示。報酬を派手にしない（音 / 通知禁止）。「達成感」ではなく「気づき」が主。|
| 17 | **NFT 誘惑** | L | H | チェーン化は明示的に拒否（business idea 13 で文書化）。社内 / 外部の提案も同様に断る。哲学的非整合性が最大リスク。|
