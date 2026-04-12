# Phase 7: Explorer Page - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Colorize the SQL Explorer page, migrate the AG Grid query results from the legacy CSS-class theme to the new Theming API, fix the schema browser connection error, delete dead code, verify Save as Dataset flow, and verify arbitrary SQL execution resolves end-to-end through sync `oracledb` via Playwright MCP.

</domain>

<decisions>
## Implementation Decisions

### Schema Browser Fix (EXPL-04)
- **D-01:** Fix seeded `oracle-local` connection in `scripts/seed-oracle.py` — set `schema_name` to `'RECVIZ'` (currently `None`, causing a 400 from the `/api/databases/{id}/tables` endpoint). Oracle convention: schema = uppercase username, and the seed user is `recviz`.
- **D-02:** Keep the 400 error for null `schema_name` — users must explicitly set the Schema field when creating connections. No automatic fallback to username.

### AG Grid Theme Migration (EXPL-03)
- **D-03:** Migrate `query-results.tsx` from legacy CSS class approach (`ag-theme-quartz-dark` / `ag-theme-quartz` via `className`) to the Theming API (`themeQuartz.withPart(colorSchemeDark)` via `theme` prop). Follow the pattern already established in the Datasets page `column-metadata-grid.tsx`.
- **D-04:** Remove all residual `ag-theme-quartz-dark` and `ag-theme-quartz` CSS class references from Explorer files. Grep audit to confirm zero remaining legacy class usage across the entire frontend.

### Dead Code Cleanup
- **D-05:** Delete `frontend/src/components/explorer/chart-builder-dialog.tsx` — it is dead code (imported nowhere, never rendered). The Explorer does not need a "chart it" feature; charts are built from the Charts page.
- **D-06:** Add `chart-builder-dialog.tsx` to `.planning/USAGE-TRACKER.md` as deleted dead code for this phase.

### Save as Dataset Verification
- **D-07:** Verify the Save as Dataset dialog (`save-as-dataset-dialog.tsx`) creates a proper `recviz_datasets` row with: auto-detected columns via `autoDetectColumns()` from `lib/column-detection.ts`, correct `database_id` pre-populated from the Explorer's selected database, and the SQL query from the editor.
- **D-08:** After saving, verify the dataset appears in the Datasets page list and can be opened for editing. The saved dataset must be usable by the chart builder and KPI builder.

### Light Polish
- **D-09:** Schema browser error state improvement — replace bare red text with a structured error component including an icon (AlertCircle), the error message, and a hint to check the connection's Schema field in Settings.
- **D-10:** Results empty state ("Run a query to see results") gets subtle idle animation — icon gentle pulse/fade, matching Phase 3 editor empty state treatment.
- **D-11:** Section header icons on panel headers: Schema Browser gets Database icon, SQL Editor gets Code2 icon. Subtle primary-tinted accent matching Phase 3 section header pattern.
- **D-12:** All Explorer page components must use Shadcn CSS variable colors only. Every element works in both light and dark mode. Monaco editor already handles theme switching correctly — verify no regressions.

### SQL Execution Verification (EXPL-02, EXPL-05)
- **D-13:** Full Explorer lifecycle verified via Playwright MCP against live Oracle: select database from dropdown → browse schema (tables/views list, expand to see columns) → write SQL in Monaco editor → run query (Cmd+Enter or Run button) → see results in AG Grid with row count + execution time → export CSV → copy to clipboard → save as dataset → verify dataset in Datasets page. Both light and dark mode.
- **D-14:** Large result set test — execute a query returning thousands of rows and verify the AG Grid handles it without crashing. Pagination must work (25/50/100 per page selector).
- **D-15:** Error handling test — run intentionally malformed SQL and verify the error state renders correctly with the Oracle error message.

### Claude's Discretion
- Exact empty state animation timing
- Section header icon positioning and accent style
- Schema browser error component layout
- Whether to add subtle panel entrance animations on page load

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — EXPL-01 through EXPL-07
- `.planning/ROADMAP.md` — Phase 7 details, success criteria, known risks/gotchas

