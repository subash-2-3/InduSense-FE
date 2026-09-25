import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Area, AreaFilters, Plant, PlantFilters } from '../../models';
import { Page, PageParams } from '../api-envelope';
import { ApiService } from '../api.service';

/** `/plants` (requires `plants:view`) and `/areas` (requires `areas:view`). */
@Injectable({ providedIn: 'root' })
export class LocationsApi {
  private readonly api = inject(ApiService);

  listPlants(filters: PlantFilters & PageParams = {}): Observable<Page<Plant>> {
    return this.api.getPage<Plant>('/plants', { ...filters });
  }

  listAllPlants(filters: PlantFilters = {}): Observable<Plant[]> {
    return this.api.getAllPages<Plant>('/plants', { ...filters });
  }

  getPlant(id: number): Observable<Plant> {
    return this.api.get<Plant>(`/plants/${id}`);
  }

  listAreas(filters: AreaFilters & PageParams = {}): Observable<Page<Area>> {
    return this.api.getPage<Area>('/areas', { ...filters });
  }

  listAllAreas(filters: AreaFilters = {}): Observable<Area[]> {
    return this.api.getAllPages<Area>('/areas', { ...filters });
  }

  getArea(id: number): Observable<Area> {
    return this.api.get<Area>(`/areas/${id}`);
  }
}
