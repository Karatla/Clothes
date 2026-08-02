#!/bin/bash
# Day-to-day update. Run AFTER "git pull".
# For a brand new computer use install.sh instead.
#
# IMPORTANT: run backup.sh BEFORE "git pull", not after.

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"
WEB_DIR="$PROJECT_ROOT/apps/web"

echo "Starting release update..."
echo ""

echo "[1/6] Backing up database and product images..."
bash "$PROJECT_ROOT/backup.sh"

echo ""
echo "[2/6] Installing dependencies..."
cd "$PROJECT_ROOT"
npm install

echo ""
echo "[3/6] Running Prisma migrate deploy..."
cd "$API_DIR"
npx prisma migrate deploy

echo ""
echo "[4/6] Generating Prisma Client..."
npx prisma generate

echo ""
echo "      Backfilling historical purchase orders (safe to re-run)..."
npx ts-node -P tsconfig.json scripts/backfill-purchase-orders.ts
npx ts-node -P tsconfig.json scripts/backfill-barcodes.ts

echo ""
echo "[5/6] Building the backend..."
npm run build

echo ""
echo "[6/6] Building the frontend..."
cd "$WEB_DIR"
npm run build

echo ""
echo "Release update completed."
echo ""
echo "Start commands:"
echo "  1. Backend: ./start-api.sh"
echo "  2. Frontend: ./start-web.sh"
