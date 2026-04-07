# Phase 9: Sharing and Views - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 delivers three sharing/findability capabilities for completed dashboards:

- **SHAR-02** Shareable URLs — filter state encoded in URL params on the regular `/dashboards/:id` view route, recipient opens the exact same view.
- **SHAR-03** Embeddable dashboards — harden the existing `/embed/dashboards/:id` route for iframe embedding with URL-param filters, locked filters, theme override, and granular hide controls.
- **SHAR-04** Cmd+K command palette — rewrite search to query the managed tables (dashboards, charts, datasets, KPIs) instead of stale Superset endpoints.

**Out of scope (deferred):**
- **SHAR-01 Saved Views** — dropped from Phase 9 scope. Will be picked up in the next milestone alongside reports/exports/templates work. The existing scaffold (`backend/app/api/views.py`, `frontend/src/hooks/use-saved-views.ts`, `frontend/src/types/views.ts`) stays in place untouched — Phase 9 does not delete or rebuild it.

</domain>

<decisions>
## Implementation Decisions

### URL State Sync (SHAR-02)

- **D-01:** URL encoding format is **per-filter query params**, identical to the existing embed route format. Example: `/dashboards/abc?filter.region=APAC&filter.product=A,B,C`. Multi-select values are comma-separated. Bookmarkable, hand-editable, debuggable. Reuses the existing parser pattern from `routes/embed/dashboards/$dashboardId.tsx`.
- **D-02:** URL state scope is **filters only**. Drill-down state, cross-filter active selection, grid sort/column state, fullscreen state are NOT encoded. Opening a shared link resets these to defaults. Aligns exactly with SHAR-02 wording: "filter state encoded in URL params."
- **D-03:** Sync timing is **live, debounced (~300ms)** using router `replace` (not `push`). The URL stays current as the user adjusts filters; the back button is not polluted with intermediate filter states. No explicit "Generate link" action required — every URL is always shareable.
- **D-04:** Share UI is a **single "Copy link" button** in the dashboard view-mode toolbar. Click → copies current URL to clipboard → toast "Link copied". No popover, no preview, no advanced options. Smallest scope, ships fastest.
- **D-05:** Stale-link handling is **Claude's discretion** for the planner: if a shared link references a filter that no longer exists on the dashboard (filter was deleted by builder), the unknown filter param is ignored silently. Known filters apply as normal.

### Embed Mode (SHAR-03)

- **D-06:** **Keep `EmbedTopbar`** as-is. No fully-chromeless mode in Phase 9. The slim topbar stays as the default for embedded dashboards. (Granular hiding via `?hide=` in D-08 lets the host portal hide individual sections if needed.)
- **D-07:** Existing URL params are kept and confirmed: `?theme=dark|light`, `?filter.<id>=<value>`, `?filter.lock=<id1>,<id2>`. These already work in `routes/embed/dashboards/$dashboardId.tsx`.
- **D-08:** **New URL param `?hide=`** with comma-separated tokens for granular section hiding. Initial supported tokens: `filter-bar`, `title`, `toolbar`. Example: `?hide=filter-bar,title`. Any future hide tokens use the same param.
- **D-09:** Single-tile embed (`?single=chart-id`) is **NOT in scope**. Embed mode is whole-dashboard only. Single-tile is a future enhancement if portal teams ask for it.
- **D-10:** **Full interactivity in embed mode**. Cross-filter, drill-down, fullscreen chart view, manual refresh, auto-refresh all work the same as the regular `/_app/dashboards/:id` route. Embed is purely "chromeless rendering" — same renderer, same behaviors. Locked filters (via `?filter.lock=`) are the only interactivity restriction.
- **D-11:** **No auth** for embed in v1 — anyone with the URL can load the embed. Matches the rest of the v1 product (auth deferred). Document the trust assumption in code: corporate intranet only, all RecViz URLs are equally accessible. Revisit when SSO arrives.
- **D-12:** **Embed route MUST be upgraded** from the legacy `useDashboardConfig` hook to `useManagedDashboard` (the Phase 8 hook against the managed_dashboards table). The current scaffold uses the V1 hook and will not see dashboards saved by the Phase 8 builder otherwise. The same upgrade applies to the regular view route at `routes/_app/dashboards/$dashboardId.tsx` if it has not already been done.

### Command Palette (SHAR-04)

