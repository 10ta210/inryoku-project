# UI改良プロンプト (codex との10ラウンド議論で決定した方針)

## 使う場面
P3 ECショップのUI改善をやる時。

## コピペ用

```
P3 EC ショップのUI改善、優先度順に実装。

## 方針（codex と 10ラウンド議論で確定）

### 1. フォーカスモード扇展開 (設計先行)
- idle状態: 12枚円周リング
- focus状態: 前面180°に扇状展開
   - 中央カード: scale 1.0, 正面向き
   - 隣接±1: scale 0.85, 15°回転, x±200
   - 隣接±2: scale 0.7, 30°回転, opacity 0.8
- 3秒無操作 → idleへ
- easing: cubic-bezier(0.22, 1, 0.36, 1) 600ms

### 2. カード全体クリック → Stripe Checkout直行
- focus状態の中央カード → クリックで即購入
- idle/隣接カード → クリックで focus へ
- 誤爆防止 + 儀式性

### 3. OSテーマ×カードスキン連動
SKIN_MAP = {
  cosmos:  'glass',
  macos:   'mac-system1',
  win95:   'win95-bevel'
}
トグル1つだけにする（カードスキンは従属）。

### 4. 残りMacスキン → イースターエッグ
- Konami code → mac-os9 解放 "// observer detected: layer 1"
- 50%長押し10秒 → mac-imacg3 "// you saw the grey: layer 2"
- 全球体クリック or 3:33深夜 → mac-apple2 "// 101%: the origin"
- localStorage で永続化
- 未解放は設定メニューに ??? 表示

## 哲学的フレーム
- 骨格1つ・スキン4種（統一感）
- 発見によって世界が増える（観察者の101%）
- 儀式としての購入
```
