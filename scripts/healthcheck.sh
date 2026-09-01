#!/usr/bin/env bash
#
# Health check for Jolfa / Araspro.
#
# Deliberately runnable in two places, because they catch different failures:
#
#   ON THE SERVER (systemd timer, installed by ansible/roles/monitoring)
#     Catches the application dying while the machine lives — a crashed Node
#     process, a database that stopped accepting connections, nginx failing to
#     reload. This is the common case, and it is the one that currently goes
#     unnoticed for hours.
#
#   ON A LAPTOP OR ANY OTHER MACHINE (cron, or Windows Task Scheduler)
#     Catches the failures the server cannot report on its own: the box being
#     off, the network being unreachable, the provider having an outage. A
#     checker that lives on the thing it is checking cannot tell you the thing
#     is gone.
#
# Run both if you can. Neither replaces the other.
#
# Usage:
#   scripts/healthcheck.sh                       # uses the defaults below
#   HEALTH_URLS="https://shop.example.ir/health" scripts/healthcheck.sh
#
# Configuration, all optional, all via environment:
#   HEALTH_URLS          space-separated URLs to check (first failure wins)
#   HEALTH_TIMEOUT       seconds per request                     (default 10)
#   HEALTH_THRESHOLD     consecutive failures before alerting    (default 2)
#   HEALTH_STATE_DIR     where the failure counter lives         (default /var/lib/jolfa-health, else $TMPDIR)
#   HEALTH_LOG           log file; empty logs to stdout only
#   TELEGRAM_BOT_TOKEN   from @BotFather
#   TELEGRAM_CHAT_ID     your chat or group id
#   HEALTH_WEBHOOK_URL   any endpoint that accepts a JSON POST
#
# Exit codes: 0 healthy, 1 unhealthy. Cron/systemd can key off that too.

set -uo pipefail

HEALTH_URLS="${HEALTH_URLS:-http://127.0.0.1/health http://127.0.0.1:3001/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-10}"
HEALTH_THRESHOLD="${HEALTH_THRESHOLD:-2}"
HEALTH_LOG="${HEALTH_LOG:-}"

# The state directory holds the consecutive-failure counter. Without it every
# run is independent and a single dropped packet pages somebody at 3am.
if [ -n "${HEALTH_STATE_DIR:-}" ]; then
  STATE_DIR="$HEALTH_STATE_DIR"
elif [ -w /var/lib ] || [ -d /var/lib/jolfa-health ]; then
  STATE_DIR=/var/lib/jolfa-health
else
  STATE_DIR="${TMPDIR:-/tmp}/jolfa-health"
fi
mkdir -p "$STATE_DIR" 2>/dev/null || true
FAIL_FILE="$STATE_DIR/consecutive-failures"
ALERTED_FILE="$STATE_DIR/alerted"

log() {
  local line
  line="$(date -Iseconds) $*"
  printf '%s\n' "$line"
  [ -n "$HEALTH_LOG" ] && printf '%s\n' "$line" >> "$HEALTH_LOG" 2>/dev/null
  return 0
}

# Alerts are best-effort and must never fail the check itself: a broken
# notification channel should not look like a broken site.
notify() {
  local text="$1"

  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -sS -m 15 -o /dev/null \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=${text}" \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      || log "WARN could not reach Telegram"
  fi

  if [ -n "${HEALTH_WEBHOOK_URL:-}" ]; then
    # Escape the few characters that would break the JSON body.
    local escaped
    escaped=$(printf '%s' "$text" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
    curl -sS -m 15 -o /dev/null -X POST \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"${escaped}\"}" \
      "$HEALTH_WEBHOOK_URL" \
      || log "WARN could not reach webhook"
  fi
}

read_count() { [ -f "$FAIL_FILE" ] && cat "$FAIL_FILE" 2>/dev/null || echo 0; }

# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------

failed_url=""
failed_detail=""

for url in $HEALTH_URLS; do
  body=$(curl -sS -m "$HEALTH_TIMEOUT" -w '\n%{http_code}' "$url" 2>&1)
  code=$(printf '%s' "$body" | tail -n1)
  payload=$(printf '%s' "$body" | sed '$d')

  if [ "$code" != "200" ]; then
    failed_url="$url"
    failed_detail="HTTP ${code:-none}"
    break
  fi

  # A 200 that is not the health payload means something is answering on that
  # port that is not this application — a default vhost, a captive portal, a
  # proxy error page. Treat it as down rather than as healthy.
  case "$payload" in
    *'"status":"ok"'*) : ;;
    *) failed_url="$url"; failed_detail="200 but unexpected body"; break ;;
  esac
done

HOSTNAME_SHORT="$(hostname 2>/dev/null || echo unknown)"

if [ -z "$failed_url" ]; then
  previous=$(read_count)
  echo 0 > "$FAIL_FILE" 2>/dev/null || true

  if [ -f "$ALERTED_FILE" ]; then
    rm -f "$ALERTED_FILE"
    log "RECOVERED after $previous consecutive failures"
    notify "✅ Araspro is back up (${HOSTNAME_SHORT}) after ${previous} failed checks."
  fi
  exit 0
fi

count=$(( $(read_count) + 1 ))
echo "$count" > "$FAIL_FILE" 2>/dev/null || true
log "DOWN $failed_url — $failed_detail (consecutive: $count)"

# Alert once per outage, not once per check, at the threshold. Recovery clears
# the latch so the next outage alerts again.
if [ "$count" -ge "$HEALTH_THRESHOLD" ] && [ ! -f "$ALERTED_FILE" ]; then
  : > "$ALERTED_FILE"
  notify "🔴 Araspro is DOWN (${HOSTNAME_SHORT})
${failed_url} — ${failed_detail}
${count} consecutive failed checks."
fi

exit 1
