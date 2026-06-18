# inryokü — P3 モバイル UX フロー徹底調査

調査日: 2026-04-28
対象: `p3_test.html` を経由する iPhone (375×812) / iPad (768×1024)
ベース: コード読みのみ（実機テストなし）。観察 + 提案。
不変ファイル: `particle_rings.css` / `particle_speech_rings.js` / `particle_rings.js` / `p3_code_for_claude.js`（Codex 編集中）。
**コード変更は行っていない。** 改善提案は diff 形式の参考案として末尾にまとめる。

---

## 0. 前提：モバイル振り分けロジック

`index.html:1212-1222` UA 判定。

```js
var isMobileUA = /Android|iPhone|iPod/.test(ua);
if (isMobileUA) window.location.replace('p3_test.html' + window.location.search);
```

注目点:
- **iPad は `iPad` を含めない**（コメント通り、Safari の "request desktop site" でデスクトップ UA が来るため）→ iPad は P0→P3 のフルフローを踏む。Safari iPad のデフォルトは 16.0 以降「デスクトップ表示」。**つまり iPad ユーザーは P0/P1/P2 をフル体験する想定**。
- ただし、iPad のホーム画面 PWA 起動や Chrome iOS では UA が `Mobile/...` を含むことがあり、`iPhone` / `iPod` には一致しないので **iPad はデスクトップ扱いで通る**（ほぼ意図通り）。
- Android タブレット（10〜13"）は `Android` 一致 → P3 直行。テキスト配置がモバイル想定で組まれているので、12.9" 表示で間延び感が出る可能性。
- P3 にリダイレクトされた後、`window.location.search` を引き継ぐので `?universe=...` は維持される。OK。
- リダイレクトは `replace` なので **戻るボタンで `index.html` に戻れない**（OK、ループ防止）。

---

## 1. ユーザージャーニー全体図（モバイル直行）

```
[1] 外部リンク / 検索 / SNS
        │
        ▼
[2] inryoku.com (index.html) — UA 判定 → 即 replace
        │
        ▼
[3] /p3_test.html — Three.js + particle_rings 即起動
    ├─ background: #p6-canvas (5000→2800 stars on mobile)
    ├─ logo holo (.logo-holo-wrap, 50–80px)
    └─ singularity-content (scrollable, padding 110/80)
        │
        ▼
[4] スクロール → 商品カルーセル (3D ring, 134→118px card)
    ├─ swipe で回転（touchstart/move/end, dx*0.09）
    ├─ tap で正面カードフォーカス（+ VIEW ボタン）
    └─ tap VIEW → 商品モーダル
        │
        ▼
[5] 商品モーダル (.product-detail, max-height 90vh)
    ├─ 画像 + 説明 + size buttons (40×40 mobile)
    ├─ ADD TO CART
    └─ ✕ で閉じる
        │
        ▼
[6] カートアイコン (top:20 right:20) tap
        │
        ▼
[7] #cart-drawer (right slide, 340px / max 90vw)
    ├─ items 一覧 + remove
    └─ CHECKOUT → window.location.href = shopify checkoutUrl
        │
        ▼
[8] Shopify checkout (外部) — 戻るボタンで戻すと cart drawer 状態消失
        │
        ▼
[9] success.html / 元の P3 に戻る → universe seed 維持
```

サブフロー:
- **メールサインアップ**: ページ下部 `.email-signup`、`/api/subscribe`。
- **CONTACT フォーム**: `.contact-toggle` 開閉、`/api/contact`。
- **Chat (`#inryoku-chat`)**: 下部固定、`max-height: 50vh`、`/api/chat`。
- **GREY 番号 / referral**: `?ref=` で `/api/ref/track`、URL クリーン化。

---

## 2. 画面ごとの UX 観察（8 画面）

### 2-1. ランディング (=P3 first paint)

ファイル: `p3_test.html`, `p3_styles.css:16-29`

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0,
  maximum-scale=1.0, user-scalable=no">
