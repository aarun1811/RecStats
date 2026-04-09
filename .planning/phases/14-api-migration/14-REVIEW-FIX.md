---
phase: 14-api-migration
fixed_at: 2026-04-09T13:15:00Z
review_path: .planning/phases/14-api-migration/14-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-04-09T13:15:00Z
**Source review:** .planning/phases/14-api-migration/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Type mismatch -- RecvizDataset.database_id is Integer but connection IDs are UUID strings

**Files modified:** `backend/app/db/models/dataset.py`, `backend/app/models/managed_dataset.py`, `backend/app/api/databases.py`, `backend/app/migrations/versions/007_dataset_database_id_to_string.py`, `backend/tests/test_managed_datasets.py`
**Commit:** 29dc773
**Applied fix:** Changed `RecvizDataset.database_id` from `Mapped[int]` (Integer) to `Mapped[str]` (String(128)) to match UUID-based `RecvizConnection.id`. Updated `DatasetCreate.database_id` and `DatasetResponse.database_id` Pydantic models from `int` to `str`. Created Alembic migration 007 to alter the column type with `postgresql_using` cast. Updated test fixtures and assertions in `test_managed_datasets.py` to use string database IDs. Removed the outdated docstring in `list_database_datasets` that documented the type mismatch as a known gap.

### WR-01: _get_encryption crashes with AttributeError if encryption not initialized

**Files modified:** `backend/app/api/databases.py`
**Commit:** 35148e0
**Applied fix:** Replaced direct `request.app.state.encryption` access with `getattr(request.app.state, "encryption", None)` plus a guard that raises `HTTPException(503, "Encryption service not available")` if encryption is not initialized. This matches the safe pattern already used by `_get_status_tracker`.

### WR-02: DatabaseUpdate.backend allows arbitrary strings, bypassing validation

**Files modified:** `backend/app/models/database.py`
**Commit:** f7a12ab
**Applied fix:** Changed `DatabaseUpdate.backend` from `str | None` to `Literal["oracle", "postgresql"] | None` to match the constraint already enforced on `DatabaseCreate.backend`. Prevents persisting invalid backend values through PUT requests.

### WR-03: Superset hard-dependency in lifespan prevents startup without Superset

**Files modified:** `backend/app/main.py`
**Commit:** 9f544cb
**Applied fix:** Wrapped Superset authentication (step 1) in try/except, setting `app.state.superset = None` on failure with a warning log. Conditioned steps 2 (DatabaseRegistrar sync) and 4 (legacy QueryEngine creation) on Superset availability. The app now starts successfully without Superset, as step 9 (QueryExecutor) provides the actual query execution path independently.

### WR-04: create_database IntegrityError handler does not await session.rollback()

**Files modified:** `backend/app/api/databases.py`
**Commit:** 8a63715
**Applied fix:** Added `await session.rollback()` in the `IntegrityError` except block before raising HTTPException(409). This explicitly clears the failed transaction state rather than relying on the dependency's eventual rollback.

## Skipped Issues

None -- all findings were fixed.

---

_Fixed: 2026-04-09T13:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
