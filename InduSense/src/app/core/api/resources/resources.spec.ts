import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { APP_CONFIG } from '../../config/app-config';
import { Tag } from '../../models';
import { DevicesApi } from './devices.api';
import { LocationsApi } from './locations.api';
import { GatewaysApi, MachinesApi } from './plant-assets.api';
import { TagsApi, matchTagByName } from './tags.api';
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
  });

  describe('MachinesApi and GatewaysApi', () => {
    it('use their own paths with the shared plant-asset filters', () => {
      void firstValueFrom(TestBed.inject(MachinesApi).list({ plant_id: 1, device_id: 3 }));
      expectGet('/api/v1/machines', 'plant_id=1&device_id=3').flush(page([]));

      void firstValueFrom(TestBed.inject(MachinesApi).get(5));
      expectGet('/api/v1/machines/5').flush(single({}));

      void firstValueFrom(TestBed.inject(GatewaysApi).listAll({ area_id: 2 }));
      expectGet('/api/v1/gateways', 'area_id=2&page=1&page_size=100').flush(page([]));

      void firstValueFrom(TestBed.inject(GatewaysApi).list());
      expectGet('/api/v1/gateways').flush(page([]));
    });
  });

  describe('LocationsApi', () => {
    it('reads plants and areas', () => {
      const locations = TestBed.inject(LocationsApi);
      void firstValueFrom(locations.listAllPlants());
      expectGet('/api/v1/plants', 'page=1&page_size=100').flush(page([]));
      void firstValueFrom(locations.listAreas({ plant_id: 4 }));
      expectGet('/api/v1/areas', 'plant_id=4').flush(page([]));
      void firstValueFrom(locations.listAllAreas({ plant_id: 4 }));
      expectGet('/api/v1/areas', 'plant_id=4&page=1&page_size=100').flush(page([]));
      void firstValueFrom(locations.getPlant(1));
      expectGet('/api/v1/plants/1').flush(single({}));
      void firstValueFrom(locations.getArea(2));
      expectGet('/api/v1/areas/2').flush(single({}));
      void firstValueFrom(locations.listPlants({ search: 'Chennai' }));
      expectGet('/api/v1/plants', 'search=Chennai').flush(page([]));
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

    it('lists and gets tags', () => {
      const tags = TestBed.inject(TagsApi);
      void firstValueFrom(tags.list({ device_id: 3, category: 'energy' }));
      expectGet('/api/v1/tags', 'device_id=3&category=energy').flush(page([]));
      void firstValueFrom(tags.get(9));
      expectGet('/api/v1/tags/9').flush(single({}));
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
});
