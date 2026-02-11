#!/bin/sh
set -e

echo "========================================"
echo "RoadSide ATL - Docker Startup"
echo "========================================"

# Short delay to ensure database is fully ready
echo "Waiting for database to be fully ready..."
sleep 3

# Ensure drizzle migration tracking schema and table exist
echo "Ensuring migration tracking is set up..."
PGPASSWORD="${DATABASE_URL#*://}" # extract from URL
# Use node to run a quick DB setup since we have it available
node -e "
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
async function setup() {
  // Create drizzle schema and migrations table if they don't exist
  await sql\`CREATE SCHEMA IF NOT EXISTS drizzle\`.catch(() => {});
  await sql\`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
  )\`.catch(() => {});

  // If migrating from drizzle-kit push: seed prior migrations so only new ones run
  const rows = await sql\`SELECT count(*)::int as cnt FROM drizzle.__drizzle_migrations\`;
  if (rows[0].cnt === 0) {
    // Check if tables already exist (from previous push-based deployments)
    const tables = await sql\`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users'\`;
    if (tables.length > 0) {
      console.log('Seeding migration journal with previously applied migrations...');
      await sql\`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
        ('0000_brainy_mysterio', 1770256957835),
        ('0001_pretty_ogun', 1770265122442),
        ('0002_numerous_peter_parker', 1770380674855)\`;
      console.log('Seeded 3 prior migrations.');
    }
  }
  await sql.end();
}
setup().catch(e => { console.error('Migration setup error:', e.message); process.exit(0); });
" 2>&1

# Run database migrations
echo "Running database migrations..."
if npx drizzle-kit migrate 2>&1; then
  echo "Migrations completed successfully!"
else
  echo "Warning: Migrations may have failed, but continuing..."
fi

# Start the server
echo "Starting Next.js server..."
echo "Server will be available at http://0.0.0.0:${PORT:-3000}"
exec node server.js
