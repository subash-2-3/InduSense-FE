import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LoggerStatus } from '../models';
import { connectivityInterceptor } from './connectivity.interceptor';
import { ConnectivityService, RestoredKind } from './connectivity.service';

const page = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});

const logger = (overrides: Partial<LoggerStatus> = {}): LoggerStatus => ({
  logger_id: 'logger-1',
  company_id: 1,
  hostname: 'plant-pc',
  version: '1.0',
  data_source: 'MQTT',
  source_connected: true,
  database_connected: true,
  last_message_at: null,
  last_error: null,
  last_error_at: null,
  buffered_points: 0,
  started_at: '2026-10-25T00:00:00Z',
  updated_at: '2026-10-25T00:00:00Z',
  health: 'HEALTHY',
  ...overrides,
});

describe('ConnectivityService', () => {
  let http: HttpTestingController;
  let service: ConnectivityService;
  let restored: RestoredKind[];

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([connectivityInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ConnectivityService);
    restored = [];
    service.restored$.subscribe((kind) => restored.push(kind));
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const probe = () => http.expectOne((r) => r.url === '/api/v1/auth/me');

  it('follows the browser online / offline events', () => {
    expect(service.status()).toBe('ok');
    window.dispatchEvent(new Event('offline'));
    expect(service.status()).toBe('offline');
    window.dispatchEvent(new Event('online'));
    expect(service.status()).toBe('ok');
    expect(restored).toEqual(['network']);
  });

  it('probes an unreachable server with backoff until it answers', () => {
    service.reportServerFailure(503);
    expect(service.status()).toBe('server-down');
    expect(service.serverStatus()).toBe(503);

    vi.advanceTimersByTime(1999);
    http.expectNone((r) => r.url === '/api/v1/auth/me');
    vi.advanceTimersByTime(1);
    probe().flush(null, { status: 502, statusText: 'Bad Gateway' });
    expect(service.probeAttempts()).toBe(1);
    expect(service.serverDown()).toBe(true);

    vi.advanceTimersByTime(4000); // second wait is longer
    // Any answer from the API itself, even 401, means it is reachable again.
    probe().flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(service.status()).toBe('ok');
    expect(restored).toEqual(['server']);
  });

  it('retries at once on request, and when the network comes back', () => {
    service.reportServerFailure(0);
    service.retryNow();
    probe().flush(null, { status: 0, statusText: 'Unknown Error' });
    expect(service.probeAttempts()).toBe(1);

    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    probe().flush({}, { status: 200, statusText: 'OK' });
    expect(service.serverDown()).toBe(false);
  });

  it('ignores server failures while offline (offline explains them)', () => {
    window.dispatchEvent(new Event('offline'));
    service.reportServerFailure(0);
    expect(service.serverDown()).toBe(false);
    window.dispatchEvent(new Event('online'));
  });

  it('the interceptor reports unreachable statuses and recoveries', () => {
    const client = TestBed.inject(HttpClient);
    client.get('/api/v1/plants').subscribe({ error: () => undefined });
    http.expectOne('/api/v1/plants').flush(null, { status: 504, statusText: 'Gateway Timeout' });
    expect(service.serverDown()).toBe(true);

    client.get('/api/v1/plants').subscribe({ error: () => undefined });
    http.expectOne('/api/v1/plants').flush(null, { status: 404, statusText: 'Not Found' });
    expect(service.serverDown()).toBe(false);

    client.get('/assets/logo.svg').subscribe({ error: () => undefined }); // not the API: ignored
    http.expectOne('/assets/logo.svg').flush(null, { status: 503, statusText: 'Unavailable' });
    expect(service.serverDown()).toBe(false);
  });

  it('watches DataLoggers, faster while one has lost its source', () => {
    const stop = service.watchStream();
    vi.advanceTimersByTime(0);
    http
      .expectOne((r) => r.url === '/api/v1/loggers')
      .flush(page([logger({ source_connected: false, last_error: 'broker refused' })]));
    expect(service.status()).toBe('stream-degraded');
    expect(service.streamIssues()).toEqual([
      { loggerId: 'logger-1', hostname: 'plant-pc', kind: 'source', lastError: 'broker refused' },
    ]);
    expect(service.streamChecks()).toBe(1);

    vi.advanceTimersByTime(10_000);
    http.expectOne((r) => r.url === '/api/v1/loggers').flush(page([logger({ health: 'STALE' })]));
    expect(service.streamIssues()[0].kind).toBe('stale');
    expect(service.streamChecks()).toBe(2);

    vi.advanceTimersByTime(10_000);
    http.expectOne((r) => r.url === '/api/v1/loggers').flush(page([logger()]));
    expect(service.status()).toBe('ok');
    expect(service.streamChecks()).toBe(0);
    expect(restored).toEqual(['stream']);

    vi.advanceTimersByTime(29_999); // healthy: back to the slow interval
    http.expectNone((r) => r.url === '/api/v1/loggers');
    stop();
    vi.advanceTimersByTime(60_000);
    http.expectNone((r) => r.url === '/api/v1/loggers');
  });

  it('stops watching when loggers are forbidden', () => {
    service.watchStream();
    vi.advanceTimersByTime(0);
    http
      .expectOne((r) => r.url === '/api/v1/loggers')
      .flush(null, { status: 403, statusText: 'Forbidden' });
    vi.advanceTimersByTime(120_000);
    http.expectNone((r) => r.url === '/api/v1/loggers');
  });
});
