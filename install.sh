#!/usr/bin/env bash
# ⚠️ 本文件由 AI 生成（AI-generated）。详见 README.md 顶部的 AI 生成声明。
#
# 把本目录的源码同步安装到 VS Code 扩展目录。
# 用法： ./install.sh
#
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
NAME="local.new-project-menu-1.0.0"
DEST="$HOME/.vscode/extensions/$NAME"

# 删除前先确认目标路径确实是扩展目录，避免误删
case "$DEST" in
  "$HOME/.vscode/extensions/"*) ;;
  *) echo "拒绝执行：目标路径异常 → $DEST" >&2; exit 1 ;;
esac

# 清单由语言表生成，保证两边一致
if command -v node >/dev/null 2>&1; then
  node "$SRC/tools/gen-manifest.js"
else
  echo "⚠️  未找到 node，跳过 package.json 重新生成（沿用现有清单）"
fi

rm -rf "$DEST"
mkdir -p "$DEST"
cp "$SRC/package.json" "$SRC/extension.js" "$SRC/languages.js" "$SRC/README.md" "$DEST/"

echo "✅ 已安装到 $DEST"
echo "👉 请在 VS Code 中执行命令面板 → Developer: Reload Window（或重启 VS Code）"
