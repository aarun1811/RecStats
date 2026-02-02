import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

@Component({
  selector: 'app-collapsible-section',
  template: `
    <div class="collapsible-section" [class.collapsed]="isCollapsed">
      <button class="section-header" (click)="toggle()">
        <div class="header-left">
          <app-icon *ngIf="icon" [name]="icon" [size]="20" class="section-icon"></app-icon>
          <span class="section-title">{{ title }}</span>
          <span class="item-count" *ngIf="itemCount !== undefined">({{ itemCount }})</span>
        </div>
        <div class="header-right">
          <ng-content select="[section-actions]"></ng-content>
          <app-icon
            [name]="isCollapsed ? 'chevron-down' : 'chevron-up'"
            [size]="18"
            class="toggle-icon"
          ></app-icon>
        </div>
      </button>
      <div class="section-content" [class.hidden]="isCollapsed">
        <div class="content-inner">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .collapsible-section {
      position: relative;
    }

    .section-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4) var(--spacing-5);
      background: linear-gradient(
        135deg,
        rgba(var(--color-primary-rgb), 0.08) 0%,
        rgba(var(--color-primary-rgb), 0.03) 50%,
        rgba(var(--color-primary-rgb), 0.06) 100%
      );
      border: 1px solid rgba(var(--color-primary-rgb), 0.15);
      border-radius: var(--radius-xl);
      cursor: pointer;
      transition: all var(--transition-normal);
      position: relative;
      overflow: hidden;
    }

    // Subtle shimmer effect on the header
    .section-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(var(--color-primary-rgb), 0.05),
        transparent
      );
      transition: left 0.5s ease;
    }

    .section-header:hover::before {
      left: 100%;
    }

    .section-header:hover {
      border-color: rgba(var(--color-primary-rgb), 0.3);
      box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.1),
                  inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .collapsible-section:not(.collapsed) .section-header {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: rgba(var(--color-primary-rgb), 0.1);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      position: relative;
      z-index: 1;
    }

    .section-icon {
      color: var(--color-primary);
      filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.3));
    }

    .section-title {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      letter-spacing: 0.01em;
    }

    .item-count {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
      font-weight: var(--font-weight-normal);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      position: relative;
      z-index: 1;
    }

    .toggle-icon {
      color: var(--text-muted);
      transition: transform var(--transition-normal), color var(--transition-normal);
    }

    .section-header:hover .toggle-icon {
      color: var(--color-primary);
    }

    .section-content {
      background: linear-gradient(
        180deg,
        rgba(var(--color-primary-rgb), 0.04) 0%,
        var(--bg-secondary) 100%
      );
      border: 1px solid rgba(var(--color-primary-rgb), 0.15);
      border-top: none;
      border-bottom-left-radius: var(--radius-xl);
      border-bottom-right-radius: var(--radius-xl);
      overflow: hidden;
      max-height: 1000px;
      transition: max-height 0.3s ease, opacity 0.3s ease;
    }

    .section-content.hidden {
      max-height: 0;
      opacity: 0;
      border: none;
    }

    .content-inner {
      padding: var(--spacing-5);
    }

    .collapsible-section.collapsed .section-content {
      max-height: 0;
      padding: 0;
      border: none;
    }
  `],
  standalone: false
})
export class CollapsibleSectionComponent implements OnInit {
  @Input() title!: string;
  @Input() icon?: string;
  @Input() itemCount?: number;
  @Input() defaultCollapsed = false;
  @Input() storageKey?: string; // For persisting state in localStorage

  @Output() toggled = new EventEmitter<boolean>();

  isCollapsed = false;

  ngOnInit() {
    // Check localStorage for persisted state
    if (this.storageKey) {
      const stored = localStorage.getItem(`collapsible-${this.storageKey}`);
      if (stored !== null) {
        this.isCollapsed = stored === 'true';
        return;
      }
    }
    this.isCollapsed = this.defaultCollapsed;
  }

  toggle() {
    this.isCollapsed = !this.isCollapsed;
    this.toggled.emit(this.isCollapsed);

    // Persist state if storageKey provided
    if (this.storageKey) {
      localStorage.setItem(`collapsible-${this.storageKey}`, String(this.isCollapsed));
    }
  }
}
