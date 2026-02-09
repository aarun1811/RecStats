#!/bin/bash
# One-command dev setup
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== RecViz Development Environment Setup ==="

# Check prerequisites
command -v node >/dev/null || { echo "Error: Node.js is required but not installed."; exit 1; }
command -v python3 >/dev/null || { echo "Error: Python 3.12+ is required but not installed."; exit 1; }
command -v docker >/dev/null || { echo "Error: Docker is required but not installed."; exit 1; }

echo "Prerequisites OK"

# Copy env file if not present
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    echo "Created .env from .env.example"
fi

# Start infrastructure services
echo "Starting Redis and PostgreSQL..."
docker compose -f "$PROJECT_ROOT/infrastructure/docker-compose.yml" up -d redis postgres

# Wait for services
echo "Waiting for PostgreSQL..."
until docker compose -f "$PROJECT_ROOT/infrastructure/docker-compose.yml" exec -T postgres pg_isready -U recviz; do
    sleep 1
done
echo "PostgreSQL ready."

echo "Waiting for Redis..."
until docker compose -f "$PROJECT_ROOT/infrastructure/docker-compose.yml" exec -T redis redis-cli ping | grep -q PONG; do
    sleep 1
done
echo "Redis ready."

# Frontend setup
echo "Setting up frontend..."
cd "$PROJECT_ROOT/frontend"
npm install
cp -n .env.example .env 2>/dev/null || true

# Backend setup
echo "Setting up backend..."
cd "$PROJECT_ROOT/backend"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -e ".[dev]"

echo ""
echo "=== Development environment ready! ==="
echo "Run 'make dev' from $PROJECT_ROOT to start all services."
