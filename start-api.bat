@echo off
chcp 65001 >nul
setlocal

set "PROJECT_ROOT=%~dp0"
set "API_DIR=%PROJECT_ROOT%apps\api"

echo 正在启动后端服务...
cd /d "%API_DIR%"
if errorlevel 1 goto :error

node dist\src\main.js
goto :eof

:error
echo.
echo 后端启动失败，请检查目录或是否已完成编译。
pause
exit /b 1
