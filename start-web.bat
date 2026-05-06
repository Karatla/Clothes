@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "WEB_DIR=%PROJECT_ROOT%apps\web"

echo Starting Web service...
cd /d "%WEB_DIR%"
if errorlevel 1 goto :error

call npm run start
goto :eof

:error
echo.
echo Web start failed. Check the directory and build output.
pause
exit /b 1
