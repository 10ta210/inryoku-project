# p3_code_for_claude.js — リファクタ／分割提案（2026-04-28）

`/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js`（5,356 行）を機能別ファイルに分割するための具体案。
本ドキュメントは「触らない」前提で**提案のみ**。実施は別タスク。

参照: 同階層 `p3-code-map-2026-04-28.md`（行番号インデックス）。

---

## 1. ターゲット構成

```
src/
├ p3-bootstrap.js            (renderPhase3 の orchestrator のみ)
├ particle/
│   ├ Universe.js            (L2698-2796 + 2799-2886 + drift 3136-3179 + loop6 物理部分)
│   ├ ConstellationLines.js  (L3003-3112 + updateConstellationLines L4198-4227)
│   ├ MandalaSpeech.js       (L3935-4269: 1-bit 曼荼羅 + speakBinary)
│   └ UniverseStateMachine.js (bigBangState を enum 化)
├ products/
│   ├ Products.js            (PRODUCTS 配列 L193-368)
│   ├ Cart.js                (CART L370-392 + variant ヘルパ L94-127)
│   ├ ShopifyClient.js       (L62-191)
│   ├ GelatoClient.js        (L86-151)
│   ├ CartDrawer.js          (L5087-5215)
│   └ ProductModal.js        (L5218-5331)
├ chat/
│   ├ ChatController.js      (showChatUI / closeChatUI / sendChatMsg / fetchAIResponse)
│   ├ ChatViews.js           (buildChatHTML mode 切替)
│   ├ Telepathy.js           (tp/sculpt/quantum 3 種)
│   ├ Glitch.js              (startGlitch L4800)
│   ├ Typewriter.js          (typeMsg L4272)
│   └ SpeechCanon.js         (inferSpeechCanon + emitSpeechCanon L4582-4690)
├ logo/
│   ├ LogoSphere3D.js        (init3DLogoSphere L433-773)
│   └ LogoParallax.js        (initLogoHologramParallax L777-841)
├ reveal/
│   └ BrandReveal.js         (initBrandParticleReveal L2344-2695)
├ store/
│   └ StoreCarousel.js       (initStoreGrid L1785-2068 + addToCartFromCard L2071)
├ audio/
│   ├ SfxBank.js             (brand SF / signature / particle speak / absorb / bigBang / famicom / dialup 系)
│   ├ BgmController.js       (BGM_TRACKS / loadBGM / fadeBGMIn / duck / unduck)
│   └ AudioAnalyser.js       (initP3Audio / updateAudioEnergy)
├ ui/
│   ├ FloatingControls.js    (cartIcon / muteBtn / bgmBtn 統合)
│   ├ Footer.js
│   ├ ContactForm.js
│   ├ EmailSignup.js         (Grey 入団 + renderGreyProfile)
│   ├ KonamiEgg.js
│   └ CursorTrail.js
├ services/
│   ├ ApiClient.js           (fetch ラッパ — /api/chat /api/subscribe etc.)
│   └ RefTracking.js         (?ref= 検出 → /api/ref/track)
├ universe/
│   └ Seed.js                (_inryokuSeed / mulberry32 / getUniverseShareURL L20-54)
└ utils/
    ├ spawnBigBang.js        (DOM 粒子爆発 L1761)
    ├ vibrate.js
    └ skipToShop.js
```

合計 28 ファイル目安。最大ファイルでも 400 行未満に収まる試算。

---

## 2. 分割の優先度

### 優先度 A（即実行価値・低リスク）

1. **`audio/AudioAnalyser.js`** — 共有 AudioContext は副作用がはっきりしており抽出容易。loop6 の `updateAudioEnergy()` 呼び出し 1 行で接続継続。
2. **`universe/Seed.js`** — IIFE で完結。`uRng` を named export。Three.js / DOM に触れない。
3. **`products/Products.js` + `products/Cart.js` + `products/ShopifyClient.js`** — 上から下まで純粋データ＋関数。`hasMappedVariant` 等のヘルパも一緒に持っていく。
4. **`utils/spawnBigBang.js` / `utils/vibrate.js` / `utils/skipToShop.js`** — 単機能。
5. **`audio/SfxBank.js`** — 各 `play*Sound` を集約、AudioContext を 1 個に統合（現状 4 つ並走）。

