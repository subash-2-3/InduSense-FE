import { CursorPagination, Pagination } from '../api/api-envelope';
import { IsoDateTime } from './common';
import { Metadata, Quantity } from './dashboard';
import { EnergyRangeFilters } from './energy';
import { WideCell, WideColumn } from './telemetry';

/** InduSense-BE `app/schemas/machine_report.py`: `/reports/machines/*` (requires `reports:view`). */

export type MachineExportReport = 'summary' | 'cumulative' | 'details';

/** Seconds in the period from RUN_STATUS (null without a RUN_STATUS tag). */
export interface MachineTimes {
  run_seconds: number | null;
  idle_seconds: number | null;
  stop_seconds: number | null;
  no_data_seconds: number | null;
}

export interface MachineSummaryRow extends MachineTimes {
  key: string;
  id: number | null;
  name: string;
  code?: string | null;
  plant_name?: string | null;
  area_name?: string | null;
  machines: number;
  production: Quantity;
  /** 0..1: run / (run + idle + stop); from the PLC's run/stop counters when mapped. */
  availability: number | null;
  availability_source: 'counters' | 'run_status' | 'mixed' | null;
  alarm_count: number | null;
  alarm_seconds: number | null;
}

export interface MachineSummaryTotals extends MachineTimes {
  machines: number;
  machines_without_status: number;
  machines_without_counter: number;
  production: Quantity;
  availability: number | null;
  alarm_count: number | null;
  alarm_seconds: number | null;
}

export interface MachineReportSummary {
  summary: MachineSummaryTotals;
  by_plant: MachineSummaryRow[];
  by_area: MachineSummaryRow[];
  by_machine: MachineSummaryRow[];
  metadata: Metadata;
}

export interface MachineCumulativeRow {
  machine_id: number;
  code: string;
  name: string;
  plant_name: string | null;
  area_name: string | null;
  tag_id: number;
  metric: 'PRODUCTION_COUNTER' | 'RUN_SECONDS' | 'STOP_SECONDS';
  parameter: string;
  unit: string | null;
  start_reading: number | null;
  end_reading: number | null;
  /** Reset-aware increase. */
  increase: number | null;
  reset_detected: boolean;
  period_from: IsoDateTime;
  period_to: IsoDateTime;
}

export interface MachineCumulativePage {
  success: boolean;
  data: { rows: MachineCumulativeRow[]; metadata: Metadata };
  pagination: Pagination;
}

export interface MachineDetailRow {
  ts: IsoDateTime;
  plant_name: string | null;
  area_name: string | null;
  machine_code: string;
  machine_name: string;
  device_name: string | null;
  parameter: string;
  metric: string;
  value: number | null;
  /** RUN_STATUS rows: the state from the tag's state map (RUNNING, IDLE, …). */
  state: string | null;
  unit: string | null;
  roundoff_digits?: number | null;
  quality: string | null;
}

export interface MachineDetailsPage {
  success: boolean;
  data: { rows: MachineDetailRow[]; metadata: Metadata };
  pagination: CursorPagination;
}

export interface MachineReportFilters extends EnergyRangeFilters {
  page?: number;
  page_size?: number;
  tag_id?: number[];
  /** Details: '' for the first page, then the previous page's `pagination.next_cursor`. */
  cursor?: string;
}

/** Detailed readings, one row per machine per second (the default `layout=wide`). */
export interface MachineWideRow {
  ts: IsoDateTime;
  plant_name: string | null;
  area_name: string | null;
  machine_code: string;
  machine_name: string;
  device_name: string | null;
  /** Column key -> cell; absent: no such tag on this machine, or no sample at this moment. */
  cells: Record<string, WideCell>;
}

export interface MachineWideDetailsPage {
  success: boolean;
  data: { columns: WideColumn[]; rows: MachineWideRow[]; metadata: Metadata };
  pagination: CursorPagination;
}
