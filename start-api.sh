#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"

echo "Starting API service..."
cd "$API_DIR"

node dist/src/main.js
