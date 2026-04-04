# Phase 1: Foundation Hardening - Research

**Researched:** 2026-04-04
**Domain:** Backend infrastructure (SQLAlchemy/Alembic/asyncpg), API error handling, frontend formatting utilities, legacy code cleanup
**Confidence:** HIGH

## Summary

Phase 1 transforms the codebase from a prototype with mock data fallbacks and JSON-file configs into a production-ready foundation. The six requirements (INFR-01 through INFR-06) break into five distinct workstreams: (1) mock data removal and error handling hardening across 9 API endpoints, (2) database persistence layer with SQLAlchemy async + Alembic for dashboard/data-source configs, (3) centralized number formatting utilities on the frontend, (4) Superset version pinning and CSRF hardening, and (5) legacy dead code cleanup.

The existing codebase is well-structured for this work. The `ConfigStore` service has a clean interface (`get_dashboard`, `list_dashboards`, `get_data_source`, `list_data_sources`) that a database-backed replacement can mirror exactly. The FastAPI dependency injection pattern (`ConfigStoreDep`) means swapping the implementation requires minimal route handler changes. On the frontend, Sonner toast is already integrated and the `ErrorBoundary` component exists -- the work is connecting these to real backend error responses that currently never arrive (because mock data intercepts all failures).

**Primary recommendation:** Start with the database persistence layer (SQLAlchemy models + Alembic migrations), then remove mock data (which forces proper error handling), then add formatting utilities, pin Superset, and clean up dead code. The DB layer comes first because mock data removal requires PostgreSQL seed data as the replacement for development data.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Remove ALL mock data fallbacks from all 9 API endpoints. No fake data, ever -- not even in development. When Superset is unavailable or a query fails, return proper HTTP errors (503, 500).
- **D-02:** Delete `backend/app/mock_data.py` entirely and all references to MOCK_* constants across the API layer.
- **D-03:** For local development, seed PostgreSQL with realistic reconciliation data via SQL seed scripts. PostgreSQL replaces the role mock data served.
- **D-04:** Remove SQLite entirely from the project. No SQLite seed databases, no SQLite data sources in `databases.json`. PostgreSQL only -- Docker Compose is required for local dev.
- **D-05:** Delete existing SQLite `.db` files and update `databases.json` to reference PostgreSQL data sources.
- **D-06:** Store all RecViz entities (dashboards, charts, KPIs, datasets, saved views) in the same PostgreSQL instance that Superset uses for metadata. RecViz tables prefixed with `recviz_` to avoid collisions with Superset's tables.
- **D-07:** Use SQLAlchemy async (with asyncpg driver) for the ORM layer. Alembic for schema migrations.
- **D-08:** Migrate dashboard configs from JSON files on disk to database rows. The existing `ConfigStore` service gets replaced by database queries.
- **D-09:** Dashboard config schema includes a `version` field from day one. Alembic handles schema evolution. Backward-compatible: existing JSON configs can be imported as initial seed data.
- **D-10:** Toast notification + inline error state on the affected component when a query fails. Sonner toast for the error message, inline error panel with retry button on the component.
- **D-11:** Per-component error isolation. If one chart's Oracle query times out, other charts from different queries still render. No full-dashboard error page.
- **D-12:** Error states show: what went wrong (human-readable), a retry button, and optionally a "details" expandable for technical info.
- **D-13:** Create a centralized formatting utility (`frontend/src/lib/formatters.ts`) replacing scattered formatting logic across components.
- **D-14:** Fully configurable formatting with NO hardcoded defaults. Each dataset column's metadata specifies: format type, decimal precision, abbreviation, and currency companion column.
- **D-15:** KPI cards show abbreviated numbers (1.2M, 45.3K) with hover showing full number. Grids show full formatted numbers. All driven by column metadata configuration.
- **D-16:** Currency formatting uses `Intl.NumberFormat` with per-row currency codes. Supports all ISO 4217 codes. Companion currency column is configurable.
- **D-17:** Delete confirmed dead code files: `filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx` (the non-config-prefixed versions). These are orphaned -- zero imports.
- **D-18:** Audit and remove any other dead hooks, stores, or utilities that reference the legacy dashboard system. Preserve cross-filter and drill-down logic from legacy code for porting in Phase 2.
- **D-19:** Pin `apache-superset` to a specific version in `requirements.txt`. Verify CSRF and auth handling work with that pinned version.
- **D-20:** Existing Superset client auth/CSRF/retry logic is solid. Keep it, test it against the pinned version.

