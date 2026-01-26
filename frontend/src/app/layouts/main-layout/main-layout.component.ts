import { Component, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-main-layout',
  template: `
    <div class="layout" [class.sidebar-collapsed]="sidebarCollapsed">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <div class="logo-icon">
              <svg viewBox="0 0 32 32" fill="none">
                <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#logo-gradient)"/>
                <path d="M9 22V14L12 10L16 16L20 8L23 14V22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <defs>
                  <linearGradient id="logo-gradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#0066b2"/>
                    <stop offset="1" stop-color="#3399cc"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span class="logo-text" *ngIf="!sidebarCollapsed">ResStats</span>
          </div>
          <button class="collapse-btn" (click)="toggleSidebar()">
            <app-icon [name]="sidebarCollapsed ? 'chevron-right' : 'chevron-left'" [size]="18"></app-icon>
          </button>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section">
            <span class="nav-section-title" *ngIf="!sidebarCollapsed">Main</span>
            <a
              *ngFor="let item of mainNavItems"
              [routerLink]="item.route"
              routerLinkActive="active"
              class="nav-item"
              [title]="sidebarCollapsed ? item.label : ''"
            >
              <app-icon [name]="item.icon" [size]="20"></app-icon>
              <span class="nav-label" *ngIf="!sidebarCollapsed">{{ item.label }}</span>
              <span *ngIf="item.badge && !sidebarCollapsed" class="nav-badge">{{ item.badge }}</span>
            </a>
          </div>

          <div class="nav-section">
            <span class="nav-section-title" *ngIf="!sidebarCollapsed">Build</span>
            <a
              *ngFor="let item of buildNavItems"
              [routerLink]="item.route"
              routerLinkActive="active"
              class="nav-item"
              [title]="sidebarCollapsed ? item.label : ''"
            >
              <app-icon [name]="item.icon" [size]="20"></app-icon>
              <span class="nav-label" *ngIf="!sidebarCollapsed">{{ item.label }}</span>
            </a>
          </div>
        </nav>

        <div class="sidebar-footer">
          <button class="theme-toggle" (click)="toggleTheme()" [title]="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
            <app-icon [name]="isDark ? 'sun' : 'moon'" [size]="20"></app-icon>
            <span *ngIf="!sidebarCollapsed">{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="main-wrapper">
        <!-- Header -->
        <header class="header">
          <div class="header-left">
            <button class="mobile-menu-btn" (click)="toggleSidebar()">
              <app-icon name="menu" [size]="24"></app-icon>
            </button>
            <div class="breadcrumb">
              <span class="breadcrumb-item">ResStats</span>
              <app-icon name="chevron-right" [size]="16"></app-icon>
              <span class="breadcrumb-item active">Dashboard</span>
            </div>
          </div>
          <div class="header-right">
            <div class="search-box">
              <app-icon name="search" [size]="18"></app-icon>
              <input type="text" placeholder="Search dashboards, charts..." />
            </div>
            <button class="header-btn">
              <app-icon name="refresh" [size]="20"></app-icon>
            </button>
            <button class="header-btn">
              <app-icon name="settings" [size]="20"></app-icon>
            </button>
            <div class="user-avatar">
              <span>U</span>
            </div>
          </div>
        </header>

        <!-- Page Content -->
        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <!-- Notification Container -->
    <app-notification-container></app-notification-container>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
      background: var(--bg-primary);
    }

    // ========================================
    // SIDEBAR
    // ========================================
    .sidebar {
      width: var(--sidebar-width);
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: var(--z-fixed);
      transition: width var(--transition-normal);
    }

    .sidebar-collapsed .sidebar {
      width: var(--sidebar-collapsed-width);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4);
      border-bottom: 1px solid var(--border-color);
      min-height: var(--header-height);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
    }

    .logo-icon {
      width: 36px;
      height: 36px;
      flex-shrink: 0;

      svg {
        width: 100%;
        height: 100%;
      }
    }

    .logo-text {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      white-space: nowrap;
    }

    .collapse-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--color-primary);
      }
    }

    .sidebar-collapsed .collapse-btn {
      display: none;
    }

    .sidebar-nav {
      flex: 1;
      padding: var(--spacing-4);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-6);
    }

    .nav-section {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    }

    .nav-section-title {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: var(--spacing-2) var(--spacing-3);
      margin-bottom: var(--spacing-1);
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      text-decoration: none;
      transition: all var(--transition-fast);
      position: relative;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      &.active {
        background: rgba(var(--color-primary-rgb), 0.15);
        color: var(--color-primary-light);

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          background: var(--color-primary);
          border-radius: 0 var(--radius-full) var(--radius-full) 0;
        }
      }
    }

    .sidebar-collapsed .nav-item {
      justify-content: center;
      padding: var(--spacing-3);

      &.active::before {
        display: none;
      }
    }

    .nav-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      white-space: nowrap;
    }

    .nav-badge {
      margin-left: auto;
      padding: 2px 8px;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      background: var(--color-primary);
      color: white;
      border-radius: var(--radius-full);
    }

    .sidebar-footer {
      padding: var(--spacing-4);
      border-top: 1px solid var(--border-color);
    }

    .theme-toggle {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      width: 100%;
      padding: var(--spacing-3);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--color-primary);
        box-shadow: var(--glow-primary);
      }
    }

    .sidebar-collapsed .theme-toggle {
      justify-content: center;
    }

    // ========================================
    // MAIN WRAPPER
    // ========================================
    .main-wrapper {
      flex: 1;
      margin-left: var(--sidebar-width);
      display: flex;
      flex-direction: column;
      transition: margin-left var(--transition-normal);
    }

    .sidebar-collapsed .main-wrapper {
      margin-left: var(--sidebar-collapsed-width);
    }

    // ========================================
    // HEADER
    // ========================================
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--header-height);
      padding: 0 var(--spacing-6);
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
    }

    .mobile-menu-btn {
      display: none;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .breadcrumb-item {
      font-size: var(--font-size-sm);
      color: var(--text-muted);

      &.active {
        color: var(--text-primary);
        font-weight: var(--font-weight-medium);
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-4);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);

      &:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);
      }

      app-icon {
        color: var(--text-muted);
      }

      input {
        background: transparent;
        border: none;
        outline: none;
        font-size: var(--font-size-sm);
        color: var(--text-primary);
        width: 200px;

        &::placeholder {
          color: var(--text-muted);
        }
      }
    }

    .header-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .user-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
      border-radius: var(--radius-full);
      color: white;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      cursor: pointer;
      transition: box-shadow var(--transition-fast);

      &:hover {
        box-shadow: var(--glow-primary);
      }
    }

    // ========================================
    // MAIN CONTENT
    // ========================================
    .main-content {
      flex: 1;
      padding: var(--spacing-6);
      overflow-y: auto;
    }

    // ========================================
    // RESPONSIVE
    // ========================================
    @media (max-width: 1024px) {
      .sidebar {
        transform: translateX(-100%);
      }

      .sidebar-collapsed .sidebar {
        transform: translateX(0);
        width: var(--sidebar-width);
      }

      .main-wrapper,
      .sidebar-collapsed .main-wrapper {
        margin-left: 0;
      }

      .mobile-menu-btn {
        display: flex;
      }

      .search-box input {
        width: 150px;
      }
    }

    @media (max-width: 640px) {
      .header {
        padding: 0 var(--spacing-4);
      }

      .search-box {
        display: none;
      }

      .main-content {
        padding: var(--spacing-4);
      }
    }
  `]
})
export class MainLayoutComponent {
  private themeService = inject(ThemeService);

  sidebarCollapsed = false;

  mainNavItems: NavItem[] = [
    { icon: 'dashboard', label: 'Dashboards', route: '/dashboards', badge: 5 },
    { icon: 'chart-bar', label: 'Charts', route: '/charts' },
    { icon: 'code', label: 'Query Editor', route: '/queries' },
  ];

  buildNavItems: NavItem[] = [
    { icon: 'database', label: 'Data Sources', route: '/datasources' },
    { icon: 'upload', label: 'Upload Files', route: '/upload' },
    { icon: 'settings', label: 'Settings', route: '/settings' },
  ];

  get isDark(): boolean {
    return this.themeService.isDark();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
