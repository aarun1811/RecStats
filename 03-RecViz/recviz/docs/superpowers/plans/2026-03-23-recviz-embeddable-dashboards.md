# RecViz Embeddable Config-Driven Dashboards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform RecViz from a hardcoded single-dashboard app into a config-driven, embeddable dashboard platform, then render the TLM Statistics dashboard from autosys-job-explorer via iframe embed.

**Architecture:** Three-layer config model — dashboard config (what to show) → data source config (how to get data, including SQL and DB routing) → Superset (SQL execution engine). RecViz backend handles query building, dynamic DB routing, and cross-source data merging. Frontend becomes fully config-driven via a generic DashboardRenderer component.

**Tech Stack:** React 19, TanStack Router 1, TanStack Query 5, Zustand 5, AG Grid Enterprise, AG Charts Enterprise, FastAPI, Pydantic v2, httpx, Apache Superset (SQL Lab API)

**Spec:** `docs/superpowers/specs/2026-03-23-recviz-embeddable-dashboards-design.md`

---

## Review Findings — MUST Address During Implementation

These findings come from three separate reviews (internal spec reviewer, internal plan reviewer, and external Gemini review). They are **concrete changes** that must be incorporated into the relevant tasks.

### 1. Merge Engine Row Limit (Task 3)

**Source:** Gemini review
**Issue:** The `MergeEngine` joins data in memory. For aggregated data (hundreds of rows) this is fine, but a future dashboard pulling millions of line-item rows would crash the process.
**Action:** Add a `max_rows: int = 10_000` parameter to `QueryEngine.execute()`. If the result exceeds this limit, truncate and include a `truncated: true` flag in the response. This is a safety net — TLM Stats returns tens to hundreds of rows.

### 2. API Error Handling — ValueError → HTTP 400 (Task 5)

**Source:** Gemini review
**Issue:** `QueryEngine._resolve_database()` raises `ValueError` when a required filter is missing (e.g., no `tlm_instance` for dynamic routing). Unhandled, this becomes a `500 Internal Server Error`.
**Action:** In `data_sources.py` and `dashboards.py` endpoint handlers, catch `ValueError` and raise `HTTPException(status_code=400, detail=str(e))`:
```python
from fastapi import HTTPException

try:
    result = await query_engine.execute(data_source_id, body.filters)
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
```

### 3. Filter Options Query Key Scoping (Task 8)

**Source:** Gemini review + internal plan review
**Issue:** `useFilterOptions` puts the full `parentFilters` object in the React Query key. If it contains filters unrelated to the `dependsOn` relationship, any unrelated filter change would invalidate the options cache unnecessarily.
**Action:** In `use-filter-options.ts`, only include the specific `dependsOn` filter values in the query key, not the entire filter state. The hook should accept a `dependsOn: Record<string, string>` config and extract only those filter values:
```typescript
export function useFilterOptions(
  dataSourceId: string,
  column: string,
  dependsOn: Record<string, string>,  // filterId → columnName mapping
  allFilterValues: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  // Extract only the parent filter values that this filter depends on
  const parentValues: Record<string, FilterValue> = {}
  for (const filterId of Object.keys(dependsOn)) {
    if (allFilterValues[filterId] !== undefined) {
      parentValues[filterId] = allFilterValues[filterId]
    }
  }

  return useQuery({
    queryKey: ['filter-options', dataSourceId, column, parentValues],
    // ...
  })
}
```

### 4. CORS Configuration for Embed (Task 5)

**Source:** Internal plan review
**Issue:** The FastAPI CORS middleware currently only allows `localhost:5173` and `localhost:3000`. If autosys-job-explorer runs on a different port, the iframe embed will fail.
**Action:** In `main.py`, add the autosys-job-explorer origin to the CORS allowed origins list. Also set `X-Frame-Options` header to allow embedding:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:4200"],
    # ... existing config
)
```
Note: Port 4200 is Angular CLI's default dev server port.

### 5. Dashboard List Response Shape (Task 16)

**Source:** Internal plan review
**Issue:** The current frontend `useDashboards()` hook expects `title` field from dashboard list, but the new config-driven backend returns `name`. Field name mismatch will cause the dashboard list to render with missing titles.
**Action:** Either alias `name` → `title` in the backend response, or update the frontend dashboard list component to use `name` instead of `title`. Decide during Task 16 and ensure alignment.

### 6. Final Commit Scoping (Task 18)

**Source:** Internal plan review
**Issue:** Task 18 uses `git add -A` from the RecStats monorepo root, which would stage everything including unrelated changes.
**Action:** Scope the commit to only the RecViz subdirectory:
```bash
git add 03-RecViz/recviz/
```

### Non-Blocking Notes (for awareness, no action needed)

- **Auth/cookies in iframe:** No auth for now. When auth is added later, `SameSite` cookie attributes may need attention for cross-port iframe embedding.
- **URL lock param security:** Internal tool — UI-level locks are sufficient. Users can edit URLs but aren't bypassing auth.
- **Chart re-render animations:** Existing AG Charts and ECharts wrappers already handle lifecycle properly via refs and `requestAnimationFrame`.
- **MatDialog iframe height:** Plan sets `height: '90vh'` on dialog + `height: 100%` on iframe — should work, verify during Task 17 testing.
- **`tlm_automatch` column aliasing:** The data source aliases `b.local_acc_no AS set_id` to match merge keys. The `reconmgmt_manual` source already uses `setid AS set_id`. Merge on `set_id` will work.
- **`{{column}}` template injection:** The `reconmgmt_recon_bank` data source uses `{{column}}` in its SQL. The query engine validates the column against `data_source.columns[]` to prevent injection.
- **`total_items` KPI aggregation:** Verify that summing `total_items` from `tlm_automatch` + `total_manual_match_count` from `reconmgmt_manual` matches the existing sidecar's computation logic. The sidecar's `DashboardSummary` computes `total_items = automatch + manual_match + breaks`.

---

## File Structure

### Backend — New Files

| File | Responsibility |
|---|---|
| `backend/app/models/dashboard_config.py` | Pydantic models: DashboardConfig, FilterConfig, KpiConfig, ChartConfig, GridConfig, LayoutConfig |
| `backend/app/models/data_source_config.py` | Pydantic models: DataSourceConfig, DatabaseRouting, FilterMapping, ColumnDef |
| `backend/app/services/config_store.py` | Loads dashboard + data source configs from JSON files (mock) or Oracle (prod) |
| `backend/app/services/query_engine.py` | Builds SQL from templates, resolves dynamic DB routing, executes via Superset or mock |
| `backend/app/services/merge_engine.py` | Merges results from multiple data sources on specified keys |
| `backend/app/api/data_sources.py` | API routes: POST /query, POST /merge, GET /distinct |
| `backend/app/mock/dashboards/tlm-stats.json` | TLM Stats dashboard config JSON |
| `backend/app/mock/data_sources/tlm_breaks.json` | TLM breaks data source config JSON |
| `backend/app/mock/data_sources/tlm_automatch.json` | TLM automatch data source config JSON |
| `backend/app/mock/data_sources/reconmgmt_manual.json` | Reconmgmt manual match data source config JSON |
| `backend/app/mock/data_sources/reconmgmt_recon_bank.json` | Reconmgmt filter source data source config JSON |
| `backend/app/mock/query_results.py` | Mock query results keyed by data_source_id |
| `backend/tests/test_query_engine.py` | Tests for SQL building, DB routing, filter injection |
| `backend/tests/test_merge_engine.py` | Tests for cross-source data merging |
| `backend/tests/test_config_store.py` | Tests for config loading |

### Backend — Modified Files

| File | Change |
|---|---|
| `backend/app/api/router.py` | Add data_sources router |
| `backend/app/api/dashboards.py` | Rewrite: config-driven dashboard + KPI endpoints |
| `backend/app/core/dependencies.py` | Add ConfigStore + QueryEngine + MergeEngine dependencies |
| `backend/app/main.py` | Initialize new services in lifespan |

### Frontend — New Files

| File | Responsibility |
|---|---|
| `frontend/src/types/dashboard-config.ts` | TypeScript types mirroring backend config schemas |
| `frontend/src/stores/filter-store.ts` | Rewrite: generic `Record<string, FilterValue>` + locked set |
| `frontend/src/hooks/use-dashboard-config.ts` | GET /api/dashboards/:id → full config |
| `frontend/src/hooks/use-dashboard-kpis.ts` | POST /api/dashboards/:id/kpis → batched KPIs |
| `frontend/src/hooks/use-data-source-query.ts` | POST /api/data-sources/:id/query → chart/grid data |
| `frontend/src/hooks/use-data-source-merge.ts` | POST /api/data-sources/merge → merged grid data |
| `frontend/src/hooks/use-filter-options.ts` | GET /api/data-sources/:id/distinct/:col → cascading options |
| `frontend/src/components/dashboard/dashboard-renderer.tsx` | Orchestrates filter bar + KPIs + charts + grids from config |
| `frontend/src/components/dashboard/config-filter-bar.tsx` | Config-driven filter bar with cascading, locking, apply/reset |
| `frontend/src/components/dashboard/config-kpi-row.tsx` | Config-driven KPI row from batched endpoint |
| `frontend/src/components/dashboard/config-chart-grid.tsx` | Config-driven chart grid with kpi_values source support |
| `frontend/src/components/dashboard/config-data-grid.tsx` | Config-driven data grid (single or merged sources, conditional visibility) |
| `frontend/src/components/embed/embed-topbar.tsx` | Thin topbar: title + "Open in RecViz" link |
| `frontend/src/routes/_app.tsx` | Pathless layout route: SidebarProvider + AppSidebar + Header |
| `frontend/src/routes/_app/dashboards/index.tsx` | Move from routes/dashboards/index.tsx |
| `frontend/src/routes/_app/dashboards/$dashboardId.tsx` | Refactored: uses DashboardRenderer |
| `frontend/src/routes/_app/explorer/index.tsx` | Move from routes/explorer/index.tsx |
| `frontend/src/routes/_app/reports/index.tsx` | Move from routes/reports/index.tsx |
| `frontend/src/routes/_app/settings/index.tsx` | Move from routes/settings/index.tsx |
| `frontend/src/routes/embed/dashboards/$dashboardId.tsx` | Embed route: thin topbar + DashboardRenderer |

### Frontend — Modified Files

| File | Change |
|---|---|
| `frontend/src/routes/__root.tsx` | Slim down: remove sidebar/header, keep providers only |
| `frontend/src/routes/index.tsx` | Update redirect path (unchanged functionally) |
| `frontend/src/types/filter.ts` | Add generic FilterValue, FilterState types |

### Autosys-job-explorer — New/Modified Files

| File | Change |
|---|---|
| `frontend/rectrace/src/app/custom-interactions/components/modals/recviz-embed-dialog/recviz-embed-dialog.component.ts` | New: MatDialog iframe wrapper |
| `frontend/rectrace/src/app/custom-interactions/components/renderers/v2/set-id-v2-renderer.component.ts` | Modify: open RecvizEmbedDialog instead of TlmStatsModalV2 |
| `frontend/rectrace/src/app/custom-interactions/components/renderers/v2/recon-v2-renderer.component.ts` | Same |
| `frontend/rectrace/src/app/custom-interactions/components/renderers/v2/tlm-instance-v2-renderer.component.ts` | Same |
| `frontend/rectrace/src/app/custom-interactions/custom-interactions.module.ts` | Register new component |
| `frontend/rectrace/src/environments/environment.ts` | Add `recvizUrl` |

---

## Task 1: Backend Pydantic Models for Config Schemas

**Files:**
- Create: `backend/app/models/dashboard_config.py`
- Create: `backend/app/models/data_source_config.py`

- [ ] **Step 1: Create dashboard config Pydantic models**

Create `backend/app/models/dashboard_config.py`:

```python
from __future__ import annotations

