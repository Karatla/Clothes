@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem ===========================================================
rem  Day-to-day update. Run AFTER "git pull".
rem  For a brand new computer use install.bat instead.
rem
rem  IMPORTANT: run backup.bat BEFORE "git pull", not after.
rem ===========================================================

set "PROJECT_ROOT=%~dp0"
set "API_DIR=%PROJECT_ROOT%apps\api"
set "WEB_DIR=%PROJECT_ROOT%apps\web"

echo Starting release update...
echo.

echo [1/6] Backing up database and product images...
call "%PROJECT_ROOT%backup.bat" quiet
if errorlevel 1 goto :error

echo.
echo [2/6] Installing dependencies...
cd /d "%PROJECT_ROOT%"
call npm install
if errorlevel 1 goto :error

echo.
echo [3/6] Running Prisma migrate deploy...
cd /d "%API_DIR%"
if errorlevel 1 goto :error
call npx prisma migrate deploy
if errorlevel 1 goto :error

echo.
echo [4/6] Generating Prisma Client...
call npx prisma generate
if errorlevel 1 goto :error

echo.
echo       Backfilling historical purchase orders (safe to re-run)...
call npx ts-node -P tsconfig.json scripts/backfill-purchase-orders.ts
if errorlevel 1 goto :error
call npx ts-node -P tsconfig.json scripts/backfill-barcodes.ts
if errorlevel 1 goto :error

echo.
echo [5/6] Building the backend...
call npm run build
if errorlevel 1 goto :error

echo.
echo [6/6] Building the frontend...
cd /d "%WEB_DIR%"
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error

echo.
echo Release update completed.
echo.
echo Start commands:
echo   1. API: start-api.bat
echo   2. Web: start-web.bat
pause
goto :eof

:error
echo.
echo Update failed. Check the error output above.
echo Your data is safe - a backup was made in the backups folder.
pause
exit /b 1
