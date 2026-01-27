import { Component, signal, computed, inject, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ColDef, GridOptions, GridReadyEvent, GridApi } from 'ag-grid-community';
import 'ag-grid-enterprise';
import { NotificationService } from '../../core/services/notification.service';
import { ApiService } from '../../core/services/api.service';

// Interfaces matching backend API responses
export interface DataSource {
  id: string;
  name: string;
  type: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql_text: string;
  data_source_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface Column {
  name: string;
  data_type: string;
}

export interface QueryExecuteResponse {
  columns: Column[];
  data: any[];
  row_count: number;
  total_count: number;
  execution_time_ms: number;
  truncated: boolean;
}

export interface ChartTypeOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  available: boolean;
}

export const CHART_TYPES: ChartTypeOption[] = [
  // Basic - Available
  { id: 'bar', name: 'Bar', icon: 'chart-bar-h', description: 'Horizontal bars for comparison', category: 'Basic', available: true },
  { id: 'column', name: 'Column', icon: 'chart-bar', description: 'Vertical bars for comparison', category: 'Basic', available: true },
  { id: 'line', name: 'Line', icon: 'chart-line', description: 'Show trends over time', category: 'Basic', available: true },
  { id: 'area', name: 'Area', icon: 'chart-area', description: 'Line chart with filled area', category: 'Basic', available: true },
  { id: 'scatter', name: 'Scatter', icon: 'chart-scatter', description: 'Show correlation between variables', category: 'Basic', available: true },
  { id: 'pie', name: 'Pie', icon: 'pie-chart', description: 'Show parts of a whole', category: 'Basic', available: true },
  { id: 'donut', name: 'Donut', icon: 'chart-donut', description: 'Pie chart with center cutout', category: 'Basic', available: true },
  // Advanced - Available
  { id: 'heatmap', name: 'Heatmap', icon: 'chart-heatmap', description: 'Show data density with colors', category: 'Advanced', available: true },
  { id: 'treemap', name: 'Treemap', icon: 'chart-treemap', description: 'Hierarchical data visualization', category: 'Advanced', available: true },
  { id: 'funnel', name: 'Funnel', icon: 'chart-funnel', description: 'Show stages in a process', category: 'Advanced', available: true },
  { id: 'radar', name: 'Radar', icon: 'chart-radar', description: 'Multi-axis comparison', category: 'Advanced', available: true },
  // KPI - Available
  { id: 'gauge', name: 'Gauge', icon: 'chart-gauge', description: 'Speedometer-style KPI display', category: 'KPI', available: true },
  { id: 'radialBar', name: 'Radial Bar', icon: 'chart-radial', description: 'Circular progress indicator', category: 'KPI', available: true },
  { id: 'kpiCard', name: 'KPI Card', icon: 'chart-kpi', description: 'Big number with trend', category: 'KPI', available: true },
  // Coming Soon
  { id: 'worldMap', name: 'Map', icon: 'globe', description: 'Geographic data visualization', category: 'Advanced', available: false },
  { id: 'sankey', name: 'Sankey', icon: 'chart-sankey', description: 'Show flow between nodes', category: 'Advanced', available: false },
  { id: 'histogram', name: 'Histogram', icon: 'chart-histogram', description: 'Distribution of continuous values', category: 'Advanced', available: false },
  { id: 'bubble', name: 'Bubble', icon: 'chart-bubble', description: 'Scatter with size dimension', category: 'Basic', available: false },
  { id: 'waterfall', name: 'Waterfall', icon: 'chart-waterfall', description: 'Show cumulative effect', category: 'Advanced', available: false },
];

type Step = 'data' | 'chart' | 'configure';