### Claude's Discretion
- SQLAlchemy model design (table structure, relationships, column types)
- Alembic migration strategy (single initial migration vs incremental)
- Seed data content and schema (realistic recon data for PostgreSQL)
- Specific Superset version to pin (verify latest stable)
- Error toast styling and animation timing
- Dead code audit methodology (grep for imports, verify unused)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Dashboard configs persisted in database -- not static JSON files | SQLAlchemy async + asyncpg + Alembic migration pattern; JSONB storage model for config; `recviz_` table prefix in shared PostgreSQL |
| INFR-02 | Config schema versioning with migration support -- backward-compatible evolution | `schema_version` integer field on config rows; Alembic for DDL migrations; Python migration functions for config content evolution |
| INFR-03 | Superset pinned to specific version with CSRF and auth handling hardened | Pin `apache-superset==6.0.0` (currently installed version); add CSRF retry on 400/403; make token refresh interval configurable |
| INFR-04 | Remove mock data fallbacks -- surface real errors instead of silently serving fake data | Delete `mock_data.py`; replace all 9 `except Exception: return MOCK_*` patterns with proper HTTP 502/503 responses; seed PostgreSQL for dev |
| INFR-05 | Number formatting utilities for financial data | Centralized `formatters.ts` using `Intl.NumberFormat`; configurable via column metadata; abbreviation with hover for KPIs |
| INFR-06 | Legacy dead code cleaned up | Delete `filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`; audit with grep for orphaned imports; preserve `cross-filter-bar.tsx` and `drill-breadcrumb.tsx` for Phase 2 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Key directives that affect this phase:

- **Strict TypeScript.** No `any`. No `@ts-ignore`. `unknown` + type narrowing if needed.
- **Named exports** for all components, hooks, stores, utilities. Default exports only for page components.
- **No barrel exports** -- import directly from files.
- **Hooks return objects**, not arrays.
- **Async everywhere** in Python. All endpoints `async def`. Use `httpx.AsyncClient` for Superset.
- **Pydantic v2** models for all request/response.
- **Service layer pattern**: routes call services, services call external APIs/DBs.
- **Dependency injection** via `FastAPI.Depends()`.
- **Config** via `pydantic-settings` (`BaseSettings`).
- **Sonner** for toast notifications (already integrated).
- **`motion/react`** for animations (NOT `framer-motion`).
- **`Intl.NumberFormat`** for all currency/number display.
- **Desktop-first** -- responsive secondary.
- **Dark mode** via Tailwind `dark:` variant -- every component must work in both.
- **Shadcn CSS variable colors only** -- never hardcode hex/rgb/hsl.

## Standard Stack

### Core (New Dependencies for This Phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.0.49 | Async ORM for PostgreSQL | Standard Python ORM; v2 has native async support |
| asyncpg | 0.31.0 | Async PostgreSQL driver | Fastest async PG driver; SQLAlchemy's recommended async backend |
| Alembic | 1.18.4 | Database schema migrations | Only migration tool for SQLAlchemy; async template available |
| zod | 4.3.6 | Frontend config validation | Runtime schema validation for dashboard configs loaded from DB |

### Existing (Already in Project)

| Library | Current Version | Purpose | Notes |
|---------|----------------|---------|-------|
| FastAPI | 0.128.6 | Backend framework | Already async; `Depends()` pattern for DI |
| Pydantic | 2.12.5 | Validation/models | v2 already; `model_validate()` for config loading |
| pydantic-settings | 2.12.0 | Config from env vars | Add `database_url` for RecViz's own DB connection |
| httpx | 0.28.1 | Async HTTP client | Used by `SupersetClient` |
| psycopg2-binary | 2.9.11 | Sync PG driver (Superset) | Keep for Superset compatibility; asyncpg is for RecViz's own DB |
| sonner | 2.0.7 | Toast notifications | Already integrated in `__root.tsx` |
| React | 19.2.0 | Frontend framework | No changes needed |
| TanStack Query | 5.90.20 | Server state | Error handling hooks already exist |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncpg | psycopg3 (async mode) | psycopg3 is newer and simpler but asyncpg is faster and more battle-tested for async SQLAlchemy |
| zod | io-ts, superstruct | zod has best DX, largest ecosystem, and is already a transitive dep (via shadcn) |
| Alembic | manual SQL migrations | Alembic handles auto-generation, dependency tracking, and rollbacks -- hand-rolling is fragile |

**Installation (backend):**
```bash
pip install "sqlalchemy[asyncio]==2.0.49" asyncpg==0.31.0 alembic==1.18.4
```

**Installation (frontend):**
```bash
pnpm add zod@4.3.6
```

