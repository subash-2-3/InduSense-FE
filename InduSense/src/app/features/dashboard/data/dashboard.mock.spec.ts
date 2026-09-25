import { sum } from '../../../shared/charts/chart-base';
import {
  MOCK_DEVICE_COUNT,
  MOCK_DEVICE_TYPE_COUNT,
  MOCK_DEVICES_BY_CONNECTION,
  MOCK_DEVICES_BY_SOURCE,
  MOCK_DEVICES_BY_TYPE,
  createMockFleet,
  mockFleetPage,
} from './dashboard.mock';

describe('dashboard mock data', () => {
  it('is internally consistent across widgets', () => {
    const total = MOCK_DEVICE_COUNT.value;
    expect(sum(MOCK_DEVICES_BY_TYPE.map((s) => s.value))).toBe(total);
    expect(sum(MOCK_DEVICES_BY_CONNECTION.map((s) => s.value))).toBe(total);
    expect(sum(MOCK_DEVICES_BY_SOURCE.series.flatMap((s) => s.values))).toBe(total);
    expect(MOCK_DEVICES_BY_TYPE).toHaveLength(MOCK_DEVICE_TYPE_COUNT.value);

    // Per-status totals of the stacked chart match the donut.
    for (const slice of MOCK_DEVICES_BY_CONNECTION) {
      const series = MOCK_DEVICES_BY_SOURCE.series.find((s) => s.label === slice.label)!;
      expect(sum(series.values)).toBe(slice.value);
    }
  });

  it('builds a deterministic fleet of 25 with unique ids, newest first', () => {
    const now = Date.parse('2026-09-25T12:00:00Z');
    const fleet = createMockFleet(now);
    expect(fleet).toHaveLength(25);
    expect(new Set(fleet.map((r) => r.id)).size).toBe(25);
    expect(fleet[0].updatedAt).toBe('2026-09-25T12:00:00.000Z');
    expect(createMockFleet(now)).toEqual(fleet);
    expect(fleet.filter((r) => r.connection === 'UNCONNECTED').every((r) => !r.gateway)).toBe(true);
  });

  it('pages the fleet and clamps out-of-range pages', () => {
    const fleet = createMockFleet(0);
    expect(mockFleetPage(1, 10, fleet).rows.map((r) => r.id)[0]).toBe('m-1');
    expect(mockFleetPage(3, 10, fleet).rows).toHaveLength(5);
    expect(mockFleetPage(9, 10, fleet).page).toBe(3);
    expect(mockFleetPage(0, 10, fleet).page).toBe(1);
    expect(mockFleetPage(2, 10, fleet)).toMatchObject({ total: 25, pageSize: 10 });
  });
});
