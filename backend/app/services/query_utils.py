"""Shared query utility functions for the RecViz query engine.

Provides:
- Oracle UPPERCASE column name normalization
- DB-API type code to RecViz type detection
- Superset-compatible result response builder
- Read-only SQL statement validator
- Dialect-aware SQL pagination wrapper (Oracle OFFSET FETCH)
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Column normalization (QENG-06: Oracle UPPERCASE -> lowercase)
# ---------------------------------------------------------------------------


def normalize_columns(column_names: list[str]) -> list[str]:
    """Lowercase all column names.

    Oracle returns column names in UPPERCASE by default. This normalizes
    them to lowercase for consistent frontend consumption.
    """
    return [c.lower() for c in column_names]


# ---------------------------------------------------------------------------
# Column type detection (QENG-05: DB type codes -> RecViz types)
# ---------------------------------------------------------------------------

# Patterns matched against the UPPERCASE type name.
# Order matters: more specific patterns checked first where needed.
_STRING_PATTERNS = ("CHAR", "VARCHAR", "TEXT", "CLOB", "STRING", "NCHAR", "NVARCHAR")
_NUMBER_PATTERNS = ("NUMBER", "INT", "FLOAT", "DECIMAL", "NUMERIC", "DOUBLE", "REAL", "MONEY")
_DATE_PATTERNS = ("DATE", "TIMESTAMP", "TIME")

# Legacy OID-to-type-name mapping. Retained as a safety net for any
# driver that returns integer type codes in cursor.description.
_OID_TO_TYPE_NAME: dict[int, str] = {
    16: "BOOLEAN",
    20: "BIGINT",
    21: "SMALLINT",
    23: "INTEGER",
    25: "TEXT",
    114: "JSON",
    700: "FLOAT",
    701: "DOUBLE",
    1042: "CHAR",
    1043: "VARCHAR",
    1082: "DATE",
    1083: "TIME",
    1114: "TIMESTAMP",
    1184: "TIMESTAMP",
    1700: "NUMERIC",
    2950: "VARCHAR",
}


def detect_column_type(db_type_name: str) -> tuple[str, bool]:
    """Map a database type name to a RecViz type and is_date flag.

    Args:
        db_type_name: Type name string from cursor.description or DB metadata.

    Returns:
        Tuple of (recviz_type, is_date) where recviz_type is one of
        "string", "number", "date".
    """
    upper = db_type_name.upper()

    # Check date first -- "TIMESTAMP" contains "TIME", and we want
    # "TIMESTAMP WITH TIME ZONE" to match date, not get confused.
    for pattern in _DATE_PATTERNS:
        if pattern in upper:
            return ("date", True)

    for pattern in _NUMBER_PATTERNS:
        if pattern in upper:
            return ("number", False)

    for pattern in _STRING_PATTERNS:
        if pattern in upper:
            return ("string", False)

    # Default: unknown types treated as string
    return ("string", False)


# ---------------------------------------------------------------------------
# Result response builder
# ---------------------------------------------------------------------------


def build_result_response(
    column_descriptions: list[tuple],
    rows: list[tuple],
    max_rows: int = 10_000,
) -> dict:
    """Build a response dict matching the Superset query result contract.

    Args:
        column_descriptions: List of tuples from cursor.description.
            Each tuple is ``(name, type_code_or_str, ...)``.
            The type element can be a string or a DB-API type object.
        rows: List of tuples (raw database rows).
        max_rows: Maximum number of rows to include in the response.

    Returns:
        Dict with keys: columns, rows, row_count, truncated.
    """
    # Normalize column names (Oracle UPPERCASE -> lowercase)
    col_names = normalize_columns([desc[0] for desc in column_descriptions])

    # Build column metadata
    columns_meta: list[dict] = []
    for i, desc in enumerate(column_descriptions):
        # Type can be a string name, a DB-API type object/class, or an
        # integer OID (some drivers return OID integers).
        type_info = desc[1] if len(desc) > 1 else "string"
        if isinstance(type_info, int):
            type_name = _OID_TO_TYPE_NAME.get(type_info, "VARCHAR")
        elif isinstance(type_info, str):
            type_name = type_info
        elif isinstance(type_info, type):
            if "__name__" in vars(type_info):
                type_name = vars(type_info)["__name__"]
            else:
                type_name = type_info.__name__
        else:
            type_name = getattr(type_info, "__name__", str(type_info))

        recviz_type, is_date = detect_column_type(type_name)
        columns_meta.append({
            "column_name": col_names[i],
            "name": col_names[i],
            "type": recviz_type,
            "is_date": is_date,
        })

    # Truncate rows if over limit
    truncated = len(rows) > max_rows
    limited_rows = rows[:max_rows] if truncated else rows

    # Convert tuples to dicts keyed by lowercase column names
    row_dicts = [dict(zip(col_names, row)) for row in limited_rows]

    return {
        "columns": columns_meta,
        "rows": row_dicts,
        "row_count": len(row_dicts),
        "truncated": truncated,
    }


# ---------------------------------------------------------------------------
# Read-only SQL validator (QENG-04 / Threat T-13-01)
# ---------------------------------------------------------------------------

_ALLOWED_PREFIXES = re.compile(
    r"^\s*(/\*.*?\*/\s*)*(--[^\n]*\n\s*)*(SELECT|WITH|EXPLAIN)\b",
    re.IGNORECASE | re.DOTALL,
)


def validate_read_only(sql: str) -> bool:
    """Return True if the SQL statement is read-only (SELECT, WITH, or EXPLAIN).

    Uses an allowlist approach: only statements beginning with SELECT, WITH,
    or EXPLAIN (after optional SQL comments) are permitted.

    Rejects multi-statement queries (semicolons within the body) to prevent
    appending destructive statements after a valid SELECT. Handles SQL
    comments (block and line) that could hide forbidden keywords.

    Defense in depth -- the database user should also have read-only
    permissions.
    """
    # Strip outer whitespace and trailing semicolons
    stripped = sql.strip().rstrip(";").strip()

    # Reject multi-statement queries (semicolons within the body)
    if ";" in stripped:
        return False

    # Allowlist: must start with SELECT, WITH, or EXPLAIN (after optional comments)
    return bool(_ALLOWED_PREFIXES.match(stripped))


# ---------------------------------------------------------------------------
# Dialect-aware pagination wrapper (DIAL-02)
# ---------------------------------------------------------------------------


def wrap_with_pagination(
    sql: str,
    limit: int | None,
    offset: int = 0,
    dialect: str = "oracle",
) -> str:
    """Wrap SQL with dialect-appropriate pagination.

    Args:
        sql: The base SQL query.
        limit: Maximum rows to return. If None, returns sql unchanged.
        offset: Number of rows to skip (default 0).
        dialect: SQL dialect -- "oracle".

    Returns:
        The paginated SQL string.
    """
    if limit is None:
        return sql

    # Oracle OFFSET FETCH (12c+)
    return (
        f"SELECT * FROM (\n{sql}\n) recviz_paged\n"
        f"OFFSET {offset} ROWS FETCH FIRST {limit} ROWS ONLY"
    )
