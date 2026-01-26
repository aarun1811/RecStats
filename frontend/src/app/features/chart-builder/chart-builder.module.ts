import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { NgxEchartsModule } from 'ngx-echarts';

import { ChartBuilderComponent } from './chart-builder.component';
import { ChartTypePickerComponent } from './chart-type-picker.component';
import { ChartPreviewComponent } from './chart-preview.component';
import { ChartConfigPanelComponent } from './chart-config-panel.component';

const routes: Routes = [
  { path: '', component: ChartBuilderComponent }
];

@NgModule({
  declarations: [
    ChartBuilderComponent,
    ChartTypePickerComponent,
    ChartPreviewComponent,
    ChartConfigPanelComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    NgxEchartsModule.forChild()
  ]
})
export class ChartBuilderModule { }