- **D-13:** Search **all four managed entity types**: dashboards (`managed_dashboards`), charts (`managed_charts`), datasets (`managed_datasets`), KPIs (`managed_kpis`). KPIs are a NEW source — not searched in the current implementation.
- **D-14:** **Clean rewrite** of `backend/app/api/search.py`. Drop all Superset calls (`superset.list_charts`, `superset.list_datasets`). Query the four managed tables directly via the existing repository/store layer. Single source of truth, no stale data, no Superset dependency for search.
- **D-15:** Result ordering is **grouped by type, alphabetical within group**. Sections in this order: Dashboards → Charts → Datasets → KPIs. Within each section, name-prefix matches before substring matches, then alphabetical. Familiar pattern (matches GitHub, Linear command palettes).
- **D-16:** **Search-only palette**. No quick actions ("Create dashboard", "Toggle theme"), no recently-visited items in the empty state, no keyboard hints in the footer. The current behavior (recent search terms in localStorage when empty) is kept as-is. Smallest scope, ships fastest.
- **D-17:** Frontend palette navigation routes are updated where needed: chart and KPI results route to their `/charts/:id/edit` and `/kpis/:id/edit` pages from the managed library, not to a dashboard. Dataset results route to `/datasets/:id/edit`. Dashboard results route to `/dashboards/:id` (view mode).

### Cross-cutting

- **D-18:** Saved-view scaffold (`use-saved-views.ts`, `types/views.ts`, `backend/app/api/views.py`, `backend/app/models/views.py`) is **NOT touched** by Phase 9. Left in place for the next milestone. No deletion, no rewrite, no test coverage added.
- **D-19:** No new database tables in Phase 9. No Alembic migration required. Phase 9 is pure frontend + backend search rewrite + embed hook upgrade.

### Claude's Discretion

- Stale-link filter handling (silent ignore vs warn vs error) — planner picks.
- Debounce duration for URL push (200ms vs 300ms vs 500ms) — planner picks.
- Toast styling/copy for "Link copied" — planner picks.
- Result limit per palette type group (top 5? top 10?) — planner picks.
- Whether to show a small "embedded dashboard" indicator in the EmbedTopbar — planner picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"Sharing & Views" — SHAR-02, SHAR-03, SHAR-04 (SHAR-01 deferred)

### Existing scaffold (Phase 9 builds on these)
- `frontend/src/routes/embed/dashboards/$dashboardId.tsx` — embed route with `?filter.X`, `?filter.lock`, `?theme` already wired
- `frontend/src/components/embed/embed-topbar.tsx` — embed mode topbar
- `frontend/src/components/layout/command-palette.tsx` — Cmd+K palette wired into header, uses POST `/api/search`, recent searches in localStorage
- `frontend/src/components/ui/command.tsx` — shadcn `CommandDialog` primitives
- `backend/app/api/search.py` — current search implementation (will be rewritten)

### Source-of-truth tables (Phase 9 search must use these)
- `backend/app/models/managed_dashboards.py` (Phase 8)
- `backend/app/models/managed_charts.py` (Phase 6)
- `backend/app/models/managed_datasets.py` (Phase 5)
- `backend/app/models/managed_kpis.py` (Phase 7)
- Their repository/store layers under `backend/app/services/`

### Hook upgrades
- `frontend/src/hooks/use-managed-dashboard.ts` — the Phase 8 hook the embed route must switch to
- `frontend/src/hooks/use-dashboard-config.ts` — the legacy V1 hook the embed route currently uses (must be replaced for embed and confirmed for the regular view route)

### Conventions
- `CLAUDE.md` §"Coding Conventions" — TypeScript strict, named exports, kebab-case files, Shadcn ownership, Tailwind CSS variables, motion/react (NOT framer-motion)
- `CLAUDE.md` §"Styling Consistency Rules" — spacing, colors, typography, dark mode parity
- Memory: `feedback_design_consistency.md` — palette UI must mirror chart/KPI library patterns where overlapping
- Memory: `project_api_client_gotchas.md` — `filters: Record<string, unknown>` payloads (if any) need to land in DATA_KEYS skip-set on `api-client`. (Phase 9 mostly avoids this since saved views are deferred and search payloads are flat.)
- Memory: `feedback_no_mock_shortcuts.md` — search.py rewrite must hit real managed tables, not seeded mock results
- Memory: `feedback_playwright_thoroughness.md` — every plan validated with Playwright MCP before marking done

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`CommandDialog` + `CommandInput` + `CommandList` + `CommandGroup` + `CommandItem`** — shadcn primitives already in `components/ui/command.tsx`. The palette rewrite reuses these as-is.
- **Existing palette structure** — `command-palette.tsx` already has the `useDebounce` hook, the keyboard-shortcut effect (Cmd+K / Ctrl+K), recent-search localStorage helpers, and `typeIcons` / `typeRoutes` maps. Most of Phase 9's palette work is rewiring data sources, not rebuilding UI.
- **`EmbedTopbar`** — already exists at `components/embed/embed-topbar.tsx`. D-06 keeps it.
- **Embed filter parser** — the loop in `routes/embed/dashboards/$dashboardId.tsx` (lines 24–36) that converts `?filter.X=Y` query params into a `Record<string, FilterValue>` is the canonical pattern. Lift it to a shared util (e.g. `lib/dashboard-url-state.ts`) so the regular view route can reuse it for SHAR-02.
- **`DashboardRenderer`** — already accepts `initialFilters` and `lockedFilters` props (per the embed route). The regular view route just needs to start passing them.
- **TanStack Router `useSearch` + `useNavigate`** — bidirectional URL state on the regular view route uses these. `useSearch` reads, `navigate({ to, search, replace: true })` writes.

