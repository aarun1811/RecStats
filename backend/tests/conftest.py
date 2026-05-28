"""Test configuration. Sets required env vars before app modules import at collection."""

from __future__ import annotations

import os

os.environ.setdefault("RECVIZ_ENCRYPTION_KEY", "test-encryption-key-do-not-use-in-prod")
os.environ.setdefault("RECVIZ_DB_URL", "sqlite:///:memory:")
