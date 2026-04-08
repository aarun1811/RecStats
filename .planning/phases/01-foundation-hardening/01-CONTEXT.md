# Phase 1: Foundation Hardening - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the existing codebase production-ready: remove all mock data fallbacks so real errors surface, clean up legacy dead code, add configurable financial number formatting, pin and harden Superset integration, and migrate dashboard config persistence from JSON files on disk to a PostgreSQL database with schema versioning via Alembic.

</domain>

<decisions>
## Implementation Decisions

### Mock Data Removal
- **D-01:** Remove ALL mock data fallbacks from all 9 API endpoints. No fake data, ever — not even in development. When Superset is unavailable or a query fails, return proper HTTP errors (503, 500).
- **D-02:** Delete `backend/app/mock_data.py` entirely and all references to MOCK_* constants across the API layer.
- **D-03:** For local development, seed PostgreSQL with realistic reconciliation data via SQL seed scripts. PostgreSQL replaces the role mock data served.

### SQLite Removal
- **D-04:** Remove SQLite entirely from the project. No SQLite seed databases, no SQLite data sources in `databases.json`. PostgreSQL only — Docker Compose is required for local dev.
- **D-05:** Delete existing SQLite `.db` files and update `databases.json` to reference PostgreSQL data sources.

### Database Persistence
- **D-06:** Store all RecViz entities (dashboards, charts, KPIs, datasets, saved views) in the same PostgreSQL instance that Superset uses for metadata. RecViz tables prefixed with `recviz_` to avoid collisions with Superset's tables.
- **D-07:** Use SQLAlchemy async (with asyncpg driver) for the ORM layer. Alembic for schema migrations.
- **D-08:** Migrate dashboard configs from JSON files on disk (`backend/app/config/dashboards/*.json`, `backend/app/config/data_sources/*.json`) to database rows. The existing `ConfigStore` service gets replaced by database queries.
- **D-09:** Dashboard config schema includes a `version` field from day one. Alembic handles schema evolution. Backward-compatible: existing JSON configs can be imported as initial seed data.

### Error Handling UX
- **D-10:** Toast notification + inline error state on the affected component when a query fails. Sonner toast for the error message, inline error panel with retry button on the component.
- **D-11:** Per-component error isolation. If one chart's Oracle query times out, other charts from different queries still render. No full-dashboard error page.
- **D-12:** Error states show: what went wrong (human-readable), a retry button, and optionally a "details" expandable for technical info.

### Number Formatting
- **D-13:** Create a centralized formatting utility (`frontend/src/lib/formatters.ts`) replacing scattered formatting logic across components.
- **D-14:** Fully configurable formatting with NO hardcoded defaults. Each dataset column's metadata specifies: format type (number/currency/percentage/decimal), decimal precision, whether to abbreviate large numbers, and — for currency columns — which companion column holds the ISO 4217 currency code.
- **D-15:** KPI cards show abbreviated numbers (1.2M, 45.3K) with hover showing full number. Grids show full formatted numbers. All driven by column metadata configuration.
- **D-16:** Currency formatting uses `Intl.NumberFormat` with per-row currency codes. Supports all ISO 4217 codes (USD, EUR, GBP, JPY, etc.). Companion currency column is configurable (looks for configured column name, no assumed default).

### Legacy Code Cleanup
- **D-17:** Delete confirmed dead code files: `filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx` (the non-config-prefixed versions). These are orphaned — zero imports.
- **D-18:** Audit and remove any other dead hooks, stores, or utilities that reference the legacy dashboard system. Preserve cross-filter and drill-down logic from legacy code for porting in Phase 2.

### Superset Hardening
- **D-19:** Pin `apache-superset` to a specific version in `requirements.txt`. Verify CSRF and auth handling work with that pinned version.
- **D-20:** Existing Superset client auth/CSRF/retry logic is solid (token refresh at 25 min, auto-retry on 401). Keep it, test it against the pinned version.

