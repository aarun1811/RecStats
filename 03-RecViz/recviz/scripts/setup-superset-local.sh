#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/../.venv"
export SUPERSET_CONFIG_PATH="$SCRIPT_DIR/../superset/superset_config_local.py"

# Ensure venv is active
source "$VENV_DIR/bin/activate"

# Install Oracle driver (needed for prod, harmless for local)
pip install oracledb 2>/dev/null || true

# Create metadata directory
mkdir -p ~/.superset

# Idempotent — skip heavy init if already done
if [ ! -f ~/.superset/superset_local.db ]; then
    echo "First-time setup — initializing Superset..."
    superset db upgrade
    superset fab create-admin \
        --username admin \
        --firstname Admin \
        --lastname User \
        --email admin@recviz.local \
        --password admin || true
    superset init
else
    echo "Superset already initialized. Running migrations only..."
    superset db upgrade
fi

echo ""
echo "Superset initialized. Start with:"
echo "  SUPERSET_CONFIG_PATH=$SUPERSET_CONFIG_PATH $VENV_DIR/bin/superset run -p 8088"
echo ""
echo "IMPORTANT: Generate the seed database BEFORE starting FastAPI:"
echo "  python scripts/generate-seed-db.py"
