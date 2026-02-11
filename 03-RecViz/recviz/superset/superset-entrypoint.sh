#!/bin/bash
set -e

echo "Waiting for Postgres..."
while ! pg_isready -h "$POSTGRES_HOST" -U recviz -q 2>/dev/null; do
  sleep 1
done
echo "Postgres is ready."

echo "Running database migrations..."
superset db upgrade

echo "Creating admin user (skips if exists)..."
superset fab create-admin \
  --username admin \
  --firstname Admin \
  --lastname User \
  --email admin@recviz.local \
  --password admin || true

echo "Initializing Superset..."
superset init

echo "Starting Superset on port 8088..."
exec superset run -h 0.0.0.0 -p 8088
