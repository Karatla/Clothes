@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

set "API_DIR=%PROJECT_ROOT%\apps\api"

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
