import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

declare const monaco: any;

interface TableSchema {
  name: string;
  columns: { name: string; type: string }[];
}

@Component({
  selector: 'app-sql-editor',
  template: `
    <ngx-monaco-editor
      class="sql-monaco-editor"
      [options]="editorOptions"
      [(ngModel)]="sql"
      (ngModelChange)="onSqlChange($event)"
      (onInit)="onEditorInit($event)">
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
export class SqlEditorComponent implements OnInit, OnChanges, ControlValueAccessor {
  @Input() sql = '';
  @Output() sqlChange = new EventEmitter<string>();
  @Input() readOnly = false;
  @Input() schema: TableSchema[] = [];

  editorOptions: any;
  private editor: any;
  private completionDisposable: any;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['schema'] && this.editor) {
      this.registerCompletionProvider();
    }
  }

  onEditorInit(editor: any): void {
    this.editor = editor;
    this.registerCompletionProvider();
  }

  private registerCompletionProvider(): void {
    // Dispose previous provider if exists
    if (this.completionDisposable) {
      this.completionDisposable.dispose();
    }

    if (typeof monaco === 'undefined') return;

    const schema = this.schema;

    this.completionDisposable = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions: any[] = [];

        // SQL Keywords
        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
          'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON',
          'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'DISTINCT',
          'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
          'INSERT INTO', 'UPDATE', 'DELETE', 'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE',
          'NULL', 'IS NULL', 'IS NOT NULL', 'ASC', 'DESC', 'UNION', 'UNION ALL'
        ];

        keywords.forEach(kw => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            detail: 'SQL Keyword',
            range
          });
        });

        // Tables from schema
        schema.forEach(table => {
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: table.name,
            detail: `Table (${table.columns?.length || 0} columns)`,
            range
          });

          // Columns for each table
          table.columns?.forEach(col => {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col.name,
              detail: `${table.name}.${col.name} (${col.type})`,
              range
            });

            // Also add table.column format
            suggestions.push({
              label: `${table.name}.${col.name}`,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: `${table.name}.${col.name}`,
              detail: `Column (${col.type})`,
              range
            });
          });
        });

        return { suggestions };
      }
    });
  }
}
