# Data Sources Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully functional Data Sources tab in Settings with CRUD operations, test connection, sync datasets, grid/list toggle, and side-panel detail view — all proxied through FastAPI to Superset's REST API.

**Architecture:** Backend adds a new `databases.py` route module with full CRUD + test + sync endpoints, a URI builder utility, and new SupersetClient methods. Frontend adds a `components/settings/` directory with DataSourcesTab, DataSourceSheet, DataSourceCard, DataSourceRow, and DataSourcesToolbar components. All state managed via TanStack Query hooks in a new `use-databases.ts` file.

**Tech Stack:** FastAPI + Pydantic v2 (backend), React 19 + TypeScript + Shadcn/ui Sheet + TanStack Query (frontend)

**Design doc:** `docs/plans/2026-02-21-data-sources-design.md`

---

## Task 1: Add `put` method to API client

**Files:**
- Modify: `frontend/src/lib/api-client.ts`

**Step 1: Add `put` to the api export**

In `frontend/src/lib/api-client.ts`, add `put` to the `api` object:

```typescript
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
```

**Step 2: Verify**

Run: `cd frontend && pnpm build`
Expected: No errors. Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/lib/api-client.ts
git commit -m "feat: add PUT method to API client"
```

---

## Task 2: Backend — Pydantic models for database CRUD

**Files:**
- Create: `backend/app/models/database.py`

**Step 1: Create the models file**

```python
"""Pydantic models for database/data-source CRUD."""

from __future__ import annotations

from app.models.base import CamelModel


class DatabaseCreate(CamelModel):
    database_name: str
    backend: str  # "oracle", "postgresql", "hive", "elasticsearch"
    sqlalchemy_uri: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    schema_name: str | None = None
    username: str | None = None
    password: str | None = None


class DatabaseUpdate(CamelModel):
    database_name: str | None = None
    sqlalchemy_uri: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    schema_name: str | None = None
    username: str | None = None
    password: str | None = None


class DatabaseInfo(CamelModel):
    id: int
    database_name: str
    backend: str
    created_on: str | None = None
    expose_in_sqllab: bool = True
    dataset_count: int = 0
    status: str = "untested"


class TestConnectionRequest(CamelModel):
    backend: str
    sqlalchemy_uri: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None


class TestConnectionResponse(CamelModel):
    success: bool
    message: str
```

**Step 2: Verify**

Run: `cd backend && python -c "from app.models.database import DatabaseCreate, DatabaseInfo, TestConnectionRequest; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/models/database.py
git commit -m "feat: add Pydantic models for database CRUD"
```

---

## Task 3: Backend — URI builder utility

**Files:**
- Create: `backend/app/services/uri_builder.py`

**Step 1: Create the URI builder**

```python
"""Build SQLAlchemy URIs from individual connection fields."""

from __future__ import annotations

from urllib.parse import quote_plus

# Default ports per backend
DEFAULT_PORTS: dict[str, int] = {
    "oracle": 1521,
    "postgresql": 5432,
    "hive": 10000,
    "elasticsearch": 9200,
}


def build_sqlalchemy_uri(
    backend: str,
    host: str | None = None,
    port: int | None = None,
    database: str | None = None,
    username: str | None = None,
    password: str | None = None,
    schema_name: str | None = None,
) -> str:
    """Construct a SQLAlchemy URI from individual fields.

    If any required field is missing, raises ValueError.
    """
    if not host:
        raise ValueError("host is required")

    port = port or DEFAULT_PORTS.get(backend, 5432)
    user_part = ""
    if username:
        encoded_pass = quote_plus(password) if password else ""
        user_part = f"{quote_plus(username)}:{encoded_pass}@"

    if backend == "oracle":
        db_part = database or "ORCL"
        return f"oracle+cx_oracle://{user_part}{host}:{port}/?service_name={db_part}"

    if backend == "postgresql":
        db_part = database or "postgres"
        return f"postgresql://{user_part}{host}:{port}/{db_part}"

    if backend == "hive":
        db_part = database or "default"
        return f"hive://{user_part}{host}:{port}/{db_part}"

    if backend == "elasticsearch":
        scheme = "https" if port == 443 else "http"
        return f"elasticsearch+{scheme}://{host}:{port}/"

    raise ValueError(f"Unsupported backend: {backend}")
```

**Step 2: Verify**

Run: `cd backend && python -c "
from app.services.uri_builder import build_sqlalchemy_uri
print(build_sqlalchemy_uri('postgresql', host='localhost', port=5432, database='mydb', username='user', password='pass'))
print(build_sqlalchemy_uri('oracle', host='db.citi.com', port=1521, database='RECONDB', username='recon', password='s3cret'))
print(build_sqlalchemy_uri('elasticsearch', host='es-host', port=9200))
"`

Expected:
```
postgresql://user:pass@localhost:5432/mydb
oracle+cx_oracle://recon:s3cret@db.citi.com:1521/?service_name=RECONDB
elasticsearch+http://es-host:9200/
```

**Step 3: Commit**

