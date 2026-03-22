# Lessons from RecViz v1 Build — For the Next Agent

This document captures hard-won lessons from the first attempt at building RecViz. The build used 11 sequential agents (scaffolding + 10 parallel modules). The code is ~85% structurally complete but the UI is broken and inconsistent. Read this before you start.

---

## 1. What Went Wrong: The Multi-Agent Problem

**Each agent built its module in isolation.** They all passed their own "unit tests" (TypeScript compiles, component renders) but nobody verified the integration points. The result:

- Route pages were stubs that never imported the real page components
- Backend API response shapes didn't match frontend TypeScript types
- The sidebar layout clipped page content because nobody tested a full page render
- Double padding (layout + page both adding `p-6`)
- No visual consistency — each agent made its own spacing/sizing choices

**Lesson:** If you use parallel agents, you MUST have an integration agent that runs after all modules are done, whose sole job is to wire everything together and verify full-page renders. Better yet — build incrementally: get one page working end-to-end before moving to the next.

---

## 2. Build Order That Actually Works

The v1 build order was: scaffolding → all 10 modules in parallel → integration fix. This was wrong.

**Recommended order:**

```
1. Shell first (layout, sidebar, topbar, routing, theme)
   → Must be visually complete and tested in browser before moving on

2. Backend mock data + API layer
   → Every endpoint returns realistic mock data
   → Frontend API client + TanStack Query hooks wired and tested
   → Verify with curl AND from the browser (not just curl)

3. ONE page end-to-end (Dashboard)
   → Dashboard list page: fetches from API, renders cards, navigates
   → Dashboard detail page: filter bar, KPI cards, chart grid
   → Charts actually render with real AG Charts / ECharts
   → Test the full flow in browser before moving on

4. Second page (Data Explorer)
   → Monaco editor, schema browser, query results

5. Polish pass
   → Skeleton loaders, animations, empty states, error boundaries
   → Dark mode verification on every component
   → Responsive behavior
```

**Key principle:** Never move to step N+1 until step N renders correctly in the browser.

---

## 3. The Shadcn Sidebar — What You Need to Know

The sidebar was the #1 source of layout bugs. Here's what actually works:

### Use `variant="inset"`
The `inset` variant uses margin-based layout with rounded corners. The default `sidebar` variant uses border-based layout which caused content clipping.

### CSS Variables on SidebarProvider
The reference implementation sets these on `SidebarProvider`:
```tsx
<SidebarProvider
  style={{
    '--sidebar-width': 'calc(var(--spacing) * 64)',
    '--header-height': 'calc(var(--spacing) * 14)',
    '--content-padding': 'calc(var(--spacing) * 4)',
  } as React.CSSProperties}
>
```

### Layout Structure
```tsx
<SidebarProvider>
  <AppSidebar variant="inset" />
  <SidebarInset>
    <Header />           // sticky top-0, uses h-(--header-height)
    <div className="flex flex-1 flex-col">
      {children}         // pages own their own padding
    </div>
  </SidebarInset>
</SidebarProvider>
```

### Do NOT add padding at the layout level
Pages should own their own `p-6` or whatever padding they need. The root layout wrapper should be `flex flex-1 flex-col` only.

### Mobile sidebar auto-close
```tsx
const location = useLocation()
useEffect(() => {
  if (isMobile) setOpenMobile(false)
}, [location.pathname])
```

---

## 4. Backend: Mock-First Development

The v1 backend had a critical bug: `get_superset_client()` threw during FastAPI dependency injection, so the try/except in route handlers never fired. Mock data was unreachable.

### Pattern that works:
```python
async def get_superset_client(request: Request) -> SupersetClient | None:
    """Return None when Superset is unavailable — routes use mock data."""
    try:
        client = SupersetClient(request.app.state.superset_http)
        await client.ensure_authenticated()
        return client
    except Exception:
        return None
```

Route handlers accept `SupersetClient | None` and branch:
```python
async def list_charts(superset: SupersetClient | None = Depends(get_superset_client)):
    if superset is not None:
        try:
            return await superset.list_charts()
        except SupersetError:
            pass
    return MOCK_CHARTS  # Always reachable
```

### CamelCase serialization (Pydantic v2):
```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
```

Then use `model_dump(by_alias=True)` in route handlers. Drop `response_model` from the decorator and return dicts — it's simpler and avoids double-serialization bugs.

### Shape alignment
The #1 integration bug was backend returning shapes the frontend didn't expect:
- Backend `name` vs frontend `title`
- Backend `snake_case` vs frontend `camelCase`
- Backend returning flat responses vs frontend expecting `{ dashboards: [...], count: N }` envelopes

**Write the frontend TypeScript types FIRST, then make the backend match them exactly.**

---

## 5. Chart Rendering — AG Charts Gotchas

