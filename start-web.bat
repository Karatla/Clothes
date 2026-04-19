@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

set "WEB_DIR=%PROJECT_ROOT%\apps\web"

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
