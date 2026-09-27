import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { DevicesApi } from '../../core/api/resources/devices.api';
import { MachinesApi, MetersApi } from '../../core/api/resources/plant-assets.api';
import { TagsApi } from '../../core/api/resources/tags.api';
import {
  Device,
  MACHINE_METRICS,
  METER_METRICS,
  Metric,
  Tag,
  TagMappingItem,
  TagMappingResponse,
} from '../../core/models';
import { ButtonComponent, ModalComponent, SkeletonComponent } from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { VISIBLE_STATUSES } from '../../shared/utils/record-status';

/** The machine or meter whose tags are configured. */
export interface MappedAsset {
  kind: 'machine' | 'meter';
  id: number;
  name: string;
  company_id: number;
  /** The asset's own data source, preselected for new mappings. */
  device_id: number | null;
}

interface Row {
  metric: Metric;
  deviceId: number | null;
  tagId: number | null;
}

/** What each metric means to dashboards and reports (never inferred from tag names). */
export const METRIC_HELP: Readonly<Record<Metric, { label: string; hint: string }>> = {
  PRODUCTION_COUNTER: { label: 'Production counter', hint: 'Cumulative count of produced parts' },
  RUN_STATUS: { label: 'Run status', hint: 'Non-zero while running, 0 when stopped' },
  POWER: { label: 'Active power', hint: 'Instantaneous power' },
  ENERGY: { label: 'Energy', hint: 'Cumulative energy register (e.g. kWh reading)' },
  VOLTAGE: { label: 'Voltage', hint: 'Instantaneous voltage' },
  CURRENT: { label: 'Current', hint: 'Instantaneous current' },
  FREQUENCY: { label: 'Frequency', hint: 'Instantaneous frequency' },
  POWER_FACTOR: { label: 'Power factor', hint: 'Instantaneous power factor' },
};

/**
 * Asset tags: which device tag measures which metric of a machine or meter. Dashboards and
 * reports read these mappings (asset -> metric -> tag -> telemetry).
 */
