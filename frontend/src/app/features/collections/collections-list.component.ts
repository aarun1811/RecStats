import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: string;
  item_count: number;
  created_at: string;
  updated_at: string;
}

interface CollectionForm {
  name: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-collections-list',
  template: `
    <div class="collections-page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <h1>Collections</h1>
          <p class="header-subtitle">Organize your queries, charts, and dashboards</p>
        </div>
        <app-button variant="primary" (click)="openCreateModal()">
          <app-icon name="plus" [size]="18"></app-icon>
          New Collection
        </app-button>
      </div>

      <!-- Loading State -->
      <div class="loading-container" *ngIf="isLoading">
        <app-loading-spinner></app-loading-spinner>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!isLoading && collections.length === 0">
        <div class="empty-icon">
          <app-icon name="folder" [size]="48"></app-icon>
        </div>
        <h3>No collections yet</h3>
        <p>Create your first collection to organize your work</p>
        <app-button variant="primary" (click)="openCreateModal()">
          <app-icon name="plus" [size]="18"></app-icon>
          Create Collection
        </app-button>
      </div>

      <!-- Collections Grid -->
      <div class="collections-grid" *ngIf="!isLoading && collections.length > 0">
        <div
          *ngFor="let collection of collections"
          class="collection-card"
          (click)="openCollection(collection)"
        >
          <div class="card-header">
            <div class="collection-icon" [style.background]="getIconBackground(collection.color)">
              <app-icon name="folder" [size]="24" [style.color]="collection.color"></app-icon>
            </div>
            <button class="card-menu-btn" (click)="onMenuClick($event, collection)" title="More options">
              <app-icon name="more-vertical" [size]="16"></app-icon>
            </button>
          </div>
          <div class="card-content">
            <h3 class="collection-name">{{ collection.name }}</h3>
            <p class="collection-description" *ngIf="collection.description">
              {{ collection.description }}
            </p>
            <div class="collection-meta">
              <span class="item-count">
                <app-icon name="file" [size]="14"></app-icon>
                {{ collection.item_count }} {{ collection.item_count === 1 ? 'item' : 'items' }}
              </span>
              <span class="updated">{{ formatRelativeTime(collection.updated_at) }}</span>
            </div>
          </div>
          <div class="card-accent" [style.background]="collection.color"></div>
        </div>
      </div>

      <!-- Context Menu -->
      <div
        class="context-menu"
        *ngIf="showContextMenu"
        [style.top.px]="contextMenuPosition.y"
        [style.left.px]="contextMenuPosition.x"
        (click)="$event.stopPropagation()"
      >
        <button class="menu-item" (click)="editCollection()">
          <app-icon name="edit" [size]="16"></app-icon>
          Edit
        </button>
        <button class="menu-item danger" (click)="deleteCollection()">
          <app-icon name="trash" [size]="16"></app-icon>
          Delete
        </button>
      </div>

      <!-- Create/Edit Modal -->
      <app-modal
        *ngIf="showModal"
        [title]="editingCollection ? 'Edit Collection' : 'New Collection'"
        (closed)="closeModal()"
      >
        <div class="modal-form">
          <div class="form-group">
            <label for="name">Name</label>
            <app-input
              id="name"
              [(ngModel)]="formData.name"
              placeholder="Enter collection name"
            ></app-input>
          </div>

          <div class="form-group">
            <label for="description">Description (optional)</label>
            <textarea
              id="description"
              class="form-textarea"
              [(ngModel)]="formData.description"
              placeholder="Add a description..."
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Color</label>
            <div class="color-picker">
              <button
                *ngFor="let color of colorOptions"
                class="color-option"
                [class.selected]="formData.color === color"
                [style.background]="color"
                (click)="formData.color = color"
              ></button>
            </div>
          </div>
        </div>

        <div class="modal-actions" modal-actions>
          <app-button variant="secondary" (click)="closeModal()">Cancel</app-button>
          <app-button
            variant="primary"
            (click)="saveCollection()"
            [disabled]="!formData.name.trim()"
          >
            {{ editingCollection ? 'Save Changes' : 'Create Collection' }}
          </app-button>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════════════════════
       ANIMATIONS
    ═══════════════════════════════════════════════════════════ */
    @keyframes contentFade {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
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

    @keyframes contextMenuIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-4px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes softBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    @keyframes trashWiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-10deg); }
      75% { transform: rotate(10deg); }
    }

    @keyframes colorPop {
      0% { transform: scale(1); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1.1); }
    }

    .collections-page {
      max-width: 1400px;
      margin: 0 auto;
      animation: contentFade 350ms ease-out;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-8);
    }

    .header-content h1 {
      font-size: var(--font-size-3xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-2) 0;
    }

    .header-subtitle {
      font-size: var(--font-size-base);
      color: var(--text-secondary);
      margin: 0;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 300px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--spacing-16) var(--spacing-4);
      background: var(--card-bg);
      border: 1px dashed var(--border-color);
      border-radius: var(--radius-xl);
    }

    .empty-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.2), rgba(var(--color-primary-rgb), 0.05));
      border-radius: var(--radius-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary);
      margin-bottom: var(--spacing-4);
      animation: softBounce 3s ease-in-out infinite;

      app-icon {
        filter: drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.4));
      }
    }

    .empty-state h3 {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-2) 0;
    }

    .empty-state p {
      font-size: var(--font-size-base);
      color: var(--text-secondary);
      margin: 0 0 var(--spacing-6) 0;
    }

    .collections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--spacing-6);
    }

    .collection-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
      cursor: pointer;
      transition: all var(--transition-normal);
      position: relative;
      overflow: hidden;
      opacity: 0;
      animation: fadeInStagger 250ms ease-out forwards;
    }

    // Stagger collection cards
    .collection-card:nth-child(1) { animation-delay: 50ms; }
    .collection-card:nth-child(2) { animation-delay: 100ms; }
    .collection-card:nth-child(3) { animation-delay: 150ms; }
    .collection-card:nth-child(4) { animation-delay: 200ms; }
    .collection-card:nth-child(5) { animation-delay: 250ms; }
    .collection-card:nth-child(6) { animation-delay: 300ms; }
    .collection-card:nth-child(7) { animation-delay: 350ms; }
    .collection-card:nth-child(8) { animation-delay: 400ms; }
    .collection-card:nth-child(9) { animation-delay: 450ms; }
    .collection-card:nth-child(10) { animation-delay: 500ms; }

    .collection-card:hover {
      border-color: rgba(var(--color-primary-rgb), 0.3);
      box-shadow: var(--glow-primary);
      transform: translateY(-4px);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--spacing-5) var(--spacing-5) 0;
    }

    .collection-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.25s ease;

      app-icon {
        transition: filter 0.25s ease;
      }
    }

    .collection-card:hover .collection-icon {
      transform: scale(1.1);
      box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.2);

      app-icon {
        filter: drop-shadow(0 0 4px currentColor);
      }
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

    .collection-card:hover .card-menu-btn {
      opacity: 1;
    }

    .card-menu-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .card-content {
      padding: var(--spacing-4) var(--spacing-5) var(--spacing-5);
    }

    .collection-name {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-2) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .collection-description {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      margin: 0 0 var(--spacing-4) 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .collection-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .item-count {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
    }

    .card-accent {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      opacity: 0;
      transition: opacity var(--transition-normal);
    }

    .collection-card:hover .card-accent {
      opacity: 1;
    }

    /* Context Menu */
    .context-menu {
      position: fixed;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-2);
      min-width: 160px;
      box-shadow: var(--shadow-xl);
      z-index: 1000;
      animation: contextMenuIn 150ms ease-out;
      transform-origin: top left;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      width: 100%;
      padding: var(--spacing-3) var(--spacing-4);
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: background var(--transition-fast);

      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }
    }

    .menu-item:hover {
      background: var(--bg-hover);

      app-icon {
        transform: scale(1.15);
      }
    }

    .menu-item.danger {
      color: var(--color-error);
    }

    .menu-item.danger:hover {
      background: rgba(var(--color-error-rgb), 0.1);

      app-icon {
        animation: trashWiggle 0.3s ease-in-out;
      }
    }

    /* Modal Form */
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-5);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
    }

    .form-group label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-primary);
    }

    .form-textarea {
      width: 100%;
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-family: inherit;
      font-size: var(--font-size-sm);
      resize: vertical;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .form-textarea:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);
    }

    .form-textarea::placeholder {
      color: var(--text-muted);
    }

    .color-picker {
      display: flex;
      gap: var(--spacing-3);
      flex-wrap: wrap;
    }

    .color-option {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-full);
      border: 3px solid transparent;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .color-option:hover {
      transform: scale(1.15);
      box-shadow: 0 0 12px currentColor;
    }

    .color-option.selected {
      border-color: var(--text-primary);
      box-shadow: 0 0 0 2px var(--bg-primary), 0 0 16px currentColor;
      animation: colorPop 0.25s ease-out;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-3);
    }

    @media (max-width: 640px) {
      .page-header {
        flex-direction: column;
        gap: var(--spacing-4);
      }

      .collections-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  standalone: false
})
export class CollectionsListComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  collections: Collection[] = [];
  isLoading = true;

  showModal = false;
  editingCollection: Collection | null = null;
  formData: CollectionForm = { name: '', description: '', color: '#3B82F6' };

  showContextMenu = false;
  contextMenuPosition = { x: 0, y: 0 };
  selectedCollection: Collection | null = null;

  colorOptions = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#6B7280', // Gray
  ];

  ngOnInit() {
    this.loadCollections();
    document.addEventListener('click', this.closeContextMenu.bind(this));
  }

  loadCollections() {
    this.isLoading = true;
    this.http.get<Collection[]>(`${environment.apiUrl}/collections`).subscribe({
      next: (collections) => {
        this.collections = collections;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load collections:', err);
        this.isLoading = false;
      }
    });
  }

  openCollection(collection: Collection) {
    this.router.navigate(['/collections', collection.id]);
  }

  openCreateModal() {
    this.editingCollection = null;
    this.formData = { name: '', description: '', color: '#3B82F6' };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingCollection = null;
  }

  saveCollection() {
    if (!this.formData.name.trim()) return;

    const payload = {
      name: this.formData.name.trim(),
      description: this.formData.description.trim() || null,
      color: this.formData.color
    };

    if (this.editingCollection) {
      this.http.put<Collection>(`${environment.apiUrl}/collections/${this.editingCollection.id}`, payload).subscribe({
        next: (updated) => {
          const index = this.collections.findIndex(c => c.id === updated.id);
          if (index !== -1) {
            this.collections[index] = updated;
          }
          this.closeModal();
        },
        error: (err) => console.error('Failed to update collection:', err)
      });
    } else {
      this.http.post<Collection>(`${environment.apiUrl}/collections`, payload).subscribe({
        next: (created) => {
          this.collections.unshift(created);
          this.closeModal();
        },
        error: (err) => console.error('Failed to create collection:', err)
      });
    }
  }

  onMenuClick(event: MouseEvent, collection: Collection) {
    event.stopPropagation();
    this.selectedCollection = collection;
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.showContextMenu = true;
  }

  closeContextMenu() {
    this.showContextMenu = false;
    this.selectedCollection = null;
  }

  editCollection() {
    if (!this.selectedCollection) return;
    this.editingCollection = this.selectedCollection;
    this.formData = {
      name: this.selectedCollection.name,
      description: this.selectedCollection.description || '',
      color: this.selectedCollection.color
    };
    this.showModal = true;
    this.closeContextMenu();
  }

  deleteCollection() {
    if (!this.selectedCollection) return;
    if (!confirm(`Are you sure you want to delete "${this.selectedCollection.name}"?`)) {
      this.closeContextMenu();
      return;
    }

    this.http.delete(`${environment.apiUrl}/collections/${this.selectedCollection.id}`).subscribe({
      next: () => {
        this.collections = this.collections.filter(c => c.id !== this.selectedCollection?.id);
        this.closeContextMenu();
      },
      error: (err) => {
        console.error('Failed to delete collection:', err);
        this.closeContextMenu();
      }
    });
  }

  getIconBackground(color: string): string {
    return `linear-gradient(135deg, ${color}33, ${color}15)`;
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
