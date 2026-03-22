# Data Sources Tab — Design Document

**Date**: 2026-02-21
**Status**: Approved
**Scope**: Settings > Data Sources tab — full CRUD, test connection, sync datasets

---

## Summary

Replace the static Data Sources tab in Settings with a fully functional data source management interface. Users can add, edit, test, sync, and delete database connections. All operations proxy through FastAPI to Superset's REST API.

Supported database types: **Oracle**, **PostgreSQL** (dev), **Hive**, **Elasticsearch**.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Side-panel (Sheet) + grid/list toggle | Stays in Settings context, premium UX, no route changes |
| CRUD scope | Full CRUD + Test + Sync Datasets | Complete lifecycle management |
| Connection input | Simple form + Advanced URI (tabbed) | Serves both analysts and power users |
| Backend integration | Full Superset proxy | End-to-end via Superset REST API, mock fallback when unavailable |
| Dataset loading | Infinite scroll (50 per batch) | Handles Oracle DBs with 300+ tables without overloading |
| Dataset click | Accordion-expand columns inline | Quick peek at table structure without navigation |

---

## Component Architecture

```
settings/index.tsx (existing — renders DataSourcesTab in tab content)
  └── DataSourcesTab
        ├── DataSourcesToolbar
        │   ├── "Add Data Source" button → opens sheet in create mode
        │   ├── Search input (client-side filter)
        │   └── Grid/List toggle (ToggleGroup)
        │
        ├── DataSourceGrid (grid view — default)
        │   └── DataSourceCard × N
        │       ├── DB type icon (colored per backend)
        │       ├── Name, backend type, dataset count, status badge
        │       └── Click → opens sheet in detail mode
        │
        ├── DataSourceList (list view)
        │   └── DataSourceRow × N (horizontal, denser layout)
        │
        └── DataSourceSheet (Shadcn Sheet, side="right", ~540px)
              ├── CREATE mode
              │   ├── DB type selector (4 selectable cards)
              │   ├── Display name input
              │   ├── Connection toggle: Simple | Advanced
              │   │   ├── Simple: host, port, database, schema, username, password
              │   │   └── Advanced: SQLAlchemy URI textarea
              │   ├── Port auto-fills per DB type
              │   ├── "Test Connection" button with loading/success/fail
              │   └── Cancel / Save buttons
              │
              ├── DETAIL mode
              │   ├── Header: name, type icon, status badge, created date
              │   ├── Connection info card (password masked)
              │   ├── Datasets section:
              │   │   ├── Header with count ("X of Y"), search filter, Sync button
              │   │   ├── Scrollable list with infinite scroll (50 per batch)
              │   │   └── Each row: table name, column count, click to expand columns
              │   └── Actions: Edit, Test Connection, Delete (with confirmation)
              │
              └── EDIT mode
                  └── Same form as CREATE, pre-filled with existing values
```

**File locations**: All new components under `src/components/settings/`.

---

## Status Badges

| Badge | Color | Meaning |
|---|---|---|
| Connected | Emerald (`bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`) | Last test succeeded |
| Unreachable | Red (`bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`) | Last test failed |
| Untested | Amber (`bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`) | Never tested |

Status is set on explicit "Test Connection" action, not polled continuously.

---

## API Design

### New Backend Endpoints (`backend/app/api/databases.py`)

| Method | Endpoint | Purpose | Superset API |
|---|---|---|---|
| GET | `/api/databases` | List all connections | `GET /api/v1/database/` |
| GET | `/api/databases/{id}` | Get single connection + details | `GET /api/v1/database/{id}` |
| POST | `/api/databases` | Create new connection | `POST /api/v1/database/` |
| PUT | `/api/databases/{id}` | Update existing connection | `PUT /api/v1/database/{id}` |
| DELETE | `/api/databases/{id}` | Delete connection | `DELETE /api/v1/database/{id}` |
| POST | `/api/databases/test` | Test connection (before or after save) | `POST /api/v1/database/test_connection/` |
| POST | `/api/databases/{id}/sync` | Refresh datasets from DB | Superset dataset refresh |

### Pydantic Models (`backend/app/models/database.py`)

