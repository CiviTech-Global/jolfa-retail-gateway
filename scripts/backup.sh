#!/usr/bin/env bash
#
# Nightly backup for Jolfa Retail Gateway.
#
# Captures BOTH halves of the application's state:
#   1. the Postgres database
#   2. the uploads directory
#
# Backing up only the database restores a catalogue whose product images are all
# missing, because uploaded media lives on the filesystem and is referenced from
# the database by path. The two must be captured together or neither is useful.
#
# Usage:
#   scripts/backup.sh                  # uses Jolfa-Server/.env
#   BACKUP_DIR=/mnt/backups scripts/backup.sh
#
# Install as a nightly cron job (03:30 every day):
#   30 3 * * * /var/www/jolfa-retail-gateway/scripts/backup.sh >> /var/log/jolfa-backup.log 2>&1

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/Jolfa-Server"
ENV_FILE="${ENV_FILE:-$SERVER_DIR/.env}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/jolfa}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

log() { printf '[backup] %s %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"; }
fail() { printf '[backup] ERROR: %s\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "no env file at $ENV_FILE"

# Read DATABASE_URL and UPLOAD_DIR without sourcing the whole file — it contains
# values with characters that the shell would otherwise interpret.
read_env() {
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | sed 's/^"//; s/"$//'
}

DATABASE_URL="$(read_env DATABASE_URL)"
UPLOAD_DIR_VALUE="$(read_env UPLOAD_DIR)"
UPLOAD_DIR_VALUE="${UPLOAD_DIR_VALUE:-uploads}"

[ -n "$DATABASE_URL" ] || fail "DATABASE_URL is not set in $ENV_FILE"

# Prisma's URL carries parameters libpq does not understand — `?schema=public`
# makes pg_dump exit with "invalid URI query parameter". Pull the schema out to
# pass properly, and drop the rest of Prisma's own options.
PG_SCHEMA="$(printf '%s' "$DATABASE_URL" | sed -n 's/.*[?&]schema=\([^&]*\).*/\1/p')"
PG_URL="$(printf '%s' "$DATABASE_URL" \
  | sed -E 's/([?&])(schema|connection_limit|pool_timeout|pgbouncer|socket_timeout|statement_cache_size)=[^&]*//g' \
  | sed -E 's/\?&/?/; s/[?&]$//')"

# UPLOAD_DIR is resolved relative to the server's working directory.
case "$UPLOAD_DIR_VALUE" in
  /*) UPLOADS_PATH="$UPLOAD_DIR_VALUE" ;;
  *)  UPLOADS_PATH="$SERVER_DIR/$UPLOAD_DIR_VALUE" ;;
esac

DEST="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$DEST"

log "writing to $DEST"

# --- database -------------------------------------------------------------
# Custom format (-Fc) so restore can be parallel and selective.
log "dumping database${PG_SCHEMA:+ (schema: $PG_SCHEMA)}"
pg_dump --dbname="$PG_URL" --format=custom --no-owner --no-privileges \
  ${PG_SCHEMA:+--schema="$PG_SCHEMA"} \
  --file="$DEST/database.dump"

DB_SIZE="$(du -h "$DEST/database.dump" | cut -f1)"
log "database dump complete ($DB_SIZE)"

# --- uploads --------------------------------------------------------------
if [ -d "$UPLOADS_PATH" ]; then
  log "archiving uploads from $UPLOADS_PATH"
  # Archive the *contents*, not the directory itself. Storing the directory
  # would bake its name into the archive, so restoring to a different path
  # (a rehearsal, or a deploy that renamed UPLOAD_DIR) would silently recreate
  # the old name beside the intended target instead of filling it.
  tar -czf "$DEST/uploads.tar.gz" -C "$UPLOADS_PATH" .
  UPLOADS_SIZE="$(du -h "$DEST/uploads.tar.gz" | cut -f1)"
  log "uploads archive complete ($UPLOADS_SIZE)"
else
  log "WARNING: uploads directory not found at $UPLOADS_PATH — skipping"
fi

# --- manifest -------------------------------------------------------------
# Written last, so its presence is the signal that the backup finished. A
# directory without one is a partial backup and must not be trusted.
cat > "$DEST/manifest.txt" <<EOF
created_at=$(date -Iseconds)
host=$(hostname)
git_commit=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
uploads_path=$UPLOADS_PATH
database_dump=database.dump
uploads_archive=$([ -f "$DEST/uploads.tar.gz" ] && echo uploads.tar.gz || echo none)
EOF

# --- off-box copy ---------------------------------------------------------
# A backup sitting on the machine it is protecting is not a backup. Configure
# an rclone remote (e.g. an ArvanCloud object-storage bucket) and set
# BACKUP_REMOTE to have each run pushed off the server.
if [ -n "${BACKUP_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    log "copying to $BACKUP_REMOTE"
    rclone copy "$DEST" "$BACKUP_REMOTE/$TIMESTAMP" --transfers 4
    log "off-box copy complete"
  else
    log "WARNING: BACKUP_REMOTE is set but rclone is not installed — kept local only"
  fi
else
  log "WARNING: BACKUP_REMOTE is not set — this backup exists only on this machine"
fi

# --- retention ------------------------------------------------------------
log "pruning local backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" \
  -exec rm -rf {} + 2>/dev/null || true

log "done: $DEST"
