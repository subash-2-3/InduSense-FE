import { FleetRowVm } from '../../models/dashboard.vm';
import { connectionTone, isSortable, nextSort, sortRows, totalPages } from './fleet-table';

const row = (id: string, name: string, status: string): FleetRowVm => ({
  id,
  name,
  code: id,
  status,
  updatedAt: null,
  connection: 'ONLINE',
  location: 'Plant',
  area: null,
  gateway: null,
});

describe('fleet-table helpers', () => {
  const rows = [
    row('1', 'Press 10', 'RUNNING'),
    row('2', 'press 2', 'FAULT'),
    row('3', 'Conveyor', 'IDLE'),
    row('4', 'Press 2', 'RUNNING'),
  ];

  it('cycles sort: ascending, descending, unsorted; a new column starts ascending', () => {
    let sort = nextSort(null, 'name');
    expect(sort).toEqual({ column: 'name', direction: 'asc' });
    sort = nextSort(sort, 'name');
    expect(sort).toEqual({ column: 'name', direction: 'desc' });
    expect(nextSort(sort, 'name')).toBeNull();
    expect(nextSort(sort, 'status')).toEqual({ column: 'status', direction: 'asc' });
  });

  it('sorts names naturally and case-insensitively, keeping ties stable', () => {
    const ids = sortRows(rows, { column: 'name', direction: 'asc' }).map((r) => r.id);
    expect(ids).toEqual(['3', '2', '4', '1']);
    const desc = sortRows(rows, { column: 'name', direction: 'desc' }).map((r) => r.id);
    expect(desc).toEqual(['1', '2', '4', '3']);
  });

  it('sorts status by its label', () => {
    const statuses = sortRows(rows, { column: 'status', direction: 'asc' }).map((r) => r.status);
    expect(statuses).toEqual(['FAULT', 'IDLE', 'RUNNING', 'RUNNING']);
  });

  it('returns a copy in the original order when unsorted', () => {
    const result = sortRows(rows, null);
    expect(result).toEqual(rows);
    expect(result).not.toBe(rows);
  });

  it('computes at least one page', () => {
    expect(totalPages(25, 10)).toBe(3);
    expect(totalPages(20, 10)).toBe(2);
    expect(totalPages(0, 10)).toBe(1);
  });

  it('knows which columns sort and how connections are colored', () => {
    expect(isSortable('name')).toBe(true);
    expect(isSortable('gateway')).toBe(false);
    expect(connectionTone('ONLINE')).toBe('running');
    expect(connectionTone('OFFLINE')).toBe('warning');
    expect(connectionTone('UNCONNECTED')).toBe('stopped');
  });
});
