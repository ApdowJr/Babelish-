#!/usr/bin/env bash
# Provision (idempotently) a THROWAWAY local Postgres for `npm run smoke:local`.
# Prints the DATABASE_URL on the last stdout line. Local-only fixture
# credentials — never real secrets, never pointed at any cloud database.
set -euo pipefail

DB=babelish_smoke
USER=babelish_smoke
PASS=smoke-local-only

if ! pg_isready -h 127.0.0.1 -p 5432 -q; then
  # Start the local cluster if it isn't running (best effort across distros).
  if command -v service >/dev/null 2>&1; then
    service postgresql start >/dev/null 2>&1 || true
  elif command -v pg_ctlcluster >/dev/null 2>&1; then
    VERSION="$(ls /etc/postgresql 2>/dev/null | head -1 || true)"
    [ -n "$VERSION" ] && pg_ctlcluster "$VERSION" main start >/dev/null 2>&1 || true
  fi
  for _ in $(seq 1 20); do
    pg_isready -h 127.0.0.1 -p 5432 -q && break
    sleep 0.5
  done
fi

pg_isready -h 127.0.0.1 -p 5432 -q || {
  echo "smoke-db: local Postgres is not reachable on 127.0.0.1:5432" >&2
  exit 1
}

psql_check() {
  PGPASSWORD="$PASS" psql -h 127.0.0.1 -U "$USER" -d "$DB" -tAc 'select 1' 2>/dev/null || true
}

if [ "$(psql_check)" != "1" ]; then
  su postgres -c "psql -qc \"do \\\$\\\$ begin if not exists (select from pg_roles where rolname='$USER') then create role $USER login password '$PASS' superuser; end if; end \\\$\\\$;\"" >/dev/null
  su postgres -c "psql -tAc \"select 1 from pg_database where datname='$DB'\"" | grep -q 1 ||
    su postgres -c "createdb -O $USER $DB" >/dev/null
fi

[ "$(psql_check)" = "1" ] || { echo "smoke-db: cannot connect as $USER" >&2; exit 1; }

echo "postgres://$USER:$PASS@127.0.0.1:5432/$DB"
