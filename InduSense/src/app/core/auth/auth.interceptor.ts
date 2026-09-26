import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { AUTH_PATHS, AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

/** Endpoints whose 401 means "wrong credentials / no session", never "refresh and retry". */
const NO_REFRESH = [AUTH_PATHS.login, AUTH_PATHS.refresh, AUTH_PATHS.logout];

export function apiPath(url: string, apiBaseUrl: string): string | null {
  const base = apiBaseUrl.replace(/\/+$/, '');
  if (url !== base && !url.startsWith(`${base}/`)) {
    return null;
  }
  return url.slice(base.length).split('?')[0] || '/';
}

const isUnauthorized = (error: unknown) => error instanceof HttpErrorResponse && error.status === 401;

/**
 * Attaches the Bearer token to API requests and handles token refresh on 401.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const path = apiPath(request.url, inject(APP_CONFIG).apiBaseUrl);
  if (path === null) {
    return next(request);
  }

  const tokenStorage = inject(TokenStorageService);
  const auth = inject(AuthService);

  let req = request;
  const token = tokenStorage.getAccessToken();
  if (token && !req.headers.has('Authorization')) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  if (NO_REFRESH.some((p) => path === p)) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!isUnauthorized(error)) {
        return throwError(() => error);
      }
      return auth.refreshSession().pipe(
        catchError(() => {
          auth.sessionExpired();
          return throwError(() => error);
        }),
        switchMap(() => {
          const newToken = tokenStorage.getAccessToken();
          const replayedReq = newToken
            ? request.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
            : request;
          return next(replayedReq).pipe(
            catchError((replayError: unknown) => {
              if (isUnauthorized(replayError)) {
                auth.sessionExpired();
              }
              return throwError(() => replayError);
            }),
          );
        }),
      );
    }),
  );
};
