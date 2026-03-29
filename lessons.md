# inryokü — Lessons Learned

> Claudeが間違えるたびにここに記録する。同じ失敗を二度しないために。
> 追記方法: 「このルールをlessons.mdに書いて」と指示する。

---

## 2026-03 P1リビルド時の教訓

### L001: HOLD-TO-LOAD は廃止
- **何が起きた**: setIntervalとmousedownの組み合わせで競合バグ多発。UX的にも不自然。
- **ルール**: ローディングは常に自動進行。`AUTO_RATE[phase]` パターンを使う。
- **正しいパターン**:
  ```javascript
  const AUTO_RATE = { [PH.ATTRACT]: 5.0, [PH.DUALITY]: 5.0 };
  // tick()内で: prog += AUTO_RATE[phase] * dt;
  ```

### L002: ShaderMaterial.fragmentShader のランタイム書き換え禁止
- **何が起きた**: `mat.fragmentShader = '...'; mat.needsUpdate = true;` でシェーダーが更新されないバグ。
- **ルール**: シェーダーはオブジェクト生成時に確定する。動的に変えたい場合はuniformで制御。
- **正しいパターン**: `uniform float u_phase;` を使って分岐。

### L003: OrthographicCamera + scissor 分割レンダーは複雑すぎる
- **何が起きた**: Win95ウィンドウの中だけレンダーする仕組みが壊れやすく、デバッグに時間がかかった。
- **ルール**: P1はシンプルなPerspectiveCamera + フルスクリーンレンダーを使う。
- **例外**: 分割レンダーが本当に必要な場合は事前に司さんと合意する。

### L004: フェーズ変数はrequestAnimationFrame内でのみ更新
- **何が起きた**: setInterval内でphase変数を参照すると、クロージャの古い値が残ってフェーズが進まないバグ。
- **ルール**: tick()関数はrAF内で呼ぶ。setIntervalはUI更新（時計など）のみ。

### L005: 大規模リファクタリングは1コミット1フェーズ
- **何が起きた**: P1の50%以降をまとめて実装してコミットしたら、どこで壊れたか追跡不能に。
- **ルール**: ATTRACT実装→コミット→動作確認→EVENT_FUSE実装→コミット の順番を守る。

### L006: P1コードが壊れたらまずgit logで安定コミットを探す
- **ルール**: `git log --oneline` で確認。`git show HASH:ファイル名 > ファイル名` で単一ファイルのみ復元。
- **注意**: `git reset --hard` は他のファイルも戻るので使わない。

---

## テンプレート（新しい教訓を追加するとき）

```
### L00N: タイトル
- **何が起きた**: 具体的な状況
- **ルール**: 次回どうするか（命令形で）
- **正しいパターン**: コードがあれば書く
```