**IMPORTANT: SQLAlchemy version split.** The project's venv currently has SQLAlchemy 1.4.54 (installed as a Superset dependency). RecViz's backend needs SQLAlchemy 2.0+ for async support. However, Superset runs in Docker (separate Python environment), so the RecViz backend can safely use SQLAlchemy 2.0 without conflicting. The `requirements.txt` should pin `sqlalchemy[asyncio]>=2.0.49` for the backend, and the Superset Dockerfile continues to install its own dependencies independently.

## Architecture Patterns

### Database Layer Structure
```
backend/
├── app/
│   ├── db/
│   │   ├── __init__.py          # Empty
│   │   ├── engine.py            # create_async_engine, async_session_factory
│   │   ├── base.py              # DeclarativeBase class
│   │   └── models/
│   │       ├── __init__.py      # Re-export all models for Alembic
│   │       ├── dashboard.py     # RecvizDashboard model
│   │       └── data_source.py   # RecvizDataSource model
│   ├── services/
│   │   ├── config_store.py      # REPLACE: now queries DB instead of JSON
│   │   └── ...existing...
│   └── migrations/              # Alembic root
│       ├── alembic.ini
│       ├── env.py               # Async env.py (alembic init -t async)
│       └── versions/
│           └── 001_initial.py   # Initial schema
```

### Pattern 1: Async SQLAlchemy Engine Setup
**What:** Singleton async engine + session factory, injected via FastAPI lifespan
**When to use:** All database operations in RecViz backend

```python
# backend/app/db/engine.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import settings

engine = create_async_engine(
    settings.recviz_db_url,  # postgresql+asyncpg://...
    echo=False,
    pool_size=10,
    max_overflow=5,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

### Pattern 2: JSONB Storage for Dashboard Configs (Grafana Pattern)
**What:** Store the full config JSON in a JSONB column alongside indexed metadata columns
**When to use:** Dashboard and data source config persistence

```python
# backend/app/db/models/dashboard.py
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class RecvizDashboard(Base):
    __tablename__ = "recviz_dashboards"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), default="")
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

**Why JSONB, not fully normalized tables:** Dashboard configs are deeply nested (filters, KPIs, charts, grids, each with sub-objects). Normalizing into 10+ tables creates an N+1 join nightmare for loading a single dashboard. JSONB gives atomic read/write of the full config while still allowing PostgreSQL to index and query into the JSON structure (e.g., `WHERE config->>'name' LIKE '%TLM%'`). This is the Grafana pattern -- Grafana stores dashboard JSON in a single `dashboard.data` JSONB column.

### Pattern 3: Config Schema Migration Pipeline
**What:** Chain of pure functions that transform config from version N to version N+1
**When to use:** Every time a dashboard config is loaded from the database

```python
# backend/app/services/config_migrator.py
from typing import Any

CURRENT_SCHEMA_VERSION = 1

MigrationFunc = Callable[[dict[str, Any]], dict[str, Any]]

# Registry: version_from -> migration function
_migrations: dict[int, MigrationFunc] = {}

def register_migration(from_version: int):
    def decorator(fn: MigrationFunc):
        _migrations[from_version] = fn
        return fn
    return decorator

def migrate_config(config: dict[str, Any]) -> dict[str, Any]:
    """Migrate a config dict from its current version to CURRENT_SCHEMA_VERSION."""
    version = config.get("schema_version", 0)
    while version < CURRENT_SCHEMA_VERSION:
        if version not in _migrations:
            raise ValueError(f"No migration from version {version}")
        config = _migrations[version](config)
        version += 1
    config["schema_version"] = CURRENT_SCHEMA_VERSION
    return config

# Example future migration:
# @register_migration(from_version=1)
# def migrate_v1_to_v2(config: dict) -> dict:
#     for chart in config.get("charts", []):
#         chart.setdefault("cross_filter_enabled", False)
#     return config
```

### Pattern 4: Replacing ConfigStore with DB-Backed Service
**What:** New `ConfigStore` implementation that queries the database instead of reading JSON files
**When to use:** Drop-in replacement -- same interface, different storage backend

```python
# backend/app/services/config_store.py (REWRITTEN)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.dashboard import RecvizDashboard
from app.db.models.data_source import RecvizDataSource
from app.models.dashboard_config import DashboardConfig
from app.models.data_source_config import DataSourceConfig
from app.services.config_migrator import migrate_config

class ConfigStore:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_dashboards(self) -> list[DashboardConfig]:
        result = await self._session.execute(
            select(RecvizDashboard).order_by(RecvizDashboard.name)
        )
        rows = result.scalars().all()
        return [
            DashboardConfig.model_validate(migrate_config(row.config))
            for row in rows
        ]

    async def get_dashboard(self, dashboard_id: str) -> DashboardConfig | None:
        row = await self._session.get(RecvizDashboard, dashboard_id)
        if not row:
            return None
        return DashboardConfig.model_validate(migrate_config(row.config))

    # ... same pattern for data sources
```

