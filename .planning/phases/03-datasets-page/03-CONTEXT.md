# Phase 3: Datasets Page - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Colorize the Datasets page (list + create + edit) with the Phase 1 Mist+Blue palette, elevate the UI to Phase 2 premium quality with motion and micro-interactions, add column metadata UX enhancements, and verify dataset CRUD plus parameterized SQL execution end-to-end against Oracle via sync `oracledb`.

</domain>

<decisions>
## Implementation Decisions

### List Page Card Treatment
- **D-01:** Mirror Phase 2 data-source-card treatment exactly — `whileHover={{ y: -2 }}` lift, `border-l-2` accent colored by database type (Oracle = red via `BACKEND_COLORS`), database icon wrapped in `bg-muted rounded-lg p-1.5` container, same shadow/spacing pattern.
- **D-02:** Add column role badges to cards — show colored pills summarizing roles (e.g. "3 measures, 2 dimensions") below the database name. Role colors: dimension=blue, measure=emerald, time=amber, none=gray.
- **D-03:** Row view gets matching treatment — hover lift, `border-l-2` accent, icon container, column role badges. Same visual language as cards, adapted to row layout.

### List Page Toolbar & Transitions
- **D-04:** Toolbar kept as-is functionally (search, database filter, view toggle, New Dataset button) — apply palette tokens to match Phase 2 Settings toolbar style.
- **D-05:** Grid/list view toggle animated with crossfade — `AnimatePresence` with 200ms opacity transition when switching between views.
- **D-06:** Card stagger entrance animation — cards fade+slide in with 50ms stagger delay per card after data loads from skeleton state.
- **D-07:** Filtered empty state ("No datasets matching...") upgraded from bare `<p>` to `Empty` component with search icon — consistent with zero-datasets empty state.

### Editor Section Headers
- **D-08:** Section headers (SQL Editor, Preview, Column Metadata) get Lucide icons (Code2 for SQL, Eye for Preview, Columns3 for Metadata) and a subtle primary-tinted left border or underline accent.
- **D-09:** Add mode badge next to the title area — "New" with primary accent for create mode, "Editing" with muted style for edit mode.

### SQL Editor Toolbar
- **D-10:** Add a SQL Format button to the editor toolbar alongside the existing Run button.
- **D-11:** Run button UX enhanced with Phase 2 connection-test-style state machine: Idle → Running (pulse animation, "Executing...") → Success (green check scale-in, "N rows in Xs") or Error (red shake, error summary). The result area animates in.

### Preview Panel
- **D-12:** Add execution stats bar below the Preview header — show execution time, row count, and column count as styled stat chips (e.g. "247 rows · 12 columns · 0.34s").

### Column Metadata Panel
- **D-13:** Color-coded role badges in AG Grid cells: dimension=blue, measure=emerald, time=amber, none=gray. Color-coded type badges: string=slate, number=violet, date=amber, currency=emerald. Same pill pattern as Phase 2 column badges.
- **D-14:** New/missing column row status upgraded: colored left-border + subtle bg tint (green border + green tint for new rows, red border + red tint for missing rows). Missing rows get strikethrough on name text.
- **D-15:** "Discard all missing" button in Column Metadata header bar — destructive-variant small button that appears conditionally when missing columns exist. Removes all missing columns in one action.
- **D-16:** Inline tooltips on AG Grid column headers — each metadata column header (Type, Role, Aggregation, Format) gets an info icon with a tooltip explaining the field and its options.
- **D-17:** Full help side panel (Sheet) triggered from a button in the Column Metadata header bar. Right-side sheet with comprehensive field reference: Role explained with chart behavior examples, Type with format implications, Aggregation functions detailed, Format presets with live examples. Organized as sections with icons.

### Shared Style Constants
- **D-18:** Move `BACKEND_COLORS`, `BACKEND_LABELS`, `STATUS_STYLES`, `STATUS_LABELS`, `STATUS_BORDER_COLORS` from `settings/data-source-card.tsx` to `lib/style-constants.ts`. This file becomes the shared home for all cross-page style maps (database colors, status styles, column role colors, column type colors). Both Settings and Datasets pages import from there.
- **D-19:** Fix 4 inline `rgba()`/`rgb()` values in `column-metadata-grid.tsx` `getRowStyle` — replace with Tailwind classes using proper `dark:` variants (no hardcoded colors).
- **D-20:** Keep amber warning colors on SQL re-run banner — amber for "needs attention" is a semantic convention established in Phase 2 (AnimatedStatusBadge untested=amber). Proper `dark:` variants already present.

### Empty States & Motion
- **D-21:** "No datasets yet" empty state animated — icon gets scale + fade entrance, subtitle text fades in with slight delay, CTA button pulses gently once on entrance. Professional but alive.
- **D-22:** Editor empty states ("Run a query to see results" / "Run a query to detect columns") get subtle idle animation — Play icon gets gentle pulse/bounce, Columns3 icon gets slow shimmer. Draws eye to action needed.
- **D-23:** Page entrance upgraded from simple opacity fade to staggered: title fades in first, toolbar slides up with slight delay, content area (cards or editor) animates in last. 200ms total, staggered.

### CRUD & SQL Verification (from requirements)
- **D-24:** Full dataset CRUD cycle verified end-to-end against Oracle — list, create (with parameterized SQL using `{{filters}}`, `{{values}}`, `{{date_range_clause}}`), edit, delete. All operations round-trip against Oracle 19c.
- **D-25:** Sample query execution verified — real rows returned from Oracle, no mock data, no thin-mode fallback.