@Component({
  selector: 'app-chart-builder',
  template: `
    <div class="chart-builder">
      <!-- Left Panel: Steps -->
      <aside class="config-panel">
        <div class="panel-header">
          <h2>{{ editMode() ? 'Edit Chart' : 'New Chart' }}</h2>
          <app-button variant="ghost" size="sm" (click)="confirmClose()">
            <app-icon name="x" [size]="18"></app-icon>
          </app-button>
        </div>

        <!-- Close Confirmation Popup -->
        <div class="confirm-popup" *ngIf="showCloseConfirm()">
          <div class="confirm-content">
            <app-icon name="alert-triangle" [size]="20"></app-icon>
            <span>Discard changes?</span>
            <div class="confirm-actions">
              <button class="confirm-yes" (click)="cancel()">Yes</button>
              <button class="confirm-no" (click)="showCloseConfirm.set(false)">No</button>
            </div>
          </div>
        </div>

        <div class="steps">
          <!-- Step 1: Data Source -->
          <div class="step" [class.active]="currentStep() === 'data'" [class.completed]="isStepCompleted('data')">
            <div class="step-header" (click)="goToStep('data')">
              <div class="step-indicator">
                <span class="step-number" *ngIf="!isStepCompleted('data')">1</span>
                <app-icon *ngIf="isStepCompleted('data')" name="check" [size]="14"></app-icon>
              </div>
              <div class="step-title">
                <span class="step-name">Data Source</span>
                <span class="step-summary" *ngIf="isStepCompleted('data')">
                  {{ selectedDataSource()?.name }} &rarr; {{ selectedQuery()?.name }}
                </span>
              </div>
              <app-button *ngIf="isStepCompleted('data') && currentStep() !== 'data'" variant="ghost" size="sm">
                <app-icon name="edit-2" [size]="14"></app-icon>
              </app-button>
            </div>

            <div class="step-content" *ngIf="currentStep() === 'data'">
              <div class="form-field">
                <label>Data Source</label>
                <select [(ngModel)]="selectedDataSourceId" (ngModelChange)="onDataSourceChange($event)" [disabled]="loadingDataSources()">
                  <option value="">{{ loadingDataSources() ? 'Loading...' : 'Select data source' }}</option>
                  <option *ngFor="let ds of dataSources" [value]="ds.id">{{ ds.name }}</option>
                </select>
              </div>

              <div class="form-field" *ngIf="selectedDataSourceId">
                <label>Query / Table</label>
                <select [(ngModel)]="selectedQueryId" (ngModelChange)="onQueryChange($event)" [disabled]="loadingQueries()">
                  <option value="">{{ loadingQueries() ? 'Loading...' : 'Select query' }}</option>
                  <option *ngFor="let q of savedQueries" [value]="q.id">{{ q.name }}</option>
                </select>
              </div>

              <app-button
                variant="primary"
                [disabled]="!selectedQueryId || loadingData()"
                (click)="loadData()"
                class="step-action">
                <app-icon [name]="loadingData() ? 'loader' : 'database'" [size]="16"></app-icon>
                {{ loadingData() ? 'Loading...' : 'Load Data' }}
              </app-button>
            </div>
          </div>

          <!-- Step 2: Chart Type -->
          <div class="step" [class.active]="currentStep() === 'chart'" [class.completed]="isStepCompleted('chart')" [class.locked]="!isStepCompleted('data')">
            <div class="step-header" (click)="isStepCompleted('data') && goToStep('chart')">
              <div class="step-indicator">
                <span class="step-number" *ngIf="!isStepCompleted('chart')">2</span>
                <app-icon *ngIf="isStepCompleted('chart')" name="check" [size]="14"></app-icon>
              </div>
              <div class="step-title">
                <span class="step-name">Chart Type</span>
                <span class="step-summary" *ngIf="isStepCompleted('chart')">
                  {{ getChartTypeName(selectedChartType()) }}
                </span>
              </div>
              <app-icon *ngIf="!isStepCompleted('data')" name="lock" [size]="14" class="lock-icon"></app-icon>
              <app-button *ngIf="isStepCompleted('chart') && currentStep() !== 'chart'" variant="ghost" size="sm">
                <app-icon name="edit-2" [size]="14"></app-icon>
              </app-button>
            </div>

            <div class="step-content" *ngIf="currentStep() === 'chart'">
              <div class="suggested-charts" *ngIf="suggestedChartTypes().length > 0">
                <label>Suggested for your data</label>
                <div class="chart-suggestions">
                  <button
                    *ngFor="let ct of suggestedChartTypes()"
                    class="chart-suggestion"
                    [class.selected]="selectedChartType() === ct.id"
                    (click)="selectChartType(ct.id)">
                    <app-icon [name]="ct.icon" [size]="16"></app-icon>
                    {{ ct.name }}
                  </button>
                </div>
              </div>

              <div class="all-charts">
                <label>All chart types</label>
                <div class="chart-grid">
                  <button
                    *ngFor="let ct of availableChartTypes"
                    class="chart-type-btn"
                    [class.selected]="selectedChartType() === ct.id"
                    [class.unavailable]="!ct.available"
                    [disabled]="!ct.available"
                    (click)="ct.available && selectChartType(ct.id)">
                    <app-icon [name]="ct.icon" [size]="20"></app-icon>
                    <span>{{ ct.name }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3: Configure -->
          <div class="step" [class.active]="currentStep() === 'configure'" [class.locked]="!isStepCompleted('chart')">
            <div class="step-header" (click)="isStepCompleted('chart') && goToStep('configure')">
              <div class="step-indicator">
                <span class="step-number">3</span>
              </div>
              <div class="step-title">
                <span class="step-name">Configure</span>
              </div>
              <app-icon *ngIf="!isStepCompleted('chart')" name="lock" [size]="14" class="lock-icon"></app-icon>
            </div>

            <div class="step-content" *ngIf="currentStep() === 'configure'">
              <div class="config-section" style="margin-top: 0; padding-top: 0; border-top: none;">
                <h4>Data Mapping</h4>
                <div class="form-field" *ngIf="showXAxis()">
                  <label>{{ getXAxisLabel() }}</label>
                  <select [ngModel]="chartConfig().xAxis" (ngModelChange)="updateConfig('xAxis', $event)">
                    <option value="">Select field</option>
                    <option *ngFor="let col of columns()" [value]="col.name">{{ col.name }}</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>{{ getYAxisLabel() }}</label>
                  <select [ngModel]="chartConfig().yAxis" (ngModelChange)="updateConfig('yAxis', $event)">
                    <option value="">Select field</option>
                    <option *ngFor="let col of columns()" [value]="col.name">{{ col.name }}</option>
                  </select>
                </div>
                <div class="form-field" *ngIf="showGroupBy()">
                  <label>Group By (Series)</label>
                  <select [ngModel]="chartConfig().groupBy" (ngModelChange)="updateConfig('groupBy', $event)">
                    <option value="">None</option>
                    <option *ngFor="let col of columns()" [value]="col.name">{{ col.name }}</option>
                  </select>
                </div>
              </div>

              <div class="config-section">
                <h4>Chart Info</h4>
                <div class="form-field">
                  <label>Chart Title</label>
                  <input type="text" [ngModel]="chartConfig().title" (ngModelChange)="updateConfig('title', $event)" placeholder="Enter title">
                </div>

                <div class="form-field">
                  <label>Subtitle</label>
                  <input type="text" [ngModel]="chartConfig().subtitle" (ngModelChange)="updateConfig('subtitle', $event)" placeholder="Optional subtitle">
                </div>
              </div>

              <div class="config-section collapsible" [class.expanded]="showAppearance">
                <h4 (click)="showAppearance = !showAppearance">
                  <app-icon [name]="showAppearance ? 'chevron-down' : 'chevron-right'" [size]="14"></app-icon>
                  Appearance
                </h4>
                <div class="section-content" *ngIf="showAppearance">
                  <div class="form-field">
                    <label>Color Scheme</label>
                    <div class="color-schemes">
                      <button
                        *ngFor="let scheme of colorSchemes"
                        class="color-scheme-btn"
                        [class.active]="chartConfig().colorScheme === scheme.id"
                        (click)="updateConfig('colorScheme', scheme.id)">
                        <div class="scheme-preview">
                          <span *ngFor="let color of scheme.colors.slice(0, 4)" [style.background]="color"></span>
                        </div>
                        <span class="scheme-name">{{ scheme.name }}</span>
                      </button>
                    </div>
                  </div>
                  <div class="checkbox-row">
                    <label><input type="checkbox" [ngModel]="chartConfig().showLegend" (ngModelChange)="updateConfig('showLegend', $event)"> Show Legend</label>
                    <label><input type="checkbox" [ngModel]="chartConfig().showLabels" (ngModelChange)="updateConfig('showLabels', $event)"> Show Labels</label>
                  </div>
                  <div class="checkbox-row">
                    <label><input type="checkbox" [ngModel]="chartConfig().enableAnimation" (ngModelChange)="updateConfig('enableAnimation', $event)"> Animation</label>
                    <label><input type="checkbox" [ngModel]="chartConfig().enableTooltip" (ngModelChange)="updateConfig('enableTooltip', $event)"> Tooltips</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Save Button -->
        <div class="panel-footer">
          <app-button
            variant="primary"
            [disabled]="!canSave() || savingChart()"
            (click)="saveChart()"
            class="save-btn">
            <app-icon [name]="savingChart() ? 'loader' : 'save'" [size]="16"></app-icon>
            {{ savingChart() ? 'Saving...' : (editMode() ? 'Update Chart' : 'Save Chart') }}
          </app-button>
        </div>
      </aside>

      <!-- Right Panel: Preview -->
      <main class="preview-panel">
        <div class="preview-header">
          <span class="preview-title">
            {{ currentStep() === 'data' && !isStepCompleted('data') ? 'Data Preview' : 'Chart Preview' }}
          </span>
          <div class="preview-actions" *ngIf="isStepCompleted('chart')">
            <app-button variant="ghost" size="sm" (click)="toggleFullscreen()">
              <app-icon [name]="isFullscreen() ? 'minimize' : 'maximize'" [size]="16"></app-icon>
              {{ isFullscreen() ? 'Exit' : 'Fullscreen' }}
            </app-button>
          </div>
        </div>

        <!-- Empty State -->
        <div class="preview-empty" *ngIf="!isStepCompleted('data')">
          <div class="empty-content">
            <app-icon name="database" [size]="48"></app-icon>
            <h3>Select Data to Begin</h3>
            <p>Choose a data source and query to preview your data</p>
          </div>
        </div>

        <!-- Data Table Only (Step 1 complete, no chart yet) -->
        <div class="preview-data-only" *ngIf="isStepCompleted('data') && !isStepCompleted('chart')">
          <div class="data-grid-container">
            <ag-grid-angular
              class="ag-theme-alpine-dark data-grid"
              [rowData]="previewData()"
              [columnDefs]="columnDefs"
              [gridOptions]="gridOptions"
              [defaultColDef]="defaultColDef"
              (gridReady)="onGridReady($event)">
            </ag-grid-angular>
          </div>
          <div class="data-info">
            <span>{{ dataRowCount() }} rows loaded</span>
            <span class="column-info">{{ columns().length }} columns: {{ columnNames() }}</span>
          </div>
        </div>

        <!-- Chart + Data Table (Step 2+ complete) -->
        <div class="preview-with-chart" *ngIf="isStepCompleted('chart')">
          <div class="chart-area" #chartContainer>
            <button class="fullscreen-close-btn" (click)="toggleFullscreen()" title="Exit Fullscreen (Esc)">
              <app-icon name="x" [size]="24"></app-icon>
            </button>
            <app-chart-preview
              [chartType]="selectedChartType()"
              [config]="chartConfig()"
              [data]="previewData()">
            </app-chart-preview>
          </div>
          <div class="data-area" [class.collapsed]="dataTableCollapsed">
            <div class="data-header" (click)="dataTableCollapsed = !dataTableCollapsed">
              <span>Data</span>
              <div class="data-header-right">
                <span class="row-count">{{ dataRowCount() }} rows</span>
                <app-icon [name]="dataTableCollapsed ? 'chevron-up' : 'chevron-down'" [size]="16"></app-icon>
              </div>
            </div>
            <div class="data-content" *ngIf="!dataTableCollapsed">
              <ag-grid-angular
                class="ag-theme-alpine-dark compact-grid"
                [rowData]="previewData()"
                [columnDefs]="columnDefs"
                [defaultColDef]="defaultColDef"
                [pagination]="false"
                domLayout="autoHeight">
              </ag-grid-angular>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .chart-builder {
      display: grid;
      grid-template-columns: 380px 1fr;
      height: calc(100vh - 64px);
      background: var(--bg-primary);
      animation: pageLoad 300ms ease-out;
    }

    @keyframes pageLoad {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    // ========================================
    // LEFT PANEL - CONFIG with Glassmorphism
    // ========================================
    .config-panel {
      display: flex;
      flex-direction: column;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-right: 1px solid var(--glass-border);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4);
      border-bottom: 1px solid var(--glass-border);
      background: var(--gradient-glow);

      h2 {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0;
        background: linear-gradient(135deg, var(--text-primary) 0%, var(--color-primary-light) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      // Close button - X rotate on hover
      ::ng-deep app-button[variant="ghost"] button {
        app-icon {
          transition: transform 0.2s ease, filter 0.2s ease;
        }

        &:hover app-icon {
          transform: rotate(90deg);
          filter: drop-shadow(0 0 4px rgba(var(--color-danger-rgb), 0.5));
        }

        &:active app-icon {
          transform: rotate(90deg) scale(0.9);
        }
      }
    }

    // Close confirmation popup
    .confirm-popup {
      position: absolute;
      top: 60px;
      right: 16px;
      z-index: 100;
      animation: slideIn 0.25s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .confirm-content {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur-lg));
      -webkit-backdrop-filter: blur(var(--glass-blur-lg));
      border: 1px solid rgba(var(--color-warning-rgb), 0.3);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg), 0 0 20px rgba(var(--color-warning-rgb), 0.15);

      app-icon {
        color: var(--color-warning);
        filter: drop-shadow(0 0 6px rgba(var(--color-warning-rgb), 0.5));
        animation: warningPulse 1s ease-in-out;
      }

      @keyframes warningPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      span {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
      }
    }

    .confirm-actions {
      display: flex;
      gap: var(--spacing-2);

      button {
        padding: var(--spacing-1) var(--spacing-3);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        border-radius: var(--radius-sm);
        border: none;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .confirm-yes {
        background: var(--color-danger);
        color: white;

        &:hover {
          background: #c0392b;
          box-shadow: 0 0 12px rgba(var(--color-danger-rgb), 0.5);
          transform: scale(1.02);
        }
      }

      .confirm-no {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);

        &:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: rgba(var(--color-primary-rgb), 0.3);
        }
      }
    }

    .steps {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-3);

      // Dark scrollbar
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

    // ========================================
    // STEP STYLES - Enhanced with glows
    // ========================================
    .step {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-3);
      overflow: hidden;
      transition: all 0.25s ease;

      &.active {
        border-color: rgba(var(--color-primary-rgb), 0.5);
        box-shadow: var(--shadow-glow-sm),
                    inset 0 0 30px rgba(var(--color-primary-rgb), 0.05);
        animation: stepActivePulse 2s ease-in-out infinite;
      }

      @keyframes stepActivePulse {
        0%, 100% {
          box-shadow: var(--shadow-glow-sm),
                      inset 0 0 30px rgba(var(--color-primary-rgb), 0.05);
        }
        50% {
          box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.3),
                      inset 0 0 30px rgba(var(--color-primary-rgb), 0.08);
        }
      }

      &.completed {
        .step-header {
          cursor: pointer;
        }

        &:hover {
          border-color: rgba(var(--color-success-rgb), 0.3);
          box-shadow: 0 0 10px rgba(var(--color-success-rgb), 0.15);
        }
      }

      &.locked {
        opacity: 0.6;

        .step-header {
          cursor: not-allowed;
        }

        .lock-icon {
          animation: lockWiggle 0.5s ease-out;
        }

        &:hover .lock-icon {
          animation: lockWiggle 0.3s ease-out;
        }
      }

      @keyframes lockWiggle {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-5deg); }
        75% { transform: rotate(5deg); }
      }
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-secondary);
      transition: background 0.2s ease;
    }

    .step-indicator {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-full);
      background: var(--bg-tertiary);
      border: 2px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.25s ease;

      .step-number {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-muted);
      }

      .step.active & {
        border-color: var(--color-primary);
        background: rgba(var(--color-primary-rgb), 0.15);
        box-shadow: 0 0 10px rgba(var(--color-primary-rgb), 0.3);

        .step-number {
          color: var(--color-primary-light);
        }
      }

      .step.completed & {
        border-color: var(--color-success);
        background: var(--color-success);
        color: white;
        box-shadow: 0 0 10px rgba(var(--color-success-rgb), 0.4);

        app-icon {
          animation: checkPop 0.3s ease-out;
        }
      }

      @keyframes checkPop {
        0% { transform: scale(0); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
    }

    .step-title {
      flex: 1;
      min-width: 0;

      .step-name {
        display: block;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
      }

      .step-summary {
        display: block;
        font-size: var(--font-size-xs);
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .lock-icon {
      color: var(--text-muted);
      transition: transform 0.2s ease;
    }

    .step-content {
      padding: var(--spacing-4);
      border-top: 1px solid var(--border-color);
      animation: stepContentFade 0.25s ease-out;
    }

    @keyframes stepContentFade {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    // ========================================
    // FORM FIELDS
    // ========================================
    .form-field {
      margin-bottom: var(--spacing-3);

      label {
        display: block;
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        margin-bottom: var(--spacing-1);
      }

      input, select {
        width: 100%;
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-size: var(--font-size-sm);

        &:focus {
          outline: none;
          border-color: var(--color-primary);
        }
      }
    }

    .step-action {
      width: 100%;
      margin-top: var(--spacing-2);

      // Load Data button animations
      ::ng-deep button {
        app-icon {
          transition: transform 0.2s ease, filter 0.2s ease;
        }

        &:not(:disabled):hover app-icon {
          transform: scale(1.15);
          filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
        }

        &:disabled app-icon {
          animation: spin 1s linear infinite;
        }

        &:active:not(:disabled) app-icon {
          transform: scale(0.9);
        }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    }

    // ========================================
    // CHART TYPE SELECTION - Enhanced
    // ========================================
    .suggested-charts, .all-charts {
      margin-bottom: var(--spacing-4);

      > label {
        display: block;
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: var(--spacing-2);
        padding-left: var(--spacing-1);
        border-left: 2px solid rgba(var(--color-primary-rgb), 0.3);
      }
    }

    .chart-suggestions {
      display: flex;
      gap: var(--spacing-2);
      flex-wrap: wrap;
    }

    .chart-suggestion {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all 0.2s ease;

      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      &:hover {
        border-color: var(--color-primary-light);
        color: var(--text-primary);
        box-shadow: var(--shadow-glow-sm);

        app-icon {
          transform: scale(1.1);
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.4));
        }
      }

      &.selected {
        border-color: var(--color-primary);
        background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.15) 0%, rgba(var(--color-primary-rgb), 0.05) 100%);
        color: var(--color-primary-light);
        box-shadow: var(--shadow-glow-sm);

        app-icon {
          filter: drop-shadow(0 0 6px rgba(var(--color-primary-rgb), 0.5));
        }
      }
    }

    .chart-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--spacing-2);
    }

    .chart-type-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-3) var(--spacing-2);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;

      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      &:hover:not(.unavailable) {
        border-color: var(--color-primary-light);
        color: var(--text-primary);
        box-shadow: var(--shadow-glow-sm);
        transform: translateY(-2px);

        app-icon {
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.4));
          animation: chartIconBounce 0.4s ease-out;
        }
      }

      &:active:not(.unavailable) {
        transform: translateY(0);

        app-icon {
          transform: scale(0.9);
        }
      }

      @keyframes chartIconBounce {
        0% { transform: scale(1) translateY(0); }
        30% { transform: scale(1.2) translateY(-3px); }
        50% { transform: scale(1.1) translateY(-1px); }
        70% { transform: scale(1.15) translateY(-2px); }
        100% { transform: scale(1.15) translateY(0); }
      }

      &.selected {
        border-color: var(--color-primary);
        background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.15) 0%, rgba(var(--color-primary-rgb), 0.05) 100%);
        color: var(--color-primary-light);
        box-shadow: var(--shadow-glow-md);

        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--gradient-primary);
        }

        app-icon {
          filter: drop-shadow(0 0 6px rgba(var(--color-primary-rgb), 0.5));
        }
      }

      &.unavailable {
        opacity: 0.4;
        cursor: not-allowed;

        &::after {
          content: 'Soon';
          position: absolute;
          top: 4px;
          right: 4px;
          font-size: 8px;
          padding: 1px 4px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
        }
      }
    }

    // ========================================
    // CONFIG SECTIONS
    // ========================================
    .config-section {
      margin-top: var(--spacing-4);
      padding-top: var(--spacing-3);
      border-top: 1px solid var(--border-color);

      h4 {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 var(--spacing-3) 0;
      }

      &.collapsible h4 {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        cursor: pointer;

        &:hover {
          color: var(--text-secondary);
        }
      }
    }

    .color-schemes {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-2);
    }

    .color-scheme-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-2);
      background: var(--bg-primary);
      border: 2px solid var(--border-color);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;

      &:hover {
        border-color: var(--color-primary-light);
        transform: translateY(-2px);

        .scheme-preview span {
          box-shadow: 0 0 8px currentColor;
        }
      }

      &.active {
        border-color: var(--color-primary);
        background: rgba(var(--color-primary-rgb), 0.1);
        box-shadow: var(--shadow-glow-sm);

        &::after {
          content: '✓';
          position: absolute;
          top: -6px;
          right: -6px;
          width: 18px;
          height: 18px;
          background: var(--color-success);
          color: white;
          border-radius: var(--radius-full);
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 8px rgba(var(--color-success-rgb), 0.5);
          animation: checkmarkPop 0.3s ease-out;
        }

        @keyframes checkmarkPop {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      }
    }

    .scheme-preview {
      display: flex;
      gap: 2px;

      span {
        width: 14px;
        height: 14px;
        border-radius: var(--radius-sm);
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }
    }

    .color-scheme-btn:hover .scheme-preview span {
      transform: scale(1.1);
    }

    .scheme-name {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      transition: color 0.2s ease;
    }

    .color-scheme-btn:hover .scheme-name,
    .color-scheme-btn.active .scheme-name {
      color: var(--text-primary);
    }

    .checkbox-row {
      display: flex;
      gap: var(--spacing-4);
      margin-bottom: var(--spacing-2);

      label {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        cursor: pointer;

        input {
          width: auto;
        }
      }
    }

    // ========================================
    // PANEL FOOTER - Enhanced save button
    // ========================================
    .panel-footer {
      padding: var(--spacing-4);
      border-top: 1px solid var(--glass-border);
      background: var(--gradient-glow-bottom);

      .save-btn {
        width: 100%;

        ::ng-deep button {
          position: relative;
          overflow: hidden;

          app-icon {
            transition: transform 0.2s ease, filter 0.2s ease;
          }

          &:not(:disabled) {
            animation: saveButtonReady 2s ease-in-out infinite;

            &:hover app-icon {
              transform: translateY(-2px) scale(1.1);
              filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.5));
            }

            &:active app-icon {
              transform: translateY(1px) scale(0.95);
              animation: saveBounce 0.3s ease-out;
            }
          }

          &:disabled {
            animation: none;

            app-icon {
              animation: spin 1s linear infinite;
            }
          }
        }

        @keyframes saveButtonReady {
          0%, 100% {
            box-shadow: 0 0 5px rgba(var(--color-primary-rgb), 0.3);
          }
          50% {
            box-shadow: 0 0 15px rgba(var(--color-primary-rgb), 0.5),
                        0 0 30px rgba(var(--color-primary-rgb), 0.2);
          }
        }

        @keyframes saveBounce {
          0% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-4px) scale(1.15); }
          60% { transform: translateY(0) scale(1.05); }
          100% { transform: translateY(0) scale(1); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      }
    }

    // ========================================
    // RIGHT PANEL - PREVIEW
    // ========================================
    .preview-panel {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-bottom: 1px solid var(--glass-border);
      position: relative;

      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(var(--color-primary-rgb), 0.2), transparent);
      }

      .preview-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
      }

      // Fullscreen toggle button animation
      .preview-actions ::ng-deep app-button button {
        app-icon {
          transition: transform 0.25s ease, filter 0.2s ease;
        }

        &:hover app-icon {
          transform: scale(1.15);
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.5));
        }

        &:active app-icon {
          transform: scale(0.9);
        }
      }
    }

    // ========================================
    // PREVIEW STATES - Enhanced
    // ========================================
    .preview-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(ellipse at 50% 40%, rgba(var(--color-primary-rgb), 0.05) 0%, transparent 50%);

      .empty-content {
        text-align: center;
        color: var(--text-muted);
        animation: emptyFade 0.3s ease-out;

        @keyframes emptyFade {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        app-icon {
          margin-bottom: var(--spacing-3);
          opacity: 0.4;
          animation: floatIcon 3s ease-in-out infinite;
          filter: drop-shadow(0 0 10px rgba(var(--color-primary-rgb), 0.2));
        }

        @keyframes floatIcon {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        h3 {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--text-secondary);
          margin: 0 0 var(--spacing-2) 0;
        }

        p {
          font-size: var(--font-size-sm);
          margin: 0;
        }
      }
    }

    .preview-data-only {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      .data-grid-container {
        flex: 1;
        padding: var(--spacing-4);
      }

      .data-grid {
        width: 100%;
        height: 100%;
      }

      .data-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-3) var(--spacing-4);
        background: var(--bg-secondary);
        border-top: 1px solid var(--border-color);
        font-size: var(--font-size-sm);
        color: var(--text-muted);

        .column-info {
          max-width: 60%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }

    .preview-with-chart {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      .chart-area {
        flex: 1;
        min-height: 300px;
        padding: var(--spacing-4);
        position: relative;
        animation: chartFadeIn 0.4s ease-out;

        @keyframes chartFadeIn {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .fullscreen-close-btn {
          display: none;
        }

        &:fullscreen {
          background: var(--bg-primary);
          padding: var(--spacing-6);

          app-chart-preview {
            width: 100%;
            height: 100%;
          }

          .fullscreen-close-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            top: 16px;
            right: 16px;
            width: 40px;
            height: 40px;
            border-radius: 8px;
            border: 1px solid var(--glass-border);
            background: var(--glass-bg);
            backdrop-filter: blur(var(--glass-blur));
            -webkit-backdrop-filter: blur(var(--glass-blur));
            color: var(--text-primary);
            cursor: pointer;
            z-index: 1000;
            transition: all 0.2s ease;

            &:hover {
              background: var(--bg-tertiary);
              color: var(--text-primary);
              box-shadow: var(--shadow-glow-sm);
            }
          }
        }
      }

      .data-area {
        border-top: 1px solid var(--glass-border);
        background: var(--glass-bg);
        backdrop-filter: blur(var(--glass-blur));
        -webkit-backdrop-filter: blur(var(--glass-blur));

        &.collapsed {
          .data-content {
            display: none;
          }
        }
      }

      .data-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-3) var(--spacing-4);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        transition: all 0.2s ease;

        app-icon {
          transition: transform 0.2s ease;
        }

        &:hover {
          background: rgba(var(--color-primary-rgb), 0.05);
          color: var(--text-primary);
        }

        .data-header-right {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
        }

        .row-count {
          font-weight: var(--font-weight-normal);
          color: var(--text-muted);
          padding: 2px 8px;
          background: rgba(var(--color-primary-rgb), 0.1);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
        }
      }

      .data-content {
        padding: var(--spacing-3) var(--spacing-4);
        animation: dataContentSlide 0.2s ease-out;

        @keyframes dataContentSlide {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      }
    }

    // ========================================
    // AG-GRID THEME CUSTOMIZATION - Enhanced
    // ========================================
    ::ng-deep .ag-theme-alpine-dark {
      --ag-background-color: var(--bg-primary);
      --ag-header-background-color: var(--bg-secondary);
      --ag-odd-row-background-color: var(--bg-primary);
      --ag-row-hover-color: rgba(var(--color-primary-rgb), 0.08);
      --ag-selected-row-background-color: rgba(var(--color-primary-rgb), 0.15);
      --ag-border-color: var(--border-color);
      --ag-header-foreground-color: var(--text-secondary);
      --ag-foreground-color: var(--text-primary);
      --ag-secondary-foreground-color: var(--text-secondary);
      --ag-font-family: var(--font-sans);
      --ag-font-size: 13px;
      --ag-row-height: 36px;
      --ag-header-height: 40px;
      --ag-cell-horizontal-padding: 12px;

      border-radius: var(--radius-md);
      overflow: hidden;

      .ag-header {
        border-bottom: 1px solid var(--glass-border);
      }

      .ag-header-cell {
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.5px;
        transition: background 0.2s ease;

        &:hover {
          background: rgba(var(--color-primary-rgb), 0.05);
        }
      }

      .ag-cell {
        font-family: var(--font-mono);
        font-size: 13px;
        transition: background 0.15s ease;
      }

      .ag-row {
        transition: background 0.15s ease, box-shadow 0.15s ease;
      }

      .ag-row-hover {
        background: rgba(var(--color-primary-rgb), 0.06);
        box-shadow: inset 0 0 20px rgba(var(--color-primary-rgb), 0.08);
      }

      .ag-row-selected {
        background: rgba(var(--color-primary-rgb), 0.12);
        box-shadow: inset 0 0 20px rgba(var(--color-primary-rgb), 0.15);
      }

      .ag-header-cell-resize::after {
        background: var(--border-color);
      }

      .ag-paging-panel {
        background: var(--glass-bg);
        border-top: 1px solid var(--glass-border);
      }

      // Scrollbar styling
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: var(--bg-secondary);
      }

      ::-webkit-scrollbar-thumb {
        background: var(--bg-tertiary);
        border-radius: 4px;

        &:hover {
          background: var(--bg-hover);
        }
      }
    }

    .compact-grid {
      height: 200px;
      width: 100%;
    }

    ::ng-deep .compact-grid.ag-theme-alpine-dark {
      --ag-row-height: 28px;
      --ag-header-height: 32px;
      --ag-font-size: 12px;

      .ag-cell {
        font-size: 12px;
      }
    }
  `]
})
export class ChartBuilderComponent implements OnInit {
  private notifications = inject(NotificationService);
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Edit mode state
  editMode = signal(false);
  chartId = '';
  loadingChart = signal(false);

