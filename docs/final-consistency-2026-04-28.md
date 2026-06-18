# Final Consistency Verification — 2026-04-28

最終整合性検証レポート。検証対象は inryokü プロジェクト直近大量変更。

---

## 1. 検証結果サマリ

| 項目 | 結果 | 備考 |
|---|---|---|
| HTML 参照外部ファイル存在確認 | PASS | 本番 HTML (index.html / p3_test.html / *_demo.html / offline.html / legal.html / privacy.html / returns.html / size-guide.html / success.html) で参照される全 src/href が物理存在 |
| ロード順序 (production scripts) | PASS | three → p1 → particle_rings → particle_speech_rings → error-shield → ai-chat-client-shield → copy-fix-runtime → enhance → register → perf-observer → i18n → states |
| キャッシュバスター `?v=20260428` 統一 | PASS (例外 1) | `p1_index_for_claude.html` のみ `?v=20260405onebit1`。これは開発スナップショット (robots.txt で Disallow / sitemap 非掲載) なので本番影響なし |
| `npm test` | **PASS** | tests=335 / suites=58 / pass=335 / fail=0 / duration≈2.2s |
| docs 内部リンク (`*.md`) | PASS | broken_count=0 |
| `node -c server.js` | PASS | syntax error なし |
| `manifest.json` JSON parse | PASS | 構造妥当 / icons / shortcuts / categories OK |
| `i18n.json` JSON parse | PASS | |
| `sitemap.xml` XML parse | PASS | sitemaps.org 0.9 + image extension 準拠 |
| `robots.txt` 妥当性 | PASS | 開発 HTML / docs / vendor / .env / クエリ URL を Disallow。AI クローラ明示許可 |
| server.js セキュリティヘッダ | PASS | `X-Frame-Options: DENY` / `Content-Security-Policy` / rate limit (`rateLimitClientIP`) 実装済 |
| メモリ index 整合 | PARTIAL | プロジェクト側 MEMORY.md (`/Users/10ta210/.claude/.../memory/MEMORY.md`) は最新。インデクスから漏れた追加ファイルは無し。ただしユーザー auto-memory の旧版表記 (claudeMd 内に貼られていたもの) と差分あり — 実体側が正 |

---

## 2. ロード順序の妥当性 (production / index.html)

`particle_rings.js` と `particle_speech_rings.js` のソースを grep した結果、両者は `ParticleGlyphs` グローバルを参照していない。よってタスク仕様中の「particle_glyphs.js → particle_rings.js → particle_speech_rings.js」依存は **実コードには存在しない**。`particle_glyphs.js` は `particle_glyphs_demo.html` でのみ単体ロード。本番 (index.html / p3_test.html) では使用されない。

確認した実際の依存関係:
- `particle_rings.js` → `THREE` (vendor/three.min.js)
- `particle_speech_rings.js` → `particle_rings.js` (同イベントバス / 補完)
- `ai-chat-client-shield.js` → `error-shield.js` の toast 機構 → **実装通りに後ロード OK**
- `enhance.js` / `register.js` / `perf-observer.js` / `i18n.js` / `states.js` — 全 defer / 互いに干渉しない後付けレイヤ

**race condition 懸念**: なし。defer は記述順保持。`renderPhase1()` は inline script で defer より後の実行になるため particle_rings はロード完了済。

---

## 3. キャッシュバスター詳細

```
index.html, p3_test.html, particle_glyphs_demo.html, particle_rings_demo.html
  → 全 ?v=20260428 統一 OK

p1_index_for_claude.html (開発スナップショット)
  → ?v=20260405onebit1 (旧)
```

`p1_index_for_claude.html` は robots Disallow / sitemap 非掲載 / 内部開発用。本番ユーザー到達不能。**修正不要** (旧スナップショットを保護する `feedback_no_delete_phases.md` 方針に整合)。

---

## 4. 不整合リスト

### 重大度 LOW (情報のみ)
- **L1**: `p1_index_for_claude.html` 内のキャッシュバスターが旧 (`v=20260405onebit1`)。**影響なし** (Disallow 済 / 開発用)。
- **L2**: タスク要件に挙がった「particle_glyphs.js → particle_rings.js → particle_speech_rings.js」依存は実コードには無い。`particle_glyphs` は demo 専用で独立。**修正不要**。
- **L3**: ルートに `.gitignore` が無い。ただし当該ディレクトリは git repo ではない (`Is directory a git repo: No`) ため不整合ではない。git 化する際は `.env` / `node_modules/` / `data/subscribers.json` / `tests/visual/snapshots/` を除外候補とすべき。

### 重大度 MEDIUM / HIGH
- 該当なし。

---

## 5. 修正済 / 残課題

### 修正済
- なし (検出された不整合はいずれも軽微で、実害なし)。

### 残課題 (将来 git 化する場合)
- `.gitignore` 雛形:
  ```
  .env
  node_modules/
  .DS_Store
  data/subscribers.json
  tests/visual/snapshots/
  .release-backup/
  *.log
  ```

---

## 6. server.js エンドポイント / セキュリティ抜粋

- rate limit 実装: `rateLimitClientIP(req)` → `req.headers['x-forwarded-for']` フォールバック付き / 429 返却
- セキュリティヘッダ:
  - `X-Frame-Options: DENY`
  - HTML レスポンスに `Content-Security-Policy: CSP_HTML` 付与
  - 既存 CSP がある場合は尊重 (line 939-944)
- IP ハッシュ化: `IP_SALT` env var + sha256 (line 1656)

CSP / rate limit の詳細チューニングは `docs/csp-tuning-2026-04-28.md` / `docs/security-fixes-2026-04-28.md` に既出。本検証では新規発見なし。

---

## 7. npm test 結果 (full)

```
# tests 335
# suites 58
# pass 335
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2201.521417
```

含まれるスイート:
- `ai-chat-client-shield.test.mjs`
- `api-chat.test.mjs`
- `canon_visual.test.mjs`
- `integration.test.mjs`
- `particle_rings.test.mjs`
- `particle_speech_rings.test.mjs`
- `security.test.mjs`
- `seo.test.mjs`
- `shopify-proxy.test.mjs`
- `states.test.mjs`
- `tests/visual/canon_visual_full.test.mjs`
- `tests/visual/css_token_consistency.test.mjs`
- `tests/visual/halo_geometry.test.mjs`
- `tests/visual/speech_lifecycle.test.mjs`

---

## 8. 結論

**本番影響のある不整合なし。** 全 production HTML はキャッシュバスター統一 / 全参照ファイル存在 / ロード順序整合 / 全 335 テスト合格。docs リンク 0 件破損。JSON / XML / server.js syntax いずれも妥当。

直近大量変更後の状態は **production-ready**。
