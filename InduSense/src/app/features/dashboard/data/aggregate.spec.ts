import { describe, expect, it } from 'vitest';

import { Page } from '../../../core/api/api-envelope';
import { Area, Device, Gateway, LatestValue, Machine, Plant, Tag } from '../../../core/models';
import {
  aggregateDeviceCount,
  aggregateDeviceTypeCount,
  aggregateDevicesByConnection,
  aggregateDevicesBySource,
  aggregateDevicesByType,
  aggregateFleet,
  aggregateGauge,
  mapAssetConnection,
} from './aggregate';

function fakeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    company_id: 1,
    gateway_id: null,
    external_id: 'EXT-01',
    name: 'Device 1',
    device_type: 'PLC',
    source: 'MQTT',
    ip_address: null,
    location: null,
    status: 'active',
    last_seen_at: '2026-09-25T12:00:00Z',
    connection_state: 'ONLINE',
    created_at: '2026-09-25T10:00:00Z',
    updated_at: '2026-09-25T12:00:00Z',
    ...overrides,
  };
}

describe('aggregate helpers', () => {
  describe('aggregateDeviceCount', () => {
    it('returns the total count', () => {
      expect(aggregateDeviceCount([])).toEqual({ value: 0 });
      expect(aggregateDeviceCount([fakeDevice({ id: 1 }), fakeDevice({ id: 2 })])).toEqual({
        value: 2,
      });
    });
  });

  describe('aggregateDeviceTypeCount', () => {
    it('counts unique non-empty device types', () => {
      const devices = [
        fakeDevice({ id: 1, device_type: 'PLC' }),
        fakeDevice({ id: 2, device_type: 'PLC' }),
        fakeDevice({ id: 3, device_type: 'Gateway' }),
        fakeDevice({ id: 4, device_type: null }),
        fakeDevice({ id: 5, device_type: '   ' }),
      ];
      expect(aggregateDeviceTypeCount(devices)).toEqual({ value: 2 });
    });
  });

  describe('aggregateDevicesByType', () => {
    it('groups and sorts by count descending', () => {
      const devices = [
        fakeDevice({ id: 1, device_type: 'Sensor' }),
        fakeDevice({ id: 2, device_type: 'PLC' }),
        fakeDevice({ id: 3, device_type: 'PLC' }),
        fakeDevice({ id: 4, device_type: null }),
      ];
      const slices = aggregateDevicesByType(devices);
      expect(slices).toEqual([
        { label: 'PLC', value: 2 },
        { label: 'Sensor', value: 1 },
        { label: 'Unspecified', value: 1 },
      ]);
    });
  });

  describe('aggregateDevicesByConnection', () => {
    it('produces Online, Offline, and Never seen slices with correct tones', () => {
      const devices = [
        fakeDevice({ id: 1, connection_state: 'ONLINE' }),
        fakeDevice({ id: 2, connection_state: 'ONLINE' }),
        fakeDevice({ id: 3, connection_state: 'OFFLINE' }),
        fakeDevice({ id: 4, connection_state: 'NEVER_SEEN' }),
      ];
      expect(aggregateDevicesByConnection(devices)).toEqual([
        { label: 'Online', value: 2, tone: 'running' },
        { label: 'Offline', value: 1, tone: 'warning' },
        { label: 'Never seen', value: 1, tone: 'stopped' },
      ]);
    });
  });

  describe('aggregateDevicesBySource', () => {
    it('creates stacked series for each connection state across distinct sources', () => {
      const devices = [
        fakeDevice({ id: 1, source: 'MQTT', connection_state: 'ONLINE' }),
        fakeDevice({ id: 2, source: 'MQTT', connection_state: 'OFFLINE' }),
        fakeDevice({ id: 3, source: 'VNET', connection_state: 'ONLINE' }),
        fakeDevice({ id: 4, source: null, connection_state: 'NEVER_SEEN' }),
      ];
      const result = aggregateDevicesBySource(devices);
      expect(result.categories).toEqual(['MQTT', 'Unknown', 'VNET']);
      expect(result.series).toEqual([
        { label: 'Online', tone: 'running', values: [1, 0, 1] },
        { label: 'Offline', tone: 'warning', values: [1, 0, 0] },
        { label: 'Never seen', tone: 'stopped', values: [0, 1, 0] },
      ]);
    });
  });

  describe('mapAssetConnection', () => {
    it('maps connection state properly', () => {
      expect(mapAssetConnection('ONLINE')).toBe('ONLINE');
      expect(mapAssetConnection('OFFLINE')).toBe('OFFLINE');
      expect(mapAssetConnection('NEVER_SEEN')).toBe('NEVER_SEEN');
      expect(mapAssetConnection(undefined)).toBe('UNCONNECTED');
    });
  });

  describe('aggregateFleet', () => {
    it('joins machines with devices, gateways, plants, and areas', () => {
      const machinesPage: Page<Machine> = {
        items: [
          {
            id: 10,
            company_id: 1,
            plant_id: 100,
            area_id: 200,
            device_id: 1,
            machine_code: 'MC-001',
            name: 'CNC Lathe 01',
            machine_type: 'LATHE',
            manufacturer: 'Haas',
            model: 'VF-2',
            serial_number: 'SN-01',
            operating_status: 'RUNNING',
            status: 'active',
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-25T12:30:00Z',
          },
          {
            id: 20,
            company_id: 1,
            plant_id: 100,
            area_id: null,
            device_id: null,
            machine_code: 'MC-002',
            name: 'Press 02',
            machine_type: null,
            manufacturer: null,
            model: null,
            serial_number: null,
            operating_status: 'IDLE',
            status: 'active',
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-25T11:00:00Z',
          },
        ],
        pagination: { page: 1, page_size: 10, total: 2, total_pages: 1 },
      };

      const devices: Device[] = [fakeDevice({ id: 1, gateway_id: 50, connection_state: 'ONLINE' })];

      const gateways: Gateway[] = [
        {
          id: 50,
          company_id: 1,
          plant_id: 100,
          area_id: 200,
          gateway_code: 'GW-01',
          name: 'Main Gateway',
          gateway_type: 'VBOX',
          manufacturer: null,
          model: null,
          serial_number: null,
          ip_address: null,
          port: null,
          status: 'active',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ];

      const plants: Plant[] = [
        {
          id: 100,
          company_id: 1,
          code: 'P-01',
          name: 'Chennai Plant',
          address: null,
          timezone: null,
          status: 'active',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ];

      const areas: Area[] = [
        {
          id: 200,
          company_id: 1,
          plant_id: 100,
          code: 'A-01',
          name: 'Line A',
          description: null,
          status: 'active',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ];

      const fleet = aggregateFleet(machinesPage, devices, gateways, plants, areas);
      expect(fleet.total).toBe(2);
      expect(fleet.page).toBe(1);
      expect(fleet.pageSize).toBe(10);
      expect(fleet.rows).toHaveLength(2);

      expect(fleet.rows[0]).toEqual({
        id: '10',
        name: 'CNC Lathe 01',
        code: 'MC-001',
        status: 'RUNNING',
        updatedAt: '2026-09-25T12:30:00Z',
        connection: 'ONLINE',
        location: 'Chennai Plant / Line A',
        area: 'Line A',
        gateway: 'Main Gateway',
      });

      expect(fleet.rows[1]).toEqual({
        id: '20',
        name: 'Press 02',
        code: 'MC-002',
        status: 'IDLE',
        updatedAt: '2026-09-25T11:00:00Z',
        connection: 'UNCONNECTED',
        location: 'Chennai Plant',
        area: null,
        gateway: null,
      });
    });
  });

  describe('aggregateGauge', () => {
    const config = { label: 'watts', unit: 'W', min: 34, max: 45 };

    it('returns gauge value from latest telemetry reading', () => {
      const tag: Tag = {
        id: 1,
        device_id: 1,
        tag_name: 'watts',
        display_name: 'Total Power',
        data_type: 'FLOAT',
        unit: 'kW',
        category: null,
        is_counter: false,
        is_cumulative: false,
        status: 'active',
        data_id: null,
        monitor_id: null,
        register_address: null,
        code: null,
        tag_type: 'ems',
        roundoff_digits: null,
        description: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      };

      const latest: LatestValue = {
        tag_id: 1,
        device_id: 1,
        tag_name: 'watts',
        display_name: 'Total Power',
        unit: 'kW',
        ts: '2026-09-25T12:00:00Z',
        value: 41.5,
        value_text: null,
        quality: 'GOOD',
        received_at: '2026-09-25T12:00:01Z',
      };

      expect(aggregateGauge(tag, latest, config)).toEqual({
        value: 41.5,
        unit: 'kW',
        ts: '2026-09-25T12:00:00Z',
      });
    });

    it('falls back to null and config unit when no reading exists', () => {
      expect(aggregateGauge(null, null, config)).toEqual({
        value: null,
        unit: 'W',
        ts: null,
      });
    });
  });
});
