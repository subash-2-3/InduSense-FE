import { EditableStatus, IsoDateTime, RecordStatus, StatusFilter } from './common';

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
  operating_status: MachineStatus;
  status: RecordStatus;
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
  operating_status?: MachineStatus;
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
  operating_status?: MachineStatus;
  status?: EditableStatus;
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
  status: RecordStatus;
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
  status?: EditableStatus;
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
  status: RecordStatus;
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
  status?: EditableStatus;
}

/** List filters shared by plant assets. */
export interface PlantAssetFilters {
  plant_id?: number;
  area_id?: number;
  status?: StatusFilter | null;
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
  /** The device the tag was picked from; the backend rejects a tag of another device. */
  device_id?: number | null;
}

/** Metrics a machine can map (meters: all but PRODUCTION_COUNTER and RUN_STATUS). */
export const MACHINE_METRICS: readonly Metric[] = [
  'PRODUCTION_COUNTER',
  'RUN_STATUS',
  'POWER',
  'ENERGY',
  'VOLTAGE',
  'CURRENT',
  'FREQUENCY',
  'POWER_FACTOR',
];

export const METER_METRICS: readonly Metric[] = [
  'POWER',
  'ENERGY',
  'VOLTAGE',
  'CURRENT',
  'FREQUENCY',
  'POWER_FACTOR',
];

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
