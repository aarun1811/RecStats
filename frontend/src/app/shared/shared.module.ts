import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

// Components
import { ButtonComponent } from './components/button/button.component';
import { CardComponent } from './components/card/card.component';
import { InputComponent } from './components/input/input.component';
import { ModalComponent } from './components/modal/modal.component';
import { KpiCardComponent } from './components/kpi-card/kpi-card.component';
import { LoadingSpinnerComponent } from './components/loading/loading-spinner.component';
import { NotificationContainerComponent } from './components/notification/notification-container.component';
import { IconComponent } from './components/icon/icon.component';
import { InfoSidebarComponent } from './components/info-sidebar/info-sidebar.component';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { CollapsibleSectionComponent } from './components/collapsible-section/collapsible-section.component';
import { ItemCardComponent } from './components/item-card/item-card.component';
import { InteractionHintComponent } from './components/interaction-hint/interaction-hint.component';

const COMPONENTS = [
  ButtonComponent,
  CardComponent,
  InputComponent,
  ModalComponent,
  KpiCardComponent,
  LoadingSpinnerComponent,
  NotificationContainerComponent,
  IconComponent,
  InfoSidebarComponent,
  SearchBarComponent,
  CollapsibleSectionComponent,
  ItemCardComponent,
  InteractionHintComponent,
];

@NgModule({
  declarations: COMPONENTS,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  exports: [
    // Modules
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    // Components
    ...COMPONENTS,
  ],
  providers: [provideHttpClient(withInterceptorsFromDi())],
})
export class SharedModule { }
