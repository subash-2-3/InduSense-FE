import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { User } from '../../core/models';
import { SettingsPageComponent } from './settings-page.component';

const single = <T>(data: T) => ({ success: true, data });
const page = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});

const VIEWER: User = {
  id: 5,
  company_id: 1,
  email: 'viewer@example.com',
  first_name: 'Vee',
  last_name: null,
  status: 'active',
  is_verified: true,
  last_login_at: null,
  roles: ['VIEWER'],
  plant_ids: [],
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('SettingsPageComponent (users)', () => {
  let http: HttpTestingController;

  async function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideFakeAuth(fakeUser())],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/v1/roles').flush(single([]));
    http.expectOne('/api/v1/permissions').flush(single([]));
    http
      .expectOne((r) => r.url === '/api/v1/plants')
      .flush(page([{ id: 21, company_id: 1, code: 'N', name: 'North' }]));
    const users = http.expectOne((r) => r.url === '/api/v1/users');
    expect(users.request.params.getAll('status')).toEqual(['active', 'inactive']);
    users.flush(page([VIEWER]));
    await fixture.whenStable();
    return fixture.componentInstance as unknown as {
      openEditUserModal(u: User): void;
      saveUser(): void;
      userForm: { first_name: string; roles: Set<string>; plants: Set<number> };
    };
  }

  afterEach(() => http.verify());

  it('sends only what changed: roles and plant access, not the unchanged name', async () => {
    const page = await setup();
    page.openEditUserModal(VIEWER);
    page.userForm.roles = new Set(['OPERATOR']);
    page.userForm.plants = new Set([21]);
    page.saveUser();

    const roles = http.expectOne('/api/v1/users/5/roles');
    expect(roles.request.method).toBe('PUT');
    expect(roles.request.body).toEqual({ role_codes: ['OPERATOR'] });
    roles.flush(single({ ...VIEWER, roles: ['OPERATOR'] }));

    const plants = http.expectOne('/api/v1/users/5/plants');
    expect(plants.request.body).toEqual({ plant_ids: [21] });
    plants.flush(single({ ...VIEWER, roles: ['OPERATOR'], plant_ids: [21] }));
    // No PATCH /users/5: the name did not change.
  });

  it('does nothing when nothing changed', async () => {
    const page = await setup();
    page.openEditUserModal(VIEWER);
    page.saveUser();
    http.expectNone((r) => r.url.startsWith('/api/v1/users/5'));
  });
});
