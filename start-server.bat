@echo off
echo ====================================
echo   弹幕BOSS战 - 本地服务器启动
echo ====================================
echo.
echo 正在启动本地服务器...
echo.

REM 检查Python是否可用
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo 使用Python启动服务器...
    echo 服务器地址: http://localhost:8000
    echo.
    echo 按 Ctrl+C 停止服务器
    echo.
    python -m http.server 8000
    goto :end
)

REM 检查Node.js是否可用
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo 使用Node.js启动服务器...
    echo 正在检查http-server...
    npx http-server -p 8000
    goto :end
)

echo [错误] 未找到Python或Node.js！
echo.
echo 请安装以下任一工具：
echo 1. Python 3.x: https://www.python.org/downloads/
echo 2. Node.js: https://nodejs.org/
echo.
pause

:end
