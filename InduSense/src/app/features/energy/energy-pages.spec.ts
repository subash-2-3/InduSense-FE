import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideFakeAuth } from '../../core/auth/testing';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { EnergyDashboardPageComponent } from './energy-dashboard-page.component';
import { EnergyReportsPageComponent } from './energy-reports-page.component';

const ok = <T>(data: T) => ({ success: true, data });
const list = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});
const META = {
  from: '2026-09-27T00:00:00Z',
  to: '2026-09-27T12:00:00Z',
  timezone: 'UTC',
  interval_seconds: 60,
  generated_at: '2026-09-27T12:00:00Z',
  notes: [],
};
const REF = {
  asset_type: 'meter',
  asset_id: 5,
  code: 'DELTA-PLC-EM',
  name: 'Delta PLC Energy Meter',
  plant_id: 1,
  plant_name: 'PN-1',
  area_id: null,
  area_name: null,
};
const PARAM = (
  tag_id: number,
  metric: string,
  name: string,
  unit: string | null,
  value: number,
) => ({
  tag_id,
  metric,
  name,
  unit,
  value,
  ts: '2026-09-27T12:00:00Z',
  quality: 'GOOD',
  device_id: 9,
  device_name: 'Delta PLC',
  connection_state: 'ONLINE',
});
const KPIS = {
  total_energy: null,
  average_power: { value: 0.13, unit: 'kW', ts: null },
  peak_power: { value: 0.14, unit: 'kW', ts: null },
  minimum_power: { value: 0.12, unit: 'kW', ts: null },
  average_power_factor: { value: 1, unit: null, ts: null },
  average_voltage: { value: 249.4, unit: 'V', ts: null },
  average_current: { value: 0.047, unit: 'A', ts: null },
  meters: 1,
  machines: 0,
  active_meters: 1,
  offline_meters: 0,
};

function flushFilterLists(http: HttpTestingController): void {
  http.expectOne((r) => r.url === '/api/v1/plants').flush(list([]));
  http.expectOne((r) => r.url === '/api/v1/meters').flush(list([]));
}

describe('EnergyDashboardPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...provideFakeAuth(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function setup() {
    const fixture = TestBed.createComponent(EnergyDashboardPageComponent);
    fixture.detectChanges();
    flushFilterLists(http);
    await new Promise((resolve) => setTimeout(resolve)); // timer(0) of the polling streams
    http
      .expectOne((r) => r.url === '/api/v1/dashboards/energy/live')
      .flush(
        ok({
          assets: [
            {
              ...REF,
              status: 'ONLINE',
              last_data_at: '2026-09-27T12:00:00Z',
              parameters: [
                PARAM(11, 'POWER', 'Active power', 'kW', 0.14),
                PARAM(12, 'VOLTAGE', 'Voltage', 'V', 249.2),
              ],
            },
          ],
          generated_at: '2026-09-27T12:00:00Z',
          notes: [],
        }),
      );
    const overview = http.expectOne((r) => r.url === '/api/v1/dashboards/energy/overview');
    expect(overview.request.params.has('from')).toBe(false); // "Today" is decided by the server
    overview.flush(
      ok({
        summary: KPIS,
        meters: [{ ...REF, status: 'ONLINE', last_data_at: null, latest_power: KPIS.peak_power }],
        metadata: META,
      }),
    );
    http
      .expectOne((r) => r.url === '/api/v1/dashboards/energy/trends')
      .flush(
        ok({
          groups: [
            {
              unit: 'kW',
              kind: 'instant',
              series: [
                {
                  tag_id: 11,
                  metric: 'POWER',
                  name: 'Active power',
                  unit: 'kW',
                  asset_name: 'M',
                  points: [],
                },
              ],
            },
          ],
          available_tags: [
            PARAM(11, 'POWER', 'Active power', 'kW', 0.14),
            PARAM(12, 'VOLTAGE', 'Voltage', 'V', 249.2),
          ],
          metadata: META,
        }),
      );
    http
      .expectOne((r) => r.url === '/api/v1/dashboards/energy/distribution')
      .flush(
        ok({
          group_by: 'meter',
          total: { total: null, unit: null, by_unit: {} },
          items: [],
          metadata: { ...META, notes: ['no ENERGY tag'] },
        }),
      );
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows live parameters named by their tags, KPIs and the meter table', async () => {
    const { el, fixture } = await setup();
    const params = [...el.querySelectorAll('.param')].map((p) =>
      [p.querySelector('dt'), p.querySelector('dd')].map((n) => n?.textContent?.trim()).join(' '),
    );
    expect(params).toEqual(['Active power 0.14 kW', 'Voltage 249.2 V']);
    expect(el.querySelector('.kpi__value')?.textContent?.trim()).toBe('—'); // no ENERGY tag mapped
    expect(el.textContent).toContain('249.4 V');
    expect(el.querySelector('.table tbody')?.textContent).toContain('DELTA-PLC-EM');
    expect(el.textContent).toContain('no ENERGY tag');
    fixture.destroy();
  });

  it('asks only for the chosen trend tags', async () => {
    const { el, fixture } = await setup();
    const boxes = el.querySelectorAll<HTMLInputElement>('.picker__item input');
    expect(boxes).toHaveLength(2);
    boxes[1].click(); // hide Voltage
    const req: TestRequest = http.expectOne((r) => r.url === '/api/v1/dashboards/energy/trends');
    expect(req.request.params.getAll('tag_id')).toEqual(['11']);
    req.flush(ok({ groups: [], available_tags: [], metadata: META }));
    fixture.destroy();
  });
});

