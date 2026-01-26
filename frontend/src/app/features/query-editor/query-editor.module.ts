import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { AgGridModule } from 'ag-grid-angular';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

import { QueryEditorComponent } from './query-editor.component';
import { SqlEditorComponent } from './sql-editor.component';
import { ResultsTableComponent } from './results-table.component';
import { SchemaExplorerComponent } from './schema-explorer.component';

const routes: Routes = [
  { path: '', component: QueryEditorComponent }
];

@NgModule({
  declarations: [
    QueryEditorComponent,
    SqlEditorComponent,
    ResultsTableComponent,
    SchemaExplorerComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    AgGridModule,
    MonacoEditorModule
  ]
})
export class QueryEditorModule { }
