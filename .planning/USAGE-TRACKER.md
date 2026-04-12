# Usage Tracker

**Purpose:** Accumulates file modifications across all phases. Phase 8 uses this document to identify dead code candidates for the final sweep.

**How to update:** After each phase plan completes, the executor appends an entry to the relevant phase section listing files added, modified, and removed. Files that are modified but whose usage is uncertain should be flagged as `[audit]`.

**Format:**
- **Added** = new file created this phase
- **Modified** = existing file changed this phase
- **Removed** = file deleted this phase
- **[audit]** = usage uncertain, candidate for Phase 8 dead code sweep

---

## Phase 1: Infrastructure Cutover

### Files Added

| File | Plan | Purpose |
|------|------|---------|
| `scripts/seed-oracle.py` | 01-05 | Oracle seed script (2,555 lines, 210k+ rows recon data) |
| `backend/app/migrations/versions/001_initial_oracle_schema.py` | 01-03 | Single Oracle-native migration for all 6 recviz_* tables |
| `.planning/USAGE-TRACKER.md` | 01-06 | This file |

### Files Modified

| File | Plan | Change |
|------|------|--------|
| `backend/app/config.py` | 01-01, 01-06 | Oracle-only config (recon_db_url removed, oracle_client_lib_dir + dsn added) |
| `backend/requirements.txt` | 01-01 | PG deps removed (psycopg2-binary, asyncpg, sqlalchemy[asyncio]) |
| `backend/.env.example` | 01-01, 01-06 | Oracle env vars (RECVIZ_DB_URL, ORACLE_CLIENT_LIB_DIR, RECVIZ_ENCRYPTION_KEY) |
| `backend/app/db/types.py` | 01-01 | OracleJSON (BLOB IS JSON) via TypeDecorator + SchemaType |
| `backend/app/db/base.py` | 01-01 | MetaData naming_convention for deterministic constraint names |
| `backend/app/db/engine.py` | 01-02 | Oracle pool sizing (pool_size=5, max_overflow=5, pool_recycle=1800) |
| `backend/app/main.py` | 01-02 | Thick mode init + startup assertion via v$session_connect_info |
| `backend/app/services/engine_manager.py` | 01-02, 01-05 | Oracle-only, uses build_oracle_engine() helper |
| `backend/app/services/uri_builder.py` | 01-02, 01-05 | Oracle-only connection URI building |
| `backend/app/api/views.py` | 01-02 | async def -> def (3 handlers converted) |
| `backend/app/migrations/alembic.ini` | 01-03, 01-05 | Empty sqlalchemy.url, Oracle-only config |
| `backend/app/migrations/env.py` | 01-03 | Oracle thick mode + connect_args in online mode |
| `frontend/src/index.css` | 01-04 | Mist+Blue oklch palette, --series-1..8, semantic ramps, AG Grid bridge |
| `frontend/src/lib/chart-themes.ts` | 01-04 | CSS var reads + HEX_FALLBACKS for pre-paint safety |
| `frontend/components.json` | 01-04 | baseColor: mist |
| `backend/app/api/databases.py` | 01-05 | PG/Superset references removed |
| `backend/app/api/sql.py` | 01-05 | PG references removed |
| `backend/app/db/models/connection.py` | 01-05, 01-06 | PG refs removed, schema_name made nullable |
| `backend/app/models/database.py` | 01-05 | PG refs removed |
| `backend/app/services/config_store.py` | 01-05 | PG/Superset refs removed |
| `backend/app/services/connection_resolver.py` | 01-05 | PG refs removed |
| `backend/app/services/query_engine.py` | 01-05 | PG refs removed |
| `backend/app/services/query_utils.py` | 01-05 | PG refs removed |
| `backend/tests/test_connection_model.py` | 01-05 | PG refs removed |
| `backend/tests/test_portable_json.py` | 01-05 | PG refs removed |
| `backend/tests/test_query_utils.py` | 01-05 | PG refs removed |
| `backend/tests/test_schema_introspection.py` | 01-05 | PG refs removed |
| `backend/tests/test_test_connection_by_id.py` | 01-05 | PG refs removed |
| `backend/tests/test_uri_builder.py` | 01-05 | PG refs removed |
| `frontend/src/components/datasets/dataset-card.tsx` | 01-05 | PG refs removed |
| `frontend/src/components/datasets/dataset-row.tsx` | 01-05 | PG refs removed |
| `frontend/src/components/explorer/schema-browser.test.tsx` | 01-05 | PG refs removed |
| `frontend/src/components/explorer/query-results.tsx` | 01-06 | BarChart3 import fix |
| `frontend/src/components/settings/data-source-card.tsx` | 01-05 | PG refs removed |
| `frontend/src/components/settings/data-source-sheet.tsx` | 01-05 | PG refs removed |
| `frontend/src/hooks/use-dashboard-kpis.ts` | 01-05 | PG refs removed |
| `frontend/src/types/database.ts` | 01-05 | PG refs removed |

