import { Component, Input, Output, EventEmitter } from '@angular/core';
import { GridsterConfig } from 'angular-gridster2';
import { DashboardWidget } from './dashboard-builder.component';

@Component({
  selector: 'app-dashboard-grid',
  template: `
    <gridster [options]="options" class="dashboard-gridster">
      <gridster-item
        *ngFor="let widget of widgets"
        [item]="widget"
        class="widget-item">
        <app-widget-wrapper
          [widget]="widget"
          [editMode]="editMode"
          (remove)="onRemove(widget.id)"
          (edit)="onEdit(widget)">
        </app-widget-wrapper>
      </gridster-item>
    </gridster>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .dashboard-gridster {
      background: var(--bg-primary);
      height: 100%;
    }

    ::ng-deep .gridster-item {
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: box-shadow 0.2s ease;

      &:hover {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
    }

    ::ng-deep .gridster-item-resizable-handler {
      &.handle-se {
        border-color: var(--color-primary) !important;
      }

      &.handle-ne, &.handle-sw, &.handle-nw {
        border-color: var(--color-primary) !important;
      }
    }

    ::ng-deep .gridster-preview {
      background: rgba(var(--color-primary-rgb), 0.2) !important;
      border: 2px dashed var(--color-primary) !important;
      border-radius: var(--radius-lg) !important;
    }

    .widget-item {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
    }
  `]
})
export class DashboardGridComponent {
  @Input() widgets: DashboardWidget[] = [];
  @Input() options: GridsterConfig = {};
  @Input() editMode = true;
  @Output() widgetRemove = new EventEmitter<string>();
  @Output() widgetEdit = new EventEmitter<DashboardWidget>();
  @Output() layoutChange = new EventEmitter<DashboardWidget[]>();

  onRemove(widgetId: string) {
    this.widgetRemove.emit(widgetId);
  }

  onEdit(widget: DashboardWidget) {
    this.widgetEdit.emit(widget);
  }
}
