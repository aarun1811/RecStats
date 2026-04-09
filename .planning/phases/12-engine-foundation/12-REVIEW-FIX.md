---
phase: 12-engine-foundation
fixed_at: 2026-04-09T22:55:00Z
review_path: .planning/phases/12-engine-foundation/12-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-04-09T22:55:00Z
**Source review:** .planning/phases/12-engine-foundation/12-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Hardcoded Fernet Encryption Key in Config Default

**Files modified:** `backend/app/config.py`, `backend/app/main.py`, `backend/.env`
**Commit:** dab72da
**Applied fix:** Removed the hardcoded Fernet key default from `Settings.recviz_encryption_key`. Changed the type from `str` with a default to `SecretStr` with no default, so the application refuses to start without `RECVIZ_ENCRYPTION_KEY` set in the environment. Updated `main.py` to call `.get_secret_value()` when passing the key to `EncryptionService`. Added the dev key to `backend/.env` so local development continues to work (the key was already in `.env.example` but not in `.env`).

### CR-02: Migration DDL / ORM Model Type Mismatch for `extra_params`

**Files modified:** `backend/app/migrations/versions/005_add_connections_portable_json.py`
**Commit:** 80a26c8
**Applied fix:** Changed the `extra_params` column in migration 005 from `sa.Text()` to `PortableJSON()`, matching the ORM model declaration in `RecvizConnection`. Added the `from app.db.types import PortableJSON` import. On PostgreSQL this now correctly creates a JSONB column; on Oracle it falls back to CLOB via the `PortableJSON` type decorator.

### WR-01: `test_connection` Error Message May Leak Credentials

**Files modified:** `backend/app/services/engine_manager.py`
**Commit:** 1f5de4f
**Applied fix:** Added `import re` and replaced the raw `str(exc)` return in the `test_connection` error handler with a sanitized version that strips credentials from any URI pattern (e.g., `://user:pass@` becomes `://***:***@`). Existing tests are unaffected since the mock exception message ("Connection refused") contains no URI pattern.

### WR-02: `X-Frame-Options: ALLOWALL` Is Not a Valid Value

**Files modified:** `backend/app/main.py`
**Commit:** e207d2d
**Applied fix:** Changed the `X-Frame-Options` header value from the invalid `ALLOWALL` to the standards-compliant `SAMEORIGIN` (RFC 7034). This is the appropriate default for an internal tool -- it allows same-origin framing while preventing cross-origin clickjacking.

### WR-03: `RecvizConnection` Model Missing Python-Side Datetime Defaults

**Files modified:** `backend/app/db/models/connection.py`
**Commit:** d2f39d2
**Applied fix:** Added `_utcnow()` helper function and `default=_utcnow` to both `created_at` and `updated_at` columns, matching the pattern used by `RecvizChart`, `RecvizDataset`, and `RecvizKpi` models. This ensures newly created `RecvizConnection` instances have non-None datetime values immediately, before any database flush/commit occurs.

---

_Fixed: 2026-04-09T22:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
