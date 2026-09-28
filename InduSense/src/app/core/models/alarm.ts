import { IsoDateTime, RecordStatus, EditableStatus } from './common';
import { Metadata } from './dashboard';

/** InduSense-BE `app/schemas/alarm.py`: alarms from PLC alarm words (one alarm per bit). */

export const ALARM_BITS = 32;

export interface AlarmMachine {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  plant_id: number;
  plant_name: string | null;
  area_name: string | null;
}

/** A machine's alarm word (its ALARM_STATUS tag). */
export interface AlarmTag extends AlarmMachine {
  tag_id: number;
  tag_name: string;
  display_name: string | null;
  register_address: string | null;
  /** Latest alarm word: each set bit is an active alarm. */
  value: number | null;
  last_data_at: IsoDateTime | null;
  named_bits: number;
}

export interface AlarmDefinition {
  id: number;
  tag_id: number;
  /** 0 = least significant bit. */
  bit: number;
  name: string;
  message: string | null;
  status: RecordStatus;
  updated_at: IsoDateTime;
}

export interface AlarmDefinitionItem {
  bit: number;
  name: string;
  message?: string | null;
  status?: EditableStatus;
}

export interface ActiveAlarm extends AlarmMachine {
  tag_id: number;
  bit: number;
  /** The configured name, else "Alarm bit N". */
  name: string;
  message: string | null;
  named: boolean;
  since: IsoDateTime | null;
  /** Already set when the 31-day look-back began: active at least since then. */
  since_is_estimate: boolean;
  duration_seconds: number | null;
  /** No recent data for the alarm word: last known state. */
  stale: boolean;
  last_data_at: IsoDateTime;
}

export interface ActiveAlarms {
  alarms: ActiveAlarm[];
  machines_in_alarm: number;
  alarm_tags: number;
  generated_at: IsoDateTime;
  notes: string[];
}

export interface AlarmOccurrence extends AlarmMachine {
  tag_id: number;
  bit: number;
  name: string;
  message: string | null;
  start: IsoDateTime;
  /** null while still active. */
  end: IsoDateTime | null;
  ongoing: boolean;
  started_before_range: boolean;
  duration_seconds: number;
}

export interface AlarmHistoryPage {
  success: boolean;
  data: { rows: AlarmOccurrence[]; metadata: Metadata };
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}

export interface AlarmFilters {
  plant_id?: number;
  machine_id?: number;
}

export interface AlarmHistoryFilters extends AlarmFilters {
  from?: IsoDateTime;
  to?: IsoDateTime;
  bit?: number;
  page?: number;
  page_size?: number;
}
