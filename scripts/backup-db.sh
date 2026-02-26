#!/usr/bin/env bash
set -euo pipefail

# Database backup script — pg_dump to S3
# Usage: ./scripts/backup-db.sh
# Requires: AWS CLI configured, DATABASE_URL or individual PG vars, S3_BACKUP_BUCKET

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/db-backups"
BACKUP_FILE="roadside_atl_${TIMESTAMP}.sql.gz"
S3_BUCKET="${S3_BACKUP_BUCKET:-roadside-atl-backups}"
S3_PREFIX="${S3_BACKUP_PREFIX:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Parse DATABASE_URL if set, otherwise use individual vars
if [ -n "${DATABASE_URL:-}" ]; then
  # Extract components from postgresql://user:pass@host:port/dbname
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^@]*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^@]*@[^:]*:\([^/]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^/]*/\(.*\)|\1|p')
else
  DB_USER="${PGUSER:-dealer}"
  DB_PASS="${PGPASSWORD:-}"
  DB_HOST="${PGHOST:-localhost}"
  DB_PORT="${PGPORT:-5432}"
  DB_NAME="${PGDATABASE:-roadside_atl}"
fi

echo "[$(date -Iseconds)] Starting database backup..."

mkdir -p "$BACKUP_DIR"

# Run pg_dump with compression
export PGPASSWORD="$DB_PASS"
pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  -f "${BACKUP_DIR}/${BACKUP_FILE}"

FILESIZE=$(stat -f%z "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null)
echo "[$(date -Iseconds)] Backup created: ${BACKUP_FILE} (${FILESIZE} bytes)"

# Upload to S3
if command -v aws &>/dev/null; then
  aws s3 cp \
    "${BACKUP_DIR}/${BACKUP_FILE}" \
    "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" \
    --storage-class STANDARD_IA

  echo "[$(date -Iseconds)] Uploaded to s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"

  # Clean up old backups (keep last N days)
  CUTOFF_DATE=$(date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null || date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null)
  if [ -n "$CUTOFF_DATE" ]; then
    echo "[$(date -Iseconds)] Cleaning backups older than ${RETENTION_DAYS} days (before ${CUTOFF_DATE})..."
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | while read -r line; do
      FILE_DATE=$(echo "$line" | awk '{print $1}')
      FILE_NAME=$(echo "$line" | awk '{print $4}')
      if [ -n "$FILE_NAME" ] && [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
        aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${FILE_NAME}"
        echo "  Deleted: ${FILE_NAME}"
      fi
    done
  fi
else
  echo "[WARN] AWS CLI not installed — backup saved locally only at ${BACKUP_DIR}/${BACKUP_FILE}"
fi

# Clean up local temp file
rm -f "${BACKUP_DIR}/${BACKUP_FILE}"

echo "[$(date -Iseconds)] Backup complete."
