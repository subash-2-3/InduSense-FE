import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ALL_PERMISSIONS, fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { MachinesOverview } from '../../core/models';
import { MachinesSectionComponent, stateChips } from './machines-section.component';

const NOW = new Date().toISOString();
const META = {
  from: NOW,
  to: NOW,
  timezone: 'UTC',
  interval_seconds: 60,
  generated_at: NOW,
  notes: [],
};
const OVERVIEW: MachinesOverview = {
  summary: {
    machines: 2,
    by_state: { ALARM: 1, RUNNING: 1 },
    running: 1,
    in_alarm: 1,
    production: { total: 70, unit: 'count', by_unit: { count: 70 } },
    availability: 0.6,
    active_alarms: 2,
  },
  machines: [
    {
      machine_id: 3,
      machine_code: 'DELTA-PLC-M1',
      machine_name: 'Delta PLC Machine',
      plant_id: 1,
      plant_name: 'PN-1',
      area_name: null,
      state: { status: 'ALARM', source: 'telemetry', last_data_at: NOW },
      production: { value: 70, unit: 'count' },
      counter: { value: 1234, unit: 'count', ts: NOW },
      run_seconds: 900,
      stop_seconds: 600,
      availability: 0.6,
      active_alarms: 2,
      alarm_names: ['Emergency stop', 'Alarm bit 10'],
      has_controls: true,
    },
    {
      machine_id: 4,
      machine_code: 'M2',
      machine_name: 'Press 2',
      plant_id: 1,
      plant_name: 'PN-1',
      area_name: 'Line A',
      state: { status: 'RUNNING', source: 'telemetry', last_data_at: NOW },
      production: null,
      counter: null,
      run_seconds: null,
      stop_seconds: null,
      availability: null,
      active_alarms: 0,
      alarm_names: [],
      has_controls: false,
    },
  ],
  metadata: META,
};

function setup(permissions: string[] = [...ALL_PERMISSIONS]) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      ...provideFakeAuth(fakeUser({ permissions })),
    ],
  });
  return TestBed.inject(HttpTestingController);
}

async function render(http: HttpTestingController) {
  const fixture = TestBed.createComponent(MachinesSectionComponent);
  fixture.componentRef.setInput('filters', {
    scope: { plant_id: 1, meter_id: 9 },
    preset: 'today',
    custom: {},
  });
  fixture.detectChanges();
  await new Promise((r) => setTimeout(r)); // timer(0)
  const req = http.expectOne((r) => r.url === '/api/v1/dashboards/machines');
  expect(req.request.params.get('plant_id')).toBe('1');
  expect(req.request.params.has('meter_id')).toBe(false); // machines ignore the meter filter
  expect(req.request.params.has('from')).toBe(false); // "today" is decided by the server
  req.flush({ success: true, data: OVERVIEW });
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('MachinesSectionComponent', () => {
  it('orders state chips', () => {
    expect(stateChips({ ALARM: 1, RUNNING: 2, ZED: 1, IDLE: 3 }).map((c) => c.state)).toEqual([
      'RUNNING',
      'IDLE',
      'ALARM',
      'ZED',
    ]);
  });

  it('shows machine status, production count, availability and alarms', async () => {
    const http = setup();
    const { fixture, el } = await render(http);
    const kpis = [...el.querySelectorAll('.kpi__value')].map((k) =>
      k.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(kpis[0]).toBe('1 / 2');
    expect(kpis[1]).toBe('70 count');
    expect(kpis[2]).toBe('60.0%');
    expect(kpis[3]).toContain('2');
    const cards = el.querySelectorAll('.machine');
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('data-state')).toBe('ALARM');
    expect(
      cards[0].querySelector('.figure--big dd')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('70 count');
    expect(cards[0].textContent).toContain('counter 1,234');
    expect(cards[0].textContent).toContain('15m 00s'); // run time
    expect(cards[0].querySelector('.alarms')?.textContent).toContain(
      'Emergency stop, Alarm bit 10',
    );
    expect(cards[0].querySelector('button')?.textContent?.trim()).toBe('Controls');
    expect(cards[1].querySelector('.alarms')).toBeNull();
    expect(cards[1].querySelector('button')).toBeNull(); // no writable tags
    fixture.destroy();
    http.verify();
  });

  it('hides controls without devices:control', async () => {
    const http = setup(['dashboards:view']);
    const { fixture, el } = await render(http);
    expect(el.querySelector('.machine button')).toBeNull();
    fixture.destroy();
    http.verify();
  });
});
