import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { NgxEchartsModule } from 'ngx-echarts';

import { ChartPreviewComponent } from './chart-preview.component';

/**
 * Standalone module for ChartPreviewComponent.
 * Use this when you need to import ChartPreviewComponent without
 * the ChartBuilder routes (e.g., in DashboardBuilderModule).
 */
@NgModule({
  declarations: [
    ChartPreviewComponent
  ],
  imports: [
    SharedModule,
    NgxEchartsModule.forChild()
  ],
  exports: [
    ChartPreviewComponent
  ]
})
export class ChartPreviewModule { }