describe('EnergyReportsPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...provideFakeAuth(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function setup() {
    const fixture = TestBed.createComponent(EnergyReportsPageComponent);
    fixture.detectChanges();
    flushFilterLists(http);
    const summary = http.expectOne((r) => r.url === '/api/v1/reports/energy/summary');
    expect(summary.request.params.has('from')).toBe(true); // last 7 days, explicit
    summary.flush(
      ok({
        summary: { ...KPIS, total_energy: { total: 25, unit: 'kWh', by_unit: { kWh: 25 } } },
        by_plant: [
          {
            key: 'plant:1',
            id: 1,
            name: 'PN-1',
            energy: { total: 25, unit: 'kWh', by_unit: { kWh: 25 } },
            average_power: null,
            peak_power: null,
          },
        ],
        by_area: [],
        by_machine: [],
        by_meter: [],
        metadata: META,
      }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the summary and pages the cumulative report', async () => {
    const { el, fixture } = await setup();
    expect(el.querySelector('.kpi__value')?.textContent?.trim()).toBe('25 kWh');
    const tabs = el.querySelectorAll<HTMLButtonElement>('.tab');
    tabs[1].click();
    const req = http.expectOne((r) => r.url === '/api/v1/reports/energy/cumulative');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('page_size')).toBe('25');
    req.flush({
      success: true,
      data: {
        rows: [
          {
            ...REF,
            tag_id: 13,
            unit: 'kWh',
            start_reading: 480,
            end_reading: 30,
            consumed: 70,
            reset_detected: true,
            average_power: null,
            peak_power: null,
            period_from: META.from,
            period_to: META.to,
          },
        ],
        metadata: META,
      },
      pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.badge--warn')?.textContent?.trim()).toBe('Meter reset');
    expect(el.querySelector('tbody')?.textContent).toContain('70 kWh');
  });

  it('exports the current report as a file', async () => {
    const { el, fixture } = await setup();
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const excel = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Excel'),
    )!;
    excel.click();
    const req = http.expectOne((r) => r.url === '/api/v1/reports/energy/export');
    expect(req.request.params.get('report')).toBe('summary');
    expect(req.request.params.get('format')).toBe('xlsx');
    req.flush(new Blob(['x']), {
      headers: { 'Content-Disposition': 'attachment; filename="energy-summary.xlsx"' },
    });
    await fixture.whenStable();
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith('Export downloaded');
  });
});
