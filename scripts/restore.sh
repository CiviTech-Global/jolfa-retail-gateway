#!/usr/bin/env bash
#
# Restore Jolfa Retail Gateway from a backup produced by scripts/backup.sh.
#
# A backup nobody has restored is a hypothesis, not a backup. Rehearse this
# against a scratch database before you need it:
#
#   scripts/restore.sh /var/backups/jolfa/20260827-033000 \
#     --database-url postgresql://postgres:pass@localhost:5432/jolfa_restore_test
#
# Usage:
#   scripts/restore.sh <backup-dir> [--database-url URL] [--uploads-path PATH] [--yes]
#
# DESTRUCTIVE: drops and recreates every object in the target database. The
# script refuses to run without an explicit confirmation unless --yes is passed.

set -euo pipefail

log()  { printf '[restore] %s %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"; }
fail() { printf '[restore] ERROR: %s\n' "$*" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/Jolfa-Server"
ENV_FILE="${ENV_FILE:-$SERVER_DIR/.env}"

BACKUP_PATH="${1:-}"
[ -n "$BACKUP_PATH" ] || fail "usage: scripts/restore.sh <backup-dir> [--database-url URL] [--uploads-path PATH] [--yes]"
shift

DATABASE_URL_OVERRIDE=""
UPLOADS_OVERRIDE=""
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --database-url) DATABASE_URL_OVERRIDE="${2:-}"; shift 2 ;;
    --uploads-path) UPLOADS_OVERRIDE="${2:-}"; shift 2 ;;
    --yes|-y)       ASSUME_YES=1; shift ;;
    *)              fail "unknown option: $1" ;;
  esac
done

[ -d "$BACKUP_PATH" ] || fail "no such backup directory: $BACKUP_PATH"

# The manifest is written last by backup.sh, so its absence means the backup
# was interrupted and is not safe to restore from.
[ -f "$BACKUP_PATH/manifest.txt" ] || \
  fail "no manifest.txt in $BACKUP_PATH — this backup is incomplete, refusing to restore"

[ -f "$BACKUP_PATH/database.dump" ] || fail "no database.dump in $BACKUP_PATH"

read_env() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | sed 's/^"//; s/"$//'
}

DATABASE_URL="${DATABASE_URL_OVERRIDE:-$(read_env DATABASE_URL)}"
[ -n "$DATABASE_URL" ] || fail "no database URL — pass --database-url or set it in $ENV_FILE"

# Same as backup.sh: strip Prisma-only query parameters that libpq rejects.
PG_URL="$(printf '%s' "$DATABASE_URL" \
  | sed -E 's/([?&])(schema|connection_limit|pool_timeout|pgbouncer|socket_timeout|statement_cache_size)=[^&]*//g' \
  | sed -E 's/\?&/?/; s/[?&]$//')"

if [ -n "$UPLOADS_OVERRIDE" ]; then
  UPLOADS_PATH="$UPLOADS_OVERRIDE"
else
  UPLOAD_DIR_VALUE="$(read_env UPLOAD_DIR)"
  UPLOAD_DIR_VALUE="${UPLOAD_DIR_VALUE:-uploads}"
  case "$UPLOAD_DIR_VALUE" in
    /*) UPLOADS_PATH="$UPLOAD_DIR_VALUE" ;;
    *)  UPLOADS_PATH="$SERVER_DIR/$UPLOAD_DIR_VALUE" ;;
  esac
fi

echo
echo "  Backup:   $BACKUP_PATH"
sed 's/^/    /' "$BACKUP_PATH/manifest.txt"
echo "  Database: ${DATABASE_URL%%\?*}"
echo "  Uploads:  $UPLOADS_PATH"
echo
echo "  This DROPS every existing object in that database."
echo

if [ "$ASSUME_YES" -ne 1 ]; then
  printf '  Type "restore" to continue: '
  read -r answer
  [ "$answer" = "restore" ] || fail "aborted"
fi

log "restoring database"
# --clean --if-exists drops existing objects first, so a restore over a
# populated database is idempotent rather than a merge.
pg_restore --dbname="$PG_URL" --clean --if-exists --no-owner --no-privileges \
  "$BACKUP_PATH/database.dump"
log "database restored"

if [ -f "$BACKUP_PATH/uploads.tar.gz" ]; then
  log "restoring uploads to $UPLOADS_PATH"
  # The archive holds bare contents, so it unpacks straight into the target
  # directory whatever that directory is called.
  mkdir -p "$UPLOADS_PATH"
  # Existing files are replaced; files added since the backup are left alone.
  tar -xzf "$BACKUP_PATH/uploads.tar.gz" -C "$UPLOADS_PATH"
  log "uploads restored"
else
  log "WARNING: backup contains no uploads archive — product images will be missing"
fi

echo
log "restore complete"
log "verify before trusting it: check the product count and open a product image"
