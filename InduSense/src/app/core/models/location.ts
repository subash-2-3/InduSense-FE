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
