import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Area,
  AreaCreate,
  AreaFilters,
  AreaUpdate,
  Plant,
  PlantCreate,
  PlantFilters,
  PlantUpdate,
} from '../../models';
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

  createPlant(body: PlantCreate): Observable<Plant> {
    return this.api.post<Plant>('/plants', body);
  }

  updatePlant(id: number, body: PlantUpdate): Observable<Plant> {
    return this.api.patch<Plant>(`/plants/${id}`, body);
  }

  deactivatePlant(id: number): Observable<Plant> {
    return this.api.delete<Plant>(`/plants/${id}`);
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

  createArea(body: AreaCreate): Observable<Area> {
    return this.api.post<Area>('/areas', body);
  }

  updateArea(id: number, body: AreaUpdate): Observable<Area> {
    return this.api.patch<Area>(`/areas/${id}`, body);
  }

  deactivateArea(id: number): Observable<Area> {
    return this.api.delete<Area>(`/areas/${id}`);
  }
}
