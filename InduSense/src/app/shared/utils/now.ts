import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Signal, inject, signal } from '@angular/core';

/**
 * Current time as a signal, updated every `intervalMs` in the browser (static on the server).
 * Must be called in an injection context; the timer stops when that context is destroyed.
 */
export function injectNow(intervalMs = 1000): Signal<number> {
  const now = signal(Date.now());
  if (isPlatformBrowser(inject(PLATFORM_ID))) {
    const id = setInterval(() => now.set(Date.now()), intervalMs);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
  return now.asReadonly();
}
