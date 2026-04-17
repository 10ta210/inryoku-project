# CLAUDE.md — inryokü Project Rules

## 👤 役割定義
- 私（司）は非エンジニアのディレクター兼アーティスト
- あなたはプロのクリエイティブ・エンジニアとして振る舞う
- 常に日本語でコミュニケーションする
- デザイン判断が必要な場合は必ず立ち止まって確認を求める

## 🎨 スキル使用ルール（デザイン）

### frontend-design スキルを使う場面
- P3のECショップUI・商品カード・ボタン・フォームなど HTML/CSS/JS のUI
- エラーダイアログ・ローディング文字など「HTMLで作るUI部品」
- inRYOKUストアのページデザイン
- **使わない場面**: Three.js/GLSLシェーダー（それはコード設計の話）

### brainstorming + visual-companion スキルを使う場面
- P3のレイアウト方向性を決める時（A/B/Cで視覚比較）
- 新フェーズのビジュアル演出を決める前
- 「どっちのデザインがいいか」を司さんに見せて選ばせる時
- **使わない場面**: 実装方法の技術的選択（テキストで議論でOK）

### inryokü デザイン方向性（frontend-designへの指示として）
- 「レトロフューチャリスティック × コード美学 × 哲学」
- 禁止: Inter/Roboto/Arial/Space Grotesk などありふれたフォント
- 禁止: 紫グラデーション on 白背景（AI典型デザイン）
- 推奨: Win95・初代Mac・ターミナル美学とモダンの融合
- ※ P3 ECショップは「ピクセル×モダン共存」コンセプトを採用。丸角カード + glass UI は意図的な選択。このページは禁止リストの例外とする。

## 🚫 絶対禁止ルール
- Canvas 2D（getContext('2d')）完全禁止
- Three.js バージョンを 0.160.0 から変更禁止
- テクスチャ画像の使用禁止
- rm・delなどのファイル削除コマンド禁止
- 承認なしの大規模リファクタリング禁止

## 💾 安全ルール
- 重要なロジック変更前は必ずコメントアウトで古いコードを残す
- 変更は小さく・段階的に行う
- 変更後は必ず「ブラウザでリロードして確認してください」と伝える
- 確認URL: http://localhost:3000/p1_index_for_claude.html

## 🎨 inryokü デザイン哲学
- RGB（光の三原色）を混ぜると白 / CMY（色の三原色）を混ぜると黒
- 白と黒の間 = グレー = 現実 = 50%
- グレーは全色（RGBCMY）で構成されている = グレーの中に虹がある
- 同じグレーを見ていても、視点が変われば虹が見える — この視点の転換が 50% → 101%
- 1%は「見え方の変化」。100%は存在しない。50%から直接101%へ跳ぶ
- 101%の先に何があるかは、体験した人それぞれに委ねる
- CMY = 物質・アナログ / RGB = 精神・デジタル
- 虹 = グレーの内訳が見えた状態

## 🔧 技術スタック
- Three.js 0.160.0
- GLSL シェーダー（MeshPhysicalMaterial / ShaderMaterial）
- Web Audio API
- サーバー: localhost:3000

## 🎯 CMY/RGB球の仕様
- CMY球 = 物質（MeshPhysicalMaterial・水滴質感）
- RGB球 = 精神（ShaderMaterial・内側から発光）
- 球の配置: 正三角形フォーメーション

