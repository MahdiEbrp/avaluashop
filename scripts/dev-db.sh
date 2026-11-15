#!/usr/bin/env bash
#
# Idempotent local database for the dev server and the test suites.
#
# The cluster lives outside the repository on purpose. Persisting a data
# directory through a workspace snapshot does not work: empty directories such
# as pg_notify/ are not carried over, and postgres then refuses to start with
# "could not open directory pg_notify". So the cluster is treated as disposable
# and rebuilt on demand — cheap, because the seed is the only source of data.
# Point PGDATA_LOCAL somewhere else if you want it elsewhere.
#
#   ./scripts/dev-db.sh          # up + schema + seed (only if empty)
#   ./scripts/dev-db.sh status   # is it running?
#   ./scripts/dev-db.sh stop
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="${PGDATA_LOCAL:-/tmp/avaluashop-pgdata}"
PGPORT=5432
PGUSER_ROLE="shop"
PGPASSWORD_ROLE="shop"
PGDATABASE="avaluashop"
LOG="${PGDATA}.log"
URL="postgresql://${PGUSER_ROLE}:${PGPASSWORD_ROLE}@127.0.0.1:${PGPORT}/${PGDATABASE}?schema=public"

say() { printf '\033[1m·\033[0m %s\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

find_pgbin() {
   local found
   found="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
   [ -n "$found" ] || return 1
   echo "$found"
}

install_postgres() {
   command -v apt-get >/dev/null || fail "postgresql is not installed and apt-get is unavailable"
   say "installing postgresql (one time, ~20s)"
   sudo apt-get update -qq >/dev/null
   sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib >/dev/null
}

running() { pg_isready -h 127.0.0.1 -p "$PGPORT" -q 2>/dev/null; }

boot() {
   PGBIN="$(find_pgbin || true)"
   if [ -z "${PGBIN:-}" ]; then
      install_postgres
      PGBIN="$(find_pgbin)" || fail "postgresql install did not produce binaries"
   fi
   say "postgres binaries: $PGBIN"

   if [ ! -s "$PGDATA/PG_VERSION" ]; then
      say "initialising a fresh cluster in .pgdata"
      mkdir -p "$PGDATA"
      "$PGBIN/initdb" -D "$PGDATA" -U "$USER" -A trust >/dev/null
   fi

   chmod 700 "$PGDATA"

   if running; then
      say "already accepting connections on ${PGPORT}"
   else
      # A hard stop leaves postmaster.pid behind while the process is gone,
      # which makes pg_ctl refuse to start ("another server might be running").
      if [ -f "$PGDATA/postmaster.pid" ]; then
         local stale_pid
         stale_pid="$(head -1 "$PGDATA/postmaster.pid")"
         if ! kill -0 "$stale_pid" 2>/dev/null; then
            say "clearing stale postmaster.pid (pid $stale_pid is gone)"
            rm -f "$PGDATA/postmaster.pid"
         fi
      fi
      say "starting postgres on 127.0.0.1:${PGPORT}"
      if ! "$PGBIN/pg_ctl" -D "$PGDATA" -l "$LOG" -w -t 30 \
            -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" start >/dev/null 2>&1; then
         say "existing cluster is unusable — rebuilding from scratch"
         tail -3 "$LOG" 2>/dev/null | sed 's/^/    /' || true
         rm -rf "$PGDATA"
         mkdir -p "$PGDATA"
         "$PGBIN/initdb" -D "$PGDATA" -U "$USER" -A trust >/dev/null
         chmod 700 "$PGDATA"
         "$PGBIN/pg_ctl" -D "$PGDATA" -l "$LOG" -w -t 30 \
            -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" start >/dev/null
      fi
   fi

   # role + database are created once; both statements are no-ops afterwards
   psql -h 127.0.0.1 -p "$PGPORT" -U "$USER" -d postgres -tAc \
      "SELECT 1 FROM pg_roles WHERE rolname='$PGUSER_ROLE'" | grep -q 1 ||
      psql -h 127.0.0.1 -p "$PGPORT" -U "$USER" -d postgres -q -c \
         "CREATE ROLE $PGUSER_ROLE LOGIN SUPERUSER PASSWORD '$PGPASSWORD_ROLE'"

   psql -h 127.0.0.1 -p "$PGPORT" -U "$USER" -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" | grep -q 1 ||
      psql -h 127.0.0.1 -p "$PGPORT" -U "$USER" -d postgres -q -c \
         "CREATE DATABASE $PGDATABASE OWNER $PGUSER_ROLE"

   # `grep -c` returns 1 when the table is absent, hence the `|| true`
   local rows
   rows="$(psql -h 127.0.0.1 -p "$PGPORT" -U "$USER" -d "$PGDATABASE" -tAc \
      "SELECT count(*) FROM \"Product\"" 2>/dev/null || true)"
   rows="${rows:-0}"

   if [ "$rows" = "0" ]; then
      say "pushing the Prisma schema"
      ( cd "$ROOT" && DATABASE_URL="$URL" npx prisma db push >/dev/null )
      say "seeding demo data"
      ( cd "$ROOT" && DATABASE_URL="$URL" npx prisma db seed 2>&1 | tail -3 )
   else
      say "already seeded ($rows products)"
   fi

   say "DATABASE_URL=$URL"
}

case "${1:-up}" in
   up)     boot ;;
   status) running && say "up on ${PGPORT}" || { say "down"; exit 1; } ;;
   stop)
      PGBIN="$(find_pgbin || true)"
      [ -n "${PGBIN:-}" ] && [ -s "$PGDATA/PG_VERSION" ] &&
         "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null && say "stopped" ||
         say "nothing to stop"
      ;;
   *) fail "unknown command: $1 (use up|status|stop)" ;;
esac
