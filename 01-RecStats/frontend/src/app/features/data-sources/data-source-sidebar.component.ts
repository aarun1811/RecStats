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
      <!-- Premium Header -->
      <div class="sidebar-header" [class]="'header-' + (dataSource?.type || formData().type)">
        <div class="header-bg"></div>
        <div class="header-content">
          <div class="header-icon-wrap">
            <app-icon [name]="getTypeIcon(dataSource?.type || formData().type)" [size]="26"></app-icon>
          </div>
          <div class="header-text">
            <span class="header-badge">{{ getTypeLabel(dataSource?.type || formData().type) }}</span>
            <h2>{{ getTitle() }}</h2>
          </div>
        </div>
        <button class="close-btn" (click)="close.emit()">
          <app-icon name="x" [size]="20"></app-icon>
        </button>
      </div>

      <!-- VIEW MODE -->
      <div class="sidebar-content" *ngIf="mode === 'view' && dataSource">
        <!-- Status Card - Prominent -->
        <div class="status-card" [class]="dataSource.connection_status">
          <div class="status-visual">
            <div class="status-ring">
              <div class="status-dot"></div>
            </div>
          </div>
          <div class="status-info">
            <span class="status-label">Connection Status</span>
            <span class="status-text">{{ getStatusLabel(dataSource.connection_status) }}</span>
            <span class="status-time" *ngIf="dataSource.last_tested_at">
              Last tested {{ formatDate(dataSource.last_tested_at) }}
            </span>
          </div>
        </div>

        <div class="status-message-box" *ngIf="dataSource.connection_message">
          <app-icon name="info" [size]="14"></app-icon>
          <span>{{ dataSource.connection_message }}</span>
        </div>

        <!-- Info Section -->
        <div class="info-section">
          <div class="info-item">
            <div class="info-label">Name</div>
            <div class="info-value">{{ dataSource.name }}</div>
          </div>

          <div class="info-item" *ngIf="dataSource.description">
            <div class="info-label">Description</div>
            <div class="info-value description">{{ dataSource.description }}</div>
          </div>
        </div>

        <!-- Connection Details Card -->
        <div class="connection-card">
          <div class="card-header">
            <app-icon name="link" [size]="16"></app-icon>
            <span>Connection Details</span>
          </div>
          <div class="card-body">
            <ng-container *ngIf="dataSource.type === 'sqlite'">
              <div class="detail-item">
                <span class="detail-icon">
                  <app-icon name="hard-drive" [size]="14"></app-icon>
                </span>
                <div class="detail-content">
                  <span class="detail-label">Database Path</span>
                  <code class="detail-value">{{ getSqliteConfig()?.database_path || 'Not configured' }}</code>
                </div>
              </div>
            </ng-container>
            <ng-container *ngIf="dataSource.type === 'oracle'">
              <div class="detail-item">
                <span class="detail-icon">
                  <app-icon name="server" [size]="14"></app-icon>
                </span>
                <div class="detail-content">
                  <span class="detail-label">Host</span>
                  <span class="detail-value">{{ getOracleConfig()?.host || '-' }}</span>
                </div>
              </div>
              <div class="detail-item">
                <span class="detail-icon">
                  <app-icon name="hash" [size]="14"></app-icon>
                </span>
                <div class="detail-content">
                  <span class="detail-label">Port</span>
                  <span class="detail-value">{{ getOracleConfig()?.port || 1521 }}</span>
                </div>
              </div>
              <div class="detail-item">
                <span class="detail-icon">
                  <app-icon name="layers" [size]="14"></app-icon>
                </span>
                <div class="detail-content">
                  <span class="detail-label">Service Name</span>
                  <span class="detail-value">{{ getOracleConfig()?.service_name || '-' }}</span>
                </div>
              </div>
              <div class="detail-item">
                <span class="detail-icon">
                  <app-icon name="user" [size]="14"></app-icon>
                </span>
                <div class="detail-content">
                  <span class="detail-label">Username</span>
                  <span class="detail-value">{{ getOracleConfig()?.user || '-' }}</span>
                </div>
              </div>
            </ng-container>
          </div>
        </div>

        <!-- Timestamps -->
        <div class="timestamps-section">
          <div class="timestamp-item">
            <app-icon name="calendar" [size]="12"></app-icon>
            <span>Created {{ formatFullDate(dataSource.created_at) }}</span>
          </div>
          <div class="timestamp-item">
            <app-icon name="clock" [size]="12"></app-icon>
            <span>Updated {{ formatFullDate(dataSource.updated_at) }}</span>
          </div>
        </div>
      </div>

      <!-- EDIT/CREATE MODE - Form -->
      <div class="sidebar-form" *ngIf="mode !== 'view'">
        <div class="form-field">
          <label class="field-label">Name <span class="required">*</span></label>
          <input
            type="text"
            [ngModel]="formData().name"
            (ngModelChange)="updateForm('name', $event)"
            placeholder="My Data Source">
        </div>

        <div class="form-field">
          <label class="field-label">Type <span class="required">*</span></label>
          <select
            [ngModel]="formData().type"
            (ngModelChange)="updateForm('type', $event)"
            [disabled]="mode === 'edit'">
            <option value="sqlite">SQLite</option>
            <option value="oracle">Oracle</option>
          </select>
        </div>

        <div class="form-field">
          <label class="field-label">Description</label>
          <textarea
            [ngModel]="formData().description"
            (ngModelChange)="updateForm('description', $event)"
            rows="2"
            placeholder="Optional description..."></textarea>
        </div>

        <!-- SQLite Fields -->
        <div class="connection-section" *ngIf="formData().type === 'sqlite'">
          <div class="section-header">
            <div class="section-icon sqlite">
              <app-icon name="database" [size]="16"></app-icon>
            </div>
            <span>SQLite Connection</span>
          </div>
          <div class="form-field">
            <label class="field-label">Database Path <span class="required">*</span></label>
            <input
              type="text"
              [ngModel]="formData().database_path"
              (ngModelChange)="updateForm('database_path', $event)"
              placeholder="/path/to/database.db">
            <span class="field-hint">Path to the SQLite database file</span>
          </div>
        </div>

        <!-- Oracle Fields -->
        <div class="connection-section" *ngIf="formData().type === 'oracle'">
          <div class="section-header">
            <div class="section-icon oracle">
              <app-icon name="server" [size]="16"></app-icon>
            </div>
            <span>Oracle Connection</span>
          </div>

          <div class="field-row">
            <div class="form-field">
              <label class="field-label">Host <span class="required">*</span></label>
              <input
                type="text"
                [ngModel]="formData().host"
                (ngModelChange)="updateForm('host', $event)"
                placeholder="hostname or IP">
            </div>
            <div class="form-field port-field">
              <label class="field-label">Port</label>
              <input
                type="number"
                [ngModel]="formData().port"
                (ngModelChange)="updateForm('port', $event)"
                placeholder="1521">
            </div>
          </div>

          <div class="form-field">
            <label class="field-label">Service Name <span class="required">*</span></label>
            <input
              type="text"
              [ngModel]="formData().service_name"
              (ngModelChange)="updateForm('service_name', $event)"
              placeholder="ORCL">
          </div>

          <div class="form-field">
            <label class="field-label">Username <span class="required">*</span></label>
            <input
              type="text"
              [ngModel]="formData().user"
              (ngModelChange)="updateForm('user', $event)"
              placeholder="database user">
          </div>

          <div class="form-field">
            <label class="field-label">Password <span class="required">*</span></label>
            <input
              type="password"
              [ngModel]="formData().password"
              (ngModelChange)="updateForm('password', $event)"
              placeholder="database password">
          </div>
        </div>

        <!-- Test Connection Result -->
        <div class="test-result-card" *ngIf="testResult()" [class]="testResult()!.success ? 'success' : 'error'">
          <div class="result-icon">
            <app-icon [name]="testResult()!.success ? 'check-circle' : 'x-circle'" [size]="20"></app-icon>
          </div>
          <div class="result-content">
            <span class="result-title">{{ testResult()!.success ? 'Connection Successful' : 'Connection Failed' }}</span>
            <span class="result-message">{{ testResult()!.message }}</span>
          </div>
        </div>
      </div>

      <!-- Premium Actions -->
      <div class="sidebar-actions">
        <ng-container *ngIf="mode === 'view'">
          <button class="action-btn test-btn" (click)="testConnection()" [disabled]="testing()">
            <span class="btn-icon" [class.spinning]="testing()">
              <app-icon [name]="testing() ? 'loader' : 'zap'" [size]="18"></app-icon>
            </span>
            <span class="btn-text">{{ testing() ? 'Testing...' : 'Test Connection' }}</span>
          </button>
          <div class="action-row">
            <button class="action-btn primary-btn" (click)="switchToEditMode()">
              <app-icon name="edit" [size]="16"></app-icon>
              <span>Edit</span>
            </button>
            <button class="action-btn danger-btn" (click)="onDelete()">
              <app-icon name="trash" [size]="16"></app-icon>
              <span>Delete</span>
            </button>
          </div>
        </ng-container>
        <ng-container *ngIf="mode !== 'view'">
          <button class="action-btn test-btn" (click)="testConnectionInline()" [disabled]="testing() || !isFormValid()">
            <span class="btn-icon" [class.spinning]="testing()">
              <app-icon [name]="testing() ? 'loader' : 'zap'" [size]="18"></app-icon>
            </span>
            <span class="btn-text">{{ testing() ? 'Testing...' : 'Test Connection' }}</span>
          </button>
          <div class="action-row">
            <button class="action-btn primary-btn" (click)="saveDataSource()" [disabled]="saving() || !isFormValid()">
              <span class="btn-icon" [class.spinning]="saving()">
                <app-icon [name]="saving() ? 'loader' : 'save'" [size]="16"></app-icon>
              </span>
              <span>{{ saving() ? 'Saving...' : (mode === 'create' ? 'Create' : 'Save') }}</span>
            </button>
            <button class="action-btn ghost-btn" (click)="onCancel()">
              <span>Cancel</span>
            </button>
          </div>
        </ng-container>
      </div>
    </aside>
  `,
    styles: [`
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.7; }
    }

    @keyframes ring-pulse {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(2); opacity: 0; }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes float-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .sidebar-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
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
      width: 440px;
      height: 100vh;
      background: linear-gradient(180deg,
        rgba(20, 20, 28, 0.98) 0%,
        rgba(15, 15, 22, 0.99) 100%
      );
      backdrop-filter: blur(20px);
      border-left: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
      z-index: 1000;
      box-shadow:
        -20px 0 60px rgba(0, 0, 0, 0.5),
        -5px 0 20px rgba(0, 0, 0, 0.3);

      &.open {
        transform: translateX(0);
      }
    }

    /* ═══════════════════════════════════════════════════════════
       PREMIUM HEADER
    ═══════════════════════════════════════════════════════════ */
    .sidebar-header {
      position: relative;
      padding: var(--spacing-5) var(--spacing-5);
      overflow: hidden;

      .header-bg {
        position: absolute;
        inset: 0;
        opacity: 0.15;
        background: linear-gradient(135deg,
          var(--header-accent) 0%,
          transparent 60%
        );
      }

      &.header-sqlite {
        --header-accent: #3b82f6;
        .header-icon-wrap {
          background: linear-gradient(145deg, #4f8ff7 0%, #2563eb 50%, #1d4ed8 100%);
          box-shadow:
            0 0 0 1px rgba(59, 130, 246, 0.3),
            0 4px 16px rgba(59, 130, 246, 0.25),
            0 8px 32px rgba(59, 130, 246, 0.15);
        }
        .header-badge {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
      }

      &.header-oracle {
        --header-accent: #f97316;
        .header-icon-wrap {
          background: linear-gradient(145deg, #fb923c 0%, #f97316 50%, #ea580c 100%);
          box-shadow:
            0 0 0 1px rgba(249, 115, 22, 0.3),
            0 4px 16px rgba(249, 115, 22, 0.25),
            0 8px 32px rgba(249, 115, 22, 0.15);
        }
        .header-badge {
          background: rgba(249, 115, 22, 0.15);
          color: #fb923c;
          border: 1px solid rgba(249, 115, 22, 0.25);
        }
      }

      .header-content {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--spacing-4);
      }

      .header-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 12px;
        color: white;
        transition: transform 0.2s ease, box-shadow 0.2s ease;

        &:hover {
          transform: scale(1.02);
        }
      }

      .header-text {
        flex: 1;
        min-width: 0;

        .header-badge {
          display: inline-block;
          padding: 3px 10px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-radius: 20px;
          margin-bottom: 6px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .close-btn {
        position: absolute;
        top: var(--spacing-4);
        right: var(--spacing-4);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
          transform: scale(1.05);
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       CONTENT AREA
    ═══════════════════════════════════════════════════════════ */
    .sidebar-content, .sidebar-form {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-5);

      /* Custom scrollbar */
      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        &:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       STATUS CARD (View Mode)
    ═══════════════════════════════════════════════════════════ */
    .status-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);
      padding: var(--spacing-4);
      border-radius: 16px;
      margin-bottom: var(--spacing-4);
      animation: float-in 0.4s ease-out;
      transition: all 0.3s ease;

      &.connected {
        background: linear-gradient(135deg,
          rgba(34, 197, 94, 0.12) 0%,
          rgba(34, 197, 94, 0.04) 100%
        );
        border: 1px solid rgba(34, 197, 94, 0.2);

        .status-ring {
          border-color: rgba(34, 197, 94, 0.3);
          &::before {
            background: rgba(34, 197, 94, 0.2);
            animation: ring-pulse 2s ease-out infinite;
          }
        }
        .status-dot {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
          animation: pulse 2s ease-in-out infinite;
        }
        .status-text {
          color: #4ade80;
        }
      }

      &.failed {
        background: linear-gradient(135deg,
          rgba(239, 68, 68, 0.12) 0%,
          rgba(239, 68, 68, 0.04) 100%
        );
        border: 1px solid rgba(239, 68, 68, 0.2);

        .status-ring {
          border-color: rgba(239, 68, 68, 0.3);
        }
        .status-dot {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.6);
        }
        .status-text {
          color: #f87171;
        }
      }

      &.not_tested {
        background: linear-gradient(135deg,
          rgba(148, 163, 184, 0.08) 0%,
          rgba(148, 163, 184, 0.02) 100%
        );
        border: 1px solid rgba(148, 163, 184, 0.15);

        .status-ring {
          border-color: rgba(148, 163, 184, 0.2);
        }
        .status-dot {
          background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
        }
        .status-text {
          color: #94a3b8;
        }
      }

      .status-visual {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .status-ring {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid;
        display: flex;
        align-items: center;
        justify-content: center;

        &::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
        }
      }

      .status-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
      }

      .status-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .status-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
        }

        .status-text {
          font-size: 16px;
          font-weight: 600;
        }

        .status-time {
          font-size: 11px;
          color: var(--text-muted);
          opacity: 0.7;
        }
      }
    }

    .status-message-box {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      margin-bottom: var(--spacing-4);
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;

      app-icon {
        flex-shrink: 0;
        margin-top: 2px;
        color: var(--text-muted);
      }
    }

    /* ═══════════════════════════════════════════════════════════
       INFO SECTION
    ═══════════════════════════════════════════════════════════ */
    .info-section {
      margin-bottom: var(--spacing-5);
      animation: float-in 0.4s ease-out 0.1s both;
    }

    .info-item {
      margin-bottom: var(--spacing-4);

      .info-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted);
        margin-bottom: 6px;
      }

      .info-value {
        font-size: 15px;
        color: var(--text-primary);
        font-weight: 500;

        &.description {
          font-weight: 400;
          color: var(--text-secondary);
          line-height: 1.5;
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       CONNECTION CARD
    ═══════════════════════════════════════════════════════════ */
    .connection-card {
      background: linear-gradient(180deg,
        rgba(255, 255, 255, 0.04) 0%,
        rgba(255, 255, 255, 0.01) 100%
      );
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: var(--spacing-4);
      animation: float-in 0.4s ease-out 0.2s both;

      .card-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-3) var(--spacing-4);
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted);
      }

      .card-body {
        padding: var(--spacing-3);
      }

      .detail-item {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-3);
        padding: var(--spacing-2) var(--spacing-2);
        border-radius: 8px;
        transition: background 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .detail-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: rgba(var(--color-primary-rgb), 0.1);
          border-radius: 8px;
          color: var(--color-primary-light);
          flex-shrink: 0;
        }

        .detail-content {
          flex: 1;
          min-width: 0;

          .detail-label {
            display: block;
            font-size: 11px;
            color: var(--text-muted);
            margin-bottom: 2px;
          }

          .detail-value {
            font-size: 13px;
            color: var(--text-primary);
            font-weight: 500;
          }

          code.detail-value {
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 12px;
            background: rgba(var(--color-primary-rgb), 0.1);
            padding: 4px 8px;
            border-radius: 6px;
            display: inline-block;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: var(--color-primary-light);
          }
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       TIMESTAMPS
    ═══════════════════════════════════════════════════════════ */
    .timestamps-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: var(--spacing-3);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      animation: float-in 0.4s ease-out 0.3s both;

      .timestamp-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        font-size: 11px;
        color: var(--text-muted);

        app-icon {
          opacity: 0.5;
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       FORM FIELDS
    ═══════════════════════════════════════════════════════════ */
    .form-field {
      margin-bottom: var(--spacing-4);

      .field-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 8px;

        .required {
          color: #ef4444;
          margin-left: 2px;
        }
      }

      input, select, textarea {
        width: 100%;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        color: var(--text-primary);
        font-size: 14px;
        transition: all 0.2s ease;

        &:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
        }

        &::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      select {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        padding-right: 40px;
      }

      textarea {
        resize: vertical;
        min-height: 72px;
      }

      .field-hint {
        display: block;
        margin-top: 6px;
        font-size: 11px;
        color: var(--text-muted);
        opacity: 0.7;
      }
    }

    .field-row {
      display: flex;
      gap: var(--spacing-3);

      .form-field {
        flex: 1;

        &.port-field {
          flex: 0 0 100px;
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       CONNECTION SECTION (Form Mode)
    ═══════════════════════════════════════════════════════════ */
    .connection-section {
      margin-top: var(--spacing-5);
      padding-top: var(--spacing-4);
      border-top: 1px solid rgba(255, 255, 255, 0.06);

      .section-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-3);
        margin-bottom: var(--spacing-4);

        .section-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          color: white;

          &.sqlite {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            box-shadow: 0 2px 10px rgba(59, 130, 246, 0.3);
          }

          &.oracle {
            background: linear-gradient(135deg, #f97316 0%, #c2410c 100%);
            box-shadow: 0 2px 10px rgba(249, 115, 22, 0.3);
          }
        }

        span {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       TEST RESULT CARD
    ═══════════════════════════════════════════════════════════ */
    .test-result-card {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-3);
      padding: var(--spacing-4);
      border-radius: 12px;
      margin-top: var(--spacing-4);
      animation: float-in 0.3s ease-out;

      &.success {
        background: linear-gradient(135deg,
          rgba(34, 197, 94, 0.12) 0%,
          rgba(34, 197, 94, 0.04) 100%
        );
        border: 1px solid rgba(34, 197, 94, 0.25);

        .result-icon {
          color: #22c55e;
        }
        .result-title {
          color: #4ade80;
        }
      }

      &.error {
        background: linear-gradient(135deg,
          rgba(239, 68, 68, 0.12) 0%,
          rgba(239, 68, 68, 0.04) 100%
        );
        border: 1px solid rgba(239, 68, 68, 0.25);

        .result-icon {
          color: #ef4444;
        }
        .result-title {
          color: #f87171;
        }
      }

      .result-icon {
        flex-shrink: 0;
      }

      .result-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .result-title {
          font-size: 13px;
          font-weight: 600;
        }

        .result-message {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
          word-break: break-word;
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       PREMIUM ACTION BUTTONS
    ═══════════════════════════════════════════════════════════ */
    .sidebar-actions {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
      padding: var(--spacing-5);
      background: linear-gradient(180deg,
        rgba(0, 0, 0, 0.2) 0%,
        rgba(0, 0, 0, 0.4) 100%
      );
      border-top: 1px solid rgba(255, 255, 255, 0.06);

      .action-row {
        display: flex;
        gap: var(--spacing-3);
      }
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      padding: 12px 18px;
      border: none;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s ease;
      flex: 1;

      .btn-icon {
        display: flex;
        align-items: center;

        &.spinning {
          animation: spin 1s linear infinite;
        }
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.test-btn {
        background: linear-gradient(135deg,
          rgba(var(--color-primary-rgb), 0.15) 0%,
          rgba(var(--color-primary-rgb), 0.08) 100%
        );
        border: 1px solid rgba(var(--color-primary-rgb), 0.25);
        color: var(--color-primary-light);

        &:hover:not(:disabled) {
          background: linear-gradient(135deg,
            rgba(var(--color-primary-rgb), 0.25) 0%,
            rgba(var(--color-primary-rgb), 0.12) 100%
          );
          border-color: rgba(var(--color-primary-rgb), 0.4);
          transform: translateY(-1px);
        }
      }

      &.primary-btn {
        background: linear-gradient(135deg,
          var(--color-primary) 0%,
          var(--color-primary-dark, var(--color-primary)) 100%
        );
        color: white;
        box-shadow: 0 4px 15px rgba(var(--color-primary-rgb), 0.3);

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(var(--color-primary-rgb), 0.4);
        }

        &:active:not(:disabled) {
          transform: translateY(0);
        }
      }

      &.ghost-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--text-secondary);

        &:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }
      }

      &.danger-btn {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: #f87171;

        app-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        &:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
          transform: translateY(-1px);
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       RESPONSIVE
    ═══════════════════════════════════════════════════════════ */
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
