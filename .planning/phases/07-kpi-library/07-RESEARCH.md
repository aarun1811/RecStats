# Phase 07: KPI Library - Research

**Researched:** 2026-04-06
**Domain:** KPI template CRUD, animated KPI card rendering, trend comparison logic
**Confidence:** HIGH

## Summary

Phase 7 follows the exact same backend CRUD + frontend library pattern established in Phase 5 (Datasets) and Phase 6 (Charts). The backend creates a new `recviz_kpis` table (migration 004), SQLAlchemy model, Pydantic schemas, and CRUD endpoints at `/api/kpis/managed`. The frontend mirrors the chart library with list/card/row/detail-panel/toolbar components plus a simplified builder (fewer steps than the chart builder). The KPI-specific complexity lies in two areas: (1) the data model for trend comparison (previous-period vs static-target modes), and (2) the live preview that must query the dataset and compute an aggregated value with formatting.

Existing code provides strong foundations. The `CountAnimation` component from `motion/react` handles animated counters. The `formatValueFull()` utility handles currency/percentage/number formatting. The `config-kpi-row.tsx` component demonstrates the exact card rendering pattern (trend arrow, color coding, partial-match indicators). The gap between the existing `KpiConfig` type (config-driven dashboards) and the new managed KPI model is primarily structural: the old type uses `sources[]` referencing data source IDs with inline metrics, while the new model references a managed dataset ID with a single metric column and aggregation.

