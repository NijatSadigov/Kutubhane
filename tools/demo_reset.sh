#!/usr/bin/env bash
# Put the demo back how demo_snapshot.sh found it. Meant for a nightly cron.
#
#   DATABASE_URL=postgres://user:pass@localhost/school_library \
#   KUTUBHANE_DEMO=yes ./demo_reset.sh
#
# THIS DESTROYS THE DATABASE IT POINTS AT. Two things have to be true before it
# will do anything, because a reset script and a real school's library on the
# same machine is how a year of circulation history disappears:
#
#   1. KUTUBHANE_DEMO=yes must be set in the environment. A real deployment
#      never has it, so a misaimed DATABASE_URL stops here.
#   2. A snapshot must exist. demo_snapshot.sh writes a TAKEN_AT marker beside
#      it; without one there is nothing to restore to and nothing is dropped.
#
# The app is stopped around the restore. Dropping a schema out from under live
# connections is the kind of thing that works until the night it does not, and
# a demo box has nobody awake to notice.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAP_DIR="${SNAP_DIR:-$ROOT/demo-snapshot}"
UPLOADS="${UPLOADS:-$ROOT/school-library-system/uploads}"
SERVICE="${SERVICE:-kutubhane}"   # systemd unit; empty to skip the stop/start

if [ "${KUTUBHANE_DEMO:-}" != "yes" ]; then
  echo "refusing: KUTUBHANE_DEMO is not set to yes." >&2
  echo "This script drops a database. It only runs where that is the point." >&2
  exit 1
fi
if [ ! -f "$SNAP_DIR/TAKEN_AT" ] || [ ! -f "$SNAP_DIR/demo-snapshot.dump" ]; then
  echo "refusing: no snapshot in $SNAP_DIR — run demo_snapshot.sh first." >&2
  exit 1
fi
: "${DATABASE_URL:?set DATABASE_URL}"

echo "restoring the demo to its state of $(cat "$SNAP_DIR/TAKEN_AT")"

if [ -n "$SERVICE" ]; then
  echo "→ stopping $SERVICE"
  systemctl stop "$SERVICE"
fi

echo "→ dropping and recreating the schema"
psql --quiet --no-psqlrc "$DATABASE_URL" \
     -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

echo "→ restoring the database"
pg_restore --no-owner --no-privileges --dbname "$DATABASE_URL" \
           "$SNAP_DIR/demo-snapshot.dump"

if [ -f "$SNAP_DIR/demo-snapshot-uploads.tgz" ]; then
  echo "→ restoring uploads"
  rm -rf "$UPLOADS"
  tar -xzf "$SNAP_DIR/demo-snapshot-uploads.tgz" -C "$(dirname "$UPLOADS")"
fi

if [ -n "$SERVICE" ]; then
  echo "→ starting $SERVICE"
  systemctl start "$SERVICE"
fi

echo "done."
