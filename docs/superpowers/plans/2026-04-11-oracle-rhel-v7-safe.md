# RecViz v7-safe — Rewrite of the Oracle + RHEL UI fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Reviews use superpowers:code-reviewer (NOT general-purpose agents with custom prompts).

**Goal:** Fix five user-reported UI bugs from the v6 RHEL smoke test without touching the Oracle driver or any global serialization infrastructure. Replaces the abandoned v7 rollout, which shipped two production-crash bugs in the Oracle NUMBER output type handler.

**Branch:** `deploy/oracle-v7-safe`, cut fresh from `a3b0b5c` (the v6 tarball commit). The broken `deploy/oracle-v2-20260409` branch is preserved as read-only historical record — not deployed from.

**Tech stack:** Python 3.12 + FastAPI + SQLAlchemy 2.0 sync + python-oracledb 3.3+ thick mode; React 19 + Vite 7 + TypeScript strict + TanStack Query 5 + Vitest 4.

---

## What we are NOT doing

- **No Oracle NUMBER output type handler.** The entire `backend/app/db/oracle_types.py` module from v7 caused both production crashes (first `Engine.info` AttributeError, then the SQLAlchemy 6-arg signature incompatibility, then a LOB `.encode()` cascade). We are not touching python-oracledb, `output_type_handler`, `connection.outputtypehandler`, or any `event.listens_for(engine, "connect")` handlers. Zero Oracle driver interference.
- **No frontend column-detection `typeHints`.** Dropped along with Issue 5 (KPI column dropdown empty on Oracle). Per explicit user instruction: skip Issue 5 entirely.
- **No global `CamelModel` datetime validator.** The v7 base-class validator worked but ran on every model in the project. The rewrite uses a localized `@field_serializer` on just the models that need it. Smaller blast radius, easier to audit.
- **No commit cherry-picks from the broken v7 branch.** User requested a rewrite, not a selective revert. Every line in this rollout is written fresh against the v6 baseline.

---

## Bugs being fixed

| # | Symptom | Root cause | Unit |
|---|---|---|---|
| 1 | Clicking "Test Connection" in the Settings data-source detail side panel throws a Postgres error even for Oracle | Detail panel sends `{backend: 'postgresql'}` (mount default) + empty form fields; backend `/api/databases/test` ignores `database_id` and rebuilds URI from body | Units 2 + 3 |
| 2a | Schema browser has no scrollbar; content is clipped | `<ScrollArea className="flex-1">` in `schema-browser.tsx` is missing `min-h-0`; the default `min-height: auto` prevents Radix from ever activating | Unit 3 |
| 2b | Running a query in Data Explorer returns 404 | Explorer never selects a database; `useSqlExecute` defaults `database_id` to `''`; backend raises 404 on empty-string connection lookup | Unit 4 |
| 3 | Just-saved dataset shows "6 hours ago" | Oracle `TIMESTAMP WITH TIME ZONE` round-trips as naive datetime; Pydantic emits without offset; JS parses as local IST; 5:30 hour drift rounds to "about 6 hours" | Unit 1 |
| 4 | KPI builder preview panel has no scrollbar in the dataset step | `kpi-builder-preview.tsx` has unbounded `overflow-auto` wrappers in flow layout; neither ever activates | Unit 5 |

**Explicitly skipped:** Issue 5 (KPI column dropdown empty on Oracle) — the fix requires driver-level Decimal-to-JS-number coercion, which caused both v7 production crashes. Not attempted in this rollout.

---

## Architecture — the 6 units

| Unit | Layer | Bug | Depends on |
|---|---|---|---|
| 0 | — | Baseline verification | — |
| 1 | Backend | #3 datetime | — |
| 2 | Backend | #1 backend | — |
| 3 | Frontend | #1 frontend + #2a | Unit 2 (endpoint contract) |
| 4 | Frontend | #2b | — |
| 5 | Frontend | #4 | — |
| 6 | — | Final review + tarball | all previous |

Six commits on the feature branch plus any review-fix commits. Review discipline: every unit gets BOTH a spec-compliance review AND a code-quality review via `superpowers:code-reviewer`. No general-purpose agents doing custom-prompted reviews this time.

---

# Task 0: Unit 0 — Baseline verification

**Goal:** confirm the working tree is clean at `a3b0b5c` and both test suites pass before stacking new work on top. No code changes.

**Files:** none.

- [ ] **Step 1: Check git state**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
git status --short
git log --oneline -3
git branch --show-current
```

Expected:
- Working tree clean (except `frontend/.env.production` untracked — ignore)
- Current branch: `deploy/oracle-v7-safe`
- Top commit: `a3b0b5c chore: remove orphan models/export.py`

- [ ] **Step 2: Run backend test suite**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
source venv/bin/activate
python -m pytest 2>&1 | tail -10
```

Expected: `115 passed`.

