import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { noop } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { CompaniesApi } from '../../core/api/resources/admin.api';
import { DevicesApi } from '../../core/api/resources/devices.api';
import { GatewaysApi } from '../../core/api/resources/plant-assets.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import {
  Company,
  Device,
  DeviceCreate,
  DeviceUpdate,
  Gateway,
  RecordStatus,
} from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  ModalComponent,
  SkeletonComponent,
  StatusPillComponent,
  StatusTone,
} from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  VISIBLE_STATUSES,
  recordStatusLabel,
  recordStatusTone,
  toggledStatus,
} from '../../shared/utils/record-status';
import { DeviceConnectionsDialogComponent } from './device-connections-dialog.component';
import { DeviceTagsDialogComponent } from './device-tags-dialog.component';
import { formatDateTime } from '../../shared/utils/format';

@Component({
  selector: 'app-devices-page',
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    IconComponent,
    StatusPillComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ModalComponent,
    DeviceTagsDialogComponent,
    DeviceConnectionsDialogComponent,
  ],
  template: `
    <div class="dev-page">
      <header class="dev-header">
        <div class="dev-header__titles">
          <h1 class="dev-header__title">Connected Devices</h1>
          <p class="dev-header__subtitle">
            Manage edge data sources, gateways, and connection states
          </p>
        </div>
        <div class="dev-header__actions">
          <button appButton variant="secondary" (click)="loadDevices()">
            <app-icon name="refresh" [size]="14" [class.spinning]="loading()" />
            Refresh
          </button>
          <button appButton variant="primary" (click)="openCreateModal()">
            <app-icon name="plus" [size]="14" />
            Register Device
          </button>
        </div>
      </header>

      <div class="dev-toolbar">
        <div class="dev-search">
          <app-icon name="search" [size]="16" class="search-icon" />
          <input
            type="text"
            class="search-input"
            placeholder="Search external ID, name, or location..."
            [ngModel]="searchTerm()"
            (ngModelChange)="onSearchChange($event)"
          />
          @if (searchTerm()) {
            <button class="clear-btn" type="button" (click)="onSearchChange('')">
              <app-icon name="x" [size]="14" />
            </button>
          }
        </div>
        <div class="dev-stats">
          <select
            class="form-select dev-filter"
            aria-label="Device status"
            [ngModel]="statusView()"
            (ngModelChange)="setStatusView($event)"
          >
            <option value="visible">Active and inactive</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="delete">Deleted</option>
          </select>
          <span class="stat-badge">Total: {{ totalCount() }} devices</span>
        </div>
      </div>

      <app-card [padded]="false">
        @if (loading()) {
          <div class="dev-skeleton">
            @for (item of [1, 2, 3, 4, 5]; track item) {
              <app-skeleton height="48px" />
            }
          </div>
        } @else if (error()) {
          <div class="dev-state-container">
            <app-error-state
              heading="Failed to load devices"
              [message]="error()!"
              (retry)="loadDevices()"
            />
          </div>
        } @else if (devices().length === 0) {
          <div class="dev-state-container">
            <app-empty-state
              heading="No devices found"
              message="No devices match your current filters or have been registered."
            >
              <button appButton variant="primary" (click)="openCreateModal()">
                <app-icon name="plus" [size]="14" />
                Register First Device
              </button>
            </app-empty-state>
          </div>
        } @else {
          <div class="table-container">
            <table class="dev-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Device Name / ID</th>
                  <th>Source Protocol</th>
                  <th>IP Address</th>
                  <th>Location</th>
                  <th>Last Seen</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (device of devices(); track device.id) {
                  <tr>
                    <td>
                      <app-status-pill
                        dot
                        [label]="device.connection_state"
                        [tone]="statusTone(device.connection_state)"
                      />
                      @if (device.status !== 'active') {
                        <app-status-pill
                          [label]="recordLabel(device.status)"
                          [tone]="recordTone(device.status)"
                        />
                      }
                    </td>
                    <td>
                      <div class="cell-name">
                        <span class="cell-name__primary">{{
                          device.name || 'Unnamed Device'
                        }}</span>
                        <span class="cell-name__secondary">{{ device.external_id }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="protocol-badge">{{ device.source || 'UNKNOWN' }}</span>
                    </td>
                    <td>
                      <span class="cell-mono">{{ device.ip_address || '—' }}</span>
                    </td>
                    <td>{{ device.location || '—' }}</td>
                    <td>
                      <span class="cell-time">
                        <app-icon name="clock" [size]="13" />
                        {{ formatTime(device.last_seen_at) }}
                      </span>
                    </td>
                    <td class="text-right">
                      @if (device.status === 'delete') {
                        <button appButton variant="ghost" size="sm" (click)="restoreDevice(device)">
                          Restore
                        </button>
                      } @else {
                        <button
                          appButton
                          variant="ghost"
                          size="sm"
                          title="Tags"
                          (click)="tagsDevice.set(device)"
                        >
                          Tags
                        </button>
                        <button
                          appButton
                          variant="ghost"
                          size="sm"
                          title="Connections"
                          (click)="connectionsDevice.set(device)"
                        >
                          Connections
                        </button>
                        <button
                          appButton
                          variant="ghost"
                          size="sm"
                          title="Edit Device"
                          [attr.aria-label]="'Edit ' + (device.name || device.external_id)"
                          (click)="openEditModal(device)"
                        >
                          <app-icon name="edit" [size]="14" />
                        </button>
                        <button
                          appButton
                          variant="ghost"
                          size="sm"
                          [title]="device.status === 'active' ? 'Deactivate' : 'Activate'"
                          [attr.aria-label]="
                            (device.status === 'active' ? 'Deactivate ' : 'Activate ') +
                            (device.name || device.external_id)
                          "
                          (click)="toggleDevice(device)"
                        >
                          <app-icon name="settings" [size]="14" />
                        </button>
                        <button
                          appButton
                          variant="ghost"
                          size="sm"
                          title="Delete Device"
                          [attr.aria-label]="'Delete ' + (device.name || device.external_id)"
                          (click)="deleteDevice(device.id, device.name || device.external_id)"
                        >
                          <app-icon name="x" [size]="14" />
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <footer class="dev-footer">
            <span class="dev-footer__total"
              >Showing {{ devices().length }} of {{ totalCount() }}</span
            >
            <div class="dev-footer__pager">
              <button
                appButton
                variant="ghost"
                size="sm"
                [disabled]="currentPage() <= 1 || loading()"
                (click)="setPage(currentPage() - 1)"
              >
                <app-icon name="chevron-left" [size]="14" />
                Prev
              </button>
              <span class="pager-text">Page {{ currentPage() }} of {{ totalPages() }}</span>
              <button
                appButton
                variant="ghost"
                size="sm"
                [disabled]="currentPage() >= totalPages() || loading()"
                (click)="setPage(currentPage() + 1)"
              >
                Next
                <app-icon name="chevron-right" [size]="14" />
              </button>
            </div>
          </footer>
        }
      </app-card>

      <!-- Register / Edit Device Modal -->
      <app-modal
        [open]="modalOpen()"
        [title]="editingDeviceId() ? 'Edit Device' : 'Register New Device'"
        [subtitle]="
          editingDeviceId()
            ? 'Update connection details'
            : 'Register an industrial edge device or PLC'
        "
        (close)="modalOpen.set(false)"
      >
        <form (ngSubmit)="saveDevice()" class="modal-form">
          @if (isPlatformAdmin()) {
            <div class="form-group">
              <label class="form-label">Company</label>
              <select class="form-select" [(ngModel)]="deviceForm.company_id" name="company_id">
                <option [ngValue]="null">Unassigned</option>
                @for (c of companies(); track c.id) {
                  <option [ngValue]="c.id">{{ c.name }} ({{ c.code }})</option>
                }
              </select>
            </div>
          }
          <div class="form-group">
            <label class="form-label">External ID (Unique Hardware Identifier) *</label>
            <input
              type="text"
              class="form-input"
              placeholder="e.g. PLC-LINE1-001"
              [(ngModel)]="deviceForm.external_id"
              name="external_id"
              [disabled]="!!editingDeviceId()"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Device Name</label>
            <input
              type="text"
              class="form-input"
              placeholder="e.g. Siemens S7-1200 Controller"
              [(ngModel)]="deviceForm.name"
              name="name"
            />
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Source Protocol</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. MODBUS_TCP, MQTT, OPC_UA"
                [(ngModel)]="deviceForm.source"
                [disabled]="!!editingDeviceId()"
                name="source"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">IP Address</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. 192.168.1.10"
                [(ngModel)]="deviceForm.ip_address"
                name="ip_address"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Device type</label>
              <input
                type="text"
                class="form-input"
                placeholder="e.g. PLC, Energy Meter"
                [(ngModel)]="deviceForm.device_type"
                name="device_type"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">Gateway</label>
              <select class="form-select" [(ngModel)]="deviceForm.gateway_id" name="gateway_id">
                <option [ngValue]="null">None</option>
                @for (g of gatewaysForForm(); track g.id) {
                  <option [ngValue]="g.id">{{ g.name }} ({{ g.gateway_code }})</option>
                }
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Physical Location</label>
            <input
              type="text"
              class="form-input"
              placeholder="e.g. Building B, Main Electrical Panel"
              [(ngModel)]="deviceForm.location"
              name="location"
            />
          </div>

          <div class="modal-actions">
            <button appButton variant="secondary" type="button" (click)="modalOpen.set(false)">
              Cancel
            </button>
            <button
              appButton
              variant="primary"
              type="submit"
              [disabled]="saving() || !deviceForm.external_id.trim()"
            >
              {{ saving() ? 'Saving...' : editingDeviceId() ? 'Update Device' : 'Register Device' }}
            </button>
          </div>
        </form>
      </app-modal>
    </div>

    <app-device-tags-dialog [device]="tagsDevice()" (closed)="tagsDevice.set(null)" />
    <app-device-connections-dialog
      [device]="connectionsDevice()"
      (closed)="connectionsDevice.set(null)"
    />
  `,
  styles: `
    .dev-filter {
      width: auto;
    }

    .dev-page {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      max-width: 1400px;
      margin: 0 auto;
    }

    .dev-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .dev-header__title {
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .dev-header__subtitle {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: 4px 0 0;
    }

    .dev-header__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .dev-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .dev-search {
      position: relative;
      flex: 1;
      max-width: 420px;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 38px;
      padding: 0 34px 0 36px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: var(--text-sm);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 1px var(--accent-cyan);
    }

    .clear-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: grid;
      place-items: center;
    }

    .clear-btn:hover {
      color: var(--text-primary);
    }

    .dev-stats {
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .stat-badge {
      padding: 6px 12px;
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
    }

    .table-container {
      overflow-x: auto;
    }

    .dev-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
      text-align: left;
    }

    .dev-table th {
      padding: 12px 16px;
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-light);
      background: rgba(255, 255, 255, 0.01);
    }

    .dev-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-primary);
    }

    .dev-table tr:hover td {
      background: var(--bg-card-hover);
    }

    .text-right {
      text-align: right;
    }

    .cell-name {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .cell-name__primary {
      font-weight: 500;
      color: var(--text-primary);
    }

    .cell-name__secondary {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    .cell-mono {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .cell-time {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .protocol-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      background: rgba(6, 182, 212, 0.12);
      color: var(--accent-cyan);
      border: 1px solid rgba(6, 182, 212, 0.25);
    }

    .dev-skeleton {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .dev-state-container {
      padding: 32px 16px;
    }

    .dev-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-top: 1px solid var(--border-light);
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .dev-footer__pager {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pager-text {
      padding: 0 4px;
    }

    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .flex-1 {
      flex: 1;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--text-secondary);
    }

    .form-input {
      width: 100%;
      height: 38px;
      padding: 0 12px;
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: var(--text-sm);
    }

    .form-input:focus {
      outline: none;
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 1px var(--accent-cyan);
    }

    .form-input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicesPageComponent implements OnInit {
  private readonly devicesApi = inject(DevicesApi);

  readonly devices = signal<Device[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly currentPage = signal(1);
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);
  readonly pageSize = 20;

  private readonly toast = inject(ToastService);

  private readonly auth = inject(AuthService);
  private readonly companiesApi = inject(CompaniesApi);
  private readonly gatewaysApi = inject(GatewaysApi);
  protected readonly isPlatformAdmin = computed(() =>
    this.auth.hasPermission(Permission.TenantAll),
  );
  readonly companies = signal<Company[]>([]);
  readonly gateways = signal<Gateway[]>([]);
  readonly statusView = signal<'visible' | RecordStatus>('visible');
  readonly tagsDevice = signal<Device | null>(null);
  readonly connectionsDevice = signal<Device | null>(null);
  protected readonly recordLabel = recordStatusLabel;
  protected readonly recordTone = recordStatusTone;

  // Modal
  readonly modalOpen = signal(false);
  readonly editingDeviceId = signal<number | null>(null);
  deviceForm = this.blankForm();

  ngOnInit(): void {
    this.loadDevices();
    this.gatewaysApi.listAll().subscribe({
      next: (gateways) => this.gateways.set(gateways),
      error: () => this.gateways.set([]),
    });
    if (this.isPlatformAdmin()) {
      this.companiesApi.listAll().subscribe({
        next: (companies) => this.companies.set(companies),
        error: (err) => this.toast.error(err, 'Unable to load companies.'),
      });
    }
  }

  setStatusView(view: 'visible' | RecordStatus): void {
    this.statusView.set(view);
    this.currentPage.set(1);
    this.loadDevices();
  }

  /** A device's gateway must belong to the device's company. */
  gatewaysForForm(): Gateway[] {
    const companyId = this.deviceForm.company_id;
    if (!this.isPlatformAdmin()) return this.gateways();
    return companyId ? this.gateways().filter((g) => g.company_id === companyId) : [];
  }

  loadDevices(): void {
    this.loading.set(true);
    this.error.set(null);

    this.devicesApi
      .list({
        status: this.statusView() === 'visible' ? VISIBLE_STATUSES : this.listStatus(),
        page: this.currentPage(),
        page_size: this.pageSize,
        search: this.searchTerm().trim() || undefined,
      })
      .subscribe({
        next: (page) => {
          this.devices.set(page.items);
          this.totalCount.set(page.pagination.total);
          this.totalPages.set(page.pagination.total_pages || 1);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to load devices from server.');
          this.loading.set(false);
        },
      });
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
    this.loadDevices();
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadDevices();
    }
  }

  openCreateModal(): void {
    this.editingDeviceId.set(null);
    this.deviceForm = this.blankForm();
    this.modalOpen.set(true);
  }

  openEditModal(device: Device): void {
    this.editingDeviceId.set(device.id);
    this.deviceForm = {
      company_id: device.company_id,
      gateway_id: device.gateway_id,
      external_id: device.external_id,
      name: device.name || '',
      device_type: device.device_type || '',
      source: device.source || '',
      ip_address: device.ip_address || '',
      location: device.location || '',
    };
    this.modalOpen.set(true);
  }

  saveDevice(): void {
    if (!this.deviceForm.external_id.trim()) return;
    this.saving.set(true);

    const editingId = this.editingDeviceId();
    if (editingId) {
      const payload: DeviceUpdate = {
        name: this.deviceForm.name.trim() || null,
        device_type: this.deviceForm.device_type.trim() || null,
        ip_address: this.deviceForm.ip_address.trim() || null,
        location: this.deviceForm.location.trim() || null,
        gateway_id: this.deviceForm.gateway_id,
      };
      if (this.isPlatformAdmin()) {
        payload.company_id = this.deviceForm.company_id; // reassigning needs an unlinked device
      }
      this.devicesApi.update(editingId, payload).subscribe({
        next: (updated) => {
          this.devices.update((list) => list.map((d) => (d.id === updated.id ? updated : d)));
          this.modalOpen.set(false);
          this.saving.set(false);
          this.toast.success(`Device "${updated.name || updated.external_id}" updated.`);
        },
        error: () => {
          this.saving.set(false);
        },
      });
    } else {
      const payload: DeviceCreate = {
        external_id: this.deviceForm.external_id.trim(),
        name: this.deviceForm.name.trim() || null,
        device_type: this.deviceForm.device_type.trim() || null,
        source: this.deviceForm.source.trim() || 'MODBUS_TCP',
        ip_address: this.deviceForm.ip_address.trim() || null,
        location: this.deviceForm.location.trim() || null,
        gateway_id: this.deviceForm.gateway_id,
        company_id: this.isPlatformAdmin() ? this.deviceForm.company_id : undefined,
      };
      this.devicesApi.create(payload).subscribe({
        next: (created) => {
          this.devices.update((list) => [created, ...list]);
          this.totalCount.update((n) => n + 1);
          this.modalOpen.set(false);
          this.saving.set(false);
          this.toast.success(`Device "${created.name || created.external_id}" registered.`);
        },
        error: () => {
          this.saving.set(false);
        },
      });
    }
  }

  deleteDevice(id: number, name: string): void {
    if (!confirm(`Are you sure you want to delete device "${name}"?`)) return;

    this.devicesApi.delete(id).subscribe({
      next: () => {
        this.devices.update((list) => list.filter((d) => d.id !== id));
        this.toast.success(`Device \"${name}\" deleted.`);
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  toggleDevice(device: Device): void {
    const status = toggledStatus(device.status);
    const name = device.name || device.external_id;
    this.devicesApi.update(device.id, { status }).subscribe({
      next: (updated) => {
        this.devices.update((list) => list.map((d) => (d.id === updated.id ? updated : d)));
        this.toast.success(
          status === 'active'
            ? `Device "${name}" activated.`
            : `Device "${name}" deactivated: its telemetry is no longer stored.`,
        );
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  restoreDevice(device: Device): void {
    this.devicesApi.update(device.id, { status: 'active' }).subscribe({
      next: () => {
        this.devices.update((list) => list.filter((d) => d.id !== device.id));
        this.toast.success(`Device "${device.name || device.external_id}" restored.`);
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  private listStatus(): RecordStatus {
    const view = this.statusView();
    return view === 'visible' ? 'active' : view;
  }

  private blankForm(): {
    company_id: number | null;
    gateway_id: number | null;
    external_id: string;
    name: string;
    device_type: string;
    source: string;
    ip_address: string;
    location: string;
  } {
    return {
      company_id: null,
      gateway_id: null,
      external_id: '',
      name: '',
      device_type: '',
      source: 'MODBUS_TCP',
      ip_address: '',
      location: '',
    };
  }

  statusTone(state: string): StatusTone {
    switch (state) {
      case 'ONLINE':
        return 'running';
      case 'OFFLINE':
        return 'warning';
      default:
        return 'stopped';
    }
  }

  formatTime(iso: string | null): string {
    return iso ? formatDateTime(iso) : 'Never seen';
  }
}
