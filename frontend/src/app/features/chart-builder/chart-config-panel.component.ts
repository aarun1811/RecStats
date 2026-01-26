import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-chart-config-panel',
  template: `
    <div class="config-panel">
      <div class="config-section">
        <h4>Chart Settings</h4>
        <div class="config-field">
          <label>Title</label>
          <input type="text" [(ngModel)]="config.title" (ngModelChange)="emitChange()" placeholder="Chart title">
        </div>
        <div class="config-field">
          <label>Subtitle</label>
          <input type="text" [(ngModel)]="config.subtitle" (ngModelChange)="emitChange()" placeholder="Optional subtitle">
        </div>
      </div>

      <div class="config-section">
        <h4>Data Mapping</h4>
        <div class="config-field">
          <label>X-Axis / Category</label>
          <select [(ngModel)]="config.xAxis" (ngModelChange)="emitChange()">
            <option value="">Select field</option>
            <option *ngFor="let col of columns" [value]="col.name">{{ col.name }}</option>
          </select>
        </div>
        <div class="config-field">
          <label>Y-Axis / Value</label>
          <select [(ngModel)]="config.yAxis" (ngModelChange)="emitChange()">
            <option value="">Select field</option>
            <option *ngFor="let col of columns" [value]="col.name">{{ col.name }}</option>
          </select>
        </div>
        <div class="config-field" *ngIf="showGroupBy">
          <label>Group By (Series)</label>
          <select [(ngModel)]="config.groupBy" (ngModelChange)="emitChange()">
            <option value="">None</option>
            <option *ngFor="let col of columns" [value]="col.name">{{ col.name }}</option>
          </select>
        </div>
      </div>

      <div class="config-section">
        <h4>Appearance</h4>
        <div class="config-field">
          <label>Color Scheme</label>
          <div class="color-schemes">
            <button
              *ngFor="let scheme of colorSchemes"
              class="color-scheme-btn"
              [class.active]="config.colorScheme === scheme.id"
              (click)="selectColorScheme(scheme.id)">
              <div class="scheme-preview">
                <span *ngFor="let color of scheme.colors.slice(0, 4)" [style.background]="color"></span>
              </div>
              <span class="scheme-name">{{ scheme.name }}</span>
            </button>
          </div>
        </div>
        <div class="config-row">
          <div class="config-field half">
            <label>
              <input type="checkbox" [(ngModel)]="config.showLegend" (ngModelChange)="emitChange()">
              Show Legend
            </label>
          </div>
          <div class="config-field half">
            <label>
              <input type="checkbox" [(ngModel)]="config.showLabels" (ngModelChange)="emitChange()">
              Show Labels
            </label>
          </div>
        </div>
        <div class="config-row">
          <div class="config-field half">
            <label>
              <input type="checkbox" [(ngModel)]="config.enableAnimation" (ngModelChange)="emitChange()">
              Animation
            </label>
          </div>
          <div class="config-field half">
            <label>
              <input type="checkbox" [(ngModel)]="config.enableTooltip" (ngModelChange)="emitChange()">
              Tooltips
            </label>
          </div>
        </div>
      </div>

      <div class="config-section" *ngIf="isGaugeType">
        <h4>Gauge Settings</h4>
        <div class="config-row">
          <div class="config-field half">
            <label>Min Value</label>
            <input type="number" [(ngModel)]="config.minValue" (ngModelChange)="emitChange()">
          </div>
          <div class="config-field half">
            <label>Max Value</label>
            <input type="number" [(ngModel)]="config.maxValue" (ngModelChange)="emitChange()">
          </div>
        </div>
        <div class="config-field">
          <label>Threshold Zones</label>
          <div class="threshold-zones">
            <div class="zone" *ngFor="let zone of config.thresholds; let i = index">
              <input type="number" [(ngModel)]="zone.value" placeholder="Value">
              <input type="color" [(ngModel)]="zone.color">
              <app-button variant="ghost" size="sm" (click)="removeThreshold(i)">
                <app-icon name="x" [size]="14"></app-icon>
              </app-button>
            </div>
            <app-button variant="ghost" size="sm" (click)="addThreshold()">
              <app-icon name="plus" [size]="14"></app-icon>
              Add Zone
            </app-button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .config-panel {
      height: 100%;
      overflow-y: auto;
      padding: var(--spacing-4);
    }

    .config-section {
      margin-bottom: var(--spacing-6);

      h4 {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 var(--spacing-3) 0;
        padding-bottom: var(--spacing-2);
        border-bottom: 1px solid var(--border-color);
      }
    }

    .config-field {
      margin-bottom: var(--spacing-3);

      label {
        display: block;
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        margin-bottom: var(--spacing-1);
      }

      input[type="text"],
      input[type="number"],
      select {
        width: 100%;
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-size: var(--font-size-sm);

        &:focus {
          outline: none;
          border-color: var(--color-primary);
        }
      }

      input[type="checkbox"] {
        margin-right: var(--spacing-2);
      }

      &.half {
        width: 50%;
      }
    }

    .config-row {
      display: flex;
      gap: var(--spacing-3);
    }

    .color-schemes {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-2);
    }

    .color-scheme-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-2);
      background: var(--bg-tertiary);
      border: 2px solid var(--border-color);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--color-primary-light);
      }

      &.active {
        border-color: var(--color-primary);
        background: rgba(var(--color-primary-rgb), 0.1);
      }
    }

    .scheme-preview {
      display: flex;
      gap: 2px;

      span {
        width: 16px;
        height: 16px;
        border-radius: var(--radius-sm);
      }
    }

    .scheme-name {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .threshold-zones {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
    }

    .zone {
      display: flex;
      gap: var(--spacing-2);
      align-items: center;

      input[type="number"] {
        flex: 1;
      }

      input[type="color"] {
        width: 40px;
        height: 32px;
        padding: 0;
        border: none;
        cursor: pointer;
      }
    }
  `]
})
export class ChartConfigPanelComponent {
  @Input() chartType: string = '';
  @Input() columns: { name: string; data_type: string }[] = [];
  @Input() config: any = {
    title: '',
    subtitle: '',
    xAxis: '',
    yAxis: '',
    groupBy: '',
    colorScheme: 'citi',
    showLegend: true,
    showLabels: false,
    enableAnimation: true,
    enableTooltip: true,
    minValue: 0,
    maxValue: 100,
    thresholds: [
      { value: 30, color: '#e74c3c' },
      { value: 70, color: '#f1c40f' },
      { value: 100, color: '#2ecc71' }
    ]
  };
  @Output() configChange = new EventEmitter<any>();

