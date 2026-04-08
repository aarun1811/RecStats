---
phase: 8
reviewers: [gemini]
reviewed_at: 2026-04-07T12:00:00.000Z
plans_reviewed: [08-01, 08-02, 08-03, 08-04, 08-05, 08-06, 08-07, 08-08, 08-09, 08-10]
---

# Cross-AI Plan Review — Phase 8

## Gemini Review

This review evaluates the 10-plan execution strategy for **Phase 8: Dashboard Builder**.

### 1. Summary
The implementation plan for Phase 8 is **exceptionally high-quality**, demonstrating a deep understanding of both the existing RecViz architecture and the complexities of building a WYSIWYG drag-and-drop editor. The strategy of breaking the phase into 10 modular "waves" is excellent for maintaining a tight feedback loop. The research into `react-grid-layout` v2 and the specific logic for filter column mapping and KPI serialization shows a high level of technical foresight. The plan is idiomatic, follows established project patterns (Zustand for client state, TanStack Query for server state), and prioritizes a polished user experience.

### 2. Strengths
- **Modular Wave Strategy:** Breaking the complex builder into 10 distinct plans allows for incremental verification and reduces the risk of "mega-PR" integration issues.
- **WYSIWYG Focus:** The decision to render live data inside the builder (Plan 07) ensures a superior user experience compared to "placeholder-only" builders.
- **Comprehensive State Management:** The separation of the `builder-store` (content) and `layout-history-store` (undo/redo) is a clean architectural choice.
- **Complex Interaction Design:** The `FilterColumnMapper` (Plan 08) and `DrillHierarchyEditor` (Plan 07) tackle the hardest parts of self-service BI: mapping disparate data sources and configuring navigation paths.
- **RGL v2 Foresight:** Explicitly calling out the nuances of `react-grid-layout` v2 (width requirements, mounted gates, and compaction types) avoids common pitfalls that often derail grid implementations.

### 3. Concerns
- **Filter Mapping Persistence (MEDIUM):** Plan 08 mentions storing manual column mappings in a `columnMappings` property on `FilterConfig` but notes this might require a type extension. Risk: If the `DashboardRenderer` isn't updated to consume this new metadata, the manual mapping configured in the builder won't actually work in view mode.
- **KPI Serialization Dependency (MEDIUM):** `serializeConfig` in Plan 10 relies on `useManagedKpis` data to map library metadata (metrics, aggregation) into the `DashboardConfig`. Risk: If the KPI library fetch fails or is stale during a save operation, the resulting dashboard config might be corrupted or incomplete.
- **Performance of Live Previews (LOW):** Rendering 20+ live AG Charts/Grids on a single canvas during a drag/resize operation could cause frame drops. Risk: Jittery UI during layout changes.

### 4. Suggestions
- **Concrete Mapping Schema:** Explicitly extend the `FilterConfig` interface in `frontend/src/types/dashboard-config.ts` at the start of Plan 08 to include the `columnMappings` record. Ensure the `DashboardRenderer` (specifically `cross-filter.ts`) is updated in the same plan to respect these overrides.
- **Save-Time Validation:** In `serializeConfig`, add a validation check that ensures every `kpiId` in the builder has a corresponding entry in the `kpiLibrary` array. If missing, throw an error or skip the item to prevent saving a broken config.
- **Debounced Layout Snapshots:** Ensure the `pushSnapshot` call in `BuilderCanvas` is debounced or only fires on `onLayoutChange` *completion* (drag/resize end) to avoid polluting the undo stack with hundreds of micro-movements.
- **Tab Title Dirty Indicator:** As a minor UX polish, append an asterisk (`*`) to the browser tab title when `isDirty` is true to provide an additional visual cue for unsaved changes.

### 5. Risk Assessment: LOW
The overall risk is **LOW**. The plans are grounded in empirical research and follow the "Clean Rewrite" directive (D-30) while maintaining backward compatibility with the `DashboardConfig` schema. The dependencies are logically ordered, starting with the data layer and ending with the final serialization and safety guards.

**Status:** APPROVED FOR EXECUTION

---

## Consensus Summary

### Agreed Strengths
- Modular 10-plan wave strategy enables incremental verification
- WYSIWYG live rendering via ChartFactory/KpiPreviewCard is the right approach
- Clean separation of builder-store (content) and layout-history-store (undo/redo)
- Complex interactions (FilterColumnMapper, DrillHierarchyEditor) address real BI builder challenges

### Agreed Concerns
- **MEDIUM: Filter column mapping persistence** — `columnMappings` needs explicit type extension in FilterConfig and renderer must consume it
- **MEDIUM: KPI serialization robustness** — serializeConfig depends on successful KPI library fetch at save time
- **LOW: Live preview performance** — Many live charts during drag/resize may cause frame drops

### Actionable Items for Execution
1. Extend `FilterConfig` type to include `columnMappings` explicitly in Plan 08
2. Add save-time validation in `serializeConfig` to handle missing KPI library data
3. Debounce layout snapshot pushes to undo stack (fire on drag/resize END, not during)
4. Consider tab title dirty indicator (`*`) as minor UX polish
