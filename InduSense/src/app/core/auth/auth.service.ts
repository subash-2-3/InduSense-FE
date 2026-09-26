import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  TimeoutError,
  timeout,
  throwError,
} from 'rxjs';

import { ApiService } from '../api/api.service';
import { ApiError, NETWORK_ERROR } from '../api/api-error';
import { CurrentUser, LoginRequest, TokenResponse } from '../models';
import { TokenStorageService } from './token-storage.service';

/** `unknown` until the session check at startup has finished (and always on the server). */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

/** The signed-in user as the header shows it. */
export interface DisplayUser {
  name: string;
  email: string;
  role: string;
  companyName: string;
  companyCode: string;
}

/** Standard authentication endpoints (InduSense-BE `/auth/login`, `/auth/refresh`, `/auth/logout`). */
export const AUTH_PATHS = {
  login: '/auth/login',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/auth/me',
} as const;

export const SESSION_PATHS = AUTH_PATHS;

const AUTH_REQUEST_TIMEOUT_MS = 15_000;

function mapAuthTimeout(error: unknown): Observable<never> {
  return throwError(() =>
    error instanceof TimeoutError
      ? new ApiError(0, NETWORK_ERROR, "Can't reach the server. Check your connection and try again.")
      : error,
  );
}

function roleLabel(code: string | undefined): string {
  if (!code) {
    return 'User';
  }
  const text = code.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function displayUserOf(user: CurrentUser): DisplayUser {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return {
    name: name || user.email,
    email: user.email,
    role: roleLabel(user.roles[0]),
    companyName: user.company_name,
    companyCode: user.company_code,
  };
}

/**
 * Standard token-based authentication service.
 * Calls `POST /auth/login`, stores tokens securely, attaches Bearer token, and loads user from `GET /auth/me`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly tokens = inject(TokenStorageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly userState = signal<CurrentUser | null>(null);
  private readonly statusState = signal<SessionStatus>('unknown');

  readonly user = this.userState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly isAuthenticated = computed(() => this.statusState() === 'authenticated');
  readonly permissions = computed(() => new Set(this.userState()?.permissions ?? []));
  readonly displayUser = computed(() => {
    const user = this.userState();
    return user ? displayUserOf(user) : null;
  });

  private refreshInFlight: Observable<void> | null = null;

  /**
   * Startup check (app initializer): if access token is stored, verify session via `GET /auth/me`.
   * Skipped during server rendering.
   */
  restoreSession(): Promise<void> {
    if (!this.isBrowser) {
      return Promise.resolve();
    }
    if (!this.tokens.getAccessToken()) {
      this.clearSession();
      return Promise.resolve();
    }
    return firstValueFrom(
      this.loadMe().pipe(
        timeout({ first: AUTH_REQUEST_TIMEOUT_MS }),
        catchError(mapAuthTimeout),
        map(() => undefined),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
      ),
    );
  }

  loadMe(): Observable<CurrentUser> {
    return this.api.get<CurrentUser>(AUTH_PATHS.me).pipe(
      tap((user) => {
        this.userState.set(user);
        this.statusState.set('authenticated');
      }),
    );
  }

  /** Calls `POST /auth/login`, stores access and refresh tokens, and loads current user profile. */
  login(credentials: LoginRequest): Observable<CurrentUser> {
    return this.api
      .post<TokenResponse>(AUTH_PATHS.login, credentials)
      .pipe(
        tap((tokens) => {
          if (tokens?.access_token) {
            this.tokens.setTokens(tokens.access_token, tokens.refresh_token);
          }
        }),
        switchMap(() => this.loadMe()),
        timeout({ first: AUTH_REQUEST_TIMEOUT_MS }),
        catchError(mapAuthTimeout),
      );
  }

  /** Calls `POST /auth/logout`, clears tokens and user state. */
  logout(allSessions = false): Observable<void> {
    const refreshToken = this.tokens.getRefreshToken();
    const body = refreshToken
      ? { refresh_token: refreshToken, all_sessions: allSessions }
      : { all_sessions: allSessions };

    return this.api.post<void>(AUTH_PATHS.logout, body).pipe(
      catchError(() => of(undefined)),
      map(() => undefined),
      finalize(() => this.clearSession()),
    );
  }

  /**
   * Rotates tokens via `POST /auth/refresh`. Single-flight: concurrent requests share the refresh call.
   */
  refreshSession(): Observable<void> {
    const refreshToken = this.tokens.getRefreshToken();
    if (!refreshToken) {
      this.clearSession();
      return throwError(() => new ApiError(401, 'INVALID_REFRESH_TOKEN', 'No active refresh token'));
    }

    if (!this.refreshInFlight) {
      this.refreshInFlight = this.api
        .post<TokenResponse>(AUTH_PATHS.refresh, { refresh_token: refreshToken })
        .pipe(
          tap((tokens) => {
            if (tokens?.access_token) {
              this.tokens.setTokens(tokens.access_token, tokens.refresh_token);
            }
          }),
          map(() => undefined),
          finalize(() => (this.refreshInFlight = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.refreshInFlight;
  }

  sessionExpired(): void {
    const wasSignedIn = this.isAuthenticated();
    this.clearSession();
    if (wasSignedIn) {
      const returnUrl = this.router.url;
      void this.router.navigate(['/login'], {
        queryParams: returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : {},
      });
    }
  }

  hasPermission(code: string): boolean {
    return this.permissions().has(code);
  }

  private clearSession(): void {
    this.tokens.clearTokens();
    this.userState.set(null);
    this.statusState.set('anonymous');
  }
}
