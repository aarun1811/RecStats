"""Database (data source) CRUD routes -- direct recviz_connections access."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
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


def _build_response(conn: RecvizConnection, status_info: dict) -> dict:
    """Build a response dict matching the DatabaseInfo shape from a connection record."""
    return {
        "id": conn.id,
        "database_name": conn.display_name,
        "backend": conn.backend,
        "created_on": conn.created_at.isoformat() if conn.created_at else None,
        "expose_in_sqllab": True,
        "status": status_info["status"],
        "last_tested": status_info["last_tested"],
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("")
def list_databases(session: DbSessionDep, request: Request) -> list[dict]:
    """List all registered database connections."""
    tracker = _get_status_tracker(request)
    stmt = select(RecvizConnection).order_by(RecvizConnection.name)
    result = session.execute(stmt)
    connections = result.scalars().all()

    results = []
    for conn in connections:
        if tracker:
            status_info = tracker.get_status(conn.id)
        else:
            status_info = {"status": "untested", "last_tested": None}
        results.append(_build_response(conn, status_info))
    return results


@router.get("/{db_id}")
def get_database(db_id: str, session: DbSessionDep, request: Request) -> dict:
    """Get a single database connection by ID."""
    tracker = _get_status_tracker(request)
    stmt = select(RecvizConnection).where(RecvizConnection.id == db_id)
    result = session.execute(stmt)
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Database '{db_id}' not found")

    if tracker:
        status_info = tracker.get_status(conn.id)
    else:
        status_info = {"status": "untested", "last_tested": None}
    return _build_response(conn, status_info)


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

    # Derive a slug-style name from database_name for internal use
    name = body.database_name.lower().replace(" ", "_")

    # Default port by backend
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
    )

    try:
        session.add(connection)
        session.flush()
    except IntegrityError:
        # get_db_session dependency handles the actual rollback when the
        # HTTPException propagates out of the handler.
        raise HTTPException(
            status_code=409,
            detail={"error": "duplicate_name", "message": f"A connection named '{name}' already exists"},
        )

    # Invalidate ConnectionResolver cache
    resolver = getattr(request.app.state, "connection_resolver", None)
    if resolver:
        resolver.invalidate(session)

    return {
        "id": conn_id,
        "database_name": body.database_name,
        "backend": body.backend,
        "created_on": connection.created_at.isoformat() if connection.created_at else None,
        "expose_in_sqllab": True,
        "status": "untested",
        "last_tested": None,
    }


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

    tracker = _get_status_tracker(request)
    if tracker:
        status_info = tracker.get_status(conn.id)
    else:
        status_info = {"status": "untested", "last_tested": None}

    return _build_response(conn, status_info)


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
def test_connection(body: TestConnectionRequest, request: Request) -> dict:
    """Test database connectivity using a disposable engine."""
    tracker = _get_status_tracker(request)
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
        if tracker and body.database_id is not None:
            if success:
                tracker.mark_connected(body.database_id)
            else:
                tracker.mark_unreachable(body.database_id)
        return {"success": success, "message": message}
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        logger.warning("Connection test error: %s", e)
        if tracker and body.database_id is not None:
            tracker.mark_unreachable(body.database_id)
        return {"success": False, "message": f"Connection error: {sanitize_detail(e)}"}


@router.post("/{db_id}/sync")
def sync_datasets(db_id: str) -> dict:
    """No-op -- Superset dataset sync removed. Preserved for API compatibility."""
    return {"success": True}
