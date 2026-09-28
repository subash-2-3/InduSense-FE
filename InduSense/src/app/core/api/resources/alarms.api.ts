import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ActiveAlarms,
  AlarmDefinition,
  AlarmDefinitionItem,
  AlarmFilters,
  AlarmHistoryFilters,
  AlarmHistoryPage,
  AlarmTag,
} from '../../models';
import { ApiService, Download, queryOf } from '../api.service';

/** `/alarms/*`: `alarms:view`; changing bit names needs `alarms:manage`. */
@Injectable({ providedIn: 'root' })
export class AlarmsApi {
  private readonly api = inject(ApiService);

  tags(filters: AlarmFilters = {}): Observable<AlarmTag[]> {
    return this.api.get<AlarmTag[]>('/alarms/tags', queryOf(filters));
  }

  definitions(tagId: number): Observable<AlarmDefinition[]> {
    return this.api.get<AlarmDefinition[]>(`/alarms/tags/${tagId}/definitions`);
  }

  /** The listed bits get these names; bits not listed lose theirs. */
  saveDefinitions(
    tagId: number,
    definitions: AlarmDefinitionItem[],
  ): Observable<AlarmDefinition[]> {
    return this.api.put<AlarmDefinition[]>(`/alarms/tags/${tagId}/definitions`, { definitions });
  }

  active(filters: AlarmFilters = {}): Observable<ActiveAlarms> {
    return this.api.get<ActiveAlarms>('/alarms/active', queryOf(filters));
  }

  history(filters: AlarmHistoryFilters = {}): Observable<AlarmHistoryPage> {
    return this.api.getRaw<AlarmHistoryPage>('/alarms/history', queryOf(filters));
  }

  exportHistory(filters: AlarmHistoryFilters, format: 'csv' | 'xlsx'): Observable<Download> {
    return this.api.download('/alarms/history/export', queryOf({ ...filters, format }));
  }
}
