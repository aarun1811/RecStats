"""Oracle database connector using oracledb."""

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

import oracledb

from app.connectors.base import BaseConnector, QueryResult
from app.schemas.datasource import SchemaInfo, TableInfo, ColumnInfo


# Thread pool for running sync Oracle operations
_executor = ThreadPoolExecutor(max_workers=4)


class OracleConnector(BaseConnector):
    """Connector for Oracle databases using oracledb."""

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._connection: Optional[oracledb.Connection] = None

    def _get_dsn(self) -> str:
        """Build Oracle DSN from config."""
        return oracledb.makedsn(
            self.config.get("host", "localhost"),
            self.config.get("port", 1521),
            service_name=self.config.get("service_name", ""),
        )

    def _connect_sync(self) -> oracledb.Connection:
        """Create a synchronous Oracle connection."""
        return oracledb.connect(
            user=self.config.get("user", ""),
            password=self.config.get("password", ""),
            dsn=self._get_dsn(),
        )

    async def test_connection(self) -> tuple[bool, str]:
        """Test the Oracle database connection."""
        try:
            # Validate required config
            required = ["host", "service_name", "user", "password"]
            missing = [f for f in required if not self.config.get(f)]
            if missing:
                return False, f"Missing required fields: {', '.join(missing)}"

            # Run connection test in thread pool
            loop = asyncio.get_event_loop()

            def test_sync():
                conn = self._connect_sync()
                conn.ping()
                conn.close()
                return True

            await loop.run_in_executor(_executor, test_sync)
            return True, "Oracle connection successful"

        except oracledb.Error as e:
            error = e.args[0]
            # Provide helpful error messages for common issues
            error_msg = str(error)
            if hasattr(error, "message"):
                error_msg = error.message

            if "DPI-1047" in error_msg:
                return False, "Oracle Client libraries not found. Install Oracle Instant Client."
            elif "ORA-12541" in error_msg:
                return False, f"No Oracle listener at {self.config.get('host')}:{self.config.get('port')}"
            elif "ORA-12514" in error_msg:
                return False, f"Service '{self.config.get('service_name')}' not found"
            elif "ORA-01017" in error_msg:
                return False, "Invalid username/password"
            else:
                return False, f"Oracle error: {error_msg}"

        except Exception as e:
            return False, f"Connection failed: {str(e)}"

    async def get_schema(self) -> SchemaInfo:
        """Get schema information from Oracle database."""
        loop = asyncio.get_event_loop()

        def get_schema_sync() -> SchemaInfo:
            tables: list[TableInfo] = []
            conn = self._connect_sync()

            try:
                with conn.cursor() as cursor:
                    # Get tables owned by the user
                    cursor.execute(
                        "SELECT table_name FROM user_tables ORDER BY table_name"
                    )
                    table_rows = cursor.fetchall()

                    for (table_name,) in table_rows:
                        columns: list[ColumnInfo] = []

                        # Get column information
                        cursor.execute(
                            """
                            SELECT column_name, data_type, nullable
                            FROM user_tab_columns
                            WHERE table_name = :tbl
                            ORDER BY column_id
                            """,
                            {"tbl": table_name},
                        )
                        col_rows = cursor.fetchall()

                        for col_name, data_type, nullable in col_rows:
                            columns.append(
                                ColumnInfo(
                                    name=col_name,
                                    data_type=data_type,
                                    nullable=nullable == "Y",
                                )
                            )

                        # Get primary key columns
                        cursor.execute(
                            """
                            SELECT cols.column_name
                            FROM user_constraints cons
                            JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
                            WHERE cons.table_name = :tbl AND cons.constraint_type = 'P'
                            """,
                            {"tbl": table_name},
                        )
                        pk_cols = {row[0] for row in cursor.fetchall()}
                        for col in columns:
                            col.primary_key = col.name in pk_cols

                        # Get row count (approximate for large tables)
                        cursor.execute(
                            f"SELECT COUNT(*) FROM {table_name}"
                        )
                        row_count = cursor.fetchone()[0]

                        tables.append(
                            TableInfo(
                                name=table_name,
                                columns=columns,
                                row_count=row_count,
                            )
                        )
            finally:
                conn.close()

            return SchemaInfo(tables=tables)

        return await loop.run_in_executor(_executor, get_schema_sync)

    async def execute_query(
        self,
        sql: str,
        limit: int = 1000,
        offset: int = 0,
        parameters: Optional[dict[str, Any]] = None,
    ) -> QueryResult:
        """Execute a SQL query against the Oracle database."""
        loop = asyncio.get_event_loop()
        start_time = time.time()

        def execute_sync() -> QueryResult:
            conn = self._connect_sync()

            try:
                with conn.cursor() as cursor:
                    # Execute the query
                    if parameters:
                        cursor.execute(sql, parameters)
                    else:
                        cursor.execute(sql)

                    # Get column information
                    columns = []
                    if cursor.description:
                        columns = [
                            {
                                "name": desc[0],
                                "data_type": self._oracle_type_to_string(desc[1]),
                            }
                            for desc in cursor.description
                        ]

                    # Fetch all rows and apply pagination
                    all_rows = cursor.fetchall()
                    total_count = len(all_rows)
                    sliced_rows = all_rows[offset : offset + limit]

                    # Convert to list of dicts
                    data = [
                        {columns[i]["name"]: val for i, val in enumerate(row)}
                        for row in sliced_rows
                    ]

                    execution_time_ms = (time.time() - start_time) * 1000

                    return QueryResult(
                        columns=columns,
                        data=data,
                        row_count=len(data),
                        execution_time_ms=execution_time_ms,
                        truncated=total_count > offset + limit,
                        total_count=total_count,
                    )
            finally:
                conn.close()

        return await loop.run_in_executor(_executor, execute_sync)

    def _oracle_type_to_string(self, type_obj: Any) -> str:
        """Convert Oracle type object to string representation."""
        type_name = getattr(type_obj, "name", str(type_obj))
        type_map = {
            "DB_TYPE_VARCHAR": "VARCHAR2",
            "DB_TYPE_CHAR": "CHAR",
            "DB_TYPE_NUMBER": "NUMBER",
            "DB_TYPE_DATE": "DATE",
            "DB_TYPE_TIMESTAMP": "TIMESTAMP",
            "DB_TYPE_CLOB": "CLOB",
            "DB_TYPE_BLOB": "BLOB",
        }
        return type_map.get(type_name, type_name)

    async def close(self) -> None:
        """Close the connection if open."""
        if self._connection:
            self._connection.close()
            self._connection = None
