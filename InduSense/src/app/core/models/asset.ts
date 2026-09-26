import { IsoDateTime } from './common';

export type MachineStatus = 'RUNNING' | 'IDLE' | 'STOPPED' | 'MAINTENANCE' | 'FAULT' | 'UNKNOWN';

export type Metric =
  | 'POWER'
  | 'ENERGY'
  | 'PRODUCTION_COUNTER'
  | 'RUN_STATUS'
  | 'VOLTAGE'
  | 'CURRENT'
  | 'FREQUENCY'
  | 'POWER_FACTOR';

/** `MachineResponse` (InduSense-BE `app/schemas/asset.py`). */
export interface Machine {
  id: number;
  company_id: number;
  plant_id: number;
  area_id: number | null;
  /** Data source of this machine. */
  device_id: number | null;
  machine_code: string;
  name: string;
  machine_type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: MachineStatus;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface MachineCreate {
  plant_id: number;
  area_id?: number | null;
  device_id?: number | null;
  machine_code: string;
  name: string;
  machine_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status?: MachineStatus;
}

export interface MachineUpdate {
  plant_id?: number;
  area_id?: number | null;
  device_id?: number | null;
  machine_code?: string;
  name?: string;
  machine_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status?: MachineStatus;
  is_active?: boolean;
}

/** `MeterResponse`. */
export interface Meter {
  id: number;
  company_id: number;
  plant_id: number;
  area_id: number | null;
  device_id: number | null;
  meter_code: string;
  name: string;
  meter_type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  unit: string | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface MeterCreate {
  plant_id: number;
  area_id?: number | null;
  device_id?: number | null;
  meter_code: string;
  name: string;
  meter_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  unit?: string | null;
}

export interface MeterUpdate {
  plant_id?: number;
  area_id?: number | null;
  device_id?: number | null;
  meter_code?: string;
  name?: string;
  meter_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  unit?: string | null;
  is_active?: boolean;
}

/** `GatewayResponse`. */
export interface Gateway {
  id: number;
  company_id: number;
  plant_id: number;
  area_id: number | null;
  gateway_code: string;
  name: string;
  /** e.g. `VBOX`, `VNET`, `IOT_GATEWAY`, `MODBUS_GATEWAY`, `OPCUA_GATEWAY`. */
  gateway_type: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  ip_address: string | null;
  port: number | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface GatewayCreate {
  plant_id: number;
  area_id?: number | null;
  gateway_code: string;
  name: string;
  gateway_type: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  ip_address?: string | null;
  port?: number | null;
}

export interface GatewayUpdate {
  plant_id?: number;
  area_id?: number | null;
  gateway_code?: string;
  name?: string;
  gateway_type?: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  ip_address?: string | null;
  port?: number | null;
  is_active?: boolean;
}

/** List filters shared by plant assets. */
export interface PlantAssetFilters {
  plant_id?: number;
  area_id?: number;
  is_active?: boolean;
  /** Matches code, name or serial number. */
  search?: string;
}

export interface MachineFilters extends PlantAssetFilters {
  device_id?: number;
}

export interface MeterFilters extends PlantAssetFilters {
  device_id?: number;
}

/** Tag mapping for machine / meter metrics. */
export interface TagMappingItem {
  metric: Metric;
  tag_id: number;
}

export interface TagMappingsUpdate {
  mappings: TagMappingItem[];
}

export interface TagMappingResponse {
  metric: Metric | string;
  tag_id: number;
  device_id: number;
  tag_name: string;
  display_name: string | null;
  unit: string | null;
}
