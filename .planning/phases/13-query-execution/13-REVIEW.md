---
phase: 13-query-execution
reviewed: 2026-04-09T14:22:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - backend/app/api/sql.py
  - backend/app/core/dependencies.py
  - backend/app/main.py
  - backend/app/services/connection_resolver.py
  - backend/app/services/connection_status.py
  - backend/app/services/query_engine.py
  - backend/app/services/query_utils.py
  - backend/tests/test_connection_resolver.py
  - backend/tests/test_connection_status.py
  - backend/tests/test_query_engine.py
  - backend/tests/test_query_utils.py
  - backend/tests/test_sql_api.py
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-09T14:22:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This review covers the Phase 13 query execution layer: the `QueryExecutor` service, SQL utility functions, the `ConnectionResolver`, `ConnectionStatusTracker`, the SQL Explorer API endpoints, application lifespan wiring in `main.py`, and all associated test files.

The architecture is solid -- direct SQLAlchemy async engine execution replacing Superset proxying, dialect-aware pagination, column normalization, and connection status tracking are well-designed. However, there are **3 critical security findings** in the SQL read-only validator that can be bypassed, **4 warnings** covering potential bugs and missing error handling, and **3 informational items** for code quality.

## Critical Issues

### CR-01: SQL Injection via Semicolon -- Multi-Statement Bypass of Read-Only Validator

**File:** `backend/app/services/query_utils.py:143-156`
**Issue:** `validate_read_only()` only checks the **first statement** in the input using `re.match()` (which anchors at the start of the string). An attacker can bypass the read-only enforcement by prepending a valid SELECT and appending a destructive statement after a semicolon:

```sql
SELECT 1; DROP TABLE users
```

This passes `validate_read_only()` because the regex only inspects the prefix. While the database user *should* have read-only permissions (defense in depth), this is the **primary** application-layer control and is documented as such (Threat T-13-01/T-13-08). Multi-statement execution depends on the database driver, but PostgreSQL's `psycopg2`/`asyncpg` will execute both statements by default when passed via `text()`.

**Fix:**
```python
def validate_read_only(sql: str) -> bool:
    """Return True if the SQL statement is read-only (SELECT or WITH).

    Rejects multi-statement queries (semicolons) and destructive keywords.
    """
    # Reject multi-statement queries
    stripped = sql.strip().rstrip(";").strip()
    if ";" in stripped:
        return False
    return not bool(_FORBIDDEN_PREFIXES.match(stripped))
```

### CR-02: SQL Injection via Comment Prefix -- Read-Only Validator Bypass

**File:** `backend/app/services/query_utils.py:143-156`
**Issue:** The regex `^\s*` allows whitespace before the forbidden keyword, but SQL comments (`--`, `/* */`) are not considered. An attacker can prepend a comment to hide a destructive statement:

```sql
/* harmless */ DROP TABLE users
```

The regex `^\s*(INSERT|...)` does not match because `/*` is not whitespace, so the function returns `True` (allowed). The database engine strips the comment and executes the DROP.

**Fix:** Strip SQL comments before validation, or use a positive allowlist approach:
```python
_ALLOWED_PREFIXES = re.compile(
    r"^\s*(/\*.*?\*/\s*)*(--[^\n]*\n\s*)*(SELECT|WITH|EXPLAIN)\b",
    re.IGNORECASE | re.DOTALL,
)

def validate_read_only(sql: str) -> bool:
    stripped = sql.strip().rstrip(";").strip()
    if ";" in stripped:
        return False
    return bool(_ALLOWED_PREFIXES.match(stripped))
```

### CR-03: SQL Injection in `_build_sql` Column Placeholder via Column Name Content

**File:** `backend/app/services/query_engine.py:115-123`
**Issue:** The `{{column}}` replacement validates that the column name exists in `ds.columns`, but the column **name itself** is used in raw string substitution without sanitization. If a data source config were to contain a column name with SQL injection payload (e.g., during misconfiguration or if config is user-editable), it would be injected directly into the query:

```python
sql = sql.replace("{{column}}", column)  # No quoting or escaping
```

While column names come from admin-defined config, this is a defense-in-depth gap. The `{{values}}` and `{{value}}` replacements at lines 138-144 do escape single quotes, but the column path does not.

**Fix:** Quote the column name with dialect-appropriate identifier quoting:
```python
if column and "{{column}}" in sql:
    valid_columns = {c.name for c in ds.columns}
    if column not in valid_columns:
        raise ValueError(...)
    # Sanitize: only allow alphanumeric + underscore
    if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', column):
        raise ValueError(f"Invalid column name: '{column}'")
    sql = sql.replace("{{column}}", column)
```

## Warnings

### WR-01: Unbounded In-Memory Query History -- No Size Limit

**File:** `backend/app/api/sql.py:32`
**Issue:** `_query_history` is an unbounded `list[dict]` that grows with every query execution. While `get_history()` returns only the first 50 entries (line 182), the list itself is never pruned. In a long-running process handling many queries, this will consume unbounded memory. Each entry includes the full SQL text (line 49), which could be kilobytes for complex queries.

