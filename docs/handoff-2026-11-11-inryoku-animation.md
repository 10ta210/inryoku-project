# 引き継ぎ: inRYOKU アニメーション (クラウドセッション → Mac)
**date:** 2026-11-11
**branch:** `claude/inryoku-animation-4l3728` (main から分岐、プッシュ済み)

Mac でこのブランチを開いた Claude は、まずこのファイルと下の「読む順番」を読むこと。

## Mac で取り込む
```bash
git fetch origin
git checkout claude/inryoku-animation-4l3728
npm start
```

## Mac で見る (npm start のあと)
| 見たいもの | URL | 操作 |
|---|---|---|
| 視線の引力 (/inryoku/ に組み込み済み) | http://127.0.0.1:3000/inryoku/index.html | 下の「合言葉の代わり」をしてから開く。画面を約 1 秒じっと長押し → 粒子が渦を巻いて集まる。離すとほどける |
| 全ては 1 (ラフ・未組み込み) | http://127.0.0.1:3000/inryoku/one-preview.html | 開くだけ。15 秒で 1 周の無限ループ |

- 合言葉の代わり: `/inryoku/` はゲートがある。ブラウザの開発者ツールのコンソールで
  `localStorage.setItem('__inryokuP2Password', 'dev')` を実行してから開く。
- `/inryoku/` (末尾スラッシュ) は server.js では 404。`/inryoku/index.html` で開く (以前からの挙動)。

## 読む順番
1. `docs/superpowers/specs/2026-11-11-inryoku-story-all-is-one.md` — 物語「全ては 1」、世界観、仕組み、未決
2. `docs/superpowers/specs/2026-05-12-inryoku-route-design.md` §9.1 — 視線の引力
3. `docs/brand-line-definition-2026-05-15.md` — inryokü (101%) / inRYOKU (50%) の対

## このブランチでやったこと
| コミット | 内容 |
|---|---|
| 視線の引力 | `inryoku/inryoku-gravity.js` (数学)、`inryoku-world.js` / `index.html` / `inryoku.css` に組み込み。テスト 12 件 |
| 全ては 1 (ラフ) | `inryoku/inryoku-one.js` (自己相似ループ)、`inryoku/one-preview.html`。テスト 8 件 |
| CSP 対応 | `/inryoku/` の Three.js を unpkg → `vendor/three` (同じ r160) に。server.js の script-src に unpkg.com が無く、3D が読み込めていなかった |

テスト: `node --test tests/inryoku-gravity.test.mjs tests/inryoku-one.test.mjs` (20 件)。
リポジトリ全体の `npm test` には、このブランチ以前からの失敗が 27 件ある (i18n・サイトマップ等。変更前後で同じ)。

## 会話で出た大事なこと (司さんの言葉)
- この世界は 0 と 1 とコアでできていて、組み合わせると ⓘ。
- "u more" → humor。言語は音と記号でつながる。
- 最初に文字になったのは 1。全ては i から生まれ、全ては 1。
- あらすじ: i の点 → 線 → 少し違う線 → 増殖 → 1 → 色々な 1 → 遠くから見るとまた i の点 → また 1 (無限ループ)。
- 「魔法の言葉 (チートコードのように、発音すれば世界が変わる言葉)」を探すか、考えるか。
  - Fable の答え: 「探してから、仕込む」。魔法の言葉は世界ではなく、世界を見ている人に効く。
    候補は「あい」(I・eye・愛・会い)、「in」(引・陰・音・韻・因 / information = 形を与える)、
    「阿吽」(始まりと終わり)、「hello, world」。
- Ai を 2 進数にすると: A = `01000001`、i = `01101001`。
  - i は逆から読むと 0 と 1 が全部入れ替わる。
  - i はトゥエ・モース数列 (0 → 01 → 0110 → 01101001) の最初の 8 桁と一致する。
  - 数学の i は 4 回かけると 1 に戻る。オイラーの等式 e^(iπ) + 1 = 0 に 0・1・i が入っている。
  - 愛 = U+611B (61 = a)、👁 = U+1F441 (41 = A)。どれも偶然。

## 未決 (次に司さんと決めること)
- 「全ては 1」の 1 周の長さ (ラフは 15 秒)、横長か縦長か
- サイトのどこで流すか (/inryoku/ に入った瞬間 / 背景 / 単独の映像)
- 音 (ドローン / 呼吸 / 言葉)。`01101001` を i の点が灯るリズムに使うか
- 魔法の言葉 / 「Ai」の意味
- 視線の引力の速さ・大きさ (集まる約 2.4 秒 / ほどける約 4.3 秒)

## 動画の書き出し (Mac でやる場合)
- 道具: HyperFrames (`npx hyperframes`、Node 22 以上) + FFmpeg (`brew install ffmpeg`)。
- 計測は OFF にする: `export HYPERFRAMES_NO_TELEMETRY=1`。`publish` / `cloud` (HeyGen へのアップロード) は使わない。
- どちらのアニメーションも時刻 t の純粋関数なので、そのまま書き出せる:
  - 全ては 1: `createOneView({ THREE, container, width: 1920, height: 1080, pixelRatio: 1, manual: true })` → `hf-seek` で `view.renderAt(t)`
  - 視線の引力: `createInryokuWorld({ manual: true, random })` → `scriptGravity([{t, target}])` → `renderAt(t)`
