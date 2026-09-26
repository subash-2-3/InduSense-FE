import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { APP_CONFIG } from '../../config/app-config';
import { Tag } from '../../models';
import {
  AuditLogsApi,
  CompaniesApi,
  DashboardsApi,
  DevicesApi,
  GatewaysApi,
  LocationsApi,
  LoggersApi,
  MachinesApi,
  MetersApi,
  ReportsApi,
  RolesApi,
  TagsApi,
  UsersApi,
} from '../index';
import { matchTagByName } from './tags.api';
import { TelemetryApi, toApiTime } from './telemetry.api';

const single = <T>(data: T) => ({ success: true, data });
const page = <T>(data: T[], total = data.length) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total, total_pages: total ? 1 : 0 },
});

describe('API resources', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { ...environment, apiBaseUrl: '/api/v1' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const expectGet = (url: string, query = '') =>
    http.expectOne(
      (r) => r.method === 'GET' && r.url === url && r.params.toString() === query,
      `GET ${url}?${query}`,
    );

  const expectPost = (url: string) =>
    http.expectOne((r) => r.method === 'POST' && r.url === url, `POST ${url}`);

  const expectPatch = (url: string) =>
    http.expectOne((r) => r.method === 'PATCH' && r.url === url, `PATCH ${url}`);

  const expectPut = (url: string) =>
    http.expectOne((r) => r.method === 'PUT' && r.url === url, `PUT ${url}`);

  const expectDelete = (url: string) =>
    http.expectOne((r) => r.method === 'DELETE' && r.url === url, `DELETE ${url}`);

  describe('DevicesApi', () => {
    it('lists, pages through, counts and gets devices', async () => {
      const devices = TestBed.inject(DevicesApi);

      void firstValueFrom(devices.list({ search: 'box', page: 2, page_size: 20 }));
      expectGet('/api/v1/devices', 'search=box&page=2&page_size=20').flush(page([]));

      void firstValueFrom(devices.listAll({ is_active: true }));
      expectGet('/api/v1/devices', 'is_active=true&page=1&page_size=100').flush(page([]));

      const count = firstValueFrom(devices.count({ gateway_id: 2 }));
      expectGet('/api/v1/devices', 'gateway_id=2&page=1&page_size=1').flush(page([{}], 42));
      expect(await count).toBe(42);

      void firstValueFrom(devices.get(7));
      expectGet('/api/v1/devices/7').flush(single({ id: 7 }));
    });

    it('creates, updates and deactivates devices', () => {
      const devices = TestBed.inject(DevicesApi);

      void firstValueFrom(devices.create({ external_id: 'DEV-101', name: 'Device 101' }));
      expectPost('/api/v1/devices').flush(single({ id: 10, external_id: 'DEV-101' }));

      void firstValueFrom(devices.update(10, { name: 'Updated Device' }));
      expectPatch('/api/v1/devices/10').flush(single({ id: 10, name: 'Updated Device' }));

      void firstValueFrom(devices.deactivate(10));
      expectDelete('/api/v1/devices/10').flush(single({ id: 10, is_active: false }));
    });

    it('manages device connection settings', () => {
      const devices = TestBed.inject(DevicesApi);

      void firstValueFrom(devices.listConnections(5));
      expectGet('/api/v1/devices/5/connections').flush(single([]));

      void firstValueFrom(devices.createConnection(5, { protocol: 'MQTT', host: 'mqtt.local' }));
      expectPost('/api/v1/devices/5/connections').flush(single({ id: 1, protocol: 'MQTT' }));

      void firstValueFrom(devices.updateConnection(5, 1, { port: 1883 }));
      expectPatch('/api/v1/devices/5/connections/1').flush(single({ id: 1, port: 1883 }));

      void firstValueFrom(devices.deleteConnection(5, 1));
      expectDelete('/api/v1/devices/5/connections/1').flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('MachinesApi, MetersApi and GatewaysApi', () => {
    it('use their own paths with the shared plant-asset filters and CRUD', () => {
      const machines = TestBed.inject(MachinesApi);
      const meters = TestBed.inject(MetersApi);
      const gateways = TestBed.inject(GatewaysApi);

      void firstValueFrom(machines.list({ plant_id: 1, device_id: 3 }));
      expectGet('/api/v1/machines', 'plant_id=1&device_id=3').flush(page([]));

      void firstValueFrom(machines.create({ plant_id: 1, machine_code: 'M-01', name: 'Press 01' }));
      expectPost('/api/v1/machines').flush(single({ id: 1, machine_code: 'M-01' }));

      void firstValueFrom(machines.update(1, { name: 'Press 01 Updated' }));
      expectPatch('/api/v1/machines/1').flush(single({ id: 1, name: 'Press 01 Updated' }));

      void firstValueFrom(machines.deactivate(1));
      expectDelete('/api/v1/machines/1').flush(single({ id: 1, is_active: false }));

      void firstValueFrom(meters.create({ plant_id: 1, meter_code: 'EM-01', name: 'Main Meter' }));
      expectPost('/api/v1/meters').flush(single({ id: 2, meter_code: 'EM-01' }));

      void firstValueFrom(gateways.listAll({ area_id: 2 }));
      expectGet('/api/v1/gateways', 'area_id=2&page=1&page_size=100').flush(page([]));
    });

    it('reads and writes metric tag mappings for machines and meters', () => {
      const machines = TestBed.inject(MachinesApi);
      const meters = TestBed.inject(MetersApi);

      void firstValueFrom(machines.tagMappings(4));
      expectGet('/api/v1/machines/4/tag-mappings').flush(single([]));

      void firstValueFrom(machines.setTagMappings(4, [{ metric: 'POWER', tag_id: 12 }]));
      expectPut('/api/v1/machines/4/tag-mappings').flush(single([{ metric: 'POWER', tag_id: 12 }]));

      void firstValueFrom(meters.tagMappings(5));
      expectGet('/api/v1/meters/5/tag-mappings').flush(single([]));

      void firstValueFrom(meters.setTagMappings(5, [{ metric: 'ENERGY', tag_id: 15 }]));
      expectPut('/api/v1/meters/5/tag-mappings').flush(single([{ metric: 'ENERGY', tag_id: 15 }]));
    });
  });

  describe('LocationsApi', () => {
    it('reads, creates, updates and deactivates plants and areas', () => {
      const locations = TestBed.inject(LocationsApi);

      void firstValueFrom(locations.listAllPlants());
      expectGet('/api/v1/plants', 'page=1&page_size=100').flush(page([]));

      void firstValueFrom(locations.createPlant({ code: 'PL-01', name: 'Plant 1' }));
      expectPost('/api/v1/plants').flush(single({ id: 1, code: 'PL-01' }));

      void firstValueFrom(locations.updatePlant(1, { name: 'Plant 1 Updated' }));
      expectPatch('/api/v1/plants/1').flush(single({ id: 1, name: 'Plant 1 Updated' }));

      void firstValueFrom(locations.deactivatePlant(1));
      expectDelete('/api/v1/plants/1').flush(single({ id: 1, is_active: false }));

      void firstValueFrom(locations.createArea({ plant_id: 1, code: 'AR-01', name: 'Area 1' }));
      expectPost('/api/v1/areas').flush(single({ id: 10, code: 'AR-01' }));

      void firstValueFrom(locations.updateArea(10, { name: 'Area 1 Updated' }));
      expectPatch('/api/v1/areas/10').flush(single({ id: 10, name: 'Area 1 Updated' }));

      void firstValueFrom(locations.deactivateArea(10));
      expectDelete('/api/v1/areas/10').flush(single({ id: 10, is_active: false }));
    });
  });

  describe('TagsApi', () => {
    const tag = (id: number, tag_name: string, display_name: string | null, is_active = true) =>
      ({ id, tag_name, display_name, is_active }) as Tag;

    it('finds a tag by exact name, preferring tag_name over display_name', async () => {
      const tags = TestBed.inject(TagsApi);
      const found = firstValueFrom(tags.findByName(' Watts ', 3));
      expectGet(
        '/api/v1/tags',
        'search=Watts&device_id=3&is_active=true&page=1&page_size=100',
      ).flush(
        page([tag(1, 'watts_total', 'Watts'), tag(2, 'WATTS', null), tag(3, 'watts2', null)]),
      );
      expect((await found)?.id).toBe(2);
    });

    it('matches display names and ignores partial and inactive matches', () => {
      expect(matchTagByName([tag(1, 'p_act', 'Watts')], 'watts')?.id).toBe(1);
      expect(matchTagByName([tag(1, 'watts_total', null)], 'watts')).toBeNull();
      expect(matchTagByName([tag(1, 'watts', null, false)], 'watts')).toBeNull();
    });

    it('lists, gets, creates and updates tags', () => {
      const tags = TestBed.inject(TagsApi);
      void firstValueFrom(tags.list({ device_id: 3, category: 'energy' }));
      expectGet('/api/v1/tags', 'device_id=3&category=energy').flush(page([]));

      void firstValueFrom(tags.create({ device_id: 3, tag_name: 'voltage_l1' }));
      expectPost('/api/v1/tags').flush(single({ id: 20, tag_name: 'voltage_l1' }));

      void firstValueFrom(tags.update(20, { unit: 'V' }));
      expectPatch('/api/v1/tags/20').flush(single({ id: 20, unit: 'V' }));
    });
  });

  describe('TelemetryApi', () => {
    it('requests latest values for a device or repeated tag ids', async () => {
      const telemetry = TestBed.inject(TelemetryApi);
      const latest = firstValueFrom(telemetry.latest({ tagIds: [4, 5] }));
      expectGet('/api/v1/telemetry/latest', 'tag_id=4&tag_id=5').flush(single([{ tag_id: 4 }]));
      expect(await latest).toEqual([{ tag_id: 4 }]);

      void firstValueFrom(telemetry.latest({ deviceId: 2 }));
      expectGet('/api/v1/telemetry/latest', 'device_id=2').flush(single([]));
    });

    it('requests history with ISO time range, order and paging', () => {
      void firstValueFrom(
        TestBed.inject(TelemetryApi).history({
          deviceId: 2,
          tagIds: [4],
          start: new Date('2026-09-25T11:55:00Z'),
          end: '2026-09-25T12:00:00+00:00',
          order: 'desc',
          page: 1,
          pageSize: 1000,
        }),
      );
      expectGet(
        '/api/v1/telemetry',
        'device_id=2&tag_id=4&start_time=2026-09-25T11:55:00.000Z&end_time=2026-09-25T12:00:00%2B00:00&order=desc&page=1&page_size=1000',
      ).flush(page([]));
    });

    it('formats times for the API', () => {
      expect(toApiTime(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z');
      expect(toApiTime('2026-01-02T03:04:05+05:30')).toBe('2026-01-02T03:04:05+05:30');
      expect(toApiTime(undefined)).toBeUndefined();
    });
  });

  describe('DashboardsApi', () => {
    it('fetches overview, plant, machine, meter and gateway dashboards', () => {
      const dashboards = TestBed.inject(DashboardsApi);

      void firstValueFrom(dashboards.overview({ plant_id: 1 }));
      expectGet('/api/v1/dashboards/overview', 'plant_id=1').flush(single({}));

      void firstValueFrom(dashboards.plant(2, { area_id: 3 }));
      expectGet('/api/v1/dashboards/plants/2', 'area_id=3').flush(single({}));

      void firstValueFrom(dashboards.machine(4, { interval: '1h' }));
      expectGet('/api/v1/dashboards/machines/4', 'interval=1h').flush(single({}));

      void firstValueFrom(dashboards.meter(5));
      expectGet('/api/v1/dashboards/meters/5').flush(single({}));

      void firstValueFrom(dashboards.gateway(6));
      expectGet('/api/v1/dashboards/gateways/6').flush(single({}));
    });
  });

  describe('ReportsApi', () => {
    it('fetches energy, production, runtime, downtime, oee and device health reports', () => {
      const reports = TestBed.inject(ReportsApi);

      void firstValueFrom(reports.energy({ plant_id: 1, group_by: 'area' }));
      expectGet('/api/v1/reports/energy', 'plant_id=1&group_by=area').flush({
        success: true,
        data: { summary: {}, rows: [], metadata: {} },
        pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
      });

      void firstValueFrom(reports.production({ machine_id: 2 }));
      expectGet('/api/v1/reports/production', 'machine_id=2').flush({
        success: true,
        data: { summary: {}, rows: [], metadata: {} },
        pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
      });

      void firstValueFrom(reports.machineRuntime({ plant_id: 3 }));
      expectGet('/api/v1/reports/machine-runtime', 'plant_id=3').flush({
        success: true,
        data: { summary: {}, rows: [], metadata: {} },
        pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
      });

      void firstValueFrom(reports.downtime({ min_duration_seconds: 60 }));
      expectGet('/api/v1/reports/downtime', 'min_duration_seconds=60').flush({
        success: true,
        data: { summary: {}, rows: [], metadata: {} },
        pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
      });

      void firstValueFrom(reports.oee({ plant_id: 1 }));
      expectGet('/api/v1/reports/oee', 'plant_id=1').flush({
        success: true,
        data: { summary: {}, rows: [], metadata: {} },
        pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
      });

      void firstValueFrom(reports.deviceHealth({ plant_id: 1 }));
      expectGet('/api/v1/reports/device-health', 'plant_id=1').flush({
        success: true,
        data: { summary: {}, rows: [], loggers: [], metadata: {} },
        pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
      });
    });
  });

  describe('Administration APIs', () => {
    it('operates UsersApi (list, get, create, update, deactivate, roles, password reset)', () => {
      const users = TestBed.inject(UsersApi);

      void firstValueFrom(users.list({ is_active: true }));
      expectGet('/api/v1/users', 'is_active=true').flush(page([]));

      void firstValueFrom(users.get(5));
      expectGet('/api/v1/users/5').flush(single({ id: 5 }));

      void firstValueFrom(users.create({ email: 'user@test.com', password: 'Password123' }));
      expectPost('/api/v1/users').flush(single({ id: 6, email: 'user@test.com' }));

      void firstValueFrom(users.update(6, { first_name: 'John' }));
      expectPatch('/api/v1/users/6').flush(single({ id: 6, first_name: 'John' }));

      void firstValueFrom(users.deactivate(6));
      expectDelete('/api/v1/users/6').flush(single({ id: 6, is_active: false }));

      void firstValueFrom(users.setRoles(6, ['OPERATOR']));
      expectPut('/api/v1/users/6/roles').flush(single({ id: 6, roles: ['OPERATOR'] }));

      void firstValueFrom(users.resetPassword(6, 'NewPassword123'));
      expectPost('/api/v1/users/6/password').flush(null, { status: 204, statusText: 'No Content' });
    });

    it('operates RolesApi (list, get, create, update, permissions)', () => {
      const roles = TestBed.inject(RolesApi);

      void firstValueFrom(roles.list());
      expectGet('/api/v1/roles').flush(single([]));

      void firstValueFrom(roles.create({ code: 'CUSTOM', name: 'Custom Role' }));
      expectPost('/api/v1/roles').flush(single({ id: 1, code: 'CUSTOM' }));

      void firstValueFrom(roles.update(1, { name: 'Custom Role Updated' }));
      expectPatch('/api/v1/roles/1').flush(single({ id: 1, name: 'Custom Role Updated' }));

      void firstValueFrom(roles.listPermissions());
      expectGet('/api/v1/permissions').flush(single([]));
    });

    it('operates CompaniesApi (companies and modules)', () => {
      const companies = TestBed.inject(CompaniesApi);

      void firstValueFrom(companies.listAll());
      expectGet('/api/v1/companies', 'page=1&page_size=100').flush(page([]));

      void firstValueFrom(companies.create({ code: 'COMP1', name: 'Company 1' }));
      expectPost('/api/v1/companies').flush(single({ id: 1, code: 'COMP1' }));

      void firstValueFrom(companies.modules(1));
      expectGet('/api/v1/companies/1/modules').flush(single(['OEE', 'ENERGY']));

      void firstValueFrom(companies.setModules(1, ['OEE']));
      expectPut('/api/v1/companies/1/modules').flush(single(['OEE']));
    });

    it('operates LoggersApi and AuditLogsApi', () => {
      const loggers = TestBed.inject(LoggersApi);
      const audit = TestBed.inject(AuditLogsApi);

      void firstValueFrom(loggers.list({ unassigned: true }));
      expectGet('/api/v1/loggers', 'unassigned=true').flush(page([]));

      void firstValueFrom(loggers.assign('logger-01', 2));
      expectPatch('/api/v1/loggers/logger-01').flush(single({ logger_id: 'logger-01', company_id: 2 }));

      void firstValueFrom(audit.list({ action: 'login' }));
      expectGet('/api/v1/audit-logs', 'action=login').flush(page([]));
    });
  });
});
