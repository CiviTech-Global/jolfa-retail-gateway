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

# Every column that can hold an absolute media URL. Derived from the Prisma
# schema: ProductImage.url, Category.imageUrl, Banner.imageUrl, Setting.value.
# `settings` is matched loosely because a setting's value embeds the URL inside
# a larger string; the others hold the URL alone.
TABLES=(
  "product_images:url:prefix"
  "categories:image_url:prefix"
  "banners:image_url:prefix"
  "settings:value:contains"
)

echo "Rewriting media origins in database '$DB'"
echo "  from : $FROM"
echo "  to   : $TO"
echo "  mode : $([[ $APPLY -eq 1 ]] && echo 'APPLY (writes)' || echo 'DRY RUN (no writes)')"
echo

total=0
for entry in "${TABLES[@]}"; do
  IFS=: read -r table column match <<<"$entry"
  if [[ "$match" == "prefix" ]]; then
    where="$column LIKE '${FROM}%'"
  else
    where="$column LIKE '%${FROM}%'"
  fi

  count=$(psql_run -tAc "SELECT count(*) FROM $table WHERE $where" 2>/dev/null || echo "ERR")
  if [[ "$count" == "ERR" ]]; then
    echo "  $table.$column — table missing or unreadable, skipping"
    continue
  fi
  printf "  %-16s %-11s %s row(s) to change\n" "$table" "$column" "$count"
  total=$((total + count))

  if [[ "$count" != "0" ]]; then
    psql_run -tAc "SELECT '      ' || $column FROM $table WHERE $where LIMIT 3"
  fi
done

echo
if [[ "$total" == "0" ]]; then
  echo "Nothing matches '$FROM'. Either the switch already ran, or --from is wrong."
  exit 0
fi

if [[ $APPLY -eq 0 ]]; then
  echo "$total row(s) would change. Re-run with --apply to write them."
  echo "Take a backup first:  ansible-playbook -i inventory.ini backup.yml"
  exit 0
fi

echo "Applying $total change(s) in one transaction..."

# One transaction for all four tables: a partial rewrite would leave the
# catalogue split across two origins, which is worse than not starting.
{
  echo "BEGIN;"
  for entry in "${TABLES[@]}"; do
    IFS=: read -r table column match <<<"$entry"
    if [[ "$match" == "prefix" ]]; then
      where="$column LIKE '${FROM}%'"
    else
      where="$column LIKE '%${FROM}%'"
    fi
    echo "UPDATE $table SET $column = replace($column, '$FROM', '$TO') WHERE $where;"
  done
  echo "COMMIT;"
} | psql_run -q

echo "Done. Verify before declaring victory:"
echo "  curl -s $TO/api/v1/products?limit=3 | grep -o '\"url\":\"[^\"]*\"' | head"
echo "Then open the storefront and confirm images render."
