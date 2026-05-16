#!/bin/bash

set -e

# Apply pending Postgres migrations from migrations/app/. Uses golang-migrate
# (same tool the ClickHouse step below uses), tracking applied state in
# nudgebee.schema_migrations.
#
# URL config notes:
# - The "nudgebee" schema is pre-created here because golang-migrate does not
#   auto-create schemas it doesn't own (it expects you to point at one that
#   exists). IF NOT EXISTS keeps this idempotent across re-runs and existing
#   environments. Putting the tracker in its own schema (rather than public)
#   isolates migration plumbing from application tables.
# - x-migrations-table='"nudgebee"."schema_migrations"' with
#   x-migrations-table-quoted=true lets golang-migrate treat the value as a
#   already-quoted, schema-qualified identifier (driver feature added in v4).
#   Without quoted=true, a dotted name is taken literally and produces a
#   table named "nudgebee.schema_migrations" in public — verified during the
#   cutover test.
# - We do NOT set search_path. The legacy migrations contain hundreds of
#   unqualified `CREATE TABLE foo` statements that rely on falling back to
#   public; anything else (an earlier hdb_catalog-first attempt) caused those
#   to land in the wrong schema and broke V174's qualified-vs-unqualified
#   DROP/CREATE pair.
# - The tracker shape is NOT byte-identical to Hasura CLI's: golang-migrate
#   keeps a single-row "current version + dirty" record; Hasura CLI kept one
#   row per applied migration. We are the sole writer, so this is fine.
echo "Running Postgres migrations (golang-migrate, tracking via nudgebee.schema_migrations)..."

psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "CREATE SCHEMA IF NOT EXISTS nudgebee;"

case "$APP_DATABASE_URL" in
    *\?*) PG_URL_SEP="&" ;;
    *)    PG_URL_SEP="?" ;;
esac
MIGRATE_DB_URL="${APP_DATABASE_URL}${PG_URL_SEP}x-migrations-table=%22nudgebee%22.%22schema_migrations%22&x-migrations-table-quoted=true"

# One-time cutover bootstrap.
#
# On the first golang-migrate run against a database that was previously
# managed by Hasura CLI, the new tracker is empty (or — if a partial first
# run already happened — stuck at version=1665080411172 dirty=true because V0
# tried to CREATE TABLE on tables that already existed). Either way `migrate
# up` will fail. Seed the tracker to whatever Hasura already applied so
# `migrate up` only runs migrations authored after the cutover.
#
# Baseline source: `max(version) FROM hdb_catalog.schema_migrations` —
# Hasura's per-env tracker. Each environment auto-detects its own actual
# highest-applied version, which differs across dev/test/prod because they
# deploy on different cadences.
#
# Fallback: if hdb_catalog.schema_migrations has been dropped already (as it
# was on dev), the operator must set $CUTOVER_BASELINE_OVERRIDE to the
# correct version. We refuse to guess — silently skipping a real unapplied
# migration is worse than failing loudly.
#
# Idempotent: subsequent runs find a clean tracker beyond the baseline and
# skip the bootstrap entirely. Also skips on fresh installs (no public.tenant
# table) so V0..V<N> apply normally.

bootstrap_state=$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 -tAq -c "
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenant') THEN 'skip-fresh-db'
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='nudgebee' AND table_name='schema_migrations') THEN 'bootstrap-virgin'
    WHEN NOT EXISTS (SELECT 1 FROM nudgebee.schema_migrations) THEN 'bootstrap-empty'
    WHEN EXISTS (SELECT 1 FROM nudgebee.schema_migrations WHERE dirty IS TRUE AND version = 1665080411172) THEN 'bootstrap-dirty-v0'
    ELSE 'skip-already-set'
  END;
" | tr -d '[:space:]')

