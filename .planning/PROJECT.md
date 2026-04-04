# RecViz

## What This Is

RecViz is an internal BI and visualization platform replacing Tableau and Qlik View for Citi's Global Reconciliation Unit (GRU). It provides a dashboard builder where the dev team creates datasets (SQL queries against Oracle/Hive/ES) and business users build, view, and customize dashboards from those datasets. Apache Superset serves as the headless query engine; a custom React frontend delivers the premium UI and builder experience.

## Core Value

Business users can view, interact with, and customize dashboards over reconciliation data without depending on another team for every change.

## Requirements

### Validated

- ✓ Config-driven dashboard rendering (filter bar, KPIs, charts, data grid) — existing
- ✓ FastAPI proxy to Superset query engine — existing
- ✓ AG Charts (primary) + ECharts (exotic) chart rendering — existing
- ✓ AG Grid Enterprise with sorting, filtering, pagination — existing
- ✓ SQL Explorer with Monaco editor, schema browser, query history — existing (dev-team only)
- ✓ Global filter bar with date range, single-select, multi-select, cascading — existing
- ✓ Dark/light theme toggle with CSS variable theming — existing
- ✓ Mock data fallback when Superset unavailable — existing
- ✓ Embed mode (chromeless dashboards via URL params) — existing

### Active

- [ ] Dashboard builder UI — business users create/edit dashboards from datasets
- [ ] Dataset management UI — dev team creates, edits, and manages datasets (SQL → named dataset → column metadata)
- [ ] Chart builder — pick dataset, choose columns for axes/metrics, select chart type, configure appearance
- [ ] Dashboard layout editor — arrange charts, KPIs, filters on a canvas; resize and reposition
- [ ] Cross-filtering — click a chart segment to filter all other charts on the dashboard (client-side, zero network calls)
- [ ] Drill-down to raw data — click aggregated chart → see underlying rows in AG Grid with breadcrumb navigation
- [ ] Configurable auto-refresh — default ~10 min interval, manual refresh button, user-configurable per dashboard
- [ ] Embeddable dashboards — shareable URLs + iframe embedding for internal portals
- [ ] KPI cards with animated counters, trend indicators, and drill-down
- [ ] Skeleton loading on every data component — never show blank screens
- [ ] Chart export — PNG, CSV, clipboard for individual charts
- [ ] Fullscreen chart view — expand any chart to a modal/overlay for detailed inspection
- [ ] Saved views — save filter + layout combinations, share via URL, set defaults
- [ ] Dashboard templates — pre-built layouts (KPI + charts + grid, etc.) as starting points
- [ ] Command palette (Cmd+K) — search across dashboards, datasets, saved views

### Out of Scope

- Email report delivery — deferred until core dashboard builder is solid
- PDF/Excel export — deferred, depends on report design research
- Scheduled report generation — deferred, requires Celery infrastructure
- Authentication/SSO — deferred until closer to production deployment
- Row-level security / RBAC — start with no restrictions, add later if needed
- Mobile/tablet responsive design — desktop-only application
- Real-time live-updating (WebSocket) — auto-refresh at intervals is sufficient
- Dashboard builder for non-technical users to write SQL — devs own datasets, users consume
- AI/ML features (NL-to-SQL, anomaly detection) — future consideration

## Context

- **Team:** GRU Dev team at Citi. Builds tooling for the Global Reconciliation Unit.
- **Problem:** Currently depend on a separate BI team to build/modify Tableau and Qlik View dashboards. Every small change has a turnaround dependency. Licensing costs are high.
- **Scale:** ~12,000 reconciliations across GRU. Potentially 100+ dashboards needed. Millions of rows per query. This makes the dashboard builder the core product — hand-crafting dashboards in config files doesn't scale.
- **Data sources:** Oracle (primary recon data), Hive (historical/batch), Elasticsearch (search/real-time). All accessed via Superset's database connectivity.
- **Recon tools:** SmartStream TLM and others. RecViz doesn't care which tool produced the data — it queries database tables.
- **Users:** Recon analysts (daily operational use), team leads/managers (performance tracking), senior leadership (summaries), auditors/compliance (periodic reporting).
- **Data freshness:** Combination of yesterday's batch data and near-real-time. Configurable auto-refresh (~10 min default) + manual refresh.
- **Existing codebase:** Solid foundation with config-driven dashboards, FastAPI proxy, AG Charts/Grid, SQL explorer. Build on it — evolve the JSON config system into a UI-based builder.
- **Builder model (needs research):** Dev team creates datasets (SQL queries), business users build dashboards from those datasets. Exact builder UX (template-based vs drag-and-drop) to be determined by research into Tableau/Qlik patterns.
- **Deployment:** On-prem servers likely, not fully decided.

## Constraints

- **Tech stack**: React 19 + Vite 6 + TypeScript 5 + Shadcn/ui + AG Grid/Charts Enterprise + FastAPI + Superset — established in existing codebase
- **Desktop only**: Optimize for large screens and data density. No mobile/tablet.
- **Superset as engine**: Keep Superset as headless query engine — best free option for multi-source query, caching, dataset management
- **No direct Superset UI**: Frontend never exposes Superset's UI to users. All queries proxied through FastAPI.
- **Data volume**: Millions of rows — aggregation-first, caching critical (Redis via Superset + TanStack Query client-side)
- **Corporate environment**: On-prem deployment, no cloud services. All dependencies must be self-hostable.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build on existing codebase | Working foundation with config-driven dashboards, clean architecture. Fresh start would discard months of work. | — Pending |
| Superset as headless engine | Best free option for multi-DB connectivity, caching, dataset management. Building from scratch would be inferior. | ✓ Good |
| Dashboard builder is the core product | 12,000 recons, 100+ dashboards needed. Can't hand-craft configs. Builder must be first-class. | — Pending |
| Dev team creates datasets, business users build dashboards | Two-tier model: SQL expertise stays with devs, dashboard composition goes to business users. | — Pending |
| Desktop only | Corporate environment, large screens. No responsive design complexity. | ✓ Good |
| Auth deferred | Not needed until production deployment. Focus on core builder first. | — Pending |
| Builder UX approach (template vs drag-drop) | Needs research into Tableau/Qlik patterns for recon/finance domain. | — Pending |
| PostgreSQL for local dev, Oracle in production | No Oracle access on dev machine (corporate policy). PostgreSQL via Docker for development; swap SQLAlchemy URI for Oracle on servers. Standard SQL to ensure compatibility. | ✓ Good |
| Reusable chart library | Charts saved independently and reusable across dashboards. Config change in library updates everywhere. Superset has this; Tableau doesn't. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-04 after initialization*
