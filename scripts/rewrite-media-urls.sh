#!/usr/bin/env bash
#
# Rewrites the origin in every stored media URL. Run this during the switch from
# the bare IP to the domain, in the same maintenance window as nginx.yml and
# deploy.yml.
#
# WHY THIS EXISTS
#
# Uploaded media is stored as an ABSOLUTE url, built from APP_URL at upload time:
#
#     url: `${env.APP_URL}${env.PUBLIC_UPLOAD_PATH}/${filename}`
#
# So every row written while the site ran on http://<ip> carries that origin
# forever. Serving the site from https://araspro.ir turns each one into an
# insecure request from a secure page; browsers block them silently. The symptom
# is a working site with no images anywhere and nothing in the server logs,
# because the requests never leave the browser.
#
# Changing APP_URL fixes only FUTURE uploads. Existing rows need this.
#
# USAGE
#
#   ./rewrite-media-urls.sh --from http://198.51.100.10 --to https://araspro.ir
#
# Dry run by default: it prints what it would change and touches nothing.
# Add --apply to actually write, which happens inside a single transaction.
#
#   ./rewrite-media-urls.sh --from ... --to ... --apply
#
set -euo pipefail

DB="${DB:-jolfa}"
PSQL_BIN="${PSQL_BIN:-/usr/pgsql-16/bin/psql}"   # PGDG path on AlmaLinux/RHEL
FROM=""
TO=""
APPLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)  FROM="$2"; shift 2 ;;
    --to)    TO="$2";   shift 2 ;;
    --apply) APPLY=1;   shift ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$FROM" || -z "$TO" ]]; then
  echo "error: both --from and --to are required" >&2
  echo "example: $0 --from http://198.51.100.10 --to https://araspro.ir" >&2
  exit 2
fi

# A trailing slash in --from would leave a doubled slash behind in every rewritten
# URL, which resolves but looks broken and breaks exact-match comparisons.
FROM="${FROM%/}"
TO="${TO%/}"

if [[ "$FROM" == "$TO" ]]; then
  echo "error: --from and --to are identical; nothing to do" >&2
  exit 2
fi

if [[ ! -x "$PSQL_BIN" ]]; then
  echo "error: psql not found at $PSQL_BIN (set PSQL_BIN=...)" >&2
  exit 1
fi

psql_run() { sudo -u postgres "$PSQL_BIN" -d "$DB" -v ON_ERROR_STOP=1 "$@"; }

# The columns are DISCOVERED, not listed.
#
# The first version of this script carried a hand-written list taken from the
# Prisma schema — product_images.url, categories.image_url, banners.image_url,
# settings.value. It missed homepage_sections.config, a jsonb column whose
# document embeds the hero-carousel image URLs, so the slider broke after the
# cutover while everything on the list was fine. A list of tables someone
# remembered is exactly the wrong tool here: what matters is which columns
# actually contain the string, and the database can answer that directly.
#
# Every text-ish and json-ish column in the public schema is searched. Audit and
# webhook payload columns are excluded: they are historical records of what was
# sent or received at the time, and rewriting them would falsify the log.
EXCLUDED_TABLES="audit_logs|webhook_deliveries|notifications|payments"

discover() {
  sudo -u postgres "$PSQL_BIN" -d "$DB" -tAF'|' -c "
    SELECT table_name, column_name, data_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type IN ('text','character varying','json','jsonb')
       AND table_name !~ '^($EXCLUDED_TABLES)$'
     ORDER BY table_name, column_name"
}

# Builds the WHERE/SET fragments for one column, since a json column has to be
# cast to text to be searched and cast back to be written.
expr_for() {
  case "$1" in
    json|jsonb) printf '%s::text' "$2" ;;
    *)          printf '%s' "$2" ;;
  esac
}
cast_back() {
  case "$1" in
    json|jsonb) printf '::%s' "$1" ;;
    *)          printf '' ;;
  esac
}

echo "Rewriting media origins in database '$DB'"
echo "  from : $FROM"
echo "  to   : $TO"
echo "  mode : $([[ $APPLY -eq 1 ]] && echo 'APPLY (writes)' || echo 'DRY RUN (no writes)')"
echo

total=0
HITS=()
while IFS='|' read -r table column dtype; do
  [[ -n "$table" ]] || continue
  expr="$(expr_for "$dtype" "$column")"
  count=$(psql_run -tAc \
    "SELECT count(*) FROM \"$table\" WHERE $expr LIKE '%${FROM}%'" 2>/dev/null || echo "ERR")
  [[ "$count" == "ERR" || "$count" == "0" ]] && continue

  printf "  %-20s %-14s %-9s %s row(s)\n" "$table" "$column" "$dtype" "$count"
  psql_run -tAc "SELECT '      ' || substring($expr from '${FROM}[^\"'' ]*') \
                   FROM \"$table\" WHERE $expr LIKE '%${FROM}%' LIMIT 2"
  HITS+=("$table|$column|$dtype")
  total=$((total + count))
done < <(discover)

echo
if [[ "$total" == "0" ]]; then
  echo "Nothing anywhere matches '$FROM'. Either the switch already ran, or --from is wrong."
  exit 0
fi

if [[ $APPLY -eq 0 ]]; then
  echo "$total row(s) across ${#HITS[@]} column(s) would change. Re-run with --apply."
  echo "Take a backup first:  ansible-playbook -i inventory.ini backup.yml"
  exit 0
fi

echo "Applying $total change(s) across ${#HITS[@]} column(s) in one transaction..."

# One transaction for every column: a partial rewrite would leave the site split
# across two origins, which is worse than not starting.
{
  echo "BEGIN;"
  for hit in "${HITS[@]}"; do
    IFS='|' read -r table column dtype <<<"$hit"
    expr="$(expr_for "$dtype" "$column")"
    back="$(cast_back "$dtype")"
    echo "UPDATE \"$table\" SET \"$column\" = replace($expr, '$FROM', '$TO')$back WHERE $expr LIKE '%${FROM}%';"
  done
  echo "COMMIT;"
} | psql_run -q

echo "Done. Verify before declaring victory:"
echo "  curl -s $TO/api/v1/products?limit=3 | grep -o '\"url\":\"[^\"]*\"' | head"
echo "Then open the storefront and confirm images render."
