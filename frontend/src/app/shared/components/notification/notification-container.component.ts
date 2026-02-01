import { Component, inject } from '@angular/core';
import { NotificationService, Notification } from '../../../core/services/notification.service';

@Component({
    selector: 'app-notification-container',
    template: `
    <div class="notification-container">
      <div
        *ngFor="let notification of notifications()"
        [class]="getNotificationClasses(notification)"
        class="notification"
      >
        <div class="notification-icon">
          <!-- Success icon -->
          <svg *ngIf="notification.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <!-- Error icon -->
          <svg *ngIf="notification.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <!-- Warning icon -->
          <svg *ngIf="notification.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <!-- Info icon -->
          <svg *ngIf="notification.type === 'info'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>
        <div class="notification-content">
          <p class="notification-title">{{ notification.title }}</p>
          <p *ngIf="notification.message" class="notification-message">{{ notification.message }}</p>
        </div>
        <button
          *ngIf="notification.dismissible"
          class="notification-close"
          (click)="dismiss(notification.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `,
    styles: [`
    .notification-container {
      position: fixed;
      top: var(--spacing-4);
      right: var(--spacing-4);
      z-index: var(--z-notification);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
      max-width: 400px;
      pointer-events: none;
    }

    .notification {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-3);
      padding: var(--spacing-4);
      background: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      animation: slideInRight 0.3s ease-out;
      pointer-events: auto;
    }

    .notification-success {
      border-left: 4px solid var(--color-success);
      .notification-icon {
        color: var(--color-success);
      }
    }

    .notification-error {
      border-left: 4px solid var(--color-danger);
      .notification-icon {
        color: var(--color-danger);
      }
    }

    .notification-warning {
      border-left: 4px solid var(--color-warning);
      .notification-icon {
        color: var(--color-warning);
      }
    }

    .notification-info {
      border-left: 4px solid var(--color-primary);
      .notification-icon {
        color: var(--color-primary);
      }
    }

    .notification-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;

      svg {
        width: 100%;
        height: 100%;
      }
    }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0;
    }

    .notification-message {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      margin: var(--spacing-1) 0 0 0;
    }

    .notification-close {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      svg {
        width: 16px;
        height: 16px;
      }
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `],
    standalone: false
})
export class NotificationContainerComponent {
  private notificationService = inject(NotificationService);

  notifications = this.notificationService.notifications;

  getNotificationClasses(notification: Notification): string {
    return `notification-${notification.type}`;
  }

  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }
}
