import { Provider, computed, signal } from '@angular/core';
import { Observable, of } from 'rxjs';

import { CurrentUser, LoginRequest } from '../models';
import { AuthService, SessionStatus, displayUserOf } from './auth.service';
import { Permission } from './permissions';

/** Every UI permission of a company user (tenant:all would make the test user a platform admin). */
export const ALL_PERMISSIONS = Object.values(Permission).filter(
  (code) => code !== Permission.TenantAll,
);

export function fakeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 1,
    company_id: 1,
    email: 'plant.admin@indusense.com',
    first_name: 'Plant',
    last_name: 'Admin',
    status: 'active',
    is_verified: true,
    last_login_at: null,
    roles: ['COMPANY_ADMIN'],
    plant_ids: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    company_code: 'INDU',
    company_name: 'InduSense Corp',
    permissions: [...ALL_PERMISSIONS],
    modules: [],
    ...overrides,
  };
}

/** In-memory stand-in for AuthService in component and routing tests. */
export class FakeAuthService {
  private readonly userState = signal<CurrentUser | null>(null);
  readonly user = this.userState.asReadonly();
  readonly status = computed<SessionStatus>(() =>
    this.userState() ? 'authenticated' : 'anonymous',
  );
  readonly isAuthenticated = computed(() => this.userState() !== null);
  readonly permissions = computed(() => new Set(this.userState()?.permissions ?? []));
  readonly displayUser = computed(() => {
    const user = this.userState();
    return user ? displayUserOf(user) : null;
  });

  /** Replace per test to simulate sign-in results. */
  loginResult: (credentials: LoginRequest) => Observable<CurrentUser> = () => of(fakeUser());
  readonly loginCalls: LoginRequest[] = [];
  logoutCalls = 0;

  constructor(user: CurrentUser | null) {
    this.userState.set(user);
  }

  setUser(user: CurrentUser | null): void {
    this.userState.set(user);
  }

  login(credentials: LoginRequest): Observable<CurrentUser> {
    this.loginCalls.push(credentials);
    return this.loginResult(credentials);
  }

  logout(): Observable<void> {
    this.logoutCalls++;
    this.userState.set(null);
    return of(undefined);
  }

  hasPermission(code: string): boolean {
    return this.permissions().has(code);
  }

  restoreSession(): Promise<void> {
    return Promise.resolve();
  }
}

/** Provides a FakeAuthService signed in as `user` (null = signed out). */
export function provideFakeAuth(user: CurrentUser | null = fakeUser()): Provider[] {
  const fake = new FakeAuthService(user);
  return [
    { provide: FakeAuthService, useValue: fake },
    { provide: AuthService, useValue: fake },
  ];
}
