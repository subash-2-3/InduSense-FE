import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { rememberReturnUrl } from './return-url';

/** Signed-in users only; others go to /login and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isAuthenticated()) {
    return true;
  }
  rememberReturnUrl(state.url);
  return inject(Router).createUrlTree(['/login']);
};

/** The login page is for signed-out users; signed-in users go to the dashboard. */
export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;

/** Users holding `permission` only; others go to the dashboard (the API enforces it as well). */
export const permissionGuard =
  (permission: string): CanActivateFn =>
  () =>
    inject(AuthService).hasPermission(permission) || inject(Router).createUrlTree(['/dashboard']);
