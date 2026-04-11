"""Database (data source) CRUD routes -- direct recviz_connections access."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from starlette.requests import Request

from app.core.dependencies import DbSessionDep, EngineManagerDep
from app.core.errors import sanitize_detail
from app.db.models.connection import RecvizConnection
from app.db.models.dataset import RecvizDataset
from app.models.database import (
    DatabaseCreate,
    DatabaseUpdate,
    TestConnectionRequest,
)
from app.services.connection_status import ConnectionStatusTracker
from app.services.encryption import EncryptionService
from app.services.engine_manager import EngineManager
from app.services.uri_builder import build_sync_uri

logger = logging.getLogger(__name__)

# Oracle 12.2+ and PostgreSQL both allow identifiers up to 128 bytes.
# The pattern allows the standard SQL identifier charset (letter/underscore
# start, alphanumerics + underscore afterwards) plus Oracle's $ and # which
# are legal in unquoted Oracle identifiers. We reject anything with
# whitespace, quotes, semicolons, or other SQL-injection markers.
TABLE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_$#]{0,127}$")


def _normalize_nullable(raw) -> bool:
    """Normalize an Oracle/Postgres nullable column value to a bool.

    Oracle's all_tab_columns.nullable returns 'Y' / 'N'.
    Postgres' information_schema.columns.is_nullable returns 'YES' / 'NO'.
    Anything unrecognized (None, empty string, unknown text) defaults to
    True (permissive — better to over-report nullable than under-report).
    """
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str) and raw:
        upper = raw.upper()
        if upper in ("Y", "YES", "TRUE", "T"):
            return True
        if upper in ("N", "NO", "FALSE", "F"):
            return False
    return True


router = APIRouter(prefix="/api/databases", tags=["databases"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_status_tracker(request: Request) -> ConnectionStatusTracker | None:
    return getattr(request.app.state, "connection_status", None)


def _get_encryption(request: Request) -> EncryptionService:
    encryption = getattr(request.app.state, "encryption", None)
    if encryption is None:
        raise HTTPException(
            status_code=503,
            detail="Encryption service not available",
        )
    return encryption


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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("")
def list_databases(session: DbSessionDep) -> list[dict]:
    """List all registered database connections."""
    stmt = select(RecvizConnection).order_by(RecvizConnection.name)
    result = session.execute(stmt)
    connections = result.scalars().all()
    return [_build_response(conn) for conn in connections]


@router.get("/{db_id}")
def get_database(db_id: str, session: DbSessionDep) -> dict:
    """Get a single database connection by ID."""
    stmt = select(RecvizConnection).where(RecvizConnection.id == db_id)
    result = session.execute(stmt)
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Database '{db_id}' not found")
    return _build_response(conn)


@router.get("/{db_id}/datasets")
def list_database_datasets(
    db_id: str,
    session: DbSessionDep,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """Return paginated datasets for a given database."""
    stmt = select(RecvizDataset).where(RecvizDataset.database_id == db_id)
    result = session.execute(stmt)
    datasets = result.scalars().all()

    db_datasets = [
        {
            "id": ds.id,
            "table_name": ds.name,
            "column_count": len(ds.columns) if ds.columns else 0,
        }
        for ds in datasets
    ]
    total = len(db_datasets)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "datasets": db_datasets[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=201)
def create_database(
    body: DatabaseCreate,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
    request: Request,
) -> dict:
    """Create a new database connection with encrypted credentials."""
    encryption = _get_encryption(request)
    conn_id = str(uuid.uuid4())

    name = body.database_name.lower().replace(" ", "_")
    port = body.port
    if port is None:
        port = 1521 if body.backend == "oracle" else 5432

    connection = RecvizConnection(
        id=conn_id,
        name=name,
        display_name=body.database_name,
        backend=body.backend,
        host=body.host,
        port=port,
        database_name=body.database or "",
        username=body.username or "",
        encrypted_password=encryption.encrypt(body.password or ""),
        schema_name=body.schema_name or "",
        status="untested",
    )

    try:
        session.add(connection)
        session.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail={"error": "duplicate_name", "message": f"A connection named '{name}' already exists"},
        )

    # Auto-test the connection and persist the result
    uri = build_sync_uri(
        backend=body.backend,
        host=body.host or "",
        port=port,
        database=body.database,
        username=body.username,
        password=body.password,
    )
    try:
        success, message = EngineManager.test_connection(uri, body.backend, timeout=10)
    except Exception as exc:
        logger.warning("Auto-test during create failed with exception: %s", exc)
        success, message = False, str(exc)

    connection.status = "connected" if success else "unreachable"
    connection.last_tested_at = datetime.now(timezone.utc)
    session.flush()

    # Invalidate ConnectionResolver cache
    resolver = getattr(request.app.state, "connection_resolver", None)
    if resolver:
        resolver.invalidate(session)

    return _build_response(connection)


@router.put("/{db_id}")
def update_database(
    db_id: str,
    body: DatabaseUpdate,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
    request: Request,
) -> dict:
    """Update an existing database connection."""
    encryption = _get_encryption(request)
    stmt = select(RecvizConnection).where(RecvizConnection.id == db_id)
    result = session.execute(stmt)
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Database '{db_id}' not found")

    # Apply non-None fields from body
    if body.database_name is not None:
        conn.display_name = body.database_name
        conn.name = body.database_name.lower().replace(" ", "_")
    if body.backend is not None:
        conn.backend = body.backend
    if body.host is not None:
        conn.host = body.host
    if body.port is not None:
        conn.port = body.port
    if body.database is not None:
        conn.database_name = body.database
    if body.schema_name is not None:
        conn.schema_name = body.schema_name
    if body.username is not None:
        conn.username = body.username
    if body.password is not None:
        conn.encrypted_password = encryption.encrypt(body.password)

    # Dispose the old engine (connection params may have changed)
    engine_manager.dispose_engine(db_id)

    # Invalidate ConnectionResolver cache
    resolver = getattr(request.app.state, "connection_resolver", None)
    if resolver:
        resolver.invalidate(session)

    return _build_response(conn)


@router.delete("/{db_id}")
def delete_database(
    db_id: str,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
    request: Request,
) -> dict:
    """Delete a database connection."""
    stmt = select(RecvizConnection).where(RecvizConnection.id == db_id)
    result = session.execute(stmt)
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Database '{db_id}' not found")

    session.delete(conn)
    # Flush before invalidating the resolver cache, otherwise the resolver's
    # re-sync SELECT would still see the row (the DELETE is only in the
    # identity map until flushed).
    session.flush()
    engine_manager.dispose_engine(db_id)

    # Invalidate ConnectionResolver cache
    resolver = getattr(request.app.state, "connection_resolver", None)
    if resolver:
        resolver.invalidate(session)

    # Remove from status tracker
    tracker = _get_status_tracker(request)
    if tracker:
        tracker.remove(db_id)

    return {"success": True}


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


@router.get("/{db_id}/tables")
def list_schema_tables(
    db_id: str,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
) -> list[dict]:
    """List tables and views in the connection's configured schema.

    Uses live introspection against the data dictionary / information_schema.
    Returns [{"name": "ITEMS", "type": "TABLE"}, ...]. The schema is
    determined by the connection's schema_name field (set when the
    connection is created); if empty, returns a 400.
    """
    conn = session.execute(
        select(RecvizConnection).where(RecvizConnection.id == db_id)
    ).scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Database '{db_id}' not found")

    if not conn.schema_name:
        raise HTTPException(
            status_code=400,
            detail=(
                "Connection has no schema configured. Edit the data source and "
                "set the Schema field to the Oracle owner / PostgreSQL schema name."
            ),
        )

    try:
        engine = engine_manager.get_engine_for_connection(conn)
    except Exception as exc:
        logger.warning("Engine creation failed for %s: %s", db_id, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to database: {sanitize_detail(exc)}",
        )

    if conn.backend == "oracle":
        # Oracle stores materialized views in BOTH all_tables and all_views,
        # so a naive UNION ALL would emit each MV twice (once as TABLE, once
        # as VIEW). Filter MVs out of the TABLE branch so they only appear
        # via the VIEW branch (which is how Oracle treats them at query time).
        sql = text(
            """
            SELECT table_name AS name, 'TABLE' AS type
            FROM all_tables
            WHERE owner = UPPER(:schema)
              AND table_name NOT IN (
                SELECT mview_name FROM all_mviews WHERE owner = UPPER(:schema)
              )
            UNION ALL
            SELECT view_name AS name, 'VIEW' AS type
            FROM all_views
            WHERE owner = UPPER(:schema)
            ORDER BY 1
            """
        )
    elif conn.backend == "postgresql":
        sql = text(
            """
            SELECT table_name AS name, table_type AS type
            FROM information_schema.tables
            WHERE table_schema = :schema
              AND table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY table_name
            """
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Schema introspection not supported for backend '{conn.backend}'",
        )

    try:
        with engine.connect() as db_conn:
            result = db_conn.execute(sql, {"schema": conn.schema_name})
            rows = result.fetchall()
    except Exception as exc:
        logger.warning("Schema introspection failed for %s: %s", db_id, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Failed to query schema catalog: {sanitize_detail(exc)}",
        )

    # Normalize the 'type' field: Oracle emits 'TABLE' / 'VIEW' from the literal;
    # Postgres emits 'BASE TABLE' / 'VIEW' from information_schema.table_type.
    return [
        {
            "name": r[0],
            "type": "TABLE" if r[1] in ("BASE TABLE", "TABLE") else r[1],
        }
        for r in rows
    ]


@router.get("/{db_id}/tables/{table_name}/columns")
def list_table_columns(
    db_id: str,
    table_name: str,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
) -> list[dict]:
    """List columns for a specific table/view in the connection's schema."""
    if not TABLE_NAME_RE.match(table_name):
        raise HTTPException(status_code=400, detail="Invalid table name")

    conn = session.execute(
        select(RecvizConnection).where(RecvizConnection.id == db_id)
    ).scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Database '{db_id}' not found")

    if not conn.schema_name:
        raise HTTPException(
            status_code=400,
            detail="Connection has no schema configured",
        )

    try:
        engine = engine_manager.get_engine_for_connection(conn)
    except Exception as exc:
        logger.warning("Engine creation failed for %s: %s", db_id, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to database: {sanitize_detail(exc)}",
        )

    if conn.backend == "oracle":
        # Oracle keeps dropped columns as hidden placeholders (named like
        # SYS_NC00001$) in all_tab_columns. Filter them out via the
        # hidden_column flag so the schema browser doesn't render garbage.
        sql = text(
            """
            SELECT column_name AS name, data_type AS type, nullable
            FROM all_tab_columns
            WHERE owner = UPPER(:schema)
              AND table_name = UPPER(:table_name)
              AND hidden_column = 'NO'
            ORDER BY column_id
            """
        )
    elif conn.backend == "postgresql":
        sql = text(
            """
            SELECT column_name AS name, data_type AS type, is_nullable AS nullable
            FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table_name
            ORDER BY ordinal_position
            """
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Schema introspection not supported for backend '{conn.backend}'",
        )

    try:
        with engine.connect() as db_conn:
            result = db_conn.execute(sql, {"schema": conn.schema_name, "table_name": table_name})
            rows = result.fetchall()
    except Exception as exc:
        logger.warning("Column introspection failed for %s.%s: %s", db_id, table_name, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Failed to query column catalog: {sanitize_detail(exc)}",
        )

    return [
        {
            "name": r[0],
            "type": r[1],
            "nullable": _normalize_nullable(r[2]),
        }
        for r in rows
    ]


@router.post("/{db_id}/sync")
def sync_datasets(db_id: str) -> dict:
    """No-op -- Superset dataset sync removed. Preserved for API compatibility."""
    return {"success": True}
