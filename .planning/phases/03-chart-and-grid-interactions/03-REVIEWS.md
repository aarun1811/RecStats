---
phase: 3
reviewers: [gemini]
reviewed_at: 2026-04-05T21:00:00Z
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 3

## Gemini Review

# Phase 3 Implementation Plan Review: Chart and Grid Interactions

## 1. Summary
The proposed plans for Phase 3 provide a robust and modular approach to enhancing the RecViz dashboard's interactivity. The strategy correctly identifies the need for a unified `ChartRef` interface to bridge the gap between AG Charts and ECharts, enabling consistent export and refresh behaviors. The phased rollout—moving from core chart utilities to grid refinements and finally dashboard-wide orchestration—is logical and manages complexity well. The focus on "keep previous data" patterns and manual/auto-refresh controls directly addresses enterprise BI usability requirements while maintaining a premium UI feel.

## 2. Strengths
*   **Unified Ref Strategy:** The creation of `ChartRef` interfaces and the use of `forwardRef` in wrappers is the correct architectural choice to enable external controls (toolbars) to interact with internal chart instances without breaking encapsulation.
*   **Stateful Fullscreen:** Using a Radix Dialog for fullscreen ensures accessibility and a consistent "Citi-standard" UI. Planning for the fullscreen view to remain "live" (supporting cross-filtering) ensures it isn't just a static image but a functional deep-dive tool.
*   **Aggressive Cleanup:** Plan 03-02 explicitly includes the deletion of dead grid code, preventing "technical debt rot" as the new enterprise-grade grid implementation matures.
*   **UX Consistency:** Adhering to the "keep previous data" pattern during refreshes prevents the jarring "flash of empty state" common in many BI tools, maintaining the premium feel.
*   **DoS Mitigation:** Including a 1-minute floor for auto-refresh intervals and disabling the refresh button during active fetching are essential safeguards for the Superset/Database backend.

## 3. Concerns

*   **State Sync in Fullscreen (MEDIUM):**
    When a chart is opened in a `90vw` Dialog, it will likely be a new component instance. If the dashboard is undergoing cross-filtering, the implementation must ensure the fullscreen instance receives the exact same filtered query parameters as the "minimized" card version. If not handled carefully, the fullscreen chart might reset to default or show inconsistent data.
*   **Concurrent Request Spikes (MEDIUM):**
    Dashboard-wide manual or auto-refresh could trigger dozens of simultaneous requests to the Superset backend. While TanStack Query handles some deduplication, a "thundering herd" of 20+ charts refreshing at once might hit browser connection limits (usually 6-8 per domain) or overwhelm the Superset worker queue.
*   **Grid Ref Forwarding (LOW):**
    Plan 03-02 mentions a new `GridToolbar`. Like the charts, the `GridToolbar` will likely need access to the `GridApi` to trigger CSV/Excel exports and column visibility toggles. The plan doesn't explicitly mention `forwardRef` for the `AgGridWrapper`, which will be necessary for the toolbar to function externally.
*   **Export Scaling (LOW):**
    Exporting a PNG of a large fullscreen chart vs. a small dashboard card may yield different resolutions. The `chart-export.ts` utility should ideally specify a standard scale/DPI to ensure exports are high-quality for PowerPoint/PDF reporting.

## 4. Suggestions

*   **Synchronized Fullscreen Hook:** Consider a shared hook or context that tracks which chart is "active" in fullscreen. This ensures that any cross-filter events triggered *inside* the modal are reflected on the dashboard *outside* the modal (and vice-versa) so the user doesn't lose context upon closing.
*   **Staggered Refresh Logic:** In Plan 03-03, implement a slight stagger (e.g., 50-100ms) or a priority queue for dashboard-wide refreshes to prevent hitting browser concurrency limits all at once.
*   **"Visible vs All" Export:** For the `GridToolbar`, clarify in the UI whether "Export CSV" exports the *filtered* view currently on screen or the *entire* dataset. Enterprise users typically expect "What I See Is What I Get" (WYSIWYG).
*   **Export Notification:** For large datasets, Excel export can take a few seconds. Add a brief "Generating export..." toast or loading state on the toolbar button to prevent multiple clicks.
*   **Clipboard Compatibility:** Ensure the "Copy to Clipboard" utility handles both the image (Blob) and potentially the data table (tab-separated values) to support users pasting directly into Excel or Teams/Slack.

## 5. Risk Assessment

**Overall Risk: LOW**

The plan is well-grounded in the existing architecture (TanStack Query + AG Grid/Charts Enterprise). The dependency chain is clear, and the threat models correctly identify sanitization and DoS risks.

**Justification:**
*   **Technical:** The project uses "Enterprise" versions of AG Grid/Charts, which provide native support for most of the complex requirements (Excel export, column management).
*   **Architectural:** The use of `forwardRef` and specialized hooks for refresh logic follows React 19 best practices.
*   **Functional:** The plans map 1:1 to the Requirements (INTR-05 through INTR-09), ensuring high project alignment.

The primary execution risk lies in **CSS/Layout performance** when rendering very large charts in fullscreen modals on lower-spec machines, which should be validated during Task 03-01.

---

## Consensus Summary

*Single reviewer — consensus analysis requires 2+ reviewers. Key takeaways from Gemini:*

### Strengths
- Unified ChartRef interface is architecturally sound
- Live fullscreen with cross-filter support is well-designed
- Dead code cleanup prevents tech debt accumulation
- "Keep previous data" pattern is correct for enterprise BI
- DoS mitigation via minimum interval + button disabling

### Top Concerns (by severity)
1. **MEDIUM — Fullscreen state sync**: Fullscreen chart is a separate component instance; must receive same cross-filter state as the dashboard version. Plans address this by passing the same data/selection props to the fullscreen ChartFactory instance.
2. **MEDIUM — Concurrent refresh requests**: Dashboard-wide refresh could trigger 20+ simultaneous requests. TanStack Query deduplication helps, but staggering may be needed.
3. **LOW — Grid ref forwarding**: GridToolbar needs GridApi access — plans handle this by passing gridApi as a prop (not forwardRef), which is the existing pattern.
4. **LOW — Export DPI consistency**: PNG export resolution should be standardized (plan uses 2x pixelRatio per research).

### Notes
- The "Visible vs All" grid export concern is valid — AG Grid's built-in exportDataAsCsv exports the current filtered/sorted view by default (WYSIWYG). This matches enterprise expectations.
- The concurrent refresh concern could be addressed in execution if performance issues surface, without plan changes.