- [ ] **Step 3: Run frontend test suite + vite build**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm exec vitest run 2>&1 | tail -10
pnpm exec vite build 2>&1 | tail -5
```

Expected: `Tests 229 passed (229)` and `✓ built in Ns`.

- [ ] **Step 4: Record the starting point**

No commit. Verification gate only. If anything fails, stop and fix before starting Unit 1.

---

# Task 1: Unit 1 — Localized UTC datetime fix for Issue 3

**Goal:** fix the "saved 6 hours ago" bug by ensuring datetimes in responses carry a UTC offset, using a **localized** `@field_serializer` on the one Pydantic model that matters plus a helper for the one dict-path endpoint. No base-class `CamelModel` change.

**Files:**
- Modify: `backend/app/models/managed_dataset.py` — add `@field_serializer` on `DatasetResponse` datetime fields
- Modify: `backend/app/api/databases.py` — add `_utc_isoformat` helper + use it in `_build_response`
- Create: `backend/tests/test_utc_datetime_fix.py` — tests for both code paths

## Why localized instead of the v7 base-class approach

v7's approach was a `@model_validator(mode='after')` on `CamelModel` that walked all fields and coerced naive datetimes. It worked, but it ran on every Pydantic model in the project — too broad. A future maintainer adding a non-UTC datetime field (e.g., a user-supplied local-time field from a form) would have it silently reinterpreted as UTC.

The localized approach only touches the two places where the bug was actually reported:
1. `DatasetResponse.created_at` / `updated_at` — the dataset list endpoint, Issue 3's exact symptom
2. `_build_response` in `databases.py` — the Settings data-sources card's `lastTested` / `createdOn`, which surfaced as a latent risk during the v7 final review

Other code paths keep the old behavior. If a future model needs the same fix, add `@field_serializer` to that model specifically.

- [ ] **Step 1: Write the failing test for DatasetResponse serialization**

Create `backend/tests/test_utc_datetime_fix.py`:

```python
"""Tests for the localized UTC datetime fix (Unit 1, v7-safe).

Two code paths covered:
  1. DatasetResponse (Pydantic model) — uses @field_serializer
  2. _build_response in databases.py (dict path) — uses _utc_isoformat helper
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest


def test_dataset_response_naive_datetime_serializes_with_offset():
    """A DatasetResponse built with naive datetime values (simulating an
    Oracle TIMESTAMP WITH TIME ZONE roundtrip that dropped tzinfo) must
    emit "+00:00" in JSON output. Otherwise the frontend parses as local
    time and shows "6 hours ago" for a just-saved row on IST."""
    from app.models.managed_dataset import DatasetResponse

    response = DatasetResponse(
        id="test-id",
        name="Test Dataset",
        description="",
        database_id="db-1",
        sql="SELECT 1",
        columns=[],
        schema_version=1,
        created_at=datetime(2026, 4, 11, 13, 27, 0),  # naive
        updated_at=datetime(2026, 4, 11, 13, 27, 0),  # naive
    )

    json_str = response.model_dump_json()

    # Must contain offset marker. Pydantic v2 emits "+00:00" or "Z"
    # depending on configuration; accept either.
    assert "+00:00" in json_str or "Z" in json_str, (
        f"Expected UTC offset marker in serialized JSON, got: {json_str}"
    )
    # Must NOT contain a bare naive ISO form.
    assert '"2026-04-11T13:27:00"' not in json_str


def test_dataset_response_aware_datetime_preserved():
    """A tz-aware datetime should pass through serialization unchanged —
    the serializer must not double-coerce."""
    from app.models.managed_dataset import DatasetResponse

    response = DatasetResponse(
        id="test-id",
        name="Test Dataset",
        description="",
        database_id="db-1",
        sql="SELECT 1",
        columns=[],
        schema_version=1,
        created_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
    )

    json_str = response.model_dump_json()
    assert "+00:00" in json_str or "Z" in json_str


def test_utc_isoformat_none_returns_none():
    """_utc_isoformat(None) must return None — used for optional
    last_tested / created_on fields."""
    from app.api.databases import _utc_isoformat

    assert _utc_isoformat(None) is None


def test_utc_isoformat_naive_datetime_adds_offset():
    """_utc_isoformat must coerce naive datetimes to UTC-aware and emit
    the offset suffix."""
    from app.api.databases import _utc_isoformat

    naive = datetime(2026, 4, 11, 13, 27, 0)
    result = _utc_isoformat(naive)

    assert result is not None
    assert result.endswith("+00:00")
    assert "2026-04-11T13:27:00" in result


def test_utc_isoformat_aware_datetime_preserved():
    """_utc_isoformat must not double-coerce already-aware datetimes."""
    from app.api.databases import _utc_isoformat

    aware = datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc)
    result = _utc_isoformat(aware)

    assert result == aware.isoformat()
    assert result.endswith("+00:00")
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
source venv/bin/activate
python -m pytest tests/test_utc_datetime_fix.py -v 2>&1 | tail -20
```

Expected: the `DatasetResponse` tests fail because there's no `@field_serializer` yet; the `_utc_isoformat` tests fail with `ImportError` because the helper doesn't exist.

- [ ] **Step 3: Add the `@field_serializer` to `DatasetResponse`**

Read the current file:

```bash
cat backend/app/models/managed_dataset.py | head -50
```

Find the imports and the `DatasetResponse` class. Modify the imports to include `field_serializer`:

```python
from datetime import datetime, timezone
from typing import Literal

from pydantic import Field, field_serializer

from app.models.base import CamelModel
```

Then modify the `DatasetResponse` class to add a serializer:

```python
class DatasetResponse(CamelModel):
    id: str
    name: str
    description: str
    database_id: str
    sql: str
    columns: list[ColumnMetaSchema]
    schema_version: int
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def _serialize_datetime_with_utc_offset(self, dt: datetime) -> str:
        """Emit ISO 8601 with a UTC offset marker, even for naive datetimes.

        Oracle TIMESTAMP WITH TIME ZONE roundtrips via oracledb can yield
        naive Python datetimes at the Pydantic boundary. Pydantic's default
        ISO serializer drops the offset for naive datetimes, and the
        frontend's ``new Date(...)`` parses the result as local time. On
        an IST deployment that produces a ~5:30h drift → "saved 6 hours
        ago" for a just-created row.

        Assumes naive datetimes are conceptually UTC — which is true for
        RecViz since every Python call site uses ``datetime.now(timezone.utc)``.
        """
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
```

- [ ] **Step 4: Add the `_utc_isoformat` helper to `databases.py`**

Read the current `_build_response` and its imports:

```bash
sed -n '1,30p' backend/app/api/databases.py
sed -n '75,95p' backend/app/api/databases.py
```

At the top of `databases.py`, ensure `from datetime import datetime, timezone` is imported (it already is from v6). No import change needed.

Add the helper function immediately above `_build_response`:

```python
def _utc_isoformat(dt: "datetime | None") -> "str | None":
    """Return an ISO 8601 string with a UTC offset for an ORM datetime value.

    Mirrors the DatasetResponse @field_serializer for code paths that
    bypass Pydantic (route handlers returning plain dicts). Naive
    datetimes are assumed to be conceptually UTC and are rewritten with
    ``timezone.utc``; already-aware datetimes pass through unchanged.
    None passes through as None for optional fields.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()
```

Then update `_build_response` to use the helper:

```python
def _build_response(conn: RecvizConnection) -> dict:
    """Build a response dict matching the DatabaseInfo shape from a connection record.

    Reads status + last_tested_at directly from the DB row (persistent across
    restarts). The in-memory ConnectionStatusTracker is no longer the source
    of truth for display — it only overlays runtime observations during
    normal query operation via QueryExecutor's mark_connected / mark_unreachable.

    Datetime fields go through _utc_isoformat so the Settings data-sources
    card never receives a naive ISO string from an Oracle TIMESTAMP WITH
    TIME ZONE roundtrip (same root cause as Issue 3 for the datasets list).
    """
    return {
        "id": conn.id,
        "database_name": conn.display_name,
        "backend": conn.backend,
        "created_on": _utc_isoformat(conn.created_at),
        "expose_in_sqllab": True,
        "status": conn.status or "untested",
        "last_tested": _utc_isoformat(conn.last_tested_at),
    }
```

- [ ] **Step 5: Verify existing `test_db_status_persistence.py` doesn't break**

The existing v6 test `test_build_response_reads_from_db_column` asserts:

```python
assert response["last_tested"] == conn.last_tested_at.isoformat()
```

On SQLite (which strips tzinfo on roundtrip), `conn.last_tested_at` is naive, so `conn.last_tested_at.isoformat()` is a bare ISO string — no offset. But the new `_build_response` coerces via `_utc_isoformat`, so `response["last_tested"]` WILL have the offset. This test needs to be updated.

Change line 89 of `backend/tests/test_db_status_persistence.py` from:

```python
assert response["last_tested"] == conn.last_tested_at.isoformat()
```

to:

```python
# _build_response now coerces naive datetimes to UTC-aware via
# _utc_isoformat. On SQLite the ORM strips tzinfo during roundtrip,
# so conn.last_tested_at is naive — the response adds the +00:00
# offset regardless.
assert response["last_tested"] is not None
assert response["last_tested"].endswith("+00:00")
```

- [ ] **Step 6: Re-run all tests**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
python -m pytest tests/test_utc_datetime_fix.py tests/test_db_status_persistence.py -v 2>&1 | tail -20
python -m pytest 2>&1 | tail -10
```

Expected:
- `test_utc_datetime_fix.py`: 5 passed
- `test_db_status_persistence.py`: 6 passed (existing 6 tests still green with the updated assertion)
- Full suite: 120 passed (was 115, +5 new from Unit 1)

- [ ] **Step 7: Commit**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
git add backend/app/models/managed_dataset.py \
        backend/app/api/databases.py \
        backend/tests/test_utc_datetime_fix.py \
        backend/tests/test_db_status_persistence.py
git commit -m "$(cat <<'MSGEOF'
fix(datetime): UTC offset for dataset + databases responses (Issue 3)

Unit 1 of the v7-safe rollout. Oracle TIMESTAMP WITH TIME ZONE
round-trips through oracledb + SQLAlchemy can yield naive Python
datetime values at the Pydantic boundary. Without a UTC offset
marker in the serialized JSON, the frontend's new Date(...) parses
the result as local time. On an IST deployment (UTC+5:30), a
just-saved dataset shows "saved 6 hours ago" because the 5:30 drift
rounds up in date-fns formatDistanceToNow.

Localized fix (replaces the v7 global CamelModel validator that ran
on every Pydantic model in the project):

1. DatasetResponse.created_at / updated_at get a @field_serializer
   that rewrites naive datetimes as UTC-aware before serialization.
   Scoped to the one model that surfaces the bug.

