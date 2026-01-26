import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <div *ngIf="isOpen" class="modal-overlay" (click)="onOverlayClick($event)">
      <div [class]="modalClasses" [@modalAnimation]>
        <div class="modal-header" *ngIf="title || showClose">
          <h2 *ngIf="title" class="modal-title">{{ title }}</h2>
          <button *ngIf="showClose" class="modal-close" (click)="close()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
        <div *ngIf="hasFooter" class="modal-footer">
          <ng-content select="[modal-footer]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal-backdrop);
      animation: fadeIn 0.2s ease-out;
      padding: var(--spacing-4);
    }

    .modal {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl), var(--glow-primary);
      max-height: calc(100vh - var(--spacing-8));
      display: flex;
      flex-direction: column;
      animation: scaleIn 0.25s ease-out;
      z-index: var(--z-modal);
    }

    // Size variants
    .modal-sm {
      width: 100%;
      max-width: 400px;
    }

    .modal-md {
      width: 100%;
      max-width: 560px;
    }

    .modal-lg {
      width: 100%;
      max-width: 800px;
    }

    .modal-xl {
      width: 100%;
      max-width: 1100px;
    }

    .modal-fullscreen {
      width: calc(100vw - var(--spacing-8));
      height: calc(100vh - var(--spacing-8));
      max-width: none;
      max-height: none;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-6);
      padding-bottom: 0;
      flex-shrink: 0;
    }

    .modal-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0;
    }

    .modal-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .modal-body {
      padding: var(--spacing-6);
      overflow-y: auto;
      flex: 1;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background: var(--scrollbar-thumb);
        border-radius: var(--radius-full);
      }
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--spacing-3);
      padding: var(--spacing-6);
      padding-top: var(--spacing-4);
      border-top: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `]
})
export class ModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() title?: string;
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen' = 'md';
  @Input() showClose = true;
  @Input() closeOnOverlay = true;
  @Input() closeOnEscape = true;
  @Input() hasFooter = false;

  @Output() closed = new EventEmitter<void>();

  private boundKeyHandler = this.handleKeyDown.bind(this);

  ngOnInit(): void {
    if (this.closeOnEscape) {
      document.addEventListener('keydown', this.boundKeyHandler);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.boundKeyHandler);
  }

  get modalClasses(): string {
    return `modal modal-${this.size}`;
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.closeOnOverlay && event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }
}
