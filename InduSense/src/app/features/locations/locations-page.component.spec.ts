import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { errorToastInterceptor } from '../../core/api/error-toast.interceptor';
import { ALL_PERMISSIONS, fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { Permission } from '../../core/auth/permissions';
import { BusinessUnit, Plant } from '../../core/models';
import { LocationsPageComponent } from './locations-page.component';

const single = <T>(data: T) => ({ success: true, data });
const page = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});

const NORTH: BusinessUnit = {
  id: 3,
  company_id: 1,
  code: 'NORTH',
  name: 'North Branch',
  description: null,
  status: 'active',
  plants: 1,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};
const PLANT: Plant = {
  id: 10,
  company_id: 1,
  business_unit_id: 3,
  code: 'P-01',
  name: 'Chennai Plant',
  address: null,
  timezone: null,
  status: 'active',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

interface PageApi {
  openCreatePlantModal(): void;
  openEditPlantModal(p: Plant): void;
  savePlant(): void;
  unitName(p: Plant): string | null;
  plantForm: { name: string; code: string; business_unit_id: number | null };
}

describe('LocationsPageComponent business units', () => {
  let http: HttpTestingController;

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  async function setup(permissions: string[] = [...ALL_PERMISSIONS]) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorToastInterceptor])),
        provideHttpClientTesting(),
        provideFakeAuth(fakeUser({ permissions })),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LocationsPageComponent);
    fixture.detectChanges();
    const canViewUnits = permissions.includes(Permission.BusinessUnitsView);
    if (canViewUnits) {
      http.expectOne((r) => r.url === '/api/v1/business-units').flush(page([NORTH]));
    } else {
      http.expectNone((r) => r.url === '/api/v1/business-units');
    }
    http.expectOne((r) => r.url === '/api/v1/plants').flush(page([PLANT]));
    http.expectOne((r) => r.url === '/api/v1/areas').flush(page([]));
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      page: fixture.componentInstance as unknown as PageApi,
    };
  }

  it('shows the business unit of each plant', async () => {
    const { el, page: cmp } = await setup();
    expect(cmp.unitName(PLANT)).toBe('North Branch (NORTH)');
    expect(el.textContent).toContain('Business unit: North Branch (NORTH)');
  });

  it('creates a plant in the chosen business unit', async () => {
    const { page: cmp } = await setup();
    cmp.openCreatePlantModal();
    cmp.plantForm.name = 'Pune Plant';
    cmp.plantForm.code = 'P-02';
    cmp.plantForm.business_unit_id = 3;
    cmp.savePlant();
    const create = http.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/plants');
    expect(create.request.body.business_unit_id).toBe(3);
    create.flush(single({ ...PLANT, id: 11, code: 'P-02', name: 'Pune Plant' }));
  });

  it('moves a plant out of its business unit on edit', async () => {
    const { page: cmp } = await setup();
    cmp.openEditPlantModal(PLANT);
    expect(cmp.plantForm.business_unit_id).toBe(3);
    cmp.plantForm.business_unit_id = null;
    cmp.savePlant();
    const update = http.expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/plants/10');
    expect(update.request.body.business_unit_id).toBeNull();
    update.flush(single({ ...PLANT, business_unit_id: null }));
  });

  it('leaves the business unit alone for users who cannot see units', async () => {
    const permissions = ALL_PERMISSIONS.filter((p) => !p.startsWith('business_units:'));
    const { page: cmp } = await setup(permissions);
    cmp.openEditPlantModal(PLANT);
    cmp.savePlant();
    const update = http.expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/plants/10');
    expect('business_unit_id' in update.request.body).toBe(false);
    update.flush(single(PLANT));
  });
});