from pydantic import BaseModel


class FilterOptionsSource(BaseModel):
    data_source_id: str
    value_column: str
    depends_on: dict[str, str] = {}


class FilterPresetOption(BaseModel):
    label: str
    value: int | str


class FilterConfig(BaseModel):
    id: str
    label: str
    type: str  # "single-select" | "multi-select" | "preset-range"
    lockable: bool = False
    options_source: FilterOptionsSource | None = None
    options: list[FilterPresetOption] | None = None
    default_value: int | str | None = None


class KpiSource(BaseModel):
    data_source_id: str
    metric: str


class KpiTrend(BaseModel):
    type: str  # "percentage_of"
    reference_kpi: str


class KpiConfig(BaseModel):
    id: str
    label: str
    format: str  # "number" | "currency" | "percent"
    sources: list[KpiSource]
    aggregation: str = "sum"
    trend: KpiTrend | None = None


class KpiSegment(BaseModel):
    kpi_id: str
    label: str
    color: str


class ChartLayout(BaseModel):
    col: int
    row: int
    width: int
    height: int


class ChartSource(BaseModel):
    data_source_id: str
    metric: str | None = None
    label: str | None = None


class DashboardChartConfig(BaseModel):
    id: str
    title: str
    type: str
    source_type: str = "query"  # "query" | "kpi_values"
    sources: list[ChartSource] | None = None
    kpi_segments: list[KpiSegment] | None = None
    layout: ChartLayout


class GridSource(BaseModel):
    data_source_id: str


class GridColumn(BaseModel):
    field: str
    header: str
    type: str = "string"  # "string" | "number" | "date"


class VisibleWhen(BaseModel):
    kpi: str
    condition: str  # "gt" | "lt" | "eq"
    value: int | float


class GridConfig(BaseModel):
    id: str
    title: str
    data_source_id: str | None = None
    sources: list[GridSource] | None = None
    merge_on: list[str] | None = None
    merge_type: str | None = None
    columns: list[GridColumn]
    visible_when: VisibleWhen | None = None
    layout: ChartLayout


class DashboardFeatures(BaseModel):
    cross_filter: bool = False
    drill_down: bool = False


class LayoutConfig(BaseModel):
    type: str = "flow"
    sections: list[str] = ["filters", "kpis", "charts", "grids"]


class DashboardConfig(BaseModel):
    id: str
    name: str
    description: str = ""
    features: DashboardFeatures = DashboardFeatures()
    filters: list[FilterConfig] = []
    kpis: list[KpiConfig] = []
    charts: list[DashboardChartConfig] = []
    grids: list[GridConfig] = []
    layout: LayoutConfig = LayoutConfig()
```

- [ ] **Step 2: Create data source config Pydantic models**

Create `backend/app/models/data_source_config.py`:

```python
from __future__ import annotations

from pydantic import BaseModel


class DatabaseRoutingMapping(BaseModel):
    type: str  # "static" | "dynamic"
    database: str | None = None
    route_by_filter: str | None = None
    mapping: dict[str, str] | None = None


class FilterMapping(BaseModel):
    filter_id: str
    sql_expr: str


class ColumnDef(BaseModel):
    name: str
    type: str  # "string" | "number" | "date"
    label: str | None = None


class DataSourceConfig(BaseModel):
    id: str
    name: str
    database_routing: DatabaseRoutingMapping
    query: str
    filter_mappings: list[FilterMapping] = []
    columns: list[ColumnDef] = []
```

- [ ] **Step 3: Verify imports work**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -c "from app.models.dashboard_config import DashboardConfig; from app.models.data_source_config import DataSourceConfig; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/dashboard_config.py backend/app/models/data_source_config.py
git commit -m "feat: add Pydantic models for dashboard and data source config schemas"
```

---

## Task 2: Mock Config JSON Files + Config Store Service

**Files:**
- Create: `backend/app/mock/dashboards/tlm-stats.json`
- Create: `backend/app/mock/data_sources/tlm_breaks.json`
- Create: `backend/app/mock/data_sources/tlm_automatch.json`
- Create: `backend/app/mock/data_sources/reconmgmt_manual.json`
- Create: `backend/app/mock/data_sources/reconmgmt_recon_bank.json`
- Create: `backend/app/services/config_store.py`
- Create: `backend/tests/test_config_store.py`

- [ ] **Step 1: Create `__init__.py` files for mock directories**

```bash
mkdir -p backend/app/mock/dashboards backend/app/mock/data_sources
touch backend/app/mock/__init__.py
```

- [ ] **Step 2: Create TLM Stats dashboard config JSON**

Create `backend/app/mock/dashboards/tlm-stats.json` with the full dashboard config from the spec (Section 3, Layer 1). This is the JSON block starting with `{"id": "tlm-stats", "name": "TLM Statistics Dashboard", ...}`.

Copy the exact JSON from the spec document lines 49-213.

- [ ] **Step 3: Create data source config JSON files**

Create four JSON files in `backend/app/mock/data_sources/`:

`tlm_breaks.json` — from spec lines 220-251.
`tlm_automatch.json` — from spec lines 289-322.
`reconmgmt_manual.json` — from spec lines 256-284.
`reconmgmt_recon_bank.json` — from spec lines 329-350.

- [ ] **Step 4: Write test for config store**

Create `backend/tests/test_config_store.py`:

```python
import pytest
from app.services.config_store import ConfigStore


@pytest.fixture
def store():
    return ConfigStore()


def test_list_dashboards(store):
    dashboards = store.list_dashboards()
    assert len(dashboards) >= 1
    assert any(d.id == "tlm-stats" for d in dashboards)


def test_get_dashboard(store):
    config = store.get_dashboard("tlm-stats")
    assert config is not None
    assert config.id == "tlm-stats"
    assert len(config.filters) == 4
    assert len(config.kpis) == 4
    assert len(config.charts) == 1
    assert len(config.grids) == 2


def test_get_dashboard_not_found(store):
    config = store.get_dashboard("nonexistent")
    assert config is None


def test_get_data_source(store):
    ds = store.get_data_source("tlm_breaks")
    assert ds is not None
    assert ds.id == "tlm_breaks"
    assert ds.database_routing.type == "dynamic"
    assert "TLMP_CONSUMER" in ds.database_routing.mapping


def test_get_data_source_static_routing(store):
    ds = store.get_data_source("reconmgmt_manual")
    assert ds is not None
    assert ds.database_routing.type == "static"
    assert ds.database_routing.database == "superset_db_reconmgmt"


def test_get_data_source_not_found(store):
    ds = store.get_data_source("nonexistent")
    assert ds is None
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/test_config_store.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.config_store'`

- [ ] **Step 6: Implement ConfigStore**

Create `backend/app/services/config_store.py`:

