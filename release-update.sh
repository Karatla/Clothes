#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"
WEB_DIR="$PROJECT_ROOT/apps/web"
DB_FILE="$API_DIR/prisma/dev.db"
BACKUP_FILE="$API_DIR/prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)"

echo "开始执行 Release 更新..."

if [ -f "$DB_FILE" ]; then
  echo "备份数据库到: $BACKUP_FILE"
  cp "$DB_FILE" "$BACKUP_FILE"
else
  echo "未找到数据库文件，跳过备份"
fi

echo "进入 API 目录: $API_DIR"
cd "$API_DIR"

echo "执行 Prisma 数据库迁移..."
npx prisma migrate deploy

echo "重新生成 Prisma Client..."
npx prisma generate

echo "编译 API..."
npm run build

echo "进入 Web 目录: $WEB_DIR"
cd "$WEB_DIR"

echo "编译 Web..."
npm run build

echo ""
echo "Release 更新完成。"
echo ""
echo "启动方式："
echo "1. 后端: cd apps/api && node dist/src/main.js"
echo "2. 前端: cd apps/web && npm run start"
