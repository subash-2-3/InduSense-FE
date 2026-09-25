import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { Device, DeviceFilters } from '../../models';
import { Page, PageParams } from '../api-envelope';
import { ApiService } from '../api.service';

/** `/devices` (requires `devices:view`). */
@Injectable({ providedIn: 'root' })
export class DevicesApi {
  private readonly api = inject(ApiService);

  list(filters: DeviceFilters & PageParams = {}): Observable<Page<Device>> {
    return this.api.getPage<Device>('/devices', { ...filters });
  }

  /** Every device matching the filters (pages through the list). */
  listAll(filters: DeviceFilters = {}): Observable<Device[]> {
    return this.api.getAllPages<Device>('/devices', { ...filters });
  }

  /** Number of devices matching the filters, from a one-item page. */
  count(filters: DeviceFilters = {}): Observable<number> {
    return this.list({ ...filters, page: 1, page_size: 1 }).pipe(map((p) => p.pagination.total));
  }

  get(id: number): Observable<Device> {
    return this.api.get<Device>(`/devices/${id}`);
  }
}
