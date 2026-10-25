import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../core/connectivity/connectivity.service';
import { MeterWidgetComponent } from './meter-widget.component';

const NOW = new Date('2026-10-25T10:00:00Z');
const kpi = (
  value: number | null,
  unit: string | null,
  ts: string | null = '2026-10-25T09:59:00Z',
) => ({
  value,
  unit,
  ts,
});

function dashboard(id: number, summary: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      meter: { id, meter_code: `EM${id}`, name: `Meter ${id}`, meter_type: null, unit: null },
      plant: { id: 1, name: 'Chennai' },
      area: null,
      device: {
        id: 5,
        external_id: 'X',
        name: null,
        gateway_id: null,
        connection_state: 'ONLINE',
        last_seen_at: null,
      },
      last_data_at: '2026-10-25T09:59:00Z',
      available_metrics: [],
      summary: {
        current_power: kpi(41.5, 'kW'),
        energy: kpi(1210.4, 'kWh', null),
        peak_power: null,
        voltage: kpi(231.2, 'V', '2026-10-25T09:40:00Z'), // 20 minutes old: stale
        current: kpi(58.31, 'A'),
        frequency: null,
        power_factor: kpi(0.962, null),
        ...summary,
      },
      charts: {},
      tables: {},
      metadata: {},
    },
  };
}

const empty = (id: number) =>
  dashboard(id, {
    current_power: null,
    energy: null,
    voltage: null,
    current: null,
    power_factor: null,
  });

@Component({
  imports: [MeterWidgetComponent],
  template: `
    @for (id of ids; track id) {
      <app-meter-widget
        [meterId]="id"
        [range]="range()"
        [refreshSeconds]="30"
        (resetRange)="resets = resets + 1"
      />
    }
  `,
})
class HostComponent {
  ids = [1];
  range = signal({ from: '2026-10-25T06:00:00Z', to: '2026-10-25T14:00:00Z' });
  resets = 0;
}

describe('MeterWidgetComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function setup(ids = [1]) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.ids = ids;
    const render = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    await render();
    const widgets = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-meter-widget'));
    const request = (id: number) =>
      http.expectOne((r) => r.url === `/api/v1/dashboards/meters/${id}`);
    return { fixture, render, widgets, request };
  }

  it('shows a skeleton, then the live readings with their state', async () => {
    const { render, widgets, request } = await setup();
    expect(widgets()[0].querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(widgets()[0].querySelectorAll('app-skeleton').length).toBeGreaterThan(5);

    const req = request(1);
    expect(req.request.params.get('from')).toBe('2026-10-25T06:00:00Z');
    req.flush(dashboard(1));
    await render();

    const card = widgets()[0];
    expect(card.textContent).toContain('Meter 1');
    expect(card.querySelector('app-status-pill')?.textContent?.trim()).toBe('Online');
    const readings = Array.from(card.querySelectorAll('.reading')).map((r) => [
      r.querySelector('.reading__label')?.textContent?.trim(),
      r.querySelector('.reading__value')?.textContent?.replace(/\s+/g, ' ').trim(),
      r.className.replace('reading reading--', ''),
    ]);
    expect(readings).toEqual([
      ['Voltage', '231.2 V', 'stale'],
      ['Current', '58.31 A', 'live'],
      ['Power', '41.5 kW', 'live'],
      ['Power factor', '0.962', 'live'],
      ['Energy', '1,210.4 kWh', 'live'],
    ]);
  });

  it('offers "Reset range" when the range has no data', async () => {
    const { fixture, render, widgets, request } = await setup();
    request(1).flush(empty(1));
    await render();
    expect(widgets()[0].textContent).toContain('No readings in this range');
    (widgets()[0].querySelector('button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.resets).toBe(1);
  });

  it('shows its own error with Retry, without affecting the other widgets', async () => {
    const { render, widgets, request } = await setup([1, 2]);
    request(1).flush(
      { success: false, code: 'METER_NOT_FOUND', message: 'Meter not found' },
      { status: 404, statusText: 'Not Found' },
    );
    request(2).flush(dashboard(2));
    await render();

    expect(widgets()[0].querySelector('app-error-state')?.textContent).toContain('Meter not found');
    expect(widgets()[1].textContent).toContain('Meter 2');
    expect(widgets()[1].querySelectorAll('.reading').length).toBe(5);

    (widgets()[0].querySelector('app-error-state button') as HTMLButtonElement).click();
    request(1).flush(dashboard(1));
    await render();
    expect(widgets()[0].querySelectorAll('.reading').length).toBe(5);
  });

  it('keeps the last readings, marked out of date, when a refresh fails', async () => {
    const { render, widgets, request } = await setup();
    request(1).flush(dashboard(1));
    await render();

    vi.advanceTimersByTime(30_000);
    request(1).flush(
      { success: false, code: 'SERVICE_UNAVAILABLE', message: 'down' },
      { status: 503, statusText: 'Unavailable' },
    );
    await render();
    const card = widgets()[0];
    expect(card.querySelectorAll('.reading').length).toBe(5);
    expect(card.querySelector('.footer--stale')?.textContent).toContain('Not updated');
  });

  it('skips refreshes while the server is down and reloads when it is back', async () => {
    const { render, request } = await setup();
    request(1).flush(dashboard(1));
    await render();

    const connectivity = TestBed.inject(ConnectivityService);
    connectivity.reportServerFailure(0);
    vi.advanceTimersByTime(30_000);
    http.expectNone((r) => r.url === '/api/v1/dashboards/meters/1');

    connectivity.reportServerOk();
    request(1).flush(dashboard(1));
  });

  it('reloads from scratch when the range changes', async () => {
    const { fixture, render, widgets, request } = await setup();
    request(1).flush(dashboard(1));
    await render();
    fixture.componentInstance.range.set({
      from: '2026-10-24T22:00:00Z',
      to: '2026-10-25T06:00:00Z',
    });
    await render();
    expect(widgets()[0].querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(request(1).request.params.get('from')).toBe('2026-10-24T22:00:00Z');
  });
});
