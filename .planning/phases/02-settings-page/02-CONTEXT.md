# Phase 2: Settings Page - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Colorize the Settings page end-to-end with the Phase 1 Mist+Blue palette, elevate the UI to premium quality with micro-interactions and motion, implement the dead Density/Font Size stubs, verify Data Sources CRUD end-to-end against Oracle, and keep the Saved Views tab functional as-is.

</domain>

<decisions>
## Implementation Decisions

### Density & Font Size (SETT-05)
- **D-01:** Implement both Density and Font Size as functional controls (not delete).
- **D-02:** Create a `display-store.ts` Zustand store with `density: 'comfortable' | 'compact'` and `fontSize: 'small' | 'medium' | 'large'`. Persisted in localStorage.
- **D-03:** Store writes CSS variables to `:root` — `--spacing-scale` for density, `--font-scale` for font size. Affects all pages globally.

### Settings Page Layout
- **D-04:** Expand layout from `max-w-3xl` (768px) to `max-w-5xl` (~1024px). Centered, not edge-to-edge. Gives cards more breathing room and Data Sources grid more columns.
- **D-05:** Add `motion/react` tab transition animations between Appearance, Saved Views, and Data Sources tabs.

### Theme Selector
- **D-06:** Replace plain icon+text buttons with live preview cards. Each theme option (Light, Dark, System) shows a mini-mockup sketch of the UI in that theme (sidebar + content area). Animated border on active selection.

### Data Source Status Indicator
- **D-07:** Replace tiny `size-2` dot + `text-[10px]` label with an animated status badge. Green pulse for connected, red for unreachable, amber for untested. Badge shows status text. Card itself gets a subtle left-border color matching status.

### Data Source Connection Test UX
- **D-08:** Animated state machine for the Test Connection flow: Idle → Testing (pulse animation, "Connecting...") → Success (green check scale-in, "Connected in {N}s") or Failure (red X shake, error message). The entire test area animates, not just the button. Uses `motion/react`.

### Data Source Detail Panel
- **D-09:** Top of panel shows a connection health summary: animated status badge + last tested time (already stored in DB, no extra queries). Below that: host/port/service/schema as a compact 2-column info grid.
- **D-10:** Dataset list uses stored metadata only (name, column count, description). NO live row-count queries — Citi tables have millions of rows and COUNT(*) would block. No expensive queries on panel open.

### Data Source CRUD Against Oracle
- **D-11:** Verify the full CRUD cycle end-to-end: create new connection → test connection → save → re-open and edit → delete. All operations round-trip against Oracle 19c.
- **D-12:** Connection test must use `build_oracle_engine()` from Phase 1 — no silent thin-mode fallback. The test endpoint must go through the same thick-mode path as production queries.
- **D-13:** Encryption service must wire real Fernet-encrypted passwords on create/save (not placeholders).
- **D-14:** Optionally spin up a second Oracle Docker container on a different port for testing "create new data source" flow with a genuinely separate connection.

### Saved Views Tab
- **D-15:** Keep the Saved Views tab as-is. No backend changes this phase. Frontend stays functional (list, load, delete). Colorization via Phase 1 palette tokens is sufficient.

### Colorization & Premium Polish
- **D-16:** All Settings page components must use Shadcn CSS variable colors only — no hardcoded hex/rgb/hsl. Every element must work in both light and dark mode.
- **D-17:** Frontend-design skill must be used during execution to ensure premium micro-interactions: tab transitions, card hover states, form focus animations, status pulse effects, sheet open/close motion. Not just functional code — visually polished.

### Discovered Fix: Status Display
- **D-18:** The status indicator on Data Source cards IS present but is too subtle (2px dot, 10px text). Enhanced via D-07 above.

### Claude's Discretion
- Exact CSS variable names and values for density/font-size scaling
- Mini-mockup design for theme preview cards (SVG or CSS-drawn)
- Animation timing and easing curves for connection test state machine
- Info grid layout specifics for the detail panel
- Whether to use a second Oracle Docker container or test CRUD against the existing one

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SETT-01 through SETT-07
- `.planning/ROADMAP.md` — Phase 2 details, success criteria, known risks/gotchas

### Prior phase context
- `.planning/phases/01-infrastructure-cutover/01-CONTEXT.md` — Oracle setup decisions (D-01 through D-30), palette choice, chart theme strategy

### Codebase (Settings page)
- `frontend/src/routes/_app/settings/index.tsx` — Main settings page (Appearance, Saved Views, Data Sources tabs)
- `frontend/src/components/settings/data-source-sheet.tsx` — Data source create/edit/detail panel (848 lines)
- `frontend/src/components/settings/data-source-card.tsx` — Card component with status dot, backend colors
- `frontend/src/components/settings/data-sources-tab.tsx` — Data sources tab container
- `frontend/src/components/settings/data-sources-toolbar.tsx` — Search + view toggle + Add Source button

### Backend (Data Sources API)
- `backend/app/api/databases.py` — Connection CRUD, schema introspection, connection testing
- `backend/app/services/engine_manager.py` — Engine registry with `build_oracle_engine()`
- `backend/app/services/encryption.py` — Fernet encryption for stored passwords

### Design system
- `frontend/src/index.css` — Mist+Blue palette, series tokens, AG Grid bridge (from Phase 1)
- `.planning/phases/01-infrastructure-cutover/01-UI-SPEC.md` — UI design contract with exact oklch values

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data-source-sheet.tsx` (848 lines) — Full create/edit/detail modes already implemented. Needs polish, not rewrite.
- `data-source-card.tsx` — Card with StatusDot component. Needs visual upgrade (D-07) but structure is sound.
- `BACKEND_FIELDS` config in sheet — Already Oracle-only with proper field definitions (host, port, service name, schema, username, password).
- `useDatabase`, `useCreateDatabase`, `useUpdateDatabase`, `useDeleteDatabase`, `useTestConnection` hooks — All wired to TanStack Query. CRUD infrastructure exists.
- `motion/react` already in the project — Used in page transitions, count animations. Available for micro-interactions.

### Established Patterns
- Zustand stores: one per concern (filter-store, drill-store, builder-store). Display settings would follow as `display-store.ts`.
- CSS variables: `:root` / `.dark` in index.css. Density/font-size vars follow the same pattern.
- Sheet component: Used for data source panels. Right-side slide, 540px width.
- Shadcn components: Card, Badge, Button, Input, Label, Separator, ScrollArea, Skeleton, Tabs — all themed via CSS variables.

### Integration Points
- `frontend/src/index.css` — New CSS variables for density/font-size need to go here
- `frontend/src/stores/` — New `display-store.ts` alongside existing stores
- `frontend/src/routes/_app/settings/index.tsx` — Main page component needs layout + Density/Font Size wiring
- `backend/app/api/databases.py` — Connection test endpoint (verify thick mode path)

</code_context>

<specifics>
## Specific Ideas

- Theme preview cards should show a mini-mockup of the RecViz UI (sidebar + content area) in each theme — not abstract color swatches
- Connection test animation should feel like a "handshake" — deliberate, precise, reflecting the banking/finance context
- Status badges should pulse subtly (not aggressively) — this is a professional tool, not a gaming dashboard
- The frontend-design skill must be invoked during execution to ensure the micro-interactions land with premium quality, not generic shadcn defaults
- Optionally spin up a second Oracle container (`docker run -d --name oracle-test -p 1522:1521 -e ORACLE_PASSWORD=TestOracle2026 -e APP_USER=testuser -e APP_USER_PASSWORD=test_dev gvenzl/oracle-free:latest`) for CRUD testing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-settings-page*
*Context gathered: 2026-04-12*
