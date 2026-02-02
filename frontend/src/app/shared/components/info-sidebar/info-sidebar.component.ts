import { Component, Input, Output, EventEmitter, OnDestroy, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface InfoSidebarItem {
  id: string;
  name: string;
  type: 'query' | 'chart' | 'dashboard';
  description?: string;
  created_at?: string;
  updated_at?: string;
  route?: string;
}

@Component({
  selector: 'app-info-sidebar',
  template: `
    <div class="sidebar-overlay" [class.open]="isOpen" (click)="close.emit()"></div>
    <aside class="info-sidebar" [class.open]="isOpen">
      <!-- Premium Header -->
      <div class="sidebar-header" [class]="'header-' + item?.type">
        <div class="header-bg"></div>
        <div class="header-content">
          <div class="header-icon-wrap">
            <app-icon [name]="getIconForType(item?.type)" [size]="26"></app-icon>
          </div>
          <div class="header-text">
            <span class="header-badge">{{ item?.type | titlecase }}</span>
            <h2>{{ item?.name || 'Item Details' }}</h2>
          </div>
        </div>
        <button class="close-btn" (click)="close.emit()" title="Close">
          <app-icon name="x" [size]="20"></app-icon>
        </button>
      </div>

      <!-- Content -->
      <div class="sidebar-content" *ngIf="item">
        <!-- Description Card -->
        <div class="description-card">
          <div class="card-header">
            <app-icon name="file-text" [size]="16"></app-icon>
            <span>Description</span>
          </div>
          <div class="card-body">
            <p class="description-text" *ngIf="item.description">{{ item.description }}</p>
            <p class="description-empty" *ngIf="!item.description">No description provided</p>
          </div>
        </div>

        <!-- Details Card -->
        <div class="details-card">
          <div class="card-header">
            <app-icon name="info" [size]="16"></app-icon>
            <span>Details</span>
          </div>
          <div class="card-body">
            <div class="detail-item">
              <span class="detail-icon">
                <app-icon name="tag" [size]="14"></app-icon>
              </span>
              <div class="detail-content">
                <span class="detail-label">Type</span>
                <span class="detail-value type-value" [class]="'type-' + item.type">
                  <app-icon [name]="getIconForType(item.type)" [size]="12"></app-icon>
                  {{ item.type | titlecase }}
                </span>
              </div>
            </div>
            <div class="detail-item" *ngIf="item.created_at">
              <span class="detail-icon">
                <app-icon name="calendar" [size]="14"></app-icon>
              </span>
              <div class="detail-content">
                <span class="detail-label">Created</span>
                <span class="detail-value">{{ formatDate(item.created_at) }}</span>
              </div>
            </div>
            <div class="detail-item" *ngIf="item.updated_at">
              <span class="detail-icon">
                <app-icon name="clock" [size]="14"></app-icon>
              </span>
              <div class="detail-content">
                <span class="detail-label">Last Modified</span>
                <span class="detail-value">{{ formatRelativeTime(item.updated_at) }}</span>
              </div>
            </div>
            <div class="detail-item">
              <span class="detail-icon">
                <app-icon name="hash" [size]="14"></app-icon>
              </span>
              <div class="detail-content">
                <span class="detail-label">ID</span>
                <code class="detail-value id-value" [title]="item.id">{{ item.id }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Premium Actions -->
      <div class="sidebar-actions" *ngIf="item">
        <button class="action-btn primary-btn" (click)="onOpenInNewTab()">
          <span class="btn-icon">
            <app-icon name="external-link" [size]="18"></app-icon>
          </span>
          <span class="btn-text">Open in New Tab</span>
        </button>
        <div class="action-row">
          <button class="action-btn secondary-btn" (click)="onEdit()">
            <app-icon name="edit" [size]="16"></app-icon>
            <span>Edit</span>
          </button>
          <button class="action-btn danger-btn" (click)="onDelete()">
            <app-icon name="trash" [size]="16"></app-icon>
            <span>Delete</span>
          </button>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    @keyframes float-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .sidebar-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      z-index: 999;

      &.open {
        opacity: 1;
        visibility: visible;
      }
    }

    .info-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100vh;
      background: linear-gradient(180deg,
        rgba(20, 20, 28, 0.98) 0%,
        rgba(15, 15, 22, 0.99) 100%
      );
      backdrop-filter: blur(20px);
      border-left: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
      z-index: 1000;
      box-shadow:
        -20px 0 60px rgba(0, 0, 0, 0.5),
        -5px 0 20px rgba(0, 0, 0, 0.3);

      &.open {
        transform: translateX(0);
      }
    }

    /* ═══════════════════════════════════════════════════════════
       PREMIUM HEADER
    ═══════════════════════════════════════════════════════════ */
    .sidebar-header {
      position: relative;
      padding: var(--spacing-5);
      overflow: hidden;

      .header-bg {
        position: absolute;
        inset: 0;
        opacity: 0.15;
        background: linear-gradient(135deg,
          var(--header-accent) 0%,
          transparent 60%
        );
      }

      &.header-dashboard {
        --header-accent: #6366f1;
        .header-icon-wrap {
          background: linear-gradient(145deg, #818cf8 0%, #6366f1 50%, #4f46e5 100%);
          box-shadow:
            0 0 0 1px rgba(99, 102, 241, 0.3),
            0 4px 16px rgba(99, 102, 241, 0.25),
            0 8px 32px rgba(99, 102, 241, 0.15);
        }
        .header-badge {
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.25);
        }
      }

      &.header-chart {
        --header-accent: #f59e0b;
        .header-icon-wrap {
          background: linear-gradient(145deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
          box-shadow:
            0 0 0 1px rgba(245, 158, 11, 0.3),
            0 4px 16px rgba(245, 158, 11, 0.25),
            0 8px 32px rgba(245, 158, 11, 0.15);
        }
        .header-badge {
          background: rgba(245, 158, 11, 0.15);
          color: #fcd34d;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
      }

      &.header-query {
        --header-accent: #10b981;
        .header-icon-wrap {
          background: linear-gradient(145deg, #34d399 0%, #10b981 50%, #059669 100%);
          box-shadow:
            0 0 0 1px rgba(16, 185, 129, 0.3),
            0 4px 16px rgba(16, 185, 129, 0.25),
            0 8px 32px rgba(16, 185, 129, 0.15);
        }
        .header-badge {
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }
      }

      .header-content {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--spacing-4);
      }

      .header-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 12px;
        color: white;
        flex-shrink: 0;
        transition: transform 0.2s ease, box-shadow 0.2s ease;

        &:hover {
          transform: scale(1.02);
        }
      }

      .header-text {
        flex: 1;
        min-width: 0;

        .header-badge {
          display: inline-block;
          padding: 3px 10px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-radius: 20px;
          margin-bottom: 6px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .close-btn {
        position: absolute;
        top: var(--spacing-4);
        right: var(--spacing-4);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
          transform: scale(1.05);
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       CONTENT AREA
    ═══════════════════════════════════════════════════════════ */
    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-5);

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        &:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       CARDS
    ═══════════════════════════════════════════════════════════ */
    .description-card,
    .details-card {
      background: linear-gradient(180deg,
        rgba(255, 255, 255, 0.04) 0%,
        rgba(255, 255, 255, 0.01) 100%
      );
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: var(--spacing-4);
      animation: float-in 0.4s ease-out;

      .card-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-3) var(--spacing-4);
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted);
      }

      .card-body {
        padding: var(--spacing-4);
      }
    }

    .description-card {
      animation-delay: 0.1s;

      .description-text {
        font-size: 14px;
        color: var(--text-secondary);
        line-height: 1.6;
        margin: 0;
      }

      .description-empty {
        font-size: 14px;
        color: var(--text-muted);
        font-style: italic;
        margin: 0;
        opacity: 0.7;
      }
    }

    .details-card {
      animation-delay: 0.2s;

      .card-body {
        padding: var(--spacing-3);
      }

      .detail-item {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-3);
        padding: var(--spacing-2);
        border-radius: 8px;
        transition: background 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .detail-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: rgba(var(--color-primary-rgb), 0.1);
          border-radius: 8px;
          color: var(--color-primary-light);
          flex-shrink: 0;
        }

        .detail-content {
          flex: 1;
          min-width: 0;

          .detail-label {
            display: block;
            font-size: 11px;
            color: var(--text-muted);
            margin-bottom: 2px;
          }

          .detail-value {
            font-size: 13px;
            color: var(--text-primary);
            font-weight: 500;

            &.type-value {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;

              &.type-dashboard {
                background: rgba(99, 102, 241, 0.15);
                color: #a5b4fc;
              }

              &.type-chart {
                background: rgba(245, 158, 11, 0.15);
                color: #fcd34d;
              }

              &.type-query {
                background: rgba(16, 185, 129, 0.15);
                color: #6ee7b7;
              }
            }

            &.id-value {
              font-family: 'SF Mono', 'Fira Code', monospace;
              font-size: 11px;
              background: rgba(var(--color-primary-rgb), 0.1);
              padding: 4px 8px;
              border-radius: 6px;
              display: inline-block;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              color: var(--color-primary-light);
            }
          }
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       PREMIUM ACTION BUTTONS
    ═══════════════════════════════════════════════════════════ */
    .sidebar-actions {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
      padding: var(--spacing-5);
      background: linear-gradient(180deg,
        rgba(0, 0, 0, 0.2) 0%,
        rgba(0, 0, 0, 0.4) 100%
      );
      border-top: 1px solid rgba(255, 255, 255, 0.06);

      .action-row {
        display: flex;
        gap: var(--spacing-3);
      }
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      padding: 12px 18px;
      border: none;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s ease;
      flex: 1;

      .btn-icon {
        display: flex;
        align-items: center;

        &.spinning {
          animation: spin 1s linear infinite;
        }
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.primary-btn {
        background: linear-gradient(135deg,
          var(--color-primary) 0%,
          var(--color-primary-dark, var(--color-primary)) 100%
        );
        color: white;
        box-shadow: 0 4px 15px rgba(var(--color-primary-rgb), 0.3);

        app-icon {
          transition: transform 0.2s ease;
        }

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(var(--color-primary-rgb), 0.4);

          app-icon {
            transform: translate(2px, -2px);
          }
        }

        &:active:not(:disabled) {
          transform: translateY(0);
        }
      }

      &.secondary-btn {
        background: linear-gradient(135deg,
          rgba(var(--color-primary-rgb), 0.15) 0%,
          rgba(var(--color-primary-rgb), 0.08) 100%
        );
        border: 1px solid rgba(var(--color-primary-rgb), 0.25);
        color: var(--color-primary-light);

        app-icon {
          transition: transform 0.2s ease;
        }

        &:hover:not(:disabled) {
          background: linear-gradient(135deg,
            rgba(var(--color-primary-rgb), 0.25) 0%,
            rgba(var(--color-primary-rgb), 0.12) 100%
          );
          border-color: rgba(var(--color-primary-rgb), 0.4);
          transform: translateY(-1px);

          app-icon {
            transform: rotate(-10deg);
          }
        }
      }

      &.danger-btn {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: #f87171;

        app-icon {
          transition: transform 0.2s ease;
        }

        &:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
          transform: translateY(-1px);

          app-icon {
            animation: trashWiggle 0.3s ease-in-out;
          }
        }
      }
    }

    @keyframes trashWiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-10deg); }
      75% { transform: rotate(10deg); }
    }

    /* ═══════════════════════════════════════════════════════════
       RESPONSIVE
    ═══════════════════════════════════════════════════════════ */
    @media (max-width: 768px) {
      .info-sidebar {
        width: 100%;
      }
    }
  `],
  standalone: false
})
export class InfoSidebarComponent implements OnDestroy {
  @Input() isOpen = false;
  @Input() item: InfoSidebarItem | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() openRequested = new EventEmitter<InfoSidebarItem>();
  @Output() editRequested = new EventEmitter<InfoSidebarItem>();
  @Output() deleteRequested = new EventEmitter<InfoSidebarItem>();

  private router = inject(Router);

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isOpen) {
      this.close.emit();
    }
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  getIconForType(type?: string): string {
    const icons: Record<string, string> = {
      dashboard: 'layout-dashboard',
      chart: 'bar-chart-2',
      query: 'code',
    };
    return icons[type || 'dashboard'] || 'file';
  }

  getRouteForItem(): string {
    if (!this.item) return '/';
    if (this.item.route) return this.item.route;

    switch (this.item.type) {
      case 'dashboard':
        return `/dashboards/${this.item.id}`;
      case 'chart':
        return `/charts/${this.item.id}/edit`;
      case 'query':
        return '/queries';
      default:
        return '/';
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return this.formatDate(dateStr);
  }

  onOpenInNewTab() {
    if (this.item) {
      const route = this.getRouteForItem();
      const url = this.router.serializeUrl(this.router.createUrlTree([route]));
      window.open(url, '_blank');
    }
  }

  onEdit() {
    if (this.item) {
      this.editRequested.emit(this.item);
    }
  }

  onDelete() {
    if (this.item) {
      this.deleteRequested.emit(this.item);
    }
  }
}
