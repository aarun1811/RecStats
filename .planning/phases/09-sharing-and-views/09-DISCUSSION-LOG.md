# Phase 9: Sharing and Views — Discussion Log

**Date:** 2026-04-08
**Workflow:** /gsd-discuss-phase 9
**Discuss mode:** discuss (interactive)
**Advisor mode:** off (no USER-PROFILE.md)
**Outcome:** CONTEXT.md written; ready for /gsd-plan-phase 9

> This file is a verbatim audit trail of the discuss-phase Q&A. It is for human reference (compliance, future review) and is NOT consumed by downstream agents (researcher, planner, executor). The canonical decisions live in `09-CONTEXT.md`.

---

## Pre-discussion scout findings

Before asking any questions, the agent scouted the codebase and surfaced existing scaffold:

| Asset | Path | State |
|---|---|---|
| Command palette UI | `frontend/src/components/layout/command-palette.tsx` | Wired into header, Cmd+K shortcut, recent searches in localStorage. Searches via POST `/api/search`. |
| Search backend | `backend/app/api/search.py` | Functional but stale — searches Superset slices/datasets, not the Phase 5–7 managed tables. No KPI search, no saved-view search. |
| Saved-views backend | `backend/app/api/views.py` | In-memory dict only. No DB persistence, no migration. |
| Saved-views hooks | `frontend/src/hooks/use-saved-views.ts` + `frontend/src/types/views.ts` | List/create/delete hooks exist. No save/restore UI anywhere. |
| Embed route | `frontend/src/routes/embed/dashboards/$dashboardId.tsx` + `components/embed/embed-topbar.tsx` | Functional with `?filter.X=Y`, `?filter.lock=`, `?theme=`. Uses **legacy `useDashboardConfig` hook** (not the Phase 8 `useManagedDashboard`). |
| Regular view route | `frontend/src/routes/_app/dashboards/$dashboardId.tsx` | Renders dashboard. **Zero URL filter sync.** Same legacy hook. No Share button. |

**Key insight surfaced to user:** Phase 9 is mostly "harden + extend the existing scaffold + rewire to managed tables", not "build from scratch."

---

## Domain boundary presented

> Phase 9 delivers four sharing/findability capabilities:
> - SHAR-01 Saved views — capture filter state, restore later
> - SHAR-02 Shareable URLs — filter state in URL params
> - SHAR-03 Embeddable dashboards — iframe embedding with URL params
> - SHAR-04 Cmd+K command palette — search across managed entities
>
> We'll clarify HOW to implement what's already in scope. New capabilities belong in other phases.

---

## Q1 — Gray area selection (multi-select)

**Header:** Discuss
**Question:** Which areas do you want to discuss for Phase 9: Sharing and Views?
**Options presented:**
1. Saved views — scope & storage
2. URL state sync — encoding & scope
3. Embed mode — controls & hardening
4. Command palette — sources, ordering, recent

**User answer:** All four selected.

---

## Area 1: Saved Views — DROPPED FROM SCOPE

The agent began presenting saved-views questions (view scope, visibility, default-view concept, storage backend), but the user interrupted before answering and said:

> "lets skip saved view for now bro"

The agent asked for clarification:
> "Skip just this discussion (revisit later) or drop SHAR-01 from Phase 9 scope entirely (defer to next milestone)?"

**User decision:**
> "drop it from scope and add it as part of next milestone alone with reports etc"

**Resolution:** SHAR-01 deferred to next milestone alongside reports/exports work. The existing scaffold (`use-saved-views.ts`, `views.py` in-memory store) is left untouched in Phase 9. No save/restore UI, no DB persistence, no command-palette integration in this phase.

**Phase 9 scope reduced to: SHAR-02 + SHAR-03 + SHAR-04.**

---

## Area 2: URL State Sync (SHAR-02)

### Q2.1 — URL encoding format

**Header:** URL format
**Question:** URL encoding format for shareable filter state?
**Options:**
1. Per-filter query params (Recommended) — `?filter.region=APAC&filter.product=A,B,C`
2. Single encoded state blob — `?state=eyJyZWdpb24iOiJBUEFDIn0...`
3. Server-side short ID — `?s=ax7k2`

**User answer:** Per-filter query params (Recommended)
**Captured as:** D-01

### Q2.2 — URL state scope

**Header:** URL scope
**Question:** What state goes in the URL beyond filters?
**Options:**
1. Filters only
2. Filters + drill state
3. Filters + drill + cross-filter selections

**User answer:** Filters only
**Captured as:** D-02

### Q2.3 — Sync timing

