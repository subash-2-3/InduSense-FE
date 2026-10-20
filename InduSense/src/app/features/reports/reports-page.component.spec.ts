import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ALL_PERMISSIONS, fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { ReportsPageComponent } from './reports-page.component';

const list = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});
const report = { success: true, data: { summary: {}, rows: [] }, pagination: null, metadata: {} };

describe('ReportsPageComponent filters', () => {
  let http: HttpTestingController;

  afterEach(() => http.verify());

  it('sends the business unit and plant with every report', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeAuth(fakeUser({ permissions: [...ALL_PERMISSIONS] })),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReportsPageComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/business-units').flush(list([]));
    http.expectOne((r) => r.url === '/api/v1/plants').flush(list([]));
    const first = http.expectOne((r) => r.url === '/api/v1/reports/energy');
    expect(first.request.params.has('business_unit_id')).toBe(false);
    first.flush(report);

    const page = fixture.componentInstance;
    page.setUnit(3);
    const byUnit = http.expectOne((r) => r.url === '/api/v1/reports/energy');
    expect(byUnit.request.params.get('business_unit_id')).toBe('3');
    byUnit.flush(report);

    page.setPlant(10);
    page.setTab('device-health');
    http.expectOne((r) => r.url === '/api/v1/reports/energy').flush(report);
    const health = http.expectOne((r) => r.url === '/api/v1/reports/device-health');
    expect(health.request.params.get('business_unit_id')).toBe('3');
    expect(health.request.params.get('plant_id')).toBe('10');
    health.flush({ ...report, data: { summary: {}, rows: [] } });
  });
});
