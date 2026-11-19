#!/usr/bin/env bash
# Deploy a release onto your own Ubuntu server.
#
#   sudo tools/vps-deploy.sh              # newest release
#   sudo tools/vps-deploy.sh v1.2.0       # a specific tag, to roll back
#
# Simpler than the cPanel version in every way that matters: systemd owns the
# process, so the restart is a restart rather than a kill and a prayer, and
# systemd will also tell us whether the new build actually came up — which
# this checks, rather than reporting success and leaving you to find out.
#
# Three things on the server it will not touch:
#
#   uploads/   the school's covers and e-books. Not in the tarball.
#   .env       the secrets. Written once by hand.
#   the unit   /etc/systemd/system/kutubhane.service — yours to edit.
#
# On a box with other projects: this only ever writes inside $APP_DIR and only
# ever restarts $SERVICE. It does not touch the web server, the firewall, or
# anything it did not install.

set -euo pipefail

REPO="${KUTUBHANE_REPO:-NijatSadigov/Kutubhane}"
APP_DIR="${KUTUBHANE_APP_DIR:-/srv/kutubhane}"
SERVICE="${KUTUBHANE_SERVICE:-kutubhane}"
APP_USER="${KUTUBHANE_USER:-kutubhane}"
ASSET="kutubhane-linux-amd64.tar.gz"
TAG="${1:-}"

say() { printf '→ %s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run with sudo — it restarts a system service"
[ -d "$APP_DIR" ] || die "$APP_DIR does not exist. See DEPLOY-VPS.md §2."

# ---------------------------------------------------------------- which build

if [ -n "${KUTUBHANE_ASSET_URL:-}" ]; then
  URL="$KUTUBHANE_ASSET_URL"; say "using the URL given"
elif [ -n "$TAG" ]; then
  URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"; say "rolling to $TAG"
else
  say "finding the newest release of $REPO"
  URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" |
        grep -o "https://github.com/$REPO/releases/download/[^\"]*$ASSET" | head -1)
  [ -n "$URL" ] || die "no release asset found — has a v* tag been pushed?"
fi

STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
say "downloading"
curl -fsSL "$URL" -o "$STAGE/$ASSET"
mkdir -p "$STAGE/new"
tar -xzf "$STAGE/$ASSET" -C "$STAGE/new"

for required in kutubhane dist/index.html; do
  [ -e "$STAGE/new/$required" ] || die "the tarball has no $required — stopping, nothing changed"
done

# ------------------------------------------------------------------- swap it

say "installing into $APP_DIR"
# Whole-directory swap, so a file deleted upstream does not linger.
rm -rf "$APP_DIR/dist.old"
[ -d "$APP_DIR/dist" ] && mv "$APP_DIR/dist" "$APP_DIR/dist.old"
mv "$STAGE/new/dist" "$APP_DIR/dist"

for bin in kutubhane createadmin classfix; do
  [ -e "$STAGE/new/$bin" ] || continue
  # A running binary cannot be overwritten ("text file busy"); moving it aside
  # is fine, and the old one is what you put back if the new one will not start.
  [ -e "$APP_DIR/$bin" ] && mv -f "$APP_DIR/$bin" "$APP_DIR/$bin.old"
  mv "$STAGE/new/$bin" "$APP_DIR/$bin"
  chmod 0755 "$APP_DIR/$bin"
done

mkdir -p "$APP_DIR/uploads/covers" "$APP_DIR/uploads/ebooks"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/dist" "$APP_DIR/uploads"
chown "$APP_USER:$APP_USER" "$APP_DIR"/kutubhane "$APP_DIR"/createadmin "$APP_DIR"/classfix 2>/dev/null || true

# ---------------------------------------------------------------- restart it

say "restarting $SERVICE"
systemctl restart "$SERVICE"

# Did it actually come up? systemd returns from `restart` as soon as it has
# started the process, which is before the process has decided whether it can
# reach the database. A deploy that reports success and left the site down is
# the thing this whole script exists to avoid.
sleep 3
if ! systemctl is-active --quiet "$SERVICE"; then
  echo >&2
  echo "✗ $SERVICE is not running after the restart. The last 30 log lines:" >&2
  journalctl -u "$SERVICE" -n 30 --no-pager >&2
  echo >&2
  echo "  To go back:  mv $APP_DIR/kutubhane.old $APP_DIR/kutubhane && systemctl restart $SERVICE" >&2
  exit 1
fi

say "$SERVICE is running"
say "deployed${TAG:+ $TAG}"