**Critical change:** The old `ConfigStore` was synchronous (loaded at startup). The new one is async and takes an `AsyncSession`. This means `ConfigStoreDep` must change from returning `app.state.config_store` to providing a session-scoped instance.

### Pattern 5: Error Response Structure
**What:** Structured error responses from the backend that the frontend can parse into user-facing messages
**When to use:** All API endpoints that proxy to Superset or query databases

```python
# Backend error response shape
from pydantic import BaseModel

class ErrorResponse(BaseModel):
    error: str          # Machine-readable error code: "superset_unavailable", "query_timeout", "database_error"
    message: str        # Human-readable message: "The query engine is temporarily unavailable"
    detail: str | None  # Technical detail (shown in expandable on frontend)
    retry_after: int | None  # Seconds before client should retry (for 503)
```

```typescript
// Frontend error handling in api-client.ts
class ApiError extends Error {
  status: number
  code: string
  userMessage: string
  detail?: string
  retryAfter?: number
}
```

### Anti-Patterns to Avoid
- **Never catch-and-silence exceptions in route handlers.** The entire mock data problem stems from `except Exception: pass` followed by mock data return. Every exception must propagate as an HTTP error response.
- **Never store financial data in JSON.** JSONB in PostgreSQL is fine for config, but actual financial data (amounts, rates) must come from the database's DECIMAL types, never from JSON serialization which loses precision.
- **Never mix sync and async DB operations.** RecViz backend is fully async. Use `async_sessionmaker` and `AsyncSession` everywhere. Do not use `Session` (sync) from SQLAlchemy.
- **Never import from `mock_data.py`.** After this phase, the file does not exist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number formatting | Custom `toFixed()`/regex | `Intl.NumberFormat` | Handles locale, currency codes, rounding correctly; built into every browser |
| Number abbreviation | Custom K/M/B logic | `Intl.NumberFormat` with `notation: 'compact'` | Handles internationalization, edge cases (999,950 rounds to 1M) |
| Database migrations | SQL scripts run manually | Alembic | Tracks migration history, handles rollbacks, supports autogenerate from models |
| Config validation (frontend) | Manual type checks | Zod schemas | Runtime validation with TypeScript type inference; `.safeParse()` returns typed errors |
| Config validation (backend) | Manual dict checks | Pydantic `model_validate()` | Already used everywhere; schema version check fits naturally |
| Toast notifications | Custom toast system | Sonner (already installed) | Rich toasts with dismiss, action buttons, promise handling |
| Async database access | Raw asyncpg queries | SQLAlchemy async ORM | Type-safe, migration-aware, relationship-ready for future phases |

**Key insight:** The `Intl.NumberFormat` API is significantly more capable than most developers realize. It handles compact notation (`1.2M`), per-row currency codes, percentage formatting, and locale-aware thousand separators -- all the requirements D-14 through D-16. No custom formatting logic is needed beyond a thin wrapper.

## Common Pitfalls

### Pitfall 1: SQLAlchemy Async Session Lifecycle Mismatch
**What goes wrong:** Creating an `AsyncSession` at app startup and sharing it across requests. Sessions are not thread-safe and not request-safe -- a long-running session accumulates stale state and eventually causes `DetachedInstanceError` or data inconsistency.
**Why it happens:** The existing `ConfigStore` is a startup singleton. Developers copy this pattern for the DB-backed replacement.
**How to avoid:** Create a new `AsyncSession` per request via FastAPI's dependency injection. Use `async_sessionmaker` as a factory, inject via `Depends()`. Session is created at request start, committed/rolled back, and closed at request end.
**Warning signs:** `DetachedInstanceError`, stale reads, data that doesn't update until server restart.

### Pitfall 2: Alembic Async env.py Configuration
**What goes wrong:** Using `alembic init` (sync template) instead of `alembic init -t async`. The sync template generates `env.py` with `create_engine()` which doesn't work with `asyncpg://` URLs. Migrations fail with "dialect asyncpg is not compatible with synchronous engine".
**Why it happens:** Most Alembic tutorials show the sync template.
**How to avoid:** Always use `alembic init -t async migrations` to generate the async-compatible `env.py`. Configure `sqlalchemy.url` in `alembic.ini` to use `postgresql+asyncpg://` prefix.
**Warning signs:** Import errors or "async driver used with sync engine" errors when running `alembic upgrade head`.