```python
from __future__ import annotations

import json
from pathlib import Path

from app.models.dashboard_config import DashboardConfig
from app.models.data_source_config import DataSourceConfig

MOCK_DIR = Path(__file__).parent.parent / "mock"


class ConfigStore:
    def __init__(self) -> None:
        self._dashboards: dict[str, DashboardConfig] = {}
        self._data_sources: dict[str, DataSourceConfig] = {}
        self._load_mock_configs()

    def _load_mock_configs(self) -> None:
        dashboards_dir = MOCK_DIR / "dashboards"
        if dashboards_dir.exists():
            for f in dashboards_dir.glob("*.json"):
                raw = json.loads(f.read_text())
                config = DashboardConfig.model_validate(raw)
                self._dashboards[config.id] = config

        data_sources_dir = MOCK_DIR / "data_sources"
        if data_sources_dir.exists():
            for f in data_sources_dir.glob("*.json"):
                raw = json.loads(f.read_text())
                config = DataSourceConfig.model_validate(raw)
                self._data_sources[config.id] = config

    def list_dashboards(self) -> list[DashboardConfig]:
        return list(self._dashboards.values())

    def get_dashboard(self, dashboard_id: str) -> DashboardConfig | None:
        return self._dashboards.get(dashboard_id)

    def get_data_source(self, data_source_id: str) -> DataSourceConfig | None:
        return self._data_sources.get(data_source_id)

    def list_data_sources(self) -> list[DataSourceConfig]:
        return list(self._data_sources.values())
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/test_config_store.py -v`
Expected: All 6 tests PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/mock/ backend/app/services/config_store.py backend/tests/test_config_store.py
git commit -m "feat: add config store service with mock JSON configs for TLM Stats dashboard"
```

---

## Task 3: Query Engine Service

**Files:**
- Create: `backend/app/services/query_engine.py`
- Create: `backend/app/mock/query_results.py`
- Create: `backend/tests/test_query_engine.py`

- [ ] **Step 1: Write query engine tests**

Create `backend/tests/test_query_engine.py`:

```python
import pytest
from app.services.query_engine import QueryEngine
from app.services.config_store import ConfigStore


@pytest.fixture
def engine():
    store = ConfigStore()
    return QueryEngine(config_store=store, superset_client=None)


def test_build_sql_with_filters(engine):
    sql = engine._build_sql(
        data_source_id="tlm_breaks",
        filters={"recon": ["AGENT_01"], "date_range": 1},
    )
    assert "b.agent_code IN ('AGENT_01')" in sql
    assert "flag_2 = 0" in sql


def test_build_sql_no_filters(engine):
    sql = engine._build_sql(data_source_id="tlm_breaks", filters={})
    assert "{{filters}}" not in sql
    assert "flag_2 = 0" in sql


def test_resolve_database_dynamic(engine):
    db_id = engine._resolve_database(
        data_source_id="tlm_breaks",
        filters={"tlm_instance": "TLMP_CONSUMER"},
    )
    assert db_id == "superset_db_TCOSPRD"


def test_resolve_database_static(engine):
    db_id = engine._resolve_database(
        data_source_id="reconmgmt_manual",
        filters={},
    )
    assert db_id == "superset_db_reconmgmt"


def test_resolve_database_dynamic_missing_filter(engine):
    with pytest.raises(ValueError, match="required filter"):
        engine._resolve_database(
            data_source_id="tlm_breaks",
            filters={},
        )


@pytest.mark.asyncio
async def test_execute_mock(engine):
    result = await engine.execute(
        data_source_id="tlm_breaks",
        filters={"tlm_instance": "TLMP_CONSUMER", "recon": ["AGENT_01"], "date_range": 1},
    )
    assert "columns" in result
    assert "rows" in result
    assert "row_count" in result
    assert result["row_count"] >= 0


@pytest.mark.asyncio
async def test_execute_distinct_mock(engine):
    values = await engine.execute_distinct(
        data_source_id="reconmgmt_recon_bank",
        column="recon_engine_env",
        filters={},
    )
    assert isinstance(values, list)
    assert len(values) > 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/test_query_engine.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Create mock query results**

Create `backend/app/mock/query_results.py`:

```python
"""Mock query results keyed by data_source_id.

These mirror the exact shape Superset's SQL Lab API would return.
"""

import random

random.seed(42)

AGENTS = ["AGENT_01", "AGENT_02", "AGENT_03", "AGENT_04", "AGENT_05"]
SET_IDS = ["SET_001", "SET_002", "SET_003", "SET_004", "SET_005", "SET_006"]
BRANCHES = ["BR001", "BR002", "BR003", "BR004"]
DATES = ["2026-03-22", "2026-03-21", "2026-03-20", "2026-03-19", "2026-03-18"]
TLM_INSTANCES = ["TLMP_CONSUMER", "TLMP_FINANCE", "TLMP_WEALTH"]
CORR_ACCOUNTS = ["CA001", "CA002", "CA003", "CA004"]


def _generate_breaks_rows(n: int = 20) -> list[dict]:
    rows = []
    for _ in range(n):
        rows.append({
            "agent_code": random.choice(AGENTS),
            "local_acc_no": random.choice(SET_IDS),
            "bran_code": random.choice(BRANCHES),
            "stmt_date": random.choice(DATES),
            "breaks_count": random.randint(1, 50),
        })
    return rows


def _generate_automatch_rows(n: int = 20) -> list[dict]:
    rows = []
    for _ in range(n):
        total = random.randint(50, 500)
        automatch = int(total * random.uniform(0.7, 0.98))
        rows.append({
            "agent_code": random.choice(AGENTS),
            "set_id": random.choice(SET_IDS),
            "bran_code": random.choice(BRANCHES),
            "stmt_date": random.choice(DATES),
            "corr_acc_no": random.choice(CORR_ACCOUNTS),
            "total_items": total,
            "automatch_items": automatch,
        })
    return rows


def _generate_manual_match_rows(n: int = 15) -> list[dict]:
    rows = []
    for _ in range(n):
        total = random.randint(50, 500)
        automatch = int(total * random.uniform(0.7, 0.95))
        manual = random.randint(1, 30)
        rows.append({
            "agent_code": random.choice(AGENTS),
            "set_id": random.choice(SET_IDS),
            "stmt_date": random.choice(DATES),
            "bran_code": random.choice(BRANCHES),
            "corr_acc_no": random.choice(CORR_ACCOUNTS),
            "total_items": total,
            "automatch_items": automatch,
            "total_manual_match_count": manual,
        })
    return rows


MOCK_QUERY_RESULTS: dict[str, dict] = {
    "tlm_breaks": {
        "columns": ["agent_code", "local_acc_no", "bran_code", "stmt_date", "breaks_count"],
        "rows": _generate_breaks_rows(20),
    },
    "tlm_automatch": {
        "columns": ["agent_code", "set_id", "bran_code", "stmt_date", "corr_acc_no", "total_items", "automatch_items"],
        "rows": _generate_automatch_rows(20),
    },
    "reconmgmt_manual": {
        "columns": ["agent_code", "set_id", "stmt_date", "bran_code", "corr_acc_no", "total_items", "automatch_items", "total_manual_match_count"],
        "rows": _generate_manual_match_rows(15),
    },
}

MOCK_DISTINCT_VALUES: dict[str, dict[str, list[str]]] = {
    "reconmgmt_recon_bank": {
        "recon_engine_env": TLM_INSTANCES,
        "agent_code": AGENTS,
        "local_acc_no": SET_IDS,
    },
}
```

- [ ] **Step 4: Implement QueryEngine**

Create `backend/app/services/query_engine.py`:

