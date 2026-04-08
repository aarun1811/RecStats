---
phase: 10-comprehensive-testing-with-advanced-seed-data
artifact: UAT runbook
version: draft-1
created: 2026-04-08
author: Plan 10-01c (executor)
---

# Phase 10 — UAT Runbook

**Created:** 2026-04-08 (Plan 10-01c)
**Status:** draft — pre-tick walkthrough by Claude in Plan 10-02; final manual
walkthrough by user after Plan 10-02 declares the build clean.

## Purpose

Phase 10 is the **release-readiness milestone** for v1 RecViz. This runbook
is the structured manual-regression checklist that validates every feature
shipped in Phases 1–9 against the seeded curated test catalog.

It is the canonical proof that the build works end-to-end against realistic
recon data before v1 ships.

## Two readers, one document (D-09)

This single artifact is walked **twice**:

1. **Plan 10-02 — autonomous Claude pre-flight.** Claude opens Playwright
   MCP, walks every section, ticks the checkboxes it can verify, and tags
   each Claude-checked item `[Claude-checked]` in the rendered output.
   Issues found are either fixed inline or spawned as decimal sub-phases
   (10.1, 10.2, …).
2. **Plan 10-03 → user manual regression.** After Plan 10-02 stabilises and
   declares "ready for UAT", the user walks the same runbook manually as the
   final signoff. Phase 10 ships when the user posts **"UAT PASS"** at the
   bottom.

## Phase 10 · naming convention (M-3)

All 5 curated dashboards use the `Phase 10 ·` prefix to visually distinguish
them from any user-created experiments during the walkthrough:

| Slug | Display name |
|------|--------------|
| `dash-sla` | `Phase 10 · SLA Overview` |
| `dash-aging` | `Phase 10 · Aging Analysis` |
| `dash-match-rate` | `Phase 10 · Match Rate Tracker` |
| `dash-volume` | `Phase 10 · Volume Dashboard` |
| `dash-breaks-summary` | `Phase 10 · Breaks Summary` |

These names are pinned in `frontend/e2e/_fixtures.ts` `DASHBOARD_NAMES` and
the seed cross-checks them via `test_dashboard_names_match_fixtures`.

## 18-type chart correction (2026-04-08)

The curated catalog seeds **22 charts covering all 18 working chart types**.
Three chart types declared in `SUPPORTED_AG_TYPES` / `ECHART_TYPES` are NOT
in the curated catalog because they are not actually functional today:

- `bullet` — `ag-chart-wrapper.tsx` falls back to `type: 'bar'`. Not tested.
- `box-plot` — same fallback. Not tested.
- `sunburst` — `echart-wrapper.tsx` lacks the hierarchical JSON transform.
  Not tested.

These three are documented as **declared-but-non-functional** under "Known
Limitations" below. If they become real requirements, wire native renderers
in a follow-up sub-phase.

## How to use this runbook

1. Each section corresponds to a phase from `.planning/ROADMAP.md` (plus
   Phase 02.1 for chart rendering foundation).
2. Each capability has a checkbox with a concrete observation step and an
   expected outcome.
3. Mark items `[x]` when observed working. Log issues inline as
   `**Issue (P0|P1|P2|P3):** <description>. **Fix commit:** <hash or "TBD">.`
4. The runbook is complete when:
   - Every checkbox is `[x]`
   - All P0/P1 findings are resolved
   - The Mock Audit at the top is clean
   - The user posts "UAT PASS" at the bottom

---

## Mock Audit (D-16, three-pronged)

Performed FIRST so any regressions surface before the per-feature walks.

### Codebase grep

- [ ] `bash scripts/mock-audit.sh` exits 0 with `mock-audit: clean`
- [ ] No `CHART_DATASOURCE_MAP` or `CHART_QUERIES` references survive
      anywhere under `backend/app/`
- [ ] No dead chart-data hooks (`use-chart-data`, `use-kpi-data`,
      `use-breaks-data`, `use-prefetch`) under `frontend/src/hooks/`
- [ ] No `lorem`, `Lorem ipsum`, hardcoded `pending`, or fake-data shim
      strings render anywhere

### Endpoint review

- [ ] Every API route in `backend/app/api/router.py` is verified to hit a
      real data path (Postgres / Superset / config store)
