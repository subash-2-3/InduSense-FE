import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';

import { APP_CONFIG } from '../../../core/config/app-config';
import { environment } from '../../../../environments/environment';
import { DASHBOARD_DATA_SOURCE } from './dashboard-data-source';
import { DashboardStore, errorMessage } from './dashboard.store';
import { ControlledDataSource, failedSnapshot, fleetPageFixture, snapshotFixture } from './testing';
import { failed } from './widget-result';

const INTERVAL = 1000;

describe('DashboardStore', () => {
  let source: ControlledDataSource;
  let store: DashboardStore;
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-25T12:00:00Z'));
    source = new ControlledDataSource();
    visibility = 'visible';
    TestBed.configureTestingModule({
      providers: [
        DashboardStore,
        { provide: DASHBOARD_DATA_SOURCE, useValue: source },
        { provide: APP_CONFIG, useValue: { ...environment, refreshIntervalMs: INTERVAL } },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => visibility });
    store = TestBed.inject(DashboardStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    delete (TestBed.inject(DOCUMENT) as unknown as Record<string, unknown>)['visibilityState'];
    vi.useRealTimers();
  });

  const setVisibility = (state: DocumentVisibilityState) => {
    visibility = state;
    TestBed.inject(DOCUMENT).dispatchEvent(new Event('visibilitychange'));
  };

  const startAndLoad = () => {
    store.start();
    vi.advanceTimersByTime(0);
    source.respond(snapshotFixture());
  };

  it('starts with every widget loading and no data', () => {
    expect(store.deviceCount()).toEqual({ data: null, loading: true, error: null });
    expect(store.gauge().loading).toBe(true);
    expect(store.lastUpdated()).toBeNull();
    expect(source.loads).toHaveLength(0);
  });

  it('loads immediately on start and applies every widget', () => {
    store.start();
    vi.advanceTimersByTime(0);
    expect(source.loads).toHaveLength(1);
    expect(source.queries[0]).toEqual({ fleetPage: 1, fleetPageSize: 10 });
    expect(store.refreshing()).toBe(true);

    source.respond(snapshotFixture());
    expect(store.refreshing()).toBe(false);
    expect(store.deviceCount()).toEqual({ data: { value: 12 }, loading: false, error: null });
    expect(store.fleet().data?.rows).toHaveLength(10);
    expect(store.gauge().data?.value).toBe(41.6);
    expect(store.lastUpdated()).toBe(Date.parse('2026-09-25T12:00:00Z'));
  });

  it('polls on the interval', () => {
    startAndLoad();
    vi.advanceTimersByTime(INTERVAL - 1);
    expect(source.loads).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(source.loads).toHaveLength(2);
  });

  it('never overlaps loads', () => {
    store.start();
    vi.advanceTimersByTime(INTERVAL * 5);
    store.refresh();
    vi.advanceTimersByTime(0);
    expect(source.loads).toHaveLength(1);
  });

  it('loads on manual refresh and restarts the interval', () => {
    startAndLoad();
    vi.advanceTimersByTime(600);
    store.refresh();
    vi.advanceTimersByTime(0);
    expect(source.loads).toHaveLength(2);
    source.respond(snapshotFixture());

    vi.advanceTimersByTime(INTERVAL - 1);
    expect(source.loads).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(source.loads).toHaveLength(3);
  });

  it('pauses while the tab is hidden and reloads when it is shown again', () => {
    startAndLoad();
    setVisibility('hidden');
    vi.advanceTimersByTime(INTERVAL * 10);
    expect(source.loads).toHaveLength(1);

    setVisibility('visible');
    vi.advanceTimersByTime(0);
    expect(source.loads).toHaveLength(2);
  });

  it('keeps the last data when a refresh fails, and marks the error', () => {
    startAndLoad();
    const updated = store.lastUpdated();
    vi.setSystemTime(new Date('2026-09-25T12:05:00Z'));
    store.refresh();
    vi.advanceTimersByTime(0);
    source.respond(failedSnapshot('Server down'));

    expect(store.deviceCount()).toEqual({
      data: { value: 12 },
      loading: false,
      error: 'Server down',
    });
    expect(store.lastUpdated()).toBe(updated);
  });

  it('applies partial failures per widget', () => {
    store.start();
    vi.advanceTimersByTime(0);
    source.respond({ ...snapshotFixture(), gauge: failed('Gauge down') });

    expect(store.gauge()).toEqual({ data: null, loading: false, error: 'Gauge down' });
    expect(store.deviceCount().error).toBeNull();
    expect(store.lastUpdated()).not.toBeNull();
  });

  it('reports a failed request on every widget', () => {
    const load = vi.spyOn(source, 'load');
    startAndLoad();
    load.mockReturnValueOnce(throwError(() => new Error('Network error')));
    store.refresh();
    vi.advanceTimersByTime(0);

    expect(store.devicesByType().error).toBe('Network error');
    expect(store.devicesByType().data).not.toBeNull();
    expect(store.refreshing()).toBe(false);
  });

  it('shows skeletons only for widgets without data during a refresh', () => {
    store.start();
    vi.advanceTimersByTime(0);
    source.respond({ ...snapshotFixture(), gauge: failed('x') });

    store.refresh();
    vi.advanceTimersByTime(0);
    expect(store.deviceCount().loading).toBe(false);
    expect(store.gauge().loading).toBe(true);
  });

  it('pages the fleet and keeps the page for later polls', () => {
    startAndLoad();
    store.setFleetPage(2);
    expect(store.fleet().loading).toBe(true);
    expect(source.pageRequests[0].page).toBe(2);

    source.pageRequests[0].response.next(fleetPageFixture(2));
    expect(store.fleet().data?.page).toBe(2);
    expect(store.fleet().loading).toBe(false);

    vi.advanceTimersByTime(INTERVAL);
    expect(source.queries[1].fleetPage).toBe(2);
  });

  it('ignores a polled fleet page the user has paged away from', () => {
    startAndLoad();
    store.refresh();
    vi.advanceTimersByTime(0);
    store.setFleetPage(3);
    source.pageRequests[0].response.next(fleetPageFixture(3));

    source.respond(snapshotFixture(1));
    expect(store.fleet().data?.page).toBe(3);
  });

  it('stays on the displayed page when paging fails', () => {
    startAndLoad();
    const pageSource = vi.spyOn(source, 'loadFleetPage');
    pageSource.mockReturnValueOnce(throwError(() => new Error('Page failed')));
    store.setFleetPage(2);

    expect(store.fleet().error).toBe('Page failed');
    expect(store.fleet().data?.page).toBe(1);
    vi.advanceTimersByTime(INTERVAL);
    expect(source.queries[1].fleetPage).toBe(1);
  });

  it('stops polling when destroyed', () => {
    startAndLoad();
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(INTERVAL * 5);
    expect(source.loads).toHaveLength(1);
  });
});

describe('errorMessage', () => {
  it('uses the error message or a generic fallback', () => {
    expect(errorMessage(new Error('Boom'))).toBe('Boom');
    expect(errorMessage('nope')).toBe('Something went wrong.');
    expect(errorMessage(new Error(''))).toBe('Something went wrong.');
  });
});
