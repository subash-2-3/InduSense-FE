import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DeviceHealthFilters,
  DeviceHealthResponse,
  DowntimeReportFilters,
  DowntimeRow,
  DowntimeSummary,
  EnergyReportFilters,
  EnergyRow,
  EnergySummary,
  OeeReportFilters,
  OeeRow,
  OeeSummary,
  ProductionReportFilters,
  ProductionRow,
  ProductionSummary,
  ReportResponse,
  RuntimeReportFilters,
  RuntimeRow,
  RuntimeSummary,
} from '../../models';
import { ApiService, queryOf } from '../api.service';

/** `/reports/*` (requires `reports:view`). */
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly api = inject(ApiService);

  energy(filters: EnergyReportFilters = {}): Observable<ReportResponse<EnergySummary, EnergyRow>> {
    return this.api.getRaw<ReportResponse<EnergySummary, EnergyRow>>(
      '/reports/energy',
      queryOf(filters),
    );
  }

  production(
    filters: ProductionReportFilters = {},
  ): Observable<ReportResponse<ProductionSummary, ProductionRow>> {
    return this.api.getRaw<ReportResponse<ProductionSummary, ProductionRow>>(
      '/reports/production',
      queryOf(filters),
    );
  }

  machineRuntime(
    filters: RuntimeReportFilters = {},
  ): Observable<ReportResponse<RuntimeSummary, RuntimeRow>> {
    return this.api.getRaw<ReportResponse<RuntimeSummary, RuntimeRow>>(
      '/reports/machine-runtime',
      queryOf(filters),
    );
  }

  downtime(
    filters: DowntimeReportFilters = {},
  ): Observable<ReportResponse<DowntimeSummary, DowntimeRow>> {
    return this.api.getRaw<ReportResponse<DowntimeSummary, DowntimeRow>>(
      '/reports/downtime',
      queryOf(filters),
    );
  }

  oee(filters: OeeReportFilters = {}): Observable<ReportResponse<OeeSummary, OeeRow>> {
    return this.api.getRaw<ReportResponse<OeeSummary, OeeRow>>('/reports/oee', queryOf(filters));
  }

  deviceHealth(filters: DeviceHealthFilters = {}): Observable<DeviceHealthResponse> {
    return this.api.getRaw<DeviceHealthResponse>('/reports/device-health', queryOf(filters));
  }
}
