/**
 * Cross-Filter Indicator Component
 *
 * Visual badge showing cross-filter status on charts:
 * - "Filtering" on source chart
 * - "Filtered by X" on target charts
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';

export type IndicatorType = 'source' | 'filtered' | 'none';

@Component({
  selector: 'app-cross-filter-indicator',
  template: `
    <div
      *ngIf="type !== 'none'"
      class="cross-filter-indicator"
      [class.source]="type === 'source'"
      [class.filtered]="type === 'filtered'"
      [@fadeSlide]
    >
      <div class="indicator-content">
        <!-- Source Indicator -->
        <ng-container *ngIf="type === 'source'">
          <div class="indicator-icon pulse">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </div>
          <span class="indicator-text">Filtering</span>
          <span *ngIf="valueText" class="indicator-value">{{ valueText }}</span>
        </ng-container>

        <!-- Filtered Indicator -->
        <ng-container *ngIf="type === 'filtered'">
          <div class="indicator-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <span class="indicator-text">Filtered by</span>
          <span class="indicator-source">{{ sourceName }}</span>
        </ng-container>

        <!-- Clear Button -->
        <button
          *ngIf="showClear"
          type="button"
          class="clear-btn"
          (click)="onClear($event)"
          title="Clear cross-filter"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .cross-filter-indicator {
      position: absolute;
      top: var(--spacing-2);
      right: var(--spacing-2);
      z-index: 10;
      animation: fadeSlideIn 0.2s ease-out;
    }

    @keyframes fadeSlideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .indicator-content {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      border-radius: var(--radius-full);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      backdrop-filter: blur(8px);
      box-shadow: var(--shadow-sm);
    }

    /* Source Indicator (Filtering) */
    .source .indicator-content {
      background: rgba(var(--color-primary-rgb), 0.9);
      color: white;
    }

    .source .indicator-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .source .indicator-icon.pulse {
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }

    .source .indicator-value {
      padding: 0 var(--spacing-1);
      background: rgba(255, 255, 255, 0.2);
      border-radius: var(--radius-sm);
      max-width: 120px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Filtered Indicator */
    .filtered .indicator-content {
      background: rgba(var(--color-warning-rgb), 0.9);
      color: white;
    }

    .filtered .indicator-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .filtered .indicator-source {
      padding: 0 var(--spacing-1);
      background: rgba(255, 255, 255, 0.2);
      border-radius: var(--radius-sm);
      max-width: 100px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Clear Button */
    .clear-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      padding: 0;
      margin-left: var(--spacing-1);
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: var(--radius-full);
      color: inherit;
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CrossFilterIndicatorComponent {
  @Input() type: IndicatorType = 'none';
  @Input() valueText = '';
  @Input() sourceName = '';
  @Input() showClear = true;

  @Output() clear = new EventEmitter<void>();

  onClear(event: Event): void {
    event.stopPropagation();
    this.clear.emit();
  }
}