- [ ] Legacy routers `charts.py` and `custom.py` are no longer registered
      (verified via `grep -n include_router backend/app/api/router.py`)
- [ ] In-memory stores `_query_history`, `_views` are exempt per D-17 (Saved
      Views deferred to next milestone)

### UAT visual validation

- [ ] Every screen verified during the walks below shows real data
- [ ] No placeholder strings (`Lorem`, `TBD`, `coming soon` other than the
      explicit Reports / Export empty states)
- [ ] Every KPI shows a numeric value (not the em-dash `—` placeholder)
- [ ] Every chart panel shows content (no empty panels other than charts
      legitimately filtered to zero rows)

---

## Phase 1 — Foundation Hardening

**Delivered:** Number formatting (currency / percentage / number / decimal),
mock removal (INFR-04), config schema versioning (INFR-02), Superset CSRF
hardening (INFR-03), DB-backed config store (INFR-01), legacy dead code
cleanup (INFR-06).

**Requirements covered:** INFR-01..06.

### INFR-05 — Number formatting

- [ ] On `Phase 10 · Volume Dashboard`, the **Total Amount (USD)** KPI
      renders as a currency string (e.g., `$1.2M` / `$12.5K` / `$1,234.56`)
      with abbreviation and the `$` symbol prepended.
- [ ] On `Phase 10 · Match Rate Tracker`, the **Match Rate** KPI renders as
      a percentage with 1-2 decimals (e.g., `92.5%`).
- [ ] On `Phase 10 · Aging Analysis`, the **Average Aging (days)** KPI
      renders as a decimal number (e.g., `4.5`).
- [ ] On `Phase 10 · Breaks Summary`, the **Total Breaks** KPI renders as a
      number with thousands separators or abbreviation (e.g., `20K`).
- [ ] No KPI renders the literal `NaN`, `undefined`, `null`, or the em-dash
      `—`.

### INFR-04 — Mock removal (re-enforced in Plan 10-01a)

- [ ] `bash scripts/mock-audit.sh` exits 0
- [ ] On every dashboard, every KPI / chart pulls from the real Postgres
      query path (proxied via the FastAPI sidecar)
- [ ] `_references/shadcn-ui-kit-dashboard/` literals do NOT leak into the
      live build (the directory is reference-only)

### INFR-02 — Config schema versioning

- [ ] Editing a curated dashboard, saving, then re-loading produces an
      identical config (no silent shape drift)
- [ ] The dashboard config JSONB persists in `recviz_dashboards.config` in
      camelCase (verified via `psql ... SELECT config FROM recviz_dashboards LIMIT 1`)

### INFR-01 — DB-backed config store

- [ ] All 5 curated dashboards live in `recviz_dashboards` (verified via
      `psql -c "SELECT id, name FROM recviz_dashboards;"` — 5 rows, all with
      the `Phase 10 ·` prefix)
- [ ] Dashboard reload between sessions (close + reopen the browser) shows
      the same dashboards — no localStorage-only state

### INFR-06 — Legacy dead code cleanup

- [ ] `backend/app/api/charts.py` and `backend/app/api/custom.py` do not
      exist (Plan 10-01a Task 2 deleted them)
- [ ] `frontend/src/hooks/use-chart-data.ts` and friends do not exist
- [ ] `frontend/src/types/index.ts` does not exist (barrel export gone)

### INFR-03 — Superset hardening

- [ ] Login to RecViz never prompts for Superset credentials (RecViz uses
      Superset as a headless engine; the UI is never exposed)

### Cross-cutting visual

- [ ] Dark mode toggle on `/settings` works on every dashboard (round trip
      light → dark → light leaves the UI visually identical)
- [ ] No red error banners on initial load of any curated dashboard

**Findings (Phase 1):**

> Log issues here as `**Issue (P_):** description. **Fix commit:** hash.`

---

## Phase 2 — Cross-Filtering and Drill-Down

**Delivered:** Click chart segment → cross-filter all peer charts +
client-side dimming, drill-down breadcrumb, drill detail grid, KPI
re-aggregation.

**Requirements covered:** INTR-01..04.