```python
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

### SupersetClient Additions (`backend/app/services/superset_client.py`)

```python
async def create_database(self, payload: dict) -> dict
async def update_database(self, db_id: int, payload: dict) -> dict
async def delete_database(self, db_id: int) -> None
async def test_connection(self, payload: dict) -> dict
```

### URI Builder Utility (`backend/app/services/uri_builder.py`)

Constructs SQLAlchemy URIs from simple form fields:
- Oracle: `oracle+cx_oracle://user:pass@host:port/?service_name=db`
- PostgreSQL: `postgresql://user:pass@host:port/db`
- Hive: `hive://user:pass@host:port/db`
- Elasticsearch: `elasticsearch+http://host:port/`

---

## Frontend Hooks (`src/hooks/`)

| Hook | File | Query Key | Endpoint |
|---|---|---|---|
| `useDatabases()` | `use-databases.ts` | `['databases']` | `GET /api/databases` |
| `useDatabase(id)` | `use-databases.ts` | `['database', id]` | `GET /api/databases/{id}` |
| `useCreateDatabase()` | `use-databases.ts` | mutation → invalidates `['databases']` | `POST /api/databases` |
| `useUpdateDatabase()` | `use-databases.ts` | mutation → invalidates `['databases', 'database']` | `PUT /api/databases/{id}` |
| `useDeleteDatabase()` | `use-databases.ts` | mutation → invalidates `['databases']` | `DELETE /api/databases/{id}` |
| `useTestConnection()` | `use-databases.ts` | mutation (no cache) | `POST /api/databases/test` |
| `useSyncDatasets()` | `use-databases.ts` | mutation → invalidates `['database', id]` | `POST /api/databases/{id}/sync` |

---

## Frontend Types (`src/types/database.ts`)

```typescript
type DatabaseBackend = 'oracle' | 'postgresql' | 'hive' | 'elasticsearch'
type ConnectionStatus = 'connected' | 'unreachable' | 'untested'

interface DatabaseInfo {
  id: number
  databaseName: string
  backend: DatabaseBackend
  createdOn: string | null
  exposeInSqllab: boolean
  datasetCount: number
  status: ConnectionStatus
}

interface DatabaseCreate {
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

interface DatabaseUpdate extends Partial<DatabaseCreate> {}

interface DatasetSummary {
  id: number
  tableName: string
  columnCount: number
}
```

---

## Visual Design

### Grid Card
- DB type icon (colored) at top-left
- Database name (bold, `text-sm font-medium`)
- Backend type (`text-xs text-muted-foreground`)
- Dataset count (`text-xs text-muted-foreground`)
- Status badge (bottom or top-right)
- Hover: `hover:shadow-md hover:-translate-y-0.5` transition
- Click: opens detail sheet

### List Row
- Horizontal: icon | name | backend | dataset count | status badge | chevron-right
- Hover: `hover:bg-muted/50`
- Click: opens detail sheet

### Default port per backend
- Oracle: 1521
- PostgreSQL: 5432
- Hive: 10000
- Elasticsearch: 9200

### Empty state
Shadcn `Empty` component: database icon, "No data sources configured", "Add your first database connection to start querying data", prominent "Add Data Source" button.

---

## Dataset List in Detail Sheet

- Fetched with infinite scroll, 50 per batch
- Search/filter input above the list (client-side on loaded data)
- Each row shows: table name + column count
- No row counts (Oracle DBs with 300+ tables make this prohibitive)
- Click row to accordion-expand column list (name + type)
- "Sync" button at top refreshes from actual database

---

## Mock Data Enhancements

Expand `MOCK_DATABASES` to include multiple entries for development:

```python
MOCK_DATABASES = [
    {"id": 1, "database_name": "recon_data", "backend": "postgresql",
     "created_on": "2026-01-15T10:00:00Z", "dataset_count": 4, "status": "connected"},
    {"id": 2, "database_name": "oracle_prod", "backend": "oracle",
     "created_on": "2026-01-20T14:30:00Z", "dataset_count": 47, "status": "connected"},
    {"id": 3, "database_name": "hive_warehouse", "backend": "hive",
     "created_on": "2026-02-01T09:00:00Z", "dataset_count": 12, "status": "untested"},
]
```