```bash
git add backend/app/services/uri_builder.py
git commit -m "feat: add SQLAlchemy URI builder utility"
```

---

## Task 4: Backend — SupersetClient additions

**Files:**
- Modify: `backend/app/services/superset_client.py`

**Step 1: Add CRUD + test methods to SupersetClient**

Append these methods to the `SupersetClient` class after the existing `list_databases` method:

```python
    async def get_database(self, db_id: int) -> dict[str, Any]:
        data = await self._get(f"/api/v1/database/{db_id}")
        return data.get("result", {})

    async def create_database(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._post("/api/v1/database/", json=payload)

    async def update_database(self, db_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("PUT", f"/api/v1/database/{db_id}", json=payload)

    async def delete_database(self, db_id: int) -> None:
        await self._request("DELETE", f"/api/v1/database/{db_id}")

    async def test_connection(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._post("/api/v1/database/test_connection/", json=payload)
```

**Step 2: Verify**

Run: `cd backend && python -c "from app.services.superset_client import SupersetClient; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/services/superset_client.py
git commit -m "feat: add database CRUD + test methods to SupersetClient"
```

---

## Task 5: Backend — Expand mock data

**Files:**
- Modify: `backend/app/mock_data.py`

**Step 1: Replace MOCK_DATABASES with richer entries**

Replace the existing `MOCK_DATABASES` list:

```python
MOCK_DATABASES = [
    {
        "id": 1,
        "database_name": "recon_data",
        "backend": "postgresql",
        "created_on": "2026-01-15T10:00:00Z",
        "expose_in_sqllab": True,
        "dataset_count": 4,
        "status": "connected",
    },
    {
        "id": 2,
        "database_name": "oracle_prod",
        "backend": "oracle",
        "created_on": "2026-01-20T14:30:00Z",
        "expose_in_sqllab": True,
        "dataset_count": 47,
        "status": "connected",
    },
    {
        "id": 3,
        "database_name": "hive_warehouse",
        "backend": "hive",
        "created_on": "2026-02-01T09:00:00Z",
        "expose_in_sqllab": True,
        "dataset_count": 12,
        "status": "untested",
    },
]
```

**Step 2: Add MOCK_DATABASE_DATASETS below MOCK_DATABASES**

```python
MOCK_DATABASE_DATASETS: dict[int, list[dict]] = {
    1: [
        {"id": 4, "table_name": "transactions", "column_count": 12},
        {"id": 5, "table_name": "breaks", "column_count": 18},
        {"id": 6, "table_name": "daily_metrics", "column_count": 10},
        {"id": 3, "table_name": "counterparties", "column_count": 4},
    ],
    2: [
        {"id": 10, "table_name": f"RECON_TABLE_{i:02d}", "column_count": _random.randint(5, 30)}
        for i in range(1, 48)
    ],
    3: [
        {"id": 60, "table_name": "recon_history", "column_count": 15},
        {"id": 61, "table_name": "batch_results", "column_count": 8},
        {"id": 62, "table_name": "match_output", "column_count": 22},
        {"id": 63, "table_name": "exception_log", "column_count": 11},
        {"id": 64, "table_name": "audit_trail", "column_count": 9},
        {"id": 65, "table_name": "source_feed_a", "column_count": 14},
        {"id": 66, "table_name": "source_feed_b", "column_count": 14},
        {"id": 67, "table_name": "reconciliation_rules", "column_count": 7},
        {"id": 68, "table_name": "scheduler_config", "column_count": 6},
        {"id": 69, "table_name": "run_metadata", "column_count": 12},
        {"id": 70, "table_name": "tolerance_config", "column_count": 5},
        {"id": 71, "table_name": "break_categories", "column_count": 4},
    ],
}
```

Note: This must be placed AFTER the `_random.seed(42)` line so `_random` is available for the oracle list comprehension.

**Step 3: Verify**

Run: `cd backend && python -c "from app.mock_data import MOCK_DATABASES, MOCK_DATABASE_DATASETS; print(len(MOCK_DATABASES), len(MOCK_DATABASE_DATASETS[2]))"`
Expected: `3 47`

**Step 4: Commit**

```bash
git add backend/app/mock_data.py
git commit -m "feat: expand mock databases with richer entries and dataset lists"
```

---

## Task 6: Backend — Database API routes

**Files:**
- Create: `backend/app/api/databases.py`
- Modify: `backend/app/api/router.py`

**Step 1: Create the databases route module**

```python
"""Database (data source) CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.dependencies import SupersetDep
from app.mock_data import MOCK_DATABASES, MOCK_DATABASE_DATASETS
from app.models.database import (
    DatabaseCreate,
    DatabaseInfo,
    DatabaseUpdate,
    TestConnectionRequest,
    TestConnectionResponse,
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
    # In a real scenario, this would call Superset to re-scan the database
    # and update the dataset list. For now, just return current datasets.
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
```

**Step 2: Register in router**

In `backend/app/api/router.py`, add the import and include:

```python
from app.api.databases import router as databases_router
```

And add this line with the other `include_router` calls:

