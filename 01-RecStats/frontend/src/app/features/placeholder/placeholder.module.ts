import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { PlaceholderComponent } from './placeholder.component';

const routes: Routes = [
  { path: '', component: PlaceholderComponent }
];

@NgModule({
  declarations: [PlaceholderComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class PlaceholderModule { }