2. backend/app/api/databases.py gets a _utc_isoformat helper that
   covers the dict-path /api/databases endpoint's created_on /
   last_tested fields. _build_response uses it uniformly.

Both assume naive datetimes are conceptually UTC — which is true for
RecViz since every Python write call uses datetime.now(timezone.utc).

Tests: backend/tests/test_utc_datetime_fix.py (5 new tests) covers
DatasetResponse with naive and aware datetimes, plus the helper's
None/naive/aware branches. Updated the existing SQLite-based
test_build_response_reads_from_db_column assertion to expect the
new +00:00 suffix (SQLite roundtrips strip tzinfo, so the helper's
coercion is what adds the offset).

Backend suite: 120 passed (was 115, +5 new).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
MSGEOF
)"
```

---

# Task 2: Unit 2 — Backend test-connection by database_id (Issue 1 backend)

**Goal:** `POST /api/databases/test` accepts a minimal `{backend, databaseId}` body for the detail-panel case. When `databaseId` is set and `host` is empty/missing, load the stored `RecvizConnection`, decrypt the password via `EncryptionService`, and build the URI from the stored fields. The create/edit path (body has explicit host) stays unchanged.

**Files:**
- Modify: `backend/app/api/databases.py` — branch the `test_connection` handler
- Create: `backend/tests/test_test_connection_by_id.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_test_connection_by_id.py`:

```python
"""Tests for POST /api/databases/test with database_id (Unit 2, v7-safe)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.connection import RecvizConnection
from app.services.encryption import EncryptionService


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def _make_request(encryption: EncryptionService, tracker=None) -> SimpleNamespace:
    return SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(
                encryption=encryption,
                connection_status=tracker,
            )
        )
    )


def _seed_oracle_connection(
    session: Session, encryption: EncryptionService
) -> RecvizConnection:
    conn = RecvizConnection(
        id="test-uuid",
        name="prod_oracle",
        display_name="Prod Oracle",
        backend="oracle",
        host="oracle.prod.example.com",
        port=1521,
        database_name="ORCL",
        schema_name="RECON",
        username="recon_user",
        encrypted_password=encryption.encrypt("secret123"),
        status="untested",
    )
    session.add(conn)
    session.commit()
    return conn


def test_test_connection_with_database_id_uses_stored_creds(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """When body has only database_id, the endpoint loads the connection
    row, uses the stored credentials, and persists status='connected'."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest

    encryption = EncryptionService(EncryptionService.generate_key())
    conn = _seed_oracle_connection(sqlite_session, encryption)

    captured = {}

    def _fake_test_connection(uri: str, backend: str, timeout: int = 10):
        captured["uri"] = uri
        captured["backend"] = backend
        return True, "Connection successful"

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_fake_test_connection),
    )

    body = TestConnectionRequest(backend="oracle", database_id="test-uuid")
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is True
    assert "oracle.prod.example.com" in captured["uri"]
    assert "recon_user" in captured["uri"]
    assert captured["backend"] == "oracle"

    sqlite_session.refresh(conn)
    assert conn.status == "connected"
    assert conn.last_tested_at is not None


def test_test_connection_with_explicit_body_bypasses_lookup(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """When body has explicit host, the endpoint uses the body verbatim
    and does NOT consult the stored row (backward compat with create/edit)."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest

    encryption = EncryptionService(EncryptionService.generate_key())
    captured = {}

    def _fake_test_connection(uri: str, backend: str, timeout: int = 10):
        captured["uri"] = uri
        return True, "Connection successful"

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_fake_test_connection),
    )

    body = TestConnectionRequest(
        backend="postgresql",
        host="new-host.example.com",
        port=5432,
        database="newdb",
        username="newuser",
        password="newpass",
    )
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is True
    assert "new-host.example.com" in captured["uri"]
    assert "newuser" in captured["uri"]


def test_test_connection_with_database_id_not_found_returns_failure(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """Detail-panel test against a non-existent database_id returns a
    structured failure, does NOT raise, does NOT reach EngineManager."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest

    encryption = EncryptionService(EncryptionService.generate_key())

    def _should_not_be_called(*args, **kwargs):
        pytest.fail(
            "EngineManager.test_connection should not run when the row is missing"
        )

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_should_not_be_called),
    )

    body = TestConnectionRequest(backend="oracle", database_id="does-not-exist")
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is False
    assert "not found" in result["message"].lower()


def test_test_connection_with_database_id_decrypt_failure(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """If the stored password cannot be decrypted (corrupt ciphertext or
    wrong key), the endpoint returns a generic client-safe failure — no
    ciphertext leak, and EngineManager is not called."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest
    from cryptography.fernet import InvalidToken

    encryption = EncryptionService(EncryptionService.generate_key())
    _seed_oracle_connection(sqlite_session, encryption)

    def _fail_decrypt(_ciphertext: str) -> str:
        raise InvalidToken()

    monkeypatch.setattr(encryption, "decrypt", _fail_decrypt)

    def _should_not_be_called(*args, **kwargs):
        pytest.fail(
            "EngineManager.test_connection should not run after a decrypt failure"
        )

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_should_not_be_called),
    )

    body = TestConnectionRequest(backend="oracle", database_id="test-uuid")
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is False
    assert "decrypt" in result["message"].lower()
    assert "secret123" not in result["message"]


def test_test_connection_with_database_id_connect_failure_persists_unreachable(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """When the test against stored credentials fails (DB unreachable),
    the endpoint persists status='unreachable' + last_tested_at."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest

    encryption = EncryptionService(EncryptionService.generate_key())
    conn = _seed_oracle_connection(sqlite_session, encryption)

    def _fake_test_connection(uri: str, backend: str, timeout: int = 10):
        return False, "ORA-12541: TNS:no listener"

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_fake_test_connection),
    )

    body = TestConnectionRequest(backend="oracle", database_id="test-uuid")
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is False

    sqlite_session.refresh(conn)
    assert conn.status == "unreachable"
    assert conn.last_tested_at is not None
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
python -m pytest tests/test_test_connection_by_id.py -v 2>&1 | tail -20
```

Expected: 4 of 5 tests fail (the explicit-body test incidentally passes against the v6 endpoint). The endpoint currently builds URI from body always.

- [ ] **Step 3: Update `test_connection` in `backend/app/api/databases.py`**

Read the current endpoint:

```bash
sed -n '320,370p' backend/app/api/databases.py
```

Replace the entire `@router.post("/test")` block with the branched version:

```python
@router.post("/test")
def test_connection(
    body: TestConnectionRequest,
    session: DbSessionDep,
    request: Request,
) -> dict:
    """Test database connectivity using a disposable engine.

    Two modes:

    1. **Detail-panel test** (body has ``database_id`` and no ``host``):
       Load the stored ``RecvizConnection`` row, decrypt its password,
       and build the URI from the stored fields. Called by the Settings
       data-source detail side panel, which only has the id of an
       already-saved connection, not the credentials.

    2. **Create/edit test** (body has explicit ``host`` + credentials):
       Build the URI from the body as before. Called by the Create/Edit
       form before the connection has been saved.

    Either way, the result is persisted to ``recviz_connections.status``
    when ``database_id`` is provided, and written to the in-memory
    tracker for runtime observation.
    """
    tracker = _get_status_tracker(request)

    # Detail-panel mode: look up the stored connection and use its creds.
    if body.database_id and not body.host:
        encryption = _get_encryption(request)
        conn = session.execute(
            select(RecvizConnection).where(RecvizConnection.id == body.database_id)
        ).scalar_one_or_none()
        if conn is None:
            return {
                "success": False,
                "message": f"Database connection '{body.database_id}' not found",
            }
        try:
            password = encryption.decrypt(conn.encrypted_password)
        except Exception as exc:
            logger.warning(
                "Failed to decrypt stored credentials for %s: %s", conn.id, exc
            )
            return {
                "success": False,
                "message": "Failed to decrypt stored credentials",
            }

        backend = conn.backend
        try:
            uri = build_sync_uri(
                backend=backend,
                host=conn.host or "",
                port=conn.port,
                database=conn.database_name,
                username=conn.username,
                password=password,
            )
            success, message = EngineManager.test_connection(uri, backend, timeout=10)
        except Exception as exc:
            logger.warning("Connection test by database_id failed: %s", exc)
            if tracker is not None:
                tracker.mark_unreachable(body.database_id)
            conn.status = "unreachable"
            conn.last_tested_at = datetime.now(timezone.utc)
            session.flush()
            return {
                "success": False,
                "message": f"Connection error: {sanitize_detail(exc)}",
            }
    else:
        # Create/edit mode: URI from body.
        try:
            uri = build_sync_uri(
                backend=body.backend,
                host=body.host or "",
                port=body.port,
                database=body.database,
                username=body.username,
                password=body.password,
            )
            success, message = EngineManager.test_connection(uri, body.backend)
        except ValueError as e:
            return {"success": False, "message": str(e)}
        except Exception as e:
            logger.warning("Connection test error: %s", e)
            if tracker is not None and body.database_id is not None:
                tracker.mark_unreachable(body.database_id)
            return {
                "success": False,
                "message": f"Connection error: {sanitize_detail(e)}",
            }

    # Shared post-branch: update tracker + persist status.
    if tracker and body.database_id is not None:
        if success:
            tracker.mark_connected(body.database_id)
        else:
            tracker.mark_unreachable(body.database_id)

    if body.database_id:
        conn_row = session.execute(
            select(RecvizConnection).where(RecvizConnection.id == body.database_id)
        ).scalar_one_or_none()
        if conn_row is not None:
            conn_row.status = "connected" if success else "unreachable"
            conn_row.last_tested_at = datetime.now(timezone.utc)
            session.flush()

    return {"success": success, "message": message}