**Primary recommendation:** Clone the Phase 6 chart library architecture (backend CRUD, frontend hooks, library page, builder, detail panel) and simplify. The KPI builder needs only 5 steps (dataset, column, aggregation+format, trend, thresholds+name) instead of 4 complex steps. The KPI card component is a new `kpi-library-card.tsx` that renders an actual KPI preview (animated value + trend) instead of a chart thumbnail.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** KPI templates reference a managed dataset (from Phase 5) + specify which column to aggregate. One dataset can power many KPIs. No standalone SQL fragments.
- **D-02:** Trend comparison supports both modes -- compare to previous period (day/week/month) OR compare to a static target value. Dev chooses per KPI template.
- **D-03:** Threshold coloring is dev-defined numeric ranges: green > X, amber > Y, red below Y. Business users see the colors but cannot change thresholds (that's dev config).
- **D-04:** KPI cards show: animated counter value, trend arrow with % change (color-coded green/red), and a subtitle/context label (e.g., "vs last week" or "target: 95%").
- **D-05:** No sparkline mini-charts or threshold color bars in this phase. Keep cards clean and focused.
- **D-06:** Counter animation is fast roll-up (~0.8s) using existing `CountAnimation` component from `motion/react`.
- **D-07:** Phase 7 is browse-only library for business users. No dashboard placement or inline config -- that's Phase 8.
- **D-08:** KPI library page follows the same pattern as chart library: card grid + list toggle, search/filter toolbar, detail side panel on click.
- **D-09:** Form-based step editor for creating KPI templates: pick dataset, pick column, set aggregation, set format, configure trend, set thresholds, name & save. Simpler than chart builder (no chart type/mapping complexity).
- **D-10:** Live KPI card preview in right panel showing real data as dev configures. Same split-panel pattern as chart builder.

### Claude's Discretion
- Editor can use accordion steps or single-page form -- Claude picks based on field count and UX flow.
- Card grid column count and responsive breakpoints.
- Exact animation easing curve for counter roll-up.

### Deferred Ideas (OUT OF SCOPE)
- Sparkline mini-charts inside KPI cards -- could add in a future enhancement phase
- Threshold color bar on card edge -- visually interesting but not needed for v1
- User-configurable thresholds when adding KPI to dashboard -- Phase 8 scope
- KPI placement/sizing on dashboard grid -- Phase 8 scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KPI-01 | Dev team can define reusable KPI templates with SQL fragments, format rules, and trend indicator logic | Backend CRUD (model, migration, endpoints), Pydantic schemas with trend config and threshold config, KPI builder UI with step editor |
| KPI-02 | Business users can pick KPIs from the library when building dashboards -- select metric, configure threshold colors, trend direction | KPI library list page with card grid/list toggle, search/filter toolbar, detail side panel (Phase 7 = browse-only; Phase 8 adds to dashboard) |
| KPI-03 | KPI cards display animated counters, trend arrows (up/down with percentage change), and configurable status colors | `CountAnimation` component reuse, `formatValueFull()` for formatting, trend computation from dataset query, threshold-based color classes |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Strict TypeScript, no `any`, no `@ts-ignore`
- Named exports for all components/hooks/stores (default export only for page components)
- Props interface named `{ComponentName}Props`
- No barrel exports
- Kebab-case file naming for components/utils, `use-{name}.ts` for hooks
- Shadcn CSS variable colors only -- never hardcode hex/rgb/hsl
- Dark mode on every component
- `motion/react` for animations (NOT `framer-motion`)
- CamelModel with alias_generator for all Pydantic schemas
- Async everywhere in FastAPI
- Service layer pattern: route handlers call services
- Route registration order: managed routers BEFORE catch-all routers

## Standard Stack

### Core (already in project -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | existing | `RecvizKpi` ORM model | Established pattern from datasets/charts |
| Alembic | existing | Migration 004 for `recviz_kpis` table | Established pattern |
| Pydantic v2 | existing | Request/response schemas with CamelModel | Established pattern |
| FastAPI | existing | CRUD endpoints `/api/kpis/managed` | Established pattern |
| TanStack Query 5 | existing | `useManagedKpis`, `useCreateKpi`, etc. | Established pattern |
| motion/react | existing | `CountAnimation` component for animated counters | Already built, D-06 |
| date-fns 4 | existing | `formatDistanceToNow` for time display | Used in chart library |
| Lucide React | existing | Icons (TrendingUp, TrendingDown, Gauge, etc.) | Used everywhere |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | existing | Toast notifications for save/delete | On CRUD operations |
| react-resizable-panels | existing | Split panel layout in builder | KPI builder: steps + preview |

**Installation:** No new packages needed. Phase 7 uses exclusively existing dependencies. [VERIFIED: codebase inspection]

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── db/models/kpi.py              # RecvizKpi SQLAlchemy model
├── models/managed_kpi.py         # Pydantic schemas (KpiCreate, KpiUpdate, KpiResponse)
├── api/managed_kpis.py           # CRUD endpoints
├── migrations/versions/004_add_kpis.py  # Alembic migration

frontend/src/
├── types/managed-kpi.ts          # TypeScript types
├── hooks/use-managed-kpis.ts     # TanStack Query hooks
├── components/kpis/
│   ├── kpi-library-list.tsx       # Main list component (grid/list toggle)
│   ├── kpi-library-card.tsx       # Card view item (live KPI preview)
│   ├── kpi-library-row.tsx        # Row view item
│   ├── kpi-library-toolbar.tsx    # Search/filter/view-mode toolbar
│   ├── kpi-detail-panel.tsx       # Sheet-based detail side panel
│   ├── kpi-builder.tsx            # Full-page builder with steps + preview
│   ├── kpi-builder-preview.tsx    # Live KPI card preview in builder
│   ├── kpi-preview-card.tsx       # Reusable KPI card renderer for previews
│   ├── delete-kpi-dialog.tsx      # Confirmation dialog
│   └── builder/
│       ├── step-dataset.tsx       # Step 1: Pick dataset
│       ├── step-column.tsx        # Step 2: Pick column + aggregation
│       ├── step-format.tsx        # Step 3: Format (number/currency/percentage)
│       ├── step-trend.tsx         # Step 4: Trend config (period or target)
│       └── step-thresholds.tsx    # Step 5: Threshold ranges + name
├── routes/_app/kpis/
│   ├── index.tsx                  # Library page
│   ├── new.tsx                    # Create KPI page
│   └── $kpiId.edit.tsx            # Edit KPI page
```

### Pattern 1: Backend CRUD (Clone from Phase 6)
**What:** SQLAlchemy model + Pydantic schemas + FastAPI router following the exact chart CRUD pattern.
**When to use:** Every managed entity in the system.

```python
# Source: backend/app/db/models/chart.py pattern [VERIFIED: codebase]
class RecvizKpi(Base):
    __tablename__ = "recviz_kpis"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), server_default="", default="")
    dataset_id: Mapped[str] = mapped_column(String(128), nullable=False)
    metric_column: Mapped[str] = mapped_column(String(256), nullable=False)
    aggregation: Mapped[str] = mapped_column(String(32), nullable=False, default="SUM")
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), default=_utcnow
    )
