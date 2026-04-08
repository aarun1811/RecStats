# Project Research Summary

**Project:** RecViz Dashboard Builder
**Domain:** Internal BI/visualization platform for financial reconciliation (replacing Tableau/Qlik)
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

RecViz is a brownfield evolution of an existing reconciliation visualization platform into a self-service dashboard builder. The existing codebase already handles rendering dashboards from JSON config, querying data via Apache Superset as a headless engine, and displaying results through AG Grid and AG Charts. The core architectural insight is that the dashboard builder is a **config authoring UI** -- it produces the same DashboardConfig structure that the renderer already consumes. This means the builder is an additive layer, not a rewrite. The critical path runs through: database-backed config persistence, dataset metadata with column roles, a drag-and-drop layout editor (react-grid-layout v2), and a chart configurator that maps dataset columns to chart axes. Cross-filtering and drill-down -- the two most expected interactive features -- already have partial implementations in legacy code that must be ported to the config-driven system before the builder can configure them.

The recommended approach is to fix foundational defects first (mock data fallback, financial number formatting, Superset version pinning), then evolve the renderer to support cross-filtering and drill-down, then build the dataset management layer for dev teams, and finally deliver the builder UI for business users. This ordering respects strict dependencies: the builder cannot configure features the renderer does not support, and charts cannot be built without rich dataset metadata. The stack additions are minimal and high-confidence: react-grid-layout v2 for layout, react-hook-form + Zod for chart configuration forms, zundo + immer for undo/redo, SQLAlchemy + Alembic for config persistence.

The key risks are: (1) client-side cross-filtering failing at production scale on million-row Oracle datasets -- mitigated by a hybrid strategy with a configurable row threshold; (2) dashboard config schema breaking saved dashboards as the product evolves -- mitigated by versioned schemas with migration pipelines from day one; (3) scope creep toward Tableau feature parity -- mitigated by a template-first approach and explicit feature boundaries. The Superset integration requires immediate hardening (version pinning, CSRF handling, adapter layer) before building new features that depend on it.

## Key Findings

### Recommended Stack

The existing core stack (React 19, Vite, TypeScript, Shadcn/ui, AG Grid/Charts, TanStack Router/Query, Zustand, FastAPI, Superset, Redis, PostgreSQL) is established and not changing. Research focused on additions needed for the dashboard builder experience.

**New frontend dependencies:**
- **react-grid-layout v2.2.3**: Dashboard layout editor (drag, drop, resize on 12-column grid) -- industry standard used by Grafana, 1.3M+ weekly downloads, v2 is a full TypeScript rewrite with hooks API
- **react-hook-form 7.72.1 + Zod 4.3.6**: Chart builder configuration forms -- handles complex nested forms (chart type, column mapping, appearance, filters) with schema validation
- **zundo 2.3.0 + immer 11.1.4**: Undo/redo for builder operations -- plugs directly into Zustand, essential for builder UX where users expect Ctrl+Z
- **nanoid 5.1.7**: Unique IDs for new panels/widgets -- tiny, URL-friendly IDs for builder-created elements
- **react-colorful 5.6.1**: Color picker for chart series customization -- 2.8kB, zero-dependency, works with Shadcn Popover

**New backend dependencies:**
- **SQLAlchemy 2.0 (async) + Alembic**: ORM and migrations for dashboard/dataset config persistence -- replaces JSON files on disk, enables CRUD, versioning, draft/publish states

**Explicitly rejected:** dnd-kit (stalled maintenance), Gridstack.js (no React wrapper), Formik (abandoned), TanStack Form (too simple for builder), react-color (bloated), axios (project uses native fetch).

### Expected Features

**Must have (table stakes -- P1):**
- Chart builder: dataset-to-chart pipeline (pick dataset, select columns, choose chart type, preview)
- Dashboard layout editor: grid-based drag-and-drop with snap and resize
- Dataset management UI (dev-facing): SQL editor, column metadata, filter mappings
- Cross-filtering: click chart element to filter all others (zero latency, client-side)
- Drill-down: aggregated -> breakdown -> detail rows with breadcrumb navigation
- Save/load dashboards to database with CRUD
- Global filter bar (configurable per dashboard)
- Chart/grid export (PNG, CSV, Excel)
- Fullscreen chart view, manual refresh, auto-refresh

**Should have (differentiators -- P2):**
- Dashboard templates for reconciliation (breaks summary, SLA, aging, match rate, volume)
- Recon-specific KPI library (break count, match rate %, SLA adherence, aging distribution)
- Saved views / personal bookmarks with URL sharing
- Conditional formatting with threshold rules for grids and KPIs
- Cross-filter visual state (Qlik-style dimming of excluded items)
- Inline chart type switching without entering edit mode

