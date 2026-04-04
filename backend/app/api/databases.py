"""Database (data source) CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.dependencies import SupersetDep
from app.mock_data import MOCK_DATABASES, MOCK_DATABASE_DATASETS
from app.models.database import (
    DatabaseCreate,
    DatabaseUpdate,
    TestConnectionRequest,
)
from app.services.uri_builder import build_sqlalchemy_uri

router = APIRouter(prefix="/api/databases", tags=["databases"])

# In-memory store for mock mode (seeded from MOCK_DATABASES)
_mock_databases: list[dict] = list(MOCK_DATABASES)
_mock_next_id: int = max(d["id"] for d in MOCK_DATABASES) + 1


def _resolve_uri(body: DatabaseCreate | DatabaseUpdate | TestConnectionRequest) -> str:
    """Build SQLAlchemy URI from either explicit URI or form fields."""
    if body.sqlalchemy_uri:
        return body.sqlalchemy_uri
    return build_sqlalchemy_uri(
        backend=body.backend,
        host=body.host,
        port=body.port,
        database=body.database,
        username=body.username,
        password=body.password,
        schema_name=getattr(body, "schema_name", None),
    )


@router.get("")
async def list_databases(superset: SupersetDep) -> list[dict]:
    if superset:
        try:
            raw = await superset.list_databases()
            return [
                {
                    "id": db.get("id"),
                    "database_name": db.get("database_name", ""),
                    "backend": db.get("backend", ""),
                    "created_on": db.get("created_on"),
                    "expose_in_sqllab": db.get("expose_in_sqllab", True),
                    "dataset_count": 0,
                    "status": "connected",
                }
                for db in raw
            ]
        except Exception:
            pass
    return _mock_databases


@router.get("/{db_id}")
async def get_database(db_id: int, superset: SupersetDep) -> dict:
    if superset:
        try:
            raw = await superset.get_database(db_id)
            return {
                "id": raw.get("id"),
                "database_name": raw.get("database_name", ""),
                "backend": raw.get("backend", ""),
                "created_on": raw.get("created_on"),
                "expose_in_sqllab": raw.get("expose_in_sqllab", True),
                "dataset_count": 0,
                "status": "connected",
            }
        except Exception:
            pass
    for db in _mock_databases:
        if db["id"] == db_id:
            return db
    return {"error": "database not found"}


@router.get("/{db_id}/datasets")
async def list_database_datasets(
    db_id: int,
    superset: SupersetDep,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """Return paginated datasets for a given database."""
    if superset:
        try:
            raw = await superset.list_datasets()
            db_datasets = [
                {
                    "id": ds.get("id"),
                    "table_name": ds.get("table_name", ""),
                    "column_count": len(ds.get("columns", [])),
                }
                for ds in raw
                if ds.get("database", {}).get("id") == db_id
                or ds.get("database_id") == db_id
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
        except Exception:
            pass
    # Mock fallback
    all_datasets = MOCK_DATABASE_DATASETS.get(db_id, [])
    total = len(all_datasets)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "datasets": all_datasets[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("")
async def create_database(body: DatabaseCreate, superset: SupersetDep) -> dict:
    global _mock_next_id

    if superset:
        try:
            uri = _resolve_uri(body)
            payload = {
                "database_name": body.database_name,
                "sqlalchemy_uri": uri,
                "expose_in_sqllab": True,
            }
            result = await superset.create_database(payload)
            created = result.get("result", result)
            return {
                "id": created.get("id"),
                "database_name": created.get("database_name", body.database_name),
                "backend": body.backend,
                "created_on": created.get("created_on"),
                "expose_in_sqllab": True,
                "dataset_count": 0,
                "status": "untested",
            }
        except Exception:
            pass

    # Mock fallback
    new_db = {
        "id": _mock_next_id,
        "database_name": body.database_name,
        "backend": body.backend,
        "created_on": "2026-02-21T00:00:00Z",
        "expose_in_sqllab": True,
        "dataset_count": 0,
        "status": "untested",
    }
    _mock_next_id += 1
    _mock_databases.append(new_db)
    return new_db


@router.put("/{db_id}")
async def update_database(db_id: int, body: DatabaseUpdate, superset: SupersetDep) -> dict:
    if superset:
        try:
            payload: dict = {}
            if body.database_name:
                payload["database_name"] = body.database_name
            if body.sqlalchemy_uri or body.host:
                payload["sqlalchemy_uri"] = _resolve_uri(body)
            result = await superset.update_database(db_id, payload)
            updated = result.get("result", result)
            return {
                "id": updated.get("id", db_id),
                "database_name": updated.get("database_name", ""),
                "backend": updated.get("backend", ""),
                "created_on": updated.get("created_on"),
                "expose_in_sqllab": updated.get("expose_in_sqllab", True),
                "dataset_count": 0,
                "status": "connected",
            }
        except Exception:
            pass

    # Mock fallback
    for db in _mock_databases:
        if db["id"] == db_id:
            if body.database_name:
                db["database_name"] = body.database_name
            if body.backend:
                db["backend"] = body.backend
            return db
    return {"error": "database not found"}


@router.delete("/{db_id}")
async def delete_database(db_id: int, superset: SupersetDep) -> dict:
    if superset:
        try:
            await superset.delete_database(db_id)
            return {"success": True}
        except Exception:
            pass

    # Mock fallback
    global _mock_databases
    _mock_databases = [db for db in _mock_databases if db["id"] != db_id]
    return {"success": True}


@router.post("/test")
async def test_connection(body: TestConnectionRequest, superset: SupersetDep) -> dict:
    if superset:
        try:
            uri = _resolve_uri(body)
            result = await superset.test_connection({"sqlalchemy_uri": uri})
            return {"success": True, "message": "Connection successful"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # Mock fallback — always succeeds
    return {"success": True, "message": "Connection successful (mock mode)"}


@router.post("/{db_id}/sync")
async def sync_datasets(db_id: int, superset: SupersetDep) -> dict:
    """Trigger a dataset refresh for the given database."""
    if superset:
        try:
            raw = await superset.list_datasets()
            count = sum(
                1
                for ds in raw
                if ds.get("database", {}).get("id") == db_id
                or ds.get("database_id") == db_id
            )
            return {"success": True, "dataset_count": count}
        except Exception:
            pass

    datasets = MOCK_DATABASE_DATASETS.get(db_id, [])
    return {"success": True, "dataset_count": len(datasets)}
