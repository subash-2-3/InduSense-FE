import type { RecordStatus } from '../../core/models';
import type { StatusTone } from './status-colors';

const LABEL: Readonly<Record<RecordStatus, string>> = {
  active: 'Active',
  inactive: 'Inactive',
  delete: 'Deleted',
};

const TONE: Readonly<Record<RecordStatus, StatusTone>> = {
  active: 'running',
  inactive: 'stopped',
  delete: 'fault',
};

/** Label for a record's lifecycle status (never the raw value). */
export function recordStatusLabel(status: RecordStatus): string {
  return LABEL[status] ?? status;
}

export function recordStatusTone(status: RecordStatus): StatusTone {
  return TONE[status] ?? 'stopped';
}

/** The status a toggle switches to: active <-> inactive. */
export function toggledStatus(status: RecordStatus): 'active' | 'inactive' {
  return status === 'active' ? 'inactive' : 'active';
}

/** Management lists show active and inactive records; deleted ones only on request. */
export const VISIBLE_STATUSES: RecordStatus[] = ['active', 'inactive'];
