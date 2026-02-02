import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';

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
      <div class="sidebar-header">
        <div class="item-icon" [class]="'icon-' + item?.type">
          <app-icon [name]="getIconForType(item?.type)" [size]="24"></app-icon>
        </div>
        <button class="close-btn" (click)="close.emit()" title="Close">
          <app-icon name="x" [size]="20"></app-icon>
        </button>
      </div>

      <div class="sidebar-content" *ngIf="item">
        <div class="item-header">
          <h2 class="item-name">{{ item.name }}</h2>
          <span class="item-type-badge">{{ item.type | titlecase }}</span>
        </div>

        <p class="item-description" *ngIf="item.description">
          {{ item.description }}
        </p>
        <p class="item-description empty" *ngIf="!item.description">
          No description provided
        </p>

        <div class="metadata-section">
          <h3 class="section-title">Details</h3>
          <div class="metadata-grid">
            <div class="meta-item" *ngIf="item.created_at">
              <span class="meta-label">Created</span>
              <span class="meta-value">{{ formatDate(item.created_at) }}</span>
            </div>
            <div class="meta-item" *ngIf="item.updated_at">
              <span class="meta-label">Modified</span>
              <span class="meta-value">{{ formatDate(item.updated_at) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Type</span>
              <span class="meta-value">{{ item.type | titlecase }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">ID</span>
              <span class="meta-value id-value" [title]="item.id">{{ truncateId(item.id) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="sidebar-actions" *ngIf="item">
        <app-button variant="primary" (click)="onOpen()">
          <app-icon name="external-link" [size]="16"></app-icon>
          Open
        </app-button>
        <app-button variant="secondary" (click)="onEdit()">
          <app-icon name="edit" [size]="16"></app-icon>
          Edit
        </app-button>
        <app-button variant="ghost" class="danger-btn" (click)="onDelete()">
          <app-icon name="trash-2" [size]="16"></app-icon>
          Delete
        </app-button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      z-index: 999;
    }

    .sidebar-overlay.open {
      opacity: 1;
      visibility: visible;
    }

    .info-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 380px;
      max-width: 90vw;
      background: var(--bg-primary);
      border-left: 1px solid var(--border-color);
      box-shadow: var(--shadow-xl);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 1000;
      display: flex;
      flex-direction: column;
    }

    .info-sidebar.open {
      transform: translateX(0);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4) var(--spacing-5);
      border-bottom: 1px solid var(--border-color);
    }

    .item-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-normal);
    }

    .item-icon.icon-dashboard {
      background: rgba(var(--color-primary-rgb), 0.15);
      color: var(--color-primary-light);
    }

    .item-icon.icon-chart {
      background: rgba(var(--color-warning-rgb), 0.15);
      color: var(--color-warning);
    }

    .item-icon.icon-query {
      background: rgba(var(--color-success-rgb), 0.15);
      color: var(--color-success);
    }

    .close-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-normal);
    }

    .close-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-5);
    }

    .item-header {
      margin-bottom: var(--spacing-4);
    }

    .item-name {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-2) 0;
      line-height: 1.3;
    }

    .item-type-badge {
      display: inline-block;
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .item-description {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0 0 var(--spacing-6) 0;
    }

    .item-description.empty {
      color: var(--text-muted);
      font-style: italic;
    }

    .metadata-section {
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      padding: var(--spacing-4);
    }

    .section-title {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 var(--spacing-3) 0;
    }

    .metadata-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-3);
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    }

    .meta-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .meta-value {
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      font-weight: var(--font-weight-medium);
    }

    .meta-value.id-value {
      font-family: monospace;
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
    }

    .sidebar-actions {
      padding: var(--spacing-4) var(--spacing-5);
      border-top: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
    }

    .sidebar-actions app-button {
      width: 100%;
    }

    .danger-btn {
      --btn-color: var(--color-danger);
    }

    .danger-btn:hover {
      background: rgba(var(--color-danger-rgb), 0.1);
    }

    @media (max-width: 480px) {
      .info-sidebar {
        width: 100vw;
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

  truncateId(id: string): string {
    if (id.length <= 12) return id;
    return `${id.slice(0, 8)}...`;
  }

  onOpen() {
    if (this.item) {
      this.openRequested.emit(this.item);
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
