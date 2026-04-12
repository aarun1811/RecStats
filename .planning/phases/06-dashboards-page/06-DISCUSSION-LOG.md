# Phase 6: Dashboards Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 06-dashboards-page
**Areas discussed:** Pipeline fix, List page polish, Renderer premium treatment, Builder polish, Legacy code audit, Embed route, E2E verification

---

## Pipeline Fix (recviz_data_sources Gap)

### Investigation

Traced the full data pipeline for dashboard rendering:

1. Dashboard config JSON → `charts[].sources[].dataSourceId` → `recviz_data_sources.id`
2. Frontend calls `POST /api/data-sources/{dataSourceId}/query`
3. `ConfigStore.get_data_source()` reads from `recviz_data_sources` table
4. `DataSourceConfig.database_routing.database` = connection name (e.g., "oracle-local")
5. `ConnectionResolver.resolve()` → looks up in `recviz_connections` by name → returns UUID
6. `QueryExecutor` builds engine from connection, runs SQL

**Key finding:** `recviz_data_sources` and `recviz_datasets` are duplicates. The seed script creates paired rows with matching IDs. But `create_managed_dataset()` in `managed_datasets.py` only writes to `recviz_datasets` — never creates a `recviz_data_sources` row. So any dataset created through the UI breaks when used in a dashboard.

**Contrast with chart builder:** The chart builder and chart library cards use `POST /api/sql/execute` with `database_id` + raw `sql` from `recviz_datasets` directly. This path works correctly for all datasets.

| Option | Description | Selected |
|--------|-------------|----------|
| Eliminate recviz_data_sources reads | Rewire ConfigStore to read recviz_datasets + recviz_connections | ✓ |
| Auto-sync both tables | Keep recviz_data_sources, auto-create on dataset CRUD | |
| Other | | |

**User's choice:** Eliminate recviz_data_sources reads
**Notes:** User identified the gap: "when a new data source is added in the settings page, i don't think both the tables are updated. so apart from the seed datasources, for new data source added through UI, things will break"

---

## List Page Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Primary/blue accent for all | All dashboard cards get same primary left border | ✓ |
| Panel composition gradient | Border color varies by dashboard content | |
| User-chosen color | Let users pick accent per dashboard | |

**User's choice:** Primary/blue accent for all (Recommended)
**Notes:** Dashboards are composite entities — per-type color doesn't apply

---

## Legacy Code Audit

| Option | Description | Selected |
|--------|-------------|----------|
| Grep + stale reference cleanup | Just grep and clean orphaned imports | |
| Full store audit | Deep audit of all 4 Zustand stores for dead code | ✓ |
| Minimal — just verify | Confirm files gone, defer rest to Phase 8 | |

**User's choice:** Full store audit

---

## Renderer Polish Level

| Option | Description | Selected |
|--------|-------------|----------|
| Light polish | Fix Superset comment, verify KPI colors, tighten whitespace | |
| Full premium treatment | Section headers, entrance animations, toolbar polish, cross-filter/drill-down UI | ✓ |
| No renderer changes | Focus elsewhere | |

**User's choice:** Full premium treatment
**Notes:** User selected ALL renderer sub-areas: filter bar section header, KPI row cards, chart grid panels, dashboard toolbar, plus cross-filter and drill-down filter configuration UIs.

### Detail Header

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — title + description + metadata | Dashboard name, description, panel counts, last updated, actions | ✓ |
| Keep current minimal header | Just dashboard name + description | |

**User's choice:** Full header treatment with metadata row

---

## Builder Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Light polish | Filter bar animations, picker dialog polish, panel hover states | ✓ |
| Full premium treatment | All above plus RGL animations, drag feedback, save animation | |
| No builder changes | Defer builder polish | |

**User's choice:** Light polish (Recommended)
**Notes:** Builder toolbar and empty state already polished — no changes needed there

---

## Embed Route

| Option | Description | Selected |
|--------|-------------|----------|
| Verify + dark mode param | Verify all URL params + implement ?theme=dark | ✓ |
| Verify only | Just confirm embed renders | |
| Full embed polish | All params + loading skeleton + error boundary + topbar polish | |

**User's choice:** Verify + dark mode param (Recommended)

---

## E2E Verification (User-Initiated)

**User requirement:** "there should be a full E2E actual dashboard creation testing done in ui using playwright MCP to ensure frontend and backend work perfectly in sync"

**Additional note:** "ensure global filter configuration, cross filter configuration and drill down filter configuration is also properly tested"

Full Playwright MCP verification scope: create dashboard → add panels → configure global/cross/drill-down filters → save → view → verify data from Oracle → test all filter types → edit → delete. Both light and dark mode.

---

## Claude's Discretion

- Exact animation timing and easing curves for renderer section entrances
- Section header icon choices for filter bar, KPI row, chart grid
- KPI card trend accent color mapping
- Detail header metadata row layout
- Picker dialog internal layout
- How to build DataSourceConfig.filter_mappings from RecvizDataset

## Deferred Ideas

- Drop recviz_data_sources table — Phase 8
- Seed script update to stop writing recviz_data_sources — Phase 8
- config_migrator.py removal — Phase 8
- RGL drag-and-drop motion feedback — future polish
