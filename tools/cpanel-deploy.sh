#!/usr/bin/env bash
# What cPanel runs when you click Deploy (see .cpanel.yml).
#
# cPanel's Git Version Control clones the repository and runs copy tasks. It
# cannot build: there is no Go on a typical cPanel host, and `npm run build`
# on shared hosting is a good way to be asked to leave. So the build happens
# in GitHub Actions and this fetches what it made.
#
#   git push  →  Actions builds a tarball  →  tag it  →  click Deploy in cPanel
#
# Two things on the server are never touched, because losing either is worse
# than a failed deploy:
#
#   uploads/   the school's own covers and e-books. Not in the tarball, not
#              removed here.
#   .env       the secrets. Written once by hand; this would have no way to
#              put them back.
#
# Usage (cPanel calls the first form):
#   tools/cpanel-deploy.sh                 # newest release
#   tools/cpanel-deploy.sh v1.2.0          # a specific tag, to roll back

set -euo pipefail

REPO="${KUTUBHANE_REPO:-NijatSadigov/Kutubhane}"
APP_DIR="${KUTUBHANE_APP_DIR:-$HOME/kutubhane}"
ASSET="kutubhane-linux-amd64.tar.gz"
TAG="${1:-}"

say() { printf '→ %s\n' "$*"; }

# ---------------------------------------------------------------- which build

if [ -n "${KUTUBHANE_ASSET_URL:-}" ]; then
  # An exact URL, for a mirror, a copy carried in by hand, or a rehearsal of
  # this script before there is a release to point it at.
  URL="$KUTUBHANE_ASSET_URL"
  say "using the URL given"
elif [ -n "$TAG" ]; then
  URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"
  say "rolling to $TAG"
else
  say "finding the newest release of $REPO"
  # No token: the repository is public, and a deploy script is the last place
  # to keep one. If this ever goes private, set GITHUB_TOKEN in the cPanel
  # environment and add: -H "Authorization: Bearer $GITHUB_TOKEN"
  URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" |
        grep -o "https://github.com/$REPO/releases/download/[^\"]*$ASSET" | head -1)
  [ -n "$URL" ] || { echo "no release asset found — has a v* tag been pushed?" >&2; exit 1; }
fi
say "$URL"

# ------------------------------------------------------------------ unpack it

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
curl -fsSL "$URL" -o "$STAGE/$ASSET"
mkdir -p "$STAGE/new"
tar -xzf "$STAGE/$ASSET" -C "$STAGE/new"

# Refuse a tarball that is missing the things that make it one, rather than
# half-replacing a working install with it.
for required in kutubhane dist/index.html; do
  [ -e "$STAGE/new/$required" ] || { echo "the tarball has no $required — stopping" >&2; exit 1; }
done

mkdir -p "$APP_DIR"

# ------------------------------------------------------------------- swap it

# The UI goes in whole, so a file deleted upstream does not linger: build
# beside the live one, then move both in one step each.
if [ -d "$APP_DIR/dist" ]; then rm -rf "$APP_DIR/dist.old"; mv "$APP_DIR/dist" "$APP_DIR/dist.old"; fi
mv "$STAGE/new/dist" "$APP_DIR/dist"

# The binary cannot be overwritten while it is running — "text file busy" — so
# it is moved aside first. The old one stays until the next deploy, which is
# what you copy back if the new one will not start.
for bin in kutubhane createadmin classfix; do
  [ -e "$STAGE/new/$bin" ] || continue
  [ -e "$APP_DIR/$bin" ] && mv -f "$APP_DIR/$bin" "$APP_DIR/$bin.old"
  mv "$STAGE/new/$bin" "$APP_DIR/$bin"
  chmod +x "$APP_DIR/$bin"
done

cp -f "$STAGE/new/.env.example" "$APP_DIR/.env.example" 2>/dev/null || true
mkdir -p "$APP_DIR/uploads/covers" "$APP_DIR/uploads/ebooks"

# ------------------------------------------------------------------ restart it

# keepalive.sh starts it again within the minute if it is not running, so
# stopping it *is* the restart. Nothing here assumes systemd: a shared cPanel
# account has no such thing.
if pgrep -u "$(id -u)" -f "$APP_DIR/kutubhane" >/dev/null 2>&1; then
  say "stopping the running server"
  pkill -u "$(id -u)" -f "$APP_DIR/kutubhane" || true
  sleep 2
fi
if [ -x "$APP_DIR/keepalive.sh" ]; then
  say "starting"
  "$APP_DIR/keepalive.sh"
else
  echo "! $APP_DIR/keepalive.sh is missing — start the server yourself." >&2
  echo "  DEPLOY-CPANEL.md has it." >&2
fi

say "deployed${TAG:+ $TAG}"