```python
api_router.include_router(databases_router)
```

**Step 3: Verify**

Run: `cd backend && python -c "from app.api.databases import router; print(len(router.routes), 'routes')"`
Expected: `8 routes`

**Step 4: Commit**

```bash
git add backend/app/api/databases.py backend/app/api/router.py
git commit -m "feat: add database CRUD API routes with Superset proxy and mock fallback"
```

---

## Task 7: Frontend — TypeScript types for databases

**Files:**
- Create: `frontend/src/types/database.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/types/api.ts` (remove old `DatabaseInfo` if conflicting)

**Step 1: Create database types**

```typescript
export type DatabaseBackend = 'oracle' | 'postgresql' | 'hive' | 'elasticsearch'

export type ConnectionStatus = 'connected' | 'unreachable' | 'untested'

export interface DatabaseInfo {
  id: number
  databaseName: string
  backend: DatabaseBackend
  createdOn: string | null
  exposeInSqllab: boolean
  datasetCount: number
  status: ConnectionStatus
}

export interface DatabaseCreate {
  databaseName: string
  backend: DatabaseBackend
  sqlalchemyUri?: string
  host?: string
  port?: number
  database?: string
  schemaName?: string
  username?: string
  password?: string
}

export interface DatabaseUpdate {
  databaseName?: string
  sqlalchemyUri?: string
  host?: string
  port?: number
  database?: string
  schemaName?: string
  username?: string
  password?: string
}

export interface TestConnectionRequest {
  backend: DatabaseBackend
  sqlalchemyUri?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
}

export interface TestConnectionResponse {
  success: boolean
  message: string
}

export interface DatasetSummary {
  id: number
  tableName: string
  columnCount: number
}

export interface DatasetPage {
  datasets: DatasetSummary[]
  total: number
  page: number
  pageSize: number
}
```

**Step 2: Remove old `DatabaseInfo` from `api.ts`**

In `frontend/src/types/api.ts`, remove the existing `DatabaseInfo` interface (lines 59-63) since the new one in `database.ts` is more complete.

**Step 3: Add to barrel export**

In `frontend/src/types/index.ts`, add:

```typescript
export type * from './database'
```

**Step 4: Verify**

Run: `cd frontend && pnpm build`
Expected: Build succeeds. If there are import errors from files using the old `DatabaseInfo`, fix them to import from `@/types/database`.

**Step 5: Commit**

```bash
git add frontend/src/types/database.ts frontend/src/types/index.ts frontend/src/types/api.ts
git commit -m "feat: add TypeScript types for database CRUD"
```

---

## Task 8: Frontend — TanStack Query hooks for databases

**Files:**
- Create: `frontend/src/hooks/use-databases.ts`

**Step 1: Create the hooks file**

```typescript
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type {
  DatabaseCreate,
  DatabaseInfo,
  DatabaseUpdate,
  DatasetPage,
  TestConnectionRequest,
  TestConnectionResponse,
} from '@/types/database'

export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: () => api.get<DatabaseInfo[]>('/api/databases'),
  })
}

export function useDatabase(id: number | null) {
  return useQuery({
    queryKey: ['database', id],
    queryFn: () => api.get<DatabaseInfo>(`/api/databases/${id}`),
    enabled: id !== null,
  })
}

export function useDatabaseDatasets(dbId: number | null) {
  return useInfiniteQuery({
    queryKey: ['database-datasets', dbId],
    queryFn: ({ pageParam = 1 }) =>
      api.get<DatasetPage>(
        `/api/databases/${dbId}/datasets?page=${pageParam}&page_size=50`,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.pageSize
      return loaded < lastPage.total ? lastPage.page + 1 : undefined
    },
    enabled: dbId !== null,
  })
}

export function useCreateDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DatabaseCreate) =>
      api.post<DatabaseInfo>('/api/databases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useUpdateDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DatabaseUpdate }) =>
      api.put<DatabaseInfo>(`/api/databases/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useDeleteDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/databases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (data: TestConnectionRequest) =>
      api.post<TestConnectionResponse>('/api/databases/test', data),
  })
}

export function useSyncDatasets() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dbId: number) =>
      api.post<{ success: boolean; datasetCount: number }>(
        `/api/databases/${dbId}/sync`,
      ),
    onSuccess: (_data, dbId) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      queryClient.invalidateQueries({ queryKey: ['database', dbId] })
      queryClient.invalidateQueries({ queryKey: ['database-datasets', dbId] })
    },
  })
}
```

**Step 2: Verify**

Run: `cd frontend && pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/hooks/use-databases.ts
git commit -m "feat: add TanStack Query hooks for database CRUD"
```

---

## Task 9: Frontend — DataSourceCard component

**Files:**
- Create: `frontend/src/components/settings/data-source-card.tsx`

**Step 1: Create the component**

```tsx
import { Database } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DatabaseInfo, ConnectionStatus, DatabaseBackend } from '@/types/database'

interface DataSourceCardProps {
  database: DatabaseInfo
  onClick: () => void
}

