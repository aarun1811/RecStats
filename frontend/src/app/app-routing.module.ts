import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/dashboard-viewer/dashboard-viewer.module')
      .then(m => m.DashboardViewerModule)
  },
  {
    path: 'dashboards',
    loadChildren: () => import('./features/dashboard-builder/dashboard-builder.module')
      .then(m => m.DashboardBuilderModule)
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
    loadChildren: () => import('./features/placeholder/placeholder.module')
      .then(m => m.PlaceholderModule)
  },
  {
    path: 'upload',
    loadChildren: () => import('./features/placeholder/placeholder.module')
      .then(m => m.PlaceholderModule)
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/placeholder/placeholder.module')
      .then(m => m.PlaceholderModule)
  },
  {
    path: '**',
    redirectTo: ''
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
