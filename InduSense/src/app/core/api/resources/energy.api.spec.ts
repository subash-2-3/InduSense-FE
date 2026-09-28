import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../api-error';
import { filenameOf } from '../api.service';
import { EnergyApi } from './energy.api';

describe('EnergyApi', () => {
  let http: HttpTestingController;
  let api: EnergyApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(EnergyApi);
  });

  afterEach(() => http.verify());

  it('sends filters and repeats tag_id', async () => {
    const result = firstValueFrom(
      api.trends({ plant_id: 3, tag_id: [1, 2], from: '2026-09-01T00:00:00Z' }),
    );
    const req = http.expectOne((r) => r.url === '/api/v1/dashboards/energy/trends');
    expect(req.request.params.get('plant_id')).toBe('3');
    expect(req.request.params.getAll('tag_id')).toEqual(['1', '2']);
    expect(req.request.params.has('company_id')).toBe(false);
    req.flush({ success: true, data: { groups: [], available_tags: [], metadata: {} } });
    expect((await result).groups).toEqual([]);
  });

  it('downloads an export with its file name', async () => {
    const result = firstValueFrom(api.export({ report: 'details', format: 'csv' }));
    const req = http.expectOne((r) => r.url === '/api/v1/reports/energy/export');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('report')).toBe('details');
    req.flush(new Blob(['a,b']), {
      headers: {
        'Content-Disposition': 'attachment; filename="energy-details_20260901-20260902.csv"',
      },
    });
    const file = await result;
    expect(file.filename).toBe('energy-details_20260901-20260902.csv');
    expect(await file.blob.text()).toBe('a,b');
  });

  it('reads the JSON error of a failed export', async () => {
    const result = firstValueFrom(api.export({ report: 'details', format: 'xlsx' }));
    const body = { success: false, code: 'EXPORT_TOO_LARGE', message: 'Narrow the date range.' };
    http
      .expectOne((r) => r.url === '/api/v1/reports/energy/export')
      .flush(new Blob([JSON.stringify(body)], { type: 'application/json' }), {
        status: 422,
        statusText: 'Unprocessable Entity',
      });
    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('EXPORT_TOO_LARGE');
    expect((error as ApiError).message).toBe('Narrow the date range.');
  });

  it('parses Content-Disposition file names', () => {
    expect(filenameOf('attachment; filename="a b.xlsx"')).toBe('a b.xlsx');
    expect(filenameOf("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.csv")).toBe('résumé.csv');
    expect(filenameOf(null)).toBeNull();
  });
});
