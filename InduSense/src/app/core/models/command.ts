import { IsoDateTime } from './common';
import { MachineState } from './dashboard';

/** InduSense-BE `app/schemas/command.py`: register writes queued for the DataLogger. */

export type CommandState = 'pending' | 'sent' | 'done' | 'failed' | 'expired';
export type WriteMode = 'pulse' | 'latched';

export interface DeviceCommand {
  id: number;
  device_id: number;
  tag_id: number;
  tag_name: string;
  label: string;
  value: number;
  state: CommandState;
  requested_by: number | null;
  requested_by_email: string | null;
  requested_at: IsoDateTime;
  expires_at: IsoDateTime;
  picked_at: IsoDateTime | null;
  completed_at: IsoDateTime | null;
  /** Register value read back after the write. */
  readback: number | null;
  error: string | null;
}

export interface ControlTag {
  tag_id: number;
  tag_name: string;
  code: string | null;
  label: string;
  register_address: string | null;
  /** pulse: write 1, the PLC resets it; latched: the value stays (e.g. interlock). */
  write_mode: WriteMode;
  write_values: number[];
  value: number | null;
  value_at: IsoDateTime | null;
  last_command: DeviceCommand | null;
}

export interface MachineControls {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  state: MachineState;
  device_id: number | null;
  device_name: string | null;
  can_write: boolean;
  controls: ControlTag[];
  notes: string[];
}