### Prior phase context
- `.planning/phases/01-infrastructure-cutover/01-CONTEXT.md` — Oracle setup, Mist+Blue palette, AG Grid token bridge
- `.planning/phases/03-datasets-page/03-CONTEXT.md` — AG Grid Theming API pattern (column-metadata-grid.tsx), section header icons, empty state animations

### Explorer frontend (key files to read)
- `frontend/src/routes/_app/explorer/index.tsx` — Explorer page (IDE layout, database selector, query state)
- `frontend/src/components/explorer/sql-editor.tsx` — Monaco SQL editor with motion/react run state
- `frontend/src/components/explorer/query-results.tsx` — AG Grid results with legacy theme class (MIGRATION TARGET)
- `frontend/src/components/explorer/schema-browser.tsx` — Schema browser with table/column introspection
- `frontend/src/components/explorer/query-history.tsx` — Query history tab
- `frontend/src/components/explorer/save-as-dataset-dialog.tsx` — Save as Dataset dialog
- `frontend/src/components/explorer/chart-builder-dialog.tsx` — DEAD CODE (DELETE)

### Backend
- `backend/app/api/databases.py` — `/tables` endpoint (returns 400 on null schema_name), `/tables/{table}/columns`
- `backend/app/api/sql.py` — `/api/sql/execute` endpoint (direct query execution)
- `scripts/seed-oracle.py` — Seed script, line 2312: `schema_name: None` (FIX TARGET)

### Shared infrastructure
- `frontend/src/lib/column-detection.ts` — `autoDetectColumns()` for Save as Dataset
- `frontend/src/index.css` — Global palette, AG Grid token bridge
- `frontend/src/hooks/use-sql-execute.ts` — SQL execution mutation hook
- `frontend/src/hooks/use-databases.ts` — Database list hook
- `frontend/src/hooks/use-tables.ts` — Table list hook for schema browser
- `frontend/src/hooks/use-table-columns.ts` — Column list hook for schema browser

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `motion/react`: Already imported in `sql-editor.tsx` with `AnimatePresence` for run state feedback — extend to empty states
- AG Grid Theming API: Pattern from Datasets phase `column-metadata-grid.tsx` — `theme={themeQuartz.withPart(colorSchemeDark)}`
- `Empty` component: Available for structured empty/error states
- Monaco editor: Already handles `vs-dark` / `light` theme switching correctly
- `autoDetectColumns()`: Column type detection for Save as Dataset — already exists in `lib/column-detection.ts`

### Established Patterns
- AG Grid Theming API: `themeQuartz` imported from `ag-grid-community`, composed with `colorSchemeDark` from `ag-grid-enterprise` (Phase 3)
- Section header icons: Lucide icon + subtle primary accent (Phase 3)
- Empty state idle animation: icon pulse/fade (Phase 3)

### Integration Points
- `query-results.tsx` line 31: Replace `themeClass` CSS string with `theme` prop using Theming API
- `query-results.tsx` line 145: Replace `className={themeClass}` on grid container div with `theme` prop on AgGridReact
- `scripts/seed-oracle.py` line 2312: Change `None` to `'RECVIZ'`
- Delete `chart-builder-dialog.tsx`

</code_context>

<specifics>
## Specific Ideas

- The Explorer is an IDE-style tool page — heavy motion/animation would be distracting. Light polish is the right level.
- Schema browser error needs a proper structured component, not just red text — it's the first thing users see.
- The AG Grid migration is the most important technical fix — it's the EXPL-03 requirement.
- Save as Dataset is a valuable workflow: explore data → save as dataset → use in chart/KPI builder. Must work end-to-end.
- The schema_name fix in seed is simple but critical — without it, the schema browser never works for seeded data.

</specifics>

<deferred>
## Deferred Ideas

- Resizable panels (ResizablePanel from Shadcn) — would be nice but adds complexity. Potential future enhancement.
- Query autocomplete in Monaco (table/column name suggestions from schema browser data) — would require wiring schema data into Monaco's language service. Future feature.
- Chart builder dialog resurrection — explicitly rejected. Charts are built from the Charts page, not the Explorer.

</deferred>

---

*Phase: 07-explorer-page*
*Context gathered: 2026-04-13*
