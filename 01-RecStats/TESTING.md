# ResStats - Testing Guide

## Quick Start

### Starting the Application

```bash
# Terminal 1: Start Backend (required for full functionality)
cd backend
source venv/bin/activate
python main.py
# Runs on http://localhost:8000
# First start will seed 100K+ mock records (takes ~30 seconds)

# Terminal 2: Start Frontend
cd frontend
npm start
# Runs on http://localhost:4200
```

### URLs
- **Frontend:** http://localhost:4200
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs (Swagger UI)

---

## Features to Test

### 1. Home Page (`/`)
**What to test:**
- [ ] KPI cards display with **live values** from SQLite (Total Transactions, Match Rate, Open Breaks, Avg Break Age)
- [ ] KPI trend indicators show up/down arrows with colors (green for positive, red for negative)
- [ ] Trends show percentage change vs previous period
- [ ] "SQLite Backend Active" banner appears after data loads
- [ ] Quick action cards are clickable and navigate to correct routes
- [ ] Sample dashboard cards are clickable and navigate to `/dashboards/:id`
- [ ] Dark theme with Citi Blue accents
- [ ] Loading spinner shown while KPIs are fetching

**Expected KPI Values (approximate):**
| KPI | Expected Range | Trend |
|-----|----------------|-------|
| Total Transactions | ~100,000 | Shows weekly change |
| Match Rate | 85-88% | Shows improvement/decline |
| Open Breaks | ~15,000 | Down is good (green) |
| Avg Break Age | 10-15 days | Down is good (green) |

---

### 2. Dashboard List (`/dashboards`)
**What to test:**
- [ ] Page shows 5 seeded sample dashboards with icons
- [ ] Each dashboard card shows name, description, and chart count
- [ ] "User Dashboards" section shows any custom-saved dashboards
- [ ] Click "Create New Dashboard" button to create a new dashboard
- [ ] Click a sample dashboard to open it
- [ ] Delete button removes user-created dashboards (sample dashboards cannot be deleted)

**Sample Dashboards:**
| Name | ID | Charts | Description |
|------|-----|--------|-------------|
| Executive Overview | executive | 6 | High-level KPIs and trends |
| Break Analysis | breaks | 5 | Break reasons and aging |
| Geographic View | geo | 5 | Regional distribution + World Map |
| Reconciliation Status | recon | 4 | Match rates by recon type |
| Trend Analytics | trends | 5 | Historical trend lines |

---

### 3. Dashboard Builder (`/dashboards/:id`)
**What to test:**
- [ ] Grid layout displays widgets based on dashboard configuration
- [ ] Widgets can be **dragged** to new positions (grab the header)
- [ ] Widgets can be **resized** (drag corner handles)
- [ ] KPI widgets show **live values** from SQL queries
- [ ] Chart widgets render with **real data** from SQL queries
- [ ] "Add Widget" button opens modal with widget types
- [ ] Widget remove button (X) removes the widget
- [ ] Edit button opens widget configuration
- [ ] Refresh button reloads widget data
- [ ] "Save" button persists layout to backend
- [ ] "Preview" mode disables drag/resize
- [ ] Dashboard persists after page refresh

**Cross-Filtering (NEW):**
- [ ] Click on a bar/pie slice in any chart
- [ ] Filter chip appears in toolbar (e.g., "region = APAC")
- [ ] All other widgets refresh with filtered data
- [ ] Multiple filters can be applied
- [ ] Click "X" on filter chip to remove it
- [ ] "Clear All" button removes all filters
- [ ] Filters do NOT affect the widget that created them (source excluded)

**Testing Cross-Filter:**
1. Open `/dashboards/executive`
2. Click on a bar in "Breaks by Region" chart (e.g., click "APAC")
3. Watch other charts update to show only APAC data
4. Filter chip appears: "region = APAC"
5. Click another chart bar to add another filter
6. Click "X" to remove filters

**Testing World Map:**
1. Open `/dashboards/geo` (Geographic View dashboard)
2. World map chart should render with countries colored by transaction volume
3. Hover over a country to see tooltip with value
4. Countries with more transactions appear brighter/more saturated
5. Visual map legend shows the data range
6. Map supports pan and zoom (mouse drag and scroll)

---

### 4. Query Editor (`/queries`)
**What to test:**
- [ ] Monaco SQL editor loads with syntax highlighting
- [ ] Schema explorer sidebar shows tables: `transactions`, `breaks`, `daily_metrics`
- [ ] Click table name to expand and see columns with data types
- [ ] Click column name to insert into editor at cursor position
- [ ] "Run" button executes query against **SQLite backend**
- [ ] Results appear in ag-grid table below
- [ ] Query execution time shown in status bar
- [ ] "Save Query" button opens modal to name and save
- [ ] "Saved Queries" dropdown shows previously saved queries
- [ ] Select saved query to load into editor

