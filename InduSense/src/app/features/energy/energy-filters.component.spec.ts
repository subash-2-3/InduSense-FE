import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Permission } from '../../core/auth/permissions';
import { ALL_PERMISSIONS, fakeUser, provideFakeAuth } from '../../core/auth/testing';
import { BusinessUnit, Plant } from '../../core/models';
import { EnergyFilterState, EnergyFiltersComponent } from './energy-filters.component';

const list = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});

const unit = (id: number, name: string): BusinessUnit => ({
  id,
  company_id: 1,
  code: name.toUpperCase(),
  name,
  description: null,
  status: 'active',
  plants: 1,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});
const plant = (id: number, name: string, business_unit_id: number | null): Plant => ({
  id,
  company_id: 1,
  business_unit_id,
  code: `P${id}`,
  name,
  address: null,
  timezone: null,
  status: 'active',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});
const meter = (id: number, plant_id: number) => ({
  id,
  company_id: 1,
  plant_id,
  area_id: null,
  name: `EM ${id}`,
});

interface FiltersApi {
  setUnit(id: number | null): void;
  setPlant(id: number | null): void;
  plantOptions(): { value: number; label: string }[];
  meterOptions(): { value: number; label: string }[];
  plantId(): number | null;
}

describe('EnergyFiltersComponent business unit', () => {
  let http: HttpTestingController;

  function setup(permissions: string[] = [...ALL_PERMISSIONS]) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeAuth(fakeUser({ permissions })),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EnergyFiltersComponent);
    const states: EnergyFilterState[] = [];
    fixture.componentInstance.changed.subscribe((s) => states.push(s));
    fixture.detectChanges();
    if (permissions.includes(Permission.BusinessUnitsView)) {
      http
        .expectOne((r) => r.url === '/api/v1/business-units')
        .flush(list([unit(1, 'North'), unit(2, 'South')]));
    }
    http
      .expectOne((r) => r.url === '/api/v1/plants')
      .flush(list([plant(10, 'Chennai', 1), plant(11, 'Madurai', 2), plant(12, 'Pune', null)]));
    http
      .expectOne((r) => r.url === '/api/v1/meters')
      .flush(list([meter(100, 10), meter(101, 11), meter(102, 12)]));
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      cmp: fixture.componentInstance as unknown as FiltersApi,
      states,
    };
  }

  afterEach(() => http.verify());

  it('narrows plants and meters to the unit and sends business_unit_id', () => {
    const { el, cmp, states } = setup();
    expect(el.textContent).toContain('Business Unit');
    expect(cmp.plantOptions().length).toBe(3);

    cmp.setUnit(1);
    expect(cmp.plantOptions().map((o) => o.label)).toEqual(['Chennai']);
    expect(cmp.meterOptions().map((o) => o.value)).toEqual([100]);
    expect(states.at(-1)?.scope).toEqual({ business_unit_id: 1 });

    cmp.setPlant(10);
    http.expectOne((r) => r.url === '/api/v1/areas').flush(list([]));
    expect(states.at(-1)?.scope).toEqual({ business_unit_id: 1, plant_id: 10 });

    cmp.setUnit(2); // another unit clears the plant
    expect(cmp.plantId()).toBeNull();
    expect(states.at(-1)?.scope).toEqual({ business_unit_id: 2 });

    cmp.setUnit(null);
    expect(states.at(-1)?.scope).toEqual({});
  });

  it('hides the picker from users who cannot view business units', () => {
    const { el } = setup(ALL_PERMISSIONS.filter((p) => !p.startsWith('business_units:')));
    expect(el.textContent).not.toContain('Business Unit');
  });
});