```

### Pattern 2: KPI Config JSONB Schema
**What:** The `config` JSONB column stores format, trend, and threshold settings as a structured Pydantic model. This avoids schema-wide column changes when adding new config options.
**When to use:** For nested configuration that may evolve.

```python
# Source: managed_chart.py ChartConfigSchema pattern [VERIFIED: codebase]
class KpiFormatSchema(CamelModel):
    type: Literal["number", "currency", "percentage", "decimal"] = "number"
    decimals: int | None = None
    abbreviate: bool = True
    currency_code: str | None = None  # ISO 4217 for currency type

class TrendPeriodConfig(CamelModel):
    mode: Literal["previous_period"] = "previous_period"
    period: Literal["day", "week", "month"] = "week"

class TrendTargetConfig(CamelModel):
    mode: Literal["static_target"] = "static_target"
    target_value: float
    target_label: str = ""  # e.g., "SLA target"

class ThresholdConfig(CamelModel):
    green_above: float      # Value >= green_above -> green
    amber_above: float      # Value >= amber_above -> amber
    # Below amber_above -> red

class KpiConfigSchema(CamelModel):
    format: KpiFormatSchema = KpiFormatSchema()
    trend: TrendPeriodConfig | TrendTargetConfig | None = None
    thresholds: ThresholdConfig | None = None
    subtitle: str = ""  # Context label like "vs last week"
