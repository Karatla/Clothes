#!/bin/bash
# Backs up the database AND the product images into backups/<timestamp>/
# Run this BEFORE "git pull" and before any update.

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"
DB_FILE="$API_DIR/prisma/dev.db"
UPLOAD_DIR="$API_DIR/uploads"
BACKUP_ROOT="$PROJECT_ROOT/backups"
KEEP=10

STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="$BACKUP_ROOT/$STAMP"
mkdir -p "$TARGET"

echo "Backing up to: $TARGET"

if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$TARGET/dev.db"
  echo "  [ok] database"
else
  echo "  [skip] database not found: $DB_FILE"
fi

if [ -d "$UPLOAD_DIR" ] && [ -n "$(ls -A "$UPLOAD_DIR" 2>/dev/null)" ]; then
  tar -czf "$TARGET/uploads.tar.gz" -C "$UPLOAD_DIR" .
  echo "  [ok] product images"
else
  echo "  [skip] no product images to back up"
fi

# Keep only the newest KEEP backups
ls -1d "$BACKUP_ROOT"/*/ 2>/dev/null | sort -r | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -rf "$old"
done

echo ""
echo "Backup completed. Keeping the newest $KEEP backups."
echo "Location: $BACKUP_ROOT"
