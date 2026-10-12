import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideFakeAuth } from '../../core/auth/testing';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { MachineReportsPageComponent } from './machine-reports-page.component';

const ok = <T>(data: T) => ({ success: true, data });
const list = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});
const META = {
  from: '2026-09-27T00:00:00Z',
  to: '2026-09-28T00:00:00Z',
  timezone: 'UTC',
  interval_seconds: 300,
  generated_at: '2026-09-28T00:00:00Z',
  notes: [],
};
const TIMES = { run_seconds: 3600, idle_seconds: 1800, stop_seconds: 900, no_data_seconds: 0 };
const PRESS = {
  key: 'machine:1',
  id: 1,
  name: 'Press',
  code: 'PR-1',
  plant_name: 'Plant 1',
  area_name: 'Area A',
  machines: 1,
  production: { total: 1224, unit: 'pcs', by_unit: { pcs: 1224 } },
  ...TIMES,
  availability: 0.5538,
  availability_source: 'run_status',
  alarm_count: 2,
  alarm_seconds: 120,
};

describe('MachineReportsPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), ...provideFakeAuth()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function setup() {
    const fixture = TestBed.createComponent(MachineReportsPageComponent);
    fixture.detectChanges();
    // The filters list machines (not meters) on this page.
    http.expectOne((r) => r.url === '/api/v1/plants').flush(list([]));
    http.expectOne((r) => r.url === '/api/v1/machines').flush(list([]));
    const summary = http.expectOne((r) => r.url === '/api/v1/reports/machines/summary');
    expect(summary.request.params.has('from')).toBe(true); // last 7 days, explicit
    summary.flush(
      ok({
        summary: {
          machines: 1,
          machines_without_status: 0,
          machines_without_counter: 0,
          production: PRESS.production,
          ...TIMES,
          availability: 0.5538,
          alarm_count: 2,
          alarm_seconds: 120,
        },
        by_plant: [{ ...PRESS, key: 'plant:1', name: 'Plant 1', code: null }],
        by_area: [{ ...PRESS, key: 'area:1', name: 'Area A', code: null }],
        by_machine: [PRESS],
        metadata: META,
      }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows production, run / idle / stop time, availability and alarms', async () => {
    const { el } = await setup();
    const kpi = (label: string) =>
      [...el.querySelectorAll('.kpi')]
        .find((k) => k.querySelector('.kpi__label')?.textContent?.trim() === label)
        ?.querySelector('.kpi__value')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();
    expect(kpi('Production')).toBe('1,224 pcs');
    expect(kpi('Availability')).toBe('55.4 %');
    expect(kpi('Idle time')).toContain('30');
    expect(kpi('Alarms')).toContain('2');
    const machineTable = el.querySelectorAll('table')[0];
    expect(machineTable.textContent).toContain('Press');
    expect(machineTable.textContent).toContain('PR-1');
  });

  it('shows counter readings with a reset badge', async () => {
    const { el, fixture } = await setup();
    el.querySelectorAll<HTMLButtonElement>('.tab')[1].click();
    const req = http.expectOne((r) => r.url === '/api/v1/reports/machines/cumulative');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({
      success: true,
      data: {
        rows: [
          {
            machine_id: 1,
            code: 'PR-1',
            name: 'Press',
            plant_name: 'Plant 1',
            area_name: null,
            tag_id: 9,
            metric: 'PRODUCTION_COUNTER',
            parameter: 'production_count',
            unit: 'pcs',
            start_reading: 100,
            end_reading: 15,
            increase: 35,
            reset_detected: true,
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
    expect(el.querySelector('tbody')?.textContent).toContain('Production counter');
    expect(el.querySelector('.badge--warn')?.textContent?.trim()).toBe('Counter reset');
  });

  it('pages the detailed readings with cursors and shows the machine state', async () => {
    const { el, fixture } = await setup();
    el.querySelectorAll<HTMLButtonElement>('.tab')[2].click();
    const req = http.expectOne((r) => r.url === '/api/v1/reports/machines/details');
    expect(req.request.params.get('cursor')).toBe('');
    req.flush({
      success: true,
      data: {
        columns: [
          { key: 'c0', label: 'Machine Status', unit: null, header: 'Machine Status', metric: 'RUN_STATUS', roundoff_digits: null },
          { key: 'c1', label: 'Run Seconds', unit: 's', header: 'Run Seconds (s)', metric: 'RUN_SECONDS', roundoff_digits: null },
          { key: 'c2', label: 'Production Count', unit: 'count', header: 'Production Count (count)', metric: 'PRODUCTION_COUNTER', roundoff_digits: null },
        ],
        rows: [
          {
            ts: META.from,
            plant_name: 'Plant 1',
            area_name: null,
            machine_code: 'PR-1',
            machine_name: 'Press',
            device_name: 'Delta PLC',
            cells: {
              c0: { value: 1, text: 'IDLE (1)', quality: 'GOOD' },
              c1: { value: 1214, text: null, quality: 'GOOD' },
            },
          },
        ],
        metadata: META,
      },
      pagination: { page: null, page_size: 25, total: null, total_pages: null, next_cursor: 'c2', has_more: true },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const headers = [...el.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      'Time', 'Machine', 'Location', 'Device', 'Machine Status', 'Run Seconds (s)', 'Production Count (count)',
    ]);
    const cells = [...el.querySelectorAll('tbody td')].map((td) => td.textContent?.trim());
    expect(cells.slice(4)).toEqual(['IDLE (1)', '1,214', '']); // no production sample at this moment
    [...el.querySelectorAll<HTMLButtonElement>('.cursor-pager button')]
      .find((b) => b.textContent?.includes('Next'))!
      .click();
    expect(http.expectOne((r) => r.url === '/api/v1/reports/machines/details').request.params.get('cursor')).toBe(
      'c2',
    );
  });

  it('exports the current tab', async () => {
    const { el } = await setup();
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('CSV'))!.click();
    const req = http.expectOne((r) => r.url === '/api/v1/reports/machines/export');
    expect(req.request.params.get('report')).toBe('summary');
    expect(req.request.params.get('format')).toBe('csv');
    req.flush(new Blob(['x']), { headers: { 'Content-Disposition': 'attachment; filename="machine-summary.csv"' } });
    expect(success).toHaveBeenCalledWith('Export downloaded');
  });
});
