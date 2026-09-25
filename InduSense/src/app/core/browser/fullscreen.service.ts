import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

/** Fullscreen API wrapper; inert during server rendering or where the API is unavailable. */
@Injectable({ providedIn: 'root' })
export class FullscreenService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly supported = this.isBrowser && !!this.document.fullscreenEnabled;
  private readonly active = signal(false);
  readonly isFullscreen = this.active.asReadonly();

  constructor() {
    if (!this.isBrowser) {
      return;
    }
    const sync = () => this.active.set(!!this.document.fullscreenElement);
    this.document.addEventListener('fullscreenchange', sync);
    inject(DestroyRef).onDestroy(() => this.document.removeEventListener('fullscreenchange', sync));
  }

  async toggle(): Promise<void> {
    if (!this.supported) {
      return;
    }
    try {
      if (this.document.fullscreenElement) {
        await this.document.exitFullscreen();
      } else {
        await this.document.documentElement.requestFullscreen();
      }
    } catch {
      // Rejected by the browser (e.g. not triggered by a user gesture): nothing to do.
    }
  }
}