```

```css
html, body { width: 100%; height: 100%; overflow: hidden; }
.singularity-content { padding: 130px 20px 56px; overflow-y: auto; }
@media (max-width: 768px) { .singularity-content { padding: 110px 12px 80px; } }
```

観察:
- `body { overflow: hidden }` + `.singularity-content { overflow-y: auto }` の二段構成。**iOS Safari の URL バー伸縮で 100vh が動的に変わる**ため、`html/body` 高さが 100% で固定されると、URL バーが折りたたまれる/出てくる時にコンテンツの可視高が変動。`.singularity-content` のスクロールは `-webkit-overflow-scrolling: touch` 入っており OK。
- `user-scalable=no` + `maximum-scale=1.0` は **iOS 10 以降は無視される**（アクセシビリティ尊重）。フォーム input が `font-size:16px` を確保していないとピンチではなく自動ズームされる。確認済みの `font-size:16px` は妥当。
- **safe-area-inset 未使用**。iPhone X 以降のホームインジケーター領域 (34px) と被るリスク: カートアイコン `top:20px right:20px` は問題なし、しかし下部 `#inryoku-chat { bottom: 0 }` はインジケーターと重なる。

### 2-2. ロゴ + ブランド名

ファイル: `p3_styles.css:42-75, 1979-2001`

```css
.brand-name { font-size: clamp(18px, 5.6vw, 28px); letter-spacing: 0.08em; }
.logo-holo-wrap { width: clamp(50px, 14vw, 80px); margin: 8px auto 0; }
```

観察:
- iPhone 375px 幅でロゴは ~52px、iPad 768 で ~80px (clamp 上限)。発話 halo は `whisperSize:50, hoverSize:66, clickSize:80, summonSize:96, revelationSize:92` で **ロゴ径より大きい halo が出る** → ロゴ周辺をはみ出して周囲のブランド名やカードに被る可能性。
- `haloScale: 0.82` で ~82% 縮小している（p3_test.html:134）が、`summonSize:96 * 0.82 = 79px` ≈ ロゴ径。許容範囲。
- mobile では `body.inryoku-speaking .hologram-logo { transform: none }` でロゴ揺らぎを止める対応あり、良。
- **タップ代替動作**: `pointerdown` は touch でも発火する（pointer events は touch を統合）。
  - `wrap.addEventListener('pointerenter'/'pointerleave'/'pointerdown')` → モバイルの touch では `pointerdown` で `clickPulse=1, setPhase('emit')`。
  - `pointerenter/leave` は touch では触れた瞬間 enter、離れた瞬間 leave に発火する。長押しすると hover 相当が出る。**ピンチ対応や doubleTap 対応は無し**。

### 2-3. ロゴ発話中の視覚

`p3_styles.css:1985-1995`:

```css
@media (max-width: 768px) {
  body.inryoku-speaking #p6-canvas {
    filter: brightness(0.79) saturate(0.9) blur(0.18px);
  }
  body.inryoku-speaking .hologram-logo { transform: none; }
}
```

観察:
- desktop は `brightness(0.74) saturate(0.86) blur(0.28px)`、mobile は控えめ (0.79 / blur 0.18) → **モバイルでより視認性確保している**。良。
- ただし発話中に商品カルーセルに被る位置で halo が広がると、商品名 (font-size:9px) が dim 状態と重なって読みにくくなる懸念。
- 発話 halo (`pring-speech--halo`) は `z-index:31`、ロゴ wrap z-index:30、カードは z-index 不指定（積層コンテキスト依存）。**halo が下のカードに被る場合あり**。

### 2-4. 商品カルーセル

`p3_styles.css:2008-2038`, `p3_code_for_claude.js:2040-2066`

```css
.carousel-scene { width: 140px; height: 220px; perspective: 1100px; margin-top: 16px; }
.carousel-item { width: 118px; left: 11px; }
.product-card-name { font-size: 9px; }
.product-card-price { font-size: 9px; }
```

