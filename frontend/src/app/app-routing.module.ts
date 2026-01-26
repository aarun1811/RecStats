import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboards',
    pathMatch: 'full'
  },
  {
    path: 'dashboards',
    loadChildren: () => import('./features/dashboard-builder/dashboard-builder.module')
      .then(m => m.DashboardBuilderModule)
  },
  {
    path: 'view',
    loadChildren: () => import('./features/dashboard-viewer/dashboard-viewer.module')
      .then(m => m.DashboardViewerModule)
  },
  {
    path: 'queries',
    loadChildren: () => import('./features/query-editor/query-editor.module')
      .then(m => m.QueryEditorModule)
  },
  {
    path: 'charts',
    loadChildren: () => import('./features/chart-builder/chart-builder.module')
      .then(m => m.ChartBuilderModule)
  },
  {
    path: 'datasources',
    loadChildren: () => import('./features/dashboard-viewer/dashboard-viewer.module')
      .then(m => m.DashboardViewerModule)
  },
  {
    path: 'upload',
    loadChildren: () => import('./features/dashboard-viewer/dashboard-viewer.module')
      .then(m => m.DashboardViewerModule)
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/dashboard-viewer/dashboard-viewer.module')
      .then(m => m.DashboardViewerModule)
  },
  {
    path: '**',
    redirectTo: 'dashboards'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
