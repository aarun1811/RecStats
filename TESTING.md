# ResStats - Testing Guide

## Quick Start

### Starting the Application

```bash
# Terminal 1: Start Backend (optional - for API features)
cd backend
source venv/bin/activate
python main.py
# Runs on http://localhost:8000

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
- [ ] KPI cards display with values (Total Transactions, Match Rate, Open Breaks, Avg Break Age)
- [ ] KPI trend indicators show up/down arrows with colors
- [ ] "DuckDB-WASM Active" banner appears after data loads
- [ ] Quick action cards are clickable and navigate to correct routes
- [ ] Sample dashboard cards are clickable
- [ ] Dark theme with Citi Blue accents

**Note:** KPI values are loaded from DuckDB-WASM mock data. First load may take 2-3 seconds.

---

### 2. Dashboard Builder (`/dashboards`)
**What to test:**
- [ ] Grid layout displays with sample widgets
- [ ] Widgets can be **dragged** to new positions (grab the header)
- [ ] Widgets can be **resized** (drag corner handles)
- [ ] KPI widgets show values with trend indicators
- [ ] Chart widgets render (bar, line, donut, gauge, speedometer)
- [ ] "Add Widget" button opens modal with widget types
- [ ] Widget remove button (X) removes the widget
- [ ] "Preview" mode disables drag/resize
- [ ] Filter bar has date range, region, LOB, status dropdowns

**Sample Dashboards:**
Navigate to these URLs to see pre-configured dashboards:
- `/dashboards/executive` - Executive Overview (9 widgets)
- `/dashboards/breaks` - Break Analysis (8 widgets)
- `/dashboards/geo` - Geographic View (6 widgets)
- `/dashboards/recon` - Reconciliation Status (8 widgets)
- `/dashboards/trends` - Trend Analytics (6 widgets)

---

### 3. Query Editor (`/queries`)
**What to test:**
- [ ] Monaco SQL editor loads with syntax highlighting
- [ ] Schema explorer sidebar shows tables: `transactions`, `breaks`, `daily_metrics`
- [ ] Click table name to expand and see columns
- [ ] Click column name to insert into editor
- [ ] "Run" button executes query
- [ ] Results appear in ag-grid table below
- [ ] Query execution time shown in status bar

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
```

---

### 4. Chart Builder (`/charts`)
**What to test:**
- [ ] Chart type picker shows 17 chart types in 5 categories
- [ ] Clicking a chart type selects it (highlighted border)
- [ ] Chart preview updates based on selected type
- [ ] Configuration panel shows options (title, colors, etc.)
- [ ] Categories: Basic, Distribution, KPI, Advanced, Geographic

**Chart Types Available:**
| Category | Types |
|----------|-------|
| Basic | Bar, Line, Area |
| Distribution | Pie, Donut, Scatter, Bubble |
| KPI | Gauge, Speedometer, Radial Bar, KPI Card |
| Advanced | Heatmap, Treemap, Funnel, Sankey, Radar |
| Geographic | World Map |

---

### 5. Navigation & UI
**What to test:**
- [ ] Sidebar navigation works (Dashboards, Queries, Charts, Data Sources, etc.)
- [ ] Active nav item is highlighted
- [ ] Sidebar collapse/expand works
- [ ] Theme toggle (sun/moon icon) switches between dark/light
- [ ] Icons render correctly throughout the app
- [ ] Hover effects on cards (glow effect)
- [ ] Buttons have proper hover states

---

## Mock Data Details

### Location
Mock data is generated in-browser by DuckDB-WASM service:
- **File:** `frontend/src/app/core/services/data-cache.service.ts`

### Tables & Data Volume

| Table | Rows | Description |
|-------|------|-------------|
| `transactions` | 10,000 | Mock trade/transaction records |
| `breaks` | 1,500 | Reconciliation breaks/exceptions |
| `daily_metrics` | 365 | Daily aggregated metrics (1 year) |

### Transactions Table Schema
```
id            - TXN00000001 format
date          - Last 90 days
amount        - Random 0-100,000
currency      - USD, EUR, GBP, JPY, CHF, SGD, HKD
region        - APAC, EMEA, NAM, LATAM
country       - Based on region
lob           - Markets, Banking, Securities Services, Treasury
source_system - System A, B, C, D
counterparty  - CPTY0001-0500
status        - matched (majority), unmatched, break
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

### Data Sources
```bash
# List all
curl http://localhost:8000/api/datasources

# Create mock source
curl -X POST http://localhost:8000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "type": "mock", "connection_config": {}}'
```

### Queries
```bash
# Execute query
curl -X POST http://localhost:8000/api/queries/execute \
  -H "Content-Type: application/json" \
  -d '{"datasource_id": "mock", "sql": "SELECT * FROM transactions LIMIT 10"}'
```

---

## Known Limitations (Prototype)

1. **No persistence** - Dashboard layouts reset on refresh (not saved to backend)
2. **Mock data only** - Oracle/Hive connectors not connected to real databases
3. **No authentication** - No login/user management
4. **Chart data is static** - Charts show demo data, not from DuckDB queries
5. **File upload** - CSV/Excel upload UI exists but not fully wired
6. **Embedding** - Embed routes exist but not tested

---

## Troubleshooting

### Icons not showing
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### DuckDB data not loading
- Check browser console for errors
- DuckDB-WASM requires modern browser (Chrome, Firefox, Edge)

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

---

## File Structure Reference

```
ResStats/
├── frontend/
│   ├── src/app/
│   │   ├── core/services/
│   │   │   ├── api.service.ts        # HTTP client
│   │   │   ├── duckdb.service.ts     # DuckDB-WASM wrapper
│   │   │   ├── data-cache.service.ts # Mock data + queries
│   │   │   ├── theme.service.ts      # Dark/light toggle
│   │   │   └── notification.service.ts
│   │   ├── features/
│   │   │   ├── dashboard-builder/    # Main dashboard feature
│   │   │   ├── dashboard-viewer/     # Home page
│   │   │   ├── query-editor/         # SQL editor
│   │   │   └── chart-builder/        # Chart creation
│   │   ├── shared/components/        # UI components
│   │   └── layouts/                  # App layout
│   └── src/styles/                   # SCSS theme files
├── backend/
│   ├── app/
│   │   ├── api/                      # Route handlers
│   │   ├── connectors/               # Data source connectors
│   │   ├── db/                       # SQLAlchemy models
│   │   └── schemas/                  # Pydantic schemas
│   └── main.py                       # FastAPI entry point
└── TESTING.md                        # This file
```
