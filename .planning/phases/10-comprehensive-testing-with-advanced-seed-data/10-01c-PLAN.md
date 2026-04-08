---
phase: 10-comprehensive-testing-with-advanced-seed-data
plan: 01c
type: execute
wave: 3
depends_on:
  - 10-01b
files_modified:
  - frontend/e2e/chart-showcase.spec.ts
  - frontend/e2e/tlm-stats-regression.spec.ts
  - frontend/e2e/share-link.spec.ts
  - frontend/e2e/embed.spec.ts
  - frontend/e2e/dashboard-edit-regression.spec.ts
  - frontend/e2e/dashboard-view-regression.spec.ts
  - frontend/e2e/command-palette.spec.ts
  - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-UAT-RUNBOOK.md
autonomous: false
requirements:
  - INFR-01
  - INFR-02
  - INFR-03
  - INFR-04
  - INFR-05
  - INFR-06
  - INTR-01
  - INTR-02
  - INTR-03
  - INTR-04
  - INTR-05
  - INTR-06
  - INTR-07
  - INTR-08
  - INTR-09
  - BLDR-01
  - BLDR-02
  - BLDR-03
  - BLDR-04
  - BLDR-05
  - BLDR-06
  - BLDR-07
  - BLDR-08
  - SHAR-02
  - SHAR-03
  - SHAR-04

must_haves:
  truths:
    - "The 7 existing Playwright specs are rewritten against the curated catalog using _fixtures.ts and no longer reference chart-showcase/tlm-stats/ephemeral POST seeds"
    - "tlm-stats-regression.spec.ts is deleted per RESEARCH.md §4 Option A"
    - "10-UAT-RUNBOOK.md exists with one section per phase 1-9, each with concrete capability checkboxes derived from ROADMAP.md success criteria"
    - "10-UAT-RUNBOOK.md phase 8 section headings mirror the 'Phase 10 ·' prefix convention so users can visually cross-reference dashboards (M-3)"
    - "Full test suite green one final time: vitest + playwright (all 6 rewritten specs) + pytest"
    - "Full-stack verification: all 5 curated dashboards load in a real browser without error panels"
  artifacts:
    - path: "frontend/e2e/chart-showcase.spec.ts"
      provides: "Parameterized dashboard smoke spec covering all 5 curated dashboards"
      contains: "CURATED_DASHBOARDS"
    - path: "frontend/e2e/command-palette.spec.ts"
      provides: "Rewritten palette spec with 4 stable-slug tests"
      contains: "dash-sla"
    - path: ".planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-UAT-RUNBOOK.md"
      provides: "Phase-by-phase manual UAT runbook — draft created here, consumed by Plan 10-02 walk and Plan 10-03 polish"
      contains: "## Phase 1"
  key_links:
    - from: "frontend/e2e/*.spec.ts"
      to: "frontend/e2e/_fixtures.ts"
      via: "import CURATED_DASHBOARDS / waitForDashboardLoad"
      pattern: "from.*_fixtures"
    - from: "10-UAT-RUNBOOK.md phase 8 section"
      to: "frontend/e2e/_fixtures.ts DASHBOARD_NAMES"
      via: "runbook headings mirror the pinned 'Phase 10 ·' prefix (M-3 convention)"
      pattern: "Phase 10 ·"

user_setup: []
---

<objective>
Plan 10-01c closes out the 10-01 split by (Task 5) rewriting the 7 E2E specs against the stable curated catalog, (Task 6) generating the initial `10-UAT-RUNBOOK.md` draft, and (Task 7) running full-stack verification on a fresh seed via a checkpoint.

Purpose: Lock in the test scaffolding and documentation artifacts required by Plan 10-02's autonomous walkthrough. After this plan, Claude has a reproducible stack, green test suite, and a runbook skeleton.

Output: 6 rewritten Playwright specs (tlm-stats deleted), 10-UAT-RUNBOOK.md draft, and a user-verified full-stack baseline.
</objective>

<execution_context>
@/Users/aarun/Workspace/Projects/RecViz/.claude/get-shit-done/workflows/execute-plan.md
@/Users/aarun/Workspace/Projects/RecViz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-CONTEXT.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-VALIDATION.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-01a-SUMMARY.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-01b-SUMMARY.md
@.planning/ROADMAP.md
@CLAUDE.md

