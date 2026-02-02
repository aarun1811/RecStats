import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';

import { CollectionsListComponent } from './collections-list.component';
import { CollectionDetailComponent } from './collection-detail.component';

const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: CollectionsListComponent },
      { path: ':id', component: CollectionDetailComponent }
    ]
  }
];

@NgModule({
  declarations: [
    CollectionsListComponent,
    CollectionDetailComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class CollectionsModule { }