### AG Charts v13 uses strict discriminated union types
You can't just build an `AgChartOptions` object dynamically — the type system fights you. Build as a plain object and cast at the boundary:

```typescript
function buildBarSeries(data, xKey, yKey): AgChartOptions {
  return {
    data,
    series: [{ type: 'bar' as const, xKey, yKey }],
  }
}
```

### Chart config builder needs alias fallbacks
Mock data and real data may use different property names for the same thing:
```typescript
const seriesKey = opts['seriesKey'] ?? opts['seriesGrouping']
const categoryKey = opts['categoryKey'] ?? opts['calloutLabelKey'] ?? 'category'
const valueKey = opts['valueKey'] ?? opts['angleKey'] ?? 'value'
```

### ECharts only for exotic charts
AG Charts handles: line, bar, area, pie, donut, scatter, histogram, waterfall, combo.
ECharts only for: sankey, radar, sunburst, gauge, funnel, graph, parallel.

---

## 6. Frontend Type System

### Dashboard config is the central type
Everything flows from `DashboardConfig`:
```typescript
interface DashboardConfig {
  id: string
  title: string
  description?: string
  charts: ChartConfig[]        // Full chart definitions, not layout refs
  filters?: FilterConfig[]
  crossFilterRules?: CrossFilterRule[]
  layout?: DashboardLayoutItem[]
}

interface ChartConfig {
  id: string
  title: string
  type: ChartType              // 'line' | 'bar' | 'area' | 'pie' | etc.
  library: 'ag-charts' | 'echarts'
  datasetId: string
  options: Record<string, unknown>
}
```

Chart IDs are **strings** (e.g., `'break-trend'`), not numbers. The v1 build had `chart_id: int` in the backend which broke lookups.

### TanStack Query key convention
```typescript
queryKey: ['entity', identifier, filters]
// e.g.: ['chart-data', 'break-trend', globalFilters]
```

### API client extracts from envelopes
Backend returns `{ dashboards: [...], count: N }`. The API function should extract:
```typescript
export async function fetchDashboards(): Promise<DashboardConfig[]> {
  const res = await api.get<{ dashboards: DashboardConfig[]; count: number }>('/dashboards')
  return res.dashboards
}
```

---

## 7. What's Worth Keeping from v1

Not everything was bad. These pieces are solid and reusable:

- **`RECVIZ_PLAN.md`** — The 1680-line design doc is comprehensive and well-thought-out
- **`CLAUDE.md`** — Coding conventions are good, follow them
- **`chart-config-builder.ts`** — The AG Charts + ECharts config builder works well
- **Backend service layer pattern** — Route → Service → External API is clean
- **Pydantic CamelModel** — The base model pattern for camelCase serialization
- **Filter converter** (`to_superset_filters`) — GlobalFilters → Superset WHERE clauses
- **Zustand stores** — filter-store, drill-store, theme-store are well-structured
- **Shadcn UI primitives** (`components/ui/`) — Standard Shadcn components, all good

---

## 8. What to Do Differently

1. **Build visually, not structurally.** Don't build "the chart module" as an abstract component library. Build "the dashboard page" as a thing you can see and click.

2. **One agent, one page, end-to-end.** Don't parallelize until you have at least one complete vertical slice working.

3. **Use the reference dashboard** (`_references/shadcn-ui-kit-dashboard`) as a visual baseline for sidebar, header, and page layouts. It's a production-quality Shadcn implementation.

4. **Test in the browser constantly.** `curl` passing is not enough. You need to see the pixels.

5. **Mock data should be rich and realistic.** The v1 mock data was minimal (4 charts, 2 dashboards). Make it look like a real recon dashboard with 10+ data points per chart, realistic field names (trade_date, counterparty, break_amount, aging_bucket, etc.).

6. **Don't over-abstract early.** A `ChartFactory` that dispatches to `AgChartWrapper` vs `EChartWrapper` sounds clean in theory but adds indirection. For v2, consider just having the chart grid know which library to use directly.

7. **Padding/spacing ownership must be clear.** Either the layout adds padding OR the page adds padding. Never both. Recommended: pages own their padding.

---

## 9. Reference Files

| File | What It Is |
|------|-----------|
| `RECVIZ_PLAN.md` | Full design doc (1680 lines) — architecture, filtering model, component specs |
| `CLAUDE.md` | Coding conventions — tech stack, naming, patterns |
| `_references/shadcn-ui-kit-dashboard/` | Production Shadcn dashboard — copy the sidebar/layout patterns |
| `02-RecViz-Old/recviz/` | The v1 codebase — mine for working code, don't copy the structure |

---

*Written by Claude after attempting to integrate 11 agent-built modules into a working app. The code compiled. The types checked. The UI was broken.*
