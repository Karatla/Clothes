@echo off
setlocal
chcp 65001 >nul

rem ===========================================================
rem  Creates the HTTPS certificates needed for phone camera
rem  scanning. Run this:
rem    - once during setup, AFTER setting the fixed IP address
rem    - again whenever the computer's IP address changes
rem    - again once a year before the certificate expires
rem
rem  The root certificate is reused, so phones never have to
rem  install anything again.
rem ===========================================================

set "PROJECT_ROOT=%~dp0"
set "API_DIR=%PROJECT_ROOT%apps\api"

echo Creating HTTPS certificates...
echo.

cd /d "%API_DIR%"
if errorlevel 1 goto :error

call npx ts-node -P tsconfig.json scripts/create-cert.ts %*
if errorlevel 1 goto :error

echo.
echo ============================================
echo   Next steps
echo ============================================
echo   1. Restart the backend and frontend
echo      (close both windows, run start-api.bat and start-web.bat)
echo   2. On the phone open:
echo      http://^<this computer ip^>:3000/setup/certificate
echo      and follow the steps shown there.
echo.
pause
goto :eof

:error
echo.
echo Failed to create the certificates. Check the error output above.
pause
exit /b 1
