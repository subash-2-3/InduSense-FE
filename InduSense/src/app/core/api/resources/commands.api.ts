import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DeviceCommand, MachineControls } from '../../models';
import { Page, PageParams } from '../api-envelope';
import { ApiService, queryOf } from '../api.service';

/** Machine controls and device commands (`devices:control` to send, `devices:view` to read). */
@Injectable({ providedIn: 'root' })
export class CommandsApi {
  private readonly api = inject(ApiService);

  controls(machineId: number): Observable<MachineControls> {
    return this.api.get<MachineControls>(`/machines/${machineId}/controls`);
  }

  /** Queues a register write; the DataLogger executes it (or it expires). */
  send(deviceId: number, tagId: number, value: number): Observable<DeviceCommand> {
    return this.api.post<DeviceCommand>(`/devices/${deviceId}/commands`, { tag_id: tagId, value });
  }

  get(deviceId: number, commandId: number): Observable<DeviceCommand> {
    return this.api.get<DeviceCommand>(`/devices/${deviceId}/commands/${commandId}`);
  }

  history(deviceId: number, paging: PageParams = {}): Observable<Page<DeviceCommand>> {
    return this.api.getPage<DeviceCommand>(`/devices/${deviceId}/commands`, queryOf(paging));
  }
}
