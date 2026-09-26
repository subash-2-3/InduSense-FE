import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../core/api/api-error';
import { DevicesApi } from '../../../core/api/resources/devices.api';
import { LocationsApi } from '../../../core/api/resources/locations.api';
import { GatewaysApi, MachinesApi } from '../../../core/api/resources/plant-assets.api';
import { TagsApi } from '../../../core/api/resources/tags.api';
import { TelemetryApi } from '../../../core/api/resources/telemetry.api';
import { APP_CONFIG, AppConfig } from '../../../core/config/app-config';
import { Device, Machine, Tag } from '../../../core/models';
import { ApiDashboardDataSource } from './api-dashboard.data-source';
import { DevScenarioService } from './dev-scenario.service';
import { MockDashboardDataSource } from './mock-dashboard.data-source';

describe('ApiDashboardDataSource', () => {
  let dataSource: ApiDashboardDataSource;
  let devScenario: DevScenarioService;
  let mockSource: MockDashboardDataSource;

  const config: AppConfig = {
    appName: 'InduSense',
    production: false,
    apiBaseUrl: '/api/v1',
    refreshIntervalMs: 30000,
    gauge: { label: 'watts', unit: 'W', min: 34, max: 45 },
  };

  const sampleDevice: Device = {
    id: 1,
    company_id: 1,
    gateway_id: null,
    external_id: 'EXT-01',
    name: 'Device 1',
    device_type: 'PLC',
    source: 'MQTT',
    ip_address: null,
    location: null,
    is_active: true,
    last_seen_at: '2026-09-25T12:00:00Z',
    connection_state: 'ONLINE',
    created_at: '2026-09-25T10:00:00Z',
    updated_at: '2026-09-25T12:00:00Z',
  };

  const sampleMachine: Machine = {
    id: 10,
    company_id: 1,
    plant_id: 100,
    area_id: 200,
    device_id: 1,
    machine_code: 'MC-01',
    name: 'Machine 01',
    machine_type: 'LATHE',
    manufacturer: null,
    model: null,
    serial_number: null,
    status: 'RUNNING',
    is_active: true,
    created_at: '2026-09-25T10:00:00Z',
    updated_at: '2026-09-25T12:00:00Z',
  };

  const sampleTag: Tag = {
    id: 99,
    device_id: 1,
    tag_name: 'watts',
    display_name: 'Watts',
    data_type: 'FLOAT',
    unit: 'W',
    category: null,
    is_counter: false,
    is_cumulative: false,
    is_active: true,
    data_id: null,
    monitor_id: null,
    register_address: null,
    created_at: '2026-09-25T10:00:00Z',
    updated_at: '2026-09-25T12:00:00Z',
  };

  const devicesApiMock = {
    listAll: vi.fn().mockReturnValue(of([sampleDevice])),
  };

  const machinesApiMock = {
    list: vi.fn().mockReturnValue(
      of({
        items: [sampleMachine],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      }),
    ),
  };

  const gatewaysApiMock = {
    listAll: vi.fn().mockReturnValue(of([])),
  };

  const locationsApiMock = {
    listAllPlants: vi.fn().mockReturnValue(of([])),
    listAllAreas: vi.fn().mockReturnValue(of([])),
  };

  const tagsApiMock = {
    findByName: vi.fn().mockReturnValue(of(sampleTag)),
  };

  const telemetryApiMock = {
    latest: vi.fn().mockReturnValue(
      of([
        {
          tag_id: 99,
          device_id: 1,
          tag_name: 'watts',
          display_name: 'Watts',
          unit: 'W',
          ts: '2026-09-25T12:00:00Z',
          value: 42.1,
          value_text: null,
          quality: 'GOOD',
          received_at: '2026-09-25T12:00:01Z',
        },
      ]),
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    devicesApiMock.listAll.mockReturnValue(of([sampleDevice]));
    machinesApiMock.list.mockReturnValue(
      of({
        items: [sampleMachine],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      }),
    );
    gatewaysApiMock.listAll.mockReturnValue(of([]));
    locationsApiMock.listAllPlants.mockReturnValue(of([]));
    locationsApiMock.listAllAreas.mockReturnValue(of([]));
    tagsApiMock.findByName.mockReturnValue(of(sampleTag));
    telemetryApiMock.latest.mockReturnValue(
      of([
        {
          tag_id: 99,
          device_id: 1,
          tag_name: 'watts',
          display_name: 'Watts',
          unit: 'W',
          ts: '2026-09-25T12:00:00Z',
          value: 42.1,
          value_text: null,
          quality: 'GOOD',
          received_at: '2026-09-25T12:00:01Z',
        },
      ]),
    );

    TestBed.configureTestingModule({
      providers: [
        ApiDashboardDataSource,
        { provide: APP_CONFIG, useValue: config },
        { provide: DevicesApi, useValue: devicesApiMock },
        { provide: MachinesApi, useValue: machinesApiMock },
        { provide: GatewaysApi, useValue: gatewaysApiMock },
        { provide: LocationsApi, useValue: locationsApiMock },
        { provide: TagsApi, useValue: tagsApiMock },
        { provide: TelemetryApi, useValue: telemetryApiMock },
      ],
    });

    dataSource = TestBed.inject(ApiDashboardDataSource);
    devScenario = TestBed.inject(DevScenarioService);
    mockSource = TestBed.inject(MockDashboardDataSource);
    devScenario.current.set('normal');
  });

  it('loads live data from all API endpoints and produces a complete snapshot', async () => {
    return new Promise<void>((done) => {
      dataSource.load({ fleetPage: 1, fleetPageSize: 10 }).subscribe((snapshot) => {
        expect(snapshot.deviceCount).toEqual({ ok: true, data: { value: 1 } });
        expect(snapshot.deviceTypeCount).toEqual({ ok: true, data: { value: 1 } });
        expect(snapshot.devicesByType).toEqual({
          ok: true,
          data: [{ label: 'PLC', value: 1 }],
        });
        expect(snapshot.devicesByConnection).toEqual({
          ok: true,
          data: [
            { label: 'Online', value: 1, tone: 'running' },
            { label: 'Offline', value: 0, tone: 'warning' },
            { label: 'Never seen', value: 0, tone: 'stopped' },
          ],
        });
        expect(snapshot.devicesBySource.ok).toBe(true);
        expect(snapshot.fleet.ok).toBe(true);
        if (snapshot.fleet.ok) {
          expect(snapshot.fleet.data.total).toBe(1);
          expect(snapshot.fleet.data.rows[0].code).toBe('MC-01');
        }
        expect(snapshot.gauge).toEqual({
          ok: true,
          data: { value: 42.1, unit: 'W', ts: '2026-09-25T12:00:00Z' },
        });
        done();
      });
    });
  });

  it('delegates to mockSource when dev scenario is not normal', async () => {
    devScenario.current.set('empty');
    const spy = vi.spyOn(mockSource, 'load');
    return new Promise<void>((done) => {
      dataSource.load({ fleetPage: 1, fleetPageSize: 10 }).subscribe(() => {
        expect(spy).toHaveBeenCalled();
        done();
      });
    });
  });

  it('isolates device API failure so fleet and gauge still load', async () => {
    devicesApiMock.listAll.mockReturnValue(
      throwError(() => new ApiError(500, 'INTERNAL_ERROR', 'Database error')),
    );

    return new Promise<void>((done) => {
      dataSource.load({ fleetPage: 1, fleetPageSize: 10 }).subscribe((snapshot) => {
        expect(snapshot.deviceCount).toEqual({ ok: false, error: 'Database error' });
        expect(snapshot.deviceTypeCount).toEqual({ ok: false, error: 'Database error' });
        expect(snapshot.devicesByType).toEqual({ ok: false, error: 'Database error' });
        expect(snapshot.fleet.ok).toBe(true);
        expect(snapshot.gauge.ok).toBe(true);
        done();
      });
    });
  });

  it('handles machine API failure without failing device widgets', async () => {
    machinesApiMock.list.mockReturnValue(
      throwError(() => new ApiError(403, 'PERMISSION_DENIED', 'Forbidden')),
    );

    return new Promise<void>((done) => {
      dataSource.load({ fleetPage: 1, fleetPageSize: 10 }).subscribe((snapshot) => {
        expect(snapshot.deviceCount.ok).toBe(true);
        expect(snapshot.fleet).toEqual({ ok: false, error: 'Forbidden' });
        done();
      });
    });
  });

  it('handles missing gauge tag gracefully by returning null reading', async () => {
    tagsApiMock.findByName.mockReturnValue(of(null));

    return new Promise<void>((done) => {
      dataSource.load({ fleetPage: 1, fleetPageSize: 10 }).subscribe((snapshot) => {
        expect(snapshot.gauge).toEqual({
          ok: true,
          data: { value: null, unit: 'W', ts: null },
        });
        done();
      });
    });
  });

  it('loadFleetPage pages machines and joins metadata', async () => {
    return new Promise<void>((done) => {
      dataSource.loadFleetPage(2, 5).subscribe((fleet) => {
        expect(machinesApiMock.list).toHaveBeenCalledWith({ page: 2, page_size: 5 });
        expect(fleet.total).toBe(1);
        done();
      });
    });
  });
});
