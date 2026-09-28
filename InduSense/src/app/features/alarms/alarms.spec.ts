import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { errorToastInterceptor } from '../../core/api/error-toast.interceptor';
import { ALL_PERMISSIONS, fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { AlarmDefinition, AlarmTag } from '../../core/models';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatDuration } from '../../shared/utils/format';
import { ActiveAlarmCountService } from './active-alarm-count.service';
import { ActiveAlarmsComponent } from './active-alarms.component';
import { AlarmHistoryComponent } from './alarm-history.component';
import { AlarmSetupComponent, isSet, itemsFrom, rowsFrom } from './alarm-setup.component';

const ok = <T>(data: T) => ({ success: true, data });
const NOW = new Date().toISOString();
const MACHINE = {
  machine_id: 3,
  machine_code: 'DELTA-PLC-M1',
  machine_name: 'Delta PLC Machine',
  plant_id: 1,
  plant_name: 'PN-1',
  area_name: null,
};
const TAG: AlarmTag = {
  ...MACHINE,
  tag_id: 7,
  tag_name: 'alarm_status',
  display_name: 'Alarm Status',
  register_address: '40213',
  value: 1025,
  last_data_at: NOW,
  named_bits: 1,
};
const DEF: AlarmDefinition = {
  id: 1,
  tag_id: 7,
  bit: 0,
  name: 'Emergency stop',
  message: 'Release the e-stop',
  status: 'active',
  updated_at: NOW,
};

function setup(permissions: string[] = [...ALL_PERMISSIONS]) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorToastInterceptor])),
      provideHttpClientTesting(),
      ...provideFakeAuth(fakeUser({ permissions })),
    ],
  });
  return TestBed.inject(HttpTestingController);
}

describe('alarm helpers', () => {
  it('reads bits of the alarm word', () => {
    expect(isSet(1025, 0)).toBe(true);
    expect(isSet(1025, 10)).toBe(true);
    expect(isSet(1025, 1)).toBe(false);
    expect(isSet(2 ** 31, 31)).toBe(true);
    expect(isSet(null, 0)).toBe(false);
  });

  it('builds 32 rows and sends only named bits', () => {
    const rows = rowsFrom([
      DEF,
      { ...DEF, id: 2, bit: 5, name: 'Spare', status: 'inactive', message: null },
    ]);
    expect(rows).toHaveLength(32);
    expect(rows[0]).toEqual({
      bit: 0,
      name: 'Emergency stop',
      message: 'Release the e-stop',
      active: true,
    });
    expect(rows[5].active).toBe(false);
    rows[10].name = ' Door open ';
    expect(itemsFrom(rows)).toEqual([
      { bit: 0, name: 'Emergency stop', message: 'Release the e-stop', status: 'active' },
      { bit: 5, name: 'Spare', message: null, status: 'inactive' },
      { bit: 10, name: 'Door open', message: null, status: 'active' },
    ]);
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(725)).toBe('12m 05s');
    expect(formatDuration(11_220)).toBe('3h 07m');
    expect(formatDuration(187_200)).toBe('2d 04h');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('ActiveAlarmsComponent', () => {
  it('lists active alarms and reports the count to the sidebar', async () => {
    const http = setup();
    const fixture = TestBed.createComponent(ActiveAlarmsComponent);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r)); // timer(0) of the polling stream
    http
      .expectOne((r) => r.url === '/api/v1/alarms/active')
      .flush(
        ok({
          alarms: [
            {
              ...MACHINE,
              tag_id: 7,
              bit: 10,
              name: 'Alarm bit 10',
              message: null,
              named: false,
              since: NOW,
              since_is_estimate: false,
              duration_seconds: 5,
              stale: false,
              last_data_at: NOW,
            },
            {
              ...MACHINE,
              tag_id: 7,
              bit: 0,
              name: 'Emergency stop',
              message: 'Release the e-stop',
              named: true,
              since: NOW,
              since_is_estimate: true,
              duration_seconds: 900,
              stale: true,
              last_data_at: NOW,
            },
          ],
          machines_in_alarm: 1,
          alarm_tags: 1,
          generated_at: NOW,
          notes: [],
        }),
      );
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[1].querySelector('.alarm-name')?.textContent?.trim()).toBe('Emergency stop');
    expect(rows[1].textContent).toContain('Release the e-stop');
    expect(rows[1].textContent).toContain('at least since '); // since_is_estimate
    expect(rows[1].textContent).toContain('last known');
    expect(TestBed.inject(ActiveAlarmCountService).count()).toBe(2);
    fixture.destroy();
    http.verify();
  });
});

