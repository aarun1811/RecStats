import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-placeholder',
    template: `
    <div class="placeholder-page">
      <div class="placeholder-content">
        <div class="icon-container">
          <svg viewBox="0 0 64 64" fill="none" class="placeholder-icon">
            <rect x="8" y="8" width="48" height="48" rx="12" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/>
            <path d="M24 32h16M32 24v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="title">{{ pageTitle }}</h1>
        <p class="description">{{ pageDescription }}</p>
        <div class="features" *ngIf="features.length > 0">
          <h3>Planned Features:</h3>
          <ul>
            <li *ngFor="let feature of features">{{ feature }}</li>
          </ul>
        </div>
        <button class="back-btn" routerLink="/">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Home
        </button>
      </div>
    </div>
  `,
    styles: [`
    .placeholder-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: calc(100vh - 64px);
      padding: var(--spacing-6);
    }

    .placeholder-content {
      text-align: center;
      max-width: 500px;
    }

    .icon-container {
      margin-bottom: var(--spacing-6);
    }

    .placeholder-icon {
      width: 80px;
      height: 80px;
      color: var(--color-primary);
      opacity: 0.6;
    }

    .title {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-3);
    }

    .description {
      font-size: var(--font-size-md);
      color: var(--text-secondary);
      margin: 0 0 var(--spacing-6);
      line-height: 1.6;
    }

    .features {
      text-align: left;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: var(--spacing-4);
      margin-bottom: var(--spacing-6);

      h3 {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 var(--spacing-3);
      }

      ul {
        margin: 0;
        padding-left: var(--spacing-5);
      }

      li {
        font-size: var(--font-size-sm);
        color: var(--text-primary);
        margin-bottom: var(--spacing-2);

        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-3) var(--spacing-5);
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--color-primary-light);
        transform: translateY(-1px);
      }
    }
  `],
    standalone: false
})
export class PlaceholderComponent {
  private router = inject(Router);

  get pageTitle(): string {
    const path = this.router.url;
    if (path.includes('datasources')) return 'Data Sources';
    if (path.includes('upload')) return 'Upload Files';
    if (path.includes('settings')) return 'Settings';
    return 'Coming Soon';
  }

  get pageDescription(): string {
    const path = this.router.url;
    if (path.includes('datasources')) {
      return 'Connect to external databases and data warehouses to power your analytics.';
    }
    if (path.includes('upload')) {
      return 'Upload CSV, Excel, or Parquet files to analyze in RecStats.';
    }
    if (path.includes('settings')) {
      return 'Configure your RecStats workspace, themes, and preferences.';
    }
    return 'This feature is under development.';
  }

  get features(): string[] {
    const path = this.router.url;
    if (path.includes('datasources')) {
      return [
        'Connect to PostgreSQL, MySQL, Oracle databases',
        'Integrate with data warehouses (Snowflake, BigQuery)',
        'Configure connection pooling and timeouts',
        'Test connections before saving'
      ];
    }
    if (path.includes('upload')) {
      return [
        'Drag & drop file upload',
        'Support for CSV, Excel (.xlsx), Parquet files',
        'Preview data before importing',
        'Map columns and set data types'
      ];
    }
    if (path.includes('settings')) {
      return [
        'Theme customization (dark/light mode)',
        'Default chart colors and styles',
        'Query timeout and result limits',
        'Export and backup configurations'
      ];
    }
    return [];
  }
}
