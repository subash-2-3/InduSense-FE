import { PageResponse } from '../api/api-envelope';
import { IsoDateTime } from './common';
import { Metadata, Quantity } from './dashboard';
import { LoggerStatus } from './admin';

export type ReportInterval = '1h' | '1d';
export type GroupBy = 'asset' | 'area' | 'plant';
export type EnergyAsset = 'meter' | 'machine';

export interface BaseReportFilters {
  from?: IsoDateTime;
  to?: IsoDateTime;
  interval?: ReportInterval;
  plant_id?: number;
  area_id?: number;
  machine_id?: number;
  page?: number;
  page_size?: number;
}

export interface ReportData<S, R> {
  summary: S;
  rows: R[];
  metadata: Metadata;
}

export interface ReportResponse<S, R> {
  success: boolean;
  data: ReportData<S, R>;
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface MachineRef {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  plant_id: number;
  area_id: number | null;
}

export interface Period {
  period_start: IsoDateTime;
  date: string;
}

// --------------------------------------------------------------------- Energy ----

export interface EnergySummary {
  total: Quantity;
  assets: number;
  assets_without_energy_tag: number;
}

export interface EnergyRow extends Period {
  group_type: 'meter' | 'machine' | 'area' | 'plant' | string;
  group_id: number | null;
  group_name: string;
  energy: number;
  unit: string | null;
}

export interface EnergyReportFilters extends BaseReportFilters {
  asset_type?: EnergyAsset;
  group_by?: GroupBy;
  meter_id?: number;
}

// ----------------------------------------------------------------- Production ----

export interface ProductionSummary {
  total_production: number | null;
  machines: number;
  machines_without_counter: number;
}

export interface ProductionRow extends Period, MachineRef {
  production: number;
  counter_start: number;
  counter_end: number;
  unit: string | null;
  runtime_seconds: number | null;
  energy: number | null;
  energy_unit: string | null;
}

export interface ProductionReportFilters extends BaseReportFilters {}

// -------------------------------------------------------------------- Runtime ----

export interface RuntimeSummary {
  running_seconds: number;
  stopped_seconds: number;
  no_data_seconds: number;
  idle_seconds: number | null;
  machines: number;
  machines_without_run_status: number;
}

export interface RuntimeRow extends Period, MachineRef {
  running_seconds: number;
  stopped_seconds: number;
  no_data_seconds: number;
  idle_seconds: number | null;
}

export interface RuntimeReportFilters extends BaseReportFilters {}

// ------------------------------------------------------------------- Downtime ----

export interface DowntimeSummary {
  events: number;
  total_downtime_seconds: number;
  machines: number;
  machines_without_run_status: number;
}

export interface DowntimeRow extends MachineRef {
  start: IsoDateTime;
  end: IsoDateTime;
  duration_seconds: number;
  ongoing: boolean;
  reason: string | null;
}

export interface DowntimeReportFilters extends BaseReportFilters {
  min_duration_seconds?: number;
}

// ------------------------------------------------------------------------ OEE ----

export interface OeeSummary {
  supported: boolean;
  missing_inputs: string[];
  machines: number;
}

export interface OeeRow extends MachineRef {
  status: string;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  runtime_seconds: number | null;
  production: number | null;
  missing_inputs: string[];
}

export interface OeeReportFilters extends BaseReportFilters {}

// -------------------------------------------------------------- Device Health ----

export interface LoggerSummary {
  total: number;
  healthy: number;
  degraded: number;
  stale: number;
  with_errors: number;
  buffered_points: number;
}

export interface DeviceHealthSummary {
  devices: number;
  online: number;
  offline: number;
  never_seen: number;
  stale_data: number;
  loggers: LoggerSummary;
}

export interface DeviceHealthRow {
  device_id: number;
  external_id: string;
  name: string | null;
  gateway_id: number | null;
  gateway_name: string | null;
  is_active: boolean;
  connection_state: string;
  last_seen_at: IsoDateTime | null;
  last_telemetry_at: IsoDateTime | null;
  data_stale: boolean;
  protocols: string[];
}

export interface DeviceHealthData extends ReportData<DeviceHealthSummary, DeviceHealthRow> {
  loggers: LoggerStatus[];
}

export interface DeviceHealthResponse {
  success: boolean;
  data: DeviceHealthData;
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface DeviceHealthFilters {
  plant_id?: number;
  gateway_id?: number;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}