```python
from __future__ import annotations

import re
from typing import Any

from app.models.data_source_config import DataSourceConfig
from app.services.config_store import ConfigStore
from app.mock.query_results import MOCK_QUERY_RESULTS, MOCK_DISTINCT_VALUES


class QueryEngine:
    def __init__(
        self,
        config_store: ConfigStore,
        superset_client: Any | None = None,
    ) -> None:
        self._config_store = config_store
        self._superset = superset_client

    def _get_data_source(self, data_source_id: str) -> DataSourceConfig:
        ds = self._config_store.get_data_source(data_source_id)
        if ds is None:
            raise ValueError(f"Data source not found: {data_source_id}")
        return ds

    def _resolve_database(self, data_source_id: str, filters: dict) -> str:
        ds = self._get_data_source(data_source_id)
        routing = ds.database_routing

        if routing.type == "static":
            return routing.database

        # dynamic routing
        filter_key = routing.route_by_filter
        filter_value = filters.get(filter_key)
        if not filter_value:
            raise ValueError(
                f"Data source '{data_source_id}' requires filter "
                f"'{filter_key}' for dynamic DB routing (required filter)"
            )
        if isinstance(filter_value, list):
            filter_value = filter_value[0]

        db_id = routing.mapping.get(filter_value)
        if not db_id:
            raise ValueError(
                f"No database mapping for {filter_key}='{filter_value}' "
                f"in data source '{data_source_id}'"
            )
        return db_id

    def _build_date_range_clause(self, value: int, dialect: str = "postgresql") -> str:
        if dialect == "oracle":
            if value == 1:
                return (
                    "BETWEEN TRUNC(SYSDATE) - "
                    "DECODE(TO_CHAR(SYSDATE,'D'), '1',2, '2',3, '7',1, 1) "
                    "AND SYSDATE"
                )
            return f"BETWEEN SYSDATE - {value} AND SYSDATE"
        else:
            return f"BETWEEN CURRENT_DATE - INTERVAL '{value} days' AND CURRENT_DATE"

    def _build_sql(
        self,
        data_source_id: str,
        filters: dict,
        column: str | None = None,
        dialect: str = "postgresql",
    ) -> str:
        ds = self._get_data_source(data_source_id)
        sql = ds.query

        # Replace {{column}} placeholder (used by filter options data sources)
        if column and "{{column}}" in sql:
            # Validate column against data source columns
            valid_columns = {c.name for c in ds.columns}
            if column not in valid_columns:
                raise ValueError(
                    f"Column '{column}' not in data source '{data_source_id}' columns: {valid_columns}"
                )
            sql = sql.replace("{{column}}", column)

        # Build filter clauses
        filter_clauses = []
        for fm in ds.filter_mappings:
            fval = filters.get(fm.filter_id)
            if fval is None:
                continue

            expr = fm.sql_expr
            if "{{date_range_clause}}" in expr:
                clause = self._build_date_range_clause(int(fval), dialect)
                expr = expr.replace("{{date_range_clause}}", clause)
            elif "{{values}}" in expr:
                if isinstance(fval, list):
                    quoted = ", ".join(f"'{v}'" for v in fval)
                else:
                    quoted = f"'{fval}'"
                expr = expr.replace("{{values}}", quoted)
            elif "{{value}}" in expr:
                val = fval[0] if isinstance(fval, list) else fval
                expr = expr.replace("{{value}}", str(val))

            filter_clauses.append(f"AND {expr}")

        filters_sql = " ".join(filter_clauses)
        sql = sql.replace("{{filters}}", filters_sql)

        # Clean up any remaining template vars (no matching filter provided)
        sql = re.sub(r"\{\{[^}]+\}\}", "", sql)

        return sql

    async def execute(
        self,
        data_source_id: str,
        filters: dict,
    ) -> dict:
        if self._superset:
            return await self._execute_via_superset(data_source_id, filters)
        return self._execute_mock(data_source_id, filters)

    async def _execute_via_superset(
        self,
        data_source_id: str,
        filters: dict,
    ) -> dict:
        db_id = self._resolve_database(data_source_id, filters)
        sql = self._build_sql(data_source_id, filters, dialect="oracle")
        result = await self._superset.execute_sql(
            database_id=db_id,
            sql=sql,
        )
        if result and result.get("status") == "success":
            return {
                "columns": result.get("columns", []),
                "rows": result.get("data", []),
                "row_count": result.get("rowCount", 0),
            }
        return {"columns": [], "rows": [], "row_count": 0}

    def _execute_mock(self, data_source_id: str, filters: dict) -> dict:
        mock = MOCK_QUERY_RESULTS.get(data_source_id)
        if not mock:
            return {"columns": [], "rows": [], "row_count": 0}
        rows = mock["rows"]
        return {
            "columns": mock["columns"],
            "rows": rows,
            "row_count": len(rows),
        }

    async def execute_distinct(
        self,
        data_source_id: str,
        column: str,
        filters: dict,
    ) -> list[str]:
        if self._superset:
            return await self._execute_distinct_via_superset(
                data_source_id, column, filters
            )
        return self._execute_distinct_mock(data_source_id, column)

    async def _execute_distinct_via_superset(
        self,
        data_source_id: str,
        column: str,
        filters: dict,
    ) -> list[str]:
        db_id = self._resolve_database(data_source_id, filters)
        sql = self._build_sql(data_source_id, filters, column=column, dialect="oracle")
        result = await self._superset.execute_sql(database_id=db_id, sql=sql)
        if result and result.get("data"):
            return [row.get(column, "") for row in result["data"]]
        return []

    def _execute_distinct_mock(
        self, data_source_id: str, column: str
    ) -> list[str]:
        ds_values = MOCK_DISTINCT_VALUES.get(data_source_id, {})
        return ds_values.get(column, [])
```

- [ ] **Step 5: Install pytest-asyncio if needed and run tests**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && pip install pytest-asyncio && python -m pytest tests/test_query_engine.py -v`
Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/query_engine.py backend/app/mock/query_results.py backend/tests/test_query_engine.py
git commit -m "feat: add query engine with SQL building, dynamic DB routing, and mock fallback"
```

---

## Task 4: Merge Engine Service

**Files:**
- Create: `backend/app/services/merge_engine.py`
- Create: `backend/tests/test_merge_engine.py`

- [ ] **Step 1: Write merge engine tests**

Create `backend/tests/test_merge_engine.py`:

```python
from app.services.merge_engine import MergeEngine


def test_outer_join():
    left = {
        "columns": ["agent_code", "set_id", "total_items", "automatch_items"],
        "rows": [
            {"agent_code": "A1", "set_id": "S1", "total_items": 100, "automatch_items": 90},
            {"agent_code": "A1", "set_id": "S2", "total_items": 200, "automatch_items": 180},
        ],
        "row_count": 2,
    }
    right = {
        "columns": ["agent_code", "set_id", "total_manual_match_count"],
        "rows": [
            {"agent_code": "A1", "set_id": "S1", "total_manual_match_count": 5},
            {"agent_code": "A1", "set_id": "S3", "total_manual_match_count": 10},
        ],
        "row_count": 2,
    }

    result = MergeEngine.merge(
        results=[left, right],
        merge_on=["agent_code", "set_id"],
        merge_type="outer_join",
    )

    assert result["row_count"] == 3
    # S1 has data from both
    s1 = [r for r in result["rows"] if r.get("set_id") == "S1"][0]
    assert s1["total_items"] == 100
    assert s1["total_manual_match_count"] == 5
    # S2 only from left
    s2 = [r for r in result["rows"] if r.get("set_id") == "S2"][0]
    assert s2["total_items"] == 200
    assert s2.get("total_manual_match_count") is None
    # S3 only from right
    s3 = [r for r in result["rows"] if r.get("set_id") == "S3"][0]
    assert s3["total_manual_match_count"] == 10
    assert s3.get("total_items") is None


def test_inner_join():
    left = {
        "columns": ["k", "v1"],
        "rows": [{"k": "a", "v1": 1}, {"k": "b", "v1": 2}],
        "row_count": 2,
    }
    right = {
        "columns": ["k", "v2"],
        "rows": [{"k": "a", "v2": 10}],
        "row_count": 1,
    }
    result = MergeEngine.merge([left, right], merge_on=["k"], merge_type="inner_join")
    assert result["row_count"] == 1
    assert result["rows"][0]["k"] == "a"


def test_merge_empty_right():
    left = {
        "columns": ["k", "v"],
        "rows": [{"k": "a", "v": 1}],
        "row_count": 1,
    }
    right = {"columns": ["k", "v2"], "rows": [], "row_count": 0}
    result = MergeEngine.merge([left, right], merge_on=["k"], merge_type="outer_join")
    assert result["row_count"] == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/test_merge_engine.py -v`
Expected: FAIL

- [ ] **Step 3: Implement MergeEngine**

Create `backend/app/services/merge_engine.py`:

```python
from __future__ import annotations


class MergeEngine:
    @staticmethod
    def merge(
        results: list[dict],
        merge_on: list[str],
        merge_type: str = "outer_join",
    ) -> dict:
        if not results:
            return {"columns": [], "rows": [], "row_count": 0}
        if len(results) == 1:
            return results[0]

        merged = results[0]
        for i in range(1, len(results)):
            merged = MergeEngine._merge_two(merged, results[i], merge_on, merge_type)
        return merged

    @staticmethod
    def _merge_two(
        left: dict,
        right: dict,
        merge_on: list[str],
        merge_type: str,
    ) -> dict:
        def make_key(row: dict) -> tuple:
            return tuple(row.get(k) for k in merge_on)

        # Index right rows by key
        right_index: dict[tuple, dict] = {}
        for row in right["rows"]:
            key = make_key(row)
            right_index[key] = row

        # All columns from both sides (deduplicated, preserving order)
        all_columns = list(left["columns"])
        for col in right["columns"]:
            if col not in all_columns:
                all_columns.append(col)

        merged_rows = []
        seen_keys = set()

        # Process left rows
        for lrow in left["rows"]:
            key = make_key(lrow)
            seen_keys.add(key)
            rrow = right_index.get(key)

            if rrow:
                merged = {**lrow, **rrow}
                merged_rows.append(merged)
            elif merge_type == "outer_join":
                merged_rows.append({**lrow})

        # Process right-only rows (outer join)
        if merge_type == "outer_join":
            for rrow in right["rows"]:
                key = make_key(rrow)
                if key not in seen_keys:
                    merged_rows.append({**rrow})

        return {
            "columns": all_columns,
            "rows": merged_rows,
            "row_count": len(merged_rows),
        }
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/test_merge_engine.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/merge_engine.py backend/tests/test_merge_engine.py
git commit -m "feat: add merge engine for cross-source data joining"
```

---

## Task 5: Backend API Endpoints

**Files:**
- Create: `backend/app/api/data_sources.py`
- Modify: `backend/app/api/dashboards.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/core/dependencies.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Update dependencies.py**

Add ConfigStore, QueryEngine, and MergeEngine as FastAPI dependencies in `backend/app/core/dependencies.py`. Keep the existing SupersetDep. Add:

```python
from typing import Annotated
from fastapi import Depends, Request
from app.services.config_store import ConfigStore
from app.services.query_engine import QueryEngine
from app.services.merge_engine import MergeEngine