> **Known pre-existing bug (carried over from Plan 10-01b deferred items):**
> The legacy `/api/dashboards/{id}/kpis` endpoint reads through
> `config_store.get_dashboard()` which validates against the snake_case
> `DashboardConfig` Pydantic model. The seeded curated dashboards have
> camelCase JSONB config (the shape the renderer reads). Applying a filter
> on a curated dashboard MAY hit this endpoint and return a 400/500. This
> will surface during the Plan 10-02 autonomous walkthrough — fix is either
> a `CamelModel` patch on `DashboardConfig` or a switch to a managed-table
> KPI aggregation path. **Expected to be resolved before user UAT begins.**

### INTR-01 — Cross-filter on click

- [ ] On `Phase 10 · Volume Dashboard`, click a bar in
      `chart-txn-by-region-bar` (chart "Transactions by Region") → a
      "Filtered by:" cross-filter bar appears at the top of the dashboard
- [ ] Other charts on the dashboard **dim** (excluded items at reduced
      opacity, selected items at full color)

### INTR-02 — Cross-filter clear + visual state

- [ ] The cross-filter bar shows the active region label
- [ ] Click "Clear all" → cross-filter bar disappears, dimming reverts
- [ ] On `Phase 10 · SLA Overview`, click a slice of `chart-txn-status-donut`
      → matching cross-filter applies across the dashboard

### INTR-03 — Drill-down breadcrumb

- [ ] On `Phase 10 · SLA Overview`, double-click a cell in
      `chart-txn-status-stacked` → a drill breadcrumb appears (e.g.,
      "Overview › Region › Status")
- [ ] Click "Overview" in the breadcrumb → returns to the top level

### INTR-04 — Drill-down detail grid

- [ ] On a chart with `drillDetailDataSourceId` configured, double-click
      reaches the detail level → an AG Grid slides in
- [ ] The grid shows real transaction-level rows from the seed
- [ ] Sort, filter, and pagination work in the grid (Enterprise features)

**Findings (Phase 2):**

---

## Phase 02.1 — Chart Rendering Foundation

**Delivered:** All chart types render correctly from query data via
`buildSeries` + `chart-factory.tsx`. AG Charts gates working types via
`SUPPORTED_AG_TYPES`; ECharts handles the 6 exotic types.

**Requirements covered:** chart-rendering correctness for all 18 working
types (bullet / box-plot / sunburst declared-but-non-functional, see Known
Limitations below).

### All 22 curated charts render

The 22 curated charts collectively cover all 18 working types. Each row
below corresponds to a chart type — verify it renders on its host dashboard.

#### AG Charts (12 working types)

- [ ] **bar** — `chart-txn-by-region-bar` on `Phase 10 · Volume Dashboard`
- [ ] **bar** — `chart-breaks-by-type` on `Phase 10 · Breaks Summary`
- [ ] **bar** — `chart-counterparty-top-bar` on `Phase 10 · Volume Dashboard`
      or `Breaks Summary` (top 20 counterparties)
- [ ] **bar** — `chart-breaks-aging-bar` on `Phase 10 · Aging Analysis`
- [ ] **stacked-bar** — `chart-txn-status-stacked` on `Phase 10 · SLA Overview`
- [ ] **line** — `chart-txn-trend-line` on `Phase 10 · Match Rate Tracker`
- [ ] **area** — `chart-txn-trend-area` on `Phase 10 · Volume Dashboard`
      (Q-3b RESOLVED placement)
- [ ] **pie** — `chart-txn-by-region-pie` on `Phase 10 · Volume Dashboard`
- [ ] **pie** — `chart-currency-pie` on `Phase 10 · Volume Dashboard`
- [ ] **donut** — `chart-txn-status-donut` on `Phase 10 · Match Rate Tracker`
- [ ] **scatter** — `chart-txn-scatter` on `Phase 10 · Volume Dashboard`
      (renders 5000+ points, no stutter)
- [ ] **heatmap** — `chart-sla-heatmap` on `Phase 10 · SLA Overview` (SLA
      type × region matrix)
- [ ] **treemap** — `chart-volume-desk-treemap` on `Phase 10 · Volume
      Dashboard` (asset class → desk hierarchy)
- [ ] **waterfall** — `chart-breaks-aging-waterfall` on `Phase 10 · Aging
      Analysis` AND on `Phase 10 · SLA Overview`
- [ ] **combo** — `chart-txn-combo` on `Phase 10 · Match Rate Tracker`
      (line + bar overlay)
