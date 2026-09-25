import { Injectable, inject } from '@angular/core';
import { NEVER, Observable, defer, delay, of, throwError } from 'rxjs';

import { APP_CONFIG } from '../../../core/config/app-config';
import { FleetPageVm, FleetRowVm, GaugeVm } from '../models/dashboard.vm';
import type {
  DashboardDataSource,
  DashboardQuery,
  DashboardSnapshot,
} from './dashboard-data-source';
import {
  MOCK_DEVICE_COUNT,
  MOCK_DEVICE_TYPE_COUNT,
  MOCK_DEVICES_BY_CONNECTION,
  MOCK_DEVICES_BY_SOURCE,
  MOCK_DEVICES_BY_TYPE,
  MOCK_GAUGE,
  createMockFleet,
  mockFleetPage,
} from './dashboard.mock';
import { DevScenarioService } from './dev-scenario.service';
import { failed, ok } from './widget-result';

export const MOCK_ERROR = "The server didn't respond. Check the connection and try again.";

const LIVE_STATUSES = ['RUNNING', 'RUNNING', 'RUNNING', 'IDLE', 'MAINTENANCE', 'FAULT', 'STOPPED'];

/**
 * UI Track data source: the mock plant with simulated latency (300–800 ms). Every successful
 * load moves the gauge and updates one machine, so polling is visible. Behaviour follows the
 * dev scenario (see DevScenarioService). Makes no HTTP calls.
 */
@Injectable({ providedIn: 'root' })
export class MockDashboardDataSource implements DashboardDataSource {
  private readonly scenario = inject(DevScenarioService).current;
  private readonly gaugeScale = inject(APP_CONFIG).gauge;

  /** Replaceable in tests for deterministic latency and jitter. */
  random: () => number = Math.random;

  private fleet: FleetRowVm[] = createMockFleet();
  private gaugeValue = MOCK_GAUGE.value ?? 40;
  private loads = 0;

  load(query: DashboardQuery): Observable<DashboardSnapshot> {
    return defer(() => {
      const scenario = this.scenario();
      if (scenario === 'loading') {
        return NEVER;
      }
      const attempt = this.loads++;
      let snapshot: DashboardSnapshot;
      if (scenario === 'error' || (scenario === 'flaky' && attempt % 2 === 1)) {
        snapshot = allFailed(MOCK_ERROR);
      } else if (scenario === 'empty') {
        snapshot = this.emptySnapshot(query);
      } else {
        this.simulateLiveChanges();
        snapshot = this.snapshot(query);
        if (scenario === 'partial') {
          snapshot = {
            ...snapshot,
            devicesBySource: failed(MOCK_ERROR),
            gauge: failed(MOCK_ERROR),
          };
        }
      }
      return of(snapshot).pipe(delay(this.latency()));
    });
  }

  loadFleetPage(page: number, pageSize: number): Observable<FleetPageVm> {
    return defer(() => {
      const scenario = this.scenario();
      if (scenario === 'loading') {
        return NEVER;
      }
      if (scenario === 'error') {
        return throwError(() => new Error(MOCK_ERROR));
      }
      const fleet = scenario === 'empty' ? [] : this.fleet;
      return of(mockFleetPage(page, pageSize, fleet)).pipe(delay(this.latency()));
    });
  }

  private latency(): number {
    return 300 + Math.round(this.random() * 500);
  }

  /** Drifts the gauge and gives one machine a new status and update time. */
  private simulateLiveChanges(): void {
    const now = new Date().toISOString();
    const drift = (this.random() - 0.5) * 3;
    this.gaugeValue = Math.round(Math.min(44.5, Math.max(35, this.gaugeValue + drift)) * 10) / 10;

    const index = Math.floor(this.random() * this.fleet.length);
    const status = LIVE_STATUSES[Math.floor(this.random() * LIVE_STATUSES.length)];
    this.fleet = this.fleet.map((row, i) =>
      i === index ? { ...row, status, updatedAt: now } : row,
    );
  }

  private snapshot(query: DashboardQuery): DashboardSnapshot {
    const gauge: GaugeVm = {
      value: this.gaugeValue,
      unit: MOCK_GAUGE.unit || this.gaugeScale.unit,
      ts: new Date().toISOString(),
    };
    return {
      deviceCount: ok(MOCK_DEVICE_COUNT),
      deviceTypeCount: ok(MOCK_DEVICE_TYPE_COUNT),
      devicesByType: ok(MOCK_DEVICES_BY_TYPE),
      devicesByConnection: ok(MOCK_DEVICES_BY_CONNECTION),
      devicesBySource: ok(MOCK_DEVICES_BY_SOURCE),
      fleet: ok(mockFleetPage(query.fleetPage, query.fleetPageSize, this.fleet)),
      gauge: ok(gauge),
    };
  }

  private emptySnapshot(query: DashboardQuery): DashboardSnapshot {
    return {
      deviceCount: ok({ value: 0 }),
      deviceTypeCount: ok({ value: 0 }),
      devicesByType: ok([]),
      devicesByConnection: ok(MOCK_DEVICES_BY_CONNECTION.map((s) => ({ ...s, value: 0 }))),
      devicesBySource: ok({ categories: [], series: [] }),
      fleet: ok(mockFleetPage(query.fleetPage, query.fleetPageSize, [])),
      gauge: ok({ value: null, unit: this.gaugeScale.unit, ts: null }),
    };
  }
}

function allFailed(error: string): DashboardSnapshot {
  return {
    deviceCount: failed(error),
    deviceTypeCount: failed(error),
    devicesByType: failed(error),
    devicesByConnection: failed(error),
    devicesBySource: failed(error),
    fleet: failed(error),
    gauge: failed(error),
  };
}
