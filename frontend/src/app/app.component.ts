import { Component, OnInit, inject } from '@angular/core';
import { ThemeService } from './core/services/theme.service';

@Component({
    selector: 'app-root',
    template: `<app-main-layout></app-main-layout>`,
    styles: [],
    standalone: false
})
export class AppComponent implements OnInit {
  private themeService = inject(ThemeService);

  ngOnInit(): void {
    // Theme is automatically initialized by the service
    // This ensures the initial theme is applied
  }
}
