---
phase: 1
reviewers: [gemini]
reviewed_at: 2026-04-04T00:00:00Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 1

## Gemini Review

This review covers the three implementation plans for **Phase 1: Foundation Hardening** of the RecViz project.

### Summary
The proposed plans provide a comprehensive and technically sound roadmap for transitioning RecViz from a prototype to a production-ready system. The strategy effectively balances architectural improvements (async SQLAlchemy, JSONB persistence) with UX refinements (centralized formatting, structured error handling). The dependency ordering is logical, particularly the requirement that database persistence (01-01) precedes mock data removal (01-03). The use of the "Grafana pattern" for dashboard storage and `Intl.NumberFormat` for financial data demonstrates a high level of technical maturity and alignment with industry standards.

### Strengths
- **Architectural Alignment:** Using PostgreSQL JSONB for dashboard configs is an excellent choice for RecViz's nested configuration needs, avoiding complex N+1 joins while maintaining queryability.
- **Robust Versioning:** Implementing a schema migration pipeline (`config_migrator.py`) alongside Alembic ensures that long-lived dashboard JSON can evolve without breaking the UI.
- **UX Excellence:** The per-component error isolation strategy (Plan 01-03) is critical for a BI platform where one failing data source should not prevent the rest of the dashboard from rendering.
- **Standards-Based Formatting:** Leveraging `Intl.NumberFormat` instead of custom formatting logic ensures internationalization support and handles complex financial requirements (compact notation, currency symbols) natively.
- **Clean Separation of Concerns:** The refactoring of `QueryEngine` to accept `DataSourceConfig` directly decouples the engine from the storage implementation, simplifying testing and future expansion.

### Concerns
- **Superset Version Discrepancy (MEDIUM):** Plan 01-02 Task 2 suggests pinning `apache-superset==4.1.1`, whereas the Research Findings state the venv has `6.0.0` installed and recommend pinning to `6.0.0`. Using the wrong version could introduce compatibility issues with the existing `superset_client.py`.
- **QueryEngine Call Site Proliferation (MEDIUM):** Plan 01-01 moves the responsibility of resolving `DataSourceConfig` from the `QueryEngine` to the API route handlers. While this decouples the engine, it risks logic duplication across the 9 API endpoints. A thin service wrapper or a specialized dependency might be needed to avoid repeating 404/lookup logic.
- **Seed Data Complexity (LOW):** Plan 01-01 Task 1.13 requires `scripts/seed-postgres.py` to recreate the schema expected by the SQL templates. If the seed data doesn't perfectly match the columns in the SQL templates (e.g., `tlm_automatch.json`), the application will appear broken immediately after mock data removal.
- **Sensitive Error Disclosure (LOW):** Plan 01-03 Task 1 returns raw exception strings in the `detail` field. While acceptable for internal tooling, these strings may contain SQL fragments or table names that could be considered a minor security risk or simply clutter the UX.

### Suggestions
- **Consistency Check:** Standardize on `apache-superset==6.0.0` (or whatever is currently in the venv) across all documentation and requirements files.
- **Data Source Helper:** In `backend/app/core/dependencies.py`, consider adding a helper dependency `ResolvedDataSourceDep` that handles the ConfigStore lookup and 404 raising, keeping the route handlers lean.
- **ID Preservation:** In the `seed-postgres.py` script, ensure that the `id` fields from the JSON files are used as the primary keys in PostgreSQL. This ensures that any existing bookmarks or hardcoded URLs to dashboards remain functional.
- **Locale Pinning:** In `frontend/src/lib/formatters.ts`, consider hardcoding the locale to `'en-US'` (or making it a setting) to ensure financial numbers format identically across different users' browser settings, which is often a requirement for audit/reconciliation tools.

### Risk Assessment
**Overall Risk: LOW**

The plans are highly detailed, acknowledge existing technical debt (dead code), and provide clear validation steps. The technical stack choices (SQLAlchemy 2.0, asyncpg, TanStack Query) are modern and appropriate. The primary risk is the "Big Bang" moment in Plan 01-03 where mock data is deleted; however, the dependency on Plan 01-01's seed scripts significantly mitigates the danger of a non-functional development environment.

**Approved for implementation with the recommendation to verify the Superset version pin before proceeding.**

---

## Consensus Summary

### Agreed Strengths
- JSONB storage pattern (Grafana model) is architecturally sound for nested dashboard configs
- Per-component error isolation is the right UX pattern for a BI platform
- `Intl.NumberFormat` is the correct choice for financial formatting
- Dependency ordering (DB persistence before mock removal) is logical

### Agreed Concerns
- **MEDIUM: Superset version pin** — Research says 6.0.0 is installed, plan says 4.1.1. Must verify actual installed version and pin to that.
- **MEDIUM: QueryEngine call site duplication** — Consider a `ResolvedDataSourceDep` helper to avoid repeating lookup/404 logic across endpoints.
- **LOW: Seed data must match SQL templates** — If seed data columns don't match existing SQL templates, app breaks after mock removal.
- **LOW: Error detail leakage** — Raw exception strings in API errors may expose SQL fragments. Consider sanitizing for production.

### Actionable Items
1. Verify Superset version: `pip show apache-superset` and pin to whatever is installed
2. Add `ResolvedDataSourceDep` helper during Plan 01-01 execution
3. Validate seed data columns against all SQL templates in `backend/app/config/data_sources/`
4. Consider locale pinning in formatters.ts for audit consistency
