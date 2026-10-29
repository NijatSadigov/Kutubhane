#!/usr/bin/env bash
# Take the snapshot that demo_reset.sh restores to.
#
# Run this ONCE, when the demo database looks the way you want visitors to find
# it every morning: the right school, the right books with their covers, the
# right readers mid-way through something. Run it again whenever you change
# what "the way you want it" means.
#
#   DATABASE_URL=postgres://user:pass@localhost/school_library ./demo_snapshot.sh
#
# It writes two files next to each other, because a demo is both rows and
# files: a librarian can delete a cover, and restoring only the database would
# leave the catalogue pointing at images that are gone.
#
#   demo-snapshot.dump      the database, pg_dump custom format
#   demo-snapshot-uploads.tgz   uploads/, covers and e-books
#
# Keep both under version control or in a backup — they ARE the demo.

set -euo pipefail

SNAP_DIR="${SNAP_DIR:-$(cd "$(dirname "$0")/.." && pwd)/demo-snapshot}"
UPLOADS="${UPLOADS:-$(cd "$(dirname "$0")/.." && pwd)/school-library-system/uploads}"
: "${DATABASE_URL:?set DATABASE_URL, e.g. postgres://postgres@localhost/school_library}"

mkdir -p "$SNAP_DIR"

echo "→ dumping the database"
pg_dump --format=custom --no-owner --no-privileges \
        --file "$SNAP_DIR/demo-snapshot.dump" "$DATABASE_URL"

echo "→ archiving uploads"
if [ -d "$UPLOADS" ]; then
  tar -czf "$SNAP_DIR/demo-snapshot-uploads.tgz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"
else
  echo "   (no uploads directory at $UPLOADS — skipping)"
fi

# The marker is what demo_reset.sh checks before it destroys anything. Writing
# it here means a snapshot and the permission to restore it travel together: a
# database nobody has deliberately snapshotted cannot be reset by accident.
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$SNAP_DIR/TAKEN_AT"

echo
echo "Snapshot written to $SNAP_DIR"
ls -la "$SNAP_DIR"
