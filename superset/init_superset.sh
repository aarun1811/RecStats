#!/bin/bash
set -e

echo "Initializing Superset..."

# Upgrade database
superset db upgrade

# Create admin user (idempotent)
superset fab create-admin \
    --username admin \
    --firstname Admin \
    --lastname User \
    --email admin@recviz.local \
    --password admin \
    || true  # Don't fail if already exists

# Init default roles and permissions
superset init

echo "Superset initialization complete."
