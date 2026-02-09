#!/bin/bash
# Seed sample data for development
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Seeding RecViz with sample data ==="

SUPERSET_URL="${RECVIZ_SUPERSET_URL:-http://localhost:8088}"
BACKEND_URL="http://localhost:8000"

# Wait for Superset to be ready
echo "Waiting for Superset at $SUPERSET_URL..."
until curl -sf "$SUPERSET_URL/health" > /dev/null 2>&1; do
    sleep 2
done
echo "Superset ready."

# Get Superset auth token
echo "Authenticating with Superset..."
TOKEN=$(curl -sf "$SUPERSET_URL/api/v1/security/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin","provider":"db"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ]; then
    echo "Error: Failed to authenticate with Superset."
    exit 1
fi
echo "Authenticated."

AUTH_HEADER="Authorization: Bearer $TOKEN"

# Register a sample SQLite database (for dev without Oracle)
echo "Registering sample database..."
curl -sf "$SUPERSET_URL/api/v1/database/" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d '{
        "database_name": "RecViz Sample",
        "sqlalchemy_uri": "sqlite:////app/sample.db",
        "expose_in_sqllab": true,
        "allow_run_async": true,
        "allow_csv_upload": true
    }' > /dev/null 2>&1 || echo "  (database may already exist)"

# Run Python seed script for dashboard configs
echo "Running Python seed script..."
cd "$PROJECT_ROOT/backend"
python3 -m app.seed

echo ""
echo "=== Seeding complete ==="
