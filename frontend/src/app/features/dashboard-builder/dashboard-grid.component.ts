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
          (remove)="onRemove(widget.id)">
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

      // Dark scrollbar styling
      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 3px;
        &:hover {
          background: var(--text-muted);
        }
      }
    }

    /* Gridster item styling for liquid glass widgets */
    ::ng-deep .gridster-item {
      /* No border-radius here - widget-wrapper handles its own radius */
      overflow: visible; /* Allow box-shadow to extend */
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  z-index 0s;

      &:hover {
        z-index: 10;
      }
    }

    /* Resize handles with primary color */
    ::ng-deep .gridster-item-resizable-handler {
      opacity: 0;
      transition: opacity 0.2s ease;

      &.handle-se {
        border-color: var(--color-primary) !important;
        width: 12px !important;
        height: 12px !important;
      }

      &.handle-ne, &.handle-sw, &.handle-nw {
        border-color: var(--color-primary) !important;
      }

      &.handle-n, &.handle-s {
        height: 8px !important;
        background: rgba(var(--color-primary-rgb), 0.3);
        border-radius: 4px;
      }

      &.handle-e, &.handle-w {
        width: 8px !important;
        background: rgba(var(--color-primary-rgb), 0.3);
        border-radius: 4px;
      }
    }

    ::ng-deep .gridster-item:hover .gridster-item-resizable-handler {
      opacity: 1;
    }

    /* Preview ghost for drag/resize */
    ::ng-deep .gridster-preview {
      background: rgba(var(--color-primary-rgb), 0.15) !important;
      border: 2px dashed rgba(var(--color-primary-rgb), 0.5) !important;
      border-radius: var(--radius-xl) !important;
      backdrop-filter: blur(4px);
      box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.2);
    }

    /* Widget item base - now handled by widget-wrapper */
    .widget-item {
      background: transparent;
      border: none;
    }
  `],
    standalone: false
})
export class DashboardGridComponent {
  @Input() widgets: DashboardWidget[] = [];
  @Input() options: GridsterConfig = {};
  @Input() editMode = true;
  @Output() widgetRemove = new EventEmitter<string>();
  @Output() layoutChange = new EventEmitter<DashboardWidget[]>();

  onRemove(widgetId: string) {
    this.widgetRemove.emit(widgetId);
  }
}
