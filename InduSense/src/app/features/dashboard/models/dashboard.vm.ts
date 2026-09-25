/**
 * UI-facing view models for the Device Summary widgets. Widgets depend only on these; the mock
 * data source (UI Track) and the API data source (Phase 8) both produce them.
 */
import { StatusTone } from '../../../shared/utils/status-colors';

/** One widget's load state. `data` stays set while a refresh runs or after a failed refresh. */
export interface WidgetState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** W1 / W2 */
export interface KpiVm {
  value: number;
}

/** W3: one slice per category (e.g. device type). */
export interface CategorySliceVm {
  label: string;
  value: number;
}

/** W4: one slice per status (e.g. device connection state). */
export interface StatusSliceVm {
  label: string;
  value: number;
  tone: StatusTone;
}

/** W5: stacked columns, one series per status. `values[i]` belongs to `categories[i]`. */
export interface StackedBarVm {
  categories: string[];
  series: { label: string; tone: StatusTone; values: number[] }[];
}

/** W6 */
export type AssetConnection = 'ONLINE' | 'OFFLINE' | 'NEVER_SEEN' | 'UNCONNECTED';

export interface FleetRowVm {
  id: string;
  name: string;
  code: string;
  /** Machine status, e.g. RUNNING, IDLE, FAULT. */
  status: string;
  /** ISO timestamp of the last status update. */
  updatedAt: string | null;
  connection: AssetConnection;
  location: string;
  area: string | null;
  gateway: string | null;
}

export interface FleetPageVm {
  rows: FleetRowVm[];
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
}

/** W7 */
export interface GaugeVm {
  value: number | null;
  unit: string;
  /** ISO timestamp of the reading. */
  ts: string | null;
}
