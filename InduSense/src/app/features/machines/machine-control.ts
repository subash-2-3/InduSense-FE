import { CommandState, ControlTag, DeviceCommand } from '../../core/models';
import { StatusTone } from '../../shared/ui';

/** What a control button does, and what the user must confirm first. */
export interface ControlAction {
  value: number;
  label: string;
  confirm: string;
  /** For latched controls: this value is the register's current value. */
  current: boolean;
}

const ON_OFF: Readonly<Record<number, string>> = { 0: 'Off', 1: 'On' };

/** Writable tags (by code) not offered in the control panel. */
export const HIDDEN_CONTROL_CODES: ReadonlySet<string> = new Set(['alarm_reset', 'run_stop_reset']);

/** The controls the panel shows. */
export function visibleControls(controls: readonly ControlTag[]): ControlTag[] {
  return controls.filter((c) => !c.code || !HIDDEN_CONTROL_CODES.has(c.code));
}

/**
 * The buttons of one writable tag.
 * - Start/Stop (a toggle pulse): "Start" unless the machine is running, then "Stop".
 * - Other pulses (resets): one button named after the tag.
 * - Latched values (interlock): one button per allowed value.
 */
export function actionsFor(
  control: ControlTag,
  machineStatus: string,
  machineName: string,
): ControlAction[] {
  if (control.write_mode === 'pulse') {
    const value = control.write_values[0] ?? 1;
    if (control.code === 'start_stop') {
      const stop = machineStatus === 'RUNNING';
      return [
        {
          value,
          label: stop ? 'Stop machine' : 'Start machine',
          confirm: stop
            ? `Stop "${machineName}"? The PLC's Start/Stop is toggled.`
            : `Start "${machineName}"? The PLC's Start/Stop is toggled; make sure it is safe to run.`,
          current: false,
        },
      ];
    }
    return [
      {
        value,
        label: control.label,
        confirm: `Send "${control.label}" to "${machineName}"?`,
        current: false,
      },
    ];
  }
  return control.write_values.map((value) => {
    const name = ON_OFF[value] ?? String(value);
    let confirm = `Set "${control.label}" of "${machineName}" to ${name}?`;
    if (control.code === 'machine_interlock') {
      confirm =
        value === 0
          ? `Release the interlock of "${machineName}"? The machine may start.`
          : `Engage the interlock of "${machineName}"? The machine will be blocked.`;
    }
    return { value, label: name, confirm, current: control.value === value };
  });
}

export function isOpen(command: DeviceCommand | null | undefined): boolean {
  return !!command && (command.state === 'pending' || command.state === 'sent');
}

const STATE_TONE: Readonly<Record<CommandState, StatusTone>> = {
  pending: 'info',
  sent: 'info',
  done: 'running',
  failed: 'fault',
  expired: 'warning',
};

/** One line about the last command of a control. */
export function commandSummary(command: DeviceCommand): { text: string; tone: StatusTone } {
  const who = command.requested_by_email ? ` by ${command.requested_by_email}` : '';
  switch (command.state) {
    case 'pending':
      return { text: `Waiting for the DataLogger…${who}`, tone: STATE_TONE.pending };
    case 'sent':
      return { text: 'Writing to the PLC…', tone: STATE_TONE.sent };
    case 'done':
      return {
        text: `Done${who}` + (command.readback !== null ? ` · read back ${command.readback}` : ''),
        tone: STATE_TONE.done,
      };
    case 'failed':
      return { text: `Failed: ${command.error ?? 'unknown error'}`, tone: STATE_TONE.failed };
    case 'expired':
      return {
        text: 'Not executed: the DataLogger did not pick it up in time (is writing enabled?)',
        tone: STATE_TONE.expired,
      };
  }
}