if [[ "$bootstrap_state" == bootstrap-* ]]; then
    # Resolve baseline: prefer hdb_catalog.schema_migrations (Hasura's tracker),
    # fall back to $CUTOVER_BASELINE_OVERRIDE only if that table is gone.
    has_hdb_tracker=$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 -tAq -c "
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='hdb_catalog' AND table_name='schema_migrations'
      );
    " | tr -d '[:space:]')

    detected_baseline=""
    if [ "$has_hdb_tracker" = "t" ]; then
        detected_baseline=$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 -tAq -c "
          SELECT COALESCE(max(version)::text, '') FROM hdb_catalog.schema_migrations;
        " | tr -d '[:space:]')
    fi

    if [ -n "$detected_baseline" ]; then
        BASELINE_VERSION=$detected_baseline
        baseline_source="hdb_catalog.schema_migrations (Hasura's prior tracker)"
    elif [ -n "${CUTOVER_BASELINE_OVERRIDE:-}" ]; then
        BASELINE_VERSION=$CUTOVER_BASELINE_OVERRIDE
        baseline_source="CUTOVER_BASELINE_OVERRIDE env var"
    else
        cat <<MSG >&2

ERROR: cutover bootstrap is needed (state=$bootstrap_state) but no baseline
       version is available.

  - hdb_catalog.schema_migrations is missing or empty (Hasura's tracker has
    been dropped from this database).
  - CUTOVER_BASELINE_OVERRIDE env var is not set.

The bootstrap refuses to guess: silently skipping a real unapplied migration
would be worse than failing here.

Resolution: identify the highest migration version that has already been
applied to this database and set it as the override. Either:

  1. If hdb_catalog.schema_migrations is intact elsewhere (a recent backup
     or another tier at the same code version), read it from there.

  2. Otherwise, inspect the tables on disk and match them to migration files
     in ./migrations/app/. Then set CUTOVER_BASELINE_OVERRIDE to that
     version and re-run the migration Job:

       CUTOVER_BASELINE_OVERRIDE=<version> ./run-migrations.sh

For reference, dev was at V733 (1778653298407) when its hdb_catalog
tracker was dropped — but DO NOT assume test/prod are at the same
version. They almost certainly are not.
MSG
        exit 1
    fi

    echo "Bootstrap (state=$bootstrap_state): pre-migrated database detected."
    echo "Baseline source: $baseline_source"
    echo "Forcing tracker to version $BASELINE_VERSION..."
    migrate -path ./migrations/app -database "$MIGRATE_DB_URL" force "$BASELINE_VERSION"
else
    echo "Bootstrap not needed (state=$bootstrap_state); proceeding with normal migrate up."
fi

migrate -path ./migrations/app -database "$MIGRATE_DB_URL" up

echo "Loading Agent Playbook..."
curl -X POST $SERVICE_API_SERVER_URL/hasura-cron -d '{
        "comment": "Load Agent Playbook",
        "name": "Load Agent Playbook",
        "payload": {}
    }' -v -H "X-ACTION-TOKEN: $ACTION_API_SERVER_TOKEN"

if [[ $CLICKHOUSE_ENABLED == "true" ]]; then
    click_hostname="${CLICKHOUSE_HOST##*://}"
    click_hostname="${click_hostname%%:*}"
    echo "running clickhouse migrations on host: $click_hostname"
    migrate -path ./migrations/clickhouse -database "clickhouse://$click_hostname:9000?username=$CLICKHOUSE_USER&password=$CLICKHOUSE_PASSWORD&database=default&x-multi-statement=true&x-cluster-name=default" up
fi

echo "Running RabbitMQ migrations..."
until curl -sf -u "$RABBIT_MQ_USERNAME:$RABBIT_MQ_PASSWORD" "http://$RABBIT_MQ_HOST:15672/api/overview" > /dev/null; do
  echo "Waiting for RabbitMQ management API..."
  sleep 3
done
for script in ./migrations/rabbitmq/*.sh; do
  echo "running: $script"
  sh "$script"
done