```

### Pattern 3: Frontend Library Page (Clone from Chart Library)
**What:** `kpi-library-list.tsx` follows the exact same structure as `chart-library-list.tsx` -- state for viewMode/search/typeFilter, filtered list with useMemo, conditional rendering for grid/list/empty, detail panel Sheet.
**When to use:** Every library page in the system.

### Pattern 4: KPI Builder (Simplified Chart Builder)
**What:** Full-page layout with back/save header, accordion or section-based steps panel on the left, live KPI card preview on the right. Fewer steps than chart builder since there's no chart type or column mapping complexity.
**When to use:** Creating/editing KPI templates.

**Recommendation on editor style (Claude's Discretion):** Use a single scrollable form with labeled sections rather than an accordion stepper. The KPI builder has only 5 fields (dataset, column, aggregation+format, trend, thresholds+name), which is compact enough for a single view. An accordion would add unnecessary clicks. The chart builder uses accordions because it has 4 complex steps with many sub-options -- the KPI builder doesn't have that density.

### Pattern 5: Trend Computation
**What:** The backend must support computing current vs previous period values. For KPI preview and for future dashboard rendering, the approach is:
1. Execute the dataset SQL with current filters to get the current aggregated value
2. For "previous_period" trend: Execute the same SQL with a date offset (current period's date range shifted back by period length) to get the comparison value
3. For "static_target" trend: Compare against the stored target value directly
4. Compute percentage change: `((current - comparison) / comparison) * 100`

**Implementation detail for Phase 7:** The builder preview queries the dataset via the existing `/api/sql/execute` endpoint and performs client-side aggregation. The trend percentage in the preview can show a placeholder or compute from the full dataset (since we don't have date context in the preview). Full trend computation with date-shifted queries happens when KPIs are rendered in dashboards (Phase 8). Phase 7 stores the trend config; Phase 8 uses it.

### Anti-Patterns to Avoid
- **Don't duplicate aggregation logic.** Use the existing `formatValue` and `formatValueFull` utilities -- do NOT write new formatting functions.
- **Don't put trend SQL in the KPI template.** Per D-01, KPIs reference datasets. The trend is computed by running the dataset query with different date parameters, not by storing a separate SQL fragment.
- **Don't add threshold editing to business user views.** Per D-03, thresholds are dev-only config. The library browse view shows threshold colors but provides no editing controls.
- **Don't render sparklines or threshold bars.** Per D-05, this phase keeps cards clean. Those are deferred ideas.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number formatting | Custom format functions | `formatValue()` / `formatValueFull()` from `@/lib/formatters` | Already handles number, currency, percentage, decimal with locale pinning, abbreviation, and decimal control |
| Counter animation | Custom spring/tween animation | `CountAnimation` from `@/components/shared/count-animation.tsx` | Already uses motion/react's `useMotionValue` + `useTransform` + `animate` with format integration |
| CamelCase API transform | Manual field renaming | `CamelModel` base class (backend) + `api-client.ts` key transform (frontend) | Established convention, DATA_KEYS exemption list handles nested config objects |
| Trend arrow icons | Custom SVG arrows | `TrendingUp` / `TrendingDown` from `lucide-react` | Already used in `config-kpi-row.tsx` with correct sizing |
| Detail side panel | Custom modal/overlay | Shadcn `Sheet` component | Already used in `chart-detail-panel.tsx` |
| Empty state | Custom placeholder | Shadcn `Empty` composable component | Already used in chart and dataset lists |
| View mode toggle | Custom tabs | Shadcn `ToggleGroup` | Already used in chart library toolbar |
| Toast notifications | Custom notification system | `sonner` via `toast()` | Already integrated project-wide |

## Common Pitfalls

### Pitfall 1: Route Registration Order
**What goes wrong:** KPI managed routes collide with other route patterns if registered in the wrong order.
**Why it happens:** FastAPI matches routes in registration order. A catch-all `/{id}` route on the KPI router would swallow `/managed` paths.
**How to avoid:** Register `managed_kpis_router` BEFORE any existing KPI-related routers in `router.py`, following the pattern from charts (D-06 from Phase 06: `managed_charts_router` before `charts_router`) and datasets (`managed_datasets_router` before `datasets_router`).
**Warning signs:** 404 errors when hitting `/api/kpis/managed` endpoints.

### Pitfall 2: JSONB Config Key Transform
**What goes wrong:** The frontend `api-client.ts` transforms all JSON keys to camelCase, which would corrupt config field names that need to stay as-is.
**Why it happens:** The global key transformer in `api-client.ts` recurses into all objects. Config objects like `format`, `trend`, `thresholds` contain keys that the transformer would mangle if not exempted.
**How to avoid:** The key `config` is already in the `DATA_KEYS` set (added in Phase 06). Since the KPI model also uses `config` as the JSONB field name, this exemption applies automatically. If the KPI response schema uses a different top-level key name, it must be added to `DATA_KEYS`.
**Warning signs:** Config values load correctly from API but save with wrong keys (or vice versa).

### Pitfall 3: CountAnimation Duration Mismatch
**What goes wrong:** Counter animation looks jarring if duration doesn't match D-06's specification of ~0.8s.
**Why it happens:** The default `CountAnimation` duration is 1.5s (see `count-animation.tsx` line 21). D-06 specifies ~0.8s.
**How to avoid:** Pass `duration={0.8}` explicitly when using `CountAnimation` in the KPI library card and preview. Do NOT modify the default in the shared component (other consumers may rely on 1.5s).
**Warning signs:** Counter animation feels slow or inconsistent with other KPI renderings.

### Pitfall 4: Threshold Color in Dark Mode
**What goes wrong:** Threshold status colors (green/amber/red) look washed out or invisible in dark mode.
**Why it happens:** Using only light-mode color classes without dark variants.
**How to avoid:** Always pair colors: `text-green-600 dark:text-green-400`, `text-amber-600 dark:text-amber-400`, `text-red-600 dark:text-red-400`. For backgrounds: `bg-green-500/10`, `bg-amber-500/10`, `bg-red-500/10` (opacity-based, works in both modes). This is already the pattern in `config-kpi-row.tsx`.
**Warning signs:** Colors invisible or clashing when toggling dark mode.

### Pitfall 5: Dataset Delete Reference Check
**What goes wrong:** Datasets that have KPIs referencing them can be deleted, leaving orphaned KPIs.
**Why it happens:** Phase 5's dataset delete reference check (`managed_datasets.py` `/references` endpoint) only checks for referencing charts, not KPIs.
**How to avoid:** Update `managed_datasets.py`'s reference check to also query `RecvizKpi` for `dataset_id` matches. Return both referencing charts AND referencing KPIs. Update the `DatasetDeleteCheck` Pydantic model to include a `referencing_kpis` field.
**Warning signs:** User can delete a dataset that still has KPI templates pointing to it.

### Pitfall 6: Sidebar Nav Order
**What goes wrong:** "KPIs" nav item appears in the wrong position relative to other items.
**Why it happens:** CONTEXT.md specifies "Add KPIs entry between Charts and Datasets in nav-main.tsx." The current nav order is: Dashboards, Charts, Datasets, Data Explorer, Reports.
**How to avoid:** Insert KPIs at index 2 in the navigation items array (after Charts, before Datasets). Use the `Gauge` icon from Lucide (it matches KPI semantics better than generic alternatives).
**Warning signs:** Visual inconsistency in sidebar ordering.

## Code Examples

### KPI Library Card with Live Preview
```tsx
// Source: Adapted from config-kpi-row.tsx and chart-library-card.tsx [VERIFIED: codebase]
interface KpiLibraryCardProps {
  kpi: RecvizKpi
  datasetName: string
  onClick: () => void
}