### Pitfall 3: Removing Mock Data Before Seed Data Exists
**What goes wrong:** Deleting `mock_data.py` and the mock fallback patterns before PostgreSQL seed data and Docker Compose are working. Development becomes impossible -- every API call returns 503 because there's no data anywhere.
**How to avoid:** Build the seed data scripts FIRST. Verify the full Docker Compose stack (PostgreSQL + Redis + Superset) starts cleanly. Verify the backend connects to PostgreSQL and can serve data. THEN remove mock data fallbacks.
**Warning signs:** All dashboards showing error states in development after mock data removal.

### Pitfall 4: Breaking the ConfigStore Interface
**What goes wrong:** The new DB-backed `ConfigStore` changes method signatures (e.g., making methods async when they were sync). This breaks every route handler that calls `config_store.get_dashboard()` because they now need `await`.
**Why it happens:** The old `ConfigStore` was sync (reads JSON from disk at startup). The new one must be async (queries PostgreSQL).
**How to avoid:** Change all call sites simultaneously. The `ConfigStore` methods were already called from `async def` route handlers -- they just weren't awaited. Adding `await` is straightforward. Update the `ConfigStoreDep` dependency to return an async-capable instance.
**Warning signs:** "coroutine object has no attribute 'id'" runtime errors.

### Pitfall 5: Intl.NumberFormat Currency Without Currency Code
**What goes wrong:** Calling `new Intl.NumberFormat('en-US', { style: 'currency' })` without a `currency` option throws `TypeError: Currency code is required with currency style`. If the currency companion column is null or missing in a row, the formatter crashes.
**Why it happens:** D-16 says currency comes from a companion column. Some rows may have null currency codes.
**How to avoid:** The formatting utility must handle null/undefined currency gracefully -- fall back to plain number format with a warning indicator, not crash. Validate currency codes against ISO 4217 before passing to `Intl.NumberFormat`.
**Warning signs:** Grid cells showing "Error" or blank for rows with missing currency data.

### Pitfall 6: Not Preserving Cross-Filter and Drill-Down Components
**What goes wrong:** The dead code audit (D-17/D-18) deletes `filter-bar.tsx`, `kpi-row.tsx`, and `chart-grid.tsx`. But the audit also catches `cross-filter-bar.tsx` and `drill-breadcrumb.tsx` as "legacy" because they reference legacy types. These are NOT dead code -- they contain logic needed for Phase 2.
**Why it happens:** Over-zealous grep-based dead code detection. These components may not be currently imported in the active code path, but they are intentionally preserved for Phase 2 porting.
**How to avoid:** D-18 explicitly says "Preserve cross-filter and drill-down logic from legacy code for porting in Phase 2." The audit must distinguish between "truly dead" (would crash, serves no purpose) and "dormant" (working code awaiting integration). `cross-filter-bar.tsx`, `drill-breadcrumb.tsx`, and the cross-filter/drill-down logic in `filter-store.ts` and `drill-store.ts` are dormant, not dead.
**Warning signs:** Phase 2 planning discovers that cross-filter UI components need to be rebuilt from scratch.

## Code Examples

### Centralized Number Formatter (frontend/src/lib/formatters.ts)

```typescript
// Verified: Intl.NumberFormat API supports all required features
// See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat

interface FormatNumberOptions {
  type: 'number' | 'currency' | 'percentage' | 'decimal'
  decimals?: number
  abbreviate?: boolean
  currencyCode?: string       // ISO 4217 code from companion column
}

export function formatValue(value: number, options: FormatNumberOptions): string {
  const { type, decimals, abbreviate, currencyCode } = options

  if (type === 'currency') {
    if (!currencyCode) {
      // Fallback: format as plain number when currency code is missing
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
        notation: abbreviate ? 'compact' : 'standard',
      }).format(value)
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimals ?? 2,
      maximumFractionDigits: decimals ?? 2,
      notation: abbreviate ? 'compact' : 'standard',
    }).format(value)
  }

  if (type === 'percentage') {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimals ?? 1,
      maximumFractionDigits: decimals ?? 1,
    }).format(value / 100)  // Intl.NumberFormat percent style expects 0.55 for 55%
  }

  // 'number' or 'decimal'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: type === 'decimal' ? (decimals ?? 2) : 0,
    maximumFractionDigits: type === 'decimal' ? (decimals ?? 2) : (decimals ?? 0),
    notation: abbreviate ? 'compact' : 'standard',
  }).format(value)
}

export function formatValueFull(value: number, options: FormatNumberOptions): string {
  // Always full precision -- for hover tooltip on abbreviated KPIs
  return formatValue(value, { ...options, abbreviate: false })
}
```

### Async Session Dependency (backend)

```python
# backend/app/core/dependencies.py (additions)
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.engine import async_session_factory

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
```

