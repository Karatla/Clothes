@echo off
chcp 65001 >nul
setlocal

set "PROJECT_ROOT=%~dp0"
set "WEB_DIR=%PROJECT_ROOT%apps\web"

echo 正在启动前端服务...
cd /d "%WEB_DIR%"
if errorlevel 1 goto :error

call npm run start
goto :eof

:error
echo.
echo 前端启动失败，请检查目录或是否已完成编译。
pause
exit /b 1
