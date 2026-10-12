import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  EnergyExportFormat,
  MachineCumulativePage,
  MachineWideDetailsPage,
  MachineExportReport,
  MachineReportFilters,
  MachineReportSummary,
} from '../../models';
import { ApiService, Download, queryOf } from '../api.service';

/** Machine (OEE) reports: `/reports/machines/*` (requires `reports:view`). */
@Injectable({ providedIn: 'root' })
export class MachineReportsApi {
  private readonly api = inject(ApiService);

  summary(filters: MachineReportFilters = {}): Observable<MachineReportSummary> {
    return this.api.get<MachineReportSummary>('/reports/machines/summary', queryOf(filters));
  }

  cumulative(filters: MachineReportFilters = {}): Observable<MachineCumulativePage> {
    return this.api.getRaw<MachineCumulativePage>('/reports/machines/cumulative', queryOf(filters));
  }

  /** Raw readings, newest first. Pass `cursor: ''` and then each `next_cursor` (no total is counted). */
  details(filters: MachineReportFilters = {}): Observable<MachineWideDetailsPage> {
    return this.api.getRaw<MachineWideDetailsPage>('/reports/machines/details', queryOf(filters));
  }

  /** The filtered report as a CSV or Excel file (every row, not one page). */
  export(
    filters: MachineReportFilters & { report: MachineExportReport; format: EnergyExportFormat },
  ): Observable<Download> {
    return this.api.download('/reports/machines/export', queryOf(filters));
  }
}