### 優先度 B（中リスク・中価値）

6. **`logo/LogoSphere3D.js`** — `window._p3LogoSphere3D` 経由のグローバル契約があるため named export + window への mirror で当面互換維持。
7. **`logo/LogoParallax.js`** — pointer/devicemotion listener と `_inryokuLogoParallaxCleanup` で完結。
8. **`store/StoreCarousel.js`** — DOM 依存だが入力（PRODUCTS, root）と出力（クリック→ showProductModal）が明確。
9. **`reveal/BrandReveal.js`** — 単発演出、setTimeout cascade を Promise/async 化する余地大。
10. **`products/CartDrawer.js` / `ProductModal.js`** — それぞれモーダル単位で独立可。
11. **`audio/BgmController.js`** — `window._p6bgm` 契約は維持。

### 優先度 C（高リスク・高価値）

12. **`particle/Universe.js`** — initParticleUniverse の物理部分のみ抜き出し。`bigBangState` を依存注入。
13. **`particle/MandalaSpeech.js`** — 1-bit 曼荼羅。Universe から `geometry/posArr/colArr` への accessor を受け取る。
14. **`chat/ChatController.js`** — universe との結合は state 変更のイベント（bigBangState 書込）と canon 通知の 2 経路に絞れば分離可。
15. **`particle/UniverseStateMachine.js`** — `bigBangState` を有限状態機械化。loop6 の状態分岐を transition table へ。
16. **`particle/ConstellationLines.js`** — 通常の星座と曼荼羅エッジが両方ある点に注意。

---

## 3. 依存関係（提案構成）

```
                    ┌─ Seed
                    │
Universe ───┬──── AudioAnalyser
            │
            └── ConstellationLines
            │
            └── UniverseStateMachine ───┐
                                         │
                                         ▼
                            ChatController ── ApiClient
                                  │              │
                                  ├── Typewriter │
                                  ├── ChatViews  │
                                  ├── Telepathy  │
                                  ├── Glitch     │
                                  └── SpeechCanon ── LogoSphere3D
                                                       │
MandalaSpeech (uses Universe geometry refs)            │
                                                       │
BrandReveal ── SfxBank                                 │
LogoParallax ──┘                                       │
                                                       │
StoreCarousel ── Products ── Cart ── ShopifyClient ── ApiClient
                              │
ProductModal ─────────────────┤
CartDrawer ───────────────────┘

Bootstrap (renderPhase3) は上記すべてを wire するだけにする。
FloatingControls は AudioAnalyser / BgmController / Cart に依存。
```

循環の懸念点と回避策:

- **ChatController → MandalaSpeech → Universe → ChatController** の循環を避けるため、MandalaSpeech は **入力（テキスト）→ 出力（速度/位置/色）の純関数化**、Universe は MandalaSpeech からのコマンドを受信する subscriber 側に。ChatController は MandalaSpeech.speak(text, callback) を呼ぶだけにする。
- **SpeechCanon → LogoSphere3D** は Logo に直接触らず、`window._inryokuSpeech` のような EventBus を 1 個経由する案もあり（既存 hook と整合）。

---

## 4. 移行手順（推奨）

**Step 0** — `p3_code_for_claude.js` を凍結。並行で `p3/` ディレクトリに新ファイルを段階作成。

**Step 1** — 純データ/純関数の切り出し（A 群）:
1. `universe/Seed.js`
2. `audio/AudioAnalyser.js`（`window.p3AudioCtx` などを named export＋mirror）
3. `products/Products.js` + `products/Cart.js` + `products/ShopifyClient.js`
4. `utils/*`
5. `audio/SfxBank.js`

