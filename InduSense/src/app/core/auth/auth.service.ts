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
import { CurrentUser, LoginRequest } from '../models';
import { ToastService } from '../../shared/ui/toast/toast.service';

/** `unknown` until the session check at startup has finished (and always on the server). */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

/** The signed-in user as the header shows it. */
export interface DisplayUser {
  name: string;
  email: string;
  role: string;
  /** `null` for a platform administrator, who belongs to no company. */
  companyName: string | null;
  companyCode: string | null;
}

/** Browser-session endpoints (InduSense-BE `/auth/session`). */
export const SESSION_PATHS = {
  create: '/auth/session',
  refresh: '/auth/session/refresh',
  logout: '/auth/session/logout',
  me: '/auth/me',
} as const;

const AUTH_REQUEST_TIMEOUT_MS = 15_000;

function mapAuthTimeout(error: unknown): Observable<never> {
  return throwError(() =>
    error instanceof TimeoutError
      ? new ApiError(
          0,
          NETWORK_ERROR,
          "Can't reach the server. Check your connection and try again.",
        )
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
 * Cookie-based session. Tokens live in HttpOnly cookies set by the backend, so this service never
 * sees or stores them: it only knows who is signed in (from `GET /auth/me`).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
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
   * Startup check (app initializer): is there a session? A 401 is handled by the auth
   * interceptor, which tries one refresh first. Never rejects; skipped during server rendering.
   */
  restoreSession(): Promise<void> {
    if (!this.isBrowser) {
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
    return this.api.get<CurrentUser>(SESSION_PATHS.me).pipe(
      tap((user) => {
        this.userState.set(user);
        this.statusState.set('authenticated');
      }),
    );
  }

  /** Signs in (the backend sets the session cookies) and loads the user. Errors are ApiErrors. */
  login(credentials: LoginRequest): Observable<CurrentUser> {
    return this.api.post<unknown>(SESSION_PATHS.create, credentials).pipe(
      switchMap(() => this.loadMe()),
      timeout({ first: AUTH_REQUEST_TIMEOUT_MS }),
      catchError(mapAuthTimeout),
    );
  }

  /** Ends the session on the server and locally; the local session ends even if the call fails. */
  logout(allSessions = false): Observable<void> {
    return this.api.post<void>(SESSION_PATHS.logout, { all_sessions: allSessions }).pipe(
      catchError(() => of(undefined)),
      map(() => undefined),
      finalize(() => this.clearSession()),
    );
  }

  /**
   * Rotates the session cookies. Single-flight: concurrent callers share one request, because
   * refresh tokens are single-use and a replay would end every session.
   */
  refreshSession(): Observable<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.api.post<unknown>(SESSION_PATHS.refresh).pipe(
        map(() => undefined),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshInFlight;
  }

  /**
   * The session could not be renewed. A user who was signed in is sent to the login page and
   * returns to the current page afterwards; during the startup check nothing navigates.
   */
  sessionExpired(): void {
    const wasSignedIn = this.isAuthenticated();
    this.clearSession();
    if (wasSignedIn) {
      this.toast.error('Your session has ended. Please sign in again.');
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
    this.userState.set(null);
    this.statusState.set('anonymous');
  }
}
