import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  withNoXsrfProtection,
} from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { apiCredentialsInterceptor } from './core/api/api-credentials.interceptor';
import { errorToastInterceptor } from './core/api/error-toast.interceptor';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { csrfInterceptor } from './core/auth/csrf.interceptor';

// Zoneless change detection is the Angular 21 default (zone.js is not installed).
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideClientHydration(withEventReplay()),
    // Order matters: the error toast interceptor wraps the auth interceptor, so it sees the final
    // outcome after a session refresh; the CSRF interceptor runs after the auth interceptor, so a
    // request replayed after a refresh carries the rotated CSRF token. Angular's own XSRF support is off.
    provideHttpClient(
      withFetch(),
      withInterceptors([
        apiCredentialsInterceptor,
        errorToastInterceptor,
        authInterceptor,
        csrfInterceptor,
      ]),
      withNoXsrfProtection(),
    ),
    // Is there a session (HttpOnly cookies)? Resolved before the first navigation; browser only.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