<interfaces>
<!-- Spec rewrite helpers from frontend/e2e/_fixtures.ts (Plan 10-01a) -->

```typescript
export const DASHBOARD_NAMES = {
  'dash-sla': 'Phase 10 · SLA Overview',
  'dash-aging': 'Phase 10 · Aging Analysis',
  'dash-match-rate': 'Phase 10 · Match Rate Tracker',
  'dash-volume': 'Phase 10 · Volume Dashboard',
  'dash-breaks-summary': 'Phase 10 · Breaks Summary',
} as const

export const CURATED_DASHBOARDS = {
  sla: { id: 'dash-sla', name: DASHBOARD_NAMES['dash-sla'] },
  aging: { id: 'dash-aging', name: DASHBOARD_NAMES['dash-aging'] },
  matchRate: { id: 'dash-match-rate', name: DASHBOARD_NAMES['dash-match-rate'] },
  volume: { id: 'dash-volume', name: DASHBOARD_NAMES['dash-volume'] },
  breaksSummary: { id: 'dash-breaks-summary', name: DASHBOARD_NAMES['dash-breaks-summary'] },
} as const

export async function waitForDashboardLoad(page: Page, dashboardName: string): Promise<void> {
  await page.locator('h1', { hasText: dashboardName }).waitFor({ state: 'visible', timeout: 15_000 })
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 15_000 })
}
```

Chart library routes (Q-5 RESOLVED):
- `/charts/new` → single-page accordion wizard (no URL segments per step)
- `/charts/:chartId/edit` → single-page editor

Command palette specific:
- Palette opens via `Meta+K`
- Groups results by TYPE_ORDER (dashboards, charts, kpis, datasets)
- Dataset result Enter → `/datasets/:id/edit`
- KPI result Enter → `/kpis/:id/edit`
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Rewritten E2E specs → running localhost services | Test runner hits backend :8000 + frontend :5173 |
| Runbook markdown → user manual verification | Pure documentation boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10c-01 | Elevation of privilege (E) | Rewritten specs hitting unprotected endpoints | accept | No auth in v1 per PROJECT.md. Localhost only. Same posture as current specs. |
| T-10c-02 | Tampering (T) | Runbook markdown drift from actual dashboard behavior | mitigate | Task 6 generates the runbook from RESEARCH.md + ROADMAP.md success criteria; Plan 10-02 walks every item and tags with [Claude-checked] against live state. Task 7 checkpoint forces a full-stack verification before handoff. |

All high-rated threats have mitigations or explicit rationales.
</threat_model>

<tasks>

<task type="auto">
  <name>Task 5: Rewrite the 7 E2E specs against curated slugs</name>
  <files>
    frontend/e2e/chart-showcase.spec.ts (REWRITE — dashboard-smoke),
    frontend/e2e/tlm-stats-regression.spec.ts (DELETE),
    frontend/e2e/share-link.spec.ts (REWRITE),
    frontend/e2e/embed.spec.ts (REWRITE),
    frontend/e2e/dashboard-edit-regression.spec.ts (REWRITE),
    frontend/e2e/dashboard-view-regression.spec.ts (REWRITE),
    frontend/e2e/command-palette.spec.ts (REWRITE)
  </files>
  <read_first>
    - frontend/e2e/chart-showcase.spec.ts (current — parameterized chart loop pattern)
    - frontend/e2e/share-link.spec.ts (current — ephemeral seed pattern being replaced)
    - frontend/e2e/embed.spec.ts (current — ephemeral seed + finally cleanup)
    - frontend/e2e/command-palette.spec.ts (current — random name with timestamp pattern)
    - frontend/e2e/_fixtures.ts (from Plan 10-01a — CURATED_* constants)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §4 (spec-by-spec rewrite plan)
  </read_first>
  <action>
For each spec, follow RESEARCH.md §4 plan.

