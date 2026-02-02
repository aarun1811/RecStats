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
          <div class="section-header">
            <h2 class="section-title">
              <app-icon name="zap" [size]="20"></app-icon>
              Quick Actions
            </h2>
          </div>
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
    /* ═══════════════════════════════════════════════════════════
       ANIMATIONS
    ═══════════════════════════════════════════════════════════ */
    @keyframes contentFade {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeInStagger {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideInFromLeft {
      from {
        opacity: 0;
        transform: translateX(-12px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes softBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    @keyframes iconGlow {
      0%, 100% { filter: drop-shadow(0 0 0 transparent); }
      50% { filter: drop-shadow(0 0 8px currentColor); }
    }

    .home-page {
      max-width: var(--content-max-width);
      margin: 0 auto;
      transition: padding-right 0.3s ease;
      animation: contentFade 350ms ease-out;
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
      opacity: 0;
      animation: slideInFromLeft 250ms ease-out forwards;
    }

    // Stagger steps entrance
    .step:nth-child(1) { animation-delay: 50ms; }
    .step:nth-child(2) { animation-delay: 100ms; }
    .step:nth-child(3) { animation-delay: 150ms; }
    .step:nth-child(4) { animation-delay: 200ms; }
    .step:nth-child(5) { animation-delay: 250ms; }

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

    // =============================================
    // SPACING SYSTEM - Consistent vertical rhythm
    // =============================================
    // All sections use the same spacing values:
    // - Between sections: 40px (--spacing-10)
    // - Section header to content: 20px (--spacing-5)

    // Collapsible section wrapper
    :host ::ng-deep app-collapsible-section {
      display: block;
      margin-bottom: var(--spacing-10);
    }

    // Section styling - consistent spacing with dividers
    .section {
      margin-bottom: var(--spacing-10);
      padding-top: var(--spacing-6);
      position: relative;
      opacity: 0;
      animation: contentFade 300ms ease-out forwards;
    }

    // Stagger sections entrance
    .section:nth-of-type(1) { animation-delay: 100ms; }
    .section:nth-of-type(2) { animation-delay: 150ms; }
    .section:nth-of-type(3) { animation-delay: 200ms; }
    .section:nth-of-type(4) { animation-delay: 250ms; }
    .section:nth-of-type(5) { animation-delay: 300ms; }

    // Gradient divider before each section (theme-aware)
    .section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--border-color) 20%,
        var(--border-color) 80%,
        transparent 100%
      );
      opacity: 0.6;
    }

    // Last section has less bottom margin
    .section:last-of-type,
    .collections-section {
      margin-bottom: var(--spacing-6);
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
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0;
    }

    .section-title app-icon {
      color: var(--color-primary);
      opacity: 0.85;
    }

    // Items grid (for favorites and recent)
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--spacing-4);

      // Stagger card entrance
      ::ng-deep app-item-card {
        opacity: 0;
        animation: fadeInStagger 250ms ease-out forwards;
      }

      ::ng-deep app-item-card:nth-child(1) { animation-delay: 50ms; }
      ::ng-deep app-item-card:nth-child(2) { animation-delay: 100ms; }
      ::ng-deep app-item-card:nth-child(3) { animation-delay: 150ms; }
      ::ng-deep app-item-card:nth-child(4) { animation-delay: 200ms; }
      ::ng-deep app-item-card:nth-child(5) { animation-delay: 250ms; }
      ::ng-deep app-item-card:nth-child(6) { animation-delay: 300ms; }
      ::ng-deep app-item-card:nth-child(7) { animation-delay: 350ms; }
      ::ng-deep app-item-card:nth-child(8) { animation-delay: 400ms; }
      ::ng-deep app-item-card:nth-child(9) { animation-delay: 450ms; }
      ::ng-deep app-item-card:nth-child(10) { animation-delay: 500ms; }
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
      opacity: 0;
      animation: fadeInStagger 300ms ease-out forwards;

      // Stagger action cards
      &:nth-child(1) { animation-delay: 100ms; }
      &:nth-child(2) { animation-delay: 160ms; }
      &:nth-child(3) { animation-delay: 220ms; }
      &:nth-child(4) { animation-delay: 280ms; }

      .action-icon {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto var(--spacing-4);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                    box-shadow 0.25s ease;

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

        app-icon {
          transition: transform 0.25s ease, filter 0.25s ease;
        }
      }

      &:hover .action-icon {
        transform: scale(1.1);

        &.primary { box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.3); }
        &.success { box-shadow: 0 0 20px rgba(var(--color-success-rgb), 0.3); }
        &.warning { box-shadow: 0 0 20px rgba(var(--color-warning-rgb), 0.3); }
        &.info { box-shadow: 0 0 20px rgba(var(--color-info-rgb), 0.3); }

        app-icon {
          transform: scale(1.1);
          filter: drop-shadow(0 0 4px currentColor);
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
      opacity: 0;
      animation: fadeInStagger 250ms ease-out forwards;

      // Stagger collection cards
      &:nth-child(1) { animation-delay: 50ms; }
      &:nth-child(2) { animation-delay: 100ms; }
      &:nth-child(3) { animation-delay: 150ms; }
      &:nth-child(4) { animation-delay: 200ms; }
      &:nth-child(5) { animation-delay: 250ms; }
      &:nth-child(6) { animation-delay: 300ms; }
      &:nth-child(7) { animation-delay: 350ms; }
      &:nth-child(8) { animation-delay: 400ms; }
    }

    .collection-card:hover {
      border-color: rgba(var(--color-primary-rgb), 0.3);
      box-shadow: var(--glow-primary);
      transform: translateY(-4px);
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
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.25s ease;

      app-icon {
        transition: filter 0.25s ease;
      }
    }

    .collection-card:hover .collection-icon {
      transform: scale(1.1);
      box-shadow: 0 0 16px rgba(var(--color-primary-rgb), 0.2);

      app-icon {
        filter: drop-shadow(0 0 4px currentColor);
      }
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
      animation: contentFade 400ms ease-out;

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
        animation: softBounce 3s ease-in-out infinite;

        app-icon {
          filter: drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.3));
        }
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