### Claude's Discretion
- Exact animation timing and easing curves for card stagger, view crossfade, and page entrance
- Icon choices for section headers (suggested Code2/Eye/Columns3 but flexible)
- Help sheet content depth and organization
- Exact placement of execution stats chips in the Preview header bar
- Whether SQL Format button uses a library or regex-based formatting

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DATA-01 through DATA-06
- `.planning/ROADMAP.md` — Phase 3 details, success criteria, known risks/gotchas

### Prior phase context
- `.planning/phases/01-infrastructure-cutover/01-CONTEXT.md` — Oracle setup decisions, palette choice, chart theme strategy
- `.planning/phases/02-settings-page/02-CONTEXT.md` — Premium polish patterns (AnimatedStatusBadge, card hover lift, border-l accent, motion/react conventions, column badges)

### Codebase (Datasets page — frontend)
- `frontend/src/routes/_app/datasets/index.tsx` — List page wrapper (motion page transition)
- `frontend/src/routes/_app/datasets/new.tsx` — Create page wrapper
- `frontend/src/routes/_app/datasets/$datasetId.edit.tsx` — Edit page wrapper
- `frontend/src/components/datasets/dataset-list.tsx` — List component (grid/list toggle, search, filter)
- `frontend/src/components/datasets/dataset-card.tsx` — Grid view card (needs Phase 2 treatment)
- `frontend/src/components/datasets/dataset-row.tsx` — List view row (needs Phase 2 treatment)
- `frontend/src/components/datasets/dataset-list-toolbar.tsx` — Search + filter + view toggle + create button
- `frontend/src/components/datasets/dataset-editor.tsx` — Full create/edit editor (SQL editor, results grid, column metadata)
- `frontend/src/components/datasets/dataset-sql-rerun-banner.tsx` — Amber warning banner for stale SQL
- `frontend/src/components/datasets/delete-dataset-dialog.tsx` — Delete confirmation with reference checking
- `frontend/src/components/datasets/column-metadata-grid.tsx` — AG Grid for column metadata (has hardcoded rgba)
- `frontend/src/hooks/use-managed-datasets.ts` — TanStack Query hooks for dataset CRUD
- `frontend/src/types/managed-dataset.ts` — Dataset TypeScript types

### Codebase (Phase 2 patterns to reuse)
- `frontend/src/components/settings/data-source-card.tsx` — Card with hover lift, border-l accent, icon container, AnimatedStatusBadge (D-01 source pattern)
- `frontend/src/components/settings/animated-status-badge.tsx` — Animated badge with motion pulse (reference for run button state machine)
- `frontend/src/components/explorer/sql-editor.tsx` — Monaco SQL editor component used in dataset editor

### Codebase (Backend)
- `backend/app/api/managed_datasets.py` — Dataset CRUD endpoints (list, create, get, update, delete, references)
- `backend/app/services/query_engine.py` — SQL execution with parameterized templates (`_build_sql()` sync path)
- `backend/app/services/query_utils.py` — Query utilities

### Design system
- `frontend/src/index.css` — Mist+Blue palette, series tokens, AG Grid bridge
- `frontend/src/lib/utils.ts` — `cn()` class merge utility

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DataSourceCard` pattern: `whileHover`, `border-l-2`, icon container, `AnimatedStatusBadge` — directly applicable to dataset cards
- `AnimatedStatusBadge`: motion pulse animation pattern — reference for building run button state machine
- `Empty` component: `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` — already used in dataset empty state, extend to filtered-empty state
- `SqlEditor` component: Monaco wrapper with Run button + Cmd+Enter keybinding — needs Format button added
- `Sheet` component (Shadcn): Used for data source detail panel in Phase 2 — reuse for column metadata help panel
- `motion/react`: Already imported in dataset pages for page transitions — extend to card stagger, view crossfade, empty state animations
- AG Grid `themeQuartz` + `colorSchemeDark`: Already correctly used in dataset editor (no migration needed)

### Established Patterns
- Zustand stores: one per concern. No new store needed for this phase.
- CSS variables: `:root` / `.dark` in index.css. Column role/type colors can follow the same pattern or use Tailwind semantic classes.
- Card hover: `motion.div` with `whileHover={{ y: -2 }}` + `transition={{ duration: 0.15, ease: 'easeOut' }}` (from data-source-card)
- Section headers: `bg-muted/30` with `h-9 border-b` (from dataset-editor) — enhance with icons + accent

### Integration Points
- `frontend/src/lib/style-constants.ts` — NEW file: shared style constants moved from `settings/data-source-card.tsx`
- `frontend/src/components/settings/data-source-card.tsx` — Update imports to use `lib/style-constants.ts`
- `frontend/src/components/datasets/dataset-card.tsx` — Update imports to use `lib/style-constants.ts`
- `frontend/src/components/datasets/dataset-row.tsx` — Update imports to use `lib/style-constants.ts`

</code_context>

<specifics>
## Specific Ideas

- Cards should mirror the Phase 2 data-source-card exactly in terms of visual treatment — hover lift, border accent, icon container
- Run button state machine should feel like Phase 2's connection test: deliberate, animated, professional
- Column metadata help panel should be a full Sheet (not a tooltip or drawer) with comprehensive field reference — the user explicitly wants depth here, not a quick cheat sheet
- The "Discard all missing" button should only appear conditionally when missing columns exist
- Column role badges on cards should be compact pills that summarize without taking too much space (e.g. "3 measures · 2 dims" not individual badges per column)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-datasets-page*
*Context gathered: 2026-04-12*