**Defer (v2+):**
- Multi-dashboard overview (portfolio view across recons)
- PDF/Excel dashboard export
- Scheduled report delivery
- RBAC / row-level security
- Alerting / threshold notifications

### Architecture Approach

The architecture adds a design-time layer (builder) on top of the existing runtime layer (renderer). The foundational pattern is **Config-as-Contract**: the DashboardConfig JSON schema is the contract between builder (producer) and renderer (consumer). Both builder preview and production view use the same renderer -- no parallel rendering paths. The schema evolves backward-compatibly: existing "flow" layout dashboards continue to work, new builder dashboards use a "grid" layout type powered by react-grid-layout.

**Major components:**
1. **Dataset Manager** (dev-team tool) -- SQL editor, column metadata with roles (dimension/measure/temporal), filter mappings, validation. Produces DatasetConfig objects that business users consume.
2. **Dashboard Builder** (business user tool) -- Layout editor (react-grid-layout canvas), widget palette, chart/KPI/grid configurators, cross-filter/drill-down rule editor. Produces DashboardConfig objects.
3. **Dashboard Renderer** (existing, evolved) -- Renders DashboardConfig into interactive UI. Needs cross-filtering, drill-down, and chart panel features ported from legacy code. Accepts `mode` prop for view vs. builder preview.
4. **Config Persistence Layer** (new) -- SQLAlchemy ORM replacing JSON files. Dashboards table + dashboard_versions table. Draft/published lifecycle. CRUD API via FastAPI.
5. **Widget Registry** -- Maps widget `kind` strings to React components, configurator panels, and default configs. New widget types are added by registering, not modifying switch statements.

### Critical Pitfalls

1. **Silent mock data fallback masking production failures** -- Every backend route returns hardcoded mock data on any exception (22 instances). Analysts could see fabricated financial numbers. Fix: remove all mock fallbacks immediately, return HTTP 502/503, move mocks behind explicit `MOCK_MODE` env var. Address in Phase 1.

2. **Client-side cross-filtering on million-row datasets** -- Current design fetches rows to browser for filtering. Works at demo scale, collapses at production scale (memory exhaustion, stale aggregates). Fix: hybrid strategy -- client-side for <50K rows, backend query with debounce for larger datasets. Address before building cross-filter UI.

3. **Dashboard config schema without versioning** -- As the product evolves, saved dashboards break silently when schema changes. Fix: add `schemaVersion` field from day one, build migration pipeline (v1->v2->...->vN), validate with Zod/Pydantic on load. Address in builder foundation.

4. **N+1 query pattern on dashboard load** -- Each chart/KPI triggers a separate API call (11+ per dashboard). With Oracle network latency, load times balloon to 5-10s. Fix: batch queries by data source, add dashboard-level prefetch endpoint, progressive loading (KPIs first). Address before builder ships.

5. **Superset API version coupling** -- Unpinned Superset version means `pip install` can silently break the API contract. Fix: pin exact version, build adapter layer for response parsing, integration tests for all 14 consumed endpoints. Address immediately.

6. **Financial data precision errors** -- JavaScript floating-point produces visible rounding errors on currency values. In reconciliation, a 1-cent discrepancy triggers investigation. Fix: all aggregation in database, `Intl.NumberFormat` for display, shared formatting utilities enforced across all components. Address in Phase 1.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation Cleanup and Renderer Evolution
**Rationale:** The existing codebase has critical defects (mock data fallback, no number formatting, unpinned Superset) that must be fixed before building new features. Additionally, the renderer must support cross-filtering and drill-down before the builder can configure them -- these are the two most expected interactive features from Tableau/Qlik users.
**Delivers:** A production-hardened renderer with cross-filtering, drill-down, chart panel features (export, fullscreen), database-backed config persistence, and financial number formatting utilities.
**Addresses (FEATURES.md):** Cross-filtering, drill-down, chart export (PNG/CSV), grid export, fullscreen chart view, manual refresh.
**Avoids (PITFALLS.md):** Mock data masking failures (Pitfall 5), financial precision errors (Pitfall 10), Superset version coupling (Pitfall 2), CSRF brittleness (Pitfall 8).

