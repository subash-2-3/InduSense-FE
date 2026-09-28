import { EditableStatus, IsoDateTime, RecordStatus, StatusFilter } from './common';

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
  status: RecordStatus;
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
  status?: EditableStatus;
}

export interface DeviceFilters {
  gateway_id?: number;
  status?: StatusFilter | null;
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
  status: RecordStatus;
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
  status?: EditableStatus;
}

/** `TagResponse`. */
/**
 * What a tag serves (InduSense-BE `TagType`). The allowed values and their labels come from
 * `GET /tag-definitions`; this type only names the ones known today.
 */
export type TagType = 'ems' | 'oee' | (string & {});

export interface Tag {
  id: number;
  device_id: number;
  /** The data source's key (the DataLogger matches by it); unique per device. */
  tag_name: string;
  /** Logical key, e.g. `voltage`; unique per device. */
  code: string | null;
  display_name: string | null;
  tag_type: TagType;
  /** Value/register format, e.g. float32, int16 (Modbus decodes by it); null = the connection's default. */
  data_type: string | null;
  unit: string | null;
  category: string | null;
  /** Decimals to display for floating-point values (display only; telemetry is stored as received). */
  roundoff_digits: number | null;
  description: string | null;
  /**
   * RUN_STATUS tags: value -> machine state, e.g. `{"0": "RUNNING", "1": "IDLE", "2": "ALARM"}`.
   * null: non-zero = running, 0 = stopped.
   */
  state_map: Record<string, string> | null;
  is_counter: boolean;
  is_cumulative: boolean;
  status: RecordStatus;
  data_id: number | null;
  monitor_id: number | null;
  register_address: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TagCreate {
  device_id: number;
  tag_name: string;
  code?: string | null;
  display_name?: string | null;
  tag_type?: TagType;
  data_type?: string | null;
  unit?: string | null;
  category?: string | null;
  roundoff_digits?: number | null;
  description?: string | null;
  state_map?: Record<string, string> | null;
  is_counter?: boolean;
  is_cumulative?: boolean;
  status?: EditableStatus;
}

/** `tag_name` cannot change (it is the data source's key). */
export interface TagUpdate {
  code?: string | null;
  display_name?: string | null;
  tag_type?: TagType;
  data_type?: string | null;
  unit?: string | null;
  category?: string | null;
  roundoff_digits?: number | null;
  description?: string | null;
  state_map?: Record<string, string> | null;
  is_counter?: boolean | null;
  is_cumulative?: boolean | null;
  status?: EditableStatus;
}

export interface TagFilters {
  device_id?: number;
  tag_type?: TagType | TagType[];
  /** Tags mapped to this machine / meter (asset tags). */
  machine_id?: number;
  meter_id?: number;
  category?: string;
  status?: StatusFilter | null;
  /** Matches tag name, display name or code. */
  search?: string;
}

// -------------------------------------------------------------- default tag catalog ----

export interface TagTypeOption {
  value: TagType;
  label: string;
}

export type ValueKind = 'float' | 'integer' | 'boolean' | 'string';

/** A reusable default tag (`tag_definitions`), e.g. voltage or good_count. */
export interface TagDefinition {
  id: number;
  code: string;
  display_name: string;
  tag_type: TagType;
  value_kind: ValueKind;
  unit: string | null;
  category: string | null;
  roundoff_digits: number | null;
  description: string | null;
  /** Asset tag metric this tag usually maps to, if any. */
  metric: string | null;
  is_counter: boolean;
  is_cumulative: boolean;
  sort_order: number;
  status: RecordStatus;
}

/** `GET /tag-definitions`: everything a tag form needs. */
export interface TagMetadata {
  tag_types: TagTypeOption[];
  roundoff_max: number;
  /** States a state map may use (only RUNNING counts as runtime). */
  machine_states: string[];
  value_kinds: ValueKind[];
  definitions: TagDefinition[];
}

export interface DefaultTagItem {
  code: string;
  /** Name the data source uses; default: the code. */
  tag_name?: string | null;
  register_address?: string | null;
}

export interface TagsFromDefinitionsResult {
  created: Tag[];
  restored: Tag[];
  skipped: { code: string; reason: string }[];
}
