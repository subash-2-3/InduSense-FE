import { EditableStatus, IsoDateTime, RecordStatus, StatusFilter } from './common';

/** `BusinessUnitResponse` (InduSense-BE `app/schemas/location.py`): Company -> Business Unit -> Plant. */
export interface BusinessUnit {
  id: number;
  company_id: number;
  code: string;
  name: string;
  description: string | null;
  status: RecordStatus;
  /** Plants in it that are not deleted. */
  plants: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface BusinessUnitCreate {
  /** Platform administrators only. */
  company_id?: number | null;
  code: string;
  name: string;
  description?: string | null;
}

export interface BusinessUnitUpdate {
  code?: string;
  name?: string;
  description?: string | null;
  status?: EditableStatus;
}

export interface BusinessUnitFilters {
  status?: StatusFilter | null;
  /** Matches code or name. */
  search?: string;
  /** Platform administrators only. */
  company_id?: number;
}

/** `PlantResponse` (InduSense-BE `app/schemas/location.py`). */
export interface Plant {
  id: number;
  company_id: number;
  /** null: not in a business unit. */
  business_unit_id: number | null;
  code: string;
  name: string;
  address: string | null;
  /** IANA name; null means the company's timezone. */
  timezone: string | null;
  status: RecordStatus;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface PlantCreate {
  company_id?: number | null;
  business_unit_id?: number | null;
  code: string;
  name: string;
  address?: string | null;
  timezone?: string | null;
}

export interface PlantUpdate {
  /** null removes the plant from its business unit. */
  business_unit_id?: number | null;
  code?: string;
  name?: string;
  address?: string | null;
  timezone?: string | null;
  status?: EditableStatus;
}

/** `AreaResponse`. */
export interface Area {
  id: number;
  company_id: number;
  plant_id: number;
  code: string;
  name: string;
  description: string | null;
  status: RecordStatus;
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
  status?: EditableStatus;
}

export interface PlantFilters {
  status?: StatusFilter | null;
  business_unit_id?: number;
  /** Matches code or name. */
  search?: string;
  /** Platform administrators only. */
  company_id?: number;
}

export interface AreaFilters {
  plant_id?: number;
  status?: StatusFilter | null;
  /** Matches code or name. */
  search?: string;
}