**Sample Queries to Try:**
```sql
-- Count transactions by status
SELECT status, COUNT(*) as count
FROM transactions
GROUP BY status

-- Top 5 break reasons
SELECT reason, COUNT(*) as count
FROM breaks
GROUP BY reason
ORDER BY count DESC
LIMIT 5

-- Daily metrics for last 30 days
SELECT * FROM daily_metrics
ORDER BY date DESC
LIMIT 30

-- Transactions by region
SELECT region,
       COUNT(*) as total,
       SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched
FROM transactions
GROUP BY region

-- Breaks by category and age
SELECT category,
       AVG(age_days) as avg_age,
       COUNT(*) as count
FROM breaks
GROUP BY category
ORDER BY avg_age DESC

-- Match rate by LOB
SELECT lob,
       COUNT(*) as total,
       ROUND(SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as match_rate
FROM transactions
GROUP BY lob
ORDER BY match_rate DESC
```

---

### 5. Chart Builder (`/charts`)
**What to test:**
- [ ] Chart type picker shows 17 chart types in 5 categories
- [ ] Clicking a chart type selects it (highlighted border)
- [ ] Chart preview updates based on selected type
- [ ] Configuration panel shows options (title, colors, etc.)
- [ ] Can link chart to a saved query
- [ ] "Save Chart" button persists chart configuration
- [ ] Saved charts appear in chart list

**Chart Types Available:**
| Category | Types |
|----------|-------|
| Basic | Bar, Line, Area |
| Distribution | Pie, Donut, Scatter, Bubble |
| KPI | Gauge, Speedometer, Radial Bar, KPI Card |
| Advanced | Heatmap, Treemap, Funnel, Sankey, Radar |
| Geographic | World Map |

---

### 6. Navigation & UI
**What to test:**
- [ ] Sidebar navigation works (Dashboards, Queries, Charts, Data Sources, etc.)
- [ ] Active nav item is highlighted
- [ ] Sidebar collapse/expand works
- [ ] Theme toggle (sun/moon icon) switches between dark/light
- [ ] Icons render correctly throughout the app
- [ ] Hover effects on cards (glow effect)
- [ ] Buttons have proper hover states
- [ ] Notifications appear for success/error messages

---

## Mock Data Details

### Location
Mock data is seeded in SQLite backend on first startup:
- **Seed File:** `backend/app/db/seed_data.py`
- **Database:** `backend/resstats.db`

### Tables & Data Volume

| Table | Rows | Description |
|-------|------|-------------|
| `transactions` | 100,000 | Mock trade/transaction records |
| `breaks` | 15,000 | Reconciliation breaks/exceptions |
| `daily_metrics` | 365 | Daily aggregated metrics (1 year) |
| `queries` | 23 | Pre-seeded SQL queries for dashboards |
| `charts` | 15 | Pre-seeded chart configurations |
| `dashboards` | 5 | Sample dashboard layouts |

### Transactions Table Schema
```
id            - TXN00000001 format
date          - Last 90 days
amount        - Random 0-100,000
currency      - USD, EUR, GBP, JPY, CHF, SGD, HKD
region        - APAC, EMEA, NAM, LATAM
country       - Based on region (20+ countries)
lob           - Markets, Banking, Securities Services, Treasury
source_system - System A, B, C, D
counterparty  - CPTY0001-0500
status        - matched (85%), unmatched (10%), break (5%)
```

### Breaks Table Schema
```
id             - BRK000001 format
transaction_id - Links to transactions
reason         - Amount Mismatch, Date Mismatch, Missing Trade, etc.
category       - Critical, High, Medium, Low
amount         - Random 0-10,000
age_days       - 0-30 days
assigned_to    - John Smith, Jane Doe, etc. or Unassigned
region         - APAC, EMEA, NAM, LATAM
lob            - Markets, Banking, Securities Services, Treasury
created_date   - Last 30 days
priority       - 1-4
```

### Daily Metrics Table Schema
```
date               - Last 365 days
total_transactions - 20,000-70,000
matched            - Based on match_rate
unmatched          - Remainder
breaks             - ~30% of unmatched
match_rate         - 90-98%
avg_break_age      - 2-7 days
```

---

## Backend API Endpoints

### Health Check
```bash
curl http://localhost:8000/api/health
```

### KPI Summary (Home Page)
```bash
curl http://localhost:8000/api/dashboards/kpis/summary
```

### Schema (Query Editor Sidebar)
```bash
curl http://localhost:8000/api/queries/schema
```

### Execute Query
```bash
curl -X POST http://localhost:8000/api/queries/direct \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM transactions LIMIT 10"}'
```

### Queries CRUD
```bash
# List saved queries
curl http://localhost:8000/api/queries

# Create query
curl -X POST http://localhost:8000/api/queries \
  -H "Content-Type: application/json" \
  -d '{"name": "My Query", "sql": "SELECT * FROM transactions", "description": "Test"}'

# Get query by ID
curl http://localhost:8000/api/queries/{id}
```

