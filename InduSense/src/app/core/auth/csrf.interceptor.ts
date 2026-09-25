import { DOCUMENT } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { APP_CONFIG } from '../config/app-config';
import { apiPath } from './auth.interceptor';

export const CSRF_COOKIE = 'indusense_csrf';
export const CSRF_HEADER = 'X-CSRF-Token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function readCookie(cookies: string, name: string): string | null {
  for (const part of cookies.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

/**
 * Double-submit CSRF: copies the readable `indusense_csrf` cookie into `X-CSRF-Token` on unsafe
 * API requests. Registered after the auth interceptor so a request replayed after a refresh picks
 * up the rotated value. (Angular's built-in XSRF support is disabled in favour of this.)
 */
export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  if (SAFE_METHODS.has(request.method)) {
    return next(request);
  }
  if (apiPath(request.url, inject(APP_CONFIG).apiBaseUrl) === null) {
    return next(request);
  }
  const token = readCookie(inject(DOCUMENT).cookie ?? '', CSRF_COOKIE);
  return next(token ? request.clone({ setHeaders: { [CSRF_HEADER]: token } }) : request);
};
