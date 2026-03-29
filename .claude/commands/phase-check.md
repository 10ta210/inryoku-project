# /phase-check — P1フェーズ実装前チェックリスト

新しいフェーズを実装する前に、このチェックリストを確認してください。

## 実装前チェック

以下を順番に確認してください：

1. **前フェーズのコミット確認**
   - `git log --oneline -5` で直前のコミットが存在するか確認
   - 前フェーズが動作確認済みか確認

2. **現在のphase変数の確認**
   - `p1_code_for_claude.js` の `PH` オブジェクトを確認
   - 追加するフェーズ名が既存と重複していないか確認

3. **フェーズ種別の確認**
   - **連続フェーズ**（進捗が自動で進む）: `AUTO_RATE[PH.XXXXX] = 数値` を設定する
   - **イベントフェーズ**（時間固定）: `eventTimer += dt` パターンを使う

4. **Three.jsオブジェクトの確認**
   - 前フェーズで作ったオブジェクトは `visible = false` にしているか
   - 新しいオブジェクトは `scene.add()` 済みか

5. **シェーダー確認**
   - uniform名のタイポがないか
   - `AdditiveBlending` が必要な発光オブジェクトに設定されているか
   - `renderer.setPixelRatio(0.5)` は変えていないか

6. **接続確認**
   - フェーズの最後に `phase = PH.次のフェーズ;` が書かれているか
   - 最終フェーズは `window.dispatchEvent(new CustomEvent('inryoku:p1complete'))` を発火するか

## 実装後チェック

- [ ] `node --check p1_code_for_claude.js` でエラーなし
- [ ] ブラウザでリロードして動作確認（http://localhost:3000/p1_index_for_claude.html）
- [ ] コンソールにエラーなし
- [ ] `git add p1_code_for_claude.js && git commit -m "P1 [フェーズ名]: [内容]"`

## よくあるバグパターン

```
❌ setInterval内でphase参照 → rAFのtick()内で行う
❌ fragmentShaderをruntime書き換え → uniformで制御
❌ HOLD-TO-LOAD復活 → AUTO_RATEパターンのみ
❌ まとめてコミット → 1フェーズ1コミット
```
