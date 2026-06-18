# inRYOKU 裏ルート — Design Spec
**date:** 2026-05-12
**status:** draft / implementation landed
**path:** `/inryoku/`
**counterpart of:** `inryokü` (outward / artistic surface)

---

## 1. 目的（一文で）
**外向きの inryokü（観測されるもの）に対する、内向きの inRYOKU（観測する者）の場を作る。**
販売しない。説明しない。連絡先を持たない。粒子場の中に第一人称で居て、言葉が浮かぶ。それだけ。

vision.md の「見えないものの可視化で哲学者を増やす」を、最も裸の形で実装する面である。
inryokü で「見えないもの」を売る側に立った訪問者を、ここでは「見る側」に静かに引き戻す。

## 2. 美学原理（破ったら設計違反）
- **第一人称**：カメラは粒子球の内側。観測者は世界の外にいない。
- **内向き**：nav なし、言語切替なし、contact なし、commerce なし、social なし、footer なし、フルネームなし。
- **遅い時間**：phrase fade ~10.5s/cycle、LFO 0.06Hz、autoDrift 0.07Hz。inryokü の「波」より一段遅い。
- **白黒禁則**：背景は黒だが文字色は RGBCMY のみ（canon → 色マップ）。白文字・グレー文字を出さない。
- **常時 audio**：drone は前景にいる間ずっと鳴る。ミュートトグルは唯一の UI。
- **JP のみ**：内向き = 母語。i18n に意図的に乗せない。
- **計測しない**：URL パス `/inryoku/` で analytics を切る（caller 側 + meta noindex/nofollow/no-referrer）。

## 3. ゲート — 入る二経路
`inryoku-gate.js` が単一窓口。

### 3.1 表ルート（front door） — P2 password
- P2（量子コードワールド、陰陽球 50%）でユーザが合言葉を入力すると `localStorage.__inryokuP2Password` に保存される。
- `hasP2Password()` がそれを検証。

### 3.2 裏ルート（back door） — P3 6色合体
- P3 で `logo-speech.js` が **revelation canon** を発火するたび、現在の logo phase 色（R/G/B/C/M/Y のうち 1 つ）が観測される。
- 6 色すべてが threshold 0.95 を超えた時点で `localStorage.__inryokuSixColorState` が満たされる。
- `hasSixColorMerge()` が検証。
- 満たされると `phase-transitions/p3-to-inryoku.js` の portal アニメが起動し、`/inryoku/` へ遷移。

### 3.3 ゲート失敗時
`enforceGate()` は `sessionStorage.__inryokuGateMsg` に短いメッセージを置いて `/p3_test.html` へ `location.replace`。
失敗を「拒否」ではなく「まだ開いていない」として扱う。

## 4. Phrase Taxonomy — phrases.json
**この面の魂**。30 本。

| category | count | 役割 |
|---|---|---|
| `question` | 10 | 問いかけ。観測者を観測対象にする。 |
| `assertion` | 10 | 言い切り。哲学のコア。 |
| `instruction` | 5 | 微弱な指示。命令ではなく招き。 |
| `silence` | 5 | 句読点・空白・○。間そのもの。 |

各 phrase は **canon タグ**を持ち、`logo-speech.js` の 17 canon と整合：silence / core / ma / shadow / emit / observation / self_question / declaration / leap / resonance / consensus / past_speculation / future_command / echo / quotation / summon / revelation。

色は `canonColorMap` で canon → RGBCMY 6 色のいずれかに解決。例：`silence: Y`, `shadow: B`, `revelation: G`, `declaration: R`。

**重み**：`weight` 基本値 × `(1 + log(1+obsCount[canon])*0.6)`。観測履歴が偏るほど、その canon の phrase が出やすくなる（鏡像強化）。

直近 4 件は除外して反復を避ける。同時表示は最大 2 件。

## 5. Revelation × 6 色の蓄積（wave 4 で配線すること）

`logo-speech.js` の `subscribers` (`onSpeak`) は `{ canon, register, phase, ... }` を渡す。
`register === 'revelation'` のとき、`phase` が現在の RGB phase index (0..5) を示す。

裏ルートを生かすために必要な配線：

```js
// 例：P3 boot 内 / cosmos-integration.js に追加
import { recordColorObservation } from '/inryoku/inryoku-gate.js';
const SIX = ['r','g','b','c','m','y']; // PHASE_ORDER と対応
speech.onSpeak((evt) => {
  if (evt.register === 'revelation') {
    const key = SIX[evt.phase % 6];
    recordColorObservation(key, 1.0);
  }
});

// 6色揃ったら p3-to-inryoku を起動
import gateMod from '/inryoku/inryoku-gate.js';
if (gateMod.hasSixColorMerge()) {
  phaseBus.transition('inRYOKU', { transitionModule: p3ToInryoku, ... });
}
```

