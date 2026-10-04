import { TestBed } from '@angular/core/testing';

import { ChartThemeService } from '../../shared/charts/chart-theme.service';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it('starts light, toggles the data-theme attribute and remembers the choice', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('light');

    service.toggle();
    expect(service.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    service.toggle();
    expect(service.mode()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('starts from the attribute set before the app loaded', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(TestBed.inject(ThemeService).mode()).toBe('dark');
  });

  it('makes the chart theme re-read the tokens', () => {
    const charts = TestBed.inject(ChartThemeService);
    const first = charts.current();
    TestBed.inject(ThemeService).toggle();
    expect(charts.current()).not.toBe(first);
  });
});