### Established Patterns

- **Managed-table endpoints** — Phases 5–8 follow a consistent pattern: `managed_X` router registered before legacy `X` router in `backend/app/api/router.py` to prevent path collision; ConfigStore-backed list endpoints; CamelModel response shapes. Phase 9 search rewrite follows the same pattern.
- **Repository access in services** — managed entities are read via service-layer wrappers, never direct ORM in route handlers (per `CLAUDE.md` §"Python / FastAPI"). Search rewrite respects this.
- **Toast notifications** — Sonner via `useToast()` (or direct `toast.success(...)`) is the convention. "Link copied" toast follows this.
- **`api-client` DATA_KEYS skip-set** — payloads with arbitrary user keys (filter values, view state) live in DATA_KEYS to avoid camelCase mangling. Phase 9 search results are flat, so this only matters if `?filter.X=Y` parsing surfaces user keys to typed payloads — likely not needed.

### Integration Points

- **Header** (`components/layout/header.tsx`) — already mounts `<CommandPalette />`. No mounting changes.
- **Dashboard view route** (`routes/_app/dashboards/$dashboardId.tsx`) — needs Share button in the toolbar, URL-state read on mount, URL-state write on filter change.
- **Embed route** (`routes/embed/dashboards/$dashboardId.tsx`) — hook swap (`useDashboardConfig` → `useManagedDashboard`) + new `?hide=` parser + pass-through to `EmbedTopbar` and `DashboardRenderer`.
- **Backend router** (`backend/app/api/router.py`) — `search.py` registration is unchanged; only the implementation inside `search.py` is rewritten.
- **`DashboardRenderer`** — may need a new prop for `hideTitle` / `hideFilterBar` / `hideToolbar` flags (driven by `?hide=` from embed). Or the embed route handles the hiding itself by not rendering the wrappers. Planner picks.

</code_context>

<specifics>
## Specific Ideas

- **The embed route is V1 carryover.** The user noted it as "existing" in PROJECT.md, but the scout confirmed it uses the legacy `useDashboardConfig` hook. Phase 9 must verify that the embed route actually loads dashboards saved by the Phase 8 builder before declaring SHAR-03 done. This is the single most likely failure mode of the phase.
- **Backend search.py is dead-data.** Searching via Superset slices means results come from V1-era charts that no longer reflect the Phase 6 managed_charts library. Users would search for a chart they just saved and get nothing. Rewriting search is not optional — it's a bug fix dressed as a feature.
- **No new chrome.** EmbedTopbar stays. The phase is intentionally light-touch on embed UI: harden + extend params, don't redesign.
- **Defer everything that smells like "saved state with a name."** Saved Views, dashboard templates, named filter presets — all next milestone.

</specifics>

<deferred>
## Deferred Ideas

### Dropped from Phase 9 scope

- **SHAR-01 Saved Views** — full feature deferred to next milestone alongside reports, exports, templates, and other "named state" work. The existing scaffold (`use-saved-views.ts`, `types/views.ts`, `backend/app/api/views.py` in-memory store, `backend/app/models/views.py`) is left in place untouched. Phase 9 does not build a save/restore UI, does not add Postgres persistence, does not wire saved views into the command palette.

### Future enhancements (next milestone or beyond)

- **Single-tile embed** (`?single=chart-id-or-kpi-id`) — render only one panel from a dashboard. Useful for portal pages that want to embed a "KPI tile". Wait until a portal team asks.
- **Server-side short-ID share links** — `?s=ax7k2` for clean URLs. Adds a DB table; basically a saved-view-without-a-name. Not worth it until URLs become a complaint.
- **Quick actions in command palette** — verb-launcher behavior ("Create dashboard", "Toggle theme"). Add when users start asking for it.
- **Recently-visited items in palette empty state** — small UX win. Track in localStorage similarly to recent search terms. Add when palette adoption is proven.
- **Token-gated embeds / referer allowlist** — embed access controls. Defer until SSO arrives or until a security review flags it.
- **Drill state in URL** — `?drill.chart-1=EMEA,UK,Q3`. Lets analysts share "I drilled into this exact path". Adds encoding complexity. Wait for a real ask.

</deferred>

---

*Phase: 09-sharing-and-views*
*Context gathered: 2026-04-08*
