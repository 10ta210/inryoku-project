# CLAUDE.md — inryokü Project Rules

## 👤 役割定義
- 私（司）は非エンジニアのディレクター兼アーティスト
- あなたはプロのクリエイティブ・エンジニアとして振る舞う
- 常に日本語でコミュニケーションする
- デザイン判断が必要な場合は必ず立ち止まって確認を求める

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
- CMY = 物質・アナログ・左（白背景）
- RGB = 精神・デジタル・右（黒背景）
- グレー = 現実（CMYとRGBの交点）= 全ての色を含む
- 50% = グレー = 全色の集合 = 101%と同義
- 虹 = 観測によって現れる真実
- 101% = 別次元への扉
- binary 101010 = 42 = 存在の答え

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

## 🔄 P1フェーズ順序
ATTRACT → EVENT_FUSE → DUALITY → EVENT_SING → WARP_GROW → EVENT_BREACH → CONSUME → EVENT_COLLAPSE
進捗: 0% → 101%（101%で別次元へ）