### Phase 2: Dataset Management Layer
**Rationale:** The chart builder cannot function without rich dataset metadata. Business users need to see friendly column names, understand which columns are dimensions vs. measures, and pick from a curated catalog. This is a dev-team tool that must be built and populated before the builder UI exists.
**Delivers:** Dataset CRUD API, column metadata with roles (dimension/measure/temporal), dataset manager UI (SQL editor, column editor, validation), column introspection via Superset.
**Addresses (FEATURES.md):** Dataset management UI, column metadata/friendly names.
**Uses (STACK.md):** SQLAlchemy 2.0 (dataset persistence), Monaco editor (SQL editing, already installed).

### Phase 3: Dashboard Builder Core
**Rationale:** With datasets available and the renderer supporting all interactive features, the builder can be built. This is the capstone phase -- it depends on both prior phases. The builder produces DashboardConfig objects that the existing renderer already consumes.
**Delivers:** Layout editor (react-grid-layout canvas), widget palette, chart configurator (dataset picker -> column mapper -> chart type picker -> preview), KPI configurator, filter configurator, builder store with undo/redo, save/publish workflow.
**Addresses (FEATURES.md):** Chart builder, dashboard layout editor, configurable filter bar, save/load dashboards, KPI card builder.
**Uses (STACK.md):** react-grid-layout v2, react-hook-form + Zod, zundo + immer, nanoid, react-colorful.
**Avoids (PITFALLS.md):** Config schema without versioning (Pitfall 3), builder scope creep (Pitfall 6), layout persistence without undo (Pitfall 9).

### Phase 4: Dashboard Rendering Optimization
**Rationale:** Once users start building dashboards with 10-15 panels, the N+1 query pattern becomes the dominant UX issue. This must be addressed before widespread adoption. Also includes query performance tuning for Oracle production deployment.
**Delivers:** Dashboard-level batch data endpoint, query deduplication via TanStack Query keys, progressive loading (KPIs -> charts -> grid), Superset Redis cache tuning, Oracle connection pool optimization, IntersectionObserver for off-screen chart deferral.
**Addresses (FEATURES.md):** Auto-refresh (configurable), progressive loading.
**Avoids (PITFALLS.md):** N+1 query pattern (Pitfall 4), Oracle query performance (Pitfall 7).

### Phase 5: Advanced Builder Features and Templates
**Rationale:** With the core builder working and performance optimized, add the features that differentiate RecViz from generic BI tools. Templates are the biggest value-add -- they reduce time-to-first-dashboard from hours to minutes and embed reconciliation domain expertise.
**Delivers:** Dashboard templates (5-8 recon-specific: breaks summary, SLA, aging, match rate, volume, operational summary), cross-filter rule configurator UI, drill-down level configurator UI, saved views with URL sharing, conditional formatting for grids and KPIs, inline chart type switching.
**Addresses (FEATURES.md):** Dashboard templates, recon KPI library, saved views, conditional formatting, cross-filter visual state, inline chart type switching, shareable URLs.

### Phase 6: Export, Polish, and Production Readiness
**Rationale:** Final phase before broad rollout. Focuses on the features that matter for daily operational use: dashboard PDF export, data freshness indicators, embed mode hardening, and authentication groundwork.
**Delivers:** Dashboard PDF export (WeasyPrint), data freshness indicator, embed mode improvements, dashboard categorization/search for scale, authentication middleware (API key minimum).
**Addresses (FEATURES.md):** PDF dashboard export, multi-dashboard overview, RBAC groundwork.

### Phase Ordering Rationale

- **Phases 1-2-3 form a strict dependency chain:** The builder (Phase 3) cannot configure features the renderer does not support (Phase 1), and the chart configurator cannot offer column-to-axis mapping without dataset metadata (Phase 2).
- **Phase 4 after Phase 3:** Optimization is driven by real builder output. Until users create multi-panel dashboards, the N+1 problem is theoretical. But it must be addressed before widespread adoption.
- **Phase 5 after Phase 3-4:** Templates and advanced features enhance the builder. The core loop (place -> configure -> preview -> save) must work first.
- **Phase 6 is decoupled:** Export and polish can happen in parallel with Phase 5 if resources allow.
- **Foundation cleanup (Phase 1) is non-negotiable first:** Mock data fallback, financial precision, and Superset hardening are pre-existing defects. Building new features on top of mock-data-masking-errors is building on sand.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Cross-filtering port):** The hybrid client/server cross-filter strategy needs careful API design. Research the exact data flow, query parameterization, and threshold configuration.
- **Phase 2 (Dataset management):** Column role auto-detection heuristics (when is a string column a dimension vs. identifier?) need validation against real Oracle schema shapes.
- **Phase 3 (Builder core):** react-grid-layout v2 integration patterns, widget registry design, and builder store undo/redo architecture would benefit from prototyping.
- **Phase 5 (Templates):** Recon-specific template design requires domain expert input -- which KPIs, which visualizations, which default filters for each recon pattern.

