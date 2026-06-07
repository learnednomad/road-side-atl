#!/bin/sh
set -e

APP_ENV="${APP_ENV:-production}"

echo "========================================"
echo "RoadSide GA - Docker Startup"
echo "  APP_ENV=${APP_ENV}"
echo "  SEED_DB=${SEED_DB:-false}"
echo "========================================"

# Short delay to ensure database is fully ready
echo "Waiting for database to be fully ready..."
sleep 3

# If SEED_DB is true, drop all tables so migrations + seed start fresh
if [ "${SEED_DB:-false}" = "true" ]; then
  # Guard: never wipe a production database without explicit authorization.
  if [ "${APP_ENV}" = "production" ] && [ "${ALLOW_PROD_SEED:-false}" != "true" ]; then
    echo "ERROR: SEED_DB=true in production without ALLOW_PROD_SEED=true."
    echo "This would DROP ALL TABLES and wipe production data. Aborting."
    exit 1
  fi
  echo "SEED_DB=true: Resetting database for clean seed..."
  node -e "
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
async function reset() {
  // Drop all tables in public schema and drizzle schema
  await sql\`DROP SCHEMA IF EXISTS drizzle CASCADE\`;
  await sql\`DROP SCHEMA public CASCADE\`;
  await sql\`CREATE SCHEMA public\`;
  await sql\`GRANT ALL ON SCHEMA public TO PUBLIC\`;
  console.log('Database reset complete.');
  await sql.end();
}
reset().catch(e => { console.error('DB reset error:', e.message); process.exit(1); });
" 2>&1
fi

# Apply database schema
if [ "${SEED_DB:-false}" = "true" ]; then
  # Fresh DB after reset: push schema directly (avoids migration conflicts)
  echo "Pushing schema to fresh database..."
  if npx drizzle-kit push --force 2>&1; then
    echo "Schema push completed successfully!"
  else
    echo "ERROR: Schema push failed. Aborting startup (fail-closed)."
    exit 1
  fi

  echo "Seeding database (APP_ENV=${APP_ENV})..."
  if APP_ENV="${APP_ENV}" npx tsx db/seed.ts 2>&1; then
    echo "Database seeded successfully!"
  else
    echo "ERROR: Seed failed. Aborting startup (fail-closed)."
    exit 1
  fi
else
  # ONE-TIME cutover: bring an existing, push-provisioned database (e.g. the live
  # prod DB, which had NO migration history) onto the squashed migration baseline.
  # Because such a DB may be missing the newest objects, we first `push` to sync
  # the schema to the baseline, then mark the baseline as applied so the upcoming
  # `migrate` skips it. Enable for a SINGLE deploy via DB_ADOPT_BASELINE=true,
  # then remove the var. Fresh DBs do NOT need this — migrate builds the baseline.
  if [ "${DB_ADOPT_BASELINE:-false}" = "true" ]; then
    echo "DB_ADOPT_BASELINE=true: syncing schema to baseline (push) + marking applied..."
    if ! npx drizzle-kit push --force 2>&1; then
      echo "ERROR: schema sync (push) failed. Aborting startup (fail-closed)."
      exit 1
    fi
    if ! node db/baseline-adopt.cjs 2>&1; then
      echo "ERROR: baseline adoption failed. Aborting startup (fail-closed)."
      exit 1
    fi
  fi

  # Apply migrations. Fresh DBs get the full schema from the baseline; adopted
  # DBs skip the baseline and apply only newer migrations.
  echo "Running database migrations..."
  if npx drizzle-kit migrate 2>&1; then
    echo "Migrations completed successfully!"
  else
    echo "ERROR: Migrations failed. Aborting startup (fail-closed)."
    echo "  (An existing DB with no migration history needs a one-time"
    echo "   DB_ADOPT_BASELINE=true deploy to adopt the baseline.)"
    exit 1
  fi
fi

# Start the server
echo "Starting Next.js server..."
echo "Server will be available at http://0.0.0.0:${PORT:-3000}"
exec node server.js
