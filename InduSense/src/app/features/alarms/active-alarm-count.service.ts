import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  catchError,
  distinctUntilChanged,
  exhaustMap,
  filter,
  fromEvent,
  map,
  startWith,
  switchMap,
  timer,
} from 'rxjs';

import { AlarmsApi } from '../../core/api/resources/alarms.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';

/** How often the sidebar's active-alarm count refreshes while the tab is visible. */
export const ALARM_COUNT_REFRESH_MS = 30_000;

/**
 * Number of active alarms for the sidebar badge. Polls `/alarms/active` in the browser while the
 * tab is visible and the user may view alarms; the Active Alarms screen also reports its result.
 */
@Injectable({ providedIn: 'root' })
export class ActiveAlarmCountService {
  private readonly api = inject(AlarmsApi);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private started = false;

  /** null until known (or when the user may not view alarms). */
  readonly count = signal<number | null>(null);

  start(): void {
    if (this.started || !this.isBrowser) {
      return;
    }
    this.started = true;
    fromEvent(this.document, 'visibilitychange')
      .pipe(
        startWith(null),
        map(() => this.document.visibilityState !== 'hidden'),
        distinctUntilChanged(),
        switchMap((visible) => (visible ? timer(0, ALARM_COUNT_REFRESH_MS) : EMPTY)),
        filter(() => {
          const allowed = this.auth.hasPermission(Permission.AlarmsView);
          if (!allowed) this.count.set(null);
          return allowed;
        }),
        exhaustMap(() => this.api.active().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((active) => this.count.set(active.alarms.length));
  }

  /** Called by screens that just loaded the active alarms. */
  report(count: number): void {
    this.count.set(count);
  }
}
