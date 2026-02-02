# Data source connectors module
from typing import Any

from app.connectors.base import BaseConnector, QueryResult
from app.connectors.mock import MockConnector
from app.connectors.sqlite import SQLiteConnector
from app.connectors.oracle import OracleConnector


def get_connector(ds_type: str, config: dict[str, Any]) -> BaseConnector:
    """Factory function to get the appropriate connector for a data source type."""
    connectors = {
        "sqlite": SQLiteConnector,
        "oracle": OracleConnector,
        "mock": MockConnector,  # Keep for development/testing
    }
    connector_cls = connectors.get(ds_type, SQLiteConnector)
    return connector_cls(config)


__all__ = [
    "BaseConnector",
    "QueryResult",
    "MockConnector",
    "SQLiteConnector",
    "OracleConnector",
    "get_connector",
]
