# /shader-review — GLSLシェーダーレビュー

$ARGUMENTS で指定したファイルのシェーダーをレビューしてください。
指定がない場合は直前に編集したファイルを対象にします。

## レビュー項目

### 必須チェック
1. **AdditiveBlending漏れ**
   - 発光・グロー効果のオブジェクトに `blending: THREE.AdditiveBlending` があるか
   - `depthWrite: false` がセットされているか（AdditiveBlendingと一緒に必要）

2. **uniform定義漏れ**
   - fragmentShaderで使っているuniform変数がJS側の `uniforms: {}` に全て定義されているか
   - タイポチェック（u_timeとu_tiime など）

3. **精度宣言**
   - fragmentShaderの先頭に `precision highp float;` があるか

4. **型ミスマッチ**
   - `vec3` に `float` を直接代入していないか（例: `vec3 c = 1.0;` → NG）
   - `vec4` が必要な場所に `vec3` を渡していないか

5. **discard の使い方**
   - `discard` は `if` ブロック内で使っているか（条件なしdiscardは全ピクセル消える）

### inryokü固有チェック
6. **カラーシステム準拠**
   - RGBCMY 6色が正しいか: R(1,0,0) G(0,1,0) B(0,0,1) C(0,1,1) M(1,0,1) Y(1,1,0)
   - グレーは `vec3(0.5)` または `#808080`

7. **アニメーション**
   - `u_time` uniformがJS側から毎フレーム更新されているか
   - `sin()` の範囲は `-1〜1` → 色に使うなら `0.5 + 0.5*sin(...)` に変換しているか

8. **パフォーマンス**
   - ループ内でtextureを何度もサンプリングしていないか
   - 重いfor文がfragmentShaderにないか（vertexShaderへ移動を検討）

## レビュー後の対応

問題が見つかった場合はその場で修正案を提示してください。
修正後は必ず `node --check` で構文確認してください。
