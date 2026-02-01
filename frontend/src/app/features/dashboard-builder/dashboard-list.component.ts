import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widget_count?: number;
  created_at: string;
  updated_at: string;
}

@Component({
    selector: 'app-dashboard-list',
    template: `
    <div class="dashboard-list-page">
      <div class="page-header">
        <div class="header-left">
          <h1>Dashboard Library</h1>
          <span class="dashboard-count">{{ filteredDashboards().length }} dashboards</span>
        </div>
        <div class="header-right">
          <div class="search-box">
            <app-icon name="search" [size]="16"></app-icon>
            <input
              type="text"
              placeholder="Search dashboards..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)">
            <button class="clear-search" *ngIf="searchQuery()" (click)="searchQuery.set('')">
              <app-icon name="x" [size]="14"></app-icon>
            </button>
          </div>
          <div class="sort-dropdown" (clickOutside)="showSortDropdown.set(false)">
            <button class="sort-btn" (click)="showSortDropdown.set(!showSortDropdown())">
              <app-icon name="arrow-up-down" [size]="14"></app-icon>
              {{ getSortLabel() }}
              <app-icon name="chevron-down" [size]="14" [class.rotated]="showSortDropdown()"></app-icon>
            </button>
            <div class="sort-menu" *ngIf="showSortDropdown()">
              <button class="sort-option" [class.active]="sortBy() === 'newest'" (click)="setSort('newest')">
                Newest First
              </button>
              <button class="sort-option" [class.active]="sortBy() === 'oldest'" (click)="setSort('oldest')">
                Oldest First
              </button>
              <button class="sort-option" [class.active]="sortBy() === 'updated'" (click)="setSort('updated')">
                Recently Updated
              </button>
              <button class="sort-option" [class.active]="sortBy() === 'name-asc'" (click)="setSort('name-asc')">
                Name (A-Z)
              </button>
              <button class="sort-option" [class.active]="sortBy() === 'name-desc'" (click)="setSort('name-desc')">
                Name (Z-A)
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
            New Dashboard
          </app-button>
        </div>
      </div>

      <div class="loading" *ngIf="loading()">
        <app-icon name="loader" [size]="24"></app-icon>
        Loading dashboards...
      </div>

      <!-- Grid View -->
      <div class="dashboards-grid" *ngIf="!loading() && viewMode() === 'grid'">
        <div class="dashboard-card-grid" *ngFor="let dashboard of filteredDashboards()" (click)="openDashboard(dashboard)">
          <div class="card-content">
            <div class="card-header">
              <span class="widget-count-badge">
                {{ dashboard.widget_count || 0 }} widgets
              </span>
              <div class="card-actions" (click)="$event.stopPropagation()">
                <button class="action-btn" (click)="openDashboard(dashboard)" title="Edit">
                  <app-icon name="edit" [size]="14"></app-icon>
                </button>
                <button class="action-btn danger" (click)="confirmDelete(dashboard)" title="Delete">
                  <app-icon name="trash" [size]="14"></app-icon>
                </button>
              </div>
            </div>
            <div class="card-body">
              <div class="card-info">
                <h3 class="dashboard-name">{{ dashboard.name }}</h3>
                <p class="dashboard-description" *ngIf="dashboard.description">{{ dashboard.description }}</p>
                <p class="dashboard-date">Updated {{ formatDate(dashboard.updated_at) }}</p>
              </div>
              <div class="card-icon-wrapper">
                <app-icon name="layout" [size]="28"></app-icon>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="filteredDashboards().length === 0 && dashboards().length === 0">
          <app-icon name="layout" [size]="48"></app-icon>
          <h3>No dashboards yet</h3>
          <p>Create your first dashboard to visualize your data</p>
          <app-button variant="primary" (click)="createNew()">
            <app-icon name="plus" [size]="16"></app-icon>
            Create Dashboard
          </app-button>
        </div>
        <div class="empty-state" *ngIf="filteredDashboards().length === 0 && dashboards().length > 0">
          <app-icon name="search" [size]="48"></app-icon>
          <h3>No matching dashboards</h3>
          <p>Try adjusting your search</p>
          <app-button variant="secondary" (click)="clearFilters()">
            Clear Filters
          </app-button>
        </div>
      </div>

      <!-- List View -->
      <div class="dashboards-list" *ngIf="!loading() && viewMode() === 'list'">
        <div class="list-header">
          <span class="col-name">Name</span>
          <span class="col-widgets">Widgets</span>
          <span class="col-date">Updated</span>
          <span class="col-actions">Actions</span>
        </div>
        <div class="list-row" *ngFor="let dashboard of filteredDashboards()" (click)="openDashboard(dashboard)">
          <span class="col-name">
            <div class="row-icon-wrapper">
              <app-icon name="layout" [size]="16"></app-icon>
            </div>
            <div class="row-name-info">
              <span class="row-title">{{ dashboard.name }}</span>
              <span class="row-desc" *ngIf="dashboard.description">{{ dashboard.description }}</span>
            </div>
          </span>
          <span class="col-widgets">
            <span class="widget-badge">
              {{ dashboard.widget_count || 0 }}
            </span>
          </span>
          <span class="col-date">{{ formatDate(dashboard.updated_at) }}</span>
          <span class="col-actions" (click)="$event.stopPropagation()">
            <button class="action-btn" (click)="openDashboard(dashboard)" title="Edit">
              <app-icon name="edit" [size]="14"></app-icon>
            </button>
            <button class="action-btn danger" (click)="confirmDelete(dashboard)" title="Delete">
              <app-icon name="trash" [size]="14"></app-icon>
            </button>
          </span>
        </div>

        <div class="empty-state" *ngIf="filteredDashboards().length === 0 && dashboards().length === 0">
          <app-icon name="layout" [size]="48"></app-icon>
          <h3>No dashboards yet</h3>
          <p>Create your first dashboard to visualize your data</p>
          <app-button variant="primary" (click)="createNew()">
            <app-icon name="plus" [size]="16"></app-icon>
            Create Dashboard
          </app-button>
        </div>
        <div class="empty-state" *ngIf="filteredDashboards().length === 0 && dashboards().length > 0">
          <app-icon name="search" [size]="48"></app-icon>
          <h3>No matching dashboards</h3>
          <p>Try adjusting your search</p>
          <app-button variant="secondary" (click)="clearFilters()">
            Clear Filters
          </app-button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <app-modal
      [isOpen]="showDeleteModal()"
      title="Delete Dashboard"
      size="sm"
      [hasFooter]="true"
      (closed)="cancelDelete()">
      <div class="delete-confirm-content">
        <app-icon name="alert-triangle" [size]="48" class="warning-icon"></app-icon>
        <p>Are you sure you want to delete <strong>{{ dashboardToDelete()?.name }}</strong>?</p>
        <p class="warning-text">This action cannot be undone.</p>
      </div>
      <div modal-footer class="delete-modal-footer">
        <app-button variant="ghost" (click)="cancelDelete()" title="Cancel">Cancel</app-button>
        <app-button variant="danger" (click)="deleteDashboard()" [disabled]="deleting()" title="Permanently delete this dashboard" style="margin-left: 16px;">
          <app-icon name="trash" [size]="16" *ngIf="!deleting()"></app-icon>
          <app-icon name="loader" [size]="16" *ngIf="deleting()"></app-icon>
          {{ deleting() ? 'Deleting...' : 'Delete' }}
        </app-button>
      </div>
    </app-modal>
  `,
    styles: [`
    .dashboard-list-page {
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

      .dashboard-count {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);

      // New Dashboard button - plus icon rotate on hover
      ::ng-deep app-button[variant="primary"] button {
        app-icon {
          transition: transform 0.25s ease, filter 0.2s ease;
        }

        &:hover app-icon {
          transform: rotate(90deg);
          filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.5));
        }

        &:active app-icon {
          transform: rotate(90deg) scale(0.9);
        }
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
      }

      app-icon:first-child {
        color: var(--text-muted);
        flex-shrink: 0;
        transition: transform 0.2s ease, color 0.2s ease, filter 0.2s ease;
      }

      &:focus-within app-icon:first-child {
        color: var(--color-primary);
        transform: scale(1.1);
        filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.5));
        animation: searchPulse 0.3s ease-out;
      }

      @keyframes searchPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1.1); }
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

        app-icon {
          transition: transform 0.2s ease;
        }

        &:hover {
          background: var(--color-primary);
          color: white;

          app-icon {
            transform: rotate(90deg);
          }
        }

        &:active app-icon {
          transform: rotate(180deg) scale(0.9);
        }
      }
    }

    // Sort dropdown
    .sort-dropdown {
      position: relative;
    }

    .sort-btn {
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

      app-icon.rotated {
        transform: rotate(180deg);
      }

      app-icon {
        transition: transform 0.2s ease;
      }
    }

    .sort-menu {
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

    .sort-option {
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

    /* Grid View - Premium Cards */
    .dashboards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--spacing-5);
    }

    .dashboard-card-grid {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 180px;
      padding: var(--spacing-5);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      animation: fadeInStagger 300ms ease-out forwards;
      overflow: hidden;

      // Top highlight gradient
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg,
          transparent,
          rgba(255, 255, 255, 0.1) 20%,
          rgba(255, 255, 255, 0.15) 50%,
          rgba(255, 255, 255, 0.1) 80%,
          transparent
        );
      }

      // Subtle inner glow
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 80px;
        background: radial-gradient(ellipse at 50% 0%, rgba(var(--color-primary-rgb), 0.03) 0%, transparent 70%);
        pointer-events: none;
      }

      @for $i from 1 through 20 {
        &:nth-child(#{$i}) {
          animation-delay: #{($i - 1) * 50}ms;
        }
      }

      &:hover {
        border-color: rgba(var(--color-primary-rgb), 0.4);
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.3),
          0 0 0 1px rgba(var(--color-primary-rgb), 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
        transform: translateY(-6px);

        &::after {
          background: radial-gradient(ellipse at 50% 0%, rgba(var(--color-primary-rgb), 0.08) 0%, transparent 70%);
        }

        .card-actions {
          opacity: 1;
          transform: translateX(0);
        }

        .card-icon-wrapper {
          transform: scale(1.05);
          box-shadow: var(--shadow-glow-md);
        }

        .widget-count-badge {
          border-color: rgba(var(--color-primary-rgb), 0.4);
          box-shadow: 0 0 12px rgba(var(--color-primary-rgb), 0.2);
        }
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

    .card-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 1;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-4);
    }

    .widget-count-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-3);
      background: rgba(var(--color-primary-rgb), 0.1);
      border: 1px solid rgba(var(--color-primary-rgb), 0.2);
      border-radius: var(--radius-full);
      font-size: 10px;
      font-weight: 600;
      color: var(--color-primary-light);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: all 0.25s ease;
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
      width: 30px;
      height: 30px;
      border: none;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-secondary);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s ease;

      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      &:hover {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
        box-shadow: 0 0 16px rgba(var(--color-primary-rgb), 0.5);
        transform: scale(1.1);

        app-icon {
          filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.5));
          animation: editWiggle 0.4s ease-in-out;
        }
      }

      &:active {
        transform: scale(0.95);
      }

      &.danger:hover {
        background: var(--color-danger);
        border-color: var(--color-danger);
        box-shadow: 0 0 16px rgba(var(--color-danger-rgb), 0.5);

        app-icon {
          animation: trashWiggle 0.4s ease-in-out;
        }
      }
    }

    @keyframes editWiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-8deg); }
      75% { transform: rotate(8deg); }
    }

    @keyframes trashWiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-10deg); }
      50% { transform: rotate(10deg); }
      75% { transform: rotate(-5deg); }
    }

    .card-body {
      flex: 1;
      display: flex;
      gap: var(--spacing-4);
    }

    .card-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .dashboard-name {
      margin: 0 0 var(--spacing-2) 0;
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.3;
      transition: color 0.2s ease;
    }

    .dashboard-card-grid:hover .dashboard-name {
      color: var(--color-primary-light);
    }

    .dashboard-description {
      margin: 0 0 var(--spacing-3) 0;
      font-size: var(--font-size-sm);
      color: var(--text-muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .dashboard-date {
      margin: auto 0 0 0;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      opacity: 0.7;
    }

    .card-icon-wrapper {
      width: 64px;
      height: 64px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.15) 0%, rgba(var(--color-primary-rgb), 0.05) 100%);
      border: 1px solid rgba(var(--color-primary-rgb), 0.2);
      border-radius: var(--radius-lg);
      color: var(--color-primary-light);
      transition: all 0.3s ease;

      app-icon {
        filter: drop-shadow(0 2px 4px rgba(var(--color-primary-rgb), 0.3));
      }
    }

    /* List View - Premium glassmorphism */
    .dashboards-list {
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      position: relative;

      // Top highlight
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg,
          transparent,
          rgba(255, 255, 255, 0.1) 20%,
          rgba(255, 255, 255, 0.15) 50%,
          rgba(255, 255, 255, 0.1) 80%,
          transparent
        );
      }
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
      animation: slideInFromLeft 250ms ease-out forwards;
      position: relative;

      @for $i from 1 through 30 {
        &:nth-child(#{$i}) {
          animation-delay: #{($i - 1) * 30}ms;
        }
      }

      &:last-child { border-bottom: none; }

      &:hover {
        background: rgba(var(--color-primary-rgb), 0.05);
        box-shadow: inset 0 0 0 1px rgba(var(--color-primary-rgb), 0.15),
                    inset 0 0 30px rgba(var(--color-primary-rgb), 0.03);

        .action-btn { opacity: 1; }
        .row-icon-wrapper {
          transform: scale(1.1);
          box-shadow: 0 0 12px rgba(var(--color-primary-rgb), 0.4);
        }
        .row-title { color: var(--color-primary-light); }
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
      gap: var(--spacing-3);
      min-width: 0;
    }

    .row-icon-wrapper {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--color-primary-rgb), 0.1);
      border: 1px solid rgba(var(--color-primary-rgb), 0.2);
      border-radius: var(--radius-md);
      color: var(--color-primary-light);
      transition: all 0.25s ease;
    }

    .row-name-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .row-title {
      font-weight: 500;
      color: var(--text-primary);
      transition: color 0.2s ease;
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
      max-width: 300px;
    }

    .col-widgets { display: flex; align-items: center; }

    .widget-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 24px;
      padding: 0 var(--spacing-2);
      background: rgba(var(--color-primary-rgb), 0.1);
      border: 1px solid rgba(var(--color-primary-rgb), 0.2);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-primary-light);
      transition: all 0.2s ease;
    }

    .list-row:hover .widget-badge {
      box-shadow: 0 0 8px rgba(var(--color-primary-rgb), 0.3);
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

    /* Delete Confirmation Modal - Enhanced */
    ::ng-deep app-modal {
      .modal-overlay {
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      .modal {
        background: var(--glass-bg);
        backdrop-filter: blur(var(--glass-blur-lg));
        -webkit-backdrop-filter: blur(var(--glass-blur-lg));
        border: 1px solid var(--glass-border);
        box-shadow: var(--shadow-xl),
                    0 0 40px rgba(var(--color-danger-rgb), 0.1);
        overflow: hidden;

        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--color-danger), var(--color-warning));
        }
      }

      .modal-header {
        background: rgba(var(--color-danger-rgb), 0.05) !important;
        border-bottom: 1px solid rgba(var(--color-danger-rgb), 0.1) !important;
        padding: var(--spacing-5) var(--spacing-6) !important;

        h2 {
          color: var(--color-danger);
        }

        .modal-close {
          margin-left: var(--spacing-4);
        }
      }

      .modal-footer {
        display: flex !important;
        justify-content: flex-end !important;
        align-items: center !important;
        background: rgba(0, 0, 0, 0.2) !important;
        border-top: 1px solid var(--glass-border) !important;
        gap: 24px !important;
        padding: var(--spacing-4) var(--spacing-6) !important;
      }
    }

    .delete-confirm-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--spacing-6) var(--spacing-4);
      background: radial-gradient(ellipse at 50% 0%, rgba(var(--color-danger-rgb), 0.08) 0%, transparent 60%);

      .warning-icon {
        color: var(--color-danger);
        margin-bottom: var(--spacing-4);
        padding: var(--spacing-4);
        background: rgba(var(--color-danger-rgb), 0.1);
        border: 1px solid rgba(var(--color-danger-rgb), 0.2);
        border-radius: var(--radius-full);
        animation: warningPulse 2s ease-in-out infinite, subtleShake 0.5s ease-out;
        filter: drop-shadow(0 0 12px rgba(var(--color-danger-rgb), 0.4));
      }

      @keyframes warningPulse {
        0%, 100% {
          box-shadow: 0 0 0 0 rgba(var(--color-danger-rgb), 0.3);
        }
        50% {
          box-shadow: 0 0 0 10px rgba(var(--color-danger-rgb), 0);
        }
      }

      @keyframes subtleShake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-4px); }
        40%, 80% { transform: translateX(4px); }
      }

      p {
        margin: 0 0 var(--spacing-2) 0;
        color: var(--text-primary);
        font-size: var(--font-size-base);
        line-height: 1.6;

        strong {
          color: var(--color-primary-light);
          font-weight: var(--font-weight-semibold);
        }
      }

      .warning-text {
        color: var(--color-danger);
        font-size: var(--font-size-sm);
        opacity: 0.9;
        display: flex;
        align-items: center;
        gap: var(--spacing-1);
        margin-top: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-3);
        background: rgba(var(--color-danger-rgb), 0.1);
        border-radius: var(--radius-md);
      }
    }
  `],
    standalone: false
})
export class DashboardListComponent implements OnInit {
  dashboards = signal<Dashboard[]>([]);
  loading = signal(true);
  viewMode = signal<'grid' | 'list'>('grid');

