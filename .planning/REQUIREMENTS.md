# Requirements: RecViz

**Defined:** 2026-04-04
**Core Value:** Business users can view, interact with, and customize dashboards over reconciliation data without depending on another team.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Source Connectivity

- [x] **DATA-01**: Oracle database fully integrated via Superset — connection pooling, query execution, result caching all working reliably at production scale
- [x] **DATA-02**: Hive database integrated via Superset for historical/batch data queries with appropriate caching for slow queries
- [ ] **DATA-03**: Elasticsearch integrated via Superset (elasticsearch-dbapi for SQL queries) and via sidecar (elasticsearch-py for complex aggregations, nested queries, full-text search)
- [x] **DATA-04**: Database connection management UI for dev team — add, edit, test connections to Oracle/Hive/ES

### Dataset Management (Dev-Facing)

- [x] **DSET-01**: Dev team can create a dataset by writing SQL, naming it, and saving it with column metadata
- [x] **DSET-02**: Each dataset column has configurable metadata: friendly display name, data type (string/number/date/currency), role (dimension/measure/time), default aggregation function, format string
- [x] **DSET-03**: Dev team can test-execute a dataset query from the editor and preview results before publishing
- [x] **DSET-04**: Dev team can edit and delete existing datasets
- [x] **DSET-05**: Datasets are persisted to database (not JSON files on disk)

### Chart Library (Reusable Charts)

- [x] **CHRT-01**: User can create a chart by selecting a dataset, mapping columns to axes/metrics, choosing a chart type, and configuring appearance
- [x] **CHRT-02**: Chart type selector with visual thumbnails showing available types — highlight which types are compatible with selected data shape
- [x] **CHRT-03**: Charts can be saved independently to a chart library with a name and description
- [x] **CHRT-04**: Saved charts are reusable — can be added to multiple dashboards; config change updates everywhere
- [x] **CHRT-05**: AG Charts covers standard types (line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, bullet, box plot, combo)
- [x] **CHRT-06**: ECharts covers exotic types only (Sankey, sunburst, radar, graph/network, gauge, parallel coordinates, funnel)
- [x] **CHRT-07**: User can browse the chart library, search by name, and preview saved charts

### KPI Library

- [x] **KPI-01**: Dev team can define reusable KPI templates with SQL fragments, format rules, and trend indicator logic
- [x] **KPI-02**: Business users can pick KPIs from the library when building dashboards — select metric, configure threshold colors, trend direction
- [x] **KPI-03**: KPI cards display animated counters, trend arrows (up/down with percentage change), and configurable status colors

### Dashboard Builder

- [x] **BLDR-01**: User can create a new dashboard with title and description
- [x] **BLDR-02**: Grid-based layout editor — drag, drop, and resize chart panels, KPI cards, and filter bars on a 12-column grid
- [x] **BLDR-03**: User can add charts to a dashboard by either building a new chart or picking from the chart library
- [x] **BLDR-04**: User can add/remove/configure filters on the dashboard from available dataset columns
- [x] **BLDR-05**: User can add KPI cards from the KPI library to the dashboard
- [x] **BLDR-06**: View mode vs edit mode toggle — view mode is the consumer experience, edit mode enables drag/resize/configure
- [x] **BLDR-07**: Dashboards persist to database with save, "Save As" (clone), and delete
- [x] **BLDR-08**: Dashboard list page with search, showing title, description, last modified, creator

### Dashboard Interactions

- [x] **INTR-01**: Cross-filtering — click a chart segment to filter all other charts on the dashboard; client-side only, zero network calls, instant response
- [x] **INTR-02**: Cross-filter visual state — selected items full color, excluded items dimmed (not hidden); selection bar showing active cross-filters with one-click removal
- [x] **INTR-03**: Drill-down — click aggregated data to see breakdown, then detail rows; breadcrumb navigation showing drill path
- [x] **INTR-04**: Drill-down detail level fetches raw rows from backend via AG Grid with full sort/filter/pagination
- [x] **INTR-05**: Fullscreen chart view — expand any chart to a modal/overlay for detailed inspection
- [x] **INTR-06**: Chart export — PNG, CSV, clipboard from chart toolbar
- [x] **INTR-07**: Grid export — CSV and Excel via AG Grid Enterprise built-in export
- [x] **INTR-08**: Manual refresh button per dashboard — invalidates cache, re-fetches all data
- [x] **INTR-09**: Configurable auto-refresh — default ~10 min interval, user-configurable per dashboard

### Sharing & Views

- [ ] **SHAR-01**: Saved views — save current filter state + layout tweaks as a named bookmark
- [ ] **SHAR-02**: Shareable URLs — filter state encoded in URL params, recipient opens exact same view
- [ ] **SHAR-03**: Embeddable dashboards — iframe embedding with URL param filters, locked filters, theme override, chromeless mode
- [ ] **SHAR-04**: Command palette (Cmd+K) — search across dashboards, datasets, charts, saved views

### Foundation & Infrastructure

- [x] **INFR-01**: Dashboard configs persisted in database (Oracle sidecar or PostgreSQL) — not static JSON files
- [x] **INFR-02**: Config schema versioning with migration support — backward-compatible evolution
- [x] **INFR-03**: Superset pinned to specific version with CSRF and auth handling hardened
- [x] **INFR-04**: Remove mock data fallbacks — surface real errors instead of silently serving fake data
- [x] **INFR-05**: Number formatting utilities for financial data — currency, percentages, large numbers, consistent precision
- [x] **INFR-06**: Legacy dead code cleaned up — remove non-functional components that would crash at runtime

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Templates & Advanced Builder

