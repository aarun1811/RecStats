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
      margin-bottom: var(--spacing-6);
    }

    .section-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .section-header:hover {
      background: var(--bg-tertiary);
      border-color: rgba(var(--color-primary-rgb), 0.3);
    }

    .collapsible-section:not(.collapsed) .section-header {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: transparent;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
    }

    .section-icon {
      color: var(--color-primary);
    }

    .section-title {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
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
    }

    .toggle-icon {
      color: var(--text-muted);
      transition: transform var(--transition-normal);
    }

    .section-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-top: none;
      border-bottom-left-radius: var(--radius-lg);
      border-bottom-right-radius: var(--radius-lg);
      overflow: hidden;
      max-height: 1000px;
      transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
    }

    .section-content.hidden {
      max-height: 0;
      opacity: 0;
      border: none;
    }

    .content-inner {
      padding: var(--spacing-4);
    }

    // Animation for smooth collapse
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
