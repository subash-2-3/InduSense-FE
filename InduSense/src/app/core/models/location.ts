import { IsoDateTime } from './common';

/** `PlantResponse` (InduSense-BE `app/schemas/location.py`). */
export interface Plant {
  id: number;
  company_id: number;
  code: string;
  name: string;
  address: string | null;
  /** IANA name; null means the company's timezone. */
  timezone: string | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface PlantCreate {
  company_id?: number | null;
  code: string;
  name: string;
  address?: string | null;
  timezone?: string | null;
}

export interface PlantUpdate {
  code?: string;
  name?: string;
  address?: string | null;
  timezone?: string | null;
  is_active?: boolean | null;
}

/** `AreaResponse`. */
export interface Area {
  id: number;
  company_id: number;
  plant_id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AreaCreate {
  plant_id: number;
  code: string;
  name: string;
  description?: string | null;
}

export interface AreaUpdate {
  code?: string;
  name?: string;
  description?: string | null;
  is_active?: boolean | null;
}

export interface PlantFilters {
  is_active?: boolean;
  /** Matches code or name. */
  search?: string;
  /** Platform administrators only. */
  company_id?: number;
}

export interface AreaFilters {
  plant_id?: number;
  is_active?: boolean;
  /** Matches code or name. */
  search?: string;
}
