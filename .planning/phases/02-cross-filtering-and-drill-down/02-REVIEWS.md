---
phase: 2
reviewers: [gemini]
reviewed_at: 2026-04-05T00:00:00.000Z
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 2

## Gemini Review

# Phase 2: Cross-Filtering and Drill-Down — Plan Review

This review covers the implementation strategy for Phase 2, focusing on client-side interactive data filtering and per-chart drill-down navigation.

## Summary
The plans are **excellent and highly architectural**, moving away from brittle, rule-based filtering toward a dynamic, column-name matching model. The decision to use a "Cross-Filter Data Layer" that recomputes KPIs in plain JavaScript is well-justified by the data volume analysis (1K-100K rows) and avoids the heavy overhead of WASM-based engines. The per-chart drill state refactor correctly addresses a major limitation of the legacy code. The integration into the existing CSS grid layout for the detail grid is clever and avoids disruptive layout shifts.

---

## Strengths
*   **Performance-First Architecture:** The use of TanStack Query for deduplicated data source caching combined with sub-millisecond JS aggregation is a robust, "lean" engineering choice.
*   **Dynamic Targeting:** Removing `CrossFilterRule` in favor of column-name matching (D-07) significantly reduces configuration maintenance and makes the dashboard system more "self-healing."
*   **Independent Drill Isolation:** Moving from a global drill state to a `Map<chartId, DrillState>` (D-09) is a critical requirement for complex dashboards that the plan executes cleanly.
*   **KPI Integrity:** The "Dual-Path" KPI logic (server-computed for overview, client-re-aggregated for cross-filtered) ensures that complex ratios (like Match Rates) remain mathematically accurate during interaction.
*   **UX Polish:** Inclusion of `CountAnimation` for KPI transitions, `motion/react` for layout reflows, and auto-scrolling for the detail grid demonstrates high attention to user experience.
*   **Stale State Prevention:** Explicitly clearing cross-filters and drill states when global filters change (Pitfall 2) prevents "no data" states caused by orphaned filter values.

---

## Concerns

### 1. AG Grid Row-Click Ambiguity (MEDIUM)
*   **Issue:** In `config-data-grid.tsx` (Plan 02, Task 2), the plan suggests picking `grid.columns[0]?.field` as the filter column for row-clicks. 
*   **Risk:** In many financial datasets, the first column is often an ID or a timestamp, which makes for a poor cross-filter source (too granular). 
*   **Severity:** Medium. It might result in cross-filters that return 0 results for all other charts.
*   **Mitigation:** The `GridConfig` should ideally support an optional `crossFilterColumn` property, falling back to the first *dimension* column rather than just index 0.

### 2. Intermediate Drill Re-aggregation Heuristics (LOW)
*   **Issue:** `applyDrillFilters` (Plan 01, Task 2) uses a sample-based heuristic (`typeof sample === 'number'`) to identify metric columns for re-aggregation.
*   **Risk:** If the first row has a `null` or `undefined` value for a metric, that column might be excluded from the re-aggregated view.
*   **Mitigation:** Use the column metadata from the dashboard config or data source schema to identify metrics instead of runtime type checking on a single row.

### 3. Detail Grid "Slide-In" Performance (LOW)
*   **Issue:** Using `gridColumn: 1 / -1` for the detail grid correctly triggers a layout reflow.
*   **Risk:** On very dense dashboards (15+ charts), a full reflow + `autoSizeAllColumns` might cause a brief frame drop on lower-end machines.
*   **Mitigation:** The `autoSizeAllColumns` is already debounced via `setTimeout`, which is good. The 200ms animation duration is short enough that any minor jank will likely be masked.

---

## Suggestions
*   **KPI "Partial Match" Indicator:** In the `recomputeKpis` engine, consider returning a flag if a cross-filter was ignored for a specific KPI (because the column didn't exist in its data source). The UI could show a small info icon: *"This KPI does not support the active 'Region' filter."*
*   **Refinement of `useCrossFilterData`:** Ensure that the `useQueries` call includes a `staleTime` that prevents redundant background refetches while the user is rapidly clicking different chart segments.
*   **Drill-Down "Ghost" State:** When a chart is at the detail level, consider adding a visual treatment to the original chart (e.g., a subtle border or "Drill Active" badge) to remind the user which chart owns the detail grid below.

---

## Risk Assessment: LOW
The overall risk is **LOW**. 
*   The technical approach is grounded in empirical research (local benchmarks on JS row processing).
*   The dependency on TanStack Query ensures that the "zero network call" requirement for cross-filtering is met via standard caching.
*   The plan provides high-coverage unit tests for the complex logic (aggregation and filtering utilities).
*   The use of `motion/react` and Shadcn components keeps the implementation idiomatic to the existing stack.

**Approved for implementation.** The sequencing from data-layer foundation (01) to cross-filter UI (02) to drill-down orchestration (03) is logical and minimizes integration friction.

---

## Consensus Summary

*Single reviewer (Gemini only) — consensus analysis requires 2+ reviewers.*

### Key Concerns to Address

1. **AG Grid Row-Click Column Selection (MEDIUM)** — The first column may be an ID/timestamp, making it a poor cross-filter source. Consider adding an optional `crossFilterColumn` to `GridConfig`.

2. **Metric Column Heuristic (LOW)** — Using `typeof sample === 'number'` for metric detection is brittle. Could use column metadata from config instead.

3. **KPI Partial Match Indicator (SUGGESTION)** — Show when a KPI doesn't support an active cross-filter column.

### Overall Assessment

Risk: **LOW** — Gemini approved for implementation with minor suggestions.
