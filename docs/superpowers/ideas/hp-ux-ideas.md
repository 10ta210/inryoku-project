# HP UX アップグレード案（P3 以降）

> 判定基準: 「見え方を変えるか？」白黒禁則・grey に内包・101% 可能。
> P0–P2 の削除は厳禁。すべて加算的に組み込む前提。

---

## 1. Observation Meter（観測 +1% の常時可視化）
- **Why**: 哲学の中核「観測で +1%」を抽象から手触りへ。離脱率も上がりにくい（数字に引かれる）。
- **Sketch**: 右下に直径 18px の grey circle。スクロール / ホバー / クリック / 滞在秒で localStorage の `observation` を 0.001〜0.01 ずつ加算、円周を CMY→RGB グラデで埋める。50% を超えると粒子に薄い虹のノイズ混入。`particle_rings.js` の `summon` レジスタを 100%（実際は 101%）で発火。
- **Tech**: vanilla JS + 既存 WebGL uniform。~120 LOC。
- **Risk**: 数値化 = ゲーミフィケーションで侘び寂び毀損。→ 数字非表示、色だけで示す。
- **Priority**: P0。

## 2. Breath Sync（呼吸同期モード）
- **Why**: 哲学者育成 = 内省。閲覧者の呼吸を粒子と同期させ「自分が観測者」を体感。
- **Sketch**: トグル（小さな ◯ ボタン）で 4 秒吸う / 6 秒吐く ガイドリングを画面中央に。粒子の `breathPhase` uniform を強制同期。マイク許可があれば WebAudio AnalyserNode で実呼吸検出（RMS 低周波）。
- **Tech**: Three.js uniform + WebAudio。~200 LOC。
- **Risk**: マイク許可は心理障壁。→ デフォルト視覚ガイドのみ。
- **Priority**: P1。

## 3. Color-Memory Re-entry（再訪者認識）
- **Why**: 「観測の蓄積」を時間軸で見せる。Cookie 嫌悪を避けつつ。
- **Sketch**: 初回訪問時に粒子のシード色（CMY のうち 1 色寄り）を localStorage に保存。再訪時その色相が静かに優勢に出る。3 訪問で 2 色、6 訪問で 3 色、12 訪問で全 RGBCMY 揃って「6 色合体 = inRYOKU 裏ルート」開放（既存構想と合流）。
- **Tech**: localStorage + shader u_personalHue。~80 LOC。
- **Risk**: ストレージ削除で消失 → 「無常」の演出として受容。
- **Priority**: P0。

## 4. Constellation Naming（星座命名・匿名 guestbook）
- **Why**: 「観測 = 他者の +1%」を共有資産化。フルネーム禁則を守りつつ参加感。
- **Sketch**: 8 星座のうち hover 中の星座に小さな「⋯」。クリックで一行（最大 17 文字 / 17 canon と韻）を投稿。サーバ JSON に追加。次回以降ランダムに 1 つ静かに浮かぶ。NG word filter + moderation queue。
- **Tech**: 既存 Node http server に `/api/constellation/whisper` 追加。SQLite or flat JSON。~250 LOC。
- **Risk**: 荒らし → 事前承認 + IP rate limit + 全文検閲。
- **Priority**: P1。

## 5. Light Bridge Multiplayer（同時接続者の光走）
- **Why**: 「他者の観測も自分の +1%」を即時可視化。
- **Sketch**: SSE で同時オンライン人数を購読。他者がクリックすると、その人の星座（color-memory 由来）からこちらの観測色星座へ Light Bridge を発火。1 秒以内のトレイル。1 日 100 イベントまで自鯖、超えた分は捨てる。
- **Tech**: Node + SSE + 既存 LightBridge 機構。~180 LOC。
- **Risk**: 鯖負荷 / プライバシー。→ 完全匿名、座標のみ。
- **Priority**: P1。

## 6. 逆引きスクロール（Reverse Reveal）
- **Why**: 一般的なスクロール → 顕現の逆。隠す方向に動く。哲学的に「見せない美」。
- **Sketch**: 下にスクロールするほど EC セクションが粒子に溶けて見えにくくなる。ある閾値で「観測しないと買えない」ヒント → 上に戻ると現れる。
- **Tech**: IntersectionObserver + CSS filter blur / opacity 制御。~60 LOC。
- **Risk**: コンバージョン低下。→ A/B でカルーセル領域のみに限定。
- **Priority**: P2（要 A/B）。

## 7. Logo Speaking 拡張: 質問インターフェース
- **Why**: AI チャットは「答える存在ではなくレンズ」（vision メモ準拠）。ロゴが応答する形式に統合。
- **Sketch**: 既存 CONTACT クリックの logo speaking を拡張。テキストインプットを粒子の中に隠す（hover で現れる細い線）。質問入力 → AI 応答を canon 1 つにマップ → 円環で発話 → 同時にロゴ phaseColor を変える。ヘッドラインだけ 1 行テキスト併記。
- **Tech**: 既存 `particle_speech_rings.js` + AI proxy。~150 LOC。
- **Risk**: 「答え」が欲しい人は離脱。→ 同時にテキスト 1 行残す。
- **Priority**: P0。

## 8. 沈黙ボタン / Silence Canon
- **Why**: 17 canon の 1 つ「silence」を UI に。多くの体験は「足し算」、これは「引き算」。
- **Sketch**: 画面右上に細い垂直線 3px。クリックで 30 秒間：粒子停止 + UI 全消し + ロゴだけ。ESC で復帰。Web Vitals に `silence_event` 記録。
- **Tech**: CSS class + state。~50 LOC。
- **Risk**: ユーザは「壊れた」と思う可能性。→ 細い ESC ヒントを残す。
- **Priority**: P1。