1. **chart-showcase.spec.ts (dashboard-smoke):** Replace the opening goto with a parameterized test over `CURATED_DASHBOARDS`. Each of the 5 dashboards gets a describe block with tests for (a) renders without error panels, (b) renders at least one chart canvas, (c) KPI row shows numeric values. Use the pattern:
```typescript
import { test, expect } from '@playwright/test'
import { CURATED_DASHBOARDS, waitForDashboardLoad } from './_fixtures'

for (const [key, dashboard] of Object.entries(CURATED_DASHBOARDS)) {
  test.describe(`${dashboard.name} (${key})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/dashboards/${dashboard.id}`)
      await waitForDashboardLoad(page, dashboard.name)
    })
    test('renders without error panels', async ({ page }) => {
      await expect(page.locator('text=Column mapping error')).toHaveCount(0)
      await expect(page.locator('text=Unsupported chart type')).toHaveCount(0)
      await expect(page.locator('text=Failed to load')).toHaveCount(0)
      await expect(page.locator('text=Data source not found')).toHaveCount(0)
    })
    test('renders at least one chart canvas', async ({ page }) => {
      const hasCanvas = await page.locator('canvas, [_echarts_instance_]').first().isVisible({ timeout: 10_000 })
      expect(hasCanvas).toBe(true)
    })
    test('KPI row shows numeric values', async ({ page }) => {
      const kpis = page.locator('[data-slot="kpi-value"]')
      await expect(kpis.first()).toBeVisible()
      await expect(kpis).not.toHaveText(/^—$/)
    })
  })
}
```
Note: if `data-slot="kpi-value"` is not the actual attribute, check the KPI card component and use the real attribute.

2. **tlm-stats-regression.spec.ts:** DELETE (per RESEARCH.md §4 Spec 2 Option A).

3. **share-link.spec.ts:** Rewrite to navigate to `/dashboards/${CURATED_DASHBOARDS.sla.id}?filter.region_code=NAM`, verify filter hydration. Apply a filter manually, assert URL updates, click Share, assert toast "Link copied". Drop all POST/DELETE ephemeral calls and finally blocks.

4. **embed.spec.ts:** Rewrite all 7 tests to point at `/embed/dashboards/${CURATED_DASHBOARDS.sla.id}` with query strings: `?theme=dark`, `?filter.region_code=EMEA`, `?filter.lock=region_code`, `?hide=filter-bar,title,toolbar`. Drop ephemeral seeders. Use `CURATED_DASHBOARDS.sla.name` for h1 assertions.

5. **dashboard-edit-regression.spec.ts:** Rewrite to navigate to `/dashboards/${CURATED_DASHBOARDS.sla.id}/edit`, wait for BuilderPage, assert zero console errors + chart panel visible. Drop ephemeral seed.

6. **dashboard-view-regression.spec.ts:** Rewrite to navigate to `/dashboards/${CURATED_DASHBOARDS.volume.id}`, assert h1 visible, assert no "Dashboard not found".

7. **command-palette.spec.ts:** Rewrite to:
   - Press Meta+K, type "SLA", assert `Phase 10 · SLA Overview` appears, press Enter, assert URL → `/dashboards/dash-sla`
   - Type "Match Rate", assert multiple groups (Dashboards, Charts, KPIs) in TYPE_ORDER
   - Type "Transactions — Daily Volume", press Enter on dataset result, assert URL → `/datasets/ds-recon-transactions-daily/edit`
   - Type "Match Rate" (the KPI), press Enter on KPI result, assert URL → `/kpis/kpi-match-rate/edit`

After rewrites, run `cd frontend && pnpm exec playwright test --list` to confirm all tests collect without errors.
  </action>
  <verify>
    <automated>cd frontend && pnpm exec playwright test --list 2>&1 | head -60</automated>
  </verify>
  <done>
6 rewritten specs (+1 deleted). All tests collect without file-level errors. Each spec imports from `_fixtures` and references stable curated slugs.
  </done>
</task>

