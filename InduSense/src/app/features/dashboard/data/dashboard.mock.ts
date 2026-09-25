import {
  CategorySliceVm,
  FleetPageVm,
  FleetRowVm,
  GaugeVm,
  KpiVm,
  StackedBarVm,
  StatusSliceVm,
} from '../models/dashboard.vm';

/** Mock plant used by the UI Track (no backend). Values are internally consistent: 12 devices. */

export const MOCK_DEVICE_COUNT: KpiVm = { value: 12 };
export const MOCK_DEVICE_TYPE_COUNT: KpiVm = { value: 4 };

export const MOCK_DEVICES_BY_TYPE: CategorySliceVm[] = [
  { label: 'PLC', value: 4 },
  { label: 'Gateway', value: 3 },
  { label: 'Energy Meter', value: 3 },
  { label: 'Sensor', value: 2 },
];

export const MOCK_DEVICES_BY_CONNECTION: StatusSliceVm[] = [
  { label: 'Online', value: 8, tone: 'running' },
  { label: 'Offline', value: 3, tone: 'warning' },
  { label: 'Never seen', value: 1, tone: 'stopped' },
];

export const MOCK_DEVICES_BY_SOURCE: StackedBarVm = {
  categories: ['MQTT', 'VNET', 'MODBUS_TCP', 'OPCUA'],
  series: [
    { label: 'Online', tone: 'running', values: [3, 2, 2, 1] },
    { label: 'Offline', tone: 'warning', values: [1, 1, 1, 0] },
    { label: 'Never seen', tone: 'stopped', values: [0, 0, 0, 1] },
  ],
};

export const MOCK_GAUGE: GaugeVm = { value: 41.6, unit: 'W', ts: null };

const MACHINE_NAMES = [
  'CNC Lathe',
  'Injection Molder',
  'Hydraulic Press',
  'Conveyor',
  'Packaging Line',
  'Air Compressor',
  'Paint Booth',
  'Robotic Welder',
];
const STATUSES = ['RUNNING', 'RUNNING', 'IDLE', 'RUNNING', 'FAULT', 'MAINTENANCE', 'STOPPED'];
const CONNECTIONS: FleetRowVm['connection'][] = [
  'ONLINE',
  'ONLINE',
  'OFFLINE',
  'ONLINE',
  'UNCONNECTED',
  'NEVER_SEEN',
];
const AREAS = ['Line A', 'Line B', 'Assembly', null];
const GATEWAYS = ['teltonika-01', 'vbox-02', null];

/** 25 machines, newest update first. Deterministic for a given `now`. */
export function createMockFleet(now = Date.now()): FleetRowVm[] {
  return Array.from({ length: 25 }, (_, i) => {
    const connection = CONNECTIONS[i % CONNECTIONS.length];
    return {
      id: `m-${i + 1}`,
      name: `${MACHINE_NAMES[i % MACHINE_NAMES.length]} ${String(Math.floor(i / 8) + 1).padStart(2, '0')}`,
      code: `MC-${String(i + 1).padStart(3, '0')}`,
      status: STATUSES[i % STATUSES.length],
      updatedAt: new Date(now - i * 47 * 60_000).toISOString(),
      connection,
      location: i % 5 === 4 ? 'Pune Plant' : 'Chennai Plant',
      area: AREAS[i % AREAS.length],
      gateway: connection === 'UNCONNECTED' ? null : GATEWAYS[i % GATEWAYS.length],
    };
  });
}

/** One page (1-based) of the mock fleet. */
export function mockFleetPage(
  page: number,
  pageSize = 10,
  fleet: FleetRowVm[] = createMockFleet(),
): FleetPageVm {
  const totalPages = Math.max(1, Math.ceil(fleet.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    rows: fleet.slice(start, start + pageSize),
    total: fleet.length,
    page: current,
    pageSize,
  };
}
