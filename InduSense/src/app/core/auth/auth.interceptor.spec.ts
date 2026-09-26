import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { APP_CONFIG } from '../config/app-config';
import { apiPath, authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const API = '/api/v1';
const unauthorized = { status: 401, statusText: 'Unauthorized' };
const expired = { success: false, code: 'AUTHENTICATION_REQUIRED', message: 'Not authenticated' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;
  let tokens: TokenStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { ...environment, apiBaseUrl: API } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(TokenStorageService);
    tokens.setTokens('initial-access', 'initial-refresh');
  });

  afterEach(() => {
    tokens.clearTokens();
    controller.verify();
  });

  it('attaches the Bearer token to API requests', async () => {
    void firstValueFrom(http.get(`${API}/plants`));
    const req = controller.expectOne(`${API}/plants`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer initial-access');
    req.flush({ success: true, data: [] });
  });

  it('refreshes once for three concurrent 401s and replays each request once', async () => {
    const expiredSpy = vi.spyOn(auth, 'sessionExpired');
    const results = ['/devices', '/machines', '/gateways'].map((path) =>
      firstValueFrom(http.get<{ path: string }>(`${API}${path}`)),
    );
    for (const path of ['/devices', '/machines', '/gateways']) {
      controller.expectOne(`${API}${path}`).flush(expired, unauthorized);
    }

    const refreshes = controller.match(`${API}/auth/refresh`);
    expect(refreshes).toHaveLength(1);
    refreshes[0].flush({
      success: true,
      data: {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        token_type: 'bearer',
        expires_in: 900,
        refresh_expires_in: 604800,
      },
    });

    for (const path of ['/devices', '/machines', '/gateways']) {
      const replay = controller.expectOne(`${API}${path}`);
      expect(replay.request.headers.get('Authorization')).toBe('Bearer new-access');
      replay.flush({ path });
    }
    expect(await Promise.all(results)).toEqual([
      { path: '/devices' },
      { path: '/machines' },
      { path: '/gateways' },
    ]);
    expect(expiredSpy).not.toHaveBeenCalled();
  });

  it('ends the session when the refresh fails, passing the original error on', async () => {
    const expiredSpy = vi.spyOn(auth, 'sessionExpired');
    const result = firstValueFrom(http.get(`${API}/devices`));
    controller.expectOne(`${API}/devices`).flush(expired, unauthorized);
    controller
      .expectOne(`${API}/auth/refresh`)
      .flush({ success: false, code: 'INVALID_REFRESH_TOKEN', message: 'x' }, unauthorized);
    const error = await result.catch((e: unknown) => e);
    expect((error as { status: number }).status).toBe(401);
    expect(expiredSpy).toHaveBeenCalledOnce();
  });

  it('does not loop: a replayed request that fails again ends the session', async () => {
    const expiredSpy = vi.spyOn(auth, 'sessionExpired');
    const result = firstValueFrom(http.get(`${API}/devices`));
    controller.expectOne(`${API}/devices`).flush(expired, unauthorized);
    controller.expectOne(`${API}/auth/refresh`).flush({
      success: true,
      data: {
        access_token: 'replay-access',
        refresh_token: 'replay-refresh',
        token_type: 'bearer',
        expires_in: 900,
        refresh_expires_in: 604800,
      },
    });
    controller.expectOne(`${API}/devices`).flush(expired, unauthorized);
    await result.catch(() => undefined);
    expect(expiredSpy).toHaveBeenCalledOnce();
    controller.expectNone(`${API}/auth/refresh`);
  });

  it('never refreshes for the auth endpoints themselves', async () => {
    for (const path of ['/auth/login', '/auth/refresh', '/auth/logout']) {
      const result = firstValueFrom(http.post(`${API}${path}`, {}));
      controller.expectOne(`${API}${path}`).flush(expired, unauthorized);
      await result.catch(() => undefined);
    }
    controller.expectNone(`${API}/auth/refresh`);
  });

  it('passes other errors and non-API requests through untouched', async () => {
    const forbidden = firstValueFrom(http.get(`${API}/users`));
    controller
      .expectOne(`${API}/users`)
      .flush({ success: false, code: 'PERMISSION_DENIED', message: 'no' }, { status: 403, statusText: 'Forbidden' });
    expect(((await forbidden.catch((e: unknown) => e)) as { status: number }).status).toBe(403);

    const external = firstValueFrom(http.get('https://example.com/api/v1/devices'));
    controller.expectOne('https://example.com/api/v1/devices').flush(null, unauthorized);
    await external.catch(() => undefined);
    controller.expectNone(`${API}/auth/refresh`);
  });
});

describe('apiPath', () => {
  it('returns the API-relative path, or null for other URLs', () => {
    expect(apiPath('/api/v1/auth/login?x=1', '/api/v1')).toBe('/auth/login');
    expect(apiPath('/api/v1', '/api/v1/')).toBe('/');
    expect(apiPath('/api/v10/devices', '/api/v1')).toBeNull();
    expect(apiPath('https://x.example/api/v1/devices', 'https://x.example/api/v1')).toBe('/devices');
  });
});