Phases with standard patterns (skip deep research):
- **Phase 4 (Optimization):** Well-documented patterns: batch endpoints, TanStack Query key deduplication, progressive loading with IntersectionObserver, Redis cache tuning.
- **Phase 6 (Export/Polish):** WeasyPrint PDF generation is well-documented. Authentication middleware is standard FastAPI.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified on npm with exact versions, peer dependencies confirmed compatible with React 19 / Zustand 5. Brownfield project -- most stack is already installed and running. |
| Features | HIGH | Primary sources: Tableau/Qlik official docs, BI buyer guides, reconciliation domain analysis. Feature prioritization aligned with industry table stakes. Competitor analysis covers 4 major BI tools. |
| Architecture | HIGH | Existing codebase thoroughly documented (CODEBASE_GUIDE.md). Architecture follows established patterns from Grafana, Metabase, Superset. Config-as-contract is proven. |
| Pitfalls | HIGH | Combines codebase-specific analysis (22 mock data instances, N+1 queries, unpinned Superset) with industry patterns (schema versioning, cross-filter scaling, Oracle performance). All pitfalls have concrete prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Authentication strategy:** No auth exists on any endpoint. The research identifies this as a Phase 6 concern, but the exact approach (SSO/SAML/OIDC vs. API keys vs. both) needs a decision from stakeholders before implementation.
- **Oracle production performance:** Dev uses PostgreSQL with seed data. Oracle production performance characteristics are estimated, not measured. Load testing with production-scale data is essential before the builder ships (recommended during Phase 4).
- **Superset version selection:** Research recommends pinning but does not specify which version. The exact version to pin (latest stable vs. current installed) needs verification during Phase 1.
- **Multi-user concurrent editing:** Research recommends optimistic locking (version counter) but does not design the full conflict resolution UX. This needs design attention during Phase 3 builder planning.
- **Elasticsearch dataset integration:** The dataset manager needs to support ES-backed datasets for search/realtime use cases. The exact ES aggregation-to-chart mapping is not covered in research.

## Sources

### Primary (HIGH confidence)
- [react-grid-layout GitHub & npm](https://github.com/react-grid-layout/react-grid-layout) -- v2.2.3 verified, TypeScript rewrite, hooks API
- [Grafana Dashboard JSON Model & Schema v2](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/) -- layout persistence, panel structure, versioning patterns
- [Tableau Dashboard Creation & Filter Actions](https://help.tableau.com/current/pro/desktop/en-us/dashboards_create.htm) -- feature expectations, cross-filtering model, layout patterns
- [Qlik Associative Selection Model](https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Selections/associative-selection-model.htm) -- green/white/gray states, cross-filter UX
- [Apache Superset REST API & Caching Docs](https://superset.apache.org/docs/api/) -- API endpoints, cache config, CSRF behavior
- [Superset GitHub Issues](https://github.com/apache/superset/) -- CSRF (#8382, #32751), Oracle performance (#8568), API breaking changes (UPDATING.md)
- [react-hook-form](https://react-hook-form.com/) -- complex nested form patterns, field arrays, resolver integration

### Secondary (MEDIUM confidence)
- [ilert: Why React-Grid-Layout Was Our Best Choice](https://www.ilert.com/blog/building-interactive-dashboards-why-react-grid-layout-was-our-best-choice) -- production case study
- [Power BI Conditional Formatting & Bookmarks](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-conditional-table-formatting) -- saved views, formatting patterns
- [Reconciliation Dashboard Patterns](https://www.osfin.ai/blog/reconciliation-dashboard) -- domain-specific KPIs, recon visualizations
- [NeoXam Reconciliation Dashboards](https://www.neoxam.com/aro/reconciliation-dashboards-reporting-audit-trails/) -- breaks, aging, SLA monitoring
- [SmartStream TLM Reconciliations](https://www.smartstream-stp.com/resources/tlm-reconciliations-premium/) -- TLM View dashboard features

### Tertiary (LOW confidence)
- [Dashboard Software Buyer's Guide 2026](https://www.basedash.com/blog/dashboard-software-the-complete-guide-for-modern-teams-in-2026) -- market trends, AI features (deferred)
- [BI Failure Rates](https://designingforanalytics.com/resources/failure-rates-for-analytics-bi-iot-and-big-data-projects-85-yikes/) -- scope creep risk calibration

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
