import { Observable, Subject, take } from 'rxjs';

import { FleetPageVm } from '../models/dashboard.vm';
import { DashboardDataSource, DashboardQuery, DashboardSnapshot } from './dashboard-data-source';
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
import { failed, ok } from './widget-result';

/** Data source whose responses are pushed by the test. */
export class ControlledDataSource implements DashboardDataSource {
  readonly queries: DashboardQuery[] = [];
  readonly loads: Subject<DashboardSnapshot>[] = [];
  readonly pageRequests: { page: number; response: Subject<FleetPageVm> }[] = [];

  load(query: DashboardQuery): Observable<DashboardSnapshot> {
    this.queries.push(query);
    const response = new Subject<DashboardSnapshot>();
    this.loads.push(response);
    return response.pipe(take(1));
  }

  loadFleetPage(page: number): Observable<FleetPageVm> {
    const response = new Subject<FleetPageVm>();
    this.pageRequests.push({ page, response });
    return response.pipe(take(1));
  }

  /** Completes the most recent dashboard load. */
  respond(snapshot: DashboardSnapshot): void {
    this.loads[this.loads.length - 1].next(snapshot);
  }
}

const FLEET = createMockFleet(Date.parse('2026-09-25T12:00:00Z'));

export function snapshotFixture(fleetPage = 1): DashboardSnapshot {
  return {
    deviceCount: ok(MOCK_DEVICE_COUNT),
    deviceTypeCount: ok(MOCK_DEVICE_TYPE_COUNT),
    devicesByType: ok(MOCK_DEVICES_BY_TYPE),
    devicesByConnection: ok(MOCK_DEVICES_BY_CONNECTION),
    devicesBySource: ok(MOCK_DEVICES_BY_SOURCE),
    fleet: ok(mockFleetPage(fleetPage, 10, FLEET)),
    gauge: ok(MOCK_GAUGE),
  };
}

export function failedSnapshot(error = 'down'): DashboardSnapshot {
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

export function fleetPageFixture(page: number): FleetPageVm {
  return mockFleetPage(page, 10, FLEET);
}
