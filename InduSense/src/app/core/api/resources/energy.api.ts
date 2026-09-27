import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CumulativeRow,
  DetailRow,
  EnergyDetailFilters,
  EnergyDistribution,
  EnergyExportFilters,
  EnergyFilters,
  EnergyGroupBy,
  EnergyLive,
  EnergyOverview,
  EnergyPage,
  EnergyPageFilters,
  EnergyRangeFilters,
  EnergyReportSummary,
  EnergyTrendFilters,
  EnergyTrends,
} from '../../models';
import { ApiService, Download, queryOf } from '../api.service';

/**
 * Energy dashboard (`/dashboards/energy/*`, `dashboards:view`) and energy reports
 * (`/reports/energy/*`, `reports:view`). The backend derives the company from the session.
 */
@Injectable({ providedIn: 'root' })
export class EnergyApi {
  private readonly api = inject(ApiService);

  overview(filters: EnergyRangeFilters = {}): Observable<EnergyOverview> {
    return this.api.get<EnergyOverview>('/dashboards/energy/overview', queryOf(filters));
  }

  live(filters: EnergyFilters = {}): Observable<EnergyLive> {
    return this.api.get<EnergyLive>('/dashboards/energy/live', queryOf(filters));
  }

  trends(filters: EnergyTrendFilters = {}): Observable<EnergyTrends> {
    return this.api.get<EnergyTrends>('/dashboards/energy/trends', queryOf(filters));
  }

  distribution(
    filters: EnergyRangeFilters & { group_by?: EnergyGroupBy } = {},
  ): Observable<EnergyDistribution> {
    return this.api.get<EnergyDistribution>('/dashboards/energy/distribution', queryOf(filters));
  }

  reportSummary(filters: EnergyRangeFilters = {}): Observable<EnergyReportSummary> {
    return this.api.get<EnergyReportSummary>('/reports/energy/summary', queryOf(filters));
  }

  reportCumulative(filters: EnergyPageFilters = {}): Observable<EnergyPage<CumulativeRow>> {
    return this.api.getRaw<EnergyPage<CumulativeRow>>(
      '/reports/energy/cumulative',
      queryOf(filters),
    );
  }

  reportDetails(filters: EnergyDetailFilters = {}): Observable<EnergyPage<DetailRow>> {
    return this.api.getRaw<EnergyPage<DetailRow>>('/reports/energy/details', queryOf(filters));
  }

  /** The filtered report as a CSV or Excel file (every row, not one page). */
  export(filters: EnergyExportFilters): Observable<Download> {
    return this.api.download('/reports/energy/export', queryOf(filters));
  }
}