### Charts CRUD
```bash
# List charts
curl http://localhost:8000/api/charts

# Get chart with data
curl http://localhost:8000/api/charts/{id}/data/direct
```

### Dashboards CRUD
```bash
# List dashboards
curl http://localhost:8000/api/dashboards

# Get dashboard by ID
curl http://localhost:8000/api/dashboards/{id}

# Create dashboard
curl -X POST http://localhost:8000/api/dashboards \
  -H "Content-Type: application/json" \
  -d '{"name": "My Dashboard", "layout": []}'
```

---

## Cross-Filtering Architecture

### How It Works
1. User clicks a chart element (bar, pie slice, etc.)
2. Chart emits filter event: `{ field: 'region', value: 'APAC' }`
3. Dashboard captures event and adds to filter state
4. All widgets receive updated filters array
5. Each widget's SQL is modified with WHERE clause
6. Widgets re-fetch data with filtered SQL
7. Source widget is excluded from its own filter

### SQL Modification Example
**Original SQL:**
```sql
SELECT status, COUNT(*) FROM transactions GROUP BY status
```

**With Filter Applied:**
```sql
SELECT status, COUNT(*) FROM transactions WHERE region = 'APAC' GROUP BY status
```

### Filter State
```typescript
interface CrossFilter {
  field: string;      // Column name (e.g., 'region')
  value: any;         // Filter value (e.g., 'APAC')
  sourceWidgetId: string;  // Widget that created this filter
}
```

---

## Completed Features (vs Original Prototype)

| Feature | Before | After |
|---------|--------|-------|
| KPI Data | Hardcoded values | Live from SQLite API |
| Query Execution | Not implemented | Executes against SQLite |
| Schema Explorer | Static demo | Real tables from SQLite |
| Chart Data | Static demo | Bound to SQL queries |
| Dashboard Save | Not implemented | Persists to SQLite |
| Dashboard Load | Not implemented | Loads from SQLite |
| Sample Dashboards | Hardcoded widgets | Seeded in database |
| Cross-Filtering | Not implemented | Click-to-filter works |
| Query Save/Load | Not implemented | Full CRUD support |
| Mock Data Volume | 10K in-browser | 100K in SQLite |

---

## Troubleshooting

### Icons not showing
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### KPIs showing 0 values
- Ensure backend is running and seeded
- Check browser console for API errors
- Verify backend: `curl http://localhost:8000/api/dashboards/kpis/summary`

### Backend not starting
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Frontend build errors
```bash
cd frontend
npm install --legacy-peer-deps
npm start
```

### Cross-filters not working
- Ensure you're in edit mode (not preview)
- Check browser console for errors
- Verify widget has SQL configured

### Dashboard not saving
- Ensure backend is running
- Check browser console for API errors
- Verify: `curl http://localhost:8000/api/dashboards`

---

## File Structure Reference

```
ResStats/
├── frontend/
│   ├── src/app/
│   │   ├── core/services/
│   │   │   ├── api.service.ts        # HTTP client for all API calls
│   │   │   ├── duckdb.service.ts     # DuckDB-WASM (future use)
│   │   │   ├── data-cache.service.ts # In-browser cache
│   │   │   ├── theme.service.ts      # Dark/light toggle
│   │   │   └── notification.service.ts
│   │   ├── features/
│   │   │   ├── dashboard-builder/
│   │   │   │   ├── dashboard-list.component.ts    # Dashboard gallery
│   │   │   │   ├── dashboard-builder.component.ts # Grid editor
│   │   │   │   ├── dashboard-grid.component.ts    # Gridster wrapper
│   │   │   │   ├── widget-wrapper.component.ts    # Widget container
│   │   │   │   └── chart-widget.component.ts      # Chart renderer
│   │   │   ├── dashboard-viewer/
│   │   │   │   └── home.component.ts              # Home page with KPIs
│   │   │   ├── query-editor/                      # SQL editor
│   │   │   └── chart-builder/                     # Chart creation
│   │   ├── shared/components/                     # UI components
│   │   └── layouts/                               # App layout
│   └── src/styles/                                # SCSS theme files
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── queries.py      # Query CRUD + execute + schema
│   │   │   ├── charts.py       # Chart CRUD + data endpoint
│   │   │   └── dashboards.py   # Dashboard CRUD + KPI summary
│   │   ├── connectors/
│   │   │   └── sqlite.py       # SQLite query executor
│   │   ├── db/
│   │   │   ├── models.py       # SQLAlchemy models
│   │   │   └── seed_data.py    # 100K mock data generator
│   │   └── schemas/            # Pydantic schemas
│   └── main.py                 # FastAPI entry point (auto-seeds on startup)
└── TESTING.md                  # This file
```
