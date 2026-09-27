import { Page } from '../../../core/api/api-envelope';
import { AppConfig } from '../../../core/config/app-config';
import {
  Area,
  ConnectionState,
  Device,
  Gateway,
  LatestValue,
  Machine,
  Plant,
  Tag,
} from '../../../core/models';
import {
  AssetConnection,
  CategorySliceVm,
  FleetPageVm,
  FleetRowVm,
  GaugeVm,
  KpiVm,
  StackedBarVm,
  StatusSliceVm,
} from '../models/dashboard.vm';

/** W1: Total device count */
export function aggregateDeviceCount(devices: readonly Device[]): KpiVm {
  return { value: devices.length };
}

/** W2: Distinct non-null/non-empty device_type count */
export function aggregateDeviceTypeCount(devices: readonly Device[]): KpiVm {
  const types = new Set<string>();
  for (const d of devices) {
    const t = d.device_type?.trim();
    if (t) {
      types.add(t);
    }
  }
  return { value: types.size };
}

/** W3: Devices grouped by device_type (null -> "Unspecified") */
export function aggregateDevicesByType(devices: readonly Device[]): CategorySliceVm[] {
  const counts = new Map<string, number>();
  for (const d of devices) {
    const key = d.device_type?.trim() || 'Unspecified';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** W4: Devices grouped by connection_state */
export function aggregateDevicesByConnection(devices: readonly Device[]): StatusSliceVm[] {
  let online = 0;
  let offline = 0;
  let neverSeen = 0;

  for (const d of devices) {
    switch (d.connection_state) {
      case 'ONLINE':
        online++;
        break;
      case 'OFFLINE':
        offline++;
        break;
      case 'NEVER_SEEN':
      default:
        neverSeen++;
        break;
    }
  }

  return [
    { label: 'Online', value: online, tone: 'running' },
    { label: 'Offline', value: offline, tone: 'warning' },
    { label: 'Never seen', value: neverSeen, tone: 'stopped' },
  ];
}

/** W5: Devices grouped by source and connection_state */
export function aggregateDevicesBySource(devices: readonly Device[]): StackedBarVm {
  const sourceSet = new Set<string>();
  for (const d of devices) {
    sourceSet.add(d.source?.trim() || 'Unknown');
  }
  const categories = Array.from(sourceSet).sort((a, b) => a.localeCompare(b));

  const onlineValues: number[] = new Array(categories.length).fill(0);
  const offlineValues: number[] = new Array(categories.length).fill(0);
  const neverSeenValues: number[] = new Array(categories.length).fill(0);

  const categoryIndex = new Map(categories.map((c, i) => [c, i]));

  for (const d of devices) {
    const cat = d.source?.trim() || 'Unknown';
    const idx = categoryIndex.get(cat)!;
    switch (d.connection_state) {
      case 'ONLINE':
        onlineValues[idx]++;
        break;
      case 'OFFLINE':
        offlineValues[idx]++;
        break;
      case 'NEVER_SEEN':
      default:
        neverSeenValues[idx]++;
        break;
    }
  }

  return {
    categories,
    series: [
      { label: 'Online', tone: 'running', values: onlineValues },
      { label: 'Offline', tone: 'warning', values: offlineValues },
      { label: 'Never seen', tone: 'stopped', values: neverSeenValues },
    ],
  };
}

/** Maps device connection state to asset connection status */
export function mapAssetConnection(connectionState: ConnectionState | undefined): AssetConnection {
  switch (connectionState) {
    case 'ONLINE':
      return 'ONLINE';
    case 'OFFLINE':
      return 'OFFLINE';
    case 'NEVER_SEEN':
      return 'NEVER_SEEN';
    default:
      return 'UNCONNECTED';
  }
}

/** W6: Machine fleet page mapped with lookups */
export function aggregateFleet(
  machinesPage: Page<Machine>,
  devices: readonly Device[],
  gateways: readonly Gateway[],
  plants: readonly Plant[],
  areas: readonly Area[],
): FleetPageVm {
  const deviceMap = new Map<number, Device>(devices.map((d) => [d.id, d]));
  const gatewayMap = new Map<number, Gateway>(gateways.map((g) => [g.id, g]));
  const plantMap = new Map<number, Plant>(plants.map((p) => [p.id, p]));
  const areaMap = new Map<number, Area>(areas.map((a) => [a.id, a]));

  const rows: FleetRowVm[] = machinesPage.items.map((m) => {
    const device = m.device_id != null ? deviceMap.get(m.device_id) : undefined;
    const gateway = device?.gateway_id != null ? gatewayMap.get(device.gateway_id) : undefined;
    const plant = plantMap.get(m.plant_id);
    const area = m.area_id != null ? areaMap.get(m.area_id) : undefined;

    const connection: AssetConnection = device
      ? mapAssetConnection(device.connection_state)
      : 'UNCONNECTED';

    const location = plant && area ? `${plant.name} / ${area.name}` : plant ? plant.name : '—';

    return {
      id: String(m.id),
      name: m.name,
      code: m.machine_code,
      status: m.operating_status,
      updatedAt: m.updated_at,
      connection,
      location,
      area: area?.name ?? null,
      gateway: gateway?.name ?? null,
    };
  });

  return {
    rows,
    total: machinesPage.pagination.total,
    page: machinesPage.pagination.page,
    pageSize: machinesPage.pagination.page_size,
  };
}

/** W7: Gauge reading */
export function aggregateGauge(
  tag: Tag | null,
  latest: LatestValue | null,
  configGauge: AppConfig['gauge'],
): GaugeVm {
  return {
    value: latest?.value ?? null,
    unit: tag?.unit ?? configGauge.unit,
    ts: latest?.ts ?? null,
  };
}