```

- [ ] **Step 4: Re-run the tests**

```bash
python -m pytest tests/test_test_connection_by_id.py -v 2>&1 | tail -15
```

Expected: `5 passed`.

- [ ] **Step 5: Run the full backend suite**

```bash
python -m pytest 2>&1 | tail -10
```

Expected: `125 passed` (was 120 after Unit 1, +5 new from Unit 2).

- [ ] **Step 6: Commit**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
git add backend/app/api/databases.py backend/tests/test_test_connection_by_id.py
git commit -m "$(cat <<'MSGEOF'
fix(databases): test-connection by database_id uses stored creds (Issue 1)

Unit 2 of the v7-safe rollout. The Settings data-source detail side
panel's "Test Connection" button could not work because:

  1. The frontend sent { backend: 'postgresql', host: undefined, ... }
     (the panel's local state defaults) plus a databaseId;
  2. The backend /api/databases/test endpoint rebuilt the URI from
     the body fields and ignored databaseId entirely.

Result: clicking Test on an Oracle data source surfaced a Postgres
connection error, which looked like a backend bug but was really a
frontend-backend contract gap.

This commit adds a detail-panel branch to POST /api/databases/test.
When the body has databaseId but no host, the endpoint loads the
RecvizConnection row, decrypts the stored password via
EncryptionService, and builds the URI from the stored fields. The
create/edit path (body has explicit host) is unchanged — still
builds the URI from the body verbatim.

Failure paths:
  - databaseId not found --> {success: false, ...}
  - decrypt failure       --> generic client message, no ciphertext leak
  - connect failure       --> persists status='unreachable' via the
                               shared post-branch block

Tests: backend/tests/test_test_connection_by_id.py (5 tests) covers
the stored-creds happy path (with persistence assertion), the
explicit-body compat path, not-found failure, decrypt failure
(asserts no plaintext leak), and connect failure persistence.

The frontend half of the fix (detail panel sending { backend,
databaseId } instead of the full form) lands in Unit 3.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
MSGEOF
)"
```

---

# Task 3: Unit 3 — Frontend detail panel rewire + schema browser scrollbar

**Goal:** wire the detail panel's Test Connection button to a new handler that sends the minimal `{backend, databaseId}` shape (consuming the Unit 2 endpoint contract). Also add `min-h-0` to the schema browser's ScrollArea so its scrollbar activates.

**Files:**
- Modify: `frontend/src/components/settings/data-source-sheet.tsx` — new `handleTestDetailConnection` handler; DetailView's test button uses it
- Modify: `frontend/src/components/explorer/schema-browser.tsx` — add `min-h-0`
- Create: `frontend/src/components/settings/data-source-sheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/settings/data-source-sheet.test.tsx`:

```tsx
// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/hooks/use-databases', () => {
  const testMutate = vi.fn()
  return {
    useDatabase: () => ({
      data: {
        id: 'db-oracle-1',
        databaseName: 'Prod Oracle',
        backend: 'oracle' as const,
        status: 'connected',
        lastTested: null,
        createdOn: null,
        exposeInSqllab: true,
      },
      isLoading: false,
    }),
    useDatabaseDatasets: () => ({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    }),
    useCreateDatabase: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateDatabase: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteDatabase: () => ({ mutate: vi.fn(), isPending: false }),
    useTestConnection: () => ({ mutate: testMutate, isPending: false }),
    useSyncDatasets: () => ({ mutate: vi.fn(), isPending: false }),
    __testMutate: testMutate,
  }
})

import { DataSourceSheet } from './data-source-sheet'
import * as useDatabasesModule from '@/hooks/use-databases'

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('DataSourceSheet test connection payload shape', () => {
  const testMutate = (useDatabasesModule as unknown as {
    __testMutate: ReturnType<typeof vi.fn>
  }).__testMutate

  it('detail panel sends only { backend, databaseId }', () => {
    testMutate.mockClear()
    renderWithQuery(
      <DataSourceSheet
        open={true}
        onOpenChange={vi.fn()}
        mode="detail"
        databaseId="db-oracle-1"
        onModeChange={vi.fn()}
      />,
    )

    const testButton = screen.getByRole('button', { name: /test connection/i })
    fireEvent.click(testButton)

    expect(testMutate).toHaveBeenCalledTimes(1)
    const payload = testMutate.mock.calls[0][0]

    expect(payload.backend).toBe('oracle')
    expect(payload.databaseId).toBe('db-oracle-1')
    expect(payload.host).toBeUndefined()
    expect(payload.port).toBeUndefined()
    expect(payload.database).toBeUndefined()
    expect(payload.username).toBeUndefined()
    expect(payload.password).toBeUndefined()
  })

  it('create form sends the full connection body', () => {
    testMutate.mockClear()
    renderWithQuery(
      <DataSourceSheet
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        databaseId={null}
        onModeChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /oracle/i }))
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'test_oracle' },
    })
    fireEvent.change(screen.getByLabelText(/host/i), {
      target: { value: 'ora.example.com' },
    })
    fireEvent.change(screen.getByLabelText(/service name/i), {
      target: { value: 'ORCL' },
    })
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'recon_user' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'supersecret' },
    })

    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))

    expect(testMutate).toHaveBeenCalledTimes(1)
    const payload = testMutate.mock.calls[0][0]

    expect(payload.backend).toBe('oracle')
    expect(payload.host).toBe('ora.example.com')
    expect(payload.database).toBe('ORCL')
    expect(payload.username).toBe('recon_user')
    expect(payload.password).toBe('supersecret')
    expect(payload.databaseId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm exec vitest run src/components/settings/data-source-sheet.test.tsx 2>&1 | tail -25
```

Expected: the detail-panel test fails because the current handler sends `backend='postgresql'` (mount default) + empty form values. The create-form test may also fail because of assertion differences.

- [ ] **Step 3: Add `handleTestDetailConnection` in `data-source-sheet.tsx`**

Find the existing `handleTestConnection` block (around line 205-226) and add a new handler right after it:

