import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ColDef, GridOptions } from 'ag-grid-community';

interface Column {
  name: string;
  data_type: string;
}

@Component({
  selector: 'app-results-table',
  template: `
    <ag-grid-angular
      class="ag-theme-alpine-dark results-grid"
      [rowData]="data"
      [columnDefs]="columnDefs"
      [gridOptions]="gridOptions"
      [defaultColDef]="defaultColDef">
    </ag-grid-angular>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .results-grid {
      width: 100%;
      height: 100%;
    }

    ::ng-deep .ag-theme-alpine-dark {
      --ag-background-color: var(--bg-primary);
      --ag-header-background-color: var(--bg-secondary);
      --ag-odd-row-background-color: var(--bg-primary);
      --ag-row-hover-color: rgba(var(--color-primary-rgb), 0.1);
      --ag-selected-row-background-color: rgba(var(--color-primary-rgb), 0.2);
      --ag-border-color: var(--border-color);
      --ag-header-foreground-color: var(--text-secondary);
      --ag-foreground-color: var(--text-primary);
      --ag-secondary-foreground-color: var(--text-secondary);
      --ag-font-family: var(--font-sans);
      --ag-font-size: 13px;
      --ag-row-height: 36px;
      --ag-header-height: 40px;
      --ag-cell-horizontal-padding: 12px;

      .ag-header-cell {
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.5px;
      }

      .ag-cell {
        font-family: var(--font-mono);
        font-size: 13px;
      }

      .ag-row-hover {
        background: rgba(var(--color-primary-rgb), 0.08);
      }

      .ag-header-cell-resize {
        &::after {
          background: var(--border-color);
        }
      }

      .ag-paging-panel {
        background: var(--bg-secondary);
        border-top: 1px solid var(--border-color);
      }
    }
  `]
})
export class ResultsTableComponent implements OnChanges {
  @Input() columns: Column[] = [];
  @Input() data: any[] = [];

  columnDefs: ColDef[] = [];

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100
  };

  gridOptions: GridOptions = {
    animateRows: true,
    enableCellTextSelection: true,
    pagination: true,
    paginationPageSize: 100,
    suppressMenuHide: true,
    rowSelection: 'multiple'
  };

  ngOnChanges(changes: SimpleChanges) {
    if (changes['columns'] && this.columns) {
      this.columnDefs = this.columns.map(col => ({
        field: col.name,
        headerName: col.name,
        cellClass: this.getCellClass(col.data_type),
        valueFormatter: this.getValueFormatter(col.data_type)
      }));
    }
  }

  private getCellClass(dataType: string): string {
    switch (dataType) {
      case 'number':
        return 'text-right';
      case 'date':
        return 'text-center';
      default:
        return '';
    }
  }

  private getValueFormatter(dataType: string): any {
    switch (dataType) {
      case 'number':
        return (params: any) => {
          if (params.value == null) return '';
          return typeof params.value === 'number'
            ? params.value.toLocaleString('en-US', { maximumFractionDigits: 2 })
            : params.value;
        };
      case 'date':
        return (params: any) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString();
        };
      default:
        return undefined;
    }
  }
}