export function KpiLibraryCard({ kpi, datasetName, onClick }: KpiLibraryCardProps) {
  // Query the dataset to get a live value
  const { data: dataset } = useManagedDataset(kpi.datasetId)
  const { data: rawResult, isLoading } = useQuery({
    queryKey: ['kpi-preview-value', kpi.id, kpi.datasetId],
    queryFn: () =>
      api.post<{ columns: unknown[]; data: Record<string, unknown>[] }>(
        '/api/sql/execute',
        { database_id: dataset?.databaseId, sql: dataset?.sql, limit: 10000 },
      ),
    enabled: dataset !== undefined,
    staleTime: 5 * 60 * 1000,
  })

  // Compute aggregated value client-side
  const computedValue = useMemo(() => {
    if (!rawResult?.data?.length) return 0
    const col = kpi.metricColumn
    const agg = kpi.aggregation
    const values = rawResult.data
      .map((row) => Number(row[col]))
      .filter((v) => !isNaN(v))
    switch (agg) {
      case 'SUM': return values.reduce((a, b) => a + b, 0)
      case 'AVG': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
      case 'COUNT': return values.length
      case 'MIN': return Math.min(...values)
      case 'MAX': return Math.max(...values)
      default: return values.reduce((a, b) => a + b, 0)
    }
  }, [rawResult, kpi.metricColumn, kpi.aggregation])

  const formatOptions: FormatNumberOptions = {
    type: kpi.config.format.type,
    decimals: kpi.config.format.decimals ?? undefined,
    abbreviate: kpi.config.format.abbreviate,
    currencyCode: kpi.config.format.currencyCode ?? undefined,
  }

  return (
    <div className={cn(
      'group relative flex flex-col rounded-lg border bg-card p-4',
      'cursor-pointer transition-all duration-200',
      'hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
    )} onClick={onClick}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
        {kpi.name}
      </p>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {isLoading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <CountAnimation number={computedValue} formatOptions={formatOptions} duration={0.8} />
        )}
      </div>
      {/* Trend arrow + subtitle */}
      {kpi.config.trend && (
        <p className="mt-1 text-xs text-muted-foreground">{kpi.config.subtitle}</p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground truncate">
        {datasetName}
      </p>
    </div>
  )
}
```

### Threshold Color Utility
```tsx
// Source: Derived from config-kpi-row.tsx color pattern [VERIFIED: codebase]
type ThresholdLevel = 'green' | 'amber' | 'red' | 'none'

function getThresholdLevel(value: number, thresholds: ThresholdConfig | null | undefined): ThresholdLevel {
  if (!thresholds) return 'none'
  if (value >= thresholds.greenAbove) return 'green'
  if (value >= thresholds.amberAbove) return 'amber'
  return 'red'
}

const THRESHOLD_STYLES: Record<ThresholdLevel, string> = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  none: 'text-foreground',
}