各 step ごとに `p3_code_for_claude.js` の該当ブロックを `import` に置換し、ブラウザでスモークテスト（粒子起動／音／カート追加／checkout 障害なし）。

**Step 2** — UI 単発系（B 群）:

6. logo / parallax
7. ContactForm, EmailSignup, KonamiEgg, Footer, CursorTrail を `ui/` に
8. CartDrawer / ProductModal
9. StoreCarousel
10. BrandReveal

各々抽出後、対応する `setTimeout(initX, ...)` を bootstrap に残す。

**Step 3** — universe を解体（C 群、最大の作業）:

11. **先に UniverseStateMachine を作る**。`bigBangState` を enum 化、transition 関数 `transition(from, to)` を実装。loop6 内の `===` 比較を `state.is(...)` に置換。
12. **MandalaSpeech を抽出**: `setupBlock`/`speakBinary`/`updateConstellationLines`/`clearByteDisplay`/`removeConstellationMessage`/`rebuildLineMesh` を 1 ファイルへ。Universe から `getGeometry()`, `getPosArr()`, `getColArr()`, `setSize(i, v)`, `getCamera()` といった accessor を export して MandalaSpeech がそれを使う形に。
13. **ChatController を抽出**: showChatUI / closeChatUI / sendChatMsg / fetchAIResponse / startGlitch / typeMsg / SpeechCanon。bigBangState の書込は `UniverseStateMachine.transition('chatting'|'bb_collapse')` に置換。
14. **Telepathy / Sculpt / Quantum** を `chat/Telepathy.js` で 1 関数化。共通の「可視粒子をランダム選ぶ」ロジックを内部ヘルパに。
15. **Universe** は粒子生成・drift・loop6 の物理部分のみ残す。

**Step 4** — bootstrap 整理:

16. `renderPhase3` を 50 行程度の orchestrator に縮小。各 setTimeout は bootstrap 内に残してよいが、各モジュール側で「自分の起動条件」を receive するパターンへ移行（例: BrandReveal.start({delay: 1200, sphereEl: ...})）。

**Step 5** — クリーンアップ:

17. `init3DLogoSphere_disabled` 削除（提案でも記載）。
18. magic number を `const` 化、`config/timings.js` などに集約。
19. window 名前空間（`_p3LogoSphere3D`, `_universeParams`, `_p6bgm`, `_inryokuMuted`）を 1 個の `window.inryoku` namespace へ統合。

---

## 5. 各分割の難易度・落とし穴

### `particle/Universe.js`

- **難**: `loop6` がオーディオ・粒子・チャット・状態遷移を 1 つの per-frame ループでやっている。MandalaSpeech 抽出後も「物理だけのループ」と「mandala のループ」が二重になる懸念。case A: 1 ループで複数モジュールに `update(dt, state)` を委譲。case B: requestAnimationFrame を 1 つに維持し subscribers パターンに。**推奨は A**（Three.js は per-frame で renderer.render を 1 回呼ぶのが自然）。
- **落とし穴**: `origColArr` は `geometry.attributes.color.array.slice()` で作られ (L3215)、`applyPalette` がこれを書換える (L4528)。Universe と SpeechCanon/parseUniverseCommand 双方が触るので、所有権を Universe に置き、外部は `Universe.applyPalette(palette)` API 経由のみとする。

### `chat/MandalaSpeech.js`

- 必要 accessor: `geometry.attributes.position.array`, `aSize.array`, `color.array`, `camera`, `scene`（msgLineMesh add/remove）, `posArr` 別名, `uTime`, `logoWX6/Y6`, `N`, `bbLogoEl` の rect, chat element の rect。これらを Universe から受け取るオブジェクトとして渡す。
- `BYTES_PER_BLOCK=24` 等は `config/mandala.js` に。

### `chat/ChatController.js`

