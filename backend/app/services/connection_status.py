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
        self._status: dict[int, dict] = {}

    def get_status(self, superset_id: int) -> dict:
        return self._status.get(superset_id, {"status": "untested", "last_tested": None})

    def mark_connected(self, superset_id: int) -> None:
        self._status[superset_id] = {
            "status": "connected",
            "last_tested": datetime.now(timezone.utc).isoformat(),
        }

    def mark_unreachable(self, superset_id: int) -> None:
        self._status[superset_id] = {
            "status": "unreachable",
            "last_tested": datetime.now(timezone.utc).isoformat(),
        }

    def remove(self, superset_id: int) -> None:
        self._status.pop(superset_id, None)
