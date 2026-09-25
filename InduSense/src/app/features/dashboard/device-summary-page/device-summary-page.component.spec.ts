import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { APP_CONFIG, AppConfig } from '../../../core/config/app-config';
import { environment } from '../../../../environments/environment.development';
import { DASHBOARD_DATA_SOURCE } from '../data/dashboard-data-source';
import { DevScenarioService } from '../data/dev-scenario.service';
import { ControlledDataSource, fleetPageFixture, snapshotFixture } from '../data/testing';
import { fakeUser, provideFakeAuth } from '../../../core/auth/testing';
import { DeviceSummaryPageComponent } from './device-summary-page.component';

describe('DeviceSummaryPageComponent', () => {
  let source: ControlledDataSource;

  beforeEach(() => {
    // Real charts render in jsdom, which has no layout: silence ECharts' size warnings.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  async function setup(
    url = '/dashboard',
    config: Partial<AppConfig> = {},
    permissions?: string[],
  ) {
    source = new ControlledDataSource();
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(fakeUser(permissions ? { permissions } : {})),
        provideRouter(
          [{ path: 'dashboard', component: DeviceSummaryPageComponent }],
          withComponentInputBinding(),
        ),
        { provide: DASHBOARD_DATA_SOURCE, useValue: source },
        { provide: APP_CONFIG, useValue: { ...environment, ...config } },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    const el = harness.routeNativeElement!;
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();
    };
    await settle(); // lets the store's first (zero-delay) poll start
    return { harness, el, settle };
  }

  it('shows skeletons, then all 7 widgets once data arrives', async () => {
    const { el, settle } = await setup();
    expect(el.querySelectorAll('app-widget-card[aria-busy="true"]')).toHaveLength(7);
    expect(el.querySelector('.toolbar__updated')?.textContent).toBe('Not updated yet');

    source.respond(snapshotFixture());
    await settle();

    expect(Array.from(el.querySelectorAll('.kpi__value')).map((e) => e.textContent)).toEqual([
      '12',
      '4',
    ]);
    expect(el.querySelectorAll('.echart')).toHaveLength(4);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(el.querySelector('.gauge__value')?.textContent).toBe('41.6');
    expect(el.querySelector('.toolbar__updated')?.textContent).toBe('Updated just now');
  });

  it('refreshes from the toolbar and spins while loading', async () => {
    const { el, settle } = await setup();
    source.respond(snapshotFixture());
    await settle();

    el.querySelector<HTMLButtonElement>('.refresh')!.click();
    await settle();
    expect(source.loads).toHaveLength(2);
    expect(el.querySelector('.refresh')?.classList).toContain('refresh--spinning');
  });

  it('pages the table through the store', async () => {
    const { el, settle } = await setup();
    source.respond(snapshotFixture());
    await settle();

    Array.from(el.querySelectorAll<HTMLButtonElement>('.fleet__pager button'))[1].click();
    await settle();
    expect(source.pageRequests[0].page).toBe(2);
    source.pageRequests[0].response.next(fleetPageFixture(2));
    await settle();
    expect(el.querySelector('.fleet__page')?.textContent).toBe('2 of 3');
  });

  it('applies ?scenario= in development and shows the scenario links', async () => {
    const { el } = await setup('/dashboard?scenario=error');
    expect(TestBed.inject(DevScenarioService).current()).toBe('error');
    const links = Array.from(el.querySelectorAll('.dev-scenarios a'));
    expect(links.map((a) => a.textContent)).toEqual([
      'normal',
      'loading',
      'empty',
      'error',
      'partial',
      'flaky',
    ]);
    expect(el.querySelector('.dev-scenarios__link--active')?.textContent).toBe('error');
    TestBed.inject(DevScenarioService).current.set('normal');
  });

  it('ignores ?scenario= in production and hides the scenario links', async () => {
    const { el } = await setup('/dashboard?scenario=error', { production: true });
    expect(TestBed.inject(DevScenarioService).current()).toBe('normal');
    expect(el.querySelector('.dev-scenarios')).toBeNull();
  });

  it('shows "No access" cards for widgets the user may not see', async () => {
    const { el, settle } = await setup('/dashboard', {}, ['machines:view']);
    source.respond(snapshotFixture());
    await settle();
    const denied = Array.from(el.querySelectorAll('app-no-access-card h2')).map((h) => h.textContent);
    expect(denied).toEqual([
      'Devices',
      'Device Types',
      'Device Count by type',
      'Device By Connection status',
      'Devices by Connection type and Status',
      'watts',
    ]);
    expect(el.querySelector('app-machine-fleet-table')).not.toBeNull();
    expect(el.querySelectorAll('app-no-access-card .state__title')[0]?.textContent).toBe('No access');
  });
});
