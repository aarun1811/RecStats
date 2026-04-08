<!-- generated-by: gsd-doc-writer -->
# API Reference

The RecViz backend is a FastAPI application that serves as a proxy and sidecar to Apache Superset (used as a headless query engine). The frontend React SPA communicates exclusively with this backend -- it never talks to Superset directly.

**Base URL:** `http://localhost:8000` (configurable via `VITE_API_BASE_URL` on the frontend)

## Authentication

**No authentication is currently implemented on any endpoint.** Auth is planned (likely SSO/SAML/OIDC) but has not been built yet. All endpoints are open.

Internally, the FastAPI backend authenticates to Superset using Bearer JWT tokens. The `SupersetClient` service handles login via `POST /api/v1/security/login` against Superset, acquires an access token, and automatically refreshes it when the token is older than 25 minutes (Superset default expiry is 30 minutes). This is transparent to API consumers.

The Superset credentials are configured via environment variables:

| Variable | Default |
|---|---|
| `SUPERSET_USERNAME` | `admin` |
| `SUPERSET_PASSWORD` | `admin` |

## Endpoints Overview

All endpoints are prefixed from the application root (no global `/api/v1` prefix -- individual routers define their own paths).

### Health & Diagnostics

| Method | Path | Description | Tags |
|---|---|---|---|
| GET | `/health` | Health check -- returns `{"status": "ok", "superset": true}` | -- |
| GET | `/api/test-superset` | Test Superset connectivity and list registered datasets | -- |

### Dashboards (Config-Driven)

| Method | Path | Description | Tags |
|---|---|---|---|
| GET | `/api/dashboards` | List all dashboards from the config store | dashboards |
| GET | `/api/dashboards/{dashboard_id}` | Get full dashboard configuration by ID | dashboards |
| POST | `/api/dashboards/{dashboard_id}/kpis` | Compute KPI values for a dashboard with optional filters | dashboards |

### Data Sources (Config-Driven)

| Method | Path | Description | Tags |
|---|---|---|---|
| POST | `/api/data-sources/{data_source_id}/query` | Execute a data source query with optional filters | data-sources |
| POST | `/api/data-sources/merge` | Merge results from multiple data sources | data-sources |
| GET | `/api/data-sources/{data_source_id}/distinct/{column}` | Get distinct values for a column (for filter dropdowns) | data-sources |

### Databases (CRUD via Superset)

| Method | Path | Description | Tags |
|---|---|---|---|
| GET | `/api/databases` | List all database connections with connection status | databases |
| GET | `/api/databases/{db_id}` | Get a single database connection by ID | databases |
| GET | `/api/databases/{db_id}/datasets` | List datasets belonging to a database (paginated) | databases |
| POST | `/api/databases` | Register a new database connection in Superset | databases |
| PUT | `/api/databases/{db_id}` | Update a database connection | databases |
| DELETE | `/api/databases/{db_id}` | Delete a database connection from Superset | databases |
| POST | `/api/databases/test` | Test a database connection (without persisting) | databases |
| POST | `/api/databases/{db_id}/sync` | Trigger a dataset refresh for a database | databases |

### Managed Datasets (RecViz-Owned, Synced to Superset)

| Method | Path | Description | Tags |
|---|---|---|---|
| GET | `/api/datasets/managed` | List all RecViz-managed datasets | managed-datasets |
| POST | `/api/datasets/managed` | Create a managed dataset and sync to Superset | managed-datasets |
| GET | `/api/datasets/managed/{dataset_id}` | Get a single managed dataset by ID | managed-datasets |
| PUT | `/api/datasets/managed/{dataset_id}` | Update a managed dataset (marks for re-sync if SQL changes) | managed-datasets |
| DELETE | `/api/datasets/managed/{dataset_id}` | Delete a managed dataset (blocked if charts reference it) | managed-datasets |
| GET | `/api/datasets/managed/{dataset_id}/references` | Check what charts reference this dataset | managed-datasets |

### Managed Charts (RecViz-Owned)

| Method | Path | Description | Tags |
|---|---|---|---|
| GET | `/api/charts/managed` | List all RecViz-managed charts | managed-charts |
| POST | `/api/charts/managed` | Create a new managed chart | managed-charts |
| GET | `/api/charts/managed/{chart_id}` | Get a single managed chart by ID | managed-charts |
| PUT | `/api/charts/managed/{chart_id}` | Update a managed chart | managed-charts |
| DELETE | `/api/charts/managed/{chart_id}` | Delete a managed chart | managed-charts |
| GET | `/api/charts/managed/{chart_id}/references` | Check what dashboards reference this chart | managed-charts |

### Legacy Charts (Superset Proxy)

| Method | Path | Description | Tags |
|---|---|---|---|
| GET | `/api/charts` | List all charts from Superset | charts |
| GET | `/api/charts/{chart_id}` | Get a single Superset chart by ID | charts |
| POST | `/api/charts/{chart_id}/data` | Query chart data from Superset with filters and drill-down | charts |

### Legacy Datasets (Superset Proxy)