### Claude's Discretion
- SQLAlchemy model design (table structure, relationships, column types) — Claude designs based on the DashboardConfig TypeScript types and research findings
- Alembic migration strategy (single initial migration vs incremental)
- Seed data content and schema (realistic recon data for PostgreSQL)
- Specific Superset version to pin (verify latest stable)
- Error toast styling and animation timing
- Dead code audit methodology (grep for imports, verify unused)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing config system (being replaced)
- `backend/app/services/config_store.py` — Current file-based config loader, understand what it does before replacing
- `backend/app/config/dashboards/tlm-stats.json` — Example dashboard config schema (JSON structure to migrate to DB)
- `backend/app/config/data_sources/` — Data source config files (SQL templates, filter mappings)
- `backend/app/config/databases.json` — Current database connection config (SQLite refs to remove)

### Mock data (being removed)
- `backend/app/mock_data.py` — All mock data constants and their structure
- `backend/app/api/charts.py` — Example of mock fallback pattern in API endpoints

### Superset integration
- `backend/app/services/superset_client.py` — Async Superset client with auth/CSRF/retry logic
- `backend/app/core/config.py` — Settings via pydantic-settings (Superset URL, credentials)

### Frontend formatting (being centralized)
- `frontend/src/components/shared/count-animation.tsx` — Existing formatNumber() function
- `frontend/src/components/grid/cell-renderers/amount-cell.tsx` — Existing currency formatting with Intl.NumberFormat

### Legacy code (being removed)
- `frontend/src/components/dashboard/filter-bar.tsx` — Dead code (non-config version)
- `frontend/src/components/dashboard/kpi-row.tsx` — Dead code
- `frontend/src/components/dashboard/chart-grid.tsx` — Dead code

### Project context
- `.planning/PROJECT.md` — Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — INFR-01 through INFR-06 requirements for this phase
- `.planning/research/PITFALLS.md` — Superset integration gotchas, mock data risks, schema versioning advice
- `.planning/research/ARCHITECTURE.md` — Config persistence patterns, Grafana-style JSONB storage model
- `CLAUDE.md` — Coding conventions, tech stack reference, project structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `superset_client.py`: Solid async client with auth, CSRF, retry. Keep as-is, just pin and test.
- `config_store.py`: Understand its interface — new DB service should expose same methods (get_dashboard, list_dashboards, etc.)
- `count-animation.tsx` formatNumber(): Base logic for the centralized formatter. Extend, don't rewrite.
- `amount-cell.tsx`: Has Intl.NumberFormat currency support. Extract into shared utility.
- Existing `DashboardConfig` Pydantic model: Use as basis for SQLAlchemy model design.

### Established Patterns
- FastAPI dependency injection via `Depends()` for services — new DB service should follow same pattern
- Pydantic v2 models for all request/response validation
- TanStack Query for all frontend data fetching with 5min stale time
- Sonner toast for notifications (already in the app)
- Error boundaries exist in `frontend/src/components/shared/error-boundary.tsx`

### Integration Points
- `backend/app/api/dashboards.py` — Currently reads from ConfigStore, will read from DB
- `backend/app/api/data_sources.py` — Currently reads from ConfigStore, will read from DB
- `backend/app/main.py` — App startup: currently loads ConfigStore, will initialize DB connection
- `frontend/src/lib/api-client.ts` — All API calls go through here, error handling hooks here
- `frontend/src/components/dashboard/dashboard-renderer.tsx` — Main renderer, needs error state per component
- Docker Compose (`infrastructure/docker-compose.yml`) — Add PostgreSQL data seed

</code_context>

<specifics>
## Specific Ideas

- Currency formatting must support per-row currency codes from a companion column — datasets can contain mixed currencies (USD, EUR, GBP, JPY, etc.)
- The companion currency column name is configurable in column metadata, no hardcoded default column names
- All formatting is fully configurable through column metadata — no assumptions about format type, precision, abbreviation, or currency

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-hardening*
*Context gathered: 2026-04-04*
