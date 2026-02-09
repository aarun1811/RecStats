import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-item-card',
  template: `
    <div
      class="item-card"
      [class.selected]="isSelected"
      (click)="onClick($event)"
      (dblclick)="onDoubleClick($event)"
    >
      <div class="card-icon" [class]="'icon-' + type">
        <app-icon [name]="iconName" [size]="24"></app-icon>
      </div>
      <div class="card-content">
        <h4 class="card-title">{{ name }}</h4>
        <p class="card-meta">
          <span class="type-label">{{ type | titlecase }}</span>
          <span class="separator">·</span>
          <span class="updated">{{ formatRelativeTime(updatedAt) }}</span>
        </p>
      </div>
      <button
        class="card-menu-btn"
        (click)="onMenuClick($event)"
        title="More options"
      >
        <app-icon name="more-vertical" [size]="16"></app-icon>
      </button>
    </div>
  `,
  styles: [`
    .item-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-4);
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--transition-normal);
      position: relative;
    }

    .item-card:hover {
      border-color: rgba(var(--color-primary-rgb), 0.3);
      box-shadow: var(--glow-primary);
      transform: translateY(-1px);
    }

    .item-card.selected {
      border-color: var(--color-primary);
      box-shadow: var(--glow-primary);
    }

    .card-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all var(--transition-normal);
    }

    .card-icon.icon-dashboard {
      background: rgba(var(--color-primary-rgb), 0.15);
      color: var(--color-primary-light);
    }

    .card-icon.icon-chart {
      background: rgba(var(--color-warning-rgb), 0.15);
      color: var(--color-warning);
    }

    .card-icon.icon-query {
      background: rgba(var(--color-success-rgb), 0.15);
      color: var(--color-success);
    }

    .item-card:hover .card-icon {
      transform: scale(1.05);
    }

    .card-content {
      flex: 1;
      min-width: 0;
    }

    .card-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-1) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin: 0;
    }

    .type-label {
      color: var(--text-secondary);
    }

    .separator {
      opacity: 0.5;
    }

    .card-menu-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: all var(--transition-normal);
    }

    .item-card:hover .card-menu-btn {
      opacity: 1;
    }

    .card-menu-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    // Double-click hint (subtle)
    .item-card::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: var(--radius-lg);
      pointer-events: none;
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .item-card:active::after {
      background: rgba(var(--color-primary-rgb), 0.1);
      opacity: 1;
    }
  `],
  standalone: false
})
export class ItemCardComponent {
  @Input() id!: string;
  @Input() name!: string;
  @Input() type!: 'query' | 'chart' | 'dashboard';
  @Input() description?: string;
  @Input() updatedAt!: string;
  @Input() isSelected = false;

  @Output() selected = new EventEmitter<void>();  // Single click
  @Output() opened = new EventEmitter<void>();    // Double click
  @Output() menuClicked = new EventEmitter<MouseEvent>();

  private clickTimeout: any = null;
  private clickCount = 0;

  get iconName(): string {
    const icons: Record<string, string> = {
      dashboard: 'layout-dashboard',
      chart: 'bar-chart-2',
      query: 'code',
    };
    return icons[this.type] || 'file';
  }

  onClick(event: MouseEvent) {
    event.stopPropagation();
    this.clickCount++;

    if (this.clickCount === 1) {
      this.clickTimeout = setTimeout(() => {
        if (this.clickCount === 1) {
          // Single click - select item to show sidebar
          this.selected.emit();
        }
        this.clickCount = 0;
      }, 250);
    }
  }

  onDoubleClick(event: MouseEvent) {
    event.stopPropagation();
    clearTimeout(this.clickTimeout);
    this.clickCount = 0;
    // Double click - open item
    this.opened.emit();
  }

  onMenuClick(event: MouseEvent) {
    event.stopPropagation();
    this.menuClicked.emit(event);
  }

  formatRelativeTime(dateStr: string): string {
    if (!dateStr) return 'Unknown';

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  }
}
