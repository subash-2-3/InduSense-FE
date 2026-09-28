import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { environment } from '../../../environments/environment';
import { ApiError } from './api-error';
import { ApiService, TOO_MANY_PAGES, queryOf, toHttpParams } from './api.service';

const page = <T>(data: T[], pageNumber: number, total: number, pageSize: number) => ({
  success: true,
  data,
  pagination: {
    page: pageNumber,
    page_size: pageSize,
    total,
    total_pages: Math.ceil(total / pageSize),
  },
});

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { ...environment, apiBaseUrl: '/api/v1/' } },
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('builds URLs from the configured base without doubled slashes', () => {
    expect(api.url('/devices/3')).toBe('/api/v1/devices/3');
    expect(api.url('devices')).toBe('/api/v1/devices');
  });

  it('unwraps data from a single-object response', async () => {
    const result = firstValueFrom(api.get<{ id: number }>('/devices/3'));
    const req = http.expectOne('/api/v1/devices/3');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { id: 3 } });
    expect(await result).toEqual({ id: 3 });
  });

  it('unwraps a page and sends query parameters', async () => {
    const result = firstValueFrom(
      api.getPage<number>('/devices', {
        page: 2,
        page_size: 10,
        search: 'press',
        status: 'active',
      }),
    );
    const req = http.expectOne((r) => r.url === '/api/v1/devices');
    expect(req.request.params.toString()).toBe('page=2&page_size=10&search=press&status=active');
    req.flush(page([11, 12], 2, 12, 10));
    expect(await result).toEqual({
      items: [11, 12],
      pagination: { page: 2, page_size: 10, total: 12, total_pages: 2 },
    });
  });

  it('turns HTTP failures into ApiError', async () => {
    const result = firstValueFrom(api.get('/devices/99'));
    http
      .expectOne('/api/v1/devices/99')
      .flush(
        { success: false, code: 'DEVICE_NOT_FOUND', message: 'Device not found' },
        { status: 404, statusText: 'Not Found' },
      );
    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('DEVICE_NOT_FOUND');
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    const result = firstValueFrom(api.getPage('/devices'));
    http.expectOne('/api/v1/devices').error(new ProgressEvent('error'), { status: 0 });
    expect(((await result.catch((e: unknown) => e)) as ApiError).code).toBe('NETWORK_ERROR');
  });

  describe('getAllPages', () => {
    it('returns a single page without further requests', async () => {
      const result = lastValueFrom(api.getAllPages<number>('/devices', { search: 'x' }));
      const req = http.expectOne((r) => r.url === '/api/v1/devices');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('page_size')).toBe('100');
      expect(req.request.params.get('search')).toBe('x');
      req.flush(page([1, 2], 1, 2, 100));
      expect(await result).toEqual([1, 2]);
    });

    it('fetches the remaining pages and keeps server order', async () => {
      const result = lastValueFrom(api.getAllPages<number>('/devices', {}, { pageSize: 2 }));
      http.expectOne((r) => r.params.get('page') === '1').flush(page([1, 2], 1, 7, 2));

      const rest = http.match((r) => r.url === '/api/v1/devices');
      expect(rest.map((r) => r.request.params.get('page'))).toEqual(['2', '3', '4']);
      // Respond out of order.
      rest[2].flush(page([7], 4, 7, 2));
      rest[0].flush(page([3, 4], 2, 7, 2));
      rest[1].flush(page([5, 6], 3, 7, 2));
      expect(await result).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('limits concurrency', () => {
      void lastValueFrom(api.getAllPages<number>('/devices', {}, { pageSize: 1, concurrency: 2 }));
      http.expectOne((r) => r.params.get('page') === '1').flush(page([1], 1, 5, 1));
      const inFlight = http.match((r) => r.url === '/api/v1/devices');
      expect(inFlight).toHaveLength(2);
      inFlight.forEach((r, i) => r.flush(page([i + 2], i + 2, 5, 1)));
      const next = http.match((r) => r.url === '/api/v1/devices');
      expect(next).toHaveLength(2);
      next.forEach((r, i) => r.flush(page([i + 4], i + 4, 5, 1)));
    });

    it('never exceeds the server maximum page size', () => {
      void lastValueFrom(api.getAllPages('/devices', {}, { pageSize: 500 }));
      const req = http.expectOne((r) => r.url === '/api/v1/devices');
      expect(req.request.params.get('page_size')).toBe('100');
      req.flush(page([], 1, 0, 100));
    });

    it('refuses lists above the page cap instead of truncating', async () => {
      const result = lastValueFrom(api.getAllPages('/devices', {}, { maxPages: 3 }));
      http.expectOne((r) => r.url === '/api/v1/devices').flush(page([1], 1, 401, 100));
      const error = (await result.catch((e: unknown) => e)) as ApiError;
      expect(error.code).toBe(TOO_MANY_PAGES);
      expect(error.message).toContain('401');
    });

    it('fails when any page fails', async () => {
      const result = lastValueFrom(api.getAllPages('/devices', {}, { pageSize: 1 }));
      http.expectOne((r) => r.params.get('page') === '1').flush(page([1], 1, 2, 1));
      http
        .expectOne((r) => r.params.get('page') === '2')
        .flush(
          { success: false, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
          { status: 500, statusText: 'Server Error' },
        );
      expect(((await result.catch((e: unknown) => e)) as ApiError).code).toBe('INTERNAL_ERROR');
    });
  });

  it('posts a body and unwraps the response, including 204 No Content', async () => {
    const created = firstValueFrom(api.post<{ id: number }>('/tags', { tag_name: 'watts' }));
    const req = http.expectOne('/api/v1/tags');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tag_name: 'watts' });
    req.flush({ success: true, data: { id: 5 } });
    expect(await created).toEqual({ id: 5 });

    const noContent = firstValueFrom(api.post<void>('/auth/logout'));
    http.expectOne('/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    expect(await noContent).toBeUndefined();
  });

  it('patches, puts and deletes resources', async () => {
    const patched = firstValueFrom(api.patch<{ id: number }>('/devices/1', { name: 'New' }));
    const patchReq = http.expectOne('/api/v1/devices/1');
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush({ success: true, data: { id: 1 } });
    expect(await patched).toEqual({ id: 1 });

    const putted = firstValueFrom(api.put<{ id: number }>('/machines/1/tag-mappings', {}));
    const putReq = http.expectOne('/api/v1/machines/1/tag-mappings');
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ success: true, data: { id: 1 } });
    expect(await putted).toEqual({ id: 1 });

    const deleted = firstValueFrom(api.delete<void>('/devices/1'));
    const delReq = http.expectOne('/api/v1/devices/1');
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush(null, { status: 204, statusText: 'No Content' });
    expect(await deleted).toBeUndefined();
  });

  it('gets raw envelopes without unwrapping', async () => {
    const raw = firstValueFrom(api.getRaw<{ success: boolean; data: string }>('/custom'));
    const req = http.expectOne('/api/v1/custom');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: 'custom-data' });
    expect(await raw).toEqual({ success: true, data: 'custom-data' });
  });
});

describe('toHttpParams', () => {
  it('omits empty values and repeats array keys', () => {
    const params = toHttpParams({
      device_id: 3,
      tag_id: [1, 2],
      search: undefined,
      quality: null,
      status: 'inactive',
    });
    expect(params.toString()).toBe('device_id=3&tag_id=1&tag_id=2&status=inactive');
  });

  it('converts typed filter objects', () => {
    interface Filters {
      plant_id?: number;
    }
    const filters: Filters = { plant_id: 4 };
    expect(toHttpParams(queryOf(filters)).toString()).toBe('plant_id=4');
  });
});