| Method | Path | Description | Tags |
|---|---|---|---|
| GET | `/api/datasets` | List all datasets from Superset | datasets |
| GET | `/api/datasets/{dataset_id}` | Get a single Superset dataset by ID (with column metadata) | datasets |
| POST | `/api/datasets/{dataset_id}/data` | Query paginated row data from a Superset dataset | datasets |

### SQL Lab

| Method | Path | Description | Tags |
|---|---|---|---|
| POST | `/api/sql/execute` | Execute arbitrary SQL against a database via Superset SQL Lab | sql |
| GET | `/api/sql/history` | Get recent query history (last 50, in-memory) | sql |
| GET | `/api/sql/databases` | List databases available for SQL execution | sql |

### Search

| Method | Path | Description | Tags |
|---|---|---|---|
| POST | `/api/search` | Search across dashboards, charts, and datasets by name | search |

### Custom Analytics

| Method | Path | Description | Tags |
|---|---|---|---|
| POST | `/api/custom/kpi` | Compute reconciliation KPIs (breaks, resolution rate, SLA breaches, match rate) | custom |
| POST | `/api/custom/aggregations` | Run arbitrary group-by aggregation queries against Superset datasets | custom |
| GET | `/api/custom/counterparties` | List counterparty names with optional search filter | custom |

### Export (Stubbed)

| Method | Path | Description | Tags |
|---|---|---|---|
| POST | `/api/export/pdf` | Queue a PDF export job (currently stubbed -- returns pending status) | export |
| POST | `/api/export/excel` | Queue an Excel export job (currently stubbed -- returns pending status) | export |
| GET | `/api/export/{job_id}/status` | Check export job status | export |

### Saved Views

| Method | Path | Description | Tags |
|---|---|---|---|
| GET | `/api/views` | List all saved views (in-memory store) | views |
| POST | `/api/views` | Create a saved view (filter snapshot for a dashboard) | views |
| DELETE | `/api/views/{view_id}` | Delete a saved view | views |

## Request/Response Formats

### Case Convention

All Pydantic models extend `CamelModel`, which uses `pydantic.alias_generators.to_camel` for automatic camelCase serialization. The backend accepts both `snake_case` and `camelCase` in request bodies (`populate_by_name: True`). Responses are serialized as camelCase.

The frontend API client in `frontend/src/lib/api-client.ts` transforms response keys from snake_case to camelCase automatically. Keys inside `rows`, `columns`, `data`, and `config` fields are NOT transformed (they contain database column names that must be preserved).

### Standard Success Response

Endpoints return the resource directly -- there is no common envelope wrapper. For example:

```json
// GET /api/dashboards
[
  {
    "id": "recon-overview",
    "name": "Reconciliation Overview",
    "description": "Main recon dashboard",
    "status": "active"
  }
]
```

Paginated endpoints return an object with pagination metadata:

```json
// POST /api/datasets/{dataset_id}/data
{
  "data": [ ... ],
  "rowCount": 500,
  "page": 1,
  "pageSize": 100
}
```

### Global Filters

Many endpoints accept a `GlobalFilters` body for filtering query results:

```json
{
  "region": ["APAC", "EMEA"],
  "country": null,
  "lob": null,
  "desk": ["FX"],
  "currency": null,
  "status": ["Open"],
  "counterparty": null,
  "dateFrom": "2026-01-01",
  "dateTo": "2026-03-31"
}
```

All filter fields are optional. Multi-value fields (`region`, `desk`, etc.) translate to SQL `IN` clauses. Date fields translate to `>=` / `<=` comparisons.

### Chart Data Request

The legacy chart data endpoint accepts filters plus drill-down levels:

```json
{
  "filters": {
    "region": ["APAC"],
    "status": ["Open"]
  },
  "drill": [
    { "level": 0, "column": "region", "value": "APAC" },
    { "level": 1, "column": "desk", "value": "FX" }
  ],
  "limit": 10000
}
```

### SQL Execution Request

```json
{
  "sql": "SELECT * FROM recon_breaks LIMIT 10",
  "databaseId": 1,
  "schema": "public",
  "limit": 1000
}
```

### Database Creation Request

Accepts either a full SQLAlchemy URI or individual connection fields:

```json
{
  "databaseName": "Production Oracle",
  "backend": "oracle",
  "host": "db.example.com",
  "port": 1521,
  "database": "RECONDB",
  "username": "recon_reader",
  "password": "secret"
}
```

Or with a direct URI:

```json
{
  "databaseName": "Production Oracle",
  "backend": "oracle",
  "sqlalchemyUri": "oracle://user:pass@host:1521/DB"
}
```

Supported backends: `oracle`, `postgresql`, `hive`, `elasticsearch`.

### Managed Dataset Creation

```json
{
  "name": "Daily Break Summary",
  "description": "Aggregated break counts by region and category",
  "databaseId": 1,
  "sql": "SELECT region, category, COUNT(*) as cnt FROM recon_breaks GROUP BY region, category",
  "columns": [
    {
      "name": "region",
      "displayName": "Region",
      "dataType": "string",
      "role": "dimension",
      "aggregation": "NONE",
      "formatPreset": "none",
      "formatString": ""
    },
    {
      "name": "cnt",
      "displayName": "Break Count",
      "dataType": "number",
      "role": "measure",
      "aggregation": "SUM",
      "formatPreset": "none",
      "formatString": ""
    }
  ]
}
```

