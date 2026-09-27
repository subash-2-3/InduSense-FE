import { IsoDateTime, RecordStatus } from './common';

export interface Metadata {
  from: IsoDateTime;
  to: IsoDateTime;
  timezone: string;
  interval_seconds: number | null;
  generated_at: IsoDateTime;
  notes: string[];
}

export interface Quantity {
  total: number | null;
  unit: string | null;
  by_unit: Record<string, number>;
}

export interface KpiValue {
  value: number | null;
  unit?: string | null;
  ts?: IsoDateTime | null;
}

export interface ChartPoint {
  ts: IsoDateTime;
  value: number;
  min?: number | null;
  max?: number | null;
}

export interface StatusCounts {
  RUNNING: number;
  STOPPED: number;
  OFFLINE: number;
  IDLE: number;
  MAINTENANCE: number;
  FAULT: number;
  UNKNOWN: number;
}

export interface MachineState {
  status: string;
  source: string;
  last_data_at?: IsoDateTime | null;
}

export interface Ref {
  id: number;
  name: string | null;
  code?: string | null;
}

export interface DeviceRef {
  id: number;
  external_id: string;
  name: string | null;
  gateway_id: number | null;
  connection_state: string;
  last_seen_at: IsoDateTime | null;
}

export interface TagValue {
  tag_id: number;
  device_id: number;
  tag_name: string;
  display_name: string | null;
  unit: string | null;
  metric: string | null;
  value: number | null;
  value_text: string | null;
  ts: IsoDateTime | null;
}

export interface AttentionItem {
  kind: 'DEVICE_OFFLINE' | 'DEVICE_NEVER_SEEN' | 'LOGGER_STALE' | 'LOGGER_DEGRADED' | string;
  entity_type: string;
  entity_id: string;
  name: string | null;
  since: IsoDateTime | null;
  detail?: string | null;
}

// ------------------------------------------------------------------ Overview Dashboard ----

export interface OverviewSummary {
  total_plants: number;
  total_machines: number;
  total_meters: number;
  running_machines: number;
  offline_devices: number;
  energy: Quantity;
  production: number | null;
}

export interface PlantEnergy {
  plant_id: number;
  plant_name: string;
  energy: Quantity;
}

export interface OverviewCharts {
  machine_status: StatusCounts;
  energy_by_plant: PlantEnergy[];
}

export interface OverviewTables {
  recent_attention: AttentionItem[];
}

export interface OverviewDashboard {
  summary: OverviewSummary;
  charts: OverviewCharts;
  tables: OverviewTables;
  metadata: Metadata;
}

// --------------------------------------------------------------------- Plant Dashboard ----

export interface PlantSummary {
  machines: number;
  meters: number;
  running_machines: number;
  offline_devices: number;
  energy: Quantity;
  production: number | null;
}

export interface AreaEnergy {
  area_id: number | null;
  area_name: string;
  energy: Quantity;
}

export interface PlantCharts {
  energy: ChartPoint[];
  production: ChartPoint[];
  power: ChartPoint[];
  machine_status: StatusCounts;
  energy_by_area: AreaEnergy[];
}

export interface AreaRow {
  area_id: number | null;
  area_name: string;
  machines: number;
  running: number;
  stopped: number;
  offline: number;
  other: number;
  energy: Quantity;
  production: number | null;
}

export interface MachineRow {
  machine_id: number;
  machine_code: string;
  name: string;
  area_id: number | null;
  state: MachineState;
  production: number | null;
  energy: KpiValue | null;
}

export interface PlantTables {
  areas: AreaRow[];
  machines: MachineRow[];
  devices: DeviceRef[];
}

export interface PlantDashboard {
  plant: Ref;
  summary: PlantSummary;
  charts: PlantCharts;
  tables: PlantTables;
  metadata: Metadata;
}

// ------------------------------------------------------------------- Machine Dashboard ----

export interface MachineRuntimeSummary {
  running_seconds: number;
  stopped_seconds: number;
  no_data_seconds: number;
}

export interface StateSegment {
  start: IsoDateTime;
  end: IsoDateTime;
  state: 'RUNNING' | 'STOPPED' | string;
}

export interface MachineSummary {
  production: KpiValue | null;
  energy: KpiValue | null;
  power: KpiValue | null;
  voltage: KpiValue | null;
  current: KpiValue | null;
  frequency: KpiValue | null;
  power_factor: KpiValue | null;
  runtime: MachineRuntimeSummary | null;
}

export interface SeriesCharts {
  power: ChartPoint[];
  energy: ChartPoint[];
  production: ChartPoint[];
  voltage: ChartPoint[];
  current: ChartPoint[];
  frequency: ChartPoint[];
  power_factor: ChartPoint[];
}

export interface MachineCharts extends SeriesCharts {
  state_timeline: StateSegment[];
}

export interface MachineInfo {
  id: number;
  machine_code: string;
  name: string;
  machine_type: string | null;
  manual_status: string;
  state: MachineState;
}

export interface MachineTables {
  tags: TagValue[];
}

export interface MachineDashboard {
  machine: MachineInfo;
  plant: Ref;
  area: Ref | null;
  device: DeviceRef | null;
  gateway: Ref | null;
  last_data_at: IsoDateTime | null;
  available_metrics: string[];
  summary: MachineSummary;
  charts: MachineCharts;
  tables: MachineTables;
  metadata: Metadata;
}

// --------------------------------------------------------------------- Meter Dashboard ----

export interface MeterSummary {
  current_power: KpiValue | null;
  energy: KpiValue | null;
  peak_power: KpiValue | null;
  voltage: KpiValue | null;
  current: KpiValue | null;
  frequency: KpiValue | null;
  power_factor: KpiValue | null;
}

export interface MeterInfo {
  id: number;
  meter_code: string;
  name: string;
  meter_type: string | null;
  unit: string | null;
}

export interface MeterDashboard {
  meter: MeterInfo;
  plant: Ref;
  area: Ref | null;
  device: DeviceRef | null;
  last_data_at: IsoDateTime | null;
  available_metrics: string[];
  summary: MeterSummary;
  charts: SeriesCharts;
  tables: MachineTables;
  metadata: Metadata;
}

// ------------------------------------------------------------------- Gateway Dashboard ----

export interface GatewayInfo {
  id: number;
  gateway_code: string;
  name: string;
  gateway_type: string;
  ip_address: string | null;
  port: number | null;
  plant_id: number;
  area_id: number | null;
  status: RecordStatus;
}

export interface GatewaySummary {
  status: 'ONLINE' | 'OFFLINE' | 'NO_DEVICES' | string;
  devices: number;
  connected_devices: number;
  offline_devices: number;
  last_message_at: IsoDateTime | null;
  data_points: number;
  buffered_records: number | null;
}

export interface GatewayDeviceRow extends DeviceRef {
  last_telemetry_at: IsoDateTime | null;
  data_points: number;
  protocols: string[];
}

export interface GatewayCharts {
  activity: ChartPoint[];
}

export interface GatewayTables {
  devices: GatewayDeviceRow[];
}

export interface GatewayDashboard {
  gateway: GatewayInfo;
  summary: GatewaySummary;
  charts: GatewayCharts;
  tables: GatewayTables;
  metadata: Metadata;
}

export interface DashboardTimeFilters {
  from?: IsoDateTime;
  to?: IsoDateTime;
  interval?: string;
}
