#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$PROJECT_ROOT/apps/web"

echo "正在启动前端服务..."
cd "$WEB_DIR"

npm run start
