import { IsoDateTime } from './common';

export type MachineStatus = 'RUNNING' | 'IDLE' | 'STOPPED' | 'MAINTENANCE' | 'FAULT' | 'UNKNOWN';

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

/** List filters shared by machines and gateways. */
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
