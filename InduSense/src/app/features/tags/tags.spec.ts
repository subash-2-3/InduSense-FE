import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { errorToastInterceptor } from '../../core/api/error-toast.interceptor';
import { provideFakeAuth } from '../../core/auth/testing';
import { Device, Tag, TagMetadata } from '../../core/models';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatValue } from '../energy/energy-charts';
import { DefaultTagsPickerComponent } from './default-tags-picker.component';
import { TagFormDialogComponent, applyDefinition, emptyForm } from './tag-form-dialog.component';
import { formatWithRoundoff, roundoffError, roundoffValue, tagTypeLabel } from './tag-rules';
import { TagsPageComponent } from './tags-page.component';

const ok = <T>(data: T) => ({ success: true, data });
const page = <T>(data: T[], total = data.length) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 25, total, total_pages: Math.max(1, Math.ceil(total / 25)) },
});

const METADATA: TagMetadata = {
  tag_types: [
    { value: 'ems', label: 'EMS — Energy Management' },
    { value: 'oee', label: 'OEE — Overall Equipment Effectiveness' },
  ],
  roundoff_max: 6,
  value_kinds: ['float', 'integer', 'boolean', 'string'],
  definitions: [
    def(1, 'voltage', 'Voltage', 'ems', 'V', 2),
    def(2, 'power_factor', 'Power Factor', 'ems', null, 3),
    def(3, 'good_count', 'Good Count', 'oee', 'count', null, true),
  ],
};

function def(
  id: number,
  code: string,
  name: string,
  type: string,
  unit: string | null,
  digits: number | null,
  counter = false,
) {
  return {
    id,
    code,
    display_name: name,
    tag_type: type,
    value_kind: digits === null ? ('integer' as const) : ('float' as const),
    unit,
    category: null,
    roundoff_digits: digits,
    description: `${name} description`,
    metric: null,
    is_counter: counter,
    is_cumulative: counter,
    sort_order: id * 10,
    status: 'active' as const,
  };
}

const DEVICE = { id: 9, name: 'Delta PLC', external_id: 'PLC-1', status: 'active' } as Device;

function tag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 1,
    device_id: 9,
    tag_name: 'Voltage',
    code: 'voltage',
    display_name: 'Voltage',
    tag_type: 'ems',
    data_type: 'float32',
    unit: 'V',
    category: null,
    roundoff_digits: 2,
    description: null,
    is_counter: false,
    is_cumulative: false,
    status: 'active',
    data_id: null,
    monitor_id: null,
    register_address: '40241',
    created_at: '2026-09-28T00:00:00Z',
    updated_at: '2026-09-28T00:00:00Z',
    ...overrides,
  };
}

// ------------------------------------------------------------------------ rules ----

describe('tag rules', () => {
  it('validates round-off digits like the backend', () => {
    expect(roundoffError('', 'uint32', 6)).toBeNull();
    expect(roundoffError('2', 'float32', 6)).toBeNull();
    expect(roundoffError('3', null, 6)).toBeNull(); // connection default may be a float
    expect(roundoffError('0', 'uint32', 6)).toBeNull();
    expect(roundoffError('2', 'uint32', 6)).toContain('floating-point');
    expect(roundoffError('7', 'float32', 6)).toBe('At most 6 decimals.');
    expect(roundoffError('-1', 'float32', 6)).toContain('whole number');
    expect(roundoffError('1.5', 'float32', 6)).toContain('whole number');
    expect(roundoffValue('')).toBeNull();
    expect(roundoffValue('3')).toBe(3);
  });

  it('rounds for display only', () => {
    expect(formatWithRoundoff(12.567891, 2)).toBe('12.57');
    expect(formatWithRoundoff(0.94512, 3)).toBe('0.945');
    expect(formatWithRoundoff(12.567891, null)).toBe('12.567891');
    expect(formatValue(415.2345, 'V', 2)).toBe('415.23 V');
    expect(formatValue(50, 'Hz', 2)).toBe('50.00 Hz');
  });

  it('labels tag types from the backend options', () => {
    expect(tagTypeLabel(METADATA.tag_types, 'oee')).toBe('OEE');
    expect(tagTypeLabel(METADATA.tag_types, 'future')).toBe('FUTURE');
  });

  it('fills the form from a default definition', () => {
    const form = applyDefinition(emptyForm('ems', 9), METADATA.definitions[1]);
    expect(form).toMatchObject({
      code: 'power_factor',
      tag_name: 'power_factor',
      display_name: 'Power Factor',
      roundoff: '3',
      unit: '',
      device_id: 9,
    });
  });
});

