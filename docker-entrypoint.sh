#!/bin/sh
set -e

echo "========================================"
echo "RoadSide ATL - Docker Startup"
echo "========================================"

# Short delay to ensure database is fully ready
echo "Waiting for database to be fully ready..."
sleep 3

# Run database migrations
echo "Running database migrations..."
if npx drizzle-kit push --force 2>&1; then
  echo "Migrations completed successfully!"
else
  echo "Warning: Migrations may have failed, but continuing..."
fi

# Start the server
echo "Starting Next.js server..."
echo "Server will be available at http://0.0.0.0:${PORT:-3000}"
exec node server.js
