import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-interaction-hint',
  template: `
    <div class="hint-overlay" *ngIf="showHint" (click)="dismiss()">
      <div class="hint-card" (click)="$event.stopPropagation()">
        <div class="hint-icon">
          <app-icon name="info" [size]="28"></app-icon>
        </div>
        <div class="hint-content">
          <h4>Quick Tip</h4>
          <div class="hint-items">
            <div class="hint-item">
              <div class="action-label">
                <app-icon name="mouse-pointer" [size]="16"></app-icon>
                <span>Single click</span>
              </div>
              <p>View item details in the sidebar</p>
            </div>
            <div class="hint-item">
              <div class="action-label">
                <app-icon name="mouse-pointer-click" [size]="16"></app-icon>
                <span>Double click</span>
              </div>
              <p>Open the item directly</p>
            </div>
          </div>
        </div>
        <app-button variant="primary" size="sm" (click)="dismiss()">
          Got it!
        </app-button>
      </div>
    </div>
  `,
  styles: [`
    .hint-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .hint-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
      padding: var(--spacing-6);
      max-width: 360px;
      margin: var(--spacing-4);
      box-shadow: var(--shadow-xl);
      animation: scaleIn 0.3s ease;
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .hint-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.2), rgba(var(--color-primary-rgb), 0.1));
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary);
      margin: 0 auto var(--spacing-4);
    }

    .hint-content {
      text-align: center;
      margin-bottom: var(--spacing-5);
    }

    .hint-content h4 {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-4) 0;
    }

    .hint-items {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
      text-align: left;
    }

    .hint-item {
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .action-label {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin-bottom: var(--spacing-1);
    }

    .action-label app-icon {
      color: var(--color-primary);
    }

    .hint-item p {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      margin: 0;
      padding-left: calc(16px + var(--spacing-2));
    }

    .hint-card app-button {
      width: 100%;
    }
  `],
  standalone: false
})
export class InteractionHintComponent implements OnInit {
  private static STORAGE_KEY = 'interaction-hint-dismissed';

  showHint = false;

  ngOnInit() {
    // Only show hint if not previously dismissed
    const dismissed = localStorage.getItem(InteractionHintComponent.STORAGE_KEY);
    this.showHint = dismissed !== 'true';
  }

  dismiss() {
    this.showHint = false;
    localStorage.setItem(InteractionHintComponent.STORAGE_KEY, 'true');
  }
}