// ------------------------------------------------------------------ tags page ----

describe('TagsPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorToastInterceptor])),
        provideHttpClientTesting(),
        ...provideFakeAuth(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function setup(
    tags: Tag[] = [
      tag(),
      tag({
        id: 2,
        tag_name: 'GOOD',
        code: 'good_count',
        tag_type: 'oee',
        display_name: 'Good',
        roundoff_digits: null,
        data_type: 'uint32',
      }),
    ],
  ) {
    const fixture = TestBed.createComponent(TagsPageComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/tag-definitions').flush(ok(METADATA));
    http.expectOne((r) => r.url === '/api/v1/devices').flush(page([DEVICE]));
    const list = http.expectOne((r) => r.url === '/api/v1/tags');
    expect(list.request.params.getAll('status')).toEqual(['active', 'inactive']);
    list.flush(page(tags));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, cmp: fixture.componentInstance };
  }

  it('lists tags with type, device and decimals', async () => {
    const { el } = await setup();
    const rows = [...el.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Delta PLC');
    expect(rows[0].querySelector('.badge')?.textContent?.trim()).toBe('EMS');
    expect(rows[1].querySelector('.badge')?.textContent?.trim()).toBe('OEE');
    expect(rows[0].querySelectorAll('td')[6].textContent?.trim()).toBe('2');
  });

  it('filters by tag type, device, status and search', async () => {
    const { el, fixture } = await setup();
    const selects = el.querySelectorAll<HTMLSelectElement>('.filters select');
    selects[0].value = selects[0].options[2].value; // OEE
    selects[0].dispatchEvent(new Event('change'));
    let req = http.expectOne((r) => r.url === '/api/v1/tags');
    expect(req.request.params.get('tag_type')).toBe('oee');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page([]));
    selects[1].value = selects[1].options[1].value; // the device
    selects[1].dispatchEvent(new Event('change'));
    req = http.expectOne((r) => r.url === '/api/v1/tags');
    expect(req.request.params.get('device_id')).toBe('9');
    req.flush(page([]));
    selects[2].value = 'delete';
    selects[2].dispatchEvent(new Event('change'));
    req = http.expectOne((r) => r.url === '/api/v1/tags');
    expect(req.request.params.getAll('status')).toEqual(['delete']);
    req.flush(page([]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('app-empty-state')).not.toBeNull();
  });

  it('soft deletes after confirmation and reloads', async () => {
    const { el } = await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    const del = [...el.querySelectorAll<HTMLButtonElement>('tbody button')].find(
      (b) => b.textContent?.trim() === 'Delete',
    )!;
    del.click();
    const req = http.expectOne((r) => r.method === 'DELETE' && r.url === '/api/v1/tags/1');
    req.flush(ok(tag({ status: 'delete' })));
    expect(success).toHaveBeenCalledWith('Tag "Voltage" deleted.');
    http.expectOne((r) => r.url === '/api/v1/tags').flush(page([]));
  });

  it('toasts API errors of changes', async () => {
    const { el } = await setup();
    const error = vi.spyOn(TestBed.inject(ToastService), 'error');
    const toggle = [...el.querySelectorAll<HTMLButtonElement>('tbody button')].find(
      (b) => b.textContent?.trim() === 'Deactivate',
    )!;
    toggle.click();
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush(
        { success: false, code: 'DEVICE_INACTIVE', message: 'The device is not active' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(error).toHaveBeenCalled();
  });

  it('shows a load error with retry', async () => {
    const fixture = TestBed.createComponent(TagsPageComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/tag-definitions').flush(ok(METADATA));
    http.expectOne((r) => r.url === '/api/v1/devices').flush(page([DEVICE]));
    http
      .expectOne((r) => r.url === '/api/v1/tags')
      .flush(
        { success: false, code: 'INTERNAL_ERROR', message: 'Boom' },
        { status: 500, statusText: 'Error' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-error-state')?.textContent,
    ).toContain('Boom');
  });
});

// ------------------------------------------------------------------- form ----

describe('TagFormDialogComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorToastInterceptor])),
        provideHttpClientTesting(),
        ...provideFakeAuth(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open(existing: Tag | null = null) {
    const fixture = TestBed.createComponent(TagFormDialogComponent);
    fixture.componentRef.setInput('devices', [DEVICE]);
    fixture.componentRef.setInput('metadata', METADATA);
    fixture.componentRef.setInput('deviceId', 9);
    fixture.componentRef.setInput('tag', existing);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      form: ReturnType<typeof emptyForm>;
      save(): void;
      canSave(): boolean;
      errors(): { code?: string; roundoff?: string };
      setType(t: string): void;
      suggestions(): { code: string }[];
      useDefinition(d: unknown): void;
    };
    return { fixture, cmp };
  }

  it('creates an OEE tag from a default and suggests only that type', () => {
    const { cmp, fixture } = open();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    cmp.setType('oee');
    expect(cmp.suggestions().map((d) => d.code)).toEqual(['good_count']);
    cmp.useDefinition(METADATA.definitions[2]);
    cmp.form.tag_name = 'GOOD_CNT';
    cmp.form.data_type = 'uint32';
    expect(cmp.canSave()).toBe(true);
    cmp.save();
    const req = http.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/tags');
    expect(req.request.body).toMatchObject({
      device_id: 9,
      tag_name: 'GOOD_CNT',
      code: 'good_count',
      tag_type: 'oee',
      data_type: 'uint32',
      roundoff_digits: null,
      is_counter: true,
      status: 'active',
    });
    req.flush(ok(tag({ id: 5, tag_name: 'GOOD_CNT', tag_type: 'oee' })));
    expect(saved).toHaveBeenCalled();
  });

  it('blocks invalid round-off and codes', () => {
    const { cmp } = open();
    cmp.form.tag_name = 'x';
    cmp.form.data_type = 'int16';
    cmp.form.roundoff = '2';
    expect(cmp.errors().roundoff).toContain('floating-point');
    expect(cmp.canSave()).toBe(false);
    cmp.form.data_type = 'float32';
    cmp.form.roundoff = '9';
    expect(cmp.errors().roundoff).toBe('At most 6 decimals.');
    cmp.form.roundoff = '2';
    cmp.form.code = 'Bad Code';
    expect(cmp.errors().code).toBeTruthy();
    cmp.form.code = 'voltage';
    expect(cmp.canSave()).toBe(true);
  });

  it('edits without changing the tag name and shows server errors', () => {
    const { cmp, fixture } = open(tag());
    expect(cmp.form.tag_name).toBe('Voltage');
    cmp.form.roundoff = '1';
    cmp.save();
    const req = http.expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/tags/1');
    expect(req.request.body.tag_name).toBeUndefined();
    expect(req.request.body.roundoff_digits).toBe(1);
    req.flush(
      {
        success: false,
        code: 'TAG_CODE_TAKEN',
        message: 'The device already has a tag with this code',
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'already has a tag with this code',
    );
  });
});

// ---------------------------------------------------------------- default picker ----

describe('DefaultTagsPickerComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideFakeAuth()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('switches EMS/OEE lists and creates only the ticked defaults', async () => {
    const fixture = TestBed.createComponent(DefaultTagsPickerComponent);
    fixture.componentRef.setInput('deviceId', 9);
    fixture.componentRef.setInput('metadata', METADATA);
    fixture.componentRef.setInput('existingCodes', ['power_factor']);
    const added = vi.fn();
    fixture.componentInstance.added.subscribe(added);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const rows = () =>
      [...el.querySelectorAll('tbody tr')].map((r) => r.querySelector('strong')?.textContent);
    expect(rows()).toEqual(['Voltage', 'Power Factor']);
    const boxes = el.querySelectorAll<HTMLInputElement>('tbody input[type=checkbox]');
    expect(boxes[1].disabled).toBe(true); // already on the device
    boxes[0].click();
    fixture.detectChanges();
    const name = el.querySelector<HTMLInputElement>(
      'tbody input[aria-label="Tag name for Voltage"]',
    )!;
    name.value = 'V_L1';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    el.querySelectorAll<HTMLButtonElement>('.types__item')[1].click(); // OEE
    fixture.detectChanges();
    expect(rows()).toEqual(['Good Count']);

    el.querySelector<HTMLButtonElement>('.actions button')!.click();
    const req = http.expectOne((r) => r.url === '/api/v1/tags/from-definitions');
    expect(req.request.body).toEqual({
      device_id: 9,
      items: [{ code: 'voltage', tag_name: 'V_L1', register_address: null }],
    });
    req.flush(ok({ created: [tag()], restored: [], skipped: [] }));
    expect(added).toHaveBeenCalled();
  });
});
