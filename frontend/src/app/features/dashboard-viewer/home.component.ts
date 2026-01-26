import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DataCacheService } from '../../core/services/data-cache.service';

@Component({
  selector: 'app-home',
  template: `
    <div class="home-page">
      <header class="page-header">
        <div class="header-content">
          <h1>Welcome to ResStats</h1>
          <p>Your internal BI platform for reconciliation analytics</p>
        </div>
        <div class="header-actions">
          <app-button variant="primary" (click)="createDashboard()">
            <app-icon name="plus" [size]="18"></app-icon>
            New Dashboard
          </app-button>
        </div>
      </header>

      <!-- Loading State -->
      <div class="loading-banner" *ngIf="loading">
        <div class="spinner"></div>
        <span>Loading data from DuckDB-WASM...</span>
      </div>

      <!-- KPI Cards -->
      <section class="kpi-section">
        <app-kpi-card
          label="Total Transactions"
          [value]="kpis.totalTransactions"
          format="number"
          [showTrend]="true"
          trend="up"
          trendValue="+12.5%"
          trendLabel="vs last month"
        ></app-kpi-card>
        <app-kpi-card
          label="Match Rate"
          [value]="kpis.matchRate"
          suffix="%"
          format="none"
          variant="success"
          [showTrend]="true"
          trend="up"
          trendValue="+2.1%"
        ></app-kpi-card>
        <app-kpi-card
          label="Open Breaks"
          [value]="kpis.openBreaks"
          format="number"
          variant="warning"
          [showTrend]="true"
          trend="down"
          trendValue="-8.3%"
          trendLabel="improving"
        ></app-kpi-card>
        <app-kpi-card
          label="Avg Break Age"
          [value]="kpis.avgBreakAge"
          suffix=" days"
          format="none"
          [showTrend]="true"
          trend="down"
          trendValue="-1.5 days"
        ></app-kpi-card>
      </section>

      <!-- Quick Actions -->
      <section class="section">
        <h2 class="section-title">Quick Actions</h2>
        <div class="action-cards">
          <app-card [hoverable]="true" [glow]="true" class="action-card" (click)="navigateTo('/datasources')">
            <div class="action-icon primary">
              <app-icon name="database" [size]="24"></app-icon>
            </div>
            <h3>Connect Data Source</h3>
            <p>Add Oracle, Hive, or upload CSV/Excel files</p>
          </app-card>
          <app-card [hoverable]="true" [glow]="true" class="action-card" (click)="navigateTo('/queries')">
            <div class="action-icon success">
              <app-icon name="code" [size]="24"></app-icon>
            </div>
            <h3>Write Query</h3>
            <p>Create SQL queries with our powerful editor</p>
          </app-card>
          <app-card [hoverable]="true" [glow]="true" class="action-card" (click)="navigateTo('/charts')">
            <div class="action-icon warning">
              <app-icon name="bar-chart-2" [size]="24"></app-icon>
            </div>
            <h3>Build Chart</h3>
            <p>Visualize your data with beautiful charts</p>
          </app-card>
          <app-card [hoverable]="true" [glow]="true" class="action-card" (click)="navigateTo('/dashboards')">
            <div class="action-icon info">
              <app-icon name="layout-dashboard" [size]="24"></app-icon>
            </div>
            <h3>Create Dashboard</h3>
            <p>Combine charts into interactive dashboards</p>
          </app-card>
        </div>
      </section>

      <!-- Recent Dashboards -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Sample Dashboards</h2>
          <app-button variant="ghost" size="sm" (click)="navigateTo('/dashboards')">View All</app-button>
        </div>
        <div class="dashboard-grid">
          <app-card
            *ngFor="let dashboard of recentDashboards"
            [hoverable]="true"
            [glow]="true"
            (click)="openDashboard(dashboard.id)">
            <div class="dashboard-preview">
              <div class="preview-placeholder">
                <app-icon [name]="dashboard.icon" [size]="32"></app-icon>
              </div>
            </div>
            <div class="dashboard-info">
              <h4>{{ dashboard.name }}</h4>
              <p>{{ dashboard.chartCount }} charts · Updated {{ dashboard.lastUpdated }}</p>
            </div>
          </app-card>
        </div>
      </section>

      <!-- Data Status -->
      <section class="section data-status" *ngIf="!loading">
        <app-card [glow]="true">
          <div class="status-content">
            <div class="status-icon">
              <app-icon name="database" [size]="24"></app-icon>
            </div>
            <div class="status-text">
              <h4>DuckDB-WASM Active</h4>
              <p>10K+ transactions and 1.5K breaks loaded in-browser for ultra-fast filtering</p>
            </div>
            <div class="status-badge">
              <span class="badge success">Ready</span>
            </div>
          </div>
        </app-card>
      </section>
    </div>
  `,
  styles: [`
    .home-page {
      max-width: var(--content-max-width);
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--spacing-8);
    }

    .header-content {
      h1 {
        font-size: var(--font-size-3xl);
        font-weight: var(--font-weight-bold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-2) 0;
      }

      p {
        font-size: var(--font-size-base);
        color: var(--text-secondary);
        margin: 0;
      }
    }

    .kpi-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--spacing-4);
      margin-bottom: var(--spacing-8);
    }

    .section {
      margin-bottom: var(--spacing-8);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-4);
    }

    .section-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-4) 0;
    }

    .section-header .section-title {
      margin: 0;
    }

    .action-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--spacing-4);
    }

    .action-card {
      text-align: center;
      cursor: pointer;

      .action-icon {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto var(--spacing-4);

        &.primary {
          background: rgba(var(--color-primary-rgb), 0.15);
          color: var(--color-primary-light);
        }

        &.success {
          background: rgba(var(--color-success-rgb), 0.15);
          color: var(--color-success);
        }

        &.warning {
          background: rgba(var(--color-warning-rgb), 0.15);
          color: var(--color-warning);
        }

        &.info {
          background: rgba(var(--color-info-rgb), 0.15);
          color: var(--color-info);
        }
      }

      h3 {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-2) 0;
      }

      p {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        margin: 0;
      }
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--spacing-4);
    }

    .dashboard-preview {
      aspect-ratio: 16/10;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-4);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-placeholder {
      color: var(--text-muted);
    }

    .dashboard-info {
      h4 {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-1) 0;
      }

      p {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        margin: 0;
      }
    }

    .loading-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3) var(--spacing-4);
      background: linear-gradient(90deg, rgba(var(--color-primary-rgb), 0.1), rgba(var(--color-primary-rgb), 0.2));
      border: 1px solid rgba(var(--color-primary-rgb), 0.3);
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-6);
      color: var(--color-primary-light);
      font-size: var(--font-size-sm);
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(var(--color-primary-rgb), 0.3);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .data-status {
      .status-content {
        display: flex;
        align-items: center;
        gap: var(--spacing-4);
      }

      .status-icon {
        width: 48px;
        height: 48px;
        border-radius: var(--radius-lg);
        background: rgba(var(--color-success-rgb), 0.15);
        color: var(--color-success);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .status-text {
        flex: 1;

        h4 {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: var(--text-primary);
          margin: 0 0 var(--spacing-1) 0;
        }

        p {
          font-size: var(--font-size-sm);
          color: var(--text-muted);
          margin: 0;
        }
      }

      .badge {
        padding: var(--spacing-1) var(--spacing-3);
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;

        &.success {
          background: rgba(var(--color-success-rgb), 0.15);
          color: var(--color-success);
        }
      }
    }

    @media (max-width: 640px) {
      .page-header {
        flex-direction: column;
        gap: var(--spacing-4);
      }

      .data-status .status-content {
        flex-direction: column;
        text-align: center;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  private dataCache = inject(DataCacheService);

  loading = true;
  kpis = {
    totalTransactions: 0,
    matchRate: 0,
    openBreaks: 0,
    avgBreakAge: 0
  };

  recentDashboards = [
    { id: 'executive', name: 'Executive Overview', chartCount: 6, lastUpdated: '2 hours ago', icon: 'bar-chart-2' },
    { id: 'breaks', name: 'Break Analysis', chartCount: 8, lastUpdated: '1 day ago', icon: 'alert-triangle' },
    { id: 'geo', name: 'Geographic View', chartCount: 4, lastUpdated: '3 days ago', icon: 'globe' },
    { id: 'recon', name: 'Reconciliation Status', chartCount: 5, lastUpdated: '1 week ago', icon: 'check-circle' },
    { id: 'trends', name: 'Trend Analytics', chartCount: 7, lastUpdated: '1 week ago', icon: 'trending-up' },
  ];

  ngOnInit() {
    this.loadKPIs();
  }

  async loadKPIs() {
    this.dataCache.isReady$.subscribe(async (ready) => {
      if (ready) {
        try {
          this.kpis = await this.dataCache.getKPIs();
        } catch (error) {
          console.error('Failed to load KPIs:', error);
        } finally {
          this.loading = false;
        }
      }
    });
  }

  createDashboard() {
    this.router.navigate(['/dashboards']);
  }

  openDashboard(id: string) {
    this.router.navigate(['/dashboards', id]);
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }
}