## 9. Mobile First Touch Trail
- **Why**: 現状 mobile は p3_test.html へ redirect = 体験二級。Touch を一級市民に。
- **Sketch**: タッチ位置に短寿命（0.4s）の粒子トレイル。3 本指で「観測モード」（星座にスナップする磁場）。`touchstart/move` で粒子に attractor 注入。
- **Tech**: Pointer Events + 既存 shader attractor uniform 追加。~200 LOC。
- **Risk**: パフォーマンス。→ DPR 1.5 cap、粒子上限制御。
- **Priority**: P0。

## 10. Audio: 環境音生成（円環 canon → 音）
- **Why**: 17 canon は視覚言語。同じ canon を WebAudio で「無音の余白」を含む音に。
- **Sketch**: canon ごとに 3〜5 秒の Tone.js 風 envelope を割当（silence = 完全無音 5s）。発話と同期して再生。デフォルト OFF、左下 ◯ ボタンで切替。`prefers-reduced-motion` 時はデフォルト ON 候補（視覚刺激減）。
- **Tech**: WebAudio AudioNode graph。~250 LOC。
- **Risk**: 自動再生ブロック。→ ユーザクリック後のみ。
- **Priority**: P1。

## 11. Secret 6-Color Combination Gate（inRYOKU 裏ルート）
- **Why**: 既存構想を実装に。「P3 6 色合体 → inRYOKU 裏ルート」。
- **Sketch**: 星座 8 個のうち 6 個を特定順序で hover/click（順序は color-memory に応じて変化）。完了で 1 度だけロゴから全色のリング展開 → `/inryoku/` 裏ルート（パスワード不要、ただし 1 度しか行けない URL ハッシュ署名）。
- **Tech**: hash-based one-shot URL + クライアント状態機械。~180 LOC。
- **Risk**: 共有 SNS で意味喪失。→ 一意 URL（per-visit hash）。
- **Priority**: P1。

## 12. Time-of-Day Palette Shift
- **Why**: 「観測 = 文脈」。訪問時刻で世界が変わる = 哲学的反復不可能性。
- **Sketch**: 5–9 時: 朝霧（M 弱め）、10–17 時: 通常、18–22 時: C 強め、22–5 時: silence canon 自動発話 1 回。サーバ時刻ではなくクライアント `new Date()` で決定。
- **Tech**: shader uniform + 起動時計算。~40 LOC。
- **Risk**: なし。
- **Priority**: P0。

## 13. AI Chat 「Lens」モード（answer 禁止）
- **Why**: vision 準拠。AI は答えず、視点だけ返す。
- **Sketch**: `/api/chat` の system prompt を改修：「答えを与えるな、問いを返せ、または同じ事実を別角度で言え」。各応答に canon 1 つ付与 → 円環発話。応答 3 行以内強制。「結局これは何ですか」と聞かれたら「あなたは今、何を見ましたか」と返す。
- **Tech**: prompt engineering + canon mapper。~80 LOC（既存 ai-chat-client-shield 拡張）。
- **Risk**: フラストレーション。→ 「Lens / Answer」トグル、デフォルト Lens。
- **Priority**: P0。

## 14. Performance Art: Live Constellation Drawing
- **Why**: アート性 = 集客代行で売る「inryokü 制作」の説得材料。
- **Sketch**: 月 1 回 22:00–22:30、URL `?live=1` 限定で司さんがマウス操作する全国同時可視。WebSocket（または既存 SSE）配信。終了後、軌跡が新星座として永久追加（9 個目以降）。
- **Tech**: WebSocket broadcast + 軌跡 JSON persist。~300 LOC。
- **Risk**: 司さん負担。→ 月 1 回・30 分上限・ルーチン化（schedule skill）。
- **Priority**: P2。

## 15. Easter Egg: コンソール詩
- **Why**: 開発者哲学者誘致。Awwwards 等 dev コミュニティ流入。
- **Sketch**: DevTools オープン検出で `console.log` に円環の ASCII + 17 canon リスト + 1 行詩（毎日変わる）+ `window.__inryoku_join()` 関数（呼ぶと観測 +5%）。
- **Tech**: 既存 console wrapper。~70 LOC。
- **Risk**: なし。
- **Priority**: P0。

## 16. Guestbook-as-Constellation（恒久）
- **Why**: idea 4 の延長。集合観測の年単位アーカイブ = サイト自体の「年輪」。
- **Sketch**: 年に 1 度（12/31 24:00 JST）その年の whisper 群を新しい星座 1 つに集約レンダ。9 年目に 17 星座（17 canon と一致）に到達 → サイトのライフサイクル完了。
- **Tech**: バッチ生成スクリプト + 年次 JSON。~150 LOC。
- **Risk**: 長期運用前提（burnout 配慮）。
- **Priority**: P2。

## 17. アクセシビリティ拡張: 触覚言語
- **Why**: WCAG AA は到達済。次は「視覚なき哲学者」も招く。
- **Sketch**: スクリーンリーダー検出（screen-reader-detector heuristic）→ 各 canon を「触れる擬音語」+ 短文化（silence = 「・・・」/ ma = 「あいだ」）で aria-live。Vibration API でモバイルに canon 別パターン振動。
- **Tech**: aria-live region + navigator.vibrate。~120 LOC。
- **Risk**: SR ヒューリスティック誤検出。→ ユーザトグル併設。
- **Priority**: P1。
