import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { DataSource, DataSourceType, ConnectionStatus, DataSourceCreate, DataSourceUpdate, ConnectionTestResult, SQLiteConfig, OracleConfig } from './data-source.types';

type SidebarMode = 'view' | 'edit' | 'create';

@Component({
    selector: 'app-data-source-list',
    template: `
    <div class="data-source-list-page" [class.sidebar-open]="sidebarOpen()">
      <div class="page-header">
        <div class="header-left">
          <h1>Data Sources</h1>
          <span class="item-count">{{ filteredDataSources().length }} sources</span>
        </div>
        <div class="header-right">
          <div class="search-box">
            <app-icon name="search" [size]="16"></app-icon>
            <input
              type="text"
              placeholder="Search data sources..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)">
            <button class="clear-search" *ngIf="searchQuery()" (click)="searchQuery.set('')">
              <app-icon name="x" [size]="14"></app-icon>
            </button>
          </div>
          <div class="filter-dropdown" (clickOutside)="showFilterDropdown.set(false)">
            <button class="filter-btn" [class.active]="filterType()" (click)="showFilterDropdown.set(!showFilterDropdown())">
              <app-icon name="filter" [size]="16"></app-icon>
              {{ filterType() ? getTypeLabel(filterType()!) : 'All Types' }}
              <app-icon name="chevron-down" [size]="14" [class.rotated]="showFilterDropdown()"></app-icon>
            </button>
            <div class="filter-menu" *ngIf="showFilterDropdown()">
              <button class="filter-option" [class.active]="!filterType()" (click)="setFilter(null)">
                All Types
              </button>
              <button class="filter-option" [class.active]="filterType() === 'sqlite'" (click)="setFilter('sqlite')">
                <app-icon name="database" [size]="14"></app-icon>
                SQLite
              </button>
              <button class="filter-option" [class.active]="filterType() === 'oracle'" (click)="setFilter('oracle')">
                <app-icon name="server" [size]="14"></app-icon>
                Oracle
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
          <app-button variant="primary" (click)="openCreateSidebar()">
            <app-icon name="plus" [size]="16"></app-icon>
            New Data Source
          </app-button>
        </div>
      </div>

      <div class="loading" *ngIf="loading()">
        <app-icon name="loader" [size]="24"></app-icon>
        Loading data sources...
      </div>

      <!-- Grid View -->
      <div class="sources-grid" *ngIf="!loading() && viewMode() === 'grid'">
        <div
          class="source-card-grid"
          *ngFor="let ds of filteredDataSources(); let i = index"
          [style.animation-delay]="(i * 50) + 'ms'"
          [class.selected]="selectedDataSource()?.id === ds.id"
          (click)="openViewSidebar(ds)">
          <div class="card-content">
            <div class="card-header">
              <span class="source-type-badge" [class]="'type-' + ds.type">
                <app-icon [name]="getTypeIcon(ds.type)" [size]="14"></app-icon>
                {{ getTypeLabel(ds.type) }}
              </span>
              <div class="status-indicator" [class]="ds.connection_status" [title]="getStatusTooltip(ds)">
                <span class="status-dot"></span>
                {{ getStatusLabel(ds.connection_status) }}
              </div>
            </div>
            <div class="card-body">
              <div class="card-info">
                <h3 class="source-name">{{ ds.name }}</h3>
                <p class="source-description" *ngIf="ds.description">{{ ds.description }}</p>
                <p class="source-date">Updated {{ formatDate(ds.updated_at) }}</p>
              </div>
              <div class="card-icon-wrapper" [class]="'type-' + ds.type">
                <app-icon [name]="getTypeIcon(ds.type)" [size]="28"></app-icon>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="filteredDataSources().length === 0 && dataSources().length === 0">
          <app-icon name="database" [size]="48"></app-icon>
          <h3>No data sources yet</h3>
          <p>Connect to your first database to start querying</p>
          <app-button variant="primary" (click)="openCreateSidebar()">
            <app-icon name="plus" [size]="16"></app-icon>
            Add Data Source
          </app-button>
        </div>
        <div class="empty-state" *ngIf="filteredDataSources().length === 0 && dataSources().length > 0">
          <app-icon name="search" [size]="48"></app-icon>
          <h3>No matching data sources</h3>
          <p>Try adjusting your search or filter</p>
          <app-button variant="secondary" (click)="clearFilters()">
            Clear Filters
          </app-button>
        </div>
      </div>

      <!-- List View -->
      <div class="sources-list" *ngIf="!loading() && viewMode() === 'list'">
        <div class="list-header">
          <span class="col-name">Name</span>
          <span class="col-type">Type</span>
          <span class="col-status">Status</span>
          <span class="col-date">Updated</span>
        </div>
        <div
          class="list-row"
          *ngFor="let ds of filteredDataSources(); let i = index"
          [style.animation-delay]="(i * 30) + 'ms'"
          [class.selected]="selectedDataSource()?.id === ds.id"
          (click)="openViewSidebar(ds)">
          <span class="col-name">
            <div class="row-icon-wrapper" [class]="'type-' + ds.type">
              <app-icon [name]="getTypeIcon(ds.type)" [size]="16"></app-icon>
            </div>
            <div class="row-name-info">
              <span class="row-title">{{ ds.name }}</span>
              <span class="row-desc" *ngIf="ds.description">{{ ds.description }}</span>
            </div>
          </span>
          <span class="col-type">
            <span class="type-badge" [class]="'type-' + ds.type">
              {{ getTypeLabel(ds.type) }}
            </span>
          </span>
          <span class="col-status">
            <span class="status-badge" [class]="ds.connection_status">
              <span class="status-dot"></span>
              {{ getStatusLabel(ds.connection_status) }}
            </span>
          </span>
          <span class="col-date">{{ formatDate(ds.updated_at) }}</span>
        </div>

        <div class="empty-state" *ngIf="filteredDataSources().length === 0 && dataSources().length === 0">
          <app-icon name="database" [size]="48"></app-icon>
          <h3>No data sources yet</h3>
          <p>Connect to your first database to start querying</p>
          <app-button variant="primary" (click)="openCreateSidebar()">
            <app-icon name="plus" [size]="16"></app-icon>
            Add Data Source
          </app-button>
        </div>
        <div class="empty-state" *ngIf="filteredDataSources().length === 0 && dataSources().length > 0">
          <app-icon name="search" [size]="48"></app-icon>
          <h3>No matching data sources</h3>
          <p>Try adjusting your search or filter</p>
          <app-button variant="secondary" (click)="clearFilters()">
            Clear Filters
          </app-button>
        </div>
      </div>
    </div>

    <!-- Sidebar -->
    <app-data-source-sidebar
      [isOpen]="sidebarOpen()"
      [dataSource]="selectedDataSource()"
      [mode]="sidebarMode()"
      (close)="closeSidebar()"
      (saved)="onDataSourceSaved($event)"
      (deleted)="onDataSourceDeleted($event)"
      (modeChange)="sidebarMode.set($event)">
    </app-data-source-sidebar>

    <!-- Delete Confirmation Modal -->
    <app-modal
      [isOpen]="showDeleteModal()"
      title="Delete Data Source"
      size="sm"
      [hasFooter]="true"
      (closed)="cancelDelete()">
      <div class="delete-confirm-content">
        <app-icon name="alert-triangle" [size]="48" class="warning-icon"></app-icon>
        <p>Are you sure you want to delete <strong>{{ dataSourceToDelete()?.name }}</strong>?</p>
        <p class="warning-text">This will remove the data source and may affect related queries.</p>
      </div>
      <div modal-footer class="delete-modal-footer">
        <app-button variant="ghost" (click)="cancelDelete()">Cancel</app-button>
        <app-button variant="danger" (click)="deleteDataSource()" [disabled]="deleting()">
          <app-icon name="trash" [size]="16" *ngIf="!deleting()"></app-icon>
          <app-icon name="loader" [size]="16" *ngIf="deleting()"></app-icon>
          {{ deleting() ? 'Deleting...' : 'Delete' }}
        </app-button>
      </div>
    </app-modal>
  `,
    styles: [`
    .data-source-list-page {
      padding: var(--spacing-6);
      max-width: 1400px;
      margin: 0 auto;
      animation: contentFade 300ms ease-out;
      transition: padding-right var(--transition-normal);
    }

    .data-source-list-page.sidebar-open {
      padding-right: 440px;
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

      .item-count {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
    }

    @keyframes searchPulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(var(--color-primary-rgb), 0);
      }
      50% {
        box-shadow: 0 0 0 4px rgba(var(--color-primary-rgb), 0.15);
      }
    }

    @keyframes dropdownOpen {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
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
        animation: searchPulse 2s ease-in-out infinite;
      }

      app-icon:first-child {
        color: var(--text-muted);
        flex-shrink: 0;
        transition: all 0.2s ease;
      }

      &:focus-within app-icon:first-child {
        color: var(--color-primary);
        filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.5));
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

      &:hover, &.active {
        border-color: var(--color-primary);
        color: var(--text-primary);
      }

      app-icon.rotated {
        transform: rotate(180deg);
      }
    }

    .filter-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      min-width: 150px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 100;
      overflow: hidden;
      animation: dropdownOpen 200ms cubic-bezier(0.22, 1, 0.36, 1);
      transform-origin: top left;
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
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      &.active {
        background: rgba(var(--color-primary-rgb), 0.1);
        color: var(--color-primary);
      }
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
      padding: var(--spacing-16);
      color: var(--text-muted);

      app-icon {
        animation: spin 1s linear infinite;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    // Grid View
    .sources-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--spacing-5);
    }

    .source-card-grid {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 180px;
      padding: var(--spacing-5);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      animation: fadeInStagger 300ms ease-out forwards;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.3));
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      &:hover {
        border-color: rgba(var(--color-primary-rgb), 0.4);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3),
                    0 0 0 1px rgba(var(--color-primary-rgb), 0.1);
        transform: translateY(-6px);

        &::before {
          opacity: 1;
        }
      }

      &.selected {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2),
                    0 8px 32px rgba(0, 0, 0, 0.3);

        &::before {
          opacity: 1;
        }
      }
    }

    @keyframes fadeInStagger {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .card-content {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-4);
    }

    .source-type-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      font-size: var(--font-size-xs);
      font-weight: 600;
      border-radius: var(--radius-full);
      text-transform: uppercase;
      letter-spacing: 0.5px;

      &.type-sqlite {
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
      }

      &.type-oracle {
        background: rgba(249, 115, 22, 0.15);
        color: #fb923c;
      }
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      font-size: var(--font-size-xs);
      color: var(--text-muted);

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--text-muted);
      }

      &.connected {
        color: var(--color-success);
        .status-dot {
          background: var(--color-success);
          box-shadow: 0 0 8px rgba(var(--color-success-rgb), 0.5);
        }
      }

      &.failed {
        color: var(--color-error);
        .status-dot {
          background: var(--color-error);
          box-shadow: 0 0 8px rgba(var(--color-error-rgb), 0.5);
        }
      }

      &.not_tested {
        color: var(--text-muted);
        .status-dot {
          background: var(--text-muted);
        }
      }
    }

    .card-body {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex: 1;
    }

    .card-info {
      flex: 1;
    }

    .source-name {
      margin: 0 0 var(--spacing-2);
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
    }

    .source-description {
      margin: 0 0 var(--spacing-2);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .source-date {
      margin: 0;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .card-icon-wrapper {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-lg);
      flex-shrink: 0;
      margin-left: var(--spacing-4);

      &.type-sqlite {
        background: rgba(59, 130, 246, 0.1);
        color: #60a5fa;
      }

      &.type-oracle {
        background: rgba(249, 115, 22, 0.1);
        color: #fb923c;
      }
    }

    // List View
    .sources-list {
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      overflow: hidden;
    }

    .list-header {
      display: grid;
      grid-template-columns: 1fr 100px 120px 100px;
      gap: var(--spacing-4);
      padding: var(--spacing-3) var(--spacing-5);
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--glass-border);
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .list-row {
      display: grid;
      grid-template-columns: 1fr 100px 120px 100px;
      gap: var(--spacing-4);
      padding: var(--spacing-3) var(--spacing-5);
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      cursor: pointer;
      transition: all 0.25s ease;
      opacity: 0;
      animation: slideIn 300ms ease-out forwards;

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: rgba(var(--color-primary-rgb), 0.05);
      }

      &.selected {
        background: rgba(var(--color-primary-rgb), 0.1);
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .col-name {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
    }

    .row-icon-wrapper {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      flex-shrink: 0;

      &.type-sqlite {
        background: rgba(59, 130, 246, 0.1);
        color: #60a5fa;
      }

      &.type-oracle {
        background: rgba(249, 115, 22, 0.1);
        color: #fb923c;
      }
    }

    .row-name-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .row-title {
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-desc {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .col-type, .col-status, .col-date {
      display: flex;
      align-items: center;
    }

    .type-badge {
      display: inline-flex;
      align-items: center;
      padding: var(--spacing-1) var(--spacing-2);
      font-size: var(--font-size-xs);
      font-weight: 500;
      border-radius: var(--radius-sm);

      &.type-sqlite {
        background: rgba(59, 130, 246, 0.1);
        color: #60a5fa;
      }

      &.type-oracle {
        background: rgba(249, 115, 22, 0.1);
        color: #fb923c;
      }
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      font-size: var(--font-size-xs);
      font-weight: 500;
      border-radius: var(--radius-sm);

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      &.connected {
        background: rgba(var(--color-success-rgb), 0.1);
        color: var(--color-success);
        .status-dot { background: var(--color-success); }
      }

      &.failed {
        background: rgba(var(--color-error-rgb), 0.1);
        color: var(--color-error);
        .status-dot { background: var(--color-error); }
      }

      &.not_tested {
        background: var(--bg-tertiary);
        color: var(--text-muted);
        .status-dot { background: var(--text-muted); }
      }
    }

    .col-date {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
    }

    @keyframes softBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    // Empty State
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-16);
      text-align: center;
      grid-column: 1 / -1;

      app-icon {
        color: var(--color-primary);
        margin-bottom: var(--spacing-4);
        opacity: 0.6;
        animation: softBounce 3s ease-in-out infinite;
        filter: drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.3));
      }

      h3 {
        margin: 0 0 var(--spacing-2);
        font-size: var(--font-size-lg);
        color: var(--text-primary);
      }

      p {
        margin: 0 0 var(--spacing-4);
        color: var(--text-muted);
      }
    }

    // Delete Modal
    .delete-confirm-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--spacing-4);

      .warning-icon {
        color: var(--color-warning);
        margin-bottom: var(--spacing-4);
      }

      p {
        margin: 0 0 var(--spacing-2);
        color: var(--text-secondary);
      }

      .warning-text {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
      }
    }

    .delete-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-3);
    }

    @media (max-width: 768px) {
      .data-source-list-page.sidebar-open {
        padding-right: var(--spacing-6);
      }

      .page-header {
        flex-direction: column;
        align-items: stretch;
        gap: var(--spacing-4);
      }

      .header-right {
        flex-wrap: wrap;
      }

      .sources-grid {
        grid-template-columns: 1fr;
      }

      .list-header, .list-row {
        grid-template-columns: 1fr 80px;
      }

      .col-status, .col-date {
        display: none;
      }
    }
  `],
    standalone: false
})
export class DataSourceListComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);

  // Data
  dataSources = signal<DataSource[]>([]);
  loading = signal(true);

  // View state
  viewMode = signal<'grid' | 'list'>('grid');
  searchQuery = signal('');
  filterType = signal<DataSourceType | null>(null);
  showFilterDropdown = signal(false);

  // Sidebar state
  sidebarOpen = signal(false);
  sidebarMode = signal<SidebarMode>('view');
  selectedDataSource = signal<DataSource | null>(null);

  // Delete modal state
  showDeleteModal = signal(false);
  dataSourceToDelete = signal<DataSource | null>(null);
  deleting = signal(false);

  // Computed filtered list
  filteredDataSources = computed(() => {
    let result = [...this.dataSources()];
    const query = this.searchQuery().toLowerCase().trim();
    const type = this.filterType();

    if (query) {
      result = result.filter(ds =>
        ds.name.toLowerCase().includes(query) ||
        ds.description?.toLowerCase().includes(query)
      );
    }

    if (type) {
      result = result.filter(ds => ds.type === type);
    }

    // Sort by updated_at desc
    result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return result;
  });

  ngOnInit() {
    this.loadDataSources();
  }

  loadDataSources() {
    this.loading.set(true);
    this.api.get<DataSource[]>('/datasources').subscribe({
      next: (sources) => {
        this.dataSources.set(sources);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load data sources:', err);
        this.notifications.error('Failed to load data sources');
        this.loading.set(false);
      }
    });
  }

  // Sidebar operations
  openCreateSidebar() {
    this.selectedDataSource.set(null);
    this.sidebarMode.set('create');
    this.sidebarOpen.set(true);
  }

  openViewSidebar(ds: DataSource) {
    this.selectedDataSource.set(ds);
    this.sidebarMode.set('view');
    this.sidebarOpen.set(true);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
    this.selectedDataSource.set(null);
  }

  onDataSourceSaved(ds: DataSource) {
    // Refresh the list
    this.loadDataSources();
    // Update selected if same ID
    if (this.selectedDataSource()?.id === ds.id) {
      this.selectedDataSource.set(ds);
    }
    this.sidebarMode.set('view');
  }

  onDataSourceDeleted(id: string) {
    this.dataSources.update(sources => sources.filter(s => s.id !== id));
    this.closeSidebar();
  }

  // Delete modal
  confirmDelete(ds: DataSource) {
    this.dataSourceToDelete.set(ds);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.dataSourceToDelete.set(null);
  }

  deleteDataSource() {
    const ds = this.dataSourceToDelete();
    if (!ds) return;

    this.deleting.set(true);
    this.api.delete(`/datasources/${ds.id}`).subscribe({
      next: () => {
        this.dataSources.update(sources => sources.filter(s => s.id !== ds.id));
        this.notifications.success(`Data source "${ds.name}" deleted`);
        this.deleting.set(false);
        this.cancelDelete();
        if (this.selectedDataSource()?.id === ds.id) {
          this.closeSidebar();
        }
      },
      error: (err) => {
        console.error('Failed to delete data source:', err);
        this.notifications.error('Failed to delete data source');
        this.deleting.set(false);
      }
    });
  }

  // Filter operations
  setFilter(type: DataSourceType | null) {
    this.filterType.set(type);
    this.showFilterDropdown.set(false);
  }

  clearFilters() {
    this.searchQuery.set('');
    this.filterType.set(null);
  }

  // Helpers
  getTypeIcon(type: DataSourceType): string {
    return type === 'oracle' ? 'server' : 'database';
  }

  getTypeLabel(type: DataSourceType): string {
    return type === 'oracle' ? 'Oracle' : 'SQLite';
  }

  getStatusLabel(status: ConnectionStatus): string {
    switch (status) {
      case 'connected': return 'Connected';
      case 'failed': return 'Failed';
      default: return 'Not Tested';
    }
  }

  getStatusTooltip(ds: DataSource): string {
    if (ds.connection_message) {
      return ds.connection_message;
    }
    return this.getStatusLabel(ds.connection_status);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
