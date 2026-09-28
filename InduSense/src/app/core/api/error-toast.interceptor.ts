import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ToastService } from '../../shared/ui/toast/toast.service';
import { apiPath } from '../auth/auth.interceptor';
import { APP_CONFIG } from '../config/app-config';
import { ApiError } from './api-error';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * The one place failed changes reach the user: every failed POST/PUT/PATCH/DELETE to the API
 * shows an error toast with the backend's message (ApiError; field details for validation
 * errors). Screens only reset their own state.
 *
 * Not toasted here:
 * - GET: a failed load is shown in the page itself (error state with Retry);
 * - `/auth/*`: the login form shows its errors inline;
 * - 401: the auth interceptor ends the session with its own message.
 *
 * Registered before the auth interceptor, so it sees the final outcome after a session refresh.
 */
export const errorToastInterceptor: HttpInterceptorFn = (request, next) => {
  const path = apiPath(request.url, inject(APP_CONFIG).apiBaseUrl);
  if (!MUTATIONS.has(request.method) || path === null || path.startsWith('/auth/')) {
    return next(request);
  }
  const toast = inject(ToastService);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse && error.status === 401)) {
        toast.error(ApiError.from(error));
      }
      return throwError(() => error);
    }),
  );
};