- `chatMode` は URL クエリから決定 (L4357)。`new URLSearchParams` を ChatViews に渡すか、ChatController が引数化。
- `chatHistory` の localStorage キー `inryoku_chat_history` を `services/ChatStorage.js` に切り出し。
- `chatSessionId` 管理は ChatController 内に閉じ込める。`isChatSessionActive` 判定は呼び出し側に隠す。

### `audio/SfxBank.js`

- 現状 4 つの AudioContext (`_brandSFCtx`, `_particleSpeakCtx`, `famicomACtx`, `audioContext`) を 1 個に統合。
- mute toggle (L1377) は SfxBank.setMuted(bool) で全 ctx 一括 suspend/resume。

### `logo/LogoSphere3D.js`

- `window._p3LogoSphere3D` への mirror は v1 では維持（SpeechCanon が参照）。v2 で EventBus 化。
- shader 文字列は別ファイル `logo/shaders/sphere.frag.js` `.vert.js` に切り出すと可読性UP。

---

## 6. テスト戦略（移行中）

`tests/` ディレクトリ既存。新規:

1. **smoke**: `node` で `import './p3-bootstrap.js'` してエラー無く読めること（jsdom + Three stub）。
2. **products/Cart**: add/remove/total/count + localStorage 永続化のユニット。
3. **chat/SpeechCanon.inferSpeechCanon**: 既知ペア（user, response）→ canon の表ベース回帰。
4. **particle/UniverseStateMachine**: transition 行列を `.transition('idle','absorb')` 形でテスト。
5. **integration**: Puppeteer or Playwright で `renderPhase3()` 起動 → 60s 間ノーエラー、Chat フロー、CART add → checkout（mock /api/chat, /api/checkout）。

各 Step ごとに 1〜2 のテストを追加し、レガシーファイルとの diff で挙動同等を確認。

---

## 7. 工数感（粗い）

| Phase | 工数 | リスク |
|---|---|---|
| Step 1 (A群純粋系) | 0.5 day | 低 |
| Step 2 (UI 単発) | 1.0 day | 低中 |
| Step 3 (Universe解体) | 2.0–3.0 day | 高 |
| Step 4 (bootstrap整理) | 0.5 day | 中 |
| Step 5 (クリーンアップ) | 0.5 day | 低 |
| **合計** | **4.5–5.5 day** | — |

---

## 8. Codex への申送り

### 8.1 Codex が編集中の箇所（推定）

> 注: 本ドキュメントは静的読みのみ。Codex の進行状況はリポジトリ git log / docs/handoff 系から推定すべき。
> `docs/codex-review-2026-04-28.md` および `docs/handoff-to-codex-2026-04-27.md` を Codex 側履歴として参照することを推奨。

p3 内で Codex がよく触るリージョンと推定される箇所:

- **L94-191** Shopify/Gelato — variant マップを今後埋める作業（`SHOPIFY_VARIANT_MAP` の各 key）
- **L195-364** PRODUCTS データ — 商品増減
- **L1014-1758** renderPhase3 内の UI（cartIcon/muteBtn/bgmBtn 配置調整、email signup コピー、契約系リンク）
- **L4453-4520** parseUniverseCommand — 新コマンド追加
- **L4600-4668** inferSpeechCanon — カノン分類ロジック
- **L4341-4408** showChatUI 初期挨拶テキスト

### 8.2 Codex が把握すべき副作用

