@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem ===========================================================
rem  First-time setup on a NEW computer.
rem  Run this once. For day-to-day updates use release-update.bat
rem ===========================================================

set "PROJECT_ROOT=%~dp0"
set "API_DIR=%PROJECT_ROOT%apps\api"
set "WEB_DIR=%PROJECT_ROOT%apps\web"

echo ============================================
echo   Clothes - first time setup
echo ============================================
echo.

rem ---------- 1. Node check ----------
echo [1/8] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed.
  echo   Install Node.js 20 LTS from https://nodejs.org/ then run this script again.
  goto :error
)
for /f "tokens=1 delims=v." %%a in ('node -v') do set "NODE_MAJOR=%%a"
for /f %%v in ('node -v') do set "NODE_FULL=%%v"
if !NODE_MAJOR! LSS 20 (
  echo   Node !NODE_FULL! is too old. Version 20 or newer is required.
  goto :error
)
if !NODE_MAJOR! GEQ 23 (
  echo   Node !NODE_FULL! is not supported yet. Please use Node 20 or 22.
  goto :error
)
echo   Node !NODE_FULL! OK

rem ---------- 2. Dependencies ----------
echo.
echo [2/8] Installing dependencies (this may take a few minutes)...
cd /d "%PROJECT_ROOT%"
call npm install
if errorlevel 1 goto :error

rem ---------- 3. Backend config ----------
echo.
echo [3/8] Creating backend config...
if exist "%API_DIR%\.env" (
  echo   apps\api\.env already exists, keeping it.
) else (
  call :create_env
  if errorlevel 1 goto :error
)

rem ---------- 4. Frontend config ----------
echo.
echo [4/8] Creating frontend config...
if exist "%WEB_DIR%\.env.local" (
  echo   apps\web\.env.local already exists, keeping it.
) else (
  > "%WEB_DIR%\.env.local" echo NEXT_PUBLIC_API_URL=http://localhost:3001
  echo   Created apps\web\.env.local
)

rem ---------- 5. Database ----------
echo.
echo [5/8] Creating / migrating the database...
cd /d "%API_DIR%"
call npx prisma migrate deploy
if errorlevel 1 goto :error
call npx prisma generate
if errorlevel 1 goto :error

echo.
echo       Backfilling historical purchase orders (safe to re-run)...
call npx ts-node -P tsconfig.json scripts/backfill-purchase-orders.ts
if errorlevel 1 goto :error
call npx ts-node -P tsconfig.json scripts/backfill-barcodes.ts
if errorlevel 1 goto :error

rem ---------- 6. Build ----------
echo.
echo [6/8] Building the backend...
call npm run build
if errorlevel 1 goto :error

echo.
echo       Building the frontend...
cd /d "%WEB_DIR%"
call npm run build
if errorlevel 1 goto :error

rem ---------- 7. Certificates ----------
echo.
echo [7/9] Creating HTTPS certificates (needed for phone camera scanning)...
cd /d "%API_DIR%"
call npx ts-node -P tsconfig.json scripts/create-cert.ts
if errorlevel 1 (
  echo   Could not create the certificates. You can run create-cert.bat later.
)

rem ---------- 8. Firewall ----------
echo.
echo [8/9] Opening firewall ports (needed for phones and tablets)...
cd /d "%PROJECT_ROOT%"
call "%PROJECT_ROOT%open-firewall.bat" quiet
if errorlevel 1 (
  echo   Could not add firewall rules automatically ^(needs administrator^).
  echo   Right-click open-firewall.bat and choose "Run as administrator" later.
)

rem ---------- 9. Done ----------
echo.
echo [9/9] Done.

set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  if not defined LOCAL_IP set "LOCAL_IP=%%a"
)
if defined LOCAL_IP set "LOCAL_IP=!LOCAL_IP: =!"

echo.
echo ============================================
echo   Setup completed
echo ============================================
echo.
echo Start the system:
echo   1. Backend : start-api.bat
echo   2. Frontend: start-web.bat
echo.
echo Open in a browser:
echo   This computer : http://localhost:3000
if defined LOCAL_IP echo   Phone / tablet: http://!LOCAL_IP!:3000
echo.
echo Recommended next steps:
echo   1. Right-click set-static-ip.bat and run it as administrator, so the
echo      address above never changes.
echo   2. Run create-cert.bat again after the address is fixed.
echo   3. On the phone open http://^<ip^>:3000/setup/certificate to enable
echo      camera scanning.
echo.
pause
goto :eof

rem ===========================================================
rem  Subroutine: create apps\api\.env with generated secrets
rem ===========================================================
:create_env
set "ADMIN_EMAIL="
set /p ADMIN_EMAIL=  Login email [admin@example.com]:
if "!ADMIN_EMAIL!"=="" set "ADMIN_EMAIL=admin@example.com"

set "ADMIN_PASSWORD="
:ask_password
echo   Login password (letters and digits only, at least 8 characters):
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$p = Read-Host -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"`) do set "ADMIN_PASSWORD=%%i"
if "!ADMIN_PASSWORD!"=="" (
  echo   Password cannot be empty.
  goto :ask_password
)

for /f %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "SECRET_A=%%i"
for /f %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "SECRET_R=%%i"

>  "%API_DIR%\.env" echo ADMIN_EMAIL=!ADMIN_EMAIL!
>> "%API_DIR%\.env" echo ADMIN_PASSWORD=!ADMIN_PASSWORD!
>> "%API_DIR%\.env" echo JWT_ACCESS_SECRET=!SECRET_A!
>> "%API_DIR%\.env" echo JWT_REFRESH_SECRET=!SECRET_R!
>> "%API_DIR%\.env" echo JWT_ACCESS_EXPIRES=10h
>> "%API_DIR%\.env" echo JWT_REFRESH_EXPIRES=7d
>> "%API_DIR%\.env" echo CLIENT_ORIGIN=http://localhost:3000
>> "%API_DIR%\.env" echo ALLOW_LAN_ORIGINS=true
>> "%API_DIR%\.env" echo COOKIE_SECURE=false
>> "%API_DIR%\.env" echo DATABASE_URL="file:./dev.db"
>> "%API_DIR%\.env" echo PORT=3001

if not exist "%API_DIR%\.env" (
  echo   Failed to create apps\api\.env
  exit /b 1
)
echo   Created apps\api\.env with freshly generated secrets.
exit /b 0

:error
echo.
echo Setup failed. Check the error output above.
pause
exit /b 1
