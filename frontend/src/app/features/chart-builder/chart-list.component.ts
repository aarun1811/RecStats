import { Component, OnInit, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';

interface Chart {
  id: string;
  name: string;
  description: string;
  chart_type: string;
  query_id: string;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-chart-list',
  template: `
    <div class="chart-list-page">
      <div class="page-header">
        <div class="header-left">
          <h1>Charts</h1>
          <span class="chart-count">{{ charts().length }} charts</span>
        </div>
        <div class="header-right">
          <div class="view-toggle">
            <button
              class="toggle-btn"
              [class.active]="viewMode() === 'grid'"
              (click)="viewMode.set('grid')"
              title="Grid view">
              <app-icon name="grid" [size]="18"></app-icon>
            </button>
            <button
              class="toggle-btn"
              [class.active]="viewMode() === 'list'"
              (click)="viewMode.set('list')"
              title="List view">
              <app-icon name="list" [size]="18"></app-icon>
            </button>
          </div>
          <app-button variant="primary" (click)="createNew()">
            <app-icon name="plus" [size]="16"></app-icon>
            New Chart
          </app-button>
        </div>
      </div>

      <div class="loading" *ngIf="loading()">
        <app-icon name="loader" [size]="24"></app-icon>
        Loading charts...
      </div>

      <!-- Grid View -->
      <div class="charts-grid" *ngIf="!loading() && viewMode() === 'grid'">
        <div class="chart-card-grid" *ngFor="let chart of charts()" (click)="editChart(chart)">
          <div class="card-content">
            <div class="card-header">
              <span class="chart-type-badge">{{ getChartTypeLabel(chart.chart_type) }}</span>
              <div class="card-actions" (click)="$event.stopPropagation()">
                <button class="action-btn" (click)="editChart(chart)" title="Edit">
                  <app-icon name="settings" [size]="14"></app-icon>
                </button>
                <button class="action-btn danger" (click)="confirmDelete(chart)" title="Delete">
                  <app-icon name="trash" [size]="14"></app-icon>
                </button>
              </div>
            </div>
            <h3 class="chart-name">{{ chart.name }}</h3>
            <p class="chart-description" *ngIf="chart.description">{{ chart.description }}</p>
            <p class="chart-date">Created {{ formatDate(chart.created_at) }}</p>
          </div>
          <div class="card-icon">
            <app-icon [name]="getChartIcon(chart.chart_type)" [size]="40"></app-icon>
          </div>
        </div>

        <div class="empty-state" *ngIf="charts().length === 0">
          <app-icon name="bar-chart-2" [size]="48"></app-icon>
          <h3>No charts yet</h3>
          <p>Create your first chart to visualize your data</p>
          <app-button variant="primary" (click)="createNew()">
            <app-icon name="plus" [size]="16"></app-icon>
            Create Chart
          </app-button>
        </div>
      </div>

      <!-- List View -->
      <div class="charts-list" *ngIf="!loading() && viewMode() === 'list'">
        <div class="list-header">
          <span class="col-name">Name</span>
          <span class="col-type">Type</span>
          <span class="col-date">Created</span>
          <span class="col-actions">Actions</span>
        </div>
        <div class="list-row" *ngFor="let chart of charts()" (click)="editChart(chart)">
          <span class="col-name">
            <app-icon [name]="getChartIcon(chart.chart_type)" [size]="18"></app-icon>
            {{ chart.name }}
          </span>
          <span class="col-type">
            <span class="type-badge">{{ getChartTypeLabel(chart.chart_type) }}</span>
          </span>
          <span class="col-date">{{ formatDate(chart.created_at) }}</span>
          <span class="col-actions" (click)="$event.stopPropagation()">
            <button class="action-btn" (click)="editChart(chart)" title="Edit">
              <app-icon name="settings" [size]="14"></app-icon>
            </button>
            <button class="action-btn danger" (click)="confirmDelete(chart)" title="Delete">
              <app-icon name="trash" [size]="14"></app-icon>
            </button>
          </span>
        </div>

        <div class="empty-state" *ngIf="charts().length === 0">
          <app-icon name="bar-chart-2" [size]="48"></app-icon>
          <h3>No charts yet</h3>
          <p>Create your first chart to visualize your data</p>
          <app-button variant="primary" (click)="createNew()">
            <app-icon name="plus" [size]="16"></app-icon>
            Create Chart
          </app-button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <app-modal
      [isOpen]="showDeleteModal()"
      title="Delete Chart"
      size="sm"
      [hasFooter]="true"
      (closed)="cancelDelete()">
      <div class="delete-confirm-content">
        <app-icon name="alert-triangle" [size]="48" class="warning-icon"></app-icon>
        <p>Are you sure you want to delete <strong>{{ chartToDelete()?.name }}</strong>?</p>
        <p class="warning-text">This action cannot be undone.</p>
      </div>
      <div modal-footer>
        <app-button variant="ghost" (click)="cancelDelete()">Cancel</app-button>
        <app-button variant="danger" (click)="deleteChart()" [disabled]="deleting()">
          <app-icon name="trash" [size]="16" *ngIf="!deleting()"></app-icon>
          <app-icon name="loader" [size]="16" *ngIf="deleting()"></app-icon>
          {{ deleting() ? 'Deleting...' : 'Delete' }}
        </app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    .chart-list-page {
      padding: var(--spacing-6);
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-6);
    }

    .header-left {
      display: flex;
      align-items: baseline;
      gap: var(--spacing-3);

      h1 {
        margin: 0;
        font-size: var(--font-size-2xl);
        font-weight: 600;
        color: var(--text-primary);
      }

      .chart-count {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
    }

    .view-toggle {
      display: flex;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 2px;
    }

    .toggle-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
        box-shadow: 0 0 8px rgba(var(--color-primary-rgb), 0.25);
      }

      &.active {
        background: var(--color-primary);
        color: white;
        box-shadow: 0 0 12px rgba(var(--color-primary-rgb), 0.4);
      }
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
      padding: var(--spacing-12);
      color: var(--text-muted);

      app-icon { animation: spin 1s linear infinite; }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Grid View */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--spacing-4);
    }

    .chart-card-grid {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 160px;
      padding: var(--spacing-4);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--transition-normal);

      &:hover {
        border-color: rgba(var(--color-primary-rgb), 0.5);
        box-shadow: var(--glow-primary), var(--shadow-lg);
        transform: translateY(-2px);

        .card-actions { opacity: 1; }
        .card-icon {
          opacity: 1;
          box-shadow: var(--glow-primary);
        }
      }
    }

    .card-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-3);
    }

    .chart-type-badge {
      display: inline-block;
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: all 0.2s ease;
    }

    .chart-card-grid:hover .chart-type-badge {
      background: rgba(var(--color-primary-rgb), 0.15);
      color: var(--color-primary);
      box-shadow: 0 0 6px rgba(var(--color-primary-rgb), 0.2);
    }

    .card-actions {
      display: flex;
      gap: var(--spacing-1);
      opacity: 0;
      transition: all 0.2s ease;
      transform: translateY(-4px);
    }

    .chart-card-grid:hover .card-actions {
      transform: translateY(0);
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--color-primary);
        color: white;
        box-shadow: 0 0 10px rgba(var(--color-primary-rgb), 0.4);
      }

      &.danger:hover {
        background: var(--color-danger);
        box-shadow: 0 0 10px rgba(var(--color-danger-rgb), 0.4);
      }
    }

    .chart-name {
      margin: 0 0 var(--spacing-2) 0;
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.3;
    }

    .chart-description {
      margin: 0 0 var(--spacing-2) 0;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.4;
    }

    .chart-date {
      margin: auto 0 0 0;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .card-icon {
      position: absolute;
      bottom: var(--spacing-4);
      right: var(--spacing-4);
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      color: var(--color-primary);
      opacity: 0.6;
      transition: all 0.2s ease;
    }

    /* List View */
    .charts-list {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .list-header {
      display: grid;
      grid-template-columns: 1fr 120px 120px 100px;
      gap: var(--spacing-4);
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .list-row {
      display: grid;
      grid-template-columns: 1fr 120px 120px 100px;
      gap: var(--spacing-4);
      padding: var(--spacing-3) var(--spacing-4);
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: all 0.2s ease;

      &:last-child { border-bottom: none; }

      &:hover {
        background: var(--bg-tertiary);
        box-shadow: inset 0 0 0 1px rgba(var(--color-primary-rgb), 0.2),
                    0 0 8px rgba(var(--color-primary-rgb), 0.15);
        .action-btn { opacity: 1; }
      }
    }

    .col-name {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      font-weight: 500;
      color: var(--text-primary);

      app-icon {
        color: var(--color-primary);
        transition: all 0.2s ease;
      }
    }

    .list-row:hover .col-name app-icon {
      filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.5));
    }

    .col-type { display: flex; align-items: center; }

    .type-badge {
      display: inline-block;
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
      transition: all 0.2s ease;
    }

    .list-row:hover .type-badge {
      background: rgba(var(--color-primary-rgb), 0.15);
      color: var(--color-primary);
    }

    .col-date {
      display: flex;
      align-items: center;
      font-size: var(--font-size-sm);
      color: var(--text-muted);
    }

    .col-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);

      .action-btn { opacity: 0; transition: opacity 0.2s ease; }
    }

    .empty-state {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-12);
      text-align: center;
      color: var(--text-muted);

      h3 {
        margin: var(--spacing-4) 0 var(--spacing-2) 0;
        color: var(--text-primary);
      }

      p { margin: 0 0 var(--spacing-4) 0; }
    }

    /* Delete Confirmation Modal */
    .delete-confirm-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--spacing-4) 0;

      .warning-icon {
        color: var(--warning);
        margin-bottom: var(--spacing-4);
      }

      p {
        margin: 0 0 var(--spacing-2) 0;
        color: var(--text-primary);
      }

      .warning-text {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
      }
    }
  `]
})
export class ChartListComponent implements OnInit {
  charts = signal<Chart[]>([]);
  loading = signal(true);
  viewMode = signal<'grid' | 'list'>('grid');

