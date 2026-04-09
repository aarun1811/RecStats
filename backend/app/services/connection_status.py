"""In-memory connection status tracker for database health."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

ConnectionState = Literal["connected", "unreachable", "untested"]


class ConnectionStatusTracker:
    """Track database connection status in-memory.

    Status resets to 'untested' on process restart, which is correct
    behavior -- we don't know if databases are reachable until tested.
    """

    def __init__(self) -> None:
        self._status: dict[str, dict] = {}

    def get_status(self, connection_id: str) -> dict:
        return self._status.get(connection_id, {"status": "untested", "last_tested": None})

    def mark_connected(self, connection_id: str) -> None:
        self._status[connection_id] = {
            "status": "connected",
            "last_tested": datetime.now(timezone.utc).isoformat(),
        }

    def mark_unreachable(self, connection_id: str) -> None:
        self._status[connection_id] = {
            "status": "unreachable",
            "last_tested": datetime.now(timezone.utc).isoformat(),
        }

    def remove(self, connection_id: str) -> None:
        self._status.pop(connection_id, None)
