import type { GridOptions } from 'ag-grid-community'

/** Shared AG Grid defaults for all grids in RecViz */
export const defaultGridOptions: GridOptions = {
  animateRows: true,
  rowSelection: { mode: 'multiRow' },
  suppressCellFocus: false,
  enableCellTextSelection: true,
  pagination: false,
  headerHeight: 36,
  rowHeight: 34,
  defaultColDef: {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
  },
}
