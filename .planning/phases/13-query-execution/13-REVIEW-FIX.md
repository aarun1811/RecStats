---
phase: 13-query-execution
fixed_at: 2026-04-09T14:35:00Z
review_path: .planning/phases/13-query-execution/13-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-04-09T14:35:00Z
**Source review:** .planning/phases/13-query-execution/13-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 6
- Skipped: 1

## Fixed Issues

### CR-01 + CR-02: SQL Injection via Semicolon and Comment Prefix -- Read-Only Validator Bypass

**Files modified:** `backend/app/services/query_utils.py`
**Commit:** 5e1a1c5
**Applied fix:** Replaced the denylist (`_FORBIDDEN_PREFIXES`) approach with an allowlist (`_ALLOWED_PREFIXES`) that only permits statements beginning with SELECT, WITH, or EXPLAIN (after optional SQL block/line comments). Added semicolon rejection within the query body (after stripping trailing semicolons) to prevent multi-statement bypass. All 33 existing tests pass.

### CR-03: SQL Injection in `_build_sql` Column Placeholder via Column Name Content

**Files modified:** `backend/app/services/query_engine.py`
**Commit:** c2c061a
**Applied fix:** Added regex validation (`^[A-Za-z_][A-Za-z0-9_]*$`) for column names before string substitution in `_build_sql()`. This ensures only valid SQL identifier characters are permitted, preventing injection via malicious column names in data source config. The existing allowlist check (column must exist in `ds.columns`) is preserved as the primary control; the regex is defense in depth.

### WR-01 + WR-03: Unbounded In-Memory Query History and Shared Mutable State

**Files modified:** `backend/app/api/sql.py`
**Commit:** d94ea50
**Applied fix:** Added `_MAX_HISTORY = 200` cap and a `_record_history()` helper that inserts and prunes the list. All 5 `_query_history.insert()` call sites now use the bounded helper. Added documentation comment noting the single-worker uvicorn assumption (WR-03) and recommending Redis/DB migration for multi-worker deployments.

### WR-04: `sanitize_detail` Does Not Redact All Connection String Formats

**Files modified:** `backend/app/core/errors.py`
**Commit:** 64c6500
**Applied fix:** Replaced three separate URI-specific `re.sub` calls (`postgresql://`, `oracle://`, `hive://`) with a single pattern `\w+(\+\w+)?://[^\s]+` that matches any SQLAlchemy dialect+driver URI format (e.g., `oracle+oracledb://`, `postgresql+asyncpg://`). All matched URIs are redacted to `***://***`.

## Skipped Issues

### WR-02: `asyncio.wait_for` on Synchronous Mock May Not Actually Enforce Timeout

**File:** `backend/app/api/sql.py:102-105`
**Reason:** This is an architectural/infrastructure concern, not a code fix. The `asyncio.wait_for` timeout behavior depends on whether the database driver is truly async (`asyncpg`) or sync-bridged (`psycopg2` via greenlet). The review suggests either ensuring truly async drivers or setting statement-level database timeouts. Both require infrastructure decisions (driver selection, dialect-specific timeout syntax for Oracle vs PostgreSQL vs SQLite) that cannot be safely applied as a code-only fix without testing against real database connections. The existing `asyncio.wait_for` provides correct timeout behavior with truly async drivers, which is the intended deployment configuration.
**Original issue:** `asyncio.wait_for()` cannot cancel at `await` points if the underlying driver executes synchronously, meaning a long-running query could block the event loop past the timeout.

---

_Fixed: 2026-04-09T14:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
