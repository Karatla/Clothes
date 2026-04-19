@echo off
setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

set "API_DIR=%PROJECT_ROOT%\apps\api"
set "WEB_DIR=%PROJECT_ROOT%\apps\web"
set "DB_FILE=%API_DIR%\prisma\dev.db"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%i"
set "BACKUP_FILE=%API_DIR%\prisma\dev.db.backup.%STAMP%"

echo 开始执行 Release 更新...

if exist "%DB_FILE%" (
  echo 备份数据库到: %BACKUP_FILE%
  copy "%DB_FILE%" "%BACKUP_FILE%" >nul
) else (
  echo 未找到数据库文件，跳过备份
)

echo 进入 API 目录: %API_DIR%
cd /d "%API_DIR%"
if errorlevel 1 goto :error

echo 执行 Prisma 数据库迁移...
call npx prisma migrate deploy
if errorlevel 1 goto :error

echo 重新生成 Prisma Client...
call npx prisma generate
if errorlevel 1 goto :error

echo 编译 API...
call npm run build
if errorlevel 1 goto :error

echo 进入 Web 目录: %WEB_DIR%
cd /d "%WEB_DIR%"
if errorlevel 1 goto :error

echo 编译 Web...
call npm run build
if errorlevel 1 goto :error

echo.
echo Release 更新完成。
echo.
echo 启动方式：
echo 1. 后端: cd apps\api ^&^& node dist\src\main.js
echo 2. 前端: cd apps\web ^&^& npm run start
pause
goto :eof

:error
echo.
echo 更新失败，请检查上面的报错信息。
pause
exit /b 1
