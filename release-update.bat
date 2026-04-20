@echo off
chcp 65001 >nul
setlocal

set "PROJECT_ROOT=%~dp0"
set "API_DIR=%PROJECT_ROOT%apps\api"
set "WEB_DIR=%PROJECT_ROOT%apps\web"
set "DB_FILE=%API_DIR%\prisma\dev.db"
set "BACKUP_FILE=%API_DIR%\prisma\dev.db.backup"

echo 开始执行 Release 更新...
echo.

if exist "%DB_FILE%" (
  echo 正在备份数据库到: %BACKUP_FILE%
  copy /Y "%DB_FILE%" "%BACKUP_FILE%" >nul
) else (
  echo 未找到数据库文件，跳过备份
)

echo.
echo 进入 API 目录: %API_DIR%
cd /d "%API_DIR%"
if errorlevel 1 goto :error

echo.
echo 执行 Prisma 数据库迁移...
call npx prisma migrate deploy
if errorlevel 1 goto :error

echo.
echo 重新生成 Prisma Client...
call npx prisma generate
if errorlevel 1 goto :error

echo.
echo 编译 API...
call npm run build
if errorlevel 1 goto :error

echo.
echo 进入 Web 目录: %WEB_DIR%
cd /d "%WEB_DIR%"
if errorlevel 1 goto :error

echo.
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