1. `init3DLogoSphere` (L433) は `window._p3LogoSphere3D` を返す＆同 window key で多重起動防止。**この 1 個のグローバルが SpeechCanon→ Logo の連携を支えている**。書き換える際は `setSpeechCanon(canon, register)` の signature を保つこと。
2. `bigBangState` は **6 箇所**で書き換えられる（L3252, 3439, 3446, 3472, 3487, 4428）。新しい遷移を増やす場合、`loop6` の判定（L3414, 3422, 3445, 3471）も同時更新が必要。
3. `geometry.attributes.color.array` は `origColArr` (L3215) と二重管理。`applyPalette` (L4522) が両方更新する点を踏襲。
4. `chatHistory` の長さは `slice(-20)` で localStorage 保存、`slice(-10)` で API 送信 (L3776, 4712)。fetch ペイロードを変える際 trim 値も意識。
5. `setupBlock` (L3992) は粒子の `aSize` を一度 0 にしてから loop6 で復元する（origSizeArr 経由）。**aSize をいじる演出を追加するときは setupBlock/clearByteDisplay の周辺を読むこと**。
6. ESC キー リスナーは ProductModal (L5327) と CartDrawer (L5213) で **個別に登録**。両方開けば両方反応する点に注意。
7. `_inryokuMuted` は p1 から引き継ぐ。p3 で undefined のときだけ true にデフォルト (L1361)。**新しい AudioContext を作るコードでは必ず冒頭でチェック**。
8. `currentPhase` は loop6 (L3365) で 3 以外なら全リソース dispose する。Phase 切替を実装する場合この自動 cleanup を当てにできる。

### 8.3 衝突可能性の整理

並行作業で衝突しうるホットスポット:

| ホットスポット | 衝突しやすい理由 |
|---|---|
| `renderPhase3` (L1014-1758) | UI 追加は基本ここに来る。複数人で触ると merge conflict 高確率。**先に分割するメリット最大**。 |
| `loop6` (L3363-3763) | 状態分岐や物理を増やすたびに集中編集される。 |
| `parseUniverseCommand` (L4453) | 新コマンド追加で頻繁に編集される。各分岐が独立しており衝突は局所的 — **行の追加位置のみ注意**。 |
| `inferSpeechCanon` (L4600) | 重み調整で並行編集されると衝突。スコアテーブル化すると衝突回避可能。 |
| `PRODUCTS` (L195) | 商品追加・variant ID 埋めで頻繁に編集。 |
| `BGM_TRACKS` (L1164) | 曲追加。配列末尾追加で衝突低い。 |
| `init3DLogoSphere` (L433-773) | shader 編集は集中編集領域。**フェーズプリセット (L596-624) のテーブル拡張も同領域**。 |

### 8.4 推奨する Codex 連携運用

1. **本ファイル分割を Codex が始める前にやる**。後ろ倒すほど merge cost 増。優先度 A から着手し、A だけでも 30〜40% の行が外に出る。
2. 新規 UI/演出は **renderPhase3 内ではなく** 新ファイル `ui/<name>.js` に書き、bootstrap から呼ぶ規約を導入。
3. `bigBangState` を変えるのは UniverseStateMachine 経由のみ、と明文化（規約）。
4. shader 文字列の編集は `logo/shaders/*.{vert,frag}.js` を作って分離。

---

## 9. 参考: 削除候補（即削除可能と判断）

- `init3DLogoSphere_disabled` (L842-1010, 169 行) — どこからも呼ばれない（grep "_disabled" → 関数定義のみ）。
- L3280-3359 `if (false) (function() { ... })()` の RGBCMY explosion easter egg (80 行) — 司さん要望で無効化済とコメント。
- `revealBit` (L4148-4150) — 空関数、互換のためのみ存在。speakBinary→loop6 で `revealBit(bitRevealIdx)` (L3500) を呼ぶ。**削除する場合は呼び出し側も同時に削除**。
- 単発再生 audio: `playDialupSound`, `playUnlockSound`, `playDivineSound`, `playWaterSplashSound`, `playGlitchSound` (L5338-5342) は本ファイル内では呼ばれていない（p1/p2 の遺物）。**他ファイルでの参照確認後、不要なら削除**。
- `showComingSoonModal` (L5334) — 後方互換コメントあり。HTML/他 JS でまだ `onclick="showComingSoonModal()"` が残っていないか grep してから決定。

合計 270〜350 行は安全に減らせる見込み。

---

End. 実施は別タスク／別ブランチ推奨。
