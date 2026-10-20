import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { noop } from 'rxjs';

import { CompaniesApi } from '../../core/api/resources/admin.api';
import { BusinessUnitsApi } from '../../core/api/resources/business-units.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import {
  BusinessUnit,
  BusinessUnitCreate,
  BusinessUnitUpdate,
  Company,
  RecordStatus,
} from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  DrawerComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  SearchableSelectComponent,
  SelectOption,
  SkeletonComponent,
  StatusPillComponent,
} from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  VISIBLE_STATUSES,
  recordStatusLabel,
  recordStatusTone,
  toggledStatus,
} from '../../shared/utils/record-status';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Active and inactive' },
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
  { value: 'delete', label: 'Deleted' },
];

interface UnitForm {
  company_id: number | null;
  name: string;
  code: string;
  description: string;
}

/** Business units / branches of a company (Company -> Business Unit -> Plant). */
@Component({
  selector: 'app-business-units-page',
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    CardComponent,
    DrawerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    SearchableSelectComponent,
    SkeletonComponent,
    StatusPillComponent,
  ],
  template: `
    <div class="bu-page">
      <header class="bu-header">
        <div>
          <h1 class="bu-title">Business Units</h1>
          <p class="bu-subtitle">Branches or divisions of the company that group its plants</p>
        </div>
        <div class="bu-actions">
          <button appButton variant="secondary" (click)="load()">
            <app-icon name="refresh" [size]="14" /> Refresh
          </button>
          @if (canCreate()) {
            <button appButton variant="primary" (click)="openCreate()">
              <app-icon name="plus" [size]="14" /> New Business Unit
            </button>
          }
        </div>
      </header>

      <div class="bu-toolbar">
        <div class="search-box">
          <app-icon name="search" [size]="16" class="search-icon" />
          <input
            type="text"
            class="search-input"
            placeholder="Search code or name..."
            aria-label="Search business units"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
          />
        </div>
        <label class="filter">
          <span>Status</span>
          <app-searchable-select
            ariaLabel="Status"
            [options]="statusOptions"
            [ngModel]="statusFilter()"
            (ngModelChange)="setStatusFilter($event)"
          />
        </label>
      </div>

      @if (loading()) {
        <app-card><app-skeleton height="200px" /></app-card>
      } @else if (error(); as err) {
        <app-card>
          <app-error-state
            heading="Failed to load business units"
            [message]="err"
            (retry)="load()"
          />
        </app-card>
      } @else if (visibleUnits().length === 0) {
        <app-card>
          <app-empty-state
            heading="No business units"
            message="Business units group plants by branch or division. Plants can also stay outside any business unit."
          >
            @if (canCreate()) {
              <button appButton variant="primary" (click)="openCreate()">
                <app-icon name="plus" [size]="14" /> Create business unit
              </button>
            }
          </app-empty-state>
        </app-card>
      } @else {
        <app-card [padded]="false">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col" class="num">Plants</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (u of visibleUnits(); track u.id) {
                  <tr>
                    <td class="mono">{{ u.code }}</td>
                    <td>
                      <strong>{{ u.name }}</strong>
                      @if (u.description) {
                        <div class="muted">{{ u.description }}</div>
                      }
                    </td>
                    <td class="num mono">{{ u.plants }}</td>
                    <td>
                      <app-status-pill
                        [label]="statusLabel(u.status)"
                        [tone]="statusTone(u.status)"
                      />
                    </td>
                    <td class="actions-col">
                      @if (u.status === 'delete') {
                        @if (canUpdate()) {
                          <button appButton variant="ghost" size="sm" (click)="restore(u)">
                            <app-icon name="refresh" [size]="14" /> Restore
                          </button>
                        }
                      } @else {
                        @if (canUpdate()) {
                          <button appButton variant="ghost" size="sm" (click)="openEdit(u)">
                            <app-icon name="edit" [size]="14" /> Edit
                          </button>
                          <button appButton variant="ghost" size="sm" (click)="toggleStatus(u)">
                            <app-icon name="settings" [size]="14" />
                            {{ u.status === 'active' ? 'Deactivate' : 'Activate' }}
                          </button>
                        }
                        @if (canDelete()) {
                          <button
                            appButton
                            variant="ghost"
                            size="sm"
                            class="text-danger"
                            [disabled]="u.plants > 0"
                            [title]="u.plants > 0 ? 'Move or delete its plants first' : 'Delete'"
                            (click)="remove(u)"
                          >
                            <app-icon name="x" [size]="14" /> Delete
                          </button>
                        }
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-card>
      }

      <app-drawer
        [open]="drawerOpen()"
        [title]="editingId() ? 'Edit Business Unit' : 'New Business Unit'"
        subtitle="A branch or division that groups plants"
        (close)="drawerOpen.set(false)"
      >
        <form class="form" (ngSubmit)="save()">
          @if (isPlatformAdmin() && !editingId()) {
            <div class="form-group">
              <label class="form-label" for="buCompany">Company *</label>
              <app-searchable-select
                id="buCompany"
                ariaLabel="Company"
                placeholder="Select the company"
                [options]="companyOptions()"
                [(ngModel)]="form.company_id"
                name="company_id"
              />
            </div>
          }
          <div class="form-group">
            <label class="form-label" for="buName">Name *</label>
            <input
              id="buName"
              class="form-input"
              name="name"
              required
              maxlength="200"
              placeholder="e.g. Southern Region"
              [(ngModel)]="form.name"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="buCode">Code *</label>
            <input
              id="buCode"
              class="form-input"
              name="code"
              required
              maxlength="64"
              placeholder="e.g. SOUTH"
              [(ngModel)]="form.code"
            />
            @if (form.code && !codeValid()) {
              <p class="form-error" role="alert">
                Letters, digits, '-', '_' and '.' only, starting with a letter or digit.
              </p>
            }
          </div>
          <div class="form-group">
            <label class="form-label" for="buDescription">Description</label>
            <textarea
              id="buDescription"
              class="form-textarea"
              rows="3"
              name="description"
              maxlength="1000"
              [(ngModel)]="form.description"
            ></textarea>
          </div>
          <div class="form-actions">
            <button appButton variant="secondary" type="button" (click)="drawerOpen.set(false)">
              Cancel
            </button>
            <button appButton variant="primary" type="submit" [disabled]="!canSave()">
              {{ saving() ? 'Saving...' : editingId() ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </app-drawer>
    </div>
  `,
  styles: `
    .bu-page {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .bu-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: var(--space-3);
    }
    .bu-title {
      margin: 0;
      font-size: var(--fs-xl);
    }
    .bu-subtitle,
    .muted {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--fs-sm);
    }
    .bu-actions,
    .bu-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: center;
    }
    .bu-toolbar {
      justify-content: space-between;
    }
    .search-box {
      position: relative;
      flex: 1;
      min-width: 220px;
      max-width: 420px;
    }
    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
    }
    .search-input,
    .form-input,
    .form-textarea {
      width: 100%;
      padding: 8px 10px;
      background: var(--bg-topbar);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: var(--fs-sm);
    }
    .search-input {
      padding-left: 32px;
    }
    .filter {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--fs-sm);
      color: var(--text-secondary);
    }
    .table-wrap {
      overflow-x: auto;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--fs-sm);
    }
    .table th,
    .table td {
      padding: var(--space-2) var(--space-3);
      border-bottom: 1px solid var(--border-light);
      text-align: left;
      vertical-align: middle;
    }
    .table th {
      color: var(--text-secondary);
      font-weight: var(--fw-semibold);
    }
    .num {
      text-align: right !important;
    }
    .mono {
      font-family: var(--font-mono, monospace);
    }
    .actions-col {
      white-space: nowrap;
      text-align: right !important;
    }
    .text-danger {
      color: var(--status-fault-text);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .form-label {
      font-size: var(--fs-sm);
      font-weight: var(--fw-semibold);
    }
    .form-error {
      margin: 0;
      font-size: var(--fs-xs);
      color: var(--status-fault-text);
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessUnitsPageComponent implements OnInit {
  private readonly api = inject(BusinessUnitsApi);
  private readonly companiesApi = inject(CompaniesApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly statusLabel = recordStatusLabel;
  protected readonly statusTone = recordStatusTone;

  protected readonly units = signal<BusinessUnit[]>([]);
  protected readonly companies = signal<Company[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly statusFilter = signal<'all' | RecordStatus>('all');
  protected readonly drawerOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected form: UnitForm = this.blank();

  protected readonly isPlatformAdmin = computed(() =>
    this.auth.hasPermission(Permission.TenantAll),
  );
  protected readonly canCreate = computed(() =>
    this.auth.hasPermission(Permission.BusinessUnitsCreate),
  );
  protected readonly canUpdate = computed(() =>
    this.auth.hasPermission(Permission.BusinessUnitsUpdate),
  );
  protected readonly canDelete = computed(() =>
    this.auth.hasPermission(Permission.BusinessUnitsDelete),
  );
  protected readonly companyOptions = computed<SelectOption[]>(() =>
    this.companies().map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
  );

  protected readonly visibleUnits = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.units().filter(
      (u) =>
        (status === 'all' || u.status === status) &&
        (!term || u.code.toLowerCase().includes(term) || u.name.toLowerCase().includes(term)),
    );
  });

  ngOnInit(): void {
    this.load();
    if (this.isPlatformAdmin()) {
      this.companiesApi.listAll().subscribe({ next: (c) => this.companies.set(c), error: noop });
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listAll({ status: this.statusFilter() === 'delete' ? 'delete' : VISIBLE_STATUSES })
      .subscribe({
        next: (units) => {
          this.units.set(units);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to load business units.');
          this.loading.set(false);
        },
      });
  }

  protected setStatusFilter(filter: 'all' | RecordStatus): void {
    const reload = filter === 'delete' || this.statusFilter() === 'delete';
    this.statusFilter.set(filter);
    if (reload) this.load();
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form = this.blank();
    this.drawerOpen.set(true);
  }

  protected openEdit(unit: BusinessUnit): void {
    this.editingId.set(unit.id);
    this.form = {
      company_id: unit.company_id,
      name: unit.name,
      code: unit.code,
      description: unit.description ?? '',
    };
    this.drawerOpen.set(true);
  }

  protected codeValid(): boolean {
    return /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(this.form.code.trim());
  }

  protected canSave(): boolean {
    return (
      !this.saving() &&
      !!this.form.name.trim() &&
      !!this.form.code.trim() &&
      this.codeValid() &&
      (!this.isPlatformAdmin() || !!this.editingId() || !!this.form.company_id)
    );
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    const name = this.form.name.trim();
    const code = this.form.code.trim();
    const description = this.form.description.trim() || null;
    const id = this.editingId();
    const request = id
      ? this.api.update(id, { name, code, description } satisfies BusinessUnitUpdate)
      : this.api.create({
          name,
          code,
          description,
          company_id: this.isPlatformAdmin() ? this.form.company_id : undefined,
        } satisfies BusinessUnitCreate);
    request.subscribe({
      next: (unit) => {
        this.units.update((list) =>
          id ? list.map((u) => (u.id === unit.id ? unit : u)) : [unit, ...list],
        );
        this.saving.set(false);
        this.drawerOpen.set(false);
        this.toast.success(`Business unit "${unit.name}" ${id ? 'updated' : 'created'}.`);
      },
      error: () => this.saving.set(false), // the error toast comes from errorToastInterceptor
    });
  }

  protected toggleStatus(unit: BusinessUnit): void {
    const status = toggledStatus(unit.status);
    this.api.update(unit.id, { status }).subscribe({
      next: (updated) => {
        this.units.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
        this.toast.success(
          `Business unit "${unit.name}" ${status === 'active' ? 'activated' : 'deactivated'}.`,
        );
      },
      error: noop,
    });
  }

  protected remove(unit: BusinessUnit): void {
    if (!confirm(`Delete business unit "${unit.name}"? It can be restored later.`)) return;
    this.api.delete(unit.id).subscribe({
      next: () => {
        this.units.update((list) => list.filter((u) => u.id !== unit.id));
        this.toast.success(`Business unit "${unit.name}" deleted.`);
      },
      error: noop,
    });
  }

  protected restore(unit: BusinessUnit): void {
    this.api.update(unit.id, { status: 'active' }).subscribe({
      next: () => {
        this.units.update((list) => list.filter((u) => u.id !== unit.id));
        this.toast.success(`Business unit "${unit.name}" restored.`);
      },
      error: noop,
    });
  }

  private blank(): UnitForm {
    return { company_id: null, name: '', code: '', description: '' };
  }
}
