import { IsoDateTime } from './common';

/** Derived by the API from `last_seen_at` (OFFLINE after DEVICE_OFFLINE_AFTER_SECONDS). */
export type ConnectionState = 'ONLINE' | 'OFFLINE' | 'NEVER_SEEN';

/** `DeviceResponse` (InduSense-BE `app/schemas/device.py`). */
export interface Device {
  id: number;
  company_id: number | null;
  gateway_id: number | null;
  /** The source's own device id, e.g. a V-BOX box id. Globally unique. */
  external_id: string;
  name: string | null;
  device_type: string | null;
  /** Data source / protocol, e.g. `VNET`, `MQTT`, `MODBUS_TCP`. */
  source: string | null;
  ip_address: string | null;
  location: string | null;
  is_active: boolean;
  last_seen_at: IsoDateTime | null;
  connection_state: ConnectionState;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface DeviceCreate {
  external_id: string;
  company_id?: number | null;
  gateway_id?: number | null;
  name?: string | null;
  device_type?: string | null;
  source?: string | null;
  ip_address?: string | null;
  location?: string | null;
}

export interface DeviceUpdate {
  company_id?: number | null;
  gateway_id?: number | null;
  name?: string | null;
  device_type?: string | null;
  ip_address?: string | null;
  location?: string | null;
  is_active?: boolean | null;
}

export interface DeviceFilters {
  gateway_id?: number;
  is_active?: boolean;
  /** Platform administrators only. */
  company_id?: number;
  /** Platform administrators only: devices not yet assigned to a company. */
  unassigned?: boolean;
  /** Matches external id, name or location. */
  search?: string;
}

/** `DeviceConnectionResponse`. */
export interface DeviceConnection {
  id: number;
  device_id: number;
  protocol: string;
  host: string | null;
  port: number | null;
  settings: Record<string, string | number | boolean | null> | null;
  secret_ref: string | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface DeviceConnectionCreate {
  protocol: string;
  host?: string | null;
  port?: number | null;
  settings?: Record<string, string | number | boolean | null> | null;
  secret_ref?: string | null;
}

export interface DeviceConnectionUpdate {
  host?: string | null;
  port?: number | null;
  settings?: Record<string, string | number | boolean | null> | null;
  secret_ref?: string | null;
  is_active?: boolean | null;
}

/** `TagResponse`. */
export interface Tag {
  id: number;
  device_id: number;
  tag_name: string;
  display_name: string | null;
  data_type: string | null;
  unit: string | null;
  category: string | null;
  is_counter: boolean;
  is_cumulative: boolean;
  is_active: boolean;
  data_id: number | null;
  monitor_id: number | null;
  register_address: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TagCreate {
  device_id: number;
  tag_name: string;
  display_name?: string | null;
  data_type?: string | null;
  unit?: string | null;
  category?: string | null;
  is_counter?: boolean;
  is_cumulative?: boolean;
}

export interface TagUpdate {
  display_name?: string | null;
  data_type?: string | null;
  unit?: string | null;
  category?: string | null;
  is_counter?: boolean | null;
  is_cumulative?: boolean | null;
  is_active?: boolean | null;
}

export interface TagFilters {
  device_id?: number;
  category?: string;
  is_active?: boolean;
  /** Matches tag name or display name. */
  search?: string;
}
