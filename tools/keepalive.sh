#!/usr/bin/env bash
# Start the server if it is not running. Meant for a cron line every minute:
#
#   * * * * * $HOME/kutubhane/keepalive.sh >/dev/null 2>&1
#
# This is how you run a long-lived process on a cPanel account, where there is
# no systemd and nothing to put a unit file in. It covers the three ways the
# server stops on shared hosting — the host reboots, the host's process
# reaper kills it, or a deploy stops it on purpose — with the same minute of
# downtime each time.
#
# Copy it next to the binary. The directory is whatever KUTUBHANE_APP_DIR says
# in .cpanel.yml — $HOME/kitabxana as shipped — and the cron line has to export
# the same value, because cron starts with almost no environment:
#
#   * * * * * KUTUBHANE_APP_DIR=$HOME/kitabxana $HOME/kitabxana/keepalive.sh >/dev/null 2>&1
#
# It is not a supervisor. If the binary crashes on startup every time, this
# restarts it every minute and the log fills up; read kutubhane.log before
# assuming the cron is at fault.

set -u

APP_DIR="${KUTUBHANE_APP_DIR:-$HOME/kutubhane}"
cd "$APP_DIR" || exit 1

# -f matches the full command line, so this finds our own server and not
# somebody else's process that happens to share a name. -u keeps it to this
# account, which matters on a shared machine.
if pgrep -u "$(id -u)" -f "$APP_DIR/kutubhane" >/dev/null 2>&1; then
  exit 0
fi

# The secrets live in .env and nothing in the app reads a file — set -a
# exports every assignment for the child, which is the whole trick.
if [ -f "$APP_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$APP_DIR/.env"
  set +a
else
  echo "$(date -Is) no .env beside the binary — starting on insecure defaults" >> "$APP_DIR/kutubhane.log"
fi

# setsid so the server is not in the cron job's process group: without it some
# hosts kill the whole group when the cron run ends, and the thing this script
# just started goes with it.
setsid nohup "$APP_DIR/kutubhane" >> "$APP_DIR/kutubhane.log" 2>&1 < /dev/null &

echo "$(date -Is) started" >> "$APP_DIR/kutubhane.log"
