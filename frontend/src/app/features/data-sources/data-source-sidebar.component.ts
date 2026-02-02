import { Component, Input, Output, EventEmitter, signal, inject, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { DataSource, DataSourceType, DataSourceCreate, DataSourceUpdate, ConnectionTestResult, SQLiteConfig, OracleConfig } from './data-source.types';

type SidebarMode = 'view' | 'edit' | 'create';

interface FormData {
  name: string;
  type: DataSourceType;
  description: string;
  // SQLite
  database_path: string;
  // Oracle
  host: string;
  port: number;
  service_name: string;
  user: string;
  password: string;
}

@Component({
    selector: 'app-data-source-sidebar',
    template: `
    <div class="sidebar-overlay" [class.open]="isOpen" (click)="close.emit()"></div>
    <aside class="data-source-sidebar" [class.open]="isOpen">
      <!-- Header -->
      <div class="sidebar-header">
        <h2>{{ getTitle() }}</h2>
        <button class="close-btn" (click)="close.emit()">
          <app-icon name="x" [size]="20"></app-icon>
        </button>
      </div>

      <!-- VIEW MODE -->
      <div class="sidebar-content" *ngIf="mode === 'view' && dataSource">
        <div class="detail-section">
          <label>Name</label>
          <p class="detail-value">{{ dataSource.name }}</p>
        </div>

        <div class="detail-section">
          <label>Type</label>
          <span class="type-badge" [class]="'type-' + dataSource.type">
            <app-icon [name]="getTypeIcon(dataSource.type)" [size]="14"></app-icon>
            {{ getTypeLabel(dataSource.type) }}
          </span>
        </div>

        <div class="detail-section" *ngIf="dataSource.description">
          <label>Description</label>
          <p class="detail-value">{{ dataSource.description }}</p>
        </div>

        <div class="detail-section">
          <label>Connection Status</label>
          <div class="status-display" [class]="dataSource.connection_status">
            <span class="status-dot"></span>
            <span class="status-text">{{ getStatusLabel(dataSource.connection_status) }}</span>
          </div>
          <p class="status-message" *ngIf="dataSource.connection_message">
            {{ dataSource.connection_message }}
          </p>
          <p class="last-tested" *ngIf="dataSource.last_tested_at">
            Last tested: {{ formatDate(dataSource.last_tested_at) }}
          </p>
        </div>

        <div class="detail-section">
          <label>Connection Details</label>
          <div class="connection-details">
            <ng-container *ngIf="dataSource.type === 'sqlite'">
              <div class="detail-row">
                <span class="detail-label">Database Path</span>
                <code class="detail-code">{{ getSqliteConfig()?.database_path || 'Not configured' }}</code>
              </div>
            </ng-container>
            <ng-container *ngIf="dataSource.type === 'oracle'">
              <div class="detail-row">
                <span class="detail-label">Host</span>
                <span>{{ getOracleConfig()?.host || '-' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Port</span>
                <span>{{ getOracleConfig()?.port || 1521 }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Service Name</span>
                <span>{{ getOracleConfig()?.service_name || '-' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Username</span>
                <span>{{ getOracleConfig()?.user || '-' }}</span>
              </div>
            </ng-container>
          </div>
        </div>

        <div class="detail-section">
          <label>Timestamps</label>
          <div class="timestamps">
            <p><span>Created:</span> {{ formatFullDate(dataSource.created_at) }}</p>
            <p><span>Updated:</span> {{ formatFullDate(dataSource.updated_at) }}</p>
          </div>
        </div>
      </div>

      <!-- EDIT/CREATE MODE - Form -->
      <div class="sidebar-form" *ngIf="mode !== 'view'">
        <div class="form-group">
          <label>Name <span class="required">*</span></label>
          <input
            type="text"
            [ngModel]="formData().name"
            (ngModelChange)="updateForm('name', $event)"
            placeholder="My Data Source">
        </div>

        <div class="form-group">
          <label>Type <span class="required">*</span></label>
          <select
            [ngModel]="formData().type"
            (ngModelChange)="updateForm('type', $event)"
            [disabled]="mode === 'edit'">
            <option value="sqlite">SQLite</option>
            <option value="oracle">Oracle</option>
          </select>
        </div>

        <div class="form-group">
          <label>Description</label>
          <textarea
            [ngModel]="formData().description"
            (ngModelChange)="updateForm('description', $event)"
            rows="2"
            placeholder="Optional description..."></textarea>
        </div>

        <!-- SQLite Fields -->
        <div class="connection-fields" *ngIf="formData().type === 'sqlite'">
          <h4>Connection Settings</h4>
          <div class="form-group">
            <label>Database Path <span class="required">*</span></label>
            <input
              type="text"
              [ngModel]="formData().database_path"
              (ngModelChange)="updateForm('database_path', $event)"
              placeholder="/path/to/database.db">
            <span class="field-hint">Path to the SQLite database file</span>
          </div>
        </div>

        <!-- Oracle Fields -->
        <div class="connection-fields" *ngIf="formData().type === 'oracle'">
          <h4>Connection Settings</h4>
          <div class="form-row">
            <div class="form-group flex-grow">
              <label>Host <span class="required">*</span></label>
              <input
                type="text"
                [ngModel]="formData().host"
                (ngModelChange)="updateForm('host', $event)"
                placeholder="hostname or IP">
            </div>
            <div class="form-group" style="width: 100px;">
              <label>Port</label>
              <input
                type="number"
                [ngModel]="formData().port"
                (ngModelChange)="updateForm('port', $event)"
                placeholder="1521">
            </div>
          </div>
          <div class="form-group">
            <label>Service Name <span class="required">*</span></label>
            <input
              type="text"
              [ngModel]="formData().service_name"
              (ngModelChange)="updateForm('service_name', $event)"
              placeholder="ORCL">
          </div>
          <div class="form-group">
            <label>Username <span class="required">*</span></label>
            <input
              type="text"
              [ngModel]="formData().user"
              (ngModelChange)="updateForm('user', $event)"
              placeholder="database user">
          </div>
          <div class="form-group">
            <label>Password <span class="required">*</span></label>
            <input
              type="password"
              [ngModel]="formData().password"
              (ngModelChange)="updateForm('password', $event)"
              placeholder="database password">
          </div>
        </div>

        <!-- Test Connection Result -->
        <div class="test-result" *ngIf="testResult()" [class]="testResult()!.success ? 'success' : 'error'">
          <app-icon [name]="testResult()!.success ? 'check-circle' : 'x-circle'" [size]="16"></app-icon>
          <span>{{ testResult()!.message }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="sidebar-actions">
        <ng-container *ngIf="mode === 'view'">
          <app-button variant="secondary" (click)="testConnection()" [disabled]="testing()">
            <app-icon [name]="testing() ? 'loader' : 'zap'" [size]="16"></app-icon>
            {{ testing() ? 'Testing...' : 'Test Connection' }}
          </app-button>
          <div class="action-row">
            <app-button variant="primary" (click)="switchToEditMode()">
              <app-icon name="edit" [size]="16"></app-icon>
              Edit
            </app-button>
            <app-button variant="ghost" class="danger-btn" (click)="onDelete()">
              <app-icon name="trash-2" [size]="16"></app-icon>
              Delete
            </app-button>
          </div>
        </ng-container>
        <ng-container *ngIf="mode !== 'view'">
          <app-button variant="secondary" (click)="testConnectionInline()" [disabled]="testing() || !isFormValid()">
            <app-icon [name]="testing() ? 'loader' : 'zap'" [size]="16"></app-icon>
            {{ testing() ? 'Testing...' : 'Test Connection' }}
          </app-button>
          <div class="action-row">
            <app-button variant="primary" (click)="saveDataSource()" [disabled]="saving() || !isFormValid()">
              <app-icon [name]="saving() ? 'loader' : 'save'" [size]="16"></app-icon>
              {{ saving() ? 'Saving...' : (mode === 'create' ? 'Create' : 'Save') }}
            </app-button>
            <app-button variant="ghost" (click)="onCancel()">
              Cancel
            </app-button>
          </div>
        </ng-container>
      </div>
    </aside>
  `,
    styles: [`
    .sidebar-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      z-index: 999;

      &.open {
        opacity: 1;
        visibility: visible;
      }
    }

    .data-source-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: 420px;
      height: 100vh;
      background: var(--card-bg);
      border-left: 1px solid var(--card-border);
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3);

      &.open {
        transform: translateX(0);
      }
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4) var(--spacing-5);
      border-bottom: 1px solid var(--border-color);
      background: linear-gradient(180deg, rgba(var(--color-primary-rgb), 0.05) 0%, transparent 100%);

      h2 {
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: 600;
        color: var(--text-primary);
      }

      .close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: transparent;
        border: none;
        border-radius: var(--radius-md);
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
      }
    }

    .sidebar-content, .sidebar-form {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-5);
    }

    // View Mode Styles
    .detail-section {
      margin-bottom: var(--spacing-5);

      label {
        display: block;
        font-size: var(--font-size-xs);
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: var(--spacing-2);
      }

      .detail-value {
        margin: 0;
        color: var(--text-primary);
        font-size: var(--font-size-base);
      }
    }

    .type-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      font-size: var(--font-size-sm);
      font-weight: 500;
      border-radius: var(--radius-md);

      &.type-sqlite {
        background: rgba(59, 130, 246, 0.1);
        color: #60a5fa;
      }

      &.type-oracle {
        background: rgba(249, 115, 22, 0.1);
        color: #fb923c;
      }
    }

    .status-display {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      border-radius: var(--radius-md);
      width: fit-content;

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      .status-text {
        font-size: var(--font-size-sm);
        font-weight: 500;
      }

      &.connected {
        background: rgba(var(--color-success-rgb), 0.1);
        color: var(--color-success);
        .status-dot {
          background: var(--color-success);
          box-shadow: 0 0 8px rgba(var(--color-success-rgb), 0.5);
        }
      }

      &.failed {
        background: rgba(var(--color-error-rgb), 0.1);
        color: var(--color-error);
        .status-dot {
          background: var(--color-error);
          box-shadow: 0 0 8px rgba(var(--color-error-rgb), 0.5);
        }
      }

      &.not_tested {
        background: var(--bg-tertiary);
        color: var(--text-muted);
        .status-dot { background: var(--text-muted); }
      }
    }

    .status-message {
      margin: var(--spacing-2) 0 0;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      padding: var(--spacing-2);
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      word-break: break-word;
    }

    .last-tested {
      margin: var(--spacing-2) 0 0;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .connection-details {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--spacing-3);
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-2) 0;
      border-bottom: 1px solid var(--border-color);

      &:last-child {
        border-bottom: none;
      }

      .detail-label {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
      }

      span:last-child {
        font-size: var(--font-size-sm);
        color: var(--text-primary);
      }

      .detail-code {
        font-family: monospace;
        font-size: var(--font-size-xs);
        color: var(--color-primary-light);
        background: var(--bg-tertiary);
        padding: var(--spacing-1) var(--spacing-2);
        border-radius: var(--radius-sm);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .timestamps {
      p {
        margin: 0 0 var(--spacing-1);
        font-size: var(--font-size-sm);
        color: var(--text-secondary);

        span {
          color: var(--text-muted);
          margin-right: var(--spacing-2);
        }
      }
    }

    // Form Styles
    .form-group {
      margin-bottom: var(--spacing-4);

      label {
        display: block;
        font-size: var(--font-size-sm);
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: var(--spacing-2);

        .required {
          color: var(--color-error);
        }
      }

      input, select, textarea {
        width: 100%;
        padding: var(--spacing-3);
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-size: var(--font-size-sm);
        transition: all 0.2s ease;

        &:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
        }

        &::placeholder {
          color: var(--text-muted);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }

      textarea {
        resize: vertical;
        min-height: 60px;
      }

      select {
        cursor: pointer;
      }

      .field-hint {
        display: block;
        margin-top: var(--spacing-1);
        font-size: var(--font-size-xs);
        color: var(--text-muted);
      }
    }

    .connection-fields {
      margin-top: var(--spacing-4);
      padding-top: var(--spacing-4);
      border-top: 1px solid var(--border-color);

      h4 {
        margin: 0 0 var(--spacing-4);
        font-size: var(--font-size-sm);
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    .form-row {
      display: flex;
      gap: var(--spacing-3);

      .flex-grow {
        flex: 1;
      }
    }

    .test-result {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      border-radius: var(--radius-md);
      margin-top: var(--spacing-4);
      font-size: var(--font-size-sm);

      &.success {
        background: rgba(var(--color-success-rgb), 0.1);
        color: var(--color-success);
        border: 1px solid rgba(var(--color-success-rgb), 0.3);
      }

      &.error {
        background: rgba(var(--color-error-rgb), 0.1);
        color: var(--color-error);
        border: 1px solid rgba(var(--color-error-rgb), 0.3);
      }

      span {
        flex: 1;
        word-break: break-word;
      }
    }

    // Actions
    .sidebar-actions {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
      padding: var(--spacing-4) var(--spacing-5);
      border-top: 1px solid var(--border-color);
      background: var(--bg-secondary);

      .action-row {
        display: flex;
        gap: var(--spacing-3);

        app-button {
          flex: 1;
        }
      }

      .danger-btn {
        ::ng-deep button {
          color: var(--color-error);

          &:hover {
            background: rgba(var(--color-error-rgb), 0.1);
          }
        }
      }
    }

    @media (max-width: 768px) {
      .data-source-sidebar {
        width: 100%;
      }
    }
  `],
    standalone: false
})
export class DataSourceSidebarComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() dataSource: DataSource | null = null;
  @Input() mode: SidebarMode = 'view';

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<DataSource>();
  @Output() deleted = new EventEmitter<string>();
  @Output() modeChange = new EventEmitter<SidebarMode>();

  private api = inject(ApiService);
  private notifications = inject(NotificationService);

  // Form state
  formData = signal<FormData>({
    name: '',
    type: 'sqlite',
    description: '',
    database_path: '',
    host: '',
    port: 1521,
    service_name: '',
    user: '',
    password: ''
  });

  testing = signal(false);
  saving = signal(false);
  testResult = signal<ConnectionTestResult | null>(null);

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isOpen) {
      this.close.emit();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['dataSource'] || changes['mode']) {
      this.resetForm();
    }
  }

  resetForm() {
    this.testResult.set(null);

    if (this.mode === 'create') {
      this.formData.set({
        name: '',
        type: 'sqlite',
        description: '',
        database_path: '',
        host: '',
        port: 1521,
        service_name: '',
        user: '',
        password: ''
      });
    } else if (this.dataSource) {
      const config = this.getConnectionConfig() || {};
      this.formData.set({
        name: this.dataSource.name,
        type: this.dataSource.type,
        description: this.dataSource.description || '',
        database_path: (config as SQLiteConfig).database_path || '',
        host: (config as OracleConfig).host || '',
        port: (config as OracleConfig).port || 1521,
        service_name: (config as OracleConfig).service_name || '',
        user: (config as OracleConfig).user || '',
        password: '' // Never prefill password
      });
    }
  }

  updateForm(field: keyof FormData, value: any) {
    this.formData.update(f => ({ ...f, [field]: value }));
    this.testResult.set(null); // Clear test result when form changes
  }

  getTitle(): string {
    switch (this.mode) {
      case 'create': return 'New Data Source';
      case 'edit': return 'Edit Data Source';
      default: return this.dataSource?.name || 'Data Source';
    }
  }

  getTypeIcon(type: DataSourceType): string {
    return type === 'oracle' ? 'server' : 'database';
  }

  getTypeLabel(type: DataSourceType): string {
    return type === 'oracle' ? 'Oracle' : 'SQLite';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'connected': return 'Connected';
      case 'failed': return 'Failed';
      default: return 'Not Tested';
    }
  }

  getConnectionConfig(): SQLiteConfig | OracleConfig | null {
    if (!this.dataSource) return null;
    // Connection config not exposed in response for security
    return null;
  }

  getSqliteConfig(): SQLiteConfig | null {
    // In a real app, this would parse from dataSource
    // For now, connection configs aren't exposed in API response
    return null;
  }

  getOracleConfig(): OracleConfig | null {
    // In a real app, this would parse from dataSource
    // For now, connection configs aren't exposed in API response
    return null;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  formatFullDate(dateStr: string): string {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleString();
  }

  isFormValid(): boolean {
    const form = this.formData();
    if (!form.name.trim()) return false;

    if (form.type === 'sqlite') {
      return !!form.database_path.trim();
    } else {
      return !!(form.host.trim() && form.service_name.trim() && form.user.trim() && form.password.trim());
    }
  }

  buildConnectionConfig(): SQLiteConfig | OracleConfig {
    const form = this.formData();
    if (form.type === 'sqlite') {
      return { database_path: form.database_path };
    } else {
      return {
        host: form.host,
        port: form.port,
        service_name: form.service_name,
        user: form.user,
        password: form.password
      };
    }
  }

  // Actions
  switchToEditMode() {
    this.mode = 'edit';
    this.modeChange.emit('edit');
    this.resetForm();
  }

  onCancel() {
    if (this.mode === 'edit' && this.dataSource) {
      this.mode = 'view';
      this.modeChange.emit('view');
      this.resetForm();
    } else {
      this.close.emit();
    }
  }

  onDelete() {
    if (this.dataSource) {
      this.deleted.emit(this.dataSource.id);
    }
  }

  testConnection() {
    if (!this.dataSource) return;

    this.testing.set(true);
    this.api.post<ConnectionTestResult>(`/datasources/${this.dataSource.id}/test`, {}).subscribe({
      next: (result) => {
        this.testResult.set(result);
        this.testing.set(false);
        // Refresh data source to get updated status
        this.api.get<DataSource>(`/datasources/${this.dataSource!.id}`).subscribe({
          next: (ds) => this.saved.emit(ds)
        });
        if (result.success) {
          this.notifications.success('Connection successful');
        } else {
          this.notifications.error('Connection failed');
        }
      },
      error: (err) => {
        console.error('Test connection failed:', err);
        this.testResult.set({ success: false, message: 'Failed to test connection' });
        this.testing.set(false);
      }
    });
  }

  testConnectionInline() {
    this.testing.set(true);
    const form = this.formData();
    const payload: DataSourceCreate = {
      name: form.name,
      type: form.type,
      description: form.description || undefined,
      connection_config: this.buildConnectionConfig()
    };

    this.api.post<ConnectionTestResult>('/datasources/test-inline', payload).subscribe({
      next: (result) => {
        this.testResult.set(result);
        this.testing.set(false);
        if (result.success) {
          this.notifications.success('Connection successful');
        }
      },
      error: (err) => {
        console.error('Test connection failed:', err);
        this.testResult.set({ success: false, message: 'Failed to test connection' });
        this.testing.set(false);
      }
    });
  }

  saveDataSource() {
    if (!this.isFormValid()) return;

    this.saving.set(true);
    const form = this.formData();

    if (this.mode === 'create') {
      const payload: DataSourceCreate = {
        name: form.name,
        type: form.type,
        description: form.description || undefined,
        connection_config: this.buildConnectionConfig()
      };

      this.api.post<DataSource>('/datasources', payload).subscribe({
        next: (ds) => {
          this.notifications.success(`Data source "${ds.name}" created`);
          this.saving.set(false);
          this.saved.emit(ds);
          this.close.emit();
        },
        error: (err) => {
          console.error('Failed to create data source:', err);
          this.notifications.error('Failed to create data source');
          this.saving.set(false);
        }
      });
    } else if (this.dataSource) {
      const payload: DataSourceUpdate = {
        name: form.name,
        description: form.description || undefined,
        connection_config: this.buildConnectionConfig()
      };

      this.api.put<DataSource>(`/datasources/${this.dataSource.id}`, payload).subscribe({
        next: (ds) => {
          this.notifications.success(`Data source "${ds.name}" updated`);
          this.saving.set(false);
          this.saved.emit(ds);
        },
        error: (err) => {
          console.error('Failed to update data source:', err);
          this.notifications.error('Failed to update data source');
          this.saving.set(false);
        }
      });
    }
  }
}
