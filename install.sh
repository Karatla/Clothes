#!/bin/bash
# First-time setup on a NEW computer.
# Run this once. For day-to-day updates use release-update.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"
WEB_DIR="$PROJECT_ROOT/apps/web"

echo "============================================"
echo "  Clothes - first time setup"
echo "============================================"
echo ""

echo "[1/7] Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed. Install Node 20 LTS: https://nodejs.org/"
  exit 1
fi
NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 20 ] || [ "$NODE_MAJOR" -ge 23 ]; then
  echo "  Node $(node -v) is not supported. Please use Node 20 or 22."
  exit 1
fi
echo "  Node $(node -v) OK"

echo ""
echo "[2/7] Installing dependencies..."
cd "$PROJECT_ROOT"
npm install

echo ""
echo "[3/7] Creating config files..."
if [ -f "$API_DIR/.env" ]; then
  echo "  apps/api/.env already exists, keeping it."
else
  read -r -p "  Login email [admin@example.com]: " ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
  ADMIN_PASSWORD=""
  while [ -z "$ADMIN_PASSWORD" ]; do
    read -r -s -p "  Login password (at least 8 characters): " ADMIN_PASSWORD
    echo ""
  done
  SECRET_A="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  SECRET_R="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  cat > "$API_DIR/.env" <<EOF
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
JWT_ACCESS_SECRET=$SECRET_A
JWT_REFRESH_SECRET=$SECRET_R
JWT_ACCESS_EXPIRES=10h
JWT_REFRESH_EXPIRES=7d
CLIENT_ORIGIN=http://localhost:3000
ALLOW_LAN_ORIGINS=true
COOKIE_SECURE=false
DATABASE_URL="file:./dev.db"
PORT=3001
EOF
  echo "  Created apps/api/.env with freshly generated secrets."
fi

if [ -f "$WEB_DIR/.env.local" ]; then
  echo "  apps/web/.env.local already exists, keeping it."
else
  echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > "$WEB_DIR/.env.local"
  echo "  Created apps/web/.env.local"
fi

echo ""
echo "[4/7] Creating / migrating the database..."
cd "$API_DIR"
npx prisma migrate deploy
npx prisma generate
echo "      Backfilling historical purchase orders (safe to re-run)..."
npx ts-node -P tsconfig.json scripts/backfill-purchase-orders.ts
npx ts-node -P tsconfig.json scripts/backfill-barcodes.ts

echo ""
echo "[5/7] Building the backend..."
npm run build

echo ""
echo "[6/7] Building the frontend..."
cd "$WEB_DIR"
npm run build

echo ""
echo "[7/7] Creating HTTPS certificates (needed for phone camera scanning)..."
cd "$API_DIR"
npx ts-node -P tsconfig.json scripts/create-cert.ts || \
  echo "  Could not create the certificates. You can run ./create-cert.sh later."

LOCAL_IP="$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"

echo ""
echo "============================================"
echo "  Setup completed"
echo "============================================"
echo ""
echo "Start the system:"
echo "  1. Backend : ./start-api.sh"
echo "  2. Frontend: ./start-web.sh"
echo ""
echo "Open in a browser:"
echo "  This computer : http://localhost:3000"
[ -n "$LOCAL_IP" ] && echo "  Phone / tablet: http://$LOCAL_IP:3000"
echo ""
echo "Recommended next steps:"
echo "  1. ./set-static-ip.sh    so the address above never changes"
echo "  2. ./create-cert.sh      again after the address is fixed"
echo "  3. ./open-firewall.sh    if this machine has a firewall enabled"
[ -n "$LOCAL_IP" ] && echo "  4. On the phone open http://$LOCAL_IP:3000/setup/certificate"