  // Search and sort
  searchQuery = signal('');
  sortBy = signal<'newest' | 'oldest' | 'updated' | 'name-asc' | 'name-desc'>('newest');
  showSortDropdown = signal(false);

  filteredDashboards = computed(() => {
    let result = [...this.dashboards()];
    const query = this.searchQuery().toLowerCase().trim();
    const sort = this.sortBy();

    // Filter by search query
    if (query) {
      result = result.filter(d =>
        d.name.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sort) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'updated':
        result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return result;
  });

  // Delete confirmation state
  showDeleteModal = signal(false);
  dashboardToDelete = signal<Dashboard | null>(null);
  deleting = signal(false);

  private router = inject(Router);
  private api = inject(ApiService);
  private notifications = inject(NotificationService);

  ngOnInit() {
    this.loadDashboards();
  }

  loadDashboards() {
    this.loading.set(true);
    this.api.get<Dashboard[]>('/dashboards').subscribe({
      next: (dashboards) => {
        this.dashboards.set(dashboards);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  createNew() {
    this.router.navigate(['/dashboards', 'new']);
  }

  openDashboard(dashboard: Dashboard) {
    this.router.navigate(['/dashboards', dashboard.id]);
  }

  setSort(sort: 'newest' | 'oldest' | 'updated' | 'name-asc' | 'name-desc') {
    this.sortBy.set(sort);
    this.showSortDropdown.set(false);
  }

  getSortLabel(): string {
    const labels: Record<string, string> = {
      'newest': 'Newest',
      'oldest': 'Oldest',
      'updated': 'Updated',
      'name-asc': 'A-Z',
      'name-desc': 'Z-A'
    };
    return labels[this.sortBy()];
  }

  clearFilters() {
    this.searchQuery.set('');
  }

  confirmDelete(dashboard: Dashboard) {
    this.dashboardToDelete.set(dashboard);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.dashboardToDelete.set(null);
  }

  deleteDashboard() {
    const dashboard = this.dashboardToDelete();
    if (!dashboard) return;

    this.deleting.set(true);
    this.api.delete(`/dashboards/${dashboard.id}`).subscribe({
      next: () => {
        this.dashboards.update(dashboards => dashboards.filter(d => d.id !== dashboard.id));
        this.notifications.success(`Dashboard "${dashboard.name}" deleted`);
        this.deleting.set(false);
        this.cancelDelete();
      },
      error: () => {
        this.notifications.error('Failed to delete dashboard');
        this.deleting.set(false);
      }
    });
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