- [ ] **histogram** — `chart-breaks-histogram` on `Phase 10 · Breaks Summary`
      (note: `vizType=histogram` falls back to a bar series in
      `ag-chart-wrapper.tsx` and is considered a working visual variant)

#### ECharts (6 working exotic types)

- [ ] **sankey** — `chart-break-flow-sankey` on `Phase 10 · Aging Analysis`
- [ ] **radar** — `chart-kpi-radar` on `Phase 10 · SLA Overview`
- [ ] **gauge** — `chart-match-rate-gauge` on `Phase 10 · SLA Overview`
- [ ] **funnel** — `chart-match-funnel` on `Phase 10 · Match Rate Tracker`
- [ ] **graph** — `chart-recon-graph` on `Phase 10 · Breaks Summary`
- [ ] **parallel** — `chart-txn-parallel` on `Phase 10 · Volume Dashboard`

### Cross-axis correctness

- [ ] Bar / line / area charts use the correct x-axis (non-metric column)
      and y-axis (metric column)
- [ ] Pie / donut charts show correct slice labels and legend
- [ ] No "Column mapping error" / "Unsupported chart type" overlays appear

**Findings (Phase 02.1):**

---

## Phase 3 — Chart and Grid Interactions

**Delivered:** Fullscreen modal, chart export (PNG / CSV / clipboard), grid
export (CSV / Excel), manual + auto refresh.

**Requirements covered:** INTR-05..09.

### INTR-05 — Fullscreen chart

- [ ] Hover any chart on a curated dashboard → toolbar appears with
      fullscreen + export icons
- [ ] Click fullscreen → modal opens, the chart re-mounts and renders
      identically at the larger size
- [ ] Cross-filter and drill still work inside the fullscreen modal
- [ ] Esc closes the modal

### INTR-06 — Chart export

- [ ] Hover any chart → chart toolbar → export → PNG → file downloads
      (HiDPI for AG Charts, pixel-ratio 2 for ECharts)
- [ ] Hover any chart → export → CSV → file downloads with the underlying
      query rows
- [ ] Hover any chart → export → Copy to clipboard → toast "Copied to
      clipboard"

### INTR-07 — Grid export

- [ ] On a drill-detail grid, click the toolbar → CSV export → file
      downloads with WYSIWYG (filtered/sorted view)
- [ ] Click toolbar → Excel export → file downloads (uses
      requestAnimationFrame for the spinner)

### INTR-08 — Manual refresh

- [ ] Click the dashboard refresh button → skeletons flash → data
      re-renders with fresh query results

### INTR-09 — Auto refresh

- [ ] Configure a refresh interval per dashboard (config-only in v1) →
      countdown is timestamp-based (`Date.now() + interval`) — no drift
- [ ] Auto-refresh fires on schedule

**Findings (Phase 3):**

---

## Phase 4 — Data Source Connectivity

**Delivered:** Oracle + Hive + Postgres connection UI, test-before-save,
connection status dot.

**Requirements covered:** DATA-01, DATA-02, DATA-04 (DATA-03 deferred).

### DATA-04 — Connection management UI

- [ ] `/settings` → "Data sources" tab shows the configured logical
      databases (the seeded recon-data Postgres + the Superset metadata)
- [ ] Each row shows a connection status dot (StatusDot component)
- [ ] Click "Test connection" on a row → toast confirms success/failure

### DATA-01 / DATA-02

- [ ] The Postgres recon-data database is reachable from the dataset edit
      page (preview query returns rows)
- [ ] If Hive is configured, the Hive driver is selectable

### Known limitation

- [ ] **DATA-03 (Elasticsearch) is deferred** per PROJECT.md — runbook does
      not exercise it. Verify the option exists in the data source picker
      so the UI surface is honest about future support.

**Findings (Phase 4):**

---

## Phase 5 — Dataset Management

**Delivered:** Dataset CRUD, Monaco SQL editor, column metadata, test-execute
preview, dataset list with search.

**Requirements covered:** DSET-01..05.

### DSET-01 — Dev creates a dataset

- [ ] `/datasets` shows all 16 curated datasets (`ds-recon-*` and `ds-sla-*`)
- [ ] Click any curated dataset → `/datasets/:id/edit` loads
- [ ] Monaco editor shows the dataset's SQL with proper highlighting

