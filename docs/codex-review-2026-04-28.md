# Codex 実装レビュー（2026-04-28）

レビュー対象:
- `/Users/10ta210/Desktop/inryoku_hp/particle_speech_rings.js`
- `/Users/10ta210/Desktop/inryoku_hp/particle_rings.css`
- `/Users/10ta210/Desktop/inryoku_hp/particle_rings_demo.html`
- `/Users/10ta210/Desktop/inryoku_hp/p3_code_for_claude.js`（init3DLogoSphere 周辺、L433–773）

参照:
- `/Users/10ta210/Desktop/inryoku_hp/docs/handoff-to-codex-2026-04-27.md`
- `/Users/10ta210/Desktop/inryoku_hp/docs/ring-research-2026-04-27.md`

---

## 1. 全体評価: **B+（良作・致命なし・小さな仕上げ残）**

Codex の引き継ぎ実装は、ほとんどの観点で「妥当〜よくできている」。
priority queue / lifecycle / halo tracking / phase ベース uniform 制御は
設計意図が読み取れる形で揃っており、哲学（grey 廃止 / RGBCMY / 50→101 / 観測）も
コードレベルで踏襲されている。

ただし以下は仕上げ/磨き残しがある:
- 致命バグはゼロ。だが small race（preempt → settle 中にロゴ phase が落ちる）と、
  キャッシュバスター不整合（CSS は `?v=7` 化済みなのに HTML 側は `?v=6` のまま）
- `attachToLogo` の MutationObserver と setInterval が短時間二重に走る window あり
  （実害はほぼ無い、リソース的に減点 1）
- `_setSpeakingState` が `setSpeechCanon/clearSpeechCanon` を直接叩く: 引き継ぎ書には
  `inryoku:ringstart/ringend` イベント経由の hook が書かれている（L4671 周辺の関数も
  存在する）。両系統が共存しており、整理の余地

致命がない・哲学一致・lifecycle が誠実、で B+。
ここから A- にするには CSS バージョン揃え + small lifecycle 整理だけ。

---

## 2. ファイル別総評

### 2-1. `particle_speech_rings.js`

**良い**:
- priority queue が「pending は最高優先のみ保持」する形で簡潔（L267–274）
- `_cancelCurrentSpeech` が timer / DOM / 状態 / speaking flag を一貫して落とす（L256–265）
- halo tracking が `resize` / `scroll` / `visualViewport` / `ResizeObserver` の 4 経路で誠実
- `_scheduleHaloSettle(12)` で結晶化開始直後の数フレーム連続で位置補正 → 親レイアウトの
  jitter（P1→P3 切替や WebGL canvas resize）を実用上吸収できている

**気になる**:
- L131–139 の destroy で `delete this.logo.__inryokuParticleSpeechRings` の
  catch fallback が `null` 代入だが、その判定 `=== this` は false になり再 attach 時に
  分岐が読みづらい。実害は小さい（既存 instance 参照を null 化するだけ）
- L444–461 の controller.destroy 内で参照する `observer` / `iv` が外側スコープの
  let/var ではなく**遅延初期化される var**。MutationObserver/iv が後で代入される
  pattern（L470–485）に依存しており、attach 即成功ケース（L463–467）で
  destroy された場合に `iv is not defined` にはならないが（var hoist で undefined）
  `if (iv)` チェックで救えるので OK。設計意図は正しい
- ただし L483 で `connect()` を `MutationObserver` 内**と**外で 2 回呼ぶ可能性。
  最初の `connect()` 成功 → return controller の前に observer.disconnect() している
  ので二重 attach は防いでいる（L475 で disconnect）。妥当

### 2-2. `particle_rings.css`

**良い**:
- カラーを CSS 変数化（`--pr-c-r/g/b/c/m/y`）し RGBCMY を限定列挙
- `vector-effect: non-scaling-stroke` 追加で halo scale や cell サイズ変動時に
  chord の太さが破綻しなくなった
- レジスター別 opacity をクラス分岐で表現（whisper 0.46 / hover 0.72 / click 0.84
  / special 0.9）→ 「囁き＝薄い、宣言＝濃い」哲学が CSS に固着していて良い
- `prefers-reduced-motion` 対応もちゃんと入っている

**気になる**:
- L171 `to: var(--pring-speech-target-opacity, 0.84);` のフォールバックが 0.84、
  L180 whisper だけ 0.48 フォールバック、L200 fadeout のフォールバックが 0.92。
  この 3 つの「フォールバック値」が JS 側 REGISTER_OPACITY（whisper:0.46 / hover:0.72
  / click:0.84 / special:0.9）と微妙にズレている。**実害は無い**（JS 側が必ず
  CSS 変数を上書きするため）が、見た目を CSS だけでテストする時に値が一致しないと
  混乱する。ズレの解消推奨
