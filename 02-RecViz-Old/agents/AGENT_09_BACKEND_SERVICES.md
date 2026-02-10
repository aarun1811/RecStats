# Agent 09 — Backend Services

## Mission
Implement all backend service classes: Superset client (full implementation), Elasticsearch service, export service, aggregation service, and cache helpers.

## Read First
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`
- `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/agents/AGENT_00_RESULT.md`

## Working Directory
`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/backend/`

## What Already Exists
- `app/services/superset_client.py` — stub with auth flow + method signatures
- `app/config.py` — Settings with all service URLs
- `app/core/dependencies.py` — `get_superset_client` dependency
- `app/core/exceptions.py` — SupersetError

## Files To Implement

### 1. `app/services/superset_client.py` (complete the stub)

Fully implement all methods:

```python
class SupersetClient:
    async def ensure_authenticated(self) -> None:
        """POST /api/v1/security/login — get JWT token."""
        # Already stubbed — verify it works, add token refresh logic

    async def get_chart_data(self, chart_id: int, filters: list[dict]) -> dict:
        """POST /api/v1/chart/data
        Build query_context with:
        - datasource (from chart definition)
        - queries[0].filters = extra_filters from our global filters
        - queries[0].columns, metrics from chart definition
        Returns parsed data array.
        """

    async def execute_sql(self, database_id: int, sql: str, limit: int = 1000) -> dict:
        """POST /api/v1/sqllab/execute/
        Body: { database_id, sql, schema, queryLimit: limit }
        Handle async query results (poll if needed).
        """

    async def list_datasets(self) -> list[dict]:
        """GET /api/v1/dataset/?q=(page:0,page_size:100)"""

    async def get_dataset(self, dataset_id: int) -> dict:
        """GET /api/v1/dataset/{id} — includes columns."""

    async def get_dataset_data(self, dataset_id: int, filters, order_by, offset, limit) -> dict:
        """POST /api/v1/chart/data with query_context targeting dataset.
        Use the dataset as datasource, apply filters, pagination.
        """

    async def list_charts(self) -> list[dict]:
        """GET /api/v1/chart/?q=(page:0,page_size:100)"""

    async def get_chart(self, chart_id: int) -> dict:
        """GET /api/v1/chart/{id}"""

    async def list_databases(self) -> list[dict]:
        """GET /api/v1/database/"""

    async def list_dashboards(self) -> list[dict]:
        """GET /api/v1/dashboard/"""

    async def get_dashboard(self, dashboard_id: int) -> dict:
        """GET /api/v1/dashboard/{id}"""
```

Key implementation details:
- Token refresh: if 401 response, re-authenticate and retry once
- Timeout: 30s for normal queries, 120s for SQL Lab (Hive can be slow)
- Error handling: catch httpx errors, raise SupersetError with status + detail
- Superset's filter format: `[{"col": "desk", "op": "IN", "val": ["Operations"]}]`
- Query context format for chart/data: study Superset's API to build correct payload

### 2. `app/services/elasticsearch.py`

```python
class ElasticsearchService:
    def __init__(self, es_url: str):
        self.client = AsyncElasticsearch(es_url)

    async def search(self, query: str, indices: list[str] | None, limit: int = 50) -> dict:
        """Full-text search across recon data.
        Uses multi_match with best_fields.
        Returns hits with highlights.
        """

    async def aggregate(self, index: str, agg_body: dict) -> dict:
        """Run custom aggregation query.
        Accepts raw ES aggregation DSL.
        Returns aggregation buckets.
        """

    async def get_indices(self) -> list[str]:
        """List available indices."""

    async def close(self):
        """Close the ES client."""
```

Add ES client to FastAPI lifespan (startup/shutdown) and as a dependency.

### 3. `app/services/export_service.py`

```python
class ExportService:
    async def generate_pdf(self, dashboard_id: str, filters: dict, options: dict) -> bytes:
        """Generate PDF report.
        - Fetch dashboard config
        - Fetch data for each chart with filters
        - Render HTML template with data
        - Convert HTML to PDF via WeasyPrint
        - Return PDF bytes
        """

    async def generate_excel(self, dashboard_id: str, filters: dict, options: dict) -> bytes:
        """Generate Excel workbook.
        - Sheet 1: Summary (KPI values)
        - Sheet 2: Chart data (tabular)
        - Sheet 3: Detail data (full grid export)
        - Formatted headers, freeze panes, column widths
        - Conditional formatting (red for breaches, green for resolved)
        """

    def _create_excel_workbook(self, data: dict) -> openpyxl.Workbook:
        """Build the formatted Excel workbook."""
```

### 4. `app/services/aggregation_service.py`

```python
class AggregationService:
    """Custom business logic aggregations not suited for Superset SQL."""

    def __init__(self, superset_client: SupersetClient):
        self.superset = superset_client

    async def weighted_aging(self, filters: dict) -> dict:
        """Break amount × days outstanding, grouped by desk/type."""

    async def rolling_recon_rate(self, filters: dict, trailing_days: int = 30) -> dict:
        """Matched / total over trailing N days, daily data points."""

    async def break_velocity(self, filters: dict, period: str = "daily") -> dict:
        """Rate of new breaks vs resolved over time."""
```

### 5. `app/services/cache.py`

```python
import redis.asyncio as redis

class CacheService:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    async def get(self, key: str) -> str | None:
    async def set(self, key: str, value: str, ttl: int = 300) -> None:
    async def delete(self, key: str) -> None:
    async def clear_pattern(self, pattern: str) -> None:
        """Delete all keys matching pattern (e.g., 'chart-data:*')."""

    async def close(self):
        await self.redis.close()
```

Add cache service to lifespan + dependency injection.

### 6. Update `app/core/dependencies.py`
Add dependency providers for:
- `get_elasticsearch_service`
- `get_export_service`
- `get_aggregation_service`
- `get_cache_service`

### 7. Update `app/main.py` lifespan
Add startup/shutdown for ES client, cache service.

### 8. Helper: `app/services/filter_converter.py`
Convert frontend `GlobalFilters` to Superset filter format:
```python
def to_superset_filters(filters: GlobalFilters) -> list[dict]:
    """Convert GlobalFilters model to Superset's filter format."""
```

## Acceptance Criteria
- [ ] SupersetClient auth flow works (login, token storage, refresh)
- [ ] SupersetClient fetches chart data with filters
- [ ] SupersetClient executes SQL queries
- [ ] SupersetClient lists datasets, charts, databases
- [ ] ElasticsearchService search and aggregate methods work
- [ ] ExportService generates valid Excel files
- [ ] CacheService get/set/delete work with Redis
- [ ] All services registered as FastAPI dependencies
- [ ] Filter converter produces correct Superset format
- [ ] `ruff check .` passes
- [ ] `pytest` runs without import errors