- **TMPL-01**: Dashboard templates — pre-built recon layouts (breaks summary, SLA dashboard, aging analysis, match rate tracker, volume dashboard)
- **TMPL-02**: Conditional formatting with threshold rules — color-code grid cells and KPI status based on configurable business rules
- **TMPL-03**: Inline chart type switching — swap chart type without entering edit mode
- **TMPL-04**: Recon-specific KPI formulas — pre-built calculations for break count, match rate %, aging distribution, SLA adherence

### Reports & Export

- **REPT-01**: PDF export of dashboard view (screenshot-to-PDF or WeasyPrint)
- **REPT-02**: Excel export of dashboard data (multi-sheet workbook)
- **REPT-03**: Scheduled report delivery via email
- **REPT-04**: Email with dashboard image or data attachment

### Security & Multi-User

- **SECU-01**: Authentication via SSO/SAML/OIDC (corporate credentials)
- **SECU-02**: Row-level security — restrict data by user role/team
- **SECU-03**: Dashboard permissions — owner, editor, viewer roles
- **SECU-04**: Audit logging — who viewed what, when

### Advanced Features

- **ADVN-01**: Multi-dashboard overview — portfolio page showing KPIs from all dashboards at a glance
- **ADVN-02**: Alerting — threshold-based notifications when metrics cross limits
- **ADVN-03**: Dashboard versioning — rollback to previous saved states

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Free-form SQL for business users | Two-tier model: devs write SQL, users consume datasets. Business SQL on production DBs creates support/security risk. |
| Natural language / AI querying | Hallucination risk on financial data. No on-prem LLM infrastructure. Revisit in 12+ months. |
| Real-time WebSocket live updates | Recon data arrives in batches. Auto-refresh at intervals covers the use case. |
| Mobile/tablet responsive design | Desktop-only corporate environment. Data density is priority. |
| Freeform canvas layout (Figma-style) | Grid-based is cleaner. Freeform creates alignment nightmares and maintenance burden. |
| Custom calculated fields / DAX formulas | Business users creating formulas on financial data without validation is dangerous. Dev team manages metrics. |
| Pixel-perfect report designer | Different product category. Use screenshot-to-PDF for v1, WeasyPrint for v2. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1: Foundation Hardening | Complete |
| INFR-02 | Phase 1: Foundation Hardening | Complete |
| INFR-03 | Phase 1: Foundation Hardening | Complete |
| INFR-04 | Phase 1: Foundation Hardening | Complete |
| INFR-05 | Phase 1: Foundation Hardening | Complete |
| INFR-06 | Phase 1: Foundation Hardening | Complete |
| INTR-01 | Phase 2: Cross-Filtering and Drill-Down | Complete |
| INTR-02 | Phase 2: Cross-Filtering and Drill-Down | Complete |
| INTR-03 | Phase 2: Cross-Filtering and Drill-Down | Complete |
| INTR-04 | Phase 2: Cross-Filtering and Drill-Down | Complete |
| INTR-05 | Phase 3: Chart and Grid Interactions | Complete |
| INTR-06 | Phase 3: Chart and Grid Interactions | Complete |
| INTR-07 | Phase 3: Chart and Grid Interactions | Complete |
| INTR-08 | Phase 3: Chart and Grid Interactions | Complete |
| INTR-09 | Phase 3: Chart and Grid Interactions | Complete |
| DATA-01 | Phase 4: Data Source Connectivity | Complete |
| DATA-02 | Phase 4: Data Source Connectivity | Complete |
| DATA-03 | Phase 4: Data Source Connectivity | Pending |
| DATA-04 | Phase 4: Data Source Connectivity | Complete |
| DSET-01 | Phase 5: Dataset Management | Complete |
| DSET-02 | Phase 5: Dataset Management | Complete |
| DSET-03 | Phase 5: Dataset Management | Complete |
| DSET-04 | Phase 5: Dataset Management | Complete |
| DSET-05 | Phase 5: Dataset Management | Complete |
| CHRT-01 | Phase 6: Chart Library | Complete |
| CHRT-02 | Phase 6: Chart Library | Complete |
| CHRT-03 | Phase 6: Chart Library | Complete |
| CHRT-04 | Phase 6: Chart Library | Complete |
| CHRT-05 | Phase 6: Chart Library | Complete |
| CHRT-06 | Phase 6: Chart Library | Complete |
| CHRT-07 | Phase 6: Chart Library | Complete |
| KPI-01 | Phase 7: KPI Library | Complete |
| KPI-02 | Phase 7: KPI Library | Complete |
| KPI-03 | Phase 7: KPI Library | Complete |
| BLDR-01 | Phase 8: Dashboard Builder | Complete |
| BLDR-02 | Phase 8: Dashboard Builder | Complete |
| BLDR-03 | Phase 8: Dashboard Builder | Complete |
| BLDR-04 | Phase 8: Dashboard Builder | Complete |
| BLDR-05 | Phase 8: Dashboard Builder | Complete |
| BLDR-06 | Phase 8: Dashboard Builder | Complete |
| BLDR-07 | Phase 8: Dashboard Builder | Complete |
| BLDR-08 | Phase 8: Dashboard Builder | Complete |
| SHAR-01 | Deferred to next milestone | Pending |
| SHAR-02 | Phase 9: Sharing and Views | Pending |
| SHAR-03 | Phase 9: Sharing and Views | Pending |
| SHAR-04 | Phase 9: Sharing and Views | Pending |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap creation*