- L211 の `animation-duration: 0.3s !important` は親 `.pring` のリングブリージングも
  0.3s に縮めている。reduced-motion で 0.3s 周期の細かい揺れになる→
  個人的には `animation: none !important` が安全。reduced-motion ユーザの体験寄り

### 2-3. `particle_rings_demo.html`

**良い**:
- セクション分割（Whisper / Hover / Click / Reply / Threshold）が哲学準拠で読みやすい
- `Replay All` と Size スライダーで「同心配置で並べる」司さんの確認作業を高速化
- `subtitle` を `ParticleRings.KINDS.length + ' canon utterances'` で動的生成し、
  canon 増えても自動追従

**気になる**:
- L7: `particle_rings.css?v=7` ⇄ index/p3_test は `?v=6`。**バージョン不整合**。
  どちらかに揃える（実態は同じファイルなので機能不具合は出ないが、cache 戦略上
  混乱の元）
- L228 `replayAll` が DOM 上の全 ring を順次 crystallize する。`stagger * count`
  時間窓に重なる setTimeout が積まれるので、Size スライダーを高速操作すると
  古い ring 参照に対して crystallize が走り無効。`renderSections` で
  `allRings = []` してから DOM を捨てるため、古い ring は孤児になり setTimeout の
  callback で `ParticleRings.crystallize(ring)` が呼ばれてもエラーにはならない（DOM
  detached でも class 付与だけ動く）。実用上問題なし、**気持ち悪さだけ**

### 2-4. `p3_code_for_claude.js` init3DLogoSphere 周辺（L433–773）

**良い**:
- `LOGO_PHASES` テーブルが哲学を正しくコード化:
  - idle = 灰色寄り（grey 50% を内包する idle、許容）
  - observe = Y（視線）
  - shadow = B（深）
  - emit = C（信号）
  - resonance = M（魂）
  - summon = G（生）
  - revelation = R 寄り橙（熱／50→101 への突破）
  これは色相→哲学のマッピングとしてかなり妥当
- priority + hold で uniform を時間滑らかに lerp（L698–705）→ シェーダー uniform
  の更新タイミングが loop 内 1 箇所に集約されており設計として正しい
- 初期値が控えめ（mix 0.08 / pulse 0.0 / phaseColor 0.72,0.78,0.84）→ 起動時
  チラつきを誘発しないグレー寄り、idle 哲学に合致
- canon→phase の rule table（L606–624）が言語と視覚を明示的に橋渡し

**気になる**:
- `clearSpeechCanon`（L749–753）が `phaseUntil=0; phasePriority=0; settlePhase()` を
  即時実行。一方 hover 中（hoverActive=true）なら `getFallbackPhase()` で `observe`
  に戻る → これは正しい挙動。だが click 中（speech が emit を強制中）の途中で
  clearSpeechCanon が来ると hold を待たず即 fallback に戻るので、
  speech 終端のフェード（CSS 1200ms）と球の色戻り timing がズレる可能性。
  **改善案**: clearSpeechCanon に短い `tail` hold（300ms 程度）を持たせる
- `setHover(false)` 内（L721）で `logoState.phasePriority <= 1 || !logoState.phaseUntil`
  を fallback 条件にしているが、observe phase の priority は **1**。
  境界条件が `<=` なので observe→idle に正しく落ちる。OK
- `applyCanonPhase` の register fallback（L666–667）の数値が CANON_PHASE_RULES と
  少し違う（hover は priority 1 / observe phase の preset priority も 1）。
  問題ないが、preset を直接参照させる方が DRY
- `u_speechPulse` は `target.pulse` への lerp、`logoState.speechBoost` は target.pulse
  と同期。冗長だが副作用なし
- `dispose()` で `window._p3LogoSphere3D = null;` しているが、`particle_speech_rings.js`
  の `_setSpeakingState` 側は `if (global._p3LogoSphere3D)` でガード済み → 連携 OK

---

## 3. 致命バグ

**なし**。

候補として「これ致命では？」と検討した項目:
1. preempt 後 timer leak → `_cancelCurrentSpeech` が `_clearSpeechTimers` を呼ぶ
   ので問題なし
2. cooldown 設定が priority 上書き後に走る → priority 上書き時は cooldown を
   消費するが、preempt 元（hover/click）も同じレジスタなら意図通り。spec か