観察:
- カルーセル幅 140px / iPhone 画面 375px (padding 12px) → 大きく余白が両側にあり、3D の遠景カード (背面) は scene の外まで迫り出す（`carousel-ring` rotateY → カードが scene 外に出てもクリッピングなし）。OK だが、**スワイプの当たり判定は `grid` 要素全体**らしい。scene 外をタッチしても回せるか確認が要る。
- `touchstart` が `{ passive: true }` → `e.preventDefault()` は呼べない。**画面縦スクロールとカルーセル横回転が競合**する可能性。横方向の dx が大きい場合は OS の慣性スクロールが発動しない（passive=true なので preventDefault しないため、スクロールは継続）。**実機: 斜めスワイプで縦/横どちらも引きずられる体感になる懸念**。
- フロントカード判定後のタップで `bringCardForward` + VIEW ボタン表示。ただし `dragMoved` が true の状態でもクリックイベントは発火する（`setTimeout(50ms)` で false に戻すため、タッチ離した直後の `click` は dragMoved = true 扱い）— OK、誤タップ抑制。
- **VIEW ボタン (`.card-view-btn`) は `bottom:-28px`** → 前面カードの下にぶら下がる。iPhone 375 で scene height 220 + margin-top 16 + button -28 = カード下端から +20px 程度。OK だが、scene の下にすぐ email-signup や footer が来る場合、VIEW と other UI が密接する。
- 商品カードイメージ `.product-card-img img { width: 122%; height: 122%; ... transform: translateY(-4px) rotateX(7deg) }` → **122% で枠外にはみ出して描画**。`overflow: hidden` がない `.product-card-img`（`p3_styles.css:908-914` で `overflow: hidden` 指定済み）→ 枠内クリップされる、OK。

### 2-5. 商品モーダル + サイズ選択 + カートに追加

`p3_styles.css:1313-1332, 2082-2108, 1215-1280`

```css
@media (max-width: 640px) {
  .product-detail-inner { flex-direction: column; }
  .product-detail { max-height: 95vh; border-radius: 16px; }
}
@media (max-width: 768px) {
  .product-detail { max-height: 90vh; border-radius: 12px 12px 0 0; }
  .size-btn { width: 40px; height: 40px; font-size: 12px; }
}
```

観察:
- **640px と 768px の二重メディアクエリで `.product-detail` の `max-height` と `border-radius` が衝突**。CSS 順は 640 → 768 なので、375px 幅 (両方ヒット) では 768 の値が後勝ち = `max-height:90vh, border-radius:12px 12px 0 0`。意図通りだが冗長。
- **size-btn 40×40 は WCAG 推奨 44×44 を割っている**。Apple HIG 同様 44pt 推奨。タップターゲット不足。
- ボタン間 `.size-options { gap: 8px }` で 40+8+40+8+40+8+40 = 192px。S/M/L/XL の 4 ボタン余裕で収まる。
- `.product-detail` は border-radius `12px 12px 0 0` → 下が角丸ない = ボトムシート的。だが実装は `right:0` の cart-drawer と違い、商品モーダルは中央？ 関連する `.product-detail` 位置定義を要確認（CSS 検索で `.product-detail` 全体 layout が見当たらない場合、JS で position 指定の可能性）。

### 2-6. カートドロワー → チェックアウト

`p3_styles.css:1804-1944`, `p3_code_for_claude.js:5120-5210`

観察:
- ドロワー幅 `340px` / `max-width: 90vw`。iPhone 375 → 337px、ほぼ全幅。OK。
- `right: -360px` 起点 → `right: 0` トランジション。スワイプで閉じるジェスチャーは未実装。**戻るボタンで閉じる動作も未実装**（カートを開いている時に history.back すると、ドロワーが開いたまま元のページから離脱）。
- `cart-checkout-btn` padding 14px → ボタン高 ~44px、OK。
- **CHECKOUT の挙動は `window.location.href = checkoutUrl`** → 外部 Shopify ページへ遷移。Safari で「戻る」を押すと P3 に戻り、cart drawer は消えてカート内容は localStorage 経由で復元される（`CART` の保存実装次第）。`CART.add` 周辺で localStorage 連携があるか要確認。
- alert() で `'Checkout error: ' + err.message` → モバイルの alert は OS ダイアログでフロー断絶感が強い。トースト風にしたい所。

### 2-7. メール入力 + CONTACT フォーム

`p3_styles.css:2040-2045, 2280-2400`

```css
@media (max-width: 768px) {
  .contact-input, .contact-textarea { font-size: 16px; }
  .email-signup-input { font-size: 16px; }
  #chat-input { font-size: 16px; }
  #chat-tp-input { font-size: 16px; }
}
```

