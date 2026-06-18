# Tech Experiments

> ビルドゼロ・vanilla JS の制約は基本維持。実験は `experiments/` 配下にスタンドアロン HTML として隔離、合格したものだけ本体合流。

---

## 1. WebGPU Compute Particles
- **Hypothesis**: 100k+ 粒子を 60fps で。WebGL InstancedMesh は 30k あたりで頭打ち。
- **Approach**: WGSL compute shader で position / velocity 更新、render は既存 WebGL fallback と並列維持。`navigator.gpu` 検出で switch。
- **Effort**: 2 週間。
- **Risk**: 対応ブラウザ偏（Safari は 2024 後半から、iOS は別計算）。fallback 必須。

## 2. Audio Reactive via Mic
- **Hypothesis**: 周囲音 → 粒子。idea HP-2 と接続。
- **Approach**: getUserMedia + AnalyserNode、FFT 32 bin。canon ごとに帯域マッピング（silence = 全帯域 -40dB 未満で発火）。
- **Effort**: 1 週間。
- **Risk**: マイク権限・プライバシー UI 表現。

## 3. Vision API（Webcam → 粒子反応）
- **Hypothesis**: カメラ越しの明度 / 動き / 顔の存在で粒子が変わる。「見られている」体験。
- **Approach**: MediaPipe Face Landmarker (WASM) または Pose Landmarker。サーバ送信なし完全ローカル。検出失敗時はスキップ。
- **Effort**: 2 週間。
- **Risk**: 不気味の谷 / プライバシー恐怖 → デフォルト OFF + 「これはサーバに送信されません」明示。

## 4. 空間音響（HRTF Spatial Audio）
- **Hypothesis**: ヘッドホンで頭の周囲 360° に canon を配置。
- **Approach**: WebAudio PannerNode + HRTF。星座 8 つを 8 方向に配置、hover で対応方向から発話音。
- **Effort**: 1 週間。
- **Risk**: スピーカ環境では効果ゼロ → 自動検出は困難、トグル。

## 5. 円環 canon → 生成音楽
- **Hypothesis**: 17 canon を音階 / リズムに割り当て、訪問者の操作シーケンスから音楽が立ち上がる。
- **Approach**: Tone.js or 直書き Oscillator。canon 順序 = ノートシーケンス。1 セッション = 1 曲、終了時 wav export。
- **Effort**: 2 週間。
- **Risk**: 質を担保しないと「ノイズ」止まり。司さんの審美眼で keep/discard。

## 6. AI Dream Sequence（オフピーク時の自動演出）
- **Hypothesis**: 30 秒以上操作なしで「夢」モード。AI が生成した 1 行詩を粒子で「描く」（既存 16 canon を組合せた円環 sequence）。
- **Approach**: idle detect + サーバ side で日次バッチ生成した 30 行を rotate。
- **Effort**: 1 週間。
- **Risk**: 退屈 → 30 秒ではなく 60 秒に。

## 7. GPT-driven Philosophical Q&A integrated with Logo Speaking
- **Hypothesis**: idea HP-7 の本格版。質問 → claude-sonnet で 3 行以内応答 → canon マッピング → ロゴ phaseColor 同期 → 発話。
- **Approach**: `/api/lens` 新設、prompt cache 利用（system は固定）。
- **Effort**: 1 週間。
- **Risk**: コスト。→ 1 IP / 日 5 回まで、超過は localStorage 「明日また来てください」。

## 8. Proof of Observation（オフチェーン）
- **Hypothesis**: 観測メーター 100% 到達を改ざん不可に。**ただしブロックチェーンは使わない**。
- **Approach**: サーバ署名 (Ed25519) + nonce。証書 SVG にサーバ署名を ASCII 埋込。検証 URL あり、サーバが消えれば失効 = 無常哲学に整合。
- **Effort**: 3 日。
- **Risk**: なし（小規模）。

## 9. 連邦観測（Federated Multi-site Connection）
- **Hypothesis**: 別ドメインで動くサテライト inryokü（協力アーティストの個展サイト等）と粒子状態を同期。
- **Approach**: WebSocket relay rendezvous server（自鯖 1 つ）+ サテライト SDK 1 ファイル < 5KB。
- **Effort**: 3 週間。
- **Risk**: 鯖負荷、悪用 → API key + 招待制。

## 10. WASM 粒子質感プラグイン
- **Hypothesis**: サンプル 0–10 を超える質感を WASM で配布、ユーザがロード可能。
- **Approach**: Rust → wasm-bindgen の小モジュール、`?wasm=url` で動的読込。コミュニティ contrib 受付。
- **Effort**: 4 週間。
- **Risk**: 信用 chain（任意 WASM 実行）。→ 自鯖 hosted のみ allowlist。

## 11. CRDT-based collaborative constellation drawing
- **Hypothesis**: 複数ユーザが同時に 1 つの星座を描く実験。
- **Approach**: Yjs（CDN）+ WebSocket。月 1 のライブイベント時のみ起動。
- **Effort**: 2 週間。
- **Risk**: 荒らし → モデレーション。

## 12. Lighthouse Mobile Performance 90+ 詰め
- **Hypothesis**: 現状 70 台。WebGL を主犯と分離し詰める。
- **Approach**: 粒子粒度 cap、initial paint 後に WebGL ブート、テクスチャアトラス化、シェーダ minify、`prefers-reduced-data` 検出。
- **Effort**: 1 週間。
- **Risk**: 体験トレードオフ → 詰めても baseline 質感は固定維持。