const THRESHOLD_BG_STYLES: Record<ThresholdLevel, string> = {
  green: 'bg-green-500/10',
  amber: 'bg-amber-500/10',
  red: 'bg-red-500/10',
  none: '',
}
```

### Trend Subtitle Generation
```tsx
// Source: Derived from D-04 requirements [VERIFIED: CONTEXT.md]
function getTrendSubtitle(trend: TrendPeriodConfig | TrendTargetConfig | null | undefined): string {
  if (!trend) return ''
  if (trend.mode === 'previous_period') {
    return `vs last ${trend.period}`
  }
  if (trend.mode === 'static_target') {
    return trend.targetLabel || `target: ${trend.targetValue}`
  }
  return ''
}
```

## KPI Data Model Design

### Database Table: `recviz_kpis`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `String(128)` PK | UUID |
| `name` | `String(256)` NOT NULL | Display name |
| `description` | `String(1024)` default '' | Optional description |
| `dataset_id` | `String(128)` NOT NULL | FK reference to `recviz_datasets.id` |
| `metric_column` | `String(256)` NOT NULL | Column from dataset to aggregate |
| `aggregation` | `String(32)` NOT NULL default 'SUM' | SUM, AVG, COUNT, MIN, MAX, COUNT_DISTINCT |
| `config` | `JSONB` NOT NULL default '{}' | Format, trend, thresholds, subtitle (structured via Pydantic) |
| `created_at` | `DateTime(tz)` | Auto-set |
| `updated_at` | `DateTime(tz)` | Auto-set, auto-update |

**Index:** `ix_recviz_kpis_dataset_id` on `dataset_id` (for dataset delete reference checks). [VERIFIED: matches chart pattern from 003_add_charts.py]

### Config JSONB Structure

```json
{
  "format": {
    "type": "currency",
    "decimals": 2,
    "abbreviate": true,
    "currency_code": "USD"
  },
  "trend": {
    "mode": "previous_period",
    "period": "week"
  },
  "thresholds": {
    "green_above": 95.0,
    "amber_above": 80.0
  },
  "subtitle": "vs last week"
}
```

### Gap Analysis: Old KpiConfig vs New RecvizKpi

| Old `KpiConfig` (dashboard-config.ts) | New `RecvizKpi` (managed-kpi.ts) | Notes |
|----------------------------------------|----------------------------------|-------|
| `id: string` | `id: string` | Same |
| `label: string` | `name: string` | Renamed for consistency with chart/dataset |
| `format: 'number' \| 'currency' \| 'percent'` | `config.format.type` with 4 options | Expanded, includes `decimal`; `percent` -> `percentage` |
| `sources: KpiSource[]` (multi-source) | `datasetId: string` + `metricColumn: string` | Single dataset reference per D-01 |
| `aggregation: string` | `aggregation: string` | Same concept, top-level column |
| `trend?: { type, referenceKpi }` | `config.trend: TrendPeriodConfig \| TrendTargetConfig` | Complete redesign: period-based or target-based instead of cross-KPI reference |
| (no thresholds) | `config.thresholds: ThresholdConfig` | New: green/amber/red ranges |
| (no subtitle) | `config.subtitle: string` | New: context label |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `KpiConfig.sources[]` multi-source aggregation | Single dataset reference + metric column | Phase 7 (D-01) | Simpler model, one dataset per KPI |
| Trend via `referenceKpi` cross-reference | Period-based or target-based trend | Phase 7 (D-02) | More intuitive, no circular dependencies |
| No threshold coloring | Dev-defined green/amber/red ranges | Phase 7 (D-03) | Business-meaningful status colors |
| KPIs only in dashboard config JSON | Managed KPIs in PostgreSQL with CRUD API | Phase 7 | Reusable across dashboards |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Gauge` icon from Lucide is the best fit for KPI nav item | Architecture Patterns / Sidebar Nav | Low -- easy to swap icon; cosmetic only |
| A2 | KPI builder works best as single scrollable form (not accordion) given 5 fields | Architecture Patterns / Pattern 4 | Low -- Claude's Discretion area, easy to change to accordion if preferred |
| A3 | Client-side aggregation is sufficient for KPI preview in builder (up to 10000 rows) | Architecture Patterns / Pattern 5 | Medium -- if datasets are very large, preview may not match production aggregation; but preview is just for builder feedback, not production rendering |
| A4 | Trend percentage computation in preview can be omitted or use placeholder in Phase 7 | Architecture Patterns / Pattern 5 | Low -- full trend computation requires date-shifted queries which Phase 8 implements for dashboard rendering |

## Open Questions

1. **Trend computation for library card thumbnails**
   - What we know: The KPI builder preview needs to show a live value. Trend comparison requires two queries (current + comparison period).
   - What's unclear: Should the library card thumbnails show actual trend arrows with real percentages, or just the current value?
   - Recommendation: Show current value + formatting only in library cards. Show trend config description (e.g., "vs last week") as text but without computing actual trend percentage. Full trend computation is expensive and belongs in dashboard rendering (Phase 8). The builder preview should similarly show value + format but display trend section as "configured" without a live percentage.

