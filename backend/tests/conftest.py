"""Test configuration.

Sets required environment variables before app modules are imported at
collection time. Without this, any test file that imports `app.config`
(directly or transitively) fails collection because `RECVIZ_ENCRYPTION_KEY`
has no default value.
"""

from __future__ import annotations

import os

# Must be set before any `from app...` import happens during collection.
os.environ.setdefault(
    "RECVIZ_ENCRYPTION_KEY",
    "test-encryption-key-do-not-use-in-prod",
)
