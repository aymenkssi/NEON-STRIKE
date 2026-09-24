#!/usr/bin/env bash
# Downloads the free DB-IP "IP to Country Lite" database (CC BY 4.0, https://db-ip.com),
# used by the API to know the country of players. The IP address itself is never stored.
# DB-IP publishes a new file each month. Cron example (as root, in the deploy folder):
#   0 5 3 * * cd /opt/apps/neon-strike/deploy && ./geoip-update.sh >> geoip/update.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p geoip
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
# The file of the current month appears on the 1st or 2nd: fall back to last month's.
for month in "$(date +%Y-%m)" "$(date -d "$(date +%Y-%m-01) -1 day" +%Y-%m)"; do
  if curl -fsSL "https://download.db-ip.com/free/dbip-country-lite-$month.mmdb.gz" -o "$tmp"; then
    gunzip -c "$tmp" > geoip/country.mmdb.new
    mv geoip/country.mmdb.new geoip/country.mmdb
    docker compose restart api >/dev/null
    echo "$(date -Is) GeoIP database $month installed"
    exit 0
  fi
done
echo "$(date -Is) GeoIP download failed" >&2
exit 1