2. **Dataset column validation**
   - What we know: KPI template references a `metric_column` that must exist in the dataset.
   - What's unclear: Should the backend validate that the column exists in the dataset's column metadata at save time?
   - Recommendation: Yes, validate at save time. Query the dataset's `columns` JSONB and check that `metric_column` is present and has an appropriate data type (number, currency). This prevents orphaned KPIs pointing to nonexistent columns. Similar to chart builder's dataset shape validation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend), pytest (backend) |
| Config file | `frontend/vitest.config.ts`, `backend/pytest.ini` (if exists) |
| Quick run command | `cd frontend && pnpm vitest run --reporter=verbose` |
| Full suite command | `cd frontend && pnpm vitest run && cd ../backend && python -m pytest` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KPI-01 | CRUD endpoints create/read/update/delete KPIs | unit (backend) | `cd backend && python -m pytest tests/test_managed_kpis.py -x` | Wave 0 |
| KPI-01 | Pydantic schemas validate config structure | unit (backend) | `cd backend && python -m pytest tests/test_kpi_schemas.py -x` | Wave 0 |
| KPI-02 | Library list renders cards, search filters, detail panel opens | unit (frontend) | `cd frontend && pnpm vitest run src/components/kpis/ -x` | Wave 0 |
| KPI-03 | KPI card renders animated counter with correct format | unit (frontend) | `cd frontend && pnpm vitest run src/components/kpis/kpi-preview-card.test.tsx -x` | Wave 0 |
| KPI-03 | Threshold utility returns correct color level | unit (frontend) | `cd frontend && pnpm vitest run src/lib/kpi-utils.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && pnpm vitest run --reporter=verbose`
- **Per wave merge:** Full suite (frontend + backend)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_managed_kpis.py` -- covers KPI-01 CRUD
- [ ] `frontend/src/components/kpis/kpi-preview-card.test.tsx` -- covers KPI-03 rendering
- [ ] `frontend/src/lib/kpi-utils.test.ts` -- covers threshold logic

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Auth deferred (per project Key Decisions) |
| V3 Session Management | no | Not applicable |
| V4 Access Control | no | Dev-only editing is convention, not enforced |
| V5 Input Validation | yes | Pydantic v2 models with Field constraints (min_length, max_length, Literal types) |
| V6 Cryptography | no | No secrets or encryption in this phase |

### Known Threat Patterns for KPI CRUD

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via metric_column | Tampering | Column name validated against dataset metadata (not used in raw SQL); Superset parameterizes all queries |
| Oversized JSONB config | Denial of Service | Pydantic model validation constrains structure and types |
| XSS via KPI name/description | Tampering | React auto-escapes JSX interpolation; no dangerouslySetInnerHTML |

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- All existing model files, migration files, API routes, frontend components, and type definitions read directly from the repository
- `backend/app/db/models/chart.py` -- SQLAlchemy model pattern
- `backend/app/models/managed_chart.py` -- Pydantic schema pattern
- `backend/app/api/managed_charts.py` -- CRUD endpoint pattern
- `backend/app/migrations/versions/003_add_charts.py` -- Migration pattern
- `frontend/src/types/managed-chart.ts` -- TypeScript type pattern
- `frontend/src/hooks/use-managed-charts.ts` -- TanStack Query hook pattern
- `frontend/src/components/charts/chart-library-list.tsx` -- Library list pattern
- `frontend/src/components/charts/chart-library-card.tsx` -- Library card pattern
- `frontend/src/components/charts/chart-library-toolbar.tsx` -- Toolbar pattern
- `frontend/src/components/charts/chart-builder.tsx` -- Builder pattern
- `frontend/src/components/charts/chart-detail-panel.tsx` -- Detail panel pattern
- `frontend/src/components/dashboard/config-kpi-row.tsx` -- KPI rendering pattern
- `frontend/src/components/shared/count-animation.tsx` -- Animation component
- `frontend/src/lib/formatters.ts` -- Formatting utilities
- `frontend/src/lib/kpi-aggregator.ts` -- KPI computation logic
- `frontend/src/types/dashboard-config.ts` -- Existing KPI type definitions

### Secondary (MEDIUM confidence)
- None needed -- this phase is entirely cloning established codebase patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing patterns
- Architecture: HIGH -- direct clone of Phase 6 with simplifications
- Pitfalls: HIGH -- documented from actual codebase issues encountered in Phases 5-6
- Data model: HIGH -- designed from CONTEXT.md decisions and existing type analysis

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- no external dependency changes)