## 🖥️ Win95 UIルール
- タイトルバー: linear-gradient(to right, #0a246a, #a6b8e8)
- ベベルボーダー必須（立体感）
- フォント: 'MS Sans Serif', Arial, sans-serif
- プログレスバー背景: #000000、フィル: #0000aa

## 🎨 デザインスキル・品質基準

### ビジュアル品質
- 全てのアニメーションはイージングを必ず使う（linear禁止）
- 球のグロー効果は必ずadditive blendingで実装
- 影・反射・屈折は物理ベースで計算する
- ピクセル比は `renderer.setPixelRatio(0.5)` で低解像度レトロ感を維持

### GLSLシェーダー品質基準
- ニュートンリング: r² ∝ nλR の物理式に基づく
- 6波長（赤/橙/黄/緑/青/紫）を必ず含める
- グレー→虹の観測エフェクトを全シェーダーの基本とする
- time uniformで必ずアニメーションさせる

### アニメーション設計
- ATTRACT: ゆっくり引き合う（ease-in）
- EVENT_FUSE: 急激に融合（ease-out cubic）
- DUALITY: 呼吸するような脈動
- WARP_GROW: 加速しながら膨張
- EVENT_COLLAPSE: 急激な収縮→爆発

### カラーシステム
- Cyan: #00FFFF / Magenta: #FF00FF / Yellow: #FFFF00
- Red: #FF0000 / Green: #00FF00 / Blue: #0000FF
- Grey（現実）: #808080
- 背景白: #FFFFFF / 背景黒: #000000
- Win95ブルー: #0000AA / Win95グレー: #C0C0C0

### タイポグラフィ
- 英語UI: 'MS Sans Serif', Arial, sans-serif
- 日本語: システムフォントをフォールバック
- コードフォント: monospace
- BSODテキスト: courier new, monospace

### レスポンシブ・パフォーマンス
- ターゲットFPS: 60fps
- キャンバスサイズはウィンドウに追従
- モバイル対応は現段階では不要

## ⚡ API節約ルール
- 会話が長くなったら /compact を提案する
- 単純作業はHaikuモデルを推奨
- 曖昧な指示は実行前に必ず確認する

## 📋 フェーズ構成
- P0: タイトル画面（初代Macダイアログ）
- P1: Win95ローディング画面（現在開発中）
- P2: コードワールド（量子交換）
- P3: パーティクルユニバース + ECショップ

## 🖥️ P0 仕様（初代Mac — 完成済み）
- 背景: 初代Macintoshのデスクトップ
- System 1風ダイアログ内に6色の球体が正三角形に配置
- ダイアログ外: 光の存在は形のない光（波動状態）
- ダイアログ内: 定義された球体（粒子状態）
- 起動シーケンス（Approach G "Rising → Grey"）:
  - CMY（C→M→Y）が順にAmキーで鳴りながら飛来
  - RGB（R→G→B）が順にAメジャーキーで飛来
  - 6色揃うと結晶化してダイアログ内の軌道を周回
- 完了後 → P1へ遷移

## 🎵 サウンド仕様（P0実装済み・P1以降は未定）
- CMY = Aマイナー（物質・暗い・アナログ）
  - C: A3, M: C4, Y: E4
- RGB = Aメジャー（精神・明るい・デジタル）
  - R: A4, G: C#5, B: E5
- 6色同時 = グレーコード（全色が混ざった和音）
- 音源: Web Audio API のOscillatorNode
- 起動時の音の順序: CMY各音が順に加わり → RGB各音が順に加わり → 全6音でグレーコード

## 🌐 P2 仕様（コードワールド — 完成済み）
- 背景: 黒（コードの世界）
- 浮遊する量子的な 0 と 1 のパーティクル
- 陰陽球（50%）: クリックで外部 inRYOKU URL へ遷移
- RGBCMY球（101%）: クリックで P3 へ遷移
- P2→P3遷移: `inryoku:p2complete` イベント発火

## 📱 モバイル対応ルール（方針決定済み・実装は未着手）
- モバイルユーザーは P0/P1/P2 をスキップして P3 に直行
- UA判定でモバイルを検出 → P3のパーティクルユニバース + ECへリダイレクト
- デスクトップのみ P0→P1→P2→P3 のフルシーケンスを体験

## 🔄 P1フェーズ順序（2026-03 リビルド済み）
ATTRACT → EVENT_FUSE → DUALITY → EVENT_SING → WARP_GROW → CONSUME → DONE
進捗: 0% → 101%（101%で別次元へ）
- 自動進行（HOLD-TO-LOADは廃止済み・復活禁止）
- 各フェーズは AUTO_RATE[phase] でprog/秒を制御

## 🔗 フェーズ間イベント仕様
- P1→P2: `window.dispatchEvent(new CustomEvent('inryoku:p1complete'))`
- P2→P3: `window.dispatchEvent(new CustomEvent('inryoku:p2complete'))`
- 各フェーズは独立した `renderPhase*()` 関数として定義

## 💥 過去のやらかし（同じ失敗を繰り返さない）
- ShaderMaterialのfragmentShaderをruntime書き換え（.needsUpdate）は不安定→禁止
- OrthographicCamera + 複雑なscissor分割レンダーはデバッグが困難→シンプルなPerspectiveCameraを優先
- setInterval内でphase変数を参照すると古い値が残るバグあり→requestAnimationFrameを使う
- HOLD-TO-LOAD(mousedown長押し)はUX上もバグ上も問題多発→廃止済み
- 大規模リファクタリングを1コミットでまとめると、壊れた時に戻せない→1フェーズ1コミット厳守
- P1が壊れたらまず `git log --oneline` で最後の安定コミットを探す→闇雲に修正しない

## 📏 コミット粒度ルール
- 1フェーズの実装 = 1コミット
- 動作確認なしのコミット禁止
- コミット前に必ず `node --check ファイル名` で構文確認
- コミットメッセージ: `P1 ATTRACT phase: [内容の要約]`
