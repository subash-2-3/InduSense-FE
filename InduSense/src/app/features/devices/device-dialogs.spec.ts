import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Device, DeviceConnection, Tag } from '../../core/models';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DeviceConnectionsDialogComponent } from './device-connections-dialog.component';
import { DeviceTagsDialogComponent } from './device-tags-dialog.component';

const single = <T>(data: T) => ({ success: true, data });
const page = <T>(data: T[]) => ({
  success: true,
  data,
  pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 },
});

const DEVICE = { id: 3, external_id: '10007364', name: 'V-BOX' } as Device;
const TAG: Tag = {
  id: 11,
  device_id: 3,
  tag_name: 'Counter',
  display_name: null,
  data_type: null,
  unit: null,
  category: null,
  is_counter: false,
  is_cumulative: false,
  status: 'active',
  data_id: null,
  monitor_id: 5,
  register_address: null,
  code: null,
  tag_type: 'ems',
  roundoff_digits: null,
  description: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('device dialogs', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists a device’s tags and switches one off', async () => {
    const fixture = TestBed.createComponent(DeviceTagsDialogComponent);
    fixture.componentRef.setInput('device', DEVICE);
    fixture.detectChanges();
    const list = http.expectOne((r) => r.url === '/api/v1/tags');
    expect(list.request.params.get('device_id')).toBe('3');
    expect(list.request.params.getAll('status')).toEqual(['active', 'inactive']);
    list.flush(page([TAG]));
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Counter');

    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    (fixture.componentInstance as unknown as { toggle(t: Tag): void }).toggle(TAG);
    const patch = http.expectOne('/api/v1/tags/11');
    expect(patch.request.body).toEqual({ status: 'inactive' });
    patch.flush(single({ ...TAG, status: 'inactive' }));
    expect(success.mock.calls[0][0]).toContain('no longer stored');
    fixture.destroy();
  });

  it('adds and deletes a connection without ever sending a credential', () => {
    const fixture = TestBed.createComponent(DeviceConnectionsDialogComponent);
    fixture.componentRef.setInput('device', DEVICE);
    fixture.detectChanges();
    http.expectOne('/api/v1/devices/3/connections').flush(single([]));

    const dialog = fixture.componentInstance as unknown as {
      form: { protocol: string; host: string; port: number | null; secret_ref: string };
      save(): void;
      remove(c: DeviceConnection): void;
    };
    dialog.form = { protocol: 'MQTT', host: '192.168.1.50', port: 1883, secret_ref: 'MQTT_LOGGER' };
    dialog.save();
    const create = http.expectOne((r) => r.method === 'POST');
    expect(create.request.body).toEqual({
      protocol: 'MQTT',
      host: '192.168.1.50',
      port: 1883,
      secret_ref: 'MQTT_LOGGER',
    });
    const saved = { id: 9, device_id: 3, protocol: 'MQTT', status: 'active' } as DeviceConnection;
    create.flush(single(saved));

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    dialog.remove(saved);
    http
      .expectOne((r) => r.method === 'DELETE' && r.url === '/api/v1/devices/3/connections/9')
      .flush(null, {
        status: 204,
        statusText: 'No Content',
      });
    fixture.destroy();
  });
});
