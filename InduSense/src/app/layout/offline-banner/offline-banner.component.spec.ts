import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Permission } from '../../core/auth/permissions';
import { fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { ConnectivityService } from '../../core/connectivity/connectivity.service';
import { OfflineBannerComponent, RESTORED_NOTICE_MS } from './offline-banner.component';

const page = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});

describe('OfflineBannerComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function setup(permissions: string[] = []) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeAuth(fakeUser({ permissions })),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OfflineBannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const render = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
    };
    return {
      el: fixture.nativeElement as HTMLElement,
      connectivity: TestBed.inject(ConnectivityService),
      render,
    };
  }

  it('shows nothing while all is well', async () => {
    const { render } = await setup();
    expect(await render()).toBe('');
  });

  it('shows a critical alert while offline, then a short restored notice', async () => {
    const { el, render } = await setup();
    window.dispatchEvent(new Event('offline'));
    expect(await render()).toContain("You're offline.");
    expect(el.querySelector('[role="alert"]')).not.toBeNull();

    window.dispatchEvent(new Event('online'));
    expect(await render()).toContain('Connection restored.');
    vi.advanceTimersByTime(RESTORED_NOTICE_MS);
    expect(await render()).toBe('');
  });

  it('counts down to the next reconnect attempt and retries on request', async () => {
    const { el, connectivity, render } = await setup();
    connectivity.reportServerFailure(503);
    let text = await render();
    expect(text).toContain("Can't reach the InduSense server (service unavailable).");
    expect(text).toContain('Retrying in 2s.');

    vi.advanceTimersByTime(1000);
    expect(await render()).toContain('Retrying in 1s.');

    (el.querySelector('button') as HTMLButtonElement).click();
    http
      .expectOne((r) => r.url === '/api/v1/auth/me')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    text = await render();
    expect(text).toContain('Retrying in 4s · 1 attempt so far.');
  });

  it('warns while a DataLogger has lost its broker connection', async () => {
    const { render } = await setup([Permission.LoggersView]);
    vi.advanceTimersByTime(0);
    http
      .expectOne((r) => r.url === '/api/v1/loggers')
      .flush(
        page([
          {
            logger_id: 'l1',
            hostname: 'plant-pc',
            source_connected: false,
            health: 'DEGRADED',
            last_error: 'connection refused',
          },
        ]),
      );
    const text = await render();
    expect(text).toContain('Live data interrupted.');
    expect(text).toContain(
      'DataLogger plant-pc lost its broker / device connection (connection refused); waiting for it to reconnect.',
    );
    expect(text).toContain('check 1');
  });

  it('does not poll DataLoggers without loggers:view', async () => {
    await setup([]);
    vi.advanceTimersByTime(60_000);
    http.expectNone((r) => r.url === '/api/v1/loggers');
  });
});
