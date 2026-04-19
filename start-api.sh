#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"

echo "正在启动后端服务..."
cd "$API_DIR"

node dist/src/main.js
