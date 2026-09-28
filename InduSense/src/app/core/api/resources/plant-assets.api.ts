import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Gateway,
  GatewayCreate,
  GatewayUpdate,
  Machine,
  MachineCreate,
  MachineFilters,
  MachineUpdate,
  Meter,
  MeterCreate,
  MeterFilters,
  MeterUpdate,
  PlantAssetFilters,
  TagMappingItem,
  TagMappingResponse,
} from '../../models';
import { Page, PageParams } from '../api-envelope';
import { ApiService, queryOf } from '../api.service';

/** Machines, meters and gateways share one endpoint set on the backend (`build_router` factory). */
abstract class PlantAssetApi<T, F extends PlantAssetFilters, C = object, U = object> {
  protected abstract readonly path: string;
  protected readonly api = inject(ApiService);

  list(filters: F & PageParams = {} as F & PageParams): Observable<Page<T>> {
    return this.api.getPage<T>(this.path, queryOf(filters));
  }

  /** Every item matching the filters (pages through the list). */
  listAll(filters: F = {} as F): Observable<T[]> {
    return this.api.getAllPages<T>(this.path, queryOf(filters));
  }

  get(id: number): Observable<T> {
    return this.api.get<T>(`${this.path}/${id}`);
  }

  create(body: C): Observable<T> {
    return this.api.post<T>(this.path, body);
  }

  update(id: number, body: U): Observable<T> {
    return this.api.patch<T>(`${this.path}/${id}`, body);
  }

  /** Soft delete (status `delete`). */
  delete(id: number): Observable<T> {
    return this.api.delete<T>(`${this.path}/${id}`);
  }
}

/** `/machines` (requires `machines:view`). */
@Injectable({ providedIn: 'root' })
export class MachinesApi extends PlantAssetApi<
  Machine,
  MachineFilters,
  MachineCreate,
  MachineUpdate
> {
  protected readonly path = '/machines';

  tagMappings(machineId: number): Observable<TagMappingResponse[]> {
    return this.api.get<TagMappingResponse[]>(`${this.path}/${machineId}/tag-mappings`);
  }

  setTagMappings(machineId: number, mappings: TagMappingItem[]): Observable<TagMappingResponse[]> {
    return this.api.put<TagMappingResponse[]>(`${this.path}/${machineId}/tag-mappings`, {
      mappings,
    });
  }
}

/** `/meters` (requires `meters:view`). */
@Injectable({ providedIn: 'root' })
export class MetersApi extends PlantAssetApi<Meter, MeterFilters, MeterCreate, MeterUpdate> {
  protected readonly path = '/meters';

  tagMappings(meterId: number): Observable<TagMappingResponse[]> {
    return this.api.get<TagMappingResponse[]>(`${this.path}/${meterId}/tag-mappings`);
  }

  setTagMappings(meterId: number, mappings: TagMappingItem[]): Observable<TagMappingResponse[]> {
    return this.api.put<TagMappingResponse[]>(`${this.path}/${meterId}/tag-mappings`, { mappings });
  }
}

/** `/gateways` (requires `gateways:view`). */
@Injectable({ providedIn: 'root' })
export class GatewaysApi extends PlantAssetApi<
  Gateway,
  PlantAssetFilters,
  GatewayCreate,
  GatewayUpdate
> {
  protected readonly path = '/gateways';
}