# ... existing SupersetDep ...

def get_config_store(request: Request) -> ConfigStore:
    return request.app.state.config_store

def get_query_engine(request: Request) -> QueryEngine:
    return request.app.state.query_engine

ConfigStoreDep = Annotated[ConfigStore, Depends(get_config_store)]
QueryEngineDep = Annotated[QueryEngine, Depends(get_query_engine)]
```

- [ ] **Step 2: Update main.py lifespan**

In `backend/app/main.py`, inside the `lifespan` function, after creating the superset client, add:

```python
from app.services.config_store import ConfigStore
from app.services.query_engine import QueryEngine

config_store = ConfigStore()
app.state.config_store = config_store
app.state.query_engine = QueryEngine(
    config_store=config_store,
    superset_client=app.state.superset,
)
```

- [ ] **Step 3: Rewrite dashboards.py**

Replace the contents of `backend/app/api/dashboards.py` with config-driven endpoints. The file should have:

- `GET /api/dashboards` — returns list of dashboard summaries from ConfigStore
- `GET /api/dashboards/{dashboard_id}` — returns full dashboard config from ConfigStore
- `POST /api/dashboards/{dashboard_id}/kpis` — accepts `{"filters": {...}}`, uses QueryEngine to execute each KPI's sources, aggregates, computes cross-KPI percentages, returns `{"kpis": [{"id": "...", "value": N, "percentage": N}, ...]}`

The KPI endpoint is the most complex: iterate `dashboard.kpis`, for each KPI iterate `kpi.sources`, call `query_engine.execute(source.data_source_id, filters)`, sum the specified metric column across all rows, apply `kpi.aggregation`. Then compute cross-KPI trends (e.g., breaks percentage = breaks / total_items * 100).

- [ ] **Step 4: Create data_sources.py**

Create `backend/app/api/data_sources.py`:

- `POST /api/data-sources/{data_source_id}/query` — accepts `{"filters": {...}}`, calls QueryEngine.execute, returns `{"columns": [...], "rows": [...], "row_count": N}`
- `POST /api/data-sources/merge` — accepts `{"sources": ["id1", "id2"], "merge_on": [...], "merge_type": "outer_join", "filters": {...}}`, executes each source, merges via MergeEngine, returns merged result
- `GET /api/data-sources/{data_source_id}/distinct/{column}` — accepts query params `filter.*`, calls QueryEngine.execute_distinct, returns `{"values": [...]}`

- [ ] **Step 5: Update router.py**

Add the data_sources router to `backend/app/api/router.py`:

```python
from app.api.data_sources import router as data_sources_router
# Add to the router includes:
router.include_router(data_sources_router, prefix="/api/data-sources", tags=["data-sources"])
```

- [ ] **Step 6: Test endpoints manually**

Start the backend:
```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && uvicorn app.main:app --reload --port 8000
```

Test with curl:
```bash
# List dashboards
curl http://localhost:8000/api/dashboards | python -m json.tool

# Get dashboard config
curl http://localhost:8000/api/dashboards/tlm-stats | python -m json.tool

# Execute KPIs
curl -X POST http://localhost:8000/api/dashboards/tlm-stats/kpis \
  -H "Content-Type: application/json" \
  -d '{"filters": {"tlm_instance": "TLMP_CONSUMER", "recon": ["AGENT_01"], "date_range": 1}}' \
  | python -m json.tool

# Query data source
curl -X POST http://localhost:8000/api/data-sources/tlm_breaks/query \
  -H "Content-Type: application/json" \
  -d '{"filters": {"tlm_instance": "TLMP_CONSUMER"}}' \
  | python -m json.tool

# Get distinct values
curl "http://localhost:8000/api/data-sources/reconmgmt_recon_bank/distinct/recon_engine_env" \
  | python -m json.tool

# Merge
curl -X POST http://localhost:8000/api/data-sources/merge \
  -H "Content-Type: application/json" \
  -d '{"sources": ["tlm_automatch", "reconmgmt_manual"], "merge_on": ["agent_code", "set_id", "stmt_date"], "merge_type": "outer_join", "filters": {"tlm_instance": "TLMP_CONSUMER"}}' \
  | python -m json.tool
```

Expected: All return valid JSON with correct structure.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/data_sources.py backend/app/api/dashboards.py backend/app/api/router.py backend/app/core/dependencies.py backend/app/main.py
git commit -m "feat: add config-driven dashboard and data source API endpoints"
```

---

## Task 6: Frontend TypeScript Types

**Files:**
- Create: `frontend/src/types/dashboard-config.ts`
- Modify: `frontend/src/types/filter.ts`

- [ ] **Step 1: Create dashboard config TypeScript types**

Create `frontend/src/types/dashboard-config.ts` that mirrors the backend Pydantic models. Use camelCase (the api-client transforms snake_case → camelCase automatically):

```typescript
export interface FilterOptionsSource {
  dataSourceId: string
  valueColumn: string
  dependsOn: Record<string, string>
}

export interface FilterPresetOption {
  label: string
  value: number | string
}

export interface FilterConfig {
  id: string
  label: string
  type: 'single-select' | 'multi-select' | 'preset-range'
  lockable: boolean
  optionsSource?: FilterOptionsSource
  options?: FilterPresetOption[]
  defaultValue?: number | string
}

export interface KpiSource {
  dataSourceId: string
  metric: string
}

export interface KpiTrend {
  type: string
  referenceKpi: string
}

export interface KpiConfig {
  id: string
  label: string
  format: 'number' | 'currency' | 'percent'
  sources: KpiSource[]
  aggregation: string
  trend?: KpiTrend
}

export interface KpiSegment {
  kpiId: string
  label: string
  color: string
}

export interface ChartLayout {
  col: number
  row: number
  width: number
  height: number
}

export interface DashboardChartConfig {
  id: string
  title: string
  type: string
  sourceType: 'query' | 'kpi_values'
  kpiSegments?: KpiSegment[]
  layout: ChartLayout
}

export interface GridColumn {
  field: string
  header: string
  type: 'string' | 'number' | 'date'
}

export interface GridSource {
  dataSourceId: string
}

export interface VisibleWhen {
  kpi: string
  condition: 'gt' | 'lt' | 'eq'
  value: number
}

export interface GridConfig {
  id: string
  title: string
  dataSourceId?: string
  sources?: GridSource[]
  mergeOn?: string[]
  mergeType?: string
  columns: GridColumn[]
  visibleWhen?: VisibleWhen
  layout: ChartLayout
}

export interface DashboardFeatures {
  crossFilter: boolean
  drillDown: boolean
}

export interface DashboardLayoutConfig {
  type: string
  sections: string[]
}

export interface DashboardConfig {
  id: string
  name: string
  description: string
  features: DashboardFeatures
  filters: FilterConfig[]
  kpis: KpiConfig[]
  charts: DashboardChartConfig[]
  grids: GridConfig[]
  layout: DashboardLayoutConfig
}

export interface KpiResult {
  id: string
  value: number
  percentage?: number
}

export interface KpisResponse {
  kpis: KpiResult[]
}

export interface DataSourceQueryResponse {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

export interface DistinctValuesResponse {
  values: string[]
}
```

- [ ] **Step 2: Add generic filter types to filter.ts**

Add to `frontend/src/types/filter.ts` (keep existing types, add new ones):

```typescript
export type FilterValue = string | string[] | number

export interface FilterState {
  values: Record<string, FilterValue>
  locked: Set<string>
  applied: Record<string, FilterValue>
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/dashboard-config.ts frontend/src/types/filter.ts
git commit -m "feat: add TypeScript types for config-driven dashboards"
```

---

## Task 7: Filter Store Refactor

**Files:**
- Modify: `frontend/src/stores/filter-store.ts`

- [ ] **Step 1: Read current filter store**

Read `frontend/src/stores/filter-store.ts` fully to understand existing usage.

- [ ] **Step 2: Refactor filter store to be generic**

Rewrite `frontend/src/stores/filter-store.ts`:

```typescript
import { create } from 'zustand'

import type { FilterValue } from '@/types/filter'

interface FilterStore {
  // Generic filter values keyed by filter ID
  values: Record<string, FilterValue>
  // Which filter IDs are locked (from URL params)
  locked: Set<string>
  // Snapshot of values at last "Apply" click
  applied: Record<string, FilterValue>

  // Actions
  setFilterValue: (filterId: string, value: FilterValue) => void
  setLocked: (filterIds: string[]) => void
  initializeFilters: (defaults: Record<string, FilterValue>, locked?: string[]) => void
  applyFilters: () => void
  resetFilters: (defaults: Record<string, FilterValue>) => void

  // Cross-filters (kept for dashboards that enable them)
  crossFilters: CrossFilter[]
  addCrossFilter: (filter: CrossFilter) => void
  removeCrossFilter: (chartId: string, column: string) => void
  clearCrossFilters: () => void
}

interface CrossFilter {
  sourceChartId: string
  column: string
  value: string | number
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  values: {},
  locked: new Set<string>(),
  applied: {},

  setFilterValue: (filterId, value) =>
    set((s) => ({
      values: { ...s.values, [filterId]: value },
    })),

  setLocked: (filterIds) =>
    set({ locked: new Set(filterIds) }),

  initializeFilters: (defaults, locked) =>
    set({
      values: { ...defaults },
      applied: { ...defaults },
      locked: new Set(locked ?? []),
    }),

  applyFilters: () =>
    set((s) => ({
      applied: { ...s.values },
    })),

  resetFilters: (defaults) =>
    set((s) => ({
      values: {
        ...defaults,
        // Keep locked filter values unchanged
        ...Object.fromEntries(
          Array.from(s.locked).map((k) => [k, s.values[k]])
        ),
      },
    })),

  crossFilters: [],
  addCrossFilter: (filter) =>
    set((s) => {
      const existing = s.crossFilters.find(
        (f) => f.sourceChartId === filter.sourceChartId && f.column === filter.column
      )
      if (existing && existing.value === filter.value) {
        return {
          crossFilters: s.crossFilters.filter(
            (f) => !(f.sourceChartId === filter.sourceChartId && f.column === filter.column)
          ),
        }
      }
      return {
        crossFilters: [
          ...s.crossFilters.filter(
            (f) => !(f.sourceChartId === filter.sourceChartId && f.column === filter.column)
          ),
          filter,
        ],
      }
    }),

  removeCrossFilter: (chartId, column) =>
    set((s) => ({
      crossFilters: s.crossFilters.filter(
        (f) => !(f.sourceChartId === chartId && f.column === column)
      ),
    })),

  clearCrossFilters: () => set({ crossFilters: [] }),
}))
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/frontend && npx tsc --noEmit 2>&1 | head -30`

