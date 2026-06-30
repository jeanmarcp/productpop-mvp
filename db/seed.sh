#!/usr/bin/env bash
# db/seed.sh - run the seed SQL against the dev Postgres.
# Usage: ./db/seed.sh
# Reads DATABASE_URL from .env (or the default local connection).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set; defaulting to local dev (127.0.0.1:5438, db=productpop, user=productpop)."
  export DATABASE_URL='postgresql://productpop:productpop_dev@127.0.0.1:5438/productpop?schema=public'
  export PGPASSWORD=productpop_dev
fi

# Parse host/port/user/db from DATABASE_URL if PGPASSWORD not already set.
if [ -z "${PGPASSWORD:-}" ]; then
  export PGPASSWORD="$(echo "$DATABASE_URL" | sed -nE 's|.*://[^:]+:([^@]+)@.*|\1|p')"
fi

HOST_PORT="$(echo "$DATABASE_URL" | sed -nE 's|.*@([^/]+)/.*|\1|p')"
HOST="$(echo "$HOST_PORT" | cut -d: -f1)"
PORT="$(echo "$HOST_PORT" | cut -d: -f2)"
DB="$(echo "$DATABASE_URL" | sed -nE 's|.*/([^/?]+).*|\1|p')"
USER="$(echo "$DATABASE_URL" | sed -nE 's|.*://([^:]+):.*|\1|p')"

echo "Seeding $DB on $HOST:$PORT as $USER..."
psql -v ON_ERROR_STOP=1 -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -f db/0001_init.sql
psql -v ON_ERROR_STOP=1 -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -f db/seed.sql

echo
echo "--- waitlist rows ---"
psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
  -c "SELECT id, email, source, created_at FROM waitlist ORDER BY id DESC LIMIT 10;"