観察:
- iOS auto-zoom 防止 OK。
- ただし base 定義 (`p3_styles.css:2287, 2351`) は `font-size: 13px`。**768px 以下のみ 16px に上書き**。デスクトップは 13px なので問題なし。iPad で width>768 だと 13px でズームされる可能性 → iPad 縦 (768) は境界、横 (1024) は 13px → 13px で iOS Safari は zoom 発動する。**iPad 横向きでメール欄/contact をタップするとズームされる**。
- `.email-signup-row { display:flex; max-width: 320px }` の input + button は border 1px ずつ。input flex:1、button width 不定。**狭幅 320 でもボタン文字「→」だけだから問題なし**。

### 2-8. チャット UI

`p3_styles.css:1354-1370, 2055-2075`

```css
@media (max-width: 768px) {
  #inryoku-chat {
    left: 8px; right: 8px; bottom: 0; width: auto; max-height: 50vh;
    border-radius: 12px 12px 0 0 !important;
  }
}
```

観察:
- `bottom: 0` で safe-area 未考慮。**iPhone X+ で送信ボタンがホームインジケーターと重なる**。
- max-height 50vh + チャット入力欄あり → キーボードを開くと iOS は `window.innerHeight` が小さくなり、`50vh` も縮む。`#chat-messages { min-height: 120px; max-height: 200px }` 固定 → キーボード時にメッセージ領域がほぼ見えない可能性。
- chat は `position: fixed` → Safari の visual viewport / layout viewport の差異で、キーボード上にちゃんと乗らない場合あり (visual viewport 対応 = `window.visualViewport.resize` を聞く必要)。

---

## 3. 想定される問題リスト（重大度別）

### 🔴 Critical — 購入フローを止める / 物理的に押せない

| # | 問題 | 場所 | 想定影響 |
|---|---|---|---|
| C1 | size-btn 40×40 < 44×44 | `p3_styles.css:2104-2108` | サイズ選択ミスタップ → 購入転換率低下 |
| C2 | チェックアウト失敗時 `alert()` 多用、戻るボタンで状態破壊 | `p3_code_for_claude.js:5170, 5182, 5198, 5204` | 購入ファネル離脱 |
| C3 | iPad 横（>768px）でフォーム input 13px → タップでズーム | `p3_styles.css:2287, 2351` | iPad で離脱 |
| C4 | カートドロワー: 戻るボタンで閉じない (history 未統合) | `p3_code_for_claude.js:5140-5146` | iOS 通例の戻る = ドロワー閉じる、を裏切る |

### 🟠 High — 体験の質を下げる

| # | 問題 | 場所 | 影響 |
|---|---|---|---|
| H1 | safe-area-inset 全面未対応 (chat, footer, cart drawer) | `p3_styles.css:1354, 1804` | iPhone X+ でホームバー下と重複 |
| H2 | カルーセル touchmove `passive:true` → 縦スクロール競合 | `p3_code_for_claude.js:2049` | 斜めスワイプで両軸暴走 |
| H3 | `#chat-input` キーボード開時の visualViewport 未対応 | `p3_styles.css:2055-2070` | チャット入力欄がキーボード裏に隠れる |
| H4 | 商品モーダル `max-height:90vh` + iOS URL バー伸縮 | `p3_styles.css:2083` | 100vh ≠ 実可視領域 → 切れる |
| H5 | 商品名 9px / status 9px が極小 | `p3_styles.css:2033, 2038` | 視認性 (アクセシビリティ違反) |
| H6 | カーソル trail が touch 環境で不要 | `p3_code_for_claude.js:1394-` (`mousemove`) | パフォ食いだけで効果ゼロ |
| H7 | 重い 3D アセット読み込み中のフォールバック無し | `p3_test.html:17-23` (preload) | 低速回線で空白画面 |

### 🟡 Medium