3. summon/revelation の cooldown 未設定 → 意図的（任意呼び出し API、頻度は
   呼び出し側で制御）
4. ResizeObserver が container.parentElement を observe（L186–188）→
   parent が後から消える可能性は低いが destroy で disconnect しているので OK

---

## 4. 改善推奨（diff 案）

### 4-1. CSS バージョン揃え（必須）
`particle_rings_demo.html` L7 と index/p3_test の整合:
```diff
- <link rel="stylesheet" href="particle_rings.css?v=7" />
+ <link rel="stylesheet" href="particle_rings.css?v=8" />
```
そして `index.html` / `p3_test.html` も `?v=8` に bump。

### 4-2. CSS フォールバック値を JS と一致
`particle_rings.css` L171–202:
```diff
@keyframes pring-speech-fadein {
  from { opacity: 0; }
- to   { opacity: var(--pring-speech-target-opacity, 0.84); }
+ to   { opacity: var(--pring-speech-target-opacity, 0.72); }  /* hover デフォルト想定 */
}
@keyframes pring-speech-fadein-whisper {
  from { opacity: 0; }
- to   { opacity: var(--pring-speech-target-opacity, 0.48); }
+ to   { opacity: var(--pring-speech-target-opacity, 0.46); }  /* JS REGISTER_OPACITY と同値 */
}
@keyframes pring-speech-fadeout {
- from { opacity: var(--pring-speech-current-opacity, 0.92); }
+ from { opacity: var(--pring-speech-current-opacity, 0.84); }
}
```

### 4-3. reduced-motion で animation 完全停止
`particle_rings.css` L205–214:
```diff
@media (prefers-reduced-motion: reduce) {
  .pring,
  .pring--crystallizing .pring__path-dot,
  .pring--crystallizing .pring__chord,
  .pring--crystallizing .pring__tick,
  .pring--crystallizing .pring__inner-dot {
-   animation-duration: 0.3s !important;
-   animation-delay: 0ms !important;
+   animation: none !important;
+   opacity: 1 !important;
  }
}
```
理由: 0.3s 周期だと「弱い揺れが残る」状態。reduced-motion ユーザは静止を望む。

### 4-4. clearSpeechCanon に tail hold
`p3_code_for_claude.js` L749–753:
```diff
clearSpeechCanon: function(){
-    logoState.phaseUntil = 0;
-    logoState.phasePriority = 0;
-    settlePhase();
+    // 発話のフェードアウト（CSS fadeMs=1200ms）に視覚を寄せる
+    var tail = currentTimeMs() + 360;
+    if (logoState.phaseUntil > tail) return;  // 高優先度の他 phase が走っていれば尊重
+    logoState.phaseUntil = tail;
+    logoState.phasePriority = 1;
},
```
これで「リングが消えた瞬間に球の色が即グレーに戻る」軽い違和感を消せる。

### 4-5. _setSpeakingState の二重通知整理
`particle_speech_rings.js` L290–309:
直接 `_p3LogoSphere3D.setSpeechCanon` を叩く path と、`inryoku:ringstart` イベントを
`p3_code_for_claude.js` L4671 周辺で受ける path が**両方ある**。
イベントベース 1 本に絞るのが疎結合的に正しい:
```diff
ParticleSpeechRings.prototype._setSpeakingState = function (active, register, canonName) {
  var body = document.body;
  if (body) body.classList.toggle('inryoku-speaking', !!active);
- if (global._p3LogoSphere3D) {
-   try {
-     if (active && typeof global._p3LogoSphere3D.setSpeechCanon === 'function') {
-       global._p3LogoSphere3D.setSpeechCanon(canonName, register);
-     } else if (!active && typeof global._p3LogoSphere3D.clearSpeechCanon === 'function') {
-       global._p3LogoSphere3D.clearSpeechCanon();
-     }
-   } catch (err) {
-     console.warn('[ParticleSpeechRings] logo sync failed:', err);
-   }
- }
  try {
    global.dispatchEvent(new CustomEvent(active ? 'inryoku:ringstart' : 'inryoku:ringend', {
      detail: { register: register, canon: canonName }
    }));
  } catch (err) {}
};
```
そして `p3_code_for_claude.js` L4671–4680 の listener が一本化された情報源を読む。
**注意**: 引き継ぎ書（handoff の 9 章）に「Codex 実装途中」とあるので、もし片方が
実験中なら**統合は司さん確認が要**。

