# RecViz

## Current State

**Shipped:** v1.0 (2026-04-08) — 11 phases, 42 plans, ~6 months of work. Full archived roadmap at `.planning/milestones/v1.0-ROADMAP.md`. v1.0 ships the complete BI platform: foundation hardening, cross-filter + drill-down, chart/grid interactions, Oracle/Hive connectivity, dataset/chart/KPI/dashboard libraries, dashboard builder, sharing/embed/Cmd+K palette, comprehensive seed at 100k tier with 5 curated GRU-realistic dashboards.

**Documented exceptions:** SHAR-01 Saved Views and DATA-03 Elasticsearch deferred to next milestone. Phase 10 closeout (`10-CLOSEOUT.md`) tracks open visual bugs (donut, combo) and deferred plans (10-02 autonomous walk, 10-03 UAT runbook handoff).

**Next milestone:** Run `/gsd-new-milestone` to start the next cycle. Candidates listed in `.planning/ROADMAP.md` Next-milestone candidates section.

---

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
- ✓ Embed mode (chromeless dashboards via URL params) — existing
- ✓ Dashboard configs persisted in PostgreSQL with schema versioning — Phase 1
- ✓ Superset pinned to 6.0.0 with hardened auth/CSRF — Phase 1
- ✓ Centralized financial number formatting (Intl.NumberFormat, locale-pinned) — Phase 1
- ✓ Structured error handling with per-component isolation — Phase 1
- ✓ Legacy dead code removed, cross-filter/drill-down preserved — Phase 1
- ✓ Oracle database connectivity via Superset (python-oracledb thin mode, cx_Oracle aliasing) — Phase 4
- ✓ Hive database connectivity via Superset (PyHive driver) — Phase 4
- ✓ Connection management UI with dynamic forms, test-before-save, status tracking — Phase 4
- ✓ Dataset management UI — dev team creates, edits, and manages datasets (SQL → named dataset → column metadata) — Phase 5
- ✓ Chart library — reusable charts saved to a library, browseable, with builder mapping dataset columns to visual properties — Phase 6
- ✓ KPI library — reusable KPI templates with thresholds, trend comparison, and animated counters — Phase 7
- ✓ Dashboard builder UI — business users create, edit, save, and manage dashboards via drag-and-drop layout — Phase 8
- ✓ Cross-filtering and drill-down (client-side, zero network calls) — Phase 2
- ✓ Chart and grid interactions (export, fullscreen, manual + auto refresh) — Phase 3
- ✓ Shareable URLs — filter state encoded in URL params, recipient opens exact same view — Phase 9
- ✓ Embeddable dashboards — iframe embedding via /embed route with `?theme`, `?filter.X`, `?filter.lock`, `?hide=filter-bar,title,toolbar` granular hide — Phase 9
- ✓ Cmd+K command palette — searches dashboards, charts, datasets, KPIs from managed tables (not Superset) — Phase 9

### Active

- [ ] Saved views — save current filter state as a named bookmark (deferred from Phase 9 to next milestone alongside reports/exports)

### Recently shipped

- ✓ Comprehensive testing with advanced/seed data — clean-slate seed at 100k tier (16 datasets, 22 charts covering 18 working types, 12 KPIs, 5 curated dashboards). Legacy dashboard backend deleted. 5 decimal sub-phase fixes during preflight (10.1 legacy delete + client-side KPI compute, 10.2 sidebar scroll, 10.3 SQL filter WHERE, 10.4 builder layout, 10.5 chart panel heights). Plan 10-02 autonomous 57-checkpoint walk + Plan 10-03 formal UAT runbook deferred — Phase 10 user-marked complete after walking dash-aging + dash-match-rate. Phase 11 will pick up 1M/10M tier scaling. — Phase 10 (completed 2026-04-08)

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
*Last updated: 2026-04-08 after Phase 9 completion*
