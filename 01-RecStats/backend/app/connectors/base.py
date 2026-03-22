"""Base connector interface for all data sources."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional

from app.schemas.datasource import SchemaInfo


@dataclass
class QueryResult:
    """Result of a query execution."""

    columns: list[dict[str, str]]  # [{"name": "col1", "data_type": "string"}, ...]
    data: list[dict[str, Any]]
    row_count: int
    execution_time_ms: float
    truncated: bool = False
    total_count: Optional[int] = None


class BaseConnector(ABC):
    """Abstract base class for data source connectors."""

    def __init__(self, config: dict[str, Any]):
        """Initialize connector with configuration.

        Args:
            config: Connection configuration dictionary
        """
        self.config = config

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str]:
        """Test the connection to the data source.

        Returns:
            Tuple of (success: bool, message: str)
        """
        pass

    @abstractmethod
    async def get_schema(self) -> SchemaInfo:
        """Get schema information from the data source.

        Returns:
            SchemaInfo containing tables and columns
        """
        pass

    @abstractmethod
    async def execute_query(
        self,
        sql: str,
        limit: int = 1000,
        offset: int = 0,
        parameters: Optional[dict[str, Any]] = None,
    ) -> QueryResult:
        """Execute a SQL query against the data source.

        Args:
            sql: SQL query string
            limit: Maximum number of rows to return
            offset: Number of rows to skip
            parameters: Query parameters for parameterized queries

        Returns:
            QueryResult containing columns, data, and metadata
        """
        pass

    async def close(self) -> None:
        """Close any open connections. Override in subclasses if needed."""
        pass
