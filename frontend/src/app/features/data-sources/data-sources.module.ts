import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { DataSourceListComponent } from './data-source-list.component';
import { DataSourceSidebarComponent } from './data-source-sidebar.component';

const routes: Routes = [
  { path: '', component: DataSourceListComponent }
];

@NgModule({
  declarations: [
    DataSourceListComponent,
    DataSourceSidebarComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class DataSourcesModule { }
