import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { InfoSidebarItem } from '../../shared/components/info-sidebar/info-sidebar.component';
import { firstValueFrom } from 'rxjs';

interface RecentItem {
  id: string;
  name: string;
  description?: string;
  type: 'query' | 'chart' | 'dashboard';
  updated_at: string;
  route: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  item_count: number;
}

@Component({
  selector: 'app-home',
  template: `
    <div class="home-page" [class.sidebar-open]="selectedItem()">
      <main class="home-content">
        <!-- Header with Search -->
        <header class="page-header">
          <div class="header-content">
            <h1>Welcome back</h1>
            <p>Your analytics workspace</p>
          </div>
          <div class="header-actions">
            <app-search-bar></app-search-bar>
          </div>
        </header>

        <!-- Getting Started Section -->
        <app-collapsible-section
          title="Getting Started"
          icon="rocket"
          [defaultCollapsed]="true"
          storageKey="home-getting-started"
        >
          <div class="getting-started-content">
            <div class="guide-steps">
              <div class="step" *ngFor="let step of gettingStartedSteps; let i = index">
                <div class="step-number">{{ i + 1 }}</div>
                <div class="step-content">
                  <h4>{{ step.title }}</h4>
                  <p>{{ step.description }}</p>
                </div>
                <app-button variant="ghost" size="sm" (click)="navigateTo(step.route)">
                  {{ step.action }}
                  <app-icon name="arrow-right" [size]="14"></app-icon>
                </app-button>
              </div>
            </div>
          </div>
        </app-collapsible-section>

        <!-- Favorites Section -->
        <section class="section" *ngIf="favorites().length > 0">
          <div class="section-header">
            <h2 class="section-title">
              <app-icon name="star" [size]="20"></app-icon>
              Favorites
            </h2>
          </div>
          <div class="items-grid">
            <app-item-card
              *ngFor="let item of favorites()"
              [id]="item.id"
              [name]="item.name"
              [type]="item.type"
              [description]="item.description"
              [updatedAt]="item.updated_at"
              [isSelected]="selectedItem()?.id === item.id"
              (selected)="selectItem(item)"
              (opened)="openItem(item)"
            ></app-item-card>
          </div>
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
              <p>Connect your databases or upload files</p>
            </app-card>
            <app-card [hoverable]="true" [glow]="true" class="action-card" (click)="navigateTo('/queries')">
              <div class="action-icon success">
                <app-icon name="code" [size]="24"></app-icon>
              </div>
              <h3>Write Query</h3>
              <p>Write SQL queries with the editor</p>
            </app-card>
            <app-card [hoverable]="true" [glow]="true" class="action-card" (click)="navigateTo('/charts')">
              <div class="action-icon warning">
                <app-icon name="bar-chart-2" [size]="24"></app-icon>
              </div>
              <h3>Build Chart</h3>
              <p>Create visualizations from your data</p>
            </app-card>
            <app-card [hoverable]="true" [glow]="true" class="action-card" (click)="navigateTo('/dashboards')">
              <div class="action-icon info">
                <app-icon name="layout-dashboard" [size]="24"></app-icon>
              </div>
              <h3>Create Dashboard</h3>
              <p>Build interactive dashboards</p>
            </app-card>
          </div>
        </section>

        <!-- Recent Activity -->
        <section class="section" *ngIf="recentItems().length > 0">
          <div class="section-header">
            <h2 class="section-title">
              <app-icon name="clock" [size]="20"></app-icon>
              Recent Activity
            </h2>
          </div>
          <div class="items-grid">
            <app-item-card
              *ngFor="let item of recentItems()"
              [id]="item.id"
              [name]="item.name"
              [type]="item.type"
              [description]="item.description"
              [updatedAt]="item.updated_at"
              [isSelected]="selectedItem()?.id === item.id"
              (selected)="selectItem(item)"
              (opened)="openItem(item)"
            ></app-item-card>
          </div>
        </section>

        <!-- Collections -->
        <section class="section collections-section" *ngIf="collections().length > 0">
          <div class="section-header">
            <h2 class="section-title">
              <app-icon name="folder" [size]="20"></app-icon>
              Collections
            </h2>
            <app-button variant="ghost" size="sm" (click)="navigateTo('/collections')">
              View All
              <app-icon name="arrow-right" [size]="14"></app-icon>
            </app-button>
          </div>
          <div class="collections-grid">
            <div
              *ngFor="let collection of collections()"
              class="collection-card"
              (click)="openCollection(collection)"
            >
              <div class="collection-card-inner">
                <div class="collection-icon" [style.background]="getCollectionBg(collection.color)">
                  <app-icon name="folder" [size]="24" [style.color]="collection.color"></app-icon>
                </div>
                <div class="collection-info">
                  <h4>{{ collection.name }}</h4>
                  <p class="collection-desc" *ngIf="collection.description">{{ collection.description }}</p>
                  <p class="collection-meta">{{ collection.item_count }} {{ collection.item_count === 1 ? 'item' : 'items' }}</p>
                </div>
              </div>
              <div class="collection-accent" [style.background]="collection.color"></div>
            </div>
          </div>
        </section>

        <!-- Loading State -->
        <div class="loading-state" *ngIf="loading()">
          <app-loading-spinner variant="glow" text="Loading your workspace..."></app-loading-spinner>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="!loading() && recentItems().length === 0 && favorites().length === 0">
          <div class="empty-icon">
            <app-icon name="layout-dashboard" [size]="48"></app-icon>
          </div>
          <h3>Welcome to your analytics workspace</h3>
          <p>Get started by connecting a data source or creating your first dashboard</p>
        </div>
      </main>

      <!-- Info Sidebar -->
      <app-info-sidebar
        [isOpen]="!!selectedItem()"
        [item]="selectedItem()"
        (close)="selectedItem.set(null)"
        (openRequested)="openItem($event)"
        (editRequested)="editItem($event)"
        (deleteRequested)="deleteItem($event)"
      ></app-info-sidebar>

      <!-- Interaction Hint -->
      <app-interaction-hint></app-interaction-hint>
    </div>
  `,
  styles: [`
    .home-page {
      max-width: var(--content-max-width);
      margin: 0 auto;
      transition: padding-right 0.3s ease;
    }

    .home-page.sidebar-open {
      padding-right: 400px;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--spacing-6);
      gap: var(--spacing-4);
    }

    .header-content {
      h1 {
        font-size: var(--font-size-3xl);
        font-weight: var(--font-weight-bold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-1) 0;
      }

      p {
        font-size: var(--font-size-base);
        color: var(--text-secondary);
        margin: 0;
      }
    }

    .header-actions {
      flex-shrink: 0;
    }

    // Getting Started Section
    .getting-started-content {
      padding: var(--spacing-2) 0;
    }

    .guide-steps {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .step {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-tertiary);
      border-radius: var(--radius-lg);
      transition: all var(--transition-normal);
    }

    .step:hover {
      background: var(--bg-hover);
    }

    .step-number {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      color: white;
      flex-shrink: 0;
    }

    .step-content {
      flex: 1;

      h4 {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-1) 0;
      }

      p {
        font-size: var(--font-size-xs);
        color: var(--text-muted);
        margin: 0;
      }
    }

    // Add spacing after collapsible section
    :host ::ng-deep app-collapsible-section {
      display: block;
      margin-bottom: var(--spacing-8);
    }

    // Section styling
    .section {
      margin-bottom: var(--spacing-10);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-5);
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0;
    }

    .section-title app-icon {
      color: var(--color-primary);
      opacity: 0.8;
    }

    // Items grid (for favorites and recent)
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--spacing-4);
    }

    // Quick Actions
    .action-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
        transition: transform var(--transition-normal);

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

      &:hover .action-icon {
        transform: scale(1.1);
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

    // Collections section
    .collections-section {
      margin-bottom: var(--spacing-4);
    }

    .collections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--spacing-5);
    }

    .collection-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
      cursor: pointer;
      transition: all var(--transition-normal);
      position: relative;
      overflow: hidden;
    }

    .collection-card:hover {
      border-color: rgba(var(--color-primary-rgb), 0.3);
      box-shadow: var(--glow-primary);
      transform: translateY(-2px);
    }

    .collection-card-inner {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
      padding: var(--spacing-5);
    }

    .collection-icon {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform var(--transition-normal);
    }

    .collection-card:hover .collection-icon {
      transform: scale(1.08);
    }

    .collection-info {
      flex: 1;
      min-width: 0;

      h4 {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-1) 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .collection-desc {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
        margin: 0 0 var(--spacing-1) 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .collection-meta {
        font-size: var(--font-size-xs);
        color: var(--text-muted);
        margin: 0;
      }
    }

    .collection-accent {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      opacity: 0;
      transition: opacity var(--transition-normal);
    }

    .collection-card:hover .collection-accent {
      opacity: 1;
    }

    // Loading state
    .loading-state {
      display: flex;
      justify-content: center;
      padding: var(--spacing-12) 0;
    }

    // Empty state
    .empty-state {
      text-align: center;
      padding: var(--spacing-12) var(--spacing-6);

      .empty-icon {
        width: 80px;
        height: 80px;
        background: var(--bg-secondary);
        border-radius: var(--radius-xl);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto var(--spacing-6);
        color: var(--text-muted);
      }

      h3 {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-2) 0;
      }

      p {
        font-size: var(--font-size-base);
        color: var(--text-secondary);
        margin: 0;
        max-width: 400px;
        margin: 0 auto;
      }
    }

    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
      }

      .header-actions {
        width: 100%;
      }

      .home-page.sidebar-open {
        padding-right: 0;
      }
    }

    @media (max-width: 640px) {
      .step {
        flex-direction: column;
        text-align: center;
        gap: var(--spacing-3);
      }

      .step-content {
        text-align: center;
      }
    }
  `],
  standalone: false
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  private api = inject(ApiService);

  loading = signal(true);
  favorites = signal<RecentItem[]>([]);
  recentItems = signal<RecentItem[]>([]);
  collections = signal<Collection[]>([]);
  selectedItem = signal<InfoSidebarItem | null>(null);

  gettingStartedSteps = [
    {
      title: 'Connect a data source',
      description: 'Link your databases or upload CSV/Excel files',
      route: '/datasources',
      action: 'Connect'
    },
    {
      title: 'Write your first query',
      description: 'Use the SQL editor to explore your data',
      route: '/queries',
      action: 'Write Query'
    },
    {
      title: 'Build a visualization',
      description: 'Create charts and dashboards from your queries',
      route: '/charts',
      action: 'Build Chart'
    }
  ];

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);

    try {
      // Load all data in parallel
      const [favoritesRes, recentRes, collectionsRes] = await Promise.all([
        firstValueFrom(this.api.get<RecentItem[]>('/favorites', { limit: 5 })).catch(() => []),
        firstValueFrom(this.api.get<RecentItem[]>('/recent', { limit: 5 })).catch(() => []),
        firstValueFrom(this.api.get<Collection[]>('/collections')).catch(() => []),
      ]);

      this.favorites.set(favoritesRes || []);
      this.recentItems.set(recentRes || []);
      this.collections.set(collectionsRes || []);
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  getCollectionBg(color: string): string {
    return `${color}20`; // Add 20% opacity
  }

  selectItem(item: RecentItem) {
    this.selectedItem.set({
      id: item.id,
      name: item.name,
      type: item.type,
      description: item.description,
      updated_at: item.updated_at,
      route: item.route,
    });
  }

  openItem(item: InfoSidebarItem | RecentItem) {
    const route = 'route' in item && item.route ? item.route : this.getRouteForItem(item);
    this.router.navigateByUrl(route);
  }

  editItem(item: InfoSidebarItem) {
    const route = this.getRouteForItem(item);
    this.router.navigateByUrl(route);
  }

  deleteItem(item: InfoSidebarItem) {
    // TODO: Implement delete with confirmation modal
    console.log('Delete item:', item);
  }

  getRouteForItem(item: InfoSidebarItem): string {
    switch (item.type) {
      case 'dashboard':
        return `/dashboards/${item.id}`;
      case 'chart':
        return `/charts/${item.id}/edit`;
      case 'query':
        return '/queries';
      default:
        return '/';
    }
  }

  openCollection(collection: Collection) {
    this.router.navigate(['/collections', collection.id]);
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }
}