### Files Removed

| File | Plan | Reason |
|------|------|--------|
| `docker-compose.yml` | 01-05 | Docker residue |
| `docker/init-db.sql` | 01-05 | Docker residue |
| `docs/API.md` | 01-05 | Stale docs directory |
| `docs/ARCHITECTURE.md` | 01-05 | Stale docs directory |
| `docs/CODEBASE_GUIDE.md` | 01-05 | Stale docs directory |
| `docs/CONFIGURATION.md` | 01-05 | Stale docs directory |
| `docs/DEPLOYMENT.md` | 01-05 | Stale docs directory |
| `docs/DEVELOPMENT.md` | 01-05 | Stale docs directory |
| `docs/GETTING_STARTED.md` | 01-05 | Stale docs directory |
| `docs/SETUP.md` | 01-05 | Stale docs directory |
| `docs/TESTING.md` | 01-05 | Stale docs directory |
| `docs/plans/RECVIZ_PLAN.md` | 01-05 | Stale docs directory |
| `docs/research/BI_Platform_Market_Analysis_Report.md` | 01-05 | Stale docs directory |
| `docs/superpowers/plans/2026-04-09-rhel-oracle-no-sudo-deployment.md` | 01-05 | Stale docs directory |
| `docs/superpowers/plans/2026-04-11-oracle-rhel-v7-safe.md` | 01-05 | Stale docs directory |
| `docs/superpowers/plans/2026-04-11-ui-fixes-and-cleanup.md` | 01-05 | Stale docs directory |
| `docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md` | 01-05 | Stale docs directory |
| `docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md` | 01-05 | Stale docs directory |
| `scripts/generate-seed-db.py` | 01-05 | PG seed script |
| `scripts/mock-audit.sh` | 01-05 | PG mock script |
| `scripts/seed-postgres.py` | 01-05 | PG seed script |
| `scripts/setup-superset-local.sh` | 01-05 | Superset residue |
| `seed/create_recon_db.py` | 01-05 | PG seed directory |
| `seed/register_superset.py` | 01-05 | Superset residue |
| `seed/register_test_datasets.py` | 01-05 | PG seed directory |
| `backend/app/migrations/versions/001_initial_schema.py` | 01-03 | PG migration |
| `backend/app/migrations/versions/002_add_datasets.py` | 01-03 | PG migration |
| `backend/app/migrations/versions/003_add_charts.py` | 01-03 | PG migration |
| `backend/app/migrations/versions/004_add_kpis.py` | 01-03 | PG migration |
| `backend/app/migrations/versions/005_add_connections_portable_json.py` | 01-03 | PG migration |
| `backend/app/migrations/versions/006_remove_dataset_superset_fields.py` | 01-03 | PG migration |
| `backend/app/migrations/versions/007_dataset_database_id_to_string.py` | 01-03 | PG migration |

### Dead Code Candidates [audit]

| File | Concern | Resolution Phase |
|------|---------|-----------------|
| `backend/app/services/config_store.py` | Reads recviz_data_sources table (broken pipeline, never written post-Superset) | Phase 6 |
| `backend/app/services/config_migrator.py` | Migrates legacy data source configs from Superset era | Phase 6 |
| `PortableJSON` alias in `backend/app/db/types.py` | Grace alias for OracleJSON, to be removed | Phase 8 |
| `backend/tests/test_connection_model.py` | Async-mocked test, no longer valid against sync Oracle | Phase 8 |
| `backend/tests/test_portable_json.py` | Async-mocked test, no longer valid against sync Oracle | Phase 8 |
| `backend/tests/test_query_utils.py` | Async-mocked test, no longer valid against sync Oracle | Phase 8 |
| `backend/tests/test_schema_introspection.py` | Async-mocked test, no longer valid against sync Oracle | Phase 8 |
| `backend/tests/test_test_connection_by_id.py` | Async-mocked test, no longer valid against sync Oracle | Phase 8 |
| `backend/tests/test_uri_builder.py` | Async-mocked test, no longer valid against sync Oracle | Phase 8 |
| `frontend/src/components/explorer/schema-browser.test.tsx` | Test file, tests deferred this milestone | Phase 8 |

---

## Phase 2: Settings Page

### Files Added