これにより：
- 観測が偶発（hover/click/whisper 由来の自然発話）でも、revelation のときだけ加点される
- 6 色合体は「全部見せようとした人」だけが到達する
- 表ルート（password）は依然として有効

## 6. Modules

| file | role |
|---|---|
| `inryoku/index.html` | エントリ。ゲート → world → phrase engine → audio をブート |
| `inryoku/phrases.json` | 30 phrase + canon→color マップ |
| `inryoku/inryoku-gate.js` | `canEnterInryoku`/`enforceGate`/`recordColorObservation` |
| `inryoku/inryoku-world.js` | Three.js r160、FOV 75、camera at origin、shell 粒子 50k(/24k/9k) |
| `inryoku/inryoku-phrase-engine.js` | weighted pick、3D 投影、3s fade-in / 5s hold / 2.5s fade-out |
| `inryoku/inryoku-audio.js` | drone：2 saw ±5cent A1 + sub A0 + LFO LPF |
| `inryoku/inryoku.css` | 黒地、視線リング、ミュートトグル、phrase 字組 |

## 7. アクセシビリティ
- **phrase の代替テキスト**：DOM 上の phrase 要素は `aria-hidden`（粒子と同じ装飾扱い）だが、別途 `.inryoku-aria-live`（aria-live=polite, atomic）に同じ文字列を出して screen reader に届ける。silence カテゴリは読み上げない（記号のみのため）。
- **reduce-motion**：粒子ドリフト停止、autoDrift 停止、phrase は世界座標ではなく画面固定位置にフェード。視線リングを非表示にしマウスカーソルを復活。
- **キーボード**：ESC で `/p3_test.html` に戻る。ミュートトグルは tab で到達でき focus-visible で Y 色に変わる。
- **タップ目標**：ミュートトグル 36px（44px 推奨に対し縮小だが、唯一の UI のため意図的な小ささ）。

## 8. なぜ「商業がない」と明示せずに済むのか
- ボタンがない（commerce 動詞が存在し得ない）
- nav がない（カートに「行く」場所がない）
- 価格表示・商品画像・cta 配色が一切ない
- background は真黒（inryokü の grey と対比される sacred な色）
- 「言葉が浮かぶ」以外のインタラクションが「視線」「長押し（暗黙の同意）」のみ

訪問者は **「ここでは何かを売られない」を、欠如によって体感する**。これは vision.md の「服は手段」を最も率直に表現する設計判断。

## 9. 観測 (+1% UI なし)
長押し 850ms = 「観測の同意」。視線リングが Y に膨らみ、`localStorage.__inryokuPercent` を +1（上限 100.99）。
**カウンターは表示しない**。これは inryokü 側の +1% 演出を裏返した設計：inryokü では数字が見えて達成感を駆動する。inRYOKU では数字を見せないことで「観測は他者に見せるものではない」と暗示する。

## 10. 哲学的正当化（vision.md からの一対一）

| vision の言明 | inRYOKU の実装 |
|---|---|
| 「見えないものを可視化する装置」 | 粒子場の中の自分の視線（普段見えない）に気づく構造 |
| 「木を見て森が見える」 | 粒子 1 個 = 木、shell 全体 = 森。中にいるから両方ある |
| 「哲学者を増やす」 | phrase が "問い" を 1/3 占める。答えを与えず、問いを与える |
| 「服は出口の一つ。メインではない」 | この面に出口がない（commerce 不在）。本質だけが残る |
| 「視点を変えるレンズ」 | mouse drag = literally "gaze 変更"。観測角度＝世界の見え方 |

## 11. 残課題 / wave 4
- [ ] `logo-speech.js` の `onSpeak` に `recordColorObservation` 配線（§5）
- [ ] `p3-to-inryoku.js` 起動の `phaseBus.transition('inRYOKU', ...)` 呼び出しを cosmos-integration.js に追加
- [ ] reduce-motion の phrase 位置を「視線方向に固定」（現状は完全ランダム配置）— 改善余地
- [ ] phrases.json を 30 → 50 に拡張（季節 phrase / 時間帯 phrase）
- [ ] sessionStorage.__inryokuGateMsg を P3 側で読み取り、短時間表示する UI
- [ ] CSP：`/inryoku/` で unpkg.com の script-src 許可（または vendor/three にローカル化）