### DSET-02 — Column metadata

- [ ] Column metadata table shows: name, display name, data type, role
      (dimension/measure/time), default aggregation, format string
- [ ] Format dropdown lists all supported formats (number / currency /
      percentage / decimal / string / date)

### DSET-03 — Test-execute preview

- [ ] Click "Run query" / "Preview" → grid shows real result rows from the
      seeded Postgres
- [ ] Preview honors the dataset's column metadata (formatted values)

### DSET-04 — Edit + delete

- [ ] Edit a curated dataset, change the description, save → reload, change
      persists
- [ ] Click "New Dataset" → fill in name + SQL → save → appears in list →
      delete via the row action → row is removed

### DSET-05 — DB persistence

- [ ] After delete, refresh the page — the deleted dataset stays gone
      (verifies DB persistence, not just in-memory state)

**Findings (Phase 5):**

---

## Phase 6 — Chart Library

**Delivered:** Chart builder single-page accordion wizard (Q-5 RESOLVED),
20+ supported chart types (18 working), library list with search and
preview thumbnails.

**Requirements covered:** CHRT-01..07.

### CHRT-07 — Browse + search

- [ ] `/charts` shows all 22 curated charts with preview thumbnails
- [ ] Search by "Volume" → list filters correctly
- [ ] Search by "Match" → list filters correctly

### CHRT-01 / CHRT-02 — Create chart via builder

- [ ] `/charts/new` loads the **single-page accordion wizard** — there are
      NO URL segments per step (Q-5 RESOLVED)
- [ ] Dataset picker shows curated datasets
- [ ] Chart type selector shows visual thumbnails for every supported AG
      and ECharts type
- [ ] Column mapping form changes labels per chart type
      (`MAPPING_FIELD_LABELS` — e.g., "Source / Target" for Sankey,
      "X-Axis / Y-Axis" for bar)
- [ ] Live preview updates as mappings change

### CHRT-03 — Save chart

- [ ] After completing the wizard, click "Save" → chart appears in the
      library at the top of the list

### CHRT-04 — Reuse across dashboards

- [ ] Add the saved chart to a dashboard via `BLDR-03` flow → it renders
      using the saved config

### CHRT-05 / CHRT-06 — Type coverage

- [ ] Every chart type listed in the Phase 02.1 section above is
      selectable in the wizard

### Edit existing chart

- [ ] Click a curated chart in `/charts` → `/charts/:id/edit` loads with
      the same single-page wizard pre-populated

**Findings (Phase 6):**

---

## Phase 7 — KPI Library

**Delivered:** KPI templates with format / trend / threshold bands.
Inverted thresholds supported per Q-4 RESOLVED.

**Requirements covered:** KPI-01..03.

### KPI-01 — Create KPI

- [ ] `/kpis` shows all 12 curated KPIs
- [ ] Click "New KPI" → builder opens with dataset picker, metric column,
      aggregation, format, trend mode, threshold bands

### KPI-02 — Threshold bands

- [ ] **Green band:** `kpi-match-rate` (Match Rate, ~92%) renders in
      **green** (above the `green_above=90` threshold)
- [ ] **Amber band:** `kpi-avg-confidence` (Avg Match Confidence, ~0.77)
      renders in **amber** (between `amber_above=0.70` and
      `green_above=0.85`)
- [ ] **Red band (inverted, Q-4 RESOLVED):** `kpi-total-breaks` (Total
      Breaks, ~20000) renders in **red** because the seeded value is
      `< amber_above=30000` and the threshold is inverted (lower is worse).
      Each inverted KPI has a `_comment` field in the JSONB documenting the
      inversion so a future reader doesn't "fix" it.
- [ ] **Amber band (inverted):** `kpi-avg-aging-days` (~4.5) renders in
      **amber** (`amber_above=4`)
- [ ] **Amber band (inverted):** `kpi-sla-breach-rate` (~8) renders in
      **amber** (`amber_above=6`)

### KPI-03 — Display

- [ ] Number format renders with thousands separators / abbreviation
- [ ] Currency format prepends `$` and abbreviates as `$1.2M`
- [ ] Percentage format shows 1-2 decimals (e.g., `92.5%`)
- [ ] Decimal format shows the configured decimal precision
- [ ] `previous_period` trend mode shows a `+/- N%` chip
- [ ] `static_target` trend mode shows comparison to the configured target
- [ ] Animated counter rolls up over ~0.8-1.5s using `motion/react`

