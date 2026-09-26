import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CategorySliceVm,
  FleetPageVm,
  GaugeVm,
  KpiVm,
  StackedBarVm,
  StatusSliceVm,
} from '../models/dashboard.vm';
import { ApiDashboardDataSource } from './api-dashboard.data-source';
import { WidgetResult } from './widget-result';

export type { WidgetResult } from './widget-result';

export interface DashboardSnapshot {
  deviceCount: WidgetResult<KpiVm>;
  deviceTypeCount: WidgetResult<KpiVm>;
  devicesByType: WidgetResult<CategorySliceVm[]>;
  devicesByConnection: WidgetResult<StatusSliceVm[]>;
  devicesBySource: WidgetResult<StackedBarVm>;
  fleet: WidgetResult<FleetPageVm>;
  gauge: WidgetResult<GaugeVm>;
}

export interface DashboardQuery {
  /** 1-based page of the machine fleet table. */
  fleetPage: number;
  fleetPageSize: number;
}

/**
 * Where the Device Summary gets its data. Production default: ApiDashboardDataSource.
 */
export interface DashboardDataSource {
  /** All widgets. Emits once and completes; per-widget failures are reported in the snapshot. */
  load(query: DashboardQuery): Observable<DashboardSnapshot>;
  /** One page of the machine fleet (table paging). Errors if the page can't be loaded. */
  loadFleetPage(page: number, pageSize: number): Observable<FleetPageVm>;
}

export const DASHBOARD_DATA_SOURCE = new InjectionToken<DashboardDataSource>(
  'DASHBOARD_DATA_SOURCE',
  { providedIn: 'root', factory: () => inject(ApiDashboardDataSource) },
);
