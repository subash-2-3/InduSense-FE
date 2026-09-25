import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { DashboardSnapshot } from './dashboard-data-source';
import { DevScenarioService } from './dev-scenario.service';
import { MOCK_ERROR, MockDashboardDataSource } from './mock-dashboard.data-source';

describe('MockDashboardDataSource', () => {
  let source: MockDashboardDataSource;
  let scenario: DevScenarioService;
  const query = { fleetPage: 1, fleetPageSize: 10 };

  beforeEach(() => {
    vi.useFakeTimers();
    source = TestBed.inject(MockDashboardDataSource);
    scenario = TestBed.inject(DevScenarioService);
    source.random = () => 0; // 300 ms latency, deterministic jitter
  });

  afterEach(() => vi.useRealTimers());

  /** Subscribes and advances past the latency; returns what was emitted (or nothing). */
  function collect<T>(obs: Observable<T>, ms = 800): { value?: T; error?: unknown } {
    const result: { value?: T; error?: unknown } = {};
    obs.subscribe({ next: (v) => (result.value = v), error: (e) => (result.error = e) });
    vi.advanceTimersByTime(ms);
    return result;
  }

  const allOk = (s: DashboardSnapshot) => Object.values(s).every((r) => r.ok);

  it('responds after simulated latency with every widget', () => {
    const early = collect(source.load(query), 299);
    expect(early.value).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(early.value && allOk(early.value)).toBe(true);
  });

  it('moves the gauge and updates a machine on each load', () => {
    const first = collect(source.load(query)).value!;
    source.random = () => 0.99;
    const second = collect(source.load(query)).value!;
    if (!first.gauge.ok || !second.gauge.ok || !first.fleet.ok || !second.fleet.ok) {
      throw new Error('expected data');
    }
    expect(second.gauge.data.value).not.toBe(first.gauge.data.value);
    expect(second.gauge.data.value).toBeGreaterThanOrEqual(35);
    expect(second.gauge.data.value).toBeLessThanOrEqual(44.5);
  });

  it('fails every widget in the error scenario', () => {
    scenario.current.set('error');
    const snapshot = collect(source.load(query)).value!;
    expect(Object.values(snapshot).every((r) => !r.ok && r.error === MOCK_ERROR)).toBe(true);
  });

  it('fails two widgets in the partial scenario', () => {
    scenario.current.set('partial');
    const snapshot = collect(source.load(query)).value!;
    const failedKeys = Object.entries(snapshot)
      .filter(([, r]) => !r.ok)
      .map(([k]) => k);
    expect(failedKeys).toEqual(['devicesBySource', 'gauge']);
  });

  it('returns an empty plant in the empty scenario', () => {
    scenario.current.set('empty');
    const snapshot = collect(source.load(query)).value!;
    expect(allOk(snapshot)).toBe(true);
    expect(snapshot.deviceCount).toEqual({ ok: true, data: { value: 0 } });
    expect(snapshot.fleet.ok && snapshot.fleet.data.total).toBe(0);
    expect(snapshot.gauge.ok && snapshot.gauge.data.value).toBeNull();
  });

  it('never responds in the loading scenario', () => {
    scenario.current.set('loading');
    expect(collect(source.load(query), 60_000).value).toBeUndefined();
    expect(collect(source.loadFleetPage(2, 10), 60_000).value).toBeUndefined();
  });

  it('alternates success and failure in the flaky scenario', () => {
    scenario.current.set('flaky');
    const results = [1, 2, 3].map(() => allOk(collect(source.load(query)).value!));
    expect(results).toEqual([true, false, true]);
  });

  it('pages the fleet, and fails paging in the error scenario', () => {
    const page = collect(source.loadFleetPage(3, 10)).value!;
    expect(page).toMatchObject({ page: 3, total: 25 });
    expect(page.rows).toHaveLength(5);

    scenario.current.set('error');
    expect(collect(source.loadFleetPage(2, 10)).error).toEqual(new Error(MOCK_ERROR));
  });
});
