#!/bin/sh
set -e

echo "========================================"
echo "RoadSide ATL - Docker Startup"
echo "========================================"

# Short delay to ensure database is fully ready
echo "Waiting for database to be fully ready..."
sleep 3

# If SEED_DB is true, drop all tables so migrations + seed start fresh
if [ "${SEED_DB:-false}" = "true" ]; then
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
    echo "Warning: Schema push may have failed, but continuing..."
  fi

  echo "Seeding database with demo data..."
  if npx tsx db/seed.ts 2>&1; then
    echo "Database seeded successfully!"
  else
    echo "Warning: Seed may have failed, but continuing..."
  fi
else
  # Production: use migrations for safe incremental updates
  echo "Running database migrations..."
  if npx drizzle-kit migrate 2>&1; then
    echo "Migrations completed successfully!"
  else
    echo "Warning: Migrations may have failed, but continuing..."
  fi
fi

# Start the server
echo "Starting Next.js server..."
echo "Server will be available at http://0.0.0.0:${PORT:-3000}"
exec node server.js
