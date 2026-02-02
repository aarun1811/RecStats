import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { GridsterModule } from 'angular-gridster2';
import { AgGridModule } from 'ag-grid-angular';

import { DashboardListComponent } from './dashboard-list.component';
import { DashboardBuilderComponent } from './dashboard-builder.component';
import { DashboardGridComponent } from './dashboard-grid.component';
import { WidgetWrapperComponent } from './widget-wrapper.component';
import { ChartPickerPanelComponent } from './chart-picker-panel.component';
import { TableWidgetComponent } from './table-widget.component';

// Filter components
import { FilterWidgetComponent } from './filters/filter-widget/filter-widget.component';
import { FilterBarComponent } from './filters/filter-bar/filter-bar.component';
import { FilterConfigModalComponent } from './filters/filter-config-modal/filter-config-modal.component';

// Import ChartPreviewModule (not ChartBuilderModule to avoid route conflicts)
import { ChartPreviewModule } from '../chart-builder/chart-preview.module';

const routes: Routes = [
  { path: '', component: DashboardListComponent },
  { path: 'new', component: DashboardBuilderComponent },
  { path: ':id', component: DashboardBuilderComponent }
];

@NgModule({
  declarations: [
    DashboardListComponent,
    DashboardBuilderComponent,
    DashboardGridComponent,
    WidgetWrapperComponent,
    ChartPickerPanelComponent,
    TableWidgetComponent,
    // Filter components
    FilterWidgetComponent,
    FilterBarComponent,
    FilterConfigModalComponent,
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    GridsterModule,
    AgGridModule,
    ChartPreviewModule
  ]
})
export class DashboardBuilderModule { }
