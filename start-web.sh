#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$PROJECT_ROOT/apps/web"

echo "Starting Web service..."
cd "$WEB_DIR"

npm run start