```tsx
  const handleTestDetailConnection = () => {
    if (!databaseDetail) return
    setTestResult(null)
    const payload: TestConnectionRequest = {
      backend: databaseDetail.backend,
      databaseId: databaseDetail.id,
    }
    testMutation.mutate(payload, {
      onSuccess: (res) => {
        setTestResult(res)
      },
      onError: () => setTestResult({ success: false, message: 'Request failed' }),
    })
  }
```

Then find the `DetailView` component invocation (around line 298-317) and change:

```tsx
            onTestConnection={handleTestConnection}
```

to:

```tsx
            onTestConnection={handleTestDetailConnection}
```

- [ ] **Step 4: Run the vitest**

```bash
pnpm exec vitest run src/components/settings/data-source-sheet.test.tsx 2>&1 | tail -15
```

Expected: `2 passed`.

- [ ] **Step 5: Fix the schema browser scrollbar**

In `frontend/src/components/explorer/schema-browser.tsx`, find the `<ScrollArea>` line (around line 109):

```tsx
      <ScrollArea className="flex-1">
```

Replace with:

```tsx
      <ScrollArea className="flex-1 min-h-0">
```

- [ ] **Step 6: Verify the schema browser test still passes**

```bash
pnpm exec vitest run src/components/explorer/schema-browser.test.tsx 2>&1 | tail -10
```

Expected: `3 passed`.

- [ ] **Step 7: Full frontend suite + vite build**

```bash
pnpm exec vitest run 2>&1 | tail -10
pnpm exec vite build 2>&1 | tail -5
```

Expected: `Tests 231 passed (231)` (was 229, +2 new) and `✓ built in Ns`.

- [ ] **Step 8: Commit**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
git add frontend/src/components/settings/data-source-sheet.tsx \
        frontend/src/components/settings/data-source-sheet.test.tsx \
        frontend/src/components/explorer/schema-browser.tsx
git commit -m "$(cat <<'MSGEOF'
fix(ui): detail panel test-by-id + schema browser scrollbar

Unit 3 of the v7-safe rollout.

Issue 1 (detail panel test): DataSourceSheet.DetailView was wired to
handleTestConnection, which builds its payload from local React
state (backend + formValues). In detail mode those are the mount
defaults (backend='postgresql', formValues={}), so clicking Test on
an Oracle data source sent { backend: 'postgresql', host: undefined,
...} to the backend — surfacing a Postgres connection error for an
Oracle row.

New handleTestDetailConnection handler sends only the minimal shape
the Unit 2 backend expects: { backend: databaseDetail.backend,
databaseId: databaseDetail.id }. The backend loads the stored
RecvizConnection row and uses its credentials.

The FormView create/edit path still calls the original
handleTestConnection, so create/edit flows are unchanged.

Issue 2a (schema browser scrollbar): <ScrollArea className="flex-1">
was missing min-h-0. In a flex-column parent, the default
min-height: auto on flex items grew the ScrollArea root beyond the
allotted space, preventing the Radix Viewport (size-full) from
having a concrete bounded height. The content overflowed and was
clipped by the parent card's overflow-hidden with no visible
scrollbar.

Fix: flex-1 min-h-0. The ScrollArea now renders its styled
(theme-aware) scrollbar whenever the schema has enough tables to
overflow.

Tests:
  - data-source-sheet.test.tsx (new, 2 tests) verifies both the
    detail-panel minimal payload and the create form full payload
  - schema-browser.test.tsx (unchanged, 3 tests still pass)

