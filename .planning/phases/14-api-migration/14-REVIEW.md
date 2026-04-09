---
phase: 14-api-migration
reviewed: 2026-04-09T13:02:39Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - backend/app/api/databases.py
  - backend/app/api/managed_datasets.py
  - backend/app/core/dependencies.py
  - backend/app/db/models/dataset.py
  - backend/app/main.py
  - backend/app/migrations/versions/006_remove_dataset_superset_fields.py
  - backend/app/models/database.py
  - backend/app/models/managed_dataset.py
  - backend/tests/test_databases_api.py
  - backend/tests/test_managed_datasets.py
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-04-09T13:02:39Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This review covers the API migration phase that removes Superset dependencies from database and managed dataset CRUD endpoints. The code is well-structured overall: database connections use proper encryption, endpoints follow the service-layer pattern, and tests validate the no-Superset-import invariant.

Key concerns:
1. A type mismatch between `RecvizDataset.database_id` (Integer) and `RecvizConnection.id` (UUID String) means the `list_database_datasets` endpoint will silently produce wrong results or errors at the database level.
2. The `_get_encryption` helper will crash with an `AttributeError` if the encryption service is missing from app state, unlike other similar helpers that use safe `getattr`.
3. The `DatabaseUpdate` model accepts freeform `str` for `backend` instead of the `Literal` type used in `DatabaseCreate`, allowing invalid backends to be persisted.

## Critical Issues

### CR-01: Type mismatch -- RecvizDataset.database_id is Integer but connection IDs are UUID strings

**File:** `backend/app/api/databases.py:113`
**Issue:** `RecvizDataset.database_id` is `Mapped[int]` (Integer column, line 20 of `dataset.py`), but `RecvizConnection.id` is `Mapped[str]` (String/UUID). The `list_database_datasets` endpoint queries `RecvizDataset.database_id == db_id` where `db_id` is a UUID string. This comparison of an integer column against a string value will either: (a) return zero results always on PostgreSQL (type mismatch), or (b) raise a database error. The docstring on lines 108-112 acknowledges this gap but labels it as "may be empty" -- the actual behavior is that this endpoint is broken for UUID-based connection IDs.

This also affects the `DatasetCreate` and `DatasetResponse` Pydantic models in `managed_dataset.py` (lines 28, 44) which declare `database_id: int`, making it impossible to reference UUID-based connections through the managed dataset API.

**Fix:** Migrate `RecvizDataset.database_id` from `Integer` to `String(128)` to match `RecvizConnection.id`. Add an Alembic migration (007) to alter the column type. Update the Pydantic models accordingly:
```python
# backend/app/db/models/dataset.py
database_id: Mapped[str] = mapped_column(String(128), nullable=False)

# backend/app/models/managed_dataset.py - DatasetCreate
database_id: str

# backend/app/models/managed_dataset.py - DatasetResponse
database_id: str
```

## Warnings

### WR-01: _get_encryption crashes with AttributeError if encryption not initialized

**File:** `backend/app/api/databases.py:41-42`
**Issue:** `_get_encryption` directly accesses `request.app.state.encryption` without `getattr` safety, unlike the sibling `_get_status_tracker` (line 38) which uses `getattr(..., None)`. If the encryption service is not set on app state (e.g., during testing or if initialization fails partially), this raises an unhandled `AttributeError` instead of a meaningful error.

**Fix:** Either use `getattr` with a fallback and raise a clear 503 error, or keep the direct access but wrap callers with error handling:
```python
def _get_encryption(request: Request) -> EncryptionService:
    encryption = getattr(request.app.state, "encryption", None)
    if encryption is None:
        raise HTTPException(
            status_code=503,
            detail="Encryption service not available",
        )
    return encryption
```

### WR-02: DatabaseUpdate.backend allows arbitrary strings, bypassing validation

**File:** `backend/app/models/database.py:23`
**Issue:** `DatabaseCreate.backend` correctly constrains to `Literal["oracle", "postgresql"]` (line 12), but `DatabaseUpdate.backend` uses `str | None` (line 23). This means a PUT request could set `backend` to any arbitrary string (e.g., `"mysql"`, `"sqlite"`, `""`), which would then be persisted to the database and cause failures when the engine manager tries to build a connection URI for an unsupported backend.