### 4-6. attachToLogo の二重発見ガード強化
`particle_speech_rings.js` L470–493:
```diff
if (typeof MutationObserver === 'function') {
  observer = new MutationObserver(connect);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (connect()) return controller;
}
- iv = setInterval(function () {
+ // MutationObserver があれば setInterval は要らない（モバイル省電力）
+ if (typeof MutationObserver === 'function') return controller;
+ iv = setInterval(function () {
   if (connect()) return;
   if (++tries > 200) {
     clearInterval(iv);
     if (observer) observer.disconnect();
     ...
```

### 4-7. demo の race 解消（軽微）
`particle_rings_demo.html` L228–233:
```diff
function replayAll(stagger) {
  stagger = stagger == null ? 55 : stagger;
+ var snapshot = allRings.slice();
- allRings.forEach(function (ring, index) {
+ snapshot.forEach(function (ring, index) {
    setTimeout(function () {
+     if (!ring.isConnected) return;
      ParticleRings.crystallize(ring);
    }, index * stagger);
  });
}
```

---

## 5. ベタ褒めポイント

1. **`_scheduleHaloSettle(frames)` の発想**: 結晶化開始直後の N フレーム連続で
   位置補正というのは、layout shift 起因の位置ズレに対する**実用的な銀の弾**。
   理屈っぽい解（mutationObserver で全候補を観察）に逃げず、「この 200ms だけ気にすればいい」
   と現実を割り切った設計でグッド。

2. **priority queue が一切 race しない pattern**:
   `_pendingSpeech` は単スロットで **「最高優先のみ保持・他は黙って捨てる」**。
   これが starvation を防ぎ、deadlock 余地もない。複雑な queue を作らず単スロットに
   割り切ったのは正解。

3. **CANON_PHASE_RULES（p3 L606–624）**:
   発話 canon と球の phase を明示的に橋渡しするテーブルがあるのは哲学的にも実装的にも
   美しい。「言語層」と「視覚層」が**辞書一枚**で繋がる。司さんが将来 canon を増やす時、
   ここに 1 行足すだけで連動する→拡張性 ◎。

4. **`vector-effect: non-scaling-stroke` の追加**:
   halo scale や demo のサイズスライダーで chord の見た目が破綻しない。地味に効く。

5. **revelation phase の色 (1.00, 0.45, 0.15)**:
   R 寄りの橙＝「熱」＋「視線」の境界色。50→101 の哲学に対して chosen color が誠実。
   I like it.

6. **idle phase の (0.72, 0.78, 0.84)**:
   完全な無彩色グレーではなく、ほんの少し青寄りの灰色。grey は禁則だが「内包」されて
   いるという哲学に整合。「白でも黒でも純灰でもない」絶妙な値。

---

## 6. 哲学／ブランド整合性チェック

| 項目 | 整合 | コメント |
|---|---|---|
| grey 既定→廃止 | ✅ | RGBCMY のみ CSS 変数化、白/黒の単独色は出ない |
| RGBCMY 限定 | ✅ | `--pr-c-r/g/b/c/m/y` のみ。無彩色は path-dot/inner-dot/tick の透明度経由のみ |
| 50→101 観測哲学 | ✅ | revelation canon を独立 phase 化、色も赤橙で「突破」を示唆 |
| grey idle 内包 | ⚠️ 微妙 | idle phaseColor が (0.72,0.78,0.84) で**実質淡灰**。哲学的には「内包」だが、CSS のラベル上は grey っぽく見える。意図的なら OK、要なら少し色を寄せる選択肢あり |
| Heptapod 全体性 | ✅ | crystallize で「全 tick が一気に決まる」体験を保持。stagger 30ms で「同時に見える」感 |
| caveman talk 的シンプルさ | ✅ | API 表面（`utterNow / summon / revelation / speakCanon`）が短い |
| フルネーム禁則 | ✅ | コード上に司さん本名は出てこない |
| 旧モジュール残置（削除厳禁） | ✅ | `particle_glyphs.*` / `particle_whisper.js` 触らずに残っている |
| 既存フェーズ非破壊 | ✅ | P0/P1/P2 のコードに手は入っていない |

総合: **A 寄りの整合**。idle 色の微調整余地はあるが、それは哲学解釈の問題。

---

## 結論

Codex の今回の作業は **commit して問題ない品質**。
致命バグなし、哲学整合あり、lifecycle 誠実、priority queue race なし。

司さんが今すぐやるとしたら:
1. CSS バージョン揃え（v=8 に bump）— 必須
2. CSS フォールバック値を JS と揃える — 必須に近い（値の真実が二箇所にあるのを統一）
3. clearSpeechCanon の tail hold — 体験品質
4. _setSpeakingState の通知一本化 — 設計綺麗

残りは「気が向いたら」レベル。Codex GJ。