**Fix:** Cap the list size after each insert:
```python
_MAX_HISTORY = 200

# After each insert:
_query_history.insert(0, record)
if len(_query_history) > _MAX_HISTORY:
    del _query_history[_MAX_HISTORY:]
```

### WR-02: `asyncio.wait_for` on Synchronous Mock May Not Actually Enforce Timeout

**File:** `backend/app/api/sql.py:102-105`
**Issue:** `asyncio.wait_for()` wraps `conn.execute(text(paginated_sql))`, which is a SQLAlchemy async call. However, if the underlying database driver executes synchronously under the hood (e.g., `psycopg2` via `run_sync`), the `wait_for` timeout will not interrupt it because `asyncio.wait_for` can only cancel at `await` points. This means a long-running query could block the event loop past the 60-second timeout. The same pattern appears in `query_engine.py:194-197`.

This is a known limitation of `asyncio.wait_for` with sync-bridged drivers. The actual timeout behavior depends on which async driver is in use (`asyncpg` respects it, `psycopg2` via `greenlet` may not).

**Fix:** Ensure the project uses a truly async driver (e.g., `asyncpg` for PostgreSQL, `oracledb` in async mode for Oracle). Alternatively, set statement-level timeouts at the database level:
```python
# For PostgreSQL:
await conn.execute(text(f"SET statement_timeout = '{int(timeout * 1000)}'"))
```

### WR-03: `_query_history` Shared Mutable State Without Thread Safety

**File:** `backend/app/api/sql.py:32`
**Issue:** `_query_history` is a module-level mutable list accessed by concurrent async request handlers. While Python's GIL provides some protection for list operations, `insert(0, record)` is not atomic with respect to the `[:50]` slice in `get_history()`. Under concurrent load, a reader could observe an inconsistent state. More importantly, if the app is run with multiple workers (e.g., uvicorn with `--workers > 1`), each worker has its own copy of the list, making history silently inconsistent.

**Fix:** For a single-worker setup, this is low risk. For multi-worker, consider moving history to Redis or the database. For immediate safety, at minimum add a comment documenting the single-worker assumption:
```python
# NOTE: In-memory history -- only valid for single-worker uvicorn.
# For multi-worker, migrate to Redis or database storage.
_query_history: list[dict] = []
```

### WR-04: `sanitize_detail` Does Not Redact All Connection String Formats

**File:** `backend/app/core/errors.py:21-23`
**Issue:** `sanitize_detail()` redacts `postgresql://`, `oracle://`, and `hive://` URIs, but does not handle `oracle+oracledb://`, `postgresql+asyncpg://`, or other SQLAlchemy dialect+driver URI formats that `EngineManager` likely constructs. If the engine throws an error containing the full connection URI, credentials could leak to the client.

**Fix:**
```python
# Redact any SQLAlchemy-style connection URIs (dialect+driver://user:pass@host/db)
raw = re.sub(r"\w+(\+\w+)?://[^\s]+", "***://***", raw)
```

## Info

### IN-01: Bare `except Exception` Re-raise in QueryExecutor

**File:** `backend/app/services/query_engine.py:213-215`
**Issue:** The catch block `except Exception: raise` at line 213-215 has no side effects -- it catches and immediately re-raises. This is dead code that adds noise without providing value.

**Fix:** Remove the bare re-raise block:
```python
# Remove lines 213-215:
# except Exception:
#     raise
```

### IN-02: `get_dialect` Defaults to "oracle" for Unknown Names

**File:** `backend/app/services/connection_resolver.py:76-77`
**Issue:** When `get_dialect()` is called with an unknown name, it silently returns `"oracle"` instead of raising or returning a sentinel. This could mask configuration errors where a database name is misspelled -- the system would silently generate Oracle-dialect SQL for a nonexistent connection, which would then fail with a confusing database error rather than a clear "connection not found" message.

**Fix:** Consider raising `ValueError` to match the behavior of `resolve()`, or at minimum log a warning:
```python
def get_dialect(self, name: str) -> str:
    info = self._cache.get(name)
    if info is None:
        logger.warning("get_dialect called for unknown database '%s', defaulting to 'oracle'", name)
    return info.dialect if info else "oracle"
```

### IN-03: Duplicate `_AsyncContextManager` Helper Across Test Files

**File:** `backend/tests/test_query_engine.py:89-100` and `backend/tests/test_sql_api.py:24-35`
**Issue:** The `_AsyncContextManager` helper class and `_build_mock_engine` function are duplicated verbatim across two test files. This is minor but creates a maintenance burden -- if the mock pattern changes, both files need updating.

**Fix:** Extract shared test utilities into a `backend/tests/conftest.py` or `backend/tests/helpers.py` module:
```python
# backend/tests/helpers.py
class AsyncContextManagerMock:
    ...

def build_mock_engine(rows, cursor_description):
    ...
```

---

_Reviewed: 2026-04-09T14:22:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
