import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { APP_CONFIG } from '../config/app-config';

/**
 * Sends cookies with every InduSense API request (`withCredentials`), including cross-origin
 * deployments. Authentication is cookie-based (Phase 7): the app never reads or attaches tokens.
 * Requests to any other URL are left untouched.
 */
export const apiCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(APP_CONFIG).apiBaseUrl.replace(/\/+$/, '');
  const isApi = request.url === base || request.url.startsWith(`${base}/`);
  return next(
    isApi && !request.withCredentials ? request.clone({ withCredentials: true }) : request,
  );
};
