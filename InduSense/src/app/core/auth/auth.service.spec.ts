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
import { RETURN_URL_STORAGE_KEY } from './return-url';
import { fakeUser } from './testing';

const API = '/api/v1';
const unauthorized = { status: 401, statusText: 'Unauthorized' };
const authError = { success: false, code: 'AUTHENTICATION_REQUIRED', message: 'Not authenticated' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

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
  }

  afterEach(() => http.verify());
  afterEach(() => sessionStorage.clear());

  describe('restoreSession', () => {
    it('signs in from an existing session cookie', async () => {
      setup();
      expect(auth.status()).toBe('unknown');
      const done = auth.restoreSession();
      http.expectOne(`${API}/auth/me`).flush({ success: true, data: fakeUser() });
      await done;
      expect(auth.status()).toBe('authenticated');
      expect(auth.hasPermission('devices:view')).toBe(true);
    });

    it('refreshes an expired session once, then signs in', async () => {
      setup();
      const done = auth.restoreSession();
      http.expectOne(`${API}/auth/me`).flush(authError, unauthorized);
      http.expectOne(`${API}/auth/session/refresh`).flush({ success: true, data: {} });
      http.expectOne(`${API}/auth/me`).flush({ success: true, data: fakeUser() });
      await done;
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('ends up signed out without navigating when there is no session', async () => {
      setup();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      const done = auth.restoreSession();
      http.expectOne(`${API}/auth/me`).flush(authError, unauthorized);
      http
        .expectOne(`${API}/auth/session/refresh`)
        .flush({ success: false, code: 'INVALID_REFRESH_TOKEN', message: 'No active session' }, unauthorized);
      await done;
      expect(auth.status()).toBe('anonymous');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('treats an unreachable server as signed out', async () => {
      setup();
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

  it('logs in through the session endpoint and loads the user', async () => {
    setup();
    const result = firstValueFrom(auth.login({ email: 'a@b.com', password: 'secret' }));
    const create = http.expectOne(`${API}/auth/session`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ email: 'a@b.com', password: 'secret' });
    create.flush({ success: true, data: { expires_in: 1800, refresh_expires_in: 604800 } });
    http.expectOne(`${API}/auth/me`).flush({ success: true, data: fakeUser({ email: 'a@b.com' }) });
    expect((await result).email).toBe('a@b.com');
    expect(auth.displayUser()?.email).toBe('a@b.com');
  });

  it('reports wrong credentials as an ApiError without retrying', async () => {
    setup();
    const result = firstValueFrom(auth.login({ email: 'a@b.com', password: 'x' }));
    http
      .expectOne(`${API}/auth/session`)
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
      http.expectOne(`${API}/auth/session`);

      vi.advanceTimersByTime(15_000);

      const error = (await result.catch((e: unknown) => e)) as ApiError;
      expect(error.code).toBe('NETWORK_ERROR');
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs out on the server and locally, even if the server call fails', async () => {
    setup();
    const restore = auth.restoreSession();
    http.expectOne(`${API}/auth/me`).flush({ success: true, data: fakeUser() });
    await restore;

    const done = firstValueFrom(auth.logout(true));
    const req = http.expectOne(`${API}/auth/session/logout`);
    expect(req.request.body).toEqual({ all_sessions: true });
    req.flush(null, { status: 500, statusText: 'Server Error' });
    await done;
    expect(auth.status()).toBe('anonymous');
    expect(auth.user()).toBeNull();
  });

  it('shares one refresh between concurrent callers', async () => {
    setup();
    const a = firstValueFrom(auth.refreshSession());
    const b = firstValueFrom(auth.refreshSession());
    http.expectOne(`${API}/auth/session/refresh`).flush({ success: true, data: {} });
    await Promise.all([a, b]);
    // A later refresh is a new request.
    void firstValueFrom(auth.refreshSession());
    http.expectOne(`${API}/auth/session/refresh`).flush({ success: true, data: {} });
  });

  it('sends a signed-in user whose session ended to a clean login URL and remembers it', async () => {
    setup();
    const restore = auth.restoreSession();
    http.expectOne(`${API}/auth/me`).flush({ success: true, data: fakeUser() });
    await restore;
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/devices?page=2');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    auth.sessionExpired();
    expect(auth.status()).toBe('anonymous');
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBe('/devices?page=2');
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
