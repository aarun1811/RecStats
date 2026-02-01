import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  badge?: number;
  exactMatch?: boolean;
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
            <span class="logo-text" *ngIf="!sidebarCollapsed">RecStats</span>
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
              [routerLinkActiveOptions]="{ exact: item.exactMatch || false }"
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
              <span class="breadcrumb-item">RecStats</span>
              <app-icon name="chevron-right" [size]="16"></app-icon>
              <span class="breadcrumb-item active">{{ currentPageTitle }}</span>
            </div>
          </div>
          <div class="header-right">
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
    // SIDEBAR - Enhanced with Glassmorphism
    // ========================================
    .sidebar {
      width: var(--sidebar-width);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-right: 1px solid var(--glass-border);
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
      border-bottom: 1px solid var(--glass-border);
      min-height: var(--header-height);
      background: var(--gradient-glow);
      position: relative;

      // Subtle gradient border at bottom
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: var(--spacing-4);
        right: var(--spacing-4);
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(var(--color-primary-rgb), 0.3), transparent);
      }
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
      transition: filter var(--transition-normal), transform var(--transition-normal);

      svg {
        width: 100%;
        height: 100%;
      }

      &:hover {
        filter: drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.6));
        transform: scale(1.05);
      }
    }

    .logo-text {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      white-space: nowrap;
      background: linear-gradient(135deg, var(--text-primary) 0%, var(--color-primary-light) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
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
        box-shadow: var(--shadow-glow-sm);
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
      position: relative;

      // Subtle gradient line after title
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: var(--spacing-3);
        width: 24px;
        height: 1px;
        background: linear-gradient(90deg, rgba(var(--color-primary-rgb), 0.4), transparent);
      }
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
      outline: none;

      app-icon {
        transition: transform var(--transition-fast), filter var(--transition-fast);
      }

      &:hover {
        background: rgba(var(--color-primary-rgb), 0.08);
        color: var(--text-primary);
        box-shadow: inset 0 0 20px rgba(var(--color-primary-rgb), 0.05);

        app-icon {
          transform: scale(1.1);
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.4));
        }
      }

      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }

      &.active {
        background: linear-gradient(90deg, rgba(var(--color-primary-rgb), 0.2) 0%, rgba(var(--color-primary-rgb), 0.05) 100%);
        color: var(--color-primary-light);
        box-shadow: inset 0 0 20px rgba(var(--color-primary-rgb), 0.1),
                    0 0 15px rgba(var(--color-primary-rgb), 0.15);

        app-icon {
          filter: drop-shadow(0 0 6px rgba(var(--color-primary-rgb), 0.5));
        }

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
          box-shadow: 0 0 10px rgba(var(--color-primary-rgb), 0.6);
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
      background: var(--gradient-primary);
      color: white;
      border-radius: var(--radius-full);
      box-shadow: 0 0 8px rgba(var(--color-primary-rgb), 0.4);
    }

    .sidebar-footer {
      padding: var(--spacing-4);
      border-top: 1px solid var(--glass-border);
      background: var(--gradient-glow-bottom);
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
      overflow: hidden;
      position: relative;

      app-icon {
        transition: transform 0.3s ease, filter var(--transition-fast);
      }

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--color-primary);
        box-shadow: var(--shadow-glow-sm);

        app-icon {
          transform: rotate(15deg);
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.5));
        }
      }

      &:active app-icon {
        transform: rotate(180deg);
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
    // HEADER - Enhanced with subtle glow
    // ========================================
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--header-height);
      padding: 0 var(--spacing-6);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-bottom: 1px solid var(--glass-border);
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);

      // Subtle bottom border glow
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg,
          transparent,
          rgba(var(--color-primary-rgb), 0.2) 20%,
          rgba(var(--color-primary-rgb), 0.3) 50%,
          rgba(var(--color-primary-rgb), 0.2) 80%,
          transparent);
        pointer-events: none;
      }
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
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        box-shadow: var(--shadow-glow-sm);
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
      transition: color var(--transition-fast);

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
        box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15),
                    var(--shadow-glow-sm);
      }

      app-icon {
        color: var(--text-muted);
        transition: color var(--transition-fast);
      }

      &:focus-within app-icon {
        color: var(--color-primary);
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

      app-icon {
        transition: transform 0.3s ease, filter var(--transition-fast);
      }

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);

        app-icon {
          transform: rotate(45deg);
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.4));
        }
      }
    }

    .user-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--gradient-primary);
      border-radius: var(--radius-full);
      color: white;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      cursor: pointer;
      transition: all var(--transition-fast);
      border: 2px solid transparent;

      &:hover {
        transform: scale(1.08);
        box-shadow: var(--shadow-glow-md);
        border-color: rgba(var(--color-primary-rgb), 0.3);
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
  `],
    standalone: false
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private routerSub?: Subscription;

  sidebarCollapsed = false;
  currentPageTitle = 'Home';

  private routeTitles: Record<string, string> = {
    '/': 'Home',
    '/dashboards': 'Dashboards',
    '/charts': 'Charts',
    '/queries': 'Query Editor',
    '/datasources': 'Data Sources',
    '/upload': 'Upload Files',
    '/settings': 'Settings',
  };

  mainNavItems: NavItem[] = [
    { icon: 'home', label: 'Home', route: '/', exactMatch: true },
    { icon: 'layout-dashboard', label: 'Dashboards', route: '/dashboards', badge: 5 },
    { icon: 'bar-chart-2', label: 'Charts', route: '/charts' },
    { icon: 'code', label: 'Query Editor', route: '/queries' },
  ];

  buildNavItems: NavItem[] = [
    { icon: 'database', label: 'Data Sources', route: '/datasources' },
    { icon: 'upload', label: 'Upload Files', route: '/upload' },
    { icon: 'settings', label: 'Settings', route: '/settings' },
  ];

  ngOnInit(): void {
    // Set initial title
    this.updatePageTitle(this.router.url);

    // Subscribe to route changes
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.updatePageTitle(event.urlAfterRedirects);
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private updatePageTitle(url: string): void {
    // Extract base path (e.g., /dashboards/123 -> /dashboards)
    const basePath = '/' + (url.split('/')[1] || '');
    this.currentPageTitle = this.routeTitles[basePath] || this.routeTitles[url] || 'Home';
  }

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