const BACKEND_LABELS: Record<DatabaseBackend, string> = {
  oracle: 'Oracle',
  postgresql: 'PostgreSQL',
  hive: 'Hive',
  elasticsearch: 'Elasticsearch',
}

const BACKEND_COLORS: Record<DatabaseBackend, string> = {
  oracle: 'text-red-500',
  postgresql: 'text-blue-500',
  hive: 'text-yellow-500',
  elasticsearch: 'text-green-500',
}

const STATUS_STYLES: Record<ConnectionStatus, string> = {
  connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  unreachable: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  untested: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  unreachable: 'Unreachable',
  untested: 'Untested',
}

export { BACKEND_LABELS, BACKEND_COLORS, STATUS_STYLES, STATUS_LABELS }

export function DataSourceCard({ database, onClick }: DataSourceCardProps) {
  const backendKey = database.backend as DatabaseBackend

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 p-4"
      onClick={onClick}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <Database className={cn('size-8', BACKEND_COLORS[backendKey] || 'text-muted-foreground')} />
          <Badge variant="secondary" className={cn('text-[10px]', STATUS_STYLES[database.status])}>
            {STATUS_LABELS[database.status] || database.status}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium truncate">{database.databaseName}</p>
          <p className="text-xs text-muted-foreground">
            {BACKEND_LABELS[backendKey] || database.backend} &middot; {database.datasetCount} tables
          </p>
        </div>
      </div>
    </Card>
  )
}
```

**Step 2: Verify**

Run: `cd frontend && pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/settings/data-source-card.tsx
git commit -m "feat: add DataSourceCard component"
```

---

## Task 10: Frontend — DataSourceRow component

**Files:**
- Create: `frontend/src/components/settings/data-source-row.tsx`

**Step 1: Create the component**

```tsx
import { ChevronRight, Database } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DatabaseInfo, DatabaseBackend } from '@/types/database'
import { BACKEND_LABELS, BACKEND_COLORS, STATUS_STYLES, STATUS_LABELS } from './data-source-card'

interface DataSourceRowProps {
  database: DatabaseInfo
  onClick: () => void
}

export function DataSourceRow({ database, onClick }: DataSourceRowProps) {
  const backendKey = database.backend as DatabaseBackend

  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <Database className={cn('size-5 shrink-0', BACKEND_COLORS[backendKey] || 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{database.databaseName}</p>
        <p className="text-xs text-muted-foreground">
          {BACKEND_LABELS[backendKey] || database.backend} &middot; {database.datasetCount} tables
        </p>
      </div>
      <Badge variant="secondary" className={cn('text-[10px] shrink-0', STATUS_STYLES[database.status])}>
        {STATUS_LABELS[database.status] || database.status}
      </Badge>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </div>
  )
}
```

**Step 2: Verify**

Run: `cd frontend && pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/settings/data-source-row.tsx
git commit -m "feat: add DataSourceRow component for list view"
```

---

## Task 11: Frontend — DataSourceSheet component

This is the largest component — the side panel that handles create, edit, and detail modes.

**Files:**
- Create: `frontend/src/components/settings/data-source-sheet.tsx`

**Step 1: Create the component**

```tsx
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import {
  useDatabase,
  useDatabaseDatasets,
  useCreateDatabase,
  useUpdateDatabase,
  useDeleteDatabase,
  useTestConnection,
  useSyncDatasets,
} from '@/hooks/use-databases'
import {
  BACKEND_LABELS,
  BACKEND_COLORS,
  STATUS_STYLES,
  STATUS_LABELS,
} from './data-source-card'
import type {
  DatabaseBackend,
  DatabaseInfo,
  DatabaseCreate,
  DatasetSummary,
} from '@/types/database'

type SheetMode = 'create' | 'edit' | 'detail'
type ConnectionTab = 'simple' | 'advanced'

interface DataSourceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: SheetMode
  databaseId: number | null
  onModeChange: (mode: SheetMode) => void
}

const BACKENDS: { value: DatabaseBackend; label: string; defaultPort: number }[] = [
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'oracle', label: 'Oracle', defaultPort: 1521 },
  { value: 'hive', label: 'Hive', defaultPort: 10000 },
  { value: 'elasticsearch', label: 'Elasticsearch', defaultPort: 9200 },
]