Column `dataType` accepts: `string`, `number`, `date`, `currency`.
Column `role` accepts: `dimension`, `measure`, `time`, `none`.
Column `aggregation` accepts: `NONE`, `SUM`, `AVG`, `COUNT`, `MIN`, `MAX`, `COUNT_DISTINCT`.

### Managed Chart Creation

```json
{
  "name": "Breaks by Category",
  "description": "Bar chart of break counts grouped by category",
  "datasetId": "uuid-of-managed-dataset",
  "chartType": "bar",
  "config": {
    "columnMapping": {
      "categoryColumn": "category",
      "metricColumns": ["cnt"],
      "aggregations": { "cnt": "SUM" }
    },
    "appearance": {
      "title": "Breaks by Category",
      "showLegend": true,
      "legendPosition": "bottom",
      "showXLabel": true,
      "showYLabel": true
    }
  }
}
```

### Export Request

```json
{
  "format": "pdf",
  "dashboardId": "recon-overview",
  "chartId": null,
  "filters": { "region": ["APAC"] }
}
```

### Search Request

```json
{
  "query": "recon",
  "types": ["dashboard", "chart", "dataset"]
}
```

The `types` field is optional. When omitted, all entity types are searched.

## Error Codes

All error responses use a consistent JSON envelope:

```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "detail": "Sanitized technical detail or null",
  "retryAfter": 30
}
```

The `detail` field is sanitized by `app/core/errors.py` -- connection strings containing credentials are redacted, and messages longer than 500 characters are truncated.

| HTTP Status | Error Code | Meaning |
|---|---|---|
| 400 | `invalid_chart_id` | Chart ID could not be parsed as an integer |
| 400 | (varies) | Validation error from invalid filter values or bad request body |
| 404 | `chart_not_found` | No query definition exists for the requested chart slug |
| 404 | `dataset_not_found` | No column definition exists for the requested dataset ID |
| 404 | `job_not_found` | Export job ID not found |
| 404 | `view_not_found` | Saved view ID not found |
| 404 | (generic) | Dashboard, data source, managed dataset, or managed chart not found |
| 409 | `dataset_in_use` | Cannot delete a managed dataset that is referenced by charts |
| 500 | `internal_error` | Unexpected server error |
| 502 | `superset_error` | Superset returned a non-2xx HTTP status |
| 503 | `superset_unavailable` | Cannot connect to the Superset query engine |
| 504 | `query_timeout` | Superset query exceeded the 120-second timeout |

The `retryAfter` field (in seconds) is included on 503 responses to suggest when the client should retry.

## Rate Limits

No rate limiting is configured on the RecViz API. The application is designed for internal corporate use behind a network boundary.

The Superset backend has its own internal rate limiting and query concurrency controls configured via `superset_config.py`, but these are not exposed to the RecViz API consumer.

## Architecture Notes

### Two Systems

The API surface reflects two parallel systems:

1. **Config-driven system (active):** Dashboards, data sources, managed datasets, and managed charts are stored in RecViz's own PostgreSQL database and synced to Superset as virtual datasets. Routes: `/api/dashboards/*`, `/api/data-sources/*`, `/api/datasets/managed/*`, `/api/charts/managed/*`.

2. **Legacy Superset proxy (older):** Direct proxies to Superset's chart/dataset REST API with hardcoded datasource-to-chart mappings. Routes: `/api/charts/*`, `/api/datasets/*`. The `CHART_DATASOURCE_MAP` and `CHART_QUERIES` dictionaries in `backend/app/api/charts.py` define the fixed set of known chart slugs.

### Dependency Injection

All route handlers use FastAPI's `Depends()` system for service access. Key dependencies defined in `backend/app/core/dependencies.py`:

| Dependency | Type | Source |
|---|---|---|
| `SupersetDep` | `SupersetClient \| None` | App state (initialized at startup) |
| `ConfigStoreDep` | `ConfigStore` | Per-request, wraps async DB session |
| `QueryEngineDep` | `QueryEngine` | App state (initialized at startup) |
| `DbSessionDep` | `AsyncSession` | Per-request SQLAlchemy async session |
| `ResolvedDataSourceDep` | `DataSourceConfig` | Resolves data source by path param, raises 404 |
| `DatasetSyncDep` | `DatasetSyncService` | App state (initialized at startup) |

### CORS

The API allows cross-origin requests from these origins:

- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000`
- `http://localhost:4200`

All methods and headers are permitted. Credentials are allowed.

### Known Gaps

- **Export endpoints are stubbed.** PDF and Excel export routes accept requests and return job IDs but never actually produce files.
- **Saved views are in-memory only.** They are lost on server restart.
- **SQL query history is in-memory only.** Limited to the last 50 queries, lost on restart.
- **No authentication.** Every endpoint is publicly accessible.
- **Dashboard reference checks for charts are placeholders.** `GET /api/charts/managed/{chart_id}/references` always returns `canDelete: true`.