| # | 問題 | 場所 | 影響 |
|---|---|---|---|
| M1 | `user-scalable=no` (iOS 無視) は意図通りでも ARIA 推奨外 | `p3_test.html:5` | アクセシビリティスコア -1 |
| M2 | `bring/dragMoved` の click 抑制が 50ms only | `p3_code_for_claude.js:2035, 2065` | スワイプ後 50ms 超で誤タップ起こりうる |
| M3 | 発話 halo が周辺要素に被る z-index 競合 | `particle_rings.css:121-144` (z:31) と product-card | 発話中に商品名読めない |
| M4 | 円環粒子言語 ロゴ径 52px に halo 96px (clickSize/haloScale 0.82=79) | p3_test.html:127-134 | ロゴサイズ比でやや大きく感じる |
| M5 | mute / cart icon 10px padding + 20px icon = 40px ターゲット | `p3_code_for_claude.js:1354, 1368` | 44 未満 |
| M6 | `@media (max-width:768px)` の `.singularity-content { padding-bottom:80px }` だけで iPhone safe-area + chat 50vh 重なる時の余白不足 | `p3_styles.css:1966` | 最下部 contact が chat に隠れる |
| M7 | particle universe N=2800 mobile は妥当だが、Bloom (UnrealBloomPass) は ON のまま | `p3_code_for_claude.js:3116-3120` | iOS Safari の WebGL bloom は重い、FPS 落ちる |
| M8 | `setPixelRatio(Math.min(devicePixelRatio, 1.5))` desktop 共通 | `p3_code_for_claude.js:2712` | iPhone 14 (DPR 3) で 1.5 に絞っており妥当だが、最小 1 にしてもいいかも |
| M9 | orientationchange イベント未listen (`resize` のみ) | `p3_code_for_claude.js:3132` | resize は発火する場合多いが、機種差あり |
| M10 | カートアイコン z-index:1000、cart drawer 10001、商品モーダル不明 | scattered | drawer 開いた時にカートアイコンが下に潜る (意図不明) |

### 🟢 Low

| # | 問題 | 影響 |
|---|---|---|
| L1 | 640 と 768 の二重 media query で `.product-detail` が冗長 |  保守性 |
| L2 | brand-char `letter-spacing: 0.08em` clamp(18-28px) で iPhone 375 表示時に「inryoku」7文字 = ~6.3vw×7 = 44vw 程度収まる、OK |  確認のみ |
| L3 | 商品カード `font-size: 9px` は Lighthouse legibility 違反 (12px 推奨) |  SEO/A11y |
| L4 | 円環粒子の `pring-breathe` (transform: scale + rotate) アニメは `prefers-reduced-motion` 尊重済み | `particle_rings.css:205-213` 良 |
| L5 | カートアイコン badge `top:-4px right:-4px` で iPhone notch 角と被らない位置 | 良 |
| L6 | `console.log('[MOBILE-CHECK]...)` が本番でも残っている | `index.html:1218` |  ノイズ |

---

## 4. 司さんが実機で確認すべきチェックリスト（35 項目）

### A. 起動 & viewport (5)
- [ ] A1. iPhone Safari で `inryoku.com` を開いて p3_test.html に確実にリダイレクトされるか
- [ ] A2. iPad Safari (デスクトップ表示 OFF) で P3 直行 / ON で P0→P3 が分岐するか
- [ ] A3. URL バーが折りたたまれた瞬間に `.singularity-content` の最下部 (CONTACT) が見えるか
- [ ] A4. ピンチズーム不可（`user-scalable=no` 無視されたら 100% で固定されるか）
- [ ] A5. 横向きにした瞬間に Three.js canvas / カルーセル / ロゴが正しくリサイズされるか（`resize` イベントのみリッスン）

### B. ロゴ & 円環粒子発話 (5)
- [ ] B1. ロゴをタップ → `pointerdown` で halo (clickSize 80, haloScale 0.82) が出るか
- [ ] B2. 長押しで hover 相当の状態が継続するか / 離した瞬間に whisper に戻るか
- [ ] B3. 発話 halo がブランド名 / 商品カードに被って読みづらくなっていないか
- [ ] B4. デバイス傾斜 (`deviceorientation`) で halo が動くか — iOS は permission 必要、未実装なら無反応
- [ ] B5. ロゴサイズ 52px (375 幅) でホロスキャンライン / ホログラム感が貧弱でないか

### C. パーティクルユニバース (4)
- [ ] C1. iPhone で起動直後の FPS（Safari → Develop メニューで計測）— 目標 30fps 以上
- [ ] C2. Bloom 効果のオーバーヘッド: composer6 が初期化されているか
- [ ] C3. setPixelRatio = min(DPR, 1.5) → iPhone 14 (DPR 3) で 1.5 採用、画質と速度のバランス
- [ ] C4. パーティクル数 2800 が体感で「圧」「うっとうしさ」のどちらに振れるか

