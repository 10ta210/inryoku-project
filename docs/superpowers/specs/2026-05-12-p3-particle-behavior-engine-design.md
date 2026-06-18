# P3 Particle Behavior Engine — Design Spec
**date:** 2026-05-12
**status:** draft / awaiting review
**origin:** particles.casberry.in 観察 → API 規約のみ採用、ツール本体は埋め込まず

---

## 1. 目的
P3 宇宙の粒子表現を **差し替え可能なビヘイビア関数** に分離し、シーン遷移・AI 接続・将来追加に強くする。  
particles.casberry.in が公開している AI プロンプト規約（`i / count / target / color / time / THREE`）を inryoku 内部 API として採用し、Claude が生成する関数をそのまま読み込める形にする。

## 2. 非目的（YAGNI）
- 外部 SaaS の埋め込み・iframe 連携
- P0/P1/P2 への手入れ（本スペックは P3 限定）
- 既存 hybrid 3 層の破棄（最上層 1 つだけ差替可能化）

## 3. 既存資産（変更しない）
- `cosmos-layer.js` / `cosmos-layer.css` — P3 ベース
- hybrid 3 層粒子 + ノイズ（`?sample=N` 切替）
- 8 星座フラクタル / Light Bridge / Discovery Hover / 公転

## 4. 追加するもの
### 4.1 behavior API（規約）
```js
// behaviors/<name>.js
export const meta = { id: 'string', label: 'string', tags: ['idle'|'discovery'|'speaking'|'contact'] };

// 粒子1個分を毎フレーム更新。GCゼロ・WRITE only。
export function step(i, count, target, color, time, THREE) {
  // target.set(x, y, z)
  // color.setHSL(h, s, l)  または color.set(...)
}
```

制約（particles.casberry.in 由来 + inryoku 補強）：
- `new THREE.Vector3()` / `new THREE.Color()` をループ内禁止
- 配列・オブジェクト確保禁止
- 分岐より `Math.sin / cos / abs / min / max` 優先
- `NaN / Infinity / undefined` 禁止（ゼロ除算ガード必須）
- inryoku 追加: **白黒禁則**（grey 内包・色は RGBCMY のみ）

### 4.2 ローダ
- `behaviors/index.js` で全 behavior を静的 import → `Map<id, {meta, step}>`
- `cosmos-layer.js` に `setBehavior(id)` を追加
- ホットスワップ：tick 中切替は次フレームから適用、過去フレーム破棄

### 4.3 シーン状態 → behavior 割当
| state | trigger | behavior |
|---|---|---|
| idle | 既定 | `breathing_sphere`（既存挙動の API 移植） |
| discovery | マウス近接 | `attractor_hover` |
| speaking | `body.inryoku-speaking` | `ring_resonance`（円環言語と同期） |
| contact | CONTACT クリック | `convergence_glyph` |

state → behavior の解決は単一 `resolveBehavior(state)`、`cosmos-layer.js` の既存 reduce-motion ガード後段に挿入。

### 4.4 初期 behavior 5 本（実装範囲）
1. `breathing_sphere` — idle / 既存呼吸を新 API に移植
2. `attractor_hover` — マウス座標へ部分収束・残りは漂流
3. `ring_resonance` — 12 tick 同心円・円環言語 canon と位相同期
4. `convergence_glyph` — INRYOKU 文字を粒子で形成（canvas テクスチャ→密度サンプリング）
5. `light_bridge_accent` — 既存 Light Bridge 走行時に近傍粒子を吸い寄せ

### 4.5 デバッグ
- `?behavior=<id>` URL クエリで強制適用
- `window.__inryokuBehavior` で現在値露出
- prefers-reduced-motion 時は `idle_static`（静止）に強制差替

## 5. ファイル構成
```
inryoku_hp/
  cosmos-layer.js                # +setBehavior, +resolveBehavior
  behaviors/
    index.js                     # 静的 import 集約 + Map
    _api.md                      # AI 用プロンプト規約（このスペックの抜粋）
    breathing_sphere.js
    attractor_hover.js
    ring_resonance.js
    convergence_glyph.js
    light_bridge_accent.js
    idle_static.js               # reduce-motion フォールバック
```

## 6. テスト
- 既存 552 tests 全 PASS 維持
- 追加：
  - behavior ローダ unit test（重複 id 検出 / 必須 export 検証）
  - step() 1 万回呼出で GC 発生ゼロ（performance.memory diff < 閾値）
  - reduce-motion 時 `idle_static` 強制を確認
  - 視覚回帰：各 behavior 1 フレーム決定論レンダ（time=0 固定）→ PNG diff

## 7. 受入条件
- [ ] `?behavior=<id>` で 5 本切替できる
- [ ] state 遷移で自動切替する
- [ ] 60fps 維持（既存ベースライン比 -5fps 以内）
- [ ] reduce-motion で静止
- [ ] 白黒禁則違反なし（lint：`color.set('#fff'|'#000'|'white'|'black')` を grep ガード）
- [ ] 既存 P3 サンプル 10 種（`?sample=N`）が崩れない

## 8. 将来拡張（範囲外・参考）
- AI 接続：円環言語の canon → behavior 自動選択
- behavior をユーザ生成（chat 入力 → Claude → behavior 文字列 → 動的 eval は **不採用**、PR ベースで取り込み）
- P2 陰陽球版 API への横展開

## 9. ロールバック
- `behaviors/` ディレクトリ削除 + `cosmos-layer.js` の差分 revert で完全に戻る
- 既存挙動は `breathing_sphere` 1 本に移植するだけなので、API 採用と同時に旧コードは削除可（ただし 1 リリースは並走を残す）

## 10. リスク
| risk | mitigation |
|---|---|
| behavior 関数のバグで全粒子停止 | try/catch + 直近正常 behavior への自動フォールバック |
| 60fps 割れ | per-behavior プロファイル CI（10s 平均 fps を計測） |
| `new` 違反混入 | lint 規則（`/new THREE\.(Vector3|Color)\(/` を behaviors/ 配下で禁止） |
| 白黒混入 | 上記 lint + 視覚回帰 |