### Edit existing KPI

- [ ] Click a curated KPI → `/kpis/:id/edit` loads with all current
      settings pre-populated

**Findings (Phase 7):**

---

## Phase 8 — Dashboard Builder

**Delivered:** Drag-drop builder, react-grid-layout v2 grid, chart/KPI
picker, filter config, save/save-as/delete.

**Requirements covered:** BLDR-01..08.

### BLDR-01 — Create dashboard

- [ ] `/dashboards/new` opens an empty BuilderPage
- [ ] Set title + description → save → dashboard appears in `/dashboards`

### BLDR-02 — Grid layout

- [ ] Add a chart from library → it appears on the canvas
- [ ] Drag the chart → snaps to the 12-column grid
- [ ] Resize the chart by its handle → snaps to the grid
- [ ] Undo (Ctrl-Z) reverts the most recent change; redo (Ctrl-Shift-Z)
      restores it (history snapshots — Phase 08 decision)

### BLDR-03 — Add charts

- [ ] AddContentMenu → "Add chart" → ChartLibraryPicker shows curated
      charts → select one → it lands on the canvas

### BLDR-04 — Add filters

- [ ] AddContentMenu → "Add filter" → FilterConfigDialog opens with a
      dataset column picker
- [ ] Filter type auto-detects: string/dimension → multi-select,
      date/time → preset-range, number+measure → preset-range
- [ ] Save filter → it appears in the dashboard filter bar

### BLDR-05 — Add KPIs

- [ ] AddContentMenu → "Add KPI" → KpiLibraryPicker shows curated KPIs →
      select one → it lands on the canvas

### BLDR-06 — View vs edit mode

- [ ] Click "Edit" on a curated dashboard → enters edit mode with grid
      handles + AddContentMenu visible
- [ ] Edit mode and view mode are visually distinct (different toolbar)
- [ ] UnsavedChangesGuard prompts on navigation away with unsaved changes

### BLDR-07 — Persist + Save As + Delete

- [ ] Save → reload → changes persist
- [ ] Save As → creates a clone with a new ID → original is unchanged
- [ ] Delete via the Sheet's DeleteDashboardDialog → confirmation → row
      removed from `/dashboards`

### BLDR-08 — Dashboard list

- [ ] `/dashboards` shows all 5 curated dashboards in the list view
- [ ] Each row shows title, description, last modified, creator
- [ ] Search by "SLA" → list filters to `Phase 10 · SLA Overview`
- [ ] No type/dataset filters on the list (dashboards are top-level)

**Findings (Phase 8):**

---

## Phase 9 — Sharing and Views

**Delivered:** URL filter sync (SHAR-02), embed mode (SHAR-03), command
palette (SHAR-04). SHAR-01 saved views deferred.

**Requirements covered:** SHAR-02..04.

### SHAR-02 — Shareable URLs

- [ ] Apply a filter on `Phase 10 · SLA Overview` (region → NAM) → URL
      updates with `?filter.region_code=NAM` after a 300ms debounce
- [ ] Copy the URL → open in a new tab → filter is pre-applied on mount
- [ ] Click the **Share** button (top right) → toast "Link copied" appears
      → clipboard contains the current URL
- [ ] Back button does NOT unwind filter changes (replace mode)
- [ ] Stale / unknown filter IDs in the URL are silently ignored

### SHAR-03 — Embed mode

- [ ] Open `/embed/dashboards/dash-volume` → chromeless layout, no main
      sidebar
- [ ] EmbedTopbar shows the dashboard name + an "Open in RecViz" link
- [ ] `?theme=dark` → `<html>` gets the `dark` class
- [ ] `?filter.region_code=EMEA` → region filter pre-selected
- [ ] `?filter.lock=region_code` → region filter is disabled (lucide-lock
      icon visible)
- [ ] `?hide=filter-bar` → ConfigFilterBar gone, EmbedTopbar still shown
- [ ] `?hide=title` → EmbedTopbar title text hidden, "Open in RecViz" link
      still visible
- [ ] `?hide=toolbar` → DashboardToolbar refresh button gone (also disables
      auto-refresh via the hideToolbar=0 sentinel)
