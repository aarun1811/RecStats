# Embeddable Dashboards Design & Plan Review

I have thoroughly reviewed both the **Design Spec** ([2026-03-23-recviz-embeddable-dashboards-design.md](file:///Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/docs/superpowers/specs/2026-03-23-recviz-embeddable-dashboards-design.md)) and the **Implementation Plan** ([2026-03-23-recviz-embeddable-dashboards.md](file:///Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/docs/superpowers/plans/2026-03-23-recviz-embeddable-dashboards.md)). 

Overall, the architecture is quite elegant. Moving to a three-layer config model (Dashboard -> Data Source -> DB) and pushing cross-source joins to a Python application-layer `MergeEngine` is a pragmatic solution for Superset's cross-database limitations. The TanStack Router pathless layout refactor and the Angular iframe embed approach are also standard, robust practices.

Here are my detailed findings, potential edge cases, and recommendations to consider before proceeding with execution:

## 1. Architectural & Backend Considerations

*   **In-Memory Merge Engine Performance:**
    The `MergeEngine` joins data sources in memory (Python). For reconciliation aggregates (like breaks per agent/set ID), evaluating hundreds or a few thousand rows in memory is perfectly fine. However, if a future dashboard grid attempts to pull line-item transaction data (millions of rows), the FastApi memory consumption will spike and cause out-of-memory crashes.
    *   *Recommendation:* Add a row-limit or pagination parameter to the query engine to protect the application memory, or add a warning in the documentation that `merge_on` grids are strictly for aggregates.
*   **API Error Handling for Missing Filters:**
    The `QueryEngine` raises a bare `ValueError` if a required filter for dynamic routing is missing (e.g., `tlm_instance`). In FastAPI, an unhandled `ValueError` yields a `500 Internal Server Error`.
    *   *Recommendation:* Catch these validation errors in the `data_sources.py` endpoints and throw a `HTTPException(status_code=400, detail="...")` so the frontend can handle it gracefully.
*   **Security & iFrame Embedding (CORS/Cookies):**
    The spec mentions "same-server deployment avoids CORS complexity". This is true for CORS, but make sure that authentication cookies (if any exist in RecViz) don't run into `SameSite` attribute issues inside the iframe if the ports/subdomains differ. If they use exactly the same domain/port behind a reverse proxy, it will work seamlessly.

## 2. Frontend Considerations

*   **Chart Animations & Re-renders:**
    In the `DashboardRenderer`, triggering a data fetch on "Apply" updates the React context/store. Ensure that the `ChartGrid` and `DataGrid` keys remount cleanly or update smoothly so that ECharts instances don't glitch during the transition.
*   **React Query Key Stability:**
    The `useDashboardKpis` and `useDataSourceQuery` hooks use `filters: Record<string, FilterValue>` directly in the `queryKey`. React Query v5 deep-compares query keys, so object reference changes won't trigger infinite loops, which is great. However, `useFilterOptions` constructs query params dynamically via `URLSearchParams` but also puts `parentFilters` in the key. This is correct, just ensure `parentFilters` only contains the specific dependsOn filters, otherwise *any* unrelated filter change might invalidate the options query.
*   **Locking Mechanism & URL Params:**
    The design uses `&lock=tlm_instance,recon` to lock filters. This is simple and effective. Be aware that users can manually edit the URL to remove the lock param. If strict security is required to prevent users from interacting with other `tlm_instances`, iframe lockdown isn't a secure boundary. Assuming this is an internal tool, UI-level locks are usually sufficient.

## 3. Angular (autosys-job-explorer) Considerations

*   **MatDialog iFrame Height:**
    The `RecvizEmbedDialogComponent` sets iframe `height="100%"`. If the `mat-dialog-content` doesn't have a fixed height or a flex-grow property that fills the viewport correctly, the iframe might collapse to 0px or a default small size (like 150px) on some Angular/Material versions.
    *   *Recommendation:* Test the modal size thoroughly. The plan sets `height: '90vh'` in the MatDialog config, which should correctly constrain the container, allowing `height: 100%` on the iframe to work.

## Conclusion

The implementation plan is broken down extremely well into 18 testable, atomic tasks. The usage of mock data json files paired with a `ConfigStore` means we can develop and test the entire frontend/backend without needing a live Oracle/Superset instance, which is excellent for speed of delivery.

The plan is **ready for execution**. If you approve, I can begin executing the plan task-by-task.
