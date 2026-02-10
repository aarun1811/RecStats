# Agent 08 — Backend Core (Route Handlers)

## Mission
Implement all FastAPI route handlers. These are the API endpoints the frontend calls. Most proxy to Superset, some handle sidecar functionality.

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/backend/`

## What Already Exists (from scaffolding)
- `app/main.py` — FastAPI app with CORS, lifespan, health endpoint
- `app/config.py` — Settings with Superset/Redis/ES URLs
- `app/api/router.py` — aggregates all route files
- `app/api/*.py` — stub files with empty routers (charts, datasets, sql, dashboards, search, custom, export, views)
- `app/core/dependencies.py` — `get_superset_client` dependency
- `app/core/exceptions.py` — SupersetError, SidecarError handlers
- `app/models/filters.py` — GlobalFilters, SupersetFilter, DateRange models
- `app/services/superset_client.py` — SupersetClient stub

## Files To Implement

### 1. `app/api/charts.py`
```python
# GET /api/charts — list all charts
# GET /api/charts/{chart_id} — get chart definition
# POST /api/charts/{chart_id}/data — fetch chart data with filters
#   Body: { filters: GlobalFilters }
#   → Converts to Superset filters
#   → Calls superset_client.get_chart_data()
#   → Returns ChartDataResponse
```

### 2. `app/api/datasets.py`
```python
# GET /api/datasets — list all datasets
# GET /api/datasets/{dataset_id} — get dataset details + columns
# POST /api/datasets/{dataset_id}/data — paginated data with filters
#   Body: { filters: GlobalFilters, order_by: [...], offset: int, limit: int }
#   → Calls superset_client.get_dataset_data()
#   → Returns DatasetDataResponse with nextOffset
```

### 3. `app/api/sql.py`
```python
# POST /api/sql/execute — execute ad-hoc SQL
#   Body: { database_id: int, sql: str, schema?: str, limit?: int }
#   → Calls superset_client.execute_sql()
#   → Returns SqlExecuteResponse
# GET /api/sql/databases — list available databases
#   → Calls superset_client.list_databases()
```

### 4. `app/api/dashboards.py`
```python
# GET /api/dashboards — list dashboards
#   → Returns list of dashboard configs from sidecar DB (or mock data for now)
# GET /api/dashboards/{dashboard_id} — get dashboard config
#   → Returns DashboardConfig (layout, charts, cross-filter rules)
# POST /api/dashboards — create new dashboard config
# PUT /api/dashboards/{dashboard_id} — update dashboard config
```

Since we decided dashboard configs are in sidecar DB (Oracle), for now return mock/hardcoded dashboard configs. The real DB integration can come later.

### 5. `app/api/search.py`
```python
# POST /api/search — full-text search
#   Body: { query: str, indices?: list[str], limit?: int }
#   → Calls elasticsearch service directly
#   → Returns SearchResponse with hits
```

### 6. `app/api/custom.py`
```python
# POST /api/custom/aggregations — custom business logic aggregations
#   Body: { type: str, params: dict }
#   Supported types:
#     - "weighted_aging" — break amount × days outstanding
#     - "rolling_recon_rate" — matched/total over trailing N days
#     - "break_velocity" — new vs resolved rate over time
#   → Calls aggregation_service
#   → Returns computed results
```

### 7. `app/api/export.py`
```python
# POST /api/export/pdf — generate PDF report
#   Body: ExportRequest { dashboard_id, filters, options }
#   → Queues Celery task (or runs sync for now)
#   → Returns { job_id: str }
# POST /api/export/excel — generate Excel export
#   Body: ExportRequest
#   → Returns downloadable file
# GET /api/export/status/{job_id} — check export job status
```

### 8. `app/api/views.py`
```python
# GET /api/views — list saved views for current user
# POST /api/views — save a new view
#   Body: { name: str, filters: GlobalFilters, layout?: dict }
# GET /api/views/{view_id} — get saved view
# DELETE /api/views/{view_id} — delete saved view
```

For now, store views in memory (dict) or a simple JSON file. Real DB later.

### 9. Pydantic Models

#### `app/models/chart_data.py`
```python
class ChartDataRequest(BaseModel):
    filters: GlobalFilters = GlobalFilters()

class ChartDataResponse(BaseModel):
    data: list[dict]
    columns: list[str]
    row_count: int
```

#### `app/models/dataset.py`
```python
class DatasetColumn(BaseModel):
    name: str
    type: str
    is_filterable: bool = True
    is_groupable: bool = True

class DatasetResponse(BaseModel):
    id: int
    name: str
    database: str
    schema_name: str
    table_name: str
    columns: list[DatasetColumn]

class DatasetDataRequest(BaseModel):
    filters: GlobalFilters = GlobalFilters()
    order_by: list[dict] = []
    offset: int = 0
    limit: int = 500
```

#### `app/models/export.py`
```python
class ExportRequest(BaseModel):
    format: str  # "pdf" or "excel"
    dashboard_id: str
    filters: GlobalFilters = GlobalFilters()
    options: dict = {}
```

#### `app/models/views.py`
```python
class SavedView(BaseModel):
    id: str
    name: str
    filters: GlobalFilters
    layout: dict | None = None
    created_at: datetime
```

### 10. Register Exception Handlers
In `app/main.py`, add:
```python
app.add_exception_handler(SupersetError, superset_error_handler)
app.add_exception_handler(SidecarError, sidecar_error_handler)
```

### 11. Mock Data
Create `app/mock/` directory with mock dashboard configs and sample data for development/testing when Superset isn't available.

## Design Rules
- All endpoints are `async def`
- Use `Depends(get_superset_client)` for Superset-proxied routes
- Validate all inputs with Pydantic models
- Return proper HTTP status codes (200, 201, 400, 404, 500)
- Log errors but return clean error responses
- Keep route handlers thin — delegate to services

## Acceptance Criteria
- [ ] All route handlers implemented with proper Pydantic models
- [ ] Chart data endpoint accepts filters and returns data
- [ ] SQL execute endpoint works
- [ ] Dashboard config endpoint returns mock config
- [ ] Search endpoint delegates to ES service
- [ ] Export endpoints return job IDs or files
- [ ] Views CRUD works (in-memory storage)
- [ ] Exception handlers registered
- [ ] `pytest` runs without errors
- [ ] `ruff check .` passes