  // Delete confirmation state
  showDeleteModal = signal(false);
  chartToDelete = signal<Chart | null>(null);
  deleting = signal(false);

  private router = inject(Router);
  private api = inject(ApiService);
  private notifications = inject(NotificationService);

  ngOnInit() {
    this.loadCharts();
  }

  loadCharts() {
    this.loading.set(true);
    this.api.get<Chart[]>('/charts').subscribe({
      next: (charts) => {
        // Sort by created_at descending (newest first)
        charts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        this.charts.set(charts);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  createNew() {
    this.router.navigate(['/charts/new']);
  }

  editChart(chart: Chart) {
    this.router.navigate(['/charts', chart.id, 'edit']);
  }

  confirmDelete(chart: Chart) {
    this.chartToDelete.set(chart);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.chartToDelete.set(null);
  }

  deleteChart() {
    const chart = this.chartToDelete();
    if (!chart) return;

    this.deleting.set(true);
    this.api.delete(`/charts/${chart.id}`).subscribe({
      next: () => {
        this.charts.update(charts => charts.filter(c => c.id !== chart.id));
        this.notifications.success(`Chart "${chart.name}" deleted`);
        this.deleting.set(false);
        this.cancelDelete();
      },
      error: () => {
        this.notifications.error('Failed to delete chart');
        this.deleting.set(false);
      }
    });
  }

  getChartIcon(type: string): string {
    const icons: Record<string, string> = {
      'bar': 'bar-chart-2',
      'line': 'trending-up',
      'area': 'activity',
      'pie': 'pie-chart',
      'donut': 'pie-chart',
      'scatter': 'crosshair',
      'gauge': 'target',
      'radar': 'hexagon',
      'heatmap': 'grid',
      'funnel': 'triangle',
      'treemap': 'square',
      'kpi': 'hash',
      'map': 'globe'
    };
    return icons[type] || 'bar-chart-2';
  }

  getChartTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'bar': 'Bar',
      'line': 'Line',
      'area': 'Area',
      'pie': 'Pie',
      'donut': 'Donut',
      'scatter': 'Scatter',
      'gauge': 'Gauge',
      'radar': 'Radar',
      'heatmap': 'Heatmap',
      'funnel': 'Funnel',
      'treemap': 'Treemap',
      'kpi': 'KPI',
      'map': 'Map'
    };
    return labels[type] || type;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}
