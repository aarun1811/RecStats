import { Component, Input, Output, EventEmitter } from '@angular/core';

interface TableSchema {
  name: string;
  columns: { name: string; data_type: string }[];
}

@Component({
  selector: 'app-schema-explorer',
  template: `
    <div class="schema-explorer">
      <div *ngIf="tables.length === 0" class="empty-state">
        <app-icon name="database" [size]="32"></app-icon>
        <p>No tables available</p>
        <p class="hint">Select a data source to explore schema</p>
      </div>

      <div class="table-list">
        <div
          *ngFor="let table of tables"
          class="table-item"
          [class.expanded]="expandedTables[table.name]">

          <div
            class="table-header"
            (click)="toggleTable(table.name)">
            <div class="table-icon">
              <app-icon
                [name]="expandedTables[table.name] ? 'chevron-down' : 'chevron-right'"
                [size]="14">
              </app-icon>
              <app-icon name="table" [size]="16"></app-icon>
            </div>
            <span class="table-name" (dblclick)="onTableClick(table.name)">
              {{ table.name }}
            </span>
            <span class="column-count">{{ table.columns?.length || 0 }}</span>
          </div>

          <div class="columns-list" *ngIf="expandedTables[table.name]">
            <div
              *ngFor="let column of table.columns"
              class="column-item"
              (dblclick)="onColumnClick(column.name)">
              <app-icon [name]="getColumnIcon(column.data_type)" [size]="14"></app-icon>
              <span class="column-name">{{ column.name }}</span>
              <span class="column-type">{{ column.data_type }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .schema-explorer {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-2);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-8);
      color: var(--text-muted);
      text-align: center;

      p {
        margin: var(--spacing-2) 0 0;
        font-size: var(--font-size-sm);
      }

      .hint {
        font-size: var(--font-size-xs);
        color: var(--text-muted);
      }
    }

    .table-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    }

    .table-item {
      border-radius: var(--radius-md);
      overflow: hidden;

      &.expanded {
        background: rgba(var(--color-primary-rgb), 0.05);
      }
    }

    .table-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      cursor: pointer;
      border-radius: var(--radius-md);
      transition: all 0.15s ease;

      &:hover {
        background: var(--bg-tertiary);
      }
    }

    .table-icon {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      color: var(--text-muted);
    }

    .table-name {
      flex: 1;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-primary);
      cursor: pointer;

      &:hover {
        color: var(--color-primary-light);
      }
    }

    .column-count {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: var(--radius-full);
    }

    .columns-list {
      padding: 0 var(--spacing-2) var(--spacing-2);
      margin-left: var(--spacing-6);
    }

    .column-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-1) var(--spacing-2);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: var(--bg-tertiary);

        .column-name {
          color: var(--color-primary-light);
        }
      }

      app-icon {
        color: var(--text-muted);
      }
    }

    .column-name {
      flex: 1;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-family: var(--font-mono);
    }

    .column-type {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      text-transform: lowercase;
    }
  `]
})
export class SchemaExplorerComponent {
  @Input() tables: TableSchema[] = [];
  @Output() tableClick = new EventEmitter<string>();
  @Output() columnClick = new EventEmitter<string>();

  expandedTables: { [key: string]: boolean } = {};

  toggleTable(tableName: string) {
    this.expandedTables[tableName] = !this.expandedTables[tableName];
  }

  onTableClick(tableName: string) {
    this.tableClick.emit(tableName);
  }

  onColumnClick(columnName: string) {
    this.columnClick.emit(columnName);
  }

  getColumnIcon(dataType: string): string {
    switch (dataType?.toLowerCase()) {
      case 'number':
      case 'int':
      case 'integer':
      case 'float':
      case 'decimal':
        return 'hash';
      case 'date':
      case 'datetime':
      case 'timestamp':
        return 'calendar';
      case 'boolean':
      case 'bool':
        return 'toggle-left';
      default:
        return 'type';
    }
  }
}
