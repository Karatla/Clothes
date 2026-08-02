#!/bin/bash
# Creates the HTTPS certificates needed for phone camera scanning.
# Run once during setup (after setting the fixed IP), again whenever the
# computer's IP changes, and once a year before the certificate expires.
# The root certificate is reused, so phones never have to install it twice.

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT/apps/api"

npx ts-node -P tsconfig.json scripts/create-cert.ts "$@"

echo ""
echo "============================================"
echo "  Next steps"
echo "============================================"
echo "  1. Restart the backend and frontend"
echo "  2. On the phone open:"
echo "     http://<this computer ip>:3000/setup/certificate"
echo "     and follow the steps shown there."
