import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

// Components
import { ButtonComponent } from './components/button/button.component';
import { CardComponent } from './components/card/card.component';
import { InputComponent } from './components/input/input.component';
import { ModalComponent } from './components/modal/modal.component';
import { KpiCardComponent } from './components/kpi-card/kpi-card.component';
import { LoadingSpinnerComponent } from './components/loading/loading-spinner.component';
import { NotificationContainerComponent } from './components/notification/notification-container.component';
import { IconComponent } from './components/icon/icon.component';

const COMPONENTS = [
  ButtonComponent,
  CardComponent,
  InputComponent,
  ModalComponent,
  KpiCardComponent,
  LoadingSpinnerComponent,
  NotificationContainerComponent,
  IconComponent,
];

@NgModule({
  declarations: COMPONENTS,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
  ],
  exports: [
    // Modules
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    // Components
    ...COMPONENTS,
  ]
})
export class SharedModule { }
