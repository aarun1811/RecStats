"""SQLite connector for local database files."""

import time
from typing import Any, Optional

import aiosqlite

from app.connectors.base import BaseConnector, QueryResult
from app.schemas.datasource import SchemaInfo, TableInfo, ColumnInfo


class SQLiteConnector(BaseConnector):
    """Connector for SQLite databases."""

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._connection: Optional[aiosqlite.Connection] = None

    async def test_connection(self) -> tuple[bool, str]:
        """Test the SQLite database connection."""
        try:
            db_path = self.config.get("database_path", "")
            if not db_path:
                return False, "Database path is required"

            async with aiosqlite.connect(db_path) as db:
                await db.execute("SELECT 1")
            return True, "SQLite connection successful"
        except Exception as e:
            return False, f"SQLite connection failed: {str(e)}"

    async def get_schema(self) -> SchemaInfo:
        """Get schema information from SQLite database."""
        db_path = self.config.get("database_path", "")
        tables: list[TableInfo] = []

        async with aiosqlite.connect(db_path) as db:
            db.row_factory = aiosqlite.Row

            # Get all tables
            cursor = await db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
            table_rows = await cursor.fetchall()

            for table_row in table_rows:
                table_name = table_row["name"]
                columns: list[ColumnInfo] = []

                # Get column info using PRAGMA
                col_cursor = await db.execute(f"PRAGMA table_info({table_name})")
                col_rows = await col_cursor.fetchall()

                for col in col_rows:
                    columns.append(
                        ColumnInfo(
                            name=col["name"],
                            data_type=col["type"] or "TEXT",
                            nullable=not col["notnull"],
                            primary_key=bool(col["pk"]),
                        )
                    )

                # Get row count
                count_cursor = await db.execute(f"SELECT COUNT(*) FROM {table_name}")
                count_row = await count_cursor.fetchone()
                row_count = count_row[0] if count_row else 0

                tables.append(
                    TableInfo(
                        name=table_name,
                        columns=columns,
                        row_count=row_count,
                    )
                )

        return SchemaInfo(tables=tables)

    async def execute_query(
        self,
        sql: str,
        limit: int = 1000,
        offset: int = 0,
        parameters: Optional[dict[str, Any]] = None,
    ) -> QueryResult:
        """Execute a SQL query against the SQLite database."""
        db_path = self.config.get("database_path", "")
        start_time = time.time()

        async with aiosqlite.connect(db_path) as db:
            db.row_factory = aiosqlite.Row

            # Execute the query
            if parameters:
                cursor = await db.execute(sql, parameters)
            else:
                cursor = await db.execute(sql)

            # Fetch all rows first to get total count
            all_rows = await cursor.fetchall()
            total_count = len(all_rows)

            # Apply offset and limit
            sliced_rows = all_rows[offset : offset + limit]

            # Get column information
            columns = []
            if cursor.description:
                columns = [
                    {"name": desc[0], "data_type": "TEXT"}  # SQLite is dynamically typed
                    for desc in cursor.description
                ]

            # Convert rows to dicts
            data = [dict(row) for row in sliced_rows]

            execution_time_ms = (time.time() - start_time) * 1000

            return QueryResult(
                columns=columns,
                data=data,
                row_count=len(data),
                execution_time_ms=execution_time_ms,
                truncated=total_count > offset + limit,
                total_count=total_count,
            )

    async def close(self) -> None:
        """Close the connection if open."""
        if self._connection:
            await self._connection.close()
            self._connection = None
