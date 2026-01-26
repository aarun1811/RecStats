import { Component, Input, Output, EventEmitter, OnInit, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-sql-editor',
  template: `
    <ngx-monaco-editor
      class="sql-monaco-editor"
      [options]="editorOptions"
      [(ngModel)]="sql"
      (ngModelChange)="onSqlChange($event)">
    </ngx-monaco-editor>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .sql-monaco-editor {
      height: 100%;
    }

    ::ng-deep .monaco-editor {
      .margin {
        background: var(--bg-secondary) !important;
      }

      .monaco-editor-background {
        background: var(--bg-secondary) !important;
      }

      .line-numbers {
        color: var(--text-muted) !important;
      }

      .view-overlays .current-line {
        background: rgba(var(--color-primary-rgb), 0.1) !important;
        border: none !important;
      }

      .cursor {
        background: var(--color-primary) !important;
        border-color: var(--color-primary) !important;
      }

      .minimap {
        background: var(--bg-tertiary) !important;
      }

      .scroll-decoration {
        box-shadow: none !important;
      }

      .scrollbar .slider {
        background: var(--scrollbar-thumb) !important;
        border-radius: var(--radius-full) !important;
      }
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SqlEditorComponent),
      multi: true
    }
  ]
})
export class SqlEditorComponent implements OnInit, ControlValueAccessor {
  @Input() sql = '';
  @Output() sqlChange = new EventEmitter<string>();
  @Input() readOnly = false;

  editorOptions: any;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit() {
    this.editorOptions = {
      theme: 'vs-dark',
      language: 'sql',
      automaticLayout: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      padding: { top: 16, bottom: 16 },
      readOnly: this.readOnly,
      wordWrap: 'on',
      tabSize: 2,
      formatOnPaste: true,
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      }
    };
  }

  onSqlChange(value: string) {
    this.sql = value;
    this.sqlChange.emit(value);
    this.onChange(value);
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.sql = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readOnly = isDisabled;
    if (this.editorOptions) {
      this.editorOptions = { ...this.editorOptions, readOnly: isDisabled };
    }
  }
}