There will be errors in files that import the old `GlobalFilters` type from the store — that's expected. We'll fix those in later tasks when we refactor the components.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/filter-store.ts
git commit -m "refactor: make filter store generic with Record<string, FilterValue>"
```

---

## Task 8: Frontend Data Hooks

**Files:**
- Create: `frontend/src/hooks/use-dashboard-config.ts`
- Create: `frontend/src/hooks/use-dashboard-kpis.ts`
- Create: `frontend/src/hooks/use-data-source-query.ts`
- Create: `frontend/src/hooks/use-data-source-merge.ts`
- Create: `frontend/src/hooks/use-filter-options.ts`

- [ ] **Step 1: Create use-dashboard-config hook**

```typescript
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { DashboardConfig } from '@/types/dashboard-config'

export function useDashboardConfig(dashboardId: string) {
  return useQuery({
    queryKey: ['dashboard-config', dashboardId],
    queryFn: () => api.get<DashboardConfig>(`/api/dashboards/${dashboardId}`),
    enabled: !!dashboardId,
    staleTime: 10 * 60 * 1000,
  })
}
```

- [ ] **Step 2: Create use-dashboard-kpis hook**

```typescript
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { KpisResponse } from '@/types/dashboard-config'

export function useDashboardKpis(
  dashboardId: string,
  filters: Record<string, FilterValue>,
) {
  return useQuery({
    queryKey: ['dashboard-kpis', dashboardId, filters],
    queryFn: () =>
      api.post<KpisResponse>(`/api/dashboards/${dashboardId}/kpis`, {
        filters,
      }),
    enabled: !!dashboardId && Object.keys(filters).length > 0,
  })
}
```

- [ ] **Step 3: Create use-data-source-query hook**

```typescript
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { DataSourceQueryResponse } from '@/types/dashboard-config'

export function useDataSourceQuery(
  dataSourceId: string,
  filters: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['data-source', dataSourceId, filters],
    queryFn: () =>
      api.post<DataSourceQueryResponse>(
        `/api/data-sources/${dataSourceId}/query`,
        { filters },
      ),
    enabled: enabled && !!dataSourceId,
  })
}
```

- [ ] **Step 4: Create use-data-source-merge hook**

```typescript
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { DataSourceQueryResponse } from '@/types/dashboard-config'

interface MergeConfig {
  sources: string[]
  mergeOn: string[]
  mergeType: string
}

export function useDataSourceMerge(
  mergeConfig: MergeConfig,
  filters: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['data-source-merge', mergeConfig.sources, filters],
    queryFn: () =>
      api.post<DataSourceQueryResponse>('/api/data-sources/merge', {
        sources: mergeConfig.sources,
        merge_on: mergeConfig.mergeOn,
        merge_type: mergeConfig.mergeType,
        filters,
      }),
    enabled: enabled && mergeConfig.sources.length > 0,
  })
}
```

- [ ] **Step 5: Create use-filter-options hook**

```typescript
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { DistinctValuesResponse } from '@/types/dashboard-config'

export function useFilterOptions(
  dataSourceId: string,
  column: string,
  parentFilters: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(parentFilters)) {
    if (val !== undefined && val !== null) {
      params.set(`filter.${key}`, String(val))
    }
  }

  return useQuery({
    queryKey: ['filter-options', dataSourceId, column, parentFilters],
    queryFn: () =>
      api.get<DistinctValuesResponse>(
        `/api/data-sources/${dataSourceId}/distinct/${column}?${params.toString()}`,
      ),
    enabled: enabled && !!dataSourceId && !!column,
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/use-dashboard-config.ts frontend/src/hooks/use-dashboard-kpis.ts frontend/src/hooks/use-data-source-query.ts frontend/src/hooks/use-data-source-merge.ts frontend/src/hooks/use-filter-options.ts
git commit -m "feat: add data hooks for config-driven dashboard data fetching"
```

---

## Task 9: Route Restructure (Pathless Layout)

**Files:**
- Modify: `frontend/src/routes/__root.tsx`
- Create: `frontend/src/routes/_app.tsx`
- Move: `frontend/src/routes/dashboards/` → `frontend/src/routes/_app/dashboards/`
- Move: `frontend/src/routes/explorer/` → `frontend/src/routes/_app/explorer/`
- Move: `frontend/src/routes/reports/` → `frontend/src/routes/_app/reports/`
- Move: `frontend/src/routes/settings/` → `frontend/src/routes/_app/settings/`
- Create: `frontend/src/routes/embed/dashboards/$dashboardId.tsx` (placeholder)

- [ ] **Step 1: Read current __root.tsx fully**

Read the file to understand what providers and shell components are rendered.

- [ ] **Step 2: Slim down __root.tsx**

Rewrite `__root.tsx` to only have providers (ThemeProvider, QueryClientProvider). Remove SidebarProvider, AppSidebar, Header, SidebarInset. Keep ErrorBoundary, Toaster, ReactQueryDevtools.

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { queryClient } from '@/lib/query-client'
import { ErrorBoundary } from '@/components/shared/error-boundary'

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: ErrorBoundary,
})

function RootLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster richColors position="bottom-right" />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 3: Create _app.tsx pathless layout**

Create `frontend/src/routes/_app.tsx`:

```tsx
import { Outlet, createFileRoute } from '@tanstack/react-router'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { PageTransition } from '@/components/shared/page-transition'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <PageTransition>
          <Outlet />
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

- [ ] **Step 4: Move existing route files into _app/ directory**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/frontend/src/routes
mkdir -p _app/dashboards _app/explorer _app/reports _app/settings
# Move files (git mv preserves history)
git mv dashboards/index.tsx _app/dashboards/index.tsx
git mv dashboards/\$dashboardId.tsx _app/dashboards/\$dashboardId.tsx
git mv explorer/index.tsx _app/explorer/index.tsx
git mv reports/index.tsx _app/reports/index.tsx
git mv settings/index.tsx _app/settings/index.tsx
# Remove empty old directories
rmdir dashboards explorer reports settings
```

- [ ] **Step 5: Update route definitions in moved files**

Each moved file's `createFileRoute` path must be updated:

- `_app/dashboards/index.tsx`: `createFileRoute('/_app/dashboards/')`
- `_app/dashboards/$dashboardId.tsx`: `createFileRoute('/_app/dashboards/$dashboardId')`
- `_app/explorer/index.tsx`: `createFileRoute('/_app/explorer/')`
- `_app/reports/index.tsx`: `createFileRoute('/_app/reports/')`
- `_app/settings/index.tsx`: `createFileRoute('/_app/settings/')`

Note: With TanStack Router file-based routing, `_app` is a pathless layout — it does NOT add `/app` to the URL. So `/_app/dashboards/` still resolves to `/dashboards/` in the browser.

- [ ] **Step 6: Update index.tsx redirect**

Update `frontend/src/routes/index.tsx` to redirect to the correct route path:
```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboards' })
  },
})
```

- [ ] **Step 7: Create embed route placeholder**

Create directory and placeholder file:
```bash
mkdir -p frontend/src/routes/embed/dashboards
```

Create `frontend/src/routes/embed/dashboards/$dashboardId.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/embed/dashboards/$dashboardId')({
  component: EmbedDashboardPage,
})

function EmbedDashboardPage() {
  const { dashboardId } = Route.useParams()
  return <div>Embed placeholder: {dashboardId}</div>
}
```

- [ ] **Step 8: Regenerate route tree**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/frontend && npx tsr generate`

This regenerates `routeTree.gen.ts` with the new route structure.

