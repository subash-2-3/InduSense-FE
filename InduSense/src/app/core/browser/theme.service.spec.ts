import { TestBed } from '@angular/core/testing';

import { ChartThemeService } from '../../shared/charts/chart-theme.service';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it('starts dark, toggles the data-theme attribute and remembers the choice', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('dark');

    service.toggle();
    expect(service.mode()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    service.toggle();
    expect(service.mode()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('starts from the attribute set before the app loaded', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    expect(TestBed.inject(ThemeService).mode()).toBe('light');
  });

  it('makes the chart theme re-read the tokens', () => {
    const charts = TestBed.inject(ChartThemeService);
    const first = charts.current();
    TestBed.inject(ThemeService).toggle();
    expect(charts.current()).not.toBe(first);
  });
});
