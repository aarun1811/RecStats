import { Component, Output, EventEmitter, ElementRef, ViewChild, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

export interface SearchResult {
  id: string;
  name: string;
  description?: string;
  type: 'query' | 'chart' | 'dashboard';
  updated_at: string;
  route: string;
}

@Component({
  selector: 'app-search-bar',
  template: `
    <div class="search-container" [class.open]="showDropdown" [class.focused]="isFocused">
      <div class="search-input-wrapper">
        <app-icon name="search" [size]="18" class="search-icon"></app-icon>
        <input
          #searchInput
          type="text"
          class="search-input"
          placeholder="Search queries, charts, dashboards..."
          [(ngModel)]="searchTerm"
          (input)="onSearchInput()"
          (focus)="onFocus()"
          (blur)="onBlur()"
          (keydown)="onKeydown($event)"
        />
        <span class="shortcut-hint" *ngIf="!isFocused && !searchTerm">
          <kbd>Ctrl</kbd><kbd>K</kbd>
        </span>
        <button
          class="clear-btn"
          *ngIf="searchTerm"
          (click)="clearSearch()"
          title="Clear search"
        >
          <app-icon name="x" [size]="16"></app-icon>
        </button>
      </div>

      <div class="search-dropdown" *ngIf="showDropdown && (results.length > 0 || isLoading || searchTerm)">
        <div class="loading-state" *ngIf="isLoading">
          <app-loading-spinner size="sm" variant="dots"></app-loading-spinner>
          <span>Searching...</span>
        </div>

        <div class="no-results" *ngIf="!isLoading && searchTerm && results.length === 0">
          <app-icon name="search" [size]="24"></app-icon>
          <span>No results found for "{{ searchTerm }}"</span>
        </div>

        <div class="results-list" *ngIf="!isLoading && results.length > 0">
          <div
            *ngFor="let group of groupedResults"
            class="result-group"
          >
            <div class="group-header">
              <app-icon [name]="getIconForType(group.type)" [size]="14"></app-icon>
              {{ group.type | titlecase }}s
            </div>
            <div
              *ngFor="let item of group.items; let i = index"
              class="result-item"
              [class.selected]="getGlobalIndex(group.type, i) === selectedIndex"
              (click)="selectItem(item)"
              (mouseenter)="selectedIndex = getGlobalIndex(group.type, i)"
            >
              <div class="result-icon" [class]="'icon-' + item.type">
                <app-icon [name]="getIconForType(item.type)" [size]="16"></app-icon>
              </div>
              <div class="result-content">
                <span class="result-name">{{ item.name }}</span>
                <span class="result-meta" *ngIf="item.description">{{ truncate(item.description, 50) }}</span>
              </div>
              <app-icon name="arrow-right" [size]="14" class="result-arrow"></app-icon>
            </div>
          </div>
        </div>

        <div class="dropdown-footer">
          <span class="hint-text">
            <kbd>↑</kbd><kbd>↓</kbd> to navigate
            <kbd>Enter</kbd> to select
            <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .search-container {
      position: relative;
      width: 320px;
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: var(--spacing-3);
      color: var(--text-muted);
      pointer-events: none;
      transition: color var(--transition-normal);
    }

    .search-container.focused .search-icon {
      color: var(--color-primary);
    }

    .search-input {
      width: 100%;
      height: 40px;
      padding: 0 var(--spacing-10) 0 var(--spacing-10);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      transition: all var(--transition-normal);
    }

    .search-input::placeholder {
      color: var(--text-muted);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
    }

    .shortcut-hint {
      position: absolute;
      right: var(--spacing-3);
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      pointer-events: none;
    }

    .shortcut-hint kbd {
      padding: 2px 6px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      font-family: inherit;
      color: var(--text-muted);
    }

    .clear-btn {
      position: absolute;
      right: var(--spacing-2);
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-normal);
    }

    .clear-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .search-dropdown {
      position: absolute;
      top: calc(100% + var(--spacing-2));
      left: 0;
      right: 0;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      overflow: hidden;
      z-index: 1000;
      animation: dropdownIn 0.2s ease;
    }

    @keyframes dropdownIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .loading-state,
    .no-results {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
      padding: var(--spacing-6);
      color: var(--text-muted);
      font-size: var(--font-size-sm);
    }

    .results-list {
      max-height: 360px;
      overflow-y: auto;
    }

    .result-group {
      padding: var(--spacing-2) 0;
    }

    .result-group:not(:last-child) {
      border-bottom: 1px solid var(--border-color);
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-4);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3) var(--spacing-4);
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .result-item:hover,
    .result-item.selected {
      background: var(--bg-hover);
    }

    .result-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .result-icon.icon-dashboard {
      background: rgba(var(--color-primary-rgb), 0.15);
      color: var(--color-primary-light);
    }

    .result-icon.icon-chart {
      background: rgba(var(--color-warning-rgb), 0.15);
      color: var(--color-warning);
    }

    .result-icon.icon-query {
      background: rgba(var(--color-success-rgb), 0.15);
      color: var(--color-success);
    }

    .result-content {
      flex: 1;
      min-width: 0;
    }

    .result-name {
      display: block;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .result-meta {
      display: block;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .result-arrow {
      color: var(--text-muted);
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .result-item:hover .result-arrow,
    .result-item.selected .result-arrow {
      opacity: 1;
    }

    .dropdown-footer {
      padding: var(--spacing-2) var(--spacing-4);
      border-top: 1px solid var(--border-color);
      background: var(--bg-secondary);
    }

    .hint-text {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .hint-text kbd {
      padding: 2px 5px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 10px;
      font-family: inherit;
    }

    @media (max-width: 640px) {
      .search-container {
        width: 100%;
      }

      .shortcut-hint {
        display: none;
      }
    }
  `],
  standalone: false
})
export class SearchBarComponent implements OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @Output() itemSelected = new EventEmitter<SearchResult>();

  private router = inject(Router);
  private api = inject(ApiService);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  searchTerm = '';
  results: SearchResult[] = [];
  isLoading = false;
  showDropdown = false;
  isFocused = false;
  selectedIndex = 0;

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.performSearch(term);
    });

    // Global keyboard shortcut
    document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('keydown', this.handleGlobalKeydown.bind(this));
  }

  private handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    }
  }

  get groupedResults(): { type: string; items: SearchResult[] }[] {
    const groups: Record<string, SearchResult[]> = {};

    for (const result of this.results) {
      if (!groups[result.type]) {
        groups[result.type] = [];
      }
      groups[result.type].push(result);
    }

    return Object.entries(groups).map(([type, items]) => ({ type, items }));
  }

  getIconForType(type: string): string {
    const icons: Record<string, string> = {
      dashboard: 'layout-dashboard',
      chart: 'bar-chart-2',
      query: 'code',
    };
    return icons[type] || 'file';
  }

  getGlobalIndex(type: string, localIndex: number): number {
    let globalIndex = 0;
    for (const group of this.groupedResults) {
      if (group.type === type) {
        return globalIndex + localIndex;
      }
      globalIndex += group.items.length;
    }
    return 0;
  }

  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  onSearchInput() {
    this.searchSubject.next(this.searchTerm);
    this.selectedIndex = 0;
  }

  onFocus() {
    this.isFocused = true;
    if (this.searchTerm || this.results.length > 0) {
      this.showDropdown = true;
    }
  }

  onBlur() {
    this.isFocused = false;
    // Delay hiding dropdown to allow click events
    setTimeout(() => {
      if (!this.isFocused) {
        this.showDropdown = false;
      }
    }, 200);
  }

  onKeydown(event: KeyboardEvent) {
    if (!this.showDropdown || this.results.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.results[this.selectedIndex]) {
          this.selectItem(this.results[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.showDropdown = false;
        this.searchInput?.nativeElement?.blur();
        break;
    }
  }

  clearSearch() {
    this.searchTerm = '';
    this.results = [];
    this.showDropdown = false;
    this.searchInput?.nativeElement?.focus();
  }

  selectItem(item: SearchResult) {
    this.itemSelected.emit(item);
    this.router.navigateByUrl(item.route);
    this.showDropdown = false;
    this.searchTerm = '';
    this.results = [];
  }

  private async performSearch(term: string) {
    if (!term || term.length < 2) {
      this.results = [];
      this.showDropdown = this.isFocused && term.length > 0;
      return;
    }

    this.isLoading = true;
    this.showDropdown = true;

    try {
      const response = await this.api.get<SearchResult[]>('/search', { q: term, limit: 15 }).toPromise();
      this.results = response || [];
    } catch (error) {
      console.error('Search failed:', error);
      this.results = [];
    } finally {
      this.isLoading = false;
    }
  }
}
