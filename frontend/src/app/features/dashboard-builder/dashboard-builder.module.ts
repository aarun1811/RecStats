import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { GridsterModule } from 'angular-gridster2';
import { NgxEchartsModule } from 'ngx-echarts';

import { DashboardBuilderComponent } from './dashboard-builder.component';
import { DashboardGridComponent } from './dashboard-grid.component';
import { WidgetWrapperComponent } from './widget-wrapper.component';
import { ChartWidgetComponent } from './chart-widget.component';
import { FilterBarComponent } from './filter-bar.component';
import { AddWidgetModalComponent } from './add-widget-modal.component';

const routes: Routes = [
  { path: '', component: DashboardBuilderComponent },
  { path: ':id', component: DashboardBuilderComponent }
];

@NgModule({
  declarations: [
    DashboardBuilderComponent,
    DashboardGridComponent,
    WidgetWrapperComponent,
    ChartWidgetComponent,
    FilterBarComponent,
    AddWidgetModalComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    GridsterModule,
    NgxEchartsModule
  ]
})
export class DashboardBuilderModule { }