describe('AlarmHistoryComponent', () => {
  it('loads the last 7 days, filters by bit and exports', async () => {
    const http = setup();
    const fixture = TestBed.createComponent(AlarmHistoryComponent);
    fixture.detectChanges();
    const first = http.expectOne((r) => r.url === '/api/v1/alarms/history');
    expect(first.request.params.has('from')).toBe(true);
    expect(first.request.params.get('page')).toBe('1');
    first.flush({
      success: true,
      data: {
        rows: [
          {
            ...MACHINE,
            tag_id: 7,
            bit: 0,
            name: 'Emergency stop',
            message: null,
            start: NOW,
            end: null,
            ongoing: true,
            started_before_range: false,
            duration_seconds: 125,
          },
        ],
        metadata: {
          from: NOW,
          to: NOW,
          timezone: 'UTC',
          interval_seconds: null,
          generated_at: NOW,
          notes: [],
        },
      },
      pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('tbody')?.textContent).toContain('still active');
    expect(el.querySelector('tbody')?.textContent).toContain('2m 05s');

    const bit = el.querySelectorAll<HTMLSelectElement>('select')[1];
    bit.value = bit.options[1].value; // bit 0
    bit.dispatchEvent(new Event('change'));
    const filtered = http.expectOne((r) => r.url === '/api/v1/alarms/history');
    expect(filtered.request.params.get('bit')).toBe('0');
    filtered.flush({
      success: true,
      data: { rows: [], metadata: { notes: [] } },
      pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 },
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    const excel = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Excel'),
    )!;
    excel.click();
    const exp = http.expectOne((r) => r.url === '/api/v1/alarms/history/export');
    expect(exp.request.params.get('format')).toBe('xlsx');
    expect(exp.request.params.get('bit')).toBe('0');
    exp.flush(new Blob(['x']), {
      headers: { 'Content-Disposition': 'attachment; filename="alarm-history.xlsx"' },
    });
    expect(success).toHaveBeenCalledWith('Export downloaded');
    http.verify();
  });
});

describe('AlarmSetupComponent', () => {
  function render(canManage: boolean, http: HttpTestingController) {
    const fixture = TestBed.createComponent(AlarmSetupComponent);
    fixture.componentRef.setInput('tags', [TAG]);
    fixture.componentRef.setInput('canManage', canManage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/alarms/tags/7/definitions').flush(ok([DEF]));
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows 32 bits with the live state and saves names', async () => {
    const http = setup();
    const { fixture, el } = render(true, http);
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = el.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(32);
    expect(rows[0].querySelector('.pill--on')).not.toBeNull(); // 1025: bits 0 and 10
    expect(rows[10].querySelector('.pill--on')).not.toBeNull();
    expect(rows[1].querySelector('.pill--on')).toBeNull();
    const name10 = el.querySelector<HTMLInputElement>('input[aria-label="Name of bit 10"]')!;
    name10.value = 'Door open';
    name10.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Save names'))!
      .click();
    const req = http.expectOne(
      (r) => r.method === 'PUT' && r.url === '/api/v1/alarms/tags/7/definitions',
    );
    expect(req.request.body.definitions).toEqual([
      { bit: 0, name: 'Emergency stop', message: 'Release the e-stop', status: 'active' },
      { bit: 10, name: 'Door open', message: null, status: 'active' },
    ]);
    req.flush(ok([DEF, { ...DEF, id: 2, bit: 10, name: 'Door open', message: null }]));
    expect(saved).toHaveBeenCalled();
    http.verify();
  });

  it('is read-only without alarms:manage', () => {
    const http = setup();
    const { el } = render(false, http);
    expect(el.querySelector<HTMLInputElement>('input[aria-label="Name of bit 0"]')!.readOnly).toBe(
      true,
    );
    expect(
      [...el.querySelectorAll('button')].some((b) => b.textContent?.includes('Save names')),
    ).toBe(false);
    http.verify();
  });
});
