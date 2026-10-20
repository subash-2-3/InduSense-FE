import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  BusinessUnit,
  BusinessUnitCreate,
  BusinessUnitFilters,
  BusinessUnitUpdate,
} from '../../models';
import { Page, PageParams } from '../api-envelope';
import { ApiService } from '../api.service';

/** `/business-units` (Company -> Business Unit -> Plant): `business_units:view|create|update|delete`. */
@Injectable({ providedIn: 'root' })
export class BusinessUnitsApi {
  private readonly api = inject(ApiService);

  list(filters: BusinessUnitFilters & PageParams = {}): Observable<Page<BusinessUnit>> {
    return this.api.getPage<BusinessUnit>('/business-units', { ...filters });
  }

  listAll(filters: BusinessUnitFilters = {}): Observable<BusinessUnit[]> {
    return this.api.getAllPages<BusinessUnit>('/business-units', { ...filters });
  }

  get(id: number): Observable<BusinessUnit> {
    return this.api.get<BusinessUnit>(`/business-units/${id}`);
  }

  create(body: BusinessUnitCreate): Observable<BusinessUnit> {
    return this.api.post<BusinessUnit>('/business-units', body);
  }

  update(id: number, body: BusinessUnitUpdate): Observable<BusinessUnit> {
    return this.api.patch<BusinessUnit>(`/business-units/${id}`, body);
  }

  /** Soft delete; 409 BUSINESS_UNIT_HAS_PLANTS while plants are still in it. */
  delete(id: number): Observable<BusinessUnit> {
    return this.api.delete<BusinessUnit>(`/business-units/${id}`);
  }
}
