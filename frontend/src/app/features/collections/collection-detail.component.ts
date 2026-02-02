import { Component, OnInit, inject, HostListener } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface CollectionItem {
  id: string;
  item_id: string;
  item_type: 'query' | 'chart' | 'dashboard';
  item_name: string;
  item_description: string | null;
  added_at: string;
  updated_at: string;
}

interface CollectionDetail {
  id: string;
  name: string;
  description: string | null;
  color: string;
  item_count: number;
  created_at: string;
  updated_at: string;
  items: CollectionItem[];
}

interface SidebarItem {
  id: string;
  name: string;
  type: 'query' | 'chart' | 'dashboard';
  description?: string;
  updated_at?: string;
}

@Component({
  selector: 'app-collection-detail',
  template: `
    <div class="collection-detail-page" [class.sidebar-open]="showSidebar">
      <!-- Breadcrumb -->
      <nav class="breadcrumb">
        <a routerLink="/collections" class="breadcrumb-link">
          <app-icon name="folder" [size]="16"></app-icon>
          Collections
        </a>
        <app-icon name="chevron-right" [size]="14" class="breadcrumb-separator"></app-icon>
        <span class="breadcrumb-current">{{ collection?.name || 'Loading...' }}</span>
      </nav>

      <!-- Loading State -->
      <div class="loading-container" *ngIf="isLoading">
        <app-loading-spinner></app-loading-spinner>
      </div>

      <!-- Collection Content -->
      <div class="collection-content" *ngIf="!isLoading && collection">
        <!-- Header -->
        <div class="collection-header">
          <div class="header-left">
            <div class="collection-icon" [style.background]="getIconBackground(collection.color)">
              <app-icon name="folder" [size]="28" [style.color]="collection.color"></app-icon>
            </div>
            <div class="header-info">
              <h1>{{ collection.name }}</h1>
              <p class="header-meta" *ngIf="collection.description">{{ collection.description }}</p>
              <p class="header-stats">
                {{ collection.item_count }} {{ collection.item_count === 1 ? 'item' : 'items' }}
                <span class="separator">·</span>
                Updated {{ formatRelativeTime(collection.updated_at) }}
              </p>
            </div>
          </div>
          <div class="header-actions">
            <app-button variant="secondary" (click)="editCollection()">
              <app-icon name="edit" [size]="16"></app-icon>
              Edit
            </app-button>
            <app-button variant="danger" (click)="deleteCollection()">
              <app-icon name="trash-2" [size]="16"></app-icon>
              Delete
            </app-button>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="collection.items.length === 0">
          <div class="empty-icon">
            <app-icon name="file-plus" [size]="48"></app-icon>
          </div>
          <h3>No items in this collection</h3>
          <p>Add queries, charts, or dashboards to this collection from their respective pages.</p>
        </div>

        <!-- Items Grid -->
        <div class="items-grid" *ngIf="collection.items.length > 0">
          <app-item-card
            *ngFor="let item of collection.items"
            [id]="item.item_id"
            [name]="item.item_name"
            [type]="item.item_type"
            [description]="item.item_description ?? undefined"
            [updatedAt]="item.updated_at"
            [isSelected]="selectedItem?.id === item.item_id"
            (selected)="onItemSelect(item)"
            (opened)="onItemOpen(item)"
            (menuClicked)="onItemMenuClick($event, item)"
          ></app-item-card>
        </div>
      </div>

      <!-- Info Sidebar -->
      <app-info-sidebar
        *ngIf="showSidebar && sidebarItem"
        [isOpen]="showSidebar"
        [item]="sidebarItem"
        (close)="closeSidebar()"
        (openRequested)="navigateToItem($event)"
        (editRequested)="editItem($event)"
        (deleteRequested)="removeFromCollection()"
      ></app-info-sidebar>

      <!-- Item Context Menu -->
      <div
        class="context-menu"
        *ngIf="showContextMenu"
        [style.top.px]="contextMenuPosition.y"
        [style.left.px]="contextMenuPosition.x"
        (click)="$event.stopPropagation()"
      >
        <button class="menu-item" (click)="openSelectedItem()">
          <app-icon name="external-link" [size]="16"></app-icon>
          Open
        </button>
        <button class="menu-item danger" (click)="removeFromCollection()">
          <app-icon name="x" [size]="16"></app-icon>
          Remove from collection
        </button>
      </div>

      <!-- Interaction Hint (shows on first visit) -->
      <app-interaction-hint></app-interaction-hint>
    </div>
  `,
  styles: [`
    .collection-detail-page {
      max-width: 1400px;
      margin: 0 auto;
      transition: padding-right var(--transition-normal);
    }

    .collection-detail-page.sidebar-open {
      padding-right: 360px;
    }

    /* Breadcrumb */
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      margin-bottom: var(--spacing-6);
    }

    .breadcrumb-link {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      color: var(--text-secondary);
      text-decoration: none;
      font-size: var(--font-size-sm);
      transition: color var(--transition-fast);
    }

    .breadcrumb-link:hover {
      color: var(--color-primary);
    }

    .breadcrumb-separator {
      color: var(--text-muted);
    }

    .breadcrumb-current {
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
    }

    /* Loading */
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }

    /* Header */
    .collection-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-8);
      padding: var(--spacing-6);
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
    }

    .header-left {
      display: flex;
      gap: var(--spacing-5);
    }

    .collection-icon {
      width: 64px;
      height: 64px;
      border-radius: var(--radius-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .header-info h1 {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-2) 0;
    }

    .header-meta {
      font-size: var(--font-size-base);
      color: var(--text-secondary);
      margin: 0 0 var(--spacing-2) 0;
      max-width: 600px;
    }

    .header-stats {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
      margin: 0;
    }

    .header-stats .separator {
      margin: 0 var(--spacing-2);
      opacity: 0.5;
    }

    .header-actions {
      display: flex;
      gap: var(--spacing-3);
    }

    /* Empty State */
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
      margin: 0;
      max-width: 400px;
    }

    /* Items Grid */
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--spacing-4);
    }

    /* Context Menu */
    .context-menu {
      position: fixed;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-2);
      min-width: 180px;
      box-shadow: var(--shadow-xl);
      z-index: 1000;
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
    }

    .menu-item:hover {
      background: var(--bg-hover);
    }

    .menu-item.danger {
      color: var(--color-error);
    }

    .menu-item.danger:hover {
      background: rgba(var(--color-error-rgb), 0.1);
    }

    @media (max-width: 768px) {
      .collection-detail-page.sidebar-open {
        padding-right: 0;
      }

      .collection-header {
        flex-direction: column;
        gap: var(--spacing-4);
      }

      .header-actions {
        width: 100%;
      }

      .header-actions app-button {
        flex: 1;
      }

      .items-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  standalone: false
})
export class CollectionDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  collection: CollectionDetail | null = null;
  isLoading = true;

  showSidebar = false;
  selectedItem: CollectionItem | null = null;
  sidebarItem: SidebarItem | null = null;

  showContextMenu = false;
  contextMenuPosition = { x: 0, y: 0 };

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.showSidebar) {
      this.closeSidebar();
    }
    if (this.showContextMenu) {
      this.closeContextMenu();
    }
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.closeContextMenu();
  }

  ngOnInit() {
    const collectionId = this.route.snapshot.paramMap.get('id');
    if (collectionId) {
      this.loadCollection(collectionId);
    }
  }

  loadCollection(id: string) {
    this.isLoading = true;
    this.http.get<CollectionDetail>(`${environment.apiUrl}/collections/${id}`).subscribe({
      next: (collection) => {
        this.collection = collection;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load collection:', err);
        this.isLoading = false;
        this.router.navigate(['/collections']);
      }
    });
  }

  onItemSelect(item: CollectionItem) {
    this.selectedItem = item;
    this.sidebarItem = {
      id: item.item_id,
      name: item.item_name,
      type: item.item_type,
      description: item.item_description ?? undefined,
      updated_at: item.updated_at
    };
    this.showSidebar = true;
  }

  onItemOpen(item: CollectionItem) {
    this.navigateToItem({
      id: item.item_id,
      name: item.item_name,
      type: item.item_type,
      description: item.item_description ?? undefined,
      updated_at: item.updated_at
    });
  }

  onItemMenuClick(event: MouseEvent, item: CollectionItem) {
    event.stopPropagation();
    this.selectedItem = item;
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.showContextMenu = true;
  }

  closeContextMenu() {
    this.showContextMenu = false;
  }

  closeSidebar() {
    this.showSidebar = false;
    this.selectedItem = null;
    this.sidebarItem = null;
  }

  navigateToItem(item: SidebarItem) {
    switch (item.type) {
      case 'dashboard':
        this.router.navigate(['/dashboards', item.id]);
        break;
      case 'chart':
        this.router.navigate(['/charts', item.id, 'edit']);
        break;
      case 'query':
        this.router.navigate(['/queries'], { queryParams: { id: item.id } });
        break;
    }
  }

  editItem(item: SidebarItem) {
    this.navigateToItem(item);
  }

  openSelectedItem() {
    if (!this.selectedItem) return;
    this.onItemOpen(this.selectedItem);
    this.closeContextMenu();
  }

  removeFromCollection() {
    if (!this.collection || !this.selectedItem) return;

    this.http.delete(`${environment.apiUrl}/collections/${this.collection.id}/items/${this.selectedItem.item_id}`).subscribe({
      next: () => {
        if (this.collection) {
          this.collection.items = this.collection.items.filter(i => i.item_id !== this.selectedItem?.item_id);
          this.collection.item_count = this.collection.items.length;
        }
        this.closeSidebar();
        this.closeContextMenu();
      },
      error: (err) => console.error('Failed to remove item:', err)
    });
  }

  editCollection() {
    // For now, navigate to collections list and let user edit from there
    // Could also implement inline editing or modal here
    this.router.navigate(['/collections']);
  }

  deleteCollection() {
    if (!this.collection) return;
    if (!confirm(`Are you sure you want to delete "${this.collection.name}"? All items will be removed from this collection.`)) {
      return;
    }

    this.http.delete(`${environment.apiUrl}/collections/${this.collection.id}`).subscribe({
      next: () => {
        this.router.navigate(['/collections']);
      },
      error: (err) => console.error('Failed to delete collection:', err)
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
