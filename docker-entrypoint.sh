#!/bin/sh
# Container entrypoint: ensure the (possibly bind-mounted) database directory is
# writable by the unprivileged app user, then drop privileges and exec the app.
#
# The container starts as root only so it can chown a host-mounted volume whose
# ownership we can't control at build time. All application code runs as appuser.
set -e

DB_DIR=/app/src/database

# Only root can chown; when already running as a non-root user (e.g. compose
# `user:` override) skip straight to exec.
if [ "$(id -u)" = "0" ]; then
    mkdir -p "$DB_DIR"
    chown -R appuser:appuser "$DB_DIR"
    exec gosu appuser "$@"
fi

exec "$@"
