---
phase: 12-engine-foundation
plan: 02
subsystem: database
tags: [sqlalchemy, fernet, encryption, orm, oracledb, asyncpg, connection-model]

# Dependency graph
requires:
  - phase: 12-01
    provides: "PortableJSON TypeDecorator for cross-dialect JSON columns"
provides:
  - "RecvizConnection ORM model with 15 columns (encrypted credentials, PortableJSON extra_params)"
  - "EncryptionService with Fernet encrypt/decrypt/generate_key"
  - "build_async_uri for postgresql+asyncpg and oracle+oracledb dialect URIs"
  - "Settings.recviz_encryption_key config field with env var support"
affects: [12-03, 13-query-engine, 14-connection-api]

# Tech tracking
tech-stack:
  added: ["cryptography (Fernet)"]
  patterns: ["Fernet symmetric encryption for credentials at rest", "Async dialect URI builder for create_async_engine"]

key-files:
  created:
    - "backend/app/services/encryption.py"
    - "backend/app/db/models/connection.py"
    - "backend/.env.example"
    - "backend/tests/test_encryption.py"
    - "backend/tests/test_connection_model.py"
  modified:
    - "backend/app/config.py"
    - "backend/app/services/uri_builder.py"
    - "backend/app/db/models/__init__.py"
    - "backend/tests/test_uri_builder.py"

key-decisions:
  - "Dev-only default Fernet key in Settings -- production MUST override via RECVIZ_ENCRYPTION_KEY env var"
  - "encrypted_password column is Text type (not String) to accommodate Fernet ciphertext length"
  - "build_async_uri is a separate function from build_sqlalchemy_uri -- both coexist, no modifications to existing function"

patterns-established:
  - "Encryption service pattern: EncryptionService(key) with encrypt/decrypt/generate_key"
  - "Async URI builder: ASYNC_DIALECTS mapping + build_async_uri for engine creation"

requirements-completed: [CONN-01, CONN-04, CONN-05]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 12 Plan 02: Connection Model, Encryption & Async URI Summary

**RecvizConnection ORM model with Fernet-encrypted credentials, EncryptionService, and async dialect URI builder for postgresql+asyncpg and oracle+oracledb**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T11:10:32Z
- **Completed:** 2026-04-09T11:13:57Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Created EncryptionService with Fernet AES-128-CBC + HMAC-SHA256 for credential encryption at rest
- Created RecvizConnection ORM model with all 15 columns from D-01 spec, using PortableJSON for extra_params
- Extended URI builder with build_async_uri supporting postgresql+asyncpg and oracle+oracledb dialects
- Added recviz_encryption_key to Settings config with env var support and .env.example documentation
- 31 total tests across 3 test files (9 encryption + 10 model + 12 URI builder)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for EncryptionService** - `284547c` (test)
2. **Task 1 (GREEN): EncryptionService + config + .env.example** - `bb84c01` (feat)
3. **Task 2 (RED): Failing tests for RecvizConnection model** - `5db8a57` (test)
4. **Task 2 (GREEN): RecvizConnection ORM model** - `20a724b` (feat)
5. **Task 3 (RED): Failing tests for build_async_uri** - `308ebe7` (test)
6. **Task 3 (GREEN): build_async_uri implementation** - `de29b1c` (feat)

_Note: All 3 tasks used TDD with RED/GREEN commits. No REFACTOR needed._

## Files Created/Modified
- `backend/app/services/encryption.py` - Fernet EncryptionService with encrypt/decrypt/generate_key
- `backend/app/db/models/connection.py` - RecvizConnection ORM model (15 columns, PortableJSON, unique name)
- `backend/.env.example` - Environment variable template with RECVIZ_ENCRYPTION_KEY
- `backend/tests/test_encryption.py` - 9 tests: round-trip, special chars, unicode, key generation, invalid keys
- `backend/tests/test_connection_model.py` - 10 tests: column validation, DDL on PG/Oracle, unique constraint, type checks
- `backend/app/config.py` - Added recviz_encryption_key field with dev-only default
- `backend/app/services/uri_builder.py` - Added ASYNC_DIALECTS mapping and build_async_uri function
- `backend/app/db/models/__init__.py` - Added RecvizConnection export
- `backend/tests/test_uri_builder.py` - Added 6 async URI tests alongside existing 6 sync tests

## Decisions Made
- Dev-only default Fernet key (`ZtmS2OQUhct4iBQmAcreQftJoeodRw4h7Rz3fU8ZPG4=`) in Settings -- production MUST override via env var
- encrypted_password uses Text type (not String) to accommodate variable-length Fernet ciphertext
- build_async_uri is a separate function -- existing build_sqlalchemy_uri untouched for backward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The dev-only default encryption key works out of the box for local development.

## Next Phase Readiness
- RecvizConnection model ready for Alembic migration generation (Plan 03)
- EncryptionService ready for ConnectionService to encrypt passwords on create/update
- build_async_uri ready for EngineManager to create async engines from connection records
- All 6 model classes now exported from models/__init__.py for Alembic autodiscovery

## Self-Check: PASSED

All 10 files verified present. All 6 commit hashes verified in git log.

---
*Phase: 12-engine-foundation*
*Completed: 2026-04-09*
