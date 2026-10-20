import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { errorToastInterceptor } from '../../core/api/error-toast.interceptor';
import { Permission } from '../../core/auth/permissions';
import { fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { BusinessUnit } from '../../core/models';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { BusinessUnitsPageComponent } from './business-units-page.component';

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
  description: 'Delhi and Punjab plants',
  status: 'active',
  plants: 2,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};
const EMPTY: BusinessUnit = { ...NORTH, id: 4, code: 'SOUTH', name: 'South Branch', plants: 0 };

interface PageApi {
  openCreate(): void;
  openEdit(u: BusinessUnit): void;
  save(): void;
  form: { company_id: number | null; name: string; code: string; description: string };
}

describe('BusinessUnitsPageComponent', () => {
  let http: HttpTestingController;

  async function setup(permissions?: string[]) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorToastInterceptor])),
        provideHttpClientTesting(),
        provideFakeAuth(fakeUser(permissions ? { permissions } : {})),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BusinessUnitsPageComponent);
    fixture.detectChanges();
    const list = http.expectOne((r) => r.url === '/api/v1/business-units');
    expect(list.request.params.getAll('status')).toEqual(['active', 'inactive']);
    list.flush(page([NORTH, EMPTY]));
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
      page: fixture.componentInstance as unknown as PageApi,
    };
  }

  afterEach(() => http.verify());

  it('lists code, name, plant count and status', async () => {
    const { el } = await setup();
    const cells = Array.from(el.querySelectorAll('tbody tr:first-child td')).map((td) =>
      td.textContent?.trim(),
    );
    expect(cells[0]).toBe('NORTH');
    expect(cells[1]).toContain('North Branch');
    expect(cells[2]).toBe('2');
    expect(el.querySelector('tbody app-status-pill')?.textContent?.trim()).toBe('Active');
  });

  it('disables delete while the unit still has plants', async () => {
    const { el } = await setup();
    const deleteOf = (row: number) =>
      Array.from(el.querySelectorAll(`tbody tr:nth-child(${row}) button`)).find((b) =>
        b.textContent?.includes('Delete'),
      ) as HTMLButtonElement;
    expect(deleteOf(1).disabled).toBe(true);
    expect(deleteOf(2).disabled).toBe(false);
  });

  it('creates a business unit without sending a company for a company user', async () => {
    const { page: cmp } = await setup();
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    cmp.openCreate();
    cmp.form.name = ' West Branch ';
    cmp.form.code = 'WEST';
    cmp.save();
    const create = http.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/business-units');
    expect(create.request.body).toEqual({
      name: 'West Branch',
      code: 'WEST',
      description: null,
      company_id: undefined,
    });
    create.flush(single({ ...EMPTY, id: 9, code: 'WEST', name: 'West Branch' }));
    expect(success).toHaveBeenCalledWith('Business unit "West Branch" created.');
  });

  it('refuses an invalid code without calling the API', async () => {
    const { page: cmp } = await setup();
    cmp.openCreate();
    cmp.form.name = 'Bad';
    cmp.form.code = 'has space';
    cmp.save();
    http.expectNone((r) => r.method === 'POST');
  });

  it('updates name, code and description', async () => {
    const { page: cmp } = await setup();
    cmp.openEdit(NORTH);
    cmp.form.description = '';
    cmp.save();
    const update = http.expectOne(
      (r) => r.method === 'PATCH' && r.url === '/api/v1/business-units/3',
    );
    expect(update.request.body).toEqual({ name: 'North Branch', code: 'NORTH', description: null });
    update.flush(single({ ...NORTH, description: null }));
  });

  it('hides the change actions from read-only users', async () => {
    const { el } = await setup([Permission.BusinessUnitsView]);
    expect(el.querySelectorAll('tbody button').length).toBe(0);
    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent ?? '');
    expect(buttons.some((t) => t.includes('New Business Unit'))).toBe(false);
  });
});
