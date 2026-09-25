import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { AuthService, SESSION_PATHS } from './auth.service';

/** Endpoints whose 401 means "wrong credentials / no session", never "refresh and retry". */
const NO_REFRESH = [SESSION_PATHS.create, SESSION_PATHS.refresh, SESSION_PATHS.logout];

export function apiPath(url: string, apiBaseUrl: string): string | null {
  const base = apiBaseUrl.replace(/\/+$/, '');
  if (url !== base && !url.startsWith(`${base}/`)) {
    return null;
  }
  return url.slice(base.length).split('?')[0] || '/';
}

const isUnauthorized = (error: unknown) => error instanceof HttpErrorResponse && error.status === 401;

/**
 * On a 401 from the API: refresh the session once (shared by all failing requests), then replay
 * the request once. If the refresh fails, or the replay is rejected again, the session has ended
 * (AuthService.sessionExpired). The replay goes to the next handler, never back through here.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const path = apiPath(request.url, inject(APP_CONFIG).apiBaseUrl);
  if (path === null || NO_REFRESH.some((p) => path === p)) {
    return next(request);
  }
  const auth = inject(AuthService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!isUnauthorized(error)) {
        return throwError(() => error);
      }
      return auth.refreshSession().pipe(
        catchError(() => {
          auth.sessionExpired();
          return throwError(() => error);
        }),
        switchMap(() =>
          next(request).pipe(
            catchError((replayError: unknown) => {
              if (isUnauthorized(replayError)) {
                auth.sessionExpired();
              }
              return throwError(() => replayError);
            }),
          ),
        ),
      );
    }),
  );
};