| File | Plan | Purpose |
|------|------|---------|
| `frontend/src/stores/display-store.ts` | 02-01 | Zustand store for density + fontSize (CSS var writing, localStorage persistence) |
| `frontend/src/components/settings/theme-preview-card.tsx` | 02-01 | Theme preview card with CSS-drawn mini-mockups (light/dark/system) |
| `frontend/src/components/settings/animated-status-badge.tsx` | 02-02 | Animated status badge with emerald pulse for connected, static dots for others |
| `frontend/src/components/settings/connection-test-area.tsx` | 02-02 | 4-state connection test animation machine (Idle/Testing/Success/Failure) |
| `frontend/src/components/settings/connection-health-header.tsx` | 02-02 | Connection health summary with large status badge + info grid |

### Files Modified

| File | Plan | Change |
|------|------|--------|
| `frontend/src/index.css` | 02-01 | Body font-size/line-height CSS transition rule, form focus ring-2 ring-ring/20 enhancement |
| `frontend/src/routes/_app/settings/index.tsx` | 02-01 | Rewritten: max-w-5xl layout, AnimatePresence tab transitions, ThemePreviewCard, ToggleGroup display controls |
| `frontend/src/components/settings/data-source-card.tsx` | 02-02, 02-03 | AnimatedStatusBadge replacing StatusDot, border-l-2 status color, motion hover lift |
| `frontend/src/components/settings/data-source-row.tsx` | 02-02 | AnimatedStatusBadge replacing StatusDot, border-l-2 status color |
| `frontend/src/components/settings/data-source-sheet.tsx` | 02-02, 02-03 | ConnectionTestArea, ConnectionHealthHeader, stagger animations, cross-fade, unified footer, column badges, blur flash |
| `frontend/src/components/settings/data-sources-tab.tsx` | 02-02 | Responsive grid (grid-cols-2 lg:grid-cols-3) |

### Files Removed

None.

### Dead Code Candidates [audit]

None identified in Phase 2.

## Phase 3: Datasets Page

### Files Added

| File | Plan | Purpose |
|------|------|---------|
| `frontend/src/lib/style-constants.ts` | 03-01 | Shared style maps extracted from data-source-card (backend labels/colors, status styles, column role/type badges) |
| `frontend/src/components/datasets/role-badge-renderer.tsx` | 03-02 | AG Grid cell renderer for color-coded role badges using COLUMN_ROLE_STYLES |
| `frontend/src/components/datasets/type-badge-renderer.tsx` | 03-02 | AG Grid cell renderer for color-coded type badges using COLUMN_TYPE_STYLES |
| `frontend/src/components/datasets/column-header-with-tooltip.tsx` | 03-02 | AG Grid custom header component with info icon tooltip |
| `frontend/src/components/datasets/column-metadata-help-sheet.tsx` | 03-02 | Column metadata reference Sheet with staggered entrance animations |

### Files Modified

| File | Plan | Change |
|------|------|--------|
| `frontend/src/components/datasets/dataset-card.tsx` | 03-01 | Motion hover lift, border-l accent, bg-muted icon container, column role summary pills, stagger entrance |
| `frontend/src/components/datasets/dataset-row.tsx` | 03-01 | Motion hover lift, border-l accent, bg-muted icon container, inline role summary, stagger entrance |
| `frontend/src/components/datasets/dataset-list.tsx` | 03-01 | AnimatePresence crossfade, stagger index passing, animated empty states |
| `frontend/src/routes/_app/datasets/index.tsx` | 03-01 | Staggered page entrance (title + content) |
| `frontend/src/routes/_app/datasets/new.tsx` | 03-01 | Y-slide entrance animation |
| `frontend/src/routes/_app/datasets/$datasetId.edit.tsx` | 03-01 | Y-slide entrance animation |
| `frontend/src/components/settings/data-source-card.tsx` | 03-01 | Local constants removed, imports from style-constants |
| `frontend/src/components/explorer/sql-editor.tsx` | 03-02 | Format SQL button, Code2 icon, border-l-primary accent, run state indicator |
| `frontend/src/components/datasets/dataset-editor.tsx` | 03-02 | Mode badge, section icons, run state machine, execution stats, discard-missing, help sheet, empty state pulse |
| `frontend/src/components/datasets/column-metadata-grid.tsx` | 03-02 | Role/type badge renderers, Tailwind row class tints, header tooltips, strikethrough missing rows |

### Files Removed

None.

### Dead Code Candidates [audit]

None identified in Phase 3.

## Phase 4: Charts Page

*(To be filled by Phase 4 executor)*

## Phase 5: KPIs Page

*(To be filled by Phase 5 executor)*

## Phase 6: Dashboards Page

*(To be filled by Phase 6 executor)*

## Phase 7: Explorer Page

*(To be filled by Phase 7 executor)*

## Phase 8: Alembic Audit + Dead Code Sweep

*(Phase 8 consumes this entire document for the sweep)*
