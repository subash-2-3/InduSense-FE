import { TestBed } from '@angular/core/testing';

import { CATEGORICAL_PALETTE, ChartThemeService } from './chart-theme.service';

describe('ChartThemeService', () => {
  it('resolves every token, falling back to the design-token values', () => {
    const { theme } = TestBed.inject(ChartThemeService);
    expect(theme.surface).toBe('#ffffff');
    expect(theme.text.primary).toBe('#0f172a');
    expect(theme.text.muted).toBe('#64748b');
    expect(theme.inkOnLight).toBe('#f4f6fa');
    expect(theme.status).toEqual({
      running: '#059669',
      warning: '#d97706',
      fault: '#dc2626',
      stopped: '#64748b',
      info: '#0891b2',
    });
    expect(theme.accent.orange).toBe('#ea580c');
  });

  it('prefers values defined on the document root', () => {
    document.documentElement.style.setProperty('--bg-card', '#123456');
    try {
      expect(new ChartThemeServiceFactory().create().theme.surface).toBe('#123456');
    } finally {
      document.documentElement.style.removeProperty('--bg-card');
    }
  });

  it('turns chart animation off when the viewer prefers reduced motion', () => {
    // jsdom has no matchMedia: install a stub for this test.
    const original = window.matchMedia;
    let reduce = true;
    window.matchMedia = ((query: string) =>
      ({
        matches: reduce && query.includes('reduce'),
      }) as MediaQueryList) as typeof window.matchMedia;
    try {
      expect(new ChartThemeServiceFactory().create().theme.animation).toBe(false);
      reduce = false;
      expect(new ChartThemeServiceFactory().create().theme.animation).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });

  it('exposes the validated 8-color categorical palette in fixed order', () => {
    expect(CATEGORICAL_PALETTE).toHaveLength(8);
    expect(TestBed.inject(ChartThemeService).theme.categorical[0]).toBe('#3987e5');
  });
});

/** A fresh service instance (the root one is cached per TestBed). */
class ChartThemeServiceFactory {
  create(): ChartThemeService {
    return TestBed.runInInjectionContext(() => new ChartThemeService());
  }
}