### Structured Error Handling in API Endpoints

```python
# BEFORE (current pattern -- WRONG):
@router.get("")
async def list_charts(superset: SupersetDep):
    if superset:
        try:
            raw = await superset.list_charts()
            return [...]
        except Exception:
            pass          # <-- SWALLOWS THE ERROR
    return MOCK_CHARTS    # <-- RETURNS FAKE DATA

# AFTER (correct pattern):
@router.get("")
async def list_charts(superset: SupersetDep):
    if not superset:
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is not connected"}
        )
    try:
        raw = await superset.list_charts()
        return [...]
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is temporarily unavailable"}
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail={"error": "superset_error", "message": f"Query engine returned error: {e.response.status_code}"}
        )
```

### Frontend Error State Component

```tsx
// Pattern for per-component error handling with TanStack Query
// Source: existing ErrorBoundary + Sonner integration

function ChartErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const apiError = error instanceof ApiError ? error : null

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div>
        <p className="text-sm font-medium">Unable to load data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {apiError?.userMessage ?? 'An unexpected error occurred'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 size-3.5" />
        Retry
      </Button>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQLAlchemy 1.x sync sessions | SQLAlchemy 2.0 async sessions with asyncpg | SQLAlchemy 2.0 (Jan 2023) | Native async support, mapped_column syntax, improved typing |
| Alembic sync migrations | Alembic async template (`-t async`) | Alembic 1.12+ (2023) | `async_engine_from_config` in env.py enables asyncpg driver |
| `toFixed()` / `toLocaleString()` for currency | `Intl.NumberFormat` with `notation: 'compact'` | Compact notation: Chrome 77+ (2019) | Handles abbreviation, currency codes, locale all in one API |
| Superset unpinned | Pin exact version | Always recommended | Prevents silent API breakage between versions |

**Deprecated/outdated:**
- `framer-motion` import path: Use `motion/react` instead (already correct in codebase)
- SQLAlchemy `declarative_base()`: Use `DeclarativeBase` class (SQLAlchemy 2.0 style)
- Alembic `context.configure(url=...)`: Use `async_engine_from_config` for async

## Open Questions

1. **Superset 6.0.0 vs 6.0.1 pin decision**
   - What we know: The venv has Superset 6.0.0 installed. 6.0.1rc1 exists (Feb 2026). The Docker image installs `apache-superset` without pinning.
   - What's unclear: Whether 6.0.1 is GA yet or still RC. Whether there are breaking changes between 6.0.0 and 6.0.1.
   - Recommendation: Pin to `apache-superset==6.0.0` (the known-working version) in both `requirements.txt` and the Superset `Dockerfile`. Upgrade to 6.0.1 when it reaches GA, after testing.

2. **RecViz DB URL configuration**
   - What we know: The existing `Settings` class has `recon_db_url` for the recon data PostgreSQL. RecViz entities will live in the Superset metadata database (`superset_meta`).
   - What's unclear: Should RecViz entities use a separate database or co-locate with Superset metadata?
   - Recommendation: Co-locate in `superset_meta` per D-06 (same PostgreSQL instance). Add `recviz_db_url` setting pointing to `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta`. The `recviz_` table prefix prevents collisions. This avoids needing a second database.

3. **Seed data scope**
   - What we know: Mock data has 1M transactions, 150K breaks, daily metrics, counterparties. The PostgreSQL `recon_data` database already exists (created by `docker/init-db.sql`).
   - What's unclear: Exact seed data volume needed for development.
   - Recommendation: Create seed SQL that populates ~10K transactions, ~2K breaks, and supporting dimension data. Enough for realistic dashboards, small enough for fast Docker startup. This goes into `docker/seed-recon-data.sql` and is mounted into the PostgreSQL container.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | PostgreSQL + Redis + Superset | Yes | 29.2.0 | -- |
| Docker Compose | Multi-container orchestration | Yes | v5.0.2 | -- |
| Python 3.12 | Backend runtime | Yes | 3.12.12 | -- |
| Node.js | Frontend build | Yes | v24.13.0 | -- |
| pnpm | Frontend package manager | Yes | 10.29.2 | -- |
| PostgreSQL (Docker) | Data storage | Yes (via Docker) | 16-alpine | -- |
| Redis (Docker) | Caching | Yes (via Docker) | 7-alpine | -- |
| asyncpg | Async PG driver | Not installed | -- | Must install: `pip install asyncpg==0.31.0` |
| SQLAlchemy 2.0 | Async ORM | Not installed (1.4.54 in venv) | -- | Must install: `pip install sqlalchemy[asyncio]==2.0.49` |
| Alembic | Migrations | Installed | 1.18.3 | Upgrade to 1.18.4 |

**Missing dependencies with no fallback:**
- asyncpg: Must be installed for async PostgreSQL access
- SQLAlchemy 2.0: Must be upgraded from 1.4 for async support (venv upgrade, not system)

**Missing dependencies with fallback:**
- None

**Note on SQLAlchemy version conflict:** The venv has SQLAlchemy 1.4.54 (Superset dependency). RecViz needs SQLAlchemy 2.0+. Since Superset runs in Docker (separate Python env), upgrading the local venv to SQLAlchemy 2.0 is safe for RecViz development. The Superset Docker image has its own SQLAlchemy 1.4. If Superset is ever run natively (not in Docker), this becomes a conflict -- but D-04 establishes Docker Compose as required for local dev.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) / vitest (frontend) -- neither configured yet |
| Config file | None -- Wave 0 must create `backend/pytest.ini` and `frontend/vitest.config.ts` |
| Quick run command | `pytest backend/tests/ -x --timeout=30` (backend), `pnpm vitest run --reporter=verbose` (frontend) |
| Full suite command | `pytest backend/tests/ --timeout=60` (backend), `pnpm vitest run` (frontend) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | Dashboard configs load from DB, save to DB | integration | `pytest backend/tests/test_config_store.py -x` | No -- Wave 0 |
| INFR-02 | Schema migration runs; old config loads through migration pipeline | unit | `pytest backend/tests/test_config_migrator.py -x` | No -- Wave 0 |
| INFR-03 | Superset client authenticates, handles CSRF, retries on 401 | unit (mocked httpx) | `pytest backend/tests/test_superset_client.py -x` | No -- Wave 0 |
| INFR-04 | API endpoints return HTTP errors (not mock data) when Superset is down | integration | `pytest backend/tests/test_api_error_handling.py -x` | No -- Wave 0 |
| INFR-05 | formatValue produces correct output for all format types | unit | `pnpm vitest run src/lib/formatters.test.ts` | No -- Wave 0 |
| INFR-06 | Dead code files deleted; build succeeds; no orphaned imports | smoke | `cd frontend && pnpm build` | N/A (build command) |

### Sampling Rate
- **Per task commit:** `pytest backend/tests/ -x --timeout=30` + `cd frontend && pnpm build`
- **Per wave merge:** Full backend test suite + frontend build + type check
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/conftest.py` -- shared fixtures (async session, test client, mock Superset)
- [ ] `backend/pytest.ini` or `pyproject.toml [tool.pytest.ini_options]` -- pytest config with asyncio mode
- [ ] `frontend/vitest.config.ts` -- Vitest configuration for frontend unit tests
- [ ] `pip install pytest pytest-asyncio httpx[test]` -- test dependencies
- [ ] `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom` -- frontend test deps

