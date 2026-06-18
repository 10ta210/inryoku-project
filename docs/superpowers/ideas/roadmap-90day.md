# 90-Day Roadmap

> 前提: 司さん 1 人 + Claude Code。P3 Production Ready 済、EC variant GID 埋めが P0 残。
> 原則: 収益化（C 即金 → A/B/9 ストック）と作品性（HP 演出 + 露出）を同時並列、毎週 1 ローンチ。

---

## Phase 1: 公開・足場（Day 1–14）

### Milestone 1.1 — Production Launch（Day 1–7）
- **Goal**: `inryoku.space` 本番公開・実取引可能。
- **Deliverable**:
  - EC variant GID 60 個埋め（残課題 #1）
  - 法定ページ実情報埋め込み（住所 = 私書箱 OK）
  - DNS / SSL / Cloudflare 前段
  - `release.sh` 実行 + 受入 26 項目再 PASS
- **Metric**: 1 件の自己テスト購入完走。Lighthouse Mobile Perf 70+。
- **Deps**: 司さん手動作業（Shopify 管理画面）。

### Milestone 1.2 — Time-of-Day + Console Poem + Observation Meter（Day 8–14）
- **Goal**: 軽量演出 3 つ追加で「体験の手触り」を即座に底上げ。
- **Deliverable**: HP idea 1, 12, 15 実装（合計 ~230 LOC）。
- **Metric**: Web Vitals 維持。再訪率 +5% を 2 週間で観測（基準値計測込み）。
- **Deps**: なし。

---

## Phase 2: 露出と一級モバイル（Day 15–35）

### Milestone 2.1 — Mobile First Touch Trail（Day 15–21）
- **Goal**: モバイル体験を `p3_test.html` redirect から脱却。
- **Deliverable**: HP idea 9 実装、`p3_test.html` を統合 or 段階的フェードアウト（削除はせず remain per no-delete policy）。
- **Metric**: Mobile bounce −15%、Mobile session time +25%。
- **Deps**: Phase 1 完了。

### Milestone 2.2 — Awwwards / FWA / CSSDA エントリ（Day 22–28）
- **Goal**: 1 件の nomination 取得。
- **Deliverable**: marketing idea 1, 2 申請。スクショ / 紹介動画 30s 制作。
- **Metric**: 申請 4 件、応答 1 件。
- **Deps**: Phase 1 完了。

### Milestone 2.3 — Pricing Page + C プラン 3 SKU 明示（Day 29–35）
- **Goal**: 受注ファネル明確化。
- **Deliverable**: business idea 8（Sprint / Origin / World）。HP の grey 領域に隠し pricing。
- **Metric**: 21 日以内に Sprint 1 件成約（60,000 円）。
- **Deps**: なし、HP に追記のみ。

---

## Phase 3: 体験差別化 + コンテンツ柱（Day 36–63）

### Milestone 3.1 — Logo Speaking 質問 UI + Lens モード（Day 36–49）
- **Goal**: HP idea 7 + 13 + tech 7。「AI = 答え」から「AI = レンズ」へ。
- **Deliverable**: `/api/lens` 実装、canon mapper 拡張、prompt cache 化。日 5 リク制限。
- **Metric**: 1 日 100 質問発生で API コスト < ¥500 / 日。
- **Deps**: Anthropic 課金枠拡張。

### Milestone 3.2 — Zine vol.01 + 観測ノート販売開始（Day 50–63）
- **Goal**: 初の info product 出口。
- **Deliverable**: Content idea 2, 11 制作 + Shopify 上架。
- **Metric**: 14 日で Zine 50 部 + ノート 80 冊販売（合計 ~250,000 円）。
- **Deps**: Gelato で zine 印刷の可否確認、不可なら国内紙工 1 社見積もり。

---

## Phase 4: ストック化と装置の社会接続（Day 64–90）

### Milestone 4.1 — 観測の記録 サブスク + 観測会 #001（Day 64–77）
- **Goal**: 月額収入 + IRL 接点。
- **Deliverable**: 
  - business idea 9 サブスク開始（Shopify Subscription or Lemon Squeezy）。
  - business idea 4 観測会 #001 開催（東京 / 12 名）。
- **Metric**: サブスク 20 人 / 月（17,600 円 MRR）、観測会 満員。
- **Deps**: Phase 3.1 で生成された観測ヒストリーデータ。

### Milestone 4.2 — 円環ジェネレータ API ベータ + OSS リリース（Day 78–90）
- **Goal**: 開発者コミュニティへの永続的な信用 / 入口。
- **Deliverable**: 
  - business idea 2 API β（10 招待制ユーザ）。
  - marketing idea 13 `particle_rings` OSS 公開。
- **Metric**: API β アカウント 10 / GitHub stars 100、有料転換 2。
- **Deps**: API ホスティング選定（自鯖 or Cloudflare Workers）。

---

## 同時進行（毎週低工数）

| 項目 | 頻度 | 工数 |
|------|------|------|
| note / Brain 連載（marketing 8） | 週 1 本 | 2h |
| Twitter / Bluesky ループ動画（marketing 3） | 隔週 1 本 | 1h |
| SEO 記事「見えないもの○○」（marketing 9） | 週 1 本 | 2h |
| バックアップ確認（risk 13） | 週 1 回 | 15 min |
| Web Vitals レビュー | 週 1 回 | 30 min |
| 完全オフ日（risk 2） | 月 1 日 | — |

---

## 90 日後の North Star

- **月商**: スポット（C プラン）240,000 円 + ストック（EC / Zine / サブスク / API）120,000 円 = **¥360,000 / mo 安定**。
- **露出**: Awwwards 等 1 nomination + 観測会 1 開催 + 紙メディア 1 掲載打診。
- **HP**: モバイル一級化、Lens AI 稼働、観測メーター稼働、3 つの新演出。
- **作品性**: 17 canon の API / OSS 化により「originator」確立。
- **司さんの労働時間**: 週 35h 以下。月 1 完全オフ。

---

## 何を捨てるか（明示的に NO）

- ブロックチェーン / NFT / トークン（risk 17）。
- 万人向け「答える AI チャット」化。
- 1 案件 60,000 円未満の C プラン受注。
- B プラン顧客の急拡大（3 件まで）。
- HP の白黒化、grey 解体、粒子の派手化。

90 日でこの NO を一度も破らないことが、最大の戦略。
