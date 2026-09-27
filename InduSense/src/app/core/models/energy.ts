import { IsoDateTime } from './common';
import { KpiValue, Metadata, Quantity } from './dashboard';

/** InduSense-BE `app/schemas/energy.py`: `/dashboards/energy/*` and `/reports/energy/*`. */

export type EnergyAssetType = 'meter' | 'machine';
export type EnergyGroupBy = 'meter' | 'machine' | 'area' | 'plant';
export type EnergyExportReport = 'summary' | 'cumulative' | 'details';
export type EnergyExportFormat = 'csv' | 'xlsx';
/** Metrics an energy parameter can have (from the asset tag mapping). */
export type EnergyMetric =
  'POWER' | 'ENERGY' | 'VOLTAGE' | 'CURRENT' | 'FREQUENCY' | 'POWER_FACTOR';
export type EnergyAssetStatus = 'ONLINE' | 'OFFLINE' | 'NO_DATA';

/** Scope filters shared by every energy endpoint. `company_id` only matters for platform administrators. */
export interface EnergyFilters {
  company_id?: number;
  plant_id?: number;
  area_id?: number;
  machine_id?: number;
  meter_id?: number;
}

export interface EnergyRangeFilters extends EnergyFilters {
  from?: IsoDateTime;
  to?: IsoDateTime;
}

export interface EnergyAssetRef {
  asset_type: EnergyAssetType;
  asset_id: number;
  code: string;
  name: string;
  plant_id: number;
  plant_name: string | null;
  area_id: number | null;
  area_name: string | null;
}

// ----------------------------------------------------------------------- live ----

export interface LiveParameter {
  tag_id: number;
  metric: EnergyMetric | string;
  name: string;
  unit: string | null;
  value: number | null;
  ts: IsoDateTime | null;
  quality: string | null;
  device_id: number;
  device_name: string | null;
  connection_state: string;
}

export interface LiveAsset extends EnergyAssetRef {
  status: EnergyAssetStatus | string;
  last_data_at: IsoDateTime | null;
  parameters: LiveParameter[];
}

export interface EnergyLive {
  assets: LiveAsset[];
  generated_at: IsoDateTime;
  notes: string[];
}

// --------------------------------------------------------------------- trends ----

export interface TrendPoint {
  t: IsoDateTime;
  value: number | null;
  min?: number | null;
  max?: number | null;
}

export interface TrendSeries {
  tag_id: number;
  metric: string;
  name: string;
  unit: string | null;
  asset_name: string;
  points: TrendPoint[];
}

export type TrendKind = 'instant' | 'consumption';

/** Series sharing one axis: same unit and kind. */
export interface TrendGroup {
  unit: string | null;
  kind: TrendKind | string;
  series: TrendSeries[];
}

export interface EnergyTrends {
  groups: TrendGroup[];
  available_tags: LiveParameter[];
  metadata: Metadata;
}

export interface EnergyTrendFilters extends EnergyRangeFilters {
  tag_id?: number[];
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
}

// --------------------------------------------------------------- distribution ----

export interface DistributionItem {
  key: string;
  id: number | null;
  name: string;
  value: number;
  unit: string | null;
  share: number | null;
}

export interface EnergyDistribution {
  group_by: EnergyGroupBy;
  total: Quantity;
  items: DistributionItem[];
  metadata: Metadata;
}

// ------------------------------------------------------------------- overview ----

export interface EnergyKpis {
  total_energy: Quantity | null;
  average_power: KpiValue | null;
  peak_power: KpiValue | null;
  minimum_power: KpiValue | null;
  average_power_factor: KpiValue | null;
  average_voltage: KpiValue | null;
  average_current: KpiValue | null;
  meters: number;
  machines: number;
  active_meters: number;
  offline_meters: number;
}

export interface MeterStatusRow extends EnergyAssetRef {
  status: EnergyAssetStatus | string;
  last_data_at: IsoDateTime | null;
  latest_power: KpiValue | null;
}

export interface EnergyOverview {
  summary: EnergyKpis;
  meters: MeterStatusRow[];
  metadata: Metadata;
}

// -------------------------------------------------------------------- reports ----

export interface GroupSummaryRow {
  key: string;
  id: number | null;
  name: string;
  energy: Quantity;
  average_power: KpiValue | null;
  peak_power: KpiValue | null;
}

export interface EnergyReportSummary {
  summary: EnergyKpis;
  by_plant: GroupSummaryRow[];
  by_area: GroupSummaryRow[];
  by_machine: GroupSummaryRow[];
  by_meter: GroupSummaryRow[];
  metadata: Metadata;
}

export interface CumulativeRow extends EnergyAssetRef {
  tag_id: number;
  unit: string | null;
  start_reading: number | null;
  end_reading: number | null;
  consumed: number | null;
  reset_detected: boolean;
  average_power: KpiValue | null;
  peak_power: KpiValue | null;
  period_from: IsoDateTime;
  period_to: IsoDateTime;
}

export interface DetailRow {
  ts: IsoDateTime;
  plant_name: string | null;
  area_name: string | null;
  asset_type: EnergyAssetType;
  asset_name: string;
  device_name: string | null;
  parameter: string;
  metric: string;
  value: number | null;
  unit: string | null;
  quality: string | null;
}

export interface EnergyPage<R> {
  success: boolean;
  data: { rows: R[]; metadata: Metadata };
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}

export interface EnergyPageFilters extends EnergyRangeFilters {
  page?: number;
  page_size?: number;
}

export interface EnergyDetailFilters extends EnergyPageFilters {
  tag_id?: number[];
}

export interface EnergyExportFilters extends EnergyRangeFilters {
  report: EnergyExportReport;
  format: EnergyExportFormat;
  tag_id?: number[];
}
