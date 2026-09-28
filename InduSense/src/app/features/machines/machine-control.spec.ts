import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { errorToastInterceptor } from '../../core/api/error-toast.interceptor';
import { provideFakeAuth } from '../../core/auth/testing';
import { ControlTag, DeviceCommand, MachineControls } from '../../core/models';
import { parseWriteValues } from '../tags/tag-rules';
import { actionsFor, commandSummary, isOpen } from './machine-control';
import { MachineControlDialogComponent } from './machine-control-dialog.component';

const NOW = new Date().toISOString();
const ok = <T>(data: T) => ({ success: true, data });

function control(overrides: Partial<ControlTag>): ControlTag {
  return {
    tag_id: 1,
    tag_name: 'alarm_reset',
    code: 'alarm_reset',
    label: 'Alarm Reset',
    register_address: '40254',
    write_mode: 'pulse',
    write_values: [1],
    value: 0,
    value_at: NOW,
    last_command: null,
    ...overrides,
  };
}

function command(overrides: Partial<DeviceCommand>): DeviceCommand {
  return {
    id: 9,
    device_id: 4,
    tag_id: 1,
    tag_name: 'alarm_reset',
    label: 'Alarm Reset',
    value: 1,
    state: 'pending',
    requested_by: 1,
    requested_by_email: 'op@acme.test',
    requested_at: NOW,
    expires_at: NOW,
    picked_at: null,
    completed_at: null,
    readback: null,
    error: null,
    ...overrides,
  };
}

const START_STOP = control({
  tag_id: 2,
  tag_name: 'start_stop',
  code: 'start_stop',
  label: 'Start / Stop',
  register_address: '40251',
});
const INTERLOCK = control({
  tag_id: 3,
  tag_name: 'machine_interlock',
  code: 'machine_interlock',
  label: 'Machine Interlock',
  register_address: '40252',
  write_mode: 'latched',
  write_values: [0, 1],
  value: 1,
});

describe('machine control actions', () => {
  it('toggles Start/Stop by the machine state', () => {
    const [start] = actionsFor(START_STOP, 'ALARM', 'Press 1');
    expect(start).toMatchObject({ value: 1, label: 'Start machine' });
    expect(start.confirm).toContain('Start "Press 1"');
    const [stop] = actionsFor(START_STOP, 'RUNNING', 'Press 1');
    expect(stop.label).toBe('Stop machine');
  });

  it('offers resets as one button and latched values as on/off', () => {
    expect(actionsFor(control({}), 'ALARM', 'M').map((a) => a.label)).toEqual(['Alarm Reset']);
    const [off, on] = actionsFor(INTERLOCK, 'ALARM', 'M');
    expect([off.label, on.label]).toEqual(['Off', 'On']);
    expect(on.current).toBe(true);
    expect(off.confirm).toContain('may start');
    expect(on.confirm).toContain('blocked');
  });

  it('describes command progress', () => {
    expect(commandSummary(command({})).text).toContain('Waiting for the DataLogger');
    expect(commandSummary(command({ state: 'done', readback: 0 }))).toEqual({
      text: 'Done by op@acme.test · read back 0',
      tone: 'running',
    });
    expect(commandSummary(command({ state: 'failed', error: 'timed out' })).text).toBe(
      'Failed: timed out',
    );
    expect(commandSummary(command({ state: 'expired' })).text).toContain('is writing enabled');
    expect(isOpen(command({ state: 'sent' }))).toBe(true);
    expect(isOpen(command({ state: 'done' }))).toBe(false);
  });

  it('parses allowed write values', () => {
    expect(parseWriteValues('1, 0 1')).toEqual({ values: [0, 1], error: null });
    expect(parseWriteValues('')).toEqual({ values: null, error: null });
    expect(parseWriteValues('70000').error).toContain('0 to 65535');
  });
});

describe('MachineControlDialogComponent', () => {
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

  async function open(panel: Partial<MachineControls> = {}) {
    const fixture = TestBed.createComponent(MachineControlDialogComponent);
    fixture.componentRef.setInput('machineId', 3);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r)); // timer(0) of the refresh stream
    http
      .expectOne((r) => r.url === '/api/v1/machines/3/controls')
      .flush(
        ok({
          machine_id: 3,
          machine_code: 'DELTA-PLC-M1',
          machine_name: 'Delta PLC Machine',
          state: { status: 'ALARM', source: 'telemetry', last_data_at: NOW },
          device_id: 4,
          device_name: 'Delta PLC',
          can_write: true,
          controls: [START_STOP, INTERLOCK, control({ last_command: command({ state: 'sent' }) })],
          notes: [],
          ...panel,
        }),
      );
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const button = (el: HTMLElement, label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    )!;

  it('confirms, then queues the command', async () => {
    const { fixture, el } = await open();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    button(el, 'Start machine').click();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Start "Delta PLC Machine"'));
    const req = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/api/v1/devices/4/commands',
    );
    expect(req.request.body).toEqual({ tag_id: 2, value: 1 });
    req.flush(ok(command({ tag_id: 2, label: 'Start / Stop' })));
    fixture.detectChanges();
    expect(button(el, 'Start machine').disabled).toBe(true); // waiting for the result
    fixture.destroy();
  });

  it('sends nothing when not confirmed, and blocks busy or current values', async () => {
    const { fixture, el } = await open();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    button(el, 'Off').click();
    http.expectNone((r) => r.method === 'POST');
    expect(button(el, 'On').disabled).toBe(true); // already on
    expect(button(el, 'Alarm Reset').disabled).toBe(true); // a command is in progress
    expect(el.textContent).toContain('Writing to the PLC');
    fixture.destroy();
  });

  it('disables every control when the device cannot be written', async () => {
    const { fixture, el } = await open({ can_write: false, notes: ['commands cannot be sent'] });
    expect(button(el, 'Start machine').disabled).toBe(true);
    expect(el.textContent).toContain('commands cannot be sent');
    fixture.destroy();
  });
});
