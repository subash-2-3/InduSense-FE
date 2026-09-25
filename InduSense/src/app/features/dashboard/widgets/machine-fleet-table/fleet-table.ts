import { StatusTone, statusLabel, statusTone } from '../../../../shared/utils/status-colors';
import { AssetConnection, FleetRowVm } from '../../models/dashboard.vm';

export type FleetColumnKey =
  'image' | 'name' | 'status' | 'updatedAt' | 'connection' | 'location' | 'area' | 'gateway';

export type SortableColumn = 'name' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface FleetSort {
  column: SortableColumn;
  direction: SortDirection;
}

export interface FleetColumn {
  key: FleetColumnKey;
  label: string;
  sortable?: boolean;
  /** Visually hidden header (the image column). */
  srOnly?: boolean;
}

export const FLEET_COLUMNS: readonly FleetColumn[] = [
  { key: 'image', label: 'Asset Image', srOnly: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'updatedAt', label: 'Status Update Time' },
  { key: 'connection', label: 'Connection Status' },
  { key: 'location', label: 'Located At' },
  { key: 'area', label: 'Area' },
  { key: 'gateway', label: 'Connected Gateway' },
];

export const ALL_FLEET_COLUMNS: readonly FleetColumnKey[] = FLEET_COLUMNS.map((c) => c.key);

export function isSortable(column: FleetColumnKey): column is SortableColumn {
  return column === 'name' || column === 'status';
}

/** Header click cycle: ascending -> descending -> unsorted. */
export function nextSort(current: FleetSort | null, column: SortableColumn): FleetSort | null {
  if (current?.column !== column) {
    return { column, direction: 'asc' };
  }
  return current.direction === 'asc' ? { column, direction: 'desc' } : null;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function sortKey(row: FleetRowVm, column: SortableColumn): string {
  return column === 'name' ? row.name : statusLabel(row.status);
}

/** Stable sort of the rows on the current page (the API offers no server-side sort). */
export function sortRows(rows: readonly FleetRowVm[], sort: FleetSort | null): FleetRowVm[] {
  if (!sort) {
    return [...rows];
  }
  const factor = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        factor * collator.compare(sortKey(a.row, sort.column), sortKey(b.row, sort.column)) ||
        a.index - b.index,
    )
    .map(({ row }) => row);
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

export const CONNECTION_LABEL: Readonly<Record<AssetConnection, string>> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  NEVER_SEEN: 'Never seen',
  UNCONNECTED: 'Unconnected Asset',
};

export function connectionTone(connection: AssetConnection): StatusTone {
  return connection === 'UNCONNECTED' ? 'stopped' : statusTone(connection);
}
