import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'resstats-theme';

  // Reactive signal for theme state
  readonly theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    // Apply theme changes to DOM
    effect(() => {
      this.applyTheme(this.theme());
    });
  }

  private getInitialTheme(): Theme {
    // Check localStorage first
    const stored = localStorage.getItem(this.STORAGE_KEY) as Theme;
    if (stored && (stored === 'dark' || stored === 'light')) {
      return stored;
    }

    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }

    // Default to dark (our primary theme)
    return 'dark';
  }

  private applyTheme(theme: Theme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(this.STORAGE_KEY, theme);
    }
  }

  toggleTheme(): void {
    this.theme.update(current => current === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  isDark(): boolean {
    return this.theme() === 'dark';
  }
}
