import { IsoDateTime } from './common';

/** `TelemetryPoint` (InduSense-BE `app/schemas/telemetry.py`). */
export interface TelemetryPoint {
  id: number;
  device_id: number;
  tag_id: number;
  /** Sample time (UTC). */
  ts: IsoDateTime;
  value: number | null;
  value_text: string | null;
  quality: string | null;
  source: string;
  /** The source's own timestamp, if it had a trusted one. */
  source_ts: IsoDateTime | null;
  received_at: IsoDateTime;
}

/** `LatestValue`: the latest sample of one tag; sample fields are null when the tag has no data. */
export interface LatestValue {
  tag_id: number;
  device_id: number;
  tag_name: string;
  display_name: string | null;
  unit: string | null;
  ts: IsoDateTime | null;
  value: number | null;
  value_text: string | null;
  quality: string | null;
  received_at: IsoDateTime | null;
}

/** `GET /telemetry/latest` needs a device, or one or more tags (or both). */
export type LatestQuery =
  | { deviceId: number; tagIds?: readonly number[] }
  | { deviceId?: number; tagIds: readonly number[] };

export interface HistoryQuery {
  deviceId?: number;
  tagIds?: readonly number[];
  /** Inclusive start; defaults to end - TELEMETRY_DEFAULT_WINDOW_MINUTES on the server. */
  start?: Date | IsoDateTime;
  /** Exclusive end; defaults to now on the server. */
  end?: Date | IsoDateTime;
  quality?: string;
  order?: 'asc' | 'desc';
  page?: number;
  /** Up to TELEMETRY_MAX_PAGE_SIZE (1000). */
  pageSize?: number;
}
