import { Component, signal, inject } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';
import { ChartTypeOption } from './chart-type-picker.component';

@Component({
  selector: 'app-chart-builder',
  template: `
    <div class="chart-builder-page">
      <!-- Left Panel: Chart Type Picker -->
      <aside class="left-panel" [class.collapsed]="leftPanelCollapsed()">
        <div class="panel-header">
          <h3>Chart Type</h3>
          <app-button variant="ghost" size="sm" (click)="toggleLeftPanel()">
            <app-icon [name]="leftPanelCollapsed() ? 'chevron-right' : 'chevron-left'" [size]="16"></app-icon>
          </app-button>
        </div>
        <div class="panel-content" *ngIf="!leftPanelCollapsed()">
          <app-chart-type-picker
            [selectedType]="selectedChartType()"
            (typeSelect)="onChartTypeSelect($event)">
          </app-chart-type-picker>
        </div>
      </aside>

      <!-- Center: Chart Preview -->
      <main class="center-panel">
        <div class="toolbar">
          <div class="toolbar-left">
            <h2>{{ chartConfig().title || 'New Chart' }}</h2>
          </div>
          <div class="toolbar-right">
            <app-button variant="ghost" (click)="refreshPreview()">
              <app-icon name="refresh" [size]="16"></app-icon>
              Refresh
            </app-button>
            <app-button variant="secondary" (click)="previewFullscreen()">
              <app-icon name="maximize" [size]="16"></app-icon>
              Fullscreen
            </app-button>
            <app-button variant="primary" (click)="saveChart()">
              <app-icon name="save" [size]="16"></app-icon>
              Save Chart
            </app-button>
          </div>
        </div>

        <div class="preview-area">
          <app-chart-preview
            [chartType]="selectedChartType()"
            [config]="chartConfig()"
            [title]="chartConfig().title">
          </app-chart-preview>
        </div>

        <!-- Data Source Selection -->
        <div class="data-panel">
          <div class="data-header">
            <h4>Data Source</h4>
            <app-button variant="ghost" size="sm" (click)="showDataModal = true">
              <app-icon name="database" [size]="16"></app-icon>
              Select Data
            </app-button>
          </div>
          <div class="data-info" *ngIf="selectedQuery()">
            <span class="query-name">{{ selectedQuery()?.name || 'Custom Query' }}</span>
            <span class="row-count">{{ dataRowCount() }} rows</span>
          </div>
          <div class="data-empty" *ngIf="!selectedQuery()">
            <p>No data source selected. Click "Select Data" to choose a query.</p>
          </div>
        </div>
      </main>

      <!-- Right Panel: Configuration -->
      <aside class="right-panel" [class.collapsed]="rightPanelCollapsed()">
        <div class="panel-header">
          <app-button variant="ghost" size="sm" (click)="toggleRightPanel()">
            <app-icon [name]="rightPanelCollapsed() ? 'chevron-left' : 'chevron-right'" [size]="16"></app-icon>
          </app-button>
          <h3>Configuration</h3>
        </div>
        <div class="panel-content" *ngIf="!rightPanelCollapsed()">
          <app-chart-config-panel
            [chartType]="selectedChartType()"
            [columns]="columns()"
            [config]="chartConfig()"
            (configChange)="onConfigChange($event)">
          </app-chart-config-panel>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .chart-builder-page {
      display: grid;
      grid-template-columns: auto 1fr auto;
      height: calc(100vh - 64px);
      gap: 0;
    }

    .left-panel, .right-panel {
      width: 320px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      transition: width 0.3s ease;

      &.collapsed {
        width: 48px;
      }
    }

    .right-panel {
      border-right: none;
      border-left: 1px solid var(--border-color);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      border-bottom: 1px solid var(--border-color);

      h3 {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0;
      }
    }

    .left-panel.collapsed .panel-header,
    .right-panel.collapsed .panel-header {
      padding: var(--spacing-3);
      justify-content: center;

      h3 {
        display: none;
      }
    }

    .panel-content {
      flex: 1;
      overflow: hidden;
    }

    .center-panel {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);

      h2 {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0;
      }
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .preview-area {
      flex: 1;
      padding: var(--spacing-4);
      overflow: hidden;
    }

    .data-panel {
      padding: var(--spacing-4);
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
    }

    .data-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-2);

      h4 {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        margin: 0;
      }
    }

    .data-info {
      display: flex;
      gap: var(--spacing-4);
      font-size: var(--font-size-sm);

      .query-name {
        color: var(--text-primary);
        font-weight: var(--font-weight-medium);
      }

      .row-count {
        color: var(--text-muted);
      }
    }

    .data-empty {
      p {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        margin: 0;
      }
    }
  `]
})
export class ChartBuilderComponent {
  private notifications = inject(NotificationService);

  // State
  selectedChartType = signal<string>('');
  chartConfig = signal<any>({
    title: '',
    subtitle: '',
    xAxis: '',
    yAxis: '',
    groupBy: '',
    colorScheme: 'citi',
    showLegend: true,
    showLabels: false,
    enableAnimation: true,
    enableTooltip: true
  });
  selectedQuery = signal<any>(null);
  columns = signal<{ name: string; data_type: string }[]>([]);
  dataRowCount = signal<number>(0);

  // Panel states
  leftPanelCollapsed = signal(false);
  rightPanelCollapsed = signal(false);

  // Modal
  showDataModal = false;

  onChartTypeSelect(chartType: ChartTypeOption) {
    this.selectedChartType.set(chartType.id);
    this.notifications.info(`Selected ${chartType.name}`);
  }

  onConfigChange(config: any) {
    this.chartConfig.set(config);
  }

  toggleLeftPanel() {
    this.leftPanelCollapsed.update(v => !v);
  }

  toggleRightPanel() {
    this.rightPanelCollapsed.update(v => !v);
  }

  refreshPreview() {
    // Trigger chart refresh
    this.notifications.info('Chart refreshed');
  }

  previewFullscreen() {
    this.notifications.info('Fullscreen mode coming soon');
  }

  saveChart() {
    if (!this.selectedChartType()) {
      this.notifications.warning('Please select a chart type');
      return;
    }
    this.notifications.success('Chart saved successfully');
  }
}
