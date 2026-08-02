@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem Backs up the database AND the product images into backups\<timestamp>\.
rem Run this BEFORE "git pull" and before any update.

set "PROJECT_ROOT=%~dp0"
set "API_DIR=%PROJECT_ROOT%apps\api"
set "DB_FILE=%API_DIR%\prisma\dev.db"
set "UPLOAD_DIR=%API_DIR%\uploads"
set "BACKUP_ROOT=%PROJECT_ROOT%backups"
set "KEEP=10"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%i"
if not defined STAMP set "STAMP=manual"
set "TARGET=%BACKUP_ROOT%\%STAMP%"

if not exist "%BACKUP_ROOT%" mkdir "%BACKUP_ROOT%"
mkdir "%TARGET%"

echo Backing up to: %TARGET%
echo.

if exist "%DB_FILE%" (
  copy /Y "%DB_FILE%" "%TARGET%\dev.db" >nul
  echo   [ok] database
) else (
  echo   [skip] database not found: %DB_FILE%
)

if exist "%UPLOAD_DIR%" (
  powershell -NoProfile -Command "Compress-Archive -Path '%UPLOAD_DIR%\*' -DestinationPath '%TARGET%\uploads.zip' -Force" 2>nul
  if exist "%TARGET%\uploads.zip" (
    echo   [ok] product images
  ) else (
    echo   [skip] no product images to back up
  )
) else (
  echo   [skip] uploads folder not found
)

rem Keep only the newest %KEEP% backups
powershell -NoProfile -Command "Get-ChildItem -Path '%BACKUP_ROOT%' -Directory | Sort-Object Name -Descending | Select-Object -Skip %KEEP% | Remove-Item -Recurse -Force" 2>nul

echo.
echo Backup completed. Keeping the newest %KEEP% backups.
echo Location: %BACKUP_ROOT%
if "%~1"=="" pause
endlocal
exit /b 0
