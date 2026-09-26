import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DashboardTimeFilters,
  GatewayDashboard,
  MachineDashboard,
  MeterDashboard,
  OverviewDashboard,
  PlantDashboard,
} from '../../models';
import { ApiService, queryOf } from '../api.service';

export interface OverviewDashboardFilters extends DashboardTimeFilters {
  plant_id?: number;
}

export interface PlantDashboardFilters extends DashboardTimeFilters {
  area_id?: number;
}

/** `/dashboards/*` (requires `dashboards:view`). */
@Injectable({ providedIn: 'root' })
export class DashboardsApi {
  private readonly api = inject(ApiService);

  overview(filters: OverviewDashboardFilters = {}): Observable<OverviewDashboard> {
    return this.api.get<OverviewDashboard>('/dashboards/overview', queryOf(filters));
  }

  plant(plantId: number, filters: PlantDashboardFilters = {}): Observable<PlantDashboard> {
    return this.api.get<PlantDashboard>(`/dashboards/plants/${plantId}`, queryOf(filters));
  }

  machine(machineId: number, filters: DashboardTimeFilters = {}): Observable<MachineDashboard> {
    return this.api.get<MachineDashboard>(`/dashboards/machines/${machineId}`, queryOf(filters));
  }

  meter(meterId: number, filters: DashboardTimeFilters = {}): Observable<MeterDashboard> {
    return this.api.get<MeterDashboard>(`/dashboards/meters/${meterId}`, queryOf(filters));
  }

  gateway(gatewayId: number, filters: DashboardTimeFilters = {}): Observable<GatewayDashboard> {
    return this.api.get<GatewayDashboard>(`/dashboards/gateways/${gatewayId}`, queryOf(filters));
  }
}
