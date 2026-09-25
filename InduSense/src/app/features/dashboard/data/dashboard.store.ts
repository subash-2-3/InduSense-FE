import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, WritableSignal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  exhaustMap,
  finalize,
  fromEvent,
  map,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import { APP_CONFIG } from '../../../core/config/app-config';
import {
  CategorySliceVm,
  FleetPageVm,
  GaugeVm,
  KpiVm,
  StackedBarVm,
  StatusSliceVm,
  WidgetState,
} from '../models/dashboard.vm';
import { DASHBOARD_DATA_SOURCE, DashboardSnapshot } from './dashboard-data-source';
import { WidgetResult } from './widget-result';

const initialState = <T>(): WidgetState<T> => ({ data: null, loading: true, error: null });

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong.';
}

/** Applies one widget's result. A failure keeps the last data so the widget can show it as stale. */
export function applyResult<T>(
  state: WritableSignal<WidgetState<T>>,
  result: WidgetResult<T>,
): void {
  if (result.ok) {
    state.set({ data: result.data, loading: false, error: null });
  } else {
    state.update((s) => ({ data: s.data, loading: false, error: result.error }));
  }
}

/**
 * Device Summary state. Provided per page. `start()` (browser only) loads immediately, then every
 * `refreshIntervalMs` while the tab is visible; loads never overlap, a manual `refresh()` loads
 * now and restarts the interval, and coming back to the tab loads straight away.
 */
@Injectable()
export class DashboardStore {
  private readonly source = inject(DASHBOARD_DATA_SOURCE);
  private readonly intervalMs = inject(APP_CONFIG).refreshIntervalMs;
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly fleetPageSize = 10;

  private readonly states = {
    deviceCount: signal(initialState<KpiVm>()),
    deviceTypeCount: signal(initialState<KpiVm>()),
    devicesByType: signal(initialState<CategorySliceVm[]>()),
    devicesByConnection: signal(initialState<StatusSliceVm[]>()),
    devicesBySource: signal(initialState<StackedBarVm>()),
    fleet: signal(initialState<FleetPageVm>()),
    gauge: signal(initialState<GaugeVm>()),
  };

  readonly deviceCount = this.states.deviceCount.asReadonly();
  readonly deviceTypeCount = this.states.deviceTypeCount.asReadonly();
  readonly devicesByType = this.states.devicesByType.asReadonly();
  readonly devicesByConnection = this.states.devicesByConnection.asReadonly();
  readonly devicesBySource = this.states.devicesBySource.asReadonly();
  readonly fleet = this.states.fleet.asReadonly();
  readonly gauge = this.states.gauge.asReadonly();

  /** A full dashboard load is in flight. */
  readonly refreshing = signal(false);
  /** Time of the last load in which at least one widget succeeded. */
  readonly lastUpdated = signal<number | null>(null);

  private readonly refreshRequests = new Subject<void>();
  private readonly fleetPageRequests = new Subject<number>();
  private fleetPage = 1;
  private fleetPageLoading = false;
  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const visible$ = fromEvent(this.document, 'visibilitychange').pipe(
      startWith(null),
      map(() => this.document.visibilityState !== 'hidden'),
      distinctUntilChanged(),
    );

    combineLatest([visible$, this.refreshRequests.pipe(startWith(undefined))])
      .pipe(
        switchMap(([visible]) => (visible ? timer(0, this.intervalMs) : EMPTY)),
        exhaustMap(() => this.loadAll()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.fleetPageRequests
      .pipe(
        switchMap((page) => this.loadFleetPage(page)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Load everything now and restart the polling interval. */
  refresh(): void {
    this.refreshRequests.next();
  }

  /** Show another page of the machine fleet table (1-based). */
  setFleetPage(page: number): void {
    this.fleetPage = page;
    this.fleetPageRequests.next(page);
  }

  private loadAll(): Observable<unknown> {
    this.refreshing.set(true);
    // Only widgets without data show a skeleton; the others keep their data (the toolbar spins).
    for (const state of this.allStates()) {
      state.update((s) => (s.data === null ? { ...s, loading: true } : s));
    }
    return this.source.load({ fleetPage: this.fleetPage, fleetPageSize: this.fleetPageSize }).pipe(
      tap((snapshot) => this.apply(snapshot)),
      catchError((error: unknown) => {
        this.applyToAll(errorMessage(error));
        return EMPTY;
      }),
      finalize(() => {
        this.refreshing.set(false);
        for (const state of this.allStates()) {
          if (state !== this.states.fleet || !this.fleetPageLoading) {
            state.update((s) => ({ ...s, loading: false }));
          }
        }
      }),
    );
  }

  private loadFleetPage(page: number): Observable<unknown> {
    const fleet = this.states.fleet;
    this.fleetPageLoading = true;
    fleet.update((s) => ({ ...s, loading: true }));
    return this.source.loadFleetPage(page, this.fleetPageSize).pipe(
      tap((data) => fleet.set({ data, loading: false, error: null })),
      catchError((error: unknown) => {
        // Stay on the page that is still displayed.
        this.fleetPage = fleet().data?.page ?? 1;
        fleet.update((s) => ({ ...s, error: errorMessage(error) }));
        return EMPTY;
      }),
      finalize(() => {
        this.fleetPageLoading = false;
        fleet.update((s) => ({ ...s, loading: false }));
      }),
    );
  }

  private apply(snapshot: DashboardSnapshot): void {
    const s = this.states;
    applyResult(s.deviceCount, snapshot.deviceCount);
    applyResult(s.deviceTypeCount, snapshot.deviceTypeCount);
    applyResult(s.devicesByType, snapshot.devicesByType);
    applyResult(s.devicesByConnection, snapshot.devicesByConnection);
    applyResult(s.devicesBySource, snapshot.devicesBySource);
    applyResult(s.gauge, snapshot.gauge);
    // Ignore a fleet page that the user has already paged away from during the load.
    if (!snapshot.fleet.ok || snapshot.fleet.data.page === this.fleetPage) {
      applyResult(s.fleet, snapshot.fleet);
    }
    if (Object.values(snapshot).some((result: WidgetResult<unknown>) => result.ok)) {
      this.lastUpdated.set(Date.now());
    }
  }

  private applyToAll(error: string): void {
    for (const state of this.allStates()) {
      state.update((s) => ({ ...s, error }));
    }
  }

  private allStates(): WritableSignal<WidgetState<unknown>>[] {
    return Object.values(this.states) as WritableSignal<WidgetState<unknown>>[];
  }
}
