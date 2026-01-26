import { Component, OnInit, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

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
        <app-button variant="primary" (click)="createNew()">
          <app-icon name="plus" [size]="16"></app-icon>
          New Chart
        </app-button>
      </div>

      <div class="loading" *ngIf="loading()">
        <app-icon name="loader" [size]="24"></app-icon>
        Loading charts...
      </div>

      <div class="charts-grid" *ngIf="!loading()">
        <div class="chart-card" *ngFor="let chart of charts()">
          <div class="chart-icon">
            <app-icon [name]="getChartIcon(chart.chart_type)" [size]="32"></app-icon>
          </div>
          <div class="chart-info">
            <h3>{{ chart.name }}</h3>
            <p class="chart-type">{{ chart.chart_type | titlecase }}</p>
            <p class="chart-date">Created {{ formatDate(chart.created_at) }}</p>
          </div>
          <div class="chart-actions">
            <app-button variant="ghost" size="sm" (click)="editChart(chart)">
              <app-icon name="edit-2" [size]="14"></app-icon>
            </app-button>
            <app-button variant="ghost" size="sm" (click)="deleteChart(chart)">
              <app-icon name="trash-2" [size]="14"></app-icon>
            </app-button>
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
    </div>
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

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
      padding: var(--spacing-12);
      color: var(--text-muted);

      app-icon {
        animation: spin 1s linear infinite;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--spacing-4);
    }

    .chart-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
      padding: var(--spacing-4);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--border-hover);
        background: var(--bg-tertiary);
      }
    }

    .chart-icon {
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-primary);
      border-radius: var(--radius-md);
      color: var(--accent-primary);
      flex-shrink: 0;
    }

    .chart-info {
      flex: 1;
      min-width: 0;

      h3 {
        margin: 0 0 var(--spacing-1) 0;
        font-size: var(--font-size-base);
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .chart-type {
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
      }

      .chart-date {
        margin: var(--spacing-1) 0 0 0;
        font-size: var(--font-size-xs);
        color: var(--text-muted);
      }
    }

    .chart-actions {
      display: flex;
      gap: var(--spacing-1);
      opacity: 0;
      transition: opacity 0.2s ease;

      .chart-card:hover & {
        opacity: 1;
      }
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

      p {
        margin: 0 0 var(--spacing-4) 0;
      }
    }
  `]
})
export class ChartListComponent implements OnInit {
  charts = signal<Chart[]>([]);
  loading = signal(true);

  private router = inject(Router);
  private api = inject(ApiService);

  ngOnInit() {
    this.loadCharts();
  }

  loadCharts() {
    this.loading.set(true);
    this.api.get<Chart[]>('/charts').subscribe({
      next: (charts) => {
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
    // TODO: Implement edit - for now just go to new
    this.router.navigate(['/charts/new']);
  }

  deleteChart(chart: Chart) {
    if (confirm(`Delete chart "${chart.name}"?`)) {
      this.api.delete(`/charts/${chart.id}`).subscribe({
        next: () => {
          this.charts.update(charts => charts.filter(c => c.id !== chart.id));
        }
      });
    }
  }

  getChartIcon(type: string): string {
    const icons: Record<string, string> = {
      'bar': 'bar-chart-2',
      'line': 'trending-up',
      'area': 'activity',
      'pie': 'pie-chart',
      'donut': 'disc',
      'scatter': 'git-commit',
      'gauge': 'activity',
      'radar': 'octagon',
      'heatmap': 'grid',
      'funnel': 'filter',
      'treemap': 'layout',
      'kpi': 'hash',
      'map': 'globe'
    };
    return icons[type] || 'bar-chart-2';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  }
}