export function DataSourceSheet({
  open,
  onOpenChange,
  mode,
  databaseId,
  onModeChange,
}: DataSourceSheetProps) {
  // Form state
  const [backend, setBackend] = useState<DatabaseBackend>('postgresql')
  const [displayName, setDisplayName] = useState('')
  const [connectionTab, setConnectionTab] = useState<ConnectionTab>('simple')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [database, setDatabase] = useState('')
  const [schemaName, setSchemaName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [sqlalchemyUri, setSqlalchemyUri] = useState('')

  // Test connection state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Dataset expand state
  const [expandedDataset, setExpandedDataset] = useState<number | null>(null)

  // Queries and mutations
  const { data: databaseDetail } = useDatabase(mode === 'detail' || mode === 'edit' ? databaseId : null)
  const {
    data: datasetsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: datasetsLoading,
  } = useDatabaseDatasets(mode === 'detail' ? databaseId : null)

  const createMutation = useCreateDatabase()
  const updateMutation = useUpdateDatabase()
  const deleteMutation = useDeleteDatabase()
  const testMutation = useTestConnection()
  const syncMutation = useSyncDatasets()

  // Flatten paginated datasets
  const allDatasets = useMemo(
    () => datasetsPages?.pages.flatMap((p) => p.datasets) ?? [],
    [datasetsPages],
  )
  const totalDatasets = datasetsPages?.pages[0]?.total ?? 0

  // Reset form when mode/database changes
  useEffect(() => {
    setTestResult(null)
    setExpandedDataset(null)
    if (mode === 'create') {
      setBackend('postgresql')
      setDisplayName('')
      setConnectionTab('simple')
      setHost('')
      setPort('5432')
      setDatabase('')
      setSchemaName('')
      setUsername('')
      setPassword('')
      setSqlalchemyUri('')
    }
  }, [mode, databaseId, open])

  // Auto-fill port when backend changes in create/edit mode
  useEffect(() => {
    if (mode === 'create' || mode === 'edit') {
      const backendConfig = BACKENDS.find((b) => b.value === backend)
      if (backendConfig) {
        setPort(String(backendConfig.defaultPort))
      }
    }
  }, [backend, mode])

  const handleTestConnection = () => {
    setTestResult(null)
    const payload =
      connectionTab === 'advanced'
        ? { backend, sqlalchemyUri }
        : { backend, host, port: port ? parseInt(port) : undefined, database, username, password }
    testMutation.mutate(payload, {
      onSuccess: (res) => setTestResult(res),
      onError: () => setTestResult({ success: false, message: 'Request failed' }),
    })
  }

  const handleSave = () => {
    const data: DatabaseCreate = {
      databaseName: displayName,
      backend,
      ...(connectionTab === 'advanced'
        ? { sqlalchemyUri }
        : { host, port: port ? parseInt(port) : undefined, database, schemaName, username, password }),
    }

    if (mode === 'create') {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success(`Created "${displayName}"`)
          onOpenChange(false)
        },
        onError: () => toast.error('Failed to create data source'),
      })
    } else if (mode === 'edit' && databaseId) {
      updateMutation.mutate(
        { id: databaseId, data },
        {
          onSuccess: () => {
            toast.success(`Updated "${displayName}"`)
            onModeChange('detail')
          },
          onError: () => toast.error('Failed to update data source'),
        },
      )
    }
  }

  const handleDelete = () => {
    if (!databaseId || !databaseDetail) return
    if (!window.confirm(`Delete "${databaseDetail.databaseName}"? This cannot be undone.`)) return
    deleteMutation.mutate(databaseId, {
      onSuccess: () => {
        toast.success(`Deleted "${databaseDetail.databaseName}"`)
        onOpenChange(false)
      },
      onError: () => toast.error('Failed to delete data source'),
    })
  }

  const handleSync = () => {
    if (!databaseId) return
    syncMutation.mutate(databaseId, {
      onSuccess: (res) => toast.success(`Synced ${res.datasetCount} datasets`),
      onError: () => toast.error('Failed to sync datasets'),
    })
  }

  const canSave = displayName.trim() && (connectionTab === 'advanced' ? sqlalchemyUri.trim() : host.trim())
  const isSaving = createMutation.isPending || updateMutation.isPending

  // ── Render ──────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[540px] sm:max-w-[540px] p-0 flex flex-col">
        {mode === 'detail' ? (
          <DetailView
            database={databaseDetail}
            datasets={allDatasets}
            totalDatasets={totalDatasets}
            datasetsLoading={datasetsLoading}
            expandedDataset={expandedDataset}
            onToggleDataset={(id) => setExpandedDataset(expandedDataset === id ? null : id)}
            hasNextPage={hasNextPage ?? false}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
            onEdit={() => onModeChange('edit')}
            onDelete={handleDelete}
            onTestConnection={handleTestConnection}
            testMutation={testMutation}
            testResult={testResult}
            onSync={handleSync}
            syncMutation={syncMutation}
          />
        ) : (
          <FormView
            mode={mode}
            backend={backend}
            onBackendChange={setBackend}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            connectionTab={connectionTab}
            onConnectionTabChange={setConnectionTab}
            host={host}
            onHostChange={setHost}
            port={port}
            onPortChange={setPort}
            database={database}
            onDatabaseChange={setDatabase}
            schemaName={schemaName}
            onSchemaNameChange={setSchemaName}
            username={username}
            onUsernameChange={setUsername}
            password={password}
            onPasswordChange={setPassword}
            sqlalchemyUri={sqlalchemyUri}
            onSqlalchemyUriChange={setSqlalchemyUri}
            onTestConnection={handleTestConnection}
            testMutation={testMutation}
            testResult={testResult}
            canSave={canSave}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => {
              if (mode === 'edit') {
                onModeChange('detail')
              } else {
                onOpenChange(false)
              }
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Detail View ──────────────────────────────────────────────

interface DetailViewProps {
  database: DatabaseInfo | undefined
  datasets: DatasetSummary[]
  totalDatasets: number
  datasetsLoading: boolean
  expandedDataset: number | null
  onToggleDataset: (id: number) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  onEdit: () => void
  onDelete: () => void
  onTestConnection: () => void
  testMutation: ReturnType<typeof useTestConnection>
  testResult: { success: boolean; message: string } | null
  onSync: () => void
  syncMutation: ReturnType<typeof useSyncDatasets>
}

function DetailView({
  database,
  datasets,
  totalDatasets,
  datasetsLoading,
  expandedDataset,
  onToggleDataset,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onEdit,
  onDelete,
  onTestConnection,
  testMutation,
  testResult,
  onSync,
  syncMutation,
}: DetailViewProps) {
  if (!database) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const backendKey = database.backend as DatabaseBackend

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Database className={cn('size-5', BACKEND_COLORS[backendKey])} />
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base truncate">{database.databaseName}</SheetTitle>
            <SheetDescription>
              {BACKEND_LABELS[backendKey] || database.backend}
              {database.createdOn && (
                <> &middot; Created {new Date(database.createdOn).toLocaleDateString()}</>
              )}
            </SheetDescription>
          </div>
          <Badge variant="secondary" className={cn('text-[10px] shrink-0', STATUS_STYLES[database.status])}>
            {STATUS_LABELS[database.status]}
          </Badge>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Datasets Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                Datasets{' '}
                <span className="text-muted-foreground font-normal">
                  ({datasets.length} of {totalDatasets})
                </span>
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onSync}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={cn('mr-1 size-3', syncMutation.isPending && 'animate-spin')} />
                Sync
              </Button>
            </div>

            {datasetsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No datasets found. Click Sync to refresh.
              </p>
            ) : (
              <div className="space-y-1">
                {datasets.map((ds) => (
                  <div key={ds.id}>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => onToggleDataset(ds.id)}
                    >
                      {expandedDataset === ds.id ? (
                        <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-mono text-xs truncate flex-1 text-left">
                        {ds.tableName}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {ds.columnCount} cols
                      </span>
                    </button>
                    {expandedDataset === ds.id && (
                      <div className="ml-6 pl-2 border-l text-xs text-muted-foreground py-1">
                        <p className="italic">Column details loaded on demand</p>
                      </div>
                    )}
                  </div>
                ))}
                {hasNextPage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground"
                    onClick={onLoadMore}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : null}
                    Load more...
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTestConnection}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Test Connection
            </Button>
            {testResult && (
              <div className="flex items-center gap-1.5 text-xs">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">{testResult.message}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-3.5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">{testResult.message}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="border-t p-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 size-3.5" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="mr-1.5 size-3.5" />
          Delete
        </Button>
      </div>
    </>
  )
}

// ── Form View (Create / Edit) ────────────────────────────────

interface FormViewProps {
  mode: 'create' | 'edit'
  backend: DatabaseBackend
  onBackendChange: (b: DatabaseBackend) => void
  displayName: string
  onDisplayNameChange: (v: string) => void
  connectionTab: ConnectionTab
  onConnectionTabChange: (t: ConnectionTab) => void
  host: string
  onHostChange: (v: string) => void
  port: string
  onPortChange: (v: string) => void
  database: string
  onDatabaseChange: (v: string) => void
  schemaName: string
  onSchemaNameChange: (v: string) => void
  username: string
  onUsernameChange: (v: string) => void
  password: string
  onPasswordChange: (v: string) => void
  sqlalchemyUri: string
  onSqlalchemyUriChange: (v: string) => void
  onTestConnection: () => void
  testMutation: ReturnType<typeof useTestConnection>
  testResult: { success: boolean; message: string } | null
  canSave: boolean
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
}

function FormView({
  mode,
  backend,
  onBackendChange,
  displayName,
  onDisplayNameChange,
  connectionTab,
  onConnectionTabChange,
  host,
  onHostChange,
  port,
  onPortChange,
  database,
  onDatabaseChange,
  schemaName,
  onSchemaNameChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  sqlalchemyUri,
  onSqlalchemyUriChange,
  onTestConnection,
  testMutation,
  testResult,
  canSave,
  isSaving,
  onSave,
  onCancel,
}: FormViewProps) {
  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle className="text-base">
          {mode === 'create' ? 'Add Data Source' : 'Edit Data Source'}
        </SheetTitle>
        <SheetDescription>
          {mode === 'create'
            ? 'Configure a new database connection'
            : 'Update connection details'}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Database Type */}
          <div className="space-y-2">
            <Label>Database Type</Label>
            <div className="grid grid-cols-4 gap-2">
              {BACKENDS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => onBackendChange(b.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors cursor-pointer',
                    backend === b.value
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30',
                  )}
                >
                  <Database
                    className={cn(
                      'size-5',
                      backend === b.value
                        ? BACKEND_COLORS[b.value]
                        : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[11px] font-medium',
                      backend === b.value ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {b.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              placeholder="e.g. recon_data_prod"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
            />
          </div>

          <Separator />

          {/* Connection Tab Toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Connection</Label>
              <div className="flex gap-1 ml-auto">
                <Button
                  variant={connectionTab === 'simple' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onConnectionTabChange('simple')}
                >
                  Simple
                </Button>
                <Button
                  variant={connectionTab === 'advanced' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onConnectionTabChange('advanced')}
                >
                  Advanced
                </Button>
              </div>
            </div>

            {connectionTab === 'simple' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="host" className="text-xs">Host</Label>
                    <Input
                      id="host"
                      placeholder="db-host.example.com"
                      value={host}
                      onChange={(e) => onHostChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="port" className="text-xs">Port</Label>
                    <Input
                      id="port"
                      placeholder="5432"
                      value={port}
                      onChange={(e) => onPortChange(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="database" className="text-xs">Database</Label>
                    <Input
                      id="database"
                      placeholder="mydb"
                      value={database}
                      onChange={(e) => onDatabaseChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="schema" className="text-xs">Schema</Label>
                    <Input
                      id="schema"
                      placeholder="public"
                      value={schemaName}
                      onChange={(e) => onSchemaNameChange(e.target.value)}
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-xs">Username</Label>
                    <Input
                      id="username"
                      placeholder="db_user"
                      value={username}
                      onChange={(e) => onUsernameChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => onPasswordChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="uri" className="text-xs">SQLAlchemy URI</Label>
                <Textarea
                  id="uri"
                  placeholder="postgresql://user:pass@host:5432/dbname"
                  className="font-mono text-xs min-h-[80px]"
                  value={sqlalchemyUri}
                  onChange={(e) => onSqlalchemyUriChange(e.target.value)}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTestConnection}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Test Connection
            </Button>
            {testResult && (
              <div className="flex items-center gap-1.5 text-xs">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">{testResult.message}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-3.5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">{testResult.message}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={!canSave || isSaving}>
          {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          {mode === 'create' ? 'Save' : 'Update'}
        </Button>
      </div>
    </>
  )
}
```

**Step 2: Verify**

Run: `cd frontend && pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/settings/data-source-sheet.tsx
git commit -m "feat: add DataSourceSheet component with create/edit/detail modes"
```

---

## Task 12: Frontend — DataSourcesToolbar component

**Files:**
- Create: `frontend/src/components/settings/data-sources-toolbar.tsx`

**Step 1: Create the component**

```tsx
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type ViewMode = 'grid' | 'list'

interface DataSourcesToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onAddClick: () => void
}

export function DataSourcesToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onAddClick,
}: DataSourcesToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search databases..."
          className="pl-8 h-8 text-sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={viewMode}
        onValueChange={(v) => {
          if (v) onViewModeChange(v as ViewMode)
        }}
      >
        <ToggleGroupItem value="list" aria-label="List view">
          <List className="size-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid className="size-3.5" />
        </ToggleGroupItem>
      </ToggleGroup>
      <Button size="sm" className="h-8" onClick={onAddClick}>
        <Plus className="mr-1.5 size-3.5" />
        Add Source
      </Button>
    </div>
  )
}
```

**Step 2: Verify**

Run: `cd frontend && pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/settings/data-sources-toolbar.tsx
git commit -m "feat: add DataSourcesToolbar with search, view toggle, and add button"
```

---

## Task 13: Frontend — DataSourcesTab orchestrator component

**Files:**
- Create: `frontend/src/components/settings/data-sources-tab.tsx`

**Step 1: Create the orchestrator component**

```tsx
import { useState, useMemo } from 'react'
import { Database } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { useDatabases } from '@/hooks/use-databases'
import { DataSourcesToolbar } from './data-sources-toolbar'
import { DataSourceCard } from './data-source-card'
import { DataSourceRow } from './data-source-row'
import { DataSourceSheet } from './data-source-sheet'

type ViewMode = 'grid' | 'list'
type SheetMode = 'create' | 'edit' | 'detail'

export function DataSourcesTab() {
  const { data: databases = [], isLoading } = useDatabases()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<SheetMode>('create')
  const [selectedDbId, setSelectedDbId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return databases
    const q = searchQuery.toLowerCase()
    return databases.filter(
      (db) =>
        db.databaseName.toLowerCase().includes(q) ||
        db.backend.toLowerCase().includes(q),
    )
  }, [databases, searchQuery])

  const handleOpenCreate = () => {
    setSelectedDbId(null)
    setSheetMode('create')
    setSheetOpen(true)
  }

  const handleOpenDetail = (dbId: number) => {
    setSelectedDbId(dbId)
    setSheetMode('detail')
    setSheetOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Data Sources</CardTitle>
          <CardDescription>
            Manage database connections used by Superset
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataSourcesToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddClick={handleOpenCreate}
          />

          {isLoading ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[120px] rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[56px] rounded-lg" />
                ))}
              </div>
            )
          ) : filtered.length === 0 && !searchQuery ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Database />
                </EmptyMedia>
                <EmptyTitle>No data sources configured</EmptyTitle>
                <EmptyDescription>
                  Add your first database connection to start querying data.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={handleOpenCreate}>
                  Add Data Source
                </Button>
              </EmptyContent>
            </Empty>
          ) : filtered.length === 0 && searchQuery ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No databases matching &ldquo;{searchQuery}&rdquo;
            </p>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map((db) => (
                <DataSourceCard
                  key={db.id}
                  database={db}
                  onClick={() => handleOpenDetail(db.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((db) => (
                <DataSourceRow
                  key={db.id}
                  database={db}
                  onClick={() => handleOpenDetail(db.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DataSourceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        databaseId={selectedDbId}
        onModeChange={setSheetMode}
      />
    </>
  )
}
```

**Step 2: Verify**

Run: `cd frontend && pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/settings/data-sources-tab.tsx
git commit -m "feat: add DataSourcesTab orchestrator with grid/list toggle and sheet"
```

---

## Task 14: Frontend — Wire DataSourcesTab into Settings page

**Files:**
- Modify: `frontend/src/routes/settings/index.tsx`

**Step 1: Replace the static Data Sources tab content**

Add import at the top (with the other imports):

```typescript
import { DataSourcesTab } from '@/components/settings/data-sources-tab'
```

Replace the entire Data Sources `TabsContent` block (the one with `value="data-sources"`) with:

```tsx
        {/* Data Sources Tab */}
        <TabsContent value="data-sources" className="mt-4">
          <DataSourcesTab />
        </TabsContent>
```

Remove these now-unused imports from the top of the file (only if they are no longer used by other tabs):
- `Database` from lucide-react (check if still used — it is NOT used in the other tabs)
- `Server` from lucide-react (still used in the TabsTrigger, keep it)
- `useDatasets` from hooks (no longer needed in settings since DataSourcesTab uses useDatabases)

Also remove the `useDatasets` call from the component body:
```typescript
// Remove this line:
const { data: datasets = [] } = useDatasets()
```

**Step 2: Verify**

Run: `cd frontend && pnpm build`
Expected: Build succeeds.

**Step 3: Manual visual test**

Run: `cd frontend && pnpm dev`
Navigate to `http://localhost:5173/settings` and click the Data Sources tab.
Expected: Grid of 3 mock database cards. Toggle to list view. Click a card to open the sheet. Click "Add Source" to open create form.

**Step 4: Commit**

```bash
git add frontend/src/routes/settings/index.tsx
git commit -m "feat: wire DataSourcesTab into Settings page, replace static data sources"
```

---

## Task 15: Visual polish and dark mode verification

**Files:**
- Potentially minor tweaks to any component from Tasks 9-13

**Step 1: Visual check in light mode**

Open `http://localhost:5173/settings` → Data Sources tab.
Verify:
- Grid cards render with correct spacing and hover effect
- List rows render with correct alignment
- Sheet opens smoothly from the right
- Create form has correct field layout
- Detail view shows datasets with expand/collapse
- Empty state shows correctly (delete all mock sources and reload)

**Step 2: Visual check in dark mode**

Toggle to dark mode via Settings > Appearance.
Verify:
- All status badges have correct dark mode colors
- Form inputs are readable
- Sheet background matches the app background
- No hard-coded colors leaking through

**Step 3: Fix any issues found and commit**

```bash
git add -u
git commit -m "fix: polish Data Sources UI and dark mode consistency"
```

---

## Summary of all files touched

### Created (new files)
| File | Description |
|---|---|
| `backend/app/models/database.py` | Pydantic models for database CRUD |
| `backend/app/services/uri_builder.py` | SQLAlchemy URI builder from form fields |
| `backend/app/api/databases.py` | Full CRUD + test + sync API routes |
| `frontend/src/types/database.ts` | TypeScript types for database entities |
| `frontend/src/hooks/use-databases.ts` | TanStack Query hooks for all database operations |
| `frontend/src/components/settings/data-source-card.tsx` | Grid card component |
| `frontend/src/components/settings/data-source-row.tsx` | List row component |
| `frontend/src/components/settings/data-source-sheet.tsx` | Side panel (create/edit/detail) |
| `frontend/src/components/settings/data-sources-toolbar.tsx` | Search + view toggle + add button |
| `frontend/src/components/settings/data-sources-tab.tsx` | Tab orchestrator component |

### Modified (existing files)
| File | Change |
|---|---|
| `frontend/src/lib/api-client.ts` | Add `put` method |
| `frontend/src/types/api.ts` | Remove old `DatabaseInfo` |
| `frontend/src/types/index.ts` | Add `database` barrel export |
| `frontend/src/routes/settings/index.tsx` | Wire in `DataSourcesTab`, remove static content |
| `backend/app/services/superset_client.py` | Add 5 new methods (get, create, update, delete, test) |
| `backend/app/mock_data.py` | Expand `MOCK_DATABASES`, add `MOCK_DATABASE_DATASETS` |
| `backend/app/api/router.py` | Register databases router |
