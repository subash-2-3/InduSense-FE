import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Gateway, Machine, MachineFilters, PlantAssetFilters } from '../../models';
import { Page, PageParams } from '../api-envelope';
import { ApiService, queryOf } from '../api.service';

/** Machines and gateways share one endpoint set on the backend (`build_router` factory). */
abstract class PlantAssetApi<T, F extends PlantAssetFilters> {
  protected abstract readonly path: string;
  private readonly api = inject(ApiService);

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
}

/** `/machines` (requires `machines:view`). */
@Injectable({ providedIn: 'root' })
export class MachinesApi extends PlantAssetApi<Machine, MachineFilters> {
  protected readonly path = '/machines';
}

/** `/gateways` (requires `gateways:view`). */
@Injectable({ providedIn: 'root' })
export class GatewaysApi extends PlantAssetApi<Gateway, PlantAssetFilters> {
  protected readonly path = '/gateways';
}
