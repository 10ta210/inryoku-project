# 円環粒子言語 — 関連リサーチ（2026-04-27）

## 1. Heptapod 風円環表現の参考事例

### 映画 Arrival（2016）
- ロゴグラム = 1 円環 = 1 文 / 始まりも終わりもない（時間の非線形）
- 黒インクの墨跡。粒子表現ではないが構造の参考
- **応用**: inryokü 円環は「インクの粒子化」と捉えると整合する。墨が拡散する瞬間を結晶化アニメに置き換え

### Fonts of the alien tongues（generative）
- ProcedurAlien Glyph Generator, Genesis Alphabet 等のジェネレーティブツール
- 共通点: 円環 + 短い枝 / 内側に向かう湾曲線
- **採用済み要素**: 弦（chord）、対称破れ、内側膨らみ弧

### 中国の篆書・象形文字
- 円環内に意味要素を配置する伝統
- 印章は閉じた円環の中に複数記号を組み合わせる
- **応用**: doubleRing（同心円）= 引用、はこの伝統の継承

## 2. SVG 円環アニメーションの実装パターン

### A. stroke-dasharray ベースの線描画
- 利点: 高速、CSS のみ、計算コスト最小
- 欠点: dashed 線との衝突、複雑な path で計算ミスしやすい
- **採用済み**: chord の draw アニメ

### B. SMIL / values アニメーション
- 利点: SVG 内で完結、複雑な属性アニメ可能
- 欠点: deprecated 気味、Safari 一部 bug
- **不採用**: CSS で十分

### C. requestAnimationFrame + JS 直書き
- 利点: 最大の自由度、粒子物理を再現可能
- 欠点: 重い、CPU 食う
- **将来検討**: 結晶化アニメをよりリッチにするなら（粒子が螺旋を描いて集まる等）

### D. Web Animations API
- 利点: JS 制御 + CSS パフォーマンス
- 欠点: 一部古いブラウザ非対応
- **検討候補**: 円環の breathing をきめ細かく制御するなら

## 3. 視認性のベストプラクティス（暗背景 + 多色）

### 問題
P3 は星空背景に多色粒子が無数 → 円環の dot/line が埋もれる

### 対策候補
1. **drop-shadow glow を強化**（採用済み・blur 8px〜）
2. **outer halo**: 円環全体に薄い暗い oval を背景に置いて分離
3. **isolation: isolate + mix-blend-mode**: 背景色を反転して常に視認可能に
4. **アクティブ時に背景パーティクルを軽く dim する**: ring 出現中だけ P3 universe の opacity を 0.6 倍にする
5. **円環自体に光のオーラ層を追加**: SVG `<filter>` で gaussian blur copy を重ねる

### おすすめ
**4 + 5 の組み合わせ**: 発話中だけ P3 dim + 円環自身が halo 持つ → 主従関係が明確

実装イメージ:
```js
// utterance 開始時
document.querySelector('.phase-3').classList.add('phase-3--speaking');
// 終了時
document.querySelector('.phase-3').classList.remove('phase-3--speaking');
```
```css
.phase-3--speaking #three-canvas { opacity: 0.55; transition: opacity 600ms ease; }
.phase-3 #three-canvas { transition: opacity 800ms ease; }
```

## 4. 円環の「読み」を学習可能にする UX

### 提案
- 初回ユーザー: 何が起きてるか分からない
- 慣れたユーザー: 円環の構造から発話の趣旨を読み取れる
- 中間: 円環をホバーすると小さな注釈ツールチップ（"観測の問いかけ"）

実装案:
- 円環 svg に `data-canon` 属性を付与
- ツールチップ: 円環ホバー時に小さく漢字 + romaji 表示
- インタラクション学習が進むと自然に意味が掴める

## 5. パフォーマンス試算

| 要素数 | 1 円環 | 同時表示数 | 想定 FPS |
|---|---|---|---|
| dot | 12 path-dot + 4 cluster + 1〜12 tick | 1（同時禁止） | 60+ |
| chord | 0〜3 line/path | 1 | 60+ |
| アニメ | breathing 7s + crystallize 1.9s | 1 | 60+ |

→ **負荷ほぼ無視可能**。P3 universe の方が圧倒的に重い。

## 6. AI 応答 → 円環マッピングの軽量ルール（草案）

Codex がこのタスクを進めてるので、僕の側からは方針だけ:

### 抽出すべき特徴
- **intent**: 質問 / 宣言 / 命令 / 仮定
- **mood**: 観察 / 跳躍 / 共鳴 / 余韻 / 沈黙 / 影
- **certainty**: 直接 / 伝聞 / 推論
- **direction**: 自分 / 聞き手 / 世界 / 過去

### マッピング例

| intent + mood | canon |
|---|---|
| 質問 + 観察 | `self_question` |
| 宣言 + 観察 | `observation` |
| 宣言 + 平叙 | `declaration` |
| 提案 + 跳躍 | `leap` / `revelation` |
| 同意 + 共鳴 | `resonance` / `consensus` |
| 仮定 + 過去 | `past_speculation` |
| 命令 + 未来 | `future_command` |
| 余韻 / 含み | `echo` |
| 不明 / 拒否 | `shadow` |
| 引用 | `quotation` |
| 沈黙 | `silence` |

### 実装方針候補

**A. キーワードルール** — 軽量、説明可能
```js
function classifyResponse(text) {
  if (/[?？]$/.test(text)) return 'self_question';
  if (/^(はい|そうです|確か)/.test(text)) return 'consensus';
  if (/(かもしれ|思います|でしょう)/.test(text)) return 'past_speculation';
  if (/^(まず|次に|やってみて)/.test(text)) return 'future_command';
  return 'declaration';
}
```

**B. 軽量 ML / embedding 距離** — 重め、要 API
- 各 canon に prototype 文を持たせる
- 応答を embedding 化 → 最近傍を選ぶ
- Anthropic API の small model 等で実現可能

**C. AI が canon を直接出力** — 最もエレガント
- システムプロンプトで「答えは <canon>name</canon><text>...</text> で返せ」
- AI 自身が分類結果を返す
- 精度高い、ただし AI 側の協力前提

**推奨**: A から始めて、B/C は後で

## 関連メモリ

- `project_inryoku.md` — フェーズ状態
- `feedback_no_delete_phases.md` — P0-P3 削除厳禁
