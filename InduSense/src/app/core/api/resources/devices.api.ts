import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  Device,
  DeviceConnection,
  DeviceConnectionCreate,
  DeviceConnectionUpdate,
  DeviceCreate,
  DeviceFilters,
  DeviceUpdate,
} from '../../models';
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

  create(body: DeviceCreate): Observable<Device> {
    return this.api.post<Device>('/devices', body);
  }

  update(id: number, body: DeviceUpdate): Observable<Device> {
    return this.api.patch<Device>(`/devices/${id}`, body);
  }

  /** Soft delete (status `delete`): the DataLogger stops storing its telemetry. */
  delete(id: number): Observable<Device> {
    return this.api.delete<Device>(`/devices/${id}`);
  }

  listConnections(deviceId: number): Observable<DeviceConnection[]> {
    return this.api.get<DeviceConnection[]>(`/devices/${deviceId}/connections`);
  }

  createConnection(deviceId: number, body: DeviceConnectionCreate): Observable<DeviceConnection> {
    return this.api.post<DeviceConnection>(`/devices/${deviceId}/connections`, body);
  }

  updateConnection(
    deviceId: number,
    connectionId: number,
    body: DeviceConnectionUpdate,
  ): Observable<DeviceConnection> {
    return this.api.patch<DeviceConnection>(
      `/devices/${deviceId}/connections/${connectionId}`,
      body,
    );
  }

  deleteConnection(deviceId: number, connectionId: number): Observable<void> {
    return this.api.delete<void>(`/devices/${deviceId}/connections/${connectionId}`);
  }
}