- [ ] `?hide=filter-bar,title,toolbar` → all three surfaces gone in one URL
- [ ] **Known limitation:** SHAR-01 (Saved Views) is deferred — runbook
      does not exercise it.

### SHAR-04 — Command palette

- [ ] Press Cmd+K (or Ctrl+K) → CommandDialog opens with placeholder
      "Search dashboards, charts, datasets, KPIs..."
- [ ] Type "SLA Overview" → `Phase 10 · SLA Overview` appears under the
      "Dashboards" heading → Enter navigates to `/dashboards/dash-sla`
- [ ] Type "Match Rate" → multiple groups appear (Dashboards, Charts,
      KPIs) in canonical TYPE_ORDER (Dashboards → Charts → Datasets → KPIs)
- [ ] Type a curated dataset name ("Transactions — Daily Volume") → result
      under "Datasets" → Enter navigates to `/datasets/:id/edit`
- [ ] Type a curated KPI name ("Avg Match Confidence") → result under
      "KPIs" with the lucide Gauge icon → Enter navigates to
      `/kpis/:id/edit`
- [ ] Chart result → Enter navigates to `/charts/:id/edit` (NOT to a
      dashboard — Phase 9 D-17 bug fix)

**Findings (Phase 9):**

---

## Cross-cutting checks

These touch surfaces shared across multiple phases.

- [ ] `/explorer` Monaco editor loads → schema browser shows the 8
      dimension + 4 fact tables under `recon_data`
- [ ] `SELECT COUNT(*) FROM recon_transactions` returns `100000`
- [ ] Theme toggle on `/settings` switches light/dark globally
- [ ] No broken nav items in the sidebar
- [ ] Sidebar collapses to icon-only mode and back via Cmd+B (or the
      collapse button)
- [ ] `/reports` renders the honest "Coming Soon" Empty component (D-17)
- [ ] No Reports/Export attempts surface fake data
- [ ] Settings → Connections page reflects real connection status

---

## Known limitations (declared but NOT functional / out of scope)

These are intentionally deferred or recognized as not-yet-functional. They
do NOT block Phase 10 sign-off.

| Item | Status | Reason |
|------|--------|--------|
| `bullet` chart type | declared, not functional | Falls back to bar series in `ag-chart-wrapper.tsx`. Not in curated catalog. Out of scope until native renderer wired. |
| `box-plot` chart type | declared, not functional | Same as bullet. |
| `sunburst` chart type | declared, not functional | `echart-wrapper.tsx` lacks the hierarchical JSON transform. |
| Reports page | "Coming Soon" Empty | D-17 — exempt from mock audit. |
| PDF export | "Coming Soon" stub | D-17 — `_jobs` in-memory dict, returns `{"status": "pending"}`. |
| Excel export | "Coming Soon" stub | Same as PDF. |
| Email reports | not built | v2 (REPT-03/04). |
| Saved Views (SHAR-01) | deferred to next milestone | Phase 9 D-18 — `_views` in-memory store left as scaffold. |
| Elasticsearch (DATA-03) | deferred | Phase 4 deferred per PROJECT.md. |
| Authentication / SSO | not built | v2 (SECU-01..04). |
| Mobile / tablet responsive | out of scope | Desktop-only per PROJECT.md. |

---

## Findings log (P0 / P1 / P2 / P3)

Log all findings here as well as inline under the relevant section above.
Format:

```
**Issue (P_):** <description>.
- Discovered during: <Phase X — section name>
- Fix: <inline | sub-phase 10.N | deferred>
- Fix commit: <hash or "TBD">
```

P-rank meanings:
- **P0** — broken / wrong data → MUST fix before close
- **P1** — broken UX, blocker → MUST fix before close
- **P2** — annoying but workable → may defer with explicit log
- **P3** — polish / nit → may defer

### Findings

> _No findings logged yet._

---

## Sign-off

- [ ] All checkboxes above are `[x]`
- [ ] All P0 / P1 findings resolved
- [ ] Mock Audit clean
- [ ] Cross-cutting checks complete
- [ ] User confirms by posting:

```
UAT PASS — Phase 10 closed by <user> on <date>
```

---

*Phase: 10-comprehensive-testing-with-advanced-seed-data*
*Runbook draft created by Plan 10-01c on 2026-04-08*