<task type="auto">
  <name>Task 6: Generate initial 10-UAT-RUNBOOK.md draft</name>
  <files>.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-UAT-RUNBOOK.md</files>
  <read_first>
    - .planning/ROADMAP.md (success criteria for phases 1-9)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §2.4 (dashboard themes + compositions)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §Open Questions RESOLVED (to mention sunburst exclusion and inverted KPIs as known non-issues)
    - frontend/e2e/_fixtures.ts (DASHBOARD_NAMES — use the 'Phase 10 ·' prefixed names in runbook headings for M-3 consistency)
    - .planning/phases/01-foundation-hardening/01-CONTEXT.md through 09-sharing-and-views/09-CONTEXT.md (skim each — runbook sections reflect each phase's acceptance criteria)
  </read_first>
  <action>
Create `.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-UAT-RUNBOOK.md` with this structure:

```markdown
# Phase 10 — UAT Runbook

**Created:** <today's date> (Plan 10-01c)
**For:** User manual regression after Plan 10-02 autonomous walkthrough completes
**Status:** draft — updated in Plan 10-02 with [Claude-checked] tags, finalized in Plan 10-03

## How to use this runbook

1. Walked twice: first by Claude via Playwright MCP (Plan 10-02), then by user manually (Plan 10-03 → user step)
2. Each section mirrors a phase from the roadmap
3. Mark items `[x]` when observed. Log issues inline as `**Issue:** ...`
4. Phase 10 ships when every checkbox is `[x]`, all P0/P1 issues resolved, user posts "UAT PASS"

## Canonical dashboard names (M-3 convention)

All 5 curated dashboards use the `Phase 10 ·` prefix to visually distinguish them from user-created experiments:
- `Phase 10 · SLA Overview` (`dash-sla`)
- `Phase 10 · Aging Analysis` (`dash-aging`)
- `Phase 10 · Match Rate Tracker` (`dash-match-rate`)
- `Phase 10 · Volume Dashboard` (`dash-volume`)
- `Phase 10 · Breaks Summary` (`dash-breaks-summary`)

These names are pinned in `frontend/e2e/_fixtures.ts` DASHBOARD_NAMES and cross-checked at test time.

## Mock audit

- [ ] `bash scripts/mock-audit.sh` exits 0 with "mock-audit: clean"
- [ ] No placeholder strings (Lorem, TBD, coming soon OTHER than Reports/Export) on any dashboard
- [ ] Every KPI on every dashboard shows a numeric value, not `—`
- [ ] Every chart renders content — no empty panels, no "No data available" unless filter is set to exclude everything

## Phase 1 — Foundation Hardening

**Delivered:** Number formatting, mock removal, dead code cleanup, Superset hardening, DB-backed config store.

- [ ] KPI currency values render as "$1.2M" / "$12.5K" / "$1,234.56" (en-US locale)
- [ ] KPI percentage values render with 1-2 decimals (e.g., "92.5%")
- [ ] Dark mode toggle works on every curated dashboard (all 5)
- [ ] Light → dark → light round-trip produces identical visual state
- [ ] No red error banners on any dashboard load
- [ ] `bash scripts/mock-audit.sh` passes

## Phase 2 — Cross-Filtering and Drill-Down

**Delivered:** Cross-filter on chart segment click, drill-down breadcrumb, detail grid.

- [ ] On `Phase 10 · Volume Dashboard`, click a bar in `chart-txn-by-region-bar` → "Filtered by:" bar appears
- [ ] Other charts dim to indicate filtered state
- [ ] Click "Clear all" → all charts return to full state
- [ ] On `Phase 10 · SLA Overview`, double-click a cell in `chart-txn-status-stacked` → drill breadcrumb (Overview → Region → Status)
- [ ] Click "Overview" → returns to top level
- [ ] Drill-down detail grid shows transaction detail rows with AG Grid sort/filter/pagination

## Phase 02.1 — Chart Rendering Foundation

**Delivered:** All chart types render correctly from query data.

- [ ] Every chart type in the curated catalog renders on its dashboard (22 charts across 5 dashboards, covering all 18 working chart types)
- [ ] Bar / line / area charts use correct x-axis (non-metric) and y-axis (metric)
- [ ] Pie / donut charts show correct slice labels
- [ ] Scatter chart on `Phase 10 · Volume Dashboard` renders 5000 points without stutter
- [ ] Heatmap on `Phase 10 · SLA Overview` renders SLA type × region matrix
- [ ] Treemap on `Phase 10 · Volume Dashboard` shows asset_class → desk hierarchy
- [ ] Waterfall chart on `Phase 10 · Aging Analysis` and `Phase 10 · SLA Overview` renders
- [ ] Sankey on `Phase 10 · Aging Analysis` renders
- [ ] Radar on `Phase 10 · SLA Overview` renders
- [ ] Gauge on `Phase 10 · SLA Overview` renders
- [ ] Funnel on `Phase 10 · Match Rate Tracker` renders
- [ ] Graph on `Phase 10 · Breaks Summary` renders
- [ ] Parallel coordinates on `Phase 10 · Volume Dashboard` renders
- [ ] Histogram on `Phase 10 · Breaks Summary` renders (note: falls back to bar series in ag-chart-wrapper, but vizType=histogram is considered a working visual variant)
- [ ] Combo chart on `Phase 10 · Match Rate Tracker` renders (line + bar overlay)
- [ ] Stacked-bar chart on `Phase 10 · SLA Overview` renders
- [ ] **Area chart** (`chart-txn-trend-area`) on `Phase 10 · Volume Dashboard` renders (Q-3b RESOLVED)
- [ ] **Known limitations (declared but NOT in curated catalog — user correction 2026-04-08):**
  - `bullet` — declared in SUPPORTED_AG_TYPES but `ag-chart-wrapper.tsx:179-187` falls back to `type: 'bar'` (does not render as a bullet). Not tested.
  - `box-plot` — declared in SUPPORTED_AG_TYPES but `ag-chart-wrapper.tsx:189-197` falls back to `type: 'bar'`. Not tested.
  - `sunburst` — declared in ECHART_TYPES but requires a hierarchical JSON transform in `echart-wrapper.tsx` that is not wired in. Not tested.
  - If any of these become real requirements, wire the native renderers in a follow-up sub-phase.

## Phase 3 — Chart and Grid Interactions

**Delivered:** Fullscreen modal, chart export (PNG/CSV/clipboard), grid export (CSV/Excel), manual + auto refresh.

- [ ] Hover over any chart → toolbar appears (fullscreen + export icons)
- [ ] Click fullscreen → modal opens, chart renders identically, Esc closes
- [ ] Click export → PNG → file downloads
- [ ] Click export → CSV → file downloads
- [ ] Click export → Copy to clipboard → toast "Copied to clipboard"
- [ ] Click grid toolbar CSV export → file downloads
- [ ] Click grid toolbar Excel export → file downloads
- [ ] Click manual refresh button → skeletons flash, data re-renders
- [ ] Auto-refresh fires at configured interval

## Phase 4 — Data Source Connectivity

**Delivered:** Oracle + Hive connection UI, test-before-save, connection status.

- [ ] `/settings` → data sources shows the 4 configured logical databases
- [ ] Each database row shows a connection status dot
- [ ] Click "Test connection" → toast confirms success/failure
- [ ] **Known limitation:** Elasticsearch (DATA-03) is deferred per PROJECT.md

## Phase 5 — Dataset Management

**Delivered:** Dataset CRUD, Monaco SQL editor, column metadata, test-execute preview.

- [ ] `/datasets` shows all 16 curated datasets (`ds-*`)
- [ ] Click any dataset → edit page loads Monaco SQL editor with dataset's SQL
- [ ] Column metadata table shows name, data type, role, aggregation, format
- [ ] Click "Run query" → preview grid shows real data from the seed
- [ ] Create a new dataset via "New Dataset" button → saves → appears in list
- [ ] Delete the test dataset → confirmation → removal succeeds

## Phase 6 — Chart Library

**Delivered:** Chart builder wizard, 20+ supported chart types, library with search.

- [ ] `/charts` shows all 22 curated charts with preview thumbnails (user correction 2026-04-08: 22 not 24 — bullet + box-plot removed, all 18 working types still covered)
- [ ] Search by "Volume" → filters correctly
- [ ] Click any chart → `/charts/:id/edit` single page loads with dataset picker, chart type selector, column mapping, live preview
- [ ] Preview updates live as column mappings change
- [ ] Save a new chart → appears in library
- [ ] `/charts/new` loads the single-page accordion wizard (Q-5 RESOLVED — no URL segments per step)
- [ ] Chart type selector shows every supported AG + ECharts type

## Phase 7 — KPI Library

**Delivered:** KPI templates with format + trend + threshold bands.

- [ ] `/kpis` shows all 12 curated KPIs
- [ ] **Green band:** `kpi-match-rate` renders in green (real match rate ~92% > 90 threshold)
- [ ] **Amber band:** `kpi-avg-confidence` renders in amber (real ~0.77 between 0.70 and 0.85)
- [ ] **Red band (inverted per Q-4 RESOLVED):** `kpi-total-breaks` renders in red (seeded ~20000 < 30000 amber_above)
- [ ] **Amber band (inverted):** `kpi-avg-aging-days` renders in amber (seeded ~4.5, amber_above=4)
- [ ] **Amber band (inverted):** `kpi-sla-breach-rate` renders in amber (seeded ~8, amber_above=6)
- [ ] Number / currency / percentage / decimal formats all render per config
- [ ] `previous_period` trend mode shows % change from last day/week/month
- [ ] `static_target` trend mode shows comparison to target
- [ ] Animated counter rolls up (~0.8-1s)

## Phase 8 — Dashboard Builder

**Delivered:** Drag-drop builder, grid layout, chart/KPI picker, filter config, save/save-as/delete.

- [ ] `/dashboards/new` opens empty builder
- [ ] Add a chart from library → appears on canvas
- [ ] Drag the chart → snaps to grid
- [ ] Resize the chart → snaps to grid
- [ ] Add a KPI from library → appears on canvas
- [ ] Add a filter → FilterConfigDialog opens with dataset column picker
- [ ] Click "Edit" on `Phase 10 · SLA Overview` → enters edit mode
- [ ] Edit mode and view mode are visually distinct
- [ ] Save → persists → reload → changes preserved
- [ ] Save As → creates a clone
- [ ] Delete → confirmation → removal succeeds

## Phase 9 — Sharing and Views

**Delivered:** URL filter sync, share button, embed mode, command palette.

- [ ] Apply a filter on `Phase 10 · SLA Overview` → URL updates with `?filter.region_code=NAM`
- [ ] Copy URL, open in new tab → filter pre-applied
- [ ] Click "Share" → toast "Link copied"
- [ ] Open `/embed/dashboards/dash-sla` → chromeless layout, embed topbar shows "Open in RecViz"
- [ ] `?theme=dark` applies dark mode
- [ ] `?filter.region_code=EMEA` pre-applies filter
- [ ] `?filter.lock=region_code` disables the filter
- [ ] `?hide=filter-bar,title,toolbar` hides all three surfaces
- [ ] Press Cmd+K → palette opens
- [ ] Type "SLA" → `Phase 10 · SLA Overview` appears (M-3 prefixed name)
- [ ] Type "Match Rate" → multiple groups (Dashboards, Charts, KPIs) in TYPE_ORDER
- [ ] Enter on chart result → `/charts/:id/edit`
- [ ] Enter on dataset result → `/datasets/:id/edit`
- [ ] Enter on KPI result → `/kpis/:id/edit`

## Reports + Export (exempt from mock audit per D-17)

- [ ] `/reports` renders honest "Coming Soon" empty state — verify it's a Shadcn Empty component, not a broken attempt at data

## Cross-cutting

- [ ] `/explorer` Monaco loads, schema browser shows 8 dim + 4 fact tables
- [ ] `SELECT COUNT(*) FROM recon_transactions` returns 100000
- [ ] Theme toggle on `/settings` switches light/dark
- [ ] No broken nav items in the sidebar

## Findings log

Log P0/P1/P2/P3 issues inline under the relevant section as:
```
**Issue (P1):** <description>. **Fix commit:** <hash or "TBD">.
```

## Sign-off

- [ ] User posts "UAT PASS" when all boxes above are checked and no P0/P1 issues remain unresolved.
```
  </action>
  <verify>
    <automated>test -f .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-UAT-RUNBOOK.md && grep -c '^## Phase' .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-UAT-RUNBOOK.md</automated>
  </verify>
  <done>
10-UAT-RUNBOOK.md exists, contains all phase sections (grep returns 10+ including 02.1), references stable curated slugs AND the 'Phase 10 ·' prefixed names, documents inverted KPI threshold bands per Q-4 RESOLVED, and documents sunburst exclusion per Q-3 RESOLVED.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 7: Full-stack verification — run seed, boot stack, walk 5 dashboards via Playwright E2E smoke pass</name>
  <files>scripts/seed-postgres.py, frontend/e2e/chart-showcase.spec.ts, .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-UAT-RUNBOOK.md</files>
  <read_first>
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-01b-SUMMARY.md (confirm seed script and tests green)
    - frontend/e2e/chart-showcase.spec.ts (the rewritten dashboard-smoke)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-UAT-RUNBOOK.md (the draft runbook)
  </read_first>
  <action>
This is a human-verification checkpoint. Plan 10-01 (a+b+c combined) deliverables across all three sub-plans:
1. scripts/mock-audit.sh (Plan 10-01a)
2. frontend/e2e/_fixtures.ts with DASHBOARD_NAMES (Plan 10-01a)
3. backend/tests/test_seed_script.py with 16 passing tests (Plan 10-01b Task 4)
4. Dead code cleanup: 4 dead hooks, barrel export, RoH fix, 2 legacy backend routers, legacy JSON configs (Plan 10-01a Task 2)
5. scripts/seed-postgres.py rewritten with dual-row pattern + `Phase 10 ·` naming + chart-txn-trend-area on dash-volume + inverted-KPI thresholds (Plan 10-01b Task 3)
6. 6 rewritten E2E specs + 1 deleted (Plan 10-01c Task 5)
7. 10-UAT-RUNBOOK.md draft (Plan 10-01c Task 6)
8. frontend/e2e/_dashboard-names.json emitted by seed (Plan 10-01b Task 3)

Post a handoff block to the user with these exact steps to run manually:

**Step 1 — Reset the stack and re-run seed (canonical Q-1 RESOLVED sequence):**
```
cd /Users/aarun/Workspace/Projects/RecViz
docker compose down -v
docker compose up -d
sleep 10
python scripts/seed-postgres.py
```
Expected: Seed completes in 30-60s with `Seed complete.` at the end.

**Step 2 — Confirm managed tables populated + M-3 naming:**
```
docker compose exec postgres psql -U postgres -d superset_meta -c "SELECT id, name FROM recviz_dashboards ORDER BY id;"
```
Expected: 5 rows, all names begin with `Phase 10 ·`.

**Step 3 — Start backend + frontend (if not already running):**
```
cd backend && uvicorn app.main:app --reload &
cd frontend && pnpm dev &
```
Wait ~10s for both to boot.

**Step 4 — Run the full test suite:**
```
cd frontend && pnpm vitest run
cd frontend && pnpm exec playwright test --reporter=list
cd backend && python -m pytest tests/ -v
```
Expected: all green. The test_dashboard_names_match_fixtures should pass.

**Step 5 — Run mock-audit:**
```
bash scripts/mock-audit.sh
```
Expected: exit 0.

**Step 6 — Manually navigate to all 5 dashboards in the browser:**
- http://localhost:5173/dashboards/dash-sla
- http://localhost:5173/dashboards/dash-aging
- http://localhost:5173/dashboards/dash-match-rate
- http://localhost:5173/dashboards/dash-volume
- http://localhost:5173/dashboards/dash-breaks-summary

For each: page title visible (with the `Phase 10 ·` prefix), KPIs render with the correct color band (red/amber for inverted KPIs per Q-4 RESOLVED), charts render, no red error banners.

Pause and wait for user confirmation. Type "approved" to proceed to Plan 10-02, or describe issues for inline fix.
  </action>
  <verify>
    <automated>MISSING — human verification checkpoint. User walks the steps and confirms.</automated>
  </verify>
  <done>
User types "approved" after walking Steps 1-6. Any issues fixed inline before Plan 10-02 begins.
  </done>
  <resume-signal>Type "approved" if all steps pass, or describe issues found so they can be fixed inline before Plan 10-02 begins.</resume-signal>
</task>

</tasks>

<verification>
Plan 10-01c is complete when:

1. 6 rewritten E2E specs + 1 deleted, all collecting without file errors
2. `cd frontend && pnpm exec playwright test` passes against the live seed
3. 10-UAT-RUNBOOK.md exists with all phase sections, references 'Phase 10 ·' prefixed names, documents inverted KPIs and sunburst exclusion
4. Task 7 full-stack verification checkpoint approved by user
5. All 5 curated dashboards load in a real browser
</verification>

<success_criteria>
After Plan 10-01c:
- Complete Plan 10-01 deliverable (a+b+c) is landed
- E2E specs are stable and reference curated slugs
- UAT runbook draft is ready for Plan 10-02 walkthrough
- User has verified the full stack against the fresh seed
</success_criteria>

<output>
After completion, create `.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-01c-SUMMARY.md` documenting:
- 6 rewritten spec file paths + line counts
- 1 deleted spec
- 10-UAT-RUNBOOK.md section count
- Full-stack verification result
- Final test suite counts (vitest + playwright + pytest)
- Handoff signal for Plan 10-02
</output>
