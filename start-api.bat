@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "API_DIR=%PROJECT_ROOT%apps\api"

echo Starting API service...
cd /d "%API_DIR%"
if errorlevel 1 goto :error

node dist\src\main.js
goto :eof

:error
echo.
echo API start failed. Check the directory and build output.
pause
exit /b 1
