import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { HistoryQuery, LatestQuery, LatestValue, TelemetryPoint } from '../../models';
import { Page } from '../api-envelope';
import { ApiService } from '../api.service';

/** Timestamps are sent in ISO 8601 with an offset, as the API requires. */
export function toApiTime(value: Date | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value instanceof Date ? value.toISOString() : value;
}

/** `/telemetry` (requires `telemetry:view`). Read-only. */
@Injectable({ providedIn: 'root' })
export class TelemetryApi {
  private readonly api = inject(ApiService);

  /** Latest value per tag, for a device's tags and/or the given tags. */
  latest(query: LatestQuery): Observable<LatestValue[]> {
    return this.api.get<LatestValue[]>('/telemetry/latest', {
      device_id: query.deviceId,
      tag_id: query.tagIds,
    });
  }

  /** Telemetry history, one page at a time. */
  history(query: HistoryQuery): Observable<Page<TelemetryPoint>> {
    return this.api.getPage<TelemetryPoint>('/telemetry', {
      device_id: query.deviceId,
      tag_id: query.tagIds,
      start_time: toApiTime(query.start),
      end_time: toApiTime(query.end),
      quality: query.quality,
      order: query.order,
      page: query.page,
      page_size: query.pageSize,
    });
  }
}
