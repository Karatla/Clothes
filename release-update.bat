@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "API_DIR=%PROJECT_ROOT%apps\api"
set "WEB_DIR=%PROJECT_ROOT%apps\web"
set "DB_FILE=%API_DIR%\prisma\dev.db"
set "BACKUP_FILE=%API_DIR%\prisma\dev.db.backup"

echo Starting release update...
echo.

if exist "%DB_FILE%" (
  echo Backing up database to: %BACKUP_FILE%
  copy /Y "%DB_FILE%" "%BACKUP_FILE%" >nul
) else (
  echo Database file not found, skipping backup
)

echo.
echo Entering API directory: %API_DIR%
cd /d "%API_DIR%"
if errorlevel 1 goto :error

echo.
echo Running Prisma migrate deploy...
call npx prisma migrate deploy
if errorlevel 1 goto :error

echo.
echo Generating Prisma Client...
call npx prisma generate
if errorlevel 1 goto :error

echo.
echo Building API...
call npm run build
if errorlevel 1 goto :error

echo.
echo Entering Web directory: %WEB_DIR%
cd /d "%WEB_DIR%"
if errorlevel 1 goto :error

echo.
echo Building Web...
call npm run build
if errorlevel 1 goto :error

echo.
echo Release update completed.
echo.
echo Start commands:
echo 1. API: cd apps\api ^&^& node dist\src\main.js
echo 2. Web: cd apps\web ^&^& npm run start
pause
goto :eof

:error
echo.
echo Update failed. Check the error output above.
pause
exit /b 1
