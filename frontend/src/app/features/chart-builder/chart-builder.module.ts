import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { NgxEchartsModule } from 'ngx-echarts';
import { AgGridModule } from 'ag-grid-angular';

import { ChartBuilderComponent } from './chart-builder.component';
import { ChartPreviewComponent } from './chart-preview.component';

const routes: Routes = [
  { path: '', component: ChartBuilderComponent }
];

@NgModule({
  declarations: [
    ChartBuilderComponent,
    ChartPreviewComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    NgxEchartsModule.forChild(),
    AgGridModule
  ]
})
export class ChartBuilderModule { }
