import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { noop } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { DevicesApi } from '../../core/api/resources/devices.api';
import { Device, DeviceConnection } from '../../core/models';
import {
  ButtonComponent,
  IconComponent,
  ModalComponent,
  SearchableSelectComponent,
  SelectOption,
  SkeletonComponent,
  StatusPillComponent,
} from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  recordStatusLabel,
  recordStatusTone,
  toggledStatus,
} from '../../shared/utils/record-status';

interface ConnectionForm {
  protocol: string;
  host: string;
  port: number | null;
  secret_ref: string;
}

const PROTOCOLS = ['VNET', 'MQTT', 'MODBUS_TCP', 'MODBUS_RTU', 'OPCUA'];
const PROTOCOL_OPTIONS: SelectOption[] = PROTOCOLS.map((p) => ({ value: p, label: p }));

/**
 * How the DataLogger reaches a device: one connection per protocol. Credentials are never stored
 * here; `secret_ref` only names the credential the DataLogger keeps.
 */
@Component({
  selector: 'app-device-connections-dialog',
  imports: [
    FormsModule,
    ButtonComponent,
    IconComponent,
    ModalComponent,
    SearchableSelectComponent,
    SkeletonComponent,
    StatusPillComponent,
  ],
  template: `
    <app-modal
      [open]="device() !== null"
      [title]="'Connections of ' + (device()?.name || device()?.external_id || '')"
      subtitle="Protocol settings the DataLogger uses (no credentials: only their names)"
      maxWidth="820px"
      (close)="closed.emit()"
    >
      @if (loading()) {
        <app-skeleton height="80px" />
      } @else {
        @if (connections().length === 0) {
          <p class="empty">No connections configured.</p>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Protocol</th>
                <th scope="col">Host : port</th>
                <th scope="col">Secret name</th>
                <th scope="col">Status</th>
                <th scope="col" class="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of connections(); track c.id) {
                <tr>
                  <td class="mono">{{ c.protocol }}</td>
                  <td class="mono">{{ c.host || '—' }}{{ c.port ? ':' + c.port : '' }}</td>
                  <td class="mono">{{ c.secret_ref || '—' }}</td>
                  <td>
                    <app-status-pill
                      [label]="statusLabel(c.status)"
                      [tone]="statusTone(c.status)"
                    />
                  </td>
                  <td class="num">
                    <button
                      appButton
                      variant="ghost"
                      size="sm"
                      type="button"
                      [attr.aria-label]="'Edit ' + c.protocol + ' connection'"
                      (click)="edit(c)"
                    >
                      <app-icon name="edit" [size]="14" />
                    </button>
                    <button appButton variant="ghost" size="sm" type="button" (click)="toggle(c)">
                      {{ c.status === 'active' ? 'Deactivate' : 'Activate' }}
                    </button>
                    <button
                      appButton
                      variant="ghost"
                      size="sm"
                      type="button"
                      [attr.aria-label]="'Delete ' + c.protocol + ' connection'"
                      (click)="remove(c)"
                    >
                      <app-icon name="x" [size]="14" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }

        <form class="form" (ngSubmit)="save()">
          <h3 class="form__title">
            {{ editing() ? 'Edit ' + editing()!.protocol + ' connection' : 'Add a connection' }}
          </h3>
          <div class="form__row">
            <label>
              Protocol *
              <app-searchable-select
                ariaLabel="Protocol"
                [options]="protocolOptions"
                [(ngModel)]="form.protocol"
                [disabled]="editing() !== null"
                name="protocol"
              />
            </label>
            <label>
              Host
              <input class="field" name="host" maxlength="255" [(ngModel)]="form.host" />
            </label>
            <label>
              Port
              <input
                class="field"
                name="port"
                type="number"
                min="1"
                max="65535"
                [(ngModel)]="form.port"
              />
            </label>
            <label>
              Secret name
              <input
                class="field"
                name="secret_ref"
                maxlength="200"
                placeholder="e.g. VNET_ACCOUNT_A"
                [(ngModel)]="form.secret_ref"
              />
            </label>
          </div>
          <div class="form__actions">
            @if (editing()) {
              <button appButton variant="secondary" type="button" (click)="reset()">Cancel</button>
            }
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="saving() || !form.protocol"
            >
              {{ editing() ? 'Save connection' : 'Add connection' }}
            </button>
          </div>
        </form>
      }
    </app-modal>
  `,
  styles: `
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--fs-sm);
      text-align: left;
    }
    .table th,
    .table td {
      padding: var(--space-2);
      border-bottom: 1px solid var(--border-card);
    }
    .table th {
      color: var(--text-secondary);
      font-size: var(--fs-xs);
      text-transform: uppercase;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .mono {
      font-family: var(--font-mono);
    }
    .empty {
      color: var(--text-secondary);
    }
    .form {
      margin-top: var(--space-4);
      padding-top: var(--space-3);
      border-top: 1px solid var(--border-card);
    }
    .form__title {
      margin: 0 0 var(--space-2);
      font-size: var(--fs-md);
    }
    .form__row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--space-3);
      color: var(--text-secondary);
      font-size: var(--fs-sm);
    }
    .form__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }
    .field {
      display: block;
      width: 100%;
      height: 34px;
      margin-top: var(--space-1);
      padding: 0 var(--space-2);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--bg-card);
      color: var(--text-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceConnectionsDialogComponent {
  private readonly api = inject(DevicesApi);
  private readonly toast = inject(ToastService);

  readonly device = input<Device | null>(null);
  readonly closed = output<void>();

  protected readonly protocolOptions = PROTOCOL_OPTIONS;
  protected readonly statusLabel = recordStatusLabel;
  protected readonly statusTone = recordStatusTone;
  protected readonly connections = signal<DeviceConnection[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<DeviceConnection | null>(null);
  protected form: ConnectionForm = this.blank();

  constructor() {
    effect(() => {
      const device = this.device();
      this.connections.set([]);
      this.reset();
      if (device) this.load(device.id);
    });
  }

  private load(deviceId: number): void {
    this.loading.set(true);
    this.api.listConnections(deviceId).subscribe({
      next: (connections) => {
        this.connections.set(connections);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err, 'Unable to load the connections.');
      },
    });
  }

  protected edit(c: DeviceConnection): void {
    this.editing.set(c);
    this.form = {
      protocol: c.protocol,
      host: c.host ?? '',
      port: c.port,
      secret_ref: c.secret_ref ?? '',
    };
  }

  protected reset(): void {
    this.editing.set(null);
    this.form = this.blank();
  }

  protected save(): void {
    const device = this.device();
    if (!device) return;
    const values = {
      host: this.form.host.trim() || null,
      port: this.form.port || null,
      secret_ref: this.form.secret_ref.trim() || null,
    };
    const editing = this.editing();
    const request = editing
      ? this.api.updateConnection(device.id, editing.id, values)
      : this.api.createConnection(device.id, { protocol: this.form.protocol, ...values });
    this.saving.set(true);
    request.subscribe({
      next: (saved) => {
        this.connections.update((list) =>
          editing ? list.map((c) => (c.id === saved.id ? saved : c)) : [...list, saved],
        );
        this.saving.set(false);
        this.toast.success(`${saved.protocol} connection ${editing ? 'updated' : 'added'}.`);
        this.reset();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected toggle(c: DeviceConnection): void {
    const device = this.device();
    if (!device) return;
    this.api.updateConnection(device.id, c.id, { status: toggledStatus(c.status) }).subscribe({
      next: (saved) => {
        this.connections.update((list) => list.map((x) => (x.id === saved.id ? saved : x)));
        this.toast.success(
          `${c.protocol} connection ${saved.status === 'active' ? 'activated' : 'deactivated'}.`,
        );
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  protected remove(c: DeviceConnection): void {
    const device = this.device();
    if (!device || !confirm(`Delete the ${c.protocol} connection?`)) return;
    this.api.deleteConnection(device.id, c.id).subscribe({
      next: () => {
        this.connections.update((list) => list.filter((x) => x.id !== c.id));
        this.toast.success(`${c.protocol} connection deleted.`);
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  private blank(): ConnectionForm {
    return { protocol: 'MQTT', host: '', port: null, secret_ref: '' };
  }
}