### D. カルーセル (5)
- [ ] D1. 横スワイプ: dx 30px 以上で確実に回るか
- [ ] D2. 縦スクロール中の斜めスワイプで誤回転しないか（passive:true なので両方発火する想定）
- [ ] D3. 慣性 velocity 0.96 減衰 → 何秒で停止するか
- [ ] D4. 前面カードを 2 回タップ → VIEW ボタンが出るタイミング / dragMoved=false 待ち 50ms
- [ ] D5. カード外タップで activeCard リセット動作

### E. 商品モーダル & カート (6)
- [ ] E1. ADD TO CART 後にトーストが notch に被らない位置に出るか
- [ ] E2. size-btn 40×40 でタップミス（M を押したつもりが S）が起きないか
- [ ] E3. カート内 1 件削除 → CART (n) 数字が即更新
- [ ] E4. CHECKOUT タップ → Shopify 遷移 → 戻るボタン → P3 に戻る → カート内容が localStorage で復元されているか
- [ ] E5. CHECKOUT SOON 状態で押した時に disabled 効いているか
- [ ] E6. cart-drawer 開いた状態で OS の戻るジェスチャー (iPhone 左端スワイプ) — ドロワー閉じるか / 履歴戻るか

### F. フォーム入力 (5)
- [ ] F1. メール欄タップで自動ズームしない (16px 確認)
- [ ] F2. CONTACT フォームの textarea でも同様
- [ ] F3. iPad 横向き (1024) でフォーム input が 13px のまま → ズームするか確認
- [ ] F4. キーボード出した時に input がキーボードに隠れずスクロール追従するか
- [ ] F5. submit 後にトースト or ステータス文言が表示されるか / 二重送信防止

### G. チャット (3)
- [ ] G1. キーボード開いた時に `#chat-messages` が見えるか
- [ ] G2. `bottom: 0` がホームインジケーター 34px と被らないか
- [ ] G3. テーマ切替（win95 / dos / mac / famicom / glitch）が描画崩れなく動くか

### H. 戻る & ナビゲーション (2)
- [ ] H1. P3 で `?universe=` を変えて再読み込み → 同じ宇宙が再現されるか
- [ ] H2. ブラウザ戻る連打で history が消えるか / replace 効いているか（index.html → p3_test.html → 戻る = 履歴1個）

---

## 5. 改善提案（diff 形式、最重要 5 件）

> いずれも `p3_styles.css` のみの変更。`particle_*` / `p3_code_for_claude.js` は触らない。
> 適用は司さんの判断。

### 提案 1: safe-area-inset を chat / cart drawer / singularity-content に注入 (H1)

```diff
--- a/p3_styles.css
+++ b/p3_styles.css
@@ @media (max-width: 768px) {
     .singularity-content {
         justify-content: flex-start;
-        padding: 110px 12px 80px;
+        padding: calc(110px + env(safe-area-inset-top, 0px)) 12px
+                 calc(80px + env(safe-area-inset-bottom, 0px));
         overflow-y: auto;
         -webkit-overflow-scrolling: touch;
         gap: 12px;
     }
@@
     #inryoku-chat {
         left: 8px;
         right: 8px;
-        bottom: 0;
+        bottom: env(safe-area-inset-bottom, 0px);
         width: auto;
         max-height: 50vh;
         border-radius: 12px 12px 0 0 !important;
     }
@@ #cart-drawer {
     position: fixed;
-    top: 0;
+    top: env(safe-area-inset-top, 0px);
     right: -360px;
     width: 340px;
-    max-width: 90vw;
-    height: 100vh;
+    max-width: 90vw;
+    height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
```

加えて `p3_test.html` の viewport meta に `viewport-fit=cover` 追加が必要:

```diff
- <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
+ <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

### 提案 2: size-btn を 44×44 に (C1)

```diff
@@ @media (max-width: 768px) {
     .size-btn {
-        width: 40px;
-        height: 40px;
+        width: 44px;
+        height: 44px;
         font-size: 12px;
     }
 }
```

`.size-options { gap: 8px }` のまま 4 ボタン → 44*4 + 8*3 = 200px、まだ 320px-padding に余裕。

### 提案 3: iPad 横含め全モバイルでフォーム 16px (C3)

`@media (max-width: 768px)` のみだと iPad 横でズーム発動。ベース定義側を上げる方が安全:

```diff
 .email-signup-input {
     flex: 1;
     background: transparent;
     border: 1px solid rgba(255,255,255,0.15);
     border-right: none;
     color: #fff;
     font-family: -apple-system, BlinkMacSystemFont, sans-serif;
-    font-size: 13px;
+    font-size: 16px; /* iOS auto-zoom 防止 — 全画面サイズで 16px 維持 */
     padding: 12px 16px;
     outline: none;
     transition: border-color 0.3s;
 }
