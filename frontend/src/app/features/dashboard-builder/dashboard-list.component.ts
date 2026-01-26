import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { firstValueFrom } from 'rxjs';

interface DashboardSummary {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-dashboard-list',
  template: `
    <div class="dashboard-list-page">
      <div class="page-header">
        <div class="header-content">
          <h1>Dashboards</h1>
          <p class="subtitle">View and manage your dashboards</p>
        </div>
        <app-button variant="primary" (click)="createNew()">
          <app-icon name="plus" [size]="16"></app-icon>
          New Dashboard
        </app-button>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="loading()">
        <div class="spinner"></div>
        <p>Loading dashboards...</p>
      </div>

      <!-- Dashboard Grid -->
      <div class="dashboard-grid" *ngIf="!loading()">
        <!-- Sample Dashboards Section -->
        <div class="section">
          <h2 class="section-title">Sample Dashboards</h2>
          <div class="cards-grid">
            <div
              class="dashboard-card sample"
              *ngFor="let dashboard of sampleDashboards"
              (click)="openDashboard(dashboard.id)">
              <div class="card-icon">
                <app-icon [name]="dashboard.icon" [size]="24"></app-icon>
              </div>
              <div class="card-content">
                <h3>{{ dashboard.name }}</h3>
                <p>{{ dashboard.description }}</p>
              </div>
              <div class="card-arrow">
                <app-icon name="chevron-right" [size]="20"></app-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- Saved Dashboards Section -->
        <div class="section" *ngIf="savedDashboards().length > 0">
          <h2 class="section-title">Saved Dashboards</h2>
          <div class="cards-grid">
            <div
              class="dashboard-card"
              *ngFor="let dashboard of savedDashboards()"
              (click)="openDashboard(dashboard.id)">
              <div class="card-icon">
                <app-icon name="layout" [size]="24"></app-icon>
              </div>
              <div class="card-content">
                <h3>{{ dashboard.name }}</h3>
                <p class="card-meta">
                  Updated {{ formatDate(dashboard.updated_at) }}
                </p>
              </div>
              <div class="card-actions">
                <button class="action-btn" (click)="deleteDashboard(dashboard.id, $event)" title="Delete">
                  <app-icon name="trash" [size]="16"></app-icon>
                </button>
                <app-icon name="chevron-right" [size]="20"></app-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="savedDashboards().length === 0">
          <app-icon name="layout" [size]="48"></app-icon>
          <h3>No saved dashboards yet</h3>
          <p>Create a new dashboard or explore the sample dashboards above.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-list-page {
      padding: var(--spacing-6);
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--spacing-8);
    }

    .header-content h1 {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-1) 0;
    }

    .subtitle {
      font-size: var(--font-size-md);
      color: var(--text-muted);
      margin: 0;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-12);
      color: var(--text-muted);
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: var(--spacing-4);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .section {
      margin-bottom: var(--spacing-8);
    }

    .section-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-4) 0;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--spacing-4);
    }

    .dashboard-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
      padding: var(--spacing-4);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .dashboard-card:hover {
      border-color: var(--color-primary);
      background: var(--bg-tertiary);
    }

    .dashboard-card.sample {
      border-left: 3px solid var(--color-primary);
    }

    .card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      color: var(--color-primary);
      flex-shrink: 0;
    }

    .card-content {
      flex: 1;
      min-width: 0;
    }

    .card-content h3 {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-1) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-content p {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-meta {
      font-size: var(--font-size-xs) !important;
    }

    .card-arrow, .card-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;
      opacity: 0;
    }

    .dashboard-card:hover .action-btn {
      opacity: 1;
    }

    .action-btn:hover {
      background: rgba(231, 76, 60, 0.2);
      color: var(--color-danger);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-12);
      background: var(--bg-secondary);
      border: 1px dashed var(--border-color);
      border-radius: var(--radius-lg);
      text-align: center;
      color: var(--text-muted);
    }

    .empty-state h3 {
      font-size: var(--font-size-lg);
      color: var(--text-secondary);
      margin: var(--spacing-4) 0 var(--spacing-2) 0;
    }

    .empty-state p {
      margin: 0;
      max-width: 300px;
    }
  `]
})
export class DashboardListComponent implements OnInit {
  private router = inject(Router);
  private api = inject(ApiService);
  private notifications = inject(NotificationService);

  loading = signal(false);
  savedDashboards = signal<DashboardSummary[]>([]);

  sampleDashboards = [
    { id: 'executive', name: 'Executive Overview', description: 'High-level KPIs and trends for executive stakeholders', icon: 'bar-chart-2' },
    { id: 'breaks', name: 'Break Analysis', description: 'Detailed analysis of reconciliation breaks and exceptions', icon: 'alert-triangle' },
    { id: 'geo', name: 'Geographic View', description: 'Regional distribution of transactions and breaks', icon: 'globe' },
    { id: 'recon', name: 'Reconciliation Status', description: 'Source system reconciliation overview', icon: 'check-circle' },
    { id: 'trends', name: 'Trend Analytics', description: 'Historical trends and time-series analysis', icon: 'trending-up' },
  ];

  ngOnInit() {
    this.loadDashboards();
  }

  async loadDashboards() {
    this.loading.set(true);
    try {
      const dashboards = await firstValueFrom(
        this.api.get<DashboardSummary[]>('/dashboards')
      );
      // Filter out sample dashboards (they're shown separately)
      const userDashboards = dashboards.filter(d => !d.id.startsWith('dashboard-'));
      this.savedDashboards.set(userDashboards);
    } catch (error) {
      console.error('Failed to load dashboards:', error);
    } finally {
      this.loading.set(false);
    }
  }

  openDashboard(id: string) {
    this.router.navigate(['/dashboards', id]);
  }

  createNew() {
    this.router.navigate(['/dashboards', 'new']);
  }

  async deleteDashboard(id: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this dashboard?')) return;

    try {
      await firstValueFrom(this.api.delete(`/dashboards/${id}`));
      this.savedDashboards.update(dashboards => dashboards.filter(d => d.id !== id));
      this.notifications.success('Dashboard deleted');
    } catch (error) {
      this.notifications.error('Failed to delete dashboard');
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  }
}