  colorSchemes = [
    { id: 'citi', name: 'Citi Blue', colors: ['#0066b2', '#3399cc', '#66b2d6', '#99cce6'] },
    { id: 'success', name: 'Success', colors: ['#2ecc71', '#27ae60', '#1abc9c', '#16a085'] },
    { id: 'warm', name: 'Warm', colors: ['#e74c3c', '#e67e22', '#f1c40f', '#f39c12'] },
    { id: 'cool', name: 'Cool', colors: ['#9b59b6', '#8e44ad', '#3498db', '#2980b9'] },
    { id: 'rainbow', name: 'Rainbow', colors: ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db'] },
    { id: 'monochrome', name: 'Mono', colors: ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6'] }
  ];

  get showGroupBy(): boolean {
    return ['bar', 'column', 'line', 'area'].includes(this.chartType);
  }

  get isGaugeType(): boolean {
    return ['gauge', 'speedometer', 'radialBar'].includes(this.chartType);
  }

  selectColorScheme(schemeId: string) {
    this.config.colorScheme = schemeId;
    this.emitChange();
  }

  addThreshold() {
    this.config.thresholds.push({ value: 50, color: '#3498db' });
    this.emitChange();
  }

  removeThreshold(index: number) {
    this.config.thresholds.splice(index, 1);
    this.emitChange();
  }

  emitChange() {
    this.configChange.emit({ ...this.config });
  }
}