- [ ] **Step 9: Verify the app starts**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/frontend && pnpm dev`

Navigate to `http://localhost:5173/dashboards` — should show the dashboard list with sidebar + header.
Navigate to `http://localhost:5173/embed/dashboards/test` — should show "Embed placeholder: test" with no sidebar or header.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/routes/ frontend/src/routeTree.gen.ts
git commit -m "refactor: restructure routes with pathless _app layout for embed support"
```

---

## Task 10: Config-Driven Filter Bar

**Files:**
- Create: `frontend/src/components/dashboard/config-filter-bar.tsx`

- [ ] **Step 1: Create config-driven filter bar component**

Create `frontend/src/components/dashboard/config-filter-bar.tsx`. This component:

- Receives `FilterConfig[]` from dashboard config
- Renders the appropriate control for each filter type:
  - `single-select`: `Select` component (Shadcn)
  - `multi-select`: multi-select combobox with checkboxes (Shadcn Popover + Command)
  - `preset-range`: `ToggleGroup` with preset buttons
- Uses `useFilterOptions` hook for dynamic options (cascading)
- Shows lock icon on locked filters (non-interactive)
- Has Apply and Reset buttons
- Reads from / writes to the refactored filter store

Props interface:
```typescript
interface ConfigFilterBarProps {
  filters: FilterConfig[]
}
```

Key behaviors:
- When a parent filter changes value, child filters with `dependsOn` re-fetch their options
- Locked filters display their value but cannot be changed
- "Apply" calls `useFilterStore.applyFilters()` which triggers data re-fetch via query key changes
- "Reset" calls `useFilterStore.resetFilters(defaults)` using default values from config

- [ ] **Step 2: Verify it renders**

Test manually by temporarily importing into a page. Ensure filters render, cascading works, lock icon shows.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/config-filter-bar.tsx
git commit -m "feat: add config-driven filter bar with cascading and locking"
```

---

## Task 11: Config-Driven KPI Row

**Files:**
- Create: `frontend/src/components/dashboard/config-kpi-row.tsx`

- [ ] **Step 1: Create config-driven KPI row**

Create `frontend/src/components/dashboard/config-kpi-row.tsx`:

- Receives `KpiConfig[]` from dashboard config and `dashboardId`
- Uses `useDashboardKpis(dashboardId, appliedFilters)` to fetch batched KPI data
- Renders a `Card` per KPI with:
  - Label from config
  - Value via `CountAnimation` component
  - Percentage trend (if `kpi.trend` is defined)
- Skeleton loading state while fetching

Props interface:
```typescript
interface ConfigKpiRowProps {
  dashboardId: string
  kpis: KpiConfig[]
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/dashboard/config-kpi-row.tsx
git commit -m "feat: add config-driven KPI row with batched data fetching"
```

---

## Task 12: Config-Driven Chart Grid

**Files:**
- Create: `frontend/src/components/dashboard/config-chart-grid.tsx`

- [ ] **Step 1: Create config-driven chart grid**

Create `frontend/src/components/dashboard/config-chart-grid.tsx`:

- Receives `DashboardChartConfig[]` from dashboard config
- For each chart, determines data source:
  - `source_type: "kpi_values"` → renders chart from KPI data (receives `kpiResults` prop)
  - `source_type: "query"` → uses `useDataSourceQuery` to fetch chart data
- Uses `ChartPanel` wrapper (existing) with title from config
- Uses `ChartFactory` (existing) for rendering — already supports donut, bar, line, etc.
- Layout from config: CSS Grid with 12-column system

Props interface:
```typescript
interface ConfigChartGridProps {
  charts: DashboardChartConfig[]
  kpiResults?: KpiResult[]
}
```

For `kpi_values` donut chart: transform `kpiResults` + `chart.kpiSegments` into the `ChartDataResponse` format that `ChartFactory` expects:
```typescript
{
  chartId: chart.id,
  columns: ['category', 'value'],
  data: chart.kpiSegments.map(seg => ({
    category: seg.label,
    value: kpiResults.find(k => k.id === seg.kpiId)?.value ?? 0,
  })),
  rowCount: chart.kpiSegments.length,
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/dashboard/config-chart-grid.tsx
git commit -m "feat: add config-driven chart grid with kpi_values source support"
```

---

## Task 13: Config-Driven Data Grid

**Files:**
- Create: `frontend/src/components/dashboard/config-data-grid.tsx`

- [ ] **Step 1: Create config-driven data grid component**

Create `frontend/src/components/dashboard/config-data-grid.tsx`:

- Receives `GridConfig[]` from dashboard config
- For each grid:
  - If `grid.dataSourceId` (single source) → uses `useDataSourceQuery`
  - If `grid.sources` (multi-source) → uses `useDataSourceMerge`
  - Conditional visibility via `grid.visibleWhen` (checks KPI values)
- Renders AG Grid Enterprise with:
  - Column definitions from `grid.columns`
  - Client-side pagination (50 rows/page)
  - Quick filter toolbar
- Each grid wrapped in a `Card` with title

Props interface:
```typescript
interface ConfigDataGridProps {
  grids: GridConfig[]
  kpiResults?: KpiResult[]
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/dashboard/config-data-grid.tsx
git commit -m "feat: add config-driven data grid with merge support and conditional visibility"
```

---

## Task 14: DashboardRenderer + Dashboard Page Refactor

**Files:**
- Create: `frontend/src/components/dashboard/dashboard-renderer.tsx`
- Modify: `frontend/src/routes/_app/dashboards/$dashboardId.tsx`

- [ ] **Step 1: Create DashboardRenderer**

Create `frontend/src/components/dashboard/dashboard-renderer.tsx`:

Orchestrator component that:
1. Receives `DashboardConfig` and optional `mode` ('full' | 'embed')
2. Initializes filter store with default values from config + URL params
3. Renders in order: `ConfigFilterBar` → `ConfigKpiRow` → `ConfigChartGrid` → `ConfigDataGrid`
4. Passes KPI results down to chart grid and data grid (for `kpi_values` charts and `visible_when`)
5. Shows full-page skeleton while dashboard config is loading

Props interface:
```typescript
interface DashboardRendererProps {
  config: DashboardConfig
  initialFilters?: Record<string, FilterValue>
  lockedFilters?: string[]
}
```

On mount:
```typescript
useEffect(() => {
  const defaults: Record<string, FilterValue> = {}
  for (const filter of config.filters) {
    if (filter.defaultValue !== undefined) {
      defaults[filter.id] = filter.defaultValue
    }
  }
  // URL params override defaults
  const merged = { ...defaults, ...initialFilters }
  initializeFilters(merged, lockedFilters)
}, [config.id])
```

- [ ] **Step 2: Refactor dashboard detail page**

Rewrite `frontend/src/routes/_app/dashboards/$dashboardId.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'

import { useDashboardConfig } from '@/hooks/use-dashboard-config'
import { DashboardRenderer } from '@/components/dashboard/dashboard-renderer'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_app/dashboards/$dashboardId')({
  component: DashboardPage,
})

function DashboardPage() {
  const { dashboardId } = Route.useParams()
  const { data: config, isLoading } = useDashboardConfig(dashboardId)

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (!config) {
    return <div className="p-6">Dashboard not found</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{config.name}</h1>
        {config.description && (
          <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
        )}
      </div>
      <DashboardRenderer config={config} />
    </div>
  )
}
```

- [ ] **Step 3: Verify the dashboard renders**

Start both backend and frontend:
```bash
# Terminal 1
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/frontend && pnpm dev
```

Navigate to `http://localhost:5173/dashboards/tlm-stats`. Should see:
- Filter bar with TLM Instance, Recon, Set ID, Date Range
- 4 KPI cards with animated values
- Donut chart
- Breaks table and Recon table (if KPI values > 0)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/dashboard-renderer.tsx frontend/src/routes/_app/dashboards/\$dashboardId.tsx
git commit -m "feat: add DashboardRenderer and refactor dashboard page to be config-driven"
```

---

## Task 15: Embed Route + Topbar

**Files:**
- Create: `frontend/src/components/embed/embed-topbar.tsx`
- Modify: `frontend/src/routes/embed/dashboards/$dashboardId.tsx`

- [ ] **Step 1: Create embed topbar**

Create `frontend/src/components/embed/embed-topbar.tsx`:

```tsx
import { ExternalLink } from 'lucide-react'

interface EmbedTopbarProps {
  title: string
  dashboardId: string
  filterParams: string
}