**Header:** Sync timing
**Question:** When should filter changes get pushed to the URL?
**Options:**
1. Live, debounced (Recommended) — ~300ms, router replace
2. Explicit action only — Copy link button generates the URL
3. Live push (no debounce) — entries pollute browser history

**User answer:** Live, debounced (Recommended)
**Captured as:** D-03

### Q2.4 — Share UI

**Header:** Share UI
**Question:** Share-link UI on the dashboard view page?
**Options:**
1. Share button → popover with copyable link (Recommended)
2. Single 'Copy link' button + toast
3. Dropdown menu with multiple share options

**User answer:** Single 'Copy link' button
**Captured as:** D-04

---

## Area 3: Embed Mode (SHAR-03)

### Q3.1 — Embed chrome

**Header:** Embed chrome
**Question:** What chrome should embed mode show by default?
**Options:**
1. Fully chromeless (Recommended) — no EmbedTopbar
2. Keep EmbedTopbar (current)
3. Title-only header bar

**User answer:** Keep EmbedTopbar (current)
**Captured as:** D-06

### Q3.2 — Embed URL params

**Header:** Embed params
**Question:** Which URL params should embed support beyond the current set? (multi-select)
**Options:**
1. ?theme=dark|light (already exists)
2. ?filter.X=Y and ?filter.lock=X,Y (already exists)
3. ?hide=filter-bar,title,toolbar
4. ?single=chart-id-or-kpi-id

**User answer:** Theme + filter/lock + hide. **Single-tile embed NOT selected.**
**Captured as:** D-07 (existing params confirmed), D-08 (new ?hide=), D-09 (single-tile out of scope)

### Q3.3 — Embed interactivity

**Header:** Embed interactivity
**Question:** Cross-filtering and drill-down behavior in embed mode?
**Options:**
1. All interactivity enabled (Recommended)
2. Read-only render
3. Param-controlled (?interactive=0|1)

**User answer:** All interactivity enabled (Recommended)
**Captured as:** D-10

### Q3.4 — Embed auth

**Header:** Embed auth
**Question:** Auth & access for embed mode?
**Options:**
1. Same as the rest of the app (no auth in v1)
2. Token query param
3. Allowlist of host origins

**User answer:** Same as the rest of the app (no auth in v1)
**Captured as:** D-11

---

## Area 4: Command Palette (SHAR-04)

### Q4.1 — Search sources

**Header:** Sources
**Question:** Which entity types should the palette search? (multi-select)
**Options:**
1. Dashboards (managed_dashboards table)
2. Charts (managed_charts table)
3. Datasets (managed_datasets table)
4. KPIs (managed_kpis table)

**User answer:** All four selected (KPIs is the new addition).
**Captured as:** D-13

### Q4.2 — Backend rewrite strategy

**Header:** Backend
**Question:** Search backend rewrite strategy?
**Options:**
1. Clean rewrite to managed tables (Recommended)
2. Hybrid — managed tables + Superset fallback
3. Keep Superset, just add KPIs from managed table

**User answer:** Clean rewrite to managed tables (Recommended)
**Captured as:** D-14

### Q4.3 — Result ordering

**Header:** Ordering
**Question:** How should results be ordered in the palette?
**Options:**
1. Grouped by type, alpha within group (Recommended)
2. Pure relevance ranking, no grouping
3. Recently used first, then relevance

**User answer:** Grouped by type, alpha within group (Recommended)
**Captured as:** D-15

### Q4.4 — Palette extras

**Header:** Extras
**Question:** Beyond search results, what else should the palette do? (multi-select)
**Options:**
1. Recently visited items in empty state (Recommended)
2. Quick actions (Create dashboard, Toggle theme)
3. Keyboard navigation hints in footer
4. Keep it search-only

**User answer:** Keep it search-only.
**Captured as:** D-16 (no extras — smallest scope, ships fastest)

---

## Wrap-up

**Header:** Done
**Question:** We've covered URL sync, embed mode, and command palette. Anything else to discuss before I write CONTEXT.md?
**Options:**
1. I'm ready for context
2. Explore more gray areas
3. Revisit one of the three areas

**User answer:** I'm ready for context

---

## Outcome

- **In scope for Phase 9:** SHAR-02 (URL sync), SHAR-03 (embed hardening), SHAR-04 (command palette rewrite)
- **Deferred from Phase 9:** SHAR-01 (saved views) → next milestone with reports/exports
- **Total decisions captured:** 19 (D-01 through D-19)
- **Canonical refs collected:** 7 file paths + REQUIREMENTS.md + CLAUDE.md sections + 4 memory entries
- **Next step:** `/gsd-plan-phase 9`
