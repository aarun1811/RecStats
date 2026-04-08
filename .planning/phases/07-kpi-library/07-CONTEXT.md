# Phase 07: KPI Library - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Dev team can define reusable KPI templates that reference existing datasets. Business users can browse the KPI library with search/filter. KPI cards display animated counters with trend arrows, percentage change, context labels, and threshold-based color coding. Adding KPIs to dashboards is Phase 8 — this phase builds the template CRUD, library browsing, and card rendering.

</domain>

<decisions>
## Implementation Decisions

### KPI Template Data Model
- **D-01:** KPI templates reference a managed dataset (from Phase 5) + specify which column to aggregate. One dataset can power many KPIs. No standalone SQL fragments.
- **D-02:** Trend comparison supports both modes — compare to previous period (day/week/month) OR compare to a static target value. Dev chooses per KPI template.
- **D-03:** Threshold coloring is dev-defined numeric ranges: green > X, amber > Y, red below Y. Business users see the colors but cannot change thresholds (that's dev config).

### KPI Card Design
- **D-04:** KPI cards show: animated counter value, trend arrow with % change (color-coded green/red), and a subtitle/context label (e.g., "vs last week" or "target: 95%").
- **D-05:** No sparkline mini-charts or threshold color bars in this phase. Keep cards clean and focused.
- **D-06:** Counter animation is fast roll-up (~0.8s) using existing `CountAnimation` component from `motion/react`.

### Builder vs Picker UX
- **D-07:** Phase 7 is browse-only library for business users. No dashboard placement or inline config — that's Phase 8.
- **D-08:** KPI library page follows the same pattern as chart library: card grid + list toggle, search/filter toolbar, detail side panel on click.

### Dev Template Editor
- **D-09:** Form-based step editor for creating KPI templates: pick dataset → pick column → set aggregation → set format → configure trend → set thresholds → name & save. Simpler than chart builder (no chart type/mapping complexity).
- **D-10:** Live KPI card preview in right panel showing real data as dev configures. Same split-panel pattern as chart builder.

### Claude's Discretion
- Editor can use accordion steps or single-page form — Claude picks based on field count and UX flow.
- Card grid column count and responsive breakpoints.
- Exact animation easing curve for counter roll-up.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 06 Pattern (Chart Library — follow this pattern)
- `.planning/phases/06-chart-library/06-01-PLAN.md` — Backend CRUD + types + hooks pattern
- `.planning/phases/06-chart-library/06-02-PLAN.md` — Builder accordion stepper pattern
- `.planning/phases/06-chart-library/06-03-PLAN.md` — Library list page pattern

### Existing KPI Code (adapt, don't rewrite)
- `frontend/src/components/dashboard/config-kpi-row.tsx` — Existing KPI row renderer with trend arrows, formatting, cross-filter support
- `frontend/src/components/shared/count-animation.tsx` — Animated counter component using motion/react
- `frontend/src/lib/kpi-aggregator.ts` — KPI re-computation logic for cross-filter scenarios
- `frontend/src/lib/formatters.ts` — `formatValueFull()` for currency/percentage/number formatting
- `frontend/src/types/dashboard-config.ts` — Existing `KpiConfig`, `KpiResult`, `KpiTrend` types

### Project Conventions
- `CLAUDE.md` — Full coding conventions, naming, styling, component patterns
- `recviz/CODEBASE_GUIDE.md` — File-level codebase reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CountAnimation` component: Already built with motion/react, used in config-kpi-row.tsx
- `formatValueFull()`: Handles currency, percentage, number formatting with abbreviation
- `KpiConfig` type: Has format, sources, aggregation, trend fields — adapt for managed KPI model
- Chart library components: `chart-library-list.tsx`, `chart-library-card.tsx`, `chart-library-row.tsx`, `chart-detail-panel.tsx` — clone and adapt for KPI library
- Chart builder pattern: `chart-builder.tsx` with accordion steps + preview panel — simplify for KPI editor

### Established Patterns
- Backend CRUD: SQLAlchemy model + Alembic migration + Pydantic schemas + FastAPI endpoints (Phase 5 datasets, Phase 6 charts)
- Frontend hooks: TanStack Query hooks with `useCreate*`, `useUpdate*`, `useDelete*` pattern
- Library pages: Card grid/list toggle, search/filter toolbar, detail side panel via Sheet
- Builder: Full-page layout with header (back/save/name), card-wrapped steps panel + preview panel

### Integration Points
- Sidebar nav: Add "KPIs" entry between Charts and Datasets in nav-main.tsx
- Route: `/kpis`, `/kpis/new`, `/kpis/:id/edit` — file-based routes in `routes/_app/kpis/`
- Backend: New `managed_kpis.py` router registered in `router.py` BEFORE existing kpi routes
- Database: New `recviz_kpis` table via Alembic migration 004
- Dataset reference: Foreign key to `recviz_datasets.id`

</code_context>

<specifics>
## Specific Ideas

- KPI cards should feel premium — animated counter, clean trend arrow, subtle color coding
- Follow Phase 6 chart library pattern closely for library browsing (card grid, detail panel, search/filter)
- Editor is simpler than chart builder — fewer steps since there's no chart type selection or column mapping complexity
- Trend subtitle provides context: "vs last week", "vs target: 95%", etc.

</specifics>

<deferred>
## Deferred Ideas

- Sparkline mini-charts inside KPI cards — could add in a future enhancement phase
- Threshold color bar on card edge — visually interesting but not needed for v1
- User-configurable thresholds when adding KPI to dashboard — Phase 8 scope
- KPI placement/sizing on dashboard grid — Phase 8 scope

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-kpi-library*
*Context gathered: 2026-04-06*
