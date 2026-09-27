import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ToastService } from '../../shared/ui/toast/toast.service';
import { AssetTagsDialogComponent, MappedAsset } from './asset-tags-dialog.component';

const single = <T>(data: T) => ({ success: true, data });
const page = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});

const MACHINE: MappedAsset = {
  kind: 'machine',
  id: 4,
  name: 'Press 1',
  company_id: 1,
  device_id: 3,
};
const tag = (id: number, tag_name: string) => ({ id, device_id: 3, tag_name, status: 'active' });

interface Dialog {
  rows(): { metric: string; deviceId: number | null; tagId: number | null }[];
  save(): void;
}

describe('AssetTagsDialogComponent', () => {
  let http: HttpTestingController;

  function open() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AssetTagsDialogComponent);
    fixture.componentRef.setInput('asset', MACHINE);
    fixture.detectChanges();
    http
      .expectOne('/api/v1/machines/4/tag-mappings')
      .flush(
        single([{ metric: 'PRODUCTION_COUNTER', tag_id: 11, device_id: 3, tag_name: 'Counter' }]),
      );
    http
      .expectOne((r) => r.url === '/api/v1/devices')
      .flush(
        page([
          { id: 3, company_id: 1, external_id: '10007364', name: 'V-BOX' },
          { id: 8, company_id: 2, external_id: 'OTHER', name: 'Other company' },
        ]),
      );
    const tags = http.expectOne((r) => r.url === '/api/v1/tags');
    expect(tags.request.params.get('device_id')).toBe('3');
    tags.flush(page([tag(11, 'Counter'), tag(12, 'Motor_On_Cnt')]));
    return { fixture, dialog: fixture.componentInstance as unknown as Dialog };
  }

  afterEach(() => http.verify());

  it('shows every machine metric, preselecting the current mapping and the asset’s device', () => {
    const { dialog, fixture } = open();
    const rows = dialog.rows();
    expect(rows.map((r) => r.metric)).toContain('RUN_STATUS');
    expect(rows.find((r) => r.metric === 'PRODUCTION_COUNTER')).toEqual({
      metric: 'PRODUCTION_COUNTER',
      deviceId: 3,
      tagId: 11,
    });
    expect(rows.find((r) => r.metric === 'POWER')?.deviceId).toBe(3); // the asset's own device
    expect(
      (fixture.componentInstance as unknown as { devices(): { id: number }[] }).devices(),
    ).toEqual([expect.objectContaining({ id: 3 })]); // other companies' devices are not offered
    fixture.destroy();
  });

  it('saves the mapped metrics with the device each tag was picked from', () => {
    const { dialog, fixture } = open();
    dialog.rows().find((r) => r.metric === 'RUN_STATUS')!.tagId = 12;
    dialog.save();
    const put = http.expectOne((r) => r.method === 'PUT');
    expect(put.request.body).toEqual({
      mappings: [
        { metric: 'PRODUCTION_COUNTER', tag_id: 11, device_id: 3 },
        { metric: 'RUN_STATUS', tag_id: 12, device_id: 3 },
      ],
    });
    put.flush(single([]));
    fixture.destroy();
  });

  it('shows the backend’s message when a tag is assigned twice', () => {
    const { dialog, fixture } = open();
    const error = vi.spyOn(TestBed.inject(ToastService), 'error');
    dialog.save();
    http
      .expectOne((r) => r.method === 'PUT')
      .flush(
        {
          success: false,
          code: 'ASSET_TAG_DUPLICATE',
          message: 'This tag is already assigned to the selected asset.',
          details: [],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    expect((error.mock.calls[0][0] as Error).message).toBe(
      'This tag is already assigned to the selected asset.',
    );
    fixture.destroy();
  });
});
