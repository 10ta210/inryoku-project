# inryokü P1 — Rive 作成ガイド

素材ファイル (同じディレクトリ): 01〜08 の SVG を Rive にインポートして組み立てる。

## 全体タイムライン (総尺 16.8 秒)

| # | フェーズ | 秒 | 素材 | やること |
|---|---|---|---|---|
| 1 | SEPARATION | 0.0–2.2 | `01_scene_dual_panel.svg` | 左白/CMY3球 + 右黒/RGB3球、静止 |
| 2 | FUSE | 2.2–5.4 | 01 + `02_black_sphere.svg`, `03_white_sphere.svg` | CMY3球→中央(左)で黒球へ opacity fade / RGB3球→中央(右)で白球へ |
| 3 | MERGE | 5.4–7.2 | 02, 03, `04_grey_sphere.svg` | 黒・白が中央へスライド → 衝突 → グレー球出現、パネル2枚もグレーへ混色 |
| 4 | TUNNEL | 7.2–11.4 | 04 + `05_rainbow_tunnel.svg` | グレー球を小さくしつつ奥へ、虹リング拡大、中央光点 |
| 5 | EYE_CLOSED | 11.4–12.8 | `06_eye_closed.svg` | 白光halo + 閉じた目 fade in |
| 6 | EYE_OPEN | 12.8–14.6 | 06 → `07_eye_open.svg` | 上下のまぶたが開いて黒目が見える |
| 7 | CROSS | 14.6–16.8 | 07 + `08_cross_light.svg` | 虹彩/瞳孔が光り、十字架の光が画面を覆う |
| 8 | EXIT | 16.8 | 08 | ホワイトアウト → フェードアウト → P2 へ |

---

## Rive 作成手順

### 1. 新規 Artboard
- サイズ: 1080 × 1080 (or 720×720)
- 背景: `#808085` (グレー50%)

### 2. 素材インポート
Rive エディタ左上「Assets」→ 「+」→ `01_scene_dual_panel.svg` など**順にドラッグ＆ドロップ**。
SVG は自動的に編集可能な Path として展開される。

### 3. 各フェーズを Timeline に配置

#### Timeline 1: `ATTRACT_SEPARATION`
- 01_scene_dual_panel の CMY/RGB 6球を Position keyframe で**三角形フォーメーション**に配置
- 0-2.2s: 静止 (opacity 1)

#### Timeline 2: `FUSE`
- CMY 3球 の Position を中央 (左パネル中心) へ移動 (2.2→4.2s)
- CMY 3球 の Opacity 1 → 0 (3.8→4.4s)
- 02_black_sphere の Opacity 0 → 1 (3.5→4.2s) 中央に表示
- 同時にRGB側 同じく

#### Timeline 3: `MERGE`
- 02_black_sphere の X 座標: (左中央) → (画面中央より少し左)
- 03_white_sphere の X 座標: (右中央) → (画面中央より少し右)
- Rotation 静止 (変形なし)
- 衝突瞬間 (6.5s) に白フラッシュ overlay (opacity 0.8 → 0)
- 04_grey_sphere 出現 (6.6→7.2s opacity 0→1)

#### Timeline 4: `TUNNEL`
- 04_grey_sphere: Scale 1 → 0.3 (中央で縮む), Opacity 1 → 0 (7.2→11.0s)
- 05_rainbow_tunnel: Scale 0.1 → 1.5 (7.2→11.4s), 回転を Rive 標準 Rotation で緩やかに (0 → 30deg)
- 中央光点 pulsing

#### Timeline 5: `EYE_CLOSED` (11.4→12.8s)
- 06_eye_closed を fade in
- まぶたを State Machine で「閉じ」状態にしておく

#### Timeline 6: `EYE_OPEN` (12.8→14.6s)
- 06 → 07 へ cross-fade
- 07_eye_open のまぶた (上下アーチ) を Keyframe で開く: Scale Y 0 → 1

#### Timeline 7: `CROSS` (14.6→16.8s)
- 07_eye_open の 瞳孔 Opacity フェードアウト
- 08_cross_light を overlay、opacity 0 → 1
- 中央 bloom を scale 0 → 3 で拡大

#### Timeline 8: `EXIT` (16.8s〜)
- 全体 Opacity 1 → 0 (ホワイトアウト)
- あるいは 背景を白 → 黒へ遷移

### 4. State Machine で自動再生
1. State Machine を追加
2. Entry → SEPARATION → FUSE → MERGE → TUNNEL → EYE_CLOSED → EYE_OPEN → CROSS → EXIT を `Duration Transition` で繋ぐ
3. EXIT の onComplete で `p1_complete` トリガーを発火
4. ループしないなら EXIT 以降は静止状態

### 5. Export
- File → Export → `p1_observer.riv`
- Web 版の場合 `@rive-app/canvas` ランタイムで HTML に埋め込む

---

## Web 埋め込み例 (参考)

```html
<canvas id="p1-riv" width="720" height="720"></canvas>
<script src="https://unpkg.com/@rive-app/canvas@2"></script>
<script>
  const r = new rive.Rive({
    src: '/p1_observer.riv',
    canvas: document.getElementById('p1-riv'),
    autoplay: true,
    stateMachines: 'main',
    onLoad: () => r.resizeDrawingSurfaceToCanvas(),
  });
  r.on('StateChange', ({data}) => {
    if (data.includes('EXIT')) {
      window.dispatchEvent(new CustomEvent('inryoku:p1complete'));
    }
  });
</script>
```

## Tips

- **Position Constraint**: Rive の機能で、球が中央に引き寄せられる動きは "Translation Constraint" を使うと楽
- **Alpha Constraint**: フェードは Constraint で繋げておくと State Machine で制御しやすい
- **パネルの色変化**: MERGE 段階で左白→グレー、右黒→グレーは Color Animate で
- **タイミング調整**: SVG は静的画像なので、動きは全て Rive 内の Keyframe で作る

## 困ったら
Rive チュートリアル: https://rive.app/learn
フォーラム: https://community.rive.app

---

このガイドの素材 8 ファイルを Rive に放り込んで、各 Timeline をガイド通りに作れば完成する。
Timeline ごとに作業すると最短 1-2 時間で完成するはず。
