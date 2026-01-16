#!/bin/bash

echo "===================================="
echo "  弹幕BOSS战 - 本地服务器启动"
echo "===================================="
echo ""
echo "正在启动本地服务器..."
echo ""

# 检查Python是否可用
if command -v python3 &> /dev/null; then
    echo "使用Python启动服务器..."
    echo "服务器地址: http://localhost:8000"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "使用Python启动服务器..."
    echo "服务器地址: http://localhost:8000"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python -m http.server 8000
# 检查Node.js是否可用
elif command -v node &> /dev/null; then
    echo "使用Node.js启动服务器..."
    npx http-server -p 8000
else
    echo "[错误] 未找到Python或Node.js！"
    echo ""
    echo "请安装以下任一工具："
    echo "1. Python 3.x: https://www.python.org/downloads/"
    echo "2. Node.js: https://nodejs.org/"
    echo ""
    exit 1
fi
