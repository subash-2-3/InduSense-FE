import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { apiPath } from '../auth/auth.interceptor';
import { APP_CONFIG } from '../config/app-config';
import { ConnectivityService, UNREACHABLE_STATUSES } from './connectivity.service';

/**
 * Reports every API outcome to `ConnectivityService`: status 0, 502, 503 or 504 means the server
 * is unreachable (one banner for the whole app instead of an error per request); any other answer
 * means it is reachable again. It only observes; errors still reach the caller, whose page shows
 * its own error state, and failed changes are still toasted by `errorToastInterceptor`.
 */
export const connectivityInterceptor: HttpInterceptorFn = (request, next) => {
  if (apiPath(request.url, inject(APP_CONFIG).apiBaseUrl) === null) {
    return next(request);
  }
  const connectivity = inject(ConnectivityService);
  return next(request).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) connectivity.reportServerOk();
      },
      error: (error: unknown) => {
        if (!(error instanceof HttpErrorResponse)) return;
        if (UNREACHABLE_STATUSES.has(error.status)) connectivity.reportServerFailure(error.status);
        else connectivity.reportServerOk();
      },
    }),
  );
};