Frontend suite: 231 passed (was 229, +2).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
MSGEOF
)"
```

---

# Task 4: Unit 4 — Data Explorer database selector

**Goal:** lift `selectedDbId` to the Explorer page, add a header dropdown, wire to `useSqlExecute` + `SaveAsDatasetDialog`, make `SchemaBrowser` optionally controlled, add `disabled` prop to `SqlEditor` so Run is greyed out with visible helper text when no DB is selected.

**Files:**
- Modify: `frontend/src/routes/_app/explorer/index.tsx`
- Modify: `frontend/src/components/explorer/schema-browser.tsx`
- Modify: `frontend/src/components/explorer/sql-editor.tsx`

- [ ] **Step 1: Extend `SqlEditor` with `disabled` and `disabledReason` props**

In `frontend/src/components/explorer/sql-editor.tsx`, find the `SqlEditorProps` interface:

```tsx
interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  isRunning: boolean
}
```

Replace with:

```tsx
interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  isRunning: boolean
  /** Optional extra disable reason — e.g. no database selected.
   * When true, the Run button is disabled regardless of value/isRunning. */
  disabled?: boolean
  /** Optional helper text shown next to the Run button when disabled. */
  disabledReason?: string
}
```

Find the function signature:

```tsx
export function SqlEditor({ value, onChange, onRun, isRunning }: SqlEditorProps) {
```

Replace with:

```tsx
export function SqlEditor({
  value,
  onChange,
  onRun,
  isRunning,
  disabled = false,
  disabledReason,
}: SqlEditorProps) {
```

Find the Run button block:

```tsx
          <span className="text-xs text-muted-foreground items-center gap-1 hidden sm:flex">
            <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>+<Kbd>↵</Kbd> to run
          </span>
          <Button size="sm" onClick={onRun} disabled={isRunning || !value.trim()} className="h-7">
```

Replace with:

```tsx
          {disabled && disabledReason ? (
            <span className="text-xs text-muted-foreground italic">
              {disabledReason}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground items-center gap-1 hidden sm:flex">
              <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>+<Kbd>↵</Kbd> to run
            </span>
          )}
          <Button
            size="sm"
            onClick={onRun}
            disabled={disabled || isRunning || !value.trim()}
            className="h-7"
          >
```

- [ ] **Step 2: Extend `SchemaBrowser` with optional controlled-selection props**

In `frontend/src/components/explorer/schema-browser.tsx`, find the `SchemaBrowserProps` interface:

```tsx
interface SchemaBrowserProps {
  onInsertTable: (tableName: string) => void
  onInsertColumn: (columnName: string) => void
}
```

Replace with:

```tsx
interface SchemaBrowserProps {
  onInsertTable: (tableName: string) => void
  onInsertColumn: (columnName: string) => void
  /** Optional controlled database selection. When provided, the
   * internal Select becomes read-only and the browser surfaces
   * changes via onSelectedDbIdChange. When omitted, the browser
   * manages its own internal state (original behavior). */
  selectedDbId?: string
  onSelectedDbIdChange?: (dbId: string) => void
}
```

Change the component signature:

```tsx
export function SchemaBrowser({
  onInsertTable,
  onInsertColumn,
}: SchemaBrowserProps) {
```

Replace with:

```tsx
export function SchemaBrowser(props: SchemaBrowserProps) {
  const { onInsertTable, onInsertColumn } = props
```

Find the internal state block:

```tsx
  const { data: databases = [], isLoading: dbsLoading } = useDatabases()
  const [selectedDbId, setSelectedDbId] = useState<string>('')

  useEffect(() => {
    if (!selectedDbId && databases.length > 0) {
      setSelectedDbId(databases[0].id)
    }
  }, [databases, selectedDbId])
```

Replace with:

```tsx
  const { data: databases = [], isLoading: dbsLoading } = useDatabases()
  const [internalSelectedDbId, setInternalSelectedDbId] = useState<string>('')

  const isControlled = props.selectedDbId !== undefined
  const selectedDbId = isControlled ? (props.selectedDbId ?? '') : internalSelectedDbId
  const setSelectedDbId = (dbId: string) => {
    if (isControlled) {
      props.onSelectedDbIdChange?.(dbId)
    } else {
      setInternalSelectedDbId(dbId)
    }
  }

  useEffect(() => {
    if (isControlled) return
    if (!internalSelectedDbId && databases.length > 0) {
      setInternalSelectedDbId(databases[0].id)
    }
  }, [databases, internalSelectedDbId, isControlled])
```

Then hide the SchemaBrowser's internal database dropdown when in controlled mode (the Explorer has its own header dropdown, so two synced dropdowns would be redundant). Find the internal dropdown block:

```tsx
      <div className="p-2 border-b shrink-0">
        <Select value={selectedDbId} onValueChange={setSelectedDbId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select database" />
          </SelectTrigger>
          <SelectContent>
            {databases.map((db) => (
              <SelectItem key={db.id} value={db.id}>
                {db.databaseName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
```

Replace with:

```tsx
      {/* Internal database dropdown — only rendered in uncontrolled mode.
          When the parent owns selectedDbId (Explorer page), the parent's
          header dropdown is the single source of truth and this internal
          one would be a duplicate. */}
      {!isControlled && (
        <div className="p-2 border-b shrink-0">
          <Select value={selectedDbId} onValueChange={setSelectedDbId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              {databases.map((db) => (
                <SelectItem key={db.id} value={db.id}>
                  {db.databaseName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
```

- [ ] **Step 3: Verify the existing schema-browser tests still pass**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm exec vitest run src/components/explorer/schema-browser.test.tsx 2>&1 | tail -10
```

Expected: `3 passed` (tests use the uncontrolled path, which still works).

- [ ] **Step 4: Replace the Explorer page**

Replace the entire contents of `frontend/src/routes/_app/explorer/index.tsx` with:

```tsx
import { useState, useCallback, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Database } from 'lucide-react'

import { useSqlExecute } from '@/hooks/use-sql-execute'
import { useDatabases } from '@/hooks/use-databases'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SqlEditor } from '@/components/explorer/sql-editor'
import { SchemaBrowser } from '@/components/explorer/schema-browser'
import { QueryResults } from '@/components/explorer/query-results'
import { QueryHistory } from '@/components/explorer/query-history'
import { ChartBuilderDialog } from '@/components/explorer/chart-builder-dialog'
import { SaveAsDatasetDialog } from '@/components/explorer/save-as-dataset-dialog'
import type { SqlResult } from '@/types/api'

export const Route = createFileRoute('/_app/explorer/')({
  component: Explorer,
})

const DEFAULT_SQL = ''

function Explorer() {
  const { data: databases = [] } = useDatabases()

  const [selectedDbId, setSelectedDbId] = useState<string>('')
  const [sql, setSql] = useState(DEFAULT_SQL)
  const [result, setResult] = useState<SqlResult | null>(null)
  const [executionTime, setExecutionTime] = useState<number | null>(null)
  const [chartOpen, setChartOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('results')

  const executeMutation = useSqlExecute()

  // Auto-select the first database when the list first loads.
  useEffect(() => {
    if (!selectedDbId && databases.length > 0) {
      setSelectedDbId(databases[0].id)
    }
  }, [databases, selectedDbId])

  const handleRun = useCallback(() => {
    if (!sql.trim() || !selectedDbId || executeMutation.isPending) return
    const start = performance.now()
    executeMutation.mutate(
      { sql, databaseId: selectedDbId },
      {
        onSuccess: (data) => {
          setResult(data)
          setExecutionTime(Math.round(performance.now() - start))
          setActiveTab('results')
        },
        onError: (err) => {
          setResult({
            status: 'error',
            columns: [],
            data: [],
            rowCount: 0,
            error: err.message,
          })
          setExecutionTime(Math.round(performance.now() - start))
          setActiveTab('results')
        },
      },
    )
  }, [sql, selectedDbId, executeMutation])

  const handleInsertTable = useCallback((tableName: string) => {
    setSql((prev) => prev + (prev.endsWith(' ') ? '' : ' ') + tableName)
  }, [])

  const handleInsertColumn = useCallback((columnName: string) => {
    setSql((prev) => prev + (prev.endsWith(' ') ? '' : ' ') + columnName)
  }, [])

  const handleLoadQuery = useCallback((query: string) => {
    setSql(query)
    setActiveTab('results')
  }, [])

  const handleChartIt = useCallback(() => {
    if (result?.status === 'success' && result.data.length > 0) {
      setChartOpen(true)
    }
  }, [result])

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-6 pt-4 pb-3 shrink-0 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Data Explorer</h1>
        <div className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" />
          <Select value={selectedDbId} onValueChange={setSelectedDbId}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              {databases.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No databases registered
                </div>
              ) : (
                databases.map((db) => (
                  <SelectItem key={db.id} value={db.id}>
                    {db.databaseName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* IDE layout: schema sidebar (left) + editor/results (right) */}
      <div className="flex-1 min-h-0 px-4 pb-4 flex gap-3">
        {/* LEFT: Schema Browser — fixed width sidebar */}
        <div className="w-64 shrink-0 rounded-lg border bg-card overflow-hidden">
          <SchemaBrowser
            onInsertTable={handleInsertTable}
            onInsertColumn={handleInsertColumn}
            selectedDbId={selectedDbId}
            onSelectedDbIdChange={setSelectedDbId}
          />
        </div>

        {/* RIGHT: Editor (top) + Results (bottom) — stacked vertically */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* SQL Editor — 40% height */}
          <div className="h-[40%] min-h-[200px] rounded-lg border bg-card overflow-hidden">
            <SqlEditor
              value={sql}
              onChange={setSql}
              onRun={handleRun}
              isRunning={executeMutation.isPending}
              disabled={!selectedDbId}
              disabledReason={!selectedDbId ? 'Select a database to run queries' : undefined}
            />
          </div>

          {/* Results / History — fills remaining 60% */}
          <div className="flex-1 min-h-0 rounded-lg border bg-card overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <div className="border-b bg-muted/40 px-4 shrink-0">
                <TabsList className="h-9 bg-transparent p-0 gap-0">
                  <TabsTrigger
                    value="results"
                    className="text-xs rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    Results
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="text-xs rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    History
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="results" className="flex-1 min-h-0 mt-0">
                <QueryResults
                  result={result}
                  isLoading={executeMutation.isPending}
                  executionTime={executionTime}
                  onChartIt={handleChartIt}
                  onSaveAsDataset={
                    result?.status === 'success'
                      ? () => setSaveDialogOpen(true)
                      : undefined
                  }
                />
              </TabsContent>
              <TabsContent value="history" className="flex-1 min-h-0 mt-0">
                <QueryHistory onLoadQuery={handleLoadQuery} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Chart Builder Dialog */}
      {result?.status === 'success' && result.data.length > 0 && (
        <ChartBuilderDialog
          open={chartOpen}
          onOpenChange={setChartOpen}
          result={result}
        />
      )}

      {/* Save as Dataset Dialog */}
      <SaveAsDatasetDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        sql={sql}
        databaseId={selectedDbId || null}
        columns={(result?.columns ?? []).map((c) => c.column_name ?? c.name)}
        rows={result?.data ?? []}
      />
    </div>
  )
}
```

- [ ] **Step 5: Full frontend suite + vite build**

```bash
pnpm exec vitest run 2>&1 | tail -10
pnpm exec vite build 2>&1 | tail -5
```

Expected: `Tests 231 passed (231)` (unchanged — no new tests, existing still pass) and `✓ built in Ns`.

- [ ] **Step 6: Commit**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
git add frontend/src/routes/_app/explorer/index.tsx \
        frontend/src/components/explorer/schema-browser.tsx \
        frontend/src/components/explorer/sql-editor.tsx
git commit -m "$(cat <<'MSGEOF'
feat(explorer): database selector + wire databaseId through (Issue 2b)

Unit 4 of the v7-safe rollout. The Data Explorer had no database
selector, so running a query always sent database_id='' to the
backend, which looked up the missing connection row and raised 404.

This commit:

  - Lifts selectedDbId to the Explorer page state with an auto-select
    effect that picks the first registered database on mount.
  - Adds a compact <Select> dropdown in the page header next to the
    "Data Explorer" title, populated from useDatabases().
  - Extends SchemaBrowser with optional controlled-selection props
    (selectedDbId + onSelectedDbIdChange). When omitted, SchemaBrowser
    manages its own internal state — the existing 3 schema-browser
    tests exercise this path and continue to pass. When provided,
    SchemaBrowser becomes a read-out of the parent state and its
    internal database dropdown is hidden (single source of truth).
  - Passes selectedDbId to useSqlExecute.mutate({ sql, databaseId })
    so Run actually hits a valid connection.
  - Passes selectedDbId to SaveAsDatasetDialog as databaseId (was
    hardcoded null), so pre-population of the dialog's database field
    works.
  - Extends SqlEditor with optional disabled + disabledReason props.
    Explorer passes disabled={!selectedDbId} and a helper text, so
    the Run button is greyed out with "Select a database to run
    queries" instead of a silent no-op.

Tests: no new tests — existing schema-browser tests cover the
uncontrolled path, and the Explorer page wiring is simple enough
that vite build catches any regressions.

Frontend suite: 231 passed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
MSGEOF
)"
```

---

# Task 5: Unit 5 — KPI preview scrollbar

**Goal:** wrap the dataset-step branch content of `kpi-builder-preview.tsx` in a single `ScrollArea` so the whole preview panel scrolls when content overflows.

**Files:**
- Modify: `frontend/src/components/kpis/kpi-builder-preview.tsx`

- [ ] **Step 1: Add ScrollArea import**

Find:
```tsx
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
```

Replace with:
```tsx
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
```

- [ ] **Step 2: Wrap the dataset-step branch in a ScrollArea**

Find the entire `step === 'dataset' && !showLiveKpi` branch (starts around line 127) and replace the outer wrapper. The branch currently begins with:

```tsx
  // Step 1: Dataset selected — show column metadata + sample data
  if (step === 'dataset' && !showLiveKpi) {
    return (
      <div className="flex flex-1 flex-col h-full">
        {/* Column metadata */}
        <div className="mb-1">
```

Replace with:

```tsx
  // Step 1: Dataset selected — show column metadata + sample data.
  // Both tables live inside a single ScrollArea so the whole preview
  // panel scrolls as one region when content exceeds the panel height.
  // Previous flow-layout with two unbounded overflow-auto wrappers
  // never activated either inner scrollbar — content got clipped.
  if (step === 'dataset' && !showLiveKpi) {
    return (
      <ScrollArea className="flex-1 min-h-0 h-full">
        <div className="pr-2">
          {/* Column metadata */}
          <div className="mb-1">
```

And find the closing tags at the end of this branch (around line 228-229):

```tsx
          )}
        </div>
      </div>
    )
  }
```

Replace with:

```tsx
          )}
        </div>
        </div>
      </ScrollArea>
    )
  }
```

The extra `</div>` closes the `<div className="pr-2">` wrapper.

Also remove `overflow-auto` from the two inner table wrappers in this branch (the outer ScrollArea now owns overflow). Find:

```tsx
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-1.5 text-left font-medium">Name</th>
```

Replace with:

```tsx
            <div className="rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-1.5 text-left font-medium">Name</th>
```

And find:

```tsx
            <div className="overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {Object.keys(sampleData[0]).map((col) => (
```

Replace with:

```tsx
              <div className="rounded border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {Object.keys(sampleData[0]).map((col) => (
```

**Note to implementer:** the `overflow-auto` → plain class change also cascades indentation changes on the inner JSX because of the new `<div className="pr-2">` wrapper. You'll likely need to re-indent the whole Columns section and the whole Sample Data section by 2 spaces. That's fine — just preserve the nesting and run the vite build to verify TypeScript happy.

- [ ] **Step 3: Full frontend suite + vite build**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm exec vitest run 2>&1 | tail -10
pnpm exec vite build 2>&1 | tail -5
```

Expected: `Tests 231 passed (231)` and `✓ built in Ns`.

- [ ] **Step 4: Commit**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
git add frontend/src/components/kpis/kpi-builder-preview.tsx
git commit -m "$(cat <<'MSGEOF'
fix(kpis): wrap preview dataset-step in ScrollArea (Issue 4)

Unit 5 of the v7-safe rollout. The KPI builder's preview panel had
unbounded overflow-auto wrappers around the Columns table and
Sample Data table, sitting inside a flow-layout outer container.
When either table had more content than fit the panel height,
neither inner overflow-auto activated (no bounded max-height), and
the overall h-full container clipped the overflow with no scrollbar
anywhere.

Fix: wrap the whole dataset-step branch content in a single
<ScrollArea className="flex-1 min-h-0 h-full">. The two tables
become plain flow content inside one scroll region. Matches the
pattern used by the schema browser in Unit 3.

The live-KPI branch (other steps) is unchanged.

No tests — pure CSS layout fix; vite build covers the TypeScript
side, and visual verification happens in the browser smoke test
from Unit 6's handoff.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
MSGEOF
)"
```

---

# Task 6: Unit 6 — Final review + v7-safe tarball

**Goal:** final code review across the whole rollout, build the v7-safe tarball, verify contents, write handoff.

**Files:** none modified (review + packaging only).

- [ ] **Step 1: Run full test suites + build on the final state**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
source venv/bin/activate
python -m pytest 2>&1 | tail -10
cd ../frontend
pnpm exec vitest run 2>&1 | tail -10
pnpm exec vite build 2>&1 | tail -5
```

Expected:
- Backend: `125 passed` (was 115 at v6, +10 new: 5 from Unit 1 datetime + 5 from Unit 2 test-by-id)
- Frontend: `231 passed` (was 229, +2 from Unit 3 data-source-sheet tests)
- Build: `✓ built in Ns`

If anything fails, fix it inline before proceeding.

- [ ] **Step 2: Dispatch `superpowers:code-reviewer` on the cumulative diff**

Use the Agent tool with `superpowers:code-reviewer` agent and this prompt (NOT `general-purpose` — the whole point of v7-safe is proper review discipline):

> "Final review of the RecViz v7-safe rollout. Branch: deploy/oracle-v7-safe. Range: everything since commit a3b0b5c (the v6 tarball commit). Spec: docs/superpowers/plans/2026-04-11-oracle-rhel-v7-safe.md.
>
> Five bugs fixed: Issue 3 (datetime UTC offset), Issue 1 (test-connection by database_id, backend + frontend), Issue 2a (schema browser scrollbar), Issue 2b (Explorer database selector), Issue 4 (KPI preview scrollbar).
>
> NOT fixed in this rollout: Issue 5 (KPI column dropdown empty on Oracle) — explicitly skipped per user instruction after two production crashes of the Oracle NUMBER output type handler from the abandoned v7 rollout.
>
> CRITICAL: this rollout must NOT touch python-oracledb, output_type_handler, connection.outputtypehandler, or any SQLAlchemy engine connect event listeners. Verify via `git diff a3b0b5c..HEAD -- 'backend/app/db/' 'backend/app/services/engine_manager.py'` that no Oracle driver code is changed.
>
> Scope: `git diff a3b0b5c..HEAD`.
>
> Look for:
> 1. Any accidental touches to oracledb, output_type_handler, or engine event listeners
> 2. Datetime serialization correctness — @field_serializer on DatasetResponse + _utc_isoformat in databases.py
> 3. Credential leaks in the test-connection failure paths
> 4. React controlled/uncontrolled switch in SchemaBrowser
> 5. Any dead code from the rollout
> 6. Commit discipline (Co-Authored-By trailer on every commit)
>
> Use confidence-based filtering. Report only high-priority issues. Short report."

- [ ] **Step 3: Fix any blocker findings**

Apply inline. Commit as `fix(review): address Unit 6 final review findings`.

- [ ] **Step 4: Stage the tarball**

```bash
rm -rf /tmp/recviz-staging-v7-safe && mkdir -p /tmp/recviz-staging-v7-safe
rsync -a \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='.pytest_cache' \
  --exclude='.DS_Store' \
  /Users/aarun/Workspace/recviz-prod-build/backend /tmp/recviz-staging-v7-safe/
mkdir -p /tmp/recviz-staging-v7-safe/frontend
rsync -a \
  --exclude='.DS_Store' \
  /Users/aarun/Workspace/recviz-prod-build/frontend/dist /tmp/recviz-staging-v7-safe/frontend/
rsync -a \
  --exclude='.DS_Store' \
  /tmp/recviz-staging-v6/scripts /tmp/recviz-staging-v7-safe/
```

- [ ] **Step 5: Build the tarball**

```bash
tar -czf ~/recviz-deploy-v7-safe.tar.gz -C /tmp/recviz-staging-v7-safe .
ls -lh ~/recviz-deploy-v7-safe.tar.gz
```

Expected: ~1.7 MB.

- [ ] **Step 6: Verify tarball contents**

```bash
cd /Users/aarun

# Must NOT contain the Oracle NUMBER handler module
tar tzf recviz-deploy-v7-safe.tar.gz | grep oracle_types.py && echo "FAIL: oracle_types.py present" || echo "OK: no oracle_types.py"

# Must contain the Unit 1 datetime fixes
tar xzOf recviz-deploy-v7-safe.tar.gz ./backend/app/api/databases.py | grep -c "_utc_isoformat" | xargs -I{} echo "_utc_isoformat matches: {}"
tar xzOf recviz-deploy-v7-safe.tar.gz ./backend/app/models/managed_dataset.py | grep -c "field_serializer" | xargs -I{} echo "field_serializer matches: {}"

# Must contain Unit 2 detail-panel branch
tar xzOf recviz-deploy-v7-safe.tar.gz ./backend/app/api/databases.py | grep -c "body.database_id and not body.host" | xargs -I{} echo "detail-panel branch matches: {}"

# Must NOT contain any engine.outputtypehandler wiring
tar xzOf recviz-deploy-v7-safe.tar.gz ./backend/app/db/engine.py | grep -c "outputtypehandler\|install_oracle_number_handler" | xargs -I{} echo "Oracle driver wiring in engine.py (must be 0): {}"
tar xzOf recviz-deploy-v7-safe.tar.gz ./backend/app/services/engine_manager.py | grep -c "outputtypehandler\|install_oracle_number_handler" | xargs -I{} echo "Oracle driver wiring in engine_manager.py (must be 0): {}"

# Must NOT contain .DS_Store or dead files
tar tzf recviz-deploy-v7-safe.tar.gz | grep -E '\.DS_Store|use-datasets\.ts|use-dataset\.ts|export\.py|types/dataset\.ts' || echo "(clean)"
```

Expected:
- `OK: no oracle_types.py`
- `_utc_isoformat matches: 3` (one def + two call sites in `_build_response`)
- `field_serializer matches: 2` (one import + one decorator)
- `detail-panel branch matches: 1`
- `Oracle driver wiring in engine.py (must be 0): 0`
- `Oracle driver wiring in engine_manager.py (must be 0): 0`
- `(clean)`

- [ ] **Step 7: Write the handoff**

Paste this in chat:

> **v7-safe tarball ready: `~/recviz-deploy-v7-safe.tar.gz`**
>
> Fresh rewrite from the v6 baseline. Zero Oracle driver code touched. The entire Oracle NUMBER output type handler module from v7 is gone.
>
> Transfer: `scp ~/recviz-deploy-v7-safe.tar.gz rectify@<server>:/tmp/`
>
> Server-side:
>
> ```bash
> bash /opt/rectify/rectrace/recviz/app/scripts/stop-all.sh
> cd /opt/rectify/rectrace/recviz
> rm -rf app/backend app/frontend
> cd app && tar xzf /tmp/recviz-deploy-v7-safe.tar.gz backend frontend
> bash /opt/rectify/rectrace/recviz/app/scripts/start-all.sh
> tail -50 /opt/rectify/rectrace/recviz/logs/backend.log
> ```
>
> Expected: no AttributeError, no TypeError, no LOB.encode warning. The backend should start and serve /health.
>
> **Browser success criteria (v7-safe):**
> 1. Settings → click an Oracle data source → Test Connection in the detail panel → **green success** (not a Postgres error)
> 2. Data Explorer → schema browser shows a theme-aware scrollbar when the schema has many tables
> 3. Data Explorer → header dropdown shows registered databases → pick one → Run a query → results appear (not 404)
> 4. Datasets → create a dataset → list shows "updated less than a minute ago" (not "6 hours ago")
> 5. KPIs → Add KPI → preview panel has a working scrollbar when it overflows
>
> **Explicitly NOT fixed in v7-safe:** KPI column dropdown being empty on Oracle (Issue 5). This was dropped to avoid the Oracle driver landmines that broke v7.

- [ ] **Step 8: Final sync to main repo (optional)**

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git fetch /Users/aarun/Workspace/recviz-prod-build deploy/oracle-v7-safe:deploy/oracle-v7-safe || true
git log --oneline deploy/oracle-v7-safe | head -20
```

---

## Self-review checklist

**Spec coverage:**

| Bug | Unit |
|---|---|
| Issue 1 (detail-panel Postgres error) | Units 2 + 3 |
| Issue 2a (schema browser scrollbar) | Unit 3 |
| Issue 2b (Explorer 404) | Unit 4 |
| Issue 3 (dataset "6 hours ago") | Unit 1 |
| Issue 4 (KPI preview scrollbar) | Unit 5 |

**Issue 5 is explicitly excluded** — dropped with the Oracle NUMBER handler.

**Explicit NOT-touching list (to prove to the final reviewer):**
- `backend/app/db/engine.py` — NO changes (the engine creation is untouched; no `install_oracle_number_handler` call)
- `backend/app/services/engine_manager.py` — NO changes (no Oracle event listener additions)
- `backend/app/db/oracle_types.py` — **does not exist** on this branch
- `backend/tests/test_oracle_types.py` — **does not exist** on this branch
- `frontend/src/lib/column-detection.ts` — NO changes (no typeHints parameter)
- The `project_broken_dashboard_pipeline.md` DO-NOT-TOUCH files — same as v7

**Type consistency:**
- `handleTestDetailConnection` defined in Unit 3 Step 3, consumed in Unit 3 Step 3 DetailView invocation
- `_utc_isoformat(dt)` defined in Unit 1 Step 4, consumed in Unit 1 Step 4 `_build_response` (3 call sites: def + 2 uses)
- `@field_serializer('created_at', 'updated_at')` defined in Unit 1 Step 3 on DatasetResponse
- `SchemaBrowserProps` optional `selectedDbId` / `onSelectedDbIdChange` defined in Unit 4 Step 2, consumed in Unit 4 Step 4 (Explorer page)
- `SqlEditorProps` optional `disabled` / `disabledReason` defined in Unit 4 Step 1, consumed in Unit 4 Step 4 (Explorer page)

**Commit chain:**
- `a3b0b5c` (v6 base)
- Unit 1 commit (Issue 3 datetime)
- Unit 2 commit (Issue 1 backend)
- Unit 3 commit (Issue 1 frontend + 2a scrollbar)
- Unit 4 commit (Issue 2b Explorer selector)
- Unit 5 commit (Issue 4 KPI preview scrollbar)
- (optional) Unit 6 review-fix commit
- 5-6 feature commits total

**Final test deltas:**
- Backend: 115 → 120 (Unit 1) → 125 (Unit 2). Total +10.
- Frontend: 229 → 231 (Unit 3). Total +2.

**Tarball:** `~/recviz-deploy-v7-safe.tar.gz`, ~1.7 MB.
