import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Company, CompanyLimitUsage, LIMITED_RESOURCES } from '../../core/models';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { CompaniesPageComponent } from './companies-page.component';

const single = <T>(data: T) => ({ success: true, data });
const page = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});

const ACME: Company = {
  id: 7,
  code: 'ACME',
  name: 'Acme',
  address: null,
  timezone: 'UTC',
  status: 'active',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const usage = (plants: number | null): CompanyLimitUsage[] =>
  LIMITED_RESOURCES.map((resource) => ({
    resource,
    limit: resource === 'plants' ? plants : null,
    used: resource === 'plants' ? 2 : 0,
  }));

describe('CompaniesPageComponent', () => {
  let http: HttpTestingController;

  async function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CompaniesPageComponent);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/modules')
      .flush(single([{ id: 1, code: 'EMS', name: 'Energy', description: null, status: 'active' }]));
    const list = http.expectOne((r) => r.url === '/api/v1/companies');
    expect(list.request.params.getAll('status')).toEqual(['active', 'inactive']);
    list.flush(page([ACME]));
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, page: fixture.componentInstance };
  }

  afterEach(() => http.verify());

  it('lists companies with a status label', async () => {
    const { el } = await setup();
    expect(el.querySelector('tbody td.mono')?.textContent?.trim()).toBe('ACME');
    expect(el.querySelector('tbody app-status-pill')?.textContent?.trim()).toBe('Active');
  });

  it('creates a company with limits and modules in one request', async () => {
    const { page: cmp } = await setup();
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    const p = cmp as unknown as {
      openCreate(): void;
      save(): void;
      form: { code: string; name: string; limits: Record<string, string>; modules: Set<string> };
    };
    p.openCreate();
    p.form.code = 'new-co';
    p.form.name = 'New Co';
    p.form.limits['plants'] = '5';
    p.form.limits['machines'] = '';
    p.form.modules.add('EMS');
    p.save();

    const create = http.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/companies');
    expect(create.request.body).toEqual({
      code: 'NEW-CO',
      name: 'New Co',
      address: null,
      timezone: 'UTC',
      limits: { plants: 5 },
      module_codes: ['EMS'],
    });
    create.flush(single({ ...ACME, id: 8, code: 'NEW-CO', name: 'New Co' }));
    expect(success).toHaveBeenCalledWith('Company "New Co" created.');
    http.expectOne((r) => r.url === '/api/v1/companies').flush(page([ACME]));
  });

  it('sends only what changed when editing', async () => {
    const { page: cmp } = await setup();
    const p = cmp as unknown as {
      openEdit(c: Company): void;
      save(): void;
      usageOf(r: string): CompanyLimitUsage | undefined;
      form: { limits: Record<string, string>; modules: Set<string> };
    };
    p.openEdit(ACME);
    http.expectOne('/api/v1/companies/7/limits').flush(single(usage(5)));
    http.expectOne('/api/v1/companies/7/modules').flush(single(['EMS']));
    expect(p.usageOf('plants')).toEqual({ resource: 'plants', limit: 5, used: 2 });
    expect(p.form.limits['plants']).toBe('5');

    p.form.limits['plants'] = '';
    p.save();
    const limits = http.expectOne(
      (r) => r.method === 'PUT' && r.url === '/api/v1/companies/7/limits',
    );
    expect(limits.request.body).toEqual({ limits: { plants: null } });
    limits.flush(single(usage(null)));
    http.expectOne((r) => r.url === '/api/v1/companies').flush(page([ACME]));
  });

  it('shows the backend message when a limit blocks an action', async () => {
    const { page: cmp } = await setup();
    const error = vi.spyOn(TestBed.inject(ToastService), 'error');
    (cmp as unknown as { toggleStatus(c: Company): void }).toggleStatus({
      ...ACME,
      status: 'inactive',
    });
    http.expectOne('/api/v1/companies/7').flush(
      {
        success: false,
        code: 'RESOURCE_LIMIT_REACHED',
        message: 'This company has reached its maximum plant limit (5).',
      },
      { status: 409, statusText: 'Conflict' },
    );
    const [err] = error.mock.calls[0];
    expect((err as Error).message).toBe('This company has reached its maximum plant limit (5).');
  });
});
