import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../api/api-error';
import { APP_CONFIG } from '../config/app-config';
import { authInterceptor } from './auth.interceptor';
import { AuthService, displayUserOf } from './auth.service';
import { fakeUser } from './testing';
import { TokenStorageService } from './token-storage.service';

const API = '/api/v1';
const unauthorized = { status: 401, statusText: 'Unauthorized' };
const authError = { success: false, code: 'AUTHENTICATION_REQUIRED', message: 'Not authenticated' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let tokens: TokenStorageService;

  function setup(platform: 'browser' | 'server' = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { ...environment, apiBaseUrl: API } },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorageService);
    tokens.clearTokens();
  }

  afterEach(() => {
    tokens?.clearTokens();
    http.verify();
  });

  describe('restoreSession', () => {
    it('signs in when stored access token is valid', async () => {
      setup();
      tokens.setTokens('valid-access', 'valid-refresh');
      expect(auth.status()).toBe('unknown');
      const done = auth.restoreSession();
      const meReq = http.expectOne(`${API}/auth/me`);
      expect(meReq.request.headers.get('Authorization')).toBe('Bearer valid-access');
      meReq.flush({ success: true, data: fakeUser() });
      await done;
      expect(auth.status()).toBe('authenticated');
      expect(auth.hasPermission('devices:view')).toBe(true);
    });

    it('refreshes an expired token once, then signs in', async () => {
      setup();
      tokens.setTokens('expired-access', 'valid-refresh');
      const done = auth.restoreSession();
      http.expectOne(`${API}/auth/me`).flush(authError, unauthorized);
      const refreshReq = http.expectOne(`${API}/auth/refresh`);
      expect(refreshReq.request.method).toBe('POST');
      expect(refreshReq.request.body).toEqual({ refresh_token: 'valid-refresh' });
      refreshReq.flush({
        success: true,
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          token_type: 'bearer',
          expires_in: 900,
          refresh_expires_in: 604800,
        },
      });
      const replayedMe = http.expectOne(`${API}/auth/me`);
      expect(replayedMe.request.headers.get('Authorization')).toBe('Bearer new-access');
      replayedMe.flush({ success: true, data: fakeUser() });
      await done;
      expect(auth.isAuthenticated()).toBe(true);
      expect(tokens.getAccessToken()).toBe('new-access');
    });

    it('ends up signed out without navigating when there are no stored tokens', async () => {
      setup();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      const done = auth.restoreSession();
      await done;
      expect(auth.status()).toBe('anonymous');
      expect(navigate).not.toHaveBeenCalled();
      http.expectNone(`${API}/auth/me`);
    });

    it('treats an unreachable server as signed out', async () => {
      setup();
      tokens.setTokens('some-access', 'some-refresh');
      const done = auth.restoreSession();
      http.expectOne(`${API}/auth/me`).error(new ProgressEvent('error'), { status: 0 });
      await done;
      expect(auth.status()).toBe('anonymous');
    });

    it('does nothing during server rendering', async () => {
      setup('server');
      await auth.restoreSession();
      expect(auth.status()).toBe('unknown');
    });
  });

  it('logs in through POST /auth/login and stores tokens and loads the user', async () => {
    setup();
    const result = firstValueFrom(auth.login({ email: 'a@b.com', password: 'secret' }));
    const loginReq = http.expectOne(`${API}/auth/login`);
    expect(loginReq.request.method).toBe('POST');
    expect(loginReq.request.body).toEqual({ email: 'a@b.com', password: 'secret' });
    loginReq.flush({
      success: true,
      data: {
        access_token: 'tok-access',
        refresh_token: 'tok-refresh',
        token_type: 'bearer',
        expires_in: 900,
        refresh_expires_in: 604800,
      },
    });

    const meReq = http.expectOne(`${API}/auth/me`);
    expect(meReq.request.headers.get('Authorization')).toBe('Bearer tok-access');
    meReq.flush({ success: true, data: fakeUser({ email: 'a@b.com' }) });

    expect((await result).email).toBe('a@b.com');
    expect(auth.displayUser()?.email).toBe('a@b.com');
    expect(tokens.getAccessToken()).toBe('tok-access');
    expect(tokens.getRefreshToken()).toBe('tok-refresh');
  });

  it('reports wrong credentials as an ApiError without retrying', async () => {
    setup();
    const result = firstValueFrom(auth.login({ email: 'a@b.com', password: 'x' }));
    http
      .expectOne(`${API}/auth/login`)
      .flush({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }, unauthorized);
    const error = (await result.catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('fails a login that does not receive a response', async () => {
    vi.useFakeTimers();
    try {
      setup();
      const result = firstValueFrom(auth.login({ email: 'a@b.com', password: 'secret' }));
      http.expectOne(`${API}/auth/login`);

      vi.advanceTimersByTime(15_000);

      const error = (await result.catch((e: unknown) => e)) as ApiError;
      expect(error.code).toBe('NETWORK_ERROR');
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs out on the server and clears tokens, even if the server call fails', async () => {
    setup();
    tokens.setTokens('access-123', 'refresh-456');
    const restore = auth.restoreSession();
    http.expectOne(`${API}/auth/me`).flush({ success: true, data: fakeUser() });
    await restore;

    const done = firstValueFrom(auth.logout(true));
    const req = http.expectOne(`${API}/auth/logout`);
    expect(req.request.body).toEqual({ refresh_token: 'refresh-456', all_sessions: true });
    req.flush(null, { status: 500, statusText: 'Server Error' });
    await done;
    expect(auth.status()).toBe('anonymous');
    expect(auth.user()).toBeNull();
    expect(tokens.getAccessToken()).toBeNull();
    expect(tokens.getRefreshToken()).toBeNull();
  });

  it('shares one refresh between concurrent callers', async () => {
    setup();
    tokens.setTokens('acc', 'ref');
    const a = firstValueFrom(auth.refreshSession());
    const b = firstValueFrom(auth.refreshSession());
    http.expectOne(`${API}/auth/refresh`).flush({
      success: true,
      data: {
        access_token: 'acc-2',
        refresh_token: 'ref-2',
        token_type: 'bearer',
        expires_in: 900,
        refresh_expires_in: 604800,
      },
    });
    await Promise.all([a, b]);

    void firstValueFrom(auth.refreshSession());
    http.expectOne(`${API}/auth/refresh`).flush({
      success: true,
      data: {
        access_token: 'acc-3',
        refresh_token: 'ref-3',
        token_type: 'bearer',
        expires_in: 900,
        refresh_expires_in: 604800,
      },
    });
  });

  it('sends a signed-in user whose session ended to the login page with a return URL', async () => {
    setup();
    tokens.setTokens('acc', 'ref');
    const restore = auth.restoreSession();
    http.expectOne(`${API}/auth/me`).flush({ success: true, data: fakeUser() });
    await restore;
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/devices?page=2');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    auth.sessionExpired();
    expect(auth.status()).toBe('anonymous');
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/devices?page=2' },
    });
  });
});

describe('displayUserOf', () => {
  it('builds the header view of a user', () => {
    expect(displayUserOf(fakeUser())).toEqual({
      name: 'Plant Admin',
      email: 'plant.admin@indusense.com',
      role: 'Company admin',
      companyName: 'InduSense Corp',
      companyCode: 'INDU',
    });
    const bare = displayUserOf(fakeUser({ first_name: null, last_name: null, roles: [] }));
    expect(bare.name).toBe('plant.admin@indusense.com');
    expect(bare.role).toBe('User');
  });
});
