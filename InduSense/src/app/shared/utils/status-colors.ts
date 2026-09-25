/**
 * Single mapping from machine/device status values to the theme's status colors.
 * Machine status: RUNNING | IDLE | STOPPED | MAINTENANCE | FAULT | UNKNOWN
 * Device connection state: ONLINE | OFFLINE | NEVER_SEEN
 */

export type StatusTone = 'running' | 'warning' | 'fault' | 'stopped' | 'info';

const TONE_BY_STATUS: Readonly<Record<string, StatusTone>> = {
  RUNNING: 'running',
  ONLINE: 'running',
  CLEAR: 'running',
  IDLE: 'warning',
  MAINTENANCE: 'warning',
  WARNING: 'warning',
  // A device that stopped reporting needs attention; it must also stay distinguishable from
  // NEVER_SEEN (gray) when both appear as series in the same chart.
  OFFLINE: 'warning',
  FAULT: 'fault',
  ALARM: 'fault',
  STOPPED: 'stopped',
  NEVER_SEEN: 'stopped',
  UNKNOWN: 'stopped',
};

/** CSS custom property holding each tone's color. */
export const STATUS_TONE_VAR: Readonly<Record<StatusTone, string>> = {
  running: '--status-running',
  warning: '--status-warning',
  fault: '--status-fault',
  stopped: '--status-stopped',
  info: '--accent-cyan',
};

function normalise(status: string): string {
  return status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

/** Tone for a status value; unrecognised or empty values are treated as `stopped`. */
export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) {
    return 'stopped';
  }
  return TONE_BY_STATUS[normalise(status)] ?? 'stopped';
}

/** Human-readable label: `NEVER_SEEN` -> `Never seen`, `RUNNING` -> `Running`. */
export function statusLabel(status: string | null | undefined): string {
  if (!status || !status.trim()) {
    return 'Unknown';
  }
  const words = normalise(status).toLowerCase().split('_').filter(Boolean);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