**Fix:**
```python
class DatabaseUpdate(CamelModel):
    database_name: str | None = None
    backend: Literal["oracle", "postgresql"] | None = None
    # ... rest unchanged
```

### WR-03: Superset hard-dependency in lifespan prevents startup without Superset

**File:** `backend/app/main.py:108-109`
**Issue:** The lifespan function calls `await superset.authenticate()` as a hard requirement (line 108-109). If Superset is unavailable, the entire FastAPI app fails to start. Given the project direction is removing Superset (per `project_superset_ditched` memory), this creates a fragile startup that blocks the new direct-database endpoints from functioning independently. Steps 1-2 and 4 create Superset-dependent objects that are immediately overwritten by step 9 (`QueryExecutor`), making those initialization steps dead weight that still blocks startup.

**Fix:** Wrap Superset initialization in a try/except so the app can start without it, since the new `QueryExecutor` (step 9) does not depend on Superset:
```python
try:
    await superset.authenticate()
    app.state.superset = superset
    logger.info("Superset client ready")
except Exception as exc:
    logger.warning("Superset unavailable, running without legacy engine: %s", exc)
    app.state.superset = None
```

### WR-04: create_database IntegrityError handler does not await session.rollback()

**File:** `backend/app/api/databases.py:168-175`
**Issue:** When `session.flush()` raises `IntegrityError`, the handler re-raises as `HTTPException`. The session is now in a failed transaction state. While the `get_db_session` dependency will eventually call `rollback()`, SQLAlchemy async sessions in a failed state may behave unpredictably if any other code runs against the session between the `IntegrityError` and the dependency's rollback. Explicitly rolling back in the catch block is defensive and makes the intent clear.

**Fix:**
```python
try:
    session.add(connection)
    await session.flush()
except IntegrityError:
    await session.rollback()
    raise HTTPException(
        status_code=409,
        detail={"error": "duplicate_name", "message": f"A connection named '{name}' already exists"},
    )
```

## Info

### IN-01: Unused imports -- ConnectionStatusTracker and EncryptionService imported but only used as type hints in helpers

**File:** `backend/app/api/databases.py:22-23`
**Issue:** `ConnectionStatusTracker` and `EncryptionService` are imported at the top level but are only used as return type annotations in the `_get_status_tracker` and `_get_encryption` helper functions. Since these functions access app state via `getattr`/direct access (no type checking is enforced at runtime), the imports serve no functional purpose. They add coupling between the route module and the service modules.

**Fix:** Remove the unused imports and use string annotations or inline type comments if type hints are desired:
```python
# Remove these lines:
# from app.services.connection_status import ConnectionStatusTracker
# from app.services.encryption import EncryptionService

# Use generic return types or TYPE_CHECKING block
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.services.connection_status import ConnectionStatusTracker
    from app.services.encryption import EncryptionService
```

### IN-02: _build_response hardcodes dataset_count to 0

**File:** `backend/app/api/databases.py:53`
**Issue:** `_build_response` always returns `"dataset_count": 0`. The `DatabaseInfo` Pydantic model (in `database.py:38`) defaults this to 0 as well. This means the list/get database endpoints never report an accurate dataset count, even though the `list_database_datasets` endpoint exists and could provide this data. This is a known gap (documented in the type mismatch with CR-01), but worth noting as a TODO for when the type mismatch is resolved.

**Fix:** After resolving CR-01, query the actual count:
```python
def _build_response(conn: RecvizConnection, status_info: dict, dataset_count: int = 0) -> dict:
    return {
        ...
        "dataset_count": dataset_count,
        ...
    }
```

### IN-03: Dead Superset objects created and immediately overwritten in lifespan

**File:** `backend/app/main.py:131-136` and `backend/app/main.py:175-179`
**Issue:** Step 4 creates a `QueryEngine` (Superset-backed) and assigns it to `app.state.query_engine`. Step 9 immediately overwrites it with a `QueryExecutor` (direct-database). The `QueryEngine` from step 4 is never used. Similarly, the `DatabaseRegistrar` from step 2 is only consumed by the dead `QueryEngine`. These are dead code paths that add startup latency (Superset sync) and confusion.

**Fix:** Once Superset is fully removed, delete steps 1, 2, and 4 from the lifespan. For now, add a comment or TODO making the deprecation explicit.

---

_Reviewed: 2026-04-09T13:02:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