## Existing Code Inventory (Affected Files)

### Files to DELETE
| File | Reason |
|------|--------|
| `backend/app/mock_data.py` | D-02: All mock data constants |
| `backend/app/config/seed/seed.db` | D-04: SQLite seed database (if exists) |
| `frontend/src/components/dashboard/filter-bar.tsx` | D-17: Dead code, zero imports |
| `frontend/src/components/dashboard/kpi-row.tsx` | D-17: Dead code, zero imports |
| `frontend/src/components/dashboard/chart-grid.tsx` | D-17: Dead code, zero imports |

### Files to MODIFY (mock data removal)
| File | Mock Usage | Change |
|------|-----------|--------|
| `backend/app/api/charts.py` | `MOCK_CHARTS`, `MOCK_CHART_DATA` | Remove import, replace `except: pass; return MOCK_*` with `raise HTTPException(502/503)` |
| `backend/app/api/custom.py` | `MOCK_KPI`, `MOCK_COUNTERPARTIES` | Remove mock fallbacks, proper error responses |
| `backend/app/api/sql.py` | `MOCK_DATABASES`, `MOCK_BREAK_ROWS`, `_mock_execute()` | Remove mock SQL executor, return errors when Superset unavailable |
| `backend/app/api/search.py` | `MOCK_CHARTS`, `MOCK_DASHBOARDS`, `MOCK_DATASETS` | Remove mock search results |
| `backend/app/api/datasets.py` | `MOCK_DATASETS` | Remove mock datasets |
| `backend/app/api/databases.py` | `MOCK_DATABASES`, `MOCK_DATABASE_DATASETS`, `_mock_databases`, `_mock_next_id` | Remove in-memory mock store |

