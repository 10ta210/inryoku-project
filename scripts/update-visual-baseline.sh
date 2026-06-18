#!/usr/bin/env bash
# update-visual-baseline.sh
# Visual Regression テストの baseline を意図的に更新するスクリプト。
# 使い所: SVG 出力や CSS/JS トークンを意図的に変更した直後。
# レビュー: 更新された tests/visual/baseline/*.json を必ず PR で確認すること。
set -euo pipefail

cd "$(dirname "$0")/.."

echo ""
echo "  inryokü Visual Regression — baseline 更新"
echo "  ──────────────────────────────────────────"
echo "  対象: tests/visual/baseline/*.json"
echo ""
echo "  この操作は production code の変更が"
echo "  「意図された変更」であることを baseline に焼き付けます。"
echo "  PR レビュー時に diff を必ず確認してください。"
echo ""

if [[ "${CI:-}" == "true" ]] || [[ "${VISUAL_BASELINE_FORCE:-}" == "1" ]]; then
  echo "  [CI / FORCE] 確認プロンプトをスキップ"
else
  read -r -p "  baseline を更新しますか? [y/N]: " ans
  case "$ans" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "  cancelled."; exit 1 ;;
  esac
fi

echo ""
echo "  → VISUAL_UPDATE=1 で test:visual を実行..."
echo ""

VISUAL_UPDATE=1 npm run test:visual

echo ""
echo "  ✓ baseline 更新完了"
echo "  → git diff tests/visual/baseline/ で内容を確認してください"
echo ""
