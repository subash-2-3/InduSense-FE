import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

/** Key of the saved preference. The inline script in index.html reads it before the first paint. */
export const THEME_STORAGE_KEY = 'indusense-theme';

/**
 * Dark / light color theme. The mode is the `data-theme` attribute on <html>, which switches the
 * color tokens (styles/_tokens.scss). Only this display preference is kept in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly modeState = signal<ThemeMode>(
    this.root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
  );

  readonly mode = this.modeState.asReadonly();

  toggle(): void {
    this.set(this.modeState() === 'light' ? 'dark' : 'light');
  }

  set(mode: ThemeMode): void {
    // The attribute changes first, so anything reacting to `mode` reads the new token values.
    this.root.setAttribute('data-theme', mode);
    this.modeState.set(mode);
    if (this.isBrowser) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch {
        // Storage blocked (private mode, policy): the choice still applies to this page.
      }
    }
  }
}