export function EmbedTopbar({ title, dashboardId, filterParams }: EmbedTopbarProps) {
  const recvizUrl = `/dashboards/${dashboardId}${filterParams ? `?${filterParams}` : ''}`

  return (
    <div className="h-9 border-b flex items-center justify-between px-4 bg-muted/30 flex-shrink-0">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <a
        href={recvizUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/30 bg-primary/10 rounded px-2.5 py-1"
      >
        <ExternalLink className="h-3 w-3" />
        Open in RecViz
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Implement embed dashboard page**

Rewrite `frontend/src/routes/embed/dashboards/$dashboardId.tsx`:

```tsx
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useDashboardConfig } from '@/hooks/use-dashboard-config'
import { DashboardRenderer } from '@/components/dashboard/dashboard-renderer'
import { EmbedTopbar } from '@/components/embed/embed-topbar'
import { Skeleton } from '@/components/ui/skeleton'
import type { FilterValue } from '@/types/filter'

export const Route = createFileRoute('/embed/dashboards/$dashboardId')({
  component: EmbedDashboardPage,
  validateSearch: (search: Record<string, unknown>) => search,
})

function EmbedDashboardPage() {
  const { dashboardId } = Route.useParams()
  const search = Route.useSearch()
  const { data: config, isLoading } = useDashboardConfig(dashboardId)

  // Parse filter.* params and lock param from URL
  const initialFilters: Record<string, FilterValue> = {}
  const filterParams: string[] = []
  for (const [key, val] of Object.entries(search)) {
    if (key.startsWith('filter.') && typeof val === 'string') {
      const filterId = key.replace('filter.', '')
      // Comma-separated values become arrays
      initialFilters[filterId] = val.includes(',') ? val.split(',') : val
      filterParams.push(`${key}=${val}`)
    }
  }

  const lockParam = typeof search.lock === 'string' ? search.lock : ''
  const lockedFilters = lockParam ? lockParam.split(',') : []
  if (lockParam) filterParams.push(`lock=${lockParam}`)

  // Apply theme from URL
  const theme = typeof search.theme === 'string' ? search.theme : undefined
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="h-9 border-b bg-muted/30" />
        <div className="p-6 space-y-4 flex-1">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!config) {
    return <div className="p-6">Dashboard not found</div>
  }

  return (
    <div className="h-screen flex flex-col">
      <EmbedTopbar
        title={config.name}
        dashboardId={dashboardId}
        filterParams={filterParams.join('&')}
      />
      <div className="p-6 flex-1 overflow-auto space-y-6">
        <DashboardRenderer
          config={config}
          initialFilters={initialFilters}
          lockedFilters={lockedFilters}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Regenerate route tree**

Run: `cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/frontend && npx tsr generate`

- [ ] **Step 4: Test embed mode**

Navigate to:
```
http://localhost:5173/embed/dashboards/tlm-stats?filter.tlm_instance=TLMP_CONSUMER&filter.recon=AGENT_01&lock=tlm_instance,recon&theme=dark
```

Should see:
- Thin topbar with "TLM Statistics Dashboard" and "Open in RecViz" link
- No sidebar, no header
- Filter bar with TLM Instance and Recon locked (lock icon)
- KPIs, chart, grids rendering

Click "Open in RecViz" → should open full app view in new tab.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/embed/ frontend/src/routes/embed/ frontend/src/routeTree.gen.ts
git commit -m "feat: add embed mode with thin topbar and URL param filter initialization"
```

---

## Task 16: Dashboard List Page Update

**Files:**
- Modify: `frontend/src/routes/_app/dashboards/index.tsx`

- [ ] **Step 1: Update dashboard list to use config store**

The dashboard list page currently uses `useDashboards()` which calls `GET /api/dashboards`. Since we rewrote that endpoint in Task 5 to return config-driven dashboards, verify the list still renders correctly.

Read the current component, check that the response shape from the new `/api/dashboards` endpoint matches what the component expects. If the field names differ (e.g., `name` vs `title`), update either the backend response or the frontend component to align.

The backend should return a list format like:
```json
[{ "id": "tlm-stats", "name": "TLM Statistics Dashboard", "description": "...", "status": "active" }]
```

- [ ] **Step 2: Verify dashboard list works**

Navigate to `http://localhost:5173/dashboards`. Should show TLM Stats dashboard card. Click it → should navigate to `/dashboards/tlm-stats` and render the config-driven dashboard.

- [ ] **Step 3: Commit if changes needed**

```bash
git add frontend/src/routes/_app/dashboards/index.tsx
git commit -m "fix: align dashboard list with config-driven backend response"
```

---

## Task 17: Autosys-job-explorer Angular Changes

**Files (in autosys-job-explorer repo):**
- Create: `frontend/rectrace/src/app/custom-interactions/components/modals/recviz-embed-dialog/recviz-embed-dialog.component.ts`
- Modify: `frontend/rectrace/src/app/custom-interactions/components/renderers/v2/set-id-v2-renderer.component.ts`
- Modify: `frontend/rectrace/src/app/custom-interactions/components/renderers/v2/recon-v2-renderer.component.ts`
- Modify: `frontend/rectrace/src/app/custom-interactions/components/renderers/v2/tlm-instance-v2-renderer.component.ts`
- Modify: `frontend/rectrace/src/app/custom-interactions/custom-interactions.module.ts`
- Modify: `frontend/rectrace/src/environments/environment.ts`

- [ ] **Step 1: Create a new branch in autosys-job-explorer**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git checkout -b feat/recviz-embed-integration
```

- [ ] **Step 2: Add recvizUrl to environment config**

In `frontend/rectrace/src/environments/environment.ts`, add:
```typescript
recvizUrl: 'http://localhost:5173'
```

- [ ] **Step 3: Create RecvizEmbedDialogComponent**

Create `frontend/rectrace/src/app/custom-interactions/components/modals/recviz-embed-dialog/recviz-embed-dialog.component.ts`:

```typescript
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-recviz-embed-dialog',
  template: `
    <div mat-dialog-content
         style="padding: 0; height: 100%; overflow: hidden; margin: 0;">
      <iframe
        [src]="safeUrl"
        style="width: 100%; height: 100%; border: none;"
      ></iframe>
    </div>
  `,
  styles: [`
    :host ::ng-deep .mat-mdc-dialog-content {
      max-height: unset;
      padding: 0;
      margin: 0;
    }
  `]
})
export class RecvizEmbedDialogComponent {
  safeUrl: SafeResourceUrl;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { url: string },
    private sanitizer: DomSanitizer,
  ) {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.url);
  }
}
```

- [ ] **Step 4: Register in CustomInteractionsModule**

In `custom-interactions.module.ts`, import and declare `RecvizEmbedDialogComponent`.

- [ ] **Step 5: Update set-id-v2-renderer**

In `set-id-v2-renderer.component.ts`, update the `showTlmDashboard()` method:

```typescript
import { RecvizEmbedDialogComponent } from '../modals/recviz-embed-dialog/recviz-embed-dialog.component';
import { environment } from '../../../../../environments/environment';

// Replace the existing showTlmDashboard method:
showTlmDashboard(): void {
  const params = new URLSearchParams();
  params.set('filter.tlm_instance', this.params.data?.tlm_instance || '');
  params.set('filter.recon', this.params.data?.agent_code || this.params.data?.recon || '');
  params.set('filter.set_id', this.setId);
  params.set('lock', 'tlm_instance,recon,set_id');
  params.set('theme', 'dark');

  const url = `${environment.recvizUrl}/embed/dashboards/tlm-stats?${params.toString()}`;

  this.dialog.open(RecvizEmbedDialogComponent, {
    width: '95vw',
    height: '90vh',
    data: { url },
    panelClass: ['tlm-dashboard-modal-v2', 'no-padding'],
    autoFocus: false,
  });
}
```

- [ ] **Step 6: Update recon-v2-renderer**

Same pattern but with different lock params:

```typescript
params.set('filter.tlm_instance', this.params.data?.tlm_instance || '');
params.set('filter.recon', this.reconName);
params.set('lock', 'tlm_instance,recon');
```

- [ ] **Step 7: Update tlm-instance-v2-renderer**

```typescript
params.set('filter.tlm_instance', this.tlmInstance);
params.set('lock', 'tlm_instance');
```

- [ ] **Step 8: Verify the integration**

Run both apps:
- RecViz frontend on port 5173
- RecViz backend on port 8000
- Autosys-job-explorer frontend on its port

In autosys-job-explorer, click a set_id in the search grid → should open MatDialog with RecViz iframe showing the TLM Stats dashboard with locked filters.

- [ ] **Step 9: Commit**

```bash
cd /Users/aarun/Workspace/Projects/autosys-job-explorer
git add frontend/rectrace/src/app/custom-interactions/components/modals/recviz-embed-dialog/ frontend/rectrace/src/app/custom-interactions/components/renderers/v2/ frontend/rectrace/src/app/custom-interactions/custom-interactions.module.ts frontend/rectrace/src/environments/environment.ts
git commit -m "feat: replace TLM Stats modal with RecViz iframe embed"
```

---

## Task 18: End-to-End Verification

- [ ] **Step 1: Start all services**

```bash
# Terminal 1: RecViz backend
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && uvicorn app.main:app --reload --port 8000

# Terminal 2: RecViz frontend
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/frontend && pnpm dev

# Terminal 3: Autosys-job-explorer (if testing integration)
cd /Users/aarun/Workspace/Projects/autosys-job-explorer/frontend/rectrace && ng serve
```

- [ ] **Step 2: Test full app mode**

Navigate to `http://localhost:5173/dashboards` → should list TLM Stats dashboard.
Click it → `/dashboards/tlm-stats` should show full dashboard with sidebar, header, filters, KPIs, chart, grids.

- [ ] **Step 3: Test embed mode**

Navigate to `http://localhost:5173/embed/dashboards/tlm-stats?filter.tlm_instance=TLMP_CONSUMER&lock=tlm_instance&theme=dark`

Verify:
- No sidebar, no header
- Thin topbar with "Open in RecViz" link
- TLM Instance filter is locked
- Recon and Set ID dropdowns load with cascading options
- Click Apply → KPIs animate, chart renders, grids populate
- "Open in RecViz" opens full app in new tab

- [ ] **Step 4: Test all three entry points (if autosys-job-explorer running)**

- Click set_id → all 3 filters locked
- Click recon → TLM Instance + Recon locked, Set ID selectable
- Click tlm_instance → only TLM Instance locked, Recon + Set ID selectable

- [ ] **Step 5: Run backend tests**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend
python -m pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 6: Final commit on RecViz branch**

```bash
cd /Users/aarun/Workspace/Projects/RecStats
git add -A
git status  # review what's staged
git commit -m "feat: complete config-driven embeddable dashboard implementation"
```