  // Step management
  currentStep = signal<Step>('data');
  completedSteps = signal<Set<Step>>(new Set());

  // Data source state
  selectedDataSourceId = '';
  selectedQueryId = '';
  selectedDataSource = signal<DataSource | null>(null);
  selectedQuery = signal<SavedQuery | null>(null);
  columns = signal<Column[]>([]);
  previewData = signal<any[]>([]);
  dataRowCount = signal<number>(0);

  // Chart state
  selectedChartType = signal<string>('');

  // Fullscreen state
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  isFullscreen = signal<boolean>(false);

  // Config state - use signal for reactivity
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

  // Helper to update config and trigger change detection
  updateConfig(key: string, value: any) {
    this.chartConfig.update(config => ({ ...config, [key]: value }));
  }

  // UI state
  showAppearance = false;
  dataTableCollapsed = false;
  loadingDataSources = signal<boolean>(false);
  loadingQueries = signal<boolean>(false);
  loadingData = signal<boolean>(false);
  savingChart = signal<boolean>(false);
  showCloseConfirm = signal<boolean>(false);

  // Data from API
  dataSources: DataSource[] = [];
  savedQueries: SavedQuery[] = [];

  // AG-Grid configuration
  gridApi: GridApi | null = null;
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
    rowSelection: 'multiple',
    suppressCellFocus: true
  };

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  colorSchemes = [
    { id: 'citi', name: 'Citi Blue', colors: ['#0066b2', '#3399cc', '#66b2d6', '#99cce6'] },
    { id: 'success', name: 'Success', colors: ['#2ecc71', '#27ae60', '#1abc9c', '#16a085'] },
    { id: 'warm', name: 'Warm', colors: ['#e74c3c', '#e67e22', '#f1c40f', '#f39c12'] },
    { id: 'cool', name: 'Cool', colors: ['#9b59b6', '#8e44ad', '#3498db', '#2980b9'] },
    { id: 'rainbow', name: 'Rainbow', colors: ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db'] },
    { id: 'monochrome', name: 'Mono', colors: ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6'] }
  ];

  availableChartTypes = CHART_TYPES.filter(ct => ct.available);

  // Computed values
  filteredQueries = computed(() =>
    this.savedQueries.filter(q => q.data_source_id === this.selectedDataSourceId)
  );

  columnNames = computed(() =>
    this.columns().map(c => c.name).join(', ')
  );

  // Lifecycle
  ngOnInit() {
    this.fetchDataSources();

    // Check if we're in edit mode
    const chartId = this.route.snapshot.paramMap.get('id');
    if (chartId) {
      this.editMode.set(true);
      this.chartId = chartId;
      this.loadChart(chartId);
    }
  }

  private loadChart(chartId: string) {
    this.loadingChart.set(true);
    this.api.get<any>(`/charts/${chartId}`).subscribe({
      next: (chart) => {
        // Map backend chart type back to frontend
        const backendToFrontendType: Record<string, string> = {
          'bar': 'bar',
          'bar_horizontal': 'bar',
          'line': 'line',
          'area': 'area',
          'pie': 'pie',
          'donut': 'donut',
          'scatter': 'scatter',
          'gauge': 'gauge',
          'heatmap': 'heatmap',
          'radar': 'radar',
          'funnel': 'funnel',
          'treemap': 'treemap',
          'kpi': 'kpiCard',
          'map': 'worldMap'
        };

        // Set chart type
        this.selectedChartType.set(backendToFrontendType[chart.chart_type] || chart.chart_type);

        // Set query ID
        this.selectedQueryId = chart.query_id || '';

        // Extract config values
        const config = chart.config || {};
        this.chartConfig.set({
          title: chart.name || '',
          subtitle: chart.description || '',
          xAxis: config.x_axis?.field || '',
          yAxis: config.y_axis?.field || '',
          groupBy: config.category_field || '',
          colorScheme: config.custom_options?.color_scheme || 'citi',
          showLegend: config.show_legend !== false,
          showLabels: config.show_labels === true,
          enableAnimation: config.custom_options?.enable_animation !== false,
          enableTooltip: config.show_tooltip !== false
        });

        // Mark steps as completed
        this.completedSteps.set(new Set(['data', 'chart']));
        this.currentStep.set('configure');

        // Load query to get data source and execute query
        if (chart.query_id) {
          this.loadQueryForEdit(chart.query_id);
        }

        this.loadingChart.set(false);
      },
      error: (err) => {
        this.notifications.error('Failed to load chart: ' + err.message);
        this.loadingChart.set(false);
        this.router.navigate(['/charts']);
      }
    });
  }

  private loadQueryForEdit(queryId: string) {
    this.api.get<SavedQuery>(`/queries/${queryId}`).subscribe({
      next: (query) => {
        this.selectedQuery.set(query);
        this.selectedQueryId = queryId;
        this.selectedDataSourceId = query.data_source_id;

        // Find and set the data source
        const ds = this.dataSources.find(d => d.id === query.data_source_id);
        if (ds) {
          this.selectedDataSource.set(ds);
        }

        // Load query data to populate preview
        this.loadData();
      }
    });
  }

  private fetchDataSources() {
    this.loadingDataSources.set(true);
    this.api.get<DataSource[]>('/datasources').subscribe({
      next: (dataSources) => {
        this.dataSources = dataSources;
        this.loadingDataSources.set(false);
      },
      error: (err) => {
        this.notifications.error('Failed to load data sources: ' + err.message);
        this.loadingDataSources.set(false);
      }
    });
  }

  private fetchQueries(dataSourceId: string) {
    this.loadingQueries.set(true);
    this.api.get<SavedQuery[]>('/queries', { data_source_id: dataSourceId }).subscribe({
      next: (queries) => {
        this.savedQueries = queries;
        this.loadingQueries.set(false);
      },
      error: (err) => {
        this.notifications.error('Failed to load queries: ' + err.message);
        this.loadingQueries.set(false);
      }
    });
  }

  suggestedChartTypes = computed(() => {
    const cols = this.columns();
    if (cols.length === 0) return [];

    const hasDate = cols.some(c => c.data_type === 'date');
    const hasNumber = cols.some(c => c.data_type === 'number');
    const hasString = cols.some(c => c.data_type === 'string');

    const suggestions: ChartTypeOption[] = [];

    if (hasDate && hasNumber) {
      suggestions.push(...CHART_TYPES.filter(ct => ['line', 'area', 'bar'].includes(ct.id)));
    } else if (hasString && hasNumber) {
      suggestions.push(...CHART_TYPES.filter(ct => ['bar', 'pie', 'donut'].includes(ct.id)));
    } else if (hasNumber) {
      suggestions.push(...CHART_TYPES.filter(ct => ['bar', 'scatter'].includes(ct.id)));
    }

    return suggestions.slice(0, 3);
  });

  // Methods
  isStepCompleted(step: Step): boolean {
    return this.completedSteps().has(step);
  }

  goToStep(step: Step) {
    this.currentStep.set(step);
  }

  onDataSourceChange(dsId: string) {
    this.selectedDataSource.set(this.dataSources.find(ds => ds.id === dsId) || null);
    this.selectedQueryId = '';
    this.selectedQuery.set(null);
    this.savedQueries = [];

    if (dsId) {
      this.fetchQueries(dsId);
    }
  }

  onQueryChange(queryId: string) {
    this.selectedQuery.set(this.savedQueries.find(q => q.id === queryId) || null);
  }

  loadData() {
    if (!this.selectedQueryId) return;

    const query = this.selectedQuery();
    if (!query) return;

    this.loadingData.set(true);

    // Execute SQL directly - same as Query Editor does
    this.api.post<QueryExecuteResponse>('/queries/direct', { sql: query.sql_text }).subscribe({
      next: (response) => {
        this.columns.set(response.columns);
        this.previewData.set(response.data);
        this.dataRowCount.set(response.total_count);

        // Build AG-Grid column definitions from response columns
        this.columnDefs = response.columns.map(col => ({
          field: col.name,
          headerName: col.name,
          cellClass: this.getCellClass(col.data_type),
          valueFormatter: this.getValueFormatter(col.data_type)
        }));

        // Mark step complete and move to next
        this.completedSteps.update(s => new Set([...s, 'data']));
        this.currentStep.set('chart');

        this.notifications.info(`Data loaded: ${response.row_count} rows in ${response.execution_time_ms}ms`);
        this.loadingData.set(false);

        // Size columns to fit after data loads
        setTimeout(() => {
          this.gridApi?.sizeColumnsToFit();
        }, 100);
      },
      error: (err) => {
        this.notifications.error('Failed to load data: ' + err.message);
        this.loadingData.set(false);
      }
    });
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

  selectChartType(chartTypeId: string) {
    this.selectedChartType.set(chartTypeId);

    // Auto-map axes based on data columns
    const cols = this.columns();
    if (cols.length >= 2) {
      // Smart mapping: look for common patterns first
      const categoryCol = cols.find(c =>
        c.name.toLowerCase().includes('category') ||
        c.name.toLowerCase().includes('name') ||
        c.name.toLowerCase().includes('label') ||
        c.name.toLowerCase().includes('reason')
      );
      const valueCol = cols.find(c =>
        c.name.toLowerCase().includes('value') ||
        c.name.toLowerCase().includes('count') ||
        c.name.toLowerCase().includes('amount') ||
        c.name.toLowerCase().includes('total')
      );

      if (categoryCol && valueCol) {
        this.chartConfig.update(c => ({ ...c, xAxis: categoryCol.name, yAxis: valueCol.name }));
      } else {
        // Fallback: first column = X, second column = Y
        this.chartConfig.update(c => ({ ...c, xAxis: cols[0].name, yAxis: cols[1].name }));
      }
    } else if (cols.length === 1) {
      this.chartConfig.update(c => ({ ...c, xAxis: cols[0].name }));
    }

    // Mark step complete and move to configure
    this.completedSteps.update(s => new Set([...s, 'chart']));
    this.currentStep.set('configure');
  }

  getChartTypeName(chartTypeId: string): string {
    return CHART_TYPES.find(ct => ct.id === chartTypeId)?.name || '';
  }

  showGroupBy(): boolean {
    return ['bar', 'column', 'line', 'area', 'treemap', 'heatmap'].includes(this.selectedChartType());
  }

  // KPI-type charts don't need X-Axis (category) field
  showXAxis(): boolean {
    return !['kpiCard', 'gauge', 'radialBar'].includes(this.selectedChartType());
  }

  // Dynamic labels based on chart type
  getXAxisLabel(): string {
    const type = this.selectedChartType();
    if (['scatter'].includes(type)) return 'X Value';
    if (['heatmap'].includes(type)) return 'X Category';
    if (['radar'].includes(type)) return 'Indicator';
    return 'X-Axis / Category';
  }

  getYAxisLabel(): string {
    const type = this.selectedChartType();
    if (['kpiCard', 'gauge', 'radialBar'].includes(type)) return 'Value Field';
    if (['scatter'].includes(type)) return 'Y Value';
    if (['heatmap'].includes(type)) return 'Heat Value';
    return 'Y-Axis / Value';
  }

  canSave(): boolean {
    const config = this.chartConfig();
    return this.isStepCompleted('chart') && !!config.xAxis && !!config.yAxis;
  }

  saveChart() {
    if (!this.canSave()) return;

    this.savingChart.set(true);
    const config = this.chartConfig();

    // Map frontend chart types to backend enum values
    const chartTypeMap: Record<string, string> = {
      'bar': 'bar',
      'column': 'bar',  // Column is vertical bar
      'line': 'line',
      'area': 'area',
      'pie': 'pie',
      'donut': 'donut',
      'scatter': 'scatter',
      'gauge': 'gauge',
      'speedometer': 'gauge',
      'radialBar': 'gauge',
      'heatmap': 'heatmap',
      'radar': 'radar',
      'funnel': 'funnel',
      'treemap': 'treemap',
      'kpiCard': 'kpi',
      'worldMap': 'map'
    };

    const chartPayload = {
      name: config.title || 'Untitled Chart',
      description: config.subtitle || '',
      query_id: this.selectedQueryId,
      chart_type: chartTypeMap[this.selectedChartType()] || this.selectedChartType(),
      config: {
        x_axis: config.xAxis ? { field: config.xAxis } : null,
        y_axis: config.yAxis ? { field: config.yAxis } : null,
        category_field: config.groupBy || null,
        color_palette: null,
        show_legend: config.showLegend,
        show_tooltip: config.enableTooltip,
        show_labels: config.showLabels,
        custom_options: {
          color_scheme: config.colorScheme,
          enable_animation: config.enableAnimation
        }
      }
    };

    // Use PUT for update, POST for create
    const apiCall = this.editMode()
      ? this.api.put<any>(`/charts/${this.chartId}`, chartPayload)
      : this.api.post<any>('/charts', chartPayload);

    apiCall.subscribe({
      next: (chart) => {
        const action = this.editMode() ? 'updated' : 'saved';
        this.notifications.success(`Chart "${chart.name}" ${action} successfully`);
        this.savingChart.set(false);
        this.router.navigate(['/charts']);  // Navigate to charts list
      },
      error: (err) => {
        const action = this.editMode() ? 'update' : 'save';
        this.notifications.error(`Failed to ${action} chart: ` + (err.error?.detail || err.message));
        this.savingChart.set(false);
      }
    });
  }

  confirmClose() {
    // Check if there are unsaved changes
    const hasChanges = this.isStepCompleted('data') || this.selectedChartType() || this.chartConfig().title;
    if (hasChanges) {
      this.showCloseConfirm.set(true);
    } else {
      this.cancel();
    }
  }

  cancel() {
    this.showCloseConfirm.set(false);
    this.router.navigate(['/charts']);  // Navigate to charts list
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  toggleFullscreen() {
    if (!this.chartContainer?.nativeElement) {
      this.notifications.info('Chart container not available');
      return;
    }

    if (!document.fullscreenElement) {
      this.chartContainer.nativeElement.requestFullscreen().catch((err: Error) => {
        this.notifications.error(`Fullscreen error: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  viewAllData() {
    this.notifications.info('Full data view coming soon');
  }
}