@@
 .contact-input, .contact-textarea {
     width: 100%;
     background: transparent;
     border: 1px solid rgba(255,255,255,0.12);
     color: #fff;
     font-family: -apple-system, BlinkMacSystemFont, sans-serif;
-    font-size: 13px;
+    font-size: 16px;
     padding: 10px 14px;
```

### 提案 4: カルーセル touch-action でスクロール競合を解消 (H2)

CSS だけで `touch-action` を制御 (JS 触らず)：

```diff
@@ @media (max-width: 768px) {
     .carousel-wrap {
       max-width: 100%;
       padding: 10px 0;
+      touch-action: pan-y; /* 縦スクロールは OS、横ジェスチャーは JS が読むだけ */
     }
+    /* item-grid (カルーセル中央のスワイプ受け) は横ジェスチャー優先 */
+    .item-grid {
+      touch-action: pan-y; /* 横回転は意図的に passive 取得、縦は OS に委ねる */
+    }
```

`touch-action: pan-y` にしておくと、横方向は OS のスクロール対象にならず、`touchmove` ハンドラの dx 計算がそのまま意図に使える。垂直は OS が普通にスクロール。

### 提案 5: 商品名 / status の最小フォントを 11px に (H5)

```diff
@@ @media (max-width: 768px) {
     .product-card-name {
-      font-size: 9px;
+      font-size: 11px;
       white-space: normal;
       word-break: normal;
       line-height: 1.3;
     }
-    .product-card-price { font-size: 9px; }
+    .product-card-price { font-size: 11px; }
```

カードイメージ width 118px に対して 11px はまだ 1 行に「OBSERVATION TEE」程度入る計算。

---

## 6. 補遺：触らないファイルへの観察メモ（参考のみ）

`p3_code_for_claude.js`（Codex 編集中、読み取りのみ）

- L1158 `_isMobile = /Android|iPhone|iPad|iPod/i.test(...) || (innerWidth<768 && ontouchstart)` — ここでは iPad **含む** ので注意。`index.html:1215` の判定とは違うロジック → **iPad は p3_test.html へは行かないが、p3 内のロジックでは mobile 扱いされる**箇所がある。
- L2040 `grid.addEventListener('touchstart', ..., {passive:true})` → 提案 4 と関係。
- L2712 `setPixelRatio(min(DPR,1.5))` で 2.5x 以上のディスプレイでは 1.5 に固定。良。
- L3132 `window.addEventListener('resize', onR6)` のみ。`orientationchange` は明示的に必要ないが、Android Chrome では resize が発火しない瞬間あり。視覚的崩れの実機確認推奨。
- L1394 `mousemove` カーソル trail は touch では無発火（touch → mouse 互換イベントは Safari で出るが、`pointermove` ではない `mousemove` のみ → モバイルは noop）。**問題なし**。

`particle_speech_rings.js` (読み取りのみ)

- L26-27 デフォルト `whisperSize:96, hoverSize:120` — p3_test.html で 50/66 に上書き済み。
- L235 サイズ解決ロジック OK。
- L220 `_alignToLogo` は `placement === 'halo'` 時のみロゴ中心に追従。`requestAnimationFrame` で毎フレーム位置合わせ → ロゴが flex で動いても halo が追随。良。

---

## 7. 司さんへ — 優先順位の私見

1. **提案 1 (safe-area)** → iPhone X 以降の全機種で効く、CSS 一発変更。
2. **提案 3 (16px ベース)** → iPad で離脱を確実に潰す。
3. **提案 2 (size-btn 44px)** → 購入導線の物理的不備を解消。
4. **提案 4 (touch-action)** → カルーセル UX 体感が変わる。
5. **提案 5 (font-size 11px)** → A11y / SEO に効く。

実機確認は B2 (タップ代替動作) と D2 (斜めスワイプ) が最も「触ってみないと分からない」項目。Codex の編集が落ち着いたら実機で 5 分触ってみるだけで H2 / H3 の挙動が掴めるはず。

以上。