### Files to MODIFY (config persistence)
| File | Current | Change |
|------|---------|--------|
| `backend/app/services/config_store.py` | Reads JSON files from disk | Rewrite to query PostgreSQL via AsyncSession |
| `backend/app/core/dependencies.py` | Returns `ConfigStore` from app state | Add `DbSessionDep`, update `ConfigStoreDep` to use session |
| `backend/app/main.py` | Creates `ConfigStore()` at startup | Initialize async engine, run Alembic migrations on startup (or verify) |
| `backend/app/config.py` | No RecViz DB URL | Add `recviz_db_url` setting for asyncpg connection |
| `backend/app/config/databases.json` | SQLite URIs | Replace with PostgreSQL URIs |
| `backend/app/api/dashboards.py` | `config_store.get_dashboard()` (sync) | `await config_store.get_dashboard()` (async) |
| `backend/app/api/data_sources.py` | Uses QueryEngine with ConfigStore (sync) | QueryEngine must get config from async ConfigStore |
| `backend/requirements.txt` | No SQLAlchemy 2.0, no asyncpg, unpinned Superset | Add deps, pin Superset |

### Files to CREATE
| File | Purpose |
|------|---------|
| `backend/app/db/__init__.py` | Package init |
| `backend/app/db/engine.py` | Async engine + session factory |
| `backend/app/db/base.py` | DeclarativeBase |
| `backend/app/db/models/__init__.py` | Model exports for Alembic |
| `backend/app/db/models/dashboard.py` | RecvizDashboard SQLAlchemy model |
| `backend/app/db/models/data_source.py` | RecvizDataSource SQLAlchemy model |
| `backend/app/services/config_migrator.py` | Schema version migration pipeline |
| `backend/migrations/` | Alembic directory (via `alembic init -t async`) |
| `docker/seed-recon-data.sql` | PostgreSQL seed data for development |
| `docker/seed-recviz-configs.sql` | Import existing JSON configs as initial DB rows |
| `frontend/src/lib/formatters.ts` | Centralized number formatting utility |
| `frontend/src/components/shared/query-error-state.tsx` | Reusable error state for data components |

### Files to PRESERVE (NOT dead code)
| File | Reason |
|------|--------|
| `frontend/src/components/dashboard/cross-filter-bar.tsx` | D-18: Needed for Phase 2 porting |
| `frontend/src/components/dashboard/drill-breadcrumb.tsx` | D-18: Needed for Phase 2 porting |
| `frontend/src/components/dashboard/chart-panel.tsx` | Active: used by config-chart-grid |
| `frontend/src/components/dashboard/kpi-card.tsx` | Active: used by config-kpi-row |
| `frontend/src/stores/filter-store.ts` | Active: cross-filter logic used by config-filter-bar |
| `frontend/src/stores/drill-store.ts` | Dormant: drill-down state for Phase 2 |

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: All files read directly from the repository
- `backend/app/services/config_store.py` -- current ConfigStore interface (4 methods)
- `backend/app/services/superset_client.py` -- current SupersetClient (auth, CSRF, retry)
- `backend/app/mock_data.py` -- all mock data constants and their consumers
- `backend/app/api/*.py` -- all 9 API endpoint files with mock fallback patterns
- `backend/app/models/dashboard_config.py` -- existing Pydantic models for dashboard config
- `docker-compose.yml` -- existing PostgreSQL 16 + Redis 7 + Superset infrastructure
- `.planning/research/PITFALLS.md` -- Superset CSRF, mock data, schema versioning pitfalls
- `.planning/research/ARCHITECTURE.md` -- Grafana-style JSONB config persistence pattern

### Secondary (MEDIUM confidence)
- [SQLAlchemy async + asyncpg setup](https://berkkaraal.com/blog/2024/09/19/setup-fastapi-project-with-async-sqlalchemy-2-alembic-postgresql-and-docker/) -- FastAPI + async SQLAlchemy + Alembic + asyncpg pattern
- [Alembic async template](https://dev.to/matib/alembic-with-async-sqlalchemy-1ga) -- `alembic init -t async` setup
- [apache-superset on PyPI](https://pypi.org/project/apache-superset/) -- Version 6.0.0 confirmed as latest stable
- [Superset SQLAlchemy compatibility](https://github.com/apache/superset/discussions/31023) -- version compatibility discussion

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified against PyPI/npm; versions confirmed via local install check
- Architecture: HIGH -- patterns derived from existing codebase structure and established FastAPI+SQLAlchemy patterns
- Pitfalls: HIGH -- based on direct codebase analysis (mock data pattern counted in 9 files) and documented Superset issues
- Formatting: HIGH -- `Intl.NumberFormat` API is stable and well-documented; all required features verified against MDN

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable domain -- no fast-moving dependencies)