@Component({
  selector: 'app-asset-tags-dialog',
  imports: [FormsModule, ButtonComponent, ModalComponent, SkeletonComponent],
  template: `
    <app-modal
      [open]="asset() !== null"
      [title]="'Asset tags: ' + (asset()?.name ?? '')"
      subtitle="Pick the device tag that measures each metric; leave a metric empty if it has none"
      maxWidth="860px"
      (close)="closed.emit()"
    >
      @if (loading()) {
        <app-skeleton height="200px" />
      } @else {
        <form (ngSubmit)="save()">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Device</th>
                <th scope="col">Tag</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.metric) {
                <tr>
                  <th scope="row">
                    <span class="metric">{{ help[row.metric].label }}</span>
                    <span class="hint">{{ help[row.metric].hint }}</span>
                  </th>
                  <td>
                    <select
                      class="field"
                      [name]="'device-' + row.metric"
                      [attr.aria-label]="help[row.metric].label + ' device'"
                      [ngModel]="row.deviceId"
                      (ngModelChange)="selectDevice(row, $event)"
                    >
                      <option [ngValue]="null">—</option>
                      @for (d of devices(); track d.id) {
                        <option [ngValue]="d.id">
                          {{ d.name || d.external_id }} ({{ d.external_id }})
                        </option>
                      }
                    </select>
                  </td>
                  <td>
                    <select
                      class="field"
                      [name]="'tag-' + row.metric"
                      [attr.aria-label]="help[row.metric].label + ' tag'"
                      [disabled]="row.deviceId === null"
                      [(ngModel)]="row.tagId"
                    >
                      <option [ngValue]="null">Not mapped</option>
                      @for (t of tagsOf(row.deviceId); track t.id) {
                        <option [ngValue]="t.id">
                          {{ t.tag_name }}{{ t.display_name ? ' · ' + t.display_name : ''
                          }}{{ t.unit ? ' (' + t.unit + ')' : ''
                          }}{{ t.status !== 'active' ? ' [inactive]' : '' }}
                        </option>
                      }
                    </select>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <div class="actions">
            <button appButton variant="secondary" type="button" (click)="closed.emit()">
              Cancel
            </button>
            <button appButton variant="primary" type="submit" [disabled]="saving()">
              {{ saving() ? 'Saving…' : 'Save asset tags' }}
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
      vertical-align: middle;
    }
    thead th {
      color: var(--text-secondary);
      font-size: var(--fs-xs);
      text-transform: uppercase;
    }
    .metric {
      display: block;
      color: var(--text-primary);
      font-weight: var(--fw-semibold);
    }
    .hint {
      color: var(--text-muted);
      font-size: var(--fs-xs);
      font-weight: var(--fw-regular);
    }
    .field {
      width: 100%;
      height: 34px;
      padding: 0 var(--space-2);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--bg-card);
      color: var(--text-primary);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetTagsDialogComponent {
  private readonly machines = inject(MachinesApi);
  private readonly meters = inject(MetersApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly tagsApi = inject(TagsApi);
  private readonly toast = inject(ToastService);

  readonly asset = input<MappedAsset | null>(null);
  readonly closed = output<void>();
  readonly saved = output<TagMappingResponse[]>();

  protected readonly help = METRIC_HELP;
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly rows = signal<Row[]>([]);
  protected readonly devices = signal<Device[]>([]);
  private readonly tagsByDevice = signal<ReadonlyMap<number, Tag[]>>(new Map());

  constructor() {
    effect(() => {
      const asset = this.asset();
      this.rows.set([]);
      if (asset) this.load(asset);
    });
  }

  protected tagsOf(deviceId: number | null): Tag[] {
    return deviceId === null ? [] : (this.tagsByDevice().get(deviceId) ?? []);
  }

  protected selectDevice(row: Row, deviceId: number | null): void {
    row.deviceId = deviceId;
    row.tagId = null;
    if (deviceId !== null) this.loadTags(deviceId);
  }

  private load(asset: MappedAsset): void {
    this.loading.set(true);
    const api = asset.kind === 'machine' ? this.machines : this.meters;
    forkJoin({
      mappings: api.tagMappings(asset.id),
      devices: this.devicesApi.listAll(),
    }).subscribe({
      next: ({ mappings, devices }) => {
        // Only the asset's company's devices can carry its tags.
        this.devices.set(devices.filter((d) => d.company_id === asset.company_id));
        const metrics = asset.kind === 'machine' ? MACHINE_METRICS : METER_METRICS;
        this.rows.set(
          metrics.map((metric) => {
            const current = mappings.find((m) => m.metric === metric);
            return {
              metric,
              deviceId: current?.device_id ?? asset.device_id,
              tagId: current?.tag_id ?? null,
            };
          }),
        );
        new Set(this.rows().map((r) => r.deviceId)).forEach(
          (id) => id !== null && this.loadTags(id),
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err, 'Unable to load the asset tags.');
      },
    });
  }

  private loadTags(deviceId: number): void {
    if (this.tagsByDevice().has(deviceId)) return;
    this.tagsByDevice.update((map) => new Map(map).set(deviceId, []));
    this.tagsApi.listAll({ device_id: deviceId, status: VISIBLE_STATUSES }).subscribe({
      next: (tags) => this.tagsByDevice.update((map) => new Map(map).set(deviceId, tags)),
      error: (err) => this.toast.error(err, 'Unable to load the device’s tags.'),
    });
  }

  protected save(): void {
    const asset = this.asset();
    if (!asset) return;
    const mappings: TagMappingItem[] = this.rows()
      .filter((r) => r.tagId !== null)
      .map((r) => ({ metric: r.metric, tag_id: r.tagId!, device_id: r.deviceId }));
    const api = asset.kind === 'machine' ? this.machines : this.meters;
    this.saving.set(true);
    api.setTagMappings(asset.id, mappings).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.toast.success(`Asset tags of "${asset.name}" saved (${result.length} mapped).`);
        this.saved.emit(result);
        this.closed.emit();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
