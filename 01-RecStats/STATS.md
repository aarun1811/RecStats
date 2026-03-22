# RecStats Codebase Analytics

*Last updated: 2025-02-03*

## Overview

| Metric | Value |
|--------|-------|
| Total Source Files | 105 |
| Total Lines of Code | 34,505 |
| Project Age | 8 days |
| Total Commits | 94 |

---

## Source Files

| Type | Files | Percentage |
|------|-------|------------|
| TypeScript | 76 | 72% |
| Python | 29 | 28% |
| **Total** | **105** | **100%** |

---

## Lines of Code

| Language | Lines | Percentage |
|----------|-------|------------|
| TypeScript | 28,598 | 83% |
| Python | 5,907 | 17% |
| **Total** | **34,505** | **100%** |

---

## Recent Additions

### Dashboard Widget Enhancements
| Feature | Description |
|---------|-------------|
| Premium Glass Styling | Multi-layered gradients, refined shadows, accent lines for dark mode |
| Light Mode Support | Complete light theme variables for frosted glass widgets |
| Theme-aware Components | Action buttons, text shadows, overlays adapt to theme |
| Loading Animations | Fixed Angular view encapsulation for spinner animations |

### Filter System
| Component | Purpose |
|-----------|---------|
| `FilterStateService` | Runtime filter state management with Signals |
| `FilterConfigService` | API communication for filter CRUD |
| `FilterWidgetComponent` | Renders filter controls by type |
| `FilterBarComponent` | Horizontal bar with active filter pills |
| `FilterConfigModalComponent` | Two-panel modal for filter configuration |
| `SelectComponent` | Dropdown with single/multi-select, search |
| `DateRangePickerComponent` | Calendar picker with presets |
| `RangeSliderComponent` | Dual-handle numeric slider |

### Cross-Filtering
| Component | Purpose |
|-----------|---------|
| `CrossFilterService` | Manages cross-filter state between charts |
| `CrossFilterIndicatorComponent` | Visual badge for filter status |

---

## Architecture

### Frontend (Angular 19)

| Category | Count |
|----------|-------|
| Feature Components | 48 |
| Shared Components | 18 |
| Core Services | 7 |
| **Total** | **73** |

### Backend (FastAPI + SQLAlchemy)

| Category | Count |
|----------|-------|
| API Endpoints | 10 |
| Pydantic Schemas | 7 |
| Data Connectors | 4 |
| Database Models | 5 |
| **Total** | **26** |

---

## Largest Files

| Lines | File |
|-------|------|
| 2,226 | `features/chart-builder/chart-builder.component.ts` |
| 2,066 | `features/query-editor/query-editor.component.ts` |
| 1,597 | `backend/app/db/seed_data.py` |
| 1,439 | `features/chart-builder/chart-list.component.ts` |
| 1,435 | `features/data-sources/data-source-sidebar.component.ts` |
| 1,227 | `features/dashboard-builder/dashboard-list.component.ts` |
| 1,127 | `shared/components/select/select.component.ts` |
| 1,120 | `features/data-sources/data-source-list.component.ts` |
| 1,115 | `features/dashboard-builder/filters/filter-config-modal/filter-config-modal.component.ts` |
| 1,082 | `shared/components/date-range-picker/date-range-picker.component.ts` |

---

## Project Velocity

| Metric | Value |
|--------|-------|
| Total Commits | 94 |
| Project Age | 8 days |
| Commits per Day | 11.8 |
| Start Date | 2026-01-26 |
| Latest Commit | 2026-02-03 |

---

## Tech Stack

**Frontend**
- Angular 19 with Signals
- TypeScript
- SCSS with CSS Variables
- ECharts for visualizations
- AG Grid for data tables
- Angular Gridster2 for dashboards
- DuckDB-WASM for in-browser SQL

**Backend**
- Python 3.12
- FastAPI
- SQLAlchemy (async)
- Pydantic
- SQLite (development)

---

## Feature Highlights

### Dashboard Widget System
- Premium liquid glass styling with theme support
- Collapsible sidebar with expand/collapse functionality
- Animated loading spinners with proper CSS scoping
- Cross-filter visual indicators

### Dashboard Filtering System
- User-configured SQL queries for filter values
- Multiple filter types: select, multi-select, range, date-range, text
- Filter-to-chart mapping with column name configuration
- Real-time filter state management with Angular Signals

### Cross-Filtering
- Click on chart elements to filter other charts
- Visual indicators showing source and filtered charts
- Multi-value selection support
- Clear button to remove cross-filters
