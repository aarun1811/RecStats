import { Component, OnInit, signal, inject, computed } from '@angular/core';
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
          <h1>Chart Library</h1>
          <span class="chart-count">{{ filteredCharts().length }} charts</span>
        </div>
        <div class="header-right">
          <div class="search-box">
            <app-icon name="search" [size]="16"></app-icon>
            <input
              type="text"
              placeholder="Search charts..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)">
            <button class="clear-search" *ngIf="searchQuery()" (click)="searchQuery.set('')">
              <app-icon name="x" [size]="14"></app-icon>
            </button>
          </div>
          <div class="filter-dropdown" (clickOutside)="showFilterDropdown.set(false)">
            <button class="filter-btn" [class.active]="filterType()" (click)="showFilterDropdown.set(!showFilterDropdown())">
              <app-icon name="filter" [size]="16"></app-icon>
              {{ filterType() ? getChartTypeLabel(filterType()!) : 'All Types' }}
              <app-icon name="chevron-down" [size]="14" [class.rotated]="showFilterDropdown()"></app-icon>
            </button>
            <div class="filter-menu" *ngIf="showFilterDropdown()">
              <button class="filter-option" [class.active]="!filterType()" (click)="setFilter(null)">
                All Types
              </button>
              <button
                *ngFor="let type of chartTypes"
                class="filter-option"
                [class.active]="filterType() === type"
                (click)="setFilter(type)">
                <app-icon [name]="getChartIcon(type)" [size]="14"></app-icon>
                {{ getChartTypeLabel(type) }}
              </button>
            </div>
          </div>
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
        <div class="chart-card-grid" *ngFor="let chart of filteredCharts()" (click)="editChart(chart)">
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

        <div class="empty-state" *ngIf="filteredCharts().length === 0 && charts().length === 0">
          <app-icon name="bar-chart-2" [size]="48"></app-icon>
          <h3>No charts yet</h3>
          <p>Create your first chart to visualize your data</p>
          <app-button variant="primary" (click)="createNew()">
            <app-icon name="plus" [size]="16"></app-icon>
            Create Chart
          </app-button>
        </div>
        <div class="empty-state" *ngIf="filteredCharts().length === 0 && charts().length > 0">
          <app-icon name="search" [size]="48"></app-icon>
          <h3>No matching charts</h3>
          <p>Try adjusting your search or filter</p>
          <app-button variant="secondary" (click)="clearFilters()">
            Clear Filters
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
        <div class="list-row" *ngFor="let chart of filteredCharts()" (click)="editChart(chart)">
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

        <div class="empty-state" *ngIf="filteredCharts().length === 0 && charts().length === 0">
          <app-icon name="bar-chart-2" [size]="48"></app-icon>
          <h3>No charts yet</h3>
          <p>Create your first chart to visualize your data</p>
          <app-button variant="primary" (click)="createNew()">
            <app-icon name="plus" [size]="16"></app-icon>
            Create Chart
          </app-button>
        </div>
        <div class="empty-state" *ngIf="filteredCharts().length === 0 && charts().length > 0">
          <app-icon name="search" [size]="48"></app-icon>
          <h3>No matching charts</h3>
          <p>Try adjusting your search or filter</p>
          <app-button variant="secondary" (click)="clearFilters()">
            Clear Filters
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
      animation: contentFade 300ms ease-out;
    }

    @keyframes contentFade {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
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
        background: linear-gradient(135deg, var(--text-primary) 0%, var(--color-primary-light) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .chart-count {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      transition: all 0.2s ease;
      min-width: 200px;

      &:focus-within {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-glow-sm);
      }

      app-icon {
        color: var(--text-muted);
        flex-shrink: 0;
      }

      &:focus-within app-icon {
        color: var(--color-primary);
      }

      input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-primary);
        font-size: var(--font-size-sm);

        &::placeholder {
          color: var(--text-muted);
        }
      }

      .clear-search {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        padding: 0;
        background: var(--bg-tertiary);
        border: none;
        border-radius: 50%;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: var(--color-primary);
          color: white;
        }
      }
    }

    .filter-dropdown {
      position: relative;
    }

    .filter-btn {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--color-primary);
        color: var(--text-primary);
      }

      &.active {
        border-color: var(--color-primary);
        background: rgba(var(--color-primary-rgb), 0.1);
        color: var(--color-primary-light);
      }

      app-icon.rotated {
        transform: rotate(180deg);
      }

      app-icon {
        transition: transform 0.2s ease;
      }
    }

    .filter-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      min-width: 160px;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 100;
      overflow: hidden;
      animation: dropdownOpen 0.2s ease-out;

      @keyframes dropdownOpen {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    }

    .filter-option {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      width: 100%;
      padding: var(--spacing-2) var(--spacing-3);
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      text-align: left;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(var(--color-primary-rgb), 0.1);
        color: var(--text-primary);
      }

      &.active {
        background: rgba(var(--color-primary-rgb), 0.15);
        color: var(--color-primary-light);
      }

      app-icon {
        opacity: 0.7;
      }
    }

    .view-toggle {
      display: flex;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 2px;
      position: relative;
      overflow: hidden;
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
      position: relative;
      z-index: 1;

      &:hover:not(.active) {
        color: var(--text-primary);
        background: var(--bg-hover);
      }

      &.active {
        background: var(--color-primary);
        color: white;
        box-shadow: 0 0 15px rgba(var(--color-primary-rgb), 0.5);
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
        filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.4));
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Grid View - Staggered Animation */
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
      transition: all 0.25s ease;
      opacity: 0;
      animation: fadeInStagger 300ms ease-out forwards;

      @for $i from 1 through 20 {
        &:nth-child(#{$i}) {
          animation-delay: #{($i - 1) * 50}ms;
        }
      }

      &:hover {
        border-color: rgba(var(--color-primary-rgb), 0.5);
        box-shadow: var(--shadow-glow-md), var(--shadow-lg);
        transform: translateY(-4px);

        .card-actions {
          opacity: 1;
          transform: translateX(0);
        }
        .card-icon {
          opacity: 1;
          box-shadow: var(--shadow-glow-md);
          transform: scale(1.05);
        }
      }
    }

    @keyframes fadeInStagger {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
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
      border: 1px solid transparent;

      // Category-based colors on hover
      &[data-category="basic"] { --badge-color: var(--color-primary-rgb); }
      &[data-category="advanced"] { --badge-color: 155, 89, 182; }
      &[data-category="kpi"] { --badge-color: var(--color-success-rgb); }
    }

    .chart-card-grid:hover .chart-type-badge {
      background: rgba(var(--color-primary-rgb), 0.15);
      color: var(--color-primary-light);
      border-color: rgba(var(--color-primary-rgb), 0.2);
      box-shadow: 0 0 10px rgba(var(--color-primary-rgb), 0.2);
    }

    .card-actions {
      display: flex;
      gap: var(--spacing-1);
      opacity: 0;
      transition: all 0.25s ease;
      transform: translateX(8px);
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
        box-shadow: 0 0 12px rgba(var(--color-primary-rgb), 0.5);
        transform: scale(1.05);
      }

      &.danger:hover {
        background: var(--color-danger);
        box-shadow: 0 0 12px rgba(var(--color-danger-rgb), 0.5);
      }
    }

    .chart-name {
      margin: 0 0 var(--spacing-2) 0;
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.3;
      transition: color 0.2s ease;
    }

    .chart-card-grid:hover .chart-name {
      color: var(--color-primary-light);
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
      opacity: 0.5;
      transition: all 0.25s ease;
    }

    /* List View - Slide in animation */
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
      opacity: 0;
      animation: slideInFromLeft 250ms ease-out forwards;

      @for $i from 1 through 30 {
        &:nth-child(#{$i}) {
          animation-delay: #{($i - 1) * 30}ms;
        }
      }

      &:last-child { border-bottom: none; }

      &:hover {
        background: rgba(var(--color-primary-rgb), 0.05);
        box-shadow: inset 0 0 0 1px rgba(var(--color-primary-rgb), 0.2),
                    inset 0 0 20px rgba(var(--color-primary-rgb), 0.05);

        .action-btn { opacity: 1; }
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
      filter: drop-shadow(0 0 6px rgba(var(--color-primary-rgb), 0.6));
      transform: scale(1.1);
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
      border: 1px solid transparent;
    }

    .list-row:hover .type-badge {
      background: rgba(var(--color-primary-rgb), 0.15);
      color: var(--color-primary-light);
      border-color: rgba(var(--color-primary-rgb), 0.2);
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

      .action-btn {
        opacity: 0;
        transition: all 0.2s ease;
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
      background: radial-gradient(ellipse at 50% 30%, rgba(var(--color-primary-rgb), 0.05) 0%, transparent 50%);

      app-icon {
        opacity: 0.6;
        animation: softBounce 3s ease-in-out infinite;
        filter: drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.3));
      }

      @keyframes softBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }

      h3 {
        margin: var(--spacing-4) 0 var(--spacing-2) 0;
        color: var(--text-primary);
        font-size: var(--font-size-lg);
      }

      p {
        margin: 0 0 var(--spacing-4) 0;
        max-width: 280px;
      }
    }

    /* Delete Confirmation Modal - Glassmorphism */
    .delete-confirm-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--spacing-4) 0;

      .warning-icon {
        color: var(--color-warning);
        margin-bottom: var(--spacing-4);
        animation: subtleShake 0.5s ease-out;
        filter: drop-shadow(0 0 8px rgba(var(--color-warning-rgb), 0.5));
      }

      @keyframes subtleShake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-4px); }
        40%, 80% { transform: translateX(4px); }
      }

      p {
        margin: 0 0 var(--spacing-2) 0;
        color: var(--text-primary);

        strong {
          color: var(--color-primary-light);
        }
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

  // Search and filter
  searchQuery = signal('');
  filterType = signal<string | null>(null);
  showFilterDropdown = signal(false);

  chartTypes = ['bar', 'column', 'line', 'area', 'scatter', 'pie', 'donut', 'heatmap', 'treemap', 'funnel', 'radar', 'gauge', 'radialBar', 'kpiCard'];

  filteredCharts = computed(() => {
    let result = this.charts();
    const query = this.searchQuery().toLowerCase().trim();
    const type = this.filterType();

    if (query) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
      );
    }

    if (type) {
      result = result.filter(c => c.chart_type === type);
    }

    return result;
  });

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

  setFilter(type: string | null) {
    this.filterType.set(type);
    this.showFilterDropdown.set(false);
  }

  clearFilters() {
    this.searchQuery.set('');
    this.filterType.set(null);
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
      'bar': 'chart-bar-h',
      'column': 'chart-bar',
      'line': 'chart-line',
      'area': 'chart-area',
      'pie': 'pie-chart',
      'donut': 'chart-donut',
      'scatter': 'chart-scatter',
      'gauge': 'chart-gauge',
      'radar': 'chart-radar',
      'heatmap': 'chart-heatmap',
      'funnel': 'chart-funnel',
      'treemap': 'chart-treemap',
      'kpi': 'chart-kpi',
      'kpiCard': 'chart-kpi',
      'radialBar': 'chart-radial',
      'worldMap': 'globe',
      'map': 'globe',
      'sankey': 'chart-sankey',
      'histogram': 'chart-histogram',
      'bubble': 'chart-bubble',
      'waterfall': 'chart-waterfall'
    };
    return icons[type] || 'chart-bar';
  }

  getChartTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'bar': 'Bar',
      'column': 'Column',
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
      'kpiCard': 'KPI Card',
      'radialBar': 'Radial Bar',
      'worldMap': 'Map',
      'map': 'Map',
      'sankey': 'Sankey',
      'histogram': 'Histogram',
      'bubble': 'Bubble',
      'waterfall': 'Waterfall'
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
