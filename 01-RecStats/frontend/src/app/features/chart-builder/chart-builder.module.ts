import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { NgxEchartsModule } from 'ngx-echarts';
import { AgGridModule } from 'ag-grid-angular';

import { ChartBuilderComponent } from './chart-builder.component';
import { ChartListComponent } from './chart-list.component';
import { ChartPreviewModule } from './chart-preview.module';

const routes: Routes = [
  { path: '', component: ChartListComponent },
  { path: 'new', component: ChartBuilderComponent },
  { path: ':id/edit', component: ChartBuilderComponent }
];

@NgModule({
  declarations: [
    ChartBuilderComponent,
    ChartListComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    NgxEchartsModule.forChild(),
    AgGridModule,
    ChartPreviewModule
  ],
  exports: [
    ChartPreviewModule
  ]
})
export class ChartBuilderModule { }
